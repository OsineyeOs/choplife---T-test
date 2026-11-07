import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  FileText,
  Printer,
  Filter,
  ShieldCheck,
  Building2,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Lock,
  Calculator,
  Database,
  Search,
  Eye,
  X,
  Layers,
  UtensilsCrossed,
  CreditCard,
  Clock,
  User,
  Phone,
  MapPin,
  Receipt,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ReportDefinition {
  code: string;
  title: string;
  domain: string;
  description: string;
  formulaDefinition: string;
  sourceTables: string[];
  allowedRoles: string[];
  supportsBranchFilter: boolean;
  supportsDateRange: boolean;
  sensitiveDataControl?: string;
}

interface GeneratedReportPayload {
  generatedAt: string;
  generatedBy: {
    name: string;
    role: string;
    branchScope: string;
  };
  report: ReportDefinition;
  effectiveBranchId: string;
  summaryMetrics: Array<{ label: string; value: string | number; subtext?: string }>;
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center' }>;
  rows: Array<Record<string, any>>;
}

interface ReceiptDetailPayload {
  receiptNumber: string;
  orderId?: string;
  checkId?: string;
  branchId: string;
  branchName: string;
  channel: string;
  serviceType: string;
  status: string;
  timestamps: {
    openedAt?: string;
    sentToKitchenAt?: string;
    paidAt?: string;
    closedAt?: string;
  };
  customer: {
    name: string;
    phone: string;
    tableNumber: string;
    address: string;
  };
  staff: {
    openedByName: string;
    cashierName: string;
    waiterName: string;
    approverName: string;
    riderName: string;
  };
  financials: {
    grossSubtotal: number;
    discountAmount: number;
    discountReason?: string;
    packagingFee: number;
    deliveryFee: number;
    taxAmount: number;
    total: number;
    amountPaid: number;
    remainingBalance: number;
  };
  items: Array<{
    id: string;
    productId: string;
    name: string;
    category: string;
    productType: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    discountAmount: number;
    notes?: string;
    modifiers: any[];
    constituents: Array<{
      productId: string;
      name: string;
      quantity: number;
      unit: string;
      unitPrice: number;
    }>;
    packaging?: {
      name: string;
      quantity: number;
    };
    recipeBOM: Array<{
      ingredientId: string;
      ingredientName: string;
      quantity: string;
      portionCost?: number;
    }>;
  }>;
  tenders: Array<{
    method: string;
    amount: number;
    reference?: string;
    cashierName?: string;
    timestamp?: string;
    shareLabel?: string;
    cashTendered?: number;
    changeGiven?: number;
  }>;
  splitShares: Array<{
    shareId: string;
    shareIndex: number;
    label: string;
    allocatedAmount: number;
    paidAmount: number;
    status: string;
  }>;
  stockDeductions: Array<{
    ingredient: string;
    quantity: string;
    forItem: string;
    timestamp: string;
  }>;
  auditTrail: Array<{
    id: string;
    timestamp: string;
    staffName: string;
    staffRole: string;
    actionType: string;
    details: string;
  }>;
}

