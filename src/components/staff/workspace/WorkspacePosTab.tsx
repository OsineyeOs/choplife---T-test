import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Minus, UtensilsCrossed, Receipt, Tag, Split, MoveRight, ChefHat, CreditCard, ShoppingBag, Bike, X } from 'lucide-react';
import { MENU_CATEGORIES } from '../../../data/menu';
import { Product, BranchId } from '../../../types';

interface WorkspacePosTabProps {
  mobilePosView: 'catalog' | 'check';
  setMobilePosView: (v: 'catalog' | 'check') => void;
  filteredProducts: Product[];
  posSearch: string;
  setPosSearch: (v: string) => void;
  posCategory: string;
  setPosCategory: (v: string) => void;
  activeBranchId: BranchId;
  getProductPrice: (p: Product, b: BranchId) => number;
  isProductAvailable: (id: string, b: BranchId) => boolean;
  handleAddItemToCheck: (p: Product) => void;
  handleOpenNewCheck: (
    tableName?: string,
    checkType?: 'dine_in' | 'takeaway' | 'delivery',
    extra?: {
      tableId?: string;
      customerName?: string;
      customerPhone?: string;
      deliveryAddress?: string;
      deliveryZone?: string;
      deliveryFee?: number;
      riderId?: string;
      riderName?: string;
      guestCount?: number;
    }
  ) => void;
  tables: any[];
  activeCheck: any;
  checks: any[];
  setActiveCheck: (chk: any) => void;
  handleUpdateItemQty: (itemId: string, delta: number, exactQty?: number) => void;
  setIsDiscountModalOpen: (v: boolean) => void;
  setIsSplitBillModalOpen: (v: boolean) => void;
  setIsTableTransferModalOpen: (v: boolean) => void;
  handleSendToKitchen: () => void;
  setIsPaymentModalOpen: (v: boolean) => void;
}

