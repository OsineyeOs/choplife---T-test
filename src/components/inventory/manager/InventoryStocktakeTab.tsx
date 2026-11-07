import React from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { StockCountSession, InventoryItem } from '../../../types';

export interface InventoryStocktakeTabProps {
  stockCounts: StockCountSession[];
  inventoryItems?: InventoryItem[];
  activeLocationFilter?: string;
  formatNaira: (amount: number) => string;
  setIsNewStocktakeOpen: (v: boolean) => void;
}

export const InventoryStocktakeTab: React.FC<InventoryStocktakeTabProps> = ({
  stockCounts = [],
  formatNaira,
  setIsNewStocktakeOpen,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-[#4D080F]" />
            Physical Stocktake & Cycle Count Audits
          </h3>
          <p className="text-xs text-gray-500 font-montserrat">
            Conduct physical counts, calculate variance against system ledger & auto-reconcile stock levels.
          </p>
        </div>

        <button
          onClick={() => setIsNewStocktakeOpen(true)}
          className="px-4 py-2 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] rounded-xl text-xs font-titan uppercase flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          New Stocktake Audit
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5DEC9] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-montserrat">
            <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
              <tr>
                <th className="p-3.5">Session # / Date</th>
                <th className="p-3.5 text-center">Location</th>
                <th className="p-3.5 text-center">Items Counted</th>
                <th className="p-3.5 text-right">Net Variance Value</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5">Auditor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DEC9]">
              {stockCounts.map((s) => (
                <tr key={s.id} className="hover:bg-[#FFF8E7]/40 transition-colors">
                  <td className="p-3.5">
                    <strong className="block text-[#4D080F] font-mono">{s.referenceNo}</strong>
                    <span className="text-[10px] text-gray-500">
                      {new Date((s as any).conductedAt || (s as any).sessionDate || Date.now()).toLocaleString()}
                    </span>
                  </td>

                  <td className="p-3.5 text-center font-bold text-gray-700 capitalize">
                    {s.locationId}
                  </td>

                  <td className="p-3.5 text-center font-bold text-[#4D080F]">
                    {s.lines.length} lines
                  </td>

                  <td className="p-3.5 text-right font-titan text-red-600">
                    {formatNaira(s.totalVarianceValue)}
                  </td>

                  <td className="p-3.5 text-center">
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-titan uppercase">
                      {s.status}
                    </span>
                  </td>

                  <td className="p-3.5 font-semibold text-gray-800">
                    {s.conductedByName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
