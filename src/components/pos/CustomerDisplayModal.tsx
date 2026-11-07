import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
  X,
  Monitor,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Award,
  Flame,
  Tag,
} from 'lucide-react';
import { CartItem } from '../../types';
import { MASTER_PRODUCTS } from '../../data/menu';

interface CustomerDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotal: number;
  packagingFee: number;
  discount: number;
  total: number;
  branchName: string;
  cashierName?: string;
  paymentStatus?: 'unpaid' | 'paid' | 'pending';
  lastCompletedOrderNumber?: string;
}

interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  badge: string;
  badgeColor: string;
  image: string;
  bgGradient: string;
}

export const CustomerDisplayModal: React.FC<CustomerDisplayModalProps> = ({
  isOpen,
  onClose,
  cart,
  subtotal,
  packagingFee,
  discount,
  total,
  branchName,
  cashierName,
  paymentStatus = 'unpaid',
  lastCompletedOrderNumber,
}) => {
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const promoBanners: PromoBanner[] = [
    {
      id: 'platter',
      title: 'Mega Choplife Platter',
      subtitle: 'Crispy samosas, spring rolls, golden puff puff & succulent peppered turkey',
      price: '₦13,300',
      badge: 'Best Seller',
      badgeColor: 'bg-[#FFC700] text-[#4D080F]',
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
      bgGradient: 'from-[#6b1224] via-[#4D080F] to-[#241311]',
    },
    {
      id: 'jollof',
      title: 'Smoky Party Jollof Feast',
      subtitle: 'Authentic firewood jollof rice with fried plantain & grilled jumbo chicken',
      price: '₦4,800',
      badge: 'Chef Special',
      badgeColor: 'bg-emerald-500 text-white',
      image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80',
      bgGradient: 'from-[#800D15] via-[#5C0A0F] to-[#1F0306]',
    },
    {
      id: 'chowbox',
      title: 'Easy Chow Box',
      subtitle: 'Medium turkey, 2 samosas, 2 spring rolls & spicy peppered wings',
      price: '₦8,200',
      badge: 'Patron Choice',
      badgeColor: 'bg-amber-500 text-white',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
      bgGradient: 'from-[#4D080F] via-[#33050A] to-[#150204]',
    },
    {
      id: 'loyalty',
      title: 'VIP Patron Rewards',
      subtitle: 'Earn 10 points per ₦1,000 spent! Redeem for instant meal vouchers & discounts.',
      price: 'Free Sign-up',
      badge: 'VIP Club',
      badgeColor: 'bg-purple-600 text-white',
      image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80',
      bgGradient: 'from-[#500e1b] via-[#380913] to-[#1a0308]',
    },
  ];

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentPromoIndex((prev) => (prev + 1) % promoBanners.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [isPaused, promoBanners.length]);

  if (!isOpen) return null;

  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const currentPromo = promoBanners[currentPromoIndex];

  const handleImageError = (key: string) => {
    setFailedImages((prev) => ({ ...prev, [key]: true }));
  };

  const getCartItemImage = (item: any): string | undefined => {
    if (item.image && typeof item.image === 'string' && item.image.trim() !== '') return item.image;
    if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.trim() !== '') return item.imageUrl;
    if (item.product?.image && typeof item.product.image === 'string' && item.product.image.trim() !== '') return item.product.image;
    if (item.product?.imageUrl && typeof item.product.imageUrl === 'string' && item.product.imageUrl.trim() !== '') return item.product.imageUrl;

    const pId = item.productId || item.product?.id;
    if (pId) {
      const match = MASTER_PRODUCTS.find((p) => p.id === pId);
      if (match?.image && match.image.trim() !== '') return match.image;
    }

    if (item.name) {
      const nameMatch = MASTER_PRODUCTS.find(
        (p) => p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
      if (nameMatch?.image && nameMatch.image.trim() !== '') return nameMatch.image;
    }

    return undefined;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-[#FAF7F2] rounded-3xl w-full max-w-5xl shadow-2xl border-4 border-[#FFC700] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Banner */}
        <div className="bg-[#241311] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#FFC700] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFC700] text-[#241311] flex items-center justify-center font-black text-xl shadow-md">
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFC700] bg-white/10 px-2.5 py-0.5 rounded-full">
                  CUSTOMER DISPLAY MODE
                </span>
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE TERMINAL SYNC
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-wide">
                CHOPLIFE REPUBLIC &bull; {branchName.toUpperCase()}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close Customer Display"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-stone-50">
          {/* Left: Cart Items with Product Imagery (7 cols) */}
          <div className="lg:col-span-7 p-5 overflow-y-auto space-y-4 border-r border-[#E5DEC9] bg-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DEC9]">
              <h3 className="text-xs font-black text-[#6b1224] uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#800D15]" /> YOUR ORDER ({totalItemCount} {totalItemCount === 1 ? 'item' : 'items'})
              </h3>
              {cashierName && (
                <span className="text-xs text-stone-500 font-medium">
                  Cashier: <strong className="text-[#241311] font-bold">{cashierName}</strong>
                </span>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-[#FAF7F2] border-2 border-[#E5DEC9] flex items-center justify-center mx-auto text-[#6b1224]/50 shadow-inner">
                  <UtensilsCrossed className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-base font-black text-[#241311]">Welcome to Choplife Republic</h4>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto mt-1">
                    Your selected items and live price breakdown will appear here as the cashier rings up your order.
                  </p>
                </div>
                {lastCompletedOrderNumber && (
                  <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Last Order <strong>#{lastCompletedOrderNumber}</strong> settled! Savor the Good Life!</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, idx) => {
                  const imgUrl = getCartItemImage(item);
                  const imageKey = `item-${item.id}-${idx}`;
                  const hasFailedImg = failedImages[imageKey];

                  return (
                    <div
                      key={item.id || idx}
                      className="p-3.5 bg-white rounded-2xl border border-stone-200 shadow-2xs flex items-center justify-between gap-3 transition-all hover:border-[#6b1224]/30"
                    >
                      {/* Item Image / Fallback Thumbnail */}
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0 relative flex items-center justify-center shadow-inner">
                        {imgUrl && !hasFailedImg ? (
                          <img
                            src={imgUrl}
                            alt={item.product?.name || 'Item'}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(imageKey)}
                          />
                        ) : (
                          <div className="w-full h-full bg-amber-50/90 border border-amber-200/80 flex flex-col items-center justify-center p-1 text-center">
                            <span className="text-[11px] font-black text-[#800D15] tracking-wider uppercase leading-none">
                              {(item.product?.name || (item as any).name || 'DISH')
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
                        <span className="absolute bottom-0 right-0 bg-[#6b1224] text-[#FFC700] text-[10px] font-black px-1.5 py-0.5 rounded-tl-lg shadow-2xs">
                          {item.quantity}x
                        </span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-[#241311] truncate">
                          {item.product?.name || (item as any).name || 'Item'}
                        </h4>
                        {item.customization && item.customization.specialInstructions && (
                          <p className="text-[11px] text-amber-700 italic truncate mt-0.5">
                            Note: {item.customization.specialInstructions}
                          </p>
                        )}
                        {item.customization && item.customization.selectedOptions && (
                          <p className="text-[11px] text-stone-500 truncate">
                            {Object.values(item.customization.selectedOptions).flat().join(', ')}
                          </p>
                        )}
                      </div>

                      {/* Pricing */}
                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-sm text-[#6b1224] tabular-nums">
                          ₦{(item.unitPrice * item.quantity).toLocaleString()}
                        </div>
                        {item.quantity > 1 && (
                          <div className="text-[10px] text-stone-400 font-mono tabular-nums">
                            @₦{item.unitPrice.toLocaleString()} ea
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Promotions Showcase & Totals Summary (5 cols) */}
          <div className="lg:col-span-5 bg-[#FAF7F2] p-5 flex flex-col justify-between space-y-4 border-t lg:border-t-0 border-[#E5DEC9]">
            {/* Promotions Carousel Billboard */}
            <div
              className={`bg-gradient-to-br ${currentPromo.bgGradient} text-white border-2 border-[#FFC700]/40 rounded-2xl p-4 relative overflow-hidden shadow-lg transition-all duration-300`}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Top Promo Header Badge & Controls */}
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full tracking-wider shadow-2xs ${currentPromo.badgeColor}`}>
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

              {/* Promo Banner Content + Image */}
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/20 shadow-md bg-black/20">
                  <img
                    src={currentPromo.image}
                    alt={currentPromo.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-sm text-white truncate">{currentPromo.title}</h3>
                  <p className="text-[11px] text-stone-200 mt-0.5 line-clamp-2 leading-tight">
                    {currentPromo.subtitle}
                  </p>
                  <div className="mt-2 flex items-baseline justify-between border-t border-white/15 pt-1.5">
                    <span className="text-[10px] text-stone-300 font-medium">Limited Time Offer</span>
                    <span className="font-mono font-black text-xs text-[#FFC700] tabular-nums">{currentPromo.price}</span>
                  </div>
                </div>
              </div>

              {/* Carousel Indicators */}
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {promoBanners.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setCurrentPromoIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentPromoIndex ? 'w-5 bg-[#FFC700]' : 'w-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Transaction Summary Card */}
            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 space-y-3 shadow-xs">
              <h3 className="text-xs font-black text-[#6b1224] uppercase tracking-wider pb-2 border-b border-[#E5DEC9] flex items-center justify-between">
                <span>Transaction Summary</span>
                <Tag className="w-3.5 h-3.5 text-[#800D15]" />
              </h3>

              <div className="space-y-2 text-xs text-stone-600 font-sans">
                <div className="flex justify-between items-center">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold text-stone-900 tabular-nums">₦{subtotal.toLocaleString()}</span>
                </div>
                {packagingFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span>Eco Packaging</span>
                    <span className="font-mono font-bold text-stone-900 tabular-nums">₦{packagingFee.toLocaleString()}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 font-semibold">
                    <span>Loyalty / Special Discount</span>
                    <span className="font-mono font-bold tabular-nums">-₦{discount.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Amount Payable Box */}
              <div className="bg-[#241311] text-white p-4 rounded-xl shadow-inner border border-[#FFC700]/30 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFC700] block">
                  TOTAL AMOUNT PAYABLE
                </span>
                <div className="text-2xl sm:text-3xl font-mono font-black text-[#FFC700] tracking-tight tabular-nums">
                  ₦{total.toLocaleString()}
                </div>
              </div>

              {/* Payment Status Indicator */}
              <div>
                {paymentStatus === 'paid' ? (
                  <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-xl text-center space-y-0.5 animate-in zoom-in-95 duration-200">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                    <div className="font-black text-xs text-emerald-800">PAYMENT SUCCESSFUL</div>
                    <p className="text-[10px] text-emerald-700">Receipt printed. Thank you for dining with Choplife Republic!</p>
                  </div>
                ) : paymentStatus === 'pending' ? (
                  <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl text-center space-y-0.5 animate-pulse">
                    <Clock className="w-6 h-6 text-amber-600 mx-auto" />
                    <div className="font-black text-xs text-amber-800">AWAITING PAYMENT SETTLEMENT</div>
                    <p className="text-[10px] text-amber-700">Please present card, cash, or transfer proof to cashier.</p>
                  </div>
                ) : (
                  <div className="bg-stone-50 border border-stone-200 text-stone-600 p-3 rounded-xl text-center space-y-0.5">
                    <ShieldCheck className="w-5 h-5 text-[#6b1224] mx-auto" />
                    <div className="font-bold text-xs text-[#241311]">READY FOR SETTLEMENT</div>
                    <p className="text-[10px] text-stone-500">Review items above before presenting payment.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Tagline */}
            <div className="pt-2 text-center border-t border-[#E5DEC9]">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-500 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" /> AUTHENTIC NIGERIAN HOSPITALITY &amp; FLAVOR
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
