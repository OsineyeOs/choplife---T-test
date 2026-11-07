import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles, ShoppingBag, Truck, ShieldCheck, Flame, CheckCircle, Wheat, Plus, Minus } from 'lucide-react';
import { APPROVED_BAKERY_PRODUCTS } from '../../data/approvedBakery';
import { ProductQuantityStepper } from '../common/ProductQuantityStepper';

export const BakerySection: React.FC = () => {
  const { cart, addToCart, updateCartQuantity, removeFromCart, setActiveCategory } = useApp();

  const retailLoaves = APPROVED_BAKERY_PRODUCTS.filter((p) => !p.subcategory.includes('Wholesale'));
  const wholesalePacks = APPROVED_BAKERY_PRODUCTS.filter((p) => p.subcategory.includes('Wholesale'));

  const getCartInfo = (productId: string) => {
    const item = cart.find((c) => c.productId === productId);
    return {
      qty: item?.quantity || 0,
      item,
    };
  };

  const handleQtyChange = (product: any, nextQty: number) => {
    const { qty, item } = getCartInfo(product.id);
    if (nextQty <= 0) {
      if (item) removeFromCart(item.id);
    } else if (item) {
      updateCartQuantity(item.id, nextQty);
    } else {
      addToCart(product, nextQty);
    }
  };

  return (
    <section className="py-14 bg-gradient-to-b from-[#FFFDF9] via-[#FAF4EB] to-[#FFFDF9] border-y border-[#FFC700]/30 relative overflow-hidden" id="choplife-bakery-hub">
      {/* Background Ambience Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#FFC700]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#E62E00]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header Badge & Title */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#4D080F] text-[#FFC700] text-xs font-montserrat font-bold uppercase tracking-wider mb-3 shadow-sm">
            <Wheat className="w-4 h-4 text-[#FFC700]" />
            CHOPLIFE BAKERY • FRESH OVEN DISPATCH
          </div>
          <h2 className="font-titan text-3xl sm:text-4xl text-[#4D080F] tracking-tight leading-tight">
            100% BROMATE-FREE <span className="text-[#E62E00]">SPECIAL BREAD</span>
          </h2>
          <p className="text-stone-700 font-montserrat text-sm sm:text-base mt-3 leading-relaxed">
            Baked with whole eggs, full cream milk, and zero artificial bromate. Experience Benin City’s softest, richest, and most trusted fresh bread — straight from our GRA and Okabere ovens.
          </p>
        </div>

        {/* Feature Badges Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <div className="bg-white p-3.5 rounded-2xl border border-amber-200/70 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-montserrat font-bold text-xs text-stone-900">Zero Bromate</h4>
              <p className="text-[11px] text-stone-500 font-montserrat">NAFDAC Compliant</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-amber-200/70 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#E62E00] flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-montserrat font-bold text-xs text-stone-900">Baked Daily</h4>
              <p className="text-[11px] text-stone-500 font-montserrat">Morning & Evening Batches</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-amber-200/70 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-montserrat font-bold text-xs text-stone-900">Wholesale Supply</h4>
              <p className="text-[11px] text-stone-500 font-montserrat">Supermarkets & Schools</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-amber-200/70 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#FFC700] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-montserrat font-bold text-xs text-stone-900">Egg & Milk Recipe</h4>
              <p className="text-[11px] text-stone-500 font-montserrat">Ultra soft & rich crumb</p>
            </div>
          </div>
        </div>

        {/* Retail Loaves Grid */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-titan text-xl text-[#4D080F] flex items-center gap-2">
              <span>🥖 Fresh Retail Loaves</span>
              <span className="text-xs font-montserrat font-semibold bg-[#4D080F]/10 text-[#4D080F] px-2.5 py-0.5 rounded-full">Single Loaves</span>
            </h3>
            <button
              onClick={() => {
                setActiveCategory('bakery');
                const menuEl = document.getElementById('menu-section');
                if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs font-montserrat font-bold text-[#E62E00] hover:underline"
              id="bakery-view-in-menu-btn"
            >
              View in Menu →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {retailLoaves.map((product) => {
              const { qty } = getCartInfo(product.id);
              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl overflow-hidden border border-amber-200/80 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                  id={`bakery-card-${product.id}`}
                >
                  <div className="h-44 overflow-hidden relative">
                    <img
                      src={product.image || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2.5 right-2.5 bg-[#4D080F] text-[#FFC700] text-xs font-titan px-2.5 py-1 rounded-xl shadow-md">
                      ₦{product.basePrice.toLocaleString()} / loaf
                    </div>
                    <div className="absolute bottom-2.5 left-2.5 bg-white/95 text-stone-800 text-[10px] font-montserrat font-bold px-2 py-0.5 rounded-md shadow flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      100% Bromate-Free
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-titan text-base text-[#4D080F] mb-1 leading-snug">
                        {product.name}
                      </h4>
                      <p className="text-xs text-stone-600 font-montserrat line-clamp-2 mb-3">
                        {product.shortDescription}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                      <span className="text-xs font-montserrat font-bold text-[#4D080F]">
                        ₦{(product.basePrice * (qty > 0 ? qty : 1)).toLocaleString()}
                      </span>

                      {qty === 0 ? (
                        <button
                          onClick={() => handleQtyChange(product, 1)}
                          className="bg-[#E62E00] hover:bg-[#FF3E1D] text-white text-xs font-montserrat font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
                          id={`bakery-add-${product.id}`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          Add to Cart
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <ProductQuantityStepper
                            quantity={qty}
                            onQuantityChange={(next) => handleQtyChange(product, next)}
                            min={0}
                            max={500}
                            size="md"
                            idPrefix={`bakery-qty-${product.id}`}
                            ariaLabel={`quantity of ${product.name}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wholesale Crate Callout */}
        <div className="bg-[#4D080F] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-[#FFC700]/30">
          <div className="max-w-2xl relative z-10">
            <span className="text-[#FFC700] text-xs font-titan uppercase tracking-widest block mb-1">
              RESELLER & CORPORATE WHOLESALE
            </span>
            <h3 className="font-titan text-2xl sm:text-3xl text-white mb-2">
              Supplying Benin City Supermarkets, Stores & Schools
            </h3>
            <p className="text-stone-300 font-montserrat text-xs sm:text-sm mb-6 leading-relaxed">
              Order directly in cartons at official Choplife wholesale rates. Daily scheduled dispatch to your store or institution across Benin City (10 loaves per crate).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {wholesalePacks.slice(0, 2).map((pkg) => {
                const { qty } = getCartInfo(pkg.id);
                return (
                  <div key={pkg.id} className="bg-white/10 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-3">
                    <div>
                      <h5 className="font-montserrat font-bold text-xs text-white">{pkg.name}</h5>
                      <p className="text-[11px] text-[#FFC700] font-montserrat font-semibold">₦{pkg.basePrice.toLocaleString()} / crate (10 loaves)</p>
                    </div>

                    {qty === 0 ? (
                      <button
                        onClick={() => handleQtyChange(pkg, 1)}
                        className="bg-[#FFC700] hover:bg-[#FFD733] text-[#4D080F] font-titan text-xs px-3 py-2 rounded-xl shrink-0 transition-transform active:scale-95 shadow"
                        id={`bakery-order-crate-${pkg.id}`}
                      >
                        Order Crate
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-[#FFC700]/40" onClick={(e) => e.stopPropagation()}>
                        <ProductQuantityStepper
                          quantity={qty}
                          onQuantityChange={(next) => handleQtyChange(pkg, next)}
                          min={0}
                          max={500}
                          size="sm"
                          unitLabel="crates"
                          idPrefix={`bakery-crate-${pkg.id}`}
                          ariaLabel={`crates of ${pkg.name}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
