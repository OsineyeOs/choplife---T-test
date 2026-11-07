import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  X,
  ShoppingBag,
  MapPin,
  BookOpen,
  UtensilsCrossed,
  ArrowRight,
  Flame,
  Check,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Product } from '../../types';
import { ARTICLES_LIST, Article } from '../../data/articles';
import {
  GRA_DELIVERY_ZONES,
  OKABERE_DELIVERY_ZONES,
  UGBOWO_DELIVERY_ZONES,
} from '../../data/deliveryMaster';

interface NavSearchBarProps {
  onSelectArticle?: (article: Article) => void;
  isMobileModal?: boolean;
  onCloseMobile?: () => void;
}

export const NavSearchBar: React.FC<NavSearchBarProps> = ({
  onSelectArticle,
  isMobileModal = false,
  onCloseMobile,
}) => {
  const {
    products,
    searchQuery,
    setSearchQuery,
    setSelectedProductForDetail,
    addToCart,
    setActiveCategory,
    setSelectedDeliveryZone,
    formatNaira,
    selectedBranchId,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'products' | 'menu' | 'delivery' | 'articles'>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = searchQuery.trim().toLowerCase();

  // 1. PRODUCTS RESULTS
  const matchingProducts = query
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.shortDescription.toLowerCase().includes(query) ||
          (p.subcategory && p.subcategory.toLowerCase().includes(query)) ||
          p.category.toLowerCase().includes(query)
      ).slice(0, 6)
    : [];

  // 2. MENU CATEGORIES RESULTS
  const menuCategories = [
    { id: 'small-chops', name: 'Small Chops & Boxes', icon: '🥟', desc: 'Puff puff, samosa, spring rolls, munch packs' },
    { id: 'bakery', name: 'Choplife Bakery & Bread', icon: '🍞', desc: '100% Bromate-free special bread loaves' },
    { id: 'snacks', name: 'Shawarma & Snacks', icon: '🌯', desc: 'Loaded chicken shawarma, meat pies, scotch eggs' },
    { id: 'protein', name: 'Flame Grills & Suya', icon: '🍗', desc: 'Quarter chicken, grilled fish, peppered turkey' },
    { id: 'food', name: 'Smoky Party Jollof & QSR Food', icon: '🍲', desc: 'Firewood party jollof, fried rice, pasta, soups' },
    { id: 'drinks', name: 'Chilled Drinks & Parfait', icon: '🥤', desc: 'Zobo, fruit juices, yogurt parfait, soft drinks' },
  ];

  const matchingCategories = query
    ? menuCategories.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.desc.toLowerCase().includes(query) ||
          c.id.toLowerCase().includes(query)
      )
    : [];

  // 3. DELIVERY ZONES RESULTS
  const allDeliveryZones = [
    ...GRA_DELIVERY_ZONES.map((z) => ({ ...z, branch: 'GRA' })),
    ...OKABERE_DELIVERY_ZONES.map((z) => ({ ...z, branch: 'Okabere' })),
    ...UGBOWO_DELIVERY_ZONES.map((z) => ({ ...z, branch: 'Ugbowo' })),
  ];

  const matchingZones = query
    ? allDeliveryZones.filter(
        (z) =>
          z.locationName.toLowerCase().includes(query) ||
          z.branch.toLowerCase().includes(query) ||
          z.aliases.some((a) => a.toLowerCase().includes(query))
      ).slice(0, 5)
    : [];

  // 4. ARTICLES RESULTS
  const matchingArticles = query
    ? ARTICLES_LIST.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.summary.toLowerCase().includes(query) ||
          a.tags.some((t) => t.toLowerCase().includes(query)) ||
          a.category.toLowerCase().includes(query)
      )
    : [];

  const totalResultsCount =
    matchingProducts.length +
    matchingCategories.length +
    matchingZones.length +
    matchingArticles.length;

  const handleSelectProduct = (product: Product) => {
    setSelectedProductForDetail(product);
    setIsOpen(false);
    if (onCloseMobile) onCloseMobile();
  };

  const handleSelectCategory = (catId: string) => {
    setActiveCategory(catId);
    setIsOpen(false);
    if (onCloseMobile) onCloseMobile();
    const menuEl = document.getElementById('menu-explorer-section');
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectZone = (zoneName: string) => {
    setSelectedDeliveryZone(zoneName);
    setIsOpen(false);
    if (onCloseMobile) onCloseMobile();
  };

  const handleSelectArticleItem = (article: Article) => {
    setIsOpen(false);
    if (onCloseMobile) onCloseMobile();
    if (onSelectArticle) {
      onSelectArticle(article);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full" id="nav-search-bar-wrapper">
      {/* Search Input Bar */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search products, menu, delivery zones, guides..."
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          className="w-full pl-9 pr-8 py-2 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs font-montserrat text-[#241311] placeholder:text-[#8E7E7A] focus:outline-none focus:ring-2 focus:ring-[#E62E00]/30 focus:border-[#E62E00] transition-all shadow-2xs"
          id="nav-unified-search-input"
          autoComplete="off"
        />
        <Search className="w-4 h-4 text-[#8E7E7A] absolute left-3 top-2.5 pointer-events-none" />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-2.5 text-xs text-[#8E7E7A] hover:text-[#4D080F] transition-colors"
            id="nav-search-clear-btn"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Results Popover */}
      {isOpen && query.length > 0 && (
        <div
          className={`absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-[#E5DEC9] shadow-2xl z-50 overflow-hidden max-h-[80vh] sm:max-h-[500px] flex flex-col ${
            isMobileModal ? 'w-full' : 'sm:w-[480px] lg:w-[540px]'
          }`}
          id="nav-search-results-dropdown"
        >
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 p-2 bg-[#FAF7F2] border-b border-[#E5DEC9] overflow-x-auto text-[11px] font-montserrat font-bold no-scrollbar">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterType === 'all'
                  ? 'bg-[#4D080F] text-[#FFC700]'
                  : 'bg-white text-[#7A6A65] hover:text-[#241311] border border-[#E5DEC9]'
              }`}
            >
              All Results ({totalResultsCount})
            </button>
            <button
              onClick={() => setFilterType('products')}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterType === 'products'
                  ? 'bg-[#4D080F] text-[#FFC700]'
                  : 'bg-white text-[#7A6A65] hover:text-[#241311] border border-[#E5DEC9]'
              }`}
            >
              Dishes ({matchingProducts.length})
            </button>
            <button
              onClick={() => setFilterType('menu')}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterType === 'menu'
                  ? 'bg-[#4D080F] text-[#FFC700]'
                  : 'bg-white text-[#7A6A65] hover:text-[#241311] border border-[#E5DEC9]'
              }`}
            >
              Menu ({matchingCategories.length})
            </button>
            <button
              onClick={() => setFilterType('delivery')}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterType === 'delivery'
                  ? 'bg-[#4D080F] text-[#FFC700]'
                  : 'bg-white text-[#7A6A65] hover:text-[#241311] border border-[#E5DEC9]'
              }`}
            >
              Delivery Zones ({matchingZones.length})
            </button>
            <button
              onClick={() => setFilterType('articles')}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterType === 'articles'
                  ? 'bg-[#4D080F] text-[#FFC700]'
                  : 'bg-white text-[#7A6A65] hover:text-[#241311] border border-[#E5DEC9]'
              }`}
            >
              Articles ({matchingArticles.length})
            </button>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto p-3 space-y-4 flex-1">
            
            {totalResultsCount === 0 && (
              <div className="text-center py-8 space-y-2 text-[#7A6A65]">
                <p className="font-titan text-sm text-[#4D080F]">No matching results</p>
                <p className="text-xs font-montserrat">
                  Try searching for "shawarma", "small chops", "bread", "GRA", or "jollof".
                </p>
              </div>
            )}

            {/* 1. DISHES / PRODUCTS */}
            {(filterType === 'all' || filterType === 'products') && matchingProducts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-titan uppercase tracking-wider text-[#7A6A65] px-1">
                  <span>DISHES & FOOD ITEMS ({matchingProducts.length})</span>
                  <span className="text-[#E62E00]">Click to view or order</span>
                </div>
                <div className="divide-y divide-[#F0EAE1] bg-[#FAF7F2] rounded-xl border border-[#E5DEC9]">
                  {matchingProducts.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 flex items-center justify-between gap-3 hover:bg-white transition-colors cursor-pointer group"
                      onClick={() => handleSelectProduct(p)}
                    >
                      <img
                        src={p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                        alt={p.name}
                        className="w-11 h-11 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-titan text-xs text-[#241311] group-hover:text-[#E62E00] truncate">
                            {p.name}
                          </p>
                          {p.subcategory && (
                            <span className="text-[9px] font-montserrat px-1.5 py-0.2 bg-white rounded text-[#7A6A65] border border-[#E5DEC9]">
                              {p.subcategory}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#7A6A65] line-clamp-1">
                          {p.shortDescription}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-titan text-xs text-[#E62E00]">
                          {formatNaira(p.basePrice)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(p, 1, undefined, true);
                            setIsOpen(false);
                            if (onCloseMobile) onCloseMobile();
                          }}
                          className="p-1.5 bg-[#E62E00] hover:bg-[#C92200] text-white rounded-lg shadow-2xs transition-transform active:scale-95"
                          title="Add to cart"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. MENU SECTIONS */}
            {(filterType === 'all' || filterType === 'menu') && matchingCategories.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-titan uppercase tracking-wider text-[#7A6A65] px-1">
                  <span>MENU SECTIONS & CATEGORIES ({matchingCategories.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {matchingCategories.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCategory(c.id)}
                      className="p-2.5 rounded-xl bg-[#FAF7F2] hover:bg-white border border-[#E5DEC9] hover:border-[#FFC700] cursor-pointer flex items-center justify-between gap-3 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{c.icon}</span>
                        <div>
                          <p className="font-titan text-xs text-[#4D080F] group-hover:text-[#E62E00]">
                            {c.name}
                          </p>
                          <p className="text-[10px] text-[#7A6A65]">{c.desc}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#7A6A65] group-hover:translate-x-1 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. DELIVERY ZONES */}
            {(filterType === 'all' || filterType === 'delivery') && matchingZones.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-titan uppercase tracking-wider text-[#7A6A65] px-1">
                  <span>BENIN CITY DELIVERY ZONES ({matchingZones.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {matchingZones.map((z, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectZone(z.locationName)}
                      className="p-2.5 rounded-xl bg-[#FAF7F2] hover:bg-white border border-[#E5DEC9] cursor-pointer flex items-center justify-between gap-2 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#E62E00]" />
                        <div>
                          <p className="font-montserrat font-bold text-xs text-[#241311] group-hover:text-[#E62E00]">
                            {z.locationName}
                          </p>
                          <p className="text-[10px] text-[#7A6A65]">
                            {z.branch} Kitchen Axis • Est. {z.estimatedMins}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-titan text-xs text-[#4D080F]">
                          {formatNaira(z.deliveryFee)}
                        </span>
                        <span className="text-[9px] block text-emerald-700 font-bold">
                          Select Zone ✓
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. ARTICLES & GUIDES */}
            {(filterType === 'all' || filterType === 'articles') && matchingArticles.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-titan uppercase tracking-wider text-[#7A6A65] px-1">
                  <span>FOOD CULTURE & GUIDES ({matchingArticles.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {matchingArticles.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => handleSelectArticleItem(art)}
                      className="p-2.5 rounded-xl bg-[#FAF7F2] hover:bg-white border border-[#E5DEC9] hover:border-[#FFC700] cursor-pointer flex items-center gap-3 transition-colors group"
                    >
                      <img
                        src={art.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                        alt={art.title}
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] font-titan uppercase text-[#E62E00] bg-[#FFF8E7] px-1.5 py-0.2 rounded">
                            {art.category}
                          </span>
                          <span className="text-[10px] text-[#7A6A65] flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> {art.readTime}
                          </span>
                        </div>
                        <p className="font-titan text-xs text-[#4D080F] group-hover:text-[#E62E00] line-clamp-1">
                          {art.title}
                        </p>
                        <p className="text-[10px] text-[#7A6A65] line-clamp-1">
                          {art.summary}
                        </p>
                      </div>
                      <BookOpen className="w-4 h-4 text-[#7A6A65] group-hover:text-[#E62E00] shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer of Dropdown */}
          <div className="p-2 bg-[#FAF7F2] border-t border-[#E5DEC9] flex items-center justify-between text-[10px] font-montserrat text-[#7A6A65]">
            <span>Press ESC or click outside to dismiss</span>
            <button
              onClick={() => {
                setIsOpen(false);
                const menuEl = document.getElementById('menu-explorer-section');
                if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-[#E62E00] font-bold hover:underline"
            >
              Browse Full Menu →
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
