/**
 * Three-Interface Separation, Frontend Route Mounting, and Role-Based Governance Suite
 * Verifies that /, /pos, and /admin are strictly separated, discoverable, authenticated, and enforced.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import App, { ChoplifeApp, getInitialRoute } from '../src/App';

function assert(condition: boolean, msg: string, detail?: any) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`, detail || '');
    throw new Error(msg);
  }
  console.log(`✅ [PASS] ${msg}`);
}

function mockWindowLocation(pathname: string, hash: string = '', initialStorage: Record<string, string> = {}) {
  const storage: Record<string, string> = { ...initialStorage };
  const mockLocalStorage = {
    getItem: (k: string) => (k in storage ? storage[k] : null),
    setItem: (k: string, v: string) => { storage[k] = String(v); },
    removeItem: (k: string) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
    key: (i: number) => Object.keys(storage)[i] || null,
    length: Object.keys(storage).length,
  };

  const win = {
    addEventListener: () => {},
    removeEventListener: () => {},
    scrollTo: () => {},
    location: {
      href: `http://localhost:3000${pathname}${hash}`,
      pathname,
      hash,
      hostname: 'localhost',
      port: '3000',
      reload: () => {},
    },
    history: {
      pushState: (_state: any, _title: string, url: string) => {
        win.location.pathname = url.split('#')[0];
        win.location.hash = url.includes('#') ? '#' + url.split('#')[1] : '';
      },
    },
    navigator: { onLine: true },
    localStorage: mockLocalStorage,
  };

  try {
    Object.defineProperty(global, 'window', { value: win, configurable: true, writable: true });
    Object.defineProperty(global, 'localStorage', { value: mockLocalStorage, configurable: true, writable: true });
  } catch {
    (global as any).window = win;
  }
}

async function runThreeInterfacesRoutingVerification() {
  console.log('========================================================================');
  console.log('🌐  CHOPLIFE REPUBLIC — THREE-INTERFACE ROUTING & ISOLATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  const BASE_URL = 'http://localhost:3000';

  // -------------------------------------------------------------
  // TEST 1: Live Server Route Availability
  // -------------------------------------------------------------
  console.log('--- Test 1: Live HTTP Route Handlers for /, /pos, and /admin ---');
  const resRoot = await fetch(`${BASE_URL}/`);
  assert(resRoot.status === 200, 'GET / responds with HTTP 200 OK');
  passed++;

  const resPos = await fetch(`${BASE_URL}/pos`);
  assert(resPos.status === 200, 'GET /pos responds with HTTP 200 OK');
  passed++;

  const resAdmin = await fetch(`${BASE_URL}/admin`);
  assert(resAdmin.status === 200, 'GET /admin responds with HTTP 200 OK');
  passed++;

  // -------------------------------------------------------------
  // TEST 2: Route Detection Logic
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Client Route Detection Logic ---');
  mockWindowLocation('/');
  assert(getInitialRoute() === 'storefront', 'Path "/" maps to route "storefront"');
  passed++;

  mockWindowLocation('/pos');
  assert(getInitialRoute() === 'pos', 'Path "/pos" maps to route "pos"');
  passed++;

  mockWindowLocation('/admin');
  assert(getInitialRoute() === 'admin', 'Path "/admin" maps to route "admin"');
  passed++;

  mockWindowLocation('/', '#pos');
  assert(getInitialRoute() === 'pos', 'Hash "#pos" maps to route "pos"');
  passed++;

  mockWindowLocation('/', '#admin');
  assert(getInitialRoute() === 'admin', 'Hash "#admin" maps to route "admin"');
  passed++;

  // -------------------------------------------------------------
  // TEST 3: Interface 1 — Customer Storefront (/ and #/)
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Customer Storefront Mounting & Staff Links ---');
  mockWindowLocation('/');
  const storefrontHtml = renderToString(React.createElement(App));
  assert(storefrontHtml.includes('Choplife Republic'), 'Storefront renders Choplife Republic brand');
  assert(storefrontHtml.includes('Party Jollof Rice') || storefrontHtml.includes('Menu'), 'Storefront renders menu products');
  assert(!storefrontHtml.includes('footer-front-office-pos-link'), 'Storefront Footer hides internal Front-Office POS link from public guests');
  assert(!storefrontHtml.includes('top-staff-pos-link'), 'Storefront Header hides internal Staff Admin link from public guests');
  passed += 4;

  // -------------------------------------------------------------
  // TEST 4: Interface 2 — Unauthenticated Front-Office Operations (/pos)
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Unauthenticated Front-Office POS Portal ---');
  mockWindowLocation('/pos');
  const posLoginHtml = renderToString(React.createElement(App));
  assert(posLoginHtml.includes('Front-Office POS &amp; Operations') || posLoginHtml.includes('Front-Office POS'), 'Route /pos renders Front-Office Operations portal');
  assert(posLoginHtml.includes('Frontline Staff Login'), 'Route /pos renders Frontline Staff Login screen');
  assert(posLoginHtml.includes('CL-CSH-001'), 'Route /pos displays Cashier quick persona preset');
  assert(posLoginHtml.includes('Switch to Back-Office Admin'), 'Route /pos includes switcher to Back-Office Admin');
  passed += 4;

  // -------------------------------------------------------------
  // TEST 5: Interface 3 — Unauthenticated Back-Office Administration (/admin)
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Unauthenticated Back-Office Admin Portal ---');
  mockWindowLocation('/admin');
  const adminLoginHtml = renderToString(React.createElement(App));
  assert(adminLoginHtml.includes('Back-Office Administration'), 'Route /admin renders Back-Office Administration portal');
  assert(adminLoginHtml.includes('Administrative Governance Login'), 'Route /admin renders Governance Login screen');
  assert(adminLoginHtml.includes('CL-ADM-001'), 'Route /admin displays Super Admin quick persona preset');
  assert(adminLoginHtml.includes('Switch to Front-Office POS'), 'Route /admin includes switcher to Front-Office POS');
  passed += 4;

  // -------------------------------------------------------------
  // TEST 6: Interface 3 — Frontline Cashier Blocked from /admin
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Frontline Role Blocked from /admin Interface ---');
  mockWindowLocation('/admin', '', {
    choplife_staff_active_v1: JSON.stringify({
      id: 'staff-csh-1',
      staffId: 'CL-CSH-001',
      name: 'Chioma Okonjo',
      role: 'cashier',
      branchId: 'gra',
    }),
    choplife_staff_token: 'valid-test-cashier-token',
  });
  const restrictedHtml = renderToString(React.createElement(App));
  assert(restrictedHtml.includes('Access Restricted'), 'Cashier visiting /admin triggers Access Restricted screen');
  assert(restrictedHtml.includes('Chioma Okonjo'), 'Access Restricted screen identifies active staff member');
  assert(restrictedHtml.includes('Go to Front-Office POS'), 'Access Restricted screen provides direct button to Front-Office POS');
  passed += 3;

  // -------------------------------------------------------------
  // TEST 7: Interface 3 — Super Admin Authorized on /admin
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Super Admin Authorized on /admin Interface ---');
  mockWindowLocation('/admin', '', {
    choplife_staff_active_v1: JSON.stringify({
      id: 'staff-adm-1',
      staffId: 'CL-ADM-001',
      name: 'Babajide Adeleke',
      role: 'super_admin',
      branchId: 'all',
    }),
    choplife_staff_token: 'valid-test-admin-token',
  });
  const adminWorkspaceHtml = renderToString(React.createElement(App));
  assert(!adminWorkspaceHtml.includes('Access Restricted'), 'Super Admin is granted access to /admin without restriction');
  assert(adminWorkspaceHtml.includes('Staff Directory') || adminWorkspaceHtml.includes('Back-Office'), 'Super Admin sees Back-Office Administration Workspace');
  passed += 2;

  console.log('\n========================================================================');
  console.log(`🎉 ALL ${passed} THREE-INTERFACE ROUTING & ISOLATION TESTS PASSED!`);
  console.log('========================================================================\n');
}

runThreeInterfacesRoutingVerification().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
