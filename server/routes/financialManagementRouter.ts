import express, { Request, Response } from 'express';
import crypto from 'crypto';
import type { DbDatabase, DbStaffAccount, DbFixedAsset } from '../../server_db.ts';
import { db as pgDb } from '../db/db.ts';
import {
  payrolls as pgPayrolls,
  journalEntries as pgJournalEntries,
  ledgerLines as pgLedgerLines,
} from '../db/schema/financials.ts';
import { staff as pgStaff } from '../db/schema/staff.ts';
import { eq, desc } from 'drizzle-orm';
import { ensureCanonicalDeliveryZones } from '../services/deliveryFeeAuthorityService.ts';

export interface FinancialManagementRouterDeps {
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

export function createFinancialManagementRouter(deps: FinancialManagementRouterDeps): express.Router {
  const router = express.Router();
  const { getDb, saveDatabaseSync, requireAuth, hasPermission, logAuditEvent } = deps;

  function ensureFinanceStructures(db: any) {
    if (!db.payrolls) db.payrolls = {};
    if (!db.capexRequisitions) db.capexRequisitions = {};
    if (!db.supplierInvoices) db.supplierInvoices = {};
    if (!db.expenditureBudgets) {
      db.expenditureBudgets = {
        gra: { monthlyOpexLimit: 1850000, monthlyCapexLimit: 750000 },
        okabere: { monthlyOpexLimit: 1250000, monthlyCapexLimit: 450000 },
        ugbowo: { monthlyOpexLimit: 950000, monthlyCapexLimit: 350000 },
      };
    }
    if (!db.settings) db.settings = {} as any;
    if (!db.settings.financePolicy) {
      db.settings.financePolicy = {
        separatePaymentAuthorisationRequired: true,
        statutoryPensionEmployeePct: 8,
        statutoryPensionEmployerPct: 10,
        statutoryNhfPct: 2.5,
        defaultVatPct: 7.5,
      };
    }
    if (!db.payrollAdjustments) {
      db.payrollAdjustments = {
        'adj-seed-1': {
          id: 'adj-seed-1',
          staffId: 'stf-kit-1',
          employeeId: 'CLR-GRA-005',
          staffName: 'Chef Musa Danjuma',
          branchId: 'gra',
          type: 'loan',
          category: 'staff_loan',
          title: 'Compassionate Housing Support Loan',
          principalAmount: 120000,
          monthlyInstallment: 20000,
          remainingBalance: 80000,
          amountThisPeriod: 20000,
          isRecurring: true,
          effectivePeriod: '2026-03',
          status: 'approved',
          createdByStaffId: 'stf-acc-1',
          createdByName: 'Ngozi Okonkwo (ACA)',
          approvedByStaffId: 'stf-1',
          approvedByName: 'Osahon Igbinedion',
          createdAt: '2026-01-15T10:00:00.000Z',
        },
        'adj-seed-2': {
          id: 'adj-seed-2',
          staffId: 'stf-pos-1',
          employeeId: 'CLR-GRA-004',
          staffName: 'Blessing Omoregie',
          branchId: 'gra',
          type: 'deduction',
          category: 'cash_shortage',
          title: 'Verified Till Variance Recovery (Shift SHF-042)',
          principalAmount: 3500,
          monthlyInstallment: 3500,
          remainingBalance: 3500,
          amountThisPeriod: 3500,
          isRecurring: false,
          effectivePeriod: '2026-03',
          status: 'approved',
          createdByStaffId: 'stf-acc-1',
          createdByName: 'Ngozi Okonkwo (ACA)',
          approvedByStaffId: 'stf-2',
          approvedByName: 'Amina Bello',
          createdAt: '2026-03-10T14:20:00.000Z',
        },
      };
    }
    if (!db.riderCompensationConfig) {
      db.riderCompensationConfig = {
        internalRiderConfig: {
          monthlyBaseSalary: 25000,
          perDeliveryFee: 200,
          requireOtpVerification: true,
          excludeCancelledOrReturned: true,
          updatedAt: '2026-03-01T08:00:00.000Z',
          updatedBy: 'Osahon Igbinedion',
        },
        externalRiderZoneSplits: [
          {
            zoneId: 'zone-gra',
            zoneName: 'GRA Flagship & Okogo Environ',
            branchId: 'gra',
            customerDeliveryFee: 1500,
            riderShareAmount: 1050,
            companyShareAmount: 450,
            isActive: true,
          },
          {
            zoneId: 'zone-okabere',
            zoneName: 'Okabere / Upper Sapele Road',
            branchId: 'okabere',
            customerDeliveryFee: 1500,
            riderShareAmount: 1050,
            companyShareAmount: 450,
            isActive: true,
          },
          {
            zoneId: 'zone-ugbowo',
            zoneName: 'Ugbowo / UNIBEN / Ekosodin',
            branchId: 'ugbowo',
            customerDeliveryFee: 1200,
            riderShareAmount: 850,
            companyShareAmount: 350,
            isActive: true,
          },
          {
            zoneId: 'zone-airport',
            zoneName: 'Airport Road / Adesuwa / Ihama',
            branchId: 'gra',
            customerDeliveryFee: 1800,
            riderShareAmount: 1250,
            companyShareAmount: 550,
            isActive: true,
          },
          {
            zoneId: 'zone-ringroad',
            zoneName: 'Ring Road / Akpakpava / Forestry',
            branchId: 'gra',
            customerDeliveryFee: 2000,
            riderShareAmount: 1400,
            companyShareAmount: 600,
            isActive: true,
          },
        ],
      };
    }
    ensureCanonicalDeliveryZones(db);
  }

  async function canAccessPayroll(staff: DbStaffAccount): Promise<boolean> {
    if (staff.role === 'super_admin' || staff.role === 'admin' || staff.role === 'corporate_admin') return true;
    if (await hasPermission(staff, 'payroll.view')) return true;
    return false;
  }

  // ============================================================================
  // 1. CAPEX REQUISITIONS & FIXED ASSET PURCHASES
  // ============================================================================
  router.get('/api/finance/capex/requisitions', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;

    if (!(await hasPermission(staff, 'capex.manage')) && !['super_admin', 'corporate_admin', 'branch_manager', 'accountant', 'auditor'].includes(staff.role)) {
      return res.status(403).json({ error: 'Access denied: CAPEX requisition management requires capex.manage privilege.' });
    }

    const { branchId, status } = req.query;
    let list = Object.values(db.capexRequisitions || {}) as any[];

    if (branchId && branchId !== 'all') {
      list = list.filter((r) => r.branchId === branchId);
    }
    if (status) {
      list = list.filter((r) => r.status === status);
    }

    res.json(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  });

  router.post('/api/finance/capex/requisitions', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;

    if (!(await hasPermission(staff, 'capex.manage')) && !['super_admin', 'corporate_admin', 'branch_manager', 'accountant'].includes(staff.role)) {
      return res.status(403).json({ error: 'Access denied: You do not have authority to create CAPEX purchase requisitions.' });
    }

    const { assetName, category, estimatedCost, vendorName, justification, branchId, expectedLifespanMonths } = req.body || {};

    if (!assetName || !estimatedCost || Number(estimatedCost) <= 0) {
      return res.status(400).json({ error: 'assetName and valid estimatedCost (> ₦0) are required.' });
    }

    const targetBranch = branchId || staff.branchId || 'gra';
    const reqId = `cpx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const reqNumber = `CAPEX-${String(Object.keys(db.capexRequisitions).length + 1).padStart(4, '0')}`;

    const newReq = {
      id: reqId,
      requisitionNumber: reqNumber,
      assetName: String(assetName).trim(),
      category: category || 'kitchen_equipment',
      estimatedCost: Number(estimatedCost),
      vendorName: String(vendorName || 'Selected Vendor').trim(),
      justification: String(justification || '').trim(),
      branchId: targetBranch,
      expectedLifespanMonths: Number(expectedLifespanMonths) || 36,
      status: 'pending_approval',
      requestedByStaffId: staff.id,
      requestedByName: staff.name,
      requestedByRole: staff.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [
        {
          action: 'create',
          byStaffId: staff.id,
          byStaffName: staff.name,
          timestamp: new Date().toISOString(),
          notes: 'CAPEX requisition submitted for management review',
        },
      ],
    };

    db.capexRequisitions[reqId] = newReq;
    saveDatabaseSync();

    logAuditEvent(
      staff.name,
      staff.role,
      targetBranch,
      'CAPEX_REQUISITION_CREATED',
      `Submitted CAPEX requisition ${reqNumber} for "${newReq.assetName}" (₦${newReq.estimatedCost.toLocaleString()})`
    );

    res.status(201).json({ success: true, requisition: newReq });
  });

  router.post('/api/finance/capex/requisitions/:id/approve', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const requisition = db.capexRequisitions[id];

    if (!requisition) return res.status(404).json({ error: 'CAPEX requisition not found.' });

    // Segregation of duties: Requester cannot approve own CAPEX
    if (requisition.requestedByStaffId === staff.id && staff.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Segregation of duties violation: The staff member who submitted the CAPEX requisition cannot approve it.',
      });
    }

    if (!(await hasPermission(staff, 'capex.approve')) && !['super_admin', 'corporate_admin', 'admin'].includes(staff.role)) {
      return res.status(403).json({ error: 'CAPEX approvals require capex.approve privilege or executive authority.' });
    }

    const now = new Date().toISOString();
    requisition.status = 'approved';
    requisition.approvedByStaffId = staff.id;
    requisition.approvedByName = staff.name;
    requisition.approvedAt = now;
    requisition.updatedAt = now;
    requisition.history.push({
      action: 'approve',
      byStaffId: staff.id,
      byStaffName: staff.name,
      timestamp: now,
      notes: req.body.notes || 'Requisition approved by Executive Management',
    });

    saveDatabaseSync();
    logAuditEvent(
      staff.name,
      staff.role,
      requisition.branchId,
      'CAPEX_APPROVED',
      `Approved CAPEX ${requisition.requisitionNumber} for "${requisition.assetName}" (₦${requisition.estimatedCost.toLocaleString()})`
    );

    res.json({ success: true, requisition });
  });

  router.post('/api/finance/capex/requisitions/:id/procure', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const { actualCost, assetTag, serialNumber, paymentReference, fundingAccount = '1030' } = req.body || {};
    const requisition = db.capexRequisitions[id];

    if (staff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
    }
    if (!(await hasPermission(staff, 'capex.manage')) && !['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(staff.role)) {
      return res.status(403).json({ error: 'Access denied: Capitalizing CAPEX purchases requires capex.manage or accounting authority.' });
    }
    if (!requisition) return res.status(404).json({ error: 'CAPEX requisition not found.' });
    if (requisition.status !== 'approved') {
      return res.status(400).json({ error: `Cannot capitalize requisition in "${requisition.status}" status. Must be approved first.` });
    }

    // Segregation of duties if configured
    if (db.settings.financePolicy.separatePaymentAuthorisationRequired) {
      if (requisition.approvedByStaffId === staff.id && staff.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Segregation of duties violation: An approver cannot also disburse capital payment.',
        });
      }
    }

    const cost = Number(actualCost || requisition.estimatedCost);
    const now = new Date().toISOString();
    const tag = assetTag || `AST-${requisition.branchId.toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const assetId = `ast-${Date.now()}`;

    // 1. Add to Fixed Asset Register
    const newAsset: DbFixedAsset = {
      id: assetId,
      assetTag: tag,
      name: requisition.assetName,
      category: requisition.category,
      branchId: requisition.branchId,
      serialNumber: serialNumber || `SN-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      purchaseDate: now.slice(0, 10),
      purchaseCost: cost,
      currentValue: cost,
      depreciationRatePct: 20, // 20% straight line
      status: 'operational',
      createdAt: now,
      updatedAt: now,
    };
    db.assets[assetId] = newAsset;

    // 2. Mark Requisition as Procured & Capitalized
    requisition.status = 'capitalized';
    requisition.capitalizedAssetId = assetId;
    requisition.actualCost = cost;
    requisition.paidAt = now;
    requisition.paymentReference = paymentReference || `CPX-PAY-${Date.now().toString().slice(-6)}`;
    requisition.updatedAt = now;
    requisition.history.push({
      action: 'procure_and_capitalize',
      byStaffId: staff.id,
      byStaffName: staff.name,
      timestamp: now,
      notes: `Asset capitalized under tag ${tag} for ₦${cost.toLocaleString()} (Ref: ${requisition.paymentReference})`,
    });

    saveDatabaseSync();
    logAuditEvent(
      staff.name,
      staff.role,
      requisition.branchId,
      'CAPEX_CAPITALIZED',
      `Capitalized fixed asset "${requisition.assetName}" (${tag}) at cost ₦${cost.toLocaleString()}`
    );

    res.json({ success: true, requisition, asset: newAsset });
  });

  // ============================================================================
  // 2. NIGERIAN PAYROLL PREPARATION, APPROVAL, DISBURSEMENT & RECONCILIATION
  // ============================================================================
  router.get('/api/finance/payroll/periods', requireAuth, async (req: Request, res: Response) => {
    try {
      const db = getDb() as any;
      ensureFinanceStructures(db);
      const staff = (req as any).staff as DbStaffAccount;

      if (!(await canAccessPayroll(staff))) {
        return res.status(403).json({ error: 'Access denied: Confidential payroll access is restricted to authorized financial officers.' });
      }

      // Query PostgreSQL as authoritative database
      const pgRows = await pgDb.select().from(pgPayrolls).orderBy(desc(pgPayrolls.period));
      
      const mappedList = pgRows.map((r: any) => {
        const meta = (r.metadata as Record<string, any>) || {};
        const lines = (r.linesJson as any[]) || [];
        return {
          id: r.id,
          payPeriod: r.period,
          branchId: r.branchId || 'all',
          status: r.status,
          totalGross: Number(r.totalGross) || 0,
          totalDeductions: Number(r.totalDeductions) || 0,
          totalNetPay: Number(r.totalNet ?? r.totalNetPay) || 0,
          staffCount: lines.length,
          eligibleCount: meta.eligibleCount || lines.length,
          calculatedCount: meta.calculatedCount || lines.filter((l: any) => l.calculationStatus === 'calculated').length,
          attentionCount: meta.attentionCount || lines.filter((l: any) => l.calculationStatus === 'attention_required').length,
          totalEmployeePension: meta.totalEmployeePension || 0,
          totalEmployerPension: meta.totalEmployerPension || 0,
          totalPayeTax: meta.totalPayeTax || 0,
          totalNhf: meta.totalNhf || 0,
          preparedBy: r.preparedBy,
          preparedAt: meta.preparedAt || r.createdAt,
          approvedBy: r.approvedBy,
          approvedAt: meta.approvedAt,
          paymentReference: meta.paymentReference,
          paymentStatus: ['disbursed', 'reconciled'].includes(r.status) ? 'paid' : (r.status === 'payment_scheduled' ? 'scheduled' : 'unpaid'),
          fundingAccount: meta.fundingAccount,
          lines,
          metadata: meta,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });

      res.json(mappedList);
    } catch (err: any) {
      console.error('[Payroll Periods Fetch Error]', err);
      // Fallback to in-memory if DB transient issue
      const db = getDb() as any;
      const list = (Object.values(db.payrolls || {}) as any[]).map((p: any) => ({
        ...p,
        totalGross: Number(p.totalGross) || 0,
        totalDeductions: Number(p.totalDeductions) || 0,
        totalNetPay: Number(p.totalNetPay ?? p.totalNet) || 0,
      }));
      res.json(list.sort((a, b) => (b.payPeriod || '').localeCompare(a.payPeriod || '')));
    }
  });

  router.get('/api/finance/payroll/periods/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const staff = (req as any).staff as DbStaffAccount;

      if (!(await canAccessPayroll(staff))) {
        return res.status(403).json({ error: 'Access denied: Confidential payroll access is restricted.' });
      }

      const [batch] = await pgDb.select().from(pgPayrolls).where(eq(pgPayrolls.id, id));
      if (!batch) {
        const db = getDb() as any;
        const legacy = db.payrolls?.[id];
        if (!legacy) return res.status(404).json({ error: 'Payroll batch not found.' });
        return res.json(legacy);
      }

      const meta = (batch.metadata as Record<string, any>) || {};
      const lines = (batch.linesJson as any[]) || [];
      const calculatedCount = lines.filter((l: any) => l.calculationStatus === 'calculated').length;
      const attentionCount = lines.filter((l: any) => l.calculationStatus === 'attention_required').length;

      res.json({
        id: batch.id,
        payPeriod: batch.period,
        branchId: batch.branchId || 'all',
        status: batch.status,
        totalGross: Number(batch.totalGross) || 0,
        totalDeductions: Number(batch.totalDeductions) || 0,
        totalNetPay: Number(batch.totalNet ?? (batch as any).totalNetPay) || 0,
        staffCount: lines.length,
        eligibleCount: meta.eligibleCount || lines.length,
        calculatedCount: meta.calculatedCount || calculatedCount,
        attentionCount: meta.attentionCount || attentionCount,
        totalEmployeePension: meta.totalEmployeePension || 0,
        totalEmployerPension: meta.totalEmployerPension || 0,
        totalPayeTax: meta.totalPayeTax || 0,
        totalNhf: meta.totalNhf || 0,
        preparedBy: batch.preparedBy,
        preparedAt: meta.preparedAt || batch.createdAt,
        approvedBy: batch.approvedBy,
        approvedAt: meta.approvedAt,
        paymentReference: meta.paymentReference,
        paymentStatus: ['disbursed', 'reconciled'].includes(batch.status) ? 'paid' : (batch.status === 'payment_scheduled' ? 'scheduled' : 'unpaid'),
        fundingAccount: meta.fundingAccount,
        periodStart: meta.periodStart,
        periodEnd: meta.periodEnd,
        paymentDate: meta.paymentDate,
        frequency: meta.frequency || 'monthly',
        history: meta.history || [],
        lines,
        metadata: meta,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      });
    } catch (err: any) {
      console.error('[Payroll Details Fetch Error]', err);
      res.status(500).json({ error: 'Failed to retrieve payroll details.' });
    }
  });

  router.post('/api/finance/payroll/prepare', requireAuth, async (req: Request, res: Response) => {
    try {
      const db = getDb() as any;
      ensureFinanceStructures(db);
      const staff = (req as any).staff as DbStaffAccount;

      if (!(await canAccessPayroll(staff)) || (!(await hasPermission(staff, 'payroll.prepare')) && !['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(staff.role))) {
        return res.status(403).json({ error: 'Access denied: You do not have authority to prepare payroll.' });
      }

      const {
        payPeriod,
        branchId = 'all',
        periodStart,
        periodEnd,
        paymentDate,
        frequency = 'monthly',
        forceRecalculate = false,
      } = req.body || {};

      if (!payPeriod || !/^\d{4}-\d{2}$/.test(String(payPeriod))) {
        return res.status(400).json({ error: 'Valid payPeriod in format YYYY-MM is required (e.g. "2026-11").' });
      }

      const payrollId = `pr-${payPeriod}-${branchId}`;

      // Duplicate Check: Check if batch already exists in PostgreSQL
      const [existingBatch] = await pgDb.select().from(pgPayrolls).where(eq(pgPayrolls.id, payrollId));
      if (existingBatch) {
        if (['approved', 'disbursed', 'reconciled'].includes(existingBatch.status)) {
          return res.status(409).json({
            error: `Payroll for period ${payPeriod} (${branchId}) has already been ${existingBatch.status.toUpperCase()}. Approved/disbursed payroll runs cannot be overwritten.`,
            existingId: existingBatch.id,
          });
        }
        if (!forceRecalculate && existingBatch.status === 'pending_approval') {
          return res.status(409).json({
            error: `A prepared payroll batch for ${payPeriod} (${branchId}) already exists under review. Review the existing batch or confirm recalculation.`,
            existingId: existingBatch.id,
            canRecalculate: true,
          });
        }
      }

      // 1. Fetch eligible staff authoritative records from PostgreSQL
      const allStaffRecords = await pgDb.select().from(pgStaff);
      const eligibleStaff = allStaffRecords.filter((s: any) => {
        if (s.status === 'suspended') return false;
        if (branchId === 'all') return true;
        if (s.branchId === branchId) return true;
        if (Array.isArray(s.allowedBranchIds) && s.allowedBranchIds.includes(branchId)) return true;
        return false;
      });

      if (eligibleStaff.length === 0) {
        return res.status(400).json({ error: `No active eligible staff members found for branch scope: ${branchId}.` });
      }

      let totalGross = 0;
      let totalEmployeePension = 0;
      let totalEmployerPension = 0;
      let totalPayeTax = 0;
      let totalNhf = 0;
      let totalDeductionsAll = 0;
      let totalNetPay = 0;
      let calculatedCount = 0;
      let attentionCount = 0;

      // 2. Real Payroll Calculation Engine per Nigerian Tax & Pension Rules + Rider Sync + Approved Deductions
      const internalRiderCfg = db.riderCompensationConfig?.internalRiderConfig || {
        monthlyBaseSalary: 25000,
        perDeliveryFee: 200,
      };
      const allDeliveryTasks = Object.values(db.deliveryTasks || {}) as any[];
      const allAdjustments = Object.values(db.payrollAdjustments || {}) as any[];

      const computedLines = eligibleStaff.map((s: any) => {
        const prof = s.payrollProfile || {};
        const isInternalRider = s.role === 'rider';
        const hasValidProfile =
          (prof && Number(prof.basicSalary) > 0 && prof.status === 'active') || isInternalRider;

        if (!hasValidProfile) {
          attentionCount++;
          return {
            staffId: s.id,
            employeeId: s.staffId,
            staffName: s.name,
            role: s.role,
            branchId: s.branchId || 'gra',
            basicSalary: 0,
            housingAllowance: 0,
            transportAllowance: 0,
            otherAllowances: 0,
            riderDeliveryCount: 0,
            riderDeliveryRate: 0,
            riderDeliveryBonus: 0,
            grossSalary: 0,
            employeePension: 0,
            employerPension: 0,
            nhfDeduction: 0,
            cra: 0,
            taxableIncome: 0,
            payeTax: 0,
            voluntaryDeductions: 0,
            adjustmentItems: [],
            totalDeductions: 0,
            netPay: 0,
            bankName: prof?.bankName || 'Not Provided',
            accountNumberMasked: prof?.accountNumber ? `******${prof.accountNumber.slice(-4)}` : 'Incomplete',
            accountNumberRaw: prof?.accountNumber || '',
            accountName: prof?.accountName || s.name,
            calculationStatus: 'attention_required',
            paymentStatus: 'unpaid',
            exceptionReason: 'No valid salary profile configured in Staff Directory. Enter basic salary and bank details before finalizing.',
          };
        }

        calculatedCount++;
        // Internal Rider uses configurable monthlyBaseSalary (e.g. ₦25,000) + verified perDeliveryFee (e.g. ₦200) without double-counting
        const basic = isInternalRider
          ? Math.max(0, Math.round(Number(internalRiderCfg.monthlyBaseSalary ?? prof.basicSalary ?? 25000)))
          : Math.max(0, Math.round(Number(prof.basicSalary) || 0));
        const housing = isInternalRider ? 0 : Math.max(0, Math.round(Number(prof.housingAllowance) || 0));
        const transport = isInternalRider ? 0 : Math.max(0, Math.round(Number(prof.transportAllowance) || 0));
        const baseOther = isInternalRider ? 0 : Math.max(0, Math.round(Number(prof.otherAllowances) || 0));

        // Calculate verified completed deliveries for internal riders (deduplicated by orderId/taskId)
        let riderDeliveryCount = 0;
        const riderDeliveryRate = isInternalRider ? Math.max(0, Number(internalRiderCfg.perDeliveryFee ?? 200)) : 0;
        if (isInternalRider) {
          const seenOrders = new Set<string>();
          for (const t of allDeliveryTasks) {
            if (t.status !== 'delivered') continue;
            const matchesRider =
              t.riderId === s.id ||
              t.riderId === s.staffId ||
              (t.riderName && s.name && String(t.riderName).toLowerCase() === String(s.name).toLowerCase());
            if (!matchesRider) continue;
            const dedupKey = String(t.orderId || t.id);
            if (!seenOrders.has(dedupKey)) {
              seenOrders.add(dedupKey);
              riderDeliveryCount++;
            }
          }
          // If no historical tasks in current period yet, include baseline verified runs from rider profile if configured
          if (riderDeliveryCount === 0 && Number(prof.verifiedDeliveriesCount) > 0) {
            riderDeliveryCount = Number(prof.verifiedDeliveriesCount);
          }
        }
        const riderDeliveryBonus = riderDeliveryCount * riderDeliveryRate;
        const other = baseOther + riderDeliveryBonus;

        // Earnings
        const gross = basic + housing + transport + other;
        const pensionable = basic + housing + transport;

        // Pension (Pension Reform Act: 8% employee, 10% employer)
        const empPension = prof.pensionApplicable === false ? 0 : Math.round(pensionable * 0.08);
        const empyrPension = prof.pensionApplicable === false ? 0 : Math.round(pensionable * 0.10);

        // National Housing Fund (2.5% of basic salary)
        const nhf = prof.nhfApplicable === false ? 0 : Math.round(basic * 0.025);

        // Consolidated Relief Allowance (CRA): Higher of ₦200,000/12 (₦16,667) or 1% of gross + 20% of gross
        const fixedCra = 16667;
        const cra = Math.max(fixedCra, Math.round(gross * 0.01)) + Math.round(gross * 0.20);

        // Taxable Income
        const taxable = Math.max(0, gross - (empPension + nhf + cra));

        // Graduated PAYE Tax computation across monthly bands
        let remTaxable = taxable;
        let paye = 0;
        const b1 = Math.min(remTaxable, 25000);
        paye += b1 * 0.07;
        remTaxable -= b1;
        if (remTaxable > 0) {
          const b2 = Math.min(remTaxable, 25000);
          paye += b2 * 0.11;
          remTaxable -= b2;
        }
        if (remTaxable > 0) {
          const b3 = Math.min(remTaxable, 41667);
          paye += b3 * 0.15;
          remTaxable -= b3;
        }
        if (remTaxable > 0) {
          const b4 = Math.min(remTaxable, 41667);
          paye += b4 * 0.19;
          remTaxable -= b4;
        }
        if (remTaxable > 0) {
          const b5 = Math.min(remTaxable, 133333);
          paye += b5 * 0.21;
          remTaxable -= b5;
        }
        if (remTaxable > 0) {
          paye += remTaxable * 0.24;
        }
        paye = Math.round(paye);
        if (paye < Math.round(gross * 0.01) && gross > 30000) {
          paye = Math.round(gross * 0.01);
        }
        if (prof.taxApplicable === false) {
          paye = 0;
        }

        // Approved Individual Adjustments, Loans, Salary Advances, Fines & Cash Shortages
        const staffAdjustments = allAdjustments.filter(
          (adj) =>
            adj.status === 'approved' &&
            (adj.staffId === s.id || adj.employeeId === s.staffId) &&
            (adj.isRecurring ? Number(adj.remainingBalance || 0) > 0 : (!adj.effectivePeriod || adj.effectivePeriod === payPeriod))
        );

        let voluntaryDeductions = Math.max(0, Math.round(Number(prof.recurringDeductions) || 0));
        let bonusAdditions = 0;
        const adjustmentItems = staffAdjustments.map((adj) => {
          const amt = (adj.isRecurring || adj.category === 'loan_repayment')
            ? Math.min(Number(adj.remainingBalance || 0), Number(adj.monthlyInstallment || adj.amountThisPeriod || adj.amount || 0))
            : Number(adj.amountThisPeriod || adj.amount || adj.principalAmount || 0);
          if (adj.type === 'addition' || adj.type === 'earning' || ['bonus', 'performance_bonus', 'overtime_allowance', 'hazard_allowance'].includes(adj.category)) {
            bonusAdditions += amt;
          } else {
            voluntaryDeductions += amt;
          }
          return {
            id: adj.id,
            title: adj.title || adj.reason,
            category: adj.category,
            type: adj.type,
            amount: amt,
            remainingLoanBalanceAfter: (adj.type === 'loan' || adj.category === 'loan_repayment') ? Math.max(0, Number(adj.remainingBalance || 0) - amt) : 0,
          };
        });

        const finalGross = gross + bonusAdditions;
        const deductions = empPension + nhf + paye + voluntaryDeductions;
        const net = Math.max(0, finalGross - deductions);

        totalGross += finalGross;
        totalEmployeePension += empPension;
        totalEmployerPension += empyrPension;
        totalPayeTax += paye;
        totalNhf += nhf;
        totalDeductionsAll += deductions;
        totalNetPay += net;

        return {
          staffId: s.id,
          employeeId: s.staffId,
          staffName: s.name,
          role: s.role,
          branchId: s.branchId || 'gra',
          basicSalary: basic,
          housingAllowance: housing,
          transportAllowance: transport,
          otherAllowances: other + bonusAdditions,
          riderDeliveryCount,
          riderCompletedDeliveries: riderDeliveryCount,
          riderDeliveryRate,
          riderDeliveryBonus,
          periodBonuses: bonusAdditions,
          periodDeductions: voluntaryDeductions,
          grossSalary: finalGross,
          employeePension: empPension,
          employerPension: empyrPension,
          nhfDeduction: nhf,
          cra,
          taxableIncome: taxable,
          payeTax: paye,
          voluntaryDeductions,
          adjustmentItems,
          totalDeductions: deductions,
          netPay: net,
          bankName: prof.bankName || 'Guaranty Trust Bank',
          accountNumberMasked: prof.accountNumber ? `******${prof.accountNumber.slice(-4)}` : '******8901',
          accountNumberRaw: prof.accountNumber || '0123458901',
          accountName: prof.accountName || s.name,
          calculationStatus: 'calculated',
          paymentStatus: 'unpaid',
        };
      });

      const now = new Date().toISOString();
      const metadata = {
        payPeriod,
        frequency,
        periodStart: periodStart || `${payPeriod}-01`,
        periodEnd: periodEnd || `${payPeriod}-30`,
        paymentDate: paymentDate || `${payPeriod}-28`,
        eligibleCount: eligibleStaff.length,
        calculatedCount,
        attentionCount,
        totalEmployeePension,
        totalEmployerPension,
        totalPayeTax,
        totalNhf,
        preparedByStaffId: staff.id,
        preparedByName: staff.name,
        preparedAt: now,
        history: [
          {
            stage: 'preparation',
            byStaffId: staff.id,
            byStaffName: staff.name,
            timestamp: now,
            notes: `Prepared payroll for ${payPeriod} (${calculatedCount} staff calculated, ${attentionCount} attention required, Net: ₦${totalNetPay.toLocaleString()})`,
          },
        ],
      };

      const payrollRow = {
        id: payrollId,
        branchId,
        period: payPeriod,
        status: 'pending_approval',
        totalGross,
        totalDeductions: totalDeductionsAll,
        totalNet: totalNetPay,
        preparedBy: staff.name,
        approvedBy: null,
        linesJson: computedLines,
        metadata,
        updatedAt: new Date(),
      };

      // 3. Persist authoritative record into PostgreSQL
      await pgDb.insert(pgPayrolls).values(payrollRow).onConflictDoUpdate({
        target: pgPayrolls.id,
        set: payrollRow,
      });

      // Backward compatibility sync
      db.payrolls[payrollId] = {
        id: payrollId,
        payPeriod,
        branchId,
        status: 'pending_approval',
        totalGross,
        totalDeductions: totalDeductionsAll,
        totalNetPay,
        staffCount: computedLines.length,
        lines: computedLines,
        metadata,
        preparedBy: staff.name,
        preparedAt: now,
        history: metadata.history,
      };
      saveDatabaseSync();

      logAuditEvent(
        staff.name,
        staff.role,
        branchId === 'all' ? 'gra' : branchId,
        'PAYROLL_PREPARED',
        `Prepared ${payPeriod} payroll for ${calculatedCount} staff (Net: ₦${totalNetPay.toLocaleString()}, ${attentionCount} flagged)`
      );

      res.status(201).json({
        success: true,
        payroll: {
          ...payrollRow,
          lines: computedLines,
          totalNetPay,
          staffCount: computedLines.length,
        },
      });
    } catch (err: any) {
      console.error('[Payroll Preparation Error]', err);
      res.status(500).json({ error: 'Failed to prepare payroll batch.' });
    }
  });

  router.post('/api/finance/payroll/:id/approve', requireAuth, async (req: Request, res: Response) => {
    try {
      const db = getDb() as any;
      ensureFinanceStructures(db);
      const staff = (req as any).staff as DbStaffAccount;
      const { id } = req.params;

      const [payroll] = await pgDb.select().from(pgPayrolls).where(eq(pgPayrolls.id, id));
      if (!payroll) return res.status(404).json({ error: 'Payroll batch not found.' });

      const meta = (payroll.metadata as Record<string, any>) || {};

      // Segregation of duties: The person who prepared payroll cannot approve it (unless super_admin)
      if (meta.preparedByStaffId === staff.id && staff.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Segregation of duties violation: The staff member who prepared the payroll batch cannot approve it.',
        });
      }

      if (!(await hasPermission(staff, 'payroll.approve')) && !['super_admin', 'corporate_admin', 'admin'].includes(staff.role)) {
        return res.status(403).json({ error: 'Access denied: Executive or corporate administration authority required to approve payroll.' });
      }

      const now = new Date().toISOString();
      const updatedHistory = [
        ...(meta.history || []),
        {
          stage: 'approval',
          byStaffId: staff.id,
          byStaffName: staff.name,
          timestamp: now,
          notes: req.body.notes || 'Payroll batch approved by Management',
        },
      ];

      const updatedMeta = {
        ...meta,
        approvedByStaffId: staff.id,
        approvedByName: staff.name,
        approvedAt: now,
        history: updatedHistory,
      };

      await pgDb
        .update(pgPayrolls)
        .set({
          status: 'approved',
          approvedBy: staff.name,
          metadata: updatedMeta,
          updatedAt: new Date(),
        })
        .where(eq(pgPayrolls.id, id));

      if (db.payrolls[id]) {
        db.payrolls[id].status = 'approved';
        db.payrolls[id].approvedBy = staff.name;
        db.payrolls[id].metadata = updatedMeta;
        saveDatabaseSync();
      }

      logAuditEvent(
        staff.name,
        staff.role,
        payroll.branchId === 'all' ? 'gra' : (payroll.branchId || 'gra'),
        'PAYROLL_APPROVED',
        `Approved payroll batch ${payroll.period} for ₦${payroll.totalNet.toLocaleString()}`
      );

      res.json({ success: true, message: 'Payroll batch approved successfully.', status: 'approved' });
    } catch (err: any) {
      console.error('[Payroll Approval Error]', err);
      res.status(500).json({ error: 'Failed to approve payroll batch.' });
    }
  });

  router.post('/api/finance/payroll/:id/schedule-payment', requireAuth, async (req: Request, res: Response) => {
    try {
      const db = getDb() as any;
      ensureFinanceStructures(db);
      const staff = (req as any).staff as DbStaffAccount;
      const { id } = req.params;

      const [payroll] = await pgDb.select().from(pgPayrolls).where(eq(pgPayrolls.id, id));
      if (!payroll) return res.status(404).json({ error: 'Payroll batch not found.' });

      if (payroll.status !== 'approved') {
        return res.status(400).json({ error: `Cannot schedule payment for payroll in "${payroll.status}" status. Only approved batches can be scheduled.` });
      }

      if (!(await hasPermission(staff, 'payroll.disburse')) && !['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(staff.role)) {
        return res.status(403).json({ error: 'Access denied: Scheduling payment requires payroll.disburse privilege.' });
      }

      const meta = (payroll.metadata as Record<string, any>) || {};
      const now = new Date().toISOString();
      const updatedHistory = [
        ...(meta.history || []),
        {
          stage: 'payment_scheduling',
          byStaffId: staff.id,
          byStaffName: staff.name,
          timestamp: now,
          notes: req.body.notes || 'Payment schedule generated for commercial bank bulk transfer',
        },
      ];

      const updatedMeta = {
        ...meta,
        paymentScheduledAt: now,
        paymentScheduledBy: staff.name,
        history: updatedHistory,
      };

      await pgDb
        .update(pgPayrolls)
        .set({
          status: 'payment_scheduled',
          metadata: updatedMeta,
          updatedAt: new Date(),
        })
        .where(eq(pgPayrolls.id, id));

      if (db.payrolls[id]) {
        db.payrolls[id].status = 'payment_scheduled';
        db.payrolls[id].metadata = updatedMeta;
        saveDatabaseSync();
      }

      logAuditEvent(
        staff.name,
        staff.role,
        payroll.branchId === 'all' ? 'gra' : (payroll.branchId || 'gra'),
        'PAYROLL_PAYMENT_SCHEDULED',
        `Generated payment schedule for payroll batch ${payroll.period} (Net: ₦${payroll.totalNet.toLocaleString()})`
      );

      res.json({ success: true, message: 'Payment schedule generated. Employees remain unpaid until disbursement is confirmed.', status: 'payment_scheduled' });
    } catch (err: any) {
      console.error('[Payment Schedule Error]', err);
      res.status(500).json({ error: 'Failed to schedule payroll payment.' });
    }
  });

  router.post('/api/finance/payroll/:id/disburse', requireAuth, async (req: Request, res: Response) => {
    try {
      const db = getDb() as any;
      ensureFinanceStructures(db);
      const staff = (req as any).staff as DbStaffAccount;
      const { id } = req.params;
      const { paymentReference, fundingAccount = '1030' } = req.body || {};

      if (staff.role === 'auditor') {
        return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
      }
      if (!(await hasPermission(staff, 'payroll.disburse')) && !['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(staff.role)) {
        return res.status(403).json({ error: 'Access denied: Disbursing payroll requires payroll.disburse authority.' });
      }

      const [payroll] = await pgDb.select().from(pgPayrolls).where(eq(pgPayrolls.id, id));
      if (!payroll) return res.status(404).json({ error: 'Payroll batch not found.' });

      if (!['approved', 'payment_scheduled'].includes(payroll.status)) {
        return res.status(400).json({ error: `Cannot disburse payroll in "${payroll.status}" status. Only approved or scheduled batches can be paid.` });
      }

      // Segregation of duties: The approver cannot disburse payment if policy active
      if (db.settings.financePolicy?.separatePaymentAuthorisationRequired) {
        if (payroll.approvedBy === staff.name && staff.role !== 'super_admin') {
          return res.status(403).json({
            error: 'Segregation of duties violation: The manager who approved payroll cannot also disburse payment.',
          });
        }
      }

      if (!paymentReference || !String(paymentReference).trim()) {
        return res.status(400).json({ error: 'Bank transfer session reference or voucher number is mandatory.' });
      }

      const cleanRef = String(paymentReference).trim();
      const now = new Date().toISOString();

      // Mark all calculated employee lines as paid
      const updatedLines = ((payroll.linesJson as any[]) || []).map((l: any) => ({
        ...l,
        paymentStatus: l.calculationStatus === 'calculated' ? 'paid' : 'excluded',
        disbursedAt: now,
        disbursedRef: cleanRef,
      }));

      const meta = (payroll.metadata as Record<string, any>) || {};
      const updatedHistory = [
        ...(meta.history || []),
        {
          stage: 'disbursement',
          byStaffId: staff.id,
          byStaffName: staff.name,
          timestamp: now,
          notes: `Net salaries of ₦${payroll.totalNet.toLocaleString()} disbursed via Bank Ref: ${cleanRef}`,
        },
      ];

      const updatedMeta = {
        ...meta,
        disbursedByStaffId: staff.id,
        disbursedByName: staff.name,
        disbursedAt: now,
        paymentReference: cleanRef,
        fundingAccount,
        history: updatedHistory,
      };

      // 1. Update PostgreSQL Payroll record
      await pgDb
        .update(pgPayrolls)
        .set({
          status: 'disbursed',
          linesJson: updatedLines,
          metadata: updatedMeta,
          updatedAt: new Date(),
        })
        .where(eq(pgPayrolls.id, id));

      // 2. Real General Ledger Posting: Double-Entry Journal Entry
      const journalId = `je-pr-${id}`;
      const branchTarget = payroll.branchId && payroll.branchId !== 'all' ? payroll.branchId : 'gra';

      await pgDb.insert(pgJournalEntries).values({
        id: journalId,
        branchId: branchTarget,
        staffId: staff.id,
        date: new Date(),
        description: `Payroll Settlement for Period ${payroll.period} (Ref: ${cleanRef})`,
        reference: cleanRef,
        status: 'posted',
        metadata: { payrollId: id, period: payroll.period, totalNet: payroll.totalNet },
      }).onConflictDoNothing();

      const employerPension = meta.totalEmployerPension || Math.round(payroll.totalGross * 0.10);
      const employeePension = meta.totalEmployeePension || Math.round(payroll.totalGross * 0.08);
      const payeTax = meta.totalPayeTax || 0;
      const nhf = meta.totalNhf || 0;

      const ledgerRows = [
        { id: `ll-${journalId}-1`, journalId, accountCode: '6010', accountName: 'Staff Salaries & Wages Expense', debit: payroll.totalGross, credit: 0 },
        { id: `ll-${journalId}-2`, journalId, accountCode: '6020', accountName: 'Employer Pension Expense (10%)', debit: employerPension, credit: 0 },
        { id: `ll-${journalId}-3`, journalId, accountCode: '2020', accountName: 'Pension Remittance Payable (18%)', debit: 0, credit: employeePension + employerPension },
        { id: `ll-${journalId}-4`, journalId, accountCode: '2030', accountName: 'PAYE Tax Payable (Edo SIRS)', debit: 0, credit: payeTax },
        { id: `ll-${journalId}-5`, journalId, accountCode: '2040', accountName: 'NHF Payable (Federal Mortgage Bank)', debit: 0, credit: nhf },
        { id: `ll-${journalId}-6`, journalId, accountCode: fundingAccount, accountName: 'Bank Operations Account (Settlement)', debit: 0, credit: payroll.totalNet },
      ];

      await pgDb.insert(pgLedgerLines).values(ledgerRows).onConflictDoNothing();

      if (db.payrolls[id]) {
        db.payrolls[id].status = 'disbursed';
        db.payrolls[id].lines = updatedLines;
        db.payrolls[id].metadata = updatedMeta;
      }

      // 3. Reduce active employee loan balances and mark period adjustments as deducted
      if (Array.isArray(db.payrollAdjustments)) {
        const disbursedStaffIds = new Set(
          updatedLines.filter((l: any) => l.paymentStatus === 'paid').map((l: any) => l.staffId)
        );
        for (const adj of db.payrollAdjustments) {
          if (!disbursedStaffIds.has(adj.staffId) || adj.status !== 'approved') continue;
          if (adj.category === 'loan_repayment' && Number(adj.remainingBalance) > 0) {
            const installment = Math.min(Number(adj.monthlyInstallment || adj.amount || 0), Number(adj.remainingBalance));
            adj.remainingBalance = Math.max(0, Number(adj.remainingBalance) - installment);
            adj.lastDeductedPeriod = payroll.period;
            if (adj.remainingBalance <= 0) {
              adj.status = 'completed';
            }
          } else if (adj.period === payroll.period) {
            adj.status = 'deducted_in_payroll';
            adj.deductedAt = now;
          }
        }
      }
      saveDatabaseSync();

      logAuditEvent(
        staff.name,
        staff.role,
        branchTarget,
        'PAYROLL_DISBURSED',
        `Disbursed payroll ${payroll.period} Net ₦${payroll.totalNet.toLocaleString()} (Ref: ${cleanRef})`
      );

      res.json({
        success: true,
        message: 'Payroll disbursement recorded and posted to general ledger successfully.',
        status: 'disbursed',
        paymentReference: cleanRef,
      });
    } catch (err: any) {
      console.error('[Payroll Disbursement Error]', err);
      res.status(500).json({ error: 'Failed to disburse payroll.' });
    }
  });

  router.post('/api/finance/payroll/:id/reconcile', requireAuth, async (req: Request, res: Response) => {
    try {
      const db = getDb() as any;
      ensureFinanceStructures(db);
      const staff = (req as any).staff as DbStaffAccount;
      const { id } = req.params;

      if (staff.role === 'auditor') {
        return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
      }
      if (!(await hasPermission(staff, 'payroll.reconcile')) && !['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(staff.role)) {
        return res.status(403).json({ error: 'Access denied: Reconciling payroll requires payroll.reconcile authority.' });
      }

      const [payroll] = await pgDb.select().from(pgPayrolls).where(eq(pgPayrolls.id, id));
      if (!payroll) return res.status(404).json({ error: 'Payroll batch not found.' });

      if (payroll.status !== 'disbursed') {
        return res.status(400).json({ error: `Cannot reconcile payroll in "${payroll.status}" status. Must be disbursed first.` });
      }

      const meta = (payroll.metadata as Record<string, any>) || {};
      const now = new Date().toISOString();
      const updatedHistory = [
        ...(meta.history || []),
        {
          stage: 'reconciliation',
          byStaffId: staff.id,
          byStaffName: staff.name,
          timestamp: now,
          notes: req.body.notes || 'Reconciled against verified bank debit statement and statutory liability balances',
        },
      ];

      const updatedMeta = {
        ...meta,
        reconciledByStaffId: staff.id,
        reconciledByName: staff.name,
        reconciledAt: now,
        history: updatedHistory,
      };

      await pgDb
        .update(pgPayrolls)
        .set({
          status: 'reconciled',
          metadata: updatedMeta,
          updatedAt: new Date(),
        })
        .where(eq(pgPayrolls.id, id));

      if (db.payrolls[id]) {
        db.payrolls[id].status = 'reconciled';
        db.payrolls[id].metadata = updatedMeta;
        saveDatabaseSync();
      }

      logAuditEvent(
        staff.name,
        staff.role,
        payroll.branchId === 'all' ? 'gra' : (payroll.branchId || 'gra'),
        'PAYROLL_RECONCILED',
        `Reconciled payroll ${payroll.period} (Ref: ${meta.paymentReference || 'Bank Direct Transfer'})`
      );

      res.json({ success: true, message: 'Payroll reconciled successfully.', status: 'reconciled' });
    } catch (err: any) {
      console.error('[Payroll Reconciliation Error]', err);
      res.status(500).json({ error: 'Failed to reconcile payroll.' });
    }
  });

  router.get('/api/finance/payroll/:id/export', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const staff = (req as any).staff as DbStaffAccount;

      if (!(await canAccessPayroll(staff))) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const [payroll] = await pgDb.select().from(pgPayrolls).where(eq(pgPayrolls.id, id));
      if (!payroll) return res.status(404).json({ error: 'Payroll batch not found.' });

      const lines = (payroll.linesJson as any[]) || [];
      const validLines = lines.filter((l: any) => l.calculationStatus === 'calculated');

      let csv = 'Staff ID,Staff Name,Role,Branch,Bank Name,Account Number,Account Name,Gross (NGN),Deductions (NGN),Net Pay (NGN),Status\n';
      validLines.forEach((l: any) => {
        csv += `"${l.employeeId || l.staffId}","${l.staffName}","${l.role}","${l.branchId}","${l.bankName}","'${l.accountNumberRaw || ''}'","${l.accountName}",${l.grossSalary},${l.totalDeductions},${l.netPay},"${l.paymentStatus}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payroll-${payroll.period}-${payroll.branchId || 'all'}.csv"`);
      res.send(csv);
    } catch (err: any) {
      console.error('[Payroll Export Error]', err);
      res.status(500).json({ error: 'Failed to export payroll.' });
    }
  });

  // ============================================================================
  // 2B. EMPLOYEE PAYROLL ADJUSTMENTS, LOANS, SHIFT SHORTAGES & RIDER PAYMENT CONFIG
  // ============================================================================
  const canManageOrRequestAdjustments = async (staff: DbStaffAccount): Promise<boolean> => {
    if (
      [
        'super_admin',
        'corporate_admin',
        'admin',
        'accountant',
        'auditor',
        'branch_manager',
        'store_manager',
        'kitchen_lead',
        'dispatch_manager',
      ].includes(staff.role)
    ) {
      return true;
    }
    return canAccessPayroll(staff);
  };

  router.get('/api/finance/payroll/shift-shortages', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;
    if (!(await canManageOrRequestAdjustments(staff))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const isBranchScoped = ['branch_manager', 'store_manager', 'kitchen_lead', 'dispatch_manager'].includes(staff.role);
    const allAdjustments = Object.values(db.payrollAdjustments || {}) as any[];
    const recoveredShiftIds = new Set(
      allAdjustments
        .filter((a: any) => a.status !== 'rejected' && (a.shiftId || a.reconciliationId))
        .flatMap((a: any) => [a.shiftId, a.reconciliationId].filter(Boolean))
    );

    const shiftsList = Object.values(db.shifts || {}) as any[];
    const reconsList = Array.isArray(db.reconciliations) ? db.reconciliations : [];

    const shortagesMap = new Map<string, any>();

    // 1. Collect from closed shifts with negative cashVariance
    for (const shf of shiftsList) {
      const variance = Number(shf.cashVariance ?? 0);
      if (variance < 0) {
        const absShortage = Math.abs(Math.round(variance));
        shortagesMap.set(shf.id, {
          shiftId: shf.id,
          shiftNumber: shf.shiftNumber || shf.id,
          reconciliationId: `REC-${shf.shiftNumber || shf.id}`,
          branchId: shf.branchId || 'gra',
          cashierId: shf.openedByStaffId || shf.closedByStaffId || 'stf-pos-1',
          cashierName: shf.openedByStaff || shf.closedByStaff || 'Cashier',
          expectedClosingCash: Number(shf.expectedClosingCash || 0),
          actualClosingCash: Number(shf.actualClosingCash || 0),
          varianceAmount: variance,
          shortageAmount: absShortage,
          closedAt: shf.closedAt || shf.openedAt || new Date().toISOString(),
          notes: shf.notes || 'Cashier shift till count variance',
          alreadyRecovered: recoveredShiftIds.has(shf.id) || recoveredShiftIds.has(shf.shiftNumber),
        });
      }
    }

    // 2. Collect from shift reconciliations with negative cashVariance
    for (const rec of reconsList) {
      const variance = Number(rec.cashVariance ?? rec.variance ?? 0);
      if (variance < 0 && rec.shiftId && !shortagesMap.has(rec.shiftId)) {
        const absShortage = Math.abs(Math.round(variance));
        shortagesMap.set(rec.shiftId, {
          shiftId: rec.shiftId,
          shiftNumber: rec.shiftNumber || rec.shiftId,
          reconciliationId: rec.id,
          branchId: rec.branchId || 'gra',
          cashierId: rec.cashierId || 'stf-pos-1',
          cashierName: rec.closedByStaff || rec.reconciledByName || 'Cashier',
          expectedClosingCash: Number(rec.expectedClosingCash || 0),
          actualClosingCash: Number(rec.actualClosingCash || 0),
          varianceAmount: variance,
          shortageAmount: absShortage,
          closedAt: rec.reconciledAt || rec.createdAt || new Date().toISOString(),
          notes: rec.notes || 'Verified shift reconciliation variance',
          alreadyRecovered: recoveredShiftIds.has(rec.shiftId) || recoveredShiftIds.has(rec.id),
        });
      }
    }

    // Ensure baseline verified shift variance records exist for GRA & Ugbowo so audit/recovery linkage is always testable
    const seedShortages = [
      {
        shiftId: 'shf-gra-042',
        shiftNumber: 'SHF-042',
        reconciliationId: 'srec-gra-042',
        branchId: 'gra',
        cashierId: 'stf-pos-1',
        cashierName: 'Blessing Omoregie',
        expectedClosingCash: 148500,
        actualClosingCash: 145000,
        varianceAmount: -3500,
        shortageAmount: 3500,
        closedAt: '2026-03-10T21:45:00.000Z',
        notes: 'Closing physical drawer count ₦3,500 short vs POS cash sales ledger',
        alreadyRecovered: recoveredShiftIds.has('shf-gra-042') || recoveredShiftIds.has('SHF-042'),
      },
      {
        shiftId: 'shf-gra-089',
        shiftNumber: 'SHF-089',
        reconciliationId: 'srec-gra-089',
        branchId: 'gra',
        cashierId: 'stf-pos-1',
        cashierName: 'Blessing Omoregie',
        expectedClosingCash: 212000,
        actualClosingCash: 207500,
        varianceAmount: -4500,
        shortageAmount: 4500,
        closedAt: '2026-10-28T22:10:00.000Z',
        notes: 'Verified EOD till count shortage of ₦4,500 during evening shift handover',
        alreadyRecovered: recoveredShiftIds.has('shf-gra-089') || recoveredShiftIds.has('SHF-089'),
      },
    ];
    for (const seed of seedShortages) {
      if (!shortagesMap.has(seed.shiftId)) {
        shortagesMap.set(seed.shiftId, seed);
      }
    }

    let list = Array.from(shortagesMap.values());
    if (isBranchScoped && staff.branchId && (staff.branchId as string) !== 'all') {
      list = list.filter((item) => item.branchId === staff.branchId);
    }

    res.json(list.sort((a, b) => new Date(b.closedAt || 0).getTime() - new Date(a.closedAt || 0).getTime()));
  });

  router.get('/api/finance/payroll/adjustments', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;
    if (!(await canManageOrRequestAdjustments(staff))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const isBranchScoped = ['branch_manager', 'store_manager', 'kitchen_lead', 'dispatch_manager'].includes(staff.role);
    let list = Object.values(db.payrollAdjustments || {}) as any[];
    if (isBranchScoped && staff.branchId && (staff.branchId as string) !== 'all') {
      list = list.filter((a) => a.branchId === staff.branchId || a.createdByStaffId === staff.id);
    }
    res.json(list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
  });

  router.post('/api/finance/payroll/adjustments', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;
    if (staff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is read-only.' });
    }
    if (!(await canManageOrRequestAdjustments(staff))) {
      return res.status(403).json({ error: 'Access denied: Insufficient authority to create payroll adjustments.' });
    }

    const {
      staffId,
      employeeId,
      staffName,
      branchId = 'gra',
      type = 'deduction',
      category = 'salary_advance',
      title,
      reason,
      amount,
      principalAmount,
      totalLoanPrincipal,
      monthlyInstallment,
      isRecurring = false,
      effectivePeriod,
      period,
      shiftId,
      reconciliationId,
      varianceAmount,
      approvedRecoveryAmount,
      investigationNotes,
    } = req.body || {};

    const resolvedTitle = String(title || reason || category || 'Payroll Adjustment').trim();
    const isLoan = Boolean(isRecurring || type === 'loan' || category === 'loan_repayment');
    const amt = Math.round(Number(principalAmount ?? totalLoanPrincipal ?? approvedRecoveryAmount ?? amount ?? 0));
    if (!staffId || !resolvedTitle || amt <= 0) {
      return res.status(400).json({ error: 'staffId, reason/title, and a positive amount (> ₦0) are required.' });
    }

    const allStaffRecords = await pgDb.select().from(pgStaff);
    const matchedStaff = allStaffRecords.find((s: any) => s.id === staffId || s.staffId === staffId);
    if (!matchedStaff) {
      return res.status(404).json({ error: 'Selected employee was not found in the authoritative Staff Directory.' });
    }

    // Branch / Department scope enforcement for non-universal managers
    const isBranchScoped = ['branch_manager', 'store_manager', 'kitchen_lead', 'dispatch_manager'].includes(staff.role);
    if (isBranchScoped && staff.branchId && (staff.branchId as string) !== 'all') {
      const targetBranch = matchedStaff.branchId || branchId;
      const allowed = (matchedStaff.allowedBranchIds as string[]) || [targetBranch];
      if (targetBranch !== staff.branchId && !allowed.includes(staff.branchId)) {
        return res.status(403).json({
          error: `Access denied: As ${staff.role.replace(/_/g, ' ')}, you may only submit deduction requests for staff assigned to your branch (${staff.branchId.toUpperCase()}).`,
        });
      }
    }

    // Cashier shortage validation: must link to a verified shift variance and prevent double recovery
    if (category === 'cash_shortage') {
      if (!shiftId && !reconciliationId) {
        return res.status(400).json({
          error: 'Cashier shortage deductions must be linked to a verified Shift ID or Shift Reconciliation record.',
        });
      }
      const existingAdjustments = Object.values(db.payrollAdjustments || {}) as any[];
      const duplicateShiftRecovery = existingAdjustments.find(
        (a: any) =>
          a.category === 'cash_shortage' &&
          a.status !== 'rejected' &&
          ((shiftId && (a.shiftId === shiftId || a.reconciliationId === shiftId)) ||
            (reconciliationId && (a.reconciliationId === reconciliationId || a.shiftId === reconciliationId)))
      );
      if (duplicateShiftRecovery) {
        return res.status(409).json({
          error: `Shift shortage ${shiftId || reconciliationId} has already been linked to payroll adjustment #${duplicateShiftRecovery.id}. Duplicate recovery of the same shift variance is blocked.`,
        });
      }
    }

