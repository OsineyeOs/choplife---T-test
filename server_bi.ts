/**
 * ChopLife Operations — Executive Business Intelligence & Financial Analytics Engine
 * Provides cross-branch consolidated P&L statements, branch comparative benchmarks,
 * hourly sales rush curves, BCG Menu Engineering matrix, wastage forensic audits,
 * period-over-period comparisons (Africa/Lagos WAT), data-quality disclosures,
 * drill-down records, and labor productivity analytics.
 */

import type {
  BranchId,
  ExecutivePeriod,
  ExecutiveComparisonMode,
  ExecutiveMetricComparison,
  ExecutivePeriodComparison,
  ExecutiveDrillDownRecord,
  ExecutivePnL,
  BranchBenchmark,
  HourlySalesSlot,
  MenuEngineeringItem,
  WastageAuditSummary,
  ExecutiveBIDashboardData,
} from './src/types/index.ts';
import {
  MENU_FOOD_COST_MAP,
  BRANCH_CONFIG,
  LAGOS_OFFSET_MS,
  getLagosMidnight,
  resolveLagosPeriodWindow,
  resolveLagosComparisonWindows,
  filterChecksForBI,
  filterWastageForBI,
  computeLaborProductivityAndInsights,
  generateReportsCsv,
  type PeriodWindowBounds,
} from './server/bi/biMetricsAndExport.ts';
import { expandOrderItemsWithPackages } from './server/services/packageAndPricingEngine.ts';

export {
  MENU_FOOD_COST_MAP,
  BRANCH_CONFIG,
  LAGOS_OFFSET_MS,
  getLagosMidnight,
  resolveLagosPeriodWindow,
  resolveLagosComparisonWindows,
  filterChecksForBI,
  filterWastageForBI,
  generateReportsCsv,
};

export interface ComputeExecutiveDashboardOptions {
  startDate?: string;
  endDate?: string;
  comparisonMode?: ExecutiveComparisonMode;
  likeForLike?: boolean;
  includeHistoricalMigrated?: boolean;
}

function buildMetricComparison(current: number, previous: number): ExecutiveMetricComparison {
  const delta = Math.round(current - previous);
  if (previous === 0) {
    return {
      current: Math.round(current),
      previous: 0,
      delta,
      deltaPct: null,
      zeroBaselineNote: current > 0 ? 'No baseline in prior period' : 'Zero in both periods',
    };
  }
  const deltaPct = Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
  return {
    current: Math.round(current),
    previous: Math.round(previous),
    delta,
    deltaPct,
  };
}

function computeWindowSummaryMetrics(
  db: any,
  allChecks: any[],
  branchId: string,
  bounds: PeriodWindowBounds,
  includeHistoricalMigrated: boolean
): {
  netRevenue: number;
  grossProfit: number;
  totalOpex: number;
  netProfit: number;
  orderCount: number;
  aov: number;
} {
  const checks = filterChecksForBI(allChecks, branchId, 'custom', {
    boundsOverride: bounds,
    includeHistoricalMigrated,
  });
  const grossRevenue = checks.reduce((sum, c: any) => sum + (Number(c.total) || 0), 0);
  const discounts = checks.reduce((sum, c: any) => sum + (Number(c.discountAmount) || 0), 0);
  const netRevenue = Math.max(0, grossRevenue - discounts);

  let calculatedCogs = 0;
  for (const check of checks) {
    if (Array.isArray(check.items)) {
      for (const item of check.items) {
        const name = item.name || 'Menu Item';
        const qty = Number(item.quantity) || 1;
        const costRef = MENU_FOOD_COST_MAP[name];
        const unitCost = costRef ? costRef.cost : Math.round((Number(item.unitPrice) || 2000) * 0.34);
        calculatedCogs += unitCost * qty;
      }
    }
  }
  if (calculatedCogs === 0 && netRevenue > 0) {
    calculatedCogs = Math.round(netRevenue * 0.345);
  }
  const grossProfit = Math.max(0, netRevenue - calculatedCogs);

  const allExpenseClaims = Object.values(db.expenseClaims || {}) as any[];
  let claimsOpex = 0;
  for (const clm of allExpenseClaims) {
    if (!clm || !['approved', 'payment_pending', 'partially_paid', 'paid', 'reconciled'].includes(clm.status)) {
      continue;
    }
    const clmBranch = clm.operatingBranchId || clm.homeBranchId || 'gra';
    if (branchId !== 'all' && clmBranch !== branchId) continue;
    const clmTime = new Date(clm.approvedAt || clm.paidAt || clm.createdAt || 0).getTime();
    if (clmTime < bounds.startMs || clmTime > bounds.endMs) continue;

    if (clm.claimType === 'cash_advance') {
      if (clm.status === 'reconciled' && clm.advanceRetirement) {
        claimsOpex += Number(clm.advanceRetirement.substantiatedExpenseAmount || 0);
      }
      continue;
    }
    if (clm.accountingClassification === 'inventory_purchase' || clm.accountingClassification === 'fixed_asset') {
      continue;
    }
    claimsOpex += Number(clm.approvedAmount ?? clm.totalAmount ?? 0);
  }

  const wastageList = filterWastageForBI(db.wastage || [], branchId, 'custom', { boundsOverride: bounds });
  const wastageLoss = wastageList.reduce((s, w) => s + (Number(w.totalLossValue) || 0), 0);

  const accruedBaselineOpex = netRevenue > 0 ? Math.round(netRevenue * (0.192 + 0.076 + 0.032)) : 0;
  const totalOpex = accruedBaselineOpex + claimsOpex + wastageLoss;
  const netProfit = grossProfit - totalOpex;
  const orderCount = checks.length;
  const aov = orderCount > 0 ? Math.round(grossRevenue / orderCount) : 0;

  return { netRevenue, grossProfit, totalOpex, netProfit, orderCount, aov };
}

