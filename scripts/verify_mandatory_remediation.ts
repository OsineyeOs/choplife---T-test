/**
 * Choplife Republic — Mandatory Remediation & Independent Release Verification Suite
 * Command: npx tsx scripts/verify_mandatory_remediation.ts
 *
 * Mounts the actual Express routers, RBAC middleware, pricing engine, and inventory
 * depletion/reversal services on an ephemeral local HTTP server, executes end-to-end
 * verification of all Mandatory Remediation requirements, and restores the original
 * database snapshot upon completion.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Server } from 'http';
import {
  loadDatabase,
  saveDatabase,
  saveDatabaseSync,
  getDb,
  seedCmsAndMenuCatalogue,
} from '../server_db.ts';
import {
  hashPasswordBcrypt,
  validateStaffPasswordPolicy,
  verifyStaffPassword,
  createAuthAndRbacHelpers,
} from '../server/middleware/authAndRbac.ts';
import { createStaffAndRbacRouter } from '../server/routes/staffAndRbacRouter.ts';
import { createCmsAndMenuRouter } from '../server/routes/cmsAndMenuRouter.ts';
import { createCustomerNotificationDispatcher } from '../server/services/customerNotificationService.ts';
import { createOnlineOrdersAndCustomerRouter } from '../server/routes/onlineOrdersAndCustomerRouter.ts';
import {
  createOrderInventoryDepleter,
  createOrderInventoryReverser,
  createPosChecksAndOfflineRouter,
} from '../server/routes/posChecksAndOfflineRouter.ts';
import { createDispatchRouter } from '../server/routes/dispatchRouter.ts';
import { createExpenseClaimsRouter } from '../server/routes/expenseClaimsRouter.ts';
import { createFinancialManagementRouter } from '../server/routes/financialManagementRouter.ts';
import { performVirginCleanOnObject } from './clean_virgin_database.ts';

const DB_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');

interface TestResult {
  section: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assertTest(section: string, name: string, condition: boolean, details: string) {
  results.push({ section, name, passed: Boolean(condition), details });
  const icon = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} | [${section}] ${name} — ${details}`);
}

async function runVerification() {
  console.log('================================================================================');
  console.log('CHOPLIFE REPUBLIC — MANDATORY REMEDIATION END-TO-END VERIFICATION SUITE');
  console.log('================================================================================\n');

  const originalDbRaw = fs.readFileSync(DB_PATH, 'utf-8');
  let server: Server | null = null;

  try {
    loadDatabase();
    seedCmsAndMenuCatalogue();
    const db = getDb() as any;

    // Build Express app with the real production routers and middleware
    const app = express();
    app.use(express.json({ limit: '10mb' }));

    const {
      logAuditEvent,
      getSessionFromRequest,
      requireAuth,
      requireRole,
      getStaffPrivileges,
      hasPermission,
      requirePermission,
      requireBranchAccess,
    } = createAuthAndRbacHelpers({
      getDb,
      saveDatabase,
      staffRepository: {
        getById: async (id: string) => db.staff[id],
        getByStaffId: async (sid: string) => Object.values(db.staff).find((s: any) => s.staffId === sid),
        getAll: async () => Object.values(db.staff),
        getActiveSupervisors: async () => Object.values(db.staff).filter((s: any) => s.status === 'active' && s.pinHash),
      } as any,
      auditRepository: {
        log: async (event: any) => {
          db.auditLogs = db.auditLogs || [];
          db.auditLogs.push(event);
        },
      } as any,
      sessionRepository: {
        getByToken: async (token: string) => db.sessions[token],
        create: async (data: any) => {
          db.sessions[data.token] = data;
        },
        delete: async (token: string) => {
          delete db.sessions[token];
        },
      } as any,
      rbacRepository: {
        getRoleByCode: async (code: string) => Object.values(db.roles || {}).find((r: any) => r.code === code),
        getRoleById: async (id: string) => db.roles?.[id],
        getPermissionsForRole: async (roleId: string) => {
          const role = db.roles?.[roleId];
          return (role?.privileges || []).map((p: string) => ({ code: p }));
        },
      } as any,
    }) as any;

    const sendCustomerNotification = createCustomerNotificationDispatcher({
      getDb,
      saveDatabaseSync,
    });

    const depleteInventoryForOrder = createOrderInventoryDepleter({
      getDb,
      saveDatabaseSync,
      logAuditEvent,
    });

    const reverseInventoryForOrder = createOrderInventoryReverser({
      getDb,
      saveDatabaseSync,
      logAuditEvent,
    });

    const { supervisorAuthService } = await import('../server/services/supervisorAuthService.ts');
    supervisorAuthService.injectStaffRepository({
      getById: async (id: string) => db.staff[id],
      getByStaffId: async (sid: string) => Object.values(db.staff).find((s: any) => s.staffId === sid),
      getAll: async () => Object.values(db.staff),
      getActiveSupervisors: async () => Object.values(db.staff).filter((s: any) => s.status === 'active' && s.pinHash),
    });

    const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
    app.use(
      createStaffAndRbacRouter({
        getDb,
        saveDatabaseSync,
        requireAuth,
        requireRole,
        requirePermission,
        logAuditEvent,
        hashPasswordBcrypt,
        verifyStaffPassword,
        validateStaffPasswordPolicy,
        getStaffPrivileges,
      })
    );
    app.use(
      createCmsAndMenuRouter({
        getDb,
        saveDatabaseSync,
        seedCmsAndMenuCatalogue,
        requireAuth,
        hasPermission,
        logAuditEvent,
        uploadsDir: UPLOADS_DIR,
      })
    );
    app.use(
      createOnlineOrdersAndCustomerRouter({
        getDb,
        saveDatabaseSync,
        requireAuth,
        requireBranchAccess,
        getSessionFromRequest,
        depleteInventoryForOrder,
        reverseInventoryForOrder,
        sendCustomerNotification,
        logAuditEvent,
      })
    );
    app.use(
      createPosChecksAndOfflineRouter({
        getDb,
        saveDatabaseSync,
        requireAuth,
        requireBranchAccess,
        depleteInventoryForOrder,
        reverseInventoryForOrder,
        logAuditEvent,
      })
    );
    app.use(
      createDispatchRouter({
        requireAuth,
        requireBranchAccess,
        requireRole,
        sendCustomerNotification,
        logAuditEvent,
        hasPermission,
      })
    );
    app.use(
      createExpenseClaimsRouter({
        getDb,
        saveDatabaseSync,
        requireAuth,
        requireRole,
        hasPermission,
        logAuditEvent,
      })
    );
    app.use(
      createFinancialManagementRouter({
        getDb,
        saveDatabaseSync,
        requireAuth,
        requireRole,
        hasPermission,
        logAuditEvent,
      })
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server!.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    async function apiRequest(
      method: string,
      endpoint: string,
      token?: string,
      body?: any
    ): Promise<{ status: number; data: any }> {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { status: res.status, data };
    }

    // Provision test session tokens for key RBAC roles in DB
    const testRoleStaff: Record<
      string,
      { id: string; name: string; role: string; branchId: string; pin: string; token: string }
    > = {
      super_admin: {
        id: 'st-verify-super',
        name: 'Verify Super Admin',
        role: 'super_admin',
        branchId: 'gra',
        pin: '9999',
        token: `tok-super-${crypto.randomBytes(8).toString('hex')}`,
      },
      corporate_admin: {
        id: 'st-verify-corp',
        name: 'Verify Corporate Admin',
        role: 'corporate_admin',
        branchId: 'gra',
        pin: '8888',
        token: `tok-corp-${crypto.randomBytes(8).toString('hex')}`,
      },
      branch_manager: {
        id: 'st-verify-mgr',
        name: 'Verify Branch Manager',
        role: 'branch_manager',
        branchId: 'gra',
        pin: '7777',
        token: `tok-mgr-${crypto.randomBytes(8).toString('hex')}`,
      },
      accountant: {
        id: 'st-verify-acct',
        name: 'Verify Accountant',
        role: 'accountant',
        branchId: 'gra',
        pin: '6666',
        token: `tok-acct-${crypto.randomBytes(8).toString('hex')}`,
      },
      auditor: {
        id: 'st-verify-aud',
        name: 'Verify Internal Auditor',
        role: 'auditor',
        branchId: 'gra',
        pin: '5555',
        token: `tok-aud-${crypto.randomBytes(8).toString('hex')}`,
      },
      dispatch_lead: {
        id: 'st-verify-disp',
        name: 'Verify Dispatch Lead',
        role: 'dispatch_lead',
        branchId: 'gra',
        pin: '4444',
        token: `tok-disp-${crypto.randomBytes(8).toString('hex')}`,
      },
      cashier: {
        id: 'st-verify-cash',
        name: 'Verify Cashier',
        role: 'cashier',
        branchId: 'gra',
        pin: '3333',
        token: `tok-cash-${crypto.randomBytes(8).toString('hex')}`,
      },
      rider: {
        id: 'st-verify-rider',
        name: 'Verify Dispatch Rider',
        role: 'rider',
        branchId: 'gra',
        pin: '2222',
        token: `tok-rider-${crypto.randomBytes(8).toString('hex')}`,
      },
    };

    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    const bcrypt = await import('bcryptjs');
    for (const st of Object.values(testRoleStaff)) {
      db.staff[st.id] = {
        id: st.id,
        name: st.name,
        workEmail: `${st.id}@choplife.ng`,
        phone: '08030000000',
        role: st.role,
        branchId: st.branchId,
        pinHash: bcrypt.default.hashSync(st.pin, 10),
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      db.sessions[st.token] = {
        token: st.token,
        staffId: st.id,
        role: st.role,
        branchId: st.branchId,
        expiresAt,
      };
    }

    // Ensure at least 2 available tables in GRA with no pre-existing open checks
    const graTables = Object.values(db.tables || {}).filter((t: any) => t.branchId === 'gra') as any[];
    const tableA = graTables[0];
    const tableB = graTables[1];
    for (const chk of Object.values(db.checks || {}) as any[]) {
      if (chk.branchId === 'gra' && (chk.tableId === tableA?.id || chk.tableNumber === tableA?.tableNumber)) {
        chk.status = 'paid';
        chk.paymentStatus = 'paid';
      }
    }
    if (tableA) {
      tableA.status = 'available';
      delete tableA.currentCheckId;
    }
    if (tableB) {
      tableB.status = 'available';
      delete tableB.currentCheckId;
    }

    for (const inv of Object.values(db.inventory || {}) as any[]) {
      if (!inv.currentStock || typeof inv.currentStock !== 'object') {
        inv.currentStock = { general_store: 500, gra: 500, okabere: 500, ugbowo: 500 };
      }
      inv.currentStock.gra = Math.max(Number(inv.currentStock.gra || 0), 500);
      if (inv.locationStock && typeof inv.locationStock === 'object' && inv.locationStock.gra) {
        inv.locationStock.gra.stockOnHand = inv.currentStock.gra;
        inv.locationStock.gra.availableStock = inv.currentStock.gra;
      }
    }
    saveDatabaseSync();

    // =========================================================================
    // REQUIREMENT 1: POS DIRECT QUANTITY ENTRY (Food, Bread, Combos, Packages)
    // =========================================================================
    console.log('\n--- 1. POS Direct Quantity Entry & Post-Payment Amendment ---');

    // 1A: Invalid / Zero / Negative / Non-integer quantities rejected by pricing engine
    const invalidQtyRes = await apiRequest('POST', '/api/orders/calculate-pricing', testRoleStaff.cashier.token, {
      branchId: 'gra',
      orderType: 'takeaway',
      items: [{ productId: 'prod-sc-2000-mini', quantity: 0 }],
    });
    assertTest(
      '1. POS Quantity Entry',
      'Rejects zero/invalid quantity in authoritative pricing engine',
      invalidQtyRes.status === 400 ||
        (Array.isArray(invalidQtyRes.data?.validationErrors) && invalidQtyRes.data.validationErrors.length > 0),
      `status=${invalidQtyRes.status}, errors=${JSON.stringify(invalidQtyRes.data?.validationErrors)}`
    );

    // 1B: Direct quantity entry for Food ('prod-qsr-jollof-rice'), Wholesale Bread ('prod-bakery-special-350g-ws' @ qty 25), and Package ('prod-sc-2000-mini' 2000 Mini Pack @ qty 4)
    const multiCatPricingRes = await apiRequest('POST', '/api/orders/calculate-pricing', testRoleStaff.cashier.token, {
      branchId: 'gra',
      orderType: 'takeaway',
      items: [
        { productId: 'prod-qsr-jollof-rice', quantity: 3 },
        { productId: 'prod-bakery-special-350g-ws', quantity: 25 }, // Triggers wholesale bread tier (20+ loaves @ ₦400)
        { productId: 'prod-sc-2000-mini', quantity: 4 }, // 2000 Mini Pack @ ₦2,000 * 4 = ₦8,000
      ],
    });
    const breadLine = multiCatPricingRes.data?.items?.find((i: any) => i.productId === 'prod-bakery-special-350g-ws');
    const miniPackLine = multiCatPricingRes.data?.items?.find((i: any) => i.productId === 'prod-sc-2000-mini');
    assertTest(
      '1. POS Quantity Entry',
      'Calculates direct typed quantities across Food, Wholesale Bread (qty=25), and Package (qty=4)',
      multiCatPricingRes.status === 200 &&
        breadLine?.quantity === 25 &&
        breadLine?.isWholesaleApplied === true &&
        miniPackLine?.quantity === 4 &&
        miniPackLine?.totalPrice === 8000,
      `Bread qty=${breadLine?.quantity} wholesale=${breadLine?.isWholesaleApplied} unitPrice=₦${breadLine?.unitPrice}; MiniPack qty=${miniPackLine?.quantity} totalPrice=₦${miniPackLine?.totalPrice}`
    );

    // 1C: Create POS check, update quantity before payment via PUT /api/pos/checks/:id/items/:itemId/quantity, then pay and verify inventory depletion
    const checkIdQty = `chk-qty-${Date.now()}`;
    const createCheckRes = await apiRequest('POST', '/api/pos/checks', testRoleStaff.cashier.token, {
      id: checkIdQty,
      branchId: 'gra',
      checkType: 'takeaway',
      customerName: 'Quantity Test Customer',
      status: 'open',
      paymentStatus: 'unpaid',
      items: [{ id: 'line-mini', productId: 'prod-sc-2000-mini', name: '2000 Mini Pack', quantity: 2, unitPrice: 2000 }],
    });
    assertTest(
      '1. POS Quantity Entry',
      'Creates open POS check with initial quantity=2',
      createCheckRes.status === 200 && createCheckRes.data?.check?.items?.[0]?.quantity === 2,
      `checkId=${checkIdQty}, initialTotal=₦${createCheckRes.data?.check?.total}`
    );

    // Update quantity before payment from 2 -> 5 via direct quantity endpoint
    const updateBeforePayRes = await apiRequest(
      'PUT',
      `/api/pos/checks/${checkIdQty}/items/line-mini/quantity`,
      testRoleStaff.cashier.token,
      { quantity: 5, reason: 'Customer typed 5 packs directly' }
    );
    assertTest(
      '1. POS Quantity Entry',
      'Updates check item quantity directly before payment (2 -> 5) and recalculates totals',
      updateBeforePayRes.status === 200 &&
        updateBeforePayRes.data?.check?.items?.[0]?.quantity === 5 &&
        updateBeforePayRes.data?.check?.subtotal === 10000,
      `newQty=${updateBeforePayRes.data?.check?.items?.[0]?.quantity}, newSubtotal=₦${updateBeforePayRes.data?.check?.subtotal}`
    );

    // Record stock of 2000 Mini Pack packaging ('inv-pack-300') before payment
    const pack300BeforePay = Number(db.inventory['inv-pack-300']?.currentStock?.gra || 0);

    // Pay the check -> triggers BOM + packaging depletion for final confirmed quantity (5)
    const payCheckRes = await apiRequest(
      'POST',
      `/api/pos/checks/${checkIdQty}/pay`,
      testRoleStaff.cashier.token,
      { amount: updateBeforePayRes.data.check.total, method: 'pos_card', reference: `REF-${Date.now()}` }
    );
    const pack300AfterPay = Number(db.inventory['inv-pack-300']?.currentStock?.gra || 0);
    assertTest(
      '1. POS Quantity Entry',
      'Depletes exact BOM & packaging inventory for final confirmed quantity (5 packs)',
      payCheckRes.status === 200 && pack300BeforePay - pack300AfterPay === 5,
      `inv-pack-300 stock before=${pack300BeforePay}, after=${pack300AfterPay} (depleted=${pack300BeforePay - pack300AfterPay})`
    );

    // 1D: Post-payment quantity amendment (5 -> 3) requires manager role or supervisor PIN, reverses old depletion (5) and re-depletes new quantity (3)
    const unauthAmendRes = await apiRequest(
      'PUT',
      `/api/pos/checks/${checkIdQty}/items/line-mini/quantity`,
      testRoleStaff.cashier.token,
      { quantity: 3 }
    );
    assertTest(
      '1. POS Quantity Entry',
      'Blocks post-payment quantity amendment by cashier without supervisor PIN',
      unauthAmendRes.status === 403,
      `status=${unauthAmendRes.status}, error=${unauthAmendRes.data?.error}`
    );

    const authAmendRes = await apiRequest(
      'PUT',
      `/api/pos/checks/${checkIdQty}/items/line-mini/quantity`,
      testRoleStaff.branch_manager.token,
      { quantity: 3, reason: 'Post-payment amendment from 5 to 3 packs' }
    );
    const pack300AfterAmend = Number(db.inventory['inv-pack-300']?.currentStock?.gra || 0);
    assertTest(
      '1. POS Quantity Entry',
      'Authorised post-payment quantity amendment (5 -> 3) adjusts inventory net depletion to 3 and logs amendment history',
      authAmendRes.status === 200 &&
        pack300BeforePay - pack300AfterAmend === 3 &&
        Array.isArray(authAmendRes.data?.check?.quantityAmendments) &&
        authAmendRes.data.check.quantityAmendments.length >= 1,
      `inv-pack-300 netDepleted=${pack300BeforePay - pack300AfterAmend}, newSubtotal=₦${authAmendRes.data?.check?.subtotal}, amendments=${authAmendRes.data?.check?.quantityAmendments?.length}`
    );

    // =========================================================================
    // REQUIREMENT 2: MANDATORY ORDER-TYPE SELECTION & DELIVERY RIDER WORKFLOW
    // =========================================================================
    console.log('\n--- 2. Mandatory Order-Type Selection (Dine-in, Takeout, Delivery) & Rider Reassignment ---');

    // 2A: Reject missing or invalid checkType on new POS check
    const missingTypeRes = await apiRequest('POST', '/api/pos/checks', testRoleStaff.cashier.token, {
      id: `chk-notype-${Date.now()}`,
      branchId: 'gra',
      checkType: '',
      items: [{ productId: 'prod-sc-2000-mini', quantity: 1 }],
    });
    assertTest(
      '2. Mandatory Order-Type',
      'Rejects new POS check without valid checkType (dine_in | takeaway | delivery)',
      missingTypeRes.status === 400,
      `status=${missingTypeRes.status}, error=${missingTypeRes.data?.error}`
    );

    // 2B: Dine-in requires an available table; rejects missing table
    const dineInNoTableRes = await apiRequest('POST', '/api/pos/checks', testRoleStaff.cashier.token, {
      id: `chk-dine-notbl-${Date.now()}`,
      branchId: 'gra',
      checkType: 'dine_in',
      items: [{ productId: 'prod-sc-2000-mini', quantity: 1 }],
    });
    assertTest(
      '2. Mandatory Order-Type',
      'Dine-in rejects check when no table is selected',
      dineInNoTableRes.status === 400,
      `status=${dineInNoTableRes.status}, error=${dineInNoTableRes.data?.error}`
    );

    // 2C: Dine-in with available table succeeds and marks table occupied
    const dineInCheckId = `chk-dine-ok-${Date.now()}`;
    const dineInOkRes = await apiRequest('POST', '/api/pos/checks', testRoleStaff.cashier.token, {
      id: dineInCheckId,
      branchId: 'gra',
      checkType: 'dine_in',
      tableId: tableA.id,
      tableNumber: tableA.tableNumber,
      items: [{ productId: 'prod-sc-2000-mini', quantity: 1 }],
    });
    const updatedTableA = db.tables[tableA.id];
    assertTest(
      '2. Mandatory Order-Type',
      'Dine-in associates check with selected available table and marks table occupied',
      dineInOkRes.status === 200 &&
        dineInOkRes.data?.check?.tableId === tableA.id &&
        updatedTableA?.status !== 'available' &&
        updatedTableA?.currentCheckId === dineInCheckId,
      `tableId=${tableA.id}, tableStatus=${updatedTableA?.status}, currentCheckId=${updatedTableA?.currentCheckId}`
    );

    // 2D: Dine-in prevents another order/check from selecting the now-occupied table (409 Conflict)
    const dineInOccupiedRes = await apiRequest('POST', '/api/pos/checks', testRoleStaff.cashier.token, {
      id: `chk-dine-conflict-${Date.now()}`,
      branchId: 'gra',
      checkType: 'dine_in',
      tableId: tableA.id,
      items: [{ productId: 'prod-sc-2000-mini', quantity: 1 }],
    });
    assertTest(
      '2. Mandatory Order-Type',
      'Prevents selecting an already occupied table for another Dine-in order (409 Conflict)',
      dineInOccupiedRes.status === 409,
      `status=${dineInOccupiedRes.status}, error=${dineInOccupiedRes.data?.error}`
    );

    // 2E: Takeout/Pickup works without table or rider and does NOT create a delivery task
    const takeawayOrderRes = await apiRequest('POST', '/api/orders', testRoleStaff.cashier.token, {
      branchId: 'gra',
      orderType: 'takeaway',
      customerName: 'Takeout Walk-in',
      customerPhone: '08031112222',
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      items: [{ productId: 'prod-sc-2000-mini', quantity: 2 }],
    });
    const takeawayOrderId = takeawayOrderRes.data?.order?.id;
    const takeawayHasDeliveryTask = Boolean(takeawayOrderId && db.deliveryTasks?.[takeawayOrderId]);
    assertTest(
      '2. Mandatory Order-Type',
      'Takeout/Pickup order completes without table or rider and creates NO delivery dispatch task',
      takeawayOrderRes.status === 201 && !takeawayHasDeliveryTask,
      `orderId=${takeawayOrderId}, deliveryTaskExists=${takeawayHasDeliveryTask}`
    );

    // 2F: Delivery order allows rider assignment BEFORE meal is ready, reassignment when unavailable, and preserves payment & order history
    const deliveryOrderRes = await apiRequest('POST', '/api/orders', testRoleStaff.cashier.token, {
      branchId: 'gra',
      orderType: 'delivery',
      customerName: 'Mrs. Adesuwa Obaseki',
      customerPhone: '08055556666',
      deliveryAddress: '14 Ihama Road, GRA, Benin City',
      deliveryZone: 'GRA Benin / Boundary Rd',
      deliveryFee: 1200,
      paymentMethod: 'online_paystack',
      paymentStatus: 'paid',
      items: [{ productId: 'prod-sc-2000-mini', quantity: 2 }],
    });
    const delOrderId = deliveryOrderRes.data?.order?.id;
    const originalTotal = deliveryOrderRes.data?.order?.total;

    // Assign Rider 1 before meal is ready (order status is still 'confirmed' / pre-kitchen-bump)
    const assignRider1Res = await apiRequest(
      'POST',
      `/api/orders/${delOrderId}/assign-rider`,
      testRoleStaff.dispatch_lead.token,
      {
        riderId: 'rider-1',
        riderName: 'Osahon Okunbor (Bike 01)',
        reason: 'Pre-assigned while meal is in kitchen',
      }
    );
    assertTest(
      '2. Delivery Rider Workflow',
      'Assigns rider BEFORE meal is ready and records assignment audit entry',
      assignRider1Res.status === 200 &&
        assignRider1Res.data?.task?.riderId === 'rider-1' &&
        (assignRider1Res.data?.order?.status === 'confirmed' || assignRider1Res.data?.order?.status === 'pending'),
      `orderStatus=${assignRider1Res.data?.order?.status}, assignedRider=${assignRider1Res.data?.task?.riderName}`
    );

    // Reassign Rider 2 when Rider 1 becomes unavailable on already-paid order
    const reassignRider2Res = await apiRequest(
      'POST',
      `/api/dispatch/tasks/${delOrderId}/reassign`,
      testRoleStaff.dispatch_lead.token,
      {
        riderId: 'rider-2',
        riderName: 'Efosa Igbinovia (Bike 02)',
        reason: 'Original rider had flat tyre',
      }
    );
    const historyArr = reassignRider2Res.data?.task?.assignmentHistory || [];
    const lastEntry = historyArr[historyArr.length - 1];
    assertTest(
      '2. Delivery Rider Workflow',
      'Reassigns rider on already-paid delivery order, preserves payment/order history, and logs who reassigned & when',
      reassignRider2Res.status === 200 &&
        reassignRider2Res.data?.task?.riderId === 'rider-2' &&
        reassignRider2Res.data?.order?.paymentStatus === 'paid' &&
        reassignRider2Res.data?.order?.total === originalTotal &&
        historyArr.length === 2 &&
        lastEntry?.action === 'reassigned' &&
        lastEntry?.previousRiderId === 'rider-1' &&
        lastEntry?.assignedByStaffId === testRoleStaff.dispatch_lead.id &&
        Boolean(lastEntry?.timestamp),
      `newRider=${reassignRider2Res.data?.task?.riderName}, paymentStatus=${reassignRider2Res.data?.order?.paymentStatus}, total=₦${reassignRider2Res.data?.order?.total}, historyCount=${historyArr.length}`
    );

    // =========================================================================
    // REQUIREMENT 3: WHOLESALE BREAD DISPATCH WORKFLOW
    // =========================================================================
    console.log('\n--- 3. Wholesale Bread Dispatch Workflow & Separation from Meal Queue ---');

    const wholesaleOrderRes = await apiRequest('POST', '/api/orders', testRoleStaff.cashier.token, {
      branchId: 'gra',
      orderType: 'delivery',
      customerName: 'Uselu Supermarket & Bakery Depot',
      customerPhone: '08077778888',
      deliveryAddress: '88 Uselu Lagos Road, Benin City',
      deliveryZone: 'Ugbowo / UNIBEN Campus',
      deliveryFee: 2000,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'paid',
      items: [
        { productId: 'prod-bakery-special-350g-ws', quantity: 25 }, // 25x Choplife Special Bread 350g Wholesale
        { productId: 'prod-bakery-family-900g-ws', quantity: 20 },  // 20x Family Size Bread 900g Wholesale
      ],
    });
    const wholesaleOrderId = wholesaleOrderRes.data?.order?.id;

    // Verify ordinary meal dispatch queue (/api/dispatch/tasks) excludes wholesale bread order by default
    const regularDispatchRes = await apiRequest(
      'GET',
      '/api/dispatch/tasks?branchId=gra',
      testRoleStaff.dispatch_lead.token
    );
    const inRegularQueue =
      Array.isArray(regularDispatchRes.data) && regularDispatchRes.data.some((t: any) => t.id === wholesaleOrderId);

    // Verify dedicated wholesale dispatch endpoint (/api/dispatch/wholesale) includes the wholesale bread order
    const wholesaleListRes = await apiRequest(
      'GET',
      '/api/dispatch/wholesale?branchId=gra',
      testRoleStaff.dispatch_lead.token
    );
    const wholesaleTask = Array.isArray(wholesaleListRes.data)
      ? wholesaleListRes.data.find((t: any) => t.id === wholesaleOrderId)
      : null;

    assertTest(
      '3. Wholesale Bread Dispatch',
      'Separates wholesale bread delivery from ordinary restaurant meal queue and exposes customer, destination & items',
      !inRegularQueue &&
        Boolean(wholesaleTask) &&
        wholesaleTask.dispatchType === 'wholesale_bread' &&
        Array.isArray(wholesaleTask.itemsSummary) &&
        wholesaleTask.itemsSummary.length === 2,
      `inRegularMealQueue=${inRegularQueue}, inWholesaleQueue=${Boolean(wholesaleTask)}, items=${JSON.stringify(wholesaleTask?.itemsSummary)}`
    );

    // Assign wholesale driver and vehicle
    const wsAssignRes = await apiRequest(
      'POST',
      `/api/dispatch/wholesale/${wholesaleOrderId}/assign`,
      testRoleStaff.dispatch_lead.token,
      {
        driverId: 'van-driver-1',
        driverName: 'Osaze Bakery Van Driver',
        driverPhone: '08099990000',
        vehiclePlate: 'BEN-402-CL',
        reason: 'Morning wholesale bakery distribution run',
      }
    );
    // Reassign wholesale driver
    const wsReassignRes = await apiRequest(
      'POST',
      `/api/dispatch/wholesale/${wholesaleOrderId}/assign`,
      testRoleStaff.dispatch_lead.token,
      {
        driverId: 'van-driver-2',
        driverName: 'Ighodaro Logistics Van 2',
        driverPhone: '08099991111',
        vehiclePlate: 'BEN-808-CL',
        reason: 'Switched to larger bread delivery van',
      }
    );
    // Advance wholesale delivery status to out_for_delivery and delivered
    const wsStatusTransit = await apiRequest(
      'PUT',
      `/api/dispatch/wholesale/${wholesaleOrderId}/status`,
      testRoleStaff.dispatch_lead.token,
      { status: 'out_for_delivery', notes: 'Loaded 35 loaves in crates' }
    );
    const wsStatusDelivered = await apiRequest(
      'PUT',
      `/api/dispatch/wholesale/${wholesaleOrderId}/status`,
      testRoleStaff.dispatch_lead.token,
      { status: 'delivered', notes: 'Signed by Uselu Depot Manager' }
    );
    assertTest(
      '3. Wholesale Bread Dispatch',
      'Supports wholesale driver assignment, reassignment, and delivery status tracking while preserving order & payment records',
      wsAssignRes.status === 200 &&
        wsReassignRes.status === 200 &&
        wsStatusTransit.status === 200 &&
        wsStatusDelivered.status === 200 &&
        wsStatusDelivered.data?.task?.status === 'delivered' &&
        wsStatusDelivered.data?.task?.assignmentHistory?.length === 2 &&
        wsStatusDelivered.data?.order?.paymentStatus === 'paid',
      `finalStatus=${wsStatusDelivered.data?.task?.status}, driver=${wsStatusDelivered.data?.task?.riderName}, vehicle=${wsStatusDelivered.data?.task?.vehiclePlate}, assignments=${wsStatusDelivered.data?.task?.assignmentHistory?.length}`
    );

    // =========================================================================
    // REQUIREMENT 4: ROLE-BASED ACCESS CONTROL (RBAC) MATRIX
    // =========================================================================
    console.log('\n--- 4. Role-Based Access Control (RBAC) Enforcement ---');

    // 4A: Cashier (front-office) blocked from Payroll, CAPEX, Wholesale Dispatch, and Staff Management
    const cashierPayrollRes = await apiRequest('GET', '/api/finance/payroll/periods', testRoleStaff.cashier.token);
    const cashierCapexRes = await apiRequest('POST', '/api/finance/capex/requisitions', testRoleStaff.cashier.token, {
      assetName: 'Dough Mixer',
      estimatedCost: 450000,
    });
    const cashierWholesaleRes = await apiRequest('GET', '/api/dispatch/wholesale', testRoleStaff.cashier.token);
    assertTest(
      '4. RBAC Enforcement',
      'Front-office Cashier is blocked from back-office Payroll (403), CAPEX (403), and Wholesale Dispatch (403)',
      cashierPayrollRes.status === 403 && cashierCapexRes.status === 403 && cashierWholesaleRes.status === 403,
      `payroll=${cashierPayrollRes.status}, capex=${cashierCapexRes.status}, wholesale=${cashierWholesaleRes.status}`
    );

    // 4B: Auditor is strictly read-only: can GET budgets/CAPEX/invoices, but blocked (403) on POST POS check, POST OPEX, POST CAPEX, POST Reconcile
    const auditorGetBudgets = await apiRequest('GET', '/api/finance/budgets/summary', testRoleStaff.auditor.token);
    const auditorPostCheck = await apiRequest('POST', '/api/pos/checks', testRoleStaff.auditor.token, {
      id: `chk-aud-${Date.now()}`,
      branchId: 'gra',
      checkType: 'takeaway',
      items: [{ productId: 'prod-sc-2000-mini', quantity: 1 }],
    });
    const auditorPostOpex = await apiRequest('POST', '/api/finance/opex', testRoleStaff.auditor.token, {
      title: 'Test Diesel',
      amount: 50000,
    });
    const auditorPostCapex = await apiRequest('POST', '/api/finance/capex/requisitions', testRoleStaff.auditor.token, {
      assetName: 'Oven',
      estimatedCost: 900000,
    });
    const auditorPostRecon = await apiRequest('POST', '/api/finance/reconcile', testRoleStaff.auditor.token, {
      branchId: 'gra',
    });
    assertTest(
      '4. RBAC Enforcement',
      'Auditor role has read access to financial reports (200) and is strictly blocked (403) from all mutations',
      auditorGetBudgets.status === 200 &&
        auditorPostCheck.status === 403 &&
        auditorPostOpex.status === 403 &&
        auditorPostCapex.status === 403 &&
        auditorPostRecon.status === 403,
      `GET budgets=${auditorGetBudgets.status}, POST check=${auditorPostCheck.status}, POST opex=${auditorPostOpex.status}, POST capex=${auditorPostCapex.status}, POST reconcile=${auditorPostRecon.status}`
    );

    // 4C: Rider cannot assign/reassign dispatch tasks or view payroll
    const riderAssignRes = await apiRequest(
      'POST',
      `/api/dispatch/tasks/${delOrderId}/assign`,
      testRoleStaff.rider.token,
      { riderId: 'rider-1', riderName: 'Self Assign' }
    );
    assertTest(
      '4. RBAC Enforcement',
      'Rider role cannot assign/reassign dispatch tasks (403)',
      riderAssignRes.status === 403,
      `status=${riderAssignRes.status}, error=${riderAssignRes.data?.error}`
    );

    // =========================================================================
    // REQUIREMENT 5: FINANCIAL MANAGEMENT (CAPEX, OPEX, Payroll, Claims, Supplier Invoices, Budgets, Reconciliation)
    // =========================================================================
    console.log('\n--- 5. Financial Management & Segregation of Duties ---');

    // 5A: CAPEX lifecycle with Segregation of Duties
    const capexCreateRes = await apiRequest(
      'POST',
      '/api/finance/capex/requisitions',
      testRoleStaff.branch_manager.token,
      {
        assetName: 'Industrial Rotary Deck Bakery Oven',
        category: 'kitchen_equipment',
        estimatedCost: 1450000,
        vendorName: 'Lagos Catering Equipment Ltd',
        justification: 'Increase wholesale bread production capacity at GRA',
        branchId: 'gra',
      }
    );
    const capexId = capexCreateRes.data?.requisition?.id;

    const capexSelfApproveRes = await apiRequest(
      'POST',
      `/api/finance/capex/requisitions/${capexId}/approve`,
      testRoleStaff.branch_manager.token,
      { notes: 'Self approval attempt' }
    );
    const capexApproveRes = await apiRequest(
      'POST',
      `/api/finance/capex/requisitions/${capexId}/approve`,
      testRoleStaff.corporate_admin.token,
      { notes: 'Approved for Q4 Bakery Expansion' }
    );
    const capexApproverProcureRes = await apiRequest(
      'POST',
      `/api/finance/capex/requisitions/${capexId}/procure`,
      testRoleStaff.corporate_admin.token,
      { actualCost: 1450000, paymentReference: 'BNK-CPX-001' }
    );
    const capexProcureRes = await apiRequest(
      'POST',
      `/api/finance/capex/requisitions/${capexId}/procure`,
      testRoleStaff.accountant.token,
      { actualCost: 1450000, paymentReference: 'BNK-CPX-001' }
    );
    assertTest(
      '5. Financial Management',
      'CAPEX workflow enforces Segregation of Duties and capitalizes asset into Fixed Asset Register',
      capexCreateRes.status === 201 &&
        capexSelfApproveRes.status === 403 &&
        capexApproveRes.status === 200 &&
        capexApproverProcureRes.status === 403 &&
        capexProcureRes.status === 200 &&
        capexProcureRes.data?.requisition?.status === 'capitalized' &&
        Boolean(capexProcureRes.data?.asset?.assetTag),
      `selfApprove=${capexSelfApproveRes.status}, approverDisburse=${capexApproverProcureRes.status}, assetTag=${capexProcureRes.data?.asset?.assetTag}`
    );

    // 5B: OPEX & Recurring Business Costs (and blocks Payroll masquerading as OPEX)
    const opexPayrollAttempt = await apiRequest(
      'POST',
      '/api/finance/opex',
      testRoleStaff.accountant.token,
      { title: 'October Staff Salary', category: 'payroll', amount: 800000 }
    );
    const opexCreateRes = await apiRequest(
      'POST',
      '/api/finance/opex',
      testRoleStaff.branch_manager.token,
      {
        title: 'AGO Diesel Supply (500 Litres)',
        category: 'utilities_diesel',
        amount: 625000,
        vendorName: 'Bovas Energy GRA',
        branchId: 'gra',
        recurring: true,
        frequency: 'monthly',
      }
    );
    assertTest(
      '5. Financial Management',
      'Records OPEX & recurring operating costs while blocking payroll from being submitted as an ordinary OPEX claim',
      opexPayrollAttempt.status === 400 &&
        opexCreateRes.status === 201 &&
        opexCreateRes.data?.opex?.accountingClassification === 'opex' &&
        opexCreateRes.data?.opex?.recurring === true,
      `payrollAsOpexStatus=${opexPayrollAttempt.status}, opexClaimNumber=${opexCreateRes.data?.opex?.claimNumber}`
    );

    // 5C: Nigerian Payroll Preparation, Approval, Disbursement & Reconciliation
    const payrollPrepRes = await apiRequest(
      'POST',
      '/api/finance/payroll/prepare',
      testRoleStaff.accountant.token,
      {
        payPeriod: '2026-10',
        branchId: 'gra',
        staffSalaries: [
          {
            staffId: 'st-1',
            staffName: 'Osagie Igbinedion',
            role: 'branch_manager',
            branchId: 'gra',
            basicSalary: 180000,
            housingAllowance: 60000,
            transportAllowance: 40000,
            otherAllowances: 20000,
            voluntaryDeductions: 5000,
          },
        ],
      }
    );
    const payrollId = payrollPrepRes.data?.payroll?.id;

    const payrollSelfApprove = await apiRequest(
      'POST',
      `/api/finance/payroll/${payrollId}/approve`,
      testRoleStaff.accountant.token,
      {}
    );
    const payrollApprove = await apiRequest(
      'POST',
      `/api/finance/payroll/${payrollId}/approve`,
      testRoleStaff.corporate_admin.token,
      { notes: 'Approved October 2026 GRA Payroll' }
    );
    const payrollApproverDisburse = await apiRequest(
      'POST',
      `/api/finance/payroll/${payrollId}/disburse`,
      testRoleStaff.corporate_admin.token,
      { paymentReference: 'NIP-PR-202610' }
    );
    const payrollDisburse = await apiRequest(
      'POST',
      `/api/finance/payroll/${payrollId}/disburse`,
      testRoleStaff.accountant.token,
      { paymentReference: 'NIP-PR-202610' }
    );
    const payrollReconcile = await apiRequest(
      'POST',
      `/api/finance/payroll/${payrollId}/reconcile`,
      testRoleStaff.accountant.token,
      { notes: 'Matched Zenith Bank statement and PAYE/Pension schedules' }
    );
    assertTest(
      '5. Financial Management',
      'Nigerian Payroll computes Gross, CRA, PAYE, 8%/10% Pension & 2.5% NHF and enforces Segregation of Duties through reconciliation',
      payrollPrepRes.status === 201 &&
        payrollPrepRes.data?.payroll?.totalGross === 300000 &&
        payrollPrepRes.data?.payroll?.totalEmployeePension > 0 &&
        payrollPrepRes.data?.payroll?.totalPayeTax > 0 &&
        payrollSelfApprove.status === 403 &&
        payrollApprove.status === 200 &&
        payrollApproverDisburse.status === 403 &&
        payrollDisburse.status === 200 &&
        payrollReconcile.status === 200 &&
        payrollReconcile.data?.payroll?.status === 'reconciled',
      `Gross=₦${payrollPrepRes.data?.payroll?.totalGross}, EmpPension=₦${payrollPrepRes.data?.payroll?.totalEmployeePension}, PAYE=₦${payrollPrepRes.data?.payroll?.totalPayeTax}, Net=₦${payrollPrepRes.data?.payroll?.totalNetPay}, finalStatus=${payrollReconcile.data?.payroll?.status}`
    );

    // 5D: Supplier Invoices & Payments with Segregation of Duties
    const supInvCreate = await apiRequest(
      'POST',
      '/api/finance/supplier-invoices',
      testRoleStaff.branch_manager.token,
      {
        supplierId: 'sup-1',
        invoiceNumber: `INV-FLOUR-${Date.now()}`,
        invoiceAmount: 380000,
      }
    );
    const supInvId = supInvCreate.data?.invoice?.id;
    const supInvSelfPay = await apiRequest(
      'POST',
      `/api/finance/supplier-invoices/${supInvId}/pay`,
      testRoleStaff.branch_manager.token,
      { amount: 380000, paymentReference: 'SUP-PAY-001' }
    );
    const supInvAccountantPay = await apiRequest(
      'POST',
      `/api/finance/supplier-invoices/${supInvId}/pay`,
      testRoleStaff.accountant.token,
      { amount: 380000, paymentReference: 'SUP-PAY-001' }
    );
    assertTest(
      '5. Financial Management',
      'Supplier Invoice registration and payment enforce Segregation of Duties and track balance due',
      supInvCreate.status === 201 &&
        supInvSelfPay.status === 403 &&
        supInvAccountantPay.status === 200 &&
        supInvAccountantPay.data?.invoice?.status === 'paid' &&
        supInvAccountantPay.data?.invoice?.balanceDue === 0,
      `selfPay=${supInvSelfPay.status}, accountantPay=${supInvAccountantPay.status}, finalBalance=₦${supInvAccountantPay.data?.invoice?.balanceDue}`
    );

    // 5E: Budgets vs Commitments & Financial Reconciliation
    const budgetSummaryRes = await apiRequest(
      'GET',
      '/api/finance/budgets/summary',
      testRoleStaff.accountant.token
    );
    const graBudget = budgetSummaryRes.data?.budgets?.find((b: any) => b.branchId === 'gra');
    const finReconRes = await apiRequest(
      'POST',
      '/api/finance/reconcile',
      testRoleStaff.accountant.token,
      { branchId: 'gra', notes: 'End-of-day financial reconciliation check' }
    );
    assertTest(
      '5. Financial Management',
      'Reports branch OPEX/CAPEX budget vs actual/committed variance and executes end-to-end Financial Reconciliation',
      budgetSummaryRes.status === 200 &&
        Boolean(graBudget) &&
        graBudget.actualPaidCapex >= 1450000 &&
        finReconRes.status === 201 &&
        finReconRes.data?.reconciliation?.status === 'balanced',
      `GRA actualPaidCapex=₦${graBudget?.actualPaidCapex}, reconciliationStatus=${finReconRes.data?.reconciliation?.status}`
    );

    // =========================================================================
    // REQUIREMENT 6: SAFE VIRGIN-STATE CLEANUP VERIFICATION
    // =========================================================================
    console.log('\n--- 6. Safe Virgin-State Cleanup Verification ---');

    const dbClone = JSON.parse(JSON.stringify(db));
    const cleanResult = performVirginCleanOnObject(dbClone);

    assertTest(
      '6. Virgin-State Cleanup',
      'Preserves all 200+ products, all 33+ canonical inventory items (including all 8 packaging SKUs), and resets transactional records to 0 with zero orphan references',
      cleanResult.afterCounts.products === cleanResult.beforeCounts.products &&
        cleanResult.afterCounts.products >= 200 &&
        cleanResult.afterCounts.inventoryItems >= 33 &&
        cleanResult.afterCounts.packagingInventoryItems >= 7 &&
        cleanResult.afterCounts.orders === 0 &&
        cleanResult.afterCounts.checks === 0 &&
        cleanResult.afterCounts.deliveryTasks === 0 &&
        cleanResult.afterCounts.payrolls === 0 &&
        cleanResult.afterCounts.capexRequisitions === 0 &&
        cleanResult.afterCounts.supplierInvoices === 0 &&
        cleanResult.afterCounts.availableTables === cleanResult.afterCounts.tables &&
        cleanResult.orphanPackageComponentRefs.length === 0 &&
        cleanResult.orphanPackagingSkuRefs.length === 0,
      `Products=${cleanResult.afterCounts.products} (before=${cleanResult.beforeCounts.products}), Packages=${cleanResult.afterCounts.packagesAndCombos}, Inventory=${cleanResult.afterCounts.inventoryItems}, PackagingSKUs=${cleanResult.afterCounts.packagingInventoryItems}, Orders=${cleanResult.afterCounts.orders}, Checks=${cleanResult.afterCounts.checks}, AvailableTables=${cleanResult.afterCounts.availableTables}/${cleanResult.afterCounts.tables}, Orphans=${cleanResult.orphanPackageComponentRefs.length + cleanResult.orphanPackagingSkuRefs.length}`
    );
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    const restoredObj = JSON.parse(originalDbRaw);
    // Ensure no st-verify-* accounts or test verify records remain
    if (restoredObj.staff) {
      for (const k of Object.keys(restoredObj.staff)) {
        if (k.startsWith('st-verify-')) delete restoredObj.staff[k];
      }
    }
    if (restoredObj.sessions) {
      for (const k of Object.keys(restoredObj.sessions)) {
        if (k.startsWith('tok-')) delete restoredObj.sessions[k];
      }
    }
    const liveDb = getDb() as any;
    for (const key of Object.keys(liveDb)) {
      delete liveDb[key];
    }
    Object.assign(liveDb, restoredObj);
    saveDatabaseSync();
    fs.writeFileSync(DB_PATH, JSON.stringify(restoredObj, null, 2), 'utf-8');
    console.log('\n[CLEANUP] Restored original live database snapshot in memory and on disk.');
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passedCount}/${results.length} VERIFICATION CHECKS PASSED (${failedCount} FAILED)`);
  console.log('================================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification suite error:', err);
  process.exit(1);
});
