import { BranchId } from './catalogAndOrders';
import { StaffRole } from './staffAndOperations';

export type InventoryLocationId = 'general_store' | 'gra' | 'okabere' | 'ugbowo';

export type InventoryCategory =
  | 'proteins'
  | 'ingredients'
  | 'spices'
  | 'packaging'
  | 'beverages'
  | 'bakery_raw'
  | 'dairy_sauces'
  | 'snacks'
  | 'bakery';

export type InventoryItemType =
  | 'raw_material'
  | 'semi_finished'
  | 'finished_good'
  | 'packaging'
  | 'consumable';

export type StorageArea =
  | 'dry_store'
  | 'cold_storage'
  | 'freezer'
  | 'packaging_bay'
  | 'beverage_cellar'
  | 'bakery_prep'
  | 'kitchen_line'
  | 'bakery_rack';

export interface LocationStockSetting {
  stockOnHand: number;
  availableStock: number;
  reservedStock: number;
  minThreshold: number;
  parLevel: number;
  reorderLevel: number;
  reorderQuantity: number;
  unitCost: number;
  lastRestocked?: string;
  lastCounted?: string;
  alertEnabled?: boolean;
  preferredAlertChannel?: 'email' | 'sms' | 'both' | 'in_app';
  recipientOverrides?: string[];
}

export type StockAlertStatus =
  | 'normal'
  | 'threshold_reached'
  | 'alert_sent'
  | 'alert_failed'
  | 'provider_unconfigured'
  | 'restocked_reset';

export interface StockAlertStateRecord {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  locationId: InventoryLocationId;
  unit: string;
  currentQuantity: number;
  reorderPoint: number;
  minimumStockLevel: number;
  preferredReorderQuantity: number;
  alertEnabled: boolean;
  preferredChannel: 'email' | 'sms' | 'both' | 'in_app';
  status: StockAlertStatus;
  severity: 'ok' | 'low_stock' | 'critical_out_of_stock';
  lastTriggeredAt?: string;
  lastNotifiedAt?: string;
  lastResetAt?: string;
  deliveryChannelSummary?: {
    inAppCreated: boolean;
    smsStatus: 'delivered' | 'simulated_sandbox' | 'provider_unconfigured' | 'failed' | 'skipped';
    emailStatus: 'delivered' | 'simulated_sandbox' | 'provider_unconfigured' | 'failed' | 'skipped';
    errorMessage?: string;
  };
  supplierName?: string;
}

export interface InventoryItem {
  id: string; // Stable internal ID e.g. "inv-protein-chicken-quarter"
  sku?: string; // e.g. "SKU-PROT-001"
  barcode?: string;
  name: string;
  description?: string;
  category: InventoryCategory;
  subcategory?: string;
  inventoryType?: InventoryItemType;
  storageArea?: StorageArea;

  // Units & Conversions
  baseUnit?: string; // e.g. "kg", "pcs", "litre", "pack"
  purchaseUnit?: string; // e.g. "bag (50kg)", "carton (12pcs)", "crate (30pcs)"
  purchaseUnitFactor?: number; // e.g. 50 (1 bag = 50 kg)
  recipeUnit?: string; // e.g. "g", "ml", "pcs"
  recipeUnitFactor?: number; // e.g. 0.001 (1g = 0.001 kg)

  // Status Flags
  isActive?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  archivedByStaffId?: string;
  isSellable?: boolean;
  isPurchasable?: boolean;
  isProductionItem?: boolean;
  isPackagingItem?: boolean;
  alertEnabled?: boolean;
  preferredAlertChannel?: 'email' | 'sms' | 'both' | 'in_app';

  // Demo / Data Origin Flags
  isDemo?: boolean;
  dataOrigin?: 'operational' | 'demo';
  demoBatchId?: string;

  // Costing & Pricing
  costPerUnit: number; // In Naira (₦) per baseUnit
  lastPurchaseCost?: number;
  sellingPrice?: number;
  preferredSupplierId?: string;

  // Stock balances across all locations (including General Store)
  locationStock?: Partial<Record<InventoryLocationId, LocationStockSetting>> | Record<string, any>;

  // Legacy / convenience mappings for backward compatibility
  unit: string;
  currentStock?: Partial<Record<BranchId | 'general_store', number>> | Record<string, number>;
  minThreshold?: Partial<Record<BranchId | 'general_store', number>> | Record<string, number>;
  parLevel?: number;
  reorderLevel?: number;
  reorderQuantity?: number;

