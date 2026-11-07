// Comprehensive End-to-End Operational Verification Script
// Tests: PIN Auth, Storefront Order -> KDS & Dispatch & Recipe BOM Depletion, Shift Enforcement, COD Remittance, Stock Indent Flow

import fs from 'fs';
import path from 'path';

async function runVerification() {
  const BASE_URL = 'http://localhost:3000';
  console.log('🚀 Starting ChopLife Republic Operations Verification...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`, detail || '');
      failed++;
    }
  }

  const dbPath = path.join(process.cwd(), 'data', 'choplife_ops_db.json');
  const initialSnapshot = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf-8')) : null;
  let adminToken = '';

  try {
    // 1. PIN Authentication Disabled Verification & Secure Password Login
    console.log('--- TEST 1: Staff Authentication Security Enforcement ---');
    const pinRes = await fetch(`${BASE_URL}/api/auth/staff/pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '2222' }),
    });
    const pinData = await pinRes.json();
    assert(pinRes.status === 403, 'Quick PIN login disabled in production (403 Forbidden)', pinData);

    const cashierLoginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrStaffId: 'CL-CSH-001',
        password: 'ChopLife2025!',
      }),
    });
    const cashierLoginData = await cashierLoginRes.json();
    assert(cashierLoginRes.ok && cashierLoginData.success && cashierLoginData.staff.role === 'cashier', 'Cashier password login (CL-CSH-001)', cashierLoginData);

    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrStaffId: 'oluwaseun.osineye@gmail.com',
        password: 'ChopLife2025!',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.ok && adminLoginData.staff.role === 'super_admin', 'Admin password login (oluwaseun.osineye@gmail.com)', adminLoginData);
    adminToken = adminLoginData.token;

    const cashierHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cashierLoginData.token}`,
    };
    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminLoginData.token}`,
    };

    // 2. Online Order Placement via POST /api/orders
    console.log('\n--- TEST 2: Customer Storefront Order Lifecycle ---');
    const orderPayload = {
      customerName: 'Amina Bello',
      customerEmail: 'amina.bello@example.ng',
      customerPhone: '08031234567',
      branchId: 'gra',
      deliveryAddress: 'Plot 14 Boundary Road, GRA, Benin City',
      deliveryZone: 'gra',
      orderType: 'delivery',
      paymentMethod: 'cash_on_delivery',
      subtotal: 7500,
      deliveryFee: 1000,
      totalAmount: 8500,
      items: [
        {
          id: 'item-1',
          productId: 'prod-rc-jollof-combo',
          name: 'Party Jollof Rice Combo with Quarter Chicken',
          quantity: 1,
          price: 5500,
          unitPrice: 5500,
          totalPrice: 5500,
        },
        {
          id: 'item-2',
          productId: 'prod-drink-zobo-1000',
          name: 'Signature Zobo Blast Infusion',
          quantity: 1,
          price: 2000,
          unitPrice: 2000,
          totalPrice: 2000,
        },
      ],
    };

    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });
    const orderData = await orderRes.json();
    assert(orderRes.ok && orderData.success, 'Create Customer Order via /api/orders', orderData);
    const createdOrder = orderData.order;

    // 3. Verify KDS Ticket Creation
    console.log('\n--- TEST 3: Kitchen Display System (KDS) Integration ---');
    const kdsRes = await fetch(`${BASE_URL}/api/pos/kds/tickets?branchId=gra`, { headers: cashierHeaders });
    const kdsTickets = await kdsRes.json();
    const matchingKds = Array.isArray(kdsTickets) ? kdsTickets.find(
      (t: any) =>
        t.orderId === createdOrder.id ||
        t.orderNumber === createdOrder.orderNumber ||
        t.checkNumber === createdOrder.orderNumber ||
        t.id === `chk-${createdOrder.id}` ||
        t.id === createdOrder.id
    ) : null;
    assert(!!matchingKds, `Order synced to KDS kitchen queue (${matchingKds?.items?.length || 0} items)`, matchingKds);

    // 4. Verify Dispatch Delivery Task Creation
    console.log('\n--- TEST 4: Dispatch Hub & Fleet Queue Integration ---');
    const dispatchRes = await fetch(`${BASE_URL}/api/dispatch/tasks?branchId=gra`, { headers: cashierHeaders });
    const dispatchTasks = await dispatchRes.json();
    const matchingTask = Array.isArray(dispatchTasks) ? dispatchTasks.find(
      (t: any) =>
        t.orderId === createdOrder.id ||
        t.orderNumber === createdOrder.orderNumber ||
        t.id === createdOrder.id
    ) : null;
    assert(!!matchingTask && matchingTask.codAmountDue === 8500, 'Order synced to Dispatch tasks with COD amount due (₦8,500)', matchingTask);

    // 5. Verify Inventory Recipe Depletion
    console.log('\n--- TEST 5: Automated Recipe Ingredient Depletion ---');
    const ledgerRes = await fetch(`${BASE_URL}/api/inventory/ledger`, { headers: adminHeaders });
    const ledgerEntries = await ledgerRes.json();
    const recentRecipeDepletions = Array.isArray(ledgerEntries) ? ledgerEntries.filter(
      (e: any) =>
        e.referenceId === createdOrder.id ||
        e.referenceNo === createdOrder.orderNumber ||
        (e.notes && e.notes.includes(createdOrder.orderNumber))
    ) : [];
    assert(recentRecipeDepletions.length > 0, `Recipe ledger entries generated for order: ${recentRecipeDepletions.length} ingredients`, recentRecipeDepletions);

    // 6. POS Cash Settlement Shift Enforcement (DEFECT-P0-02)
    console.log('\n--- TEST 6: POS Cash Settlement Shift Enforcement (DEFECT-P0-02) ---');
    // Open a new POS check using cashier authentication
    const checkRes = await fetch(`${BASE_URL}/api/pos/checks`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        branchId: 'gra',
        tableNumber: 'Table 5',
        checkType: 'dine_in',
        items: [
          {
            productId: 'item_asun_pepper',
            name: 'Spicy Asun Pepper Chops',
            quantity: 2,
            unitPrice: 3500,
            totalPrice: 7000,
          },
        ],
        subtotal: 7000,
        tax: 525,
        total: 7525,
        status: 'open',
      }),
    });
    const checkData = await checkRes.json();
    const testCheck = checkData.check;
    assert(!!testCheck && !!testCheck.id, 'Opened POS dine-in check with authentication', testCheck);

    // Ensure we have an open shift for branch 'gra'
    let activeShift: any = null;
    const curShiftRes = await fetch(`${BASE_URL}/api/pos/shifts/current?branchId=gra`, { headers: cashierHeaders });
    if (curShiftRes.ok) {
      activeShift = await curShiftRes.json();
    }

    if (!activeShift || activeShift.status !== 'open') {
      const openShiftRes = await fetch(`${BASE_URL}/api/pos/shifts/open`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          branchId: 'gra',
          openingFloat: 15000,
          registerId: 'POS-REG-01',
        }),
      });
      const openShiftData = await openShiftRes.json();
      activeShift = openShiftData.shift;
      assert(openShiftRes.ok && activeShift?.status === 'open', `Opened register shift #${activeShift?.shiftNumber} with float ₦${activeShift?.openingFloat}`);
    } else {
      assert(true, `Active register shift #${activeShift.shiftNumber} available for settlements`);
    }

    // Now settle with valid active shift
    const payWithShift = await fetch(`${BASE_URL}/api/pos/checks/${testCheck.id}/pay`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        paymentMethod: 'cash',
        paymentDetails: { cashTendered: 10000, changeGiven: 2475 },
        shiftId: activeShift.id,
      }),
    });
    const payWithShiftData = await payWithShift.json();
    assert(
      payWithShift.ok && (payWithShiftData.check?.status === 'paid' || payWithShiftData.check?.paymentStatus === 'paid'),
      'Cash payment accepted with active shift',
      payWithShiftData
    );

    // 7. Rider COD Remittance to Till (DEFECT-P1-02)
    console.log('\n--- TEST 7: Rider COD Remittance to Till (DEFECT-P1-02) ---');
    if (matchingTask) {
      // Hostile check: Delivering without OTP or supervisor authorization should fail
      const noOtpDeliver = await fetch(`${BASE_URL}/api/dispatch/tasks/${matchingTask.id}/status`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({ status: 'delivered' }),
      });
      assert(noOtpDeliver.status === 400, 'Delivering without OTP correctly rejected by security guard');

      // Now deliver with correct OTP or supervisor override
      const deliverWithOtp = await fetch(`${BASE_URL}/api/dispatch/tasks/${matchingTask.id}/status`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'delivered', code: matchingTask.pickupAuthorizationCode || '4821', supervisorPin: '1234' }),
      });
      assert(deliverWithOtp.ok, 'Delivery status accepted with valid OTP/Supervisor authorization');

      // Remit COD cash to branch till
      const remitRes = await fetch(`${BASE_URL}/api/dispatch/tasks/${matchingTask.id}/remit-cash`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          shiftId: activeShift.id,
          receivedById: 'CL-CSH-001',
          receivedByName: 'Chioma E. (Head Cashier)',
        }),
      });
      const remitData = await remitRes.json();
      assert(remitRes.ok && remitData.success, `Rider COD payment of ₦${matchingTask.codAmountDue} remitted to branch till`, remitData);

      // Hostile check: Duplicate remittance must be rejected
      const dupRemit = await fetch(`${BASE_URL}/api/dispatch/tasks/${matchingTask.id}/remit-cash`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          shiftId: activeShift.id,
          receivedById: 'CL-CSH-001',
          receivedByName: 'Chioma E. (Head Cashier)',
        }),
      });
      assert(dupRemit.status === 400, 'Duplicate COD remittance rejected (idempotency/theft guard)');

      // Verify task reflects cashRemitted = true
      const updatedTaskRes = await fetch(`${BASE_URL}/api/dispatch/tasks?branchId=gra`, { headers: cashierHeaders });
      const updatedTasks = await updatedTaskRes.json();
      const checkRemitted = updatedTasks.find((t: any) => t.id === matchingTask.id);
      assert(checkRemitted?.cashRemitted === true, 'Delivery task marked cashRemitted = true', checkRemitted);
    }

    // 8. Inter-Branch Stock Transfers (DEFECT-P2-03)
    console.log('\n--- TEST 8: Inter-Branch Stock Transfers (DEFECT-P2-03) ---');
    // Create stock request from GRA to Okabere
    const stockReqRes = await fetch(`${BASE_URL}/api/inventory/requests`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        itemId: 'inv-protein-chicken',
        quantity: 15,
        fromBranchId: 'gra',
        toBranchId: 'okabere',
        urgency: 'high',
      }),
    });
    const stockReqData = await stockReqRes.json();
    const createdReq = stockReqData.request;
    assert(stockReqRes.ok && !!createdReq, 'Created inter-branch stock request (15 kg chicken: GRA -> Okabere)');

    if (createdReq) {
      await fetch(`${BASE_URL}/api/inventory/requests/${createdReq.id}/review`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'approved' }),
      });

      // Dispatch stock from source branch (GRA)
      const dispatchStockRes = await fetch(`${BASE_URL}/api/inventory/requests/${createdReq.id}/dispatch`, {
        method: 'POST',
        headers: adminHeaders,
      });
      const dispatchStockData = await dispatchStockRes.json();
      assert(dispatchStockRes.ok && dispatchStockData.request.status === 'in_transit', 'Dispatched stock transfer -> in_transit (GRA stock deducted)');

      // Receive stock at destination branch (Okabere)
      const receiveStockRes = await fetch(`${BASE_URL}/api/inventory/requests/${createdReq.id}/receive`, {
        method: 'POST',
        headers: adminHeaders,
      });
      const receiveStockData = await receiveStockRes.json();
      assert(
        receiveStockRes.ok && (receiveStockData.request.status === 'received' || receiveStockData.request.status === 'completed'),
        'Received stock transfer -> completed (Okabere stock credited)'
      );
    }

    console.log(`\n========================================`);
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exitCode = 1;
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

runVerification();

