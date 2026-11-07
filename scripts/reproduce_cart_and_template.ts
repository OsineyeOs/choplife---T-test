import { chromium } from 'playwright';
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

const VIEWPORTS = [
  { width: 320, height: 568, name: '320px (iPhone SE 1st gen)' },
  { width: 360, height: 740, name: '360px (Galaxy S8+)' },
  { width: 375, height: 667, name: '375px (iPhone SE 2nd gen / 8)' },
  { width: 390, height: 844, name: '390px (iPhone 12/13/14)' },
  { width: 430, height: 932, name: '430px (iPhone 14 Pro Max)' },
  { width: 768, height: 1024, name: '768px (iPad Mini / Portrait)' },
  { width: 1024, height: 768, name: '1024px (iPad Pro / Small Laptop)' },
  { width: 1280, height: 800, name: '1280px (Standard Desktop)' },
  { width: 1440, height: 900, name: '1440px (Large Desktop)' },
];

const BASE_URL = 'http://localhost:3000';
const DB_FILE_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');

async function apiRequest(
  path: string,
  method: string = 'GET',
  token?: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function loginStaff(emailOrStaffId: string, password: string): Promise<{ token: string; staff: any }> {
  const res = await apiRequest('/api/auth/staff/login', 'POST', undefined, { emailOrStaffId, password });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Login failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, staff: res.data.staff };
}

