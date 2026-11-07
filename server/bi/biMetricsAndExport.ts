import {
  MENU_FOOD_COST_MAP,
  buildAccountingJournalEntries,
  exportQuickBooksJournalCsv,
  type AccountingBuildOptions,
} from '../../server_accounting.ts';
import type {
  BranchId,
  ExecutivePeriod,
  ExecutivePnL,
  BranchBenchmark,
  MenuEngineeringItem,
  LaborProductivitySummary,
  ExecutiveInsightAlert,
  ExecutiveBIDashboardData,
} from '../../src/types/index.ts';

export { MENU_FOOD_COST_MAP };

export const BRANCH_CONFIG: Record<
  BranchId,
  { name: string; tagline: string; defaultAov: number; tableTurn: number }
> = {
  gra: {
    name: 'GRA Flagship Restaurant & Lounge',
    tagline: 'High AOV, Dine-In, Platters & Cocktail Lounge',
    defaultAov: 14200,
    tableTurn: 48,
  },
  okabere: {
    name: 'Okabere (Upper Sapele Road)',
    tagline: 'Grills, Suya Stand, Takeaway & Fresh Bread Depot',
    defaultAov: 8900,
    tableTurn: 35,
  },
  ugbowo: {
    name: 'Ugbowo (Campus & Medical Center)',
    tagline: 'Student Hub, Fast Turnover, Combos & Quick Service',
    defaultAov: 4800,
    tableTurn: 26,
  },
};

export const LAGOS_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is UTC+1 year-round

/**
 * Returns UTC timestamp corresponding to midnight in Africa/Lagos (WAT, UTC+1, no DST)
 */
export function getLagosMidnight(daysAgo: number = 0): number {
  const nowUtc = Date.now();
  const lagosDate = new Date(nowUtc + LAGOS_OFFSET_MS);
  const y = lagosDate.getUTCFullYear();
  const m = lagosDate.getUTCMonth();
  const d = lagosDate.getUTCDate() - daysAgo;
  return Date.UTC(y, m, d) - LAGOS_OFFSET_MS;
}

export interface PeriodWindowBounds {
  startMs: number;
  endMs: number;
  label: string;
}

/**
 * Resolves exact [startMs, endMs] in Africa/Lagos timezone for all 8 reporting periods + legacy aliases
 */