export const WorkspacePosTab: React.FC<WorkspacePosTabProps> = ({
  mobilePosView,
  setMobilePosView,
  filteredProducts,
  posSearch,
  setPosSearch,
  posCategory,
  setPosCategory,
  activeBranchId,
  getProductPrice,
  isProductAvailable,
  handleAddItemToCheck,
  handleOpenNewCheck,
  tables,
  activeCheck,
  checks,
  setActiveCheck,
  handleUpdateItemQty,
  setIsDiscountModalOpen,
  setIsSplitBillModalOpen,
  setIsTableTransferModalOpen,
  handleSendToKitchen,
  setIsPaymentModalOpen,
}) => {
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [expandedCheckItemIds, setExpandedCheckItemIds] = useState<Record<string, boolean>>({});
  const checkItemsScrollRef = useRef<HTMLDivElement | null>(null);
  const prevCheckItemsLenRef = useRef<number>(activeCheck?.items?.length || 0);
  const prevCheckIdRef = useRef<string | undefined>(activeCheck?.id);

  useEffect(() => {
    const currentLen = activeCheck?.items?.length || 0;
    const isSameCheck = activeCheck?.id && activeCheck.id === prevCheckIdRef.current;
    if (isSameCheck && currentLen > prevCheckItemsLenRef.current && checkItemsScrollRef.current) {
      checkItemsScrollRef.current.scrollTo({
        top: checkItemsScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
    prevCheckItemsLenRef.current = currentLen;
    prevCheckIdRef.current = activeCheck?.id;
  }, [activeCheck?.id, activeCheck?.items?.length]);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);
  const [selectedOrderType, setSelectedOrderType] = useState<'dine_in' | 'takeaway' | 'delivery' | ''>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>('');
  const [newDeliveryAddress, setNewDeliveryAddress] = useState<string>('');
  const [newDeliveryZone, setNewDeliveryZone] = useState<string>('GRA Benin / Boundary Rd');
  const [newDeliveryFee, setNewDeliveryFee] = useState<number>(1200);
  const [newGuestCount, setNewGuestCount] = useState<number>(1);

  const openOrderTypeModal = () => {
    setSelectedOrderType('');
    const firstAvail = tables.find((t) => t.status === 'available');
    setSelectedTableId(firstAvail?.id || '');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewDeliveryAddress('');
    setNewDeliveryZone('GRA Benin / Boundary Rd');
    setNewDeliveryFee(1200);
    setNewGuestCount(1);
    setIsNewOrderModalOpen(true);
  };

  const handleConfirmNewOrder = () => {
    if (!selectedOrderType) return;
    if (selectedOrderType === 'dine_in') {
      const tbl = tables.find((t) => t.id === selectedTableId);
      if (!tbl || tbl.status !== 'available') return;
      const tblLabel = String(tbl.tableNumber).toLowerCase().startsWith('table')
        ? tbl.tableNumber
        : `Table ${tbl.tableNumber}`;
      handleOpenNewCheck(tblLabel, 'dine_in', {
        tableId: tbl.id,
        customerName: newCustomerName.trim() || `Dine-In (${tblLabel})`,
        customerPhone: newCustomerPhone.trim() || undefined,
        guestCount: newGuestCount,
      });
    } else if (selectedOrderType === 'takeaway') {
      handleOpenNewCheck(undefined, 'takeaway', {
        customerName: newCustomerName.trim() || 'Takeout Customer',
        customerPhone: newCustomerPhone.trim() || undefined,
        guestCount: 1,
      });
    } else if (selectedOrderType === 'delivery') {
      handleOpenNewCheck(undefined, 'delivery', {
        customerName: newCustomerName.trim() || 'Delivery Customer',
        customerPhone: newCustomerPhone.trim() || undefined,
        deliveryAddress: newDeliveryAddress.trim() || 'Customer Delivery Address',
        deliveryZone: newDeliveryZone,
        deliveryFee: newDeliveryFee,
        guestCount: 1,
      });
    }
    setIsNewOrderModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative bg-[#FAF7F2]">
      {/* Mobile View Toggle Bar */}
      <div className="md:hidden flex items-center justify-between p-2 bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl w-full">
          <button
            onClick={() => setMobilePosView('catalog')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mobilePosView === 'catalog'
                ? 'bg-[#800D15] text-[#FFC700] shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>🍽️ Catalog</span>
            <span className="text-[10px] opacity-80">({filteredProducts.length})</span>
          </button>
          <button
            onClick={() => setMobilePosView('check')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mobilePosView === 'check'
                ? 'bg-[#800D15] text-[#FFC700] shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>🧾 Current Check</span>
            {activeCheck && (
              <span className="px-1.5 py-0.2 bg-[#FFC700] text-[#4D080F] rounded text-[10px] font-black">
                {activeCheck.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Product Catalog & Category Filter Panel */}
      <div
        className={`flex-1 flex flex-col overflow-hidden border-r border-stone-200 bg-[#FAF7F2] ${
          mobilePosView === 'check' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Search & Categories Bar */}
        <div className="p-3 bg-white border-b border-stone-200 space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search menu items, combos, bread, small chops..."
                value={posSearch}
                onChange={(e) => setPosSearch(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#800D15]"
              />
            </div>
            <button
              onClick={openOrderTypeModal}
              className="px-3.5 py-2 bg-[#800D15] hover:bg-[#680A10] text-[#FFC700] text-xs font-black rounded-xl flex items-center gap-1.5 shrink-0 border border-[#FFC700]/40 transition-all shadow-xs active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#FFC700]" /> New Check
            </button>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setPosCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                posCategory === 'all'
                  ? 'bg-[#800D15] text-[#FFC700] shadow-2xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              All Items
            </button>
            {MENU_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setPosCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  posCategory === cat.id
                    ? 'bg-[#800D15] text-[#FFC700] shadow-2xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3.5 grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2.5 sm:gap-3 content-start">
          {filteredProducts.map((p) => {
            const price = getProductPrice(p, activeBranchId);
            const isAvailable = isProductAvailable(p.id, activeBranchId);
            return (
              <button
                key={p.id}
                onClick={() => isAvailable && handleAddItemToCheck(p)}
                disabled={!isAvailable}
                className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all group active:scale-[0.98] shadow-2xs min-w-0 ${
                  isAvailable
                    ? 'bg-white border-stone-200/90 hover:border-[#800D15]/50 hover:shadow-md cursor-pointer'
                    : 'bg-stone-100 border-stone-200 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-stone-100 mb-2 relative shrink-0 border border-stone-200/60">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-full h-full ${
                      p.image ? 'hidden' : 'flex'
                    } flex-col items-center justify-center bg-amber-50/80 border border-amber-200/60 p-1 text-center`}
                  >
                    <span className="text-xs font-black text-[#800D15] tracking-widest uppercase">
                      {p.name.split(' ').map((w) => w[0]).join('').slice(0, 3)}
                    </span>
                    <span className="text-[8px] font-bold text-amber-800 uppercase tracking-tighter mt-0.5">
                      NO PHOTO
                    </span>
                  </div>
                  {!isAvailable && (
                    <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="text-[10px] text-white font-black uppercase px-2 py-0.5 rounded bg-red-600 shadow-2xs">
                        Sold Out
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1 w-full flex-1 min-w-0">
                  <span className="font-extrabold text-xs text-stone-900 line-clamp-2 leading-snug group-hover:text-[#800D15] block">
                    {p.name}
                  </span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(p.productType === 'package' || (Array.isArray(p.components) && p.components.length > 0)) && (
                      <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 text-[8px] font-black uppercase">
                        PACK
                      </span>
                    )}
                    {p.wholesalePricing?.enabled && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[8px] font-black uppercase">
                        WS {p.wholesalePricing.minWholesaleQty}+ @ ₦{p.wholesalePricing.wholesalePrice}
                      </span>
                    )}
                    {p.discountConfig?.enabled && p.discountConfig.value > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 text-[8px] font-black uppercase">
                        {p.discountConfig.type === 'percentage'
                          ? `-${p.discountConfig.value}%`
                          : `-₦${p.discountConfig.value}`}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 line-clamp-1">{p.shortDescription}</p>
                </div>

                <div className="pt-2 mt-2 border-t border-stone-100 flex items-center justify-between w-full">
                  <span className="font-mono font-black text-xs text-[#800D15] tabular-nums">
                    ₦{price.toLocaleString()}
                  </span>
                  {isAvailable ? (
                    <span className="w-6 h-6 rounded-lg bg-[#800D15] text-[#FFC700] flex items-center justify-center text-xs font-black group-hover:scale-110 transition-transform shadow-2xs">
                      +
                    </span>
                  ) : (
                    <span className="text-[9px] text-red-600 font-bold uppercase">Sold Out</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Mobile Floating Check Bar */}
        {activeCheck && activeCheck.items.length > 0 && (
          <div className="md:hidden p-2 bg-white border-t border-stone-200 shrink-0 shadow-lg">
            <button
              onClick={() => setMobilePosView('check')}
              className="w-full py-2.5 px-4 bg-[#800D15] text-[#FFC700] font-black rounded-xl flex items-center justify-between shadow-md active:scale-95 transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="bg-[#FFC700] text-[#4D080F] text-xs font-black px-2 py-0.5 rounded-full">
                  {activeCheck.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0)}
                </span>
                <span className="text-xs uppercase tracking-wide">View Active Check</span>
              </div>
              <span className="font-mono font-extrabold text-sm tabular-nums">₦{activeCheck.total.toLocaleString()} &rarr;</span>
            </button>
          </div>
        )}
      </div>

      {/* Active Check Pane */}
      <div
        className={`w-full md:w-[300px] lg:w-[340px] xl:w-[380px] bg-white border-l border-stone-200 flex flex-col shrink-0 shadow-xs ${
          mobilePosView === 'catalog' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Active Check Header */}
        <div className="p-3.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobilePosView('catalog')}
              className="md:hidden px-2 py-1 bg-stone-200 text-stone-800 hover:bg-stone-300 rounded-lg text-xs font-bold transition-colors"
              title="Back to Catalog"
            >
              &larr; Menu
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-stone-900">
                  {activeCheck ? activeCheck.checkNumber : 'No Active Check'}
                </span>
                {activeCheck && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      activeCheck.status === 'open'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : activeCheck.status === 'partially_paid'
                        ? 'bg-orange-100 text-orange-800 border border-orange-300'
                        : activeCheck.status === 'sent_to_kitchen'
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {activeCheck.status.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 font-medium">
                {activeCheck?.tableNumber || 'Direct Takeaway'} &bull; Guest: {activeCheck?.guestCount || 1}
              </p>
            </div>
          </div>

          <select
            value={activeCheck?.id || ''}
            onChange={(e) => {
              const found = checks.find((c) => c.id === e.target.value);
              if (found) setActiveCheck(found);
            }}
            className="bg-white border border-stone-300 text-xs text-stone-900 font-bold rounded-xl px-2.5 py-1.5 max-w-[130px] truncate focus:outline-none focus:ring-2 focus:ring-[#800D15]"
          >
            <option value="">Switch Check</option>
            {checks
              .filter((c) => c.status === 'open' || c.status === 'sent_to_kitchen' || c.status === 'partially_paid')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.checkNumber} ({c.tableNumber || c.checkType}){c.status === 'partially_paid' ? ' [PARTIAL]' : ''}
                </option>
              ))}
          </select>
        </div>

        {/* Items in Current Check */}
        <div ref={checkItemsScrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-stone-50/50 scroll-smooth">
          {activeCheck && activeCheck.items.length > 0 ? (
            activeCheck.items.map((it: any) => (
              <div
                key={it.id}
                className="bg-white border border-stone-200 p-3 rounded-2xl flex items-start justify-between gap-2.5 shadow-2xs hover:border-[#800D15]/30 transition-all"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-extrabold text-stone-900 truncate">{it.name}</p>
                    {it.appliedTierLabel && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                          it.isPromoReward
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : it.isWholesaleApplied
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {it.appliedTierLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#800D15] font-mono font-bold tabular-nums">
                    {it.originalUnitPrice && it.originalUnitPrice > it.unitPrice && (
                      <span className="line-through text-stone-400 mr-1">
                        ₦{Number(it.originalUnitPrice).toLocaleString()}
                      </span>
                    )}
                    ₦{Number(it.unitPrice || 0).toLocaleString()} &times; {it.quantity} = ₦
                    {Number(it.totalPrice || 0).toLocaleString()}
                  </p>
                  {Array.isArray(it.compositionSnapshot) && it.compositionSnapshot.length > 0 && (
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCheckItemIds((prev) => ({ ...prev, [it.id]: !prev[it.id] }))
                        }
                        className="text-[10px] font-bold text-purple-800 hover:text-purple-950 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-md transition-colors"
                      >
                        {expandedCheckItemIds[it.id]
                          ? 'Hide Contents ▲'
                          : `Inspect Contents (${it.compositionSnapshot.length} items) ▼`}
                      </button>
                      {expandedCheckItemIds[it.id] && (
                        <div className="flex flex-wrap gap-1 pt-1.5">
                          {it.compositionSnapshot.map((comp: any, cIdx: number) => (
                            <span
                              key={cIdx}
                              className="px-1.5 py-0.2 rounded bg-purple-50 border border-purple-200 text-[9px] font-semibold text-purple-900"
                            >
                              {comp.quantity * it.quantity}&times; {comp.productName || comp.productId}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {it.status === 'sent_to_kitchen' && (
                    <span className="inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold uppercase tracking-wider">
                      In Kitchen
                    </span>
                  )}
                </div>

                {!it.isPromoReward && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setQtyDrafts((prev) => {
                          const next = { ...prev };
                          delete next[it.id];
                          return next;
                        });
                        handleUpdateItemQty(it.id, -1);
                      }}
                      className="w-7 h-7 rounded-xl bg-stone-100 hover:bg-[#800D15] hover:text-[#FFC700] text-stone-800 flex items-center justify-center text-xs transition-colors border border-stone-200"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      step={1}
                      aria-label={`Quantity for ${it.name}`}
                      value={qtyDrafts[it.id] !== undefined ? qtyDrafts[it.id] : String(it.quantity)}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        setQtyDrafts((prev) => ({ ...prev, [it.id]: rawVal }));
                      }}
                      onBlur={(e) => {
                        const rawVal = e.target.value.trim();
                        const parsed = parseInt(rawVal, 10);
                        setQtyDrafts((prev) => {
                          const next = { ...prev };
                          delete next[it.id];
                          return next;
                        });
                        if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 10000 && parsed !== it.quantity) {
                          handleUpdateItemQty(it.id, 0, parsed);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-11 h-7 rounded-lg bg-white border border-stone-300 text-center font-mono font-black text-xs text-stone-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#800D15]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setQtyDrafts((prev) => {
                          const next = { ...prev };
                          delete next[it.id];
                          return next;
                        });
                        handleUpdateItemQty(it.id, 1);
                      }}
                      className="w-7 h-7 rounded-xl bg-stone-100 hover:bg-[#800D15] hover:text-[#FFC700] text-stone-800 flex items-center justify-center text-xs transition-colors border border-stone-200"
                      title="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQtyDrafts((prev) => {
                          const next = { ...prev };
                          delete next[it.id];
                          return next;
                        });
                        handleUpdateItemQty(it.id, 0, 0);
                      }}
                      className="w-7 h-7 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white flex items-center justify-center text-xs transition-colors border border-rose-200"
                      title={`Remove ${it.name} from check`}
                      aria-label={`Remove ${it.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 p-6 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400">
                <Receipt className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-stone-800">
                {activeCheck ? 'Check is currently empty' : 'No Active POS Order Open'}
              </p>
              <p className="text-[11px] text-stone-500 max-w-xs">
                {activeCheck
                  ? 'Tap menu items on the left to add to this active order.'
                  : 'Select an Order Type (Dine-In, Takeout/Pickup, or Delivery) to begin a new POS check.'}
              </p>
              {!activeCheck && (
                <button
                  type="button"
                  onClick={openOrderTypeModal}
                  className="mt-1 px-4 py-2 bg-[#800D15] hover:bg-[#680A10] text-[#FFC700] text-xs font-black rounded-xl shadow-xs transition-all"
                >
                  + Start New Order (Choose Type)
                </button>
              )}
            </div>
          )}
        </div>

        {/* Check Summary & Operations Footer */}
        {activeCheck && (
          <div className="p-4 bg-white border-t border-stone-200 space-y-3 shadow-sm">
            {activeCheck.splitConfig && Array.isArray(activeCheck.splitConfig.shares) && (
              <div className="p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[#4D080F]">
                  <span>Split Shares ({activeCheck.splitConfig.shares.length} Ways)</span>
                  <button
                    type="button"
                    onClick={() => setIsSplitBillModalOpen(true)}
                    className="text-[#800D15] underline hover:no-underline"
                  >
                    Manage Shares
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeCheck.splitConfig.shares.map((sh: any) => (
                    <span
                      key={sh.shareId}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                        sh.status === 'paid' || sh.remainingAmount === 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}
                    >
                      {sh.label}: {sh.status === 'paid' ? 'PAID' : `₦${Number(sh.remainingAmount).toLocaleString()} DUE`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-xs text-stone-600 font-sans">
              {Number(activeCheck.itemLevelDiscountTotal || 0) > 0 && (
                <div className="flex justify-between items-center text-emerald-700 font-semibold">
                  <span>Package / Wholesale Savings</span>
                  <span className="font-mono font-bold tabular-nums">
                    -₦{Number(activeCheck.itemLevelDiscountTotal).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span>Subtotal</span>
                <span className="font-mono font-bold text-stone-900 tabular-nums">₦{activeCheck.subtotal.toLocaleString()}</span>
              </div>
              {activeCheck.discountAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-600 font-semibold">
                  <span>Order Discount ({activeCheck.discountPercent}%)</span>
                  <span className="font-mono font-bold tabular-nums">-₦{activeCheck.discountAmount.toLocaleString()}</span>
                </div>
              )}
              {Number(activeCheck.amountPaid || 0) > 0 && (
                <div className="flex justify-between items-center text-emerald-700 font-bold">
                  <span>Paid So Far ({activeCheck.payments?.length || 1} payment{(activeCheck.payments?.length || 1) > 1 ? 's' : ''})</span>
                  <span className="font-mono tabular-nums">-₦{Number(activeCheck.amountPaid).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center font-black text-base text-stone-900 pt-2 border-t border-stone-200">
                <span>{Number(activeCheck.amountPaid || 0) > 0 ? 'Remaining Due' : 'Total Due'}</span>
                <span className="font-mono text-xl text-[#800D15] tabular-nums">
                  ₦{Number(activeCheck.remainingBalance ?? activeCheck.total).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => setIsDiscountModalOpen(true)}
                className="px-2 py-2 bg-stone-100 hover:bg-stone-200 text-[11px] font-bold text-stone-800 rounded-xl border border-stone-200 flex items-center justify-center gap-1 transition-colors"
                title="Apply Discount"
              >
                <Tag className="w-3.5 h-3.5 text-[#800D15]" /> Disc.
              </button>

              <button
                onClick={() => setIsSplitBillModalOpen(true)}
                disabled={activeCheck.items.length === 0}
                className="px-2 py-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-[11px] font-bold text-stone-800 rounded-xl border border-stone-200 flex items-center justify-center gap-1 transition-colors"
                title="Split Check between guests"
              >
                <Split className="w-3.5 h-3.5 text-[#800D15]" /> Split
              </button>

              <button
                onClick={() => setIsTableTransferModalOpen(true)}
                disabled={!activeCheck.tableId}
                className="px-2 py-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-[11px] font-bold text-stone-800 rounded-xl border border-stone-200 flex items-center justify-center gap-1 transition-colors"
                title="Transfer Check to Another Table"
              >
                <MoveRight className="w-3.5 h-3.5 text-[#800D15]" /> Table
              </button>

              <button
                onClick={handleSendToKitchen}
                className="px-2 py-2 bg-blue-900 hover:bg-blue-800 text-[11px] font-bold text-white rounded-xl flex items-center justify-center gap-1 shadow-2xs transition-colors"
                title="Send un-fired items to KDS"
              >
                <ChefHat className="w-3.5 h-3.5 text-[#FFC700]" /> KDS
              </button>
            </div>

            <button
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={activeCheck.items.length === 0}
              className="w-full py-3 bg-[#800D15] hover:bg-[#680A10] disabled:opacity-50 text-[#FFC700] text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 border border-[#FFC700]/30"
            >
              <CreditCard className="w-4 h-4 text-[#FFC700]" />
              <span>
                {Number(activeCheck.amountPaid || 0) > 0
                  ? `Settle Remaining (₦${Number(activeCheck.remainingBalance ?? activeCheck.total).toLocaleString()})`
                  : `Settle & Pay (₦${activeCheck.total.toLocaleString()})`}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Mandatory New POS Order-Type & Table/Delivery Selection Modal */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-5 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-black text-[#4D080F]">Start New POS Order</h3>
                <p className="text-xs text-stone-500">
                  Step 1: Select the mandatory order type before adding menu items
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewOrderModalOpen(false)}
                className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mandatory Order Type Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedOrderType('dine_in')}
                className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col gap-1 ${
                  selectedOrderType === 'dine_in'
                    ? 'border-[#800D15] bg-[#800D15]/5 text-[#800D15]'
                    : 'border-stone-200 hover:border-stone-300 text-stone-700'
                }`}
              >
                <UtensilsCrossed className="w-5 h-5 text-[#800D15]" />
                <span className="font-black text-xs">Dine-In</span>
                <span className="text-[10px] text-stone-500">Select Available Table</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOrderType('takeaway')}
                className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col gap-1 ${
                  selectedOrderType === 'takeaway'
                    ? 'border-[#800D15] bg-[#800D15]/5 text-[#800D15]'
                    : 'border-stone-200 hover:border-stone-300 text-stone-700'
                }`}
              >
                <ShoppingBag className="w-5 h-5 text-[#800D15]" />
                <span className="font-black text-xs">Takeout / Pickup</span>
                <span className="text-[10px] text-stone-500">Counter Pickup</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOrderType('delivery')}
                className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col gap-1 ${
                  selectedOrderType === 'delivery'
                    ? 'border-[#800D15] bg-[#800D15]/5 text-[#800D15]'
                    : 'border-stone-200 hover:border-stone-300 text-stone-700'
                }`}
              >
                <Bike className="w-5 h-5 text-[#800D15]" />
                <span className="font-black text-xs">Delivery</span>
                <span className="text-[10px] text-stone-500">Rider Dispatch</span>
              </button>
            </div>

            {/* Dine-In Table Selection (Available Tables Only) */}
            {selectedOrderType === 'dine_in' && (
              <div className="space-y-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-stone-900">
                    Select Available Dining Table (Required)
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700">
                    {tables.filter((t) => t.status === 'available').length} Available / {tables.length} Total
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1">
                  {tables.map((t) => {
                    const isAvail = t.status === 'available';
                    const isSelected = selectedTableId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={!isAvail}
                        onClick={() => isAvail && setSelectedTableId(t.id)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                          !isAvail
                            ? 'bg-red-50/70 border-red-200 text-red-400 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#800D15] border-[#800D15] text-[#FFC700] font-black shadow-xs'
                            : 'bg-white border-stone-200 hover:border-[#800D15] text-stone-800 font-bold'
                        }`}
                      >
                        <span className="text-xs">T-{t.tableNumber}</span>
                        <span className="text-[9px] uppercase">
                          {isAvail ? `${t.capacity || 4} seats` : 'Occupied'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                      Guest Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Walk-in Guest"
                      className="w-full bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                      Guest Count
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={newGuestCount}
                      onChange={(e) => setNewGuestCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Takeout / Pickup Details */}
            {selectedOrderType === 'takeaway' && (
              <div className="space-y-2.5 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <p className="text-[11px] font-bold text-stone-700">
                  Takeout / Pickup Order — No dining table or delivery rider required.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Takeout Customer"
                      className="w-full bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                      Customer Phone
                    </label>
                    <input
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="080..."
                      className="w-full bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Details */}
            {selectedOrderType === 'delivery' && (
              <div className="space-y-2.5 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Customer Name"
                      className="w-full bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                      Recipient Phone
                    </label>
                    <input
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="080..."
                      className="w-full bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                    Delivery Street Address / Landmark
                  </label>
                  <input
                    type="text"
                    value={newDeliveryAddress}
                    onChange={(e) => setNewDeliveryAddress(e.target.value)}
                    placeholder="e.g. 14 Boundary Rd, GRA Benin City"
                    className="w-full bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                      Delivery Zone
                    </label>
                    <input
                      type="text"
                      value={newDeliveryZone}
                      onChange={(e) => setNewDeliveryZone(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                      Delivery Fee (₦)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={newDeliveryFee}
                      onChange={(e) => setNewDeliveryFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsNewOrderModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmNewOrder}
                disabled={
                  !selectedOrderType ||
                  (selectedOrderType === 'dine_in' && !selectedTableId)
                }
                className="px-5 py-2 rounded-xl bg-[#800D15] hover:bg-[#680A10] disabled:opacity-40 text-[#FFC700] text-xs font-black shadow-xs transition-all"
              >
                Create Order &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
