export type BranchId = 'okabere' | 'gra' | 'ugbowo';

export interface Branch {
  id: BranchId;
  name: string;
  shortName: string;
  tagline: string;
  address: string;
  landmark: string;
  city: string;
  phone: string;
  whatsappNumber: string;
  whatsappCatalogueUrl: string;
  openingHours: string;
  dineInHours: string;
  deliveryHours: string;
  bakeryHours?: string;
  staffHours?: string;
  isOpen: boolean;
  estimatedDeliveryTime: string;
  deliveryFeeBase: number;
  deliveryZones: {
    name: string;
    fee: number;
    estimatedMins: string;
  }[];
  googleMapsUrl: string;
  latitude?: number;
  longitude?: number;
  features: string[];
  image: string;
  rating: number;
  totalReviews: number;
}

export type MenuCategoryId =
  | 'favourites'
  | 'deals'
  | 'food'
  | 'protein'
  | 'snacks'
  | 'drinks'
  | 'small-chops'
  | 'bakery'
  | 'packaging'
  | 'events'
  | 'rice-meals'
  | 'shawarma'
  | 'grills'
  | 'fast-food'
  | 'bites-snacks'
  | 'soups-swallows'
  | 'desserts'
  | 'party-packs'
  | 'qsr'
  | 'meat'
  | 'pastries'
  | 'beverages';

export interface MenuCategory {
  id: MenuCategoryId;
  name: string;
  tag: string;
  description: string;
  icon: string;
  badge?: string;
}

export interface ProductOptionChoice {
  id: string;
  name: string;
  priceDelta: number; // in Naira (₦)
  isDefault?: boolean;
}

export interface ProductOptionGroup {
  id: string;
  name: string;
  required: boolean;
  maxSelect?: number;
  choices: ProductOptionChoice[];
}

export interface ProductAddOn {
  id: string;
  name: string;
  price: number; // in Naira (₦)
  category?: string;
}

export interface Product {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: MenuCategoryId;
  subcategory?: string;
  image: string;
  basePrice: number;
  price?: number;
  // Branch-specific price overrides if any
  branchPrices?: Partial<Record<BranchId, number>>;
  // Branch availability (true = in stock, false = sold out at this branch)
  branchAvailability: Record<BranchId, boolean>;
  prepTimeMinutes: number;
  isPopular?: boolean;
  isFeatured?: boolean;
  isNewProduct?: boolean;
  isSpicy?: boolean;
  isVegetarian?: boolean;
  packagingCharge?: number;
  channels?: ('website' | 'pos')[];
  status?: 'published' | 'draft' | 'paused' | 'archived';
  productType?: 'standard' | 'combo' | 'platter' | 'package' | 'promotion';
  compositionVersion?: number;
  components?: Array<{
    productId: string;
    name: string;
    productName?: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    category?: string;
  }>;
  packaging?: {
    productId: string;
    name: string;
    quantity: number;
  };
  discountConfig?: {
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
  };
  wholesalePricing?: {
    enabled: boolean;
    retailPrice?: number;
    wholesalePrice: number;
    minQuantity: number;
    minWholesaleQty?: number;
    allowSkuPooling?: boolean;
    poolingGroup?: string;
    tiers?: Array<{ minQuantity: number; unitPrice: number; label?: string }>;
    allowedBranches?: string[];
    allowedChannels?: ('website' | 'pos')[];
    effectiveStartDate?: string;
    effectiveEndDate?: string;
    preventExtraDiscount?: boolean;
  };
  promotionRules?: {
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
  };
  optionGroups?: ProductOptionGroup[];
  availableAddOns?: ProductAddOn[];
  suggestedUpsells?: string[]; // Product IDs
  isWholesale?: boolean;
  minOrderQty?: number;
  wholesaleUnitPrice?: number;
}

export interface CartCustomization {
  selectedOptions?: {
    groupId: string;
    groupName: string;
    choiceId: string;
    choiceName: string;
    priceDelta: number;
    name?: string;
    choice?: string;
  }[];
  selectedAddOns?: {
    id?: string;
    addOnId?: string;
    name: string;
    price: number;
    quantity?: number;
  }[];
  specialInstructions?: string;
  smallChopsBoxItems?: {
    item: string;
    count: number;
  }[];
}

export interface CartItem {
  id: string; // Unique cart item ID (hashes product + customizations)
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  customization?: CartCustomization;
  branchId: BranchId;
}

export type OrderType = 'delivery' | 'pickup' | 'dine-in';

export type PaymentMethod = 'card' | 'bank_transfer' | 'cash_on_delivery' | 'pos_on_delivery' | 'cash' | 'pos_terminal';

export type OrderStatus =
  | 'received'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderDeliveryDetails {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: string;
  deliveryZone: string;
  landmark?: string;
  alternatePhone?: string;
  deliveryNotes?: string;
  deliveryInstructions?: string;
  preparationNotes?: string;
  specialOccasionNote?: string;
  specialOccasionDisclaimerAccepted?: boolean;
  scheduledTime?: string; // "ASAP" or scheduled date/time
  orderType?: OrderType;
  specialInstructions?: string;
  tableNumber?: string;
  isGiftOrder?: boolean;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  giftMessage?: string;
  senderName?: string;
  hideSenderIdentity?: boolean;
}

export interface Order {
  id: string; // e.g. "CL-89241"
  orderNumber: string;
  branchId: BranchId;
  orderType: OrderType;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  packagingFee: number;
  discount: number;
  appliedCouponCode?: string;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'reconciliation_required' | 'paid' | 'failed' | 'refunded';
  orderStatus: OrderStatus;
  createdAt: string;
  estimatedDeliveryTimestamp: string;
  deliveryDetails: OrderDeliveryDetails;
  riderName?: string;
  riderPhone?: string;
  riderLocation?: { lat: number; lng: number };
  orderChannel: 'website' | 'whatsapp' | 'chowdeck' | 'walk-in' | 'phone';
  tableNumber?: string;
  specialInstructions?: string;
}

export interface Review {
  id: string;
  orderId?: string;
  customerName: string;
  branchId: BranchId;
  ratingOverall: number;
  ratingFood: number;
  ratingPackaging: number;
  ratingDelivery: number;
  comment: string;
  date: string;
  verified: boolean;
}

export interface CateringEnquiry {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  eventType: 'wedding' | 'birthday' | 'corporate' | 'get_together' | 'burial_reception' | 'other';
  eventDate: string;
  guestCount: number;
  venueLocation: string;
  budgetRange: string;
  foodPreferences: string[];
  additionalNotes: string;
  createdAt: string;
  status: 'new' | 'contacted' | 'quoted' | 'confirmed' | 'closed';
}

export interface ComboComponent {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface Deal {
  id: string;
  title: string;
  badge: string;
  tagline: string;
  components?: ComboComponent[];
  originalPrice: number;
  dealPrice: number;
  savings: number;
  image: string;
  itemsIncluded: string[];
  description: string;
  isPopular?: boolean;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DailySpecial {
  id: string;
  day: DayOfWeek;
  dayName: string;
  theme: string;
  tagline: string;
  badge: string;
  productId: string;
  name: string;
  description: string;
  originalPrice: number;
  specialPrice: number;
  discountPercent: number;
  image: string;
  availableBranches: BranchId[];
  servingsTotal: number;
  servingsRemaining: number;
  prepTimeMinutes: number;
  includedItems: string[];
  isActive: boolean;
  updatedBy: string;
  updatedAt: string;
}
