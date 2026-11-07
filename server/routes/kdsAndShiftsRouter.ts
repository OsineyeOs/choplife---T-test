import { Router } from 'express';
import crypto from 'crypto';
import type {
  DbDatabase,
  DbStaffAccount,
  DbDeliveryTask,
  DbShift,
  DbCashMovement,
} from '../../server_db.ts';
import type { CustomerNotificationPayload } from '../services/customerNotificationService.ts';
import { createShiftCloseSubRouter } from './shiftCloseSubRouter.ts';

export function createKdsAndShiftsRouter(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: any;
  requireRole: any;
  requireBranchAccess: any;
  sendCustomerNotification: (payload: CustomerNotificationPayload) => any[];
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
    requireRole,
    requireBranchAccess,
    sendCustomerNotification,
    logAuditEvent,
  } = deps;

  // 4.3D Hardware Barcode / QR Scanner Dispatch Action
  router.post('/api/dispatch/scan-action', requireAuth, (req, res) => {
    const db = getDb();
    try {
      const { barcode, actionType, riderId, handoverPin, branchId = 'gra' } = req.body;
      if (!barcode) {
        return res.status(400).json({ error: 'Barcode or QR string is required.' });
      }

      const cleanCode = String(barcode).trim().toUpperCase();
      const now = new Date().toISOString();

      const task = Object.values(db.deliveryTasks).find(
        (t: any) =>
          (t.orderNumber && t.orderNumber.toUpperCase() === cleanCode) ||
          (t.id && t.id.toUpperCase() === cleanCode) ||
          (t.handoverPin && t.handoverPin === cleanCode)
      );

      const order = Object.values(db.orders || {}).find(
        (o: any) =>
          (o.orderNumber && o.orderNumber.toUpperCase() === cleanCode) ||
          (o.id && o.id.toUpperCase() === cleanCode) ||
          (o.deliveryDetails?.pickupCode === cleanCode)
      );

      if (!task && !order) {
        return res.status(404).json({
          success: false,
          error: `No active order or delivery ticket found matching barcode "${cleanCode}".`,
        });
      }

      const linkedCheck =
        (order && db.checks?.[`chk-${order.id}`]) ||
        Object.values(db.checks || {}).find(
          (c: any) =>
            (order && c.orderId === order.id) ||
            (task && (c.checkNumber === task.orderNumber || c.id === (task as any).checkId))
        );

      if (actionType && actionType !== 'lookup') {
        const isPaid =
          (order && order.paymentStatus === 'paid') ||
          (linkedCheck && linkedCheck.paymentStatus === 'paid') ||
          (task && (task as any).paymentStatus === 'paid');
        if (!isPaid) {
          return res.status(409).json({
            success: false,
            error: `PAYMENT_REQUIRED_BEFORE_DISPATCH: Order #${task?.orderNumber || order?.orderNumber || cleanCode} is unpaid. Payment must be confirmed before packing, dispatch, or customer handover.`,
          });
        }
      }

      const orderNumber = task?.orderNumber || order?.orderNumber || cleanCode;
      const matchedTask: DbDeliveryTask = task || {
        id: `task-${Date.now()}`,
        orderId: order?.id || `ord-${Date.now()}`,
        orderNumber,
        branchId: order?.branchId || branchId,
        status: 'pending',
        handoverPin: order?.deliveryDetails?.pickupCode || order?.pickupAuthorizationCode || String(Math.floor(1000 + Math.random() * 9000)),
        customerName: order?.deliveryDetails?.customerName || 'Customer',
        customerPhone: order?.deliveryDetails?.customerPhone || '',
        deliveryAddress: order?.deliveryDetails?.deliveryAddress || 'Benin City',
        deliveryZone: order?.deliveryDetails?.deliveryZone || 'Express Delivery Area',
        orderTotal: order?.total || 0,
        total: order?.total || 0,
        paymentMethod: order?.paymentMethod || 'cash',
        codAmountDue: order?.paymentMethod === 'cod' ? (order?.total || 0) : 0,
        codAmountCollected: 0,
        cashReconciled: false,
        createdAt: now,
      };

      let resultMessage = '';
      let statusTransition = matchedTask.status;

      if (actionType === 'pack' || actionType === 'ready') {
        matchedTask.status = 'ready_for_pickup';
        matchedTask.packedAt = now;
        if (order) order.status = 'ready';
        statusTransition = 'ready_for_pickup';
        resultMessage = `Order #${orderNumber} scanned at Packing Station. Marked as PACKAGED & READY FOR DISPATCH.`;

        sendCustomerNotification({
          orderNumber,
          customerName: matchedTask.customerName,
          customerPhone: matchedTask.customerPhone,
          eventType: 'ORDER_READY',
          branchId: matchedTask.branchId,
        });
      } else if (actionType === 'pickup' || actionType === 'dispatch') {
        const rider = riderId ? db.riders[riderId] : undefined;
        matchedTask.status = 'in_transit';
        matchedTask.pickedUpAt = now;
        if (riderId) {
          matchedTask.assignedRiderId = riderId;
          matchedTask.assignedRiderName = rider?.name || 'Assigned Rider';
          matchedTask.assignedRiderPhone = rider?.phone || (matchedTask.branchId && db.branches[matchedTask.branchId]?.phone) || '+234 811 222 3333';
        }
        if (order) order.status = 'out_for_delivery';
        statusTransition = 'in_transit';
        resultMessage = `Order #${orderNumber} scanned by Rider ${matchedTask.assignedRiderName || ''}. Handed over and now OUT FOR DELIVERY.`;

        sendCustomerNotification({
          orderNumber,
          customerName: matchedTask.customerName,
          customerPhone: matchedTask.customerPhone,
          eventType: 'DISPATCH_EN_ROUTE',
          branchId: matchedTask.branchId,
          metadata: {
            riderName: matchedTask.assignedRiderName,
            riderPhone: matchedTask.assignedRiderPhone,
            handoverPin: matchedTask.handoverPin,
          },
        });
      } else if (actionType === 'handover' || actionType === 'complete') {
        if (handoverPin && matchedTask.handoverPin && handoverPin !== matchedTask.handoverPin) {
          return res.status(400).json({
            success: false,
            error: `Invalid Handover PIN "${handoverPin}". Customer verification failed.`,
          });
        }

        matchedTask.status = 'delivered';
        matchedTask.deliveredAt = now;
        if (order) order.status = 'delivered';
        statusTransition = 'delivered';
        resultMessage = `Order #${orderNumber} delivered and 4-digit PIN verified. Delivery marked as COMPLETED!`;

        sendCustomerNotification({
          orderNumber,
          customerName: matchedTask.customerName,
          customerPhone: matchedTask.customerPhone,
          eventType: 'DELIVERY_COMPLETED',
          branchId: matchedTask.branchId,
        });
      }

      db.deliveryTasks[matchedTask.id] = matchedTask;
      saveDatabaseSync();

      res.json({
        success: true,
        orderNumber,
        actionType,
        newStatus: statusTransition,
        task: matchedTask,
        message: resultMessage,
      });
    } catch (err: any) {
      console.error('[SCAN ACTION ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Kitchen Display System (KDS)
  router.get('/api/pos/kds/tickets', requireAuth, requireBranchAccess, (req, res) => {
    const db = getDb();
    const { branchId, includeRecentBumped } = req.query;
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    let activeChecks = Object.values(db.checks).filter((c) => {
      if ((c as any).isHistoricalMigrated || (c as any).legacySourceSystem === 'ezee_optimus') return false;
      if (c.status === 'voided' || (c.status as string) === 'refunded' || (c.status as string) === 'closed_unpaid' || c.status === 'open') {
        return false;
      }
      // Strict Payment-Before-KDS Gate & Packaging Hold Gate
      if (c.paymentStatus !== 'paid') {
        return false;
      }
      if ((c as any).packagingRequirementStatus === 'AWAITING_PACKAGING_APPROVAL') {
        return false;
      }

      const matchingTask = Object.values(db.deliveryTasks || {}).find(
        (t: any) =>
          t.orderNumber === c.checkNumber ||
          t.orderNumber === (c as any).orderNumber ||
          t.orderId === c.orderId ||
          t.orderId === (c.id || '').replace('chk-', '')
      );
      if (matchingTask && (matchingTask.status === 'delivered' || (matchingTask.status as any) === 'cancelled')) {
        return false;
      }

      const checkAgeMs = now - new Date(c.openedAt || (c as any).createdAt || 0).getTime();
      if (checkAgeMs > ONE_DAY_MS) {
        return false;
      }

      const hasPendingOrActiveKitchenItems = (c.items || []).some((it) =>
        ['sent_to_kitchen', 'preparing', 'ready'].includes(it.status)
      );
      if (!hasPendingOrActiveKitchenItems) return false;

      if (includeRecentBumped === 'true') {
        return c.status === 'sent_to_kitchen' || c.status === 'paid' || c.status === 'ready';
      }
      return (c.status === 'sent_to_kitchen' || c.status === 'paid') && (c.items || []).some((it) => it.status !== 'ready' && it.status !== 'served');
    });

    if (branchId && branchId !== 'all') {
      activeChecks = activeChecks.filter((c) => c.branchId === branchId);
    }

    res.json(activeChecks.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()));
  });

  router.put('/api/pos/kds/items/:checkId/:itemId/status', requireAuth, (req, res) => {
    const db = getDb();
    const { checkId, itemId } = req.params;
    const { status } = req.body;
    const check = db.checks[checkId];

    if (!check) return res.status(404).json({ error: 'Check not found.' });

    const item = check.items.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in check.' });

    item.status = status;
    saveDatabaseSync();
    res.json({ success: true, item });
  });

  router.post('/api/pos/kds/tickets/:id/bump', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const check = db.checks[id];

    if (!check) return res.status(404).json({ error: 'Ticket not found.' });

    check.items.forEach((item) => {
      item.status = 'ready';
    });
    check.status = 'ready';
    (check as any).bumpedAt = new Date().toISOString();
    (check as any).bumpedByStaffId = currentStaff.id;
    (check as any).bumpedByName = currentStaff.name;

    const relatedTaskId = Object.keys(db.deliveryTasks).find((tId) => {
      const dt = db.deliveryTasks[tId];
      return dt.orderNumber === check.checkNumber || dt.orderId === id.replace('chk-', '');
    });
    if (relatedTaskId && db.deliveryTasks[relatedTaskId]) {
      const dTask = db.deliveryTasks[relatedTaskId];
      if (dTask.status === 'assigned') {
        dTask.status = 'accepted';
      }
    }

    const orderId = id.startsWith('chk-') ? id.replace('chk-', '') : id;
    if (db.orders[orderId]) {
      db.orders[orderId].status = 'ready';
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'KDS_TICKET_BUMPED',
      `Bumped ticket #${check.checkNumber} (${check.items.length} items ready)`
    );

    res.json({ success: true, check });
  });

  router.post('/api/pos/kds/tickets/:id/recall', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const check = db.checks[id];

    if (!check) return res.status(404).json({ error: 'Ticket not found.' });

    check.items.forEach((item) => {
      item.status = 'sent_to_kitchen';
    });
    check.status = 'sent_to_kitchen';
    delete (check as any).bumpedAt;

    const orderId = id.startsWith('chk-') ? id.replace('chk-', '') : id;
    if (db.orders[orderId]) {
      db.orders[orderId].status = 'preparing';
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'KDS_TICKET_RECALLED',
      `Recalled ticket #${check.checkNumber} back to kitchen preparation queue`
    );

    res.json({ success: true, check });
  });

  // 7. Shift Management & Cash Drawer
  router.get('/api/pos/shifts/current', requireAuth, (req, res) => {
    const db = getDb();
    const { branchId } = req.query;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const targetBranch = (branchId as string) || currentStaff.branchId;

    const activeShift = Object.values(db.shifts).find(
      (s) => s.branchId === targetBranch && s.status === 'open'
    );

    res.json(activeShift || null);
  });

  router.post(
    '/api/pos/shifts/open',
    requireAuth,
    requireRole(['cashier', 'head_cashier', 'store_manager', 'branch_manager', 'super_admin', 'corporate_admin']),
    (req, res) => {
      const db = getDb();
      const currentStaff = (req as any).staff as DbStaffAccount;
      const { branchId = currentStaff.branchId, openingFloat = 0, registerId = 'POS-REG-01', notes } = req.body;

      const existing = Object.values(db.shifts).find(
        (s) => s.branchId === branchId && s.registerId === registerId && s.status === 'open'
      );

      if (existing) {
        return res.status(400).json({ error: `An open shift (${existing.shiftNumber}) is already active on this register.` });
      }

      const shiftId = `shift-${Date.now()}`;
      const shiftNumber = `SFT-${branchId.toUpperCase()}-${String(Object.keys(db.shifts).length + 1).padStart(4, '0')}`;
      const now = new Date().toISOString();

      const newShift: DbShift = {
        id: shiftId,
        shiftNumber,
        branchId,
        registerId,
        openedByStaffId: currentStaff.id,
        openedByName: currentStaff.name,
        openedAt: now,
        openingFloat: Number(openingFloat) || 0,
        totalCashSales: 0,
        totalPosSales: 0,
        totalTransferSales: 0,
        totalDiscounts: 0,
        totalRefunds: 0,
        totalVoids: 0,
        totalOrders: 0,
        cashDropsTotal: 0,
        paidOutsTotal: 0,
        expectedCashInTill: Number(openingFloat) || 0,
        status: 'open',
        notes,
      };

      db.shifts[shiftId] = newShift;

      db.cashMovements.push({
        id: `cm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        shiftId,
        branchId,
        timestamp: now,
        movementType: 'opening_float',
        amount: Number(openingFloat) || 0,
        reason: `Initial Opening Float for ${shiftNumber}`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
      });

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'SHIFT_OPENED',
        `Opened ${shiftNumber} on ${registerId} with float ₦${openingFloat}`
      );

      res.status(201).json({ success: true, shift: newShift });
    }
  );

  router.post('/api/pos/shifts/:id/cash-movement', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const { movementType, amount, reason, recipientOrRef, notes } = req.body;
    const shift = db.shifts[id];

    if (!shift || shift.status !== 'open') {
      return res.status(404).json({ error: 'Active open shift not found.' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount required.' });
    }

    const isManagerOrAdmin = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin'].includes(currentStaff.role);
    if (shift.openedByStaffId !== currentStaff.id && !isManagerOrAdmin) {
      return res.status(403).json({
        error: `Access denied: You cannot record cash movements on another cashier's shift (${shift.openedByName}).`,
      });
    }
    if (shift.branchId !== currentStaff.branchId && !['super_admin', 'corporate_admin'].includes(currentStaff.role)) {
      return res.status(403).json({ error: `Access denied: Shift belongs to another branch.` });
    }

    const now = new Date().toISOString();

    if (movementType === 'safe_drop') {
      shift.cashDropsTotal += numAmount;
      shift.expectedCashInTill -= numAmount;
    } else if (movementType === 'paid_out') {
      shift.paidOutsTotal += numAmount;
      shift.expectedCashInTill -= numAmount;
    } else if (movementType === 'cash_refund') {
      shift.totalRefunds += numAmount;
      shift.expectedCashInTill -= numAmount;
    } else if (movementType === 'adjustment') {
      shift.expectedCashInTill += numAmount;
    }

    const movement: DbCashMovement = {
      id: `cm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      shiftId: shift.id,
      branchId: shift.branchId,
      timestamp: now,
      movementType,
      amount: numAmount,
      reason: reason || 'Cash movement',
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      recipientOrRef,
      notes,
    };

    db.cashMovements.push(movement);
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'CASH_DROP',
      `Logged ${movementType} of ₦${numAmount} in ${shift.shiftNumber}: ${reason}`
    );

    res.json({ success: true, movement, shift });
  });

  router.use(createShiftCloseSubRouter({ getDb, saveDatabaseSync, requireAuth, requireBranchAccess, logAuditEvent }));

  return router;
}