  linkedProductIds?: string[];
  lastRestocked?: string;
  notes?: string;

  // Audit timestamps & staff
  createdAt?: string;
  updatedAt?: string;
  createdByStaffId?: string;
  createdByName?: string;
  updatedByStaffId?: string;
  updatedByName?: string;
}

export type TransactionType =
  | 'PURCHASE_RECEIPT' // GRN from Supplier
  | 'TRANSFER_OUT'     // Dispatched from Source Location
  | 'TRANSFER_IN'      // Received at Destination Location
  | 'TRANSFER_IN_TRANSIT'
  | 'POS_DEPLETION'    // Automatic recipe deduction from POS sale
  | 'ONLINE_ORDER_DEPLETION' // Automatic recipe deduction from web order
  | 'WASTAGE'          // Spoilage, damaged, burnt, expired
  | 'ADJUSTMENT_INCREASE' // Audit correction / cycle count reconciliation
  | 'ADJUSTMENT_DECREASE'
  | 'PHYSICAL_COUNT_VARIANCE'
  | 'PRODUCTION_INPUT' // Raw ingredients consumed for commissary prep
  | 'PRODUCTION_OUTPUT'; // Finished/semi-finished goods produced

export interface StockLedgerTransaction {
  id: string; // e.g. "tx-98241"
  referenceNo: string; // e.g. "GRN-000124", "TR-000083", "POS-000912", "WST-000042"
  timestamp: string;
  date: string;
  itemId: string;
  itemName: string;
  sku: string;
  sourceLocation?: InventoryLocationId;
  destinationLocation?: InventoryLocationId;
  locationId: InventoryLocationId; // Primary location for this ledger entry
  transactionType: TransactionType;
  quantityDelta: number; // Positive (+) for additions, negative (-) for depletions
  unit: string;
  unitCost: number;
  totalValue: number;
  balanceBefore: number;
  balanceAfter: number;
  performedByStaffId: string;
  performedByName: string;
  performedByRole: StaffRole;
  reasonCategory?: string;
  notes?: string;
  orderId?: string;
  transferId?: string;
  poId?: string;
  grnId?: string;
}

export type StockRequestStatus =
  | 'draft'
  | 'requested'
  | 'reviewed'
  | 'partially_approved'
  | 'approved'
  | 'rejected'
  | 'issued'
  | 'in_transit'
  | 'partially_received'
  | 'received'
  | 'completed';

export interface StockRequestItem {
  itemId: string;
  itemName: string;
  sku: string;
  unit: string;
  requestedQty: number;
  approvedQty?: number;
  issuedQty?: number;
  receivedQty?: number;
  outstandingQty: number;
  sourceAvailableQty: number;
  destinationCurrentQty: number;
  notes?: string;
}

export interface StockRequest {
  id: string; // e.g. "req-1725283921"
  requestNumber: string; // e.g. "IND-000245"
  sourceLocation: InventoryLocationId; // Typically 'general_store'
  destinationLocation: InventoryLocationId; // Branch requesting (e.g. 'ugbowo')
  requestedByStaffId: string;
  requestedByName: string;
  requestedAt: string;
  priority: 'low' | 'normal' | 'urgent';
  items: StockRequestItem[];
  status: StockRequestStatus;

  // Approval
  approvedByStaffId?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;

  // Dispatch / Issuance
  issuedByStaffId?: string;
  issuedByName?: string;
  issuedAt?: string;
  dispatchNote?: string;

  // Receiving
  receivedByStaffId?: string;
  receivedByName?: string;
  receivedAt?: string;
  receivingNotes?: string;
}

export interface Supplier {
  id: string; // e.g. "supp-001"
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  categoriesSupplied: InventoryCategory[];
  paymentTerms: 'cash_on_delivery' | 'net_7' | 'net_15' | 'net_30';
  leadTimeDays: number;
  bankAccountDetails?: string;
  status: 'active' | 'preferred' | 'suspended';
  rating: number;
  notes?: string;
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent_to_supplier'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export interface PurchaseOrderItem {
  itemId: string;
  itemName: string;
  sku: string;
  purchaseUnit: string;
  conversionFactor: number;
  orderQuantity: number; // in purchaseUnit
  baseQuantity: number;  // in baseUnit
  agreedUnitPrice: number; // Price per purchaseUnit
  totalCost: number;
  receivedQuantity?: number;
}

