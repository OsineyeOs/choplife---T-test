import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Database,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface ExcelBulkImportAndMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'inventory_import' | 'menu_import' | 'expenses_import' | 'ezee_migration' | 'capex_opex_budgets';
  onSuccessRefresh?: () => void;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const ExcelBulkImportAndMigrationModal: React.FC<ExcelBulkImportAndMigrationModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'inventory_import',
  onSuccessRefresh,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<
    'inventory_import' | 'menu_import' | 'expenses_import' | 'ezee_migration' | 'capex_opex_budgets'
  >(defaultTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  const [rawContent, setRawContent] = useState<string>('');
  const [fileBase64, setFileBase64] = useState<string>('');
  const [uploadedFilename, setUploadedFilename] = useState<string>('');
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // eZee Migration state
  const [ezeeDiscovery, setEzeeDiscovery] = useState<any | null>(null);
  const [ezeeInspectResult, setEzeeInspectResult] = useState<any | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    legacyRecordId: '',
    outlet: '',
    originalTimestamp: '',
    grossAmount: '',
    discountAmount: '',
    netAmount: '',
    paymentMethod: '',
    customerName: '',
    itemSummary: '',
  });
  const [ezeeDryRunReport, setEzeeDryRunReport] = useState<any | null>(null);
  const [ezeeCommitResult, setEzeeCommitResult] = useState<any | null>(null);

  // CAPEX / OPEX Budgets state
  const [budgetData, setBudgetData] = useState<any | null>(null);
  const [editingBranch, setEditingBranch] = useState<string>('gra');
  const [opexLimitInput, setOpexLimitInput] = useState<string>('1850000');
  const [capexLimitInput, setCapexLimitInput] = useState<string>('750000');

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('choplife_staff_token') || sessionStorage.getItem('choplife_staff_token') || '';
    return {
      Authorization: `Bearer ${token}`,
      ...extra,
    };
  };

  const fetchDiscoveryAndBudgets = async () => {
    try {
      const [discRes, budRes] = await Promise.all([
        fetch('/api/migration/ezee/discovery', { headers: getAuthHeaders() }),
        fetch('/api/expenditures/budgets', { headers: getAuthHeaders() }),
      ]);
      if (discRes.ok) setEzeeDiscovery(await discRes.json());
      if (budRes.ok) {
        const bJson = await budRes.json();
        setBudgetData(bJson);
        if (bJson.budgets?.[editingBranch]) {
          setOpexLimitInput(String(bJson.budgets[editingBranch].monthlyOpexLimit || 1850000));
          setCapexLimitInput(String(bJson.budgets[editingBranch].monthlyCapexLimit || 750000));
        }
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      setValidationResult(null);
      setCommitResult(null);
      setEzeeDryRunReport(null);
      setEzeeCommitResult(null);
      fetchDiscoveryAndBudgets();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const currentModule: 'inventory' | 'menu' | 'expenses' =
    activeTab === 'inventory_import' ? 'inventory' : activeTab === 'menu_import' ? 'menu' : 'expenses';

  const handleDownloadTemplate = async (module: 'inventory' | 'menu' | 'expenses', format: 'xls' | 'csv') => {
    try {
      const res = await fetch(`/api/import/templates/${module}?format=${format}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `choplife_${module}_import_template.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast?.(`Downloaded ${module.toUpperCase()} ${format.toUpperCase()} template.`);
    } catch (err) {
      showToast?.('Failed to download template', 'error');
    }
  };

  const runEzeeInspect = async (b64: string, filename: string, text?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/migration/ezee/inspect', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ fileBase64: b64 || undefined, rawContent: text || undefined, filename }),
      });
      const data = await res.json();
      if (res.ok) {
        setEzeeInspectResult(data);
        if (data.sheetNames?.length > 0) {
          setSelectedSheet(data.sheetNames[0]);
        }
        if (data.suggestedMapping) {
          setColumnMapping((prev) => ({ ...prev, ...data.suggestedMapping }));
        }
        showToast?.(`Workbook inspected: ${data.sheetNames?.length || 1} sheet(s), detected ${data.detectedReportType}.`);
      } else {
        showToast?.(data.error || 'Failed to inspect file', 'error');
      }
    } catch (e) {
      showToast?.('Inspection request failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFilename(file.name);
    setValidationResult(null);
    setCommitResult(null);
    setEzeeDryRunReport(null);
    setEzeeCommitResult(null);
    setEzeeInspectResult(null);

    const isBinary = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    if (isBinary) {
      reader.onload = async () => {
        const b64 = String(reader.result || '');
        setFileBase64(b64);
        setRawContent('');
        if (activeTab === 'ezee_migration') {
          await runEzeeInspect(b64, file.name);
        }
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = async () => {
        const text = String(reader.result || '');
        setRawContent(text);
        setFileBase64('');
        if (activeTab === 'ezee_migration') {
          await runEzeeInspect('', file.name, text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleValidateImport = async () => {
    if (!fileBase64 && !rawContent.trim()) {
      showToast?.('Please upload an Excel (.XLSX/.XLS) or CSV file first.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: any = fileBase64
        ? { fileBase64, filename: uploadedFilename, sheetName: selectedSheet }
        : { rawContent, filename: uploadedFilename };
      const res = await fetch(`/api/import/${currentModule}/validate`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setValidationResult(data);
        showToast?.(`Validated ${data.totalRows} rows: ${data.validCount} valid, ${data.invalidCount} invalid.`);
      } else {
        showToast?.(data.error || 'Validation failed', 'error');
      }
    } catch (err) {
      showToast?.('Validation request failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommitImport = async () => {
    if (!validationResult?.importBatchId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/import/${currentModule}/commit`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ importBatchId: validationResult.importBatchId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCommitResult(data);
        onSuccessRefresh?.();
        showToast?.(`Committed ${data.committedCount} ${currentModule} records!`);
      } else {
        showToast?.(data.error || 'Commit failed', 'error');
      }
    } catch (err) {
      showToast?.('Commit request failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEzeeDryRun = async () => {
    if (!fileBase64 && !rawContent.trim()) {
      showToast?.('Please upload an eZee Optimus Excel workbook (.xlsx/.xls) or paste CSV export first.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: any = fileBase64
        ? { fileBase64, filename: uploadedFilename, selectedSheet, columnMapping }
        : { rawContent };
      const res = await fetch('/api/migration/ezee/dry-run', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setEzeeDryRunReport(data);
        showToast?.(
          `eZee Dry-Run complete: ${data.recordCounts?.targetReadyToCommit} ready, ${data.recordCounts?.duplicateSkipped} duplicates skipped.`
        );
      } else {
        showToast?.(data.error || 'eZee dry-run failed', 'error');
      }
    } catch (err) {
      showToast?.('eZee dry-run request failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEzeeRollback = async (migrationBatchId: string) => {
    if (!window.confirm(`Are you sure you want to rollback batch ${migrationBatchId}? This will safely remove its migrated checks without affecting live operations.`)) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/migration/ezee/rollback', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ migrationBatchId, reason: 'Operator-initiated rollback from UI' }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast?.(`Successfully rolled back batch ${migrationBatchId}: removed ${data.removedChecksCount} checks.`);
        await fetchDiscoveryAndBudgets();
        onSuccessRefresh?.();
      } else {
        showToast?.(data.error || 'Rollback failed', 'error');
      }
    } catch (e) {
      showToast?.('Rollback request failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEzeeCommit = async () => {
    if (!ezeeDryRunReport?.migrationBatchId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/migration/ezee/commit', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ migrationBatchId: ezeeDryRunReport.migrationBatchId }),
      });
      const data = await res.json();
      if (res.ok) {
        setEzeeCommitResult(data);
        fetchDiscoveryAndBudgets();
        onSuccessRefresh?.();
        showToast?.(
          `Migrated ${data.committedCount} eZee historical checks! Live check counter preserved at ${data.liveSequenceAfterCommit}.`
        );
      } else {
        showToast?.(data.error || 'eZee commit failed', 'error');
      }
    } catch (err) {
      showToast?.('eZee commit request failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBudget = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/expenditures/budgets', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          branchId: editingBranch,
          monthlyOpexLimit: Number(opexLimitInput) || 0,
          monthlyCapexLimit: Number(capexLimitInput) || 0,
        }),
      });
      if (res.ok) {
        await fetchDiscoveryAndBudgets();
        showToast?.(`Updated ${editingBranch.toUpperCase()} monthly CAPEX & OPEX budget limits!`);
      }
    } catch (err) {
      showToast?.('Failed to update budget limits', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-montserrat text-[#241311]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#E5DEC9] flex items-center justify-between">
          <div>
            <h3 className="font-titan text-base text-[#4D080F] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#800D15]" />
              Enterprise Spreadsheet Import, CAPEX/OPEX Governance &amp; eZee Optimus Migration
            </h3>
            <p className="text-xs text-stone-500">
              Validated dry-run preview, duplicate protection, CAPEX/OPEX budget variance &amp; isolated historical migration
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-white border-b border-[#E5DEC9] flex flex-wrap gap-2">
          {[
            { id: 'menu_import', label: '1. Menu, Packages & Pricing (.XLS/.CSV)' },
            { id: 'inventory_import', label: '2. Inventory Bulk Import (.XLS/.CSV)' },
            { id: 'expenses_import', label: '3. Expense / CAPEX / OPEX Import' },
            { id: 'capex_opex_budgets', label: '4. CAPEX vs OPEX Budget Governance' },
            { id: 'ezee_migration', label: '5. eZee Optimus Historical Migration' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id as any);
                setRawContent('');
                setValidationResult(null);
                setCommitResult(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                activeTab === t.id
                  ? 'bg-[#800D15] text-[#FFC700] shadow-xs'
                  : 'bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9] hover:bg-stone-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1, 2 & 3: MENU, INVENTORY OR EXPENSES BULK IMPORT */}
          {(activeTab === 'menu_import' || activeTab === 'inventory_import' || activeTab === 'expenses_import') && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black uppercase text-[#4D080F]">
                    Step 1 — Download Official Structured Template ({currentModule.toUpperCase()})
                  </h4>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Includes Excel DataValidation Dropdown Lists, Instructions &amp; Rules sheet, plus pre-formatted Data_Template headers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadTemplate(currentModule, 'xls')}
                    className="px-3 py-2 rounded-xl bg-[#800D15] hover:bg-[#4D080F] text-[#FFC700] text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Excel (.XLS)
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate(currentModule, 'csv')}
                    className="px-3 py-2 rounded-xl bg-white border border-[#E5DEC9] hover:bg-stone-100 text-[#241311] text-xs font-bold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-[#800D15]" /> Download CSV
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase text-[#4D080F]">
                    Step 2 — Upload Completed Excel (.XLS) or CSV File for Dry-Run Validation
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentModule === 'menu') {
                        setRawContent(
                          `id,name,category,productType,basePrice,status,channels,branchAvailability,componentsSpec,discountType,discountValue,wholesaleEnabled,minWholesaleQty,wholesalePrice,promoQualifyingProductId,promoMinQty,promoRewardProductId,promoRewardQty,shortDescription\nprod-sc-2000-mini,2000 Mini Pack,small-chops,package,2000,published,website|pos,gra|okabere|ugbowo,prod-snack-puff-puff-single:3|prod-snack-samosa-single:1|prod-snack-springroll-single:1|prod-sc-beef-single:1,,0,false,0,0,,0,,0,3 Puff-Puff + 1 Samosa + 1 Spring Roll + 1 Beef\nprod-bakery-special-350g,ChopLife Special Bread (Small 350g),bakery,standard,500,published,website|pos,gra|okabere|ugbowo,,,0,true,20,400,,0,,0,Soft golden buttery loaf`
                        );
                      } else if (currentModule === 'inventory') {
                        setRawContent(
                          `sku,name,category,itemType,unit,costPerUnit,reorderLevel,openingBalance,branchId\nSKU-PRO-951,Smoked Titus Fish (Whole),proteins,raw_material,pcs,2400,20,45,gra\n,Yellow Garri Fine (50kg Bag),grains_oil,raw_material,kg,950,30,60,okabere`
                        );
                      } else {
                        setRawContent(
                          `expenseDate,branchId,claimType,accountingClassification,categoryId,title,vendorName,receiptOrInvoiceRef,netAmount,vatAmount\n${new Date().toISOString().slice(0, 10)},gra,company_funded_expense,opex,cat_diesel_power,Weekend Diesel Supply (150L),Matrix Energy Benin,INV-MAT-${Date.now().toString().slice(-4)},195000,0\n${new Date().toISOString().slice(0, 10)},okabere,company_funded_expense,fixed_asset,cat_equipment_repairs,Deep Fryer Heating Element Replacement,Edo Kitchen Tech,INV-EKT-${Date.now().toString().slice(-4)},85000,6375`
                        );
                      }
                      setValidationResult(null);
                      setCommitResult(null);
                    }}
                    className="text-xs font-bold text-[#800D15] underline"
                  >
                    Load Sample Validation Rows
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <label className="px-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-dashed border-[#800D15] text-xs font-bold text-[#4D080F] cursor-pointer hover:bg-[#FFF8E7] flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#800D15]" />
                    <span>{uploadedFilename || 'Choose .XLSX, .XLS or .CSV File...'}</span>
                    <input type="file" accept=".xlsx,.xls,.xml,.csv,.txt" onChange={handleFileSelect} className="hidden" />
                  </label>

                  <button
                    onClick={handleValidateImport}
                    disabled={isSubmitting || (!fileBase64 && !rawContent.trim())}
                    className="px-4 py-2.5 rounded-xl bg-[#241311] hover:bg-[#4D080F] text-[#FFC700] text-xs font-bold disabled:opacity-50"
                  >
                    {isSubmitting ? 'Validating...' : 'Validate & Preview Rows'}
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  placeholder="Or paste CSV / SpreadsheetML content directly here..."
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl p-3 text-xs font-mono text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              {validationResult && (
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-black text-[#4D080F]">
                        Batch: {validationResult.importBatchId}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                        Valid: {validationResult.validCount}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                        Invalid: {validationResult.invalidCount}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                        Warnings: {validationResult.warningCount}
                      </span>
                    </div>

                    {validationResult.validCount > 0 && !commitResult && (
                      <button
                        onClick={handleCommitImport}
                        disabled={isSubmitting || (currentModule === 'menu' && validationResult.invalidCount > 0)}
                        className="px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {currentModule === 'menu' && validationResult.invalidCount > 0
                          ? 'Fix Invalid Rows Before Atomic Commit'
                          : `Commit ${validationResult.validCount} Valid Rows`}
                      </button>
                    )}
                  </div>

                  {validationResult.validRows?.some((vr: any) => vr.diffSummary) && (
                    <div className="p-3 rounded-xl bg-white border border-[#E5DEC9] space-y-1 text-xs text-[#241311]">
                      <p className="font-bold text-[#4D080F]">Change Preview (Diff before Commit):</p>
                      {validationResult.validRows.map((vr: any, idx: number) => (
                        <div key={idx} className="font-mono text-[11px] flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {vr.action || 'VALID'}
                          </span>
                          <span>Row {vr.rowNumber}: {vr.diffSummary}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {validationResult.invalidRows?.length > 0 && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-1 text-xs text-red-800">
                      <p className="font-bold">Rejected Rows (Blocks Atomic Commit):</p>
                      {validationResult.invalidRows.map((ir: any, idx: number) => (
                        <div key={idx} className="font-mono text-[11px]">
                          Row {ir.rowNumber}: {ir.errors.join('; ')}
                        </div>
                      ))}
                    </div>
                  )}

                  {validationResult.warnings?.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1 text-xs text-amber-900">
                      {validationResult.warnings.map((w: any, idx: number) => (
                        <div key={idx} className="font-mono text-[11px]">
                          Row {w.rowNumber}: {w.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {commitResult && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>
                        Successfully committed {commitResult.committedCount} records (Batch {commitResult.importBatchId})!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CAPEX vs OPEX BUDGET GOVERNANCE */}
          {activeTab === 'capex_opex_budgets' && budgetData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(budgetData.branchVariance || []).map((bv: any) => (
                  <div key={bv.branchId} className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-titan text-sm text-[#4D080F] uppercase">{bv.branchId} Branch</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-[#E5DEC9]">
                        OPEX {bv.opexUtilizationPct}% • CAPEX {bv.capexUtilizationPct}%
                      </span>
                    </div>
                    <div className="text-xs space-y-1 pt-1 border-t border-[#E5DEC9]">
                      <div className="flex justify-between">
                        <span className="text-stone-600">Monthly OPEX Target:</span>
                        <span className="font-mono font-bold">₦{Number(bv.monthlyOpexLimit).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Actual OPEX Incurred:</span>
                        <span className="font-mono font-bold text-[#800D15]">₦{Number(bv.actualOpex).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Monthly CAPEX Target:</span>
                        <span className="font-mono font-bold">₦{Number(bv.monthlyCapexLimit).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Actual CAPEX (Fixed Assets):</span>
                        <span className="font-mono font-bold text-emerald-800">₦{Number(bv.actualCapex).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Stock Purchases (1300):</span>
                        <span className="font-mono font-bold text-stone-700">₦{Number(bv.actualInventoryStock).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] space-y-3">
                <h4 className="text-xs font-black uppercase text-[#4D080F]">
                  Update Monthly Branch OPEX &amp; CAPEX Budget Targets
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 block mb-1">Branch</label>
                    <select
                      value={editingBranch}
                      onChange={(e) => {
                        const b = e.target.value;
                        setEditingBranch(b);
                        if (budgetData.budgets?.[b]) {
                          setOpexLimitInput(String(budgetData.budgets[b].monthlyOpexLimit || 0));
                          setCapexLimitInput(String(budgetData.budgets[b].monthlyCapexLimit || 0));
                        }
                      }}
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-bold"
                    >
                      <option value="gra">GRA Flagship</option>
                      <option value="okabere">Okabere Hub</option>
                      <option value="ugbowo">Ugbowo Campus</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 block mb-1">Monthly OPEX Limit (₦)</label>
                    <input
                      type="number"
                      value={opexLimitInput}
                      onChange={(e) => setOpexLimitInput(e.target.value)}
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 block mb-1">Monthly CAPEX Limit (₦)</label>
                    <input
                      type="number"
                      value={capexLimitInput}
                      onChange={(e) => setCapexLimitInput(e.target.value)}
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                  <button
                    onClick={handleSaveBudget}
                    disabled={isSubmitting}
                    className="py-2 px-4 rounded-xl bg-[#800D15] hover:bg-[#4D080F] text-[#FFC700] text-xs font-bold"
                  >
                    Save Budget Targets
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: eZee OPTIMUS HISTORICAL MIGRATION & RECONCILIATION */}
          {activeTab === 'ezee_migration' && (
            <div className="space-y-4">
              {ezeeDiscovery && (
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase text-[#4D080F] flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-[#800D15]" />
                      eZee Optimus Source Discovery &amp; Live Counter Isolation Status
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold">
                      Next Live Check Sequence: {ezeeDiscovery.nextLiveCheckNumber} • Migrated Historical Checks:{' '}
                      {ezeeDiscovery.currentHistoricalMigratedCount}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    {(ezeeDiscovery.availabilityMatrix || []).slice(0, 3).map((m: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl bg-white border border-[#E5DEC9]">
                        <div className="font-bold text-[#241311]">{m.domain}</div>
                        <div className="text-emerald-700 font-semibold text-[10px]">{m.status}</div>
                        <div className="text-stone-500 text-[10px] mt-0.5">{m.isolationRule}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase text-[#4D080F]">
                      Upload eZee Optimus Workbook (.XLSX / .XLS) or CSV Report
                    </h4>
                    <p className="text-xs text-stone-500">
                      Supports direct binary Excel workbooks, multi-sheet selection, automatic report detection &amp; column mapping.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRawContent(
                        `legacyRecordId,outlet,originalTimestamp,grossAmount,discountAmount,netAmount,paymentMethod,customerName,itemSummary\nEZ-2025-9001,eZee GRA Flagship,2025-12-18T13:20:00.000Z,18500,500,18000,POS Card,Chief Osasere,Smoky Party Jollof & Grilled Catfish Platter\nEZ-2025-9002,eZee Okabere,2025-12-19T18:45:00.000Z,9200,0,9200,Cash,Walk-in Patron,Asun Peppered Goat & Fresh Agege Bread\nEZ-2025-9003,eZee Ugbowo,2025-12-20T15:10:00.000Z,6500,0,6500,Bank Transfer,UNIBEN Student Group,Student Shawarma & Zobo Combo`
                      );
                      setFileBase64('');
                      setUploadedFilename('sample_ezee_sales.csv');
                      setEzeeInspectResult(null);
                      setEzeeDryRunReport(null);
                      setEzeeCommitResult(null);
                    }}
                    className="text-xs font-bold text-[#800D15] underline"
                  >
                    Load Sample eZee CSV Data
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="px-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-dashed border-[#800D15] text-xs font-bold text-[#4D080F] cursor-pointer hover:bg-[#FFF8E7] flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#800D15]" />
                    <span>{uploadedFilename || 'Choose .XLSX, .XLS or .CSV Workbook...'}</span>
                    <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFileSelect} className="hidden" />
                  </label>

                  <button
                    onClick={handleEzeeDryRun}
                    disabled={isSubmitting || (!fileBase64 && !rawContent.trim())}
                    className="px-4 py-2.5 rounded-xl bg-[#241311] hover:bg-[#4D080F] text-[#FFC700] text-xs font-bold disabled:opacity-50"
                  >
                    {isSubmitting ? 'Running Dry-Run...' : 'Execute eZee Dry-Run & Reconciliation'}
                  </button>
                </div>

                {/* Inspected Workbook Metadata & Column Mapping */}
                {ezeeInspectResult && (
                  <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-[#800D15]" />
                        <span className="font-bold text-[#4D080F]">{ezeeInspectResult.filename}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">
                          SHA: {ezeeInspectResult.checksum?.slice(0, 12)}...
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Report: {ezeeInspectResult.detectedReportType}
                        </span>
                      </div>

                      {ezeeInspectResult.sheetNames?.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-bold text-stone-600">Select Sheet:</label>
                          <select
                            value={selectedSheet}
                            onChange={(e) => setSelectedSheet(e.target.value)}
                            className="bg-white border border-[#E5DEC9] rounded-lg px-2 py-1 text-xs font-bold"
                          >
                            {ezeeInspectResult.sheetNames.map((s: string) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Column Mapping Selectors */}
                    <div>
                      <h5 className="text-[11px] font-black uppercase text-[#4D080F] mb-1.5">
                        Verify Column Mappings (eZee Fields &rarr; ChopLife Canonical)
                      </h5>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {[
                          { key: 'legacyRecordId', label: 'Receipt / Bill No' },
                          { key: 'outlet', label: 'Outlet / Branch' },
                          { key: 'originalTimestamp', label: 'Date / Timestamp' },
                          { key: 'grossAmount', label: 'Gross Amount' },
                          { key: 'discountAmount', label: 'Discount Amount' },
                          { key: 'netAmount', label: 'Net Amount / Total' },
                          { key: 'paymentMethod', label: 'Payment Method / Tender' },
                          { key: 'customerName', label: 'Customer / Guest Name' },
                          { key: 'itemSummary', label: 'Item Summary / Description' },
                        ].map((field) => (
                          <div key={field.key} className="bg-white p-2 rounded-lg border border-[#E5DEC9]">
                            <label className="text-[10px] font-bold text-stone-600 block mb-0.5">{field.label}</label>
                            <select
                              value={columnMapping[field.key] || ''}
                              onChange={(e) =>
                                setColumnMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded px-1.5 py-1 text-[11px] font-mono"
                            >
                              <option value="">-- Auto-Detect ({columnMapping[field.key] || 'None'}) --</option>
                              {(ezeeInspectResult.activeSheet?.headers || []).map((h: string) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sample Rows Preview */}
                    {ezeeInspectResult.activeSheet?.previewRows?.length > 0 && (
                      <div className="overflow-x-auto border border-[#E5DEC9] rounded-lg">
                        <table className="min-w-full divide-y divide-[#E5DEC9] text-[10px]">
                          <thead className="bg-stone-100 font-bold text-[#4D080F]">
                            <tr>
                              {(ezeeInspectResult.activeSheet?.headers || []).slice(0, 6).map((h: string) => (
                                <th key={h} className="px-2 py-1 text-left">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-[#E5DEC9]">
                            {ezeeInspectResult.activeSheet.previewRows.map((row: any, rIdx: number) => (
                              <tr key={rIdx}>
                                {(ezeeInspectResult.activeSheet?.headers || []).slice(0, 6).map((h: string) => (
                                  <td key={h} className="px-2 py-1 font-mono text-stone-700">{row[h]}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* CSV Raw Content textarea fallback */}
                {!fileBase64 && (
                  <textarea
                    rows={3}
                    value={rawContent}
                    onChange={(e) => setRawContent(e.target.value)}
                    placeholder="Or paste CSV export directly here (legacyRecordId,outlet,originalTimestamp,grossAmount,discountAmount,netAmount,paymentMethod,customerName,itemSummary)..."
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl p-3 text-xs font-mono text-[#241311]"
                  />
                )}
              </div>

              {ezeeDryRunReport && (
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h5 className="text-xs font-black text-[#4D080F] uppercase">
                        eZee Optimus Reconciliation Report ({ezeeDryRunReport.migrationBatchId})
                      </h5>
                      <p className="text-[11px] text-stone-600">
                        Source Records: {ezeeDryRunReport.recordCounts?.sourceTotal} • Ready:{' '}
                        {ezeeDryRunReport.recordCounts?.targetReadyToCommit} • Duplicates Skipped:{' '}
                        {ezeeDryRunReport.recordCounts?.duplicateSkipped} • Invalid:{' '}
                        {ezeeDryRunReport.recordCounts?.invalidRejected}
                      </p>
                    </div>
                    {ezeeDryRunReport.recordCounts?.targetReadyToCommit > 0 && !ezeeCommitResult && (
                      <button
                        onClick={handleEzeeCommit}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Commit Historical Batch ({ezeeDryRunReport.recordCounts.targetReadyToCommit} Records)
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-[#E5DEC9]">
                      <span className="text-[10px] text-stone-500 block">Target Gross Sales</span>
                      <span className="font-mono font-bold">
                        ₦{Number(ezeeDryRunReport.financialParity?.targetGrossSales || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-[#E5DEC9]">
                      <span className="text-[10px] text-stone-500 block">Target Net Sales</span>
                      <span className="font-mono font-bold text-emerald-700">
                        ₦{Number(ezeeDryRunReport.financialParity?.targetNetSales || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-[#E5DEC9]">
                      <span className="text-[10px] text-stone-500 block">Reconciliation Variance</span>
                      <span className="font-mono font-bold">
                        ₦{Number(ezeeDryRunReport.financialParity?.netVarianceNaira || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-[#E5DEC9]">
                      <span className="text-[10px] text-stone-500 block">Live Check Sequence</span>
                      <span className="font-mono font-bold text-[#800D15]">
                        {ezeeDryRunReport.liveCounterIsolationCheck?.liveSequenceAfterDryRun} (Untouched)
                      </span>
                    </div>
                  </div>

                  {ezeeCommitResult && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span>
                          Committed {ezeeCommitResult.committedCount} eZee historical records! Live check sequence
                          verified untouched at {ezeeCommitResult.liveSequenceAfterCommit}.
                        </span>
                      </div>
                      <button
                        onClick={() => handleEzeeRollback(ezeeCommitResult.migrationBatchId)}
                        disabled={isSubmitting}
                        className="px-2.5 py-1 rounded bg-red-100 hover:bg-red-200 text-red-800 text-[11px] font-bold"
                      >
                        Rollback Batch
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Committed Batches & Rollback Audit Register */}
              {ezeeDiscovery?.committedBatches?.length > 0 && (
                <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] space-y-2.5">
                  <h5 className="text-xs font-black uppercase text-[#4D080F]">
                    Audited eZee Migration Batches &amp; Rollback Governance
                  </h5>
                  <div className="space-y-2">
                    {ezeeDiscovery.committedBatches.map((b: any) => (
                      <div
                        key={b.migrationBatchId}
                        className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-[#4D080F] flex items-center gap-2">
                            <span>{b.migrationBatchId}</span>
                            {b.rolledBack ? (
                              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px]">ROLLED BACK</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">ACTIVE</span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            Committed: {b.committedCount || b.recordCounts?.targetReadyToCommit} records • Net: ₦
                            {Number(b.financialParity?.targetNetSales || 0).toLocaleString()} • {b.committedAt || b.timestamp}
                          </div>
                        </div>

                        {!b.rolledBack && (
                          <button
                            onClick={() => handleEzeeRollback(b.migrationBatchId)}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-bold"
                          >
                            Rollback Batch
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