export function resolveLagosPeriodWindow(
  period: ExecutivePeriod = 'all',
  customStartDate?: string,
  customEndDate?: string,
  nowUtcMs: number = Date.now()
): PeriodWindowBounds {
  const lagosNow = new Date(nowUtcMs + LAGOS_OFFSET_MS);
  const y = lagosNow.getUTCFullYear();
  const m = lagosNow.getUTCMonth();
  const d = lagosNow.getUTCDate();
  const h = lagosNow.getUTCHours();

  const todayMidnightMs = Date.UTC(y, m, d) - LAGOS_OFFSET_MS;

  if (period === 'hourly') {
    const currentHourStartMs = Date.UTC(y, m, d, h, 0, 0) - LAGOS_OFFSET_MS;
    return {
      startMs: currentHourStartMs,
      endMs: nowUtcMs,
      label: `Current Hour (${String(h).padStart(2, '0')}:00 WAT)`,
    };
  }

  if (period === 'daily' || period === 'today') {
    return {
      startMs: todayMidnightMs,
      endMs: nowUtcMs,
      label: 'Today (WAT)',
    };
  }

  if (period === 'yesterday') {
    const yesterdayMidnightMs = Date.UTC(y, m, d - 1) - LAGOS_OFFSET_MS;
    return {
      startMs: yesterdayMidnightMs,
      endMs: todayMidnightMs - 1,
      label: 'Yesterday (WAT)',
    };
  }

  if (period === 'weekly' || period === '7days') {
    const startMs = Date.UTC(y, m, d - 6) - LAGOS_OFFSET_MS;
    return {
      startMs,
      endMs: nowUtcMs,
      label: 'Last 7 Days (Weekly WAT)',
    };
  }

  if (period === 'monthly' || period === '30days') {
    const startOfMonthMs = Date.UTC(y, m, 1) - LAGOS_OFFSET_MS;
    const thirtyDaysAgoMs = Date.UTC(y, m, d - 29) - LAGOS_OFFSET_MS;
    return {
      startMs: period === 'monthly' ? startOfMonthMs : thirtyDaysAgoMs,
      endMs: nowUtcMs,
      label: period === 'monthly' ? 'This Month to Date (WAT)' : 'Last 30 Days (WAT)',
    };
  }

  if (period === 'quarterly') {
    const quarterStartMonth = Math.floor(m / 3) * 3;
    const startOfQuarterMs = Date.UTC(y, quarterStartMonth, 1) - LAGOS_OFFSET_MS;
    return {
      startMs: startOfQuarterMs,
      endMs: nowUtcMs,
      label: `Q${Math.floor(m / 3) + 1} ${y} to Date (WAT)`,
    };
  }

  if (period === 'yearly') {
    const startOfYearMs = Date.UTC(y, 0, 1) - LAGOS_OFFSET_MS;
    return {
      startMs: startOfYearMs,
      endMs: nowUtcMs,
      label: `Year ${y} to Date (WAT)`,
    };
  }

  if (period === 'custom' && (customStartDate || customEndDate)) {
    const startParts = customStartDate ? customStartDate.split('-').map(Number) : [y, m + 1, 1];
    const endParts = customEndDate ? customEndDate.split('-').map(Number) : [y, m + 1, d];
    const startMs =
      startParts.length === 3
        ? Date.UTC(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0) - LAGOS_OFFSET_MS
        : 0;
    const endMs =
      endParts.length === 3
        ? Date.UTC(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999) - LAGOS_OFFSET_MS
        : nowUtcMs;
    return {
      startMs: Math.min(startMs, endMs),
      endMs: Math.max(startMs, endMs),
      label: `Custom Range (${customStartDate || 'Start'} to ${customEndDate || 'Now'} WAT)`,
    };
  }

  // 'lifetime' | 'all'
  return {
    startMs: 0,
    endMs: nowUtcMs,
    label: 'Lifetime / All Time (WAT)',
  };
}

/**
 * Resolves [currentWindow, previousWindow] for Part 4 comparison modes in Africa/Lagos timezone
 */
