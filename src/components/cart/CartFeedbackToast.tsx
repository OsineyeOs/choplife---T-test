import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShoppingBag, Check, X } from 'lucide-react';

export const CartFeedbackToast: React.FC = () => {
  const { lastAddedToast, setLastAddedToast, setIsCartOpen, formatNaira } = useApp();

  if (!lastAddedToast) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-[110] w-[92%] max-w-md bg-[#4D080F] text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border-2 border-[#FFC700] animate-in fade-in slide-in-from-bottom-4 duration-200 pointer-events-auto"
      id="cart-feedback-toast"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <Check className="w-5 h-5" />
          </div>
          <div className="truncate">
            <p className="font-titan text-xs sm:text-sm text-white truncate">
              {lastAddedToast.productName}
            </p>
            <p className="text-[11px] font-montserrat text-[#FFC700] font-semibold">
              Added to order ({lastAddedToast.quantity}x • {formatNaira(lastAddedToast.totalPrice)})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setLastAddedToast(null);
              setIsCartOpen(true);
            }}
            className="bg-[#FFC700] hover:bg-[#FFD733] text-[#4D080F] font-titan text-xs px-3 py-2 rounded-xl flex items-center gap-1 shadow-sm transition-transform active:scale-95"
            id="toast-view-cart-btn"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>VIEW CART</span>
          </button>

          <button
            onClick={() => setLastAddedToast(null)}
            className="text-white/60 hover:text-white p-1"
            id="close-toast-btn"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
