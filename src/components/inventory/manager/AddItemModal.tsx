import React, { useState } from 'react';
import { X, Sparkles, AlertCircle, PackagePlus, Info } from 'lucide-react';
import { InventoryItem, InventoryItemType, StorageArea } from '../../../types';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  addName: string;
  setAddName: (v: string) => void;
  addSku: string;
  setAddSku: (v: string) => void;
  addCategory?: string;
  setAddCategory?: (v: string) => void;
  addInventoryType?: InventoryItemType;
  setAddInventoryType?: (v: InventoryItemType) => void;
  addStorageArea?: StorageArea;
  setAddStorageArea?: (v: StorageArea) => void;
  addBaseUnit?: string;
  setAddBaseUnit?: (v: string) => void;
  addUnit?: string;
  setAddUnit?: (v: string) => void;
  addCostPerUnit?: string;
  setAddCostPerUnit?: (v: string) => void;
  addMinThreshold?: string;
  setAddMinThreshold?: (v: string) => void;
  addParLevel?: string;
  setAddParLevel?: (v: string) => void;
  addInitialStock?: string;
  setAddInitialStock?: (v: string) => void;
  addInitialLocation?: string;
  setAddInitialLocation?: (v: string) => void;
  addDescription?: string;
  setAddDescription?: (v: string) => void;
  inventoryItems?: InventoryItem[];
  handleCreateStockItem: (e: React.FormEvent) => Promise<void> | void;
}

