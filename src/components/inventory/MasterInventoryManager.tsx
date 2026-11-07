import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useInventory } from '../../hooks/inventory/useInventory';
import {
  InventoryItem,
  StockLedgerTransaction,
  StockRequest,
  PurchaseOrder,
  GoodsReceiptNote,
  WastageRecord,
  StockCountSession,
  InventoryCategory,
  InventoryItemType,
  StorageArea,
} from '../../types';
import {
  INVENTORY_LOCATIONS,
} from '../../data/inventoryMaster';
import {
  Package,
  Layers,
  History,
  Truck,
  FileCheck,
  TrendingDown,
  ClipboardList,
  Utensils,
  BarChart3,
  Plus,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  DollarSign,
  Building2,
  RefreshCw,
  X,
  Trash2,
  Archive,
} from 'lucide-react';
import { InventoryBalancesTab } from './manager/InventoryBalancesTab';
import { InventoryLedgerTab } from './manager/InventoryLedgerTab';
import { InventoryTransfersTab } from './manager/InventoryTransfersTab';
import { InventoryPurchasingTab } from './manager/InventoryPurchasingTab';
import { InventoryWastageTab } from './manager/InventoryWastageTab';
import { InventoryStocktakeTab } from './manager/InventoryStocktakeTab';
import { InventoryRecipesTab } from './manager/InventoryRecipesTab';
import { InventoryAnalyticsTab } from './manager/InventoryAnalyticsTab';
import { InventoryModals } from './manager/InventoryModals';
import { ExcelBulkImportAndMigrationModal } from '../common/ExcelBulkImportAndMigrationModal';

interface MasterInventoryManagerProps {
  selectedBranchId: string;
  onSelectBranch: (branchId: any) => void;
}

