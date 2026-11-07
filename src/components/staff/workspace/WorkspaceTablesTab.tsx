import React from 'react';
import { BranchId } from '../../../types';

interface WorkspaceTablesTabProps {
  activeBranchId: BranchId;
  tables: any[];
  checks: any[];
  setActiveCheck: (chk: any) => void;
  handleOpenNewCheck: (tableName: string) => void;
  setActiveTab: (tab: any) => void;
}

export const WorkspaceTablesTab: React.FC<WorkspaceTablesTabProps> = ({
  activeBranchId,
  tables,
  checks,
  setActiveCheck,
  handleOpenNewCheck,
  setActiveTab,
}) => {
  return (
    <div className="flex-1 p-5 overflow-y-auto space-y-5 bg-[#FAF7F2]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-extrabold text-stone-900">Restaurant Floor &amp; Table Map</h2>
          <p className="text-xs text-stone-500">
            Real-time table status for{' '}
            {activeBranchId === 'gra'
              ? 'GRA Flagship'
              : activeBranchId === 'okabere'
              ? 'Okabere Hub'
              : 'Ugbowo Campus'}
          </p>
        </div>

        {/* Table Status Legend */}
        <div className="flex items-center gap-3 text-xs font-semibold text-stone-700">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Seated / Ordering
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> In Kitchen
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Bill Requested
          </span>
        </div>
      </div>

      {/* Floor Plan Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        {tables.map((t) => (
          <div
            key={t.id}
            onClick={() => {
              if (t.currentCheckId) {
                const chk = checks.find((c) => c.id === t.currentCheckId);
                if (chk) setActiveCheck(chk);
              } else {
                handleOpenNewCheck(t.tableNumber);
              }
              setActiveTab('pos');
            }}
            className={`p-4 rounded-2xl border text-left cursor-pointer transition-all hover:scale-[1.02] shadow-2xs flex flex-col justify-between h-36 ${
              t.status === 'available'
                ? 'bg-white border-emerald-300 hover:border-emerald-500'
                : t.status === 'kitchen_prep'
                ? 'bg-blue-50 border-blue-300 hover:border-blue-500'
                : t.status === 'bill_requested'
                ? 'bg-purple-50 border-purple-300 hover:border-purple-500'
                : 'bg-amber-50 border-amber-300 hover:border-amber-500'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-stone-900">{t.tableNumber}</span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    t.status === 'available'
                      ? 'bg-emerald-500'
                      : t.status === 'kitchen_prep'
                      ? 'bg-blue-500'
                      : t.status === 'bill_requested'
                      ? 'bg-purple-500'
                      : 'bg-amber-500'
                  }`}
                />
              </div>
              <p className="text-[10px] text-stone-500 mt-0.5">
                {t.area} &bull; Seats {t.capacity}
              </p>
            </div>

            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-[11px]">
              <span className="capitalize text-stone-600 font-semibold">{t.status.replace('_', ' ')}</span>
              <span className="font-black text-[#800D15]">
                {t.currentCheckId ? 'Open Check' : 'Empty'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
