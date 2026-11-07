/**
 * tests/dashboardReconciliationAudit.mjs
 * Choplife Republic — Executive Dashboard vs Enterprise Reports Reconciliation Audit
 */

import assert from 'node:assert/strict';

const BASE_URL = process.env.APPLET_URL || 'http://localhost:3000';

async function requestJson(urlPath, options = {}) {
  const url = `${BASE_URL}${urlPath}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, headers: res.headers, body };
}

async function loginStaff(emailOrStaffId, password = 'ChopLife2025!') {
  const res = await requestJson('/api/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ emailOrStaffId, password }),
  });
  assert.equal(res.status, 200, `Login failed for ${emailOrStaffId}`);
  assert.ok(res.body.token, `Expected token for ${emailOrStaffId}`);
  return res.body.token;
}

async function runReconciliationAudit() {
  console.log('=== CHOPLIFE REPUBLIC: EXECUTIVE DASHBOARD & REPORTING RECONCILIATION AUDIT ===\n');

  const adminToken = await loginStaff('admin@choplife.ng');
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const cashierToken = await loginStaff('cashier.okabere@choplife.ng');
  const cashierHeaders = { Authorization: `Bearer ${cashierToken}` };

  // 1. Dashboard vs Sales Summary Report Reconciliation for 'all' period
  console.log('[TEST 1] Reconciling Executive Dashboard vs Sales Summary Report (All Time)...');
  const dashRes = await requestJson('/api/reports/executive-dashboard?period=all&branchId=all', {
    headers: adminHeaders,
  });
  assert.equal(dashRes.status, 200, 'Failed to fetch executive dashboard');

  const reportRes = await requestJson('/api/reports/generate', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ reportCode: 'report.sales_summary', period: 'all', branchId: 'all' }),
  });
  assert.equal(reportRes.status, 200, 'Failed to generate sales summary report');

  const pnl = dashRes.body.pnl || {};
  const dashNetRev = pnl.netRevenue;
  const dashGrossRev = pnl.grossRevenue;

  assert.ok(Array.isArray(reportRes.body.rows), 'Sales summary report missing rows array');
  assert.ok(Array.isArray(reportRes.body.summaryMetrics), 'Sales summary report missing summaryMetrics array');

  // Compute total sales from report rows
  const reportRows = reportRes.body.rows;
  const reportTotalPaid = reportRows.reduce((sum, r) => sum + (r.total || 0), 0);
  const reportOrderCount = reportRows.length;

  console.log(`  Executive Dashboard P&L Net Revenue: ₦${dashNetRev.toLocaleString()} (Gross: ₦${dashGrossRev.toLocaleString()})`);
  console.log(`  Enterprise Sales Summary Total Paid: ₦${reportTotalPaid.toLocaleString()} across ${reportOrderCount} records`);
  console.log('  Summary Metrics:', reportRes.body.summaryMetrics.map((s) => `${s.label}: ${s.value}`).join(' | '));

  assert.equal(dashNetRev, reportTotalPaid, 'Net Revenue on Executive Dashboard must equal total paid on Sales Summary Report');
  console.log('  [PASS] Single authoritative source of truth verified between Executive Dashboard and Sales Summary Report!\n');

  // 2. Branch-Scoped Reconciliation (GRA Branch)
  console.log('[TEST 2] Reconciling Executive Dashboard vs Sales Summary Report for GRA Branch...');
  const graDashRes = await requestJson('/api/reports/executive-dashboard?period=all&branchId=gra', {
    headers: adminHeaders,
  });
  assert.equal(graDashRes.status, 200);

  const graRptRes = await requestJson('/api/reports/generate', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ reportCode: 'report.sales_summary', period: 'all', branchId: 'gra' }),
  });
  assert.equal(graRptRes.status, 200);

  assert.equal(graDashRes.body.branchId, 'gra');
  assert.equal(graRptRes.body.effectiveBranchId, 'gra');

  const graReportTotalPaid = graRptRes.body.rows.reduce((sum, r) => sum + (r.total || 0), 0);
  assert.equal(graDashRes.body.pnl.netRevenue, graReportTotalPaid, 'GRA Executive Dashboard net revenue must match GRA report total paid');
  console.log('  [PASS] GRA Branch scoping reconciled cleanly!\n');

  // 3. Adversarial Case: Expired/Invalid Token
  console.log('[TEST 3] Testing security boundary with invalid token...');
  const invalidRes = await requestJson('/api/reports/executive-dashboard', {
    headers: { Authorization: 'Bearer INVALID_EXPIRED_TOKEN' },
  });
  assert.equal(invalidRes.status, 401, `Expected 401 for invalid token, got ${invalidRes.status}`);
  console.log('  [PASS] Invalid session token correctly rejected with 401 Unauthorized!\n');

  // 4. Adversarial Case: Unauthorized Cashier Role
  console.log('[TEST 4] Testing role-based access control for Executive Dashboard...');
  const cashierDashRes = await requestJson('/api/reports/executive-dashboard', {
    headers: cashierHeaders,
  });
  assert.equal(cashierDashRes.status, 403, `Expected 403 for cashier accessing executive dashboard, got ${cashierDashRes.status}`);
  console.log('  [PASS] Cashier restricted from executive dashboard with 403 Forbidden!\n');

  // 5. Adversarial Case: Invalid Date Inputs (startDate > endDate)
  console.log('[TEST 5] Testing custom date range validation (startDate > endDate)...');
  const badDateRes = await requestJson('/api/reports/executive-dashboard?period=custom&startDate=2026-12-31&endDate=2026-01-01', {
    headers: adminHeaders,
  });
  assert.equal(badDateRes.status, 200, 'Custom period with swapped dates handled gracefully');
  assert.ok(badDateRes.body.windowStartIso && badDateRes.body.windowEndIso, 'Window ISO bounds returned');
  const startMs = new Date(badDateRes.body.windowStartIso).getTime();
  const endMs = new Date(badDateRes.body.windowEndIso).getTime();
  assert.ok(startMs <= endMs, 'Bounds auto-corrected so windowStartIso <= windowEndIso');
  console.log('  [PASS] Swapped date parameters normalized safely without throwing server exception!\n');

  console.log('=== ALL RECONCILIATION AND ADVERSARIAL TESTS PASSED CLEANLY (100%) ===');
}

runReconciliationAudit().catch((err) => {
  console.error('\n[RECONCILIATION AUDIT FAILED]', err);
  process.exit(1);
});
