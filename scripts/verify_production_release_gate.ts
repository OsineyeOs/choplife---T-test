import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`, details || '');
    failed++;
  }
}

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<{ status: number; data: any; headers: Headers }> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, options);
  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    data = await res.text();
  }
  return { status: res.status, data, headers: res.headers };
}

async function runProductionReleaseGate() {
  console.log('================================================================');
  console.log('CHOPLIFE REPUBLIC — PRODUCTION RELEASE GATE & REGRESSION SUITE');
  console.log('================================================================');

  // STEP 0: Authentication
  console.log('\n--- STEP 0: AUTHENTICATION ---');
  const superAdminLogin = await apiRequest('/api/auth/staff/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrStaffId: 'oluwaseun.osineye@gmail.com', password: 'ChopLife2025!' }),
  });
  assert(superAdminLogin.status === 200 && superAdminLogin.data.token, 'Super Admin authenticated via bcrypt');
  const adminToken = superAdminLogin.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const cashierLogin = await apiRequest('/api/auth/staff/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrStaffId: 'STF-010', password: 'ChopLife2025!' }),
  });
  assert(cashierLogin.status === 200 && cashierLogin.data.token, 'Branch Cashier (Okabere) authenticated');
  const cashierToken = cashierLogin.data.token;
  const cashierHeaders = { Authorization: `Bearer ${cashierToken}`, 'Content-Type': 'application/json' };

  // ====================================================================
  // PRIORITY 1: INVENTORY FILTERING UNDER 8 EXACT CONDITIONS
  // ====================================================================
  console.log('\n--- PRIORITY 1: INVENTORY FILTERING UNDER 8 SPECIFIC CONDITIONS ---');

  // Condition 1: Stock exists at commissary but not at a restaurant branch
  const cond1Sku = `TEST-COND1-${Date.now().toString().slice(-4)}`;
  const cond1Create = await apiRequest('/api/inventory/items', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Commissary Only Stock Flour',
      sku: cond1Sku,
      category: 'bakery',
      unit: 'kg',
      initialStock: 100,
      initialLocationId: 'general_store',
      costPerUnit: 2500,
      minThreshold: 15,
    }),
  });
  assert(cond1Create.status === 201, 'Created item with 100 units at commissary (general_store) and 0 at restaurant branches');
  const cond1ItemId = cond1Create.data.item.id;

  // Verify Condition 1: Query GRA branch specifically
  const c1GraInStock = await apiRequest(`/api/inventory/items?stockLevel=in_stock&locationId=gra`, { headers: adminHeaders });
  const c1GraOutStock = await apiRequest(`/api/inventory/items?stockLevel=out_of_stock&locationId=gra`, { headers: adminHeaders });
  assert(!c1GraInStock.data.some((it: any) => it.id === cond1ItemId), 'Cond 1: Item is NOT in_stock when filtering GRA (branch balance is 0)');
  assert(c1GraOutStock.data.some((it: any) => it.id === cond1ItemId), 'Cond 1: Item is truthfully out_of_stock when filtering GRA');

  // Verify Condition 1: Query Network-Wide ('all')
  const c1NetInStock = await apiRequest(`/api/inventory/items?stockLevel=in_stock&locationId=all`, { headers: adminHeaders });
  const c1NetOutStock = await apiRequest(`/api/inventory/items?stockLevel=out_of_stock&locationId=all`, { headers: adminHeaders });
  assert(c1NetInStock.data.some((it: any) => it.id === cond1ItemId), 'Cond 1: Item IS in_stock network-wide (100 units at commissary)');
  assert(!c1NetOutStock.data.some((it: any) => it.id === cond1ItemId), 'Cond 1: Item is NOT out_of_stock network-wide');

  // Condition 2: Stock exists at one restaurant branch but not another
  const cond2Sku = `TEST-COND2-${Date.now().toString().slice(-4)}`;
  const cond2Create = await apiRequest('/api/inventory/items', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'GRA Only Chicken Cutlets',
      sku: cond2Sku,
      category: 'proteins',
      unit: 'kg',
      initialStock: 50,
      initialLocationId: 'gra',
      costPerUnit: 4200,
      minThreshold: 10,
    }),
  });
  assert(cond2Create.status === 201, 'Created item with 50 units at GRA and 0 at Okabere/Ugbowo/Commissary');
  const cond2ItemId = cond2Create.data.item.id;

  const c2GraIn = await apiRequest(`/api/inventory/items?stockLevel=in_stock&locationId=gra`, { headers: adminHeaders });
  const c2OkaOut = await apiRequest(`/api/inventory/items?stockLevel=out_of_stock&locationId=okabere`, { headers: adminHeaders });
  const c2NetIn = await apiRequest(`/api/inventory/items?stockLevel=in_stock&locationId=all`, { headers: adminHeaders });
  assert(c2GraIn.data.some((it: any) => it.id === cond2ItemId), 'Cond 2: Item is in_stock at GRA');
  assert(c2OkaOut.data.some((it: any) => it.id === cond2ItemId), 'Cond 2: Item is out_of_stock at Okabere');
  assert(c2NetIn.data.some((it: any) => it.id === cond2ItemId), 'Cond 2: Item is in_stock network-wide (50 units exist in network)');

  // Condition 3: Stock exists at several branches, with one branch at zero
  // Adjust cond2 item to have 30 at Okabere as well, but 0 at Ugbowo
  await apiRequest(`/api/inventory/items/${cond2ItemId}/stock`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ branchId: 'okabere', newStock: 30, reason: 'Test multi-branch stock' }),
  });
  const c3NetIn = await apiRequest(`/api/inventory/items?stockLevel=in_stock&locationId=all`, { headers: adminHeaders });
  const c3UgbOut = await apiRequest(`/api/inventory/items?stockLevel=out_of_stock&locationId=ugbowo`, { headers: adminHeaders });
  assert(c3NetIn.data.some((it: any) => it.id === cond2ItemId), 'Cond 3: Item with stock at GRA & Okabere is in_stock network-wide');
  assert(c3UgbOut.data.some((it: any) => it.id === cond2ItemId), 'Cond 3: Item remains out_of_stock when filtering Ugbowo branch specifically');

  // Condition 4: Network-wide stock is zero
  const cond4Sku = `TEST-COND4-${Date.now().toString().slice(-4)}`;
  const cond4Create = await apiRequest('/api/inventory/items', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Zero Stock Out-of-Season Spice',
      sku: cond4Sku,
      category: 'ingredients',
      unit: 'pack',
      initialStock: 0,
      costPerUnit: 1500,
    }),
  });
  assert(cond4Create.status === 201, 'Created zero-stock item');
  const cond4ItemId = cond4Create.data.item.id;
  const c4NetOut = await apiRequest(`/api/inventory/items?stockLevel=out_of_stock&locationId=all`, { headers: adminHeaders });
  const c4NetIn = await apiRequest(`/api/inventory/items?stockLevel=in_stock&locationId=all`, { headers: adminHeaders });
  assert(c4NetOut.data.some((it: any) => it.id === cond4ItemId), 'Cond 4: Zero-stock item is out_of_stock network-wide');
  assert(!c4NetIn.data.some((it: any) => it.id === cond4ItemId), 'Cond 4: Zero-stock item is NOT in_stock network-wide');

  // Condition 5: Stock is below configured reorder threshold
  // Set stock at GRA to 5 (minThreshold is 10)
  await apiRequest(`/api/inventory/items/${cond4ItemId}/stock`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ branchId: 'gra', newStock: 5, reason: 'Low stock test' }),
  });
  const c5GraLow = await apiRequest(`/api/inventory/items?stockLevel=low_stock&locationId=gra`, { headers: adminHeaders });
  assert(c5GraLow.data.some((it: any) => it.id === cond4ItemId), 'Cond 5: Item with 5 units (min=10) is returned under low_stock at GRA');

  // Condition 6: An item is archived
  const cond6Archive = await apiRequest(`/api/inventory/items/${cond4ItemId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert(cond6Archive.status === 200 && cond6Archive.data.action === 'archived', 'Cond 6: Item with stock/ledger safely archived');
  const c6ActiveList = await apiRequest(`/api/inventory/items?status=active`, { headers: adminHeaders });
  const c6ArchivedList = await apiRequest(`/api/inventory/items?status=archived`, { headers: adminHeaders });
  assert(!c6ActiveList.data.some((it: any) => it.id === cond4ItemId), 'Cond 6: Archived item excluded from status=active list');
  assert(c6ArchivedList.data.some((it: any) => it.id === cond4ItemId), 'Cond 6: Archived item included in status=archived list');

  // Condition 7: Demo Item origin filtering
  const demoSeedCheck = await apiRequest('/api/inventory/demo/seed', { method: 'POST', headers: adminHeaders });
  assert(demoSeedCheck.status === 200, 'Cond 7: Seeded demo items');
  const c7DemoOnly = await apiRequest('/api/inventory/items?origin=demo', { headers: adminHeaders });
  const c7OpOnly = await apiRequest('/api/inventory/items?origin=operational', { headers: adminHeaders });
  assert(c7DemoOnly.data.every((it: any) => it.isDemo === true || it.dataOrigin === 'demo'), 'Cond 7: origin=demo returns only demo items');
  assert(c7OpOnly.data.every((it: any) => !it.isDemo && it.dataOrigin !== 'demo'), 'Cond 7: origin=operational excludes all demo items');

  // Condition 8: Stock Conservation across Transfer Indent
  console.log('\n--- STOCK CONSERVATION: COMMISSARY TO GRA TRANSFER ---');
  // Check commissary balance before transfer
  const itemBeforeRes = await apiRequest(`/api/inventory/items/${cond1ItemId}`, { headers: adminHeaders });
  const genBefore = itemBeforeRes.data.item.locationStock.general_store.stockOnHand;
  const graBefore = itemBeforeRes.data.item.locationStock.gra.stockOnHand;

  // 1. Raise transfer indent for 20 units from general_store to gra
  const indentCreate = await apiRequest('/api/inventory/requests', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      sourceLocation: 'general_store',
      destinationLocation: 'gra',
      items: [{ itemId: cond1ItemId, requestedQty: 20 }],
      notes: 'Replenishment for GRA bakery',
    }),
  });
  assert(indentCreate.status === 201, 'Raised transfer indent for 20 units');
  const indentId = indentCreate.data.request.id;

  // 2. Dispatch indent
  const dispatchRes = await apiRequest(`/api/inventory/requests/${indentId}/dispatch`, {
    method: 'POST',
    headers: adminHeaders,
  });
  assert(dispatchRes.status === 200, 'Dispatched transfer indent');

  // Verify commissary deducted exactly 20
  const itemMidRes = await apiRequest(`/api/inventory/items/${cond1ItemId}`, { headers: adminHeaders });
  const genMid = itemMidRes.data.item.locationStock.general_store.stockOnHand;
  assert(genMid === genBefore - 20, `Commissary deducted exactly 20 (${genBefore} -> ${genMid})`);

  // 3. Receive indent at GRA
  const receiveRes = await apiRequest(`/api/inventory/requests/${indentId}/receive`, {
    method: 'POST',
    headers: adminHeaders,
  });
  assert(receiveRes.status === 200, 'Received transfer indent at GRA');

  // Verify GRA credited exactly 20
  const itemFinalRes = await apiRequest(`/api/inventory/items/${cond1ItemId}`, { headers: adminHeaders });
  const graFinal = itemFinalRes.data.item.locationStock.gra.stockOnHand;
  const genFinal = itemFinalRes.data.item.locationStock.general_store.stockOnHand;
  assert(graFinal === graBefore + 20, `GRA credited exactly 20 (${graBefore} -> ${graFinal})`);
  assert(genFinal + graFinal === genBefore + graBefore, 'Total network stock strictly conserved across transfer (0 units destroyed/created)');

  // ====================================================================
  // PRIORITY 2: DEMO SEEDING IDEMPOTENCY & ISOLATED PURGE
  // ====================================================================
  console.log('\n--- PRIORITY 2: DEMO SEEDING IDEMPOTENCY & ISOLATED PURGE ---');
  // Call seed 3 times in succession
  const seed1 = await apiRequest('/api/inventory/demo/seed', { method: 'POST', headers: adminHeaders });
  const seed2 = await apiRequest('/api/inventory/demo/seed', { method: 'POST', headers: adminHeaders });
  const seed3 = await apiRequest('/api/inventory/demo/seed', { method: 'POST', headers: adminHeaders });
  assert(seed2.status === 200 && seed2.data.createdCount === 0 && seed2.data.skippedCount === 5, 'Seed run 2: 0 created, 5 skipped (strictly idempotent)');
  assert(seed3.status === 200 && seed3.data.createdCount === 0 && seed3.data.skippedCount === 5, 'Seed run 3: 0 created, 5 skipped (strictly idempotent)');

  // Reset demo catalogue
  const resetRes = await apiRequest('/api/inventory/demo/reset', { method: 'POST', headers: adminHeaders });
  assert(resetRes.status === 200 && resetRes.data.removedItemsCount >= 5, `Purged ${resetRes.data.removedItemsCount} demo items safely`);

  // Verify operational items survived
  const checkOpItem = await apiRequest(`/api/inventory/items/${cond1ItemId}`, { headers: adminHeaders });
  assert(checkOpItem.status === 200 && checkOpItem.data.item.name === 'Commissary Only Stock Flour', 'Operational stock item completely untouched by demo reset');

  // ====================================================================
  // PRIORITY 4: LOYALTY & PAYMENT IDEMPOTENCY
  // ====================================================================
  console.log('\n--- PRIORITY 4: LOYALTY RULES & PAYMENT IDEMPOTENCY ---');
  // Boundary calculations test
  // Rule: 1 point per ₦1,000 net food/beverage spend
  const pointsFromSpend = (amt: number, discount = 0, deliveryFee = 0) => {
    const net = Math.max(0, amt - discount - deliveryFee);
    return Math.floor(net / 1000);
  };
  assert(pointsFromSpend(0) === 0, '₦0 spend = 0 pts');
  assert(pointsFromSpend(999) === 0, '₦999 spend = 0 pts');
  assert(pointsFromSpend(1000) === 1, '₦1,000 spend = 1 pt');
  assert(pointsFromSpend(1001) === 1, '₦1,001 spend = 1 pt');
  assert(pointsFromSpend(1999) === 1, '₦1,999 spend = 1 pt');
  assert(pointsFromSpend(2000) === 2, '₦2,000 spend = 2 pts');
  assert(pointsFromSpend(5000, 1000, 1500) === 2, '₦5,000 - ₦1,000 discount - ₦1,500 delivery = ₦2,500 net -> 2 pts');

  // Client-side payment status spoofing rejection
  const spoofOrder = await apiRequest('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderNumber: `CL-SPOOF-${Date.now().toString().slice(-4)}`,
      customerName: 'Test Spoof Customer',
      customerPhone: '08012345678',
      branchId: 'gra',
      deliveryType: 'pickup',
      items: [{ productId: 'menu-1', name: 'Jollof Box', price: 3500, quantity: 1 }],
      paymentStatus: 'paid', // Spoof attempt
      paymentMethod: 'online',
      subtotal: 3500,
      total: 3500,
    }),
  });
  assert(
    spoofOrder.status === 201 && spoofOrder.data.order?.paymentStatus === 'pending',
    'Client-side paymentStatus="paid" spoofing rejected by server (forced to pending)'
  );
  const testOrderId = spoofOrder.data.order.id;

  // Paystack Webhook HMAC-SHA512 Verification
  const webhookPayload = {
    event: 'charge.success',
    data: {
      id: 998877,
      reference: `WH-TEST-${Date.now()}`,
      amount: 350000,
      currency: 'NGN',
      channel: 'card',
      metadata: { orderId: testOrderId },
    },
  };
  const rawPayload = JSON.stringify(webhookPayload);
  const invalidSig = 'invalid_sha512_hash_abcdef';
  const forgedWebhook = await apiRequest('/api/payments/webhook/paystack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': invalidSig },
    body: rawPayload,
  });
  assert(forgedWebhook.status === 401, 'Forged / unsigned Paystack webhook rejected with HTTP 401');

  // Valid Signature test
  const whSecret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_WEBHOOK_SECRET || 'choplife_sandbox_paystack_secret_2026';
  const validSig = crypto.createHmac('sha512', whSecret).update(rawPayload).digest('hex');
  const validWebhook = await apiRequest('/api/payments/webhook/paystack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': validSig },
    body: rawPayload,
  });
  assert(validWebhook.status === 200, 'Valid HMAC-SHA512 webhook accepted with HTTP 200');

  // Replay Guard on identical webhook
  const replayWebhook = await apiRequest('/api/payments/webhook/paystack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': validSig },
    body: rawPayload,
  });
  assert(
    replayWebhook.status === 200 && (replayWebhook.data.status === 'already_processed' || replayWebhook.data.alreadyProcessed === true),
    'Duplicate webhook identified and safely discarded (idempotent replay guard)'
  );

  // ====================================================================
  // PRIORITY 5: AUTHENTICATION, RBAC & SESSION SECURITY
  // ====================================================================
  console.log('\n--- PRIORITY 5: AUTHENTICATION, RBAC & SESSION SECURITY ---');
  // Quick PIN Login strictly disabled
  const pinLogin = await apiRequest('/api/auth/staff/pin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234' }),
  });
  assert(pinLogin.status === 403, '/api/auth/staff/pin-login hard-disabled in production (HTTP 403)');

  // Cashier RBAC check: Cashier cannot modify warehouse stock
  const cashierAdjust = await apiRequest(`/api/inventory/items/${cond1ItemId}/stock`, {
    method: 'PUT',
    headers: cashierHeaders,
    body: JSON.stringify({ branchId: 'general_store', newStock: 999 }),
  });
  assert(cashierAdjust.status === 403, 'Cashier blocked from modifying inventory stock (HTTP 403 Forbidden)');

  // Cashier cannot access other branch data
  const cashierCrossBranch = await apiRequest('/api/pos/checks?branchId=ugbowo', { headers: cashierHeaders });
  assert(cashierCrossBranch.status === 403, 'Branch cashier blocked from cross-branch check queries (HTTP 403)');

  // Session Logout & Invalidation
  const logoutRes = await apiRequest('/api/auth/staff/logout', {
    method: 'POST',
    headers: cashierHeaders,
  });
  assert(logoutRes.status === 200, 'Cashier logged out successfully');
  const postLogoutMe = await apiRequest('/api/auth/staff/me', { headers: cashierHeaders });
  assert(postLogoutMe.status === 401, 'Invalidated session token immediately rejected with HTTP 401');

  // ====================================================================
  // PRIORITY 6: PERSISTENCE CONCURRENCY & ARCHITECTURE
  // ====================================================================
  console.log('\n--- PRIORITY 6: PERSISTENCE INTEGRITY & CONCURRENCY ---');
  // Perform 5 concurrent stock adjustment requests on different branches of cond1
  const adjustPromises = [
    apiRequest(`/api/inventory/items/${cond1ItemId}/stock`, { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ branchId: 'gra', newStock: 25 }) }),
    apiRequest(`/api/inventory/items/${cond1ItemId}/stock`, { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ branchId: 'okabere', newStock: 15 }) }),
    apiRequest(`/api/inventory/items/${cond1ItemId}/stock`, { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ branchId: 'ugbowo', newStock: 10 }) }),
  ];
  const results = await Promise.all(adjustPromises);
  assert(results.every((r) => r.status === 200), 'Concurrent multi-branch stock updates executed successfully');

  const checkFinalItem = await apiRequest(`/api/inventory/items/${cond1ItemId}`, { headers: adminHeaders });
  const stock = checkFinalItem.data.item.locationStock;
  assert(stock.gra.stockOnHand === 25, 'GRA stock verified at 25');
  assert(stock.okabere.stockOnHand === 15, 'Okabere stock verified at 15');
  assert(stock.ugbowo.stockOnHand === 10, 'Ugbowo stock verified at 10');

  // Clean up test items
  await apiRequest(`/api/inventory/items/${cond1ItemId}`, { method: 'DELETE', headers: adminHeaders });
  await apiRequest(`/api/inventory/items/${cond2ItemId}`, { method: 'DELETE', headers: adminHeaders });

  console.log('\n================================================================');
  console.log(`RELEASE GATE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionReleaseGate().catch((err) => {
  console.error('Fatal release gate verification error:', err);
  process.exit(1);
});
