import { Router } from 'express';
import { db, saveDatabaseSync, DbStaffAccount } from '../../server_db';
import { evaluateInventoryReorderAlerts } from '../services/stockAlertService';
import type { ProcurementAndLedgerRouterDeps } from './procurementAndLedgerRouter';

export function createPurchasingAndStockCountsRouter(deps: ProcurementAndLedgerRouterDeps): Router {
  const router = Router();
  const { requireAuth, requireRole, logAuditEvent, hasPermission } = deps;

  router.get(['/api/inventory/purchasing/suppliers', '/api/inventory/suppliers'], requireAuth, (_req, res) => {
    res.json(Object.values(db.suppliers));
  });

  router.get(
    ['/api/inventory/purchasing/orders', '/api/inventory/purchase-orders', '/api/inventory/purchasing-orders'],
    requireAuth,
    (_req, res) => {
      res.json(Object.values(db.purchaseOrders));
    }
  );

  router.post(
    ['/api/inventory/purchasing/orders', '/api/inventory/purchase-orders', '/api/inventory/purchasing-orders'],
    requireAuth,
    requireRole(['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'accountant', 'corporate_admin', 'super_admin']),
    async (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.purchasing.manage')) && !['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'accountant', 'corporate_admin', 'super_admin'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Purchase order creation requires inventory.purchasing.manage privilege.' });
      }
      const { supplierId, destinationLocation = 'general_store', items = [], paymentTerms, expectedDeliveryDate } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Purchase Order must contain at least one line item.' });
      }

      const id = `po-${Date.now()}`;
      const poNumber = `PO-${String(Object.keys(db.purchaseOrders).length + 1).padStart(5, '0')}`;
      const supplier = db.suppliers[supplierId] || { name: 'Supplier' };

      let totalAmount = 0;
      const poLines = items.map((it: any) => {
        const item = db.inventory[it.itemId];
        const subtotal = (Number(it.orderQuantity) || 0) * (Number(it.unitPrice) || 0);
        totalAmount += subtotal;
        return {
          itemId: it.itemId,
          itemName: item?.name || 'Item',
          orderQuantity: Number(it.orderQuantity) || 0,
          purchaseUnit: it.purchaseUnit || item?.unit || 'units',
          unitPrice: Number(it.unitPrice) || 0,
          lineTotal: subtotal,
          receivedQuantity: 0,
        };
      });

      const po = {
        id,
        poNumber,
        supplierId,
        supplierName: supplier.name,
        destinationLocation,
        createdDate: new Date().toISOString(),
        expectedDeliveryDate: expectedDeliveryDate || new Date(Date.now() + 86400000 * 2).toISOString(),
        items: poLines,
        totalAmount,
        status: 'sent_to_supplier',
        paymentTerms: paymentTerms || 'Net 14 Days',
        createdByStaffId: currentStaff.id,
        createdByName: currentStaff.name,
      };

      db.purchaseOrders[id] = po;
      saveDatabaseSync();
      logAuditEvent(currentStaff.name, currentStaff.role, destinationLocation, 'PURCHASE_ORDER', `Created PO ${poNumber} for ${supplier.name} (₦${totalAmount.toLocaleString()})`);
      res.status(201).json({ success: true, purchaseOrder: po });
    }
  );

  router.get(['/api/inventory/purchasing/grn', '/api/inventory/grn'], requireAuth, (_req, res) => {
    res.json(Object.values(db.goodsReceiptNotes));
  });

  router.post(
    ['/api/inventory/purchasing/grn', '/api/inventory/grn'],
    requireAuth,
    requireRole(['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'accountant', 'corporate_admin', 'super_admin']),
    async (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.purchasing.receive')) && !['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'accountant', 'corporate_admin', 'super_admin'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Receiving goods requires inventory.purchasing.receive privilege.' });
      }
      const { purchaseOrderId, supplierInvoiceNumber, receivingLocation = 'general_store', lines = [], items = [], driverName, vehicleNumber } = req.body;
      const rawLines = Array.isArray(lines) && lines.length > 0 ? lines : (Array.isArray(items) ? items : []);

      if (rawLines.length === 0) {
        return res.status(400).json({ error: 'Goods Receipt Note must contain at least one accepted line item.' });
      }

      if (purchaseOrderId || supplierInvoiceNumber) {
        const existingGrn = Object.values(db.goodsReceiptNotes || {}).find(
          (g: any) =>
            (purchaseOrderId && (g.purchaseOrderId === purchaseOrderId || g.poId === purchaseOrderId)) ||
            (supplierInvoiceNumber && g.supplierInvoiceNumber === supplierInvoiceNumber)
        ) as any;
        if (existingGrn) {
          return res.status(409).json({
            error: `Duplicate GRN blocked: Purchase Order '${purchaseOrderId || ''}' or Invoice '${supplierInvoiceNumber || ''}' was already received under ${existingGrn.grnNumber}.`,
          });
        }
      }

      const id = `grn-${Date.now()}`;
      const grnNumber = `GRN-${String(Object.keys(db.goodsReceiptNotes).length + 1).padStart(5, '0')}`;
      const po = purchaseOrderId ? db.purchaseOrders[purchaseOrderId] : null;

      let totalReceivedValue = 0;
      const enrichedLines = rawLines.map((ln: any, idx: number) => {
        const item = db.inventory[ln.itemId];
        const qty = Number(ln.acceptedQty ?? ln.receivedQty ?? 0) || 0;
        const price = Number(ln.unitPrice) || item?.costPerUnit || 1000;
        totalReceivedValue += qty * price;

        if (item && qty > 0) {
          if (!item.locationStock) item.locationStock = {};
          const current = Number(item.locationStock[receivingLocation]?.stockOnHand ?? item.currentStock?.[receivingLocation] ?? 0) || 0;
          const updated = current + qty;
          if (!item.locationStock[receivingLocation]) {
            item.locationStock[receivingLocation] = {
              stockOnHand: updated,
              availableStock: updated,
              reservedStock: 0,
              minThreshold: 10,
              parLevel: 50,
              reorderLevel: 20,
              reorderQuantity: 30,
              unitCost: price,
            };
          } else {
            item.locationStock[receivingLocation].stockOnHand = updated;
            item.locationStock[receivingLocation].availableStock = updated;
            item.locationStock[receivingLocation].unitCost = price;
          }
          if (item.currentStock) item.currentStock[receivingLocation] = updated;
          item.costPerUnit = price;

          db.ledger.unshift({
            id: `tx-grn-${Date.now()}-${idx}`,
            referenceNo: grnNumber,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            itemId: item.id,
            itemName: item.name,
            sku: item.sku || 'SKU',
            locationId: receivingLocation,
            transactionType: 'PURCHASE_INTAKE',
            quantityDelta: qty,
            quantity: qty,
            unit: item.unit || 'units',
            balanceBefore: current,
            balanceAfter: updated,
            unitCost: price,
            totalValue: qty * price,
            referenceDocument: supplierInvoiceNumber ? `INV: ${supplierInvoiceNumber}` : grnNumber,
            performedByStaffId: currentStaff.id,
            performedByName: currentStaff.name,
            performedByRole: currentStaff.role,
            notes: `GRN Intake received into ${receivingLocation}`,
          });
        }

        return {
          itemId: ln.itemId,
          itemName: ln.itemName || item?.name || 'Inventory Item',
          orderedQty: Number(ln.orderedQty ?? qty),
          receivedQty: qty,
          acceptedQty: qty,
          rejectedQty: Number(ln.rejectedQty ?? 0),
          unitPrice: price,
          batchNumber: ln.batchNumber || `BCH-${Date.now().toString().slice(-4)}`,
          expiryDate: ln.expiryDate || '',
        };
      });

      if (po) {
        po.status = 'delivered_received';
      }

      const grn = {
        id,
        grnNumber,
        purchaseOrderId: purchaseOrderId || '',
        poNumber: po?.poNumber || 'DIRECT-PO',
        supplierName: po?.supplierName || req.body.supplierName || 'Verified Vendor',
        supplierInvoiceNumber: supplierInvoiceNumber || 'INV-DIRECT',
        receivingLocation,
        receivedAt: new Date().toISOString(),
        receivedByStaffId: currentStaff.id,
        receivedByName: currentStaff.name,
        items: enrichedLines,
        lines: enrichedLines,
        actualAcceptedValue: totalReceivedValue,
        totalValue: totalReceivedValue,
        status: 'verified',
        driverName,
        vehicleNumber,
        qualityPassed: true,
      };

      db.goodsReceiptNotes[id] = grn;
      saveDatabaseSync();
      logAuditEvent(currentStaff.name, currentStaff.role, receivingLocation, 'GRN_RECEIPT', `Accepted GRN ${grnNumber} value ₦${totalReceivedValue.toLocaleString()} at ${receivingLocation}`);

      evaluateInventoryReorderAlerts({
        branchId: receivingLocation,
        triggeredBy: `grn_receipt:${grnNumber}`,
      });

      res.status(201).json({ success: true, grn });
    }
  );

  router.get('/api/inventory/wastage', requireAuth, (_req, res) => {
    res.json(db.wastage);
  });

  router.post(
    '/api/inventory/wastage',
    requireAuth,
    requireRole(['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'kitchen_lead', 'corporate_admin', 'super_admin']),
    async (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.wastage.log')) && !['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'kitchen_lead', 'corporate_admin', 'super_admin'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Logging wastage requires inventory.wastage.log privilege.' });
      }
      const { itemId, locationId = currentStaff.branchId, quantity, unit, unitCost, reason, customNote } = req.body;

      const qtyNum = Number(quantity);
      if (Number.isNaN(qtyNum) || qtyNum <= 0) {
        return res.status(400).json({ error: 'Wastage quantity must be a positive number.' });
      }

      const item = db.inventory[itemId];
      if (!item) {
        return res.status(404).json({ error: 'Inventory item not found for wastage entry.' });
      }

      const prev = Number(item.locationStock?.[locationId]?.stockOnHand ?? item.currentStock?.[locationId] ?? 0) || 0;
      if (qtyNum > prev) {
        return res.status(400).json({
          error: `Cannot record wastage of ${qtyNum} ${item.unit} at '${locationId}': only ${prev} ${item.unit} available on hand.`,
        });
      }

      const effectiveUnitCost = Number(unitCost) || item.costPerUnit || 1000;
      const lossValue = qtyNum * effectiveUnitCost;

      const record = {
        id: `wst-${Date.now()}`,
        referenceNo: `WA-${String(db.wastage.length + 1).padStart(5, '0')}`,
        itemId,
        itemName: item.name,
        sku: item.sku || 'SKU-WST',
        locationId,
        branchId: locationId,
        quantity: qtyNum,
        unit: unit || item.unit || 'units',
        unitCost: effectiveUnitCost,
        totalLossValue: lossValue,
        estimatedCostLost: lossValue,
        reason,
        customNote,
        loggedByStaffId: currentStaff.id,
        loggedByName: currentStaff.name,
        loggedByRole: currentStaff.role,
        timestamp: new Date().toISOString(),
      };

      db.wastage.unshift(record);

      const newStock = prev - qtyNum;
      if (item.locationStock?.[locationId]) {
        item.locationStock[locationId].stockOnHand = newStock;
        item.locationStock[locationId].availableStock = newStock;
      }
      if (item.currentStock) item.currentStock[locationId] = newStock;

      saveDatabaseSync();
      logAuditEvent(currentStaff.name, currentStaff.role, currentStaff.branchId, 'WASTAGE', `Logged wastage ${record.referenceNo}: ${qtyNum} ${record.unit} of ${item.name} (Loss: ₦${lossValue})`);

      evaluateInventoryReorderAlerts({
        branchId: locationId,
        triggeredBy: `wastage:${record.referenceNo}`,
      });

      res.status(201).json({ success: true, record });
    }
  );

  router.get('/api/inventory/stock-counts', requireAuth, (_req, res) => {
    res.json(Object.values(db.stockCounts));
  });

  router.post(
    '/api/inventory/stock-counts',
    requireAuth,
    requireRole(['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'auditor', 'accountant', 'corporate_admin', 'super_admin']),
    async (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      if (!(await hasPermission(currentStaff, 'inventory.stocktake.perform')) && !['storekeeper', 'inventory_manager', 'store_manager', 'branch_manager', 'auditor', 'accountant', 'corporate_admin', 'super_admin'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Performing stock counts requires inventory.stocktake.perform privilege.' });
      }
      const { locationId = currentStaff.branchId, lines = [], autoReconcile = false } = req.body;

      const sessionId = `cnt-${Date.now()}`;
      const sessionRef = `STK-${String(Object.keys(db.stockCounts).length + 1).padStart(5, '0')}`;

      let totalVarianceValue = 0;
      const processedLines = lines.map((l: any, idx: number) => {
        const item = db.inventory[l.itemId];
        const systemQty = item?.locationStock?.[locationId]?.stockOnHand ?? item?.currentStock?.[locationId] ?? 0;
        const countedQty = Number(l.physicalCountedQty);
        const varianceQty = countedQty - systemQty;
        const unitCost = item?.costPerUnit || 1000;
        const varianceValue = varianceQty * unitCost;
        totalVarianceValue += varianceValue;

        if (autoReconcile && item) {
          if (!item.locationStock) item.locationStock = {};
          if (item.locationStock[locationId]) {
            item.locationStock[locationId].stockOnHand = countedQty;
            item.locationStock[locationId].availableStock = countedQty;
          }
          if (item.currentStock) item.currentStock[locationId] = countedQty;

          db.ledger.unshift({
            id: `tx-stk-${Date.now()}-${idx}`,
            referenceNo: `${sessionRef}-REC`,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            itemId: item.id,
            itemName: item.name,
            sku: item.sku || 'SKU',
            locationId,
            transactionType: varianceQty >= 0 ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
            quantityDelta: varianceQty,
            quantity: Math.abs(varianceQty),
            unit: item.unit || 'units',
            balanceBefore: systemQty,
            balanceAfter: countedQty,
            unitCost,
            totalValue: Math.abs(varianceValue),
            performedByStaffId: currentStaff.id,
            performedByName: currentStaff.name,
            performedByRole: currentStaff.role,
            notes: `Stocktake audit reconciliation: counted ${countedQty} vs system ${systemQty}`,
          });
        }

        return {
          itemId: l.itemId,
          itemName: item?.name || 'Item',
          sku: item?.sku || 'SKU',
          unit: item?.unit || 'units',
          systemExpectedQty: systemQty,
          physicalCountedQty: countedQty,
          varianceQty,
          varianceValue,
          notes: l.notes || '',
        };
      });

      const session = {
        id: sessionId,
        referenceNo: sessionRef,
        locationId,
        sessionType: 'blind_cycle_count',
        conductedByStaffId: currentStaff.id,
        conductedByName: currentStaff.name,
        conductedAt: new Date().toISOString(),
        status: autoReconcile ? 'reconciled' : 'completed',
        lines: processedLines,
        totalVarianceValue,
      };

      db.stockCounts[sessionId] = session;
      saveDatabaseSync();

      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        locationId,
        'STOCKTAKE',
        `Completed stock count ${sessionRef} with ${lines.length} lines. Variance: ₦${totalVarianceValue.toLocaleString()}`
      );

      if (autoReconcile) {
        evaluateInventoryReorderAlerts({
          branchId: locationId,
          triggeredBy: `stock_count:${sessionRef}`,
        });
      }

      res.status(201).json({ success: true, session });
    }
  );

  router.post(
    '/api/inventory/stock-counts/:id/approve',
    requireAuth,
    requireRole(['inventory_manager', 'store_manager', 'branch_manager', 'accountant', 'corporate_admin', 'super_admin']),
    (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      const { id } = req.params;
      const session = (db.stockCounts || {})[id] as any;
      if (!session) {
        return res.status(404).json({ error: 'Stock count session not found.' });
      }
      if (session.status === 'reconciled') {
        return res.json({ success: true, session, message: 'Stock count already approved and reconciled.' });
      }

      const locationId = session.locationId || 'gra';
      (session.lines || []).forEach((l: any, idx: number) => {
        const item = db.inventory[l.itemId];
        if (!item) return;
        const systemQty =
          Number(item.locationStock?.[locationId]?.stockOnHand ?? item.currentStock?.[locationId] ?? l.systemExpectedQty ?? 0) || 0;
        const countedQty = Number(l.physicalCountedQty ?? systemQty);
        const varianceQty = countedQty - systemQty;
        const unitCost = Number(item.costPerUnit || 1000);

        if (!item.locationStock) item.locationStock = {};
        if (!item.locationStock[locationId]) {
          item.locationStock[locationId] = {
            stockOnHand: countedQty,
            availableStock: countedQty,
            reservedStock: 0,
            minThreshold: item.reorderLevel || 10,
            parLevel: item.parLevel || 40,
            reorderLevel: item.reorderLevel || 15,
            reorderQuantity: 30,
            unitCost,
          };
        } else {
          item.locationStock[locationId].stockOnHand = countedQty;
          item.locationStock[locationId].availableStock = countedQty;
        }
        if (item.currentStock && typeof item.currentStock === 'object') {
          item.currentStock[locationId] = countedQty;
        }

        db.ledger.unshift({
          id: `tx-stk-apv-${Date.now()}-${idx}`,
          referenceNo: `${session.referenceNo}-APV`,
          timestamp: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          itemId: item.id,
          itemName: item.name,
          sku: item.sku || 'SKU',
          locationId,
          transactionType: varianceQty >= 0 ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
          quantityDelta: varianceQty,
          quantity: Math.abs(varianceQty),
          unit: item.unit || 'units',
          balanceBefore: systemQty,
          balanceAfter: countedQty,
          unitCost,
          totalValue: Math.abs(varianceQty * unitCost),
          performedByStaffId: currentStaff.id,
          performedByName: currentStaff.name,
          performedByRole: currentStaff.role,
          notes: `Approved Stock Count ${session.referenceNo}: counted ${countedQty} vs system ${systemQty}`,
        });
      });

      session.status = 'reconciled';
      session.approvedByStaffId = currentStaff.id;
      session.approvedByName = currentStaff.name;
      session.approvedAt = new Date().toISOString();
      saveDatabaseSync();

      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        locationId,
        'STOCKTAKE_APPROVED',
        `Approved & reconciled stock count ${session.referenceNo} at ${locationId}`
      );

      res.json({ success: true, session });
    }
  );

  // ============================================================================
  // MARKET LIST, PURCHASING & GOODS RECEIVING WORKFLOW
  // ============================================================================
  router.get('/api/inventory/market-lists', requireAuth, (_req, res) => {
    const dbAny = db as any;
    dbAny.marketLists = dbAny.marketLists || {};
    const list = Object.values(dbAny.marketLists).sort((a: any, b: any) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
    res.json(list);
  });

  router.get('/api/inventory/market-lists/low-stock-suggestions', requireAuth, (req, res) => {
    const branchId = String(req.query.branchId || 'gra').toLowerCase();
    const suggestions = Object.values(db.inventory || {})
      .filter((it: any) => {
        const onHand = Number(it.locationStock?.[branchId]?.stockOnHand ?? it.currentStock?.[branchId] ?? it.stockQty ?? 0);
        const reorder = Number(it.locationStock?.[branchId]?.reorderLevel ?? it.reorderLevel ?? 15);
        return onHand <= reorder;
      })
      .map((it: any) => {
        const onHand = Number(it.locationStock?.[branchId]?.stockOnHand ?? it.currentStock?.[branchId] ?? it.stockQty ?? 0);
        const par = Number(it.locationStock?.[branchId]?.parLevel ?? it.parLevel ?? 50);
        const suggestedQty = Math.max(10, par - onHand);
        return {
          itemId: it.id,
          sku: it.sku || it.id,
          itemName: it.name,
          category: it.category || 'produce',
          unit: it.unit || 'kg',
          currentStock: onHand,
          requestedQty: suggestedQty,
          estimatedUnitCost: Number(it.costPerUnit || 1500),
          estimatedLineTotal: suggestedQty * Number(it.costPerUnit || 1500),
          supplierName: it.supplier || 'Market Vendor',
        };
      });
    res.json(suggestions);
  });

  router.post('/api/inventory/market-lists', requireAuth, (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    const dbAny = db as any;
    dbAny.marketLists = dbAny.marketLists || {};

    const { title, branchId = currentStaff.branchId || 'gra', lines = [], status = 'submitted' } = req.body || {};
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Market list must contain at least one item.' });
    }

    const id = `mkt-${Date.now()}`;
    const listNumber = `MKT-${String(Object.keys(dbAny.marketLists).length + 1).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();

    let totalEstimatedAmount = 0;
    const normalizedLines = lines.map((l: any, idx: number) => {
      const invItem = db.inventory[l.itemId];
      const reqQty = Math.max(0.1, Number(l.requestedQty) || 1);
      const estCost = Math.max(0, Number(l.estimatedUnitCost ?? invItem?.costPerUnit ?? 0));
      const lineTotal = Math.round(reqQty * estCost);
      totalEstimatedAmount += lineTotal;
      return {
        itemId: l.itemId || `mkt-item-${idx + 1}`,
        sku: invItem?.sku || l.sku || `MKT-${idx + 1}`,
        itemName: l.itemName || invItem?.name || 'Market Item',
        category: l.category || invItem?.category || 'produce',
        unit: l.unit || invItem?.unit || 'kg',
        requestedQty: reqQty,
        approvedQty: reqQty,
        purchasedQty: 0,
        receivedQty: 0,
        estimatedUnitCost: estCost,
        actualUnitCost: estCost,
        estimatedLineTotal: lineTotal,
        actualLineTotal: 0,
        supplierName: l.supplierName || invItem?.supplier || 'Open Market Vendor',
        notes: l.notes || '',
      };
    });

    const marketList = {
      id,
      listNumber,
      title: title || `Market List - ${branchId.toUpperCase()} (${new Date().toLocaleDateString('en-GB')})`,
      branchId,
      status: status === 'draft' ? 'draft' : 'submitted',
      createdByStaffId: currentStaff.id,
      createdByName: currentStaff.name,
      createdAt: nowIso,
      totalEstimatedAmount,
      totalActualAmount: 0,
      lines: normalizedLines,
      history: [
        {
          status: status === 'draft' ? 'draft' : 'submitted',
          byStaffName: currentStaff.name,
          timestamp: nowIso,
          note: `Created market list with ${normalizedLines.length} items (Est. ₦${totalEstimatedAmount.toLocaleString()})`,
        },
      ],
    };

    dbAny.marketLists[id] = marketList;
    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      branchId,
      'MARKET_LIST_CREATED',
      `Created Market List ${listNumber} (₦${totalEstimatedAmount.toLocaleString()})`
    );

    res.status(201).json({ success: true, marketList });
  });

  router.post('/api/inventory/market-lists/:id/transition', requireAuth, (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    const dbAny = db as any;
    dbAny.marketLists = dbAny.marketLists || {};
    const { id } = req.params;
    const { targetStatus, lines: updatedLines, note, invoiceRef } = req.body || {};

    const mkt = dbAny.marketLists[id];
    if (!mkt) {
      return res.status(404).json({ error: 'Market list not found.' });
    }

    const allowedStatuses = ['draft', 'submitted', 'approved', 'purchased', 'received', 'reconciled'];
    if (!allowedStatuses.includes(targetStatus)) {
      return res.status(400).json({ error: `Invalid targetStatus "${targetStatus}".` });
    }

    if (
      ['approved', 'reconciled'].includes(targetStatus) &&
      !['branch_manager', 'store_manager', 'inventory_manager', 'accountant', 'corporate_admin', 'super_admin', 'admin'].includes(currentStaff.role)
    ) {
      return res.status(403).json({ error: 'Managerial or accounting authority required to approve or reconcile market lists.' });
    }

    const nowIso = new Date().toISOString();
    if (Array.isArray(updatedLines) && updatedLines.length > 0) {
      mkt.lines = mkt.lines.map((existingLine: any, idx: number) => {
        const patch = updatedLines.find((u: any) => u.itemId === existingLine.itemId) || updatedLines[idx] || {};
        const approvedQty = Number(patch.approvedQty ?? existingLine.approvedQty ?? existingLine.requestedQty);
        const purchasedQty = Number(patch.purchasedQty ?? existingLine.purchasedQty ?? approvedQty);
        const receivedQty = Number(patch.receivedQty ?? existingLine.receivedQty ?? purchasedQty);
        const actualUnitCost = Number(patch.actualUnitCost ?? existingLine.actualUnitCost ?? existingLine.estimatedUnitCost);
        return {
          ...existingLine,
          approvedQty,
          purchasedQty,
          receivedQty,
          actualUnitCost,
          actualLineTotal: Math.round(receivedQty * actualUnitCost),
          qtyVariance: receivedQty - approvedQty,
          priceVariance: actualUnitCost - existingLine.estimatedUnitCost,
        };
      });
    }

    // When transitioning to 'received', automatically update inventory balances and record GRN/ledger
    if (targetStatus === 'received' && mkt.status !== 'received' && mkt.status !== 'reconciled') {
      let totalActual = 0;
      const receivingLocation = mkt.branchId || 'gra';
      const grnNumber = `GRN-${mkt.listNumber}`;

      mkt.lines.forEach((ln: any, idx: number) => {
        const qty = Number(ln.receivedQty || ln.purchasedQty || ln.approvedQty || ln.requestedQty || 0);
        const unitCost = Number(ln.actualUnitCost || ln.estimatedUnitCost || 0);
        ln.receivedQty = qty;
        ln.actualLineTotal = Math.round(qty * unitCost);
        totalActual += ln.actualLineTotal;

        const invItem = db.inventory[ln.itemId];
        if (invItem && qty > 0) {
          if (!invItem.locationStock) invItem.locationStock = {};
          const current =
            Number(invItem.locationStock[receivingLocation]?.stockOnHand ?? invItem.currentStock?.[receivingLocation] ?? 0) || 0;
          const updated = current + qty;
          if (!invItem.locationStock[receivingLocation]) {
            invItem.locationStock[receivingLocation] = {
              stockOnHand: updated,
              availableStock: updated,
              reservedStock: 0,
              minThreshold: 10,
              parLevel: 50,
              reorderLevel: 20,
              reorderQuantity: 30,
              unitCost,
            };
          } else {
            invItem.locationStock[receivingLocation].stockOnHand = updated;
            invItem.locationStock[receivingLocation].availableStock = updated;
            invItem.locationStock[receivingLocation].unitCost = unitCost;
          }
          if (invItem.currentStock && typeof invItem.currentStock === 'object') {
            invItem.currentStock[receivingLocation] = updated;
          }
          invItem.costPerUnit = unitCost;

          db.ledger.unshift({
            id: `tx-mkt-${Date.now()}-${idx}`,
            referenceNo: grnNumber,
            timestamp: nowIso,
            date: nowIso.split('T')[0],
            itemId: invItem.id,
            itemName: invItem.name,
            sku: invItem.sku || 'SKU',
            locationId: receivingLocation,
            transactionType: 'PURCHASE_INTAKE',
            quantityDelta: qty,
            quantity: qty,
            unit: invItem.unit || ln.unit || 'kg',
            balanceBefore: current,
            balanceAfter: updated,
            unitCost,
            totalValue: qty * unitCost,
            referenceDocument: invoiceRef || mkt.listNumber,
            performedByStaffId: currentStaff.id,
            performedByName: currentStaff.name,
            performedByRole: currentStaff.role,
            notes: `Market List ${mkt.listNumber} goods received into ${receivingLocation}`,
          });
        }
      });

      mkt.totalActualAmount = totalActual;
    }

    mkt.status = targetStatus;
    mkt.history = [
      ...(mkt.history || []),
      {
        status: targetStatus,
        byStaffName: currentStaff.name,
        timestamp: nowIso,
        note: note || `Transitioned market list to ${targetStatus.toUpperCase()}`,
      },
    ];
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      mkt.branchId || 'gra',
      'MARKET_LIST_STATUS',
      `Market List ${mkt.listNumber} -> ${targetStatus.toUpperCase()}`
    );

    res.json({ success: true, marketList: mkt });
  });

  router.get('/api/inventory/analytics/variance', requireAuth, (req, res) => {
    const { locationId = 'gra' } = req.query;
    const sessions = Object.values(db.stockCounts).filter((s: any) => !locationId || s.locationId === locationId);
    res.json(sessions);
  });

  router.get('/api/inventory/variance', requireAuth, (req, res) => {
    const { locationId = 'gra' } = req.query;
    const sessions = Object.values(db.stockCounts).filter((s: any) => !locationId || s.locationId === locationId);
    res.json(sessions);
  });

  router.get('/api/inventory/recipes', requireAuth, (_req, res) => {
    res.json(Object.values(db.recipes));
  });

  return router;
}
