import { Router } from 'express';
import crypto from 'crypto';
import { db, saveDatabaseSync, DbStaffAccount, DEMO_CANONICAL_INVENTORY } from '../../server_db';
import { evaluateInventoryReorderAlerts } from '../services/stockAlertService';
import type { InventoryItemsRouterDeps } from './inventoryItemsRouter';

export function createInventoryStockAndDemoRouter(deps: InventoryItemsRouterDeps): Router {
  const router = Router();
  const { requireAuth, requireRole, logAuditEvent, hasPermission } = deps;

  // DELETE / RETIRE Master Stock Item
  router.delete(
    '/api/inventory/items/:id',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin']),
    async (req, res) => {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;
      const item = db.inventory[id];
      if (!item) return res.status(404).json({ error: 'Inventory item not found.' });

      const inLedger = (db.ledger || []).some((l: any) => l.itemId === id);
      const inRecipes = Object.values(db.recipes || {}).some((r: any) =>
        Array.isArray(r.ingredients) && r.ingredients.some((ing: any) => ing.itemId === id)
      );
      const inPurchaseOrders = Object.values(db.purchaseOrders || {}).filter((p: any) =>
        Array.isArray(p.items) && p.items.some((it: any) => it.itemId === id)
      );
      const inGRN = Object.values(db.goodsReceiptNotes || {}).filter((g: any) => {
        const lines = g.items || g.lines || [];
        return Array.isArray(lines) && lines.some((l: any) => l.itemId === id);
      });
      const inRequests = Object.values(db.requests || {}).filter((r: any) =>
        Array.isArray(r.items) && r.items.some((it: any) => it.itemId === id)
      );
      const inWastage = (db.wastage || []).filter((w: any) => w.itemId === id);
      const inStockCounts = Object.values(db.stockCounts || {}).filter((s: any) =>
        Array.isArray(s.lines) && s.lines.some((l: any) => l.itemId === id)
      );

      let totalStockOnHand = 0;
      for (const loc of ['general_store', 'gra', 'okabere', 'ugbowo']) {
        totalStockOnHand += Number(item.locationStock?.[loc]?.stockOnHand ?? item.currentStock?.[loc] ?? 0);
      }

      const hasReferences =
        inLedger ||
        inRecipes ||
        inPurchaseOrders.length > 0 ||
        inGRN.length > 0 ||
        inRequests.length > 0 ||
        inWastage.length > 0 ||
        inStockCounts.length > 0;

      const hasPositiveStock = totalStockOnHand > 0;

      if (hasReferences || hasPositiveStock) {
        const reasons: string[] = [];
        if (hasPositiveStock) reasons.push(`${totalStockOnHand} ${item.unit} remaining on hand`);
        if (inLedger) reasons.push('historical ledger transactions');
        if (inRecipes) reasons.push('recipe ingredient formulations');
        if (inPurchaseOrders.length > 0) reasons.push(`${inPurchaseOrders.length} purchase orders`);
        if (inGRN.length > 0) reasons.push(`${inGRN.length} goods receipt notes`);
        if (inRequests.length > 0) reasons.push(`${inRequests.length} transfer indents`);
        if (inWastage.length > 0) reasons.push(`${inWastage.length} wastage incidents`);
        if (inStockCounts.length > 0) reasons.push(`${inStockCounts.length} stocktake sessions`);

        item.isActive = false;
        item.isArchived = true;
        item.archivedAt = new Date().toISOString();
        item.archivedByStaffId = currentStaff.id;
        item.archivedByName = currentStaff.name;
        item.updatedAt = new Date().toISOString();
        item.updatedByStaffId = currentStaff.id;
        item.updatedByName = currentStaff.name;

        saveDatabaseSync();
        logAuditEvent(
          currentStaff.name,
          currentStaff.role,
          currentStaff.branchId,
          'ITEM_ARCHIVED',
          `Safely archived stock item ${item.name} (${item.sku}) due to existing references: ${reasons.join(', ')}`
        );

        return res.json({
          success: true,
          action: 'archived',
          message: `Item '${item.name}' cannot be hard-deleted because it has ${reasons.join(', ')}. It has been safely retired and archived from active stock listings.`,
          item,
        });
      }

      const deletedName = item.name;
      const deletedSku = item.sku;
      delete db.inventory[id];

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'ITEM_DELETED',
        `Permanently deleted unreferenced draft stock item ${deletedName} (${deletedSku})`
      );

      res.json({
        success: true,
        action: 'deleted',
        message: `Unreferenced draft item '${deletedName}' (${deletedSku}) was permanently removed.`,
        id,
      });
    }
  );

  // GET Item Movement History Ledger
  router.get('/api/inventory/items/:id/ledger', requireAuth, (req, res) => {
    const { id } = req.params;
    const movements = (db.ledger || []).filter((l: any) => l.itemId === id);
    res.json(movements);
  });

  // POST Manual Stock Level Adjustment
  router.post(
    '/api/inventory/adjust',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'inventory_manager', 'store_manager', 'storekeeper']),
    async (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.adjust')) && !['super_admin', 'corporate_admin', 'inventory_manager', 'store_manager', 'storekeeper'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Stock adjustment requires inventory.adjust privilege.' });
      }
      const { itemId, locationId = 'general_store', newStockOnHand, quantityDelta, reason = 'Manual Adjustment' } = req.body;

      const item = db.inventory[itemId];
      if (!item) {
        return res.status(404).json({ error: `Inventory item '${itemId}' not found.` });
      }

      const validLocations = ['general_store', 'gra', 'okabere', 'ugbowo'];
      const loc = validLocations.includes(locationId) ? locationId : 'general_store';

      const currentOnHand = Number(item.locationStock?.[loc]?.stockOnHand ?? item.currentStock?.[loc] ?? 0);
      let targetOnHand = currentOnHand;

      if (newStockOnHand !== undefined && !isNaN(Number(newStockOnHand))) {
        targetOnHand = Number(newStockOnHand);
      } else if (quantityDelta !== undefined && !isNaN(Number(quantityDelta))) {
        targetOnHand = currentOnHand + Number(quantityDelta);
      }

      if (targetOnHand < 0) {
        return res.status(400).json({ error: `Adjustment result cannot be negative (calculated ${targetOnHand}).` });
      }

      const delta = targetOnHand - currentOnHand;

      if (!item.locationStock) item.locationStock = {};
      if (!item.locationStock[loc]) {
        item.locationStock[loc] = {
          stockOnHand: targetOnHand,
          availableStock: targetOnHand,
          reservedStock: 0,
          minThreshold: item.minThreshold?.[loc] ?? 10,
          parLevel: item.parLevel ?? 50,
          reorderLevel: item.reorderLevel ?? 20,
          reorderQuantity: item.reorderQuantity ?? 30,
          unitCost: item.costPerUnit ?? 0,
        };
      } else {
        item.locationStock[loc].stockOnHand = targetOnHand;
        item.locationStock[loc].availableStock = targetOnHand;
      }

      if (!item.currentStock) item.currentStock = {};
      item.currentStock[loc] = targetOnHand;

      const now = new Date().toISOString();
      const txRef = `ADJ-${Date.now().toString().slice(-6)}`;

      db.ledger.unshift({
        id: `tx-adj-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        referenceNo: txRef,
        timestamp: now,
        date: now.split('T')[0],
        itemId: item.id,
        itemName: item.name,
        sku: item.sku || 'SKU',
        locationId: loc,
        transactionType: delta >= 0 ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
        reasonCategory: reason,
        quantityDelta: delta,
        quantity: Math.abs(delta),
        unit: item.unit || 'units',
        unitCost: item.costPerUnit || 0,
        totalValue: Math.abs(delta) * (item.costPerUnit || 0),
        balanceBefore: currentOnHand,
        balanceAfter: targetOnHand,
        performedByStaffId: currentStaff.id,
        performedByName: currentStaff.name,
        performedByRole: currentStaff.role,
        notes: `Stock adjustment: ${reason} (from ${currentOnHand} to ${targetOnHand})`,
      });

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        loc,
        'STOCK_ADJUSTMENT',
        `Adjusted stock for ${item.name} (${item.sku}) at ${loc}: ${currentOnHand} -> ${targetOnHand} (${reason})`
      );

      evaluateInventoryReorderAlerts({
        branchId: loc,
        triggeredBy: `manual_adjustment:${item.id}`,
      });

      res.json({
        success: true,
        message: `Stock for '${item.name}' at '${loc}' adjusted to ${targetOnHand} ${item.unit}.`,
        itemId: item.id,
        locationId: loc,
        balanceBefore: currentOnHand,
        balanceAfter: targetOnHand,
        delta,
      });
    }
  );

  // SEED Standard Demonstration Stock Items
  router.post(
    '/api/inventory/demo/seed',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'inventory_manager']),
    async (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.demo.seed')) && !['super_admin', 'corporate_admin', 'inventory_manager'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Seeding demo inventory requires inventory.demo.seed privilege.' });
      }
      const seeded: any[] = [];
      let createdCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const now = new Date().toISOString();

      for (const demoItem of DEMO_CANONICAL_INVENTORY) {
        const existing = db.inventory[demoItem.id];
        if (existing) {
          if (!existing.isDemo && existing.dataOrigin !== 'demo') {
            failedCount++;
            continue;
          }
          skippedCount++;
          seeded.push(existing);
          continue;
        }

        const cloned = JSON.parse(JSON.stringify(demoItem));
        cloned.createdAt = now;
        cloned.updatedAt = now;
        cloned.createdByStaffId = currentStaff.id;
        cloned.createdByName = currentStaff.name;
        cloned.updatedByStaffId = currentStaff.id;
        cloned.updatedByName = currentStaff.name;

        db.inventory[cloned.id] = cloned;
        seeded.push(cloned);
        createdCount++;

        for (const loc of ['general_store', 'gra', 'okabere', 'ugbowo']) {
          const onHand = Number(cloned.locationStock?.[loc]?.stockOnHand ?? cloned.currentStock?.[loc] ?? 0);
          const refNo = `DEMO-INIT-${cloned.sku}-${loc}`;
          const hasExistingLedger = (db.ledger || []).some(
            (l: any) => l.itemId === cloned.id && l.locationId === loc && l.reasonCategory === 'Initial Opening Stock'
          );

          if (onHand > 0 && !hasExistingLedger) {
            db.ledger.unshift({
              id: `tx-demo-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
              referenceNo: refNo,
              timestamp: now,
              date: now.split('T')[0],
              itemId: cloned.id,
              itemName: cloned.name,
              sku: cloned.sku,
              locationId: loc,
              transactionType: 'ADJUSTMENT_INCREASE',
              reasonCategory: 'Initial Opening Stock',
              quantityDelta: onHand,
              quantity: onHand,
              unit: cloned.unit,
              unitCost: cloned.costPerUnit,
              totalValue: onHand * cloned.costPerUnit,
              balanceBefore: 0,
              balanceAfter: onHand,
              performedByStaffId: currentStaff.id,
              performedByName: currentStaff.name,
              performedByRole: currentStaff.role,
              notes: 'Demo Catalogue Initializer — Demonstration stock for testing and walkthroughs',
              isDemo: true,
              dataOrigin: 'demo',
            });
          }
        }
      }

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'DEMO_STOCK_SEEDED',
        `Processed demo inventory seeding: ${createdCount} created, ${skippedCount} skipped, ${failedCount} conflicts`
      );

      res.json({
        success: true,
        message: `Demonstration catalogue processing complete: ${createdCount} created, ${skippedCount} already existed, ${failedCount} conflicts.`,
        count: createdCount + skippedCount,
        createdCount,
        skippedCount,
        failedCount,
        items: seeded,
      });
    }
  );

  // RESET / PURGE Demonstration Stock Items
  router.post(
    '/api/inventory/demo/reset',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin']),
    async (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.demo.reset')) && !['super_admin', 'corporate_admin'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Resetting demo inventory requires inventory.demo.reset privilege.' });
      }
      let removedItemsCount = 0;

      for (const id of Object.keys(db.inventory)) {
        const it = db.inventory[id];
        if (it.isDemo === true || it.dataOrigin === 'demo') {
          delete db.inventory[id];
          removedItemsCount++;
        }
      }

      const initialLedgerCount = (db.ledger || []).length;
      db.ledger = (db.ledger || []).filter(
        (l: any) => l.isDemo !== true && l.dataOrigin !== 'demo'
      );
      const removedLedgerCount = initialLedgerCount - db.ledger.length;

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'DEMO_STOCK_RESET',
        `Purged ${removedItemsCount} demo inventory items and ${removedLedgerCount} demo ledger transactions`
      );

      res.json({
        success: true,
        message: `Purged ${removedItemsCount} demo inventory items and ${removedLedgerCount} demo ledger entries. Operational inventory preserved.`,
        removedItemsCount,
        removedLedgerCount,
      });
    }
  );

  router.put(
    ['/api/inventory/items/:id/stock', '/api/inventory/:id/stock'],
    requireAuth,
    requireRole(['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'corporate_admin', 'super_admin']),
    async (req, res) => {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.adjust')) && !['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'corporate_admin', 'super_admin'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Updating stock requires inventory.adjust privilege.' });
      }
      const isGlobal = ['super_admin', 'corporate_admin', 'inventory_manager', 'storekeeper'].includes(currentStaff.role);
      const branchId = isGlobal ? (req.body.branchId || req.body.locationId || currentStaff.branchId) : currentStaff.branchId;

      if (!isGlobal && (req.body.branchId && req.body.branchId !== currentStaff.branchId)) {
        return res.status(403).json({
          error: `Cannot adjust inventory for branch '${req.body.branchId}'. Access restricted to '${currentStaff.branchId}'.`,
        });
      }

      const rawStock = req.body.newStock !== undefined ? req.body.newStock : req.body.quantity;
      const newStock = Number(rawStock);

      if (isNaN(newStock) || newStock < 0) {
        return res.status(400).json({
          error: 'Stock quantity must be a valid non-negative number. Negative stock is strictly prohibited.',
        });
      }

      const item = db.inventory[id];
      if (!item) return res.status(404).json({ error: 'Inventory item not found.' });

      const previous = item.locationStock?.[branchId]?.stockOnHand ?? item.currentStock?.[branchId] ?? 0;
      const qtyDelta = newStock - previous;

      if (!item.locationStock) item.locationStock = {};
      if (!item.locationStock[branchId]) {
        item.locationStock[branchId] = {
          stockOnHand: newStock,
          availableStock: newStock,
          reservedStock: 0,
          minThreshold: 10,
          parLevel: 50,
          reorderLevel: 20,
          reorderQuantity: 30,
          unitCost: item.costPerUnit || 1000,
        };
      } else {
        item.locationStock[branchId].stockOnHand = newStock;
        item.locationStock[branchId].availableStock = newStock;
      }

      if (item.currentStock) item.currentStock[branchId] = newStock;

      db.ledger.unshift({
        id: `tx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        referenceNo: `ADJ-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        itemId: item.id,
        itemName: item.name,
        sku: item.sku || 'SKU-GEN',
        locationId: branchId,
        transactionType: qtyDelta >= 0 ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
        quantityDelta: qtyDelta,
        quantity: Math.abs(qtyDelta),
        unit: item.unit || 'units',
        unitCost: item.costPerUnit || 1000,
        totalValue: Math.abs(qtyDelta) * (item.costPerUnit || 1000),
        balanceBefore: previous,
        balanceAfter: newStock,
        performedByStaffId: currentStaff.id,
        performedByName: currentStaff.name,
        performedByRole: currentStaff.role,
        notes: req.body.reason || req.body.notes || `Stock adjusted from ${previous} to ${newStock}`,
        isDemo: Boolean(item.isDemo),
      });

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'STOCK_MODIFIED',
        `Updated ${item.name} at ${branchId} from ${previous} to ${newStock} ${item.unit}`
      );

      evaluateInventoryReorderAlerts({
        branchId,
        triggeredBy: `stock_adjustment:${currentStaff.name}`,
      });

      res.json({ success: true, item });
    }
  );

  return router;
}
