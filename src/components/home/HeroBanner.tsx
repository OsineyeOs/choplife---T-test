import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Flame,
  Truck,
  Store,
  Clock,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  ChevronRight,
  MapPin,
  Play,
} from 'lucide-react';

export const HeroBanner: React.FC = () => {
  const {
    currentBranch,
    selectedBranchId,
    setIsLocationsModalOpen,
    setIsSmallChopsBuilderOpen,
    getBranchWhatsAppUrl,
    cmsContent,
  } = useApp();

  const scrollToMenu = () => {
    const el = document.getElementById('menu-explorer-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const badgeText = cmsContent?.hero?.badge || 'AUTHENTIC BENIN CITY CUISINE';
  const headline = cmsContent?.hero?.headline || 'ENJOY YOURSELF, IS THAT TOO MUCH TO ASK?';
  const subheadline =
    cmsContent?.hero?.subheadline ||
    'Crispy golden spring rolls, loaded monster shawarma, party firewood jollof, and charcoal suya platters — freshly prepared across our Benin City hubs.';
  const tickerText = cmsContent?.hero?.announcementTicker;
  const isTickerActive = cmsContent?.hero?.isTickerActive !== false;

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-[#4D080F] via-[#38050A] to-[#250306] text-white pt-4 pb-14 sm:pt-6 sm:pb-20"
      id="hero-section"
    >
      {/* Dynamic Announcement Ticker */}
      {isTickerActive && tickerText && (
        <div className="bg-[#FFC700] text-[#4D080F] py-2 px-4 mb-6 shadow-md border-b border-[#E5B200]">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-xs font-black tracking-wide uppercase text-center">
            <span className="w-2 h-2 rounded-full bg-[#800D15] animate-ping" />
            <span>{tickerText}</span>
          </div>
        </div>
      )}

      {/* Background Decorative Grid Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#FFC700_1.5px,transparent_1.5px)] [background-size:20px_20px]" />

      {/* Ambient Lighting Blurs */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#E62E00]/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-[#FFC700]/15 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Brand Statement, Branch Status & Primary Action */}
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#FFC700]/40 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-[#FFC700] animate-pulse" />
              <span className="font-titan text-xs text-[#FFC700] tracking-wider uppercase">
                {badgeText}
              </span>
              <span className="text-white/40">|</span>
              <span className="text-[11px] font-montserrat font-semibold text-white/90">
                Small Chops & Charcoal Grills
              </span>
            </div>

            {/* Main Brand Headline */}
            <div className="space-y-2">
              <h1 className="font-titan text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.08] drop-shadow-sm whitespace-pre-line">
                {headline}
              </h1>
              <p className="font-montserrat font-medium text-sm sm:text-base text-white/85 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {subheadline}
              </p>
            </div>

            {/* Compact Active Branch Indicator */}
            <div className="bg-black/35 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg max-w-xl mx-auto lg:mx-0">
              <div className="flex items-center gap-3 text-left w-full sm:w-auto">
                <div className="w-9 h-9 rounded-xl bg-[#E62E00] text-[#FFC700] flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#FFC700] uppercase font-titan tracking-wider">
                      Branch:
                    </span>
                    <span className="text-xs font-titan text-white">{currentBranch.name}</span>
                  </div>
                  <p className="text-[11px] text-stone-300 font-montserrat truncate max-w-xs">
                    {currentBranch.address}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between w-full sm:w-auto gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-stone-400 font-montserrat block">Prep & Delivery</span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 font-montserrat">
                    <Clock className="w-3 h-3" />
                    {currentBranch.estimatedDeliveryTime}
                  </span>
                </div>
                <button
                  onClick={() => setIsLocationsModalOpen(true)}
                  className="text-xs font-titan text-[#FFC700] hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-colors"
                  id="hero-change-branch-btn"
                >
                  Change Branch
                </button>
              </div>
            </div>

            {/* Hierarchical CTAs: Dominant Primary + Secondary */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                onClick={scrollToMenu}
                className="bg-[#FFC700] hover:bg-[#FFD733] text-[#4D080F] font-titan text-base px-8 py-3.5 rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 group"
                id="hero-order-online-btn"
              >
                <span>ORDER ONLINE NOW</span>
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={() => setIsSmallChopsBuilderOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-montserrat font-bold text-xs sm:text-sm px-5 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2"
                id="hero-build-box-btn"
              >
                <Sparkles className="w-4 h-4 text-[#FFC700]" />
                Build Custom Platter
              </button>

              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-launch-video'));
                }}
                className="bg-[#800D15]/90 hover:bg-[#800D15] text-[#FFC700] border border-[#FFC700]/50 font-titan text-xs sm:text-sm px-5 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
                id="hero-watch-launch-film-btn"
              >
                <div className="w-6 h-6 rounded-full bg-[#FFC700] text-[#4D080F] flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 fill-[#4D080F] ml-0.5" />
                </div>
                <span>Watch Launch Film</span>
              </button>
            </div>

            {/* Subtle WhatsApp Alternative & Assurance Note */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-montserrat text-white/70 pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FFC700]" />
                100% Bromate-Free Bakery
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                Live Courier Dispatch
              </span>
              <span>•</span>
              <a
                href={getBranchWhatsAppUrl(
                  selectedBranchId,
                  `Hello Choplife Republic (${currentBranch.shortName}), I would like to order.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#25D366] hover:underline flex items-center gap-1 font-bold"
                id="hero-whatsapp-fallback-btn"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp Ordering
              </a>
            </div>
          </div>

          {/* Right Column: Hero Visual Card (Clean layout, no overflowing clutter stickers) */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Main Dish Imagery Card */}
              <div className="relative rounded-3xl overflow-hidden border-2 border-[#FFC700]/60 shadow-2xl bg-[#250306]">
                <img
                  src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80"
                  alt="Choplife Republic Small Chops & Grill Platter"
                  className="w-full h-72 sm:h-88 object-cover"
                />

                {/* Bottom Overlay Label */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-5 text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFC700] text-[#4D080F] text-xs font-titan uppercase mb-1 shadow-md">
                    <Flame className="w-3 h-3 text-[#E62E00]" />
                    <span>CHOPPING LIFE DAILY</span>
                  </div>
                  <p className="text-xs font-montserrat text-white/90">
                    GRA • Okabere • Ugbowo
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
