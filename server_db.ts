import fs from 'fs';
import path from 'path';
import {
  INITIAL_CANONICAL_INVENTORY,
  INITIAL_SUPPLIERS,
  INITIAL_RECIPES_BOM,
  INITIAL_STOCK_REQUESTS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_GOODS_RECEIPT_NOTES,
  INITIAL_STOCK_LEDGER,
  INITIAL_WASTAGE_RECORDS,
} from './src/data/inventoryMaster.ts';
import {
  DEFAULT_STAFF_ACCOUNTS,
  DEFAULT_RIDERS,
  AUTHORITATIVE_BRANCHES,
  CANONICAL_FIXED_ASSETS,
  DEFAULT_RECEIPT_TEMPLATES,
} from './server/db/canonicalSeeds.ts';
import type { DbDatabase } from './server/db/schemaTypes.ts';
import {
  generateInitialTables,
  seedInitialDataForDb,
  seedRolesForDb,
  seedStaffAccountsForDb,
  seedBranchesForDb,
  seedFixedAssetsForDb,
  seedReceiptTemplatesForDb,
  seedCmsAndMenuCatalogueForDb,
  hashWalletPin,
  verifyWalletPin,
  sanitizeCustomerRecord,
  calculateLoyaltyPoints,
  awardOrderLoyaltyPointsIfEligible,
  reverseOrderLoyaltyPointsIfAwarded,
} from './server/db/seedAndLoyaltyHelpers.ts';

export * from './server/db/schemaTypes.ts';
export {
  DEFAULT_STAFF_ACCOUNTS,
  DEFAULT_STAFF_ACCOUNTS as defaultAccounts,
  DEFAULT_RIDERS,
  AUTHORITATIVE_BRANCHES,
  CANONICAL_FIXED_ASSETS,
  DEFAULT_RECEIPT_TEMPLATES,
  hashWalletPin,
  verifyWalletPin,
  sanitizeCustomerRecord,
  calculateLoyaltyPoints,
  awardOrderLoyaltyPointsIfEligible,
  reverseOrderLoyaltyPointsIfAwarded,
};
export { DEMO_CANONICAL_INVENTORY } from './src/data/demoInventoryCatalogue.ts';

const DB_FILE_PATH = process.env.CHOPLIFE_DB_FILE
  ? path.resolve(process.env.CHOPLIFE_DB_FILE)
  : path.join(process.cwd(), 'data', 'choplife_ops_db.json');

