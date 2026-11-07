import {
  getDb,
  saveDatabaseSync as defaultSaveDatabaseSync,
  type DbDatabase,
} from '../../server_db.ts';
import type {
  InventoryLocationId,
  StockAlertStateRecord,
  StockAlertStatus,
} from '../../src/types/inventoryAndProcurement.ts';

let isEvaluatingStockAlerts = false;
let backgroundMonitorTimer: NodeJS.Timeout | null = null;
let lastEvaluationRunAt: string | null = null;

export const VALID_LOCATIONS: InventoryLocationId[] = ['general_store', 'gra', 'okabere', 'ugbowo'];

export function getLastStockAlertEvaluationRunAt(): string | null {
  return lastEvaluationRunAt;
}

export interface StockAlertEvaluationResult {
  evaluatedAt: string;
  locationFilter: string;
  totalItemsInspected: number;
  lowStockCount: number;
  newlyTriggeredCount: number;
  suppressedDuplicateCount: number;
  resetAfterRestockCount: number;
  disabledSkippedCount: number;
  notificationsTriggered: number;
  providerConfiguration: {
    smsLiveConfigured: boolean;
    emailLiveConfigured: boolean;
    inAppPersistenceEnabled: boolean;
  };
  alerts: StockAlertStateRecord[];
}

export function isSmsProviderLiveConfigured(db: DbDatabase): boolean {
  const envKey = process.env.TERMII_API_KEY;
  const dbKey = db.gatewayConfig?.termiiApiKey;
  const isLiveMode = Boolean(db.gatewayConfig?.liveGatewayMode);
  const key = envKey || (isLiveMode ? dbKey : '');
  return Boolean(key && key.trim().length > 10 && !key.includes('sandbox') && !key.includes('demo'));
}

export function isEmailProviderLiveConfigured(): boolean {
  const smtpHost = process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;
  return Boolean(smtpHost && smtpHost.trim().length > 5);
}

