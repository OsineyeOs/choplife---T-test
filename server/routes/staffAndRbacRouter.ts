import express from 'express';
import type { DbDatabase, DbStaffAccount } from '../../server_db.ts';
import { createBranchesAndRbacRouter } from './branchesAndRbacRouter.ts';

export interface StaffAndRbacRouterDeps {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: express.RequestHandler;
  requireRole: (roles: string[]) => express.RequestHandler;
  requirePermission: (permissionCode: string) => express.RequestHandler;
  logAuditEvent: (
    staffName: string,
    role: string,
    branchId: string,
    eventType: string,
    description: string,
    metadata?: Record<string, any>,
    staffId?: string
  ) => void;
  hashPasswordBcrypt: (plainText: string) => string;
  verifyStaffPassword: (plainText: string, staff: DbStaffAccount) => { valid: boolean; needsUpgrade?: boolean };
  validateStaffPasswordPolicy: (password: string) => { valid: boolean; error?: string };
  getStaffPrivileges: (staff: DbStaffAccount) => Promise<string[]>;
  staffRepository?: any;
  sessionRepository?: any;
  rbacRepository?: any;
  branchRepository?: any;
}

export function createStaffAndRbacRouter(deps: StaffAndRbacRouterDeps): express.Router {
  const router = express.Router();
  const {
    requireAuth,
    requireRole,
    logAuditEvent,
    hashPasswordBcrypt,
    getStaffPrivileges,
    staffRepository,
    sessionRepository,
  } = deps;

  // ==========================================
  // 3. STAFF ACCOUNT MANAGEMENT (PostgreSQL)
  // ==========================================
  const handleGetStaffAccounts: express.RequestHandler = async (req, res) => {
    try {
      const currentStaff = (req as any).staff as DbStaffAccount;
      const isBranchScopedRole = ['branch_manager', 'store_manager', 'kitchen_lead', 'dispatch_manager'].includes(
        currentStaff.role
      );
      const isAuditor = currentStaff.role === 'auditor';

      let list = staffRepository ? await staffRepository.getAll() : [];

      if (isBranchScopedRole && currentStaff.branchId && (currentStaff.branchId as string) !== 'all') {
        const mgrBranch = currentStaff.branchId;
        list = list.filter((s: any) => {
          const allowed = s.allowedBranchIds || [s.branchId];
          return s.branchId === mgrBranch || allowed.includes(mgrBranch);
        });
      }

      const privileges = await getStaffPrivileges(currentStaff);
      const canAccessCompensation =
        ['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(currentStaff.role) ||
        privileges.includes('payroll.view_confidential') ||
        privileges.includes('payroll.prepare');

      const mapped = list.map((s: any) => {
        if (isAuditor) {
          return {
            id: s.id,
            staffId: s.staffId,
            name: s.name,
            workEmail: s.workEmail ? `${s.workEmail.split('@')[0].slice(0, 2)}***@chopliferepublic.com` : undefined,
            phone: '[REDACTED_FOR_AUDITOR]',
            role: s.role,
            branchId: s.branchId,
            allowedBranchIds: s.allowedBranchIds || [s.branchId],
            dateOfBirth: s.dob || s.dateOfBirth,
            guarantorName: s.guarantorName,
            guarantorPhone: '[REDACTED_FOR_AUDITOR]',
            guarantorRelationship: s.guarantorRelationship,
            status: s.status,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          };
        }

        return {
          id: s.id,
          staffId: s.staffId,
          name: s.name,
          workEmail: s.workEmail,
          phone: s.phone,
          role: s.role,
          branchId: s.branchId,
          allowedBranchIds: s.allowedBranchIds || [s.branchId],
          dateOfBirth: s.dob || s.dateOfBirth,
          guarantorName: s.guarantorName,
          guarantorPhone: s.guarantorPhone,
          guarantorRelationship: s.guarantorRelationship,
          guarantorAddress: s.guarantorAddress,
          guarantorWorkplace: s.guarantorWorkplace,
          status: s.status,
          payrollProfile: canAccessCompensation ? s.payrollProfile || null : undefined,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      });

      res.json(mapped);
    } catch (err: any) {
      console.error('[Staff Listing Error]', err);
      res.status(500).json({ error: 'Failed to retrieve staff accounts.' });
    }
  };

  router.get(
    '/api/staff/accounts',
    requireAuth,
    requireRole([
      'super_admin',
      'corporate_admin',
      'admin',
      'accountant',
      'branch_manager',
      'auditor',
      'store_manager',
      'kitchen_lead',
      'dispatch_manager',
    ]),
    handleGetStaffAccounts
  );

  router.get(
    '/api/staff',
    requireAuth,
    requireRole([
      'super_admin',
      'corporate_admin',
      'admin',
      'accountant',
      'branch_manager',
      'auditor',
      'store_manager',
      'kitchen_lead',
      'dispatch_manager',
    ]),
    handleGetStaffAccounts
  );

  router.get(
    '/api/staff/accounts/:id',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'auditor']),
    async (req, res) => {
      try {
        const currentStaff = (req as any).staff as DbStaffAccount;
        const { id } = req.params;
        const canAccessCompensation = ['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(currentStaff.role);

        let s = staffRepository ? await staffRepository.getById(id) : null;
        if (!s && staffRepository) {
          s = await staffRepository.getByStaffId(id);
        }

        if (!s) return res.status(404).json({ error: 'Staff account not found.' });

        if (currentStaff.role === 'branch_manager') {
          const mgrBranch = currentStaff.branchId;
          const allowed = s.allowedBranchIds || [s.branchId];
          if (s.branchId !== mgrBranch && !allowed.includes(mgrBranch)) {
            return res.status(403).json({ error: 'Access denied: Staff account belongs to another branch.' });
          }
        }

        if (currentStaff.role === 'auditor') {
          return res.json({
            id: s.id,
            staffId: s.staffId,
            name: s.name,
            workEmail: s.workEmail ? `${s.workEmail.split('@')[0].slice(0, 2)}***@chopliferepublic.com` : undefined,
            phone: '[REDACTED_FOR_AUDITOR]',
            role: s.role,
            branchId: s.branchId,
            allowedBranchIds: s.allowedBranchIds || [s.branchId],
            dateOfBirth: s.dob || s.dateOfBirth,
            guarantorName: s.guarantorName,
            guarantorPhone: '[REDACTED_FOR_AUDITOR]',
            guarantorRelationship: s.guarantorRelationship,
            status: s.status,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          });
        }

        res.json({
          id: s.id,
          staffId: s.staffId,
          name: s.name,
          workEmail: s.workEmail,
          phone: s.phone,
          role: s.role,
          branchId: s.branchId,
          allowedBranchIds: s.allowedBranchIds || [s.branchId],
          customPrivileges: s.customPrivileges,
          dateOfBirth: s.dob || s.dateOfBirth,
          guarantorName: s.guarantorName,
          guarantorPhone: s.guarantorPhone,
          guarantorRelationship: s.guarantorRelationship,
          guarantorAddress: s.guarantorAddress,
          guarantorWorkplace: s.guarantorWorkplace,
          status: s.status,
          payrollProfile: canAccessCompensation ? (s.payrollProfile || null) : undefined,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        });
      } catch (err: any) {
        console.error('[Staff Fetch Error]', err);
        res.status(500).json({ error: 'Failed to retrieve staff account details.' });
      }
    }
  );

  router.post(
    ['/api/staff/accounts', '/api/admin/staff', '/api/staff'],
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin']),
    async (req, res) => {
      try {
        const { staffId, name, workEmail, phone, role, branchId, allowedBranchIds, customPrivileges, initialPassword, payrollProfile } = req.body;
        const currentStaff = (req as any).staff as DbStaffAccount;

        if (!staffId || !name || !workEmail || !role || !branchId || !initialPassword) {
          return res.status(400).json({ error: 'Missing required staff fields.' });
        }

        // Anti-escalation guard
        if (role === 'super_admin' && currentStaff.role !== 'super_admin') {
          await logAuditEvent(
            currentStaff.name,
            currentStaff.role,
            currentStaff.branchId,
            'PRIVILEGE_ESCALATION_BLOCKED',
            `Blocked attempt to create Super Administrator account (${staffId})`,
            undefined,
            currentStaff.id
          );
          return res.status(403).json({
            error: 'Privilege escalation blocked: Only a Super Administrator can create a Super Administrator account.',
          });
        }
        if (role === 'corporate_admin' && !['super_admin', 'corporate_admin'].includes(currentStaff.role)) {
          return res.status(403).json({
            error: 'Privilege escalation blocked: Only a Super Admin or Corporate Admin can assign Corporate Admin.',
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(workEmail).trim())) {
          return res.status(400).json({ error: 'Invalid work email format.' });
        }

        if (staffRepository) {
          const existingEmail = await staffRepository.getByWorkEmail(workEmail.trim().toLowerCase());
          if (existingEmail) {
            return res.status(400).json({ error: 'Work email already in use.' });
          }
          const existingStaffId = await staffRepository.getByStaffId(staffId.trim().toUpperCase());
          if (existingStaffId) {
            return res.status(400).json({ error: 'Staff ID already in use.' });
          }
        }

        const effectiveAllowedBranches =
          Array.isArray(allowedBranchIds) && allowedBranchIds.length > 0
            ? Array.from(new Set([branchId, ...allowedBranchIds]))
            : [branchId];

        const hash = hashPasswordBcrypt(initialPassword);
        const newId = `staff-${Date.now()}`;
        const newStaffData = {
          id: newId,
          staffId: staffId.trim().toUpperCase(),
          name: name.trim(),
          workEmail: workEmail.trim().toLowerCase(),
          phone: phone || '',
          role,
          branchId,
          allowedBranchIds: effectiveAllowedBranches,
          customPrivileges: Array.isArray(customPrivileges) ? customPrivileges : null,
          passwordHash: hash,
          status: 'active',
          mustChangePassword: true,
          dob: req.body.dateOfBirth?.trim() ? new Date(req.body.dateOfBirth.trim()) : null,
          guarantorName: req.body.guarantorName?.trim() || null,
          guarantorPhone: req.body.guarantorPhone?.trim() || null,
          guarantorRelationship: req.body.guarantorRelationship?.trim() || null,
          guarantorAddress: req.body.guarantorAddress?.trim() || null,
          guarantorWorkplace: req.body.guarantorWorkplace?.trim() || null,
          payrollProfile: payrollProfile && Number(payrollProfile.basicSalary) > 0
            ? {
                basicSalary: Number(payrollProfile.basicSalary) || 0,
                housingAllowance: Number(payrollProfile.housingAllowance) || 0,
                transportAllowance: Number(payrollProfile.transportAllowance) || 0,
                otherAllowances: Number(payrollProfile.otherAllowances) || 0,
                bankName: String(payrollProfile.bankName || '').trim(),
                accountNumber: String(payrollProfile.accountNumber || '').trim(),
                accountName: String(payrollProfile.accountName || name).trim(),
                status: payrollProfile.status || 'active',
                effectiveDate: payrollProfile.effectiveDate || new Date().toISOString().slice(0, 10),
              }
            : null,
        };

        let created: any = newStaffData;
        if (staffRepository) {
          const [inserted] = await staffRepository.create(newStaffData);
          if (inserted) created = inserted;
        }

        await logAuditEvent(
          currentStaff.name,
          currentStaff.role,
          currentStaff.branchId,
          'STAFF_CREATED',
          `Created staff account: ${created.name} (${created.staffId}, Role: ${created.role}, Branches: [${effectiveAllowedBranches.join(', ')}])`,
          undefined,
          created.id
        );

        res.status(201).json({
          success: true,
          staff: {
            id: created.id,
            staffId: created.staffId,
            name: created.name,
            workEmail: created.workEmail,
            phone: created.phone,
            role: created.role,
            branchId: created.branchId,
            allowedBranchIds: created.allowedBranchIds,
            customPrivileges: created.customPrivileges,
            privileges: await getStaffPrivileges(created),
            status: created.status,
            dateOfBirth: created.dob || created.dateOfBirth,
            guarantorName: created.guarantorName,
            guarantorPhone: created.guarantorPhone,
          },
        });
      } catch (err: any) {
        console.error('[Staff Creation Error]', err);
        res.status(500).json({ error: 'Failed to create staff account.' });
      }
    }
  );

  router.put(
    ['/api/staff/accounts/:id', '/api/staff/:id'],
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const currentStaff = (req as any).staff as DbStaffAccount;

        let staffObj = staffRepository ? await staffRepository.getById(id) : null;
        if (!staffObj) return res.status(404).json({ error: 'Staff account not found.' });

        if (staffObj.role === 'super_admin' && currentStaff.role !== 'super_admin') {
          await logAuditEvent(
            currentStaff.name,
            currentStaff.role,
            currentStaff.branchId,
            'PRIVILEGE_ESCALATION_BLOCKED',
            `Blocked non-Super-Admin attempt to modify Super Administrator account ${staffObj.name} (${staffObj.staffId})`,
            undefined,
            currentStaff.id
          );
          return res.status(403).json({
            error: 'Privilege escalation blocked: Only a Super Administrator can modify a Super Administrator account.',
          });
        }

        const {
          name,
          phone,
          role,
          branchId,
          allowedBranchIds,
          customPrivileges,
          status,
          dateOfBirth,
          guarantorName,
          guarantorPhone,
          guarantorRelationship,
          guarantorAddress,
          guarantorWorkplace,
          payrollProfile,
        } = req.body;

        const roleChanged = Boolean(role && role !== staffObj.role);
        const suspendedNow = status === 'suspended' || status === 'inactive';

        if (role && role !== staffObj.role) {
          if (role === 'super_admin' && currentStaff.role !== 'super_admin') {
            await logAuditEvent(
              currentStaff.name,
              currentStaff.role,
              currentStaff.branchId,
              'PRIVILEGE_ESCALATION_BLOCKED',
              `Blocked attempt to promote ${staffObj.name} (${staffObj.staffId}) to Super Administrator`,
              undefined,
              currentStaff.id
            );
            return res.status(403).json({
              error: 'Privilege escalation blocked: Only a Super Administrator can promote an account to Super Administrator.',
            });
          }
        }

        const updateFields: any = {};
        if (name) updateFields.name = name.trim();
        if (phone !== undefined) updateFields.phone = phone.trim();
        if (role) updateFields.role = role;
        if (branchId) {
          updateFields.branchId = branchId;
          updateFields.allowedBranchIds = Array.from(new Set([branchId, ...(staffObj.allowedBranchIds || [])]));
        }
        if (Array.isArray(allowedBranchIds) && allowedBranchIds.length > 0) {
          updateFields.allowedBranchIds = Array.from(new Set([staffObj.branchId, ...allowedBranchIds]));
        }
        if (Array.isArray(customPrivileges)) {
          updateFields.customPrivileges = customPrivileges;
        }
        if (status) updateFields.status = status;
        if (dateOfBirth !== undefined) updateFields.dob = dateOfBirth ? new Date(dateOfBirth) : null;
        if (guarantorName !== undefined) updateFields.guarantorName = guarantorName ? guarantorName.trim() : null;
        if (guarantorPhone !== undefined) updateFields.guarantorPhone = guarantorPhone ? guarantorPhone.trim() : null;
        if (guarantorRelationship !== undefined) updateFields.guarantorRelationship = guarantorRelationship ? guarantorRelationship.trim() : null;
        if (guarantorAddress !== undefined) updateFields.guarantorAddress = guarantorAddress ? guarantorAddress.trim() : null;
        if (guarantorWorkplace !== undefined) updateFields.guarantorWorkplace = guarantorWorkplace ? guarantorWorkplace.trim() : null;
        if (payrollProfile !== undefined) updateFields.payrollProfile = payrollProfile;

        let updated: any = staffObj;
        if (staffRepository) {
          const [resStaff] = await staffRepository.update(id, updateFields);
          if (resStaff) updated = resStaff;
        }

        // Revoke sessions on suspension or role change
        if ((suspendedNow || roleChanged) && sessionRepository) {
          await sessionRepository.deleteByStaffId(id);
        }

        await logAuditEvent(
          currentStaff.name,
          currentStaff.role,
          currentStaff.branchId,
          'STAFF_MODIFIED',
          `Updated staff ${updated.name} (${updated.staffId})`,
          undefined,
          updated.id
        );

        const { passwordHash: _ph, salt: _s, ...safeStaff } = updated;
        res.json({
          success: true,
          message: 'Staff account updated successfully.',
          staff: { ...safeStaff, privileges: await getStaffPrivileges(updated) },
        });
      } catch (err: any) {
        console.error('[Staff Update Error]', err);
        res.status(500).json({ error: 'Failed to update staff account.' });
      }
    }
  );

  router.delete(
    ['/api/staff/accounts/:id', '/api/staff/:id'],
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const currentStaff = (req as any).staff as DbStaffAccount;

        let staffObj = staffRepository ? await staffRepository.getById(id) : null;
        if (!staffObj) return res.status(404).json({ error: 'Staff account not found.' });

        if (staffObj.id === 'staff-admin-001' || staffObj.id === currentStaff.id) {
          return res.status(400).json({ error: 'Cannot delete primary Super Administrator or active self account.' });
        }

        if (staffRepository) {
          await staffRepository.delete(id);
        }
        if (sessionRepository) {
          await sessionRepository.deleteByStaffId(id);
        }

        await logAuditEvent(
          currentStaff.name,
          currentStaff.role,
          currentStaff.branchId,
          'STAFF_DELETED',
          `Deleted staff account ${staffObj.name} (${staffObj.staffId})`,
          undefined,
          staffObj.id
        );
        res.json({ success: true, message: 'Staff account deleted.' });
      } catch (err: any) {
        console.error('[Staff Delete Error]', err);
        res.status(500).json({ error: 'Failed to delete staff account.' });
      }
    }
  );

  router.get('/api/staff/birthdays/upcoming', requireAuth, async (req, res) => {
    try {
      const daysAhead = Math.max(1, Math.min(365, Number(req.query.days) || 30));
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentDay = today.getDate();

      const allStaff = staffRepository ? await staffRepository.getAll() : [];
      const upcoming: any[] = [];

      for (const s of allStaff) {
        const dobVal = s.dob || s.dateOfBirth;
        if (!dobVal || s.status !== 'active') continue;

        let birthDateObj: Date | null = null;
        if (dobVal instanceof Date) {
          birthDateObj = dobVal;
        } else if (typeof dobVal === 'string') {
          birthDateObj = new Date(dobVal);
        }

        if (!birthDateObj || isNaN(birthDateObj.getTime())) continue;

        const birthYear = birthDateObj.getFullYear();
        const birthMonth = birthDateObj.getMonth();
        const birthDay = birthDateObj.getDate();

        let nextBday = new Date(today.getFullYear(), birthMonth, birthDay);
        if (nextBday.getTime() < new Date(today.getFullYear(), currentMonth, currentDay).getTime()) {
          nextBday = new Date(today.getFullYear() + 1, birthMonth, birthDay);
        }

        const diffMs = nextBday.getTime() - new Date(today.getFullYear(), currentMonth, currentDay).getTime();
        const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (daysUntil <= daysAhead) {
          const turningAge = nextBday.getFullYear() - birthYear;
          const firstName = s.name ? s.name.split(' ')[0] : 'Colleague';
          upcoming.push({
            staffId: s.staffId,
            id: s.id,
            name: s.name,
            firstName,
            role: s.role,
            branchId: s.branchId,
            phone: s.phone,
            dateOfBirth: birthDateObj.toISOString().split('T')[0],
            birthdayThisYear: nextBday.toISOString().split('T')[0],
            daysUntil,
            turningAge,
            isToday: daysUntil === 0,
            personalGreeting: `Happy Birthday, ${firstName}! 🎉 Wishing you a wonderful year filled with happiness, good health and success. Enjoy your special day!`,
            colleagueNotification: `Today is ${firstName}'s birthday! 🎂 Join us in wishing them a happy birthday and a wonderful year ahead.`,
          });
        }
      }

      upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
      res.json({ success: true, count: upcoming.length, upcoming });
    } catch (err: any) {
      console.error('[Birthdays Fetch Error]', err);
      res.status(500).json({ error: 'Failed to fetch upcoming staff birthdays.' });
    }
  });

  router.use(createBranchesAndRbacRouter(deps));

  return router;
}
