export type ExpenseClaimType =
  | 'reimbursement_claim'
  | 'company_funded_expense'
  | 'cash_advance';

export type ExpenseClaimStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'returned'
  | 'pending_additional_approval'
  | 'approved'
  | 'rejected'
  | 'payment_pending'
  | 'partially_paid'
  | 'paid'
  | 'reconciled'
  | 'cancelled'
  | 'reversed';

export type ExpenseAccountingClassification =
  | 'operating_expense'
  | 'inventory_purchase'
  | 'fixed_asset'
  | 'prepayment'
  | 'employee_advance'
  | 'statutory_liability';

export interface ExpenseLineItem {
  id: string;
  description: string;
  categoryId: string;
  subcategory?: string;
  quantity: number;
  unitCost: number;
  amount: number;
  vatIncluded?: boolean;
  vatAmount?: number;
  accountingClassification: ExpenseAccountingClassification;
  accountCode?: string;
  inventorySku?: string;
  assetTag?: string;
}

export interface ExpenseAttachment {
  id: string;
  claimId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  uploadedByStaffId: string;
  uploadedByName: string;
  uploadedAt: string;
  documentType: 'receipt' | 'invoice' | 'pos_slip' | 'transfer_proof' | 'waybill' | 'approval_memo' | 'other';
  sha256Hash?: string;
}

export interface ExpenseApprovalHistoryEntry {
  id: string;
  claimId: string;
  previousStatus: ExpenseClaimStatus | 'none';
  newStatus: ExpenseClaimStatus;
  action:
    | 'create_draft'
    | 'submit'
    | 'resubmit'
    | 'approve_stage_1'
    | 'approve_final'
    | 'escalate'
    | 'return_for_clarification'
    | 'reject'
    | 'record_payment'
    | 'retire_advance'
    | 'reconcile'
    | 'cancel'
    | 'reverse';
  stage: 'submission' | 'branch_review' | 'elevated_approval' | 'finance_settlement' | 'reconciliation' | 'reversal';
  actorId: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  comment: string;
  amountAuthorised?: number;
  paymentReference?: string;
}

export interface ExpenseFraudFlag {
  code:
    | 'duplicate_receipt_ref'
    | 'similar_amount_repeat'
    | 'split_claim_below_threshold'
    | 'same_vendor_repeat'
    | 'missing_required_receipt'
    | 'emergency_override';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detectedAt: string;
}

export interface ExpensePaymentRecord {
  id: string;
  paidAt: string;
  amount: number;
  paymentMethod: 'bank_transfer' | 'cash_drawer' | 'petty_cash' | 'company_card' | 'pos_terminal';
  paymentReference: string;
  fundingAccountCode: string; // e.g., '1010' (Cash) or '1030' (Bank)
  paidByStaffId: string;
  paidByName: string;
  linkedCashMovementId?: string;
  notes?: string;
}

export interface CashAdvanceRetirementRecord {
  retiredAt: string;
  retiredByStaffId: string;
  retiredByName: string;
  substantiatedExpenseAmount: number;
  unspentCashReturned: number;
  returnPaymentMethod?: 'cash_drawer' | 'bank_transfer' | 'petty_cash';
  returnReference?: string;
  targetExpenseAccountCode: string;
  notes: string;
}

export interface DbExpenseClaim {
  id: string;
  claimReference: string; // e.g., CLM-20261029-0001
  claimType: ExpenseClaimType;
  status: ExpenseClaimStatus;

  // Claimant metadata (always derived from authenticated staff session on creation)
  claimantStaffId: string;
  claimantName: string;
  claimantRole: string;
  homeBranchId: string;
  operatingBranchId: string;
  department: string;

  // Dates
  createdAt: string;
  submittedAt?: string;
  expenseDate: string; // YYYY-MM-DD when the expense occurred
  approvedAt?: string;
  paidAt?: string;
  reconciledAt?: string;
  reversedAt?: string;

  // Classification & Financials
  categoryId: string;
  categoryName: string;
  subcategory?: string;
  accountingClassification: ExpenseAccountingClassification;
  targetAccountCode: string; // e.g., '6100', '6500', '1300', '1500', '1150'
  currency: 'NGN';
  totalAmount: number;
  vatAmount: number;
  approvedAmount?: number;
  paidAmount: number;

