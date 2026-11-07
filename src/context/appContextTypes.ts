import React from 'react';
import {
  Branch,
  BranchId,
  CartItem,
  CartCustomization,
  Product,
  Order,
  OrderType,
  Review,
  CateringEnquiry,
  OrderStatus,
  StaffUser,
  StaffRole,
  InventoryItem,
  AuditLog,
  RiderProfile,
  HeldTicket,
  AccountingSummary,
  POSPayment,
  CustomerProfile,
  SavedAddress,
  RewardPerk,
  OperationsTab,
} from '../types';

export const FREE_DELIVERY_THRESHOLD = 0;

export const DEFAULT_REWARD_PERKS: RewardPerk[] = [
  {
    id: 'perk-zobo',
    title: 'Free Chilled Zobo',
    pointsCost: 10,
    description: 'Every ₦1000 spent earns 1 Point. Redeem for free Zobo drink or Small Chops box!',
    freeProductId: 'prod-drink-zobo',
    badge: 'Signature',
  },
  {
    id: 'perk-chops',
    title: 'Free Small Chops Box',
    pointsCost: 20,
    description: 'Every ₦1000 spent earns 1 Point. Redeem for free Zobo drink or Small Chops box!',
    freeProductId: 'prod-sc-box-custom',
    badge: 'Most Popular',
  },
];

export const LOCAL_STORAGE_KEY_CART = 'choplife_cart_v1';
export const LOCAL_STORAGE_KEY_BRANCH = 'choplife_branch_v1';
export const LOCAL_STORAGE_KEY_ORDERS = 'choplife_orders_v1';
export const LOCAL_STORAGE_KEY_MENU = 'choplife_menu_cms_v1';
export const LOCAL_STORAGE_KEY_STAFF = 'choplife_staff_active_v1';
export const LOCAL_STORAGE_KEY_INVENTORY = 'choplife_inventory_v1';
export const LOCAL_STORAGE_KEY_RIDERS = 'choplife_riders_v1';
export const LOCAL_STORAGE_KEY_HELD_TICKETS = 'choplife_held_tickets_v1';
export const LOCAL_STORAGE_KEY_AUDIT = 'choplife_audit_logs_v1';
export const LOCAL_STORAGE_KEY_RECONCILIATION = 'choplife_reconciliation_v1';
export const LOCAL_STORAGE_KEY_CUSTOMER = 'choplife_customer_profile_v1';
export const OFFLINE_POS_QUEUE_KEY = 'choplife_offline_pos_queue';

export const DEFAULT_INITIAL_REVIEWS: Review[] = [];

export interface AppContextType {
  // Branches
  branches: Branch[];
  selectedBranchId: BranchId;
  currentBranch: Branch;
  setSelectedBranchId: (id: BranchId) => void;
  isSwitchingBranchModalOpen: boolean;
  setIsSwitchingBranchModalOpen: (open: boolean) => void;

  // Order Type & Delivery
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  selectedDeliveryZone: string;
  setSelectedDeliveryZone: (zone: string) => void;
  deliveryFee: number;

