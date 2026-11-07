import type { DbDatabase, DbShift, DbCashMovement } from '../../server_db.ts';
import type {
  ShiftReconciliationReport,
  ShiftTransactionRow,
  ShiftDiscrepancyItem,
  ReconciliationDiscrepancyStatus,
} from '../../src/types/analyticsAndLoyalty.ts';

export function finalizeGatewayAndDrawerReconciliation(params: {
  db: DbDatabase;
  shift: DbShift;
  shiftGatewayTxs: any[];
  referenceOccurrences: Map<string, number>;
  matchedGatewayRefs: Set<string>;
  transactions: ShiftTransactionRow[];
  discrepancyItems: ShiftDiscrepancyItem[];
  salesSummary: ShiftReconciliationReport['salesSummary'];
  posPaymentBreakdown: ShiftReconciliationReport['posPaymentBreakdown'];
}): ShiftReconciliationReport {
  const {
    db,
    shift,
    shiftGatewayTxs,
    referenceOccurrences,
    matchedGatewayRefs,
    transactions,
    discrepancyItems,
    salesSummary,
    posPaymentBreakdown,
  } = params;

  // 5. Inspect Gateway Records for Unmatched Payments or Duplicate References
  let verifiedSuccessfulCount = 0;
  let verifiedSuccessfulValue = 0;
  let gatewayPendingCount = 0;
  let gatewayPendingValue = 0;
  let failedOrAbandonedCount = 0;
  let failedOrAbandonedValue = 0;
  let reversedOrRefundedCount = 0;
  let reversedOrRefundedValue = 0;
  const byProvider: Record<string, { count: number; totalAmount: number; verifiedAmount: number }> = {};

  for (const ptx of shiftGatewayTxs) {
    const prov = String(ptx.provider || 'paystack').toLowerCase();
    if (!byProvider[prov]) {
      byProvider[prov] = { count: 0, totalAmount: 0, verifiedAmount: 0 };
    }
    const amt = Number(ptx.amount || 0);
    byProvider[prov].count += 1;
    byProvider[prov].totalAmount += amt;

    const st = String(ptx.status || 'pending').toLowerCase();
    if (st === 'paid' || st === 'success') {
      verifiedSuccessfulCount += 1;
      verifiedSuccessfulValue += amt;
      byProvider[prov].verifiedAmount += amt;
    } else if (st === 'refunded' || st === 'reversed') {
      reversedOrRefundedCount += 1;
      reversedOrRefundedValue += amt;
    } else if (st === 'failed' || st === 'abandoned') {
      failedOrAbandonedCount += 1;
      failedOrAbandonedValue += amt;
    } else {
      gatewayPendingCount += 1;
      gatewayPendingValue += amt;
    }

    const ref = String(ptx.reference || '').trim();
    if (ref && (referenceOccurrences.get(ref) || 0) > 1) {
      if (!discrepancyItems.some((d) => d.status === 'duplicate_reference' && d.reference === ref)) {
        discrepancyItems.push({
          id: `disc-dup-${ref}`,
          status: 'duplicate_reference',
          severity: 'high',
          reference: ref,
          expectedAmount: amt,
          actualAmount: amt * (referenceOccurrences.get(ref) || 2),
          varianceAmount: amt,
          description: `Duplicate payment reference '${ref}' detected across multiple gateway records.`,
        });
      }
    }

    if ((st === 'paid' || st === 'success') && (!ref || !matchedGatewayRefs.has(ref))) {
      discrepancyItems.push({
        id: `disc-unmatched-${ptx.id || ref}`,
        status: 'unmatched_payment',
        severity: 'high',
        reference: ref || ptx.id,
        expectedAmount: 0,
        actualAmount: amt,
        varianceAmount: amt,
        description: `Gateway payment '${ref || ptx.id}' (₦${amt.toLocaleString()}) has no matching POS check or order in this shift.`,
      });

      transactions.push({
        id: ptx.id || `gw-${ref}`,
        sourceType: 'gateway_only',
        orderOrCheckNumber: ptx.orderNumber || ptx.orderId || 'UNMATCHED-ORDER',
        timestamp: ptx.paidAt || ptx.createdAt || new Date().toISOString(),
        cashierOrOperator: prov.toUpperCase(),
        orderType: 'online',
        grossAmount: amt,
        discountAmount: 0,
        taxAndCharges: 0,
        refundAmount: 0,
        netPayable: amt,
        paymentChannel: 'online_gateway',
        paymentStatus: 'paid',
        paymentReference: ref || ptx.id,
        gatewayConfirmedAmount: amt,
        reconciliationStatus: 'unmatched_payment',
        discrepancyNote: 'Unmatched gateway settlement without corresponding shift order.',
      });
    }
  }

  // 6. Cash Drawer Reconciliation
  const shiftMovements: DbCashMovement[] = (db.cashMovements || []).filter(
    (m) => m.shiftId === shift.id
  );

  const openingFloat = Number(shift.openingFloat || 0);
  const cashSales = posPaymentBreakdown.cashSales;
  let paidInAmount = 0;
  let paidOutAmount = 0;
  let safeDropAmount = 0;
  let cashRefundsPaidOut = 0;

  for (const mov of shiftMovements) {
    const amt = Math.abs(Number(mov.amount || 0));
    if (mov.movementType === 'paid_out') {
      paidOutAmount += amt;
    } else if (mov.movementType === 'safe_drop') {
      safeDropAmount += amt;
    } else if (mov.movementType === 'cash_refund') {
      cashRefundsPaidOut += amt;
    } else if (mov.movementType === 'adjustment') {
      if (Number(mov.amount || 0) >= 0) {
        paidInAmount += amt;
      } else {
        paidOutAmount += amt;
      }
    }
  }

  const expectedDrawerCash = Math.round(
    openingFloat +
      cashSales +
      paidInAmount -
      paidOutAmount -
      safeDropAmount -
      cashRefundsPaidOut
  );

  const hasCountedCash =
    shift.countedCashInTill !== undefined && shift.countedCashInTill !== null;
  const countedClosingCash = hasCountedCash ? Number(shift.countedCashInTill) : null;
  const cashOverShortVariance =
    countedClosingCash !== null ? Math.round(countedClosingCash - expectedDrawerCash) : 0;

  let drawerStatus: 'balanced' | 'overage' | 'shortage' | 'open_shift_uncounted' =
    'open_shift_uncounted';
  if (countedClosingCash !== null) {
    if (Math.abs(cashOverShortVariance) < 1) {
      drawerStatus = 'balanced';
    } else if (cashOverShortVariance > 0) {
      drawerStatus = 'overage';
    } else {
      drawerStatus = 'shortage';
    }
  }

  if (countedClosingCash !== null && Math.abs(cashOverShortVariance) >= 500) {
    discrepancyItems.push({
      id: `disc-cash-${shift.id}`,
      status: 'manual_review_required',
      severity: Math.abs(cashOverShortVariance) >= 2000 ? 'high' : 'medium',
      reference: shift.shiftNumber || shift.id,
      expectedAmount: expectedDrawerCash,
      actualAmount: countedClosingCash,
      varianceAmount: cashOverShortVariance,
      description: `Cash drawer variance of ₦${cashOverShortVariance.toLocaleString()} exceeds tolerance threshold (Expected: ₦${expectedDrawerCash.toLocaleString()}, Counted: ₦${countedClosingCash.toLocaleString()}).`,
    });
  }

  let overallDiscrepancyStatus: ReconciliationDiscrepancyStatus = 'reconciled';
  if (discrepancyItems.length > 0) {
    const priority: ReconciliationDiscrepancyStatus[] = [
      'duplicate_reference',
      'unmatched_payment',
      'amount_mismatch',
      'manual_review_required',
      'pending_confirmation',
    ];
    for (const p of priority) {
      if (discrepancyItems.some((d) => d.status === p)) {
        overallDiscrepancyStatus = p;
        break;
      }
    }
  }

  const shiftLifecycleStatus: ShiftReconciliationReport['shift']['status'] =
    shift.status === 'open'
      ? 'open'
      : discrepancyItems.some((d) => d.severity === 'high') || Math.abs(cashOverShortVariance) >= 500
      ? 'flagged_variance'
      : shift.approvedByStaffId
      ? 'handed_over'
      : 'closed';

  transactions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    shift: {
      id: shift.id,
      branchId: shift.branchId,
      registerId: shift.registerId,
      openedByStaffId: shift.openedByStaffId,
      openedByName: shift.openedByName,
      closedByStaffId: shift.closedByStaffId,
      closedByName: shift.closedByName,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      status: shiftLifecycleStatus,
    },
    salesSummary,
    posPaymentBreakdown,
    cashDrawerReconciliation: {
      openingFloat,
      cashSalesReceived: cashSales,
      paidInAmount,
      paidOutAmount,
      safeDropAmount,
      cashRefundsPaidOut,
      expectedDrawerCash,
      countedClosingCash,
      cashOverShortVariance,
      varianceExplanation: shift.notes,
      status: drawerStatus,
    },
    gatewaySettlementSummary: {
      totalGatewayRecords: shiftGatewayTxs.length,
      verifiedSuccessfulCount,
      verifiedSuccessfulValue,
      pendingCount: gatewayPendingCount,
      pendingValue: gatewayPendingValue,
      failedOrAbandonedCount,
      failedOrAbandonedValue,
      reversedOrRefundedCount,
      reversedOrRefundedValue,
      byProvider,
    },
    discrepancies: {
      overallStatus: overallDiscrepancyStatus,
      totalDiscrepancyCount: discrepancyItems.length,
      items: discrepancyItems,
    },
    transactions,
    cashMovements: shiftMovements,
    generatedAt: new Date().toISOString(),
  };
}
