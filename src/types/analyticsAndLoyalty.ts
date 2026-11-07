import { BranchId } from './catalogAndOrders';

export type ExecutivePeriod =
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'lifetime'
  | 'custom'
  | 'today'
  | 'yesterday'
  | '7days'
  | '30days'
  | 'all';

export type ExecutiveComparisonMode =
  | 'none'
  | 'today_vs_yesterday'
  | 'today_vs_equiv_day_last_week'
  | 'this_month_vs_last_month'
  | 'this_month_vs_same_month_last_year'
  | 'this_year_vs_last_year'
  | 'this_year_vs_two_years_ago';

export interface ExecutiveMetricComparison {
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
  zeroBaselineNote?: string;
}

export interface ExecutivePeriodComparison {
  mode: ExecutiveComparisonMode;
  label: string;
  isLikeForLike: boolean;
  currentWindow: { startIso: string; endIso: string; label: string };
  previousWindow: { startIso: string; endIso: string; label: string };
  metrics: {
    netRevenue: ExecutiveMetricComparison;
    grossProfit: ExecutiveMetricComparison;
    totalOpex: ExecutiveMetricComparison;
    netProfit: ExecutiveMetricComparison;
    orderCount: ExecutiveMetricComparison;
    aov: ExecutiveMetricComparison;
  };
}

export interface ExecutiveDrillDownRecord {
  id: string;
  recordNumber: string;
  recordType: 'pos_check' | 'expense_claim' | 'wastage' | 'historical_migrated';
  branchId: string;
  timestamp: string;
  categoryOrMethod: string;
  amountNaira: number;
  status: string;
  operatorName?: string;
  isHistoricalMigrated?: boolean;
}

export interface ExecutivePnL {
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  cogs: number;
  cogsPct: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: {
    labor: number;
    generatorAndPower: number;
    wastageShrinkage: number;
    deliveryFleet: number;
    totalOpex: number;
  };
  netProfit: number;
  netMarginPct: number;
}

export interface BranchBenchmark {
  branchId: BranchId;
  branchName: string;
  tagline: string;
  grossSales: number;
  netSales: number;
  orderCount: number;
  aov: number;
  revenueSharePct: number;
  cogsNaira: number;
  cogsPct: number;
  laborCostNaira: number;
  utilitiesFuelCostNaira: number;
  wastageLossNaira: number;
  netProfitNaira: number;
  netMarginPct: number;
  channelSplit: {
    dineIn: number;
    takeaway: number;
    delivery: number;
    catering: number;
  };
  avgTableTurnMinutes: number;
  deliverySlaCompliancePct: number;
  topItemName: string;
}

export interface HourlySalesSlot {
  hour: string;
  hourLabel: string;
  orderCount: number;
  revenue: number;
  rushLevel: 'normal' | 'rush' | 'peak';
}

export interface MenuEngineeringItem {
  id: string;
  name: string;
  category: string;
  volume: number;
  sellingPrice: number;
  foodCost: number;
  grossMarginPct: number;
  revenue: number;
  grossProfit: number;
  quadrant: 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';
  strategicRecommendation: string;
}

export interface WastageAuditSummary {
  totalLossNaira: number;
  byCategory: { category: string; amount: number; pct: number }[];
  byReason: { reason: string; count: number; lossNaira: number }[];
  recentIncidents: any[];
}

export interface LaborProductivitySummary {
  cashierLeaderboard: {
    staffId: string;
    name: string;
    branchId: string;
    ordersProcessed: number;
    totalRevenue: number;
    avgProcessingSecs: number;
  }[];
  kitchenStations: {
    stationName: string;
    ordersCompleted: number;
    avgPrepTimeMins: number;
    onTimePct: number;
  }[];
  riderLogistics: {
    riderId: string;
    name: string;
    completedDrops: number;
    avgTransitMins: number;
    onTimeRate: number;
  }[];
}

export interface ExecutiveInsightAlert {
  id: string;
  type: 'positive' | 'warning' | 'strategy';
  title: string;
  detail: string;
  metric?: string;
  branchTarget?: string;
}

