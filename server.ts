import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  loadDatabase,
  saveDatabase,
  saveDatabaseSync,
  getDb,
  seedCmsAndMenuCatalogue,
} from './server_db.ts';
import { dispatchTermiiSms } from './server_notifications.ts';
import { createPrinterRouter } from './server_printers.ts';
import { createPaymentRouter } from './server_payments.ts';
import { createShiftReconciliationRouter } from './server/services/shiftReconciliationService.ts';
import { startBackgroundStockMonitor } from './server/services/stockAlertService.ts';
import { createStockAlertRouter } from './server/routes/stockAlertRouter.ts';
import {
  hashPasswordBcrypt,
  validateStaffPasswordPolicy,
  verifyStaffPassword,
  createAuthAndRbacHelpers,
} from './server/middleware/authAndRbac.ts';
import { createAuthAndHealthRouter } from './server/routes/authAndHealthRouter.ts';
import { createStaffAndRbacRouter } from './server/routes/staffAndRbacRouter.ts';
import { createCmsAndMenuRouter } from './server/routes/cmsAndMenuRouter.ts';
import { createCustomerNotificationDispatcher } from './server/services/customerNotificationService.ts';
import { createNotificationsAndTablesRouter } from './server/routes/notificationsAndTablesRouter.ts';
import { createOnlineOrdersAndCustomerRouter } from './server/routes/onlineOrdersAndCustomerRouter.ts';
import {
  createOrderInventoryDepleter,
  createOrderInventoryReverser,
  createPosChecksAndOfflineRouter,
} from './server/routes/posChecksAndOfflineRouter.ts';
import { createKdsAndShiftsRouter } from './server/routes/kdsAndShiftsRouter.ts';
import { createDispatchRouter } from './server/routes/dispatchRouter.ts';
import { createInventoryItemsRouter } from './server/routes/inventoryItemsRouter.ts';
import { createProcurementAndLedgerRouter } from './server/routes/procurementAndLedgerRouter.ts';
import { createAssetsAndReportsRouter } from './server/routes/assetsAndReportsRouter.ts';
import { createLoyaltyAndCateringRouter } from './server/routes/loyaltyAndCateringRouter.ts';
import { createSystemSettingsRouter } from './server/routes/systemSettingsRouter.ts';
import { createReconciliationRouter } from './server/routes/reconciliationRouter.ts';
import { createExpenseClaimsRouter } from './server/routes/expenseClaimsRouter.ts';
import { createBulkImportAndMigrationRouter } from './server/routes/bulkImportAndMigrationRouter.ts';
import { createFinancialManagementRouter } from './server/routes/financialManagementRouter.ts';
import { createPromotionsRouter } from './server/routes/promotionsAndCfdRouter.ts';
import { createEnterpriseReportsRouter } from './server/routes/enterpriseReportsRouter.ts';
import { initializePostgreSQLDatabase } from './server/db/db.ts';
import { staffRepository } from './server/repositories/staffRepository.ts';
import { auditRepository } from './server/repositories/auditRepository.ts';
import { sessionRepository } from './server/repositories/sessionRepository.ts';
import { rbacRepository } from './server/repositories/rbacRepository.ts';
import { branchRepository } from './server/repositories/branchRepository.ts';
import { resetTokenRepository } from './server/repositories/resetTokenRepository.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.trim().length < 32)) {
  throw new Error(
    'FATAL SECURITY CONFIGURATION ERROR: SESSION_SECRET environment variable (>= 32 characters) must be explicitly set when NODE_ENV=production.'
  );
}
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  'choplife_dev_ephemeral_session_secret_' + crypto.randomBytes(16).toString('hex');

// Load persistent DB
let db = loadDatabase();
if (db.sessions && db.sessions['choplife_canonical_admin_session']) {
  delete db.sessions['choplife_canonical_admin_session'];
  saveDatabaseSync();
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));

// Security Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const cspHeader =
    process.env.CSP_HEADER_VALUE ||
    "frame-ancestors 'self' https://*.google.com https://aistudio.google.com https://localhost.corp.google.com:26001;";
  res.setHeader('Content-Security-Policy', cspHeader);
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Cache-Control for sensitive API endpoints
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Ensure uploads directory exists and serve static assets from /uploads
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Core Auth, Session & RBAC Helpers
const {
  logAuditEvent,
  getSessionFromRequest,
  requireAuth,
  requireRole,
  getStaffPrivileges,
  hasPermission,
  requirePermission,
  requireBranchAccess,
} = createAuthAndRbacHelpers({
  getDb,
  saveDatabase,
  staffRepository,
  auditRepository,
  sessionRepository,
  rbacRepository,
}) as any;

// Customer Notification Dispatcher & Recipe BOM Depleter
const sendCustomerNotification = createCustomerNotificationDispatcher({
  getDb,
  saveDatabaseSync,
});

const depleteInventoryForOrder = createOrderInventoryDepleter({
  getDb,
  saveDatabaseSync,
  logAuditEvent,
});

const reverseInventoryForOrder = createOrderInventoryReverser({
  getDb,
  saveDatabaseSync,
  logAuditEvent,
});

// 1 & 2. Health, Provisioning, and Staff Authentication
app.use(
  createAuthAndHealthRouter({
    getDb,
    reloadDb: () => {
      db = loadDatabase();
      return db;
    },
    saveDatabase,
    saveDatabaseSync,
    port: PORT,
    requireAuth,
    requireRole,
    getSessionFromRequest,
    getStaffPrivileges,
    logAuditEvent,
    staffRepository,
    sessionRepository,
    resetTokenRepository,
    branchRepository,
    db,
  })
);