export function getAllSettledTransactions(db: any): any[] {
  const orders = Object.values(db?.orders || {}) as any[];
  const checks = Object.values(db?.checks || {}) as any[];

  const paidOrders = orders
    .filter(
      (o) =>
        o.paymentStatus === 'paid' ||
        o.paymentStatus === 'reconciliation_required' ||
        o.paymentStatus === 'confirmed' ||
        o.status === 'confirmed' ||
        o.status === 'completed' ||
        o.status === 'delivered' ||
        (o.total > 0 && o.status !== 'cancelled')
    )
    .map((o) => ({
      ...o,
      status: 'paid',
      closedAt: o.createdAt || o.paidAt || o.closedAt || new Date().toISOString(),
      discountAmount: Number(o.discount || o.discountAmount || 0),
      total: Number(o.total || 0),
    }));

  const standaloneChecks = checks
    .filter(
      (c) =>
        !c.orderId &&
        (c.status === 'paid' ||
          c.paymentStatus === 'paid' ||
          (c.amountPaid && c.amountPaid > 0) ||
          (c.items && c.items.length > 0))
    )
    .map((c) => ({
      ...c,
      status: 'paid',
      closedAt: c.closedAt || c.paidAt || c.openedAt || new Date().toISOString(),
      discountAmount: Number(c.discountAmount || c.discount || 0),
      total: Number(c.total || c.amountPaid || 0),
    }));

  return [...paidOrders, ...standaloneChecks];
}

/**
 * Compute Executive P&L, Branch Comparisons, Hourly Heatmap, BCG Matrix, Comparisons & Drill-Down
 */
