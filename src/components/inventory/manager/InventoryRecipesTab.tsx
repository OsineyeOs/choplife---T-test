import React from 'react';
import { Utensils, ShieldCheck } from 'lucide-react';
import { RecipeBOM, Product, InventoryItem } from '../../../types';

export interface InventoryRecipesTabProps {
  recipes: RecipeBOM[];
  products: Product[];
  inventoryItems?: InventoryItem[];
  formatNaira: (amount: number) => string;
  setIsNewRecipeOpen?: (v: boolean) => void;
}

export const InventoryRecipesTab: React.FC<InventoryRecipesTabProps> = ({
  recipes = [],
  products = [],
  formatNaira,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-1.5">
            <Utensils className="w-4 h-4 text-[#4D080F]" />
            Culinary Recipe Bill of Materials (BOM) & Food Costing
          </h3>
          <p className="text-xs text-gray-500 font-montserrat">
            Connected to POS and Online Checkout — orders automatically deduct raw ingredient fractions.
          </p>
        </div>

        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-montserrat font-bold border border-emerald-200 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> {recipes.length} Active Recipes Configured
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recipes.map((rcp) => {
          const matchedProduct = products.find((p) => p.id === rcp.menuProductId);
          const sellingPrice = matchedProduct ? matchedProduct.price : rcp.totalCostPerPortion * 2.5;
          const foodCostPct = sellingPrice > 0 ? (rcp.totalCostPerPortion / sellingPrice) * 100 : 0;

          return (
            <div
              key={rcp.id}
              className="bg-white rounded-3xl p-5 border border-[#E5DEC9] space-y-3 shadow-2xs"
            >
              <div className="flex items-center justify-between border-b pb-2.5">
                <div>
                  <h4 className="font-titan text-base text-[#4D080F]">{rcp.menuProductName}</h4>
                  <span className="text-[10px] text-gray-500 font-montserrat">
                    Yield: {rcp.yieldPortions} Portion(s) | Category: {rcp.category}
                  </span>
                </div>

                <div className="text-right">
                  <span className="font-titan text-sm text-[#E62E00]">
                    Cost: {formatNaira(rcp.totalCostPerPortion)}
                  </span>
                  <span className="block text-[10px] text-emerald-700 font-bold">
                    Food Cost: {foodCostPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Ingredients Breakdown */}
              <div className="space-y-1.5 bg-[#FAF7F2] p-3 rounded-2xl border border-[#E5DEC9]">
                <span className="text-[10px] font-titan uppercase text-[#4D080F] block">
                  Ingredients & Raw Material Fractions
                </span>
                {rcp.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex justify-between text-xs font-montserrat">
                    <span className="text-gray-700">
                      {ing.quantity} {ing.unit} {ing.ingredientName}
                      {ing.wastePercentage > 0 && ` (+${ing.wastePercentage}% waste)`}
                    </span>
                    <strong className="text-[#4D080F]">{formatNaira(ing.calculatedCost)}</strong>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs font-montserrat pt-1">
                <span className="text-gray-500">Target Selling Price:</span>
                <strong className="font-titan text-[#4D080F]">{formatNaira(sellingPrice)}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
