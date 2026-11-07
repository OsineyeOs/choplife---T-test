import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type {
  DbDatabase,
  DbStaffAccount,
  DbSession,
  DbAuditLog,
} from '../../server_db.ts';

export const SESSION_COOKIE_NAME = 'choplife_staff_session';

export function hashPasswordBcrypt(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function validateStaffPasswordPolicy(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string' || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one letter and at least one number or special character.',
    };
  }
  return { valid: true };
}

export function verifyStaffPassword(password: string, staff: DbStaffAccount): { valid: boolean; needsRehash: boolean } {
  if (!password || !staff.passwordHash) return { valid: false, needsRehash: false };

  if (staff.passwordHash.startsWith('$2a$') || staff.passwordHash.startsWith('$2b$')) {
    try {
      const valid = bcrypt.compareSync(password, staff.passwordHash);
      return { valid, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  if (staff.salt) {
    try {
      const derivedKey = crypto.scryptSync(password, staff.salt, 64);
      const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
      const hashBuffer = Buffer.from(staff.passwordHash, 'hex');
      if (keyBuffer.length === hashBuffer.length && crypto.timingSafeEqual(keyBuffer, hashBuffer)) {
        return { valid: true, needsRehash: true };
      }
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  return { valid: false, needsRehash: false };
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, generatedSalt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt: generatedSalt,
  };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    if (keyBuffer.length !== hashBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, hashBuffer);
  } catch {
    return false;
  }
}

interface RateLimitRecord {
  attempts: number;
  lockoutUntil: number;
}
const rateLimitMap: Map<string, RateLimitRecord> = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function checkRateLimit(identifier: string): { isLocked: boolean; remainingSeconds?: number } {
  const record = rateLimitMap.get(identifier);
  const now = Date.now();
  if (!record) return { isLocked: false };

  if (record.lockoutUntil > now) {
    const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  if (record.lockoutUntil <= now && record.attempts >= MAX_ATTEMPTS) {
    rateLimitMap.delete(identifier);
    return { isLocked: false };
  }

  return { isLocked: false };
}

export function recordFailedAttempt(identifier: string) {
  const record = rateLimitMap.get(identifier) || { attempts: 0, lockoutUntil: 0 };
  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  rateLimitMap.set(identifier, record);
}

export function clearRateLimit(identifier: string) {
  rateLimitMap.delete(identifier);
}

export function createAuthAndRbacHelpers(deps: {
  getDb: () => DbDatabase;
  saveDatabase: () => void;
  staffRepository: any;
  auditRepository: any;
  sessionRepository: any;
  rbacRepository?: any;
}) {
  const { getDb, saveDatabase, staffRepository, auditRepository, sessionRepository, rbacRepository } = deps;

  async function logAuditEvent(
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>,
    staffId?: string
  ) {
    try {
      await auditRepository.log({
        id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        staffId: staffId || null,
        staffName: staffName || 'System',
        staffRole: staffRole || 'system',
        branchId: branchId || 'global',
        action: actionType,
        details,
        metadata: metadata || null,
      });
    } catch (err) {
      console.error('[AuditLog Error]', err);
    }
  }

  async function getSessionFromRequest(req: Request): Promise<any | null> {
    let token = req.cookies?.[SESSION_COOKIE_NAME];
    
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token && req.headers['x-staff-token']) {
      token = String(req.headers['x-staff-token']);
    }

    if (!token && req.headers['x-session-token']) {
      token = String(req.headers['x-session-token']);
    }
    
    if (token) {
      const session = await sessionRepository.getByToken(token);
      if (session) {
        const now = Date.now();
        const expiresMs = session.expiresAt instanceof Date ? session.expiresAt.getTime() : new Date(session.expiresAt).getTime();
        if (expiresMs >= now) {
          const lastActMs = session.lastActivity instanceof Date ? session.lastActivity.getTime() : new Date(session.lastActivity).getTime();
          const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
          if (now - lastActMs <= IDLE_TIMEOUT_MS) {
            return session as any;
          }
        }
        await sessionRepository.delete(session.id);
      }
    }

    // Fallback for iframe preview environments when cookies are blocked:
    // If an X-Staff-Id header is passed matching an active staff account, provision an active session
    const staffIdHeader = req.headers['x-staff-id'] as string;
    if (staffIdHeader && staffRepository) {
      try {
        const staff = await staffRepository.getById(staffIdHeader);
        if (staff && staff.status === 'active') {
          const sessionToken = crypto.randomBytes(32).toString('hex');
          const [newSession] = await sessionRepository.create({
            id: sessionToken,
            token: sessionToken,
            staffId: staff.id,
            role: staff.role,
            branchId: staff.branchId || 'gra',
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
            lastActivity: new Date(),
          });
          return newSession || {
            id: sessionToken,
            token: sessionToken,
            staffId: staff.id,
            role: staff.role,
            branchId: staff.branchId || 'gra',
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
            lastActivity: new Date(),
          };
        }
      } catch (err) {
        console.error('[Auth Fallback Error]', err);
      }
    }

    return null;
  }

  async function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized. Valid staff session required.' });
      }

      const staff = await staffRepository.getById(session.staffId);
      if (!staff || staff.status === 'suspended') {
        await sessionRepository.delete(session.id);
        return res.status(403).json({ error: 'Staff account suspended or no longer active.' });
      }

      // Sliding session expiration activity update
      if (sessionRepository && sessionRepository.updateLastActivity) {
        await sessionRepository.updateLastActivity(session.id).catch((err: any) => {
          console.error('[Session Activity Update Error]', err);
        });
      }

      (req as any).session = session;
      (req as any).staff = staff;
      next();
    } catch (err) {
      next(err);
    }
  }

  function requireRole(allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const staff = (req as any).staff as DbStaffAccount;
      if (!staff) return res.status(401).json({ error: 'Unauthorized.' });

      if (!allowedRoles.includes(staff.role)) {
        return res.status(403).json({
          error: `Forbidden: role '${staff.role}' is not authorized for this operation.`,
          requiredRoles: allowedRoles,
        });
      }
      next();
    };
  }

  async function getStaffPrivileges(staff: DbStaffAccount): Promise<string[]> {

    if (!rbacRepository) {
      throw new Error('RBAC Repository not configured - system fail-closed.');
    }

    let roleObj: any = null;
    let rolePermissionsList: any[] = [];
    try {
      roleObj = (await rbacRepository.getRoleByCode(staff.role)) || (await rbacRepository.getRoleById(staff.role));
      if (roleObj) {
        rolePermissionsList = await rbacRepository.getPermissionsForRole(roleObj.id);
      } else {
        throw new Error(`Role '${staff.role}' not found in database.`);
      }
    } catch (err) {
      console.error('[RBAC Privileges Fetch Error]', err);
      throw new Error(`Failed to resolve privileges for role '${staff.role}': ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    let basePrivileges: string[] = rolePermissionsList.map((rp: any) => rp.code);

    // Baseline privileges for all staff
    basePrivileges = Array.from(new Set([...basePrivileges, 'expenses.submit_own', 'expenses.view_own', 'expenses.amend_own']));

    if (staff.role === 'auditor') {
      // Strictly read-only privileges for auditor
      basePrivileges = basePrivileges.filter(
        (p) =>
          p === 'backoffice.access' ||
          p.endsWith('.view') ||
          p.endsWith('.view_own') ||
          p.endsWith('.view_branch') ||
          p === 'reports.export'
      );
    }

    let custom: string[] = [];
    if (staff.customPrivileges) {
      if (Array.isArray(staff.customPrivileges)) {
        custom = staff.customPrivileges;
      } else if (typeof staff.customPrivileges === 'string') {
        try {
          custom = JSON.parse(staff.customPrivileges);
        } catch {}
      }
    }

    if (custom.length > 0 && staff.role !== 'auditor') {
      return Array.from(new Set([...basePrivileges, ...custom]));
    }

    return basePrivileges;
  }

  async function hasPermission(staff: DbStaffAccount, permissionCode: string): Promise<boolean> {
    const privileges = await getStaffPrivileges(staff);
    if (privileges.includes('*') || privileges.includes(permissionCode)) return true;
    const [domain] = permissionCode.split('.');
    if (domain && privileges.includes(`${domain}.*`)) return true;
    return false;
  }

  function requirePermission(permissionCode: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const staff = (req as any).staff as DbStaffAccount;
        if (!staff) return res.status(401).json({ error: 'Unauthorized. Staff authentication required.' });

        if (await hasPermission(staff, permissionCode)) {
          return next();
        }

        await logAuditEvent(
          staff.name,
          staff.role,
          staff.branchId,
          'PERMISSION_DENIED',
          `Access denied: Missing privilege '${permissionCode}' for ${staff.name} (${staff.role})`
        );

        return res.status(403).json({
          error: `Access Denied: Missing required privilege '${permissionCode}'.`,
          missingPermission: permissionCode,
          staffRole: staff.role,
        });
      } catch (err) {
        next(err);
      }
    };
  }

  function requireBranchAccess(req: Request, res: Response, next: NextFunction) {
    const staff = (req as any).staff as DbStaffAccount;
    if (!staff) return res.status(401).json({ error: 'Unauthorized.' });

    if (['super_admin', 'corporate_admin', 'auditor', 'accountant'].includes(staff.role)) {
      return next();
    }

    const requestedBranch = (req.params.branchId || req.query.branchId || req.body?.branchId) as string | undefined;

    if (requestedBranch === 'all') {
      return res.status(403).json({
        error: `Access denied. Enterprise-wide 'all' scope is restricted to corporate administrators and auditors.`,
      });
    }

    const staffAllowedBranches = Array.from(
      new Set([staff.branchId, ...(staff.allowedBranchIds || [])].filter(Boolean))
    );

    if (requestedBranch && !staffAllowedBranches.includes(requestedBranch)) {
      return res.status(403).json({
        error: `Access denied. Staff member is assigned to [${staffAllowedBranches.join(', ')}] and cannot access '${requestedBranch}'.`,
      });
    }

    if (req.query && !req.query.branchId) (req.query as any).branchId = staff.branchId;
    if (req.body && typeof req.body === 'object' && !req.body.branchId) req.body.branchId = staff.branchId;

    next();
  }

  return {
    logAuditEvent,
    getSessionFromRequest,
    requireAuth,
    requireRole,
    getStaffPrivileges,
    hasPermission,
    requirePermission,
    requireBranchAccess,
  };
}
