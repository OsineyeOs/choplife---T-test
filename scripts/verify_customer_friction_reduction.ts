/**
 * CHOPLIFE REPUBLIC — CUSTOMER FRICTION REDUCTION, PRODUCT DISCOVERY & REPEAT ORDERING
 * END-TO-END VERIFICATION SUITE (Playwright Real Chromium + Catalogue Logic)
 */

import { chromium, Browser } from 'playwright';
import fs from 'fs';
import path from 'path';
import { MASTER_PRODUCTS } from '../src/data/menu';
import { matchesCategoryFilter, matchesProductSearchQuery } from '../src/components/menu/MenuExplorer';

function resolvePlaywrightExecutable(): string | undefined {
  if (
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH &&
    fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  ) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const msPlaywrightDir = '/ms-playwright';
  if (fs.existsSync(msPlaywrightDir)) {
    const dirs = fs.readdirSync(msPlaywrightDir);
    for (const d of dirs) {
      const candidate1 = path.join(msPlaywrightDir, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (fs.existsSync(candidate1)) return candidate1;
      const candidate2 = path.join(msPlaywrightDir, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(candidate2)) return candidate2;
    }
  }
  return undefined;
}

const BASE_URL = 'http://localhost:3000';
const DB_FILE_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail: string = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runVerification() {
  const initialDbRaw = fs.existsSync(DB_FILE_PATH) ? fs.readFileSync(DB_FILE_PATH, 'utf-8') : null;

  console.log('================================================================================');
  console.log(' CHOPLIFE REPUBLIC — CUSTOMER FRICTION, DISCOVERY & REPEAT ORDERING TEST SUITE');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. UNIT & DATA-LEVEL SEARCH & FILTERING VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('--- 1. SEARCH ENGINE & FILTERING LOGIC VERIFICATION ---');

  const exactMatches = MASTER_PRODUCTS.filter((p) => matchesProductSearchQuery(p, 'Party Jollof Rice'));
  assert(exactMatches.length >= 1, 'Exact product name search ("Party Jollof Rice")', `matches=${exactMatches.length}`);

  const partialMatches = MASTER_PRODUCTS.filter((p) => matchesProductSearchQuery(p, 'shawarma'));
  assert(partialMatches.length >= 1, 'Partial product name search ("shawarma")', `matches=${partialMatches.length}`);

  const lowerMatches = MASTER_PRODUCTS.filter((p) => matchesProductSearchQuery(p, 'small chops'));
  const upperMatches = MASTER_PRODUCTS.filter((p) => matchesProductSearchQuery(p, 'SMALL CHOPS'));
  const mixedMatches = MASTER_PRODUCTS.filter((p) => matchesProductSearchQuery(p, 'SmAlL cHoPs'));
  assert(
    lowerMatches.length > 0 && lowerMatches.length === upperMatches.length && lowerMatches.length === mixedMatches.length,
    'Case-insensitive search parity (lower / UPPER / MiXeD)',
    `count=${lowerMatches.length}`
  );

  const whitespaceMatches = MASTER_PRODUCTS.filter((p) => matchesProductSearchQuery(p, '   small    chops   '));
  assert(
    whitespaceMatches.length === lowerMatches.length,
    'Leading/trailing/multiple whitespace normalization ("   small    chops   ")',
    `count=${whitespaceMatches.length}`
  );

  for (const term of ['bread', 'bakery', 'food', 'drinks', 'platter', 'protein']) {
    const termMatches = MASTER_PRODUCTS.filter((p) => matchesProductSearchQuery(p, term));
    assert(termMatches.length > 0, `Category/keyword alias search ("${term}")`, `matches=${termMatches.length}`);
  }

  const nonExistentMatches = MASTER_PRODUCTS.filter((p) => matchesProductSearchQuery(p, 'xyznonexistentdish999'));
  assert(nonExistentMatches.length === 0, 'Non-existent product search returns 0 items cleanly');

  const bakeryBreadMatches = MASTER_PRODUCTS.filter(
    (p) => matchesCategoryFilter(p, 'bakery', []) && matchesProductSearchQuery(p, 'bread')
  );
  const drinksBreadMatches = MASTER_PRODUCTS.filter(
    (p) => matchesCategoryFilter(p, 'drinks', []) && matchesProductSearchQuery(p, 'bread')
  );
  assert(
    bakeryBreadMatches.length > 0 && drinksBreadMatches.length === 0,
    'Combined Category + Search filter isolation (bakery+"bread" > 0, drinks+"bread" == 0)',
    `bakery=${bakeryBreadMatches.length}, drinks=${drinksBreadMatches.length}`
  );

  // ---------------------------------------------------------------------------
  // 2. REAL CHROMIUM BROWSER E2E VERIFICATION (DESKTOP + TABLET + MOBILE)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. REAL CHROMIUM BROWSER E2E VERIFICATION ---');

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: resolvePlaywrightExecutable(),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });

    // Verify MenuExplorer is positioned prominently right below Hero/Branch picker and has visible #menu-search-input
    const menuSearchInput = page.locator('#menu-search-input');
    const isMenuSearchVisible = await menuSearchInput.isVisible();
    assert(isMenuSearchVisible, 'In-catalogue #menu-search-input is prominently visible');

    // Verify progressive anti-cramming pagination on All Menu
    await page.locator('#cat-btn-all').click();
    await page.waitForTimeout(150);
    const initialCardsCount = await page.locator('[id^="menu-item-"]').count();
    const showMoreBtn = page.locator('#show-more-products-btn');
    const isShowMoreVisible = await showMoreBtn.isVisible();
    assert(
      initialCardsCount === 12 && isShowMoreVisible,
      'Anti-cramming progressive display limits initial "All Menu" view to 12 items with "Show More" button',
      `initialCards=${initialCardsCount}`
    );

    // Click Show More and verify more cards load
    await showMoreBtn.click();
    await page.waitForTimeout(150);
    const expandedCardsCount = await page.locator('[id^="menu-item-"]').count();
    assert(expandedCardsCount > 12, '"Show More Dishes" loads additional products progressively', `expanded=${expandedCardsCount}`);

    // Test live search in #menu-search-input
    await menuSearchInput.fill('   Shawarma   ');
    await page.waitForTimeout(200);
    const shawarmaCardsCount = await page.locator('[id^="menu-item-"]').count();
    const resultsText = (await page.locator('#menu-results-count').textContent()) || '';
    assert(
      shawarmaCardsCount >= 1 && resultsText.toLowerCase().includes('shawarma'),
      'Live search for "   Shawarma   " filters product grid and updates result count',
      `matches=${shawarmaCardsCount}, label="${resultsText.trim()}"`
    );

    // Test non-existent search query & clear button
    await menuSearchInput.fill('xyznonexistentfood999');
    await page.waitForTimeout(150);
    const emptyStateVisible = await page.locator('#menu-empty-state').isVisible();
    assert(emptyStateVisible, 'Non-existent search displays clear empty state with reset action');

    await page.locator('#menu-search-clear-btn').click();
    await page.waitForTimeout(150);
    const restoredCount = await page.locator('[id^="menu-item-"]').count();
    assert(restoredCount > 0, 'Clicking Clear search button restores product catalogue', `restored=${restoredCount}`);

    // Test Sort selector (Price Low to High vs High to Low)
    await page.locator('#cat-btn-bakery').click();
    await page.waitForTimeout(150);
    await page.locator('#menu-sort-select').selectOption('price-asc');
    await page.waitForTimeout(150);
    const firstAscText = (await page.locator('[id^="menu-item-"]').first().textContent()) || '';
    await page.locator('#menu-sort-select').selectOption('price-desc');
    await page.waitForTimeout(150);
    const firstDescText = (await page.locator('[id^="menu-item-"]').first().textContent()) || '';
    assert(
      firstAscText !== firstDescText,
      'Sort selector reorders products accurately (Price: Low to High vs High to Low)'
    );

    // ---------------------------------------------------------------------------
    // 3. SHORTLIST / SAVED FAVOURITES VERIFICATION
    // ---------------------------------------------------------------------------
    console.log('\n--- 3. SHORTLIST / SAVED FAVOURITES VERIFICATION ---');

    await page.locator('#cat-btn-all').click();
    await page.waitForTimeout(150);

    const shortlistBtns = page.locator('[id^="shortlist-btn-"]');
    const firstShortlistBtnId = await shortlistBtns.nth(0).getAttribute('id');
    const secondShortlistBtnId = await shortlistBtns.nth(1).getAttribute('id');

    await shortlistBtns.nth(0).click();
    await shortlistBtns.nth(1).click();
    await page.waitForTimeout(150);

    const badgeText = (await page.locator('#shortlist-count-badge').textContent()) || '';
    assert(badgeText.trim() === '2', 'Shortlisting 2 products updates shortlist count badge to 2', `badge=${badgeText.trim()}`);

    // Switch to Shortlist view
    await page.locator('#cat-btn-shortlist').click();
    await page.waitForTimeout(150);
    const shortlistedCardsCount = await page.locator('[id^="menu-item-"]').count();
    assert(shortlistedCardsCount === 2, 'Shortlist tab displays exactly the 2 shortlisted products');

    // Reload page and verify shortlist persists in localStorage
    await page.reload({ waitUntil: 'networkidle' });
    const persistedBadgeText = (await page.locator('#shortlist-count-badge').textContent()) || '';
    assert(persistedBadgeText.trim() === '2', 'Shortlist persists across browser page reload');

    // Open Shortlist tab, remove 1 item, and add remaining shortlisted item to cart
    await page.locator('#cat-btn-shortlist').click();
    await page.waitForTimeout(150);
    if (firstShortlistBtnId) {
      await page.locator(`#${firstShortlistBtnId}`).click();
      await page.waitForTimeout(150);
    }
    const remainingShortlistedCount = await page.locator('[id^="menu-item-"]').count();
    assert(remainingShortlistedCount === 1, 'Removing an item from Shortlist updates the Shortlist view immediately');

    await page.locator('#add-all-shortlisted-btn').click();
    await page.waitForTimeout(200);
    const cartBadgeAfterShortlistAdd = (await page.locator('#cart-item-count-badge').textContent()) || '';
    assert(
      Number(cartBadgeAfterShortlistAdd.trim()) >= 1,
      'Clicking "ADD ALL TO CART" in Shortlist adds shortlisted items to cart',
      `cartCount=${cartBadgeAfterShortlistAdd.trim()}`
    );

    // ---------------------------------------------------------------------------
    // 4. REPEAT CUSTOMER CHECKOUT PREFILL & SAVED ADDRESS VERIFICATION
    // ---------------------------------------------------------------------------
    console.log('\n--- 4. REPEAT CUSTOMER CHECKOUT PREFILL & SAVED ADDRESS VERIFICATION ---');

    // Open Cart Drawer -> Proceed to Checkout
    await page.locator('#nav-cart-btn').click();
    await page.waitForTimeout(200);
    await page.locator('#proceed-to-checkout-btn').click();
    await page.waitForTimeout(200);

    // Fill Customer Details on First Order
    await page.locator('#checkout-name-input').fill('Osaze Obaseki');
    await page.locator('#checkout-phone-input').fill('08031112233');
    await page.locator('#checkout-email-input').fill('osaze@benin.ng');
    await page.locator('#checkout-address-input').fill('25 Ihama Road, GRA, Benin City');
    await page.locator('#checkout-landmark-input').fill('Opposite Constantial Hotel');
    await page.locator('#checkout-alt-phone-input').fill('08059998877');
    await page.locator('#checkout-delivery-notes-input').fill('Please call at the black gate');

    // Continue to Payment -> Confirm Order
    await page.locator('#continue-to-payment-btn').click();
    await page.waitForTimeout(200);
    await page.locator('#place-final-order-btn').click();
    await page.waitForTimeout(1500); // wait for 1200ms order processing

    // Close active order tracking modal if open
    const closeTrackerBtn = page.locator('#close-tracker-modal-btn');
    if (await closeTrackerBtn.isVisible().catch(() => false)) {
      await closeTrackerBtn.click();
      await page.waitForTimeout(150);
    }

    // Now simulate a Repeat Visit: reload page, add an item to cart, and open Checkout
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#cat-btn-bakery').click();
    await page.waitForTimeout(150);
    await page.locator('[id^="menu-add-"]').first().click();
    await page.waitForTimeout(150);
    await page.locator('#nav-cart-btn').click();
    await page.waitForTimeout(200);
    await page.locator('#proceed-to-checkout-btn').click();
    await page.waitForTimeout(250);

    // Verify all fields are automatically pre-populated for the returning customer!
    const prefilledName = await page.locator('#checkout-name-input').inputValue();
    const prefilledPhone = await page.locator('#checkout-phone-input').inputValue();
    const prefilledEmail = await page.locator('#checkout-email-input').inputValue();
    const prefilledAddress = await page.locator('#checkout-address-input').inputValue();
    const prefilledLandmark = await page.locator('#checkout-landmark-input').inputValue();
    const prefilledAltPhone = await page.locator('#checkout-alt-phone-input').inputValue();
    const prefilledNotes = await page.locator('#checkout-delivery-notes-input').inputValue();
    const isBannerVisible = await page.locator('#returning-customer-prefill-banner').isVisible();

    assert(
      isBannerVisible &&
        prefilledName === 'Osaze Obaseki' &&
        prefilledPhone === '08031112233' &&
        prefilledEmail === 'osaze@benin.ng',
      'Returning customer contact details (Name, Phone, Email) are automatically pre-filled on repeat checkout',
      `name="${prefilledName}", phone="${prefilledPhone}"`
    );

    assert(
      prefilledAddress === '25 Ihama Road, GRA, Benin City' &&
        prefilledLandmark === 'Opposite Constantial Hotel' &&
        prefilledAltPhone === '08059998877' &&
        prefilledNotes === 'Please call at the black gate',
      'Returning customer delivery address, landmark, alt phone, and delivery notes are automatically pre-filled',
      `address="${prefilledAddress}", notes="${prefilledNotes}"`
    );

    // Test clearing saved info on shared device
    await page.locator('#clear-saved-checkout-btn').click();
    await page.waitForTimeout(150);
    const clearedName = await page.locator('#checkout-name-input').inputValue();
    assert(clearedName === '', 'Clicking "Clear saved info" clears pre-filled checkout details for shared devices');

    // Close checkout modal
    await page.locator('#close-checkout-modal-btn').click();
    await page.waitForTimeout(150);

    // ---------------------------------------------------------------------------
    // 5. TABLET (768px) & MOBILE (375px) SEARCH & SHORTLIST VERIFICATION
    // ---------------------------------------------------------------------------
    console.log('\n--- 5. TABLET (768px) & MOBILE (375px) RESPONSIVE SEARCH VERIFICATION ---');

    for (const vp of [
      { width: 768, height: 1024, name: 'Tablet 768px' },
      { width: 375, height: 667, name: 'Mobile 375px' },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(150);
      await page.locator('#mobile-search-toggle').click();
      await page.waitForTimeout(150);
      const mobileSearchVisible = await page.locator('#mobile-search-input').isVisible();
      assert(mobileSearchVisible, `[${vp.name}] Clicking #mobile-search-toggle reveals #mobile-search-input`);
      // Toggle off
      await page.locator('#mobile-search-toggle').click();
      await page.waitForTimeout(100);
    }

    assert(pageErrors.length === 0, 'Zero unhandled browser page errors during full E2E customer flow');

    await context.close();
  } finally {
    if (browser) await browser.close();
    if (initialDbRaw !== null) {
      fs.writeFileSync(DB_FILE_PATH, initialDbRaw, 'utf-8');
    }
  }

  console.log('\n================================================================================');
  console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');
  if (failed > 0) process.exit(1);
}

runVerification();