  // Vendor & Operational context
  vendorName: string;
  vendorPhoneOrTin?: string;
  businessReason: string;
  description: string;
  purchaseOrderRef?: string;
  workOrderRef?: string;
  receiptOrInvoiceRef?: string;
  taxInvoiceNumber?: string;
  paymentMethodUsedByClaimant: 'personal_cash' | 'personal_transfer' | 'personal_card' | 'company_cash_drawer' | 'company_bank_transfer' | 'company_pos_card' | 'advance_request';
  claimantBankName?: string;
  claimantAccountNumber?: string;
  claimantAccountName?: string;

  // Line items & attachments
  lineItems: ExpenseLineItem[];
  attachmentIds: string[];
  missingReceiptReason?: string;
  isEmergencyExpense?: boolean;

  // Cross-module links to prevent double counting
  linkedCashMovementId?: string;
  linkedShiftId?: string;
  linkedGrnId?: string;
  linkedAssetId?: string;

  // Governance, flags & lifecycle history
  requiresAdditionalApproval: boolean;
  currentApprovalStage: 'draft' | 'branch_review' | 'elevated_approval' | 'finance_settlement' | 'completed' | 'closed';
  fraudFlags: ExpenseFraudFlag[];
  approvalHistory: ExpenseApprovalHistoryEntry[];
  payments: ExpensePaymentRecord[];
  advanceRetirement?: CashAdvanceRetirementRecord;
  reconciliationNotes?: string;
  reconciledByStaffId?: string;
  reconciledByName?: string;
  reversalReason?: string;
  reversedByStaffId?: string;
  reversedByName?: string;
}

export interface ExpenseCategoryConfig {
  id: string;
  code: string;
  name: string;
  group: 'procurement_food' | 'utilities_facilities' | 'logistics_admin' | 'statutory_other';
  defaultClassification: ExpenseAccountingClassification;
  defaultAccountCode: string;
  requiresReceiptAboveNgn: number;
  requiresDetailedDescription: boolean;
  requiresAdditionalApprovalAboveNgn?: number;
  monthlyBranchBudgetNgn?: number;
  active: boolean;
}

export interface ExpenseRoleApprovalLimit {
  role: string;
  canReview: boolean;
  canApproveStandard: boolean;
  canApproveElevated: boolean;
  canAuthorizePayment: boolean;
  maxApprovalAmountNgn: number;
}

export interface ExpenseApprovalMatrixConfig {
  standardApprovalThresholdNgn: number; // Claims above this require elevated approval (corporate_admin / super_admin / accountant)
  receiptMandatoryThresholdNgn: number; // Claims above this require attachment or explicit missing-receipt exception reason
  separatePaymentAuthorisationRequired: boolean;
  allowEmergencyWithoutReceipt: boolean;
  duplicateWindowDays: number;
  splitClaimWindowHours: number;
  roleLimits: ExpenseRoleApprovalLimit[];
  notificationRules: {
    inAppEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
    notifyOnSubmit: boolean;
    notifyOnReturnOrReject: boolean;
    notifyOnApprove: boolean;
    notifyOnPay: boolean;
  };
}

