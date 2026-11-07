import React from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { Flame, Plus, Clock, ArrowRight } from 'lucide-react';

export const FavouritesSection: React.FC = () => {
  const {
    products,
    getProductPrice,
    isProductAvailable,
    selectedBranchId,
    currentBranch,
    setSelectedProductForDetail,
    addToCart,
    formatNaira,
    setActiveCategory,
  } = useApp();

  const favouriteProducts = products
    .filter((p) => (p.isPopular || p.isFeatured) && (!p.status || p.status === 'published') && (p as any).isActive !== false)
    .slice(0, 6);

  const handleProductClick = (product: Product) => {
    if (product.optionGroups && product.optionGroups.length > 0) {
      setSelectedProductForDetail(product);
    } else {
      addToCart(product, 1);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" id="favourites-section">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#E62E00]/10 text-[#E62E00] px-3 py-1 rounded-full text-xs font-titan tracking-wider uppercase mb-2">
            <Flame className="w-3.5 h-3.5 text-[#E62E00]" />
            MOST ORDERED IN BENIN CITY
          </div>
          <h2 className="font-titan text-2xl sm:text-4xl text-[#4D080F] tracking-tight">
            CHOPLIFE FAVOURITES
          </h2>
          <p className="text-xs sm:text-sm text-[#7A6A65] font-montserrat">
            Top customer favourites prepared fresh upon order at {currentBranch.name}.
          </p>
        </div>

        <button
          onClick={() => {
            setActiveCategory('favourites');
            const el = document.getElementById('menu-explorer-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="text-xs sm:text-sm font-titan text-[#E62E00] hover:text-[#C92200] flex items-center gap-1 group"
          id="view-full-menu-btn"
        >
          <span>VIEW FULL MASTER MENU</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {favouriteProducts.map((product) => {
          const price = getProductPrice(product, selectedBranchId);
          const isAvailable = isProductAvailable(product.id, selectedBranchId);

          return (
            <div
              key={product.id}
              onClick={() => setSelectedProductForDetail(product)}
              className="bg-white rounded-3xl overflow-hidden border border-[#E5DEC9] shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group hover:-translate-y-1"
              id={`favourite-item-${product.id}`}
            >
              {/* Image & Badges */}
              <div className="relative h-52 overflow-hidden bg-[#FAF7F2]">
                <img
                  src={product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {product.isFeatured && (
                    <span className="bg-[#FFC700] text-[#4D080F] px-2.5 py-0.5 rounded-full font-titan text-[10px] uppercase shadow-xs">
                      Best Seller
                    </span>
                  )}
                  {product.isSpicy && (
                    <span className="bg-[#E62E00] text-white px-2.5 py-0.5 rounded-full font-titan text-[10px] uppercase shadow-xs flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5 text-[#FFC700]" /> Hot
                    </span>
                  )}
                </div>

                {!isAvailable && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 text-center">
                    <span className="bg-[#4D080F] text-[#FFC700] font-titan text-xs px-3 py-1.5 rounded-xl border border-[#FFC700]/30 shadow-lg">
                      SOLD OUT AT {currentBranch.shortName.toUpperCase()}
                    </span>
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
                  <p className="text-xs text-[#5C4D49] font-montserrat mt-1 line-clamp-2">
                    {product.shortDescription}
                  </p>
                </div>

                {/* Price & Action Button */}
                <div className="pt-3 border-t border-[#F0EAE1] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#7A6A65] font-montserrat font-bold block uppercase">
                      PRICE
                    </span>
                    <span className="font-titan text-lg sm:text-xl text-[#E62E00]">
                      {formatNaira(price)}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProductClick(product);
                    }}
                    disabled={!isAvailable}
                    className="bg-[#E62E00] hover:bg-[#C92200] disabled:bg-gray-300 text-white p-2.5 sm:px-4 sm:py-2.5 rounded-xl font-titan text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
                    id={`quick-add-${product.id}`}
                  >
                    <Plus className="w-4 h-4 text-[#FFC700]" />
                    <span className="hidden sm:inline">
                      {product.optionGroups ? 'CUSTOMISE' : 'ADD'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
