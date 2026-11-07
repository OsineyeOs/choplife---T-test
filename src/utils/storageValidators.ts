/**
 * ChopLife LocalStorage Hardened Schemas & Safe Storage Recovery
 * Prevents malformed, incomplete, or corrupted localStorage items from causing render crashes,
 * and robustly handles SecurityError / QuotaExceededError in restricted iframe environments.
 */

import {
  BranchId,
  CartItem,
  Product,
  Order,
  InventoryItem,
  RiderProfile,
  HeldTicket,
  AuditLog,
  AccountingSummary,
  CustomerProfile,
  SavedAddress,
  DailySpecial,
  RewardHistoryItem,
} from '../types';
import { MASTER_PRODUCTS } from '../data/menu';
import {
  INITIAL_INVENTORY_ITEMS,
  INITIAL_RIDERS,
  INITIAL_AUDIT_LOGS,
} from '../data/operations';
import { INITIAL_DAILY_SPECIALS } from '../data/dailySpecials';

export const STORAGE_KEYS = {
  BRANCH: 'choplife_branch_v1',
  MENU: 'choplife_menu_cms_v1',
  CART: 'choplife_cart_v1',
  STAFF: 'choplife_staff_active_v1',
  STAFF_TOKEN: 'choplife_staff_token',
  INVENTORY: 'choplife_inventory_v1',
  RIDERS: 'choplife_riders_v1',
  HELD_TICKETS: 'choplife_held_tickets_v1',
  AUDIT: 'choplife_audit_logs_v1',
  RECONCILIATION: 'choplife_reconciliation_v1',
  ORDERS: 'choplife_orders_v1',
  CUSTOMER: 'choplife_customer_profile_v1',
  OFFLINE_QUEUE: 'choplife_offline_pos_queue',
  DAILY_SPECIALS: 'choplife_daily_specials_v1',
  REWARD_HISTORY: 'choplife_reward_history_v1',
} as const;

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch (err) {
    console.warn(`[STORAGE SANITIZER] SecurityError / restricted access reading key "${key}":`, err);
    return null;
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

function safeParseJSON<T>(raw: string | null, fallback: T, keyName: string): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch (err) {
    console.warn(`[STORAGE SANITIZER] Corrupt JSON detected in key "${keyName}". Discarding invalid payload:`, err);
    safeRemoveItem(keyName);
    return fallback;
  }
}

/**
 * Validates and retrieves the selected Branch ID
 */
export function safeGetBranch(): BranchId {
  const val = safeGetItem(STORAGE_KEYS.BRANCH);
  if (val === 'gra' || val === 'ugbowo' || val === 'okabere') {
    return val as BranchId;
  }
  return 'gra';
}

/**
 * Validates and retrieves the Products array
 */
export function safeGetProducts(): Product[] {
  const raw = safeGetItem(STORAGE_KEYS.MENU);
  const parsed = safeParseJSON<any>(raw, MASTER_PRODUCTS, STORAGE_KEYS.MENU);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return MASTER_PRODUCTS;
  }

  // Validate each product has required fields
  const validProducts = parsed.filter(
    (p) => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.price === 'number'
  );

  return validProducts.length > 0 ? validProducts : MASTER_PRODUCTS;
}

/**
 * Validates and retrieves the Cart array
 */
export function safeGetCart(): CartItem[] {
  const raw = safeGetItem(STORAGE_KEYS.CART);
  const parsed = safeParseJSON<any>(raw, [], STORAGE_KEYS.CART);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      item.product &&
      typeof item.quantity === 'number' &&
      item.quantity > 0
  );
}

export const DEFAULT_CUSTOMER_SAVED_ADDRESS: SavedAddress = {
  id: 'addr-default-gra',
  label: 'Home',
  address: '14 Boundary Road, GRA',
  deliveryZone: 'Boundary Road / GRA',
  isDefault: true,
};

/**
 * Canonical default customer profile
 */
export const DEFAULT_CUSTOMER_PROFILE: CustomerProfile = {
  id: 'cust-guest',
  name: '',
  phone: '',
  email: '',
  alternatePhone: '',
  defaultDeliveryNotes: '',
  rememberCheckoutDetails: true,
  shortlistedProductIds: [],
  preferredBranchId: 'gra',
  savedAddresses: [DEFAULT_CUSTOMER_SAVED_ADDRESS],
  isLoggedIn: false,
  pointsRedeemed: 0,
  joinedDate: new Date().toISOString(),
};

