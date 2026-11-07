import { Router, RequestHandler } from 'express';
import crypto from 'crypto';
import { db, saveDatabaseSync, DbStaffAccount } from '../../server_db';
import { evaluateInventoryReorderAlerts } from '../services/stockAlertService';
import { createPurchasingAndStockCountsRouter } from './purchasingAndStockCountsRouter';

export interface ProcurementAndLedgerRouterDeps {
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

export function createProcurementAndLedgerRouter(deps: ProcurementAndLedgerRouterDeps): Router {
  const router = Router();
  const { requireAuth, requireRole, logAuditEvent, hasPermission } = deps;

  router.get('/api/inventory/ledger', requireAuth, (_req, res) => {
    res.json(db.ledger);
  });

  router.get('/api/inventory/requests', requireAuth, (_req, res) => {
    res.json(Object.values(db.requests));
  });

  router.post(
    '/api/inventory/requests',
    requireAuth,
    async (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.transfer.request')) && !['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'kitchen_lead', 'corporate_admin', 'super_admin'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Stock request requires inventory.transfer.request privilege.' });
      }
      const sourceLocation = req.body.sourceLocation || req.body.fromBranchId || 'general_store';
      const destinationLocation = req.body.destinationLocation || req.body.toBranchId || currentStaff.branchId;
      const priority = req.body.priority || req.body.urgency || 'normal';
      const notes = req.body.notes || '';
      const items = Array.isArray(req.body.items) && req.body.items.length > 0
        ? req.body.items
        : (req.body.itemId ? [{ itemId: req.body.itemId, requestedQty: req.body.quantity ?? req.body.requestedQty }] : []);

      const validLocations = ['general_store', 'gra', 'okabere', 'ugbowo'];
      if (!validLocations.includes(sourceLocation) || !validLocations.includes(destinationLocation)) {
        return res.status(400).json({
          error: `Invalid sourceLocation ('${sourceLocation}') or destinationLocation ('${destinationLocation}'). Allowed: ${validLocations.join(', ')}`,
        });
      }
      if (sourceLocation === destinationLocation) {
        return res.status(400).json({
          error: `Source location ('${sourceLocation}') and destination location ('${destinationLocation}') cannot be identical.`,
        });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Stock request must contain at least one inventory item.' });
      }

      for (const it of items) {
        const reqQty = Number(it.requestedQty ?? it.quantityRequested ?? 0);
        if (!it.itemId || !db.inventory[it.itemId]) {
          return res.status(400).json({ error: `Unknown inventory item ID: '${it.itemId}'.` });
        }
        if (Number.isNaN(reqQty) || reqQty <= 0) {
          return res.status(400).json({ error: `Requested quantity for '${it.itemId}' must be greater than 0.` });
        }
      }

      const id = `req-${Date.now()}`;
      const requestNumber = `IND-${String(Object.keys(db.requests).length + 1).padStart(5, '0')}`;

      const enrichedItems = items.map((it: any) => {
        const invItem = db.inventory[it.itemId];
        const reqQty = Number(it.requestedQty ?? it.quantityRequested ?? 0) || 1;
        return {
          itemId: it.itemId,
          itemName: it.itemName || invItem?.name || 'Inventory Item',
          sku: it.sku || invItem?.sku || 'SKU',
          unit: it.unit || invItem?.unit || 'units',
          requestedQty: reqQty,
          quantityRequested: reqQty,
          approvedQty: reqQty,
          issuedQty: 0,
          receivedQty: 0,
        };
      });

      const request = {
        id,
        requestNumber,
        sourceLocation,
        destinationLocation,
        requestedByStaffId: currentStaff.id,
        requestedByName: currentStaff.name,
        requestedAt: new Date().toISOString(),
        priority,
        items: enrichedItems,
        notes,
        status: 'requested',
      };

      db.requests[id] = request;
      saveDatabaseSync();
      logAuditEvent(currentStaff.name, currentStaff.role, currentStaff.branchId, 'TRANSFER', `Created stock indent ${requestNumber} from ${sourceLocation} to ${destinationLocation}`);

      res.status(201).json({ success: true, request });
    }
  );