export interface ExecutiveBIDashboardData {
  period: ExecutivePeriod;
  branchId: string;
  timezone?: string;
  windowLabel?: string;
  windowStartIso?: string;
  windowEndIso?: string;
  includeHistoricalMigrated?: boolean;
  dataQualityNotice?: {
    hasAccrualEstimates: boolean;
    liveCheckCount: number;
    historicalMigratedCheckCount: number;
    verifiedExpenseClaimsCount: number;
    disclosureText: string;
  };
  comparison?: ExecutivePeriodComparison;
  drillDownRecords?: ExecutiveDrillDownRecord[];
  pnl: ExecutivePnL;
  branchBenchmarks: BranchBenchmark[];
  hourlySales: HourlySalesSlot[];
  menuMatrix: MenuEngineeringItem[];
  wastageAudit: WastageAuditSummary;
  laborProductivity: LaborProductivitySummary;
  aiInsights: ExecutiveInsightAlert[];
}

// =====================================================================
// SHIFT FINANCIAL RECONCILIATION TYPES (FEATURE A)
// =====================================================================

export type ReconciliationDiscrepancyStatus =
  | 'reconciled'
  | 'pending_confirmation'
  | 'unmatched_payment'
  | 'amount_mismatch'
  | 'duplicate_reference'
  | 'manual_review_required';

export interface ShiftTransactionRow {
  id: string;
  sourceType: 'pos_check' | 'order' | 'gateway_only';
  orderOrCheckNumber: string;
  timestamp: string;
  cashierOrOperator: string;
  orderType: string;
  grossAmount: number;
  discountAmount: number;
  taxAndCharges: number;
  refundAmount: number;
  netPayable: number;
  paymentChannel: 'cash' | 'pos_terminal' | 'bank_transfer' | 'online_gateway' | 'split' | 'wallet_or_house';
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded' | 'voided';
  paymentReference: string;
  gatewayConfirmedAmount: number;
  reconciliationStatus: ReconciliationDiscrepancyStatus;
  discrepancyNote?: string;
}

export interface ShiftDiscrepancyItem {
  id: string;
  status: ReconciliationDiscrepancyStatus;
  severity: 'low' | 'medium' | 'high';
  reference: string;
  expectedAmount: number;
  actualAmount: number;
  varianceAmount: number;
  description: string;
}

export interface ShiftReconciliationReport {
  shift: {
    id: string;
    branchId: string;
    registerId: string;
    openedByStaffId: string;
    openedByName: string;
    closedByStaffId?: string;
    closedByName?: string;
    openedAt: string;
    closedAt?: string;
    status: 'open' | 'closed' | 'handed_over' | 'flagged_variance';
  };
  salesSummary: {
    totalCompletedOrders: number;
    totalVoidedOrCancelled: number;
    totalRefundedOrders: number;
    totalPendingConfirmationOrders: number;
    grossSales: number;
    totalDiscounts: number;
    taxesAndServiceCharges: number;
    packagingFees: number;
    deliveryFees: number;
    totalRefundsValue: number;
    netRecognizedSales: number;
    pendingUnrecognizedValue: number;
  };
  posPaymentBreakdown: {
    cashSales: number;
    posTerminalCardSales: number;
    bankTransferSales: number;
    onlineGatewaySales: number;
    walletOrHouseAccountSales: number;
    splitPaymentOrdersCount: number;
    totalCollectedAcrossChannels: number;
  };
  cashDrawerReconciliation: {
    openingFloat: number;
    cashSalesReceived: number;
    paidInAmount: number;
    paidOutAmount: number;
    safeDropAmount: number;
    cashRefundsPaidOut: number;
    expectedDrawerCash: number;
    countedClosingCash: number | null;
    cashOverShortVariance: number;
    varianceExplanation?: string;
    status: 'balanced' | 'overage' | 'shortage' | 'open_shift_uncounted';
  };
  gatewaySettlementSummary: {
    totalGatewayRecords: number;
    verifiedSuccessfulCount: number;
    verifiedSuccessfulValue: number;
    pendingCount: number;
    pendingValue: number;
    failedOrAbandonedCount: number;
    failedOrAbandonedValue: number;
    reversedOrRefundedCount: number;
    reversedOrRefundedValue: number;
    byProvider: Record<string, { count: number; totalAmount: number; verifiedAmount: number }>;
  };
  discrepancies: {
    overallStatus: ReconciliationDiscrepancyStatus;
    totalDiscrepancyCount: number;
    items: ShiftDiscrepancyItem[];
  };
  transactions: ShiftTransactionRow[];
  cashMovements: any[];
  generatedAt: string;
}

// =====================================================================
// CUSTOMER LOYALTY, DIGITAL WALLET & VIP HOUSE ACCOUNTS
// =====================================================================

