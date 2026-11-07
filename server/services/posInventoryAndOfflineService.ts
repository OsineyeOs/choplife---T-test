import { Router } from 'express';
import crypto from 'crypto';
import type {
  DbDatabase,
  DbStaffAccount,
  DbCheck,
  DbCheckItem,
} from '../../server_db.ts';
import { dispatchTermiiSms } from '../../server_notifications.ts';
import { evaluateInventoryReorderAlerts } from './stockAlertService.ts';
import {
  CANONICAL_PACKAGE_COMPOSITIONS,
  calculateDefaultPackagingForItems,
} from './packageAndPricingEngine.ts';

const BREAD_WHOLESALE_CRATE_TO_BASE_SKU: Record<string, string> = {
  'prod-bakery-special-350g-ws': 'prod-bakery-special-350g',
  'prod-bakery-special-600g-ws': 'prod-bakery-special-600g',
  'prod-bakery-family-800g-ws': 'prod-bakery-family-800g',
  'prod-bakery-jumbo-1200g-ws': 'prod-bakery-jumbo-1200g',
};

export function createOrderInventoryDepleter(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
}) {
  const { getDb, saveDatabaseSync, logAuditEvent } = deps;

  return function depleteInventoryForOrder(
    items: DbCheckItem[],
    branchId: string,
    orderRef: string,
    staff: DbStaffAccount
  ) {
    const db = getDb();
    db.ledger = db.ledger || [];
    (db as any).processedDepletionRefs = (db as any).processedDepletionRefs || {};

    // Idempotency guard: if this exact orderRef was already depleted, do not deplete again
    if (orderRef && (db as any).processedDepletionRefs[orderRef]) {
      return;
    }

    interface ExpandedDepletionTarget {
      productId: string;
      name: string;
      quantity: number;
      parentPackageName?: string;
      parentPackageQty?: number;
    }

    const targets: ExpandedDepletionTarget[] = [];

    for (const it of items) {
      const rawProdId = String(it.productId || (it as any).menuItemId || '').trim();
      const qty = Math.max(1, Number(it.quantity) || 1);
      const catalogProduct =
        db.menuProducts?.[rawProdId] ||
        Object.values(db.menuProducts || {}).find(
          (mp) => mp.id === rawProdId || (it.name && mp.name.toLowerCase() === String(it.name).trim().toLowerCase())
        );

      const resolvedProdId = catalogProduct?.id || rawProdId;
      const canonicalComp = CANONICAL_PACKAGE_COMPOSITIONS[resolvedProdId];
      const snapshotComponents =
        Array.isArray(it.compositionSnapshot) && it.compositionSnapshot.length > 0
          ? it.compositionSnapshot
          : Array.isArray(catalogProduct?.components) && catalogProduct!.components!.length > 0
          ? catalogProduct!.components!
          : canonicalComp?.components;

      if (snapshotComponents && snapshotComponents.length > 0) {
        // 1. Deplete any packaging container recipe attached to the package itself (e.g. recipe-sc-2000-mini -> pack container)
        targets.push({
          productId: resolvedProdId,
          name: catalogProduct?.name || it.name || 'Package',
          quantity: qty,
        });
        // 2. Expand packaging SKU if configured
        const pkg = catalogProduct?.packaging || canonicalComp?.packaging;
        if (pkg && pkg.productId) {
          targets.push({
            productId: pkg.productId,
            name: pkg.name || pkg.productId,
            quantity: (Number(pkg.quantity) || 1) * qty,
            parentPackageName: catalogProduct?.name || it.name,
            parentPackageQty: qty,
          });
        }
        // 3. Expand each component item (e.g. 3 Puff Puff, 1 Samosa, 1 Spring Roll, 1 Beef per 2000 Mini Pack)
        for (const comp of snapshotComponents) {
          const compQty = Math.max(0.01, Number(comp.quantity) || 1) * qty;
          const compProd = db.menuProducts?.[comp.productId];
          targets.push({
            productId: comp.productId,
            name: compProd?.name || comp.productName || comp.productId,
            quantity: compQty,
            parentPackageName: catalogProduct?.name || it.name,
            parentPackageQty: qty,
          });
        }
      } else if (BREAD_WHOLESALE_CRATE_TO_BASE_SKU[resolvedProdId]) {
        // Map wholesale bread SKU to base bread recipe so exact loaf quantity is depleted
        const baseBreadId = BREAD_WHOLESALE_CRATE_TO_BASE_SKU[resolvedProdId];
        targets.push({
          productId: baseBreadId,
          name: catalogProduct?.name || it.name || baseBreadId,
          quantity: qty,
        });
      } else {
        targets.push({
          productId: resolvedProdId,
          name: catalogProduct?.name || it.name || 'Menu Item',
          quantity: qty,
        });
      }
    }

    // 4. Deplete order/check default or custom packaging SKU (e.g. Pack 400 for standalone food/protein takeaway/delivery)
    const matchedOrder =
      db.orders?.[orderRef] ||
      Object.values(db.orders || {}).find((o: any) => o.id === orderRef || o.orderNumber === orderRef);
    const matchedCheck =
      db.checks?.[orderRef] ||
      Object.values(db.checks || {}).find((c: any) => c.id === orderRef || c.checkNumber === orderRef);
    const parentRecord: any = matchedOrder || matchedCheck;

    if (parentRecord) {
      const orderType = String(parentRecord.orderType || parentRecord.checkType || 'dine_in').toLowerCase().replace('-', '_');
      const pkgCalc = calculateDefaultPackagingForItems(db, items as any, {
        orderType,
        selectedPackagingProductId: parentRecord.packagingSkuId,
        selectedPackagingQuantity: parentRecord.packagingQuantity,
      });
      if (pkgCalc.packagingQuantity > 0 && pkgCalc.packagingSkuId) {
        targets.push({
          productId: pkgCalc.packagingSkuId,
          name: pkgCalc.packagingName || pkgCalc.packagingSkuId,
          quantity: pkgCalc.packagingQuantity,
        });
      }
    }

    for (const target of targets) {
      const targetProdId = target.productId;
      const itName = (target.name || '').toLowerCase();
      const recipe = Object.values(db.recipes || {}).find(
        (r: any) =>
          r.menuProductId === targetProdId ||
          r.productId === targetProdId ||
          (r.menuProductName && itName === r.menuProductName.toLowerCase()) ||
          (!target.parentPackageName && r.menuProductName && itName.includes(r.menuProductName.toLowerCase())) ||
          (!target.parentPackageName && itName.includes('jollof') && r.id.includes('jollof')) ||
          (!target.parentPackageName && itName.includes('shawarma') && r.id.includes('shawarma'))
      );

      if (recipe && Array.isArray(recipe.ingredients)) {
        for (const ing of recipe.ingredients) {
          const invItem = db.inventory[ing.ingredientItemId];
          if (invItem) {
            const rawRecipeQty = (Number(ing.quantity || 0) * Number(target.quantity || 1)) / Number(recipe.yieldPortions || 1);
            const unitFactor =
              ing.unit && invItem.baseUnit && ing.unit !== invItem.baseUnit && Number(invItem.recipeUnitFactor) > 0
                ? Number(invItem.recipeUnitFactor)
                : 1;
            const qtyToDeduct = Number((rawRecipeQty * unitFactor).toFixed(4));
            const currentOnHand = invItem.locationStock?.[branchId]?.stockOnHand ?? invItem.currentStock?.[branchId] ?? 0;
            const newOnHand = Number(Math.max(0, currentOnHand - qtyToDeduct).toFixed(4));

            if (!invItem.locationStock) invItem.locationStock = {};
            if (!invItem.locationStock[branchId]) {
              invItem.locationStock[branchId] = {
                stockOnHand: newOnHand,
                availableStock: newOnHand,
                reservedStock: 0,
                minThreshold: 10,
                parLevel: 50,
                reorderLevel: 20,
                reorderQuantity: 30,
                unitCost: invItem.costPerUnit || 1000,
              };
            } else {
              invItem.locationStock[branchId].stockOnHand = newOnHand;
              invItem.locationStock[branchId].availableStock = newOnHand;
            }

            if (invItem.currentStock) {
              invItem.currentStock[branchId] = newOnHand;
            }

            const unitCost = invItem.costPerUnit || 1000;
            const noteDetail = target.parentPackageName
              ? `Package component depletion: ${target.name} (x${target.quantity}) for ${target.parentPackageName} (x${target.parentPackageQty}) - Order #${orderRef}`
              : `Recipe depletion for ${target.name} (x${target.quantity}) - Order #${orderRef}`;

            db.ledger.unshift({
              id: `tx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
              referenceNo: orderRef,
              referenceId: orderRef,
              timestamp: new Date().toISOString(),
              date: new Date().toISOString().split('T')[0],
              itemId: invItem.id,
              itemName: invItem.name,
              sku: invItem.sku || 'SKU-GEN',
              locationId: branchId,
              transactionType: 'POS_DEPLETION',
              quantityDelta: -qtyToDeduct,
              unit: invItem.baseUnit || invItem.unit || ing.unit || 'units',
              unitCost,
              totalValue: Number((qtyToDeduct * unitCost).toFixed(2)),
              balanceBefore: currentOnHand,
              balanceAfter: newOnHand,
              performedByStaffId: staff.id,
              performedByName: staff.name,
              performedByRole: staff.role,
              notes: noteDetail,
            });
          }
        }
      } else {
        // Direct inventory depletion fallback for sellable finished goods or components with direct inventory links
        const directInv =
          db.inventory[targetProdId] ||
          Object.values(db.inventory || {}).find(
            (inv: any) =>
              inv.id === targetProdId ||
              (Array.isArray(inv.linkedProductIds) && inv.linkedProductIds.includes(targetProdId))
          );
        if (directInv) {
          const qtyToDeduct = Number(Number(target.quantity || 1).toFixed(4));
          const currentOnHand = directInv.locationStock?.[branchId]?.stockOnHand ?? directInv.currentStock?.[branchId] ?? 0;
          const newOnHand = Number(Math.max(0, currentOnHand - qtyToDeduct).toFixed(4));

          if (!directInv.locationStock) directInv.locationStock = {};
          if (!directInv.locationStock[branchId]) {
            directInv.locationStock[branchId] = {
              stockOnHand: newOnHand,
              availableStock: newOnHand,
              reservedStock: 0,
              minThreshold: 10,
              parLevel: 50,
              reorderLevel: 20,
              reorderQuantity: 30,
              unitCost: directInv.costPerUnit || 1000,
            };
          } else {
            directInv.locationStock[branchId].stockOnHand = newOnHand;
            directInv.locationStock[branchId].availableStock = newOnHand;
          }

          if (directInv.currentStock) {
            directInv.currentStock[branchId] = newOnHand;
          }

          const unitCost = directInv.costPerUnit || 1000;
          const noteDetail = target.parentPackageName
            ? `Package component direct depletion: ${target.name} (x${target.quantity}) for ${target.parentPackageName} (x${target.parentPackageQty}) - Order #${orderRef}`
            : `Direct inventory depletion for ${target.name} (x${target.quantity}) - Order #${orderRef}`;

          db.ledger.unshift({
            id: `tx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            referenceNo: orderRef,
            referenceId: orderRef,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            itemId: directInv.id,
            itemName: directInv.name,
            sku: directInv.sku || 'SKU-GEN',
            locationId: branchId,
            transactionType: 'POS_DEPLETION',
            quantityDelta: -qtyToDeduct,
            unit: directInv.baseUnit || directInv.unit || 'units',
            unitCost,
            totalValue: Number((qtyToDeduct * unitCost).toFixed(2)),
            balanceBefore: currentOnHand,
            balanceAfter: newOnHand,
            performedByStaffId: staff.id,
            performedByName: staff.name,
            performedByRole: staff.role,
            notes: noteDetail,
          });
        }
      }
    }

    if (orderRef) {
      (db as any).processedDepletionRefs[orderRef] = new Date().toISOString();
    }

    try {
      evaluateInventoryReorderAlerts({
        db,
        saveDatabaseSync,
        dispatchTermiiSms,
        logAuditEvent,
        locationFilter: branchId,
        triggeredByStaff: {
          name: staff?.name || 'POS Depletion Engine',
          role: staff?.role || 'system',
          branchId,
        },
      });
    } catch (err) {
      console.error('[STOCK ALERT] Evaluation after depletion failed:', err);
    }
  };
}

export function createOrderInventoryReverser(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
}) {
  return function reverseInventoryForOrder(
    orderRef: string,
    branchId: string,
    staff: DbStaffAccount,
    reason: string = 'Order voided / refunded'
  ): { reversedCount: number; reversedTransactions: any[] } {
    const { getDb, saveDatabaseSync, logAuditEvent } = deps;
    const db = getDb();
    if (!db || !db.ledger || !Array.isArray(db.ledger)) {
      return { reversedCount: 0, reversedTransactions: [] };
    }

    if (!(db as any).reversedDepletionRefs) {
      (db as any).reversedDepletionRefs = {};
    }
    if ((db as any).reversedDepletionRefs[orderRef]) {
      return { reversedCount: 0, reversedTransactions: [] };
    }

    const depletions = db.ledger.filter(
      (tx: any) =>
        (tx.referenceNo === orderRef || tx.referenceId === orderRef) &&
        tx.transactionType === 'POS_DEPLETION'
    );

    if (depletions.length === 0) {
      return { reversedCount: 0, reversedTransactions: [] };
    }

    const reversedTxs: any[] = [];
    const now = new Date().toISOString();

    for (const tx of depletions) {
      const invItem = db.inventory?.[tx.itemId];
      const qtyToRestore = Math.abs(tx.quantityDelta);
      const loc = tx.locationId || branchId;

      let currentOnHand = 0;
      let newOnHand = 0;

      if (invItem) {
        currentOnHand = invItem.locationStock?.[loc]?.stockOnHand ?? invItem.currentStock?.[loc] ?? 0;
        newOnHand = Number((currentOnHand + qtyToRestore).toFixed(4));

        if (!invItem.locationStock) invItem.locationStock = {};
        if (!invItem.locationStock[loc]) {
          invItem.locationStock[loc] = {
            stockOnHand: newOnHand,
            availableStock: newOnHand,
            reservedStock: 0,
            minThreshold: 10,
            parLevel: 50,
            reorderLevel: 20,
            reorderQuantity: 30,
            unitCost: invItem.costPerUnit || 1000,
          };
        } else {
          invItem.locationStock[loc].stockOnHand = newOnHand;
          invItem.locationStock[loc].availableStock = newOnHand;
        }

        if (invItem.currentStock) {
          invItem.currentStock[loc] = newOnHand;
        }
      }

      const reversalTx = {
        id: `tx-rev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        referenceNo: orderRef,
        referenceId: orderRef,
        timestamp: now,
        date: now.split('T')[0],
        itemId: tx.itemId,
        itemName: tx.itemName,
        sku: tx.sku || 'SKU-GEN',
        locationId: loc,
        transactionType: 'VOID_RESTOCK',
        quantityDelta: qtyToRestore,
        unit: tx.unit || 'units',
        unitCost: tx.unitCost || 0,
        totalValue: Number((qtyToRestore * (tx.unitCost || 0)).toFixed(2)),
        balanceBefore: currentOnHand,
        balanceAfter: newOnHand,
        performedByStaffId: staff.id,
        performedByName: staff.name,
        performedByRole: staff.role,
        notes: `Inventory reversal for order #${orderRef}. Reason: ${reason}. Original depletion: ${tx.notes || ''}`,
      };

      db.ledger.unshift(reversalTx);
      reversedTxs.push(reversalTx);
    }

    (db as any).reversedDepletionRefs[orderRef] = now;
    if ((db as any).processedDepletionRefs) {
      delete (db as any).processedDepletionRefs[orderRef];
    }

    logAuditEvent(
      staff.name,
      staff.role,
      branchId,
      'INVENTORY_REVERSAL',
      `Restocked ${reversedTxs.length} components for order #${orderRef} (${reason})`
    );

    saveDatabaseSync();
    return { reversedCount: reversedTxs.length, reversedTransactions: reversedTxs };
  };
}

export function createPosOfflineAndTableTransferRouter(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: any;
  depleteInventoryForOrder: (
    items: DbCheckItem[],
    branchId: string,
    orderRef: string,
    staff: DbStaffAccount
  ) => void;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
}): Router {
  const router = Router();
  const {
    getDb,
    saveDatabaseSync,
    requireAuth,
    depleteInventoryForOrder,
    logAuditEvent,
  } = deps;

  // 4.3B Offline POS Transaction Reconciliation Engine
  router.post(['/api/pos/sync-offline', '/api/pos/offline/sync'], requireAuth, (req, res) => {
    const db = getDb();
    try {
      const currentStaff = (req as any).staff as DbStaffAccount;
      const rawItems = req.body.items || req.body.queue || [];
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return res.json({ success: true, syncedCount: 0, syncedIds: [], results: [] });
      }

      const syncedIds: string[] = [];
      const results: any[] = [];
      const now = new Date().toISOString();

      for (const item of rawItems) {
        try {
          const { id, action, payload } = item;
          const normAction = String(action || '').toUpperCase();
          if (normAction === 'CREATE_CHECK' || normAction === 'PAY_CHECK') {
            const checkId = payload.id || `chk-off-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
            const branchId = payload.branchId || currentStaff.branchId || 'gra';

            if (db.checks[checkId] && db.checks[checkId].paymentStatus === 'paid') {
              syncedIds.push(id);
              results.push({ id, checkNumber: db.checks[checkId].checkNumber, status: 'already_synced' });
              continue;
            }

            const check: DbCheck = {
              id: checkId,
              checkNumber: payload.checkNumber || `CHK-${String(Object.keys(db.checks).length + 1).padStart(5, '0')}`,
              branchId,
              tableId: payload.tableId,
              tableNumber: payload.tableNumber,
              checkType: payload.checkType || 'dine_in',
              status: payload.status || (action === 'PAY_CHECK' ? 'paid' : 'open'),
              customerName: payload.customerName || 'Offline Customer',
              customerPhone: payload.customerPhone || '',
              guestCount: payload.guestCount || 1,
              items: (payload.items || []).map((it: any) => ({
                id: it.id || `item-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
                productId: it.productId,
                name: it.name,
                quantity: it.quantity || 1,
                unitPrice: it.unitPrice || 0,
                totalPrice: (it.unitPrice || 0) * (it.quantity || 1),
                notes: it.notes,
                status: it.status || 'sent_to_kitchen',
                sentToKitchenAt: it.sentToKitchenAt || now,
                customization: it.customization,
              })),
              subtotal: payload.subtotal || 0,
              discountAmount: payload.discountAmount || 0,
              discountPercent: payload.discountPercent || 0,
              discountReason: payload.discountReason,
              packagingFee: payload.packagingFee || 0,
              deliveryFee: payload.deliveryFee || 0,
              total: payload.total || 0,
              paymentStatus: action === 'PAY_CHECK' ? 'paid' : (payload.paymentStatus || 'unpaid'),
              paymentMethod: payload.paymentMethod,
              paymentDetails: payload.paymentDetails,
              paidAt: action === 'PAY_CHECK' ? (payload.paidAt || now) : undefined,
              settledByStaffId: currentStaff.id,
              settledByName: currentStaff.name,
              openedAt: payload.openedAt || now,
              openedByStaffId: currentStaff.id,
              openedByName: currentStaff.name,
              notes: payload.notes ? `${payload.notes} [Synced from Offline POS]` : '[Synced from Offline POS]',
            };

            db.checks[checkId] = check;

            if (check.paymentStatus === 'paid' && check.paymentMethod === 'cash') {
              const activeShift = Object.values(db.shifts).find(
                (s) => s.branchId === check.branchId && s.status === 'open'
              );
              if (activeShift) {
                activeShift.totalCashSales += check.total;
                activeShift.expectedCashInTill += check.total;
                db.cashMovements.push({
                  id: `cm-off-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
                  shiftId: activeShift.id,
                  branchId: check.branchId,
                  timestamp: now,
                  movementType: 'cash_sale',
                  amount: check.total,
                  reason: `Offline reconciled cash payment for ${check.checkNumber}`,
                  staffId: currentStaff.id,
                  staffName: currentStaff.name,
                  recipientOrRef: check.checkNumber,
                });
              }
            }

            try {
              depleteInventoryForOrder(
                check.items,
                check.branchId,
                check.checkNumber,
                { id: 'offline-sync', name: 'Offline Engine', role: 'cashier', branchId: check.branchId } as any
              );
            } catch {}

            syncedIds.push(id);
            results.push({ id, checkNumber: check.checkNumber, status: 'synced' });
          } else {
            syncedIds.push(id);
            results.push({ id, status: 'acknowledged' });
          }
        } catch (err: any) {
          console.error('[OFFLINE SYNC ITEM ERROR]', err);
        }
      }

      saveDatabaseSync();
      res.json({ success: true, syncedCount: syncedIds.length, syncedIds, results });
    } catch (err: any) {
      console.error('[OFFLINE SYNC ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Transfer Check to Another Table
  router.post('/api/pos/checks/:id/transfer-table', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { newTableId, newTableNumber } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const check = db.checks[id];

    if (!check) return res.status(404).json({ error: 'Check not found.' });

    const oldTableId = check.tableId;
    const oldTableNumber = check.tableNumber;

    if (oldTableId && db.tables[oldTableId]) {
      db.tables[oldTableId].status = 'available';
      db.tables[oldTableId].currentCheckId = undefined;
      db.tables[oldTableId].updatedAt = new Date().toISOString();
    }

    check.tableId = newTableId;
    check.tableNumber = newTableNumber;

    if (newTableId && db.tables[newTableId]) {
      db.tables[newTableId].status = 'ordering';
      db.tables[newTableId].currentCheckId = check.id;
      db.tables[newTableId].guestCount = check.guestCount;
      db.tables[newTableId].updatedAt = new Date().toISOString();
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'STATUS_CHANGED',
      `Transferred check ${check.checkNumber} from ${oldTableNumber} to ${newTableNumber}`
    );

    res.json({ success: true, check });
  });

  return router;
}
