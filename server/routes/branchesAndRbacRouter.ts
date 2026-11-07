import express from 'express';
import type { DbStaffAccount } from '../../server_db.ts';
import {
  CANONICAL_PRIVILEGE_CATEGORIES,
  CANONICAL_REPORTS,
  CANONICAL_ORDER_SUMMARY_COLUMNS,
} from '../../src/data/rbacCatalogue.ts';
import type { StaffAndRbacRouterDeps } from './staffAndRbacRouter.ts';
import { handleRbacEffectiveAccess } from './rbacEffectiveAccessHelper.ts';

export function createBranchesAndRbacRouter(deps: StaffAndRbacRouterDeps): express.Router {
  const router = express.Router();
  const {
    requireAuth,
    requireRole,
    requirePermission,
    logAuditEvent,
    branchRepository,
    rbacRepository,
    staffRepository,
  } = deps;

  // ==========================================
  // DYNAMIC BRANCH ADMINISTRATION (PostgreSQL)
  // ==========================================
  router.get('/api/branches', async (_req, res) => {
    try {
      const list = branchRepository ? await branchRepository.getAll() : [];
      res.json(list);
    } catch (err: any) {
      console.error('[Branches Fetch Error]', err);
      res.status(500).json({ error: 'Failed to retrieve branches.' });
    }
  });

  router.get('/api/branches/:id', async (req, res) => {
    try {
      const branch = branchRepository ? await branchRepository.getById(req.params.id) : null;
      if (!branch) return res.status(404).json({ error: 'Branch not found.' });
      res.json(branch);
    } catch (err: any) {
      console.error('[Branch Fetch Error]', err);
      res.status(500).json({ error: 'Failed to retrieve branch.' });
    }
  });

  router.post('/api/branches', requireAuth, requireRole(['super_admin', 'corporate_admin', 'admin']), async (req, res) => {
    try {
      const { name, address, phone } = req.body;
      const currentStaff = (req as any).staff as DbStaffAccount;

      if (!name || !address || !phone) {
        return res.status(400).json({ error: 'Missing required branch fields: name, address, phone.' });
      }

      const id = (req.body.id || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')).trim();
      if (branchRepository) {
        const existing = await branchRepository.getById(id);
        if (existing) {
          return res.status(400).json({ error: `A branch with id '${id}' already exists.` });
        }
      }

      const newBranchData = {
        id,
        name: name.trim(),
        address: address.trim(),
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      };

      let created: any = newBranchData;
      if (branchRepository) {
        const [inserted] = await branchRepository.create(newBranchData);
        if (inserted) created = inserted;
      }

      await logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'BRANCH_CREATED',
        `Created new branch: ${created.name} (${created.id})`,
        undefined,
        currentStaff.id
      );

      res.status(201).json({ success: true, branch: created });
    } catch (err: any) {
      console.error('[Branch Creation Error]', err);
      res.status(500).json({ error: 'Failed to create branch.' });
    }
  });

  router.put('/api/branches/:id', requireAuth, requireRole(['super_admin', 'corporate_admin', 'admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;

      const branch = branchRepository ? await branchRepository.getById(id) : null;
      if (!branch) return res.status(404).json({ error: 'Branch not found.' });

      const { name, address, isActive } = req.body;
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (address) updateData.address = address.trim();
      if (isActive !== undefined) updateData.isActive = isActive;

      let updated: any = branch;
      if (branchRepository) {
        const [resBranch] = await branchRepository.update(id, updateData);
        if (resBranch) updated = resBranch;
      }

      await logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'BRANCH_MODIFIED',
        `Updated branch details for ${updated.name} (${updated.id})`,
        undefined,
        currentStaff.id
      );

      res.json({ success: true, branch: updated });
    } catch (err: any) {
      console.error('[Branch Update Error]', err);
      res.status(500).json({ error: 'Failed to update branch.' });
    }
  });

  // ==========================================
  // DYNAMIC RBAC CATALOGUES & ROLES (PostgreSQL)
  // ==========================================
  router.get('/api/rbac/permissions-catalogue', (_req, res) => {
    res.json({
      categories: CANONICAL_PRIVILEGE_CATEGORIES,
      reports: CANONICAL_REPORTS,
      orderSummaryColumns: CANONICAL_ORDER_SUMMARY_COLUMNS,
    });
  });

  router.get('/api/rbac/privilege-categories', (_req, res) => {
    res.json(CANONICAL_PRIVILEGE_CATEGORIES);
  });

  router.get('/api/rbac/reports-catalogue', (_req, res) => {
    res.json(CANONICAL_REPORTS);
  });

  router.get('/api/rbac/summary-columns-catalogue', (_req, res) => {
    res.json(CANONICAL_ORDER_SUMMARY_COLUMNS);
  });

  router.get(
    '/api/rbac/roles',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'auditor']),
    async (_req, res) => {
      try {
        const rolesList = rbacRepository ? await rbacRepository.getAllRoles() : [];
        const staffAccounts = staffRepository ? await staffRepository.getAll() : [];

        const mappedRoles = rolesList.map((r: any) => {
          const userCount = staffAccounts.filter(
            (s: any) => s.role === r.code || s.role === r.id || `role-${s.role}` === r.id
          ).length;
          return {
            ...r,
            userCount,
          };
        });

        res.json(mappedRoles);
      } catch (err: any) {
        console.error('[Roles Fetch Error]', err);
        res.status(500).json({ error: 'Failed to retrieve roles.' });
      }
    }
  );

  router.get(
    '/api/rbac/roles/:id',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'auditor']),
    async (req, res) => {
      try {
        const { id } = req.params;
        let role = rbacRepository ? await rbacRepository.getRoleById(id) : null;
        if (!role && rbacRepository) {
          role = await rbacRepository.getRoleByCode(id);
        }
        if (!role) return res.status(404).json({ error: 'Role not found.' });
        res.json(role);
      } catch (err: any) {
        console.error('[Role Fetch Error]', err);
        res.status(500).json({ error: 'Failed to retrieve role.' });
      }
    }
  );

  router.post('/api/rbac/roles', requireAuth, requirePermission('roles.manage'), async (req, res) => {
    try {
      const currentStaff = (req as any).staff as DbStaffAccount;
      const { name, code, description, privileges = [], reports = [], orderSummaryColumns = [] } = req.body;

      if (!name || !code) {
        return res.status(400).json({ error: 'Role name and unique code are required.' });
      }

      // Anti-escalation guard
      if (currentStaff.role !== 'super_admin') {
        const callerPrivs = new Set(await deps.getStaffPrivileges(currentStaff));
        const escalated = Array.isArray(privileges)
          ? privileges.filter((p: string) => !callerPrivs.has(p))
          : [];
        if (escalated.length > 0) {
          await logAuditEvent(
            currentStaff.name,
            currentStaff.role,
            currentStaff.branchId,
            'PRIVILEGE_ESCALATION_BLOCKED',
            `Blocked attempt to create role '${name}' with unheld privileges: [${escalated.join(', ')}]`,
            undefined,
            currentStaff.id
          );
          return res.status(403).json({
            error: `Privilege escalation blocked: You cannot grant permissions you do not possess (${escalated.join(', ')}).`,
            code: 'PRIVILEGE_ESCALATION_BLOCKED',
          });
        }
      }

      const cleanCode = code.trim().toLowerCase().replace(/\s+/g, '_');
      const roleId = `role-${cleanCode}`;

      if (rbacRepository) {
        const existingByCode = await rbacRepository.getRoleByCode(cleanCode);
        const existingById = await rbacRepository.getRoleById(roleId);
        if (existingByCode || existingById) {
          return res.status(400).json({ error: `A role with code '${cleanCode}' already exists.` });
        }
      }

      const newRoleData = {
        id: roleId,
        code: cleanCode,
        name: name.trim(),
        description: description?.trim() || null,
        isSystem: false,
        privileges,
        reports,
        orderSummaryColumns,
      };

      let createdRole: any = newRoleData;
      if (rbacRepository) {
        const [inserted] = await rbacRepository.createRole(newRoleData);
        if (inserted) createdRole = inserted;
      }

      await logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'ROLE_CREATED',
        `Created role '${createdRole.name}' (${createdRole.code}) with ${privileges.length} privileges`,
        undefined,
        currentStaff.id
      );

      // Part 1: Synchronize PostgreSQL Permissions Table
      if (rbacRepository && Array.isArray(privileges)) {
        await rbacRepository.syncRolePermissions(createdRole.id, privileges);
      }

      res.status(201).json({ success: true, role: createdRole });
    } catch (err: any) {
      console.error('[Role Creation Error]', err);
      res.status(500).json({ error: 'Failed to create role.' });
    }
  });

  router.put('/api/rbac/roles/:id', requireAuth, requirePermission('roles.manage'), async (req, res) => {
    try {
      const currentStaff = (req as any).staff as DbStaffAccount;
      const { id } = req.params;

      let role = rbacRepository ? await rbacRepository.getRoleById(id) : null;
      if (!role && rbacRepository) {
        role = await rbacRepository.getRoleByCode(id);
      }

      if (!role) {
        return res.status(404).json({ error: 'Role not found.' });
      }

      if (currentStaff.role !== 'super_admin') {
        if (role.isSystem || role.code === 'super_admin' || role.code === 'admin') {
          await logAuditEvent(
            currentStaff.name,
            currentStaff.role,
            currentStaff.branchId,
            'PRIVILEGE_ESCALATION_BLOCKED',
            `Blocked non-Super-Admin attempt to modify system role '${role.name}' (${role.code})`,
            undefined,
            currentStaff.id
          );
          return res.status(403).json({
            error: 'Privilege escalation blocked: Only a Super Administrator can modify protected system roles.',
            code: 'SYSTEM_ROLE_PROTECTED',
          });
        }

        if (Array.isArray(req.body.privileges)) {
          const callerPrivs = new Set(await deps.getStaffPrivileges(currentStaff));
          const escalated = req.body.privileges.filter((p: string) => !callerPrivs.has(p));
          if (escalated.length > 0) {
            await logAuditEvent(
              currentStaff.name,
              currentStaff.role,
              currentStaff.branchId,
              'PRIVILEGE_ESCALATION_BLOCKED',
              `Blocked attempt to grant unheld privileges [${escalated.join(', ')}] to role '${role.name}'`,
              undefined,
              currentStaff.id
            );
            return res.status(403).json({
              error: `Privilege escalation blocked: You cannot grant permissions you do not possess (${escalated.join(', ')}).`,
              code: 'PRIVILEGE_ESCALATION_BLOCKED',
            });
          }
        }
      }

      const { name, description, privileges, reports, orderSummaryColumns } = req.body;
      const updateFields: any = {};
      if (name && !role.isSystem) updateFields.name = name.trim();
      if (description !== undefined) updateFields.description = description ? description.trim() : null;
      if (Array.isArray(privileges)) updateFields.privileges = privileges;
      if (Array.isArray(reports)) updateFields.reports = reports;
      if (Array.isArray(orderSummaryColumns)) updateFields.orderSummaryColumns = orderSummaryColumns;

      let updatedRole: any = role;
      if (rbacRepository) {
        const [resRole] = await rbacRepository.updateRole(role.id, updateFields);
        if (resRole) updatedRole = resRole;
      }

      await logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'ROLE_PERMISSIONS_UPDATED',
        `Updated permissions for role '${updatedRole.name}': ${(updatedRole.privileges || []).length} privileges`,
        undefined,
        currentStaff.id
      );

      // Part 1: Synchronize PostgreSQL Permissions Table
      if (rbacRepository && Array.isArray(privileges)) {
        await rbacRepository.syncRolePermissions(updatedRole.id, privileges);
      }

      res.json({ success: true, role: updatedRole });
    } catch (err: any) {
      console.error('[Role Update Error]', err);
      res.status(500).json({ error: 'Failed to update role.' });
    }
  });

  router.get('/api/rbac/permissions-catalogue', async (_req, res) => {
    try {
      res.json({
        categories: CANONICAL_PRIVILEGE_CATEGORIES,
        reports: CANONICAL_REPORTS,
        orderSummaryColumns: CANONICAL_ORDER_SUMMARY_COLUMNS,
      });
    } catch (err) {
      console.error('[RBAC Permissions Catalogue Error]', err);
      res.status(500).json({ error: 'Failed to load RBAC permissions catalogue.' });
    }
  });

  router.get('/api/rbac/staff/:id/effective-access', requireAuth, async (req, res) => {
    await handleRbacEffectiveAccess(req, res, deps);
  });

  return router;
}