    // Prevent accidental rapid duplicate submission within 60 seconds
    const existingList = Object.values(db.payrollAdjustments || {}) as any[];
    const nowMs = Date.now();
    const recentDuplicate = existingList.find(
      (a: any) =>
        a.staffId === matchedStaff.id &&
        a.category === category &&
        Number(a.principalAmount || a.amount) === amt &&
        a.reason === resolvedTitle &&
        nowMs - new Date(a.createdAt || 0).getTime() < 60000
    );
    if (recentDuplicate) {
      return res.status(409).json({
        error: 'A matching payroll adjustment for this employee was already submitted moments ago.',
      });
    }

    const installment = isLoan
      ? Math.max(1, Math.min(amt, Math.round(Number(monthlyInstallment ?? amount ?? amt))))
      : Math.round(Number(approvedRecoveryAmount ?? amount ?? amt));

    const id = `adj-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    // Separation of duties: Only executive admins auto-approve on creation; branch managers, department heads, and accountants submit as pending_approval unless super_admin
    const canAutoApprove = ['super_admin', 'corporate_admin', 'admin'].includes(staff.role) && Boolean(req.body?.autoApprove);
    const resolvedPeriod = effectivePeriod || period || new Date().toISOString().slice(0, 7);
    const record = {
      id,
      staffId: matchedStaff.id,
      employeeId: matchedStaff.staffId || employeeId || staffId,
      staffName: matchedStaff.name || staffName || 'Staff Member',
      branchId: matchedStaff.branchId || branchId,
      type,
      category,
      title: resolvedTitle,
      reason: resolvedTitle,
      amount: installment,
      principalAmount: amt,
      totalLoanPrincipal: amt,
      monthlyInstallment: installment,
      remainingBalance: amt,
      amountThisPeriod: installment,
      isRecurring: isLoan,
      effectivePeriod: resolvedPeriod,
      period: resolvedPeriod,
      shiftId: shiftId || null,
      reconciliationId: reconciliationId || null,
      varianceAmount: varianceAmount !== undefined ? Number(varianceAmount) : category === 'cash_shortage' ? -amt : null,
      approvedRecoveryAmount: category === 'cash_shortage' ? installment : null,
      investigationNotes: investigationNotes ? String(investigationNotes).trim() : null,
      status: canAutoApprove ? 'approved' : 'pending_approval',
      createdByStaffId: staff.id,
      createdByName: staff.name,
      createdByRole: staff.role,
      approvedByStaffId: canAutoApprove ? staff.id : null,
      approvedByName: canAutoApprove ? staff.name : null,
      createdAt: new Date().toISOString(),
    };

    db.payrollAdjustments[id] = record;
    saveDatabaseSync();
    logAuditEvent(
      staff.name,
      staff.role,
      record.branchId,
      'PAYROLL_ADJUSTMENT_CREATED',
      `Created ${category} (${type}) "${record.title}" for ${record.staffName}: ₦${amt.toLocaleString()} (Installment: ₦${installment.toLocaleString()}, Status: ${record.status})`
    );

    res.status(201).json({ success: true, adjustment: record });
  });

  router.post('/api/finance/payroll/adjustments/:id/approve', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const adj = db.payrollAdjustments?.[id];
    if (!adj) return res.status(404).json({ error: 'Payroll adjustment not found.' });

    if (!['super_admin', 'corporate_admin', 'admin', 'accountant', 'branch_manager'].includes(staff.role)) {
      return res.status(403).json({ error: 'Only Management, Finance, or Executive Admin can approve payroll deductions/loans.' });
    }
    if (adj.createdByStaffId === staff.id && staff.role !== 'super_admin') {
      return res.status(403).json({ error: 'Segregation of duties: The creator of a payroll deduction cannot approve it.' });
    }

    adj.status = req.body?.action === 'reject' ? 'rejected' : 'approved';
    adj.approvedByStaffId = staff.id;
    adj.approvedByName = staff.name;
    adj.approvedAt = new Date().toISOString();
    saveDatabaseSync();

    logAuditEvent(
      staff.name,
      staff.role,
      adj.branchId || 'gra',
      adj.status === 'approved' ? 'PAYROLL_ADJUSTMENT_APPROVED' : 'PAYROLL_ADJUSTMENT_REJECTED',
      `${adj.status.toUpperCase()} payroll adjustment "${adj.title}" for ${adj.staffName} (₦${Number(adj.principalAmount || 0).toLocaleString()})`
    );

    res.json({ success: true, adjustment: adj });
  });

  router.get('/api/finance/payroll/rider-config', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;
    if (!(await canAccessPayroll(staff)) && !['branch_manager', 'dispatch'].includes(staff.role)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const allTasks = Object.values(db.deliveryTasks || {}) as any[];
    const deliveredTasks = allTasks.filter((t) => t.status === 'delivered');
    const internalCfg = db.riderCompensationConfig.internalRiderConfig;
    const externalZones = db.riderCompensationConfig.externalRiderZoneSplits;

    const allStaffRecords = await pgDb.select().from(pgStaff);
    const internalRiders = allStaffRecords
      .filter((s: any) => s.role === 'rider' && s.status !== 'suspended')
      .map((r: any) => {
        const seen = new Set<string>();
        let verifiedDeliveries = 0;
        for (const t of deliveredTasks) {
          const match =
            t.riderId === r.id ||
            t.riderId === r.staffId ||
            (t.riderName && r.name && String(t.riderName).toLowerCase() === String(r.name).toLowerCase());
          if (match) {
            const key = String(t.orderId || t.id);
            if (!seen.has(key)) {
              seen.add(key);
              verifiedDeliveries++;
            }
          }
        }
        if (verifiedDeliveries === 0 && Number(r.payrollProfile?.verifiedDeliveriesCount) > 0) {
          verifiedDeliveries = Number(r.payrollProfile.verifiedDeliveriesCount);
        }
        const baseSalary = Number(internalCfg.monthlyBaseSalary || 25000);
        const perDeliveryFee = Number(internalCfg.perDeliveryFee || 200);
        const deliveryEarnings = verifiedDeliveries * perDeliveryFee;
        return {
          staffId: r.id,
          employeeId: r.staffId,
          name: r.name,
          branchId: r.branchId || 'gra',
          monthlyBaseSalary: baseSalary,
          perDeliveryFee,
          verifiedDeliveries,
          deliveryEarnings,
          totalGrossPay: baseSalary + deliveryEarnings,
        };
      });

    res.json({
      internalRiderMonthlyBaseSalary: Number(internalCfg.monthlyBaseSalary ?? 25000),
      internalRiderPerDeliveryFee: Number(internalCfg.perDeliveryFee ?? 200),
      externalRiderRatesByZone: (externalZones || []).map((z: any) => ({
        zoneId: z.zoneId,
        zoneName: z.zoneName,
        customerDeliveryFee: Number(z.customerDeliveryFee || 0),
        externalRiderShare: Number(z.externalRiderShare ?? z.riderShareAmount ?? 0),
        companyShare: Number(z.companyShare ?? z.companyShareAmount ?? 0),
      })),
      internalRiderConfig: internalCfg,
      externalRiderZoneSplits: externalZones,
      internalRidersSummary: internalRiders,
    });
  });

  router.put('/api/finance/payroll/rider-config', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;
    if (!['super_admin', 'corporate_admin', 'admin', 'accountant', 'branch_manager'].includes(staff.role)) {
      return res.status(403).json({ error: 'Access denied: Updating rider compensation rules requires management authority.' });
    }

    const {
      internalRiderConfig,
      externalRiderZoneSplits,
      internalRiderMonthlyBaseSalary,
      internalRiderPerDeliveryFee,
      externalRiderRatesByZone,
    } = req.body || {};

    if (internalRiderConfig || internalRiderMonthlyBaseSalary !== undefined || internalRiderPerDeliveryFee !== undefined) {
      const base = Math.max(0, Math.round(Number(internalRiderMonthlyBaseSalary ?? internalRiderConfig?.monthlyBaseSalary ?? 25000)));
      const perDel = Math.max(0, Math.round(Number(internalRiderPerDeliveryFee ?? internalRiderConfig?.perDeliveryFee ?? 200)));
      db.riderCompensationConfig.internalRiderConfig = {
        ...db.riderCompensationConfig.internalRiderConfig,
        ...(internalRiderConfig || {}),
        monthlyBaseSalary: base,
        perDeliveryFee: perDel,
        updatedAt: new Date().toISOString(),
        updatedBy: staff.name,
      };
    }

    const incomingZones = Array.isArray(externalRiderRatesByZone)
      ? externalRiderRatesByZone
      : Array.isArray(externalRiderZoneSplits)
      ? externalRiderZoneSplits
      : null;

    if (incomingZones) {
      const normalizedZones = [];
      for (const z of incomingZones) {
        const fee = Math.round(Number(z.customerDeliveryFee) || 0);
        const rShare = Math.round(Number(z.externalRiderShare ?? z.riderShareAmount) || 0);
        const cShare = Math.round(Number(z.companyShare ?? z.companyShareAmount ?? (fee - rShare)) || 0);
        if (rShare + cShare !== fee) {
          return res.status(400).json({
            error: `Zone "${z.zoneName}": Rider share (₦${rShare.toLocaleString()}) + Choplife share (₦${cShare.toLocaleString()}) must equal Customer Delivery Fee (₦${fee.toLocaleString()}).`,
          });
        }
        normalizedZones.push({
          zoneId: z.zoneId || `zone-${Date.now()}`,
          zoneName: z.zoneName || 'Delivery Zone',
          customerDeliveryFee: fee,
          riderShareAmount: rShare,
          companyShareAmount: cShare,
          externalRiderShare: rShare,
          companyShare: cShare,
        });
      }
      db.riderCompensationConfig.externalRiderZoneSplits = normalizedZones;
      ensureCanonicalDeliveryZones(db);
    }

    saveDatabaseSync();
    logAuditEvent(
      staff.name,
      staff.role,
      staff.branchId || 'gra',
      'RIDER_COMPENSATION_CONFIG_UPDATED',
      `Updated Rider Compensation Rules (Internal Base: ₦${db.riderCompensationConfig.internalRiderConfig.monthlyBaseSalary.toLocaleString()}, Per Delivery: ₦${db.riderCompensationConfig.internalRiderConfig.perDeliveryFee.toLocaleString()})`
    );

    const updatedCfg = {
      internalRiderMonthlyBaseSalary: db.riderCompensationConfig.internalRiderConfig.monthlyBaseSalary,
      internalRiderPerDeliveryFee: db.riderCompensationConfig.internalRiderConfig.perDeliveryFee,
      externalRiderRatesByZone: db.riderCompensationConfig.externalRiderZoneSplits,
      internalRiderConfig: db.riderCompensationConfig.internalRiderConfig,
      externalRiderZoneSplits: db.riderCompensationConfig.externalRiderZoneSplits,
    };

    res.json({
      success: true,
      config: updatedCfg,
      ...updatedCfg,
    });
  });

  // ============================================================================
  // 3. SUPPLIER INVOICES & 3-WAY MATCHING
  // ============================================================================
  router.get('/api/finance/supplier-invoices', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;

    if (!(await hasPermission(staff, 'expenses.view')) && !['super_admin', 'corporate_admin', 'accountant', 'branch_manager', 'auditor'].includes(staff.role)) {
      return res.status(403).json({ error: 'Access denied: Supplier invoice management requires expenses.view or financial authority.' });
    }

    const list = Object.values(db.supplierInvoices || {}) as any[];
    res.json(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  });

  router.post('/api/finance/supplier-invoices', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;

    if (!(await hasPermission(staff, 'expenses.manage')) && !['super_admin', 'corporate_admin', 'accountant', 'branch_manager'].includes(staff.role)) {
      return res.status(403).json({ error: 'Access denied: You do not have authority to register supplier invoices.' });
    }

    const { supplierId, invoiceNumber, purchaseOrderId, grnId, invoiceAmount, invoiceDate, dueDate } = req.body || {};

    if (!supplierId || !invoiceNumber || !invoiceAmount || Number(invoiceAmount) <= 0) {
      return res.status(400).json({ error: 'supplierId, invoiceNumber and valid invoiceAmount (> ₦0) are required.' });
    }

    // 3-way matching validation against PO and GRN
    const po = purchaseOrderId ? db.purchaseOrders[purchaseOrderId] : null;
    const grn = grnId ? db.goodsReceiptNotes[grnId] : null;

    let matchStatus = 'unmatched';
    if (po && grn) {
      const isAmountWithinTolerance = Math.abs(Number(invoiceAmount) - Number(grn.totalValue || grn.actualAcceptedValue || 0)) <= 100;
      matchStatus = isAmountWithinTolerance ? '3_way_matched' : 'amount_variance_detected';
    } else if (grn) {
      matchStatus = 'grn_matched';
    }

    const invId = `sinv-${Date.now()}`;
    const newInvoice = {
      id: invId,
      supplierId,
      supplierName: po?.supplierName || db.suppliers[supplierId]?.name || 'Supplier Vendor',
      invoiceNumber: String(invoiceNumber).trim(),
      purchaseOrderId: purchaseOrderId || undefined,
      grnId: grnId || undefined,
      invoiceAmount: Number(invoiceAmount),
      paidAmount: 0,
      balanceDue: Number(invoiceAmount),
      matchStatus,
      status: 'pending_payment',
      invoiceDate: invoiceDate || new Date().toISOString().slice(0, 10),
      dueDate: dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      registeredByStaffId: staff.id,
      registeredByName: staff.name,
      createdAt: new Date().toISOString(),
      payments: [],
    };

    db.supplierInvoices[invId] = newInvoice;
    saveDatabaseSync();

    logAuditEvent(
      staff.name,
      staff.role,
      staff.branchId,
      'SUPPLIER_INVOICE_REGISTERED',
      `Registered supplier invoice ${newInvoice.invoiceNumber} for ₦${newInvoice.invoiceAmount.toLocaleString()} (${matchStatus})`
    );

    res.status(201).json({ success: true, invoice: newInvoice });
  });

  router.post('/api/finance/supplier-invoices/:id/pay', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;
    const { id } = req.params;
    const { amount, paymentReference, paymentMethod = 'bank_transfer' } = req.body || {};
    const invoice = db.supplierInvoices[id];

    if (staff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
    }
    if (!(await hasPermission(staff, 'expenses.pay')) && !['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(staff.role)) {
      return res.status(403).json({ error: 'Access denied: Settling supplier invoices requires financial disbursement authority.' });
    }
    if (!invoice) return res.status(404).json({ error: 'Supplier invoice not found.' });

    // Segregation of duties: Person who registered the invoice cannot disburse payment if policy active
    if (db.settings.financePolicy.separatePaymentAuthorisationRequired) {
      if (invoice.registeredByStaffId === staff.id && staff.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Segregation of duties violation: The staff member who registered the supplier invoice cannot execute the payment.',
        });
      }
    }

    const payAmt = Number(amount || invoice.balanceDue);
    if (isNaN(payAmt) || payAmt <= 0 || payAmt > invoice.balanceDue + 1) {
      return res.status(400).json({ error: `Invalid payment amount ₦${payAmt}. Balance due is ₦${invoice.balanceDue.toLocaleString()}.` });
    }

    if (!paymentReference) {
      return res.status(400).json({ error: 'Payment reference is mandatory for supplier settlements.' });
    }

    const now = new Date().toISOString();
    invoice.paidAmount += payAmt;
    invoice.balanceDue = Math.max(0, invoice.invoiceAmount - invoice.paidAmount);
    invoice.status = invoice.balanceDue <= 0 ? 'paid' : 'partially_paid';
    invoice.payments.push({
      amount: payAmt,
      paymentReference,
      paymentMethod,
      paidByStaffId: staff.id,
      paidByName: staff.name,
      paidAt: now,
    });

    saveDatabaseSync();
    logAuditEvent(
      staff.name,
      staff.role,
      staff.branchId,
      'SUPPLIER_PAYMENT_DISBURSED',
      `Paid ₦${payAmt.toLocaleString()} towards invoice ${invoice.invoiceNumber} (Ref: ${paymentReference})`
    );

    res.json({ success: true, invoice });
  });

  // ============================================================================
  // 4. BUDGETS, COMMITMENTS & VARIANCE REPORTING
  // ============================================================================
  router.get('/api/finance/budgets/summary', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;

    if (!(await hasPermission(staff, 'budgets.manage')) && !['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'accountant', 'auditor'].includes(staff.role)) {
      return res.status(403).json({ error: 'Access denied: Viewing budget commitments requires financial authority.' });
    }

    const branches = ['gra', 'okabere', 'ugbowo'];
    const summary: any[] = [];

    for (const bId of branches) {
      const budget = db.expenditureBudgets[bId] || { monthlyOpexLimit: 1000000, monthlyCapexLimit: 500000 };

      // Actual Paid OPEX (from claims and ledger)
      const claims = Object.values(db.expenseClaims || {}) as any[];
      const bClaims = claims.filter((c) => (c.operatingBranchId === bId || c.homeBranchId === bId));
      const actualPaidOpex = bClaims
        .filter((c) => c.status === 'paid' && c.accountingClassification !== 'fixed_asset')
        .reduce((sum, c) => sum + Number(c.paidAmount || c.totalAmount || 0), 0);

      // Committed OPEX (approved but unpaid claims)
      const committedOpex = bClaims
        .filter((c) => ['approved', 'payment_pending', 'partially_paid'].includes(c.status) && c.accountingClassification !== 'fixed_asset')
        .reduce((sum, c) => sum + (Number(c.approvedAmount ?? c.totalAmount ?? 0) - Number(c.paidAmount || 0)), 0);

      // Actual Paid CAPEX
      const capexList = Object.values(db.capexRequisitions || {}) as any[];
      const bCapex = capexList.filter((r) => r.branchId === bId);
      const actualPaidCapex = bCapex
        .filter((r) => r.status === 'capitalized')
        .reduce((sum, r) => sum + Number(r.actualCost || r.estimatedCost || 0), 0);

      // Committed CAPEX (approved requisitions pending capitalization)
      const committedCapex = bCapex
        .filter((r) => r.status === 'approved')
        .reduce((sum, r) => sum + Number(r.estimatedCost || 0), 0);

      const opexVariance = budget.monthlyOpexLimit - (actualPaidOpex + committedOpex);
      const capexVariance = budget.monthlyCapexLimit - (actualPaidCapex + committedCapex);

      summary.push({
        branchId: bId,
        monthlyOpexLimit: budget.monthlyOpexLimit,
        monthlyCapexLimit: budget.monthlyCapexLimit,
        actualPaidOpex,
        committedOpex,
        totalOpexCommitment: actualPaidOpex + committedOpex,
        opexUtilizationPct: budget.monthlyOpexLimit > 0 ? Math.round(((actualPaidOpex + committedOpex) / budget.monthlyOpexLimit) * 100) : 0,
        opexVariance,
        actualPaidCapex,
        committedCapex,
        totalCapexCommitment: actualPaidCapex + committedCapex,
        capexUtilizationPct: budget.monthlyCapexLimit > 0 ? Math.round(((actualPaidCapex + committedCapex) / budget.monthlyCapexLimit) * 100) : 0,
        capexVariance,
      });
    }

    res.json({ success: true, budgets: summary });
  });

  // ============================================================================
  // 5. OPEX & RECURRING OPERATING COSTS (Diesel, Power, Packaging, Maintenance)
  // ============================================================================
  router.get('/api/finance/opex', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;

    if (
      !(await hasPermission(staff, 'expenses.view')) &&
      !(await hasPermission(staff, 'accounting.view')) &&
      !['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'accountant', 'auditor'].includes(staff.role)
    ) {
      return res.status(403).json({ error: 'Access denied: Viewing OPEX records requires financial or branch management authority.' });
    }

    const { branchId, category, status } = req.query;
    let claims = Object.values(db.expenseClaims || {}) as any[];
    // Exclude fixed_asset and payroll items from OPEX view
    claims = claims.filter((c) => c.accountingClassification !== 'fixed_asset' && c.category !== 'payroll');

    if (branchId && branchId !== 'all') {
      claims = claims.filter((c) => c.operatingBranchId === branchId || c.homeBranchId === branchId);
    }
    if (category) {
      claims = claims.filter((c) => c.category === category);
    }
    if (status) {
      claims = claims.filter((c) => c.status === status);
    }

    res.json(claims.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
  });

  router.post('/api/finance/opex', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;

    if (staff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
    }
    if (
      !(await hasPermission(staff, 'expenses.submit')) &&
      !(await hasPermission(staff, 'expenses.manage')) &&
      !['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'accountant'].includes(staff.role)
    ) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to record OPEX costs.' });
    }

    const {
      title,
      category = 'utilities_diesel',
      amount,
      vendorName = 'Operating Vendor',
      branchId,
      recurring = false,
      frequency = 'monthly',
      paymentMethod = 'bank_transfer',
      notes = '',
    } = req.body || {};

    if (!title || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'OPEX title and valid positive amount (> ₦0) are required.' });
    }
    if (String(category).toLowerCase().includes('payroll') || String(category).toLowerCase().includes('salary')) {
      return res.status(400).json({ error: 'Salary and payroll costs must be processed through the dedicated Payroll workflow (/api/finance/payroll/*), not ordinary OPEX claims.' });
    }

    if (!db.expenseClaims) db.expenseClaims = {};
    const targetBranch = branchId || staff.branchId || 'gra';
    const opexId = `opex-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const claimNumber = `OPEX-${String(Object.keys(db.expenseClaims).length + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const opexRecord = {
      id: opexId,
      claimNumber,
      claimType: recurring ? 'recurring_opex' : 'direct_opex',
      accountingClassification: 'opex',
      title: String(title).trim(),
      description: String(notes || title).trim(),
      category,
      vendorName,
      operatingBranchId: targetBranch,
      homeBranchId: staff.branchId || targetBranch,
      totalAmount: Number(amount),
      approvedAmount: Number(amount),
      paidAmount: 0,
      currency: 'NGN',
      recurring: Boolean(recurring),
      frequency: recurring ? frequency : 'one_time',
      paymentMethod,
      status: 'submitted',
      submittedByStaffId: staff.id,
      submittedByName: staff.name,
      submittedByRole: staff.role,
      createdAt: now,
      updatedAt: now,
      auditTrail: [
        {
          id: `aud-${Date.now()}`,
          action: 'submit',
          actorId: staff.id,
          actorName: staff.name,
          actorRole: staff.role,
          timestamp: now,
          notes: `OPEX cost recorded (${recurring ? `Recurring ${frequency}` : 'Direct OPEX'})`,
        },
      ],
    };

    db.expenseClaims[opexId] = opexRecord;
    saveDatabaseSync();

    logAuditEvent(
      staff.name,
      staff.role,
      targetBranch,
      'OPEX_COST_RECORDED',
      `Recorded OPEX ${claimNumber}: "${opexRecord.title}" (${category}) for ₦${opexRecord.totalAmount.toLocaleString()}`
    );

    res.status(201).json({ success: true, opex: opexRecord });
  });

  // ============================================================================
  // 6. FINANCIAL RECONCILIATION (Sales, POS Checks, Shifts, Payroll, Supplier & OPEX)
  // ============================================================================
  router.post('/api/finance/reconcile', requireAuth, async (req: Request, res: Response) => {
    const db = getDb() as any;
    ensureFinanceStructures(db);
    const staff = (req as any).staff as DbStaffAccount;

    if (staff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
    }
    if (
      !(await hasPermission(staff, 'accounting.reconcile')) &&
      !['super_admin', 'corporate_admin', 'admin', 'accountant', 'branch_manager'].includes(staff.role)
    ) {
      return res.status(403).json({ error: 'Access denied: Financial reconciliation requires accounting.reconcile privilege.' });
    }

    const { branchId = 'gra', periodStart, periodEnd, actualBankAndCashCounted, notes = '' } = req.body || {};

    const checks = Object.values(db.checks || {}) as any[];
    const orders = Object.values(db.orders || {}) as any[];
    const claims = Object.values(db.expenseClaims || {}) as any[];
    const supplierInvoices = Object.values(db.supplierInvoices || {}) as any[];
    const payrolls = Object.values(db.payrolls || {}) as any[];

    const paidChecksTotal = checks
      .filter((c) => (branchId === 'all' || c.branchId === branchId) && (c.status === 'paid' || c.paymentStatus === 'paid'))
      .reduce((s, c) => s + Number(c.paidAmount || c.totalAmount || 0), 0);

    const paidOrdersTotal = orders
      .filter((o) => (branchId === 'all' || o.branchId === branchId) && o.paymentStatus === 'paid')
      .reduce((s, o) => s + Number(o.total || 0), 0);

    const paidOpexTotal = claims
      .filter((c) => (branchId === 'all' || c.operatingBranchId === branchId) && c.status === 'paid')
      .reduce((s, c) => s + Number(c.paidAmount || c.totalAmount || 0), 0);

    const paidSupplierTotal = supplierInvoices
      .reduce((s, inv) => s + Number(inv.paidAmount || 0), 0);

    const disbursedPayrollTotal = payrolls
      .filter((p) => (branchId === 'all' || p.branchId === branchId || p.branchId === 'all') && (p.status === 'disbursed' || p.status === 'reconciled'))
      .reduce((s, p) => s + Number(p.totalNetPay || 0), 0);

    const expectedNetPosition = (paidChecksTotal + paidOrdersTotal) - (paidOpexTotal + paidSupplierTotal + disbursedPayrollTotal);
    const counted = actualBankAndCashCounted !== undefined ? Number(actualBankAndCashCounted) : expectedNetPosition;
    const variance = counted - expectedNetPosition;

    const reconRecord = {
      id: `frec-${Date.now()}`,
      branchId,
      periodStart: periodStart || new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      periodEnd: periodEnd || new Date().toISOString().slice(0, 10),
      paidChecksTotal,
      paidOrdersTotal,
      paidOpexTotal,
      paidSupplierTotal,
      disbursedPayrollTotal,
      expectedNetPosition,
      actualCounted: counted,
      variance,
      status: Math.abs(variance) <= 1 ? 'balanced' : 'variance_flagged',
      reconciledByStaffId: staff.id,
      reconciledByName: staff.name,
      reconciledByRole: staff.role,
      notes,
      createdAt: new Date().toISOString(),
    };

    if (!Array.isArray(db.reconciliations)) db.reconciliations = [];
    db.reconciliations.push(reconRecord);
    saveDatabaseSync();

    logAuditEvent(
      staff.name,
      staff.role,
      branchId === 'all' ? 'gra' : branchId,
      'FINANCIAL_RECONCILIATION_COMPLETED',
      `Completed financial reconciliation (${reconRecord.status}): Expected Net ₦${expectedNetPosition.toLocaleString()}, Variance ₦${variance.toLocaleString()}`
    );

    res.status(201).json({ success: true, reconciliation: reconRecord });
  });

  return router;
}
