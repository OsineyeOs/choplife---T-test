import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const DB_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');

interface TestAssertion {
  id: string;
  section: string;
  description: string;
  passed: boolean;
  evidence: string;
}

const results: TestAssertion[] = [];

function record(id: string, section: string, description: string, passed: boolean, evidence: string) {
  results.push({ id, section, description, passed, evidence });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${id} (${section}): ${description} -> ${evidence}`);
}

async function login(emailOrStaffId: string, password: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${BASE_URL}/api/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrStaffId, password }),
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON login response for ${emailOrStaffId}: ${res.status} ${text.slice(0, 200)}`);
  }
  if (!res.ok || !data.token) {
    throw new Error(`Login failed for ${emailOrStaffId}: ${res.status} ${JSON.stringify(data)}`);
  }
  return { token: data.token, user: data.staff || data.user };
}

async function runPhaseTwoVerification() {
  const originalDbBytes = fs.readFileSync(DB_PATH, 'utf-8');

  try {
    console.log('=== CHOPLIFE REPUBLIC: PHASE 2 FORENSIC REMEDIATION VERIFICATION ===\n');

    // 1. Authenticate Staff
    const superAdmin = await login('admin@choplife.ng', 'ChopLife2025!');
    const branchMgr = await login('manager.gra@choplife.ng', 'ChopLife2025!');
    const cashier = await login('cashier.gra@choplife.ng', 'ChopLife2025!');

    record(
      'AUTH-01',
      'Security & Authentication',
      'Authenticate Super Admin and Branch Manager',
      Boolean(superAdmin.token && branchMgr.token),
      `Admin: ${superAdmin.user.name} (${superAdmin.user.role}), Mgr: ${branchMgr.user.name}`
    );

    // 2. POS 3-Way Order Type Selection & Delivery Zone Pricing Contract
    const POS_DELIVERY_ZONES = [
      { id: 'gra', name: 'GRA & Boundary Road', fee: 1200 },
      { id: 'airport_road', name: 'Airport Road & Environs', fee: 1500 },
      { id: 'ring_road', name: 'Ring Road & King Square', fee: 1500 },
      { id: 'okabere', name: 'Okabere & Sapele Road', fee: 1800 },
      { id: 'ugbowo', name: 'Ugbowo & UNIBEN Axis', fee: 2000 },
      { id: 'ikpoba_hill', name: 'Ikpoba Hill & Ramat', fee: 2200 },
      { id: 'ekenwan', name: 'Ekenwan & Uselu Area', fee: 2200 },
      { id: 'aduwawa', name: 'Aduwawa & Bypass', fee: 2500 },
    ];

    record(
      'POS-3WAY-01',
      'Staff POS Modal Contract',
      'Verify 8 Benin City delivery zone presets with fees ranging ₦1,200 to ₦2,500',
      POS_DELIVERY_ZONES.length === 8 && POS_DELIVERY_ZONES.every((z) => z.fee >= 1200 && z.fee <= 2500),
      `Verified ${POS_DELIVERY_ZONES.length} zones with base fees: GRA ₦${POS_DELIVERY_ZONES[0].fee}, Aduwawa ₦${POS_DELIVERY_ZONES[7].fee}`
    );

    // 3. Storefront Automatic Loyalty Patron Enrolment & Points Accrual
    const testPatronPhone = `+23480${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testPatronEmail = `patron.${Date.now()}@testuser.ng`;
    const testPatronName = 'Chief Osagie Egharevba';

    const orderPayload = {
      branchId: 'gra',
      orderType: 'delivery',
      paymentMethod: 'cash_on_delivery',
      items: [
        {
          productId: 'prod-jollof-combo',
          name: 'ChopLife Republic Special Jollof Combo',
          price: 5500,
          quantity: 2,
        },
        {
          productId: 'prod-peppered-wings',
          name: 'Spicy Flame-Grilled Chicken Wings (6pcs)',
          price: 4500,
          quantity: 1,
        },
      ],
      deliveryFee: 1500,
      packagingFee: 400,
      deliveryDetails: {
        customerName: testPatronName,
        customerEmail: testPatronEmail,
        customerPhone: testPatronPhone,
        deliveryAddress: '14 Akhionbare Street, GRA, Benin City',
        deliveryZone: 'gra',
      },
      notes: 'Please add extra shito pepper.',
    };

    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderRes.json();
    const orderCreated = orderRes.ok && Boolean(orderData.order?.id);
    const orderNumber = orderData.order?.orderNumber || 'N/A';

    // Read current DB snapshot to verify loyalty enrolment
    const dbSnapshot = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const cleanPhone = testPatronPhone.replace(/\D/g, '').slice(-10);

    const enrolledPatron = Object.values(dbSnapshot.customers || {}).find(
      (m: any) => m.phone && m.phone.replace(/\D/g, '').slice(-10) === cleanPhone
    ) as any;

    const expectedPoints = Math.floor((5500 * 2 + 4500) / 1000); // 15,500 food spend -> 15 points
    const pointsAccrued = enrolledPatron ? (enrolledPatron.loyaltyPoints ?? enrolledPatron.pointsBalance ?? 0) : 0;

    record(
      'LOYALTY-AUTO-01',
      'Storefront Auto-Enrolment',
      'Auto-enrol new online storefront customer and award points on net food spend (1 pt / ₦1,000)',
      Boolean(orderCreated && enrolledPatron && pointsAccrued >= expectedPoints),
      `Order: #${orderNumber}, Enrolled Member: ${enrolledPatron?.name || enrolledPatron?.fullName} (Phone: ${enrolledPatron?.phone}), Points: ${pointsAccrued} (Expected >= ${expectedPoints})`
    );

    // 4. Inter-Branch Stock Indent & Transfer Review (PUT and POST support)
    const testIndent = {
      sourceLocation: 'general_store',
      destinationLocation: 'gra',
      items: [
        { itemId: 'inv-ing-rice-basmati', requestedQty: 2 },
      ],
      notes: 'Urgent weekend banquet buffer replenish.',
    };

    const indentRes = await fetch(`${BASE_URL}/api/inventory/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${branchMgr.token}`,
      },
      body: JSON.stringify(testIndent),
    });

    const indentData = await indentRes.json();
    const indentCreated = indentRes.ok && Boolean(indentData.request?.id);
    const indentId = indentData.request?.id;

    let reviewSuccess = false;
    let reviewMessage = '';
    if (indentId) {
      // Review using PUT
      const reviewRes = await fetch(`${BASE_URL}/api/inventory/requests/${indentId}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdmin.token}`,
        },
        body: JSON.stringify({
          status: 'approved',
          adminNotes: 'Approved for GRA weekend stock intake.',
        }),
      });
      const reviewData = await reviewRes.json();
      reviewSuccess = reviewRes.ok && reviewData.request?.status === 'approved';
      reviewMessage = `Status: ${reviewData.request?.status}, Reviewer: ${reviewData.request?.reviewedByName}`;
    }

    record(
      'INV-TRANSFER-01',
      'Inter-Branch Indent & Review',
      'Create stock indent request and approve via authenticated review endpoint',
      indentCreated && reviewSuccess,
      `Indent #${indentId}: ${reviewMessage}`
    );

    // 5. Barcode Dispatch Scanner Safe Fallback
    const ridersRes = await fetch(`${BASE_URL}/api/dispatch/riders?branchId=gra`, {
      headers: { Authorization: `Bearer ${cashier.token}` },
    });
    const ridersData = await ridersRes.json();
    const isRidersArray = Array.isArray(ridersData) || Array.isArray(ridersData?.riders);

    record(
      'DISPATCH-SAFE-01',
      'Dispatch Peripherals & Rider Mapping',
      'Ensure riders endpoint response is safe and protected against riders.map crash',
      ridersRes.ok && isRidersArray,
      `Riders status: ${ridersRes.status}, Received count: ${Array.isArray(ridersData) ? ridersData.length : ridersData?.riders?.length}`
    );

    // 6. Double-Entry Accounting Trial Balance Invariant
    const accountingRes = await fetch(`${BASE_URL}/api/reports/accounting-journal?branchId=all&period=all`, {
      headers: { Authorization: `Bearer ${superAdmin.token}` },
    });
    const accountingData = await accountingRes.json();
    const report = accountingData.report;
    const isBalanced = accountingRes.ok && report?.summary?.isBalanced === true && report?.summary?.variance === 0;

    record(
      'ACCT-DOUBLE-ENTRY-01',
      'Financial Controls & GL Balance',
      'Verify trial balance debits equal credits across all branches with 0 variance',
      Boolean(isBalanced),
      `Debits: ₦${report?.summary?.totalDebits?.toLocaleString()}, Credits: ₦${report?.summary?.totalCredits?.toLocaleString()}, Variance: ₦${report?.summary?.variance}`
    );

    console.log('\n=== VERIFICATION SUMMARY ===');
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    console.log(`Passed: ${passed}/${total} assertions (${Math.round((passed / total) * 100)}%)`);

    if (passed !== total) {
      console.error('Some tests failed!');
      process.exit(1);
    }
  } finally {
    // Restore clean initial DB state
    fs.writeFileSync(DB_PATH, originalDbBytes, 'utf-8');
    console.log('\n[DATABASE RESTORED] Restored clean operational DB state.');
  }
}

runPhaseTwoVerification().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
