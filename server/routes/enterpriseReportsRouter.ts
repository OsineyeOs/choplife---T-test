import express, { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import type { DbDatabase, DbStaffAccount } from '../../server_db.ts';
import { db as pgDb } from '../db/db.ts';
import { staff as pgStaff } from '../db/schema/staff.ts';
import { auditLogs as pgAuditLogs } from '../db/schema/audit.ts';
import { ensureCanonicalDeliveryZones } from '../services/deliveryFeeAuthorityService.ts';
import { INITIAL_RECIPES_BOM } from '../../src/data/inventoryMaster.ts';

export interface EnterpriseReportDefinition {
  code: string;
  title: string;
  domain: 'Sales & Revenue' | 'Payments & Shifts' | 'Inventory & Procurement' | 'Finance & Accounting' | 'HR & Payroll' | 'Dispatch & Logistics' | 'Security & Audit';
  description: string;
  formulaDefinition: string;
  sourceTables: string[];
  allowedRoles: string[];
  requiredPermission?: string;
  supportsBranchFilter: boolean;
  supportsDateRange: boolean;
  sensitiveDataControl?: string;
}

export const ENTERPRISE_REPORT_CATALOGUE: EnterpriseReportDefinition[] = [
  {
    code: 'report.sales_summary',
    title: 'Daily & Period Sales Summary',
    domain: 'Sales & Revenue',
    description: 'Authoritative gross sales, item/order discounts, net food revenue, packaging fees, delivery fees, and total settled order value.',
    formulaDefinition: 'Net Sales = Gross Item Subtotal - Discounts; Total Collected = Net Sales + Packaging Fees + Delivery Fees (for paid orders/checks).',
    sourceTables: ['orders', 'checks'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'shift_supervisor'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.channel_mix',
    title: 'Order Channel & Service Mode Mix',
    domain: 'Sales & Revenue',
    description: 'Revenue, order count, and average ticket size segmented by Dine-In, Takeaway, Delivery, Online Web Storefront, and POS Counter.',
    formulaDefinition: 'Channel Share % = (Channel Paid Revenue / Total Paid Revenue) * 100.',
    sourceTables: ['orders', 'checks'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.branch_comparison',
    title: 'Multi-Branch Performance Comparison',
    domain: 'Sales & Revenue',
    description: 'Side-by-side revenue, order volume, average order value, OPEX, and net operating margin across GRA, Okabere, and Ugbowo.',
    formulaDefinition: 'Branch Operating Margin = Branch Paid Revenue - (Branch Paid OPEX + Branch Disbursed Payroll).',
    sourceTables: ['branches', 'orders', 'checks', 'expense_claims', 'payrolls'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor'],
    supportsBranchFilter: false,
    supportsDateRange: true,
  },
  {
    code: 'report.product_mix',
    title: 'Product, Category & Package/Combo Mix',
    domain: 'Sales & Revenue',
    description: 'Units sold, gross revenue, and package component breakdown (including 2000 Mini Pack and Small Chops platters).',
    formulaDefinition: 'Product Revenue = Sum(Line Quantity * Authoritative Unit Price).',
    sourceTables: ['menu_products', 'categories', 'orders', 'checks'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'kitchen_lead'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.payment_methods',
    title: 'Payment Method & Tender Reconciliation',
    domain: 'Payments & Shifts',
    description: 'Paid transaction totals broken down by Cash, POS Card Terminal, Paystack Online, Bank Transfer, and Split Tender.',
    formulaDefinition: 'Tender Total = Sum(Settled Amount by Payment Method where paymentStatus = paid).',
    sourceTables: ['orders', 'checks', 'shifts'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'shift_supervisor'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.shift_cash_variance',
    title: 'Shift Cash Drawer & Variance Register',
    domain: 'Payments & Shifts',
    description: 'Opening float, cash sales, petty cash payouts, expected closing cash, actual counted cash, and shortage/overage variance per cashier shift.',
    formulaDefinition: 'Expected Cash = Opening Float + Cash Sales - Cash Refunds/Payouts; Variance = Actual Counted Cash - Expected Cash.',
    sourceTables: ['shifts', 'reconciliations'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'shift_supervisor'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.discounts_voids_refunds',
    title: 'Discounts, Voids, Refunds & Supervisor Overrides',
    domain: 'Payments & Shifts',
    description: 'Audit register of all discounted checks, voided items, zero-share split waivers, and supervisor PIN authorizations.',
    formulaDefinition: 'Total Revenue Concession = Sum(Order Discounts + Voided Check Value + Waived Split Shares).',
    sourceTables: ['checks', 'orders', 'audit_trail'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.inventory_valuation',
    title: 'Inventory Stock Valuation & Low-Stock Register',
    domain: 'Inventory & Procurement',
    description: 'Current on-hand stock quantity, unit cost, total inventory valuation, and low-stock/out-of-stock status per branch.',
    formulaDefinition: 'Line Valuation = On-Hand Quantity * Weighted Unit Cost.',
    sourceTables: ['inventory', 'stock_ledger'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'inventory_controller', 'kitchen_lead'],
    supportsBranchFilter: true,
    supportsDateRange: false,
  },
  {
    code: 'report.wastage_shrinkage',
    title: 'Wastage, Spoilage & Stock Movement Ledger',
    domain: 'Inventory & Procurement',
    description: 'Recorded kitchen wastage, spoilage, breakage, and stock adjustments with financial cost impact.',
    formulaDefinition: 'Wastage Cost = Quantity Wasted * SKU Unit Cost.',
    sourceTables: ['wastage', 'stock_ledger', 'inventory'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'inventory_controller', 'kitchen_lead'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.supplier_payables',
    title: 'Procurement PO, GRN & Supplier Payables Aging',
    domain: 'Inventory & Procurement',
    description: 'Purchase orders, goods receipt notes, 3-way match status, supplier invoices, paid amounts, and outstanding payables.',
    formulaDefinition: 'Outstanding Balance = Invoice Total Amount - Paid Amount.',
    sourceTables: ['purchase_orders', 'goods_receipt_notes', 'supplier_invoices', 'suppliers'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'inventory_controller'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.payroll_register',
    title: 'Payroll Register, Statutory Tax/Pension & Bank Schedule',
    domain: 'HR & Payroll',
    description: 'Monthly staff payroll breakdown: Basic, Allowances, Rider Bonuses, Gross Pay, PAYE, Employee/Employer Pension, NHF, Loans/Deductions, and Net Pay.',
    formulaDefinition: 'Net Pay = Gross Pay - (Employee Pension 8% + NHF 2.5% + PAYE Tax + Approved Deductions/Loan Installments).',
    sourceTables: ['payrolls', 'staff', 'payroll_adjustments'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor'],
    requiredPermission: 'payroll.view',
    supportsBranchFilter: true,
    supportsDateRange: false,
    sensitiveDataControl: 'Bank account numbers are masked (******1234) by default unless caller holds payroll.disburse or payroll.approve and explicitly requests unmasked bank schedule.',
  },
  {
    code: 'report.staff_deductions_loans',
    title: 'Employee Loans, Salary Advances & Shortage Recovery Ledger',
    domain: 'HR & Payroll',
    description: 'Full ledger of staff loans, salary advances, and cashier shift-shortage recoveries with principal, monthly installment, and remaining balance.',
    formulaDefinition: 'Remaining Balance = Principal Amount - Cumulative Recovered Installments.',
    sourceTables: ['payroll_adjustments', 'shifts', 'staff'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.rider_settlement',
    title: 'Dispatch Rider Delivery Settlement & Zone Split Report',
    domain: 'Dispatch & Logistics',
    description: 'Internal rider delivery counts + bonuses and External 3P rider zone fee split schedule (Customer Fee vs Rider Payout vs Choplife Share).',
    formulaDefinition: 'Customer Delivery Fee = External Rider Payout Share + Choplife Company Share.',
    sourceTables: ['delivery_tasks', 'orders', 'staff'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'dispatch_manager', 'dispatch'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.security_audit_log',
    title: 'Security, RBAC, Catalogue & Financial Export Audit Log',
    domain: 'Security & Audit',
    description: 'Immutable chronological trail of staff logins, role/permission updates, price changes, supervisor overrides, payroll runs, and report exports.',
    formulaDefinition: 'Chronological append-only event stream.',
    sourceTables: ['audit_trail'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'auditor', 'accountant'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.detailed_sales_lines',
    title: 'Item-Level Sales & Modifier Audit Register',
    domain: 'Sales & Revenue',
    description: 'Itemized sales register showing every sold, voided, returned, or refunded menu line, SKU, category, quantity, unit price, modifiers, line discounts, and net sales.',
    formulaDefinition: 'Line Net Total = (Quantity * Unit Price) - Line Discount. Includes combo parent items and individual modifiers.',
    sourceTables: ['orders', 'checks', 'menu_products'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'shift_supervisor'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.combo_package_constituents',
    title: 'Combo, Platter & Package Constituent Audit',
    domain: 'Sales & Revenue',
    description: 'Constituent-level decomposition of all combo packages, party platters, and mini packs (e.g. 2000 Mini Pack, Small Chops Platter) showing portion consumption and BOM stock deductions.',
    formulaDefinition: 'Constituent Consumption = Sold Packages * Constituent Units Per Pack; Extended Value = Constituent Units * Constituent Unit Price.',
    sourceTables: ['orders', 'checks', 'menu_products', 'recipes_bom'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'kitchen_lead'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.packaging_consumption',
    title: 'Packaging Materials & Eco-Containers Consumption',
    domain: 'Inventory & Procurement',
    description: 'Audit of food boxes, carryout kraft bags, foil packs, and disposable containers consumed across order channels with cost vs recovered fee analysis.',
    formulaDefinition: 'Packaging Recovery Margin = Packaging Fees Charged to Customers - Estimated Material Cost.',
    sourceTables: ['orders', 'checks', 'inventory'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'inventory_controller'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.payments_detailed_register',
    title: 'Granular Payment Tender & Transaction Register',
    domain: 'Payments & Shifts',
    description: 'Transaction-level tender register capturing individual Cash, POS Card Terminal, Bank Transfer, Paystack, and Split Share payments with auth references and cashier reconciliation.',
    formulaDefinition: 'Tender Balance = Sum(Settled Tenders) - Order Total; Change Given = Cash Tendered - Check Amount.',
    sourceTables: ['orders', 'checks', 'shifts'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'shift_supervisor'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
  {
    code: 'report.reconciliation_exceptions',
    title: 'Shift, Settlement & Pricing Exceptions Register',
    domain: 'Security & Audit',
    description: 'Automated discrepancy log tracking unbalanced split checks, high discounts (>₦1,000), voided kitchen orders, negative cash drawer variances, and supervisor PIN authorizations.',
    formulaDefinition: 'Identifies any transaction where Total != Settled Tender, Discount > Threshold, or Cash Count != Expected Float.',
    sourceTables: ['checks', 'orders', 'shifts', 'audit_trail'],
    allowedRoles: ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager'],
    supportsBranchFilter: true,
    supportsDateRange: true,
  },
];

/**
 * Sanitizes a cell value against CSV / Excel / Google Sheets formula injection.
 * Any string beginning with =, +, -, @, tab, or carriage return is prefixed with a single quote.
 */
export function sanitizeSpreadsheetCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (/^[=+\-@\t\r]/.test(raw)) {
    return `'${raw}`;
  }
  return raw;
}

export function formatCsvRow(values: unknown[]): string {
  return values
    .map((v) => {
      const clean = sanitizeSpreadsheetCell(v).replace(/"/g, '""');
      return `"${clean}"`;
    })
    .join(',');
}

export function createEnterpriseReportsRouter(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: express.RequestHandler;
  hasPermission: (staff: DbStaffAccount, permissionCode: string) => Promise<boolean>;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
}) {
  const router = express.Router();
  const { getDb, requireAuth, hasPermission, logAuditEvent } = deps;

  function isGlobalRole(role: string): boolean {
    return ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor'].includes(role);
  }

  async function canAccessReport(staff: DbStaffAccount, report: EnterpriseReportDefinition): Promise<boolean> {
    if (['super_admin', 'corporate_admin', 'admin'].includes(staff.role)) return true;
    if (!report.allowedRoles.includes(staff.role)) {
      if (report.requiredPermission && (await hasPermission(staff, report.requiredPermission))) {
        return true;
      }
      return false;
    }
    return true;
  }

  function resolveEffectiveBranchFilter(staff: DbStaffAccount, requestedBranch?: string): string {
    if (isGlobalRole(staff.role)) {
      return requestedBranch || 'all';
    }
    const staffBranch = staff.branchId || 'gra';
    const allowed = Array.isArray((staff as any).allowedBranchIds) ? (staff as any).allowedBranchIds : [staffBranch];
    if (requestedBranch && requestedBranch !== 'all' && allowed.includes(requestedBranch)) {
      return requestedBranch;
    }
    return staffBranch;
  }

  async function buildReportDataset(
    db: DbDatabase & Record<string, any>,
    staff: DbStaffAccount,
    reportCode: string,
    filters: {
      branchId?: string;
      dateFrom?: string;
      dateTo?: string;
      payPeriod?: string;
      includeUnmaskedBankDetails?: boolean;
    }
  ): Promise<{
    report: EnterpriseReportDefinition;
    effectiveBranchId: string;
    summaryMetrics: Array<{ label: string; value: string | number; subtext?: string }>;
    columns: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center' }>;
    rows: Array<Record<string, any>>;
  }> {
    const report = ENTERPRISE_REPORT_CATALOGUE.find((r) => r.code === reportCode);
    if (!report) {
      throw new Error(`Unknown report code: ${reportCode}`);
    }

    const effectiveBranchId = resolveEffectiveBranchFilter(staff, filters.branchId);
    const fromMs = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`).getTime() : 0;
    const toMs = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999Z`).getTime() : Number.MAX_SAFE_INTEGER;

    const inDateRange = (iso?: string) => {
      if (!iso) return true;
      const ms = new Date(iso).getTime();
      if (Number.isNaN(ms)) return true;
      return ms >= fromMs && ms <= toMs;
    };

    const matchesBranch = (recordBranch?: string) => {
      if (effectiveBranchId === 'all') return true;
      return !recordBranch || recordBranch === effectiveBranchId || recordBranch === 'all';
    };

    // Collect unified settled transactions (orders + non-duplicate checks)
    const allOrders = (Object.values(db.orders || {}) as any[]).filter(
      (o) => matchesBranch(o.branchId) && inDateRange(o.createdAt)
    );
    const allChecks = (Object.values(db.checks || {}) as any[]).filter(
      (c) => matchesBranch(c.branchId) && inDateRange(c.openedAt || c.createdAt)
    );

    if (reportCode === 'report.sales_summary') {
      const paidOrders = allOrders.filter(
        (o) =>
          o.paymentStatus === 'paid' ||
          o.paymentStatus === 'reconciliation_required' ||
          o.paymentStatus === 'confirmed' ||
          o.status === 'confirmed' ||
          o.status === 'completed' ||
          o.status === 'delivered' ||
          (o.total > 0 && o.status !== 'cancelled')
      );
      const standaloneChecks = allChecks.filter(
        (c) =>
          !c.orderId &&
          (c.status === 'paid' ||
            c.paymentStatus === 'paid' ||
            (c.amountPaid && c.amountPaid > 0) ||
            (c.items && c.items.length > 0))
      );
      const combined = [
        ...paidOrders.map((o) => ({
          ref: o.orderNumber || o.id,
          orderId: o.id,
          checkId: o.checkId || (allChecks.find((c) => c.orderId === o.id)?.id),
          date: (o.createdAt || '').slice(0, 16).replace('T', ' '),
          branch: (o.branchId || 'gra').toUpperCase(),
          channel: o.orderChannel === 'pos_counter' ? 'POS Counter' : o.orderChannel === 'web_customer' ? 'Web Customer' : 'Web Storefront',
          serviceType: (o.orderType || 'takeaway').toUpperCase(),
          subtotal: Number(o.subtotal || 0),
          discount: Number(o.discount || 0),
          packagingFee: Number(o.packagingFee || 0),
          deliveryFee: Number(o.deliveryFee || 0),
          total: Number(o.total || 0),
          paymentMethod: String(o.paymentMethod || 'cash').toUpperCase(),
          cashier: o.cashierName || 'Online Order',
          status: String(o.paymentStatus || o.status || 'SETTLED').toUpperCase(),
        })),
        ...standaloneChecks.map((c) => ({
          ref: c.checkNumber || c.id,
          orderId: c.orderId,
          checkId: c.id,
          date: (c.openedAt || '').slice(0, 16).replace('T', ' '),
          branch: (c.branchId || 'gra').toUpperCase(),
          channel: 'POS Check',
          serviceType: (c.checkType || 'dine_in').toUpperCase(),
          subtotal: Number(c.subtotal || 0),
          discount: Number(c.discountAmount || 0),
          packagingFee: Number(c.packagingFee || 0),
          deliveryFee: Number(c.deliveryFee || 0),
          total: Number(c.total || c.amountPaid || 0),
          paymentMethod: String(c.paymentMethod || 'pos').toUpperCase(),
          cashier: c.openedByName || c.cashierName || 'Cashier',
          status: String(c.status || c.paymentStatus || 'OPEN').toUpperCase(),
        })),
      ];

      const grossSubtotal = combined.reduce((s, r) => s + r.subtotal, 0);
      const totalDiscount = combined.reduce((s, r) => s + r.discount, 0);
      const totalPackaging = combined.reduce((s, r) => s + r.packagingFee, 0);
      const totalDelivery = combined.reduce((s, r) => s + r.deliveryFee, 0);
      const netTotal = combined.reduce((s, r) => s + r.total, 0);

      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Audited Orders / Checks', value: combined.length },
          { label: 'Gross Food Subtotal (₦)', value: `₦${grossSubtotal.toLocaleString()}` },
          { label: 'Discounts Granted (₦)', value: `₦${totalDiscount.toLocaleString()}` },
          { label: 'Packaging & Delivery (₦)', value: `₦${(totalPackaging + totalDelivery).toLocaleString()}` },
          { label: 'Total Reconciled Value (₦)', value: `₦${netTotal.toLocaleString()}` },
        ],
        columns: [
          { key: 'ref', label: 'Order / Check Ref' },
          { key: 'date', label: 'Timestamp' },
          { key: 'branch', label: 'Branch' },
          { key: 'channel', label: 'Channel' },
          { key: 'serviceType', label: 'Service Mode' },
          { key: 'subtotal', label: 'Subtotal (₦)', align: 'right' },
          { key: 'discount', label: 'Discount (₦)', align: 'right' },
          { key: 'packagingFee', label: 'Packaging (₦)', align: 'right' },
          { key: 'deliveryFee', label: 'Delivery (₦)', align: 'right' },
          { key: 'total', label: 'Total Paid (₦)', align: 'right' },
          { key: 'paymentMethod', label: 'Tender' },
          { key: 'cashier', label: 'Staff / Cashier' },
          { key: 'status', label: 'Status' },
        ],
        rows: combined,
      };
    }

    if (reportCode === 'report.channel_mix') {
      const paidOrders = allOrders.filter((o) => o.paymentStatus === 'paid');
      const groups: Record<string, { channel: string; serviceMode: string; count: number; revenue: number }> = {};
      for (const o of paidOrders) {
        const ch = o.orderChannel === 'pos_counter' ? 'POS Counter' : 'Online Web Storefront';
        const mode = String(o.orderType || 'takeaway').toUpperCase();
        const key = `${ch}__${mode}`;
        if (!groups[key]) groups[key] = { channel: ch, serviceMode: mode, count: 0, revenue: 0 };
        groups[key].count += 1;
        groups[key].revenue += Number(o.total || 0);
      }
      const totalRev = Object.values(groups).reduce((s, g) => s + g.revenue, 0) || 1;
      const rows = Object.values(groups).map((g) => ({
        channel: g.channel,
        serviceMode: g.serviceMode,
        orderCount: g.count,
        revenue: g.revenue,
        averageTicket: Math.round(g.revenue / Math.max(1, g.count)),
        sharePercent: `${((g.revenue / totalRev) * 100).toFixed(1)}%`,
      }));
      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Active Channels', value: rows.length },
          { label: 'Total Paid Orders', value: paidOrders.length },
          { label: 'Total Channel Revenue (₦)', value: `₦${rows.reduce((s, r) => s + r.revenue, 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'channel', label: 'Ordering Channel' },
          { key: 'serviceMode', label: 'Service Mode' },
          { key: 'orderCount', label: 'Paid Orders', align: 'right' },
          { key: 'revenue', label: 'Total Revenue (₦)', align: 'right' },
          { key: 'averageTicket', label: 'Avg Ticket (₦)', align: 'right' },
          { key: 'sharePercent', label: 'Revenue Share %', align: 'right' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.branch_comparison') {
      const branches = ['gra', 'okabere', 'ugbowo'];
      const rows = branches.map((bId) => {
        const bOrders = (Object.values(db.orders || {}) as any[]).filter(
          (o) => o.branchId === bId && o.paymentStatus === 'paid' && inDateRange(o.createdAt)
        );
        const bClaims = (Object.values(db.expenseClaims || {}) as any[]).filter(
          (c) => c.operatingBranchId === bId && (c.status === 'paid' || c.status === 'approved') && inDateRange(c.createdAt)
        );
        const rev = bOrders.reduce((s, o) => s + Number(o.total || 0), 0);
        const opex = bClaims.reduce((s, c) => s + Number(c.approvedAmount || c.totalAmount || 0), 0);
        return {
          branchId: bId.toUpperCase(),
          branchName: db.branches?.[bId]?.name || `Choplife ${bId.toUpperCase()}`,
          paidOrders: bOrders.length,
          grossRevenue: rev,
          avgOrderValue: bOrders.length > 0 ? Math.round(rev / bOrders.length) : 0,
          recordedOpex: opex,
          netOperatingContribution: rev - opex,
        };
      });
      return {
        report,
        effectiveBranchId: 'all',
        summaryMetrics: [
          { label: 'Branches Compared', value: rows.length },
          { label: 'Combined Revenue (₦)', value: `₦${rows.reduce((s, r) => s + r.grossRevenue, 0).toLocaleString()}` },
          { label: 'Combined Net Contribution (₦)', value: `₦${rows.reduce((s, r) => s + r.netOperatingContribution, 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'branchId', label: 'Branch Code' },
          { key: 'branchName', label: 'Branch Name' },
          { key: 'paidOrders', label: 'Paid Orders', align: 'right' },
          { key: 'grossRevenue', label: 'Settled Revenue (₦)', align: 'right' },
          { key: 'avgOrderValue', label: 'Avg Ticket (₦)', align: 'right' },
          { key: 'recordedOpex', label: 'Approved OPEX (₦)', align: 'right' },
          { key: 'netOperatingContribution', label: 'Net Contribution (₦)', align: 'right' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.product_mix') {
      const paidOrders = allOrders.filter((o) => o.paymentStatus === 'paid');
      const prodAgg: Record<string, { productId: string; name: string; category: string; type: string; qty: number; revenue: number }> = {};
      for (const o of paidOrders) {
        for (const it of o.items || []) {
          const pId = String(it.productId || it.id || it.name);
          const catalogProd = db.menuProducts?.[pId];
          if (!prodAgg[pId]) {
            prodAgg[pId] = {
              productId: pId,
              name: it.name || catalogProd?.name || pId,
              category: catalogProd?.category || 'general',
              type: (catalogProd?.productType || (it.compositionSnapshot ? 'package' : 'standard')).toUpperCase(),
              qty: 0,
              revenue: 0,
            };
          }
          const q = Number(it.quantity || 1);
          const lineTotal = Number(it.totalPrice ?? (Number(it.unitPrice || it.price || 0) * q));
          prodAgg[pId].qty += q;
          prodAgg[pId].revenue += lineTotal;
        }
      }
      const rows = Object.values(prodAgg).sort((a, b) => b.revenue - a.revenue);
      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Distinct SKUs Sold', value: rows.length },
          { label: 'Total Units Sold', value: rows.reduce((s, r) => s + r.qty, 0) },
          { label: 'Product Mix Revenue (₦)', value: `₦${rows.reduce((s, r) => s + r.revenue, 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'productId', label: 'SKU / ID' },
          { key: 'name', label: 'Product / Package Name' },
          { key: 'category', label: 'Category' },
          { key: 'type', label: 'Item Type' },
          { key: 'qty', label: 'Units Sold', align: 'right' },
          { key: 'revenue', label: 'Gross Revenue (₦)', align: 'right' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.payment_methods') {
      const paidOrders = allOrders.filter((o) => o.paymentStatus === 'paid');
      const byMethod: Record<string, { method: string; count: number; total: number }> = {};
      for (const o of paidOrders) {
        const m = String(o.paymentMethod || 'cash').toUpperCase();
        if (!byMethod[m]) byMethod[m] = { method: m, count: 0, total: 0 };
        byMethod[m].count += 1;
        byMethod[m].total += Number(o.total || 0);
      }
      const rows = Object.values(byMethod).sort((a, b) => b.total - a.total);
      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Tender Types Used', value: rows.length },
          { label: 'Total Settled Transactions', value: rows.reduce((s, r) => s + r.count, 0) },
          { label: 'Total Reconciled Value (₦)', value: `₦${rows.reduce((s, r) => s + r.total, 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'method', label: 'Payment Tender Method' },
          { key: 'count', label: 'Transaction Count', align: 'right' },
          { key: 'total', label: 'Settled Amount (₦)', align: 'right' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.shift_cash_variance') {
      const shifts = (Object.values(db.shifts || {}) as any[]).filter(
        (s) => matchesBranch(s.branchId) && inDateRange(s.openedAt || s.closedAt)
      );
      const rows = shifts.map((s) => {
        const opening = Number(s.openingCash || 0);
        const cashSales = Number(s.cashSales || 0);
        const expected = Number(s.expectedCash ?? opening + cashSales);
        const actual = Number(s.closingCash ?? expected);
        const variance = Number(s.cashVariance ?? actual - expected);
        return {
          shiftId: s.id,
          cashierName: s.cashierName || s.openedByName || 'Cashier',
          branchId: (s.branchId || 'gra').toUpperCase(),
          status: String(s.status || 'open').toUpperCase(),
          openingCash: opening,
          cashSales,
          expectedCash: expected,
          closingCash: actual,
          variance,
        };
      });
      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Shifts Logged', value: rows.length },
          { label: 'Total Cash Sales (₦)', value: `₦${rows.reduce((s, r) => s + r.cashSales, 0).toLocaleString()}` },
          { label: 'Net Cash Variance (₦)', value: `₦${rows.reduce((s, r) => s + r.variance, 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'shiftId', label: 'Shift ID' },
          { key: 'cashierName', label: 'Cashier' },
          { key: 'branchId', label: 'Branch' },
          { key: 'status', label: 'Status' },
          { key: 'openingCash', label: 'Opening Float (₦)', align: 'right' },
          { key: 'cashSales', label: 'Cash Sales (₦)', align: 'right' },
          { key: 'expectedCash', label: 'Expected Drawer (₦)', align: 'right' },
          { key: 'closingCash', label: 'Counted Cash (₦)', align: 'right' },
          { key: 'variance', label: 'Variance (₦)', align: 'right' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.discounts_voids_refunds') {
      const discountedOrders = allOrders.filter((o) => Number(o.discount || 0) > 0 || o.status === 'cancelled');
      const voidOrSplitChecks = allChecks.filter(
        (c) => Number(c.discountAmount || 0) > 0 || c.status === 'voided' || Boolean(c.zeroShareWaived)
      );
      const rows = [
        ...discountedOrders.map((o) => ({
          ref: o.orderNumber || o.id,
          type: o.status === 'cancelled' ? 'CANCELLED ORDER' : 'ORDER DISCOUNT',
          branch: (o.branchId || 'gra').toUpperCase(),
          amount: Number(o.discount || o.total || 0),
          reason: o.appliedCouponCode || o.cancellationReason || 'Promotional / Manual Discount',
          actor: o.cancelledBy || 'Storefront / POS',
          timestamp: (o.updatedAt || o.createdAt || '').slice(0, 16).replace('T', ' '),
        })),
        ...voidOrSplitChecks.map((c) => ({
          ref: c.checkNumber || c.id,
          type: c.status === 'voided' ? 'VOIDED CHECK' : c.zeroShareWaived ? 'SPLIT ZERO-SHARE WAIVER' : 'CHECK DISCOUNT',
          branch: (c.branchId || 'gra').toUpperCase(),
          amount: Number(c.discountAmount || (c.status === 'voided' ? c.total : 0)),
          reason: c.voidReason || c.discountReason || 'Supervisor Authorized Exception',
          actor: c.openedByName || 'POS Supervisor',
          timestamp: (c.openedAt || '').slice(0, 16).replace('T', ' '),
        })),
      ];
      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Exception Events', value: rows.length },
          { label: 'Total Concession Value (₦)', value: `₦${rows.reduce((s, r) => s + r.amount, 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'ref', label: 'Reference' },
          { key: 'type', label: 'Exception Type' },
          { key: 'branch', label: 'Branch' },
          { key: 'amount', label: 'Impact Amount (₦)', align: 'right' },
          { key: 'reason', label: 'Reason / Code' },
          { key: 'actor', label: 'Authorized By' },
          { key: 'timestamp', label: 'Timestamp' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.inventory_valuation') {
      const invItems = (Object.values(db.inventory || {}) as any[]).filter((item) => matchesBranch(item.branchId));
      const rows = invItems.map((item) => {
        const qty = Number(item.currentStock ?? item.stock ?? 0);
        const min = Number(item.minStock ?? item.reorderLevel ?? 10);
        const unitCost = Number(item.costPerUnit ?? item.unitCost ?? 0);
        const valuation = Math.round(qty * unitCost);
        const stockState = qty <= 0 ? 'OUT OF STOCK' : qty <= min ? 'LOW STOCK' : 'HEALTHY';
        return {
          skuId: item.id,
          name: item.name,
          category: item.category || 'Raw Material',
          branchId: (item.branchId || 'gra').toUpperCase(),
          currentStock: `${qty} ${item.unit || 'units'}`,
          reorderLevel: `${min} ${item.unit || 'units'}`,
          unitCost,
          valuation,
          stockState,
        };
      });
      const totalVal = rows.reduce((s, r) => s + r.valuation, 0);
      const lowCount = rows.filter((r) => r.stockState !== 'HEALTHY').length;
      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Tracked Inventory SKUs', value: rows.length },
          { label: 'Low / Out-of-Stock Alerts', value: lowCount },
          { label: 'Total Stock Valuation (₦)', value: `₦${totalVal.toLocaleString()}` },
        ],
        columns: [
          { key: 'skuId', label: 'SKU ID' },
          { key: 'name', label: 'Inventory Item' },
          { key: 'category', label: 'Category' },
          { key: 'branchId', label: 'Branch' },
          { key: 'currentStock', label: 'On-Hand Qty', align: 'right' },
          { key: 'reorderLevel', label: 'Min Threshold', align: 'right' },
          { key: 'unitCost', label: 'Unit Cost (₦)', align: 'right' },
          { key: 'valuation', label: 'Total Valuation (₦)', align: 'right' },
          { key: 'stockState', label: 'Stock Health' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.wastage_shrinkage') {
      const wastageList = ((db.wastage || []) as any[]).filter(
        (w) => matchesBranch(w.branchId) && inDateRange(w.recordedAt || w.createdAt)
      );
      const rows = wastageList.map((w) => ({
        id: w.id,
        itemName: w.itemName || w.itemId,
        branchId: (w.branchId || 'gra').toUpperCase(),
        quantity: `${w.quantity} ${w.unit || ''}`.trim(),
        reason: w.reason || 'Kitchen Spoilage / Wastage',
        costImpact: Number(w.costImpact || w.estimatedCost || 0),
        recordedBy: w.recordedBy || 'Kitchen Staff',
        recordedAt: (w.recordedAt || w.createdAt || '').slice(0, 16).replace('T', ' '),
      }));
      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Wastage Incidents', value: rows.length },
          { label: 'Total Wastage Cost (₦)', value: `₦${rows.reduce((s, r) => s + r.costImpact, 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'id', label: 'Record ID' },
          { key: 'itemName', label: 'Item' },
          { key: 'branchId', label: 'Branch' },
          { key: 'quantity', label: 'Qty Wasted', align: 'right' },
          { key: 'reason', label: 'Reason' },
          { key: 'costImpact', label: 'Cost Impact (₦)', align: 'right' },
          { key: 'recordedBy', label: 'Logged By' },
          { key: 'recordedAt', label: 'Timestamp' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.supplier_payables') {
      const pos = Object.values(db.purchaseOrders || {}) as any[];
      const invoices = Object.values(db.supplierInvoices || {}) as any[];
      const rows = [
        ...invoices.map((inv) => ({
          docNumber: inv.invoiceNumber || inv.id,
          docType: 'SUPPLIER INVOICE',
          supplierName: inv.supplierName || 'Vendor',
          branchId: (inv.branchId || 'gra').toUpperCase(),
          totalAmount: Number(inv.totalAmount || 0),
          paidAmount: Number(inv.paidAmount || 0),
          balanceDue: Math.max(0, Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)),
          status: String(inv.status || 'pending').toUpperCase(),
        })),
        ...pos.map((po) => ({
          docNumber: po.poNumber || po.id,
          docType: 'PURCHASE ORDER',
          supplierName: po.supplierName || 'Vendor',
          branchId: (po.branchId || 'gra').toUpperCase(),
          totalAmount: Number(po.totalAmount || 0),
          paidAmount: po.status === 'paid' ? Number(po.totalAmount || 0) : 0,
          balanceDue: po.status === 'paid' ? 0 : Number(po.totalAmount || 0),
          status: String(po.status || 'sent').toUpperCase(),
        })),
      ].filter((r) => effectiveBranchId === 'all' || r.branchId.toLowerCase() === effectiveBranchId);

      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Procurement Documents', value: rows.length },
          { label: 'Total Invoiced / Ordered (₦)', value: `₦${rows.reduce((s, r) => s + r.totalAmount, 0).toLocaleString()}` },
          { label: 'Outstanding Payables (₦)', value: `₦${rows.reduce((s, r) => s + r.balanceDue, 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'docNumber', label: 'Document Ref' },
          { key: 'docType', label: 'Type' },
          { key: 'supplierName', label: 'Supplier' },
          { key: 'branchId', label: 'Branch' },
          { key: 'totalAmount', label: 'Total Amount (₦)', align: 'right' },
          { key: 'paidAmount', label: 'Paid (₦)', align: 'right' },
          { key: 'balanceDue', label: 'Balance Due (₦)', align: 'right' },
          { key: 'status', label: 'Status' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.payroll_register') {
      const canUnmaskBank =
        Boolean(filters.includeUnmaskedBankDetails) &&
        (['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(staff.role) ||
          (await hasPermission(staff, 'payroll.disburse')));

      const allStaffRecords = await pgDb.select().from(pgStaff);
      const filteredStaff = allStaffRecords.filter((s: any) =>
        effectiveBranchId === 'all' ? true : s.branchId === effectiveBranchId
      );

      const rows = filteredStaff.map((s: any) => {
        const prof = s.payrollProfile || {};
        const basic = Math.round(Number(prof.basicSalary || (s.role === 'rider' ? 25000 : 0)));
        const allowances =
          Math.round(Number(prof.housingAllowance || 0)) +
          Math.round(Number(prof.transportAllowance || 0)) +
          Math.round(Number(prof.otherAllowances || 0));
        const gross = basic + allowances;
        const pension = prof.pensionApplicable === false ? 0 : Math.round((basic + Math.round(Number(prof.housingAllowance || 0)) + Math.round(Number(prof.transportAllowance || 0))) * 0.08);
        const nhf = prof.nhfApplicable === false ? 0 : Math.round(basic * 0.025);
        const paye = Math.max(0, Math.round(gross * 0.05));
        const net = Math.max(0, gross - pension - nhf - paye);
        const rawAcct = String(prof.accountNumber || '');
        const maskedAcct = rawAcct.length >= 4 ? `******${rawAcct.slice(-4)}` : 'Not Configured';

        return {
          employeeId: s.staffId || s.id,
          staffName: s.name,
          role: String(s.role || '').replace(/_/g, ' ').toUpperCase(),
          branchId: String(s.branchId || 'gra').toUpperCase(),
          basicSalary: basic,
          allowances,
          grossPay: gross,
          statutoryDeductions: pension + nhf + paye,
          netPay: net,
          bankName: prof.bankName || 'Pending',
          accountNumber: canUnmaskBank ? (rawAcct || 'Pending') : maskedAcct,
        };
      });

      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Staff on Register', value: rows.length },
          { label: 'Total Gross Payroll (₦)', value: `₦${rows.reduce((s, r) => s + r.grossPay, 0).toLocaleString()}` },
          { label: 'Statutory Deductions (₦)', value: `₦${rows.reduce((s, r) => s + r.statutoryDeductions, 0).toLocaleString()}` },
          { label: 'Total Net Pay (₦)', value: `₦${rows.reduce((s, r) => s + r.netPay, 0).toLocaleString()}` },
          { label: 'Bank Account Masking', value: canUnmaskBank ? 'UNMASKED (DISBURSEMENT AUTH)' : 'MASKED (******1234)' },
        ],
        columns: [
          { key: 'employeeId', label: 'Staff ID' },
          { key: 'staffName', label: 'Employee Name' },
          { key: 'role', label: 'Role' },
          { key: 'branchId', label: 'Branch' },
          { key: 'basicSalary', label: 'Basic (₦)', align: 'right' },
          { key: 'allowances', label: 'Allowances (₦)', align: 'right' },
          { key: 'grossPay', label: 'Gross Pay (₦)', align: 'right' },
          { key: 'statutoryDeductions', label: 'PAYE/Pension/NHF (₦)', align: 'right' },
          { key: 'netPay', label: 'Estimated Net (₦)', align: 'right' },
          { key: 'bankName', label: 'Bank' },
          { key: 'accountNumber', label: 'Account Number' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.staff_deductions_loans') {
      const adjs = (Object.values(db.payrollAdjustments || {}) as any[]).filter(
        (a) => matchesBranch(a.branchId) && inDateRange(a.createdAt)
      );
      const rows = adjs.map((a) => ({
        id: a.id,
        employeeId: a.employeeId || a.staffId,
        staffName: a.staffName,
        branchId: String(a.branchId || 'gra').toUpperCase(),
        category: String(a.category || a.type || 'deduction').replace(/_/g, ' ').toUpperCase(),
        reason: a.title || a.reason,
        principalAmount: Number(a.principalAmount || a.amount || 0),
        monthlyInstallment: Number(a.monthlyInstallment || a.amount || 0),
        remainingBalance: Number(a.remainingBalance ?? a.principalAmount ?? a.amount ?? 0),
        status: String(a.status || 'pending_approval').toUpperCase(),
      }));
      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Active Loans / Deductions', value: rows.length },
          { label: 'Total Principal Logged (₦)', value: `₦${rows.reduce((s, r) => s + r.principalAmount, 0).toLocaleString()}` },
          { label: 'Outstanding Recovery Balance (₦)', value: `₦${rows.reduce((s, r) => s + r.remainingBalance, 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'id', label: 'Adjustment ID' },
          { key: 'employeeId', label: 'Staff ID' },
          { key: 'staffName', label: 'Employee' },
          { key: 'branchId', label: 'Branch' },
          { key: 'category', label: 'Category' },
          { key: 'reason', label: 'Reason / Shift Ref' },
          { key: 'principalAmount', label: 'Principal (₦)', align: 'right' },
          { key: 'monthlyInstallment', label: 'Period Deduction (₦)', align: 'right' },
          { key: 'remainingBalance', label: 'Remaining Balance (₦)', align: 'right' },
          { key: 'status', label: 'Approval Status' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.rider_settlement') {
      const zoneSchedule = ensureCanonicalDeliveryZones(db);
      const tasks = (Object.values(db.deliveryTasks || {}) as any[]).filter(
        (t) => matchesBranch(t.branchId) && inDateRange(t.assignedAt || t.deliveredAt)
      );
      const rows = zoneSchedule
        .filter((z) => matchesBranch(z.branchId))
        .map((z) => {
          const matchingTasks = tasks.filter(
            (t) =>
              t.deliveryZoneId === z.zoneId ||
              (t.deliveryZone && String(t.deliveryZone).toLowerCase().includes(z.zoneKey.toLowerCase())) ||
              t.branchId === z.branchId
          );
          const completedCount = matchingTasks.filter((t) => t.status === 'delivered').length;
          return {
            zoneId: z.zoneId,
            zoneName: z.zoneName,
            branchId: z.branchId.toUpperCase(),
            customerDeliveryFee: z.customerDeliveryFee,
            riderShareAmount: z.riderShareAmount,
            companyShareAmount: z.companyShareAmount,
            completedDeliveries: completedCount,
            totalRiderSettlement: completedCount * z.riderShareAmount,
            totalCompanyRetained: completedCount * z.companyShareAmount,
          };
        });
      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Configured Delivery Zones', value: rows.length },
          { label: 'Total Rider Settlement (₦)', value: `₦${rows.reduce((s, r) => s + r.totalRiderSettlement, 0).toLocaleString()}` },
          { label: 'Choplife Delivery Share (₦)', value: `₦${rows.reduce((s, r) => s + r.totalCompanyRetained, 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'zoneId', label: 'Zone Code' },
          { key: 'zoneName', label: 'Delivery Location / Zone' },
          { key: 'branchId', label: 'Hub Branch' },
          { key: 'customerDeliveryFee', label: 'Customer Fee (₦)', align: 'right' },
          { key: 'riderShareAmount', label: 'Rider Payout (₦)', align: 'right' },
          { key: 'companyShareAmount', label: 'Choplife Share (₦)', align: 'right' },
          { key: 'completedDeliveries', label: 'Completed Runs', align: 'right' },
          { key: 'totalRiderSettlement', label: 'Total Rider Payout (₦)', align: 'right' },
          { key: 'totalCompanyRetained', label: 'Total Choplife Share (₦)', align: 'right' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.security_audit_log') {
      let auditEvents: any[] = [];
      try {
        const pgLogs = await pgDb.select().from(pgAuditLogs);
        if (Array.isArray(pgLogs) && pgLogs.length > 0) {
          auditEvents = pgLogs.map((l) => ({
            id: l.id,
            timestamp: l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString(),
            staffName: l.staffName || 'System',
            staffRole: l.staffRole || 'system',
            branchId: l.branchId || 'gra',
            actionType: l.action,
            action: l.action,
            details: l.details,
          }));
        }
      } catch {}
      if (auditEvents.length === 0 && Array.isArray(db.auditTrail)) {
        auditEvents = db.auditTrail;
      }
      const filteredEvents = auditEvents
        .filter((e) => matchesBranch(e.branchId) && inDateRange(e.timestamp))
        .slice(-250)
        .reverse();
      const rows = filteredEvents.map((e) => ({
        id: e.id,
        timestamp: (e.timestamp || '').slice(0, 19).replace('T', ' '),
        actorName: e.staffName || 'System',
        actorRole: String(e.staffRole || 'system').toUpperCase(),
        branchId: String(e.branchId || 'gra').toUpperCase(),
        actionType: e.actionType || e.action,
        action: e.action || e.actionType,
        details: e.details,
      }));
      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Audit Trail Entries', value: rows.length },
          { label: 'Scope', value: effectiveBranchId.toUpperCase() },
        ],
        columns: [
          { key: 'timestamp', label: 'Timestamp (UTC)' },
          { key: 'actorName', label: 'Actor Name' },
          { key: 'actorRole', label: 'Role' },
          { key: 'branchId', label: 'Branch' },
          { key: 'actionType', label: 'Event Code' },
          { key: 'details', label: 'Audit Description' },
        ],
        rows,
      };
    }
    if (reportCode === 'report.detailed_sales_lines') {
      const relevantOrders = allOrders.filter((o) => o.status !== 'cancelled' || o.items?.length);
      const relevantChecks = allChecks.filter((c) => !c.orderId && (c.items?.length || c.status !== 'voided'));

      const lineRows: any[] = [];

      for (const o of relevantOrders) {
        for (const it of o.items || []) {
          const cat = db.menuProducts?.[it.productId]?.category || 'General';
          const pType = (it.productType || (it.compositionSnapshot ? 'combo' : db.menuProducts?.[it.productId]?.productType || 'standard')).toUpperCase();
          const q = Number(it.quantity || 1);
          const uPrice = Number(it.unitPrice || it.price || 0);
          const disc = Number(it.itemDiscountAmount || 0);
          const lTotal = Number(it.totalPrice ?? (uPrice * q - disc));
          lineRows.push({
            ref: o.orderNumber || o.id,
            checkId: o.checkId || (allChecks.find((c) => c.orderId === o.id)?.id),
            orderId: o.id,
            date: (o.createdAt || '').slice(0, 16).replace('T', ' '),
            branch: (o.branchId || 'gra').toUpperCase(),
            channel: o.orderChannel === 'pos_counter' ? 'POS Counter' : 'Online Web',
            productName: it.name || it.productId,
            category: cat.toUpperCase(),
            productType: pType,
            quantity: q,
            unitPrice: uPrice,
            lineDiscount: disc,
            lineTotal: lTotal,
            cashier: o.cashierName || 'Web Order',
            status: String(it.status || o.paymentStatus || 'SOLD').toUpperCase(),
          });
        }
      }

      for (const c of relevantChecks) {
        for (const it of c.items || []) {
          const cat = db.menuProducts?.[it.productId]?.category || 'General';
          const pType = (it.productType || (it.compositionSnapshot ? 'combo' : db.menuProducts?.[it.productId]?.productType || 'standard')).toUpperCase();
          const q = Number(it.quantity || 1);
          const uPrice = Number(it.unitPrice || it.price || 0);
          const disc = Number(it.itemDiscountAmount || 0);
          const lTotal = Number(it.totalPrice ?? (uPrice * q - disc));
          lineRows.push({
            ref: c.checkNumber || c.id,
            checkId: c.id,
            orderId: c.orderId,
            date: (c.openedAt || '').slice(0, 16).replace('T', ' '),
            branch: (c.branchId || 'gra').toUpperCase(),
            channel: 'POS Check',
            productName: it.name || it.productId,
            category: cat.toUpperCase(),
            productType: pType,
            quantity: q,
            unitPrice: uPrice,
            lineDiscount: disc,
            lineTotal: lTotal,
            cashier: c.openedByName || c.cashierName || 'Cashier',
            status: String(it.status || c.status || 'SOLD').toUpperCase(),
          });
        }
      }

      const totalQty = lineRows.reduce((s, r) => s + r.quantity, 0);
      const grossLineRev = lineRows.reduce((s, r) => s + r.lineTotal, 0);
      const totalLineDisc = lineRows.reduce((s, r) => s + r.lineDiscount, 0);

      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Item Lines Audited', value: lineRows.length },
          { label: 'Total Units Sold', value: totalQty },
          { label: 'Line Discounts (₦)', value: `₦${totalLineDisc.toLocaleString()}` },
          { label: 'Net Line Revenue (₦)', value: `₦${grossLineRev.toLocaleString()}` },
        ],
        columns: [
          { key: 'ref', label: 'Order / Check Ref' },
          { key: 'date', label: 'Timestamp' },
          { key: 'branch', label: 'Branch' },
          { key: 'channel', label: 'Channel' },
          { key: 'productName', label: 'Product Name' },
          { key: 'category', label: 'Category' },
          { key: 'productType', label: 'Type' },
          { key: 'quantity', label: 'Qty', align: 'right' },
          { key: 'unitPrice', label: 'Unit Price (₦)', align: 'right' },
          { key: 'lineDiscount', label: 'Discount (₦)', align: 'right' },
          { key: 'lineTotal', label: 'Line Total (₦)', align: 'right' },
          { key: 'cashier', label: 'Cashier / Server' },
          { key: 'status', label: 'Status' },
        ],
        rows: lineRows,
      };
    }

    if (reportCode === 'report.combo_package_constituents') {
      const allUnifiedItems = [
        ...allOrders.flatMap((o) => (o.items || []).map((it: any) => ({ ...it, orderRef: o.orderNumber || o.id, branch: o.branchId, date: o.createdAt, cashier: o.cashierName }))),
        ...allChecks.filter((c) => !c.orderId).flatMap((c) => (c.items || []).map((it: any) => ({ ...it, orderRef: c.checkNumber || c.id, branch: c.branchId, date: c.openedAt, cashier: c.openedByName }))),
      ];

      const rows: any[] = [];
      for (const it of allUnifiedItems) {
        const prod = db.menuProducts?.[it.productId];
        const components = it.compositionSnapshot || prod?.components || [];
        if (components.length > 0) {
          const packQty = Number(it.quantity || 1);
          for (const comp of components) {
            const cQty = Number(comp.quantity || 1);
            const totalCUnits = cQty * packQty;
            const uPrice = Number(comp.unitPrice || 0);
            rows.push({
              ref: it.orderRef,
              parentPackage: it.name || prod?.name || it.productId,
              branch: (it.branch || 'gra').toUpperCase(),
              date: (it.date || '').slice(0, 16).replace('T', ' '),
              packagesSold: packQty,
              constituentName: comp.name || comp.productName || comp.productId,
              constituentQtyPerPack: cQty,
              totalUnitsConsumed: totalCUnits,
              unitPrice: uPrice,
              extendedValue: totalCUnits * uPrice,
            });
          }
        }
      }

      const totalPackages = Array.from(new Set(rows.map((r) => r.ref + r.parentPackage))).length;
      const totalPortions = rows.reduce((s, r) => s + r.totalUnitsConsumed, 0);
      const totalConstituentVal = rows.reduce((s, r) => s + r.extendedValue, 0);

      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Package Lines Expanded', value: totalPackages },
          { label: 'Constituent Portions', value: totalPortions },
          { label: 'Decomposed Value (₦)', value: `₦${totalConstituentVal.toLocaleString()}` },
        ],
        columns: [
          { key: 'ref', label: 'Order / Check Ref' },
          { key: 'parentPackage', label: 'Package / Combo' },
          { key: 'branch', label: 'Branch' },
          { key: 'date', label: 'Timestamp' },
          { key: 'packagesSold', label: 'Packs Sold', align: 'right' },
          { key: 'constituentName', label: 'Constituent Component' },
          { key: 'constituentQtyPerPack', label: 'Qty / Pack', align: 'right' },
          { key: 'totalUnitsConsumed', label: 'Total Units Consumed', align: 'right' },
          { key: 'unitPrice', label: 'Component Price (₦)', align: 'right' },
          { key: 'extendedValue', label: 'Extended Value (₦)', align: 'right' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.packaging_consumption') {
      const rows = [
        ...allOrders.map((o) => {
          const itemCount = (o.items || []).length;
          const fee = Number(o.packagingFee || 0);
          const estCost = Math.round(fee > 0 ? fee * 0.45 : itemCount * 120);
          return {
            ref: o.orderNumber || o.id,
            date: (o.createdAt || '').slice(0, 16).replace('T', ' '),
            branch: (o.branchId || 'gra').toUpperCase(),
            channel: o.orderChannel === 'pos_counter' ? 'POS Counter' : 'Online Storefront',
            serviceType: (o.orderType || 'takeaway').toUpperCase(),
            packagingType: fee > 0 ? 'Eco Food Box + Carryout Kraft Bag' : 'Dine-In Serviceware',
            unitsUsed: Math.max(1, itemCount),
            packagingFee: fee,
            estimatedCost: estCost,
            recoveryMargin: fee - estCost,
          };
        }),
        ...allChecks.filter((c) => !c.orderId).map((c) => {
          const itemCount = (c.items || []).length;
          const fee = Number(c.packagingFee || 0);
          const estCost = Math.round(fee > 0 ? fee * 0.45 : (c.checkType === 'takeaway' ? itemCount * 120 : 0));
          return {
            ref: c.checkNumber || c.id,
            date: (c.openedAt || '').slice(0, 16).replace('T', ' '),
            branch: (c.branchId || 'gra').toUpperCase(),
            channel: 'POS Check',
            serviceType: (c.checkType || 'dine_in').toUpperCase(),
            packagingType: fee > 0 ? 'Eco Food Box + Cutlery' : c.checkType === 'takeaway' ? 'Takeaway Packaging' : 'Dine-In Serviceware',
            unitsUsed: Math.max(1, itemCount),
            packagingFee: fee,
            estimatedCost: estCost,
            recoveryMargin: fee - estCost,
          };
        }),
      ];

      const totalFees = rows.reduce((s, r) => s + r.packagingFee, 0);
      const totalCost = rows.reduce((s, r) => s + r.estimatedCost, 0);
      const totalUnits = rows.reduce((s, r) => s + r.unitsUsed, 0);

      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Packaging Orders Audited', value: rows.length },
          { label: 'Packaging Containers Used', value: totalUnits },
          { label: 'Packaging Fees Collected (₦)', value: `₦${totalFees.toLocaleString()}` },
          { label: 'Est. Material Cost (₦)', value: `₦${totalCost.toLocaleString()}` },
          { label: 'Packaging Recovery Margin (₦)', value: `₦${(totalFees - totalCost).toLocaleString()}` },
        ],
        columns: [
          { key: 'ref', label: 'Order / Check Ref' },
          { key: 'date', label: 'Timestamp' },
          { key: 'branch', label: 'Branch' },
          { key: 'channel', label: 'Channel' },
          { key: 'serviceType', label: 'Service Mode' },
          { key: 'packagingType', label: 'Packaging Applied' },
          { key: 'unitsUsed', label: 'Units Used', align: 'right' },
          { key: 'packagingFee', label: 'Customer Fee (₦)', align: 'right' },
          { key: 'estimatedCost', label: 'Est. Cost (₦)', align: 'right' },
          { key: 'recoveryMargin', label: 'Recovery Margin (₦)', align: 'right' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.payments_detailed_register') {
      const rows: any[] = [];
      let tenderIdx = 1;

      for (const o of allOrders) {
        if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
          for (const p of o.payments) {
            rows.push({
              tenderId: p.id || `TND-ORD-${o.orderNumber || o.id}-${tenderIdx++}`,
              ref: o.orderNumber || o.id,
              date: (p.timestamp || p.paidAt || o.createdAt || '').slice(0, 16).replace('T', ' '),
              branch: (o.branchId || 'gra').toUpperCase(),
              method: String(p.method || o.paymentMethod || 'CASH').toUpperCase(),
              amount: Number(p.amount || o.total || 0),
              cashTendered: Number(p.cashTendered || 0),
              changeGiven: Number(p.changeGiven || 0),
              reference: p.reference || o.paymentReference || 'N/A',
              cashier: p.cashierName || p.confirmedByName || o.cashierName || 'Online System',
              shareLabel: p.shareLabel || 'Full Payment',
            });
          }
        } else {
          rows.push({
            tenderId: `TND-ORD-${o.orderNumber || o.id}-${tenderIdx++}`,
            ref: o.orderNumber || o.id,
            date: (o.createdAt || '').slice(0, 16).replace('T', ' '),
            branch: (o.branchId || 'gra').toUpperCase(),
            method: String(o.paymentMethod || 'CASH').toUpperCase(),
            amount: Number(o.total || 0),
            cashTendered: 0,
            changeGiven: 0,
            reference: o.pickupAuthorizationCode || o.deliveryPin || 'N/A (Storefront)',
            cashier: o.cashierName || 'Storefront Automation',
            shareLabel: 'Full Settlement',
          });
        }
      }

      for (const c of allChecks.filter((ck) => !ck.orderId)) {
        if (c.payments && Array.isArray(c.payments) && c.payments.length > 0) {
          for (const p of c.payments) {
            rows.push({
              tenderId: p.id || `TND-CHK-${c.checkNumber || c.id}-${tenderIdx++}`,
              ref: c.checkNumber || c.id,
              date: (p.timestamp || p.paidAt || c.openedAt || '').slice(0, 16).replace('T', ' '),
              branch: (c.branchId || 'gra').toUpperCase(),
              method: String(p.method || c.paymentMethod || 'CASH').toUpperCase(),
              amount: Number(p.amount || c.total || 0),
              cashTendered: Number(p.cashTendered || 0),
              changeGiven: Number(p.changeGiven || 0),
              reference: p.reference || 'N/A (POS)',
              cashier: p.cashierName || p.confirmedByName || c.openedByName || 'Cashier',
              shareLabel: p.shareLabel || 'Full Payment',
            });
          }
        } else if (c.splitPayments && Array.isArray(c.splitPayments) && c.splitPayments.length > 0) {
          for (const sp of c.splitPayments) {
            rows.push({
              tenderId: `TND-SPLIT-${c.checkNumber || c.id}-${tenderIdx++}`,
              ref: c.checkNumber || c.id,
              date: (c.openedAt || '').slice(0, 16).replace('T', ' '),
              branch: (c.branchId || 'gra').toUpperCase(),
              method: String(sp.method || 'SPLIT').toUpperCase(),
              amount: Number(sp.amount || 0),
              cashTendered: 0,
              changeGiven: 0,
              reference: sp.reference || `Share ${sp.shareId || 'N/A'}`,
              cashier: c.openedByName || 'Cashier',
              shareLabel: `Split Share (${sp.shareId || 'Guest'})`,
            });
          }
        } else {
          rows.push({
            tenderId: `TND-CHK-${c.checkNumber || c.id}-${tenderIdx++}`,
            ref: c.checkNumber || c.id,
            date: (c.openedAt || '').slice(0, 16).replace('T', ' '),
            branch: (c.branchId || 'gra').toUpperCase(),
            method: String(c.paymentMethod || 'POS').toUpperCase(),
            amount: Number(c.amountPaid || c.total || 0),
            cashTendered: 0,
            changeGiven: 0,
            reference: 'POS Desk Tender',
            cashier: c.openedByName || c.cashierName || 'Cashier',
            shareLabel: 'Single Check Settlement',
          });
        }
      }

      const totalTenders = rows.reduce((s, r) => s + r.amount, 0);

      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Tenders Audited', value: rows.length },
          { label: 'Total Settled Amount (₦)', value: `₦${totalTenders.toLocaleString()}` },
          { label: 'Distinct Tender Methods', value: Array.from(new Set(rows.map((r) => r.method))).length },
        ],
        columns: [
          { key: 'tenderId', label: 'Tender ID' },
          { key: 'ref', label: 'Order / Check Ref' },
          { key: 'date', label: 'Timestamp' },
          { key: 'branch', label: 'Branch' },
          { key: 'method', label: 'Tender Method' },
          { key: 'amount', label: 'Amount (₦)', align: 'right' },
          { key: 'cashTendered', label: 'Cash Tendered (₦)', align: 'right' },
          { key: 'changeGiven', label: 'Change Given (₦)', align: 'right' },
          { key: 'reference', label: 'Slip / Terminal Ref' },
          { key: 'cashier', label: 'Cashier / Collector' },
          { key: 'shareLabel', label: 'Allocation / Share' },
        ],
        rows,
      };
    }

    if (reportCode === 'report.reconciliation_exceptions') {
      const rows: any[] = [];

      for (const o of allOrders) {
        if (Number(o.discount || 0) > 1000) {
          rows.push({
            exceptionType: 'HIGH_DISCOUNT_ORDER',
            ref: o.orderNumber || o.id,
            branch: (o.branchId || 'gra').toUpperCase(),
            date: (o.createdAt || '').slice(0, 16).replace('T', ' '),
            expectedAmount: Number(o.subtotal || 0),
            actualAmount: Number(o.total || 0),
            variance: Number(o.discount || 0),
            authorizedBy: o.appliedCouponCode || 'Storefront Promo',
            severity: 'MEDIUM',
            status: 'AUDITED',
          });
        }
        if (o.status === 'cancelled') {
          rows.push({
            exceptionType: 'CANCELLED_ORDER',
            ref: o.orderNumber || o.id,
            branch: (o.branchId || 'gra').toUpperCase(),
            date: (o.createdAt || '').slice(0, 16).replace('T', ' '),
            expectedAmount: Number(o.total || 0),
            actualAmount: 0,
            variance: Number(o.total || 0),
            authorizedBy: o.cancelledBy || 'Supervisor / Customer',
            severity: 'HIGH',
            status: 'REVIEWED',
          });
        }
      }

      for (const c of allChecks) {
        if (Number(c.discountAmount || 0) > 1000) {
          rows.push({
            exceptionType: 'HIGH_DISCOUNT_CHECK',
            ref: c.checkNumber || c.id,
            branch: (c.branchId || 'gra').toUpperCase(),
            date: (c.openedAt || '').slice(0, 16).replace('T', ' '),
            expectedAmount: Number(c.subtotal || 0),
            actualAmount: Number(c.total || 0),
            variance: Number(c.discountAmount || 0),
            authorizedBy: c.discountApprovedBy || c.openedByName || 'Supervisor PIN',
            severity: 'HIGH',
            status: 'AUDITED',
          });
        }
        if (c.status === 'voided') {
          rows.push({
            exceptionType: 'VOIDED_CHECK',
            ref: c.checkNumber || c.id,
            branch: (c.branchId || 'gra').toUpperCase(),
            date: (c.openedAt || '').slice(0, 16).replace('T', ' '),
            expectedAmount: Number(c.total || 0),
            actualAmount: 0,
            variance: Number(c.total || 0),
            authorizedBy: c.voidReason || 'Manager Override',
            severity: 'HIGH',
            status: 'VOID_LOGGED',
          });
        }
        if (c.status === 'paid' && Number(c.remainingBalance || 0) > 0) {
          rows.push({
            exceptionType: 'UNBALANCED_SETTLEMENT',
            ref: c.checkNumber || c.id,
            branch: (c.branchId || 'gra').toUpperCase(),
            date: (c.openedAt || '').slice(0, 16).replace('T', ' '),
            expectedAmount: Number(c.total || 0),
            actualAmount: Number(c.amountPaid || 0),
            variance: Number(c.remainingBalance || 0),
            authorizedBy: c.openedByName || 'Cashier',
            severity: 'MEDIUM',
            status: 'PENDING_RECONCILIATION',
          });
        }
      }

      const shifts = (Object.values(db.shifts || {}) as any[]).filter(
        (s) => matchesBranch(s.branchId) && inDateRange(s.openedAt || s.closedAt)
      );
      for (const s of shifts) {
        const v = Number(s.cashVariance ?? (Number(s.countedCashInTill ?? s.closingCash ?? 0) - Number(s.expectedCashInTill ?? s.expectedCash ?? 0)));
        if (Math.abs(v) > 500) {
          rows.push({
            exceptionType: 'SHIFT_DRAWER_VARIANCE',
            ref: s.shiftNumber || s.id,
            branch: (s.branchId || 'gra').toUpperCase(),
            date: (s.closedAt || s.openedAt || '').slice(0, 16).replace('T', ' '),
            expectedAmount: Number(s.expectedCashInTill ?? s.expectedCash ?? 0),
            actualAmount: Number(s.countedCashInTill ?? s.closingCash ?? 0),
            variance: v,
            authorizedBy: s.closedByName || s.openedByName || 'Shift Cashier',
            severity: Math.abs(v) > 2000 ? 'HIGH' : 'MEDIUM',
            status: 'SHORTAGE_DEDUCTION_PENDING',
          });
        }
      }

      const totalExceptions = rows.length;
      const totalVariance = rows.reduce((s, r) => s + Math.abs(r.variance), 0);

      return {
        report,
        effectiveBranchId,
        summaryMetrics: [
          { label: 'Exception Incidents', value: totalExceptions },
          { label: 'Total Value at Risk (₦)', value: `₦${totalVariance.toLocaleString()}` },
          { label: 'High Severity Alerts', value: rows.filter((r) => r.severity === 'HIGH').length },
        ],
        columns: [
          { key: 'exceptionType', label: 'Exception Category' },
          { key: 'ref', label: 'Reference / Check' },
          { key: 'branch', label: 'Branch' },
          { key: 'date', label: 'Timestamp' },
          { key: 'expectedAmount', label: 'Expected (₦)', align: 'right' },
          { key: 'actualAmount', label: 'Actual (₦)', align: 'right' },
          { key: 'variance', label: 'Discrepancy (₦)', align: 'right' },
          { key: 'authorizedBy', label: 'Approver / Reason' },
          { key: 'severity', label: 'Severity' },
          { key: 'status', label: 'Remediation Status' },
        ],
        rows,
      };
    }

    return {
      report,
      effectiveBranchId,
      summaryMetrics: [{ label: 'Total Records', value: 0 }],
      columns: [{ key: 'info', label: 'Information' }],
      rows: [],
    };
  }

  // GET /api/reports/catalogue
  router.get('/api/reports/catalogue', requireAuth, async (req: Request, res: Response) => {
    const staff = (req as any).staff as DbStaffAccount;
    const accessible: EnterpriseReportDefinition[] = [];
    for (const rep of ENTERPRISE_REPORT_CATALOGUE) {
      if (await canAccessReport(staff, rep)) {
        accessible.push(rep);
      }
    }
    res.json({
      staffRole: staff.role,
      effectiveBranchScope: isGlobalRole(staff.role) ? 'all' : staff.branchId || 'gra',
      reports: accessible,
    });
  });

  // GET /api/reports/receipt/:id
  router.get('/api/reports/receipt/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const db = getDb() as any;
      const staff = (req as any).staff as DbStaffAccount;
      const targetId = String(req.params.id || '').trim();

      const orders = Object.values(db.orders || {}) as any[];
      const checks = Object.values(db.checks || {}) as any[];

      const order = orders.find(
        (o) => o.id === targetId || o.orderNumber === targetId || o.pickupAuthorizationCode === targetId
      );
      const check = checks.find(
        (c) =>
          c.id === targetId ||
          c.checkNumber === targetId ||
          (order && (c.orderId === order.id || c.id === order.checkId))
      );

      const linkedOrder = order || orders.find((o) => o.id === check?.orderId || o.checkId === check?.id);

      if (!order && !check) {
        return res.status(404).json({ error: `Receipt / transaction with reference '${targetId}' was not found.` });
      }

      const receiptBranch = (order?.branchId || check?.branchId || 'gra').toLowerCase();
      if (!isGlobalRole(staff.role) && receiptBranch !== staff.branchId) {
        const allowed = Array.isArray((staff as any).allowedBranchIds) ? (staff as any).allowedBranchIds : [staff.branchId];
        if (!allowed.includes(receiptBranch)) {
          return res.status(403).json({ error: `Forbidden: You do not have permission to view receipts for branch '${receiptBranch}'.` });
        }
      }

      const rawItems = (check?.items?.length ? check.items : linkedOrder?.items) || [];
      const enrichedItems = rawItems.map((it: any, idx: number) => {
        const prod = db.menuProducts?.[it.productId || it.id];
        const components = it.compositionSnapshot || prod?.components || [];
        const isCombo = it.productType === 'combo' || it.productType === 'package' || it.productType === 'platter' || components.length > 0;
        
        const recipe = INITIAL_RECIPES_BOM.find(
          (r) => r.menuProductId === it.productId || r.menuProductName.toLowerCase() === (it.name || '').toLowerCase()
        );

        return {
          id: it.id || `item-${idx}`,
          productId: it.productId || it.id,
          name: it.name || prod?.name || 'Menu Item',
          category: prod?.category || 'General',
          productType: isCombo ? 'COMBO / PACKAGE' : (it.productType || 'STANDARD').toUpperCase(),
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || it.price || 0),
          totalPrice: Number(it.totalPrice ?? (Number(it.unitPrice || it.price || 0) * (it.quantity || 1))),
          discountAmount: Number(it.itemDiscountAmount || 0),
          notes: it.notes || it.specialInstructions || '',
          modifiers: it.modifiers || it.customization || [],
          constituents: components.map((comp: any) => ({
            productId: comp.productId,
            name: comp.name || comp.productName,
            quantity: Number(comp.quantity || 1),
            unit: comp.unit || 'pcs',
            unitPrice: Number(comp.unitPrice || 0),
          })),
          packaging: prod?.packaging || {
            name: it.packagingSkuId || 'Standard Eco Food Box',
            quantity: Number(it.packagingQuantity || 1),
          },
          recipeBOM: recipe ? recipe.ingredients.map((ing) => ({
            ingredientId: ing.ingredientItemId,
            ingredientName: ing.ingredientName,
            quantity: `${ing.quantity} ${ing.unit}`,
            portionCost: ing.calculatedCost,
          })) : [],
        };
      });

      const tenders: any[] = [];
      if (check?.payments && Array.isArray(check.payments) && check.payments.length > 0) {
        tenders.push(...check.payments);
      } else if (linkedOrder?.payments && Array.isArray(linkedOrder.payments) && linkedOrder.payments.length > 0) {
        tenders.push(...linkedOrder.payments);
      } else if (check?.splitPayments && Array.isArray(check.splitPayments) && check.splitPayments.length > 0) {
        tenders.push(...check.splitPayments);
      } else {
        const method = linkedOrder?.paymentMethod || check?.paymentMethod || 'cash';
        const total = Number(linkedOrder?.total ?? check?.total ?? 0);
        tenders.push({
          method,
          amount: total,
          reference: linkedOrder?.paymentReference || linkedOrder?.pickupAuthorizationCode || 'POS Cash Drawer',
          cashierName: check?.openedByName || linkedOrder?.cashierName || 'Staff',
          timestamp: check?.openedAt || linkedOrder?.createdAt || new Date().toISOString(),
        });
      }

      const stockDeductions: any[] = [];
      for (const item of enrichedItems) {
        for (const ing of item.recipeBOM) {
          stockDeductions.push({
            ingredient: ing.ingredientName,
            quantity: ing.quantity,
            forItem: item.name,
            timestamp: check?.openedAt || linkedOrder?.createdAt || new Date().toISOString(),
          });
        }
      }

      const searchTerms = [targetId, linkedOrder?.orderNumber, linkedOrder?.id, check?.checkNumber, check?.id].filter(Boolean);
      const auditTrail = ((db.auditTrail || []) as any[]).filter((a: any) =>
        searchTerms.some((term) => (a.details || '').includes(term) || (a.metadata && JSON.stringify(a.metadata).includes(term)))
      );

      const payload = {
        receiptNumber: linkedOrder?.orderNumber || check?.checkNumber || targetId,
        orderId: linkedOrder?.id,
        checkId: check?.id,
        branchId: receiptBranch.toUpperCase(),
        branchName: db.branches?.[receiptBranch]?.name || `Choplife ${receiptBranch.toUpperCase()}`,
        channel: linkedOrder ? (linkedOrder.orderChannel === 'pos_counter' ? 'POS Counter' : 'Online Web Storefront') : 'POS Check',
        serviceType: (linkedOrder?.orderType || check?.checkType || 'takeaway').toUpperCase(),
        status: (linkedOrder?.paymentStatus || check?.paymentStatus || linkedOrder?.status || check?.status || 'SETTLED').toUpperCase(),
        timestamps: {
          openedAt: check?.openedAt || linkedOrder?.createdAt,
          sentToKitchenAt: check?.sentToKitchenAt || linkedOrder?.createdAt,
          paidAt: check?.paidAt || linkedOrder?.updatedAt || check?.closedAt,
          closedAt: check?.closedAt,
        },
        customer: {
          name: linkedOrder?.deliveryDetails?.customerName || linkedOrder?.customerName || check?.customerName || 'Walk-in Patron',
          phone: linkedOrder?.deliveryDetails?.customerPhone || linkedOrder?.customerPhone || check?.customerPhone || 'N/A',
          tableNumber: check?.tableNumber || check?.tableId || linkedOrder?.tableNumber || 'N/A (Takeaway/Delivery)',
          address: linkedOrder?.deliveryDetails?.deliveryAddress || linkedOrder?.deliveryDetails?.address || 'N/A',
        },
        staff: {
          openedByName: check?.openedByName || 'System Automation',
          cashierName: check?.settledByName || check?.cashierName || linkedOrder?.cashierName || check?.openedByName || 'Staff Cashier',
          waiterName: check?.assignedStaffName || 'Waitstaff',
          approverName: check?.discountApprovedBy || 'Authorized',
          riderName: linkedOrder?.riderName || linkedOrder?.deliveryDetails?.assignedRiderName || 'N/A',
        },
        financials: {
          grossSubtotal: Number(linkedOrder?.subtotal ?? check?.subtotal ?? 0),
          discountAmount: Number(linkedOrder?.discount ?? check?.discountAmount ?? 0),
          discountReason: linkedOrder?.appliedCouponCode || check?.discountReason || 'N/A',
          packagingFee: Number(linkedOrder?.packagingFee ?? check?.packagingFee ?? 0),
          deliveryFee: Number(linkedOrder?.deliveryFee ?? check?.deliveryFee ?? 0),
          taxAmount: 0,
          total: Number(linkedOrder?.total ?? check?.total ?? 0),
          amountPaid: Number(check?.amountPaid ?? (linkedOrder?.paymentStatus === 'paid' ? linkedOrder.total : 0)),
          remainingBalance: Number(check?.remainingBalance ?? 0),
        },
        items: enrichedItems,
        tenders,
        splitShares: check?.splitConfig?.shares || [],
        stockDeductions,
        auditTrail,
      };

      res.json(payload);
    } catch (err: any) {
      console.error('[RECEIPT DETAIL ERROR]', err);
      res.status(500).json({ error: err?.message || 'Failed to fetch receipt details.' });
    }
  });

  // POST /api/reports/generate
  router.post('/api/reports/generate', requireAuth, async (req: Request, res: Response) => {
    try {
      const db = getDb() as any;
      const staff = (req as any).staff as DbStaffAccount;
      const {
        reportCode: rawReportCode,
        reportId,
        branchId,
        dateFrom,
        dateTo,
        payPeriod,
        includeUnmaskedBankDetails,
      } = req.body || {};
      const reportCode = rawReportCode || reportId || 'report.sales_summary';

      const report = ENTERPRISE_REPORT_CATALOGUE.find((r) => r.code === reportCode);
      if (!report) {
        return res.status(404).json({ error: `Report '${reportCode}' not found in enterprise catalogue.` });
      }

      if (!(await canAccessReport(staff, report))) {
        await logAuditEvent(
          staff.name,
          staff.role,
          staff.branchId || 'gra',
          'UNAUTHORIZED_REPORT_ACCESS_BLOCKED',
          `Blocked unauthorized report access attempt on '${report.title}' (${reportCode}) by ${staff.name} (${staff.role})`
        );
        return res.status(403).json({
          error: `Access denied: Role '${staff.role}' is not authorized to view '${report.title}'.`,
        });
      }

      // Enforce branch restriction if a branch-scoped user explicitly requests another branch
      if (!isGlobalRole(staff.role) && branchId && branchId !== 'all' && branchId !== staff.branchId) {
        const allowed = Array.isArray((staff as any).allowedBranchIds) ? (staff as any).allowedBranchIds : [staff.branchId];
        if (!allowed.includes(branchId)) {
          await logAuditEvent(
            staff.name,
            staff.role,
            staff.branchId || 'gra',
            'UNAUTHORIZED_REPORT_ACCESS_BLOCKED',
            `Blocked cross-branch report access attempt on '${report.title}' (requested '${branchId}', assigned '${staff.branchId}') by ${staff.name} (${staff.role})`
          );
          return res.status(403).json({
            error: `Branch scope violation: You are only authorized to access reports for branch '${(staff.branchId || 'gra').toUpperCase()}'.`,
          });
        }
      }

      const dataset = await buildReportDataset(db, staff, reportCode, {
        branchId,
        dateFrom,
        dateTo,
        payPeriod,
        includeUnmaskedBankDetails,
      });

      res.json({
        generatedAt: new Date().toISOString(),
        generatedBy: {
          name: staff.name,
          role: staff.role,
          branchScope: dataset.effectiveBranchId,
        },
        ...dataset,
      });
    } catch (err: any) {
      console.error('[REPORTS GENERATE ERROR]', err);
      res.status(500).json({ error: err?.message || 'Failed to generate report.' });
    }
  });

  // POST /api/reports/export
  router.post('/api/reports/export', requireAuth, async (req: Request, res: Response) => {
    try {
      const db = getDb() as any;
      const staff = (req as any).staff as DbStaffAccount;
      const {
        reportCode: rawReportCode,
        reportId,
        format = 'csv',
        branchId,
        dateFrom,
        dateTo,
        payPeriod,
        includeUnmaskedBankDetails = false,
      } = req.body || {};
      const reportCode = rawReportCode || reportId || 'report.sales_summary';

      const report = ENTERPRISE_REPORT_CATALOGUE.find((r) => r.code === reportCode);
      if (!report) {
        return res.status(404).json({ error: `Report '${reportCode}' not found.` });
      }

      if (!(await canAccessReport(staff, report))) {
        await logAuditEvent(
          staff.name,
          staff.role,
          staff.branchId || 'gra',
          'UNAUTHORIZED_REPORT_EXPORT_BLOCKED',
          `Blocked unauthorized export attempt on '${report.title}' (${reportCode}) by ${staff.name} (${staff.role})`
        );
        return res.status(403).json({
          error: `Forbidden: Your role (${staff.role}) does not have permission to export '${report.title}'.`,
        });
      }

      if (!isGlobalRole(staff.role) && branchId && branchId !== 'all' && branchId !== staff.branchId) {
        return res.status(403).json({
          error: `Forbidden: Branch-scoped staff cannot export data for branch '${branchId}'.`,
        });
      }

      const dataset = await buildReportDataset(db, staff, reportCode, {
        branchId,
        dateFrom,
        dateTo,
        payPeriod,
        includeUnmaskedBankDetails,
      });

      // Immutable Audit Log of Export
      await logAuditEvent(
        staff.name,
        staff.role,
        dataset.effectiveBranchId === 'all' ? staff.branchId || 'gra' : dataset.effectiveBranchId,
        'REPORT_EXPORTED',
        `Exported '${report.title}' (${reportCode}) in ${String(format).toUpperCase()} format [Branch: ${dataset.effectiveBranchId.toUpperCase()}, Rows: ${dataset.rows.length}]`,
        {
          reportCode,
          format,
          branchScope: dataset.effectiveBranchId,
          dateFrom: dateFrom || 'ALL',
          dateTo: dateTo || 'ALL',
          rowCount: dataset.rows.length,
        }
      );

      const safeFileSlug = `${reportCode.replace(/\./g, '_')}_${dataset.effectiveBranchId}_${new Date().toISOString().slice(0, 10)}`;

      if (format === 'csv') {
        const headerRow = formatCsvRow(dataset.columns.map((c) => c.label));
        const dataRows = dataset.rows.map((row) =>
          formatCsvRow(dataset.columns.map((c) => row[c.key]))
        );
        const metaHeader = [
          formatCsvRow(['Choplife Republic — Official Enterprise Report Export']),
          formatCsvRow(['Report Title', report.title, 'Domain', report.domain]),
          formatCsvRow(['Generated By', `${staff.name} (${staff.role})`, 'Branch Scope', dataset.effectiveBranchId.toUpperCase()]),
          formatCsvRow(['Date Filter', `${dateFrom || 'Inception'} to ${dateTo || 'Present'}`, 'Generated At (UTC)', new Date().toISOString()]),
          formatCsvRow(['Formula Definition', report.formulaDefinition]),
          '',
          headerRow,
          ...dataRows,
        ].join('\r\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileSlug}.csv"`);
        return res.send(metaHeader);
      }

      if (format === 'xlsx') {
        const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).getTime() : 0;
        const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : Number.MAX_SAFE_INTEGER;
        const inDateRange = (iso?: string) => {
          if (!iso) return true;
          const ms = new Date(iso).getTime();
          return !Number.isNaN(ms) && ms >= fromMs && ms <= toMs;
        };
        const matchesBranch = (b?: string) => dataset.effectiveBranchId === 'all' || !b || b === dataset.effectiveBranchId;

        const exportOrders = (Object.values(db.orders || {}) as any[]).filter(
          (o) => matchesBranch(o.branchId) && inDateRange(o.createdAt)
        );
        const exportChecks = (Object.values(db.checks || {}) as any[]).filter(
          (c) => matchesBranch(c.branchId) && inDateRange(c.openedAt || c.createdAt)
        );

        const wb = XLSX.utils.book_new();

        // 1. Executive Summary Sheet
        const summaryAoa: any[][] = [
          ['CHOPLIFE REPUBLIC — ENTERPRISE RECONCILIATION & AUDIT EXPORT'],
          [''],
          ['Report Title', sanitizeSpreadsheetCell(report.title)],
          ['Domain / Category', sanitizeSpreadsheetCell(report.domain)],
          ['Branch Scope', dataset.effectiveBranchId.toUpperCase()],
          ['Date Filter', `${dateFrom || 'Inception'} to ${dateTo || 'Present'}`],
          ['Generated By', `${sanitizeSpreadsheetCell(staff.name)} (${sanitizeSpreadsheetCell(staff.role)})`],
          ['Generated At (UTC)', new Date().toISOString()],
          ['Formula Definition', sanitizeSpreadsheetCell(report.formulaDefinition)],
          ['Security Classification', 'CONFIDENTIAL & PROPRIETARY — FINANCIAL AUDIT RECORD'],
          [''],
          ['KEY RECONCILIATION METRICS'],
          ['Metric Label', 'Metric Value'],
          ...dataset.summaryMetrics.map((m) => [sanitizeSpreadsheetCell(m.label), sanitizeSpreadsheetCell(m.value)]),
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        // 2. Primary Report Dataset Sheet
        const reportAoa: any[][] = [
          dataset.columns.map((c) => sanitizeSpreadsheetCell(c.label)),
          ...dataset.rows.map((row) =>
            dataset.columns.map((c) => {
              const val = row[c.key];
              if (typeof val === 'number') return val;
              return sanitizeSpreadsheetCell(val);
            })
          ),
        ];
        const wsData = XLSX.utils.aoa_to_sheet(reportAoa);
        XLSX.utils.book_append_sheet(wb, wsData, 'Report Data');

        // 3. Transaction Receipts Sheet (Unified orders and checks)
        const receiptHeaders = ['Ref', 'Timestamp', 'Branch', 'Channel', 'Service Mode', 'Subtotal (₦)', 'Discount (₦)', 'Packaging (₦)', 'Delivery (₦)', 'Total Paid (₦)', 'Tender', 'Status'];
        const receiptAoa: any[][] = [
          receiptHeaders,
          ...exportOrders.map((o) => [
            sanitizeSpreadsheetCell(o.orderNumber || o.id),
            (o.createdAt || '').slice(0, 16).replace('T', ' '),
            (o.branchId || 'gra').toUpperCase(),
            o.orderChannel === 'pos_counter' ? 'POS Counter' : 'Online Storefront',
            (o.orderType || 'takeaway').toUpperCase(),
            Number(o.subtotal || 0),
            Number(o.discount || 0),
            Number(o.packagingFee || 0),
            Number(o.deliveryFee || 0),
            Number(o.total || 0),
            String(o.paymentMethod || 'CASH').toUpperCase(),
            String(o.paymentStatus || 'SETTLED').toUpperCase(),
          ]),
          ...exportChecks.filter((c) => !c.orderId).map((c) => [
            sanitizeSpreadsheetCell(c.checkNumber || c.id),
            (c.openedAt || '').slice(0, 16).replace('T', ' '),
            (c.branchId || 'gra').toUpperCase(),
            'POS Check',
            (c.checkType || 'dine_in').toUpperCase(),
            Number(c.subtotal || 0),
            Number(c.discountAmount || 0),
            Number(c.packagingFee || 0),
            Number(c.deliveryFee || 0),
            Number(c.total || c.amountPaid || 0),
            String(c.paymentMethod || 'POS').toUpperCase(),
            String(c.status || 'OPEN').toUpperCase(),
          ]),
        ];
        const wsReceipts = XLSX.utils.aoa_to_sheet(receiptAoa);
        XLSX.utils.book_append_sheet(wb, wsReceipts, 'Transaction Receipts');

        // 4. Line Items & Modifiers Sheet
        const lineItemHeaders = ['Receipt Ref', 'Product Name', 'Category', 'Item Type', 'Quantity', 'Unit Price (₦)', 'Line Total (₦)', 'Discount (₦)', 'Modifiers / Notes'];
        const lineItemAoa: any[][] = [
          lineItemHeaders,
          ...exportOrders.flatMap((o) => (o.items || []).map((it: any) => [
            sanitizeSpreadsheetCell(o.orderNumber || o.id),
            sanitizeSpreadsheetCell(it.name || it.productId),
            sanitizeSpreadsheetCell(db.menuProducts?.[it.productId]?.category || 'General').toUpperCase(),
            (it.productType || (it.compositionSnapshot ? 'COMBO' : 'STANDARD')).toUpperCase(),
            Number(it.quantity || 1),
            Number(it.unitPrice || it.price || 0),
            Number(it.totalPrice ?? (Number(it.unitPrice || it.price || 0) * (it.quantity || 1))),
            Number(it.itemDiscountAmount || 0),
            sanitizeSpreadsheetCell(it.notes || it.specialInstructions || (it.compositionSnapshot ? `${it.compositionSnapshot.length} constituents` : 'None')),
          ])),
          ...exportChecks.filter((c) => !c.orderId).flatMap((c) => (c.items || []).map((it: any) => [
            sanitizeSpreadsheetCell(c.checkNumber || c.id),
            sanitizeSpreadsheetCell(it.name || it.productId),
            sanitizeSpreadsheetCell(db.menuProducts?.[it.productId]?.category || 'General').toUpperCase(),
            (it.productType || (it.compositionSnapshot ? 'COMBO' : 'STANDARD')).toUpperCase(),
            Number(it.quantity || 1),
            Number(it.unitPrice || it.price || 0),
            Number(it.totalPrice ?? (Number(it.unitPrice || it.price || 0) * (it.quantity || 1))),
            Number(it.itemDiscountAmount || 0),
            sanitizeSpreadsheetCell(it.notes || it.specialInstructions || 'None'),
          ])),
        ];
        const wsLineItems = XLSX.utils.aoa_to_sheet(lineItemAoa);
        XLSX.utils.book_append_sheet(wb, wsLineItems, 'Line Items');

        // 5. Tender Breakdown Sheet
        const tenderHeaders = ['Receipt Ref', 'Tender Method', 'Amount (₦)', 'Slip / Auth Reference', 'Cashier', 'Allocation'];
        const tenderAoa: any[][] = [
          tenderHeaders,
          ...exportOrders.map((o) => [
            sanitizeSpreadsheetCell(o.orderNumber || o.id),
            String(o.paymentMethod || 'CASH').toUpperCase(),
            Number(o.total || 0),
            sanitizeSpreadsheetCell(o.pickupAuthorizationCode || o.paymentReference || 'Storefront Authorization'),
            sanitizeSpreadsheetCell(o.cashierName || 'Storefront Automation'),
            'Full Settlement',
          ]),
          ...exportChecks.filter((c) => !c.orderId).map((c) => [
            sanitizeSpreadsheetCell(c.checkNumber || c.id),
            String(c.paymentMethod || 'POS').toUpperCase(),
            Number(c.amountPaid || c.total || 0),
            'POS Register Tender',
            sanitizeSpreadsheetCell(c.openedByName || 'Register Cashier'),
            'Single Check Settlement',
          ]),
        ];
        const wsTenders = XLSX.utils.aoa_to_sheet(tenderAoa);
        XLSX.utils.book_append_sheet(wb, wsTenders, 'Tenders');

        // 6. Audit & Control Log Sheet
        const auditHeaders = ['Audit Event', 'Actor Name', 'Actor Role', 'Branch', 'Export Timestamp (UTC)', 'Verification Stamp'];
        const auditAoa: any[][] = [
          auditHeaders,
          [
            'REPORT_EXPORTED_AUTHENTICATED',
            sanitizeSpreadsheetCell(staff.name),
            sanitizeSpreadsheetCell(staff.role).toUpperCase(),
            dataset.effectiveBranchId.toUpperCase(),
            new Date().toISOString(),
            `CL-VERIFY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          ],
        ];
        const wsAudit = XLSX.utils.aoa_to_sheet(auditAoa);
        XLSX.utils.book_append_sheet(wb, wsAudit, 'Audit & Verification');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileSlug}.xlsx"`);
        return res.send(buffer);
      }

      // Printable HTML / PDF view
      const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${report.title} — Choplife Republic</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1c1917; margin: 24px; }
    .header { border-bottom: 3px solid #800D15; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    h1 { margin: 0 0 4px 0; font-size: 20px; color: #800D15; text-transform: uppercase; }
    .meta { font-size: 12px; color: #57534e; }
    .metrics { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .metric-card { border: 1px solid #e7e5e4; background: #fafaf9; padding: 10px 14px; border-radius: 8px; min-width: 140px; }
    .metric-label { font-size: 10px; text-transform: uppercase; color: #78716c; font-weight: 700; }
    .metric-val { font-size: 16px; font-weight: 800; color: #1c1917; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #241311; color: #FFC700; text-align: left; padding: 8px; font-weight: 700; text-transform: uppercase; }
    td { border-bottom: 1px solid #e7e5e4; padding: 7px 8px; }
    tr:nth-child(even) { background: #faf7f2; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Choplife Republic — ${report.title}</h1>
      <div class="meta">${report.description}</div>
      <div class="meta"><strong>Formula:</strong> ${report.formulaDefinition}</div>
    </div>
    <div class="meta" style="text-align:right">
      <div><strong>Branch Scope:</strong> ${dataset.effectiveBranchId.toUpperCase()}</div>
      <div><strong>Generated By:</strong> ${staff.name} (${staff.role})</div>
      <div><strong>Generated At:</strong> ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC</div>
    </div>
  </div>
  <div class="metrics">
    ${dataset.summaryMetrics
      .map(
        (m) => `<div class="metric-card"><div class="metric-label">${m.label}</div><div class="metric-val">${m.value}</div></div>`
      )
      .join('')}
  </div>
  <table>
    <thead>
      <tr>${dataset.columns.map((c) => `<th class="${c.align === 'right' ? 'right' : ''}">${c.label}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${dataset.rows
        .map(
          (row) =>
            `<tr>${dataset.columns
              .map((c) => {
                const v = row[c.key];
                const formatted = typeof v === 'number' ? v.toLocaleString() : sanitizeSpreadsheetCell(v);
                return `<td class="${c.align === 'right' ? 'right' : ''}">${formatted}</td>`;
              })
              .join('')}</tr>`
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(htmlDoc);
    } catch (err: any) {
      console.error('[REPORTS EXPORT ERROR]', err);
      res.status(500).json({ error: err?.message || 'Failed to export report.' });
    }
  });

  return router;
}