  const handleReviewIndent = async (req: any, res: any) => {
    const { id } = req.params;
    const { status } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const request = db.requests[id];

    if (!request) return res.status(404).json({ error: 'Stock request indent not found.' });
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: `Invalid review status '${status}'.` });
    }

    if (!(await hasPermission(currentStaff, 'inventory.transfer.review')) && !['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'inventory_manager', 'store_manager'].includes(currentStaff.role)) {
      return res.status(403).json({ error: 'Access denied: Stock request review requires inventory.transfer.review privilege.' });
    }
    const isSupervisorOrAdmin = ['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'inventory_manager', 'store_manager'].includes(currentStaff.role);
    if (
      status === 'approved' &&
      request.requestedByStaffId === currentStaff.id &&
      !isSupervisorOrAdmin
    ) {
      return res.status(403).json({
        error: 'Separation of duties violation: A storekeeper cannot approve their own stock indent request. Approval requires an Inventory Manager, Branch Manager, or Administrator.',
      });
    }

    request.status = status;
    (request as any).reviewedAt = new Date().toISOString();
    (request as any).reviewedByStaffId = currentStaff.id;
    (request as any).reviewedByName = currentStaff.name;

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'TRANSFER',
      `Reviewed stock indent ${request.requestNumber}: ${status}`
    );

    res.json({ success: true, request });
  };

  router.put(
    '/api/inventory/requests/:id/review',
    requireAuth,
    requireRole(['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'corporate_admin', 'super_admin']),
    handleReviewIndent
  );

  router.post(
    '/api/inventory/requests/:id/review',
    requireAuth,
    requireRole(['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'corporate_admin', 'super_admin']),
    handleReviewIndent
  );

  router.post(
    '/api/inventory/requests/:id/dispatch',
    requireAuth,
    async (req, res) => {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.transfer.dispatch')) && !['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'corporate_admin', 'super_admin'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Stock transfer dispatch requires inventory.transfer.dispatch privilege.' });
      }
      const request = db.requests[id];

      if (!request) return res.status(404).json({ error: 'Stock request indent not found.' });
      if (request.status !== 'requested' && request.status !== 'pending' && request.status !== 'approved') {
        return res.status(400).json({ error: `Request already has status '${request.status}'` });
      }

      const issuedMap = new Map<string, number>();
      if (Array.isArray(req.body?.issuedItems)) {
        for (const iss of req.body.issuedItems) {
          if (iss?.itemId) {
            issuedMap.set(iss.itemId, Number(iss.issuedQty));
          }
        }
      }

      const src = request.sourceLocation;
      const itemsToDispatch = Array.isArray(request.items) ? request.items : [];

      for (const it of itemsToDispatch) {
        const invItem = db.inventory[it.itemId];
        if (!invItem) {
          return res.status(400).json({ error: `Inventory item '${it.itemId}' not found.` });
        }
        const qtyIssued =
          issuedMap.has(it.itemId)
            ? Number(issuedMap.get(it.itemId))
            : Number(it.issuedQty || it.approvedQty || it.requestedQty || it.quantityRequested || 0);

        if (Number.isNaN(qtyIssued) || qtyIssued <= 0) {
          return res.status(400).json({ error: `Issued quantity for ${invItem.name} must be greater than 0.` });
        }

        const currentOnHand = Number(invItem.locationStock?.[src]?.stockOnHand ?? invItem.currentStock?.[src] ?? 0) || 0;
        if (qtyIssued > currentOnHand) {
          return res.status(400).json({
            error: `Insufficient stock at '${src}' for ${invItem.name}: available ${currentOnHand} ${invItem.unit}, requested to dispatch ${qtyIssued} ${invItem.unit}.`,
          });
        }
      }

      const now = new Date().toISOString();
      request.status = 'in_transit';
      (request as any).dispatchedAt = now;
      (request as any).dispatchedByStaffId = currentStaff.id;
      (request as any).dispatchedByName = currentStaff.name;

      for (const it of itemsToDispatch) {
        const invItem = db.inventory[it.itemId];
        const qtyIssued =
          issuedMap.has(it.itemId)
            ? Number(issuedMap.get(it.itemId))
            : Number(it.issuedQty || it.approvedQty || it.requestedQty || it.quantityRequested || 0);

        it.issuedQty = qtyIssued;
        if (!it.itemName && invItem) it.itemName = invItem.name;
        if (!it.sku && invItem) it.sku = invItem.sku;
        if (!it.unit && invItem) it.unit = invItem.unit;

        if (invItem && qtyIssued > 0) {
          const currentOnHand = Number(invItem.locationStock?.[src]?.stockOnHand ?? invItem.currentStock?.[src] ?? 0) || 0;
          const newOnHand = currentOnHand - qtyIssued;

          if (!invItem.locationStock) invItem.locationStock = {};
          if (invItem.locationStock[src]) {
            invItem.locationStock[src].stockOnHand = newOnHand;
            invItem.locationStock[src].availableStock = newOnHand;
          }
          if (invItem.currentStock) invItem.currentStock[src] = newOnHand;

          db.ledger.unshift({
            id: `tx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            referenceNo: request.requestNumber,
            timestamp: now,
            date: now.split('T')[0],
            itemId: invItem.id,
            itemName: invItem.name,
            sku: invItem.sku || 'SKU-TRF',
            locationId: src,
            transactionType: 'TRANSFER_OUT',
            quantityDelta: -qtyIssued,
            unit: it.unit || invItem.unit || 'units',
            unitCost: invItem.costPerUnit || 1000,
            totalValue: qtyIssued * (invItem.costPerUnit || 1000),
            balanceBefore: currentOnHand,
            balanceAfter: newOnHand,
            performedByStaffId: currentStaff.id,
            performedByName: currentStaff.name,
            performedByRole: currentStaff.role,
            notes: `Dispatched to ${request.destinationLocation} via ${request.requestNumber}`,
          });
        }
      }

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'TRANSFER',
        `Dispatched stock indent ${request.requestNumber} from ${request.sourceLocation} to ${request.destinationLocation}`
      );

      evaluateInventoryReorderAlerts({
        branchId: src,
        triggeredBy: `transfer_dispatch:${request.requestNumber}`,
      });

      res.json({ success: true, request });
    }
  );

  router.post(
    '/api/inventory/requests/:id/receive',
    requireAuth,
    async (req, res) => {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.transfer.receive')) && !['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'kitchen_lead', 'corporate_admin', 'super_admin'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Stock transfer receipt requires inventory.transfer.receive privilege.' });
      }
      const request = db.requests[id];

      if (!request) return res.status(404).json({ error: 'Stock request indent not found.' });
      if (request.status !== 'in_transit' && request.status !== 'dispatched') {
        return res.status(400).json({ error: `Cannot receive stock indent that is not in 'in_transit' or 'dispatched' state (currently '${request.status}')` });
      }

      const receivedMap = new Map<string, number>();
      if (Array.isArray(req.body?.receivedItems)) {
        for (const rec of req.body.receivedItems) {
          if (rec?.itemId) {
            receivedMap.set(rec.itemId, Number(rec.receivedQty));
          }
        }
      }

      const itemsToReceive = Array.isArray(request.items) ? request.items : [];

      for (const it of itemsToReceive) {
        const dispatchedQty = Number(it.issuedQty ?? it.requestedQty ?? it.quantityRequested ?? 0);
        const qtyReceived = receivedMap.has(it.itemId)
          ? Number(receivedMap.get(it.itemId))
          : dispatchedQty;
        if (Number.isNaN(qtyReceived) || qtyReceived < 0 || qtyReceived > dispatchedQty) {
          return res.status(400).json({
            error: `Invalid received quantity (${qtyReceived}) for ${it.itemName || it.itemId}: cannot exceed dispatched quantity (${dispatchedQty}).`,
          });
        }
      }

      const now = new Date().toISOString();
      request.status = 'completed';
      (request as any).receivedAt = now;
      (request as any).receivedByStaffId = currentStaff.id;
      (request as any).receivedByName = currentStaff.name;

      const dest = request.destinationLocation;
      for (const it of itemsToReceive) {
        const invItem = db.inventory[it.itemId];
        const dispatchedQty = Number(it.issuedQty ?? it.requestedQty ?? it.quantityRequested ?? 0);
        const qtyReceived = receivedMap.has(it.itemId)
          ? Number(receivedMap.get(it.itemId))
          : dispatchedQty;
        it.receivedQty = qtyReceived;

        if (invItem && qtyReceived > 0) {
          const currentOnHand = Number(invItem.locationStock?.[dest]?.stockOnHand ?? invItem.currentStock?.[dest] ?? 0) || 0;
          const newOnHand = currentOnHand + qtyReceived;

          if (!invItem.locationStock) invItem.locationStock = {};
          if (!invItem.locationStock[dest]) {
            invItem.locationStock[dest] = {
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
            invItem.locationStock[dest].stockOnHand = newOnHand;
            invItem.locationStock[dest].availableStock = newOnHand;
          }
          if (invItem.currentStock) invItem.currentStock[dest] = newOnHand;

          db.ledger.unshift({
            id: `tx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            referenceNo: request.requestNumber,
            timestamp: now,
            date: now.split('T')[0],
            itemId: invItem.id,
            itemName: invItem.name,
            sku: invItem.sku || 'SKU-TRF',
            locationId: dest,
            transactionType: 'TRANSFER_IN',
            quantityDelta: qtyReceived,
            unit: it.unit || invItem.unit || 'units',
            unitCost: invItem.costPerUnit || 1000,
            totalValue: qtyReceived * (invItem.costPerUnit || 1000),
            balanceBefore: currentOnHand,
            balanceAfter: newOnHand,
            performedByStaffId: currentStaff.id,
            performedByName: currentStaff.name,
            performedByRole: currentStaff.role,
            notes: `Received from ${request.sourceLocation} via ${request.requestNumber}`,
          });
        }
      }

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'TRANSFER',
        `Received stock indent ${request.requestNumber} at ${request.destinationLocation}`
      );

      evaluateInventoryReorderAlerts({
        branchId: dest,
        triggeredBy: `transfer_receive:${request.requestNumber}`,
      });

      res.json({ success: true, request });
    }
  );

  router.use(createPurchasingAndStockCountsRouter(deps));

  return router;
}
