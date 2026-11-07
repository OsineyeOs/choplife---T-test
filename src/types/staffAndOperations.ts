import { BranchId, CartItem } from './catalogAndOrders';

export type OperationsTab =
  | 'pos'
  | 'tables'
  | 'kds'
  | 'dispatch'
  | 'inventory'
  | 'reconciliation'
  | 'shifts'
  | 'reports'
  | 'staff'
  | 'customercare'
  | 'notifications'
  | 'catering'
  | 'audit'
  | 'loyalty_vip'
  | 'cms'
  | 'menu_catalog'
  | 'settings'
  | 'expenses'
  | 'payroll'
  | 'enterprise_reports';

export type StaffRole =
  | 'super_admin'
  | 'corporate_admin'
  | 'branch_manager'
  | 'store_manager'
  | 'cashier'
  | 'receptionist'
  | 'customer_service'
  | 'kitchen'
  | 'kitchen_lead'
  | 'accountant'
  | 'storekeeper'
  | 'auditor'
  | 'dispatch_manager'
  | 'internal_rider'
  | 'external_rider'
  | 'rider'
  | 'content_editor'
  | 'menu_manager'
  | 'admin';

export interface StaffUser {
  id: string;
  staffId?: string;
  name: string;
  workEmail?: string;
  role: StaffRole;
  branchId: BranchId;
  phone: string;
  status?: 'active' | 'suspended';
  isActive?: boolean;
  avatar?: string;
  dateOfBirth?: string;
}

export interface StaffPayrollProfile {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: 'active' | 'suspended';
  effectiveDate: string;
}

export interface StaffAccount {
  id: string;
  staffId: string;
  name: string;
  workEmail: string;
  role: StaffRole;
  branchId: BranchId;
  phone: string;
  status: 'active' | 'suspended';
  payrollProfile?: StaffPayrollProfile;
  createdAt?: string;
  updatedAt?: string;
}

export interface POSPayment {
  method: 'cash' | 'bank_transfer' | 'pos_terminal' | 'split' | 'online_paystack';
  cashTendered?: number;
  changeDue?: number;
  bankTransferRef?: string;
  posTerminalRrn?: string;
  splitCashAmount?: number;
  splitPosAmount?: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  staffName: string;
  staffRole: string;
  branchId: BranchId;
  actionType:
    | 'ORDER_CREATED'
    | 'STATUS_CHANGED'
    | 'PAYMENT_CONFIRMED'
    | 'STOCK_MODIFIED'
    | 'PRICE_CHANGED'
    | 'DISCOUNT_APPLIED'
    | 'ITEM_86ED'
    | 'EOD_RECONCILED'
    | 'REFUND_ISSUED'
    | 'RIDER_ASSIGNED'
    | 'STAFF_CREATED'
    | 'STAFF_MODIFIED'
    | 'STAFF_SUSPENDED'
    | 'STAFF_ACTIVATED'
    | 'PASSWORD_RESET'
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'LOGOUT'
    | 'SESSION_REVOKED'
    | 'ORDER_SYNC'
    | 'STOCK_WASTED'
    | 'INVENTORY_ITEM_CREATED';
  details: string;
  metadata?: Record<string, any>;
}

export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  type: 'internal_fleet' | 'external_partner';
  partnerName?: string; // e.g. "Choplife Fleet" or "Chowdeck" / "Gokada" / "Max.ng"
  bikeNumber?: string;
  currentStatus: 'available' | 'on_delivery' | 'offline';
  status?: 'available' | 'on_delivery' | 'offline';
  totalDeliveriesToday: number;
  cashInHand: number;
}

export interface HeldTicket {
  id: string;
  ticketName: string;
  customerName?: string;
  tableNumber?: string;
  items: CartItem[];
  createdAt: string;
  branchId: BranchId;
  note?: string;
}

export interface AccountingSummary {
  branchId: BranchId;
  date: string;
  grossSales: number;
  totalOrders: number;
  cashSales: number;
  transferSales: number;
  posSales: number;
  onlineSales: number;
  packagingCollected: number;
  deliveryFeesCollected: number;
  discountsGiven: number;
  declaredCashInTill: number;
  cashVariance: number;
  reconciledBy?: string;
  reconciledAt?: string;
}

export type NotificationChannel = 'sms' | 'whatsapp';

export type NotificationEventType =
  | 'ORDER_CONFIRMATION'
  | 'KITCHEN_PREPARING'
  | 'ORDER_READY'
  | 'DISPATCH_EN_ROUTE'
  | 'DELIVERY_COMPLETED'
  | 'MANUAL_ALERT'
  | 'PAYMENT_RECEIVED';

export interface CustomerNotification {
  id: string;
  orderId?: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  channel: NotificationChannel;
  provider: 'termii' | 'twilio' | 'whatsapp_cloud_api';
  eventType: NotificationEventType;
  recipient: string;
  message: string;
  status: 'delivered' | 'sent' | 'failed';
  timestamp: string;
  costNaira: number;
  metadata?: Record<string, any>;
  branchId?: BranchId | string;
}

export interface NotificationEngineStats {
  totalSent: number;
  smsCount: number;
  whatsappCount: number;
  totalCostNaira: number;
  deliveryRate: string;
  gateways: {
    termii: { status: string; balanceUnits: number; currency: string };
    whatsappCloudApi: { status: string; tier: string };
  };
}
