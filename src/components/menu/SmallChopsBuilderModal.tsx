import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import {
  X,
  Plus,
  Minus,
  Check,
  ShoppingBag,
  Sparkles,
  Box,
  Layers,
  ChevronRight,
  Flame,
} from 'lucide-react';

interface ApprovedSingleItem {
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  emoji: string;
  desc: string;
}

const APPROVED_SINGLE_ITEMS: ApprovedSingleItem[] = [
  { id: 'item-samosa', productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', unitPrice: 500, emoji: '🔺', desc: 'Crispy triangular pastry filled with spiced beef' },
  { id: 'item-springroll', productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', unitPrice: 500, emoji: '🥟', desc: 'Crispy spring roll with chicken & veggies' },
  { id: 'item-puff-puff', productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', unitPrice: 100, emoji: '🟡', desc: 'Soft, airy, sweet golden puff puff' },
  { id: 'item-beef-bite', productId: 'prod-sc-beef-single', name: 'Beef Small Chops', unitPrice: 400, emoji: '🥩', desc: 'Single portion tender seasoned beef bite' },
  { id: 'item-hotdog', productId: 'prod-sc-hotdog-single', name: 'Hotdog Small Chops', unitPrice: 500, emoji: '🌭', desc: 'Grilled seasoned sausage hot dog' },
  { id: 'item-sausage-roll', productId: 'prod-snack-sausage-roll', name: 'Sausage Roll', unitPrice: 1000, emoji: '🥖', desc: 'Golden flaky puff pastry rolled with sausage' },
  { id: 'item-scotch-egg', productId: 'prod-snack-scotch-egg', name: 'Scotch Egg', unitPrice: 1000, emoji: '🥚', desc: 'Hard-boiled egg in spiced sausage & crumbs' },
  { id: 'item-egg-roll', productId: 'prod-snack-egg-roll', name: 'Egg Roll', unitPrice: 700, emoji: '🥚', desc: 'Sweet golden fried dough with whole boiled egg' },
  { id: 'item-fish-roll', productId: 'prod-snack-fish-roll', name: 'Fish Roll', unitPrice: 1000, emoji: '🐟', desc: 'Crispy fried pastry filled with seasoned flaked fish' },
];

export const SmallChopsBuilderModal: React.FC = () => {
  const {
    isSmallChopsBuilderOpen,
    setIsSmallChopsBuilderOpen,
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    products,
    formatNaira,
    selectedBranchId,
    setActiveCategory,
  } = useApp();

  const [activeMode, setActiveMode] = useState<'packages' | 'custom'>('packages');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'all' | 'mini' | 'combos' | 'platters'>('all');

  useEffect(() => {
    const handleOpenMiniPacks = () => {
      setActiveMode('packages');
      setSelectedCategoryTab('mini');
    };
    window.addEventListener('choplife:open-mini-packs', handleOpenMiniPacks);
    return () => window.removeEventListener('choplife:open-mini-packs', handleOpenMiniPacks);
  }, []);

  // Custom piece counts: starts at 0 pieces
  const [itemCounts, setItemCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    APPROVED_SINGLE_ITEMS.forEach((item) => {
      initial[item.id] = 0;
    });
    return initial;
  });

  const smallChopsProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.category === 'small-chops' &&
        (!p.status || p.status === 'published') &&
        (p as any).isActive !== false &&
        p.id !== 'prod-sc-box-custom'
    );
  }, [products]);

  const filteredPackages = useMemo(() => {
    if (selectedCategoryTab === 'mini') {
      return smallChopsProducts.filter((p) => p.subcategory === 'Mini Packs' || p.subcategory === 'Munch Packs');
    }
    if (selectedCategoryTab === 'combos') {
      return smallChopsProducts.filter((p) => p.subcategory === 'Combo Packs' || p.subcategory === 'Turkey Combos');
    }
    if (selectedCategoryTab === 'platters') {
      return smallChopsProducts.filter((p) => p.subcategory === 'Party Platters' || p.subcategory === 'Mega Platters');
    }
    return smallChopsProducts;
  }, [smallChopsProducts, selectedCategoryTab]);

  if (!isSmallChopsBuilderOpen) return null;

  const handleIncrement = (id: string) => {
    setItemCounts((prev) => ({
      ...prev,
      [id]: Math.min(500, (prev[id] || 0) + 1),
    }));
  };

  const handleDecrement = (id: string) => {
    setItemCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) - 1),
    }));
  };

  const handleDirectPieceInput = (id: string, rawVal: string) => {
    if (rawVal.trim() === '') {
      setItemCounts((prev) => ({ ...prev, [id]: 0 }));
      return;
    }
    const parsed = parseInt(rawVal, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setItemCounts((prev) => ({ ...prev, [id]: Math.min(500, parsed) }));
    }
  };

  const customTotalCount = (Object.values(itemCounts) as number[]).reduce((a, b) => a + b, 0);

  const customTotalPrice = APPROVED_SINGLE_ITEMS.reduce((sum, item) => {
    const qty = itemCounts[item.id] || 0;
    return sum + qty * item.unitPrice;
  }, 0);

  const handleAddCustomAssortmentToCart = () => {
    if (customTotalCount === 0) return;

    const itemsSummary = APPROVED_SINGLE_ITEMS
      .filter((item) => (itemCounts[item.id] || 0) > 0)
      .map((item) => `${itemCounts[item.id]}x ${item.name}`);

    const baseProduct = products.find((p) => p.id === 'prod-sc-2000-mini') || products[0];

    const customProduct: Product = {
      ...baseProduct,
      id: `custom-sc-${Date.now()}`,
      name: `Custom Small Chops Box (${customTotalCount} Pieces)`,
      shortDescription: itemsSummary.join(', '),
      longDescription: `Assorted custom small chops box curated by customer: ${itemsSummary.join(', ')}.`,
      basePrice: customTotalPrice,
    };

    addToCart(customProduct, 1, {
      specialInstructions: `Custom Assorted Box: ${itemsSummary.join(', ')}`,
      smallChopsBoxItems: APPROVED_SINGLE_ITEMS
        .filter((item) => (itemCounts[item.id] || 0) > 0)
        .map((item) => ({
          item: item.name,
          count: itemCounts[item.id],
        })),
    });

    setIsSmallChopsBuilderOpen(false);
  };

  const getPackageCartLine = (productId: string) => {
    return cart.find((item) => item.productId === productId);
  };

  const handlePackageQuantityChange = (product: Product, nextQty: number) => {
    const existing = getPackageCartLine(product.id);
    if (nextQty <= 0) {
      if (existing) removeFromCart(existing.id);
    } else if (existing) {
      updateCartQuantity(existing.id, Math.min(500, nextQty));
    } else {
      addToCart(product, Math.min(500, nextQty));
    }
  };

  const handleBrowseSmallChopsCategory = () => {
    setActiveCategory('small-chops');
    setIsSmallChopsBuilderOpen(false);
    const element = document.getElementById('menu-explorer-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      id="small-chops-builder-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsSmallChopsBuilderOpen(false);
        }
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl border-2 border-[#FFC700] flex flex-col justify-between">
        
        {/* Header */}
        <div className="bg-[#4D080F] text-white p-5 sm:p-6 rounded-t-3xl flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center font-titan text-xl shrink-0">
              🥟
            </div>
            <div>
              <span className="text-[10px] font-titan uppercase tracking-widest text-[#FFC700] block">
                BENIN CITY SMALL CHOPS
              </span>
              <h2 className="font-titan text-lg sm:text-2xl text-white">
                BUILD &amp; SELECT SMALL CHOPS
              </h2>
            </div>
          </div>

          <button
            onClick={() => setIsSmallChopsBuilderOpen(false)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            id="close-builder-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-5 sm:p-6 space-y-6 flex-1">
          <div className="grid grid-cols-2 gap-2 bg-[#FAF7F2] p-1.5 rounded-2xl border border-[#E5DEC9]">
            <button
              onClick={() => setActiveMode('packages')}
              className={`py-3 rounded-xl font-titan text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                activeMode === 'packages'
                  ? 'bg-[#E62E00] text-white shadow-sm'
                  : 'text-[#4D080F] hover:bg-white/60'
              }`}
              id="tab-approved-packages"
            >
              <Layers className="w-4 h-4 text-[#FFC700]" />
              <span>PACKS &amp; PLATTERS</span>
            </button>

            <button
              onClick={() => setActiveMode('custom')}
              className={`py-3 rounded-xl font-titan text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                activeMode === 'custom'
                  ? 'bg-[#E62E00] text-white shadow-sm'
                  : 'text-[#4D080F] hover:bg-white/60'
              }`}
              id="tab-custom-box-builder"
            >
              <Box className="w-4 h-4 text-[#FFC700]" />
              <span>CUSTOM PIECE ASSORTMENT</span>
            </button>
          </div>

          {/* Mode 1: Packs & Platters */}
          {activeMode === 'packages' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-[#7A6A65] font-montserrat">
                  Select from fresh Choplife Republic mini packs, combos, and event party platters.
                </p>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: 'All Packs' },
                    { id: 'mini', label: 'Mini & Munch' },
                    { id: 'combos', label: 'Combos & Turkey' },
                    { id: 'platters', label: 'Party Platters' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedCategoryTab(tab.id as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-montserrat font-bold transition-colors ${
                        selectedCategoryTab === tab.id
                          ? 'bg-[#4D080F] text-[#FFC700]'
                          : 'bg-[#FAF7F2] text-[#5C4D49] border border-[#E5DEC9]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Package Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {filteredPackages.map((pkg) => {
                  const cartLine = getPackageCartLine(pkg.id);
                  const cartQty = cartLine?.quantity || 0;
                  return (
                    <div
                      key={pkg.id}
                      className="bg-[#FAF7F2] hover:bg-white p-3.5 rounded-2xl border border-[#E5DEC9] hover:border-[#E62E00] transition-all flex flex-col justify-between group shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-titan text-sm text-[#4D080F] group-hover:text-[#E62E00] transition-colors">
                            {pkg.name}
                          </span>
                          <span className="font-titan text-sm text-[#E62E00] shrink-0">
                            {formatNaira(pkg.basePrice * (cartQty > 0 ? cartQty : 1))}
                          </span>
                        </div>
                        <p className="text-xs text-[#5C4D49] font-montserrat mt-1 line-clamp-2">
                          {pkg.shortDescription}
                        </p>
                      </div>

                      <div className="pt-3 mt-2 border-t border-[#E5DEC9] flex items-center justify-end gap-2">
                        {cartQty === 0 ? (
                          <button
                            onClick={() => handlePackageQuantityChange(pkg, 1)}
                            className="bg-[#E62E00] hover:bg-[#C92200] text-white px-4 py-2 rounded-xl font-titan text-xs flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#FFC700]" />
                            <span>Add to Cart</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-[#E62E00]/40 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handlePackageQuantityChange(pkg, cartQty - 1)}
                              className="w-6 h-6 rounded bg-[#FAF7F2] hover:bg-[#E5DEC9] flex items-center justify-center text-xs font-bold text-[#4D080F]"
                              aria-label={`Decrease quantity of ${pkg.name}`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={500}
                              value={cartQty}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                handlePackageQuantityChange(pkg, Number.isNaN(parsed) ? 0 : parsed);
                              }}
                              className="w-10 text-center font-titan text-xs text-[#241311] bg-transparent focus:outline-none"
                              aria-label={`Quantity for ${pkg.name}`}
                            />
                            <button
                              type="button"
                              onClick={() => handlePackageQuantityChange(pkg, cartQty + 1)}
                              className="w-6 h-6 rounded bg-[#E62E00] hover:bg-[#C92200] flex items-center justify-center text-xs font-bold text-white"
                              aria-label={`Increase quantity of ${pkg.name}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={handleBrowseSmallChopsCategory}
                  className="text-xs font-montserrat font-bold text-[#E62E00] hover:underline inline-flex items-center gap-1"
                >
                  <span>Or browse the full Small Chops category on the menu page</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: Custom Assortment of Approved Single Items */}
          {activeMode === 'custom' && (
            <div className="space-y-4">
              <div className="bg-[#FFF8E7] p-3.5 rounded-2xl border border-[#FFC700] text-xs font-montserrat text-[#4D080F] flex items-center justify-between">
                <div>
                  <span className="font-bold block">Approved Item Assortment Builder</span>
                  <span className="text-[#7A6A65]">
                    Pick exact quantities of approved snacks and small chops to create your custom box.
                  </span>
                </div>
                <span className="font-titan text-sm text-[#E62E00] bg-white px-3 py-1 rounded-xl border border-[#E5DEC9] shrink-0">
                  {customTotalCount} pcs
                </span>
              </div>

              {/* Single Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto pr-1">
                {APPROVED_SINGLE_ITEMS.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#E5DEC9] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl shrink-0">{item.emoji}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-titan text-xs text-[#241311]">{item.name}</p>
                          <span className="text-[10px] font-titan text-[#E62E00]">
                            {formatNaira(item.unitPrice)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#7A6A65] font-montserrat line-clamp-1">{item.desc}</p>
                      </div>
                    </div>

                    {/* Counter with Direct Numeric Input */}
                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-[#E5DEC9] shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDecrement(item.id)}
                        className="w-6 h-6 rounded-lg bg-[#FAF7F2] hover:bg-[#E5DEC9] flex items-center justify-center text-xs font-bold text-[#4D080F]"
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={itemCounts[item.id] ?? 0}
                        onChange={(e) => handleDirectPieceInput(item.id, e.target.value)}
                        className="font-titan text-xs w-12 text-center text-[#241311] bg-transparent border border-transparent focus:border-[#E62E00] rounded px-1 focus:outline-none"
                        aria-label={`Direct quantity for ${item.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleIncrement(item.id)}
                        className="w-6 h-6 rounded-lg bg-[#E62E00] hover:bg-[#C92200] flex items-center justify-center text-xs font-bold text-white"
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Total & CTA */}
              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-[#7A6A65] font-montserrat uppercase font-bold block">
                    TOTAL ASSORTED PRICE ({customTotalCount} PIECES)
                  </span>
                  <span className="font-titan text-2xl text-[#E62E00]">
                    {formatNaira(customTotalPrice)}
                  </span>
                </div>

                <button
                  onClick={handleAddCustomAssortmentToCart}
                  disabled={customTotalCount === 0}
                  className="bg-[#E62E00] hover:bg-[#C92200] disabled:bg-gray-300 text-white font-titan text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-md transition-transform active:scale-95 flex items-center gap-2"
                  id="add-custom-assortment-btn"
                >
                  <ShoppingBag className="w-4 h-4 text-[#FFC700]" />
                  <span>ADD CUSTOM BOX TO CART</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
