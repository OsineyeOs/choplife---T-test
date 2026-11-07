import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { DbDatabase, DbStaffAccount } from '../../server_db.ts';
import {
  SESSION_COOKIE_NAME,
  hashPasswordBcrypt,
  validateStaffPasswordPolicy,
  verifyStaffPassword,
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
} from '../middleware/authAndRbac.ts';

export function createAuthAndHealthRouter(deps: {
  getDb: () => DbDatabase;
  reloadDb: () => DbDatabase;
  saveDatabase: () => void;
  saveDatabaseSync: () => void;
  port: number;
  requireAuth: any;
  requireRole: any;
  getSessionFromRequest: (req: any) => Promise<any>;
  getStaffPrivileges: (staff: DbStaffAccount) => Promise<string[]>;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>,
    staffId?: string
  ) => void;
  staffRepository?: any;
  sessionRepository?: any;
  resetTokenRepository?: any;
  branchRepository?: any;
  db?: any;
}): Router {
  const router = Router();
  const {
    getDb,
    reloadDb,
    port,
    requireAuth,
    requireRole,
    getSessionFromRequest,
    getStaffPrivileges,
    logAuditEvent,
    staffRepository,
    sessionRepository,
    resetTokenRepository,
    branchRepository,
  } = deps;

  // 1. Health & System Provisioning Status (Live & Readiness Probes)
  router.get('/api/health/live', (_req, res) => {
    res.json({
      status: 'alive',
      healthy: true,
      service: 'Choplife Republic Operations Engine',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/api/health/ready', async (_req, res) => {
    const db = getDb();
    try {
      const staffRows = staffRepository ? await staffRepository.getAll() : [];
      const branchRows = branchRepository ? await branchRepository.getAll() : [];
      res.json({
        status: 'ready',
        healthy: true,
        database: 'connected',
        engine: 'postgresql_pglite_drizzle',
        migrationState: 'verified',
        pgStaffCount: staffRows.length,
        pgBranchesCount: branchRows.length,
        activeProductsCount: Object.keys(db.menuProducts || {}).length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'degraded',
        healthy: false,
        database: 'error',
        error: err?.message || 'Database readiness probe failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  router.get('/api/health', async (_req, res) => {
    const db = getDb();
    let pgReady = false;
    let pgStaffCount = 0;
    let pgBranchesCount = 0;
    try {
      const staffRows = staffRepository ? await staffRepository.getAll() : [];
      const branchRows = branchRepository ? await branchRepository.getAll() : [];
      pgReady = true;
      pgStaffCount = staffRows.length;
      pgBranchesCount = branchRows.length;
    } catch (err) {
      console.error('[HEALTH] PostgreSQL readiness probe failed:', err);
    }
    const productsCount = Object.keys(db.menuProducts || {}).length;
    res.status(pgReady ? 200 : 503).json({
      status: pgReady ? 'ok' : 'degraded',
      healthy: pgReady,
      pgDatabaseConnected: pgReady,
      pgStaffCount,
      pgBranchesCount,
      staffCount: pgStaffCount,
      branchesCount: pgBranchesCount,
      productsCount,
      migrationState: pgReady ? 'verified' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'Choplife Republic Operations Engine',
      version: '2.0.0',
      port,
      activeChecksCount: Object.keys(db.checks || {}).length,
      shiftsCount: Object.keys(db.shifts || {}).length,
      persistence: 'postgresql_relational_engine',
    });
  });

  // Superadmin Database Snapshot Reload Endpoint
  router.post('/api/admin/db/reload', requireAuth, requireRole(['super_admin']), (req, res) => {
    if (req.body && req.body.snapshot && typeof req.body.snapshot === 'object') {
      const dbFilePath = process.env.CHOPLIFE_DB_FILE
        ? path.resolve(process.env.CHOPLIFE_DB_FILE)
        : path.join(process.cwd(), 'data', 'choplife_ops_db.json');
      fs.writeFileSync(dbFilePath, JSON.stringify(req.body.snapshot, null, 2), 'utf-8');
    }
    const db = reloadDb();
    res.json({
      success: true,
      message: 'Database reloaded from disk into memory.',
      ordersCount: Object.keys(db.orders || {}).length,
    });
  });

  router.get('/api/auth/staff/status', async (_req, res) => {
    try {
      const allStaff = staffRepository ? await staffRepository.getAll() : [];
      const activeStaff = allStaff.filter((s: any) => s.status === 'active');
      res.json({
        isProvisioned: allStaff.length > 0,
        activeStaffCount: activeStaff.length,
      });
    } catch (err: any) {
      console.error('[Staff Status Error]', err);
      res.status(500).json({ error: 'Failed to verify system provisioning status.' });
    }
  });

  // Setup Initial Super Admin
  router.post('/api/auth/staff/setup-admin', async (req, res) => {
    try {
      if (staffRepository) {
        const allStaff = await staffRepository.getAll();
        if (allStaff.length > 0) {
          return res.status(400).json({ error: 'System has already been provisioned with an administrator.' });
        }
      }

      const { fullName, workEmail, phone, password, branchId = 'gra' } = req.body;

      if (!fullName || !workEmail || !password) {
        return res.status(400).json({ error: 'Full name, work email, and password are required.' });
      }

      const cleanEmail = String(workEmail).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'A valid work email address is required.' });
      }

      if (String(password).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      }

      const cleanBranchId = String(branchId || 'gra').trim();
      let validBranches = ['gra', 'okabere', 'ugbowo'];
      if (branchRepository) {
        const dbBranches = await branchRepository.getAll();
        if (dbBranches.length > 0) {
          validBranches = dbBranches.map((b: any) => b.id);
        }
      }

      if (!validBranches.includes(cleanBranchId)) {
        return res.status(400).json({
          error: `Invalid branchId '${cleanBranchId}'. Must be one of: ${validBranches.join(', ')}.`,
        });
      }

      const hash = hashPasswordBcrypt(password);
      const adminId = `staff-${Date.now()}`;
      const newAdminData = {
        id: adminId,
        staffId: 'STF-001',
        name: String(fullName).trim(),
        workEmail: cleanEmail,
        phone: phone ? String(phone).trim() : '',
        role: 'super_admin',
        branchId: cleanBranchId,
        allowedBranchIds: ['gra', 'okabere', 'ugbowo'],
        passwordHash: hash,
        status: 'active',
        mustChangePassword: false,
      };

      let newAdmin: any = newAdminData;
      if (staffRepository) {
        const [inserted] = await staffRepository.create(newAdminData);
        if (inserted) newAdmin = inserted;
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      if (sessionRepository) {
        await sessionRepository.create({
          id: sessionToken,
          token: sessionToken,
          staffId: adminId,
          role: 'super_admin',
          branchId: cleanBranchId,
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
          lastActivity: new Date(),
        });
      }

      res.cookie(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000,
      });

      await logAuditEvent(
        newAdmin.name,
        newAdmin.role,
        newAdmin.branchId,
        'STAFF_CREATED',
        `Initial Super Admin provisioned: ${newAdmin.name} (${newAdmin.workEmail})`,
        undefined,
        newAdmin.id
      );

      res.json({
        success: true,
        message: 'Super Administrator created and authenticated successfully.',
        staff: {
          id: newAdmin.id,
          staffId: newAdmin.staffId,
          name: newAdmin.name,
          workEmail: newAdmin.workEmail,
          phone: newAdmin.phone,
          role: newAdmin.role,
          branchId: newAdmin.branchId,
          status: newAdmin.status,
        },
        token: sessionToken,
      });
    } catch (err: any) {
      console.error('[Setup Admin Error]', err);
      res.status(500).json({ error: 'Failed to provision initial administrator.' });
    }
  });

  // 2. Staff Authentication & Sessions (PostgreSQL Exclusive)
  router.post('/api/auth/staff/login', async (req, res) => {
    try {
      const emailOrStaffId = req.body.emailOrStaffId || req.body.identifier || req.body.email;
      const { password } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const rateLimitKey = `${clientIp}_${(emailOrStaffId || '').trim().toLowerCase()}`;

      const rateCheck = checkRateLimit(rateLimitKey);
      if (rateCheck.isLocked) {
        return res.status(429).json({
          error: `Too many failed login attempts. Please wait ${rateCheck.remainingSeconds} seconds before trying again.`,
          lockoutSeconds: rateCheck.remainingSeconds,
        });
      }

      if (!emailOrStaffId || !password) {
        recordFailedAttempt(rateLimitKey);
        return res.status(400).json({ error: 'Please provide your work email/staff ID and password.' });
      }

      const cleanIdentifier = emailOrStaffId.trim().toLowerCase();

      // PostgreSQL Staff Query ONLY
      let matchedStaff: any = null;
      if (staffRepository) {
        const allStaff = await staffRepository.getAll();
        for (const s of allStaff) {
          const sStaffId = (s.staffId || '').toLowerCase();
          const sId = (s.id || '').toLowerCase();
          const sWorkEmail = (s.workEmail || '').toLowerCase();
          if (
            sWorkEmail === cleanIdentifier ||
            sStaffId === cleanIdentifier ||
            sStaffId.replace(/^cl-/, '') === cleanIdentifier.replace(/^cl-/, '') ||
            sId === cleanIdentifier
          ) {
            matchedStaff = s;
            break;
          }
        }
      }

      if (!matchedStaff) {
        recordFailedAttempt(rateLimitKey);
        await logAuditEvent('Unknown Staff', 'anonymous', 'system', 'LOGIN_FAILED', `Failed login attempt for: ${cleanIdentifier}`);
        return res.status(401).json({ error: 'Invalid email/staff ID or password.' });
      }

      if (matchedStaff.status === 'suspended' || (matchedStaff.status as string) === 'inactive') {
        await logAuditEvent(
          matchedStaff.name,
          matchedStaff.role,
          matchedStaff.branchId,
          'LOGIN_BLOCKED_SUSPENDED',
          `Suspended staff account attempted login: ${matchedStaff.workEmail}`,
          undefined,
          matchedStaff.id
        );
        return res.status(403).json({ error: 'Staff account is suspended or inactive. Contact an administrator.' });
      }

      const nowMs = Date.now();
      const lockoutMs = matchedStaff.lockoutUntil instanceof Date ? matchedStaff.lockoutUntil.getTime() : Number(matchedStaff.lockoutUntil || 0);
      if (lockoutMs && lockoutMs > nowMs) {
        const remainingSecs = Math.ceil((lockoutMs - nowMs) / 1000);
        return res.status(429).json({
          error: `Staff account is temporarily locked due to 5 consecutive failed attempts. Please retry in ${remainingSecs} seconds.`,
          lockoutSeconds: remainingSecs,
        });
      }

      const authResult = verifyStaffPassword(password, matchedStaff);
      if (!authResult.valid) {
        const failedAttempts = (matchedStaff.failedLoginAttempts || 0) + 1;
        const newLockout = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        if (staffRepository && matchedStaff.id) {
          await staffRepository.update(matchedStaff.id, {
            failedLoginAttempts: failedAttempts,
            lockoutUntil: newLockout,
          });
        }
        recordFailedAttempt(rateLimitKey);
        await logAuditEvent(matchedStaff.name, matchedStaff.role, matchedStaff.branchId, 'LOGIN_FAILED', `Invalid password attempt for: ${matchedStaff.workEmail} (attempt ${failedAttempts}/5)`, undefined, matchedStaff.id);

        if (failedAttempts >= 5) {
          return res.status(429).json({
            error: 'Too many failed login attempts. Account locked for 15 minutes.',
            lockoutSeconds: 900,
          });
        }

        return res.status(401).json({
          error: `Invalid email/staff ID or password. (${5 - failedAttempts} attempt(s) remaining)`,
          attemptsRemaining: 5 - failedAttempts,
        });
      }

      clearRateLimit(rateLimitKey);

      if (staffRepository && matchedStaff.id) {
        const updateFields: any = {
          failedLoginAttempts: 0,
          lockoutUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: clientIp,
        };
        if (authResult.needsRehash) {
          updateFields.passwordHash = hashPasswordBcrypt(password);
          updateFields.salt = null;
          await logAuditEvent(matchedStaff.name, matchedStaff.role, matchedStaff.branchId, 'PASSWORD_HASH_UPGRADED', `Upgraded password hashing algorithm to bcrypt for ${matchedStaff.workEmail}`, undefined, matchedStaff.id);
        }
        await staffRepository.update(matchedStaff.id, updateFields);
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      if (sessionRepository) {
        await sessionRepository.create({
          id: sessionToken,
          token: sessionToken,
          staffId: matchedStaff.id,
          role: matchedStaff.role,
          branchId: matchedStaff.branchId || 'gra',
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
          lastActivity: new Date(),
        });
      }

      res.cookie(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000,
      });

      await logAuditEvent(matchedStaff.name, matchedStaff.role, matchedStaff.branchId, 'LOGIN_SUCCESS', `Staff logged in: ${matchedStaff.name} (bcrypt verified)`, undefined, matchedStaff.id);

      const effectivePrivileges = await getStaffPrivileges(matchedStaff);

      res.json({
        success: true,
        staff: {
          id: matchedStaff.id,
          staffId: matchedStaff.staffId,
          name: matchedStaff.name,
          workEmail: matchedStaff.workEmail,
          phone: matchedStaff.phone,
          role: matchedStaff.role,
          branchId: matchedStaff.branchId,
          allowedBranchIds: matchedStaff.allowedBranchIds || [matchedStaff.branchId],
          privileges: effectivePrivileges,
          status: matchedStaff.status,
          mustChangePassword: matchedStaff.mustChangePassword,
        },
        token: sessionToken,
      });
    } catch (err: any) {
      console.error('[Login Error]', err);
      res.status(500).json({ error: 'An error occurred during authentication.' });
    }
  });

  router.post('/api/auth/staff/logout', async (req, res) => {
    try {
      const session = await getSessionFromRequest(req);
      if (session) {
        const staff = staffRepository ? await staffRepository.getById(session.staffId) : null;
        if (staff) {
          await logAuditEvent(staff.name, staff.role, staff.branchId, 'LOGOUT', `Staff logged out: ${staff.name}`, undefined, staff.id);
        }
        if (sessionRepository && session.id) {
          await sessionRepository.delete(session.id);
        }
      }
      res.clearCookie(SESSION_COOKIE_NAME);
      res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err) {
      console.error('[Logout Error]', err);
      res.clearCookie(SESSION_COOKIE_NAME);
      res.json({ success: true, message: 'Logged out.' });
    }
  });

  router.post('/api/auth/staff/pin-login', (_req, res) => {
    return res.status(403).json({ error: 'Quick PIN login has been disabled in production. Please use secure password authentication.' });
  });

  router.get('/api/auth/staff/me', requireAuth, async (req, res) => {
    try {
      const staff = (req as any).staff as DbStaffAccount;
      const privileges = await getStaffPrivileges(staff);
      res.json({
        id: staff.id,
        staffId: staff.staffId,
        name: staff.name,
        workEmail: staff.workEmail,
        phone: staff.phone,
        role: staff.role,
        branchId: staff.branchId,
        allowedBranchIds: staff.allowedBranchIds || [staff.branchId],
        privileges,
        status: staff.status,
        mustChangePassword: staff.mustChangePassword,
      });
    } catch (err: any) {
      console.error('[Me Endpoint Error]', err);
      res.status(500).json({ error: 'Failed to retrieve profile.' });
    }
  });

  // Password Recovery (PostgreSQL Exclusive)
  router.post('/api/auth/staff/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const rateLimitKey = `forgot_pwd_${clientIp}_${(email || '').trim().toLowerCase()}`;

      const rateCheck = checkRateLimit(rateLimitKey);
      if (rateCheck.isLocked) {
        return res.status(429).json({
          error: `Too many password reset requests. Please wait ${rateCheck.remainingSeconds} seconds before trying again.`,
          lockoutSeconds: rateCheck.remainingSeconds,
        });
      }

      if (!email) {
        recordFailedAttempt(rateLimitKey);
        return res.status(400).json({ error: 'Please enter your work email.' });
      }

      recordFailedAttempt(rateLimitKey);
      const cleanEmail = email.trim().toLowerCase();

      let matchedStaff: any = null;
      if (staffRepository) {
        matchedStaff = await staffRepository.getByWorkEmail(cleanEmail);
      }

      if (matchedStaff) {
        if (resetTokenRepository) {
          await resetTokenRepository.invalidateAllForStaff(matchedStaff.id);
          const resetToken = crypto.randomBytes(24).toString('hex');
          await resetTokenRepository.create({
            id: resetToken,
            token: resetToken,
            staffId: matchedStaff.id,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            used: false,
          });
        }

        await logAuditEvent(
          matchedStaff.name,
          matchedStaff.role,
          matchedStaff.branchId,
          'PASSWORD_RESET_REQUESTED',
          `Password reset token generated for ${matchedStaff.workEmail}`,
          undefined,
          matchedStaff.id
        );

        console.info(`[SECURITY AUDIT] Staff password reset token generated for ${matchedStaff.workEmail}`);
      }

      res.json({
        success: true,
        message: 'If an account matches this work email, reset instructions have been generated.',
      });
    } catch (err: any) {
      console.error('[Forgot Password Error]', err);
      res.status(500).json({ error: 'Failed to process password recovery request.' });
    }
  });

  router.post('/api/auth/staff/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const rateLimitKey = `reset_pwd_${clientIp}`;

      const rateCheck = checkRateLimit(rateLimitKey);
      if (rateCheck.isLocked) {
        return res.status(429).json({
          error: `Too many failed reset attempts. Please wait ${rateCheck.remainingSeconds} seconds before trying again.`,
          lockoutSeconds: rateCheck.remainingSeconds,
        });
      }

      if (!token || !newPassword) {
        recordFailedAttempt(rateLimitKey);
        return res.status(400).json({ error: 'Recovery token and new password are required.' });
      }

      const policyCheck = validateStaffPasswordPolicy(newPassword);
      if (!policyCheck.valid) {
        return res.status(400).json({ error: policyCheck.error });
      }

      const cleanToken = String(token).trim();
      let resetRecord: any = null;
      if (resetTokenRepository) {
        resetRecord = await resetTokenRepository.getByToken(cleanToken);
      }

      const now = new Date();
      const isExpired = resetRecord?.expiresAt ? new Date(resetRecord.expiresAt).getTime() < now.getTime() : true;

      if (!resetRecord || resetRecord.used || isExpired) {
        recordFailedAttempt(rateLimitKey);
        return res.status(400).json({ error: 'Invalid or expired password reset token/PIN.' });
      }

      let staffObj: any = null;
      if (staffRepository) {
        staffObj = await staffRepository.getById(resetRecord.staffId);
      }

      if (!staffObj) {
        recordFailedAttempt(rateLimitKey);
        return res.status(400).json({ error: 'Staff account not found.' });
      }

      clearRateLimit(rateLimitKey);

      // Transactional updates in PG repositories
      if (staffRepository) {
        await staffRepository.update(staffObj.id, {
          passwordHash: hashPasswordBcrypt(newPassword),
          salt: null,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        });
      }

      if (resetTokenRepository) {
        await resetTokenRepository.markUsed(resetRecord.id);
        await resetTokenRepository.invalidateAllForStaff(staffObj.id);
      }

      if (sessionRepository) {
        await sessionRepository.deleteByStaffId(staffObj.id);
      }

      await logAuditEvent(
        staffObj.name,
        staffObj.role,
        staffObj.branchId,
        'PASSWORD_RESET_COMPLETED',
        `Password successfully updated by ${staffObj.name}`,
        undefined,
        staffObj.id
      );

      res.json({ success: true, message: 'Password updated successfully. You may now log in.' });
    } catch (err: any) {
      console.error('[Reset Password Error]', err);
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  });

  return router;
}
