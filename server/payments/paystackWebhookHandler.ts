import type { Request, Response } from 'express';
import {
  awardOrderLoyaltyPointsIfEligible,
  reverseOrderLoyaltyPointsIfAwarded,
  type DbDatabase,
} from '../../server_db.ts';

export function createPaystackWebhookHandler(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  getPaystackEnvironmentConfig: () => {
    isProdRuntime: boolean;
    hasConfiguredSecret: boolean;
    hasLiveSecretKey: boolean;
    effectiveWebhookSecret: string;
  };
  verifyPaystackSignature: (rawBodyOrObject: any, signatureHeader: string | undefined, secret: string) => boolean;
  sendCustomerNotification: (payload: any) => any;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
}) {
  const {
    getDb,
    saveDatabaseSync,
    getPaystackEnvironmentConfig,
    verifyPaystackSignature,
    sendCustomerNotification,
    logAuditEvent,
  } = deps;

  return (req: Request, res: Response) => {
    const db = getDb();
    const cfg = getPaystackEnvironmentConfig();

    if (cfg.isProdRuntime && !cfg.hasConfiguredSecret) {
      return res.status(503).json({ error: 'Paystack webhook secret is not configured in production.' });
    }

    const signature = req.headers['x-paystack-signature'] as string | undefined;
    if (!verifyPaystackSignature(req.body, signature, cfg.effectiveWebhookSecret)) {
      console.warn('[PAYSTACK WEBHOOK] Rejected untrusted webhook: missing or invalid HMAC-SHA512 signature.');
      return res.status(401).json({ error: 'Invalid or missing Paystack webhook signature.' });
    }

    const event = String(req.body?.event || '');
    const data = req.body?.data;
    if (!event || !data || !data.reference) {
      return res.status(400).json({ error: 'Malformed Paystack webhook payload: missing event or data.reference.' });
    }

    const ref = String(data.reference).trim();
    const eventKey = `${event}:${ref}`;
    db.processedWebhookEvents = db.processedWebhookEvents || {};

    if (db.processedWebhookEvents[eventKey]) {
      return res.status(200).json({
        received: true,
        status: 'already_processed',
        message: 'Webhook event already processed (idempotent replay).',
      });
    }

    const orderNumber = data.metadata?.orderNumber;
    const orderId = data.metadata?.orderId;
    const order = Object.values(db.orders || {}).find(
      (o: any) =>
        (orderId && o.id === orderId) ||
        (orderNumber && o.orderNumber === orderNumber) ||
        o.paymentReference === ref ||
        o.id === ref
    ) as any;

    if (!order) {
      return res.status(404).json({ error: `Order not found for webhook reference '${ref}'.` });
    }

    const conflictingOrder = Object.values(db.orders || {}).find(
      (o: any) => o.id !== order.id && o.paymentReference === ref && o.paymentStatus === 'paid'
    ) as any;
    if (conflictingOrder) {
      return res.status(409).json({
        error: `Webhook reference '${ref}' is already bound to another paid order (${conflictingOrder.orderNumber}).`,
      });
    }

    const now = new Date().toISOString();

    if (event === 'charge.success') {
      const expectedKobo = Math.round(Number(order.total || 0) * 100);
      const paidKobo = Number(data.amount || 0);
      const currency = String(data.currency || 'NGN').toUpperCase();

      if (currency !== 'NGN' || paidKobo < expectedKobo) {
        order.paymentStatus = 'failed';
        order.updatedAt = now;
        saveDatabaseSync();
        return res.status(400).json({
          error: `Webhook amount mismatch: expected ${expectedKobo} kobo (NGN), got ${paidKobo} kobo (${currency}).`,
        });
      }

      if (order.paymentStatus === 'paid' && order.paymentReference === ref) {
        db.processedWebhookEvents[eventKey] = { processedAt: now, orderId: order.id };
        saveDatabaseSync();
        return res.status(200).json({
          received: true,
          status: 'already_processed',
          message: 'Order already marked paid with this reference.',
        });
      }

      order.paymentStatus = 'paid';
      order.paidAt = now;
      order.paymentReference = ref;
      order.paymentVerificationSource = cfg.hasLiveSecretKey ? 'paystack_webhook_live' : 'paystack_webhook_sandbox';
      order.updatedAt = now;

      const checkId = `chk-${order.id}`;
      if (db.checks?.[checkId]) {
        db.checks[checkId].paymentStatus = 'paid';
        db.checks[checkId].status = 'paid';
        db.checks[checkId].paidAt = now;
        db.checks[checkId].paymentMethod = 'pos_terminal';
      }

      awardOrderLoyaltyPointsIfEligible(db, order, now);
      db.processedWebhookEvents[eventKey] = { processedAt: now, orderId: order.id };
      saveDatabaseSync();

      sendCustomerNotification({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.deliveryDetails?.customerName || 'Valued Customer',
        customerPhone: order.deliveryDetails?.customerPhone || '',
        channel: 'both',
        eventType: 'PAYMENT_RECEIVED',
        metadata: {
          amount: paidKobo / 100,
          reference: ref,
        },
        branchId: order.branchId,
      });

      logAuditEvent(
        'Paystack Webhook Gateway',
        'system',
        order.branchId,
        'PAYSTACK_WEBHOOK_PAYMENT_CONFIRMED',
        `Confirmed payment of ₦${(paidKobo / 100).toLocaleString()} for order #${order.orderNumber} (ref: ${ref})`
      );

      return res.status(200).json({ received: true, status: 'paid', orderNumber: order.orderNumber });
    }

    if (event === 'charge.failed') {
      order.paymentStatus = 'failed';
      order.paymentReference = ref;
      order.updatedAt = now;
      db.processedWebhookEvents[eventKey] = { processedAt: now, orderId: order.id };
      saveDatabaseSync();
      logAuditEvent(
        'Paystack Webhook Gateway',
        'system',
        order.branchId,
        'PAYSTACK_WEBHOOK_PAYMENT_FAILED',
        `Payment failed for order #${order.orderNumber} (ref: ${ref})`
      );
      return res.status(200).json({ received: true, status: 'failed', orderNumber: order.orderNumber });
    }

    if (event === 'refund.processed' || event === 'transfer.reversed' || event === 'charge.reversed') {
      order.paymentStatus = 'refunded';
      order.status = 'cancelled';
      order.refundedAt = now;
      order.updatedAt = now;
      const checkId = `chk-${order.id}`;
      if (db.checks?.[checkId]) {
        db.checks[checkId].paymentStatus = 'refunded';
        db.checks[checkId].status = 'voided';
        db.checks[checkId].voidedAt = now;
      }
      reverseOrderLoyaltyPointsIfAwarded(db, order, now);
      db.processedWebhookEvents[eventKey] = { processedAt: now, orderId: order.id };
      saveDatabaseSync();
      logAuditEvent(
        'Paystack Webhook Gateway',
        'system',
        order.branchId,
        'PAYSTACK_WEBHOOK_PAYMENT_REVERSED',
        `Payment reversed/refunded for order #${order.orderNumber} (ref: ${ref})`
      );
      return res.status(200).json({ received: true, status: 'refunded', orderNumber: order.orderNumber });
    }

    res.status(200).json({ received: true, status: 'ignored_event' });
  };
}
