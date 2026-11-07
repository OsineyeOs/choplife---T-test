import React from 'react';
import { X } from 'lucide-react';
import { InventoryItem } from '../../../types';

interface QuickAdjustModalProps {
  isOpen: InventoryItem | null;
  onClose: () => void;
  adjustLocation: string;
  setAdjustLocation: (loc: string) => void;
  adjustQuantity: string;
  setAdjustQuantity: (qty: string) => void;
  handleQuickAdjust: (e: React.FormEvent) => void;
}

export const QuickAdjustModal: React.FC<QuickAdjustModalProps> = ({
  isOpen, onClose, adjustQuantity, setAdjustQuantity, handleQuickAdjust
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[#FAF7F2] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#241311]">Quick Stock Adjustment</h2>
          <button onClick={onClose} className="text-[#A89689] hover:text-[#241311]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleQuickAdjust} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#241311] mb-1">Adjustment Quantity</label>
            <input
              type="number"
              value={adjustQuantity}
              onChange={(e) => setAdjustQuantity(e.target.value)}
              className="w-full p-2 rounded-xl border border-[#A89689]/30 bg-[#FFFFFF] text-xs"
              placeholder="e.g., 5 or -2"
              required
            />
          </div>
          <button type="submit" className="w-full py-2 bg-[#800D15] text-white rounded-xl text-xs font-bold">
            Confirm Adjustment
          </button>
        </form>
      </div>
    </div>
  );
};
