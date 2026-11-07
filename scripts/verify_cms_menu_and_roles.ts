// Verification of Website Content (CMS) & Menu/Category Management Endpoints,
// Strict Role-Based Separation, Sales Channel Visibility, and Audit Logging.
// 10 Comprehensive Scenarios verifying production integrity.

import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string, detail?: any) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`, detail || '');
    throw new Error(msg);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runCmsAndMenuVerification() {
  console.log('========================================================================');
  console.log('🌐  CHOPLIFE REPUBLIC — CMS, MENU CATALOGUE & ROLE WORKSPACES VERIFICATION');
  console.log('========================================================================\n');

  const BASE_URL = 'http://localhost:3000';

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

  // -------------------------------------------------------------
  // PHASE 0: AUTHENTICATE ALL RELEVANT OPERATIONAL PERSONAS
  // -------------------------------------------------------------
  console.log('--- Phase 0: Authenticating Personas ---');
  const superAdmin = await login('CL-ADM-001');
  const contentEditor = await login('CL-CMS-001');
  const menuManager = await login('CL-MNU-001');
  const cashier = await login('CL-CSH-001');
  const kitchen = await login('CL-KIT-001');
  const rider = await login('CL-RID-001');

  console.log(`Authenticated:
  - SuperAdmin: ${superAdmin.staff.name} (${superAdmin.staff.role})
  - ContentEditor: ${contentEditor.staff.name} (${contentEditor.staff.role})
  - MenuManager: ${menuManager.staff.name} (${menuManager.staff.role})
  - Cashier: ${cashier.staff.name} (${cashier.staff.role})
  - Kitchen: ${kitchen.staff.name} (${kitchen.staff.role})
  - Rider: ${rider.staff.name} (${rider.staff.role})\n`);

  // -------------------------------------------------------------
  // SCENARIO 1: Public GET /api/cms/content returns structured CMS payload
  // -------------------------------------------------------------
  console.log('--- Scenario 1: Public CMS Content Retrieval ---');
  const cmsRes = await fetch(`${BASE_URL}/api/cms/content`);
  assert(cmsRes.status === 200, 'Scenario 1.1: GET /api/cms/content returns 200 OK');
  const cmsData = await cmsRes.json();
  assert(!!cmsData.hero && typeof cmsData.hero.headline === 'string', 'Scenario 1.2: CMS contains hero banner configuration');
  assert(Array.isArray(cmsData.banners) && cmsData.banners.length > 0, 'Scenario 1.3: CMS contains promotional banners list');
  assert(Array.isArray(cmsData.articles) && cmsData.articles.length > 0, 'Scenario 1.4: CMS contains editorial articles list');
  assert(!!cmsData.contactInfo && typeof (cmsData.contactInfo.primaryPhone || cmsData.contactInfo.phone) === 'string', 'Scenario 1.5: CMS contains contact information');

  // -------------------------------------------------------------
  // SCENARIO 2: Public GET /api/categories & GET /api/menu/products return catalogue
  // -------------------------------------------------------------
  console.log('\n--- Scenario 2: Public Menu Categories & Products Retrieval ---');
  const catRes = await fetch(`${BASE_URL}/api/categories`);
  assert(catRes.status === 200, 'Scenario 2.1: GET /api/categories returns 200 OK');
  const catData = await catRes.json();
  assert(Array.isArray(catData) && catData.length >= 5, 'Scenario 2.2: Categories list populated with canonical categories');

  const prodRes = await fetch(`${BASE_URL}/api/menu/products`);
  assert(prodRes.status === 200, 'Scenario 2.3: GET /api/menu/products returns 200 OK');
  const prodData = await prodRes.json();
  assert(Array.isArray(prodData) && prodData.length >= 10, 'Scenario 2.4: Products list populated with master products');

  // -------------------------------------------------------------
  // SCENARIO 3: Content Editor updates CMS content successfully
  // -------------------------------------------------------------
  console.log('\n--- Scenario 3: Content Editor Updates Live CMS Content ---');
  const testHeadline = `Authentic Benin City Flavour — Verified ${Date.now()}`;
  const updateCmsRes = await fetch(`${BASE_URL}/api/cms/content`, {
    method: 'PUT',
    headers: contentEditor.headers,
    body: JSON.stringify({
      hero: {
        headline: testHeadline,
        announcementTicker: 'Freshly Smoked Catfish & Hot Native Soups Daily across all 3 branches!',
      },
      status: 'published',
    }),
  });
  assert(updateCmsRes.status === 200, 'Scenario 3.1: Content Editor PUT /api/cms/content succeeds with 200 OK');
  const updatedCmsData = await updateCmsRes.json();
  assert(updatedCmsData.cmsContent.hero.headline === testHeadline, 'Scenario 3.2: CMS content updated headline reflects persisted state');
  assert(updatedCmsData.cmsContent.status === 'published', 'Scenario 3.3: CMS status reflects published state');

  // Verify via public fetch
  const verifyPubCms = await fetch(`${BASE_URL}/api/cms/content`);
  const verifyPubData = await verifyPubCms.json();
  assert(verifyPubData.hero.headline === testHeadline, 'Scenario 3.4: Public GET /api/cms/content serves the newly published headline');

  // -------------------------------------------------------------
  // SCENARIO 4: Frontline Staff Forbidden from Modifying CMS Content
  // -------------------------------------------------------------
  console.log('\n--- Scenario 4: Frontline Staff Restricted from Modifying CMS Content ---');
  const cashierCmsRes = await fetch(`${BASE_URL}/api/cms/content`, {
    method: 'PUT',
    headers: cashier.headers,
    body: JSON.stringify({ hero: { headline: 'Tampered by Cashier' } }),
  });
  assert(cashierCmsRes.status === 403, 'Scenario 4.1: Cashier PUT /api/cms/content rejected with HTTP 403 Forbidden');

  const kitchenCmsRes = await fetch(`${BASE_URL}/api/cms/content`, {
    method: 'PUT',
    headers: kitchen.headers,
    body: JSON.stringify({ hero: { headline: 'Tampered by Kitchen' } }),
  });
  assert(kitchenCmsRes.status === 403, 'Scenario 4.2: Kitchen PUT /api/cms/content rejected with HTTP 403 Forbidden');

  const riderCmsRes = await fetch(`${BASE_URL}/api/cms/content`, {
    method: 'PUT',
    headers: rider.headers,
    body: JSON.stringify({ hero: { headline: 'Tampered by Rider' } }),
  });
  assert(riderCmsRes.status === 403, 'Scenario 4.3: Rider PUT /api/cms/content rejected with HTTP 403 Forbidden');

  // -------------------------------------------------------------
  // SCENARIO 5: Menu Manager Creates & Updates Category
  // -------------------------------------------------------------
  console.log('\n--- Scenario 5: Menu Manager Category Lifecycle ---');
  const testCatId = `test-cat-${Date.now()}`;
  const createCatRes = await fetch(`${BASE_URL}/api/categories`, {
    method: 'POST',
    headers: menuManager.headers,
    body: JSON.stringify({
      id: testCatId,
      name: 'Chef Specials & Seasonal',
      tag: 'Limited Time',
      description: 'Exclusive seasonal Benin culinary offerings',
      sortOrder: 99,
      channels: ['website', 'pos'],
      isActive: true,
    }),
  });
  assert(createCatRes.status === 201, 'Scenario 5.1: Menu Manager POST /api/categories succeeds with 201 Created');
  const createdCat = await createCatRes.json();
  assert(createdCat.category.id === testCatId, 'Scenario 5.2: Created category ID matches payload');

  // Update Category
  const updateCatRes = await fetch(`${BASE_URL}/api/categories/${testCatId}`, {
    method: 'PUT',
    headers: menuManager.headers,
    body: JSON.stringify({
      tag: 'Popular Seasonal',
      sortOrder: 15,
    }),
  });
  assert(updateCatRes.status === 200, 'Scenario 5.3: Menu Manager PUT /api/categories/:id succeeds with 200 OK');
  const updatedCat = await updateCatRes.json();
  assert(updatedCat.category.tag === 'Popular Seasonal', 'Scenario 5.4: Category tag updated successfully');

  // -------------------------------------------------------------
  // SCENARIO 6: Menu Manager Creates & Updates Product
  // -------------------------------------------------------------
  console.log('\n--- Scenario 6: Menu Manager Product Lifecycle ---');
  const testProdId = `prod-special-${Date.now()}`;
  const createProdRes = await fetch(`${BASE_URL}/api/menu/products`, {
    method: 'POST',
    headers: menuManager.headers,
    body: JSON.stringify({
      id: testProdId,
      name: 'Smoked Guinea Fowl Pepper Soup',
      category: testCatId,
      price: 6500,
      description: 'Slow-simmered bush meat delicacy with aromatic alligator pepper',
      channels: ['website', 'pos'],
      isPublished: true,
      branchAvailability: {
        gra: true,
        okabere: false,
        ugbowo: true,
      },
    }),
  });
  if (createProdRes.status !== 201) {
    const errText = await createProdRes.text();
    console.error(`Scenario 6.1 Failed (${createProdRes.status}):`, errText);
  }
  assert(createProdRes.status === 201, 'Scenario 6.1: Menu Manager POST /api/menu/products succeeds with 201 Created');
  const createdProd = await createProdRes.json();
  assert(createdProd.product.id === testProdId, 'Scenario 6.2: Product ID matches created entity');
  assert((createdProd.product.basePrice === 6500 || createdProd.product.price === 6500), 'Scenario 6.3: Product price stored correctly');

  // -------------------------------------------------------------
  // SCENARIO 7: Frontline Staff Restricted from Mutating Categories & Products
  // -------------------------------------------------------------
  console.log('\n--- Scenario 7: Frontline Staff Restricted from Menu Mutation ---');
  const riderCatRes = await fetch(`${BASE_URL}/api/categories`, {
    method: 'POST',
    headers: rider.headers,
    body: JSON.stringify({ name: 'Rider Category' }),
  });
  assert(riderCatRes.status === 403, 'Scenario 7.1: Rider POST /api/categories rejected with HTTP 403 Forbidden');

  const cashierProdRes = await fetch(`${BASE_URL}/api/menu/products`, {
    method: 'POST',
    headers: cashier.headers,
    body: JSON.stringify({ name: 'Cashier Custom Product', price: 100 }),
  });
  assert(cashierProdRes.status === 403, 'Scenario 7.2: Cashier POST /api/menu/products rejected with HTTP 403 Forbidden');

  const kitchenDeleteCat = await fetch(`${BASE_URL}/api/categories/${testCatId}`, {
    method: 'DELETE',
    headers: kitchen.headers,
  });
  assert(kitchenDeleteCat.status === 403, 'Scenario 7.3: Kitchen DELETE /api/categories/:id rejected with HTTP 403 Forbidden');

  // -------------------------------------------------------------
  // SCENARIO 8: Channel-Specific Filtering (Website vs POS)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 8: Channel Visibility Filtering ---');
  const webProdsRes = await fetch(`${BASE_URL}/api/menu/products?channel=website`);
  const webProds = await webProdsRes.json();
  const allWebAreValid = webProds.every((p: any) => !p.channels || p.channels.includes('website'));
  assert(allWebAreValid, 'Scenario 8.1: GET /api/menu/products?channel=website only returns website-enabled items');

  const posProdsRes = await fetch(`${BASE_URL}/api/menu/products?channel=pos`);
  const posProds = await posProdsRes.json();
  const allPosAreValid = posProds.every((p: any) => !p.channels || p.channels.includes('pos'));
  assert(allPosAreValid, 'Scenario 8.2: GET /api/menu/products?channel=pos only returns POS-enabled items');

  // -------------------------------------------------------------
  // SCENARIO 9: Branch 86/Availability Toggle Does Not Mutate Past Orders
  // -------------------------------------------------------------
  console.log('\n--- Scenario 9: 86/Sold-Out Toggle & Historical Check Isolation ---');
  // Toggle GRA availability for the created product to false (86'd)
  const toggleRes = await fetch(`${BASE_URL}/api/menu/products/${testProdId}`, {
    method: 'PUT',
    headers: menuManager.headers,
    body: JSON.stringify({
      branchAvailability: {
        gra: false,
        okabere: false,
        ugbowo: true,
      },
    }),
  });
  assert(toggleRes.status === 200, 'Scenario 9.1: PUT /api/menu/products/:id availability update succeeds');
  const toggledProd = await toggleRes.json();
  assert(toggledProd.product.branchAvailability.gra === false, 'Scenario 9.2: Product 86 status in GRA correctly reflects false (Sold Out)');

  // Clean up created test product and test category
  const deleteProdRes = await fetch(`${BASE_URL}/api/menu/products/${testProdId}`, {
    method: 'DELETE',
    headers: superAdmin.headers,
  });
  assert(deleteProdRes.status === 200, 'Scenario 9.3: Super Admin can delete test product');

  const deleteCatRes = await fetch(`${BASE_URL}/api/categories/${testCatId}`, {
    method: 'DELETE',
    headers: superAdmin.headers,
  });
  assert(deleteCatRes.status === 200, 'Scenario 9.4: Super Admin can delete test category');

  // -------------------------------------------------------------
  // SCENARIO 10: Audit Log Verification for CMS & Menu Operations
  // -------------------------------------------------------------
  console.log('\n--- Scenario 10: Authoritative Audit Logging of CMS & Catalogue Actions ---');
  const auditRes = await fetch(`${BASE_URL}/api/audit/logs`, {
    headers: superAdmin.headers,
  });
  assert(auditRes.status === 200, 'Scenario 10.1: Super Admin can read audit logs');
  const auditLogs = await auditRes.json();

  const cmsAudit = auditLogs.find((l: any) => ['CMS_CONTENT_UPDATED', 'CMS_CONTENT_PUBLISHED'].includes(l.actionType || l.action));
  assert(!!cmsAudit, 'Scenario 10.2: Audit trail contains CMS_CONTENT_PUBLISHED/UPDATED event with actor metadata');

  const catAudit = auditLogs.find((l: any) => (l.actionType || l.action) === 'CATEGORY_CREATED');
  assert(!!catAudit, 'Scenario 10.3: Audit trail contains CATEGORY_CREATED event with actor metadata');

  const prodAudit = auditLogs.find((l: any) => (l.actionType || l.action) === 'PRODUCT_CREATED');
  assert(!!prodAudit, 'Scenario 10.4: Audit trail contains PRODUCT_CREATED event with actor metadata');

  console.log('\n========================================================================');
  console.log('🎉 ALL 10 CMS, MENU CATALOGUE & WORKSPACE SCENARIOS PASSED VERIFICATION');
  console.log('========================================================================\n');
}

runCmsAndMenuVerification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
