import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { drizzle as drizzlePostgresJs } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgresJs } from 'drizzle-orm/postgres-js/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema/index';
import { CANONICAL_PRIVILEGE_CATEGORIES, DEFAULT_STANDARD_ROLES } from '../../src/data/rbacCatalogue';
import { AUTHORITATIVE_BRANCHES, DEFAULT_STAFF_ACCOUNTS } from './canonicalSeeds';

const rawDatabaseUrl = (process.env.DATABASE_URL || '').trim();

if (process.env.NODE_ENV === 'production' && !rawDatabaseUrl) {
  console.error('[FATAL] DATABASE_URL is required in production mode. Refusing to start without PostgreSQL connection string.');
  process.exit(1);
}

const isExternalPostgres = rawDatabaseUrl.startsWith('postgres://') || rawDatabaseUrl.startsWith('postgresql://');

let dbInstance: any;
let pgliteInstance: PGlite | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

if (isExternalPostgres) {
  sqlClient = postgres(rawDatabaseUrl, { max: 10 });
  dbInstance = drizzlePostgresJs(sqlClient, { schema });
} else {
  const pgliteTarget = rawDatabaseUrl.startsWith('pglite://')
    ? rawDatabaseUrl.replace(/^pglite:\/\//, '')
    : undefined;
  pgliteInstance = pgliteTarget && pgliteTarget !== 'memory' ? new PGlite(pgliteTarget) : new PGlite();
  dbInstance = drizzlePglite(pgliteInstance, { schema });
}

const rawDb = dbInstance as ReturnType<typeof drizzlePostgresJs<typeof schema>>;
export const isUsingExternalPostgres = isExternalPostgres;

let initialized = false;
let initPromise: Promise<void> | null = null;

function wrapDrizzleBuilder(targetObj: any): any {
  if (!targetObj || (typeof targetObj !== 'object' && typeof targetObj !== 'function')) {
    return targetObj;
  }
  return new Proxy(targetObj, {
    get(target, prop, receiver) {
      if (prop === 'then') {
        const origThen = Reflect.get(target, prop, receiver);
        if (typeof origThen !== 'function') return undefined;
        return function (onFulfilled?: any, onRejected?: any) {
          if (initialized) {
            return origThen.call(target, onFulfilled, onRejected);
          }
          return initializePostgreSQLDatabase().then(
            () => origThen.call(target, onFulfilled, onRejected),
            onRejected
          );
        };
      }
      if (prop === 'execute' || prop === 'transaction') {
        const origMethod = Reflect.get(target, prop, receiver);
        if (typeof origMethod === 'function') {
          return function (...args: any[]) {
            if (initialized) {
              return origMethod.apply(target, args);
            }
            return initializePostgreSQLDatabase().then(() => origMethod.apply(target, args));
          };
        }
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        return function (...args: any[]) {
          const res = val.apply(target, args);
          return wrapDrizzleBuilder(res);
        };
      }
      return val;
    },
  });
}

export const db = wrapDrizzleBuilder(rawDb) as ReturnType<typeof drizzlePostgresJs<typeof schema>>;

export async function initializePostgreSQLDatabase(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const migrationsFolder = path.join(process.cwd(), 'drizzle');
    if (isExternalPostgres) {
      await migratePostgresJs(dbInstance, { migrationsFolder });
    } else {
      await migratePglite(dbInstance, { migrationsFolder });
    }

    // Seed canonical branches, RBAC roles/permissions, and staff accounts so PostgreSQL is immediately authoritative
    const snapshotPath = process.env.CHOPLIFE_DB_FILE
      ? path.resolve(process.env.CHOPLIFE_DB_FILE)
      : path.join(process.cwd(), 'data', 'choplife_ops_db.json');

    let snapshotData: any = null;
    if (fs.existsSync(snapshotPath)) {
      try {
        snapshotData = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
      } catch {
        snapshotData = null;
      }
    }

    // 1. Branches
    for (const b of AUTHORITATIVE_BRANCHES) {
      await rawDb
        .insert(schema.branches)
        .values({
          id: b.id,
          name: b.name,
          code: b.code,
          address: b.address,
          phone: b.phone,
          whatsapp: b.whatsappNumber,
          city: b.city,
          state: b.state,
          coordinates: { latitude: b.latitude, longitude: b.longitude },
          operatingHours: {
            openingHours: b.openingHours,
            dineInHours: b.dineInHours,
            deliveryHours: b.deliveryHours,
            bakeryHours: b.bakeryHours,
            staffHours: b.staffHours,
          },
          deliveryConfig: {
            estimatedDeliveryTime: b.estimatedDeliveryTime,
            deliveryFeeBase: b.deliveryFeeBase,
          },
          isActive: b.status === 'active',
        })
        .onConflictDoUpdate({
          target: schema.branches.id,
          set: {
            name: b.name,
            address: b.address,
            phone: b.phone,
            whatsapp: b.whatsappNumber,
            operatingHours: {
              openingHours: b.openingHours,
              dineInHours: b.dineInHours,
              deliveryHours: b.deliveryHours,
              bakeryHours: b.bakeryHours,
              staffHours: b.staffHours,
            },
            updatedAt: new Date(),
          },
        });
    }

    // 2. Permissions & Roles (batched for fast initialization)
    const allPrivileges = CANONICAL_PRIVILEGE_CATEGORIES.flatMap((c) => c.privileges);
    const permissionRows = [
      {
        id: 'perm-*',
        code: '*',
        description: 'Full wildcard superuser permission',
      },
      ...allPrivileges.map((priv) => ({
        id: `perm-${priv.code}`,
        code: priv.code,
        description: priv.description,
      })),
    ];
    await rawDb.insert(schema.permissions).values(permissionRows).onConflictDoNothing();

    const rolePermRows: Array<{ id: string; roleId: string; permissionId: string }> = [];
    for (const roleDef of DEFAULT_STANDARD_ROLES) {
      await rawDb
        .insert(schema.roles)
        .values({
          id: roleDef.id,
          code: roleDef.code,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: roleDef.isSystem,
          privileges: roleDef.privileges,
          reports: roleDef.reports,
          orderSummaryColumns: roleDef.orderSummaryColumns,
        })
        .onConflictDoUpdate({
          target: schema.roles.code,
          set: {
            name: roleDef.name,
            description: roleDef.description,
            privileges: roleDef.privileges,
            reports: roleDef.reports,
            orderSummaryColumns: roleDef.orderSummaryColumns,
          },
        });

      for (const privCode of roleDef.privileges) {
        const permId = `perm-${privCode}`;
        rolePermRows.push({
          id: `rp-${roleDef.id}-${permId}`,
          roleId: roleDef.id,
          permissionId: permId,
        });
      }
    }
    if (rolePermRows.length > 0) {
      await rawDb.insert(schema.rolePermissions).values(rolePermRows).onConflictDoNothing();
    }

    // 3. Staff Accounts (ensure all DEFAULT_STAFF_ACCOUNTS are upserted with canonical credentials, plus any custom snapshot staff)
    const defaultPwHash = bcrypt.hashSync('ChopLife2025!', 10);
    for (const s of DEFAULT_STAFF_ACCOUNTS) {
      const existingSnap = snapshotData?.staff?.[s.id];
      const pinHash =
        existingSnap?.pinHash && String(existingSnap.pinHash).startsWith('$2')
          ? existingSnap.pinHash
          : s.pin
          ? bcrypt.hashSync(String(s.pin), 8)
          : null;
      const isGlobalStaffRole = ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor'].includes(s.role);
      const effectiveAllowedBranches =
        (s as any).allowedBranchIds || (isGlobalStaffRole ? ['gra', 'okabere', 'ugbowo'] : [s.branchId || 'gra']);
      await rawDb
        .insert(schema.staff)
        .values({
          id: s.id,
          staffId: s.staffId,
          name: s.name,
          workEmail: s.workEmail,
          phone: s.phone || '',
          role: s.role,
          branchId: s.branchId || 'gra',
          allowedBranchIds: effectiveAllowedBranches,
          customPrivileges: (s as any).customPrivileges || [],
          passwordHash: defaultPwHash,
          pinHash,
          salt: '',
          status: 'active',
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockoutUntil: null,
          dob: s.dateOfBirth ? new Date(s.dateOfBirth) : null,
          guarantorName: s.guarantorName || null,
          guarantorPhone: s.guarantorPhone || null,
          guarantorRelationship: s.guarantorRelationship || null,
          guarantorAddress: s.guarantorAddress || null,
          guarantorWorkplace: s.guarantorWorkplace || null,
          payrollProfile: (s as any).payrollProfile || null,
        })
        .onConflictDoUpdate({
          target: schema.staff.id,
          set: {
            staffId: s.staffId,
            name: s.name,
            workEmail: s.workEmail,
            role: s.role,
            branchId: s.branchId || 'gra',
            allowedBranchIds: effectiveAllowedBranches,
            passwordHash: defaultPwHash,
            pinHash,
            status: 'active',
            mustChangePassword: false,
            failedLoginAttempts: 0,
            lockoutUntil: null,
            payrollProfile: (s as any).payrollProfile || null,
          },
        });
    }

    const snapshotStaffList = snapshotData?.staff ? Object.values(snapshotData.staff) : [];
    for (const s of snapshotStaffList as any[]) {
      if (DEFAULT_STAFF_ACCOUNTS.some((d) => d.id === s.id || d.workEmail.toLowerCase() === String(s.workEmail || '').toLowerCase())) {
        continue;
      }
      const pwHash = s.passwordHash || defaultPwHash;
      const pinHash = s.pinHash || (s.pin ? bcrypt.hashSync(String(s.pin), 10) : null);
      await rawDb
        .insert(schema.staff)
        .values({
          id: s.id,
          staffId: s.staffId,
          name: s.name,
          workEmail: s.workEmail,
          phone: s.phone || '',
          role: s.role,
          branchId: s.branchId || 'gra',
          allowedBranchIds: s.allowedBranchIds || ['gra', 'okabere', 'ugbowo'],
          customPrivileges: s.customPrivileges || [],
          passwordHash: pwHash,
          pinHash,
          salt: s.salt || '',
          status: s.status || 'active',
          mustChangePassword: Boolean(s.mustChangePassword),
          dob: s.dateOfBirth ? new Date(s.dateOfBirth) : null,
          guarantorName: s.guarantorName || null,
          guarantorPhone: s.guarantorPhone || null,
          guarantorRelationship: s.guarantorRelationship || null,
          guarantorAddress: s.guarantorAddress || null,
          guarantorWorkplace: s.guarantorWorkplace || null,
          payrollProfile: s.payrollProfile || null,
        })
        .onConflictDoNothing();
    }

    initialized = true;
  })();

  return initPromise;
}

void initializePostgreSQLDatabase().catch((err) => {
  console.error('[DB INIT ERROR]', err);
});