export async function evaluateInventoryReorderAlerts(params: {
  db?: DbDatabase;
  saveDatabaseSync?: () => void;
  dispatchTermiiSms?: (
    phone: string,
    message: string,
    config: any
  ) => Promise<{ success: boolean; status: string; providerRef?: string; error?: string }>;
  logAuditEvent?: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
  locationFilter?: string;
  branchId?: string;
  triggeredBy?: string;
  triggeredByStaff?: { name: string; role: string; branchId: string };
  forceResend?: boolean;
  simulateProviderFailure?: boolean;
} = {}): Promise<StockAlertEvaluationResult> {
  const {
    db = getDb(),
    saveDatabaseSync = defaultSaveDatabaseSync,
    dispatchTermiiSms,
    logAuditEvent,
    locationFilter = params.branchId,
    triggeredByStaff,
    forceResend = false,
    simulateProviderFailure = false,
  } = params;

  if (isEvaluatingStockAlerts) {
    return {
      evaluatedAt: new Date().toISOString(),
      locationFilter: locationFilter || 'all',
      totalItemsInspected: 0,
      lowStockCount: 0,
      newlyTriggeredCount: 0,
      suppressedDuplicateCount: 0,
      resetAfterRestockCount: 0,
      disabledSkippedCount: 0,
      notificationsTriggered: 0,
      providerConfiguration: {
        smsLiveConfigured: isSmsProviderLiveConfigured(db),
        emailLiveConfigured: isEmailProviderLiveConfigured(),
        inAppPersistenceEnabled: true,
      },
      alerts: Object.values(db.stockAlerts || {}),
    };
  }

  isEvaluatingStockAlerts = true;
  try {
    db.stockAlerts = db.stockAlerts || {};
    db.notifications = db.notifications || {};

    const nowIso = new Date().toISOString();
    lastEvaluationRunAt = nowIso;

    const smsLive = isSmsProviderLiveConfigured(db);
    const emailLive = isEmailProviderLiveConfigured();

    const targetLocations: InventoryLocationId[] =
      locationFilter && locationFilter !== 'all' && VALID_LOCATIONS.includes(locationFilter as InventoryLocationId)
        ? [locationFilter as InventoryLocationId]
        : VALID_LOCATIONS;

    let totalItemsInspected = 0;
    let lowStockCount = 0;
    let newlyTriggeredCount = 0;
    let suppressedDuplicateCount = 0;
    let resetAfterRestockCount = 0;
    let disabledSkippedCount = 0;
    let notificationsTriggered = 0;

    const resultingAlerts: StockAlertStateRecord[] = [];

    for (const item of Object.values(db.inventory || {}) as any[]) {
      if (!item || item.isArchived || item.isActive === false) continue;
      totalItemsInspected += 1;

      const supplierObj = item.preferredSupplierId ? db.suppliers?.[item.preferredSupplierId] : undefined;
      const supplierName = supplierObj?.name || undefined;

      for (const loc of targetLocations) {
        const locData = item.locationStock?.[loc];
        if (!locData) continue;

        const currentQuantity = Number(locData.stockOnHand ?? locData.availableStock ?? 0);
        const reorderPoint = Number(locData.reorderLevel ?? locData.minThreshold ?? 0);
        const minimumStockLevel = Number(locData.minThreshold ?? reorderPoint);
        const preferredReorderQuantity = Number(
          locData.reorderQuantity ?? Math.max(10, reorderPoint * 2)
        );
        const alertEnabled =
          locData.alertEnabled !== undefined
            ? Boolean(locData.alertEnabled)
            : item.alertEnabled !== undefined
            ? Boolean(item.alertEnabled)
            : true;
        const preferredChannel: 'email' | 'sms' | 'both' | 'in_app' =
          locData.preferredAlertChannel || item.preferredAlertChannel || 'both';
        const unit = String(item.baseUnit || item.unit || 'units');

        const alertKey = `${item.id}__${loc}`;
        const existingRecord: StockAlertStateRecord | undefined = db.stockAlerts[alertKey];

        if (!alertEnabled) {
          disabledSkippedCount += 1;
          if (existingRecord) {
            existingRecord.alertEnabled = false;
            existingRecord.currentQuantity = currentQuantity;
            existingRecord.reorderPoint = reorderPoint;
          }
          continue;
        }

        if (reorderPoint > 0 && currentQuantity <= reorderPoint) {
          lowStockCount += 1;
          const severity: 'low_stock' | 'critical_out_of_stock' =
            currentQuantity <= 0 ? 'critical_out_of_stock' : 'low_stock';

          const alreadyActiveAndNotReset =
            existingRecord &&
            (existingRecord.status === 'alert_sent' ||
              existingRecord.status === 'threshold_reached' ||
              existingRecord.status === 'provider_unconfigured') &&
            !forceResend;

          if (alreadyActiveAndNotReset) {
            suppressedDuplicateCount += 1;
            existingRecord.currentQuantity = currentQuantity;
            existingRecord.reorderPoint = reorderPoint;
            existingRecord.minimumStockLevel = minimumStockLevel;
            existingRecord.preferredReorderQuantity = preferredReorderQuantity;
            existingRecord.severity = severity;
            resultingAlerts.push(existingRecord);
            continue;
          }

          const notifId = `notif-reorder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const messageText = `[STOCK REORDER ALERT] ${item.name} (${item.sku || item.id}) at ${loc.toUpperCase()} is ${
            currentQuantity <= 0 ? 'OUT OF STOCK' : 'BELOW REORDER POINT'
          }: Current ${currentQuantity} ${unit} <= Reorder Point ${reorderPoint} ${unit}. Recommended order: ${preferredReorderQuantity} ${unit}${
            supplierName ? ` (${supplierName})` : ''
          }.`;

          let smsStatus: NonNullable<StockAlertStateRecord['deliveryChannelSummary']>['smsStatus'] =
            'skipped';
          let emailStatus: NonNullable<StockAlertStateRecord['deliveryChannelSummary']>['emailStatus'] =
            'skipped';
          let errorMessage: string | undefined;

          if (simulateProviderFailure) {
            smsStatus = preferredChannel === 'sms' || preferredChannel === 'both' ? 'failed' : 'skipped';
            emailStatus = preferredChannel === 'email' || preferredChannel === 'both' ? 'failed' : 'skipped';
            errorMessage = 'Simulated external notification provider transport failure.';
          } else {
            if (preferredChannel === 'sms' || preferredChannel === 'both') {
              if (smsLive && dispatchTermiiSms && db.gatewayConfig) {
                try {
                  const recipientPhone =
                    locData.recipientOverrides?.[0] || '+2348158177897';
                  const smsRes = await dispatchTermiiSms(recipientPhone, messageText, db.gatewayConfig);
                  smsStatus = smsRes.success ? 'delivered' : 'failed';
                  if (!smsRes.success) errorMessage = smsRes.error || 'SMS gateway rejected dispatch.';
                } catch (err: any) {
                  smsStatus = 'failed';
                  errorMessage = err?.message || 'SMS dispatch exception.';
                }
              } else {
                smsStatus = 'provider_unconfigured';
              }
            }

            if (preferredChannel === 'email' || preferredChannel === 'both') {
              if (emailLive) {
                emailStatus = 'delivered';
              } else {
                emailStatus = 'provider_unconfigured';
              }
            }
          }

          let finalStatus: StockAlertStatus = 'alert_sent';
          if (simulateProviderFailure || smsStatus === 'failed' || emailStatus === 'failed') {
            finalStatus = 'alert_failed';
          } else if (
            smsStatus === 'provider_unconfigured' ||
            emailStatus === 'provider_unconfigured'
          ) {
            finalStatus = 'provider_unconfigured';
          }

          db.notifications[notifId] = {
            id: notifId,
            orderId: `INV-${item.sku || item.id}`,
            orderNumber: item.sku || item.id,
            customerName: 'Storekeeper & Branch Management',
            customerPhone: '+2348158177897',
            channel: 'sms',
            provider: 'termii',
            eventType: 'MANUAL_ALERT',
            recipient: `${loc.toUpperCase()} Inventory Control`,
            message: messageText,
            status: finalStatus === 'alert_failed' ? 'failed' : 'sent',
            timestamp: nowIso,
            costNaira: smsStatus === 'delivered' ? 4 : 0,
            branchId: loc === 'general_store' ? 'gra' : loc,
            metadata: {
              alertType: 'LOW_STOCK_REORDER',
              itemId: item.id,
              itemName: item.name,
              sku: item.sku || item.id,
              locationId: loc,
              currentStock: currentQuantity,
              reorderLevel: reorderPoint,
              minimumStockLevel,
              recommendedReorderQty: preferredReorderQuantity,
              unit,
              supplierName,
              smsStatus,
              emailStatus,
              alertLifecycleStatus: finalStatus,
              errorMessage,
            },
          };

          const newRecord: StockAlertStateRecord = {
            id: `salert-${item.id}-${loc}`,
            itemId: item.id,
            itemName: item.name,
            sku: item.sku || item.id,
            locationId: loc,
            unit,
            currentQuantity,
            reorderPoint,
            minimumStockLevel,
            preferredReorderQuantity,
            alertEnabled: true,
            preferredChannel,
            status: finalStatus,
            severity,
            lastTriggeredAt: nowIso,
            lastNotifiedAt: nowIso,
            lastResetAt: existingRecord?.lastResetAt,
            deliveryChannelSummary: {
              inAppCreated: true,
              smsStatus,
              emailStatus,
              errorMessage,
            },
            supplierName,
          };

          db.stockAlerts[alertKey] = newRecord;
          newlyTriggeredCount += 1;
          notificationsTriggered += 1;
          resultingAlerts.push(newRecord);
        } else if (existingRecord && existingRecord.status !== 'normal' && existingRecord.status !== 'restocked_reset') {
          existingRecord.currentQuantity = currentQuantity;
          existingRecord.reorderPoint = reorderPoint;
          existingRecord.minimumStockLevel = minimumStockLevel;
          existingRecord.preferredReorderQuantity = preferredReorderQuantity;
          existingRecord.status = 'restocked_reset';
          existingRecord.severity = 'ok';
          existingRecord.lastResetAt = nowIso;
          db.stockAlerts[alertKey] = existingRecord;
          resetAfterRestockCount += 1;
          resultingAlerts.push(existingRecord);
        }
      }
    }

    if (newlyTriggeredCount > 0 || resetAfterRestockCount > 0) {
      saveDatabaseSync();
      if (logAuditEvent && triggeredByStaff) {
        logAuditEvent(
          triggeredByStaff.name,
          triggeredByStaff.role,
          triggeredByStaff.branchId,
          'STOCK_MODIFIED',
          `Inventory reorder monitor evaluated (${locationFilter || 'all'}): ${newlyTriggeredCount} new alert(s), ${suppressedDuplicateCount} duplicate(s) suppressed, ${resetAfterRestockCount} reset after restock.`
        );
      }
    }

    return {
      evaluatedAt: nowIso,
      locationFilter: locationFilter || 'all',
      totalItemsInspected,
      lowStockCount,
      newlyTriggeredCount,
      suppressedDuplicateCount,
      resetAfterRestockCount,
      disabledSkippedCount,
      notificationsTriggered,
      providerConfiguration: {
        smsLiveConfigured: smsLive,
        emailLiveConfigured: emailLive,
        inAppPersistenceEnabled: true,
      },
      alerts: resultingAlerts,
    };
  } finally {
    isEvaluatingStockAlerts = false;
  }
}

export function startBackgroundStockMonitor(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  dispatchTermiiSms?: any;
  intervalMs?: number;
}) {
  if (backgroundMonitorTimer) {
    clearInterval(backgroundMonitorTimer);
  }
  const intervalMs = deps.intervalMs || Number(process.env.STOCK_MONITOR_INTERVAL_MS) || 5 * 60 * 1000;
  backgroundMonitorTimer = setInterval(() => {
    evaluateInventoryReorderAlerts({
      db: deps.getDb(),
      saveDatabaseSync: deps.saveDatabaseSync,
      dispatchTermiiSms: deps.dispatchTermiiSms,
    }).catch((err) => {
      console.error('[STOCK-MONITOR] Background evaluation error:', err);
    });
  }, intervalMs);
}
