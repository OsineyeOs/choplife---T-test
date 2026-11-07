import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import {
  awardOrderLoyaltyPointsIfEligible,
  reverseOrderLoyaltyPointsIfAwarded,
} from './server_db.ts';
import { createTransferAndRefundRouter } from './server/payments/transferAndRefundRouter.ts';
import { createPaystackWebhookHandler } from './server/payments/paystackWebhookHandler.ts';

export interface PaymentRouterDeps {
  getDb: () => any;
  saveDatabaseSync: () => void;
  getSessionFromRequest: (req: Request) => any;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
  sendCustomerNotification: (payload: any) => void;
  staffRepository?: any;
  hasPermission: (staff: any, permissionCode: string) => Promise<boolean>;
}

export function getPaystackEnvironmentConfig() {
  const rawSecret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  const rawWebhookSecret = (process.env.PAYSTACK_WEBHOOK_SECRET || '').trim();
  const publicKey = (process.env.VITE_PAYSTACK_PUBLIC_KEY || '').trim();
  const isProdRuntime = process.env.NODE_ENV === 'production';
  const hasLiveSecretKey = rawSecret.startsWith('sk_live_');
  const hasTestSecretKey = rawSecret.startsWith('sk_test_');

  const mode: 'live' | 'sandbox' = hasLiveSecretKey ? 'live' : 'sandbox';
  const effectiveWebhookSecret =
    rawSecret ||
    rawWebhookSecret ||
    (!isProdRuntime ? 'choplife_sandbox_paystack_secret_2026' : '');

  return {
    provider: 'paystack' as const,
    mode,
    isProdRuntime,
    hasLiveSecretKey,
    hasTestSecretKey,
    hasConfiguredSecret: Boolean(rawSecret),
    publicKey,
    effectiveWebhookSecret,
    secretKey: rawSecret,
  };
}

export function verifyPaystackSignature(
  rawBodyOrObject: string | object,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  const payload =
    typeof rawBodyOrObject === 'string' ? rawBodyOrObject : JSON.stringify(rawBodyOrObject);
  const expectedHash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
  try {
    const sigBuf = Buffer.from(signatureHeader.trim(), 'utf8');
    const hashBuf = Buffer.from(expectedHash, 'utf8');
    if (sigBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, hashBuf);
  } catch {
    return false;
  }
}

