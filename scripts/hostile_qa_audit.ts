// Hostile QA/QC Independent Penetration & Stress Test Suite
// Rigorously asserts security boundaries, role-based access, financial controls,
// inventory invariants, and operational edge cases.

import fs from 'fs';
import path from 'path';

async function runHostileQA() {
  const BASE_URL = 'http://localhost:3000';
  console.log('🛡️ Starting Hostile Independent QA/QC & Penetration Pass...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  const dbPath = path.join(process.cwd(), 'data', 'choplife_ops_db.json');
  const initialSnapshot = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf-8')) : null;
  let adminToken = '';

  try {
    // 1. Authenticate Personas
    console.log('--- PHASE 1: Authenticating Diverse Personas ---');
    // Cashier (GRA)
    const cashierLogin = await (await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrStaffId: 'CL-CSH-001', password: 'ChopLife2025!' }),
    })).json();
    const cashierToken = cashierLogin.token;
    const cashierHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cashierToken}` };

    // Super Admin
    const adminLogin = await (await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrStaffId: 'CL-ADM-001', password: 'ChopLife2025!' }),
    })).json();
    adminToken = adminLogin.token;
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    // Kitchen Lead
    const kitchenLogin = await (await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrStaffId: 'CL-KIT-001', password: 'ChopLife2025!' }),
    })).json();
    const kitchenHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kitchenLogin.token}` };

    assert(!!cashierToken && !!adminToken && !!kitchenLogin.token, 'Personas successfully authenticated');

    // 2. Hostile Penetration: Unauthorized Access
    console.log('\n--- PHASE 2: Hostile Penetration & Unauthenticated Access Guard ---');
    const unauthKds = await fetch(`${BASE_URL}/api/pos/kds/tickets`);
    assert(unauthKds.status === 401, 'Unauthenticated KDS access blocked (401)');

    const unauthDispatch = await fetch(`${BASE_URL}/api/dispatch/tasks`);
    assert(unauthDispatch.status === 401, 'Unauthenticated Dispatch access blocked (401)');

    const unauthLedger = await fetch(`${BASE_URL}/api/inventory/ledger`);
    assert(unauthLedger.status === 401, 'Unauthenticated Inventory Ledger blocked (401)');

    const forgedTokenRes = await fetch(`${BASE_URL}/api/pos/kds/tickets`, {
      headers: { 'Authorization': 'Bearer forged-malicious-jwt-token' },
    });
    assert(forgedTokenRes.status === 401, 'Forged JWT token rejected (401)');

    // 3. Role-Based Access Control (RBAC) Escalation Prevention
    console.log('\n--- PHASE 3: Privilege Escalation Attack Prevention ---');
    // Cashier attempting to access Admin-only staff roster creation
    const cashierAddStaff = await fetch(`${BASE_URL}/api/admin/staff`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ name: 'Hacker Staff', role: 'super_admin', pin: '9999' }),
    });
    assert(cashierAddStaff.status === 403, 'Cashier blocked from creating staff accounts (403)');

    // Cashier attempting to export executive financial P&L reports
    const cashierExportCsv = await fetch(`${BASE_URL}/api/reports/export-csv`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ exportType: 'pnl', period: 'all' }),
    });
    assert(cashierExportCsv.status === 403, 'Cashier blocked from exporting executive P&L CSV (403)');

    // Kitchen lead attempting to open register shift
    const kitchenOpenShift = await fetch(`${BASE_URL}/api/pos/shifts/open`, {
      method: 'POST',
      headers: kitchenHeaders,
      body: JSON.stringify({ branchId: 'gra', openingFloat: 5000 }),
    });
    assert(kitchenOpenShift.status === 403, 'Kitchen Lead blocked from opening cash register shift (403)');

    // 4. Financial & Shift Integrity Checks
    console.log('\n--- PHASE 4: Financial & Cash Drawer Integrity ---');
    // Get or open shift for cashier
    let shiftRes = await (await fetch(`${BASE_URL}/api/pos/shifts/current?branchId=gra`, { headers: cashierHeaders })).json();
    if (!shiftRes || shiftRes.status !== 'open') {
      const openRes = await fetch(`${BASE_URL}/api/pos/shifts/open`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({ branchId: 'gra', openingFloat: 10000, registerId: 'POS-01' }),
      });
      shiftRes = (await openRes.json()).shift;
    }
    assert(shiftRes && shiftRes.status === 'open', `Active shift verified (#${shiftRes?.shiftNumber})`);

    // Hostile attempt: Record negative cash drop
    const negDrop = await fetch(`${BASE_URL}/api/pos/shifts/${shiftRes.id}/cash-movement`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ type: 'cash_drop', amount: -5000, reason: 'Theft test' }),
    });
    assert(negDrop.status === 400, 'Negative cash movement rejected (400)');

    // Hostile attempt: Cashier from GRA attempting to record movement on another branch
    const crossBranchMovement = await fetch(`${BASE_URL}/api/pos/shifts/sft-okabere-dummy/cash-movement`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ type: 'cash_drop', amount: 1000 }),
    });
    assert(crossBranchMovement.status === 403 || crossBranchMovement.status === 404, 'Cross-branch cash movement blocked (403/404)');

    // 5. Inventory Stock Guard (Negative Stock & Tampering)
    console.log('\n--- PHASE 5: Inventory Stock Invariants ---');
    // Negative stock adjustment must be rejected
    const negStock = await fetch(`${BASE_URL}/api/inventory/items/inv-protein-chicken/stock`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ branchId: 'gra', newStock: -100, reason: 'Invalid negative test' }),
    });
    assert(negStock.status === 400, 'Negative inventory stock update rejected (400)');

    // Cashier attempting to tamper with warehouse stock
    const cashierStock = await fetch(`${BASE_URL}/api/inventory/items/inv-protein-chicken/stock`, {
      method: 'PUT',
      headers: cashierHeaders,
      body: JSON.stringify({ branchId: 'gra', newStock: 50 }),
    });
    assert(cashierStock.status === 403, 'Cashier blocked from altering warehouse inventory stock (403)');

    // 6. Customer Wallet PIN Verification
    console.log('\n--- PHASE 6: Customer Wallet Security & PIN Authorization ---');
    // Ensure test customer exists for wallet security assertions
    const uniquePhone = `0809${Math.floor(1000000 + Math.random() * 9000000)}`;
    const custCreateRes = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        name: 'QA Test Customer',
        phone: uniquePhone,
        email: `qa.${Date.now()}@choplife.ng`,
        walletPin: '1234',
      }),
    });
    const custCreateData = await custCreateRes.json();
    const testCustId = custCreateData.customer?.id || 'cust-001';

    // Topup customer wallet so balance is ₦5,000 and loyalty points >= 100
    await fetch(`${BASE_URL}/api/customers/${testCustId}/topup`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ amount: 5000, paymentMethod: 'cash' }),
    });

    // Attempt debit with wrong PIN
    const wrongPinWallet = await fetch(`${BASE_URL}/api/customers/${testCustId}/wallet/charge`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ amount: 1500, pin: '0000', note: 'Fraud test' }),
    });
    assert(wrongPinWallet.status === 403, 'Customer wallet charge with wrong PIN rejected (403)');

    // Attempt debit with excessive amount exceeding balance
    const overBalWallet = await fetch(`${BASE_URL}/api/customers/${testCustId}/wallet/charge`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ amount: 9999999, pin: '1234', note: 'Overdraft test' }),
    });
    assert(overBalWallet.status === 400, 'Customer wallet overdraft rejected (400)');

    // Loyalty Points Redemption Guard (Negative / Fractional points)
    const negLoyalty = await fetch(`${BASE_URL}/api/customers/${testCustId}/loyalty/redeem`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ pointsToRedeem: -500 }),
    });
    assert(negLoyalty.status === 400, 'Negative loyalty point redemption rejected (400)');

    const floatLoyalty = await fetch(`${BASE_URL}/api/customers/${testCustId}/loyalty/redeem`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ pointsToRedeem: 12.34 }),
    });
    assert(floatLoyalty.status === 400, 'Fractional loyalty point redemption rejected (400)');

    // 7. Hardware ESC/POS Printer Payload Guard
    console.log('\n--- PHASE 7: ESC/POS Network Printer Security Guard ---');
    const malformedHex = await fetch(`${BASE_URL}/api/hardware/printer/print-raw`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ printerIp: '192.168.1.100', hexData: 'NOT_VALID_HEX_ZZZZ' }),
    });
    assert(malformedHex.status === 400, 'Malformed ESC/POS hex payload rejected (400)');

    const oversizedHex = await fetch(`${BASE_URL}/api/hardware/printer/print-raw`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ printerIp: '192.168.1.100', hexData: 'aa'.repeat(40000) }), // 80,000 hex chars > 64KB limit
    });
    assert(oversizedHex.status === 400 || oversizedHex.status === 413, 'Oversized ESC/POS buffer (>64KB) rejected (400/413)');

    // 8. Offline Sync Idempotency Guard
    console.log('\n--- PHASE 8: Offline Queue Sync Idempotency ---');
    // Create an offline check payload
    const offlineCheckId = `chk-test-offline-${Date.now()}`;
    const offlinePayload = {
      queue: [
        {
          id: `queue-item-1-${Date.now()}`,
          action: 'create_check',
          payload: {
            id: offlineCheckId,
            tableNumber: 'Table 99',
            items: [{ productId: 'item_asun_pepper', name: 'Asun', quantity: 1, unitPrice: 3500, totalPrice: 3500 }],
            total: 3500,
            paymentStatus: 'paid',
          },
        },
      ],
    };

    // First sync
    const sync1 = await (await fetch(`${BASE_URL}/api/pos/offline/sync`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify(offlinePayload),
    })).json();
    assert(sync1.success && sync1.syncedCount === 1, 'Initial offline check successfully synced');

    // Second sync of same check (should be idempotent)
    const sync2 = await (await fetch(`${BASE_URL}/api/pos/offline/sync`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify(offlinePayload),
    })).json();
    assert(sync2.success && sync2.results[0].status === 'already_synced', 'Duplicate offline sync detected and protected (idempotent)');

    console.log(`\n========================================`);
    console.log(`HOSTILE QA PASS RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Hostile QA failure:', err);
    process.exit(1);
  } finally {
    if (initialSnapshot && adminToken) {
      await fetch(`${BASE_URL}/api/admin/db/reload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ snapshot: initialSnapshot }),
      }).catch(() => {});
    }
  }
}

runHostileQA();

