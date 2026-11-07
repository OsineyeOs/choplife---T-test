import React from 'react';
import { useApp } from '../../context/AppContext';
import { Home, UtensilsCrossed, ClipboardList, ShoppingBag, ArrowRight } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const {
    cartCount,
    cartTotal,
    setIsCartOpen,
    setIsAccountModalOpen,
    activeTrackingOrder,
    setActiveTrackingOrder,
    orders,
    formatNaira,
  } = useApp();

  const scrollToMenu = () => {
    const el = document.getElementById('menu-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenOrders = () => {
    if (activeTrackingOrder) {
      setActiveTrackingOrder({ ...activeTrackingOrder });
    } else if (orders.length > 0) {
      setActiveTrackingOrder(orders[0]);
    } else {
      setIsAccountModalOpen(true);
    }
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
      {/* Sticky Cart Summary Bar when items are in cart */}
      {cartCount > 0 && (
        <div className="px-3 pb-2 bg-gradient-to-t from-black/30 to-transparent">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            id="mobile-sticky-cart-summary-bar"
            className="w-full bg-[#E62E00] hover:bg-[#C92200] text-white rounded-2xl px-4 py-3 shadow-xl border border-[#FFC700]/40 flex items-center justify-between transition-all active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-[#FFC700] text-[#241311] font-titan text-xs px-2.5 py-1 rounded-lg">
                {cartCount} {cartCount === 1 ? ' item' : ' items'}
              </span>
              <span className="font-titan text-xs sm:text-sm tracking-wide">
                VIEW CART & CHECKOUT
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-titan text-sm text-[#FFC700]">
              <span>{formatNaira(cartTotal)}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* 4-Item Customer-Centric Bottom Navigation: Home, Menu, Orders, Cart */}
      <nav
        aria-label="Mobile Customer Navigation"
        className="bg-white/95 backdrop-blur-md border-t border-[#E5DEC9] shadow-2xl px-2 py-1.5"
        id="mobile-bottom-nav"
      >
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          <button
            type="button"
            onClick={scrollToTop}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl text-[#4D080F] hover:bg-[#FFF8E7] transition-colors"
            id="mobile-nav-home"
          >
            <Home className="w-5 h-5 text-[#4D080F]" />
            <span className="text-[10px] font-montserrat font-bold mt-0.5">Home</span>
          </button>

          <button
            type="button"
            onClick={scrollToMenu}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl text-[#4D080F] hover:bg-[#FFF8E7] transition-colors"
            id="mobile-nav-menu"
          >
            <UtensilsCrossed className="w-5 h-5 text-[#E62E00]" />
            <span className="text-[10px] font-montserrat font-bold mt-0.5">Menu</span>
          </button>

          <button
            type="button"
            onClick={handleOpenOrders}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl text-[#4D080F] hover:bg-[#FFF8E7] transition-colors relative"
            id="mobile-nav-orders"
          >
            <ClipboardList className="w-5 h-5 text-[#4D080F]" />
            <span className="text-[10px] font-montserrat font-bold mt-0.5">Orders</span>
            {orders.length > 0 && (
              <span className="absolute top-1 right-5 w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl bg-[#E62E00] text-white shadow-md relative active:scale-95 transition-transform"
            id="mobile-nav-cart"
          >
            <ShoppingBag className="w-5 h-5 text-[#FFC700]" />
            <span className="text-[10px] font-titan mt-0.5">
              {cartCount > 0 ? formatNaira(cartTotal) : 'Cart'}
            </span>
            {cartCount > 0 && (
              <span className="absolute -top-1 right-2 bg-[#FFC700] text-[#4D080F] font-titan text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>
    </div>
  );
};
