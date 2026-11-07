import React, { useState } from 'react';
import { BranchId } from '../../types';
import {
  Banknote,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Printer,
  X,
} from 'lucide-react';

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentShift: any;
  onSuccess?: (updatedShift: any) => void;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
  cashMovementType?: any;
  setCashMovementType?: any;
  cashMovementAmount?: any;
  setCashMovementAmount?: any;
  cashMovementReason?: any;
  setCashMovementReason?: any;
  onSave?: any;
}

export const CashMovementModal: React.FC<CashMovementModalProps> = ({
  isOpen,
  onClose,
  currentShift,
  onSuccess,
  showToast,
}) => {
  const [movementType, setMovementType] = useState<'safe_drop' | 'paid_out' | 'cash_refund' | 'adjustment'>('safe_drop');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !currentShift) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) {
      showToast?.('Please enter a valid cash amount', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pos/shifts/${currentShift.id}/cash-movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movementType,
          amount: num,
          reason: reason || `${movementType} entry`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onSuccess?.(data.shift);
        showToast?.(`Recorded ₦${num.toLocaleString()} ${movementType.replace('_', ' ')}!`);
        onClose();
      } else {
        const err = await res.json();
        showToast?.(err.error || 'Failed to record cash movement', 'error');
      }
    } catch {
      showToast?.('Error recording cash movement', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#800D15] rounded-xl text-[#FFC700]">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#241311]">Record Cash Movement</h3>
              <p className="text-xs text-[#7A6A65]">Active Shift: {currentShift.shiftNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#7A6A65] hover:text-[#241311]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-[#4D080F] font-bold">Movement Category</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'safe_drop', title: 'Safe Drop', sub: 'Skim till cash to safe' },
                { key: 'paid_out', title: 'Paid Out (Petty Cash)', sub: 'Generator, ice, supplies' },
                { key: 'cash_refund', title: 'Cash Refund', sub: 'Customer check reversal' },
                { key: 'adjustment', title: 'Float Adjustment', sub: 'Change replenishment' },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMovementType(m.key as any)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    movementType === m.key
                      ? 'bg-[#800D15] border-[#800D15] text-white'
                      : 'bg-[#FAF7F2] border-[#E5DEC9] text-[#241311]'
                  }`}
                >
                  <span className="font-bold text-xs">{m.title}</span>
                  <span className="text-[10px] opacity-80">{m.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[#4D080F] font-bold">Cash Amount (₦)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-sm text-[#800D15]">₦</span>
              <input
                type="number"
                required
                min={1}
                placeholder="e.g. 10000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono font-bold text-[#241311] focus:outline-none focus:border-[#800D15]"
              />
            </div>
            <p className="text-[11px] text-[#7A6A65]">
              Current Expected Drawer Float: <strong className="font-mono text-[#800D15]">₦{currentShift.expectedCashInTill?.toLocaleString()}</strong>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[#4D080F] font-bold">Reason / Recipient / Memo</label>
            <input
              type="text"
              required
              placeholder="e.g. 5,000 Diesel fuel for generator - receipt #4402"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
            />
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
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-[#800D15] hover:bg-[#4D080F] disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all"
            >
              {isSubmitting ? 'Logging...' : 'Confirm Cash Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentShift: any;
  onSuccess?: (closedShift: any) => void;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
  countedCashInput?: any;
  setCountedCashInput?: any;
  closingNotesInput?: any;
  setClosingNotesInput?: any;
  onConfirmClose?: any;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  currentShift,
  onSuccess,
  showToast,
}) => {
  const [countedCash, setCountedCash] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !currentShift) return null;

  const expected = currentShift.expectedCashInTill || 0;
  const counted = Number(countedCash) || 0;
  const variance = counted - expected;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countedCash === '') {
      showToast?.('Please enter the physical counted cash amount in till', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pos/shifts/${currentShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countedCashInTill: counted,
          notes: closingNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onSuccess?.(data.shift);
        onClose();
      } else {
        const err = await res.json();
        showToast?.(err.error || 'Failed to close shift', 'error');
      }
    } catch {
      showToast?.('Error closing shift', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#800D15] rounded-xl text-[#FFC700]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#241311]">Close Register &amp; Generate Z-Report</h3>
              <p className="text-xs text-[#7A6A65]">Shift: {currentShift.shiftNumber} • Register: {currentShift.registerId}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#7A6A65] hover:text-[#241311]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl p-3.5 space-y-2 text-xs">
          <span className="text-[10px] uppercase font-bold text-[#7A6A65] tracking-wider">Shift Financial Ledger</span>
          <div className="grid grid-cols-2 gap-2 text-[#7A6A65]">
            <div>
              <span>Opening Float:</span>
              <p className="font-mono font-bold text-[#241311]">₦{currentShift.openingFloat?.toLocaleString()}</p>
            </div>
            <div>
              <span>Cash Sales Collected:</span>
              <p className="font-mono font-bold text-emerald-700">+₦{currentShift.totalCashSales?.toLocaleString()}</p>
            </div>
            <div>
              <span>POS Terminal Sales:</span>
              <p className="font-mono font-bold text-sky-700">₦{currentShift.totalPosSales?.toLocaleString()}</p>
            </div>
            <div>
              <span>Bank Transfer Sales:</span>
              <p className="font-mono font-bold text-amber-700">₦{currentShift.totalTransferSales?.toLocaleString()}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5DEC9] flex items-center justify-between">
            <span className="font-bold text-sm text-[#241311]">Expected Cash in Drawer:</span>
            <span className="font-mono font-black text-base text-[#800D15]">₦{expected.toLocaleString()}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-[#4D080F] font-bold">Physical Counted Cash in Till (₦)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-sm text-[#800D15]">₦</span>
              <input
                type="number"
                required
                min={0}
                placeholder="Count physical currency in drawer..."
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono font-black text-[#241311] focus:outline-none focus:border-[#800D15]"
              />
            </div>
          </div>

          {countedCash !== '' && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                variance === 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : variance > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {variance === 0 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>
                  {variance === 0
                    ? 'Drawer is Perfectly Balanced!'
                    : variance > 0
                    ? `Cash Overage: +₦${variance.toLocaleString()}`
                    : `Cash Shortage: -₦${Math.abs(variance).toLocaleString()}`}
                </span>
              </div>
              <span className="font-mono font-black">
                {variance >= 0 ? `+₦${variance.toLocaleString()}` : `-₦${Math.abs(variance).toLocaleString()}`}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[#4D080F] font-bold">Closing Notes / Handover Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Handover to evening shift cashier; safe drop envelopes verified by supervisor"
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311] focus:outline-none focus:border-[#800D15]"
            />
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
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-[#800D15] hover:bg-[#4D080F] disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all"
            >
              {isSubmitting ? 'Closing...' : 'Close Shift & Print Z-Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ShiftZReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift?: any;
  shiftReport?: any;
  branchId?: BranchId;
  branchName?: string;
}

export const ShiftZReportModal: React.FC<ShiftZReportModalProps> = ({
  isOpen,
  onClose,
  shift,
  shiftReport,
  branchId,
  branchName: passedBranchName,
}) => {
  const activeShift = shift || shiftReport;
  if (!isOpen || !activeShift) return null;

  const branchName =
    passedBranchName ||
    (branchId === 'gra'
      ? 'GRA Flagship (8a Okogo St)'
      : branchId === 'okabere'
      ? 'Okabere Hub (Sapele Rd)'
      : 'Ugbowo Campus (UBTH Way)');

  const grossSales =
    (activeShift.totalCashSales || 0) +
    (activeShift.totalPosSales || 0) +
    (activeShift.totalTransferSales || 0);

  const variance = activeShift.cashVariance || (activeShift.actualCashCounted || 0) - (activeShift.expectedCashInTill || 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-2 border-b border-[#E5DEC9]">
          <span className="text-xs font-black text-[#800D15] uppercase tracking-wider">Official Z-Report</span>
          <button onClick={onClose} className="text-[#7A6A65] hover:text-[#241311]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#FAF7F2] border border-[#E5DEC9] text-black p-4 rounded-xl font-mono text-[11px] leading-tight space-y-3 print:m-0 print:p-0">
          <div className="text-center space-y-0.5 border-b border-dashed border-gray-400 pb-2">
            <h2 className="font-extrabold text-sm uppercase tracking-wider">CHOPLIFE REPUBLIC</h2>
            <p className="text-[10px] text-gray-700">{branchName}</p>
            <p className="text-[10px] font-bold mt-1 uppercase text-black">END OF SHIFT Z-REPORT</p>
          </div>

          <div className="space-y-1 text-[10px] text-gray-800">
            <div className="flex justify-between">
              <span>Shift ID:</span>
              <span className="font-bold">{activeShift.shiftNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Register:</span>
              <span>{activeShift.registerId}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span className="font-bold">{activeShift.staffName}</span>
            </div>
          </div>

          <div className="border-t border-b border-dashed border-gray-400 py-2 space-y-1">
            <span className="block font-bold text-[10px] uppercase text-gray-700">SALES REVENUE SUMMARY</span>
            <div className="flex justify-between">
              <span>Cash Sales:</span>
              <span className="font-bold">₦{activeShift.totalCashSales?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>POS Terminal:</span>
              <span className="font-bold">₦{activeShift.totalPosSales?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Bank Transfer:</span>
              <span className="font-bold">₦{activeShift.totalTransferSales?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-gray-300 font-extrabold text-xs">
              <span>GROSS REVENUE:</span>
              <span>₦{grossSales.toLocaleString()}</span>
            </div>
          </div>

          <div className="border-b border-dashed border-gray-400 pb-2 space-y-1">
            <span className="block font-bold text-[10px] uppercase text-gray-700">DRAWER RECONCILIATION</span>
            <div className="flex justify-between">
              <span>(+) Opening Float:</span>
              <span>₦{activeShift.openingFloat?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>(=) Expected Cash:</span>
              <span>₦{activeShift.expectedCashInTill?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Physical Counted Cash:</span>
              <span>₦{activeShift.actualCashCounted?.toLocaleString()}</span>
            </div>
            <div className={`flex justify-between font-extrabold pt-1 ${variance === 0 ? 'text-black' : variance > 0 ? 'text-green-700' : 'text-red-700'}`}>
              <span>CASH VARIANCE:</span>
              <span>{variance >= 0 ? `+₦${variance.toLocaleString()}` : `-₦${Math.abs(variance).toLocaleString()}`}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-[#FAF7F2] hover:bg-[#E5DEC9] text-[#241311] border border-[#E5DEC9] font-bold text-xs rounded-xl"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2 bg-[#800D15] hover:bg-[#4D080F] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md"
          >
            <Printer className="w-3.5 h-3.5 text-[#FFC700]" /> Print Z-Report
          </button>
        </div>
      </div>
    </div>
  );
};