export function resolveLagosComparisonWindows(
  mode: string,
  likeForLike: boolean = true,
  nowUtcMs: number = Date.now()
): { label: string; current: PeriodWindowBounds; previous: PeriodWindowBounds } | null {
  if (!mode || mode === 'none') return null;

  const lagosNow = new Date(nowUtcMs + LAGOS_OFFSET_MS);
  const y = lagosNow.getUTCFullYear();
  const m = lagosNow.getUTCMonth();
  const d = lagosNow.getUTCDate();
  const todayStartMs = Date.UTC(y, m, d) - LAGOS_OFFSET_MS;
  const elapsedTodayMs = Math.max(60000, nowUtcMs - todayStartMs);

  if (mode === 'today_vs_yesterday') {
    const prevStartMs = Date.UTC(y, m, d - 1) - LAGOS_OFFSET_MS;
    const prevEndMs = likeForLike ? prevStartMs + elapsedTodayMs : todayStartMs - 1;
    return {
      label: likeForLike ? 'Today vs Yesterday (Like-for-Like Elapsed Hours)' : 'Today vs Full Yesterday',
      current: { startMs: todayStartMs, endMs: nowUtcMs, label: 'Today (WAT)' },
      previous: { startMs: prevStartMs, endMs: prevEndMs, label: 'Yesterday (WAT)' },
    };
  }

  if (mode === 'today_vs_equiv_day_last_week') {
    const prevStartMs = Date.UTC(y, m, d - 7) - LAGOS_OFFSET_MS;
    const prevFullEndMs = Date.UTC(y, m, d - 6) - LAGOS_OFFSET_MS - 1;
    const prevEndMs = likeForLike ? prevStartMs + elapsedTodayMs : prevFullEndMs;
    return {
      label: likeForLike
        ? 'Today vs Equivalent Weekday Last Week (Like-for-Like)'
        : 'Today vs Equivalent Weekday Last Week (Full Day)',
      current: { startMs: todayStartMs, endMs: nowUtcMs, label: 'Today (WAT)' },
      previous: { startMs: prevStartMs, endMs: prevEndMs, label: 'Same Day Last Week (WAT)' },
    };
  }

  if (mode === 'this_month_vs_last_month') {
    const curStartMs = Date.UTC(y, m, 1) - LAGOS_OFFSET_MS;
    const elapsedMonthMs = Math.max(60000, nowUtcMs - curStartMs);
    const prevStartMs = Date.UTC(y, m - 1, 1) - LAGOS_OFFSET_MS;
    const prevFullEndMs = curStartMs - 1;
    const prevEndMs = likeForLike ? Math.min(prevFullEndMs, prevStartMs + elapsedMonthMs) : prevFullEndMs;
    return {
      label: likeForLike ? 'This Month vs Last Month (Month-to-Date)' : 'This Month vs Full Last Month',
      current: { startMs: curStartMs, endMs: nowUtcMs, label: 'This Month (WAT)' },
      previous: { startMs: prevStartMs, endMs: prevEndMs, label: 'Last Month (WAT)' },
    };
  }

  if (mode === 'this_month_vs_same_month_last_year') {
    const curStartMs = Date.UTC(y, m, 1) - LAGOS_OFFSET_MS;
    const elapsedMonthMs = Math.max(60000, nowUtcMs - curStartMs);
    const prevStartMs = Date.UTC(y - 1, m, 1) - LAGOS_OFFSET_MS;
    const prevFullEndMs = Date.UTC(y - 1, m + 1, 1) - LAGOS_OFFSET_MS - 1;
    const prevEndMs = likeForLike ? Math.min(prevFullEndMs, prevStartMs + elapsedMonthMs) : prevFullEndMs;
    return {
      label: likeForLike
        ? 'This Month vs Same Month Last Year (MTD)'
        : 'This Month vs Same Month Last Year (Full)',
      current: { startMs: curStartMs, endMs: nowUtcMs, label: `This Month ${y}` },
      previous: { startMs: prevStartMs, endMs: prevEndMs, label: `Same Month ${y - 1}` },
    };
  }

  if (mode === 'this_year_vs_last_year') {
    const curStartMs = Date.UTC(y, 0, 1) - LAGOS_OFFSET_MS;
    const elapsedYearMs = Math.max(60000, nowUtcMs - curStartMs);
    const prevStartMs = Date.UTC(y - 1, 0, 1) - LAGOS_OFFSET_MS;
    const prevFullEndMs = curStartMs - 1;
    const prevEndMs = likeForLike ? Math.min(prevFullEndMs, prevStartMs + elapsedYearMs) : prevFullEndMs;
    return {
      label: likeForLike ? `Year ${y} vs ${y - 1} (YTD)` : `Year ${y} vs Full ${y - 1}`,
      current: { startMs: curStartMs, endMs: nowUtcMs, label: `YTD ${y}` },
      previous: { startMs: prevStartMs, endMs: prevEndMs, label: `Year ${y - 1}` },
    };
  }

  if (mode === 'this_year_vs_two_years_ago') {
    const curStartMs = Date.UTC(y, 0, 1) - LAGOS_OFFSET_MS;
    const elapsedYearMs = Math.max(60000, nowUtcMs - curStartMs);
    const prevStartMs = Date.UTC(y - 2, 0, 1) - LAGOS_OFFSET_MS;
    const prevFullEndMs = Date.UTC(y - 1, 0, 1) - LAGOS_OFFSET_MS - 1;
    const prevEndMs = likeForLike ? Math.min(prevFullEndMs, prevStartMs + elapsedYearMs) : prevFullEndMs;
    return {
      label: likeForLike ? `Year ${y} vs ${y - 2} (YTD)` : `Year ${y} vs Full ${y - 2}`,
      current: { startMs: curStartMs, endMs: nowUtcMs, label: `YTD ${y}` },
      previous: { startMs: prevStartMs, endMs: prevEndMs, label: `Year ${y - 2}` },
    };
  }

  return null;
}

/**
 * Filter checks by period/bounds and branch using Africa/Lagos boundaries
 */
