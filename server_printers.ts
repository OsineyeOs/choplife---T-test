import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  getDb,
  saveDatabaseSync,
} from './server_db.ts';
import type { DbPrinterProfile } from './server_db.ts';
import {
  validatePrinterAddress,
  checkBranchScope,
  createPrinterTemplatesAndSocketRouter,
} from './server/printers/printerTemplatesAndSocketRouter.ts';

export function createPrinterRouter(
  requireAuth: any,
  requireRole: any,
  requirePermission: any,
  logAuditEvent: any
): Router {
  const router = Router();
  const db = getDb();

  // List all configured printers
  router.get(
    '/',
    requireAuth,
    requirePermission('hardware.printers.view'),
    (req: Request, res: Response) => {
      const { branchId } = req.query;
      let printers = Object.values(db.printers || {});
      if (branchId && branchId !== 'all') {
        printers = printers.filter((p) => p.branchId === branchId || p.branchId === 'all');
      }
      res.json({ success: true, printers });
    }
  );

  // Add a new printer profile
  router.post(
    '/',
    requireAuth,
    requirePermission('hardware.printers.manage'),
    (req: Request, res: Response) => {
      const {
        name,
        branchId = 'gra',
        registerId,
        station = 'Front Counter',
        role = 'counter_pos',
        connectionType = 'browser_thermal',
        ip,
        port = 9100,
        paperWidth = '80mm',
        enabled = true,
        autoCut = true,
        soundBuzzer = false,
        kickDrawer = false,
        categories = [],
        timeoutMs = 2500,
        retryAttempts = 1,
      } = req.body;

      const currentStaff = (req as any).staff;
      const scopeCheck = checkBranchScope(currentStaff, branchId);
      if (!scopeCheck.allowed) {
        logAuditEvent(
          currentStaff?.name || 'Staff',
          currentStaff?.role || 'unknown',
          branchId,
          'CROSS_BRANCH_ACCESS_DENIED',
          scopeCheck.error || 'Cross-branch printer creation blocked.'
        );
        return res.status(403).json({ error: scopeCheck.error });
      }

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Valid printer name is required (minimum 2 characters).' });
      }

      if (connectionType === 'network_ip') {
        const addrCheck = validatePrinterAddress(ip, port);
        if (!addrCheck.valid) {
          return res.status(400).json({ error: addrCheck.error });
        }
      }

      const printerId = `prn-${branchId}-${Date.now().toString().slice(-4)}`;

      const newPrinter: DbPrinterProfile = {
        id: printerId,
        name: name.trim(),
        branchId,
        registerId: registerId || undefined,
        station: station.trim(),
        role,
        connectionType,
        ip: connectionType === 'network_ip' ? ip.trim() : undefined,
        port: connectionType === 'network_ip' ? Number(port) : undefined,
        paperWidth: paperWidth === '58mm' ? '58mm' : '80mm',
        enabled: Boolean(enabled),
        autoCut: Boolean(autoCut),
        soundBuzzer: Boolean(soundBuzzer),
        kickDrawer: Boolean(kickDrawer),
        categories: Array.isArray(categories) ? categories : [],
        timeoutMs: Number(timeoutMs) || 2500,
        retryAttempts: Number(retryAttempts) || 1,
        lastTestStatus: 'untested',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentStaff?.name || 'Staff User',
      };

      db.printers = db.printers || {};
      db.printers[printerId] = newPrinter;
      saveDatabaseSync();

      logAuditEvent(
        currentStaff?.name || 'Staff',
        currentStaff?.role || 'admin',
        branchId,
        'PRINTER_CREATED',
        `Configured new ${connectionType} printer '${newPrinter.name}' for station '${station}' (${paperWidth})`
      );

      res.status(201).json({ success: true, printer: newPrinter });
    }
  );

  // Mount static routes (/network-ping, /network-print, /kick-drawer, /templates/*, /jobs) BEFORE parameterized /:id routes
  router.use(
    createPrinterTemplatesAndSocketRouter(
      requireAuth,
      requireRole,
      requirePermission,
      logAuditEvent
    )
  );

  // Get printer by ID
  router.get(
    '/:id',
    requireAuth,
    requirePermission('hardware.printers.view'),
    (req: Request, res: Response) => {
      const printer = (db.printers || {})[req.params.id];
      if (!printer) {
        return res.status(404).json({ error: 'Printer profile not found.' });
      }
      res.json({ success: true, printer });
    }
  );

  // Update printer
  router.put(
    '/:id',
    requireAuth,
    requirePermission('hardware.printers.manage'),
    (req: Request, res: Response) => {
      const printer = (db.printers || {})[req.params.id];
      if (!printer) {
        return res.status(404).json({ error: 'Printer profile not found.' });
      }

      const currentStaff = (req as any).staff;
      const scopeCheckExisting = checkBranchScope(currentStaff, printer.branchId);
      if (!scopeCheckExisting.allowed) {
        logAuditEvent(
          currentStaff?.name || 'Staff',
          currentStaff?.role || 'unknown',
          printer.branchId,
          'CROSS_BRANCH_ACCESS_DENIED',
          scopeCheckExisting.error || 'Cross-branch printer edit blocked.'
        );
        return res.status(403).json({ error: scopeCheckExisting.error });
      }

      const {
        name,
        branchId,
        registerId,
        station,
        role,
        connectionType,
        ip,
        port,
        paperWidth,
        enabled,
        autoCut,
        soundBuzzer,
        kickDrawer,
        categories,
        timeoutMs,
        retryAttempts,
      } = req.body;

      if (branchId) {
        const scopeCheckNew = checkBranchScope(currentStaff, branchId);
        if (!scopeCheckNew.allowed) {
          return res.status(403).json({ error: scopeCheckNew.error });
        }
        printer.branchId = branchId;
      }

      if (name) printer.name = name.trim();
      if (registerId !== undefined) printer.registerId = registerId || undefined;
      if (station) printer.station = station.trim();
      if (role) printer.role = role;
      if (connectionType) printer.connectionType = connectionType;

      if (connectionType === 'network_ip' || (!connectionType && printer.connectionType === 'network_ip')) {
        const checkIp = ip || printer.ip;
        const checkPort = port !== undefined ? port : printer.port;
        const addrCheck = validatePrinterAddress(checkIp, checkPort);
        if (!addrCheck.valid) {
          return res.status(400).json({ error: addrCheck.error });
        }
        printer.ip = checkIp.trim();
        printer.port = Number(checkPort);
      }

      if (paperWidth) printer.paperWidth = paperWidth === '58mm' ? '58mm' : '80mm';
      if (enabled !== undefined) printer.enabled = Boolean(enabled);
      if (autoCut !== undefined) printer.autoCut = Boolean(autoCut);
      if (soundBuzzer !== undefined) printer.soundBuzzer = Boolean(soundBuzzer);
      if (kickDrawer !== undefined) printer.kickDrawer = Boolean(kickDrawer);
      if (categories !== undefined) printer.categories = Array.isArray(categories) ? categories : [];
      if (timeoutMs !== undefined) printer.timeoutMs = Number(timeoutMs);
      if (retryAttempts !== undefined) printer.retryAttempts = Number(retryAttempts);

      printer.updatedAt = new Date().toISOString();
      printer.updatedBy = currentStaff?.name || 'Staff User';

      saveDatabaseSync();

      logAuditEvent(
        currentStaff?.name || 'Staff',
        currentStaff?.role || 'admin',
        printer.branchId,
        'PRINTER_UPDATED',
        `Updated printer configuration for '${printer.name}' (${printer.id})`
      );

      res.json({ success: true, printer });
    }
  );

  // Delete printer
  router.delete(
    '/:id',
    requireAuth,
    requirePermission('hardware.printers.manage'),
    (req: Request, res: Response) => {
      const printer = (db.printers || {})[req.params.id];
      if (!printer) {
        return res.status(404).json({ error: 'Printer profile not found.' });
      }

      const currentStaff = (req as any).staff;
      const scopeCheck = checkBranchScope(currentStaff, printer.branchId);
      if (!scopeCheck.allowed) {
        logAuditEvent(
          currentStaff?.name || 'Staff',
          currentStaff?.role || 'unknown',
          printer.branchId,
          'CROSS_BRANCH_ACCESS_DENIED',
          scopeCheck.error || 'Cross-branch printer deletion blocked.'
        );
        return res.status(403).json({ error: scopeCheck.error });
      }

      delete db.printers[req.params.id];
      saveDatabaseSync();

      logAuditEvent(
        currentStaff?.name || 'Staff',
        currentStaff?.role || 'admin',
        printer.branchId,
        'PRINTER_DELETED',
        `Removed printer '${printer.name}' (${printer.id})`
      );

      res.json({ success: true, message: `Printer '${printer.name}' successfully deleted.` });
    }
  );

  // Toggle printer active/inactive
  router.post(
    '/:id/toggle',
    requireAuth,
    requirePermission('hardware.printers.manage'),
    (req: Request, res: Response) => {
      const printer = (db.printers || {})[req.params.id];
      if (!printer) {
        return res.status(404).json({ error: 'Printer profile not found.' });
      }

      const currentStaff = (req as any).staff;
      const scopeCheck = checkBranchScope(currentStaff, printer.branchId);
      if (!scopeCheck.allowed) {
        return res.status(403).json({ error: scopeCheck.error });
      }

      printer.enabled = !printer.enabled;
      printer.updatedAt = new Date().toISOString();
      saveDatabaseSync();

      logAuditEvent(
        currentStaff?.name || 'Staff',
        currentStaff?.role || 'admin',
        printer.branchId,
        'PRINTER_TOGGLED',
        `Toggled printer '${printer.name}' (${printer.id}) to ${printer.enabled ? 'ENABLED' : 'DISABLED'}`
      );

      res.json({ success: true, enabled: printer.enabled });
    }
  );

  return router;
}
