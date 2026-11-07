import type { DbDatabase } from '../../server_db.ts';
import {
  dispatchTermiiSms,
  dispatchWhatsAppCloud,
  formatE164Phone,
} from '../../server_notifications.ts';

export { formatE164Phone };

export interface CustomerNotificationPayload {
  orderId?: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  channel?: 'sms' | 'whatsapp' | 'both';
  eventType:
    | 'ORDER_CONFIRMATION'
    | 'KITCHEN_PREPARING'
    | 'ORDER_READY'
    | 'DISPATCH_EN_ROUTE'
    | 'DELIVERY_COMPLETED'
    | 'MANUAL_ALERT'
    | 'PAYMENT_RECEIVED';
  customMessage?: string;
  metadata?: Record<string, any>;
  branchId?: string;
}

export function createCustomerNotificationDispatcher(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
}) {
  const { getDb, saveDatabaseSync } = deps;

  function sendCustomerNotification(payload: CustomerNotificationPayload) {
    const db = getDb();
    db.notifications = db.notifications || {};
    const config = db.gatewayConfig;

    if (config?.autoAlerts) {
      if (payload.eventType === 'ORDER_CONFIRMATION' && config.autoAlerts.orderConfirmation === false) return [];
      if (payload.eventType === 'KITCHEN_PREPARING' && config.autoAlerts.kitchenPreparing === false) return [];
      if (payload.eventType === 'ORDER_READY' && config.autoAlerts.orderReady === false) return [];
      if (payload.eventType === 'DISPATCH_EN_ROUTE' && config.autoAlerts.dispatchEnRoute === false) return [];
      if (payload.eventType === 'DELIVERY_COMPLETED' && config.autoAlerts.deliveryCompleted === false) return [];
    }

    const defaultCh = config?.defaultChannel || 'both';
    const requestedChannel = payload.channel || defaultCh;
    const channels: ('sms' | 'whatsapp')[] =
      requestedChannel === 'both'
        ? ['sms', 'whatsapp']
        : [requestedChannel];
    const createdNotifs: any[] = [];
    const now = new Date().toISOString();
    const phoneFormatted = formatE164Phone(payload.customerPhone);
    const branchName =
      payload.branchId === 'okabere'
        ? 'Okabere Hub'
        : payload.branchId === 'ugbowo'
        ? 'Ugbowo Campus'
        : 'GRA Flagship';

    for (const ch of channels) {
      let message = payload.customMessage || '';
      if (!message) {
        if (payload.eventType === 'ORDER_CONFIRMATION') {
          message =
            ch === 'whatsapp'
              ? `🍔 *Choplife Republic*\n\nHello *${payload.customerName}*, we've received your order *#${payload.orderNumber}*!\n\n📍 *Branch:* ${branchName}\n💳 *Status:* Confirmed & Fired to Kitchen\n⏱️ *Est. Time:* ~40 mins\n\nTrack your order in real-time:\n🔗 https://choplife.ng/track/${payload.orderNumber}`
              : `Choplife: Hi ${payload.customerName}, order #${payload.orderNumber} received at ${branchName}! Fired to kitchen. Track: choplife.ng/track/${payload.orderNumber}`;
        } else if (payload.eventType === 'KITCHEN_PREPARING') {
          message =
            ch === 'whatsapp'
              ? `🔥 *Choplife Kitchen Update*\n\nYour order *#${payload.orderNumber}* is now on the grill & packaging line at ${branchName}! Fresh, piping hot & seasoned to perfection.`
              : `Choplife Kitchen: Order #${payload.orderNumber} is now being freshly grilled & boxed at ${branchName}! 🔥`;
        } else if (payload.eventType === 'ORDER_READY') {
          message =
            ch === 'whatsapp'
              ? `🍱 *Choplife Order Ready!*\n\nHi *${payload.customerName}*, your order *#${payload.orderNumber}* is packaged and ready for pickup/dispatch at ${branchName}.`
              : `Choplife: Order #${payload.orderNumber} is packaged & ready at ${branchName}! 🍱`;
        } else if (payload.eventType === 'DISPATCH_EN_ROUTE') {
          const riderName = payload.metadata?.riderName || 'Choplife Express Rider';
          const riderPhone = payload.metadata?.riderPhone || (payload.branchId && db.branches[payload.branchId]?.phone) || '+234 811 222 3333';
          const pin = payload.metadata?.handoverPin || '';
          message =
            ch === 'whatsapp'
              ? `🛵 *Choplife Dispatch - Out For Delivery!*\n\nHi *${payload.customerName}*, rider *${riderName}* (${riderPhone}) is on the way with order *#${payload.orderNumber}*!${pin ? `\n\n🔐 *YOUR HANDOVER PIN: ${pin}*\n_Please present this 4-digit PIN to the rider to verify handover._` : ''}`
              : `Choplife Dispatch: Order #${payload.orderNumber} is out with rider ${riderName}!${pin ? ` 🔐 Handover PIN: ${pin}. Give this PIN to the rider on arrival.` : ''}`;
        } else if (payload.eventType === 'DELIVERY_COMPLETED') {
          message =
            ch === 'whatsapp'
              ? `🎉 *Order Delivered! Enjoy Choplife!*\n\nOrder *#${payload.orderNumber}* has been successfully handed over and verified. Thank you for choosing Choplife Republic Benin City! Have a blessed day.`
              : `Choplife: Order #${payload.orderNumber} delivered & verified! Thank you for choosing Choplife Benin City. Enjoy your meal! 🎉`;
        } else if (payload.eventType === 'PAYMENT_RECEIVED') {
          const amt = payload.metadata?.amount
            ? `₦${Number(payload.metadata.amount).toLocaleString()}`
            : 'payment';
          message = `Choplife Pay: Received ${amt} for order #${payload.orderNumber}. Ref: ${payload.metadata?.reference || 'PAY-VERIFIED'}. Kitchen ticket confirmed!`;
        } else {
          message = `Choplife Republic: Update regarding order #${payload.orderNumber || ''}`;
        }
      }

      const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const notif = {
        id: notifId,
        orderId: payload.orderId || '',
        orderNumber: payload.orderNumber || '',
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        channel: ch,
        provider: ch === 'sms' ? 'termii' : 'whatsapp_cloud_api',
        eventType: payload.eventType,
        recipient: phoneFormatted,
        message,
        status: 'sent',
        timestamp: now,
        costNaira: ch === 'sms' ? 4.5 : 8.2,
        metadata: {
          ...(payload.metadata || {}),
          gatewayMode: config?.liveGatewayMode ? 'live_http' : 'high_fidelity_sandbox',
        },
        branchId: payload.branchId || 'gra',
      };

      db.notifications[notifId] = notif;
      createdNotifs.push(notif);

      (async () => {
        try {
          const result = ch === 'sms'
            ? await dispatchTermiiSms(phoneFormatted, message, db.gatewayConfig)
            : await dispatchWhatsAppCloud(phoneFormatted, message, db.gatewayConfig);

          if (db.notifications[notifId]) {
            db.notifications[notifId].status = result.status;
            db.notifications[notifId].costNaira = result.costNaira;
            db.notifications[notifId].metadata = {
              ...db.notifications[notifId].metadata,
              gatewayMessageId: result.messageId,
              gatewayLatencyMs: result.latencyMs,
              gatewayMode: result.mode,
              gatewayRaw: result.rawResponse,
            };
            saveDatabaseSync();
          }
        } catch (err: any) {
          console.error(`[Gateway Async Dispatch] Error for ${notifId}:`, err.message);
        }
      })();
    }

    saveDatabaseSync();
    return createdNotifs;
  }

  return sendCustomerNotification;
}
