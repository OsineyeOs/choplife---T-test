export interface DbCmsBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  badge?: string;
  imageUrl?: string;
  active: boolean;
  order: number;
}

export interface DbCmsArticle {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  summary: string;
  content: string[];
  category: string;
  author: string;
  readTime: string;
  publishedDate: string;
  image: string;
  tags?: string[];
  published: boolean;
  updatedAt: string;
}

export interface DbCmsContent {
  hero: {
    badge: string;
    headline: string;
    subheadline: string;
    ctaPrimaryText: string;
    ctaSecondaryText: string;
    announcementTicker: string;
    isTickerActive: boolean;
  };
  contactInfo: {
    primaryPhone: string;
    whatsappNumber: string;
    email: string;
    headOfficeAddress: string;
    openingHours: string;
  };
  banners: DbCmsBanner[];
  articles: DbCmsArticle[];
  status: 'draft' | 'published';
  updatedAt: string;
  updatedBy?: string;
  publishedAt?: string;
  publishedBy?: string;
  bankTransferConfig?: {
    enabled: boolean;
    bankName: string;
    accountName: string;
    accountNumber: string;
    instructions?: string;
  };
  deliveryZones?: Record<
    string,
    {
      name: string;
      fee: number;
      estimatedMinutes: string;
      active: boolean;
    }
  >;
}

export interface DbMenuCategory {
  id: string;
  name: string;
  tag: string;
  description: string;
  icon: string;
  badge?: string;
  sortOrder: number;
  channels: ('website' | 'pos')[];
  isActive: boolean;
  updatedAt: string;
}

export interface DbPackageComponent {
  productId: string;
  name: string;
  productName?: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  category?: string;
}

export interface DbDiscountConfig {
  enabled: boolean;
  type: 'percentage' | 'fixed';
  discountType?: 'percentage' | 'fixed';
  value: number;
  discountValue?: number;
  reason?: string;
  label?: string;
  startDate?: string;
  endDate?: string;
  allowedBranches?: string[];
  allowedChannels?: ('website' | 'pos')[];
  stackableWithOrderDiscount?: boolean;
}

export interface DbWholesaleTier {
  minQuantity: number;
  unitPrice: number;
  label?: string;
}

export interface DbWholesalePricingConfig {
  enabled: boolean;
  retailPrice?: number;
  wholesalePrice: number;
  minQuantity: number;
  minWholesaleQty?: number;
  allowSkuPooling?: boolean;
  poolingGroup?: string;
  tiers?: DbWholesaleTier[];
  allowedBranches?: string[];
  allowedChannels?: ('website' | 'pos')[];
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  preventExtraDiscount?: boolean;
}

export interface DbPromotionRulesConfig {
  promoType?: 'buy_x_get_y' | 'spend_x_get_y' | 'package_bonus';
  qualifyingProductId?: string;
  qualifyingProductIds?: string[];
  qualifyingCategoryIds?: string[];
  qualifyingMinQty?: number;
  qualifyingMinSpend?: number;
  freeProductId?: string;
  freeProductName?: string;
  freeQuantity?: number;
  maxRewardsPerOrder?: number;
  startDate?: string;
  endDate?: string;
  allowedBranches?: string[];
  allowedChannels?: ('website' | 'pos')[];
  stackable?: boolean;
}

export interface DbProductItem {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  subcategory?: string;
  image: string;
  basePrice: number;
  branchPrices?: Partial<Record<string, number>>;
  branchAvailability: Record<string, boolean>;
  prepTimeMinutes: number;
  isPopular?: boolean;
  isFeatured?: boolean;
  isNewProduct?: boolean;
  isSpicy?: boolean;
  isVegetarian?: boolean;
  packagingCharge?: number;
  channels: ('website' | 'pos')[];
  status: 'published' | 'draft' | 'paused' | 'archived';
  productType?: 'standard' | 'combo' | 'platter' | 'package' | 'promotion';
  compositionVersion?: number;
  components?: DbPackageComponent[];
  packaging?: {
    productId: string;
    name: string;
    quantity: number;
  };
  discountConfig?: DbDiscountConfig;
  wholesalePricing?: DbWholesalePricingConfig;
  isWholesale?: boolean;
  minOrderQty?: number;
  wholesaleUnitPrice?: number;
  promotionRules?: DbPromotionRulesConfig;
  optionGroups?: any[];
  availableAddOns?: any[];
  suggestedUpsells?: string[];
  updatedAt: string;
}

