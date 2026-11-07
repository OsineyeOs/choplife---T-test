import React, { useState, useEffect } from 'react';
import {
  Sparkles as SparklesIcon,
  Maximize2 as Maximize2Icon,
  Minimize2 as Minimize2Icon,
  ArrowLeft as ArrowLeftIcon,
  Flame as FlameIcon,
  Award as AwardIcon,
  Clock as ClockIcon,
  Store as StoreIcon,
  Tag as TagIcon,
  CheckCircle2 as CheckCircle2Icon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ShoppingBag as ShoppingBagIcon,
  Utensils,
} from 'lucide-react';


interface CfdPromo {
  id: string;
  title: string;
  subtitle?: string;
  productName: string;
  promotionType: string;
  discountPercent?: number;
  specialPrice?: number;
  originalPrice: number;
  badge?: string;
  badgeColor?: string;
  image?: string;
}

interface CfdBestseller {
  productId: string;
  productName: string;
  unitsSold: number;
  price: number;
  image: string;
}

interface CfdData {
  success: boolean;
  branchId: string;
  bestsellers: CfdBestseller[];
  promotions: CfdPromo[];
  welcomeScreen: {
    brandTitle: string;
    tagline: string;
    welcomeMessage: string;
    hasPromotions: boolean;
  };
}