export function filterChecksForBI(
  allChecks: any[],
  branchId?: string,
  period: ExecutivePeriod = 'all',
  options?: {
    startDate?: string;
    endDate?: string;
    boundsOverride?: PeriodWindowBounds;
    includeHistoricalMigrated?: boolean;
  }
): any[] {
  const includeHistorical = options?.includeHistoricalMigrated !== false;
  let filtered = allChecks.filter((c) => {
    if (c.status !== 'paid') return false;
    if (!includeHistorical && (c.isHistoricalMigrated || c.legacySourceSystem === 'ezee_optimus')) {
      return false;
    }
    return true;
  });

  if (branchId && branchId !== 'all') {
    filtered = filtered.filter((c) => c.branchId === branchId);
  }

  const bounds =
    options?.boundsOverride || resolveLagosPeriodWindow(period, options?.startDate, options?.endDate);
  if (bounds.startMs > 0 || period === 'custom' || period === 'yesterday') {
    filtered = filtered.filter((c) => {
      const ts = c.originalTimestamp || c.closedAt || c.paidAt || c.openedAt;
      const t = new Date(ts).getTime();
      return t >= bounds.startMs && t <= bounds.endMs;
    });
  }

  return filtered;
}

/**
 * Filter wastage records by period and branch using Africa/Lagos boundaries
 */
export function filterWastageForBI(
  allWastage: any[],
  branchId?: string,
  period: ExecutivePeriod = 'all',
  options?: {
    startDate?: string;
    endDate?: string;
    boundsOverride?: PeriodWindowBounds;
  }
): any[] {
  let filtered = Array.isArray(allWastage)
    ? allWastage.filter((w) => !w.isDemo && w.dataOrigin !== 'demo' && !String(w.itemId || '').startsWith('demo-'))
    : [];

  if (branchId && branchId !== 'all') {
    filtered = filtered.filter((w) => (w.locationId || w.branchId) === branchId);
  }

  const bounds =
    options?.boundsOverride || resolveLagosPeriodWindow(period, options?.startDate, options?.endDate);
  if (bounds.startMs > 0 || period === 'custom' || period === 'yesterday') {
    filtered = filtered.filter((w) => {
      const t = new Date(w.timestamp).getTime();
      return t >= bounds.startMs && t <= bounds.endMs;
    });
  }

  return filtered;
}

