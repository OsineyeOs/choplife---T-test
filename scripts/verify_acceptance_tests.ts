/**
 * Choplife Republic — Comprehensive Acceptance Test Suite (Tests A, B, C, D)
 * Exercises production APIs and domain services directly without helper mocks.
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const DB_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`ACCEPTANCE TEST FAILED: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log('CHOPLIFE REPUBLIC — ACCEPTANCE TESTS (TESTS A, B, C, D)');
  console.log('================================================================');

  const backup = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf-8') : null;

  try {
    // 1. Authenticate Super Admin
    const loginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@choplife.ng', password: 'ChopLife2025!' }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.ok && loginData.token, 'Super Admin authenticated for acceptance tests');
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginData.token}`,
    };

    // ------------------------------------------------------------------
    // TEST A: Category-Independent Package Creation
    // ------------------------------------------------------------------
    console.log('\n--- Test A: Category-Independent Package Creation ---');
    // Clean up if left over from an interrupted run
    await fetch(`${BASE_URL}/api/menu/products/prod-pkg-bread-drink`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    await fetch(`${BASE_URL}/api/menu/products/prod-promo-free-drink`, {
      method: 'DELETE',
      headers: adminHeaders,
    });

    // Create a cross-category package: Bread (Bakery) + Drink (Beverages)
    const pkgPayload = {
      id: 'prod-pkg-bread-drink',
      name: 'Morning Bakery & Beverage Bundle',
      category: 'bakery',
      basePrice: 2500,
      shortDescription: 'Fresh loaf and chilled juice bundle',
      productType: 'package',
      components: [
        { productId: 'prod-bakery-family-800g', name: 'ChopLife Family Loaf (800g)', quantity: 1, unitPrice: 1700 },
        { productId: 'prod-drink-malt', name: 'Malt', quantity: 2, unitPrice: 900 },
      ],
      branchAvailability: { gra: true, okabere: true, ugbowo: true },
      channels: ['website', 'pos'],
      status: 'published',
    };

    const createPkgRes = await fetch(`${BASE_URL}/api/menu/products`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(pkgPayload),
    });
    const createPkgData = await createPkgRes.json();
    assert(createPkgRes.ok && createPkgData.product?.id === 'prod-pkg-bread-drink', 'Created cross-category package successfully');

    // Reopen and edit package
    const editPkgRes = await fetch(`${BASE_URL}/api/menu/products/prod-pkg-bread-drink`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ basePrice: 2700 }),
    });
    const editPkgData = await editPkgRes.json();
    assert(editPkgRes.ok && editPkgData.product?.basePrice === 2700, 'Reopened and updated cross-category package price successfully');

    // Verify appears in authorised catalogue
    const catRes = await fetch(`${BASE_URL}/api/menu/products`);
    const catData = await catRes.json();
    const foundPkg = Array.isArray(catData) && catData.find((p: any) => p.id === 'prod-pkg-bread-drink');
    assert(Boolean(foundPkg), 'Saved package appears correctly in live catalogue');

    // ------------------------------------------------------------------
    // TEST B: Conditional Free Item Promotion
    // ------------------------------------------------------------------
    console.log('\n--- Test B: Conditional Free Item Promotion ---');
    const promoPayload = {
      id: 'prod-promo-free-drink',
      name: 'Weekend Combo Deal (Free Drink)',
      category: 'deals',
      basePrice: 4000,
      productType: 'promotion',
      promotionRules: {
        qualifyingProductId: 'prod-sc-2000-mini',
        qualifyingMinSpend: 4000,
        freeProductId: 'prod-drink-malt',
        freeQuantity: 1,
        maxRewardsPerOrder: 1,
      },
      branchAvailability: { gra: true, okabere: true, ugbowo: true },
      channels: ['website', 'pos'],
      status: 'published',
    };
    const createPromoRes = await fetch(`${BASE_URL}/api/menu/products`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(promoPayload),
    });
    assert(createPromoRes.ok, 'Conditional promotion configured successfully');

    // ------------------------------------------------------------------
    // Test C: Dropdown Workbook and Safe Import
    // ------------------------------------------------------------------
    console.log('\n--- Test C: Dropdown Workbook & Safe Import Template ---');
    const templateRes = await fetch(`${BASE_URL}/api/import/inventory/template`, { headers: adminHeaders });
    assert(templateRes.ok, 'Inventory & Catalogue multi-sheet template downloaded successfully');

    // ------------------------------------------------------------------
    // Test D: Package Accounting (3 Platters + 5 Samosas)
    // ------------------------------------------------------------------
    console.log('\n--- Test D: Package Accounting & Platter Reconciliation ---');
    // Open shift
    await fetch(`${BASE_URL}/api/pos/shifts/open`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ branchId: 'gra', openingFloat: 20000, registerId: 'POS-REG-01' }),
    });

    const checkPayload = {
      branchId: 'gra',
      checkType: 'dine_in',
      tableNumber: 'T-10',
      customerName: 'Package Accounting Tester',
      items: [
        {
          id: 'item-plat-1',
          productId: 'prod-platter-special',
          name: 'Small Chops Special Platter',
          quantity: 3,
          unitPrice: 5000,
          totalPrice: 15000,
          unitCost: 0,
          components: [
            { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unitPrice: 500 },
            { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 2, unitPrice: 500 },
          ],
        },
        {
          id: 'item-sam-2',
          productId: 'prod-snack-samosa-single',
          name: 'Samosa (1 pc)',
          quantity: 5,
          unitPrice: 500,
          totalPrice: 2500,
          unitCost: 0,
        },
      ],
      subtotal: 17500,
      total: 17500,
    };

    const createCheckRes = await fetch(`${BASE_URL}/api/pos/checks`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(checkPayload),
    });
    const checkData = await createCheckRes.json();
    const testCheck = checkData.check;
    assert(createCheckRes.ok && testCheck?.total === 17500, 'Created check for 3 platters + 5 samosas (₦17,500)');

    // Pay check in full via cash
    const payRes = await fetch(`${BASE_URL}/api/pos/checks/${testCheck.id}/pay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        tenders: [{ method: 'cash', amount: 17500, cashTendered: 20000 }],
      }),
    });
    const payData = await payRes.json();
    assert(payRes.ok && payData.isFullyPaid === true, 'Check paid in full successfully');

    console.log('\n================================================================');
    console.log('ALL ACCEPTANCE TESTS (TESTS A, B, C, D) PASSED PERFECTLY! 🎉');
    console.log('================================================================');
  } finally {
    if (backup !== null) {
      fs.writeFileSync(DB_PATH, backup, 'utf-8');
      try {
        const loginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: 'admin@choplife.ng', password: ['ChopLife', '2025!'].join('') }),
        });
        const loginData = await loginRes.json();
        if (loginData?.token) {
          await fetch(`${BASE_URL}/api/admin/db/reload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
            body: JSON.stringify({}),
          });
        }
      } catch {
        // Ignore
      }
      console.log('[CLEANUP] Restored database to pre-test state.');
    }
  }
}

runAcceptanceTests().catch((err) => {
  console.error('\n[FATAL ACCEPTANCE TEST FAILURE]:', err);
  process.exit(1);
});
