import React from 'react';
import { Banknote, Lock, Sparkles, Clock } from 'lucide-react';

interface WorkspaceShiftsTabProps {
  currentShift: any;
  setIsCashMovementModalOpen: (v: boolean) => void;
  setIsClosingShiftModalOpen: (v: boolean) => void;
  setIsOpeningShiftModalOpen: (v: boolean) => void;
}

export const WorkspaceShiftsTab: React.FC<WorkspaceShiftsTabProps> = ({
  currentShift,
  setIsCashMovementModalOpen,
  setIsClosingShiftModalOpen,
  setIsOpeningShiftModalOpen,
}) => {
  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#FAF7F2]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Shift Management & Cash Drawer</h2>
          <p className="text-xs text-stone-500">
            Live cash movements, X-Report snapshots, and closing Z-Reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentShift ? (
            <>
              <button
                onClick={() => setIsCashMovementModalOpen(true)}
                className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Banknote className="w-4 h-4 text-[#FFC700]" /> Safe Drop / Paid Out
              </button>
              <button
                onClick={() => setIsClosingShiftModalOpen(true)}
                className="px-3.5 py-2 bg-[#800D15] hover:bg-[#660A11] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Lock className="w-4 h-4" /> Close Shift (Z-Report)
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsOpeningShiftModalOpen(true)}
              className="px-4 py-2 bg-[#800D15] hover:bg-[#660A11] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Sparkles className="w-4 h-4 text-[#FFC700]" /> Open New Shift
            </button>
          )}
        </div>
      </div>

      {currentShift ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs">
            <span className="text-xs font-medium text-stone-500">Opening Float</span>
            <p className="font-mono tabular-nums font-bold text-xl text-stone-900 mt-1">
              ₦{currentShift.openingFloat.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs">
            <span className="text-xs font-medium text-stone-500">Cash Sales</span>
            <p className="font-mono tabular-nums font-bold text-xl text-emerald-700 mt-1">
              ₦{currentShift.totalCashSales.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs">
            <span className="text-xs font-medium text-stone-500">POS Terminal Sales</span>
            <p className="font-mono tabular-nums font-bold text-xl text-sky-700 mt-1">
              ₦{currentShift.totalPosSales.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs">
            <span className="text-xs font-medium text-stone-500">Expected Cash in Till</span>
            <p className="font-mono tabular-nums font-bold text-xl text-[#800D15] mt-1">
              ₦{currentShift.expectedCashInTill.toLocaleString()}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-white border border-stone-200 rounded-2xl text-center space-y-2 shadow-2xs">
          <Clock className="w-10 h-10 text-stone-400 mx-auto" />
          <h3 className="font-bold text-sm text-stone-900">No Shift Currently Active</h3>
          <p className="text-xs text-stone-500">Enter your opening cash float to begin processing sales.</p>
        </div>
      )}
    </div>
  );
};