const dataDir = path.dirname(DB_FILE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export let db: DbDatabase = {
  version: 1,
  staff: {},
  sessions: {},
  resetTokens: {},
  auditLogs: [],
  tables: {},
  checks: {},
  orders: {},
  shifts: {},
  cashMovements: [],
  riders: {},
  deliveryTasks: {},
  heldTickets: {},
  inventory: {},
  ledger: [],
  requests: {},
  suppliers: {},
  purchaseOrders: {},
  goodsReceiptNotes: {},
  wastage: [],
  stockCounts: {},
  recipes: {},
  productionBatches: {},
  reconciliations: [],
  customerCareTickets: {},
  notifications: {},
  gatewayConfig: {
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
  },
  customers: {},
  walletTransactions: [],
  houseAccounts: {},
  houseAccountCharges: [],
  houseAccountPayments: [],
  cateringEvents: {},
  roles: {},
  branches: {},
  printers: {},
  receiptTemplates: {},
  printJobs: [],
  categories: {},
  menuProducts: {},
  stockAlerts: {},
  assets: {},
  expenseClaims: {},
  expenseAttachments: {},
  payrolls: {},
  capexRequisitions: {},
  supplierInvoices: {},
  expenditureBudgets: {},
  promotions: {},
};

export function seedRoles(): void {
  seedRolesForDb(db);
}

export function seedStaffAccounts(): void {
  seedStaffAccountsForDb(db);
}

export function seedBranches(): void {
  seedBranchesForDb(db);
}

export function seedFixedAssets(): void {
  seedFixedAssetsForDb(db);
}

export function seedReceiptTemplates(): void {
  seedReceiptTemplatesForDb(db);
}

export function seedCmsAndMenuCatalogue(): void {
  seedCmsAndMenuCatalogueForDb(db);
}

export function seedLoyaltyAndHouseAccounts(): void {
  if (db && db.customers) {
    let migrated = false;
    for (const cust of Object.values(db.customers) as any[]) {
      if (cust && cust.walletPin) {
        cust.walletPinHash = hashWalletPin(cust.walletPin);
        delete cust.walletPin;
        migrated = true;
      }
    }
    if (migrated) {
      saveDatabaseSync();
    }
  }
}

export function loadDatabase(): DbDatabase {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const rawData = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(rawData);
      for (const k of Object.keys(db)) {
        delete (db as any)[k];
      }
      Object.assign(db, {
        version: parsed.version || 1,
        staff: parsed.staff || {},
        sessions: parsed.sessions || {},
        resetTokens: parsed.resetTokens || {},
        auditLogs: parsed.auditLogs || [],
        tables: parsed.tables || {},
        checks: parsed.checks || {},
        orders: parsed.orders || {},
        shifts: parsed.shifts || {},
        cashMovements: parsed.cashMovements || [],
        riders: parsed.riders || {},
        deliveryTasks: parsed.deliveryTasks || {},
        heldTickets: parsed.heldTickets || {},
        inventory: parsed.inventory || {},
        ledger: parsed.ledger || [],
        requests: parsed.requests || {},
        suppliers: parsed.suppliers || {},
        purchaseOrders: parsed.purchaseOrders || {},
        goodsReceiptNotes: parsed.goodsReceiptNotes || {},
        wastage: parsed.wastage || [],
        stockCounts: parsed.stockCounts || {},
        recipes: parsed.recipes || {},
        productionBatches: parsed.productionBatches || {},
        reconciliations: parsed.reconciliations || [],
        customerCareTickets: parsed.customerCareTickets || {},
        notifications: parsed.notifications || {},
        gatewayConfig: parsed.gatewayConfig || {
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
        },
        customers: parsed.customers || {},
        walletTransactions: parsed.walletTransactions || [],
        houseAccounts: parsed.houseAccounts || {},
        houseAccountCharges: parsed.houseAccountCharges || [],
        houseAccountPayments: parsed.houseAccountPayments || [],
        cateringEvents: parsed.cateringEvents || {},
        roles: parsed.roles || {},
        branches: parsed.branches || {},
        printers: parsed.printers || {},
        receiptTemplates: parsed.receiptTemplates || {},
        printJobs: parsed.printJobs || [],
        paymentTransactions: parsed.paymentTransactions || {},
        processedWebhookEvents: parsed.processedWebhookEvents || {},
        accountingExportBatches: parsed.accountingExportBatches || [],
        categories: parsed.categories || {},
        menuProducts: parsed.menuProducts || {},
        cmsContent: parsed.cmsContent || undefined,
        stockAlerts: parsed.stockAlerts || {},
        assets: parsed.assets || {},
        expenseClaims: parsed.expenseClaims || {},
        expenseAttachments: parsed.expenseAttachments || {},
        settings: parsed.settings || undefined,
        payrolls: parsed.payrolls || {},
        capexRequisitions: parsed.capexRequisitions || {},
        supplierInvoices: parsed.supplierInvoices || {},
        expenditureBudgets: parsed.expenditureBudgets || {},
        promotions: parsed.promotions || {},
      });
      console.log(`[DB] Database loaded successfully from ${DB_FILE_PATH}. Staff count: ${Object.keys(db.staff).length}`);
    } else {
      console.log('[DB] No database file found. Initializing new canonical dataset...');
      seedInitialDataForDb(db);
      saveDatabaseSync();
    }
  } catch (err) {
    console.error('[DB] Error loading database file:', err);
    seedInitialDataForDb(db);
  }

  seedRoles();
  seedBranches();

  if (!db.settings) {
    db.settings = { operations: {} } as any;
  }
  if (!db.settings.operations) {
    db.settings.operations = {} as any;
  }
  if (!db.settings.operations.branchSchedules) {
    db.settings.operations.branchSchedules = {};
  }

  const bs = db.settings.operations.branchSchedules;
  let syncNeeded = false;

  if (!bs.gra || bs.gra.closeTime === '23:00' || bs.gra.closeTime !== '19:00' || !bs.gra.staffOpenTime) {
    bs.gra = {
      openTime: '08:00',
      closeTime: '19:00',
      staffOpenTime: '07:00',
      staffCloseTime: '19:00',
      operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      closedDays: [],
      isOperational: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      dineInEnabled: true,
      cateringEnabled: true,
      bakeryHours: '07:30–19:00',
      deliveryHours: '08:00–17:00',
    };
    syncNeeded = true;
  }

  if (!bs.okabere || bs.okabere.closeTime === '22:00' || bs.okabere.closeTime !== '21:00' || !bs.okabere.staffOpenTime) {
    bs.okabere = {
      openTime: '08:00',
      closeTime: '21:00',
      staffOpenTime: '06:30',
      staffCloseTime: '21:00',
      operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      closedDays: [],
      isOperational: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      dineInEnabled: true,
      cateringEnabled: false,
      bakeryHours: '08:00–20:30',
      deliveryHours: '08:00–17:00',
    };
    syncNeeded = true;
  }

  if (!bs.ugbowo || bs.ugbowo.closeTime === '22:00' || bs.ugbowo.closeTime !== '18:00' || !bs.ugbowo.staffOpenTime || !bs.ugbowo.closedDays?.includes('sunday')) {
    bs.ugbowo = {
      openTime: '08:00',
      closeTime: '18:00',
      staffOpenTime: '07:00',
      staffCloseTime: '18:00',
      operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      closedDays: ['sunday'],
      isOperational: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      dineInEnabled: true,
      cateringEnabled: false,
      bakeryHours: '08:00–18:00',
      deliveryHours: '08:00–17:00',
    };
    syncNeeded = true;
  }

  if (syncNeeded) {
    saveDatabaseSync();
  }

  seedFixedAssets();
  seedReceiptTemplates();
  seedLoyaltyAndHouseAccounts();
  seedCmsAndMenuCatalogue();

  if (Object.keys(db.tables).length === 0) {
    db.tables = generateInitialTables();
    saveDatabaseSync();
  }

  for (const item of INITIAL_CANONICAL_INVENTORY) {
    if (!db.inventory[item.id]) {
      const cloned = JSON.parse(JSON.stringify(item));
      if (process.env.ENABLE_DEMO_DATA !== 'true') {
        cloned.currentStock = { general_store: 0, gra: 0, okabere: 0, ugbowo: 0 };
        if (cloned.locationStock) {
          for (const loc of Object.keys(cloned.locationStock)) {
            cloned.locationStock[loc].stockOnHand = 0;
            cloned.locationStock[loc].availableStock = 0;
            cloned.locationStock[loc].reservedStock = 0;
          }
        }
      }
      db.inventory[item.id] = cloned;
    } else if (
      process.env.ENABLE_DEMO_DATA === 'true' &&
      db.inventory[item.id].locationStock?.gra?.stockOnHand === 0 &&
      item.locationStock?.gra?.stockOnHand > 0
    ) {
      db.inventory[item.id] = JSON.parse(JSON.stringify(item));
    }
  }
  if (Object.keys(db.suppliers).length === 0) {
    for (const sup of INITIAL_SUPPLIERS) {
      db.suppliers[sup.id] = JSON.parse(JSON.stringify(sup));
    }
  }
  if (Object.keys(db.recipes).length === 0) {
    for (const rec of INITIAL_RECIPES_BOM) {
      db.recipes[rec.id] = JSON.parse(JSON.stringify(rec));
    }
  }
  if (process.env.ENABLE_DEMO_DATA === 'true') {
    if (Object.keys(db.requests).length === 0) {
      for (const req of INITIAL_STOCK_REQUESTS) {
        db.requests[req.id] = JSON.parse(JSON.stringify(req));
      }
    }
    if (Object.keys(db.purchaseOrders).length === 0) {
      for (const po of INITIAL_PURCHASE_ORDERS) {
        db.purchaseOrders[po.id] = JSON.parse(JSON.stringify(po));
      }
    }
    if (Object.keys(db.goodsReceiptNotes).length === 0) {
      for (const grn of INITIAL_GOODS_RECEIPT_NOTES) {
        db.goodsReceiptNotes[grn.id] = JSON.parse(JSON.stringify(grn));
      }
    }
    if (db.ledger.length === 0) {
      db.ledger = JSON.parse(JSON.stringify(INITIAL_STOCK_LEDGER));
    }
    if (db.wastage.length === 0) {
      db.wastage = JSON.parse(JSON.stringify(INITIAL_WASTAGE_RECORDS));
    }
  }
  for (const rec of INITIAL_RECIPES_BOM) {
    if (!db.recipes[rec.id] || rec.id === 'recipe-sc-2000-mini') {
      db.recipes[rec.id] = JSON.parse(JSON.stringify(rec));
    }
  }

  seedStaffAccounts();
  saveDatabaseSync();

  return db;
}

let saveTimeout: NodeJS.Timeout | null = null;
let pgSyncInProgress = false;

export function saveDatabase(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDatabaseSync();
  }, 100);
}

export function saveDatabaseSync(): void {
  try {
    const tempPath = `${DB_FILE_PATH}.tmp.${Date.now()}`;
    const serialized = JSON.stringify(db, null, 2);
    fs.writeFileSync(tempPath, serialized, 'utf-8');
    fs.renameSync(tempPath, DB_FILE_PATH);
    if (!pgSyncInProgress) {
      pgSyncInProgress = true;
      import('./server/services/pgPersistenceSync.ts')
        .then(({ syncSnapshotToPostgres }) => syncSnapshotToPostgres(db))
        .catch((syncErr) => {
          console.error('[DB-AUTHORITY] Failed to synchronize state to PostgreSQL relational tables:', syncErr);
        })
        .finally(() => {
          pgSyncInProgress = false;
        });
    }
  } catch (err) {
    console.error('[DB] Failed to persist database to disk:', err);
  }
}

export function getDb(): DbDatabase {
  return db;
}
