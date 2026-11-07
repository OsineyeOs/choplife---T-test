/**
 * Choplife Republic — System Settings Domain Schema & Canonical Defaults
 * Defines typed configuration models for Modules A through J:
 * - Financial, Payments, Tenders & Accounts
 * - Tax Groups, Surcharges, Limits & Reason Codes
 * - Outlet, Branch, Kitchen & Table Operations
 * - Menu Modifiers, Schedules & Image Audit
 * - Inventory, Suppliers, Conversions & Tolerances
 * - Loyalty Tiers, Accruals & House Accounts
 * - Staff Security, Password Policy & Lockouts
 * - Notifications, Providers & Message Templates
 * - Hardware, Peripherals & Customer-Facing Display
 * - QR Codes & Operational Integrations
 */

import {
  type ExpenseCategoryConfig,
  type ExpenseApprovalMatrixConfig,
  type QrCodeConfigItem,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EXPENSE_APPROVAL_MATRIX,
  DEFAULT_QR_CONFIGS,
} from './expenseClaimTypes.ts';

export interface PaymentMethodConfig {
  id: string;
  name: string;
  tenderType: 'cash' | 'pos_terminal' | 'bank_transfer' | 'online_gateway' | 'house_account' | 'loyalty_wallet';
  enabled: boolean;
  allowedChannels: ('dine_in' | 'pickup' | 'delivery' | 'catering')[];
  allowedBranches: string[];
  settlementAccountId?: string;
  processingFeePercent: number;
}

export interface SettlementAccountConfig {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  destinationType: 'commercial_bank' | 'mobile_money' | 'fintech';
  schedule: 'same_day_evening' | 'next_day_t1' | 'weekly_batch';
  isDefault: boolean;
  reconciliationThresholdNaira: number;
}

export interface PosTerminalConfig {
  id: string;
  label: string;
  branchId: string;
  terminalProvider: string;
  serialNumber: string;
  active: boolean;
}

export interface TaxGroupConfig {
  id: string;
  name: string;
  ratePercent: number;
  isExempt: boolean;
  isDefault: boolean;
  description: string;
}

export interface ReasonCodeConfig {
  id: string;
  category: 'void' | 'refund' | 'wastage' | 'discount' | 'stock_adjustment' | 'no_charge';
  code: string;
  label: string;
  requiresSupervisorPin: boolean;
  active: boolean;
}

export interface SystemSettings {
  version: number;
  updatedAt: string;
  updatedBy: string;

  financial: {
    paymentMethods: PaymentMethodConfig[];
    settlementAccounts: SettlementAccountConfig[];
    posTerminals: PosTerminalConfig[];
    paystackConfig: {
      mode: 'sandbox' | 'live';
      webhookEnforced: boolean;
      autoReconcile: boolean;
      secretKeyConfigured: boolean;
      publicKeyConfigured: boolean;
    };
    accountingMappings: {
      cashOnHandAccount: string;
      posClearingAccount: string;
      bankSettlementAccount: string;
      gatewayClearingAccount: string;
      salesRevenueAccount: string;
      vatPayableAccount: string;
      houseReceivablesAccount: string;
      discountContraAccount: string;
      inventoryAssetAccount: string;
      cogsAccount: string;
    };
    commissionPlans: {
      inHouseDeliveryPercent: number;
      thirdPartyLogisticsPercent: number;
      cateringAgentPercent: number;
    };
  };

  tax: {
    taxGroups: TaxGroupConfig[];
    taxInclusivePricing: boolean;
    defaultVatRatePercent: number;
    extraCharges: {
      packagingFeeDefault: number;
      dineInServiceChargePercent: number;
      deliveryServiceChargePercent: number;
    };
    discountControls: {
      cashierMaxDiscountPercent: number;
      managerMaxDiscountPercent: number;
      requireSupervisorPinAbovePercent: number;
      allowCompoundDiscounts: boolean;
    };
    controlledReasons: ReasonCodeConfig[];
    noChargeAccounts: {
      dailyStaffMealAllowanceNaira: number;
      managementTastingLimitNaira: number;
      authorisedRoles: string[];
    };
  };

  operations: {
    branchSchedules: Record<
      string,
      {
        openTime: string;
        closeTime: string;
        staffOpenTime?: string;
        staffCloseTime?: string;
        operatingDays?: string[];
        closedDays?: string[];
        timeZone?: string;
        deliveryEnabled: boolean;
        pickupEnabled: boolean;
        dineInEnabled: boolean;
        cateringEnabled: boolean;
        isOperational: boolean;
        bakeryHours?: string;
        deliveryHours?: string;
      }
    >;
    serviceAreas: string[];
    diningCourses: string[];
    kitchenStations: { id: string; name: string; stationType: string }[];
  };