async function main() {
  const initialDbSnapshot = fs.existsSync(DB_FILE_PATH)
    ? JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf-8'))
    : null;
  let superAdminToken: string | null = null;

  console.log('================================================================');
  console.log('1. NAVBAR & ORDER CART BUTTON RESPONSIVE VERIFICATION (9 VIEWPORTS)');
  console.log('================================================================');

  const execPath = resolvePlaywrightExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(execPath ? { executablePath: execPath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
  const page = await browser.newPage();

  // Check both empty cart and populated cart across all 9 viewports
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  console.log('\n--- A. Empty Cart State ---');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(80);

    const cartBtn = page.locator('#nav-cart-btn');
    const box = await cartBtn.boundingBox();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);

    if (!box) {
      throw new Error(`[${vp.name}] #nav-cart-btn NOT FOUND!`);
    }

    const rightEdge = box.x + box.width;
    const isOffscreen = box.x < 0 || rightEdge > vp.width;
    const hasHorizontalOverflow = scrollWidth > innerWidth;

    console.log(
      `[${vp.name.padEnd(32)}] W=${String(vp.width).padEnd(4)} | Cart x=${box.x.toFixed(1)}, w=${box.width.toFixed(1)}, right=${rightEdge.toFixed(1)} | ` +
        `Offscreen: ${isOffscreen ? 'YES ❌' : 'NO ✅'} | Overflow: ${hasHorizontalOverflow ? 'YES ❌' : 'NO ✅'}`
    );

    if (isOffscreen || hasHorizontalOverflow) {
      throw new Error(`Viewport failure at ${vp.name}: right=${rightEdge}, scrollWidth=${scrollWidth}`);
    }
  }

  // Verify clicking #nav-cart-btn opens #cart-drawer
  await page.setViewportSize({ width: 375, height: 667 });
  await page.locator('#nav-cart-btn').click();
  await page.waitForTimeout(200);
  const cartDrawerVisible = await page.locator('#cart-drawer').isVisible();
  console.log(`Cart Drawer Opens on Click (375px): ${cartDrawerVisible ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!cartDrawerVisible) {
    throw new Error('Cart drawer did not open when clicking #nav-cart-btn');
  }
  // Close cart drawer
  await page.locator('#cart-drawer button').first().click();
  await page.waitForTimeout(150);

  // Populate cart via localStorage (`choplife_cart`) and reload to test populated cart badge + Naira total across all 9 viewports
  console.log('\n--- B. Populated Cart State (with Item Badge & Naira Total) ---');
  await page.evaluate(() => {
    localStorage.setItem(
      'choplife_cart',
      JSON.stringify([
        {
          cartItemId: 'test-item-1',
          productId: 'prod-shawarma-beef-special',
          name: 'Special Beef Shawarma (Double Sausage)',
          price: 4500,
          quantity: 3,
          image: '',
          category: 'shawarma',
        },
      ])
    );
  });
  await page.reload({ waitUntil: 'networkidle' });

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(80);

    const cartBtn = page.locator('#nav-cart-btn');
    const box = await cartBtn.boundingBox();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);

    if (!box) {
      throw new Error(`[${vp.name}] #nav-cart-btn NOT FOUND!`);
    }

    const rightEdge = box.x + box.width;
    const isOffscreen = box.x < 0 || rightEdge > vp.width;
    const hasHorizontalOverflow = scrollWidth > innerWidth;

    console.log(
      `[${vp.name.padEnd(32)}] W=${String(vp.width).padEnd(4)} | Cart x=${box.x.toFixed(1)}, w=${box.width.toFixed(1)}, right=${rightEdge.toFixed(1)} | ` +
        `Offscreen: ${isOffscreen ? 'YES ❌' : 'NO ✅'} | Overflow: ${hasHorizontalOverflow ? 'YES ❌' : 'NO ✅'}`
    );

    if (isOffscreen || hasHorizontalOverflow) {
      throw new Error(`Populated cart viewport failure at ${vp.name}: right=${rightEdge}, scrollWidth=${scrollWidth}`);
    }
  }

  console.log('\n================================================================');
  console.log('2. PERMISSION MATRIX & BACKEND RBAC ENFORCEMENT (10 SCENARIOS)');
  console.log('================================================================');

  // Login as Superadmin
  const superAdmin = await loginStaff('oluwaseun.osineye@gmail.com', 'ChopLife2025!');
  superAdminToken = superAdmin.token;
  console.log(`[Scenario 1] Superadmin login (${superAdmin.staff.name}): Privileges count=${superAdmin.staff.privileges?.length} ✅`);

  // Verify Superadmin has all hardware permissions
  const requiredHardwarePrivs = [
    'hardware.printers.view',
    'hardware.printers.manage',
    'hardware.printers.test',
    'hardware.templates.edit',
    'hardware.templates.reset',
  ];
  for (const p of requiredHardwarePrivs) {
    if (!superAdmin.staff.privileges.includes(p)) {
      throw new Error(`Superadmin missing privilege: ${p}`);
    }
  }

  // Scenario 5: Unauthorized (unauthenticated) user calling printer/template APIs directly
  const unauthGetPrinters = await apiRequest('/api/pos/printers', 'GET');
  const unauthPutTemplate = await apiRequest('/api/pos/printers/templates/tmpl-cust-receipt', 'PUT', undefined, {
    brandName: 'HACKED',
  });
  console.log(
    `[Scenario 5] Unauthenticated API rejection: GET /printers -> ${unauthGetPrinters.status}, PUT /templates -> ${unauthPutTemplate.status} ${
      unauthGetPrinters.status === 401 && unauthPutTemplate.status === 401 ? '✅' : '❌'
    }`
  );
  if (unauthGetPrinters.status !== 401 || unauthPutTemplate.status !== 401) {
    throw new Error('Unauthenticated requests were not rejected with 401');
  }

  // Create temporary test staff account via Superadmin to test Scenarios 2, 3, 4, 6, 7, 8
  const testEmail = `test.rbac.${Date.now()}@choplife.ng`;
  const testStaffCode = `CL-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const testPass = 'TestStaffPass2026!';

  const createStaffRes = await apiRequest('/api/staff/accounts', 'POST', superAdmin.token, {
    staffId: testStaffCode,
    name: 'Test Delegated Cashier',
    workEmail: testEmail,
    phone: '08030001111',
    role: 'cashier',
    branchId: 'okabere',
    allowedBranchIds: ['okabere'],
    customPrivileges: [], // Scenario 2: Default cashier has hardware.printers.view only
    initialPassword: testPass,
  });
  if (createStaffRes.status !== 201) {
    throw new Error(`Failed to create test staff: ${JSON.stringify(createStaffRes.data)}`);
  }
  const testStaffId = createStaffRes.data.staff.id;

  try {
    // Scenario 2: Staff with view-only printer permission (default cashier)
    const viewOnlyLogin = await loginStaff(testEmail, testPass);
    const viewPrintersRes = await apiRequest('/api/pos/printers', 'GET', viewOnlyLogin.token);
    const viewTemplatesRes = await apiRequest('/api/pos/printers/templates', 'GET', viewOnlyLogin.token);
    const forbiddenCreatePrinter = await apiRequest('/api/pos/printers', 'POST', viewOnlyLogin.token, {
      name: 'Unauthorized Printer',
      ip: '192.168.1.250',
    });
    const forbiddenEditTemplate = await apiRequest(
      '/api/pos/printers/templates/tmpl-cust-receipt',
      'PUT',
      viewOnlyLogin.token,
      { brandName: 'UNAUTHORIZED EDIT' }
    );
    console.log(
      `[Scenario 2] View-only staff (${viewOnlyLogin.staff.role}): GET /printers=${viewPrintersRes.status}, GET /templates=${viewTemplatesRes.status}, POST /printers=${forbiddenCreatePrinter.status}, PUT /templates=${forbiddenEditTemplate.status} ✅`
    );
    if (
      viewPrintersRes.status !== 200 ||
      viewTemplatesRes.status !== 200 ||
      forbiddenCreatePrinter.status !== 403 ||
      forbiddenEditTemplate.status !== 403
    ) {
      throw new Error('Scenario 2 failed');
    }

    // Scenario 3 & 7: Grant template-edit permission only
    await apiRequest(`/api/staff/accounts/${testStaffId}`, 'PUT', superAdmin.token, {
      customPrivileges: ['hardware.templates.edit'],
      branchId: 'all',
      allowedBranchIds: ['all', 'gra', 'okabere', 'ugbowo'],
    });
    const tplEditorLogin = await loginStaff(testEmail, testPass);
    const tplEditRes = await apiRequest(
      '/api/pos/printers/templates/tmpl-cust-receipt',
      'PUT',
      tplEditorLogin.token,
      { customHeaderMessage: 'Okabere Branch Special Promo!' }
    );
    const printerAddDenied = await apiRequest('/api/pos/printers', 'POST', tplEditorLogin.token, {
      name: 'Should Fail Printer',
      ip: '192.168.1.199',
    });
    console.log(
      `[Scenario 3 & 7] Template-edit-only staff: PUT /templates=${tplEditRes.status}, POST /printers=${printerAddDenied.status} ✅`
    );
    if (tplEditRes.status !== 200 || printerAddDenied.status !== 403) {
      throw new Error(`Scenario 3 failed: tplEditRes=${tplEditRes.status} (${JSON.stringify(tplEditRes.data)})`);
    }

    // Scenario 4 & 6: Update customPrivileges to hardware.printers.manage & hardware.printers.test (no template edit), and test branch scope
    await apiRequest(`/api/staff/accounts/${testStaffId}`, 'PUT', superAdmin.token, {
      customPrivileges: ['hardware.printers.manage', 'hardware.printers.test'],
      branchId: 'okabere',
      allowedBranchIds: ['okabere'],
    });

    const printerMgrLogin = await loginStaff(testEmail, testPass);
    const ownBranchPrinterRes = await apiRequest('/api/pos/printers', 'POST', printerMgrLogin.token, {
      name: 'Okabere Test Printer',
      branchId: 'okabere',
      ip: '127.0.0.1',
      port: 9100,
    });
    const otherBranchPrinterRes = await apiRequest('/api/pos/printers', 'POST', printerMgrLogin.token, {
      name: 'Ugbowo Unauthorized Printer',
      branchId: 'ugbowo',
      ip: '127.0.0.1',
      port: 9100,
    });
    const tplEditDenied = await apiRequest(
      '/api/pos/printers/templates/tmpl-cust-receipt',
      'PUT',
      printerMgrLogin.token,
      { customHeaderMessage: 'Should be 403' }
    );
    console.log(
      `[Scenario 4 & 6] Printer-manage staff (Okabere): POST own-branch=${ownBranchPrinterRes.status}, POST ugbowo-branch=${otherBranchPrinterRes.status}, PUT /templates=${tplEditDenied.status} ✅`
    );
    if (
      ownBranchPrinterRes.status !== 201 ||
      otherBranchPrinterRes.status !== 403 ||
      tplEditDenied.status !== 403
    ) {
      throw new Error('Scenario 4/6 failed');
    }

    // Clean up created printer
    if (ownBranchPrinterRes.data?.printer?.id) {
      await apiRequest(`/api/pos/printers/${ownBranchPrinterRes.data.printer.id}`, 'DELETE', superAdmin.token);
    }

    // Scenario 8: Permission revocation takes effect immediately on backend
    await apiRequest(`/api/staff/accounts/${testStaffId}`, 'PUT', superAdmin.token, {
      customPrivileges: [],
    });
    const afterRevokeRes = await apiRequest('/api/pos/printers', 'POST', printerMgrLogin.token, {
      name: 'Post Revoke Printer',
      branchId: 'okabere',
      ip: '127.0.0.1',
    });
    console.log(`[Scenario 8] Permission revocation immediate enforcement: POST /printers=${afterRevokeRes.status} ✅`);
    if (afterRevokeRes.status !== 403) {
      throw new Error('Scenario 8 revocation failed');
    }
  } finally {
    await apiRequest(`/api/staff/accounts/${testStaffId}`, 'DELETE', superAdmin.token);
  }

  console.log('\n================================================================');
  console.log('3. E2E BROWSER RECEIPT TEMPLATE EDITOR LIFECYCLE (SCENARIOS 9 & 10)');
  console.log('================================================================');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle' });

  // Inject Superadmin session into localStorage and reload (renders StaffOperationsWorkspace directly)
  await page.evaluate(
    ({ token, staff }) => {
      localStorage.setItem('choplife_staff_token', token);
      localStorage.setItem('choplife_current_staff', JSON.stringify(staff));
    },
    { token: superAdmin.token, staff: superAdmin.staff }
  );
  await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // Open Printers & Peripherals modal inside StaffOperationsWorkspace
  const printerBtn = page.locator('button:has-text("Printers"), button[title*="Printer"]').first();
  await printerBtn.click();
  await page.waitForTimeout(300);

  // Switch to Receipt & KOT Templates tab
  const templatesTabBtn = page.locator('button:has-text("Receipt & KOT Templates")');
  await templatesTabBtn.click();
  await page.waitForTimeout(400);

  // Verify the editor fields loaded
  const brandTitleInput = page.locator('#tmpl-brand-input');
  const isEditorVisible = await brandTitleInput.isVisible();
  console.log(`Receipt Template Editor Loaded in Browser: ${isEditorVisible ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!isEditorVisible) {
    throw new Error('Receipt Template Editor inputs did not load in browser!');
  }

  // Edit Header Note and Footer Message and verify Live Preview updates immediately
  const customHeaderInput = page.locator('#tmpl-header-note-input');
  const customFooterInput = page.locator('#tmpl-footer-input');
  const uniqueHeader = 'OFFICIAL TAX INVOICE — BENIN HQ VERIFIED';
  const uniqueFooter = 'THANK YOU FOR CHOPPING LIFE WITH US! 100% ENJOYMENT!';

  await customHeaderInput.fill(uniqueHeader);
  await customFooterInput.fill(uniqueFooter);
  await page.waitForTimeout(200);

  // Check #thermal-live-preview-box contains the edited text before even saving
  const previewTextBeforeSave = (await page.locator('#thermal-live-preview-box').textContent()) || '';
  const livePreviewUpdated =
    previewTextBeforeSave.includes(uniqueHeader) && previewTextBeforeSave.includes(uniqueFooter);
  console.log(`Live Receipt Preview Updates Immediately on Edit: ${livePreviewUpdated ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!livePreviewUpdated) {
    throw new Error('Live preview did not update with edited fields');
  }

  // Click Save Template
  const saveBtn = page.locator('#template-save-btn');
  await saveBtn.click();
  await page.waitForTimeout(400);

  // Reload the page completely, reopen the Receipt Template Editor, and confirm persistence
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Printers"), button[title*="Printer"]').first().click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Receipt & KOT Templates")').click();
  await page.waitForTimeout(400);

  const persistedHeaderVal = await page.locator('#tmpl-header-note-input').inputValue();
  const persistedFooterVal = await page.locator('#tmpl-footer-input').inputValue();
  const persistenceVerified = persistedHeaderVal === uniqueHeader && persistedFooterVal === uniqueFooter;
  console.log(
    `[Scenario 9 & 10] Saved Template Persists Across Full Page Reload: ${persistenceVerified ? 'PASS ✅' : 'FAIL ❌'}`
  );
  if (!persistenceVerified) {
    throw new Error(`Persistence mismatch: got "${persistedHeaderVal}" and "${persistedFooterVal}"`);
  }

  // Restore defaults via Restore Defaults button (accept window.confirm dialog automatically)
  page.on('dialog', (dialog) => dialog.accept());
  const resetBtn = page.locator('#template-reset-btn');
  await resetBtn.click();
  await page.waitForTimeout(400);
  const resetFooterVal = await page.locator('#tmpl-footer-input').inputValue();
  console.log(`Restore Approved Defaults Lifecycle: ${resetFooterVal !== uniqueFooter ? 'PASS ✅' : 'FAIL ❌'}`);

  console.log('\n================================================================');
  console.log('4. INVENTORY INDENT / PO / GRN & QUICKBOOKS GL EXPORT VERIFICATION');
  console.log('================================================================');

  const invItemsRes = await apiRequest('/api/inventory/items', 'GET', superAdmin.token);
  const firstInvItem = Array.isArray(invItemsRes.data) ? invItemsRes.data[0] : null;
  if (!firstInvItem) {
    throw new Error('Failed to load canonical inventory items');
  }

  // Ensure general_store has at least 10 units before testing indent dispatch
  const preCheckCommissary = Number(firstInvItem.locationStock?.general_store?.stockOnHand ?? 0);
  if (preCheckCommissary < 10) {
    const supSeedRes = await apiRequest('/api/inventory/purchasing/suppliers', 'GET', superAdmin.token);
    const seedSup = supSeedRes.data?.[0];
    const seedPoRes = await apiRequest('/api/inventory/purchasing/orders', 'POST', superAdmin.token, {
      supplierId: seedSup?.id || 'sup-01',
      destinationLocation: 'general_store',
      items: [{ itemId: firstInvItem.id, orderQuantity: 20, purchaseUnit: firstInvItem.unit, unitPrice: firstInvItem.costPerUnit || 1500 }],
    });
    if (seedPoRes.data?.purchaseOrder?.id) {
      await apiRequest('/api/inventory/purchasing/grn', 'POST', superAdmin.token, {
        purchaseOrderId: seedPoRes.data.purchaseOrder.id,
        supplierInvoiceNumber: 'INV-PRE-REPLENISH-2026',
        receivingLocation: 'general_store',
        lines: [{ itemId: firstInvItem.id, itemName: firstInvItem.name, acceptedQty: 20, unitPrice: firstInvItem.costPerUnit || 1500 }],
      });
    }
  }

  const refreshedInvItemsRes = await apiRequest('/api/inventory/items', 'GET', superAdmin.token);
  const refreshedFirstItem = (refreshedInvItemsRes.data || []).find((i: any) => i.id === firstInvItem.id) || firstInvItem;
  const initialCommissaryStock = Number(refreshedFirstItem.locationStock?.general_store?.stockOnHand ?? 0);
  const initialGraStock = Number(refreshedFirstItem.locationStock?.gra?.stockOnHand ?? 0);

  // 4.1 Create Stock Request Indent with { itemId, requestedQty }
  const createReqRes = await apiRequest('/api/inventory/requests', 'POST', superAdmin.token, {
    sourceLocation: 'general_store',
    destinationLocation: 'gra',
    priority: 'high',
    items: [{ itemId: firstInvItem.id, requestedQty: 5 }],
    notes: 'Automated E2E verification indent',
  });
  const createdReq = createReqRes.data?.request;
  const reqEnrichedOk =
    createReqRes.status === 201 &&
    createdReq?.items?.[0]?.itemName === firstInvItem.name &&
    createdReq?.items?.[0]?.requestedQty === 5 &&
    createdReq?.items?.[0]?.quantityRequested === 5;
  console.log(`[4.1] Stock Indent Created & Enriched (${createdReq?.requestNumber}): ${reqEnrichedOk ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!reqEnrichedOk) throw new Error('Stock indent creation/enrichment failed');

  // 4.2 Approve Stock Indent
  const approveReqRes = await apiRequest(`/api/inventory/requests/${createdReq.id}/review`, 'PUT', superAdmin.token, {
    status: 'approved',
  });
  const approveOk = approveReqRes.status === 200 && approveReqRes.data?.request?.status === 'approved';
  console.log(`[4.2] Stock Indent Approved by Manager: ${approveOk ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!approveOk) throw new Error('Stock indent approval failed');

  // 4.3 Dispatch Approved Stock Indent (previously failed with HTTP 400 & NaN stock corruption)
  const dispatchReqRes = await apiRequest(
    `/api/inventory/requests/${createdReq.id}/dispatch`,
    'POST',
    superAdmin.token,
    {
      issuedItems: [{ itemId: firstInvItem.id, issuedQty: 5 }],
    }
  );
  const dispatchOk =
    dispatchReqRes.status === 200 &&
    dispatchReqRes.data?.request?.status === 'in_transit' &&
    dispatchReqRes.data?.request?.items?.[0]?.issuedQty === 5;
  console.log(`[4.3] Approved Indent Dispatched Without Error: ${dispatchOk ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!dispatchOk) throw new Error(`Stock indent dispatch failed: ${JSON.stringify(dispatchReqRes.data)}`);

  // 4.4 Receive Dispatched Stock Indent & Verify No NaN Corruption
  const receiveReqRes = await apiRequest(
    `/api/inventory/requests/${createdReq.id}/receive`,
    'POST',
    superAdmin.token,
    {
      receivedItems: [{ itemId: firstInvItem.id, receivedQty: 5 }],
    }
  );
  const receiveOk =
    receiveReqRes.status === 200 &&
    receiveReqRes.data?.request?.status === 'completed';
  console.log(`[4.4] Dispatched Indent Received & Marked Completed: ${receiveOk ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!receiveOk) throw new Error(`Stock indent receive failed: ${JSON.stringify(receiveReqRes.data)}`);

  const invAfterTransfer = await apiRequest('/api/inventory/items', 'GET', superAdmin.token);
  const updatedItem = (invAfterTransfer.data || []).find((i: any) => i.id === firstInvItem.id);
  const afterCommissary = Number(updatedItem?.locationStock?.general_store?.stockOnHand);
  const afterGra = Number(updatedItem?.locationStock?.gra?.stockOnHand);
  const stockMathValid =
    !Number.isNaN(afterCommissary) &&
    !Number.isNaN(afterGra) &&
    afterCommissary === Math.max(0, initialCommissaryStock - 5) &&
    afterGra === initialGraStock + 5;
  console.log(
    `[4.5] Double-Entry Stock Math Validated (Commissary: ${initialCommissaryStock}->${afterCommissary}, GRA: ${initialGraStock}->${afterGra}, No NaN): ${
      stockMathValid ? 'PASS ✅' : 'FAIL ❌'
    }`
  );
  if (!stockMathValid) throw new Error('Stock math validation failed');

  // 4.6 Create Purchase Order & Receive GRN
  const supRes = await apiRequest('/api/inventory/purchasing/suppliers', 'GET', superAdmin.token);
  const firstSupplier = supRes.data?.[0];
  const poRes = await apiRequest('/api/inventory/purchasing/orders', 'POST', superAdmin.token, {
    supplierId: firstSupplier?.id || 'sup-01',
    destinationLocation: 'general_store',
    items: [{ itemId: firstInvItem.id, orderQuantity: 5, purchaseUnit: firstInvItem.unit, unitPrice: firstInvItem.costPerUnit || 1500 }],
  });
  const poOk = poRes.status === 201 && poRes.data?.purchaseOrder?.poNumber;
  console.log(`[4.6] Purchase Order Created (${poRes.data?.purchaseOrder?.poNumber}): ${poOk ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!poOk) throw new Error('PO creation failed');

  const grnRes = await apiRequest('/api/inventory/purchasing/grn', 'POST', superAdmin.token, {
    purchaseOrderId: poRes.data.purchaseOrder.id,
    supplierInvoiceNumber: 'INV-VERIFIED-2026',
    receivingLocation: 'general_store',
    lines: [{ itemId: firstInvItem.id, itemName: firstInvItem.name, acceptedQty: 5, unitPrice: firstInvItem.costPerUnit || 1500 }],
  });
  const grnOk =
    grnRes.status === 201 &&
    Array.isArray(grnRes.data?.grn?.items) &&
    grnRes.data.grn.items.length === 1 &&
    typeof grnRes.data.grn.actualAcceptedValue === 'number' &&
    grnRes.data.grn.actualAcceptedValue > 0;
  console.log(
    `[4.7] Verified GRN Recorded & Normalized (${grnRes.data?.grn?.grnNumber}, ₦${grnRes.data?.grn?.actualAcceptedValue}): ${
      grnOk ? 'PASS ✅' : 'FAIL ❌'
    }`
  );
  if (!grnOk) throw new Error('GRN normalization check failed');

  // 4.8 QuickBooks Online / IFRS Transaction-Level Double-Entry General Ledger Journal CSV Export
  const qbRes = await fetch(`${BASE_URL}/api/reports/export-csv`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdmin.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ exportType: 'quickbooks', branchId: 'all', period: 'all', taxMode: 'vat_inclusive_7_5' }),
  });
  const qbCsv = await qbRes.text();
  const hasForbidden9999 = qbCsv.includes('"9999"');
  const qbOk =
    qbRes.status === 200 &&
    qbCsv.startsWith('JournalNo,JournalDate,SourceType,SourceRef,BranchId,LocationClass,AccountCode,AccountName,DebitNGN,CreditNGN,TaxCode,Memo,BatchDigest') &&
    !hasForbidden9999;
  console.log(`[4.8] QuickBooks Transaction-Level Double-Entry Journal CSV Export (Zero 9999 Plug Rows): ${qbOk ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!qbOk) throw new Error(`QuickBooks CSV export failed: ${qbCsv}`);

  console.log('\n================================================================');
  console.log('5. PRIORITY FIXES 1–5 E2E & API VERIFICATION');
  console.log('================================================================');

  // 5.1 Login Security & Neutral Placeholders on /pos and /admin
  const cleanCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const cleanPage = await cleanCtx.newPage();
  await cleanPage.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle' });
  const posIdPlaceholder = await cleanPage.locator('input[type="text"]').first().getAttribute('placeholder');
  const posPassPlaceholder = await cleanPage.locator('input[type="password"]').first().getAttribute('placeholder');
  const posBodyHtml = await cleanPage.content();
  const noLeakedCreds =
    !posBodyHtml.includes('CL-CSH-001') &&
    !posBodyHtml.includes('CL-ADM-001') &&
    !posBodyHtml.includes('cashier@choplife.ng') &&
    !posBodyHtml.includes('admin@choplife.ng');
  const loginPlaceholdersOk =
    posIdPlaceholder === 'john.doe@example.com' &&
    posPassPlaceholder === 'Enter your password' &&
    noLeakedCreds;
  console.log(`[5.1] Neutral Login Placeholders & Zero Credential Leakage: ${loginPlaceholdersOk ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!loginPlaceholdersOk) throw new Error(`Login placeholder check failed: id=${posIdPlaceholder}, pass=${posPassPlaceholder}`);
  await cleanCtx.close();

  // 5.2 CMS Preview Storefront & Executive BI Print Report & System Config Editing
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Navigate to Website CMS tab
  const cmsTabBtn = page.locator('button:has-text("Website Content (CMS)")').first();
  await cmsTabBtn.click();
  await page.waitForTimeout(500);
  const previewStorefrontBtn = page.locator('#cms-preview-storefront-btn');
  await previewStorefrontBtn.click();
  await page.waitForTimeout(500);
  const previewBannerVisible = await page.locator('#storefront-preview-banner').isVisible();
  console.log(`[5.2] CMS "Preview Storefront" Renders Live Storefront with Preview Banner: ${previewBannerVisible ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!previewBannerVisible) throw new Error('CMS Preview Storefront banner did not appear');

  // Exit preview back to Admin
  await page.locator('#exit-storefront-preview-btn').click();
  await page.waitForTimeout(500);

  // Navigate to Executive BI & test Print Report modal
  const biTabBtn = page.locator('button:has-text("Executive Reports")').first();
  await biTabBtn.click();
  await page.waitForTimeout(600);
  const printReportBtn = page.locator('#btn-print-executive-report');
  await printReportBtn.click();
  await page.waitForTimeout(400);
  const printModalVisible = await page.locator('#executive-printable-report-modal').isVisible();
  console.log(`[5.3] Executive BI "Print Report" Opens Structured Printable Report Modal: ${printModalVisible ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!printModalVisible) throw new Error('Executive Printable Report Modal did not open');

  // Close Print Report modal and test System Configuration Hub persistence
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const sysConfigTabBtn = page.locator('button:has-text("System Configuration")').first();
  await sysConfigTabBtn.click();
  await page.waitForTimeout(500);
  const editableInputsCount = await page.locator('input, select').count();
  const sysUpdateRes = await apiRequest('/api/settings/tax', 'PUT', superAdmin.token, {
    vatEnabled: true,
    vatRatePercent: 7.5,
    taxPricingMode: 'inclusive',
    consumptionTaxEnabled: false,
    consumptionTaxPercent: 5,
    serviceChargeEnabled: false,
    serviceChargePercent: 10,
    invoiceTaxRegistrationNumber: 'TIN-10948291-0001-VERIFIED',
  });
  const sysGetRes = await apiRequest('/api/settings', 'GET', superAdmin.token);
  const sysConfigOk =
    editableInputsCount >= 4 &&
    sysUpdateRes.status === 200 &&
    sysGetRes.data?.settings?.tax?.invoiceTaxRegistrationNumber === 'TIN-10948291-0001-VERIFIED';
  console.log(`[5.4] System Configuration Editable Controls (${editableInputsCount} inputs) & Backend Persistence: ${sysConfigOk ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!sysConfigOk) throw new Error('System Configuration persistence check failed');

  console.log('\nALL VIEWPORT, TEMPLATE EDITOR, RBAC, INVENTORY, ACCOUNTING & PRIORITY FIX CHECKS PASSED SUCCESSFULLY! 🎉');
  } finally {
    await browser.close().catch(() => {});
    if (initialDbSnapshot && superAdminToken) {
      await apiRequest('/api/admin/db/reload', 'POST', superAdminToken, { snapshot: initialDbSnapshot }).catch(() => {});
    }
  }
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
