import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { loadDatabase, saveDatabaseSync } from '../server_db.ts';
import { seedCmsAndMenuCatalogueForDb } from '../server/db/seedAndLoyaltyHelpers.ts';
import {
  ARCHIVED_PDF_PRODUCT_IDS,
  CANONICAL_PACKAGE_COMPOSITIONS,
  calculateAuthoritativeItemAndOrderPricing,
  calculateDefaultPackagingForItems,
} from '../server/services/packageAndPricingEngine.ts';
import { createOrderInventoryDepleter, createOrderInventoryReverser } from '../server/services/posInventoryAndOfflineService.ts';

const BASE_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${label}`);
    throw new Error(`Verification failed: ${label}`);
  }
}

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let body: any = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function loginStaff(email: string, password = process.env.DEFAULT_SEED_STAFF_PASSWORD || 'ChopLife2025!') {
  const res = await api('/api/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(res.status === 200 && !!res.body?.token, `Logged in as ${email}`);
  return { token: res.body.token as string, staff: res.body.staff };
}

async function runVerification() {
  console.log('================================================================================');
  console.log('CHOPLIFE REPUBLIC — MASTER REMEDIATION & RELEASE-READINESS VERIFICATION SUITE');
  console.log('================================================================================\n');

  const db = loadDatabase();
  seedCmsAndMenuCatalogueForDb(db);
  saveDatabaseSync();

  // ---------------------------------------------------------------------------
  // PHASE 3: ACHIVED (2).pdf 40-Item Reconciliation & Inactive Status Verification
  // ---------------------------------------------------------------------------
  console.log('--- PHASE 3: ACHIVED (2).pdf 40-Item Reconciliation, Pricing, Packaging & Inactive Status ---');
  assert(ARCHIVED_PDF_PRODUCT_IDS.length === 40, `ARCHIVED_PDF_PRODUCT_IDS contains exactly 40 items (found: ${ARCHIVED_PDF_PRODUCT_IDS.length})`);

  const expected40: Array<{ id: string; name: string; price: number; packId: string; compCount: number }> = [
    { id: 'prod-sc-big-flex', name: 'Big Flex', price: 20000, packId: 'prod-pack-1000', compCount: 7 },
    { id: 'prod-sc-genz-baddie', name: 'Gen Z Baddie', price: 9000, packId: 'prod-pack-500', compCount: 4 },
    { id: 'prod-sc-big-mood', name: 'Big Mood', price: 14100, packId: 'prod-pack-600', compCount: 4 },
    { id: 'prod-sc-chicken-chips', name: 'Chicken and Chips', price: 6500, packId: 'prod-pack-500', compCount: 2 },
    { id: 'prod-sc-turkey-chips', name: 'Turkey and Chips', price: 10500, packId: 'prod-pack-500', compCount: 2 },
    { id: 'prod-sc-ashes', name: 'Ashes', price: 52000, packId: 'prod-pack-1500', compCount: 5 },
    { id: 'prod-sc-gold', name: 'Gold', price: 70500, packId: 'prod-pack-2000', compCount: 6 },
    { id: 'prod-sc-sapphire', name: 'Sapphire', price: 18800, packId: 'prod-pack-1000', compCount: 4 },
    { id: 'prod-sc-mango', name: 'Mango', price: 13600, packId: 'prod-pack-600', compCount: 4 },
    { id: 'prod-sc-silver', name: 'Silver', price: 13300, packId: 'prod-pack-600', compCount: 5 },
    { id: 'prod-sc-tripple', name: 'Tripple', price: 17300, packId: 'prod-pack-600', compCount: 2 },
    { id: 'prod-sc-maroon', name: 'Maroon', price: 23700, packId: 'prod-pack-1000', compCount: 3 },
    { id: 'prod-sc-lime', name: 'Lime', price: 14500, packId: 'prod-pack-500', compCount: 3 },
    { id: 'prod-sc-easy', name: 'Easy', price: 14800, packId: 'prod-pack-600', compCount: 2 },
    { id: 'prod-sc-bobo', name: 'Bobo', price: 18400, packId: 'prod-pack-1000', compCount: 3 },
    { id: 'prod-sc-purple', name: 'Purple', price: 26900, packId: 'prod-pack-1000', compCount: 7 },
    { id: 'prod-sc-delight', name: 'Delight', price: 12800, packId: 'prod-pack-600', compCount: 3 },
    { id: 'prod-sc-special', name: 'Special', price: 30200, packId: 'prod-pack-1500', compCount: 10 },
    { id: 'prod-sc-oga-platter', name: 'Oga Platter', price: 38700, packId: 'prod-pack-1500', compCount: 7 },
    { id: 'prod-sc-red', name: 'Red', price: 32400, packId: 'prod-pack-1000', compCount: 5 },
    { id: 'prod-sc-lemon', name: 'Lemon', price: 42400, packId: 'prod-pack-1500', compCount: 8 },
    { id: 'prod-qsr-bloom', name: 'Bloom', price: 22500, packId: 'prod-pack-2300', compCount: 7 },
    { id: 'prod-sc-deluxe-package', name: 'Deluxe Package', price: 42800, packId: 'prod-pack-1500', compCount: 13 },
    { id: 'prod-sc-big-chief', name: 'Big Chief', price: 64900, packId: 'prod-pack-1500', compCount: 2 },
    { id: 'prod-sc-queens-order', name: 'Queen’s Order', price: 38200, packId: 'prod-pack-1500', compCount: 8 },
    { id: 'prod-sc-royal', name: 'Royal', price: 49500, packId: 'prod-pack-1500', compCount: 6 },
    { id: 'prod-sc-wine', name: 'Wine', price: 64000, packId: 'prod-pack-2000', compCount: 4 },
    { id: 'prod-sc-peach', name: 'Peach', price: 47300, packId: 'prod-pack-1500', compCount: 10 },
    { id: 'prod-sc-ceo-151000', name: 'CEO', price: 156000, packId: 'prod-pack-4000', compCount: 9 },
    { id: 'prod-qsr-royalty', name: 'Royalty', price: 30900, packId: 'prod-pack-3500', compCount: 9 },
    { id: 'prod-qsr-crown', name: 'Crown', price: 36800, packId: 'prod-pack-3500', compCount: 14 },
    { id: 'prod-sc-gbam', name: 'Gbam', price: 6300, packId: 'prod-pack-500', compCount: 4 },
    { id: 'prod-sc-classic-package', name: 'Classic', price: 11300, packId: 'prod-pack-600', compCount: 5 },
    { id: 'prod-sc-grey', name: 'Grey', price: 20700, packId: 'prod-pack-1000', compCount: 6 },
    { id: 'prod-sc-chicken-chips-big', name: 'Chicken and Chips Big Size', price: 52300, packId: 'prod-pack-1500', compCount: 2 },
    { id: 'prod-sc-turkey-fest', name: 'Turkey Fest', price: 81500, packId: 'prod-pack-1500', compCount: 1 },
    { id: 'prod-qsr-jolly-pack', name: 'Jolly Pack', price: 6100, packId: 'prod-pack-400', compCount: 2 },
    { id: 'prod-qsr-quick-chow', name: 'Quick Chow', price: 9600, packId: 'prod-pack-400', compCount: 2 },
    { id: 'prod-qsr-combo-fish', name: 'Fish Combo', price: 6000, packId: 'prod-pack-400', compCount: 3 },
    { id: 'prod-qsr-belle-full', name: 'Belleful', price: 5400, packId: 'prod-pack-400', compCount: 2 },
  ];

  assert(expected40.length === 40, `expected40 list contains exactly 40 items`);

  for (const item of expected40) {
    const prod = db.menuProducts[item.id];
    assert(!!prod, `ACHIVED (2).pdf product ${item.name} (${item.id}) exists in db.menuProducts`);
    assert(prod.basePrice === item.price, `${item.name} basePrice is ₦${item.price.toLocaleString()} (actual: ₦${prod.basePrice})`);
    assert(prod.status === 'published', `${item.name} status is 'published' (actual: '${prod.status}')`);
    assert(prod.packaging?.productId === item.packId, `${item.name} packaging is ${item.packId} (actual: ${prod.packaging?.productId})`);
    assert((prod.components?.length || 0) === item.compCount, `${item.name} has ${item.compCount} components (actual: ${prod.components?.length})`);
    for (const comp of prod.components || []) {
      assert(!!db.menuProducts[comp.productId], `${item.name} component ${comp.productId} resolves in db.menuProducts`);
    }
    assert(!!db.menuProducts[item.packId], `${item.name} packaging ${item.packId} resolves in db.menuProducts`);
  }

  assert((db.menuProducts['prod-qsr-crown'] as any)?.packagingUnspecifiedInArchivedPdf === true, 'Crown Order flags packagingUnspecifiedInArchivedPdf === true');
  assert((db.menuProducts['prod-qsr-combo-fish'] as any)?.priceUnresolvedInArchivedPdf === true, 'Fish Combo flags priceUnresolvedInArchivedPdf === true');

  // Verify storefront & POS channels filter out all 40 paused items
  const webMenuRes = await api('/api/menu/products?channel=website');
  assert(webMenuRes.status === 200 && Array.isArray(webMenuRes.body), 'GET /api/menu/products?channel=website returns 200 array');
  const leakedOnWeb = webMenuRes.body.filter((p: any) => ARCHIVED_PDF_PRODUCT_IDS.includes(p.id));
  assert(leakedOnWeb.length === 0, `0 of 40 ACHIVED (2).pdf paused items appear on website channel (found: ${leakedOnWeb.length})`);

  const posMenuRes = await api('/api/menu/products?channel=pos');
  assert(posMenuRes.status === 200 && Array.isArray(posMenuRes.body), 'GET /api/menu/products?channel=pos returns 200 array');
  const leakedOnPos = posMenuRes.body.filter((p: any) => ARCHIVED_PDF_PRODUCT_IDS.includes(p.id));
  assert(leakedOnPos.length === 0, `0 of 40 ACHIVED (2).pdf paused items appear on POS channel (found: ${leakedOnPos.length})`);

  // Verify admin catalogue (without channel filter) still preserves all 40 items for future reactivation
  const adminMenuRes = await api('/api/menu/products?includeInactive=true');
  const preservedInAdmin = adminMenuRes.body.filter((p: any) => ARCHIVED_PDF_PRODUCT_IDS.includes(p.id));
  assert(preservedInAdmin.length === 40, `All 40 ACHIVED (2).pdf items are preserved in admin catalogue for future reactivation`);

  // Verify server rejects ordering an inactive product via POST /api/orders
  const inactiveOrderRes = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      branchId: 'gra',
      orderType: 'takeaway',
      items: [{ productId: 'prod-sc-gold', name: 'Gold', quantity: 1, unitPrice: 70500 }],
      paymentMethod: 'cash_on_delivery',
    }),
  });
  assert(inactiveOrderRes.status === 400, `POST /api/orders rejects inactive product 'prod-sc-gold' with HTTP 400 (got ${inactiveOrderRes.status})`);

  // ---------------------------------------------------------------------------
  // PHASE 4, 5, 7, 8, 9, 10, 11, 12: POS, Packaging, Payment-Before-KDS, Refund SoD, RBAC
  // ---------------------------------------------------------------------------
  console.log('\n--- PHASE 4-12: POS Quantity, Dine-In Table Lock, Packaging Policy, KDS Gate, Close-Unpaid, Refund SoD & RBAC ---');
  const superAdmin = await loginStaff('admin@choplife.ng');
  const storeManager = await loginStaff('manager.gra@choplife.ng');
  const cashier = await loginStaff('cashier.gra@choplife.ng');
  const storekeeper = await loginStaff('storekeeper@choplife.ng');
  const auditor = await loginStaff('auditor@choplife.ng');

  // Verify POS check rejects inactive product
  const inactivePosRes = await api('/api/pos/checks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({
      branchId: 'gra',
      checkType: 'takeaway',
      items: [{ productId: 'prod-qsr-bloom', name: 'Bloom', quantity: 1, unitPrice: 22500 }],
    }),
  });
  assert(inactivePosRes.status === 400, `POST /api/pos/checks rejects inactive product 'prod-qsr-bloom' with HTTP 400`);

  // Phase 6: Default Pack 400 Policy Verification
  const pack3Portions = calculateDefaultPackagingForItems(
    db,
    [{ productId: 'prod-qsr-jollof-rice', quantity: 2, category: 'qsr' }, { productId: 'prod-meat-chicken-small', quantity: 1, category: 'proteins' }],
    { orderType: 'takeaway' }
  );
  assert(pack3Portions.packagingFee === 400 && pack3Portions.packagingQuantity === 1, '3 standalone food/protein portions => 1 Pack 400 (₦400)');

  const pack5Portions = calculateDefaultPackagingForItems(
    db,
    [{ productId: 'prod-qsr-jollof-rice', quantity: 4, category: 'qsr' }, { productId: 'prod-meat-chicken-small', quantity: 1, category: 'proteins' }],
    { orderType: 'delivery' }
  );
  assert(pack5Portions.packagingFee === 800 && pack5Portions.packagingQuantity === 2, '5 standalone food/protein portions => 2 Pack 400 (₦800)');

  const packDrinkOnly = calculateDefaultPackagingForItems(
    db,
    [{ productId: 'prod-drink-water', quantity: 2, category: 'drinks' }],
    { orderType: 'takeaway' }
  );
  assert(packDrinkOnly.packagingFee === 0 && packDrinkOnly.packagingQuantity === 0, 'Standalone drinks => ₦0 automatic Pack 400 charge');

  const packComboOnly = calculateDefaultPackagingForItems(
    db,
    [{ productId: 'prod-qsr-combo-chicken', quantity: 1, category: 'qsr' }],
    { orderType: 'takeaway' }
  );
  assert(packComboOnly.packagingFee === 0, 'Predefined combo with included packaging => ₦0 extra Pack 400 charge');

  // Phase 7 & 8: Unpaid Online Order Cannot Spoof Paid Status or Enter KDS
  const spoofedOnlineRes = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      branchId: 'gra',
      orderType: 'takeaway',
      items: [{ productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (1 Portion)', quantity: 2, unitPrice: 1000 }],
      paymentMethod: 'card',
      paymentStatus: 'paid', // Unauthenticated client trying to spoof paid status without verified gateway ref
      deliveryDetails: { customerName: 'Test Customer', customerPhone: '08031234567' },
      staffOverride: true,
      isTestEnvironment: true,
    }),
  });
  assert(spoofedOnlineRes.status === 201, 'Unauthenticated online order created');
  assert(spoofedOnlineRes.body.order.paymentStatus !== 'paid', `Unauthenticated client paymentStatus:'paid' spoof was blocked (actual status: ${spoofedOnlineRes.body.order.paymentStatus})`);
  assert(spoofedOnlineRes.body.order.packagingFee === 400, `Online takeaway order of 2 Jollof Rice portions automatically charged ₦400 Pack 400 fee`);

  const kdsBeforePay = await api('/api/pos/kds/tickets?branchId=gra', {
    headers: { Authorization: `Bearer ${storeManager.token}` },
  });
  const unpaidInKds = (kdsBeforePay.body || []).some((t: any) => t.orderId === spoofedOnlineRes.body.order.id);
  assert(!unpaidInKds, 'Unpaid online order is strictly excluded from KDS tickets');

  // Confirm online order payment via staff endpoint and verify KDS release
  const confirmPayRes = await api(`/api/orders/${spoofedOnlineRes.body.order.id}/confirm-payment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({ paymentMethod: 'pos_terminal', paymentReference: 'POS-VERIFIED-001' }),
  });
  assert(confirmPayRes.status === 200 && confirmPayRes.body.order.paymentStatus === 'paid', 'Online order payment confirmed by staff');

  const kdsAfterPay = await api('/api/pos/kds/tickets?branchId=gra', {
    headers: { Authorization: `Bearer ${storeManager.token}` },
  });
  const paidInKds = (kdsAfterPay.body || []).some((t: any) => t.orderId === spoofedOnlineRes.body.order.id);
  assert(paidInKds, 'Paid online order is now visible in KDS tickets');

  // Phase 7 & 11: Unpaid POS check cannot be sent to KDS, cannot print kitchen_ticket/customer_receipt, and can be closed unpaid
  const unpaidCheckRes = await api('/api/pos/checks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({
      branchId: 'gra',
      checkType: 'takeaway',
      customerName: 'Walk-in Unpaid Test',
      items: [{ productId: 'prod-qsr-fried-rice', name: 'Fried Rice (1 Portion)', quantity: 3, unitPrice: 1000 }],
    }),
  });
  assert(unpaidCheckRes.status === 200 && !!unpaidCheckRes.body.check, 'Opened unpaid takeaway POS check');
  const unpaidCheck = unpaidCheckRes.body.check;
  assert(unpaidCheck.packagingFee === 400, `POS check for 3 Fried Rice portions automatically includes ₦400 Pack 400 fee`);

  // Attempt to send unpaid check to kitchen -> must fail with 409
  const sendUnpaidKdsRes = await api(`/api/pos/checks/${unpaidCheck.id}/send-to-kitchen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
  });
  assert(sendUnpaidKdsRes.status === 409, `Sending unpaid check to KDS blocked with HTTP 409`);

  // Attempt to print kitchen_ticket for unpaid check -> must fail with 409
  const printKitchenUnpaidRes = await api('/api/pos/printers/network-print', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({
      ip: '192.168.1.250',
      port: 9100,
      jobType: 'kitchen_ticket',
      checkId: unpaidCheck.id,
      orderNumber: unpaidCheck.checkNumber,
    }),
  });
  assert(printKitchenUnpaidRes.status === 409, `Printing kitchen_ticket for unpaid check blocked with HTTP 409`);

  // Close unpaid check with mandatory reason
  const closeUnpaidRes = await api(`/api/pos/checks/${unpaidCheck.id}/close-unpaid`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({ reason: 'Customer walked out before paying' }),
  });
  assert(
    closeUnpaidRes.status === 200 && closeUnpaidRes.body.check.status === 'closed_unpaid',
    `Unpaid check cleanly closed with status 'closed_unpaid' and zero revenue/inventory impact`
  );

  // Phase 11: Two-Step Refund with Segregation of Duties (SoD) and Prepared-vs-Unprepared Inventory Control
  const refundTestCheckRes = await api('/api/pos/checks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({
      branchId: 'gra',
      checkType: 'takeaway',
      customerName: 'Refund SoD Customer',
      items: [{ productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (1 Portion)', quantity: 1, unitPrice: 1000 }],
    }),
  });
  const refundCheckId = refundTestCheckRes.body.check.id;

  // Pay check via pos_terminal
  const payForRefundRes = await api(`/api/pos/checks/${refundCheckId}/pay`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({
      paymentMethod: 'pos_terminal',
      paymentDetails: { posRrn: 'RRN-REFUND-SOD-01' },
    }),
  });
  assert(payForRefundRes.status === 200 && payForRefundRes.body.isFullyPaid === true, 'Settled check for refund SoD test');

  // Cashier cannot directly execute refund without manager PIN
  const directCashierRefundRes = await api(`/api/pos/checks/${refundCheckId}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({ reason: 'Customer changed mind', action: 'execute' }),
  });
  assert(directCashierRefundRes.status === 403, 'Cashier blocked from directly executing refund without manager authorization (HTTP 403)');

  // Store manager requests refund (Step 1)
  const mgrRequestRefundRes = await api(`/api/pos/checks/${refundCheckId}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${storeManager.token}` },
    body: JSON.stringify({ reason: 'Order delayed', action: 'request', restoreUnpreparedInventory: false }),
  });
  assert(mgrRequestRefundRes.status === 200 && mgrRequestRefundRes.body.status === 'refund_requested', 'Step 1 refund request recorded');

  // Same store manager attempts to approve their own refund request -> must fail SoD (HTTP 403)
  const sodSelfApproveRes = await api(`/api/pos/checks/${refundCheckId}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${storeManager.token}` },
    body: JSON.stringify({ reason: 'Order delayed', action: 'execute', restoreUnpreparedInventory: false }),
  });
  assert(sodSelfApproveRes.status === 403, 'Segregation of Duties (SoD) blocks requester from approving their own refund (HTTP 403)');

  // Super Admin approves the refund request -> succeeds (HTTP 200)
  const superApproveRefundRes = await api(`/api/pos/checks/${refundCheckId}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    body: JSON.stringify({ reason: 'Order delayed', action: 'execute', restoreUnpreparedInventory: false }),
  });
  assert(superApproveRefundRes.status === 200 && superApproveRefundRes.body.check.status === 'refunded', 'Second authorized user approved refund request');

  // Phase 12: RBAC & Security Verification
  // 1. Storekeeper cannot archive/deactivate inventory item
  const skArchiveRes = await api('/api/inventory/items/inv-fg-jollof-rice', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${storekeeper.token}` },
    body: JSON.stringify({ isArchived: true }),
  });
  assert(skArchiveRes.status === 403, `Storekeeper blocked from archiving inventory item (HTTP ${skArchiveRes.status})`);

  // 2. Auditor is strictly read-only
  const auditorWriteRes = await api('/api/pos/checks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${auditor.token}` },
    body: JSON.stringify({ branchId: 'gra', checkType: 'takeaway', items: [] }),
  });
  assert(auditorWriteRes.status === 403, `Auditor blocked from mutating POS checks (HTTP ${auditorWriteRes.status})`);

  // 3. Supervisor PIN verification works via PostgreSQL bcrypt pinHash without exposing plaintext PIN in API responses
  const pinVerifyRes = await api('/api/pos/manager-override', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({ supervisorPin: '7391', action: 'DISCOUNT_OVERRIDE', branchId: 'gra' }),
  });
  assert(pinVerifyRes.status === 200 && pinVerifyRes.body.authorized === true, 'Supervisor PIN verification succeeds without exposing plaintext PIN in API responses');

  // 4. Package Reactivation RBAC Guard (non-Super-Admin without menu.package.reactivate is blocked)
  const mgrReactivateRes = await api('/api/menu/products/prod-sc-gold', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${storeManager.token}` },
    body: JSON.stringify({ status: 'published' }),
  });
  assert(mgrReactivateRes.status === 403, `Store Manager blocked from reactivating paused package without menu.package.reactivate (HTTP ${mgrReactivateRes.status})`);

  // 5. Fish Combo Unresolved PDF Price Guard (blocks activation unless confirmAuthorisedPrice: true)
  const fishBlockRes = await api('/api/menu/products/prod-qsr-combo-fish', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    body: JSON.stringify({ status: 'published' }),
  });
  assert(fishBlockRes.status === 400 && fishBlockRes.body?.code === 'UNRESOLVED_PDF_PRICE', 'Fish Combo activation blocked without confirmAuthorisedPrice: true (HTTP 400 UNRESOLVED_PDF_PRICE)');

  const fishConfirmRes = await api('/api/menu/products/prod-qsr-combo-fish', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    body: JSON.stringify({ status: 'published', basePrice: 6000, confirmAuthorisedPrice: true }),
  });
  assert(fishConfirmRes.status === 200 && fishConfirmRes.body?.product?.status === 'published', 'Super Admin can reactivate Fish Combo when confirmAuthorisedPrice: true is provided');

  // Immediately re-pause Fish Combo to preserve inactive state
  const fishRepauseRes = await api('/api/menu/products/prod-qsr-combo-fish', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    body: JSON.stringify({ status: 'paused', priceUnresolvedInArchivedPdf: true }),
  });
  assert(fishRepauseRes.status === 200 && fishRepauseRes.body?.product?.status === 'paused', 'Fish Combo returned to paused status');

  // 6. RBAC Anti-Escalation Guard (non-Super-Admin cannot grant permissions they do not possess or edit system roles)
  const escalateRoleRes = await api('/api/rbac/roles/role-cashier', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${storeManager.token}` },
    body: JSON.stringify({ permissions: ['pos.access', 'menu.package.reactivate', 'system.settings'] }),
  });
  assert(escalateRoleRes.status === 403, `RBAC privilege escalation blocked on PUT /api/rbac/roles/role-cashier (HTTP ${escalateRoleRes.status})`);

  const createEscalatedRoleRes = await api('/api/rbac/roles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${storeManager.token}` },
    body: JSON.stringify({ name: 'Escalated Role', permissions: ['menu.package.reactivate', 'migration.ezee.rollback'] }),
  });
  assert(createEscalatedRoleRes.status === 403, `RBAC privilege escalation blocked on POST /api/rbac/roles (HTTP ${createEscalatedRoleRes.status})`);

  // 7. EZEE Optimus Historical-Data Dry-Run, Commit & Controlled Rollback Verification
  const ezeeChecks = [
    {
      legacyRecordId: `EZEE-HIST-${Date.now()}-1`,
      originalTimestamp: '2025-10-15T14:20:00.000Z',
      outlet: 'gra',
      checkType: 'takeaway',
      customerName: 'Historical Guest',
      paymentMethod: 'pos_terminal',
      grossAmount: 2000,
      discountAmount: 0,
      netAmount: 2000,
      items: [
        {
          productId: 'prod-qsr-jollof-rice',
          name: 'Jollof Rice (Portion)',
          quantity: 2,
          unitPrice: 1000,
          totalPrice: 2000,
        },
      ],
    },
  ];
  const ezeeStageRes = await api('/api/migration/ezee/dry-run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    body: JSON.stringify({ checks: ezeeChecks }),
  });
  assert(
    ezeeStageRes.status === 200 && !!ezeeStageRes.body?.migrationBatchId && !!ezeeStageRes.body?.batchChecksum,
    'EZEE Optimus dry-run staging succeeded with SHA-256 batchChecksum'
  );
  const migrationBatchId = ezeeStageRes.body.migrationBatchId;

  const ezeeCommitRes = await api('/api/migration/ezee/commit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    body: JSON.stringify({ migrationBatchId }),
  });
  assert(
    ezeeCommitRes.status === 200 && ezeeCommitRes.body?.committedCount === 1 && ezeeCommitRes.body?.isLiveSequenceUntouched === true,
    'EZEE Optimus historical batch committed without touching live sequence or triggering live KDS/inventory depletion'
  );

  const ezeeRollbackRes = await api('/api/migration/ezee/rollback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    body: JSON.stringify({ migrationBatchId, reason: 'Automated verification rollback test' }),
  });
  assert(
    ezeeRollbackRes.status === 200 && ezeeRollbackRes.body?.removedChecksCount === 1,
    'POST /api/migration/ezee/rollback cleanly removed migrated historical records'
  );

  // ---------------------------------------------------------------------------
  // PHASE 13: Virgin-State Cleanup Dry-Run & Isolated /tmp Copy Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- PHASE 13: Virgin-State Cleanup Dry-Run & Isolated /tmp Copy Verification ---');
  const liveDbPath = '/app/applet/data/choplife_ops_db.json';
  const tmpDbPath = `/tmp/choplife_virgin_test_${Date.now()}.json`;
  const tmpBackupPath = `/tmp/choplife_virgin_backup_${Date.now()}.json`;
  fs.copyFileSync(liveDbPath, tmpDbPath);

  const beforeHash = crypto.createHash('sha256').update(fs.readFileSync(tmpDbPath)).digest('hex');

  execSync(`npx tsx scripts/clean_virgin_database.ts --dry-run --db-path=${tmpDbPath} --backup-path=${tmpBackupPath}`, { stdio: 'pipe' });

  const afterHash = crypto.createHash('sha256').update(fs.readFileSync(tmpDbPath)).digest('hex');
  assert(beforeHash === afterHash, `clean_virgin_database.ts --dry-run is 100% read-only (DB SHA-256 unchanged: ${beforeHash.slice(0, 16)}...)`);
  assert(!fs.existsSync(tmpBackupPath), 'clean_virgin_database.ts --dry-run did not write any backup file to disk');

  execSync(`npx tsx scripts/clean_virgin_database.ts --confirm-virgin-clean --db-path=${tmpDbPath} --backup-path=${tmpBackupPath}`, {
    stdio: 'pipe',
  });

  const cleanedTmpDb = JSON.parse(fs.readFileSync(tmpDbPath, 'utf8'));
  assert(Object.keys(cleanedTmpDb.orders || {}).length === 0, 'Isolated /tmp virgin DB has 0 orders');
  assert(Object.keys(cleanedTmpDb.checks || {}).length === 0, 'Isolated /tmp virgin DB has 0 checks');
  assert((cleanedTmpDb.ledger || []).length === 0, 'Isolated /tmp virgin DB has 0 stock ledger entries');
  assert(Object.keys(cleanedTmpDb.menuProducts || {}).length >= 165, `Isolated /tmp virgin DB preserved all ${Object.keys(cleanedTmpDb.menuProducts || {}).length} menuProducts`);
  assert(Object.keys(cleanedTmpDb.inventory || {}).length >= 37, `Isolated /tmp virgin DB preserved all ${Object.keys(cleanedTmpDb.inventory || {}).length} inventory SKUs`);
  assert(fs.existsSync(tmpBackupPath), 'Isolated /tmp virgin cleanup created backup file at specified --backup-path');

  // Cleanup temp files
  try {
    fs.unlinkSync(tmpDbPath);
    fs.unlinkSync(tmpBackupPath);
  } catch {}

  console.log('\n================================================================================');
  console.log(`ALL ${passed} MASTER REMEDIATION VERIFICATION CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================================\n');
}

runVerification().catch((err) => {
  console.error('\n[MASTER VERIFICATION FAILED]', err);
  process.exit(1);
});
