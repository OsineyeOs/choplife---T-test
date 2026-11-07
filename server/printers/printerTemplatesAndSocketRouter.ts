import { Router } from 'express';
import type { Request, Response } from 'express';
import net from 'net';
import crypto from 'crypto';
import {
  getDb,
  saveDatabaseSync,
  DEFAULT_RECEIPT_TEMPLATES,
} from '../../server_db.ts';
import type {
  DbReceiptTemplate,
  DbPrintJobRecord,
} from '../../server_db.ts';

// Helper: Validate IP and Port with SSRF guard
export function validatePrinterAddress(ip: string, port: number = 9100): { valid: boolean; error?: string } {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'Printer IP address or hostname is required.' };
  }

  const trimmedIp = ip.trim();

  if (
    trimmedIp === '169.254.169.254' ||
    trimmedIp.startsWith('169.254.') ||
    trimmedIp === '0.0.0.0' ||
    trimmedIp === '::'
  ) {
    return { valid: false, error: 'Restricted IP address. Cloud metadata and loopback destinations are forbidden.' };
  }

  const portNum = Number(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, error: 'Invalid printer port number. Must be between 1 and 65535.' };
  }

  if (trimmedIp !== 'localhost') {
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = trimmedIp.match(ipv4Regex);
    if (!match) {
      return { valid: false, error: 'Invalid IPv4 address format. Must be four dot-separated octets (e.g. 192.168.1.100).' };
    }

    const octets = match.slice(1, 5).map(Number);
    if (octets.some((o) => o > 255)) {
      return { valid: false, error: 'Invalid IPv4 octet value.' };
    }

    const isPrivate =
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      trimmedIp === '127.0.0.1';

    if (!isPrivate) {
      return {
        valid: false,
        error: 'Printer destination must reside on a private local area network (192.168.x.x, 10.x.x.x, or 172.16-31.x.x). Arbitrary public WAN IPs are blocked.',
      };
    }
  }

  return { valid: true };
}

// Helper: Enforce branch scope isolation
export function checkBranchScope(staff: any, targetBranchId?: string): { allowed: boolean; error?: string } {
  if (!staff) return { allowed: false, error: 'Unauthorized.' };
  if (staff.role === 'super_admin' || staff.role === 'admin' || staff.role === 'corporate_admin') {
    return { allowed: true };
  }
  if (!staff.branchId || staff.branchId === 'all') return { allowed: true };
  if (!targetBranchId || targetBranchId === 'all') return { allowed: true };

  const allowedBranches = Array.from(new Set([staff.branchId, ...(staff.allowedBranchIds || [])]));
  if (!allowedBranches.includes(targetBranchId)) {
    return {
      allowed: false,
      error: `Forbidden: Cross-branch modification denied. Staff member is assigned to [${allowedBranches.join(', ')}] and cannot modify branch '${targetBranchId}'.`,
    };
  }
  return { allowed: true };
}

