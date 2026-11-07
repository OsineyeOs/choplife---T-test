import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Building2,
  Clock,
  PieChart,
  BarChart3,
  Flame,
  ShieldAlert,
  Download,
  Printer,
  RefreshCw,
  Users,
  Award,
  Sparkles,
  UtensilsCrossed,
  CheckCircle2,
  Bike,
  Calendar,
  X,
} from 'lucide-react';
import {
  ExecutivePeriod,
  ExecutiveComparisonMode,
  ExecutiveBIDashboardData,
  StaffRole,
} from '../../types';

interface ExecutiveBIDashboardProps {
  currentStaffRole?: StaffRole;
  currentStaffBranchId?: string;
  defaultBranchId?: string;
}

export const ExecutiveBIDashboard: React.FC<ExecutiveBIDashboardProps> = ({
  currentStaffBranchId,
  defaultBranchId = 'all',
}) => {
  const [selectedBranch, setSelectedBranch] = useState<string>(
    currentStaffBranchId && currentStaffBranchId !== 'all' ? currentStaffBranchId : defaultBranchId
  );
  const [selectedPeriod, setSelectedPeriod] = useState<ExecutivePeriod>('7days');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 7 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [comparisonMode, setComparisonMode] = useState<ExecutiveComparisonMode>('today_vs_yesterday');
  const [likeForLike, setLikeForLike] = useState<boolean>(true);
  const [includeHistoricalMigrated, setIncludeHistoricalMigrated] = useState<boolean>(true);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState<boolean>(false);
  const [drillDownFilter, setDrillDownFilter] = useState<'all' | 'pos_check' | 'expense_claim' | 'historical_migrated'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'pnl' | 'branches' | 'hourly' | 'bcg' | 'labor'>('pnl');
  const [selectedBcgFilter, setSelectedBcgFilter] = useState<'ALL' | 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<ExecutiveBIDashboardData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('choplife_staff_token') || sessionStorage.getItem('choplife_staff_token') || '';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const [dataFreshnessTimestamp, setDataFreshnessTimestamp] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setFetchError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const query = new URLSearchParams({
        branchId: selectedBranch,
        period: selectedPeriod,
        comparisonMode,
        likeForLike: String(likeForLike),
        includeHistoricalMigrated: String(includeHistoricalMigrated),
      });
      if (selectedPeriod === 'custom') {
        if (customStartDate) query.set('startDate', customStartDate);
        if (customEndDate) query.set('endDate', customEndDate);
      }
      const res = await fetch(`/api/reports/executive-dashboard?${query.toString()}`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        setData(json);
        setFetchError(null);
        setDataFreshnessTimestamp(
          new Date().toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos' })
        );
      } else if (res.status === 401) {
        setFetchError('Staff authentication required. Please sign in with active credentials to view executive reports.');
      } else if (res.status === 403) {
        const errJson = await res.json().catch(() => ({}));
        setFetchError(errJson.error || 'Access denied: Executive BI is restricted to authorized supervisors and administrators.');
      } else {
        const errJson = await res.json().catch(() => ({}));
        setFetchError(errJson.error || 'Executive analytics could not be retrieved from the reporting engine.');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setFetchError('Request timed out after 8 seconds. Please check server status and click below to retry.');
      } else {
        setFetchError('Unable to connect to executive analytics service. Please verify your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedBranch, selectedPeriod, customStartDate, customEndDate, comparisonMode, likeForLike, includeHistoricalMigrated]);

  const handleExportCsv = async (exportType: 'pnl' | 'menu' | 'branches' | 'quickbooks') => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/reports/export-csv', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          exportType,
          branchId: selectedBranch,
          period: selectedPeriod,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `choplife-${exportType}-${selectedBranch}-${selectedPeriod}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setExportMessage(`Exported ${exportType.toUpperCase()} report successfully.`);
        setTimeout(() => setExportMessage(null), 3500);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  if (isLoading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4 bg-[#FAF7F2] text-[#241311]">
        <RefreshCw className="w-8 h-8 text-[#800D15] animate-spin" />
        <p className="text-sm font-semibold text-[#241311]">
          Aggregating Multi-Branch Financial &amp; Operational Metrics...
        </p>
        <p className="text-xs text-[#7A6A65]">
          Querying ledger, till shifts, and consolidated P&amp;L (WAT / Benin City timezone)
        </p>
        <button
          onClick={() => {
            setIsLoading(false);
            setFetchError('Loading cancelled by user.');
          }}
          className="mt-2 text-xs text-[#800D15] hover:underline font-bold"
        >
          Cancel Request
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 p-8 text-center text-[#7A6A65] bg-[#FAF7F2] flex flex-col items-center justify-center space-y-3">
        <p className="text-sm font-bold text-[#241311]">
          {fetchError || 'No operational data available for the selected filters.'}
        </p>
        <button
          onClick={fetchDashboardData}
          className="mt-2 px-5 py-2.5 bg-[#800D15] hover:bg-[#4D080F] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#FFC700]" />
          <span>Reload Executive Analytics</span>
        </button>
      </div>
    );
  }

  const { pnl, branchBenchmarks, hourlySales, menuMatrix, wastageAudit, laborProductivity, aiInsights } = data;

  const filteredMenuMatrix =
    selectedBcgFilter === 'ALL'
      ? menuMatrix
      : menuMatrix.filter((item) => item.quadrant === selectedBcgFilter);

  const starCount = menuMatrix.filter((i) => i.quadrant === 'STAR').length;
  const plowhorseCount = menuMatrix.filter((i) => i.quadrant === 'PLOWHORSE').length;
  const puzzleCount = menuMatrix.filter((i) => i.quadrant === 'PUZZLE').length;
  const dogCount = menuMatrix.filter((i) => i.quadrant === 'DOG').length;

  const maxHourlyRev = Math.max(...hourlySales.map((s) => s.revenue), 1);

  const branchLabel =
    selectedBranch === 'all'
      ? 'All Branches (Consolidated)'
      : selectedBranch === 'gra'
      ? 'GRA Flagship (Okogo St)'
      : selectedBranch === 'okabere'
      ? 'Okabere (Sapele Rd)'
      : 'Ugbowo (Campus & UBTH)';

  return (
    <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden space-y-4 sm:space-y-6 bg-[#FAF7F2] text-[#241311] max-w-full">
      {/* Top Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E5DEC9] print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-[#FFF8E7] text-[#800D15] border border-[#FFC700] uppercase">
              Choplife Intelligence BI
            </span>
            {dataFreshnessTimestamp && (
              <span className="text-[11px] text-[#7A6A65] font-medium">
                • Fresh as of {dataFreshnessTimestamp} WAT
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-black text-[#241311] mt-1 font-titan">
            Multi-Branch Executive Analytics &amp; BI
          </h1>
          <p className="text-xs text-[#7A6A65]">
            Consolidated cross-branch P&amp;L, BCG menu matrix, hourly rush curves &amp; labor throughput
          </p>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Selector */}
          <div className="flex items-center bg-white border border-[#E5DEC9] rounded-xl px-3 py-1.5 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-[#800D15] mr-2" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#241311] focus:outline-none cursor-pointer"
            >
              <option value="all">All Branches (Consolidated)</option>
              <option value="gra">GRA Flagship (Okogo St)</option>
              <option value="okabere">Okabere (Sapele Rd)</option>
              <option value="ugbowo">Ugbowo (Campus &amp; UBTH)</option>
            </select>
          </div>

          {/* Period Selector */}
          {/* 8-Period Selector (Africa/Lagos WAT) */}
          <div className="flex items-center bg-white border border-[#E5DEC9] rounded-xl px-3 py-1.5 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-[#800D15] mr-2" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as ExecutivePeriod)}
              className="bg-transparent text-xs font-bold text-[#241311] focus:outline-none cursor-pointer"
            >
              <option value="hourly">Hourly (Current Hour WAT)</option>
              <option value="today">Daily — Today (WAT)</option>
              <option value="yesterday">Daily — Yesterday (WAT)</option>
              <option value="7days">Weekly — Last 7 Days</option>
              <option value="monthly">Monthly — Month to Date</option>
              <option value="30days">Rolling 30 Days</option>
              <option value="quarterly">Quarterly — Quarter to Date</option>
              <option value="yearly">Yearly — Year to Date</option>
              <option value="all">Lifetime / All Time</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {selectedPeriod === 'custom' && (
            <div className="flex items-center gap-1.5 bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1 shadow-2xs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs font-mono font-bold text-[#241311] bg-transparent focus:outline-none"
              />
              <span className="text-xs text-stone-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs font-mono font-bold text-[#241311] bg-transparent focus:outline-none"
              />
            </div>
          )}

          {/* Comparison Period Selector */}
          <div className="flex items-center bg-white border border-[#E5DEC9] rounded-xl px-3 py-1.5 shadow-2xs">
            <TrendingUp className="w-3.5 h-3.5 text-[#800D15] mr-2" />
            <select
              value={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.value as ExecutiveComparisonMode)}
              className="bg-transparent text-xs font-bold text-[#241311] focus:outline-none cursor-pointer"
            >
              <option value="none">No Period Comparison</option>
              <option value="today_vs_yesterday">Today vs Yesterday</option>
              <option value="today_vs_equiv_day_last_week">Today vs Equiv. Day Last Week</option>
              <option value="this_month_vs_last_month">This Month vs Last Month</option>
              <option value="this_month_vs_same_month_last_year">This Month vs Same Month Last Year</option>
              <option value="this_year_vs_last_year">This Year vs Last Year</option>
              <option value="this_year_vs_two_years_ago">This Year vs Two Years Ago</option>
            </select>
          </div>

          {comparisonMode !== 'none' && (
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-[#E5DEC9] rounded-xl text-[11px] font-bold text-[#241311] cursor-pointer shadow-2xs">
              <input
                type="checkbox"
                checked={likeForLike}
                onChange={(e) => setLikeForLike(e.target.checked)}
                className="accent-[#800D15] rounded"
              />
              <span>Like-for-Like Elapsed</span>
            </label>
          )}

          <button
            onClick={() => setIsDrillDownOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FFF8E7] hover:bg-[#FFC700]/30 border border-[#FFC700] rounded-xl text-xs font-bold text-[#800D15] transition-colors shadow-2xs"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Drill-Down ({data.drillDownRecords?.length || 0})</span>
          </button>

          {/* Actions: Refresh */}
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="p-2 bg-white hover:bg-[#FFF8E7] border border-[#E5DEC9] rounded-xl text-[#7A6A65] hover:text-[#800D15] transition-colors shadow-2xs"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#800D15]' : ''}`} />
          </button>

          {/* Export Dropdown / Action */}
          <button
            onClick={() => handleExportCsv('pnl')}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#FFF8E7] border border-[#E5DEC9] rounded-xl text-xs font-bold text-[#241311] transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#800D15]" />
            <span className="hidden sm:inline">Export P&amp;L CSV</span>
          </button>

          <button
            onClick={() => handleExportCsv('quickbooks')}
            disabled={isExporting}
            id="btn-export-quickbooks-journal"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 transition-colors shadow-2xs"
            title="Export Double-Entry General Ledger Journal CSV (QuickBooks / IFRS)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">QuickBooks GL CSV</span>
          </button>

          <button
            id="btn-print-executive-report"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#800D15] hover:bg-[#4D080F] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#FFC700]" />
            <span className="hidden sm:inline">Print Report</span>
          </button>
        </div>
      </div>

      {exportMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{exportMessage}</span>
        </div>
      )}

      {/* Period-over-Period Comparison Strip (Part 4) */}
      {data.comparison && (
        <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5DEC9] pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#800D15]" />
              <span className="text-xs font-black text-[#241311] uppercase tracking-wider">
                {data.comparison.label}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#E5DEC9] text-[10px] font-mono text-stone-600">
                {data.comparison.currentWindow.label} vs {data.comparison.previousWindow.label}
              </span>
            </div>
            <button
              onClick={() => setIsDrillDownOpen(true)}
              className="text-[11px] font-bold text-[#800D15] hover:underline"
            >
              Inspect Underlying Records →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              { key: 'netRevenue', label: 'Net Revenue', isCurrency: true },
              { key: 'grossProfit', label: 'Gross Profit', isCurrency: true },
              { key: 'totalOpex', label: 'Total OPEX', isCurrency: true },
              { key: 'netProfit', label: 'Net Profit', isCurrency: true },
              { key: 'orderCount', label: 'Paid Checks', isCurrency: false },
              { key: 'aov', label: 'Avg Order Value', isCurrency: true },
            ].map((m) => {
              const stat = (data.comparison!.metrics as any)[m.key];
              if (!stat) return null;
              const isPos = stat.delta >= 0;
              return (
                <div key={m.key} className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">{m.label}</span>
                  <div className="font-mono font-black text-sm text-[#241311]">
                    {m.isCurrency ? `₦${Number(stat.current).toLocaleString()}` : stat.current}
                  </div>
                  <div className="text-[10px] text-stone-500 font-mono">
                    Prior: {m.isCurrency ? `₦${Number(stat.previous).toLocaleString()}` : stat.previous}
                  </div>
                  {stat.deltaPct !== null ? (
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isPos ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {stat.deltaPct}% ({isPos ? '+' : ''}
                      {m.isCurrency ? `₦${Number(stat.delta).toLocaleString()}` : stat.delta})
                    </span>
                  ) : (
                    <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[9px] font-bold">
                      {stat.zeroBaselineNote || 'No prior baseline'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Data Quality & Accrual vs Ledger Disclosure Banner (Part 4) */}
      {data.dataQualityNotice && (
        <div className="px-4 py-2.5 bg-[#FFF8E7] border border-[#E5DEC9] rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#241311]">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#800D15] text-[#FFC700] font-bold text-[10px] uppercase">
              Data Source &amp; Basis
            </span>
            <span>
              Window: <strong>{data.windowLabel || data.period}</strong> • Live Checks:{' '}
              <strong className="font-mono">{data.dataQualityNotice.liveCheckCount}</strong> • Migrated eZee Historical:{' '}
              <strong className="font-mono">{data.dataQualityNotice.historicalMigratedCheckCount}</strong> • Approved Claims:{' '}
              <strong className="font-mono">{data.dataQualityNotice.verifiedExpenseClaimsCount}</strong>
            </span>
          </div>
          <label className="flex items-center gap-1.5 font-bold text-[#800D15] cursor-pointer">
            <input
              type="checkbox"
              checked={includeHistoricalMigrated}
              onChange={(e) => setIncludeHistoricalMigrated(e.target.checked)}
              className="accent-[#800D15] rounded"
            />
            <span>Include eZee Migrated History</span>
          </label>
        </div>
      )}

      {/* Top Level Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Sales Revenue */}
        <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7A6A65]">Net Sales Revenue</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <TrendingUp className="w-2.5 h-2.5" /> +14.2%
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-[#800D15] mt-2">
            ₦{pnl.netRevenue.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-[#7A6A65] mt-2 pt-2 border-t border-[#E5DEC9]">
            <span>Gross: ₦{pnl.grossRevenue.toLocaleString()}</span>
            <span className="text-red-600 font-semibold">Discounts: -₦{pnl.discounts.toLocaleString()}</span>
          </div>
        </div>

        {/* Gross Profit & Margin */}
        <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7A6A65]">Gross Profit (After Food Cost)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF8E7] text-[#800D15] border border-[#FFC700]">
              {pnl.grossMarginPct}% Margin
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-[#241311] mt-2">
            ₦{pnl.grossProfit.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-[#7A6A65] mt-2 pt-2 border-t border-[#E5DEC9]">
            <span>COGS: ₦{pnl.cogs.toLocaleString()}</span>
            <span>Target: &gt;62%</span>
          </div>
        </div>

        {/* Net Operating Profit (EBITDA) */}
        <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7A6A65]">Net Operating Profit (EBITDA)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              pnl.netMarginPct >= 25
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {pnl.netMarginPct}% Net
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-700 mt-2">
            ₦{pnl.netProfit.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-[#7A6A65] mt-2 pt-2 border-t border-[#E5DEC9]">
            <span>Total OPEX: ₦{pnl.operatingExpenses.totalOpex.toLocaleString()}</span>
            <span>Healthy QSR Standard</span>
          </div>
        </div>

        {/* Operating Shrinkage & Fuel Factor */}
        <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7A6A65]">Diesel Gen &amp; Wastage Loss</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
              Shrinkage &amp; Energy
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-red-600 mt-2">
            ₦{(pnl.operatingExpenses.generatorAndPower + pnl.operatingExpenses.wastageShrinkage).toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-[#7A6A65] mt-2 pt-2 border-t border-[#E5DEC9]">
            <span>Gen Fuel: ₦{pnl.operatingExpenses.generatorAndPower.toLocaleString()}</span>
            <span>Waste: ₦{pnl.operatingExpenses.wastageShrinkage.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Strategic Intelligence & Anomaly Alerts */}
      <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#800D15]" />
            <h2 className="text-sm font-bold text-[#241311]">
              Operational Intelligence &amp; Margin Alerts
            </h2>
          </div>
          <span className="text-[11px] text-[#7A6A65]">Real-time unit economics</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {aiInsights.map((insight) => (
            <div
              key={insight.id}
              className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl flex flex-col justify-between space-y-2 hover:border-[#800D15]/40 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      insight.type === 'positive'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : insight.type === 'strategy'
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {insight.type}
                  </span>
                  {insight.branchTarget && (
                    <span className="text-[10px] text-[#7A6A65] font-semibold">{insight.branchTarget}</span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-[#241311] line-clamp-1">{insight.title}</h4>
                <p className="text-[11px] text-[#7A6A65] leading-relaxed line-clamp-3">
                  {insight.detail}
                </p>
              </div>
              {insight.metric && (
                <div className="pt-2 border-t border-[#E5DEC9] flex items-center justify-between">
                  <span className="text-[10px] text-[#7A6A65]">Impact</span>
                  <span className="text-xs font-mono font-bold text-[#800D15]">
                    {insight.metric}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5DEC9] pb-2 overflow-x-auto print:hidden">
        <button
          onClick={() => setActiveSubTab('pnl')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'pnl'
              ? 'bg-[#800D15] text-white shadow-sm'
              : 'bg-white text-[#7A6A65] border border-[#E5DEC9] hover:text-[#241311]'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-[#FFC700]" />
          <span>P&amp;L Statement &amp; Waterfall</span>
        </button>

        <button
          onClick={() => setActiveSubTab('branches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'branches'
              ? 'bg-[#800D15] text-white shadow-sm'
              : 'bg-white text-[#7A6A65] border border-[#E5DEC9] hover:text-[#241311]'
          }`}
        >
          <Building2 className="w-4 h-4 text-[#FFC700]" />
          <span>Branch Benchmarks ({branchBenchmarks.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('hourly')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'hourly'
              ? 'bg-[#800D15] text-white shadow-sm'
              : 'bg-white text-[#7A6A65] border border-[#E5DEC9] hover:text-[#241311]'
          }`}
        >
          <Clock className="w-4 h-4 text-[#FFC700]" />
          <span>Hourly Rush &amp; Kitchen Heatmap</span>
        </button>

        <button
          onClick={() => setActiveSubTab('bcg')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'bcg'
              ? 'bg-[#800D15] text-white shadow-sm'
              : 'bg-white text-[#7A6A65] border border-[#E5DEC9] hover:text-[#241311]'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4 text-[#FFC700]" />
          <span>BCG Menu Matrix ({menuMatrix.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('labor')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'labor'
              ? 'bg-[#800D15] text-white shadow-sm'
              : 'bg-white text-[#7A6A65] border border-[#E5DEC9] hover:text-[#241311]'
          }`}
        >
          <Users className="w-4 h-4 text-[#FFC700]" />
          <span>Wastage &amp; Labor Productivity</span>
        </button>
      </div>

      {/* TAB 1: P&L STATEMENT & REVENUE WATERFALL */}
      {activeSubTab === 'pnl' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Waterfall / Cost Distribution */}
            <div className="p-5 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#241311] flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[#800D15]" /> Revenue Waterfall Breakdown
                </h3>
                <span className="text-[10px] text-[#7A6A65]">% of Net Sales</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-[#7A6A65] mb-1">
                    <span>Gross Profit (After COGS)</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {pnl.grossMarginPct}% (₦{pnl.grossProfit.toLocaleString()})
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all"
                      style={{ width: `${Math.min(100, pnl.grossMarginPct)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[#7A6A65] mb-1">
                    <span>Cost of Goods Sold (Food Cost)</span>
                    <span className="font-mono font-bold text-amber-700">
                      {pnl.cogsPct}% (₦{pnl.cogs.toLocaleString()})
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, pnl.cogsPct)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[#7A6A65] mb-1">
                    <span>Labor &amp; Payroll Expense</span>
                    <span className="font-mono font-bold text-sky-700">
                      {pnl.netRevenue > 0
                        ? ((pnl.operatingExpenses.labor / pnl.netRevenue) * 100).toFixed(1)
                        : 0}% (₦{pnl.operatingExpenses.labor.toLocaleString()})
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-600 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          pnl.netRevenue > 0 ? (pnl.operatingExpenses.labor / pnl.netRevenue) * 100 : 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[#7A6A65] mb-1">
                    <span>Generator Diesel &amp; Electricity</span>
                    <span className="font-mono font-bold text-red-600">
                      {pnl.netRevenue > 0
                        ? ((pnl.operatingExpenses.generatorAndPower / pnl.netRevenue) * 100).toFixed(1)
                        : 0}% (₦{pnl.operatingExpenses.generatorAndPower.toLocaleString()})
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-600 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          pnl.netRevenue > 0
                            ? (pnl.operatingExpenses.generatorAndPower / pnl.netRevenue) * 100
                            : 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[#7A6A65] mb-1">
                    <span>Wastage &amp; Spoilage Loss</span>
                    <span className="font-mono font-bold text-purple-700">
                      {pnl.netRevenue > 0
                        ? ((pnl.operatingExpenses.wastageShrinkage / pnl.netRevenue) * 100).toFixed(1)
                        : 0}% (₦{pnl.operatingExpenses.wastageShrinkage.toLocaleString()})
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          pnl.netRevenue > 0
                            ? (pnl.operatingExpenses.wastageShrinkage / pnl.netRevenue) * 100
                            : 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5DEC9]">
                  <div className="flex justify-between text-xs font-bold text-[#241311] mb-1">
                    <span>Net Operating EBITDA Margin</span>
                    <span className="font-mono text-emerald-700">
                      {pnl.netMarginPct}% (₦{pnl.netProfit.toLocaleString()})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Line-Item Executive P&L Table */}
            <div className="lg:col-span-2 p-5 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#241311]">
                    Executive P&amp;L Statement
                  </h3>
                  <p className="text-xs text-[#7A6A65]">
                    Standardized restaurant accounting framework
                  </p>
                </div>
                <button
                  onClick={() => handleExportCsv('pnl')}
                  className="px-2.5 py-1 bg-[#FAF7F2] hover:bg-[#FFF8E7] border border-[#E5DEC9] rounded-lg text-xs font-semibold text-[#800D15] flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#E5DEC9] text-[#7A6A65]">
                      <th className="pb-2 font-semibold">Account Category</th>
                      <th className="pb-2 font-semibold text-right">Amount (NGN)</th>
                      <th className="pb-2 font-semibold text-right">% of Net Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DEC9]">
                    <tr className="hover:bg-[#FAF7F2]">
                      <td className="py-2.5 font-bold text-[#241311]">Gross Sales Collections</td>
                      <td className="py-2.5 font-mono font-bold text-right text-[#241311]">
                        ₦{pnl.grossRevenue.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-right text-[#7A6A65]">
                        {pnl.netRevenue > 0
                          ? ((pnl.grossRevenue / pnl.netRevenue) * 100).toFixed(1)
                          : 100}%
                      </td>
                    </tr>
                    <tr className="hover:bg-[#FAF7F2]">
                      <td className="py-2.5 pl-4 text-[#7A6A65]">Less: Discounts &amp; Vouchers</td>
                      <td className="py-2.5 font-mono text-right text-red-600">
                        -₦{pnl.discounts.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-right text-red-600">
                        {pnl.netRevenue > 0
                          ? ((pnl.discounts / pnl.netRevenue) * 100).toFixed(1)
                          : 0}%
                      </td>
                    </tr>
                    <tr className="bg-[#FFF8E7] font-bold">
                      <td className="py-2.5 text-[#800D15] pl-2">Net Sales Revenue</td>
                      <td className="py-2.5 font-mono text-right text-[#800D15]">
                        ₦{pnl.netRevenue.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-right text-[#800D15] pr-2">100.0%</td>
                    </tr>
                    <tr className="hover:bg-[#FAF7F2]">
                      <td className="py-2.5 pl-4 text-[#7A6A65]">
                        Less: Cost of Goods Sold (Food &amp; Drink Cost)
                      </td>
                      <td className="py-2.5 font-mono text-right text-amber-700">
                        -₦{pnl.cogs.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-right text-amber-700">
                        {pnl.cogsPct}%
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/70 font-bold">
                      <td className="py-2.5 text-emerald-800 pl-2">Gross Operating Profit</td>
                      <td className="py-2.5 font-mono text-right text-emerald-800">
                        ₦{pnl.grossProfit.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-right text-emerald-800 pr-2">
                        {pnl.grossMarginPct}%
                      </td>
                    </tr>

                    {/* Operating Expenses */}
                    <tr className="hover:bg-[#FAF7F2]">
                      <td className="py-2.5 pl-4 text-[#7A6A65]">
                        Staff Labor &amp; Shift Wages (Front &amp; Kitchen)
                      </td>
                      <td className="py-2.5 font-mono text-right text-[#241311]">
                        -₦{pnl.operatingExpenses.labor.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-right text-[#7A6A65]">
                        {pnl.netRevenue > 0
                          ? ((pnl.operatingExpenses.labor / pnl.netRevenue) * 100).toFixed(1)
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-[#FAF7F2]">
                      <td className="py-2.5 pl-4 text-[#7A6A65]">
                        Generator Diesel Fuel &amp; Power Utility
                      </td>
                      <td className="py-2.5 font-mono text-right text-[#241311]">
                        -₦{pnl.operatingExpenses.generatorAndPower.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-right text-[#7A6A65]">
                        {pnl.netRevenue > 0
                          ? ((pnl.operatingExpenses.generatorAndPower / pnl.netRevenue) * 100).toFixed(1)
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-[#FAF7F2]">
                      <td className="py-2.5 pl-4 text-[#7A6A65]">
                        Wastage, Spoilage &amp; Kitchen Shrinkage
                      </td>
                      <td className="py-2.5 font-mono text-right text-[#241311]">
                        -₦{pnl.operatingExpenses.wastageShrinkage.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-right text-[#7A6A65]">
                        {pnl.netRevenue > 0
                          ? ((pnl.operatingExpenses.wastageShrinkage / pnl.netRevenue) * 100).toFixed(1)
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-[#FAF7F2]">
                      <td className="py-2.5 pl-4 text-[#7A6A65]">
                        Delivery Rider Fleet Logistics &amp; Bike Fuel
                      </td>
                      <td className="py-2.5 font-mono text-right text-[#241311]">
                        -₦{pnl.operatingExpenses.deliveryFleet.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-right text-[#7A6A65]">
                        {pnl.netRevenue > 0
                          ? ((pnl.operatingExpenses.deliveryFleet / pnl.netRevenue) * 100).toFixed(1)
                          : 0}%
                      </td>
                    </tr>
                    <tr className="bg-[#FAF7F2] font-black text-sm border-t-2 border-[#800D15]">
                      <td className="py-3 text-[#241311] pl-2">
                        Net Operating Profit (EBITDA)
                      </td>
                      <td className="py-3 font-mono text-right text-emerald-700">
                        ₦{pnl.netProfit.toLocaleString()}
                      </td>
                      <td className="py-3 font-mono text-right text-emerald-700 pr-2">
                        {pnl.netMarginPct}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-BRANCH COMPARATIVE BENCHMARKS */}
      {activeSubTab === 'branches' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#241311]">
                Cross-Branch Performance &amp; Benchmarks
              </h3>
              <p className="text-xs text-[#7A6A65]">
                Comparative unit economics for GRA, Okabere, and Ugbowo
              </p>
            </div>
            <button
              onClick={() => handleExportCsv('branches')}
              className="px-3 py-1.5 bg-white hover:bg-[#FFF8E7] border border-[#E5DEC9] rounded-lg text-xs font-semibold text-[#800D15] flex items-center gap-1.5"
            >
              <Download className="w-3 h-3" /> Export Branch Benchmarks
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {branchBenchmarks.map((branch) => (
              <div
                key={branch.branchId}
                className={`p-5 bg-white border rounded-2xl space-y-4 transition-all shadow-2xs ${
                  selectedBranch === branch.branchId
                    ? 'border-[#800D15] ring-1 ring-[#800D15]/30'
                    : 'border-[#E5DEC9]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A6A65]">
                      {branch.branchId.toUpperCase()} BRANCH
                    </span>
                    <h4 className="font-bold text-sm text-[#241311] mt-0.5">
                      {branch.branchName}
                    </h4>
                    <p className="text-[11px] text-[#7A6A65]">{branch.tagline}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF8E7] text-[#800D15] border border-[#FFC700]">
                    {branch.revenueSharePct}% Share
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 border-y border-[#E5DEC9] text-xs">
                  <div>
                    <span className="text-[#7A6A65] text-[10px]">Gross Sales</span>
                    <p className="font-mono font-bold text-[#800D15] text-base mt-0.5">
                      ₦{branch.grossSales.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#7A6A65] text-[10px]">Net Profit</span>
                    <p className="font-mono font-bold text-emerald-700 text-base mt-0.5">
                      ₦{branch.netProfitNaira.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#7A6A65] text-[10px]">Average Check (AOV)</span>
                    <p className="font-mono font-bold text-[#241311] mt-0.5">
                      ₦{branch.aov.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#7A6A65] text-[10px]">Orders Count</span>
                    <p className="font-mono font-bold text-sky-700 mt-0.5">
                      {branch.orderCount} orders
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[#7A6A65]">
                    <span>Food Cost (COGS)</span>
                    <span className="font-mono text-amber-700 font-bold">{branch.cogsPct}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[#7A6A65]">
                    <span>Net Profit Margin</span>
                    <span className="font-mono text-emerald-700 font-bold">{branch.netMarginPct}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[#7A6A65]">
                    <span>Table Turn Time</span>
                    <span className="font-mono text-[#241311]">{branch.avgTableTurnMinutes} mins</span>
                  </div>
                  <div className="flex justify-between items-center text-[#7A6A65]">
                    <span>Delivery SLA Fulfillment</span>
                    <span className="font-mono text-sky-700 font-bold">{branch.deliverySlaCompliancePct}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[#7A6A65]">
                    <span>Top Selling Anchor</span>
                    <span className="font-semibold text-[#800D15] truncate max-w-[140px]">
                      {branch.topItemName}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: HOURLY SALES HEATMAP & KITCHEN LOAD */}
      {activeSubTab === 'hourly' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#241311] flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#E62E00]" /> Hourly Sales Flow &amp; Rush Curve (08:00 – 21:00)
                </h3>
                <p className="text-xs text-[#7A6A65]">
                  Analyzes peak rush windows for kitchen prep staffing and delivery rider dispatch
                </p>
              </div>
            </div>

            <div className="grid grid-cols-7 sm:grid-cols-14 gap-2 items-end h-44 pt-6 pb-2 border-b border-[#E5DEC9]">
              {hourlySales.map((slot) => {
                const heightPct = Math.max(12, Math.round((slot.revenue / maxHourlyRev) * 100));
                const barColor =
                  slot.rushLevel === 'peak'
                    ? 'bg-[#E62E00]'
                    : slot.rushLevel === 'rush'
                    ? 'bg-[#FFC700]'
                    : 'bg-stone-300 hover:bg-[#800D15]';

                return (
                  <div key={slot.hour} className="flex flex-col items-center h-full justify-end group relative">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${barColor}`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] font-mono text-[#7A6A65] mt-2">
                      {slot.hour.slice(0, 2)}h
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-5 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-[#241311] flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-[#800D15]" /> Kitchen Station Load &amp; SLA Compliance
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {laborProductivity.kitchenStations.map((station) => (
                <div
                  key={station.stationName}
                  className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-2"
                >
                  <span className="text-xs font-bold text-[#241311] block line-clamp-1">
                    {station.stationName}
                  </span>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[#7A6A65]">
                      <span>Completed</span>
                      <span className="font-mono font-bold text-[#241311]">{station.ordersCompleted}</span>
                    </div>
                    <div className="flex justify-between text-[#7A6A65]">
                      <span>Avg Prep Time</span>
                      <span className="font-mono font-bold text-sky-700">{station.avgPrepTimeMins} mins</span>
                    </div>
                    <div className="flex justify-between text-[#7A6A65]">
                      <span>On-Time SLA</span>
                      <span className="font-mono font-bold text-emerald-700">{station.onTimePct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BCG MENU ENGINEERING MATRIX */}
      {activeSubTab === 'bcg' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#241311]">
                Menu Engineering Matrix (BCG Product Quadrants)
              </h3>
              <p className="text-xs text-[#7A6A65]">
                Optimizes profitability by plotting sales volume against gross profit margin
              </p>
            </div>
            <button
              onClick={() => handleExportCsv('menu')}
              className="px-3 py-1.5 bg-white hover:bg-[#FFF8E7] border border-[#E5DEC9] rounded-lg text-xs font-semibold text-emerald-700 flex items-center gap-1.5"
            >
              <Download className="w-3 h-3" /> Export Menu Matrix CSV
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => setSelectedBcgFilter(selectedBcgFilter === 'STAR' ? 'ALL' : 'STAR')}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                selectedBcgFilter === 'STAR'
                  ? 'bg-emerald-50 border-emerald-500'
                  : 'bg-white border-[#E5DEC9]'
              }`}
            >
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Stars ({starCount})</span>
              <p className="text-xs font-bold text-[#241311] mt-1">Core Profit Drivers</p>
            </button>
            <button
              onClick={() => setSelectedBcgFilter(selectedBcgFilter === 'PLOWHORSE' ? 'ALL' : 'PLOWHORSE')}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                selectedBcgFilter === 'PLOWHORSE'
                  ? 'bg-sky-50 border-sky-500'
                  : 'bg-white border-[#E5DEC9]'
              }`}
            >
              <span className="text-[10px] font-bold text-sky-700 uppercase">Plowhorses ({plowhorseCount})</span>
              <p className="text-xs font-bold text-[#241311] mt-1">High Volume Staples</p>
            </button>
            <button
              onClick={() => setSelectedBcgFilter(selectedBcgFilter === 'PUZZLE' ? 'ALL' : 'PUZZLE')}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                selectedBcgFilter === 'PUZZLE'
                  ? 'bg-amber-50 border-amber-500'
                  : 'bg-white border-[#E5DEC9]'
              }`}
            >
              <span className="text-[10px] font-bold text-amber-700 uppercase">Puzzles ({puzzleCount})</span>
              <p className="text-xs font-bold text-[#241311] mt-1">High Margin Potential</p>
            </button>
            <button
              onClick={() => setSelectedBcgFilter(selectedBcgFilter === 'DOG' ? 'ALL' : 'DOG')}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                selectedBcgFilter === 'DOG'
                  ? 'bg-red-50 border-red-500'
                  : 'bg-white border-[#E5DEC9]'
              }`}
            >
              <span className="text-[10px] font-bold text-red-700 uppercase">Dogs ({dogCount})</span>
              <p className="text-xs font-bold text-[#241311] mt-1">Candidates to Re-Price</p>
            </button>
          </div>

          <div className="p-5 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#E5DEC9] text-[#7A6A65]">
                    <th className="pb-2 font-semibold">Item &amp; Category</th>
                    <th className="pb-2 font-semibold text-center">Quadrant</th>
                    <th className="pb-2 font-semibold text-right">Volume</th>
                    <th className="pb-2 font-semibold text-right">Price</th>
                    <th className="pb-2 font-semibold text-right">Food Cost</th>
                    <th className="pb-2 font-semibold text-right">Margin %</th>
                    <th className="pb-2 font-semibold text-right">Total Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DEC9]">
                  {filteredMenuMatrix.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAF7F2]">
                      <td className="py-2.5">
                        <span className="font-bold text-[#241311] block">{item.name}</span>
                        <span className="text-[10px] text-[#7A6A65]">{item.category}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF7F2] border border-[#E5DEC9] text-[#241311]">
                          {item.quadrant}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-right font-semibold text-[#241311]">{item.volume}</td>
                      <td className="py-2.5 font-mono text-right text-[#7A6A65]">₦{item.sellingPrice.toLocaleString()}</td>
                      <td className="py-2.5 font-mono text-right text-[#7A6A65]">₦{item.foodCost.toLocaleString()}</td>
                      <td className="py-2.5 font-mono text-right font-bold text-[#800D15]">{item.grossMarginPct}%</td>
                      <td className="py-2.5 font-mono text-right font-bold text-emerald-700">₦{item.grossProfit.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PACKAGE SALES & COMPONENT DEMAND EXPANSION LEDGER */}
          {(data as any)?.packageSalesSummary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#241311]">
                      Package &amp; Bundle Sales Ledger
                    </h3>
                    <p className="text-xs text-[#7A6A65]">
                      Packages sold and authoritative package revenue (no double-counting of component value)
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-[#800D15]/10 text-[#800D15] text-[10px] font-black uppercase">
                    Package Accounting
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-[#E5DEC9] text-[#7A6A65]">
                        <th className="pb-2 font-semibold">Package Name</th>
                        <th className="pb-2 font-semibold text-right">Packages Sold</th>
                        <th className="pb-2 font-semibold text-right">Package Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DEC9]">
                      {((data as any).packageSalesSummary.packagesSold || []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-[#7A6A65]">
                            No packages sold in selected period.
                          </td>
                        </tr>
                      ) : (
                        ((data as any).packageSalesSummary.packagesSold || []).map((pkg: any) => (
                          <tr key={pkg.productId} className="hover:bg-[#FAF7F2]">
                            <td className="py-2.5 font-bold text-[#241311]">{pkg.name}</td>
                            <td className="py-2.5 font-mono text-right font-bold text-[#800D15]">
                              {pkg.packagesSold.toLocaleString()}
                            </td>
                            <td className="py-2.5 font-mono text-right font-bold text-emerald-700">
                              ₦{Number(pkg.packageRevenue || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-5 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#241311]">
                      Expanded Component Demand Breakdown
                    </h3>
                    <p className="text-xs text-[#7A6A65]">
                      Standalone units vs units included inside sold packages (e.g. 2000 Mini Pack)
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                    Inventory Depletion Truth
                  </span>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-[#E5DEC9] text-[#7A6A65]">
                        <th className="pb-2 font-semibold">Component Item</th>
                        <th className="pb-2 font-semibold text-right">Standalone Sold</th>
                        <th className="pb-2 font-semibold text-right">In Packages</th>
                        <th className="pb-2 font-semibold text-right">Total Demand</th>
                        <th className="pb-2 font-semibold text-right">Standalone Rev</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DEC9]">
                      {((data as any).packageSalesSummary.componentDemand || []).map((comp: any) => (
                        <tr key={comp.productId} className="hover:bg-[#FAF7F2]">
                          <td className="py-2 font-semibold text-[#241311]">{comp.name}</td>
                          <td className="py-2 font-mono text-right text-[#7A6A65]">
                            {Number(comp.standaloneUnitsSold || 0).toLocaleString()}
                          </td>
                          <td className="py-2 font-mono text-right font-bold text-amber-700">
                            {Number(comp.unitsIncludedInPackages || 0).toLocaleString()}
                          </td>
                          <td className="py-2 font-mono text-right font-black text-[#241311]">
                            {Number(comp.totalComponentDemand || 0).toLocaleString()}
                          </td>
                          <td className="py-2 font-mono text-right font-semibold text-emerald-700">
                            ₦{Number(comp.standaloneRevenue || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: WASTAGE & LABOR PRODUCTIVITY */}
      {activeSubTab === 'labor' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-[#241311] flex items-center gap-2">
                <Award className="w-4 h-4 text-[#800D15]" /> Cashier Checkout &amp; Velocity Leaderboard
              </h3>
              <div className="space-y-2 text-xs">
                {laborProductivity.cashierLeaderboard.map((c, idx) => (
                  <div
                    key={c.staffId}
                    className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#800D15] text-[#FFC700] text-xs font-mono font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-[#241311] block">{c.name}</span>
                        <span className="text-[10px] text-[#7A6A65] uppercase">{c.branchId} BRANCH</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[#800D15]">₦{c.totalRevenue.toLocaleString()}</div>
                      <div className="text-[11px] text-[#7A6A65]">{c.ordersProcessed} orders</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-[#241311] flex items-center gap-2">
                <Bike className="w-4 h-4 text-sky-700" /> Fleet Rider Fulfillment SLA
              </h3>
              <div className="space-y-2 text-xs">
                {laborProductivity.riderLogistics.map((r, idx) => (
                  <div
                    key={r.riderId}
                    className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 text-xs font-mono font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-[#241311] block">{r.name}</span>
                        <span className="text-[10px] text-emerald-700 font-bold">{r.onTimeRate}% On-Time SLA</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[#241311]">{r.completedDrops} drops</div>
                      <div className="text-[11px] text-[#7A6A65]">{r.avgTransitMins} mins avg transit</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-[#241311] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" /> Wastage &amp; Shrinkage Forensic Breakdown (Total: ₦{wastageAudit.totalLossNaira.toLocaleString()})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                {wastageAudit.byCategory.map((cat) => (
                  <div key={cat.category} className="flex justify-between p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl">
                    <span className="font-semibold text-[#241311]">{cat.category}</span>
                    <span className="font-mono font-bold text-red-600">₦{cat.amount.toLocaleString()} ({cat.pct}%)</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {wastageAudit.byReason.map((r) => (
                  <div key={r.reason} className="flex justify-between p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl">
                    <span className="font-semibold text-[#241311]">{r.reason} ({r.count} incidents)</span>
                    <span className="font-mono font-bold text-red-600">₦{r.lossNaira.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED PRINTABLE EXECUTIVE REPORT MODAL */}
      {isPrintModalOpen && (
        <div
          id="executive-printable-report-modal"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0"
        >
          <div className="bg-white text-stone-900 border border-[#E5DEC9] rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6 print:max-h-none print:shadow-none print:border-none">
            {/* Modal Action Bar (Hidden when printing) */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E5DEC9] print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#800D15]" />
                <span className="text-sm font-black uppercase tracking-wider text-[#4D080F]">
                  Printable Executive Financial &amp; Operations Report
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="trigger-browser-print-btn"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#800D15] hover:bg-[#4D080F] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  id="close-print-modal-btn"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 rounded-xl bg-[#FAF7F2] hover:bg-[#E5DEC9] text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Formal Printable Header */}
            <div className="border-b-2 border-[#4D080F] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-black uppercase text-[#4D080F]">
                  Choplife Republic — Executive P&amp;L &amp; Operations Statement
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Scope: <strong>{branchLabel}</strong> • Reporting Period: <strong className="uppercase">{selectedPeriod}</strong>
                </p>
              </div>
              <div className="text-xs text-stone-500 font-mono sm:text-right">
                <div>Generated: {new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT</div>
                <div>Currency: Nigerian Naira (NGN / ₦)</div>
              </div>
            </div>

            {/* Executive Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-stone-200 bg-[#FAF7F2]">
                <div className="text-stone-500 font-bold uppercase text-[10px]">Net Sales Revenue</div>
                <div className="text-base font-black font-mono text-[#800D15] mt-1">₦{pnl.netRevenue.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-xl border border-stone-200 bg-[#FAF7F2]">
                <div className="text-stone-500 font-bold uppercase text-[10px]">Gross Profit ({pnl.grossMarginPct}%)</div>
                <div className="text-base font-black font-mono text-stone-900 mt-1">₦{pnl.grossProfit.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-xl border border-stone-200 bg-[#FAF7F2]">
                <div className="text-stone-500 font-bold uppercase text-[10px]">Total OPEX</div>
                <div className="text-base font-black font-mono text-amber-800 mt-1">₦{pnl.operatingExpenses.totalOpex.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-xl border border-stone-200 bg-[#FAF7F2]">
                <div className="text-stone-500 font-bold uppercase text-[10px]">Net EBITDA ({pnl.netMarginPct}%)</div>
                <div className="text-base font-black font-mono text-emerald-700 mt-1">₦{pnl.netProfit.toLocaleString()}</div>
              </div>
            </div>

            {/* Printable P&L Statement */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#4D080F] mb-2">
                1. Consolidated Income &amp; Expense Statement
              </h3>
              <table className="w-full text-xs border border-stone-200">
                <thead className="bg-[#FAF7F2] border-b border-stone-200">
                  <tr>
                    <th className="p-2 text-left font-bold">Line Item</th>
                    <th className="p-2 text-right font-bold">Amount (₦)</th>
                    <th className="p-2 text-right font-bold">% of Net Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  <tr>
                    <td className="p-2 font-semibold">Gross Sales Collections</td>
                    <td className="p-2 text-right font-mono">₦{pnl.grossRevenue.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono">100.0%</td>
                  </tr>
                  <tr>
                    <td className="p-2 pl-4 text-stone-600">Less: Discounts &amp; Vouchers</td>
                    <td className="p-2 text-right font-mono text-red-700">-₦{pnl.discounts.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono">
                      {pnl.netRevenue > 0 ? ((pnl.discounts / pnl.netRevenue) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  <tr className="bg-[#FAF7F2] font-bold">
                    <td className="p-2">Net Sales Revenue</td>
                    <td className="p-2 text-right font-mono">₦{pnl.netRevenue.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono">100.0%</td>
                  </tr>
                  <tr>
                    <td className="p-2 pl-4 text-stone-600">Less: Food &amp; Beverage Cost (COGS)</td>
                    <td className="p-2 text-right font-mono">-₦{pnl.cogs.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono">{pnl.cogsPct}%</td>
                  </tr>
                  <tr className="bg-[#FAF7F2] font-bold">
                    <td className="p-2">Gross Profit</td>
                    <td className="p-2 text-right font-mono">₦{pnl.grossProfit.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono">{pnl.grossMarginPct}%</td>
                  </tr>
                  <tr>
                    <td className="p-2 pl-4 text-stone-600">Operating Expenses (Labor, Power, Fleet &amp; Wastage)</td>
                    <td className="p-2 text-right font-mono">-₦{pnl.operatingExpenses.totalOpex.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono">
                      {pnl.netRevenue > 0 ? ((pnl.operatingExpenses.totalOpex / pnl.netRevenue) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  <tr className="bg-emerald-50 font-black">
                    <td className="p-2">Net Operating Profit (EBITDA)</td>
                    <td className="p-2 text-right font-mono text-emerald-800">₦{pnl.netProfit.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono text-emerald-800">{pnl.netMarginPct}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Printable Branch Benchmarks */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#4D080F] mb-2">
                2. Multi-Branch Unit Economics Benchmark
              </h3>
              <table className="w-full text-xs border border-stone-200">
                <thead className="bg-[#FAF7F2] border-b border-stone-200">
                  <tr>
                    <th className="p-2 text-left font-bold">Branch</th>
                    <th className="p-2 text-right font-bold">Orders</th>
                    <th className="p-2 text-right font-bold">Gross Sales</th>
                    <th className="p-2 text-right font-bold">COGS %</th>
                    <th className="p-2 text-right font-bold">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {branchBenchmarks.map((b) => (
                    <tr key={b.branchId}>
                      <td className="p-2 font-bold">{b.branchName}</td>
                      <td className="p-2 text-right font-mono">{b.orderCount}</td>
                      <td className="p-2 text-right font-mono">₦{b.grossSales.toLocaleString()}</td>
                      <td className="p-2 text-right font-mono">{b.cogsPct}%</td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-800">
                        ₦{b.netProfitNaira.toLocaleString()} ({b.netMarginPct}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Drill-Down Source Transactions Modal (Part 4) */}
      {isDrillDownOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#E5DEC9] flex items-center justify-between">
              <div>
                <h3 className="font-titan text-base text-[#4D080F]">
                  Executive BI Source Record Drill-Down ({data.windowLabel || selectedPeriod})
                </h3>
                <p className="text-xs text-stone-500">
                  Underlying checks, migrated historical records, and verified expense claims in Africa/Lagos (WAT)
                </p>
              </div>
              <button
                onClick={() => setIsDrillDownOpen(false)}
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-[#E5DEC9] flex flex-wrap items-center justify-between gap-2 bg-white">
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Records' },
                  { id: 'pos_check', label: 'Live POS Checks' },
                  { id: 'historical_migrated', label: 'eZee Historical' },
                  { id: 'expense_claim', label: 'Expense Claims' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDrillDownFilter(tab.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      drillDownFilter === tab.id
                        ? 'bg-[#800D15] text-[#FFC700]'
                        : 'bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-stone-500 font-mono">
                Showing{' '}
                {(data.drillDownRecords || []).filter(
                  (r) => drillDownFilter === 'all' || r.recordType === drillDownFilter
                ).length}{' '}
                records
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-xs border border-[#E5DEC9] rounded-xl overflow-hidden">
                <thead className="bg-[#FAF7F2] border-b border-[#E5DEC9] text-stone-600">
                  <tr>
                    <th className="p-2.5 text-left font-bold">Record #</th>
                    <th className="p-2.5 text-left font-bold">Type</th>
                    <th className="p-2.5 text-left font-bold">Branch</th>
                    <th className="p-2.5 text-left font-bold">Timestamp (WAT)</th>
                    <th className="p-2.5 text-left font-bold">Method / Category</th>
                    <th className="p-2.5 text-left font-bold">Operator</th>
                    <th className="p-2.5 text-right font-bold">Amount (₦)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DEC9]">
                  {(data.drillDownRecords || [])
                    .filter((r) => drillDownFilter === 'all' || r.recordType === drillDownFilter)
                    .map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#FAF7F2]/60">
                        <td className="p-2.5 font-mono font-bold text-[#4D080F]">{rec.recordNumber}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              rec.recordType === 'expense_claim'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : rec.recordType === 'historical_migrated'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {rec.recordType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-2.5 uppercase font-semibold">{rec.branchId}</td>
                        <td className="p-2.5 font-mono text-stone-600">
                          {rec.timestamp
                            ? new Date(rec.timestamp).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })
                            : '—'}
                        </td>
                        <td className="p-2.5 font-semibold">{rec.categoryOrMethod}</td>
                        <td className="p-2.5 text-stone-600">{rec.operatorName || '—'}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-[#241311]">
                          ₦{Number(rec.amountNaira || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
