import { db } from '../db/db';
import { staff } from '../db/schema/staff';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { staffRepository } from '../repositories/staffRepository';
import { rbacRepository } from '../repositories/rbacRepository';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '../middleware/authAndRbac';

let activeStaffRepository = staffRepository;

export const supervisorAuthService = {
  /**
   * For testing/verification environments where the real PG repo is unavailable.
   */
  injectStaffRepository(repo: any) {
    activeStaffRepository = repo;
  },

  async verifySupervisorPin(
    initiatorStaff: any,
    branchId: string,
    pin: string,
    requiredPermission: string,
    logAuditEvent: any
  ) {
    const rateLimitKey = `supervisor_pin_${initiatorStaff.id}`;
    const rateCheck = checkRateLimit(rateLimitKey);
    if (rateCheck.isLocked) {
      logAuditEvent(initiatorStaff.name, initiatorStaff.role, branchId, 'SECURITY_ALERT', `Throttled supervisor PIN attempt by ${initiatorStaff.name}`);
      throw new Error(`Too many PIN attempts. Please try again in ${rateCheck.remainingSeconds} seconds.`);
    }

    // Identify active staff with PINs via repository
    const supervisors = await activeStaffRepository.getActiveSupervisors();

    for (const s of supervisors) {
      // 1. Branch authorization check
      const authorizedBranches = Array.from(new Set([s.branchId, ...(Array.isArray(s.allowedBranchIds) ? (s.allowedBranchIds as string[]) : [])]));
      const isBranchAuthorized = s.role === 'super_admin' || s.role === 'corporate_admin' || authorizedBranches.includes(branchId);
      if (!isBranchAuthorized) continue;

      // 2. Async PIN check - guard against undefined/empty PIN
      if (!pin) continue;
      const isPinValid = await bcrypt.compare(pin, s.pinHash!);
      if (!isPinValid) continue;

      // 3. PostgreSQL Permission check
      const roleObj = (await rbacRepository.getRoleByCode(s.role)) || (await rbacRepository.getRoleById(s.role));
      if (!roleObj) continue;

      const rolePermissionsList = await rbacRepository.getPermissionsForRole(roleObj.id);
      const privileges = rolePermissionsList.map((rp: any) => rp.code);
      
      const hasPriv = privileges.includes(requiredPermission) || privileges.includes('*') || privileges.includes(`${requiredPermission.split('.')[0]}.*`);
      
      if (!hasPriv && s.role !== 'super_admin' && s.role !== 'admin') continue;

      clearRateLimit(rateLimitKey);
      return s;
    }

    recordFailedAttempt(rateLimitKey);
    logAuditEvent(initiatorStaff.name, initiatorStaff.role, branchId, 'SECURITY_ALERT', `Invalid supervisor PIN attempt by ${initiatorStaff.name}`);
    return null;
  },
  
  async setPin(staffId: string, pin: string) {
    const hash = await bcrypt.hash(pin, 10);
    await db.update(staff).set({ pinHash: hash }).where(eq(staff.id, staffId));
  }
};
