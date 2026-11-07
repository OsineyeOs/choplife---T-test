export const MENU_FOOD_COST_MAP: Record<string, { cost: number; category: string }> = {
  'Special Grilled Catfish': { cost: 3100, category: 'Grills & Fish' },
  'Asun Jollof Rice': { cost: 1900, category: 'Rice & Mains' },
  'Nigerian Meat Pie': { cost: 620, category: 'Bakery & Pastries' },
  'Fresh Sardine Bread Loaf': { cost: 950, category: 'Bakery & Bread' },
  'Gourmet Beef Burger': { cost: 2200, category: 'Fast Casual' },
  'Smoked Chicken Shawarma': { cost: 1600, category: 'Street Food' },
  'Signature Suya Platter': { cost: 5200, category: 'Barbecue & Suya' },
  'VIP Executive Platter': { cost: 9800, category: 'Platters' },
  'Seafood Fisherman Soup': { cost: 4800, category: 'Traditional Soups' },
  'Signature Zobo Drink': { cost: 400, category: 'Beverages' },
  'Chilled Heineken': { cost: 850, category: 'Beverages' },
  'French Fries': { cost: 1150, category: 'Sides' },
  'Moin Moin Elemi Meje': { cost: 650, category: 'Sides' },
  'Peppered Turkey Wings': { cost: 2100, category: 'Grills & Poultry' },
  'Student Jollof Combo': { cost: 1450, category: 'Combos' },
};

export type TaxTreatmentMode = 'exempt' | 'vat_inclusive_7_5' | 'vat_exclusive_7_5';

export interface ChartOfAccountEntry {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'CONTRA_REVENUE' | 'COGS' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
}

