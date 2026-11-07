import React, { useState, useEffect } from 'react';
import {
  AccountingSummary,
  AuditLog,
  BranchId,
  CartItem,
  HeldTicket,
  InventoryItem,
  Order,
  POSPayment,
  RiderProfile,
  StaffUser,
} from '../types';
import {
  safeGetAuditLogs,
  safeGetHeldTickets,
  safeGetInventory,
  safeGetReconciliations,
  safeGetRiders,
} from '../utils/storageValidators';
import {
  LOCAL_STORAGE_KEY_AUDIT,
  LOCAL_STORAGE_KEY_HELD_TICKETS,
  LOCAL_STORAGE_KEY_INVENTORY,
  LOCAL_STORAGE_KEY_RECONCILIATION,
  LOCAL_STORAGE_KEY_RIDERS,
  OFFLINE_POS_QUEUE_KEY,
} from './appContextTypes';

export interface PosAndInventorySliceArgs {
  currentStaff: StaffUser | null;
  selectedBranchId: BranchId;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

export function usePosAndInventorySlice({
  currentStaff,
  selectedBranchId,
  setOrders,
}: PosAndInventorySliceArgs) {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => safeGetInventory());
  const [riders, setRiders] = useState<RiderProfile[]>(() => safeGetRiders());
  const [heldTickets, setHeldTickets] = useState<HeldTicket[]>(() => safeGetHeldTickets());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => safeGetAuditLogs());
  const [accountingReconciliations, setAccountingReconciliations] = useState<AccountingSummary[]>(() =>
    safeGetReconciliations()
  );

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_INVENTORY, JSON.stringify(inventoryItems));
    } catch {}
  }, [inventoryItems]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_RIDERS, JSON.stringify(riders));
    } catch {}
  }, [riders]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_HELD_TICKETS, JSON.stringify(heldTickets));
    } catch {}
  }, [heldTickets]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_AUDIT, JSON.stringify(auditLogs));
    } catch {}
  }, [auditLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_RECONCILIATION, JSON.stringify(accountingReconciliations));
    } catch {}
  }, [accountingReconciliations]);

  const addAuditLog = (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
    const newLog: AuditLog = {
      ...log,
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const updateInventoryStock = (itemId: string, branchId: BranchId, newStock: number) => {
    setInventoryItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const oldStock = item.currentStock[branchId];
          addAuditLog({
            staffName: currentStaff?.name || 'Staff User',
            staffRole: currentStaff?.role || 'cashier',
            branchId,
            actionType: 'STOCK_MODIFIED',
            details: `Manual inventory count adjustment for "${item.name}" from ${oldStock} to ${newStock} ${item.unit}`,
          });
          return {
            ...item,
            currentStock: {
              ...item.currentStock,
              [branchId]: newStock,
            },
          };
        }
        return item;
      })
    );
  };

  const restockInventoryItem = (itemId: string, branchId: BranchId, addedAmount: number, notes?: string) => {
    setInventoryItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const newStock = (item.currentStock[branchId] || 0) + addedAmount;
          addAuditLog({
            staffName: currentStaff?.name || 'Store Manager',
            staffRole: currentStaff?.role || 'store_manager',
            branchId,
            actionType: 'STOCK_MODIFIED',
            details: `Restocked "${item.name}": +${addedAmount} ${item.unit}. Total: ${newStock} ${item.unit}. ${notes ? `(${notes})` : ''}`,
          });
          return {
            ...item,
            lastRestocked: new Date().toISOString(),
            currentStock: {
              ...item.currentStock,
              [branchId]: newStock,
            },
          };
        }
        return item;
      })
    );
  };

  const assignRiderToOrder = (orderId: string, riderId: string) => {
    const rider = riders.find((r) => r.id === riderId);
    if (!rider) return;

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            riderName: `${rider.name} (${rider.phone})`,
            riderPhone: rider.phone,
            orderStatus: 'out_for_delivery',
          };
        }
        return ord;
      })
    );

    setRiders((prev) =>
      prev.map((r) => (r.id === riderId ? { ...r, currentStatus: 'on_delivery' } : r))
    );

    addAuditLog({
      staffName: currentStaff?.name || 'Dispatch Lead',
      staffRole: currentStaff?.role || 'store_manager',
      branchId: selectedBranchId,
      actionType: 'RIDER_ASSIGNED',
      details: `Assigned rider ${rider.name} to order #${orderId}`,
    });
  };

  const updateRiderStatus = (riderId: string, status: 'available' | 'on_delivery' | 'offline') => {
    setRiders((prev) =>
      prev.map((r) => (r.id === riderId ? { ...r, currentStatus: status } : r))
    );
  };

  const updateRiderCashInHand = (riderId: string, amount: number) => {
    setRiders((prev) =>
      prev.map((r) => (r.id === riderId ? { ...r, cashInHand: amount } : r))
    );
  };

  const holdCurrentPOSTicket = (
    ticketName: string,
    items: CartItem[],
    branchId: BranchId,
    customerName?: string,
    tableNumber?: string
  ) => {
    const ticket: HeldTicket = {
      id: `hold-${Date.now()}`,
      ticketName,
      customerName,
      tableNumber,
      items,
      createdAt: new Date().toISOString(),
      branchId,
    };
    setHeldTickets((prev) => [ticket, ...prev]);
    addAuditLog({
      staffName: currentStaff?.name || 'Cashier',
      staffRole: currentStaff?.role || 'cashier',
      branchId,
      actionType: 'ORDER_CREATED',
      details: `Held/Parked POS order ticket "${ticketName}" (${items.length} items)`,
    });
  };

  const restoreHeldTicket = (ticketId: string): HeldTicket | undefined => {
    const ticket = heldTickets.find((t) => t.id === ticketId);
    if (ticket) {
      setHeldTickets((prev) => prev.filter((t) => t.id !== ticketId));
    }
    return ticket;
  };

  const deleteHeldTicket = (ticketId: string) => {
    setHeldTickets((prev) => prev.filter((t) => t.id !== ticketId));
  };

  const saveShiftReconciliation = (summary: AccountingSummary) => {
    setAccountingReconciliations((prev) => [summary, ...prev]);
    addAuditLog({
      staffName: currentStaff?.name || 'Cashier',
      staffRole: currentStaff?.role || 'cashier',
      branchId: summary.branchId,
      actionType: 'EOD_RECONCILED',
      details: `Shift / EOD Z-Report reconciled for ${summary.branchId.toUpperCase()} with ₦${summary.grossSales.toLocaleString()} gross sales. Cash variance: ₦${summary.cashVariance.toLocaleString()}`,
    });
  };

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return 0;
      const q = localStorage.getItem(OFFLINE_POS_QUEUE_KEY);
      const parsed = q ? JSON.parse(q) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  });

  const getOfflineQueue = (): any[] => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      const q = localStorage.getItem(OFFLINE_POS_QUEUE_KEY);
      const parsed = q ? JSON.parse(q) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const queueOfflinePosOrder = (payload: any) => {
    try {
      const existing = getOfflineQueue();
      const updated = [...existing, { payload, queuedAt: new Date().toISOString() }];
      localStorage.setItem(OFFLINE_POS_QUEUE_KEY, JSON.stringify(updated));
      setOfflineQueueCount(updated.length);
    } catch (e) {
      console.error('Failed to queue offline POS order:', e);
    }
  };

  const syncOfflineQueue = async (): Promise<{ success: boolean; syncedCount: number; error?: string }> => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return { success: true, syncedCount: 0 };

    let synced = 0;
    const remaining: any[] = [];

    for (const item of queue) {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          synced++;
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    localStorage.setItem(OFFLINE_POS_QUEUE_KEY, JSON.stringify(remaining));
    setOfflineQueueCount(remaining.length);

    if (synced > 0) {
      addAuditLog({
        staffName: currentStaff?.name || 'System Auto-Sync',
        staffRole: currentStaff?.role || 'cashier',
        branchId: selectedBranchId,
        actionType: 'ORDER_SYNC',
        details: `Successfully synchronized ${synced} offline POS order(s) to cloud server database.`,
      });
    }

    return { success: remaining.length === 0, syncedCount: synced };
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && window.navigator.onLine && getOfflineQueue().length > 0) {
        syncOfflineQueue();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [currentStaff, selectedBranchId]);

  const createPOSOrder = (
    orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'orderStatus' | 'estimatedDeliveryTimestamp'> & { posPayment?: POSPayment }
  ): Order => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `POS-${randomNum}`;
    const newOrder: Order = {
      ...orderData,
      id: orderNumber,
      orderNumber,
      createdAt: new Date().toISOString(),
      orderStatus: orderData.orderType === 'dine-in' ? 'confirmed' : 'preparing',
      estimatedDeliveryTimestamp: new Date(Date.now() + 1000 * 60 * 20).toISOString(),
    };

    setOrders((prev) => [newOrder, ...prev]);

    addAuditLog({
      staffName: currentStaff?.name || 'Cashier',
      staffRole: currentStaff?.role || 'cashier',
      branchId: orderData.branchId,
      actionType: 'ORDER_CREATED',
      details: `Staff POS order created #${orderNumber} (${orderData.orderType.toUpperCase()}) - Total: ₦${orderData.total.toLocaleString()} via ${orderData.paymentMethod.toUpperCase()}`,
    });

    const orderPayload = {
      id: orderNumber,
      branchId: orderData.branchId,
      orderType: orderData.orderType,
      items: orderData.items.map((it) => ({
        id: it.id,
        productId: it.productId || it.product?.id,
        menuItemId: it.productId || it.product?.id,
        name: it.product?.name,
        quantity: it.quantity,
        price: it.unitPrice,
        unitPrice: it.unitPrice,
        totalPrice: it.unitPrice * it.quantity,
        notes: it.customization?.specialInstructions || '',
      })),
      subtotal: orderData.subtotal,
      deliveryFee: orderData.deliveryFee,
      packagingFee: orderData.packagingFee,
      discount: orderData.discount,
      total: orderData.total,
      paymentMethod: orderData.paymentMethod,
      paymentStatus: orderData.paymentStatus,
      deliveryDetails: {
        customerName: orderData.deliveryDetails?.customerName || 'Walk-in Guest',
        customerPhone: orderData.deliveryDetails?.customerPhone || '',
        customerEmail: orderData.deliveryDetails?.customerEmail || '',
        deliveryAddress: orderData.deliveryDetails?.address || '',
        deliveryZone: orderData.deliveryDetails?.deliveryZone || '',
        landmark: orderData.deliveryDetails?.landmark || '',
        deliveryNotes: orderData.deliveryDetails?.deliveryNotes || '',
        scheduledTime: orderData.deliveryDetails?.scheduledTime || '',
      },
      orderChannel: 'walk-in',
      posPayment: orderData.posPayment,
    };

    if (typeof window !== 'undefined' && window.navigator.onLine) {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      }).catch((err) => {
        console.warn('Network error pushing POS order to backend, queuing for background offline sync:', err);
        queueOfflinePosOrder(orderPayload);
      });
    } else {
      queueOfflinePosOrder(orderPayload);
    }

    return newOrder;
  };

  const logWastageItem = (itemId: string, branchId: BranchId, quantity: number, reason: string, note: string) => {
    setInventoryItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const newStock = (item.currentStock[branchId] || 0) - quantity;
          addAuditLog({
            staffName: currentStaff?.name || 'Staff User',
            staffRole: currentStaff?.role || 'cashier',
            branchId,
            actionType: 'STOCK_WASTED',
            details: `Wasted "${item.name}": -${quantity} ${item.unit}. Reason: ${reason}. ${note ? `(${note})` : ''}`,
          });
          return {
            ...item,
            currentStock: {
              ...item.currentStock,
              [branchId]: newStock,
            },
          };
        }
        return item;
      })
    );
  };

  const addInventoryItem = (itemData: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = {
      ...itemData,
      id: `item-${Date.now()}`,
    };
    setInventoryItems((prev) => [...prev, newItem]);
    addAuditLog({
      staffName: currentStaff?.name || 'Admin',
      staffRole: currentStaff?.role || 'admin',
      branchId: selectedBranchId,
      actionType: 'INVENTORY_ITEM_CREATED',
      details: `Created new inventory item "${newItem.name}" (SKU: ${newItem.sku})`,
    });
  };

  return {
    inventoryItems,
    updateInventoryStock,
    restockInventoryItem,
    logWastageItem,
    addInventoryItem,
    riders,
    assignRiderToOrder,
    updateRiderStatus,
    updateRiderCashInHand,
    heldTickets,
    holdCurrentPOSTicket,
    restoreHeldTicket,
    deleteHeldTicket,
    accountingReconciliations,
    saveShiftReconciliation,
    auditLogs,
    addAuditLog,
    createPOSOrder,
    offlineQueueCount,
    isOnline,
    syncOfflineQueue,
  };
}
