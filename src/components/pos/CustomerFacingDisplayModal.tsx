import React, { useState, useEffect } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  UtensilsCrossed,
  Sparkles,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  ShoppingBag,
} from 'lucide-react';
import { MASTER_PRODUCTS } from '../../data/menu';

export interface CustomerFacingDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCheck: any | null;
  branchName: string;
  formatNaira: (amount: number) => string;
  lastPaidCheck?: any | null;
}

export const CustomerFacingDisplayModal: React.FC<CustomerFacingDisplayModalProps> = ({
  isOpen,
  onClose,
  activeCheck,
  branchName,
  formatNaira,
  lastPaidCheck,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const promoBanners = [
    {
      id: 'platter',
      title: 'Mega Choplife Platter',
      subtitle: 'Crispy samosas, spring rolls, golden puff puff & succulent peppered turkey',
      price: '₦13,300',
      badge: 'Best Seller',
      badgeColor: 'bg-[#FFC700] text-[#4D080F]',
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'jollof',
      title: 'Smoky Party Jollof Feast',
      subtitle: 'Authentic firewood jollof rice with fried plantain & grilled jumbo chicken',
      price: '₦4,800',
      badge: 'Chef Special',
      badgeColor: 'bg-emerald-500 text-white',
      image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'chowbox',
      title: 'Easy Chow Box',
      subtitle: 'Medium turkey, 2 samosas, 2 spring rolls & spicy peppered wings',
      price: '₦8,200',
      badge: 'Patron Choice',
      badgeColor: 'bg-amber-500 text-white',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'loyalty',
      title: 'VIP Patron Loyalty Program',
      subtitle: 'Earn 10 points per ₦1,000 spent! Redeem for instant meal discounts.',
      price: 'Free Sign-up',
      badge: 'Rewards',
      badgeColor: 'bg-purple-600 text-white',
      image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80',
    },
  ];

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentPromoIndex((prev) => (prev + 1) % promoBanners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, promoBanners.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (!isOpen) return null;

  const hasItems = activeCheck && activeCheck.items && activeCheck.items.length > 0;
  const currentPromo = promoBanners[currentPromoIndex];

  const handleImageError = (key: string) => {
    setFailedImages((prev) => ({ ...prev, [key]: true }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF7F2] text-stone-900 flex flex-col overflow-hidden font-sans select-none">
      {/* Top Header Bar */}
      <header className="px-6 py-4 bg-[#241311] text-white border-b-2 border-[#FFC700] flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFC700] text-[#241311] flex items-center justify-center font-black text-xl shadow-sm">
            C
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">CHOPLIFE REPUBLIC</h1>
            <p className="text-xs text-[#FFC700] font-bold uppercase tracking-wider">
              {branchName} &bull; Customer Counter Display
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-900/50 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">Terminal Synced</span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-red-600/50 text-white border border-white/20 transition-colors"
            title="Exit Customer Display"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-stone-50">
        {/* Left Side: Order Stream with Product Imagery */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-stone-200 bg-white overflow-hidden">
          <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-[#6b1224] flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> Your Order
              </h2>
              <p className="text-sm text-stone-900 font-bold mt-0.5">
                {activeCheck ? `Check #${activeCheck.checkNumber || 'CHK-LIVE'} • ${activeCheck.tableNumber || activeCheck.checkType || 'Dine-in'}` : 'Awaiting New Order'}
              </p>
            </div>
            {hasItems && (
              <span className="px-3 py-1 bg-[#6b1224] text-[#FFC700] rounded-full text-xs font-black shadow-2xs">
                {activeCheck.items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0)} items
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3 font-sans">
            {hasItems ? (
              activeCheck.items.map((it: any, index: number) => {
                const rawImgUrl =
                  it.image ||
                  it.imageUrl ||
                  it.product?.image ||
                  it.product?.imageUrl ||
                  MASTER_PRODUCTS.find((p) => p.id === (it.productId || it.product?.id) || p.name.toLowerCase().trim() === it.name?.toLowerCase().trim())?.image;
                const imgUrl = rawImgUrl && typeof rawImgUrl === 'string' && rawImgUrl.trim() !== '' ? rawImgUrl : undefined;
                const imgKey = `check-item-${index}`;
                const hasFailed = failedImages[imgKey];

                return (
                  <div
                    key={it.id || index}
                    className="p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between gap-4 shadow-2xs hover:border-[#6b1224]/30 transition-all"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0 relative flex items-center justify-center">
                        {imgUrl && !hasFailed ? (
                          <img
                            src={imgUrl}
                            alt={it.name || 'Item'}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(imgKey)}
                          />
                        ) : (
                          <div className="w-full h-full bg-amber-50/90 border border-amber-200/80 flex flex-col items-center justify-center p-1 text-center">
                            <span className="text-[11px] font-black text-[#800D15] tracking-wider uppercase leading-none">
                              {(it.product?.name || it.name || 'DISH')
                                .split(' ')
                                .map((w: string) => w[0])
                                .join('')
                                .slice(0, 3)}
                            </span>
                            <span className="text-[7px] text-amber-800 font-bold uppercase tracking-tighter mt-0.5">
                              NO PHOTO
                            </span>
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 bg-[#6b1224] text-[#FFC700] text-[10px] font-black px-1.5 py-0.5 rounded-tl-lg">
                          {it.quantity}x
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-sm text-stone-900 truncate">{it.name}</p>
                        {it.notes && (
                          <p className="text-xs text-amber-700 font-medium italic truncate mt-0.5">Note: {it.notes}</p>
                        )}
                        {it.modifiers && it.modifiers.length > 0 && (
                          <p className="text-[11px] text-stone-500 truncate mt-0.5">
                            + {it.modifiers.map((m: any) => m.name).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono font-black text-sm text-[#6b1224] tabular-nums">
                        {formatNaira(it.totalPrice || it.unitPrice * it.quantity)}
                      </p>
                      {it.quantity > 1 && (
                        <p className="text-[10px] text-stone-400 font-mono tabular-nums">
                          @{formatNaira(it.unitPrice)} each
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : lastPaidCheck ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-stone-900">Payment Successful!</h3>
                  <p className="text-sm text-stone-600 mt-1">
                    Check #{lastPaidCheck.checkNumber} settled • Thank you for dining with Choplife Republic!
                  </p>
                  <p className="text-xs text-[#6b1224] font-extrabold mt-2 font-mono">
                    Total Paid: {formatNaira(lastPaidCheck.total)} via {lastPaidCheck.paymentMethod?.toUpperCase()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 border border-stone-200 text-stone-400 flex items-center justify-center">
                  <UtensilsCrossed className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-stone-900">Welcome to Choplife Republic</h3>
                <p className="text-xs text-stone-500 max-w-sm">
                  Our cashier will ring up your order shortly. Watch this screen for real-time item updates and totals.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: High-Impact Billboard Carousel & Bill Totals */}
        <div className="w-full lg:w-[460px] bg-[#FAF7F2] border-l border-stone-200 flex flex-col justify-between shrink-0 p-6 space-y-6 shadow-xs">
          {/* Billboard / Promo Showcase with Controls */}
          <div
            className="bg-gradient-to-br from-[#6b1224] via-[#4D080F] to-[#241311] text-white border-2 border-[#FFC700]/30 rounded-2xl p-5 relative overflow-hidden shadow-md"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full tracking-wider ${currentPromo.badgeColor}`}>
                {currentPromo.badge}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-colors"
                  title={isPaused ? 'Resume Promo Cycle' : 'Pause Promo Cycle'}
                >
                  {isPaused ? <Play className="w-3 h-3 text-[#FFC700]" /> : <Pause className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => setCurrentPromoIndex((prev) => (prev - 1 + promoBanners.length) % promoBanners.length)}
                  className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPromoIndex((prev) => (prev + 1) % promoBanners.length)}
                  className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/20 shadow-sm bg-black/30">
                <img src={currentPromo.image} alt={currentPromo.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-white truncate">{currentPromo.title}</h3>
                <p className="text-xs text-stone-200 mt-1 line-clamp-2">{currentPromo.subtitle}</p>
                <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-white/20">
                  <span className="text-[10px] text-stone-300 font-medium">Special Offer</span>
                  <span className="font-mono font-black text-sm text-[#FFC700] tabular-nums">{currentPromo.price}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Totals Card */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="space-y-2.5 text-xs text-stone-600 pb-4 border-b border-stone-200">
              <div className="flex justify-between items-center">
                <span>Subtotal</span>
                <span className="font-mono font-bold text-stone-900 tabular-nums">
                  {formatNaira(activeCheck?.subtotal || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Value Added Tax (VAT 7.5%)</span>
                <span className="font-mono font-bold text-stone-900 tabular-nums">
                  {formatNaira(activeCheck?.taxAmount || 0)}
                </span>
              </div>
              {Number(activeCheck?.packagingFee || 0) > 0 && (
                <div className="flex justify-between items-center">
                  <span>Eco Packaging Surcharge</span>
                  <span className="font-mono font-bold text-stone-900 tabular-nums">
                    {formatNaira(activeCheck?.packagingFee || 0)}
                  </span>
                </div>
              )}
              {Number(activeCheck?.discountAmount || 0) > 0 && (
                <div className="flex justify-between items-center text-emerald-600 font-semibold">
                  <span>Loyalty / Special Discount</span>
                  <span className="font-mono font-bold tabular-nums">
                    -{formatNaira(activeCheck?.discountAmount || 0)}
                  </span>
                </div>
              )}
            </div>

            {/* Grand Total */}
            <div className="bg-[#241311] text-white p-4 rounded-xl shadow-inner border border-[#FFC700]/30">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#FFC700] block">
                Amount Due
              </span>
              <div className="mt-1 font-mono font-black text-3xl sm:text-4xl text-[#FFC700] tracking-tight tabular-nums">
                {formatNaira(activeCheck?.total || 0)}
              </div>
            </div>

            {/* Payment Guidance */}
            <div className="pt-2 grid grid-cols-2 gap-2 text-[11px] text-stone-600">
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#6b1224]" />
                <span className="font-medium">Card, Cash &amp; Transfer</span>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">Instant Print Receipt</span>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-center text-[10px] text-stone-500 space-y-1">
            <p className="font-bold text-stone-800">Choplife Republic Hospitality Group</p>
            <p>Receipts are issued instantly upon payment settlement. Savor the Good Life!</p>
          </div>
        </div>
      </div>
    </div>
  );
};
