import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { BrandLogo } from '../ui/BrandLogo';
import {
  MapPin,
  ShoppingBag,
  Search,
  Phone,
  MessageCircle,
  User,
  SlidersHorizontal,
  Flame,
  Store,
  Menu as MenuIcon,
  X,
  ShieldCheck,
  Lock,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Truck,
  Clock,
} from 'lucide-react';
import { evaluateBranchOperatingStatus } from '../../utils/branchScheduling';

export interface NavbarProps {
  onNavigateRoute?: (route: 'storefront' | 'pos' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigateRoute }) => {
  const {
    currentBranch,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    setIsSwitchingBranchModalOpen,
    orderType,
    setOrderType,
    cartCount,
    cartSubtotal,
    setIsCartOpen,
    setIsAccountModalOpen,
    setIsAdminModalOpen,
    setIsStaffPosOpen,
    setIsRiderPortalOpen,
    setIsLocationsModalOpen,
    setIsCateringModalOpen,
    setIsStaffLoginModalOpen,
    navigateToOperations,
    currentStaff,
    activeTrackingOrder,
    setActiveTrackingOrder,
    searchQuery,
    setSearchQuery,
    formatNaira,
    getBranchWhatsAppUrl,
    customerProfile,
    loyaltyPoints,
    orders,
  } = useApp();

  const { t } = useLanguage();

  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isBranchDropdownOpen) return;

    const handleScrollClose = (e: Event) => {
      if (branchDropdownRef.current && e.target instanceof Node && branchDropdownRef.current.contains(e.target)) {
        return;
      }
      setIsBranchDropdownOpen(false);
    };

    const handleOutsideClick = (e: MouseEvent) => {
      if (branchDropdownRef.current && e.target instanceof Node && !branchDropdownRef.current.contains(e.target)) {
        setIsBranchDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsBranchDropdownOpen(false);
      }
    };

    window.addEventListener('scroll', handleScrollClose, { capture: true, passive: true });
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleScrollClose, { capture: true } as any);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBranchDropdownOpen]);

  const handleBranchSelect = (branchId: any) => {
    setIsBranchDropdownOpen(false);
    if (branchId !== selectedBranchId) {
      setSelectedBranchId(branchId);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#F0EAE1] shadow-xs" id="main-header">
      {/* Top Notification Bar: Free delivery / Brand banner */}
      <div className="bg-[#4D080F] text-[#FFC700] px-2.5 sm:px-4 py-1.5 text-xs font-montserrat font-medium border-b border-[#6A040F]" id="top-announcement-bar">
        <div className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 min-h-[28px] flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden min-w-0">
            <span className="bg-[#E62E00] text-white text-[9px] sm:text-[10px] font-titan px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Benin
            </span>
            <span className="hidden sm:inline text-white/90 truncate">
              {t('announcement.slogan', 'Enjoy Yourself, Is That Too Much To Ask? 100% Maximum Enjoyment!')}
            </span>
            <span className="sm:hidden text-white/90 text-[10px] truncate">
              {t('announcement.mobile', 'Fresh Small Chops • Bakery • Delivery')}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-white/80 shrink-0">
            <button
              onClick={() => setIsCateringModalOpen(true)}
              className="hover:text-[#FFC700] transition-colors hidden md:flex items-center gap-1 text-[11px]"
              id="top-catering-link"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
              {t('announcement.catering', 'Party & Catering')}
            </button>
            <span className="hidden md:inline text-white/30">|</span>
            <button
              onClick={() => setIsLocationsModalOpen(true)}
              className="hover:text-[#FFC700] transition-colors hidden lg:flex items-center gap-1 text-[11px]"
              id="top-branches-link"
            >
              <MapPin className="w-3.5 h-3.5 text-[#FFC700]" />
              {t('announcement.branches', '3 Benin Branches')}
            </button>
            <span className="hidden lg:inline text-white/30">|</span>
            <a
              href={getBranchWhatsAppUrl(selectedBranchId, 'Hello Choplife, I need assistance with an order.')}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#43E29F] transition-colors flex items-center gap-1 text-[10px] sm:text-[11px]"
              id="top-whatsapp-link"
            >
              <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#43E29F]" />
              <span className="hidden sm:inline">{t('announcement.whatsapp', 'WhatsApp Help')} ({currentBranch.shortName})</span>
              <span className="sm:hidden">Help</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="w-full px-2.5 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-20 gap-1.5 sm:gap-3 min-w-0">
          
          {/* Logo & Slogan */}
          <div className="flex items-center shrink-0">
            <button
              onClick={() => {
                if (onNavigateRoute) onNavigateRoute('storefront');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-left focus:outline-none transition-transform active:scale-95"
              id="nav-brand-logo-btn"
            >
              <BrandLogo variant="full" size="md" />
            </button>
          </div>

          {/* Center: Branch Selector & Delivery/Pickup Toggle */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
            {/* Branch Selector Dropdown */}
            <div className="relative" ref={branchDropdownRef}>
              <button
                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                className="flex items-center gap-1.5 xl:gap-2 bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#241311] px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-xl border border-[#E5DEC9] transition-all text-xs font-montserrat font-semibold shadow-2xs"
                id="branch-selector-desktop"
              >
                <div className="w-5 h-5 xl:w-6 xl:h-6 rounded-full bg-[#E62E00]/10 text-[#E62E00] flex items-center justify-center shrink-0">
                  <MapPin className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-[#E62E00]" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] xl:text-[10px] text-[#7A6A65] font-normal leading-tight">Ordering from</p>
                  <p className="text-[11px] xl:text-xs font-bold text-[#4D080F] flex items-center gap-1.5 whitespace-nowrap">
                    {currentBranch.shortName}
                    {(() => {
                      const status = evaluateBranchOperatingStatus(selectedBranchId);
                      return (
                        <span
                          title={status.isOpen ? `Open (${status.publicHours} WAT)` : `Closed • ${status.nextOpenNotice || ''}`}
                          className={`w-2 h-2 rounded-full inline-block ${status.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}
                        />
                      );
                    })()}
                  </p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#7A6A65] transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Branch Dropdown Menu */}
              {isBranchDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#E5DEC9] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150" id="branch-dropdown-menu">
                  <div className="px-3 py-2 border-b border-[#F0EAE1]">
                    <p className="text-[11px] font-bold text-[#4D080F] uppercase tracking-wider font-montserrat">
                      Select Benin City Branch
                    </p>
                    <p className="text-[10px] text-[#7A6A65]">Menu and delivery zones vary by location • WAT UTC+1</p>
                  </div>
                  {branches.map((b) => {
                    const bStatus = evaluateBranchOperatingStatus(b.id);
                    return (
                      <button
                        key={b.id}
                        onClick={() => handleBranchSelect(b.id)}
                        className={`w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-[#FAF7F2] transition-colors ${
                          selectedBranchId === b.id ? 'bg-[#FFF8E7] border-l-4 border-[#E62E00]' : ''
                        }`}
                        id={`branch-option-${b.id}`}
                      >
                        <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${selectedBranchId === b.id ? 'text-[#E62E00]' : 'text-gray-400'}`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-[#241311] truncate">{b.name}</p>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                bStatus.isOpen ? 'text-emerald-800 bg-emerald-100' : 'text-amber-800 bg-amber-100'
                              }`}
                            >
                              {bStatus.isOpen ? 'OPEN' : 'CLOSED'}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#7A6A65] font-mono mt-0.5">
                            {bStatus.isOpen ? `${bStatus.publicHours} WAT` : (bStatus.nextOpenNotice || 'Closed')}
                          </p>
                          <p className="text-[11px] text-[#7A6A65] line-clamp-1 mt-0.5">{b.address}</p>
                        </div>
                      </button>
                    );
                  })}
                  <div className="p-2 border-t border-[#F0EAE1] bg-[#FAF7F2]">
                    <button
                      onClick={() => {
                        setIsBranchDropdownOpen(false);
                        setIsLocationsModalOpen(true);
                      }}
                      className="w-full text-center text-xs font-bold text-[#E62E00] hover:underline py-1"
                      id="view-all-branches-link"
                    >
                      View Branch Hours, Photos & Maps →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Order Type Toggle (Delivery vs Pickup) */}
            <div className="bg-[#FAF7F2] p-1 rounded-xl border border-[#E5DEC9] flex items-center shrink-0" id="order-type-toggle">
              <button
                onClick={() => setOrderType('delivery')}
                className={`flex items-center gap-1 px-2.5 xl:px-3 py-1.5 rounded-lg text-[11px] xl:text-xs font-montserrat font-bold transition-all whitespace-nowrap ${
                  orderType === 'delivery'
                    ? 'bg-[#E62E00] text-white shadow-xs'
                    : 'text-[#5C4D49] hover:text-[#241311]'
                }`}
                id="toggle-delivery-btn"
              >
                <Truck className="w-3.5 h-3.5" />
                {t('nav.delivery', 'Delivery')}
              </button>
              <button
                onClick={() => setOrderType('pickup')}
                className={`flex items-center gap-1 px-2.5 xl:px-3 py-1.5 rounded-lg text-[11px] xl:text-xs font-montserrat font-bold transition-all whitespace-nowrap ${
                  orderType === 'pickup'
                    ? 'bg-[#E62E00] text-white shadow-xs'
                    : 'text-[#5C4D49] hover:text-[#241311]'
                }`}
                id="toggle-pickup-btn"
              >
                <Store className="w-3.5 h-3.5" />
                {t('nav.pickup', 'Pickup')}
              </button>
            </div>
          </div>

          {/* Right Action Icons & Cart */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0">
            {/* Search Bar */}
            <div className="relative hidden lg:block">
              <input
                type="text"
                placeholder={t('nav.search_placeholder', 'Search menu...')}
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  const wasEmpty = !searchQuery.trim();
                  setSearchQuery(val);
                  if (wasEmpty && val.trim()) {
                    setTimeout(() => {
                      document.getElementById('menu-explorer-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    document.getElementById('menu-explorer-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="w-28 xl:w-44 2xl:w-52 pl-8 pr-6 py-2 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs font-montserrat text-[#241311] placeholder:text-[#8E7E7A] focus:outline-none focus:ring-2 focus:ring-[#E62E00]/30 focus:border-[#E62E00] transition-all"
                id="desktop-search-input"
                aria-label="Search menu products"
              />
              <Search className="w-3.5 h-3.5 text-[#8E7E7A] absolute left-2.5 top-2.5" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-xs text-[#8E7E7A] hover:text-black"
                  id="desktop-search-clear-btn"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Mobile / Tablet Search Toggle */}
            <button
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              className="lg:hidden p-1.5 sm:p-2 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-[#4D080F] shrink-0"
              id="mobile-search-toggle"
              aria-label="Search Menu"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Active Order Tracker Button (if customer has active order) */}
            {activeTrackingOrder && (
              <button
                onClick={() => setActiveTrackingOrder(activeTrackingOrder)}
                className="hidden 2xl:flex items-center gap-1.5 bg-[#43E29F]/20 text-[#006039] border border-[#43E29F] px-2.5 py-1.5 rounded-xl text-xs font-montserrat font-bold animate-pulse hover:bg-[#43E29F]/30 transition-colors shrink-0"
                id="active-order-tracking-btn"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                {t('nav.track_order', 'Track Order')}
              </button>
            )}


            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-launch-video'));
              }}
              className="hidden xl:flex items-center gap-1.5 text-xs font-titan text-[#FFC700] bg-[#800D15] hover:bg-[#A3121B] px-3 py-1.5 rounded-xl border border-[#FFC700]/40 transition-all shadow-sm shrink-0"
              id="nav-launch-video-btn"
              title="Watch Official Launch Film"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>Launch Video</span>
            </button>

            {/* Language Switcher Component (Visible from md+; already in top announcement bar & mobile menu on <md) */}
            <div className="hidden md:block shrink-0">
              <LanguageSwitcher variant="compact" />
            </div>

            {/* Order History Direct Shortcut */}
            {orders.length > 0 && (
              <button
                onClick={() => setIsAccountModalOpen(true)}
                className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#FFF8E7] hover:bg-[#FFEEC2] border border-[#FFC700] text-[#4D080F] transition-all active:scale-95 shadow-2xs shrink-0"
                id="nav-orders-history-shortcut-btn"
                title="View Past Orders & Reorder"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#E62E00]" />
                <span className="text-xs font-montserrat font-bold">
                  Orders ({orders.length})
                </span>
              </button>
            )}

            {/* Account / Order Again */}
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="p-1.5 sm:px-2.5 sm:py-2 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-[#4D080F] hover:bg-[#F2ECE1] transition-all flex items-center gap-1.5 shrink-0"
              id="nav-account-btn"
              title="Customer Account & Order History"
            >
              <User className="w-4 h-4 text-[#4D080F]" />
              <span className="hidden xl:inline text-xs font-montserrat font-bold max-w-24 truncate">
                {customerProfile.isLoggedIn && customerProfile.name
                  ? customerProfile.name.split(' ')[0]
                  : t('nav.account', 'Account')}
              </span>
              {loyaltyPoints > 0 && (
                <span className="hidden md:inline text-[10px] font-titan text-[#4D080F] bg-[#FFC700] px-1.5 py-0.2 rounded-md">
                  {loyaltyPoints}pt
                </span>
              )}
            </button>

            {/* Primary Action: Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-1 sm:gap-2 bg-[#E62E00] hover:bg-[#C92200] text-white px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-montserrat font-bold text-xs shadow-md transition-all active:scale-95 group shrink-0 whitespace-nowrap z-10 cursor-pointer"
              id="nav-cart-btn"
              aria-label="Order Cart"
            >
              <div className="relative flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFC700] transition-transform group-hover:scale-110" />
                {cartCount > 0 && (
                  <span
                    className="absolute -top-2 -right-2.5 bg-[#FFC700] text-[#4D080F] font-titan text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center border border-[#4D080F] shadow-xs"
                    id="cart-item-count-badge"
                  >
                    {cartCount}
                  </span>
                )}
              </div>
              {cartCount > 0 ? (
                <span className="font-titan text-[11px] sm:text-xs tracking-wide whitespace-nowrap pl-1">
                  {formatNaira(cartSubtotal)}
                </span>
              ) : (
                <>
                  <span className="sm:hidden font-titan text-[10px] tracking-wide">
                    CART
                  </span>
                  <span className="hidden sm:inline font-titan text-xs tracking-wide">
                    {t('nav.order_cart', 'ORDER CART')}
                  </span>
                </>
              )}
            </button>

            {/* Mobile Hamburger menu */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-1.5 sm:p-2 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-[#4D080F] shrink-0"
              id="mobile-menu-btn"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <MenuIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Search Expandable Box (Matches lg:hidden on #mobile-search-toggle) */}
        {isSearchExpanded && (
          <div className="lg:hidden pb-3 pt-1 animate-in fade-in duration-150">
            <div className="relative">
              <input
                type="text"
                placeholder="Search shawarma, small chops, bread, jollof, drinks..."
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  const wasEmpty = !searchQuery.trim();
                  setSearchQuery(val);
                  if (wasEmpty && val.trim()) {
                    setTimeout(() => {
                      document.getElementById('menu-explorer-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    document.getElementById('menu-explorer-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="w-full pl-9 pr-8 py-2 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs font-montserrat text-[#241311] placeholder:text-[#8E7E7A] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                id="mobile-search-input"
                autoFocus
              />
              <Search className="w-4 h-4 text-[#8E7E7A] absolute left-3 top-2.5" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-xs text-[#8E7E7A]"
                  id="mobile-search-clear-btn"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-[#E5DEC9] px-4 py-4 space-y-4 shadow-xl animate-in slide-in-from-top-4 duration-200" id="mobile-menu-drawer">
          {/* Branch Picker on Mobile */}
          <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#E5DEC9]">
            <p className="text-[11px] font-bold text-[#7A6A65] uppercase mb-2">Select Your Ordering Branch</p>
            <div className="grid grid-cols-3 gap-2">
              {branches.map((b) => {
                const bStatus = evaluateBranchOperatingStatus(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      handleBranchSelect(b.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`p-2 rounded-xl text-center border text-xs font-montserrat font-bold transition-all ${
                      selectedBranchId === b.id
                        ? 'bg-[#E62E00] text-white border-[#E62E00] shadow-xs'
                        : 'bg-white text-[#4D080F] border-[#E5DEC9]'
                    }`}
                    id={`mobile-branch-btn-${b.id}`}
                  >
                    <p className="truncate">{b.shortName}</p>
                    <span
                      className={`text-[9px] block font-bold ${
                        selectedBranchId === b.id
                          ? 'text-[#FFC700]'
                          : bStatus.isOpen
                          ? 'text-emerald-700'
                          : 'text-amber-800'
                      }`}
                    >
                      {bStatus.isOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delivery vs Pickup Toggle Mobile */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setOrderType('delivery')}
              className={`py-2 rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 border ${
                orderType === 'delivery'
                  ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F]'
                  : 'bg-[#FAF7F2] text-[#5C4D49] border-[#E5DEC9]'
              }`}
              id="mobile-delivery-toggle-btn"
            >
              <Truck className="w-3.5 h-3.5" />
              {t('nav.delivery', 'Delivery')}
            </button>
            <button
              onClick={() => setOrderType('pickup')}
              className={`py-2 rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 border ${
                orderType === 'pickup'
                  ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F]'
                  : 'bg-[#FAF7F2] text-[#5C4D49] border-[#E5DEC9]'
              }`}
              id="mobile-pickup-toggle-btn"
            >
              <Store className="w-3.5 h-3.5" />
              {t('nav.pickup', 'Pickup')}
            </button>
          </div>

          {/* Mobile Language Switcher Row */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9]">
            <div className="flex items-center gap-2">
              <span className="text-base">🌐</span>
              <span className="text-xs font-montserrat font-bold text-[#4D080F]">
                {t('lang.language', 'Language')}
              </span>
            </div>
            <LanguageSwitcher variant="compact" />
          </div>

          {/* Fast Navigation Links */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F0EAE1] text-xs font-montserrat font-bold">
            <button
              onClick={() => {
                setIsLocationsModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF7F2] text-[#4D080F]"
              id="mobile-nav-branches"
            >
              <MapPin className="w-4 h-4 text-[#E62E00]" />
              Branch Locations
            </button>
            <button
              onClick={() => {
                setIsCateringModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF7F2] text-[#4D080F]"
              id="mobile-nav-catering"
            >
              <Sparkles className="w-4 h-4 text-[#FFC700]" />
              Party & Catering
            </button>
            <button
              onClick={() => {
                setIsAccountModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF7F2] text-[#4D080F]"
              id="mobile-nav-account"
            >
              <User className="w-4 h-4 text-[#E62E00]" />
              My Orders & Profile
            </button>
            {currentStaff && (
              <div className="col-span-2 pt-2 border-t border-[#F0EAE1] grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (onNavigateRoute) onNavigateRoute('pos');
                    else navigateToOperations('pos');
                  }}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-[#4D080F] text-[#FFC700] text-xs font-bold"
                  id="mobile-nav-pos-btn"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Front Office (POS)</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (onNavigateRoute) onNavigateRoute('admin');
                    else setIsAdminModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-[#FFC700] text-[#4D080F] text-xs font-bold"
                  id="mobile-nav-admin-btn"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#800D15]" />
                  <span>Back Office (Admin)</span>
                </button>
              </div>
            )}
            <button
              onClick={() => {
                setIsCartOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="col-span-2 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#E62E00] text-white"
              id="mobile-nav-view-cart"
            >
              <ShoppingBag className="w-4 h-4 text-[#FFC700]" />
              View Cart ({cartCount})
            </button>
          </div>

          {/* Direct WhatsApp Call to Action for Selected Branch */}
          <a
            href={getBranchWhatsAppUrl(selectedBranchId, `Hello Choplife Republic (${currentBranch.name}), I would like to place an order.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-xl font-montserrat font-bold text-xs shadow-xs"
            id="mobile-nav-whatsapp-cta"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            Order via WhatsApp ({currentBranch.shortName})
          </a>
        </div>
      )}
    </header>
  );
};
