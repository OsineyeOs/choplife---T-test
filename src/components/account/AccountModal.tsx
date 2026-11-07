import React, { useState, useEffect } from 'react';
import { useApp, DEFAULT_REWARD_PERKS } from '../../context/AppContext';
import { BranchId, SavedAddress, Order } from '../../types';
import {
  X,
  User,
  ShoppingBag,
  RotateCcw,
  Clock,
  Award,
  Sparkles,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Plus,
  Trash2,
  Phone,
  Mail,
  Building,
  CheckCircle2,
  Gift,
  ArrowRight,
  LogOut,
  LogIn,
  Receipt,
  Search,
  Filter,
  Check,
} from 'lucide-react';
import { GRA_DELIVERY_ZONES, OKABERE_DELIVERY_ZONES, UGBOWO_DELIVERY_ZONES } from '../../data/deliveryMaster';
import { useLanguage } from '../../context/LanguageContext';
import { CartItem } from '../../types';

type ActiveTab = 'orders' | 'rewards' | 'addresses' | 'profile';

export const AccountModal: React.FC = () => {
  const {
    isAccountModalOpen,
    setIsAccountModalOpen,
    orders,
    reorder,
    reorderItem,
    createOrder,
    products,
    setActiveTrackingOrder,
    formatNaira,
    customerProfile,
    updateCustomerProfile,
    customerLogin,
    customerLogout,
    addSavedAddress,
    removeSavedAddress,
    loyaltyPoints,
    lifetimeSpent,
    redeemRewardPoints,
    branches,
    currentBranch,
    setIsCartOpen,
  } = useApp();

  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<ActiveTab>('orders');
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);

  // Order history search & filter state
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'delivered' | 'active' | 'cancelled'>('all');
  const [orderActionFeedback, setOrderActionFeedback] = useState<string | null>(null);
  const [verifyOrderNumber, setVerifyOrderNumber] = useState('');
  const [verifyOrderPhone, setVerifyOrderPhone] = useState('');
  const [verifyOrderError, setVerifyOrderError] = useState('');

  const hasSavedProfile = Boolean(
    customerProfile.rememberCheckoutDetails !== false &&
      customerProfile.name &&
      customerProfile.phone
  );
  const savedAddresses = (customerProfile.savedAddresses || []).filter(
    (a) => hasSavedProfile || a.id !== 'addr-default-gra'
  );
  const sessionOrderIds = customerProfile.sessionOrderIds || [];
  const visibleOrders =
    customerProfile.rememberCheckoutDetails === false
      ? []
      : orders.filter((o) => sessionOrderIds.includes(o.id) || sessionOrderIds.includes(o.orderNumber));

  // Address creation form state
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newLabel, setNewLabel] = useState<SavedAddress['label']>('Home');
  const [newAddressLine, setNewAddressLine] = useState('');
  const [newZone, setNewZone] = useState('Airport Road');
  const [newLandmark, setNewLandmark] = useState('');

  // Login form state
  const [loginName, setLoginName] = useState(customerProfile.name || '');
  const [loginPhone, setLoginPhone] = useState(customerProfile.phone || '');
  const [loginEmail, setLoginEmail] = useState(customerProfile.email || '');
  const [loginSuccessMsg, setLoginSuccessMsg] = useState('');
  const [redeemedVouchers, setRedeemedVouchers] = useState<string[]>([]);
  const [rewardToast, setRewardToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isAccountModalOpen) return;
    setLoginName(customerProfile.name || customerProfile.knownDisplayName || '');
    setLoginPhone(customerProfile.phone || '');
    setLoginEmail(customerProfile.email || '');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAccountModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountModalOpen, customerProfile.name, customerProfile.knownDisplayName, customerProfile.phone, customerProfile.email, setIsAccountModalOpen]);

  if (!isAccountModalOpen) return null;

  // All Benin City Zones for address dropdown
  const allMasterZones = [
    ...GRA_DELIVERY_ZONES.map((z) => ({ name: z.locationName, branch: 'GRA' })),
    ...OKABERE_DELIVERY_ZONES.map((z) => ({ name: z.locationName, branch: 'Okabere' })),
    ...UGBOWO_DELIVERY_ZONES.map((z) => ({ name: z.locationName, branch: 'Ugbowo' })),
  ];

  const handleVerifyOrderLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyOrderError('');
    const cleanNum = verifyOrderNumber.trim().toUpperCase().replace(/^#/, '');
    const cleanPhone = verifyOrderPhone.replace(/\D/g, '');
    if (!cleanNum || cleanPhone.length < 8) {
      setVerifyOrderError('Both your Order Number (e.g. CL-12345) and 11-digit Phone Number are required.');
      return;
    }
    const matched = orders.find((o) => {
      const oPhone = (o.deliveryDetails?.customerPhone || '').replace(/\D/g, '');
      const numMatch = o.orderNumber.toUpperCase() === cleanNum || o.id.toUpperCase() === cleanNum;
      const phoneMatch = oPhone.length >= 8 && oPhone.slice(-10) === cleanPhone.slice(-10);
      return numMatch && phoneMatch;
    });
    if (!matched) {
      setVerifyOrderError('Verification failed: Order number and phone number do not match any record.');
      return;
    }
    updateCustomerProfile({
      rememberCheckoutDetails: true,
      sessionOrderIds: Array.from(new Set([matched.id, ...(customerProfile.sessionOrderIds || [])])),
    });
    setVerifyOrderNumber('');
    setVerifyOrderPhone('');
    setOrderActionFeedback(`Verified Order #${matched.orderNumber}! Added to your order history.`);
    setTimeout(() => setOrderActionFeedback(null), 4000);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressLine.trim()) return;

    addSavedAddress({
      label: newLabel,
      address: newAddressLine.trim(),
      deliveryZone: newZone,
      landmark: newLandmark.trim() || undefined,
      isDefault: savedAddresses.length === 0,
    });

    setNewAddressLine('');
    setNewLandmark('');
    setIsAddingAddress(false);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginPhone.trim()) return;

    customerLogin(loginName.trim(), loginPhone.trim(), loginEmail.trim() || undefined);
    setLoginSuccessMsg('Your profile has been saved successfully!');
    setTimeout(() => setLoginSuccessMsg(''), 3000);
  };

  const handleRedeemPerk = (perk: (typeof DEFAULT_REWARD_PERKS)[0]) => {
    const success = redeemRewardPoints(perk.pointsCost, perk.title);
    if (success) {
      const voucherCode = `CHOP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      setRedeemedVouchers((prev) => [
        `${voucherCode}: ${perk.title} (${formatNaira(perk.discountValue || 0)} Value)`,
        ...prev,
      ]);
      setRewardToast(`🎉 Successfully redeemed "${perk.title}"! Voucher: ${voucherCode}`);
      setTimeout(() => setRewardToast(null), 5000);
    } else {
      setRewardToast(`❌ You need ${perk.pointsCost} points for this reward.`);
      setTimeout(() => setRewardToast(null), 3000);
    }
  };

  // Tier calculation
  let tierName = 'Bronze Citizen';
  let tierBadgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
  let nextTierThreshold = 25000;
  if (lifetimeSpent >= 100000) {
    tierName = 'Platinum Republic VIP';
    tierBadgeBg = 'bg-purple-100 text-purple-900 border-purple-300';
    nextTierThreshold = 250000;
  } else if (lifetimeSpent >= 50000) {
    tierName = 'Gold Republic Citizen';
    tierBadgeBg = 'bg-yellow-100 text-yellow-900 border-yellow-300';
    nextTierThreshold = 100000;
  } else if (lifetimeSpent >= 25000) {
    tierName = 'Silver Citizen';
    tierBadgeBg = 'bg-slate-100 text-slate-900 border-slate-300';
    nextTierThreshold = 50000;
  }

  const tierProgress = Math.min(100, Math.round((lifetimeSpent / nextTierThreshold) * 100));

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      id="account-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsAccountModalOpen(false);
        }
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[94vh] overflow-hidden shadow-2xl border border-[#E5DEC9] flex flex-col justify-between">
        
        {/* Header */}
        <div className="bg-[#4D080F] text-white p-4 sm:p-5 rounded-t-3xl flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center font-titan text-xl shadow-inner">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-titan uppercase tracking-widest text-[#FFC700] block">
                  CHOPLIFE REPUBLIC CITIZEN
                </span>
                <span className={`text-[9px] font-montserrat font-bold px-2 py-0.5 rounded-full border ${tierBadgeBg}`}>
                  {tierName}
                </span>
              </div>
              <h2 className="font-titan text-lg sm:text-xl text-white">
                {customerProfile.isLoggedIn && customerProfile.name
                  ? `${customerProfile.name.toUpperCase()}`
                  : 'MY ACCOUNT & ORDERS'}
              </h2>
            </div>
          </div>

          <button
            onClick={() => setIsAccountModalOpen(false)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            id="close-account-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E5DEC9] bg-[#FAF7F2] px-2 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-2.5 rounded-t-xl font-titan text-xs tracking-wider flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-white text-[#4D080F] border-t border-x border-[#E5DEC9] shadow-xs'
                : 'text-[#7A6A65] hover:text-[#241311]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{t('account.order_history', 'Order History')} ({visibleOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rewards')}
            className={`px-3 py-2.5 rounded-t-xl font-titan text-xs tracking-wider flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'rewards'
                ? 'bg-white text-[#4D080F] border-t border-x border-[#E5DEC9] shadow-xs'
                : 'text-[#7A6A65] hover:text-[#241311]'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Rewards ({loyaltyPoints} pts)</span>
          </button>

          <button
            onClick={() => setActiveTab('addresses')}
            className={`px-3 py-2.5 rounded-t-xl font-titan text-xs tracking-wider flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'addresses'
                ? 'bg-white text-[#4D080F] border-t border-x border-[#E5DEC9] shadow-xs'
                : 'text-[#7A6A65] hover:text-[#241311]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Addresses ({savedAddresses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2.5 rounded-t-xl font-titan text-xs tracking-wider flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-white text-[#4D080F] border-t border-x border-[#E5DEC9] shadow-xs'
                : 'text-[#7A6A65] hover:text-[#241311]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile & Auth</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {rewardToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-montserrat font-semibold flex items-center gap-2 animate-in slide-in-from-top duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{rewardToast}</span>
            </div>
          )}

          {/* Order Action Feedback Toast */}
          {orderActionFeedback && (
            <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-montserrat font-semibold flex items-center justify-between gap-2 animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{orderActionFeedback}</span>
              </div>
              <button
                onClick={() => {
                  setIsAccountModalOpen(false);
                  setIsCartOpen(true);
                }}
                className="text-xs font-titan text-[#E62E00] underline"
              >
                View Cart →
              </button>
            </div>
          )}

          {/* TAB 1: ORDER HISTORY & REORDER */}
          {activeTab === 'orders' && (() => {
            const handleReorderSingleItem = (item: CartItem, branchId: BranchId) => {
              reorderItem(item, branchId);
              const itemName = item.product?.name || (item as any).name || 'Item';
              setOrderActionFeedback(`🛒 Added ${item.quantity || 1}x "${itemName}" to your cart!`);
              setTimeout(() => setOrderActionFeedback(null), 4000);
            };

            // Filter logic
            const filteredOrders = visibleOrders.filter((order) => {
              // Status filter
              if (orderStatusFilter === 'delivered' && order.orderStatus !== 'delivered') return false;
              if (orderStatusFilter === 'cancelled' && order.orderStatus !== 'cancelled') return false;
              if (
                orderStatusFilter === 'active' &&
                (order.orderStatus === 'delivered' || order.orderStatus === 'cancelled')
              )
                return false;

              // Search query filter
              if (orderSearchQuery.trim()) {
                const q = orderSearchQuery.toLowerCase();
                const matchesId = (order.id || '').toLowerCase().includes(q) || (order.orderNumber || '').toLowerCase().includes(q);
                const matchesBranch = (order.branchId || '').toLowerCase().includes(q);
                const matchesItem = (order.items || []).some((item) =>
                  (item.product?.name || (item as any).name || '').toLowerCase().includes(q)
                );
                return matchesId || matchesBranch || matchesItem;
              }

              return true;
            });

            return (
              <div className="space-y-4" id="order-history-section">
                {/* Header & Stats Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E5DEC9]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-titan text-base text-[#4D080F] uppercase tracking-wide">
                        {t('account.order_history', 'ORDER HISTORY')}
                      </h3>
                      <span className="text-[10px] font-titan bg-[#FFC700] text-[#4D080F] px-2 py-0.5 rounded-full" id="account-visible-orders-count">
                        {visibleOrders.length} {visibleOrders.length === 1 ? 'Order' : 'Orders'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7A6A65] font-montserrat">
                      {t('account.order_history_desc', 'Live status tracking and 1-click reorder past meals')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-montserrat font-bold text-[#E62E00] bg-[#FFF8E7] px-2.5 py-1 rounded-lg border border-[#FFC700]/40">
                      {t('account.total_spent', 'Total Spent')}: {formatNaira(lifetimeSpent)}
                    </span>
                  </div>
                </div>

                {/* Order Verification Box (Requires Order # + Phone Number) */}
                <form
                  onSubmit={handleVerifyOrderLookup}
                  className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#E5DEC9] space-y-2"
                  id="verify-order-lookup-form"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-titan uppercase tracking-wider text-[#4D080F]">
                      VERIFY & LINK PAST ORDER (ORDER # + PHONE REQUIRED)
                    </span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Order # (e.g. CL-12345)"
                      value={verifyOrderNumber}
                      onChange={(e) => setVerifyOrderNumber(e.target.value)}
                      className="flex-1 bg-white border border-[#E5DEC9] rounded-xl px-3 py-1.5 text-xs font-montserrat text-[#241311]"
                      id="verify-order-number-input"
                    />
                    <input
                      type="tel"
                      placeholder="Order Phone Number"
                      value={verifyOrderPhone}
                      onChange={(e) => setVerifyOrderPhone(e.target.value)}
                      className="flex-1 bg-white border border-[#E5DEC9] rounded-xl px-3 py-1.5 text-xs font-montserrat text-[#241311]"
                      id="verify-order-phone-input"
                    />
                    <button
                      type="submit"
                      className="bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] font-titan text-xs px-4 py-1.5 rounded-xl shrink-0"
                      id="verify-order-submit-btn"
                    >
                      Verify Order
                    </button>
                  </div>
                  {verifyOrderError && (
                    <p className="text-[11px] text-rose-700 font-montserrat font-semibold" id="verify-order-error">
                      {verifyOrderError}
                    </p>
                  )}
                </form>

                {/* Filter Controls & Search */}
                {visibleOrders.length > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between bg-[#FAF7F2] p-2.5 rounded-2xl border border-[#E5DEC9]">
                    {/* Status Filters */}
                    <div className="flex items-center gap-1 overflow-x-auto text-xs font-montserrat font-bold">
                      <button
                        onClick={() => setOrderStatusFilter('all')}
                        className={`px-2.5 py-1.5 rounded-xl transition-all ${
                          orderStatusFilter === 'all'
                            ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                            : 'bg-white text-[#7A6A65] hover:text-[#241311] border border-[#E5DEC9]'
                        }`}
                      >
                        {t('account.filter_all', 'All Orders')} ({visibleOrders.length})
                      </button>
                      <button
                        onClick={() => setOrderStatusFilter('delivered')}
                        className={`px-2.5 py-1.5 rounded-xl transition-all ${
                          orderStatusFilter === 'delivered'
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-white text-[#7A6A65] hover:text-[#241311] border border-[#E5DEC9]'
                        }`}
                      >
                        {t('account.filter_delivered', 'Delivered')}
                      </button>
                      <button
                        onClick={() => setOrderStatusFilter('active')}
                        className={`px-2.5 py-1.5 rounded-xl transition-all ${
                          orderStatusFilter === 'active'
                            ? 'bg-[#E62E00] text-white shadow-xs'
                            : 'bg-white text-[#7A6A65] hover:text-[#241311] border border-[#E5DEC9]'
                        }`}
                      >
                        {t('account.filter_active', 'Active / In Progress')}
                      </button>
                    </div>

                    {/* Search box */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={t('account.search_orders', 'Filter past orders...')}
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-white border border-[#E5DEC9] rounded-xl text-xs font-montserrat text-[#241311] placeholder:text-[#8E7E7A] focus:outline-none focus:ring-1 focus:ring-[#E62E00]"
                      />
                      <Search className="w-3.5 h-3.5 text-[#8E7E7A] absolute left-2.5 top-2.5" />
                      {orderSearchQuery && (
                        <button
                          onClick={() => setOrderSearchQuery('')}
                          className="absolute right-2 top-1.5 text-xs text-[#8E7E7A] hover:text-black"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Orders Content */}
                {visibleOrders.length === 0 ? (
                  <div className="text-center py-10 bg-[#FAF7F2] rounded-3xl border border-[#E5DEC9] p-6 space-y-4 shadow-2xs">
                    <div className="w-16 h-16 rounded-full bg-[#FFF8E7] border-2 border-[#FFC700] flex items-center justify-center mx-auto text-3xl shadow-xs">
                      🛍️
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-titan text-base text-[#4D080F]">
                        {t('account.no_orders_title', 'No orders placed yet')}
                      </h4>
                      <p className="text-xs text-[#7A6A65] font-montserrat max-w-sm mx-auto">
                        {t(
                          'account.no_orders_desc',
                          'Browse our approved menu items, build a custom small chops box, or order fresh bromate-free bread!'
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        onClick={() => setIsAccountModalOpen(false)}
                        className="inline-flex items-center gap-1.5 bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
                      >
                        <span>{t('account.browse_menu', 'Browse Menu & Order')}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-8 bg-[#FAF7F2] rounded-2xl border border-[#E5DEC9] p-4 space-y-2">
                    <p className="font-titan text-sm text-[#4D080F]">No orders match your filter</p>
                    <p className="text-xs text-[#7A6A65] font-montserrat">
                      Try searching with a different keyword or resetting your filter.
                    </p>
                    <button
                      onClick={() => {
                        setOrderSearchQuery('');
                        setOrderStatusFilter('all');
                      }}
                      className="text-xs font-titan text-[#E62E00] underline"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => {
                      const isDelivered = order.orderStatus === 'delivered';
                      const isCancelled = order.orderStatus === 'cancelled';
                      const isActive = !isDelivered && !isCancelled;

                      return (
                        <div
                          key={order.id}
                          className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#E5DEC9] space-y-3 shadow-2xs hover:border-[#FFC700] transition-colors"
                          id={`account-order-${order.id}`}
                        >
                          {/* Order Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E5DEC9]">
                            <div className="flex items-center gap-2">
                              <span className="font-titan text-sm text-[#4D080F]">
                                #{order.orderNumber}
                              </span>
                              <span className="text-[11px] text-[#7A6A65] font-montserrat">
                                {new Date(order.createdAt).toLocaleDateString('en-NG', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-titan uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                                  isDelivered
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isCancelled
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                              >
                                {isActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                )}
                                {order.orderStatus.replace('_', ' ')}
                              </span>
                            </div>
                          </div>

                          {/* Fulfillment & Channel Info */}
                          <div className="flex flex-wrap items-center justify-between text-[11px] font-montserrat text-[#7A6A65] bg-white px-3 py-1.5 rounded-lg border border-[#F0EAE1]">
                            <span className="font-bold text-[#4D080F] flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#E62E00]" />
                              {t('account.fulfilled_by', 'Fulfilled by')} {order.branchId.toUpperCase()}{' '}
                              • {order.orderType === 'delivery' ? '🛵 Delivery' : '🏪 Pickup'}
                            </span>
                            <span className="font-semibold text-[#5C4D49]">
                              Payment: {order.paymentMethod.toUpperCase()} ({order.paymentStatus})
                            </span>
                          </div>

                          {/* Items Breakdown with INDIVIDUAL ITEM REORDER */}
                          <div className="space-y-2 bg-white p-3 rounded-xl border border-[#E5DEC9]">
                            <p className="text-[10px] font-titan text-[#7A6A65] uppercase tracking-wider">
                              ITEMS IN THIS ORDER ({(order.items || []).length})
                            </p>
                            <div className="divide-y divide-[#F0EAE1]">
                              {(order.items || []).map((item, idx) => {
                                const itemName = item.product?.name || (item as any).name || 'Choplife Special';
                                const qty = item.quantity || 1;
                                const unitPrice = item.unitPrice || item.product?.basePrice || 0;
                                return (
                                  <div
                                    key={idx}
                                    className="py-2 flex items-start justify-between gap-3 text-xs font-montserrat"
                                  >
                                    <div className="flex-1 space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-[#E62E00]">{qty}x</span>
                                        <span className="font-bold text-[#241311]">{itemName}</span>
                                      </div>

                                      {/* Customization Details if any */}
                                      {item.customization?.specialInstructions && (
                                        <p className="text-[10px] text-[#7A6A65] italic">
                                          Note: "{item.customization.specialInstructions}"
                                        </p>
                                      )}

                                      {item.customization?.smallChopsBoxItems && item.customization.smallChopsBoxItems.length > 0 && (
                                        <p className="text-[10px] text-[#7A6A65]">
                                          Box:{' '}
                                          {item.customization.smallChopsBoxItems
                                            .map((c) => `${c.count} ${c.item}`)
                                            .join(', ')}
                                        </p>
                                      )}

                                      {item.customization?.selectedOptions && item.customization.selectedOptions.length > 0 && (
                                        <p className="text-[10px] text-[#7A6A65]">
                                          Options:{' '}
                                          {item.customization.selectedOptions.map((o) => o.choiceName).join(', ')}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      <span className="font-bold text-[#241311]">
                                        {formatNaira(unitPrice * qty)}
                                      </span>

                                      {/* Reorder This Single Item */}
                                      <button
                                        type="button"
                                        onClick={() => handleReorderSingleItem(item, order.branchId)}
                                        className="px-2.5 py-1 bg-[#FFF8E7] hover:bg-[#FFEEC2] text-[#4D080F] border border-[#FFC700] rounded-lg font-montserrat font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                                        title={`Add "${itemName}" to cart`}
                                      >
                                        <Plus className="w-3 h-3 text-[#E62E00]" />
                                        <span>{t('account.reorder_item', 'Reorder Item')}</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Card Footer: Financials & Primary Action Buttons */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                            <div>
                              <span className="text-[10px] text-[#7A6A65] uppercase font-bold block">
                                {t('account.total_paid', 'TOTAL PAID')}
                              </span>
                              <div className="flex items-baseline gap-2">
                                <span className="font-titan text-base text-[#E62E00]">
                                  {formatNaira(order.total)}
                                </span>
                                {order.deliveryFee > 0 && (
                                  <span className="text-[10px] text-[#7A6A65]">
                                    (incl. {formatNaira(order.deliveryFee)} delivery)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {/* Digital Receipt button */}
                              <button
                                onClick={() => setSelectedReceiptOrder(order)}
                                className="bg-white hover:bg-gray-100 text-[#4D080F] border border-[#E5DEC9] font-montserrat font-bold text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs transition-colors"
                                title="View Digital Receipt"
                              >
                                <Receipt className="w-3.5 h-3.5 text-[#7A6A65]" />
                                <span>{t('account.receipt', 'Receipt')}</span>
                              </button>

                              {/* Track order button */}
                              <button
                                onClick={() => {
                                  setActiveTrackingOrder(order);
                                  setIsAccountModalOpen(false);
                                }}
                                className="bg-white hover:bg-gray-100 text-[#4D080F] border border-[#E5DEC9] font-montserrat font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs transition-colors"
                              >
                                <Clock className="w-3.5 h-3.5 text-[#E62E00]" />
                                <span>{t('account.track', 'Track')}</span>
                              </button>

                              {/* 1-Click Order Entire Meal Again */}
                              <button
                                onClick={() => {
                                  reorder(order);
                                  setIsAccountModalOpen(false);
                                }}
                                className="bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                                title="Reorder all items from this order into your cart"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-[#FFC700]" />
                                <span>{t('account.order_again', 'Order Again')}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 2: ENJOYMENT REWARDS */}
          {activeTab === 'rewards' && (
            <div className="space-y-6">
              {/* Rewards Balance Banner */}
              <div className="bg-gradient-to-r from-[#FFF8E7] to-[#FAF7F2] p-5 rounded-3xl border-2 border-[#FFC700] space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1 bg-[#4D080F] text-[#FFC700] px-2.5 py-0.5 rounded-full text-[10px] font-titan uppercase tracking-wider mb-1">
                      <Award className="w-3 h-3 text-[#FFC700]" /> REPUBLIC ENJOYMENT REWARDS
                    </div>
                    <h3 className="font-titan text-3xl text-[#4D080F]">
                      {loyaltyPoints} Points Available
                    </h3>
                    <p className="text-xs text-[#7A6A65] font-montserrat font-medium">
                      Every <strong className="text-[#4D080F]">₦1000</strong> spent earns <strong className="text-[#E62E00]">1 Point</strong>. Redeem for free Zobo Drink or Small Chops box!
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-[#E5DEC9] text-left sm:text-right shrink-0">
                    <span className="text-[10px] text-[#7A6A65] font-montserrat font-bold block">
                      LIFETIME SPEND
                    </span>
                    <span className="font-titan text-base text-[#E62E00]">
                      {formatNaira(lifetimeSpent)}
                    </span>
                    <span className="text-[10px] text-[#7A6A65] block">
                      {customerProfile.pointsRedeemed || 0} pts redeemed
                    </span>
                  </div>
                </div>

                {/* Tier Progress */}
                <div className="space-y-1 pt-2 border-t border-[#E5DEC9]">
                  <div className="flex justify-between text-xs font-montserrat">
                    <span className="font-bold text-[#4D080F]">Current Tier: {tierName}</span>
                    <span className="text-[#7A6A65]">
                      {formatNaira(lifetimeSpent)} / {formatNaira(nextTierThreshold)}
                    </span>
                  </div>
                  <div className="w-full bg-[#E5DEC9] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#E62E00] h-full rounded-full transition-all duration-500"
                      style={{ width: `${tierProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Redeemable Perks Grid */}
              <div className="space-y-3">
                <h4 className="font-titan text-xs text-[#4D080F] uppercase tracking-wider">
                  REDEEM AVAILABLE PERKS & VOUCHERS
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DEFAULT_REWARD_PERKS.map((perk) => {
                    const canAfford = loyaltyPoints >= perk.pointsCost;
                    return (
                      <div
                        key={perk.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          canAfford
                            ? 'bg-white border-[#E5DEC9] hover:border-[#FFC700] shadow-xs'
                            : 'bg-gray-50 border-gray-200 opacity-70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-titan text-xs text-[#4D080F] block">
                            {perk.title}
                          </span>
                          <span className="text-[10px] font-titan px-2 py-0.5 rounded-full bg-[#FFC700] text-[#4D080F] shrink-0">
                            {perk.pointsCost} PTS
                          </span>
                        </div>

                        <p className="text-[11px] text-[#7A6A65] font-montserrat leading-relaxed mb-3">
                          {perk.description}
                        </p>

                        <button
                          disabled={!canAfford}
                          onClick={() => handleRedeemPerk(perk)}
                          className={`w-full py-2 px-3 rounded-xl font-titan text-xs transition-colors ${
                            canAfford
                              ? 'bg-[#E62E00] hover:bg-[#C92200] text-white shadow-xs'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {canAfford ? 'Redeem Voucher 🎁' : `Need ${perk.pointsCost - loyaltyPoints} more pts`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Redeemed Vouchers History */}
              {redeemedVouchers.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-[#E5DEC9]">
                  <h4 className="font-titan text-xs text-[#4D080F] uppercase tracking-wider">
                    ACTIVE REDEEMED VOUCHERS
                  </h4>
                  <div className="space-y-2">
                    {redeemedVouchers.map((v, i) => (
                      <div
                        key={i}
                        className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono text-emerald-900 flex items-center justify-between"
                      >
                        <span>{v}</span>
                        <span className="text-[10px] font-montserrat font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Valid for next order
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SAVED ADDRESSES */}
          {activeTab === 'addresses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-titan text-sm text-[#4D080F] uppercase">SAVED ADDRESSES</h3>
                  <p className="text-[11px] text-[#7A6A65] font-montserrat">
                    Manage locations for 1-click delivery checkout
                  </p>
                </div>

                {!isAddingAddress && (
                  <button
                    onClick={() => setIsAddingAddress(true)}
                    className="bg-[#4D080F] hover:bg-[#38050a] text-white font-titan text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>Add Address</span>
                  </button>
                )}
              </div>

              {/* Add Address Form */}
              {isAddingAddress && (
                <form
                  onSubmit={handleSaveAddress}
                  className="bg-[#FAF7F2] p-4 rounded-2xl border-2 border-[#FFC700] space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#E5DEC9]">
                    <span className="font-titan text-xs text-[#4D080F]">NEW BENIN CITY ADDRESS</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingAddress(false)}
                      className="text-xs text-[#7A6A65] font-bold hover:text-[#4D080F]"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-montserrat font-bold text-[#5C4D49] block mb-1">
                        Address Tag
                      </label>
                      <select
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value as any)}
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs font-montserrat"
                      >
                        <option value="Home">Home 🏠</option>
                        <option value="Office">Office 🏢</option>
                        <option value="Hostel">Hostel / School 🎓</option>
                        <option value="Event">Event Hall 🎉</option>
                        <option value="Other">Other 📍</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-montserrat font-bold text-[#5C4D49] block mb-1">
                        Benin City Delivery Zone *
                      </label>
                      <select
                        value={newZone}
                        onChange={(e) => setNewZone(e.target.value)}
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs font-montserrat"
                      >
                        {allMasterZones.map((z, i) => (
                          <option key={i} value={z.name}>
                            {z.name} ({z.branch} Axis)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-montserrat font-bold text-[#5C4D49] block mb-1">
                      Street Address & House / Flat Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flat 4B, 18 Airport Road, GRA"
                      value={newAddressLine}
                      onChange={(e) => setNewAddressLine(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-montserrat font-bold text-[#5C4D49] block mb-1">
                      Prominent Landmark
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Opposite Civic Center / Beside Total Filling Station"
                      value={newLandmark}
                      onChange={(e) => setNewLandmark(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs rounded-xl shadow-xs"
                  >
                    Save Address
                  </button>
                </form>
              )}

              {/* Address List */}
              <div className="space-y-3">
                {savedAddresses.length === 0 ? (
                  <div className="text-center py-8 bg-[#FAF7F2] rounded-2xl border border-[#E5DEC9] p-4 text-xs font-montserrat text-[#7A6A65]">
                    No addresses saved yet. Add your home or office address for fast ordering!
                  </div>
                ) : (
                  savedAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E5DEC9] flex items-start justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-titan text-xs text-[#4D080F] bg-white px-2 py-0.5 rounded-md border border-[#E5DEC9]">
                            {addr.label}
                          </span>
                          <span className="text-[11px] font-montserrat font-bold text-[#E62E00]">
                            {addr.deliveryZone}
                          </span>
                        </div>
                        <p className="text-xs font-montserrat text-[#241311]">{addr.address}</p>
                        {addr.landmark && (
                          <p className="text-[11px] font-montserrat text-[#7A6A65]">
                            📍 Landmark: {addr.landmark}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => removeSavedAddress(addr.id)}
                        className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete Address"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PROFILE & AUTH */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-titan text-sm text-[#4D080F] uppercase">
                      CITIZEN PROFILE DETAILS
                    </h3>
                    <p className="text-[11px] text-[#7A6A65] font-montserrat">
                      Synchronize your orders, phone number, and loyalty points
                    </p>
                  </div>

                  {customerProfile.isLoggedIn ? (
                    <button
                      type="button"
                      onClick={customerLogout}
                      className="text-xs font-montserrat font-bold text-red-600 hover:underline flex items-center gap-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Guest Mode
                    </span>
                  )}
                </div>

                {!customerProfile.isLoggedIn && (
                  <div className="p-3 bg-amber-50 border border-amber-300 text-[#4D080F] rounded-xl text-xs font-montserrat">
                    <p className="font-bold">
                      {customerProfile.knownDisplayName
                        ? `Hello, ${customerProfile.knownDisplayName}. It looks like you’re logged out. Please sign in to continue with your saved details.`
                        : 'Welcome back. Please sign in to continue with your saved details.'}
                    </p>
                  </div>
                )}

                {loginSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-montserrat font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{loginSuccessMsg}</span>
                  </div>
                )}

                <div className="space-y-3 bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9]">
                  <div>
                    <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Daniel Obiora"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] block mb-1">
                        Phone / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0801 234 5678"
                        value={loginPhone}
                        onChange={(e) => setLoginPhone(e.target.value)}
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] block mb-1">
                        Email (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. daniel@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] block mb-1">
                      Preferred Benin City Branch
                    </label>
                    <select
                      value={customerProfile.preferredBranchId}
                      onChange={(e) =>
                        updateCustomerProfile({ preferredBranchId: e.target.value as BranchId })
                      }
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat font-semibold"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] font-titan text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Save Profile & Login</span>
                  </button>
                </div>
              </form>

              {/* Security note */}
              <div className="p-3 bg-white rounded-xl border border-[#E5DEC9] flex items-center gap-2 text-[11px] font-montserrat text-[#7A6A65]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Your contact details and order history are securely retained in your device browser for instant re-ordering.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#FAF7F2] border-t border-[#E5DEC9] flex items-center justify-between text-xs font-montserrat">
          <span className="text-[#7A6A65]">
            Choplife Republic • 3 Branches across Benin City
          </span>
          <button
            onClick={() => setIsAccountModalOpen(false)}
            className="bg-[#4D080F] text-white font-titan text-xs px-4 py-2 rounded-xl"
          >
            Done
          </button>
        </div>

      </div>

      {/* RECEIPT MODAL SUB-VIEW */}
      {selectedReceiptOrder && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl border-2 border-[#4D080F] animate-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-[#E5DEC9] pb-3">
              <div>
                <span className="text-[10px] font-titan uppercase tracking-widest text-[#E62E00] block">
                  DIGITAL SALES RECEIPT
                </span>
                <h3 className="font-titan text-lg text-[#4D080F]">
                  ORDER #{selectedReceiptOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReceiptOrder(null)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-[#4D080F]" />
              </button>
            </div>

            <div className="text-xs font-mono space-y-1.5 text-[#241311] bg-[#FAF7F2] p-3 rounded-xl">
              <div className="flex justify-between">
                <span>Branch:</span>
                <span className="font-bold">{selectedReceiptOrder.branchId.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(selectedReceiptOrder.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{selectedReceiptOrder.deliveryDetails?.customerName || 'Choplife Citizen'}</span>
              </div>
              <div className="flex justify-between">
                <span>Channel:</span>
                <span>{(selectedReceiptOrder.orderChannel || 'website').toUpperCase()}</span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-[#E5DEC9] py-3 space-y-2 text-xs font-montserrat">
              {(selectedReceiptOrder.items || []).map((i, idx) => {
                const itemName = i.product?.name || (i as any).name || 'Choplife Special';
                const qty = i.quantity || 1;
                const unitPrice = i.unitPrice || i.product?.basePrice || 0;
                return (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {qty}x {itemName}
                    </span>
                    <span className="font-bold">{formatNaira(unitPrice * qty)}</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-[#F0EAE1] flex justify-between text-[#7A6A65]">
                <span>Packaging:</span>
                <span>{formatNaira(selectedReceiptOrder.packagingFee)}</span>
              </div>
              {selectedReceiptOrder.deliveryFee > 0 && (
                <div className="flex justify-between text-[#7A6A65]">
                  <span>Delivery Fee:</span>
                  <span>{formatNaira(selectedReceiptOrder.deliveryFee)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-[#4D080F] flex justify-between font-titan text-sm text-[#4D080F]">
                <span>TOTAL:</span>
                <span className="text-[#E62E00]">{formatNaira(selectedReceiptOrder.total)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  reorder(selectedReceiptOrder);
                  setSelectedReceiptOrder(null);
                  setIsAccountModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#FFC700]" />
                <span>Reorder Items</span>
              </button>
              <button
                onClick={() => setSelectedReceiptOrder(null)}
                className="flex-1 py-2.5 bg-[#4D080F] text-white font-titan text-xs rounded-xl hover:bg-[#38050a] transition-colors"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
