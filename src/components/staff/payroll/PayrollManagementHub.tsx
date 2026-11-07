import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  ShieldAlert,
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  Calendar,
  Building2,
  Users,
  CreditCard,
  FileText,
  Printer,
  Search,
  Filter,
  ArrowLeft,
  Download,
  AlertTriangle,
  ChevronRight,
  Eye,
  Lock,
  Send,
  HelpCircle,
  Check,
  X,
  Briefcase,
  DollarSign
} from 'lucide-react';
import { PayrollAdjustmentsAndLoansPanel } from './PayrollAdjustmentsAndLoansPanel';
import { RiderPaymentsAndRatesPanel } from './RiderPaymentsAndRatesPanel';

interface PayrollLine {
  staffId: string;
  employeeId: string;
  staffName: string;
  role: string;
  branchId: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  riderCompletedDeliveries?: number;
  riderDeliveryBonus?: number;
  periodBonuses?: number;
  periodDeductions?: number;
  grossSalary: number;
  employeePension: number;
  employerPension: number;
  nhfDeduction: number;
  craRelief: number;
  taxableIncome: number;
  payeTax: number;
  totalDeductions: number;
  netPay: number;
  bankName: string;
  accountNumberMasked: string;
  accountNumberRaw: string;
  accountName: string;
  calculationStatus: 'calculated' | 'attention_required';
  paymentStatus: 'unpaid' | 'scheduled' | 'paid';
  exceptionReason?: string;
  calculationBreakdown?: {
    statutoryRulesVersion?: string;
    grossEarningsFormula?: string;
    pensionableEarnings?: number;
    employeePensionFormula?: string;
    employerPensionFormula?: string;
    nhfFormula?: string;
    craFormula?: string;
    taxableIncomeFormula?: string;
    payeFormula?: string;
    effectiveTaxRatePct?: number;
    netPayFormula?: string;
    taxBandsApplied?: Array<{ band: string; rate: string; taxableAmount: number; tax: number }>;
  };
}

