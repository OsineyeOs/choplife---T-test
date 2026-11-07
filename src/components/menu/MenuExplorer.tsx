import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MENU_CATEGORIES } from '../../data/menu';
import { Product } from '../../types';
import { ProductQuantityStepper } from '../common/ProductQuantityStepper';
import {
  Search,
  Flame,
  Clock,
  Plus,
  Sparkles,
  Box,
  Heart,
  X,
  ArrowUpDown,
  Check,
  ShoppingBag,
  RotateCcw,
} from 'lucide-react';

type SortOption = 'popular' | 'price-asc' | 'price-desc' | 'prep-time' | 'name-asc';

const QUICK_SEARCH_TERMS = [
  'Jollof Rice',
  'Shawarma',
  'Small Chops',
  'Special Bread',
  'Chicken',
  'Suya',
  'Zobo',
];

const INITIAL_PAGE_SIZE = 12;

export function matchesCategoryFilter(
  product: Product,
  categoryId: string,
  shortlistedProductIds: string[]
): boolean {
  if (categoryId === 'all') return true;
  if (categoryId === 'shortlist') return shortlistedProductIds.includes(product.id);
  if (categoryId === 'favourites') return Boolean(product.isPopular || product.isFeatured);
  if (categoryId === 'deals') {
    return Boolean(
      product.category === 'deals' ||
        product.isFeatured ||
        product.subcategory?.toLowerCase().includes('pack') ||
        product.name.toLowerCase().includes('pack') ||
        product.name.toLowerCase().includes('combo') ||
        product.name.toLowerCase().includes('order')
    );
  }
  if (categoryId === 'bakery') return product.category === 'bakery';
  if (categoryId === 'food') {
    return (
      product.category === 'food' ||
      product.category === 'rice-meals' ||
      product.category === 'soups-swallows' ||
      product.category === 'qsr'
    );
  }
  if (categoryId === 'protein') {
    return (
      product.category === 'protein' ||
      product.category === 'grills' ||
      product.category === 'meat'
    );
  }
  if (categoryId === 'snacks') {
    return (
      product.category === 'snacks' ||
      product.category === 'shawarma' ||
      product.category === 'pastries'
    );
  }
  if (categoryId === 'drinks') {
    return (
      product.category === 'drinks' ||
      product.category === 'beverages' ||
      product.category === 'desserts'
    );
  }
  return product.category === categoryId;
}

export function matchesProductSearchQuery(product: Product, rawQuery: string): boolean {
  const normalized = (rawQuery || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return true;

  const tokens = normalized.split(' ');

  const categoryAliases: Record<string, string> = {
    bakery: 'bread loaf loaves bromate free bakery',
    'small-chops': 'small chops platter samosa spring roll puff puff party box munch',
    snacks: 'shawarma pie sausage roll doughnut pastry snack chips',
    drinks: 'drink drinks beverage water juice zobo parfait yoghurt soda mineral soft drink',
    protein: 'protein proteins meat chicken turkey fish beef gizzard suya',
    food: 'food meal rice jollof fried village soup swallow yam beans plantain spaghetti',
    packaging: 'pack takeaway box bag foil container',
    events: 'event paint sip session reservation lounge',
  };

  const optionKeywords = (product.optionGroups || [])
    .flatMap((g) => [g.name, ...g.choices.map((c) => c.name)])
    .join(' ');

  const searchableText = [
    product.name || '',
    product.shortDescription || '',
    product.longDescription || '',
    product.category || '',
    product.subcategory || '',
    categoryAliases[product.category] || '',
    optionKeywords,
  ]
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => searchableText.includes(token));
}

