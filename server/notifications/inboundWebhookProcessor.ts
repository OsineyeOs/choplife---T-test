import type { DbDatabase } from '../../server_db.ts';
import { formatE164Phone, dispatchWhatsAppCloud } from './gatewaySenders.ts';

/**
 * Intelligent Inbound WhatsApp Webhook Processor & Conversational Bot
 */
export async function processInboundWhatsApp(
  rawPayload: any,
  db: DbDatabase
): Promise<{
  handled: boolean;
  incomingText: string;
  senderPhone: string;
  replyText: string;
  orderMatched?: any;
  createdNotifications: any[];
}> {
  let senderPhone = '';
  let customerName = 'Valued Customer';
  let incomingText = '';

  if (rawPayload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
    const msg = rawPayload.entry[0].changes[0].value.messages[0];
    senderPhone = msg.from || '';
    incomingText = msg.text?.body || '';
    customerName = rawPayload.entry[0].changes[0].value.contacts?.[0]?.profile?.name || 'Customer';
  } else if (rawPayload.from || rawPayload.senderPhone) {
    senderPhone = rawPayload.from || rawPayload.senderPhone;
    incomingText = rawPayload.text || rawPayload.message || '';
    customerName = rawPayload.name || rawPayload.customerName || 'Customer';
  }

  if (!incomingText) {
    return {
      handled: false,
      incomingText: '',
      senderPhone,
      replyText: '',
      createdNotifications: [],
    };
  }

  const cleanPhone = formatE164Phone(senderPhone);
  const normalizedText = incomingText.trim().toUpperCase();
  const now = new Date().toISOString();
  db.notifications = db.notifications || {};

  const allOrders = Object.values(db.orders || {});
  let matchedOrder: any = null;

  const orderNumMatch = incomingText.match(/(?:CL-)?(\d{4,6})/i);
  if (orderNumMatch) {
    const targetDigits = orderNumMatch[1];
    matchedOrder = allOrders.find(
      (o: any) =>
        o.orderNumber?.includes(targetDigits) ||
        o.id?.includes(targetDigits)
    );
  }

  if (!matchedOrder && senderPhone) {
    const rawDigits = senderPhone.replace(/\D/g, '');
    matchedOrder = allOrders
      .filter((o: any) => {
        const ordPhone = (o.deliveryDetails?.customerPhone || '').replace(/\D/g, '');
        return ordPhone && (ordPhone.includes(rawDigits) || rawDigits.includes(ordPhone));
      })
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  let replyText = '';

  if (normalizedText.includes('PIN') || normalizedText === 'OTP') {
    if (matchedOrder) {
      const pin = matchedOrder.pickupAuthorizationCode || matchedOrder.deliveryPin || '[PIN Pending - Contact Branch]';
      replyText = `🔐 *CHOPLIFE DELIVERY HANDOVER PIN*\n\nOrder *#${matchedOrder.orderNumber}*\nHandover PIN: *${pin}*\n\n_Please recite this 4-digit PIN to your dispatch rider upon arrival at your gate to verify handover._`;
    } else {
      replyText = `🔐 *Choplife Republic PIN Help*\n\nTo retrieve your 4-digit handover PIN, please reply with your Order Number (e.g. *PIN CL-83921*).`;
    }
  } else if (
    normalizedText.includes('TRACK') ||
    normalizedText.includes('STATUS') ||
    normalizedText.includes('WHERE') ||
    orderNumMatch
  ) {
    if (matchedOrder) {
      const pin = matchedOrder.pickupAuthorizationCode || matchedOrder.deliveryPin || '[PIN Pending]';
      const riderInfo = matchedOrder.riderName
        ? `🛵 *Rider:* ${matchedOrder.riderName} ${matchedOrder.riderPhone ? `(${matchedOrder.riderPhone})` : ''}\n`
        : '';
      const checkpoint = matchedOrder.riderCheckpoint
        ? `📍 *Transit Checkpoint:* ${matchedOrder.riderCheckpoint}\n`
        : '';

      replyText = `🍗 *CHOPLIFE LIVE ORDER STATUS*\n\nOrder: *#${matchedOrder.orderNumber}*\nStatus: *${(matchedOrder.orderStatus || 'PREPARING').toUpperCase()}*\nBranch: *${(matchedOrder.branchId || 'GRA').toUpperCase()}*\n${riderInfo}${checkpoint}🔐 *Handover PIN: ${pin}*\n\nTrack your live map and kitchen updates:\n🔗 https://choplife.ng/track/${matchedOrder.orderNumber}\n\n_Thank you for choosing Choplife Republic!_`;
    } else {
      replyText = `🍗 *Choplife Republic*\n\nWe couldn't locate an active order with that reference. Please reply with your exact Order Number (e.g. *STATUS CL-83921*) or call our customer line at 0800-CHOPLIFE.`;
    }
  } else if (normalizedText.includes('MENU') || normalizedText.includes('PRICE')) {
    replyText = `🍔 *CHOPLIFE REPUBLIC BENIN MENU*\n\n🔥 *Top Feasts:*\n• Republic Sharwama Double Sausage: ₦3,800\n• Grilled Catfish & Yam Chips: ₦7,500\n• Jollof Rice Supreme Bucket: ₦5,200\n• Asun Peppered Goat Platter: ₦4,500\n\n📍 *Locations:*\n• GRA Flagship: 8a Okogo Street, Opposite Wesley Hotel, Off Akhionbare, G.R.A.\n• Okabere Hub: 2 Okabere Street, Off Sapele Road\n• Ugbowo Hub: Petom Filling Station, Opposite S & T Barracks, Isihor\n\nOrder online directly:\n🔗 https://choplife.ng/menu`;
  } else {
    replyText = `👋 Hello *${customerName}*, welcome to *Choplife Republic* WhatsApp Assistant!\n\nHow can we serve you today?\n• Reply *STATUS* to track your meal\n• Reply *PIN* for delivery handover PIN\n• Reply *MENU* to view hot specials\n• Reply *HELP* to speak with branch manager`;
  }

  const inNotifId = `inbound-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const inboundRecord = {
    id: inNotifId,
    orderId: matchedOrder?.id || '',
    orderNumber: matchedOrder?.orderNumber || '',
    customerName,
    customerPhone: cleanPhone,
    channel: 'whatsapp',
    provider: 'whatsapp_cloud_api',
    eventType: 'MANUAL_ALERT',
    recipient: 'Choplife Republic WhatsApp Business',
    message: incomingText,
    status: 'delivered',
    timestamp: now,
    costNaira: 0,
    metadata: {
      direction: 'inbound',
      isCustomerInbound: true,
      sender: cleanPhone,
    },
    branchId: matchedOrder?.branchId || 'gra',
  };
  db.notifications[inNotifId] = inboundRecord;

  const outboundResult = await dispatchWhatsAppCloud(cleanPhone, replyText, db.gatewayConfig);
  const outNotifId = `reply-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const replyRecord = {
    id: outNotifId,
    orderId: matchedOrder?.id || '',
    orderNumber: matchedOrder?.orderNumber || '',
    customerName,
    customerPhone: cleanPhone,
    channel: 'whatsapp',
    provider: 'whatsapp_cloud_api',
    eventType: 'MANUAL_ALERT',
    recipient: cleanPhone,
    message: replyText,
    status: outboundResult.status,
    timestamp: new Date().toISOString(),
    costNaira: outboundResult.costNaira,
    metadata: {
      direction: 'outbound',
      isBotAutoReply: true,
      inboundReferenceId: inNotifId,
      mode: outboundResult.mode,
    },
    branchId: matchedOrder?.branchId || 'gra',
  };
  db.notifications[outNotifId] = replyRecord;

  return {
    handled: true,
    incomingText,
    senderPhone: cleanPhone,
    replyText,
    orderMatched: matchedOrder,
    createdNotifications: [inboundRecord, replyRecord],
  };
}

/**
 * Handles Termii DLR (Delivery Report) Webhooks
 */
export function processTermiiDlr(body: any, db: DbDatabase): { updated: boolean; count: number } {
  const messageId = body.message_id || body.messageId || body.id;
  const statusStr = (body.status || '').toLowerCase();
  if (!messageId) return { updated: false, count: 0 };

  let updated = false;
  const allNotifs = Object.values(db.notifications || {});

  for (const notif of allNotifs) {
    if (notif.metadata?.messageId === messageId || notif.id === messageId) {
      notif.status = statusStr.includes('deliver') ? 'delivered' : statusStr.includes('fail') ? 'failed' : notif.status;
      notif.metadata = notif.metadata || {};
      notif.metadata.dlrTimestamp = new Date().toISOString();
      notif.metadata.dlrRaw = body;
      updated = true;
    }
  }

  return { updated, count: updated ? 1 : 0 };
}