interface PayrollPeriod {
  id: string;
  payPeriod: string;
  branchId: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'payment_scheduled' | 'disbursed' | 'reconciled';
  totalGross: number;
  totalDeductions: number;
  totalNetPay: number;
  staffCount: number;
  eligibleCount?: number;
  calculatedCount?: number;
  attentionCount?: number;
  totalEmployeePension?: number;
  totalEmployerPension?: number;
  totalPayeTax?: number;
  totalNhf?: number;
  preparedBy?: string;
  preparedAt?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  paymentReference?: string | null;
  paymentStatus?: string;
  fundingAccount?: string | null;
  periodStart?: string;
  periodEnd?: string;
  paymentDate?: string;
  frequency?: string;
  history?: any[];
  lines?: PayrollLine[];
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

export const PayrollManagementHub: React.FC = () => {
  const { currentStaff, formatNaira } = useApp();

  // Primary State
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollPeriod | null>(null);
  const [staffAccounts, setStaffAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Modals & Panels
  const [isPrepareModalOpen, setIsPrepareModalOpen] = useState<boolean>(false);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState<boolean>(false);
  const [selectedStaffForBreakdown, setSelectedStaffForBreakdown] = useState<PayrollLine | null>(null);
  const [selectedStaffForPayslip, setSelectedStaffForPayslip] = useState<PayrollLine | null>(null);

  // Toast / Notification State (replaces window.alert)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Prepare Form State
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [prepPeriod, setPrepPeriod] = useState<string>(currentMonthStr);
  const [prepBranch, setPrepBranch] = useState<string>('all');
  const [prepFrequency, setPrepFrequency] = useState<'monthly' | 'bi-weekly'>('monthly');
  const [prepPeriodStart, setPrepPeriodStart] = useState<string>('');
  const [prepPeriodEnd, setPrepPeriodEnd] = useState<string>('');
  const [prepPaymentDate, setPrepPaymentDate] = useState<string>('');
  const [forceRecalculate, setForceRecalculate] = useState<boolean>(false);

  // Disburse Form State
  const [disbursePaymentRef, setDisbursePaymentRef] = useState<string>('');
  const [disburseFundingAccount, setDisburseFundingAccount] = useState<string>('1030');
  const [disburseNotes, setDisburseNotes] = useState<string>('');

  // Register Filtering & Search State
  const [registerSearch, setRegisterSearch] = useState<string>('');
  const [registerBranchFilter, setRegisterBranchFilter] = useState<string>('all');
  const [registerStatusFilter, setRegisterStatusFilter] = useState<string>('all');

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Sync dates when prepPeriod changes
  useEffect(() => {
    if (prepPeriod && /^\d{4}-\d{2}$/.test(prepPeriod)) {
      const [year, month] = prepPeriod.split('-').map(Number);
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDate = new Date(year, month, 0).getDate();
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
      const defaultPayDate = `${year}-${String(month).padStart(2, '0')}-28`;

      setPrepPeriodStart(firstDay);
      setPrepPeriodEnd(lastDay);
      setPrepPaymentDate(defaultPayDate);
    }
  }, [prepPeriod]);

  // Fetch Payroll Periods
  const fetchPayrollPeriods = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/payroll/periods', {
        headers: { Authorization: `Bearer ${localStorage.getItem('choplife_staff_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayrollPeriods(data || []);
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to load payroll batches', 'error');
      }
    } catch {
      showNotification('Unable to connect to payroll service.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Staff Accounts for pre-validation and reference
  const fetchStaffDirectory = async () => {
    try {
      const res = await fetch('/api/staff/accounts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('choplife_staff_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStaffAccounts(data || []);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchPayrollPeriods();
    fetchStaffDirectory();
  }, []);

  // Pre-validation stats for preparation modal
  const eligibleStaffStats = useMemo(() => {
    const activeStaff = staffAccounts.filter((s) => s.status !== 'suspended');
    const scoped = activeStaff.filter((s) => {
      if (prepBranch === 'all') return true;
      if (s.branchId === prepBranch) return true;
      if (Array.isArray(s.allowedBranchIds) && s.allowedBranchIds.includes(prepBranch)) return true;
      return false;
    });

    const completeCount = scoped.filter(
      (s) => s.payrollProfile && Number(s.payrollProfile.basicSalary) > 0 && s.payrollProfile.accountNumber
    ).length;
    const incompleteCount = scoped.length - completeCount;

    return { total: scoped.length, complete: completeCount, incomplete: incompleteCount };
  }, [staffAccounts, prepBranch]);

  // Check if chosen period & branch already exists
  const existingBatchMatch = useMemo(() => {
    return payrollPeriods.find(
      (p) => p.payPeriod === prepPeriod && (p.branchId === prepBranch || (p.branchId === 'all' && prepBranch === 'all'))
    );
  }, [payrollPeriods, prepPeriod, prepBranch]);

  // Open Detailed View for a Payroll Batch
  const handleOpenBatchDetails = async (id: string) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/finance/payroll/periods/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('choplife_staff_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedPayroll(data);
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to load batch register details', 'error');
      }
    } catch {
      showNotification('Network error loading payroll batch details', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Prepare Payroll Submission
  const handlePreparePayroll = async () => {
    if (!prepPeriod) {
      showNotification('Please select a valid payroll period (Month/Year).', 'error');
      return;
    }

    if (existingBatchMatch && ['approved', 'disbursed', 'reconciled'].includes(existingBatchMatch.status)) {
      showNotification(
        `Payroll for ${prepPeriod} has already been ${existingBatchMatch.status.toUpperCase()} and cannot be overwritten.`,
        'error'
      );
      return;
    }

    setIsActionLoading(true);
    try {
      const res = await fetch('/api/finance/payroll/prepare', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('choplife_staff_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payPeriod: prepPeriod,
          branchId: prepBranch,
          frequency: prepFrequency,
          periodStart: prepPeriodStart,
          periodEnd: prepPeriodEnd,
          paymentDate: prepPaymentDate,
          forceRecalculate,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showNotification(
          `Payroll batch for ${prepPeriod} prepared successfully with Nigerian statutory deductions.`,
          'success'
        );
        setIsPrepareModalOpen(false);
        setForceRecalculate(false);
        await fetchPayrollPeriods();
        if (data.payroll) {
          setSelectedPayroll(data.payroll);
        }
      } else {
        showNotification(data.error || 'Payroll calculation failed', 'error');
      }
    } catch {
      showNotification('Network connection error while preparing payroll.', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Approve Payroll Batch
  const handleApprovePayroll = async (batchId: string) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/finance/payroll/${batchId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('choplife_staff_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: 'Approved for executive disbursement after statutory verification.',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showNotification('Payroll batch approved successfully.', 'success');
        await fetchPayrollPeriods();
        if (selectedPayroll && selectedPayroll.id === batchId) {
          await handleOpenBatchDetails(batchId);
        }
      } else {
        showNotification(data.error || 'Failed to approve payroll batch', 'error');
      }
    } catch {
      showNotification('Network error while processing approval.', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Schedule Payment
  const handleSchedulePayment = async (batchId: string) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/finance/payroll/${batchId}/schedule-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('choplife_staff_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: 'Commercial bank bulk transfer schedule generated.',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showNotification('Payment schedule generated. Ready for commercial bank disbursement.', 'success');
        await fetchPayrollPeriods();
        if (selectedPayroll && selectedPayroll.id === batchId) {
          await handleOpenBatchDetails(batchId);
        }
      } else {
        showNotification(data.error || 'Failed to schedule payment', 'error');
      }
    } catch {
      showNotification('Network error while scheduling payment.', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Open Disburse Modal
  const handleInitiateDisbursement = (batch: PayrollPeriod) => {
    setDisbursePaymentRef(`PR-ZENITH-${batch.payPeriod.replace('-', '')}-${Date.now().toString().slice(-4)}`);
    setDisburseFundingAccount('1030');
    setDisburseNotes(`Automated statutory bulk salary disbursement for ${batch.payPeriod}`);
    setIsDisburseModalOpen(true);
  };

  // Confirm Disburse Funds
  const handleConfirmDisbursement = async () => {
    if (!selectedPayroll) return;
    if (!disbursePaymentRef.trim()) {
      showNotification('Please enter a bank payment reference.', 'error');
      return;
    }

    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/finance/payroll/${selectedPayroll.id}/disburse`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('choplife_staff_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentReference: disbursePaymentRef.trim(),
          fundingAccount: disburseFundingAccount,
          notes: disburseNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showNotification(
          `Payroll disbursed! Balanced General Ledger journal entry (${data.journalEntryNumber || 'Posted'}) created.`,
          'success'
        );
        setIsDisburseModalOpen(false);
        await fetchPayrollPeriods();
        await handleOpenBatchDetails(selectedPayroll.id);
      } else {
        showNotification(data.error || 'Disbursement failed', 'error');
      }
    } catch {
      showNotification('Network error processing disbursement.', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Reconcile Batch
  const handleReconcilePayroll = async (batchId: string) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/finance/payroll/${batchId}/reconcile`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('choplife_staff_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: 'Bank debit confirmation reconciled with staff register.',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showNotification('Payroll run reconciled with bank statements.', 'success');
        await fetchPayrollPeriods();
        if (selectedPayroll && selectedPayroll.id === batchId) {
          await handleOpenBatchDetails(batchId);
        }
      } else {
        showNotification(data.error || 'Reconciliation failed', 'error');
      }
    } catch {
      showNotification('Network error reconciling payroll.', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = (batch: PayrollPeriod) => {
    if (!batch.lines || batch.lines.length === 0) {
      showNotification('No staff lines available to export.', 'error');
      return;
    }

    const headers = [
      'Staff ID',
      'Full Name',
      'Role',
      'Branch',
      'Bank Name',
      'Account Number',
      'Account Name',
      'Basic Salary (NGN)',
      'Housing Allowance (NGN)',
      'Transport Allowance (NGN)',
      'Other Allowances (NGN)',
      'Gross Salary (NGN)',
      'Employee Pension 8% (NGN)',
      'Employer Pension 10% (NGN)',
      'NHF 2.5% (NGN)',
      'CRA Relief (NGN)',
      'Taxable Income (NGN)',
      'PAYE Tax (NGN)',
      'Total Deductions (NGN)',
      'Net Pay (NGN)',
      'Calculation Status',
      'Payment Status',
    ];

    const rows = batch.lines.map((l) => [
      `"${l.employeeId}"`,
      `"${l.staffName}"`,
      `"${l.role}"`,
      `"${l.branchId}"`,
      `"${l.bankName}"`,
      `"${l.accountNumberRaw || l.accountNumberMasked}"`,
      `"${l.accountName}"`,
      l.basicSalary,
      l.housingAllowance,
      l.transportAllowance,
      l.otherAllowances,
      l.grossSalary,
      l.employeePension,
      l.employerPension,
      l.nhfDeduction,
      l.craRelief,
      l.taxableIncome,
      l.payeTax,
      l.totalDeductions,
      l.netPay,
      `"${l.calculationStatus}"`,
      `"${l.paymentStatus}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Choplife_Payroll_${batch.payPeriod}_${batch.branchId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Payroll register exported to CSV.', 'success');
  };

  // Filtered Register Lines in Selected Batch
  const filteredLines = useMemo(() => {
    if (!selectedPayroll?.lines) return [];
    return selectedPayroll.lines.filter((l) => {
      const matchSearch =
        l.staffName.toLowerCase().includes(registerSearch.toLowerCase()) ||
        l.employeeId.toLowerCase().includes(registerSearch.toLowerCase()) ||
        l.role.toLowerCase().includes(registerSearch.toLowerCase());

      const matchBranch = registerBranchFilter === 'all' || l.branchId === registerBranchFilter;
      const matchStatus = registerStatusFilter === 'all' || l.calculationStatus === registerStatusFilter;

      return matchSearch && matchBranch && matchStatus;
    });
  }, [selectedPayroll, registerSearch, registerBranchFilter, registerStatusFilter]);

  // Overall Metrics across all periods
  const totalDisbursedAllTime = useMemo(() => {
    return payrollPeriods
      .filter((p) => ['disbursed', 'reconciled'].includes(p.status))
      .reduce((sum, p) => sum + (p.totalNetPay || 0), 0);
  }, [payrollPeriods]);

  const totalPayeAllTime = useMemo(() => {
    return payrollPeriods
      .filter((p) => ['disbursed', 'reconciled'].includes(p.status))
      .reduce((sum, p) => sum + (p.totalPayeTax || 0), 0);
  }, [payrollPeriods]);

  const totalPensionAllTime = useMemo(() => {
    return payrollPeriods
      .filter((p) => ['disbursed', 'reconciled'].includes(p.status))
      .reduce((sum, p) => sum + (p.totalEmployeePension || 0) + (p.totalEmployerPension || 0), 0);
  }, [payrollPeriods]);

  // Status Badge Styling Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <Check className="w-3 h-3 text-blue-600" /> Approved
          </span>
        );
      case 'payment_scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Calendar className="w-3 h-3 text-indigo-600" /> Payment Scheduled
          </span>
        );
      case 'disbursed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Disbursed & Paid
          </span>
        );
      case 'reconciled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <CheckCircle className="w-3 h-3 text-purple-600" /> Reconciled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-700">
            {status}
          </span>
        );
    }
  };

  // Check if current user is preparer of selected batch (Segregation of Duties)
  const isCurrentUserPreparer = useMemo(() => {
    if (!selectedPayroll || !currentStaff) return false;
    const prepId = selectedPayroll.metadata?.preparedByStaffId;
    return prepId === currentStaff.id && currentStaff.role !== 'super_admin';
  }, [selectedPayroll, currentStaff]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-5 right-5 z-[115] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold transition-all border ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : toast.type === 'error'
              ? 'bg-rose-900 text-rose-100 border-rose-700'
              : 'bg-[#4D080F] text-[#FAF7F2] border-[#800D15]'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-300 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />}
          {toast.type === 'info' && <Clock className="w-5 h-5 text-amber-300 shrink-0" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5DEC9] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-[#4D080F] tracking-tight">
              Payroll Management
            </h1>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-[#4D080F]/10 text-[#4D080F] uppercase">
              Statutory Compliant
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 font-medium mt-1">
            Enterprise compensation processing, Nigerian statutory deductions (PAYE, Pension 8/10%, NHF 2.5%), and
            General Ledger disbursements.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPayrollPeriods}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#E5DEC9] bg-white text-stone-700 hover:bg-stone-50 text-xs font-bold transition shadow-2xs"
            title="Refresh payroll batches"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsPrepareModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] text-xs font-bold transition shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Prepare Payroll Run</span>
          </button>
        </div>
      </div>

      {/* VIEW: BATCH REGISTER DETAILS */}
      {selectedPayroll ? (
        <div className="space-y-6">
          {/* Breadcrumb / Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5DEC9] shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedPayroll(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Batches</span>
              </button>
              <div className="h-4 w-px bg-stone-200" />
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#4D080F] flex items-center gap-2">
                  <span>Batch: {selectedPayroll.payPeriod}</span>
                  <span className="text-xs text-stone-500 font-normal">
                    ({selectedPayroll.branchId === 'all' ? 'Consolidated All Branches' : selectedPayroll.branchId.toUpperCase()})
                  </span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {renderStatusBadge(selectedPayroll.status)}

              {/* Segregation of Duties Notice */}
              {isCurrentUserPreparer && selectedPayroll.status === 'pending_approval' && (
                <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  Segregation of Duties: Approver must be distinct from preparer
                </span>
              )}

              {/* Approve Action */}
              {selectedPayroll.status === 'pending_approval' && (
                <button
                  onClick={() => handleApprovePayroll(selectedPayroll.id)}
                  disabled={isActionLoading || isCurrentUserPreparer}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 ${
                    isCurrentUserPreparer
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                      : 'bg-emerald-800 text-white hover:bg-emerald-900'
                  }`}
                  title={isCurrentUserPreparer ? 'Cannot approve own batch' : 'Approve payroll batch'}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Batch</span>
                </button>
              )}

              {/* Schedule Payment Action */}
              {selectedPayroll.status === 'approved' && (
                <button
                  onClick={() => handleSchedulePayment(selectedPayroll.id)}
                  disabled={isActionLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-800 text-white hover:bg-indigo-900 text-xs font-bold transition shadow-2xs flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule Bulk Payment</span>
                </button>
              )}

              {/* Disburse Action */}
              {['approved', 'payment_scheduled'].includes(selectedPayroll.status) && (
                <button
                  onClick={() => handleInitiateDisbursement(selectedPayroll)}
                  disabled={isActionLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] text-xs font-bold transition shadow-2xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Disburse Funds (GL Post)</span>
                </button>
              )}

              {/* Reconcile Action */}
              {selectedPayroll.status === 'disbursed' && (
                <button
                  onClick={() => handleReconcilePayroll(selectedPayroll.id)}
                  disabled={isActionLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-800 text-white hover:bg-purple-900 text-xs font-bold transition shadow-2xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Reconcile Bank Statement</span>
                </button>
              )}

              {/* CSV Export */}
              <button
                onClick={() => handleExportCsv(selectedPayroll)}
                className="px-3 py-1.5 rounded-xl border border-[#E5DEC9] bg-white text-stone-700 hover:bg-stone-50 text-xs font-bold transition shadow-2xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Attention Required Banner if any staff has incomplete salary profile */}
          {selectedPayroll.attentionCount && selectedPayroll.attentionCount > 0 ? (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <span className="font-bold text-sm block">
                  Action Required: {selectedPayroll.attentionCount} staff profile(s) lack configured compensation
                </span>
                <p>
                  Employees flagged with "Attention Required" have been assigned ₦0 net pay until their basic salary and bank details are entered in the Staff Directory.
                  Once updated, you can recalculate the batch to reflect the changes.
                </p>
              </div>
            </div>
          ) : null}

          {/* Batch Financial Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] shadow-2xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Total Gross</span>
              <p className="text-base sm:text-lg font-black text-[#4D080F] mt-1">
                {formatNaira(selectedPayroll.totalGross || 0)}
              </p>
              <span className="text-[10px] text-stone-400">Total remuneration</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] shadow-2xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Employee Pension (8%)</span>
              <p className="text-base sm:text-lg font-black text-stone-800 mt-1">
                {formatNaira(selectedPayroll.totalEmployeePension || 0)}
              </p>
              <span className="text-[10px] text-stone-400">Statutory deduction</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] shadow-2xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Employer Pension (10%)</span>
              <p className="text-base sm:text-lg font-black text-stone-800 mt-1">
                {formatNaira(selectedPayroll.totalEmployerPension || 0)}
              </p>
              <span className="text-[10px] text-stone-400">Company obligation</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] shadow-2xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">PAYE Tax Liability</span>
              <p className="text-base sm:text-lg font-black text-rose-800 mt-1">
                {formatNaira(selectedPayroll.totalPayeTax || 0)}
              </p>
              <span className="text-[10px] text-stone-400">State IRS remittance</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] shadow-2xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Total Deductions</span>
              <p className="text-base sm:text-lg font-black text-stone-800 mt-1">
                {formatNaira(selectedPayroll.totalDeductions || 0)}
              </p>
              <span className="text-[10px] text-stone-400">Pension + NHF + Tax</span>
            </div>

            <div className="bg-[#4D080F] p-4 rounded-2xl border border-[#800D15] shadow-2xs text-[#FAF7F2]">
              <span className="text-[11px] font-bold text-[#FFC700] uppercase tracking-wider block">Total Net Payable</span>
              <p className="text-base sm:text-lg font-black text-[#FFC700] mt-1">
                {formatNaira(selectedPayroll.totalNetPay || 0)}
              </p>
              <span className="text-[10px] text-stone-300">Take-home payout</span>
            </div>
          </div>

          {/* Batch Audit Trail Info Strip */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#E5DEC9] text-xs text-stone-600 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-4 flex-wrap">
              <span>
                <strong className="text-stone-800">Prepared By:</strong> {selectedPayroll.preparedBy || 'System Admin'} (
                {selectedPayroll.preparedAt ? new Date(selectedPayroll.preparedAt).toLocaleDateString('en-GB') : 'N/A'})
              </span>
              <span>
                <strong className="text-stone-800">Approved By:</strong> {selectedPayroll.approvedBy || 'Pending Review'}
              </span>
              {selectedPayroll.paymentReference && (
                <span>
                  <strong className="text-stone-800">Bank Reference:</strong> {selectedPayroll.paymentReference}
                </span>
              )}
            </div>
            <div className="text-[11px] text-stone-500">
              Coverage: {selectedPayroll.lines?.length || 0} employees registered
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E5DEC9] shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by staff name, ID or role..."
                value={registerSearch}
                onChange={(e) => setRegisterSearch(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-800 focus:outline-hidden focus:border-[#4D080F]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={registerBranchFilter}
                onChange={(e) => setRegisterBranchFilter(e.target.value)}
                className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-stone-700"
              >
                <option value="all">All Branches</option>
                <option value="gra">GRA Flagship</option>
                <option value="okabere">Okabere Branch</option>
                <option value="ugbowo">Ugbowo Branch</option>
              </select>

              <select
                value={registerStatusFilter}
                onChange={(e) => setRegisterStatusFilter(e.target.value)}
                className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-stone-700"
              >
                <option value="all">All Calculation Statuses</option>
                <option value="calculated">Calculated Only</option>
                <option value="attention_required">Attention Required</option>
              </select>
            </div>
          </div>

          {/* Employee Register Table */}
          <div className="bg-white rounded-3xl border border-[#E5DEC9] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] text-stone-700 font-bold border-b border-[#E5DEC9]">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3">Branch & Role</th>
                    <th className="py-3 px-3 text-right">Basic (₦)</th>
                    <th className="py-3 px-3 text-right">Allowances (₦)</th>
                    <th className="py-3 px-3 text-right">Gross (₦)</th>
                    <th className="py-3 px-3 text-right">Pension 8% (₦)</th>
                    <th className="py-3 px-3 text-right">PAYE Tax (₦)</th>
                    <th className="py-3 px-3 text-right">Total Deductions</th>
                    <th className="py-3 px-3 text-right text-[#4D080F] font-black">Net Pay (₦)</th>
                    <th className="py-3 px-3">Bank Details</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DEC9]">
                  {filteredLines.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-stone-400 font-medium">
                        No staff records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLines.map((line) => {
                      const totalAllowances =
                        (line.housingAllowance || 0) + (line.transportAllowance || 0) + (line.otherAllowances || 0);

                      return (
                        <tr key={line.staffId} className="hover:bg-stone-50 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-stone-900">{line.staffName}</div>
                            <div className="text-[10px] text-stone-500 font-mono">{line.employeeId}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="capitalize font-semibold text-stone-800 block">
                              {line.role.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-stone-500 uppercase">{line.branchId}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-stone-700">
                            {formatNaira(line.basicSalary)}
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-stone-700">
                            {formatNaira(totalAllowances)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-stone-900">
                            {formatNaira(line.grossSalary)}
                          </td>
                          <td className="py-3 px-3 text-right text-stone-700 font-medium">
                            {formatNaira(line.employeePension)}
                          </td>
                          <td className="py-3 px-3 text-right text-rose-800 font-medium">
                            {formatNaira(line.payeTax)}
                          </td>
                          <td className="py-3 px-3 text-right text-stone-700 font-medium">
                            {formatNaira(line.totalDeductions)}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-[#4D080F] text-sm">
                            {formatNaira(line.netPay)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-stone-800">{line.bankName}</div>
                            <div className="text-[10px] text-stone-500 font-mono">{line.accountNumberMasked}</div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {line.calculationStatus === 'calculated' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Calculated
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title={line.exceptionReason}>
                                Attention Req.
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedStaffForBreakdown(line)}
                                className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9] text-[11px] font-bold transition"
                                title="View statutory calculation steps"
                              >
                                Math Breakdown
                              </button>
                              <button
                                onClick={() => setSelectedStaffForPayslip(line)}
                                className="px-2 py-1 rounded-lg bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] text-[11px] font-bold transition flex items-center gap-1"
                                title="Generate printable employee payslip"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Payslip</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW: PAYROLL PERIODS DASHBOARD */
        <div className="space-y-6">
          {/* Top Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-[#E5DEC9] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Disbursed</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-800">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-[#4D080F] mt-2">{formatNaira(totalDisbursedAllTime)}</p>
              <p className="text-[11px] text-stone-500 mt-1">Across all reconciled payroll runs</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#E5DEC9] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">PAYE Tax Remitted</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-800">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-stone-900 mt-2">{formatNaira(totalPayeAllTime)}</p>
              <p className="text-[11px] text-stone-500 mt-1">State Internal Revenue Service</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#E5DEC9] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Pension Obligation</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-800">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-stone-900 mt-2">{formatNaira(totalPensionAllTime)}</p>
              <p className="text-[11px] text-stone-500 mt-1">Employee 8% + Employer 10%</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#E5DEC9] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Configured Staff</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-800">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-stone-900 mt-2">{staffAccounts.length}</p>
              <p className="text-[11px] text-stone-500 mt-1">Registered staff members in directory</p>
            </div>
          </div>

          {/* Active & Historical Payroll Runs Table */}
          <div className="bg-white rounded-3xl border border-[#E5DEC9] shadow-xs overflow-hidden">
            <div className="p-5 border-b border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#4D080F]">Payroll Batches Register</h2>
                <p className="text-xs text-stone-500">
                  Review calculation statuses, pending approvals, and executed bank disbursement batches.
                </p>
              </div>
              <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-3 py-1 rounded-full">
                {payrollPeriods.length} Batches Registered
              </span>
            </div>

            {payrollPeriods.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] text-[#4D080F] flex items-center justify-center mx-auto">
                  <Calendar className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-stone-900">No payroll periods have been created yet</h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    Prepare a new payroll run for the current month. The system will pull individual salary profiles from
                    the Staff Directory and calculate statutory Nigerian deductions.
                  </p>
                </div>
                <button
                  onClick={() => setIsPrepareModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] text-xs font-bold transition shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Prepare New Payroll Run</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#FAF7F2] text-stone-700 font-bold border-b border-[#E5DEC9]">
                      <th className="py-3.5 px-4">Period</th>
                      <th className="py-3.5 px-3">Scope</th>
                      <th className="py-3.5 px-3">Status</th>
                      <th className="py-3.5 px-3 text-right">Headcount</th>
                      <th className="py-3.5 px-3 text-right">Gross Total (₦)</th>
                      <th className="py-3.5 px-3 text-right">Deductions (₦)</th>
                      <th className="py-3.5 px-3 text-right text-[#4D080F] font-black">Net Total (₦)</th>
                      <th className="py-3.5 px-3">Prepared By</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DEC9]">
                    {payrollPeriods.map((period) => (
                      <tr key={period.id} className="hover:bg-stone-50 transition">
                        <td className="py-3.5 px-4 font-bold text-stone-900 text-sm">
                          {period.payPeriod}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="capitalize font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md text-[11px]">
                            {period.branchId === 'all' ? 'All Branches' : period.branchId.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">{renderStatusBadge(period.status)}</td>
                        <td className="py-3.5 px-3 text-right font-medium text-stone-800">
                          {period.staffCount || period.lines?.length || 0} Staff
                        </td>
                        <td className="py-3.5 px-3 text-right font-medium text-stone-700">
                          {formatNaira(period.totalGross)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-medium text-stone-700">
                          {formatNaira(period.totalDeductions)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-black text-[#4D080F] text-sm">
                          {formatNaira(period.totalNetPay)}
                        </td>
                        <td className="py-3.5 px-3 text-stone-600">
                          <span className="font-medium text-stone-800 block">{period.preparedBy || 'System Admin'}</span>
                          <span className="text-[10px] text-stone-400">
                            {period.createdAt ? new Date(period.createdAt).toLocaleDateString('en-GB') : ''}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenBatchDetails(period.id)}
                              className="px-3 py-1.5 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Register</span>
                            </button>

                            {period.status === 'pending_approval' && (
                              <button
                                onClick={() => handleApprovePayroll(period.id)}
                                disabled={isActionLoading}
                                className="px-3 py-1.5 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-bold transition shadow-2xs"
                                title="Approve payroll batch"
                              >
                                Approve
                              </button>
                            )}

                            {['approved', 'payment_scheduled'].includes(period.status) && (
                              <button
                                onClick={() => {
                                  setSelectedPayroll(period);
                                  handleInitiateDisbursement(period);
                                }}
                                disabled={isActionLoading}
                                className="px-3 py-1.5 rounded-xl bg-blue-800 text-white hover:bg-blue-900 text-xs font-bold transition shadow-2xs"
                                title="Disburse payroll"
                              >
                                Disburse
                              </button>
                            )}

                            <button
                              onClick={() => handleExportCsv(period)}
                              className="p-1.5 rounded-xl border border-[#E5DEC9] bg-white text-stone-700 hover:bg-stone-100 transition shadow-2xs"
                              title="Export CSV"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rider Payments & Dispatch Compensation Matrix */}
          <RiderPaymentsAndRatesPanel
            onShowToast={(type, message) => setToast({ type, message })}
          />

          {/* Salary Advances, Staff Loans, Fines & Variable Adjustments */}
          <PayrollAdjustmentsAndLoansPanel
            defaultPeriod={prepPeriod}
            onShowToast={(type, message) => setToast({ type, message })}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: PREPARE NEW PAYROLL RUN */}
      {/* ===================================================================== */}
      {isPrepareModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 space-y-5 border border-[#E5DEC9] shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div>
                <h3 className="text-lg font-black text-[#4D080F]">Prepare New Payroll Run</h3>
                <p className="text-xs text-stone-500">
                  Configure the period scope to generate statutory calculations from individual staff profiles.
                </p>
              </div>
              <button
                onClick={() => setIsPrepareModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Period & Scope Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Pay Period (Month & Year) *</label>
                  <input
                    type="month"
                    value={prepPeriod}
                    onChange={(e) => setPrepPeriod(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Target Branch Scope *</label>
                  <select
                    value={prepBranch}
                    onChange={(e) => setPrepBranch(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-hidden focus:border-[#4D080F]"
                  >
                    <option value="all">All Branches (Consolidated Republic)</option>
                    <option value="gra">GRA Flagship (Okogo St)</option>
                    <option value="okabere">Okabere Branch</option>
                    <option value="ugbowo">Ugbowo Branch</option>
                  </select>
                </div>
              </div>

              {/* Frequency & Dates Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Frequency</label>
                  <select
                    value={prepFrequency}
                    onChange={(e) => setPrepFrequency(e.target.value as any)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-[#4D080F]"
                  >
                    <option value="monthly">Monthly Remuneration</option>
                    <option value="bi-weekly">Bi-Weekly</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Period Start</label>
                  <input
                    type="date"
                    value={prepPeriodStart}
                    onChange={(e) => setPrepPeriodStart(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Period End</label>
                  <input
                    type="date"
                    value={prepPeriodEnd}
                    onChange={(e) => setPrepPeriodEnd(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Scheduled Payment Date</label>
                <input
                  type="date"
                  value={prepPaymentDate}
                  onChange={(e) => setPrepPaymentDate(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              {/* Pre-validation & Eligible Staff Summary Card */}
              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#4D080F]" />
                    <span>Eligible Staff Pre-Check</span>
                  </span>
                  <span className="text-stone-500 font-mono text-[11px]">
                    Scope: {prepBranch === 'all' ? 'All Branches' : prepBranch.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-white p-2 rounded-xl border border-[#E5DEC9]">
                    <span className="text-[10px] text-stone-500 uppercase block font-semibold">Total Eligible</span>
                    <span className="text-sm font-black text-stone-900">{eligibleStaffStats.total}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-[#E5DEC9]">
                    <span className="text-[10px] text-emerald-700 uppercase block font-semibold">Configured</span>
                    <span className="text-sm font-black text-emerald-800">{eligibleStaffStats.complete}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-[#E5DEC9]">
                    <span className="text-[10px] text-amber-700 uppercase block font-semibold">Incomplete</span>
                    <span className="text-sm font-black text-amber-800">{eligibleStaffStats.incomplete}</span>
                  </div>
                </div>

                {eligibleStaffStats.incomplete > 0 && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200">
                    {eligibleStaffStats.incomplete} staff member(s) do not have basic salary or bank accounts defined in Staff Directory.
                    They will be held at ₦0 until completed.
                  </p>
                )}
              </div>

              {/* Duplicate Batch Warning & Recalculate Option */}
              {existingBatchMatch && (
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-300 space-y-2 text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>Batch already exists for this period ({existingBatchMatch.status.toUpperCase()})</span>
                  </div>
                  <p className="text-[11px]">
                    {existingBatchMatch.status === 'pending_approval'
                      ? 'You can force recalculation to update figures with latest staff directory changes.'
                      : 'This payroll batch is already finalized or disbursed. Finalized batches cannot be recalculated.'}
                  </p>
                  {existingBatchMatch.status === 'pending_approval' && (
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-900 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={forceRecalculate}
                        onChange={(e) => setForceRecalculate(e.target.checked)}
                        className="rounded-sm border-amber-400 text-[#4D080F] focus:ring-[#4D080F]"
                      />
                      <span>Force Recalculate with latest Staff Compensation Profiles</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5DEC9]">
              <button
                type="button"
                onClick={() => setIsPrepareModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePreparePayroll}
                disabled={isActionLoading || (existingBatchMatch && existingBatchMatch.status !== 'pending_approval')}
                className="px-5 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] font-bold text-xs transition shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isActionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Calculating Statutory Deductions...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Generate Payroll Run</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CALCULATION AUDIT TRANSPARENCY MODAL */}
      {/* ===================================================================== */}
      {selectedStaffForBreakdown && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 space-y-5 border border-[#E5DEC9] shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div>
                <h3 className="text-lg font-black text-[#4D080F]">Statutory Calculation Breakdown</h3>
                <p className="text-xs text-stone-500">
                  Pension Reform Act 2014 & Nigerian Personal Income Tax Act (PITA) graduated tax audit.
                </p>
              </div>
              <button
                onClick={() => setSelectedStaffForBreakdown(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Employee Banner */}
            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-stone-900">{selectedStaffForBreakdown.staffName}</h4>
                <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                  <span className="font-mono">{selectedStaffForBreakdown.employeeId}</span>
                  <span>•</span>
                  <span className="capitalize">{selectedStaffForBreakdown.role.replace('_', ' ')}</span>
                  <span>•</span>
                  <span className="uppercase">{selectedStaffForBreakdown.branchId}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-stone-500 uppercase block font-semibold">Net Payout</span>
                <span className="text-xl font-black text-[#4D080F]">
                  {formatNaira(selectedStaffForBreakdown.netPay)}
                </span>
              </div>
            </div>

            {/* Step-by-Step Statutory Breakdown */}
            <div className="space-y-3 text-xs">
              {/* Step 1: Gross Remuneration */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DEC9] space-y-1.5 shadow-2xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#4D080F]">Step 1: Gross Earnings Composition</span>
                  <span className="font-black text-stone-900">{formatNaira(selectedStaffForBreakdown.grossSalary)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                  <div className="bg-stone-50 p-2 rounded-xl">
                    <span className="text-stone-500 block">Basic Salary</span>
                    <strong className="text-stone-800">{formatNaira(selectedStaffForBreakdown.basicSalary)}</strong>
                  </div>
                  <div className="bg-stone-50 p-2 rounded-xl">
                    <span className="text-stone-500 block">Housing Allowance</span>
                    <strong className="text-stone-800">{formatNaira(selectedStaffForBreakdown.housingAllowance)}</strong>
                  </div>
                  <div className="bg-stone-50 p-2 rounded-xl">
                    <span className="text-stone-500 block">Transport Allowance</span>
                    <strong className="text-stone-800">{formatNaira(selectedStaffForBreakdown.transportAllowance)}</strong>
                  </div>
                  <div className="bg-stone-50 p-2 rounded-xl">
                    <span className="text-stone-500 block">Other Allowances</span>
                    <strong className="text-stone-800">{formatNaira(selectedStaffForBreakdown.otherAllowances)}</strong>
                  </div>
                </div>
              </div>

              {/* Step 2: Pension Computation */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DEC9] space-y-1.5 shadow-2xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#4D080F]">
                    Step 2: Pension Contributions (Pension Reform Act 2014)
                  </span>
                  <span className="font-black text-stone-900">
                    Employee: {formatNaira(selectedStaffForBreakdown.employeePension)}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">
                  Pensionable Base (Basic + Housing + Transport) ={' '}
                  {formatNaira(
                    selectedStaffForBreakdown.basicSalary +
                      selectedStaffForBreakdown.housingAllowance +
                      selectedStaffForBreakdown.transportAllowance
                  )}
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="bg-stone-50 p-2 rounded-xl">
                    <span className="text-stone-500 block">Employee Contribution (8% deducted)</span>
                    <strong className="text-stone-900">{formatNaira(selectedStaffForBreakdown.employeePension)}</strong>
                  </div>
                  <div className="bg-stone-50 p-2 rounded-xl">
                    <span className="text-stone-500 block">Employer Contribution (10% accrued)</span>
                    <strong className="text-blue-900">{formatNaira(selectedStaffForBreakdown.employerPension)}</strong>
                  </div>
                </div>
              </div>

              {/* Step 3: NHF */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DEC9] space-y-1.5 shadow-2xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#4D080F]">Step 3: National Housing Fund (NHF)</span>
                  <span className="font-black text-stone-900">{formatNaira(selectedStaffForBreakdown.nhfDeduction)}</span>
                </div>
                <p className="text-[11px] text-stone-600">
                  2.5% statutory contribution of monthly basic salary ({formatNaira(selectedStaffForBreakdown.basicSalary)} × 2.5%).
                </p>
              </div>

              {/* Step 4: Consolidated Relief Allowance (CRA) */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DEC9] space-y-1.5 shadow-2xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#4D080F]">Step 4: Consolidated Relief Allowance (CRA)</span>
                  <span className="font-black text-emerald-800">{formatNaira(selectedStaffForBreakdown.craRelief)}</span>
                </div>
                <p className="text-[11px] text-stone-600">
                  Higher of ₦16,667 (₦200,000/12) or 1% of gross + 20% of gross earnings.
                </p>
              </div>

              {/* Step 5 & 6: Taxable Income & Graduated PAYE */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DEC9] space-y-2 shadow-2xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#4D080F]">Step 5 & 6: Chargeable Income & Graduated PAYE Tax</span>
                  <span className="font-black text-rose-800">{formatNaira(selectedStaffForBreakdown.payeTax)}</span>
                </div>
                <div className="bg-stone-50 p-2.5 rounded-xl text-[11px] flex justify-between">
                  <span>Chargeable Taxable Income (Gross - Pension - NHF - CRA):</span>
                  <strong className="text-stone-900">{formatNaira(selectedStaffForBreakdown.taxableIncome)}</strong>
                </div>

                <div className="text-[11px] text-stone-600 space-y-1 border-t border-stone-200 pt-2">
                  <span className="font-semibold text-stone-800 block">Graduated Tax Bands Applied:</span>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <div className="bg-stone-50 p-1.5 rounded-md">Band 1: 1st ₦25,000 @ 7%</div>
                    <div className="bg-stone-50 p-1.5 rounded-md">Band 2: Next ₦25,000 @ 11%</div>
                    <div className="bg-stone-50 p-1.5 rounded-md">Band 3: Next ₦41,667 @ 15%</div>
                    <div className="bg-stone-50 p-1.5 rounded-md">Band 4: Next ₦41,667 @ 19%</div>
                    <div className="bg-stone-50 p-1.5 rounded-md">Band 5: Next ₦133,333 @ 21%</div>
                    <div className="bg-stone-50 p-1.5 rounded-md">Band 6: Remainder @ 24%</div>
                  </div>
                  {selectedStaffForBreakdown.calculationBreakdown?.effectiveTaxRatePct !== undefined && (
                    <p className="text-[10px] text-stone-500 pt-1">
                      Effective Tax Rate: {selectedStaffForBreakdown.calculationBreakdown.effectiveTaxRatePct.toFixed(1)}% of gross
                    </p>
                  )}
                </div>
              </div>

              {/* Step 7: Net Pay Summary */}
              <div className="p-4 rounded-2xl bg-[#4D080F] text-[#FAF7F2] space-y-2">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-[#FFC700]">Step 7: Net Take-Home Pay</span>
                  <span className="text-[#FFC700] text-lg font-black">
                    {formatNaira(selectedStaffForBreakdown.netPay)}
                  </span>
                </div>
                <p className="text-[11px] text-stone-300">
                  Gross ({formatNaira(selectedStaffForBreakdown.grossSalary)}) − Total Statutory Deductions (
                  {formatNaira(selectedStaffForBreakdown.totalDeductions)}) = {formatNaira(selectedStaffForBreakdown.netPay)}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStaffForBreakdown(null)}
                className="px-5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: PRINTABLE EMPLOYEE PAYSLIP MODAL */}
      {/* ===================================================================== */}
      {selectedStaffForPayslip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-8 space-y-6 border border-[#E5DEC9] shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-4 print:hidden">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Official Staff Payslip Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Payslip</span>
                </button>
                <button
                  onClick={() => setSelectedStaffForPayslip(null)}
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Payslip Document Container (Designed for clean paper & print output) */}
            <div className="border border-stone-300 rounded-2xl p-6 bg-white space-y-6 print:border-none print:p-0">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-stone-300 pb-4">
                <div>
                  <h2 className="text-xl font-black text-[#4D080F] tracking-tight">CHOPLIFE REPUBLIC</h2>
                  <p className="text-xs text-stone-600 font-medium">Authentic Nigerian Cuisine & Lounge Operations</p>
                  <p className="text-[11px] text-stone-400">GRA Flagship • Okabere • Ugbowo, Benin City, Edo State</p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#FAF7F2] border border-[#E5DEC9] text-[#4D080F] uppercase block">
                    Payslip
                  </span>
                  <span className="text-xs font-bold text-stone-800 mt-1 block">
                    {selectedPayroll?.payPeriod || currentMonthStr}
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    Issued: {new Date().toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>

              {/* Employee & Bank Information Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-[#FAF7F2] p-4 rounded-xl border border-[#E5DEC9]">
                <div className="space-y-1">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Employee Name</span>
                    <strong className="text-stone-900 text-sm">{selectedStaffForPayslip.staffName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Staff ID</span>
                    <span className="font-mono text-stone-700 font-bold">{selectedStaffForPayslip.employeeId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Department & Role</span>
                    <span className="capitalize text-stone-800">{selectedStaffForPayslip.role.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Operating Branch</span>
                    <span className="uppercase text-stone-800 font-bold">{selectedStaffForPayslip.branchId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Bank & Account</span>
                    <span className="text-stone-800 font-medium">
                      {selectedStaffForPayslip.bankName} • {selectedStaffForPayslip.accountNumberMasked}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Disbursement Status</span>
                    <span className="inline-block font-bold text-emerald-800 capitalize">
                      {selectedStaffForPayslip.paymentStatus === 'paid' ? 'Paid / Direct Transfer' : 'Approved for Disbursal'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions Two-Column Grid */}
              <div className="grid grid-cols-2 gap-6 text-xs">
                {/* Earnings Column */}
                <div className="space-y-2">
                  <div className="border-b-2 border-stone-800 pb-1 font-bold text-stone-800 uppercase text-[11px]">
                    Earnings (₦)
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-stone-600">Basic Salary</span>
                    <span className="font-semibold text-stone-900">{formatNaira(selectedStaffForPayslip.basicSalary)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-stone-600">Housing Allowance</span>
                    <span className="font-semibold text-stone-900">
                      {formatNaira(selectedStaffForPayslip.housingAllowance)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-stone-600">Transport Allowance</span>
                    <span className="font-semibold text-stone-900">
                      {formatNaira(selectedStaffForPayslip.transportAllowance)}
                    </span>
                  </div>
                  {selectedStaffForPayslip.otherAllowances > 0 && (
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-600">Other Allowances</span>
                      <span className="font-semibold text-stone-900">
                        {formatNaira(selectedStaffForPayslip.otherAllowances)}
                      </span>
                    </div>
                  )}
                  {(selectedStaffForPayslip.riderDeliveryBonus || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-600">
                        Rider Delivery Commission ({selectedStaffForPayslip.riderCompletedDeliveries || 0} trips)
                      </span>
                      <span className="font-semibold text-emerald-800">
                        {formatNaira(selectedStaffForPayslip.riderDeliveryBonus || 0)}
                      </span>
                    </div>
                  )}
                  {(selectedStaffForPayslip.periodBonuses || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-600">Period Bonuses / Overtime</span>
                      <span className="font-semibold text-emerald-800">
                        {formatNaira(selectedStaffForPayslip.periodBonuses || 0)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-t-2 border-stone-300 font-bold text-stone-900 text-sm">
                    <span>Total Gross Pay</span>
                    <span>{formatNaira(selectedStaffForPayslip.grossSalary)}</span>
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="space-y-2">
                  <div className="border-b-2 border-stone-800 pb-1 font-bold text-stone-800 uppercase text-[11px]">
                    Statutory & Other Deductions (₦)
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-stone-600">Employee Pension (8%)</span>
                    <span className="font-semibold text-stone-900">
                      {formatNaira(selectedStaffForPayslip.employeePension)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-stone-600">NHF Contribution (2.5%)</span>
                    <span className="font-semibold text-stone-900">{formatNaira(selectedStaffForPayslip.nhfDeduction)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-stone-600">PAYE Personal Income Tax</span>
                    <span className="font-semibold text-rose-800">{formatNaira(selectedStaffForPayslip.payeTax)}</span>
                  </div>
                  {(selectedStaffForPayslip.periodDeductions || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-600">Loans / Advances / Fines</span>
                      <span className="font-semibold text-rose-800">
                        {formatNaira(selectedStaffForPayslip.periodDeductions || 0)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-t-2 border-stone-300 font-bold text-stone-900 text-sm">
                    <span>Total Deductions</span>
                    <span>{formatNaira(selectedStaffForPayslip.totalDeductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Callout */}
              <div className="bg-[#4D080F] text-[#FAF7F2] p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold text-[#FFC700] block">
                    Net Take-Home Pay
                  </span>
                  <span className="text-[11px] text-stone-300">Credited to employee bank account</span>
                </div>
                <div className="text-2xl font-black text-[#FFC700]">{formatNaira(selectedStaffForPayslip.netPay)}</div>
              </div>

              {/* Employer Contribution Remark */}
              <div className="text-[10px] text-stone-500 border-t border-stone-200 pt-3 flex justify-between items-center">
                <span>
                  Employer Statutory Pension Contribution (10%): {formatNaira(selectedStaffForPayslip.employerPension)} (Paid by
                  company directly to PFA)
                </span>
                <span>Confidential Document</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 print:hidden">
              <button
                onClick={() => setSelectedStaffForPayslip(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: DISBURSE FUNDS & GL POSTING */}
      {/* ===================================================================== */}
      {isDisburseModalOpen && selectedPayroll && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-5 border border-[#E5DEC9] shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div>
                <h3 className="text-lg font-black text-[#4D080F]">Confirm Payroll Disbursement</h3>
                <p className="text-xs text-stone-500">
                  Execute bulk payment and post balanced double-entry accounting records into the General Ledger.
                </p>
              </div>
              <button
                onClick={() => setIsDisburseModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Batch Overview Box */}
              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-800">Batch Period: {selectedPayroll.payPeriod}</span>
                  <span className="font-black text-[#4D080F] text-base">{formatNaira(selectedPayroll.totalNetPay)}</span>
                </div>
                <div className="flex justify-between text-stone-600 text-[11px]">
                  <span>Total Gross: {formatNaira(selectedPayroll.totalGross)}</span>
                  <span>Headcount: {selectedPayroll.lines?.length || 0} Staff</span>
                </div>
              </div>

              {/* Funding Account Selection */}
              <div>
                <label className="font-bold text-stone-700 block mb-1">Funding Bank Account *</label>
                <select
                  value={disburseFundingAccount}
                  onChange={(e) => setDisburseFundingAccount(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-hidden focus:border-[#4D080F]"
                >
                  <option value="1030">1030 - Zenith Bank Main Operations Account</option>
                  <option value="1031">1031 - Access Bank Operating Account</option>
                  <option value="1010">1010 - Central Cash Vault</option>
                </select>
              </div>

              {/* Payment Reference */}
              <div>
                <label className="font-bold text-stone-700 block mb-1">Bank Payment Reference / Batch Ref *</label>
                <input
                  type="text"
                  value={disbursePaymentRef}
                  onChange={(e) => setDisbursePaymentRef(e.target.value)}
                  placeholder="e.g. PR-ZENITH-202611-BATCH01"
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              {/* Disbursement Notes */}
              <div>
                <label className="font-bold text-stone-700 block mb-1">Audit Notes</label>
                <input
                  type="text"
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  placeholder="Audit trail memo..."
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              {/* Accounting Impact Notice */}
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-blue-900 text-[11px] space-y-1">
                <span className="font-bold block">Double-Entry General Ledger Integration</span>
                <p>
                  Disbursement generates balanced debits to Gross Salary Expense (6010) & Employer Pension Expense (6020),
                  and credits to Bank Account ({disburseFundingAccount}), PAYE Tax Payable (2020), and Pension Payable (2030).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5DEC9]">
              <button
                type="button"
                onClick={() => setIsDisburseModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisbursement}
                disabled={isActionLoading}
                className="px-5 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] font-bold text-xs transition shadow-md flex items-center gap-2"
              >
                {isActionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Posting to GL & Disbursing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm & Post Disbursement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
