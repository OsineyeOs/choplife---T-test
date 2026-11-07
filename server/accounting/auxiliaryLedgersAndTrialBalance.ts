import crypto from 'crypto';
import {
  roundMoney,
  mapTenderToAccountCode,
  resolveBranchLabel,
} from './chartAndTaxHelpers.ts';
import type {
  ChartOfAccountEntry,
  TaxTreatmentMode,
  JournalLine,
  JournalEntryDocument,
  AccountingLedgerReport,
  AccountingBuildOptions,
} from './chartAndTaxHelpers.ts';

export function appendAuxiliaryLedgerEntriesAndFinalize(params: {
  db: any;
  options: AccountingBuildOptions;
  chart: Record<string, ChartOfAccountEntry>;
  branchFilter: string;
  period: 'today' | '7days' | '30days' | '7d' | '30d' | 'custom' | 'all' | string;
  configuredTaxMode: TaxTreatmentMode;
  accountantConfirmed: boolean;
  matchesBranch: (recordBranchId?: string, allowCommissaryWhenAll?: boolean) => boolean;
  matchesDate: (isoTimestamp?: string) => boolean;
  entries: JournalEntryDocument[];
  pushEntry: (
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
  ) => void;
  salesTotals: {
    grossSalesCollected: number;
    discountsGranted: number;
    netFoodAndBeverageRevenue: number;
    deliveryFeeRevenue: number;
    outputVatPayable: number;
    refundsReversed: number;
    totalCogsRecognized: number;
  };
}): AccountingLedgerReport {
  const {
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
    salesTotals,
  } = params;

  let grnInventoryAdditions = 0;
  let wastageWriteOffs = 0;
  let operatingExpensesPaidOut = 0;

  // 3. Verified Goods Receipt Notes (`db.goodsReceiptNotes`)
  const grnList = Object.values(db?.goodsReceiptNotes || {}) as any[];
  grnList.sort(
    (a, b) => new Date(a.receivedAt || a.createdAt || 0).getTime() - new Date(b.receivedAt || b.createdAt || 0).getTime()
  );

  for (const grn of grnList) {
    if (grn.status && grn.status !== 'verified') continue;
    const ts = grn.receivedAt || grn.createdAt;
    const loc = grn.receivingLocation || grn.branchId || 'general_store';
    if (!matchesBranch(loc, true) || !matchesDate(ts) || grn.isDemo || grn.dataOrigin === 'demo') continue;

    const acceptedValue = roundMoney(
      Number(
        grn.actualAcceptedValue ??
          grn.totalAcceptedValue ??
          (Array.isArray(grn.items || grn.lines)
            ? (grn.items || grn.lines).reduce(
                (s: number, l: any) => s + Number(l.acceptedQty ?? l.receivedQuantity ?? 0) * Number(l.unitPrice ?? 0),
                0
              )
            : 0)
      )
    );
    if (acceptedValue <= 0) continue;

    const ref = grn.grnNumber || grn.id;
    pushEntry('GRN_PURCHASE', grn.id, ref, ts, loc, [
      {
        accountCode: '1300',
        debit: acceptedValue,
        credit: 0,
        memo: `GRN stock intake ${ref} (${grn.supplierName || 'Trade Supplier'}, Inv: ${grn.supplierInvoiceNumber || 'N/A'})`,
      },
      {
        accountCode: '2000',
        debit: 0,
        credit: acceptedValue,
        memo: `Supplier trade payable for ${ref} (${grn.supplierName || 'Trade Supplier'})`,
      },
    ]);
    grnInventoryAdditions = roundMoney(grnInventoryAdditions + acceptedValue);
  }

  // 4. Inventory Wastage & Spoilage Write-Offs (`db.wastage`)
  const wastageList = Array.isArray(db?.wastage) ? db.wastage : Object.values(db?.wastage || {});
  wastageList.sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

  for (const wst of wastageList) {
    if (wst.isDemo || wst.dataOrigin === 'demo' || String(wst.itemId || '').startsWith('demo-')) continue;
    const ts = wst.timestamp || wst.createdAt;
    const loc = wst.locationId || wst.branchId || 'gra';
    if (!matchesBranch(loc, true) || !matchesDate(ts)) continue;

    const costLost = roundMoney(
      Number(wst.estimatedCostLost ?? wst.totalLossValue ?? Number(wst.quantity || 0) * Number(wst.unitCost || 0)) || 0
    );
    if (costLost <= 0) continue;

    const ref = wst.referenceNo || wst.id || `WST-${ts.slice(0, 10)}`;
    pushEntry('WASTAGE_WRITEOFF', wst.id || ref, ref, ts, loc, [
      {
        accountCode: '6300',
        debit: costLost,
        credit: 0,
        memo: `Wastage write-off: ${wst.quantity} ${wst.unit || ''} ${wst.itemName || ''} (${wst.reason || 'Spoilage'})`,
      },
      {
        accountCode: '1300',
        debit: 0,
        credit: costLost,
        memo: `Inventory relief for wastage ${ref}`,
      },
    ]);
    wastageWriteOffs = roundMoney(wastageWriteOffs + costLost);
  }

  // Pre-index cash movements and GRNs linked to operational expense claims to prevent double-counting
  const expenseClaimsList = Object.values(db?.expenseClaims || {}) as any[];
  const linkedCashMovementIds = new Set<string>();
  for (const clm of expenseClaimsList) {
    if (
      clm &&
      !['draft', 'rejected', 'cancelled'].includes(clm.status) &&
      clm.linkedCashMovementId
    ) {
      linkedCashMovementIds.add(String(clm.linkedCashMovementId));
    }
    if (Array.isArray(clm?.payments)) {
      for (const p of clm.payments) {
        if (p?.linkedCashMovementId) {
          linkedCashMovementIds.add(String(p.linkedCashMovementId));
        }
      }
    }
  }

  // 5. Cash Drawer Movements (`db.cashMovements`)
  const cashMoves = Array.isArray(db?.cashMovements) ? db.cashMovements : Object.values(db?.cashMovements || {});
  cashMoves.sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

  for (const mv of cashMoves) {
    const ts = mv.timestamp || mv.createdAt;
    const loc = mv.branchId || 'gra';
    if (!matchesBranch(loc, false) || !matchesDate(ts)) continue;

    const amt = roundMoney(Number(mv.amount || 0));
    if (amt <= 0) continue;

    const ref = mv.id || `CSH-${ts.slice(0, 10)}`;
    const reasonText = String(mv.reason || '').toLowerCase();
    const mvType = mv.movementType || mv.type;

    if (mvType === 'paid_out') {
      // Skip if this cash drawer paid-out is already accounted for by a formal Expense Claim or Reimbursement Payout
      if (mv.id && linkedCashMovementIds.has(String(mv.id))) {
        continue;
      }

      const expAcct =
        reasonText.includes('diesel') || reasonText.includes('fuel') || reasonText.includes('generator') || reasonText.includes('power')
          ? '6100'
          : reasonText.includes('soap') || reasonText.includes('clean') || reasonText.includes('kitchen') || reasonText.includes('gas')
          ? '6200'
          : '6400';

      pushEntry('OPERATING_EXPENSE', mv.id || ref, ref, ts, loc, [
        {
          accountCode: expAcct,
          debit: amt,
          credit: 0,
          memo: `Register paid-out expense: ${mv.reason || 'Branch operating expense'}`,
        },
        {
          accountCode: '1010',
          debit: 0,
          credit: amt,
          memo: `Cash paid out from register drawer (${mv.staffName || 'Cashier'})`,
        },
      ]);
      operatingExpensesPaidOut = roundMoney(operatingExpensesPaidOut + amt);
    } else if (mvType === 'safe_drop') {
      pushEntry('SAFE_DROP', mv.id || ref, ref, ts, loc, [
        {
          accountCode: '1015',
          debit: amt,
          credit: 0,
          memo: `Vault safe drop from register: ${mv.reason || 'Shift liquidity drop'}`,
        },
        {
          accountCode: '1010',
          debit: 0,
          credit: amt,
          memo: `Cash removed from register drawer to vault safe`,
        },
      ]);
    }
  }

  // 5B. Operational Expense Claims, Company-Funded Expenses & Cash Advances (`db.expenseClaims`)
  expenseClaimsList.sort(
    (a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );

  for (const clm of expenseClaimsList) {
    if (!clm || ['draft', 'submitted', 'pending_approval', 'returned', 'pending_additional_approval', 'rejected', 'cancelled'].includes(clm.status)) {
      continue;
    }
    const loc = clm.operatingBranchId || clm.homeBranchId || 'gra';
    if (!matchesBranch(loc, true)) continue;

    const ref = clm.claimReference || clm.id;
    const totalAmt = roundMoney(Number(clm.approvedAmount ?? clm.totalAmount ?? 0));
    if (totalAmt <= 0) continue;

    const targetAcct = chart[clm.targetAccountCode] ? clm.targetAccountCode : '6400';
    const vatAmt = roundMoney(Math.max(0, Number(clm.vatAmount || 0)));
    const netExpenseAmt = vatAmt > 0 && vatAmt < totalAmt && chart['1350'] ? roundMoney(totalAmt - vatAmt) : totalAmt;
    const recVatAmt = vatAmt > 0 && vatAmt < totalAmt && chart['1350'] ? vatAmt : 0;

    if (clm.claimType === 'reimbursement_claim') {
      // Stage 1: Expense Recognition on Approval (Dr Expense/Asset/Inventory, Cr 2100 Staff Expense Reimbursement Payable)
      // If linked to an already verified GRN, do not double-post inventory recognition
      const recTs = clm.approvedAt || clm.submittedAt || clm.createdAt;
      if (!clm.linkedGrnId && matchesDate(recTs)) {
        const recLines: { accountCode: string; debit: number; credit: number; memo: string; taxCode?: string }[] = [
          {
            accountCode: targetAcct,
            debit: netExpenseAmt,
            credit: 0,
            memo: `Approved staff expense claim ${ref}: ${clm.businessReason || clm.description} (${clm.claimantName}, Vendor: ${clm.vendorName})`,
            taxCode: recVatAmt > 0 ? 'INPUT_VAT_7_5' : 'EXEMPT',
          },
        ];
        if (recVatAmt > 0) {
          recLines.push({
            accountCode: '1350',
            debit: recVatAmt,
            credit: 0,
            memo: `Recoverable input VAT on claim ${ref} (Tax Inv: ${clm.taxInvoiceNumber || clm.receiptOrInvoiceRef || 'N/A'})`,
            taxCode: 'INPUT_VAT_7_5',
          });
        }
        recLines.push({
          accountCode: '2100',
          debit: 0,
          credit: totalAmt,
          memo: `Staff reimbursement payable to ${clm.claimantName} for ${ref}`,
          taxCode: 'EXEMPT',
        });

        pushEntry('EXPENSE_CLAIM_RECOGNITION', `${clm.id}-rec`, ref, recTs, loc, recLines);
        if (clm.status !== 'reversed') {
          operatingExpensesPaidOut = roundMoney(operatingExpensesPaidOut + totalAmt);
        }
      }

      // Stage 2: Reimbursement Settlement Payouts (Dr 2100 Staff Expense Reimbursement Payable, Cr Cash 1010 / Bank 1030)
      const payments = Array.isArray(clm.payments) ? clm.payments : [];
      for (const pmt of payments) {
        const pmtAmt = roundMoney(Number(pmt.amount || 0));
        const pmtTs = pmt.paidAt || clm.paidAt || clm.approvedAt;
        if (pmtAmt <= 0 || !matchesDate(pmtTs)) continue;
        const creditAcct = chart[pmt.fundingAccountCode] ? pmt.fundingAccountCode : pmt.paymentMethod === 'cash_drawer' ? '1010' : '1030';
        pushEntry('EXPENSE_CLAIM_PAYMENT', `${clm.id}-pmt-${pmt.id}`, pmt.paymentReference || ref, pmtTs, loc, [
          {
            accountCode: '2100',
            debit: pmtAmt,
            credit: 0,
            memo: `Reimbursement payout settled to ${clm.claimantName} for ${ref} (Ref: ${pmt.paymentReference})`,
          },
          {
            accountCode: creditAcct,
            debit: 0,
            credit: pmtAmt,
            memo: `Funds disbursed via ${pmt.paymentMethod} for ${ref}`,
          },
        ]);
      }

      // Stage 3: Controlled Accounting Reversal if status === 'reversed'
      if (clm.status === 'reversed') {
        const revTs = clm.reversedAt || new Date().toISOString();
        if (!clm.linkedGrnId && matchesDate(revTs)) {
          const revLines: { accountCode: string; debit: number; credit: number; memo: string }[] = [
            {
              accountCode: '2100',
              debit: totalAmt,
              credit: 0,
              memo: `REVERSAL of staff reimbursement payable ${ref}: ${clm.reversalReason || 'Controlled reversal'}`,
            },
            {
              accountCode: targetAcct,
              debit: 0,
              credit: netExpenseAmt,
              memo: `REVERSAL of recognized expense ${ref}`,
            },
          ];
          if (recVatAmt > 0) {
            revLines.push({
              accountCode: '1350',
              debit: 0,
              credit: recVatAmt,
              memo: `REVERSAL of input VAT on ${ref}`,
            });
          }
          pushEntry('EXPENSE_CLAIM_REVERSAL', `${clm.id}-rev-rec`, `${ref}-REV`, revTs, loc, revLines);
        }
        for (const pmt of payments) {
          const pmtAmt = roundMoney(Number(pmt.amount || 0));
          if (pmtAmt <= 0 || !matchesDate(revTs)) continue;
          const creditAcct = chart[pmt.fundingAccountCode] ? pmt.fundingAccountCode : pmt.paymentMethod === 'cash_drawer' ? '1010' : '1030';
          pushEntry('EXPENSE_CLAIM_REVERSAL', `${clm.id}-rev-pmt-${pmt.id}`, `${ref}-REV`, revTs, loc, [
            {
              accountCode: creditAcct,
              debit: pmtAmt,
              credit: 0,
              memo: `REVERSAL of reimbursement payout ${pmt.paymentReference || ref}`,
            },
            {
              accountCode: '2100',
              debit: 0,
              credit: pmtAmt,
              memo: `REVERSAL of reimbursement settlement ${ref}`,
            },
          ]);
        }
      }
    } else if (clm.claimType === 'company_funded_expense') {
      // Direct Company-Funded Expense (Paid from register cash drawer or company bank/POS)
      // Skip if linked to a GRN (already in GRN_PURCHASE)
      if (!clm.linkedGrnId) {
        const expTs = clm.paidAt || clm.approvedAt || clm.submittedAt || clm.createdAt;
        const firstPmt = Array.isArray(clm.payments) && clm.payments[0];
        const fundingAcct =
          firstPmt && chart[firstPmt.fundingAccountCode]
            ? firstPmt.fundingAccountCode
            : clm.paymentMethodUsedByClaimant === 'company_cash_drawer'
            ? '1010'
            : '1030';

        if (matchesDate(expTs)) {
          pushEntry('EXPENSE_COMPANY_DIRECT', `${clm.id}-direct`, ref, expTs, loc, [
            {
              accountCode: targetAcct,
              debit: totalAmt,
              credit: 0,
              memo: `Company-funded expense ${ref}: ${clm.businessReason || clm.description} (${clm.vendorName})`,
            },
            {
              accountCode: fundingAcct,
              debit: 0,
              credit: totalAmt,
              memo: `Direct company payment for ${ref} by ${clm.claimantName}`,
            },
          ]);
          if (clm.status !== 'reversed') {
            operatingExpensesPaidOut = roundMoney(operatingExpensesPaidOut + totalAmt);
          }
        }

        if (clm.status === 'reversed') {
          const revTs = clm.reversedAt || new Date().toISOString();
          if (matchesDate(revTs)) {
            pushEntry('EXPENSE_CLAIM_REVERSAL', `${clm.id}-rev-direct`, `${ref}-REV`, revTs, loc, [
              {
                accountCode: fundingAcct,
                debit: totalAmt,
                credit: 0,
                memo: `REVERSAL of company-funded expense ${ref}: ${clm.reversalReason || 'Controlled reversal'}`,
              },
              {
                accountCode: targetAcct,
                debit: 0,
                credit: totalAmt,
                memo: `REVERSAL of company-funded expense ${ref}`,
              },
            ]);
          }
        }
      }
    } else if (clm.claimType === 'cash_advance') {
      // Cash Advance Lifecycle:
      // 1. Disbursement creates Employee Advance Asset (Dr 1150, Cr 1010/1030) — NOT an immediate operating expense!
      const payments = Array.isArray(clm.payments) ? clm.payments : [];
      for (const pmt of payments) {
        const pmtAmt = roundMoney(Number(pmt.amount || 0));
        const pmtTs = pmt.paidAt || clm.paidAt || clm.approvedAt;
        if (pmtAmt <= 0 || !matchesDate(pmtTs)) continue;
        const creditAcct = chart[pmt.fundingAccountCode] ? pmt.fundingAccountCode : pmt.paymentMethod === 'cash_drawer' ? '1010' : '1030';
        pushEntry('CASH_ADVANCE_DISBURSEMENT', `${clm.id}-adv-disb-${pmt.id}`, pmt.paymentReference || ref, pmtTs, loc, [
          {
            accountCode: '1150',
            debit: pmtAmt,
            credit: 0,
            memo: `Operational cash advance disbursed to ${clm.claimantName} (${ref}: ${clm.businessReason})`,
          },
          {
            accountCode: creditAcct,
            debit: 0,
            credit: pmtAmt,
            memo: `Cash advance payout for ${ref} via ${pmt.paymentMethod}`,
          },
        ]);
      }

      // 2. Retirement / Reconciliation clears 1150 against substantiated Expense/Asset + unspent cash returned
      if (clm.advanceRetirement && (clm.status === 'reconciled' || clm.status === 'reversed')) {
        const ret = clm.advanceRetirement;
        const retTs = ret.retiredAt || clm.reconciledAt || new Date().toISOString();
        const expAmt = roundMoney(Number(ret.substantiatedExpenseAmount || 0));
        const retCashAmt = roundMoney(Number(ret.unspentCashReturned || 0));
        const totalCleared = roundMoney(expAmt + retCashAmt);
        const retExpAcct = chart[ret.targetExpenseAccountCode] ? ret.targetExpenseAccountCode : targetAcct === '1150' ? '6400' : targetAcct;
        const returnCashAcct = ret.returnPaymentMethod === 'bank_transfer' ? '1030' : '1010';

        if (totalCleared > 0 && matchesDate(retTs)) {
          const retLines: { accountCode: string; debit: number; credit: number; memo: string }[] = [];
          if (expAmt > 0) {
            retLines.push({
              accountCode: retExpAcct,
              debit: expAmt,
              credit: 0,
              memo: `Substantiated expense from retired cash advance ${ref} (${ret.notes || clm.businessReason})`,
            });
          }
          if (retCashAmt > 0) {
            retLines.push({
              accountCode: returnCashAcct,
              debit: retCashAmt,
              credit: 0,
              memo: `Unspent cash advance returned by ${clm.claimantName} for ${ref} (Ref: ${ret.returnReference || 'Till Return'})`,
            });
          }
          retLines.push({
            accountCode: '1150',
            debit: 0,
            credit: totalCleared,
            memo: `Employee cash advance retired & cleared for ${clm.claimantName} (${ref})`,
          });

          pushEntry('CASH_ADVANCE_RETIREMENT', `${clm.id}-adv-ret`, ref, retTs, loc, retLines);
          if (clm.status !== 'reversed' && expAmt > 0) {
            operatingExpensesPaidOut = roundMoney(operatingExpensesPaidOut + expAmt);
          }
        }
      }
    }
  }


  // 6. Customer Wallet Top-Ups (`db.walletTransactions` where type === 'credit')
  const walletTxs = Array.isArray(db?.walletTransactions) ? db.walletTransactions : Object.values(db?.walletTransactions || {});
  walletTxs.sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

  for (const wtx of walletTxs) {
    if (wtx.type !== 'credit') continue;
    const ts = wtx.timestamp || wtx.createdAt;
    const loc = wtx.branchId || 'gra';
    if (!matchesBranch(loc, true) || !matchesDate(ts)) continue;

    const amt = roundMoney(Number(wtx.amount || 0));
    if (amt <= 0) continue;

    const tenderAcct = mapTenderToAccountCode(wtx.paymentMethod || 'pos_terminal');
    const ref = wtx.reference || wtx.id || `WLT-${ts.slice(0, 10)}`;
    pushEntry('WALLET_TOPUP', wtx.id || ref, ref, ts, loc, [
      {
        accountCode: tenderAcct,
        debit: amt,
        credit: 0,
        memo: `Customer wallet top-up received (${wtx.customerName || 'Loyalty Member'}, ref: ${ref})`,
      },
      {
        accountCode: '2300',
        debit: 0,
        credit: amt,
        memo: `Deferred wallet liability credited for ${wtx.customerName || 'Loyalty Member'}`,
      },
    ]);
  }

  // 7. Corporate House Account Remittances (`db.houseAccountPayments`)
  const housePmts = Array.isArray(db?.houseAccountPayments) ? db.houseAccountPayments : Object.values(db?.houseAccountPayments || {});
  housePmts.sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

  for (const pmt of housePmts) {
    const ts = pmt.timestamp;
    const loc = pmt.branchId || 'gra';
    if (!matchesBranch(loc, true) || !matchesDate(ts)) continue;

    const amt = roundMoney(Number(pmt.amount || 0));
    if (amt <= 0) continue;

    const bankCode = mapTenderToAccountCode(pmt.paymentMethod || 'bank_transfer');
    const ref = pmt.receiptNumber || pmt.id;
    pushEntry('HOUSE_ACCOUNT_REMITTANCE', pmt.id, ref, ts, loc, [
      {
        accountCode: bankCode,
        debit: amt,
        credit: 0,
        memo: `Corporate house account remittance from ${pmt.companyName || 'Corporate Client'} (${pmt.bankReference || ref})`,
      },
      {
        accountCode: '1100',
        debit: 0,
        credit: amt,
        memo: `Accounts Receivable settlement for ${pmt.companyName || 'Corporate Client'}`,
      },
    ]);
  }

  const allLines: JournalLine[] = entries.flatMap((e) => e.lines);
  const totalDebits = roundMoney(allLines.reduce((s, l) => s + l.debit, 0));
  const totalCredits = roundMoney(allLines.reduce((s, l) => s + l.credit, 0));
  const variance = roundMoney(Math.abs(totalDebits - totalCredits));

  if (variance !== 0) {
    throw new Error(`Ledger trial balance out of balance: totalDebits=${totalDebits}, totalCredits=${totalCredits}`);
  }

  const tbMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  for (const l of allLines) {
    const curr = tbMap.get(l.accountCode) || { totalDebit: 0, totalCredit: 0 };
    curr.totalDebit = roundMoney(curr.totalDebit + l.debit);
    curr.totalCredit = roundMoney(curr.totalCredit + l.credit);
    tbMap.set(l.accountCode, curr);
  }

  const trialBalanceByAccount = Array.from(tbMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, totals]) => {
      const acct = chart[code];
      const netBalance =
        acct.normalBalance === 'DEBIT'
          ? roundMoney(totals.totalDebit - totals.totalCredit)
          : roundMoney(totals.totalCredit - totals.totalDebit);
      return {
        accountCode: code,
        accountName: acct.name,
        type: acct.type,
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        netBalance,
      };
    });

  const digestPayload = JSON.stringify({
    branchFilter,
    period,
    startDate: options.startDate || '',
    endDate: options.endDate || '',
    taxMode: configuredTaxMode,
    lines: allLines.map((l) => ({
      sourceId: l.sourceId,
      accountCode: l.accountCode,
      debit: l.debit,
      credit: l.credit,
    })),
  });
  const exportDigest = crypto.createHash('sha256').update(digestPayload).digest('hex').slice(0, 24);

  if (options.preventDuplicateExport) {
    db.accountingExports = db.accountingExports || {};
    const existingBatch = db.accountingExports[exportDigest];
    if (existingBatch && !options.allowReExport) {
      throw new Error(
        `DUPLICATE_EXPORT_BLOCKED: Journal batch with digest ${exportDigest} was already exported on ${existingBatch.exportedAt} by ${existingBatch.exportedBy}. Pass allowReExport=true to re-download.`
      );
    }
    db.accountingExports[exportDigest] = {
      digest: exportDigest,
      branchId: branchFilter,
      period,
      startDate: options.startDate || null,
      endDate: options.endDate || null,
      taxMode: configuredTaxMode,
      transactionCount: entries.length,
      totalDebits,
      totalCredits,
      exportedAt: new Date().toISOString(),
      exportedBy: options.exportedBy || 'system',
    };
  }

  return {
    branchId: branchFilter,
    branchName: resolveBranchLabel(branchFilter),
    period,
    startDate: options.startDate,
    endDate: options.endDate,
    taxMode: configuredTaxMode,
    vatRatePct: configuredTaxMode === 'exempt' ? 0 : 7.5,
    accountantTaxPolicyStatus: accountantConfirmed ? 'CONFIRMED' : 'PENDING_ACCOUNTANT_CONFIRMATION',
    generatedAt: new Date().toISOString(),
    entries,
    lines: allLines,
    trialBalanceByAccount,
    summary: {
      transactionCount: entries.length,
      lineCount: allLines.length,
      totalDebits,
      totalCredits,
      variance,
      isBalanced: variance === 0,
      ...salesTotals,
      grnInventoryAdditions,
      wastageWriteOffs,
      operatingExpensesPaidOut,
    },
    exportDigest,
  };
}