export const EnterpriseReportsHub: React.FC = () => {
  const { currentStaff, selectedBranchId } = useApp();
  const [catalogue, setCatalogue] = useState<ReportDefinition[]>([]);
  const [selectedReportCode, setSelectedReportCode] = useState<string>('report.sales_summary');
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(
    currentStaff && ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor'].includes(currentStaff.role)
      ? 'all'
      : selectedBranchId || 'gra'
  );
  const [dateFrom, setDateFrom] = useState<string>('2026-01-01');
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [includeUnmaskedBankDetails, setIncludeUnmaskedBankDetails] = useState<boolean>(false);

  const [reportData, setReportData] = useState<GeneratedReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Table Search, Sort & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);

  // Receipt Level Audit Modal / Drawer State
  const [inspectedReceiptId, setInspectedReceiptId] = useState<string | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<ReceiptDetailPayload | null>(null);
  const [receiptLoading, setReceiptLoading] = useState<boolean>(false);
  const [activeReceiptTab, setActiveReceiptTab] = useState<'items' | 'tenders' | 'bom' | 'customer' | 'audit'>('items');

  const getAuthHeaders = useCallback(() => {
    const token =
      (typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('choplife_staff_token') ||
          window.localStorage.getItem('choplife_staff_session_token') ||
          window.localStorage.getItem('choplife_auth_token')
        : null) || '';
    const staffId = currentStaff?.id || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(staffId ? { 'X-Staff-Id': staffId } : {}),
    };
  }, [currentStaff]);

  const isGlobalRole =
    currentStaff && ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor'].includes(currentStaff.role);

  const fetchCatalogue = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/catalogue', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const reps: ReportDefinition[] = data.reports || [];
        setCatalogue(reps);
        if (reps.length > 0 && !reps.some((r) => r.code === selectedReportCode)) {
          setSelectedReportCode(reps[0].code);
        }
      }
    } catch (err) {
      console.error('Failed to fetch reports catalogue:', err);
    }
  }, [getAuthHeaders, selectedReportCode]);

  const generateReport = useCallback(
    async (codeToRun?: string) => {
      const targetCode = codeToRun || selectedReportCode;
      if (!targetCode) return;
      setIsLoading(true);
      setFeedback(null);
      setCurrentPage(1);
      try {
        const res = await fetch('/api/reports/generate', {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify({
            reportCode: targetCode,
            branchId: branchFilter,
            dateFrom,
            dateTo,
            includeUnmaskedBankDetails,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setReportData(data);
        } else {
          setFeedback({ type: 'error', message: data.error || 'Failed to generate report.' });
        }
      } catch {
        setFeedback({ type: 'error', message: 'Network error connecting to reporting engine.' });
      } finally {
        setIsLoading(false);
      }
    },
    [selectedReportCode, branchFilter, dateFrom, dateTo, includeUnmaskedBankDetails, getAuthHeaders]
  );

  useEffect(() => {
    fetchCatalogue();
  }, [fetchCatalogue]);

  useEffect(() => {
    if (selectedReportCode) {
      generateReport(selectedReportCode);
    }
  }, [selectedReportCode, branchFilter, dateFrom, dateTo, includeUnmaskedBankDetails, generateReport]);

  const handleExport = async (format: 'csv' | 'xlsx' | 'print_html') => {
    setIsExporting(format);
    setFeedback(null);
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          reportCode: selectedReportCode,
          format,
          branchId: branchFilter,
          dateFrom,
          dateTo,
          includeUnmaskedBankDetails,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: err.error || 'Export blocked by RBAC policy.' });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const ext = format === 'csv' ? 'csv' : format === 'xlsx' ? 'xlsx' : 'html';
      const filename = `${selectedReportCode.replace(/\./g, '_')}_${branchFilter}_${dateTo}.${ext}`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFeedback({
        type: 'success',
        message: `Audited ${format.toUpperCase()} export downloaded (${filename}). Export event logged to immutable security audit trail.`,
      });
    } catch {
      setFeedback({ type: 'error', message: 'Network error while exporting report.' });
    } finally {
      setIsExporting(null);
    }
  };

  const handleInspectReceipt = async (receiptRefOrId: string) => {
    if (!receiptRefOrId) return;
    setInspectedReceiptId(receiptRefOrId);
    setReceiptLoading(true);
    setReceiptDetail(null);
    setActiveReceiptTab('items');
    try {
      const res = await fetch(`/api/reports/receipt/${encodeURIComponent(receiptRefOrId)}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setReceiptDetail(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: err.error || `Could not load receipt audit for ${receiptRefOrId}` });
        setInspectedReceiptId(null);
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to connect to receipt audit service.' });
      setInspectedReceiptId(null);
    } finally {
      setReceiptLoading(false);
    }
  };

  const domains = ['ALL', ...Array.from(new Set(catalogue.map((r) => r.domain)))];
  const filteredCatalogue = catalogue.filter((r) => selectedDomain === 'ALL' || r.domain === selectedDomain);
  const activeDef = catalogue.find((r) => r.code === selectedReportCode) || reportData?.report;

  // Process rows with search & sorting
  const processedRows = useMemo(() => {
    if (!reportData?.rows) return [];
    let list = [...reportData.rows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) =>
        Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))
      );
    }

    if (sortColumn) {
      list.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA ?? '').toLowerCase();
        const strB = String(valB ?? '').toLowerCase();
        if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
        if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [reportData?.rows, searchQuery, sortColumn, sortDirection]);

  // Paginated Rows
  const totalPages = Math.max(1, Math.ceil(processedRows.length / rowsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return processedRows.slice(start, start + rowsPerPage);
  }, [processedRows, currentPage, rowsPerPage]);

  const toggleSort = (colKey: string) => {
    if (sortColumn === colKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  };

  return (
    <div id="enterprise-reports-hub" className="flex-1 flex flex-col bg-[#FAF7F2] text-stone-900 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-7xl mx-auto w-full space-y-5">
        {/* Top Header */}
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#800D15] text-[#FFC700] flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-stone-900">
                  Enterprise Reports, Metric Dictionary &amp; Audited Exports
                </h1>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  RBAC &amp; Formula Sanitized
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#4D080F]/10 text-[#4D080F] text-[10px] font-black uppercase tracking-wider">
                  {catalogue.length} Authoritative Reports
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Full-fidelity transactional auditing: drill down from executive summaries to individual orders, receipts, combo constituents, tenders, and raw material stock deductions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => generateReport()}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#FAF7F2] hover:bg-stone-100 border border-[#E5DEC9] text-stone-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#800D15] ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>

            <button
              id="export-report-csv-btn"
              onClick={() => handleExport('csv')}
              disabled={Boolean(isExporting) || isLoading}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isExporting === 'csv' ? 'Exporting...' : 'Export CSV'}</span>
            </button>

            <button
              id="export-report-xlsx-btn"
              onClick={() => handleExport('xlsx')}
              disabled={Boolean(isExporting) || isLoading}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-300 text-[#4D080F] text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Exports authentic 6-sheet workbook: Summary, Report Data, Transaction Receipts, Line Items, Tenders, Audit & Verification"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#800D15]" />
              <span>{isExporting === 'xlsx' ? 'Building 6-Sheet XLSX...' : 'Export Multi-Sheet XLSX'}</span>
            </button>

            <button
              id="export-report-print-btn"
              onClick={() => handleExport('print_html')}
              disabled={Boolean(isExporting) || isLoading}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-stone-500" />
              <span>Audit Print</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-stone-400 hover:text-stone-700 text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Grid: Left Catalogue Sidebar + Right Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Catalogue Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#800D15]" />
                  Authoritative Catalogue
                </span>
                <span className="text-[11px] font-bold text-stone-500">
                  {filteredCatalogue.length} Available
                </span>
              </div>

              {/* Domain Filter Pills */}
              <div className="flex flex-wrap gap-1">
                {domains.map((dom) => (
                  <button
                    key={dom}
                    onClick={() => setSelectedDomain(dom)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      selectedDomain === dom
                        ? 'bg-[#800D15] text-[#FFC700] shadow-xs'
                        : 'bg-[#FAF7F2] text-stone-600 hover:bg-stone-200/70 border border-[#E5DEC9]'
                    }`}
                  >
                    {dom}
                  </button>
                ))}
              </div>

              {/* Report List Items */}
              <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
                {filteredCatalogue.map((rep) => {
                  const isSelected = rep.code === selectedReportCode;
                  return (
                    <button
                      key={rep.code}
                      onClick={() => setSelectedReportCode(rep.code)}
                      className={`w-full text-left p-3 rounded-xl transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-[#FAF7F2] border-[#800D15] text-[#800D15] shadow-xs font-bold'
                          : 'bg-white hover:bg-stone-50 border-stone-100 text-stone-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="text-xs font-black leading-snug">{rep.title}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 shrink-0">
                          {rep.domain}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 line-clamp-2 mt-1 leading-normal font-normal">
                        {rep.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-8 space-y-4">
            {/* Filter Bar */}
            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-stone-700">
                <Filter className="w-4 h-4 text-[#800D15]" />
                <span>Report Parameters</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Branch Scope
                </label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  disabled={!isGlobalRole}
                  className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-bold text-stone-900 disabled:opacity-60 cursor-pointer"
                >
                  {isGlobalRole && <option value="all">All Choplife Branches (Consolidated)</option>}
                  <option value="gra">Benin GRA Flagship (Okogo)</option>
                  <option value="okabere">Benin Okabere Road Hub</option>
                  <option value="ugbowo">Benin Ugbowo Campus Hub</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> From Date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-bold text-stone-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> To Date
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-bold text-stone-900"
                />
              </div>

              {selectedReportCode === 'report.payroll_register' && (
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeUnmaskedBankDetails}
                    onChange={(e) => setIncludeUnmaskedBankDetails(e.target.checked)}
                    className="rounded border-amber-400 text-[#800D15]"
                  />
                  <Lock className="w-3.5 h-3.5 text-[#800D15]" />
                  <span>Unmask Bank Accounts (Disbursement Auth Only)</span>
                </label>
              )}
            </div>

            {/* Metric Dictionary & Source Authority Card */}
            {activeDef && (
              <div className="bg-[#241311] text-[#FAF7F2] rounded-2xl p-4 shadow-xs space-y-2 border border-[#FFC700]/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#FFC700]" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">{activeDef.title}</h2>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-300">
                    <Database className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>Tables: {activeDef.sourceTables.join(', ')}</span>
                  </div>
                </div>
                <p className="text-xs text-stone-300">{activeDef.description}</p>
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/10 flex items-start gap-2 text-[11px] text-[#FFC700]">
                  <Calculator className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black uppercase tracking-wider mr-1.5">Canonical Metric Formula:</span>
                    <span className="font-mono text-stone-100">{activeDef.formulaDefinition}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Summary KPI Cards */}
            {reportData && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {reportData.summaryMetrics.map((m, idx) => (
                  <div key={idx} className="bg-white border border-[#E5DEC9] rounded-xl p-3.5 shadow-2xs">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">{m.label}</div>
                    <div className="text-sm sm:text-base font-black text-stone-900 mt-1 tabular-nums">{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Search, Rows Per Page & Data Table Controls */}
            <div className="bg-white border border-[#E5DEC9] rounded-2xl shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3 bg-[#FAF7F2]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-stone-800">
                    Reconciled Statement Rows ({processedRows.length})
                  </span>
                  {searchQuery && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                      Filtered from {reportData?.rows.length || 0}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter rows (ref, item, staff)..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-8 pr-3 py-1 text-xs rounded-xl border border-[#E5DEC9] bg-white text-stone-800 placeholder-stone-400 focus:outline-hidden focus:border-[#800D15] w-48 sm:w-60 font-medium"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Rows Per Page */}
                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                    <span className="text-[10px] font-bold uppercase text-stone-400">Show:</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 rounded-lg border border-[#E5DEC9] bg-white text-xs font-bold text-stone-800"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-100 border-b border-[#E5DEC9] text-[10px] font-black uppercase tracking-wider text-stone-600">
                      {reportData?.columns.map((col) => (
                        <th
                          key={col.key}
                          onClick={() => toggleSort(col.key)}
                          className={`py-2.5 px-3.5 whitespace-nowrap cursor-pointer hover:bg-stone-200/70 select-none ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          <div className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                            <span>{col.label}</span>
                            <ArrowUpDown className="w-3 h-3 opacity-50 hover:opacity-100" />
                          </div>
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Audit Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-xs">
                    {!reportData || paginatedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={(reportData?.columns.length || 5) + 1}
                          className="py-10 text-center text-stone-400 font-semibold"
                        >
                          {isLoading ? 'Generating authoritative report...' : 'No matching records found for the selected filters.'}
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, rIdx) => {
                        const targetReceiptId = row.ref || row.orderId || row.checkId;
                        return (
                          <tr key={rIdx} className="hover:bg-[#FFF8E7]/50 transition-colors">
                            {reportData.columns.map((col) => {
                              const val = row[col.key];
                              const formatted =
                                typeof val === 'number' ? val.toLocaleString() : String(val ?? '—');
                              const isRefCol = col.key === 'ref';

                              return (
                                <td
                                  key={col.key}
                                  className={`py-2.5 px-3.5 whitespace-nowrap ${
                                    col.align === 'right'
                                      ? 'text-right font-mono font-bold text-stone-900 tabular-nums'
                                      : 'text-stone-700 font-medium'
                                  }`}
                                >
                                  {isRefCol && targetReceiptId ? (
                                    <button
                                      type="button"
                                      onClick={() => handleInspectReceipt(targetReceiptId)}
                                      className="font-bold text-[#800D15] hover:text-[#B31B25] hover:underline flex items-center gap-1 cursor-pointer"
                                      title="Click to inspect complete transaction receipt & constituents"
                                    >
                                      <span>{formatted}</span>
                                      <Eye className="w-3 h-3 opacity-70" />
                                    </button>
                                  ) : (
                                    formatted
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              {targetReceiptId ? (
                                <button
                                  type="button"
                                  onClick={() => handleInspectReceipt(targetReceiptId)}
                                  className="px-2.5 py-1 rounded-lg bg-[#800D15]/10 hover:bg-[#800D15] text-[#800D15] hover:text-[#FFC700] text-[11px] font-bold flex items-center gap-1 mx-auto transition cursor-pointer"
                                  title="Audit receipt, modifier constituents and inventory consumption"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>Inspect</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-stone-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {processedRows.length > 0 && (
                <div className="p-3 bg-[#FAF7F2] border-t border-[#E5DEC9] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-stone-500">
                    Showing <strong className="text-stone-800">{(currentPage - 1) * rowsPerPage + 1}</strong> to{' '}
                    <strong className="text-stone-800">{Math.min(currentPage * rowsPerPage, processedRows.length)}</strong> of{' '}
                    <strong className="text-stone-800">{processedRows.length}</strong> entries
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-[#E5DEC9] bg-white text-stone-700 disabled:opacity-40 hover:bg-stone-50 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2.5 py-1 font-bold text-stone-800 bg-white border border-[#E5DEC9] rounded-lg">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-[#E5DEC9] bg-white text-stone-700 disabled:opacity-40 hover:bg-stone-50 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RECEIPT-LEVEL AUDIT MODAL / DRAWER */}
      {inspectedReceiptId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#E5DEC9] shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#241311] text-[#FAF7F2] flex items-start justify-between gap-4 border-b border-[#FFC700]/30 shrink-0">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#FFC700] flex items-center gap-1.5">
                    <Receipt className="w-4 h-4" />
                    Transaction &amp; Receipt Audit Inspector
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-stone-800 text-white font-mono text-xs font-black">
                    #{receiptDetail?.receiptNumber || inspectedReceiptId}
                  </span>
                  {receiptDetail && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        receiptDetail.status === 'PAID' || receiptDetail.status === 'SETTLED'
                          ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-500/30'
                          : receiptDetail.status === 'OPEN'
                          ? 'bg-amber-900/80 text-amber-200 border border-amber-500/30'
                          : 'bg-rose-900/80 text-rose-200 border border-rose-500/30'
                      }`}
                    >
                      {receiptDetail.status}
                    </span>
                  )}
                </div>
                <div className="text-xs text-stone-300 flex flex-wrap items-center gap-2">
                  <span>Branch: <strong className="text-white">{receiptDetail?.branchName || receiptDetail?.branchId || 'GRA'}</strong></span>
                  <span>•</span>
                  <span>Channel: <strong className="text-white">{receiptDetail?.channel}</strong></span>
                  <span>•</span>
                  <span>Service: <strong className="text-white">{receiptDetail?.serviceType}</strong></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedReceiptId(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#FAF7F2]">
              {receiptLoading ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-[#800D15] animate-spin mx-auto" />
                  <p className="text-sm font-bold text-stone-600">Retrieving authoritative receipt, BOM &amp; tender records...</p>
                </div>
              ) : receiptDetail ? (
                <>
                  {/* Financial Overview Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <div className="bg-white border border-[#E5DEC9] rounded-xl p-3 shadow-2xs">
                      <div className="text-[10px] font-extrabold uppercase text-stone-500">Gross Subtotal</div>
                      <div className="text-sm font-black text-stone-900 mt-0.5 tabular-nums">
                        ₦{receiptDetail.financials.grossSubtotal.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white border border-[#E5DEC9] rounded-xl p-3 shadow-2xs">
                      <div className="text-[10px] font-extrabold uppercase text-stone-500">Discounts</div>
                      <div className="text-sm font-black text-rose-700 mt-0.5 tabular-nums">
                        ₦{receiptDetail.financials.discountAmount.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white border border-[#E5DEC9] rounded-xl p-3 shadow-2xs">
                      <div className="text-[10px] font-extrabold uppercase text-stone-500">Packaging Fee</div>
                      <div className="text-sm font-black text-stone-900 mt-0.5 tabular-nums">
                        ₦{receiptDetail.financials.packagingFee.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white border border-[#E5DEC9] rounded-xl p-3 shadow-2xs">
                      <div className="text-[10px] font-extrabold uppercase text-stone-500">Delivery Fee</div>
                      <div className="text-sm font-black text-stone-900 mt-0.5 tabular-nums">
                        ₦{receiptDetail.financials.deliveryFee.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#4D080F] text-[#FFC700] rounded-xl p-3 shadow-xs">
                      <div className="text-[10px] font-extrabold uppercase text-stone-300">Total Settled</div>
                      <div className="text-sm font-black mt-0.5 tabular-nums">
                        ₦{receiptDetail.financials.total.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 shadow-2xs">
                      <div className="text-[10px] font-extrabold uppercase text-emerald-800">Paid / Balance</div>
                      <div className="text-sm font-black text-emerald-950 mt-0.5 tabular-nums">
                        ₦{receiptDetail.financials.amountPaid.toLocaleString()} / ₦{receiptDetail.financials.remainingBalance.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Audit Tabs */}
                  <div className="flex flex-wrap gap-1 border-b border-[#E5DEC9] pb-2">
                    <button
                      onClick={() => setActiveReceiptTab('items')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        activeReceiptTab === 'items'
                          ? 'bg-[#800D15] text-[#FFC700]'
                          : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#E5DEC9]'
                      }`}
                    >
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                      <span>Itemized Lines &amp; Combos ({receiptDetail.items.length})</span>
                    </button>
                    <button
                      onClick={() => setActiveReceiptTab('tenders')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        activeReceiptTab === 'tenders'
                          ? 'bg-[#800D15] text-[#FFC700]'
                          : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#E5DEC9]'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Tenders &amp; Split Allocations ({receiptDetail.tenders.length})</span>
                    </button>
                    <button
                      onClick={() => setActiveReceiptTab('bom')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        activeReceiptTab === 'bom'
                          ? 'bg-[#800D15] text-[#FFC700]'
                          : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#E5DEC9]'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Recipe BOM &amp; Stock Deductions</span>
                    </button>
                    <button
                      onClick={() => setActiveReceiptTab('customer')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        activeReceiptTab === 'customer'
                          ? 'bg-[#800D15] text-[#FFC700]'
                          : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#E5DEC9]'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Staff &amp; Customer Attribution</span>
                    </button>
                    <button
                      onClick={() => setActiveReceiptTab('audit')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        activeReceiptTab === 'audit'
                          ? 'bg-[#800D15] text-[#FFC700]'
                          : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#E5DEC9]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Chronological Audit Trail ({receiptDetail.auditTrail.length})</span>
                    </button>
                  </div>

                  {/* Tab 1: Itemized Lines & Combos */}
                  {activeReceiptTab === 'items' && (
                    <div className="bg-white rounded-2xl border border-[#E5DEC9] p-4 shadow-xs space-y-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-stone-800">
                        Itemized Receipt Lines &amp; Package Decomposition
                      </h3>
                      <div className="divide-y divide-[#E5DEC9]">
                        {receiptDetail.items.map((it, idx) => (
                          <div key={idx} className="py-3 first:pt-0 last:pb-0 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-stone-900">{it.name}</span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-stone-100 text-stone-600">
                                    {it.productType}
                                  </span>
                                  <span className="text-xs text-stone-500 font-medium">({it.category})</span>
                                </div>
                                {it.notes && (
                                  <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-0.5 mt-1 inline-block">
                                    Note: {it.notes}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-bold text-sm text-stone-900">
                                  ₦{it.totalPrice.toLocaleString()}
                                </div>
                                <div className="text-[11px] text-stone-500">
                                  {it.quantity} × ₦{it.unitPrice.toLocaleString()}
                                </div>
                              </div>
                            </div>

                            {/* Combo Constituents Decomposition */}
                            {it.constituents && it.constituents.length > 0 && (
                              <div className="ml-4 pl-3 border-l-2 border-[#FFC700] bg-[#FAF7F2] rounded-r-xl p-2.5 space-y-1.5">
                                <div className="text-[10px] font-black uppercase tracking-wider text-[#800D15] flex items-center gap-1">
                                  <PackageCheck className="w-3 h-3" />
                                  <span>Package Constituents Breakdown:</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-stone-700">
                                  {it.constituents.map((comp, cIdx) => (
                                    <div key={cIdx} className="flex items-center justify-between bg-white px-2.5 py-1 rounded-md border border-[#E5DEC9]">
                                      <span className="font-medium">• {comp.name}</span>
                                      <span className="font-bold tabular-nums text-stone-600">
                                        {comp.quantity * it.quantity} {comp.unit || 'portions'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Packaging Attached */}
                            {it.packaging && (
                              <div className="text-[11px] text-stone-500 flex items-center gap-2 pl-4">
                                <span className="font-bold text-stone-600">Packaging Applied:</span>
                                <span>{it.packaging.name} (Qty: {it.packaging.quantity * it.quantity})</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Tenders & Split Allocations */}
                  {activeReceiptTab === 'tenders' && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-2xl border border-[#E5DEC9] p-4 shadow-xs space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-stone-800">
                          Recorded Payment Tenders ({receiptDetail.tenders.length})
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-stone-50 text-stone-600 font-bold border-b border-[#E5DEC9]">
                                <th className="py-2 px-3">Tender Method</th>
                                <th className="py-2 px-3 text-right">Settled Amount (₦)</th>
                                <th className="py-2 px-3">Slip / Reference</th>
                                <th className="py-2 px-3">Cashier / Staff</th>
                                <th className="py-2 px-3">Timestamp</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {receiptDetail.tenders.map((t, idx) => (
                                <tr key={idx} className="hover:bg-stone-50/50">
                                  <td className="py-2 px-3 font-bold uppercase text-stone-800">{t.method}</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-stone-900 tabular-nums">
                                    ₦{Number(t.amount || 0).toLocaleString()}
                                  </td>
                                  <td className="py-2 px-3 font-mono text-stone-600">{t.reference || 'N/A'}</td>
                                  <td className="py-2 px-3 text-stone-700">{t.cashierName || 'Staff'}</td>
                                  <td className="py-2 px-3 text-stone-500">{(t.timestamp || '').slice(0, 16).replace('T', ' ')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Split Check Details (if split) */}
                      {receiptDetail.splitShares && receiptDetail.splitShares.length > 0 && (
                        <div className="bg-white rounded-2xl border border-[#E5DEC9] p-4 shadow-xs space-y-3">
                          <h3 className="text-xs font-black uppercase tracking-wider text-stone-800">
                            Split Check Share Allocations ({receiptDetail.splitShares.length} Guests)
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {receiptDetail.splitShares.map((share, sIdx) => (
                              <div key={sIdx} className="p-3 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2] space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-stone-900">{share.label}</span>
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                    share.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {share.status}
                                  </span>
                                </div>
                                <div className="text-xs text-stone-600">
                                  Allocated: <strong className="font-mono text-stone-900">₦{share.allocatedAmount.toLocaleString()}</strong>
                                </div>
                                <div className="text-xs text-stone-600">
                                  Paid: <strong className="font-mono text-emerald-800">₦{share.paidAmount.toLocaleString()}</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Recipe BOM & Stock Deductions */}
                  {activeReceiptTab === 'bom' && (
                    <div className="bg-white rounded-2xl border border-[#E5DEC9] p-4 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-[#800D15]" />
                          Raw Inventory Depletions &amp; Recipe Bill of Materials (BOM)
                        </h3>
                        <span className="text-[11px] text-stone-500">
                          {receiptDetail.stockDeductions.length} Deductions Calculated
                        </span>
                      </div>

                      {receiptDetail.stockDeductions.length === 0 ? (
                        <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-center text-xs text-stone-500">
                          Direct recipe BOM consumption linked to item compositions. See itemized constituents tab for decomposed components.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-stone-50 text-stone-600 font-bold border-b border-[#E5DEC9]">
                                <th className="py-2 px-3">Raw Inventory Ingredient</th>
                                <th className="py-2 px-3 text-right">Depleted Quantity</th>
                                <th className="py-2 px-3">Derived From Menu Item</th>
                                <th className="py-2 px-3">Timestamp</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {receiptDetail.stockDeductions.map((sd, idx) => (
                                <tr key={idx} className="hover:bg-stone-50/50">
                                  <td className="py-2 px-3 font-bold text-stone-900">{sd.ingredient}</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-[#800D15] tabular-nums">
                                    {sd.quantity}
                                  </td>
                                  <td className="py-2 px-3 text-stone-700">{sd.forItem}</td>
                                  <td className="py-2 px-3 text-stone-500">{(sd.timestamp || '').slice(0, 16).replace('T', ' ')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 4: Customer, Dispatch & Staff Attribution */}
                  {activeReceiptTab === 'customer' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Customer Card */}
                      <div className="bg-white rounded-2xl border border-[#E5DEC9] p-4 shadow-xs space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-[#800D15]" />
                          Customer &amp; Location Details
                        </h3>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-stone-100">
                            <span className="text-stone-500">Customer Name:</span>
                            <span className="font-bold text-stone-900">{receiptDetail.customer.name}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-stone-100">
                            <span className="text-stone-500">Phone Number:</span>
                            <span className="font-mono font-bold text-stone-900">{receiptDetail.customer.phone}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-stone-100">
                            <span className="text-stone-500">Table / Seating:</span>
                            <span className="font-bold text-stone-900">{receiptDetail.customer.tableNumber}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-stone-500">Delivery Address:</span>
                            <span className="font-medium text-stone-900 text-right max-w-[240px]">
                              {receiptDetail.customer.address}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Staff Attribution Card */}
                      <div className="bg-white rounded-2xl border border-[#E5DEC9] p-4 shadow-xs space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#800D15]" />
                          Operational Staff Attribution
                        </h3>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-stone-100">
                            <span className="text-stone-500">Cashier / Collector:</span>
                            <span className="font-bold text-stone-900">{receiptDetail.staff.cashierName}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-stone-100">
                            <span className="text-stone-500">Order Opened By:</span>
                            <span className="font-bold text-stone-900">{receiptDetail.staff.openedByName}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-stone-100">
                            <span className="text-stone-500">Assigned Waiter / Server:</span>
                            <span className="font-bold text-stone-900">{receiptDetail.staff.waiterName}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-stone-100">
                            <span className="text-stone-500">Dispatch / Rider:</span>
                            <span className="font-bold text-stone-900">{receiptDetail.staff.riderName}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-stone-500">Supervisor Approver:</span>
                            <span className="font-bold text-stone-900">{receiptDetail.staff.approverName}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 5: Chronological Audit Trail */}
                  {activeReceiptTab === 'audit' && (
                    <div className="bg-white rounded-2xl border border-[#E5DEC9] p-4 shadow-xs space-y-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#800D15]" />
                        Immutable Audit History ({receiptDetail.auditTrail.length} Events)
                      </h3>
                      {receiptDetail.auditTrail.length === 0 ? (
                        <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-center text-xs text-stone-500">
                          Initial transaction creation logged. No subsequent overrides or void exceptions recorded.
                        </div>
                      ) : (
                        <div className="divide-y divide-stone-100 text-xs">
                          {receiptDetail.auditTrail.map((ev, idx) => (
                            <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-stone-900 uppercase">{ev.actionType}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700">
                                    {ev.staffName} ({ev.staffRole})
                                  </span>
                                </div>
                                <p className="text-stone-600 mt-0.5">{ev.details}</p>
                              </div>
                              <span className="text-[11px] text-stone-400 font-mono shrink-0">
                                {(ev.timestamp || '').slice(0, 19).replace('T', ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-10 text-center text-stone-500">Receipt record could not be loaded.</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-[#E5DEC9] flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-stone-500">
                Authoritative electronic receipt inspection • Choplife Republic
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2] hover:bg-stone-100 text-stone-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#800D15]" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedReceiptId(null)}
                  className="px-5 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
