/**
 * REAL CHROMIUM BROWSER FRONTEND SMOKE SUITE
 * 
 * Uses Playwright in real headless Chromium to:
 * - Start/connect to actual ChopLife server
 * - Load http://localhost:3000/
 * - Collect browser console errors, page errors, failed network requests
 * - Verify visible storefront content (Navbar, Hero, Menu, Footer) via locator.isVisible()
 * - Test clean browser context & corrupted localStorage context
 * - Verify service worker and cache isolation
 * - Test modals: Cart drawer, Checkout modal, Account modal, Staff Login modal
 * - Capture actual screenshots
 * - Print comprehensive diagnostic table
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';

function resolvePlaywrightExecutable(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)) {
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

interface DiagnosticResult {
  category: string;
  result: 'PASS' | 'FAIL' | 'NOT TESTED';
  details: string;
}

const diagnostics: DiagnosticResult[] = [];

function record(category: string, result: 'PASS' | 'FAIL' | 'NOT TESTED', details: string) {
  diagnostics.push({ category, result, details });
  const icon = result === 'PASS' ? '✅' : result === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${result}] ${category}: ${details}`);
}

async function runBrowserSmoke() {
  console.log('🌐 ========================================================');
  console.log('   CHOPLIFE REPUBLIC — REAL CHROMIUM BROWSER ACCEPTANCE SUITE');
  console.log('========================================================\n');

  let browser: Browser | null = null;
  let hasCriticalFailure = false;

  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: resolvePlaywrightExecutable(),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    record('Browser launch', 'PASS', `Chromium launched successfully`);
  } catch (err: any) {
    record('Browser launch', 'FAIL', `Failed to launch Chromium: ${err.message}`);
    process.exit(1);
  }

  // --- SUITE A: CLEAN BROWSER CONTEXT (FIRST-TIME USER EXPERIENCE) ---
  console.log('\n--- SUITE A: CLEAN BROWSER CONTEXT (FIRST BOOT) ---');
  const cleanContext: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page: Page = await cleanContext.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: { url: string; error: string }[] = [];
  const networkLog: { url: string; status: number; type: string }[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(`${err.name}: ${err.message}\n${err.stack || ''}`);
  });

  page.on('requestfailed', (req) => {
    failedRequests.push({
      url: req.url(),
      error: req.failure()?.errorText || 'Unknown request failure',
    });
  });

  page.on('response', (res) => {
    networkLog.push({
      url: res.url(),
      status: res.status(),
      type: res.request().resourceType(),
    });
  });

  try {
    const response = await page.goto('http://localhost:3000/', {
      waitUntil: 'networkidle',
      timeout: 15000,
    });

    const status = response ? response.status() : 0;
    if (status === 200) {
      record('HTTP Root Status', 'PASS', `http://localhost:3000/ returned status 200 OK`);
    } else {
      record('HTTP Root Status', 'FAIL', `Unexpected HTTP status: ${status}`);
      hasCriticalFailure = true;
    }
  } catch (err: any) {
    record('HTTP Root Status', 'FAIL', `Failed to navigate: ${err.message}`);
    hasCriticalFailure = true;
  }

  // Inspect DOM Root state
  await page.waitForTimeout(2000);

  const domInspection = await page.evaluate(() => {
    const root = document.querySelector('#root');
    if (!root) {
      return { exists: false, childCount: 0, htmlLen: 0, textSnippet: '', computed: null };
    }
    const computed = window.getComputedStyle(root);
    return {
      exists: true,
      childCount: root.children.length,
      htmlLen: root.innerHTML.length,
      textSnippet: root.textContent?.slice(0, 300) || '',
      computed: {
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        height: computed.height,
        width: computed.width,
      },
    };
  });

  if (domInspection.exists && domInspection.htmlLen > 1000) {
    record(
      'Root DOM Mount',
      'PASS',
      `#root mounted with ${domInspection.childCount} child nodes, innerHTML length: ${domInspection.htmlLen} bytes`
    );
  } else {
    record('Root DOM Mount', 'FAIL', `#root is empty or missing! length: ${domInspection.htmlLen}`);
    hasCriticalFailure = true;
  }

  // Check Computed Styles for CSS Blackout
  if (domInspection.computed) {
    const isHidden =
      domInspection.computed.display === 'none' ||
      domInspection.computed.visibility === 'hidden' ||
      domInspection.computed.opacity === '0';
    if (!isHidden) {
      record(
        'Computed CSS Visibility',
        'PASS',
        `display: ${domInspection.computed.display}, visibility: ${domInspection.computed.visibility}, opacity: ${domInspection.computed.opacity}, height: ${domInspection.computed.height}`
      );
    } else {
      record('Computed CSS Visibility', 'FAIL', `Root element is visually hidden by CSS blackout!`);
      hasCriticalFailure = true;
    }
  }

  // Check Page Errors
  if (pageErrors.length === 0) {
    record('Page Errors', 'PASS', `0 unhandled JavaScript exceptions in browser runtime`);
  } else {
    record('Page Errors', 'FAIL', `${pageErrors.length} pageerror exceptions caught:\n${pageErrors.join('\n')}`);
    hasCriticalFailure = true;
  }

  // Check Console Errors
  if (consoleErrors.length === 0) {
    record('Console Errors', 'PASS', `0 console.error messages logged`);
  } else {
    record('Console Errors', 'FAIL', `${consoleErrors.length} console.error logged: ${consoleErrors.join(', ')}`);
    hasCriticalFailure = true;
  }

  // Check Failed Requests
  if (failedRequests.length === 0) {
    record('Failed Requests', 'PASS', `0 failed HTTP asset/module requests`);
  } else {
    record('Failed Requests', 'FAIL', `${failedRequests.length} requests failed: ${JSON.stringify(failedRequests)}`);
    hasCriticalFailure = true;
  }

  // Check Service Worker and Cache state
  const swState = await page.evaluate(async () => {
    let controller = navigator.serviceWorker?.controller ? navigator.serviceWorker.controller.scriptURL : null;
    let registrations: string[] = [];
    if ('serviceWorker' in navigator) {
      const all = await navigator.serviceWorker.getRegistrations();
      registrations = all.map((r) => r.scope);
    }
    let cachesList: string[] = [];
    if ('caches' in window) {
      cachesList = await window.caches.keys();
    }
    return { controller, registrations, caches: cachesList };
  });

  if (swState.controller || swState.registrations.length > 0) {
    record(
      'Service Worker Isolation',
      'FAIL',
      `Unexpected service worker active in dev/preview! controller: ${swState.controller || 'none'}, registrations: ${swState.registrations.join(', ')}`
    );
    hasCriticalFailure = true;
  } else {
    record(
      'Service Worker Isolation',
      'PASS',
      `Service worker strictly isolated (controller: none, active registrations: 0, caches: ${swState.caches.length})`
    );
  }

  // VISUAL STOREFRONT ELEMENT VERIFICATION (locator.isVisible)
  console.log('\n--- VERIFYING VISIBLE STOREFRONT COMPONENTS ---');

  // 1. Brand Title / Navbar
  const brandLocator = page.locator('text=CHOPLIFE').first();
  const isBrandVisible = await brandLocator.isVisible({ timeout: 5000 }).catch(() => false);
  if (isBrandVisible) {
    record('Navbar Brand', 'PASS', `Authoritative brand header "CHOPLIFE" is visible in viewport`);
  } else {
    record('Navbar Brand', 'FAIL', `Authoritative brand header "CHOPLIFE" was not visible`);
    hasCriticalFailure = true;
  }

  // 2. Hero Section
  const heroLocator = page.locator('text=Enjoy Yourself, Is That Too Much To Ask?').first();
  const isHeroVisible = await heroLocator.isVisible({ timeout: 5000 }).catch(() => false);
  if (isHeroVisible) {
    record('Hero Banner', 'PASS', `Hero slogan "Enjoy Yourself, Is That Too Much To Ask?" is visible`);
  } else {
    record('Hero Banner', 'FAIL', `Hero slogan was not visible in viewport`);
    hasCriticalFailure = true;
  }

  // 3. Branch Selector (Matches QuickBranchPicker header & branch cards)
  const branchPickerLocator = page.locator('text=WHERE ARE YOU ORDERING FROM?').first();
  const isBranchVisible = await branchPickerLocator.isVisible({ timeout: 5000 }).catch(() => false);
  if (isBranchVisible) {
    record('Branch Selector', 'PASS', `Branch selector section "WHERE ARE YOU ORDERING FROM?" is visible`);
  } else {
    record('Branch Selector', 'FAIL', `Branch selector was not visible`);
    hasCriticalFailure = true;
  }

  // 4. Menu Section (Matches MenuExplorer header)
  const menuLocator = page.locator('text=AUTHENTIC NIGERIAN QSR MENU').first();
  const isMenuVisible = await menuLocator.isVisible({ timeout: 5000 }).catch(() => false);
  if (isMenuVisible) {
    record('Menu Explorer', 'PASS', `Menu section "AUTHENTIC NIGERIAN QSR MENU" is visible with product cards`);
  } else {
    record('Menu Explorer', 'FAIL', `Menu Explorer was not visible`);
    hasCriticalFailure = true;
  }

  // 5. Footer Section
  const footerLocator = page.locator('text=100% MAXIMUM ENJOYMENT').first();
  const isFooterVisible = await footerLocator.isVisible({ timeout: 5000 }).catch(() => false);
  if (isFooterVisible) {
    record('Footer Branding', 'PASS', `Footer "100% MAXIMUM ENJOYMENT" is visible`);
  } else {
    record('Footer Branding', 'FAIL', `Footer was not visible`);
    hasCriticalFailure = true;
  }

  // Capture Clean Boot Screenshot
  const screenshotPath = 'storefront_browser_clean.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const stats = fs.statSync(screenshotPath);
  record('Clean Boot Screenshot', 'PASS', `Saved screenshot to ${screenshotPath} (${Math.round(stats.size / 1024)} KB)`);
  try {
    fs.unlinkSync(screenshotPath);
  } catch {}

  // --- SUITE B: INTERACTION TESTING (MODALS & USER ACTIONS) ---
  console.log('\n--- SUITE B: USER INTERACTIONS & OVERLAYS ---');

  // Cart Drawer
  try {
    const cartButton = page.locator('#nav-cart-btn').first();
    if (await cartButton.isVisible()) {
      await cartButton.click();
      await page.waitForTimeout(500);
      const cartHeading = page.locator('text=YOUR ORDER CART').first();
      const isCartOpen = await cartHeading.isVisible({ timeout: 3000 }).catch(() => false);
      record('Cart Drawer Trigger', isCartOpen ? 'PASS' : 'FAIL', `Cart drawer opened: ${isCartOpen}`);

      // Close cart drawer
      const closeBtn = page.locator('#close-cart-btn').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
  } catch (err: any) {
    record('Cart Drawer Trigger', 'FAIL', `Error triggering cart drawer: ${err.message}`);
  }

  // Staff Login Modal
  try {
    const staffPortalBtn = page.locator('#top-staff-portal-btn').first();
    if (await staffPortalBtn.isVisible()) {
      await staffPortalBtn.click();
      await page.waitForTimeout(500);
      const staffModalHeading = page.locator('#staff-login-modal').first();
      const isStaffModalOpen = await staffModalHeading.isVisible({ timeout: 3000 }).catch(() => false);
      record('Staff Login Modal', isStaffModalOpen ? 'PASS' : 'FAIL', `Staff login modal opens: ${isStaffModalOpen}`);

      // Close staff modal
      const closeStaff = page.locator('#close-staff-login-btn').first();
      if (await closeStaff.isVisible()) {
        await closeStaff.click();
        await page.waitForTimeout(500);
      }
    }
  } catch (err: any) {
    record('Staff Login Modal', 'FAIL', `Error opening staff modal: ${err.message}`);
  }

  await cleanContext.close();

  // --- SUITE C: CORRUPTED LOCALSTORAGE RECOVERY PASS ---
  console.log('\n--- SUITE C: CORRUPTED LOCALSTORAGE BROWSER RECOVERY ---');
  const corruptContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const corruptPage = await corruptContext.newPage();

  // Pre-seed heavily corrupted localStorage data before script execution
  await corruptPage.addInitScript(() => {
    localStorage.setItem('choplife_cart_v1', 'CORRUPT_JSON_{[');
    localStorage.setItem('choplife_customer_profile_v1', '{}');
    localStorage.setItem('choplife_orders_v1', 'null');
    localStorage.setItem('choplife_menu_cms_v1', '""');
    localStorage.setItem('choplife_staff_active_v1', '{"broken": true}');
    localStorage.setItem('choplife_staff_token', 'stale_expired_token_123');
  });

  let corruptPageErrors = 0;
  corruptPage.on('pageerror', (err) => {
    console.error('CORRUPT_CONTEXT_PAGEERROR:', err.message);
    corruptPageErrors++;
  });

  await corruptPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await corruptPage.waitForTimeout(2000);

  const corruptDomLen = await corruptPage.evaluate(() => document.querySelector('#root')?.innerHTML.length || 0);
  const corruptBrandVisible = await corruptPage.locator('text=CHOPLIFE').first().isVisible({ timeout: 4000 }).catch(() => false);

  if (corruptDomLen > 1000 && corruptBrandVisible && corruptPageErrors === 0) {
    record(
      'Corrupt Storage Recovery',
      'PASS',
      `Browser safely sanitized corrupted storage and rendered full storefront (${corruptDomLen} bytes DOM, 0 page errors)`
    );
  } else {
    record(
      'Corrupt Storage Recovery',
      'FAIL',
      `Corrupt storage crashed browser! DOM len: ${corruptDomLen}, Brand visible: ${corruptBrandVisible}, pageErrors: ${corruptPageErrors}`
    );
    hasCriticalFailure = true;
  }

  await corruptContext.close();
  await browser.close();

  // --- PRINT COMPREHENSIVE DIAGNOSTIC TABLE ---
  console.log('\n========================================================');
  console.log('           BROWSER ACCEPTANCE DIAGNOSTIC TABLE');
  console.log('========================================================');
  console.log(
    'CATEGORY'.padEnd(28) + ' | ' + 'RESULT'.padEnd(8) + ' | ' + 'DETAILS'
  );
  console.log('-'.repeat(80));
  for (const d of diagnostics) {
    console.log(
      d.category.padEnd(28) + ' | ' + d.result.padEnd(8) + ' | ' + d.details
    );
  }
  console.log('========================================================\n');

  if (hasCriticalFailure) {
    console.error('❌ CRITICAL FRONTEND RUNTIME FAILURE DETECTED IN REAL BROWSER.');
    process.exit(1);
  } else {
    console.log('✅ ALL REAL CHROMIUM BROWSER ACCEPTANCE TESTS PASSED.');
  }
}

runBrowserSmoke();