export interface QrCodeConfigItem {
  id: string;
  branchId: string;
  branchName: string;
  label: string;
  channel: 'digital_menu' | 'table_order' | 'pickup_counter' | 'feedback';
  tableNumber?: string;
  destinationUrl: string;
  active: boolean;
  scansCount: number;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryConfig[] = [
  {
    id: 'cat_emergency_ingredients',
    code: 'EXP-PROC-01',
    name: 'Emergency Market Ingredients & Produce',
    group: 'procurement_food',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '5010',
    requiresReceiptAboveNgn: 5000,
    requiresDetailedDescription: false,
    monthlyBranchBudgetNgn: 450000,
    active: true,
  },
  {
    id: 'cat_stock_replenishment',
    code: 'EXP-PROC-02',
    name: 'Direct Stock Replenishment (Inventory Linked)',
    group: 'procurement_food',
    defaultClassification: 'inventory_purchase',
    defaultAccountCode: '1300',
    requiresReceiptAboveNgn: 1000,
    requiresDetailedDescription: false,
    monthlyBranchBudgetNgn: 800000,
    active: true,
  },
  {
    id: 'cat_packaging_disposables',
    code: 'EXP-PROC-03',
    name: 'Takeaway Packaging, Foil & Disposables',
    group: 'procurement_food',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '5200',
    requiresReceiptAboveNgn: 5000,
    requiresDetailedDescription: false,
    monthlyBranchBudgetNgn: 300000,
    active: true,
  },
  {
    id: 'cat_cooking_gas_lpg',
    code: 'EXP-UTIL-01',
    name: 'Cooking Gas (LPG) & Kitchen Fuel',
    group: 'utilities_facilities',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '6100',
    requiresReceiptAboveNgn: 5000,
    requiresDetailedDescription: false,
    monthlyBranchBudgetNgn: 600000,
    active: true,
  },
  {
    id: 'cat_diesel_generator',
    code: 'EXP-UTIL-02',
    name: 'Generator Diesel, Petrol & Power Utility',
    group: 'utilities_facilities',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '6100',
    requiresReceiptAboveNgn: 5000,
    requiresDetailedDescription: false,
    monthlyBranchBudgetNgn: 950000,
    active: true,
  },
  {
    id: 'cat_repairs_maintenance',
    code: 'EXP-UTIL-03',
    name: 'Kitchen Equipment & Facility Repairs',
    group: 'utilities_facilities',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '6600',
    requiresReceiptAboveNgn: 3000,
    requiresDetailedDescription: true,
    monthlyBranchBudgetNgn: 350000,
    active: true,
  },
  {
    id: 'cat_cleaning_sanitation',
    code: 'EXP-UTIL-04',
    name: 'Cleaning Chemicals, Pest Control & Sanitation',
    group: 'utilities_facilities',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '6100',
    requiresReceiptAboveNgn: 5000,
    requiresDetailedDescription: false,
    monthlyBranchBudgetNgn: 180000,
    active: true,
  },
  {
    id: 'cat_fixed_equipment',
    code: 'EXP-ASSET-01',
    name: 'Small Appliances & Kitchen Capital Assets',
    group: 'utilities_facilities',
    defaultClassification: 'fixed_asset',
    defaultAccountCode: '1500',
    requiresReceiptAboveNgn: 1,
    requiresDetailedDescription: true,
    requiresAdditionalApprovalAboveNgn: 50000,
    monthlyBranchBudgetNgn: 500000,
    active: true,
  },
  {
    id: 'cat_dispatch_fuel_riders',
    code: 'EXP-LOG-01',
    name: 'Dispatch Bike Fuel, Rider Float & Delivery Logistics',
    group: 'logistics_admin',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '6500',
    requiresReceiptAboveNgn: 3000,
    requiresDetailedDescription: false,
    monthlyBranchBudgetNgn: 400000,
    active: true,
  },
  {
    id: 'cat_office_comms_printing',
    code: 'EXP-LOG-02',
    name: 'POS Thermal Paper, Stationery, Data & Airtime',
    group: 'logistics_admin',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '6700',
    requiresReceiptAboveNgn: 3000,
    requiresDetailedDescription: false,
    monthlyBranchBudgetNgn: 150000,
    active: true,
  },
  {
    id: 'cat_staff_welfare_medical',
    code: 'EXP-LOG-03',
    name: 'First Aid, Staff Transport & Shift Welfare',
    group: 'logistics_admin',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '6700',
    requiresReceiptAboveNgn: 5000,
    requiresDetailedDescription: true,
    monthlyBranchBudgetNgn: 200000,
    active: true,
  },
  {
    id: 'cat_prepaid_rent_insurance',
    code: 'EXP-PRE-01',
    name: 'Prepaid Subscriptions, Insurance & Service Contracts',
    group: 'logistics_admin',
    defaultClassification: 'prepayment',
    defaultAccountCode: '1250',
    requiresReceiptAboveNgn: 1,
    requiresDetailedDescription: true,
    requiresAdditionalApprovalAboveNgn: 50000,
    monthlyBranchBudgetNgn: 500000,
    active: true,
  },
  {
    id: 'cat_statutory_permits',
    code: 'EXP-STAT-01',
    name: 'Local Govt Permits, Environmental & Regulatory Levies',
    group: 'statutory_other',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '6800',
    requiresReceiptAboveNgn: 1,
    requiresDetailedDescription: true,
    requiresAdditionalApprovalAboveNgn: 25000,
    monthlyBranchBudgetNgn: 250000,
    active: true,
  },
  {
    id: 'cat_other_exceptional',
    code: 'EXP-OTH-99',
    name: 'Other Verified Operational Expense (Specify Details)',
    group: 'statutory_other',
    defaultClassification: 'operating_expense',
    defaultAccountCode: '6700',
    requiresReceiptAboveNgn: 2000,
    requiresDetailedDescription: true,
    requiresAdditionalApprovalAboveNgn: 20000,
    monthlyBranchBudgetNgn: 150000,
    active: true,
  },
];

export const DEFAULT_EXPENSE_APPROVAL_MATRIX: ExpenseApprovalMatrixConfig = {
  standardApprovalThresholdNgn: 50000,
  receiptMandatoryThresholdNgn: 5000,
  separatePaymentAuthorisationRequired: true,
  allowEmergencyWithoutReceipt: true,
  duplicateWindowDays: 14,
  splitClaimWindowHours: 48,
  roleLimits: [
    {
      role: 'shift_supervisor',
      canReview: true,
      canApproveStandard: true,
      canApproveElevated: false,
      canAuthorizePayment: false,
      maxApprovalAmountNgn: 15000,
    },
    {
      role: 'branch_manager',
      canReview: true,
      canApproveStandard: true,
      canApproveElevated: false,
      canAuthorizePayment: true,
      maxApprovalAmountNgn: 50000,
    },
    {
      role: 'inventory_controller',
      canReview: true,
      canApproveStandard: false,
      canApproveElevated: false,
      canAuthorizePayment: false,
      maxApprovalAmountNgn: 0,
    },
    {
      role: 'accountant',
      canReview: true,
      canApproveStandard: true,
      canApproveElevated: true,
      canAuthorizePayment: true,
      maxApprovalAmountNgn: 250000,
    },
    {
      role: 'admin',
      canReview: true,
      canApproveStandard: true,
      canApproveElevated: true,
      canAuthorizePayment: true,
      maxApprovalAmountNgn: 500000,
    },
    {
      role: 'corporate_admin',
      canReview: true,
      canApproveStandard: true,
      canApproveElevated: true,
      canAuthorizePayment: true,
      maxApprovalAmountNgn: 2000000,
    },
    {
      role: 'super_admin',
      canReview: true,
      canApproveStandard: true,
      canApproveElevated: true,
      canAuthorizePayment: true,
      maxApprovalAmountNgn: 10000000,
    },
  ],
  notificationRules: {
    inAppEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    whatsappEnabled: false,
    notifyOnSubmit: true,
    notifyOnReturnOrReject: true,
    notifyOnApprove: true,
    notifyOnPay: true,
  },
};

export const DEFAULT_QR_CONFIGS: QrCodeConfigItem[] = [
  {
    id: 'qr_gra_menu',
    branchId: 'gra',
    branchName: 'GRA Flagship Hub',
    label: 'GRA Flagship — Main Digital Menu',
    channel: 'digital_menu',
    tableNumber: 'All Tables',
    destinationUrl: 'https://chopliferepublic.com/?branch=gra&view=menu&qr=true',
    active: true,
    scansCount: 342,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'qr_gra_vip1',
    branchId: 'gra',
    branchName: 'GRA Flagship Hub',
    label: 'GRA Lounge — Table VIP-01 Direct Order',
    channel: 'table_order',
    tableNumber: 'VIP-01',
    destinationUrl: 'https://chopliferepublic.com/?branch=gra&view=menu&table=VIP-01&qr=true',
    active: true,
    scansCount: 118,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'qr_okabere_menu',
    branchId: 'okabere',
    branchName: 'Okabere Road Hub',
    label: 'Okabere Road — Express Digital Menu',
    channel: 'digital_menu',
    tableNumber: 'All Tables',
    destinationUrl: 'https://chopliferepublic.com/?branch=okabere&view=menu&qr=true',
    active: true,
    scansCount: 215,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'qr_ugbowo_menu',
    branchId: 'ugbowo',
    branchName: 'Ugbowo Campus Hub',
    label: 'Ugbowo Campus — Fast Pickup & Menu QR',
    channel: 'pickup_counter',
    tableNumber: 'Counter-01',
    destinationUrl: 'https://chopliferepublic.com/?branch=ugbowo&view=menu&qr=true',
    active: true,
    scansCount: 489,
    updatedAt: new Date().toISOString(),
  },
];