export interface DbStaffAccount {
  id: string;
  staffId: string;
  name: string;
  workEmail: string;
  phone: string;
  role: string;
  branchId: string;
  allowedBranchIds?: string[];
  customPrivileges?: string[];
  passwordHash: string;
  salt?: string;
  pinHash?: string;
  pinSalt?: string;
  status: 'active' | 'suspended';
  mustChangePassword: boolean;
  failedLoginAttempts?: number;
  lockoutUntil?: number;
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt: string;
  updatedAt: string;
  // CR-12, CR-13: Staff Guarantor & DOB Compliance
  dateOfBirth?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorRelationship?: string;
  guarantorAddress?: string;
  guarantorWorkplace?: string;
  payrollProfile?: PayrollProfile;
}

export interface PayrollProfile {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  pensionNumber?: string;
  taxId?: string;
  status: 'active' | 'suspended';
  effectiveDate: string;
}

export interface DbSession {
  id?: string;
  token: string;
  staffId: string;
  role: string;
  branchId: string;
  createdAt: any;
  expiresAt: any;
  lastActivity: any;
}

export interface DbResetToken {
  token: string;
  staffId: string;
  expiresAt: any;
  used: boolean;
}

export interface DbAuditLog {
  id: string;
  timestamp: string;
  staffName: string;
  staffRole: string;
  branchId: string;
  actionType: string;
  details: string;
  metadata?: Record<string, any>;
}

export interface DbTable {
  id: string;
  branchId: string;
  tableNumber: string;
  area: 'Main Dining' | 'VIP Lounge' | 'Outdoor Terrace' | 'Bar Area' | 'Private Room';
  capacity: number;
  status: 'available' | 'seated' | 'ordering' | 'kitchen_prep' | 'food_ready' | 'bill_requested' | 'payment_pending' | 'cleaning';
  currentCheckId?: string;
  guestCount?: number;
  assignedStaffId?: string;
  assignedStaffName?: string;
  notes?: string;
  updatedAt: string;
}

export interface DbCheckItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number;
  itemDiscountAmount?: number;
  appliedTierLabel?: string;
  isWholesaleApplied?: boolean;
  isPromoReward?: boolean;
  promoSourceId?: string;
  promoName?: string;
  productType?: 'standard' | 'combo' | 'platter' | 'package' | 'promotion';
  compositionVersion?: number;
  compositionSnapshot?: DbPackageComponent[];
  unitCost?: number;
  totalPrice: number;
  notes?: string;
  status: 'pending' | 'sent_to_kitchen' | 'preparing' | 'ready' | 'served' | 'voided';
  sentToKitchenAt?: string;
  customization?: any;
}

export interface DbCheckSplitShare {
  shareId: string;
  shareIndex: number;
  label: string;
  allocatedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'unpaid' | 'partially_paid' | 'paid';
  itemIds?: string[];
  paidAt?: string;
  paymentRefs?: string[];
}

export interface DbCheckPaymentRecord {
  id: string;
  idempotencyKey?: string;
  shareId?: string;
  shareLabel?: string;
  method: 'cash' | 'pos_terminal' | 'bank_transfer' | 'wallet' | 'house_account';
  amount: number;
  cashTendered?: number;
  changeGiven?: number;
  reference?: string;
  confirmedByStaffId: string;
  confirmedByName: string;
  confirmationMethod?: string;
  timestamp: string;
  paidAt?: string;
  cashierId?: string;
  cashierName?: string;
}

