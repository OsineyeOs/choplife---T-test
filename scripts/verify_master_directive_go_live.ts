import fs from 'fs';
import path from 'path';
import {
  buildDeterministicEqualShares,
  getNextLiveCheckNumber,
} from '../server/routes/posChecksAndOfflineRouter';
import { buildAccountingJournalEntries } from '../server/accounting/journalLedgerBuilder';
import { computeExecutiveDashboard, resolveLagosPeriodWindow, resolveLagosComparisonWindows } from '../server_bi';
import { parseTabularUploadContent } from '../server/routes/bulkImportAndMigrationRouter';

const DB_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function runVerification() {
  console.log('================================================================');
  console.log('CHOPLIFE REPUBLIC — MASTER DIRECTIVE GO-LIVE VERIFICATION SUITE');
  console.log('================================================================');

  const dbBackup = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf-8') : null;

  try {
    // ------------------------------------------------------------------
    // TEST 1: Deterministic Split-Bill Share Allocation & Uneven Rounding
    // ------------------------------------------------------------------
    console.log('\n[1/6] Testing Split-Bill Deterministic Share Math & Uneven Rounding...');
    const threeWayShares = buildDeterministicEqualShares(10000, 3, []);
    assert(threeWayShares.length === 3, '3-way split creates 3 distinct share objects');
    const sumThreeWay = threeWayShares.reduce((s, sh) => s + sh.allocatedAmount, 0);
    assert(sumThreeWay === 10000, `3-way split of ₦10,000 sums to exact ₦10,000 (got ₦${sumThreeWay})`);
    assert(
      threeWayShares[0].allocatedAmount === 3334 &&
        threeWayShares[1].allocatedAmount === 3333 &&
        threeWayShares[2].allocatedAmount === 3333,
      `3-way split allocates remainder deterministically: [₦${threeWayShares[0].allocatedAmount}, ₦${threeWayShares[1].allocatedAmount}, ₦${threeWayShares[2].allocatedAmount}]`
    );

    const twoWayShares = buildDeterministicEqualShares(13400, 2, []);
    assert(
      twoWayShares[0].allocatedAmount === 6700 && twoWayShares[1].allocatedAmount === 6700,
      '2-way split of ₦13,400 allocates ₦6,700 to Guest 1 and ₦6,700 to Guest 2'
    );

    // ------------------------------------------------------------------
    // TEST 2: Live HTTP Endpoints — Split-Bill Partial Settlement, Mixed Tender, Idempotency & Shift Guard
    // ------------------------------------------------------------------
    console.log('\n[2/6] Testing Live API Split-Bill Partial Payment, Mixed Tender & GL Parity...');
    const baseUrl = 'http://127.0.0.1:3000';

    // Login as super_admin and cashier
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@choplife.ng', password: process.env.DEFAULT_ADMIN_PASSWORD || 'ChopLife2025!' }),
    });
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;
    assert(Boolean(adminToken), 'Authenticated Super Admin session token acquired');

    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // Open a shift on GRA if none is open
    await fetch(`${baseUrl}/api/pos/shifts/open`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ branchId: 'gra', openingFloat: 20000, registerId: 'POS-REG-01' }),
    });
    const shiftRes = await fetch(`${baseUrl}/api/pos/shifts/current?branchId=gra`, { headers: adminHeaders });
    const currentShift = await shiftRes.json();
    assert(Boolean(currentShift?.id), `Active shift open on GRA (${currentShift?.shiftNumber})`);

    // Create a ₦13,400 check
    const createChkRes = await fetch(`${baseUrl}/api/pos/checks`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branchId: 'gra',
        checkType: 'dine_in',
        tableNumber: 'T-04',
        customerName: 'Split Bill Test Table',
        items: [
          {
            id: 'it-split-1',
            productId: 'prod-1',
            name: 'Executive Grill Platter',
            quantity: 2,
            unitPrice: 6700,
            totalPrice: 13400,
            unitCost: 0,
          },
        ],
      }),
    });
    const createdChkData = await createChkRes.json();
    const testCheck = createdChkData.check;
    assert(testCheck?.total === 13400, `Created POS Check #${testCheck.checkNumber} for ₦13,400`);

    // Configure 2-way equal split via POST /api/pos/checks/:id/split
    const splitCfgRes = await fetch(`${baseUrl}/api/pos/checks/${testCheck.id}/split`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ mode: 'equal', ways: 2 }),
    });
    const splitCfgData = await splitCfgRes.json();
    assert(
      splitCfgRes.ok && splitCfgData.check?.splitConfig?.shares?.length === 2,
      'Saved 2-way split configuration (Guest 1: ₦6,700, Guest 2: ₦6,700)'
    );

    // Pay Share 1 (₦6,700 via POS Terminal)
    const idempKey1 = `IDEMP-SHARE1-${Date.now()}`;
    const payShare1Res = await fetch(`${baseUrl}/api/pos/checks/${testCheck.id}/pay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        shareId: 'shr-1',
        amountToPay: 6700,
        paymentMethod: 'pos_terminal',
        paymentDetails: { posRrn: 'RRN-SPLIT-001' },
        shiftId: currentShift.id,
        idempotencyKey: idempKey1,
      }),
    });
    const payShare1Data = await payShare1Res.json();
    assert(
      payShare1Res.ok &&
        payShare1Data.isFullyPaid === false &&
        payShare1Data.check.status === 'partially_paid' &&
        payShare1Data.check.amountPaid === 6700 &&
        payShare1Data.check.remainingBalance === 6700,
      'Share 1 paid (₦6,700): Check transitioned to partially_paid with ₦6,700 remaining due'
    );

    // Test idempotent replay protection on Share 1
    const replayRes = await fetch(`${baseUrl}/api/pos/checks/${testCheck.id}/pay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        shareId: 'shr-1',
        amountToPay: 6700,
        paymentMethod: 'pos_terminal',
        idempotencyKey: idempKey1,
      }),
    });
    const replayData = await replayRes.json();
    assert(
      replayRes.ok && replayData.idempotentReplay === true && replayData.check.amountPaid === 6700,
      'Duplicate idempotencyKey replay prevented double payment on Share 1'
    );

    // Verify shift close is blocked while check is partially_paid
    const closeAttemptRes = await fetch(`${baseUrl}/api/pos/shifts/${currentShift.id}/close`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ countedCashInTill: 20000, notes: 'Attempt close with partial check' }),
    });
    assert(
      closeAttemptRes.status === 409,
      'Shift closure blocked with HTTP 409 while partially_paid check remains unsettled'
    );

    // Pay Share 2 (₦6,700 via Mixed Tender: ₦3,000 Cash + ₦3,700 Bank Transfer)
    const payShare2Res = await fetch(`${baseUrl}/api/pos/checks/${testCheck.id}/pay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        shareId: 'shr-2',
        amountToPay: 6700,
        paymentMethod: 'split',
        tenders: [
          { method: 'cash', amount: 3000, reference: 'CASH-LEG-2' },
          { method: 'bank_transfer', amount: 3700, reference: 'TRF-LEG-2' },
        ],
        shiftId: currentShift.id,
        idempotencyKey: `IDEMP-SHARE2-${Date.now()}`,
      }),
    });
    const payShare2Data = await payShare2Res.json();
    assert(
      payShare2Res.ok &&
        payShare2Data.isFullyPaid === true &&
        payShare2Data.check.status === 'paid' &&
        payShare2Data.check.amountPaid === 13400 &&
        payShare2Data.check.remainingBalance === 0 &&
        payShare2Data.check.payments.length === 3,
      'Share 2 paid via Mixed Tender (₦3,000 Cash + ₦3,700 Transfer): Check marked PAID in full with 3 payment records'
    );

    // Verify General Ledger recognition for the split check
    const glReport = buildAccountingJournalEntries(
      { checks: { [testCheck.id]: payShare2Data.check }, orders: {}, wastage: [], expenseClaims: {} },
      { branchId: 'gra', period: 'all', taxMode: 'exempt' }
    );
    assert(
      glReport.summary.isBalanced === true &&
        glReport.summary.totalDebits === 13400 &&
        glReport.summary.totalCredits === 13400,
      `General Ledger Trial Balance is balanced at exact ₦13,400 (single revenue recognition across 3 split tenders)`
    );

    // ------------------------------------------------------------------
    // TEST 3: Part 3 Role-Dependent Access Enforcement
    // ------------------------------------------------------------------
    console.log('\n[3/6] Testing Role-Based Access Restrictions (Part 3)...');
    // Create/login or test with a cashier session token
    const rawDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const cashierStaff = Object.values(rawDb.staff || {}).find((s: any) => s.role === 'cashier') as any;
    const branchMgrStaff = Object.values(rawDb.staff || {}).find((s: any) => s.role === 'branch_manager') as any;
    if (cashierStaff && branchMgrStaff) {
      const cashierToken = `test_cashier_token_${Date.now()}`;
      const mgrToken = `test_mgr_token_${Date.now()}`;
      rawDb.sessions = rawDb.sessions || {};
      rawDb.sessions[cashierToken] = {
        token: cashierToken,
        staffId: cashierStaff.id,
        role: 'cashier',
        branchId: cashierStaff.branchId || 'gra',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      rawDb.sessions[mgrToken] = {
        token: mgrToken,
        staffId: branchMgrStaff.id,
        role: 'branch_manager',
        branchId: branchMgrStaff.branchId || 'gra',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(rawDb, null, 2));
      await fetch(`${baseUrl}/api/admin/db/reload`, { method: 'POST', headers: adminHeaders });

      const cashierBiRes = await fetch(`${baseUrl}/api/reports/executive-dashboard`, {
        headers: { Authorization: `Bearer ${cashierToken}` },
      });
      assert(
        cashierBiRes.status === 403,
        `Cashier blocked from Executive BI Dashboard with HTTP ${cashierBiRes.status}`
      );

      const cashierGlRes = await fetch(`${baseUrl}/api/reports/accounting-journal`, {
        headers: { Authorization: `Bearer ${cashierToken}` },
      });
      assert(
        cashierGlRes.status === 403,
        `Cashier blocked from Accounting Journal Ledger with HTTP ${cashierGlRes.status}`
      );

      const mgrBiRes = await fetch(`${baseUrl}/api/reports/executive-dashboard?branchId=all`, {
        headers: { Authorization: `Bearer ${mgrToken}` },
      });
      const mgrBiData = await mgrBiRes.json();
      assert(
        mgrBiRes.ok && mgrBiData.branchId === (branchMgrStaff.branchId || 'gra'),
        `Branch Manager requesting branchId=all is automatically scoped to assigned branch (${mgrBiData.branchId})`
      );
    }

    // ------------------------------------------------------------------
    // TEST 4: Part 4 Executive BI 8-Period Windows & Comparisons (Africa/Lagos)
    // ------------------------------------------------------------------
    console.log('\n[4/6] Testing Executive BI 8-Period Selector & Comparison Windows (Africa/Lagos)...');
    const periodsToTest = ['hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'lifetime', 'custom'] as const;
    for (const p of periodsToTest) {
      const bounds = resolveLagosPeriodWindow(p as any, '2026-01-01', '2026-10-30');
      assert(bounds.endMs >= bounds.startMs && Boolean(bounds.label), `Period "${p}" resolved window: ${bounds.label}`);
    }

    const compModes = [
      'today_vs_yesterday',
      'today_vs_equiv_day_last_week',
      'this_month_vs_last_month',
      'this_month_vs_same_month_last_year',
      'this_year_vs_last_year',
      'this_year_vs_two_years_ago',
    ];
    for (const cm of compModes) {
      const cw = resolveLagosComparisonWindows(cm, true);
      assert(Boolean(cw && cw.current.endMs >= cw.current.startMs && cw.previous.endMs >= cw.previous.startMs), `Comparison mode "${cm}" resolved valid current & previous windows`);
    }

    const biRes = await fetch(
      `${baseUrl}/api/reports/executive-dashboard?branchId=all&period=monthly&comparisonMode=this_month_vs_last_month&likeForLike=true`,
      { headers: adminHeaders }
    );
    const biJson = await biRes.json();
    assert(
      biRes.ok &&
        biJson.timezone === 'Africa/Lagos' &&
        Boolean(biJson.comparison?.metrics?.netRevenue) &&
        Boolean(biJson.dataQualityNotice) &&
        Array.isArray(biJson.drillDownRecords),
      'Executive BI API returns Africa/Lagos timezone, comparison metrics, dataQualityNotice, and drillDownRecords'
    );

    // ------------------------------------------------------------------
    // TEST 5: Part 9 Excel Template Download & Validated Bulk Import
    // ------------------------------------------------------------------
    console.log('\n[5/6] Testing Excel (.XLS) Template Download & Validated Bulk Import...');
    const xlsRes = await fetch(`${baseUrl}/api/import/templates/inventory?format=xls`, { headers: adminHeaders });
    const xlsText = await xlsRes.text();
    assert(
      xlsRes.ok && xlsText.includes('<Workbook') && xlsText.includes('Data_Template') && xlsText.includes('Instructions_And_Rules'),
      'Inventory multi-sheet Excel SpreadsheetML (.xls) template downloaded and verified'
    );

    const parsedTemplateRows = parseTabularUploadContent(xlsText);
    assert(parsedTemplateRows.length === 2, `SpreadsheetML parser extracted ${parsedTemplateRows.length} sample rows from .xls template`);

    // Validate inventory batch (1 valid with blank SKU for auto-gen, 1 invalid with negative cost)
    const invValRes = await fetch(`${baseUrl}/api/import/inventory/validate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        rows: [
          {
            sku: '',
            name: 'Bulk Import Test Prawns',
            category: 'proteins',
            unit: 'kg',
            costPerUnit: 8500,
            reorderLevel: 10,
            openingBalance: 20,
            branchId: 'gra',
          },
          {
            sku: 'SKU-BAD-01',
            name: 'Invalid Negative Cost Item',
            category: 'proteins',
            unit: 'kg',
            costPerUnit: -500,
            reorderLevel: 5,
            openingBalance: 10,
            branchId: 'gra',
          },
        ],
      }),
    });
    const invValData = await invValRes.json();
    assert(
      invValRes.ok && invValData.validCount === 1 && invValData.invalidCount === 1 && invValData.warningCount === 1,
      `Inventory bulk validation accurately separated 1 valid row (auto-SKU ${invValData.validRows[0]?.sku}) and 1 invalid row`
    );

    const invCommitRes = await fetch(`${baseUrl}/api/import/inventory/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ importBatchId: invValData.importBatchId }),
    });
    const invCommitData = await invCommitRes.json();
    assert(invCommitRes.ok && invCommitData.committedCount === 1, 'Committed validated Inventory import batch');

    const invReplayRes = await fetch(`${baseUrl}/api/import/inventory/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ importBatchId: invValData.importBatchId }),
    });
    const invReplayData = await invReplayRes.json();
    assert(invReplayRes.ok && invReplayData.idempotentReplay === true, 'Inventory bulk commit is idempotent on replay');

    // ------------------------------------------------------------------
    // TEST 6: Part 10 eZee Optimus Historical Migration & Live Sequence Isolation
    // ------------------------------------------------------------------
    console.log('\n[6/6] Testing eZee Optimus Historical Migration & Live Check Counter Isolation...');
    const discBeforeRes = await fetch(`${baseUrl}/api/migration/ezee/discovery`, { headers: adminHeaders });
    const discBefore = await discBeforeRes.json();
    const liveSeqBefore = discBefore.nextLiveCheckNumber;

    const testLegacyRunId = Date.now().toString().slice(-6);
    const ezeeDryRunRes = await fetch(`${baseUrl}/api/migration/ezee/dry-run`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        checks: [
          {
            legacyRecordId: `EZ-TEST-${testLegacyRunId}-1`,
            outlet: 'eZee GRA Flagship',
            originalTimestamp: '2025-11-10T13:15:00.000Z',
            grossAmount: 15000,
            discountAmount: 1000,
            netAmount: 14000,
            paymentMethod: 'POS Card',
            customerName: 'Historical Guest A',
          },
          {
            legacyRecordId: `EZ-TEST-${testLegacyRunId}-2`,
            outlet: 'eZee Okabere',
            originalTimestamp: '2025-11-11T17:40:00.000Z',
            grossAmount: 8500,
            discountAmount: 0,
            netAmount: 8500,
            paymentMethod: 'Cash',
            customerName: 'Historical Guest B',
          },
          {
            legacyRecordId: `EZ-TEST-${testLegacyRunId}-1`, // Duplicate inside batch
            outlet: 'eZee GRA Flagship',
            originalTimestamp: '2025-11-10T13:15:00.000Z',
            grossAmount: 15000,
            discountAmount: 1000,
            netAmount: 14000,
            paymentMethod: 'POS Card',
          },
        ],
      }),
    });
    const ezeeDryRun = await ezeeDryRunRes.json();
    assert(
      ezeeDryRunRes.ok &&
        ezeeDryRun.recordCounts.targetReadyToCommit === 2 &&
        ezeeDryRun.recordCounts.duplicateSkipped === 1 &&
        ezeeDryRun.financialParity.targetNetSales === 22500 &&
        ezeeDryRun.liveCounterIsolationCheck.isStrictlyIsolated === true,
      `eZee Dry-Run validated 2 historical checks (₦22,500 net), skipped 1 duplicate, and preserved live check sequence (${liveSeqBefore})`
    );

    const ezeeCommitRes = await fetch(`${baseUrl}/api/migration/ezee/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ migrationBatchId: ezeeDryRun.migrationBatchId }),
    });
    const ezeeCommit = await ezeeCommitRes.json();
    assert(
      ezeeCommitRes.ok &&
        ezeeCommit.committedCount === 2 &&
        ezeeCommit.isLiveSequenceUntouched === true &&
        ezeeCommit.liveSequenceAfterCommit === liveSeqBefore,
      `Committed 2 eZee Optimus historical checks while live check sequence remained strictly untouched at ${ezeeCommit.liveSequenceAfterCommit}`
    );

    console.log('\n================================================================');
    console.log('ALL MASTER DIRECTIVE VERIFICATION ASSERTIONS PASSED (100%)');
    console.log('================================================================');
  } finally {
    if (dbBackup !== null) {
      fs.writeFileSync(DB_PATH, dbBackup, 'utf-8');
      console.log('[CLEANUP] Restored data/choplife_ops_db.json to pre-test state.');
    }
  }
}

runVerification().catch((err) => {
  console.error('\n[FATAL VERIFICATION FAILURE]:', err);
  process.exit(1);
});
