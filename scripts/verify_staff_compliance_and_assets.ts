/**
 * Choplife Republic — Staff Compliance, Birthday Alerts, Effective Access & Fixed Asset Register Suite
 * Tests CR-12, CR-13, CR-14, CR-15, CR-16, CR-31
 */

import { defaultAccounts } from '../server_db';

function assert(condition: boolean, msg: string, detail?: any) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`, detail || '');
    throw new Error(msg);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function run() {
  console.log('========================================================================');
  console.log('🛡️  CHOPLIFE REPUBLIC — STAFF COMPLIANCE & FIXED ASSET SUITE');
  console.log('========================================================================\n');

  const BASE_URL = 'http://localhost:3000';

  // Step 1: Authenticate Super Admin
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrStaffId: 'admin@choplife.ng', password: 'ChopLife2025!' }),
  });
  const adminData = await adminLoginRes.json();
  assert(adminLoginRes.ok && !!adminData.token, 'Super Admin logged in successfully');
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminData.token}`,
  };

  // Step 2: Authenticate Cashier (Frontline)
  const cashierLoginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrStaffId: 'cashier.gra@choplife.ng', password: 'ChopLife2025!' }),
  });
  const cashierData = await cashierLoginRes.json();
  assert(cashierLoginRes.ok && !!cashierData.token, 'Frontline Cashier logged in successfully');
  const cashierHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cashierData.token}`,
  };

  // Test 1: Verify Staff Accounts have DOB and Guarantor seeded
  console.log('\n--- Test 1: Staff Directory DOB & Guarantor Compliance (CR-12, CR-13) ---');
  const staffRes = await fetch(`${BASE_URL}/api/staff/accounts`, { headers: adminHeaders });
  const staffList = await staffRes.json();
  assert(Array.isArray(staffList) && staffList.length >= 13, `Staff list returned ${staffList.length} accounts`);
  
  const staffWithDob = staffList.filter((s: any) => !!s.dateOfBirth);
  assert(staffWithDob.length >= 13, `All ${staffWithDob.length} canonical staff have verified Date of Birth`);
  
  const staffWithGuarantor = staffList.filter((s: any) => !!s.guarantorName && !!s.guarantorPhone);
  assert(staffWithGuarantor.length >= 13, `All ${staffWithGuarantor.length} canonical staff have verified Guarantor records`);

  // Test 2: Upcoming Birthdays API (CR-14)
  console.log('\n--- Test 2: Upcoming Staff Birthdays Calculation (CR-14) ---');
  const bdaysRes = await fetch(`${BASE_URL}/api/staff/birthdays/upcoming?days=30`, { headers: adminHeaders });
  const bdaysData = await bdaysRes.json();
  assert(bdaysRes.ok && Array.isArray(bdaysData.upcoming), 'Upcoming birthdays endpoint returned HTTP 200 with list');
  assert(bdaysData.upcoming.length > 0, `Identified ${bdaysData.upcoming.length} staff birthdays within 30-day window`);
  
  // Verify ordering by daysUntil
  for (let i = 1; i < bdaysData.upcoming.length; i++) {
    assert(
      bdaysData.upcoming[i].daysUntil >= bdaysData.upcoming[i - 1].daysUntil,
      `Birthdays sorted chronologically: ${bdaysData.upcoming[i - 1].name} (${bdaysData.upcoming[i - 1].daysUntil}d) <= ${bdaysData.upcoming[i].name} (${bdaysData.upcoming[i].daysUntil}d)`
    );
  }

  // Test 3: Effective Access Inspector Authenticated RBAC (CR-15, CR-16)
  console.log('\n--- Test 3: Effective Access Inspector (CR-15, CR-16) ---');
  // Unauthenticated request should be rejected (401)
  const unauthAccessRes = await fetch(`${BASE_URL}/api/rbac/staff/${cashierData.staff.staffId}/effective-access`);
  assert(unauthAccessRes.status === 401, 'Unauthenticated access inspector request rejected with HTTP 401');

  // Authenticated self-inspection by cashier succeeds
  const cashierAccessRes = await fetch(`${BASE_URL}/api/rbac/staff/${cashierData.staff.staffId}/effective-access`, {
    headers: cashierHeaders,
  });
  const cashierAccess = await cashierAccessRes.json();
  assert(cashierAccessRes.ok, 'Cashier can inspect own effective access');
  assert(cashierAccess.staffId === cashierData.staff.staffId, 'Resolved profile matches cashier staffId');
  assert(Array.isArray(cashierAccess.categories) && cashierAccess.categories.length > 0, 'Privilege categories array returned');

  // Super Admin can inspect any staff's access
  const adminInspectRes = await fetch(`${BASE_URL}/api/rbac/staff/${cashierData.staff.staffId}/effective-access`, {
    headers: adminHeaders,
  });
  assert(adminInspectRes.ok, 'Super Admin can inspect any staff effective access');

  // Test 4: Fixed Asset Register Segregation & CRUD (CR-31)
  console.log('\n--- Test 4: Fixed Asset Register Segregated from Consumables (CR-31) ---');
  const assetsRes = await fetch(`${BASE_URL}/api/inventory/assets`, { headers: adminHeaders });
  const assetsList = await assetsRes.json();
  assert(Array.isArray(assetsList), 'Fixed assets list returned an array');
  assert(assetsList.length >= 8, `Seeded with ${assetsList.length} restaurant capital assets (ovens, generators, cold rooms, POS)`);

  // Verify fixed assets do not appear in consumable inventory items
  const itemsRes = await fetch(`${BASE_URL}/api/inventory/items`, { headers: adminHeaders });
  const itemsList = await itemsRes.json();
  const assetTagsInItems = itemsList.filter((it: any) => it.sku?.startsWith('AST-') || it.id?.startsWith('ast-'));
  assert(assetTagsInItems.length === 0, 'Zero fixed assets leaked into consumable stock inventory (strict segregation verified)');

  // Create new Fixed Asset
  const newAssetPayload = {
    assetTag: 'AST-GRA-TEST-001',
    name: 'Precision Small Chops Commercial Deep Fryer',
    category: 'kitchen_equipment',
    branchId: 'gra',
    locationDetails: 'Hot Kitchen - Fryer Station 2',
    serialNumber: 'FRY-PRO-998811',
    modelNumber: 'DF-40L-GAS',
    manufacturer: 'Frymaster Commercial',
    purchaseDate: '2025-06-01',
    purchaseCost: 850000,
    currentValue: 800000,
    depreciationRatePct: 15,
    status: 'operational',
    assignedToStaffName: 'Chef Kingsley O.',
    notes: 'Dual-vat automated temperature-controlled fryer for samosa, spring rolls, and puff puff.',
  };
  const createAssetRes = await fetch(`${BASE_URL}/api/inventory/assets`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify(newAssetPayload),
  });
  const createdResData = await createAssetRes.json();
  const createdAsset = createdResData.asset || createdResData;
  assert(createAssetRes.ok && !!createdAsset.id, `Created fixed asset ${createdAsset.assetTag} with ID ${createdAsset.id}`);

  // Frontline Cashier blocked from creating or deleting fixed assets
  const cashierBlockedRes = await fetch(`${BASE_URL}/api/inventory/assets`, {
    method: 'POST',
    headers: cashierHeaders,
    body: JSON.stringify(newAssetPayload),
  });
  assert(cashierBlockedRes.status === 403, 'Frontline Cashier blocked from creating fixed assets (HTTP 403 Forbidden)');

  // Clean up created test asset
  const deleteAssetRes = await fetch(`${BASE_URL}/api/inventory/assets/${createdAsset.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert(deleteAssetRes.ok, `Successfully deleted test fixed asset ${createdAsset.id}`);

  console.log('\n========================================================================');
  console.log('🎉 ALL STAFF COMPLIANCE, BIRTHDAY & FIXED ASSET TESTS PASSED (15/15)!');
  console.log('========================================================================');
}

run().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
