import React from 'react';
import { TrendingDown, Plus } from 'lucide-react';
import { WastageRecord, InventoryItem } from '../../../types';

export interface InventoryWastageTabProps {
  wastageRecords: WastageRecord[];
  inventoryItems?: InventoryItem[];
  activeLocationFilter?: string;
  formatNaira: (amount: number) => string;
  setIsLogWastageOpen: (v: boolean) => void;
}

export const InventoryWastageTab: React.FC<InventoryWastageTabProps> = ({
  wastageRecords = [],
  formatNaira,
  setIsLogWastageOpen,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-red-600" />
            Kitchen Wastage, Spoilage & Write-Off Logs
          </h3>
          <p className="text-xs text-gray-500 font-montserrat">
            Log food loss with root cause analysis (spoilage, power outage, prep spill, burnt).
          </p>
        </div>

        <button
          onClick={() => setIsLogWastageOpen(true)}
          className="px-4 py-2 bg-[#E62E00] hover:bg-red-700 text-white rounded-xl text-xs font-titan uppercase flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Log Kitchen Wastage
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5DEC9] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-montserrat">
            <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
              <tr>
                <th className="p-3.5">Log # / Date</th>
                <th className="p-3.5">Raw Material</th>
                <th className="p-3.5 text-center">Location</th>
                <th className="p-3.5 text-center">Root Cause Reason</th>
                <th className="p-3.5 text-right">Quantity Lost</th>
                <th className="p-3.5 text-right">Total Financial Loss</th>
                <th className="p-3.5">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DEC9]">
              {wastageRecords.map((w) => (
                <tr key={w.id} className="hover:bg-[#FFF8E7]/40 transition-colors">
                  <td className="p-3.5">
                    <strong className="block text-[#4D080F] font-mono">{w.id}</strong>
                    <span className="text-[10px] text-gray-500">
                      {new Date((w as any).reportedAt || (w as any).date || Date.now()).toLocaleString()}
                    </span>
                  </td>

                  <td className="p-3.5">
                    <strong className="block text-[#241311]">{w.itemName}</strong>
                  </td>

                  <td className="p-3.5 text-center font-bold text-gray-700 capitalize">
                    {w.locationId || (w as any).branchId}
                  </td>

                  <td className="p-3.5 text-center">
                    <span className="px-2 py-0.5 bg-red-50 text-red-800 border border-red-200 rounded text-[10px] font-titan uppercase">
                      {((w as any).reasonCategory || (w as any).reasonCode || 'spoilage').replace('_', ' ')}
                    </span>
                  </td>

                  <td className="p-3.5 text-right font-titan text-red-600">
                    {(w as any).quantityLost ?? (w as any).quantity ?? 0} {w.unit}
                  </td>

                  <td className="p-3.5 text-right font-titan text-red-700">
                    {formatNaira(w.totalLossValue || 0)}
                  </td>

                  <td className="p-3.5">
                    <strong className="block text-gray-800 text-[11px]">{(w as any).reportedByName || (w as any).loggedByName || 'Kitchen Lead'}</strong>
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
