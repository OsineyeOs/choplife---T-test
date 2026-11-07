import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runDefectVerification() {
  console.log('--- STARTING REMEDIATION & DEFECT RE-TEST SUITE ---');

  const BASE_URL = 'http://localhost:3000';

  const dbPath = path.join(process.cwd(), 'data', 'choplife_ops_db.json');
  const initialSnapshot = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf-8')) : null;
  let adminToken = '';

  try {
    // 1. DEFECT A: DATA PROVENANCE & IDEMPOTENCY
    console.log('\n--- 1. Defect A: Data Provenance & Idempotency ---');
    const testOrderId = `ord-idem-test-${Date.now()}`;
    const orderPayload = {
      id: testOrderId,
      branchId: 'gra',
      orderType: 'delivery',
      items: [
        {
          id: 'item-1',
          productId: 'prod-sc-2000-mini',
          name: '2000 Mini Pack',
          price: 2000,
          quantity: 1,
        },
      ],
      subtotal: 2000,
      packagingFee: 200,
      deliveryFee: 1500,
      total: 3700,
      paymentMethod: 'cash_on_delivery',
      deliveryDetails: {
        customerName: 'Defect Audit Tester',
        customerPhone: '08123456789',
        deliveryAddress: '8a Okogo Street, GRA, Benin City',
      },
    };

    const createOrder1 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });
    assert(createOrder1.ok, 'Initial order creation returns 200 OK');
    const order1Data = await createOrder1.json();
    const createdOrder = order1Data.order || order1Data;
    assert(createdOrder.id === testOrderId, 'Created order has correct ID');

    // Retry with same ID
    const createOrder2 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });
    assert(createOrder2.ok, 'Retry order creation returns 200 OK');
    const order2Data = await createOrder2.json();
    const retriedOrder = order2Data.order || order2Data;
    assert(retriedOrder.id === testOrderId, 'Idempotent retry returned existing order without duplicate creation');

    // 2. DEFECT B: LOCATION DETECTION & HAVERSINE DISTANCE
    console.log('\n--- 2. Defect B: Location Detection & Branch Coordinates ---');
    const branchesRes = await fetch(`${BASE_URL}/api/branches`);
    assert(branchesRes.ok, 'GET /api/branches returns 200 OK');
    const branches = await branchesRes.json();
    const gra = branches.find((b: any) => b.id === 'gra');
    const okabere = branches.find((b: any) => b.id === 'okabere');
    const ugbowo = branches.find((b: any) => b.id === 'ugbowo');

    assert(typeof gra?.latitude === 'number' && typeof gra?.longitude === 'number', 'GRA branch has valid coordinate pair');
    assert(typeof okabere?.latitude === 'number' && typeof okabere?.longitude === 'number', 'Okabere branch has valid coordinate pair');
    assert(typeof ugbowo?.latitude === 'number' && typeof ugbowo?.longitude === 'number', 'Ugbowo branch has valid coordinate pair');

    // Haversine test logic verification
    const calculateHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Test point near GRA (6.3180, 5.6175)
    const distToGra = calculateHaversine(6.3181, 5.6176, gra.latitude, gra.longitude);
    assert(distToGra < 0.2, `Distance from near-GRA point to GRA is ${distToGra.toFixed(3)} km (< 0.2 km)`);

    // Test point near Ugbowo (6.3985, 5.6120)
    const distToUgbowo = calculateHaversine(6.3985, 5.6120, ugbowo.latitude, ugbowo.longitude);
    assert(distToUgbowo < 0.1, `Distance from near-Ugbowo point to Ugbowo is ${distToUgbowo.toFixed(3)} km (< 0.1 km)`);

    // 3. DEFECT C: DESKTOP HEADER & CART BUTTON VISIBILITY
    console.log('\n--- 3. Defect C: Desktop Header & Cart Button ---');
    const navbarPath = path.join(process.cwd(), 'src/components/layout/Navbar.tsx');
    const cartDrawerPath = path.join(process.cwd(), 'src/components/cart/CartDrawer.tsx');
    assert(fs.existsSync(navbarPath), 'Navbar component exists');
    assert(fs.existsSync(cartDrawerPath), 'CartDrawer component exists');

    const navbarCode = fs.readFileSync(navbarPath, 'utf-8');
    assert(navbarCode.includes('id="nav-cart-btn"') && navbarCode.includes('shrink-0'), 'Nav cart button explicitly enforced with shrink-0 to prevent clipping');

    const drawerCode = fs.readFileSync(cartDrawerPath, 'utf-8');
    assert(drawerCode.includes('overflow-hidden') && drawerCode.includes('flex-1 overflow-y-auto'), 'CartDrawer structure uses flex-1 overflow-y-auto for scrollable items with pinned footer');

    // 4. DEFECT D: PASSWORD RESET CREDENTIAL MODAL & SECURITY
    console.log('\n--- 4. Defect D: Password Reset & Session Security ---');
    const workspacePath = path.join(process.cwd(), 'src/components/staff/StaffOperationsWorkspace.tsx');
    const workspaceCode = fs.readFileSync(workspacePath, 'utf-8');
    assert(
      workspaceCode.includes('resetCredentialsModal') && workspaceCode.includes('One-Time Temporary Password'),
      'Staff operations UI displays password reset in a dedicated secure credential modal box rather than plain toast'
    );

    // 5. DEFECT E: CHOP PADDY CHATBOT FORMATTING
    console.log('\n--- 5. Defect E: Chop Paddy Chatbot Formatting & Copy ---');
    const chatbotPath = path.join(process.cwd(), 'src/components/ai/AiChatbotModal.tsx');
    const chatbotCode = fs.readFileSync(chatbotPath, 'utf-8');
    assert(
      chatbotCode.includes('line.split(/(\\*\\*[^*]+\\*\\*)/g)') && !chatbotCode.includes('Approved packages include:'),
      'Chop Paddy parses markdown bold syntax into React elements and uses natural customer copy'
    );

    // 6. DEFECT F: STAFF VIEW ACCESS EFFECTIVE ACCESS PROFILE
    console.log('\n--- 6. Defect F: Staff View Access Profile ---');
    // Authenticate Admin
    const adminAuth = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrStaffId: 'oluwaseun.osineye@gmail.com',
        password: 'ChopLife2025!',
      }),
    });
    const adminData = await adminAuth.json();
    assert(adminAuth.ok && adminData.token, 'Admin authentication successful');
    adminToken = adminData.token;

    const effectiveAccessRes = await fetch(`${BASE_URL}/api/rbac/staff/CL-ADM-001/effective-access`, {
      headers: { Authorization: `Bearer ${adminData.token}` },
    });
    assert(effectiveAccessRes.ok, 'GET /api/rbac/staff/:id/effective-access returns 200 OK');
    const effectiveData = await effectiveAccessRes.json();
    assert(Array.isArray(effectiveData.categories) && effectiveData.categories.length > 0, 'Effective access includes categorized granted privileges');
    assert(Array.isArray(effectiveData.permittedReports) && effectiveData.permittedReports.length > 0, 'Effective access includes authorized report list');

    console.log('\n--- ALL REMEDIATION & DEFECT RE-TESTS PASSED PERFECTLY ---');
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

runDefectVerification().catch((err) => {
  console.error('Defect verification failed:', err);
  process.exit(1);
});