export function computeExecutiveDashboard(
  db: any,
  branchId: string = 'all',
  period: ExecutivePeriod = 'all',
  options?: ComputeExecutiveDashboardOptions
): ExecutiveBIDashboardData {
  const includeHistoricalMigrated = options?.includeHistoricalMigrated !== false;
  const periodBounds = resolveLagosPeriodWindow(period, options?.startDate, options?.endDate);
  const allChecks = getAllSettledTransactions(db);
  const filteredChecks = filterChecksForBI(allChecks, branchId, period, {
    startDate: options?.startDate,
    endDate: options?.endDate,
    boundsOverride: periodBounds,
    includeHistoricalMigrated,
  });

  // Count live vs historical checks in filtered window
  const historicalMigratedCheckCount = filteredChecks.filter(
    (c: any) => c.isHistoricalMigrated || c.legacySourceSystem === 'ezee_optimus'
  ).length;
  const liveCheckCount = filteredChecks.length - historicalMigratedCheckCount;

  // 1. Core Revenue Aggregations
  const grossRevenue = filteredChecks.reduce((sum, c: any) => sum + (Number(c.total) || 0), 0);
  const discounts = filteredChecks.reduce((sum, c: any) => sum + (Number(c.discountAmount) || 0), 0);
  const netRevenue = Math.max(0, grossRevenue - discounts);

  // 2. Cost of Goods Sold (COGS / Food Cost Calculation)
  let calculatedCogs = 0;
  const itemSalesVolumeMap: Record<
    string,
    { name: string; category: string; qty: number; revenue: number; costTotal: number }
  > = {};

  for (const check of filteredChecks) {
    if (Array.isArray(check.items)) {
      for (const item of check.items) {
        const name = item.name || 'Menu Item';
        const qty = Number(item.quantity) || 1;
        const rev = Number(item.totalPrice) || (Number(item.unitPrice) || 0) * qty;

        const costRef = MENU_FOOD_COST_MAP[name];
        const unitCost = costRef ? costRef.cost : Math.round((Number(item.unitPrice) || 2000) * 0.34);
        const totalItemCost = unitCost * qty;

        calculatedCogs += totalItemCost;

        if (!itemSalesVolumeMap[name]) {
          itemSalesVolumeMap[name] = {
            name,
            category: costRef?.category || 'General Menu',
            qty: 0,
            revenue: 0,
            costTotal: 0,
          };
        }
        itemSalesVolumeMap[name].qty += qty;
        itemSalesVolumeMap[name].revenue += rev;
        itemSalesVolumeMap[name].costTotal += totalItemCost;
      }
    }
  }

  if (calculatedCogs === 0 && netRevenue > 0) {
    calculatedCogs = Math.round(netRevenue * 0.345);
  }

  const cogs = calculatedCogs;
  const cogsPct = netRevenue > 0 ? Number(((cogs / netRevenue) * 100).toFixed(1)) : 0;
  const grossProfit = Math.max(0, netRevenue - cogs);
  const grossMarginPct = netRevenue > 0 ? Number(((grossProfit / netRevenue) * 100).toFixed(1)) : 0;

  // 3. Operating Expenses (OPEX) — Combine baseline accruals with verified Operational Expense Claims
  const allExpenseClaims = Object.values(db.expenseClaims || {}) as any[];
  let claimsUtilityAndPower = 0;
  let claimsLogisticsAndFleet = 0;
  let claimsGeneralAndWelfare = 0;
  let verifiedExpenseClaimsCount = 0;
  const matchedExpenseClaims: any[] = [];

  for (const clm of allExpenseClaims) {
    if (!clm || !['approved', 'payment_pending', 'partially_paid', 'paid', 'reconciled'].includes(clm.status)) {
      continue;
    }
    const clmBranch = clm.operatingBranchId || clm.homeBranchId || 'gra';
    if (branchId !== 'all' && clmBranch !== branchId) continue;
    const clmTime = new Date(clm.approvedAt || clm.paidAt || clm.createdAt || 0).getTime();
    if ((periodBounds.startMs > 0 || period === 'custom' || period === 'yesterday') && (clmTime < periodBounds.startMs || clmTime > periodBounds.endMs)) {
      continue;
    }

    verifiedExpenseClaimsCount += 1;
    matchedExpenseClaims.push(clm);

    if (clm.claimType === 'cash_advance') {
      if (clm.status === 'reconciled' && clm.advanceRetirement) {
        const retiredExp = Number(clm.advanceRetirement.substantiatedExpenseAmount || 0);
        claimsGeneralAndWelfare += retiredExp;
      }
      continue;
    }

    if (clm.accountingClassification === 'inventory_purchase' || clm.accountingClassification === 'fixed_asset') {
      continue;
    }

    const amt = Number(clm.approvedAmount ?? clm.totalAmount ?? 0);
    if (amt <= 0) continue;

    if (clm.targetAccountCode === '6100' || clm.categoryId?.includes('diesel') || clm.categoryId?.includes('gas')) {
      claimsUtilityAndPower += amt;
    } else if (clm.targetAccountCode === '6500' || clm.categoryId?.includes('dispatch')) {
      claimsLogisticsAndFleet += amt;
    } else {
      claimsGeneralAndWelfare += amt;
    }
  }

  const laborCost = (netRevenue > 0 ? Math.round(netRevenue * 0.192) : 0) + claimsGeneralAndWelfare;
  const generatorAndPower = (netRevenue > 0 ? Math.round(netRevenue * 0.076) : 0) + claimsUtilityAndPower;
  const deliveryFleet = (netRevenue > 0 ? Math.round(netRevenue * 0.032) : 0) + claimsLogisticsAndFleet;

  const filteredWastage = filterWastageForBI(db.wastage || [], branchId, period, {
    startDate: options?.startDate,
    endDate: options?.endDate,
    boundsOverride: periodBounds,
  });
  let wastageLossTotal = 0;
  const wastageByCategory: Record<string, number> = {
    Proteins: 0,
    Bakery: 0,
    Produce: 0,
    Packaging: 0,
    Dairy: 0,
  };
  const wastageByReason: Record<string, { count: number; loss: number }> = {};

  for (const w of filteredWastage) {
    const loss = Number(w.totalLossValue) || 0;
    wastageLossTotal += loss;

    const lowerName = (w.itemName || '').toLowerCase();
    if (lowerName.includes('chicken') || lowerName.includes('beef') || lowerName.includes('catfish') || lowerName.includes('turkey') || lowerName.includes('goat') || lowerName.includes('fish')) {
      wastageByCategory.Proteins += loss;
    } else if (lowerName.includes('flour') || lowerName.includes('bread') || lowerName.includes('yeast') || lowerName.includes('butter') || lowerName.includes('dough')) {
      wastageByCategory.Bakery += loss;
    } else if (lowerName.includes('tomato') || lowerName.includes('pepper') || lowerName.includes('onion') || lowerName.includes('vegetable')) {
      wastageByCategory.Produce += loss;
    } else if (lowerName.includes('box') || lowerName.includes('pack') || lowerName.includes('foil') || lowerName.includes('bag')) {
      wastageByCategory.Packaging += loss;
    } else {
      wastageByCategory.Dairy += loss;
    }

    const reason = w.reason || 'General Spoilage';
    if (!wastageByReason[reason]) {
      wastageByReason[reason] = { count: 0, loss: 0 };
    }
    wastageByReason[reason].count += 1;
    wastageByReason[reason].loss += loss;
  }

  const periodWastageLoss = wastageLossTotal;
  const totalOpex = laborCost + generatorAndPower + periodWastageLoss + deliveryFleet;
  const netProfit = grossProfit - totalOpex;
  const netMarginPct = netRevenue > 0 ? Number(((netProfit / netRevenue) * 100).toFixed(1)) : 0;

  const pnl: ExecutivePnL = {
    grossRevenue,
    discounts,
    netRevenue,
    cogs,
    cogsPct,
    grossProfit,
    grossMarginPct,
    operatingExpenses: {
      labor: laborCost,
      generatorAndPower,
      wastageShrinkage: periodWastageLoss,
      deliveryFleet,
      totalOpex,
    },
    netProfit,
    netMarginPct,
  };

  // 4. Multi-Branch Comparative Benchmarks
  const branches: BranchId[] = ['gra', 'okabere', 'ugbowo'];
  const branchBenchmarks: BranchBenchmark[] = branches.map((bId) => {
    const config = BRANCH_CONFIG[bId];
    const bChecks = filterChecksForBI(allChecks, bId, period, {
      startDate: options?.startDate,
      endDate: options?.endDate,
      boundsOverride: periodBounds,
      includeHistoricalMigrated,
    });

    const bGross = bChecks.reduce((sum, c: any) => sum + (Number(c.total) || 0), 0);
    const bNet = bGross;
    const bCount = bChecks.length;
    const bAov = bCount > 0 ? Math.round(bGross / bCount) : 0;
    const sharePct = grossRevenue > 0 ? Number(((bGross / grossRevenue) * 100).toFixed(1)) : 0;

    const bCogs = Math.round(bNet * (bId === 'gra' ? 0.33 : bId === 'okabere' ? 0.35 : 0.37));
    const bCogsPct = bNet > 0 ? Number(((bCogs / bNet) * 100).toFixed(1)) : 0;
    const bGrossProfit = bNet - bCogs;

    const bLabor = Math.round(bNet * 0.19);
    const bFuel = Math.round(bNet * (bId === 'okabere' ? 0.085 : 0.072));
    const bWasteList = filterWastageForBI(db.wastage || [], bId, period, {
      startDate: options?.startDate,
      endDate: options?.endDate,
      boundsOverride: periodBounds,
    });
    const bWaste = bWasteList.reduce((sum, w) => sum + (Number(w.totalLossValue) || 0), 0);
    const bOpex = bLabor + bFuel + bWaste;
    const bNetProfit = bGrossProfit - bOpex;
    const bMarginPct = bNet > 0 ? Number(((bNetProfit / bNet) * 100).toFixed(1)) : 0;

    const dineIn = bChecks.filter((c: any) => c.checkType === 'dine_in').length;
    const takeaway = bChecks.filter((c: any) => c.checkType === 'takeaway').length;
    const delivery = bChecks.filter((c: any) => c.checkType === 'delivery').length;
    const catering = Math.max(0, bCount - dineIn - takeaway - delivery);

    const branchItemMap: Record<string, { name: string; qty: number; rev: number }> = {};
    for (const c of bChecks) {
      if (Array.isArray(c.items)) {
        for (const it of c.items) {
          const itName = it.name || 'Menu Item';
          if (!branchItemMap[itName]) branchItemMap[itName] = { name: itName, qty: 0, rev: 0 };
          branchItemMap[itName].qty += Number(it.quantity) || 1;
          branchItemMap[itName].rev += Number(it.totalPrice) || 0;
        }
      }
    }
    const branchTopItems = Object.values(branchItemMap).sort((a, b) => b.rev - a.rev);
    const topItemName = branchTopItems[0]?.name || (bCount > 0 ? 'Standard Menu' : 'Awaiting Orders');

    const branchTasks = Object.values(db.deliveryTasks || {}).filter((t: any) => t.branchId === bId);
    const completedTasks = branchTasks.filter((t: any) => t.status === 'delivered');
    const onTimeTasks = completedTasks.filter((t: any) => !t.delayed);
    const deliverySlaCompliancePct =
      completedTasks.length > 0 ? Number(((onTimeTasks.length / completedTasks.length) * 100).toFixed(1)) : 100.0;

    return {
      branchId: bId,
      branchName: config.name,
      tagline: config.tagline,
      grossSales: bGross,
      netSales: bNet,
      orderCount: bCount,
      aov: bAov,
      revenueSharePct: sharePct,
      cogsNaira: bCogs,
      cogsPct: bCogsPct,
      laborCostNaira: bLabor,
      utilitiesFuelCostNaira: bFuel,
      wastageLossNaira: bWaste,
      netProfitNaira: bNetProfit,
      netMarginPct: bMarginPct,
      channelSplit: { dineIn, takeaway, delivery, catering },
      avgTableTurnMinutes: config.tableTurn,
      deliverySlaCompliancePct,
      topItemName,
    };
  });

  // 5. Hourly Sales & Kitchen Rush Curve (08:00 to 21:00 in Africa/Lagos WAT)
  const hourlySalesMap: Record<number, { count: number; rev: number }> = {};
  for (let h = 8; h <= 21; h++) {
    hourlySalesMap[h] = { count: 0, rev: 0 };
  }

  for (const check of filteredChecks) {
    const ts = check.originalTimestamp || check.openedAt || check.closedAt || Date.now();
    const lagosHour = new Date(new Date(ts).getTime() + LAGOS_OFFSET_MS).getUTCHours();
    if (hourlySalesMap[lagosHour]) {
      hourlySalesMap[lagosHour].count += 1;
      hourlySalesMap[lagosHour].rev += Number(check.total) || 0;
    }
  }

  const hourlySales: HourlySalesSlot[] = [];
  for (let h = 8; h <= 21; h++) {
    const slot = hourlySalesMap[h];
    const hourStr = `${String(h).padStart(2, '0')}:00`;
    const label = `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`;

    let rushLevel: 'normal' | 'rush' | 'peak' = 'normal';
    if ((h >= 12 && h <= 14) || (h >= 18 && h <= 20)) {
      rushLevel = 'peak';
    } else if (h === 11 || h === 15 || h === 17 || h === 21) {
      rushLevel = 'rush';
    }

    hourlySales.push({
      hour: hourStr,
      hourLabel: label,
      orderCount: slot.count,
      revenue: slot.rev,
      rushLevel,
    });
  }

  // 6. BCG Menu Engineering Quadrant Analysis
  const allItemsList = Object.values(itemSalesVolumeMap);
  const totalItemsSold = allItemsList.reduce((sum, it) => sum + it.qty, 0);
  const avgVolumePerItem = allItemsList.length > 0 ? totalItemsSold / allItemsList.length : 1;

  const menuMatrix: MenuEngineeringItem[] = allItemsList
    .map((item) => {
      const unitPrice = item.qty > 0 ? Math.round(item.revenue / item.qty) : 2500;
      const unitCost = item.qty > 0 ? Math.round(item.costTotal / item.qty) : 1000;
      const itemMarginPct = unitPrice > 0 ? Number((((unitPrice - unitCost) / unitPrice) * 100).toFixed(1)) : 50;
      const itemGrossProfit = item.revenue - item.costTotal;

      const isHighVolume = item.qty >= avgVolumePerItem;
      const isHighMargin = itemMarginPct >= 55.0;

      let quadrant: 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG' = 'STAR';
      let strategicRecommendation = '';

      if (isHighVolume && isHighMargin) {
        quadrant = 'STAR';
        strategicRecommendation =
          'Core profit driver. Guarantee premium ingredient supply, spotlight in hero banners and train servers to recommend.';
      } else if (isHighVolume && !isHighMargin) {
        quadrant = 'PLOWHORSE';
        strategicRecommendation =
          'High customer demand but slimmer margin. Maintain portion consistency or apply modest 5% price revision to recover profitability.';
      } else if (!isHighVolume && isHighMargin) {
        quadrant = 'PUZZLE';
        strategicRecommendation =
          'Lucrative gross margin with untapped demand. Bundle with popular drinks or test limited-time lunch combo specials.';
      } else {
        quadrant = 'DOG';
        strategicRecommendation =
          'Low volume and margin. Review recipe formulation with kitchen lead or re-evaluate raw material procurement costs.';
      }

      return {
        id: `bcg-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: item.name,
        category: item.category,
        volume: item.qty,
        sellingPrice: unitPrice,
        foodCost: unitCost,
        grossMarginPct: itemMarginPct,
        revenue: item.revenue,
        grossProfit: itemGrossProfit,
        quadrant,
        strategicRecommendation,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);

  // 7. Wastage Forensic Audit Summary
  const totalLoss = periodWastageLoss;
  const wastageCatArr = Object.entries(wastageByCategory).map(([cat, amount]) => ({
    category: cat,
    amount,
    pct: wastageLossTotal > 0 ? Number(((amount / wastageLossTotal) * 100).toFixed(1)) : 20,
  }));

  const wastageReasonArr = Object.entries(wastageByReason).map(([reason, data]) => ({
    reason,
    count: data.count,
    lossNaira: data.loss,
  }));

  const wastageAudit: WastageAuditSummary = {
    totalLossNaira: totalLoss,
    byCategory: wastageCatArr,
    byReason: wastageReasonArr,
    recentIncidents: filteredWastage.slice(0, 5),
  };

  // 8 & 9. Labor Productivity & Executive Insights
  const { laborProductivity, aiInsights } = computeLaborProductivityAndInsights({
    db,
    filteredChecks,
    branchId,
    menuMatrix,
    wastageByCategory,
    branchBenchmarks,
    pnl,
  });

  // 10. Period-over-Period Comparison (Part 4)
  let comparison: ExecutivePeriodComparison | undefined = undefined;
  const compMode = options?.comparisonMode;
  const likeForLike = options?.likeForLike !== false;
  if (compMode && compMode !== 'none') {
    const compWindows = resolveLagosComparisonWindows(compMode, likeForLike);
    if (compWindows) {
      const curStats = computeWindowSummaryMetrics(
        db,
        allChecks,
        branchId,
        compWindows.current,
        includeHistoricalMigrated
      );
      const prevStats = computeWindowSummaryMetrics(
        db,
        allChecks,
        branchId,
        compWindows.previous,
        includeHistoricalMigrated
      );
      comparison = {
        mode: compMode,
        label: compWindows.label,
        isLikeForLike: likeForLike,
        currentWindow: {
          startIso: new Date(compWindows.current.startMs).toISOString(),
          endIso: new Date(compWindows.current.endMs).toISOString(),
          label: compWindows.current.label,
        },
        previousWindow: {
          startIso: new Date(compWindows.previous.startMs).toISOString(),
          endIso: new Date(compWindows.previous.endMs).toISOString(),
          label: compWindows.previous.label,
        },
        metrics: {
          netRevenue: buildMetricComparison(curStats.netRevenue, prevStats.netRevenue),
          grossProfit: buildMetricComparison(curStats.grossProfit, prevStats.grossProfit),
          totalOpex: buildMetricComparison(curStats.totalOpex, prevStats.totalOpex),
          netProfit: buildMetricComparison(curStats.netProfit, prevStats.netProfit),
          orderCount: buildMetricComparison(curStats.orderCount, prevStats.orderCount),
          aov: buildMetricComparison(curStats.aov, prevStats.aov),
        },
      };
    }
  }

  // 11. Drill-Down Records (Part 4)
  const drillDownRecords: ExecutiveDrillDownRecord[] = [
    ...filteredChecks.slice(0, 60).map((c: any) => ({
      id: c.id,
      recordNumber: c.checkNumber || c.id,
      recordType: (c.isHistoricalMigrated ? 'historical_migrated' : 'pos_check') as
        | 'pos_check'
        | 'historical_migrated',
      branchId: c.branchId || 'gra',
      timestamp: c.originalTimestamp || c.closedAt || c.paidAt || c.openedAt,
      categoryOrMethod: String(c.paymentMethod || 'cash').toUpperCase(),
      amountNaira: Number(c.total || 0),
      status: c.status,
      operatorName: c.closedByName || c.openedByName || 'Staff',
      isHistoricalMigrated: Boolean(c.isHistoricalMigrated),
    })),
    ...matchedExpenseClaims.slice(0, 30).map((clm: any) => ({
      id: clm.id,
      recordNumber: clm.claimNumber || clm.id,
      recordType: 'expense_claim' as const,
      branchId: clm.operatingBranchId || clm.homeBranchId || 'gra',
      timestamp: clm.approvedAt || clm.paidAt || clm.createdAt,
      categoryOrMethod: `${clm.categoryName || clm.categoryId} (${clm.accountingClassification || 'opex'})`,
      amountNaira: Number(clm.approvedAmount ?? clm.totalAmount ?? 0),
      status: clm.status,
      operatorName: clm.claimantName || 'Staff',
    })),
  ];

  const dataQualityNotice = {
    hasAccrualEstimates: true,
    liveCheckCount,
    historicalMigratedCheckCount,
    verifiedExpenseClaimsCount,
    disclosureText:
      'Revenue, discounts, wastage, and approved expense claims are computed from actual database transactions in Africa/Lagos (WAT). Standard baseline operating accruals (19.2% labor, 7.6% power/diesel, 3.2% fleet) are combined with verified operational expense claims for consolidated P&L benchmarking; General Ledger & Trial Balance use strict double-entry posted transactions only.',
  };

  const allFilteredItems: any[] = [];
  for (const c of filteredChecks) {
    if (Array.isArray(c.items)) {
      allFilteredItems.push(...c.items);
    }
  }
  const packageSalesSummary = expandOrderItemsWithPackages(db, allFilteredItems);

  const result: any = {
    period,
    branchId,
    timezone: 'Africa/Lagos',
    windowLabel: periodBounds.label,
    windowStartIso: new Date(periodBounds.startMs).toISOString(),
    windowEndIso: new Date(periodBounds.endMs).toISOString(),
    includeHistoricalMigrated,
    dataQualityNotice,
    comparison,
    drillDownRecords,
    pnl,
    branchBenchmarks,
    hourlySales,
    menuMatrix,
    wastageAudit,
    laborProductivity,
    aiInsights,
    packageSalesSummary,
  };
  return result;
}
