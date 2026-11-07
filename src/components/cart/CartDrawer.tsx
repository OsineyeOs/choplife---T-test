import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  MessageCircle,
  Tag,
  ShieldCheck,
  Truck,
  Store,
  ChevronRight,
  Info,
  RotateCcw,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { evaluateBranchOperatingStatus } from '../../utils/branchScheduling';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartCount,
    cartSubtotal,
    cartPackagingFee,
    deliveryFee,
    cartDiscount,
    cartTotal,
    amountAwayFromFreeDelivery,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    orderType,
    setOrderType,
    currentBranch,
    selectedBranchId,
    formatNaira,
    setIsCheckoutOpen,
    generateWhatsAppCartText,
    getBranchWhatsAppUrl,
    products,
    addToCart,
    orders,
    setIsAccountModalOpen,
  } = useApp();

  const [couponInput, setCouponInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{ success?: boolean; message?: string } | null>(null);
  const cartScrollRef = useRef<HTMLDivElement | null>(null);
  const prevCartLengthRef = useRef<number>(cart.length);

  useEffect(() => {
    if (!isCartOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCartOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCartOpen, setIsCartOpen]);

  useEffect(() => {
    if (isCartOpen && cart.length > prevCartLengthRef.current && cartScrollRef.current) {
      const lastItem = cart[cart.length - 1];
      const itemEl = lastItem ? document.getElementById(`cart-item-${lastItem.id}`) : null;
      if (itemEl && typeof itemEl.scrollIntoView === 'function') {
        itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        cartScrollRef.current.scrollTo({ top: cartScrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }
    prevCartLengthRef.current = cart.length;
  }, [cart.length, isCartOpen]);

  if (!isCartOpen) return null;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput) return;
    const res = applyCoupon(couponInput);
    setCouponFeedback(res);
    if (res.success) {
      setCouponInput('');
    }
  };

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  // Upsell suggestions (e.g. Zobo, Chicken Pie, Parfait)
  const upsellItems = products
    .filter((p) => (p.id === 'prod-drink-zobo-1000' || p.id === 'prod-snack-chicken-pie' || p.id === 'prod-drink-parfait-sm') && !cart.some((c) => c.productId === p.id))
    .slice(0, 2);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      id="cart-drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Your Order Cart"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsCartOpen(false);
        }
      }}
    >
      <div
        className="bg-white w-full sm:max-w-md h-dvh max-h-dvh flex flex-col overflow-hidden shadow-2xl border-l border-[#E5DEC9] animate-in slide-in-from-right duration-250"
        id="cart-drawer"
      >
        {/* Cart Header (Pinned Top) */}
        <div className="px-4 py-3 sm:py-3.5 bg-[#4D080F] text-white flex items-center justify-between shrink-0 shadow-md z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center font-titan text-lg shrink-0">
              🛒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-titan text-base sm:text-lg text-white leading-tight">
                  YOUR ORDER CART
                </h2>
                <span className="bg-[#E62E00] text-[#FFC700] font-titan text-[10px] px-2 py-0.5 rounded-full">
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-[11px] text-white/75 font-montserrat">
                Branch: <span className="font-bold text-[#FFC700]">{currentBranch.shortName}</span>
                {orderType === 'delivery' ? ' • 30–90 mins delivery' : ' • Branch Pickup'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(false)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            id="close-cart-btn"
            aria-label="Close Cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pinned Fulfilment Toggle Sub-header */}
        <div className="px-4 py-2 bg-[#FAF7F2] border-b border-[#E5DEC9] shrink-0">
          <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-[#E5DEC9]">
            <button
              type="button"
              onClick={() => setOrderType('delivery')}
              className={`py-1.5 rounded-lg text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                orderType === 'delivery'
                  ? 'bg-[#E62E00] text-white shadow-xs'
                  : 'text-[#5C4D49] hover:text-black'
              }`}
              id="cart-delivery-btn"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Delivery ({formatNaira(deliveryFee)})</span>
            </button>
            <button
              type="button"
              onClick={() => setOrderType('pickup')}
              className={`py-1.5 rounded-lg text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                orderType === 'pickup'
                  ? 'bg-[#E62E00] text-white shadow-xs'
                  : 'text-[#5C4D49] hover:text-black'
              }`}
              id="cart-pickup-btn"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Pickup (Free)</span>
            </button>
          </div>
        </div>

        {/* Single Scrollable Cart Items & Upsell Body */}
        <div
          ref={cartScrollRef}
          className="p-3.5 sm:p-4 space-y-3.5 flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth"
        >
          {/* Empty Cart State */}
          {cart.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#FAF7F2] border border-[#E5DEC9] flex items-center justify-center font-titan text-2xl mx-auto text-[#4D080F]">
                🥘
              </div>
              <h3 className="font-titan text-lg text-[#4D080F]">Your cart is empty!</h3>
              <p className="text-xs text-[#7A6A65] font-montserrat max-w-xs mx-auto">
                Explore our famous small chops, double shawarmas, firewood party jollof, and flame grills.
              </p>
              <div className="flex flex-col gap-2 max-w-xs mx-auto pt-2">
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    const el = document.getElementById('menu-explorer-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs px-6 py-3 rounded-xl shadow-md transition-all active:scale-95"
                >
                  BROWSE MENU NOW
                </button>

                {orders.length > 0 && (
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsAccountModalOpen(true);
                    }}
                    className="w-full bg-[#FFF8E7] hover:bg-[#FFEEC2] text-[#4D080F] border border-[#FFC700] font-montserrat font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    id="cart-empty-reorder-history-btn"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#E62E00]" />
                    <span>Reorder from Past Orders ({orders.length})</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#FAF7F2] rounded-2xl p-3 border border-[#E5DEC9] space-y-2 relative"
                  id={`cart-item-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <img
                      src={item.product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                      alt={item.product.name}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[#E5DEC9]"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-titan text-xs sm:text-sm text-[#241311] leading-snug line-clamp-2">
                        {item.product.name}
                      </h4>
                      <p className="font-titan text-[11px] text-[#E62E00] mt-0.5">
                        {formatNaira(item.unitPrice)} each
                      </p>

                      {/* Customization Badges */}
                      {item.customization?.selectedOptions && item.customization.selectedOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.customization.selectedOptions.map((opt, i) => (
                            <span key={i} className="text-[9px] bg-white px-1.5 py-0.5 rounded text-[#5C4D49] border border-[#E5DEC9]">
                              {opt.choiceName}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.customization?.selectedAddOns && item.customization.selectedAddOns.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {item.customization.selectedAddOns.map((add, i) => (
                            <span key={i} className="text-[9px] bg-[#FFF8E7] px-1.5 py-0.5 rounded text-[#4D080F] border border-[#FFC700]/50 font-bold">
                              +{add.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.customization?.specialInstructions && (
                        <p className="text-[10px] text-[#7A6A65] italic mt-1 line-clamp-1">
                          Note: {item.customization.specialInstructions}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-[#7A6A65] hover:text-[#E62E00] p-1 transition-colors shrink-0"
                      title="Remove item"
                      aria-label={`Remove ${item.product.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quantity & Item Subtotal */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-[#E5DEC9]/60">
                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-[#E5DEC9]">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded bg-[#FAF7F2] hover:bg-[#E5DEC9] flex items-center justify-center text-xs font-bold text-[#4D080F]"
                        aria-label={`Decrease quantity of ${item.product.name}`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={item.quantity}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          if (!Number.isNaN(parsed) && parsed >= 1) {
                            updateCartQuantity(item.id, Math.min(500, parsed));
                          }
                        }}
                        className="font-titan text-xs w-11 text-center text-[#241311] bg-transparent border border-transparent focus:border-[#E62E00] rounded px-0.5 focus:outline-none"
                        aria-label={`Direct quantity for ${item.product.name}`}
                        id={`cart-qty-input-${item.id}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, Math.min(500, item.quantity + 1))}
                        className="w-6 h-6 rounded bg-[#E62E00] hover:bg-[#C92200] flex items-center justify-center text-xs font-bold text-white"
                        aria-label={`Increase quantity of ${item.product.name}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-titan text-sm text-[#4D080F]">
                      {formatNaira(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <button
                  onClick={clearCart}
                  className="text-[11px] font-montserrat font-bold text-rose-700 hover:underline"
                >
                  Clear entire cart
                </button>
              </div>
            </div>
          )}

          {/* Compact Upsells Strip in Cart */}
          {cart.length > 0 && upsellItems.length > 0 && (
            <div className="bg-[#FAF7F2] p-2.5 rounded-2xl border border-[#E5DEC9] space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-titan text-[#4D080F] uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-[#E62E00]" />
                ADD A DRINK OR SIDE
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {upsellItems.slice(0, 2).map((up) => (
                  <div key={up.id} className="bg-white p-1.5 rounded-xl border border-[#E5DEC9] flex items-center gap-2">
                    <img src={up.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'} alt={up.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-titan truncate text-[#241311]">{up.name}</p>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[10px] font-bold text-[#E62E00]">{formatNaira(up.basePrice)}</span>
                        <button
                          onClick={() => addToCart(up, 1)}
                          className="text-[9px] font-titan bg-[#E62E00] text-white px-2 py-0.5 rounded-md hover:bg-[#C92200]"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pinned Cart Footer & Checkout Action */}
        {cart.length > 0 && (
          <div className="bg-[#FAF7F2] px-4 py-2.5 sm:py-3 rounded-t-2xl border-t border-[#E5DEC9] shadow-2xl space-y-2 shrink-0 z-20">
            {/* Calculation Breakdown */}
            <div className="space-y-0.5 text-[11px] sm:text-xs font-montserrat text-[#5C4D49]">
              <div className="flex items-center justify-between">
                <span>Subtotal ({cartCount} items)</span>
                <span className="font-bold text-[#241311]">{formatNaira(cartSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Packaging &amp; Thermal Box</span>
                <span className="font-bold text-[#241311]">{formatNaira(cartPackagingFee)}</span>
              </div>
              {orderType === 'delivery' && (
                <div className="flex items-center justify-between">
                  <span>Estimated Delivery Fee</span>
                  <span className={`font-bold ${deliveryFee === 0 ? 'text-emerald-700 font-titan' : 'text-[#241311]'}`}>
                    {deliveryFee === 0 ? 'FREE' : formatNaira(deliveryFee)}
                  </span>
                </div>
              )}
              {cartDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-700 font-bold">
                  <span>Promo Discount</span>
                  <span>-{formatNaira(cartDiscount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-[#E5DEC9] text-sm font-titan text-[#4D080F]">
                <span>TOTAL AMOUNT</span>
                <span className="text-base sm:text-lg text-[#E62E00]">{formatNaira(cartTotal)}</span>
              </div>
            </div>

            {/* Branch Closed Warning Banner */}
            {(() => {
              const branchStatus = evaluateBranchOperatingStatus(selectedBranchId);
              if (!branchStatus.isOpen) {
                return (
                  <div className="p-2 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-0.5 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>{currentBranch.shortName} Currently Closed</span>
                    </div>
                    <p className="text-[10px] text-amber-800 leading-snug">
                      {branchStatus.reason} {branchStatus.nextOpenNotice || ''}
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Primary Action Button: Proceed to Checkout */}
            {(() => {
              const branchStatus = evaluateBranchOperatingStatus(selectedBranchId);
              const isOpen = branchStatus.isOpen;
              return (
                <button
                  onClick={isOpen ? handleProceedToCheckout : undefined}
                  disabled={!isOpen}
                  className={`w-full font-titan text-xs sm:text-sm py-2.5 sm:py-3 px-4 rounded-2xl shadow-lg transition-all flex items-center justify-between group ${
                    isOpen
                      ? 'bg-[#E62E00] hover:bg-[#C92200] text-white transform active:scale-95 cursor-pointer'
                      : 'bg-stone-300 text-stone-600 cursor-not-allowed shadow-none'
                  }`}
                  id="proceed-to-checkout-btn"
                >
                  <span className="flex items-center gap-2">
                    <ShoppingBag className={`w-4 h-4 ${isOpen ? 'text-[#FFC700]' : 'text-stone-500'}`} />
                    <span>{isOpen ? 'CHECKOUT NOW' : 'BRANCH CURRENTLY CLOSED'}</span>
                  </span>
                  <span className={`flex items-center gap-1 ${isOpen ? 'text-[#FFC700]' : 'text-stone-500'}`}>
                    <span>{formatNaira(cartTotal)}</span>
                    {isOpen && <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                  </span>
                </button>
              );
            })()}

            {/* Secondary WhatsApp Fallback Ordering Button */}
            <a
              href={getBranchWhatsAppUrl(selectedBranchId, generateWhatsAppCartText())}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#006a33] border border-[#25D366]/50 font-montserrat font-bold text-[10px] py-1.5 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              id="cart-order-via-whatsapp-btn"
            >
              <MessageCircle className="w-3 h-3 text-[#25D366] fill-[#25D366]" />
              <span>Or Order via WhatsApp ({currentBranch.shortName})</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
