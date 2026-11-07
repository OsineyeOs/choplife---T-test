import { useState } from 'react';
import { INITIAL_CANONICAL_INVENTORY, INITIAL_STOCK_LEDGER, INITIAL_STOCK_REQUESTS, INITIAL_SUPPLIERS, INITIAL_PURCHASE_ORDERS, INITIAL_GOODS_RECEIPT_NOTES, INITIAL_WASTAGE_RECORDS, INITIAL_RECIPES_BOM } from '../../data/inventoryMaster';
import { InventoryItem, StockLedgerTransaction, StockRequest, PurchaseOrder, GoodsReceiptNote, WastageRecord, StockCountSession, RecipeBOM, Supplier, WastageReason } from '../../types';

export const useInventory = () => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(INITIAL_CANONICAL_INVENTORY);
  const [ledgerTransactions, setLedgerTransactions] = useState<StockLedgerTransaction[]>(INITIAL_STOCK_LEDGER);
  const [stockRequests, setStockRequests] = useState<StockRequest[]>(INITIAL_STOCK_REQUESTS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(INITIAL_PURCHASE_ORDERS);
  const [grnList, setGrnList] = useState<GoodsReceiptNote[]>(INITIAL_GOODS_RECEIPT_NOTES);
  const [wastageRecords, setWastageRecords] = useState<WastageRecord[]>(INITIAL_WASTAGE_RECORDS);
  const [stockCounts, setStockCounts] = useState<StockCountSession[]>([]);
  const [recipes, setRecipes] = useState<RecipeBOM[]>(INITIAL_RECIPES_BOM);

  // Add more state and handlers as needed...

  const logWastage = (
    itemId: string,
    location: string,
    quantity: number,
    reason: WastageReason,
    note: string
  ) => {
    const targetItem = inventoryItems.find((i) => i.id === itemId);
    const newRecord: WastageRecord = {
      id: `waste_${Date.now()}`,
      referenceNo: `WST-${Math.floor(1000 + Math.random() * 9000)}`,
      itemId,
      itemName: targetItem?.name || itemId,
      sku: targetItem?.sku || '',
      locationId: location as any,
      quantity,
      unit: targetItem?.baseUnit || 'pcs',
      unitCost: targetItem?.costPerUnit || 0,
      totalLossValue: (targetItem?.costPerUnit || 0) * quantity,
      reason,
      customNote: note,
      loggedByStaffId: 'STF-ADMIN',
      loggedByName: 'Store Manager',
      loggedByRole: 'store_manager',
      timestamp: new Date().toISOString(),
    };
    setWastageRecords((prev) => [...prev, newRecord]);
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              currentStock: {
                ...item.currentStock,
                [location]: (item.currentStock[location] || 0) - quantity,
              },
            }
          : item
      )
    );
  };

  const addInventoryItem = (item: InventoryItem) => {
    setInventoryItems((prev) => [...prev, item]);
  };

  const saveEditInventoryItem = (item: InventoryItem) => {
    setInventoryItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  };

  const deleteInventoryItem = (itemId: string) => {
    setInventoryItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  return {
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
  };
};
