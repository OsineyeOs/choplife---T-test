import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Plus,
  ShoppingBag,
  Download,
  Check,
  Truck,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Supplier, PurchaseOrder, GoodsReceiptNote, InventoryItem } from '../../../types';

export interface InventoryPurchasingTabProps {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  grnList: GoodsReceiptNote[];
  inventoryItems?: InventoryItem[];
  formatNaira: (amount: number) => string;
  setIsNewPOOpen: (v: boolean) => void;
  setIsNewGRNOpen: (v: boolean) => void;
}

export const InventoryPurchasingTab: React.FC<InventoryPurchasingTabProps> = ({
  purchaseOrders = [],
  grnList = [],
  formatNaira,
  setIsNewPOOpen,
  setIsNewGRNOpen,
}) => {
  const [marketLists, setMarketLists] = useState<any[]>([]);
  const [loadingMkt, setLoadingMkt] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('choplife_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchMarketLists = async () => {
    setLoadingMkt(true);
    try {
      const res = await fetch('/api/inventory/market-lists', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMarketLists(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load market lists:', err);
    } finally {
      setLoadingMkt(false);
    }
  };

  useEffect(() => {
    fetchMarketLists();
  }, []);

  const handleGenerateLowStockMarketList = async () => {
    try {
      const res = await fetch('/api/inventory/market-lists/low-stock-suggestions?branchId=gra', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) return;
      const suggestions = await res.json();
      const lines =
        Array.isArray(suggestions) && suggestions.length > 0
          ? suggestions
          : [
              {
                itemId: 'ing-beef',
                sku: 'SKU-PRO-001',
                itemName: 'Fresh Beef (Boneless)',
                category: 'proteins',
                unit: 'kg',
                requestedQty: 25,
                estimatedUnitCost: 5200,
                supplierName: 'Benin Abattoir Prime',
              },
            ];

      const createRes = await fetch('/api/inventory/market-lists', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          title: `Low-Stock Auto Market List (${new Date().toLocaleDateString('en-GB')})`,
          branchId: 'gra',
          status: 'submitted',
          lines,
        }),
      });
      if (createRes.ok) {
        setStatusMessage('Market list generated from low-stock items and submitted for approval.');
        fetchMarketLists();
      }
    } catch (err) {
      console.error('Error generating low-stock market list:', err);
    }
  };

  const handleTransitionMarketList = async (id: string, targetStatus: string) => {
    try {
      const res = await fetch(`/api/inventory/market-lists/${id}/transition`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ targetStatus }),
      });
      if (res.ok) {
        setStatusMessage(
          targetStatus === 'received'
            ? 'Market list received into inventory and stock ledger updated automatically.'
            : `Market list transitioned to ${targetStatus.toUpperCase()}.`
        );
        fetchMarketLists();
      }
    } catch (err) {
      console.error('Failed to transition market list:', err);
    }
  };

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="bg-emerald-900 text-emerald-100 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between"
        >
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-300 hover:text-white ml-3">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-[#4D080F]" />
            Market Lists, Purchase Orders & Goods Receipt Notes (GRN)
          </h3>
          <p className="text-xs text-gray-500 font-montserrat">
            Create market lists from low-stock items or Excel templates, approve purchases, and receive goods into stock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/import/templates/market_list?format=xls"
            download="choplife_market_list_template.xls"
            className="px-3 py-2 bg-[#FAF7F2] hover:bg-stone-200 text-[#4D080F] border border-[#E5DEC9] rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Market List Template
          </a>
          <a
            href="/api/import/templates/stock_update?format=xls"
            download="choplife_stock_count_update_template.xls"
            className="px-3 py-2 bg-[#FAF7F2] hover:bg-stone-200 text-[#4D080F] border border-[#E5DEC9] rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Stock Count Template
          </a>
          <button
            onClick={handleGenerateLowStockMarketList}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-[#4D080F] rounded-xl text-xs font-titan uppercase flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            Generate Market List
          </button>
          <button
            onClick={() => setIsNewPOOpen(true)}
            className="px-3.5 py-2 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] rounded-xl text-xs font-titan uppercase flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Purchase Order
          </button>
          <button
            onClick={() => setIsNewGRNOpen(true)}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-titan uppercase flex items-center gap-1.5 shadow-xs"
          >
            <FileCheck className="w-4 h-4" />
            Receive Delivery (GRN)
          </button>
        </div>
      </div>

      {/* Market Lists Workflow Section */}
      <div className="bg-white rounded-3xl p-5 border border-[#E5DEC9] space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-2">
          <h4 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-[#4D080F]" />
            Market Lists & Open-Market Procurement ({marketLists.length})
          </h4>
          <button
            onClick={fetchMarketLists}
            className="text-xs font-bold text-stone-600 hover:text-[#4D080F] flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMkt ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {marketLists.length === 0 ? (
          <div className="p-6 text-center text-xs text-stone-500 bg-[#FAF7F2] rounded-2xl border border-[#E5DEC9]">
            No active market lists yet. Click <strong>Generate Market List</strong> to build one from low-stock items or upload via the Market List Excel template.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {marketLists.map((mkt) => (
              <div key={mkt.id} className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E5DEC9] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="font-mono text-xs text-[#4D080F]">{mkt.listNumber}</strong>
                    <span className="ml-2 text-xs font-bold text-stone-800">{mkt.title}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold uppercase rounded-md">
                    {mkt.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>
                    {mkt.lines?.length || 0} items • Branch: <strong className="uppercase">{mkt.branchId}</strong>
                  </span>
                  <strong className="font-titan text-[#4D080F]">
                    Est: {formatNaira(mkt.totalEstimatedAmount || 0)}
                  </strong>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {mkt.status === 'draft' && (
                    <button
                      onClick={() => handleTransitionMarketList(mkt.id, 'submitted')}
                      className="px-2.5 py-1 rounded-lg bg-blue-700 text-white text-[11px] font-bold"
                    >
                      Submit for Approval
                    </button>
                  )}
                  {mkt.status === 'submitted' && (
                    <button
                      onClick={() => handleTransitionMarketList(mkt.id, 'approved')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Approve List
                    </button>
                  )}
                  {mkt.status === 'approved' && (
                    <button
                      onClick={() => handleTransitionMarketList(mkt.id, 'purchased')}
                      className="px-2.5 py-1 rounded-lg bg-indigo-700 text-white text-[11px] font-bold"
                    >
                      Mark Purchased
                    </button>
                  )}
                  {(mkt.status === 'approved' || mkt.status === 'purchased') && (
                    <button
                      onClick={() => handleTransitionMarketList(mkt.id, 'received')}
                      className="px-2.5 py-1 rounded-lg bg-[#4D080F] text-[#FFC700] text-[11px] font-bold flex items-center gap-1"
                    >
                      <Truck className="w-3 h-3" />
                      Receive Goods into Stock
                    </button>
                  )}
                  {mkt.status === 'received' && (
                    <button
                      onClick={() => handleTransitionMarketList(mkt.id, 'reconciled')}
                      className="px-2.5 py-1 rounded-lg bg-purple-800 text-white text-[11px] font-bold"
                    >
                      Reconcile Variance
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Purchase Orders List */}
        <div className="bg-white rounded-3xl p-5 border border-[#E5DEC9] space-y-3 shadow-2xs">
          <h4 className="font-titan text-sm text-[#4D080F] uppercase border-b pb-2">
            Active Purchase Orders ({purchaseOrders.length})
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {purchaseOrders.map((po) => (
              <div key={po.id} className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E5DEC9] space-y-1">
                <div className="flex justify-between items-center">
                  <strong className="font-mono text-xs text-[#4D080F]">{po.poNumber}</strong>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-titan uppercase rounded">
                    {po.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-gray-700 flex justify-between">
                  <span>Supplier: {po.supplierName}</span>
                  <strong className="font-titan text-[#E62E00]">{formatNaira(po.totalAmount)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Goods Receipt Notes List */}
        <div className="bg-white rounded-3xl p-5 border border-[#E5DEC9] space-y-3 shadow-2xs">
          <h4 className="font-titan text-sm text-[#4D080F] uppercase border-b pb-2">
            Goods Receipt Notes / Invoices ({grnList.length})
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {grnList.map((grn) => (
              <div key={grn.id} className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E5DEC9] space-y-1">
                <div className="flex justify-between items-center">
                  <strong className="font-mono text-xs text-emerald-800">{grn.grnNumber}</strong>
                  <span className="text-[10px] text-gray-500 font-mono">Inv: {grn.supplierInvoiceNumber}</span>
                </div>
                <div className="text-xs text-gray-700 flex justify-between">
                  <span>
                    Received at: <strong className="uppercase">{grn.receivingLocation}</strong>
                  </span>
                  <strong className="font-titan text-emerald-700">
                    {formatNaira((grn as any).totalAcceptedValue || (grn as any).actualAcceptedValue || 0)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