export function createPrinterTemplatesAndSocketRouter(
  requireAuth: any,
  requireRole: any,
  requirePermission: any,
  logAuditEvent: any
): Router {
  const router = Router();
  const db = getDb();

  // Network Printer Ping
  router.post(
    '/network-ping',
    requireAuth,
    requirePermission('hardware.printers.test'),
    async (req: Request, res: Response) => {
      const { ip, port = 9100, timeout = 2500 } = req.body;
      const addrCheck = validatePrinterAddress(ip, port);
      if (!addrCheck.valid) {
        return res.status(400).json({ error: addrCheck.error, online: false });
      }

      const startTime = Date.now();
      const socket = new net.Socket();
      let finished = false;

      socket.setTimeout(Number(timeout) || 2500);

      socket.on('connect', () => {
        if (finished) return;
        finished = true;
        const latencyMs = Date.now() - startTime;
        socket.destroy();
        return res.json({
          success: true,
          online: true,
          latencyMs,
          ip,
          port,
          message: `Thermal printer socket reachable at ${ip}:${port} (${latencyMs}ms)`,
        });
      });

      socket.on('timeout', () => {
        if (finished) return;
        finished = true;
        socket.destroy();
        return res.json({
          success: true,
          online: false,
          latencyMs: Date.now() - startTime,
          ip,
          port,
          message: `Connection timed out after ${timeout}ms. Printer at ${ip}:${port} is unreachable.`,
        });
      });

      socket.on('error', (err) => {
        if (finished) return;
        finished = true;
        socket.destroy();
        return res.json({
          success: true,
          online: false,
          latencyMs: Date.now() - startTime,
          ip,
          port,
          message: `Physical printer offline (${err.message}). Printer at ${ip}:${port} is unreachable.`,
        });
      });

      try {
        socket.connect(Number(port), String(ip));
      } catch (e: any) {
        if (!finished) {
          finished = true;
          return res.status(500).json({
            success: false,
            online: false,
            ip,
            port,
            error: e.message,
          });
        }
      }
    }
  );

  // Network Print Raw ESC/POS Stream
  router.post(
    '/network-print',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'store_manager', 'branch_manager', 'cashier', 'kitchen_lead']),
    (req: Request, res: Response) => {
      const targetIp = req.body.ip || req.body.printerIp;
      const {
        port = 9100,
        printerName = 'Network Thermal Printer',
        jobType = 'customer_receipt',
        hexData = '',
        printerId,
        branchId = 'gra',
        orderNumber,
        checkId,
      } = req.body;

      // Enforce payment confirmation before printing kitchen production tickets or paid customer receipts
      if ((jobType === 'kitchen_ticket' || jobType === 'customer_receipt') && (orderNumber || checkId)) {
        const matchedCheck =
          (checkId && db.checks?.[checkId]) ||
          Object.values(db.checks || {}).find(
            (c: any) => c.checkNumber === orderNumber || c.id === orderNumber || c.orderId === orderNumber
          );
        const matchedOrder =
          (orderNumber && db.orders?.[orderNumber]) ||
          Object.values(db.orders || {}).find((o: any) => o.orderNumber === orderNumber || o.id === orderNumber);

        const isPaid =
          (matchedCheck && matchedCheck.paymentStatus === 'paid') ||
          (matchedOrder && matchedOrder.paymentStatus === 'paid');

        if ((matchedCheck || matchedOrder) && !isPaid) {
          return res.status(409).json({
            error: `Cannot print '${jobType}' for unpaid order/check '${orderNumber || checkId}'. Only a pro-forma bill ('proforma_non_payment_bill') may be printed before payment is confirmed.`,
            delivered: false,
          });
        }
      }

      const addrCheck = validatePrinterAddress(targetIp, port);
      if (!addrCheck.valid) {
        return res.status(400).json({ error: addrCheck.error, delivered: false });
      }

      if (hexData) {
        const sanitizedHex = hexData.replace(/\s+/g, '');
        if (!/^[0-9a-fA-F]*$/.test(sanitizedHex)) {
          return res.status(400).json({ error: 'Malformed hexData for ESC/POS printer stream.' });
        }
        if (sanitizedHex.length > 65536) {
          return res.status(400).json({ error: 'ESC/POS payload exceeds 32KB maximum printer buffer size.' });
        }
      }

      const rawBytes = hexData ? Buffer.from(hexData.replace(/\s+/g, ''), 'hex') : Buffer.from('TEST ESC/POS PRINT\n\n\n');
      const startTime = Date.now();
      const currentStaff = (req as any).staff;

      const socket = new net.Socket();
      let responded = false;

      socket.setTimeout(2500);

      socket.on('connect', () => {
        socket.write(rawBytes, () => {
          if (!responded) {
            responded = true;
            socket.end();

            const jobRecord: DbPrintJobRecord = {
              id: `job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
              printerId,
              printerName,
              branchId,
              docType: jobType,
              orderNumber,
              bytesCount: rawBytes.length,
              transport: 'network_ip',
              status: 'transmitted',
              createdAt: new Date().toISOString(),
              createdBy: currentStaff?.name || 'Staff User',
            };

            db.printJobs = db.printJobs || [];
            db.printJobs.unshift(jobRecord);
            if (db.printJobs.length > 200) db.printJobs.pop();

            if (printerId && db.printers && db.printers[printerId]) {
              db.printers[printerId].lastTestStatus = 'bytes_transmitted';
              db.printers[printerId].lastTestTimestamp = new Date().toISOString();
              db.printers[printerId].lastErrorMessage = undefined;
            }
            saveDatabaseSync();

            return res.json({
              success: true,
              delivered: true,
              bytesTransmitted: rawBytes.length,
              physicallyAcknowledged: false,
              printerName,
              ip: targetIp,
              port,
              latencyMs: Date.now() - startTime,
              message: `Successfully transmitted ${rawBytes.length} ESC/POS bytes to socket ${targetIp}:${port}`,
            });
          }
        });
      });

      const handleFailure = (reason: string, statusCode: number = 502) => {
        if (responded) return;
        responded = true;
        socket.destroy();

        const jobRecord: DbPrintJobRecord = {
          id: `job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          printerId,
          printerName,
          branchId,
          docType: jobType,
          orderNumber,
          bytesCount: rawBytes.length,
          transport: 'network_ip',
          status: 'failed',
          errorMessage: reason,
          createdAt: new Date().toISOString(),
          createdBy: currentStaff?.name || 'Staff User',
        };

        db.printJobs = db.printJobs || [];
        db.printJobs.unshift(jobRecord);
        if (db.printJobs.length > 200) db.printJobs.pop();

        if (printerId && db.printers && db.printers[printerId]) {
          db.printers[printerId].lastTestStatus = 'offline_unreachable';
          db.printers[printerId].lastTestTimestamp = new Date().toISOString();
          db.printers[printerId].lastErrorMessage = reason;
        }
        saveDatabaseSync();

        return res.status(statusCode).json({
          success: false,
          delivered: false,
          printerName,
          ip: targetIp,
          port,
          error: `Physical printer unreachable at ${targetIp}:${port} (${reason}). Ensure device is powered on and reachable on branch LAN.`,
        });
      };

      socket.on('timeout', () => handleFailure('Timeout after 2500ms', 504));
      socket.on('error', (err) => handleFailure(err.message, 502));

      try {
        socket.connect(Number(port), String(targetIp));
      } catch (e: any) {
        handleFailure(e.message, 500);
      }
    }
  );

  // Trigger cash drawer kick peripheral
  router.post(
    '/kick-drawer',
    requireAuth,
    requirePermission('pos.check.settle'),
    (req: Request, res: Response) => {
      const { branchId = 'gra', registerId = 'POS-REG-01', reason = 'Manual Cashier Opening' } = req.body;
      const currentStaff = (req as any).staff;

      logAuditEvent(
        currentStaff?.name || 'Staff',
        currentStaff?.role || 'cashier',
        branchId,
        'CASH_DRAWER_KICK',
        `Cash drawer opened manually at register ${registerId}. Reason: ${reason}`
      );

      res.json({
        success: true,
        pulseCommandHex: '1014010101',
        message: 'Cash drawer kick command generated and authorized.',
        timestamp: new Date().toISOString(),
      });
    }
  );

  // List all templates
  router.get(
    '/templates',
    requireAuth,
    requirePermission('hardware.printers.view'),
    (req: Request, res: Response) => {
      const { branchId, docType } = req.query;
      let templates = Object.values(db.receiptTemplates || {});
      if (branchId && branchId !== 'all') {
        templates = templates.filter((t) => t.branchId === branchId || t.branchId === 'all');
      }
      if (docType) {
        templates = templates.filter((t) => t.docType === docType);
      }
      res.json({ success: true, templates });
    }
  );

  // Get template by ID
  router.get(
    '/templates/:id',
    requireAuth,
    requirePermission('hardware.printers.view'),
    (req: Request, res: Response) => {
      const template = (db.receiptTemplates || {})[req.params.id];
      if (!template) {
        return res.status(404).json({ error: 'Receipt template not found.' });
      }
      res.json({ success: true, template });
    }
  );

  // Save / Update template
  router.put(
    '/templates/:id',
    requireAuth,
    requirePermission('hardware.templates.edit'),
    (req: Request, res: Response) => {
      const currentStaff = (req as any).staff;
      const templateId = req.params.id;
      const incoming = req.body || {};

      db.receiptTemplates = db.receiptTemplates || {};
      const existing = db.receiptTemplates[templateId];
      const defaultTmpl = DEFAULT_RECEIPT_TEMPLATES[templateId];
      if (!existing && !defaultTmpl) {
        return res.status(404).json({ error: 'Receipt template not found.' });
      }

      const mergedBrandName = incoming.brandName ?? existing?.brandName ?? defaultTmpl?.brandName;
      const mergedName = incoming.name ?? existing?.name ?? defaultTmpl?.name;
      if (!mergedBrandName || !mergedName) {
        return res.status(400).json({ error: 'Brand name and template name are required.' });
      }

      const targetBranchId = incoming.branchId || existing?.branchId || 'all';
      const scopeCheck = checkBranchScope(currentStaff, targetBranchId);
      if (!scopeCheck.allowed) {
        logAuditEvent(
          currentStaff?.name || 'Staff',
          currentStaff?.role || 'unknown',
          targetBranchId,
          'CROSS_BRANCH_ACCESS_DENIED',
          scopeCheck.error || 'Cross-branch template update blocked.'
        );
        return res.status(403).json({ error: scopeCheck.error });
      }

      const beforeSnapshot = existing ? {
        brandName: existing.brandName,
        tagline: existing.tagline,
        paperWidth: existing.paperWidth,
        thankYouMessage: existing.thankYouMessage,
        customHeaderMessage: existing.customHeaderMessage,
      } : {};

      const updatedTemplate: DbReceiptTemplate = {
        ...(existing || DEFAULT_RECEIPT_TEMPLATES[templateId] || {}),
        ...incoming,
        id: templateId,
        updatedAt: new Date().toISOString(),
        updatedBy: currentStaff?.name || 'Staff User',
      };

      db.receiptTemplates[templateId] = updatedTemplate;
      saveDatabaseSync();

      logAuditEvent(
        currentStaff?.name || 'Staff',
        currentStaff?.role || 'admin',
        targetBranchId,
        'RECEIPT_TEMPLATE_UPDATED',
        `Updated receipt template '${updatedTemplate.name}' (${templateId}) for document type ${updatedTemplate.docType}`,
        {
          templateId,
          before: beforeSnapshot,
          after: {
            brandName: updatedTemplate.brandName,
            tagline: updatedTemplate.tagline,
            paperWidth: updatedTemplate.paperWidth,
            thankYouMessage: updatedTemplate.thankYouMessage,
            customHeaderMessage: updatedTemplate.customHeaderMessage,
          },
        }
      );

      res.json({ success: true, template: updatedTemplate });
    }
  );

  // Reset template to default
  router.post(
    '/templates/:id/reset',
    requireAuth,
    requirePermission('hardware.templates.reset'),
    (req: Request, res: Response) => {
      const templateId = req.params.id;
      const defaultTmpl = DEFAULT_RECEIPT_TEMPLATES[templateId];

      if (!defaultTmpl) {
        return res.status(404).json({ error: 'No default specification exists for this template ID.' });
      }

      const currentStaff = (req as any).staff;
      db.receiptTemplates = db.receiptTemplates || {};
      const existing = db.receiptTemplates[templateId];
      const scopeCheck = checkBranchScope(currentStaff, existing?.branchId || 'all');
      if (!scopeCheck.allowed) {
        return res.status(403).json({ error: scopeCheck.error });
      }

      db.receiptTemplates[templateId] = JSON.parse(JSON.stringify(defaultTmpl));
      db.receiptTemplates[templateId].updatedAt = new Date().toISOString();
      db.receiptTemplates[templateId].updatedBy = `${currentStaff?.name || 'Staff'} (Reset to Default)`;

      saveDatabaseSync();

      logAuditEvent(
        currentStaff?.name || 'Staff',
        currentStaff?.role || 'admin',
        'all',
        'RECEIPT_TEMPLATE_RESET',
        `Restored receipt template '${defaultTmpl.name}' (${templateId}) to approved defaults`
      );

      res.json({ success: true, template: db.receiptTemplates[templateId] });
    }
  );

  // View Recent Print Jobs
  router.get(
    '/jobs',
    requireAuth,
    requirePermission('hardware.printers.view'),
    (_req: Request, res: Response) => {
      const jobs = (db.printJobs || []).slice(0, 50);
      res.json({ success: true, jobs });
    }
  );

  return router;
}
