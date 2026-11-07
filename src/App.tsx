import React, { useState, useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import { LanguageProvider } from './context/LanguageContext';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { ReturnToTopButton } from './components/layout/ReturnToTopButton';
import { Footer } from './components/layout/Footer';
import { OrderingFirstHero } from './components/home/OrderingFirstHero';
import { DealsSection } from './components/home/DealsSection';
import { SmallChopsHighlight } from './components/home/SmallChopsHighlight';
import { BakerySection } from './components/home/BakerySection';
import { MenuExplorer } from './components/menu/MenuExplorer';
import { ExperienceSection } from './components/home/ExperienceSection';
import { SocialProofReviews } from './components/home/SocialProofReviews';
import { ProductDetailModal } from './components/menu/ProductDetailModal';
import { SmallChopsBuilderModal } from './components/menu/SmallChopsBuilderModal';
import { CartDrawer } from './components/cart/CartDrawer';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { OrderTrackerModal } from './components/orders/OrderTrackerModal';
import { LocationsModal } from './components/locations/LocationsModal';
import { CateringModal } from './components/catering/CateringModal';
import { ReviewModal } from './components/reviews/ReviewModal';
import { AccountModal } from './components/account/AccountModal';
import { AiChatbotModal } from './components/ai/AiChatbotModal';
import { StaffLoginModal } from './components/auth/StaffLoginModal';
import { CartFeedbackToast } from './components/cart/CartFeedbackToast';
import { StaffOperationsWorkspace } from './components/staff/StaffOperationsWorkspace';
import { InterfaceLoginPortal } from './components/auth/InterfaceLoginPortal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useApp } from './context/AppContext';
import {
  ShieldAlert,
  ArrowLeft,
  Store,
  ShieldCheck,
  LogOut,
  Eye,
} from 'lucide-react';

import { CfdDisplayPage } from './components/cfd/CfdDisplayPage';
import { LaunchVideoShowcaseModal } from './components/video/LaunchVideoShowcaseModal';

export type AppRoute = 'storefront' | 'pos' | 'admin' | 'cfd';

export function getInitialRoute(): AppRoute {
  if (typeof window === 'undefined') return 'storefront';
  const path = (window.location.pathname || '').toLowerCase();
  const hash = (window.location.hash || '').toLowerCase().replace(/^#\/?/, '');

  if (path === '/cfd' || path.startsWith('/cfd/') || hash === 'cfd' || hash.startsWith('cfd/')) {
    return 'cfd';
  }
  if (path === '/pos' || path.startsWith('/pos/') || hash === 'pos' || hash.startsWith('pos/')) {
    return 'pos';
  }
  if (path === '/admin' || path.startsWith('/admin/') || hash === 'admin' || hash.startsWith('admin/')) {
    return 'admin';
  }
  return 'storefront';
}

export function ChoplifeApp() {
  const {
    isStaffLoginModalOpen,
    setIsStaffLoginModalOpen,
    currentStaff,
    logoutStaff,
    isStorefrontPreviewActive,
    setIsStorefrontPreviewActive,
    searchQuery,
    setSearchQuery,
    setActiveCategory,
    setIsSmallChopsBuilderOpen,
  } = useApp();

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(getInitialRoute);
  const [isLaunchVideoOpen, setIsLaunchVideoOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash === '#launch-video' || window.location.search.includes('video');
    }
    return false;
  });

  // Sync route on browser navigation (Back, Forward, hash change)
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute(getInitialRoute());
      if (window.location.hash === '#launch-video' || window.location.search.includes('video')) {
        setIsLaunchVideoOpen(true);
      }
    };
    const handleOpenVideoEvent = () => setIsLaunchVideoOpen(true);

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('open-launch-video', handleOpenVideoEvent);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('open-launch-video', handleOpenVideoEvent);
    };
  }, []);

  const navigateRoute = (newRoute: AppRoute) => {
    if (newRoute !== 'storefront') {
      setIsStorefrontPreviewActive(false);
    }
    if (typeof window !== 'undefined') {
      const targetPath = newRoute === 'storefront' ? '/' : `/${newRoute}`;
      try {
        window.history.pushState(null, '', targetPath);
      } catch {
        // Fallback for restricted sandboxes
      }
      if (newRoute === 'storefront') {
        if (window.location.hash && (window.location.hash.includes('pos') || window.location.hash.includes('admin'))) {
          window.location.hash = '';
        }
      } else {
        window.location.hash = `#${newRoute}`;
      }
    }
    setCurrentRoute(newRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isSearching = Boolean(searchQuery && searchQuery.trim().length > 0);
  const canAccessBackend = [
    'super_admin',
    'corporate_admin',
    'admin',
    'branch_manager',
    'store_manager',
    'storekeeper',
    'accountant',
    'auditor',
    'content_editor',
    'menu_manager',
  ].includes(currentStaff?.role || '');

  // -------------------------------------------------------------
  // INTERFACE 4: STANDALONE CUSTOMER FACING DISPLAY (/cfd)
  // -------------------------------------------------------------
  if (currentRoute === 'cfd') {
    return (
      <ErrorBoundary moduleName="Customer Facing Display">
        <CfdDisplayPage onReturnHome={() => navigateRoute('storefront')} />
      </ErrorBoundary>
    );
  }

  // -------------------------------------------------------------
  // INTERFACE 2: FRONT-OFFICE OPERATIONS (/pos)
  // -------------------------------------------------------------
  if (currentRoute === 'pos' && !isStorefrontPreviewActive) {
    if (!currentStaff) {
      return (
        <ErrorBoundary moduleName="Front-Office Login">
          <InterfaceLoginPortal mode="pos" onNavigateRoute={navigateRoute} />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary moduleName="Front-Office Operations Workspace">
        <StaffOperationsWorkspace initialMode="pos" onNavigateRoute={navigateRoute} />
      </ErrorBoundary>
    );
  }

  // -------------------------------------------------------------
  // INTERFACE 3: BACK-OFFICE ADMINISTRATION (/admin)
  // -------------------------------------------------------------
  if (currentRoute === 'admin' && !isStorefrontPreviewActive) {
    if (!currentStaff) {
      return (
        <ErrorBoundary moduleName="Back-Office Login">
          <InterfaceLoginPortal mode="admin" onNavigateRoute={navigateRoute} />
        </ErrorBoundary>
      );
    }

    // Role-based access validation for back-office administration
    if (!canAccessBackend) {
      return (
        <div className="min-h-screen bg-[#FAF7F2] text-[#241311] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E5DEC9] rounded-3xl p-8 text-center shadow-xl space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-[#800D15]">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#241311] uppercase tracking-wide">
                Access Restricted
              </h1>
              <p className="text-xs text-[#7A6A65] mt-2 leading-relaxed">
                Your staff account (<strong>{currentStaff.name}</strong>, role:{' '}
                <span className="text-[#800D15] uppercase font-bold">
                  {currentStaff.role.replace('_', ' ')}
                </span>
                ) is restricted to frontline operational duties and does not have administrative back-office privileges.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={() => navigateRoute('pos')}
                className="w-full py-3 px-4 rounded-xl bg-[#800D15] hover:bg-[#A3121B] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Store className="w-4 h-4 text-[#FFC700]" />
                <span>Go to Front-Office POS &rarr;</span>
              </button>
              <button
                onClick={() => navigateRoute('storefront')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FAF7F2] hover:bg-[#E5DEC9]/60 text-[#241311] border border-[#E5DEC9] font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Storefront</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <ErrorBoundary moduleName="Back-Office Administration Workspace">
        <StaffOperationsWorkspace initialMode="admin" onNavigateRoute={navigateRoute} />
      </ErrorBoundary>
    );
  }

  // -------------------------------------------------------------
  // INTERFACE 1: CUSTOMER STOREFRONT (/) OR CMS STOREFRONT PREVIEW
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#241311] flex flex-col selection:bg-[#FFC700] selection:text-[#4D080F]">
      {/* Storefront Preview Mode Banner (when triggered from CMS or Operations) */}
      {isStorefrontPreviewActive && (
        <div
          id="storefront-preview-banner"
          className="bg-[#FFF8E7] border-b-2 border-[#FFC700] px-4 py-2.5 text-xs text-[#4D080F] flex items-center justify-between sticky top-0 z-50 shadow-sm"
        >
          <div className="flex items-center gap-2 font-bold">
            <Eye className="w-4 h-4 text-[#800D15]" />
            <span>Storefront Preview Mode Active</span>
            <span className="hidden sm:inline text-[#7A6A65] font-medium">
              — Reviewing live &amp; draft CMS content on the customer storefront
            </span>
          </div>
          <button
            id="exit-storefront-preview-btn"
            onClick={() => setIsStorefrontPreviewActive(false)}
            className="px-3.5 py-1.5 bg-[#800D15] hover:bg-[#4D080F] text-white text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Exit Preview &amp; Return to {currentRoute === 'admin' ? 'CMS / Admin' : 'Workspace'}</span>
          </button>
        </div>
      )}

      {/* Staff Storefront Navigation Bar when Staff is Authenticated */}
      {currentStaff && !isStorefrontPreviewActive && (
        <div
          id="staff-active-workspace-bar"
          className="bg-[#4D080F] border-b border-[#FFC700]/30 px-3 sm:px-6 py-2 text-xs text-[#FAF7F2] flex flex-wrap items-center justify-between gap-2 sticky top-0 z-50 shadow-md"
        >
          <div className="flex items-center gap-2 font-medium min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse shrink-0" />
            <span className="font-bold text-[#FFC700] shrink-0">Staff Workspace:</span>
            <span className="text-[#FAF7F2]/90 truncate">
              <strong>{currentStaff.name}</strong>{' '}
              <span className="hidden xs:inline">({currentStaff.role.replace(/_/g, ' ')})</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="px-2.5 py-1 bg-white/15 text-[#FFC700] text-[11px] font-bold rounded-lg border border-[#FFC700]/30 hidden sm:inline-flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>Storefront</span>
            </span>
            <button
              id="switch-to-pos-workspace-btn"
              onClick={() => navigateRoute('pos')}
              className="px-2.5 sm:px-3 py-1.5 bg-[#800D15] hover:bg-[#A3121B] text-white text-[11px] sm:text-xs font-bold rounded-lg border border-[#FFC700]/40 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-[#FFC700] shrink-0" />
              <span>Front Office (POS)</span>
            </button>
            {canAccessBackend && (
              <button
                id="switch-to-admin-workspace-btn"
                onClick={() => navigateRoute('admin')}
                className="px-2.5 sm:px-3 py-1.5 bg-[#FFC700] hover:bg-[#FFD733] text-[#4D080F] text-[11px] sm:text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#4D080F] shrink-0" />
                <span>Back Office</span>
              </button>
            )}
            <button
              onClick={async () => {
                await logoutStaff();
                navigateRoute('storefront');
              }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-red-600/30 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Logout Staff"
              aria-label="Logout Staff"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header Navigation */}
      <Navbar onNavigateRoute={navigateRoute} />

      {/* Main Page Layout */}
      <main className="flex-1 pb-24 md:pb-0">
        {/* 1. First-Screen Ordering Entry: ORDER SMALL CHOPS / ORDER FOOD + Branch/Fulfilment + Verified Bestsellers */}
        {!isSearching && (
          <OrderingFirstHero
            onSelectOrderPath={(path) => {
              if (path === 'small-chops') {
                setSearchQuery('');
                setActiveCategory('small-chops');
              } else if (path === 'food') {
                setSearchQuery('');
                setActiveCategory('food');
              } else if (path === 'mini-packs') {
                setActiveCategory('small-chops');
                setSearchQuery('Mini Pack');
              }
              const menuEl = document.getElementById('menu-section');
              if (menuEl) {
                menuEl.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            onOpenBoxBuilder={() => setIsSmallChopsBuilderOpen(true)}
          />
        )}

        {/* 2. Full Multi-Category Menu Explorer with Cart-Authoritative Product Cards */}
        <MenuExplorer />

        {/* 3. Secondary Curated Spotlights (Below Menu Explorer so Ordering is Always First) */}
        {!isSearching && (
          <>
            {/* Combos & Party Platters */}
            <DealsSection />

            {/* Dedicated Small Chops Spotlight & Box Builder Trigger */}
            <SmallChopsHighlight />

            {/* Dedicated Choplife Bakery Spotlight (100% Bromate-Free Bread) */}
            <BakerySection />

            {/* Dine-In, Lounge, Games & Private Table Reservations */}
            <ExperienceSection />

            {/* Social Proof, Verified Reviews & Rating Showcase */}
            <SocialProofReviews />
          </>
        )}
      </main>

      {/* Rich Footer with Branch Details, Social Media & WhatsApp Catalogue Shortcuts */}
      <Footer onNavigateRoute={navigateRoute} />

      {/* Accessible Return to Top Control */}
      <ReturnToTopButton />

      {/* Mobile Sticky Bottom Navigation */}
      <MobileNav />

      {/* Modals & Overlays */}
      <CartFeedbackToast />
      <ProductDetailModal />
      <SmallChopsBuilderModal />
      <CartDrawer />
      <CheckoutModal />
      <OrderTrackerModal />
      <LocationsModal />
      <CateringModal />
      <ReviewModal />
      <AccountModal />
      <AiChatbotModal />
      <StaffLoginModal
        isOpen={isStaffLoginModalOpen}
        onClose={() => setIsStaffLoginModalOpen(false)}
      />
      <LaunchVideoShowcaseModal
        isOpen={isLaunchVideoOpen}
        onClose={() => setIsLaunchVideoOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AppProvider>
          <ChoplifeApp />
        </AppProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