/**
 * Validates and retrieves the Customer Profile
 */
export function safeGetCustomerProfile(): CustomerProfile {
  const raw = safeGetItem(STORAGE_KEYS.CUSTOMER);
  const parsed = safeParseJSON<any>(raw, DEFAULT_CUSTOMER_PROFILE, STORAGE_KEYS.CUSTOMER);

  if (!parsed || typeof parsed !== 'object') {
    return DEFAULT_CUSTOMER_PROFILE;
  }

  // Reconcile and guarantee all required arrays and fields
  return {
    id: typeof parsed.id === 'string' ? parsed.id : 'cust-guest',
    name: typeof parsed.name === 'string' ? parsed.name : '',
    knownDisplayName: typeof parsed.knownDisplayName === 'string' ? parsed.knownDisplayName : '',
    phone: typeof parsed.phone === 'string' ? parsed.phone : '',
    email: typeof parsed.email === 'string' ? parsed.email : '',
    alternatePhone: typeof parsed.alternatePhone === 'string' ? parsed.alternatePhone : '',
    defaultDeliveryNotes: typeof parsed.defaultDeliveryNotes === 'string' ? parsed.defaultDeliveryNotes : '',
    rememberCheckoutDetails: typeof parsed.rememberCheckoutDetails === 'boolean' ? parsed.rememberCheckoutDetails : true,
    shortlistedProductIds: Array.isArray(parsed.shortlistedProductIds)
      ? parsed.shortlistedProductIds.filter((id: any) => typeof id === 'string')
      : [],
    sessionOrderIds: Array.isArray(parsed.sessionOrderIds)
      ? parsed.sessionOrderIds.filter((id: any) => typeof id === 'string')
      : [],
    preferredBranchId:
      parsed.preferredBranchId === 'gra' || parsed.preferredBranchId === 'ugbowo' || parsed.preferredBranchId === 'okabere'
        ? parsed.preferredBranchId
        : 'gra',
    savedAddresses: Array.isArray(parsed.savedAddresses)
      ? parsed.savedAddresses
      : DEFAULT_CUSTOMER_PROFILE.savedAddresses,
    isLoggedIn: Boolean(parsed.isLoggedIn),
    pointsRedeemed: typeof parsed.pointsRedeemed === 'number' && !isNaN(parsed.pointsRedeemed) ? parsed.pointsRedeemed : 0,
    joinedDate: typeof parsed.joinedDate === 'string' ? parsed.joinedDate : new Date().toISOString(),
  };
}

/**
 * Validates and retrieves the Customer Shortlist (Saved Product IDs)
 */
export function safeGetShortlist(): string[] {
  const raw = safeGetItem('choplife_shortlist_v1');
  if (!raw) {
    const profile = safeGetCustomerProfile();
    return profile.shortlistedProductIds || [];
  }
  const parsed = safeParseJSON<any>(raw, [], 'choplife_shortlist_v1');
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((id) => typeof id === 'string');
}

/**
 * Validates and retrieves Orders, guaranteeing valid CartItems and safe fallbacks
 */
