import React, { useState, useEffect } from 'react';
import {
  Split,
  X,
  CreditCard,
  Banknote,
  Building2,
  MoveRight,
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  Users,
  Layers,
  ListChecks,
} from 'lucide-react';

interface PosBillSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCheck: any;
  onSettleSplit: (splitDetails: any) => Promise<any> | void;
  onSaveSplitConfig?: (splitConfigPayload: any) => Promise<any> | void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PosBillSplitModal: React.FC<PosBillSplitModalProps> = ({
  isOpen,
  onClose,
  activeCheck,
  onSettleSplit,
  onSaveSplitConfig,
  showToast,
}) => {
  const [splitMode, setSplitMode] = useState<'equal' | 'custom' | 'items'>('equal');
  const [splitWays, setSplitWays] = useState<number>(1);
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});
  const [itemGuestMap, setItemGuestMap] = useState<Record<string, number>>({});
  const [selectedShareIndex, setSelectedShareIndex] = useState<number | 'all'>(1);
  const [splitMethod, setSplitMethod] = useState<'cash' | 'pos_terminal' | 'bank_transfer' | 'split'>('cash');
  const [cashTenderedInput, setCashTenderedInput] = useState<string>('');
  const [posRrnInput, setPosRrnInput] = useState<string>('');
  const [transferRefInput, setTransferRefInput] = useState<string>('');
  const [splitCashAmount, setSplitCashAmount] = useState<string>('');
  const [splitPosAmount, setSplitPosAmount] = useState<string>('');
  const [splitTransferAmount, setSplitTransferAmount] = useState<string>('0');
  const [confirmZeroShareWaiver, setConfirmZeroShareWaiver] = useState<boolean>(false);
  const [zeroWaiverReason, setZeroWaiverReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!activeCheck) return;
    if (activeCheck.splitConfig && Array.isArray(activeCheck.splitConfig.shares) && activeCheck.splitConfig.shares.length > 0) {
      setSplitMode(activeCheck.splitConfig.mode || 'equal');
      setSplitWays(activeCheck.splitConfig.guestCount || activeCheck.splitConfig.shares.length || 1);
      const firstUnpaid = activeCheck.splitConfig.shares.find((s: any) => s.status !== 'paid' && s.status !== 'waived_zero' && s.remainingAmount > 0);
      if (firstUnpaid) {
        setSelectedShareIndex(firstUnpaid.shareIndex);
      } else {
        setSelectedShareIndex('all');
      }
    } else {
      setSplitMode('equal');
      setSplitWays(1);
      setSelectedShareIndex(1);
      setConfirmZeroShareWaiver(false);
      setZeroWaiverReason('');
    }
  }, [activeCheck?.id, activeCheck?.splitConfig?.updatedAt, activeCheck?.amountPaid, isOpen]);

  if (!isOpen || !activeCheck) return null;

  const total = Number(activeCheck.total || 0);
  const alreadyPaid = Number(activeCheck.amountPaid || 0);
  const remainingCheckBalance = Math.max(0, total - alreadyPaid);

  const existingShares: any[] = Array.isArray(activeCheck.splitConfig?.shares)
    ? activeCheck.splitConfig.shares
    : [];
  const lockedPaidShares = existingShares.filter((s) => s.paidAmount > 0 || s.status === 'paid');
  const paidSharesSum = lockedPaidShares.reduce((s, sh) => s + Number(sh.paidAmount || 0), 0);
  const unpaidPool = Math.max(0, total - paidSharesSum);
  const unpaidCount = Math.max(1, splitWays - lockedPaidShares.length);

  // Compute deterministic preview shares
  const computedShares: Array<{
    shareId: string;
    shareIndex: number;
    label: string;
    allocatedAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: 'unpaid' | 'partially_paid' | 'paid' | 'waived_zero';
  }> = (() => {
    if (
      existingShares.length === splitWays &&
      activeCheck.splitConfig?.mode === splitMode &&
      splitMode === 'equal'
    ) {
      return existingShares;
    }

    const result: any[] = [...lockedPaidShares];

    if (splitMode === 'custom') {
      for (let i = 0; i < unpaidCount; i++) {
        const shareIndex = result.length + 1;
        const defaultAmt =
          i === 0
            ? Math.floor(unpaidPool / unpaidCount) + (unpaidPool - Math.floor(unpaidPool / unpaidCount) * unpaidCount)
            : Math.floor(unpaidPool / unpaidCount);
        const val =
          customAmounts[shareIndex] !== undefined
            ? Math.max(0, Math.round(Number(customAmounts[shareIndex]) || 0))
            : defaultAmt;
        result.push({
          shareId: `shr-${shareIndex}`,
          shareIndex,
          label: splitWays === 1 ? 'Guest 1 (Full Bill)' : `Guest ${shareIndex}`,
          allocatedAmount: val,
          paidAmount: 0,
          remainingAmount: val,
          status: val === 0 && confirmZeroShareWaiver ? 'waived_zero' : 'unpaid',
        });
      }
      return result;
    }

    if (splitMode === 'items') {
      const items = Array.isArray(activeCheck.items) ? activeCheck.items : [];
      const guestSums: Record<number, number> = {};
      for (let i = 0; i < unpaidCount; i++) {
        guestSums[lockedPaidShares.length + i + 1] = 0;
      }
      items.forEach((it: any, idx: number) => {
        const assignedGuest =
          itemGuestMap[it.id] || ((idx % unpaidCount) + lockedPaidShares.length + 1);
        guestSums[assignedGuest] = (guestSums[assignedGuest] || 0) + Number(it.totalPrice || 0);
      });
      const rawTotal = Object.values(guestSums).reduce((a, b) => a + b, 0) || 1;
      let running = 0;
      for (let i = 0; i < unpaidCount; i++) {
        const shareIndex = result.length + 1;
        const gSum = guestSums[shareIndex] || 0;
        const alloc =
          i === unpaidCount - 1
            ? Math.max(0, unpaidPool - running)
            : Math.round((gSum / rawTotal) * unpaidPool);
        running += alloc;
        result.push({
          shareId: `shr-${shareIndex}`,
          shareIndex,
          label: splitWays === 1 ? 'Guest 1 (Full Bill)' : `Guest ${shareIndex}`,
          allocatedAmount: alloc,
          paidAmount: 0,
          remainingAmount: alloc,
          status: alloc === 0 && confirmZeroShareWaiver ? 'waived_zero' : 'unpaid',
        });
      }
      return result;
    }

    // Default: Deterministic Equal Split
    const base = Math.floor(unpaidPool / unpaidCount);
    const rem = unpaidPool - base * unpaidCount;
    for (let i = 0; i < unpaidCount; i++) {
      const shareIndex = result.length + 1;
      const alloc = i === 0 ? base + rem : base;
      result.push({
        shareId: `shr-${shareIndex}`,
        shareIndex,
        label: splitWays === 1 ? 'Guest 1 (Full Bill)' : `Guest ${shareIndex}`,
        allocatedAmount: alloc,
        paidAmount: 0,
        remainingAmount: alloc,
        status: 'unpaid',
      });
    }

    const uniqueResult: any[] = [];
    const seenIds = new Set<string>();
    result.forEach((sh) => {
      if (!seenIds.has(sh.shareId)) {
        uniqueResult.push(sh);
        seenIds.add(sh.shareId);
      } else {
        const newShareId = `${sh.shareId}-dup-${Math.random().toString(36).slice(2, 6)}`;
        uniqueResult.push({ ...sh, shareId: newShareId });
        seenIds.add(newShareId);
      }
    });

    return uniqueResult;
  })();

  const totalAllocatedAcrossShares = computedShares.reduce((s, sh) => s + sh.allocatedAmount, 0);
  const allocationVariance = total - totalAllocatedAcrossShares;
  const zeroUnpaidShares = computedShares.filter((sh) => sh.paidAmount === 0 && sh.allocatedAmount <= 0);
  const hasUnconfirmedZeroShare = zeroUnpaidShares.length > 0 && !confirmZeroShareWaiver;

  const activeTargetShare =
    selectedShareIndex === 'all'
      ? null
      : computedShares.find((s) => s.shareIndex === selectedShareIndex) || null;

  const payableNowAmount = activeTargetShare
    ? activeTargetShare.remainingAmount
    : remainingCheckBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (allocationVariance !== 0) {
      showToast(
        `Share allocations (₦${totalAllocatedAcrossShares.toLocaleString()}) must equal check total (₦${total.toLocaleString()}). Difference: ₦${allocationVariance.toLocaleString()}`,
        'error'
      );
      return;
    }

    if (hasUnconfirmedZeroShare) {
      showToast(
        `Zero-value guest share detected (${zeroUnpaidShares.map((z) => z.label).join(', ')} has ₦0). Allocate a positive amount, reduce the guest count, or confirm a Zero-Contribution Waiver below.`,
        'error'
      );
      return;
    }

    if (payableNowAmount <= 0) {
      showToast('Selected share or check has ₦0 payable balance due. Select a share with a positive balance due.', 'error');
      return;
    }

    let tenders: any[] = [];
    if (splitMethod === 'split') {
      const cashNum = Math.max(0, Math.round(Number(splitCashAmount) || 0));
      const posNum = Math.max(0, Math.round(Number(splitPosAmount) || 0));
      const trfNum = Math.max(0, Math.round(Number(splitTransferAmount) || 0));
      const sumTendered = cashNum + posNum + trfNum;

      if (sumTendered < payableNowAmount) {
        showToast(
          `Mixed tender total (₦${sumTendered.toLocaleString()}) is less than amount due now (₦${payableNowAmount.toLocaleString()})`,
          'error'
        );
        return;
      }

      const appliedCash = Math.min(cashNum, Math.max(0, payableNowAmount - posNum - trfNum));
      if (appliedCash > 0) {
        tenders.push({
          method: 'cash',
          amount: appliedCash,
          cashTendered: cashNum,
          reference: 'CASH-TENDER',
        });
      }
      if (posNum > 0) {
        tenders.push({
          method: 'pos_terminal',
          amount: posNum,
          reference: posRrnInput.trim() || `POS-${Date.now().toString().slice(-6)}`,
        });
      }
      if (trfNum > 0) {
        tenders.push({
          method: 'bank_transfer',
          amount: trfNum,
          reference: transferRefInput.trim() || `TRF-${Date.now().toString().slice(-6)}`,
        });
      }
    } else {
      const rawCash = Number(cashTenderedInput) || payableNowAmount;
      if (splitMethod === 'cash' && rawCash < payableNowAmount) {
        showToast(
          `Cash tendered (₦${rawCash.toLocaleString()}) is less than share amount due (₦${payableNowAmount.toLocaleString()})`,
          'error'
        );
        return;
      }
      tenders = [
        {
          method: splitMethod,
          amount: payableNowAmount,
          cashTendered: splitMethod === 'cash' ? rawCash : undefined,
          reference:
            splitMethod === 'pos_terminal'
              ? posRrnInput.trim() || `POS-${Date.now().toString().slice(-6)}`
              : splitMethod === 'bank_transfer'
              ? transferRefInput.trim() || `TRF-${Date.now().toString().slice(-6)}`
              : 'CASH-TENDER',
        },
      ];
    }

    setIsSubmitting(true);
    try {
      await onSettleSplit({
        splitConfigPayload: {
          mode: splitMode,
          guestCount: splitWays,
          confirmZeroShareWaiver,
          zeroWaiverReason: zeroWaiverReason.trim() || undefined,
          customShares:
            splitMode === 'custom'
              ? computedShares
                  .filter((sh) => sh.paidAmount === 0)
                  .map((sh) => ({ shareId: sh.shareId, label: sh.label, amount: sh.allocatedAmount }))
              : undefined,
        },
        shareId: activeTargetShare ? activeTargetShare.shareId : undefined,
        amountToPay: payableNowAmount,
        paymentMethod: splitMethod,
        tenders,
        idempotencyKey: `idem-${activeCheck.id}-${activeTargetShare?.shareId || 'all'}-${activeCheck.payments?.length || 0}`,
        paymentDetails: {
          splitWays,
          shareId: activeTargetShare?.shareId,
          shareLabel: activeTargetShare?.label,
          posRrn: posRrnInput.trim() || undefined,
          transferRef: transferRefInput.trim() || undefined,
          splitCashAmount: splitMethod === 'split' ? Number(splitCashAmount) || 0 : splitMethod === 'cash' ? payableNowAmount : 0,
          splitPosAmount: splitMethod === 'split' ? Number(splitPosAmount) || 0 : splitMethod === 'pos_terminal' ? payableNowAmount : 0,
          splitTransferAmount: splitMethod === 'split' ? Number(splitTransferAmount) || 0 : splitMethod === 'bank_transfer' ? payableNowAmount : 0,
          note: activeTargetShare
            ? `${activeTargetShare.label} share (${splitWays}-way split): ₦${payableNowAmount.toLocaleString()}`
            : `Settled remaining balance across ${splitWays}-way split: ₦${payableNowAmount.toLocaleString()}`,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSplitOnly = async () => {
    if (!onSaveSplitConfig) return;
    if (allocationVariance !== 0) {
      showToast(
        `Share allocations must equal ₦${total.toLocaleString()} before saving.`,
        'error'
      );
      return;
    }
    if (hasUnconfirmedZeroShare) {
      showToast(
        `Zero-value guest share detected (${zeroUnpaidShares.map((z) => z.label).join(', ')} has ₦0). Allocate a positive amount, reduce the guest count, or confirm a Zero-Contribution Waiver.`,
        'error'
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await onSaveSplitConfig({
        mode: splitMode,
        guestCount: splitWays,
        confirmZeroShareWaiver,
        zeroWaiverReason: zeroWaiverReason.trim() || undefined,
        customShares:
          splitMode === 'custom'
            ? computedShares
              .filter((sh) => sh.paidAmount === 0)
              .map((sh) => ({ shareId: sh.shareId, label: sh.label, amount: sh.allocatedAmount }))
            : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#800D15] rounded-xl text-[#FFC700]">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-[#241311]">
                  Split Check #{activeCheck.checkNumber}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    alreadyPaid > 0
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-[#FAF7F2] text-[#800D15] border border-[#E5DEC9]'
                  }`}
                >
                  {alreadyPaid > 0 ? 'Partially Paid' : 'Unpaid'}
                </span>
              </div>
              <p className="text-xs text-[#7A6A65] font-mono tabular-nums">
                {activeCheck.tableNumber || 'Direct Check'} • Total: ₦{total.toLocaleString()} • Paid: ₦{alreadyPaid.toLocaleString()} • Due: ₦{remainingCheckBalance.toLocaleString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7A6A65] hover:text-[#241311] hover:bg-[#FAF7F2]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Split Mode Selector */}
          <div className="grid grid-cols-3 gap-1.5 bg-[#FAF7F2] p-1 rounded-xl border border-[#E5DEC9]">
            <button
              type="button"
              onClick={() => setSplitMode('equal')}
              className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                splitMode === 'equal'
                  ? 'bg-[#800D15] text-white shadow-2xs'
                  : 'text-[#7A6A65] hover:text-[#241311]'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Equal Shares
            </button>
            <button
              type="button"
              onClick={() => setSplitMode('custom')}
              className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                splitMode === 'custom'
                  ? 'bg-[#800D15] text-white shadow-2xs'
                  : 'text-[#7A6A65] hover:text-[#241311]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Custom Amounts
            </button>
            <button
              type="button"
              onClick={() => setSplitMode('items')}
              className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                splitMode === 'items'
                  ? 'bg-[#800D15] text-white shadow-2xs'
                  : 'text-[#7A6A65] hover:text-[#241311]'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" /> By Item
            </button>
          </div>

          {/* Number of Ways Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[#4D080F] font-bold">Number of Paying Guests</label>
              {lockedPaidShares.length > 0 && (
                <span className="text-[10px] font-semibold text-emerald-700">
                  {lockedPaidShares.length} share(s) already settled
                </span>
              )}
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const disabled = num <= lockedPaidShares.length;
                return (
                  <button
                    type="button"
                    key={num}
                    disabled={disabled}
                    onClick={() => {
                      setSplitWays(num);
                      setConfirmZeroShareWaiver(false);
                      const firstUnpaidIdx = lockedPaidShares.length + 1;
                      setSelectedShareIndex(firstUnpaidIdx <= num ? firstUnpaidIdx : 'all');
                    }}
                    className={`py-2 rounded-xl font-mono font-bold text-[11px] border transition-all ${
                      splitWays === num
                        ? 'bg-[#800D15] text-white border-[#800D15] shadow-xs'
                        : disabled
                        ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                        : 'bg-[#FAF7F2] text-[#241311] border-[#E5DEC9] hover:border-[#800D15]'
                    }`}
                  >
                    {num === 1 ? '1 Guest' : `${num} Ways`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Item-by-Item Assignment Helper when splitMode === 'items' */}
          {splitMode === 'items' && Array.isArray(activeCheck.items) && (
            <div className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-2 max-h-40 overflow-y-auto">
              <span className="text-[10px] uppercase font-bold text-[#4D080F] block">
                Assign Check Items to Guests
              </span>
              {activeCheck.items.map((it: any, idx: number) => {
                const currentGuest =
                  itemGuestMap[it.id] || ((idx % unpaidCount) + lockedPaidShares.length + 1);
                return (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#E5DEC9]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-[#241311] block truncate">
                        {it.quantity}x {it.name}
                      </span>
                      <span className="font-mono text-[10px] text-[#800D15]">
                        ₦{Number(it.totalPrice || 0).toLocaleString()}
                      </span>
                    </div>
                    <select
                      value={currentGuest}
                      onChange={(e) =>
                        setItemGuestMap((prev) => ({
                          ...prev,
                          [it.id]: Number(e.target.value),
                        }))
                      }
                      className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2 py-1 text-[11px] font-bold text-[#241311]"
                    >
                      {computedShares
                        .filter((sh) => sh.paidAmount === 0)
                        .map((sh) => (
                          <option key={sh.shareIndex} value={sh.shareIndex}>
                            {sh.label}
                          </option>
                        ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {/* Interactive Guest Shares Breakdown & Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[#4D080F] font-bold">
                Select Share to Settle Now (or Settle All Remaining)
              </label>
              <button
                type="button"
                onClick={() => setSelectedShareIndex('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  selectedShareIndex === 'all'
                    ? 'bg-[#800D15] text-white border-[#800D15]'
                    : 'bg-[#FAF7F2] text-[#241311] border-[#E5DEC9] hover:border-[#800D15]'
                }`}
              >
                All Unpaid (₦{remainingCheckBalance.toLocaleString()})
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-0.5">
              {computedShares.map((sh) => {
                const isPaid = sh.status === 'paid' && sh.paidAmount > 0;
                const isWaivedZero = sh.status === 'waived_zero';
                const isZeroUnconfirmed = sh.paidAmount === 0 && sh.allocatedAmount <= 0 && !isWaivedZero;
                const isSelected = selectedShareIndex === sh.shareIndex;
                return (
                  <div
                    key={sh.shareId}
                    onClick={() => !isPaid && !isWaivedZero && sh.remainingAmount > 0 && setSelectedShareIndex(sh.shareIndex)}
                    className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                      isPaid
                        ? 'bg-emerald-50/70 border-emerald-300 opacity-85 cursor-default'
                        : isWaivedZero
                        ? 'bg-stone-100 border-stone-300 opacity-85 cursor-default'
                        : isZeroUnconfirmed
                        ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-300'
                        : isSelected
                        ? 'bg-[#FFF8E7] border-[#800D15] ring-2 ring-[#800D15]/20 cursor-pointer'
                        : 'bg-[#FAF7F2] border-[#E5DEC9] hover:border-[#800D15]/50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#241311]">{sh.label}</span>
                      {isPaid ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> PAID
                        </span>
                      ) : isWaivedZero ? (
                        <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 text-[9px] font-black uppercase flex items-center gap-1">
                          WAIVED (₦0)
                        </span>
                      ) : isZeroUnconfirmed ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9px] font-black uppercase flex items-center gap-1">
                          ₦0 UNASSIGNED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold uppercase flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> DUE
                        </span>
                      )}
                    </div>

                    {splitMode === 'custom' && !isPaid ? (
                      <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs font-mono font-bold text-[#7A6A65]">₦</span>
                        <input
                          type="number"
                          min={0}
                          value={
                            customAmounts[sh.shareIndex] !== undefined
                              ? customAmounts[sh.shareIndex]
                              : String(sh.allocatedAmount)
                          }
                          onChange={(e) =>
                            setCustomAmounts((prev) => ({
                              ...prev,
                              [sh.shareIndex]: e.target.value,
                            }))
                          }
                          className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2 py-1 font-mono font-bold text-xs text-[#241311]"
                        />
                      </div>
                    ) : (
                      <div className="font-mono font-black text-base text-[#800D15] tabular-nums">
                        ₦{sh.remainingAmount > 0 ? sh.remainingAmount.toLocaleString() : sh.allocatedAmount.toLocaleString()}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-[#7A6A65]">
                      <span>Allocated: ₦{sh.allocatedAmount.toLocaleString()}</span>
                      {sh.paidAmount > 0 && (
                        <span className="text-emerald-700 font-bold">Paid: ₦{sh.paidAmount.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {allocationVariance !== 0 && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 font-bold flex items-center justify-between">
                <span>Unallocated Remainder:</span>
                <span className="font-mono">₦{allocationVariance.toLocaleString()}</span>
              </div>
            )}

            {zeroUnpaidShares.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-[11px] text-amber-950">
                <p className="font-bold">
                  ⚠️ {zeroUnpaidShares.map((z) => z.label).join(', ')} has ₦0 allocated. Zero-value shares are never marked paid automatically.
                </p>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={confirmZeroShareWaiver}
                    onChange={(e) => setConfirmZeroShareWaiver(e.target.checked)}
                    className="rounded accent-[#800D15]"
                  />
                  <span>Explicitly confirm Zero-Contribution Reallocation / Waiver for {zeroUnpaidShares.map((z) => z.label).join(', ')}</span>
                </label>
                {confirmZeroShareWaiver && (
                  <input
                    type="text"
                    value={zeroWaiverReason}
                    onChange={(e) => setZeroWaiverReason(e.target.value)}
                    placeholder="Reason (e.g., Covered in full by Guest 1)"
                    className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-900"
                  />
                )}
              </div>
            )}
          </div>

          {/* Payment Settlement Method for Selected Share / Remaining Check */}
          <div className="space-y-1.5 pt-1 border-t border-[#E5DEC9]">
            <label className="text-[#4D080F] font-bold">
              Payment Method for{' '}
              {activeTargetShare
                ? `${activeTargetShare.label} (₦${payableNowAmount.toLocaleString()})`
                : `All Unpaid Shares (₦${payableNowAmount.toLocaleString()})`}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setSplitMethod('cash')}
                className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  splitMethod === 'cash'
                    ? 'bg-[#800D15] border-[#800D15] text-white'
                    : 'bg-[#FAF7F2] border-[#E5DEC9] text-[#241311]'
                }`}
              >
                <Banknote className="w-4 h-4 text-[#FFC700]" />
                <span className="font-bold text-[10px]">Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setSplitMethod('pos_terminal')}
                className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  splitMethod === 'pos_terminal'
                    ? 'bg-[#800D15] border-[#800D15] text-white'
                    : 'bg-[#FAF7F2] border-[#E5DEC9] text-[#241311]'
                }`}
              >
                <CreditCard className="w-4 h-4 text-[#FFC700]" />
                <span className="font-bold text-[10px]">POS Card</span>
              </button>

              <button
                type="button"
                onClick={() => setSplitMethod('bank_transfer')}
                className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  splitMethod === 'bank_transfer'
                    ? 'bg-[#800D15] border-[#800D15] text-white'
                    : 'bg-[#FAF7F2] border-[#E5DEC9] text-[#241311]'
                }`}
              >
                <Building2 className="w-4 h-4 text-[#FFC700]" />
                <span className="font-bold text-[10px]">Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSplitMethod('split');
                  const half = Math.floor(payableNowAmount / 2);
                  setSplitCashAmount(String(half));
                  setSplitPosAmount(String(payableNowAmount - half));
                  setSplitTransferAmount('0');
                }}
                className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  splitMethod === 'split'
                    ? 'bg-[#800D15] border-[#800D15] text-white'
                    : 'bg-[#FAF7F2] border-[#E5DEC9] text-[#241311]'
                }`}
              >
                <Split className="w-4 h-4 text-[#FFC700]" />
                <span className="font-bold text-[10px]">Mixed Tender</span>
              </button>
            </div>
          </div>

          {/* Method-Specific Inputs */}
          {splitMethod === 'cash' && (
            <div className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[#241311]">Cash Tendered (₦)</label>
                {Number(cashTenderedInput) > payableNowAmount && (
                  <span className="text-[11px] font-mono font-bold text-emerald-700">
                    Change Due: ₦{(Number(cashTenderedInput) - payableNowAmount).toLocaleString()}
                  </span>
                )}
              </div>
              <input
                type="number"
                placeholder={String(payableNowAmount)}
                value={cashTenderedInput}
                onChange={(e) => setCashTenderedInput(e.target.value)}
                className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#241311]"
              />
            </div>
          )}

          {splitMethod === 'pos_terminal' && (
            <div className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-1.5">
              <label className="text-[11px] font-bold text-[#241311]">POS Terminal RRN / STAN Reference</label>
              <input
                type="text"
                placeholder="e.g. RRN-00482910"
                value={posRrnInput}
                onChange={(e) => setPosRrnInput(e.target.value)}
                className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#241311]"
              />
            </div>
          )}

          {splitMethod === 'bank_transfer' && (
            <div className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-1.5">
              <label className="text-[11px] font-bold text-[#241311]">Bank Transfer Session ID / Reference</label>
              <input
                type="text"
                placeholder="e.g. TRF-GTB-928374"
                value={transferRefInput}
                onChange={(e) => setTransferRefInput(e.target.value)}
                className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#241311]"
              />
            </div>
          )}

          {splitMethod === 'split' && (
            <div className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-2.5">
              <span className="text-[10px] uppercase font-bold text-[#4D080F] block">
                Mixed Tender Breakdown (Target: ₦{payableNowAmount.toLocaleString()})
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-[#7A6A65] font-bold">Cash (₦)</label>
                  <input
                    type="number"
                    value={splitCashAmount}
                    onChange={(e) => setSplitCashAmount(e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2 py-1.5 text-xs font-mono text-[#241311]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#7A6A65] font-bold">POS Card (₦)</label>
                  <input
                    type="number"
                    value={splitPosAmount}
                    onChange={(e) => setSplitPosAmount(e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2 py-1.5 text-xs font-mono text-[#241311]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#7A6A65] font-bold">Transfer (₦)</label>
                  <input
                    type="number"
                    value={splitTransferAmount}
                    onChange={(e) => setSplitTransferAmount(e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2 py-1.5 text-xs font-mono text-[#241311]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="POS RRN (if POS > 0)"
                  value={posRrnInput}
                  onChange={(e) => setPosRrnInput(e.target.value)}
                  className="bg-white border border-[#E5DEC9] rounded-lg px-2 py-1 text-[11px] font-mono text-[#241311]"
                />
                <input
                  type="text"
                  placeholder="Transfer Ref (if Trf > 0)"
                  value={transferRefInput}
                  onChange={(e) => setTransferRefInput(e.target.value)}
                  className="bg-white border border-[#E5DEC9] rounded-lg px-2 py-1 text-[11px] font-mono text-[#241311]"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 bg-[#FAF7F2] hover:bg-[#E5DEC9] text-[#241311] border border-[#E5DEC9] font-bold text-xs rounded-xl"
            >
              Close
            </button>
            {onSaveSplitConfig && (
              <button
                type="button"
                disabled={isSubmitting || allocationVariance !== 0 || hasUnconfirmedZeroShare}
                onClick={handleSaveSplitOnly}
                className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-[#800D15] border border-amber-300 font-bold text-xs rounded-xl transition-all"
              >
                Save Split Shares
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || payableNowAmount <= 0 || allocationVariance !== 0 || hasUnconfirmedZeroShare}
              className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all"
            >
              {isSubmitting
                ? 'Processing...'
                : activeTargetShare
                ? `Pay ${activeTargetShare.label} Share (₦${payableNowAmount.toLocaleString()})`
                : `Settle Remaining Bill (₦${payableNowAmount.toLocaleString()})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PosTableTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCheck: any;
  tables: any[];
  onTransfer: (newTableId: string, newTableNumber: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PosTableTransferModal: React.FC<PosTableTransferModalProps> = ({
  isOpen,
  onClose,
  activeCheck,
  tables,
  onTransfer,
  showToast,
}) => {
  const [selectedTableId, setSelectedTableId] = useState<string>('');

  if (!isOpen || !activeCheck) return null;

  const currentTableId = activeCheck.tableId;
  const availableTables = tables.filter((t) => t.id !== currentTableId && t.status === 'available');

  const handleConfirm = () => {
    if (!selectedTableId) {
      showToast('Please select a destination table', 'error');
      return;
    }
    const target = tables.find((t) => t.id === selectedTableId);
    onTransfer(selectedTableId, target?.tableNumber || selectedTableId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#800D15] rounded-xl text-[#FFC700]">
              <MoveRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#241311]">Transfer Table</h3>
              <p className="text-xs text-[#7A6A65]">
                Move Check #{activeCheck.checkNumber} ({activeCheck.tableNumber || 'Current Table'})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#7A6A65] hover:text-[#241311]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <p className="text-[#7A6A65]">
            Select an available table to transfer this guest check. The current table will be automatically marked available.
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
            {availableTables.map((t) => {
              const isSelected = selectedTableId === t.id;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setSelectedTableId(t.id)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    isSelected
                      ? 'bg-[#800D15] border-[#800D15] text-white shadow-md'
                      : 'bg-[#FAF7F2] border-[#E5DEC9] text-[#241311] hover:border-[#800D15]'
                  }`}
                >
                  <UtensilsCrossed className={`w-4 h-4 ${isSelected ? 'text-[#FFC700]' : 'text-[#7A6A65]'}`} />
                  <span className="font-bold text-xs">Table {t.tableNumber}</span>
                  <span className="text-[10px] opacity-75">{t.capacity} Seats</span>
                </button>
              );
            })}
          </div>

          {availableTables.length === 0 && (
            <div className="p-4 bg-[#FAF7F2] rounded-xl text-center text-[#7A6A65]">
              No other tables are currently available for transfer.
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#FAF7F2] hover:bg-[#E5DEC9] text-[#241311] border border-[#E5DEC9] font-bold text-xs rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedTableId}
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-[#800D15] hover:bg-[#4D080F] disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all"
          >
            Confirm Transfer
          </button>
        </div>
      </div>
    </div>
  );
};