export function computeLaborProductivityAndInsights(params: {
  db: any;
  filteredChecks: any[];
  branchId: string;
  menuMatrix: MenuEngineeringItem[];
  wastageByCategory: Record<string, number>;
  branchBenchmarks: BranchBenchmark[];
  pnl: ExecutivePnL;
}): {
  laborProductivity: LaborProductivitySummary;
  aiInsights: ExecutiveInsightAlert[];
} {
  const { db, filteredChecks, branchId, menuMatrix, wastageByCategory, branchBenchmarks, pnl } = params;

  const cashierMap: Record<
    string,
    { staffId: string; name: string; branchId: string; ordersProcessed: number; totalRevenue: number; totalSecs: number }
  > = {};

  for (const check of filteredChecks) {
    const sId = check.settledByStaffId || check.openedByStaffId;
    const sName = check.settledByName || check.openedByName;
    if (sId && sName) {
      if (!cashierMap[sId]) {
        cashierMap[sId] = {
          staffId: sId,
          name: sName,
          branchId: check.branchId || 'gra',
          ordersProcessed: 0,
          totalRevenue: 0,
          totalSecs: 0,
        };
      }
      cashierMap[sId].ordersProcessed += 1;
      cashierMap[sId].totalRevenue += check.total || 0;
      if (check.openedAt && check.paidAt) {
        const diffSecs = Math.max(15, Math.min(600, Math.round((new Date(check.paidAt).getTime() - new Date(check.openedAt).getTime()) / 1000)));
        cashierMap[sId].totalSecs += diffSecs;
      } else {
        cashierMap[sId].totalSecs += 45;
      }
    }
  }

  const registeredCashiers = Object.values(db.staff || {}).filter((s: any) => s.role === 'cashier');
  for (const csh of registeredCashiers as any[]) {
    if (!cashierMap[csh.id] && (branchId === 'all' || csh.branchId === branchId)) {
      cashierMap[csh.id] = {
        staffId: csh.id,
        name: csh.name,
        branchId: csh.branchId,
        ordersProcessed: 0,
        totalRevenue: 0,
        totalSecs: 0,
      };
    }
  }

  const cashierLeaderboard = Object.values(cashierMap)
    .map((c) => ({
      staffId: c.staffId,
      name: c.name,
      branchId: c.branchId,
      ordersProcessed: c.ordersProcessed,
      totalRevenue: c.totalRevenue,
      avgProcessingSecs: c.ordersProcessed > 0 ? Math.round(c.totalSecs / c.ordersProcessed) : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const stationStats: Record<string, { completed: number; totalPrepMins: number; onTimeCount: number }> = {
    'Charcoal Grills & Suya Pit': { completed: 0, totalPrepMins: 0, onTimeCount: 0 },
    'Hot Food Line & Jollof': { completed: 0, totalPrepMins: 0, onTimeCount: 0 },
    'Fryers & Small Chops': { completed: 0, totalPrepMins: 0, onTimeCount: 0 },
    'Bakery & Bread Oven': { completed: 0, totalPrepMins: 0, onTimeCount: 0 },
    'Cold Prep, Mocktails & Bar': { completed: 0, totalPrepMins: 0, onTimeCount: 0 },
  };

  for (const check of filteredChecks) {
    if (Array.isArray(check.items)) {
      for (const item of check.items) {
        const itName = (item.name || '').toLowerCase();
        let targetStation = 'Hot Food Line & Jollof';

        if (itName.includes('catfish') || itName.includes('suya') || itName.includes('grill') || itName.includes('skewer') || itName.includes('chicken quarter') || itName.includes('wings')) {
          targetStation = 'Charcoal Grills & Suya Pit';
        } else if (itName.includes('pie') || itName.includes('bread') || itName.includes('cake') || itName.includes('pastry') || itName.includes('roll')) {
          targetStation = 'Bakery & Bread Oven';
        } else if (itName.includes('samosa') || itName.includes('puff') || itName.includes('plantain') || itName.includes('dodo') || itName.includes('fry') || itName.includes('spring roll') || itName.includes('chops')) {
          targetStation = 'Fryers & Small Chops';
        } else if (itName.includes('drink') || itName.includes('zobo') || itName.includes('malt') || itName.includes('juice') || itName.includes('water') || itName.includes('parfait')) {
          targetStation = 'Cold Prep, Mocktails & Bar';
        }

        const isReady = item.status === 'ready' || check.status === 'ready' || check.status === 'paid';
        if (isReady) {
          const qty = Number(item.quantity) || 1;
          stationStats[targetStation].completed += qty;
          stationStats[targetStation].totalPrepMins += (targetStation.includes('Grill') ? 18 : targetStation.includes('Bakery') ? 12 : 8) * qty;
          stationStats[targetStation].onTimeCount += qty;
        }
      }
    }
  }

  const kitchenStations = Object.entries(stationStats).map(([stationName, stats]) => {
    const avgPrep = stats.completed > 0 ? Math.round(stats.totalPrepMins / stats.completed) : (stationName.includes('Grill') ? 20 : 10);
    const onTimePct = stats.completed > 0 ? Number(((stats.onTimeCount / stats.completed) * 100).toFixed(1)) : 100.0;
    return {
      stationName,
      ordersCompleted: stats.completed,
      avgPrepTimeMins: avgPrep,
      onTimePct,
    };
  });

  const allTasks = Object.values(db.deliveryTasks || {}) as any[];
  const tasksForPeriod = allTasks.filter((t) => branchId === 'all' || t.branchId === branchId);
  const ridersList = Object.values(db.riders || {}) as any[];

  const riderMap: Record<string, { name: string; completedDrops: number; totalMins: number; onTimeDrops: number }> = {};
  for (const r of ridersList) {
    if (branchId === 'all' || r.branchId === branchId) {
      riderMap[r.id] = {
        name: r.name,
        completedDrops: 0,
        totalMins: 0,
        onTimeDrops: 0,
      };
    }
  }

  for (const task of tasksForPeriod) {
    if (task.riderId && riderMap[task.riderId]) {
      if (task.status === 'delivered') {
        riderMap[task.riderId].completedDrops += 1;
        const transitMins = task.deliveredAt && task.assignedAt
          ? Math.max(5, Math.round((new Date(task.deliveredAt).getTime() - new Date(task.assignedAt).getTime()) / 60000))
          : 25;
        riderMap[task.riderId].totalMins += transitMins;
        if (!task.delayed) riderMap[task.riderId].onTimeDrops += 1;
      }
    }
  }

  const riderLogistics = Object.entries(riderMap).map(([riderId, r]) => {
    const avgTransit = r.completedDrops > 0 ? Math.round(r.totalMins / r.completedDrops) : 25;
    const onTimeRate = r.completedDrops > 0 ? Number(((r.onTimeDrops / r.completedDrops) * 100).toFixed(1)) : 100.0;
    return {
      riderId,
      name: r.name,
      completedDrops: r.completedDrops,
      avgTransitMins: avgTransit,
      onTimeRate,
    };
  });

  const laborProductivity: LaborProductivitySummary = {
    cashierLeaderboard,
    kitchenStations,
    riderLogistics,
  };

  const aiInsights: ExecutiveInsightAlert[] = [];
  const topProduct = menuMatrix[0];

  if (topProduct && topProduct.volume > 0) {
    aiInsights.push({
      id: 'ins-top-product',
      type: 'positive',
      title: `${topProduct.name} Leading Product Margin`,
      detail: `${topProduct.name} generated ₦${topProduct.revenue.toLocaleString()} with a ${topProduct.grossMarginPct}% gross margin across ${topProduct.volume} units sold.`,
      metric: `₦${topProduct.grossProfit.toLocaleString()} Gross Profit`,
      branchTarget: branchId === 'all' ? 'Network-wide' : branchId.toUpperCase(),
    });
  }

  const highestWastageCat = Object.entries(wastageByCategory).sort((a, b) => b[1] - a[1])[0];
  if (highestWastageCat && highestWastageCat[1] > 0) {
    aiInsights.push({
      id: 'ins-wastage-audit',
      type: 'warning',
      title: `${highestWastageCat[0]} Shrinkage Control`,
      detail: `${highestWastageCat[0]} accounts for ₦${highestWastageCat[1].toLocaleString()} in recorded spoilage. Enforce FIFO rotation and review end-of-day temperature holding logs.`,
      metric: `₦${highestWastageCat[1].toLocaleString()} Loss`,
      branchTarget: branchId === 'all' ? 'All Branches' : branchId.toUpperCase(),
    });
  }

  const activeBranches = branchBenchmarks.filter((b) => b.orderCount > 0);
  if (activeBranches.length > 0) {
    const topBranch = [...activeBranches].sort((a, b) => b.netSales - a.netSales)[0];
    aiInsights.push({
      id: 'ins-top-branch',
      type: 'strategy',
      title: `${topBranch.branchName} Volume Leader`,
      detail: `${topBranch.branchName} contributes ${topBranch.revenueSharePct}% of total network sales with an Average Order Value of ₦${topBranch.aov.toLocaleString()}.`,
      metric: `₦${topBranch.netSales.toLocaleString()} Net`,
      branchTarget: topBranch.branchName,
    });
  } else {
    aiInsights.push({
      id: 'ins-ops-ready',
      type: 'positive',
      title: 'Store Operations Initialized',
      detail: 'Core menu recipes, BOM cost matrices, and POS till structures are synced and ready for live shift openings.',
      metric: 'Ready for Service',
      branchTarget: 'Choplife Republic',
    });
  }

  if (pnl.netRevenue > 0) {
    aiInsights.push({
      id: 'ins-net-margin',
      type: pnl.netMarginPct >= 20 ? 'positive' : 'warning',
      title: `Operating Net Margin: ${pnl.netMarginPct}%`,
      detail: `Current net profit of ₦${pnl.netProfit.toLocaleString()} reflects a food cost (COGS) ratio of ${pnl.cogsPct}% and OPEX of ₦${pnl.operatingExpenses.totalOpex.toLocaleString()}.`,
      metric: `${pnl.netMarginPct}% Net Margin`,
      branchTarget: 'Consolidated',
    });
  }

  return { laborProductivity, aiInsights };
}

function sanitizeCsvField(val: string | number | undefined | null): string {
  let s = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

export function generateReportsCsv(
  data: ExecutiveBIDashboardData,
  exportType: 'pnl' | 'menu' | 'branches' | 'quickbooks',
  dbInstance?: any,
  accountingOptions?: AccountingBuildOptions
): string {
  const safeNetRev = Math.max(data.pnl.netRevenue, 1);
  if (exportType === 'pnl') {
    const lines = [
      'CHOPLIFE REPUBLIC — EXECUTIVE P&L STATEMENT',
      `Period: ${data.period.toUpperCase()}, Branch: ${data.branchId.toUpperCase()}`,
      'Generated: ' + new Date().toISOString(),
      '',
      'Line Item,Amount (NGN),% of Net Revenue',
      `Gross Revenue,${data.pnl.grossRevenue},${((data.pnl.grossRevenue / safeNetRev) * 100).toFixed(1)}%`,
      `Discounts & Promos,-${data.pnl.discounts},${((data.pnl.discounts / safeNetRev) * 100).toFixed(1)}%`,
      `Net Sales Revenue,${data.pnl.netRevenue},100.0%`,
      `Cost of Goods Sold (COGS),-${data.pnl.cogs},${data.pnl.cogsPct}%`,
      `Gross Operating Profit,${data.pnl.grossProfit},${data.pnl.grossMarginPct}%`,
      `Labor & Payroll Expense,-${data.pnl.operatingExpenses.labor},${((data.pnl.operatingExpenses.labor / safeNetRev) * 100).toFixed(1)}%`,
      `Generator Diesel & Power,-${data.pnl.operatingExpenses.generatorAndPower},${((data.pnl.operatingExpenses.generatorAndPower / safeNetRev) * 100).toFixed(1)}%`,
      `Wastage & Spoilage,-${data.pnl.operatingExpenses.wastageShrinkage},${((data.pnl.operatingExpenses.wastageShrinkage / safeNetRev) * 100).toFixed(1)}%`,
      `Delivery Fleet Logistics,-${data.pnl.operatingExpenses.deliveryFleet},${((data.pnl.operatingExpenses.deliveryFleet / safeNetRev) * 100).toFixed(1)}%`,
      `Total Operating Expenses,-${data.pnl.operatingExpenses.totalOpex},${((data.pnl.operatingExpenses.totalOpex / safeNetRev) * 100).toFixed(1)}%`,
      `Net Operating Profit (EBITDA),${data.pnl.netProfit},${data.pnl.netMarginPct}%`,
    ];
    return lines.join('\n');
  } else if (exportType === 'quickbooks') {
    const report = buildAccountingJournalEntries(dbInstance || {}, {
      branchId: data.branchId,
      period: (data.period as any) || 'all',
      ...accountingOptions,
    });
    return exportQuickBooksJournalCsv(report);
  } else if (exportType === 'menu') {
    const lines = [
      'CHOPLIFE REPUBLIC — MENU ENGINEERING (BCG MATRIX)',
      'Product Name,Category,Quadrant,Volume Sold,Unit Price (NGN),Food Cost (NGN),Gross Margin %,Total Revenue (NGN),Gross Profit (NGN),Strategic Action',
      ...data.menuMatrix.map(
        (m) =>
          `${sanitizeCsvField(m.name)},${sanitizeCsvField(m.category)},${sanitizeCsvField(m.quadrant)},${m.volume},${m.sellingPrice},${m.foodCost},${m.grossMarginPct}%,${m.revenue},${m.grossProfit},${sanitizeCsvField(m.strategicRecommendation)}`
      ),
    ];
    return lines.join('\n');
  } else {
    const lines = [
      'CHOPLIFE REPUBLIC — MULTI-BRANCH COMPARATIVE BENCHMARKS',
      'Branch ID,Branch Name,Gross Sales (NGN),Order Count,AOV (NGN),Revenue Share %,COGS %,Labor (NGN),Fuel/Power (NGN),Wastage (NGN),Net Profit (NGN),Net Margin %,Avg Table Turn (Mins),Delivery SLA %',
      ...data.branchBenchmarks.map(
        (b) =>
          `${sanitizeCsvField(b.branchId)},${sanitizeCsvField(b.branchName)},${b.grossSales},${b.orderCount},${b.aov},${b.revenueSharePct}%,${b.cogsPct}%,${b.laborCostNaira},${b.utilitiesFuelCostNaira},${b.wastageLossNaira},${b.netProfitNaira},${b.netMarginPct}%,${b.avgTableTurnMinutes},${b.deliverySlaCompliancePct}%`
      ),
    ];
    return lines.join('\n');
  }
}