// 3. Staff, Branches, RBAC, CMS & Menu Catalogue
app.use(
  createStaffAndRbacRouter({
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireRole,
    requirePermission,
    logAuditEvent,
    hashPasswordBcrypt,
    verifyStaffPassword,
    validateStaffPasswordPolicy,
    getStaffPrivileges,
    staffRepository,
    sessionRepository,
    rbacRepository,
    branchRepository,
  })
);

app.use('/api', createPromotionsRouter());

app.use(
  createCmsAndMenuRouter({
    getDb,
    saveDatabaseSync,
    seedCmsAndMenuCatalogue,
    requireAuth,
    hasPermission,
    logAuditEvent,
    uploadsDir: UPLOADS_DIR,
  })
);

// 3.6, 4 & 4.4. Waivers, Restaurant Tables, Reservations, Notifications & Gateways
app.use(
  createNotificationsAndTablesRouter({
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireRole,
    requirePermission,
    requireBranchAccess,
    sendCustomerNotification,
    logAuditEvent,
  })
);

// Payments & Paystack Webhooks
app.use(
  createPaymentRouter({
    getDb,
    saveDatabaseSync,
    getSessionFromRequest,
    logAuditEvent,
    sendCustomerNotification,
    staffRepository,
    hasPermission,
  })
);

// 4.5. Online Orders, Customer OTP/Profile & Manager Override
app.use(
  createOnlineOrdersAndCustomerRouter({
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireBranchAccess,
    getSessionFromRequest,
    depleteInventoryForOrder,
    reverseInventoryForOrder,
    sendCustomerNotification,
    logAuditEvent,
    staffRepository,
  })
);

// 5 & 4.3B. POS Open Checks, Settlements, Offline Sync & Table Transfers
app.use(
  createPosChecksAndOfflineRouter({
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireBranchAccess,
    depleteInventoryForOrder,
    reverseInventoryForOrder,
    logAuditEvent,
    staffRepository,
  })
);

// 4.3C. Hardware Printers & Receipt Templates
const printerRouter = createPrinterRouter(requireAuth, requireRole, requirePermission, logAuditEvent);
app.use('/api/pos/printers', printerRouter);
app.post(
  '/api/hardware/printer/print-raw',
  requireAuth,
  requireRole(['super_admin', 'corporate_admin', 'store_manager', 'branch_manager', 'cashier', 'kitchen_lead']),
  (req, res, next) => {
    req.url = '/network-print';
    printerRouter(req, res, next);
  }
);

// 4.3D, 6 & 7. Barcode Scan Dispatch, Kitchen Display System (KDS) & Shift Management
app.use(
  createKdsAndShiftsRouter({
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireRole,
    requireBranchAccess,
    sendCustomerNotification,
    logAuditEvent,
  })
);

// 8–12. Shift Reconciliation, Stock Reorder Alerts, Dispatch, Inventory, Procurement, Assets/Reports & Loyalty/Catering
app.use(
  createShiftReconciliationRouter({
    getDb,
    requireAuth,
  })
);

app.use(createStockAlertRouter({
  getDb,
  saveDatabaseSync,
  requireAuth,
  dispatchTermiiSms,
  logAuditEvent,
}));

startBackgroundStockMonitor({
  getDb,
  saveDatabaseSync,
  dispatchTermiiSms,
});

app.use(
  createDispatchRouter({
    requireAuth,
    requireBranchAccess,
    requireRole,
    sendCustomerNotification,
    logAuditEvent,
    hasPermission,
  })
);

app.use(
  createInventoryItemsRouter({
    requireAuth,
    requireRole,
    logAuditEvent,
    hasPermission,
  })
);

app.use(
  createProcurementAndLedgerRouter({
    requireAuth,
    requireRole,
    logAuditEvent,
    hasPermission,
  })
);

app.use(
  createAssetsAndReportsRouter({
    requireAuth,
    requireBranchAccess,
    requireRole,
    logAuditEvent,
  })
);

app.use(
  createLoyaltyAndCateringRouter({
    requireAuth,
    requireBranchAccess,
    requireRole,
    logAuditEvent,
    hasPermission,
  })
);

// 13. System Settings, Configuration & Governance Hub (Modules A–J)
app.use(
  createSystemSettingsRouter({
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireRole,
    logAuditEvent,
  })
);

app.use(
  createReconciliationRouter({
    getDb,
    saveDatabaseSync,
    getSessionFromRequest,
    sendCustomerNotification,
    logAuditEvent,
    staffRepository,
    hasPermission,
  })
);

app.use(
  createExpenseClaimsRouter({
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireRole,
    hasPermission,
    logAuditEvent,
  })
);

app.use(
  createBulkImportAndMigrationRouter({
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireRole,
    logAuditEvent,
    hasPermission,
  })
);

app.use(
  createFinancialManagementRouter({
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireRole,
    hasPermission,
    logAuditEvent,
  })
);

app.use(
  createEnterpriseReportsRouter({
    getDb,
    saveDatabaseSync,
    requireAuth,
    hasPermission,
    logAuditEvent,
  })
);

// Explicit 404 JSON response for unhandled /api/* routes so API calls never return the Vite HTML SPA shell
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found', path: _req.path });
});

// Central API Error Handler
app.use('/api', (err: any, req: any, res: any, next: any) => {
  console.error('[API ERROR HANDLER]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error.' : err.message || 'An error occurred.',
  });
});

// Vite Middleware & Server Startup
async function startServer() {
  await initializePostgreSQLDatabase();
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  function listen(port: number) {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`[SERVER] ChopLife Operations Server listening on http://0.0.0.0:${port}`);
    });
    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        console.log(`[SERVER] Port ${port} in use, trying ${port + 1}...`);
        listen(port + 1);
      } else {
        console.error(e);
      }
    });
  }
  listen(PORT);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