export interface PurchaseOrder {
  id: string; // e.g. "po-1725283921"
  poNumber: string; // e.g. "PO-000124"
  supplierId: string;
  supplierName: string;
  destinationLocation: InventoryLocationId; // 'general_store' or branch
  orderDate: string;
  expectedDeliveryDate: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  totalAmount: number;
  status: PurchaseOrderStatus;
  createdByStaffId: string;
  createdByName: string;
  approvedByStaffId?: string;
  approvedByName?: string;
  approvedAt?: string;
  notes?: string;
}

export interface GoodsReceiptNoteItem {
  itemId: string;
  itemName: string;
  sku: string;
  orderedQty: number;
  deliveredQty: number;
  acceptedQty: number;
  rejectedQty: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  rejectionReason?: 'damaged' | 'expired' | 'incorrect_item' | 'bad_temperature' | 'shortage';
  batchNumber?: string;
  expiryDate?: string;
}

export interface GoodsReceiptNote {
  id: string; // e.g. "grn-1725283921"
  grnNumber: string; // e.g. "GRN-000124"
  poId?: string;
  poNumber?: string;
  supplierId: string;
  supplierName: string;
  receivingLocation: InventoryLocationId;
  receivedAt: string;
  receivedByStaffId: string;
  receivedByName: string;
  supplierInvoiceNumber?: string;
  invoiceAmountDeclared?: number;
  actualAcceptedValue: number;
  priceDiscrepancyFlag: boolean;
  items: GoodsReceiptNoteItem[];
  notes?: string;
  status: 'verified' | 'disputed' | 'cancelled';
}

export type WastageReason =
  | 'spoilage_rot'
  | 'damaged_in_storage'
  | 'burnt_preparation_error'
  | 'expired_past_shelf_life'
  | 'overproduction_unsold'
  | 'returned_by_customer'
  | 'quality_control_reject'
  | 'staff_sampling_training';

export interface WastageRecord {
  id: string; // e.g. "wst-1725283921"
  referenceNo: string; // e.g. "WA-000042"
  itemId: string;
  itemName: string;
  sku: string;
  locationId: InventoryLocationId;
  quantity: number;
  unit: string;
  unitCost: number;
  totalLossValue: number;
  reason: WastageReason;
  customNote?: string;
  loggedByStaffId: string;
  loggedByName: string;
  loggedByRole: StaffRole;
  timestamp: string;
  approvedByStaffId?: string;
  approvedByName?: string;
}

export interface StockAdjustment {
  id: string; // e.g. "adj-1725283921"
  referenceNo: string; // e.g. "ADJ-000019"
  itemId: string;
  itemName: string;
  sku: string;
  locationId: InventoryLocationId;
  adjustmentType: 'increase' | 'decrease';
  quantityDelta: number;
  unit: string;
  previousBalance: number;
  newBalance: number;
  reasonCode: 'count_reconciliation' | 'spillage_correction' | 'found_stock' | 'system_sync_fix' | 'other';
  notes: string;
  performedByStaffId: string;
  performedByName: string;
  timestamp: string;
  requiresSupervisorApproval: boolean;
  approvedByStaffId?: string;
}

export interface StockCountLine {
  itemId: string;
  itemName: string;
  sku: string;
  storageArea: StorageArea;
  unit: string;
  systemExpectedQty: number;
  physicalCountedQty: number;
  varianceQty: number;
  unitCost: number;
  varianceValue: number; // positive = surplus, negative = deficit
  isRecounted?: boolean;
  notes?: string;
}

export interface StockCountSession {
  id: string; // e.g. "count-1725283921"
  referenceNo: string; // e.g. "PHY-000033"
  locationId: InventoryLocationId;
  storageAreaFilter?: StorageArea | 'all';
  categoryFilter?: InventoryCategory | 'all';
  startedAt: string;
  completedAt?: string;
  conductedByStaffId: string;
  conductedByName: string;
  status: 'in_progress' | 'submitted' | 'approved_reconciled' | 'cancelled';
  lines: StockCountLine[];
  totalExpectedValue: number;
  totalCountedValue: number;
  totalVarianceValue: number;
  reconciledByStaffId?: string;
  reconciledByName?: string;
  reconciledAt?: string;
}

export * from './recipesAndProduction';

