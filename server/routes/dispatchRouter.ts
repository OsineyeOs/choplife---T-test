import { Router, Request, Response, RequestHandler } from 'express';
import crypto from 'crypto';
import { db, saveDatabaseSync, DbStaffAccount, DbRider, DbDeliveryTask } from '../../server_db';
import { supervisorAuthService } from '../services/supervisorAuthService';

export interface DispatchRouterDeps {
  requireAuth: RequestHandler;
  requireBranchAccess: RequestHandler;
  requireRole: (roles: string[]) => RequestHandler;
  sendCustomerNotification: (params: any) => any;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    description: string
  ) => any;
  hasPermission: (staff: DbStaffAccount, permissionCode: string) => Promise<boolean>;
}

export function createDispatchRouter(deps: DispatchRouterDeps): Router {
  const router = Router();
  const { requireAuth, requireBranchAccess, sendCustomerNotification, logAuditEvent, hasPermission } = deps;

  const canAssignRegularDelivery = async (staff: DbStaffAccount): Promise<boolean> => {
    if (!staff || staff.role === 'auditor' || staff.role === 'rider' || staff.role === 'kitchen_lead') return false;
    if (await hasPermission(staff, 'delivery.assign')) return true;
    return [
      'super_admin',
      'admin',
      'corporate_admin',
      'branch_manager',
      'store_manager',
      'shift_supervisor',
      'dispatch_lead',
      'dispatch_manager',
      'cashier',
      'customer_care',
    ].includes(staff.role);
  };

  const canManageWholesaleDispatch = async (staff: DbStaffAccount): Promise<boolean> => {
    if (!staff || staff.role === 'auditor' || staff.role === 'rider' || staff.role === 'cashier' || staff.role === 'receptionist') {
      return false;
    }
    if (await hasPermission(staff, 'delivery.wholesale.dispatch')) return true;
    return [
      'super_admin',
      'admin',
      'corporate_admin',
      'branch_manager',
      'store_manager',
      'shift_supervisor',
      'dispatch_lead',
      'dispatch_manager',
      'storekeeper',
      'inventory_controller',
    ].includes(staff.role);
  };

  const isWholesaleDeliveryTaskOrOrder = (taskOrOrder: any): boolean => {
    if (!taskOrOrder) return false;
    if (taskOrOrder.dispatchType === 'wholesale_bread' || taskOrOrder.isWholesaleBread === true || taskOrOrder.isWholesaleDelivery === true) {
      return true;
    }
    const items = taskOrOrder.itemsSummary || taskOrOrder.items || [];
    return Array.isArray(items) && items.some((it: any) => Boolean(it?.isWholesaleApplied));
  };

  const ensureDeliveryTaskForOrderOrCheck = (targetId: string): DbDeliveryTask | null => {
    if (db.deliveryTasks[targetId]) {
      return db.deliveryTasks[targetId];
    }
    const byOrder = Object.values(db.deliveryTasks).find(
      (t: any) => t.orderId === targetId || t.checkId === targetId || t.orderNumber === targetId
    );
    if (byOrder) return byOrder;

    const order: any = db.orders[targetId] || Object.values(db.orders).find((o: any) => o.orderNumber === targetId);
    if (order && (order.orderType === 'delivery' || isWholesaleDeliveryTaskOrOrder(order))) {
      const pickupCode = order.pickupAuthorizationCode || order.deliveryPin || String(Math.floor(1000 + Math.random() * 9000));
      const isWholesale = isWholesaleDeliveryTaskOrOrder(order);
      const task: any = {
        id: order.id,
        orderId: order.id,
        checkId: `chk-${order.id}`,
        orderNumber: order.orderNumber,
        branchId: order.branchId || 'gra',
        customerName: order.deliveryDetails?.customerName || 'Delivery Customer',
        customerPhone: order.deliveryDetails?.customerPhone || '0800-000-0000',
        deliveryAddress: order.deliveryDetails?.deliveryAddress || order.deliveryDetails?.address || 'Customer Address',
        deliveryZone: order.deliveryDetails?.deliveryZone || 'Standard',
        landmark: order.deliveryDetails?.landmark || '',
        orderTotal: Number(order.total || 0),
        paymentMethod: order.paymentMethod || 'cash_on_delivery',
        paymentStatus: order.paymentStatus || 'unpaid',
        codAmountDue: order.paymentStatus === 'paid' ? 0 : (order.paymentMethod === 'cash_on_delivery' ? Number(order.total || 0) : 0),
        codAmountCollected: 0,
        status: order.riderId ? 'assigned' : 'pending',
        riderId: order.riderId,
        riderName: order.riderName,
        cashReconciled: order.paymentStatus === 'paid',
        pickupAuthorizationCode: pickupCode,
        notes: order.deliveryDetails?.deliveryNotes || '',
        dispatchType: isWholesale ? 'wholesale_bread' : 'restaurant_meal',
        isWholesaleBread: isWholesale,
        itemsSummary: (order.items || []).map((it: any) => ({
          productId: it.productId || it.id,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice || it.price,
          totalPrice: it.totalPrice || (Number(it.unitPrice || it.price || 0) * Number(it.quantity || 1)),
          isWholesaleApplied: Boolean(it.isWholesaleApplied),
        })),
        assignmentHistory: Array.isArray(order.assignmentHistory) ? order.assignmentHistory : [],
      };
      db.deliveryTasks[order.id] = task;
      return task;
    }

    const check: any = db.checks[targetId] || Object.values(db.checks).find((c: any) => c.checkNumber === targetId);
    if (check && (check.checkType === 'delivery' || isWholesaleDeliveryTaskOrOrder(check))) {
      const pickupCode = String(Math.floor(1000 + Math.random() * 9000));
      const isWholesale = isWholesaleDeliveryTaskOrOrder(check);
      const task: any = {
        id: check.id,
        orderId: check.orderId || check.id,
        checkId: check.id,
        orderNumber: check.checkNumber,
        branchId: check.branchId || 'gra',
        customerName: check.customerName || 'Delivery Customer',
        customerPhone: check.customerPhone || '0800-000-0000',
        deliveryAddress: check.deliveryAddress || 'Customer Delivery Address',
        deliveryZone: check.deliveryZone || 'Standard',
        landmark: check.landmark || '',
        orderTotal: Number(check.total || 0),
        paymentMethod: check.paymentMethod || 'cash_on_delivery',
        paymentStatus: check.paymentStatus || 'unpaid',
        codAmountDue: check.paymentStatus === 'paid' ? 0 : Number(check.remainingBalance ?? check.total ?? 0),
        codAmountCollected: 0,
        status: check.riderId ? 'assigned' : 'pending',
        riderId: check.riderId,
        riderName: check.riderName,
        cashReconciled: check.paymentStatus === 'paid',
        pickupAuthorizationCode: pickupCode,
        notes: check.notes || '',
        dispatchType: isWholesale ? 'wholesale_bread' : 'restaurant_meal',
        isWholesaleBread: isWholesale,
        itemsSummary: (check.items || []).map((it: any) => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          isWholesaleApplied: Boolean(it.isWholesaleApplied),
        })),
        assignmentHistory: Array.isArray(check.assignmentHistory) ? check.assignmentHistory : [],
      };
      db.deliveryTasks[check.id] = task;
      return task;
    }

    return null;
  };

  router.get('/api/dispatch/tasks', requireAuth, requireBranchAccess, async (req, res) => {
    const { branchId, status, riderId, dispatchType, includeWholesale } = req.query;
    const currentStaff = (req as any).staff as DbStaffAccount;
    let list = Object.values(db.deliveryTasks);

    // Separate wholesale bread deliveries from ordinary restaurant meal deliveries unless explicitly requested
    if (dispatchType === 'wholesale_bread') {
      list = list.filter((t) => isWholesaleDeliveryTaskOrOrder(t));
    } else if (includeWholesale !== 'true' && dispatchType !== 'all') {
      list = list.filter((t) => !isWholesaleDeliveryTaskOrOrder(t));
    }

    if (branchId && branchId !== 'all') {
      list = list.filter((t) => t.branchId === branchId);
    }
    if (status) {
      list = list.filter((t) => t.status === status);
    }

    const isRiderRole = ['rider', 'internal_rider', 'external_rider', 'driver'].includes(currentStaff.role);
    if (isRiderRole) {
      list = list.filter((t) => t.riderId === currentStaff.id || t.riderId === currentStaff.staffId);
    } else if (riderId) {
      list = list.filter((t) => t.riderId === riderId);
    }

    res.json(list.sort((a, b) => new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime()));
  });

  // =========================================================================
  // AUTHORISED WHOLESALE BREAD DISPATCH WORKFLOW (/api/dispatch/wholesale/*)
  // =========================================================================
  router.get('/api/dispatch/wholesale', requireAuth, requireBranchAccess, async (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    if (!(await canManageWholesaleDispatch(currentStaff)) && currentStaff.role !== 'auditor') {
      return res.status(403).json({
        error: 'Access Denied: Missing required privilege delivery.wholesale.dispatch for wholesale bread dispatch.',
      });
    }

    // Materialize any wholesale bread delivery orders or checks not yet in db.deliveryTasks
    for (const ord of Object.values(db.orders || {}) as any[]) {
      if ((ord.orderType === 'delivery' || ord.isWholesaleDelivery) && isWholesaleDeliveryTaskOrOrder(ord)) {
        ensureDeliveryTaskForOrderOrCheck(ord.id);
      }
    }
    for (const chk of Object.values(db.checks || {}) as any[]) {
      if (chk.checkType === 'delivery' && isWholesaleDeliveryTaskOrOrder(chk)) {
        ensureDeliveryTaskForOrderOrCheck(chk.id);
      }
    }

    const { branchId, status } = req.query;
    let list = Object.values(db.deliveryTasks).filter((t) => isWholesaleDeliveryTaskOrOrder(t));
    if (branchId && branchId !== 'all') {
      list = list.filter((t) => t.branchId === branchId);
    }
    if (status && status !== 'all') {
      list = list.filter((t) => t.status === status);
    }

    const enriched = list.map((t: any) => {
      const linkedOrder: any = db.orders[t.orderId];
      const linkedCheck: any = db.checks[t.checkId || `chk-${t.orderId}`] || db.checks[t.id];
      const items =
        t.itemsSummary ||
        linkedOrder?.items ||
        linkedCheck?.items ||
        [];
      return {
        ...t,
        dispatchType: 'wholesale_bread',
        isWholesaleBread: true,
        paymentStatus: t.paymentStatus || linkedOrder?.paymentStatus || linkedCheck?.paymentStatus || 'unpaid',
        paymentMethod: t.paymentMethod || linkedOrder?.paymentMethod || linkedCheck?.paymentMethod || 'cash_on_delivery',
        itemsSummary: items.map((it: any) => ({
          productId: it.productId || it.id,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice || it.price,
          totalPrice: it.totalPrice || (Number(it.unitPrice || it.price || 0) * Number(it.quantity || 1)),
          isWholesaleApplied: Boolean(it.isWholesaleApplied ?? true),
        })),
      };
    });

    res.json(enriched.sort((a, b) => new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime()));
  });

  router.post('/api/dispatch/wholesale/:id/assign', requireAuth, async (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    if (!(await canManageWholesaleDispatch(currentStaff))) {
      return res.status(403).json({
        error: 'Access Denied: Missing required privilege delivery.wholesale.dispatch to assign wholesale bread drivers.',
      });
    }

    const { id } = req.params;
    const { riderId, driverId, riderName, driverName, driverPhone, vehicleNumber, vehiclePlate, reason } = req.body;
    const task: any = ensureDeliveryTaskForOrderOrCheck(id);
    if (!task) {
      return res.status(404).json({ error: 'Wholesale bread delivery task or order not found.' });
    }

    const resolvedRiderId = String(riderId || driverId || driverName || '').trim();
    const riderObj = resolvedRiderId ? db.riders[resolvedRiderId] : undefined;
    const resolvedRiderName = String(riderName || driverName || riderObj?.name || '').trim();
    if (!resolvedRiderId && !resolvedRiderName) {
      return res.status(400).json({ error: 'Driver/rider ID or name is required for wholesale bread dispatch assignment.' });
    }

    const now = new Date().toISOString();
    const previousRiderId = task.riderId;
    const previousRiderName = task.riderName;
    const isReassignment = Boolean(previousRiderId && previousRiderId !== resolvedRiderId);
    const resolvedVehicle = vehicleNumber || vehiclePlate || riderObj?.bikeNumber;

    task.dispatchType = 'wholesale_bread';
    task.isWholesaleBread = true;
    task.riderId = resolvedRiderId || `drv-${Date.now()}`;
    task.riderName = resolvedRiderName || resolvedRiderId;
    if (driverPhone || riderObj?.phone) task.driverPhone = driverPhone || riderObj?.phone;
    if (resolvedVehicle) {
      task.vehicleNumber = resolvedVehicle;
      task.vehiclePlate = resolvedVehicle;
    }
    if (task.status === 'pending') {
      task.status = 'assigned';
    }
    task.assignedAt = now;
    task.assignedByStaffId = currentStaff.id;
    task.assignedByName = currentStaff.name;

    if (isReassignment) {
      task.reassignedAt = now;
      task.reassignedByStaffId = currentStaff.id;
      task.reassignedByName = currentStaff.name;
      task.reassignmentReason = reason || 'Driver/vehicle reassigned';
    }

    task.assignmentHistory = Array.isArray(task.assignmentHistory) ? task.assignmentHistory : [];
    const historyEntry = {
      action: isReassignment ? 'reassigned' : 'assigned',
      previousRiderId: isReassignment ? previousRiderId : undefined,
      previousRiderName: isReassignment ? previousRiderName : undefined,
      riderId: task.riderId,
      riderName: task.riderName,
      vehicleNumber: task.vehicleNumber,
      assignedByStaffId: currentStaff.id,
      assignedByName: currentStaff.name,
      assignedByRole: currentStaff.role,
      timestamp: now,
      reason: reason || (isReassignment ? 'Original driver unavailable' : 'Initial wholesale bread dispatch assignment'),
    };
    task.assignmentHistory.push(historyEntry);

    // Preserve wholesale order & payment records while syncing driver metadata
    const linkedOrder: any = db.orders[task.orderId];
    if (linkedOrder) {
      linkedOrder.riderId = task.riderId;
      linkedOrder.riderName = task.riderName;
      linkedOrder.vehicleNumber = task.vehicleNumber;
      linkedOrder.dispatchType = 'wholesale_bread';
      linkedOrder.isWholesaleBread = true;
      linkedOrder.assignmentHistory = task.assignmentHistory;
    }
    const linkedCheck: any = db.checks[task.checkId || `chk-${task.orderId}`] || db.checks[task.id];
    if (linkedCheck) {
      linkedCheck.riderId = task.riderId;
      linkedCheck.riderName = task.riderName;
      linkedCheck.assignmentHistory = task.assignmentHistory;
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      isReassignment ? 'WHOLESALE_DRIVER_REASSIGNED' : 'WHOLESALE_DRIVER_ASSIGNED',
      `${isReassignment ? 'Reassigned' : 'Assigned'} wholesale bread delivery ${task.orderNumber} to ${task.riderName}${task.vehicleNumber ? ` (${task.vehicleNumber})` : ''}`
    );

    res.json({ success: true, isReassignment, task });
  });

  const handleWholesaleDispatchStatus = async (req: Request, res: Response) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isRiderRole = ['rider', 'internal_rider', 'external_rider', 'driver'].includes(currentStaff.role);
    if (!(await canManageWholesaleDispatch(currentStaff)) && !isRiderRole) {
      return res.status(403).json({
        error: 'Access Denied: Missing required privilege delivery.wholesale.dispatch to update wholesale delivery status.',
      });
    }

    const { id } = req.params;
    const { status, notes, checkpointNote } = req.body;
    const task: any = ensureDeliveryTaskForOrderOrCheck(id);
    if (!task) {
      return res.status(404).json({ error: 'Wholesale bread delivery task not found.' });
    }

    const validStatuses = ['pending', 'assigned', 'loaded', 'out_for_delivery', 'delivered', 'failed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid wholesale dispatch status '${status}'.` });
    }

    const now = new Date().toISOString();
    task.dispatchType = 'wholesale_bread';
    task.isWholesaleBread = true;
    task.status = status === 'loaded' ? 'out_for_delivery' : status;
    task.wholesaleStage = status;
    if (notes || checkpointNote) {
      task.checkpointNote = notes || checkpointNote;
      task.checkpointAt = now;
    }
    if (status === 'out_for_delivery' || status === 'loaded') {
      task.collectedAt = task.collectedAt || now;
    }
    if (status === 'delivered') {
      task.deliveredAt = now;
      if (task.paymentMethod === 'cash_on_delivery' && task.codAmountDue > 0) {
        task.codAmountCollected = task.codAmountDue;
      }
    }

    // Preserve wholesale order and payment history
    const linkedOrder: any = db.orders[task.orderId];
    if (linkedOrder) {
      if (status === 'out_for_delivery' || status === 'loaded') linkedOrder.status = 'out_for_delivery';
      if (status === 'delivered') {
        linkedOrder.status = 'delivered';
        if (linkedOrder.paymentMethod === 'cash_on_delivery') {
          linkedOrder.paymentStatus = 'paid';
        }
      }
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'WHOLESALE_DELIVERY_STATUS',
      `Updated wholesale bread delivery ${task.orderNumber} status to ${status}`
    );

    res.json({ success: true, task, order: linkedOrder || null });
  };

  router.put('/api/dispatch/wholesale/:id/status', requireAuth, handleWholesaleDispatchStatus);
  router.post('/api/dispatch/wholesale/:id/status', requireAuth, handleWholesaleDispatchStatus);

  router.get('/api/dispatch/riders', requireAuth, requireBranchAccess, (req, res) => {
    const { branchId } = req.query;
    let list = Object.values(db.riders);
    if (branchId && branchId !== 'all') {
      list = list.filter((r) => r.branchId === branchId);
    }
    res.json(list);
  });

  router.post('/api/dispatch/riders', requireAuth, async (req, res) => {
    const { name, phone, branchId, type, partnerName, bikeNumber, currentStatus } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;
    if (!(await canAssignRegularDelivery(currentStaff))) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions to enroll riders.' });
    }

    if (!name || !phone) {
      return res.status(400).json({ error: 'Rider name and phone are required.' });
    }

    const riderId = `rdr-${Date.now()}`;
    const newRider: DbRider = {
      id: riderId,
      name: name.trim(),
      phone: phone.trim(),
      branchId: branchId || currentStaff.branchId || 'gra',
      type: type || 'internal_fleet',
      partnerName: partnerName?.trim() || undefined,
      bikeNumber: bikeNumber?.trim() || undefined,
      currentStatus: currentStatus || 'available',
      cashInHand: 0,
      totalDeliveriesToday: 0,
    };

    db.riders[riderId] = newRider;
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'RIDER_ASSIGNED',
      `Enrolled new ${newRider.type === 'internal_fleet' ? 'fleet rider' : 'partner courier'} "${newRider.name}" (${newRider.bikeNumber || 'No bike'})`
    );

    res.status(201).json({ success: true, rider: newRider });
  });

  const handleAssignOrReassignRider = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { riderId, riderName, reason } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;

    if (!(await canAssignRegularDelivery(currentStaff))) {
      return res.status(403).json({
        error: 'Access Denied: Missing required privilege delivery.assign to assign or reassign delivery riders.',
      });
    }

    const task: any = ensureDeliveryTaskForOrderOrCheck(id);
    if (!task) return res.status(404).json({ error: 'Delivery task or delivery order not found.' });

    if (isWholesaleDeliveryTaskOrOrder(task) && !(await canManageWholesaleDispatch(currentStaff))) {
      return res.status(403).json({
        error: 'Access Denied: Wholesale bread deliveries require delivery.wholesale.dispatch privilege.',
      });
    }

    const resolvedRiderId = String(riderId || '').trim();
    const rider = resolvedRiderId ? db.riders[resolvedRiderId] : undefined;
    const resolvedRiderName = String(riderName || rider?.name || '').trim();

    if (!resolvedRiderId && !resolvedRiderName) {
      return res.status(400).json({ error: 'riderId or riderName is required to assign a rider.' });
    }

    const now = new Date().toISOString();
    const previousRiderId = task.riderId;
    const previousRiderName = task.riderName;
    const isReassignment = Boolean(previousRiderId && previousRiderId !== resolvedRiderId);

    const order: any = db.orders[task.orderId];
    const check: any = db.checks[task.checkId || `chk-${task.orderId}`] || db.checks[task.id];

    task.riderId = resolvedRiderId || `rdr-${Date.now()}`;
    task.riderName = resolvedRiderName || resolvedRiderId;
    if (task.status === 'pending' || !task.status) {
      task.status = 'assigned';
    }
    task.assignedAt = now;
    task.assignedByStaffId = currentStaff.id;
    task.assignedByName = currentStaff.name;

    if (isReassignment) {
      task.reassignedAt = now;
      task.reassignedByStaffId = currentStaff.id;
      task.reassignedByName = currentStaff.name;
      task.reassignmentReason = reason || 'Original rider unavailable / reassigned';
    }

    const historyEntry = {
      action: isReassignment ? 'reassigned' : 'assigned',
      previousRiderId: isReassignment ? previousRiderId : undefined,
      previousRiderName: isReassignment ? previousRiderName : undefined,
      riderId: task.riderId,
      riderName: task.riderName,
      assignedByStaffId: currentStaff.id,
      assignedByName: currentStaff.name,
      assignedByRole: currentStaff.role,
      timestamp: now,
      reason: reason || (isReassignment ? 'Original rider unavailable / reassigned' : 'Assigned dispatch rider'),
      orderStageAtAssignment: order?.status || check?.status || task.status,
      paymentStatusAtAssignment: order?.paymentStatus || check?.paymentStatus || task.paymentStatus || 'unpaid',
    };

    task.assignmentHistory = Array.isArray(task.assignmentHistory) ? task.assignmentHistory : [];
    task.assignmentHistory.push(historyEntry);

    // Synchronize onto order & check while strictly preserving payment and order history
    if (order) {
      order.riderId = task.riderId;
      order.riderName = task.riderName;
      order.assignedByStaffId = currentStaff.id;
      order.assignedByName = currentStaff.name;
      order.assignedAt = now;
      order.assignmentHistory = task.assignmentHistory;
    }
    if (check) {
      check.riderId = task.riderId;
      check.riderName = task.riderName;
      check.assignedByStaffId = currentStaff.id;
      check.assignedByName = currentStaff.name;
      check.assignedAt = now;
      check.assignmentHistory = task.assignmentHistory;
    }

    saveDatabaseSync();

    try {
      const pin =
        task.pickupAuthorizationCode ||
        order?.pickupAuthorizationCode ||
        order?.deliveryPin ||
        Math.floor(1000 + Math.random() * 9000).toString();
      sendCustomerNotification({
        orderId: task.orderId,
        orderNumber: task.orderNumber,
        customerName: task.customerName,
        customerPhone: task.customerPhone,
        channel: 'both',
        eventType: 'DISPATCH_EN_ROUTE',
        branchId: task.branchId,
        metadata: {
          riderName: task.riderName || 'Choplife Dispatch Rider',
          riderPhone: rider?.phone || (task.branchId && db.branches[task.branchId]?.phone) || '+234 811 222 3333',
          handoverPin: pin,
        },
      });
    } catch (notifErr) {
      console.error('[NOTIF ENGINE] Rider assign dispatch alert error:', notifErr);
    }

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      isReassignment ? 'RIDER_REASSIGNED' : 'RIDER_ASSIGNED',
      `${isReassignment ? `Reassigned delivery ${task.orderNumber} from ${previousRiderName || previousRiderId} to` : `Assigned delivery ${task.orderNumber} to`} rider ${task.riderName}${reason ? ` (Reason: ${reason})` : ''}`
    );

    res.json({
      success: true,
      isReassignment,
      task,
      order: order || null,
      check: check || null,
      assignmentRecord: historyEntry,
      orderPaymentStatus: order?.paymentStatus || check?.paymentStatus || task.paymentStatus,
    });
  };

  router.post('/api/dispatch/tasks/:id/assign', requireAuth, handleAssignOrReassignRider);
  router.post('/api/dispatch/tasks/:id/reassign', requireAuth, handleAssignOrReassignRider);
  router.post('/api/orders/:id/assign-rider', requireAuth, handleAssignOrReassignRider);

  router.post('/api/dispatch/tasks/batch-assign', requireAuth, async (req, res) => {
    const { taskIds, riderId, riderName } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;

    if (!(await canAssignRegularDelivery(currentStaff))) {
      return res.status(403).json({
        error: 'Access Denied: Missing required privilege delivery.assign to batch-assign riders.',
      });
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0 || !riderId) {
      return res.status(400).json({ error: 'taskIds array and riderId are required.' });
    }

    const now = new Date().toISOString();
    const updatedTasks: DbDeliveryTask[] = [];

    for (const tId of taskIds) {
      const task: any = db.deliveryTasks[tId];
      if (task) {
        const previousRiderId = task.riderId;
        const previousRiderName = task.riderName;
        const isReassignment = Boolean(previousRiderId && previousRiderId !== riderId);
        task.riderId = riderId;
        task.riderName = riderName;
        if (task.status === 'pending' || !task.status) {
          task.status = 'assigned';
        }
        task.assignedAt = now;
        task.assignedByStaffId = currentStaff.id;
        task.assignedByName = currentStaff.name;
        task.assignmentHistory = Array.isArray(task.assignmentHistory) ? task.assignmentHistory : [];
        task.assignmentHistory.push({
          action: isReassignment ? 'reassigned' : 'assigned',
          previousRiderId: isReassignment ? previousRiderId : undefined,
          previousRiderName: isReassignment ? previousRiderName : undefined,
          riderId,
          riderName,
          assignedByStaffId: currentStaff.id,
          assignedByName: currentStaff.name,
          assignedByRole: currentStaff.role,
          timestamp: now,
          reason: 'Batch dispatch assignment',
        });
        updatedTasks.push(task);
      }
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'RIDER_ASSIGNED',
      `Batch assigned ${updatedTasks.length} deliveries to rider ${riderName}`
    );

    res.json({ success: true, count: updatedTasks.length, tasks: updatedTasks });
  });

  router.post('/api/dispatch/tasks/:id/verify-otp', requireAuth, (req, res) => {
    const { id } = req.params;
    const { code } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const task = db.deliveryTasks[id];

    if (!task) return res.status(404).json({ error: 'Delivery task not found.' });

    const expectedCode = String(task.pickupAuthorizationCode || '').trim();
    const providedCode = String(code || '').trim();

    const isMatch = (expectedCode && providedCode === expectedCode);

    if (!isMatch) {
      return res.status(400).json({
        error: `Invalid delivery PIN. Please confirm the 4-digit verification code with the customer.`,
      });
    }

    const now = new Date().toISOString();
    task.status = 'delivered';
    task.deliveredAt = now;

    if (task.paymentMethod === 'cash_on_delivery' && task.codAmountDue > 0) {
      task.codAmountCollected = task.codAmountDue;
    }

    if (db.orders[task.orderId]) {
      db.orders[task.orderId].status = 'delivered';
      if (task.paymentMethod === 'cash_on_delivery') {
        db.orders[task.orderId].paymentStatus = 'paid';
      }
    }

    if (task.riderId && db.riders[task.riderId]) {
      db.riders[task.riderId].totalDeliveriesToday = (db.riders[task.riderId].totalDeliveriesToday || 0) + 1;
      if (task.paymentMethod === 'cash_on_delivery') {
        db.riders[task.riderId].cashInHand = (db.riders[task.riderId].cashInHand || 0) + (task.orderTotal || 0);
      }
    }

    saveDatabaseSync();

    try {
      sendCustomerNotification({
        orderId: task.orderId,
        orderNumber: task.orderNumber,
        customerName: task.customerName,
        customerPhone: task.customerPhone,
        channel: 'both',
        eventType: 'DELIVERY_COMPLETED',
        branchId: task.branchId,
      });
    } catch (notifErr) {
      console.error('[NOTIF ENGINE] Delivery completion alert error:', notifErr);
    }

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'PAYMENT_CONFIRMED',
      `Verified delivery OTP & marked order #${task.orderNumber} successfully delivered`
    );

    res.json({ success: true, message: 'Delivery successfully verified and marked delivered.', task });
  });

  const handleDeliveryTaskStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const task = db.deliveryTasks[id];

    if (!task) return res.status(404).json({ error: 'Delivery task not found.' });

    const isRiderRole = ['rider', 'internal_rider', 'external_rider', 'driver'].includes(currentStaff.role);
    if (isRiderRole && task.riderId && task.riderId !== currentStaff.id && task.riderId !== currentStaff.staffId) {
      return res.status(403).json({ error: 'Unauthorized: You can only update tasks assigned to your rider profile.' });
    }

    const { status, failedReason, checkpoint, checkpointNote } = req.body;

    const now = new Date().toISOString();
    if (status) task.status = status;
    if (status === 'accepted') task.acceptedAt = now;
    if (status === 'collected' || status === 'out_for_delivery') {
      task.collectedAt = now;
      if (db.orders[task.orderId]) {
        db.orders[task.orderId].status = 'out_for_delivery';
      }

      try {
        const rider = task.riderId ? db.riders[task.riderId] : undefined;
        const order = db.orders[task.orderId];
        const pin =
          task.pickupAuthorizationCode ||
          order?.pickupAuthorizationCode ||
          order?.deliveryPin ||
          Math.floor(1000 + Math.random() * 9000).toString();
        sendCustomerNotification({
          orderId: task.orderId,
          orderNumber: task.orderNumber,
          customerName: task.customerName,
          customerPhone: task.customerPhone,
          channel: 'both',
          eventType: 'DISPATCH_EN_ROUTE',
          branchId: task.branchId,
          metadata: {
            riderName: rider?.name || 'Choplife Express Courier',
            riderPhone: rider?.phone || (task.branchId && db.branches[task.branchId]?.phone) || '+234 811 222 3333',
            handoverPin: pin,
          },
        });
      } catch (notifErr) {
        console.error('[NOTIF ENGINE] Out for delivery notification error:', notifErr);
      }
    }

    if (checkpoint || checkpointNote) {
      const cpText = checkpointNote || checkpoint;
      task.checkpoint = checkpoint || 'en_route';
      task.checkpointNote = cpText;
      task.checkpointAt = now;
      if (db.orders[task.orderId]) {
        (db.orders[task.orderId] as any).riderCheckpoint = cpText;
        (db.orders[task.orderId] as any).checkpointAt = now;
      }
    }

    if (status === 'delivered') {
      const order = db.orders[task.orderId];
      const expectedCode = String(task.pickupAuthorizationCode || order?.pickupAuthorizationCode || order?.deliveryPin || '').trim();
      const providedCode = String(req.body.otp || req.body.code || req.body.pin || '').trim();
      const isManager = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin', 'dispatch_manager'].includes(currentStaff.role);
      const supervisor = req.body.supervisorPin 
        ? await supervisorAuthService.verifySupervisorPin(currentStaff, task.branchId, req.body.supervisorPin, 'delivery.override', logAuditEvent)
        : null;
      const isSupervisorOverride = Boolean(supervisor);

      if (!task.otpVerified && providedCode !== expectedCode && !isSupervisorOverride && !isManager) {
        return res.status(400).json({
          error: 'Order cannot be marked delivered without customer handover OTP verification (or manager override).',
          requiresOtp: true,
        });
      }

      task.deliveredAt = now;
      task.otpVerified = true;
      if (db.orders[task.orderId]) {
        db.orders[task.orderId].status = 'delivered';
        if (task.paymentMethod === 'cash_on_delivery') {
          db.orders[task.orderId].paymentStatus = 'paid';
        }
      }
      const matchingCheckKey = Object.keys(db.checks || {}).find((cid) => {
        const c = db.checks[cid];
        return (
          cid === (task as any).checkId ||
          cid === `chk-${task.orderId}` ||
          cid === task.orderId ||
          c.orderId === task.orderId ||
          c.checkNumber === task.orderNumber ||
          (c as any).orderNumber === task.orderNumber
        );
      });
      if (matchingCheckKey && db.checks[matchingCheckKey]) {
        const chk = db.checks[matchingCheckKey];
        chk.status = 'paid';
        chk.closedAt = now;
        chk.closedByStaffId = currentStaff.id;
        chk.closedByName = currentStaff.name;
      }
      if (task.riderId && db.riders[task.riderId]) {
        db.riders[task.riderId].totalDeliveriesToday = (db.riders[task.riderId].totalDeliveriesToday || 0) + 1;
        if (task.paymentMethod === 'cash_on_delivery') {
          db.riders[task.riderId].cashInHand = (db.riders[task.riderId].cashInHand || 0) + (task.orderTotal || 0);
        }
      }
    }
    if (failedReason) task.failedReason = failedReason;

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'DELIVERY_STATUS',
      `Updated delivery ${task.orderNumber} status to ${status || 'checkpoint_updated'}${checkpointNote ? ` (${checkpointNote})` : ''}`
    );

    res.json({ success: true, task });
  };

  router.put('/api/dispatch/tasks/:id/status', requireAuth, handleDeliveryTaskStatus);
  router.post('/api/dispatch/tasks/:id/status', requireAuth, handleDeliveryTaskStatus);

  router.post('/api/dispatch/tasks/:id/cod-collect', requireAuth, (req, res) => {
    const { id } = req.params;
    const { amountCollected } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const task = db.deliveryTasks[id];

    if (!task) return res.status(404).json({ error: 'Delivery task not found.' });

    task.codAmountCollected = Number(amountCollected) || 0;
    task.cashReconciled = true;

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'PAYMENT_CONFIRMED',
      `Rider collected COD ₦${amountCollected} for order ${task.orderNumber}`
    );

    res.json({ success: true, task });
  });

  router.post('/api/dispatch/tasks/:id/remit-cash', requireAuth, (req, res) => {
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const task = db.deliveryTasks[id];

    if (!task) return res.status(404).json({ error: 'Delivery task not found.' });

    if ((task as any).cashRemitted) {
      return res.status(400).json({ error: 'COD cash for this delivery has already been remitted into the register till.' });
    }

    if (task.codAmountCollected <= 0 && task.orderTotal <= 0) {
      return res.status(400).json({ error: 'No COD payment recorded for this delivery task.' });
    }

    const remittanceAmount = task.codAmountCollected > 0 ? task.codAmountCollected : task.orderTotal;
    const now = new Date().toISOString();

    const activeShift = Object.values(db.shifts).find((s) => s.branchId === task.branchId && s.status === 'open');

    if (activeShift) {
      activeShift.totalCashSales += remittanceAmount;
      activeShift.expectedCashInTill += remittanceAmount;

      db.cashMovements.push({
        id: `cm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        shiftId: activeShift.id,
        branchId: task.branchId,
        timestamp: now,
        movementType: 'cash_sale',
        amount: remittanceAmount,
        reason: `Rider COD Remittance: ${task.orderNumber} (${task.riderName || 'Rider'})`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        recipientOrRef: task.orderNumber,
      });
    }

    (task as any).cashRemitted = true;
    (task as any).remittedAt = now;
    (task as any).remittedToStaffId = currentStaff.id;
    (task as any).remittedToStaffName = currentStaff.name;
    task.cashReconciled = true;

    if (task.riderId && db.riders[task.riderId]) {
      db.riders[task.riderId].cashInHand = Math.max(0, (db.riders[task.riderId].cashInHand || 0) - remittanceAmount);
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'PAYMENT_CONFIRMED',
      `Cashier ${currentStaff.name} received COD remittance of ₦${remittanceAmount.toLocaleString()} for order #${task.orderNumber}`
    );

    res.json({
      success: true,
      message: `₦${remittanceAmount.toLocaleString()} successfully remitted into branch till register.`,
      task,
      shift: activeShift || null,
    });
  });

  router.post('/api/orders/:id/checkpoint', requireAuth, (req, res) => {
    const { id } = req.params;
    const { checkpoint, checkpointNote } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const order = db.orders[id];
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const now = new Date().toISOString();
    const note = checkpointNote || checkpoint;
    (order as any).riderCheckpoint = note;
    (order as any).checkpointAt = now;

    const matchingTask = Object.values(db.deliveryTasks).find((t) => t.orderId === id);
    if (matchingTask) {
      matchingTask.checkpoint = checkpoint;
      matchingTask.checkpointNote = note;
      matchingTask.checkpointAt = now;
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'DISPATCH_CHECKPOINT',
      `Rider posted checkpoint "${note}" for order ${order.orderNumber}`
    );

    res.json({ success: true, order, checkpoint: note, checkpointAt: now });
  });

  return router;
}