const MasterInventoryManager: React.FC<MasterInventoryManagerProps> = ({
  selectedBranchId,
  onSelectBranch,
}) => {
  const { currentStaff, formatNaira, products } = useApp();

  type InventorySubTab =
    | 'balances'
    | 'ledger'
    | 'transfers'
    | 'purchasing'
    | 'wastage'
    | 'stocktake'
    | 'recipes'
    | 'analytics';

  const [activeSubTab, setActiveSubTab] = useState<InventorySubTab>('balances');
  const [activeLocationFilter, setActiveLocationFilter] = useState<string>(selectedBranchId || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'operational' | 'demo'>('all');
  const [stockLevelFilter, setStockLevelFilter] = useState<'all' | 'low_stock' | 'out_of_stock' | 'in_stock'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    inventoryItems,
    setInventoryItems,
    ledgerTransactions,
    setLedgerTransactions,
    stockRequests,
    setStockRequests,
    suppliers,
    setSuppliers,
    purchaseOrders,
    setPurchaseOrders,
    grnList,
    setGrnList,
    wastageRecords,
    setWastageRecords,
    stockCounts,
    setStockCounts,
    recipes,
    setRecipes,
    logWastage,
    addInventoryItem,
    saveEditInventoryItem,
    deleteInventoryItem,
  } = useInventory();

  const [varianceData, setVarianceData] = useState<any[]>([]);

  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editItemTarget, setEditItemTarget] = useState<InventoryItem | null>(null);
  const [isQuickAdjustOpen, setIsQuickAdjustOpen] = useState<InventoryItem | null>(null);
  const [isLogWastageOpen, setIsLogWastageOpen] = useState(false);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isNewStocktakeOpen, setIsNewStocktakeOpen] = useState(false);
  const [isNewPOOpen, setIsNewPOOpen] = useState(false);
  const [isNewGRNOpen, setIsNewGRNOpen] = useState(false);
  const [viewLedgerItem, setViewLedgerItem] = useState<InventoryItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<InventoryItem | null>(null);
  const [deleteAuditInfo, setDeleteAuditInfo] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemLedgerHistory, setItemLedgerHistory] = useState<StockLedgerTransaction[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [addName, setAddName] = useState('');
  const [addSku, setAddSku] = useState('');
  const [addBarcode, setAddBarcode] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addCategory, setAddCategory] = useState('ingredients');
  const [addSubcategory, setAddSubcategory] = useState('');
  const [addInventoryType, setAddInventoryType] = useState<InventoryItemType>('raw_material');
  const [addStorageArea, setAddStorageArea] = useState<StorageArea>('dry_store');
  const [addBaseUnit, setAddBaseUnit] = useState('kg');
  const [addUnit, setAddUnit] = useState('kg');
  const [addPurchaseUnit, setAddPurchaseUnit] = useState('kg');
  const [addPurchaseUnitFactor, setAddPurchaseUnitFactor] = useState(1);
  const [addCostPerUnit, setAddCostPerUnit] = useState('0');
  const [addSellingPrice, setAddSellingPrice] = useState('0');
  const [addIsSellable, setAddIsSellable] = useState(false);
  const [addIsPurchasable, setAddIsPurchasable] = useState(true);
  const [addIsDemo, setAddIsDemo] = useState(false);
  const [addParLevel, setAddParLevel] = useState('50');
  const [addMinThreshold, setAddMinThreshold] = useState('10');
  const [addInitialStock, setAddInitialStock] = useState('0');
  const [addInitialLocation, setAddInitialLocation] = useState('general_store');
  const [addInitialNotes, setAddInitialNotes] = useState('');
  const [addNotes, setAddNotes] = useState('');

  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editInventoryType, setEditInventoryType] = useState<InventoryItemType>('raw_material');
  const [editStorageArea, setEditStorageArea] = useState<StorageArea>('dry_store');
  const [editBaseUnit, setEditBaseUnit] = useState('kg');
  const [editUnit, setEditUnit] = useState('kg');
  const [editPurchaseUnit, setEditPurchaseUnit] = useState('');
  const [editPurchaseUnitFactor, setEditPurchaseUnitFactor] = useState(1);
  const [editCostPerUnit, setEditCostPerUnit] = useState('0');
  const [editSellingPrice, setEditSellingPrice] = useState('0');
  const [editIsSellable, setEditIsSellable] = useState(false);
  const [editIsPurchasable, setEditIsPurchasable] = useState(true);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editMinThreshold, setEditMinThreshold] = useState('10');
  const [editParLevel, setEditParLevel] = useState('50');
  const [editReorderLevel, setEditReorderLevel] = useState('20');
  const [editReorderQuantity, setEditReorderQuantity] = useState('30');
  const [editNotes, setEditNotes] = useState('');

  const [adjustLocation, setAdjustLocation] = useState<string>(selectedBranchId || 'gra');
  const [adjustQuantity, setAdjustQuantity] = useState<string>('');
  const [wasteItem, setWasteItem] = useState<string>('');
  const [wasteLocation, setWasteLocation] = useState<string>(selectedBranchId || 'gra');
  const [wasteQty, setWasteQty] = useState<string>('');
  const [wasteReason, setWasteReason] = useState<string>('expired_spoilage');
  const [wasteNote, setWasteNote] = useState<string>('');
  const [stocktakeLocation, setStocktakeLocation] = useState<string>('gra');
  const [stocktakeCounts, setStocktakeCounts] = useState<Record<string, number>>({});
  const [stocktakeNotes, setStocktakeNotes] = useState<Record<string, string>>({});
  const [indentBranch, setIndentBranch] = useState<string>('gra');
  const [indentPriority, setIndentPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [indentItems, setIndentItems] = useState<{ itemId: string; requestedQty: number }[]>([]);
  const [indentNotes, setIndentNotes] = useState<string>('');
  const [poSupplierId, setPoSupplierId] = useState<string>('');
  const [poDestLoc, setPoDestLoc] = useState<string>('general_store');
  const [poItems, setPoItems] = useState<{ itemId: string; orderQuantity: number; purchaseUnit: string; unitPrice: number }[]>([]);
  const [grnPoId, setGrnPoId] = useState<string>('');
  const [grnSupplierName, setGrnSupplierName] = useState<string>('');
  const [grnInvoiceNo, setGrnInvoiceNo] = useState<string>('');
  const [grnReceivingLoc, setGrnReceivingLoc] = useState<string>('general_store');
  const [grnLines, setGrnLines] = useState<{ itemId: string; itemName: string; acceptedQty: number; unitPrice: number; batchNumber: string; expiryDate: string }[]>([]);

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('choplife_staff_token') || '';
    return { Authorization: `Bearer ${token}`, ...extra };
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getLocationName = (locId: string) =>
    INVENTORY_LOCATIONS.find((l) => l.id === locId)?.name || locId.toUpperCase();

  const safeJsonParse = async <T,>(res: Response | null): Promise<T | null> => {
    if (!res || !res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      const [
        invRes,
        ledRes,
        reqRes,
        supRes,
        poRes,
        grnRes,
        wstRes,
        cntRes,
        rcpRes,
        varRes,
      ] = await Promise.all([
        fetch('/api/inventory', { headers }).catch(() => null),
        fetch('/api/inventory/ledger?limit=250', { headers }).catch(() => null),
        fetch('/api/inventory/requests', { headers }).catch(() => null),
        fetch('/api/inventory/suppliers', { headers }).catch(() => null),
        fetch('/api/inventory/purchase-orders', { headers }).catch(() => null),
        fetch('/api/inventory/grn', { headers }).catch(() => null),
        fetch('/api/inventory/wastage', { headers }).catch(() => null),
        fetch('/api/inventory/stock-counts', { headers }).catch(() => null),
        fetch('/api/inventory/recipes', { headers }).catch(() => null),
        fetch(`/api/inventory/variance?locationId=${activeLocationFilter === 'all' ? 'gra' : activeLocationFilter}`, { headers }).catch(() => null),
      ]);

      const invData = await safeJsonParse<any[]>(invRes);
      if (Array.isArray(invData) && invData.length > 0) setInventoryItems(invData);

      const ledData = await safeJsonParse<any[]>(ledRes);
      if (Array.isArray(ledData)) setLedgerTransactions(ledData);

      const reqData = await safeJsonParse<any[]>(reqRes);
      if (Array.isArray(reqData)) setStockRequests(reqData);

      const supData = await safeJsonParse<any[]>(supRes);
      if (Array.isArray(supData) && supData.length > 0) setSuppliers(supData);

      const poData = await safeJsonParse<any[]>(poRes);
      if (Array.isArray(poData)) setPurchaseOrders(poData);

      const grnData = await safeJsonParse<any[]>(grnRes);
      if (Array.isArray(grnData)) setGrnList(grnData);

      const wstData = await safeJsonParse<any[]>(wstRes);
      if (Array.isArray(wstData)) setWastageRecords(wstData);

      const cntData = await safeJsonParse<any[]>(cntRes);
      if (Array.isArray(cntData)) setStockCounts(cntData);

      const rcpData = await safeJsonParse<any[]>(rcpRes);
      if (Array.isArray(rcpData) && rcpData.length > 0) setRecipes(rcpData);

      const varData = await safeJsonParse<any[]>(varRes);
      if (Array.isArray(varData)) setVarianceData(varData);
    } catch (e) {
      console.error('Failed to sync inventory ledger:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [activeLocationFilter]);

  useEffect(() => {
    if (!varianceData || varianceData.length === 0) {
      const targetLoc = activeLocationFilter === 'all' ? 'gra' : activeLocationFilter;
      const computed = inventoryItems.slice(0, 20).map((item) => {
        const actualClosing = item.currentStock?.[targetLoc] || 0;
        const openingBalance = Math.max(actualClosing + 4, item.parLevel || 25);
        const receiptsIn = 10;
        const transfersOut = 2;
        const wastage = wastageRecords
          .filter((w) => w.itemId === item.id && w.locationId === targetLoc)
          .reduce((s, w) => s + w.quantity, 0);
        const theoreticalConsumption = 12 - wastage;
        const theoreticalClosing = openingBalance + receiptsIn - transfersOut - wastage - theoreticalConsumption;
        const varianceQty = Number((actualClosing - theoreticalClosing).toFixed(2));
        const varianceValue = varianceQty * (item.costPerUnit || 0);
        return {
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          unit: item.baseUnit || item.unit,
          openingBalance,
          receiptsIn,
          transfersOut,
          wastage,
          theoreticalConsumption,
          theoreticalClosing,
          actualClosing,
          varianceQty,
          varianceValue,
          status: Math.abs(varianceQty) > 2 ? 'alert' : 'normal',
        };
      });
      setVarianceData(computed);
    }
  }, [inventoryItems, activeLocationFilter, wastageRecords]);

  const filteredInventoryItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.sku.toLowerCase().includes(q) &&
        !(item.barcode && item.barcode.toLowerCase().includes(q)) &&
        !item.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      const isItemActive = item.isActive !== false;
      if (statusFilter === 'active' && !isItemActive) return false;
      if (statusFilter === 'archived' && isItemActive) return false;

      if (originFilter === 'operational' && item.isDemo) return false;
      if (originFilter === 'demo' && !item.isDemo) return false;

      if (stockLevelFilter !== 'all') {
        const locs =
          activeLocationFilter === 'all'
            ? ['general_store', 'gra', 'tombia', 'agip']
            : [activeLocationFilter];
        const total = locs.reduce((s, l) => s + (item.currentStock?.[l] || 0), 0);
        const min = locs.reduce((s, l) => s + (item.minThreshold?.[l] || 5), 0);
        if (stockLevelFilter === 'out_of_stock' && total > 0) return false;
        if (stockLevelFilter === 'low_stock' && (total <= 0 || total > min)) return false;
        if (stockLevelFilter === 'in_stock' && total <= min) return false;
      }
      return true;
    });
  }, [
    inventoryItems,
    searchQuery,
    categoryFilter,
    statusFilter,
    originFilter,
    stockLevelFilter,
    activeLocationFilter,
  ]);

  const kpiStats = useMemo(() => {
    const locs =
      activeLocationFilter === 'all'
        ? ['general_store', 'gra', 'tombia', 'agip']
        : [activeLocationFilter];

    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    inventoryItems.forEach((item) => {
      if (item.isActive === false) return;
      const qty = locs.reduce((s, l) => s + (item.currentStock?.[l] || 0), 0);
      const min = locs.reduce((s, l) => s + (item.minThreshold?.[l] || 5), 0);
      totalValuation += Math.max(0, qty) * (item.costPerUnit || 0);
      if (qty <= 0) outOfStockCount++;
      else if (qty <= min) lowStockCount++;
    });

    const totalWastageLoss = wastageRecords.reduce((s, w) => s + (w.totalLossValue || 0), 0);
    const pendingIndents = stockRequests.filter((r) => r.status === 'requested' || r.status === 'in_transit').length;

    return {
      totalValuation,
      lowStockCount,
      outOfStockCount,
      totalWastageLoss,
      pendingIndents,
    };
  }, [inventoryItems, activeLocationFilter, wastageRecords, stockRequests]);

  const handleOpenEditItem = (item: InventoryItem) => {
    setEditItemTarget(item);
    setEditName(item.name || '');
    setEditSku(item.sku || '');
    setEditBarcode(item.barcode || '');
    setEditDescription(item.description || '');
    setEditCategory(item.category || 'ingredients');
    setEditSubcategory(item.subcategory || '');
    setEditInventoryType(item.inventoryType || 'raw_material');
    setEditStorageArea(item.storageArea || 'dry_store');
    setEditBaseUnit(item.baseUnit || item.unit || 'kg');
    setEditUnit(item.unit || 'kg');
    setEditPurchaseUnit(item.purchaseUnit || item.unit || 'kg');
    setEditPurchaseUnitFactor(item.purchaseUnitFactor || 1);
    setEditCostPerUnit(String(item.costPerUnit || 0));
    setEditSellingPrice(String(item.sellingPrice || 0));
    setEditIsSellable(Boolean(item.isSellable));
    setEditIsPurchasable(item.isPurchasable !== false);
    setEditIsActive(item.isActive !== false);
    const firstMin = Object.values(item.minThreshold || {})[0] ?? 10;
    setEditMinThreshold(String(firstMin));
    setEditParLevel(String(item.parLevel || 50));
    setEditReorderLevel(String(item.reorderLevel || 20));
    setEditReorderQuantity(String(item.reorderQuantity || 30));
    setEditNotes(item.notes || '');
  };

  const handleViewItemLedger = async (item: InventoryItem) => {
    setViewLedgerItem(item);
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}/history`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setItemLedgerHistory(Array.isArray(data) ? data : ledgerTransactions.filter((t) => t.itemId === item.id));
      } else {
        setItemLedgerHistory(ledgerTransactions.filter((t) => t.itemId === item.id));
      }
    } catch {
      setItemLedgerHistory(ledgerTransactions.filter((t) => t.itemId === item.id));
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleOpenDeleteModal = async (item: InventoryItem) => {
    setDeleteItemTarget(item);
    const historyCount = ledgerTransactions.filter((t) => t.itemId === item.id).length;
    const totalBalance = Object.values(item.currentStock || {}).reduce((s, v) => s + v, 0);
    setDeleteAuditInfo({
      hasHistory: historyCount > 0 || totalBalance > 0,
      ledgerCount: historyCount,
      totalBalance,
    });
  };

  const handleQuickAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isQuickAdjustOpen || adjustQuantity === '') return;
    const newBalance = parseFloat(adjustQuantity);
    if (isNaN(newBalance)) return;

    const item = isQuickAdjustOpen;
    const prevBalance = item.currentStock?.[adjustLocation] || 0;
    const delta = newBalance - prevBalance;

    try {
      await fetch(`/api/inventory/${item.id}/adjust`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          locationId: adjustLocation,
          newQuantity: newBalance,
          reason: 'Quick physical stock adjustment',
          performedBy: currentStaff?.name || 'Store Manager',
        }),
      });
    } catch {
      // Fallback to local state update
    }

    setInventoryItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              currentStock: {
                ...i.currentStock,
                [adjustLocation]: newBalance,
              },
            }
          : i
      )
    );

    const nowIso = new Date().toISOString();
    const tx: StockLedgerTransaction = {
      id: `TX-${Date.now()}`,
      referenceNo: `ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: nowIso,
      date: nowIso.slice(0, 10),
      itemId: item.id,
      itemName: item.name,
      sku: item.sku || '',
      locationId: adjustLocation as any,
      transactionType: delta >= 0 ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
      quantityDelta: delta,
      unit: item.baseUnit || item.unit,
      unitCost: item.costPerUnit || 0,
      totalValue: Math.abs(delta) * (item.costPerUnit || 0),
      balanceBefore: prevBalance,
      balanceAfter: newBalance,
      notes: 'Quick Physical Stock Adjustment',
      performedByStaffId: currentStaff?.id || 'STF-ADMIN',
      performedByName: currentStaff?.name || 'Store Manager',
      performedByRole: currentStaff?.role || 'store_manager',
    };
    setLedgerTransactions((prev) => [tx, ...prev]);
    setIsQuickAdjustOpen(null);
    setAdjustQuantity('');
    showToast('success', `Adjusted ${item.name} at ${getLocationName(adjustLocation)} to ${newBalance} ${item.baseUnit}`);
  };

  const handleLogWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteItem || !wasteQty) return;
    const qty = parseFloat(wasteQty);
    if (isNaN(qty) || qty <= 0) return;

    try {
      await fetch('/api/inventory/wastage', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          itemId: wasteItem,
          locationId: wasteLocation,
          quantity: qty,
          reason: wasteReason,
          customNote: wasteNote,
          loggedByStaffId: currentStaff?.id || 'STF-ADMIN',
          loggedByName: currentStaff?.name || 'Store Manager',
        }),
      });
    } catch {
      // Fallback to local state
    }

    logWastage(wasteItem, wasteLocation, qty, wasteReason as any, wasteNote);
    setIsLogWastageOpen(false);
    setWasteQty('');
    setWasteNote('');
    showToast('success', 'Kitchen wastage logged & deducted from perpetual stock');
  };

  const handleCreateStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSku = (addSku || '').trim().toUpperCase() || `CL-ITEM-${Date.now().toString().slice(-4)}`;
    const initQty = parseFloat(addInitialStock) || 0;
    const minThresh = parseFloat(addMinThreshold) || 10;
    const unitCostVal = parseFloat(addCostPerUnit) || 0;

    const payload = {
      name: addName.trim(),
      sku: cleanSku,
      barcode: addBarcode,
      description: addDescription,
      category: addCategory || 'proteins',
      subcategory: addSubcategory,
      inventoryType: addInventoryType || 'raw_material',
      storageArea: addStorageArea || 'dry_store',
      baseUnit: addBaseUnit || 'kg',
      unit: addUnit || addBaseUnit || 'kg',
      purchaseUnit: addPurchaseUnit || addBaseUnit || 'kg',
      purchaseUnitFactor: parseFloat(addPurchaseUnitFactor as any) || 1,
      costPerUnit: unitCostVal,
      sellingPrice: parseFloat(addSellingPrice) || 0,
      isSellable: addIsSellable,
      isPurchasable: addIsPurchasable,
      isDemo: addIsDemo,
      parLevel: parseFloat(addParLevel) || 50,
      minThreshold: minThresh,
      reorderLevel: 20,
      reorderQuantity: 30,
      notes: addNotes,
      initialStock: initQty,
      initialLocationId: addInitialLocation || 'general_store',
      openingStockNotes: addInitialNotes,
    };

    const res = await fetch('/api/inventory/items', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.error || `Failed to create inventory item (HTTP ${res.status})`;
      showToast('error', errMsg);
      throw new Error(errMsg);
    }

    const createdItem: InventoryItem = data.item || {
      id: `item_${Date.now()}`,
      ...payload,
      category: (addCategory || 'proteins') as InventoryCategory,
      inventoryType: (addInventoryType || 'raw_material') as InventoryItemType,
      storageArea: (addStorageArea || 'dry_store') as StorageArea,
      isActive: true,
      minThreshold: {
        general_store: minThresh,
        gra: minThresh,
        okabere: minThresh,
        ugbowo: minThresh,
      },
      currentStock: {
        general_store: addInitialLocation === 'general_store' ? initQty : 0,
        gra: addInitialLocation === 'gra' ? initQty : 0,
        okabere: addInitialLocation === 'okabere' ? initQty : 0,
        ugbowo: addInitialLocation === 'ugbowo' ? initQty : 0,
      },
    };

    addInventoryItem(createdItem);
    setIsAddItemOpen(false);
    setAddName('');
    setAddSku('');
    setAddDescription('');
    setAddInitialStock('0');
    showToast('success', `Created inventory SKU: ${createdItem.name} (${createdItem.sku})`);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = indentItems.filter((i) => i.itemId && i.requestedQty > 0);
    if (validLines.length === 0) {
      showToast('error', 'Please add at least one item to request');
      return;
    }

    const newReq: StockRequest = {
      id: `REQ-${Date.now()}`,
      requestNumber: `IND-${Math.floor(1000 + Math.random() * 9000)}`,
      sourceLocation: 'general_store',
      destinationLocation: indentBranch as any,
      priority: indentPriority === 'high' ? 'urgent' : indentPriority,
      items: validLines.map((line) => {
        const itm = inventoryItems.find((i) => i.id === line.itemId);
        return {
          itemId: line.itemId,
          itemName: itm?.name || line.itemId,
          sku: itm?.sku || '',
          unit: itm?.baseUnit || 'kg',
          requestedQty: line.requestedQty,
          approvedQty: line.requestedQty,
          outstandingQty: line.requestedQty,
          sourceAvailableQty: itm?.currentStock?.general_store || 0,
          destinationCurrentQty: itm?.currentStock?.[indentBranch] || 0,
          notes: indentNotes,
        };
      }),
      status: 'requested',
      requestedByStaffId: currentStaff?.id || 'STF-SUP',
      requestedByName: currentStaff?.name || 'Branch Supervisor',
      requestedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/inventory/requests', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          sourceLocation: 'general_store',
          destinationLocation: indentBranch,
          priority: indentPriority === 'high' ? 'urgent' : indentPriority,
          notes: indentNotes,
          items: validLines.map((line) => {
            const itm = inventoryItems.find((i) => i.id === line.itemId);
            return {
              itemId: line.itemId,
              itemName: itm?.name || line.itemId,
              sku: itm?.sku || '',
              unit: itm?.baseUnit || 'kg',
              requestedQty: line.requestedQty,
            };
          }),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('error', data?.error || `Failed to submit transfer indent (HTTP ${res.status})`);
        return;
      }

      const createdReq = data.request || newReq;
      setStockRequests((prev) => [createdReq, ...prev]);
      setIsNewRequestOpen(false);
      setIndentItems([]);
      setIndentNotes('');
      showToast('success', `Transfer indent ${createdReq.requestNumber || createdReq.id} submitted to General Store`);
      fetchAllData();
    } catch (err: any) {
      showToast('error', err?.message || 'Network error submitting transfer request');
    }
  };

  const handleReviewRequest = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/inventory/requests/${id}/review`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status, reviewedBy: currentStaff?.name || 'Store Manager' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('error', data?.error || `Failed to review indent (HTTP ${res.status})`);
        return;
      }
      setStockRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status,
                approvedByName: currentStaff?.name || 'Store Manager',
                approvedAt: new Date().toISOString(),
              }
            : r
        )
      );
      showToast('success', `Indent ${status.toUpperCase()}`);
      fetchAllData();
    } catch (err: any) {
      showToast('error', err?.message || 'Network error reviewing indent');
    }
  };

  const handleDispatchTransfer = async (id: string) => {
    const req = stockRequests.find((r) => r.id === id);
    if (!req) return;

    try {
      const res = await fetch(`/api/inventory/requests/${id}/dispatch`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          issuedItems: req.items.map((it) => ({
            itemId: it.itemId,
            issuedQty: it.approvedQty || it.requestedQty,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('error', data?.error || `Failed to dispatch transfer (HTTP ${res.status})`);
        return;
      }

      showToast('success', `Dispatched ${req.requestNumber || req.id} from General Store`);
      fetchAllData();
    } catch (err: any) {
      showToast('error', err?.message || 'Network error dispatching transfer');
    }
  };

  const handleReceiveTransfer = async (id: string) => {
    const req = stockRequests.find((r) => r.id === id);
    if (!req) return;

    try {
      const res = await fetch(`/api/inventory/requests/${id}/receive`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          receivedItems: req.items.map((it) => ({
            itemId: it.itemId,
            receivedQty: it.approvedQty || it.requestedQty,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('error', data?.error || `Failed to receive transfer (HTTP ${res.status})`);
        return;
      }

      const destLoc = req.destinationLocation || 'gra';
      showToast('success', `Received transfer into ${getLocationName(destLoc)} stock`);
      fetchAllData();
    } catch (err: any) {
      showToast('error', err?.message || 'Network error receiving transfer');
    }
  };

  const handleSubmitStocktake = async (autoReconcile: boolean) => {
    const lines = inventoryItems.map((item) => {
      const sysQty = item.currentStock?.[stocktakeLocation] || 0;
      const physQty =
        stocktakeCounts[item.id] !== undefined ? Number(stocktakeCounts[item.id]) : sysQty;
      const variance = Number((physQty - sysQty).toFixed(2));
      return {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku || '',
        storageArea: item.storageArea || ('dry_store' as StorageArea),
        unit: item.baseUnit || item.unit,
        systemExpectedQty: sysQty,
        physicalCountedQty: physQty,
        varianceQty: variance,
        unitCost: item.costPerUnit || 0,
        varianceValue: variance * (item.costPerUnit || 0),
        notes: stocktakeNotes[item.id] || '',
      };
    });

    const totalExpectedValue = lines.reduce((s, l) => s + l.systemExpectedQty * l.unitCost, 0);
    const totalCountedValue = lines.reduce((s, l) => s + l.physicalCountedQty * l.unitCost, 0);
    const totalVarianceValue = lines.reduce((s, l) => s + l.varianceValue, 0);
    const session: StockCountSession = {
      id: `CNT-${Date.now()}`,
      referenceNo: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      locationId: stocktakeLocation as any,
      status: autoReconcile ? 'approved_reconciled' : 'submitted',
      lines,
      totalExpectedValue,
      totalCountedValue,
      totalVarianceValue,
      conductedByStaffId: currentStaff?.id || 'STF-ADMIN',
      conductedByName: currentStaff?.name || 'Store Auditor',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    if (autoReconcile) {
      setInventoryItems((prev) =>
        prev.map((item) => {
          if (stocktakeCounts[item.id] === undefined) return item;
          return {
            ...item,
            currentStock: {
              ...item.currentStock,
              [stocktakeLocation]: Number(stocktakeCounts[item.id]),
            },
          };
        })
      );
    }

    setStockCounts((prev) => [session, ...prev]);
    setIsNewStocktakeOpen(false);
    setStocktakeCounts({});
    setStocktakeNotes({});
    showToast(
      'success',
      autoReconcile
        ? `Stocktake ${session.referenceNo} reconciled & ledger balances updated`
        : `Stocktake ${session.referenceNo} saved for review`
    );
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === poSupplierId);
    const validItems = poItems.filter((i) => i.itemId && i.orderQuantity > 0);
    if (!sup || validItems.length === 0) {
      showToast('error', 'Select a supplier and at least one line item');
      return;
    }

    const lines = validItems.map((l) => {
      const itm = inventoryItems.find((i) => i.id === l.itemId);
      const factor = itm?.purchaseUnitFactor || 1;
      const totalCost = l.orderQuantity * l.unitPrice;
      return {
        itemId: l.itemId,
        itemName: itm?.name || l.itemId,
        sku: itm?.sku || '',
        orderQuantity: l.orderQuantity,
        purchaseUnit: l.purchaseUnit || itm?.purchaseUnit || 'unit',
        conversionFactor: factor,
        baseQuantity: l.orderQuantity * factor,
        agreedUnitPrice: l.unitPrice,
        totalCost,
        receivedQuantity: 0,
      };
    });

    const subtotal = lines.reduce((s, l) => s + l.totalCost, 0);
    const nowIso = new Date().toISOString();
    const newPO: PurchaseOrder = {
      id: `PO-${Date.now()}`,
      poNumber: `PO-2026-${Math.floor(100 + Math.random() * 900)}`,
      supplierId: sup.id,
      supplierName: sup.name,
      destinationLocation: poDestLoc as any,
      orderDate: nowIso.slice(0, 10),
      expectedDeliveryDate: nowIso.slice(0, 10),
      status: subtotal > 100000 ? 'pending_approval' : 'approved',
      items: lines,
      subtotal,
      taxAmount: 0,
      shippingFee: 0,
      totalAmount: subtotal,
      createdByStaffId: currentStaff?.id || 'STF-PROC',
      createdByName: currentStaff?.name || 'Procurement Officer',
    };

    setPurchaseOrders((prev) => [newPO, ...prev]);
    setIsNewPOOpen(false);
    setPoItems([]);
    showToast('success', `Purchase Order ${newPO.poNumber} issued (${formatNaira(subtotal)})`);
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = grnLines.filter((l) => l.itemId && l.acceptedQty > 0);
    if (validLines.length === 0) {
      showToast('error', 'Add at least one received item line');
      return;
    }

    const mappedLines = validLines.map((l) => {
      const itm = inventoryItems.find((i) => i.id === l.itemId);
      return {
        itemId: l.itemId,
        itemName: itm?.name || l.itemName || l.itemId,
        sku: itm?.sku || '',
        orderedQty: l.acceptedQty,
        deliveredQty: l.acceptedQty,
        acceptedQty: l.acceptedQty,
        rejectedQty: 0,
        unit: itm?.baseUnit || 'kg',
        unitPrice: l.unitPrice,
        totalValue: l.acceptedQty * l.unitPrice,
        batchNumber: l.batchNumber || `BCH-${Date.now().toString().slice(-4)}`,
        expiryDate: l.expiryDate,
      };
    });

    const totalVal = mappedLines.reduce((s, l) => s + l.totalValue, 0);
    const newGRN: GoodsReceiptNote = {
      id: `GRN-${Date.now()}`,
      grnNumber: `GRN-2026-${Math.floor(100 + Math.random() * 900)}`,
      poId: grnPoId || undefined,
      supplierId: 'sup-direct',
      supplierName: grnSupplierName || 'Verified Supplier',
      supplierInvoiceNumber: grnInvoiceNo || `INV-${Date.now().toString().slice(-5)}`,
      receivingLocation: grnReceivingLoc as any,
      items: mappedLines,
      actualAcceptedValue: totalVal,
      priceDiscrepancyFlag: false,
      status: 'verified',
      receivedByStaffId: currentStaff?.id || 'STF-ADMIN',
      receivedByName: currentStaff?.name || 'Store Officer',
      receivedAt: new Date().toISOString(),
    };

    setInventoryItems((prev) =>
      prev.map((item) => {
        const received = mappedLines.find((l) => l.itemId === item.id);
        if (!received) return item;
        return {
          ...item,
          costPerUnit: received.unitPrice || item.costPerUnit,
          currentStock: {
            ...item.currentStock,
            [grnReceivingLoc]: (item.currentStock?.[grnReceivingLoc] || 0) + received.acceptedQty,
          },
        };
      })
    );

    setGrnList((prev) => [newGRN, ...prev]);
    setIsNewGRNOpen(false);
    setGrnLines([]);
    showToast('success', `GRN ${newGRN.grnNumber} posted & stock added to ${getLocationName(grnReceivingLoc)}`);
  };

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItemTarget) return;
    const updated: InventoryItem = {
      ...editItemTarget,
      name: editName,
      sku: editSku,
      barcode: editBarcode,
      description: editDescription,
      category: editCategory as InventoryCategory,
      subcategory: editSubcategory,
      inventoryType: editInventoryType,
      storageArea: editStorageArea,
      baseUnit: editBaseUnit,
      unit: editUnit,
      purchaseUnit: editPurchaseUnit,
      purchaseUnitFactor: Number(editPurchaseUnitFactor) || 1,
      costPerUnit: parseFloat(editCostPerUnit) || 0,
      sellingPrice: parseFloat(editSellingPrice) || 0,
      isSellable: editIsSellable,
      isPurchasable: editIsPurchasable,
      isActive: editIsActive,
      parLevel: parseFloat(editParLevel) || 50,
      reorderLevel: parseFloat(editReorderLevel) || 20,
      reorderQuantity: parseFloat(editReorderQuantity) || 30,
      minThreshold: {
        ...editItemTarget.minThreshold,
        general_store: parseFloat(editMinThreshold) || 10,
        gra: parseFloat(editMinThreshold) || 10,
        okabere: parseFloat(editMinThreshold) || 10,
        ugbowo: parseFloat(editMinThreshold) || 10,
      },
      notes: editNotes,
    };
    saveEditInventoryItem(updated);
    setEditItemTarget(null);
    showToast('success', `Updated ${updated.name}`);
  };

  const state = {
    isQuickAdjustOpen,
    setIsQuickAdjustOpen,
    adjustLocation,
    setAdjustLocation,
    adjustQuantity,
    setAdjustQuantity,
    handleQuickAdjust,
    isLogWastageOpen,
    setIsLogWastageOpen,
    wasteLocation,
    setWasteLocation,
    wasteReason,
    setWasteReason,
    wasteItem,
    setWasteItem,
    wasteQty,
    setWasteQty,
    wasteNote,
    setWasteNote,
    handleLogWastage,
    isNewRequestOpen,
    setIsNewRequestOpen,
    indentBranch,
    setIndentBranch,
    indentPriority,
    setIndentPriority,
    indentItems,
    setIndentItems,
    indentNotes,
    setIndentNotes,
    handleCreateRequest,
    isNewStocktakeOpen,
    setIsNewStocktakeOpen,
    stocktakeLocation,
    setStocktakeLocation,
    stocktakeCounts,
    setStocktakeCounts,
    stocktakeNotes,
    setStocktakeNotes,
    handleSubmitStocktake,
    isNewPOOpen,
    setIsNewPOOpen,
    poSupplierId,
    setPoSupplierId,
    poDestLoc,
    setPoDestLoc,
    poItems,
    setPoItems,
    handleCreatePO,
    isNewGRNOpen,
    setIsNewGRNOpen,
    grnPoId,
    setGrnPoId,
    grnSupplierName,
    setGrnSupplierName,
    grnInvoiceNo,
    setGrnInvoiceNo,
    grnReceivingLoc,
    setGrnReceivingLoc,
    grnLines,
    setGrnLines,
    handleCreateGRN,
    isAddItemOpen,
    setIsAddItemOpen,
    addName,
    setAddName,
    addSku,
    setAddSku,
    addBarcode,
    setAddBarcode,
    addDescription,
    setAddDescription,
    addCategory,
    setAddCategory,
    addSubcategory,
    setAddSubcategory,
    addInventoryType,
    setAddInventoryType: (v: InventoryItemType) => setAddInventoryType(v),
    addStorageArea,
    setAddStorageArea: (v: StorageArea) => setAddStorageArea(v),
    addBaseUnit,
    setAddBaseUnit,
    addUnit,
    setAddUnit,
    addPurchaseUnit,
    setAddPurchaseUnit,
    addPurchaseUnitFactor,
    setAddPurchaseUnitFactor,
    addCostPerUnit,
    setAddCostPerUnit,
    addSellingPrice,
    setAddSellingPrice,
    addIsSellable,
    setAddIsSellable,
    addIsPurchasable,
    setAddIsPurchasable,
    addIsDemo,
    setAddIsDemo,
    addParLevel,
    setAddParLevel,
    addMinThreshold,
    setAddMinThreshold,
    addInitialStock,
    setAddInitialStock,
    addInitialLocation,
    setAddInitialLocation,
    addInitialNotes,
    setAddInitialNotes,
    addNotes,
    setAddNotes,
    handleCreateStockItem,
    editItemTarget,
    setEditItemTarget,
    editName,
    setEditName,
    editSku,
    setEditSku,
    editBarcode,
    setEditBarcode,
    editDescription,
    setEditDescription,
    editCategory,
    setEditCategory,
    editSubcategory,
    setEditSubcategory,
    editInventoryType,
    setEditInventoryType: (v: InventoryItemType) => setEditInventoryType(v),
    editStorageArea,
    setEditStorageArea: (v: StorageArea) => setEditStorageArea(v),
    editBaseUnit,
    setEditBaseUnit,
    editUnit,
    setEditUnit,
    editPurchaseUnit,
    setEditPurchaseUnit,
    editPurchaseUnitFactor,
    setEditPurchaseUnitFactor,
    editCostPerUnit,
    setEditCostPerUnit,
    editSellingPrice,
    setEditSellingPrice,
    editIsSellable,
    setEditIsSellable,
    editIsPurchasable,
    setEditIsPurchasable,
    editIsActive,
    setEditIsActive,
    editMinThreshold,
    setEditMinThreshold,
    editParLevel,
    setEditParLevel,
    editReorderLevel,
    setEditReorderLevel,
    editReorderQuantity,
    setEditReorderQuantity,
    editNotes,
    setEditNotes,
    suppliers,
    inventoryItems,
    formatNaira,
    getLocationName,
  };

  const SUB_TABS: { id: InventorySubTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'balances', label: 'Multi-Store Balances', icon: <Layers className="w-4 h-4" />, badge: inventoryItems.length },
    { id: 'ledger', label: 'Stock Ledger', icon: <History className="w-4 h-4" />, badge: ledgerTransactions.length },
    { id: 'transfers', label: 'Commissary & Transfers', icon: <Truck className="w-4 h-4" />, badge: kpiStats.pendingIndents },
    { id: 'purchasing', label: 'Procurement & GRN', icon: <FileCheck className="w-4 h-4" />, badge: purchaseOrders.length },
    { id: 'wastage', label: 'Wastage & Write-Offs', icon: <TrendingDown className="w-4 h-4" />, badge: wastageRecords.length },
    { id: 'stocktake', label: 'Physical Stocktake', icon: <ClipboardList className="w-4 h-4" />, badge: stockCounts.length },
    { id: 'recipes', label: 'Recipe BOM & Costing', icon: <Utensils className="w-4 h-4" />, badge: recipes.length },
    { id: 'analytics', label: 'Variance Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5">
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-lg border flex items-center gap-2.5 text-xs font-montserrat font-bold ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Executive Header & Multi-Store Location Selector */}
      <div className="bg-white rounded-3xl p-5 border border-[#E5DEC9] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#4D080F] text-[#FFC700] flex items-center justify-center shrink-0 shadow-xs">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-titan text-lg text-[#4D080F] uppercase tracking-wide">
                Enterprise Multi-Store Inventory & Procurement Core
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                Perpetual Weighted-Average Costing
              </span>
            </div>
            <p className="text-xs text-stone-500 font-montserrat mt-0.5">
              Central General Store Commissary + GRA Flagship, Okabere Road &amp; Ugbowo Campus branch stock control.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#FAF7F2] p-1 rounded-2xl border border-[#E5DEC9]">
            <button
              onClick={() => setActiveLocationFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all ${
                activeLocationFilter === 'all'
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                  : 'text-stone-600 hover:text-[#4D080F]'
              }`}
            >
              All 4 Stores
            </button>
            {INVENTORY_LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                onClick={() => {
                  setActiveLocationFilter(loc.id);
                  if (loc.id !== 'general_store') onSelectBranch(loc.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all ${
                  activeLocationFilter === loc.id
                    ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                    : 'text-stone-600 hover:text-[#4D080F]'
                }`}
              >
                {loc.code || loc.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#800D15] hover:bg-[#4D080F] text-[#FFC700] text-xs font-montserrat font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Excel Template &amp; Bulk Import</span>
          </button>

          <button
            onClick={fetchAllData}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#4D080F] border border-[#E5DEC9] transition-colors"
            title="Sync Perpetual Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#E5DEC9] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Stock Valuation ({activeLocationFilter === 'all' ? 'All Stores' : getLocationName(activeLocationFilter)})
            </p>
            <p className="font-titan text-xl text-[#4D080F] mt-1">
              {formatNaira(kpiStats.totalValuation)}
            </p>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              {inventoryItems.filter((i) => i.isActive !== false).length} Active Master SKUs
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E5DEC9] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Reorder & Low Stock Alerts
            </p>
            <p className="font-titan text-xl text-amber-600 mt-1">
              {kpiStats.lowStockCount} SKUs Low · {kpiStats.outOfStockCount} Out
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Click filter to isolate critical items
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E5DEC9] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Commissary Transfer Indents
            </p>
            <p className="font-titan text-xl text-[#4D080F] mt-1">
              {kpiStats.pendingIndents} Active Indents
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {stockRequests.length} total inter-branch requests
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E5DEC9] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Cumulative Wastage Write-Offs
            </p>
            <p className="font-titan text-xl text-red-600 mt-1">
              {formatNaira(kpiStats.totalWastageLoss)}
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {wastageRecords.length} logged spoilage/loss events
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="bg-white p-2 rounded-2xl border border-[#E5DEC9] flex items-center gap-1.5 overflow-x-auto shadow-2xs">
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-montserrat font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                  : 'text-stone-600 hover:bg-[#FAF7F2] hover:text-[#4D080F]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isActive
                      ? 'bg-[#FFC700] text-[#4D080F]'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Sub-Tab Workspace */}
      {activeSubTab === 'balances' && (
        <InventoryBalancesTab
          filteredInventoryItems={filteredInventoryItems}
          inventoryItems={inventoryItems}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          originFilter={originFilter}
          setOriginFilter={setOriginFilter}
          stockLevelFilter={stockLevelFilter}
          setStockLevelFilter={setStockLevelFilter}
          activeLocationFilter={activeLocationFilter}
          formatNaira={formatNaira}
          setIsAddItemOpen={setIsAddItemOpen}
          handleOpenEditItem={handleOpenEditItem}
          handleViewItemLedger={handleViewItemLedger}
          handleOpenDeleteModal={handleOpenDeleteModal}
          setIsQuickAdjustOpen={setIsQuickAdjustOpen}
        />
      )}

      {activeSubTab === 'ledger' && (
        <InventoryLedgerTab
          ledgerTransactions={ledgerTransactions}
          inventoryItems={inventoryItems}
          activeLocationFilter={activeLocationFilter}
          formatNaira={formatNaira}
          fetchAllData={fetchAllData}
          isLoading={isLoading}
          getLocationName={getLocationName}
        />
      )}

      {activeSubTab === 'transfers' && (
        <InventoryTransfersTab
          stockRequests={stockRequests}
          inventoryItems={inventoryItems}
          activeLocationFilter={activeLocationFilter}
          formatNaira={formatNaira}
          setIsNewRequestOpen={setIsNewRequestOpen}
          handleReviewRequest={handleReviewRequest}
          handleDispatchTransfer={handleDispatchTransfer}
          handleReceiveTransfer={handleReceiveTransfer}
          getLocationName={getLocationName}
        />
      )}

      {activeSubTab === 'purchasing' && (
        <InventoryPurchasingTab
          suppliers={suppliers}
          purchaseOrders={purchaseOrders}
          grnList={grnList}
          inventoryItems={inventoryItems}
          formatNaira={formatNaira}
          setIsNewPOOpen={setIsNewPOOpen}
          setIsNewGRNOpen={setIsNewGRNOpen}
        />
      )}

      {activeSubTab === 'wastage' && (
        <InventoryWastageTab
          wastageRecords={wastageRecords}
          inventoryItems={inventoryItems}
          activeLocationFilter={activeLocationFilter}
          formatNaira={formatNaira}
          setIsLogWastageOpen={setIsLogWastageOpen}
        />
      )}

      {activeSubTab === 'stocktake' && (
        <InventoryStocktakeTab
          stockCounts={stockCounts}
          inventoryItems={inventoryItems}
          activeLocationFilter={activeLocationFilter}
          formatNaira={formatNaira}
          setIsNewStocktakeOpen={setIsNewStocktakeOpen}
        />
      )}

      {activeSubTab === 'recipes' && (
        <InventoryRecipesTab
          recipes={recipes}
          products={products}
          inventoryItems={inventoryItems}
          formatNaira={formatNaira}
        />
      )}

      {activeSubTab === 'analytics' && (
        <InventoryAnalyticsTab
          varianceData={varianceData}
          inventoryItems={inventoryItems}
          activeLocationFilter={activeLocationFilter === 'all' ? 'gra' : activeLocationFilter}
          formatNaira={formatNaira}
        />
      )}

      {/* Primary Modals */}
      <InventoryModals {...state} />

      {/* Edit Item Modal */}
      {editItemTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border border-[#E5DEC9] shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-titan text-base text-[#4D080F] uppercase">
                  Edit Master SKU: {editItemTarget.name}
                </h3>
                <p className="text-xs text-stone-500">SKU: {editItemTarget.sku}</p>
              </div>
              <button
                onClick={() => setEditItemTarget(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="space-y-3 text-xs font-montserrat">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#4D080F] mb-1">Item Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#4D080F] mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#4D080F] mb-1">Unit Cost (₦)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editCostPerUnit}
                    onChange={(e) => setEditCostPerUnit(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#4D080F] mb-1">Min Reorder Threshold</label>
                  <input
                    type="number"
                    value={editMinThreshold}
                    onChange={(e) => setEditMinThreshold(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 font-bold text-stone-700">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                  />
                  Active in Operational Catalogue
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditItemTarget(null)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] font-titan uppercase"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Ledger History Modal */}
      {viewLedgerItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 border border-[#E5DEC9] shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-titan text-base text-[#4D080F] uppercase">
                  Perpetual Audit Trail: {viewLedgerItem.name}
                </h3>
                <p className="text-xs text-stone-500">SKU: {viewLedgerItem.sku}</p>
              </div>
              <button
                onClick={() => setViewLedgerItem(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {isHistoryLoading ? (
                <p className="text-xs text-stone-500 py-8 text-center">Loading item ledger movements...</p>
              ) : itemLedgerHistory.length === 0 ? (
                <p className="text-xs text-stone-500 py-8 text-center">
                  No ledger movements recorded for this SKU yet.
                </p>
              ) : (
                <table className="w-full text-left text-xs font-montserrat">
                  <thead className="bg-[#FAF7F2] text-[#4D080F] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Ref / Date</th>
                      <th className="p-2.5">Location</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5 text-right">Delta</th>
                      <th className="p-2.5 text-right">New Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {itemLedgerHistory.map((tx) => (
                      <tr key={tx.id}>
                        <td className="p-2.5">
                          <div className="font-bold">{tx.referenceNo}</div>
                          <div className="text-[10px] text-stone-400">
                            {new Date(tx.timestamp).toLocaleString()}
                          </div>
                        </td>
                        <td className="p-2.5 uppercase font-bold text-stone-600">{tx.locationId}</td>
                        <td className="p-2.5">{tx.transactionType}</td>
                        <td
                          className={`p-2.5 text-right font-bold ${
                            tx.quantityDelta >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {tx.quantityDelta >= 0 ? `+${tx.quantityDelta}` : tx.quantityDelta} {tx.unit}
                        </td>
                        <td className="p-2.5 text-right font-bold">
                          {tx.balanceAfter} {tx.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation Modal */}
      {deleteItemTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#E5DEC9] shadow-2xl space-y-4">
            <h3 className="font-titan text-base text-[#4D080F] uppercase flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Remove or Archive Inventory Item
            </h3>
            <p className="text-xs text-stone-600 font-montserrat">
              Are you sure you want to remove <strong>{deleteItemTarget.name}</strong> ({deleteItemTarget.sku})?
              {deleteAuditInfo?.hasHistory &&
                ' Because this item has existing stock or ledger history, archiving is recommended to preserve financial audit trails.'}
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                onClick={() => setDeleteItemTarget(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  saveEditInventoryItem({ ...deleteItemTarget, isActive: false });
                  setDeleteItemTarget(null);
                  showToast('success', `${deleteItemTarget.name} archived safely`);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center gap-1"
              >
                <Archive className="w-3.5 h-3.5" /> Archive SKU
              </button>
              <button
                onClick={() => {
                  deleteInventoryItem(deleteItemTarget.id);
                  setDeleteItemTarget(null);
                  showToast('success', `${deleteItemTarget.name} deleted`);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
      <ExcelBulkImportAndMigrationModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        defaultTab="inventory_import"
        onSuccessRefresh={fetchAllData}
        showToast={(msg, type) => showToast(type || 'success', msg)}
      />
    </div>
  );
};

export { MasterInventoryManager };
export default MasterInventoryManager;
