import express from 'express';
import type { DbStaffAccount } from '../../server_db.ts';
import {
  CANONICAL_PRIVILEGE_CATEGORIES,
  CANONICAL_REPORTS,
  CANONICAL_ORDER_SUMMARY_COLUMNS,
} from '../../src/data/rbacCatalogue.ts';
import type { StaffAndRbacRouterDeps } from './staffAndRbacRouter.ts';

export async function handleRbacEffectiveAccess(
  req: express.Request,
  res: express.Response,
  deps: StaffAndRbacRouterDeps
): Promise<void> {
  const { staffRepository, rbacRepository, getStaffPrivileges } = deps;
  const currentStaff = (req as any).staff as DbStaffAccount;
  const { id } = req.params;

  let staff: any = null;
  if (staffRepository) {
    staff = await staffRepository.getById(id);
    if (!staff) staff = await staffRepository.getByStaffId(id);
  }

  if (!staff) {
    res.status(404).json({ error: 'Staff account not found.' });
    return;
  }

  const isSelf = staff.id === currentStaff.id || (staff.staffId || '').toLowerCase() === (currentStaff.staffId || '').toLowerCase();
  const isAdminOrManager = ['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'auditor'].includes(
    currentStaff.role
  );

  if (!isSelf && !isAdminOrManager) {
    res.status(403).json({ error: 'Forbidden: Insufficient privileges to view other staff access profiles.' });
    return;
  }

  if (!isSelf && currentStaff.role === 'branch_manager') {
    const mgrBranch = currentStaff.branchId;
    const allowed = staff.allowedBranchIds || [staff.branchId];
    if (staff.branchId !== mgrBranch && !allowed.includes(mgrBranch)) {
      res.status(403).json({ error: 'Access denied: Staff member belongs to another branch.' });
      return;
    }
  }

  const privileges = await getStaffPrivileges(staff);
  const isSuper = staff.role === 'super_admin' || staff.role === 'admin';

  let roleObj: any = null;
  if (rbacRepository) {
    roleObj = await rbacRepository.getRoleByCode(staff.role);
    if (!roleObj) roleObj = await rbacRepository.getRoleById(staff.role);
  }

  const roleName = roleObj?.name || staff.role.replace('_', ' ').toUpperCase();
  const permittedReports = isSuper
    ? CANONICAL_REPORTS.map((r) => r.code)
    : roleObj?.reports || ['sales_summary'];
  const permittedColumns = isSuper
    ? CANONICAL_ORDER_SUMMARY_COLUMNS.map((c) => c.code)
    : roleObj?.orderSummaryColumns || ['subtotal', 'net_total'];

  const categories = CANONICAL_PRIVILEGE_CATEGORIES.map((cat) => {
    const privs = cat.privileges.map((p) => ({
      code: p.code,
      name: p.name,
      granted:
        isSuper ||
        privileges.includes('*') ||
        privileges.includes(p.code) ||
        privileges.includes(`${p.code.split('.')[0]}.*`),
    }));
    return {
      categoryKey: cat.key,
      categoryLabel: cat.label,
      totalAvailable: cat.privileges.length,
      grantedCount: privs.filter((p) => p.granted).length,
      privileges: privs,
    };
  });

  res.json({
    staffId: staff.staffId,
    name: staff.name,
    workEmail: staff.workEmail,
    roleId: staff.role,
    roleName,
    branchScope: staff.branchId,
    status: staff.status,
    mustChangePassword: staff.mustChangePassword,
    failedLoginAttempts: staff.failedLoginAttempts || 0,
    lockoutUntil: staff.lockoutUntil,
    lastLoginAt: staff.lastLoginAt,
    lastLoginIp: staff.lastLoginIp,
    effectivePrivileges: privileges,
    permittedReports,
    permittedColumns,
    categories,
  });
}
