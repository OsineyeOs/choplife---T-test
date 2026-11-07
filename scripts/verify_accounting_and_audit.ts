import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  buildAccountingJournalEntries,
  exportQuickBooksJournalCsv,
  validateChartOfAccountsMapping,
  DEFAULT_CHART_OF_ACCOUNTS,
  roundMoney,
} from '../server_accounting';
import { BRANCHES as AUTHORITATIVE_BRANCHES } from '../src/data/branches';

const BASE_URL = 'http://localhost:3000';
const DB_FILE_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  token?: string,
  body?: any,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: any; text: string }> {
  const headers: Record<string, string> = { ...(extraHeaders || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  return { status: res.status, data, text };
}

async function main() {
  const initialDbSnapshot = fs.existsSync(DB_FILE_PATH)
    ? JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf-8'))
    : null;
  let superAdminToken: string | null = null;

  try {
  console.log('========================================================================');
  console.log('STAGE 2: DOUBLE-ENTRY ACCOUNTING & TAX ENGINE VERIFICATION (15 SCENARIOS)');
  console.log('========================================================================');

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Normal Cash Sale (VAT Inclusive 7.5%) + Scenario 7 (COGS)
  // ---------------------------------------------------------------------------
  const dbScenario1 = {
    checks: {
      'chk-101': {
        id: 'chk-101',
        checkNumber: 'CHK-GRA-0101',
        branchId: 'gra',
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paidAt: '2026-10-20T12:30:00.000Z',
        subtotal: 10750,
        discountAmount: 0,
        deliveryFee: 0,
        total: 10750,
        items: [
          {
            id: 'line-1',
            productId: 'prod-shawarma-1',
            name: 'Special Beef Shawarma',
            quantity: 2,
            unitPrice: 5375,
            totalPrice: 10750,
            unitCost: 2000, // Expected COGS = 2 * 2000 = 4000
          },
        ],
      },
    },
  };

  const rep1 = buildAccountingJournalEntries(dbScenario1, {
    branchId: 'gra',
    taxMode: 'vat_inclusive_7_5',
  });
  // Independent calculation:
  // Gross = 10,750 (inclusive of 7.5% VAT) -> Net Food Revenue = 10,750 / 1.075 = 10,000.00; Output VAT = 750.00
  // COGS = 2 * 2,000 = 4,000.00
  // Total Debits = 10,750 (Cash 1010) + 4,000 (COGS 5000) = 14,750.00
  // Total Credits = 10,000 (Rev 4000) + 750 (VAT 2200) + 4,000 (Inv 1300) = 14,750.00
  assert(rep1.summary.isBalanced, 'Scenario 1 must be balanced');
  assert(rep1.summary.netFoodAndBeverageRevenue === 10000, `Expected Net Rev 10000, got ${rep1.summary.netFoodAndBeverageRevenue}`);
  assert(rep1.summary.outputVatPayable === 750, `Expected Output VAT 750, got ${rep1.summary.outputVatPayable}`);
  assert(rep1.summary.totalCogsRecognized === 4000, `Expected COGS 4000, got ${rep1.summary.totalCogsRecognized}`);
  assert(rep1.summary.totalDebits === 14750 && rep1.summary.totalCredits === 14750, 'Scenario 1 total debits/credits must equal 14,750');
  console.log('[Scenario 1 & 7] Normal Cash Sale + BOM COGS Recognition: PASS ✅ (DR=₦14,750.00, CR=₦14,750.00, NetRev=₦10,000, VAT=₦750, COGS=₦4,000)');

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Multiple Payment Methods (POS Terminal, Transfer, Wallet, House Account, Split Tender)
  // ---------------------------------------------------------------------------
  const dbScenario2 = {
    checks: {
      'chk-split': {
        id: 'chk-split',
        checkNumber: 'CHK-OKA-0201',
        branchId: 'okabere',
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'split',
        splitPayments: [
          { method: 'cash', amount: 3000 },
          { method: 'pos_terminal', amount: 4500 },
          { method: 'bank_transfer', amount: 3250 },
        ],
        paidAt: '2026-10-20T14:00:00.000Z',
        subtotal: 10750,
        discountAmount: 0,
        deliveryFee: 0,
        total: 10750,
        items: [{ name: 'Platter', quantity: 1, unitPrice: 10750, totalPrice: 10750, unitCost: 3500 }],
      },
      'chk-wallet': {
        id: 'chk-wallet',
        checkNumber: 'CHK-OKA-0202',
        branchId: 'okabere',
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'wallet',
        paidAt: '2026-10-20T15:00:00.000Z',
        subtotal: 5375,
        discountAmount: 0,
        deliveryFee: 0,
        total: 5375,
        items: [{ name: 'Combo', quantity: 1, unitPrice: 5375, totalPrice: 5375, unitCost: 1500 }],
      },
      'chk-house': {
        id: 'chk-house',
        checkNumber: 'CHK-OKA-0203',
        branchId: 'okabere',
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'house_account',
        paidAt: '2026-10-20T16:00:00.000Z',
        subtotal: 21500,
        discountAmount: 0,
        deliveryFee: 0,
        total: 21500,
        items: [{ name: 'Executive Tray', quantity: 1, unitPrice: 21500, totalPrice: 21500, unitCost: 7000 }],
      },
    },
  };
  const rep2 = buildAccountingJournalEntries(dbScenario2, { branchId: 'okabere', taxMode: 'vat_inclusive_7_5' });
  const tb2 = Object.fromEntries(rep2.trialBalanceByAccount.map((r) => [r.accountCode, r.netBalance]));
  assert(tb2['1010'] === 3000, `Expected Cash 1010 = 3000, got ${tb2['1010']}`);
  assert(tb2['1020'] === 4500, `Expected POS 1020 = 4500, got ${tb2['1020']}`);
  assert(tb2['1030'] === 3250, `Expected Bank 1030 = 3250, got ${tb2['1030']}`);
  assert(tb2['2300'] === -5375, `Expected Wallet Liability 2300 debit reduction = -5375, got ${tb2['2300']}`);
  assert(tb2['1100'] === 21500, `Expected House Account AR 1100 = 21500, got ${tb2['1100']}`);
  assert(rep2.summary.isBalanced, 'Scenario 2 must be balanced');
  console.log('[Scenario 2] Multiple Tenders & Split Payments (Cash/POS/Transfer/Wallet/House AR): PASS ✅');

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Discounted Sale + Delivery Fee
  // ---------------------------------------------------------------------------
  const dbScenario3 = {
    checks: {
      'chk-disc': {
        id: 'chk-disc',
        checkNumber: 'CHK-GRA-0301',
        branchId: 'gra',
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'pos_terminal',
        paidAt: '2026-10-21T10:00:00.000Z',
        subtotal: 12000,
        discountAmount: 1250, // Discounted food = 10,750 -> Net Taxable = 10,000, VAT = 750
        deliveryFee: 1000,    // Total collected = 10,750 + 1,000 = 11,750
        total: 11750,
        items: [{ name: 'Grill Box', quantity: 1, unitPrice: 12000, totalPrice: 12000, unitCost: 4000 }],
      },
    },
  };
  const rep3 = buildAccountingJournalEntries(dbScenario3, { branchId: 'gra', taxMode: 'vat_inclusive_7_5' });
  // Independent check:
  // POS 1020 DR = 11,750; Discount 4090 DR = 1,250; Total Revenue+VAT+Delivery CR = (12,000 - 750) + 750 + 1,000 = 13,000
  // Wait: 11,750 + 1,250 = 13,000 DR; 11,250 (4000 Net Food Rev) + 750 (2200 VAT) + 1,000 (4050 Delivery) = 13,000 CR!
  assert(rep3.summary.isBalanced, 'Scenario 3 must be balanced');
  assert(rep3.summary.discountsGranted === 1250, `Expected discount 1250, got ${rep3.summary.discountsGranted}`);
  assert(rep3.summary.deliveryFeeRevenue === 1000, `Expected delivery fee 1000, got ${rep3.summary.deliveryFeeRevenue}`);
  assert(rep3.summary.outputVatPayable === 750, `Expected VAT 750 on discounted amount, got ${rep3.summary.outputVatPayable}`);
  console.log('[Scenario 3] Discounted Sale + Delivery Fee Contra-Revenue Accounting: PASS ✅');

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Refund / Void / Reversal of a Paid Sale
  // ---------------------------------------------------------------------------
  const dbScenario4 = {
    checks: {
      'chk-ref': {
        id: 'chk-ref',
        checkNumber: 'CHK-UGB-0401',
        branchId: 'ugbowo',
        status: 'voided',
        paymentStatus: 'refunded',
        paymentMethod: 'pos_terminal',
        paidAt: '2026-10-21T11:00:00.000Z',
        voidedAt: '2026-10-21T11:30:00.000Z',
        voidReason: 'Customer order cancelled and refunded',
        subtotal: 10750,
        discountAmount: 0,
        deliveryFee: 0,
        total: 10750,
        items: [{ name: 'Refunded Meal', quantity: 1, unitPrice: 10750, totalPrice: 10750, unitCost: 3000 }],
      },
    },
  };
  const rep4 = buildAccountingJournalEntries(dbScenario4, { branchId: 'ugbowo', taxMode: 'vat_inclusive_7_5' });
  assert(rep4.entries.length === 2, 'Refunded check must produce original entry + reversal entry');
  assert(rep4.summary.grossSalesCollected === 0, `Net sales after refund must be 0, got ${rep4.summary.grossSalesCollected}`);
  assert(rep4.summary.outputVatPayable === 0, `Net VAT after refund must be 0, got ${rep4.summary.outputVatPayable}`);
  assert(rep4.summary.totalCogsRecognized === 0, `Net COGS after refund must be 0, got ${rep4.summary.totalCogsRecognized}`);
  assert(rep4.summary.refundsReversed === 10750, `Refunds reversed must be 10750, got ${rep4.summary.refundsReversed}`);
  console.log('[Scenario 4] Refund / Void Reversal Entry & Net Zero Trial Balance Impact: PASS ✅');

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Taxable vs Non-Taxable Items & Configurable Tax Modes (Exempt / Inclusive / Exclusive)
  // ---------------------------------------------------------------------------
  const dbScenario5 = {
    checks: {
      'chk-mixed-tax': {
        id: 'chk-mixed-tax',
        checkNumber: 'CHK-GRA-0501',
        branchId: 'gra',
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paidAt: '2026-10-21T12:00:00.000Z',
        subtotal: 15750,
        discountAmount: 0,
        deliveryFee: 0,
        total: 15750,
        items: [
          { name: 'Taxable Feast', quantity: 1, unitPrice: 10750, totalPrice: 10750, unitCost: 3000, taxable: true },
          { name: 'VAT-Exempt Basic Water/Staple', quantity: 1, unitPrice: 5000, totalPrice: 5000, unitCost: 1000, taxable: false },
        ],
      },
    },
  };
  const rep5Inclusive = buildAccountingJournalEntries(dbScenario5, { branchId: 'gra', taxMode: 'vat_inclusive_7_5' });
  // Only the 10,750 item is taxable -> VAT = 750, Net Revenue = 15,000
  assert(rep5Inclusive.summary.outputVatPayable === 750, `Mixed taxable inclusive VAT must be 750, got ${rep5Inclusive.summary.outputVatPayable}`);
  assert(rep5Inclusive.summary.netFoodAndBeverageRevenue === 15000, `Mixed net food revenue must be 15000, got ${rep5Inclusive.summary.netFoodAndBeverageRevenue}`);

  const rep5Exempt = buildAccountingJournalEntries(dbScenario5, { branchId: 'gra', taxMode: 'exempt' });
  assert(rep5Exempt.summary.outputVatPayable === 0, `Exempt taxMode VAT must be 0, got ${rep5Exempt.summary.outputVatPayable}`);
  assert(rep5Exempt.summary.netFoodAndBeverageRevenue === 15750, `Exempt net food revenue must be 15750`);

  const rep5Exclusive = buildAccountingJournalEntries(dbScenario5, { branchId: 'gra', taxMode: 'vat_exclusive_7_5' });
  // 7.5% of 10,750 taxable item = 806.25
  assert(rep5Exclusive.summary.outputVatPayable === 806.25, `Exclusive VAT must be 806.25, got ${rep5Exclusive.summary.outputVatPayable}`);
  console.log('[Scenario 5] Taxable vs Non-Taxable Items & Configurable Tax Modes (Exempt / Inclusive / Exclusive): PASS ✅');

  // ---------------------------------------------------------------------------
  // SCENARIO 6 & 8: Stock Purchase (GRN), Wastage Write-Off & Operating Expenses
  // ---------------------------------------------------------------------------
  const dbScenario6And8 = {
    goodsReceiptNotes: {
      'grn-001': {
        id: 'grn-001',
        grnNumber: 'GRN-2026-0001',
        supplierName: 'Edo Premium Farms Ltd',
        supplierInvoiceNumber: 'INV-EDO-901',
        receivingLocation: 'general_store',
        status: 'verified',
        receivedAt: '2026-10-21T09:00:00.000Z',
        actualAcceptedValue: 85000,
      },
    },
    wastage: [
      {
        id: 'wst-001',
        branchId: 'gra',
        itemName: 'Fresh Tomatoes',
        quantity: 4,
        unit: 'kg',
        reason: 'Cold room spoilage',
        estimatedCostLost: 6500,
        timestamp: '2026-10-21T17:00:00.000Z',
      },
    ],
    cashMovements: [
      {
        id: 'cmv-001',
        branchId: 'gra',
        type: 'paid_out',
        amount: 15000,
        reason: 'Generator diesel top-up 15 litres',
        staffName: 'Blessing O.',
        timestamp: '2026-10-21T18:00:00.000Z',
      },
      {
        id: 'cmv-002',
        branchId: 'gra',
        type: 'safe_drop',
        amount: 50000,
        reason: 'Mid-shift vault drop',
        staffName: 'Blessing O.',
        timestamp: '2026-10-21T19:00:00.000Z',
      },
    ],
  };

  const rep6And8 = buildAccountingJournalEntries(dbScenario6And8, { branchId: 'all' });
  assert(rep6And8.summary.isBalanced, 'Scenario 6 & 8 must be balanced');
  assert(rep6And8.summary.grnInventoryAdditions === 85000, `GRN additions must be 85000, got ${rep6And8.summary.grnInventoryAdditions}`);
  assert(rep6And8.summary.wastageWriteOffs === 6500, `Wastage write-off must be 6500, got ${rep6And8.summary.wastageWriteOffs}`);
  assert(rep6And8.summary.operatingExpensesPaidOut === 15000, `Operating expense paid out must be 15000, got ${rep6And8.summary.operatingExpensesPaidOut}`);
  const tb68 = Object.fromEntries(rep6And8.trialBalanceByAccount.map((r) => [r.accountCode, r.netBalance]));
  assert(tb68['1300'] === 85000 - 6500, `Net Inventory Asset change must be +78,500, got ${tb68['1300']}`);
  assert(tb68['2000'] === 85000, `Accounts Payable 2000 must be 85,000, got ${tb68['2000']}`);
  assert(tb68['6100'] === 15000, `Generator Diesel Expense 6100 must be 15,000, got ${tb68['6100']}`);
  assert(tb68['1015'] === 50000, `Vault Safe 1015 must be 50,000, got ${tb68['1015']}`);
  console.log('[Scenario 6 & 8] Stock Purchase (GRN), Wastage Write-Off, Diesel Expense & Vault Drop: PASS ✅');

  // ---------------------------------------------------------------------------
  // SCENARIO 9 & 10: Multi-Branch Isolation & Date-Range Boundary Filtering
  // ---------------------------------------------------------------------------
  const dbScenario9And10 = {
    checks: {
      'chk-gra-oct10': {
        id: 'chk-gra-oct10',
        checkNumber: 'CHK-GRA-OCT10',
        branchId: 'gra',
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paidAt: '2026-10-10T10:00:00.000Z',
        subtotal: 5000,
        discountAmount: 0,
        deliveryFee: 0,
        total: 5000,
        items: [{ name: 'Item A', quantity: 1, unitPrice: 5000, totalPrice: 5000, unitCost: 1500 }],
      },
      'chk-oka-oct15': {
        id: 'chk-oka-oct15',
        checkNumber: 'CHK-OKA-OCT15',
        branchId: 'okabere',
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paidAt: '2026-10-15T23:59:59.000Z',
        subtotal: 8000,
        discountAmount: 0,
        deliveryFee: 0,
        total: 8000,
        items: [{ name: 'Item B', quantity: 1, unitPrice: 8000, totalPrice: 8000, unitCost: 2400 }],
      },
      'chk-ugb-oct20': {
        id: 'chk-ugb-oct20',
        checkNumber: 'CHK-UGB-OCT20',
        branchId: 'ugbowo',
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paidAt: '2026-10-20T00:00:00.000Z',
        subtotal: 12000,
        discountAmount: 0,
        deliveryFee: 0,
        total: 12000,
        items: [{ name: 'Item C', quantity: 1, unitPrice: 12000, totalPrice: 12000, unitCost: 3600 }],
      },
    },
  };

  const repBranchOka = buildAccountingJournalEntries(dbScenario9And10, { branchId: 'okabere', taxMode: 'exempt' });
  assert(repBranchOka.entries.length === 1 && repBranchOka.summary.grossSalesCollected === 8000, 'Branch filter okabere failed');

  const repDateWindow = buildAccountingJournalEntries(dbScenario9And10, {
    branchId: 'all',
    startDate: '2026-10-15',
    endDate: '2026-10-20',
    taxMode: 'exempt',
  });
  assert(
    repDateWindow.entries.length === 2 && repDateWindow.summary.grossSalesCollected === 20000,
    `Date boundary filter [2026-10-15..2026-10-20] expected 20000, got ${repDateWindow.summary.grossSalesCollected}`
  );
  console.log('[Scenario 9 & 10] Multi-Branch Isolation & Inclusive Date-Range Boundaries: PASS ✅');

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Odd Kobo Rounding Reconciliation Without 9999 Plug
  // ---------------------------------------------------------------------------
  const dbScenario11 = {
    checks: {
      'chk-odd': {
        id: 'chk-odd',
        checkNumber: 'CHK-ODD-3333',
        branchId: 'gra',
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paidAt: '2026-10-22T12:00:00.000Z',
        subtotal: 3333,
        discountAmount: 111,
        deliveryFee: 777,
        total: 3999,
        items: [{ name: 'Odd Price Item', quantity: 3, unitPrice: 1111, totalPrice: 3333, unitCost: 333.33 }],
      },
    },
  };
  const rep11 = buildAccountingJournalEntries(dbScenario11, { branchId: 'gra', taxMode: 'vat_inclusive_7_5' });
  assert(rep11.summary.isBalanced && rep11.summary.variance === 0, 'Odd rounding scenario must have 0.00 variance');
  const csv11 = exportQuickBooksJournalCsv(rep11);
  assert(!csv11.includes('9999'), 'CSV must never include 9999 plug account');
  console.log('[Scenario 11] Odd Naira/Kobo Rounding Reconciliation (Zero Plug Rows): PASS ✅');

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Missing or Invalid Account Mapping Rejection
  // ---------------------------------------------------------------------------
  const brokenChart = { ...DEFAULT_CHART_OF_ACCOUNTS };
  delete (brokenChart as any)['2200'];
  let caughtMissingAcct = false;
  try {
    buildAccountingJournalEntries(dbScenario1, { chartOfAccounts: brokenChart });
  } catch (err: any) {
    caughtMissingAcct = err.message.includes('2200');
  }
  assert(caughtMissingAcct, 'Missing account mapping 2200 must throw an error');

  const plugChart = {
    ...DEFAULT_CHART_OF_ACCOUNTS,
    '9999': { code: '9999', name: 'Plug Account', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const },
  };
  const plugVal = validateChartOfAccountsMapping(plugChart);
  assert(!plugVal.valid, 'Chart of Accounts containing 9999 plug account must be rejected');
  console.log('[Scenario 12] Missing Account Mapping & Forbidden 9999 Plug Rejection: PASS ✅');

  // ---------------------------------------------------------------------------
  // SCENARIO 13: Empty Export Handling
  // ---------------------------------------------------------------------------
  const repEmpty = buildAccountingJournalEntries({ checks: {}, orders: {} }, { branchId: 'gra' });
  const csvEmpty = exportQuickBooksJournalCsv(repEmpty);
  assert(repEmpty.entries.length === 0 && repEmpty.summary.totalDebits === 0 && repEmpty.summary.isBalanced, 'Empty export must be balanced at 0');
  assert(csvEmpty.split('\n').length === 1, 'Empty export CSV must contain header row only');
  console.log('[Scenario 13] Empty Period Export (Header-Only CSV, Zero Fabricated Rows): PASS ✅');

  // ---------------------------------------------------------------------------
  // SCENARIO 14: Duplicate Export / Posting Protection
  // ---------------------------------------------------------------------------
  const dupDb: any = JSON.parse(JSON.stringify(dbScenario1));
  buildAccountingJournalEntries(dupDb, {
    branchId: 'gra',
    taxMode: 'vat_inclusive_7_5',
    preventDuplicateExport: true,
    exportedBy: 'Auditor Nosa',
  });
  let caughtDuplicate = false;
  try {
    buildAccountingJournalEntries(dupDb, {
      branchId: 'gra',
      taxMode: 'vat_inclusive_7_5',
      preventDuplicateExport: true,
      exportedBy: 'Auditor Nosa',
    });
  } catch (err: any) {
    caughtDuplicate = err.message.includes('DUPLICATE_EXPORT_BLOCKED');
  }
  assert(caughtDuplicate, 'Duplicate export without allowReExport=true must be blocked');

  const reExportRep = buildAccountingJournalEntries(dupDb, {
    branchId: 'gra',
    taxMode: 'vat_inclusive_7_5',
    preventDuplicateExport: true,
    allowReExport: true,
    exportedBy: 'Auditor Nosa',
  });
  assert(reExportRep.summary.isBalanced, 'Explicit allowReExport=true must succeed');
  console.log('[Scenario 14] Duplicate Export Batch Digest Protection & Explicit Re-Export Override: PASS ✅');

  // ---------------------------------------------------------------------------
  // SCENARIO 15: Normalized Wastage (totalLossValue + locationId) & Customer Wallet Top-Up Liability
  // ---------------------------------------------------------------------------
  const dbScenario15 = {
    wastage: [
      {
        id: 'wst-norm-01',
        referenceNo: 'WA-000099',
        locationId: 'gra',
        itemName: 'Shawarma Pita Bread',
        quantity: 2,
        unit: 'packs',
        unitCost: 2200,
        totalLossValue: 4400, // API-recorded field name
        reason: 'damaged_in_storage',
        timestamp: '2026-10-22T15:00:00.000Z',
      },
    ],
    walletTransactions: [
      {
        id: 'wtx-topup-01',
        customerId: 'cust-001',
        customerName: 'Osaze Igbinedion',
        type: 'credit',
        amount: 20000,
        paymentMethod: 'bank_transfer',
        branchId: 'gra',
        timestamp: '2026-10-22T16:00:00.000Z',
      },
    ],
  };
  const rep15 = buildAccountingJournalEntries(dbScenario15, { branchId: 'gra' });
  assert(rep15.summary.isBalanced, 'Scenario 15 must be balanced');
  assert(rep15.summary.wastageWriteOffs === 4400, `Expected normalized wastage 4400, got ${rep15.summary.wastageWriteOffs}`);
  const tb15 = Object.fromEntries(rep15.trialBalanceByAccount.map((r) => [r.accountCode, r.netBalance]));
  assert(tb15['2300'] === 20000, `Expected Customer Wallet Liability 2300 = 20000, got ${tb15['2300']}`);
  assert(tb15['1030'] === 20000, `Expected Corporate Bank 1030 = 20000, got ${tb15['1030']}`);
  console.log('[Scenario 15] Normalized Wastage (totalLossValue/locationId) & Wallet Top-Up Liability (2300): PASS ✅');

  // ===========================================================================
  // STAGE 3: CANONICAL BRANCH & LOCATION IDENTITY RECONCILIATION AUDIT
  // ===========================================================================
  console.log('\n========================================================================');
  console.log('STAGE 3: CANONICAL BRANCH & LOCATION IDENTITY RECONCILIATION');
  console.log('========================================================================');

  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  for (const b of AUTHORITATIVE_BRANCHES) {
    assert(indexHtml.includes(b.address), `index.html JSON-LD missing canonical address for ${b.id}: ${b.address}`);
    assert(indexHtml.includes(b.phone), `index.html JSON-LD missing canonical phone for ${b.id}: ${b.phone}`);
  }
  assert(!indexHtml.includes('Opposite Redeemed Church'), 'index.html must not contain legacy Okabere address');
  assert(!indexHtml.includes('17 Osasogie Street'), 'index.html must not contain legacy Ugbowo address');

  const branchesRes = await apiRequest('/api/branches', 'GET');
  assert(branchesRes.status === 200 && Array.isArray(branchesRes.data), 'GET /api/branches must return 200 array');
  assert(
    branchesRes.data.length === AUTHORITATIVE_BRANCHES.length,
    `Expected exactly ${AUTHORITATIVE_BRANCHES.length} canonical branches in DB (no test-branch-* leftovers), got ${branchesRes.data.length}`
  );
  for (const expectedBranch of AUTHORITATIVE_BRANCHES) {
    const liveBranch = branchesRes.data.find((b: any) => b.id === expectedBranch.id);
    assert(Boolean(liveBranch), `Live /api/branches missing branch ${expectedBranch.id}`);
    assert(liveBranch.address === expectedBranch.address, `Branch ${expectedBranch.id} address mismatch: ${liveBranch.address}`);
    assert(liveBranch.phone === expectedBranch.phone, `Branch ${expectedBranch.id} phone mismatch: ${liveBranch.phone}`);
  }
  console.log('[Stage 3] Exactly 3 Canonical Benin City Branches (GRA, Okabere, Ugbowo) Verified Across HTML, DB & API: PASS ✅');

  // ===========================================================================
  // STAGE 4: LIVE API ACCOUNTING JOURNAL & RBAC SECURITY VERIFICATION
  // ===========================================================================
  console.log('\n========================================================================');
  console.log('STAGE 4: LIVE API ACCOUNTING LEDGER & RBAC SECURITY VERIFICATION');
  console.log('========================================================================');

  const loginRes = await apiRequest('/api/auth/staff/login', 'POST', undefined, {
    emailOrStaffId: 'oluwaseun.osineye@gmail.com',
    password: 'ChopLife2025!',
  });
  assert(loginRes.status === 200 && loginRes.data.token, 'Superadmin login failed');
  const token = loginRes.data.token;
  superAdminToken = token;

  const liveJournalRes = await apiRequest('/api/reports/accounting-journal?branchId=all&period=all&taxMode=vat_inclusive_7_5', 'GET', token);
  assert(liveJournalRes.status === 200 && liveJournalRes.data.success, `GET /api/reports/accounting-journal failed: ${liveJournalRes.text}`);
  const liveSummary = liveJournalRes.data.report.summary;
  assert(liveSummary.isBalanced && liveSummary.variance === 0, 'Live operational database journal must be balanced with 0 variance');
  assert(
    roundMoney(liveSummary.totalDebits) === roundMoney(liveSummary.totalCredits),
    `Live totalDebits (${liveSummary.totalDebits}) !== totalCredits (${liveSummary.totalCredits})`
  );
  console.log(
    `[Live Journal API] Transactions=${liveSummary.transactionCount}, Lines=${liveSummary.lineCount}, TotalDebits=₦${liveSummary.totalDebits.toLocaleString()}, TotalCredits=₦${liveSummary.totalCredits.toLocaleString()}, Variance=₦${liveSummary.variance}: PASS ✅`
  );

  const unauthJournal = await apiRequest('/api/reports/accounting-journal', 'GET');
  assert(unauthJournal.status === 401, `Expected 401 for unauthenticated accounting journal request, got ${unauthJournal.status}`);
  console.log('[Security Gate] Unauthenticated /api/reports/accounting-journal rejected with HTTP 401: PASS ✅');

  // ===========================================================================
  // STAGE 5: PAYMENT-PROVIDER VERIFICATION & WEBHOOK SECURITY GATES
  // ===========================================================================
  console.log('\n========================================================================');
  console.log('STAGE 5: PAYMENT-PROVIDER VERIFICATION & WEBHOOK SECURITY GATES');
  console.log('========================================================================');

  // 5.1 Provider configuration endpoint
  const payCfgRes = await apiRequest('/api/payments/config', 'GET');
  assert(
    payCfgRes.status === 200 && payCfgRes.data.currency === 'NGN' && payCfgRes.data.webhookSignatureEnforced === true,
    'GET /api/payments/config must return 200 with NGN and webhookSignatureEnforced=true'
  );
  console.log(`[5.1] Payment Gateway Config Mode='${payCfgRes.data.mode}' (LiveSecretConfigured=${payCfgRes.data.hasLiveSecretKey}, WebhookSigEnforced=${payCfgRes.data.webhookSignatureEnforced}): PASS ✅`);

  // 5.2 Create an online order attempting to spoof paymentStatus: 'paid' from client
  const spoofOrderRes = await apiRequest('/api/orders', 'POST', undefined, {
    orderNumber: 'CL-PAY-TEST-001',
    branchId: 'gra',
    customerName: 'Payment Security Tester',
    customerPhone: '08031112222',
    deliveryType: 'pickup',
    paymentMethod: 'online',
    paymentStatus: 'paid', // Client spoof attempt!
    subtotal: 5000,
    deliveryFee: 0,
    discount: 0,
    total: 5000,
    items: [{ productId: 'prod-shawarma-1', name: 'Special Beef Shawarma', quantity: 1, price: 5000 }],
  });
  assert(spoofOrderRes.status === 201 && spoofOrderRes.data.order, 'Order creation failed');
  const testOrderId = spoofOrderRes.data.order.id;
  assert(
    spoofOrderRes.data.order.paymentStatus === 'pending',
    `Server must force initial paymentStatus to 'pending' despite client sending 'paid', got '${spoofOrderRes.data.order.paymentStatus}'`
  );
  console.log('[5.2] Client-Side paymentStatus="paid" Spoofing Prevented on POST /api/orders: PASS ✅');

  // 5.3 Payment Initiation & Idempotency
  const initPay1 = await apiRequest('/api/payments/initiate', 'POST', undefined, {
    orderId: testOrderId,
    paymentMethod: 'card',
    idempotencyKey: 'idem-pay-001',
    customerEmail: 'customer@choplife.ng',
  });
  const initPay2 = await apiRequest('/api/payments/initiate', 'POST', undefined, {
    orderId: testOrderId,
    paymentMethod: 'card',
    idempotencyKey: 'idem-pay-001',
    customerEmail: 'customer@choplife.ng',
  });
  assert(initPay1.status === 201 && initPay1.data.transaction?.reference, `Payment initiation failed: ${initPay1.text}`);
  assert(
    initPay2.status === 200 && initPay2.data.idempotentReplay === true && initPay2.data.transaction.reference === initPay1.data.transaction.reference,
    'Payment initiation idempotency failed'
  );
  assert(initPay1.data.transaction.amountKobo === 500000, `Expected 500,000 kobo, got ${initPay1.data.transaction.amountKobo}`);
  console.log(`[5.3] Payment Initiation & Idempotency Verified (${initPay1.data.transaction.reference}, 500,000 kobo): PASS ✅`);

  // 5.4 Unverified client reference must NOT mark order as paid
  const unverifiedCheck = await apiRequest('/api/payments/verify-checkout', 'POST', undefined, {
    orderId: testOrderId,
    reference: 'RANDOM_CLIENT_REF_999',
  });
  assert(
    unverifiedCheck.status === 403,
    `Unverified client reference must be rejected with HTTP 403, got ${unverifiedCheck.status} (${JSON.stringify(unverifiedCheck.data)})`
  );
  console.log('[5.4] Unverified Client Reference Rejected from Marking Order Paid (HTTP 403 Forbidden): PASS ✅');

  // 5.5 Sandbox Failed, Expired, Underpaid, Success, Cross-Order Reuse (409), and Reversed States
  const failVerify = await apiRequest('/api/payments/verify-checkout', 'POST', undefined, {
    orderId: testOrderId,
    reference: 'SANDBOX_FAILED_001',
  });
  assert(failVerify.status === 400 && failVerify.data.paymentStatus === 'failed', `Expected 400 failed, got ${failVerify.status}`);

  const expVerify = await apiRequest('/api/payments/verify-checkout', 'POST', undefined, {
    orderId: testOrderId,
    reference: 'SANDBOX_EXPIRED_001',
  });
  assert(expVerify.status === 400 && expVerify.data.paymentStatus === 'expired', `Expected 400 expired, got ${expVerify.status}`);

  const underpaidVerify = await apiRequest('/api/payments/verify-checkout', 'POST', undefined, {
    orderId: testOrderId,
    reference: 'SANDBOX_UNDERPAID_001',
  });
  assert(underpaidVerify.status === 400 && underpaidVerify.data.paymentStatus === 'failed', `Expected 400 on kobo underpayment, got ${underpaidVerify.status}`);

  const successRef = 'SANDBOX_SUCCESS_001';
  const okVerify = await apiRequest('/api/payments/verify-checkout', 'POST', undefined, {
    orderId: testOrderId,
    reference: successRef,
  });
  assert(okVerify.status === 200 && okVerify.data.success === true && okVerify.data.order?.paymentStatus === 'paid', 'Sandbox success verification failed');

  // Idempotent repeat of same reference on same order
  const repeatVerify = await apiRequest('/api/payments/verify-checkout', 'POST', undefined, {
    orderId: testOrderId,
    reference: successRef,
  });
  assert(repeatVerify.status === 200 && repeatVerify.data.alreadyVerified === true, 'Idempotent verify-checkout failed');

  // Cross-order reference reuse must be blocked with HTTP 409
  const secondOrderRes = await apiRequest('/api/orders', 'POST', undefined, {
    orderNumber: 'CL-PAY-TEST-002',
    branchId: 'gra',
    customerName: 'Second Order Tester',
    customerPhone: '08031113333',
    deliveryType: 'pickup',
    paymentMethod: 'online',
    subtotal: 5000,
    deliveryFee: 0,
    discount: 0,
    total: 5000,
    items: [{ productId: 'prod-shawarma-1', name: 'Special Beef Shawarma', quantity: 1, price: 5000 }],
  });
  const secondOrderId = secondOrderRes.data.order.id;
  const crossReuseRes = await apiRequest('/api/payments/verify-checkout', 'POST', undefined, {
    orderId: secondOrderId,
    reference: successRef,
  });
  assert(crossReuseRes.status === 409, `Cross-order reference reuse must return 409, got ${crossReuseRes.status}`);

  // Reversal / refund transition
  const revVerify = await apiRequest('/api/payments/verify-checkout', 'POST', undefined, {
    orderId: testOrderId,
    reference: 'SANDBOX_REVERSED_001',
  });
  assert(revVerify.status === 200 && revVerify.data.paymentStatus === 'refunded', `Expected refunded status, got ${revVerify.data.paymentStatus}`);
  console.log('[5.5] Payment States (Failed 400, Expired 400, Underpaid 400, Paid 200, Cross-Order Reuse 409, Refunded): PASS ✅');

  // 5.6 Webhook HMAC-SHA512 Signature Verification & Replay Protection
  const webhookPayload = {
    event: 'charge.success',
    data: {
      id: 987654321,
      reference: 'WH_SIGNED_REF_2026',
      amount: 500000,
      currency: 'NGN',
      channel: 'card',
      metadata: { orderId: secondOrderId },
    },
  };
  const unsignedWh = await apiRequest('/api/payments/webhook/paystack', 'POST', undefined, webhookPayload);
  assert(unsignedWh.status === 401, `Unsigned Paystack webhook must be rejected with 401, got ${unsignedWh.status}`);

  const forgedWh = await apiRequest('/api/payments/webhook/paystack', 'POST', undefined, webhookPayload, {
    'x-paystack-signature': 'deadbeef0000111122223333444455556666777788889999aaaabbbbccccdddd',
  });
  assert(forgedWh.status === 401, `Forged Paystack webhook must be rejected with 401, got ${forgedWh.status}`);

  const whSecret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_WEBHOOK_SECRET || 'choplife_sandbox_paystack_secret_2026';
  const validSig = crypto.createHmac('sha512', whSecret).update(JSON.stringify(webhookPayload)).digest('hex');
  const signedWh = await apiRequest('/api/payments/webhook/paystack', 'POST', undefined, webhookPayload, {
    'x-paystack-signature': validSig,
  });
  assert(signedWh.status === 200 && signedWh.data.received === true && signedWh.data.status === 'paid', `Valid signed webhook failed: ${signedWh.text}`);

  const replayWh = await apiRequest('/api/payments/webhook/paystack', 'POST', undefined, webhookPayload, {
    'x-paystack-signature': validSig,
  });
  assert(replayWh.status === 200 && replayWh.data.status === 'already_processed', 'Replayed webhook must be flagged with status: already_processed');
  console.log('[5.6] Paystack Webhook HMAC-SHA512 Verification (401 on Unsigned/Forged, 200 + Replay Guard on Valid): PASS ✅');

  // ===========================================================================
  // STAGE 6: INVENTORY CONSERVATION & RBAC SECURITY GATES
  // ===========================================================================
  console.log('\n========================================================================');
  console.log('STAGE 6: INVENTORY CONSERVATION & RBAC SECURITY GATES');
  console.log('========================================================================');

  // 6.1 Login as Rider & Cashier to test RBAC restrictions
  const riderLogin = await apiRequest('/api/auth/staff/login', 'POST', undefined, {
    emailOrStaffId: 'rider.oscar@choplife.ng',
    password: 'ChopLife2025!',
  });
  const cashierLogin = await apiRequest('/api/auth/staff/login', 'POST', undefined, {
    emailOrStaffId: 'cashier.gra@choplife.ng',
    password: 'ChopLife2025!',
  });
  assert(riderLogin.status === 200 && cashierLogin.status === 200, 'Role test logins failed');

  const riderAuditRes = await apiRequest('/api/audit/logs', 'GET', riderLogin.data.token);
  const cashierPoRes = await apiRequest('/api/inventory/purchasing/orders', 'POST', cashierLogin.data.token, {
    supplierId: 'sup-01',
    items: [],
  });
  const riderHouseCreateRes = await apiRequest('/api/house-accounts', 'POST', riderLogin.data.token, {
    companyName: 'Unauthorized Corp',
    contactPerson: 'Test',
    phone: '08000000000',
    creditLimit: 100000,
  });
  assert(riderAuditRes.status === 403, `Rider must get 403 on /api/audit/logs, got ${riderAuditRes.status}`);
  assert(cashierPoRes.status === 403, `Cashier must get 403 on PO creation, got ${cashierPoRes.status}`);
  assert(riderHouseCreateRes.status === 403, `Rider must get 403 on house account creation, got ${riderHouseCreateRes.status}`);
  console.log('[6.1] RBAC Role Guards on Audit Logs, PO Creation & House Accounts (HTTP 403): PASS ✅');

  const invListRes = await apiRequest('/api/inventory/items', 'GET', token);
  const targetInvItem = Array.isArray(invListRes.data) ? invListRes.data[0] : null;
  assert(Boolean(targetInvItem?.id), 'Failed to load canonical inventory item for Stage 6');

  // 6.2 Inventory Conservation: Reject sourceLocation === destinationLocation
  const sameLocReq = await apiRequest('/api/inventory/requests', 'POST', token, {
    sourceLocation: 'gra',
    destinationLocation: 'gra',
    items: [{ itemId: targetInvItem.id, requestedQty: 5 }],
  });
  assert(sameLocReq.status === 400, `Same-location transfer indent must be rejected with 400, got ${sameLocReq.status}`);

  // 6.3 Inventory Conservation: Reject dispatching more stock than available on hand
  const validIndentRes = await apiRequest('/api/inventory/requests', 'POST', token, {
    sourceLocation: 'general_store',
    destinationLocation: 'gra',
    items: [{ itemId: targetInvItem.id, requestedQty: 5 }],
  });
  assert(validIndentRes.status === 201 && validIndentRes.data?.request?.id, `Valid indent creation failed: ${validIndentRes.text}`);
  const indentId = validIndentRes.data.request.id;
  await apiRequest(`/api/inventory/requests/${indentId}/review`, 'PUT', token, { status: 'approved' });

  const excessiveDispatchRes = await apiRequest(`/api/inventory/requests/${indentId}/dispatch`, 'POST', token, {
    issuedItems: [{ itemId: targetInvItem.id, issuedQty: 999999 }],
  });
  assert(
    excessiveDispatchRes.status === 400 && excessiveDispatchRes.data.error?.includes('Insufficient stock'),
    `Dispatching 999,999 units must fail with 400 Insufficient stock, got ${excessiveDispatchRes.status}`
  );

  // Ensure general_store has sufficient stock on hand for dispatch testing
  const adjustRes = await apiRequest(`/api/inventory/items/${targetInvItem.id}/stock`, 'PUT', token, {
    branchId: 'general_store',
    newStock: 100,
    reason: 'TEST_INIT',
  });
  assert(adjustRes.status === 200, `Stock adjustment failed with ${adjustRes.status}: ${adjustRes.text}`);

  // Dispatch valid 5 units, then attempt over-receipt of 10 units
  const validDispatchRes = await apiRequest(`/api/inventory/requests/${indentId}/dispatch`, 'POST', token, {
    issuedItems: [{ itemId: targetInvItem.id, issuedQty: 5 }],
  });
  assert(validDispatchRes.status === 200, `Valid dispatch of 5 units failed: ${validDispatchRes.status} - ${validDispatchRes.text}`);

  const overReceiveRes = await apiRequest(`/api/inventory/requests/${indentId}/receive`, 'POST', token, {
    receivedItems: [{ itemId: targetInvItem.id, receivedQty: 10 }],
  });
  assert(overReceiveRes.status === 400, `Over-receiving 10 units when 5 were issued must return 400, got ${overReceiveRes.status}`);

  // 6.4 Duplicate GRN rejection (HTTP 409)
  const firstGrnRes = await apiRequest('/api/inventory/purchasing/grn', 'POST', token, {
    purchaseOrderId: 'po-001',
    supplierInvoiceNumber: 'INV-EDO-88219',
    receivingLocation: 'general_store',
    lines: [{ itemId: targetInvItem.id, itemName: targetInvItem.name, acceptedQty: 5, unitPrice: targetInvItem.costPerUnit || 4200 }],
  });
  assert(firstGrnRes.status === 201 || firstGrnRes.status === 409, `First GRN submission unexpected status: ${firstGrnRes.status}`);

  const dupGrnRes = await apiRequest('/api/inventory/purchasing/grn', 'POST', token, {
    purchaseOrderId: 'po-001',
    supplierInvoiceNumber: 'INV-EDO-88219',
    receivingLocation: 'general_store',
    lines: [{ itemId: targetInvItem.id, itemName: targetInvItem.name, acceptedQty: 5, unitPrice: targetInvItem.costPerUnit || 4200 }],
  });
  assert(dupGrnRes.status === 409, `Duplicate GRN for same PO + supplier invoice must be rejected with 409, got ${dupGrnRes.status}`);
  console.log('[6.2–6.4] Atomic Inventory Conservation (Same-Location 400, Insufficient Stock 400, Over-Receipt 400, Duplicate GRN 409): PASS ✅');

  // ===========================================================================
  // STAGE 7: DATA HYGIENE, WALLET PIN BCRYPT, LOYALTY BOUNDARIES, PRIVACY & SESSION REVOCATION
  // ===========================================================================
  console.log('\n========================================================================');
  console.log('STAGE 7: DATA HYGIENE, WALLET PIN BCRYPT, LOYALTY BOUNDARIES & PRIVACY');
  console.log('========================================================================');

  // 7.1 Repository Data Hygiene & .gitignore Verification
  const gitignoreText = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf-8');
  assert(
    gitignoreText.includes('data/choplife_ops_db.json') &&
      gitignoreText.includes('data/backups/') &&
      gitignoreText.includes('data/quarantine_archive*.json'),
    '.gitignore must exclude runtime DB, backups, and quarantine archives'
  );
  assert(!fs.existsSync(path.join(process.cwd(), 'data', 'quarantine_archive_2026.json')), 'quarantine_archive_2026.json must not exist in repository');
  assert(!fs.existsSync(path.join(process.cwd(), 'data', 'backups')), 'data/backups directory must not exist in repository');

  const rawDbJsonText = fs.readFileSync(path.join(process.cwd(), 'data', 'choplife_ops_db.json'), 'utf-8');
  assert(!rawDbJsonText.includes('"walletPin"'), 'Active DB file must never contain plaintext walletPin fields');
  console.log('[7.1] Repository Data Hygiene & .gitignore Protection: PASS ✅');

  // 7.2 Loyalty 1-Point-per-₦1,000 Boundary Unit Assertions
  const { calculateLoyaltyPoints } = await import('../server_db.ts');
  assert(calculateLoyaltyPoints(0) === 0, '₦0 spend must earn 0 points');
  assert(calculateLoyaltyPoints(999) === 0, '₦999 spend must earn 0 points');
  assert(calculateLoyaltyPoints(1000) === 1, '₦1,000 spend must earn 1 point');
  assert(calculateLoyaltyPoints(1001) === 1, '₦1,001 spend must earn 1 point');
  assert(calculateLoyaltyPoints(1999) === 1, '₦1,999 spend must earn 1 point');
  assert(calculateLoyaltyPoints(2000) === 2, '₦2,000 spend must earn 2 points');
  // Discount deduction test: subtotal 2000 - discount 500 = 1500 -> 1 point
  assert(
    calculateLoyaltyPoints({ subtotal: 2000, discount: 500, deliveryFee: 0, total: 1500 }) === 1,
    'Discounted spend (₦2,000 - ₦500 = ₦1,500) must earn 1 point, not 2'
  );
  // Delivery fee exclusion test: subtotal 1500 + deliveryFee 1000 = 2500 -> 1 point
  assert(
    calculateLoyaltyPoints({ subtotal: 1500, discount: 0, deliveryFee: 1000, total: 2500 }) === 1,
    'Delivery fee must be excluded from loyalty point accrual (₦1,500 subtotal + ₦1,000 delivery = 1 pt)'
  );
  console.log('[7.2] Loyalty 1-Point-per-₦1,000 Boundary Matrix (₦0, ₦999, ₦1,000, ₦1,001, ₦1,999, ₦2,000, Discounts, Delivery Fee): PASS ✅');

  // 7.3 Customer Registration, Wallet PIN Bcrypt Hashing, Wallet Spend, Duplicate Guard, Refund Reversal & Redemption Replay Guard
  const custPhone = `0806${Math.floor(1000000 + Math.random() * 8999999)}`;
  const regCustRes = await apiRequest('/api/customers', 'POST', token, {
    name: 'Loyalty Audit Customer',
    phone: custPhone,
    email: 'loyalty.audit@choplife.ng',
    walletPin: '4321',
  });
  assert(regCustRes.status === 200 && regCustRes.data.customer?.id, 'Customer registration failed');
  const custObj = regCustRes.data.customer;
  assert(custObj.walletPin === undefined && custObj.walletPinHash === undefined, 'API response must never expose plaintext walletPin or walletPinHash');
  assert(custObj.hasWalletPin === true, 'API response must include hasWalletPin: true');
  assert(custObj.loyaltyPoints === 50, 'New customer receives 50 welcome points');

  // Verify PIN endpoint
  const badPinCheck = await apiRequest(`/api/customers/${custObj.id}/verify-pin`, 'POST', token, { pin: '0000' });
  const goodPinCheck = await apiRequest(`/api/customers/${custObj.id}/verify-pin`, 'POST', token, { pin: '4321' });
  assert(badPinCheck.data.verified === false && goodPinCheck.data.verified === true, 'Bcrypt wallet PIN verification failed');

  // Top up wallet with ₦10,000
  const topUpRes = await apiRequest(`/api/customers/${custObj.id}/topup`, 'POST', token, {
    amount: 10000,
    paymentMethod: 'pos_terminal',
  });
  assert(topUpRes.status === 200 && topUpRes.data.customer.walletBalance === 10000, 'Wallet top-up failed');

  // Charge wallet ₦2,500 (subtotal ₦1,999 + deliveryFee ₦501 -> should earn 1 point, NOT 25 points!)
  const walletChargeRes = await apiRequest(`/api/customers/${custObj.id}/charge-wallet`, 'POST', token, {
    amount: 2500,
    subtotal: 1999,
    deliveryFee: 501,
    discount: 0,
    orderId: 'ord-loyalty-wallet-001',
    orderNumber: 'CL-LOY-001',
    pin: '4321',
  });
  assert(walletChargeRes.status === 200 && walletChargeRes.data.earnedPoints === 1, `Expected 1 point earned on ₦1,999 qualifying spend, got ${walletChargeRes.data.earnedPoints}`);
  assert(walletChargeRes.data.customer.loyaltyPoints === 51, `Expected 51 points total, got ${walletChargeRes.data.customer.loyaltyPoints}`);

  // Duplicate payment event for same orderId must be rejected with 409
  const dupWalletCharge = await apiRequest(`/api/customers/${custObj.id}/charge-wallet`, 'POST', token, {
    amount: 2500,
    subtotal: 1999,
    deliveryFee: 501,
    orderId: 'ord-loyalty-wallet-001',
    pin: '4321',
  });
  assert(dupWalletCharge.status === 409, `Duplicate wallet charge for same orderId must return 409, got ${dupWalletCharge.status}`);

  // Refund the wallet charge -> reverses the 1 earned point and restores ₦2,500 balance
  const walletRefundRes = await apiRequest(`/api/customers/${custObj.id}/wallet/refund`, 'POST', token, {
    orderId: 'ord-loyalty-wallet-001',
    reason: 'Audit refund test',
  });
  assert(
    walletRefundRes.status === 200 &&
      walletRefundRes.data.reversedPoints === 1 &&
      walletRefundRes.data.customer.loyaltyPoints === 50 &&
      walletRefundRes.data.customer.walletBalance === 10000,
    'Wallet refund failed to reverse earned loyalty points and restore balance'
  );

  // Loyalty point redemption with idempotencyKey & replay protection
  const redeemRes1 = await apiRequest(`/api/customers/${custObj.id}/redeem-points`, 'POST', token, {
    pointsToRedeem: 20,
    idempotencyKey: 'redeem-key-001',
  });
  assert(redeemRes1.status === 200 && redeemRes1.data.customer.loyaltyPoints === 30 && redeemRes1.data.creditValue === 200, 'Loyalty point redemption failed');

  const redeemReplay = await apiRequest(`/api/customers/${custObj.id}/redeem-points`, 'POST', token, {
    pointsToRedeem: 20,
    idempotencyKey: 'redeem-key-001',
  });
  assert(redeemReplay.status === 409, `Repeated redemption with same idempotencyKey must return 409, got ${redeemReplay.status}`);

  const redeemOverBal = await apiRequest(`/api/customers/${custObj.id}/redeem-points`, 'POST', token, {
    pointsToRedeem: 40,
  });
  assert(redeemOverBal.status === 400, `Redeeming 40 pts when 30 pts remain must return 400, got ${redeemOverBal.status}`);
  console.log('[7.3] Wallet PIN Bcrypt, Spend Accrual (1 pt/₦1k), Duplicate Charge 409, Refund Reversal & Redemption Replay 409: PASS ✅');

  // 7.4 Order Privacy & Idempotent Order Lookup Protection
  const unauthOrdersList = await apiRequest('/api/orders', 'GET');
  assert(unauthOrdersList.status === 401, `Unauthenticated GET /api/orders must return 401, got ${unauthOrdersList.status}`);

  const unauthOrderById = await apiRequest(`/api/orders/${testOrderId}`, 'GET');
  assert(unauthOrderById.status === 401, `Unauthenticated GET /api/orders/:id without phone/pickupCode must return 401, got ${unauthOrderById.status}`);

  const hijackIdemOrder = await apiRequest('/api/orders', 'POST', undefined, {
    id: testOrderId,
    branchId: 'gra',
    customerPhone: '08099990000', // Wrong phone
    items: [{ productId: 'prod-1', name: 'Test', quantity: 1, price: 1000 }],
  });
  assert(hijackIdemOrder.status === 409 && !hijackIdemOrder.data.order, `Idempotent POST /api/orders with mismatched phone must return 409 without order PII, got ${hijackIdemOrder.status}`);

  const verifiedPublicOrder = await apiRequest(`/api/orders/${testOrderId}?phone=08031112222`, 'GET');
  assert(
    verifiedPublicOrder.status === 200 &&
      verifiedPublicOrder.data.deliveryDetails?.deliveryAddress === undefined,
    'Public phone-verified GET /api/orders/:id must mask full deliveryAddress'
  );
  console.log('[7.4] Order Privacy, Unauthenticated Enumeration Block (401) & Idempotent Lookup Guard (409): PASS ✅');

  // 7.5 Staff Suspension Login Block & Immediate Session Revocation
  const tempStaffRes = await apiRequest('/api/staff/accounts', 'POST', token, {
    staffId: `STF-SEC-${Date.now().toString().slice(-4)}`,
    name: 'Session Revocation Tester',
    workEmail: `revoke.${Date.now()}@choplife.ng`,
    phone: '08055554444',
    role: 'cashier',
    branchId: 'gra',
    initialPassword: 'TempPassword2026!',
  });
  assert(tempStaffRes.status === 201 && tempStaffRes.data.staff?.id, 'Temp staff creation failed');
  const tempStaffId = tempStaffRes.data.staff.id;
  const tempStaffEmail = tempStaffRes.data.staff.workEmail;

  const tempLogin1 = await apiRequest('/api/auth/staff/login', 'POST', undefined, {
    emailOrStaffId: tempStaffEmail,
    password: 'TempPassword2026!',
  });
  assert(tempLogin1.status === 200 && tempLogin1.data.token, 'Temp staff login failed');
  const tempToken = tempLogin1.data.token;

  // Suspend staff member -> must strip passwordHash from response and immediately invalidate tempToken
  const suspendRes = await apiRequest(`/api/staff/accounts/${tempStaffId}`, 'PUT', token, {
    status: 'suspended',
  });
  assert(suspendRes.status === 200 && suspendRes.data.staff?.passwordHash === undefined, 'PUT /api/staff/accounts/:id must not expose passwordHash');

  const meAfterSuspend = await apiRequest('/api/auth/staff/me', 'GET', tempToken);
  assert(meAfterSuspend.status === 401 || meAfterSuspend.status === 403, `Suspended staff session must be immediately invalidated, got ${meAfterSuspend.status}`);

  const loginWhileSuspended = await apiRequest('/api/auth/staff/login', 'POST', undefined, {
    emailOrStaffId: tempStaffEmail,
    password: 'TempPassword2026!',
  });
  assert(loginWhileSuspended.status === 403, `Suspended staff login attempt must return 403, got ${loginWhileSuspended.status}`);
  console.log('[7.5] Staff Suspension Login Block (403), Session Invalidation & PasswordHash Sanitization: PASS ✅');

  // 7.6 Recipe BOM Unit Conversion & COGS Valuation Check (g -> kg via recipeUnitFactor)
  await apiRequest('/api/inventory/items/inv-protein-chicken/stock', 'PUT', token, {
    branchId: 'gra',
    newStock: 50,
    reason: 'BOM_TEST_INIT',
  });
  const itemsBeforeRes = await apiRequest('/api/inventory/items', 'GET', token);
  const chickenBefore = itemsBeforeRes.data.find((i: any) => i.id === 'inv-protein-chicken')?.locationStock?.gra?.stockOnHand ?? 0;
  const bomOrderRes = await apiRequest('/api/orders', 'POST', undefined, {
    branchId: 'gra',
    customerName: 'BOM Unit Conversion Tester',
    customerPhone: '08037778888',
    orderType: 'takeaway',
    paymentMethod: 'cash_on_delivery',
    items: [
      {
        productId: 'prod-rc-jollof-combo',
        name: 'Party Jollof Rice Combo with Quarter Chicken',
        quantity: 1,
        price: 5500,
      },
    ],
  });
  assert(bomOrderRes.status === 201 && bomOrderRes.data.order?.orderNumber, 'BOM test order creation failed');
  const bomOrderNum = bomOrderRes.data.order.orderNumber;
  const itemsAfterRes = await apiRequest('/api/inventory/items', 'GET', token);
  const chickenAfter = itemsAfterRes.data.find((i: any) => i.id === 'inv-protein-chicken')?.locationStock?.gra?.stockOnHand ?? 0;
  const chickenDelta = Number((chickenBefore - chickenAfter).toFixed(4));
  assert(chickenDelta === 0.22, `Expected 0.22 kg chicken deducted for 220g recipe portion, got ${chickenDelta} kg`);
  const ledgerAfterRes = await apiRequest('/api/inventory/ledger', 'GET', token);
  const chickenDepletionEntry = ledgerAfterRes.data.find((e: any) => e.referenceNo === bomOrderNum && e.itemId === 'inv-protein-chicken');
  assert(
    chickenDepletionEntry && chickenDepletionEntry.quantityDelta === -0.22 && chickenDepletionEntry.totalValue === 924,
    `Expected chicken POS_DEPLETION quantityDelta=-0.22 kg & totalValue=₦924, got ${JSON.stringify(chickenDepletionEntry)}`
  );
  console.log('[7.6] Recipe BOM Unit Conversion (220g -> 0.22kg Chicken, COGS=₦924) Verified: PASS ✅');

  console.log('\nALL 15 ACCOUNTING SCENARIOS, BRANCH IDENTITIES, PAYSTACK GATES, INVENTORY CONSERVATION & STAGE 7 SECURITY/LOYALTY CHECKS PASSED! 🎉');
  } finally {
    if (initialDbSnapshot && superAdminToken) {
      await apiRequest('/api/admin/db/reload', 'POST', superAdminToken, { snapshot: initialDbSnapshot }).catch(() => {});
    }
  }
}


main().catch((err) => {
  console.error('ACCOUNTING & AUDIT VERIFICATION FAILED:', err);
  process.exit(1);
});