export const DEFAULT_CHART_OF_ACCOUNTS: Record<string, ChartOfAccountEntry> = {
  '1010': { code: '1010', name: 'Cash on Hand / Register Drawer', type: 'ASSET', normalBalance: 'DEBIT' },
  '1015': { code: '1015', name: 'Vault Safe / Cash in Transit', type: 'ASSET', normalBalance: 'DEBIT' },
  '1020': { code: '1020', name: 'POS Card Terminal Clearing (Paystack / Moniepoint)', type: 'ASSET', normalBalance: 'DEBIT' },
  '1030': { code: '1030', name: 'Corporate Bank Account — Verified Transfers', type: 'ASSET', normalBalance: 'DEBIT' },
  '1100': { code: '1100', name: 'Accounts Receivable — Corporate House Accounts', type: 'ASSET', normalBalance: 'DEBIT' },
  '1150': { code: '1150', name: 'Employee Operational Cash Advances Receivable', type: 'ASSET', normalBalance: 'DEBIT' },
  '1250': { code: '1250', name: 'Prepaid Operating Expenses & Service Contracts', type: 'ASSET', normalBalance: 'DEBIT' },
  '1300': { code: '1300', name: 'Food, Beverage & Packaging Inventory Asset', type: 'ASSET', normalBalance: 'DEBIT' },
  '1350': { code: '1350', name: 'Recoverable Input VAT Asset (7.5%)', type: 'ASSET', normalBalance: 'DEBIT' },
  '1500': { code: '1500', name: 'Property, Plant & Kitchen Equipment (Fixed Assets)', type: 'ASSET', normalBalance: 'DEBIT' },
  '2000': { code: '2000', name: 'Accounts Payable — Trade Suppliers (GRN)', type: 'LIABILITY', normalBalance: 'CREDIT' },
  '2100': { code: '2100', name: 'Staff Expense Reimbursement Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
  '2200': { code: '2200', name: 'FIRS Output VAT Payable (7.5%)', type: 'LIABILITY', normalBalance: 'CREDIT' },
  '2250': { code: '2250', name: 'Statutory Levies & Regulatory Payables', type: 'LIABILITY', normalBalance: 'CREDIT' },
  '2300': { code: '2300', name: 'Customer Wallet Deferred Revenue Liability', type: 'LIABILITY', normalBalance: 'CREDIT' },
  '4000': { code: '4000', name: 'Food & Beverage Sales Revenue (Net)', type: 'REVENUE', normalBalance: 'CREDIT' },
  '4050': { code: '4050', name: 'Delivery & Logistics Fee Revenue', type: 'REVENUE', normalBalance: 'CREDIT' },
  '4090': { code: '4090', name: 'Sales Discounts & Promotional Allowances', type: 'CONTRA_REVENUE', normalBalance: 'DEBIT' },
  '5000': { code: '5000', name: 'Cost of Goods Sold — Direct Food & Packaging (BOM)', type: 'COGS', normalBalance: 'DEBIT' },
  '5010': { code: '5010', name: 'Direct Kitchen Ingredients & Emergency Market Purchases', type: 'COGS', normalBalance: 'DEBIT' },
  '5200': { code: '5200', name: 'Takeaway Packaging, Foil & Disposables Cost', type: 'COGS', normalBalance: 'DEBIT' },
  '6100': { code: '6100', name: 'Power, Diesel, Cooking Gas & Generator Utility Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  '6200': { code: '6200', name: 'Kitchen Consumables & Sanitation Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  '6300': { code: '6300', name: 'Inventory Wastage & Spoilage Write-Off Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  '6400': { code: '6400', name: 'Branch Operating & Petty Cash Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  '6500': { code: '6500', name: 'Logistics, Dispatch Fuel & Delivery Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  '6600': { code: '6600', name: 'Kitchen Equipment & Facility Repairs Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  '6700': { code: '6700', name: 'Administrative, Stationery, Printing & Staff Welfare Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  '6800': { code: '6800', name: 'Permits, Licences & Local Regulatory Charges', type: 'EXPENSE', normalBalance: 'DEBIT' },
};

export interface JournalLine {
  journalNo: string;
  journalDate: string;
  timestamp: string;
  sourceType:
    | 'POS_SALE'
    | 'ONLINE_SALE'
    | 'SALE_REFUND'
    | 'GRN_PURCHASE'
    | 'WASTAGE_WRITEOFF'
    | 'OPERATING_EXPENSE'
    | 'SAFE_DROP'
    | 'WALLET_TOPUP'
    | 'HOUSE_ACCOUNT_REMITTANCE'
    | 'EXPENSE_CLAIM_RECOGNITION'
    | 'EXPENSE_CLAIM_PAYMENT'
    | 'EXPENSE_COMPANY_DIRECT'
    | 'CASH_ADVANCE_DISBURSEMENT'
    | 'CASH_ADVANCE_RETIREMENT'
    | 'EXPENSE_CLAIM_REVERSAL';
  sourceId: string;
  sourceRef: string;
  branchId: string;
  branchName: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string;
  taxCode: string;
}

export interface JournalEntryDocument {
  journalNo: string;
  journalDate: string;
  timestamp: string;
  sourceType: JournalLine['sourceType'];
  sourceId: string;
  sourceRef: string;
  branchId: string;
  branchName: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface AccountingLedgerReport {
  branchId: string;
  branchName: string;
  period: string;
  startDate?: string;
  endDate?: string;
  taxMode: TaxTreatmentMode;
  vatRatePct: number;
  accountantTaxPolicyStatus: 'CONFIRMED' | 'PENDING_ACCOUNTANT_CONFIRMATION';
  generatedAt: string;
  entries: JournalEntryDocument[];
  lines: JournalLine[];
  trialBalanceByAccount: {
    accountCode: string;
    accountName: string;
    type: ChartOfAccountEntry['type'];
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
  }[];
  summary: {
    transactionCount: number;
    lineCount: number;
    totalDebits: number;
    totalCredits: number;
    variance: number;
    isBalanced: boolean;
    grossSalesCollected: number;
    discountsGranted: number;
    netFoodAndBeverageRevenue: number;
    deliveryFeeRevenue: number;
    outputVatPayable: number;
    refundsReversed: number;
    totalCogsRecognized: number;
    grnInventoryAdditions: number;
    wastageWriteOffs: number;
    operatingExpensesPaidOut: number;
  };
  exportDigest: string;
}

export interface AccountingBuildOptions {
  branchId?: string;
  period?: 'today' | '7days' | '30days' | 'all' | 'custom';
  startDate?: string; // ISO or YYYY-MM-DD
  endDate?: string;   // ISO or YYYY-MM-DD
  taxMode?: TaxTreatmentMode;
  chartOfAccounts?: Record<string, ChartOfAccountEntry>;
  preventDuplicateExport?: boolean;
  allowReExport?: boolean;
  exportedBy?: string;
}

const CANONICAL_BRANCH_NAMES: Record<string, string> = {
  gra: 'Choplife Republic — GRA Branch (8a Okogo St)',
  okabere: 'Choplife Republic — Okabere Branch (2 Okabere St)',
  ugbowo: 'Choplife Republic — Ugbowo Branch (Petom Station, Isihor)',
  general_store: 'Choplife Republic — Central Commissary (General Store)',
  all: 'All Choplife Republic Branches (Consolidated)',
};

export function roundMoney(amount: number): number {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

export function resolveBranchLabel(branchId?: string): string {
  const norm = (branchId || 'gra').toLowerCase().trim();
  return CANONICAL_BRANCH_NAMES[norm] || `Choplife Branch (${norm})`;
}

export function validateChartOfAccountsMapping(
  chart: Record<string, ChartOfAccountEntry> = DEFAULT_CHART_OF_ACCOUNTS
): { valid: boolean; errors: string[] } {
  const requiredCodes = [
    '1010', '1015', '1020', '1030', '1100', '1300',
    '2000', '2200', '2300', '4000', '4050', '4090',
    '5000', '6100', '6200', '6300', '6400',
  ];
  const errors: string[] = [];

  for (const code of requiredCodes) {
    const entry = chart[code];
    if (!entry) {
      errors.push(`Missing required Chart of Accounts code: ${code}`);
      continue;
    }
    if (!entry.code || entry.code !== code) {
      errors.push(`Invalid code property on Chart of Accounts entry ${code}`);
    }
    if (!entry.name || !entry.name.trim()) {
      errors.push(`Missing account name for Chart of Accounts code: ${code}`);
    }
    if (code === '9999') {
      errors.push('Forbidden plug/suspense account 9999 detected in Chart of Accounts.');
    }
  }

  if (chart['9999']) {
    errors.push('Forbidden plug/suspense account 9999 is not permitted in production accounting exports.');
  }

  return { valid: errors.length === 0, errors };
}

export function resolveDateBounds(
  period: string = 'all',
  startDate?: string,
  endDate?: string
): { startMs: number; endMs: number } {
  const now = new Date();
  if (startDate || endDate) {
    const s = startDate
      ? new Date(startDate.length === 10 ? `${startDate}T00:00:00.000Z` : startDate).getTime()
      : 0;
    const e = endDate
      ? new Date(endDate.length === 10 ? `${endDate}T23:59:59.999Z` : endDate).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (Number.isNaN(s) || Number.isNaN(e)) {
      throw new Error(`Invalid date range boundary: startDate=${startDate}, endDate=${endDate}`);
    }
    if (s > e) {
      throw new Error(`Invalid date range: startDate (${startDate}) is after endDate (${endDate})`);
    }
    return { startMs: s, endMs: e };
  }

  if (period === 'today') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return { startMs: startOfToday, endMs: Number.MAX_SAFE_INTEGER };
  }
  if (period === '7days') {
    return { startMs: now.getTime() - 7 * 24 * 60 * 60 * 1000, endMs: Number.MAX_SAFE_INTEGER };
  }
  if (period === '30days') {
    return { startMs: now.getTime() - 30 * 24 * 60 * 60 * 1000, endMs: Number.MAX_SAFE_INTEGER };
  }
  return { startMs: 0, endMs: Number.MAX_SAFE_INTEGER };
}

export function mapTenderToAccountCode(method?: string): string {
  const norm = (method || 'cash').toLowerCase().trim();
  if (norm === 'cash') return '1010';
  if (norm === 'pos_terminal' || norm === 'card' || norm === 'paystack' || norm === 'pos') return '1020';
  if (norm === 'bank_transfer' || norm === 'transfer') return '1030';
  if (norm === 'wallet') return '2300';
  if (norm === 'house_account' || norm === 'corporate') return '1100';
  throw new Error(`Unmapped payment tender method: "${method}"`);
}

export function estimateCheckCogs(items: any[]): number {
  let totalCost = 0;
  for (const item of items || []) {
    const qty = Number(item.quantity ?? 1);
    if (qty <= 0) continue;
    if (typeof item.unitCost === 'number' && item.unitCost >= 0) {
      totalCost += roundMoney(item.unitCost * qty);
    } else {
      const pid = item.productId || item.id || '';
      const mappedCost = (MENU_FOOD_COST_MAP as any)[pid];
      if (typeof mappedCost === 'number') {
        totalCost += roundMoney(mappedCost * qty);
      } else if (mappedCost && typeof mappedCost.cost === 'number') {
        totalCost += roundMoney(mappedCost.cost * qty);
      } else {
        const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
        totalCost += roundMoney(unitPrice * 0.35 * qty);
      }
    }
  }
  return roundMoney(totalCost);
}

/**
 * Computes the exact net revenue and output VAT breakdown for a sale check/order
 * based on the configured taxMode and item-level taxability flags.
 */
export function computeSaleTaxSplit(params: {
  items: any[];
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalCollected: number;
  explicitVatAmount?: number;
  taxMode: TaxTreatmentMode;
}): {
  grossFoodSubtotal: number;
  discountAmount: number;
  netFoodRevenue: number;
  deliveryFeeRevenue: number;
  outputVatAmount: number;
  effectiveTotal: number;
} {
  const grossFoodSubtotal = roundMoney(Number(params.subtotal || 0));
  const discountAmount = roundMoney(Math.max(0, Number(params.discountAmount || 0)));
  const deliveryFeeRevenue = roundMoney(Math.max(0, Number(params.deliveryFee || 0)));
  const discountedFoodAmount = roundMoney(Math.max(0, grossFoodSubtotal - discountAmount));

  let taxableGross = 0;
  let nonTaxableGross = 0;
  if (Array.isArray(params.items) && params.items.length > 0) {
    for (const it of params.items) {
      const qty = Number(it.quantity ?? 1);
      const lineTotal = roundMoney(Number(it.totalPrice ?? (Number(it.unitPrice ?? it.price ?? 0) * qty)));
      if (it.taxable === false || it.vatExempt === true) {
        nonTaxableGross = roundMoney(nonTaxableGross + lineTotal);
      } else {
        taxableGross = roundMoney(taxableGross + lineTotal);
      }
    }
  } else {
    taxableGross = grossFoodSubtotal;
  }

  const totalItemGross = roundMoney(taxableGross + nonTaxableGross);
  const taxableShare = totalItemGross > 0 ? taxableGross / totalItemGross : 1;
  const taxableAfterDiscount = roundMoney(discountedFoodAmount * taxableShare);

  if (params.taxMode === 'exempt') {
    const effectiveTotal = roundMoney(discountedFoodAmount + deliveryFeeRevenue);
    return {
      grossFoodSubtotal,
      discountAmount,
      netFoodRevenue: grossFoodSubtotal,
      deliveryFeeRevenue,
      outputVatAmount: 0,
      effectiveTotal,
    };
  }

  if (params.taxMode === 'vat_exclusive_7_5') {
    const outputVatAmount =
      typeof params.explicitVatAmount === 'number' && params.explicitVatAmount >= 0
        ? roundMoney(params.explicitVatAmount)
        : roundMoney(taxableAfterDiscount * 0.075);
    const effectiveTotal = roundMoney(discountedFoodAmount + deliveryFeeRevenue + outputVatAmount);
    return {
      grossFoodSubtotal,
      discountAmount,
      netFoodRevenue: grossFoodSubtotal,
      deliveryFeeRevenue,
      outputVatAmount,
      effectiveTotal,
    };
  }

  const netTaxableFood = roundMoney(taxableAfterDiscount / 1.075);
  const outputVatAmount = roundMoney(taxableAfterDiscount - netTaxableFood);
  const netFoodRevenue = roundMoney(grossFoodSubtotal - outputVatAmount);
  const effectiveTotal = roundMoney(discountedFoodAmount + deliveryFeeRevenue);

  return {
    grossFoodSubtotal,
    discountAmount,
    netFoodRevenue,
    deliveryFeeRevenue,
    outputVatAmount,
    effectiveTotal,
  };
}

function escapeCsvCell(val: string | number): string {
  let s = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Generates a strict QuickBooks Online / IFRS Transaction-Level Double-Entry Journal CSV.
 * Contains ONLY genuine balanced journal lines (zero 9999 plug/control rows).
 */
export function exportQuickBooksJournalCsv(report: AccountingLedgerReport): string {
  const headerColumns = [
    'JournalNo',
    'JournalDate',
    'SourceType',
    'SourceRef',
    'BranchId',
    'LocationClass',
    'AccountCode',
    'AccountName',
    'DebitNGN',
    'CreditNGN',
    'TaxCode',
    'Memo',
    'BatchDigest',
  ];

  const rows: string[] = [headerColumns.join(',')];

  for (const line of report.lines) {
    rows.push(
      [
        escapeCsvCell(line.journalNo),
        escapeCsvCell(line.journalDate),
        escapeCsvCell(line.sourceType),
        escapeCsvCell(line.sourceRef),
        escapeCsvCell(line.branchId),
        escapeCsvCell(line.branchName),
        escapeCsvCell(line.accountCode),
        escapeCsvCell(line.accountName),
        line.debit > 0 ? line.debit.toFixed(2) : '0.00',
        line.credit > 0 ? line.credit.toFixed(2) : '0.00',
        escapeCsvCell(line.taxCode),
        escapeCsvCell(line.memo),
        escapeCsvCell(report.exportDigest),
      ].join(',')
    );
  }

  return rows.join('\n');
}