  inventory: {
    poApprovalThresholdNaira: number;
    stockCountFrequency: 'daily' | 'weekly' | 'monthly';
    varianceTolerancePercent: number;
    unitConversions: { fromUnit: string; toUnit: string; factor: number }[];
  };

  loyalty: {
    earningRateNaira: number;
    redemptionValuePerPointNaira: number;
    tiers: { name: string; minPoints: number; discountPercent: number }[];
    houseAccountCreditLimitDefault: number;
    dataRetentionDays: number;
  };

  security: {
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireNumber: boolean;
      requireSpecialChar: boolean;
    };
    sessionTimeoutMinutes: {
      pos: number;
      admin: number;
    };
    maxFailedLoginAttempts: number;
    lockoutDurationMinutes: number;
    supervisorOverridePinEnabled: boolean;
  };

  hardware: {
    defaultPaperWidth: '80mm' | '58mm';
    autoCutReceipts: boolean;
    customerDisplayMode: 'idle_branding' | 'live_split' | 'bill_total';
    customerDisplayWelcomeText: string;
  };

  notifications: {
    smsProvider: 'termii';
    emailProvider: 'resend';
    whatsappProvider: 'meta_cloud';
    senderId: string;
    autoAlerts: {
      orderConfirmation: boolean;
      kitchenPreparing: boolean;
      orderReady: boolean;
      dispatchEnRoute: boolean;
      deliveryCompleted: boolean;
      lowStockWarning: boolean;
    };
    templates: { id: string; event: string; channel: 'sms' | 'email'; body: string }[];
  };

  qrcodes?: QrCodeConfigItem[];

  expenses?: {
    categories: ExpenseCategoryConfig[];
    approvalMatrix: ExpenseApprovalMatrixConfig;
  };
}