const CATEGORY_SKU_PREFIX: Record<string, string> = {
  proteins: 'CL-MEAT',
  grains_staples: 'CL-RICE',
  produce: 'CL-PROD',
  spices_oils: 'CL-SPIC',
  bakery_dairy: 'CL-BAKE',
  beverages: 'CL-DRNK',
  packaging: 'CL-PACK',
};

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  addName,
  setAddName,
  addSku,
  setAddSku,
  addCategory = 'proteins',
  setAddCategory,
  addInventoryType = 'raw_material',
  setAddInventoryType,
  addStorageArea = 'dry_store',
  setAddStorageArea,
  addBaseUnit = 'kg',
  setAddBaseUnit,
  setAddUnit,
  addCostPerUnit = '0',
  setAddCostPerUnit,
  addMinThreshold = '10',
  setAddMinThreshold,
  addParLevel = '50',
  setAddParLevel,
  addInitialStock = '0',
  setAddInitialStock,
  addInitialLocation = 'general_store',
  setAddInitialLocation,
  addDescription = '',
  setAddDescription,
  inventoryItems = [],
  handleCreateStockItem,
}) => {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const generateNextSku = (cat: string) => {
    const prefix = CATEGORY_SKU_PREFIX[cat] || 'CL-ITEM';
    const existingNums = (inventoryItems || [])
      .map((it) => (it.sku || '').toUpperCase())
      .filter((s) => s.startsWith(`${prefix}-`))
      .map((s) => {
        const parts = s.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        return isNaN(num) ? 0 : num;
      });
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    const candidate = `${prefix}-${String(nextNum).padStart(3, '0')}`;
    setAddSku(candidate);
    setValidationError(null);
  };

  const onSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = (addName || '').trim();
    const trimmedSku = (addSku || '').trim().toUpperCase();

    if (!trimmedName) {
      setValidationError('Item name is required.');
      return;
    }
    if (!trimmedSku) {
      setValidationError('SKU code is required (e.g., CL-MEAT-001, CL-RICE-001, CL-PACK-001).');
      return;
    }
    if (!/^[A-Z0-9][A-Z0-9-_]{2,31}$/.test(trimmedSku)) {
      setValidationError(
        'Invalid SKU format. Use 3–32 uppercase letters, numbers, and hyphens (e.g., CL-MEAT-001 or CL-PACK-004).'
      );
      return;
    }

    const duplicate = (inventoryItems || []).find(
      (it) => (it.sku || '').trim().toUpperCase() === trimmedSku
    );
    if (duplicate) {
      setValidationError(
        `SKU "${trimmedSku}" is already assigned to "${duplicate.name}". Please enter a unique SKU or click Auto-Generate.`
      );
      return;
    }

    const costNum = Number(addCostPerUnit);
    if (isNaN(costNum) || costNum < 0) {
      setValidationError('Unit Cost must be a valid non-negative amount.');
      return;
    }

    const initStockNum = Number(addInitialStock);
    if (isNaN(initStockNum) || initStockNum < 0) {
      setValidationError('Opening stock quantity cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      await handleCreateStockItem(e);
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to create inventory item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
      <div className="bg-[#FAF7F2] rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-[#E5DEC9] max-h-[92vh] overflow-y-auto font-montserrat">
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DEC9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#800D15] text-[#FFC700] flex items-center justify-center shadow-xs">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-titan text-base text-[#241311] uppercase tracking-wide">
                Add New Master Inventory SKU
              </h2>
              <p className="text-[11px] text-[#78665A]">
                Register a perpetual stock item across Central Commissary &amp; Benin City branch kitchens
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#A89689] hover:text-[#241311] hover:bg-[#EFEAE0]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {validationError && (
          <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={onSubmitForm} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#241311] mb-1">
                Item Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={addName}
                onChange={(e) => {
                  setAddName(e.target.value);
                  setValidationError(null);
                }}
                placeholder="e.g., Fresh Jumbo Catfish (Live/Cleaned)"
                className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-white text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#241311]">
                  Master SKU Code <span className="text-red-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => generateNextSku(addCategory)}
                  className="text-[10px] font-bold text-[#800D15] hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Auto-Generate SKU
                </button>
              </div>
              <input
                type="text"
                value={addSku}
                onChange={(e) => {
                  setAddSku(e.target.value.toUpperCase());
                  setValidationError(null);
                }}
                placeholder="e.g., CL-MEAT-001, CL-RICE-001, CL-PACK-001"
                className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-white text-xs font-mono font-bold text-[#241311] uppercase focus:outline-none focus:border-[#800D15]"
                required
              />
              <p className="text-[10px] text-[#78665A] mt-1 flex items-center gap-1">
                <Info className="w-3 h-3 text-[#800D15] shrink-0" />
                <span>
                  Format: <code className="font-mono font-bold text-[#4D080F]">CL-&lt;CAT&gt;-&lt;NNN&gt;</code> (e.g.{' '}
                  <code className="font-mono">CL-MEAT-008</code>, <code className="font-mono">CL-PACK-005</code>). Must be unique.
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#241311] mb-1">
                Category <span className="text-red-600">*</span>
              </label>
              <select
                value={addCategory}
                onChange={(e) => {
                  setAddCategory?.(e.target.value);
                  if (!addSku) generateNextSku(e.target.value);
                }}
                className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-white text-xs text-[#241311]"
              >
                <option value="proteins">Proteins, Meats &amp; Fish</option>
                <option value="grains_staples">Grains, Rice &amp; Staples</option>
                <option value="produce">Fresh Produce &amp; Vegetables</option>
                <option value="spices_oils">Cooking Oils, Spices &amp; Sauces</option>
                <option value="bakery_dairy">Bakery Flour, Butter &amp; Dairy</option>
                <option value="beverages">Drinks &amp; Beverages</option>
                <option value="packaging">Clamshells, Foil &amp; Packaging</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#241311] mb-1">Inventory Type</label>
              <select
                value={addInventoryType}
                onChange={(e) => setAddInventoryType?.(e.target.value as InventoryItemType)}
                className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-white text-xs text-[#241311]"
              >
                <option value="raw_material">Raw Kitchen Ingredient</option>
                <option value="packaging">Packaging &amp; Disposables</option>
                <option value="prepared_subrecipe">Prepared Batch / Sub-Recipe</option>
                <option value="retail_beverage">Finished Retail Beverage</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#241311] mb-1">Storage Area</label>
              <select
                value={addStorageArea}
                onChange={(e) => setAddStorageArea?.(e.target.value as StorageArea)}
                className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-white text-xs text-[#241311]"
              >
                <option value="dry_store">Ambient Dry Store</option>
                <option value="cold_room">Chiller / Cold Room</option>
                <option value="freezer">Deep Freezer (-18°C)</option>
                <option value="packaging_store">Packaging Rack</option>
                <option value="beverage_cooler">Beverage Cooler</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#241311] mb-1">
                Base Unit <span className="text-red-600">*</span>
              </label>
              <select
                value={addBaseUnit}
                onChange={(e) => {
                  setAddBaseUnit?.(e.target.value);
                  setAddUnit?.(e.target.value);
                }}
                className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-white text-xs text-[#241311]"
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="liters">Liters (L)</option>
                <option value="pcs">Pieces (pcs)</option>
                <option value="packs">Packs</option>
                <option value="crates">Crates</option>
                <option value="portions">Portions</option>
                <option value="bags">Bags (50kg/25kg)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#241311] mb-1">
                Cost Per Unit (₦) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={addCostPerUnit}
                onChange={(e) => setAddCostPerUnit?.(e.target.value)}
                placeholder="e.g. 4500"
                className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-white text-xs text-[#241311]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#241311] mb-1">Min Reorder Alert</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={addMinThreshold}
                onChange={(e) => setAddMinThreshold?.(e.target.value)}
                placeholder="10"
                className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-white text-xs text-[#241311]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#241311] mb-1">Target Par Level</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={addParLevel}
                onChange={(e) => setAddParLevel?.(e.target.value)}
                placeholder="50"
                className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-white text-xs text-[#241311]"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E5DEC9] space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#800D15]">
              Opening Perpetual Balance (Optional)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#241311] mb-1">Opening Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addInitialStock}
                  onChange={(e) => setAddInitialStock?.(e.target.value)}
                  placeholder="0"
                  className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-[#FAF7F2] text-xs text-[#241311]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#241311] mb-1">Receiving Store Location</label>
                <select
                  value={addInitialLocation}
                  onChange={(e) => setAddInitialLocation?.(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-[#FAF7F2] text-xs text-[#241311]"
                >
                  <option value="general_store">Central Commissary (General Store)</option>
                  <option value="gra">GRA Flagship Hub (8a Okogo St)</option>
                  <option value="okabere">Okabere Road Hub (2 Okabere St)</option>
                  <option value="ugbowo">Ugbowo Campus Hub (Isihor)</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#241311] mb-1">Specification / Storage Notes</label>
            <input
              type="text"
              value={addDescription}
              onChange={(e) => setAddDescription?.(e.target.value)}
              placeholder="Optional quality specification, pack size, or storage instruction"
              className="w-full p-2.5 rounded-xl border border-[#D8CDBE] bg-white text-xs text-[#241311]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5DEC9]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D8CDBE] bg-white text-[#241311] text-xs font-bold hover:bg-[#EFEAE0]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#800D15] hover:bg-[#600910] text-[#FFC700] rounded-xl text-xs font-titan uppercase tracking-wide shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving SKU...' : 'Create Master SKU'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
