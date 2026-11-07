import React, { useState, useEffect } from 'react';
import {
  Plus,
  Check,
  Clock,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  FileText,
  CreditCard,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export interface PayrollAdjustmentRecord {
  id: string;
  staffId: string;
  staffName: string;
  branchId: string;
  period: string;
  type: 'earning' | 'deduction';
  category:
    | 'salary_advance'
    | 'loan_repayment'
    | 'fine_lateness'
    | 'cash_shortage'
    | 'damaged_goods'
    | 'performance_bonus'
    | 'overtime_allowance'
    | 'hazard_allowance';
  amount: number;
  totalLoanPrincipal: number;
  remainingBalance: number;
  monthlyInstallment: number;
  reason: string;
  status: 'pending_approval' | 'approved' | 'deducted_in_payroll' | 'completed';
  createdByStaffId: string;
  createdByName: string;
  approvedByStaffId: string | null;
  approvedByName: string | null;
  createdAt: string;
}

export interface ShiftShortageRecord {
  shiftId: string;
  shiftNumber: string;
  reconciliationId: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  expectedClosingCash: number;
  actualClosingCash: number;
  varianceAmount: number;
  shortageAmount: number;
  closedAt: string;
  notes: string;
  alreadyRecovered: boolean;
}

interface Props {
  defaultPeriod: string;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const PayrollAdjustmentsAndLoansPanel: React.FC<Props> = ({ defaultPeriod, onShowToast }) => {
  const { staffAccounts, currentStaff, formatNaira } = useApp();
  const [adjustments, setAdjustments] = useState<PayrollAdjustmentRecord[]>([]);
  const [directoryEmployees, setDirectoryEmployees] = useState<any[]>([]);
  const [shiftShortages, setShiftShortages] = useState<ShiftShortageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [staffId, setStaffId] = useState('');
  const [period, setPeriod] = useState(defaultPeriod);
  const [category, setCategory] = useState<PayrollAdjustmentRecord['category']>('salary_advance');
  const [amount, setAmount] = useState<number>(10000);
  const [totalLoanPrincipal, setTotalLoanPrincipal] = useState<number>(50000);
  const [monthlyInstallment, setMonthlyInstallment] = useState<number>(10000);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [investigationNotes, setInvestigationNotes] = useState<string>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    const token =
      localStorage.getItem('choplife_staff_token') ||
      localStorage.getItem('choplife_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchAdjustmentsAndDirectory = async () => {
    setLoading(true);
    setLoadingDirectory(true);
    try {
      const headers = getAuthHeaders();
      const [adjRes, staffRes, shortagesRes] = await Promise.all([
        fetch('/api/finance/payroll/adjustments', { headers, credentials: 'include' }),
        fetch('/api/staff/accounts', { headers, credentials: 'include' }),
        fetch('/api/finance/payroll/shift-shortages', { headers, credentials: 'include' }),
      ]);
      if (adjRes.ok) {
        const data = await adjRes.json();
        setAdjustments(Array.isArray(data) ? data : []);
      }
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        if (Array.isArray(staffData)) {
          setDirectoryEmployees(staffData.filter((s: any) => s.status !== 'suspended' && s.status !== 'deactivated'));
        }
      }
      if (shortagesRes.ok) {
        const shortagesData = await shortagesRes.json();
        if (Array.isArray(shortagesData)) {
          setShiftShortages(shortagesData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch payroll adjustments or directory:', err);
    } finally {
      setLoading(false);
      setLoadingDirectory(false);
    }
  };

  useEffect(() => {
    fetchAdjustmentsAndDirectory();
  }, []);

  const activeEmployees =
    directoryEmployees.length > 0
      ? directoryEmployees
      : (staffAccounts || []).filter((s: any) => s.status !== 'suspended');

  const filteredEmployees = activeEmployees.filter((s: any) => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    return (
      String(s.name || '').toLowerCase().includes(q) ||
      String(s.staffId || s.id || '').toLowerCase().includes(q) ||
      String(s.role || '').toLowerCase().includes(q) ||
      String(s.branchId || '').toLowerCase().includes(q)
    );
  });

  const isEarningCategory = (cat: string) =>
    ['performance_bonus', 'overtime_allowance', 'hazard_allowance'].includes(cat);

  const handleSelectShiftShortage = (shiftIdVal: string) => {
    setSelectedShiftId(shiftIdVal);
    const matchedShift = shiftShortages.find((sh) => sh.shiftId === shiftIdVal);
    if (matchedShift) {
      setAmount(matchedShift.shortageAmount);
      if (matchedShift.cashierId) {
        const cashierMatch = activeEmployees.find(
          (emp: any) =>
            emp.id === matchedShift.cashierId ||
            emp.staffId === matchedShift.cashierId ||
            String(emp.name || '').toLowerCase() === String(matchedShift.cashierName || '').toLowerCase()
        );
        if (cashierMatch) {
          setStaffId(cashierMatch.id);
        }
      }
      setReason(
        `Verified Till Variance Recovery (${matchedShift.shiftNumber} • Reconciliation ${matchedShift.reconciliationId})`
      );
      setInvestigationNotes(matchedShift.notes || '');
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !reason.trim()) {
      onShowToast('error', 'Please select a staff member and provide a reason.');
      return;
    }
    if (category === 'cash_shortage' && !selectedShiftId) {
      onShowToast('error', 'Cashier shortage deductions must be linked to a verified POS shift reconciliation.');
      return;
    }
    setSubmitting(true);
    try {
      const type = isEarningCategory(category) ? 'earning' : 'deduction';
      const effectiveAmount = category === 'loan_repayment' ? monthlyInstallment : amount;
      const matchedShift = shiftShortages.find((sh) => sh.shiftId === selectedShiftId);
      const isExecutiveAdmin = ['super_admin', 'corporate_admin', 'admin'].includes(currentStaff?.role || '');

      const res = await fetch('/api/finance/payroll/adjustments', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          staffId,
          period,
          type,
          category,
          amount: effectiveAmount,
          totalLoanPrincipal: category === 'loan_repayment' ? totalLoanPrincipal : effectiveAmount,
          monthlyInstallment: category === 'loan_repayment' ? monthlyInstallment : effectiveAmount,
          reason: reason.trim(),
          shiftId: category === 'cash_shortage' ? selectedShiftId : undefined,
          reconciliationId: category === 'cash_shortage' ? matchedShift?.reconciliationId : undefined,
          varianceAmount: category === 'cash_shortage' ? matchedShift?.varianceAmount : undefined,
          approvedRecoveryAmount: category === 'cash_shortage' ? effectiveAmount : undefined,
          investigationNotes: category === 'cash_shortage' ? investigationNotes.trim() : undefined,
          autoApprove: isExecutiveAdmin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast('error', data.error || 'Failed to record adjustment');
        return;
      }
      onShowToast(
        'success',
        data.adjustment?.status === 'approved'
          ? 'Payroll adjustment recorded and approved for payroll computation.'
          : 'Payroll adjustment submitted for management/finance approval.'
      );
      setIsModalOpen(false);
      setReason('');
      setSelectedShiftId('');
      setInvestigationNotes('');
      fetchAdjustmentsAndDirectory();
    } catch (err) {
      onShowToast('error', 'Network error while saving payroll adjustment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAdjustment = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/payroll/adjustments/${id}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onShowToast('success', 'Adjustment approved for payroll inclusion.');
        fetchAdjustmentsAndDirectory();
      } else {
        onShowToast('error', data.error || 'Failed to approve adjustment.');
      }
    } catch (err) {
      onShowToast('error', 'Failed to approve adjustment.');
    }
  };

  const formatCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      salary_advance: 'Salary Advance Recovery',
      loan_repayment: 'Staff Loan (Reducing Balance)',
      staff_loan: 'Staff Loan (Reducing Balance)',
      fine_lateness: 'Disciplinary / Lateness Fine',
      cash_shortage: 'POS Cash Shortage Recovery',
      damaged_goods: 'Damaged / Lost Asset Deduction',
      performance_bonus: 'Performance / Target Bonus',
      overtime_allowance: 'Overtime Shift Allowance',
      hazard_allowance: 'Special / Hazard Allowance',
    };
    return map[cat] || cat;
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E5DEC9] shadow-xs overflow-hidden">
      <div className="p-5 border-b border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#4D080F] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#4D080F]" />
            <span>Salary Advances, Staff Loans, Shift Shortages &amp; Adjustments</span>
          </h2>
          <p className="text-xs text-stone-500">
            Manage employee loans with reducing balances, salary advances, verified POS shift-shortage recoveries, fines, and bonuses. Approved items automatically sync into payroll preparation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdjustmentsAndDirectory}
            className="px-3 py-2 rounded-xl border border-[#E5DEC9] bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            id="open-record-loan-adjustment-btn"
            onClick={() => {
              fetchAdjustmentsAndDirectory();
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Loan / Advance / Fine</span>
          </button>
        </div>
      </div>

      {adjustments.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <FileText className="w-8 h-8 text-stone-400 mx-auto" />
          <p className="text-sm font-bold text-stone-800">No active loans, advances, or variable adjustments recorded</p>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Record staff salary advances, multi-month reducing-balance loans, shift-linked cash-shortage deductions, or performance bonuses here before preparing payroll.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#FAF7F2] text-stone-700 font-bold border-b border-[#E5DEC9]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Period</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Reason / Shift Reference</th>
                <th className="py-3 px-3 text-right">Monthly Impact</th>
                <th className="py-3 px-3 text-right">Loan Remaining Balance</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DEC9]">
              {adjustments.map((adj: any) => (
                <tr key={adj.id} className="hover:bg-stone-50">
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {adj.staffName}
                    <span className="block text-[10px] text-stone-500 uppercase">
                      {adj.employeeId ? `${adj.employeeId} • ` : ''}{adj.branchId}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-stone-700">{adj.period || adj.effectivePeriod}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        adj.type === 'earning'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {adj.type === 'earning' ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {formatCategoryLabel(adj.category)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-stone-700 max-w-xs">
                    <p className="truncate font-semibold" title={adj.reason || adj.title}>
                      {adj.reason || adj.title}
                    </p>
                    {adj.shiftId && (
                      <span className="inline-block text-[10px] font-mono bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded mt-0.5 border border-stone-200">
                        Shift: {adj.shiftId} {adj.reconciliationId ? `(${adj.reconciliationId})` : ''}
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-black ${
                      adj.type === 'earning' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {adj.type === 'earning' ? '+' : '-'}
                    {formatNaira(
                      adj.category === 'loan_repayment' || adj.category === 'staff_loan'
                        ? adj.monthlyInstallment
                        : adj.amount || adj.amountThisPeriod
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-stone-800">
                    {adj.category === 'loan_repayment' || adj.category === 'staff_loan' || adj.isRecurring ? (
                      <div>
                        <span>{formatNaira(adj.remainingBalance)}</span>
                        <span className="block text-[10px] text-stone-400">
                          of {formatNaira(adj.totalLoanPrincipal || adj.principalAmount)} principal
                        </span>
                      </div>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        adj.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : adj.status === 'deducted_in_payroll' || adj.status === 'completed'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {adj.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {adj.status === 'pending_approval' ? (
                      <button
                        onClick={() => handleApproveAdjustment(adj.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 text-[11px] font-bold"
                      >
                        Approve
                      </button>
                    ) : (
                      <span className="text-[11px] text-stone-400 font-medium">
                        By {adj.approvedByName || adj.createdByName}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 border border-[#E5DEC9] shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div>
                <h3 className="text-base font-black text-[#4D080F]">
                  Record Staff Loan, Salary Advance, Shift Shortage or Bonus
                </h3>
                <p className="text-xs text-stone-500">
                  Connected directly to the authoritative Staff Directory ({activeEmployees.length} active staff loaded).
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 text-xs font-bold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Search or Filter Employee Directory
                </label>
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Type employee name, staff ID (e.g. CLR-GRA-004), role, or branch..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-800 mb-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Select Staff Member *</label>
                  <select
                    id="payroll-adjustment-employee-select"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    required
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 font-bold text-stone-900"
                  >
                    <option value="">
                      {loadingDirectory
                        ? 'Loading employees from directory...'
                        : `-- Choose Employee (${filteredEmployees.length}) --`}
                    </option>
                    {filteredEmployees.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.staffId || s.id} ({String(s.role || '').replace(/_/g, ' ')} •{' '}
                        {String(s.branchId || 'gra').toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Effective Payroll Period *</label>
                  <input
                    type="month"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    required
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 font-bold text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Adjustment Category *</label>
                <select
                  id="payroll-adjustment-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 font-bold text-stone-900"
                >
                  <optgroup label="Deductions & Recoveries">
                    <option value="salary_advance">Salary Advance Recovery (Single Period)</option>
                    <option value="loan_repayment">Staff Loan with Reducing Balance (Multi-Month)</option>
                    <option value="cash_shortage">POS / Cashier Shortage Recovery (Shift-Linked)</option>
                    <option value="fine_lateness">Disciplinary / Lateness Fine</option>
                    <option value="damaged_goods">Damaged / Missing Asset Deduction</option>
                  </optgroup>
                  <optgroup label="Variable Earnings & Bonuses">
                    <option value="performance_bonus">Performance / Target Bonus</option>
                    <option value="overtime_allowance">Verified Overtime Shift Allowance</option>
                    <option value="hazard_allowance">Special / Hazard Allowance</option>
                  </optgroup>
                </select>
              </div>

              {category === 'cash_shortage' && (
                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-rose-900 uppercase tracking-wider text-[11px]">
                      Link to Verified POS Shift Reconciliation Shortage *
                    </span>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      Mandatory Audit Control
                    </span>
                  </div>
                  <select
                    id="payroll-shift-shortage-select"
                    value={selectedShiftId}
                    onChange={(e) => handleSelectShiftShortage(e.target.value)}
                    required
                    className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 font-bold text-stone-900"
                  >
                    <option value="">-- Select Verified Shift Variance Record --</option>
                    {shiftShortages.map((sh) => (
                      <option
                        key={sh.shiftId}
                        value={sh.shiftId}
                        disabled={sh.alreadyRecovered}
                      >
                        {sh.shiftNumber} ({sh.branchId.toUpperCase()}) • Cashier: {sh.cashierName} • Variance:{' '}
                        -{formatNaira(sh.shortageAmount)}{' '}
                        {sh.alreadyRecovered ? '[ALREADY LINKED TO PAYROLL]' : ''}
                      </option>
                    ))}
                  </select>
                  {selectedShiftId && (
                    <div className="text-[11px] text-rose-900 bg-white/80 p-2.5 rounded-xl border border-rose-200 space-y-1">
                      {(() => {
                        const sh = shiftShortages.find((s) => s.shiftId === selectedShiftId);
                        if (!sh) return null;
                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-stone-500">Expected Drawer Cash:</span>
                              <span className="font-mono font-bold">{formatNaira(sh.expectedClosingCash)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-stone-500">Actual Counted Cash:</span>
                              <span className="font-mono font-bold">{formatNaira(sh.actualClosingCash)}</span>
                            </div>
                            <div className="flex justify-between border-t border-rose-100 pt-1">
                              <span className="font-bold text-rose-800">Verified Till Shortage:</span>
                              <span className="font-mono font-black text-rose-700">
                                -{formatNaira(sh.shortageAmount)}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div>
                    <label className="font-bold text-rose-900 block mb-1">
                      Supervisor Investigation &amp; Sign-Off Notes *
                    </label>
                    <input
                      type="text"
                      value={investigationNotes}
                      onChange={(e) => setInvestigationNotes(e.target.value)}
                      placeholder="e.g. Verified physical till recount with Branch Manager and Cashier"
                      required
                      className="w-full bg-white border border-rose-300 rounded-xl px-3 py-1.5 text-stone-900"
                    />
                  </div>
                </div>
              )}

              {category === 'loan_repayment' ? (
                <div className="grid grid-cols-2 gap-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Total Loan Principal (₦) *</label>
                    <input
                      type="number"
                      min={1000}
                      value={totalLoanPrincipal}
                      onChange={(e) => setTotalLoanPrincipal(Number(e.target.value) || 0)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 font-bold text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Monthly Deduction Installment (₦) *</label>
                    <input
                      type="number"
                      min={500}
                      value={monthlyInstallment}
                      onChange={(e) => setMonthlyInstallment(Number(e.target.value) || 0)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 font-bold text-stone-900"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    {category === 'cash_shortage' ? 'Approved Recovery Amount (₦) *' : 'Amount (₦) *'}
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 font-bold text-stone-900"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-stone-700 block mb-1">Audit Reason / Voucher Reference *</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Approved mid-month salary advance ref ADV-2026-04"
                  required
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-stone-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5DEC9]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] font-bold"
                >
                  {submitting ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
