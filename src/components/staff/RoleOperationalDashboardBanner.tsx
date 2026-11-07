import React from 'react';
import {
  Store,
  Clock,
  Receipt,
  Boxes,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
  CreditCard,
  Plus,
  LayoutGrid,
  CheckCircle2,
  Split,
  Truck,
  ChefHat,
} from 'lucide-react';
import { StaffUser, BranchId } from '../../types';

interface RoleOperationalDashboardBannerProps {
  currentStaff: StaffUser | null;
  activeBranchId: BranchId;
  branchName: string;
  currentShift: any | null;
  checks: any[];
  inventoryList: any[];
  stockRequests: any[];
  wastageLogs: any[];
  deliveryTasks: any[];
  kdsTickets: any[];
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onOpenNewCheck: (type: 'dine_in' | 'takeaway') => void;
  onOpenShiftModal: () => void;
}

export const RoleOperationalDashboardBanner: React.FC<RoleOperationalDashboardBannerProps> = ({
  currentStaff,
  activeBranchId,
  branchName,
  currentShift,
  checks,
  inventoryList,
  stockRequests,
  wastageLogs,
  deliveryTasks,
  kdsTickets,
  activeTab,
  setActiveTab,
  onOpenNewCheck,
  onOpenShiftModal,
}) => {
  if (!currentStaff) return null;

  const role = currentStaff.role;
  const openChecks = checks.filter(
    (c) => c.status === 'open' || c.status === 'sent_to_kitchen' || c.status === 'partially_paid'
  );
  const partialChecks = checks.filter((c) => c.status === 'partially_paid');
  const paidTodayByStaff = checks.filter(
    (c) =>
      c.status === 'paid' &&
      !c.isHistoricalMigrated &&
      (c.closedBy === currentStaff.id || c.openedBy === currentStaff.id)
  );
  const staffPersonalSalesTotal = paidTodayByStaff.reduce((s, c) => s + Number(c.total || 0), 0);

  const lowStockCount = inventoryList.filter(
    (item) => Number(item.stockQty ?? item.currentStock ?? 0) <= Number(item.reorderLevel ?? 10)
  ).length;
  const outOfStockCount = inventoryList.filter(
    (item) => Number(item.stockQty ?? item.currentStock ?? 0) <= 0
  ).length;
  const pendingTransfersCount = stockRequests.filter(
    (r) => r.status === 'pending' || r.status === 'dispatched'
  ).length;

  // On active POS register tab on mobile/tablet (< xl), do not stack a secondary dashboard banner above the register
  if (activeTab === 'pos') {
    return (
      <div className="hidden xl:flex bg-white border-b border-[#E5DEC9] px-4 py-1.5 items-center justify-between gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF7F2] border border-[#E5DEC9] font-bold text-[#4D080F] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#800D15]" />
            {role === 'branch_manager'
              ? `Branch Manager Scope: ${branchName}`
              : role === 'accountant' || role === 'auditor'
              ? `Finance & Audit • ${branchName}`
              : role === 'cashier' || role === 'customer_service' || role === 'receptionist'
              ? `Cashier Terminal • ${branchName}`
              : `Enterprise Control • ${branchName}`}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-[#FAF7F2] border border-[#E5DEC9] text-stone-700 font-medium">
            Open Checks: <strong className="font-mono text-[#241311]">{openChecks.length}</strong>
            {partialChecks.length > 0 && (
              <span className="ml-1.5 text-amber-700 font-bold">({partialChecks.length} Partial)</span>
            )}
          </span>
          {lowStockCount > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
              Low Stock: <strong className="font-mono">{lowStockCount}</strong>
            </span>
          )}
        </div>
        {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'accountant', 'auditor'].includes(role) && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('reports')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9] hover:bg-stone-100 flex items-center gap-1 transition-colors"
            >
              <BarChart3 className="w-3 h-3 text-[#800D15]" /> Executive BI &amp; GL
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9] hover:bg-stone-100 flex items-center gap-1 transition-colors"
            >
              <Receipt className="w-3 h-3 text-[#800D15]" /> CAPEX / OPEX &amp; Claims
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9] hover:bg-stone-100 flex items-center gap-1 transition-colors"
            >
              <Boxes className="w-3 h-3 text-[#800D15]" /> Inventory
            </button>
          </div>
        )}
      </div>
    );
  }

  // 1. CASHIER / FRONTLINE POS DASHBOARD (Zero company-wide financials exposed)
  if (role === 'cashier' || role === 'customer_service' || role === 'receptionist') {
    return (
      <div className="bg-white border-b border-[#E5DEC9] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#FAF7F2] border border-[#E5DEC9] px-3 py-1.5 rounded-xl">
            <Store className="w-4 h-4 text-[#800D15]" />
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block leading-none">
                Cashier Terminal • POS-REG-01
              </span>
              <span className="text-xs font-black text-[#241311]">{branchName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#FAF7F2] border border-[#E5DEC9] px-3 py-1.5 rounded-xl">
            <Clock className={`w-4 h-4 ${currentShift ? 'text-emerald-600' : 'text-amber-600'}`} />
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block leading-none">
                Shift Register
              </span>
              {currentShift ? (
                <span className="text-xs font-mono font-bold text-emerald-700">
                  OPEN • Float ₦{Number(currentShift.openingFloat || 0).toLocaleString()}
                </span>
              ) : (
                <button
                  onClick={onOpenShiftModal}
                  className="text-xs font-bold text-amber-700 underline hover:text-[#800D15]"
                >
                  Closed — Click to Open Shift
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#FAF7F2] border border-[#E5DEC9] px-3 py-1.5 rounded-xl text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block leading-none">
                Active Checks
              </span>
              <span className="font-mono font-black text-[#241311]">{openChecks.length}</span>
            </div>
            {partialChecks.length > 0 && (
              <div className="pl-2.5 border-l border-[#E5DEC9]">
                <span className="text-[10px] uppercase font-bold text-amber-700 block leading-none">
                  Split / Partial
                </span>
                <span className="font-mono font-black text-amber-800">{partialChecks.length} Due</span>
              </div>
            )}
            <div className="pl-2.5 border-l border-[#E5DEC9]">
              <span className="text-[10px] uppercase font-bold text-stone-500 block leading-none">
                My Shift Settled
              </span>
              <span className="font-mono font-black text-emerald-700">
                ₦{staffPersonalSalesTotal.toLocaleString()} ({paidTodayByStaff.length})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('pos');
              onOpenNewCheck('takeaway');
            }}
            className="px-3 py-1.5 rounded-xl bg-[#800D15] hover:bg-[#4D080F] text-[#FFC700] text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Check
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              activeTab === 'tables'
                ? 'bg-[#241311] text-[#FFC700] border-[#241311]'
                : 'bg-[#FAF7F2] text-[#241311] border-[#E5DEC9] hover:bg-stone-100'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Tables
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              activeTab === 'expenses'
                ? 'bg-[#241311] text-[#FFC700] border-[#241311]'
                : 'bg-[#FAF7F2] text-[#241311] border-[#E5DEC9] hover:bg-stone-100'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" /> My Claims
          </button>
        </div>
      </div>
    );
  }

  // 2. STOREKEEPER / STORE MANAGER DASHBOARD
  if (role === 'storekeeper' || role === 'store_manager') {
    return (
      <div className="bg-white border-b border-[#E5DEC9] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#FAF7F2] border border-[#E5DEC9] px-3 py-1.5 rounded-xl">
            <Boxes className="w-4 h-4 text-[#800D15]" />
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block leading-none">
                Store & Inventory Control
              </span>
              <span className="text-xs font-black text-[#241311]">{branchName}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#FAF7F2] border border-[#E5DEC9] px-3 py-1.5 rounded-xl text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block leading-none">
                Tracked SKUs
              </span>
              <span className="font-mono font-black text-[#241311]">{inventoryList.length}</span>
            </div>
            <div className="pl-2.5 border-l border-[#E5DEC9]">
              <span className="text-[10px] uppercase font-bold text-amber-700 block leading-none">
                Low Stock
              </span>
              <span className="font-mono font-black text-amber-700">{lowStockCount}</span>
            </div>
            <div className="pl-2.5 border-l border-[#E5DEC9]">
              <span className="text-[10px] uppercase font-bold text-red-700 block leading-none">
                Out of Stock
              </span>
              <span className="font-mono font-black text-red-700">{outOfStockCount}</span>
            </div>
            <div className="pl-2.5 border-l border-[#E5DEC9]">
              <span className="text-[10px] uppercase font-bold text-stone-500 block leading-none">
                Transfer Indents
              </span>
              <span className="font-mono font-black text-[#800D15]">{pendingTransfersCount} Pending</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className="px-3 py-1.5 rounded-xl bg-[#800D15] hover:bg-[#4D080F] text-[#FFC700] text-xs font-bold flex items-center gap-1.5 shadow-2xs"
          >
            <Boxes className="w-3.5 h-3.5" /> Stock & Receiving
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-[#241311] text-xs font-bold flex items-center gap-1.5 hover:bg-stone-100"
          >
            <Receipt className="w-3.5 h-3.5" /> Expense Claims
          </button>
        </div>
      </div>
    );
  }

  // 3. KITCHEN / RIDER OPERATIONAL BANNER
  if (role === 'kitchen_lead' || role === 'rider') {
    return (
      <div className="bg-white border-b border-[#E5DEC9] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#FAF7F2] border border-[#E5DEC9] px-3 py-1.5 rounded-xl">
            {role === 'kitchen_lead' ? (
              <ChefHat className="w-4 h-4 text-[#800D15]" />
            ) : (
              <Truck className="w-4 h-4 text-[#800D15]" />
            )}
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block leading-none">
                {role === 'kitchen_lead' ? 'Kitchen Display Station' : 'Dispatch Rider Console'}
              </span>
              <span className="text-xs font-black text-[#241311]">{branchName}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#FAF7F2] border border-[#E5DEC9] px-3 py-1.5 rounded-xl text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block leading-none">
                Active KDS Tickets
              </span>
              <span className="font-mono font-black text-[#241311]">{kdsTickets.length}</span>
            </div>
            <div className="pl-2.5 border-l border-[#E5DEC9]">
              <span className="text-[10px] uppercase font-bold text-stone-500 block leading-none">
                Dispatch Tasks
              </span>
              <span className="font-mono font-black text-[#800D15]">{deliveryTasks.length}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. ACCOUNTANT / AUDITOR / BRANCH MANAGER / EXECUTIVE SUMMARY STRIP (Desktop xl+ only so mobile/tablet viewports remain clean)
  return (
    <div className="hidden xl:flex bg-white border-b border-[#E5DEC9] px-4 py-1.5 flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        <span className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#E5DEC9] font-bold text-[#4D080F] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#800D15]" />
          {role === 'branch_manager'
            ? `Branch Manager Scope: ${branchName}`
            : role === 'accountant' || role === 'auditor'
            ? `Finance & Audit Governance • ${branchName}`
            : `Enterprise Control • ${branchName}`}
        </span>

        <span className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#E5DEC9] text-stone-700 font-medium">
          Open Checks: <strong className="font-mono text-[#241311]">{openChecks.length}</strong>
          {partialChecks.length > 0 && (
            <span className="ml-1.5 text-amber-700 font-bold">
              ({partialChecks.length} Partial Split)
            </span>
          )}
        </span>

        <span className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#E5DEC9] text-stone-700 font-medium">
          Low Stock Alerts: <strong className="font-mono text-amber-700">{lowStockCount}</strong>
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
            activeTab === 'reports'
              ? 'bg-[#800D15] text-[#FFC700]'
              : 'bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9] hover:bg-stone-100'
          }`}
        >
          <BarChart3 className="w-3 h-3" /> Live Executive BI
        </button>
        <button
          onClick={() => setActiveTab('enterprise_reports')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
            activeTab === 'enterprise_reports'
              ? 'bg-[#800D15] text-[#FFC700]'
              : 'bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9] hover:bg-stone-100'
          }`}
        >
          <Receipt className="w-3 h-3" /> Reports &amp; Exports
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
            activeTab === 'expenses'
              ? 'bg-[#800D15] text-[#FFC700]'
              : 'bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9] hover:bg-stone-100'
          }`}
        >
          <Receipt className="w-3 h-3" /> CAPEX / OPEX &amp; Claims
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
            activeTab === 'inventory'
              ? 'bg-[#800D15] text-[#FFC700]'
              : 'bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9] hover:bg-stone-100'
          }`}
        >
          <Boxes className="w-3 h-3" /> Inventory &amp; Import
        </button>
      </div>
    </div>
  );
};
