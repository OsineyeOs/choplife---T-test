import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runLogoutAndShiftVerification() {
  console.log('--- STARTING LOGOUT & CLOSE SHIFT END-TO-END VERIFICATION ---');

  const BASE_URL = 'http://localhost:3000';

  const dbPath = path.join(process.cwd(), 'data', 'choplife_ops_db.json');
  const initialSnapshot = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf-8')) : null;

  try {
    // 1. Authenticate Staff Member (Cashier / Manager)
    const loginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrStaffId: 'oluwaseun.osineye@gmail.com',
        password: 'ChopLife2025!',
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.ok && loginData.token, 'Staff authentication successful for test session');
    const staffHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginData.token}`,
    };

    // 2. Verify Session via /api/auth/staff/me
    const meRes = await fetch(`${BASE_URL}/api/auth/staff/me`, {
      headers: staffHeaders,
    });
    assert(meRes.ok, '/api/auth/staff/me confirms active authenticated session');

    // 3. Open a Test Shift
    const registerId = `REG-TEST-${Date.now().toString().slice(-4)}`;
    const openShiftRes = await fetch(`${BASE_URL}/api/pos/shifts/open`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        branchId: 'gra',
        registerId,
        openingFloat: 25000,
      }),
    });
    const openShiftData = await openShiftRes.json();
    assert(openShiftRes.ok && openShiftData.shift, 'Opened test shift successfully');
    const shiftId = openShiftData.shift.id;
    assert(openShiftData.shift.openingFloat === 25000, 'Shift records correct opening float');
    assert(openShiftData.shift.expectedCashInTill === 25000, 'Expected cash equals opening float initially');

    // 4. Record Cash Movement (Safe Drop)
    const movementRes = await fetch(`${BASE_URL}/api/pos/shifts/${shiftId}/cash-movement`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        movementType: 'safe_drop',
        amount: 5000,
        reason: 'Test safe drop envelope #101',
      }),
    });
    const movementData = await movementRes.json();
    assert(movementRes.ok && movementData.shift, 'Recorded cash safe drop successfully');
    assert(movementData.shift.expectedCashInTill === 20000, 'Expected cash correctly reduced by safe drop (25000 - 5000 = 20000)');

    // 5. Close Shift & Generate Z-Report
    const closeRes = await fetch(`${BASE_URL}/api/pos/shifts/${shiftId}/close`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        countedCashInTill: 20000,
        notes: 'End of shift perfectly balanced',
      }),
    });
    const closeData = await closeRes.json();
    assert(closeRes.ok && closeData.shift, 'Closed shift and generated Z-Report successfully');
    assert(closeData.shift.status === 'closed', 'Shift status marked closed');
    assert(closeData.shift.cashVariance === 0, 'Cash variance is zero when counted matches expected');

    // 6. Test Logout Workflow & Session Invalidation
    const logoutRes = await fetch(`${BASE_URL}/api/auth/staff/logout`, {
      method: 'POST',
      headers: staffHeaders,
    });
    const logoutData = await logoutRes.json();
    assert(logoutRes.ok && logoutData.success, 'Staff logout endpoint returns success');

    // 7. Verify session is invalidated (Subsequent /me request must fail with 401)
    const postLogoutMeRes = await fetch(`${BASE_URL}/api/auth/staff/me`, {
      headers: staffHeaders,
    });
    assert(postLogoutMeRes.status === 401, 'Invalidated session token correctly rejected with 401 Unauthorized');

    console.log('\n--- ALL LOGOUT & CLOSE SHIFT VERIFICATION CHECKS PASSED PERFECTLY ---');
  } finally {
    if (initialSnapshot) {
      const relogin = await fetch(`${BASE_URL}/api/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrStaffId: 'oluwaseun.osineye@gmail.com', password: 'ChopLife2025!' }),
      }).then((r) => r.json()).catch(() => null);
      if (relogin?.token) {
        await fetch(`${BASE_URL}/api/admin/db/reload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${relogin.token}` },
          body: JSON.stringify({ snapshot: initialSnapshot }),
        }).catch(() => {});
      }
    }
  }
}

runLogoutAndShiftVerification().catch((err) => {
  console.error('Logout and shift verification failed:', err);
  process.exit(1);
});

