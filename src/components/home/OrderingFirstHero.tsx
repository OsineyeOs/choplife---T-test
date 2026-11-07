import React, { useEffect, useState } from 'react';
import {
  Utensils,
  Sparkles,
  MapPin,
  Truck,
  Store,
  Navigation,
  Flame,
  Package,
  ArrowRight,
  BookmarkCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, BranchId } from '../../types';

interface OrderingFirstHeroProps {
  onSelectOrderPath: (path: 'small-chops' | 'food' | 'mini-packs') => void;
  onOpenBoxBuilder: () => void;
  onExcludeProductIdsChange?: (ids: string[]) => void;
}

interface BestsellerEntry {
  productId: string;
  quantitySold: number;
  revenueGenerated: number;
  orderCount: number;
  product: Product;
}

export const OrderingFirstHero: React.FC<OrderingFirstHeroProps> = ({
  onSelectOrderPath,
  onOpenBoxBuilder,
  onExcludeProductIdsChange,
}) => {
  const {
    branches: BRANCHES,
    selectedBranchId,
    setSelectedBranchId,
    currentBranch,
    orderType,
    setOrderType,
    products,
    getProductPrice,
    isProductAvailable,
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    formatNaira,
  } = useApp();

  const [bestsellers, setBestsellers] = useState<BestsellerEntry[]>([]);
  const [hasGenuineSales, setHasGenuineSales] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const detectLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const coordsMap: Record<BranchId, { lat: number; lng: number }> = {
          gra: { lat: 6.3176, lng: 5.6145 },
          okabere: { lat: 6.2985, lng: 5.6310 },
          ugbowo: { lat: 6.3982, lng: 5.6094 },
        };
        let nearest: BranchId = selectedBranchId;
        let minDist = Infinity;
        for (const b of BRANCHES) {
          const target = coordsMap[b.id as BranchId];
          if (!target) continue;
          const dLat = latitude - target.lat;
          const dLng = longitude - target.lng;
          const dist = dLat * dLat + dLng * dLng;
          if (dist < minDist) {
            minDist = dist;
            nearest = b.id as BranchId;
          }
        }
        handleBranchChange(nearest);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  // Compute lowest active Mini Pack price dynamically
  const activeMiniPacks = products.filter((p) => {
    if (!isProductAvailable(p.id, selectedBranchId)) return false;
    const price = getProductPrice(p, selectedBranchId);
    return (
      p.id.startsWith('prod-sc-mini-') ||
      p.name.toLowerCase().includes('mini pack') ||
      (p.category === 'small-chops' && price >= 1000 && price <= 3000)
    );
  });

  const lowestMiniPackPrice =
    activeMiniPacks.length > 0
      ? Math.min(...activeMiniPacks.map((p) => getProductPrice(p, selectedBranchId) || 1000))
      : 1000;

  // Load remembered device preference on mount (consent-based HTTP-only cookie)
  useEffect(() => {
    let mounted = true;
    fetch('/api/customers/device-preference', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.remembered || !data?.preferences) return;
        setRememberDevice(true);
        const prefBranch = data.preferences.preferredBranchId as BranchId;
        if (prefBranch && BRANCHES.some((b) => b.id === prefBranch) && prefBranch !== selectedBranchId) {
          setSelectedBranchId(prefBranch);
        }
        if (
          (data.preferences.preferredFulfilment === 'delivery' ||
            data.preferences.preferredFulfilment === 'pickup') &&
          data.preferences.preferredFulfilment !== orderType
        ) {
          setOrderType(data.preferences.preferredFulfilment);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch genuine paid & fulfilled bestsellers (strictly capped at max 3)
  useEffect(() => {
    let mounted = true;
    fetch(`/api/menu/bestsellers?branchId=${encodeURIComponent(selectedBranchId)}&limit=3`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        const list: BestsellerEntry[] = Array.isArray(data.bestsellers)
          ? data.bestsellers.slice(0, 3)
          : [];
        setBestsellers(list);
        setHasGenuineSales(Boolean(data.hasGenuineSalesData && list.length > 0));
        if (onExcludeProductIdsChange) {
          onExcludeProductIdsChange(list.map((b) => b.productId));
        }
      })
      .catch(() => {
        if (mounted) {
          setBestsellers([]);
          setHasGenuineSales(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [selectedBranchId]);

  const handleToggleRememberDevice = async (checked: boolean) => {
    setRememberDevice(checked);
    try {
      if (checked) {
        await fetch('/api/customers/device-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            consentGiven: true,
            preferredBranchId: selectedBranchId,
            preferredFulfilment: orderType === 'pickup' ? 'pickup' : 'delivery',
          }),
        });
      } else {
        await fetch('/api/customers/device-preference', {
          method: 'DELETE',
          credentials: 'include',
        });
      }
    } catch {
      // Non-blocking
    }
  };

  const handleFulfilmentChange = (mode: 'delivery' | 'pickup') => {
    setOrderType(mode);
    if (rememberDevice) {
      fetch('/api/customers/device-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          consentGiven: true,
          preferredBranchId: selectedBranchId,
          preferredFulfilment: mode,
        }),
      }).catch(() => {});
    }
  };

  const handleBranchChange = (branchId: BranchId) => {
    setSelectedBranchId(branchId);
    if (rememberDevice) {
      fetch('/api/customers/device-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          consentGiven: true,
          preferredBranchId: branchId,
          preferredFulfilment: orderType === 'pickup' ? 'pickup' : 'delivery',
        }),
      }).catch(() => {});
    }
  };

  const getCartInfoForProduct = (productId: string) => {
    const matching = cart.filter((it) => it.productId === productId);
    const totalQty = matching.reduce((acc, it) => acc + it.quantity, 0);
    const primaryItem = matching[0];
    return { totalQty, primaryItem };
  };

  return (
    <section
      aria-label="Fast Food and Small Chops Ordering"
      className="bg-gradient-to-b from-[#241311] via-[#311714] to-[#241311] text-white pt-4 pb-6 md:py-7 border-b border-[#4D080F]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Compact Fulfilment, Branch & Remember Device Bar (No desktop duplication with Navbar) */}
        <div className="bg-[#1B0D0B]/90 border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Mobile & Tablet (< lg) Delivery vs Pickup Toggle (On >= lg, controlled via primary Navbar toggle) */}
            <div
              role="group"
              aria-label="Fulfilment Method"
              className="lg:hidden inline-flex bg-black/40 p-1 rounded-xl border border-white/10"
            >
              <button
                type="button"
                onClick={() => handleFulfilmentChange('delivery')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  orderType === 'delivery'
                    ? 'bg-[#E62E00] text-white shadow-sm'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Delivery</span>
              </button>
              <button
                type="button"
                onClick={() => handleFulfilmentChange('pickup')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  orderType === 'pickup'
                    ? 'bg-[#E62E00] text-white shadow-sm'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Pickup</span>
              </button>
            </div>

            {/* Mobile & Tablet (< lg) Branch Selector Buttons (On >= lg, controlled via primary Navbar Branch Selector) */}
            <div className="lg:hidden flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 overflow-x-auto max-w-full">
              <MapPin className="w-3.5 h-3.5 text-[#FFC700] ml-1.5 shrink-0" />
              {BRANCHES.map((b) => {
                const active = selectedBranchId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleBranchChange(b.id as BranchId)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      active
                        ? 'bg-[#4D080F] text-[#FFC700] border border-[#FFC700]/40'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    {b.shortName}
                  </button>
                );
              })}
            </div>

            {/* Desktop (>= lg) Unified Active Kitchen & Fulfilment Context Badge (non-duplicative) */}
            <div className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-stone-200">
              <MapPin className="w-3.5 h-3.5 text-[#FFC700] shrink-0" />
              <span>
                Active Kitchen: <strong className="text-[#FFC700]">{currentBranch.name}</strong> ({orderType === 'pickup' ? 'Branch Pickup' : 'Home Delivery'})
              </span>
            </div>

            {/* Explicit User-Triggered Location Detection (Never auto-triggered) */}
            <button
              type="button"
              onClick={detectLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 text-xs font-semibold border border-white/15 transition-colors cursor-pointer"
              title="Find nearest Choplife Republic branch"
            >
              <Navigation className={`w-3.5 h-3.5 text-[#FFC700] ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Locating...' : 'Find Nearest Branch'}</span>
            </button>
          </div>

          {/* Consent-Based Remember Device Toggle */}
          <div className="flex items-center justify-between lg:justify-end gap-3 text-xs text-stone-300 border-t lg:border-t-0 border-white/10 pt-2.5 lg:pt-0">
            <span className="text-stone-300 hidden sm:inline">
              {currentBranch.estimatedDeliveryTime} • Delivery from {formatNaira(currentBranch.deliveryFeeBase)}
            </span>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/25">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => handleToggleRememberDevice(e.target.checked)}
                className="rounded border-stone-600 text-[#E62E00] focus:ring-[#E62E00] bg-stone-900"
              />
              <BookmarkCheck className="w-3.5 h-3.5 text-[#FFC700]" />
              <span className="font-medium text-stone-200">Remember branch on this device</span>
            </label>
          </div>
        </div>

        {/* Two Prominent Primary Ordering Entry Cards (Desktop & Mobile-First) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary Card 1: SMALL CHOPS */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#E62E00] via-[#C92200] to-[#7A1005] p-5 sm:p-6 shadow-xl border border-[#FFC700]/30 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/25 text-[#FFC700] text-xs font-bold uppercase tracking-wider mb-2.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Freshly Fried to Order</span>
              </div>
              <h1 className="font-titan text-2xl sm:text-3xl tracking-tight text-white leading-tight">
                SIGNATURE SMALL CHOPS &amp; PLATTERS
              </h1>
              <p className="text-orange-50 text-xs sm:text-sm font-montserrat mt-1.5 max-w-md">
                Mini Packs, Munch Boxes, Party Platters, Samosa, Spring Rolls, Puff-Puff &amp; Peppered Proteins.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                id="hero-order-small-chops-btn"
                onClick={() => onSelectOrderPath('small-chops')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#FFC700] hover:bg-[#FFD438] text-[#241311] font-titan text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                <span className="md:hidden">SMALL CHOPS ORDERS HERE</span>
                <span className="hidden md:inline">ORDER SMALL CHOPS</span>
                <ArrowRight className="w-4 h-4 text-[#4D080F]" />
              </button>

              <button
                type="button"
                id="hero-mini-packs-btn"
                onClick={() => onSelectOrderPath('mini-packs')}
                className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-black/35 hover:bg-black/50 text-white font-bold text-xs sm:text-sm border border-white/25 transition-all cursor-pointer"
              >
                <Package className="w-4 h-4 text-[#FFC700]" />
                <span>Mini Packs (From {formatNaira(lowestMiniPackPrice)})</span>
              </button>

              <button
                type="button"
                onClick={onOpenBoxBuilder}
                className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-[#241311]/75 hover:bg-[#241311] text-[#FFC700] font-bold text-xs sm:text-sm border border-[#FFC700]/40 transition-all cursor-pointer"
              >
                <span>Build Your Box</span>
              </button>
            </div>
          </div>

          {/* Primary Card 2: FOOD & MEALS */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#3D080E] via-[#2A060A] to-[#1A0406] p-5 sm:p-6 shadow-xl border border-white/15 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFC700]/15 text-[#FFC700] text-xs font-bold uppercase tracking-wider mb-2.5 border border-[#FFC700]/25">
                <Utensils className="w-3.5 h-3.5" />
                <span>Hot Kitchen &amp; Bakery</span>
              </div>
              <h2 className="font-titan text-2xl sm:text-3xl tracking-tight text-white leading-tight">
                HOT MEALS, GRILLS &amp; SPECIAL BREAD
              </h2>
              <p className="text-stone-200 text-xs sm:text-sm font-montserrat mt-1.5 max-w-md">
                Smoky Jollof &amp; Fried Rice, Asun Rice, Grilled Turkey &amp; Chicken, Shawarma, Pastries, Bread &amp; Chilled Drinks.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                id="hero-order-food-btn"
                onClick={() => onSelectOrderPath('food')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                <span className="md:hidden">FOOD ORDERS HERE</span>
                <span className="hidden md:inline">ORDER FOOD</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <span className="text-xs text-stone-300 font-montserrat px-2">
                Default Food Pack: ₦400 per up to 4 portions
              </span>
            </div>
          </div>
        </div>

        {/* Genuine Bestsellers Bar (Strictly Capped at Max 3 Items; Hidden when 0 Paid Sales Exist) */}
        {hasGenuineSales && bestsellers.length > 0 && (
          <div
            aria-label="Verified Bestsellers"
            className="bg-[#1B0D0B]/95 border border-white/15 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#FFC700]" />
                <h3 className="text-sm font-titan uppercase tracking-wider text-white">
                  Top Bestsellers ({currentBranch.shortName})
                </h3>
                <span className="text-[11px] text-stone-300 font-montserrat">
                  Based on verified paid & fulfilled orders
                </span>
              </div>
              <span className="text-xs text-[#FFC700] font-bold">
                Top {bestsellers.length} of max 3
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {bestsellers.slice(0, 3).map((entry, idx) => {
                const fullProd = products.find((p) => p.id === entry.productId) || entry.product;
                if (!fullProd) return null;
                const price = getProductPrice(fullProd, selectedBranchId);
                const { totalQty, primaryItem } = getCartInfoForProduct(fullProd.id);
                return (
                  <div
                    key={fullProd.id}
                    className="flex items-center justify-between gap-3 bg-black/40 border border-white/10 rounded-xl p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-[#E62E00]/30 text-[#FFC700] border border-[#FFC700]/30">
                          #{idx + 1}
                        </span>
                        <p className="text-sm font-bold text-white truncate">{fullProd.name}</p>
                      </div>
                      <p className="text-xs font-extrabold text-[#FFC700] mt-1">
                        {formatNaira(price)}
                      </p>
                    </div>

                    {totalQty > 0 && primaryItem ? (
                      <div className="inline-flex items-center gap-1 bg-stone-900 border border-[#FFC700]/40 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() =>
                            totalQty <= 1
                              ? removeFromCart(primaryItem.id)
                              : updateCartQuantity(primaryItem.id, totalQty - 1)
                          }
                          className="w-7 h-7 rounded bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm flex items-center justify-center cursor-pointer"
                          aria-label={`Decrease quantity of ${fullProd.name}`}
                        >
                          −
                        </button>
                        <span className="px-2 text-xs font-black text-white">{totalQty}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(primaryItem.id, totalQty + 1)}
                          className="w-7 h-7 rounded bg-[#E62E00] hover:bg-[#C92200] text-white font-bold text-sm flex items-center justify-center cursor-pointer"
                          aria-label={`Increase quantity of ${fullProd.name}`}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(fullProd, 1)}
                        className="px-3 py-2 rounded-lg bg-[#E62E00] hover:bg-[#C92200] text-white text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Add to Cart
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
