import React, { useState, useEffect } from 'react';
import { BranchId, StaffUser } from '../../types';
import {
  Receipt,
  Plus,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  FileText,
  Upload,
  Eye,
  DollarSign,
  Building,
  ShieldCheck,
  BarChart3,
  Settings,
  Search,
  RefreshCw,
  Clock,
  ArrowUpRight,
  Lock,
  Trash2,
  Edit3,
  Wallet,
  Banknote,
  CreditCard,
  Filter,
} from 'lucide-react';
import { ExcelBulkImportAndMigrationModal } from '../common/ExcelBulkImportAndMigrationModal';

interface ExpenseClaimsWorkspaceProps {
  activeBranchId: BranchId;
  currentStaff: StaffUser;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ExpenseClaimsWorkspace: React.FC<ExpenseClaimsWorkspaceProps> = ({
  activeBranchId,
  currentStaff,
  showToast,
}) => {
  const canReviewOrManage = [
    'super_admin',
    'corporate_admin',
    'admin',
    'branch_manager',
    'store_manager',
    'kitchen_lead',
    'dispatch_manager',
    'accountant',
    'auditor',
  ].includes(currentStaff?.role || '');

  const canPayOrReconcile = [
    'super_admin',
    'corporate_admin',
    'admin',
    'branch_manager',
    'accountant',
  ].includes(currentStaff?.role || '');

  const canConfigureGovernance = [
    'super_admin',
    'corporate_admin',
    'admin',
    'accountant',
  ].includes(currentStaff?.role || '');

  const [activeSubTab, setActiveSubTab] = useState<'my_claims' | 'review_queue' | 'analytics_config'>(
    currentStaff?.role === 'accountant' || currentStaff?.role === 'auditor' ? 'review_queue' : 'my_claims'
  );

  const [categories, setCategories] = useState<any[]>([]);
  const [approvalMatrix, setApprovalMatrix] = useState<any | null>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [branchScopeFilter, setBranchScopeFilter] = useState<string>(
    ['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor'].includes(currentStaff?.role || '')
      ? 'all'
      : activeBranchId
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected claim for detail inspection
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);

  // New / Amend Claim Form State
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [claimType, setClaimType] = useState<'reimbursement_claim' | 'company_funded_expense' | 'cash_advance'>('reimbursement_claim');
  const [claimBranchId, setClaimBranchId] = useState<string>(activeBranchId || 'gra');
  const [department, setDepartment] = useState<string>('Kitchen & Operations');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string>('cat_kitchen_ingredients');
  const [customCategoryReason, setCustomCategoryReason] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');
  const [vendorPhoneOrTin, setVendorPhoneOrTin] = useState<string>('');
  const [receiptOrInvoiceRef, setReceiptOrInvoiceRef] = useState<string>('');
  const [vatAmount, setVatAmount] = useState<string>('0');
  const [whtAmount, setWhtAmount] = useState<string>('0');
  const [paymentMethodUsed, setPaymentMethodUsed] = useState<string>('personal_funds');
  const [claimantBankName, setClaimantBankName] = useState<string>('');
  const [claimantAccountNumber, setClaimantAccountNumber] = useState<string>('');
  const [claimantAccountName, setClaimantAccountName] = useState<string>(currentStaff?.name || '');
  const [linkedShiftId, setLinkedShiftId] = useState<string>('');
  const [linkedCashMovementId, setLinkedCashMovementId] = useState<string>('');
  const [linkedPurchaseOrderRef, setLinkedPurchaseOrderRef] = useState<string>('');
  const [lineItems, setLineItems] = useState<Array<{ description: string; quantity: number; unitCost: number }>>([
    { description: '', quantity: 1, unitCost: 0 },
  ]);
  const [uploadedAttachments, setUploadedAttachments] = useState<any[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState<boolean>(false);

  // Review / Settlement / Retirement / Reversal Modals
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);
  const [payoutMethod, setPayoutMethod] = useState<'bank_transfer' | 'petty_cash' | 'pos_cash_out'>('bank_transfer');
  const [payoutRef, setPayoutRef] = useState<string>('');
  const [payoutNotes, setPayoutNotes] = useState<string>('');

  const [isRetireModalOpen, setIsRetireModalOpen] = useState<boolean>(false);
  const [retireSpentAmount, setRetireSpentAmount] = useState<string>('');
  const [retireReturnedAmount, setRetireReturnedAmount] = useState<string>('0');
  const [retireReturnRef, setRetireReturnRef] = useState<string>('');
  const [retireNotes, setRetireNotes] = useState<string>('');

  const [isReverseModalOpen, setIsReverseModalOpen] = useState<boolean>(false);
  const [reversalReason, setReversalReason] = useState<string>('');

  // Protected Attachment Viewer Modal
  const [previewAttachment, setPreviewAttachment] = useState<{
    filename: string;
    mimeType: string;
    objectUrl: string;
  } | null>(null);

  const [bulkModalTab, setBulkModalTab] = useState<
    'expenses_import' | 'capex_opex_budgets' | 'ezee_migration' | null
  >(null);

  // Governance Config Form State
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatCode, setNewCatCode] = useState<string>('');
  const [newCatGlCode, setNewCatGlCode] = useState<string>('6700');
  const [newCatBudget, setNewCatBudget] = useState<string>('250000');

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('choplife_staff_token') || '';
    return {
      Authorization: `Bearer ${token}`,
      ...extra,
    };
  };

  const fetchConfigAndClaims = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (branchScopeFilter && branchScopeFilter !== 'all') params.append('branchId', branchScopeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('claimType', typeFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (activeSubTab === 'my_claims') params.append('mineOnly', 'true');

      const [resConfig, resClaims] = await Promise.all([
        fetch('/api/expenses/config', { headers: getAuthHeaders() }),
        fetch(`/api/expenses/claims?${params.toString()}`, { headers: getAuthHeaders() }),
      ]);

      if (resConfig.ok) {
        const cfg = await resConfig.json();
        setCategories(Array.isArray(cfg.categories) ? cfg.categories : []);
        setApprovalMatrix(cfg.approvalMatrix || null);
      }

      if (resClaims.ok) {
        const data = await resClaims.json();
        const loadedClaims = Array.isArray(data.claims) ? data.claims : [];
        setClaims(loadedClaims);
        if (selectedClaim) {
          const refreshed = loadedClaims.find((c: any) => c.id === selectedClaim.id);
          if (refreshed) setSelectedClaim(refreshed);
        } else if (loadedClaims.length > 0 && activeSubTab === 'review_queue') {
          setSelectedClaim(loadedClaims[0]);
        }
      } else {
        const err = await resClaims.json().catch(() => ({}));
        setFetchError(err.error || `Failed to load expense claims (HTTP ${resClaims.status})`);
      }

      if (canReviewOrManage) {
        const resAnalytics = await fetch(
          `/api/expenses/analytics${branchScopeFilter !== 'all' ? `?branchId=${branchScopeFilter}` : ''}`,
          { headers: getAuthHeaders() }
        );
        if (resAnalytics.ok) {
          setAnalytics(await resAnalytics.json());
        }
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Unable to connect to operational expense service.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigAndClaims();
  }, [activeSubTab, branchScopeFilter, statusFilter, typeFilter]);

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);
  const computedNetAmount = lineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
    0
  );
  const computedTotalAmount =
    Math.round((computedNetAmount + (Number(vatAmount) || 0) - (Number(whtAmount) || 0)) * 100) / 100;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Receipt file exceeds 5MB limit.', 'error');
      return;
    }

    setIsUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = String(reader.result || '');
          const res = await fetch('/api/expenses/attachments', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type || 'image/png',
              base64Data,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to upload attachment');
          setUploadedAttachments((prev) => [...prev, data.attachment]);
          showToast(`Uploaded receipt "${file.name}" securely!`, 'success');
        } catch (err: any) {
          showToast(err.message || 'Receipt upload failed', 'error');
        } finally {
          setIsUploadingFile(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsUploadingFile(false);
      showToast('Failed to read receipt file', 'error');
    }
  };

  const handlePreviewProtectedAttachment = async (attachmentId: string, filename: string) => {
    try {
      const res = await fetch(`/api/expenses/attachments/${attachmentId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Access denied (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPreviewAttachment({
        filename,
        mimeType: blob.type || 'image/png',
        objectUrl,
      });
    } catch (err: any) {
      showToast(err.message || 'Could not load protected attachment', 'error');
    }
  };

  const resetClaimForm = () => {
    setEditingClaimId(null);
    setClaimType('reimbursement_claim');
    setClaimBranchId(activeBranchId || 'gra');
    setDepartment('Kitchen & Operations');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setCategoryId(categories[0]?.id || 'cat_kitchen_ingredients');
    setCustomCategoryReason('');
    setTitle('');
    setDescription('');
    setVendorName('');
    setVendorPhoneOrTin('');
    setReceiptOrInvoiceRef('');
    setVatAmount('0');
    setWhtAmount('0');
    setPaymentMethodUsed('personal_funds');
    setLinkedShiftId('');
    setLinkedCashMovementId('');
    setLinkedPurchaseOrderRef('');
    setLineItems([{ description: '', quantity: 1, unitCost: 0 }]);
    setUploadedAttachments([]);
  };

  const handleLoadClaimForAmendment = (c: any) => {
    setEditingClaimId(c.id);
    setClaimType(c.claimType || 'reimbursement_claim');
    setClaimBranchId(c.branchId || activeBranchId);
    setDepartment(c.department || 'Kitchen & Operations');
    setExpenseDate(c.expenseDate ? c.expenseDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setCategoryId(c.categoryId || 'cat_kitchen_ingredients');
    setCustomCategoryReason(c.customCategoryReason || '');
    setTitle(c.title || '');
    setDescription(c.description || '');
    setVendorName(c.vendorName || '');
    setVendorPhoneOrTin(c.vendorPhoneOrTin || '');
    setReceiptOrInvoiceRef(c.receiptOrInvoiceRef || '');
    setVatAmount(String(c.vatAmount || 0));
    setWhtAmount(String(c.whtAmount || 0));
    setPaymentMethodUsed(c.paymentMethodUsed || 'personal_funds');
    setClaimantBankName(c.claimantBankName || '');
    setClaimantAccountNumber(c.claimantAccountNumber || '');
    setClaimantAccountName(c.claimantAccountName || currentStaff?.name || '');
    setLinkedShiftId(c.linkedShiftId || '');
    setLinkedCashMovementId(c.linkedCashMovementId || '');
    setLinkedPurchaseOrderRef(c.linkedPurchaseOrderRef || '');
    setLineItems(
      Array.isArray(c.lineItems) && c.lineItems.length > 0
        ? c.lineItems.map((li: any) => ({
            description: li.description,
            quantity: li.quantity,
            unitCost: li.unitCost,
          }))
        : [{ description: c.title || '', quantity: 1, unitCost: c.netAmount || c.totalAmount || 0 }]
    );
    setUploadedAttachments(Array.isArray(c.attachments) ? c.attachments : []);
    setActiveSubTab('my_claims');
  };

  const handleSubmitClaim = async (saveAsDraft: boolean) => {
    if (!title.trim()) {
      showToast('Please enter a short title for the expense claim.', 'error');
      return;
    }
    if (computedTotalAmount <= 0) {
      showToast('Total claim amount must be greater than ₦0.', 'error');
      return;
    }

    setIsSubmittingClaim(true);
    try {
      const payload = {
        branchId: claimBranchId,
        department,
        claimType,
        expenseDate,
        categoryId,
        customCategoryReason: customCategoryReason.trim() || undefined,
        title: title.trim(),
        description: description.trim() || title.trim(),
        vendorName: vendorName.trim() || 'General Vendor',
        vendorPhoneOrTin: vendorPhoneOrTin.trim() || undefined,
        receiptOrInvoiceRef: receiptOrInvoiceRef.trim(),
        lineItems: lineItems.filter((li) => li.description.trim() && Number(li.unitCost) > 0),
        netAmount: computedNetAmount,
        vatAmount: Number(vatAmount) || 0,
        whtAmount: Number(whtAmount) || 0,
        totalAmount: computedTotalAmount,
        paymentMethodUsed,
        claimantBankName: claimantBankName.trim() || undefined,
        claimantAccountNumber: claimantAccountNumber.trim() || undefined,
        claimantAccountName: claimantAccountName.trim() || undefined,
        linkedShiftId: linkedShiftId.trim() || undefined,
        linkedCashMovementId: linkedCashMovementId.trim() || undefined,
        linkedPurchaseOrderRef: linkedPurchaseOrderRef.trim() || undefined,
        attachmentIds: uploadedAttachments.map((a) => a.id),
        saveAsDraft,
        resubmit: !saveAsDraft,
      };

      const url = editingClaimId ? `/api/expenses/claims/${editingClaimId}` : '/api/expenses/claims';
      const method = editingClaimId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save expense claim');

      showToast(
        saveAsDraft
          ? `Draft ${data.claim.claimNumber} saved.`
          : `Expense claim ${data.claim.claimNumber} submitted for approval!`,
        'success'
      );
      resetClaimForm();
      fetchConfigAndClaims();
    } catch (err: any) {
      showToast(err.message || 'Submission failed', 'error');
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const handleReviewDecision = async (decision: 'approve' | 'return' | 'reject' | 'escalate') => {
    if (!selectedClaim) return;
    if ((decision === 'return' || decision === 'reject') && reviewComment.trim().length < 5) {
      showToast('Please provide a clear reason (at least 5 characters) when returning or rejecting a claim.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/expenses/claims/${selectedClaim.id}/review`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          decision,
          comment: reviewComment.trim() || `Claim ${decision}d by ${currentStaff.name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review action failed');

      showToast(`Claim ${data.claim.claimNumber} status updated to ${data.claim.status.toUpperCase()}`, 'success');
      setReviewComment('');
      setSelectedClaim(data.claim);
      fetchConfigAndClaims();
    } catch (err: any) {
      showToast(err.message || 'Review decision failed', 'error');
    }
  };

  const handleSettleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    try {
      const res = await fetch(`/api/expenses/claims/${selectedClaim.id}/pay`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          paymentMethod: payoutMethod,
          paymentReference: payoutRef.trim(),
          amountPaid: selectedClaim.totalAmount,
          notes: payoutNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Settlement failed');

      showToast(`Recorded settlement for ${data.claim.claimNumber} (${payoutRef})!`, 'success');
      setIsPayModalOpen(false);
      setPayoutRef('');
      setPayoutNotes('');
      setSelectedClaim(data.claim);
      fetchConfigAndClaims();
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    }
  };

  const handleRetireCashAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    try {
      const res = await fetch(`/api/expenses/claims/${selectedClaim.id}/retire-advance`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          actualSpentAmount: Number(retireSpentAmount) || 0,
          unspentCashReturned: Number(retireReturnedAmount) || 0,
          returnPaymentReference: retireReturnRef.trim() || undefined,
          attachmentIds: selectedClaim.attachments?.map((a: any) => a.id) || [],
          notes: retireNotes.trim() || 'Cash advance retired and verified',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cash advance retirement failed');

      showToast(`Cash advance ${data.claim.claimNumber} retired and reconciled!`, 'success');
      setIsRetireModalOpen(false);
      setSelectedClaim(data.claim);
      fetchConfigAndClaims();
    } catch (err: any) {
      showToast(err.message || 'Retirement failed', 'error');
    }
  };

  const handleReconcileClaim = async () => {
    if (!selectedClaim) return;
    try {
      const res = await fetch(`/api/expenses/claims/${selectedClaim.id}/reconcile`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          reconciliationNotes: `Verified against bank/petty cash statement by ${currentStaff.name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reconciliation failed');

      showToast(`Claim ${data.claim.claimNumber} marked as RECONCILED!`, 'success');
      setSelectedClaim(data.claim);
      fetchConfigAndClaims();
    } catch (err: any) {
      showToast(err.message || 'Reconciliation failed', 'error');
    }
  };

  const handleReverseClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    try {
      const res = await fetch(`/api/expenses/claims/${selectedClaim.id}/reverse`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          reason: reversalReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reversal failed');

      showToast(`Posted reversing journal entry for ${data.claim.claimNumber}!`, 'success');
      setIsReverseModalOpen(false);
      setReversalReason('');
      setSelectedClaim(data.claim);
      fetchConfigAndClaims();
    } catch (err: any) {
      showToast(err.message || 'Reversal failed', 'error');
    }
  };

  const handleSaveApprovalMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvalMatrix) return;
    try {
      const res = await fetch('/api/expenses/config', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          approvalMatrix,
          categories,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration');
      setApprovalMatrix(data.approvalMatrix);
      setCategories(data.categories);
      showToast('Expense governance thresholds and categories updated!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save configuration', 'error');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatCode.trim()) return;
    const newCat = {
      id: `cat_${newCatCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      code: newCatCode.toUpperCase().trim(),
      name: newCatName.trim(),
      description: `${newCatName.trim()} operational expense category`,
      accountingClassification: 'operating_expense',
      glAccountCode: newCatGlCode,
      requiresReceipt: true,
      approvalThresholdAmount: 50000,
      monthlyBranchBudget: Number(newCatBudget) || 250000,
      isActive: true,
      isOtherCategory: false,
    };
    const nextCats = [...categories, newCat];
    try {
      const res = await fetch('/api/expenses/config', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          categories: nextCats,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add category');
      setCategories(data.categories);
      setNewCatName('');
      setNewCatCode('');
      showToast(`Added expense category "${newCat.name}"!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add category', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reconciled':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'paid':
        return 'bg-teal-100 text-teal-900 border-teal-300';
      case 'approved':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'pending_additional_approval':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'submitted':
      case 'under_review':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'returned':
        return 'bg-orange-100 text-orange-900 border-orange-300';
      case 'rejected':
      case 'reversed':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-300';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 bg-[#FAF7F2] text-[#241311]">
      {/* Header Banner */}
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#800D15] text-[#FFC700] flex items-center justify-center shadow-xs shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-[#241311]">
                Operational Expense Claims, Cash Advances & Reimbursement Governance
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#800D15]/10 text-[#800D15] border border-[#800D15]/20 shrink-0">
                IFRS / DOUBLE-ENTRY GL
              </span>
            </div>
            <p className="text-xs text-[#7A6A65] mt-0.5">
              Submit staff out-of-pocket reimbursement claims, company-paid expenses, and operational cash advances with multi-stage approval & GL posting.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap bg-[#FAF7F2] p-1 rounded-xl border border-[#E5DEC9] gap-1">
            <button
              onClick={() => setActiveSubTab('my_claims')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'my_claims'
                  ? 'bg-[#800D15] text-white shadow-xs'
                  : 'text-[#7A6A65] hover:text-[#241311]'
              }`}
            >
              My Claims & New Request
            </button>
            {canReviewOrManage && (
              <button
                onClick={() => setActiveSubTab('review_queue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeSubTab === 'review_queue'
                    ? 'bg-[#800D15] text-white shadow-xs'
                    : 'text-[#7A6A65] hover:text-[#241311]'
                }`}
              >
                <span>Review & Settlement Queue</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#FFC700] text-[#4D080F] text-[10px] font-black">
                  {claims.filter((c) => ['submitted', 'under_review', 'pending_additional_approval', 'approved'].includes(c.status)).length}
                </span>
              </button>
            )}
            {canReviewOrManage && (
              <button
                onClick={() => setActiveSubTab('analytics_config')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeSubTab === 'analytics_config'
                    ? 'bg-[#800D15] text-white shadow-xs'
                    : 'text-[#7A6A65] hover:text-[#241311]'
                }`}
              >
                Analytics & Policy Matrix
              </button>
            )}
          </div>

          {canReviewOrManage && (
            <>
              <button
                onClick={() => setBulkModalTab('expenses_import')}
                className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-stone-100 border border-[#E5DEC9] text-[#4D080F] text-xs font-bold flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-[#800D15]" />
                <span>Excel Import</span>
              </button>
              <button
                onClick={() => setBulkModalTab('capex_opex_budgets')}
                className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-stone-100 border border-[#E5DEC9] text-[#4D080F] text-xs font-bold flex items-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[#800D15]" />
                <span>CAPEX/OPEX Budgets</span>
              </button>
              <button
                onClick={() => setBulkModalTab('ezee_migration')}
                className="px-3 py-1.5 rounded-xl bg-[#800D15] hover:bg-[#4D080F] text-[#FFC700] text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>eZee Historical Migration</span>
              </button>
            </>
          )}

          <button
            onClick={fetchConfigAndClaims}
            className="p-2 bg-[#FAF7F2] hover:bg-stone-100 border border-[#E5DEC9] rounded-xl text-[#5C4942]"
            title="Refresh Claims"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={fetchConfigAndClaims}
            className="px-3 py-1 bg-white border border-rose-300 rounded-lg font-bold text-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: MY CLAIMS & NEW SUBMISSION */}
      {/* ========================================================================= */}
      {activeSubTab === 'my_claims' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Submission Form */}
          <div className="lg:col-span-7 bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div>
                <h2 className="text-sm font-black text-[#241311]">
                  {editingClaimId ? 'Amend & Resubmit Expense Claim' : 'Submit Operational Expense / Reimbursement Claim'}
                </h2>
                <p className="text-[11px] text-[#7A6A65]">
                  Claimant: <strong>{currentStaff?.name}</strong> ({currentStaff?.role?.replace('_', ' ')})
                </p>
              </div>
              {editingClaimId && (
                <button
                  onClick={resetClaimForm}
                  className="px-2.5 py-1 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs font-bold text-[#800D15]"
                >
                  Cancel Amendment
                </button>
              )}
            </div>

            {/* Transaction Type Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  id: 'reimbursement_claim',
                  label: 'Staff Reimbursement',
                  sub: 'Out-of-pocket spend owed to staff (Cr 2100)',
                },
                {
                  id: 'company_funded_expense',
                  label: 'Company-Paid Expense',
                  sub: 'Petty cash / company card spend (Cr 1010/1030)',
                },
                {
                  id: 'cash_advance',
                  label: 'Operational Cash Advance',
                  sub: 'Float advance retired with receipts (Dr 1150)',
                },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setClaimType(t.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    claimType === t.id
                      ? 'bg-[#FFF8E7] border-[#800D15] ring-1 ring-[#800D15]'
                      : 'bg-[#FAF7F2] border-[#E5DEC9] hover:border-[#800D15]/40'
                  }`}
                >
                  <div className="text-xs font-black text-[#241311]">{t.label}</div>
                  <div className="text-[10px] text-[#7A6A65] mt-0.5 leading-tight">{t.sub}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Branch Location *</label>
                <select
                  value={claimBranchId}
                  onChange={(e) => setClaimBranchId(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                >
                  <option value="gra">GRA Flagship (Benin)</option>
                  <option value="okabere">Okabere Road Hub</option>
                  <option value="ugbowo">Ugbowo Campus Hub</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Department / Cost Centre *</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                >
                  <option value="Kitchen & Operations">Kitchen & Operations</option>
                  <option value="Front-of-House & POS">Front-of-House & POS</option>
                  <option value="Dispatch & Fleet">Dispatch & Fleet</option>
                  <option value="Store & Inventory">Store & Inventory</option>
                  <option value="Facilities & Engineering">Facilities & Engineering</option>
                  <option value="Administration & Finance">Administration & Finance</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Expense Date *</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Expense Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      [{cat.code}] {cat.name} (GL {cat.glAccountCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Claim Title / Summary *</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency diesel purchase for GRA standby generator"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                />
              </div>
            </div>

            {selectedCategoryObj?.isOtherCategory && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-xs">
                <label className="font-bold text-amber-900 block">
                  Mandatory Specification for "Other / Miscellaneous" Category *
                </label>
                <input
                  type="text"
                  placeholder="Explain why no standard expense category applies (minimum 10 characters)..."
                  value={customCategoryReason}
                  onChange={(e) => setCustomCategoryReason(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-[#241311]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Vendor / Supplier Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Oando Sapele Rd / New Benin Market"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                />
              </div>
              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Receipt / Invoice Reference *</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-8841 or POS-STAN-4410"
                  value={receiptOrInvoiceRef}
                  onChange={(e) => setReceiptOrInvoiceRef(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 font-mono text-[#241311]"
                />
              </div>
              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Payment Instrument Used</label>
                <select
                  value={paymentMethodUsed}
                  onChange={(e) => setPaymentMethodUsed(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                >
                  <option value="personal_funds">Staff Personal Funds (Reimbursable)</option>
                  <option value="petty_cash">Branch Petty Cash / Till Paid-Out</option>
                  <option value="company_bank_transfer">Company Bank Transfer</option>
                  <option value="company_card">Company Expense Card</option>
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#5C4942]">Itemized Expense Breakdown</label>
                <button
                  type="button"
                  onClick={() => setLineItems([...lineItems, { description: '', quantity: 1, unitCost: 0 }])}
                  className="text-xs font-bold text-[#800D15] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Line Item
                </button>
              </div>

              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                    <input
                      type="text"
                      placeholder="Item description (e.g. 50 Litres Automotive Gas Oil)"
                      value={item.description}
                      onChange={(e) => {
                        const next = [...lineItems];
                        next[idx].description = e.target.value;
                        setLineItems(next);
                      }}
                      className="col-span-6 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-[#241311]"
                    />
                    <input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const next = [...lineItems];
                        next[idx].quantity = Number(e.target.value) || 1;
                        setLineItems(next);
                      }}
                      className="col-span-2 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2 py-1.5 font-mono text-[#241311]"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Unit Cost (₦)"
                      value={item.unitCost || ''}
                      onChange={(e) => {
                        const next = [...lineItems];
                        next[idx].unitCost = Number(e.target.value) || 0;
                        setLineItems(next);
                      }}
                      className="col-span-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2 py-1.5 font-mono text-[#241311]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (lineItems.length > 1) {
                          setLineItems(lineItems.filter((_, i) => i !== idx));
                        }
                      }}
                      className="col-span-1 text-[#7A6A65] hover:text-rose-600 flex justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax & Total Row */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs">
              <div>
                <label className="text-[11px] font-bold text-[#7A6A65] block">Recoverable Input VAT (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={vatAmount}
                  onChange={(e) => setVatAmount(e.target.value)}
                  className="w-full mt-1 bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1 font-mono text-[#241311]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#7A6A65] block">Withholding Tax Deducted (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={whtAmount}
                  onChange={(e) => setWhtAmount(e.target.value)}
                  className="w-full mt-1 bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1 font-mono text-[#241311]"
                />
              </div>
              <div className="flex flex-col justify-center text-right">
                <span className="text-[11px] font-bold text-[#7A6A65]">Total Claim Payable</span>
                <span className="text-lg font-mono font-black text-[#800D15]">
                  ₦{computedTotalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Claimant Reimbursement Bank Details */}
            {claimType === 'reimbursement_claim' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-[#FFF8E7] border border-[#FFC700]/50 rounded-xl text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#800D15] uppercase">Reimbursement Bank</label>
                  <input
                    type="text"
                    placeholder="e.g. Zenith Bank / GTBank"
                    value={claimantBankName}
                    onChange={(e) => setClaimantBankName(e.target.value)}
                    className="w-full mt-0.5 bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-[#241311]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#800D15] uppercase">NUBAN Account No.</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="0123456789"
                    value={claimantAccountNumber}
                    onChange={(e) => setClaimantAccountNumber(e.target.value)}
                    className="w-full mt-0.5 bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 font-mono text-[#241311]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#800D15] uppercase">Beneficiary Name</label>
                  <input
                    type="text"
                    value={claimantAccountName}
                    onChange={(e) => setClaimantAccountName(e.target.value)}
                    className="w-full mt-0.5 bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-[#241311]"
                  />
                </div>
              </div>
            )}

            {/* Supporting Receipt Attachment Upload */}
            <div className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#241311]">Supporting Receipt / Invoice Evidence</span>
                  <p className="text-[11px] text-[#7A6A65]">
                    Stored in access-controlled audit storage (`GET /api/expenses/attachments/:id`).
                  </p>
                </div>
                <label className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-[#E5DEC9] rounded-xl font-bold text-xs text-[#800D15] cursor-pointer flex items-center gap-1.5 shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingFile ? 'Uploading...' : 'Attach Receipt'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {uploadedAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {uploadedAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="px-2.5 py-1 bg-white border border-[#E5DEC9] rounded-lg flex items-center gap-2 text-[11px]"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#800D15]" />
                      <span className="font-medium text-[#241311]">{att.filename}</span>
                      <button
                        type="button"
                        onClick={() => handlePreviewProtectedAttachment(att.id, att.filename)}
                        className="text-[#800D15] font-bold hover:underline"
                      >
                        Preview
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSubmittingClaim}
                onClick={() => handleSubmitClaim(true)}
                className="px-4 py-2.5 bg-[#FAF7F2] hover:bg-stone-100 border border-[#E5DEC9] text-[#5C4942] text-xs font-bold rounded-xl"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={isSubmittingClaim}
                onClick={() => handleSubmitClaim(false)}
                className="px-5 py-2.5 bg-[#800D15] hover:bg-[#96121B] text-white text-xs font-black rounded-xl shadow-xs"
              >
                {editingClaimId ? 'Resubmit Amended Claim' : 'Submit Claim for Approval'}
              </button>
            </div>
          </div>

          {/* Right: My Submitted Claims History */}
          <div className="lg:col-span-5 bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-4 shadow-2xs flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <h2 className="text-sm font-black text-[#241311]">My Expense Claims ({claims.length})</h2>
              <span className="text-[11px] text-[#7A6A65]">Live status & audit history</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[680px] pr-1">
              {claims.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-2 hover:border-[#800D15]/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-[#800D15]">{c.claimNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(c.status)}`}>
                          {c.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="font-bold text-xs text-[#241311] mt-1">{c.title}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-sm text-[#241311]">
                        ₦{Number(c.totalAmount || 0).toLocaleString()}
                      </span>
                      <span className="block text-[10px] text-[#7A6A65]">{c.categoryName}</span>
                    </div>
                  </div>

                  {c.returnOrRejectReason && (
                    <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg text-[11px] text-orange-900">
                      <strong>Reviewer Feedback:</strong> {c.returnOrRejectReason}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[#7A6A65] pt-1 border-t border-[#E5DEC9]">
                    <span>Ref: {c.receiptOrInvoiceRef || 'N/A'}</span>
                    <div className="flex items-center gap-2">
                      {(c.status === 'draft' || c.status === 'returned') && (
                        <button
                          onClick={() => handleLoadClaimForAmendment(c)}
                          className="px-2.5 py-1 bg-[#800D15] text-white rounded-lg font-bold text-[10px]"
                        >
                          Amend & Resubmit
                        </button>
                      )}
                      {canReviewOrManage && (
                        <button
                          onClick={() => {
                            setSelectedClaim(c);
                            setActiveSubTab('review_queue');
                          }}
                          className="px-2 py-1 bg-white border border-[#E5DEC9] text-[#241311] rounded-lg font-bold text-[10px]"
                        >
                          Inspect
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {claims.length === 0 && !isLoading && (
                <div className="py-12 text-center space-y-2 text-[#7A6A65]">
                  <Receipt className="w-8 h-8 mx-auto text-[#E5DEC9]" />
                  <p className="text-xs font-bold text-[#241311]">No personal expense claims submitted yet</p>
                  <p className="text-[11px]">
                    Use the form on the left to submit a reimbursement request, company expense, or operational cash advance.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: BRANCH & FINANCE REVIEW QUEUE */}
      {/* ========================================================================= */}
      {activeSubTab === 'review_queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Filterable Queue */}
          <div className="lg:col-span-5 bg-white border border-[#E5DEC9] rounded-2xl p-4 space-y-3 shadow-2xs flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <select
                value={branchScopeFilter}
                onChange={(e) => setBranchScopeFilter(e.target.value)}
                className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-[#241311] font-bold"
              >
                <option value="all">All Allowed Branches</option>
                <option value="gra">GRA Flagship</option>
                <option value="okabere">Okabere Hub</option>
                <option value="ugbowo">Ugbowo Hub</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-[#241311]"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="pending_additional_approval">Pending Finance Escalation</option>
                <option value="approved">Approved (Awaiting Payout)</option>
                <option value="paid">Paid / Disbursed</option>
                <option value="reconciled">Reconciled</option>
                <option value="returned">Returned</option>
                <option value="rejected">Rejected</option>
                <option value="reversed">Reversed</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-[#241311]"
              >
                <option value="all">All Claim Types</option>
                <option value="reimbursement_claim">Reimbursements</option>
                <option value="company_funded_expense">Company-Paid</option>
                <option value="cash_advance">Cash Advances</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#7A6A65] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search claim #, claimant, vendor, receipt ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchConfigAndClaims()}
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl pl-9 pr-16 py-2 text-xs text-[#241311]"
              />
              <button
                onClick={fetchConfigAndClaims}
                className="absolute right-1.5 top-1.5 px-2.5 py-1 bg-[#800D15] text-white text-[10px] font-bold rounded-lg"
              >
                Filter
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[620px] pr-1">
              {claims.map((c) => {
                const isSelected = selectedClaim?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClaim(c)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#FFF8E7] border-[#800D15] shadow-xs'
                        : 'bg-[#FAF7F2] border-[#E5DEC9] hover:border-[#800D15]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-xs text-[#800D15]">{c.claimNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(c.status)}`}>
                        {c.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-xs text-[#241311] truncate max-w-[200px]">{c.title}</span>
                      <span className="font-mono font-black text-xs text-[#241311]">
                        ₦{Number(c.totalAmount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-[#7A6A65]">
                      <span>
                        {c.claimantStaffName} • <strong className="uppercase">{c.branchId}</strong>
                      </span>
                      <span>{c.categoryName}</span>
                    </div>
                    {Array.isArray(c.fraudFlags) && c.fraudFlags.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>{c.fraudFlags.length} Audit Review Flag(s)</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {claims.length === 0 && !isLoading && (
                <div className="py-10 text-center text-xs text-[#7A6A65]">
                  No expense claims matched the current queue filter.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Detailed Claim Inspection, Approval & Accounting Panel */}
          <div className="lg:col-span-7">
            {selectedClaim ? (
              <div className="bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DEC9] pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-lg text-[#800D15]">
                        {selectedClaim.claimNumber}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase border ${getStatusBadge(selectedClaim.status)}`}>
                        {selectedClaim.status.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#E5DEC9] text-[10px] font-mono uppercase font-bold text-[#5C4942]">
                        {selectedClaim.claimType?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h3 className="font-black text-base text-[#241311] mt-1">{selectedClaim.title}</h3>
                    <p className="text-xs text-[#7A6A65]">
                      Submitted by <strong>{selectedClaim.claimantStaffName}</strong> ({selectedClaim.claimantRole}) • Branch:{' '}
                      <strong className="uppercase">{selectedClaim.branchId}</strong> • Expense Date: {selectedClaim.expenseDate?.slice(0, 10)}
                    </p>
                  </div>

                  <div className="text-right bg-[#FAF7F2] px-4 py-2.5 rounded-xl border border-[#E5DEC9]">
                    <span className="text-[10px] uppercase font-bold text-[#7A6A65] block">Total Claim Amount</span>
                    <span className="font-mono font-black text-xl text-[#800D15]">
                      ₦{Number(selectedClaim.totalAmount || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-mono text-[#5C4942] block">
                      GL Account: {selectedClaim.glAccountCode} ({selectedClaim.categoryName})
                    </span>
                  </div>
                </div>

                {/* Fraud / Audit Flags */}
                {Array.isArray(selectedClaim.fraudFlags) && selectedClaim.fraudFlags.length > 0 && (
                  <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <span>Automated Internal Control & Fraud-Risk Indicators</span>
                    </div>
                    {selectedClaim.fraudFlags.map((f: any, idx: number) => (
                      <div key={idx} className="text-xs text-amber-900 flex items-center justify-between">
                        <span>• [{f.code.toUpperCase()}] {f.description}</span>
                        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-200/70 font-bold">
                          {f.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Vendor, Receipt & Reimbursement Bank Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[#7A6A65]">Vendor & Evidence Reference</span>
                    <p className="font-bold text-[#241311]">{selectedClaim.vendorName}</p>
                    <p className="font-mono text-[#800D15]">Receipt/Invoice #: {selectedClaim.receiptOrInvoiceRef || 'None'}</p>
                    <p className="text-[#5C4942]">Department: {selectedClaim.department}</p>
                  </div>

                  <div className="p-3 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[#7A6A65]">Settlement & Accounting Classification</span>
                    <p className="font-bold text-[#241311] capitalize">
                      {selectedClaim.accountingClassification?.replace(/_/g, ' ')}
                    </p>
                    {selectedClaim.claimantBankName && (
                      <p className="text-[#5C4942]">
                        Payee Bank: {selectedClaim.claimantBankName} • {selectedClaim.claimantAccountNumber} ({selectedClaim.claimantAccountName})
                      </p>
                    )}
                    {selectedClaim.paymentRecord && (
                      <p className="text-emerald-800 font-mono font-bold">
                        Paid Ref: {selectedClaim.paymentRecord.paymentReference} ({selectedClaim.paymentRecord.paymentMethod})
                      </p>
                    )}
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white border-b border-[#E5DEC9] text-[10px] uppercase font-bold text-[#7A6A65]">
                      <tr>
                        <th className="p-2.5">Line Item Description</th>
                        <th className="p-2.5 text-right">Qty</th>
                        <th className="p-2.5 text-right">Unit Cost</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DEC9]">
                      {selectedClaim.lineItems?.map((li: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-medium text-[#241311]">{li.description}</td>
                          <td className="p-2.5 text-right font-mono">{li.quantity}</td>
                          <td className="p-2.5 text-right font-mono">₦{Number(li.unitCost || 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono font-bold">₦{Number(li.totalCost || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Protected Attachments */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-[#5C4942]">
                    Uploaded Receipts & Supporting Documents ({selectedClaim.attachments?.length || 0})
                  </span>
                  {selectedClaim.attachments && selectedClaim.attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedClaim.attachments.map((att: any) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() => handlePreviewProtectedAttachment(att.id, att.filename)}
                          className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#FFF8E7] border border-[#E5DEC9] rounded-xl text-xs font-bold text-[#800D15] flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View {att.filename}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#7A6A65] italic">No digital receipt attachment uploaded.</p>
                  )}
                </div>

                {/* Approval & Review Controls */}
                {['submitted', 'under_review', 'pending_additional_approval'].includes(selectedClaim.status) && (
                  <div className="p-4 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#241311]">Supervisor / Manager / Finance Review Decision</span>
                      {selectedClaim.claimantStaffId === currentStaff.id && (
                        <span className="px-2.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold">
                          Self-Approval Prohibited (Claimant = Active User)
                        </span>
                      )}
                    </div>

                    <textarea
                      rows={2}
                      placeholder="Enter review comment, approval note, or mandatory reason for returning/rejecting..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311]"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={selectedClaim.claimantStaffId === currentStaff.id}
                        onClick={() => handleReviewDecision('approve')}
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                          selectedClaim.claimantStaffId === currentStaff.id
                            ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve Claim
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReviewDecision('return')}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Return for Clarification
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReviewDecision('reject')}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject Claim
                      </button>
                    </div>
                  </div>
                )}

                {/* Post-Approval Settlement, Advance Retirement, Reconciliation & Reversal Bar */}
                {canPayOrReconcile && (
                  <div className="pt-2 border-t border-[#E5DEC9] flex flex-wrap items-center gap-2.5">
                    {selectedClaim.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutRef(`EXP-PAY-${Math.floor(100000 + Math.random() * 900000)}`);
                          setIsPayModalOpen(true);
                        }}
                        className="px-4 py-2 bg-[#800D15] hover:bg-[#96121B] text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-xs"
                      >
                        <DollarSign className="w-4 h-4 text-[#FFC700]" />
                        <span>
                          {selectedClaim.claimType === 'cash_advance'
                            ? 'Record Cash Advance Disbursement'
                            : 'Record Reimbursement Payout'}
                        </span>
                      </button>
                    )}

                    {selectedClaim.claimType === 'cash_advance' &&
                      selectedClaim.status === 'paid' &&
                      !selectedClaim.cashAdvanceRetirement && (
                        <button
                          type="button"
                          onClick={() => {
                            setRetireSpentAmount(String(selectedClaim.totalAmount));
                            setRetireReturnedAmount('0');
                            setIsRetireModalOpen(true);
                          }}
                          className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-4 h-4" /> Retire Cash Advance (Dr Expense / Cr 1150)
                        </button>
                      )}

                    {selectedClaim.status === 'paid' && (
                      <button
                        type="button"
                        onClick={handleReconcileClaim}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Mark Reconciled with Bank/Till
                      </button>
                    )}

                    {['approved', 'paid', 'reconciled'].includes(selectedClaim.status) && (
                      <button
                        type="button"
                        onClick={() => setIsReverseModalOpen(true)}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Controlled GL Reversal
                      </button>
                    )}
                  </div>
                )}

                {/* Immutable Approval & Audit Trail */}
                <div className="space-y-2 pt-2 border-t border-[#E5DEC9]">
                  <span className="text-xs font-bold uppercase text-[#7A6A65]">Immutable Lifecycle Audit History</span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedClaim.approvalHistory?.map((h: any) => (
                      <div
                        key={h.id}
                        className="p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold uppercase text-[#800D15]">[{h.action}]</span>{' '}
                          <span className="font-semibold text-[#241311]">{h.actorName}</span>{' '}
                          <span className="text-[#7A6A65]">({h.actorRole})</span>
                          {h.comment && <p className="text-[11px] text-[#5C4942] mt-0.5">{h.comment}</p>}
                        </div>
                        <span className="text-[10px] font-mono text-[#7A6A65]">
                          {new Date(h.timestamp).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full bg-white border border-[#E5DEC9] rounded-2xl p-8 flex flex-col items-center justify-center text-center text-[#7A6A65]">
                <Receipt className="w-10 h-10 text-[#E5DEC9] mb-2" />
                <p className="text-sm font-bold text-[#241311]">Select an Expense Claim to Inspect</p>
                <p className="text-xs max-w-sm mt-1">
                  Review line items, verify receipt attachments, inspect automated duplicate/split-claim flags, and execute approvals or settlements.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: ANALYTICS & GOVERNANCE CONFIGURATION */}
      {/* ========================================================================= */}
      {activeSubTab === 'analytics_config' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          {analytics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E5DEC9] p-4 rounded-2xl shadow-2xs">
                <span className="text-xs text-[#7A6A65]">Approved & Reconciled Spend</span>
                <div className="text-2xl font-mono font-black text-[#800D15] mt-1">
                  ₦{Number(analytics.summary?.totalApprovedSpend || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold">Posted to General Ledger</span>
              </div>

              <div className="bg-white border border-[#E5DEC9] p-4 rounded-2xl shadow-2xs">
                <span className="text-xs text-[#7A6A65]">Awaiting Approval Queue</span>
                <div className="text-2xl font-mono font-black text-amber-700 mt-1">
                  ₦{Number(analytics.summary?.pendingReviewAmount || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-[#7A6A65]">
                  {analytics.summary?.pendingReviewCount || 0} claim(s) pending review
                </span>
              </div>

              <div className="bg-white border border-[#E5DEC9] p-4 rounded-2xl shadow-2xs">
                <span className="text-xs text-[#7A6A65]">Approved Awaiting Payout (2100)</span>
                <div className="text-2xl font-mono font-black text-blue-800 mt-1">
                  ₦{Number(analytics.summary?.pendingPayoutAmount || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-[#7A6A65]">
                  {analytics.summary?.pendingPayoutCount || 0} reimbursement(s) payable
                </span>
              </div>

              <div className="bg-white border border-[#E5DEC9] p-4 rounded-2xl shadow-2xs">
                <span className="text-xs text-[#7A6A65]">Unretired Cash Advances (1150)</span>
                <div className="text-2xl font-mono font-black text-purple-800 mt-1">
                  ₦{Number(analytics.summary?.openCashAdvancesAmount || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-[#7A6A65]">
                  Avg Approval Turnaround: {analytics.summary?.avgApprovalTurnaroundHours || 0} hrs
                </span>
              </div>
            </div>
          )}

          {/* Category Budget vs Actuals & Governance Config */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-black text-[#241311]">
                Spend by Category vs. Monthly Branch Budget
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF7F2] border-b border-[#E5DEC9] text-[10px] uppercase font-bold text-[#7A6A65]">
                    <tr>
                      <th className="p-2.5">Category & GL Code</th>
                      <th className="p-2.5 text-right">Claims</th>
                      <th className="p-2.5 text-right">Approved Spend</th>
                      <th className="p-2.5 text-right">Monthly Budget</th>
                      <th className="p-2.5 text-right">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DEC9]">
                    {analytics?.byCategory?.map((cat: any) => (
                      <tr key={cat.categoryId}>
                        <td className="p-2.5">
                          <div className="font-bold text-[#241311]">{cat.categoryName}</div>
                          <div className="text-[10px] font-mono text-[#7A6A65]">
                            {cat.code} • GL {cat.glAccountCode}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-mono">{cat.claimCount}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-[#800D15]">
                          ₦{Number(cat.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-mono text-[#5C4942]">
                          ₦{Number(cat.monthlyBranchBudget || 0).toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              (cat.budgetUtilizationPct || 0) > 90
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {cat.budgetUtilizationPct || 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Configurable Approval Matrix */}
            <div className="lg:col-span-5 bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-black text-[#241311]">
                Approval Matrix & Anti-Fraud Thresholds
              </h3>

              {approvalMatrix && (
                <form onSubmit={handleSaveApprovalMatrix} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-[#5C4942] block mb-1">Supervisor Limit (₦)</label>
                      <input
                        type="number"
                        disabled={!canConfigureGovernance}
                        value={approvalMatrix.supervisorLimit}
                        onChange={(e) =>
                          setApprovalMatrix({ ...approvalMatrix, supervisorLimit: Number(e.target.value) })
                        }
                        className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#5C4942] block mb-1">Branch Manager Limit (₦)</label>
                      <input
                        type="number"
                        disabled={!canConfigureGovernance}
                        value={approvalMatrix.branchManagerLimit}
                        onChange={(e) =>
                          setApprovalMatrix({ ...approvalMatrix, branchManagerLimit: Number(e.target.value) })
                        }
                        className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#5C4942] block mb-1">Finance Manager Limit (₦)</label>
                      <input
                        type="number"
                        disabled={!canConfigureGovernance}
                        value={approvalMatrix.financeManagerLimit}
                        onChange={(e) =>
                          setApprovalMatrix({ ...approvalMatrix, financeManagerLimit: Number(e.target.value) })
                        }
                        className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#5C4942] block mb-1">Mandatory Receipt Above (₦)</label>
                      <input
                        type="number"
                        disabled={!canConfigureGovernance}
                        value={approvalMatrix.requireReceiptAboveAmount}
                        onChange={(e) =>
                          setApprovalMatrix({
                            ...approvalMatrix,
                            requireReceiptAboveAmount: Number(e.target.value),
                          })
                        }
                        className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-1.5 font-mono"
                      />
                    </div>
                  </div>

                  {canConfigureGovernance && (
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#800D15] hover:bg-[#96121B] text-white font-bold rounded-xl"
                    >
                      Save Approval Matrix Thresholds
                    </button>
                  )}
                </form>
              )}

              {canConfigureGovernance && (
                <form onSubmit={handleAddCategory} className="pt-3 border-t border-[#E5DEC9] space-y-2.5 text-xs">
                  <div className="font-black text-[#241311]">Add Custom Expense Category</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Category Name"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      placeholder="Code (e.g. EXP-SECURITY)"
                      value={newCatCode}
                      onChange={(e) => setNewCatCode(e.target.value)}
                      className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#FAF7F2] hover:bg-stone-100 border border-[#E5DEC9] text-[#800D15] font-bold rounded-xl"
                  >
                    + Register Category
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD REIMBURSEMENT PAYOUT / ADVANCE DISBURSEMENT */}
      {/* ========================================================================= */}
      {isPayModalOpen && selectedClaim && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSettleClaim}
            className="bg-white border border-[#E5DEC9] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-black text-base text-[#241311]">
              Record Settlement: {selectedClaim.claimNumber}
            </h3>
            <p className="text-xs text-[#7A6A65]">
              Payee: <strong>{selectedClaim.claimantStaffName}</strong> • Amount:{' '}
              <strong className="font-mono text-[#800D15]">₦{Number(selectedClaim.totalAmount).toLocaleString()}</strong>
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Disbursement Channel</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as any)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                >
                  <option value="bank_transfer">Corporate Bank Transfer (Cr 1030)</option>
                  <option value="petty_cash">Branch Petty Cash / Till (Cr 1010)</option>
                  <option value="pos_cash_out">POS Terminal Cash-Out (Cr 1010)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Payment / Bank Session Reference *</label>
                <input
                  type="text"
                  required
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 font-mono text-[#241311]"
                />
              </div>

              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Settlement Notes</label>
                <input
                  type="text"
                  placeholder="Optional treasury voucher note"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="flex-1 py-2 bg-[#FAF7F2] border border-[#E5DEC9] text-[#5C4942] text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#800D15] text-white text-xs font-black rounded-xl"
              >
                Confirm Settlement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RETIRE OPERATIONAL CASH ADVANCE */}
      {/* ========================================================================= */}
      {isRetireModalOpen && selectedClaim && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleRetireCashAdvance}
            className="bg-white border border-[#E5DEC9] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-black text-base text-[#241311]">
              Retire Operational Cash Advance: {selectedClaim.claimNumber}
            </h3>
            <p className="text-xs text-[#7A6A65]">
              Original Advance Disbursed (1150):{' '}
              <strong className="font-mono text-[#800D15]">₦{Number(selectedClaim.totalAmount).toLocaleString()}</strong>
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Substantiated Expense Spent (₦) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={retireSpentAmount}
                  onChange={(e) => setRetireSpentAmount(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 font-mono text-[#241311]"
                />
              </div>

              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Unspent Cash Returned to Till/Bank (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={retireReturnedAmount}
                  onChange={(e) => setRetireReturnedAmount(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 font-mono text-[#241311]"
                />
              </div>

              <div>
                <label className="font-bold text-[#5C4942] block mb-1">Return Receipt / Deposit Reference</label>
                <input
                  type="text"
                  placeholder="e.g. TILL-RET-901"
                  value={retireReturnRef}
                  onChange={(e) => setRetireReturnRef(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 font-mono text-[#241311]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRetireModalOpen(false)}
                className="flex-1 py-2 bg-[#FAF7F2] border border-[#E5DEC9] text-[#5C4942] text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-purple-700 text-white text-xs font-black rounded-xl"
              >
                Post Retirement Journal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONTROLLED ACCOUNTING REVERSAL */}
      {/* ========================================================================= */}
      {isReverseModalOpen && selectedClaim && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleReverseClaim}
            className="bg-white border border-[#E5DEC9] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <h3 className="font-black text-base text-rose-800">
              Controlled Accounting Reversal: {selectedClaim.claimNumber}
            </h3>
            <p className="text-xs text-[#5C4942]">
              Approved/paid claims are never silently deleted. This action posts an offsetting double-entry reversal journal entry in the General Ledger.
            </p>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-[#5C4942]">Mandatory Audit Reversal Reason *</label>
              <textarea
                rows={3}
                required
                placeholder="Explain why this approved/paid claim is being reversed..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReverseModalOpen(false)}
                className="flex-1 py-2 bg-[#FAF7F2] border border-[#E5DEC9] text-[#5C4942] text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-rose-600 text-white text-xs font-black rounded-xl"
              >
                Execute GL Reversal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PROTECTED ATTACHMENT PREVIEW */}
      {/* ========================================================================= */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div>
                <h3 className="font-black text-sm text-[#241311]">{previewAttachment.filename}</h3>
                <p className="text-[11px] text-[#7A6A65]">Authenticated RBAC Evidence Viewer</p>
              </div>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewAttachment.objectUrl);
                  setPreviewAttachment(null);
                }}
                className="px-3 py-1 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex justify-center bg-[#FAF7F2] p-4 rounded-xl border border-[#E5DEC9]">
              <img
                src={previewAttachment.objectUrl}
                alt={previewAttachment.filename}
                className="max-h-[60vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
      <ExcelBulkImportAndMigrationModal
        isOpen={bulkModalTab !== null}
        onClose={() => setBulkModalTab(null)}
        defaultTab={bulkModalTab || 'expenses_import'}
        onSuccessRefresh={fetchConfigAndClaims}
        showToast={showToast}
      />
    </div>
  );
};
