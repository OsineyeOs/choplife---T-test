import { Router, RequestHandler } from 'express';
import { db, saveDatabaseSync, DbStaffAccount } from '../../server_db';
import { computeExecutiveDashboard, generateReportsCsv } from '../../server_bi';
import {
  buildAccountingJournalEntries,
  DEFAULT_CHART_OF_ACCOUNTS,
  validateChartOfAccountsMapping,
} from '../../server_accounting';
import { expandOrderItemsWithPackages } from '../services/packageAndPricingEngine.ts';

export interface AssetsAndReportsRouterDeps {
  requireAuth: RequestHandler;
  requireBranchAccess: RequestHandler;
  requireRole: (roles: string[]) => RequestHandler;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    description: string
  ) => any;
}

export function createAssetsAndReportsRouter(deps: AssetsAndReportsRouterDeps): Router {
  const router = Router();
  const { requireAuth, requireBranchAccess, requireRole, logAuditEvent } = deps;

  router.get('/api/inventory/assets', requireAuth, (req, res) => {
    db.assets = db.assets || {};
    let list = Object.values(db.assets);
    const { branchId, category, status, search } = req.query;

    if (branchId && branchId !== 'all') {
      list = list.filter((a) => a.branchId === branchId);
    }
    if (category && category !== 'all') {
      list = list.filter((a) => a.category === category);
    }
    if (status && status !== 'all') {
      list = list.filter((a) => a.status === status);
    }
    if (search && String(search).trim()) {
      const q = String(search).toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.assetTag.toLowerCase().includes(q) ||
          (a.serialNumber && a.serialNumber.toLowerCase().includes(q)) ||
          (a.manufacturer && a.manufacturer.toLowerCase().includes(q))
      );
    }

    res.json(list);
  });

  router.get('/api/inventory/assets/:id', requireAuth, (req, res) => {
    db.assets = db.assets || {};
    const { id } = req.params;
    const asset = db.assets[id] || Object.values(db.assets).find((a) => a.assetTag.toLowerCase() === id.toLowerCase());
    if (!asset) return res.status(404).json({ error: 'Fixed asset not found.' });
    res.json(asset);
  });

  router.post(
    '/api/inventory/assets',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'auditor', 'accountant', 'storekeeper']),
    (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      const {
        name,
        category = 'kitchen_equipment',
        branchId = currentStaff.branchId || 'gra',
        locationDetails,
        serialNumber,
        modelNumber,
        manufacturer,
        purchaseDate,
        purchaseCost = 0,
        currentValue,
        depreciationRatePct = 10,
        status = 'operational',
        assignedToStaffId,
        assignedToStaffName,
        lastServiceDate,
        nextServiceDueDate,
        notes,
      } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Asset name is required.' });
      }

      db.assets = db.assets || {};
      const id = req.body.id || `ast-${branchId}-${Date.now().toString().slice(-6)}`;
      const assetTag = req.body.assetTag || `AST-${branchId.toUpperCase()}-${String(Object.keys(db.assets).length + 1).padStart(3, '0')}`;

      const costNum = Math.max(0, Number(purchaseCost) || 0);
      const valNum = currentValue !== undefined ? Math.max(0, Number(currentValue) || 0) : costNum;
      const now = new Date().toISOString();

      const newAsset: any = {
        id,
        assetTag,
        name: name.trim(),
        category,
        branchId,
        locationDetails: locationDetails?.trim() || undefined,
        serialNumber: serialNumber?.trim() || undefined,
        modelNumber: modelNumber?.trim() || undefined,
        manufacturer: manufacturer?.trim() || undefined,
        purchaseDate: purchaseDate || now.split('T')[0],
        purchaseCost: costNum,
        currentValue: valNum,
        depreciationRatePct: Number(depreciationRatePct) || 10,
        status,
        assignedToStaffId: assignedToStaffId || undefined,
        assignedToStaffName: assignedToStaffName || undefined,
        lastServiceDate: lastServiceDate || undefined,
        nextServiceDueDate: nextServiceDueDate || undefined,
        notes: notes?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };

      db.assets[id] = newAsset;
      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        branchId,
        'ASSET_REGISTERED',
        `Registered fixed plant asset "${newAsset.name}" (${newAsset.assetTag}) at ${branchId}`
      );

      res.status(201).json({ success: true, asset: newAsset });
    }
  );

  router.put(
    '/api/inventory/assets/:id',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'auditor', 'accountant', 'storekeeper']),
    (req, res) => {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;
      db.assets = db.assets || {};
      const asset = db.assets[id] || Object.values(db.assets).find((a) => a.assetTag.toLowerCase() === id.toLowerCase());
      if (!asset) return res.status(404).json({ error: 'Fixed asset not found.' });

      const {
        name,
        category,
        branchId,
        locationDetails,
        serialNumber,
        modelNumber,
        manufacturer,
        purchaseDate,
        purchaseCost,
        currentValue,
        depreciationRatePct,
        status,
        assignedToStaffId,
        assignedToStaffName,
        lastServiceDate,
        nextServiceDueDate,
        notes,
      } = req.body;

      if (name) asset.name = name.trim();
      if (category) asset.category = category;
      if (branchId) asset.branchId = branchId;
      if (locationDetails !== undefined) asset.locationDetails = locationDetails?.trim() || undefined;
      if (serialNumber !== undefined) asset.serialNumber = serialNumber?.trim() || undefined;
      if (modelNumber !== undefined) asset.modelNumber = modelNumber?.trim() || undefined;
      if (manufacturer !== undefined) asset.manufacturer = manufacturer?.trim() || undefined;
      if (purchaseDate) asset.purchaseDate = purchaseDate;
      if (purchaseCost !== undefined) asset.purchaseCost = Math.max(0, Number(purchaseCost) || 0);
      if (currentValue !== undefined) asset.currentValue = Math.max(0, Number(currentValue) || 0);
      if (depreciationRatePct !== undefined) asset.depreciationRatePct = Number(depreciationRatePct) || 10;
      if (status) asset.status = status;
      if (assignedToStaffId !== undefined) asset.assignedToStaffId = assignedToStaffId || undefined;
      if (assignedToStaffName !== undefined) asset.assignedToStaffName = assignedToStaffName || undefined;
      if (lastServiceDate !== undefined) asset.lastServiceDate = lastServiceDate || undefined;
      if (nextServiceDueDate !== undefined) asset.nextServiceDueDate = nextServiceDueDate || undefined;
      if (notes !== undefined) asset.notes = notes?.trim() || undefined;
      asset.updatedAt = new Date().toISOString();

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        asset.branchId,
        'ASSET_UPDATED',
        `Updated asset ${asset.assetTag} (${asset.name}): Status=${asset.status}`
      );

      res.json({ success: true, asset });
    }
  );

  router.delete(
    '/api/inventory/assets/:id',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin']),
    (req, res) => {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;
      db.assets = db.assets || {};
      const asset = db.assets[id] || Object.values(db.assets).find((a) => a.assetTag.toLowerCase() === id.toLowerCase());
      if (!asset) return res.status(404).json({ error: 'Fixed asset not found.' });

      delete db.assets[asset.id];
      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        asset.branchId,
        'ASSET_DELETED',
        `Decommissioned/deleted fixed asset ${asset.assetTag} (${asset.name})`
      );

      res.json({ success: true, message: `Fixed asset ${asset.assetTag} decommissioned.` });
    }
  );

  router.get(
    '/api/audit/logs',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'auditor', 'accountant', 'branch_manager', 'store_manager']),
    (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      const isGlobal = ['super_admin', 'corporate_admin', 'admin', 'auditor', 'accountant'].includes(currentStaff.role);
      const { branchId, actionType, limit = 200 } = req.query;
      let logs = [...db.auditLogs];

      if (!isGlobal) {
        const allowedBranches = Array.from(new Set([currentStaff.branchId, ...(currentStaff.allowedBranchIds || [])]));
        logs = logs.filter((l) => allowedBranches.includes(l.branchId));
      } else if (branchId && branchId !== 'all') {
        logs = logs.filter((l) => l.branchId === branchId);
      }
      if (actionType && actionType !== 'all') {
        logs = logs.filter((l) => l.actionType === actionType);
      }

      res.json(logs.slice(0, Number(limit)));
    }
  );

  const resolveScopedBranchForReport = (currentStaff: DbStaffAccount, requestedBranch?: string): string => {
    const isGlobal = ['super_admin', 'corporate_admin', 'admin', 'auditor', 'accountant'].includes(currentStaff.role);
    const reqBranch = requestedBranch || 'all';
    if (isGlobal) return reqBranch;
    const allowed = Array.from(new Set([currentStaff.branchId, ...(currentStaff.allowedBranchIds || [])])).filter(Boolean);
    if (reqBranch !== 'all' && allowed.includes(reqBranch)) {
      return reqBranch;
    }
    return currentStaff.branchId || 'gra';
  };

  router.get(
    '/api/reports/sales-summary',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'store_manager', 'branch_manager', 'accountant', 'auditor']),
    (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      const effectiveBranchId = resolveScopedBranchForReport(currentStaff, req.query.branchId as string);
      const includeHistorical = req.query.includeHistoricalMigrated === 'true';

      let checks = Object.values(db.checks).filter((c) => {
        if (c.status !== 'paid') return false;
        if (!includeHistorical && (c.isHistoricalMigrated || c.legacySourceSystem === 'ezee_optimus')) return false;
        return true;
      });

      if (effectiveBranchId && effectiveBranchId !== 'all') {
        checks = checks.filter((c) => c.branchId === effectiveBranchId);
      }

      const grossSales = checks.reduce((sum, c) => sum + c.total, 0);
      const totalDiscounts = checks.reduce(
        (sum, c) => sum + (c.discountAmount || 0) + Number((c as any).itemLevelDiscountTotal || 0),
        0
      );
      const totalOrders = checks.length;
      const averageOrderValue = totalOrders > 0 ? Math.round(grossSales / totalOrders) : 0;

      const cashSales = checks.filter((c) => c.paymentMethod === 'cash').reduce((sum, c) => sum + c.total, 0);
      const posSales = checks.filter((c) => c.paymentMethod === 'pos_terminal').reduce((sum, c) => sum + c.total, 0);
      const transferSales = checks.filter((c) => c.paymentMethod === 'bank_transfer').reduce((sum, c) => sum + c.total, 0);
      const splitSales = checks.filter((c) => c.paymentMethod === 'split').reduce((sum, c) => sum + c.total, 0);

      const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
      const allPaidItems: any[] = [];
      for (const check of checks) {
        if (Array.isArray(check.items)) {
          for (const item of check.items) {
            allPaidItems.push(item);
            const key = item.name || item.productId;
            if (!itemMap[key]) {
              itemMap[key] = { name: item.name || 'Menu Item', quantity: 0, revenue: 0 };
            }
            itemMap[key].quantity += item.quantity || 1;
            itemMap[key].revenue += item.totalPrice ?? (item.unitPrice || 0) * (item.quantity || 1);
          }
        }
      }

      const topItems = Object.values(itemMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const packageSalesSummary = expandOrderItemsWithPackages(db, allPaidItems);

      res.json({
        grossSales,
        totalDiscounts,
        totalOrders,
        averageOrderValue,
        cashSales,
        posSales,
        transferSales,
        splitSales,
        topItems,
        packageSalesSummary,
        packagesSoldSummary: packageSalesSummary.packagesSold,
        componentDemandBreakdown: packageSalesSummary.componentDemand,
        branchId: effectiveBranchId,
      });
    }
  );

  router.get(
    '/api/reports/executive-dashboard',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'store_manager', 'branch_manager', 'accountant', 'auditor']),
    (req, res) => {
      try {
        const currentStaff = (req as any).staff as DbStaffAccount;
        const effectiveBranchId = resolveScopedBranchForReport(currentStaff, req.query.branchId as string);
        const {
          period = 'all',
          startDate,
          endDate,
          comparisonMode,
          likeForLike,
          includeHistoricalMigrated,
        } = req.query;

        const dashboardData = computeExecutiveDashboard(
          db,
          effectiveBranchId,
          (period as any) || 'all',
          {
            startDate: startDate as string | undefined,
            endDate: endDate as string | undefined,
            comparisonMode: (comparisonMode as any) || 'none',
            likeForLike: likeForLike !== 'false',
            includeHistoricalMigrated: includeHistoricalMigrated !== 'false',
          }
        );
        res.json(dashboardData);
      } catch (err: any) {
        console.error('[API] Error generating executive dashboard:', err);
        res.status(500).json({ error: 'Failed to generate executive analytics dashboard.' });
      }
    }
  );

  router.get(
    '/api/reports/menu-engineering',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'store_manager', 'branch_manager', 'accountant', 'auditor']),
    (req, res) => {
      try {
        const currentStaff = (req as any).staff as DbStaffAccount;
        const effectiveBranchId = resolveScopedBranchForReport(currentStaff, req.query.branchId as string);
        const { period } = req.query;
        const data = computeExecutiveDashboard(db, effectiveBranchId, (period as any) || 'all');
        res.json({ menuMatrix: data.menuMatrix });
      } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch menu engineering matrix.' });
      }
    }
  );

  router.get(
    '/api/reports/accounting-journal',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'store_manager', 'branch_manager', 'accountant', 'auditor']),
    requireBranchAccess,
    (req, res) => {
      try {
        const currentStaff = (req as any).staff as DbStaffAccount;
        const isGlobal = ['super_admin', 'corporate_admin', 'auditor', 'accountant'].includes(currentStaff.role);
        const requestedBranch = (req.query.branchId as string) || 'all';
        const effectiveBranchId = isGlobal ? requestedBranch : currentStaff.branchId;

        const ledgerReport = buildAccountingJournalEntries(db, {
          branchId: effectiveBranchId,
          period: (req.query.period as any) || 'all',
          startDate: req.query.startDate as string | undefined,
          endDate: req.query.endDate as string | undefined,
          taxMode: req.query.taxMode as any,
        });

        res.json({
          success: true,
          chartOfAccounts: DEFAULT_CHART_OF_ACCOUNTS,
          report: ledgerReport,
        });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Failed to build accounting journal ledger.' });
      }
    }
  );

  router.put(
    '/api/reports/accounting-config',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'accountant']),
    (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      const { taxMode, accountantConfirmedTaxPolicy } = req.body || {};
      const validModes = ['exempt', 'vat_inclusive_7_5', 'vat_exclusive_7_5'];
      if (taxMode && !validModes.includes(taxMode)) {
        return res.status(400).json({ error: `Invalid taxMode. Allowed: ${validModes.join(', ')}` });
      }

      (db as any).accountingConfig = {
        ...((db as any).accountingConfig || {}),
        ...(taxMode ? { taxMode } : {}),
        ...(accountantConfirmedTaxPolicy !== undefined
          ? { accountantConfirmedTaxPolicy: Boolean(accountantConfirmedTaxPolicy) }
          : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: currentStaff.name,
      };

      if (taxMode && db.receiptTemplates?.['tmpl-cust-receipt']) {
        db.receiptTemplates['tmpl-cust-receipt'].showTaxBreakdown = taxMode !== 'exempt';
      }

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'ACCOUNTING_TAX_CONFIG_UPDATED',
        `Updated accounting taxMode=${(db as any).accountingConfig.taxMode}, accountantConfirmed=${(db as any).accountingConfig.accountantConfirmedTaxPolicy}`
      );

      res.json({
        success: true,
        accountingConfig: (db as any).accountingConfig,
        chartValidation: validateChartOfAccountsMapping(DEFAULT_CHART_OF_ACCOUNTS),
      });
    }
  );

  router.post(
    '/api/reports/export-csv',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'store_manager', 'branch_manager', 'accountant', 'auditor']),
    requireBranchAccess,
    (req, res) => {
      try {
        const currentStaff = (req as any).staff as DbStaffAccount;
        const isGlobal = ['super_admin', 'corporate_admin', 'auditor', 'accountant'].includes(currentStaff.role);
        const requestedBranch = req.body.branchId || 'all';
        const effectiveBranchId = isGlobal ? requestedBranch : currentStaff.branchId;

        const {
          exportType = 'pnl',
          period = 'all',
          startDate,
          endDate,
          taxMode,
          preventDuplicateExport = false,
          allowReExport = false,
        } = req.body;

        const data = computeExecutiveDashboard(db, effectiveBranchId, period);
        const csvContent = generateReportsCsv(data, exportType, db, {
          branchId: effectiveBranchId,
          period,
          startDate,
          endDate,
          taxMode,
          preventDuplicateExport,
          allowReExport,
          exportedBy: currentStaff.name,
        });

        if (preventDuplicateExport) {
          saveDatabaseSync();
        }

        const filename = `choplife-${exportType}-${effectiveBranchId}-${period}-${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
      } catch (err: any) {
        const msg = err?.message || 'Failed to generate CSV export.';
        const status = msg.includes('DUPLICATE_EXPORT_BLOCKED') ? 409 : 400;
        res.status(status).json({ error: msg });
      }
    }
  );

  return router;
}
