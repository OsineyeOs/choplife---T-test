import React from 'react';
import { BarChart3 } from 'lucide-react';
import { InventoryItem } from '../../../types';

export interface InventoryAnalyticsTabProps {
  varianceData: any[];
  inventoryItems?: InventoryItem[];
  activeLocationFilter?: string;
  formatNaira: (amount: number) => string;
}

export const InventoryAnalyticsTab: React.FC<InventoryAnalyticsTabProps> = ({
  varianceData = [],
  activeLocationFilter = 'gra',
  formatNaira,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-emerald-700" />
            Actual vs. Theoretical Variance Analytics
          </h3>
          <p className="text-xs text-gray-500 font-montserrat">
            Formula: Opening + Receipts + Transfers In - Transfers Out - Wastage - POS Recipe Theoretical Consumption vs Physical Count.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#4D080F]">Analyzing Branch:</span>
          <span className="bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-montserrat font-bold rounded-xl px-3 py-1.5 text-[#4D080F] uppercase">
            {activeLocationFilter}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5DEC9] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-montserrat">
            <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
              <tr>
                <th className="p-3.5">Raw Material</th>
                <th className="p-3.5 text-center">Opening</th>
                <th className="p-3.5 text-center">Receipts / In</th>
                <th className="p-3.5 text-center">Theo. POS Sold</th>
                <th className="p-3.5 text-center">Wastage</th>
                <th className="p-3.5 text-center">Expected Close</th>
                <th className="p-3.5 text-center">Actual Physical</th>
                <th className="p-3.5 text-right">Variance Value</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DEC9]">
              {varianceData.map((v, idx) => (
                <tr key={idx} className="hover:bg-[#FFF8E7]/40 transition-colors">
                  <td className="p-3.5">
                    <strong className="block text-[#241311]">{v.itemName}</strong>
                    <span className="text-[10px] font-mono text-gray-500">{v.sku}</span>
                  </td>

                  <td className="p-3.5 text-center text-gray-600">{v.openingStock}</td>
                  <td className="p-3.5 text-center text-emerald-700 font-bold">+{v.purchasesReceipts + v.transfersIn}</td>
                  <td className="p-3.5 text-center text-purple-700">-{v.theoreticalPOSConsumption}</td>
                  <td className="p-3.5 text-center text-red-600">-{v.wastageLogged}</td>
                  <td className="p-3.5 text-center font-bold text-[#4D080F]">{v.expectedClosingStock}</td>
                  <td className="p-3.5 text-center font-titan text-blue-700">{v.actualPhysicalStock}</td>

                  <td className="p-3.5 text-right font-titan">
                    <span className={v.costVarianceNaira < 0 ? 'text-red-600' : 'text-emerald-700'}>
                      {formatNaira(v.costVarianceNaira)}
                    </span>
                  </td>

                  <td className="p-3.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-titan uppercase ${
                        v.status === 'healthy'
                          ? 'bg-emerald-100 text-emerald-800'
                          : v.status === 'investigate'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {v.status?.replace('_', ' ') || 'healthy'}
                    </span>
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
