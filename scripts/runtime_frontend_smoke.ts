/**
 * Frontend Runtime Diagnostics & Smoke Verification Suite
 * Exercises real React rendering, SSR hydration simulation, corrupt storage recovery,
 * ErrorBoundary intercepts, staff session recovery, and customer storefront integrity.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import App, { ChoplifeApp } from '../src/App';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary';
import { DEFAULT_CUSTOMER_PROFILE, safeGetCart, safeGetCustomerProfile, safeGetProducts } from '../src/utils/storageValidators';

interface TestContext {
  storage: Record<string, string>;
}

function setupMockBrowser(initialStorage: Record<string, string> = {}): TestContext {
  const storage: Record<string, string> = { ...initialStorage };
  const mockLocalStorage = {
    getItem: (k: string) => (k in storage ? storage[k] : null),
    setItem: (k: string, v: string) => {
      storage[k] = String(v);
    },
    removeItem: (k: string) => {
      delete storage[k];
    },
    clear: () => {
      Object.keys(storage).forEach((k) => delete storage[k]);
    },
    key: (i: number) => Object.keys(storage)[i] || null,
    length: Object.keys(storage).length,
  };

  const nav = { onLine: true };
  const win = {
    addEventListener: () => {},
    removeEventListener: () => {},
    location: {
      href: 'http://localhost:3000',
      hostname: 'localhost',
      port: '3000',
      reload: () => {},
    },
    navigator: nav,
    localStorage: mockLocalStorage,
  };

  try {
    Object.defineProperty(global, 'window', { value: win, configurable: true, writable: true });
    Object.defineProperty(global, 'navigator', { value: nav, configurable: true, writable: true });
    Object.defineProperty(global, 'localStorage', { value: mockLocalStorage, configurable: true, writable: true });
  } catch {
    (global as any).window = win;
  }

  return { storage };
}

async function runFrontendSmokeTests() {
  console.log('🧪 Starting Frontend Runtime & Boot-Safety Smoke Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  // TEST 1: Pristine Initial Boot (Customer Storefront)
  console.log('--- TEST 1: Pristine Initial Storefront Boot ---');
  setupMockBrowser({});
  try {
    const html = renderToString(React.createElement(App));
    assert(html.length > 50000, `Pristine boot renders customer storefront (Length: ${html.length} bytes)`);
    assert(html.includes('Choplife Republic'), 'Storefront contains brand title "Choplife Republic"');
    assert(html.includes('Party Jollof Rice') || html.includes('Favourites') || html.includes('Menu'), 'Storefront contains menu/products');
    assert(html.includes('100% Maximum Enjoyment') || html.includes('Benin City'), 'Storefront contains brand motto/location');
  } catch (err: any) {
    assert(false, 'Pristine boot failed to render', err);
  }

  // TEST 2: Corrupted LocalStorage Recovery
  console.log('\n--- TEST 2: Corrupted & Malformed LocalStorage Recovery ---');
  setupMockBrowser({
    choplife_cart_v1: 'INVALID_JSON_CORRUPT{',
    choplife_orders_v1: '{"unexpected": "object_not_array"}',
    choplife_menu_cms_v1: 'null',
    choplife_customer_profile_v1: '{}', // previously caused TypeError: reading 0 of undefined
    choplife_inventory_v1: '12345',
    choplife_staff_active_v1: '{"role": "unknown_broken"}',
    choplife_staff_token: 'fake-corrupted-token',
  });

  try {
    const html = renderToString(React.createElement(App));
    assert(html.length > 50000, `Corrupt storage safely sanitized and storefront rendered (Length: ${html.length} bytes)`);
    assert(!html.includes('Application Recovery Mode'), 'Safe recovery did not require tripping ErrorBoundary');
  } catch (err: any) {
    assert(false, 'Corrupt storage caused fatal rendering crash', err);
  }

  // TEST 3: Customer Profile Schema Robustness
  console.log('\n--- TEST 3: Customer Profile Sanitizer & Schema Invariants ---');
  const safeProfile = safeGetCustomerProfile();
  assert(Array.isArray(safeProfile.savedAddresses), 'safeGetCustomerProfile guarantees savedAddresses array');
  assert(safeProfile.savedAddresses.length > 0, 'safeGetCustomerProfile supplies default primary address');
  assert(safeProfile.preferredBranchId === 'gra', 'Default preferred branch is GRA');

  // TEST 4: ErrorBoundary Intercept & Recovery Display
  console.log('\n--- TEST 4: ErrorBoundary Intercept & Recovery Display ---');
  const simError = new Error('Simulated runtime rendering failure for ErrorBoundary assertion');
  const derivedState = ErrorBoundary.getDerivedStateFromError(simError);
  assert(derivedState.hasError && derivedState.error === simError, 'ErrorBoundary.getDerivedStateFromError captures exception state');

  const boundaryInstance = new ErrorBoundary({ moduleName: 'Test Subsystem', children: React.createElement('div', null, 'Normal Content') });
  (boundaryInstance as any).state = derivedState;
  const boundaryRender = boundaryInstance.render();
  const errorHtml = renderToString(boundaryRender as any);

  assert(errorHtml.includes('Test Subsystem Paused') || errorHtml.includes('Application Recovery Mode'), 'ErrorBoundary renders diagnostic recovery screen');
  assert(errorHtml.includes('Choplife Republic System Safeguard') || errorHtml.includes('ChopLife Republic System Safeguard'), 'ErrorBoundary displays branded safeguard banner');
  assert(errorHtml.includes('Reload View'), 'ErrorBoundary renders "Reload View" button');
  assert(errorHtml.includes('Reset Local State'), 'ErrorBoundary renders "Reset Local State" button');

  // TEST 5: Live Dev Server HTTP Root & Assets Validation
  console.log('\n--- TEST 5: Live Dev Server HTTP Root & Header Inspection ---');
  try {
    const res = await fetch('http://localhost:3000/');
    const text = await res.text();
    assert(res.status === 200, `Dev server root HTTP 200 OK`);
    assert(text.includes('<div id="root"></div>'), 'HTML entry point contains mount target <div id="root">');
    assert(text.includes('/src/main.tsx'), 'HTML entry point links /src/main.tsx');
    assert(res.headers.get('content-type')?.includes('text/html') === true, 'Dev server serves valid text/html');
  } catch (err: any) {
    assert(false, 'Live HTTP check failed', err);
  }

  // TEST 6: Vite Module Transformation on /src/main.tsx & /src/App.tsx
  console.log('\n--- TEST 6: Vite Module Transformation Verification ---');
  try {
    const mainRes = await fetch('http://localhost:3000/src/main.tsx');
    const mainJs = await mainRes.text();
    assert(mainRes.status === 200, `Vite successfully transforms /src/main.tsx (Status: 200)`);
    assert(mainJs.includes('createRoot'), 'Transformed JS imports and calls createRoot');

    const appRes = await fetch('http://localhost:3000/src/App.tsx');
    const appJs = await appRes.text();
    assert(appRes.status === 200 && appJs.includes('ErrorBoundary'), 'Transformed App.tsx includes ErrorBoundary');
  } catch (err: any) {
    assert(false, 'Vite transformation failed', err);
  }

  // TEST 7: Staff Authentication Authoritative Server Barrier
  console.log('\n--- TEST 7: Authoritative Staff Barrier (No Magic Tokens) ---');
  try {
    // Attempting access with old magic token must be rejected
    const forgedMeRes = await fetch('http://localhost:3000/api/auth/staff/me', {
      headers: { Authorization: 'Bearer choplife_canonical_admin_session' },
    });
    assert(forgedMeRes.status === 401, 'choplife_canonical_admin_session is completely rejected by server (401)');

    // Legitimate login with Cashier credentials
    const cashierLogin = await (
      await fetch('http://localhost:3000/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrStaffId: 'CL-CSH-001', password: 'ChopLife2025!' }),
      })
    ).json();
    assert(cashierLogin.success && cashierLogin.staff.role === 'cashier', 'Legitimate password login generates real server session');

    // Verify session
    const meRes = await fetch('http://localhost:3000/api/auth/staff/me', {
      headers: { Authorization: `Bearer ${cashierLogin.token}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.role === 'cashier', 'Server confirms authoritative staff session via /api/auth/staff/me');

    // Clean up test session
    await fetch('http://localhost:3000/api/auth/staff/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierLogin.token}` },
    }).catch(() => {});
  } catch (err: any) {
    assert(false, 'Staff barrier check failed', err);
  }

  console.log('\n========================================');
  console.log(`FRONTEND SMOKE TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFrontendSmokeTests();
