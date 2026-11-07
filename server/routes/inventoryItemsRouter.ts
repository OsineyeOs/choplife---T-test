import { Router, RequestHandler } from 'express';
import crypto from 'crypto';
import { db, saveDatabaseSync, DbStaffAccount } from '../../server_db';
import { createInventoryStockAndDemoRouter } from './inventoryStockAndDemoRouter';

export interface InventoryItemsRouterDeps {
  requireAuth: RequestHandler;
  requireRole: (roles: string[]) => RequestHandler;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    description: string
  ) => any;
  hasPermission: (staff: DbStaffAccount, permissionCode: string) => Promise<boolean>;
}

export function createInventoryItemsRouter(deps: InventoryItemsRouterDeps): Router {
  const router = Router();
  const { requireAuth, requireRole, logAuditEvent, hasPermission } = deps;

  router.get('/api/inventory', requireAuth, (_req, res) => {
    res.json(Object.values(db.inventory));
  });

  // GET Master Stock Items with Search & Filters (Active, Archived, Demo, Operational, Category, Stock Level)
  router.get('/api/inventory/items', requireAuth, (req, res) => {
    const { search, category, status = 'all', origin = 'all', stockLevel = 'all', locationId } = req.query;
    let items = Object.values(db.inventory || {});

    if (status === 'active') {
      items = items.filter((it: any) => it.isActive !== false && !it.isArchived);
    } else if (status === 'archived') {
      items = items.filter((it: any) => it.isActive === false || it.isArchived === true);
    }

    if (origin === 'operational') {
      items = items.filter((it: any) => !it.isDemo && it.dataOrigin !== 'demo');
    } else if (origin === 'demo') {
      items = items.filter((it: any) => it.isDemo === true || it.dataOrigin === 'demo');
    }

    if (category && category !== 'all') {
      const catLower = String(category).toLowerCase();
      items = items.filter((it: any) => (it.category || '').toLowerCase() === catLower);
    }

    if (search && String(search).trim()) {
      const q = String(search).toLowerCase().trim();
      items = items.filter((it: any) => {
        const name = (it.name || '').toLowerCase();
        const sku = (it.sku || '').toLowerCase();
        const barcode = (it.barcode || '').toLowerCase();
        const desc = (it.description || '').toLowerCase();
        const notes = (it.notes || '').toLowerCase();
        return name.includes(q) || sku.includes(q) || barcode.includes(q) || desc.includes(q) || notes.includes(q);
      });
    }

    if (stockLevel && stockLevel !== 'all') {
      const isSpecificLocation = Boolean(locationId && locationId !== 'all');
      const locIdStr = isSpecificLocation ? String(locationId) : null;
      const canonicalLocations = ['general_store', 'gra', 'okabere', 'ugbowo'];

      items = items.filter((it: any) => {
        if (isSpecificLocation && locIdStr) {
          const onHand = Number(it.locationStock?.[locIdStr]?.stockOnHand ?? it.currentStock?.[locIdStr] ?? 0);
          const minThresh = Number(it.locationStock?.[locIdStr]?.minThreshold ?? it.minThreshold?.[locIdStr] ?? 10);

          if (stockLevel === 'out_of_stock') return onHand <= 0;
          if (stockLevel === 'low_stock') return onHand > 0 && onHand <= minThresh;
          if (stockLevel === 'in_stock') return onHand > 0;
          return true;
        } else {
          let networkStock = 0;
          let networkMinThreshold = 0;

          for (const loc of canonicalLocations) {
            const onHand = Number(it.locationStock?.[loc]?.stockOnHand ?? it.currentStock?.[loc] ?? 0);
            const minThresh = Number(it.locationStock?.[loc]?.minThreshold ?? it.minThreshold?.[loc] ?? 10);
            networkStock += onHand;
            networkMinThreshold += minThresh;
          }

          if (stockLevel === 'out_of_stock') return networkStock <= 0;
          if (stockLevel === 'low_stock') return networkStock > 0 && networkStock <= networkMinThreshold;
          if (stockLevel === 'in_stock') return networkStock > 0;
          return true;
        }
      });
    }

    res.json(items);
  });

  // GET Item by ID with Detailed Reference Audit
  router.get('/api/inventory/items/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const item = db.inventory[id];
    if (!item) return res.status(404).json({ error: 'Inventory item not found.' });

    const ledgerRefs = (db.ledger || []).filter((l: any) => l.itemId === id);
    const recipeRefs = Object.values(db.recipes || {}).filter((r: any) =>
      Array.isArray(r.ingredients) && r.ingredients.some((ing: any) => ing.itemId === id)
    );
    const poRefs = Object.values(db.purchaseOrders || {}).filter((p: any) =>
      Array.isArray(p.items) && p.items.some((it: any) => it.itemId === id)
    );
    const grnRefs = Object.values(db.goodsReceiptNotes || {}).filter((g: any) => {
      const lines = g.items || g.lines || [];
      return Array.isArray(lines) && lines.some((l: any) => l.itemId === id);
    });
    const requestRefs = Object.values(db.requests || {}).filter((r: any) =>
      Array.isArray(r.items) && r.items.some((it: any) => it.itemId === id)
    );
    const wastageRefs = (db.wastage || []).filter((w: any) => w.itemId === id);
    const stockCountRefs = Object.values(db.stockCounts || {}).filter((s: any) =>
      Array.isArray(s.lines) && s.lines.some((l: any) => l.itemId === id)
    );

    let totalStockOnHand = 0;
    for (const loc of ['general_store', 'gra', 'okabere', 'ugbowo']) {
      const onHand = Number(item.locationStock?.[loc]?.stockOnHand ?? item.currentStock?.[loc] ?? 0);
      totalStockOnHand += onHand;
    }

    const hasReferences =
      ledgerRefs.length > 0 ||
      recipeRefs.length > 0 ||
      poRefs.length > 0 ||
      grnRefs.length > 0 ||
      requestRefs.length > 0 ||
      wastageRefs.length > 0 ||
      stockCountRefs.length > 0;

    const hasPositiveStock = totalStockOnHand > 0;
    const canHardDelete = !hasReferences && !hasPositiveStock;

    res.json({
      item,
      referenceAudit: {
        totalStockOnHand,
        hasPositiveStock,
        hasReferences,
        canHardDelete,
        deleteAction: canHardDelete ? 'hard_delete' : 'archive',
        counts: {
          ledger: ledgerRefs.length,
          recipes: recipeRefs.length,
          purchaseOrders: poRefs.length,
          goodsReceiptNotes: grnRefs.length,
          requests: requestRefs.length,
          wastage: wastageRefs.length,
          stockCounts: stockCountRefs.length,
        },
      },
    });
  });

  // CREATE New Master Stock Item
  router.post(
    '/api/inventory/items',
    requireAuth,
    async (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.manage')) && !['super_admin', 'corporate_admin', 'admin', 'inventory_manager', 'inventory_controller', 'store_manager', 'store_incharge', 'branch_manager', 'storekeeper'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Inventory management requires inventory.manage privilege.' });
      }
      const {
        name,
        sku,
        barcode,
        description,
        category,
        subcategory,
        inventoryType = 'raw_material',
        storageArea = 'dry_store',
        baseUnit = 'units',
        unit = baseUnit || 'units',
        purchaseUnit = unit,
        purchaseUnitFactor = 1,
        recipeUnit = unit,
        recipeUnitFactor = 1,
        costPerUnit = 0,
        sellingPrice = 0,
        preferredSupplierId,
        minThreshold = 10,
        parLevel = 50,
        reorderLevel = 20,
        reorderQuantity = 30,
        initialStock = 0,
        initialLocationId = 'general_store',
        isDemo = false,
        dataOrigin = isDemo ? 'demo' : 'operational',
        notes = '',
      } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Item name is required and cannot be empty.' });
      }
      if (!category || typeof category !== 'string' || !category.trim()) {
        return res.status(400).json({ error: 'Item category is required.' });
      }

      const trimmedName = name.trim();
      const rawSku = sku && String(sku).trim() ? String(sku).trim().toUpperCase() : '';
      if (rawSku && !/^[A-Z0-9][A-Z0-9-_]{2,31}$/.test(rawSku)) {
        return res.status(400).json({
          error:
            'Invalid SKU format. Use uppercase letters, numbers, and hyphens (3–32 chars), e.g., CL-MEAT-001, CL-RICE-001, or CL-PACK-001.',
        });
      }
      const effectiveSku = rawSku || `CL-${String(category).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'ITEM'}-${Date.now().toString().slice(-4)}`;

      const existingWithSku = Object.values(db.inventory).find(
        (it: any) => (it.sku || '').toUpperCase() === effectiveSku
      );
      if (existingWithSku) {
        return res.status(409).json({
          error: `SKU conflict: '${effectiveSku}' is already assigned to '${existingWithSku.name}' (${existingWithSku.id}). SKU must be globally unique.`,
        });
      }

      const id = req.body.id || `inv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      if (db.inventory[id]) {
        return res.status(409).json({ error: `Item with ID '${id}' already exists.` });
      }

      const initStockNum = Number(initialStock);
      if (isNaN(initStockNum) || initStockNum < 0) {
        return res.status(400).json({ error: 'Initial stock quantity must be a non-negative number.' });
      }

      const canonicalLocations = ['general_store', 'gra', 'okabere', 'ugbowo'];
      const targetLoc = canonicalLocations.includes(initialLocationId) ? initialLocationId : 'general_store';

      const locationStockMap: Record<string, any> = {};
      const currentStockMap: Record<string, number> = {};
      const minThresholdMap: Record<string, number> = {};

      for (const loc of canonicalLocations) {
        const locOnHand = loc === targetLoc ? initStockNum : 0;
        locationStockMap[loc] = {
          stockOnHand: locOnHand,
          availableStock: locOnHand,
          reservedStock: 0,
          minThreshold: Number(minThreshold) || 10,
          parLevel: Number(parLevel) || 50,
          reorderLevel: Number(reorderLevel) || 20,
          reorderQuantity: Number(reorderQuantity) || 30,
          unitCost: Number(costPerUnit) || 0,
        };
        currentStockMap[loc] = locOnHand;
        minThresholdMap[loc] = Number(minThreshold) || 10;
      }

      const now = new Date().toISOString();
      const newItem: any = {
        id,
        sku: effectiveSku,
        barcode: barcode ? String(barcode).trim() : undefined,
        name: trimmedName,
        description: description ? String(description).trim() : '',
        category: String(category).toLowerCase().trim(),
        subcategory: subcategory ? String(subcategory).trim() : undefined,
        inventoryType,
        storageArea,
        baseUnit: String(baseUnit).trim(),
        unit: String(unit).trim(),
        purchaseUnit: String(purchaseUnit).trim(),
        purchaseUnitFactor: Number(purchaseUnitFactor) || 1,
        recipeUnit: String(recipeUnit).trim(),
        recipeUnitFactor: Number(recipeUnitFactor) || 1,
        costPerUnit: Number(costPerUnit) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        preferredSupplierId: preferredSupplierId || undefined,
        locationStock: locationStockMap,
        currentStock: currentStockMap,
        minThreshold: minThresholdMap,
        parLevel: Number(parLevel) || 50,
        reorderLevel: Number(reorderLevel) || 20,
        reorderQuantity: Number(reorderQuantity) || 30,
        isActive: true,
        isArchived: false,
        isSellable: Boolean(req.body.isSellable),
        isPurchasable: req.body.isPurchasable !== false,
        isDemo: Boolean(isDemo),
        dataOrigin: Boolean(isDemo) ? 'demo' : (dataOrigin || 'operational'),
        demoBatchId: Boolean(isDemo) ? (req.body.demoBatchId || 'demo-batch-custom') : undefined,
        notes: notes ? String(notes).trim() : '',
        createdAt: now,
        updatedAt: now,
        createdByStaffId: currentStaff.id,
        createdByName: currentStaff.name,
        updatedByStaffId: currentStaff.id,
        updatedByName: currentStaff.name,
      };

      db.inventory[id] = newItem;

      if (initStockNum > 0) {
        const txRef = `INIT-${Date.now().toString().slice(-6)}`;
        db.ledger.unshift({
          id: `tx-init-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          referenceNo: txRef,
          timestamp: now,
          date: now.split('T')[0],
          itemId: id,
          itemName: trimmedName,
          sku: effectiveSku,
          locationId: targetLoc,
          transactionType: 'ADJUSTMENT_INCREASE',
          reasonCategory: 'Initial Opening Stock',
          quantityDelta: initStockNum,
          quantity: initStockNum,
          unit: newItem.unit,
          unitCost: newItem.costPerUnit,
          totalValue: initStockNum * newItem.costPerUnit,
          balanceBefore: 0,
          balanceAfter: initStockNum,
          performedByStaffId: currentStaff.id,
          performedByName: currentStaff.name,
          performedByRole: currentStaff.role,
          notes: req.body.openingStockNotes || `Initial opening stock recorded at ${targetLoc} on item creation`,
          isDemo: Boolean(isDemo),
        });
      }

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        targetLoc,
        'ITEM_CREATED',
        `Created stock item ${trimmedName} (${effectiveSku})${initStockNum > 0 ? ` with opening balance of ${initStockNum} ${newItem.unit} at ${targetLoc}` : ''}`
      );

      res.status(201).json({ success: true, item: newItem });
    }
  );

  // EDIT Master Stock Item Details
  router.put(
    '/api/inventory/items/:id',
    requireAuth,
    async (req, res) => {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.manage')) && !['super_admin', 'corporate_admin', 'admin', 'inventory_manager', 'inventory_controller', 'store_manager', 'store_incharge', 'branch_manager', 'storekeeper'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Inventory management requires inventory.manage privilege.' });
      }
      const item = db.inventory[id];
      if (!item) return res.status(404).json({ error: 'Inventory item not found.' });

      const {
        name,
        sku,
        barcode,
        description,
        category,
        subcategory,
        inventoryType,
        storageArea,
        baseUnit,
        unit,
        purchaseUnit,
        purchaseUnitFactor,
        recipeUnit,
        recipeUnitFactor,
        costPerUnit,
        sellingPrice,
        preferredSupplierId,
        minThreshold,
        parLevel,
        reorderLevel,
        reorderQuantity,
        isActive,
        isArchived,
        isSellable,
        isPurchasable,
        notes,
      } = req.body;

      if (sku && String(sku).trim()) {
        const targetSku = String(sku).trim().toUpperCase();
        const duplicate = Object.values(db.inventory).find(
          (it: any) => it.id !== id && (it.sku || '').toUpperCase() === targetSku
        );
        if (duplicate) {
          return res.status(409).json({
            error: `SKU conflict: '${targetSku}' is already assigned to '${duplicate.name}' (${duplicate.id}).`,
          });
        }
        item.sku = targetSku;
      }

      if (name && typeof name === 'string' && name.trim()) item.name = name.trim();
      if (barcode !== undefined) item.barcode = barcode ? String(barcode).trim() : undefined;
      if (description !== undefined) item.description = String(description).trim();
      if (category && typeof category === 'string' && category.trim()) item.category = String(category).toLowerCase().trim();
      if (subcategory !== undefined) item.subcategory = subcategory ? String(subcategory).trim() : undefined;
      if (inventoryType) item.inventoryType = inventoryType;
      if (storageArea) item.storageArea = storageArea;
      if (baseUnit) item.baseUnit = String(baseUnit).trim();
      if (unit) item.unit = String(unit).trim();
      if (purchaseUnit) item.purchaseUnit = String(purchaseUnit).trim();
      if (purchaseUnitFactor !== undefined) item.purchaseUnitFactor = Number(purchaseUnitFactor) || 1;
      if (recipeUnit) item.recipeUnit = String(recipeUnit).trim();
      if (recipeUnitFactor !== undefined) item.recipeUnitFactor = Number(recipeUnitFactor) || 1;
      if (costPerUnit !== undefined) {
        item.costPerUnit = Number(costPerUnit) || 0;
        if (item.locationStock) {
          for (const loc of Object.keys(item.locationStock)) {
            if (item.locationStock[loc]) item.locationStock[loc].unitCost = item.costPerUnit;
          }
        }
      }
      if (sellingPrice !== undefined) item.sellingPrice = Number(sellingPrice) || 0;
      if (preferredSupplierId !== undefined) item.preferredSupplierId = preferredSupplierId || undefined;
      if (notes !== undefined) item.notes = String(notes).trim();
      if (isSellable !== undefined) item.isSellable = Boolean(isSellable);
      if (isPurchasable !== undefined) item.isPurchasable = Boolean(isPurchasable);

      const canArchiveOrDeactivate = [
        'super_admin',
        'corporate_admin',
        'admin',
        'inventory_manager',
        'inventory_controller',
        'store_manager',
        'branch_manager',
      ].includes(currentStaff.role);

      if ((isArchived !== undefined || isActive !== undefined) && !canArchiveOrDeactivate) {
        return res.status(403).json({
          error: `Role '${currentStaff.role}' is not authorized to archive or deactivate master inventory items.`,
        });
      }

      if (isActive !== undefined) item.isActive = Boolean(isActive);
      if (isArchived !== undefined) item.isArchived = Boolean(isArchived);

      if (minThreshold !== undefined || parLevel !== undefined || reorderLevel !== undefined || reorderQuantity !== undefined) {
        const minNum = Number(minThreshold) || 10;
        const parNum = Number(parLevel) || 50;
        const reorderNum = Number(reorderLevel) || 20;
        const reorderQtyNum = Number(reorderQuantity) || 30;

        item.parLevel = parNum;
        item.reorderLevel = reorderNum;
        item.reorderQuantity = reorderQtyNum;

        if (!item.locationStock) item.locationStock = {};
        for (const loc of ['general_store', 'gra', 'okabere', 'ugbowo']) {
          if (!item.locationStock[loc]) {
            item.locationStock[loc] = {
              stockOnHand: item.currentStock?.[loc] ?? 0,
              availableStock: item.currentStock?.[loc] ?? 0,
              reservedStock: 0,
              minThreshold: minNum,
              parLevel: parNum,
              reorderLevel: reorderNum,
              reorderQuantity: reorderQtyNum,
              unitCost: item.costPerUnit || 0,
            };
          } else {
            item.locationStock[loc].minThreshold = minNum;
            item.locationStock[loc].parLevel = parNum;
            item.locationStock[loc].reorderLevel = reorderNum;
            item.locationStock[loc].reorderQuantity = reorderQtyNum;
          }
          if (!item.minThreshold) item.minThreshold = {};
          item.minThreshold[loc] = minNum;
        }
      }

      item.updatedAt = new Date().toISOString();
      item.updatedByStaffId = currentStaff.id;
      item.updatedByName = currentStaff.name;

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'ITEM_UPDATED',
        `Updated metadata & settings for stock item ${item.name} (${item.sku})`
      );

      res.json({ success: true, item });
    }
  );

  router.use(createInventoryStockAndDemoRouter(deps));

  return router;
}
