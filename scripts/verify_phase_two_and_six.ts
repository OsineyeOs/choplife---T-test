import * as XLSX from 'xlsx';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('================================================================================');
  console.log('CHOPLIFE REPUBLIC — VERIFYING PHASE 2 (CATERING) & PHASE 6 (EZEE OPTIMUS XLSX)');
  console.log('================================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string, errDetail?: any) {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`, errDetail ? JSON.stringify(errDetail) : '');
      failed++;
    }
  }

  // Login as admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@choplife.ng', password: 'ChopLife2025!' }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.ok && !!loginData.token, 'Authenticated as admin@choplife.ng');
  const token = loginData.token;
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log('\n--- 1. CATERING GUEST LIMIT & VALIDATION (PHASE 2) ---');

  // Test guest counts 10, 250, 500, 501, 1000, 5000 via server endpoint /api/catering/events
  const testCounts = [10, 250, 500, 501, 1000, 5000];
  for (const gc of testCounts) {
    const res = await fetch(`${BASE_URL}/api/catering/events`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        clientName: 'High-Volume Event Planner',
        clientPhone: '+2348012345678',
        eventDate: '2026-12-15',
        guestCount: gc,
        packageStyle: 'Small Chops Feast Box',
        packageTier: 'Corporate Premium',
        branchId: 'gra',
      }),
    });
    const data = await res.json();
    assert(res.ok && data.cateringEvent?.guestCount === gc, `Catering event successfully accepts ${gc.toLocaleString()} guests without 500 ceiling`, data);
  }

  // Test server rejection of invalid / negative guest counts
  const invalidCounts = [0, -10, 150000];
  for (const inv of invalidCounts) {
    const res = await fetch(`${BASE_URL}/api/catering/events`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        clientName: 'Invalid Guest Count Tester',
        clientPhone: '+2348012345678',
        eventDate: '2026-12-15',
        guestCount: inv,
        branchId: 'gra',
      }),
    });
    const data = await res.json();
    assert(res.status === 400, `Server rejects invalid guest count (${inv}) with HTTP ${res.status}`, data);
  }

  console.log('\n--- 2. EZEE OPTIMUS REAL XLSX WORKBOOK GENERATION & INSPECTION (PHASE 6) ---');

  // Create a real in-memory XLSX workbook simulating eZee Optimus sales export
  const wb = XLSX.utils.book_new();
  const sampleData = [
    {
      'Bill No': 'EZ-2026-101',
      'POS Outlet': 'eZee GRA Flagship',
      'Bill Date': '2025-11-20T14:15:00.000Z',
      'Gross Amount': 25000,
      'Discount Amount': 1000,
      'Net Amount': 24000,
      'Payment Method': 'POS Card',
      'Customer Name': 'Chief Obasanjo',
      'Item Summary': 'Mega Grill Feast Platter & Fresh Agege Loaf',
    },
    {
      'Bill No': 'EZ-2026-102',
      'POS Outlet': 'eZee Okabere',
      'Bill Date': '2025-11-21T18:30:00.000Z',
      'Gross Amount': 14500,
      'Discount Amount': 0,
      'Net Amount': 14500,
      'Payment Method': 'Cash',
      'Customer Name': 'Senator Edebiri',
      'Item Summary': 'Smoky Party Jollof & Peppered Turkey Combo',
    },
    {
      'Bill No': 'EZ-2026-103',
      'POS Outlet': 'eZee Ugbowo',
      'Bill Date': '2025-11-22T12:45:00.000Z',
      'Gross Amount': 8000,
      'Discount Amount': 500,
      'Net Amount': 7500,
      'Payment Method': 'Bank Transfer',
      'Customer Name': 'Prof. Osahon',
      'Item Summary': 'Campus Shawarma & Zobo Combo',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws, 'Sales_Register');
  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const xlsxBase64 = xlsxBuffer.toString('base64');

  // Test /api/migration/ezee/inspect
  const inspectRes = await fetch(`${BASE_URL}/api/migration/ezee/inspect`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      fileBase64: xlsxBase64,
      filename: 'eZee_Optimus_Sales_Export_Nov2025.xlsx',
    }),
  });
  const inspectData = await inspectRes.json();
  assert(inspectRes.ok, 'POST /api/migration/ezee/inspect succeeded with HTTP 200', inspectData);
  assert(inspectData.sheetNames?.includes('Sales_Register'), 'Detected "Sales_Register" sheet in workbook');
  assert(inspectData.activeSheet?.rowCount === 3, `Inspected rowCount matches workbook rows (found: ${inspectData.activeSheet?.rowCount})`);
  assert(!!inspectData.checksum && inspectData.checksum.length === 64, 'Generated valid SHA-256 checksum for binary file');
  assert(inspectData.detectedReportType === 'ezee_sales_register', `Correctly detected report type: ${inspectData.detectedReportType}`);
  assert(inspectData.suggestedMapping?.legacyRecordId === 'Bill No', 'Auto-detected legacyRecordId mapped to "Bill No"');
  assert(inspectData.suggestedMapping?.outlet === 'POS Outlet', 'Auto-detected outlet mapped to "POS Outlet"');
  assert(inspectData.suggestedMapping?.netAmount === 'Net Amount', 'Auto-detected netAmount mapped to "Net Amount"');

  console.log('\n--- 3. EZEE OPTIMUS DRY-RUN, COMMITTAL & AUDITED ROLLBACK (PHASE 6) ---');

  // Get next live check sequence before dry run
  const discRes = await fetch(`${BASE_URL}/api/migration/ezee/discovery`, { headers: authHeaders });
  const discData = await discRes.json();
  const liveSeqBefore = discData.nextLiveCheckNumber;

  // Dry-run with binary xlsx base64 + column mapping
  const dryRunRes = await fetch(`${BASE_URL}/api/migration/ezee/dry-run`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      fileBase64: xlsxBase64,
      filename: 'eZee_Optimus_Sales_Export_Nov2025.xlsx',
      selectedSheet: 'Sales_Register',
      columnMapping: inspectData.suggestedMapping,
    }),
  });
  const dryRunData = await dryRunRes.json();
  assert(dryRunRes.ok, 'POST /api/migration/ezee/dry-run succeeded with binary XLSX workbook', dryRunData);
  assert(dryRunData.recordCounts?.targetReadyToCommit === 3, 'Dry-run reconciled 3 records ready to commit');
  assert(dryRunData.financialParity?.targetNetSales === 46000, `Target Net Sales match expected ₦46,000 (found: ₦${dryRunData.financialParity?.targetNetSales})`);
  assert(dryRunData.liveCounterIsolationCheck?.isStrictlyIsolated === true, 'Live check counter strictly isolated during dry-run');

  const batchId = dryRunData.migrationBatchId;

  // Commit batch
  const commitRes = await fetch(`${BASE_URL}/api/migration/ezee/commit`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ migrationBatchId: batchId }),
  });
  const commitData = await commitRes.json();
  assert(commitRes.ok && commitData.committedCount === 3, `Committed ${commitData.committedCount} historical records`);
  assert(commitData.isLiveSequenceUntouched === true, `Live sequence untouched after commit (before: ${commitData.liveSequenceBeforeCommit}, after: ${commitData.liveSequenceAfterCommit})`);

  // Audited Rollback
  const rollbackRes = await fetch(`${BASE_URL}/api/migration/ezee/rollback`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      migrationBatchId: batchId,
      reason: 'Automated test suite rollback verification',
    }),
  });
  const rollbackData = await rollbackRes.json();
  assert(rollbackRes.ok, 'POST /api/migration/ezee/rollback succeeded');
  assert(rollbackData.removedChecksCount === 3, `Cleanly removed ${rollbackData.removedChecksCount} historical checks during rollback`);

  // Check discovery after rollback
  const discAfterRes = await fetch(`${BASE_URL}/api/migration/ezee/discovery`, { headers: authHeaders });
  const discAfterData = await discAfterRes.json();
  assert(discAfterData.nextLiveCheckNumber === liveSeqBefore, `Live sequence remained completely unaffected at ${discAfterData.nextLiveCheckNumber}`);

  console.log('\n================================================================================');
  console.log(`TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