export const CANONICAL_DEFAULT_SETTINGS: SystemSettings = {
  version: 1,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system-bootstrap',

  financial: {
    paymentMethods: [
      {
        id: 'pm-cash',
        name: 'Cash Payment',
        tenderType: 'cash',
        enabled: true,
        allowedChannels: ['dine_in', 'pickup', 'delivery', 'catering'],
        allowedBranches: ['gra', 'okabere', 'ugbowo'],
        processingFeePercent: 0,
      },
      {
        id: 'pm-pos-terminal',
        name: 'In-Store POS Terminal (Card)',
        tenderType: 'pos_terminal',
        enabled: true,
        allowedChannels: ['dine_in', 'pickup', 'catering'],
        allowedBranches: ['gra', 'okabere', 'ugbowo'],
        processingFeePercent: 0.5,
      },
      {
        id: 'pm-bank-transfer',
        name: 'Direct Bank Transfer',
        tenderType: 'bank_transfer',
        enabled: true,
        allowedChannels: ['dine_in', 'pickup', 'delivery', 'catering'],
        allowedBranches: ['gra', 'okabere', 'ugbowo'],
        processingFeePercent: 0,
      },
      {
        id: 'pm-paystack',
        name: 'Paystack Online Checkout',
        tenderType: 'online_gateway',
        enabled: true,
        allowedChannels: ['pickup', 'delivery', 'catering'],
        allowedBranches: ['gra', 'okabere', 'ugbowo'],
        processingFeePercent: 1.5,
      },
      {
        id: 'pm-loyalty-wallet',
        name: 'Citizen Loyalty Wallet',
        tenderType: 'loyalty_wallet',
        enabled: true,
        allowedChannels: ['dine_in', 'pickup', 'delivery'],
        allowedBranches: ['gra', 'okabere', 'ugbowo'],
        processingFeePercent: 0,
      },
      {
        id: 'pm-house-ar',
        name: 'Corporate House Account',
        tenderType: 'house_account',
        enabled: true,
        allowedChannels: ['dine_in', 'catering'],
        allowedBranches: ['gra', 'okabere', 'ugbowo'],
        processingFeePercent: 0,
      },
    ],
    settlementAccounts: [
      {
        id: 'settle-moniepoint-ops',
        bankName: 'Moniepoint Microfinance Bank',
        accountNumber: '8158177897',
        accountName: 'Choplife Republic Operations',
        destinationType: 'fintech',
        schedule: 'same_day_evening',
        isDefault: true,
        reconciliationThresholdNaira: 100,
      },
      {
        id: 'settle-providus-main',
        bankName: 'Providus Bank PLC',
        accountNumber: '1100234567',
        accountName: 'Choplife Republic Limited',
        destinationType: 'commercial_bank',
        schedule: 'next_day_t1',
        isDefault: false,
        reconciliationThresholdNaira: 50,
      },
    ],
    posTerminals: [
      {
        id: 'term-gra-01',
        label: 'GRA Front Cashier POS 1',
        branchId: 'gra',
        terminalProvider: 'Moniepoint Smart POS',
        serialNumber: 'MP-GRA-9901',
        active: true,
      },
      {
        id: 'term-gra-02',
        label: 'GRA VIP Bar POS 2',
        branchId: 'gra',
        terminalProvider: 'Moniepoint Smart POS',
        serialNumber: 'MP-GRA-9902',
        active: true,
      },
      {
        id: 'term-oka-01',
        label: 'Okabere Front Counter POS 1',
        branchId: 'okabere',
        terminalProvider: 'Moniepoint Smart POS',
        serialNumber: 'MP-OKA-8801',
        active: true,
      },
      {
        id: 'term-ugb-01',
        label: 'Ugbowo Express Counter POS 1',
        branchId: 'ugbowo',
        terminalProvider: 'Moniepoint Smart POS',
        serialNumber: 'MP-UGB-7701',
        active: true,
      },
    ],
    paystackConfig: {
      mode: 'sandbox',
      webhookEnforced: true,
      autoReconcile: true,
      secretKeyConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
      publicKeyConfigured: Boolean(process.env.VITE_PAYSTACK_PUBLIC_KEY),
    },
    accountingMappings: {
      cashOnHandAccount: '1010',
      posClearingAccount: '1020',
      bankSettlementAccount: '1030',
      gatewayClearingAccount: '1040',
      salesRevenueAccount: '4010',
      vatPayableAccount: '2200',
      houseReceivablesAccount: '1100',
      discountContraAccount: '4090',
      inventoryAssetAccount: '1200',
      cogsAccount: '5010',
    },
    commissionPlans: {
      inHouseDeliveryPercent: 0,
      thirdPartyLogisticsPercent: 15,
      cateringAgentPercent: 5,
    },
  },

  tax: {
    taxGroups: [
      {
        id: 'tax-vat-std',
        name: 'Standard Nigerian VAT',
        ratePercent: 7.5,
        isExempt: false,
        isDefault: true,
        description: 'Standard 7.5% Value Added Tax on dining and packaged foods',
      },
      {
        id: 'tax-exempt',
        name: 'Zero-Rated / Exempt',
        ratePercent: 0,
        isExempt: true,
        isDefault: false,
        description: 'Unprocessed raw agricultural staples and certified food ingredients',
      },
    ],
    taxInclusivePricing: true,
    defaultVatRatePercent: 7.5,
    extraCharges: {
      packagingFeeDefault: 500,
      dineInServiceChargePercent: 0,
      deliveryServiceChargePercent: 0,
    },
    discountControls: {
      cashierMaxDiscountPercent: 10,
      managerMaxDiscountPercent: 30,
      requireSupervisorPinAbovePercent: 10,
      allowCompoundDiscounts: false,
    },
    controlledReasons: [
      { id: 'rs-v1', category: 'void', code: 'GUEST_CANCEL', label: 'Guest Changed Mind Before Kitchen Prep', requiresSupervisorPin: false, active: true },
      { id: 'rs-v2', category: 'void', code: 'ENTRY_ERROR', label: 'Cashier Input Mistake', requiresSupervisorPin: true, active: true },
      { id: 'rs-r1', category: 'refund', code: 'DOUBLE_PAY', label: 'Customer Double Debited on Card', requiresSupervisorPin: true, active: true },
      { id: 'rs-r2', category: 'refund', code: 'ITEM_86', label: 'Dish Ran Out During Rush', requiresSupervisorPin: true, active: true },
      { id: 'rs-w1', category: 'wastage', code: 'BURNT_GRILL', label: 'Charcoal Flare-Up / Overcooked Protein', requiresSupervisorPin: true, active: true },
      { id: 'rs-w2', category: 'wastage', code: 'PREP_SPILL', label: 'Counter Spillage or Dropped Plate', requiresSupervisorPin: false, active: true },
      { id: 'rs-d1', category: 'discount', code: 'STAFF_MEAL', label: 'Approved Staff Duty Meal', requiresSupervisorPin: true, active: true },
      { id: 'rs-d2', category: 'discount', code: 'PROMO_VIP', label: 'Executive / Brand Partner Courtesy', requiresSupervisorPin: true, active: true },
    ],
    noChargeAccounts: {
      dailyStaffMealAllowanceNaira: 3500,
      managementTastingLimitNaira: 15000,
      authorisedRoles: ['super_admin', 'corporate_admin', 'branch_manager', 'kitchen_lead'],
    },
  },

  operations: {
    branchSchedules: {
      gra: {
        openTime: '08:00',
        closeTime: '19:00',
        staffOpenTime: '07:00',
        staffCloseTime: '19:00',
        operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        closedDays: [],
        timeZone: 'Africa/Lagos',
        deliveryEnabled: true,
        pickupEnabled: true,
        dineInEnabled: true,
        cateringEnabled: true,
        isOperational: true,
        bakeryHours: '07:30–19:00',
        deliveryHours: '08:00–17:00',
      },
      okabere: {
        openTime: '08:00',
        closeTime: '21:00',
        staffOpenTime: '06:30',
        staffCloseTime: '21:00',
        operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        closedDays: [],
        timeZone: 'Africa/Lagos',
        deliveryEnabled: true,
        pickupEnabled: true,
        dineInEnabled: true,
        cateringEnabled: false,
        isOperational: true,
        bakeryHours: '08:00–20:30',
        deliveryHours: '08:00–17:00',
      },
      ugbowo: {
        openTime: '08:00',
        closeTime: '18:00',
        staffOpenTime: '07:00',
        staffCloseTime: '18:00',
        operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        closedDays: ['sunday'],
        timeZone: 'Africa/Lagos',
        deliveryEnabled: true,
        pickupEnabled: true,
        dineInEnabled: true,
        cateringEnabled: false,
        isOperational: true,
        bakeryHours: '08:00–18:00',
        deliveryHours: '08:00–17:00',
      },
    },
    serviceAreas: ['Main Dining Hall', 'VIP Lounge', 'Terrace Patio', 'Takeaway Counter'],
    diningCourses: ['Starters & Small Chops', 'Main Course', 'Grills & Barbecue', 'Drinks & Desserts'],
    kitchenStations: [
      { id: 'st-grill', name: 'Charcoal Barbecue & Suya Pit', stationType: 'grill' },
      { id: 'st-fryer', name: 'Small Chops & Pastry Fryer', stationType: 'fryer' },
      { id: 'st-rice', name: 'Party Jollof & Hot Soups Station', stationType: 'stove' },
      { id: 'st-bar', name: 'Beverage & Mocktail Dispense', stationType: 'bar' },
    ],
  },

  inventory: {
    poApprovalThresholdNaira: 100000,
    stockCountFrequency: 'weekly',
    varianceTolerancePercent: 2.0,
    unitConversions: [
      { fromUnit: 'kg', toUnit: 'g', factor: 1000 },
      { fromUnit: 'l', toUnit: 'ml', factor: 1000 },
      { fromUnit: 'crate', toUnit: 'bottle', factor: 24 },
      { fromUnit: 'pack', toUnit: 'wrap', factor: 50 },
    ],
  },

  loyalty: {
    earningRateNaira: 1000,
    redemptionValuePerPointNaira: 10,
    tiers: [
      { name: 'Bronze Citizen', minPoints: 0, discountPercent: 0 },
      { name: 'Silver Citizen', minPoints: 25, discountPercent: 2 },
      { name: 'Gold Republic Citizen', minPoints: 50, discountPercent: 5 },
      { name: 'Platinum VIP Citizen', minPoints: 100, discountPercent: 10 },
    ],
    houseAccountCreditLimitDefault: 250000,
    dataRetentionDays: 730,
  },

  security: {
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireNumber: true,
      requireSpecialChar: true,
    },
    sessionTimeoutMinutes: {
      pos: 480,
      admin: 60,
    },
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    supervisorOverridePinEnabled: true,
  },

  hardware: {
    defaultPaperWidth: '80mm',
    autoCutReceipts: true,
    customerDisplayMode: 'live_split',
    customerDisplayWelcomeText: 'Welcome to Choplife Republic! 100% Maximum Enjoyment',
  },

  notifications: {
    smsProvider: 'termii',
    emailProvider: 'resend',
    whatsappProvider: 'meta_cloud',
    senderId: 'CHOPLIFE',
    autoAlerts: {
      orderConfirmation: true,
      kitchenPreparing: true,
      orderReady: true,
      dispatchEnRoute: true,
      deliveryCompleted: true,
      lowStockWarning: true,
    },
    templates: [
      {
        id: 'tmpl-order-confirmed',
        event: 'order_confirmed',
        channel: 'sms',
        body: 'Choplife Republic: Your order #{{order_number}} ({{total_amount}}) is confirmed at {{branch_name}}! Prep in progress.',
      },
      {
        id: 'tmpl-dispatch-enroute',
        event: 'dispatch_enroute',
        channel: 'sms',
        body: 'Choplife Republic: Order #{{order_number}} is on the way! Rider {{rider_name}} will arrive shortly.',
      },
      {
        id: 'tmpl-low-stock',
        event: 'low_stock_warning',
        channel: 'email',
        body: 'URGENT INVENTORY NOTICE: Stock for {{item_name}} has fallen to {{current_stock}} at {{location_name}} (Threshold: {{reorder_point}}).',
      },
    ],
  },

  qrcodes: DEFAULT_QR_CONFIGS,

  expenses: {
    categories: DEFAULT_EXPENSE_CATEGORIES,
    approvalMatrix: DEFAULT_EXPENSE_APPROVAL_MATRIX,
  },
};