export interface SavedAddress {
  id: string;
  label: 'Home' | 'Office' | 'Hostel' | 'Event' | 'Other';
  address: string;
  deliveryZone: string;
  landmark?: string;
  isDefault?: boolean;
}

export interface CustomerProfile {
  id: string;
  name: string;
  knownDisplayName?: string;
  phone: string;
  email?: string;
  alternatePhone?: string;
  defaultDeliveryNotes?: string;
  rememberCheckoutDetails?: boolean;
  shortlistedProductIds?: string[];
  sessionOrderIds?: string[];
  preferredBranchId: BranchId;
  savedAddresses: SavedAddress[];
  isLoggedIn: boolean;
  pointsRedeemed: number;
  joinedDate: string;
}

export interface RewardPerk {
  id: string;
  title: string;
  pointsCost: number;
  description: string;
  discountValue?: number;
  freeProductId?: string;
  badge: string;
}

export type CustomerTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CustomerAccount {
  id: string; // e.g. "cust-001"
  name: string;
  phone: string;
  email?: string;
  tier: CustomerTier;
  loyaltyPoints: number;
  lifetimeSpend: number;
  visitCount: number;
  lastVisitDate: string;
  walletBalance: number; // Stored-value pre-paid funds in NGN
  walletPin: string; // 4-digit security PIN for in-store/online debit authorization
  stampCount: number; // 0 to 10 (1 stamp per qualifying visit > ₦3,000)
  stampsRedeemedTotal: number;
  preferredBranchId: BranchId | 'all';
  notes?: string;
  status: 'active' | 'suspended';
  birthday?: string; // MM-DD
  createdAt: string;
}

export type WalletTransactionType = 'top_up' | 'debit_order' | 'bonus' | 'refund' | 'points_conversion';

export interface WalletTransaction {
  id: string; // e.g. "wtx-1725283921"
  customerId: string;
  customerName: string;
  type: WalletTransactionType;
  amount: number;
  bonusAmount?: number;
  previousBalance: number;
  newBalance: number;
  paymentMethod?: string; // cash, pos_terminal, bank_transfer
  reference?: string; // e.g. "TOPUP-POS-98124"
  orderId?: string;
  checkId?: string;
  branchId: BranchId | string;
  staffName: string;
  timestamp: string;
  note?: string;
}

export interface AuthorizedSigner {
  name: string;
  designation: string;
  phone: string;
  staffBadge?: string;
}

export interface CorporateHouseAccount {
  id: string; // e.g. "house-001"
  companyName: string;
  accountCode: string; // e.g. "CHOP-CORP-0104"
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number; // e.g. ₦500,000
  currentBalance: number; // Outstanding amount owed to ChopLife
  paymentTerms: 'net_7' | 'net_15' | 'net_30';
  authorizedSigners: AuthorizedSigner[];
  status: 'active' | 'on_hold' | 'settled';
  preferredBranchId: BranchId | 'all';
  billingNotes?: string;
  createdAt: string;
}

export interface HouseAccountCharge {
  id: string; // e.g. "hchg-001"
  accountId: string;
  companyName: string;
  orderId?: string;
  checkId?: string;
  checkNumber?: string;
  amount: number;
  authorizedSigner: string;
  department?: string;
  branchId: BranchId | string;
  timestamp: string;
  staffName: string;
  status: 'unbilled' | 'invoiced' | 'settled';
  notes?: string;
}

export interface HouseAccountPayment {
  id: string; // e.g. "hpmt-001"
  accountId: string;
  companyName: string;
  amount: number;
  paymentMethod: 'bank_transfer' | 'cheque' | 'pos_terminal' | 'cash';
  bankReference: string;
  receiptNumber: string;
  receivedByStaffName: string;
  timestamp: string;
  notes?: string;
}

export interface LoyaltyRewardRule {
  pointsPerNairaSpend: number; // 0.01 = 1 point per ₦100 spent
  nairaPerPointRedeem: number; // ₦10 per point
  stampMilestoneCount: number; // 10 stamps
  stampRewardDescription: string; // e.g. "Free Signature Suya Platter or Asun Jollof"
  walletTopupBonusThreshold: number; // e.g. ₦20,000
  walletTopupBonusPct: number; // 5% bonus credit
}

export interface RewardHistoryItem {
  id: string;
  type: 'earned' | 'redeemed' | 'bonus' | 'adjustment';
  points: number;
  title: string;
  description: string;
  orderNumber?: string;
  voucherCode?: string;
  date: string;
  branchId?: BranchId;
}
