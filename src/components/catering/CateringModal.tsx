import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CateringProductionPlanner } from './CateringProductionPlanner';
import {
  X,
  Sparkles,
  Calculator,
  Users,
  CheckCircle2,
  Phone,
  MessageCircle,
  ShoppingBag,
  Flame,
  Calendar,
  Layers,
} from 'lucide-react';

export const CateringModal: React.FC = () => {
  const {
    isCateringModalOpen,
    setIsCateringModalOpen,
    formatNaira,
    currentBranch,
    selectedBranchId,
    getBranchWhatsAppUrl,
    addToCart,
    products,
  } = useApp();

  const [activeView, setActiveView] = useState<'calculator' | 'production_planner'>('calculator');
  const [guestCount, setGuestCount] = useState(30);
  const [cateringStyle, setCateringStyle] = useState<'chops_heavy' | 'party_jollof_grills' | 'shawarma_bar' | 'mixed_executive'>('chops_heavy');
  const [includeDrinks, setIncludeDrinks] = useState(true);
  const [selectedDrinkId, setSelectedDrinkId] = useState<string>('prod-drink-zobo');
  const [includeDeliverySetup, setIncludeDeliverySetup] = useState(true);

  if (!isCateringModalOpen) return null;

  // Authoritative catalogue lookup helper
  const getCatalogueProduct = (id: string, fallbackName: string, fallbackPrice: number) => {
    const found = products.find((p) => p.id === id);
    return {
      id,
      name: found ? found.name : fallbackName,
      unitPrice: found ? Number(found.basePrice) : fallbackPrice,
    };
  };

  const approvedBeverageOptions = [
    getCatalogueProduct('prod-drink-zobo', 'Zobo', 1000),
    getCatalogueProduct('prod-drink-malt', 'Malt', 800),
    getCatalogueProduct('prod-drink-coke-big', 'Big Coke', 800),
    getCatalogueProduct('prod-drink-chivita-active', 'Chivita Active', 2500),
    getCatalogueProduct('prod-drink-chi-exotic', 'Chi Exotic', 2500),
  ];

  const selectedDrink =
    approvedBeverageOptions.find((d) => d.id === selectedDrinkId) || approvedBeverageOptions[0];

  // Authoritative per-guest menu item compositions derived from approved Choplife Republic menu products
  const getStyleComponentsPerGuest = (): Array<{
    productId: string;
    fallbackName: string;
    fallbackPrice: number;
    qtyPerGuest: number;
  }> => {
    switch (cateringStyle) {
      case 'party_jollof_grills':
        return [
          { productId: 'prod-qsr-jollof-rice', fallbackName: 'Jollof Rice', fallbackPrice: 1800, qtyPerGuest: 1 },
          { productId: 'prod-protein-chicken-big', fallbackName: 'Chicken (Big)', fallbackPrice: 2500, qtyPerGuest: 1 },
          { productId: 'prod-qsr-fried-plantain', fallbackName: 'Fried Plantain', fallbackPrice: 500, qtyPerGuest: 1 },
          { productId: 'prod-qsr-coleslaw', fallbackName: 'Coleslaw', fallbackPrice: 500, qtyPerGuest: 1 },
        ];
      case 'shawarma_bar':
        return [
          { productId: 'prod-snack-shawarma-chicken-reg', fallbackName: 'Chicken Shawarma', fallbackPrice: 3500, qtyPerGuest: 1 },
          { productId: 'prod-qsr-chips', fallbackName: 'Chips', fallbackPrice: 1500, qtyPerGuest: 1 },
        ];
      case 'mixed_executive':
        return [
          { productId: 'prod-qsr-jollof-rice', fallbackName: 'Jollof Rice', fallbackPrice: 1800, qtyPerGuest: 1 },
          { productId: 'prod-qsr-fried-rice', fallbackName: 'Fried Rice', fallbackPrice: 1800, qtyPerGuest: 1 },
          { productId: 'prod-sc-samosa', fallbackName: 'Samosa', fallbackPrice: 350, qtyPerGuest: 1 },
          { productId: 'prod-sc-spring-roll', fallbackName: 'Spring Roll', fallbackPrice: 350, qtyPerGuest: 1 },
          { productId: 'prod-sc-puff-puff', fallbackName: 'Puff-Puff', fallbackPrice: 100, qtyPerGuest: 2 },
          { productId: 'prod-sc-gizzard', fallbackName: 'Peppered Gizzard', fallbackPrice: 1500, qtyPerGuest: 1 },
          { productId: 'prod-protein-turkey', fallbackName: 'Turkey', fallbackPrice: 4200, qtyPerGuest: 1 },
        ];
      case 'chops_heavy':
      default:
        return [
          { productId: 'prod-sc-spring-roll', fallbackName: 'Spring Roll', fallbackPrice: 350, qtyPerGuest: 2 },
          { productId: 'prod-sc-samosa', fallbackName: 'Samosa', fallbackPrice: 350, qtyPerGuest: 2 },
          { productId: 'prod-sc-puff-puff', fallbackName: 'Puff-Puff', fallbackPrice: 100, qtyPerGuest: 4 },
          { productId: 'prod-sc-chicken-cut', fallbackName: 'Chicken Cut in Packs', fallbackPrice: 1300, qtyPerGuest: 1 },
        ];
    }
  };

  const safeGuestCount = Math.max(1, parseInt(String(guestCount), 10) || 10);

  const resolvedFoodLineItems = getStyleComponentsPerGuest().map((comp) => {
    const prod = getCatalogueProduct(comp.productId, comp.fallbackName, comp.fallbackPrice);
    const totalQty = comp.qtyPerGuest * safeGuestCount;
    const perGuestSubtotal = prod.unitPrice * comp.qtyPerGuest;
    const lineTotal = prod.unitPrice * totalQty;
    return {
      ...prod,
      qtyPerGuest: comp.qtyPerGuest,
      totalQty,
      perGuestSubtotal,
      lineTotal,
    };
  });

  const foodCostPerGuest = resolvedFoodLineItems.reduce((sum, item) => sum + item.perGuestSubtotal, 0);
  const foodTotal = resolvedFoodLineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const drinkCostPerGuest = includeDrinks ? selectedDrink.unitPrice : 0;
  const drinkTotal = includeDrinks ? selectedDrink.unitPrice * safeGuestCount : 0;
  const costPerGuest = foodCostPerGuest + drinkCostPerGuest;
  const setupLogisticsEstimate = includeDeliverySetup ? 10000 : 0;
  const totalEstimatedCost = foodTotal + drinkTotal + setupLogisticsEstimate;

  const getStyleBreakdown = () => {
    const foodDesc = resolvedFoodLineItems
      .map((line) => `${line.totalQty}x ${line.name} (@ ${formatNaira(line.unitPrice)})`)
      .join(' + ');
    const drinkDesc = includeDrinks
      ? ` + ${safeGuestCount}x ${selectedDrink.name} (@ ${formatNaira(selectedDrink.unitPrice)})`
      : '';
    return `${foodDesc}${drinkDesc}`;
  };

  const handle1ClickBook = () => {
    const baseProduct = products.find((p) => p.id === 'prod-sc-box-custom') || products[0];
    const cateringProduct = {
      ...baseProduct,
      id: `catering-${Date.now()}`,
      name: `Estimated Catering Quote (${safeGuestCount} Guests - ${cateringStyle.replace(/_/g, ' ').toUpperCase()})`,
      shortDescription: getStyleBreakdown(),
      basePrice: totalEstimatedCost,
    };

    addToCart(cateringProduct, 1, {
      selectedOptions: [],
      selectedAddOns: [],
      specialInstructions: `Estimated Catering Quote (Subject to Staff Confirmation) for ${safeGuestCount} guests. Food Subtotal: ${formatNaira(foodTotal)}, Drinks Subtotal: ${formatNaira(drinkTotal)}, Setup Estimate: ${formatNaira(setupLogisticsEstimate)}. Breakdown: ${getStyleBreakdown()}`,
    });

    setIsCateringModalOpen(false);
  };

  const inquiryWhatsAppText = `Hello Choplife Republic (${currentBranch.shortName}), I would like to request confirmation for an Event Catering Quote for ${safeGuestCount} guests. Style: ${cateringStyle}. Menu Food Subtotal: ${formatNaira(foodTotal)}, Drinks: ${formatNaira(drinkTotal)}, Setup Estimate: ${formatNaira(setupLogisticsEstimate)}. Total Estimated Quote: ${formatNaira(totalEstimatedCost)}.`;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      id="catering-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsCateringModalOpen(false);
        }
      }}
    >
      <div className={`bg-white rounded-3xl w-full ${activeView === 'production_planner' ? 'max-w-5xl' : 'max-w-2xl'} max-h-[92vh] overflow-y-auto shadow-2xl border-2 border-[#FFC700] flex flex-col justify-between transition-all`}>
        
        {/* Header */}
        <div className="bg-[#4D080F] text-white p-4 sm:p-5 rounded-t-3xl flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center font-titan text-xl">
              🎉
            </div>
            <div>
              <span className="text-[10px] font-titan uppercase tracking-widest text-[#FFC700] block">
                CHOPLIFE CATERING & COMMISSARY
              </span>
              <h2 className="font-titan text-lg sm:text-xl text-white">
                BULK ORDERS & EVENT PRODUCTION
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex bg-black/30 p-1 rounded-xl border border-white/20">
              <button
                onClick={() => setActiveView('calculator')}
                className={`px-3 py-1 text-xs font-montserrat font-bold rounded-lg transition-all ${
                  activeView === 'calculator'
                    ? 'bg-[#FFC700] text-[#4D080F]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                Party Calculator
              </button>
              <button
                onClick={() => setActiveView('production_planner')}
                className={`px-3 py-1 text-xs font-montserrat font-bold rounded-lg transition-all flex items-center gap-1 ${
                  activeView === 'production_planner'
                    ? 'bg-[#FFC700] text-[#4D080F]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Production BOM
              </button>
            </div>

            <button
              onClick={() => setIsCateringModalOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              id="close-catering-modal-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeView === 'production_planner' ? (
          <div className="p-4 sm:p-6 overflow-y-auto">
            <CateringProductionPlanner />
          </div>
        ) : (
          <>
            {/* Calculator Body */}
            <div className="p-5 sm:p-6 space-y-6 flex-1">
          
          {/* Guest slider & Direct Entry */}
          <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E5DEC9] space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-titan text-xs text-[#4D080F] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#E62E00]" />
                NUMBER OF GUESTS: <span className="text-xl text-[#E62E00] font-titan ml-1">{safeGuestCount.toLocaleString()} GUESTS</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={guestCount}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setGuestCount('' as any);
                      return;
                    }
                    const val = parseInt(raw, 10);
                    if (!Number.isNaN(val) && val >= 1) {
                      setGuestCount(Math.min(100000, val));
                    }
                  }}
                  onBlur={() => {
                    if (!guestCount || Number(guestCount) < 1) {
                      setGuestCount(10);
                    }
                  }}
                  className="w-24 px-2 py-1 text-xs font-montserrat font-bold border border-[#E5DEC9] rounded-lg bg-white text-center text-[#241311] focus:outline-none focus:ring-1 focus:ring-[#E62E00]"
                  aria-label="Direct guest count input"
                  id="catering-direct-guest-input"
                />
                <span className="text-xs font-montserrat text-[#7A6A65] font-bold">10 – 50,000+</span>
              </div>
            </div>

            <input
              type="range"
              min={10}
              max={1000}
              step={5}
              value={Math.min(1000, Math.max(10, safeGuestCount))}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              className="w-full h-2.5 bg-[#E5DEC9] rounded-lg appearance-none cursor-pointer accent-[#E62E00]"
              id="catering-guest-slider"
            />

            <div className="flex justify-between text-[11px] font-montserrat font-bold text-[#7A6A65]">
              <span>Gathering (10)</span>
              <span>Celebration / Office (100)</span>
              <span>Mega Event / Concert (500 – 1,000+)</span>
            </div>
          </div>

          {/* Catering Style Selector */}
          <div className="space-y-3">
            <label className="font-titan text-xs text-[#4D080F] uppercase tracking-wider block">
              CHOOSE APPROVED MENU FEAST FORMAT
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'chops_heavy', title: 'Small Chops Assortment', desc: '2 Spring Rolls, 2 Samosas, 4 Puff-Puff & 1 Chicken Cut per guest', badge: 'Most Popular' },
                { id: 'party_jollof_grills', title: 'Party Jollof & Chicken Grill', desc: 'Jollof Rice, Big Chicken, Fried Plantain & Coleslaw per guest', badge: 'Full Meal' },
                { id: 'shawarma_bar', title: 'Live Shawarma & Chips Station', desc: 'Regular Chicken Shawarma & Chips per guest', badge: 'Party Hit' },
                { id: 'mixed_executive', title: 'Executive Complete Feast', desc: 'Jollof & Fried Rice, Small Chops, Peppered Gizzard & Turkey per guest', badge: 'Luxury' },
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => setCateringStyle(style.id as any)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                    cateringStyle === style.id
                      ? 'border-[#E62E00] bg-[#FFF8E7] shadow-xs ring-1 ring-[#E62E00]'
                      : 'border-[#E5DEC9] bg-[#FAF7F2] hover:bg-white'
                  }`}
                  id={`catering-style-${style.id}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-titan text-xs sm:text-sm text-[#241311]">{style.title}</p>
                      <span className="text-[9px] font-titan text-[#E62E00] bg-white px-2 py-0.5 rounded-full border border-[#E5DEC9]">
                        {style.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5C4D49] font-montserrat">{style.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Add-on toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div
              className={`p-3 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                includeDrinks ? 'bg-[#FFF8E7] border-[#E62E00]' : 'bg-[#FAF7F2] border-[#E5DEC9]'
              }`}
            >
              <button
                type="button"
                onClick={() => setIncludeDrinks(!includeDrinks)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">🍹</span>
                  <div>
                    <p className="font-titan text-xs text-[#241311]">Include Approved Beverage</p>
                    <p className="text-[10px] text-[#7A6A65] font-montserrat">
                      +{formatNaira(selectedDrink.unitPrice)} per guest ({selectedDrink.name})
                    </p>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                  includeDrinks ? 'bg-[#E62E00] border-[#E62E00]' : 'border-gray-400'
                }`}>
                  {includeDrinks && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
              </button>
              {includeDrinks && (
                <select
                  value={selectedDrinkId}
                  onChange={(e) => setSelectedDrinkId(e.target.value)}
                  className="w-full text-[11px] font-montserrat font-bold bg-white border border-[#E5DEC9] rounded-lg px-2 py-1 text-[#241311]"
                  aria-label="Select approved drink for catering"
                >
                  {approvedBeverageOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {formatNaira(d.unitPrice)} / guest
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={() => setIncludeDeliverySetup(!includeDeliverySetup)}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                includeDeliverySetup ? 'bg-[#FFF8E7] border-[#E62E00]' : 'bg-[#FAF7F2] border-[#E5DEC9]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🚚</span>
                <div>
                  <p className="font-titan text-xs text-[#241311]">Chafing Dish & Delivery Setup</p>
                  <p className="text-[10px] text-[#7A6A65] font-montserrat">Separate logistics estimate ({formatNaira(10000)})</p>
                </div>
              </div>
              <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                includeDeliverySetup ? 'bg-[#E62E00] border-[#E62E00]' : 'border-gray-400'
              }`}>
                {includeDeliverySetup && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
            </button>
          </div>

          {/* Authoritative Itemized Breakdown Box */}
          <div className="bg-[#FFF8E7] p-4 rounded-2xl border border-[#FFC700] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-titan text-xs text-[#4D080F] uppercase tracking-wider">
                AUTHORITATIVE MENU ITEM BREAKDOWN ({guestCount} GUESTS):
              </h4>
              <span className="text-[10px] font-montserrat font-bold bg-amber-100 text-[#4D080F] px-2 py-0.5 rounded-full border border-amber-300">
                Estimated Quote — Subject to Staff Confirmation
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-montserrat">
              {resolvedFoodLineItems.map((line) => (
                <div key={line.id} className="flex items-center justify-between text-[#241311]">
                  <span>
                    <strong>{line.totalQty}x</strong> {line.name} ({line.qtyPerGuest}/guest @ {formatNaira(line.unitPrice)})
                  </span>
                  <span className="font-bold">{formatNaira(line.lineTotal)}</span>
                </div>
              ))}
              <div className="pt-1.5 border-t border-[#FFC700]/40 flex items-center justify-between font-bold text-[#4D080F]">
                <span>Authoritative Menu Food Subtotal ({formatNaira(foodCostPerGuest)} / guest)</span>
                <span>{formatNaira(foodTotal)}</span>
              </div>
              {includeDrinks && (
                <div className="flex items-center justify-between text-[#241311]">
                  <span>
                    <strong>{guestCount}x</strong> {selectedDrink.name} (1/guest @ {formatNaira(selectedDrink.unitPrice)})
                  </span>
                  <span className="font-bold">{formatNaira(drinkTotal)}</span>
                </div>
              )}
              {includeDeliverySetup && (
                <div className="flex items-center justify-between text-[#5C4D49]">
                  <span>Estimated Delivery & Chafing Setup Fee (Separate Logistics Estimate)</span>
                  <span className="font-bold">{formatNaira(setupLogisticsEstimate)}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between text-xs font-montserrat text-[#7A6A65] border-t border-[#FFC700]/40">
              <span>Food + Drink / Guest: <strong className="text-[#241311]">{formatNaira(costPerGuest)}</strong></span>
              <span>Kitchen: <strong className="text-[#4D080F]">{currentBranch.name}</strong></span>
            </div>
          </div>

        </div>

        {/* Footer with 1-Click Order or WhatsApp Inquiry */}
        <div className="bg-[#FAF7F2] p-4 sm:p-5 rounded-b-3xl border-t border-[#E5DEC9] flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0">
          <div>
            <span className="text-[10px] text-[#7A6A65] font-montserrat uppercase font-bold block">
              ESTIMATED QUOTE (SUBJECT TO CONFIRMATION)
            </span>
            <span className="font-titan text-2xl text-[#E62E00]">
              {formatNaira(totalEstimatedCost)}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={getBranchWhatsAppUrl(selectedBranchId, inquiryWhatsAppText)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial bg-white border border-[#25D366] text-[#006039] hover:bg-emerald-50 font-montserrat font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <MessageCircle className="w-4 h-4 text-[#25D366] fill-[#25D366]" />
              <span>Confirm Quote via WhatsApp</span>
            </a>

            <button
              onClick={handle1ClickBook}
              className="flex-1 sm:flex-initial bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs sm:text-sm py-3 px-5 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-1.5"
              id="add-catering-to-cart-btn"
            >
              <ShoppingBag className="w-4 h-4 text-[#FFC700]" />
              <span>ADD ESTIMATED QUOTE TO CART</span>
            </button>
          </div>
        </div>
        </>
      )}

      </div>
    </div>
  );
};
