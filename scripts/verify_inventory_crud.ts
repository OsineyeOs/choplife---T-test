/**
 * Choplife Republic — Inventory CRUD & Demo Management Automated Test Suite
 * Validates:
 * 1. Super Admin item creation (zero stock vs positive opening stock with ledger traceability)
 * 2. SKU uniqueness constraint enforcement (409 Conflict)
 * 3. Master details update without stockOnHand mutation (clear separation of workflows)
 * 4. Dedicated stock quantity adjustment with auditable ledger entry
 * 5. Role-based access control (Cashier rejected with 403; Super Admin permitted)
 * 6. Reference audit & safe deletion:
 *    - Unreferenced draft items: hard deleted (200, action: 'deleted')
 *    - Referenced items (or items with active stock): safely archived (200, action: 'archived', isActive: false, isArchived: true)
 * 7. Demo catalogue seed & reset:
 *    - Seeding creates 5 demo items across categories with isDemo: true
 *    - Demo filtering separates demo items from operational items
 *    - Demo reset safely purges demo items and demo ledger records without touching operational data
 * 8. Item movement history retrieval
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('CHOPLIFE REPUBLIC — INVENTORY CRUD & DEMO SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Authenticate Personas
  console.log('Step 1: Authenticating Super Admin and Cashier...');
  const superAdminLoginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrStaffId: 'oluwaseun.osineye@gmail.com', password: 'ChopLife2025!' }),
  });
  const superAdminData: any = await superAdminLoginRes.json();
  assert(superAdminLoginRes.ok && Boolean(superAdminData.token), 'Super Admin successfully authenticated');
  const superAdminToken = superAdminData.token;

  const cashierLoginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrStaffId: 'CL-CSH-001', password: 'ChopLife2025!' }),
  });
  const cashierData: any = await cashierLoginRes.json();
  assert(cashierLoginRes.ok && Boolean(cashierData.token), 'Cashier successfully authenticated');
  const cashierToken = cashierData.token;

  // 2. Super Admin Creates Item with Zero Initial Stock
  console.log('\nStep 2: Creating Item with 0 Initial Stock...');
  const draftSku = `TEST-DFT-${Date.now().toString().slice(-4)}`;
  const draftCreateRes = await fetch(`${BASE_URL}/api/inventory/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: 'Unreferenced Draft Item',
      sku: draftSku,
      category: 'ingredients',
      baseUnit: 'kg',
      unit: 'kg',
      costPerUnit: 1500,
      initialStock: 0,
    }),
  });
  const draftCreateData: any = await draftCreateRes.json();
  assert(draftCreateRes.status === 201 && draftCreateData.success, 'Super Admin created draft item with 0 stock');
  const draftId = draftCreateData.item?.id;

  // Verify no opening ledger entry was created for 0 stock
  const ledgerRes = await fetch(`${BASE_URL}/api/inventory/items/${draftId}/ledger`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const draftLedgerData: any = await ledgerRes.json();
  assert(Array.isArray(draftLedgerData) && draftLedgerData.length === 0, 'No opening ledger entry created for zero initial stock (audit rule verified)');

  // 3. Super Admin Creates Item with Positive Opening Stock
  console.log('\nStep 3: Creating Item with Positive Initial Stock (+30 units)...');
  const positiveSku = `TEST-OPN-${Date.now().toString().slice(-4)}`;
  const positiveCreateRes = await fetch(`${BASE_URL}/api/inventory/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: 'Opening Stock Tested Flour (50kg)',
      sku: positiveSku,
      category: 'bakery',
      baseUnit: 'bag',
      unit: 'bag',
      costPerUnit: 42000,
      initialStock: 30,
      initialLocationId: 'gra',
      openingStockNotes: 'Initial warehouse intake verification',
    }),
  });
  const positiveCreateData: any = await positiveCreateRes.json();
  assert(positiveCreateRes.status === 201 && positiveCreateData.success, 'Super Admin created item with positive initial stock');
  const positiveItemId = positiveCreateData.item?.id;

  // Verify traceable opening ledger entry was posted
  const positiveLedgerRes = await fetch(`${BASE_URL}/api/inventory/items/${positiveItemId}/ledger`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const positiveLedgerData: any = await positiveLedgerRes.json();
  assert(
    Array.isArray(positiveLedgerData) &&
      positiveLedgerData.length === 1 &&
      positiveLedgerData[0].transactionType === 'ADJUSTMENT_INCREASE' &&
      positiveLedgerData[0].reasonCategory === 'Initial Opening Stock' &&
      positiveLedgerData[0].quantityDelta === 30 &&
      positiveLedgerData[0].locationId === 'gra',
    'Traceable opening stock ledger transaction posted with reasonCategory: Initial Opening Stock'
  );

  // 4. SKU Uniqueness Constraint Test
  console.log('\nStep 4: Testing SKU Uniqueness Rejection...');
  const duplicateSkuRes = await fetch(`${BASE_URL}/api/inventory/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: 'Duplicate SKU Impostor',
      sku: positiveSku, // Reusing existing SKU
      category: 'ingredients',
      unit: 'kg',
    }),
  });
  const duplicateSkuData: any = await duplicateSkuRes.json();
  assert(duplicateSkuRes.status === 409, 'Duplicate SKU rejected with 409 Conflict');
  assert(duplicateSkuData.error?.includes('SKU conflict'), 'Conflict error message clearly identifies SKU duplicate');

  // 5. Updating Master Details without Modifying StockOnHand
  console.log('\nStep 5: Editing Master Item Details (Preserving Stock Balance)...');
  const editDetailsRes = await fetch(`${BASE_URL}/api/inventory/items/${positiveItemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: 'Opening Stock Tested Flour (Updated Premium 50kg)',
      description: 'Modified formulation description',
      costPerUnit: 43500,
      parLevel: 80,
      minThreshold: 15,
    }),
  });
  const editDetailsData: any = await editDetailsRes.json();
  assert(editDetailsRes.ok && editDetailsData.success, 'Master item metadata updated successfully');
  assert(editDetailsData.item?.name === 'Opening Stock Tested Flour (Updated Premium 50kg)', 'Item name updated');
  assert(editDetailsData.item?.costPerUnit === 43500, 'Unit cost updated');
  assert(
    editDetailsData.item?.locationStock?.gra?.stockOnHand === 30,
    'Stock on hand remained exactly 30 (editing metadata did not mutate stock on hand)'
  );

  // 6. Dedicated Physical Stock Quantity Adjustment
  console.log('\nStep 6: Dedicated Stock Quantity Adjustment...');
  const adjustStockRes = await fetch(`${BASE_URL}/api/inventory/items/${positiveItemId}/stock`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      branchId: 'gra',
      quantity: 35,
      reason: 'Physical cycle recount count-in (+5 bags)',
    }),
  });
  const adjustStockData: any = await adjustStockRes.json();
  assert(adjustStockRes.ok && adjustStockData.success, 'Stock quantity adjusted to 35');
  assert(adjustStockData.item?.locationStock?.gra?.stockOnHand === 35, 'Stock on hand verified at 35 in GRA');

  // Verify second ledger transaction
  const updatedLedgerRes = await fetch(`${BASE_URL}/api/inventory/items/${positiveItemId}/ledger`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const updatedLedgerData: any = await updatedLedgerRes.json();
  assert(updatedLedgerData.length === 2, 'Ledger now contains exactly 2 chronological movement entries');

  // 7. Role-Based Access Control
  console.log('\nStep 7: Testing RBAC Permissions (Cashier Rejected)...');
  const cashierCreateRes = await fetch(`${BASE_URL}/api/inventory/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`,
    },
    body: JSON.stringify({
      name: 'Unauthorized Cashier Item',
      category: 'ingredients',
      unit: 'kg',
    }),
  });
  assert(cashierCreateRes.status === 403, 'Cashier blocked from creating stock items (403 Forbidden)');

  const cashierDeleteRes = await fetch(`${BASE_URL}/api/inventory/items/${draftId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  assert(cashierDeleteRes.status === 403, 'Cashier blocked from deleting stock items (403 Forbidden)');

  // 8. Reference Audit & Safe Deletion
  console.log('\nStep 8: Testing Reference Audit & Safe Deletion...');
  // A. Unreferenced Draft item -> should be hard-deleted
  const draftAuditRes = await fetch(`${BASE_URL}/api/inventory/items/${draftId}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const draftAuditData: any = await draftAuditRes.json();
  assert(draftAuditData.referenceAudit?.canHardDelete === true, 'Draft item with 0 stock and no references flagged canHardDelete = true');

  const draftDeleteRes = await fetch(`${BASE_URL}/api/inventory/items/${draftId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const draftDeleteData: any = await draftDeleteRes.json();
  assert(draftDeleteRes.ok && draftDeleteData.action === 'deleted', 'Unreferenced draft item was permanently hard deleted');

  // B. Referenced item (with 35 bags in stock & 2 ledger entries) -> must be safely archived
  const refDeleteRes = await fetch(`${BASE_URL}/api/inventory/items/${positiveItemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const refDeleteData: any = await refDeleteRes.json();
  assert(refDeleteRes.ok && refDeleteData.action === 'archived', 'Referenced item with active stock was safely archived, NOT hard deleted');
  assert(refDeleteData.item?.isActive === false && refDeleteData.item?.isArchived === true, 'Item flagged isActive = false, isArchived = true');

  // 9. Demo Catalogue Seeding, Filtering & Reset
  console.log('\nStep 9: Testing Demo Catalogue Seeding, Filtering & Reset...');
  const seedDemoRes = await fetch(`${BASE_URL}/api/inventory/demo/seed`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const seedDemoData: any = await seedDemoRes.json();
  assert(seedDemoRes.ok && seedDemoData.success && seedDemoData.count === 5, 'Seeded 5 demo catalogue items');
  assert(seedDemoData.createdCount === 5, 'Initial seed created exactly 5 demo items');

  // Verify Idempotent Seeding (Repeating seed does NOT duplicate items or ledger entries)
  const repeatSeedRes = await fetch(`${BASE_URL}/api/inventory/demo/seed`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const repeatSeedData: any = await repeatSeedRes.json();
  assert(repeatSeedRes.ok && repeatSeedData.success, 'Repeated seed request succeeded idempotently');
  assert(repeatSeedData.createdCount === 0, 'Repeated seed created 0 new items');
  assert(repeatSeedData.skippedCount === 5, 'Repeated seed detected and skipped all 5 existing demo items');

  // Filter by demo origin
  const demoOnlyRes = await fetch(`${BASE_URL}/api/inventory/items?origin=demo`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const demoOnlyData: any = await demoOnlyRes.json();
  assert(demoOnlyData.length >= 5 && demoOnlyData.every((it: any) => it.isDemo === true), 'Filter origin=demo returned only items with isDemo: true');

  // Filter by operational origin
  const opOnlyRes = await fetch(`${BASE_URL}/api/inventory/items?origin=operational`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const opOnlyData: any = await opOnlyRes.json();
  assert(opOnlyData.every((it: any) => !it.isDemo), 'Filter origin=operational excluded all demo items');

  // Step 10: Testing Branch vs Network-wide Stock Filtering
  console.log('\nStep 10: Testing Branch vs Network-Wide Stock Level Filtering...');
  // Query all in-stock network-wide
  const netInStockRes = await fetch(`${BASE_URL}/api/inventory/items?stockLevel=in_stock&locationId=all`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const netInStockData: any = await netInStockRes.json();
  assert(Array.isArray(netInStockData) && netInStockData.length > 0, 'Network-wide in_stock query returned items');

  // Verify positiveItemId is in network-wide in_stock because it has 35 units at GRA
  const foundNetInStock = netInStockData.some((it: any) => it.id === positiveItemId);
  assert(foundNetInStock, 'Item with stock at GRA is NOT excluded from network-wide in_stock despite 0 stock at other branches');

  // Query GRA branch specifically for in_stock
  const graInStockRes = await fetch(`${BASE_URL}/api/inventory/items?stockLevel=in_stock&locationId=gra`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const graInStockData: any = await graInStockRes.json();
  assert(graInStockData.some((it: any) => it.id === positiveItemId), 'Item is in_stock when filtering specifically by GRA');

  // Query Okabere branch specifically for out_of_stock
  const okaOutOfStockRes = await fetch(`${BASE_URL}/api/inventory/items?stockLevel=out_of_stock&locationId=okabere`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const okaOutOfStockData: any = await okaOutOfStockRes.json();
  assert(okaOutOfStockData.some((it: any) => it.id === positiveItemId), 'Item with 0 at Okabere is truthfully out_of_stock when filtering Okabere only');

  // Reset Demo Catalogue
  const resetDemoRes = await fetch(`${BASE_URL}/api/inventory/demo/reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const resetDemoData: any = await resetDemoRes.json();
  assert(resetDemoRes.ok && resetDemoData.success, 'Demo catalogue reset succeeded');
  assert(resetDemoData.removedItemsCount >= 5, 'Purged demo items safely');

  // Verify demo items are gone from db.inventory
  const postResetDemoRes = await fetch(`${BASE_URL}/api/inventory/items?origin=demo`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const postResetDemoData: any = await postResetDemoRes.json();
  assert(postResetDemoData.length === 0, 'No demo items remain in inventory after reset');

  // Clean up test item
  const postCleanupRes = await fetch(`${BASE_URL}/api/inventory/items/${positiveItemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(postCleanupRes.ok, 'Test cleanup completed');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
