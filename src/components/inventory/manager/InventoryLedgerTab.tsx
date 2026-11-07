import React from 'react';
import { History } from 'lucide-react';
import { StockLedgerTransaction, InventoryItem } from '../../../types';

export interface InventoryLedgerTabProps {
  ledgerTransactions: StockLedgerTransaction[];
  inventoryItems?: InventoryItem[];
  activeLocationFilter?: string;
  formatNaira?: (amount: number) => string;
  fetchAllData?: () => void;
  isLoading?: boolean;
  getLocationName?: (locId: string) => string;
}

export const InventoryLedgerTab: React.FC<InventoryLedgerTabProps> = ({
  ledgerTransactions = [],
  formatNaira = (amt: number) => `₦${amt.toLocaleString()}`,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] flex items-center justify-between">
        <div>
          <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-1.5">
            <History className="w-4 h-4 text-[#4D080F]" />
            Perpetual Stock Ledger Movements ({ledgerTransactions.length} entries)
          </h3>
          <p className="text-xs text-gray-500 font-montserrat">
            Immutable audit ledger tracking purchases, transfers, wastage, recipe depletions & adjustments.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5DEC9] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-montserrat">
            <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
              <tr>
                <th className="p-3.5">Ref # / Timestamp</th>
                <th className="p-3.5">Item / SKU</th>
                <th className="p-3.5 text-center">Location</th>
                <th className="p-3.5 text-center">Transaction Type</th>
                <th className="p-3.5 text-right">Quantity Delta</th>
                <th className="p-3.5 text-right">Balance After</th>
                <th className="p-3.5 text-right">Total Value</th>
                <th className="p-3.5">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DEC9]">
              {ledgerTransactions.map((tx) => {
                const isPositive = tx.quantityDelta > 0;
                return (
                  <tr key={tx.id} className="hover:bg-[#FFF8E7]/40 transition-colors">
                    <td className="p-3.5">
                      <strong className="block text-[#4D080F] font-mono">{tx.referenceNo}</strong>
                      <span className="text-[10px] text-gray-500">
                        {new Date(tx.timestamp).toLocaleString()}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <strong className="block text-[#241311]">{tx.itemName}</strong>
                      <span className="text-[10px] font-mono text-gray-500">{tx.sku}</span>
                    </td>

                    <td className="p-3.5 text-center font-bold text-gray-700 capitalize">
                      {tx.locationId}
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-[10px] font-titan uppercase">
                        {tx.transactionType.replace('_', ' ')}
                      </span>
                    </td>

                    <td
                      className={`p-3.5 text-right font-titan text-sm ${
                        isPositive ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {isPositive ? `+${tx.quantityDelta}` : tx.quantityDelta} {tx.unit}
                    </td>

                    <td className="p-3.5 text-right font-bold text-[#4D080F]">
                      {tx.balanceAfter} {tx.unit}
                    </td>

                    <td className="p-3.5 text-right font-mono text-gray-700">
                      {formatNaira(tx.totalValue || 0)}
                    </td>

                    <td className="p-3.5">
                      <strong className="block text-gray-800 text-[11px]">
                        {tx.performedByName}
                      </strong>
                      <span className="text-[10px] text-gray-500 capitalize">
                        {tx.performedByRole}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
