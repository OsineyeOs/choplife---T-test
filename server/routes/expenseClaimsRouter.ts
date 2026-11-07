import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  type DbDatabase,
  type DbStaffAccount,
  type DbExpenseClaim,
  type ExpenseAttachment,
  type ExpenseApprovalHistoryEntry,
  type ExpenseFraudFlag,
  type ExpenseLineItem,
  type ExpenseCategoryConfig,
  type ExpenseApprovalMatrixConfig,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EXPENSE_APPROVAL_MATRIX,
} from '../../server_db.ts';
import { CANONICAL_DEFAULT_SETTINGS } from '../db/systemSettingsSchema.ts';
import { buildAccountingJournalEntries } from '../accounting/journalLedgerBuilder.ts';

export interface ExpenseClaimsRouterDeps {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: express.RequestHandler;
  requireRole: (roles: string[]) => express.RequestHandler;
  hasPermission: (staff: DbStaffAccount, permissionCode: string) => Promise<boolean>;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
}

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'protected_expense_attachments');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

export function createExpenseClaimsRouter(deps: ExpenseClaimsRouterDeps): express.Router {
  const router = express.Router();
  const { getDb, saveDatabaseSync, requireAuth, hasPermission, logAuditEvent } = deps;

  function ensureExpenseStructures(db: DbDatabase): {
    categories: ExpenseCategoryConfig[];
    approvalMatrix: ExpenseApprovalMatrixConfig;
  } {
    if (!db.expenseClaims) db.expenseClaims = {};
    if (!db.expenseAttachments) db.expenseAttachments = {};
    if (!db.notifications) db.notifications = {};
    if (!db.settings) {
      db.settings = JSON.parse(JSON.stringify(CANONICAL_DEFAULT_SETTINGS));
    }
    if (!db.settings.expenses) {
      db.settings.expenses = {
        categories: JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES)),
        approvalMatrix: JSON.parse(JSON.stringify(DEFAULT_EXPENSE_APPROVAL_MATRIX)),
      };
      saveDatabaseSync();
    }
    return db.settings.expenses;
  }

  function isGlobalExpenseViewer(staff: DbStaffAccount): boolean {
    return ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor'].includes(staff.role);
  }

  function getStaffAllowedBranches(staff: DbStaffAccount): string[] {
    return Array.from(new Set([staff.branchId, ...(staff.allowedBranchIds || [])].filter(Boolean)));
  }

  async function canViewClaim(staff: DbStaffAccount, claim: DbExpenseClaim): Promise<boolean> {
    if (isGlobalExpenseViewer(staff)) return true;
    if (claim.claimantStaffId === staff.id) return true;
    if (
      await hasPermission(staff, 'expenses.view_branch') ||
      await hasPermission(staff, 'expenses.review') ||
      await hasPermission(staff, 'expenses.approve_standard')
    ) {
      const allowed = getStaffAllowedBranches(staff);
      return allowed.includes(claim.operatingBranchId) || allowed.includes(claim.homeBranchId);
    }
    return false;
  }

  function createInAppExpenseNotification(
    db: DbDatabase,
    params: {
      claim: DbExpenseClaim;
      eventTitle: string;
      message: string;
      recipientStaffId?: string;
      recipientRole?: string;
    }
  ) {
    const { approvalMatrix } = ensureExpenseStructures(db);
    if (!approvalMatrix.notificationRules?.inAppEnabled) return;

    const notifId = `notif-exp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    db.notifications[notifId] = {
      id: notifId,
      type: 'expense_claim_alert',
      channel: 'in_app',
      branchId: params.claim.operatingBranchId,
      claimId: params.claim.id,
      claimReference: params.claim.claimReference,
      recipientStaffId: params.recipientStaffId || params.claim.claimantStaffId,
      recipientName: params.claim.claimantName,
      recipientRole: params.recipientRole || params.claim.claimantRole,
      subject: params.eventTitle,
      message: params.message,
      status: 'delivered',
      read: false,
      timestamp: new Date().toISOString(),
    };
  }

  function evaluateFraudFlags(
    db: DbDatabase,
    claim: DbExpenseClaim,
    category: ExpenseCategoryConfig | undefined,
    matrix: ExpenseApprovalMatrixConfig
  ): ExpenseFraudFlag[] {
    const flags: ExpenseFraudFlag[] = [];
    const nowIso = new Date().toISOString();
    const existingClaims = Object.values(db.expenseClaims || {}).filter(
      (c) => c && c.id !== claim.id && !['rejected', 'cancelled', 'reversed'].includes(c.status)
    );

    // 1. Missing required receipt above threshold
    const receiptThreshold = Math.min(
      category?.requiresReceiptAboveNgn ?? matrix.receiptMandatoryThresholdNgn,
      matrix.receiptMandatoryThresholdNgn
    );
    if (claim.totalAmount >= receiptThreshold && (!claim.attachmentIds || claim.attachmentIds.length === 0)) {
      flags.push({
        code: 'missing_required_receipt',
        severity: claim.isEmergencyExpense ? 'warning' : 'critical',
        message: `Expense of ₦${claim.totalAmount.toLocaleString()} exceeds receipt threshold (₦${receiptThreshold.toLocaleString()}) with no uploaded receipt${claim.missingReceiptReason ? ` (Exception reason: ${claim.missingReceiptReason})` : ''}.`,
        detectedAt: nowIso,
      });
    }

    // 2. Emergency override flag
    if (claim.isEmergencyExpense) {
      flags.push({
        code: 'emergency_override',
        severity: 'warning',
        message: 'Marked as an urgent/emergency branch operational expenditure requiring post-facto manager verification.',
        detectedAt: nowIso,
      });
    }

    const windowMs = (matrix.duplicateWindowDays || 14) * 24 * 60 * 60 * 1000;
    const splitWindowMs = (matrix.splitClaimWindowHours || 48) * 60 * 60 * 1000;
    const claimCreatedMs = new Date(claim.createdAt || nowIso).getTime();

    let recentClaimantSum = claim.totalAmount;
    let recentClaimantCount = 1;
    let sameVendorCount = 0;

    for (const other of existingClaims) {
      const otherMs = new Date(other.createdAt || 0).getTime();
      const diffMs = Math.abs(claimCreatedMs - otherMs);

      // 3. Duplicate receipt/invoice reference
      if (
        claim.receiptOrInvoiceRef &&
        other.receiptOrInvoiceRef &&
        claim.receiptOrInvoiceRef.trim().toLowerCase() === other.receiptOrInvoiceRef.trim().toLowerCase()
      ) {
        flags.push({
          code: 'duplicate_receipt_ref',
          severity: 'critical',
          message: `Receipt/Invoice reference "${claim.receiptOrInvoiceRef}" matches existing claim ${other.claimReference}.`,
          detectedAt: nowIso,
        });
      }

      // 4. Similar amount repeat within duplicate window
      if (
        diffMs <= windowMs &&
        other.operatingBranchId === claim.operatingBranchId &&
        other.categoryId === claim.categoryId &&
        Math.abs(other.totalAmount - claim.totalAmount) <= Math.max(500, claim.totalAmount * 0.05)
      ) {
        flags.push({
          code: 'similar_amount_repeat',
          severity: 'warning',
          message: `Similar amount (₦${other.totalAmount.toLocaleString()}) was claimed in ${other.claimReference} for the same category within ${matrix.duplicateWindowDays} days.`,
          detectedAt: nowIso,
        });
      }

      // 5. Split claims below approval threshold
      if (diffMs <= splitWindowMs && other.claimantStaffId === claim.claimantStaffId) {
        recentClaimantSum += other.totalAmount;
        recentClaimantCount += 1;
      }

      // 6. Repeated same vendor within 7 days
      if (
        diffMs <= 7 * 24 * 60 * 60 * 1000 &&
        claim.vendorName &&
        other.vendorName &&
        claim.vendorName.trim().toLowerCase() === other.vendorName.trim().toLowerCase()
      ) {
        sameVendorCount += 1;
      }
    }

    if (
      recentClaimantCount >= 2 &&
      claim.totalAmount < matrix.standardApprovalThresholdNgn &&
      recentClaimantSum >= matrix.standardApprovalThresholdNgn
    ) {
      flags.push({
        code: 'split_claim_below_threshold',
        severity: 'warning',
        message: `${recentClaimantCount} claims submitted within ${matrix.splitClaimWindowHours}h total ₦${recentClaimantSum.toLocaleString()}, exceeding the ₦${matrix.standardApprovalThresholdNgn.toLocaleString()} standard approval threshold.`,
        detectedAt: nowIso,
      });
    }

    if (sameVendorCount >= 2) {
      flags.push({
        code: 'same_vendor_repeat',
        severity: 'info',
        message: `Vendor "${claim.vendorName}" has been used in ${sameVendorCount + 1} claims within the past 7 days.`,
        detectedAt: nowIso,
      });
    }

    return flags;
  }

  // ============================================================================
  // 1. GET & PUT /api/expenses/config — Categories, Approval Matrix & Rules
  // ============================================================================
  router.get('/api/expenses/config', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    const config = ensureExpenseStructures(db);
    return res.json({
      success: true,
      categories: config.categories,
      approvalMatrix: config.approvalMatrix,
    });
  });

  router.put('/api/expenses/config', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    const actor = (req as any).staff as DbStaffAccount;
    const canConfig =
      ['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(actor.role) ||
      await hasPermission(actor, 'expenses.configure_categories') ||
      await hasPermission(actor, 'expenses.configure_approvals');

    if (!canConfig) {
      return res.status(403).json({
        error: 'Access denied. Configuring expense categories and approval thresholds requires Finance or Executive Admin authority.',
      });
    }

    const config = ensureExpenseStructures(db);
    if (Array.isArray(req.body.categories) && req.body.categories.length > 0) {
      config.categories = req.body.categories;
    }
    if (req.body.approvalMatrix && typeof req.body.approvalMatrix === 'object') {
      config.approvalMatrix = {
        ...config.approvalMatrix,
        ...req.body.approvalMatrix,
      };
    }

    db.settings!.expenses = config;
    db.settings!.updatedAt = new Date().toISOString();
    db.settings!.updatedBy = `${actor.name} (${actor.role})`;
    saveDatabaseSync();

    logAuditEvent(
      actor.name,
      actor.role,
      actor.branchId,
      'EXPENSE_CONFIG_UPDATED',
      `Updated operational expense categories and approval matrix thresholds`
    );

    return res.json({
      success: true,
      message: 'Expense governance configuration updated.',
      categories: config.categories,
      approvalMatrix: config.approvalMatrix,
    });
  });

  // ============================================================================
  // 2. PROTECTED ATTACHMENTS — Upload & Authenticated Download
  // ============================================================================
  router.post('/api/expenses/attachments', requireAuth, async (req: Request, res: Response) => {
    try {
      const db = getDb();
      ensureExpenseStructures(db);
      const actor = (req as any).staff as DbStaffAccount;
      const { claimId = 'unassigned', fileName, mimeType, base64Data, documentType = 'receipt' } = req.body || {};

      if (!fileName || !mimeType || !base64Data) {
        return res.status(400).json({ error: 'fileName, mimeType, and base64Data are required.' });
      }

      const normalizedMime = String(mimeType).toLowerCase().trim();
      const ext = ALLOWED_MIME_TYPES[normalizedMime];
      if (!ext) {
        return res.status(400).json({
          error: `Unsupported file type "${mimeType}". Allowed formats: JPEG, PNG, WEBP, and PDF.`,
        });
      }

      const cleanBase64 = String(base64Data).includes(',')
        ? String(base64Data).split(',')[1]
        : String(base64Data);
      const buffer = Buffer.from(cleanBase64, 'base64');

      if (buffer.byteLength === 0) {
        return res.status(400).json({ error: 'Uploaded file is empty.' });
      }
      if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
        return res.status(400).json({
          error: `Attachment exceeds maximum size of 5 MB (uploaded ${(buffer.byteLength / (1024 * 1024)).toFixed(2)} MB).`,
        });
      }

      const attachmentId = `att-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const safeDiskName = `${attachmentId}.${ext}`;
      const diskPath = path.join(UPLOADS_DIR, safeDiskName);
      fs.writeFileSync(diskPath, buffer);

      const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const record: ExpenseAttachment = {
        id: attachmentId,
        claimId: String(claimId),
        fileName: String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120),
        mimeType: normalizedMime,
        fileSizeBytes: buffer.byteLength,
        storagePath: safeDiskName,
        uploadedByStaffId: actor.id,
        uploadedByName: actor.name,
        uploadedAt: new Date().toISOString(),
        documentType: ['receipt', 'invoice', 'pos_slip', 'transfer_proof', 'waybill', 'approval_memo', 'other'].includes(
          documentType
        )
          ? documentType
          : 'receipt',
        sha256Hash,
      };

      db.expenseAttachments![attachmentId] = record;
      if (claimId && db.expenseClaims![claimId]) {
        const clm = db.expenseClaims![claimId];
        if (!clm.attachmentIds.includes(attachmentId)) {
          clm.attachmentIds.push(attachmentId);
        }
      }
      saveDatabaseSync();

      return res.status(201).json({
        success: true,
        attachment: {
          ...record,
          downloadUrl: `/api/expenses/attachments/${record.id}`,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to store expense attachment.', details: err.message });
    }
  });

  router.get('/api/expenses/attachments/:attachmentId', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;
    const { attachmentId } = req.params;
    const att = db.expenseAttachments![attachmentId];

    if (!att) {
      return res.status(404).json({ error: 'Attachment not found.' });
    }

    // Verify access to associated claim if linked
    if (att.claimId && att.claimId !== 'unassigned' && db.expenseClaims![att.claimId]) {
      const claim = db.expenseClaims![att.claimId];
      if (!(await canViewClaim(actor, claim))) {
        return res.status(403).json({
          error: 'Access denied. You are not authorized to view attachments for this expense claim.',
        });
      }
    } else if (att.uploadedByStaffId !== actor.id && !isGlobalExpenseViewer(actor)) {
      return res.status(403).json({ error: 'Access denied to this attachment.' });
    }

    const diskPath = path.join(UPLOADS_DIR, path.basename(att.storagePath));
    if (!fs.existsSync(diskPath)) {
      return res.status(404).json({ error: 'Attachment file is missing from storage.' });
    }

    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${att.fileName}"`);
    return res.sendFile(diskPath);
  });

  // ============================================================================
  // 3. GET /api/expenses/claims & GET /api/expenses/claims/:id
  // ============================================================================
  router.get('/api/expenses/claims', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;
    const {
      branchId,
      status,
      claimType,
      categoryId,
      claimantStaffId,
      startDate,
      endDate,
      search,
      scope,
    } = req.query;
 
    let list = Object.values(db.expenseClaims || {}).filter((c): c is DbExpenseClaim => Boolean(c));
 
    // Enforce RBAC and branch isolation
    const filteredList: DbExpenseClaim[] = [];
    for (const c of list) {
      if (await canViewClaim(actor, c)) {
        filteredList.push(c);
      }
    }
    list = filteredList;

    if (scope === 'mine') {
      list = list.filter((c) => c.claimantStaffId === actor.id);
    }

    if (branchId && branchId !== 'all') {
      const bStr = String(branchId).toLowerCase();
      list = list.filter(
        (c) => c.operatingBranchId?.toLowerCase() === bStr || c.homeBranchId?.toLowerCase() === bStr
      );
    }

    if (status && status !== 'all') {
      if (status === 'actionable') {
        list = list.filter((c) =>
          ['submitted', 'pending_approval', 'pending_additional_approval', 'approved', 'payment_pending'].includes(
            c.status
          )
        );
      } else {
        list = list.filter((c) => c.status === status);
      }
    }

    if (claimType && claimType !== 'all') {
      list = list.filter((c) => c.claimType === claimType);
    }

    if (categoryId && categoryId !== 'all') {
      list = list.filter((c) => c.categoryId === categoryId);
    }

    if (claimantStaffId) {
      list = list.filter((c) => c.claimantStaffId === claimantStaffId);
    }

    if (startDate) {
      const startMs = new Date(String(startDate)).getTime();
      if (!isNaN(startMs)) {
        list = list.filter((c) => new Date(c.expenseDate || c.createdAt).getTime() >= startMs);
      }
    }

    if (endDate) {
      const endMs = new Date(`${String(endDate).slice(0, 10)}T23:59:59.999Z`).getTime();
      if (!isNaN(endMs)) {
        list = list.filter((c) => new Date(c.expenseDate || c.createdAt).getTime() <= endMs);
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.claimReference?.toLowerCase().includes(q) ||
          c.claimantName?.toLowerCase().includes(q) ||
          c.vendorName?.toLowerCase().includes(q) ||
          c.businessReason?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.receiptOrInvoiceRef?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const enriched = list.map((c) => ({
      ...c,
      attachments: (c.attachmentIds || [])
        .map((id) => db.expenseAttachments?.[id])
        .filter(Boolean)
        .map((att: any) => ({
          ...att,
          downloadUrl: `/api/expenses/attachments/${att.id}`,
        })),
    }));

    return res.json({
      success: true,
      count: enriched.length,
      claims: enriched,
    });
  });

  router.get('/api/expenses/claims/:id', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const claim =
      db.expenseClaims![id] ||
      Object.values(db.expenseClaims || {}).find(
        (c) => c?.claimReference?.toLowerCase() === id.toLowerCase()
      );

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found.' });
    }

    if (!(await canViewClaim(actor, claim))) {
      return res.status(403).json({
        error: 'Access denied. You do not have permission to view this expense claim.',
      });
    }

    const attachments = (claim.attachmentIds || [])
      .map((attId) => db.expenseAttachments?.[attId])
      .filter(Boolean)
      .map((att: any) => ({
        ...att,
        downloadUrl: `/api/expenses/attachments/${att.id}`,
      }));

    // Retrieve linked double-entry accounting journal entries for this claim
    let journalEntries: any[] = [];
    try {
      const report = buildAccountingJournalEntries(db, { branchId: 'all', period: 'all' });
      journalEntries = report.entries.filter(
        (e) =>
          e.sourceId === claim.id ||
          e.sourceId.startsWith(`${claim.id}-`) ||
          e.sourceRef === claim.claimReference
      );
    } catch {
      journalEntries = [];
    }

    return res.json({
      success: true,
      claim: {
        ...claim,
        attachments,
      },
      journalEntries,
    });
  });

  // ============================================================================
  // 4. POST /api/expenses/claims — Create Draft or Submit Expense Claim
  // ============================================================================
  router.post('/api/expenses/claims', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    const { categories, approvalMatrix } = ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;

    if (!(await hasPermission(actor, 'expenses.submit_own'))) {
      return res.status(403).json({ error: 'Access denied. Missing privilege expenses.submit_own.' });
    }

    const {
      claimType = 'reimbursement_claim',
      submitImmediately = true,
      operatingBranchId,
      department = 'Operations',
      expenseDate,
      categoryId,
      subcategory,
      vendorName,
      vendorPhoneOrTin,
      businessReason,
      description = '',
      lineItems = [],
      totalAmount: rawTotalAmount,
      vatAmount: rawVatAmount = 0,
      purchaseOrderRef,
      workOrderRef,
      receiptOrInvoiceRef,
      taxInvoiceNumber,
      paymentMethodUsedByClaimant = 'personal_transfer',
      claimantBankName,
      claimantAccountNumber,
      claimantAccountName,
      attachmentIds = [],
      missingReceiptReason,
      isEmergencyExpense = false,
      linkedCashMovementId,
      linkedShiftId,
      linkedGrnId,
      linkedAssetId,
    } = req.body || {};

    if (!['reimbursement_claim', 'company_funded_expense', 'cash_advance'].includes(claimType)) {
      return res.status(400).json({ error: 'Invalid claimType. Must be reimbursement_claim, company_funded_expense, or cash_advance.' });
    }

    const targetBranch = String(operatingBranchId || actor.branchId || 'gra').toLowerCase();
    const allowedBranches = getStaffAllowedBranches(actor);
    if (!isGlobalExpenseViewer(actor) && !allowedBranches.includes(targetBranch)) {
      return res.status(403).json({
        error: `Branch access denied: You cannot submit an expense claim for branch "${targetBranch}".`,
      });
    }

    const category = categories.find((c) => c.id === categoryId) || categories[0];
    if (!category) {
      return res.status(400).json({ error: 'Valid expense category is required.' });
    }

    // Compute line items & total amount
    const normalizedLines: ExpenseLineItem[] = Array.isArray(lineItems)
      ? lineItems
          .filter((l: any) => l && Number(l.amount ?? Number(l.quantity || 1) * Number(l.unitCost || 0)) > 0)
          .map((l: any, idx: number) => {
            const qty = Math.max(0.01, Number(l.quantity || 1));
            const unitCost = Math.max(0, Number(l.unitCost ?? l.amount ?? 0));
            const amt = Math.round((Number(l.amount ?? qty * unitCost) + Number.EPSILON) * 100) / 100;
            return {
              id: l.id || `line-${idx + 1}-${Date.now()}`,
              description: String(l.description || businessReason || category.name).trim(),
              categoryId: l.categoryId || category.id,
              subcategory: l.subcategory || subcategory,
              quantity: qty,
              unitCost,
              amount: amt,
              vatIncluded: Boolean(l.vatIncluded),
              vatAmount: Number(l.vatAmount || 0),
              accountingClassification: l.accountingClassification || category.defaultClassification,
              accountCode: l.accountCode || category.defaultAccountCode,
              inventorySku: l.inventorySku,
              assetTag: l.assetTag,
            };
          })
      : [];

    const computedTotal =
      normalizedLines.length > 0
        ? Math.round(normalizedLines.reduce((s, l) => s + l.amount, 0) * 100) / 100
        : Math.round(Number(rawTotalAmount || 0) * 100) / 100;

    if (isNaN(computedTotal) || computedTotal <= 0) {
      return res.status(400).json({ error: 'Expense total amount must be greater than ₦0.' });
    }

    if (normalizedLines.length === 0) {
      normalizedLines.push({
        id: `line-1-${Date.now()}`,
        description: String(businessReason || description || category.name).trim(),
        categoryId: category.id,
        subcategory,
        quantity: 1,
        unitCost: computedTotal,
        amount: computedTotal,
        accountingClassification:
          claimType === 'cash_advance' ? 'employee_advance' : category.defaultClassification,
        accountCode: claimType === 'cash_advance' ? '1150' : category.defaultAccountCode,
      });
    }

    if (!vendorName || !String(vendorName).trim()) {
      return res.status(400).json({ error: 'Vendor / Payee name is required.' });
    }
    if (!businessReason || !String(businessReason).trim()) {
      return res.status(400).json({ error: 'Business reason / operational justification is required.' });
    }

    // Enforce "Other" / detailed description requirement
    if (
      (category.requiresDetailedDescription || category.id === 'cat_other_exceptional') &&
      String(description || businessReason || '').trim().length < 15
    ) {
      return res.status(400).json({
        error: `Category "${category.name}" requires a detailed explanation of at least 15 characters.`,
      });
    }

    // Check duplicate receipt/invoice reference before saving
    if (receiptOrInvoiceRef && String(receiptOrInvoiceRef).trim()) {
      const refClean = String(receiptOrInvoiceRef).trim().toLowerCase();
      const dup = Object.values(db.expenseClaims || {}).find(
        (c) =>
          c &&
          !['rejected', 'cancelled', 'reversed'].includes(c.status) &&
          c.receiptOrInvoiceRef &&
          c.receiptOrInvoiceRef.trim().toLowerCase() === refClean
      );
      if (dup) {
        return res.status(409).json({
          error: `Duplicate receipt/invoice reference: "${receiptOrInvoiceRef}" is already registered on claim ${dup.claimReference} (${dup.status}).`,
        });
      }
    }

    // Enforce receipt attachment requirement when submitting (not draft) for reimbursement or company-funded expenses
    const receiptThreshold = Math.min(
      category.requiresReceiptAboveNgn ?? approvalMatrix.receiptMandatoryThresholdNgn,
      approvalMatrix.receiptMandatoryThresholdNgn
    );
    const validAttachments = Array.isArray(attachmentIds) ? attachmentIds.filter(Boolean) : [];

    if (
      submitImmediately &&
      claimType !== 'cash_advance' &&
      computedTotal >= receiptThreshold &&
      validAttachments.length === 0
    ) {
      if (!approvalMatrix.allowEmergencyWithoutReceipt || !missingReceiptReason || String(missingReceiptReason).trim().length < 10) {
        return res.status(400).json({
          error: `Supporting receipt or invoice attachment is mandatory for claims of ₦${receiptThreshold.toLocaleString()} or above (or provide a documented missing-receipt exception reason of at least 10 characters).`,
        });
      }
    }

    const now = new Date().toISOString();
    const datePart = now.slice(0, 10).replace(/-/g, '');
    const seq = String(Object.keys(db.expenseClaims || {}).length + 1).padStart(4, '0');
    const claimId = `clm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const claimReference = `CLM-${datePart}-${seq}`;

    const requiresAdditionalApproval =
      computedTotal > approvalMatrix.standardApprovalThresholdNgn ||
      Boolean(
        category.requiresAdditionalApprovalAboveNgn &&
          computedTotal >= category.requiresAdditionalApprovalAboveNgn
      ) ||
      category.defaultClassification === 'fixed_asset';

    const initialStatus = submitImmediately ? 'pending_approval' : 'draft';
    const initialStage = submitImmediately ? 'branch_review' : 'draft';

    const historyEntry: ExpenseApprovalHistoryEntry = {
      id: `hist-${Date.now()}-1`,
      claimId,
      previousStatus: 'none',
      newStatus: initialStatus,
      action: submitImmediately ? 'submit' : 'create_draft',
      stage: 'submission',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: now,
      comment: submitImmediately
        ? `Submitted ${claimType.replace(/_/g, ' ')} for ₦${computedTotal.toLocaleString()}`
        : 'Saved as draft',
    };

    const newClaim: DbExpenseClaim = {
      id: claimId,
      claimReference,
      claimType,
      status: initialStatus,
      claimantStaffId: actor.id,
      claimantName: actor.name,
      claimantRole: actor.role,
      homeBranchId: actor.branchId || 'gra',
      operatingBranchId: targetBranch,
      department: String(department).trim(),
      createdAt: now,
      submittedAt: submitImmediately ? now : undefined,
      expenseDate: expenseDate ? String(expenseDate).slice(0, 10) : now.slice(0, 10),
      categoryId: category.id,
      categoryName: category.name,
      subcategory: subcategory ? String(subcategory).trim() : undefined,
      accountingClassification:
        claimType === 'cash_advance' ? 'employee_advance' : category.defaultClassification,
      targetAccountCode:
        claimType === 'cash_advance' ? '1150' : category.defaultAccountCode || '6400',
      currency: 'NGN',
      totalAmount: computedTotal,
      vatAmount: Math.max(0, Number(rawVatAmount || 0)),
      paidAmount: 0,
      vendorName: String(vendorName).trim(),
      vendorPhoneOrTin: vendorPhoneOrTin ? String(vendorPhoneOrTin).trim() : undefined,
      businessReason: String(businessReason).trim(),
      description: String(description || businessReason).trim(),
      purchaseOrderRef: purchaseOrderRef ? String(purchaseOrderRef).trim() : undefined,
      workOrderRef: workOrderRef ? String(workOrderRef).trim() : undefined,
      receiptOrInvoiceRef: receiptOrInvoiceRef ? String(receiptOrInvoiceRef).trim() : undefined,
      taxInvoiceNumber: taxInvoiceNumber ? String(taxInvoiceNumber).trim() : undefined,
      paymentMethodUsedByClaimant,
      claimantBankName: claimantBankName ? String(claimantBankName).trim() : undefined,
      claimantAccountNumber: claimantAccountNumber ? String(claimantAccountNumber).trim() : undefined,
      claimantAccountName: claimantAccountName ? String(claimantAccountName).trim() : actor.name,
      lineItems: normalizedLines,
      attachmentIds: validAttachments,
      missingReceiptReason: missingReceiptReason ? String(missingReceiptReason).trim() : undefined,
      isEmergencyExpense: Boolean(isEmergencyExpense),
      linkedCashMovementId: linkedCashMovementId ? String(linkedCashMovementId) : undefined,
      linkedShiftId: linkedShiftId ? String(linkedShiftId) : undefined,
      linkedGrnId: linkedGrnId ? String(linkedGrnId) : undefined,
      linkedAssetId: linkedAssetId ? String(linkedAssetId) : undefined,
      requiresAdditionalApproval,
      currentApprovalStage: initialStage,
      fraudFlags: [],
      approvalHistory: [historyEntry],
      payments: [],
    };

    // Link uploaded attachments to this claimId
    for (const attId of validAttachments) {
      if (db.expenseAttachments![attId]) {
        db.expenseAttachments![attId].claimId = claimId;
      }
    }

    newClaim.fraudFlags = evaluateFraudFlags(db, newClaim, category, approvalMatrix);
    db.expenseClaims![claimId] = newClaim;
    saveDatabaseSync();

    logAuditEvent(
      actor.name,
      actor.role,
      targetBranch,
      submitImmediately ? 'EXPENSE_CLAIM_SUBMITTED' : 'EXPENSE_CLAIM_DRAFT_CREATED',
      `${submitImmediately ? 'Submitted' : 'Created draft'} ${claimType} ${claimReference} for ₦${computedTotal.toLocaleString()} (${category.name}, Vendor: ${newClaim.vendorName})`,
      { claimId, claimReference, totalAmount: computedTotal, status: initialStatus }
    );

    if (submitImmediately) {
      createInAppExpenseNotification(db, {
        claim: newClaim,
        eventTitle: `Expense Claim Submitted: ${claimReference}`,
        message: `${actor.name} submitted ${claimReference} (₦${computedTotal.toLocaleString()} — ${category.name}) at ${targetBranch.toUpperCase()} awaiting branch review.`,
      });
      saveDatabaseSync();
    }

    return res.status(201).json({
      success: true,
      claim: newClaim,
    });
  });

  // ============================================================================
  // 5. PUT /api/expenses/claims/:id & POST /api/expenses/claims/:id/submit
  // ============================================================================
  router.put('/api/expenses/claims/:id', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    const { categories, approvalMatrix } = ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const claim = db.expenseClaims![id];

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found.' });
    }

    if (claim.claimantStaffId !== actor.id && !['super_admin', 'corporate_admin'].includes(actor.role)) {
      return res.status(403).json({
        error: 'Only the original claimant can amend a draft or returned expense claim.',
      });
    }

    if (!['draft', 'returned'].includes(claim.status)) {
      return res.status(400).json({
        error: `Claim ${claim.claimReference} is in "${claim.status}" status and its financial details are locked against modification.`,
      });
    }

    const {
      categoryId,
      vendorName,
      businessReason,
      description,
      totalAmount,
      vatAmount,
      expenseDate,
      receiptOrInvoiceRef,
      attachmentIds,
      missingReceiptReason,
      claimantBankName,
      claimantAccountNumber,
      claimantAccountName,
      resubmit = false,
    } = req.body || {};

    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId);
      if (cat) {
        claim.categoryId = cat.id;
        claim.categoryName = cat.name;
        if (claim.claimType !== 'cash_advance') {
          claim.accountingClassification = cat.defaultClassification;
          claim.targetAccountCode = cat.defaultAccountCode;
        }
      }
    }

    if (vendorName && String(vendorName).trim()) claim.vendorName = String(vendorName).trim();
    if (businessReason && String(businessReason).trim()) claim.businessReason = String(businessReason).trim();
    if (description !== undefined) claim.description = String(description).trim();
    if (expenseDate) claim.expenseDate = String(expenseDate).slice(0, 10);
    if (receiptOrInvoiceRef !== undefined) claim.receiptOrInvoiceRef = String(receiptOrInvoiceRef).trim() || undefined;
    if (missingReceiptReason !== undefined) claim.missingReceiptReason = String(missingReceiptReason).trim() || undefined;
    if (claimantBankName !== undefined) claim.claimantBankName = String(claimantBankName).trim() || undefined;
    if (claimantAccountNumber !== undefined) claim.claimantAccountNumber = String(claimantAccountNumber).trim() || undefined;
    if (claimantAccountName !== undefined) claim.claimantAccountName = String(claimantAccountName).trim() || undefined;

    if (totalAmount !== undefined) {
      const numAmt = Math.round(Number(totalAmount) * 100) / 100;
      if (isNaN(numAmt) || numAmt <= 0) {
        return res.status(400).json({ error: 'Total amount must be greater than ₦0.' });
      }
      claim.totalAmount = numAmt;
      if (claim.lineItems.length > 0) {
        claim.lineItems[0].unitCost = numAmt;
        claim.lineItems[0].amount = numAmt;
      }
    }
    if (vatAmount !== undefined) {
      claim.vatAmount = Math.max(0, Number(vatAmount) || 0);
    }
    if (Array.isArray(attachmentIds)) {
      claim.attachmentIds = attachmentIds.filter(Boolean);
      for (const attId of claim.attachmentIds) {
        if (db.expenseAttachments![attId]) {
          db.expenseAttachments![attId].claimId = claim.id;
        }
      }
    }

    const cat = categories.find((c) => c.id === claim.categoryId);
    claim.requiresAdditionalApproval =
      claim.totalAmount > approvalMatrix.standardApprovalThresholdNgn ||
      Boolean(cat?.requiresAdditionalApprovalAboveNgn && claim.totalAmount >= cat.requiresAdditionalApprovalAboveNgn) ||
      claim.accountingClassification === 'fixed_asset';

    claim.fraudFlags = evaluateFraudFlags(db, claim, cat, approvalMatrix);

    if (resubmit) {
      const prev = claim.status;
      claim.status = 'pending_approval';
      claim.currentApprovalStage = 'branch_review';
      claim.submittedAt = new Date().toISOString();
      claim.approvalHistory.push({
        id: `hist-${Date.now()}`,
        claimId: claim.id,
        previousStatus: prev,
        newStatus: 'pending_approval',
        action: prev === 'returned' ? 'resubmit' : 'submit',
        stage: 'submission',
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        timestamp: new Date().toISOString(),
        comment: req.body.comment || 'Amended and resubmitted for approval',
      });
    }

    saveDatabaseSync();
    logAuditEvent(
      actor.name,
      actor.role,
      claim.operatingBranchId,
      resubmit ? 'EXPENSE_CLAIM_RESUBMITTED' : 'EXPENSE_CLAIM_AMENDED',
      `${resubmit ? 'Amended and resubmitted' : 'Updated'} expense claim ${claim.claimReference} (₦${claim.totalAmount.toLocaleString()})`
    );

    return res.json({ success: true, claim });
  });

  // ============================================================================
  // 6. POST /api/expenses/claims/:id/review — Approve, Return, Reject, Escalate
  // ============================================================================
  router.post('/api/expenses/claims/:id/review', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    const { approvalMatrix } = ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const { action, comment = '', approvedAmount } = req.body || {};

    const claim = db.expenseClaims![id];
    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found.' });
    }

    if (!['approve', 'return', 'reject', 'escalate'].includes(action)) {
      return res.status(400).json({ error: 'Invalid review action. Must be approve, return, reject, or escalate.' });
    }

    // CRITICAL GOVERNANCE RULE: Self-approval is strictly prohibited for ALL roles (including managers and admins)
    if (claim.claimantStaffId === actor.id) {
      logAuditEvent(
        actor.name,
        actor.role,
        claim.operatingBranchId,
        'EXPENSE_SELF_APPROVAL_BLOCKED',
        `Blocked attempt by ${actor.name} (${actor.role}) to review/approve their own expense claim ${claim.claimReference}`
      );
      return res.status(403).json({
        error: 'Segregation of duties violation: A claimant cannot review or approve their own expense claim.',
      });
    }

    if (!['submitted', 'pending_approval', 'pending_additional_approval'].includes(claim.status)) {
      return res.status(400).json({
        error: `Claim ${claim.claimReference} is currently "${claim.status}" and cannot be reviewed in this state.`,
      });
    }

    // Check branch scope for non-global reviewers
    if (!isGlobalExpenseViewer(actor)) {
      const allowedBranches = getStaffAllowedBranches(actor);
      if (!allowedBranches.includes(claim.operatingBranchId)) {
        return res.status(403).json({
          error: `Branch isolation enforced: You cannot review expense claims for branch "${claim.operatingBranchId}".`,
        });
      }
    }

    // Look up role authority in approval matrix
    const roleRule = approvalMatrix.roleLimits.find(
      (r) => r.role === actor.role || (actor.role === 'manager' && r.role === 'branch_manager')
    );

    if (!roleRule || !roleRule.canReview) {
      return res.status(403).json({
        error: `Role "${actor.role}" is not authorized to review or approve expense claims.`,
      });
    }

    const now = new Date().toISOString();
    const prevStatus = claim.status;

    if (action === 'return' || action === 'reject') {
      if (!comment || String(comment).trim().length < 5) {
        return res.status(400).json({
          error: `A clear reviewer comment (at least 5 characters) is required when ${action === 'return' ? 'returning' : 'rejecting'} a claim.`,
        });
      }

      const targetStatus = action === 'return' ? 'returned' : 'rejected';
      claim.status = targetStatus;
      claim.currentApprovalStage = action === 'return' ? 'draft' : 'closed';
      claim.approvalHistory.push({
        id: `hist-${Date.now()}`,
        claimId: claim.id,
        previousStatus: prevStatus,
        newStatus: targetStatus,
        action: action === 'return' ? 'return_for_clarification' : 'reject',
        stage: prevStatus === 'pending_additional_approval' ? 'elevated_approval' : 'branch_review',
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        timestamp: now,
        comment: String(comment).trim(),
      });

      createInAppExpenseNotification(db, {
        claim,
        eventTitle:
          action === 'return'
            ? `Claim Returned for Clarification: ${claim.claimReference}`
            : `Claim Rejected: ${claim.claimReference}`,
        message: `${actor.name} (${actor.role}) ${action === 'return' ? 'returned' : 'rejected'} claim ${claim.claimReference}: "${String(comment).trim()}"`,
      });

      saveDatabaseSync();
      logAuditEvent(
        actor.name,
        actor.role,
        claim.operatingBranchId,
        action === 'return' ? 'EXPENSE_CLAIM_RETURNED' : 'EXPENSE_CLAIM_REJECTED',
        `${action === 'return' ? 'Returned' : 'Rejected'} expense claim ${claim.claimReference}: ${String(comment).trim()}`
      );

      return res.json({ success: true, claim });
    }

    if (action === 'escalate') {
      claim.status = 'pending_additional_approval';
      claim.currentApprovalStage = 'elevated_approval';
      claim.requiresAdditionalApproval = true;
      claim.approvalHistory.push({
        id: `hist-${Date.now()}`,
        claimId: claim.id,
        previousStatus: prevStatus,
        newStatus: 'pending_additional_approval',
        action: 'escalate',
        stage: 'branch_review',
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        timestamp: now,
        comment: String(comment || 'Escalated for Finance / Executive approval').trim(),
      });
      saveDatabaseSync();
      return res.json({ success: true, claim });
    }

    // Action === 'approve'
    const effectiveAmount =
      approvedAmount !== undefined && Number(approvedAmount) > 0
        ? Math.round(Number(approvedAmount) * 100) / 100
        : claim.totalAmount;

    if (effectiveAmount > claim.totalAmount) {
      return res.status(400).json({
        error: `Approved amount (₦${effectiveAmount.toLocaleString()}) cannot exceed claimed amount (₦${claim.totalAmount.toLocaleString()}).`,
      });
    }

    // Check if claim is awaiting elevated approval
    if (prevStatus === 'pending_additional_approval' && !roleRule.canApproveElevated) {
      return res.status(403).json({
        error: `Claim ${claim.claimReference} requires elevated Finance / Corporate approval beyond "${actor.role}" authority.`,
      });
    }

    // Check if amount exceeds this role's approval limit or requires 2-stage elevated approval
    const exceedsRoleLimit = effectiveAmount > roleRule.maxApprovalAmountNgn;
    const needsSecondStage =
      (exceedsRoleLimit || claim.requiresAdditionalApproval) && !roleRule.canApproveElevated;

    if (needsSecondStage) {
      if (!roleRule.canApproveStandard) {
        return res.status(403).json({
          error: `Role "${actor.role}" cannot approve claims of ₦${effectiveAmount.toLocaleString()}.`,
        });
      }
      // Record Stage 1 branch approval and escalate to pending_additional_approval
      claim.status = 'pending_additional_approval';
      claim.currentApprovalStage = 'elevated_approval';
      claim.approvedAmount = effectiveAmount;
      claim.approvalHistory.push({
        id: `hist-${Date.now()}`,
        claimId: claim.id,
        previousStatus: prevStatus,
        newStatus: 'pending_additional_approval',
        action: 'approve_stage_1',
        stage: 'branch_review',
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        timestamp: now,
        comment:
          String(comment).trim() ||
          `Stage 1 branch endorsement granted (₦${effectiveAmount.toLocaleString()} exceeds ₦${roleRule.maxApprovalAmountNgn.toLocaleString()} single-stage limit; escalated for Finance/Corporate approval).`,
        amountAuthorised: effectiveAmount,
      });

      createInAppExpenseNotification(db, {
        claim,
        eventTitle: `Stage 1 Endorsed — Escalated: ${claim.claimReference}`,
        message: `${actor.name} endorsed ${claim.claimReference} (₦${effectiveAmount.toLocaleString()}) and escalated to Finance/Corporate for final approval.`,
      });

      saveDatabaseSync();
      logAuditEvent(
        actor.name,
        actor.role,
        claim.operatingBranchId,
        'EXPENSE_CLAIM_ESCALATED_STAGE2',
        `Endorsed Stage 1 and escalated ${claim.claimReference} (₦${effectiveAmount.toLocaleString()}) for elevated approval`
      );

      return res.json({
        success: true,
        escalated: true,
        message: `Stage 1 approved by ${actor.name}. Claim escalated to Finance / Executive approval due to threshold rules.`,
        claim,
      });
    }

    // Final Approval granted!
    claim.approvedAmount = effectiveAmount;
    claim.approvedAt = now;

    // If company_funded_expense was already paid directly from till/bank, mark as paid & record payment if not present
    if (
      claim.claimType === 'company_funded_expense' &&
      ['company_cash_drawer', 'company_bank_transfer', 'company_pos_card'].includes(
        claim.paymentMethodUsedByClaimant
      )
    ) {
      claim.status = 'paid';
      claim.paidAt = now;
      claim.paidAmount = effectiveAmount;
      claim.currentApprovalStage = 'completed';
      if (claim.payments.length === 0) {
        claim.payments.push({
          id: `pmt-${Date.now()}`,
          paidAt: now,
          amount: effectiveAmount,
          paymentMethod:
            claim.paymentMethodUsedByClaimant === 'company_cash_drawer' ? 'cash_drawer' : 'bank_transfer',
          paymentReference: claim.receiptOrInvoiceRef || `DIR-${claim.claimReference}`,
          fundingAccountCode:
            claim.paymentMethodUsedByClaimant === 'company_cash_drawer' ? '1010' : '1030',
          paidByStaffId: actor.id,
          paidByName: actor.name,
          linkedCashMovementId: claim.linkedCashMovementId,
          notes: 'Company-funded expenditure verified and recognized.',
        });
      }
    } else {
      claim.status = 'approved';
      claim.currentApprovalStage = 'finance_settlement';
    }

    claim.approvalHistory.push({
      id: `hist-${Date.now()}`,
      claimId: claim.id,
      previousStatus: prevStatus,
      newStatus: claim.status,
      action: 'approve_final',
      stage: prevStatus === 'pending_additional_approval' ? 'elevated_approval' : 'branch_review',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: now,
      comment: String(comment || 'Approved for accounting recognition and settlement').trim(),
      amountAuthorised: effectiveAmount,
    });

    createInAppExpenseNotification(db, {
      claim,
      eventTitle: `Expense Claim Approved: ${claim.claimReference}`,
      message: `${actor.name} (${actor.role}) approved claim ${claim.claimReference} for ₦${effectiveAmount.toLocaleString()}.`,
    });

    saveDatabaseSync();
    logAuditEvent(
      actor.name,
      actor.role,
      claim.operatingBranchId,
      'EXPENSE_CLAIM_APPROVED',
      `Approved expense claim ${claim.claimReference} for ₦${effectiveAmount.toLocaleString()} (Claimant: ${claim.claimantName})`
    );

    return res.json({ success: true, claim });
  });

  // ============================================================================
  // 7. POST /api/expenses/claims/:id/pay — Settle Reimbursement or Disburse Advance
  // ============================================================================
  router.post('/api/expenses/claims/:id/pay', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    const { approvalMatrix } = ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const claim = db.expenseClaims![id];

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found.' });
    }

    if (!(await hasPermission(actor, 'expenses.pay')) && !['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(actor.role)) {
      return res.status(403).json({
        error: 'Access denied. Recording expense payouts requires finance settlement authority (expenses.pay).',
      });
    }

    if (claim.claimantStaffId === actor.id && actor.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Segregation of duties violation: You cannot disburse payment to yourself.',
      });
    }

    if (!['approved', 'payment_pending', 'partially_paid'].includes(claim.status)) {
      return res.status(400).json({
        error: `Cannot disburse payment for claim ${claim.claimReference} in "${claim.status}" status. Only approved claims can be paid.`,
      });
    }

    // Separate payment authorisation check if configured
    if (approvalMatrix.separatePaymentAuthorisationRequired && !['super_admin', 'corporate_admin', 'accountant'].includes(actor.role)) {
      const lastApproval = [...claim.approvalHistory].reverse().find((h) => h.action === 'approve_final');
      if (lastApproval && lastApproval.actorId === actor.id) {
        return res.status(403).json({
          error: 'Separate payment authorisation is active: A branch manager who approved the claim cannot also execute the payout without Finance or Executive sign-off.',
        });
      }
    }

    const authorisedTotal = Number(claim.approvedAmount ?? claim.totalAmount ?? 0);
    const remainingPayable = Math.round((authorisedTotal - Number(claim.paidAmount || 0)) * 100) / 100;
    if (remainingPayable <= 0) {
      return res.status(409).json({
        error: `Claim ${claim.claimReference} has already been paid in full (₦${authorisedTotal.toLocaleString()}). Duplicate payout blocked.`,
      });
    }

    const {
      amount: rawPayAmount,
      paymentMethod = 'bank_transfer',
      paymentReference,
      fundingAccountCode,
      recordShiftPaidOut = false,
      notes = '',
    } = req.body || {};

    const payAmount =
      rawPayAmount !== undefined
        ? Math.round(Number(rawPayAmount) * 100) / 100
        : remainingPayable;

    if (isNaN(payAmount) || payAmount <= 0 || payAmount > remainingPayable + 0.01) {
      return res.status(400).json({
        error: `Invalid payout amount ₦${payAmount}. Must be between ₦1 and remaining payable balance ₦${remainingPayable.toLocaleString()}.`,
      });
    }

    if (!paymentReference || !String(paymentReference).trim()) {
      return res.status(400).json({
        error: 'Payment reference (Bank Transfer Session ID / Receipt Voucher No.) is mandatory.',
      });
    }

    const now = new Date().toISOString();
    let linkedCashMovementId = req.body.linkedCashMovementId;

    // If paid from register cash drawer and requested, create linked shift paid_out movement
    if (paymentMethod === 'cash_drawer' && recordShiftPaidOut && !linkedCashMovementId) {
      const openShift = Object.values(db.shifts || {}).find(
        (s: any) => s.branchId === claim.operatingBranchId && s.status === 'open'
      );
      if (openShift) {
        const mvId = `cm-exp-${Date.now()}`;
        db.cashMovements.push({
          id: mvId,
          shiftId: openShift.id,
          branchId: claim.operatingBranchId,
          timestamp: now,
          movementType: 'paid_out',
          amount: payAmount,
          reason: `Expense Claim Payout ${claim.claimReference}: ${claim.businessReason}`,
          staffId: actor.id,
          staffName: actor.name,
          recipientOrRef: `${claim.claimantName} (${paymentReference})`,
          notes: `Linked to ${claim.claimReference}`,
        });
        openShift.paidOutsTotal = (openShift.paidOutsTotal || 0) + payAmount;
        openShift.expectedCashInTill = Math.max(0, (openShift.expectedCashInTill || 0) - payAmount);
        linkedCashMovementId = mvId;
      }
    }

    const resolvedFundingCode =
      fundingAccountCode || (paymentMethod === 'cash_drawer' || paymentMethod === 'petty_cash' ? '1010' : '1030');

    const pmtRecord = {
      id: `pmt-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      paidAt: now,
      amount: payAmount,
      paymentMethod,
      paymentReference: String(paymentReference).trim(),
      fundingAccountCode: resolvedFundingCode,
      paidByStaffId: actor.id,
      paidByName: actor.name,
      linkedCashMovementId,
      notes: String(notes).trim(),
    };

    const prevStatus = claim.status;
    claim.payments.push(pmtRecord);
    claim.paidAmount = Math.round((Number(claim.paidAmount || 0) + payAmount) * 100) / 100;
    const isFullyPaid = claim.paidAmount >= authorisedTotal - 0.01;
    claim.status = isFullyPaid ? 'paid' : 'partially_paid';
    if (isFullyPaid) {
      claim.paidAt = now;
      claim.currentApprovalStage = 'completed';
    }

    claim.approvalHistory.push({
      id: `hist-${Date.now()}`,
      claimId: claim.id,
      previousStatus: prevStatus,
      newStatus: claim.status,
      action: 'record_payment',
      stage: 'finance_settlement',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: now,
      comment: `Disbursed ₦${payAmount.toLocaleString()} via ${paymentMethod} (Ref: ${pmtRecord.paymentReference})`,
      amountAuthorised: payAmount,
      paymentReference: pmtRecord.paymentReference,
    });

    createInAppExpenseNotification(db, {
      claim,
      eventTitle: `Payment Disbursed: ${claim.claimReference}`,
      message: `₦${payAmount.toLocaleString()} has been disbursed for ${claim.claimReference} (Ref: ${pmtRecord.paymentReference}).`,
    });

    saveDatabaseSync();
    logAuditEvent(
      actor.name,
      actor.role,
      claim.operatingBranchId,
      'EXPENSE_CLAIM_PAID',
      `Disbursed ₦${payAmount.toLocaleString()} for ${claim.claimReference} to ${claim.claimantName} (Ref: ${pmtRecord.paymentReference})`
    );

    return res.json({ success: true, claim });
  });

  // ============================================================================
  // 8. POST /api/expenses/claims/:id/retire-advance — Retire Cash Advance
  // ============================================================================
  router.post('/api/expenses/claims/:id/retire-advance', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const claim = db.expenseClaims![id];

    if (!claim) {
      return res.status(404).json({ error: 'Cash advance claim not found.' });
    }
    if (claim.claimType !== 'cash_advance') {
      return res.status(400).json({ error: 'Only cash_advance claims can be retired via this endpoint.' });
    }
    if (claim.status !== 'paid') {
      return res.status(400).json({ error: `Cash advance must be in "paid" (disbursed) status before retirement (current: ${claim.status}).` });
    }

    const {
      substantiatedExpenseAmount = 0,
      unspentCashReturned = 0,
      returnPaymentMethod = 'cash_drawer',
      returnReference = '',
      targetExpenseAccountCode = '6400',
      notes = '',
    } = req.body || {};

    const expAmt = Math.round(Number(substantiatedExpenseAmount) * 100) / 100;
    const retAmt = Math.round(Number(unspentCashReturned) * 100) / 100;
    const totalRetired = Math.round((expAmt + retAmt) * 100) / 100;

    if (expAmt < 0 || retAmt < 0 || Math.abs(totalRetired - claim.paidAmount) > 1) {
      return res.status(400).json({
        error: `Substantiated receipts (₦${expAmt.toLocaleString()}) plus unspent cash returned (₦${retAmt.toLocaleString()}) must equal the disbursed advance amount (₦${claim.paidAmount.toLocaleString()}).`,
      });
    }

    const now = new Date().toISOString();
    claim.advanceRetirement = {
      retiredAt: now,
      retiredByStaffId: actor.id,
      retiredByName: actor.name,
      substantiatedExpenseAmount: expAmt,
      unspentCashReturned: retAmt,
      returnPaymentMethod,
      returnReference: String(returnReference).trim() || `RET-${claim.claimReference}`,
      targetExpenseAccountCode: String(targetExpenseAccountCode || '6400'),
      notes: String(notes || 'Cash advance retired and reconciled against receipts').trim(),
    };

    const prevStatus = claim.status;
    claim.status = 'reconciled';
    claim.reconciledAt = now;
    claim.reconciledByStaffId = actor.id;
    claim.reconciledByName = actor.name;
    claim.reconciliationNotes = claim.advanceRetirement.notes;

    claim.approvalHistory.push({
      id: `hist-${Date.now()}`,
      claimId: claim.id,
      previousStatus: prevStatus,
      newStatus: 'reconciled',
      action: 'retire_advance',
      stage: 'reconciliation',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: now,
      comment: `Retired advance: ₦${expAmt.toLocaleString()} substantiated expense (${targetExpenseAccountCode}), ₦${retAmt.toLocaleString()} unspent cash returned.`,
      amountAuthorised: totalRetired,
    });

    saveDatabaseSync();
    logAuditEvent(
      actor.name,
      actor.role,
      claim.operatingBranchId,
      'CASH_ADVANCE_RETIRED',
      `Retired cash advance ${claim.claimReference}: ₦${expAmt.toLocaleString()} expense, ₦${retAmt.toLocaleString()} cash returned`
    );

    return res.json({ success: true, claim });
  });

  // ============================================================================
  // 9. POST /api/expenses/claims/:id/reconcile & /reverse
  // ============================================================================
  router.post('/api/expenses/claims/:id/reconcile', requireAuth, async (req: Request, res: Response) => {
    const db = getDb();
    ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const claim = db.expenseClaims![id];

    if (!claim) return res.status(404).json({ error: 'Expense claim not found.' });
    if (!(await hasPermission(actor, 'expenses.reconcile')) && !['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(actor.role)) {
      return res.status(403).json({ error: 'Access denied. Missing privilege expenses.reconcile.' });
    }
    if (claim.status !== 'paid') {
      return res.status(400).json({ error: `Only "paid" claims can be marked as reconciled (current: ${claim.status}).` });
    }

    const now = new Date().toISOString();
    claim.status = 'reconciled';
    claim.reconciledAt = now;
    claim.reconciledByStaffId = actor.id;
    claim.reconciledByName = actor.name;
    claim.reconciliationNotes = String(req.body?.notes || 'Verified against bank/till statement and receipt voucher').trim();

    claim.approvalHistory.push({
      id: `hist-${Date.now()}`,
      claimId: claim.id,
      previousStatus: 'paid',
      newStatus: 'reconciled',
      action: 'reconcile',
      stage: 'reconciliation',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: now,
      comment: claim.reconciliationNotes,
    });

    saveDatabaseSync();
    logAuditEvent(
      actor.name,
      actor.role,
      claim.operatingBranchId,
      'EXPENSE_CLAIM_RECONCILED',
      `Reconciled expense claim ${claim.claimReference} (₦${(claim.approvedAmount ?? claim.totalAmount).toLocaleString()})`
    );

    return res.json({ success: true, claim });
  });

  router.post('/api/expenses/claims/:id/reverse', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const { reason } = req.body || {};
    const claim = db.expenseClaims![id];

    if (!claim) return res.status(404).json({ error: 'Expense claim not found.' });
    if (!['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(actor.role)) {
      return res.status(403).json({
        error: 'Controlled accounting reversals require Finance Accountant or Executive Administrator authority.',
      });
    }
    if (!['approved', 'paid', 'reconciled'].includes(claim.status)) {
      return res.status(400).json({
        error: `Only approved, paid, or reconciled claims can undergo an accounting reversal (current: ${claim.status}).`,
      });
    }
    if (!reason || String(reason).trim().length < 8) {
      return res.status(400).json({
        error: 'A documented audit reason (at least 8 characters) is mandatory for an accounting reversal.',
      });
    }

    const now = new Date().toISOString();
    const prevStatus = claim.status;
    claim.status = 'reversed';
    claim.reversedAt = now;
    claim.reversedByStaffId = actor.id;
    claim.reversedByName = actor.name;
    claim.reversalReason = String(reason).trim();
    claim.currentApprovalStage = 'closed';

    claim.approvalHistory.push({
      id: `hist-${Date.now()}`,
      claimId: claim.id,
      previousStatus: prevStatus,
      newStatus: 'reversed',
      action: 'reverse',
      stage: 'reversal',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: now,
      comment: `CONTROLLED ACCOUNTING REVERSAL: ${claim.reversalReason}`,
    });

    saveDatabaseSync();
    logAuditEvent(
      actor.name,
      actor.role,
      claim.operatingBranchId,
      'EXPENSE_CLAIM_REVERSED',
      `Reversed expense claim ${claim.claimReference}: ${claim.reversalReason}`
    );

    return res.json({ success: true, claim });
  });

  // ============================================================================
  // 10. GET /api/expenses/analytics — Executive & Branch Spend Analytics
  // ============================================================================
  router.get('/api/expenses/analytics', requireAuth, (req: Request, res: Response) => {
    const db = getDb();
    const { categories } = ensureExpenseStructures(db);
    const actor = (req as any).staff as DbStaffAccount;
    const { branchId = 'all' } = req.query;

    const visibleClaims = Object.values(db.expenseClaims || {})
      .filter((c): c is DbExpenseClaim => Boolean(c))
      .filter((c) => canViewClaim(actor, c))
      .filter((c) => branchId === 'all' || c.operatingBranchId === branchId);

    let pendingReviewCount = 0;
    let pendingReviewAmount = 0;
    let approvedUnpaidAmount = 0;
    let paidAndReconciledAmount = 0;
    let rejectedCount = 0;
    let returnedCount = 0;
    let outstandingAdvancesAmount = 0;
    let flaggedClaimsCount = 0;

    const byCategory: Record<string, { categoryId: string; name: string; spend: number; count: number; budget: number }> = {};
    for (const cat of categories) {
      byCategory[cat.id] = {
        categoryId: cat.id,
        name: cat.name,
        spend: 0,
        count: 0,
        budget: cat.monthlyBranchBudgetNgn || 250000,
      };
    }

    const byBranch: Record<string, { branchId: string; totalApprovedOrPaid: number; pendingAmount: number; count: number }> = {
      gra: { branchId: 'gra', totalApprovedOrPaid: 0, pendingAmount: 0, count: 0 },
      okabere: { branchId: 'okabere', totalApprovedOrPaid: 0, pendingAmount: 0, count: 0 },
      ugbowo: { branchId: 'ugbowo', totalApprovedOrPaid: 0, pendingAmount: 0, count: 0 },
    };

    const vendorMap: Record<string, { vendorName: string; totalAmount: number; claimCount: number }> = {};
    let approvalTurnaroundHoursSum = 0;
    let approvalTurnaroundCount = 0;

    for (const c of visibleClaims) {
      const amt = Number(c.approvedAmount ?? c.totalAmount ?? 0);
      const bKey = c.operatingBranchId || 'gra';
      if (!byBranch[bKey]) {
        byBranch[bKey] = { branchId: bKey, totalApprovedOrPaid: 0, pendingAmount: 0, count: 0 };
      }
      byBranch[bKey].count += 1;

      if (c.fraudFlags && c.fraudFlags.length > 0) {
        flaggedClaimsCount += 1;
      }

      if (['submitted', 'pending_approval', 'pending_additional_approval'].includes(c.status)) {
        pendingReviewCount += 1;
        pendingReviewAmount += amt;
        byBranch[bKey].pendingAmount += amt;
      } else if (['approved', 'payment_pending', 'partially_paid'].includes(c.status)) {
        const unpaid = Math.max(0, amt - Number(c.paidAmount || 0));
        approvedUnpaidAmount += unpaid;
        byBranch[bKey].totalApprovedOrPaid += amt;
      } else if (['paid', 'reconciled'].includes(c.status)) {
        paidAndReconciledAmount += amt;
        byBranch[bKey].totalApprovedOrPaid += amt;
        if (c.claimType === 'cash_advance' && c.status === 'paid') {
          outstandingAdvancesAmount += amt;
        }
      } else if (c.status === 'rejected') {
        rejectedCount += 1;
      } else if (c.status === 'returned') {
        returnedCount += 1;
      }

      if (['approved', 'payment_pending', 'partially_paid', 'paid', 'reconciled'].includes(c.status)) {
        if (!byCategory[c.categoryId]) {
          byCategory[c.categoryId] = {
            categoryId: c.categoryId,
            name: c.categoryName || c.categoryId,
            spend: 0,
            count: 0,
            budget: 250000,
          };
        }
        byCategory[c.categoryId].spend += amt;
        byCategory[c.categoryId].count += 1;

        const vKey = (c.vendorName || 'Unknown Vendor').trim();
        if (!vendorMap[vKey]) {
          vendorMap[vKey] = { vendorName: vKey, totalAmount: 0, claimCount: 0 };
        }
        vendorMap[vKey].totalAmount += amt;
        vendorMap[vKey].claimCount += 1;

        if (c.submittedAt && c.approvedAt) {
          const hrs =
            (new Date(c.approvedAt).getTime() - new Date(c.submittedAt).getTime()) / (1000 * 60 * 60);
          if (hrs >= 0 && hrs < 720) {
            approvalTurnaroundHoursSum += hrs;
            approvalTurnaroundCount += 1;
          }
        }
      }
    }

    const avgTurnaroundHours =
      approvalTurnaroundCount > 0
        ? Number((approvalTurnaroundHoursSum / approvalTurnaroundCount).toFixed(1))
        : 0;

    return res.json({
      success: true,
      summary: {
        totalClaimsCount: visibleClaims.length,
        pendingReviewCount,
        pendingReviewAmount,
        approvedUnpaidAmount,
        paidAndReconciledAmount,
        outstandingAdvancesAmount,
        rejectedCount,
        returnedCount,
        flaggedClaimsCount,
        avgTurnaroundHours,
      },
      byCategory: Object.values(byCategory).filter((c) => c.count > 0 || c.budget > 0),
      byBranch: Object.values(byBranch),
      topVendors: Object.values(vendorMap)
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 8),
    });
  });

  return router;
}
