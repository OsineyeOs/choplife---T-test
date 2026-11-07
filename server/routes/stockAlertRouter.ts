import { Router } from 'express';
import type { Request, Response } from 'express';
import type { DbDatabase, DbStaffAccount } from '../../server_db.ts';
import type {
  InventoryLocationId,
  StockAlertStateRecord,
} from '../../src/types/inventoryAndProcurement.ts';
import {
  VALID_LOCATIONS,
  getLastStockAlertEvaluationRunAt,
  isSmsProviderLiveConfigured,
  isEmailProviderLiveConfigured,
  evaluateInventoryReorderAlerts,
} from '../services/stockAlertService.ts';

export function createStockAlertRouter(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: any;
  dispatchTermiiSms: any;
  logAuditEvent: any;
}): Router {
  const router = Router();
  const { getDb, saveDatabaseSync, requireAuth, dispatchTermiiSms, logAuditEvent } = deps;

  router.get('/api/inventory/reorder-alerts', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const { locationId, status } = req.query;
    let alerts = Object.values(db.stockAlerts || {}) as StockAlertStateRecord[];

    if (locationId && locationId !== 'all') {
      alerts = alerts.filter((a) => a.locationId === String(locationId));
    }
    if (status && status !== 'all') {
      alerts = alerts.filter((a) => a.status === String(status));
    }

    alerts.sort((a, b) => {
      const tA = new Date(a.lastTriggeredAt || 0).getTime();
      const tB = new Date(b.lastTriggeredAt || 0).getTime();
      return tB - tA;
    });

    return res.json({
      lastEvaluationRunAt: getLastStockAlertEvaluationRunAt(),
      providerConfiguration: {
        smsLiveConfigured: isSmsProviderLiveConfigured(db),
        emailLiveConfigured: isEmailProviderLiveConfigured(),
        inAppPersistenceEnabled: true,
      },
      totalTrackedAlerts: alerts.length,
      activeLowStockAlertsCount: alerts.filter(
        (a) =>
          a.status === 'alert_sent' ||
          a.status === 'threshold_reached' ||
          a.status === 'provider_unconfigured' ||
          a.status === 'alert_failed'
      ).length,
      restockedResetCount: alerts.filter((a) => a.status === 'restocked_reset').length,
      alerts,
    });
  });

  router.post('/api/inventory/check-reorder-alerts', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    const staff = (req as any).staff as DbStaffAccount;
    const allowedRoles = [
      'super_admin',
      'corporate_admin',
      'admin',
      'branch_manager',
      'store_manager',
      'storekeeper',
      'auditor',
      'accountant',
    ];
    if (!allowedRoles.includes(staff.role)) {
      return res.status(403).json({
        error: `Forbidden: role '${staff.role}' cannot trigger inventory reorder evaluations.`,
      });
    }

    const locationFilter = (req.body?.branchId || req.body?.locationId || req.query?.branchId) as
      | string
      | undefined;
    const forceResend = Boolean(req.body?.forceResend);
    const simulateProviderFailure = Boolean(req.body?.simulateProviderFailure);

    const result = await evaluateInventoryReorderAlerts({
      db,
      saveDatabaseSync,
      dispatchTermiiSms,
      logAuditEvent,
      locationFilter,
      triggeredByStaff: { name: staff.name, role: staff.role, branchId: staff.branchId },
      forceResend,
      simulateProviderFailure,
    });

    return res.json({
      success: true,
      ...result,
    });
  });

  const handleUpdateReorderConfig = async (req: Request, res: Response) => {
    const db = getDb();
    const staff = (req as any).staff as DbStaffAccount;
    const allowedRoles = [
      'super_admin',
      'corporate_admin',
      'admin',
      'branch_manager',
      'store_manager',
      'storekeeper',
    ];
    if (!allowedRoles.includes(staff.role)) {
      return res.status(403).json({
        error: `Forbidden: role '${staff.role}' is not authorized to modify reorder threshold configurations.`,
      });
    }

    const { id } = req.params;
    const item = db.inventory?.[id];
    if (!item) {
      return res.status(404).json({ error: `Inventory item '${id}' not found.` });
    }

    const {
      locationId = 'gra',
      reorderPoint,
      reorderLevel,
      minimumStockLevel,
      minThreshold,
      preferredReorderQuantity,
      reorderQuantity,
      alertEnabled,
      preferredChannel,
      unit,
      recipientOverrides,
    } = req.body || {};

    if (!VALID_LOCATIONS.includes(locationId as InventoryLocationId)) {
      return res.status(400).json({
        error: `Invalid locationId '${locationId}'. Must be one of: ${VALID_LOCATIONS.join(', ')}.`,
      });
    }

    const universalRoles = ['super_admin', 'corporate_admin', 'admin', 'store_manager', 'storekeeper'];
    if (!universalRoles.includes(staff.role)) {
      const staffBranches = new Set([staff.branchId, ...(staff.allowedBranchIds || [])]);
      if (!staffBranches.has(String(locationId))) {
        return res.status(403).json({
          error: `Access denied. Staff member cannot modify reorder thresholds for location '${locationId}'.`,
        });
      }
    }

    const itemBaseUnit = String(item.baseUnit || item.unit || '').toLowerCase();
    if (unit !== undefined && String(unit).toLowerCase() !== itemBaseUnit) {
      return res.status(400).json({
        error: `Unit mismatch: item '${item.name}' uses base unit '${item.baseUnit || item.unit}', cannot configure threshold in '${unit}'.`,
      });
    }

    const resolvedReorderPoint =
      reorderPoint !== undefined ? Number(reorderPoint) : reorderLevel !== undefined ? Number(reorderLevel) : undefined;
    const resolvedMinStock =
      minimumStockLevel !== undefined
        ? Number(minimumStockLevel)
        : minThreshold !== undefined
        ? Number(minThreshold)
        : undefined;
    const resolvedReorderQty =
      preferredReorderQuantity !== undefined
        ? Number(preferredReorderQuantity)
        : reorderQuantity !== undefined
        ? Number(reorderQuantity)
        : undefined;

    if (resolvedReorderPoint !== undefined && (!Number.isFinite(resolvedReorderPoint) || resolvedReorderPoint < 0)) {
      return res.status(400).json({
        error: 'Invalid reorderPoint: must be a non-negative number.',
      });
    }
    if (resolvedMinStock !== undefined && (!Number.isFinite(resolvedMinStock) || resolvedMinStock < 0)) {
      return res.status(400).json({
        error: 'Invalid minimumStockLevel: must be a non-negative number.',
      });
    }
    if (resolvedReorderQty !== undefined && (!Number.isFinite(resolvedReorderQty) || resolvedReorderQty < 0)) {
      return res.status(400).json({
        error: 'Invalid preferredReorderQuantity: must be a non-negative number.',
      });
    }

    item.locationStock = item.locationStock || {};
    const existingLoc = item.locationStock[locationId] || {
      stockOnHand: 0,
      availableStock: 0,
      reservedStock: 0,
      minThreshold: 5,
      parLevel: 20,
      reorderLevel: 5,
      reorderQuantity: 15,
      unitCost: item.costPerUnit || 0,
    };

    if (resolvedReorderPoint !== undefined) {
      existingLoc.reorderLevel = resolvedReorderPoint;
      item.minThreshold = item.minThreshold || {};
      item.minThreshold[locationId] = resolvedReorderPoint;
    }
    if (resolvedMinStock !== undefined) {
      existingLoc.minThreshold = resolvedMinStock;
    }
    if (resolvedReorderQty !== undefined) {
      existingLoc.reorderQuantity = resolvedReorderQty;
    }
    if (alertEnabled !== undefined) {
      existingLoc.alertEnabled = Boolean(alertEnabled);
    }
    if (preferredChannel && ['email', 'sms', 'both', 'in_app'].includes(preferredChannel)) {
      existingLoc.preferredAlertChannel = preferredChannel;
    }
    if (Array.isArray(recipientOverrides)) {
      existingLoc.recipientOverrides = recipientOverrides.map((r: any) => String(r).trim()).filter(Boolean);
    }

    item.locationStock[locationId] = existingLoc;
    item.updatedAt = new Date().toISOString();
    item.updatedByStaffId = staff.id;
    item.updatedByName = staff.name;

    saveDatabaseSync();

    logAuditEvent(
      staff.name,
      staff.role,
      staff.branchId,
      'STOCK_MODIFIED',
      `Updated reorder config for ${item.name} at ${locationId}: reorderPoint=${existingLoc.reorderLevel}, alertEnabled=${existingLoc.alertEnabled ?? true}`
    );

    const evalResult = await evaluateInventoryReorderAlerts({
      db,
      saveDatabaseSync,
      dispatchTermiiSms,
      locationFilter: locationId,
    });

    return res.json({
      success: true,
      itemId: item.id,
      locationId,
      reorderConfig: {
        reorderPoint: existingLoc.reorderLevel,
        minimumStockLevel: existingLoc.minThreshold,
        preferredReorderQuantity: existingLoc.reorderQuantity,
        alertEnabled: existingLoc.alertEnabled ?? true,
        preferredChannel: existingLoc.preferredAlertChannel || 'both',
        unit: item.baseUnit || item.unit,
      },
      evaluationSummary: {
        lowStockCount: evalResult.lowStockCount,
        newlyTriggeredCount: evalResult.newlyTriggeredCount,
        resetAfterRestockCount: evalResult.resetAfterRestockCount,
      },
    });
  };

  router.put('/api/inventory/:id/reorder-config', requireAuth, handleUpdateReorderConfig);
  router.put('/api/inventory/items/:id/reorder-config', requireAuth, handleUpdateReorderConfig);

  return router;
}
