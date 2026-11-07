import { execSync } from 'child_process';
import { db } from '../server/db/db.ts';
import * as schema from '../server/db/schema/index.ts';
import { count } from 'drizzle-orm';
import { loadDatabase } from '../server_db.ts';
import { syncSnapshotToPostgres } from '../server/services/pgPersistenceSync.ts';

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
      Connection: 'close',
      ...(options.headers || {}),
    },
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, setCookie };
}

async function loginStaff(email: string, password = process.env.DEFAULT_SEED_STAFF_PASSWORD || 'ChopLife2025!') {
  const res = await api('/api/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(res.status === 200 && !!res.body?.token, `Authenticated staff account: ${email}`);
  return { token: res.body.token as string, staff: res.body.staff };
}

async function runConsolidatedVerification() {
  console.log('================================================================================');
  console.log('CHOPLIFE REPUBLIC — CONSOLIDATED MASTER DIRECTIVE VERIFICATION SUITE');
  console.log('================================================================================\n');

  // 1. Reset to Virgin State first so we verify clean virgin-state invariants
  console.log('--- STEP 1: Virgin-State Database & PostgreSQL Migration Verification ---');
  execSync('npx tsx scripts/clean_virgin_database.ts --execute', { stdio: 'pipe' });
  const virginSnapshot = loadDatabase();
  await syncSnapshotToPostgres(virginSnapshot);

  const superAdmin = await loginStaff('admin@choplife.ng');
  const reloadRes = await api('/api/admin/db/reload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });
  assert(reloadRes.status === 200 && reloadRes.body.ordersCount === 0, 'Live Express server reloaded virgin state (0 orders)');

  // Verify PostgreSQL table counts directly
  const [pgBranchCount] = await db.select({ value: count() }).from(schema.branches);
  const [pgRoleCount] = await db.select({ value: count() }).from(schema.roles);
  const [pgStaffCount] = await db.select({ value: count() }).from(schema.staff);
  const [pgProductCount] = await db.select({ value: count() }).from(schema.menuProducts);
  const [pgInvCount] = await db.select({ value: count() }).from(schema.inventoryItems);
  const [pgOrderCount] = await db.select({ value: count() }).from(schema.orders);
  const [pgCheckCount] = await db.select({ value: count() }).from(schema.posChecks);

  assert(pgBranchCount.value === 3, `PostgreSQL branches count === 3 (actual: ${pgBranchCount.value})`);
  assert(pgRoleCount.value === 17, `PostgreSQL roles count === 17 (actual: ${pgRoleCount.value})`);
  assert(pgStaffCount.value === 13, `PostgreSQL staff count === 13 (actual: ${pgStaffCount.value})`);
  assert(pgProductCount.value === 206, `PostgreSQL menu_products count === 206 (actual: ${pgProductCount.value})`);
  assert(pgInvCount.value === 37, `PostgreSQL inventory_items count === 37 (actual: ${pgInvCount.value})`);
  assert(pgOrderCount.value === 0, `PostgreSQL virgin orders count === 0 (actual: ${pgOrderCount.value})`);
  assert(pgCheckCount.value === 0, `PostgreSQL virgin pos_checks count === 0 (actual: ${pgCheckCount.value})`);

  // 2. Storefront Bestsellers in Virgin State (must NOT fabricate bestsellers)
  console.log('\n--- STEP 2: Storefront Bestsellers Virgin-State & Live Order Verification ---');
  const virginBestsellersRes = await api('/api/menu/bestsellers?branchId=gra&limit=3');
  assert(virginBestsellersRes.status === 200, 'GET /api/menu/bestsellers returns HTTP 200');
  assert(
    virginBestsellersRes.body.hasGenuineSalesData === false && virginBestsellersRes.body.bestsellers.length === 0,
    'Virgin state returns 0 bestsellers and hasGenuineSalesData === false (no fabricated bestsellers)'
  );

  // 3. Consent-Based Remembered Device Preference Cookie & PostgreSQL Persistence
  console.log('\n--- STEP 3: Consent-Based Remembered Device Preference Verification ---');
  const saveDeviceRes = await api('/api/customers/device-preference', {
    method: 'POST',
    body: JSON.stringify({
      consentGiven: true,
      preferredBranchId: 'gra',
      preferredFulfilment: 'delivery',
      preferredCategory: 'small_chops',
    }),
  });
  assert(
    saveDeviceRes.status === 200 && saveDeviceRes.body.remembered === true,
    'POST /api/customers/device-preference with consentGiven:true saves device preference'
  );
  assert(
    saveDeviceRes.setCookie.includes('choplife_remembered_device=') && saveDeviceRes.setCookie.includes('HttpOnly'),
    'Response sets HttpOnly cookie choplife_remembered_device'
  );
  const cookieMatch = saveDeviceRes.setCookie.match(/choplife_remembered_device=([^;]+)/);
  const cookieHeader = cookieMatch ? `choplife_remembered_device=${cookieMatch[1]}` : '';

  const getDeviceRes = await api('/api/customers/device-preference', {
    headers: { Cookie: cookieHeader },
  });
  assert(
    getDeviceRes.status === 200 &&
      getDeviceRes.body.remembered === true &&
      getDeviceRes.body.preferences?.preferredBranchId === 'gra' &&
      getDeviceRes.body.preferences?.preferredFulfilment === 'delivery' &&
      getDeviceRes.body.preferences?.preferredCategory === 'small_chops',
    'GET /api/customers/device-preference restores saved branch, fulfilment & category preference'
  );

  const forgetDeviceRes = await api('/api/customers/device-preference', {
    method: 'DELETE',
    headers: { Cookie: cookieHeader },
  });
  assert(
    forgetDeviceRes.status === 200 && forgetDeviceRes.body.remembered === false,
    'DELETE /api/customers/device-preference revokes remembered device preference'
  );

  const afterForgetRes = await api('/api/customers/device-preference', {
    headers: { Cookie: cookieHeader },
  });
  assert(afterForgetRes.body.remembered === false, 'Revoked device token no longer returns remembered preference');

  // 4. Create Live Order, Verify Unpaid Review Rejection, Confirm Payment & Fulfilment, Verify Bestsellers & 5-View Package Accounting
  console.log('\n--- STEP 4: End-to-End Order, Package Accounting & Verified Post-Order Review Verification ---');
  const orderCreateRes = await api('/api/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    body: JSON.stringify({
      branchId: 'gra',
      orderType: 'delivery',
      paymentMethod: 'pos_terminal',
      items: [
        {
          productId: 'prod-qsr-combo-chicken',
          name: 'Chicken Combo',
          quantity: 2,
          unitPrice: 7000,
          category: 'qsr',
        },
        {
          productId: 'prod-qsr-jollof-rice',
          name: 'Jollof Rice (1 Portion)',
          quantity: 1,
          unitPrice: 1000,
          category: 'qsr',
        },
      ],
      deliveryDetails: {
        customerName: 'Efosa Igbinoba',
        customerPhone: '08035550199',
        address: '14 Ihama Road, GRA, Benin City',
      },
      staffOverride: true,
      supervisorPin: '1234',
    }),
  });
  assert(orderCreateRes.status === 201 && !!orderCreateRes.body.order, 'Created live customer order with package + standalone item');
  const createdOrder = orderCreateRes.body.order;

  // Attempt to review unpaid/unfulfilled order -> must fail with 403
  const prematureReviewRes = await api('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({
      orderId: createdOrder.id,
      customerPhone: '08035550199',
      productRating: 5,
      productTags: ['Fresh & Hot', 'Great Taste'],
      comment: 'Trying to review before payment and fulfilment',
    }),
  });
  assert(
    prematureReviewRes.status === 403,
    `POST /api/reviews rejects unpaid/unfulfilled order with HTTP 403 (got ${prematureReviewRes.status})`
  );

  // Confirm payment & mark order delivered
  const cashier = await loginStaff('cashier.gra@choplife.ng');
  const confirmPayRes = await api(`/api/orders/${createdOrder.id}/confirm-payment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({ paymentMethod: 'pos_terminal', paymentReference: 'POS-MASTER-001' }),
  });
  assert(confirmPayRes.status === 200 && confirmPayRes.body.order.paymentStatus === 'paid', 'Confirmed order payment');

  const markDeliveredRes = await api(`/api/orders/${createdOrder.id}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${cashier.token}` },
    body: JSON.stringify({ status: 'delivered' }),
  });
  assert(markDeliveredRes.status === 200 && markDeliveredRes.body.order.status === 'delivered', 'Marked order as delivered');

  // Verify genuine bestsellers now reflect the paid & fulfilled order (capped at <= 3)
  const liveBestsellersRes = await api('/api/menu/bestsellers?branchId=gra&limit=3');
  assert(
    liveBestsellersRes.status === 200 &&
      liveBestsellersRes.body.hasGenuineSalesData === true &&
      liveBestsellersRes.body.bestsellers.length > 0 &&
      liveBestsellersRes.body.bestsellers.length <= 3,
    `GET /api/menu/bestsellers returns genuine bestsellers (count: ${liveBestsellersRes.body.bestsellers.length}, max 3)`
  );
  assert(
    liveBestsellersRes.body.bestsellers[0].productId === 'prod-qsr-combo-chicken',
    `Top bestseller is Chicken Combo (qty 2)`
  );

  // Verify 5-View Package Accounting Separation
  const pkgAccountingRes = await api('/api/reports/package-accounting?branchId=gra', {
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });
  assert(pkgAccountingRes.status === 200, 'GET /api/reports/package-accounting returns HTTP 200');
  const views = pkgAccountingRes.body.views;
  assert(
    Array.isArray(views?.packageSales) &&
      Array.isArray(views?.standaloneSales) &&
      Array.isArray(views?.packageComponentUsage) &&
      Array.isArray(views?.totalPhysicalComponentDemand) &&
      Array.isArray(views?.packagingConsumption),
    'Package accounting report contains all 5 mandatory views'
  );

  // Verify Jollof Rice physical demand = 1 standalone + 4 from 2x Chicken Combo (each Chicken Combo has 2 Jollof Rice) = 5
  const jollofDemand = views.totalPhysicalComponentDemand.find((d: any) => d.itemKey === 'prod-qsr-jollof-rice');
  assert(
    !!jollofDemand &&
      jollofDemand.standaloneUnits === 1 &&
      jollofDemand.includedInPackageUnits === 4 &&
      jollofDemand.totalPhysicalUnits === 5,
    `Total physical Jollof Rice demand reconciles: 1 standalone + 4 package component (2x Chicken Combo) = 5 total units`
  );

  // Verify Review Tags & Eligible Order Review Submission
  const tagsRes = await api('/api/reviews/tags');
  assert(
    tagsRes.status === 200 &&
      Array.isArray(tagsRes.body.productTags) &&
      Array.isArray(tagsRes.body.deliveryTags) &&
      Array.isArray(tagsRes.body.serviceTags),
    'GET /api/reviews/tags returns approved Product, Delivery & Customer Service tag lists'
  );

  const eligRes = await api(`/api/reviews/eligibility/${encodeURIComponent(createdOrder.orderNumber)}?phone=08035550199`);
  assert(eligRes.status === 200 && eligRes.body.eligible === true, 'Paid & delivered order is eligible for review');

  const submitReviewRes = await api('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({
      orderId: createdOrder.orderNumber,
      customerPhone: '08035550199',
      customerName: 'Efosa Igbinoba',
      isPublicDisplayName: true,
      productRating: 5,
      productTags: ['Fresh & Hot', 'Great Taste'],
      deliveryRating: 5,
      deliveryTags: ['On Time', 'Polite Rider'],
      serviceRating: 4,
      serviceTags: ['Helpful Support'],
      comment: 'Hot Jollof and crispy chicken combo delivered right on time!',
    }),
  });
  assert(
    submitReviewRes.status === 201 && submitReviewRes.body.review?.verified === true,
    'POST /api/reviews accepts verified post-order review with Product, Delivery & Customer Service ratings and tags'
  );

  // Verify duplicate review is rejected with HTTP 409
  const duplicateReviewRes = await api('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({
      orderId: createdOrder.orderNumber,
      customerPhone: '08035550199',
      productRating: 5,
    }),
  });
  assert(
    duplicateReviewRes.status === 409,
    `Duplicate review for the same order is rejected with HTTP 409 (got ${duplicateReviewRes.status})`
  );

  // Verify public reviews list includes the verified review
  const listReviewsRes = await api('/api/reviews?branchId=gra');
  assert(
    listReviewsRes.status === 200 &&
      Array.isArray(listReviewsRes.body.reviews) &&
      listReviewsRes.body.reviews.some((r: any) => r.orderId === createdOrder.id),
    'GET /api/reviews returns the verified public review'
  );

  // 5. Restore database to Virgin State so production deployment starts 100% clean
  console.log('\n--- STEP 5: Restoring Database & PostgreSQL to Clean Virgin State ---');
  execSync('npx tsx scripts/clean_virgin_database.ts --execute', { stdio: 'pipe' });
  const restoredVirginSnapshot = loadDatabase();
  await syncSnapshotToPostgres(restoredVirginSnapshot);
  await db.delete(schema.customerReviews);
  await db.delete(schema.customerDevices);

  const finalReloadRes = await api('/api/admin/db/reload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });
  assert(
    finalReloadRes.status === 200 && finalReloadRes.body.ordersCount === 0,
    'Database and PostgreSQL restored to 100% clean virgin state after integration tests'
  );

  console.log('\n================================================================================');
  console.log(`ALL ${passed} CONSOLIDATED MASTER DIRECTIVE CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================================\n');
}

runConsolidatedVerification().catch((err) => {
  console.error('\n[CONSOLIDATED VERIFICATION FAILED]', err);
  process.exit(1);
});
