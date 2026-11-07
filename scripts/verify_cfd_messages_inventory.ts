import http from 'http';

function request(method: string, urlStr: string, headers: any = {}, data: any = null): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Running Choplife Republic Production Readiness Verification ---');

  // 1. Login
  const loginRes = await request('POST', 'http://localhost:3000/api/auth/staff/login', {}, {
    email: 'admin@choplife.ng',
    password: 'ChopLife2025!',
  });
  console.log('1. Admin login status:', loginRes.status, loginRes.data.success);
  const token = loginRes.data.token;

  // 2. Messages & Alerts Zero State & Purge Test Records
  await request('POST', 'http://localhost:3000/api/notifications/purge-test-records', {
    Authorization: `Bearer ${token}`,
  });

  const statsRes = await request('GET', 'http://localhost:3000/api/notifications/stats', {
    Authorization: `Bearer ${token}`,
  });
  console.log('2. Notifications stats:', statsRes.data);

  // 3. CFD Neutral Welcome Screen
  const cfdRes = await request('GET', 'http://localhost:3000/api/cfd/display-screen?branchId=gra');
  console.log('3. CFD screen (0 promos):', {
    promotionsCount: cfdRes.data.promotions.length,
    welcomeTitle: cfdRes.data.welcomeScreen.brandTitle,
    hasPromotions: cfdRes.data.welcomeScreen.hasPromotions,
  });
  if (cfdRes.data.promotions.length !== 0) throw new Error('Expected 0 promotions in virgin state');

  // 4. Create promotion
  const menuRes = await request('GET', 'http://localhost:3000/api/menu/products?channel=pos&status=published');
  const testProduct = menuRes.data[0];
  console.log('Selected test product for promotion:', testProduct.name, testProduct.id);

  const createPromoRes = await request('POST', 'http://localhost:3000/api/promotions', {
    Authorization: `Bearer ${token}`,
  }, {
    title: 'Weekend Woodfire Special',
    subtitle: '20% off selected grills',
    productId: testProduct.id,
    promotionType: 'discount_percentage',
    discountPercent: 20,
    branches: ['gra'],
    staffId: 'staff-admin-01',
    staffName: 'Admin Staff',
  });
  const promoId = createPromoRes.data.promotion.id;
  console.log('4. Created promotion ID:', promoId);

  // 5. Test Segregation of Duties (self-approval block)
  const sodRes = await request('POST', `http://localhost:3000/api/promotions/${promoId}/approve`, {
    Authorization: `Bearer ${token}`,
  }, {
    staffId: 'staff-admin-01',
    staffName: 'Admin Staff',
    role: 'branch_manager',
  });
  console.log('5. Self-approval status (expected 403):', sodRes.status, sodRes.data.error);
  if (sodRes.status !== 403) throw new Error('Expected 403 forbidden on self-approval');

  // 6. Super Admin Approval
  const approveRes = await request('POST', `http://localhost:3000/api/promotions/${promoId}/approve`, {
    Authorization: `Bearer ${token}`,
  }, {
    staffId: 'staff-super-01',
    staffName: 'Super Administrator',
    role: 'super_admin',
  });
  console.log('6. Approved promotion status:', approveRes.status, approveRes.data.promotion.approvalStatus);

  // 7. Verify CFD now shows the promotion
  const cfdRes2 = await request('GET', 'http://localhost:3000/api/cfd/display-screen?branchId=gra');
  console.log('7. CFD promotions count after approval:', cfdRes2.data.promotions.length);
  if (cfdRes2.data.promotions.length !== 1) throw new Error('Expected 1 approved active promotion');

  // 8. Archive product and verify auto-revocation
  const archiveRes = await request('PUT', `http://localhost:3000/api/menu/products/${testProduct.id}`, {
    Authorization: `Bearer ${token}`,
  }, {
    status: 'archived',
  });
  console.log('8. Archive product status:', archiveRes.status);

  const cfdRes3 = await request('GET', 'http://localhost:3000/api/cfd/display-screen?branchId=gra');
  console.log('9. CFD promotions count after product archiving:', cfdRes3.data.promotions.length);
  if (cfdRes3.data.promotions.length !== 0) throw new Error('Expected 0 promotions after archiving product');

  console.log('--- ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ---');
}

runTests().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
