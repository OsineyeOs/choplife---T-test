import React from 'react';
import { X } from 'lucide-react';

interface POModalProps {
  isOpen: boolean;
  onClose: () => void;
  poSupplierId: string;
  setPoSupplierId: (supId: string) => void;
  handleCreatePO: (e: React.FormEvent) => void;
}

export const PurchaseOrderModal: React.FC<POModalProps> = ({
  isOpen, onClose, poSupplierId, setPoSupplierId, handleCreatePO
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[#FAF7F2] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#241311]">New Purchase Order</h2>
          <button onClick={onClose} className="text-[#A89689] hover:text-[#241311]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleCreatePO} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#241311] mb-1">Supplier ID</label>
            <input type="text" value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)} className="w-full p-2 rounded-xl border border-[#A89689]/30 bg-[#FFFFFF] text-xs" required />
          </div>
          <button type="submit" className="w-full py-2 bg-[#800D15] text-white rounded-xl text-xs font-bold">Create PO</button>
        </form>
      </div>
    </div>
  );
};
