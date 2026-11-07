/**
 * Choplife Republic — Safe Virgin-State Database Cleaner & Verifier
 *
 * Commands:
 *   npx tsx scripts/clean_virgin_database.ts --dry-run
 *   npx tsx scripts/clean_virgin_database.ts --verify-with-restore
 *   npx tsx scripts/clean_virgin_database.ts --execute
 *
 * Implements Phase 5 Safe Virgin-State Cleanup:
 * 1. Creates a verified backup before any destructive change.
 * 2. Preserves ALL canonical business configuration:
 *    - Branches (GRA, Okabere, Ugbowo)
 *    - Categories & all 200+ Menu Products, Combos, Packages, Platters, Discounts, and Promotions
 *    - All 39+ Canonical Inventory Definitions from INITIAL_CANONICAL_INVENTORY (including all 7 packaging SKUs inv-pack-300..inv-pack-2000 and finished goods)
 *    - Canonical Staff Accounts, RBAC Roles & Permissions, Suppliers, Fixed Assets, Receipt Templates, Expenditure Budgets, and CMS settings
 * 3. Purges only transient operational/test transactions (when --execute or --verify-with-restore is passed).
 * 4. Resets physical stock balances to 0 for canonical inventory items and resets all 66 dining tables to 'available'.
 * 5. Reports detailed before-and-after record counts and verifies zero orphan references.
 */

import fs from 'fs';
import path from 'path';
import { INITIAL_CANONICAL_INVENTORY } from '../src/data/inventoryMaster';
import { seedCmsAndMenuCatalogueForDb } from '../server/db/seedAndLoyaltyHelpers';

const DB_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');
const BACKUP_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.backup-before-virgin-clean.json');

export interface DatabaseCounts {
  branches: number;
  categories: number;
  products: number;
  packagesAndCombos: number;
  promotions: number;
  roles: number;
  staff: number;
  suppliers: number;
  inventoryItems: number;
  packagingInventoryItems: number;
  tables: number;
  availableTables: number;
  orders: number;
  checks: number;
  deliveryTasks: number;
  shifts: number;
  ledgerEntries: number;
  purchaseOrders: number;
  goodsReceiptNotes: number;
  expenseClaims: number;
  payrolls: number;
  capexRequisitions: number;
  supplierInvoices: number;
  reconciliations: number;
  customers: number;
  auditLogs: number;
}

export function collectCounts(db: any): DatabaseCounts {
  const productsMap = db.menuProducts || db.products || {};
  const categoriesMap = db.menuCategories || db.categories || {};
  const products = Object.values(productsMap) as any[];
  const inventory = Object.values(db.inventory || {}) as any[];
  const tables = Object.values(db.tables || {}) as any[];

  return {
    branches: Object.keys(db.branches || {}).length,
    categories: Object.keys(categoriesMap).length,
    products: products.length,
    packagesAndCombos: products.filter(
      (p) =>
        p.isPackage ||
        p.isCombo ||
        p.productType === 'package' ||
        p.productType === 'combo' ||
        p.productType === 'platter' ||
        (Array.isArray(p.components) && p.components.length > 0) ||
        (Array.isArray(p.packageComponents) && p.packageComponents.length > 0)
    ).length,
    promotions: Object.keys(db.promotions || {}).length,
    roles: Object.keys(db.roles || {}).length,
    staff: Object.keys(db.staff || {}).length,
    suppliers: Object.keys(db.suppliers || {}).length,
    inventoryItems: inventory.length,
    packagingInventoryItems: inventory.filter((i) => i.category === 'packaging' || String(i.id).startsWith('inv-pack-')).length,
    tables: tables.length,
    availableTables: tables.filter((t) => t.status === 'available').length,
    orders: Object.keys(db.orders || {}).length,
    checks: Object.keys(db.checks || {}).length,
    deliveryTasks: Object.keys(db.deliveryTasks || {}).length,
    shifts: Object.keys(db.shifts || {}).length,
    ledgerEntries: Array.isArray(db.ledger) ? db.ledger.length : 0,
    purchaseOrders: Object.keys(db.purchaseOrders || {}).length,
    goodsReceiptNotes: Object.keys(db.goodsReceiptNotes || {}).length,
    expenseClaims: Object.keys(db.expenseClaims || {}).length,
    payrolls: Object.keys(db.payrolls || {}).length,
    capexRequisitions: Object.keys(db.capexRequisitions || {}).length,
    supplierInvoices: Object.keys(db.supplierInvoices || {}).length,
    reconciliations: Array.isArray(db.reconciliations) ? db.reconciliations.length : 0,
    customers: Object.keys(db.customers || {}).length,
    auditLogs: Array.isArray(db.auditLogs) ? db.auditLogs.length : 0,
  };
}

