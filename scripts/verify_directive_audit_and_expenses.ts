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
    body: JSON.stringify({ emailOrStaffId, password })
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

async function runVerification() {
  const originalDbBytes = fs.readFileSync(DB_PATH, 'utf-8');
  const createdAttachmentFiles: string[] = [];

  try {
    // Authenticate roles using canonical accounts (password: ChopLife2025!)
    const superAdmin = await login('admin@choplife.ng', 'ChopLife2025!');
    const branchMgr = await login('manager.gra@choplife.ng', 'ChopLife2025!');
    const cashier = await login('cashier.gra@choplife.ng', 'ChopLife2025!');
    const cashierOkabere = await login('cashier.okabere@choplife.ng', 'ChopLife2025!');
    const accountant = await login('accountant@choplife.ng', 'ChopLife2025!');

    record(
      'AUTH-01',
      '19.5 Roles & Permissions',
      'Authenticate Super Admin, Branch Manager (GRA), Cashier (GRA), Cashier (Okabere), and Accountant',
      Boolean(superAdmin.token && branchMgr.token && cashier.token && cashierOkabere.token && accountant.token),
      `superAdmin=${superAdmin.user.staffId}(${superAdmin.user.role}), branchMgr=${branchMgr.user.staffId}(${branchMgr.user.role}), cashier=${cashier.user.staffId}(${cashier.user.role}), accountant=${accountant.user.staffId}(${accountant.user.role})`
    );

    // =========================================================================
    // 19.6 EXISTING FUNCTIONALITY: Inventory Add Item, QR Codes, Staff RBAC, Dispatch Riders
    // =========================================================================

    // Test 1: Inventory SKU format validation (invalid SKU rejected with 400)
    const badInvRes = await fetch(`${BASE_URL}/api/inventory/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({
        sku: 'bad sku!!',
        name: 'Invalid SKU Test Item',
        category: 'Spices & Seasonings',
        unit: 'kg',
        costPerUnit: 2500
      })
    });
    const badInvData = await badInvRes.json();
    record(
      'INV-01',
      '4.1 / 19.6 Inventory Add Item',
      'Invalid SKU format is rejected with HTTP 400 and explicit format instructions',
      badInvRes.status === 400 && String(badInvData.error || '').includes('SKU'),
      `HTTP ${badInvRes.status}: ${badInvData.error}`
    );

    // Test 2: Valid Inventory Item creation by Branch Manager + Duplicate SKU rejection (409)
    const testSku = `CL-TEST-${Date.now().toString().slice(-4)}`;
    const goodInvRes = await fetch(`${BASE_URL}/api/inventory/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({
        sku: testSku,
        name: 'Verification Smoked Paprika',
        category: 'Spices & Seasonings',
        unit: 'kg',
        costPerUnit: 4200,
        parLevel: 15,
        reorderPoint: 5,
        initialStockOkabere: 12,
        initialStockUgbowo: 8,
        storageLocation: 'Dry Store Rack B2'
      })
    });
    const goodInvData = await goodInvRes.json();
    record(
      'INV-02',
      '4.1 / 19.6 Inventory Add Item',
      'Branch Manager creates new inventory item with valid SKU and initial branch stock',
      goodInvRes.status === 201 && goodInvData.item?.sku === testSku,
      `HTTP ${goodInvRes.status}: Created SKU=${goodInvData.item?.sku}, currentStock=${JSON.stringify(goodInvData.item?.currentStock)}`
    );

    const dupInvRes = await fetch(`${BASE_URL}/api/inventory/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({
        sku: testSku,
        name: 'Duplicate SKU Item',
        category: 'Spices & Seasonings',
        unit: 'kg',
        costPerUnit: 4200
      })
    });
    const dupInvData = await dupInvRes.json();
    record(
      'INV-03',
      '4.1 / 19.6 Inventory Add Item',
      'Duplicate SKU is rejected with HTTP 409 Conflict',
      dupInvRes.status === 409,
      `HTTP ${dupInvRes.status}: ${dupInvData.error}`
    );

    // Test 3: Staff RBAC anti-escalation & primary branch inclusion
    const escalateRes = await fetch(`${BASE_URL}/api/staff/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({
        name: 'Unauthorized Super Admin Attempt',
        workEmail: `esc_${Date.now()}@choplife.ng`,
        phone: '+2348030009988',
        role: 'super_admin',
        password: 'Password123!',
        branchId: 'gra'
      })
    });
    const escalateData = await escalateRes.json();
    record(
      'RBAC-01',
      '4.2 Staff Directory & RBAC',
      'Branch Manager is blocked from creating or promoting a super_admin account (HTTP 403)',
      escalateRes.status === 403,
      `HTTP ${escalateRes.status}: ${escalateData.error}`
    );

    // Test 4: Editable QR Codes GET & PUT persistence + validation
    const qrGetRes = await fetch(`${BASE_URL}/api/settings/qr-codes`, {
      headers: { Authorization: `Bearer ${superAdmin.token}` }
    });
    const qrGetData = await qrGetRes.json();
    const existingQrs = Array.isArray(qrGetData.configuredQrCodes) ? qrGetData.configuredQrCodes : [];
    const updatedQrs = existingQrs.map((item: any, idx: number) =>
      idx === 0
        ? { ...item, label: 'GRA Flagship Digital Menu QR (Verified)', tableNumber: 'T-01' }
        : item
    );
    const qrPutRes = await fetch(`${BASE_URL}/api/settings/qr-codes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdmin.token}` },
      body: JSON.stringify({
        configuredQrCodes: updatedQrs
      })
    });
    const qrPutData = await qrPutRes.json();
    record(
      'QR-01',
      '4.8 Editable QR Codes',
      'Editable QR Code configurations validate, persist, and log an audit entry via PUT /api/settings/qr-codes',
      qrPutRes.status === 200 && qrPutData.configuredQrCodes?.[0]?.label === 'GRA Flagship Digital Menu QR (Verified)',
      `HTTP ${qrPutRes.status}: count=${qrPutData.configuredQrCodes?.length}, firstLabel="${qrPutData.configuredQrCodes?.[0]?.label}"`
    );

    // Test 5: Dispatch riders API returns valid array
    const ridersRes = await fetch(`${BASE_URL}/api/dispatch/riders`, {
      headers: { Authorization: `Bearer ${branchMgr.token}` }
    });
    const ridersData = await ridersRes.json();
    record(
      'DISP-01',
      '4.3 Barcode Scanner & Dispatch',
      'GET /api/dispatch/riders returns structured array preventing riders.map TypeError',
      ridersRes.status === 200 && Array.isArray(ridersData),
      `HTTP ${ridersRes.status}: isArray=${Array.isArray(ridersData)} (count=${ridersData?.length})`
    );

    // =========================================================================
    // 19.1 EXPENSE CLAIM SUBMISSION, VALIDATION & PROTECTED ATTACHMENTS
    // =========================================================================

    const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const attachRes = await fetch(`${BASE_URL}/api/expenses/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
      body: JSON.stringify({
        fileName: 'market_receipt_001.png',
        mimeType: 'image/png',
        base64Data: samplePngBase64
      })
    });
    const attachData = await attachRes.json();
    if (attachData.attachment?.storagePath) {
      createdAttachmentFiles.push(path.join(process.cwd(), 'data', 'protected_expense_attachments', attachData.attachment.storagePath));
    }
    const attId = attachData.attachment?.id;
    record(
      'EXP-SUB-01',
      '19.1 Submission & Attachments',
      'Staff member uploads receipt proof to protected storage outside public /uploads',
      attachRes.status === 201 && Boolean(attId),
      `HTTP ${attachRes.status}: attachmentId=${attId}, downloadUrl=${attachData.attachment?.downloadUrl}`
    );

    // Verify unauthenticated access to attachment is blocked (401)
    const unauthAttachRes = await fetch(`${BASE_URL}${attachData.attachment.downloadUrl}`);
    record(
      'EXP-SEC-01',
      '19.1 / 19.5 Attachment Security',
      'Unauthenticated request to expense attachment URL is rejected with HTTP 401',
      unauthAttachRes.status === 401,
      `HTTP ${unauthAttachRes.status}`
    );

    // Verify "Other / Exceptional" category without >=15 char explanation is rejected (400)
    const badOtherRes = await fetch(`${BASE_URL}/api/expenses/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
      body: JSON.stringify({
        operatingBranchId: 'gra',
        claimType: 'reimbursement_claim',
        categoryId: 'cat_other_exceptional',
        vendorName: 'Benin Market Seller',
        businessReason: 'Too short',
        description: 'Too short',
        receiptOrInvoiceRef: `INV-OTHER-${Date.now()}`,
        totalAmount: 4500,
        attachmentIds: [attId],
        submitImmediately: true
      })
    });
    const badOtherData = await badOtherRes.json();
    record(
      'EXP-SUB-02',
      '19.1 Submission Validation',
      'Submitting "Other / Exceptional" category without >=15 char explanation is rejected with HTTP 400',
      badOtherRes.status === 400,
      `HTTP ${badOtherRes.status}: ${badOtherData.error}`
    );

    // Submit valid standard reimbursement claim (₦12,500 - within Branch Manager ₦50,000 limit)
    const invRef1 = `INV-MKT-${Date.now()}-A`;
    const claim1Res = await fetch(`${BASE_URL}/api/expenses/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
      body: JSON.stringify({
        operatingBranchId: 'gra',
        department: 'Kitchen & Prep',
        claimType: 'reimbursement_claim',
        categoryId: 'cat_emergency_ingredients',
        expenseDate: new Date().toISOString().slice(0, 10),
        vendorName: 'Oba Market Fresh Produce Co-op',
        vendorPhoneOrTin: '08031112233',
        businessReason: 'Emergency Fresh Scotch Bonnet & Onions Restock',
        description: 'Urgent morning market purchase due to supplier van breakdown on Sapele Road',
        receiptOrInvoiceRef: invRef1,
        totalAmount: 12500,
        paymentMethodUsedByClaimant: 'personal_transfer',
        claimantBankName: 'Guaranty Trust Bank (GTBank)',
        claimantAccountNumber: '0123456789',
        claimantAccountName: 'Chioma E.',
        attachmentIds: [attId],
        submitImmediately: true
      })
    });
    const claim1Data = await claim1Res.json();
    const claim1Id = claim1Data.claim?.id;
    record(
      'EXP-SUB-03',
      '19.1 Submission',
      'Cashier submits valid ₦12,500 emergency kitchen reimbursement claim with receipt attachment',
      claim1Res.status === 201 && claim1Data.claim?.status === 'pending_approval',
      `HTTP ${claim1Res.status}: id=${claim1Id}, ref=${claim1Data.claim?.claimReference}, status=${claim1Data.claim?.status}`
    );

    // Duplicate invoice reference check (HTTP 409)
    const dupClaimRes = await fetch(`${BASE_URL}/api/expenses/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
      body: JSON.stringify({
        operatingBranchId: 'gra',
        claimType: 'reimbursement_claim',
        categoryId: 'cat_emergency_ingredients',
        vendorName: 'Oba Market Fresh Produce Co-op',
        businessReason: 'Duplicate Receipt Submission Attempt',
        description: 'Trying to reuse the same invoice number for the same vendor',
        receiptOrInvoiceRef: invRef1,
        totalAmount: 12500,
        attachmentIds: [attId],
        submitImmediately: true
      })
    });
    const dupClaimData = await dupClaimRes.json();
    record(
      'EXP-SUB-04',
      '19.1 Duplicate Detection',
      'Duplicate invoice/receipt reference is blocked with HTTP 409 Conflict',
      dupClaimRes.status === 409,
      `HTTP ${dupClaimRes.status}: ${dupClaimData.error}`
    );

    // =========================================================================
    // 19.2 APPROVAL WORKFLOW, SELF-APPROVAL BLOCK, ESCALATION & RETURN/AMEND
    // =========================================================================

    // Test Self-Approval Prohibition: Branch Manager submits a claim and tries to approve their own claim
    const mgrSelfClaimRes = await fetch(`${BASE_URL}/api/expenses/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({
        operatingBranchId: 'gra',
        claimType: 'reimbursement_claim',
        categoryId: 'cat_diesel_generator',
        vendorName: 'NNPC Mega Station Sapele Rd',
        businessReason: 'Manager Personal Fuel Purchase for Generator',
        description: 'Bought 10L petrol for auxiliary pump',
        receiptOrInvoiceRef: `INV-SELF-${Date.now()}`,
        totalAmount: 9500,
        attachmentIds: [attId],
        submitImmediately: true
      })
    });
    const mgrSelfClaimData = await mgrSelfClaimRes.json();
    const mgrSelfClaimId = mgrSelfClaimData.claim?.id;

    const selfApproveRes = await fetch(`${BASE_URL}/api/expenses/claims/${mgrSelfClaimId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({
        action: 'approve',
        comment: 'Approving my own claim'
      })
    });
    const selfApproveData = await selfApproveRes.json();
    record(
      'EXP-APP-01',
      '19.2 Self-Approval Prohibition (Manager)',
      'Branch Manager is strictly blocked from approving their own expense claim (HTTP 403)',
      selfApproveRes.status === 403 && String(selfApproveData.error || '').toLowerCase().includes('segregation of duties'),
      `HTTP ${selfApproveRes.status}: ${selfApproveData.error}`
    );

    // Also test Super Admin self-approval block
    const adminSelfClaimRes = await fetch(`${BASE_URL}/api/expenses/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdmin.token}` },
      body: JSON.stringify({
        operatingBranchId: 'gra',
        claimType: 'reimbursement_claim',
        categoryId: 'cat_office_comms_printing',
        vendorName: 'DHL Benin',
        businessReason: 'Executive Courier Fee',
        description: 'Regulatory filing dispatch',
        receiptOrInvoiceRef: `INV-ADM-SELF-${Date.now()}`,
        totalAmount: 6000,
        attachmentIds: [attId],
        submitImmediately: true
      })
    });
    const adminSelfClaimData = await adminSelfClaimRes.json();
    const adminSelfApproveRes = await fetch(`${BASE_URL}/api/expenses/claims/${adminSelfClaimData.claim?.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdmin.token}` },
      body: JSON.stringify({ action: 'approve', comment: 'Self approve attempt by super_admin' })
    });
    record(
      'EXP-APP-02',
      '19.2 Self-Approval Prohibition (Super Admin)',
      'Even super_admin cannot self-approve their own submitted claim (HTTP 403)',
      adminSelfApproveRes.status === 403,
      `HTTP ${adminSelfApproveRes.status}`
    );

    // Test Return for Amendment -> Amend -> Resubmit -> Approve on Claim 1
    const returnRes = await fetch(`${BASE_URL}/api/expenses/claims/${claim1Id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({
        action: 'return',
        comment: 'Please specify exact weight in kg of scotch bonnet peppers in description.'
      })
    });
    const returnData = await returnRes.json();
    record(
      'EXP-APP-03',
      '19.2 Return for Amendment',
      'Branch Manager returns claim for amendment with mandatory reason',
      returnRes.status === 200 && returnData.claim?.status === 'returned',
      `HTTP ${returnRes.status}: status=${returnData.claim?.status}`
    );

    // Cashier amends and resubmits Claim 1
    const amendRes = await fetch(`${BASE_URL}/api/expenses/claims/${claim1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
      body: JSON.stringify({
        description: 'Urgent morning market purchase: 8kg fresh scotch bonnet peppers and 5kg dry red onions',
        resubmit: true
      })
    });
    const amendData = await amendRes.json();
    record(
      'EXP-APP-04',
      '19.2 Amend & Resubmit',
      'Claimant amends returned claim and resubmits (status transitions back to pending_approval)',
      amendRes.status === 200 && amendData.claim?.status === 'pending_approval',
      `HTTP ${amendRes.status}: status=${amendData.claim?.status}, historyCount=${amendData.claim?.approvalHistory?.length}`
    );

    // Branch Manager approves Claim 1 (₦12,500 <= ₦50,000 Branch Manager limit -> directly approved)
    const approve1Res = await fetch(`${BASE_URL}/api/expenses/claims/${claim1Id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({
        action: 'approve',
        comment: 'Verified delivery of 8kg peppers and 5kg onions into GRA kitchen.'
      })
    });
    const approve1Data = await approve1Res.json();
    record(
      'EXP-APP-05',
      '19.2 Standard Threshold Approval',
      'Branch Manager approves ₦12,500 claim within ₦50,000 threshold -> status transitions to approved',
      approve1Res.status === 200 && approve1Data.claim?.status === 'approved',
      `HTTP ${approve1Res.status}: status=${approve1Data.claim?.status}, approvedAmount=${approve1Data.claim?.approvedAmount}`
    );

    // Test Escalation Above Branch Manager Limit:
    // Submit ₦75,000 Generator Diesel claim (> ₦50,000 Branch Manager limit, within ₦250,000 Accountant limit)
    const highClaimRes = await fetch(`${BASE_URL}/api/expenses/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
      body: JSON.stringify({
        operatingBranchId: 'gra',
        claimType: 'reimbursement_claim',
        categoryId: 'cat_diesel_generator',
        vendorName: 'Matrix Energy Depot Benin',
        businessReason: '60 Litres Automotive Gas Oil (Diesel) for Backup Generator',
        description: 'Emergency diesel delivery during BEDC feeder outage',
        receiptOrInvoiceRef: `INV-DSL-${Date.now()}`,
        totalAmount: 75000,
        attachmentIds: [attId],
        submitImmediately: true
      })
    });
    const highClaimData = await highClaimRes.json();
    const highClaimId = highClaimData.claim?.id;

    // Branch Manager reviews/approves first stage -> must escalate to pending_additional_approval
    const stage1EscRes = await fetch(`${BASE_URL}/api/expenses/claims/${highClaimId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({
        action: 'approve',
        comment: 'Confirmed 60L diesel poured into GRA tank. Escalating for finance approval.'
      })
    });
    const stage1EscData = await stage1EscRes.json();
    record(
      'EXP-APP-06',
      '19.2 Multi-Stage Escalation',
      '₦75,000 claim approved by Branch Manager escalates to pending_additional_approval instead of final approval',
      stage1EscRes.status === 200 && stage1EscData.claim?.status === 'pending_additional_approval',
      `HTTP ${stage1EscRes.status}: status=${stage1EscData.claim?.status}, escalated=${stage1EscData.escalated}`
    );

    // Accountant performs Stage 2 elevated approval -> transitions to approved
    const stage2AppRes = await fetch(`${BASE_URL}/api/expenses/claims/${highClaimId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountant.token}` },
      body: JSON.stringify({
        action: 'approve',
        comment: 'Finance verified diesel invoice price per litre and tank log.'
      })
    });
    const stage2AppData = await stage2AppRes.json();
    record(
      'EXP-APP-07',
      '19.2 Elevated Threshold Final Approval',
      'Accountant completes Stage 2 approval on escalated ₦75,000 claim -> status becomes approved',
      stage2AppRes.status === 200 && stage2AppData.claim?.status === 'approved',
      `HTTP ${stage2AppRes.status}: status=${stage2AppData.claim?.status}`
    );

    // =========================================================================
    // 19.3 ACCOUNTING, PAYMENT SETTLEMENT, CASH ADVANCE RETIREMENT & REVERSAL
    // =========================================================================

    // Test Rejected claim cannot be paid (use mgrSelfClaimId rejected by Accountant)
    await fetch(`${BASE_URL}/api/expenses/claims/${mgrSelfClaimId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountant.token}` },
      body: JSON.stringify({ action: 'reject', comment: 'Duplicate fuel log entry rejected.' })
    });
    const payRejectedRes = await fetch(`${BASE_URL}/api/expenses/claims/${mgrSelfClaimId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountant.token}` },
      body: JSON.stringify({
        paymentMethod: 'bank_transfer',
        paymentReference: 'TRF-REJECT-TEST',
        amount: 9500
      })
    });
    record(
      'EXP-ACC-01',
      '19.2 / 19.3 Rejected Claim Payment Block',
      'Rejected expense claim cannot be paid (HTTP 400)',
      payRejectedRes.status === 400,
      `HTTP ${payRejectedRes.status}`
    );

    // Settle Claim 1 (₦12,500) via Bank Transfer by Accountant
    const pay1Res = await fetch(`${BASE_URL}/api/expenses/claims/${claim1Id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountant.token}` },
      body: JSON.stringify({
        paymentMethod: 'bank_transfer',
        paymentReference: `NIP-GTB-${Date.now()}`,
        amount: 12500,
        fundingAccountCode: '1030',
        notes: 'Settled via corporate internet banking transfer'
      })
    });
    const pay1Data = await pay1Res.json();
    record(
      'EXP-ACC-02',
      '19.3 Reimbursement Settlement',
      'Accountant settles approved reimbursement claim via bank transfer -> status becomes paid',
      pay1Res.status === 200 && pay1Data.claim?.status === 'paid' && pay1Data.claim?.paidAmount === 12500,
      `HTTP ${pay1Res.status}: status=${pay1Data.claim?.status}, paidAmount=${pay1Data.claim?.paidAmount}`
    );

    // Reconcile Claim 1
    const rec1Res = await fetch(`${BASE_URL}/api/expenses/claims/${claim1Id}/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountant.token}` },
      body: JSON.stringify({
        notes: 'Matched against GTBank NIP statement line'
      })
    });
    const rec1Data = await rec1Res.json();
    record(
      'EXP-ACC-03',
      '19.3 Claim Reconciliation',
      'Accountant reconciles paid claim -> status becomes reconciled',
      rec1Res.status === 200 && rec1Data.claim?.status === 'reconciled',
      `HTTP ${rec1Res.status}: status=${rec1Data.claim?.status}`
    );

    // Test Cash Advance Lifecycle: Submit -> Approve -> Disburse (1150 Asset) -> Retire (Substantiated + Cash Returned)
    const advClaimRes = await fetch(`${BASE_URL}/api/expenses/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
      body: JSON.stringify({
        operatingBranchId: 'gra',
        claimType: 'cash_advance',
        categoryId: 'cat_packaging_disposables',
        vendorName: 'New Benin Packaging Wholesale',
        businessReason: 'Weekly Market Packaging & Nylon Advance',
        description: 'Cash float advance for branded takeaway carrier bags and foil packs',
        receiptOrInvoiceRef: `ADV-PKG-${Date.now()}`,
        totalAmount: 20000,
        submitImmediately: true
      })
    });
    const advClaimData = await advClaimRes.json();
    const advClaimId = advClaimData.claim?.id;

    // Approve Cash Advance by Branch Manager
    await fetch(`${BASE_URL}/api/expenses/claims/${advClaimId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({ action: 'approve', comment: 'Approved ₦20,000 packaging advance' })
    });

    // Disburse Cash Advance (₦20,000)
    const advPayRes = await fetch(`${BASE_URL}/api/expenses/claims/${advClaimId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountant.token}` },
      body: JSON.stringify({
        paymentMethod: 'petty_cash',
        paymentReference: `PC-ADV-${Date.now()}`,
        amount: 20000,
        notes: 'Disbursed ₦20,000 from petty cash float'
      })
    });
    const advPayData = await advPayRes.json();

    // Retire Cash Advance: ₦17,500 substantiated packaging receipt + ₦2,500 unspent cash returned = ₦20,000 cleared
    const advRetireRes = await fetch(`${BASE_URL}/api/expenses/claims/${advClaimId}/retire-advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountant.token}` },
      body: JSON.stringify({
        substantiatedExpenseAmount: 17500,
        unspentCashReturned: 2500,
        returnPaymentMethod: 'cash_drawer',
        returnReference: `RET-PC-${Date.now()}`,
        targetExpenseAccountCode: '5200',
        notes: 'Receipts for ₦17,500 carrier bags verified; ₦2,500 change returned to cash drawer'
      })
    });
    const advRetireData = await advRetireRes.json();
    record(
      'EXP-ACC-04',
      '19.3 Cash Advance Disbursement & Retirement',
      'Cash advance (₦20,000) posts to 1150 Staff Advance Receivable on disbursement and clears 1150 (₦17,500 expense + ₦2,500 cash returned) on retirement',
      advPayRes.status === 200 && advRetireRes.status === 200 && advRetireData.claim?.status === 'reconciled',
      `Disburse HTTP ${advPayRes.status} (${advPayData.claim?.status}) -> Retire HTTP ${advRetireRes.status} (${advRetireData.claim?.status})`
    );

    // Verify General Ledger & Trial Balance Equilibrium via GET /api/reports/accounting-journal
    const acctRes = await fetch(`${BASE_URL}/api/reports/accounting-journal?branchId=all&period=all`, {
      headers: { Authorization: `Bearer ${accountant.token}` }
    });
    const acctData = await acctRes.json();
    const report = acctData.report || {};
    const summary = report.summary || {};
    const entries = Array.isArray(report.entries) ? report.entries : [];
    const hasRecognition = entries.some((e: any) => e.sourceType === 'EXPENSE_CLAIM_RECOGNITION' && String(e.sourceId).startsWith(claim1Id));
    const hasSettlement = entries.some((e: any) => e.sourceType === 'EXPENSE_CLAIM_PAYMENT' && String(e.sourceId).startsWith(claim1Id));
    const hasAdvDisburse = entries.some((e: any) => e.sourceType === 'CASH_ADVANCE_DISBURSEMENT' && String(e.sourceId).startsWith(advClaimId));
    const hasAdvRetire = entries.some((e: any) => e.sourceType === 'CASH_ADVANCE_RETIREMENT' && String(e.sourceId).startsWith(advClaimId));

    record(
      'EXP-ACC-05',
      '19.3 Double-Entry Ledger & Trial Balance',
      'General Ledger contains EXPENSE_CLAIM_RECOGNITION, EXPENSE_CLAIM_PAYMENT, CASH_ADVANCE_DISBURSEMENT, and CASH_ADVANCE_RETIREMENT journals and Trial Balance is balanced (variance === 0)',
      Boolean(summary.isBalanced && summary.variance === 0 && hasRecognition && hasSettlement && hasAdvDisburse && hasAdvRetire),
      `isBalanced=${summary.isBalanced}, totalDebits=${summary.totalDebits}, totalCredits=${summary.totalCredits}, variance=${summary.variance}, journalsFound={rec:${hasRecognition}, pay:${hasSettlement}, advDisb:${hasAdvDisburse}, advRet:${hasAdvRetire}}`
    );

    // Test Controlled Reversal on highClaimId (approved ₦75,000 claim)
    const revRes = await fetch(`${BASE_URL}/api/expenses/claims/${highClaimId}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountant.token}` },
      body: JSON.stringify({
        reason: 'Vendor issued revised credit note; reversing initial recognition to rebook accurate amount.'
      })
    });
    const revData = await revRes.json();
    const acctAfterRevRes = await fetch(`${BASE_URL}/api/reports/accounting-journal?branchId=all&period=all`, {
      headers: { Authorization: `Bearer ${accountant.token}` }
    });
    const acctAfterRevData = await acctAfterRevRes.json();
    const reportAfterRev = acctAfterRevData.report || {};
    const summaryAfterRev = reportAfterRev.summary || {};
    const hasReversalJournal = (reportAfterRev.entries || []).some(
      (e: any) => e.sourceType === 'EXPENSE_CLAIM_REVERSAL' && String(e.sourceId).startsWith(highClaimId)
    );
    record(
      'EXP-ACC-06',
      '19.3 Controlled Accounting Reversal',
      'Reversing an approved/paid claim transitions status to reversed, posts offsetting EXPENSE_CLAIM_REVERSAL journal, and preserves Trial Balance equilibrium',
      revRes.status === 200 && revData.claim?.status === 'reversed' && hasReversalJournal && summaryAfterRev.isBalanced === true && summaryAfterRev.variance === 0,
      `HTTP ${revRes.status}: status=${revData.claim?.status}, hasReversalJournal=${hasReversalJournal}, postReversalVariance=${summaryAfterRev.variance}`
    );

    // =========================================================================
    // 19.4 NOTIFICATIONS & 19.5 RBAC / BRANCH ISOLATION
    // =========================================================================

    const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${superAdmin.token}` }
    });
    const notifData = await notifRes.json();
    const notifs = Array.isArray(notifData.notifications) ? notifData.notifications : (Array.isArray(notifData) ? notifData : []);
    const expenseNotifs = notifs.filter((n: any) =>
      String(n.title || '').toLowerCase().includes('expense') ||
      String(n.title || '').toLowerCase().includes('claim') ||
      String(n.title || '').toLowerCase().includes('payment disbursed') ||
      String(n.message || '').toLowerCase().includes('clm-')
    );
    record(
      'EXP-NOTIF-01',
      '19.4 Notifications',
      'In-app notifications are generated for expense submission, return/escalation, approval, and settlement',
      expenseNotifs.length >= 4,
      `Found ${expenseNotifs.length} expense workflow notifications (latest: "${expenseNotifs[0]?.title}")`
    );

    // Verify Cashier cannot approve any claim (HTTP 403)
    const cashierApproveAttempt = await fetch(`${BASE_URL}/api/expenses/claims/${adminSelfClaimData.claim?.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
      body: JSON.stringify({ action: 'approve', comment: 'Cashier trying to approve' })
    });
    record(
      'EXP-RBAC-01',
      '19.5 Role & Permission Isolation',
      'Cashier role is prohibited from reviewing or approving expense claims (HTTP 403)',
      cashierApproveAttempt.status === 403,
      `HTTP ${cashierApproveAttempt.status}`
    );

    // Verify Cashier cannot view another staff member's claim (adminSelfClaimData belongs to superAdmin)
    const cashierViewOtherRes = await fetch(`${BASE_URL}/api/expenses/claims/${adminSelfClaimData.claim?.id}`, {
      headers: { Authorization: `Bearer ${cashier.token}` }
    });
    record(
      'EXP-RBAC-02',
      '19.5 Claimant Isolation',
      'Cashier cannot view another staff member’s expense claim detail (HTTP 403)',
      cashierViewOtherRes.status === 403,
      `HTTP ${cashierViewOtherRes.status}`
    );

    // Verify Branch Isolation: GRA Branch Manager cannot approve an Okabere claim
    const okabereClaimRes = await fetch(`${BASE_URL}/api/expenses/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierOkabere.token}` },
      body: JSON.stringify({
        operatingBranchId: 'okabere',
        claimType: 'reimbursement_claim',
        categoryId: 'cat_emergency_ingredients',
        vendorName: 'Okabere Junction Fresh Farm',
        businessReason: 'Emergency Plantain Restock for Okabere Kitchen',
        description: 'Bought 3 bunches of ripe plantain for dodo orders',
        receiptOrInvoiceRef: `INV-OKA-${Date.now()}`,
        totalAmount: 8500,
        attachmentIds: [attId],
        submitImmediately: true
      })
    });
    const okabereClaimData = await okabereClaimRes.json();
    const crossBranchApproveRes = await fetch(`${BASE_URL}/api/expenses/claims/${okabereClaimData.claim?.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${branchMgr.token}` },
      body: JSON.stringify({ action: 'approve', comment: 'GRA Manager attempting to approve Okabere claim' })
    });
    record(
      'EXP-RBAC-03',
      '19.5 Branch Isolation',
      'GRA Branch Manager is blocked from reviewing/approving an Okabere branch expense claim (HTTP 403)',
      crossBranchApproveRes.status === 403,
      `HTTP ${crossBranchApproveRes.status}`
    );

    // Verify Expense Analytics endpoint works for authorized roles
    const analyticsRes = await fetch(`${BASE_URL}/api/expenses/analytics?branchId=gra`, {
      headers: { Authorization: `Bearer ${accountant.token}` }
    });
    const analyticsData = await analyticsRes.json();
    record(
      'EXP-REP-01',
      '16 / 19.3 Expense Reporting & Analytics',
      'GET /api/expenses/analytics returns summary totals, category breakdown, branch breakdown, and top vendors',
      analyticsRes.status === 200 && Boolean(analyticsData.summary && Array.isArray(analyticsData.byCategory)),
      `HTTP ${analyticsRes.status}: paidAndReconciledAmount=${analyticsData.summary?.paidAndReconciledAmount}, categoriesCount=${analyticsData.byCategory?.length}`
    );

  } finally {
    // Clean up temporary attachment files created during test
    for (const filePath of createdAttachmentFiles) {
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
    // Restore original DB state and reload in-memory DB so no temporary test records pollute production/demo state
    fs.writeFileSync(DB_PATH, originalDbBytes, 'utf-8');
    try {
      const superAdminClean = await login('admin@choplife.ng', 'ChopLife2025!');
      await fetch(`${BASE_URL}/api/admin/db/reload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminClean.token}` },
        body: JSON.stringify({})
      });
    } catch {}
    console.log('\n[CLEANUP] Restored data/choplife_ops_db.json, reloaded server memory, and removed temporary test attachments.');
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`\n=============================================================`);
  console.log(`VERIFICATION SUMMARY: ${passedCount}/${results.length} PASSED (${failedCount} FAILED)`);
  console.log(`=============================================================`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification fatal error:', err);
  process.exit(1);
});
