import {
  DEFAULT_CHART_OF_ACCOUNTS,
  validateChartOfAccountsMapping,
  resolveDateBounds,
  resolveBranchLabel,
  roundMoney,
  computeSaleTaxSplit,
  mapTenderToAccountCode,
  estimateCheckCogs,
} from './chartAndTaxHelpers.ts';
import type {
  TaxTreatmentMode,
  JournalLine,
  JournalEntryDocument,
  AccountingLedgerReport,
  AccountingBuildOptions,
} from './chartAndTaxHelpers.ts';
import { appendAuxiliaryLedgerEntriesAndFinalize } from './auxiliaryLedgersAndTrialBalance.ts';

export function buildAccountingJournalEntries(
  db: any,
  options: AccountingBuildOptions = {}
): AccountingLedgerReport {
  const chart = options.chartOfAccounts || DEFAULT_CHART_OF_ACCOUNTS;
  const validation = validateChartOfAccountsMapping(chart);
  if (!validation.valid) {
    throw new Error(`Chart of Accounts validation failed: ${validation.errors.join('; ')}`);
  }

  const branchFilter = (options.branchId || 'all').toLowerCase().trim();
  const period = options.period || 'all';
  const { startMs, endMs } = resolveDateBounds(period, options.startDate, options.endDate);

  const configuredTaxMode: TaxTreatmentMode =
    options.taxMode ||
    db?.accountingConfig?.taxMode ||
    (db?.receiptTemplates?.['tmpl-cust-receipt']?.showTaxBreakdown === false ? 'exempt' : 'vat_inclusive_7_5');

  const accountantConfirmed = Boolean(db?.accountingConfig?.accountantConfirmedTaxPolicy);

  const matchesBranch = (recordBranchId?: string, allowCommissaryWhenAll = true): boolean => {
    const b = (recordBranchId || 'gra').toLowerCase().trim();
    if (branchFilter === 'all') {
      return allowCommissaryWhenAll ? true : b !== 'general_store';
    }
    return b === branchFilter;
  };

  const matchesDate = (isoTimestamp?: string): boolean => {
    if (!isoTimestamp) return false;
    const t = new Date(isoTimestamp).getTime();
    if (Number.isNaN(t)) return false;
    return t >= startMs && t <= endMs;
  };

  const entries: JournalEntryDocument[] = [];
  let seq = 1;

  const pushEntry = (
    sourceType: JournalLine['sourceType'],
    sourceId: string,
    sourceRef: string,
    timestamp: string,
    branchId: string,
    rawLines: {
      accountCode: string;
      debit: number;
      credit: number;
      memo: string;
      taxCode?: string;
    }[]
  ) => {
    const activeLines = rawLines.filter(
      (l) => roundMoney(l.debit) > 0 || roundMoney(l.credit) > 0
    );
    if (activeLines.length === 0) return;

    const journalDate = timestamp.slice(0, 10);
    const journalNo = `JNL-${journalDate.replace(/-/g, '')}-${String(seq++).padStart(4, '0')}`;
    const branchName = resolveBranchLabel(branchId);

    const builtLines: JournalLine[] = activeLines.map((l) => {
      const acct = chart[l.accountCode];
      if (!acct) {
        throw new Error(`Missing Chart of Accounts entry for code "${l.accountCode}" in transaction ${sourceRef}`);
      }
      const debit = roundMoney(l.debit);
      const credit = roundMoney(l.credit);
      if (debit < 0 || credit < 0) {
        throw new Error(`Negative debit/credit not allowed on ${sourceRef} (${l.accountCode})`);
      }
      if (debit > 0 && credit > 0) {
        throw new Error(`Single journal line cannot have both debit and credit > 0 (${sourceRef})`);
      }
      return {
        journalNo,
        journalDate,
        timestamp,
        sourceType,
        sourceId,
        sourceRef,
        branchId,
        branchName,
        accountCode: acct.code,
        accountName: acct.name,
        debit,
        credit,
        memo: l.memo,
        taxCode: l.taxCode || 'NON',
      };
    });

    const totalDebit = roundMoney(builtLines.reduce((s, l) => s + l.debit, 0));
    const totalCredit = roundMoney(builtLines.reduce((s, l) => s + l.credit, 0));
    const diff = roundMoney(Math.abs(totalDebit - totalCredit));

    if (diff !== 0) {
      throw new Error(
        `Unbalanced journal entry ${journalNo} (${sourceRef}): totalDebit=${totalDebit.toFixed(2)}, totalCredit=${totalCredit.toFixed(2)}, diff=${diff.toFixed(2)}`
      );
    }

    entries.push({
      journalNo,
      journalDate,
      timestamp,
      sourceType,
      sourceId,
      sourceRef,
      branchId,
      branchName,
      lines: builtLines,
      totalDebit,
      totalCredit,
      isBalanced: true,
    });
  };

  const processedOrderIds = new Set<string>();
  const checksList = Object.values(db?.checks || {}) as any[];
  checksList.sort((a, b) => new Date(a.paidAt || a.closedAt || a.openedAt || 0).getTime() - new Date(b.paidAt || b.closedAt || b.openedAt || 0).getTime());

  let grossSalesCollected = 0;
  let discountsGranted = 0;
  let netFoodAndBeverageRevenue = 0;
  let deliveryFeeRevenue = 0;
  let outputVatPayable = 0;
  let refundsReversed = 0;
  let totalCogsRecognized = 0;

  const processSaleTransaction = (tx: {
    id: string;
    ref: string;
    sourceType: 'POS_SALE' | 'ONLINE_SALE';
    branchId: string;
    timestamp: string;
    items: any[];
    subtotal: number;
    discountAmount: number;
    deliveryFee: number;
    total: number;
    vatAmount?: number;
    paymentMethod?: string;
    splitPayments?: { method: string; amount: number }[];
    isRefundedOrVoidedAfterPay?: boolean;
    refundTimestamp?: string;
    refundReason?: string;
  }) => {
    const taxSplit = computeSaleTaxSplit({
      items: tx.items,
      subtotal: tx.subtotal,
      discountAmount: tx.discountAmount,
      deliveryFee: tx.deliveryFee,
      totalCollected: tx.total,
      explicitVatAmount: tx.vatAmount,
      taxMode: configuredTaxMode,
    });

    const saleLines: {
      accountCode: string;
      debit: number;
      credit: number;
      memo: string;
      taxCode?: string;
    }[] = [];

    const expectedTenderTotal = taxSplit.effectiveTotal;
    if (Array.isArray(tx.splitPayments) && tx.splitPayments.length > 0) {
      let splitSum = 0;
      tx.splitPayments.forEach((sp, idx) => {
        const acctCode = mapTenderToAccountCode(sp.method);
        const amt =
          idx === tx.splitPayments!.length - 1
            ? roundMoney(expectedTenderTotal - splitSum)
            : roundMoney(Number(sp.amount || 0));
        splitSum = roundMoney(splitSum + amt);
        if (amt > 0) {
          saleLines.push({
            accountCode: acctCode,
            debit: amt,
            credit: 0,
            memo: `Sale receipt ${tx.ref} (${sp.method.toUpperCase()} split tender)`,
            taxCode: configuredTaxMode === 'exempt' ? 'EXEMPT' : 'VAT-7.5',
          });
        }
      });
    } else {
      const acctCode = mapTenderToAccountCode(tx.paymentMethod || 'cash');
      saleLines.push({
        accountCode: acctCode,
        debit: expectedTenderTotal,
        credit: 0,
        memo: `Sale receipt ${tx.ref} (${(tx.paymentMethod || 'cash').toUpperCase()})`,
        taxCode: configuredTaxMode === 'exempt' ? 'EXEMPT' : 'VAT-7.5',
      });
    }

    if (taxSplit.discountAmount > 0) {
      saleLines.push({
        accountCode: '4090',
        debit: taxSplit.discountAmount,
        credit: 0,
        memo: `Discount / promo allowance on ${tx.ref}`,
        taxCode: 'NON',
      });
    }

    if (taxSplit.netFoodRevenue > 0) {
      saleLines.push({
        accountCode: '4000',
        debit: 0,
        credit: taxSplit.netFoodRevenue,
        memo: `Food & beverage sales revenue on ${tx.ref}`,
        taxCode: configuredTaxMode === 'exempt' ? 'EXEMPT' : 'VAT-7.5',
      });
    }

    if (taxSplit.deliveryFeeRevenue > 0) {
      saleLines.push({
        accountCode: '4050',
        debit: 0,
        credit: taxSplit.deliveryFeeRevenue,
        memo: `Delivery logistics fee revenue on ${tx.ref}`,
        taxCode: 'NON',
      });
    }

    if (taxSplit.outputVatAmount > 0) {
      saleLines.push({
        accountCode: '2200',
        debit: 0,
        credit: taxSplit.outputVatAmount,
        memo: `FIRS 7.5% Output VAT on ${tx.ref}`,
        taxCode: 'VAT-7.5',
      });
    }

    const cogsAmount = estimateCheckCogs(tx.items);
    if (cogsAmount > 0) {
      saleLines.push({
        accountCode: '5000',
        debit: cogsAmount,
        credit: 0,
        memo: `Direct BOM Cost of Goods Sold for ${tx.ref}`,
        taxCode: 'NON',
      });
      saleLines.push({
        accountCode: '1300',
        debit: 0,
        credit: cogsAmount,
        memo: `Inventory asset depletion for ${tx.ref}`,
        taxCode: 'NON',
      });
    }

    pushEntry(tx.sourceType, tx.id, tx.ref, tx.timestamp, tx.branchId, saleLines);

    grossSalesCollected = roundMoney(grossSalesCollected + expectedTenderTotal);
    discountsGranted = roundMoney(discountsGranted + taxSplit.discountAmount);
    netFoodAndBeverageRevenue = roundMoney(netFoodAndBeverageRevenue + taxSplit.netFoodRevenue);
    deliveryFeeRevenue = roundMoney(deliveryFeeRevenue + taxSplit.deliveryFeeRevenue);
    outputVatPayable = roundMoney(outputVatPayable + taxSplit.outputVatAmount);
    totalCogsRecognized = roundMoney(totalCogsRecognized + cogsAmount);

    if (tx.isRefundedOrVoidedAfterPay) {
      const reversalTimestamp = tx.refundTimestamp || tx.timestamp;
      const reversalLines = saleLines.map((line) => ({
        accountCode: line.accountCode,
        debit: line.credit,
        credit: line.debit,
        memo: `REVERSAL / REFUND of ${tx.ref}${tx.refundReason ? ` (${tx.refundReason})` : ''}`,
        taxCode: line.taxCode,
      }));
      pushEntry('SALE_REFUND', `${tx.id}-refund`, `${tx.ref}-REV`, reversalTimestamp, tx.branchId, reversalLines);

      refundsReversed = roundMoney(refundsReversed + expectedTenderTotal);
      grossSalesCollected = roundMoney(grossSalesCollected - expectedTenderTotal);
      discountsGranted = roundMoney(discountsGranted - taxSplit.discountAmount);
      netFoodAndBeverageRevenue = roundMoney(netFoodAndBeverageRevenue - taxSplit.netFoodRevenue);
      deliveryFeeRevenue = roundMoney(deliveryFeeRevenue - taxSplit.deliveryFeeRevenue);
      outputVatPayable = roundMoney(outputVatPayable - taxSplit.outputVatAmount);
      totalCogsRecognized = roundMoney(totalCogsRecognized - cogsAmount);
    }
  };

  const includeHistorical = Boolean((options as any).includeHistoricalMigrated);

  for (const chk of checksList) {
    if (!includeHistorical && (chk.isHistoricalMigrated || chk.legacySourceSystem === 'ezee_optimus')) continue;
    if (chk.orderId) processedOrderIds.add(chk.orderId);
    const ts = chk.paidAt || chk.closedAt || chk.openedAt;
    if (!matchesBranch(chk.branchId, false) || !matchesDate(ts)) continue;

    const isPaid = chk.status === 'paid' || chk.paymentStatus === 'paid';
    const isRefunded =
      chk.paymentStatus === 'refunded' ||
      chk.status === 'refunded' ||
      (chk.status === 'voided' && Boolean(chk.paidAt));

    if (!isPaid && !isRefunded) continue;

    const items = Array.isArray(chk.items) ? chk.items : [];
    const computedSubtotal =
      Number(chk.subtotal || 0) > 0
        ? Number(chk.subtotal)
        : items.reduce((s: number, it: any) => s + Number(it.totalPrice ?? Number(it.unitPrice ?? it.price ?? 0) * Number(it.quantity ?? 1)), 0);

    const effectiveSplitPayments =
      Array.isArray(chk.splitPayments) && chk.splitPayments.length > 0
        ? chk.splitPayments
        : Array.isArray(chk.payments) && chk.payments.length > 1
        ? chk.payments.map((p: any) => ({ method: p.method, amount: p.amount }))
        : undefined;

    processSaleTransaction({
      id: chk.id,
      ref: chk.checkNumber || chk.id,
      sourceType: chk.orderId ? 'ONLINE_SALE' : 'POS_SALE',
      branchId: chk.branchId || 'gra',
      timestamp: ts,
      items,
      subtotal: computedSubtotal,
      discountAmount: Number(chk.discountAmount || 0),
      deliveryFee: Number(chk.deliveryFee || 0),
      total: Number(chk.total || Math.max(0, computedSubtotal - Number(chk.discountAmount || 0) + Number(chk.deliveryFee || 0))),
      vatAmount: typeof chk.vatAmount === 'number' ? chk.vatAmount : undefined,
      paymentMethod: chk.paymentMethod || (Array.isArray(chk.payments) && chk.payments[0]?.method) || 'cash',
      splitPayments: effectiveSplitPayments,
      isRefundedOrVoidedAfterPay: isRefunded,
      refundTimestamp: chk.voidedAt || chk.refundedAt || ts,
      refundReason: chk.voidReason || chk.refundReason,
    });
  }

  const ordersList = Object.values(db?.orders || {}) as any[];
  ordersList.sort((a, b) => new Date(a.paidAt || a.createdAt || 0).getTime() - new Date(b.paidAt || b.createdAt || 0).getTime());

  for (const ord of ordersList) {
    if (!includeHistorical && (ord.isHistoricalMigrated || ord.legacySourceSystem === 'ezee_optimus')) continue;
    if (processedOrderIds.has(ord.id) || db?.checks?.[`chk-${ord.id}`]) continue;
    const ts = ord.paidAt || ord.createdAt;
    if (!matchesBranch(ord.branchId, false) || !matchesDate(ts)) continue;

    const isPaid = ord.paymentStatus === 'paid';
    const isRefunded = ord.paymentStatus === 'refunded' || (ord.status === 'cancelled' && Boolean(ord.paidAt));
    if (!isPaid && !isRefunded) continue;

    const items = Array.isArray(ord.items) ? ord.items : [];
    const computedSubtotal =
      Number(ord.subtotal || 0) > 0
        ? Number(ord.subtotal)
        : items.reduce((s: number, it: any) => s + Number(it.totalPrice ?? Number(it.unitPrice ?? it.price ?? 0) * Number(it.quantity ?? 1)), 0);

    processSaleTransaction({
      id: ord.id,
      ref: ord.orderNumber || ord.id,
      sourceType: 'ONLINE_SALE',
      branchId: ord.branchId || 'gra',
      timestamp: ts,
      items,
      subtotal: computedSubtotal,
      discountAmount: Number(ord.discountAmount || 0),
      deliveryFee: Number(ord.deliveryFee || 0),
      total: Number(ord.total || Math.max(0, computedSubtotal - Number(ord.discountAmount || 0) + Number(ord.deliveryFee || 0))),
      vatAmount: typeof ord.vatAmount === 'number' ? ord.vatAmount : undefined,
      paymentMethod: ord.paymentMethod || 'pos_terminal',
      splitPayments: ord.splitPayments,
      isRefundedOrVoidedAfterPay: isRefunded,
      refundTimestamp: ord.cancelledAt || ord.refundedAt || ts,
      refundReason: ord.cancellationReason || ord.refundReason,
    });
  }

  return appendAuxiliaryLedgerEntriesAndFinalize({
    db,
    options,
    chart,
    branchFilter,
    period,
    configuredTaxMode,
    accountantConfirmed,
    matchesBranch,
    matchesDate,
    entries,
    pushEntry,
    salesTotals: {
      grossSalesCollected,
      discountsGranted,
      netFoodAndBeverageRevenue,
      deliveryFeeRevenue,
      outputVatPayable,
      refundsReversed,
      totalCogsRecognized,
    },
  });
}
