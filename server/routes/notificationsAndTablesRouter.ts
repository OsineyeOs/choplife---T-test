import { Router } from 'express';
import crypto from 'crypto';
import type { DbDatabase, DbStaffAccount } from '../../server_db.ts';
import type { CustomerNotificationPayload } from '../services/customerNotificationService.ts';
import { createNotificationGatewaysRouter } from './notificationGatewaysRouter.ts';

export function createNotificationsAndTablesRouter(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: any;
  requireRole: any;
  requirePermission: any;
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
    requirePermission,
    requireBranchAccess,
    sendCustomerNotification,
    logAuditEvent,
  } = deps;

  // 3.6 Audited Free Delivery Waiver Endpoints
  router.post('/api/orders/:id/waive-delivery-fee', requireAuth, requirePermission('delivery.free_authorise'), (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const { reason, waiverAmount } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Mandatory waiver reason required for delivery fee audit trail.' });
    }

    const order = db.orders[id] || Object.values(db.orders).find((o: any) => o.orderNumber === id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const originalDeliveryFee = Number(order.deliveryFee) || 0;
    if (originalDeliveryFee === 0 && !order.deliveryFeeWaiver) {
      return res.status(400).json({ error: 'This order already has zero delivery fee.' });
    }

    const waiveAmt = waiverAmount !== undefined ? Math.min(originalDeliveryFee, Math.max(0, Number(waiverAmount))) : originalDeliveryFee;
    const newDeliveryFee = originalDeliveryFee - waiveAmt;

    const previousTotal = Number(order.total);
    order.deliveryFee = newDeliveryFee;
    order.total = Math.max(0, previousTotal - waiveAmt);
    order.deliveryFeeWaiver = {
      originalFee: originalDeliveryFee,
      waivedAmount: waiveAmt,
      remainingFee: newDeliveryFee,
      authorisedByStaffId: currentStaff.staffId,
      authorisedByName: currentStaff.name,
      authorisedRole: currentStaff.role,
      reason: reason.trim(),
      timestamp: new Date().toISOString(),
    };

    const checkId = `chk-${order.id}`;
    if (db.checks[checkId]) {
      db.checks[checkId].deliveryFee = newDeliveryFee;
      db.checks[checkId].total = Math.max(0, Number(db.checks[checkId].total) - waiveAmt);
      db.checks[checkId].notes = `${db.checks[checkId].notes || ''} [Delivery Fee Waived: -₦${waiveAmt.toLocaleString()} by ${currentStaff.name} - Reason: ${reason.trim()}]`.trim();
    }

    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      order.branchId,
      'FREE_DELIVERY_AUTHORISED',
      `Authorized delivery fee waiver for order #${order.orderNumber}: Waived ₦${waiveAmt.toLocaleString()} (was ₦${originalDeliveryFee.toLocaleString()}). Reason: "${reason.trim()}"`,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        originalDeliveryFee,
        waivedAmount: waiveAmt,
        remainingFee: newDeliveryFee,
        reason: reason.trim(),
        authorisedBy: currentStaff.staffId,
      }
    );

    res.json({
      success: true,
      message: `Delivery fee waiver of ₦${waiveAmt.toLocaleString()} successfully authorized.`,
      order,
    });
  });

  router.post('/api/pos/checks/:id/waive-delivery-fee', requireAuth, requirePermission('delivery.free_authorise'), (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const { reason, waiverAmount } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Mandatory waiver reason required for delivery fee audit trail.' });
    }

    const check = db.checks[id];
    if (!check) {
      return res.status(404).json({ error: 'POS check not found.' });
    }

    const originalFee = Number(check.deliveryFee) || 0;
    const waiveAmt = waiverAmount !== undefined ? Math.min(originalFee, Math.max(0, Number(waiverAmount))) : originalFee;
    const newDeliveryFee = originalFee - waiveAmt;

    check.deliveryFee = newDeliveryFee;
    check.total = Math.max(0, Number(check.total) - waiveAmt);
    check.notes = `${check.notes || ''} [Delivery Waived: ₦${waiveAmt.toLocaleString()} by ${currentStaff.name} - ${reason.trim()}]`.trim();

    if (check.orderId && db.orders[check.orderId]) {
      db.orders[check.orderId].deliveryFee = newDeliveryFee;
      db.orders[check.orderId].total = Math.max(0, Number(db.orders[check.orderId].total) - waiveAmt);
      db.orders[check.orderId].deliveryFeeWaiver = {
        originalFee,
        waivedAmount: waiveAmt,
        remainingFee: newDeliveryFee,
        authorisedByStaffId: currentStaff.staffId,
        authorisedByName: currentStaff.name,
        authorisedRole: currentStaff.role,
        reason: reason.trim(),
        timestamp: new Date().toISOString(),
      };
    }

    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      check.branchId,
      'FREE_DELIVERY_AUTHORISED',
      `Authorized delivery fee waiver for check #${check.checkNumber}: Waived ₦${waiveAmt.toLocaleString()} (was ₦${originalFee.toLocaleString()}). Reason: "${reason.trim()}"`,
      {
        checkId: check.id,
        checkNumber: check.checkNumber,
        originalDeliveryFee: originalFee,
        waivedAmount: waiveAmt,
        remainingFee: newDeliveryFee,
        reason: reason.trim(),
        authorisedBy: currentStaff.staffId,
      }
    );

    res.json({
      success: true,
      message: `Delivery fee waiver of ₦${waiveAmt.toLocaleString()} successfully authorized.`,
      check,
    });
  });

  router.post('/api/dispatch/tasks/:id/reveal-pin', requireAuth, requirePermission('delivery.handover_pin.view'), (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const task = db.deliveryTasks[id];

    if (!task) {
      return res.status(404).json({ error: 'Delivery task not found.' });
    }

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      task.branchId,
      'HANDOVER_PIN_ACCESSED',
      `Staff ${currentStaff.name} revealed secure handover PIN for order #${task.orderNumber}`
    );

    res.json({
      success: true,
      handoverPin: task.handoverPin,
      orderNumber: task.orderNumber,
    });
  });

  // 4. Restaurant Tables Management
  router.get('/api/pos/tables', requireAuth, requireBranchAccess, (req, res) => {
    const db = getDb();
    const { branchId } = req.query;
    let tablesList = Object.values(db.tables);

    if (branchId && branchId !== 'all') {
      tablesList = tablesList.filter((t) => t.branchId === branchId);
    }

    res.json(tablesList);
  });

  router.put('/api/pos/tables/:id/status', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { status, guestCount, assignedStaffId, assignedStaffName, notes } = req.body;
    const table = db.tables[id];

    if (!table) return res.status(404).json({ error: 'Table not found.' });

    if (status) table.status = status;
    if (guestCount !== undefined) table.guestCount = guestCount;
    if (assignedStaffId !== undefined) table.assignedStaffId = assignedStaffId;
    if (assignedStaffName !== undefined) table.assignedStaffName = assignedStaffName;
    if (notes !== undefined) table.notes = notes;
    table.updatedAt = new Date().toISOString();

    saveDatabaseSync();
    res.json({ success: true, table });
  });

  router.post('/api/reservations/table', (req, res) => {
    const db = getDb();
    const { name, phone, date, time = '19:00', guests = 4, branch = 'gra', specialReq = '' } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanPhone = String(phone || '').trim();
    const cleanDate = String(date || '').trim();
    const branchId = ['gra', 'okabere', 'ugbowo'].includes(String(branch)) ? String(branch) : 'gra';
    const guestCount = Math.max(1, Math.min(50, Number(guests) || 4));

    if (!cleanName || cleanPhone.replace(/\D/g, '').length < 8 || !cleanDate) {
      return res.status(400).json({ error: 'Full name, valid phone number, and reservation date are required.' });
    }

    const reservationId = `res-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const reservationCode = `TBL-${String(Math.floor(100000 + Math.random() * 900000))}`;
    const branchTables = Object.values(db.tables || {}).filter((t) => t.branchId === branchId);
    const candidateTable =
      branchTables.find((t) => t.status === 'available' && Number(t.capacity || 4) >= guestCount) ||
      branchTables[0];

    const reservationRecord = {
      id: reservationId,
      reservationCode,
      customerName: cleanName,
      customerPhone: cleanPhone,
      date: cleanDate,
      time: String(time || '19:00'),
      guests: guestCount,
      branchId,
      tableId: candidateTable?.id || null,
      tableNumber: candidateTable?.tableNumber || 'Host Assigned',
      specialRequests: String(specialReq || '').trim(),
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    (db as any).tableReservations = (db as any).tableReservations || {};
    (db as any).tableReservations[reservationId] = reservationRecord;

    saveDatabaseSync();
    logAuditEvent(
      cleanName,
      'online_customer',
      branchId,
      'TABLE_RESERVATION_CREATED',
      `Reserved dine-in table (${reservationRecord.tableNumber}) for ${guestCount} guests on ${cleanDate} at ${reservationRecord.time} — Ref: ${reservationCode}`
    );

    try {
      sendCustomerNotification({
        orderId: reservationId,
        orderNumber: reservationCode,
        customerName: cleanName,
        customerPhone: cleanPhone,
        channel: 'whatsapp',
        eventType: 'MANUAL_ALERT',
        customMessage: `🍽️ *Choplife Republic Table Reservation Confirmed!*\n\nHi *${cleanName}*, your table reservation (*${reservationCode}*) for *${guestCount} guests* on *${cleanDate} at ${reservationRecord.time}* (${branchId.toUpperCase()} Branch, Table ${reservationRecord.tableNumber}) has been logged with our host desk.`,
        branchId,
      });
    } catch (_e) {
      // Non-blocking notification
    }

    res.status(201).json({
      success: true,
      reservation: reservationRecord,
    });
  });

  router.get('/api/reservations/table', requireAuth, requireBranchAccess, (req, res) => {
    const db = getDb();
    const { branchId } = req.query;
    let list = Object.values((db as any).tableReservations || {});
    if (branchId && branchId !== 'all') {
      list = list.filter((r: any) => r.branchId === branchId);
    }
    res.json(list);
  });

  router.use(createNotificationGatewaysRouter(deps));

  return router;
}
