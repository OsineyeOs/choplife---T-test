import { Router, RequestHandler } from 'express';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { DbDatabase, DbStaffAccount, DbCheck, DbExpenseClaim } from '../db/schemaTypes';
import { getNextLiveCheckNumber } from './posChecksAndOfflineRouter';
import { validateProductCommercialConfig } from '../services/packageAndPricingEngine.ts';

export interface BulkImportAndMigrationRouterDeps {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: RequestHandler;
  requireRole: (roles: string[]) => RequestHandler;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    description: string
  ) => any;
  hasPermission: (staff: DbStaffAccount, permissionCode: string) => Promise<boolean>;
}

function sanitizeCell(val: any): string {
  let s = String(val ?? '').trim();
  if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) {
    s = s.replace(/^[=+\-@\t\r]+/, '');
  }
  return s;
}

function escapeXml(val: any): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds a multi-sheet Excel 2003 SpreadsheetML (.xls) workbook with Instructions + Data_Template + Controlled_Dropdown_Lists sheets
 */
function buildSpreadsheetMlWorkbook(params: {
  title: string;
  instructions: string[][];
  headers: string[];
  sampleRows: (string | number)[][];
  dataValidations?: Array<{ colIndex: number; allowedValuesCsv: string }>;
  referenceLists?: Array<{ listName: string; values: string[] }>;
}): string {
  const { title, instructions, headers, sampleRows, dataValidations = [], referenceLists = [] } = params;
  const instRowsXml = instructions
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`)
          .join('')}</Row>`
    )
    .join('\n');

  const headerRowXml = `<Row>${headers
    .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join('')}</Row>`;

  const sampleRowsXml = sampleRows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            const isNum = typeof cell === 'number' && !isNaN(cell);
            return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`;
          })
          .join('')}</Row>`
    )
    .join('\n');

  const validationsXml = dataValidations
    .map(
      (dv) => `  <DataValidation xmlns="urn:schemas-microsoft-com:office:excel">
   <Range>R2C${dv.colIndex}:R500C${dv.colIndex}</Range>
   <Type>List</Type>
   <CellRangeList/>
   <Value>&quot;${escapeXml(dv.allowedValuesCsv)}&quot;</Value>
  </DataValidation>`
    )
    .join('\n');

  let controlledListsSheetXml = '';
  if (referenceLists.length > 0) {
    const listHeaderXml = `<Row>${referenceLists
      .map((l) => `<Cell><Data ss:Type="String">${escapeXml(l.listName)}</Data></Cell>`)
      .join('')}</Row>`;
    const maxLen = Math.max(0, ...referenceLists.map((l) => l.values.length));
    const listRows: string[] = [];
    for (let r = 0; r < maxLen; r++) {
      const cells = referenceLists
        .map((l) => `<Cell><Data ss:Type="String">${escapeXml(l.values[r] || '')}</Data></Cell>`)
        .join('');
      listRows.push(`<Row>${cells}</Row>`);
    }
    controlledListsSheetXml = `
 <Worksheet ss:Name="Controlled_Dropdown_Lists">
  <Table>
   ${listHeaderXml}
   ${listRows.join('\n   ')}
  </Table>
 </Worksheet>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Data_Template">
  <Table>
   ${headerRowXml}
   ${sampleRowsXml}
  </Table>
${validationsXml}
 </Worksheet>
 <Worksheet ss:Name="Instructions_And_Rules">
  <Table>
   <Row><Cell><Data ss:Type="String">${escapeXml(title)}</Data></Cell></Row>
   ${instRowsXml}
  </Table>
 </Worksheet>${controlledListsSheetXml}
</Workbook>`;
}

/**
 * Parses CSV, TSV, or Excel SpreadsheetML XML content into an array of row objects keyed by header name
 */
export function parseTabularUploadContent(rawContent: string): Record<string, string>[] {
  const trimmed = String(rawContent || '').trim();
  if (!trimmed) return [];

  // 1. Check if SpreadsheetML XML
  if (trimmed.startsWith('<?xml') || trimmed.includes('<Workbook') || trimmed.includes('<Worksheet')) {
    const worksheetMatch = trimmed.match(/<Worksheet[^>]*ss:Name="Data_Template"[^>]*>([\s\S]*?)<\/Worksheet>/i);
    const tableScope = worksheetMatch ? worksheetMatch[1] : trimmed;
    const rowMatches = Array.from(tableScope.matchAll(/<Row[^>]*>([\s\S]*?)<\/Row>/gi));
    if (rowMatches.length < 2) return [];

    const extractCells = (rowXml: string): string[] => {
      const cells = Array.from(rowXml.matchAll(/<Data[^>]*>([\s\S]*?)<\/Data>/gi));
      return cells.map((m) =>
        m[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim()
      );
    };

    const headers = extractCells(rowMatches[0][1]).map((h) => h.trim());
    const result: Record<string, string>[] = [];
    for (let i = 1; i < rowMatches.length; i++) {
      const vals = extractCells(rowMatches[i][1]);
      if (vals.every((v) => !v)) continue;
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (h) obj[h] = vals[idx] ?? '';
      });
      result.push(obj);
    }
    return result;
  }

  // 2. Parse CSV / TSV lines
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'));
  if (lines.length < 2) return [];

  const splitCsvLine = (line: string): string[] => {
    const delimiter = line.includes('\t') && !line.includes(',') ? '\t' : ',';
    if (delimiter === '\t') return line.split('\t').map((c) => c.trim());
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCsvLine(lines[i]);
    if (vals.every((v) => !v)) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = vals[idx] ?? '';
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Parses binary Excel workbook (.xlsx, .xls) buffer or base64 string into sheets and rows
 */
export function parseBinaryWorkbook(base64OrBuffer: string | Buffer): {
  sheetNames: string[];
  sheets: Record<string, { headers: string[]; rows: Record<string, any>[]; rowCount: number }>;
} {
  const buffer = Buffer.isBuffer(base64OrBuffer)
    ? base64OrBuffer
    : Buffer.from(String(base64OrBuffer).replace(/^data:[^;]+;base64,/, ''), 'base64');

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = workbook.SheetNames || [];
  const sheets: Record<string, { headers: string[]; rows: Record<string, any>[]; rowCount: number }> = {};

  for (const name of sheetNames) {
    const ws = workbook.Sheets[name];
    if (!ws) continue;
    const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

    const headerRow: string[] = [];
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        if (cell && cell.v !== undefined) {
          headerRow.push(String(cell.v).trim());
        }
      }
    }
    const headers = headerRow.length > 0 ? headerRow : (jsonRows.length > 0 ? Object.keys(jsonRows[0]) : []);

    const sanitizedRows = jsonRows.map((row) => {
      const cleanRow: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        cleanRow[sanitizeCell(k)] = sanitizeCell(v);
      }
      return cleanRow;
    });

    sheets[name] = {
      headers,
      rows: sanitizedRows,
      rowCount: sanitizedRows.length,
    };
  }

  return { sheetNames, sheets };
}

const EZEE_OUTLET_MAP: Record<string, 'gra' | 'okabere' | 'ugbowo'> = {
  gra: 'gra',
  'gra flagship': 'gra',
  'ezee gra flagship': 'gra',
  '8a okogo': 'gra',
  okabere: 'okabere',
  'okabere hub': 'okabere',
  'upper sapele': 'okabere',
  'ezee okabere': 'okabere',
  ugbowo: 'ugbowo',
  'ugbowo campus': 'ugbowo',
  'ezee ugbowo': 'ugbowo',
};

const EZEE_PAYMENT_MAP: Record<string, 'cash' | 'pos_terminal' | 'bank_transfer' | 'online'> = {
  cash: 'cash',
  'ngn cash': 'cash',
  pos: 'pos_terminal',
  'pos_terminal': 'pos_terminal',
  'pos card': 'pos_terminal',
  'moniepoint pos': 'pos_terminal',
  card: 'pos_terminal',
  transfer: 'bank_transfer',
  'bank_transfer': 'bank_transfer',
  'bank transfer': 'bank_transfer',
  online: 'online',
  paystack: 'online',
};

