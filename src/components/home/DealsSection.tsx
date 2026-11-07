import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DEALS_LIST } from '../../data/menu';
import { Tag, Check, Flame, Plus, ShoppingBag } from 'lucide-react';
import { ProductQuantityStepper } from '../common/ProductQuantityStepper';

export const DealsSection: React.FC = () => {
  const {
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    products,
    formatNaira,
    getProductPrice,
    setSelectedProductForDetail,
    setIsCartOpen,
  } = useApp();

  const [dealTab, setDealTab] = useState<'all' | 'food' | 'small-chops'>('all');

  const filteredDeals = DEALS_LIST.filter((deal) => {
    if (dealTab === 'food') return deal.id.startsWith('prod-qsr');
    if (dealTab === 'small-chops') return deal.id.startsWith('prod-sc');
    return true;
  });

  const getDealCartLine = (dealId: string) => {
    return cart.find((item) => item.productId === dealId);
  };

  const handleOrderDeal = (dealId: string) => {
    const canonicalProduct = products.find((p) => p.id === dealId);
    if (canonicalProduct) {
      if (canonicalProduct.optionGroups && canonicalProduct.optionGroups.length > 0) {
        setSelectedProductForDetail(canonicalProduct);
      } else {
        addToCart(canonicalProduct, 1);
      }
    }
  };

  const handleDealQtyChange = (dealId: string, nextQty: number) => {
    const existing = getDealCartLine(dealId);
    const canonicalProduct = products.find((p) => p.id === dealId);
    if (nextQty <= 0) {
      if (existing) removeFromCart(existing.id);
    } else if (existing) {
      updateCartQuantity(existing.id, nextQty);
    } else if (canonicalProduct) {
      if (canonicalProduct.optionGroups && canonicalProduct.optionGroups.length > 0) {
        setSelectedProductForDetail(canonicalProduct);
      } else {
        addToCart(canonicalProduct, nextQty);
      }
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" id="deals-section">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#FFC700]/20 text-[#4D080F] px-3 py-1 rounded-full text-xs font-titan tracking-wider uppercase mb-2">
            <Tag className="w-3.5 h-3.5 text-[#E62E00]" />
            SIGNATURE COMBOS &amp; PLATTERS
          </div>
          <h2 className="font-titan text-2xl sm:text-4xl text-[#4D080F] tracking-tight">
            POPULAR COMBOS &amp; PARTY PLATTERS
          </h2>
          <p className="text-xs sm:text-sm text-[#7A6A65] font-montserrat">
            Freshly prepared Choplife combos and party packs made to order across Benin City.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#FAF7F2] p-1.5 rounded-2xl border border-[#E5DEC9] overflow-x-auto no-scrollbar w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Combos & Platters' },
            { id: 'food', label: '🍲 Food Combos' },
            { id: 'small-chops', label: '🥟 Small Chops & Platters' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDealTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap transition-all ${
                dealTab === tab.id
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                  : 'text-[#5C4D49] hover:bg-white'
              }`}
              id={`deals-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDeals.map((deal) => {
          const canonicalProduct = products.find((p) => p.id === deal.id);
          const currentPrice = canonicalProduct ? getProductPrice(canonicalProduct) : deal.dealPrice;

          return (
            <div
              key={deal.id}
              className="bg-white rounded-3xl overflow-hidden border border-[#E5DEC9] shadow-md hover:shadow-xl transition-all flex flex-col justify-between group hover:-translate-y-1"
              id={`deal-card-${deal.id}`}
            >
              {/* Image & Badge */}
              <div className="relative h-48 overflow-hidden bg-[#FAF7F2]">
                <img
                  src={deal.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                  alt={deal.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3 bg-[#E62E00] text-white px-3 py-1 rounded-full font-titan text-xs shadow-md tracking-wider flex items-center gap-1">
                  <Flame className="w-3 h-3 text-[#FFC700]" />
                  {deal.badge}
                </div>
              </div>

              {/* Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-titan text-lg text-[#4D080F] group-hover:text-[#E62E00] transition-colors">
                    {deal.title}
                  </h3>
                  <p className="text-xs font-montserrat font-medium text-[#5C4D49] mt-0.5">
                    {deal.tagline}
                  </p>
                  
                  {/* Items included bullet points */}
                  <div className="mt-3 space-y-1.5 bg-[#FAF7F2] p-3 rounded-2xl border border-[#E5DEC9]">
                    <p className="text-[10px] font-titan uppercase tracking-wider text-[#7A6A65]">WHAT&apos;S INCLUDED:</p>
                    {deal.itemsIncluded.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-xs text-[#241311] font-montserrat">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price & Action Button */}
                <div className="pt-3 border-t border-[#F0EAE1] flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-[#7A6A65] block font-montserrat uppercase font-bold">Combo Price</span>
                    <span className="font-titan text-xl text-[#4D080F]">
                      {formatNaira(currentPrice * (getDealCartLine(deal.id)?.quantity || 1))}
                    </span>
                  </div>

                  {(() => {
                    const cartLine = getDealCartLine(deal.id);
                    const qty = cartLine?.quantity || 0;
                    if (qty > 0) {
                      return (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <ProductQuantityStepper
                            quantity={qty}
                            onQuantityChange={(next) => handleDealQtyChange(deal.id, next)}
                            min={0}
                            max={500}
                            size="md"
                            idPrefix={`deal-qty-${deal.id}`}
                            ariaLabel={`quantity for ${deal.title}`}
                          />
                        </div>
                      );
                    }
                    return (
                      <button
                        onClick={() => handleOrderDeal(deal.id)}
                        className="bg-[#FFC700] hover:bg-[#FFD733] text-[#4D080F] font-titan text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all transform active:scale-95 flex items-center gap-1.5"
                        id={`claim-deal-btn-${deal.id}`}
                      >
                        <Plus className="w-3.5 h-3.5 text-[#4D080F]" />
                        <span>ADD TO CART</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
