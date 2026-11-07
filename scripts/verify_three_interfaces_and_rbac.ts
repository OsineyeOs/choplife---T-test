// Verification of Three-Interface Separation, Role-Based Access Control (RBAC),
// Field Minimization, and Branch-Scoped Governance.
// 15 Comprehensive Scenarios verifying production security gates.

import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string, detail?: any) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`, detail || '');
    throw new Error(msg);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runThreeInterfacesAndRbacVerification() {
  console.log('========================================================================');
  console.log('🛡️  CHOPLIFE REPUBLIC — THREE-INTERFACE SEPARATION & RBAC SUITE (15 SCENARIOS)');
  console.log('========================================================================\n');

  const BASE_URL = 'http://localhost:3000';
  const dbPath = path.join(process.cwd(), 'data', 'choplife_ops_db.json');
  const snapshot = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf-8')) : null;

  try {
    // -------------------------------------------------------------
    // PHASE 0: AUTHENTICATE ALL OPERATIONAL PERSONAS
    // -------------------------------------------------------------
    console.log('--- Phase 0: Authenticating Personas across Interfaces ---');

    async function login(emailOrStaffId: string, password = 'ChopLife2025!') {
      const res = await fetch(`${BASE_URL}/api/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrStaffId, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(`Login failed for ${emailOrStaffId}: ${JSON.stringify(data)}`);
      }
      return {
        token: data.token,
        staff: data.staff,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.token}`,
        },
      };
    }

    const superAdmin = await login('CL-ADM-001');
    const branchMgrGra = await login('CL-MGR-001');
    const cashierGra = await login('CL-CSH-001');
    const kitchenGra = await login('CL-KIT-001');
    const riderGra = await login('CL-RID-001');
    const auditor = await login('CL-AUD-001');

    console.log(`Authenticated: SuperAdmin (${superAdmin.staff.name}), BranchManager (${branchMgrGra.staff.name}), Cashier (${cashierGra.staff.name}), Kitchen (${kitchenGra.staff.name}), Rider (${riderGra.staff.name}), Auditor (${auditor.staff.name})\n`);

    // -------------------------------------------------------------
    // SCENARIO 1: Frontline cashier calling GET /api/staff/accounts -> 403 Forbidden
    // -------------------------------------------------------------
    console.log('--- Scenario 1: Frontline Cashier Restricted from Staff Directory ---');
    const sc1Res = await fetch(`${BASE_URL}/api/staff/accounts`, { headers: cashierGra.headers });
    assert(sc1Res.status === 403, 'Scenario 1: Frontline Cashier calling GET /api/staff/accounts is rejected with HTTP 403 Forbidden');

    // -------------------------------------------------------------
    // SCENARIO 2: Frontline rider calling GET /api/rbac/roles -> 403 Forbidden
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Frontline Rider Restricted from RBAC Roles Matrix ---');
    const sc2Res = await fetch(`${BASE_URL}/api/rbac/roles`, { headers: riderGra.headers });
    assert(sc2Res.status === 403, 'Scenario 2: Frontline Rider calling GET /api/rbac/roles is rejected with HTTP 403 Forbidden');

    // -------------------------------------------------------------
    // SCENARIO 3: Frontline kitchen staff calling POST /api/staff/accounts/:id/reset-password -> 403 Forbidden
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Frontline Kitchen Staff Restricted from Resetting Passwords ---');
    const sc3Res = await fetch(`${BASE_URL}/api/staff/accounts/${cashierGra.staff.id}/reset-password`, {
      method: 'POST',
      headers: kitchenGra.headers,
      body: JSON.stringify({ temporaryPassword: 'HackPassword123!' }),
    });
    assert(sc3Res.status === 403, 'Scenario 3: Frontline Kitchen staff calling POST /api/staff/accounts/:id/reset-password is rejected with HTTP 403 Forbidden');

    // -------------------------------------------------------------
    // SCENARIO 4: Frontline cashier attempting password reset on another user -> 403 Forbidden
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Frontline Cashier Restricted from Other-User Password Resets ---');
    const sc4Res = await fetch(`${BASE_URL}/api/staff/accounts/${branchMgrGra.staff.id}/reset-password`, {
      method: 'POST',
      headers: cashierGra.headers,
      body: JSON.stringify({ temporaryPassword: 'CashierReset123!' }),
    });
    assert(sc4Res.status === 403, 'Scenario 4: Frontline Cashier attempting password reset on another user is rejected with HTTP 403 Forbidden');

    // -------------------------------------------------------------
    // SCENARIO 5: Branch Manager calling GET /api/staff/accounts receives only staff belonging to their branch
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Branch Manager Scoped Directory Access ---');
    const sc5Res = await fetch(`${BASE_URL}/api/staff/accounts`, { headers: branchMgrGra.headers });
    assert(sc5Res.ok, 'Scenario 5a: Branch Manager GET /api/staff/accounts returns HTTP 200 OK');
    const sc5Data = await sc5Res.json();
    assert(Array.isArray(sc5Data) && sc5Data.length > 0, 'Scenario 5b: Returns array of staff accounts');
    const allBelongToGra = sc5Data.every((s: any) => {
      const allowed = s.allowedBranchIds || [s.branchId];
      return s.branchId === 'gra' || allowed.includes('gra');
    });
    assert(allBelongToGra, 'Scenario 5c: All accounts returned to Branch Manager belong to or are allowed at home branch (GRA)');
    const containsOkabereCashier = sc5Data.some((s: any) => s.staffId === 'STF-010' && s.branchId === 'okabere' && !s.allowedBranchIds?.includes('gra'));
    assert(!containsOkabereCashier, 'Scenario 5d: Branch Manager does not see staff exclusive to Okabere or other branches');

    // -------------------------------------------------------------
    // SCENARIO 6: Branch Manager accessing staff outside their branch via GET /api/staff/accounts/:id -> 403 Forbidden
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Branch Manager Direct Retrieval of Other-Branch Staff Blocked ---');
    const sc6Res = await fetch(`${BASE_URL}/api/staff/accounts/staff-csh-okabere`, { headers: branchMgrGra.headers });
    assert(sc6Res.status === 403, 'Scenario 6: Branch Manager attempting GET /api/staff/accounts/:id for Okabere cashier is rejected with HTTP 403 Forbidden');

    // -------------------------------------------------------------
    // SCENARIO 7: Auditor calling GET /api/staff/accounts receives minimized fields (phone redacted, workEmail masked)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Auditor Field Minimization ---');
    const sc7Res = await fetch(`${BASE_URL}/api/staff/accounts`, { headers: auditor.headers });
    assert(sc7Res.ok, 'Scenario 7a: Auditor GET /api/staff/accounts returns HTTP 200 OK');
    const sc7Data = await sc7Res.json();
    assert(Array.isArray(sc7Data) && sc7Data.length > 0, 'Scenario 7b: Auditor receives staff list');
    const allPhonesRedacted = sc7Data.every((s: any) => s.phone === '[REDACTED_FOR_AUDITOR]');
    assert(allPhonesRedacted, 'Scenario 7c: Auditor view has all phone numbers minimized to [REDACTED_FOR_AUDITOR]');
    const allEmailsMasked = sc7Data.every((s: any) => !s.workEmail || s.workEmail.includes('***@'));
    assert(allEmailsMasked, 'Scenario 7d: Auditor view has work emails masked with ***@');

    // -------------------------------------------------------------
    // SCENARIO 8: Auditor attempting POST /api/staff/accounts -> 403 Forbidden (read-only compliance)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Auditor Creation Blocked (Strict Read-Only) ---');
    const sc8Res = await fetch(`${BASE_URL}/api/staff/accounts`, {
      method: 'POST',
      headers: auditor.headers,
      body: JSON.stringify({
        staffId: 'STF-AUD-TEST',
        name: 'Malicious Create',
        workEmail: 'auditortest@choplife.ng',
        role: 'cashier',
        branchId: 'gra',
        initialPassword: 'TestPassword123!',
      }),
    });
    assert(sc8Res.status === 403, 'Scenario 8: Auditor attempting POST /api/staff/accounts is rejected with HTTP 403 Forbidden');

    // -------------------------------------------------------------
    // SCENARIO 9: Super Admin calling GET /api/staff/accounts receives all branches with full details
    // -------------------------------------------------------------
    console.log('\n--- Scenario 9: Super Admin Enterprise-Wide Full Visibility ---');
    const sc9Res = await fetch(`${BASE_URL}/api/staff/accounts`, { headers: superAdmin.headers });
    assert(sc9Res.ok, 'Scenario 9a: Super Admin GET /api/staff/accounts returns HTTP 200 OK');
    const sc9Data = await sc9Res.json();
    const hasGra = sc9Data.some((s: any) => s.branchId === 'gra');
    const hasOkabere = sc9Data.some((s: any) => s.branchId === 'okabere');
    assert(hasGra && hasOkabere, 'Scenario 9b: Super Admin receives staff across all branch locations');
    const adminViewUnredacted = sc9Data.some((s: any) => s.phone && s.phone !== '[REDACTED_FOR_AUDITOR]');
    assert(adminViewUnredacted, 'Scenario 9c: Super Admin receives full unredacted phone contacts');

    // -------------------------------------------------------------
    // SCENARIO 10: Session revocation upon account suspension
    // -------------------------------------------------------------
    console.log('\n--- Scenario 10: Session Revocation upon Account Suspension ---');
    // Create temporary disposable test staff account
    const tempStaffId = `STF-TEMP-${Date.now().toString().slice(-4)}`;
    const createTempRes = await fetch(`${BASE_URL}/api/staff/accounts`, {
      method: 'POST',
      headers: superAdmin.headers,
      body: JSON.stringify({
        staffId: tempStaffId,
        name: 'Temporary Suspension Test Staff',
        workEmail: `temp.${Date.now()}@choplife.ng`,
        phone: '+234 812 000 9999',
        role: 'cashier',
        branchId: 'gra',
        initialPassword: 'TempPassword2026!',
      }),
    });
    assert(createTempRes.ok, 'Scenario 10a: Created disposable staff account for suspension test');
    const tempStaffAccount = (await createTempRes.json()).staff;

    // Login as the temporary staff
    const tempStaffSession = await login(tempStaffId, 'TempPassword2026!');
    const meBeforeSuspend = await fetch(`${BASE_URL}/api/auth/staff/me`, { headers: tempStaffSession.headers });
    assert(meBeforeSuspend.ok, 'Scenario 10b: Disposable staff logged in successfully and verified via /me');

    // Admin suspends the disposable staff account
    const suspendRes = await fetch(`${BASE_URL}/api/staff/accounts/${tempStaffAccount.id}`, {
      method: 'PUT',
      headers: superAdmin.headers,
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert(suspendRes.ok, 'Scenario 10c: Admin successfully set account status to suspended');

    // Re-attempt authenticated request using the prior token
    const meAfterSuspend = await fetch(`${BASE_URL}/api/auth/staff/me`, { headers: tempStaffSession.headers });
    assert(meAfterSuspend.status === 401 || meAfterSuspend.status === 403, `Scenario 10d: Existing session token immediately rejected after suspension (HTTP ${meAfterSuspend.status})`);

    // -------------------------------------------------------------
    // SCENARIO 11: Self-inspection of effective access allowed for frontline staff
    // -------------------------------------------------------------
    console.log('\n--- Scenario 11: Frontline Staff Self-Inspection of Effective Access ---');
    const sc11Res = await fetch(`${BASE_URL}/api/rbac/staff/${cashierGra.staff.staffId}/effective-access`, { headers: cashierGra.headers });
    assert(sc11Res.ok, 'Scenario 11a: Frontline cashier self-inspection returns HTTP 200 OK');
    const sc11Data = await sc11Res.json();
    assert(sc11Data.staffId === cashierGra.staff.staffId, 'Scenario 11b: Returns correct self staffId profile');
    assert(Array.isArray(sc11Data.categories) && sc11Data.categories.length > 0, 'Scenario 11c: Returns categorized privilege breakdown');

    // -------------------------------------------------------------
    // SCENARIO 12: Inspecting another user's effective access blocked for frontline staff (403 Forbidden)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 12: Frontline Staff Blocked from Inspecting Others Effective Access ---');
    const sc12Res = await fetch(`${BASE_URL}/api/rbac/staff/${superAdmin.staff.staffId}/effective-access`, { headers: cashierGra.headers });
    assert(sc12Res.status === 403, 'Scenario 12: Frontline Cashier attempting to inspect Super Admin effective access is rejected with HTTP 403 Forbidden');

    // -------------------------------------------------------------
    // SCENARIO 13: Non-manager / invalid PIN attempt against POST /api/pos/manager-override -> 403 Forbidden
    // -------------------------------------------------------------
    console.log('\n--- Scenario 13: Manager Override Invalid PIN Rejection ---');
    const sc13Res = await fetch(`${BASE_URL}/api/pos/manager-override`, {
      method: 'POST',
      headers: cashierGra.headers,
      body: JSON.stringify({
        pin: '0000',
        action: 'void_item',
        reason: 'Hostile override attempt test',
      }),
    });
    assert(sc13Res.status === 403, 'Scenario 13: Manager Override with invalid PIN rejected with HTTP 403 Forbidden');

    // -------------------------------------------------------------
    // SCENARIO 14: Frontline staff blocked from calling GET /api/reports/executive-dashboard -> 403 Forbidden
    // -------------------------------------------------------------
    console.log('\n--- Scenario 14: Frontline Staff Blocked from Executive BI Dashboard ---');
    const sc14Res = await fetch(`${BASE_URL}/api/reports/executive-dashboard?branchId=gra`, { headers: cashierGra.headers });
    assert(sc14Res.status === 403, 'Scenario 14: Frontline Cashier calling GET /api/reports/executive-dashboard is rejected with HTTP 403 Forbidden');

    // -------------------------------------------------------------
    // SCENARIO 15: Frontline staff blocked from calling GET /api/audit/logs -> 403 Forbidden
    // -------------------------------------------------------------
    console.log('\n--- Scenario 15: Frontline Staff Blocked from Immutable Security Audit Logs ---');
    const sc15Res = await fetch(`${BASE_URL}/api/audit/logs?branchId=gra`, { headers: cashierGra.headers });
    assert(sc15Res.status === 403, 'Scenario 15: Frontline Cashier calling GET /api/audit/logs is rejected with HTTP 403 Forbidden');

    console.log('\n========================================================================');
    console.log('🎉 ALL 15 THREE-INTERFACE & RBAC SECURITY SCENARIOS PASSED WITH ZERO DEFECTS!');
    console.log('========================================================================\n');
  } finally {
    // Restore clean snapshot
    if (snapshot && fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    }
  }
}

runThreeInterfacesAndRbacVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
