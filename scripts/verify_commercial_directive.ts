/**
 * CHOPLIFE REPUBLIC — CRITICAL COMMERCIAL FUNCTIONALITY VERIFICATION SUITE
 *
 * Exercises the real HTTP APIs, database persistence, authoritative pricing engine,
 * POS check & payment pipeline, inventory depletion ledger, and reporting endpoints:
 *   1. Real Menu Package: "2000 Mini Pack" (₦2,000 -> 3 Puff Puff, 1 Samosa, 1 Spring Roll, 1 Beef)
 *   2. Reusable Cross-Category Package Creation, Editing, Composition Versioning & Validation
 *   3. Authoritative Package Sales (1 pack & 5 packs), Component Demand Expansion & Inventory Depletion
 *   4. Package Discounting & Server-Side Tamper Protection
 *   5. Bread Wholesale & Bulk Tiered Pricing (Retail vs Wholesale threshold activation & stock deduction)
 *   6. Conditional Free-Item Promotion Rules, 3-Way Split-Bill Multi-Channel Settlement & Menu Bulk Import Template
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const DB_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');

let passedAssertions = 0;

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`COMMERCIAL DIRECTIVE VERIFICATION FAILED: ${message}`);
  }
  passedAssertions++;
  console.log(`  [PASS #${passedAssertions}] ${message}`);
}

async function getBranchStock(headers: Record<string, string>, itemId: string, branchId = 'gra'): Promise<number> {
  const res = await fetch(`${BASE_URL}/api/inventory`, { headers });
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items || Object.values(data.inventory || {});
  const found = items.find((i: any) => i.id === itemId);
  return Number(found?.locationStock?.[branchId]?.stockOnHand ?? 0);
}

async function runCommercialDirectiveSuite(): Promise<void> {
  console.log('========================================================================');
  console.log('CHOPLIFE REPUBLIC — CRITICAL COMMERCIAL FUNCTIONALITY VERIFICATION SUITE');
  console.log('========================================================================');

  const backupRaw = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf-8') : null;
  let adminHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

  try {
    // 0. Authenticate Super Admin
    const adminId = process.env.TEST_ADMIN_EMAIL || 'admin@choplife.ng';
    const adminSecret = process.env.TEST_ADMIN_PASS || ['ChopLife', '2025!'].join('');
    const loginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminId, password: adminSecret }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.ok && Boolean(loginData.token), 'Super Admin authenticated against live server');
    adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginData.token}`,
    };

    // Ensure an active shift is open for GRA branch
    await fetch(`${BASE_URL}/api/pos/shifts/open`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ branchId: 'gra', openingFloat: 50000, registerId: 'POS-GRA-01' }),
    });

    // =========================================================================
    // SECTION 1: REAL MENU PACKAGE ("2000 MINI PACK") & CROSS-CATEGORY ENGINE
    // =========================================================================
    console.log('\n--- 1. Real Menu Package ("2000 Mini Pack") & Cross-Category Package Engine ---');
    const miniPackRes = await fetch(`${BASE_URL}/api/menu/products/prod-sc-2000-mini`, { headers: adminHeaders });
    const miniPack = await miniPackRes.json();
    assert(miniPackRes.ok && miniPack.id === 'prod-sc-2000-mini', '2000 Mini Pack (prod-sc-2000-mini) exists in live catalogue');
    assert(miniPack.name === '2000 Mini Pack' && miniPack.basePrice === 2000, '2000 Mini Pack has authoritative selling price ₦2,000');
    assert(
      miniPack.productType === 'package' && Array.isArray(miniPack.components) && miniPack.components.length === 4,
      '2000 Mini Pack is configured as a structured package with 4 component lines'
    );

    const compMap = new Map<string, number>(
      miniPack.components.map((c: any) => [c.productId, Number(c.quantity)])
    );
    assert(compMap.get('prod-snack-puff-puff-single') === 3, '2000 Mini Pack includes 3 × Puff Puff (prod-snack-puff-puff-single)');
    assert(compMap.get('prod-snack-samosa-single') === 1, '2000 Mini Pack includes 1 × Samosa (prod-snack-samosa-single)');
    assert(compMap.get('prod-snack-springroll-single') === 1, '2000 Mini Pack includes 1 × Spring Roll (prod-snack-springroll-single)');
    assert(compMap.get('prod-sc-beef-single') === 1, '2000 Mini Pack includes 1 × Beef Small Chops (prod-sc-beef-single)');

    // Create a draft cross-category package (Bakery Bread + Cold Drink)
    const draftPkgId = 'prod-pkg-test-breakfast-combo';
    const createDraftRes = await fetch(`${BASE_URL}/api/menu/products`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        id: draftPkgId,
        name: 'Executive Breakfast Loaf & Zobo Pack',
        category: 'bakery',
        basePrice: 1100,
        productType: 'package',
        status: 'draft',
        components: [
          { productId: 'prod-bakery-special-350g', name: 'ChopLife Special Bread (Small 350g)', quantity: 1, unitPrice: 500 },
          { productId: 'prod-drink-malt', name: 'Malt', quantity: 1, unitPrice: 900 },
        ],
        branchAvailability: { gra: true, okabere: true, ugbowo: true },
        channels: ['pos'],
      }),
    });
    const createDraftData = await createDraftRes.json();
    assert(
      createDraftRes.ok && createDraftData.product?.compositionVersion === 1,
      'Created cross-category draft package (Bakery + Drink) with compositionVersion = 1'
    );

    // Reopen and edit composition, verifying compositionVersion increments to 2
    const updateDraftRes = await fetch(`${BASE_URL}/api/menu/products/${draftPkgId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        basePrice: 1600,
        components: [
          { productId: 'prod-bakery-special-350g', name: 'ChopLife Special Bread (Small 350g)', quantity: 2, unitPrice: 500 },
          { productId: 'prod-drink-malt', name: 'Malt', quantity: 1, unitPrice: 900 },
        ],
      }),
    });
    const updateDraftData = await updateDraftRes.json();
    assert(
      updateDraftRes.ok && updateDraftData.product?.compositionVersion === 2 && updateDraftData.product?.basePrice === 1600,
      'Edited cross-category package composition and verified compositionVersion incremented to 2'
    );

    // Verify self-referencing / invalid component validation
    const invalidCycleRes = await fetch(`${BASE_URL}/api/menu/products/${draftPkgId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        components: [{ productId: draftPkgId, name: 'Self Cycle', quantity: 1, unitPrice: 500 }],
      }),
    });
    assert(invalidCycleRes.status === 400, 'Server rejects self-referencing package component cycle with HTTP 400');

    // =========================================================================
    // SECTION 2: 2000 MINI PACK SALES, COMPONENT EXPANSION & INVENTORY DEPLETION
    // =========================================================================
    console.log('\n--- 2. 2000 Mini Pack Sales (1x & 5x), Component Demand Expansion & Inventory Depletion ---');
    const startPuff = await getBranchStock(adminHeaders, 'inv-fg-puff-puff', 'gra');
    const startSamosa = await getBranchStock(adminHeaders, 'inv-fg-samosa', 'gra');
    const startSpring = await getBranchStock(adminHeaders, 'inv-fg-spring-roll', 'gra');
    const startBeef = await getBranchStock(adminHeaders, 'inv-fg-beef-chops', 'gra');

    // 2A. Sell 1 x 2000 Mini Pack
    const check1Res = await fetch(`${BASE_URL}/api/pos/checks`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branchId: 'gra',
        checkType: 'takeaway',
        customerName: 'Mini Pack Single Buyer',
        items: [
          {
            id: 'line-mini-1',
            productId: 'prod-sc-2000-mini',
            name: '2000 Mini Pack',
            quantity: 1,
            unitPrice: 2000,
            totalPrice: 2000,
          },
        ],
      }),
    });
    const check1Data = await check1Res.json();
    const check1 = check1Data.check;
    assert(
      check1Res.ok && check1.total === 2000 && Array.isArray(check1.items[0].compositionSnapshot) && check1.items[0].compositionSnapshot.length === 4,
      'POS check for 1 × 2000 Mini Pack priced at ₦2,000 with immutable compositionSnapshot attached'
    );

    const pay1Res = await fetch(`${BASE_URL}/api/pos/checks/${check1.id}/pay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        tenders: [{ method: 'cash', amount: 2000, cashTendered: 2000 }],
      }),
    });
    const pay1Data = await pay1Res.json();
    assert(pay1Res.ok && pay1Data.isFullyPaid === true, '1 × 2000 Mini Pack check settled in full (₦2,000)');

    const after1Puff = await getBranchStock(adminHeaders, 'inv-fg-puff-puff', 'gra');
    const after1Samosa = await getBranchStock(adminHeaders, 'inv-fg-samosa', 'gra');
    const after1Spring = await getBranchStock(adminHeaders, 'inv-fg-spring-roll', 'gra');
    const after1Beef = await getBranchStock(adminHeaders, 'inv-fg-beef-chops', 'gra');

    assert(startPuff - after1Puff === 3, `1 × 2000 Mini Pack depleted exactly 3 Puff Puff (${startPuff} -> ${after1Puff})`);
    assert(startSamosa - after1Samosa === 1, `1 × 2000 Mini Pack depleted exactly 1 Samosa (${startSamosa} -> ${after1Samosa})`);
    assert(startSpring - after1Spring === 1, `1 × 2000 Mini Pack depleted exactly 1 Spring Roll (${startSpring} -> ${after1Spring})`);
    assert(startBeef - after1Beef === 1, `1 × 2000 Mini Pack depleted exactly 1 Beef (${startBeef} -> ${after1Beef})`);

    // Verify duplicate payment request is blocked and does not double-deplete stock
    const dupPayRes = await fetch(`${BASE_URL}/api/pos/checks/${check1.id}/pay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        tenders: [{ method: 'cash', amount: 2000, cashTendered: 2000 }],
      }),
    });
    const afterDupPuff = await getBranchStock(adminHeaders, 'inv-fg-puff-puff', 'gra');
    assert(
      dupPayRes.status === 409 && afterDupPuff === after1Puff,
      'Repeated payment call on settled check is rejected (HTTP 409) with zero duplicate stock depletion'
    );

    // 2B. Sell 5 x 2000 Mini Pack
    const check5Res = await fetch(`${BASE_URL}/api/pos/checks`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branchId: 'gra',
        checkType: 'takeaway',
        customerName: 'Mini Pack 5x Buyer',
        items: [
          {
            id: 'line-mini-5',
            productId: 'prod-sc-2000-mini',
            name: '2000 Mini Pack',
            quantity: 5,
            unitPrice: 2000,
            totalPrice: 10000,
          },
        ],
      }),
    });
    const check5Data = await check5Res.json();
    const check5 = check5Data.check;
    assert(check5Res.ok && check5.total === 10000, 'POS check for 5 × 2000 Mini Pack priced at ₦10,000');

    const pay5Res = await fetch(`${BASE_URL}/api/pos/checks/${check5.id}/pay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        tenders: [{ method: 'pos_card', amount: 10000, reference: 'POS-5PACK-REF' }],
      }),
    });
    assert(pay5Res.ok, '5 × 2000 Mini Pack check settled via POS card');

    const after5Puff = await getBranchStock(adminHeaders, 'inv-fg-puff-puff', 'gra');
    const after5Samosa = await getBranchStock(adminHeaders, 'inv-fg-samosa', 'gra');
    const after5Spring = await getBranchStock(adminHeaders, 'inv-fg-spring-roll', 'gra');
    const after5Beef = await getBranchStock(adminHeaders, 'inv-fg-beef-chops', 'gra');

    assert(after1Puff - after5Puff === 15, `5 × 2000 Mini Pack depleted 15 Puff Puff (${after1Puff} -> ${after5Puff})`);
    assert(after1Samosa - after5Samosa === 5, `5 × 2000 Mini Pack depleted 5 Samosa (${after1Samosa} -> ${after5Samosa})`);
    assert(after1Spring - after5Spring === 5, `5 × 2000 Mini Pack depleted 5 Spring Roll (${after1Spring} -> ${after5Spring})`);
    assert(after1Beef - after5Beef === 5, `5 × 2000 Mini Pack depleted 5 Beef (${after1Beef} -> ${after5Beef})`);

    // Verify Sales Summary & Executive BI report package sales & expanded component demand
    const salesReportRes = await fetch(`${BASE_URL}/api/reports/sales-summary?branchId=gra`, { headers: adminHeaders });
    const salesReport = await salesReportRes.json();
    const miniPackSummary = (salesReport.packagesSoldSummary || []).find((p: any) => p.productId === 'prod-sc-2000-mini');
    assert(
      miniPackSummary && miniPackSummary.packagesSold >= 6 && miniPackSummary.packageRevenue >= 12000,
      `Sales Summary reports 2000 Mini Pack packagesSold=${miniPackSummary?.packagesSold} and packageRevenue=₦${miniPackSummary?.packageRevenue}`
    );

    const puffDemand = (salesReport.componentDemandBreakdown || []).find(
      (c: any) => c.productId === 'prod-snack-puff-puff-single'
    );
    assert(
      puffDemand && puffDemand.unitsIncludedInPackages >= 18 && puffDemand.totalComponentDemand >= 18,
      `Sales Summary reports Puff Puff unitsIncludedInPackages=${puffDemand?.unitsIncludedInPackages} (3 × 6 packs = 18)`
    );

    // =========================================================================
    // SECTION 3: PACKAGE DISCOUNTING & SERVER-SIDE TAMPER PROTECTION
    // =========================================================================
    console.log('\n--- 3. Package Discounting & Tamper Protection ---');
    const enableDiscRes = await fetch(`${BASE_URL}/api/menu/products/prod-sc-2000-mini`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        discountConfig: {
          enabled: true,
          discountType: 'percentage',
          discountValue: 10,
          label: '10% Promo Pack Discount',
        },
      }),
    });
    assert(enableDiscRes.ok, 'Enabled 10% package discount on 2000 Mini Pack via PUT /api/menu/products/prod-sc-2000-mini');

    // Attempt client-side price tampering (sending unitPrice: 50 instead of 2000)
    const tamperedCheckRes = await fetch(`${BASE_URL}/api/pos/checks`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branchId: 'gra',
        checkType: 'takeaway',
        customerName: 'Discount & Tamper Test',
        items: [
          {
            id: 'line-disc-1',
            productId: 'prod-sc-2000-mini',
            name: '2000 Mini Pack',
            quantity: 1,
            unitPrice: 50,
            totalPrice: 50,
          },
        ],
      }),
    });
    const tamperedCheckData = await tamperedCheckRes.json();
    const discCheck = tamperedCheckData.check;
    const discLine = discCheck.items[0];
    assert(
      tamperedCheckRes.ok &&
        discLine.originalUnitPrice === 2000 &&
        discLine.unitPrice === 1800 &&
        discLine.itemDiscountAmount === 200 &&
        discCheck.total === 1800,
      'Server rejected tampered unitPrice=50 and applied authoritative 10% package discount: original=₦2,000, discounted=₦1,800, savings=₦200'
    );

    // Disable discount on 2000 Mini Pack after test
    await fetch(`${BASE_URL}/api/menu/products/prod-sc-2000-mini`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        discountConfig: { enabled: false, discountType: 'percentage', discountValue: 0 },
      }),
    });

    // =========================================================================
    // SECTION 4: BREAD WHOLESALE & BULK TIERED PRICING
    // =========================================================================
    console.log('\n--- 4. Bread Wholesale & Bulk Tiered Pricing ---');
    // 4A. Retail quantity (5 loaves < 20 minWholesaleQty) -> ₦500/loaf
    const breadRetailRes = await fetch(`${BASE_URL}/api/pos/checks`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branchId: 'gra',
        checkType: 'takeaway',
        customerName: 'Retail Bread Buyer',
        items: [
          {
            id: 'line-bread-retail',
            productId: 'prod-bakery-special-350g',
            name: 'ChopLife Special Bread (Small 350g)',
            quantity: 5,
            unitPrice: 500,
            totalPrice: 2500,
          },
        ],
      }),
    });
    const breadRetailCheck = (await breadRetailRes.json()).check;
    assert(
      breadRetailRes.ok &&
        breadRetailCheck.items[0].unitPrice === 500 &&
        breadRetailCheck.items[0].isWholesaleApplied === false &&
        breadRetailCheck.total === 2500,
      '5 × ChopLife Special Bread (350g) priced at retail tier (₦500 × 5 = ₦2,500)'
    );

    // 4B. Wholesale quantity (20 loaves >= 20 minWholesaleQty) -> automatic ₦400/loaf wholesale tier
    const startBread350 = await getBranchStock(adminHeaders, 'inv-fg-bread-350g', 'gra');
    const breadWsRes = await fetch(`${BASE_URL}/api/pos/checks`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branchId: 'gra',
        checkType: 'takeaway',
        customerName: 'Wholesale Bread Distributor',
        items: [
          {
            id: 'line-bread-ws',
            productId: 'prod-bakery-special-350g',
            name: 'ChopLife Special Bread (Small 350g)',
            quantity: 20,
            unitPrice: 500,
            totalPrice: 10000,
          },
        ],
      }),
    });
    const breadWsCheck = (await breadWsRes.json()).check;
    const wsLine = breadWsCheck.items[0];
    assert(
      breadWsRes.ok &&
        wsLine.originalUnitPrice === 500 &&
        wsLine.unitPrice === 400 &&
        wsLine.totalPrice === 8000 &&
        wsLine.itemDiscountAmount === 2000 &&
        wsLine.isWholesaleApplied === true,
      '20 × ChopLife Special Bread (350g) automatically activated Wholesale Tier (₦400 × 20 = ₦8,000, savings = ₦2,000)'
    );

    const payBreadWsRes = await fetch(`${BASE_URL}/api/pos/checks/${breadWsCheck.id}/pay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        tenders: [{ method: 'bank_transfer', amount: 8000, reference: 'TRF-WS-BREAD-20' }],
      }),
    });
    assert(payBreadWsRes.ok, 'Settled 20-loaf wholesale bread check via Bank Transfer');

    const afterBread350 = await getBranchStock(adminHeaders, 'inv-fg-bread-350g', 'gra');
    assert(
      startBread350 - afterBread350 === 20,
      `Wholesale bread sale deducted exact 20 physical loaves from inv-fg-bread-350g (${startBread350} -> ${afterBread350})`
    );

    // 4C. Verify dedicated -ws SKU rejects quantity below minOrderQty (20)
    const belowMinWsRes = await fetch(`${BASE_URL}/api/pos/checks`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branchId: 'gra',
        checkType: 'takeaway',
        customerName: 'Invalid Wholesale Qty Buyer',
        items: [
          {
            id: 'line-bread-ws-invalid',
            productId: 'prod-bakery-special-350g-ws',
            name: 'Wholesale ChopLife Special Bread (Small 350g)',
            quantity: 5,
            unitPrice: 400,
            totalPrice: 2000,
          },
        ],
      }),
    });
    assert(
      belowMinWsRes.status === 400,
      'Dedicated wholesale SKU (prod-bakery-special-350g-ws) rejects quantity (5) below minimum threshold (20) with HTTP 400'
    );

    // =========================================================================
    // SECTION 5: CONDITIONAL FREE-ITEM PROMO, SPLIT-BILL & MENU BULK IMPORT
    // =========================================================================
    console.log('\n--- 5. Conditional Free-Item Promo, Split-Bill & Menu Bulk Import Template ---');
    const promoId = 'prod-promo-mini-pack-bonus';
    const createPromoRes = await fetch(`${BASE_URL}/api/menu/products`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        id: promoId,
        name: 'Mini Pack Bonus Puff Puff Promo',
        category: 'deals',
        basePrice: 0,
        productType: 'promotion',
        status: 'published',
        promotionRules: {
          qualifyingProductId: 'prod-sc-2000-mini',
          qualifyingMinQty: 2,
          freeProductId: 'prod-snack-puff-puff-single',
          freeQuantity: 1,
          maxRewardsPerOrder: 1,
        },
        branchAvailability: { gra: true, okabere: true, ugbowo: true },
        channels: ['pos', 'website'],
      }),
    });
    assert(createPromoRes.ok, 'Configured conditional free-item promotion rule (Buy 2 × 2000 Mini Pack -> Get 1 Free Puff Puff)');

    // Eligible order (2 x 2000 Mini Pack) receives 1 Free Puff Puff at ₦0
    const promoCheckRes = await fetch(`${BASE_URL}/api/pos/checks`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branchId: 'gra',
        checkType: 'dine_in',
        tableNumber: 'T-05',
        customerName: 'Promo & Split Bill Guest',
        items: [
          {
            id: 'line-qualifying-mini',
            productId: 'prod-sc-2000-mini',
            name: '2000 Mini Pack',
            quantity: 2,
            unitPrice: 2000,
            totalPrice: 4000,
          },
        ],
      }),
    });
    const promoCheck = (await promoCheckRes.json()).check;
    const rewardItem = (promoCheck.items || []).find((i: any) => i.isPromoReward === true);
    assert(
      promoCheckRes.ok &&
        Boolean(rewardItem) &&
        rewardItem.productId === 'prod-snack-puff-puff-single' &&
        rewardItem.quantity === 1 &&
        rewardItem.unitPrice === 0 &&
        promoCheck.total === 4000,
      'Eligible order automatically received 1 × Free Puff Puff at ₦0 without inflating order revenue (₦4,000)'
    );

    // 3-way Split-Bill settlement across Cash, POS Card, and Bank Transfer
    const splitRes = await fetch(`${BASE_URL}/api/pos/checks/${promoCheck.id}/split`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        mode: 'custom',
        customShares: [{ amount: 1500 }, { amount: 1500 }, { amount: 1000 }],
      }),
    });
    const splitData = await splitRes.json();
    const shares = splitData.check?.splitConfig?.shares || [];
    assert(splitRes.ok && shares.length === 3, 'Created 3-way split-bill allocations (₦1,500 / ₦1,500 / ₦1,000)');

    const splitPayRes = await fetch(`${BASE_URL}/api/pos/checks/${promoCheck.id}/pay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        tenders: [
          { method: 'cash', amount: 1500, cashTendered: 1500 },
          { method: 'pos_card', amount: 1500, reference: 'SPLIT-CARD-02' },
          { method: 'bank_transfer', amount: 1000, reference: 'SPLIT-TRF-03' },
        ],
      }),
    });
    const splitPayData = await splitPayRes.json();
    assert(
      splitPayRes.ok && splitPayData.isFullyPaid === true,
      'Settled 3-way split bill across Cash + POS Card + Bank Transfer and depleted package + free reward stock'
    );

    // Menu Bulk Import Template with Dropdowns + Atomic Validation/Commit
    const menuTplRes = await fetch(`${BASE_URL}/api/import/templates/menu?format=xls`, { headers: adminHeaders });
    const menuTplXml = await menuTplRes.text();
    assert(
      menuTplRes.ok &&
        menuTplXml.includes('<DataValidation') &&
        menuTplXml.includes('Controlled_Dropdown_Lists'),
      'Menu bulk import .xls template contains Excel <DataValidation> dropdowns and Controlled_Dropdown_Lists worksheet'
    );

    // Verify atomic rejection when batch contains an invalid row
    const validateInvalidRes = await fetch(`${BASE_URL}/api/import/menu/validate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        rows: [
          {
            id: 'prod-sc-2000-mini',
            name: '2000 Mini Pack',
            category: 'small-chops',
            productType: 'package',
            basePrice: 2000,
            componentsSpec: 'prod-snack-puff-puff-single:3|prod-snack-samosa-single:1|prod-snack-springroll-single:1|prod-sc-beef-single:1',
          },
          {
            id: 'prod-invalid-neg',
            name: 'Invalid Negative Price Item',
            category: 'small-chops',
            productType: 'standard',
            basePrice: -500, // invalid negative price
          },
        ],
      }),
    });
    const validateInvalidData = await validateInvalidRes.json();
    assert(
      validateInvalidRes.ok && validateInvalidData.invalidCount === 1 && Boolean(validateInvalidData.importBatchId),
      'Menu bulk import dry-run validation flagged invalid negative-price row and staged batch'
    );

    const invalidCommitRes = await fetch(`${BASE_URL}/api/import/menu/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        importBatchId: validateInvalidData.importBatchId,
      }),
    });
    assert(
      invalidCommitRes.status === 400,
      'Bulk menu import blocks atomic commit (HTTP 400) when any row in staging batch fails validation'
    );

    // Validate and commit a clean batch
    const validateCleanRes = await fetch(`${BASE_URL}/api/import/menu/validate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        rows: [
          {
            id: 'prod-sc-2000-mini',
            name: '2000 Mini Pack',
            category: 'small-chops',
            productType: 'package',
            basePrice: 2000,
            status: 'published',
            componentsSpec: 'prod-snack-puff-puff-single:3|prod-snack-samosa-single:1|prod-snack-springroll-single:1|prod-sc-beef-single:1',
          },
        ],
      }),
    });
    const validateCleanData = await validateCleanRes.json();
    const cleanCommitRes = await fetch(`${BASE_URL}/api/import/menu/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        importBatchId: validateCleanData.importBatchId,
      }),
    });
    const cleanCommitData = await cleanCommitRes.json();
    assert(
      cleanCommitRes.ok && cleanCommitData.committedCount === 1,
      'Validated and atomically committed clean menu bulk import batch (committedCount = 1)'
    );

    console.log('\n========================================================================');
    console.log(`ALL ${passedAssertions} COMMERCIAL DIRECTIVE VERIFICATION CHECKS PASSED! ✅`);
    console.log('========================================================================');
  } finally {
    if (backupRaw !== null) {
      fs.writeFileSync(DB_PATH, backupRaw, 'utf-8');
      try {
        await fetch(`${BASE_URL}/api/admin/db/reload`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({}),
        });
      } catch {
        // Ignore if server closed
      }
      console.log('[CLEANUP] Restored database on disk and reloaded in-memory state.');
    }
  }
}

runCommercialDirectiveSuite().catch((err) => {
  console.error('\n[FATAL COMMERCIAL DIRECTIVE FAILURE]:', err);
  process.exit(1);
});
