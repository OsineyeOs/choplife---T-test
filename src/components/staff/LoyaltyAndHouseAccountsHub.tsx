import React, { useState, useEffect } from 'react';
import { BranchId, StaffUser, CustomerAccount, CorporateHouseAccount, WalletTransaction, HouseAccountCharge, HouseAccountPayment, CustomerTier } from '../../types';
import {
  Award,
  Wallet,
  Building,
  CreditCard,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Mail,
  Shield,
  FileText,
  DollarSign,
  Gift,
  RefreshCw,
  X,
  AlertCircle,
  Calendar,
  Sparkles,
  Printer,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface LoyaltyAndHouseAccountsHubProps {
  activeBranchId: BranchId;
  currentStaff: StaffUser;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const LoyaltyAndHouseAccountsHub: React.FC<LoyaltyAndHouseAccountsHubProps> = ({
  activeBranchId,
  currentStaff,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'loyalty' | 'house_accounts'>('loyalty');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Customer Loyalty State
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [loyaltyStats, setLoyaltyStats] = useState({
    totalMembers: 0,
    totalWalletLiability: 0,
    totalPointsOutstanding: 0,
    totalLifetimeSpend: 0,
  });

  // Selected Customer for Ledger / Details
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAccount | null>(null);
  const [customerTransactions, setCustomerTransactions] = useState<WalletTransaction[]>([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isTopupModalOpen, setIsTopupModalOpen] = useState<boolean>(false);
  const [isRedeemPointsModalOpen, setIsRedeemPointsModalOpen] = useState<boolean>(false);

  // Topup form
  const [topupAmount, setTopupAmount] = useState<string>('10000');
  const [topupMethod, setTopupMethod] = useState<'pos_terminal' | 'cash' | 'bank_transfer'>('pos_terminal');
  const [topupReference, setTopupReference] = useState<string>('');
  const [topupNote, setTopupNote] = useState<string>('');

  // Redeem points form
  const [pointsToRedeemInput, setPointsToRedeemInput] = useState<string>('100');

  // Customer Register form
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('+234 ');
  const [newCustEmail, setNewCustEmail] = useState<string>('');
  const [newCustBranch, setNewCustBranch] = useState<BranchId>('gra');
  const [newCustPin, setNewCustPin] = useState<string>('');
  const [newCustBirthday, setNewCustBirthday] = useState<string>('');
  const [newCustNotes, setNewCustNotes] = useState<string>('');

  // Corporate House Accounts State
  const [houseAccounts, setHouseAccounts] = useState<CorporateHouseAccount[]>([]);
  const [houseAccountStats, setHouseAccountStats] = useState({
    totalAccounts: 0,
    totalCreditLimit: 0,
    totalOutstanding: 0,
    totalAvailableCredit: 0,
  });
  const [selectedHouseAccount, setSelectedHouseAccount] = useState<CorporateHouseAccount | null>(null);
  const [accountCharges, setAccountCharges] = useState<HouseAccountCharge[]>([]);
  const [accountPayments, setAccountPayments] = useState<HouseAccountPayment[]>([]);

  // Modals for Corporate Accounts
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState<boolean>(false);
  const [isDirectChargeModalOpen, setIsDirectChargeModalOpen] = useState<boolean>(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState<boolean>(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState<boolean>(false);

  // New Corporate Account form
  const [newCorpName, setNewCorpName] = useState<string>('');
  const [newCorpCode, setNewCorpCode] = useState<string>('');
  const [newCorpContact, setNewCorpContact] = useState<string>('');
  const [newCorpPhone, setNewCorpPhone] = useState<string>('+234 ');
  const [newCorpEmail, setNewCorpEmail] = useState<string>('');
  const [newCorpAddress, setNewCorpAddress] = useState<string>('Benin City, Edo State');
  const [newCorpCreditLimit, setNewCorpCreditLimit] = useState<string>('1000000');
  const [newCorpTerms, setNewCorpTerms] = useState<'net_7' | 'net_15' | 'net_30'>('net_30');
  const [newCorpBranch, setNewCorpBranch] = useState<BranchId | 'all'>('all');
  const [newCorpSignerName, setNewCorpSignerName] = useState<string>('');
  const [newCorpSignerRole, setNewCorpSignerRole] = useState<string>('Director');
  const [newCorpSignerPhone, setNewCorpSignerPhone] = useState<string>('');
  const [newCorpBillingNotes, setNewCorpBillingNotes] = useState<string>('');

  // Direct Charge form
  const [chargeAmount, setChargeAmount] = useState<string>('');
  const [chargeSigner, setChargeSigner] = useState<string>('');
  const [chargeDept, setChargeDept] = useState<string>('Executive Luncheon');
  const [chargeCheckNo, setChargeCheckNo] = useState<string>('');
  const [chargeNotes, setChargeNotes] = useState<string>('');

  // Record Payment form
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cheque' | 'pos_terminal' | 'cash'>('bank_transfer');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('choplife_staff_token') || '';
    return {
      Authorization: `Bearer ${token}`,
      ...extra,
    };
  };

  // Fetch Customers
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const params = new URLSearchParams();
      if (customerSearch) params.append('search', customerSearch);
      if (tierFilter !== 'all') params.append('tier', tierFilter);
      if (branchFilter !== 'all') params.append('branchId', branchFilter);

      const res = await fetch(`/api/customers?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data.customers) ? data.customers : []);
        if (data.stats) setLoyaltyStats(data.stats);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setFetchError(errBody.error || `Failed to load VIP patrons (HTTP ${res.status})`);
      }
    } catch (err: any) {
      console.error('Failed to load customers:', err);
      setFetchError(err?.message || 'Unable to reach loyalty registry service.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch House Accounts
  const fetchHouseAccounts = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetch('/api/house-accounts', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setHouseAccounts(Array.isArray(data.accounts) ? data.accounts : []);
        if (data.stats) setHouseAccountStats(data.stats);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setFetchError(errBody.error || `Failed to load corporate house accounts (HTTP ${res.status})`);
      }
    } catch (err: any) {
      console.error('Failed to load corporate house accounts:', err);
      setFetchError(err?.message || 'Unable to reach corporate house accounts service.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'loyalty') {
      fetchCustomers();
    } else {
      fetchHouseAccounts();
    }
  }, [activeTab, customerSearch, tierFilter, branchFilter]);

  // Load single customer details
  const viewCustomerDetails = async (cust: CustomerAccount) => {
    setSelectedCustomer(cust);
    try {
      const res = await fetch(`/api/customers/${cust.id}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedCustomer(data.customer);
        setCustomerTransactions(data.transactions || []);
        setIsCustomerModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      setIsCustomerModalOpen(true);
    }
  };

  // Load single corporate account details
  const viewHouseAccountDetails = async (acc: CorporateHouseAccount) => {
    setSelectedHouseAccount(acc);
    try {
      const res = await fetch(`/api/house-accounts/${acc.id}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedHouseAccount(data.account);
        setAccountCharges(data.charges || []);
        setAccountPayments(data.payments || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Register Customer Handler
  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      showToast('Please enter customer name and phone number.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: newCustName,
          phone: newCustPhone,
          email: newCustEmail || undefined,
          preferredBranchId: newCustBranch,
          walletPin: newCustPin,
          birthday: newCustBirthday,
          notes: newCustNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register customer');

      showToast(`VIP Member ${data.customer.name} registered with 50 bonus points!`, 'success');
      setIsRegisterModalOpen(false);
      setNewCustName('');
      setNewCustPhone('+234 ');
      setNewCustEmail('');
      setNewCustNotes('');
      fetchCustomers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Top-Up Wallet Handler
  const handleTopupWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = Number(topupAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid top-up amount.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/topup`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          amount: amt,
          paymentMethod: topupMethod,
          reference: topupReference || undefined,
          note: topupNote || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to credit wallet');

      showToast(`Successfully credited ₦${amt.toLocaleString()} to ${data.customer.name}'s wallet!`, 'success');
      setSelectedCustomer(data.customer);
      setIsTopupModalOpen(false);
      setTopupReference('');
      setTopupNote('');
      fetchCustomers();
      // Refresh transactions
      viewCustomerDetails(data.customer);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Redeem Points Handler
  const handleRedeemPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const pts = Number(pointsToRedeemInput);
    if (isNaN(pts) || pts <= 0) {
      showToast('Please specify positive points to redeem.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/redeem-points`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ pointsToRedeem: pts }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Redemption failed');

      showToast(`Redeemed ${pts} points for ₦${data.creditValue.toLocaleString()} wallet stored credit!`, 'success');
      setSelectedCustomer(data.customer);
      setIsRedeemPointsModalOpen(false);
      fetchCustomers();
      viewCustomerDetails(data.customer);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Claim 10-Stamp Card Reward
  const handleClaimStampReward = async (cust: CustomerAccount) => {
    if (cust.stampCount < 10) {
      showToast(`Customer currently has ${cust.stampCount}/10 stamps. 10 stamps are required for complimentary meal.`, 'error');
      return;
    }

    try {
      const res = await fetch(`/api/customers/${cust.id}/redeem-stamp`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to claim reward');

      showToast(`🎉 10-Stamp Milestone Reached! ₦${data.rewardCredit.toLocaleString()} meal reward credited to wallet!`, 'success');
      fetchCustomers();
      if (selectedCustomer && selectedCustomer.id === cust.id) {
        setSelectedCustomer(data.customer);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Create Corporate Account Handler
  const handleCreateCorporateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCorpName.trim() || !newCorpContact.trim() || !newCorpPhone.trim()) {
      showToast('Company name, contact person, and phone are required.', 'error');
      return;
    }

    const signers = [];
    if (newCorpSignerName.trim()) {
      signers.push({
        name: newCorpSignerName.trim(),
        designation: newCorpSignerRole.trim(),
        phone: newCorpSignerPhone.trim() || newCorpPhone.trim(),
      });
    }

    try {
      const res = await fetch('/api/house-accounts', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          companyName: newCorpName,
          accountCode: newCorpCode ? newCorpCode.toUpperCase() : undefined,
          contactPerson: newCorpContact,
          phone: newCorpPhone,
          email: newCorpEmail,
          address: newCorpAddress,
          creditLimit: Number(newCorpCreditLimit) || 1000000,
          paymentTerms: newCorpTerms,
          authorizedSigners: signers,
          preferredBranchId: newCorpBranch,
          billingNotes: newCorpBillingNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create corporate account');

      showToast(`Corporate House Account ${data.account.companyName} created!`, 'success');
      setIsCreateAccountModalOpen(false);
      setNewCorpName('');
      setNewCorpCode('');
      setNewCorpContact('');
      setNewCorpPhone('+234 ');
      setNewCorpEmail('');
      setNewCorpSignerName('');
      fetchHouseAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Direct Charge Handler
  const handleDirectCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouseAccount) return;
    const amt = Number(chargeAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid charge amount.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/house-accounts/${selectedHouseAccount.id}/charge`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          amount: amt,
          authorizedSigner: chargeSigner || selectedHouseAccount.contactPerson,
          department: chargeDept,
          checkNumber: chargeCheckNo || undefined,
          notes: chargeNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post charge');

      showToast(`Charged ₦${amt.toLocaleString()} to ${data.account.companyName}!`, 'success');
      setSelectedHouseAccount(data.account);
      setIsDirectChargeModalOpen(false);
      setChargeAmount('');
      setChargeCheckNo('');
      setChargeNotes('');
      fetchHouseAccounts();
      viewHouseAccountDetails(data.account);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Record Corporate Remittance Payment Handler
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouseAccount) return;
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid remittance amount.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/house-accounts/${selectedHouseAccount.id}/payments`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          amount: amt,
          paymentMethod,
          bankReference: paymentRef,
          notes: paymentNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');

      showToast(`Recorded remittance of ₦${amt.toLocaleString()} from ${data.account.companyName}. Receipt: ${data.payment.receiptNumber}`, 'success');
      setSelectedHouseAccount(data.account);
      setIsRecordPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      fetchHouseAccounts();
      viewHouseAccountDetails(data.account);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const getTierColor = (tier: CustomerTier) => {
    switch (tier) {
      case 'platinum':
        return 'bg-purple-100 border-purple-300 text-purple-900';
      case 'gold':
        return 'bg-amber-100 border-amber-300 text-amber-900';
      case 'silver':
        return 'bg-stone-100 border-stone-300 text-stone-800';
      default:
        return 'bg-[#FFF8E7] border-[#E5DEC9] text-[#800D15]';
    }
  };

  return (
    <div className="space-y-6 text-[#241311]">
      {/* Header & Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E5DEC9] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#800D15] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700] shadow-sm">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#241311] tracking-wide">
              VIP Loyalty, Digital Wallets & Corporate House Accounts
            </h1>
            <p className="text-xs text-[#7A6A65]">
              Manage patron loyalty tiers, stored-value digital wallets, 10-stamp meal cards, and corporate credit accounts.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-[#FAF7F2] p-1 rounded-xl border border-[#E5DEC9] self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('loyalty')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'loyalty'
                ? 'bg-[#800D15] text-white shadow-xs'
                : 'text-[#7A6A65] hover:text-[#241311]'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>VIP Loyalty & Wallets</span>
          </button>
          <button
            onClick={() => setActiveTab('house_accounts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'house_accounts'
                ? 'bg-[#800D15] text-white shadow-xs'
                : 'text-[#7A6A65] hover:text-[#241311]'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Corporate House Accounts</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={() => (activeTab === 'loyalty' ? fetchCustomers() : fetchHouseAccounts())}
            className="px-3 py-1.5 bg-white border border-rose-300 rounded-xl font-bold text-rose-700 hover:bg-rose-100"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: VIP CUSTOMER LOYALTY & DIGITAL WALLETS */}
      {/* ========================================================================= */}
      {activeTab === 'loyalty' && (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5DEC9] p-4 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#7A6A65] mb-1">
                <span>Enrolled VIP Patrons</span>
                <User className="w-4 h-4 text-[#800D15]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#241311]">
                {loyaltyStats.totalMembers}
              </div>
              <div className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3" /> Active loyalty network
              </div>
            </div>

            <div className="bg-white border border-[#E5DEC9] p-4 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#7A6A65] mb-1">
                <span>Stored Wallet Deposits</span>
                <Wallet className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#800D15]">
                ₦{loyaltyStats.totalWalletLiability.toLocaleString()}
              </div>
              <div className="text-[10px] text-[#7A6A65] mt-1">Pre-paid diner float</div>
            </div>

            <div className="bg-white border border-[#E5DEC9] p-4 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#7A6A65] mb-1">
                <span>Points Outstanding</span>
                <Award className="w-4 h-4 text-purple-700" />
              </div>
              <div className="text-2xl font-bold font-mono text-purple-800">
                {loyaltyStats.totalPointsOutstanding.toLocaleString()} pts
              </div>
              <div className="text-[10px] text-purple-700 mt-1">
                ≈ ₦{(loyaltyStats.totalPointsOutstanding * 10).toLocaleString()} redeemable value
              </div>
            </div>

            <div className="bg-white border border-[#E5DEC9] p-4 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#7A6A65] mb-1">
                <span>Lifetime Patron Spend</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700">
                ₦{loyaltyStats.totalLifetimeSpend.toLocaleString()}
              </div>
              <div className="text-[10px] text-[#7A6A65] mt-1">Across all 3 branches</div>
            </div>
          </div>

          {/* Search, Filters & Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#E5DEC9] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-[#7A6A65] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-1.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
              >
                <option value="all">All VIP Tiers</option>
                <option value="platinum">Platinum VIP</option>
                <option value="gold">Gold VIP</option>
                <option value="silver">Silver Tier</option>
                <option value="bronze">Bronze Tier</option>
              </select>

              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-1.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
              >
                <option value="all">All Branches</option>
                <option value="gra">GRA Flagship</option>
                <option value="ugbowo">Ugbowo Campus</option>
                <option value="okabere">Okabere Express</option>
              </select>
            </div>

            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2 bg-[#800D15] hover:bg-[#96121B] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#FFC700]" />
              <span>Enroll New Patron</span>
            </button>
          </div>

          {/* Customers Table / Grid */}
          <div className="bg-white rounded-xl border border-[#E5DEC9] overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-[#E5DEC9] flex items-center justify-between bg-[#FAF7F2]/60">
              <h2 className="text-sm font-bold text-[#241311] flex items-center gap-2">
                <span>VIP Patrons Registry</span>
                <span className="text-xs font-mono text-[#7A6A65]">({customers.length})</span>
              </h2>
              <button
                onClick={fetchCustomers}
                className="p-1.5 text-[#7A6A65] hover:text-[#241311] rounded-lg hover:bg-stone-100 transition-all"
                title="Refresh customer database"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5DEC9] bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-[#7A6A65]">
                    <th className="py-3 px-4">Patron & Contact</th>
                    <th className="py-3 px-4">Tier Status</th>
                    <th className="py-3 px-4">Digital Wallet Balance</th>
                    <th className="py-3 px-4">Loyalty Points</th>
                    <th className="py-3 px-4">10-Stamp Card</th>
                    <th className="py-3 px-4">Lifetime Spend</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DEC9] text-xs">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-[#FAF7F2] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#241311]">{c.name}</div>
                        <div className="text-[11px] text-[#7A6A65] flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{c.phone}</span>
                          {c.preferredBranchId && (
                            <span className="uppercase text-[9px] bg-[#FAF7F2] text-[#5C4942] px-1.5 py-0.5 rounded border border-[#E5DEC9]">
                              {c.preferredBranchId}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getTierColor(
                            c.tier
                          )}`}
                        >
                          <Sparkles className="w-3 h-3" />
                          {c.tier}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-sm text-[#800D15]">
                          ₦{c.walletBalance.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[#7A6A65]">PIN: ••••</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-purple-800">
                          {c.loyaltyPoints} pts
                        </div>
                        <div className="text-[10px] text-purple-700">
                          = ₦{(c.loyaltyPoints * 10).toLocaleString()} credit
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          {[...Array(10)].map((_, idx) => (
                            <div
                              key={idx}
                              className={`w-3 h-3 rounded-full border ${
                                idx < c.stampCount
                                  ? 'bg-[#800D15] border-[#800D15]'
                                  : 'bg-[#FAF7F2] border-[#E5DEC9]'
                              }`}
                              title={`Stamp ${idx + 1}`}
                            />
                          ))}
                          <span className="text-[10px] font-mono text-[#7A6A65] ml-1">
                            {c.stampCount}/10
                          </span>
                        </div>
                        {c.stampCount >= 10 && (
                          <button
                            onClick={() => handleClaimStampReward(c)}
                            className="mt-1 px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-bold rounded flex items-center gap-1 animate-pulse"
                          >
                            <Gift className="w-2.5 h-2.5" /> Claim Free Meal (₦4,000)
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[#241311]">
                        <div className="font-bold">₦{c.lifetimeSpend.toLocaleString()}</div>
                        <div className="text-[10px] text-[#7A6A65]">{c.visitCount} visits</div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedCustomer(c);
                              setIsTopupModalOpen(true);
                            }}
                            className="px-2 py-1 bg-[#FFF8E7] hover:bg-amber-100 text-[#800D15] border border-[#FFC700]/60 rounded text-[11px] font-bold flex items-center gap-1"
                            title="Top-up digital wallet balance"
                          >
                            <ArrowUpRight className="w-3 h-3" /> Top-Up
                          </button>
                          <button
                            onClick={() => viewCustomerDetails(c)}
                            className="px-2.5 py-1 bg-[#800D15] hover:bg-[#96121B] text-white rounded text-[11px] font-bold"
                          >
                            Profile & Ledger
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="py-10 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-2">
                          <Award className="w-8 h-8 text-[#800D15]/40 mx-auto" />
                          <p className="text-sm font-bold text-[#241311]">
                            {customerSearch || tierFilter !== 'all' || branchFilter !== 'all'
                              ? 'No patrons matched your active search or filter criteria.'
                              : 'No VIP patrons are currently enrolled in the loyalty registry.'}
                          </p>
                          <p className="text-xs text-[#7A6A65]">
                            Enroll a patron to issue a stored-value digital wallet, track 10-stamp meal rewards, and award loyalty points on qualifying orders.
                          </p>
                          <div className="pt-1">
                            <button
                              onClick={() => setIsRegisterModalOpen(true)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#800D15] hover:bg-[#96121B] text-white text-xs font-bold rounded-xl"
                            >
                              <Plus className="w-3.5 h-3.5 text-[#FFC700]" /> Enroll First VIP Patron
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CORPORATE VIP HOUSE ACCOUNTS & CREDIT LEDGER */}
      {/* ========================================================================= */}
      {activeTab === 'house_accounts' && (
        <div className="space-y-6">
          {/* Corporate Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5DEC9] p-4 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#7A6A65] mb-1">
                <span>Active Corporate Clients</span>
                <Building className="w-4 h-4 text-[#800D15]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#241311]">
                {houseAccountStats.totalAccounts}
              </div>
              <div className="text-[10px] text-blue-700 mt-1">Institutions & firms</div>
            </div>

            <div className="bg-white border border-[#E5DEC9] p-4 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#7A6A65] mb-1">
                <span>Extended Credit Facility</span>
                <CreditCard className="w-4 h-4 text-blue-700" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#241311]">
                ₦{houseAccountStats.totalCreditLimit.toLocaleString()}
              </div>
              <div className="text-[10px] text-[#7A6A65] mt-1">Approved credit lines</div>
            </div>

            <div className="bg-white border border-[#E5DEC9] p-4 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#7A6A65] mb-1">
                <span>Outstanding Receivables</span>
                <DollarSign className="w-4 h-4 text-[#800D15]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#800D15]">
                ₦{houseAccountStats.totalOutstanding.toLocaleString()}
              </div>
              <div className="text-[10px] text-amber-700 mt-1">Pending monthly billing</div>
            </div>

            <div className="bg-white border border-[#E5DEC9] p-4 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#7A6A65] mb-1">
                <span>Available Headroom</span>
                <Shield className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700">
                ₦{houseAccountStats.totalAvailableCredit.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-700 mt-1">Low risk utilization</div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#E5DEC9] flex items-center justify-between shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-[#241311]">Corporate House Accounts Ledger</h2>
              <p className="text-xs text-[#7A6A65]">
                Authorized institutional billing for ministries, corporate banks, multinationals & medical societies.
              </p>
            </div>
            <button
              onClick={() => setIsCreateAccountModalOpen(true)}
              className="px-4 py-2 bg-[#800D15] hover:bg-[#96121B] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#FFC700]" />
              <span>New Corporate Account</span>
            </button>
          </div>

          {/* Corporate Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {houseAccounts.map((acc) => {
              const utilPct = Math.min(100, Math.round((acc.currentBalance / acc.creditLimit) * 100));
              return (
                <div
                  key={acc.id}
                  className="bg-white border border-[#E5DEC9] rounded-xl p-5 space-y-4 hover:border-[#800D15] transition-all shadow-2xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-[#241311]">{acc.companyName}</h3>
                        <span className="text-[10px] font-mono bg-[#800D15]/10 text-[#800D15] border border-[#800D15]/20 px-1.5 py-0.5 rounded font-bold">
                          {acc.accountCode}
                        </span>
                      </div>
                      <p className="text-xs text-[#7A6A65] mt-0.5">
                        Attn: {acc.contactPerson} • {acc.phone}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                        acc.status === 'active'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {acc.status}
                    </span>
                  </div>

                  {/* Credit Utilization Bar */}
                  <div className="space-y-1.5 bg-[#FAF7F2] p-3 rounded-lg border border-[#E5DEC9]">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#7A6A65]">Current Outstanding:</span>
                      <span className="font-bold font-mono text-[#800D15]">
                        ₦{acc.currentBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          utilPct > 80 ? 'bg-rose-600' : utilPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${utilPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#7A6A65]">
                      <span>Limit: ₦{acc.creditLimit.toLocaleString()}</span>
                      <span>
                        {utilPct}% used • Terms: {acc.paymentTerms.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Authorized Signers */}
                  <div className="text-[11px] text-[#7A6A65]">
                    <span className="font-bold text-[#241311]">Authorized Signers: </span>
                    {acc.authorizedSigners && acc.authorizedSigners.length > 0 ? (
                      acc.authorizedSigners.map((s) => `${s.name} (${s.designation})`).join(', ')
                    ) : (
                      <span>Primary contact only</span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-[#E5DEC9] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedHouseAccount(acc);
                          setChargeSigner(acc.authorizedSigners?.[0]?.name || acc.contactPerson);
                          setIsDirectChargeModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-[#FFF8E7] hover:bg-amber-100 text-[#800D15] border border-[#FFC700]/60 rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Post Charge
                      </button>
                      <button
                        onClick={() => {
                          setSelectedHouseAccount(acc);
                          setPaymentAmount(String(acc.currentBalance));
                          setIsRecordPaymentModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <DollarSign className="w-3.5 h-3.5" /> Record Payment
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        viewHouseAccountDetails(acc);
                        setIsStatementModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-[#800D15] hover:bg-[#96121B] text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> Statement
                    </button>
                  </div>
                </div>
              );
            })}
            {houseAccounts.length === 0 && !isLoading && (
              <div className="col-span-full bg-white border border-[#E5DEC9] rounded-xl p-8 text-center space-y-2">
                <Building className="w-8 h-8 text-[#800D15]/40 mx-auto" />
                <p className="text-sm font-bold text-[#241311]">No Corporate House Accounts Configured</p>
                <p className="text-xs text-[#7A6A65] max-w-md mx-auto">
                  Establish a corporate house account to manage authorized institutional credit limits, signers, and monthly billing statements.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ENROLL NEW PATRON */}
      {/* ========================================================================= */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <h3 className="font-black text-[#241311] text-base flex items-center gap-2">
                <Award className="w-5 h-5 text-[#800D15]" />
                <span>Enroll VIP Patron</span>
              </h3>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-[#7A6A65] hover:text-[#241311]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#5C4942]">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chief Osarumen Igbinedion"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#5C4942]">Phone Number (Mobile) *</label>
                <input
                  type="text"
                  required
                  placeholder="+234 803 123 4567"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] font-mono focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#5C4942]">Email Address</label>
                  <input
                    type="email"
                    placeholder="patron@gmail.com"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#5C4942]">Preferred Branch</label>
                  <select
                    value={newCustBranch}
                    onChange={(e) => setNewCustBranch(e.target.value as BranchId)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  >
                    <option value="gra">GRA Flagship</option>
                    <option value="ugbowo">Ugbowo Campus</option>
                    <option value="okabere">Okabere Express</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#5C4942]">Wallet Security PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="PIN"
                    value={newCustPin}
                    onChange={(e) => setNewCustPin(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] font-mono tracking-widest focus:outline-none focus:border-[#800D15]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#5C4942]">Birthday (MM-DD)</label>
                  <input
                    type="text"
                    placeholder="e.g. 08-25"
                    value={newCustBirthday}
                    onChange={(e) => setNewCustBirthday(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#5C4942]">Preferences / Table Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Likes VIP booth 4, prefers spicy catfish, Heineken zero ice."
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div className="bg-[#FFF8E7] p-3 rounded-xl border border-[#FFC700]/60 text-[11px] text-[#800D15] font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#800D15] shrink-0" />
                <span>New VIP members receive 50 complimentary welcome loyalty points upon registration!</span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 bg-[#FAF7F2] border border-[#E5DEC9] text-[#5C4942] rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#800D15] hover:bg-[#96121B] text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Complete Enrollment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TOP-UP DIGITAL WALLET */}
      {/* ========================================================================= */}
      {isTopupModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#E5DEC9] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-[#241311] font-montserrat">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div>
                <h3 className="font-titan text-[#4D080F] text-base">Top-Up Digital Wallet</h3>
                <p className="text-xs text-[#6E5953] mt-0.5">
                  <strong className="text-[#241311]">{selectedCustomer.name}</strong> • Current Balance: <span className="font-mono font-bold text-[#800D15]">₦{selectedCustomer.walletBalance.toLocaleString()}</span>
                </p>
              </div>
              <button
                onClick={() => setIsTopupModalOpen(false)}
                className="text-[#6E5953] hover:text-[#241311] p-1 rounded-lg hover:bg-stone-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTopupWallet} className="space-y-3">
              <div>
                <label className="text-xs font-titan text-[#4D080F] block mb-1">Top-Up Amount (₦) *</label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={500}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-sm font-mono font-bold text-[#800D15] focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[5000, 10000, 20000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTopupAmount(String(preset))}
                    className="py-1.5 bg-white hover:bg-stone-100 text-xs font-mono font-bold text-[#4D080F] rounded-lg border border-[#E5DEC9] transition-colors"
                  >
                    ₦{(preset / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              {Number(topupAmount) >= 20000 && (
                <div className="bg-emerald-50 border border-emerald-300 p-2.5 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-2xs">
                  <span className="font-medium">✨ 5% Reload Bonus Qualified!</span>
                  <span className="font-bold font-mono text-emerald-800">
                    +₦{Math.floor(Number(topupAmount) * 0.05).toLocaleString()}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-titan text-[#4D080F] block mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { id: 'pos_terminal', label: 'POS Terminal' },
                    { id: 'bank_transfer', label: 'Transfer' },
                    { id: 'cash', label: 'Cash' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTopupMethod(m.id as any)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        topupMethod === m.id
                          ? 'bg-[#800D15] text-[#FFC700] border-[#800D15] shadow-xs'
                          : 'bg-white text-[#6E5953] border-[#E5DEC9] hover:bg-stone-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-titan text-[#4D080F] block mb-1">Payment Reference / POS STAN</label>
                <input
                  type="text"
                  placeholder="e.g. STAN-009182 / TRF-GTB-8812"
                  value={topupReference}
                  onChange={(e) => setTopupReference(e.target.value)}
                  className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] font-mono focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              <div>
                <label className="text-xs font-titan text-[#4D080F] block mb-1">Staff Notes</label>
                <input
                  type="text"
                  placeholder="Optional top-up memo"
                  value={topupNote}
                  onChange={(e) => setTopupNote(e.target.value)}
                  className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTopupModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#E5DEC9] text-[#6E5953] hover:text-[#241311] rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#800D15] hover:bg-[#96121B] text-[#FFC700] font-titan text-xs rounded-xl shadow-xs transition-colors"
                >
                  Confirm Credit (₦{Number(topupAmount).toLocaleString()})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOMER PROFILE & TRANSACTION LEDGER */}
      {/* ========================================================================= */}
      {isCustomerModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#E5DEC9] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#241311] font-montserrat">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E5DEC9] flex items-center justify-between bg-white">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-titan text-lg text-[#4D080F]">
                    {selectedCustomer.name}
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getTierColor(
                      selectedCustomer.tier
                    )}`}
                  >
                    {selectedCustomer.tier} VIP
                  </span>
                </div>
                <p className="text-xs text-[#6E5953] mt-0.5">
                  {selectedCustomer.phone} • Member since{' '}
                  {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-[#6E5953] hover:text-[#241311] p-1 rounded-lg hover:bg-stone-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-[#FAF7F2]">
              {/* Account Quick Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-[#E5DEC9] shadow-2xs">
                  <div className="text-[10px] text-[#6E5953] font-bold uppercase">Wallet Stored Credit</div>
                  <div className="text-lg font-bold font-mono text-[#800D15]">
                    ₦{selectedCustomer.walletBalance.toLocaleString()}
                  </div>
                  <button
                    onClick={() => {
                      setIsTopupModalOpen(true);
                    }}
                    className="mt-1 text-[10px] text-amber-700 font-bold hover:underline"
                  >
                    + Add Funds
                  </button>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-[#E5DEC9] shadow-2xs">
                  <div className="text-[10px] text-[#6E5953] font-bold uppercase">Loyalty Points</div>
                  <div className="text-lg font-bold font-mono text-purple-800">
                    {selectedCustomer.loyaltyPoints} pts
                  </div>
                  <button
                    onClick={() => setIsRedeemPointsModalOpen(true)}
                    className="mt-1 text-[10px] text-purple-700 font-bold hover:underline"
                  >
                    Convert to Credit
                  </button>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-[#E5DEC9] shadow-2xs">
                  <div className="text-[10px] text-[#6E5953] font-bold uppercase">10-Stamp Milestone</div>
                  <div className="text-lg font-bold font-mono text-[#241311]">
                    {selectedCustomer.stampCount} / 10
                  </div>
                  <div className="text-[10px] text-[#6E5953]">
                    {selectedCustomer.stampsRedeemedTotal} meals claimed
                  </div>
                </div>
              </div>

              {/* Stamp Visual Card */}
              <div className="bg-white p-4 rounded-xl border border-[#E5DEC9] space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-titan text-[#4D080F] flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-[#FFC700]" />
                    <span>Digital Loyalty Stamp Card</span>
                  </span>
                  <span className="text-[11px] text-[#6E5953]">
                    Earn 1 stamp on every visit over ₦3,000
                  </span>
                </div>

                <div className="grid grid-cols-10 gap-2 pt-2">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all ${
                        i < selectedCustomer.stampCount
                          ? 'bg-[#800D15] border-[#FFC700] text-[#FFC700] shadow-xs scale-105'
                          : 'bg-[#FAF7F2] border-[#E5DEC9] text-stone-400'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-mono mt-0.5">#{i + 1}</span>
                    </div>
                  ))}
                </div>

                {selectedCustomer.stampCount >= 10 && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleClaimStampReward(selectedCustomer)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-titan rounded-xl flex items-center gap-1.5 shadow-md animate-pulse"
                    >
                      <Gift className="w-4 h-4 text-[#FFC700]" /> Claim Complimentary ₦4,000 Meal Reward
                    </button>
                  </div>
                )}
              </div>

              {/* Transactions Ledger */}
              <div className="space-y-3">
                <h4 className="text-xs font-titan uppercase tracking-wider text-[#4D080F] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Wallet Transaction History</span>
                </h4>

                <div className="bg-white rounded-xl border border-[#E5DEC9] overflow-hidden shadow-2xs">
                  <div className="max-h-60 overflow-y-auto divide-y divide-[#E5DEC9]">
                    {customerTransactions.map((tx) => (
                      <div key={tx.id} className="p-3 text-xs flex items-center justify-between hover:bg-[#FAF7F2] transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                tx.type === 'top_up' || tx.type === 'bonus' || tx.type === 'points_conversion'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {tx.type.replace('_', ' ')}
                            </span>
                            <span className="text-[#241311] font-mono font-bold">
                              {tx.type === 'debit_order' ? '-' : '+'}₦{tx.amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6E5953] mt-0.5">
                            {tx.note || tx.reference} • Staff: {tx.staffName}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-[#6E5953]">
                            {new Date(tx.timestamp).toLocaleString()}
                          </div>
                          <div className="text-[10px] font-mono font-bold text-[#800D15]">
                            Bal: ₦{tx.newBalance.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {customerTransactions.length === 0 && (
                      <div className="p-6 text-center text-xs text-[#6E5953]">
                        No wallet transactions logged yet for this member.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E5DEC9] bg-white flex justify-end">
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-5 py-2 bg-white hover:bg-stone-100 border border-[#E5DEC9] text-[#241311] text-xs font-bold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REDEEM POINTS */}
      {/* ========================================================================= */}
      {isRedeemPointsModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#E5DEC9] rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-[#241311] font-montserrat">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <h3 className="font-titan text-[#4D080F] text-base">Redeem Points</h3>
              <button
                onClick={() => setIsRedeemPointsModalOpen(false)}
                className="text-[#6E5953] hover:text-[#241311] p-1 rounded-lg hover:bg-stone-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRedeemPoints} className="space-y-3">
              <div className="text-xs text-[#6E5953]">
                Available Points: <span className="font-bold font-mono text-purple-800">{selectedCustomer.loyaltyPoints}</span>
              </div>

              <div>
                <label className="text-xs font-titan text-[#4D080F] block mb-1">Points to Convert</label>
                <input
                  type="number"
                  min={10}
                  max={selectedCustomer.loyaltyPoints}
                  step={10}
                  value={pointsToRedeemInput}
                  onChange={(e) => setPointsToRedeemInput(e.target.value)}
                  className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-sm font-mono font-bold text-purple-800 focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#E5DEC9] text-xs text-[#241311] flex items-center justify-between shadow-2xs">
                <span className="font-medium text-[#6E5953]">Wallet Credit Yield:</span>
                <span className="font-bold font-mono text-emerald-700">
                  ₦{(Number(pointsToRedeemInput || 0) * 10).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRedeemPointsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#E5DEC9] text-[#6E5953] hover:text-[#241311] rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#800D15] hover:bg-[#96121B] text-[#FFC700] font-titan text-xs rounded-xl shadow-xs transition-colors"
                >
                  Convert Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE CORPORATE HOUSE ACCOUNT */}
      {/* ========================================================================= */}
      {isCreateAccountModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-[#241311] font-montserrat">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <h3 className="font-titan text-[#4D080F] text-base flex items-center gap-2">
                <Building className="w-5 h-5 text-[#E62E00]" />
                <span>Create Corporate House Account</span>
              </h3>
              <button
                onClick={() => setIsCreateAccountModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCorporateAccount} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Company / Organization Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zenith Bank Regional Operations Hub"
                  value={newCorpName}
                  onChange={(e) => setNewCorpName(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Account Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. CHOP-CORP-0104"
                    value={newCorpCode}
                    onChange={(e) => setNewCorpCode(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Credit Limit (₦) *</label>
                  <input
                    type="number"
                    required
                    min={100000}
                    step={50000}
                    placeholder="1000000"
                    value={newCorpCreditLimit}
                    onChange={(e) => setNewCorpCreditLimit(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#E62E00] focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Primary Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mrs. Ngozi Adeleke"
                    value={newCorpContact}
                    onChange={(e) => setNewCorpContact(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+234 803 123 4567"
                    value={newCorpPhone}
                    onChange={(e) => setNewCorpPhone(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-mono text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Billing Email</label>
                  <input
                    type="email"
                    placeholder="accounts@zenithbank.com"
                    value={newCorpEmail}
                    onChange={(e) => setNewCorpEmail(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Payment Terms</label>
                  <select
                    value={newCorpTerms}
                    onChange={(e) => setNewCorpTerms(e.target.value as any)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] font-bold focus:outline-hidden focus:border-[#4D080F]"
                  >
                    <option value="net_7">Net 7 Days</option>
                    <option value="net_15">Net 15 Days</option>
                    <option value="net_30">Net 30 Days (Standard)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Office / Delivery Address</label>
                <input
                  type="text"
                  placeholder="Plot 18 Sapele Road Commercial Zone, Benin City"
                  value={newCorpAddress}
                  onChange={(e) => setNewCorpAddress(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              {/* Initial Signer */}
              <div className="border border-[#E5DEC9] p-3 rounded-xl bg-[#FAF7F2] space-y-2">
                <div className="text-[11px] font-titan text-[#4D080F]">Initial Authorized Signer</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Signer Full Name"
                    value={newCorpSignerName}
                    onChange={(e) => setNewCorpSignerName(e.target.value)}
                    className="bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs text-[#241311]"
                  />
                  <input
                    type="text"
                    placeholder="Designation / Role"
                    value={newCorpSignerRole}
                    onChange={(e) => setNewCorpSignerRole(e.target.value)}
                    className="bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs text-[#241311]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Billing & Invoicing Instructions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Invoices to be sent to Accounts Payable Division on 25th of each month."
                  value={newCorpBillingNotes}
                  onChange={(e) => setNewCorpBillingNotes(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateAccountModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#800D15] hover:bg-[#660A11] text-white font-titan text-xs rounded-xl shadow-md transition-colors"
                >
                  Establish Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: POST DIRECT CHARGE TO CORPORATE HOUSE ACCOUNT */}
      {/* ========================================================================= */}
      {isDirectChargeModalOpen && selectedHouseAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-[#241311]">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div>
                <h3 className="font-serif font-bold text-[#4D080F] text-base">Post House Account Charge</h3>
                <p className="text-xs text-[#7C6E65]">
                  {selectedHouseAccount.companyName} ({selectedHouseAccount.accountCode})
                </p>
              </div>
              <button
                onClick={() => setIsDirectChargeModalOpen(false)}
                className="text-[#7C6E65] hover:text-[#241311]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDirectCharge} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#7C6E65]">Charge Amount (₦) *</label>
                <input
                  type="number"
                  required
                  min={500}
                  step={100}
                  placeholder="e.g. 85000"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-sm font-mono text-[#800D15] font-bold focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#7C6E65]">Authorized Signer *</label>
                <input
                  type="text"
                  required
                  value={chargeSigner}
                  onChange={(e) => setChargeSigner(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#7C6E65]">Department / Event</label>
                  <input
                    type="text"
                    value={chargeDept}
                    onChange={(e) => setChargeDept(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#7C6E65]">Check / Invoice Ref</label>
                  <input
                    type="text"
                    placeholder="CHK-GRA-942"
                    value={chargeCheckNo}
                    onChange={(e) => setChargeCheckNo(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] font-mono focus:outline-none focus:border-[#800D15]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#7C6E65]">Description / Catering Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Buffet lunch service for visiting audit committee."
                  value={chargeNotes}
                  onChange={(e) => setChargeNotes(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDirectChargeModalOpen(false)}
                  className="px-4 py-2 bg-[#FAF7F2] hover:bg-[#F3EFEA] text-[#7C6E65] border border-[#E5DEC9] rounded-xl text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#800D15] hover:bg-[#660A11] text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  Post ₦{Number(chargeAmount || 0).toLocaleString()} Charge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD CORPORATE REMITTANCE PAYMENT */}
      {/* ========================================================================= */}
      {isRecordPaymentModalOpen && selectedHouseAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-[#241311]">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div>
                <h3 className="font-serif font-bold text-[#4D080F] text-base">Record Corporate Remittance</h3>
                <p className="text-xs text-[#7C6E65]">
                  {selectedHouseAccount.companyName} • Balance Owed: ₦{selectedHouseAccount.currentBalance.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setIsRecordPaymentModalOpen(false)}
                className="text-[#7C6E65] hover:text-[#241311]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#7C6E65]">Remittance Amount (₦) *</label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={500}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-sm font-mono text-emerald-700 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#7C6E65]">Payment Instrument</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                >
                  <option value="bank_transfer">Direct Bank Transfer (NIP)</option>
                  <option value="cheque">Bankers Cheque / Draft</option>
                  <option value="pos_terminal">POS Terminal Settlement</option>
                  <option value="cash">Cash In Office</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#7C6E65]">Bank Transfer Session ID / Cheque # *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ZEN-NIP-20260902-8812"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-mono text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#7C6E65]">Settlement Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Full settlement for August judicial lunches"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecordPaymentModalOpen(false)}
                  className="px-4 py-2 bg-[#FAF7F2] hover:bg-[#F3EFEA] text-[#7C6E65] border border-[#E5DEC9] rounded-xl text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  Record Remittance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CORPORATE STATEMENT / INVOICE VIEW */}
      {/* ========================================================================= */}
      {isStatementModalOpen && selectedHouseAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#241311]">
            <div className="p-5 border-b border-[#E5DEC9] flex items-center justify-between bg-[#FAF7F2]">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#4D080F]">
                  Corporate Billing Statement & Ledger
                </h3>
                <p className="text-xs text-[#7C6E65]">
                  {selectedHouseAccount.companyName} • Code: {selectedHouseAccount.accountCode}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-white hover:bg-[#FAF7F2] text-[#4D080F] rounded-lg text-xs font-bold flex items-center gap-1.5 border border-[#E5DEC9] shadow-sm transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Statement
                </button>
                <button
                  onClick={() => setIsStatementModalOpen(false)}
                  className="text-[#7C6E65] hover:text-[#241311]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#FAF7F2]">
              {/* Statement Header Card */}
              <div className="bg-white p-5 rounded-xl border border-[#E5DEC9] flex flex-col sm:flex-row justify-between gap-4 shadow-sm">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#800D15] tracking-wider">
                    Choplife Republic Hospitality Group
                  </div>
                  <div className="text-xs text-[#7C6E65] mt-1">
                    Head Office: 8a Okogo Street, Opposite Wesley Hotel, Off Akhionbare, G.R.A., Benin City, Edo
                  </div>
                  <div className="text-xs text-[#7C6E65]">Phone: +234 815 817 7897 • finance@choplife.ng</div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-[#7C6E65]">Statement Date:</div>
                  <div className="font-bold text-sm text-[#241311]">
                    {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div className="text-xs text-amber-800 font-bold mt-1 font-mono">
                    Terms: {selectedHouseAccount.paymentTerms.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Balance Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-[#E5DEC9] shadow-sm">
                  <div className="text-[10px] text-[#7C6E65] font-medium">Approved Credit Limit</div>
                  <div className="text-lg font-bold font-mono text-[#241311]">
                    ₦{selectedHouseAccount.creditLimit.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-[#E5DEC9] shadow-sm">
                  <div className="text-[10px] text-[#7C6E65] font-medium">Current Net Outstanding</div>
                  <div className="text-lg font-bold font-mono text-[#800D15]">
                    ₦{selectedHouseAccount.currentBalance.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-[#E5DEC9] shadow-sm">
                  <div className="text-[10px] text-[#7C6E65] font-medium">Remaining Credit Line</div>
                  <div className="text-lg font-bold font-mono text-emerald-700">
                    ₦{Math.max(0, selectedHouseAccount.creditLimit - selectedHouseAccount.currentBalance).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Charges Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#4D080F] flex items-center justify-between">
                  <span>Dining & Banquet Charges Incurred</span>
                  <span className="text-xs font-mono text-[#7C6E65]">({accountCharges.length} entries)</span>
                </h4>
                <div className="bg-white rounded-xl border border-[#E5DEC9] overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF7F2] text-[10px] font-bold uppercase text-[#7C6E65] border-b border-[#E5DEC9]">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Check / Inv #</th>
                        <th className="p-3">Signer & Dept</th>
                        <th className="p-3">Notes</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DEC9]">
                      {accountCharges.map((c) => (
                        <tr key={c.id} className="hover:bg-[#FAF7F2]/50">
                          <td className="p-3 text-[#7C6E65] font-mono">
                            {new Date(c.timestamp).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-mono font-bold text-[#800D15]">{c.checkNumber}</td>
                          <td className="p-3 text-[#241311]">
                            <div className="font-medium">{c.authorizedSigner}</div>
                            <div className="text-[10px] text-[#7C6E65]">{c.department}</div>
                          </td>
                          <td className="p-3 text-xs text-[#7C6E65]">{c.notes}</td>
                          <td className="p-3 text-right font-mono font-bold text-[#241311]">
                            ₦{c.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {accountCharges.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-[#7C6E65]">
                            No charges logged to this corporate account.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#4D080F] flex items-center justify-between">
                  <span>Remittances & Settlement Payments</span>
                  <span className="text-xs font-mono text-emerald-700">({accountPayments.length} entries)</span>
                </h4>
                <div className="bg-white rounded-xl border border-[#E5DEC9] overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF7F2] text-[10px] font-bold uppercase text-[#7C6E65] border-b border-[#E5DEC9]">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Receipt #</th>
                        <th className="p-3">Method & Reference</th>
                        <th className="p-3">Received By</th>
                        <th className="p-3 text-right">Credit Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DEC9]">
                      {accountPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-[#FAF7F2]/50">
                          <td className="p-3 text-[#7C6E65] font-mono">
                            {new Date(p.timestamp).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-700">{p.receiptNumber}</td>
                          <td className="p-3 text-[#241311]">
                            <div className="capitalize font-medium">{p.paymentMethod.replace('_', ' ')}</div>
                            <div className="text-[10px] font-mono text-[#7C6E65]">{p.bankReference}</div>
                          </td>
                          <td className="p-3 text-[#7C6E65]">{p.receivedByStaffName}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            -₦{p.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {accountPayments.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-[#7C6E65]">
                            No remittance records found yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E5DEC9] bg-[#FAF7F2] flex justify-end">
              <button
                onClick={() => setIsStatementModalOpen(false)}
                className="px-5 py-2 bg-white text-[#241311] hover:bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-bold rounded-xl shadow-sm transition-colors"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
