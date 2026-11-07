import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  BranchId,
  CartItem,
  Order,
  OrderType,
  Product,
  OperationsTab,
} from '../types';
import { BRANCHES } from '../data/branches';
import { safeGetBranch, safeGetProducts } from '../utils/storageValidators';
import {
  AppContextType,
  FREE_DELIVERY_THRESHOLD,
  DEFAULT_REWARD_PERKS,
  LOCAL_STORAGE_KEY_BRANCH,
  LOCAL_STORAGE_KEY_MENU,
} from './appContextTypes';
import { useStaffAuthSlice } from './useStaffAuthSlice';
import { useCustomerAndCartSlice } from './useCustomerAndCartSlice';
import { usePosAndInventorySlice } from './usePosAndInventorySlice';

export { FREE_DELIVERY_THRESHOLD, DEFAULT_REWARD_PERKS };
export type { AppContextType };

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedBranchId, setSelectedBranchIdState] = useState<BranchId>(() => safeGetBranch());
  const [isSwitchingBranchModalOpen, setIsSwitchingBranchModalOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [selectedDeliveryZone, setSelectedDeliveryZone] = useState<string>('');

  // Dynamic Products List & CMS Content
  const [products, setProducts] = useState<Product[]>(() => safeGetProducts());
  const [cmsContent, setCmsContent] = useState<any>(null);

  const refreshCmsContent = async () => {
    try {
      const res = await fetch('/api/cms/content');
      if (res.ok) {
        const data = await res.json();
        setCmsContent(data);
      }
    } catch {}
  };

  const refreshMenuProducts = async () => {
    try {
      const res = await fetch('/api/menu/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setProducts(data);
          localStorage.setItem(LOCAL_STORAGE_KEY_MENU, JSON.stringify(data));
        }
      }
    } catch {}
  };

  useEffect(() => {
    refreshCmsContent();
    refreshMenuProducts();
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_BRANCH, selectedBranchId);
  }, [selectedBranchId]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_MENU, JSON.stringify(products));
  }, [products]);

  // Modals & Drawers
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSmallChopsBuilderOpen, setIsSmallChopsBuilderOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);
  const [isCateringModalOpen, setIsCateringModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isLocationsModalOpen, setIsLocationsModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<Order | null>(null);

  // Operations Modals & Full-Screen Workspace Navigation
  const [operationsActiveTab, setOperationsActiveTab] = useState<OperationsTab>('pos');
  const [isStaffPosOpen, setIsStaffPosOpen] = useState(false);
  const [isStaffLoginModalOpen, setIsStaffLoginModalOpen] = useState(false);
  const [isRiderPortalOpen, setIsRiderPortalOpen] = useState(false);
  const [isAiChatbotOpen, setIsAiChatbotOpen] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('favourites');
  const [activeDietaryFilter, setActiveDietaryFilter] = useState<'all' | 'spicy' | 'veg' | 'deals'>('all');

  // 1. Staff Auth & Account Management Slice
  const staffAuth = useStaffAuthSlice({
    onLogoutCleanup: () => {
      setIsAdminModalOpen(false);
      setIsStaffPosOpen(false);
      setIsRiderPortalOpen(false);
    },
    onOpenStaffLoginModal: setIsStaffLoginModalOpen,
  });

  const navigateToOperations = (tab?: OperationsTab) => {
    if (tab) {
      setOperationsActiveTab(tab);
    }
    staffAuth.setIsStorefrontPreviewActive(false);
    setIsAdminModalOpen(false);
    setIsStaffPosOpen(false);
    setIsRiderPortalOpen(false);
    setIsStaffLoginModalOpen(false);
  };

  // Current branch & pricing helpers
  const currentBranch = BRANCHES.find((b) => b.id === selectedBranchId) || BRANCHES[0];

  useEffect(() => {
    if (currentBranch.deliveryZones.length > 0 && !selectedDeliveryZone) {
      setSelectedDeliveryZone(currentBranch.deliveryZones[0].name);
    }
  }, [currentBranch, selectedDeliveryZone]);

  const getProductPrice = (product: Product, branchId: BranchId = selectedBranchId): number => {
    if (product.branchPrices && product.branchPrices[branchId] !== undefined) {
      return product.branchPrices[branchId]!;
    }
    return product.basePrice;
  };

  const isProductAvailable = (productId: string, branchId: BranchId = selectedBranchId): boolean => {
    const product = products.find((p) => p.id === productId);
    if (!product) return false;
    if ((product.status && product.status !== 'published') || (product as any).isActive === false) {
      return false;
    }
    return product.branchAvailability[branchId] ?? true;
  };

  const deliveryFee = (() => {
    if (orderType !== 'delivery') return 0;
    const canonicalZones = Array.isArray(cmsContent?.deliveryZones) ? cmsContent.deliveryZones : [];
    const normalizedTarget = (selectedDeliveryZone || '').trim().toLowerCase();
    if (normalizedTarget && canonicalZones.length > 0) {
      const matchedCanonical = canonicalZones.find(
        (z: any) =>
          z.active !== false &&
          (String(z.name || '').toLowerCase() === normalizedTarget ||
            String(z.name || '').toLowerCase().includes(normalizedTarget) ||
            normalizedTarget.includes(String(z.name || '').toLowerCase().split('/')[0]?.trim() || '__none__'))
      );
      if (matchedCanonical && Number(matchedCanonical.fee) > 0) {
        return Number(matchedCanonical.fee);
      }
    }
    const foundZone = currentBranch.deliveryZones.find((z) => z.name === selectedDeliveryZone);
    return foundZone ? foundZone.fee : currentBranch.deliveryFeeBase;
  })();

  // 2. Customer, Cart, Loyalty & Orders Slice
  const customerAndCart = useCustomerAndCartSlice({
    selectedBranchId,
    setSelectedBranchId: (id: BranchId) => setSelectedBranchId(id),
    orderType,
    deliveryFee,
    products,
    getProductPrice,
    isProductAvailable,
    setIsCartOpen,
    activeTrackingOrder,
    setActiveTrackingOrder,
  });

  const setSelectedBranchId = (id: BranchId) => {
    setSelectedBranchIdState(id);
    const newBranch = BRANCHES.find((b) => b.id === id);
    if (newBranch && newBranch.deliveryZones.length > 0) {
      setSelectedDeliveryZone(newBranch.deliveryZones[0].name);
    }
    customerAndCart.setCart((prev) =>
      prev
        .filter((item) => isProductAvailable(item.productId, id))
        .map((item) => {
          const freshProd = products.find((p) => p.id === item.productId) || item.product;
          const basePrice = getProductPrice(freshProd, id);
          let optionsDelta = 0;
          if (item.customization?.selectedOptions) {
            optionsDelta += item.customization.selectedOptions.reduce((acc, opt) => acc + (opt.priceDelta || 0), 0);
          }
          if (item.customization?.selectedAddOns) {
            optionsDelta += item.customization.selectedAddOns.reduce((acc, add) => acc + (add.price || 0), 0);
          }
          const customizationKey = item.customization ? JSON.stringify(item.customization) : '';
          return {
            ...item,
            id: `${item.productId}-${id}-${customizationKey}`,
            product: freshProd,
            unitPrice: basePrice > 0 ? basePrice + optionsDelta : item.unitPrice,
            branchId: id,
          };
        })
    );
  };

  // 3. POS, Inventory, Dispatch & Accounting Slice
  const posAndInventory = usePosAndInventorySlice({
    currentStaff: staffAuth.currentStaff,
    selectedBranchId,
    setOrders: customerAndCart.setOrders,
  });

  // WhatsApp integration helpers
  const getBranchWhatsAppUrl = (branchId: BranchId = selectedBranchId, prefilledText?: string): string => {
    const branch = BRANCHES.find((b) => b.id === branchId) || currentBranch;
    const base = `https://wa.me/${branch.whatsappNumber}`;
    if (prefilledText) {
      return `${base}?text=${encodeURIComponent(prefilledText)}`;
    }
    return branch.whatsappCatalogueUrl;
  };

  const generateWhatsAppCartText = (items: CartItem[] = customerAndCart.cart, deliveryAddress?: string): string => {
    if (items.length === 0) {
      return `Hello Choplife Republic (${currentBranch.name}), I would like to see today's special menu!`;
    }

    const itemsSummary = items
      .map((item, idx) => {
        let line = `${idx + 1}. *${item.product.name}* (x${item.quantity}) - ₦${(item.unitPrice * item.quantity).toLocaleString()}`;
        if (item.customization?.selectedOptions?.length) {
          line += `\n   _Options:_ ${item.customization.selectedOptions.map((o) => o.choiceName).join(', ')}`;
        }
        if (item.customization?.selectedAddOns?.length) {
          line += `\n   _Add-ons:_ ${item.customization.selectedAddOns.map((a) => a.name).join(', ')}`;
        }
        return line;
      })
      .join('\n');

    return `🔥 *CHOPLIFE REPUBLIC ORDER INQUIRY*\n📍 Branch: *${currentBranch.name}*\n🛵 Order Type: *${orderType.toUpperCase()}*\n\n*ORDER ITEMS:*\n${itemsSummary}\n\n*Estimated Total:* ₦${customerAndCart.cartTotal.toLocaleString()}\n${
      deliveryAddress ? `*Delivery Address:* ${deliveryAddress}\n` : ''
    }\nPlease confirm availability and payment details. Thank you!`;
  };

  // Admin CMS Functions
  const toggleProductStock = (productId: string, branchId: BranchId) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const current = p.branchAvailability[branchId] ?? true;
          return {
            ...p,
            branchAvailability: {
              ...p.branchAvailability,
              [branchId]: !current,
            },
          };
        }
        return p;
      })
    );
  };

  const updateProductBranchPrice = (productId: string, branchId: BranchId, newPrice: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          return {
            ...p,
            branchPrices: {
              ...p.branchPrices,
              [branchId]: newPrice,
            },
          };
        }
        return p;
      })
    );
  };

  const bulkImportMenu = (importedProducts: Product[]) => {
    setProducts(importedProducts);
  };

  const formatNaira = (amount: number | string | null | undefined): string => {
    if (amount === null || amount === undefined || amount === '') {
      return '₦0';
    }
    const num = Number(amount);
    if (isNaN(num)) {
      return '₦0';
    }
    return `₦${num.toLocaleString('en-NG')}`;
  };

  return (
    <AppContext.Provider
      value={{
        branches: BRANCHES,
        selectedBranchId,
        currentBranch,
        setSelectedBranchId,
        isSwitchingBranchModalOpen,
        setIsSwitchingBranchModalOpen,
        orderType,
        setOrderType,
        selectedDeliveryZone,
        setSelectedDeliveryZone,
        deliveryFee: customerAndCart.effectiveDeliveryFee,
        products,
        getProductPrice,
        isProductAvailable,
        cart: customerAndCart.cart,
        addToCart: customerAndCart.addToCart,
        lastAddedToast: customerAndCart.lastAddedToast,
        setLastAddedToast: customerAndCart.setLastAddedToast,
        removeFromCart: customerAndCart.removeFromCart,
        updateCartQuantity: customerAndCart.updateCartQuantity,
        clearCart: customerAndCart.clearCart,
        cartCount: customerAndCart.cartCount,
        cartSubtotal: customerAndCart.cartSubtotal,
        cartPackagingFee: customerAndCart.cartPackagingFee,
        cartDiscount: customerAndCart.cartDiscount,
        appliedCoupon: customerAndCart.appliedCoupon,
        applyCoupon: customerAndCart.applyCoupon,
        removeCoupon: customerAndCart.removeCoupon,
        cartTotal: customerAndCart.cartTotal,
        amountAwayFromFreeDelivery: customerAndCart.amountAwayFromFreeDelivery,
        setCart: customerAndCart.setCart,
        customerProfile: customerAndCart.customerProfile,
        updateCustomerProfile: customerAndCart.updateCustomerProfile,
        customerLogin: customerAndCart.customerLogin,
        customerLogout: customerAndCart.customerLogout,
        clearSavedCheckoutDetails: customerAndCart.clearSavedCheckoutDetails,
        addSavedAddress: customerAndCart.addSavedAddress,
        removeSavedAddress: customerAndCart.removeSavedAddress,
        loyaltyPoints: customerAndCart.loyaltyPoints,
        lifetimeSpent: customerAndCart.lifetimeSpent,
        redeemRewardPoints: customerAndCart.redeemRewardPoints,
        shortlistedProductIds: customerAndCart.shortlistedProductIds,
        toggleShortlist: customerAndCart.toggleShortlist,
        isProductShortlisted: customerAndCart.isProductShortlisted,
        clearShortlist: customerAndCart.clearShortlist,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        isSmallChopsBuilderOpen,
        setIsSmallChopsBuilderOpen,
        selectedProductForDetail,
        setSelectedProductForDetail,
        isCateringModalOpen,
        setIsCateringModalOpen,
        isAccountModalOpen,
        setIsAccountModalOpen,
        isAdminModalOpen,
        setIsAdminModalOpen,
        isAdminOpen: isAdminModalOpen,
        setIsAdminOpen: setIsAdminModalOpen,
        isLocationsModalOpen,
        setIsLocationsModalOpen,
        isReviewModalOpen,
        setIsReviewModalOpen,
        activeTrackingOrder,
        setActiveTrackingOrder,
        isStaffPosOpen,
        setIsStaffPosOpen,
        operationsActiveTab,
        setOperationsActiveTab,
        navigateToOperations,
        isStaffLoginModalOpen,
        setIsStaffLoginModalOpen,
        isRiderPortalOpen,
        setIsRiderPortalOpen,
        isAiChatbotOpen,
        setIsAiChatbotOpen,
        authStatus: staffAuth.authStatus,
        staffUsers: staffAuth.staffUsers,
        staffAccounts: staffAuth.staffUsers,
        currentStaff: staffAuth.currentStaff,
        setCurrentStaff: staffAuth.setCurrentStaff,
        isStorefrontPreviewActive: staffAuth.isStorefrontPreviewActive,
        setIsStorefrontPreviewActive: staffAuth.setIsStorefrontPreviewActive,
        loginStaff: staffAuth.loginStaff,
        loginStaffWithPin: staffAuth.loginStaffWithPin,
        validateManagerOverride: staffAuth.validateManagerOverride,
        logoutStaff: staffAuth.logoutStaff,
        provisionAdmin: staffAuth.provisionAdmin,
        requestPasswordReset: staffAuth.requestPasswordReset,
        completePasswordReset: staffAuth.completePasswordReset,
        fetchStaffAccounts: staffAuth.fetchStaffAccounts,
        createStaffAccount: staffAuth.createStaffAccount,
        updateStaffAccount: staffAuth.updateStaffAccount,
        resetStaffPassword: staffAuth.resetStaffPassword,
        revokeStaffSessions: staffAuth.revokeStaffSessions,
        checkSystemProvisioned: staffAuth.checkSystemProvisioned,
        inventoryItems: posAndInventory.inventoryItems,
        updateInventoryStock: posAndInventory.updateInventoryStock,
        restockInventoryItem: posAndInventory.restockInventoryItem,
        logWastageItem: posAndInventory.logWastageItem,
        addInventoryItem: posAndInventory.addInventoryItem,
        riders: posAndInventory.riders,
        assignRiderToOrder: posAndInventory.assignRiderToOrder,
        updateRiderStatus: posAndInventory.updateRiderStatus,
        updateRiderCashInHand: posAndInventory.updateRiderCashInHand,
        heldTickets: posAndInventory.heldTickets,
        holdCurrentPOSTicket: posAndInventory.holdCurrentPOSTicket,
        restoreHeldTicket: posAndInventory.restoreHeldTicket,
        deleteHeldTicket: posAndInventory.deleteHeldTicket,
        accountingReconciliations: posAndInventory.accountingReconciliations,
        saveShiftReconciliation: posAndInventory.saveShiftReconciliation,
        auditLogs: posAndInventory.auditLogs,
        addAuditLog: posAndInventory.addAuditLog,
        createPOSOrder: posAndInventory.createPOSOrder,
        offlineQueueCount: posAndInventory.offlineQueueCount,
        isOnline: posAndInventory.isOnline,
        syncOfflineQueue: posAndInventory.syncOfflineQueue,
        searchQuery,
        setSearchQuery,
        activeCategory,
        setActiveCategory,
        activeDietaryFilter,
        setActiveDietaryFilter,
        orders: customerAndCart.orders,
        createOrder: customerAndCart.createOrder,
        updateOrderStatus: customerAndCart.updateOrderStatus,
        reorderPastOrder: customerAndCart.reorderPastOrder,
        reorder: customerAndCart.reorderPastOrder,
        reorderItem: customerAndCart.reorderItem,
        reviews: customerAndCart.reviews,
        addReview: customerAndCart.addReview,
        cateringEnquiries: customerAndCart.cateringEnquiries,
        submitCateringEnquiry: customerAndCart.submitCateringEnquiry,
        getBranchWhatsAppUrl,
        generateWhatsAppCartText,
        cmsContent,
        setCmsContent,
        refreshCmsContent,
        refreshMenuProducts,
        toggleProductStock,
        updateProductBranchPrice,
        bulkImportMenu,
        formatNaira,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