export function createPaymentRouter(deps: PaymentRouterDeps): Router {
  const router = Router();
  const { getDb, saveDatabaseSync, getSessionFromRequest, logAuditEvent, sendCustomerNotification, staffRepository } = deps;

  // 1. Safe Payment Configuration Status Endpoint
  router.get('/api/payments/config', (_req: Request, res: Response) => {
    const cfg = getPaystackEnvironmentConfig();
    const db = getDb();
    const cmsBank = db.cmsContent?.bankTransferConfig;
    const envBankName = (process.env.BANK_TRANSFER_BANK_NAME || '').trim();
    const envAccountName = (process.env.BANK_TRANSFER_ACCOUNT_NAME || '').trim();
    const envAccountNumber = (process.env.BANK_TRANSFER_ACCOUNT_NUMBER || '').trim();

    const bankName = cmsBank?.bankName || envBankName;
    const accountName = cmsBank?.accountName || envAccountName;
    const accountNumber = cmsBank?.accountNumber || envAccountNumber;
    const bankTransferConfigured = Boolean(
      (cmsBank ? cmsBank.enabled : true) && bankName && accountName && accountNumber
    );

    const hasMoniepointKeys = Boolean(
      (process.env.MONIEPOINT_API_KEY || '').trim() && (process.env.MONIEPOINT_SECRET_KEY || '').trim()
    );

    res.json({
      provider: cfg.provider,
      mode: cfg.mode,
      hasLiveSecretKey: cfg.hasLiveSecretKey,
      hasTestSecretKey: cfg.hasTestSecretKey,
      webhookSignatureEnforced: true,
      publicKey: cfg.publicKey ? `${cfg.publicKey.slice(0, 8)}...` : '',
      currency: 'NGN',
      supportedStates: [
        'created',
        'pending',
        'requires_action',
        'reconciliation_required',
        'paid',
        'failed',
        'cancelled',
        'expired',
        'refunded',
      ],
      bankTransfer: {
        configured: bankTransferConfigured,
        bankName: bankTransferConfigured ? bankName : null,
        accountName: bankTransferConfigured ? accountName : null,
        accountNumber: bankTransferConfigured ? accountNumber : null,
        instructions: bankTransferConfigured
          ? cmsBank?.instructions || 'Quote your Order Number as narration and submit your session/transfer reference for cashier confirmation.'
          : 'Direct bank transfer details have not yet been configured by the administrator. Please use Paystack (Card / Transfer / USSD) or Pay on Delivery.',
        requiresStaffReconciliation: true,
      },
      moniepoint: {
        cloudApiConfigured: hasMoniepointKeys,
        mode: hasMoniepointKeys ? 'cloud_api' : 'manual_pos_terminal_slip',
        description: hasMoniepointKeys
          ? 'Moniepoint API integration active.'
          : 'Physical Moniepoint POS terminal slips are recorded and reconciled by authenticated cashiers.',
      },
    });
  });

  // 2. Authoritative Payment Initiation Endpoint (Idempotent per orderId + idempotencyKey)
  router.post('/api/payments/initiate', (req: Request, res: Response) => {
    const db = getDb();
    const { orderId, orderNumber, paymentMethod = 'card', idempotencyKey, customerEmail } = req.body || {};

    let order = orderId ? db.orders?.[orderId] : undefined;
    if (!order && orderNumber) {
      order = Object.values(db.orders || {}).find((o: any) => o.orderNumber === orderNumber);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found for payment initiation.' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(409).json({
        error: `Order ${order.orderNumber} has already been settled (ref: ${order.paymentReference || 'N/A'}).`,
        status: 'already_paid',
      });
    }

    db.paymentTransactions = db.paymentTransactions || {};

    if (idempotencyKey) {
      const existingByKey = Object.values(db.paymentTransactions).find(
        (tx: any) => tx.orderId === order.id && tx.idempotencyKey === idempotencyKey
      ) as any;
      if (existingByKey) {
        return res.status(200).json({
          success: true,
          idempotentReplay: true,
          transaction: existingByKey,
        });
      }
    }

    const cfg = getPaystackEnvironmentConfig();
    const amountNaira = Number(order.total || 0);
    const amountKobo = Math.round(amountNaira * 100);
    if (amountKobo <= 0) {
      return res.status(400).json({ error: 'Order total must be greater than ₦0 to initiate payment.' });
    }

    const reference = `CL-PAY-${order.orderNumber.replace(/[^A-Z0-9]/gi, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const txRecord = {
      reference,
      orderId: order.id,
      orderNumber: order.orderNumber,
      branchId: order.branchId || 'gra',
      amountNaira,
      amountKobo,
      currency: 'NGN',
      paymentMethod,
      customerEmail: customerEmail || order.deliveryDetails?.customerEmail || 'customer@choplife.ng',
      mode: cfg.mode,
      status: 'pending',
      idempotencyKey: idempotencyKey || null,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    db.paymentTransactions[reference] = txRecord;
    order.paymentReference = reference;
    order.paymentStatus = 'pending';
    order.updatedAt = now;
    saveDatabaseSync();

    res.status(201).json({
      success: true,
      idempotentReplay: false,
      transaction: txRecord,
    });
  });

  // 3. Authoritative Payment Verification Endpoint
  router.post('/api/payments/verify-checkout', async (req: Request, res: Response) => {
    const db = getDb();
    const {
      orderId,
      orderNumber,
      reference,
      paymentMethod = 'card',
      sandboxSimulationStatus,
      sandboxSimulatedAmountKobo,
    } = req.body || {};

    if (!reference || typeof reference !== 'string' || !reference.trim()) {
      return res.status(400).json({ error: 'A valid payment transaction reference is required for verification.' });
    }

    const cleanRef = reference.trim();

    let order = orderId ? db.orders?.[orderId] : undefined;
    if (!order && orderNumber) {
      order = Object.values(db.orders || {}).find((o: any) => o.orderNumber === orderNumber);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found for payment settlement.' });
    }

    db.paymentTransactions = db.paymentTransactions || {};

    const otherOrderWithRef = Object.values(db.orders || {}).find(
      (o: any) => o.id !== order.id && o.paymentReference === cleanRef && o.paymentStatus === 'paid'
    ) as any;
    if (otherOrderWithRef) {
      return res.status(409).json({
        error: `Payment reference '${cleanRef}' has already been used to settle another order (${otherOrderWithRef.orderNumber}).`,
      });
    }

    if (order.paymentStatus === 'paid' && order.paymentReference === cleanRef) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Payment already verified for this order (idempotent response).',
        order,
      });
    }

    const expectedKobo = Math.round(Number(order.total || 0) * 100);
    const cfg = getPaystackEnvironmentConfig();
    const existingTx = db.paymentTransactions[cleanRef];

    if (existingTx && existingTx.expiresAt && new Date(existingTx.expiresAt).getTime() < Date.now() && existingTx.status === 'pending') {
      existingTx.status = 'expired';
      existingTx.updatedAt = new Date().toISOString();
      order.paymentStatus = 'expired';
      saveDatabaseSync();
      return res.status(400).json({
        error: 'Payment reference has expired. Please initiate a new payment attempt.',
        paymentStatus: 'expired',
      });
    }

    let verifiedStatus: 'success' | 'failed' | 'expired' | 'reversed' = 'failed';
    let verifiedAmountKobo = expectedKobo;
    let verifiedCurrency = 'NGN';
    let verificationSource: 'paystack_api' | 'sandbox_fixture' | 'staff_pos_terminal' = 'sandbox_fixture';

    if (cfg.hasLiveSecretKey || (cfg.hasTestSecretKey && !cleanRef.startsWith('SANDBOX_'))) {
      if (cleanRef.startsWith('TEST_') || cleanRef.startsWith('SANDBOX_')) {
        return res.status(403).json({
          error: 'Simulated/test references are strictly forbidden when a live Paystack secret key is active.',
        });
      }
      try {
        const pRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(cleanRef)}`, {
          headers: { Authorization: `Bearer ${cfg.secretKey}` },
        });
        const pData = await pRes.json();
        if (!pRes.ok || !pData.status || !pData.data) {
          return res.status(400).json({ error: 'Payment gateway could not verify transaction reference.' });
        }
        const gatewayStatus = String(pData.data.status || '').toLowerCase();
        verifiedAmountKobo = Number(pData.data.amount || 0);
        verifiedCurrency = String(pData.data.currency || 'NGN').toUpperCase();
        verificationSource = 'paystack_api';

        if (gatewayStatus === 'success') verifiedStatus = 'success';
        else if (gatewayStatus === 'abandoned' || gatewayStatus === 'expired') verifiedStatus = 'expired';
        else if (gatewayStatus === 'reversed') verifiedStatus = 'reversed';
        else verifiedStatus = 'failed';
      } catch (_verErr: any) {
        return res.status(502).json({ error: 'Payment gateway verification unreachable.' });
      }
    } else {
      if (cfg.isProdRuntime && !cfg.hasConfiguredSecret) {
        return res.status(503).json({
          error: 'Live payment verification is unavailable because PAYSTACK_SECRET_KEY is not configured in production.',
        });
      }

      const staffSession = getSessionFromRequest(req);
      if (cleanRef.startsWith('SANDBOX_')) {
        verificationSource = 'sandbox_fixture';
        if (cleanRef.startsWith('SANDBOX_FAILED_') || sandboxSimulationStatus === 'failed') {
          verifiedStatus = 'failed';
        } else if (cleanRef.startsWith('SANDBOX_EXPIRED_') || sandboxSimulationStatus === 'expired') {
          verifiedStatus = 'expired';
        } else if (cleanRef.startsWith('SANDBOX_REVERSED_') || sandboxSimulationStatus === 'reversed') {
          verifiedStatus = 'reversed';
        } else if (cleanRef.startsWith('SANDBOX_UNDERPAID_')) {
          verifiedStatus = 'success';
          verifiedAmountKobo = Math.max(100, expectedKobo - 50000);
        } else {
          verifiedStatus = 'success';
          verifiedAmountKobo =
            typeof sandboxSimulatedAmountKobo === 'number' ? sandboxSimulatedAmountKobo : expectedKobo;
        }
      } else if (staffSession) {
        verificationSource = 'staff_pos_terminal';
        verifiedStatus = 'success';
        verifiedAmountKobo = expectedKobo;
      } else {
        return res.status(403).json({
          error:
            'Unverified client payment reference rejected. Web checkout payments must be verified via Paystack webhook or a registered payment transaction reference.',
        });
      }
    }

    const now = new Date().toISOString();

    if (verifiedStatus === 'failed' || verifiedStatus === 'expired') {
      order.paymentStatus = verifiedStatus;
      order.updatedAt = now;
      if (existingTx) {
        existingTx.status = verifiedStatus;
        existingTx.updatedAt = now;
      }
      saveDatabaseSync();
      return res.status(400).json({
        error: `Payment transaction ${verifiedStatus}. Order remains unpaid.`,
        paymentStatus: verifiedStatus,
        order,
      });
    }

    if (verifiedStatus === 'reversed') {
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
      if (existingTx) {
        existingTx.status = 'reversed';
        existingTx.updatedAt = now;
      }
      reverseOrderLoyaltyPointsIfAwarded(db, order, now);
      saveDatabaseSync();
      return res.status(200).json({
        success: true,
        paymentStatus: 'refunded',
        message: 'Payment reversal recorded and check voided.',
        order,
      });
    }

    if (verifiedCurrency !== 'NGN' || verifiedAmountKobo < expectedKobo) {
      order.paymentStatus = 'failed';
      order.updatedAt = now;
      if (existingTx) {
        existingTx.status = 'failed_amount_mismatch';
        existingTx.updatedAt = now;
      }
      saveDatabaseSync();
      return res.status(400).json({
        error: `Payment amount mismatch: expected ${expectedKobo} kobo (₦${order.total}), received ${verifiedAmountKobo} kobo (${verifiedCurrency}).`,
        paymentStatus: 'failed',
      });
    }

    order.paymentStatus = 'paid';
    order.paymentMethod = paymentMethod;
    order.paymentReference = cleanRef;
    order.paymentVerificationSource = verificationSource;
    order.paidAt = now;
    order.updatedAt = now;

    const checkId = `chk-${order.id}`;
    if (db.checks?.[checkId]) {
      db.checks[checkId].paymentStatus = 'paid';
      db.checks[checkId].status = 'paid';
      db.checks[checkId].paidAt = now;
      db.checks[checkId].paymentMethod = paymentMethod;
    }

    db.paymentTransactions[cleanRef] = {
      ...(existingTx || {
        reference: cleanRef,
        orderId: order.id,
        orderNumber: order.orderNumber,
        branchId: order.branchId || 'gra',
        createdAt: now,
      }),
      amountNaira: order.total,
      amountKobo: verifiedAmountKobo,
      currency: verifiedCurrency,
      paymentMethod,
      status: 'paid',
      verificationSource,
      verifiedAt: now,
      updatedAt: now,
    };

    awardOrderLoyaltyPointsIfEligible(db, order, now);
    saveDatabaseSync();

    logAuditEvent(
      'Online Payment Gateway',
      'system',
      order.branchId || 'gra',
      'PAYMENT_VERIFIED',
      `Verified ${paymentMethod} payment (${verificationSource}) for Order #${order.orderNumber} (₦${Number(order.total).toLocaleString()}) ref: ${cleanRef}`
    );

    return res.json({
      success: true,
      alreadyVerified: false,
      verificationSource,
      message: 'Payment verified and check closed successfully.',
      order,
    });
  });

  const handlePaystackWebhook = createPaystackWebhookHandler({
    getDb,
    saveDatabaseSync,
    getPaystackEnvironmentConfig,
    verifyPaystackSignature,
    sendCustomerNotification,
    logAuditEvent,
  });

  router.post('/api/notifications/webhook/paystack', handlePaystackWebhook);
  router.post('/api/payments/webhook/paystack', handlePaystackWebhook);

  // Mount Bank Transfer & Refund Ledger Routes
  router.use(createTransferAndRefundRouter(deps));

  return router;
}

