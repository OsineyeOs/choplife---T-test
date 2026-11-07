import { Router } from 'express';
import type { Request, Response } from 'express';
import type { DbDatabase, DbStaffAccount } from '../../server_db.ts';
import type { ShiftReconciliationReport } from '../../src/types/analyticsAndLoyalty.ts';
import { computeShiftReconciliationReport } from './shiftReconciliationCalculator.ts';

export { computeShiftReconciliationReport };

function sanitizeCsvCell(value: unknown): string {
  const str = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  const safeFormula = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (safeFormula.includes(',') || safeFormula.includes('"')) {
    return `"${safeFormula.replace(/"/g, '""')}"`;
  }
  return safeFormula;
}

export function generateShiftReconciliationCsv(report: ShiftReconciliationReport): string {
  const headers = [
    'Shift ID',
    'Branch ID',
    'Register ID',
    'Transaction ID',
    'Order/Check No',
    'Source Type',
    'Timestamp',
    'Operator',
    'Order Type',
    'Gross Amount (NGN)',
    'Discount (NGN)',
    'Fees & Tax (NGN)',
    'Refund (NGN)',
    'Net Payable (NGN)',
    'Payment Channel',
    'Payment Status',
    'Payment Reference',
    'Gateway Confirmed (NGN)',
    'Reconciliation Status',
    'Discrepancy Note',
  ];

  const rows = report.transactions.map((tx) =>
    [
      report.shift.id,
      report.shift.branchId,
      report.shift.registerId,
      tx.id,
      tx.orderOrCheckNumber,
      tx.sourceType,
      tx.timestamp,
      tx.cashierOrOperator,
      tx.orderType,
      tx.grossAmount,
      tx.discountAmount,
      tx.taxAndCharges,
      tx.refundAmount,
      tx.netPayable,
      tx.paymentChannel,
      tx.paymentStatus,
      tx.paymentReference,
      tx.gatewayConfirmedAmount,
      tx.reconciliationStatus,
      tx.discrepancyNote || '',
    ]
      .map(sanitizeCsvCell)
      .join(',')
  );

  rows.push('');
  rows.push(
    [
      'SHIFT SUMMARY',
      report.shift.branchId,
      report.shift.registerId,
      `Status: ${report.shift.status}`,
      `Completed Orders: ${report.salesSummary.totalCompletedOrders}`,
      `Recognized Net Sales: ${report.salesSummary.netRecognizedSales}`,
      `Cash Sales: ${report.posPaymentBreakdown.cashSales}`,
      `POS Card Sales: ${report.posPaymentBreakdown.posTerminalCardSales}`,
      `Bank Transfer Sales: ${report.posPaymentBreakdown.bankTransferSales}`,
      `Online Gateway Sales: ${report.posPaymentBreakdown.onlineGatewaySales}`,
      `Expected Drawer Cash: ${report.cashDrawerReconciliation.expectedDrawerCash}`,
      `Counted Drawer Cash: ${report.cashDrawerReconciliation.countedClosingCash ?? 'OPEN'}`,
      `Cash Variance: ${report.cashDrawerReconciliation.cashOverShortVariance}`,
      `Discrepancies: ${report.discrepancies.totalDiscrepancyCount}`,
    ]
      .map(sanitizeCsvCell)
      .join(',')
  );

  return [headers.map(sanitizeCsvCell).join(','), ...rows].join('\n');
}

