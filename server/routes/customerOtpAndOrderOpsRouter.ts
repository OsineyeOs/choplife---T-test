import { Router } from 'express';
import crypto from 'crypto';
import {
  awardOrderLoyaltyPointsIfEligible,
  reverseOrderLoyaltyPointsIfAwarded,
} from '../../server_db.ts';
import type {
  DbDatabase,
  DbStaffAccount,
  DbSession,
} from '../../server_db.ts';
import type { CustomerNotificationPayload } from '../services/customerNotificationService.ts';
import { createPosManagerOverrideRouter } from './posManagerOverrideRouter.ts';

interface CustomerVerificationChallenge {
  id: string;
  phoneDigits: string;
  orderNumber: string;
  tokenHash: string;
  expiresAt: number;
  used: boolean;
}
interface VerifiedCustomerSession {
  sessionTokenHash: string;
  phoneDigits: string;
  expiresAt: number;
}
const customerVerificationChallenges = new Map<string, CustomerVerificationChallenge>();
const verifiedCustomerSessions = new Map<string, VerifiedCustomerSession>();

export function createCustomerOtpAndOrderOpsRouter(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: any;
  requireBranchAccess: any;
  getSessionFromRequest: (req: any) => DbSession | null;
  sendCustomerNotification: (payload: CustomerNotificationPayload) => any[];
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
  reverseInventoryForOrder?: (
    orderRef: string,
    branchId: string,
    staff: any,
    reason?: string
  ) => any;
  staffRepository?: any;
}): Router {
  const router = Router();
  const {
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireBranchAccess,
    getSessionFromRequest,
    sendCustomerNotification,
    logAuditEvent,
    reverseInventoryForOrder,
    staffRepository,
  } = deps;

  router.post('/api/customer/auth/request-otp', (req, res) => {
    const db = getDb();
    const { phone, orderNumber, ttlMs } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const cleanOrderNum = String(orderNumber || '').trim().toUpperCase();

    if (cleanPhone.length < 8 || !cleanOrderNum) {
      return res.status(400).json({
        error: 'Both phone number and a valid order number are required to initiate verification.',
      });
    }

    const matchedOrder = Object.values(db.orders).find((o: any) => {
      const oPhone = (o.deliveryDetails?.customerPhone || '').replace(/\D/g, '');
      return (
        oPhone.length >= 8 &&
        oPhone.slice(-10) === cleanPhone.slice(-10) &&
        (o.orderNumber?.toUpperCase() === cleanOrderNum || o.id?.toUpperCase() === cleanOrderNum)
      );
    });

    if (!matchedOrder) {
      return res.status(403).json({
        error: 'Verification denied. Phone number and order number do not match.',
      });
    }

    const rawOtp = crypto.randomBytes(16).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const challengeId = `ch-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const effectiveTtl =
      typeof ttlMs === 'number' && process.env.NODE_ENV !== 'production'
        ? ttlMs
        : 5 * 60 * 1000;

    customerVerificationChallenges.set(challengeId, {
      id: challengeId,
      phoneDigits: cleanPhone.slice(-10),
      orderNumber: cleanOrderNum,
      tokenHash,
      expiresAt: Date.now() + effectiveTtl,
      used: false,
    });

    return res.json({
      success: true,
      challengeId,
      verificationToken: rawOtp,
      expiresInMs: effectiveTtl,
    });
  });

  router.post('/api/customer/auth/verify-otp', (req, res) => {
    const { challengeId, phone, verificationToken } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const rawToken = String(verificationToken || '').trim();

    if (!challengeId || cleanPhone.length < 8 || !rawToken) {
      return res.status(400).json({ error: 'Challenge ID, phone number, and verification token are required.' });
    }

    const challenge = customerVerificationChallenges.get(String(challengeId));
    if (!challenge) return res.status(401).json({ error: 'Invalid verification challenge.' });
    if (challenge.used) return res.status(401).json({ error: 'Verification token has already been used.' });
    if (Date.now() > challenge.expiresAt) return res.status(401).json({ error: 'Verification token has expired.' });
    if (challenge.phoneDigits !== cleanPhone.slice(-10)) {
      return res.status(403).json({ error: 'Phone number mismatch for verification challenge.' });
    }

    const candidateHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    if (candidateHash !== challenge.tokenHash) {
      return res.status(401).json({ error: 'Invalid verification token.' });
    }

    challenge.used = true;

    const rawSessionToken = `cust_sess_${crypto.randomBytes(24).toString('hex')}`;
    const sessionTokenHash = crypto.createHash('sha256').update(rawSessionToken).digest('hex');
    verifiedCustomerSessions.set(sessionTokenHash, {
      sessionTokenHash,
      phoneDigits: challenge.phoneDigits,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    return res.json({
      success: true,
      customerToken: rawSessionToken,
    });
  });

  router.get('/api/customer/profile', (req, res) => {
    const db = getDb();
    const authHeader = req.headers.authorization || '';
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!rawToken) {
      return res.status(401).json({
        error: 'Authentication required. Customer profile and order history cannot be retrieved by phone number alone.',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const session = verifiedCustomerSessions.get(tokenHash);
    if (!session || Date.now() > session.expiresAt) {
      return res.status(401).json({ error: 'Invalid or expired customer verification session.' });
    }

    const requestedPhone = String(req.query.phone || '').replace(/\D/g, '');
    if (requestedPhone && requestedPhone.slice(-10) !== session.phoneDigits) {
      return res.status(403).json({
        error: 'Forbidden: You cannot access another customer’s profile or order history.',
      });
    }

    const customerOrders = Object.values(db.orders)
      .filter((o: any) => {
        const oPhone = (o.deliveryDetails?.customerPhone || '').replace(/\D/g, '');
        return oPhone.length >= 8 && oPhone.slice(-10) === session.phoneDigits;
      })
      .map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        branchId: o.branchId,
        orderType: o.orderType,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: o.total,
        createdAt: o.createdAt,
        items: o.items,
      }));

    return res.json({
      success: true,
      phoneDigits: session.phoneDigits,
      orders: customerOrders,
    });
  });

  router.get('/api/orders', requireAuth, requireBranchAccess, (req, res) => {
    const db = getDb();
    const { branchId, phone, status, search } = req.query;
    let list = Object.values(db.orders);

    if (branchId && branchId !== 'all') list = list.filter((o: any) => o.branchId === branchId);
    if (phone) list = list.filter((o: any) => o.deliveryDetails?.customerPhone === phone);
    if (status) list = list.filter((o: any) => o.status === status);
    if (search) {
      const q = String(search).toLowerCase().trim();
      list = list.filter((o: any) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.id?.toLowerCase().includes(q) ||
        o.deliveryDetails?.customerName?.toLowerCase().includes(q) ||
        o.deliveryDetails?.customerPhone?.includes(q) ||
        o.deliveryDetails?.deliveryAddress?.toLowerCase().includes(q) ||
        o.items?.some((it: any) => it.name?.toLowerCase().includes(q))
      );
    }

    res.json(list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  });

  router.put('/api/orders/:id/customer-care', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { deliveryAddress, landmark, deliveryNotes, priority, customerCareNote } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;

    let order = db.orders[id];
    if (!order) {
      order = Object.values(db.orders).find((o: any) => o.orderNumber === id || o.id === id);
    }
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (deliveryAddress) {
      order.deliveryDetails = order.deliveryDetails || {};
      order.deliveryDetails.deliveryAddress = deliveryAddress;
    }
    if (landmark) {
      order.deliveryDetails = order.deliveryDetails || {};
      order.deliveryDetails.landmark = landmark;
    }
    if (deliveryNotes !== undefined) {
      order.deliveryDetails = order.deliveryDetails || {};
      order.deliveryDetails.deliveryNotes = deliveryNotes;
    }
    if (customerCareNote) {
      order.customerCareNotes = order.customerCareNotes || [];
      order.customerCareNotes.push({
        timestamp: new Date().toISOString(),
        staffName: currentStaff.name,
        note: customerCareNote,
      });
    }
    if (priority) order.priority = priority;
    order.updatedAt = new Date().toISOString();

    if (db.deliveryTasks[order.id]) {
      if (deliveryAddress) db.deliveryTasks[order.id].deliveryAddress = deliveryAddress;
      if (landmark) db.deliveryTasks[order.id].landmark = landmark;
      if (deliveryNotes) db.deliveryTasks[order.id].notes = deliveryNotes;
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      order.branchId,
      'CUSTOMER_CARE_ACTION',
      `Updated Order ${order.orderNumber}: ${customerCareNote || 'Modified delivery details'}`
    );

    res.json({ success: true, order });
  });

  router.get('/api/orders/:id', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    let order = db.orders[id];
    if (!order) {
      order = Object.values(db.orders).find((o: any) => o.orderNumber === id || o.id === id);
    }
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const session = await getSessionFromRequest(req);
    if (session) {
      const staff = db.staff[session.staffId];
      if (staff && staff.status === 'active') {
        const staffAllowedBranches = Array.from(
          new Set([staff.branchId, ...(staff.allowedBranchIds || [])].filter(Boolean))
        );
        if (
          !['super_admin', 'corporate_admin', 'auditor', 'accountant'].includes(staff.role) &&
          !staffAllowedBranches.includes(order.branchId)
        ) {
          return res.status(403).json({
            error: `Access denied. Order belongs to branch '${order.branchId}'. Staff assigned to [${staffAllowedBranches.join(', ')}].`,
          });
        }
        return res.json(order);
      }
    }

    const { phone, pickupCode } = req.query;
    const cleanPhone = String(phone || '').trim().replace(/[^0-9]/g, '');
    const cleanPickup = String(pickupCode || '').trim();
    const oPhone = (order.deliveryDetails?.customerPhone || '').replace(/[^0-9]/g, '');

    const isPlaceholderPhone = oPhone === '08000000000' || oPhone.length < 8;
    const phoneValid =
      !isPlaceholderPhone &&
      cleanPhone.length >= 8 &&
      oPhone.slice(-10) === cleanPhone.slice(-10);
    const pickupValid = cleanPickup.length >= 4 && order.pickupAuthorizationCode === cleanPickup;

    if (phoneValid || pickupValid) {
      const rawName = String(order.deliveryDetails?.customerName || 'Customer');
      const maskedName = rawName.split(' ')[0] + (rawName.includes(' ') ? ' ***' : '');
      return res.json({
        id: order.id,
        orderNumber: order.orderNumber,
        branchId: order.branchId,
        orderType: order.orderType,
        status: order.status,
        items: order.items?.map((it: any) => ({
          name: it.name,
          quantity: it.quantity,
          price: it.price || it.unitPrice,
        })),
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        packagingFee: order.packagingFee,
        discount: order.discount,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        deliveryDetails: {
          customerName: maskedName,
          deliveryZone: order.deliveryDetails?.deliveryZone || 'Standard',
        },
      });
    }

    return res.status(401).json({
      error: 'Access denied. Valid staff authentication or phone/pickup verification required to view order details.',
    });
  });

  router.put('/api/orders/:id/status', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { status, note, paymentStatus } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;

    let order = db.orders[id];
    if (!order) {
      order = Object.values(db.orders).find((o: any) => o.orderNumber === id || o.id === id);
    }
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const now = new Date().toISOString();
    if (status) order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    order.updatedAt = now;

    const checkId = `chk-${order.id}`;
    if (db.checks[checkId]) {
      if (status === 'completed' || status === 'delivered') {
        db.checks[checkId].status = 'paid';
        db.checks[checkId].paymentStatus = 'paid';
        order.paymentStatus = 'paid';
      } else if (status === 'preparing') {
        db.checks[checkId].status = 'sent_to_kitchen';
      } else if (status === 'cancelled' || status === 'refunded' || paymentStatus === 'refunded') {
        db.checks[checkId].status = 'voided';
        db.checks[checkId].paymentStatus = 'refunded' as any;
        (db.checks[checkId] as any).voidedAt = now;
      }
    }

    if (status === 'completed' || status === 'delivered') {
      awardOrderLoyaltyPointsIfEligible(db, order, now);
    } else if (status === 'cancelled' || status === 'refunded' || paymentStatus === 'refunded') {
      order.refundedAt = order.refundedAt || now;
      reverseOrderLoyaltyPointsIfAwarded(db, order, now);
      if (typeof reverseInventoryForOrder === 'function') {
        reverseInventoryForOrder(
          order.orderNumber || order.id,
          order.branchId,
          currentStaff || { id: 'staff-sys', name: 'Order Ops Engine', role: 'store_manager' },
          `Order ${status || paymentStatus}`
        );
      }
    }

    if (db.deliveryTasks[order.id]) {
      if (status === 'delivering' || status === 'in_transit') {
        db.deliveryTasks[order.id].status = 'out_for_delivery';
      } else if (status === 'delivered') {
        db.deliveryTasks[order.id].status = 'delivered';
        db.deliveryTasks[order.id].deliveredAt = now;
      } else if (status === 'cancelled') {
        (db.deliveryTasks[order.id] as any).status = 'cancelled';
      }
    }

    saveDatabaseSync();

    try {
      const task = db.deliveryTasks[order.id];
      const customerName = order.deliveryDetails?.customerName || 'Valued Customer';
      const customerPhone = order.deliveryDetails?.customerPhone || '';

      if (customerPhone) {
        if (status === 'preparing') {
          sendCustomerNotification({
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName,
            customerPhone,
            channel: 'both',
            eventType: 'KITCHEN_PREPARING',
            branchId: order.branchId,
          });
        } else if (status === 'ready') {
          sendCustomerNotification({
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName,
            customerPhone,
            channel: 'sms',
            eventType: 'ORDER_READY',
            branchId: order.branchId,
          });
        } else if (status === 'delivering' || status === 'in_transit' || status === 'out_for_delivery') {
          sendCustomerNotification({
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName,
            customerPhone,
            channel: 'both',
            eventType: 'DISPATCH_EN_ROUTE',
            branchId: order.branchId,
            metadata: {
              riderName: task?.riderName || 'Choplife Express Rider',
              riderPhone: (task?.riderId && db.riders[task.riderId]?.phone) || (order.branchId && db.branches[order.branchId]?.phone) || '+234 811 222 3333',
              handoverPin: task?.pickupAuthorizationCode || order.pickupAuthorizationCode || order.deliveryPin || '',
            },
          });
        } else if (status === 'delivered' || status === 'completed') {
          sendCustomerNotification({
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName,
            customerPhone,
            channel: 'both',
            eventType: 'DELIVERY_COMPLETED',
            branchId: order.branchId,
          });
        }
      }
    } catch (notifErr) {
      console.error('[NOTIF ENGINE] Status transition notification error:', notifErr);
    }

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'ORDER_STATUS',
      `Updated order #${order.orderNumber} status to ${status}. ${note || ''}`
    );

    res.json({ success: true, order });
  });

  router.use(createPosManagerOverrideRouter({ requireAuth, logAuditEvent }));

  return router;
}
