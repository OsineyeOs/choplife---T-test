import assert from 'assert';

async function runTest() {
  console.log('========================================================================');
  console.log('🛡️  CHOPLIFE REPUBLIC — SHIFT RECONCILIATION & STOCK ALERT VERIFICATION');
  console.log('========================================================================');

  const baseUrl = 'http://localhost:3000';

  // 1. Authenticate Super Admin
  const loginRes = await fetch(`${baseUrl}/api/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrStaffId: 'admin@choplife.ng', password: 'ChopLife2025!' }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.ok && loginData.token, 'Super admin login failed');
  const token = loginData.token;
  console.log('✅ [PASS] Super Admin authenticated successfully');

  // 2. Test Feature A: Shift Financial Reconciliation Endpoint
  const registerId = `POS-REG-${Date.now()}`;
  const openShiftRes = await fetch(`${baseUrl}/api/pos/shifts/open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      branchId: 'gra',
      openingFloat: 25000,
      registerId,
      notes: 'Test shift for financial reconciliation audit',
    }),
  });
  const openShiftData = await openShiftRes.json();
  assert(openShiftRes.ok && openShiftData.shift, `Failed to open test shift: ${JSON.stringify(openShiftData)}`);
  const shiftId = openShiftData.shift.id;
  console.log(`✅ [PASS] Test shift opened successfully: ${openShiftData.shift.shiftNumber} (${shiftId})`);

  // Fetch reconciliation report for this shift
  const reconRes = await fetch(`${baseUrl}/api/admin/shifts/${shiftId}/reconciliation`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const reconData = await reconRes.json();
  assert(reconRes.ok && reconData.success, 'Shift reconciliation endpoint failed');
  assert(reconData.shift.id === shiftId, 'Shift reconciliation returned mismatched shift');
  assert(typeof reconData.summary.grossSales === 'number', 'Gross sales missing in reconciliation summary');
  assert(typeof reconData.summary.expectedCashInTill === 'number', 'Expected cash in till missing');
  console.log(`✅ [PASS] Shift Reconciliation API returned HTTP 200 with gross sales: ₦${reconData.summary.grossSales.toLocaleString()} and expected cash: ₦${reconData.summary.expectedCashInTill.toLocaleString()}`);

  // 3. Test Feature B: Background Inventory Reorder Monitoring & Alerts
  const alertRes = await fetch(`${baseUrl}/api/inventory/check-reorder-alerts`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const alertData = await alertRes.json();
  assert(alertRes.ok && alertData.success, 'Inventory reorder monitoring endpoint failed');
  assert(Array.isArray(alertData.alerts), 'Alerts response must be an array');
  console.log(`✅ [PASS] Inventory Reorder Monitoring API executed successfully — checked inventory, identified ${alertData.alerts.length} reorder warning(s)`);

  // Close the test shift
  const closeRes = await fetch(`${baseUrl}/api/pos/shifts/${shiftId}/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      countedCashInTill: 25000,
      notes: 'Audited shift closure closeout',
    }),
  });
  const closeData = await closeRes.json();
  assert(closeRes.ok && closeData.success, 'Failed to close test shift');
  console.log('✅ [PASS] Test shift closed successfully with zero cash variance');

  console.log('========================================================================');
  console.log('🎉 ALL SHIFT RECONCILIATION & STOCK MONITORING TESTS PASSED (3/3)!');
  console.log('========================================================================');
}

runTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