  // Menu & Products
  products: Product[];
  getProductPrice: (product: Product, branchId?: BranchId) => number;
  isProductAvailable: (productId: string, branchId?: BranchId) => boolean;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, customization?: CartCustomization, openDrawer?: boolean) => void;
  lastAddedToast: { productName: string; quantity: number; totalPrice: number } | null;
  setLastAddedToast: (toast: { productName: string; quantity: number; totalPrice: number } | null) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  cartPackagingFee: number;
  cartDiscount: number;
  appliedCoupon: string | null;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  cartTotal: number;
  amountAwayFromFreeDelivery: number;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;

  // Customer Account & Profile
  customerProfile: CustomerProfile;
  updateCustomerProfile: (profile: Partial<CustomerProfile>) => void;
  customerLogin: (name: string, phone: string, email?: string) => void;
  customerLogout: () => void;
  clearSavedCheckoutDetails: () => void;
  addSavedAddress: (addr: Omit<SavedAddress, 'id'>) => void;
  removeSavedAddress: (addressId: string) => void;
  loyaltyPoints: number;
  lifetimeSpent: number;
  redeemRewardPoints: (points: number, perkTitle: string) => boolean;

  // Product Shortlist / Saved Favourites
  shortlistedProductIds: string[];
  toggleShortlist: (productId: string) => void;
  isProductShortlisted: (productId: string) => boolean;
  clearShortlist: () => void;

  // Modals & Drawers
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  isSmallChopsBuilderOpen: boolean;
  setIsSmallChopsBuilderOpen: (open: boolean) => void;
  selectedProductForDetail: Product | null;
  setSelectedProductForDetail: (product: Product | null) => void;
  isCateringModalOpen: boolean;
  setIsCateringModalOpen: (open: boolean) => void;
  isAccountModalOpen: boolean;
  setIsAccountModalOpen: (open: boolean) => void;
  isAdminModalOpen: boolean;
  setIsAdminModalOpen: (open: boolean) => void;
  isAdminOpen: boolean;
  setIsAdminOpen: (open: boolean) => void;
  isLocationsModalOpen: boolean;
  setIsLocationsModalOpen: (open: boolean) => void;
  isReviewModalOpen: boolean;
  setIsReviewModalOpen: (open: boolean) => void;
  activeTrackingOrder: Order | null;
  setActiveTrackingOrder: (order: Order | null) => void;

  // Staff POS & Operations Modals
  operationsActiveTab: OperationsTab;
  setOperationsActiveTab: (tab: OperationsTab) => void;
  navigateToOperations: (tab?: OperationsTab) => void;
  isStaffPosOpen: boolean;
  setIsStaffPosOpen: (open: boolean) => void;
  isStaffLoginModalOpen: boolean;
  setIsStaffLoginModalOpen: (open: boolean) => void;
  isRiderPortalOpen: boolean;
  setIsRiderPortalOpen: (open: boolean) => void;
  isAiChatbotOpen: boolean;
  setIsAiChatbotOpen: (open: boolean) => void;

  // Staff & Auth
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
  staffUsers: StaffUser[];
  staffAccounts: StaffUser[];
  currentStaff: StaffUser | null;
  setCurrentStaff: (staff: StaffUser | null) => void;
  isStorefrontPreviewActive: boolean;
  setIsStorefrontPreviewActive: (val: boolean) => void;
  loginStaff: (emailOrStaffId: string, password: string) => Promise<{ success: boolean; error?: string; lockoutSeconds?: number; staff?: StaffUser }>;
  loginStaffWithPin: (pin: string, branchId?: string, staffId?: string) => Promise<{ success: boolean; error?: string; staff?: StaffUser }>;
  validateManagerOverride: (pin: string, action: string, reason?: string, checkId?: string) => Promise<{ authorized: boolean; error?: string; supervisor?: { id: string; name: string; role: string } }>;
  logoutStaff: () => Promise<void>;
  provisionAdmin: (data: { fullName: string; workEmail: string; phone?: string; password: string; branchId?: BranchId }) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string; resetToken?: string }>;
  completePasswordReset: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  fetchStaffAccounts: () => Promise<void>;
  createStaffAccount: (data: { staffId: string; name: string; workEmail: string; phone?: string; role: StaffRole; branchId: BranchId; initialPassword: string }) => Promise<{ success: boolean; error?: string }>;
  updateStaffAccount: (id: string, data: Partial<StaffUser>) => Promise<{ success: boolean; error?: string }>;
  resetStaffPassword: (id: string, temporaryPassword: string) => Promise<{ success: boolean; error?: string }>;
  revokeStaffSessions: (id: string) => Promise<{ success: boolean; error?: string }>;
  checkSystemProvisioned: () => Promise<{ isProvisioned: boolean; activeStaffCount: number }>;

  // Inventory Management
  inventoryItems: InventoryItem[];
  updateInventoryStock: (itemId: string, branchId: BranchId, newStock: number) => void;
  restockInventoryItem: (itemId: string, branchId: BranchId, addedAmount: number, notes?: string) => void;
  logWastageItem: (itemId: string, branchId: BranchId, quantity: number, reason: string, note: string) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;

  // Riders & Dispatch
  riders: RiderProfile[];
  assignRiderToOrder: (orderId: string, riderId: string) => void;
  updateRiderStatus: (riderId: string, status: 'available' | 'on_delivery' | 'offline') => void;
  updateRiderCashInHand: (riderId: string, amount: number) => void;

  // Held Tickets
  heldTickets: HeldTicket[];
  holdCurrentPOSTicket: (ticketName: string, items: CartItem[], branchId: BranchId, customerName?: string, tableNumber?: string) => void;
  restoreHeldTicket: (ticketId: string) => HeldTicket | undefined;
  deleteHeldTicket: (ticketId: string) => void;

  // Accounting & Reconciliations
  accountingReconciliations: AccountingSummary[];
  saveShiftReconciliation: (summary: AccountingSummary) => void;

  // Audit Logs
  auditLogs: AuditLog[];
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;

  // POS Order Creator
  createPOSOrder: (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'orderStatus' | 'estimatedDeliveryTimestamp'> & { posPayment?: POSPayment }) => Order;

  // Offline POS Queue & Sync
  offlineQueueCount: number;
  isOnline: boolean;
  syncOfflineQueue: () => Promise<{ success: boolean; syncedCount: number; error?: string }>;

  // Search & Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  activeDietaryFilter: 'all' | 'spicy' | 'veg' | 'deals';
  setActiveDietaryFilter: (filter: 'all' | 'spicy' | 'veg' | 'deals') => void;

  // Orders Management
  orders: Order[];
  createOrder: (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'orderStatus' | 'estimatedDeliveryTimestamp'> & { id?: string }) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  reorderPastOrder: (order: Order) => void;
  reorder: (order: Order) => void;
  reorderItem: (item: CartItem, branchId?: BranchId) => void;

  // Reviews
  reviews: Review[];
  addReview: (review: Omit<Review, 'id' | 'date'>) => void;

  // Catering
  cateringEnquiries: CateringEnquiry[];
  submitCateringEnquiry: (enquiry: Omit<CateringEnquiry, 'id' | 'createdAt' | 'status'>) => void;

  // WhatsApp helper
  getBranchWhatsAppUrl: (branchId?: BranchId, prefilledText?: string) => string;
  generateWhatsAppCartText: (items?: CartItem[], deliveryAddress?: string) => string;

  // Admin / CMS
  cmsContent: any;
  setCmsContent: (content: any) => void;
  refreshCmsContent: () => Promise<void>;
  refreshMenuProducts: () => Promise<void>;
  toggleProductStock: (productId: string, branchId: BranchId) => void;
  updateProductBranchPrice: (productId: string, branchId: BranchId, newPrice: number) => void;
  bulkImportMenu: (importedProducts: Product[]) => void;
  formatNaira: (amount: number | string | null | undefined) => string;
}