export function createBulkImportAndMigrationRouter(deps: BulkImportAndMigrationRouterDeps): Router {
  const router = Router();
  const { getDb, saveDatabaseSync, requireAuth, requireRole, logAuditEvent, hasPermission } = deps;

  // ============================================================================
  // PART 7 & 8: CAPEX / OPEX BUDGET TARGETS & VARIANCE GOVERNANCE
  // ============================================================================
  router.get(
    '/api/expenditures/budgets',
    requireAuth,
    async (req, res) => {
      const db = getDb() as any;
      const staff = (req as any).staff as DbStaffAccount;

      if (!(await hasPermission(staff, 'budgets.view')) && !['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'accountant', 'auditor'].includes(staff.role)) {
        return res.status(403).json({ error: 'Access denied: Budget viewing requires budgets.view privilege.' });
      }
      db.expenditureBudgets = db.expenditureBudgets || {
        gra: { monthlyOpexLimit: 1850000, monthlyCapexLimit: 750000 },
        okabere: { monthlyOpexLimit: 1250000, monthlyCapexLimit: 450000 },
        ugbowo: { monthlyOpexLimit: 950000, monthlyCapexLimit: 350000 },
      };

      const claims = Object.values(db.expenseClaims || {}) as DbExpenseClaim[];
      const activeClaims = claims.filter((c) =>
        ['approved', 'payment_pending', 'partially_paid', 'paid', 'reconciled'].includes(c.status)
      );

      const branchSummary: Record<
        string,
        {
          branchId: string;
          monthlyOpexLimit: number;
          monthlyCapexLimit: number;
          actualOpex: number;
          actualCapex: number;
          actualInventoryStock: number;
          opexUtilizationPct: number;
          capexUtilizationPct: number;
          opexVarianceNaira: number;
          capexVarianceNaira: number;
        }
      > = {};

      for (const bId of ['gra', 'okabere', 'ugbowo']) {
        const cfg = db.expenditureBudgets[bId] || { monthlyOpexLimit: 1000000, monthlyCapexLimit: 400000 };
        const bClaims = activeClaims.filter((c) => (c.operatingBranchId || c.homeBranchId) === bId);
        let actualOpex = 0;
        let actualCapex = 0;
        let actualInventoryStock = 0;

        for (const clm of bClaims) {
          const amt = Number(clm.approvedAmount ?? clm.totalAmount ?? 0);
          if (clm.accountingClassification === 'fixed_asset') {
            actualCapex += amt;
          } else if (clm.accountingClassification === 'inventory_purchase') {
            actualInventoryStock += amt;
          } else {
            actualOpex += amt;
          }
        }

        branchSummary[bId] = {
          branchId: bId,
          monthlyOpexLimit: cfg.monthlyOpexLimit,
          monthlyCapexLimit: cfg.monthlyCapexLimit,
          actualOpex,
          actualCapex,
          actualInventoryStock,
          opexUtilizationPct:
            cfg.monthlyOpexLimit > 0 ? Number(((actualOpex / cfg.monthlyOpexLimit) * 100).toFixed(1)) : 0,
          capexUtilizationPct:
            cfg.monthlyCapexLimit > 0 ? Number(((actualCapex / cfg.monthlyCapexLimit) * 100).toFixed(1)) : 0,
          opexVarianceNaira: cfg.monthlyOpexLimit - actualOpex,
          capexVarianceNaira: cfg.monthlyCapexLimit - actualCapex,
        };
      }

      res.json({
        budgets: db.expenditureBudgets,
        branchVariance: Object.values(branchSummary),
      });
    }
  );

  router.put(
    '/api/expenditures/budgets',
    requireAuth,
    async (req, res) => {
      const db = getDb() as any;
      const staff = (req as any).staff as DbStaffAccount;

      if (!(await hasPermission(staff, 'budgets.manage')) && !['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(staff.role)) {
        return res.status(403).json({ error: 'Access denied: Budget management requires budgets.manage privilege.' });
      }
      const currentStaff = staff;
      const { branchId, monthlyOpexLimit, monthlyCapexLimit } = req.body || {};
      if (!branchId || !['gra', 'okabere', 'ugbowo'].includes(branchId)) {
        return res.status(400).json({ error: 'Valid branchId (gra, okabere, ugbowo) is required.' });
      }
      db.expenditureBudgets = db.expenditureBudgets || {};
      db.expenditureBudgets[branchId] = {
        monthlyOpexLimit: Math.max(0, Number(monthlyOpexLimit) || 0),
        monthlyCapexLimit: Math.max(0, Number(monthlyCapexLimit) || 0),
        updatedAt: new Date().toISOString(),
        updatedBy: currentStaff.name,
      };
      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        branchId,
        'BUDGET_TARGET_UPDATED',
        `Updated ${branchId.toUpperCase()} monthly budgets: OPEX ₦${db.expenditureBudgets[branchId].monthlyOpexLimit.toLocaleString()}, CAPEX ₦${db.expenditureBudgets[branchId].monthlyCapexLimit.toLocaleString()}`
      );
      res.json({ success: true, budgets: db.expenditureBudgets });
    }
  );

  // ============================================================================
  // PART 9: EXCEL / SPREADSHEET TEMPLATE DOWNLOAD & VALIDATED BULK IMPORT
  // ============================================================================
  router.get('/api/import/templates/:module', requireAuth, (req, res) => {
    const { module } = req.params;
    const format = String(req.query.format || 'xls').toLowerCase();

    if (module === 'inventory') {
      const headers = [
        'sku',
        'name',
        'category',
        'itemType',
        'unit',
        'purchaseUnit',
        'conversionFactor',
        'costPerUnit',
        'sellingPrice',
        'reorderLevel',
        'reorderQty',
        'openingBalance',
        'branchId',
        'storageArea',
        'supplierName',
        'isActive',
      ];
      const sampleRows = [
        [
          'SKU-PRO-901',
          'Fresh Goat Meat (Carcass Cut)',
          'proteins',
          'raw_material',
          'kg',
          'kg',
          1,
          5200,
          0,
          15,
          40,
          25,
          'gra',
          'cold_room',
          'Benin Abattoir Prime',
          'true',
        ],
        [
          'SKU-BAK-902',
          'High-Gluten Bread Flour (50kg Bag)',
          'bakery',
          'raw_material',
          'kg',
          'bag',
          50,
          1350,
          0,
          50,
          150,
          100,
          'okabere',
          'dry_store',
          'Crown Flour Mills',
          'true',
        ],
      ];
      const instructions = [
        ['Field Name', 'Required?', 'Allowed Values / Validation Rules'],
        ['sku', 'Optional (Auto-generated if blank)', 'Unique alphanumeric code e.g. SKU-PRO-901'],
        ['name', 'REQUIRED', 'Item display name (non-empty text)'],
        ['category', 'REQUIRED', 'proteins | grains_oil | produce | bakery | drinks | packaging | cleaning_fuel'],
        ['itemType', 'Optional', 'raw_material | packaging | finished_good | consumable'],
        ['unit', 'REQUIRED', 'kg | g | litre | cl | pcs | pack | crate | tuber'],
        ['costPerUnit', 'REQUIRED', 'Numeric NGN cost >= 0'],
        ['reorderLevel', 'Optional', 'Numeric minimum threshold >= 0 (default 10)'],
        ['openingBalance', 'Optional', 'Initial stock quantity >= 0'],
        ['branchId', 'REQUIRED', 'gra | okabere | ugbowo | general_store'],
      ];

      if (format === 'csv') {
        const csvLines = [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="choplife_inventory_import_template.csv"');
        return res.send(csvLines);
      }

      const xml = buildSpreadsheetMlWorkbook({
        title: 'Choplife Republic — Master Inventory & Opening Stock Import Template (v1.0)',
        instructions,
        headers,
        sampleRows,
      });
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="choplife_inventory_import_template.xls"');
      return res.send(xml);
    }

    if (module === 'expenses' || module === 'expenditures') {
      const headers = [
        'expenseDate',
        'branchId',
        'claimType',
        'accountingClassification',
        'categoryId',
        'title',
        'description',
        'vendorName',
        'receiptOrInvoiceRef',
        'netAmount',
        'vatAmount',
        'whtAmount',
        'paymentMethodUsed',
        'department',
      ];
      const sampleRows = [
        [
          new Date().toISOString().slice(0, 10),
          'gra',
          'company_funded_expense',
          'opex',
          'cat_diesel_power',
          'AGO Diesel Delivery (200 Litres)',
          'Emergency generator diesel top-up for GRA Flagship weekend shift',
          'Matrix Energy Benin',
          'INV-MAT-2026-881',
          260000,
          0,
          0,
          'company_bank_transfer',
          'Facilities & Power',
        ],
        [
          new Date().toISOString().slice(0, 10),
          'okabere',
          'company_funded_expense',
          'fixed_asset',
          'cat_equipment_repairs',
          'Commercial Stainless Suya Grill Hood',
          'Capital expenditure (CAPEX) hood installation at Okabere Hub',
          'Edo Industrial Fabricators',
          'INV-EDO-2026-104',
          420000,
          31500,
          0,
          'company_bank_transfer',
          'Kitchen & Operations',
        ],
      ];
      const instructions = [
        ['Field Name', 'Required?', 'Allowed Values / Validation Rules'],
        ['expenseDate', 'REQUIRED', 'YYYY-MM-DD in Africa/Lagos timezone'],
        ['branchId', 'REQUIRED', 'gra | okabere | ugbowo'],
        ['claimType', 'REQUIRED', 'reimbursement_claim | company_funded_expense | cash_advance'],
        ['accountingClassification', 'REQUIRED', 'opex | fixed_asset | inventory_purchase | prepaid_expense'],
        ['categoryId', 'REQUIRED', 'cat_kitchen_ingredients | cat_diesel_power | cat_packaging_disposables | cat_equipment_repairs | cat_dispatch_fuel | cat_cleaning_sanitation | cat_staff_welfare_medical | cat_regulatory_permits'],
        ['title', 'REQUIRED', 'Short expenditure title'],
        ['vendorName', 'REQUIRED', 'Supplier or vendor name'],
        ['receiptOrInvoiceRef', 'REQUIRED', 'Unique invoice/receipt reference for duplicate prevention'],
        ['netAmount', 'REQUIRED', 'Numeric NGN amount > 0'],
      ];

      if (format === 'csv') {
        const csvLines = [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="choplife_expenditure_import_template.csv"');
        return res.send(csvLines);
      }

      const xml = buildSpreadsheetMlWorkbook({
        title: 'Choplife Republic — Expense Claims, OPEX & CAPEX Bulk Import Template (v1.0)',
        instructions,
        headers,
        sampleRows,
        dataValidations: [
          { colIndex: 2, allowedValuesCsv: 'gra,okabere,ugbowo' },
          { colIndex: 3, allowedValuesCsv: 'reimbursement_claim,company_funded_expense,cash_advance' },
          { colIndex: 4, allowedValuesCsv: 'opex,fixed_asset,inventory_purchase,prepaid_expense' },
        ],
      });
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="choplife_expenditure_import_template.xls"');
      return res.send(xml);
    }

    if (module === 'menu' || module === 'catalogue') {
      const db = getDb() as any;
      const categoryIds = Object.keys(db.categories || {});
      const allowedCategories = categoryIds.length > 0 ? categoryIds : ['meals', 'grill', 'small-chops', 'bakery', 'drinks', 'combos'];
      const productIds = Object.keys(db.menuProducts || {}).slice(0, 60);

      const headers = [
        'id',
        'name',
        'category',
        'productType',
        'basePrice',
        'status',
        'channels',
        'branchAvailability',
        'componentsSpec',
        'discountType',
        'discountValue',
        'wholesaleEnabled',
        'minWholesaleQty',
        'wholesalePrice',
        'promoQualifyingProductId',
        'promoMinQty',
        'promoRewardProductId',
        'promoRewardQty',
        'shortDescription',
      ];

      const sampleRows: (string | number)[][] = [
        [
          'prod-sc-2000-mini',
          '2000 Mini Pack',
          'small-chops',
          'package',
          2000,
          'published',
          'website|pos',
          'gra|okabere|ugbowo',
          'prod-snack-puff-puff-single:3|prod-snack-samosa-single:1|prod-snack-springroll-single:1|prod-sc-beef-single:1',
          '',
          0,
          'false',
          0,
          0,
          '',
          0,
          '',
          0,
          '3 Puff-Puff, 1 Samosa, 1 Spring Roll, and 1 Peppered Beef.',
        ],
        [
          'prod-bakery-special-350g',
          'ChopLife Special Bread (Small 350g)',
          'bakery',
          'standard',
          500,
          'published',
          'website|pos',
          'gra|okabere|ugbowo',
          '',
          '',
          0,
          'true',
          20,
          400,
          '',
          0,
          '',
          0,
          'Soft, golden buttery loaf baked fresh daily.',
        ],
      ];

      const instructions = [
        ['Field Name', 'Required?', 'Allowed Values / Validation Rules'],
        ['id', 'Optional (Auto-generated if blank)', 'Unique product ID (e.g. prod-sc-2000-mini). Existing ID updates the item; new ID creates it.'],
        ['name', 'REQUIRED', 'Product display name'],
        ['category', 'REQUIRED (Dropdown)', allowedCategories.join(' | ')],
        ['productType', 'REQUIRED (Dropdown)', 'standard | combo | platter | package | promotion'],
        ['basePrice', 'REQUIRED', 'Numeric NGN selling price >= 0'],
        ['status', 'REQUIRED (Dropdown)', 'published | draft | archived'],
        ['channels', 'Optional', 'Pipe-separated channels: website|pos'],
        ['branchAvailability', 'Optional', 'Pipe-separated active branches: gra|okabere|ugbowo'],
        ['componentsSpec', 'Required for package/combo/platter', 'Pipe-separated componentProductId:qty pairs, e.g. prod-snack-puff-puff-single:3|prod-snack-samosa-single:1|prod-snack-springroll-single:1|prod-sc-beef-single:1'],
        ['discountType', 'Optional (Dropdown)', 'percentage | fixed (leave blank if no active discount)'],
        ['discountValue', 'Optional', 'Numeric discount value (percentage 0-100 or fixed NGN amount)'],
        ['wholesaleEnabled', 'Optional (Dropdown)', 'true | false (for Bread / Bulk products)'],
        ['minWholesaleQty', 'Optional', 'Minimum quantity threshold for wholesale price (e.g. 20)'],
        ['wholesalePrice', 'Optional', 'Discounted wholesale unit price in NGN (e.g. 400)'],
        ['promoQualifyingProductId', 'Optional', 'Qualifying product ID for conditional free-item promotion'],
        ['promoMinQty', 'Optional', 'Minimum qualifying quantity to trigger free item'],
        ['promoRewardProductId', 'Optional', 'Free reward product ID granted when promotion qualifies'],
        ['promoRewardQty', 'Optional', 'Free reward quantity granted per qualifying order'],
        ['shortDescription', 'Optional', 'Customer-facing short menu description'],
      ];

      if (format === 'csv') {
        const csvLines = [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="choplife_menu_catalogue_template.csv"');
        return res.send(csvLines);
      }

      const xml = buildSpreadsheetMlWorkbook({
        title: 'Choplife Republic — Menu, Packages, Wholesale Bread & Promotions Template (v2.0)',
        instructions,
        headers,
        sampleRows,
        dataValidations: [
          { colIndex: 3, allowedValuesCsv: allowedCategories.join(',') },
          { colIndex: 4, allowedValuesCsv: 'standard,combo,platter,package,promotion' },
          { colIndex: 6, allowedValuesCsv: 'published,draft,archived' },
          { colIndex: 10, allowedValuesCsv: 'percentage,fixed' },
          { colIndex: 12, allowedValuesCsv: 'true,false' },
        ],
        referenceLists: [
          { listName: 'Allowed_Categories', values: allowedCategories },
          { listName: 'Allowed_Product_Types', values: ['standard', 'combo', 'platter', 'package', 'promotion'] },
          { listName: 'Allowed_Statuses', values: ['published', 'draft', 'archived'] },
          { listName: 'Allowed_Branches', values: ['gra', 'okabere', 'ugbowo'] },
          { listName: 'Allowed_Channels', values: ['website', 'pos', 'website|pos'] },
          { listName: 'Reference_Product_IDs', values: productIds },
        ],
      });
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="choplife_menu_catalogue_template.xls"');
      return res.send(xml);
    }

    if (module === 'market_list' || module === 'market-list') {
      const headers = [
        'sku',
        'itemName',
        'category',
        'branchId',
        'unit',
        'requestedQty',
        'estimatedUnitCost',
        'supplierName',
        'priority',
        'notes',
      ];
      const sampleRows: (string | number)[][] = [
        ['SKU-PRO-001', 'Fresh Beef (Boneless)', 'proteins', 'gra', 'kg', 30, 5200, 'Benin Abattoir Prime', 'high', 'Weekend grill & small chops prep'],
        ['SKU-GRA-002', 'Vegetable Cooking Oil (25L Keg)', 'grains_oil', 'gra', 'litre', 50, 2100, 'New Benin Market Bulk', 'normal', 'Main kitchen fryer replenishment'],
      ];
      const instructions = [
        ['Field Name', 'Required?', 'Allowed Values / Validation Rules'],
        ['sku', 'Optional', 'Existing inventory SKU or item ID (matched by SKU or itemName)'],
        ['itemName', 'REQUIRED', 'Name of market item to purchase'],
        ['category', 'Optional', 'proteins | grains_oil | produce | bakery | drinks | packaging | cleaning_fuel'],
        ['branchId', 'REQUIRED', 'gra | okabere | ugbowo | general_store'],
        ['unit', 'REQUIRED', 'kg | g | litre | pcs | pack | crate | bag'],
        ['requestedQty', 'REQUIRED', 'Positive quantity > 0'],
        ['estimatedUnitCost', 'REQUIRED', 'Estimated unit cost in NGN >= 0'],
        ['supplierName', 'Optional', 'Preferred market vendor or supplier'],
      ];

      if (format === 'csv') {
        const csvLines = [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="choplife_market_list_template.csv"');
        return res.send(csvLines);
      }

      const xml = buildSpreadsheetMlWorkbook({
        title: 'Choplife Republic — Market List & Procurement Request Template (v1.0)',
        instructions,
        headers,
        sampleRows,
      });
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="choplife_market_list_template.xls"');
      return res.send(xml);
    }

    if (module === 'stock_update' || module === 'stock-update' || module === 'stock_count') {
      const headers = [
        'sku',
        'itemName',
        'branchId',
        'unit',
        'physicalCountedQty',
        'unitCost',
        'reason',
      ];
      const sampleRows: (string | number)[][] = [
        ['ing-beef', 'Fresh Beef', 'gra', 'kg', 42, 4800, 'End-of-week physical cold room count'],
        ['ing-flour', 'All-Purpose Flour', 'gra', 'kg', 115, 1350, 'Weekly dry store cycle count'],
      ];
      const instructions = [
        ['Field Name', 'Required?', 'Allowed Values / Validation Rules'],
        ['sku', 'REQUIRED', 'Inventory Item ID or SKU code'],
        ['itemName', 'Optional', 'Display name for reference'],
        ['branchId', 'REQUIRED', 'gra | okabere | ugbowo | general_store'],
        ['unit', 'Optional', 'Unit of measurement (must match item base unit if provided)'],
        ['physicalCountedQty', 'REQUIRED', 'Non-negative physical stock count >= 0'],
        ['unitCost', 'Optional', 'Updated unit cost in NGN (optional)'],
        ['reason', 'REQUIRED', 'Audit note for stock count / adjustment'],
      ];

      if (format === 'csv') {
        const csvLines = [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="choplife_stock_count_update_template.csv"');
        return res.send(csvLines);
      }

      const xml = buildSpreadsheetMlWorkbook({
        title: 'Choplife Republic — Physical Stock Count & Balance Update Template (v1.0)',
        instructions,
        headers,
        sampleRows,
      });
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="choplife_stock_count_update_template.xls"');
      return res.send(xml);
    }

    return res.status(400).json({ error: `Unsupported template module: ${module}` });
  });

  // Validate Bulk Import (Dry-Run Preview without writing to DB)
  router.post(
    '/api/import/:module/validate',
    requireAuth,
    async (req, res) => {
      const { module } = req.params;
      const db = getDb() as any;
      const currentStaff = (req as any).staff as DbStaffAccount;

      if (!(await hasPermission(currentStaff, 'import.validate')) && !['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'store_manager', 'menu_manager', 'storekeeper', 'accountant'].includes(currentStaff.role)) {
        return res.status(403).json({ error: 'Access denied: Bulk import validation requires import.validate privilege.' });
      }

      let rawRows: any[] = [];
      if (Array.isArray(req.body?.rows)) {
        rawRows = req.body.rows;
      } else if (typeof req.body?.fileBase64 === 'string') {
        const wb = parseBinaryWorkbook(req.body.fileBase64);
        const targetSheet = req.body?.sheetName || wb.sheetNames[0];
        rawRows = wb.sheets[targetSheet]?.rows || [];
      } else if (typeof req.body?.rawContent === 'string') {
        rawRows = parseTabularUploadContent(req.body.rawContent);
      } else {
        return res.status(400).json({ error: 'Provide either rows array, fileBase64 string (.xlsx/.xls), or rawContent string (CSV/Excel XML).' });
      }

      const validRows: any[] = [];
      const invalidRows: { rowNumber: number; rowData: any; errors: string[] }[] = [];
      const warnings: { rowNumber: number; message: string }[] = [];

      if (module === 'inventory') {
        const existingSkus = new Set(
          Object.values(db.inventory || {}).map((it: any) => String(it.sku || it.id || '').toUpperCase())
        );
        const batchSkus = new Set<string>();

        rawRows.forEach((row, idx) => {
          const rowNumber = idx + 2;
          const errors: string[] = [];
          const name = sanitizeCell(row.name || row.itemName || row.Item_Name);
          const category = sanitizeCell(row.category || row.Category || 'ingredients').toLowerCase();
          const unit = sanitizeCell(row.unit || row.baseUnit || row.Unit || 'kg').toLowerCase();
          const branchId = sanitizeCell(row.branchId || row.locationId || currentStaff.branchId || 'gra').toLowerCase();
          const costPerUnit = Number(row.costPerUnit ?? row.unitCost ?? 0);
          const sellingPrice = Number(row.sellingPrice ?? 0);
          const reorderLevel = Number(row.reorderLevel ?? row.minThreshold ?? 10);
          const reorderQty = Number(row.reorderQty ?? row.parLevel ?? 40);
          const openingBalance = Number(row.openingBalance ?? row.initialStock ?? 0);

          if (!name) errors.push('Missing required item name.');
          if (isNaN(costPerUnit) || costPerUnit < 0) errors.push('costPerUnit must be a non-negative number.');
          if (isNaN(reorderLevel) || reorderLevel < 0) errors.push('reorderLevel must be a non-negative number.');
          if (isNaN(openingBalance) || openingBalance < 0) errors.push('openingBalance cannot be negative.');
          if (!['gra', 'okabere', 'ugbowo', 'general_store'].includes(branchId)) {
            errors.push(`Invalid branchId "${branchId}". Allowed: gra, okabere, ugbowo, general_store.`);
          }

          let sku = sanitizeCell(row.sku || row.SKU || '').toUpperCase();
          if (!sku) {
            const catPrefix = category.slice(0, 3).toUpperCase() || 'INV';
            sku = `SKU-${catPrefix}-${String(existingSkus.size + idx + 101).padStart(3, '0')}`;
            warnings.push({ rowNumber, message: `Auto-generated SKU ${sku} for "${name}"` });
          } else {
            if (existingSkus.has(sku)) {
              errors.push(`Duplicate SKU "${sku}" already exists in Master Inventory.`);
            }
            if (batchSkus.has(sku)) {
              errors.push(`Duplicate SKU "${sku}" repeated within this upload file.`);
            }
          }

          if (errors.length > 0) {
            invalidRows.push({ rowNumber, rowData: row, errors });
          } else {
            batchSkus.add(sku);
            validRows.push({
              rowNumber,
              sku,
              name,
              category,
              itemType: sanitizeCell(row.itemType || 'raw_material'),
              unit,
              purchaseUnit: sanitizeCell(row.purchaseUnit || unit),
              conversionFactor: Math.max(1, Number(row.conversionFactor) || 1),
              costPerUnit,
              sellingPrice: Math.max(0, sellingPrice || 0),
              reorderLevel,
              reorderQty,
              openingBalance,
              branchId,
              storageArea: sanitizeCell(row.storageArea || 'dry_store'),
              supplierName: sanitizeCell(row.supplierName || ''),
              isActive: String(row.isActive ?? 'true').toLowerCase() !== 'false',
            });
          }
        });
      } else if (module === 'expenses' || module === 'expenditures') {
        const existingClaims = Object.values(db.expenseClaims || {}) as DbExpenseClaim[];
        const batchInvoiceKeys = new Set<string>();

        rawRows.forEach((row, idx) => {
          const rowNumber = idx + 2;
          const errors: string[] = [];
          const title = sanitizeCell(row.title || row.Title);
          const description = sanitizeCell(row.description || row.Description || title);
          const branchId = sanitizeCell(row.branchId || currentStaff.branchId || 'gra').toLowerCase();
          const claimType = sanitizeCell(row.claimType || 'company_funded_expense');
          const accountingClassification = sanitizeCell(row.accountingClassification || 'opex');
          const categoryId = sanitizeCell(row.categoryId || 'cat_kitchen_ingredients');
          const vendorName = sanitizeCell(row.vendorName || '');
          const receiptOrInvoiceRef = sanitizeCell(row.receiptOrInvoiceRef || '');
          const expenseDate = sanitizeCell(row.expenseDate || new Date().toISOString().slice(0, 10));
          const netAmount = Number(row.netAmount ?? row.amount ?? 0);
          const vatAmount = Math.max(0, Number(row.vatAmount ?? 0));
          const whtAmount = Math.max(0, Number(row.whtAmount ?? 0));
          const totalAmount = Math.round((netAmount + vatAmount - whtAmount) * 100) / 100;

          if (!title) errors.push('Missing required expenditure title.');
          if (!['gra', 'okabere', 'ugbowo'].includes(branchId)) {
            errors.push(`Invalid branchId "${branchId}". Allowed: gra, okabere, ugbowo.`);
          }
          if (!['reimbursement_claim', 'company_funded_expense', 'cash_advance'].includes(claimType)) {
            errors.push(`Invalid claimType "${claimType}".`);
          }
          if (!['opex', 'fixed_asset', 'inventory_purchase', 'prepaid_expense'].includes(accountingClassification)) {
            errors.push(`Invalid accountingClassification "${accountingClassification}".`);
          }
          if (isNaN(netAmount) || netAmount <= 0) {
            errors.push('netAmount must be a positive number (> 0).');
          }

          if (vendorName && receiptOrInvoiceRef) {
            const dupKey = `${vendorName.toLowerCase()}::${receiptOrInvoiceRef.toLowerCase()}::${totalAmount}`;
            const existsInDb = existingClaims.some(
              (c) =>
                c.status !== 'cancelled' &&
                c.status !== 'rejected' &&
                (c.vendorName || '').toLowerCase() === vendorName.toLowerCase() &&
                (c.receiptOrInvoiceRef || '').toLowerCase() === receiptOrInvoiceRef.toLowerCase()
            );
            if (existsInDb) {
              errors.push(`Duplicate invoice/receipt reference "${receiptOrInvoiceRef}" for vendor "${vendorName}" already exists.`);
            }
            if (batchInvoiceKeys.has(dupKey)) {
              errors.push(`Duplicate invoice/receipt "${receiptOrInvoiceRef}" repeated inside this upload batch.`);
            }
            batchInvoiceKeys.add(dupKey);
          }

          if (errors.length > 0) {
            invalidRows.push({ rowNumber, rowData: row, errors });
          } else {
            validRows.push({
              rowNumber,
              expenseDate,
              branchId,
              claimType,
              accountingClassification,
              categoryId,
              title,
              description,
              vendorName,
              receiptOrInvoiceRef,
              netAmount,
              vatAmount,
              whtAmount,
              totalAmount,
              paymentMethodUsed: sanitizeCell(row.paymentMethodUsed || 'company_bank_transfer'),
              department: sanitizeCell(row.department || 'Operations'),
            });
          }
        });
      } else if (module === 'menu' || module === 'catalogue') {
        db.menuProducts = db.menuProducts || {};
        db.categories = db.categories || {};
        const validCategories = new Set([
          ...Object.keys(db.categories),
          'meals',
          'grill',
          'small-chops',
          'bakery',
          'drinks',
          'combos',
        ]);
        const seenIdsInBatch = new Set<string>();

        rawRows.forEach((row, idx) => {
          const rowNumber = idx + 2;
          const errors: string[] = [];
          const name = sanitizeCell(row.name || row.productName || row.Name);
          const category = sanitizeCell(row.category || row.Category).toLowerCase();
          const productType = sanitizeCell(row.productType || 'standard').toLowerCase();
          const status = sanitizeCell(row.status || 'published').toLowerCase();
          const rawPriceStr = String(row.basePrice ?? row.price ?? '').trim();
          const basePrice = rawPriceStr === '' ? NaN : Number(rawPriceStr);

          if (!name) errors.push('Missing required product name.');
          if (!category || !validCategories.has(category)) {
            errors.push(`Invalid or unknown category "${category}". Allowed: ${Array.from(validCategories).join(', ')}.`);
          }
          if (!['standard', 'combo', 'platter', 'package', 'promotion'].includes(productType)) {
            errors.push(`Invalid productType "${productType}". Allowed: standard, combo, platter, package, promotion.`);
          }
          if (!['published', 'draft', 'archived'].includes(status)) {
            errors.push(`Invalid status "${status}". Allowed: published, draft, archived.`);
          }
          if (isNaN(basePrice) || basePrice < 0) {
            errors.push('basePrice must be a valid non-negative number.');
          }

          const id = sanitizeCell(
            row.id || `prod-${name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`
          );
          if (seenIdsInBatch.has(id)) {
            errors.push(`Duplicate product id "${id}" repeated in this upload sheet.`);
          }

          // Parse channels
          const rawChannels = sanitizeCell(row.channels || 'website|pos');
          const channels = rawChannels
            .split(/[|,]/)
            .map((c) => c.trim().toLowerCase())
            .filter((c) => c === 'website' || c === 'pos');
          if (channels.length === 0) {
            errors.push(`Invalid channels "${rawChannels}". Must include website and/or pos.`);
          }

          // Parse branchAvailability
          const rawBranches = sanitizeCell(row.branchAvailability || 'gra|okabere|ugbowo');
          const activeBranchSet = new Set(
            rawBranches
              .split(/[|,]/)
              .map((b) => b.trim().toLowerCase())
              .filter(Boolean)
          );
          const branchAvailability = {
            gra: activeBranchSet.has('gra'),
            okabere: activeBranchSet.has('okabere'),
            ugbowo: activeBranchSet.has('ugbowo'),
          };

          // Parse componentsSpec ("prod-a:3|prod-b:1")
          let components: any[] | undefined = undefined;
          const compSpec = sanitizeCell(row.componentsSpec || '');
          if (compSpec) {
            components = [];
            const parts = compSpec.split('|').map((s) => s.trim()).filter(Boolean);
            for (const part of parts) {
              const [cProdId, cQtyStr] = part.split(':').map((s) => s.trim());
              const cQty = Number(cQtyStr);
              if (!cProdId || isNaN(cQty) || cQty <= 0) {
                errors.push(`Invalid component entry "${part}" in componentsSpec (expected productId:positiveQty).`);
              } else {
                components.push({ productId: cProdId, quantity: cQty });
              }
            }
          } else if (Array.isArray(row.components)) {
            components = row.components;
          }

          // Parse discount
          let discountConfig: any = undefined;
          const discountType = sanitizeCell(row.discountType || '').toLowerCase();
          const discountValue = Number(row.discountValue || 0);
          if (discountType) {
            discountConfig = {
              enabled: discountValue > 0,
              type: discountType,
              value: discountValue,
            };
          }

          // Parse wholesale
          let wholesalePricing: any = undefined;
          const wholesaleEnabled = sanitizeCell(row.wholesaleEnabled || '').toLowerCase() === 'true';
          if (wholesaleEnabled) {
            wholesalePricing = {
              enabled: true,
              retailPrice: isNaN(basePrice) ? 0 : basePrice,
              wholesalePrice: Number(row.wholesalePrice || 0),
              minWholesaleQty: Number(row.minWholesaleQty || 0),
              allowSkuPooling: true,
            };
          }

          // Parse promotion
          let promotionRules: any = undefined;
          const promoQualId = sanitizeCell(row.promoQualifyingProductId || '');
          const promoRewId = sanitizeCell(row.promoRewardProductId || '');
          if (promoQualId || promoRewId || productType === 'promotion') {
            promotionRules = {
              isActive: true,
              qualifyingProductIds: promoQualId ? [promoQualId] : [],
              minimumQuantity: Number(row.promoMinQty || 1),
              freeRewardProductId: promoRewId,
              freeRewardQuantity: Number(row.promoRewardQty || 1),
              maxRewardsPerOrder: 1,
            };
          }

          // Run domain validation
          if (errors.length === 0) {
            const commercialCheck = validateProductCommercialConfig(db, id, {
              productType,
              basePrice,
              components,
              discountConfig,
              wholesalePricing,
              promotionRules,
            });
            if (!commercialCheck.valid) {
              errors.push(...commercialCheck.errors);
            } else {
              components = commercialCheck.normalizedComponents;
              discountConfig = commercialCheck.normalizedDiscountConfig;
              wholesalePricing = commercialCheck.normalizedWholesalePricing;
              promotionRules = commercialCheck.normalizedPromotionRules;
            }
          }

          if (errors.length > 0) {
            invalidRows.push({ rowNumber, rowData: row, errors });
          } else {
            seenIdsInBatch.add(id);
            const existing = db.menuProducts[id];
            const action = existing ? 'UPDATE' : 'CREATE';
            const diffSummary = existing
              ? `Update "${existing.name}": Price ₦${existing.basePrice} → ₦${basePrice}, Type ${existing.productType || 'standard'} → ${productType}, Status ${existing.status || 'published'} → ${status}`
              : `Create new ${productType} "${name}" (${id}) at ₦${basePrice}`;

            validRows.push({
              rowNumber,
              action,
              diffSummary,
              id,
              name,
              category,
              productType,
              basePrice,
              status,
              channels,
              branchAvailability,
              components,
              discountConfig,
              wholesalePricing,
              promotionRules,
              shortDescription: sanitizeCell(row.shortDescription || existing?.shortDescription || ''),
            });
          }
        });
      } else if (module === 'market_list' || module === 'market-list') {
        const inventoryValues = Object.values(db.inventory || {}) as any[];
        rawRows.forEach((row, idx) => {
          const rowNumber = idx + 2;
          const errors: string[] = [];
          const sku = sanitizeCell(row.sku || row.itemId || '');
          const itemName = sanitizeCell(row.itemName || row.name || '');
          const branchId = sanitizeCell(row.branchId || currentStaff.branchId || 'gra').toLowerCase();
          const unit = sanitizeCell(row.unit || 'kg').toLowerCase();
          const requestedQty = Number(row.requestedQty ?? row.quantity ?? 0);
          const estimatedUnitCost = Number(row.estimatedUnitCost ?? row.unitPrice ?? row.unitCost ?? 0);

          if (!itemName && !sku) errors.push('Either itemName or sku is required.');
          if (isNaN(requestedQty) || requestedQty <= 0) errors.push('requestedQty must be greater than 0.');
          if (isNaN(estimatedUnitCost) || estimatedUnitCost < 0) errors.push('estimatedUnitCost must be >= 0.');
          if (!['gra', 'okabere', 'ugbowo', 'general_store'].includes(branchId)) {
            errors.push(`Invalid branchId "${branchId}".`);
          }

          const matchedItem = inventoryValues.find(
            (it) =>
              (sku && (String(it.id).toLowerCase() === sku.toLowerCase() || String(it.sku || '').toLowerCase() === sku.toLowerCase())) ||
              (itemName && String(it.name || '').toLowerCase() === itemName.toLowerCase())
          );

          if (errors.length > 0) {
            invalidRows.push({ rowNumber, rowData: row, errors });
          } else {
            validRows.push({
              rowNumber,
              itemId: matchedItem?.id || sku || `mkt-item-${idx + 1}`,
              sku: matchedItem?.sku || sku || `MKT-${idx + 1}`,
              itemName: matchedItem?.name || itemName,
              category: sanitizeCell(row.category || matchedItem?.category || 'produce'),
              branchId,
              unit: matchedItem?.unit || unit,
              requestedQty,
              estimatedUnitCost: estimatedUnitCost || matchedItem?.costPerUnit || 0,
              estimatedLineTotal: Math.round(requestedQty * (estimatedUnitCost || matchedItem?.costPerUnit || 0)),
              supplierName: sanitizeCell(row.supplierName || matchedItem?.supplier || 'Market Purchase'),
              priority: sanitizeCell(row.priority || 'normal'),
              notes: sanitizeCell(row.notes || ''),
            });
          }
        });
      } else if (module === 'stock_update' || module === 'stock-update' || module === 'stock_count') {
        const inventoryValues = Object.values(db.inventory || {}) as any[];
        rawRows.forEach((row, idx) => {
          const rowNumber = idx + 2;
          const errors: string[] = [];
          const sku = sanitizeCell(row.sku || row.itemId || '');
          const itemName = sanitizeCell(row.itemName || row.name || '');
          const branchId = sanitizeCell(row.branchId || currentStaff.branchId || 'gra').toLowerCase();
          const physicalCountedQty = Number(row.physicalCountedQty ?? row.countedQty ?? row.quantity ?? NaN);
          const unit = sanitizeCell(row.unit || '').toLowerCase();
          const reason = sanitizeCell(row.reason || row.notes || 'Imported physical stock count');

          const matchedItem = inventoryValues.find(
            (it) =>
              (sku && (String(it.id).toLowerCase() === sku.toLowerCase() || String(it.sku || '').toLowerCase() === sku.toLowerCase())) ||
              (itemName && String(it.name || '').toLowerCase() === itemName.toLowerCase())
          );

          if (!matchedItem) {
            errors.push(`Unknown inventory item SKU/name "${sku || itemName}". Must match an existing inventory item.`);
          } else if (unit && matchedItem.unit && unit !== String(matchedItem.unit).toLowerCase()) {
            errors.push(`Unit mismatch for "${matchedItem.name}": file has "${unit}", system expects "${matchedItem.unit}".`);
          }
          if (isNaN(physicalCountedQty) || physicalCountedQty < 0) {
            errors.push('physicalCountedQty must be a non-negative number (>= 0).');
          }
          if (!['gra', 'okabere', 'ugbowo', 'general_store'].includes(branchId)) {
            errors.push(`Invalid branchId "${branchId}".`);
          }

          if (errors.length > 0) {
            invalidRows.push({ rowNumber, rowData: row, errors });
          } else {
            const systemQty =
              Number(matchedItem.locationStock?.[branchId]?.stockOnHand ?? matchedItem.currentStock?.[branchId] ?? 0) || 0;
            const unitCost = Number(row.unitCost) > 0 ? Number(row.unitCost) : Number(matchedItem.costPerUnit || 1000);
            const varianceQty = physicalCountedQty - systemQty;
            validRows.push({
              rowNumber,
              itemId: matchedItem.id,
              sku: matchedItem.sku || matchedItem.id,
              itemName: matchedItem.name,
              branchId,
              unit: matchedItem.unit || 'units',
              systemExpectedQty: systemQty,
              physicalCountedQty,
              varianceQty,
              unitCost,
              varianceValue: varianceQty * unitCost,
              reason,
            });
          }
        });
      } else {
        return res.status(400).json({ error: `Unsupported import module: ${module}` });
      }

      db.importStagingBatches = db.importStagingBatches || {};
      const importBatchId = `IMP-${module.toUpperCase()}-${Date.now()}`;
      db.importStagingBatches[importBatchId] = {
        importBatchId,
        module,
        createdBy: currentStaff.name,
        createdAt: new Date().toISOString(),
        committed: false,
        validRows,
        invalidRows,
        warnings,
      };
      saveDatabaseSync();

      res.json({
        importBatchId,
        module,
        totalRows: rawRows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        warningCount: warnings.length,
        validRows,
        invalidRows,
        warnings,
      });
    }
  );

  // Commit Validated Bulk Import Batch (Idempotent & Atomic for Menu)
  router.post(
    '/api/import/:module/commit',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'store_manager', 'menu_manager', 'storekeeper', 'accountant']),
    (req, res) => {
      const { module } = req.params;
      const { importBatchId, allowPartialCommit } = req.body || {};
      const db = getDb() as any;
      const currentStaff = (req as any).staff as DbStaffAccount;

      db.importStagingBatches = db.importStagingBatches || {};
      const batch = db.importStagingBatches[importBatchId];
      if (!batch || batch.module !== module) {
        return res.status(404).json({ error: 'Import staging batch not found. Please validate the file first.' });
      }

      if (batch.committed) {
        return res.json({
          success: true,
          idempotentReplay: true,
          importBatchId,
          committedCount: batch.committedCount || batch.validRows.length,
          message: 'Import batch was already committed previously.',
        });
      }

      if (
        (module === 'menu' || module === 'catalogue') &&
        Array.isArray(batch.invalidRows) &&
        batch.invalidRows.length > 0 &&
        !allowPartialCommit
      ) {
        return res.status(400).json({
          error: `Atomic commit blocked: ${batch.invalidRows.length} row(s) failed validation. Please fix invalid rows in the spreadsheet and re-validate before committing.`,
          invalidCount: batch.invalidRows.length,
          invalidRows: batch.invalidRows,
        });
      }

      if (!Array.isArray(batch.validRows) || batch.validRows.length === 0) {
        return res.status(400).json({ error: 'No valid rows in this staging batch to commit.' });
      }

      const nowIso = new Date().toISOString();
      let committedCount = 0;

      if (module === 'inventory') {
        db.inventory = db.inventory || {};
        db.stockLedger = db.stockLedger || [];

        for (const r of batch.validRows) {
          const itemId = r.sku.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
          db.inventory[itemId] = {
            id: itemId,
            sku: r.sku,
            name: r.name,
            category: r.category,
            itemType: r.itemType,
            unit: r.unit,
            baseUnit: r.unit,
            purchaseUnit: r.purchaseUnit,
            conversionFactor: r.conversionFactor,
            costPerUnit: r.costPerUnit,
            sellingPrice: r.sellingPrice,
            stockQty: r.openingBalance,
            currentStock: r.openingBalance,
            reorderLevel: r.reorderLevel,
            minThreshold: r.reorderLevel,
            parLevel: r.reorderQty,
            branchId: r.branchId === 'general_store' ? 'gra' : r.branchId,
            locationBalances: {
              [r.branchId]: r.openingBalance,
            },
            storageArea: r.storageArea,
            supplier: r.supplierName || 'Approved Vendor',
            isActive: r.isActive,
            lastRestocked: nowIso,
          };

          if (r.openingBalance > 0) {
            db.stockLedger.unshift({
              id: `led-imp-${Date.now()}-${committedCount}`,
              itemId,
              itemName: r.name,
              locationId: r.branchId,
              txType: 'opening_balance',
              quantityDelta: r.openingBalance,
              previousBalance: 0,
              newBalance: r.openingBalance,
              unit: r.unit,
              unitCost: r.costPerUnit,
              totalValue: r.openingBalance * r.costPerUnit,
              referenceId: importBatchId,
              performedBy: currentStaff.name,
              notes: `Bulk Excel Import Opening Balance (${importBatchId})`,
              timestamp: nowIso,
            });
          }
          committedCount++;
        }
      } else if (module === 'expenses' || module === 'expenditures') {
        db.expenseClaims = db.expenseClaims || {};
        const existingSeq = Object.keys(db.expenseClaims).length;

        for (const r of batch.validRows) {
          const claimNum = `EXP-${new Date().getFullYear()}-${String(existingSeq + committedCount + 1).padStart(4, '0')}`;
          const id = `exp-imp-${Date.now()}-${committedCount}`;
          const targetAccountCode =
            r.accountingClassification === 'fixed_asset'
              ? '1500'
              : r.accountingClassification === 'inventory_purchase'
              ? '1300'
              : r.categoryId === 'cat_diesel_power'
              ? '6100'
              : r.categoryId === 'cat_dispatch_fuel'
              ? '6500'
              : '6700';

          const resolvedClassification =
            r.accountingClassification === 'opex' ? 'operating_expense' : r.accountingClassification;
          const newClaim: DbExpenseClaim = {
            id,
            claimReference: claimNum,
            claimType: r.claimType,
            status: 'submitted',
            claimantStaffId: currentStaff.id,
            claimantName: currentStaff.name,
            claimantRole: currentStaff.role,
            homeBranchId: currentStaff.branchId || r.branchId,
            operatingBranchId: r.branchId,
            department: r.department,
            expenseDate: r.expenseDate,
            categoryId: r.categoryId,
            categoryName: r.categoryId.replace('cat_', '').replace(/_/g, ' ').toUpperCase(),
            accountingClassification: resolvedClassification,
            targetAccountCode,
            businessReason: r.title,
            description: r.description,
            lineItems: [
              {
                id: `li-${id}-1`,
                description: r.title,
                categoryId: r.categoryId,
                quantity: 1,
                unitCost: r.netAmount,
                amount: r.netAmount,
                vatAmount: r.vatAmount,
                accountingClassification: resolvedClassification,
                accountCode: targetAccountCode,
              },
            ],
            vatAmount: r.vatAmount,
            totalAmount: r.totalAmount,
            paidAmount: 0,
            currency: 'NGN',
            paymentMethodUsedByClaimant: (r.paymentMethodUsed === 'bank_transfer'
              ? 'company_bank_transfer'
              : r.paymentMethodUsed === 'cash'
              ? 'company_cash_drawer'
              : 'personal_transfer') as any,
            vendorName: r.vendorName,
            receiptOrInvoiceRef: r.receiptOrInvoiceRef,
            attachmentIds: [],
            requiresAdditionalApproval: r.totalAmount > 50000,
            currentApprovalStage: 'branch_review',
            fraudFlags: [],
            payments: [],
            approvalHistory: [
              {
                id: `apv-${id}-1`,
                claimId: id,
                previousStatus: 'none',
                newStatus: 'submitted',
                stage: 'submission',
                action: 'submit',
                actorId: currentStaff.id,
                actorName: currentStaff.name,
                actorRole: currentStaff.role,
                comment: `Imported via Validated Spreadsheet Batch ${importBatchId}`,
                timestamp: nowIso,
              },
            ],
            submittedAt: nowIso,
            createdAt: nowIso,
          };
          db.expenseClaims[id] = newClaim;
          committedCount++;
        }
      } else if (module === 'menu' || module === 'catalogue') {
        db.menuProducts = db.menuProducts || {};
        for (const r of batch.validRows) {
          const existing = db.menuProducts[r.id];
          const prevCompJson = JSON.stringify(existing?.components || []);
          const nextCompJson = JSON.stringify(r.components || []);
          const nextVersion = existing
            ? prevCompJson !== nextCompJson
              ? (Number(existing.compositionVersion) || 1) + 1
              : existing.compositionVersion || (r.components?.length ? 1 : undefined)
            : r.components?.length
            ? 1
            : undefined;

          db.menuProducts[r.id] = {
            ...(existing || {}),
            id: r.id,
            name: r.name,
            category: r.category,
            productType: r.productType,
            basePrice: r.basePrice,
            shortDescription: r.shortDescription || existing?.shortDescription || '',
            longDescription: existing?.longDescription || r.shortDescription || '',
            image:
              existing?.image ||
              'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
            prepTimeMinutes: existing?.prepTimeMinutes || 15,
            branchPrices: existing?.branchPrices || {},
            branchAvailability: r.branchAvailability,
            channels: r.channels,
            status: r.status,
            isPopular: existing?.isPopular ?? false,
            isFeatured: existing?.isFeatured ?? false,
            isSpicy: existing?.isSpicy ?? false,
            isVegetarian: existing?.isVegetarian ?? false,
            packagingCharge: existing?.packagingCharge ?? 0,
            compositionVersion: nextVersion,
            components: r.components !== undefined ? r.components : existing?.components,
            discountConfig: r.discountConfig !== undefined ? r.discountConfig : existing?.discountConfig,
            wholesalePricing: r.wholesalePricing !== undefined ? r.wholesalePricing : existing?.wholesalePricing,
            isWholesale: Boolean(r.wholesalePricing?.enabled ?? existing?.isWholesale),
            minOrderQty: r.wholesalePricing?.minWholesaleQty ?? existing?.minOrderQty,
            wholesaleUnitPrice: r.wholesalePricing?.wholesalePrice ?? existing?.wholesaleUnitPrice,
            promotionRules: r.promotionRules !== undefined ? r.promotionRules : existing?.promotionRules,
            optionGroups: existing?.optionGroups || [],
            availableAddOns: existing?.availableAddOns || [],
            suggestedUpsells: existing?.suggestedUpsells || [],
            updatedAt: nowIso,
          };
          committedCount++;
        }
      } else if (module === 'market_list' || module === 'market-list') {
        db.marketLists = db.marketLists || {};
        const listId = `mkt-${Date.now()}`;
        const listNumber = `MKT-${String(Object.keys(db.marketLists).length + 1).padStart(4, '0')}`;
        const branchId = batch.validRows[0]?.branchId || currentStaff.branchId || 'gra';
        const totalEstimatedAmount = batch.validRows.reduce(
          (sum: number, r: any) => sum + (Number(r.estimatedLineTotal) || 0),
          0
        );
        const lines = batch.validRows.map((r: any) => ({
          itemId: r.itemId,
          sku: r.sku,
          itemName: r.itemName,
          category: r.category,
          unit: r.unit,
          requestedQty: r.requestedQty,
          approvedQty: r.requestedQty,
          purchasedQty: 0,
          receivedQty: 0,
          estimatedUnitCost: r.estimatedUnitCost,
          actualUnitCost: r.estimatedUnitCost,
          estimatedLineTotal: r.estimatedLineTotal,
          actualLineTotal: 0,
          supplierName: r.supplierName,
          notes: r.notes,
        }));
        db.marketLists[listId] = {
          id: listId,
          listNumber,
          title: `Imported Market List (${new Date().toLocaleDateString('en-GB')})`,
          branchId,
          status: 'submitted',
          createdByStaffId: currentStaff.id,
          createdByName: currentStaff.name,
          createdAt: nowIso,
          totalEstimatedAmount,
          totalActualAmount: 0,
          lines,
          history: [
            {
              status: 'submitted',
              byStaffName: currentStaff.name,
              timestamp: nowIso,
              note: `Imported ${lines.length} market list items from batch ${importBatchId}`,
            },
          ],
        };
        committedCount = lines.length;
      } else if (module === 'stock_update' || module === 'stock-update' || module === 'stock_count') {
        db.stockCounts = db.stockCounts || {};
        const sessionId = `cnt-imp-${Date.now()}`;
        const sessionRef = `STK-${String(Object.keys(db.stockCounts).length + 1).padStart(5, '0')}`;
        const locationId = batch.validRows[0]?.branchId || currentStaff.branchId || 'gra';
        const totalVarianceValue = batch.validRows.reduce(
          (sum: number, r: any) => sum + (Number(r.varianceValue) || 0),
          0
        );
        db.stockCounts[sessionId] = {
          id: sessionId,
          referenceNo: sessionRef,
          locationId,
          sessionType: 'imported_stock_count',
          conductedByStaffId: currentStaff.id,
          conductedByName: currentStaff.name,
          conductedAt: nowIso,
          status: 'pending_approval',
          lines: batch.validRows.map((r: any) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            sku: r.sku,
            unit: r.unit,
            systemExpectedQty: r.systemExpectedQty,
            physicalCountedQty: r.physicalCountedQty,
            varianceQty: r.varianceQty,
            varianceValue: r.varianceValue,
            notes: r.reason,
          })),
          totalVarianceValue,
        };
        committedCount = batch.validRows.length;
      }

      batch.committed = true;
      batch.committedAt = nowIso;
      batch.committedCount = committedCount;
      saveDatabaseSync();

      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId || 'gra',
        'BULK_IMPORT_COMMITTED',
        `Committed ${committedCount} validated ${module} records from batch ${importBatchId}`
      );

      res.json({
        success: true,
        importBatchId,
        module,
        committedCount,
      });
    }
  );

  // ============================================================================
  // PART 10: eZee OPTIMUS HISTORICAL DATA MIGRATION & RECONCILIATION
  // ============================================================================
  router.get(
    '/api/migration/ezee/discovery',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor']),
    (_req, res) => {
      const db = getDb() as any;
      const allChecks = Object.values(db.checks || {}) as DbCheck[];
      const migratedChecks = allChecks.filter(
        (c) => c.isHistoricalMigrated || c.legacySourceSystem === 'ezee_optimus'
      );
      const nextLiveCheckNumber = getNextLiveCheckNumber(db);

      res.json({
        sourceSystem: 'eZee Optimus Cloud Restaurant POS & Back-Office',
        availabilityMatrix: [
          {
            domain: 'Outlets / Branches',
            status: 'Ready (Mapped)',
            sourceFormat: 'CSV / Excel / JSON Export',
            targetEntity: 'branches (gra, okabere, ugbowo)',
            isolationRule: 'Strict mapping to Choplife branch codes',
          },
          {
            domain: 'Historical Checks / Receipts / Sales',
            status: 'Ready (Dry-Run & Commit)',
            sourceFormat: 'eZee Sales Register Export',
            targetEntity: 'db.checks (isHistoricalMigrated: true)',
            isolationRule: 'Uses EZEE-CHK-* IDs; never increments live CHK-xxxxx counter or live shifts',
          },
          {
            domain: 'Payments & Tender Breakdowns',
            status: 'Ready (Mapped)',
            sourceFormat: 'eZee Settlement Summary',
            targetEntity: 'check.payments',
            isolationRule: 'Excluded from live shift cash drawer and live GL revenue posting by default',
          },
          {
            domain: 'Expenses & Petty Cash Payouts',
            status: 'Ready (Dry-Run & Commit)',
            sourceFormat: 'eZee Paid-Out / Expense Register',
            targetEntity: 'db.expenseClaims (isHistoricalMigrated: true)',
            isolationRule: 'Tagged with migrationBatchId and originalTimestamp',
          },
          {
            domain: 'Inventory Master & Opening Stock',
            status: 'Ready via Bulk Import',
            sourceFormat: 'eZee Store Balance Sheet',
            targetEntity: 'db.inventory + db.stockLedger',
            isolationRule: 'Opening stock ledger entries tagged with importBatchId',
          },
        ],
        outletMappings: EZEE_OUTLET_MAP,
        paymentMappings: EZEE_PAYMENT_MAP,
        currentHistoricalMigratedCount: migratedChecks.length,
        currentHistoricalGrossSalesNaira: migratedChecks.reduce((s, c) => s + Number(c.total || 0), 0),
        nextLiveCheckNumber,
        committedBatches: Object.values(db.ezeeMigrationBatches || {}),
      });
    }
  );

  // Inspect eZee Optimus Uploaded File (Sheet Inspection, Headers Preview, Auto-Mapping, Dry-Run Readiness)
  router.post(
    '/api/migration/ezee/inspect',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'accountant']),
    (req, res) => {
      try {
        const { fileBase64, filename, rawContent } = req.body || {};
        if (!fileBase64 && !rawContent) {
          return res.status(400).json({ error: 'Provide fileBase64 or rawContent to inspect.' });
        }

        let sheetNames: string[] = [];
        let sheets: Record<string, { headers: string[]; rows: any[]; rowCount: number }> = {};
        let checksum = '';

        if (fileBase64) {
          const cleanBase64 = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
          const buffer = Buffer.from(cleanBase64, 'base64');
          checksum = crypto.createHash('sha256').update(buffer).digest('hex');
          const parsed = parseBinaryWorkbook(cleanBase64);
          sheetNames = parsed.sheetNames;
          sheets = parsed.sheets;
        } else {
          checksum = crypto.createHash('sha256').update(String(rawContent)).digest('hex');
          const rows = parseTabularUploadContent(String(rawContent));
          const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
          sheetNames = ['Default_Data'];
          sheets = {
            Default_Data: {
              headers,
              rows,
              rowCount: rows.length,
            },
          };
        }

        const activeSheetName = sheetNames[0] || 'Default_Data';
        const activeSheet = sheets[activeSheetName] || { headers: [], rows: [], rowCount: 0 };
        const headers = activeSheet.headers || [];

        // Auto-detect eZee report type
        const hLower = headers.map((h) => h.toLowerCase());
        let detectedReportType = 'ezee_sales_register';
        if (hLower.some((h) => h.includes('cashier') || h.includes('user') || h.includes('shift'))) {
          detectedReportType = 'ezee_cashier_summary';
        } else if (
          hLower.some((h) => h.includes('quantity sold') || h.includes('total qty') || (h.includes('item') && !hLower.some((x) => x.includes('bill') || x.includes('receipt') || x.includes('order'))))
        ) {
          detectedReportType = 'ezee_daily_item_sales';
        }

        // Column mapping auto-suggestions with candidate priority order & exact match precedence
        const matchCol = (candidates: string[]) => {
          const normalized = headers.map((h) => ({
            raw: h,
            clean: h.toLowerCase().replace(/[^a-z0-9]/g, ''),
          }));

          // 1. Exact match on normalized candidate
          for (const cand of candidates) {
            const candClean = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
            const found = normalized.find((item) => item.clean === candClean);
            if (found) return found.raw;
          }

          // 2. Prefix / suffix boundary match
          for (const cand of candidates) {
            const candClean = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
            const found = normalized.find((item) => item.clean.startsWith(candClean) || item.clean.endsWith(candClean));
            if (found) return found.raw;
          }

          // 3. Fallback contains match
          for (const cand of candidates) {
            const candClean = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
            const found = normalized.find((item) => item.clean.includes(candClean));
            if (found) return found.raw;
          }

          return '';
        };

        const suggestedMapping = {
          legacyRecordId: matchCol(['billno', 'receiptno', 'orderno', 'checkno', 'receipt', 'bill', 'legacyrecordid', 'ordernumber']),
          outlet: matchCol(['posoutlet', 'outlet', 'branch', 'store', 'location', 'posbranch']),
          originalTimestamp: matchCol(['billdate', 'date', 'timestamp', 'datetime', 'time', 'createddate']),
          grossAmount: matchCol(['grossamount', 'gross', 'subtotal', 'subtotalamount', 'billamount']),
          discountAmount: matchCol(['discountamount', 'discount', 'disc', 'rebate']),
          netAmount: matchCol(['netamount', 'netsales', 'billtotal', 'totalamount', 'paidamount', 'total', 'amount']),
          paymentMethod: matchCol(['paymentmethod', 'tender', 'paymode', 'settlement', 'paymentmode', 'paytype']),
          customerName: matchCol(['customername', 'guestname', 'guest', 'customer', 'patron']),
          itemSummary: matchCol(['itemsummary', 'itemname', 'description', 'menuitem', 'items', 'particulars']),
        };

        const previewRows = activeSheet.rows.slice(0, 5);

        res.json({
          success: true,
          filename: filename || 'uploaded_workbook.xlsx',
          checksum,
          sheetNames,
          sheetsSummary: sheetNames.map((name) => ({
            name,
            headers: sheets[name]?.headers || [],
            rowCount: sheets[name]?.rowCount || 0,
          })),
          activeSheet: {
            name: activeSheetName,
            headers: activeSheet.headers,
            rowCount: activeSheet.rowCount,
            previewRows,
          },
          detectedReportType,
          suggestedMapping,
        });
      } catch (err: any) {
        res.status(500).json({ error: `Failed to inspect workbook: ${err.message || String(err)}` });
      }
    }
  );

  // Dry-Run eZee Optimus Historical Migration & Generate Reconciliation Report
  router.post(
    '/api/migration/ezee/dry-run',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'accountant']),
    (req, res) => {
      const db = getDb() as any;
      const currentStaff = (req as any).staff as DbStaffAccount;
      const liveSequenceBefore = getNextLiveCheckNumber(db);

      let inputChecks: any[] = [];
      if (Array.isArray(req.body?.checks)) {
        inputChecks = req.body.checks;
      } else if (typeof req.body?.fileBase64 === 'string') {
        const wb = parseBinaryWorkbook(req.body.fileBase64);
        const targetSheet = req.body?.selectedSheet || wb.sheetNames[0];
        const sheetRows = wb.sheets[targetSheet]?.rows || [];
        const colMap = req.body?.columnMapping || {};
        inputChecks = sheetRows.map((r: any) => ({
          legacyRecordId: colMap.legacyRecordId ? r[colMap.legacyRecordId] : (r.legacyRecordId || r.receiptNo || r.billNo || r['Bill No'] || r['Receipt No']),
          outlet: colMap.outlet ? r[colMap.outlet] : (r.outlet || r.branchId || r.Branch || r['POS Outlet']),
          originalTimestamp: colMap.originalTimestamp ? r[colMap.originalTimestamp] : (r.originalTimestamp || r.billDate || r.timestamp || r['Bill Date']),
          grossAmount: colMap.grossAmount ? r[colMap.grossAmount] : (r.grossAmount ?? r.subtotal ?? r.total ?? r['Gross Amount'] ?? r['Bill Amount']),
          discountAmount: colMap.discountAmount ? r[colMap.discountAmount] : (r.discountAmount ?? r.discount ?? r['Discount Amount'] ?? r['Discount']),
          netAmount: colMap.netAmount ? r[colMap.netAmount] : (r.netAmount ?? r.total ?? r['Net Amount'] ?? r['Bill Total'] ?? r['Total Amount']),
          paymentMethod: colMap.paymentMethod ? r[colMap.paymentMethod] : (r.paymentMethod || r.tender || r['Payment Method'] || r['Tender']),
          customerName: colMap.customerName ? r[colMap.customerName] : (r.customerName || r['Customer Name'] || r['Guest Name']),
          itemSummary: colMap.itemSummary ? r[colMap.itemSummary] : (r.itemSummary || r['Item Summary'] || r['Item Name']),
        }));
      } else if (typeof req.body?.rawContent === 'string') {
        inputChecks = parseTabularUploadContent(req.body.rawContent);
      } else {
        return res.status(400).json({ error: 'Provide checks array, fileBase64 string (.xlsx/.xls), or rawContent string for eZee Optimus dry-run.' });
      }

      const existingChecks = Object.values(db.checks || {}) as DbCheck[];
      const existingLegacyIds = new Set(
        existingChecks
          .filter((c) => c.legacyRecordId)
          .map((c) => String(c.legacyRecordId).toUpperCase())
      );
      const batchLegacyIds = new Set<string>();

      const validHistoricalChecks: DbCheck[] = [];
      const duplicateSkipped: { legacyRecordId: string; reason: string }[] = [];
      const invalidRejected: { rowNumber: number; errors: string[] }[] = [];
      const unmappedProducts: { rowNumber: number; itemName: string }[] = [];

      let sourceGrossSales = 0;
      let sourceDiscounts = 0;
      let sourceNetSales = 0;

      const batchChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(inputChecks))
        .digest('hex');

      const migrationBatchId = `EZEE-MIG-${Date.now()}-${batchChecksum.slice(0, 8).toUpperCase()}`;
      const catalogueProducts = Object.values(db.menuProducts || {}) as any[];

      inputChecks.forEach((raw, idx) => {
        const rowNumber = idx + 1;
        const errors: string[] = [];
        const legacyRecordId = sanitizeCell(
          raw.legacyRecordId || raw.receiptNo || raw.billNo || raw.OrderNo || `EZEE-ROW-${rowNumber}`
        ).toUpperCase();

        const rawOutlet = sanitizeCell(raw.outlet || raw.branchId || raw.Branch || 'gra').toLowerCase();
        const mappedBranch = EZEE_OUTLET_MAP[rawOutlet];
        if (!mappedBranch) {
          errors.push(`Unmapped eZee outlet "${rawOutlet}".`);
        }

        const gross = Number(raw.grossAmount ?? raw.subtotal ?? raw.total ?? 0);
        const discount = Math.max(0, Number(raw.discountAmount ?? raw.discount ?? 0));
        const net = Number(raw.netAmount ?? raw.total ?? Math.max(0, gross - discount));

        sourceGrossSales += isNaN(gross) ? 0 : gross;
        sourceDiscounts += isNaN(discount) ? 0 : discount;
        sourceNetSales += isNaN(net) ? 0 : net;

        if (isNaN(net) || net < 0) {
          errors.push('Net amount must be >= 0.');
        }

        const rawPayMethod = sanitizeCell(raw.paymentMethod || raw.tender || 'cash').toLowerCase();
        const mappedPayMethod = EZEE_PAYMENT_MAP[rawPayMethod] || 'cash';

        const origTs = raw.originalTimestamp || raw.billDate || raw.timestamp || '2025-11-15T14:30:00.000Z';
        const parsedTime = new Date(origTs);
        if (isNaN(parsedTime.getTime())) {
          errors.push(`Invalid originalTimestamp "${origTs}".`);
        }

        if (existingLegacyIds.has(legacyRecordId) || batchLegacyIds.has(legacyRecordId)) {
          duplicateSkipped.push({
            legacyRecordId,
            reason: existingLegacyIds.has(legacyRecordId)
              ? 'Already migrated in database'
              : 'Duplicate legacyRecordId inside batch',
          });
          return;
        }

        if (errors.length > 0) {
          invalidRejected.push({ rowNumber, errors });
          return;
        }

        batchLegacyIds.add(legacyRecordId);
        const isoTime = parsedTime.toISOString();
        const checkId = `ezee-chk-${legacyRecordId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

        const items = Array.isArray(raw.items) && raw.items.length > 0
          ? raw.items.map((it: any, iIdx: number) => {
              const itemName = sanitizeCell(it.name || 'eZee Historical Menu Item');
              const matchedProd = catalogueProducts.find(
                (cp) => cp.id === it.productId || String(cp.name || '').toLowerCase() === itemName.toLowerCase()
              );
              if (!matchedProd && !it.productId) {
                unmappedProducts.push({ rowNumber, itemName });
              }
              return {
                id: `ezee-it-${iIdx + 1}`,
                productId: matchedProd?.id || it.productId || 'migrated-item',
                name: itemName,
                quantity: Math.max(1, Number(it.quantity) || 1),
                unitPrice: Number(it.unitPrice ?? net),
                totalPrice: Number(it.totalPrice ?? net),
                status: 'served' as const,
              };
            })
          : [
              {
                id: 'ezee-it-1',
                productId: 'migrated-item',
                name: sanitizeCell(raw.itemSummary || 'Smoky Party Jollof & Grill Combo (eZee Historical)'),
                quantity: 1,
                unitPrice: net,
                totalPrice: net,
                status: 'served' as const,
              },
            ];

        validHistoricalChecks.push({
          id: checkId,
          checkNumber: `EZEE-${legacyRecordId}`,
          branchId: mappedBranch,
          checkType: (raw.checkType || 'dine_in') as any,
          tableNumber: raw.tableNumber || 'HIST-TBL',
          customerName: sanitizeCell(raw.customerName || 'Historical Walk-In Patron'),
          guestCount: 1,
          items,
          subtotal: gross || net + discount,
          discountPercent: 0,
          discountAmount: discount,
          packagingFee: 0,
          deliveryFee: 0,
          total: net,
          amountPaid: net,
          remainingBalance: 0,
          status: 'paid',
          paymentStatus: 'paid',
          paymentMethod: mappedPayMethod,
          payments: [
            {
              id: `ezee-pay-${legacyRecordId}`,
              method: (mappedPayMethod === 'online' ? 'bank_transfer' : mappedPayMethod) as any,
              amount: net,
              reference: `EZEE-REF-${legacyRecordId}`,
              timestamp: isoTime,
              paidAt: isoTime,
              confirmedByStaffId: 'ezee_migrated',
              confirmedByName: sanitizeCell(raw.cashierName || 'eZee Legacy Operator'),
              cashierId: 'ezee_migrated',
              cashierName: sanitizeCell(raw.cashierName || 'eZee Legacy Operator'),
            },
          ],
          openedByStaffId: 'ezee_migrated',
          openedByName: sanitizeCell(raw.cashierName || 'eZee Legacy Operator'),
          openedAt: isoTime,
          closedAt: isoTime,
          closedByStaffId: 'ezee_migrated',
          closedByName: sanitizeCell(raw.cashierName || 'eZee Legacy Operator'),
          isHistorical: true,
          isHistoricalMigrated: true,
          legacySourceSystem: 'ezee_optimus',
          legacyRecordId,
          legacyBranchId: rawOutlet,
          migrationBatchId,
          originalTimestamp: isoTime,
        } as any);
      });

      const targetGrossSales = validHistoricalChecks.reduce((s, c) => s + c.subtotal, 0);
      const targetDiscounts = validHistoricalChecks.reduce((s, c) => s + c.discountAmount, 0);
      const targetNetSales = validHistoricalChecks.reduce((s, c) => s + c.total, 0);

      const byBranch: Record<string, { count: number; netSales: number }> = {
        gra: { count: 0, netSales: 0 },
        okabere: { count: 0, netSales: 0 },
        ugbowo: { count: 0, netSales: 0 },
      };
      const byPaymentMethod: Record<string, { count: number; netSales: number }> = {};

      for (const c of validHistoricalChecks) {
        if (byBranch[c.branchId]) {
          byBranch[c.branchId].count += 1;
          byBranch[c.branchId].netSales += c.total;
        }
        const m = c.paymentMethod || 'cash';
        if (!byPaymentMethod[m]) byPaymentMethod[m] = { count: 0, netSales: 0 };
        byPaymentMethod[m].count += 1;
        byPaymentMethod[m].netSales += c.total;
      }

      const liveSequenceAfterDryRun = getNextLiveCheckNumber(db);

      const reconciliationReport = {
        migrationBatchId,
        batchChecksum,
        sourceSystem: 'eZee Optimus',
        executedBy: currentStaff.name,
        timestamp: new Date().toISOString(),
        recordCounts: {
          sourceTotal: inputChecks.length,
          targetReadyToCommit: validHistoricalChecks.length,
          duplicateSkipped: duplicateSkipped.length,
          invalidRejected: invalidRejected.length,
          unmappedProductItems: unmappedProducts.length,
        },
        financialParity: {
          sourceGrossSales,
          targetGrossSales,
          sourceDiscounts,
          targetDiscounts,
          sourceNetSales,
          targetNetSales,
          netVarianceNaira: sourceNetSales - targetNetSales,
          byBranch,
          byPaymentMethod,
        },
        liveCounterIsolationCheck: {
          liveSequenceBefore,
          liveSequenceAfterDryRun,
          isStrictlyIsolated: liveSequenceBefore === liveSequenceAfterDryRun,
        },
        duplicateSkipped,
        invalidRejected,
        unmappedProducts,
      };

      db.ezeeStagingBatches = db.ezeeStagingBatches || {};
      db.ezeeStagingBatches[migrationBatchId] = {
        migrationBatchId,
        batchChecksum,
        committed: false,
        validHistoricalChecks,
        reconciliationReport,
      };
      saveDatabaseSync();

      res.json(reconciliationReport);
    }
  );

  // Commit Validated eZee Optimus Historical Batch
  router.post(
    '/api/migration/ezee/commit',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'accountant']),
    (req, res) => {
      const db = getDb() as any;
      const currentStaff = (req as any).staff as DbStaffAccount;
      const { migrationBatchId } = req.body || {};

      db.ezeeStagingBatches = db.ezeeStagingBatches || {};
      const staging = db.ezeeStagingBatches[migrationBatchId];
      if (!staging) {
        return res.status(404).json({ error: 'eZee migration staging batch not found. Run dry-run first.' });
      }

      const liveSequenceBeforeCommit = getNextLiveCheckNumber(db);

      if (staging.committed) {
        return res.json({
          success: true,
          idempotentReplay: true,
          migrationBatchId,
          committedCount: staging.validHistoricalChecks.length,
          liveSequenceBeforeCommit,
          liveSequenceAfterCommit: getNextLiveCheckNumber(db),
        });
      }

      db.checks = db.checks || {};
      let committedCount = 0;
      for (const chk of staging.validHistoricalChecks as DbCheck[]) {
        db.checks[chk.id] = chk;
        committedCount++;
      }

      staging.committed = true;
      staging.committedAt = new Date().toISOString();
      db.ezeeMigrationBatches = db.ezeeMigrationBatches || {};
      db.ezeeMigrationBatches[migrationBatchId] = {
        ...staging.reconciliationReport,
        committed: true,
        committedAt: staging.committedAt,
        committedCount,
      };

      saveDatabaseSync();
      const liveSequenceAfterCommit = getNextLiveCheckNumber(db);

      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId || 'gra',
        'EZEE_HISTORICAL_MIGRATION_COMMITTED',
        `Committed ${committedCount} eZee Optimus historical checks (${migrationBatchId}). Live check sequence preserved at ${liveSequenceAfterCommit}.`
      );

      res.json({
        success: true,
        migrationBatchId,
        committedCount,
        liveSequenceBeforeCommit,
        liveSequenceAfterCommit,
        isLiveSequenceUntouched: liveSequenceBeforeCommit === liveSequenceAfterCommit,
        reconciliationReport: db.ezeeMigrationBatches[migrationBatchId],
      });
    }
  );

  // Controlled Rollback of an eZee Optimus Historical Migration Batch
  router.post(
    '/api/migration/ezee/rollback',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin']),
    (req, res) => {
      const db = getDb() as any;
      const currentStaff = (req as any).staff as DbStaffAccount;
      const { migrationBatchId, reason } = req.body || {};

      if (!migrationBatchId) {
        return res.status(400).json({ error: 'migrationBatchId is required to rollback a historical import batch.' });
      }

      db.checks = db.checks || {};
      let removedChecksCount = 0;
      for (const [chkId, chk] of Object.entries(db.checks) as [string, any][]) {
        if (
          chk &&
          chk.migrationBatchId === migrationBatchId &&
          (chk.isHistoricalMigrated === true || chk.isHistorical === true)
        ) {
          delete db.checks[chkId];
          removedChecksCount++;
        }
      }

      if (db.ezeeStagingBatches?.[migrationBatchId]) {
        db.ezeeStagingBatches[migrationBatchId].committed = false;
        db.ezeeStagingBatches[migrationBatchId].rolledBack = true;
        db.ezeeStagingBatches[migrationBatchId].rolledBackAt = new Date().toISOString();
      }
      if (db.ezeeMigrationBatches?.[migrationBatchId]) {
        db.ezeeMigrationBatches[migrationBatchId].rolledBack = true;
        db.ezeeMigrationBatches[migrationBatchId].rolledBackAt = new Date().toISOString();
        db.ezeeMigrationBatches[migrationBatchId].rolledBackBy = currentStaff.name;
        db.ezeeMigrationBatches[migrationBatchId].rollbackReason = reason || 'Controlled administrative rollback';
      }

      saveDatabaseSync();

      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId || 'gra',
        'EZEE_HISTORICAL_MIGRATION_ROLLED_BACK',
        `Rolled back eZee Optimus migration batch ${migrationBatchId}: removed ${removedChecksCount} historical checks. Reason: ${reason || 'Administrative rollback'}`
      );

      res.json({
        success: true,
        migrationBatchId,
        removedChecksCount,
        rolledBackAt: new Date().toISOString(),
        rolledBackBy: currentStaff.name,
      });
    }
  );

  return router;
}