export function performVirginCleanOnObject(db: any): {
  cleanedDb: any;
  beforeCounts: DatabaseCounts;
  afterCounts: DatabaseCounts;
  orphanPackageComponentRefs: string[];
  orphanPackagingSkuRefs: string[];
} {
  const beforeCounts = collectCounts(db);
  seedCmsAndMenuCatalogueForDb(db);
  const productsMap = db.menuProducts || db.products || {};

  // Build canonical inventory ID set from INITIAL_CANONICAL_INVENTORY
  const canonicalInventoryMap = new Map<string, any>();
  for (const item of INITIAL_CANONICAL_INVENTORY) {
    canonicalInventoryMap.set(item.id, item);
  }
  // Also preserve any inventory SKU referenced by any product's recipe/BOM or packagingInventoryItemId
  for (const prod of Object.values(productsMap) as any[]) {
    if (prod.packagingInventoryItemId && db.inventory?.[prod.packagingInventoryItemId]) {
      canonicalInventoryMap.set(prod.packagingInventoryItemId, db.inventory[prod.packagingInventoryItemId]);
    }
    if (prod.inventoryItemId && db.inventory?.[prod.inventoryItemId]) {
      canonicalInventoryMap.set(prod.inventoryItemId, db.inventory[prod.inventoryItemId]);
    }
    if (Array.isArray(prod.recipe)) {
      for (const line of prod.recipe) {
        if (line.inventoryItemId && db.inventory?.[line.inventoryItemId]) {
          canonicalInventoryMap.set(line.inventoryItemId, db.inventory[line.inventoryItemId]);
        }
      }
    }
  }

  // 1. Purge Operational Transactions
  db.orders = {};
  db.checks = {};
  db.shifts = {};
  db.cashMovements = [];
  db.paymentTransactions = {};
  db.processedWebhookEvents = {};
  db.accountingExportBatches = [];
  db.reconciliations = [];
  db.deliveryTasks = {};
  db.heldTickets = {};
  db.printJobs = [];

  // 2. Purge Procurement & Inventory Movements
  db.requests = {};
  db.purchaseOrders = {};
  db.goodsReceiptNotes = {};
  db.ledger = [];
  db.wastage = [];
  db.stockCounts = {};
  db.productionBatches = {};
  db.stockAlerts = {};
  db.processedDepletionRefs = {};

  // 3. Purge Test Financial Transactions (preserving expenditureBudgets, chart of accounts, and canonical assets)
  db.expenseClaims = {};
  db.payrolls = {};
  db.capexRequisitions = {};
  db.supplierInvoices = {};

  // 4. Purge Customer, Loyalty, Catering & Support Records
  db.customers = {};
  db.walletTransactions = [];
  db.houseAccounts = {};
  db.houseAccountCharges = [];
  db.houseAccountPayments = [];
  db.cateringEvents = {};
  db.customerCareTickets = {};
  db.notifications = {};

  // 5. Purge Sessions, Test Migration Batches & Test Audit Logs
  db.sessions = {};
  db.resetTokens = {};
  db.auditLogs = [];
  db.ezeeStagingBatches = {};
  db.ezeeMigrationBatches = {};

  // 6. Clean Inventory Items: Preserve all canonical inventory definitions & reset physical stock to 0
  const cleanedInventory: Record<string, any> = {};
  for (const [id, canonicalTemplate] of canonicalInventoryMap.entries()) {
    const existing = db.inventory?.[id] || canonicalTemplate;
    const copy = JSON.parse(JSON.stringify(existing));
    copy.currentStock = { general_store: 0, gra: 0, okabere: 0, ugbowo: 0 };
    if (copy.locationStock) {
      for (const loc of Object.keys(copy.locationStock)) {
        copy.locationStock[loc].stockOnHand = 0;
        copy.locationStock[loc].availableStock = 0;
        copy.locationStock[loc].reservedStock = 0;
      }
    }
    cleanedInventory[id] = copy;
  }
  db.inventory = cleanedInventory;

  // 7. Reset All Dining Tables to 'available'
  for (const table of Object.values(db.tables || {}) as any[]) {
    table.status = 'available';
    table.guestCount = 0;
    delete table.currentCheckId;
    table.updatedAt = new Date().toISOString();
  }

  // 8. Verify zero orphan references in products/packages
  const orphanPackageComponentRefs: string[] = [];
  const orphanPackagingSkuRefs: string[] = [];
  for (const prod of Object.values(productsMap) as any[]) {
    const comps = prod.components || prod.packageComponents || [];
    if (Array.isArray(comps)) {
      for (const comp of comps) {
        if (comp.productId && !productsMap[comp.productId]) {
          orphanPackageComponentRefs.push(`${prod.id} -> ${comp.productId}`);
        }
      }
    }
    if (prod.packaging?.productId && !productsMap[prod.packaging.productId]) {
      orphanPackagingSkuRefs.push(`${prod.id} -> ${prod.packaging.productId}`);
    }
    if (prod.packagingInventoryItemId && !db.inventory[prod.packagingInventoryItemId]) {
      orphanPackagingSkuRefs.push(`${prod.id} -> ${prod.packagingInventoryItemId}`);
    }
  }

  const afterCounts = collectCounts(db);
  return {
    cleanedDb: db,
    beforeCounts,
    afterCounts,
    orphanPackageComponentRefs,
    orphanPackagingSkuRefs,
  };
}

