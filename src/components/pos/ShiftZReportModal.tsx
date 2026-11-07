import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BranchId, AccountingSummary } from '../../types';
import {
  X,
  Printer,
  DollarSign,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Building,
  Calendar,
  CreditCard,
  Banknote,
  FileCheck,
  Receipt,
  User,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface ShiftZReportModalProps {
  onClose: () => void;
  branchId: BranchId;
}

export const ShiftZReportModal: React.FC<ShiftZReportModalProps> = ({
  onClose,
  branchId,
}) => {
  const {
    branches,
    orders,
    currentStaff,
    formatNaira,
    saveShiftReconciliation,
    accountingReconciliations,
  } = useApp();

  const currentBranch = branches.find((b) => b.id === branchId) || branches[0];

  // Active server shift state
  const [activeShiftData, setActiveShiftData] = useState<any | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState<boolean>(true);

  // Form State
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [cashDrops, setCashDrops] = useState<number>(0);
  const [pettyCashPaidOut, setPettyCashPaidOut] = useState<number>(0);
  const [payoutReason, setPayoutReason] = useState<string>('');
  const [countedCash, setCountedCash] = useState<string>('');
  const [countedPosReceipts, setCountedPosReceipts] = useState<string>('');
  const [managerPin, setManagerPin] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submissionData, setSubmissionData] = useState<any | null>(null);

  // Fetch verified active shift from server to bind real opening float and shift start time
  useEffect(() => {
    let isMounted = true;
    const fetchCurrentShift = async () => {
      try {
        setIsLoadingShift(true);
        const token = localStorage.getItem('choplife_staff_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/pos/shifts/current?branchId=${branchId}`, {
          headers,
          credentials: 'include',
        });
        if (res.ok) {
          const shift = await res.json();
          if (isMounted && shift) {
            setActiveShiftData(shift);
            setOpeningFloat(Number(shift.openingFloat) || 0);
            setCashDrops(Number(shift.cashDropsTotal) || 0);
            setPettyCashPaidOut(Number(shift.paidOutsTotal) || 0);
          }
        }
      } catch (err) {
        console.warn('Failed to load active shift for Z-report:', err);
      } finally {
        if (isMounted) setIsLoadingShift(false);
      }
    };
    fetchCurrentShift();
    return () => {
      isMounted = false;
    };
  }, [branchId]);

  // Shift orders filtered by branch and bounded by active shift start time
  const shiftOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.branchId !== branchId || o.paymentStatus !== 'paid') return false;
      if (activeShiftData?.openedAt) {
        return new Date(o.createdAt).getTime() >= new Date(activeShiftData.openedAt).getTime();
      }
      return true;
    });
  }, [orders, branchId, activeShiftData?.openedAt]);

  // Aggregate payment totals
  const cashSales = shiftOrders
    .filter((o) => o.paymentMethod === 'cash' || o.paymentMethod === 'cash_on_delivery')
    .reduce((sum, o) => sum + o.total, 0);

  const posCardSales = shiftOrders
    .filter((o) => o.paymentMethod === 'pos_terminal' || o.paymentMethod === 'card')
    .reduce((sum, o) => sum + o.total, 0);

  const transferSales = shiftOrders
    .filter((o) => o.paymentMethod === 'bank_transfer')
    .reduce((sum, o) => sum + o.total, 0);

  const grossSales = cashSales + posCardSales + transferSales;

  // Expected in drawer math:
  const expectedCashInDrawer = openingFloat + cashSales - cashDrops - pettyCashPaidOut;
  const actualCash = countedCash ? Number(countedCash) : 0;
  const cashVariance = countedCash ? actualCash - expectedCashInDrawer : 0;

  const actualPos = countedPosReceipts ? Number(countedPosReceipts) : posCardSales;
  const posVariance = actualPos - posCardSales;

  const handlePrintZReport = () => {
    window.print();
  };

  const handleSubmitReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();

    const reconciliationPayload: AccountingSummary = {
      date: new Date().toISOString().split('T')[0],
      branchId,
      totalOrders: shiftOrders.length,
      grossSales,
      cashSales,
      posSales: posCardSales,
      transferSales,
      onlineSales: shiftOrders.filter((o) => o.orderChannel === 'website').reduce((s, o) => s + o.total, 0),
      discountsGiven: shiftOrders.reduce((s, o) => s + (o.discount || 0), 0),
      deliveryFeesCollected: shiftOrders.reduce((s, o) => s + (o.deliveryFee || 0), 0),
      packagingCollected: shiftOrders.reduce((s, o) => s + (o.packagingFee || 0), 0),
      declaredCashInTill: actualCash,
      cashVariance: cashVariance,
      reconciledBy: currentStaff?.name || 'Duty Shift Cashier',
      reconciledAt: new Date().toISOString(),
    };

    saveShiftReconciliation(reconciliationPayload);

    // If an active shift exists on server, formally close it
    if (activeShiftData?.id) {
      try {
        const token = localStorage.getItem('choplife_staff_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch(`/api/pos/shifts/${activeShiftData.id}/close`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            countedCashInTill: actualCash,
            notes: settlementNotes,
          }),
        });
      } catch (err) {
        console.warn('Server shift close fallback:', err);
      }
    }

    // Also persist to server endpoint
    try {
      await fetch('/api/reconciliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reconciliationPayload),
      });
    } catch (err) {
      console.warn('Server reconciliation sync fallback');
    }

    setSubmissionData(reconciliationPayload);
    setIsSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border-2 border-[#FFC700] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#4D080F] text-[#FAF7F2] p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center font-titan text-lg">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-titan uppercase tracking-wider text-[#FFC700] block">
                END OF SHIFT & CASH DRAWER AUDIT
              </span>
              <h3 className="font-titan text-lg sm:text-xl text-white">
                Official Z-Report / Daily Settlement
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {!isSubmitted ? (
            <form onSubmit={handleSubmitReconciliation} className="space-y-5">
              {/* Branch & Session Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#E5DEC9] text-xs font-montserrat">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Branch Location</span>
                  <strong className="text-[#4D080F] font-titan text-sm">{currentBranch.name}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Staff In Charge</span>
                  <strong className="text-[#241311] font-bold">{currentStaff?.name || 'Head Cashier'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Paid Tickets</span>
                  <strong className="text-[#241311] font-titan">{shiftOrders.length} Orders</strong>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Date / Shift</span>
                  <strong className="text-[#241311] font-bold">
                    {activeShiftData?.shiftNumber ? activeShiftData.shiftNumber : new Date().toLocaleDateString()}
                  </strong>
                </div>
              </div>

              {/* System Aggregated Sales Summary */}
              <div>
                <h4 className="font-titan text-xs text-[#4D080F] uppercase mb-2 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-700" />
                  System Calculated Sales Summary
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DEC9]">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Cash Sales</span>
                    <strong className="text-sm font-titan text-emerald-700">{formatNaira(cashSales)}</strong>
                  </div>

                  <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DEC9]">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">POS Card Terminal</span>
                    <strong className="text-sm font-titan text-blue-700">{formatNaira(posCardSales)}</strong>
                  </div>

                  <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DEC9]">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Bank Transfer</span>
                    <strong className="text-sm font-titan text-purple-700">{formatNaira(transferSales)}</strong>
                  </div>

                  <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DEC9]">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Gross Shift Revenue</span>
                    <strong className="text-sm font-titan text-[#4D080F]">{formatNaira(grossSales)}</strong>
                  </div>
                </div>
              </div>

              {/* Float, Payouts & Physical Cash Drawer Counting */}
              <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80 space-y-4">
                <h4 className="font-titan text-xs text-[#4D080F] uppercase flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-amber-700" />
                  Cash Drawer Float & Physical Count Entry
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                      Opening Cash Float (₦)
                    </label>
                    <input
                      type="number"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(Number(e.target.value))}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-titan text-[#4D080F]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                      Cash Drop to Safe (₦)
                    </label>
                    <input
                      type="number"
                      value={cashDrops}
                      onChange={(e) => setCashDrops(Number(e.target.value))}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-titan text-[#4D080F]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                      Petty Cash Payout (₦)
                    </label>
                    <input
                      type="number"
                      value={pettyCashPaidOut}
                      onChange={(e) => setPettyCashPaidOut(Number(e.target.value))}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-titan text-red-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200">
                  <div>
                    <label className="text-xs font-montserrat font-bold text-gray-800 block mb-1">
                      Expected Cash in Drawer:
                    </label>
                    <div className="p-2.5 bg-white rounded-xl border border-amber-300 font-titan text-base text-[#4D080F]">
                      {formatNaira(expectedCashInDrawer)}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-montserrat font-bold text-gray-800 block mb-1">
                      Physical Cash Counted (₦) *
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="Enter counted physical cash..."
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      className="w-full bg-white border-2 border-amber-500 rounded-xl px-3 py-2 text-base font-titan text-[#4D080F] focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                {/* Variance Display */}
                {countedCash !== '' && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-montserrat flex items-center justify-between ${
                      cashVariance === 0
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : cashVariance < 0
                        ? 'bg-red-50 border-red-300 text-red-900'
                        : 'bg-blue-50 border-blue-300 text-blue-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {cashVariance === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                      <strong>
                        {cashVariance === 0
                          ? 'Drawer Balanced Perfectly'
                          : cashVariance < 0
                          ? 'Cash Shortage Detected'
                          : 'Cash Overage Detected'}
                      </strong>
                    </div>

                    <strong className="font-titan text-sm">
                      {cashVariance > 0 ? `+${formatNaira(cashVariance)}` : formatNaira(cashVariance)}
                    </strong>
                  </div>
                )}
              </div>

              {/* Settlement Notes & Shift Handover */}
              <div>
                <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                  Shift Settlement Notes & Handover Observation
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. ₦2,000 paid for ice block purchase (receipt attached); Terminal 1 paper replaced."
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl p-2.5 text-xs font-montserrat text-[#241311]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 text-xs font-montserrat font-bold rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#4D080F] hover:bg-[#38050A] text-[#FFC700] text-xs font-titan uppercase rounded-xl shadow-md flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Sign-off Shift & Generate Z-Report
                </button>
              </div>
            </form>
          ) : (
            /* Printable Z-Report Official Certificate */
            <div className="space-y-6">
              <div className="p-6 bg-[#FAF7F2] border-2 border-dashed border-[#4D080F] rounded-3xl space-y-4 text-xs font-mono text-[#241311]">
                {/* Print Header */}
                <div className="text-center pb-3 border-b border-[#E5DEC9] space-y-1">
                  <h3 className="font-titan text-lg text-[#4D080F]">CHOPLIFE REPUBLIC RESTAURANT</h3>
                  <p className="text-[11px] font-bold uppercase">{currentBranch.name}</p>
                  <p className="text-[10px] text-gray-500">
                    Official End of Day Z-Report / Daily Fiscal Settlement
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono">
                    Timestamp: {new Date(submissionData.reconciledAt).toLocaleString()}
                  </p>
                </div>

                {/* Breakdown List */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Total Shift Tickets:</span>
                    <strong>{submissionData.totalOrders}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Gross Sales Revenue:</span>
                    <strong>{formatNaira(submissionData.grossSales)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash Sales:</span>
                    <strong>{formatNaira(submissionData.cashSales)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>POS Terminal Card Sales:</span>
                    <strong>{formatNaira(submissionData.cardSales)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Direct Bank Transfers:</span>
                    <strong>{formatNaira(submissionData.transferSales)}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-gray-300 space-y-1">
                  <div className="flex justify-between">
                    <span>Expected Cash in Till:</span>
                    <strong>{formatNaira(submissionData.cashExpected)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Physical Cash Counted:</span>
                    <strong>{formatNaira(submissionData.cashCounted)}</strong>
                  </div>
                  <div className="flex justify-between font-bold text-sm">
                    <span>Fiscal Cash Variance:</span>
                    <span
                      className={
                        submissionData.cashDifference === 0
                          ? 'text-emerald-700'
                          : submissionData.cashDifference < 0
                          ? 'text-red-600'
                          : 'text-blue-700'
                      }
                    >
                      {formatNaira(submissionData.cashDifference)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-300 text-[10px] text-gray-600 space-y-1">
                  <p>Certified Reconciled By: <strong>{submissionData.reconciledBy}</strong></p>
                  <p>Notes: {submissionData.notes}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-montserrat font-bold rounded-xl flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Re-open Audit Form
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintZReport}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-titan uppercase rounded-xl shadow-md flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Print Z-Report Certificate
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 bg-[#4D080F] text-[#FFC700] text-xs font-titan uppercase rounded-xl shadow-md"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
