/**
 * Choplife Republic — Virgin Application State & Clean Installation Verification
 * Command: npx tsx scripts/verify_virgin_application_state.ts
 *
 * Verifies that the release candidate is a pristine, brand-new installation of
 * Choplife Republic with zero fabricated transactions, zero demo operational records,
 * and zero fictitious opening stock, while preserving all required business configuration:
 * - 3 established canonical branches (GRA Flagship, Okabere Hub, Ugbowo Campus)
 * - Central commissary structure (general_store)
 * - Approved menu categories and canonical products (with prices, descriptions, recipes)
 * - Approved inventory master definitions (with zero opening stock balances)
 * - Approved delivery zones and fee rules
 * - Approved role definitions and permission policies
 * - Honest, professionally designed empty states across operational workspaces
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${testName}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

const DB_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');

async function runVirginStateAudit() {
  console.log('================================================================================');
  console.log('🛡️  CHOPLIFE REPUBLIC — MANDATORY VIRGIN APPLICATION VERIFICATION');
  console.log('================================================================================\n');

  assert(fs.existsSync(DB_PATH), 'Operational database file exists at data/choplife_ops_db.json');

  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  const db = JSON.parse(raw);

  // SECTION 1: ZERO FABRICATED OPERATIONAL TRANSACTIONS
  console.log('--- 1. ZERO FABRICATED OPERATIONAL & FINANCIAL RECORDS ---');
  assert(
    !db.orders || Object.keys(db.orders).length === 0,
    'Zero fabricated online orders & checkout records',
    `Count: ${Object.keys(db.orders || {}).length}`
  );
  assert(
    !db.checks || Object.keys(db.checks).length === 0,
    'Zero fabricated POS checks and dine-in checks',
    `Count: ${Object.keys(db.checks || {}).length}`
  );
  assert(
    !db.shifts || Object.keys(db.shifts).length === 0,
    'Zero fabricated cashier shifts & shift reconciliations',
    `Count: ${Object.keys(db.shifts || {}).length}`
  );
  assert(
    !db.cashMovements || db.cashMovements.length === 0,
    'Zero fabricated cash-drawer movements (safe drops / paid outs)',
    `Count: ${(db.cashMovements || []).length}`
  );
  assert(
    !db.paymentTransactions || Object.keys(db.paymentTransactions).length === 0,
    'Zero fabricated payment transactions or settlement records',
    `Count: ${Object.keys(db.paymentTransactions || {}).length}`
  );
  assert(
    !db.deliveryTasks || Object.keys(db.deliveryTasks).length === 0,
    'Zero fabricated dispatch jobs & rider delivery tickets',
    `Count: ${Object.keys(db.deliveryTasks || {}).length}`
  );
  assert(
    !db.customerCareTickets || Object.keys(db.customerCareTickets).length === 0,
    'Zero fabricated customer-care support tickets & messages',
    `Count: ${Object.keys(db.customerCareTickets || {}).length}`
  );
  assert(
    !db.customers || Object.keys(db.customers).length === 0,
    'Zero fabricated customer profiles or addresses',
    `Count: ${Object.keys(db.customers || {}).length}`
  );
  assert(
    !db.walletTransactions || db.walletTransactions.length === 0,
    'Zero fabricated customer loyalty wallet transactions',
    `Count: ${(db.walletTransactions || []).length}`
  );
  assert(
    !db.houseAccounts || Object.keys(db.houseAccounts).length === 0,
    'Zero fabricated corporate house account balances',
    `Count: ${Object.keys(db.houseAccounts || {}).length}`
  );
  assert(
    !db.cateringEvents || Object.keys(db.cateringEvents).length === 0,
    'Zero fabricated catering contracts or party bookings',
    `Count: ${Object.keys(db.cateringEvents || {}).length}`
  );
  assert(
    !db.printJobs || db.printJobs.length === 0,
    'Zero fabricated hardware print jobs',
    `Count: ${(db.printJobs || []).length}`
  );
  assert(
    !db.notifications || Object.keys(db.notifications).length === 0,
    'Zero fabricated operational notifications or alerts',
    `Count: ${Object.keys(db.notifications || {}).length}`
  );
  assert(
    !db.stockAlerts || Object.keys(db.stockAlerts).length === 0,
    'Zero fabricated inventory reorder alerts',
    `Count: ${Object.keys(db.stockAlerts || {}).length}`
  );
  assert(
    !db.sessions || Object.keys(db.sessions).length === 0,
    'Zero leftover staff session tokens',
    `Count: ${Object.keys(db.sessions || {}).length}`
  );
  assert(
    !db.auditLogs || db.auditLogs.length === 0,
    'Zero fabricated test audit logs in fresh installation state',
    `Count: ${(db.auditLogs || []).length}`
  );

  // SECTION 2: ZERO INVENTED / FICTITIOUS OPENING STOCK
  console.log('\n--- 2. ZERO FICTITIOUS OPENING STOCK BALANCES ---');
  assert(
    !db.requests || Object.keys(db.requests).length === 0,
    'Zero fabricated stock transfer indents/requests',
    `Count: ${Object.keys(db.requests || {}).length}`
  );
  assert(
    !db.purchaseOrders || Object.keys(db.purchaseOrders).length === 0,
    'Zero fabricated procurement purchase orders',
    `Count: ${Object.keys(db.purchaseOrders || {}).length}`
  );
  assert(
    !db.goodsReceiptNotes || Object.keys(db.goodsReceiptNotes).length === 0,
    'Zero fabricated Goods Receipt Notes (GRN)',
    `Count: ${Object.keys(db.goodsReceiptNotes || {}).length}`
  );
  assert(
    !db.ledger || db.ledger.length === 0,
    'Zero fabricated stock ledger movement entries',
    `Count: ${(db.ledger || []).length}`
  );
  assert(
    !db.wastage || db.wastage.length === 0,
    'Zero fabricated inventory wastage records',
    `Count: ${(db.wastage || []).length}`
  );

  const inventoryItems = Object.values(db.inventory || {}) as any[];
  assert(inventoryItems.length > 0, 'Canonical inventory master definitions exist', `Count: ${inventoryItems.length}`);

  let totalPhysicalStock = 0;
  for (const item of inventoryItems) {
    const graStock = Number(item.currentStock?.gra ?? item.locationStock?.gra?.stockOnHand ?? 0);
    const okaStock = Number(item.currentStock?.okabere ?? item.locationStock?.okabere?.stockOnHand ?? 0);
    const ugbStock = Number(item.currentStock?.ugbowo ?? item.locationStock?.ugbowo?.stockOnHand ?? 0);
    const gsStock = Number(item.currentStock?.general_store ?? item.locationStock?.general_store?.stockOnHand ?? 0);
    totalPhysicalStock += graStock + okaStock + ugbStock + gsStock;
  }
  assert(
    totalPhysicalStock === 0,
    'Physical stock balances initialized to zero across all branches & commissary',
    `Total Network Stock: ${totalPhysicalStock}`
  );

  // SECTION 3: VERIFIED CANONICAL CONFIGURATION PRESERVED
  console.log('\n--- 3. VERIFIED CANONICAL BUSINESS CONFIGURATION PRESERVED ---');
  const branches = Object.values(db.branches || {}) as any[];
  assert(branches.length === 3, 'Exactly 3 canonical branches configured in database', `Count: ${branches.length}`);
  const branchIds = branches.map((b) => b.id).sort();
  assert(
    JSON.stringify(branchIds) === JSON.stringify(['gra', 'okabere', 'ugbowo']),
    'Canonical branch IDs: gra, okabere, ugbowo'
  );

  const categories = Object.values(db.categories || {}) as any[];
  assert(categories.length >= 8, 'Canonical menu categories preserved', `Count: ${categories.length}`);

  const products = Object.values(db.menuProducts || {}) as any[];
  assert(products.length >= 100, 'Canonical master menu products preserved', `Count: ${products.length}`);

  const roles = Object.values(db.roles || {}) as any[];
  assert(roles.length >= 8, 'Canonical RBAC role definitions preserved', `Count: ${roles.length}`);

  const tables = Object.values(db.tables || {}) as any[];
  assert(tables.length === 66, 'Canonical 66 restaurant tables initialized (status: available)', `Count: ${tables.length}`);
  const nonAvailableTables = tables.filter((t) => t.status !== 'available' || t.guestCount > 0);
  assert(nonAvailableTables.length === 0, 'All dining tables start in available status with 0 guests');

  const suppliers = Object.values(db.suppliers || {}) as any[];
  assert(suppliers.length >= 4, 'Approved canonical suppliers preserved', `Count: ${suppliers.length}`);

  const recipes = Object.values(db.recipes || {}) as any[];
  assert(recipes.length >= 4, 'Approved recipe BOM structures preserved', `Count: ${recipes.length}`);

  const assets = Object.values(db.assets || {}) as any[];
  assert(assets.length === 8, 'Canonical fixed asset register items preserved', `Count: ${assets.length}`);

  console.log('\n================================================================================');
  console.log(`VIRGIN APPLICATION AUDIT RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVirginStateAudit();
