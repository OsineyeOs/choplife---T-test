import React, { useState, useEffect } from 'react';
import {
  BranchId,
  CartCustomization,
  CartItem,
  CateringEnquiry,
  CustomerProfile,
  Order,
  OrderStatus,
  OrderType,
  Product,
  Review,
  SavedAddress,
} from '../types';
import { buildReorderHandlers } from './cartReorderHelpers';
import {
  safeGetCart,
  safeGetCustomerProfile,
  safeGetOrders,
  safeGetShortlist,
} from '../utils/storageValidators';
import {
  DEFAULT_INITIAL_REVIEWS,
  LOCAL_STORAGE_KEY_CART,
  LOCAL_STORAGE_KEY_CUSTOMER,
  LOCAL_STORAGE_KEY_ORDERS,
} from './appContextTypes';
import { evaluateBranchOperatingStatus } from '../utils/branchScheduling';

export interface CustomerAndCartSliceArgs {
  selectedBranchId: BranchId;
  setSelectedBranchId: (id: BranchId) => void;
  orderType: OrderType;
  deliveryFee: number;
  products: Product[];
  getProductPrice: (product: Product, branchId?: BranchId) => number;
  isProductAvailable: (productId: string, branchId?: BranchId) => boolean;
  setIsCartOpen: (open: boolean) => void;
  activeTrackingOrder: Order | null;
  setActiveTrackingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
}