export function createShiftReconciliationRouter(deps: {
  getDb: () => DbDatabase;
  requireAuth: any;
}): Router {
  const router = Router();
  const { getDb, requireAuth } = deps;

  const authorizeShiftAccess = (staff: DbStaffAccount, branchId: string): { allowed: boolean; error?: string } => {
    const allowedRoles = [
      'super_admin',
      'corporate_admin',
      'admin',
      'branch_manager',
      'accountant',
      'auditor',
      'cashier',
    ];
    if (!allowedRoles.includes(staff.role)) {
      return {
        allowed: false,
        error: `Forbidden: role '${staff.role}' is not authorized to access shift financial reconciliation.`,
      };
    }
    const universalRoles = ['super_admin', 'corporate_admin', 'admin', 'auditor', 'accountant'];
    if (!universalRoles.includes(staff.role)) {
      const staffBranches = new Set([staff.branchId, ...(staff.allowedBranchIds || [])]);
      if (!staffBranches.has(branchId)) {
        return {
          allowed: false,
          error: `Access denied. Staff member is not authorized for branch '${branchId}'.`,
        };
      }
    }
    return { allowed: true };
  };

  router.get('/api/admin/shifts', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const staff = (req as any).staff as DbStaffAccount;
    const { branchId, status, registerId, openedByStaffId, date } = req.query;

    const universalRoles = ['super_admin', 'corporate_admin', 'admin', 'auditor', 'accountant'];
    const staffBranches = new Set([staff.branchId, ...(staff.allowedBranchIds || [])]);

    if (branchId && branchId !== 'all' && !universalRoles.includes(staff.role)) {
      if (!staffBranches.has(String(branchId))) {
        return res.status(403).json({
          error: `Access denied. Staff member cannot query shifts for branch '${branchId}'.`,
        });
      }
    }

    let list = Object.values(db.shifts || {});

    if (!universalRoles.includes(staff.role)) {
      list = list.filter((s) => staffBranches.has(s.branchId));
    } else if (branchId && branchId !== 'all') {
      list = list.filter((s) => s.branchId === String(branchId));
    }

    if (status && status !== 'all') {
      list = list.filter((s) => s.status === String(status));
    }
    if (registerId) {
      list = list.filter((s) => s.registerId.toLowerCase().includes(String(registerId).toLowerCase()));
    }
    if (openedByStaffId) {
      list = list.filter((s) => s.openedByStaffId === String(openedByStaffId));
    }
    if (date) {
      const targetDate = String(date).slice(0, 10);
      list = list.filter((s) => s.openedAt.slice(0, 10) === targetDate);
    }

    list.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
    res.json(list);
  });

  const handleGetReconciliation = (req: Request, res: Response) => {
    const db = getDb();
    const staff = (req as any).staff as DbStaffAccount;
    const { id } = req.params;

    const shift = db.shifts?.[id];
    if (!shift) {
      return res.status(404).json({ error: `Shift '${id}' not found.` });
    }

    const authCheck = authorizeShiftAccess(staff, shift.branchId);
    if (!authCheck.allowed) {
      return res.status(403).json({ error: authCheck.error });
    }

    const report = computeShiftReconciliationReport(db, id);
    if (!report) {
      return res.status(404).json({ error: `Shift '${id}' reconciliation report could not be generated.` });
    }

    return res.json({
      success: true,
      ...report,
      shiftId: shift.id,
      branchId: shift.branchId,
      registerId: shift.registerId,
      status: shift.status,
      openedBy: shift.openedByName,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt || null,
      summary: {
        grossSales: report.salesSummary.grossSales,
        cashSales: report.posPaymentBreakdown.cashSales,
        posSales: report.posPaymentBreakdown.posTerminalCardSales,
        transferSales: report.posPaymentBreakdown.bankTransferSales,
        onlineGatewaySales: report.posPaymentBreakdown.onlineGatewaySales,
        totalDiscounts: report.salesSummary.totalDiscounts,
        totalRefunds: report.salesSummary.totalRefundsValue,
        openingFloat: report.cashDrawerReconciliation.openingFloat,
        cashDropsTotal: report.cashDrawerReconciliation.safeDropAmount,
        paidOutsTotal: report.cashDrawerReconciliation.paidOutAmount,
        expectedCashInTill: report.cashDrawerReconciliation.expectedDrawerCash,
        countedCashInTill: report.cashDrawerReconciliation.countedClosingCash,
        cashVariance: report.cashDrawerReconciliation.cashOverShortVariance,
        orderCount: report.salesSummary.totalCompletedOrders,
      },
      financials: {
        openingFloat: report.cashDrawerReconciliation.openingFloat,
        cashSales: report.posPaymentBreakdown.cashSales,
        posTerminalSales: report.posPaymentBreakdown.posTerminalCardSales,
        transferSales: report.posPaymentBreakdown.bankTransferSales,
        onlineGatewaySales: report.posPaymentBreakdown.onlineGatewaySales,
        grossRevenue:
          report.posPaymentBreakdown.totalCollectedAcrossChannels,
        totalDiscounts: report.salesSummary.totalDiscounts,
        totalRefunds: report.salesSummary.totalRefundsValue,
        safeDrops: report.cashDrawerReconciliation.safeDropAmount,
        paidOuts: report.cashDrawerReconciliation.paidOutAmount,
        expectedCashInDrawer: report.cashDrawerReconciliation.expectedDrawerCash,
        countedCashInDrawer: report.cashDrawerReconciliation.countedClosingCash,
        cashVariance: report.cashDrawerReconciliation.cashOverShortVariance,
        reconciliationStatus:
          report.discrepancies.totalDiscrepancyCount === 0
            ? report.cashDrawerReconciliation.status === 'open_shift_uncounted'
              ? 'open_active'
              : 'balanced'
            : 'variance_flagged',
      },
      counts: {
        posChecksPaid: report.salesSummary.totalCompletedOrders,
        ordersCompleted: report.salesSummary.totalCompletedOrders,
        cashMovementsLogged: report.cashMovements.length,
      },
    });
  };

  router.get('/api/admin/shifts/:id/reconciliation', requireAuth, handleGetReconciliation);
  router.get('/api/pos/shifts/:id/reconciliation', requireAuth, handleGetReconciliation);

  router.get('/api/admin/shifts/:id/reconciliation/export.csv', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const staff = (req as any).staff as DbStaffAccount;
    const { id } = req.params;

    const shift = db.shifts?.[id];
    if (!shift) {
      return res.status(404).json({ error: `Shift '${id}' not found.` });
    }

    const authCheck = authorizeShiftAccess(staff, shift.branchId);
    if (!authCheck.allowed) {
      return res.status(403).json({ error: authCheck.error });
    }

    const report = computeShiftReconciliationReport(db, id);
    if (!report) {
      return res.status(404).json({ error: 'Shift reconciliation report not found.' });
    }

    const csv = generateShiftReconciliationCsv(report);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="choplife_shift_reconciliation_${shift.id}.csv"`
    );
    return res.status(200).send(csv);
  });

  return router;
}
