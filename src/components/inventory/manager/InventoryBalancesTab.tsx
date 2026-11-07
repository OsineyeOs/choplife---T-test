import React from 'react';
import { Search, Plus, Edit, History, Trash2 } from 'lucide-react';
import { InventoryItem } from '../../../types';

export interface InventoryBalancesTabProps {
  filteredInventoryItems: InventoryItem[];
  inventoryItems: InventoryItem[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  statusFilter: 'all' | 'active' | 'archived';
  setStatusFilter: (v: 'all' | 'active' | 'archived') => void;
  originFilter: 'all' | 'operational' | 'demo';
  setOriginFilter: (v: 'all' | 'operational' | 'demo') => void;
  stockLevelFilter: 'all' | 'low_stock' | 'out_of_stock' | 'in_stock';
  setStockLevelFilter: (v: 'all' | 'low_stock' | 'out_of_stock' | 'in_stock') => void;
  activeLocationFilter: string;
  formatNaira: (v: number) => string;
  setIsAddItemOpen: (v: boolean) => void;
  handleOpenEditItem: (item: InventoryItem) => void;
  handleViewItemLedger: (item: InventoryItem) => void;
  handleOpenDeleteModal: (item: InventoryItem) => void;
  setIsQuickAdjustOpen: (item: InventoryItem | null) => void;
}

export const InventoryBalancesTab: React.FC<InventoryBalancesTabProps> = ({
  filteredInventoryItems,
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  originFilter,
  setOriginFilter,
  stockLevelFilter,
  setStockLevelFilter,
  formatNaira,
  setIsAddItemOpen,
  handleOpenEditItem,
  handleViewItemLedger,
  handleOpenDeleteModal,
  setIsQuickAdjustOpen,
}) => {
  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-[#E5DEC9]">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search item, SKU, barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl pl-9 pr-3 py-2 text-xs font-montserrat text-[#241311] focus:outline-none focus:border-[#4D080F]"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs font-montserrat font-bold text-[#4D080F] focus:outline-none focus:border-[#4D080F]"
            >
              <option value="all">All Categories</option>
              <option value="proteins">Proteins</option>
              <option value="ingredients">Raw Ingredients</option>
              <option value="bakery">Bakery & Flour</option>
              <option value="beverages">Beverages</option>
              <option value="packaging">Packaging</option>
              <option value="cleaning">Cleaning</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs font-montserrat font-bold text-[#4D080F] focus:outline-none focus:border-[#4D080F]"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="archived">Archived / Retired</option>
            </select>

            {/* Origin Filter */}
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as any)}
              className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs font-montserrat font-bold text-[#4D080F] focus:outline-none focus:border-[#4D080F]"
            >
              <option value="all">All Origins</option>
              <option value="operational">Operational Only</option>
              <option value="demo">Demo Catalog</option>
            </select>

            {/* Stock Level Filter */}
            <select
              value={stockLevelFilter}
              onChange={(e) => setStockLevelFilter(e.target.value as any)}
              className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs font-montserrat font-bold text-[#4D080F] focus:outline-none focus:border-[#4D080F]"
            >
              <option value="all">All Stock Levels</option>
              <option value="low_stock">Low Stock (At/Below Par)</option>
              <option value="out_of_stock">Out of Stock (86)</option>
              <option value="in_stock">Healthy In-Stock</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => setIsAddItemOpen(true)}
              className="px-4 py-2 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] rounded-xl text-xs font-titan uppercase flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Stock Item
            </button>
          </div>
        </div>
      </div>

      {/* Master Inventory Items Grid / Table */}
      <div className="bg-white rounded-3xl border border-[#E5DEC9] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-montserrat">
            <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
              <tr>
                <th className="p-3.5">Master Item / SKU</th>
                <th className="p-3.5 text-center">Category</th>
                <th className="p-3.5 text-center">Base Unit</th>
                <th className="p-3.5 text-right">Unit Cost</th>
                <th className="p-3.5 text-center">General Store</th>
                <th className="p-3.5 text-center">GRA</th>
                <th className="p-3.5 text-center">Okabere</th>
                <th className="p-3.5 text-center">Ugbowo</th>
                <th className="p-3.5 text-right">Total Stock</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DEC9]">
              {filteredInventoryItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-500 font-montserrat">
                    No inventory items found matching search filters.
                  </td>
                </tr>
              ) : (
                filteredInventoryItems.map((item) => {
                  const isDemo = item.isDemo === true || item.dataOrigin === 'demo';
                  const genStock = item.locationStock?.general_store?.stockOnHand ?? item.currentStock?.general_store ?? 0;
                  const graStock = item.locationStock?.gra?.stockOnHand ?? item.currentStock?.gra ?? 0;
                  const okaStock = item.locationStock?.okabere?.stockOnHand ?? item.currentStock?.okabere ?? 0;
                  const ugbStock = item.locationStock?.ugbowo?.stockOnHand ?? item.currentStock?.ugbowo ?? 0;
                  const totalStock = genStock + graStock + okaStock + ugbStock;
                  const minThresh = item.locationStock?.gra?.minThreshold ?? (typeof item.minThreshold === 'number' ? item.minThreshold : item.minThreshold?.gra ?? 10);

                  let statusBadge = (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-titan uppercase">
                      In Stock
                    </span>
                  );
                  if (item.isArchived || item.isActive === false) {
                    statusBadge = (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-titan uppercase">
                        Archived
                      </span>
                    );
                  } else if (totalStock <= 0) {
                    statusBadge = (
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-titan uppercase">
                        Out of Stock (86)
                      </span>
                    );
                  } else if (totalStock <= minThresh) {
                    statusBadge = (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-titan uppercase">
                        Low Stock
                      </span>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-[#FFF8E7]/40 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          {isDemo && (
                            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 text-[9px] font-titan rounded uppercase">
                              Demo
                            </span>
                          )}
                          <div>
                            <strong className="block text-[#241311] font-bold">{item.name}</strong>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {item.sku} {item.barcode ? `| ${item.barcode}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        <span className="capitalize font-semibold text-gray-700">{item.category}</span>
                      </td>

                      <td className="p-3.5 text-center font-bold text-[#4D080F]">{item.unit || item.baseUnit}</td>

                      <td className="p-3.5 text-right font-mono text-gray-700">{formatNaira(item.costPerUnit || 0)}</td>

                      <td className="p-3.5 text-center font-semibold text-gray-700">{genStock}</td>
                      <td className="p-3.5 text-center font-semibold text-gray-700">{graStock}</td>
                      <td className="p-3.5 text-center font-semibold text-gray-700">{okaStock}</td>
                      <td className="p-3.5 text-center font-semibold text-gray-700">{ugbStock}</td>

                      <td className="p-3.5 text-right font-titan text-base text-[#4D080F]">{totalStock}</td>

                      <td className="p-3.5 text-center">{statusBadge}</td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setIsQuickAdjustOpen(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Quick Adjust Stock Level"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleViewItemLedger(item)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Movement Ledger"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Item Details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(item)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete or Archive Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
