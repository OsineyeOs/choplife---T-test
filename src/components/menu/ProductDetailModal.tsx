import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import {
  X,
  Plus,
  Minus,
  Check,
  ShoppingBag,
  Clock,
  Flame,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Heart,
} from 'lucide-react';

export const ProductDetailModal: React.FC = () => {
  const {
    selectedProductForDetail,
    setSelectedProductForDetail,
    addToCart,
    getProductPrice,
    isProductAvailable,
    selectedBranchId,
    currentBranch,
    formatNaira,
    products,
    toggleShortlist,
    isProductShortlisted,
  } = useApp();

  const product = selectedProductForDetail;

  const [quantity, setQuantity] = useState(1);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Reset state whenever a new product is selected
  useEffect(() => {
    if (product) {
      setQuantity(1);
      setSelectedAddOns([]);
      setSpecialInstructions('');

      // Set default choices for option groups
      const defaults: Record<string, string> = {};
      if (product.optionGroups) {
        product.optionGroups.forEach((group) => {
          const defChoice = group.choices.find((c) => c.isDefault) || group.choices[0];
          if (defChoice) {
            defaults[group.id] = defChoice.id;
          }
        });
      }
      setSelectedChoices(defaults);
    }
  }, [product]);

  if (!product) return null;

  const isAvailable = isProductAvailable(product.id, selectedBranchId);
  const basePrice = getProductPrice(product, selectedBranchId);

  // Compute total unit price including options and addons
  let optionsDelta = 0;
  if (product.optionGroups) {
    product.optionGroups.forEach((group) => {
      const choiceId = selectedChoices[group.id];
      const choice = group.choices.find((c) => c.id === choiceId);
      if (choice) {
        optionsDelta += choice.priceDelta;
      }
    });
  }

  let addOnsDelta = 0;
  if (product.availableAddOns) {
    product.availableAddOns.forEach((addon) => {
      if (selectedAddOns.includes(addon.id)) {
        addOnsDelta += addon.price;
      }
    });
  }

  const unitPrice = basePrice + optionsDelta + addOnsDelta;
  const totalPrice = unitPrice * quantity;

  const handleChoiceSelect = (groupId: string, choiceId: string) => {
    setSelectedChoices((prev) => ({ ...prev, [groupId]: choiceId }));
  };

  const handleToggleAddOn = (addonId: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  const handleAddToCart = () => {
    if (!isAvailable) return;

    // Build structured customization object
    const selectedOptionsList = Object.entries(selectedChoices).map(([groupId, choiceId]) => {
      const group = product.optionGroups?.find((g) => g.id === groupId);
      const choice = group?.choices.find((c) => c.id === choiceId);
      return {
        groupId,
        groupName: group?.name || groupId,
        choiceId,
        choiceName: choice?.name || choiceId,
        priceDelta: choice?.priceDelta || 0,
      };
    });

    const selectedAddOnsList = (product.availableAddOns || [])
      .filter((a) => selectedAddOns.includes(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        price: a.price,
      }));

    addToCart(product, quantity, {
      selectedOptions: selectedOptionsList,
      selectedAddOns: selectedAddOnsList,
      specialInstructions: specialInstructions.trim() || undefined,
    });

    setSelectedProductForDetail(null);
  };

  // Look up upsell products (excluding archived/inactive items)
  const upsellProducts = (product.suggestedUpsells || [])
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p) && (!p.status || p.status === 'published') && (p as any).isActive !== false)
    .slice(0, 2);

  const hasStructuredComponents = Array.isArray((product as any).components) && (product as any).components.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      id="product-detail-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedProductForDetail(null);
        }
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E5DEC9] flex flex-col justify-between">
        
        {/* Modal Top Banner & Close Button */}
        <div className="relative h-64 sm:h-72 bg-[#FAF7F2] shrink-0">
          <img
            src={product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleShortlist(product.id)}
              className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-md ${
                isProductShortlisted(product.id)
                  ? 'bg-[#E62E00] text-white'
                  : 'bg-black/60 hover:bg-black/80 text-white'
              }`}
              id="detail-modal-shortlist-btn"
              title={isProductShortlisted(product.id) ? 'Remove from Shortlist' : 'Save to Shortlist'}
            >
              <Heart className={`w-4 h-4 ${isProductShortlisted(product.id) ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => setSelectedProductForDetail(null)}
              className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-colors"
              id="close-product-detail-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Branch & Availability Badges */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            <span className="bg-[#4D080F]/90 text-[#FFC700] px-3 py-1 rounded-full text-xs font-titan tracking-wider uppercase border border-[#FFC700]/30 shadow-md">
              {currentBranch.shortName}
            </span>
            {product.isSpicy && (
              <span className="bg-[#E62E00] text-white px-2.5 py-1 rounded-full text-[10px] font-titan uppercase tracking-wider flex items-center gap-1 shadow-md">
                <Flame className="w-3 h-3 text-[#FFC700]" /> Spicy
              </span>
            )}
          </div>

          {/* Title & Price on Image */}
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h2 className="font-titan text-xl sm:text-2xl tracking-tight leading-snug">
              {product.name}
            </h2>
            <div className="flex items-center justify-between mt-1">
              <span className="font-titan text-2xl text-[#FFC700]">
                {formatNaira(basePrice)}
              </span>
              <span className="text-xs font-montserrat text-white/80 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-white/60" />
                ~{product.prepTimeMinutes} mins prep
              </span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 sm:p-6 space-y-6 flex-1">
          
          {/* Out of Stock Warning */}
          {!isAvailable && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl flex items-start gap-2 text-xs font-montserrat">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Currently Sold Out at {currentBranch.name}</p>
                <p className="text-rose-700">This item is still available at other Choplife locations (e.g. GRA / Okabere). Switch branch to order.</p>
              </div>
            </div>
          )}

          {/* Structured Package Composition or Description */}
          {hasStructuredComponents ? (
            <div className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl p-3.5 space-y-2">
              <span className="text-[10px] font-titan uppercase tracking-wider text-[#4D080F] block">
                What&apos;s Inside This Package
              </span>
              <div className="flex flex-wrap gap-1.5">
                {((product as any).components as any[]).map((comp, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-xl bg-white border border-[#E5DEC9] text-xs font-montserrat font-bold text-[#241311]"
                  >
                    {comp.quantity}&times; {comp.productName || comp.name || comp.productId}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-[#5C4D49] font-montserrat leading-relaxed">
              {product.longDescription || product.shortDescription}
            </p>
          )}

          {/* Option Groups (e.g. Protein, Sauce, Sides, Spice) */}
          {product.optionGroups && product.optionGroups.map((group) => (
            <div key={group.id} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-titan text-xs text-[#4D080F] uppercase tracking-wider">
                  {group.name} {group.required && <span className="text-[#E62E00]">*</span>}
                </label>
                <span className="text-[10px] font-montserrat text-[#7A6A65] font-bold">Select 1</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.choices.map((choice) => {
                  const isSelected = selectedChoices[group.id] === choice.id;
                  return (
                    <button
                      key={choice.id}
                      onClick={() => handleChoiceSelect(group.id, choice.id)}
                      className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'border-[#E62E00] bg-[#FFF8E7] shadow-xs'
                          : 'border-[#E5DEC9] bg-[#FAF7F2] hover:bg-white'
                      }`}
                      id={`choice-${group.id}-${choice.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-[#E62E00] bg-[#E62E00]' : 'border-gray-400'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs font-montserrat font-bold text-[#241311]">
                          {choice.name}
                        </span>
                      </div>
                      {choice.priceDelta > 0 && (
                        <span className="text-xs font-titan text-[#E62E00]">
                          +{formatNaira(choice.priceDelta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Add-Ons Checklist */}
          {product.availableAddOns && product.availableAddOns.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-[#F0EAE1]">
              <label className="font-titan text-xs text-[#4D080F] uppercase tracking-wider block">
                CUSTOMISE WITH ADD-ONS
              </label>

              <div className="space-y-2">
                {product.availableAddOns.map((addon) => {
                  const isSelected = selectedAddOns.includes(addon.id);
                  return (
                    <button
                      key={addon.id}
                      onClick={() => handleToggleAddOn(addon.id)}
                      className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'border-[#E62E00] bg-[#FFF8E7]'
                          : 'border-[#E5DEC9] bg-[#FAF7F2] hover:bg-white'
                      }`}
                      id={`addon-btn-${addon.id}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                          isSelected ? 'bg-[#E62E00] border-[#E62E00]' : 'border-gray-400'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs font-montserrat font-bold text-[#241311]">
                          {addon.name}
                        </span>
                      </div>
                      <span className="text-xs font-titan text-[#E62E00]">
                        +{formatNaira(addon.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upsells Recommendations */}
          {upsellProducts.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-[#F0EAE1]">
              <div className="flex items-center gap-1.5 text-xs font-titan text-[#E62E00] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
                COMPLETE YOUR MEAL
              </div>
              <div className="grid grid-cols-2 gap-2">
                {upsellProducts.map((upsell) => (
                  <div
                    key={upsell.id}
                    className="bg-[#FAF7F2] p-2.5 rounded-2xl border border-[#E5DEC9] flex items-center gap-2"
                  >
                    <img
                      src={upsell.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                      alt={upsell.name}
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-titan text-[#241311] truncate">{upsell.name}</p>
                      <p className="text-[10px] font-bold text-[#E62E00]">{formatNaira(getProductPrice(upsell))}</p>
                      <button
                        onClick={() => addToCart(upsell, 1)}
                        className="text-[9px] font-titan uppercase bg-[#E62E00] text-white px-2 py-0.5 rounded-md mt-1 hover:bg-[#C92200]"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Special Kitchen Instructions */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-titan uppercase tracking-wider text-[#7A6A65]">
              SPECIAL INSTRUCTIONS FOR KITCHEN
            </label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Extra napkins, no onions in slaw, please separate pepper sauce..."
              rows={2}
              className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl p-3 text-xs font-montserrat text-[#241311] placeholder:text-[#8E7E7A] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
            />
          </div>

        </div>

        {/* Footer with Quantity Counter & Add to Cart */}
        <div className="bg-[#FAF7F2] p-4 sm:p-5 rounded-b-3xl border-t border-[#E5DEC9] flex items-center justify-between gap-4 sticky bottom-0">
          {/* Quantity selector with direct numeric input */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-[#E5DEC9] shadow-2xs">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1 || !isAvailable}
              className="w-7 h-7 rounded-xl bg-[#FAF7F2] hover:bg-[#E5DEC9] flex items-center justify-center text-xs font-bold text-[#4D080F] disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={1}
              max={500}
              value={quantity}
              disabled={!isAvailable}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                if (!Number.isNaN(parsed) && parsed >= 1) {
                  setQuantity(Math.min(500, parsed));
                } else if (e.target.value === '') {
                  setQuantity(1);
                }
              }}
              className="font-titan text-base w-12 text-center text-[#241311] bg-transparent border border-transparent focus:border-[#E62E00] rounded px-1 focus:outline-none"
              aria-label="Product quantity input"
              id="modal-product-qty-input"
            />
            <button
              type="button"
              onClick={() => setQuantity(Math.min(500, quantity + 1))}
              disabled={!isAvailable}
              className="w-7 h-7 rounded-xl bg-[#E62E00] hover:bg-[#C92200] flex items-center justify-center text-xs font-bold text-white disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to cart CTA */}
          <button
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className="flex-1 bg-[#E62E00] hover:bg-[#C92200] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-titan text-xs sm:text-sm py-3.5 px-4 rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-between"
            id="modal-add-to-cart-cta"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#FFC700]" />
              <span>{isAvailable ? 'ADD TO ORDER' : 'SOLD OUT AT THIS BRANCH'}</span>
            </span>
            <span className="text-sm font-titan text-[#FFC700]">
              {formatNaira(totalPrice)}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