export function useCustomerAndCartSlice({
  selectedBranchId,
  setSelectedBranchId,
  orderType,
  deliveryFee,
  products,
  getProductPrice,
  isProductAvailable,
  setIsCartOpen,
  activeTrackingOrder,
  setActiveTrackingOrder,
}: CustomerAndCartSliceArgs) {
  const [cart, setCart] = useState<CartItem[]>(() => safeGetCart());
  const [lastAddedToast, setLastAddedToast] = useState<{ productName: string; quantity: number; totalPrice: number } | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>(() => safeGetOrders());
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile>(() => safeGetCustomerProfile());
  const [shortlistedProductIds, setShortlistedProductIds] = useState<string[]>(() => safeGetShortlist());

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOMER, JSON.stringify(customerProfile));
    } catch {}
  }, [customerProfile]);

  useEffect(() => {
    try {
      localStorage.setItem('choplife_shortlist_v1', JSON.stringify(shortlistedProductIds));
    } catch {}
  }, [shortlistedProductIds]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CART, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(orders));
    } catch {}
  }, [orders]);

  const toggleShortlist = (productId: string) => {
    setShortlistedProductIds((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      setCustomerProfile((cp) => ({ ...cp, shortlistedProductIds: next }));
      return next;
    });
  };

  const isProductShortlisted = (productId: string): boolean => shortlistedProductIds.includes(productId);

  const clearShortlist = () => {
    setShortlistedProductIds([]);
    setCustomerProfile((cp) => ({ ...cp, shortlistedProductIds: [] }));
  };

  // Strict Rule: ₦1,000 qualifying net spend = 1 Point; excludes cancelled/refunded orders and delivery fees
  const qualifyingOrders = orders.filter(
    (o) => (o as any).status !== 'cancelled' && (o as any).paymentStatus !== 'refunded'
  );
  const lifetimeSpent = qualifyingOrders.reduce((sum, o) => sum + o.total, 0);
  const totalQualifyingSpend = qualifyingOrders.reduce((sum, o) => {
    const netSpend =
      o.subtotal && o.subtotal > 0
        ? Math.max(0, o.subtotal - (o.discount || 0))
        : Math.max(0, o.total - (o.deliveryFee || 0) - (o.discount || 0));
    return sum + netSpend;
  }, 0);
  const totalEarnedPoints = Math.floor(totalQualifyingSpend / 1000);
  const loyaltyPoints = Math.max(0, totalEarnedPoints - (customerProfile.pointsRedeemed || 0));

  const updateCustomerProfile = (updates: Partial<CustomerProfile>) => {
    setCustomerProfile((prev) => {
      const next = {
        ...prev,
        ...updates,
        knownDisplayName:
          updates.knownDisplayName !== undefined
            ? updates.knownDisplayName
            : updates.name
            ? updates.name
            : prev.knownDisplayName,
      };
      try {
        const cleanPhone = (next.phone || '').replace(/\D/g, '').slice(-10);
        if (cleanPhone.length >= 8 && next.rememberCheckoutDetails !== false) {
          const rawVault = localStorage.getItem('choplife_customer_vault_v1');
          const vault = rawVault ? JSON.parse(rawVault) : {};
          vault[cleanPhone] = {
            id: next.id,
            name: next.name,
            email: next.email,
            alternatePhone: next.alternatePhone,
            defaultDeliveryNotes: next.defaultDeliveryNotes,
            savedAddresses: next.savedAddresses,
            sessionOrderIds: next.sessionOrderIds,
            preferredBranchId: next.preferredBranchId,
          };
          localStorage.setItem('choplife_customer_vault_v1', JSON.stringify(vault));
        }
      } catch {}
      return next;
    });
  };

  const customerLogin = (name: string, phone: string, email?: string) => {
    const cleanNewPhone = phone.replace(/\D/g, '');
    const phoneKey = cleanNewPhone.slice(-10);
    setCustomerProfile((prev) => {
      const cleanPrevPhone = (prev.phone || '').replace(/\D/g, '');
      const isDifferentPhone = Boolean(cleanPrevPhone && phoneKey !== cleanPrevPhone.slice(-10));

      let vaulted: any = null;
      try {
        const rawVault = localStorage.getItem('choplife_customer_vault_v1');
        if (rawVault && phoneKey.length >= 8) {
          const vault = JSON.parse(rawVault);
          vaulted = vault?.[phoneKey] || null;
        }
      } catch {}

      const matchingPastOrders = orders.filter((o) => {
        const oPhone = (o.deliveryDetails?.customerPhone || '').replace(/\D/g, '');
        return oPhone.length >= 8 && oPhone.slice(-10) === phoneKey;
      });
      const latestOrderDetails = matchingPastOrders[0]?.deliveryDetails;

      const resolvedName =
        name.trim() ||
        vaulted?.name ||
        latestOrderDetails?.customerName ||
        (!isDifferentPhone ? prev.name || prev.knownDisplayName : '') ||
        'Choplife Citizen';

      const resolvedAddresses: SavedAddress[] =
        !isDifferentPhone && prev.savedAddresses && prev.savedAddresses.length > 0
          ? prev.savedAddresses
          : Array.isArray(vaulted?.savedAddresses) && vaulted.savedAddresses.length > 0
          ? vaulted.savedAddresses
          : latestOrderDetails?.address
          ? [
              {
                id: `addr-restored-${Date.now()}`,
                label: 'Home',
                address: latestOrderDetails.address,
                deliveryZone: latestOrderDetails.deliveryZone || 'Airport Road',
                landmark: latestOrderDetails.landmark,
                isDefault: true,
              },
            ]
          : [];

      const resolvedSessionOrders = Array.from(
        new Set([
          ...(!isDifferentPhone ? prev.sessionOrderIds || [] : []),
          ...(Array.isArray(vaulted?.sessionOrderIds) ? vaulted.sessionOrderIds : []),
          ...matchingPastOrders.map((o) => o.id),
        ])
      );

      const nextProfile: CustomerProfile = {
        ...prev,
        id:
          vaulted?.id ||
          (prev.id === 'cust-guest' || isDifferentPhone ? `cust-${Date.now().toString(36)}` : prev.id),
        name: resolvedName,
        knownDisplayName: resolvedName,
        phone,
        email: email || vaulted?.email || latestOrderDetails?.customerEmail || (isDifferentPhone ? '' : prev.email),
        alternatePhone:
          vaulted?.alternatePhone || latestOrderDetails?.alternatePhone || (isDifferentPhone ? '' : prev.alternatePhone),
        defaultDeliveryNotes:
          vaulted?.defaultDeliveryNotes ||
          latestOrderDetails?.deliveryNotes ||
          (isDifferentPhone ? '' : prev.defaultDeliveryNotes),
        savedAddresses: resolvedAddresses,
        sessionOrderIds: resolvedSessionOrders,
        rememberCheckoutDetails: true,
        isLoggedIn: true,
      };

      try {
        if (phoneKey.length >= 8) {
          const rawVault = localStorage.getItem('choplife_customer_vault_v1');
          const vault = rawVault ? JSON.parse(rawVault) : {};
          vault[phoneKey] = {
            id: nextProfile.id,
            name: nextProfile.name,
            email: nextProfile.email,
            alternatePhone: nextProfile.alternatePhone,
            defaultDeliveryNotes: nextProfile.defaultDeliveryNotes,
            savedAddresses: nextProfile.savedAddresses,
            sessionOrderIds: nextProfile.sessionOrderIds,
            preferredBranchId: nextProfile.preferredBranchId,
          };
          localStorage.setItem('choplife_customer_vault_v1', JSON.stringify(vault));
        }
      } catch {}

      return nextProfile;
    });
  };

  const customerLogout = () => {
    setCustomerProfile((prev) => {
      try {
        const cleanPhone = (prev.phone || '').replace(/\D/g, '').slice(-10);
        if (cleanPhone.length >= 8 && prev.rememberCheckoutDetails !== false) {
          const rawVault = localStorage.getItem('choplife_customer_vault_v1');
          const vault = rawVault ? JSON.parse(rawVault) : {};
          vault[cleanPhone] = {
            id: prev.id,
            name: prev.name,
            email: prev.email,
            alternatePhone: prev.alternatePhone,
            defaultDeliveryNotes: prev.defaultDeliveryNotes,
            savedAddresses: prev.savedAddresses,
            sessionOrderIds: prev.sessionOrderIds,
            preferredBranchId: prev.preferredBranchId,
          };
          localStorage.setItem('choplife_customer_vault_v1', JSON.stringify(vault));
        }
      } catch {}
      return {
        ...prev,
        knownDisplayName:
          prev.rememberCheckoutDetails !== false ? prev.name || prev.knownDisplayName || '' : '',
        name: '',
        phone: '',
        email: '',
        alternatePhone: '',
        defaultDeliveryNotes: '',
        savedAddresses: [],
        sessionOrderIds: [],
        isLoggedIn: false,
      };
    });
  };

  const clearSavedCheckoutDetails = () => {
    try {
      localStorage.removeItem('choplife_customer_vault_v1');
    } catch {}
    setCustomerProfile((prev) => ({
      ...prev,
      knownDisplayName: '',
      name: '',
      phone: '',
      email: '',
      alternatePhone: '',
      defaultDeliveryNotes: '',
      savedAddresses: [],
      sessionOrderIds: [],
      rememberCheckoutDetails: false,
      isLoggedIn: false,
    }));
  };

  const addSavedAddress = (newAddr: Omit<SavedAddress, 'id'>) => {
    const normalizedAddr = newAddr.address.trim().toLowerCase();
    setCustomerProfile((prev) => {
      const exists = prev.savedAddresses.some(
        (a) => a.address.trim().toLowerCase() === normalizedAddr && a.deliveryZone === newAddr.deliveryZone
      );
      if (exists) return prev;
      const addrWithId: SavedAddress = {
        ...newAddr,
        id: `addr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      };
      return {
        ...prev,
        savedAddresses: [addrWithId, ...prev.savedAddresses],
      };
    });
  };

  const removeSavedAddress = (addressId: string) => {
    setCustomerProfile((prev) => ({
      ...prev,
      savedAddresses: prev.savedAddresses.filter((a) => a.id !== addressId),
    }));
  };

  const redeemRewardPoints = (points: number, _perkTitle: string): boolean => {
    if (loyaltyPoints < points) return false;
    setCustomerProfile((prev) => ({
      ...prev,
      pointsRedeemed: (prev.pointsRedeemed || 0) + points,
    }));
    return true;
  };

  const [reviews, setReviews] = useState<Review[]>(() => {
    try {
      const saved = localStorage.getItem('choplife_customer_reviews');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_INITIAL_REVIEWS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('choplife_customer_reviews', JSON.stringify(reviews));
    } catch {}
  }, [reviews]);

  const [cateringEnquiries, setCateringEnquiries] = useState<CateringEnquiry[]>([]);

  const addToCart = (product: Product, quantity = 1, customization?: CartCustomization, openDrawer = false) => {
    if (!isProductAvailable(product.id, selectedBranchId)) return;

    let resolvedCustomization = customization;
    if (product.optionGroups && product.optionGroups.length > 0 && !resolvedCustomization?.selectedOptions?.length) {
      const defaultSelectedOptions = product.optionGroups
        .map((group) => {
          const defChoice = group.choices.find((c) => c.isDefault) || group.choices[0];
          if (!defChoice) return null;
          return {
            groupId: group.id,
            groupName: group.name,
            choiceId: defChoice.id,
            choiceName: defChoice.name,
            priceDelta: defChoice.priceDelta || 0,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
      if (defaultSelectedOptions.length > 0) {
        resolvedCustomization = {
          ...resolvedCustomization,
          selectedOptions: defaultSelectedOptions,
        };
      }
    }

    const unitBasePrice = getProductPrice(product, selectedBranchId);
    let optionsDelta = 0;
    if (resolvedCustomization?.selectedOptions) {
      optionsDelta += resolvedCustomization.selectedOptions.reduce((acc, opt) => acc + opt.priceDelta, 0);
    }
    if (resolvedCustomization?.selectedAddOns) {
      optionsDelta += resolvedCustomization.selectedAddOns.reduce((acc, add) => acc + add.price, 0);
    }
    const finalUnitPrice = unitBasePrice + optionsDelta;

    const customizationKey = resolvedCustomization ? JSON.stringify(resolvedCustomization) : '';
    const cartItemId = `${product.id}-${selectedBranchId}-${customizationKey}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === cartItemId);
      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [
        ...prev,
        {
          id: cartItemId,
          productId: product.id,
          product,
          quantity,
          unitPrice: finalUnitPrice,
          customization: resolvedCustomization,
          branchId: selectedBranchId,
        },
      ];
    });

    setLastAddedToast({
      productName: product.name,
      quantity,
      totalPrice: finalUnitPrice * quantity,
    });

    if (openDrawer) {
      setIsCartOpen(true);
    }
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const updateCartQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === cartItemId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const cartPackagingFee = (() => {
    if (cart.length === 0 || orderType === 'dine-in') return 0;
    const standaloneFoodCategories = new Set(['qsr', 'grills', 'proteins', 'sides', 'soups-swallows']);
    let standaloneFoodPortions = 0;
    for (const item of cart) {
      const p = item.product;
      if (!p) continue;
      if (p.packaging || p.productType === 'package' || p.productType === 'combo' || p.productType === 'platter') {
        continue;
      }
      if (standaloneFoodCategories.has(String(p.category || '').toLowerCase())) {
        standaloneFoodPortions += Math.max(0, Number(item.quantity) || 0);
      }
    }
    return standaloneFoodPortions > 0 ? Math.ceil(standaloneFoodPortions / 4) * 400 : 0;
  })();
  const cartDiscount = 0;
  const effectiveDeliveryFee = orderType === 'delivery' ? deliveryFee : 0;
  const cartTotal = Math.max(0, cartSubtotal + effectiveDeliveryFee + cartPackagingFee - cartDiscount);
  const amountAwayFromFreeDelivery = 0;

  const applyCoupon = (_code: string) => ({
    success: false,
    message: 'Discount codes and promotional coupons are coming soon.',
  });

  const removeCoupon = () => setAppliedCoupon(null);

  const createOrder = (
    orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'orderStatus' | 'estimatedDeliveryTimestamp'> & {
      id?: string;
    }
  ): Order => {
    // Validate branch operating hours: reject if branch is closed for customer ordering
    const branchStatus = evaluateBranchOperatingStatus(orderData.branchId);
    if (!branchStatus.isOpen) {
      throw new Error(`Branch Closed: ${branchStatus.reason} ${branchStatus.nextOpenNotice || ''}`);
    }

    // Revalidate cart items at checkout: reject any item that became paused, archived or inactive
    for (const it of orderData.items) {
      const pId = it.productId || it.product?.id;
      if (pId && !pId.startsWith('catering-')) {
        const p = products.find((prod) => prod.id === pId);
        if (!p || (p.status && p.status !== 'published') || (p as any).isActive === false) {
          const itemLabel = p?.name || it.product?.name || 'Item';
          throw new Error(`Item "${itemLabel}" is currently inactive/archived and unavailable for purchase.`);
        }
      }
    }

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = orderData.id && orderData.id.startsWith('CL-') ? orderData.id : `CL-${randomNum}`;
    const existingDuplicate = orders.find((o) => o.id === orderNumber || o.orderNumber === orderNumber);
    if (existingDuplicate) {
      return existingDuplicate;
    }
    const newOrder: Order = {
      ...orderData,
      paymentStatus: 'pending',
      id: orderNumber,
      orderNumber,
      createdAt: new Date().toISOString(),
      orderStatus: 'received',
      estimatedDeliveryTimestamp: new Date(Date.now() + 1000 * 60 * 35).toISOString(),
    };

    setOrders((prev) => [newOrder, ...prev]);
    setCustomerProfile((prev) => {
      if (prev.rememberCheckoutDetails === false) return prev;
      const existingIds = Array.isArray(prev.sessionOrderIds) ? prev.sessionOrderIds : [];
      return {
        ...prev,
        sessionOrderIds: [orderNumber, ...existingIds],
      };
    });
    setActiveTrackingOrder(newOrder);
    clearCart();

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: orderNumber,
        branchId: orderData.branchId,
        orderType: orderData.orderType,
        items: orderData.items.map((it) => ({
          id: it.id,
          productId: it.productId || it.product?.id,
          menuItemId: it.productId || it.product?.id,
          name: it.product?.name,
          quantity: it.quantity,
          price: it.unitPrice,
          unitPrice: it.unitPrice,
          totalPrice: it.unitPrice * it.quantity,
          notes: it.customization?.specialInstructions || '',
        })),
        subtotal: orderData.subtotal,
        deliveryFee: orderData.deliveryFee,
        packagingFee: orderData.packagingFee,
        discount: orderData.discount,
        total: orderData.total,
        paymentMethod: orderData.paymentMethod,
        paymentStatus: 'pending',
        deliveryDetails: {
          customerName: orderData.deliveryDetails?.customerName || '',
          customerPhone: orderData.deliveryDetails?.customerPhone || '',
          customerEmail: orderData.deliveryDetails?.customerEmail || '',
          deliveryAddress: orderData.deliveryDetails?.address || '',
          deliveryZone: orderData.deliveryDetails?.deliveryZone || '',
          landmark: orderData.deliveryDetails?.landmark || '',
          deliveryNotes: orderData.deliveryDetails?.deliveryNotes || '',
          scheduledTime: orderData.deliveryDetails?.scheduledTime || '',
        },
        orderChannel: 'web_storefront',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.order) {
          const authoritativeStatus = data.order.paymentStatus === 'paid' ? 'paid' : 'pending';
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderNumber
                ? { ...o, orderNumber: data.order.orderNumber || o.orderNumber, paymentStatus: authoritativeStatus }
                : o
            )
          );
          setActiveTrackingOrder((prev) =>
            prev && prev.id === orderNumber
              ? { ...prev, orderNumber: data.order.orderNumber || prev.orderNumber, paymentStatus: authoritativeStatus }
              : prev
          );
        }
      })
      .catch((err) => {
        console.error('[ORDER SYNC ERROR]', err);
      });

    return newOrder;
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, orderStatus: status } : ord))
    );
    if (activeTrackingOrder && activeTrackingOrder.id === orderId) {
      setActiveTrackingOrder((prev) => (prev ? { ...prev, orderStatus: status } : null));
    }
  };

  const { reorderPastOrder, reorderItem } = buildReorderHandlers({
    selectedBranchId,
    setSelectedBranchId,
    products,
    getProductPrice,
    isProductAvailable,
    setCart,
    addToCart,
    setLastAddedToast,
    setIsCartOpen,
  });

  const addReview = (reviewData: Omit<Review, 'id' | 'date'>) => {
    const newReview: Review = {
      ...reviewData,
      id: `rev-${Date.now()}`,
      date: 'Just now',
    };
    setReviews((prev) => [newReview, ...prev]);
  };

  const submitCateringEnquiry = (enquiryData: Omit<CateringEnquiry, 'id' | 'createdAt' | 'status'>) => {
    const newEnquiry: CateringEnquiry = {
      ...enquiryData,
      id: `cat-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'new',
    };
    setCateringEnquiries((prev) => [newEnquiry, ...prev]);
  };

  return {
    cart,
    setCart,
    addToCart,
    lastAddedToast,
    setLastAddedToast,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartCount,
    cartSubtotal,
    cartPackagingFee,
    cartDiscount,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    cartTotal,
    effectiveDeliveryFee,
    amountAwayFromFreeDelivery,
    orders,
    setOrders,
    createOrder,
    updateOrderStatus,
    reorderPastOrder,
    reorderItem,
    customerProfile,
    updateCustomerProfile,
    customerLogin,
    customerLogout,
    clearSavedCheckoutDetails,
    addSavedAddress,
    removeSavedAddress,
    loyaltyPoints,
    lifetimeSpent,
    redeemRewardPoints,
    shortlistedProductIds,
    toggleShortlist,
    isProductShortlisted,
    clearShortlist,
    reviews,
    addReview,
    cateringEnquiries,
    submitCateringEnquiry,
  };
}
