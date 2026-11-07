import type { DbDatabase, DbShift, DbCheck } from '../../server_db.ts';
import type {
  ShiftReconciliationReport,
  ShiftTransactionRow,
  ShiftDiscrepancyItem,
  ReconciliationDiscrepancyStatus,
} from '../../src/types/analyticsAndLoyalty.ts';
import { finalizeGatewayAndDrawerReconciliation } from './shiftGatewayAndDrawerReconciler.ts';

export function computeShiftReconciliationReport(
  db: DbDatabase,
  shiftId: string
): ShiftReconciliationReport | null {
  const shift: DbShift | undefined = db.shifts?.[shiftId];
  if (!shift) return null;

  const shiftStartMs = new Date(shift.openedAt).getTime();
  const shiftEndMs = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();

  // 1. Collect POS checks belonging to this shift
  const allChecks = Object.values(db.checks || {}) as DbCheck[];
  const shiftChecks = allChecks.filter((chk) => {
    if (chk.shiftId) {
      return chk.shiftId === shift.id;
    }
    if (chk.branchId !== shift.branchId) return false;
    const t = new Date(chk.paidAt || chk.closedAt || chk.openedAt).getTime();
    return t >= shiftStartMs && t <= shiftEndMs;
  });

  const checkIds = new Set(shiftChecks.map((c) => c.id));
  const checkOrderIds = new Set(shiftChecks.map((c) => c.orderId).filter(Boolean));
  const checkNumbers = new Set(shiftChecks.map((c) => c.checkNumber).filter(Boolean));

  // 2. Collect standalone Orders belonging to this shift (excluding orders already represented by a POS Check)
  const allOrders = Object.values(db.orders || {}) as any[];
  const shiftStandaloneOrders = allOrders.filter((ord) => {
    if (checkOrderIds.has(ord.id) || (ord.checkId && checkIds.has(ord.checkId))) {
      return false;
    }
    if (ord.shiftId) {
      return ord.shiftId === shift.id;
    }
    if (ord.branchId !== shift.branchId) return false;
    const t = new Date(ord.createdAt).getTime();
    return t >= shiftStartMs && t <= shiftEndMs;
  });

  const orderIds = new Set([
    ...Array.from(checkOrderIds),
    ...shiftStandaloneOrders.map((o) => o.id),
  ]);
  const orderNumbers = new Set([
    ...Array.from(checkNumbers),
    ...shiftStandaloneOrders.map((o) => o.orderNumber).filter(Boolean),
  ]);

  // 3. Collect Gateway Payment Transactions associated with this shift
  const allGatewayTxs = Object.values(db.paymentTransactions || {}) as any[];
  const shiftGatewayTxs = allGatewayTxs.filter((ptx) => {
    if (ptx.shiftId === shift.id) return true;
    if (ptx.orderId && (orderIds.has(ptx.orderId) || checkIds.has(ptx.orderId))) return true;
    if (ptx.orderNumber && orderNumbers.has(ptx.orderNumber)) return true;
    if (ptx.branchId === shift.branchId) {
      const t = new Date(ptx.createdAt || ptx.paidAt || ptx.updatedAt).getTime();
      return t >= shiftStartMs && t <= shiftEndMs;
    }
    return false;
  });

  const gatewayByOrderKey = new Map<string, any[]>();
  const referenceOccurrences = new Map<string, number>();

  for (const ptx of shiftGatewayTxs) {
    const ref = String(ptx.reference || '').trim();
    if (ref) {
      referenceOccurrences.set(ref, (referenceOccurrences.get(ref) || 0) + 1);
    }
    const keys = [ptx.orderId, ptx.orderNumber, ptx.checkId].filter(Boolean);
    for (const k of keys) {
      const list = gatewayByOrderKey.get(String(k)) || [];
      list.push(ptx);
      gatewayByOrderKey.set(String(k), list);
    }
  }

  // 4. Collect Refunds for this shift
  const allRefunds = Object.values(db.refunds || {}) as any[];
  const shiftRefunds = allRefunds.filter((ref) => {
    if (ref.shiftId === shift.id) return true;
    if (ref.orderId && (orderIds.has(ref.orderId) || checkIds.has(ref.orderId))) return true;
    return false;
  });
  const refundByOrderId = new Map<string, number>();
  for (const r of shiftRefunds) {
    if (r.status !== 'rejected' && r.orderId) {
      refundByOrderId.set(r.orderId, (refundByOrderId.get(r.orderId) || 0) + Number(r.amount || 0));
    }
  }

  let totalCompletedOrders = 0;
  let totalVoidedOrCancelled = 0;
  let totalRefundedOrders = 0;
  let totalPendingConfirmationOrders = 0;

  let grossSales = 0;
  let totalDiscounts = 0;
  let taxesAndServiceCharges = 0;
  let packagingFees = 0;
  let deliveryFees = 0;
  let totalRefundsValue = 0;
  let netRecognizedSales = 0;
  let pendingUnrecognizedValue = 0;

  let cashSales = 0;
  let posTerminalCardSales = 0;
  let bankTransferSales = 0;
  let onlineGatewaySales = 0;
  let walletOrHouseAccountSales = 0;
  let splitPaymentOrdersCount = 0;

  const transactions: ShiftTransactionRow[] = [];
  const discrepancyItems: ShiftDiscrepancyItem[] = [];
  const matchedGatewayRefs = new Set<string>();

  const processTransactionRecord = (rec: {
    id: string;
    sourceType: 'pos_check' | 'order';
    number: string;
    timestamp: string;
    operator: string;
    orderType: string;
    subtotal: number;
    discount: number;
    packaging: number;
    delivery: number;
    tax: number;
    total: number;
    rawMethod: string;
    rawPaymentStatus: string;
    rawOrderStatus: string;
    paymentDetails: any;
    explicitRef: string;
  }) => {
    const isVoided =
      rec.rawOrderStatus === 'voided' ||
      rec.rawOrderStatus === 'cancelled' ||
      rec.rawPaymentStatus === 'voided';
    const isRefunded = rec.rawPaymentStatus === 'refunded' || (refundByOrderId.get(rec.id) || 0) > 0;
    const isPaid = rec.rawPaymentStatus === 'paid' && !isVoided;
    const isFailed = rec.rawPaymentStatus === 'failed';

    const refundAmt =
      refundByOrderId.get(rec.id) || (rec.rawPaymentStatus === 'refunded' ? rec.total : 0);

    const m = (rec.rawMethod || 'cash').toLowerCase();
    let paymentChannel: ShiftTransactionRow['paymentChannel'] = 'cash';
    if (m === 'split') {
      paymentChannel = 'split';
    } else if (m.includes('pos') || m === 'card_terminal' || m === 'pos_terminal' || m === 'pos_on_delivery') {
      paymentChannel = 'pos_terminal';
    } else if (m.includes('transfer') || m === 'bank_transfer') {
      paymentChannel = 'bank_transfer';
    } else if (
      m.includes('paystack') ||
      m.includes('flutterwave') ||
      m.includes('monnify') ||
      m === 'online' ||
      m === 'card' ||
      m === 'online_paystack'
    ) {
      paymentChannel = 'online_gateway';
    } else if (m.includes('wallet') || m.includes('house')) {
      paymentChannel = 'wallet_or_house';
    } else {
      paymentChannel = 'cash';
    }

    const linkedGatewayList = [
      ...(gatewayByOrderKey.get(rec.id) || []),
      ...(gatewayByOrderKey.get(rec.number) || []),
    ];
    const uniqueGatewayRecords = Array.from(
      new Map(linkedGatewayList.map((g) => [g.id || g.reference, g])).values()
    );

    let gatewayConfirmedAmount = 0;
    let primaryRef = rec.explicitRef || '';
    for (const g of uniqueGatewayRecords) {
      if (g.reference) {
        matchedGatewayRefs.add(String(g.reference));
        if (!primaryRef) primaryRef = String(g.reference);
      }
      if (g.status === 'paid' || g.status === 'success') {
        gatewayConfirmedAmount += Number(g.amount || 0);
      }
    }

    if (primaryRef) {
      referenceOccurrences.set(primaryRef, (referenceOccurrences.get(primaryRef) || 0) + (uniqueGatewayRecords.length === 0 ? 1 : 0));
    }

    let reconciliationStatus: ReconciliationDiscrepancyStatus = 'reconciled';
    let discrepancyNote: string | undefined;

    if (isVoided) {
      totalVoidedOrCancelled += 1;
    } else if (isFailed) {
      reconciliationStatus = 'manual_review_required';
      discrepancyNote = 'Payment failed or abandoned; excluded from recognized sales.';
    } else if (!isPaid && !isRefunded) {
      totalPendingConfirmationOrders += 1;
      pendingUnrecognizedValue += rec.total;
      reconciliationStatus = 'pending_confirmation';
      discrepancyNote = 'Order/check payment is still pending confirmation; excluded from recognized revenue.';
      discrepancyItems.push({
        id: `disc-pend-${rec.id}`,
        status: 'pending_confirmation',
        severity: 'medium',
        reference: rec.number,
        expectedAmount: rec.total,
        actualAmount: 0,
        varianceAmount: -rec.total,
        description: `${rec.number} (${paymentChannel}) has status '${rec.rawPaymentStatus}' and awaits settlement confirmation.`,
      });
    } else {
      if (isRefunded) {
        totalRefundedOrders += 1;
        totalRefundsValue += refundAmt;
      } else {
        totalCompletedOrders += 1;
      }

      grossSales += rec.subtotal;
      totalDiscounts += rec.discount;
      packagingFees += rec.packaging;
      deliveryFees += rec.delivery;
      taxesAndServiceCharges += rec.tax;

      const netRecognizedForOrder = Math.max(0, rec.total - refundAmt);
      netRecognizedSales += netRecognizedForOrder;

      if (paymentChannel === 'split') {
        splitPaymentOrdersCount += 1;
        const splitCash = Number(rec.paymentDetails?.splitCashAmount || 0);
        const splitPos = Number(rec.paymentDetails?.splitPosAmount || 0);
        if (splitCash + splitPos > 0) {
          const ratio = rec.total > 0 ? netRecognizedForOrder / rec.total : 1;
          cashSales += Math.round(splitCash * ratio);
          posTerminalCardSales += Math.round(splitPos * ratio);
        } else {
          const half = Math.round(netRecognizedForOrder / 2);
          cashSales += half;
          posTerminalCardSales += netRecognizedForOrder - half;
        }
      } else if (paymentChannel === 'cash') {
        cashSales += netRecognizedForOrder;
      } else if (paymentChannel === 'pos_terminal') {
        posTerminalCardSales += netRecognizedForOrder;
      } else if (paymentChannel === 'bank_transfer') {
        bankTransferSales += netRecognizedForOrder;
      } else if (paymentChannel === 'online_gateway') {
        onlineGatewaySales += netRecognizedForOrder;
      } else if (paymentChannel === 'wallet_or_house') {
        walletOrHouseAccountSales += netRecognizedForOrder;
      }

      if (uniqueGatewayRecords.length > 0 && gatewayConfirmedAmount > 0 && Math.abs(gatewayConfirmedAmount - rec.total) >= 1) {
        reconciliationStatus = 'amount_mismatch';
        discrepancyNote = `Gateway confirmed ₦${gatewayConfirmedAmount.toLocaleString()} vs Order total ₦${rec.total.toLocaleString()}.`;
        discrepancyItems.push({
          id: `disc-amt-${rec.id}`,
          status: 'amount_mismatch',
          severity: 'high',
          reference: primaryRef || rec.number,
          expectedAmount: rec.total,
          actualAmount: gatewayConfirmedAmount,
          varianceAmount: gatewayConfirmedAmount - rec.total,
          description: `Gateway amount mismatch on ${rec.number}: expected ₦${rec.total.toLocaleString()}, gateway settled ₦${gatewayConfirmedAmount.toLocaleString()}.`,
        });
      }
    }

    transactions.push({
      id: rec.id,
      sourceType: rec.sourceType,
      orderOrCheckNumber: rec.number,
      timestamp: rec.timestamp,
      cashierOrOperator: rec.operator,
      orderType: rec.orderType,
      grossAmount: rec.subtotal,
      discountAmount: rec.discount,
      taxAndCharges: rec.packaging + rec.delivery + rec.tax,
      refundAmount: refundAmt,
      netPayable: Math.max(0, rec.total - refundAmt),
      paymentChannel,
      paymentStatus: isVoided
        ? 'voided'
        : isRefunded
        ? 'refunded'
        : isPaid
        ? 'paid'
        : isFailed
        ? 'failed'
        : 'pending',
      paymentReference: primaryRef || rec.number,
      gatewayConfirmedAmount,
      reconciliationStatus,
      discrepancyNote,
    });
  };

  for (const chk of shiftChecks) {
    processTransactionRecord({
      id: chk.id,
      sourceType: 'pos_check',
      number: chk.checkNumber || chk.id,
      timestamp: chk.paidAt || chk.closedAt || chk.openedAt,
      operator: chk.settledByName || chk.closedByName || chk.openedByName || shift.openedByName,
      orderType: chk.checkType || 'dine_in',
      subtotal: Number(chk.subtotal || 0),
      discount: Number(chk.discountAmount || 0),
      packaging: Number(chk.packagingFee || 0),
      delivery: Number(chk.deliveryFee || 0),
      tax: 0,
      total: Number(chk.total || 0),
      rawMethod: chk.paymentMethod || 'cash',
      rawPaymentStatus: chk.paymentStatus || 'unpaid',
      rawOrderStatus: chk.status || 'open',
      paymentDetails: chk.paymentDetails,
      explicitRef:
        chk.paymentDetails?.posTerminalRrn ||
        chk.paymentDetails?.bankTransferRef ||
        chk.paymentDetails?.reference ||
        '',
    });
  }

  for (const ord of shiftStandaloneOrders) {
    processTransactionRecord({
      id: ord.id,
      sourceType: 'order',
      number: ord.orderNumber || ord.id,
      timestamp: ord.createdAt,
      operator: ord.createdByStaffName || ord.orderChannel || 'Online / Walk-in',
      orderType: ord.orderType || 'delivery',
      subtotal: Number(ord.subtotal || 0),
      discount: Number(ord.discount || 0),
      packaging: Number(ord.packagingFee || 0),
      delivery: Number(ord.deliveryFee || 0),
      tax: 0,
      total: Number(ord.total || 0),
      rawMethod: ord.paymentMethod || 'cash',
      rawPaymentStatus: ord.paymentStatus || 'pending',
      rawOrderStatus: ord.orderStatus || 'received',
      paymentDetails: ord.paymentDetails,
      explicitRef: ord.paymentReference || ord.paymentDetails?.reference || '',
    });
  }

  return finalizeGatewayAndDrawerReconciliation({
    db,
    shift,
    shiftGatewayTxs,
    referenceOccurrences,
    matchedGatewayRefs,
    transactions,
    discrepancyItems,
    salesSummary: {
      totalCompletedOrders,
      totalVoidedOrCancelled,
      totalRefundedOrders,
      totalPendingConfirmationOrders,
      grossSales,
      totalDiscounts,
      taxesAndServiceCharges,
      packagingFees,
      deliveryFees,
      totalRefundsValue,
      netRecognizedSales,
      pendingUnrecognizedValue,
    },
    posPaymentBreakdown: {
      cashSales,
      posTerminalCardSales,
      bankTransferSales,
      onlineGatewaySales,
      walletOrHouseAccountSales,
      splitPaymentOrdersCount,
      totalCollectedAcrossChannels:
        cashSales +
        posTerminalCardSales +
        bankTransferSales +
        onlineGatewaySales +
        walletOrHouseAccountSales,
    },
  });
}