export function safeGetOrders(): Order[] {
  const raw = safeGetItem(STORAGE_KEYS.ORDERS);
  const parsed = safeParseJSON<any>(raw, [], STORAGE_KEYS.ORDERS);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((o) => o && typeof o === 'object' && typeof o.id === 'string' && Array.isArray(o.items))
    .map((o) => {
      const sanitizedItems = (o.items || []).map((it: any) => {
        let prod = it.product;
        if (!prod || typeof prod !== 'object' || !prod.name) {
          const found = MASTER_PRODUCTS.find((p) => p.id === (it.productId || it.menuItemId));
          prod = found || {
            id: it.productId || it.id || 'prod-custom',
            name: it.name || 'Choplife Special',
            shortDescription: '',
            longDescription: '',
            category: 'small-chops',
            image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
            basePrice: it.price || it.unitPrice || 2000,
            branchAvailability: { okabere: true, gra: true, ugbowo: true },
            prepTimeMinutes: 10,
          };
        }
        return {
          ...it,
          id: it.id || `${prod.id}-${o.branchId || 'gra'}`,
          productId: prod.id,
          product: prod,
          quantity: typeof it.quantity === 'number' && it.quantity > 0 ? it.quantity : 1,
          unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : (it.price || prod.basePrice || 0),
        };
      });

      return {
        ...o,
        orderNumber: o.orderNumber || o.id.replace('order-', 'CL-'),
        orderStatus: o.orderStatus || 'received',
        branchId: o.branchId || 'gra',
        orderType: o.orderType || 'delivery',
        paymentMethod: o.paymentMethod || 'card',
        paymentStatus: o.paymentStatus || 'paid',
        items: sanitizedItems,
        subtotal: typeof o.subtotal === 'number' ? o.subtotal : (o.total || 0),
        total: typeof o.total === 'number' ? o.total : 0,
        deliveryFee: typeof o.deliveryFee === 'number' ? o.deliveryFee : 0,
        packagingFee: typeof o.packagingFee === 'number' ? o.packagingFee : 0,
        discount: typeof o.discount === 'number' ? o.discount : 0,
        createdAt: o.createdAt || new Date().toISOString(),
        deliveryDetails: o.deliveryDetails || {
          customerName: 'Choplife Guest',
          customerPhone: '',
          address: 'Benin City',
          deliveryZone: 'GRA',
        },
      };
    });
}

/**
 * Validates and retrieves Inventory Items
 */
export function safeGetInventory(): InventoryItem[] {
  const raw = safeGetItem(STORAGE_KEYS.INVENTORY);
  const parsed = safeParseJSON<any>(raw, INITIAL_INVENTORY_ITEMS, STORAGE_KEYS.INVENTORY);
  if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_INVENTORY_ITEMS;
  return parsed.filter((i) => i && typeof i === 'object' && typeof i.id === 'string' && typeof i.name === 'string');
}

/**
 * Validates and retrieves Riders
 */
export function safeGetRiders(): RiderProfile[] {
  const raw = safeGetItem(STORAGE_KEYS.RIDERS);
  const parsed = safeParseJSON<any>(raw, INITIAL_RIDERS, STORAGE_KEYS.RIDERS);
  if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_RIDERS;
  return parsed.filter((r) => r && typeof r === 'object' && typeof r.id === 'string');
}

/**
 * Validates and retrieves Held Tickets
 */
export function safeGetHeldTickets(): HeldTicket[] {
  const raw = safeGetItem(STORAGE_KEYS.HELD_TICKETS);
  const parsed = safeParseJSON<any>(raw, [], STORAGE_KEYS.HELD_TICKETS);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((h) => h && typeof h === 'object' && typeof h.id === 'string');
}

/**
 * Validates and retrieves Audit Logs
 */
export function safeGetAuditLogs(): AuditLog[] {
  const raw = safeGetItem(STORAGE_KEYS.AUDIT);
  const parsed = safeParseJSON<any>(raw, INITIAL_AUDIT_LOGS, STORAGE_KEYS.AUDIT);
  if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_AUDIT_LOGS;
  return parsed.filter((a) => a && typeof a === 'object' && typeof a.id === 'string');
}

/**
 * Validates and retrieves Accounting Reconciliations
 */
export function safeGetReconciliations(): AccountingSummary[] {
  const raw = safeGetItem(STORAGE_KEYS.RECONCILIATION);
  const parsed = safeParseJSON<any>(raw, [], STORAGE_KEYS.RECONCILIATION);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((r) => r && typeof r === 'object' && typeof r.shiftId === 'string');
}

/**
 * Validates and retrieves Daily Specials set by Admin
 */
export function safeGetDailySpecials(): DailySpecial[] {
  const raw = safeGetItem(STORAGE_KEYS.DAILY_SPECIALS);
  const parsed = safeParseJSON<any>(raw, INITIAL_DAILY_SPECIALS, STORAGE_KEYS.DAILY_SPECIALS);
  if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_DAILY_SPECIALS;
  return parsed.filter(
    (s) => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.day === 'string' && typeof s.specialPrice === 'number'
  );
}

/**
 * Validates and retrieves Reward History Items
 */
export function safeGetRewardHistory(): RewardHistoryItem[] {
  const raw = safeGetItem(STORAGE_KEYS.REWARD_HISTORY);
  const parsed = safeParseJSON<any>(raw, [], STORAGE_KEYS.REWARD_HISTORY);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((r) => r && typeof r === 'object' && typeof r.id === 'string' && typeof r.points === 'number');
}