function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute') || args.includes('--confirm-virgin-clean');
  const isVerifyWithRestore = args.includes('--verify-with-restore');
  const mode = isExecute ? 'EXECUTE' : isVerifyWithRestore ? 'VERIFY_WITH_RESTORE' : 'DRY_RUN';

  const dbPathArg = args.find((a) => a.startsWith('--db-path='))?.split('=')[1];
  const backupPathArg = args.find((a) => a.startsWith('--backup-path='))?.split('=')[1];
  const targetDbPath = dbPathArg || DB_PATH;
  const targetBackupPath = backupPathArg || BACKUP_PATH;

  console.log(`=== Choplife Republic Virgin-State Database Cleaner [Mode: ${mode}] ===`);

  if (!fs.existsSync(targetDbPath)) {
    console.error('Database file not found at', targetDbPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(targetDbPath, 'utf-8');

  if (mode !== 'DRY_RUN') {
    fs.writeFileSync(targetBackupPath, raw, 'utf-8');
    const backupStat = fs.statSync(targetBackupPath);
    console.log(`[BACKUP VERIFIED] Saved ${backupStat.size.toLocaleString()} bytes to ${targetBackupPath}`);
  } else {
    console.log(`[DRY RUN] Read ${raw.length.toLocaleString()} bytes from ${targetDbPath} (no backup or disk writes performed in DRY_RUN mode)`);
  }

  const dbCopy = JSON.parse(raw);
  const { cleanedDb, beforeCounts, afterCounts, orphanPackageComponentRefs, orphanPackagingSkuRefs } =
    performVirginCleanOnObject(dbCopy);

  console.log('\n--- BEFORE vs AFTER RECORD COUNTS ---');
  console.table({
    Before: beforeCounts,
    After: afterCounts,
  });

  console.log(`Orphan Package Component References: ${orphanPackageComponentRefs.length}`);
  console.log(`Orphan Packaging SKU References:     ${orphanPackagingSkuRefs.length}`);

  if (isExecute) {
    fs.writeFileSync(targetDbPath, JSON.stringify(cleanedDb, null, 2), 'utf-8');
    console.log(`\n[EXECUTED] Virgin database written to ${targetDbPath}. Backup remains at ${targetBackupPath}.`);
  } else if (isVerifyWithRestore) {
    fs.writeFileSync(targetDbPath, JSON.stringify(cleanedDb, null, 2), 'utf-8');
    const verifiedDisk = JSON.parse(fs.readFileSync(targetDbPath, 'utf-8'));
    const diskCounts = collectCounts(verifiedDisk);
    // Immediately restore from backup so live unverified data is never lost
    fs.writeFileSync(targetDbPath, raw, 'utf-8');
    console.log(
      `\n[VERIFIED & RESTORED] Virgin cleanup verified on disk (Orders=${diskCounts.orders}, Checks=${diskCounts.checks}, Products=${diskCounts.products}, Packages=${diskCounts.packagesAndCombos}, Inventory=${diskCounts.inventoryItems}, PackagingSKUs=${diskCounts.packagingInventoryItems}) and original database restored from backup.`
    );
  } else {
    console.log('\n[DRY RUN COMPLETE] No changes written to live database. Pass --execute to persist or --verify-with-restore to test disk write + automatic backup restore.');
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('clean_virgin_database.ts')) {
  main();
}