export const MenuExplorer: React.FC = () => {
  const {
    products,
    getProductPrice,
    isProductAvailable,
    selectedBranchId,
    currentBranch,
    setSelectedProductForDetail,
    setIsSmallChopsBuilderOpen,
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    formatNaira,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    activeDietaryFilter,
    setActiveDietaryFilter,
    setSelectedBranchId,
    shortlistedProductIds,
    toggleShortlist,
    isProductShortlisted,
    clearShortlist,
  } = useApp();

  const [sortOption, setSortOption] = useState<SortOption>('popular');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_PAGE_SIZE);
  const [shortlistFeedback, setShortlistFeedback] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);

  // Reset pagination count when category, search, or sort changes
  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, [activeCategory, searchQuery, activeDietaryFilter, sortOption, onlyAvailable]);

  const normalizedQuery = searchQuery.trim().replace(/\s+/g, ' ');
  const isSearching = normalizedQuery.length > 0;

  // All matches across the entire catalogue for the current search + dietary/availability filters
  const allCategoriesSearchMatches = useMemo(() => {
    if (!isSearching) return [];
    return products.filter((product) => {
      if ((product.status && product.status !== 'published') || (product as any).isActive === false) return false;
      if (!matchesProductSearchQuery(product, normalizedQuery)) return false;
      if (activeDietaryFilter === 'spicy' && !product.isSpicy) return false;
      if (activeDietaryFilter === 'veg' && !product.isVegetarian) return false;
      if (onlyAvailable && !isProductAvailable(product.id, selectedBranchId)) return false;
      return true;
    });
  }, [products, isSearching, normalizedQuery, activeDietaryFilter, onlyAvailable, selectedBranchId]);

  // Filter and sort products based on search query, category, shortlist, dietary, availability, and sort option
  const filteredProducts = useMemo(() => {
    const matched = products.filter((product) => {
      if ((product.status && product.status !== 'published') || (product as any).isActive === false) return false;
      // 1. Search Query filter
      if (isSearching) {
        if (!matchesProductSearchQuery(product, normalizedQuery)) {
          return false;
        }
        // When searching, if the user is on the default 'favourites' or 'all' tab, search across the entire menu
        // If the user explicitly selected a specific category (e.g. 'bakery', 'drinks', 'shortlist'), combine search + category
        if (activeCategory !== 'favourites' && activeCategory !== 'all') {
          if (!matchesCategoryFilter(product, activeCategory, shortlistedProductIds)) {
            return false;
          }
        }
      } else {
        // 2. Category / Shortlist filter (when not searching)
        if (!matchesCategoryFilter(product, activeCategory, shortlistedProductIds)) {
          return false;
        }
      }

      // 3. Dietary filter
      if (activeDietaryFilter === 'spicy' && !product.isSpicy) return false;
      if (activeDietaryFilter === 'veg' && !product.isVegetarian) return false;

      // 4. Availability filter
      if (onlyAvailable && !isProductAvailable(product.id, selectedBranchId)) return false;

      return true;
    });

    // 5. Sort matched products
    return [...matched].sort((a, b) => {
      if (sortOption === 'price-asc') {
        return getProductPrice(a, selectedBranchId) - getProductPrice(b, selectedBranchId);
      }
      if (sortOption === 'price-desc') {
        return getProductPrice(b, selectedBranchId) - getProductPrice(a, selectedBranchId);
      }
      if (sortOption === 'prep-time') {
        return (a.prepTimeMinutes || 15) - (b.prepTimeMinutes || 15);
      }
      if (sortOption === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      // Default 'popular': featured/popular first, then available first
      const aPop = (a.isFeatured ? 2 : 0) + (a.isPopular ? 1 : 0);
      const bPop = (b.isFeatured ? 2 : 0) + (b.isPopular ? 1 : 0);
      if (bPop !== aPop) return bPop - aPop;
      return 0;
    });
  }, [
    products,
    isSearching,
    normalizedQuery,
    activeCategory,
    shortlistedProductIds,
    activeDietaryFilter,
    onlyAvailable,
    sortOption,
    selectedBranchId,
  ]);

  // Progressive display: show all results immediately when searching or viewing shortlist; paginate large lists when browsing
  const displayedProducts = useMemo(() => {
    if (isSearching || activeCategory === 'shortlist') {
      return filteredProducts;
    }
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, isSearching, activeCategory, visibleCount]);

  const hasMoreProducts = !isSearching && activeCategory !== 'shortlist' && filteredProducts.length > visibleCount;

  const activeCategoryObj = MENU_CATEGORIES.find((c) => c.id === activeCategory);

  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});

  const getCartInfoForProduct = (productId: string) => {
    const matching = cart.filter((item) => item.productId === productId);
    const cartQty = matching.reduce((sum, item) => sum + item.quantity, 0);
    const primaryCartItem = matching[0] || null;
    return { cartQty, primaryCartItem };
  };

  const getCardQuantity = (productId: string) => {
    const { cartQty } = getCartInfoForProduct(productId);
    if (cartQty > 0) return cartQty;
    const val = cardQuantities[productId];
    return typeof val === 'number' && val >= 1 ? val : 1;
  };

  const handleCardQtyChange = (productId: string, nextQty: number) => {
    const { cartQty, primaryCartItem } = getCartInfoForProduct(productId);
    if (cartQty > 0 && primaryCartItem) {
      if (nextQty <= 0) {
        removeFromCart(primaryCartItem.id);
      } else {
        const clamped = Math.min(500, Number.isNaN(nextQty) ? 1 : nextQty);
        updateCartQuantity(primaryCartItem.id, clamped);
      }
      return;
    }
    const clamped = Math.max(1, Math.min(500, Number.isNaN(nextQty) ? 1 : nextQty));
    setCardQuantities((prev) => ({ ...prev, [productId]: clamped }));
  };

  const isConfigurableProduct = (product: Product) =>
    product.id === 'prod-sc-box-custom' ||
    (Array.isArray(product.optionGroups) && product.optionGroups.length > 0);

  const getProductActionButtonLabel = (product: Product) => {
    if (product.id === 'prod-sc-box-custom') return 'Build Your Box';
    if (Array.isArray(product.optionGroups) && product.optionGroups.length > 0) {
      return 'Choose Options';
    }
    const { cartQty } = getCartInfoForProduct(product.id);
    if (cartQty > 0) {
      return `In Cart (${cartQty})`;
    }
    return 'Add to Cart';
  };

  const handleProductCardClick = (product: Product) => {
    if (product.id === 'prod-sc-box-custom') {
      setIsSmallChopsBuilderOpen(true);
    } else {
      setSelectedProductForDetail(product);
    }
  };

  const handleQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (product.id === 'prod-sc-box-custom') {
      setIsSmallChopsBuilderOpen(true);
    } else if (Array.isArray(product.optionGroups) && product.optionGroups.length > 0) {
      setSelectedProductForDetail(product);
    } else {
      const { cartQty, primaryCartItem } = getCartInfoForProduct(product.id);
      if (cartQty > 0 && primaryCartItem) {
        updateCartQuantity(primaryCartItem.id, cartQty + 1);
      } else {
        const qty = getCardQuantity(product.id);
        addToCart(product, qty);
        setCardQuantities((prev) => ({ ...prev, [product.id]: 1 }));
      }
    }
  };

  const handleAddAllShortlistedToCart = () => {
    const addedNames: string[] = [];
    const unavailableNames: string[] = [];
    const configurableOnlyNames: string[] = [];
    const staleIds: string[] = [];

    for (const id of shortlistedProductIds) {
      const p = products.find((prod) => prod.id === id);
      if (!p) {
        staleIds.push(id);
        continue;
      }
      if (!isProductAvailable(p.id, selectedBranchId)) {
        unavailableNames.push(p.name);
        continue;
      }
      if (p.id === 'prod-sc-box-custom' || getProductPrice(p, selectedBranchId) <= 0) {
        configurableOnlyNames.push(p.name);
        continue;
      }
      if (
        p.optionGroups &&
        p.optionGroups.some((g) => g.required && !g.choices.some((c) => c.isDefault))
      ) {
        configurableOnlyNames.push(p.name);
        continue;
      }
      addToCart(p, 1);
      addedNames.push(p.name);
    }

    const skippedNotes: string[] = [];
    if (unavailableNames.length > 0) {
      skippedNotes.push(`Sold out at ${currentBranch.name}: ${unavailableNames.join(', ')}`);
    }
    if (configurableOnlyNames.length > 0) {
      skippedNotes.push(`Requires custom option selection: ${configurableOnlyNames.join(', ')}`);
    }
    if (staleIds.length > 0) {
      skippedNotes.push(`${staleIds.length} removed/unavailable item ID(s) skipped`);
    }

    if (addedNames.length > 0 && skippedNotes.length === 0) {
      setShortlistFeedback({
        type: 'success',
        message: `Added ${addedNames.length} shortlisted ${addedNames.length === 1 ? 'item' : 'items'} to your cart at ${currentBranch.name} prices.`,
      });
    } else if (addedNames.length > 0 && skippedNotes.length > 0) {
      setShortlistFeedback({
        type: 'warning',
        message: `Added ${addedNames.length} ${addedNames.length === 1 ? 'item' : 'items'} to cart. Skipped — ${skippedNotes.join(' • ')}.`,
      });
    } else {
      setShortlistFeedback({
        type: 'warning',
        message: `No items could be added directly. ${skippedNotes.join(' • ') || 'Your shortlist has no eligible items.'}`,
      });
    }
  };

  const hasActiveFilters =
    isSearching ||
    activeDietaryFilter !== 'all' ||
    onlyAvailable ||
    sortOption !== 'popular' ||
    (activeCategory !== 'favourites' && activeCategory !== 'all');

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setActiveCategory('favourites');
    setActiveDietaryFilter('all');
    setOnlyAvailable(false);
    setSortOption('popular');
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 scroll-mt-24 sm:scroll-mt-28" id="menu-section" data-section="menu-explorer-section">
      {/* Category Section Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 pb-5 border-b border-[#F0EAE1]">
        <div>
          <span className="text-xs font-titan uppercase tracking-widest text-[#E62E00] flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
            FRESH FROM OUR BENIN CITY KITCHENS
          </span>
          <h2 className="font-titan text-2xl sm:text-4xl text-[#4D080F] tracking-tight">
            {isSearching
              ? `Search Results for “${normalizedQuery}”`
              : activeCategory === 'shortlist'
              ? `My Saved Shortlist (${shortlistedProductIds.length})`
              : activeCategory === 'all'
              ? `Complete Master Menu (${products.length})`
              : activeCategoryObj?.name || 'Full Menu'}
          </h2>
          <p className="text-xs sm:text-sm text-[#7A6A65] font-montserrat mt-0.5">
            {isSearching
              ? `Found ${filteredProducts.length} ${filteredProducts.length === 1 ? 'dish' : 'dishes'} matching your search at ${currentBranch.name}.`
              : activeCategory === 'shortlist'
              ? 'Bookmark your favourite dishes with the heart icon to compare prices, prep times, and order faster.'
              : activeCategoryObj?.description || `Showing freshly prepared dishes for ${currentBranch.name}.`}
          </p>
        </div>

        {/* Shortlist Quick Counter & Dietary Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {/* Shortlist Shortcut Button */}
          <button
            type="button"
            onClick={() => setActiveCategory(activeCategory === 'shortlist' ? 'favourites' : 'shortlist')}
            className={`px-3 py-1.5 rounded-full text-xs font-montserrat font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
              activeCategory === 'shortlist'
                ? 'bg-[#E62E00] text-white border-[#E62E00] shadow-xs'
                : shortlistedProductIds.length > 0
                ? 'bg-[#FFF8E7] text-[#4D080F] border-[#FFC700] hover:bg-[#FFEEC2]'
                : 'bg-white text-[#5C4D49] border-[#E5DEC9] hover:bg-[#FAF7F2]'
            }`}
            id="menu-shortlist-filter-btn"
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                activeCategory === 'shortlist'
                  ? 'text-white fill-white'
                  : shortlistedProductIds.length > 0
                  ? 'text-[#E62E00] fill-[#E62E00]'
                  : 'text-[#E62E00]'
              }`}
            />
            <span>Shortlist ({shortlistedProductIds.length})</span>
          </button>

          {[
            { id: 'all', label: 'All Items' },
            { id: 'spicy', label: '🔥 Spicy' },
            { id: 'veg', label: '🌱 Veg / Sides' },
          ].map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveDietaryFilter(filter.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-montserrat font-bold whitespace-nowrap transition-all border ${
                activeDietaryFilter === filter.id
                  ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F] shadow-2xs'
                  : 'bg-white text-[#5C4D49] border-[#E5DEC9] hover:bg-[#FAF7F2]'
              }`}
              id={`diet-filter-${filter.id}`}
            >
              {filter.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setOnlyAvailable(!onlyAvailable)}
            className={`px-3 py-1.5 rounded-full text-xs font-montserrat font-bold whitespace-nowrap transition-all border flex items-center gap-1 ${
              onlyAvailable
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                : 'bg-white text-[#5C4D49] border-[#E5DEC9] hover:bg-[#FAF7F2]'
            }`}
            id="filter-available-only-btn"
          >
            {onlyAvailable && <Check className="w-3 h-3" />}
            <span>In Stock Only</span>
          </button>
        </div>
      </div>

      {/* Prominent In-Catalogue Search & Sort Bar */}
      <div className="mt-5 bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E5DEC9] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#E62E00] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food, bread, small chops, shawarma, jollof, drinks..."
              className="w-full pl-10 pr-24 py-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs sm:text-sm font-montserrat text-[#241311] placeholder:text-[#8E7E7A] focus:outline-none focus:ring-2 focus:ring-[#E62E00] focus:bg-white transition-all"
              id="menu-search-input"
              aria-label="Search menu items"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-[#E5DEC9]/60 hover:bg-[#E5DEC9] text-[#4D080F] text-[11px] font-montserrat font-bold flex items-center gap-1 transition-colors"
                id="menu-search-clear-btn"
                aria-label="Clear search query"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex-1 sm:flex-initial">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#7A6A65] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full sm:w-auto pl-8 pr-7 py-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs font-montserrat font-bold text-[#4D080F] focus:outline-none focus:ring-2 focus:ring-[#E62E00] cursor-pointer"
                id="menu-sort-select"
                aria-label="Sort menu items"
              >
                <option value="popular">Sort: Popular & Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="prep-time">Fastest Prep Time</option>
                <option value="name-asc">Name: A to Z</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="px-3 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#E5DEC9] text-xs font-montserrat font-bold text-[#E62E00] flex items-center gap-1 shrink-0 transition-colors"
                id="menu-reset-filters-btn"
                title="Reset all search & filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Search Chips or Active Search Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {!isSearching ? (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[11px] font-montserrat font-bold text-[#7A6A65] shrink-0">
                Quick find:
              </span>
              {QUICK_SEARCH_TERMS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setSearchQuery(term)}
                  className="text-[11px] font-montserrat font-semibold px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#FFF8E7] text-[#4D080F] border border-[#E5DEC9] hover:border-[#FFC700] transition-colors whitespace-nowrap"
                  id={`quick-search-chip-${term.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {term}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs font-montserrat text-[#5C4D49]">
              <span id="menu-results-count" className="font-bold text-[#4D080F]">
                Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'} for “{normalizedQuery}”
                {activeCategory !== 'favourites' && activeCategory !== 'all'
                  ? ` in ${activeCategory === 'shortlist' ? 'Shortlist' : activeCategoryObj?.name || activeCategory}`
                  : ' across entire menu'}
              </span>
              {activeCategory !== 'favourites' &&
                activeCategory !== 'all' &&
                allCategoriesSearchMatches.length > filteredProducts.length && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory('all')}
                    className="text-xs font-titan text-[#E62E00] underline hover:text-[#C92200]"
                    id="search-all-categories-btn"
                  >
                    Show all {allCategoriesSearchMatches.length} matches across entire menu →
                  </button>
                )}
            </div>
          )}

          <span className="text-[11px] font-montserrat font-semibold text-[#7A6A65] ml-auto">
            {displayedProducts.length} of {filteredProducts.length} items shown
          </span>
        </div>
      </div>

      {/* Horizontally Scrollable Category Bar */}
      <div className="py-4 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sticky top-16 sm:top-20 z-30 bg-[#FAF7F2]/95 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-max">
          {/* All Menu Pill */}
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-montserrat font-bold transition-all shadow-2xs ${
              activeCategory === 'all'
                ? 'bg-[#E62E00] text-white shadow-md scale-102 ring-2 ring-[#E62E00]/20'
                : 'bg-white text-[#4D080F] border border-[#E5DEC9] hover:bg-[#F2ECE1] hover:border-[#D62828]/40'
            }`}
            id="cat-btn-all"
          >
            <span className="text-base">🍽️</span>
            <span>All Menu</span>
            <span
              className={`text-[9px] font-titan px-1.5 py-0.5 rounded-md ${
                activeCategory === 'all' ? 'bg-[#FFC700] text-[#4D080F]' : 'bg-[#FAF7F2] text-[#7A6A65]'
              }`}
            >
              {products.length}
            </span>
          </button>

          {/* Shortlist / Saved Pill */}
          <button
            type="button"
            onClick={() => setActiveCategory('shortlist')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-montserrat font-bold transition-all shadow-2xs ${
              activeCategory === 'shortlist'
                ? 'bg-[#E62E00] text-white shadow-md scale-102 ring-2 ring-[#E62E00]/20'
                : shortlistedProductIds.length > 0
                ? 'bg-[#FFF8E7] text-[#4D080F] border border-[#FFC700] hover:bg-[#FFEEC2]'
                : 'bg-white text-[#4D080F] border border-[#E5DEC9] hover:bg-[#F2ECE1]'
            }`}
            id="cat-btn-shortlist"
          >
            <Heart
              className={`w-4 h-4 ${
                activeCategory === 'shortlist'
                  ? 'text-[#FFC700] fill-[#FFC700]'
                  : shortlistedProductIds.length > 0
                  ? 'text-[#E62E00] fill-[#E62E00]'
                  : 'text-[#E62E00]'
              }`}
            />
            <span>Saved Shortlist</span>
            <span
              className={`text-[9px] font-titan px-1.5 py-0.5 rounded-md ${
                activeCategory === 'shortlist'
                  ? 'bg-[#FFC700] text-[#4D080F]'
                  : 'bg-[#E62E00] text-white'
              }`}
              id="shortlist-count-badge"
            >
              {shortlistedProductIds.length}
            </span>
          </button>

          {MENU_CATEGORIES.map((category) => {
            const isActive = activeCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setActiveCategory(category.id);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-montserrat font-bold transition-all shadow-2xs ${
                  isActive
                    ? 'bg-[#E62E00] text-white shadow-md scale-102 ring-2 ring-[#E62E00]/20'
                    : 'bg-white text-[#4D080F] border border-[#E5DEC9] hover:bg-[#F2ECE1] hover:border-[#D62828]/40'
                }`}
                id={`cat-btn-${category.id}`}
              >
                <span className="text-base">{category.icon}</span>
                <span>{category.name}</span>
                {category.badge && (
                  <span
                    className={`text-[9px] font-titan px-1.5 py-0.5 rounded-md uppercase ${
                      isActive ? 'bg-[#FFC700] text-[#4D080F]' : 'bg-[#FFF8E7] text-[#E62E00]'
                    }`}
                  >
                    {category.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shortlist Comparison Banner when viewing Shortlist */}
      {activeCategory === 'shortlist' && shortlistedProductIds.length > 0 && (
        <div
          className="my-4 bg-[#FFF8E7] border-2 border-[#FFC700] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
          id="shortlist-management-bar"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E62E00] text-white flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-titan text-sm sm:text-base text-[#4D080F]">
                Your Shortlisted Products ({shortlistedProductIds.length})
              </h3>
              <p className="text-xs text-[#5C4D49] font-montserrat">
                Compare prices and preparation times below, or add available items directly to your order cart.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleAddAllShortlistedToCart}
              className="flex-1 sm:flex-initial bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95"
              id="add-all-shortlisted-btn"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>ADD ALL TO CART</span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearShortlist();
                setShortlistFeedback(null);
              }}
              className="px-3 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-[#7A6A65] hover:text-rose-700 border border-[#E5DEC9] text-xs font-montserrat font-bold transition-colors"
              id="clear-shortlist-btn"
            >
              Clear List
            </button>
          </div>
        </div>
      )}

      {shortlistFeedback && activeCategory === 'shortlist' && (
        <div
          className={`my-3 rounded-2xl px-4 py-3 border flex items-center justify-between gap-3 text-xs font-montserrat font-semibold ${
            shortlistFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
          id="shortlist-action-feedback"
        >
          <span>{shortlistFeedback.message}</span>
          <button
            type="button"
            onClick={() => setShortlistFeedback(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100"
            id="dismiss-shortlist-feedback-btn"
          >
            ✕
          </button>
        </div>
      )}

      {/* Non-intrusive Shortlist Helper Strip when user has shortlisted items while browsing other tabs */}
      {activeCategory !== 'shortlist' && shortlistedProductIds.length > 0 && (
        <div
          className="my-3 bg-[#FFF8E7]/90 border border-[#FFC700] rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-montserrat"
          id="shortlist-floating-strip"
        >
          <div className="flex items-center gap-2 text-[#4D080F] font-semibold">
            <Heart className="w-4 h-4 text-[#E62E00] fill-[#E62E00] shrink-0" />
            <span>
              You have <strong>{shortlistedProductIds.length}</strong> shortlisted{' '}
              {shortlistedProductIds.length === 1 ? 'product' : 'products'} saved for comparison.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveCategory('shortlist')}
              className="font-titan text-[#E62E00] underline hover:text-[#C92200]"
              id="view-shortlist-strip-btn"
            >
              View Shortlist ({shortlistedProductIds.length}) →
            </button>
          </div>
        </div>
      )}

      {/* Interactive Small Chops Callout Banner inside Menu if viewing small chops */}
      {activeCategory === 'small-chops' && !isSearching && (
        <div className="my-5 bg-[#FFF8E7] border-2 border-[#FFC700] rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E62E00] text-[#FFC700] flex items-center justify-center font-titan text-2xl shrink-0">
              🥟
            </div>
            <div>
              <h3 className="font-titan text-base sm:text-lg text-[#4D080F]">
                Want to build your own custom Small Chops Box?
              </h3>
              <p className="text-xs text-[#7A6A65] font-montserrat">
                Choose your exact counts of samosas, spring rolls, puff puff, and spicy proteins.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSmallChopsBuilderOpen(true)}
            className="w-full sm:w-auto bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 shrink-0"
            id="menu-launch-box-builder-btn"
          >
            <Box className="w-4 h-4 text-[#FFC700]" />
            BUILD BOX NOW
          </button>
        </div>
      )}

      {/* Interactive Bakery Callout Banner when viewing bakery */}
      {activeCategory === 'bakery' && !isSearching && (
        <div className="my-5 bg-gradient-to-r from-[#FAF4EB] via-[#FFFDF9] to-[#FAF4EB] border-2 border-amber-300 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#4D080F] text-[#FFC700] flex items-center justify-center font-titan text-2xl shrink-0">
              🍞
            </div>
            <div>
              <h3 className="font-titan text-base sm:text-lg text-[#4D080F]">
                100% Bromate-Free Choplife Special Bread
              </h3>
              <p className="text-xs text-[#7A6A65] font-montserrat">
                Baked daily with whole eggs and full cream milk. Single loaves (350g, 600g, 800g, 1.2kg) and wholesale crates for stores.
              </p>
            </div>
          </div>
          <div className="bg-[#4D080F] text-[#FFC700] font-titan text-xs px-4 py-2.5 rounded-xl shadow-xs shrink-0">
            Fresh Batches Daily
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-14 bg-white rounded-3xl border border-[#E5DEC9] p-8 space-y-4 my-6" id="menu-empty-state">
          <div className="w-16 h-16 rounded-full bg-[#FAF7F2] text-[#4D080F] flex items-center justify-center font-titan text-2xl mx-auto">
            {normalizedQuery.toLowerCase().includes('cocktail') || normalizedQuery.toLowerCase().includes('mocktail')
              ? '🥤'
              : activeCategory === 'shortlist'
              ? '❤️'
              : '🔍'}
          </div>
          {normalizedQuery.toLowerCase().includes('cocktail') || normalizedQuery.toLowerCase().includes('mocktail') ? (
            <>
              <h3 className="font-titan text-xl text-[#4D080F]">
                We don&apos;t currently have cocktails or mocktails on our menu.
              </h3>
              <p className="text-xs text-[#7A6A65] font-montserrat max-w-md mx-auto">
                Explore our selection of chilled juices, zobo punch, tiger nut, malt, cold soft drinks, and ice creams.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('drinks');
                }}
                className="bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs px-6 py-3 rounded-xl shadow-md transition-transform active:scale-95"
                id="search-view-drinks-cta"
              >
                EXPLORE COLD DRINKS
              </button>
            </>
          ) : activeCategory === 'shortlist' && !isSearching ? (
            <>
              <h3 className="font-titan text-xl text-[#4D080F]">Your Shortlist is Empty</h3>
              <p className="text-xs text-[#7A6A65] font-montserrat max-w-md mx-auto">
                Tap the heart (❤️) icon on any dish while browsing the menu to save and compare your favourite items here.
              </p>
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className="bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs px-6 py-3 rounded-xl shadow-sm"
                id="browse-menu-from-empty-shortlist-btn"
              >
                BROWSE ALL MENU ITEMS
              </button>
            </>
          ) : (
            <>
              <h3 className="font-titan text-xl text-[#4D080F]">
                {isSearching
                  ? `No menu items found for “${normalizedQuery}”`
                  : 'No menu items match the selected filter'}
              </h3>
              <p className="text-xs text-[#7A6A65] font-montserrat max-w-sm mx-auto">
                {isSearching && allCategoriesSearchMatches.length > 0
                  ? `We found ${allCategoriesSearchMatches.length} matching item(s) in other categories.`
                  : isSearching
                  ? 'Try searching for “shawarma”, “small chops”, “jollof”, “bread”, “zobo”, or reset your filters.'
                  : 'Try switching categories or clearing dietary filters to view available items.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                {isSearching && allCategoriesSearchMatches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory('all')}
                    className="bg-[#4D080F] hover:bg-[#38050A] text-[#FFC700] font-titan text-xs px-5 py-2.5 rounded-xl shadow-sm"
                    id="empty-state-search-all-categories-btn"
                  >
                    SHOW {allCategoriesSearchMatches.length} MATCHES IN ALL CATEGORIES
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs px-5 py-2.5 rounded-xl shadow-sm"
                  id="reset-menu-filters-btn"
                >
                  RESET MENU FILTERS
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {displayedProducts.map((product) => {
          const price = getProductPrice(product, selectedBranchId);
          const isAvailable = isProductAvailable(product.id, selectedBranchId);
          const isShortlisted = isProductShortlisted(product.id);
          const { cartQty } = getCartInfoForProduct(product.id);

          return (
            <div
              key={product.id}
              onClick={() => handleProductCardClick(product)}
              className={`bg-white rounded-3xl overflow-hidden border transition-all cursor-pointer flex flex-col justify-between group hover:-translate-y-1 ${
                isAvailable
                  ? 'border-[#E5DEC9] shadow-sm hover:shadow-xl hover:border-[#D62828]/50'
                  : 'border-gray-200 bg-gray-50/70 opacity-90'
              }`}
              id={`menu-item-${product.id}`}
            >
              {/* Product Thumbnail */}
              <div className="relative h-48 sm:h-52 overflow-hidden bg-[#FAF7F2]">
                <img
                  src={product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                  alt={product.name}
                  loading="lazy"
                  className={`w-full h-full object-cover transition-transform duration-300 ${
                    isAvailable ? 'group-hover:scale-105' : 'grayscale-40'
                  }`}
                />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pr-10">
                  {product.isFeatured && (
                    <span className="bg-[#FFC700] text-[#4D080F] px-2.5 py-0.5 rounded-full font-titan text-[10px] uppercase shadow-xs">
                      Popular
                    </span>
                  )}
                  {product.isSpicy && (
                    <span className="bg-[#E62E00] text-white px-2 py-0.5 rounded-full font-titan text-[10px] uppercase shadow-xs flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5 text-[#FFC700]" /> Hot
                    </span>
                  )}
                </div>

                {/* Shortlist / Favourite Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleShortlist(product.id);
                  }}
                  aria-label={isShortlisted ? `Remove ${product.name} from shortlist` : `Add ${product.name} to shortlist`}
                  title={isShortlisted ? 'Remove from Shortlist' : 'Save to Shortlist'}
                  className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${
                    isShortlisted
                      ? 'bg-[#E62E00] text-white scale-105'
                      : 'bg-white/90 hover:bg-white text-[#4D080F] hover:text-[#E62E00]'
                  }`}
                  id={`shortlist-btn-${product.id}`}
                >
                  <Heart className={`w-4 h-4 ${isShortlisted ? 'fill-current' : ''}`} />
                </button>

                {/* Out of stock overlay */}
                {!isAvailable && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-center">
                    <span className="bg-[#4D080F] text-[#FFC700] font-titan text-xs px-3 py-1.5 rounded-xl border border-[#FFC700]/30 shadow-lg mb-2">
                      SOLD OUT AT {currentBranch.shortName.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const otherBranch = selectedBranchId === 'gra' ? 'ugbowo' : 'gra';
                        setSelectedBranchId(otherBranch);
                      }}
                      className="text-[10px] font-montserrat font-bold text-white bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors underline"
                    >
                      Check other branch →
                    </button>
                  </div>
                )}

                <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[10px] font-montserrat flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#FFC700]" />
                  ~{product.prepTimeMinutes}m
                </div>
              </div>

              {/* Product Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-titan text-base sm:text-lg text-[#4D080F] group-hover:text-[#E62E00] transition-colors leading-snug">
                    {product.name}
                  </h3>
                  {Array.isArray((product as any).components) && (product as any).components.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(product as any).components.slice(0, 4).map((comp: any, idx: number) => (
                        <span
                          key={idx}
                          className="text-[10px] font-montserrat font-semibold bg-[#FAF7F2] text-[#4D080F] px-2 py-0.5 rounded-md border border-[#E5DEC9]"
                        >
                          {comp.quantity}x {comp.productName || comp.name || comp.productId}
                        </span>
                      ))}
                      {(product as any).components.length > 4 && (
                        <span className="text-[10px] font-montserrat font-bold text-[#800D15] px-1.5 py-0.5">
                          +{(product as any).components.length - 4} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5C4D49] font-montserrat mt-1 line-clamp-2">
                      {product.shortDescription}
                    </p>
                  )}
                </div>

                {/* Bottom Bar: Price, Direct Quantity Input & Action */}
                <div className="pt-3 border-t border-[#F0EAE1] flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-[#7A6A65] font-montserrat font-bold block uppercase">
                      PRICE
                    </span>
                    <span className="font-titan text-lg sm:text-xl text-[#E62E00]">
                      {formatNaira(price * (isConfigurableProduct(product) || cartQty === 0 ? 1 : cartQty))}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!isConfigurableProduct(product) && isAvailable && cartQty > 0 ? (
                      <ProductQuantityStepper
                        quantity={cartQty}
                        onQuantityChange={(next) => handleCardQtyChange(product.id, next)}
                        min={0}
                        max={500}
                        size="md"
                        idPrefix={`menu-qty-${product.id}`}
                        ariaLabel={`quantity for ${product.name}`}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleQuickAdd(e, product)}
                        disabled={!isAvailable}
                        className={`p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl font-titan text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 ${
                          cartQty > 0
                            ? 'bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] border border-[#FFC700]/30'
                            : 'bg-[#E62E00] hover:bg-[#C92200] disabled:bg-gray-300 text-white'
                        }`}
                        id={`menu-add-${product.id}`}
                      >
                        <Plus className={`w-4 h-4 ${cartQty > 0 ? 'text-[#FFC700]' : 'text-white'}`} />
                        <span>{getProductActionButtonLabel(product)}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progressive Load More Controls (Prevents Single-Page Visual Cramming) */}
      {hasMoreProducts && (
        <div className="mt-8 text-center space-y-2" id="menu-pagination-controls">
          <p className="text-xs font-montserrat text-[#7A6A65]">
            Showing <strong>{displayedProducts.length}</strong> of <strong>{filteredProducts.length}</strong> dishes
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + INITIAL_PAGE_SIZE)}
              className="bg-white hover:bg-[#FFF8E7] text-[#4D080F] border-2 border-[#4D080F] font-titan text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-xs transition-all active:scale-95"
              id="show-more-products-btn"
            >
              SHOW MORE DISHES (+{Math.min(INITIAL_PAGE_SIZE, filteredProducts.length - visibleCount)})
            </button>
            {filteredProducts.length - visibleCount > INITIAL_PAGE_SIZE && (
              <button
                type="button"
                onClick={() => setVisibleCount(filteredProducts.length)}
                className="text-xs font-titan text-[#E62E00] hover:text-[#C92200] underline px-3 py-2"
                id="show-all-products-btn"
              >
                Show All {filteredProducts.length} Dishes
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