export interface DbCheck {
  id: string;
  checkNumber: string;
  branchId: string;
  tableId?: string;
  tableNumber?: string;
  checkType: 'dine_in' | 'takeaway' | 'delivery' | 'online';
  status: 'open' | 'held' | 'sent_to_kitchen' | 'ready' | 'bill_printed' | 'partially_paid' | 'paid' | 'voided' | 'refunded';
  customerName: string;
  customerPhone?: string;
  guestCount: number;
  items: DbCheckItem[];
  subtotal: number;
  discountAmount: number;
  discountPercent?: number;
  discountReason?: string;
  discountApprovedBy?: string;
  packagingFee: number;
  deliveryFee: number;
  total: number;
  amountPaid?: number;
  remainingBalance?: number;
  paymentMethod?: string;
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid' | 'refunded' | 'voided';
  paymentDetails?: any;
  payments?: DbCheckPaymentRecord[];
  splitPayments?: { method: string; amount: number; reference?: string; shareId?: string }[];
  splitConfig?: {
    mode: 'equal' | 'custom' | 'items';
    guestCount: number;
    shares: DbCheckSplitShare[];
    updatedAt: string;
  };
  inventoryDepletedAt?: string;
  openedAt: string;
  closedAt?: string;
  paidAt?: string;
  voidedAt?: string;
  voidReason?: string;
  openedByStaffId: string;
  openedByName: string;
  closedByStaffId?: string;
  closedByName?: string;
  settledByStaffId?: string;
  settledByName?: string;
  shiftId?: string;
  orderId?: string;
  notes?: string;
  // Historical eZee Optimus migration isolation fields
  isHistoricalMigrated?: boolean;
  legacySourceSystem?: string;
  legacyRecordId?: string;
  legacyBranchId?: string;
  migrationBatchId?: string;
  originalTimestamp?: string;
}

export interface DbShift {
  id: string;
  shiftNumber: string;
  branchId: string;
  registerId: string;
  openedByStaffId: string;
  openedByName: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  totalCashSales: number;
  totalPosSales: number;
  totalTransferSales: number;
  totalDiscounts: number;
  totalRefunds: number;
  totalVoids: number;
  totalOrders: number;
  cashDropsTotal: number;
  paidOutsTotal: number;
  expectedCashInTill: number;
  countedCashInTill?: number;
  cashVariance?: number;
  status: 'open' | 'closing' | 'reconciled' | 'closed';
  closedByStaffId?: string;
  closedByName?: string;
  approvedByStaffId?: string;
  approvedByName?: string;
  notes?: string;
}

export interface DbCashMovement {
  id: string;
  shiftId: string;
  branchId: string;
  timestamp: string;
  movementType: 'opening_float' | 'cash_sale' | 'cash_refund' | 'safe_drop' | 'paid_out' | 'adjustment';
  amount: number;
  reason: string;
  staffId: string;
  staffName: string;
  recipientOrRef?: string;
  notes?: string;
}

export interface DbRider {
  id: string;
  staffId?: string;
  name: string;
  phone: string;
  branchId: string;
  type: 'internal_fleet' | 'external_partner';
  partnerName?: string;
  bikeNumber?: string;
  currentStatus: 'available' | 'on_delivery' | 'offline';
  cashInHand: number;
  totalDeliveriesToday: number;
}

export interface DbDeliveryTask {
  id: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  riderId?: string;
  riderName?: string;
  assignedRiderId?: string;
  assignedRiderName?: string;
  assignedRiderPhone?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryZone: string;
  landmark?: string;
  orderTotal: number;
  total?: number;
  paymentMethod: string;
  codAmountDue: number;
  codAmountCollected: number;
  status: 'pending' | 'ready_for_pickup' | 'in_transit' | 'assigned' | 'accepted' | 'at_pickup' | 'collected' | 'out_for_delivery' | 'arrived' | 'delivered' | 'failed' | 'returned';
  handoverPin?: string;
  assignedAt?: string;
  acceptedAt?: string;
  packedAt?: string;
  pickedUpAt?: string;
  collectedAt?: string;
  deliveredAt?: string;
  createdAt?: string;
  failedReason?: string;
  cashReconciled: boolean;
  notes?: string;
  pickupAuthorizationCode?: string;
  checkpoint?: string;
  checkpointNote?: string;
  checkpointAt?: string;
  otpVerified?: boolean;
  cashRemitted?: boolean;
}

export type PrinterRole = 'counter_pos' | 'kitchen_kot' | 'grill_station' | 'bakery' | 'drinks' | 'expediter';
export type PrinterConnectionType = 'browser_thermal' | 'network_ip' | 'web_usb' | 'web_serial' | 'print_bridge';

