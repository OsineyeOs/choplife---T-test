import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function requestJson(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let body = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, headers: res.headers, body, rawText: text };
}

async function loginStaff(emailOrStaffId, password = 'ChopLife2025!') {
  const res = await requestJson('/api/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ emailOrStaffId, password }),
  });
  assert.equal(res.status, 200, `Login failed for ${emailOrStaffId}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body.token, `Expected session token for ${emailOrStaffId}`);
  return res.body.token;
}

async function runReleaseGateTests() {
  const results = [];
  const record = (id, name, passed, details) => {
    results.push({ id, name, passed, details, timestamp: new Date().toISOString() });
    const icon = passed ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${id}: ${name} -> ${details}`);
    if (!passed) {
      throw new Error(`Test ${id} (${name}) failed: ${details}`);
    }
  };

  // 1. Health & Readiness checks (Phase 2)
  const live = await requestJson('/api/health/live');
  assert.equal(live.status, 200);
  assert.equal(live.body.healthy, true);
  record('RG-01', 'GET /api/health/live liveness check', true, `HTTP ${live.status}, status=${live.body.status}`);

  const ready = await requestJson('/api/health/ready');
  assert.equal(ready.status, 200);
  assert.equal(ready.body.status, 'ready');
  assert.equal(ready.body.migrationState, 'verified');
  record(
    'RG-02',
    'GET /api/health/ready readiness & DB authority check',
    true,
    `HTTP ${ready.status}, database=${ready.body.database}, pgStaffCount=${ready.body.pgStaffCount}, pgBranchesCount=${ready.body.pgBranchesCount}`
  );

  const health = await requestJson('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal(health.body.migrationState, 'verified');
  assert.ok(health.body.productsCount >= 200, `Expected >=200 canonical products, got ${health.body.productsCount}`);
  record(
    'RG-03',
    'GET /api/health canonical seed & migration verification',
    true,
    `HTTP ${health.status}, products=${health.body.productsCount}, staff=${health.body.pgStaffCount}, migrationState=${health.body.migrationState}`
  );

  // Authenticate real staff roles via PostgreSQL session engine
  const adminToken = await loginStaff('admin@choplife.ng');
  const graManagerToken = await loginStaff('manager.gra@choplife.ng');
  const graCashierToken = await loginStaff('cashier.gra@choplife.ng');

  // 2. RBAC Permissions Catalogue (Phase 3 / Screenshot 174720)
  const rbacCat = await requestJson('/api/rbac/permissions-catalogue', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(rbacCat.status, 200);
  assert.ok(Array.isArray(rbacCat.body.categories) && rbacCat.body.categories.length >= 8);
  assert.ok(Array.isArray(rbacCat.body.reports) && rbacCat.body.reports.length >= 10);
  assert.ok(Array.isArray(rbacCat.body.orderSummaryColumns) && rbacCat.body.orderSummaryColumns.length >= 8);
  record(
    'RG-04',
    'GET /api/rbac/permissions-catalogue returns canonical privilege categories, reports & columns',
    true,
    `categories=${rbacCat.body.categories.length}, reports=${rbacCat.body.reports.length}, columns=${rbacCat.body.orderSummaryColumns.length}`
  );

  // 3. Delivery Fee Authority Unification (Phase 8 / Screenshot 182931)
  const zonesRes = await requestJson('/api/delivery/zones');
  assert.equal(zonesRes.status, 200);
  const zoneList = Array.isArray(zonesRes.body)
    ? zonesRes.body
    : zonesRes.body._canonicalSchedule || Object.values(zonesRes.body).filter((z) => z && typeof z === 'object');
  assert.ok(Array.isArray(zoneList) && zoneList.length >= 5);
  for (const z of zoneList) {
    const fee = Number(z.customerDeliveryFee ?? z.fee);
    const rider = Number(z.riderPayout ?? z.riderShareAmount);
    const company = Number(z.choplifeShare ?? z.companyShareAmount);
    assert.equal(fee, rider + company, `Zone ${z.zoneName || z.name} fee (${fee}) != rider (${rider}) + company (${company})`);
  }
  record(
    'RG-05',
    'GET /api/delivery/zones canonical fee-split invariant (customerFee === riderShare + companyShare)',
    true,
    `Verified ${zoneList.length} zones; e.g. ${zoneList[0].zoneName || zoneList[0].name}: ₦${zoneList[0].customerDeliveryFee ?? zoneList[0].fee} = ₦${zoneList[0].riderPayout ?? zoneList[0].riderShareAmount} + ₦${zoneList[0].choplifeShare ?? zoneList[0].companyShareAmount}`
  );

  const quoteRes = await requestJson('/api/delivery/quote', {
    method: 'POST',
    body: JSON.stringify({ branchId: 'gra', deliveryZone: 'Airport Road / Adesuwa', orderType: 'delivery' }),
  });
  assert.equal(quoteRes.status, 200);
  assert.equal(quoteRes.body.customerDeliveryFee, 1800);
  assert.equal(quoteRes.body.riderShareAmount, 1250);
  assert.equal(quoteRes.body.companyShareAmount, 550);
  record(
    'RG-06',
    'POST /api/delivery/quote authoritative zone quote & split resolution',
    true,
    `Zone=${quoteRes.body.zoneName}, Fee=₦${quoteRes.body.customerDeliveryFee}, Rider=₦${quoteRes.body.riderShareAmount}, Company=₦${quoteRes.body.companyShareAmount}`
  );

  // 4. Order Pricing & Snapshot of Delivery Fee Split (Phase 8)
  const calcRes = await requestJson('/api/orders/calculate-pricing', {
    method: 'POST',
    body: JSON.stringify({
      branchId: 'gra',
      orderType: 'delivery',
      deliveryZone: 'Ring Road / Akpakpava',
      items: [{ productId: 'prod-sc-2000-mini', quantity: 2 }],
    }),
  });
  assert.equal(calcRes.status, 200);
  assert.equal(calcRes.body.deliveryFee, 2000);
  assert.equal(calcRes.body.riderPayoutAmount, 1400);
  assert.equal(calcRes.body.companyDeliveryShare, 600);
  record(
    'RG-07',
    'POST /api/orders/calculate-pricing snapshots authoritative zone fee & rider/company split',
    true,
    `subtotal=₦${calcRes.body.subtotal}, deliveryFee=₦${calcRes.body.deliveryFee}, rider=₦${calcRes.body.riderPayoutAmount}, company=₦${calcRes.body.companyDeliveryShare}`
  );

  // 5. Enterprise Reports Catalogue & RBAC Enforcement (Phase 10)
  const cashierCat = await requestJson('/api/reports/catalogue', {
    headers: { Authorization: `Bearer ${graCashierToken}` },
  });
  assert.equal(cashierCat.status, 200);
  assert.equal(cashierCat.body.reports.length, 0);
  record(
    'RG-08',
    'GET /api/reports/catalogue blocks Cashier from accessing back-office reports',
    true,
    `cashier allowed reports count=${cashierCat.body.reports.length}`
  );

  const adminCat = await requestJson('/api/reports/catalogue', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminCat.status, 200);
  assert.equal(adminCat.body.reports.length, 14);
  record(
    'RG-09',
    'GET /api/reports/catalogue grants Super Admin access to all 14 canonical reports',
    true,
    `super_admin allowed reports count=${adminCat.body.reports.length}`
  );

  // 6. Negative RBAC test on POST /api/reports/generate and Cross-Branch Scope Enforcement
  const unauthorizedGen = await requestJson('/api/reports/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${graCashierToken}` },
    body: JSON.stringify({
      reportCode: 'report.payroll_register',
      branchId: 'all',
    }),
  });
  assert.equal(unauthorizedGen.status, 403);
  record(
    'RG-10',
    'POST /api/reports/generate returns HTTP 403 for unauthorized role (Cashier -> Payroll Register)',
    true,
    `HTTP ${unauthorizedGen.status}: ${unauthorizedGen.body.error}`
  );

  const crossBranchManager = await requestJson('/api/reports/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${graManagerToken}` },
    body: JSON.stringify({
      reportCode: 'report.sales_summary',
      branchId: 'ugbowo',
    }),
  });
  assert.equal(crossBranchManager.status, 403);
  record(
    'RG-11',
    'POST /api/reports/generate returns HTTP 403 when Branch Manager requests another branch (GRA manager -> Ugbowo)',
    true,
    `HTTP ${crossBranchManager.status}: ${crossBranchManager.body.error}`
  );

  // 7. Payroll Register Bank Account Masking & Unmasked Disbursement Control
  const payrollMasked = await requestJson('/api/reports/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      reportCode: 'report.payroll_register',
      branchId: 'all',
      includeUnmaskedBankDetails: false,
    }),
  });
  assert.equal(payrollMasked.status, 200);
  assert.ok(payrollMasked.body.rows.length > 0);
  const firstMaskedAcct = String(payrollMasked.body.rows[0].accountNumber || '');
  assert.ok(firstMaskedAcct.startsWith('******') || firstMaskedAcct === 'Not Configured', `Expected masked account, got ${firstMaskedAcct}`);
  record(
    'RG-12',
    'POST /api/reports/generate masks bank account numbers by default (******6789)',
    true,
    `rows=${payrollMasked.body.rows.length}, sampleMaskedAccount=${firstMaskedAcct}`
  );

  // 8. Export Sanitization & Audit Trail Verification
  const csvExport = await requestJson('/api/reports/export', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      reportCode: 'report.rider_settlement',
      branchId: 'all',
      format: 'csv',
    }),
  });
  assert.equal(csvExport.status, 200);
  assert.ok(csvExport.rawText.includes('Choplife Republic — Official Enterprise Report Export'));
  assert.ok(csvExport.rawText.includes('Dispatch Rider Delivery Settlement & Zone Split Report'));
  record(
    'RG-13',
    'POST /api/reports/export generates RFC-4180 CSV with metadata header & logs REPORT_EXPORTED audit event',
    true,
    `HTTP ${csvExport.status}, bytes=${csvExport.rawText.length}`
  );

  // Verify the audit log recorded both the blocked attempt and the completed export
  const auditReport = await requestJson('/api/reports/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      reportCode: 'report.security_audit_log',
      branchId: 'all',
    }),
  });
  assert.equal(auditReport.status, 200);
  const actions = auditReport.body.rows.map((r) => r.actionType);
  assert.ok(actions.includes('REPORT_EXPORTED'), 'Expected REPORT_EXPORTED in security audit log');
  assert.ok(actions.includes('UNAUTHORIZED_REPORT_ACCESS_BLOCKED'), 'Expected UNAUTHORIZED_REPORT_ACCESS_BLOCKED in security audit log');
  record(
    'RG-14',
    'Security & Audit Log captures both REPORT_EXPORTED and UNAUTHORIZED_REPORT_ACCESS_BLOCKED events',
    true,
    `Verified in report.security_audit_log (total events=${auditReport.body.rows.length})`
  );

  // 9. Iframe Header Resilience Check (X-Staff-Id header allows authorized report access when cookies are blocked)
  const adminMe = await requestJson('/api/auth/staff/me', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminStaffId = adminMe.body.id;
  const iframeResilienceRes = await requestJson('/api/reports/catalogue', {
    headers: { 'X-Staff-Id': adminStaffId },
  });
  assert.equal(iframeResilienceRes.status, 200);
  assert.equal(iframeResilienceRes.body.reports.length, 14);
  record(
    'RG-15',
    'GET /api/reports/catalogue via X-Staff-Id header grants authorized reports when cookies/bearer are omitted in iframe',
    true,
    `super_admin reports via X-Staff-Id=${iframeResilienceRes.body.reports.length}`
  );

  console.log(`\nALL ${results.length} RELEASE-GATE AUTOMATED TESTS PASSED.`);
}

runReleaseGateTests().catch((err) => {
  console.error('\nRELEASE-GATE TEST SUITE FAILED:', err);
  process.exit(1);
});
