import { Router } from 'express';
import type { DbDatabase, DbStaffAccount } from '../../server_db.ts';

export interface ShiftCloseSubRouterDeps {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: any;
  requireBranchAccess: any;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
}

export function createShiftCloseSubRouter(deps: ShiftCloseSubRouterDeps): Router {
  const router = Router();
  const { getDb, saveDatabaseSync, requireAuth, requireBranchAccess, logAuditEvent } = deps;

  router.post('/api/pos/shifts/:id/close', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const { countedCashInTill, notes, supervisorStaffId } = req.body;
    const shift = db.shifts[id];

    if (!shift || shift.status !== 'open') {
      res.status(404).json({ error: 'Active open shift not found.' });
      return;
    }

    const isManagerOrAdmin = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin', 'accountant'].includes(currentStaff.role);
    if (shift.openedByStaffId !== currentStaff.id && !isManagerOrAdmin) {
      res.status(403).json({
        error: `Access denied: You cannot close another cashier's shift (${shift.openedByName}). Manager override required.`,
      });
      return;
    }

    if (shift.branchId !== currentStaff.branchId && !['super_admin', 'corporate_admin', 'auditor'].includes(currentStaff.role)) {
      res.status(403).json({
        error: `Access denied: Cannot close a shift belonging to another branch (${shift.branchId}).`,
      });
      return;
    }

    const partiallyPaidChecks = Object.values(db.checks || {}).filter(
      (c: any) => !c.isHistoricalMigrated && c.branchId === shift.branchId && c.status === 'partially_paid'
    );
    if (partiallyPaidChecks.length > 0 && !req.body.allowOpenChecksCarryover) {
      res.status(409).json({
        error: `Cannot close shift while ${partiallyPaidChecks.length} partially paid check(s) remain unsettled (${partiallyPaidChecks.map((c) => c.checkNumber).join(', ')}). Complete remaining share settlements or pass supervisor carryover authorization.`,
        partiallyPaidChecks: partiallyPaidChecks.map((c) => ({
          id: c.id,
          checkNumber: c.checkNumber,
          total: c.total,
          amountPaid: c.amountPaid,
          remainingBalance: c.remainingBalance,
        })),
      });
      return;
    }

    const counted = Number(countedCashInTill) || 0;
    const variance = counted - shift.expectedCashInTill;
    const now = new Date().toISOString();

    shift.status = 'closed';
    shift.closedAt = now;
    shift.closedByStaffId = currentStaff.id;
    shift.closedByName = currentStaff.name;
    shift.countedCashInTill = counted;
    shift.cashVariance = variance;
    shift.notes = notes;
    if (supervisorStaffId) {
      shift.approvedByStaffId = supervisorStaffId;
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'SHIFT_CLOSED',
      `Closed ${shift.shiftNumber}. Counted: ₦${counted}, Expected: ₦${shift.expectedCashInTill}, Variance: ₦${variance}`
    );

    res.json({ success: true, shift });
  });

  router.get('/api/pos/shifts', requireAuth, requireBranchAccess, (req, res) => {
    const db = getDb();
    const { branchId } = req.query;
    let list = Object.values(db.shifts);

    if (branchId && branchId !== 'all') {
      list = list.filter((s) => s.branchId === branchId);
    }

    res.json(list.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()));
  });

  return router;
}
