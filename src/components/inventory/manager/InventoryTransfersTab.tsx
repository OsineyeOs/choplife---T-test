import React from 'react';
import { Truck, Plus, ArrowRight } from 'lucide-react';
import { StockRequest, InventoryItem } from '../../../types';

export interface InventoryTransfersTabProps {
  stockRequests: StockRequest[];
  inventoryItems?: InventoryItem[];
  activeLocationFilter?: string;
  formatNaira?: (amount: number) => string;
  setIsNewRequestOpen: (v: boolean) => void;
  handleReviewRequest: (id: string, status: 'approved' | 'rejected') => void;
  handleDispatchTransfer?: (id: string) => void;
  handleReceiveTransfer?: (id: string) => void;
  getLocationName?: (locId: string) => string;
}

export const InventoryTransfersTab: React.FC<InventoryTransfersTabProps> = ({
  stockRequests = [],
  setIsNewRequestOpen,
  handleReviewRequest,
  handleDispatchTransfer,
  handleReceiveTransfer,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-[#4D080F]" />
            Commissary Indents & Branch Transfer Indents
          </h3>
          <p className="text-xs text-gray-500 font-montserrat">
            Request stock from General Store commissary, dispatch in-transit shipments & reconcile physical receipts.
          </p>
        </div>

        <button
          onClick={() => setIsNewRequestOpen(true)}
          className="px-4 py-2 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] rounded-xl text-xs font-titan uppercase flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          New Transfer Indent
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5DEC9] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-montserrat">
            <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
              <tr>
                <th className="p-3.5">Indent # / Date</th>
                <th className="p-3.5">Source → Destination</th>
                <th className="p-3.5">Items Requested</th>
                <th className="p-3.5 text-center">Priority</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DEC9]">
              {stockRequests.map((req) => (
                <tr key={req.id} className="hover:bg-[#FFF8E7]/40 transition-colors">
                  <td className="p-3.5">
                    <strong className="block text-[#4D080F] font-mono">{req.requestNumber}</strong>
                    <span className="text-[10px] text-gray-500">
                      {new Date(req.requestedAt).toLocaleDateString()} by {req.requestedByName}
                    </span>
                  </td>

                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                      <span className="uppercase">{req.sourceLocation}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#E62E00]" />
                      <span className="uppercase text-[#4D080F]">{req.destinationLocation}</span>
                    </div>
                  </td>

                  <td className="p-3.5">
                    <div className="space-y-0.5">
                      {req.items.map((it, idx) => (
                        <div key={idx} className="text-gray-700">
                          • <strong>{it.itemName}</strong>: {it.requestedQty} {it.unit}
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="p-3.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-titan uppercase ${
                        req.priority === 'urgent'
                          ? 'bg-red-100 text-red-800 animate-pulse'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {req.priority}
                    </span>
                  </td>

                  <td className="p-3.5 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-titan uppercase ${
                        (req.status as string) === 'requested' || (req.status as string) === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : req.status === 'approved'
                          ? 'bg-blue-100 text-blue-800'
                          : req.status === 'in_transit' || (req.status as string) === 'dispatched'
                          ? 'bg-purple-100 text-purple-800'
                          : req.status === 'received' || req.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {req.status.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {((req.status as string) === 'requested' || (req.status as string) === 'pending') && (
                        <button
                          onClick={() => handleReviewRequest(req.id, 'approved')}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-titan uppercase"
                        >
                          Approve
                        </button>
                      )}
                      {req.status === 'approved' && handleDispatchTransfer && (
                        <button
                          onClick={() => handleDispatchTransfer(req.id)}
                          className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[10px] font-titan uppercase"
                        >
                          Dispatch
                        </button>
                      )}
                      {(req.status === 'in_transit' || (req.status as string) === 'dispatched') && handleReceiveTransfer && (
                        <button
                          onClick={() => handleReceiveTransfer(req.id)}
                          className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-[10px] font-titan uppercase"
                        >
                          Receive
                        </button>
                      )}
                    </div>
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
