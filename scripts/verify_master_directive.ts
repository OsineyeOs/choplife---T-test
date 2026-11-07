import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3000';

async function loginStaff(emailOrStaffId: string, password = 'ChopLife2025!'): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrStaffId, password }),
  });
  const data = await res.json();
  assert.equal(res.status, 200, `Login failed for ${emailOrStaffId}: ${JSON.stringify(data)}`);
  assert.ok(data.token, 'Expected session token');
  return data.token;
}

async function runVerification() {
  console.log('=== CHOPLIFE REPUBLIC — MASTER DIRECTIVE VERIFICATION SUITE ===');
  let passed = 0;

  const adminToken = await loginStaff('CL-ADM-001');
  const accountantToken = await loginStaff('CL-ACC-001');
  const editorToken = await loginStaff('CL-CMS-001');
  const storekeeperToken = await loginStaff('CL-STK-001');
  const kitchenToken = await loginStaff('CL-KIT-001');

  // 1. Password Policy & Recovery PIN Generation + Token Invalidation
  console.log('\n[1/7] Verifying Password Policy, Recovery PIN Generation & Single-Use Invalidation...');
  {
    // Weak password rejected
    const weakRes = await fetch(`${BASE_URL}/api/staff/accounts/CL-CSH-001/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ temporaryPassword: 'onlyletters' }),
    });
    assert.equal(weakRes.status, 400, 'Expected weak password without number/symbol to be rejected');

    // Generate first recovery PIN
    const pinRes1 = await fetch(`${BASE_URL}/api/staff/accounts/CL-CSH-001/generate-reset-pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pinData1 = await pinRes1.json();
    assert.equal(pinRes1.status, 200);
    assert.ok(pinData1.recoveryPin?.startsWith('CL-'), 'Expected CL-XXXXXX recovery PIN');

    // Generate second recovery PIN (must invalidate first PIN)
    const pinRes2 = await fetch(`${BASE_URL}/api/staff/accounts/CL-CSH-001/generate-reset-pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pinData2 = await pinRes2.json();
    assert.equal(pinRes2.status, 200);
    assert.notEqual(pinData1.recoveryPin, pinData2.recoveryPin);

    // Attempt to use invalidated first PIN
    const oldPinAttempt = await fetch(`${BASE_URL}/api/auth/staff/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pinData1.recoveryPin, newPassword: 'ChopLife2025!' }),
    });
    assert.equal(oldPinAttempt.status, 400, 'First recovery PIN must be invalidated when a new PIN is issued');

    // Use valid second PIN
    const validPinAttempt = await fetch(`${BASE_URL}/api/auth/staff/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pinData2.recoveryPin, newPassword: 'ChopLife2025!' }),
    });
    assert.equal(validPinAttempt.status, 200, 'Valid recovery PIN should reset password');

    // Attempt to reuse second PIN (single-use check)
    const reuseAttempt = await fetch(`${BASE_URL}/api/auth/staff/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pinData2.recoveryPin, newPassword: 'ChopLife2025!' }),
    });
    assert.equal(reuseAttempt.status, 400, 'Recovery PIN must be single-use');
    console.log('  ✓ Password complexity policy, PIN generation, prior-PIN invalidation, and single-use verified.');
    passed++;
  }

  // 2. Payment Config, Bank Transfer Submission, Staff Reconciliation & Refund Ledger
  console.log('\n[2/7] Verifying Payment Config, Bank Transfer Reconciliation & Refund Ledger...');
  {
    const cfgRes = await fetch(`${BASE_URL}/api/payments/config`);
    const cfg = await cfgRes.json();
    assert.equal(cfgRes.status, 200);
    assert.ok(Array.isArray(cfg.supportedStates) && cfg.supportedStates.includes('reconciliation_required'));
    assert.notEqual(cfg.bankTransfer?.accountNumber, '9948 201 842', 'Fabricated bank account must never be returned');

    // Create an order with bank_transfer
    const ordRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: 'gra',
        orderType: 'delivery',
        paymentMethod: 'bank_transfer',
        items: [{ id: 'sc-mini-pack', name: 'Small Chops Mini Pack', price: 3500, quantity: 2 }],
        deliveryDetails: {
          customerName: 'Efosa Bank-Transfer Tester',
          customerPhone: '08039998877',
          deliveryAddress: '14 Ihama Road, GRA',
          deliveryZone: 'GRA Core',
        },
      }),
    });
    const ordData = await ordRes.json();
    assert.equal(ordRes.status, 201);
    const orderId = ordData.order.id;
    assert.equal(ordData.order.paymentStatus, 'reconciliation_required', 'Bank transfer order must start in reconciliation_required state');

    // Submit transfer reference as customer
    const transferRef = `NIP-SESSION-${Date.now()}`;
    const subRes = await fetch(`${BASE_URL}/api/payments/submit-transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        transferReference: transferRef,
        payerName: 'Efosa Bank-Transfer Tester',
        payerBank: 'Access Bank',
      }),
    });
    const subData = await subRes.json();
    assert.equal(subRes.status, 200);
    assert.equal(subData.paymentStatus, 'reconciliation_required', 'Submitting transfer reference must NOT auto-mark order paid');

    // Kitchen lead cannot confirm bank transfer
    const unauthConfirm = await fetch(`${BASE_URL}/api/payments/confirm-transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId, transferReference: transferRef, decision: 'confirm' }),
    });
    assert.equal(unauthConfirm.status, 403, 'Kitchen lead must not be able to confirm bank transfers');

    // Accountant confirms bank transfer
    const confirmRes = await fetch(`${BASE_URL}/api/payments/confirm-transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountantToken}` },
      body: JSON.stringify({
        orderId,
        transferReference: transferRef,
        decision: 'confirm',
        notes: 'Verified credit alert on corporate bank statement',
      }),
    });
    const confirmData = await confirmRes.json();
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmData.paymentStatus, 'paid');

    // Process full refund via /api/payments/refund
    const refRes = await fetch(`${BASE_URL}/api/payments/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountantToken}` },
      body: JSON.stringify({
        orderId,
        reason: 'Customer requested cancellation prior to dispatch',
      }),
    });
    const refData = await refRes.json();
    assert.equal(refRes.status, 200);
    assert.equal(refData.paymentStatus, 'refunded');
    assert.equal(refData.refund.isFullRefund, true);

    // Duplicate refund must be blocked with 409
    const dupRefRes = await fetch(`${BASE_URL}/api/payments/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountantToken}` },
      body: JSON.stringify({
        orderId,
        reason: 'Duplicate refund attempt',
      }),
    });
    assert.equal(dupRefRes.status, 409, 'Duplicate full refund must be rejected with 409');
    console.log('  ✓ Payment config, bank transfer reconciliation, and refund ledger verified.');
    passed++;
  }

  // 3. Authoritative Server-Side Order Pricing, Branch Price Precedence, Availability & 3 Separated Checkout Notes
  console.log('\n[3/7] Verifying Server-Side Order Pricing, Branch Availability & 3 Separated Note Fields...');
  const testProdId = `prod-audit-${Date.now()}`;
  {
    // Create product with basePrice 4500 and GRA override 5200, Ugbowo unavailable
    const createProdRes = await fetch(`${BASE_URL}/api/menu/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        id: testProdId,
        name: 'Audit Verification Platter',
        category: 'small-chops',
        basePrice: 4500,
        branchPrices: { gra: 5200 },
        branchAvailability: { gra: true, okabere: true, ugbowo: false },
        status: 'published',
      }),
    });
    assert.equal(createProdRes.status, 201);

    // Attempt order at Ugbowo where product is 86'd -> must fail with 400
    const ugbowoOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: 'ugbowo',
        orderType: 'pickup',
        items: [{ productId: testProdId, name: 'Audit Verification Platter', price: 4500, quantity: 1 }],
      }),
    });
    assert.equal(ugbowoOrderRes.status, 400, 'Ordering an 86d product at Ugbowo must be rejected');

    // Place order at GRA with tampered client price (₦50 instead of ₦5,200) and all 3 separated note fields
    const graOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: 'gra',
        orderType: 'delivery',
        paymentMethod: 'cash_on_delivery',
        items: [{ productId: testProdId, name: 'Audit Verification Platter', price: 50, quantity: 2 }],
        deliveryDetails: {
          customerName: 'Osaze Note-Separation Tester',
          customerPhone: '08051112233',
          deliveryAddress: '22 Boundary Road, GRA',
          deliveryZone: 'GRA Core',
          deliveryInstructions: 'Black gate opposite hospital, call security on arrival',
          preparationNotes: 'Extra spicy pepper sauce on the side please',
          specialOccasionNote: 'Happy Birthday Osaze!',
        },
      }),
    });
    const graOrderData = await graOrderRes.json();
    assert.equal(graOrderRes.status, 201);
    assert.equal(graOrderData.order.subtotal, 10400, 'Server must override tampered price 50 with GRA branch price 5200 * 2 = 10400');
    assert.equal(graOrderData.order.deliveryDetails.deliveryInstructions, 'Black gate opposite hospital, call security on arrival');
    assert.equal(graOrderData.order.deliveryDetails.preparationNotes, 'Extra spicy pepper sauce on the side please');
    assert.equal(graOrderData.order.deliveryDetails.specialOccasionNote, 'Happy Birthday Osaze!');
    assert.ok(graOrderData.check.notes.includes('KITCHEN PREP: Extra spicy pepper sauce on the side please'));
    console.log('  ✓ Server-side branch price precedence, 86 availability enforcement, and 3 separated note fields verified.');
    passed++;
  }

  // 4. Referential Integrity Archival on Menu Product Delete
  console.log('\n[4/7] Verifying Menu Product Referential Integrity Archival on Delete...');
  {
    const delProdRes = await fetch(`${BASE_URL}/api/menu/products/${testProdId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const delProdData = await delProdRes.json();
    assert.equal(delProdRes.status, 200);
    assert.equal(delProdData.archived, true, 'Product referenced by an order must be archived, not hard-deleted');
    assert.equal(delProdData.product.status, 'archived');

    // Attempt to order archived product -> must fail with 400
    const archivedOrdRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: 'gra',
        orderType: 'pickup',
        items: [{ productId: testProdId, name: 'Audit Verification Platter', price: 5200, quantity: 1 }],
      }),
    });
    assert.equal(archivedOrdRes.status, 400, 'Archived product must be rejected on new orders');
    console.log('  ✓ Menu product referential integrity archival verified.');
    passed++;
  }

  // 5. CMS Draft vs. Publish Separation
  console.log('\n[5/7] Verifying CMS Draft vs. Live Storefront Publish Separation...');
  {
    const initialPublicRes = await fetch(`${BASE_URL}/api/cms/content`);
    const initialPublic = await initialPublicRes.json();
    const originalHeadline = initialPublic.hero.headline;

    const draftHeadline = `UNPUBLISHED DRAFT HEADLINE ${Date.now()}`;
    const saveDraftRes = await fetch(`${BASE_URL}/api/cms/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editorToken}` },
      body: JSON.stringify({
        hero: { ...initialPublic.hero, headline: draftHeadline },
        status: 'draft',
      }),
    });
    assert.equal(saveDraftRes.status, 200);

    // Public storefront must still see original published headline
    const publicAfterDraftRes = await fetch(`${BASE_URL}/api/cms/content`);
    const publicAfterDraft = await publicAfterDraftRes.json();
    assert.equal(publicAfterDraft.hero.headline, originalHeadline, 'Saving a CMS draft must NOT overwrite live public storefront');

    // Editor draft view must see the new draft headline
    const draftViewRes = await fetch(`${BASE_URL}/api/cms/content?view=draft`);
    const draftView = await draftViewRes.json();
    assert.equal(draftView.hero.headline, draftHeadline, 'Editor draft view must return the saved draft');

    // Restore clean published state
    await fetch(`${BASE_URL}/api/cms/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editorToken}` },
      body: JSON.stringify({
        hero: { ...initialPublic.hero, headline: originalHeadline },
        status: 'published',
      }),
    });
    console.log('  ✓ CMS draft vs. published storefront separation verified.');
    passed++;
  }

  // 6. Genuine Image File Upload with Magic-Byte Signature Verification
  console.log('\n[6/7] Verifying Genuine Image Upload & Magic-Byte Signature Validation...');
  {
    // Disguised text file claiming to be image/png must be rejected
    const fakePngBase64 = Buffer.from('<script>alert("xss")</script>', 'utf8').toString('base64');
    const badUploadRes = await fetch(`${BASE_URL}/api/uploads/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editorToken}` },
      body: JSON.stringify({
        fileName: 'malicious.png',
        mimeType: 'image/png',
        dataBase64: fakePngBase64,
      }),
    });
    assert.equal(badUploadRes.status, 400, 'Disguised non-image binary payload must be rejected');

    // Valid 1x1 PNG binary
    const valid1x1PngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const goodUploadRes = await fetch(`${BASE_URL}/api/uploads/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editorToken}` },
      body: JSON.stringify({
        fileName: 'choplife-banner.png',
        mimeType: 'image/png',
        dataBase64: valid1x1PngBase64,
      }),
    });
    const goodUploadData = await goodUploadRes.json();
    assert.equal(goodUploadRes.status, 201);
    assert.ok(goodUploadData.url.startsWith('/uploads/'));

    // Verify static asset is served
    const servedRes = await fetch(`${BASE_URL}${goodUploadData.url}`);
    assert.equal(servedRes.status, 200);

    // Delete uploaded file
    const delUploadRes = await fetch(`${BASE_URL}/api/uploads/image/${goodUploadData.filename}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    assert.equal(delUploadRes.status, 200);
    console.log('  ✓ Image upload magic-byte verification, static serving, and cleanup verified.');
    passed++;
  }

  // 7. Inventory Separation of Duties
  console.log('\n[7/7] Verifying Inventory Separation of Duties on Stock Indent Approval...');
  {
    const invListRes = await fetch(`${BASE_URL}/api/inventory/items`, {
      headers: { Authorization: `Bearer ${storekeeperToken}` },
    });
    const invList = await invListRes.json();
    const firstItemId = invList[0]?.id || 'inv-001';

    const indentRes = await fetch(`${BASE_URL}/api/inventory/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storekeeperToken}` },
      body: JSON.stringify({
        sourceLocation: 'general_store',
        destinationLocation: 'gra',
        priority: 'normal',
        items: [{ itemId: firstItemId, requestedQty: 2 }],
        notes: 'Verification test indent',
      }),
    });
    const indentData = await indentRes.json();
    assert.equal(indentRes.status, 201);
    const indentId = indentData.request.id;

    // Storekeeper attempting to approve their own indent must be blocked with 403
    const selfApproveRes = await fetch(`${BASE_URL}/api/inventory/requests/${indentId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storekeeperToken}` },
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(selfApproveRes.status, 403, 'Storekeeper must not be allowed to approve their own stock indent');

    // Admin/Manager can approve the indent
    const mgrApproveRes = await fetch(`${BASE_URL}/api/inventory/requests/${indentId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(mgrApproveRes.status, 200);
    console.log('  ✓ Inventory separation of duties on stock indent approval verified.');
    passed++;
  }

  console.log(`\n=== ALL ${passed}/7 MASTER DIRECTIVE VERIFICATION SUITES PASSED ===`);
}

runVerification().catch((err) => {
  console.error('MASTER DIRECTIVE VERIFICATION FAILED:', err);
  process.exit(1);
});
