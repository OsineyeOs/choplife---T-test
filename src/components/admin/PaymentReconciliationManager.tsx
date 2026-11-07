import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Sparkles,
  Check,
  X,
  Plus,
  Smartphone,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface PaymentReconciliationManagerProps {
  onClose?: () => void;
}

export const PaymentReconciliationManager: React.FC<PaymentReconciliationManagerProps> = () => {
  const { formatNaira, selectedBranchId } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'bank_transfer' | 'card' | 'pos_terminal' | 'unmatched'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reconciliation_required' | 'paid' | 'failed'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>({
    totalCount: 0,
    pendingBankTransfers: 0,
    unmatchedCount: 0,
    reconciledCount: 0,
    failedCount: 0,
    totalReconciledNaira: 0,
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [posTerminals, setPosTerminals] = useState<any[]>([
    { id: 'TERM-01', name: 'Moniepoint POS 1 - GRA Counter', serialNumber: 'MP-8923011', branchId: 'gra', status: 'online' },
    { id: 'TERM-02', name: 'Baxi POS 2 - Tombia HQ Counter', serialNumber: 'BX-4412980', branchId: 'tombia', status: 'online' },
    { id: 'TERM-03', name: 'OPay POS 3 - Agip Express Counter', serialNumber: 'OP-7731209', branchId: 'agip', status: 'online' },
  ]);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [auditNotes, setAuditNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Log external POS slip / bank transfer modal state
  const [isLogSlipOpen, setIsLogSlipOpen] = useState(false);
  const [slipReference, setSlipReference] = useState('');
  const [slipOrderNumber, setSlipOrderNumber] = useState('');
  const [slipAmount, setSlipAmount] = useState('');
  const [slipMethod, setSlipMethod] = useState<'pos_terminal' | 'bank_transfer' | 'card'>('pos_terminal');
  const [slipPayerName, setSlipPayerName] = useState('');
  const [slipPayerBank, setSlipPayerBank] = useState('Moniepoint POS');
  const [slipTerminalSerial, setSlipTerminalSerial] = useState('MP-8923011');
  const [slipAutoReconcile, setSlipAutoReconcile] = useState(true);

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('choplife_staff_token') || '';
    return { Authorization: `Bearer ${token}`, ...extra };
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const loadReconciliationData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reconciliation/transactions', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || {});
        setTransactions(data.transactions || []);
        if (Array.isArray(data.posTerminals) && data.posTerminals.length > 0) {
          setPosTerminals(data.posTerminals);
        }
      }
    } catch (err) {
      console.error('Failed to fetch reconciliation data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReconciliationData();
  }, []);

  const handleMatchPayment = async (reference: string, decision: 'confirm' | 'reject') => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reconciliation/match', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          reference,
          decision,
          notes:
            auditNotes ||
            (decision === 'confirm' ? 'Verified via bank credit alert / POS terminal slip' : 'Unverified / mismatch'),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reconcile transaction');

      showToast(
        data.message || `Transaction ${decision === 'confirm' ? 'reconciled' : 'rejected'} successfully`,
        'success'
      );
      setSelectedTx(null);
      setAuditNotes('');
      loadReconciliationData();
    } catch (err: any) {
      showToast(err.message || 'Reconciliation failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunAutoMatch = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reconciliation/auto-match', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auto-matching engine failed');

      showToast(`Auto-reconciliation complete! Matched ${data.matchedCount} pending payment(s).`, 'success');
      loadReconciliationData();
    } catch (err: any) {
      showToast(err.message || 'Auto-matching failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogStoreSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slipAmount || Number(slipAmount) <= 0) {
      showToast('Enter a valid amount in Naira', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reconciliation/log-terminal', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          reference: slipReference || `SLIP-${Date.now().toString().slice(-6)}`,
          orderNumber: slipOrderNumber || undefined,
          amountNaira: Number(slipAmount),
          paymentMethod: slipMethod,
          payerName: slipPayerName || 'In-Store Customer',
          payerBank: slipPayerBank,
          terminalSerial: slipMethod === 'pos_terminal' ? slipTerminalSerial : undefined,
          branchId: selectedBranchId || 'gra',
          autoReconcile: slipAutoReconcile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log store payment slip');
      showToast(data.message || 'Store payment slip synchronised!', 'success');
      setIsLogSlipOpen(false);
      setSlipReference('');
      setSlipOrderNumber('');
      setSlipAmount('');
      setSlipPayerName('');
      loadReconciliationData();
    } catch (err: any) {
      showToast(err.message || 'Failed to synchronise payment slip', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter transactions
  const filteredTxs = transactions.filter((tx) => {
    const matchesTab =
      activeTab === 'all'
        ? true
        : activeTab === 'unmatched'
        ? tx.status === 'reconciliation_required' || tx.status === 'pending'
        : tx.paymentMethod === activeTab;

    const matchesStatus = statusFilter === 'all' ? true : tx.status === statusFilter;

    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      (tx.reference && tx.reference.toLowerCase().includes(term)) ||
      (tx.orderNumber && tx.orderNumber.toLowerCase().includes(term)) ||
      (tx.payerName && tx.payerName.toLowerCase().includes(term)) ||
      (tx.payerBank && tx.payerBank.toLowerCase().includes(term));

    return matchesTab && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Auto-Match Header (Warm Light Theme) */}
      <div className="bg-white text-stone-900 p-6 rounded-3xl border border-[#E5DEC9] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#4D080F] text-[#FFC700] font-bold text-[10px] uppercase tracking-wider">
              FINANCIAL INTEGRITY HUB
            </span>
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE STORE LEDGER SYNC
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-[#4D080F] tracking-wide">
            Physical Store Payment Synchronisation &amp; Reconciliation
          </h2>
          <p className="text-xs text-stone-600 max-w-2xl">
            Reconcile physical-store bank transfers, card payment gateway credits, and external POS terminal transactions (Moniepoint, Baxi, OPay) against Choplife Republic business account balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={loadReconciliationData}
            disabled={isLoading}
            className="p-3 rounded-2xl bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#4D080F] transition-all border border-[#E5DEC9]"
            title="Refresh Ledger Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#4D080F]' : ''}`} />
          </button>

          <button
            onClick={() => setIsLogSlipOpen(true)}
            className="px-4 py-3 rounded-2xl bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-xs transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Sync POS / Transfer Slip</span>
          </button>

          <button
            onClick={handleRunAutoMatch}
            disabled={isSubmitting}
            className="px-4 py-3 rounded-2xl bg-[#FFC700] hover:bg-amber-400 text-[#4D080F] font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-[#4D080F]" />
            <span>Run Auto-Match Rules</span>
          </button>
        </div>
      </div>

      {/* Floating Action Toast */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border shadow-md ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-[#E5DEC9] shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            Total Reconciled
          </span>
          <div className="font-mono font-black text-lg text-[#6b1224] tabular-nums">
            {formatNaira(stats.totalReconciledNaira || 0)}
          </div>
          <span className="text-[10px] text-stone-500">{stats.reconciledCount || 0} settled checks</span>
        </div>

        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
            Pending Bank Transfers
          </span>
          <div className="font-mono font-black text-lg text-amber-900 tabular-nums">
            {stats.pendingBankTransfers || 0}
          </div>
          <span className="text-[10px] text-amber-700">Requires bank alert verification</span>
        </div>

        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
            Unmatched Transactions
          </span>
          <div className="font-mono font-black text-lg text-blue-900 tabular-nums">
            {stats.unmatchedCount || 0}
          </div>
          <span className="text-[10px] text-blue-700">Awaiting matching rules</span>
        </div>

        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
            Reconciled Ratio
          </span>
          <div className="font-mono font-black text-lg text-emerald-900 tabular-nums">
            {stats.totalCount > 0
              ? `${Math.round(((stats.reconciledCount || 0) / stats.totalCount) * 100)}%`
              : '100%'}
          </div>
          <span className="text-[10px] text-emerald-700">
            {stats.reconciledCount || 0} of {stats.totalCount || 0} total
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#E5DEC9] shadow-2xs space-y-1 col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            Active Store POS Terminals
          </span>
          <div className="font-mono font-black text-lg text-[#4D080F] tabular-nums flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>{posTerminals.length} Online</span>
          </div>
          <span className="text-[10px] text-stone-500">Moniepoint &bull; Baxi &bull; OPay</span>
        </div>
      </div>

      {/* Main Reconciliation Ledger & Filters */}
      <div className="bg-white rounded-3xl border border-[#E5DEC9] shadow-2xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-[#E5DEC9] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#FAF7F2]">
          {/* Tabs */}
          <div className="flex bg-white p-1 rounded-2xl border border-[#E5DEC9] gap-1 overflow-x-auto text-xs font-bold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'all' ? 'bg-[#6b1224] text-[#FFC700] shadow-2xs' : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              All Records ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('unmatched')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'unmatched' ? 'bg-[#6b1224] text-[#FFC700] shadow-2xs' : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              Unmatched / Pending ({stats.unmatchedCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('bank_transfer')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'bank_transfer' ? 'bg-[#6b1224] text-[#FFC700] shadow-2xs' : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              Bank Transfers
            </button>
            <button
              onClick={() => setActiveTab('card')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'card' ? 'bg-[#6b1224] text-[#FFC700] shadow-2xs' : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              Card Gateway
            </button>
            <button
              onClick={() => setActiveTab('pos_terminal')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'pos_terminal' ? 'bg-[#6b1224] text-[#FFC700] shadow-2xs' : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              Physical Terminals
            </button>
          </div>

          {/* Search & Status Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Ref, Order #, Payer..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#E5DEC9] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6b1224]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-white border border-[#E5DEC9] rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#6b1224]"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="reconciliation_required">Reconciliation Required</option>
              <option value="paid">Reconciled / Paid</option>
              <option value="failed">Failed / Mismatch</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#FAF7F2] text-[#4D080F] font-bold uppercase tracking-wider text-[10px] border-b border-[#E5DEC9]">
              <tr>
                <th className="p-4">Payment Reference</th>
                <th className="p-4">Order / Check #</th>
                <th className="p-4">Channel / Payer</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">Verification Source</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-400">
                    No payment transactions matching criteria found. Use &ldquo;Sync POS / Transfer Slip&rdquo; above to log an external terminal or transfer receipt.
                  </td>
                </tr>
              ) : (
                filteredTxs.map((tx, idx) => (
                  <tr key={tx.reference || idx} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="p-4 font-mono font-bold text-stone-900">
                      {tx.reference}
                      {tx.terminalSerial && (
                        <div className="text-[10px] text-stone-500 font-normal">Terminal: {tx.terminalSerial}</div>
                      )}
                    </td>

                    <td className="p-4 font-bold text-[#6b1224]">
                      {tx.orderNumber ? `#${tx.orderNumber}` : 'Walk-in Check'}
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-stone-800 capitalize">
                        {(tx.paymentMethod || 'bank_transfer').replace('_', ' ')}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {tx.payerName || tx.payerBank
                          ? `${tx.payerName || 'Customer'} (${tx.payerBank || 'Bank'})`
                          : 'Store POS Terminal'}
                      </div>
                    </td>

                    <td className="p-4 font-mono font-bold text-stone-900 tabular-nums">
                      {formatNaira(tx.amountNaira || 0)}
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                          tx.status === 'paid' || tx.status === 'confirmed' || tx.status === 'reconciled'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : tx.status === 'reconciliation_required' || tx.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}
                      >
                        {tx.status === 'paid' || tx.status === 'confirmed' || tx.status === 'reconciled' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : tx.status === 'reconciliation_required' || tx.status === 'pending' ? (
                          <RefreshCw className="w-3 h-3 text-amber-600" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-600" />
                        )}
                        <span>{tx.status?.replace('_', ' ')}</span>
                      </span>
                    </td>

                    <td className="p-4 text-stone-500 text-[11px]">
                      {tx.verificationSource ? (
                        <span className="font-semibold text-stone-700 capitalize">
                          {tx.verificationSource.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="italic text-stone-400">Unverified</span>
                      )}
                      {tx.reconciledByName && (
                        <div className="text-[10px] text-stone-400">By: {tx.reconciledByName}</div>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="px-3 py-1.5 rounded-xl bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-bold text-xs transition-all shadow-2xs"
                      >
                        Reconcile &rarr;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log External POS Slip / Transfer Modal */}
      {isLogSlipOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-[#E5DEC9] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b1224]">
                  PHYSICAL STORE PAYMENT SYNC
                </span>
                <h3 className="text-base font-black text-stone-900">
                  Log External POS Terminal Slip or Bank Transfer
                </h3>
              </div>
              <button
                onClick={() => setIsLogSlipOpen(false)}
                className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogStoreSlip} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Payment Channel</label>
                  <select
                    value={slipMethod}
                    onChange={(e) => setSlipMethod(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2] font-semibold"
                  >
                    <option value="pos_terminal">Store POS Terminal (Moniepoint/Baxi/OPay)</option>
                    <option value="bank_transfer">Direct Bank Transfer Alert</option>
                    <option value="card">Card Gateway Receipt</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Amount Paid (₦) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={slipAmount}
                    onChange={(e) => setSlipAmount(e.target.value)}
                    placeholder="e.g. 14500"
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">POS RRN / Bank Session Ref</label>
                  <input
                    type="text"
                    value={slipReference}
                    onChange={(e) => setSlipReference(e.target.value)}
                    placeholder="e.g. RRN-009482193"
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Linked Order / Check # (Optional)</label>
                  <input
                    type="text"
                    value={slipOrderNumber}
                    onChange={(e) => setSlipOrderNumber(e.target.value)}
                    placeholder="e.g. ORD-1042"
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Customer / Payer Name</label>
                  <input
                    type="text"
                    value={slipPayerName}
                    onChange={(e) => setSlipPayerName(e.target.value)}
                    placeholder="e.g. Chinedu Okafor"
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Terminal / Bank Provider</label>
                  <input
                    type="text"
                    value={slipPayerBank}
                    onChange={(e) => setSlipPayerBank(e.target.value)}
                    placeholder="e.g. Moniepoint / GTBank"
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2]"
                  />
                </div>
              </div>

              {slipMethod === 'pos_terminal' && (
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Select Store POS Terminal</label>
                  <select
                    value={slipTerminalSerial}
                    onChange={(e) => setSlipTerminalSerial(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2]"
                  >
                    {posTerminals.map((t) => (
                      <option key={t.id} value={t.serialNumber}>
                        {t.name} ({t.serialNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 pt-1 font-bold text-stone-700">
                <input
                  type="checkbox"
                  checked={slipAutoReconcile}
                  onChange={(e) => setSlipAutoReconcile(e.target.checked)}
                />
                <span>Mark immediately as Verified &amp; Reconciled against physical slip/alert</span>
              </label>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLogSlipOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] font-black uppercase"
                >
                  {isSubmitting ? 'Syncing...' : 'Synchronise Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Modal / Side Drawer */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-[#E5DEC9] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b1224]">
                  PAYMENT RECONCILIATION AUDIT
                </span>
                <h3 className="text-lg font-black text-stone-900 font-mono">
                  Ref: {selectedTx.reference}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Order Number:</span>
                <strong className="text-stone-900 font-bold">#{selectedTx.orderNumber || 'N/A'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Channel / Method:</span>
                <strong className="text-stone-900 font-bold capitalize">
                  {(selectedTx.paymentMethod || 'bank_transfer').replace('_', ' ')}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payer Name / Bank:</span>
                <strong className="text-stone-900 font-bold">
                  {selectedTx.payerName || 'Customer'} ({selectedTx.payerBank || 'Bank'})
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Amount:</span>
                <strong className="text-[#6b1224] font-mono font-black text-sm">
                  {formatNaira(selectedTx.amountNaira || 0)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Current Status:</span>
                <strong className="text-stone-900 font-bold uppercase">{selectedTx.status}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700">
                Auditor / Manager Reconciliation Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                placeholder="e.g. Verified credit alert on Moniepoint/GTBank business account statement at 14:32..."
                rows={3}
                className="w-full p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6b1224]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => handleMatchPayment(selectedTx.reference, 'reject')}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-800 font-bold text-xs transition-all border border-red-200 disabled:opacity-50"
              >
                Reject &amp; Mark Failed
              </button>

              <button
                onClick={() => handleMatchPayment(selectedTx.reference, 'confirm')}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#6b1224] hover:bg-[#500e1b] text-[#FFC700] font-black text-xs transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-[#FFC700]" />
                <span>Confirm &amp; Reconcile Paid</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
