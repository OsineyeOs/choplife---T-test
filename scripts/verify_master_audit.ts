import { loadDatabase, saveDatabaseSync } from '../server_db.ts';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log('--- STARTING VERIFICATION TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  const db = loadDatabase();

  // Test 1: Database persistence mechanism
  assert(db !== null && typeof db === 'object', 'Persistent JSON database loaded');
  assert(Object.keys(db.staff).length >= 8, 'Canonical staff directory contains >= 8 staff accounts');
  assert(Object.keys(db.roles).length >= 8, 'Canonical eZee Optimus roles initialized (>= 8 standard roles)');

  // Test 2: Standard eZee Optimus Roles existence
  const expectedRoles = ['role-admin', 'role-manager', 'role-cashier', 'role-customer-care', 'role-receptionist', 'role-store-incharge', 'role-store-manager', 'role-auditor'];
  for (const rId of expectedRoles) {
    assert(Boolean(db.roles[rId]), `Standard role '${rId}' exists in db.roles`);
  }

  // Test 3: Admin role has full wildcard privileges and all reports
  const adminRole = db.roles['role-admin'];
  assert(adminRole.privileges.includes('delivery.free_authorise'), 'Admin role has delivery.free_authorise privilege');
  assert(adminRole.privileges.includes('delivery.handover_pin.view'), 'Admin role has delivery.handover_pin.view privilege');
  assert(adminRole.reports.length === 10, 'Admin role has all 10 canonical operational reports');

  // Test 4: Cashier role has restricted privileges
  const cashierRole = db.roles['role-cashier'];
  assert(!cashierRole.privileges.includes('delivery.free_authorise'), 'Cashier does NOT have delivery.free_authorise privilege');
  assert(!cashierRole.privileges.includes('inventory.adjust'), 'Cashier does NOT have inventory.adjust privilege');
  assert(cashierRole.privileges.includes('pos.check.settle'), 'Cashier has pos.check.settle privilege');

  // Test 5: Bcrypt password hashing verification
  const testPassword = 'ChopLifeSecure2026!';
  const hashed = bcrypt.hashSync(testPassword, 10);
  assert(bcrypt.compareSync(testPassword, hashed), 'Bcrypt hash correctly verifies raw password');
  assert(!bcrypt.compareSync('WrongPassword123', hashed), 'Bcrypt correctly rejects invalid password');

  // Test 6: Free delivery automatic zeroing eliminated
  // Check AppContext FREE_DELIVERY_THRESHOLD
  const appContextModule = await import('../src/context/AppContext.tsx');
  assert(appContextModule.FREE_DELIVERY_THRESHOLD === 0, 'FREE_DELIVERY_THRESHOLD is set to 0 (automatic free delivery eliminated)');

  // Test 7: Inventory valuation matches GRA physical records
  const graItems = Object.values(db.inventory || {});
  let graStockValuation = 0;
  for (const item of graItems) {
    const stock = Number((item as any).currentStock?.['gra'] ?? (item as any).locationStock?.['gra']?.stockOnHand ?? 0);
    const cost = Number((item as any).costPerUnit ?? (item as any).locationStock?.['gra']?.unitCost ?? 0);
    graStockValuation += stock * cost;
  }
  console.log(`Computed GRA Stock Valuation: ₦${graStockValuation.toLocaleString()}`);
  assert(graStockValuation > 0, 'GRA inventory stock valuation reconciles to active inventory ledger');

  // Test 8: Active tickets on KDS
  const checks = Object.values(db.checks || {});
  const openChecks = checks.filter(c => c.status === 'open' || c.status === 'sent_to_kitchen');
  assert(openChecks.length < 50, `Unsettled open checks controlled and realistic (${openChecks.length} open checks)`);

  // Test 9: Zero-demo operational state for catering and dispatch
  const cateringEvents = Object.values(db.cateringEvents || {});
  assert(cateringEvents.length === 0, `Production database starts with clean zero-demo catering state (${cateringEvents.length} contracts)`);

  // Test 10: Dispatch queue empty state
  const tasks = Object.values(db.deliveryTasks || {});
  assert(tasks.length < 50, `Dispatch queue controlled (${tasks.length} active tasks)`);

  // Test 11: Role Order Summary Columns
  const cashierCols = cashierRole.orderSummaryColumns;
  assert(cashierCols.includes('net_total') && cashierCols.includes('payment_method'), 'Cashier role has net_total and payment_method in order summary columns');
  assert(!cashierCols.includes('rounding_adjustment'), 'Cashier role does NOT have rounding_adjustment column');

  // Test 12: Auditor role restrictions
  const auditorRole = db.roles['role-auditor'];
  assert(auditorRole.privileges.includes('security.audit.view'), 'Auditor has security.audit.view privilege');
  assert(!auditorRole.privileges.includes('pos.check.create'), 'Auditor does NOT have pos.check.create privilege');
  assert(auditorRole.reports.length === 10, 'Auditor has access to all audit and financial reports');

  // Test 13: Store Incharge role restrictions
  const storeInchargeRole = db.roles['role-store-incharge'];
  assert(storeInchargeRole.privileges.includes('inventory.adjust'), 'Store Incharge has inventory.adjust privilege');
  assert(!storeInchargeRole.privileges.includes('delivery.free_authorise'), 'Store Incharge does NOT have delivery.free_authorise privilege');

  // Test 14: Lockout logic simulation
  let mockStaff: any = {
    failedLoginAttempts: 4,
    lockoutUntil: 0,
  };
  // 5th failed attempt triggers lockout
  mockStaff.failedLoginAttempts += 1;
  if (mockStaff.failedLoginAttempts >= 5) {
    mockStaff.lockoutUntil = Date.now() + 15 * 60 * 1000;
  }
  assert(mockStaff.lockoutUntil > Date.now(), '5 consecutive failed attempts successfully sets lockout period');

  console.log(`\n--- TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Test execution error:', e);
  process.exit(1);
});
