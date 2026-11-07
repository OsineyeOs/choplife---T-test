import { Router } from 'express';
import type { DbDatabase, DbStaffAccount } from '../../server_db.ts';
import {
  testGatewayPing,
  processInboundWhatsApp,
  processTermiiDlr,
  formatE164Phone,
} from '../../server_notifications.ts';
import type { CustomerNotificationPayload } from '../services/customerNotificationService.ts';

export function createNotificationGatewaysRouter(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: any;
  requireRole: any;
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
    sendCustomerNotification,
    logAuditEvent,
  } = deps;

  router.get(
    '/api/notifications',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'store_manager', 'branch_manager', 'auditor']),
    (req, res) => {
      const db = getDb();
      const { orderId, orderNumber, branchId, channel, eventType } = req.query;
      let list = Object.values(db.notifications || {});

      if (orderId) list = list.filter((n: any) => n.orderId === orderId);
      if (orderNumber) list = list.filter((n: any) => n.orderNumber === orderNumber);
      if (branchId && branchId !== 'all') list = list.filter((n: any) => n.branchId === branchId);
      if (channel && channel !== 'all') list = list.filter((n: any) => n.channel === channel);
      if (eventType && eventType !== 'all') list = list.filter((n: any) => n.eventType === eventType);

      res.json(list.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }
  );

  router.get(
    '/api/notifications/stats',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'store_manager', 'branch_manager', 'auditor']),
    (_req, res) => {
      const db = getDb();
      const list = Object.values(db.notifications || {});
      const totalSent = list.length;
      const smsCount = list.filter((n: any) => n.channel === 'sms').length;
      const whatsappCount = list.filter((n: any) => n.channel === 'whatsapp').length;
      const totalCostNaira = list.reduce((acc: number, n: any) => acc + (n.costNaira || 0), 0);
      const deliveredCount = list.filter((n: any) => n.status === 'delivered').length;
      const deliveryRate = totalSent > 0 ? `${((deliveredCount / totalSent) * 100).toFixed(1)}%` : '0.0%';

      const hasTermii = Boolean(process.env.TERMII_API_KEY || db.gatewayConfig?.termiiApiKey);
      const hasWhatsApp = Boolean(process.env.WHATSAPP_TOKEN || db.gatewayConfig?.whatsappToken);

      res.json({
        totalSent,
        smsCount,
        whatsappCount,
        totalCostNaira,
        deliveryRate,
        gateways: {
          termii: {
            status: hasTermii ? 'connected' : 'sandbox',
            balanceUnits: hasTermii ? 10000 : 0,
            currency: 'NGN',
            liveMode: Boolean(hasTermii && db.gatewayConfig?.liveGatewayMode),
          },
          whatsappCloudApi: {
            status: hasWhatsApp ? 'connected' : 'sandbox',
            tier: hasWhatsApp ? 'Verified Business WABA' : 'Development Sandbox',
            liveMode: Boolean(hasWhatsApp && db.gatewayConfig?.liveGatewayMode),
          },
        },
      });
    }
  );

  router.post('/api/notifications/send', requireAuth, (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    const {
      orderId,
      orderNumber,
      customerName,
      customerPhone,
      channel = 'sms',
      message,
      eventType = 'MANUAL_ALERT',
      branchId = currentStaff.branchId,
    } = req.body;

    if (!customerPhone || !message) {
      return res.status(400).json({ error: 'customerPhone and message are required.' });
    }

    const created = sendCustomerNotification({
      orderId,
      orderNumber,
      customerName: customerName || 'Customer',
      customerPhone,
      channel,
      eventType,
      customMessage: message,
      branchId,
    });

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      branchId,
      'NOTIFICATION_DISPATCHED',
      `Sent manual ${channel.toUpperCase()} to ${customerPhone} for order #${orderNumber || 'N/A'}`
    );

    res.status(201).json({ success: true, notifications: created });
  });

  router.post('/api/notifications/resend/:id', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const original = db.notifications?.[id];
    if (!original) {
      return res.status(404).json({ error: 'Notification record not found.' });
    }

    const resendNotif = {
      ...original,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      status: 'delivered',
    };

    db.notifications[resendNotif.id] = resendNotif;
    saveDatabaseSync();

    res.json({ success: true, notification: resendNotif });
  });

  router.get('/api/notifications/gateways', requireAuth, requireRole(['super_admin', 'corporate_admin']), (_req, res) => {
    const db = getDb();
    const config = db.gatewayConfig || {
      termiiSenderId: 'CHOPLIFE',
      termiiChannel: 'generic',
      webhookSecret: 'choplife_wh_sec_2026_benin',
      defaultChannel: 'both',
      autoAlerts: {
        orderConfirmation: true,
        kitchenPreparing: true,
        orderReady: true,
        dispatchEnRoute: true,
        deliveryCompleted: true,
        posReceipt: true,
      },
      liveGatewayMode: false,
    };

    const termiiKey = config.termiiApiKey || process.env.TERMII_API_KEY || '';
    const waToken = config.whatsappToken || process.env.WHATSAPP_TOKEN || '';
    const waPhoneId = config.whatsappPhoneId || process.env.WHATSAPP_PHONE_ID || '';
    const waWabaId = config.whatsappWabaId || process.env.WHATSAPP_WABA_ID || '';

    const maskedTermii = termiiKey ? `${termiiKey.slice(0, 4)}••••••••${termiiKey.slice(-4)}` : '';
    const maskedWaToken = waToken ? `${waToken.slice(0, 6)}••••••••${waToken.slice(-4)}` : '';

    const {
      termiiApiKey: _rawTermii,
      whatsappToken: _rawWa,
      webhookSecret: _rawWhSec,
      ...safeGatewayConfig
    } = config as any;

    res.json({
      config: {
        ...safeGatewayConfig,
        termiiApiKeyMasked: maskedTermii,
        hasTermiiApiKey: Boolean(termiiKey),
        whatsappTokenMasked: maskedWaToken,
        hasWhatsappToken: Boolean(waToken),
        hasWhatsappPhoneId: Boolean(waPhoneId),
        whatsappPhoneId: waPhoneId,
        whatsappWabaId: waWabaId,
      },
      webhooks: {
        whatsappUrl: '/api/notifications/webhook/whatsapp',
        termiiUrl: '/api/notifications/webhook/termii',
        hasVerifyToken: Boolean(config.webhookSecret || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
      },
    });
  });

  router.post('/api/notifications/gateways', requireAuth, (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    if (!['director', 'general_manager', 'super_admin'].includes(currentStaff.role)) {
      return res.status(403).json({ error: 'Only executive directors or managers can modify gateway settings.' });
    }

    const {
      termiiApiKey,
      termiiSenderId,
      termiiChannel,
      whatsappToken,
      whatsappPhoneId,
      whatsappWabaId,
      webhookSecret,
      defaultChannel,
      autoAlerts,
      liveGatewayMode,
    } = req.body;

    db.gatewayConfig = {
      termiiApiKey: termiiApiKey !== undefined && termiiApiKey !== '' ? termiiApiKey : db.gatewayConfig?.termiiApiKey,
      termiiSenderId: termiiSenderId || db.gatewayConfig?.termiiSenderId || 'CHOPLIFE',
      termiiChannel: termiiChannel || db.gatewayConfig?.termiiChannel || 'generic',
      whatsappToken: whatsappToken !== undefined && whatsappToken !== '' ? whatsappToken : db.gatewayConfig?.whatsappToken,
      whatsappPhoneId: whatsappPhoneId !== undefined ? whatsappPhoneId : db.gatewayConfig?.whatsappPhoneId,
      whatsappWabaId: whatsappWabaId !== undefined ? whatsappWabaId : db.gatewayConfig?.whatsappWabaId,
      webhookSecret: webhookSecret || db.gatewayConfig?.webhookSecret || 'choplife_wh_sec_2026_benin',
      defaultChannel: defaultChannel || db.gatewayConfig?.defaultChannel || 'both',
      autoAlerts: autoAlerts || db.gatewayConfig?.autoAlerts || {
        orderConfirmation: true,
        kitchenPreparing: true,
        orderReady: true,
        dispatchEnRoute: true,
        deliveryCompleted: true,
        posReceipt: true,
      },
      liveGatewayMode: Boolean(liveGatewayMode),
    };

    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'GATEWAY_CONFIG_UPDATED',
      `Updated SMS/WhatsApp Gateway config (Live Mode: ${db.gatewayConfig.liveGatewayMode})`
    );

    const {
      termiiApiKey: _tk,
      whatsappToken: _wt,
      webhookSecret: _ws,
      ...safeSavedConfig
    } = db.gatewayConfig as any;

    res.json({
      success: true,
      config: {
        ...safeSavedConfig,
        hasTermiiApiKey: Boolean(db.gatewayConfig.termiiApiKey),
        hasWhatsappToken: Boolean(db.gatewayConfig.whatsappToken),
      },
    });
  });

  router.post('/api/notifications/gateways/test', requireAuth, async (req, res) => {
    const db = getDb();
    const { gateway = 'termii' } = req.body;
    try {
      const result = await testGatewayPing(gateway, db.gatewayConfig);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/api/notifications/webhook/whatsapp', (req, res) => {
    const db = getDb();
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedSecret =
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
      db.gatewayConfig?.webhookSecret;

    if (!expectedSecret) {
      return res.status(500).json({ error: 'WhatsApp webhook verify token is unconfigured on server.' });
    }

    if (mode === 'subscribe' && token === expectedSecret) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Webhook verification token mismatch.' });
  });

  router.post('/api/notifications/webhook/whatsapp', async (req, res) => {
    const db = getDb();
    try {
      const result = await processInboundWhatsApp(req.body, db);
      saveDatabaseSync();
      res.status(200).json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/api/notifications/webhook/termii', (req, res) => {
    const db = getDb();
    try {
      const outcome = processTermiiDlr(req.body, db);
      if (outcome.updated) {
        saveDatabaseSync();
      }
      res.status(200).json({ success: true, updated: outcome.count });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post(
    '/api/notifications/purge-test-records',
    requireAuth,
    requireRole(['super_admin', 'admin']),
    (req, res) => {
      const db = getDb();
      const currentStaff = (req as any).staff as DbStaffAccount;
      
      const notifCount = Object.keys(db.notifications || {}).length;
      const alertCount = Object.keys(db.stockAlerts || {}).length;

      db.notifications = {};
      db.stockAlerts = {};
      saveDatabaseSync();

      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'TEST_NOTIFICATIONS_PURGED',
        `Purged ${notifCount} test notifications and ${alertCount} test stock alerts for zero-state compliance.`
      );

      res.json({
        success: true,
        message: `Successfully purged ${notifCount} notifications and ${alertCount} stock alerts.`,
        purgedNotifications: notifCount,
        purgedStockAlerts: alertCount,
      });
    }
  );

  router.post('/api/notifications/send-receipt', requireAuth, (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const { orderNumber, customerPhone, customerName, channel = 'both' } = req.body;

    if (!orderNumber || !customerPhone) {
      return res.status(400).json({ error: 'orderNumber and customerPhone are required.' });
    }

    const order = Object.values(db.orders || {}).find(
      (o: any) => o.orderNumber === orderNumber || o.id === orderNumber
    );

    const cleanPhone = formatE164Phone(customerPhone);
    const name = customerName || order?.deliveryDetails?.customerName || 'Valued Customer';
    const branchName =
      order?.branchId === 'okabere'
        ? 'Okabere Hub'
        : order?.branchId === 'ugbowo'
        ? 'Ugbowo Campus'
        : 'GRA Flagship';

    const itemsList = order?.items || [];
    const itemsText = itemsList
      .map((i: any) => `• ${i.quantity}x ${i.product?.name || i.name || 'Menu Item'}`)
      .join('\n');
    const totalStr = order?.total ? `₦${Number(order.total).toLocaleString()}` : '';

    const receiptMsg =
      channel === 'whatsapp'
        ? `🧾 *CHOPLIFE REPUBLIC OFFICIAL E-RECEIPT*\n\nThank you, *${name}*!\n\n📍 *Branch:* ${branchName}\n🎫 *Order:* #${orderNumber}\n💵 *Total Paid:* ${totalStr}\n\n*Ordered Items:*\n${itemsText || '• Delicious Fresh Feast'}\n\nView live status and full itemized tax invoice:\n🔗 https://choplife.ng/track/${orderNumber}\n\n_Maximum Enjoyment Guaranteed!_`
        : `ChopLife: Receipt #${orderNumber} for ${name} at ${branchName}. Total: ${totalStr}. Track: choplife.ng/track/${orderNumber}. Thank you!`;

    const created = sendCustomerNotification({
      orderId: order?.id || '',
      orderNumber,
      customerName: name,
      customerPhone: cleanPhone,
      channel,
      eventType: 'ORDER_CONFIRMATION',
      customMessage: receiptMsg,
      branchId: order?.branchId || currentStaff.branchId,
    });

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'RECEIPT_DISPATCHED',
      `Dispatched ${channel.toUpperCase()} e-Receipt for #${orderNumber} to ${cleanPhone}`
    );

    res.json({ success: true, notifications: created });
  });

  return router;
}
