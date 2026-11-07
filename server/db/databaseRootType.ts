import type {
  DbStaffAccount,
  DbSession,
  DbResetToken,
  DbAuditLog,
  DbTable,
  DbCheck,
  DbShift,
  DbCashMovement,
  DbRider,
  DbDeliveryTask,
  DbPrinterProfile,
  DbReceiptTemplate,
  DbPrintJobRecord,
  DbCmsContent,
  DbMenuCategory,
  DbProductItem,
  DbFixedAsset,
  DbExpenseClaim,
  ExpenseAttachment,
  DbPromotion,
} from './schemaTypes.ts';
import type { RoleDefinition } from '../../src/types/rbac.ts';
import type { SystemSettings } from './systemSettingsSchema.ts';

export interface DbGatewayConfig {
  termiiApiKey?: string;
  termiiSenderId?: string;
  termiiChannel?: 'generic' | 'dnd' | 'whatsapp';
  whatsappToken?: string;
  whatsappPhoneId?: string;
  whatsappWabaId?: string;
  webhookSecret?: string;
  defaultChannel: 'sms' | 'whatsapp' | 'both';
  autoAlerts: {
    orderConfirmation: boolean;
    kitchenPreparing: boolean;
    orderReady: boolean;
    dispatchEnRoute: boolean;
    deliveryCompleted: boolean;
    posReceipt: boolean;
  };
  liveGatewayMode: boolean;
}

export interface DbDatabase {
  version: number;
  staff: Record<string, DbStaffAccount>;
  sessions: Record<string, DbSession>;
  resetTokens: Record<string, DbResetToken>;
  auditLogs: DbAuditLog[];
  tables: Record<string, DbTable>;
  checks: Record<string, DbCheck>;
  orders: Record<string, any>;
  shifts: Record<string, DbShift>;
  cashMovements: DbCashMovement[];
  riders: Record<string, DbRider>;
  deliveryTasks: Record<string, DbDeliveryTask>;
  heldTickets: Record<string, any>;
  inventory: Record<string, any>;
  ledger: any[];
  requests: Record<string, any>;
  suppliers: Record<string, any>;
  purchaseOrders: Record<string, any>;
  goodsReceiptNotes: Record<string, any>;
  wastage: any[];
  stockCounts: Record<string, any>;
  recipes: Record<string, any>;
  productionBatches: Record<string, any>;
  reconciliations: any[];
  customerCareTickets: Record<string, any>;
  notifications: Record<string, any>;
  gatewayConfig?: DbGatewayConfig;
  customers: Record<string, any>;
  walletTransactions: any[];
  houseAccounts: Record<string, any>;
  houseAccountCharges: any[];
  houseAccountPayments: any[];
  cateringEvents: Record<string, any>;
  roles: Record<string, RoleDefinition>;
  branches: Record<string, any>;
  printers: Record<string, DbPrinterProfile>;
  receiptTemplates: Record<string, DbReceiptTemplate>;
  printJobs: DbPrintJobRecord[];
  cmsContent?: DbCmsContent;
  cmsDraft?: DbCmsContent;
  categories: Record<string, DbMenuCategory>;
  menuProducts: Record<string, DbProductItem>;
  paymentTransactions?: Record<string, any>;
  processedWebhookEvents?: Record<string, any>;
  refunds?: Record<string, any>;
  stockAlerts?: Record<string, any>;
  assets: Record<string, DbFixedAsset>;
  expenseClaims?: Record<string, DbExpenseClaim>;
  expenseAttachments?: Record<string, ExpenseAttachment>;
  settings?: SystemSettings;
  payrolls?: Record<string, any>;
  capexRequisitions?: Record<string, any>;
  supplierInvoices?: Record<string, any>;
  expenditureBudgets?: Record<string, any>;
  promotions: Record<string, DbPromotion>;
}