export function CfdDisplayPage({ onReturnHome }: { onReturnHome?: () => void }) {
  const [branchId, setBranchId] = useState<'gra' | 'okabere' | 'ugbowo'>('gra');
  const [cfdData, setCfdData] = useState<CfdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePromoIndex, setActivePromoIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live time ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch CFD display screen data
  const fetchCfdData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cfd/display-screen?branchId=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        setCfdData(data);
      }
    } catch (err) {
      console.error('Failed to fetch CFD display data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCfdData();
    const interval = setInterval(fetchCfdData, 15000);
    return () => clearInterval(interval);
  }, [branchId]);

  // Promo rotation
  useEffect(() => {
    if (!cfdData?.promotions || cfdData.promotions.length <= 1) return;
    const interval = setInterval(() => {
      setActivePromoIndex((prev) => (prev + 1) % cfdData.promotions.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [cfdData?.promotions]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const branchNames: Record<string, string> = {
    gra: 'G.R.A. Branch, Benin City',
    okabere: 'Okabere Branch, Sapele Rd',
    ugbowo: 'Ugbowo Branch, Isihor',
  };

  const activePromo = cfdData?.promotions?.[activePromoIndex];

  return (
    <div className="min-h-screen bg-[#241311] text-[#FAF7F2] flex flex-col font-sans select-none overflow-hidden">
      {/* Top CFD Header Bar */}
      <header className="px-6 py-4 bg-[#180A09] border-b-2 border-[#FFC700] flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          {onReturnHome && (
            <button
              onClick={onReturnHome}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFC700] transition-colors"
              title="Return to Main App"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center font-black text-2xl shadow-md">
            C
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white uppercase font-heading">
              CHOPLIFE REPUBLIC
            </h1>
            <p className="text-xs text-[#FFC700] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <StoreIcon className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>{branchNames[branchId]}</span>
            </p>
          </div>
        </div>

        {/* Branch Selector & Time Indicator */}
        <div className="flex items-center gap-4">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-[#241311] text-[#FFC700] border border-[#FFC700]/40 text-xs font-bold outline-none cursor-pointer"
          >
            <option value="gra">GRA Branch</option>
            <option value="okabere">Okabere Branch</option>
            <option value="ugbowo">Ugbowo Branch</option>
          </select>

          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Terminal Live</span>
          </div>

          <div className="text-right font-mono text-sm text-[#FFC700] font-bold">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2Icon className="w-4 h-4" /> : <Maximize2Icon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-[#241311]">
        {/* Left / Top Section: Main Hero Display (8 Cols) */}
        <section className="lg:col-span-8 p-6 md:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#4D080F] bg-gradient-to-br from-[#241311] via-[#330D12] to-[#180A09]">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-stone-400 text-sm animate-pulse">
              Loading Customer Display Screen...
            </div>
          ) : cfdData?.promotions && cfdData.promotions.length > 0 && activePromo ? (
            /* Active Promotion Featured View */
            <div className="flex-1 flex flex-col justify-center space-y-6">
              <div className="flex items-center justify-between">
                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-md ${activePromo.badgeColor || 'bg-[#FFC700] text-[#4D080F]'}`}>
                  {activePromo.badge || 'PROMOTION SPECIAL'}
                </span>
                <span className="text-xs text-[#FFC700] font-extrabold uppercase tracking-widest flex items-center gap-1">
                  <FlameIcon className="w-4 h-4 text-amber-500 animate-bounce" /> Limited Time Deal
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h2 className="text-3xl md:text-4xl font-black text-white leading-tight font-heading">
                    {activePromo.title}
                  </h2>
                  {activePromo.subtitle && (
                    <p className="text-sm md:text-base text-stone-300 leading-relaxed">
                      {activePromo.subtitle}
                    </p>
                  )}

                  <div className="pt-2 flex items-baseline gap-4">
                    <span className="text-3xl md:text-4xl font-black text-[#FFC700]">
                      ₦{(activePromo.specialPrice || (activePromo.originalPrice * (1 - (activePromo.discountPercent || 0) / 100))).toLocaleString()}
                    </span>
                    {activePromo.discountPercent && activePromo.discountPercent > 0 && (
                      <span className="text-lg text-stone-400 line-through">
                        ₦{activePromo.originalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative rounded-3xl overflow-hidden border-2 border-[#FFC700]/40 shadow-2xl h-64 md:h-80 bg-stone-900">
                  <img
                    src={activePromo.image || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80'}
                    alt={activePromo.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-xs font-bold text-white flex items-center justify-between">
                    <span>{activePromo.productName}</span>
                    <span className="px-2.5 py-1 bg-[#800D15] text-[#FFC700] rounded-lg">
                      100% Maximum Enjoyment
                    </span>
                  </div>
                </div>
              </div>

              {/* Carousel Indicators if multiple promos */}
              {cfdData.promotions.length > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  {cfdData.promotions.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePromoIndex(idx)}
                      className={`h-2.5 rounded-full transition-all ${
                        idx === activePromoIndex ? 'w-8 bg-[#FFC700]' : 'w-2.5 bg-stone-700'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Neutral Branded Welcome Screen (Virgin / No Promo State) */
            <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6 max-w-xl mx-auto py-8">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#FFC700] to-amber-300 text-[#4D080F] flex items-center justify-center shadow-2xl">
                <Utensils className="w-10 h-10" />
              </div>

              <div>
                <span className="px-3.5 py-1 bg-[#800D15] text-[#FFC700] text-xs font-black uppercase tracking-widest rounded-full border border-[#FFC700]/30">
                  Welcome to Choplife Republic
                </span>
                <h2 className="text-3xl md:text-5xl font-black text-white mt-4 font-heading leading-tight">
                  100% MAXIMUM ENJOYMENT
                </h2>
                <p className="text-sm md:text-base text-amber-100/80 mt-3 max-w-md mx-auto leading-relaxed">
                  Authentic Nigerian Woodfire Grill, Small Chops, Party Jollof & Premium Dining Experience.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full pt-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-1">
                  <div className="text-[#FFC700] font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2Icon className="w-4 h-4" /> 100% Fresh
                  </div>
                  <p className="text-xs text-stone-300">Grilled fresh daily with local firewood & secret spices.</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-1">
                  <div className="text-[#FFC700] font-bold text-xs flex items-center gap-1.5">
                    <AwardIcon className="w-4 h-4" /> VIP Service
                  </div>
                  <p className="text-xs text-stone-300">Fast counter pickup, dine-in comfort, and online delivery.</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer Slogan Bar */}
          <footer className="pt-6 border-t border-[#4D080F] flex items-center justify-between text-xs text-amber-200/60 font-medium">
            <span>Enjoy Yourself, Is That Too Much To Ask?</span>
            <span>Choplife Republic &bull; Benin City</span>
          </footer>
        </section>

        {/* Right Section: Bestsellers Showcase (4 Cols) */}
        <section className="lg:col-span-4 p-6 bg-[#180A09] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between pb-4 border-b border-[#4D080F] mb-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#FFC700] flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-[#FFC700]" /> Top Bestsellers
            </h3>
            <span className="text-[10px] text-stone-400 uppercase tracking-widest font-mono">
              Live Popularity
            </span>
          </div>

          <div className="space-y-3.5 flex-1">
            {cfdData?.bestsellers && cfdData.bestsellers.length > 0 ? (
              cfdData.bestsellers.map((item, idx) => (
                <div
                  key={item.productId || idx}
                  className="p-3.5 rounded-2xl bg-[#241311] border border-[#4D080F] flex items-center justify-between gap-3 shadow-md hover:border-[#FFC700]/40 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-xl bg-[#800D15] text-[#FFC700] font-black text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{item.productName}</h4>
                      <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                        {item.unitsSold > 0 ? `${item.unitsSold} orders satisfied` : 'Popular Favorite'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-[#FFC700]">
                      ₦{item.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-stone-500 text-xs">
                Top menu selections loading...
              </div>
            )}
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-[#800D15]/80 to-[#4D080F] border border-[#FFC700]/30 text-center space-y-1">
            <p className="text-xs font-black text-[#FFC700] uppercase tracking-wider">
              Scan QR Code to Order Online
            </p>
            <p className="text-[11px] text-stone-200">
              Visit choplife.ng on your mobile device for fast pickup & delivery!
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