export interface DbPrinterProfile {
  id: string;
  name: string;
  branchId: string;
  registerId?: string;
  station: string;
  role: PrinterRole;
  connectionType: PrinterConnectionType;
  ip?: string;
  port?: number;
  paperWidth: '80mm' | '58mm';
  enabled: boolean;
  autoCut: boolean;
  soundBuzzer: boolean;
  kickDrawer: boolean;
  categories?: string[];
  timeoutMs?: number;
  retryAttempts?: number;
  lastTestStatus?: 'untested' | 'connected_verified' | 'offline_unreachable' | 'failed' | 'bytes_transmitted';
  lastTestTimestamp?: string;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export type ReceiptDocumentType = 'customer_receipt' | 'kitchen_kot' | 'grill_ticket' | 'bar_slip' | 'bill_check' | 'shift_z_report';

export interface DbReceiptTemplate {
  id: string;
  docType: ReceiptDocumentType;
  branchId: string; // 'all' or branch ID
  name: string;
  paperWidth: '80mm' | '58mm';
  showLogo: boolean;
  brandName: string;
  tagline: string;
  showBranchAddress: boolean;
  showBranchPhone: boolean;
  phone?: string;
  instagram?: string;
  taxNumber?: string;
  customHeaderMessage?: string;
  customFooterMessage?: string;
  thankYouMessage: string;
  showOrderNumber: boolean;
  showDateTime: boolean;
  showCashierName: boolean;
  showCustomerDetails: boolean;
  showTableNumber: boolean;
  showOrderType: boolean;
  showItemModifiers: boolean;
  showTaxBreakdown: boolean;
  showSubtotal: boolean;
  showDeliveryFee: boolean;
  showDiscounts: boolean;
  showPaymentDetails: boolean;
  showTenderAndChange: boolean;
  showLoyaltyPoints: boolean;
  showReprintIndicator: boolean;
  highlightKitchenNotes?: boolean;
  boldItemQuantities?: boolean;
  separateCategorySections?: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface DbPrintJobRecord {
  id: string;
  printerId?: string;
  printerName: string;
  branchId: string;
  docType: ReceiptDocumentType;
  orderNumber?: string;
  bytesCount: number;
  transport: PrinterConnectionType;
  status: 'submitted' | 'transmitted' | 'failed' | 'cancelled';
  errorMessage?: string;
  createdAt: string;
  createdBy?: string;
}

// CR-31: Authoritative Fixed Asset Register (Segregated from Consumables)
export interface DbFixedAsset {
  id: string;
  assetTag: string; // e.g. "AST-GRA-OVEN-001"
  name: string;
  category: 'kitchen_equipment' | 'refrigeration' | 'power_generator' | 'pos_hardware' | 'furniture_fixture' | 'vehicle_fleet';
  branchId: string;
  locationDetails?: string;
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: string;
  purchaseDate: string;
  purchaseCost: number;
  currentValue: number;
  depreciationRatePct: number;
  status: 'operational' | 'maintenance_required' | 'decommissioned' | 'disposed';
  assignedToStaffId?: string;
  assignedToStaffName?: string;
  lastServiceDate?: string;
  nextServiceDueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Authoritative Customer-Facing Display & Operational Promotion Workflow
export interface DbPromotion {
  id: string;
  title: string;
  subtitle?: string;
  productId: string;
  productName: string;
  promotionType: 'discount_percentage' | 'fixed_price' | 'special_offer' | 'bundle';
  discountPercent?: number;
  specialPrice?: number;
  originalPrice: number;
  branches: string[];
  startDate: string;
  endDate?: string;
  badge?: string;
  badgeColor?: string;
  image?: string;
  status: 'draft' | 'published' | 'expired' | 'revoked';
  approvalStatus: 'pending_approval' | 'approved' | 'rejected' | 'revoked';
  createdByStaffId: string;
  createdByName: string;
  createdAt: string;
  approvedByStaffId?: string;
  approvedByName?: string;
  approvedAt?: string;
  revokedByStaffId?: string;
  revokedByName?: string;
  revokedAt?: string;
  revocationReason?: string;
}

export type { DbGatewayConfig, DbDatabase } from './databaseRootType.ts';
export * from './expenseClaimTypes.ts';

