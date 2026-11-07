import React, { useState, useEffect } from 'react';
import { safeParseApiResponse } from '../../utils/apiResponseParser';
import { useApp } from '../../context/AppContext';
import { BranchId, Product, StaffRole } from '../../types';
import {
  Store,
  LayoutGrid,
  ChefHat,
  Truck,
  Boxes,
  Clock,
  BarChart3,
  Users,
  ShieldCheck,
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  Building,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  LogOut,
  ExternalLink,
  Split,
  Tag,
  FileSpreadsheet,
  Lock,
  RefreshCw,
  Printer,
  Sliders,
  DollarSign,
  ArrowRight,
  Sparkles,
  Phone,
  Bell,
  MapPin,
  UtensilsCrossed,
  Filter,
  Eye,
  Calendar,
  AlertCircle,
  HelpCircle,
  Layers,
  ChevronRight,
  Download,
  Info,
  MoveRight,
  Award,
  Wallet,
  Scan,
  Menu,
  X,
  Globe,
  Settings,
  Monitor,
} from 'lucide-react';
import { PasswordInput } from '../ui/PasswordInput';
import { MASTER_PRODUCTS } from '../../data/menu';
import { CustomerCareHub } from './CustomerCareHub';
import { LoyaltyAndHouseAccountsHub } from './LoyaltyAndHouseAccountsHub';
import { CashMovementModal, CloseShiftModal, ShiftZReportModal } from './ShiftManagementModals';
import { PosBillSplitModal, PosTableTransferModal } from './PosBillSplitModal';
import { CateringProductionPlanner } from '../catering/CateringProductionPlanner';
import { DispatchOperationsHub } from '../dispatch/DispatchOperationsHub';
import MasterInventoryManager from '../inventory/MasterInventoryManager';
import { NotificationHub } from '../notifications/NotificationHub';
import { ExecutiveBIDashboard } from '../analytics/ExecutiveBIDashboard';
import { HardwarePrinterModal } from '../pos/HardwarePrinterModal';
import { BarcodeDispatchScanner } from '../dispatch/BarcodeDispatchScanner';
import { OfflineSyncBar } from '../pos/OfflineSyncBar';
import { EffectiveAccessModal } from './EffectiveAccessModal';
import { WebsiteCmsManager } from '../admin/WebsiteCmsManager';
import { MenuCatalogueManager } from '../admin/MenuCatalogueManager';
import { SystemConfigurationHub } from '../admin/settings/SystemConfigurationHub';
import { CustomerFacingDisplayModal } from '../pos/CustomerFacingDisplayModal';
import { PaymentReconciliationManager } from '../admin/PaymentReconciliationManager';
import { getCachedReceiptTemplate, dispatchCustomerReceipt } from '../../utils/hardwarePrinter';
import { resolveBranchDetails } from '../../utils/receiptRenderer';
import { WorkspacePosTab } from './workspace/WorkspacePosTab';
import { WorkspaceTablesTab } from './workspace/WorkspaceTablesTab';
import { WorkspaceKdsTab } from './workspace/WorkspaceKdsTab';
import { WorkspaceShiftsTab } from './workspace/WorkspaceShiftsTab';
import { WorkspaceStaffTab } from './workspace/WorkspaceStaffTab';
import { WorkspaceAuditTab } from './workspace/WorkspaceAuditTab';
import { ExpenseClaimsWorkspace } from '../expenses/ExpenseClaimsWorkspace';
import { PayrollManagementHub } from './payroll/PayrollManagementHub';
import { RoleOperationalDashboardBanner } from './RoleOperationalDashboardBanner';
import { BirthdayGreetingModal } from './BirthdayGreetingModal';
import { EnterpriseReportsHub } from '../reports/EnterpriseReportsHub';

export interface StaffOperationsWorkspaceProps {
  initialMode?: 'pos' | 'admin';
  onNavigateRoute?: (route: 'storefront' | 'pos' | 'admin') => void;
}

export const StaffOperationsWorkspace: React.FC<StaffOperationsWorkspaceProps> = ({
  initialMode,
  onNavigateRoute,
}) => {
  const {
    currentStaff,
    logoutStaff,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    products,
    refreshMenuProducts,
    formatNaira,
    getProductPrice,
    isProductAvailable,
    setIsStorefrontPreviewActive,
    operationsActiveTab,
    setOperationsActiveTab,
  } = useApp();

  // Active Workspace Navigation Tab synchronized with AppContext
  const activeTab = operationsActiveTab;
  const setActiveTab = setOperationsActiveTab;

  // Three-Interface Architecture Taxonomy:
  // Interface B: POS & Frontline Operations (Cashier, Server, Kitchen, Rider, Dispatch)
  // Interface C: Restricted Operational Backend & Governance (Super Admin, Corporate Admin, Branch Manager, Accountant, Auditor)
  const isFrontlineRole = ['cashier', 'receptionist', 'customer_service', 'kitchen', 'kitchen_lead', 'rider', 'internal_rider', 'external_rider', 'dispatch_manager'].includes(currentStaff?.role || '');
  const canAccessBackend = ['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'store_manager', 'storekeeper', 'accountant', 'auditor', 'content_editor', 'menu_manager'].includes(currentStaff?.role || '');

  // Default interface view based on staff role and initialMode
  const [interfaceView, setInterfaceView] = useState<'interface_b' | 'interface_c'>(() => {
    if (initialMode === 'admin' && canAccessBackend) return 'interface_c';
    if (initialMode === 'pos') return 'interface_b';
    return isFrontlineRole ? 'interface_b' : 'interface_c';
  });

  useEffect(() => {
    if (initialMode === 'admin' && canAccessBackend) {
      setInterfaceView('interface_c');
    } else if (initialMode === 'pos') {
      setInterfaceView('interface_b');
    }
  }, [initialMode, canAccessBackend]);

  // Operational Context
  const [activeBranchId, setActiveBranchId] = useState<BranchId>(
    (currentStaff?.branchId as string) === 'all' || !currentStaff?.branchId ? selectedBranchId : (currentStaff.branchId as BranchId)
  );

  // Time & Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Africa/Lagos',
        }) + ' WAT'
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // -------------------------------------------------------------
  // SHARED STATE & DATA FETCHING
  // -------------------------------------------------------------
  const [tables, setTables] = useState<any[]>([]);
  const [checks, setChecks] = useState<any[]>([]);
  const [activeCheck, setActiveCheckState] = useState<any | null>(null);
  const setActiveCheck = (chk: any | null) => {
    setActiveCheckState(chk);
    try {
      if (chk && chk.id) {
        sessionStorage.setItem('choplife_active_pos_check_id', String(chk.id));
      } else {
        sessionStorage.removeItem('choplife_active_pos_check_id');
      }
    } catch {}
  };
  const [kdsTickets, setKdsTickets] = useState<any[]>([]);
  const [currentShift, setCurrentShift] = useState<any | null>(null);
  const [shiftsHistory, setShiftsHistory] = useState<any[]>([]);
  const [deliveryTasks, setDeliveryTasks] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [stockLedger, setStockLedger] = useState<any[]>([]);
  const [stockRequests, setStockRequests] = useState<any[]>([]);
  const [wastageLogs, setWastageLogs] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [staffAccountsList, setStaffAccountsList] = useState<any[]>([]);
  const [salesSummary, setSalesSummary] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Staff Account Management Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(false);
  const [editingStaffAccount, setEditingStaffAccount] = useState<any | null>(null);
  const [staffFormId, setStaffFormId] = useState<string>('');
  const [staffFormName, setStaffFormName] = useState<string>('');
  const [staffFormEmail, setStaffFormEmail] = useState<string>('');
  const [staffFormPhone, setStaffFormPhone] = useState<string>('');
  const [staffFormRole, setStaffFormRole] = useState<StaffRole>('cashier');
  const [staffFormBranch, setStaffFormBranch] = useState<BranchId>('gra');
  const [staffFormAllowedBranches, setStaffFormAllowedBranches] = useState<string[]>(['gra']);
  const [staffFormPassword, setStaffFormPassword] = useState<string>('');
  const [staffFormStatus, setStaffFormStatus] = useState<'active' | 'suspended' | 'deactivated'>('active');
  const [staffFormDob, setStaffFormDob] = useState<string>('');
  const [staffFormGuarantorName, setStaffFormGuarantorName] = useState<string>('');
  const [staffFormGuarantorPhone, setStaffFormGuarantorPhone] = useState<string>('');
  const [staffFormGuarantorRel, setStaffFormGuarantorRel] = useState<string>('');
  const [staffFormGuarantorAddress, setStaffFormGuarantorAddress] = useState<string>('');
  const [staffFormGuarantorWorkplace, setStaffFormGuarantorWorkplace] = useState<string>('');
  const [staffFormBasicSalary, setStaffFormBasicSalary] = useState<string>('');
  const [staffFormHousing, setStaffFormHousing] = useState<string>('');
  const [staffFormTransport, setStaffFormTransport] = useState<string>('');
  const [staffFormOtherAllowances, setStaffFormOtherAllowances] = useState<string>('');
  const [staffFormBankName, setStaffFormBankName] = useState<string>('');
  const [staffFormAccountNumber, setStaffFormAccountNumber] = useState<string>('');
  const [staffFormAccountName, setStaffFormAccountName] = useState<string>('');
  const [showMaskedAccount, setShowMaskedAccount] = useState<boolean>(true);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<any[]>([]);

  // Hardware Printer & Barcode Scanner Modals
  const [isHardwarePrinterOpen, setIsHardwarePrinterOpen] = useState<boolean>(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState<boolean>(false);
  const [isCfdModalOpen, setIsCfdModalOpen] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [mobilePosView, setMobilePosView] = useState<'catalog' | 'check'>('catalog');

  // RBAC & Staff Sub-Tab State
  const [staffSubTab, setStaffSubTab] = useState<'directory' | 'roles'>('directory');
  const [isEffectiveAccessOpen, setIsEffectiveAccessOpen] = useState<boolean>(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState<boolean>(false);
  const [effectiveAccessStaffId, setEffectiveAccessStaffId] = useState<string | null>(null);

  useEffect(() => {
    if (currentStaff?.dateOfBirth) {
       const now = new Date();
       const formatter = new Intl.DateTimeFormat('en-GB', {
         timeZone: 'Africa/Lagos',
         day: '2-digit',
         month: '2-digit',
         year: 'numeric'
       });
       const [day, month, year] = formatter.format(now).split('/').map(Number);
       
       const [_, dobMonth, dobDay] = currentStaff.dateOfBirth.split('-').map(Number);
       if (month === dobMonth && day === dobDay) {
          const lastShown = localStorage.getItem(`birthday_shown_${currentStaff.id}_${year}-${month}-${day}`);
          if (!lastShown) {
              setIsBirthdayModalOpen(true);
              localStorage.setItem(`birthday_shown_${currentStaff.id}_${year}-${month}-${day}`, 'true');
          }
       }
    }
  }, [currentStaff]);

  const [resetCredentialsModal, setResetCredentialsModal] = useState<{
    id: string;
    name: string;
    staffId?: string;
    workEmail?: string;
    tempPass?: string;
    recoveryPin?: string;
    pinExpiresAt?: string;
  } | null>(null);
  const [adminNewPasswordInput, setAdminNewPasswordInput] = useState<string>('');
  const [isResetSubmitting, setIsResetSubmitting] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchUpcomingBirthdays = async () => {
    try {
      const res = await fetch('/api/staff/birthdays/upcoming?days=30', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUpcomingBirthdays(data.upcoming || []);
      }
    } catch (err) {
      console.error('Failed to load upcoming birthdays:', err);
    }
  };

  // Staff account CRUD handlers
  const handleOpenNewStaffModal = () => {
    const isBranchMgr = currentStaff?.role === 'branch_manager';
    const defaultBranch = isBranchMgr ? ((currentStaff?.branchId as BranchId) || 'gra') : 'gra';
    setEditingStaffAccount(null);
    setStaffFormId(`STF-${Math.floor(1000 + Math.random() * 9000)}`);
    setStaffFormName('');
    setStaffFormEmail('');
    setStaffFormPhone('');
    setStaffFormRole('cashier');
    setStaffFormBranch(defaultBranch);
    setStaffFormAllowedBranches([defaultBranch]);
    setStaffFormPassword('Choplife@2026!');
    setStaffFormStatus('active');
    setStaffFormDob('');
    setStaffFormGuarantorName('');
    setStaffFormGuarantorPhone('');
    setStaffFormGuarantorRel('');
    setStaffFormGuarantorAddress('');
    setStaffFormGuarantorWorkplace('');
    setStaffFormBasicSalary('');
    setStaffFormHousing('');
    setStaffFormTransport('');
    setStaffFormOtherAllowances('');
    setStaffFormBankName('');
    setStaffFormAccountNumber('');
    setStaffFormAccountName('');
    setIsStaffModalOpen(true);
  };

  const handleEditStaffModal = (s: any) => {
    setEditingStaffAccount(s);
    setStaffFormId(s.staffId);
    setStaffFormName(s.name);
    setStaffFormEmail(s.workEmail);
    setStaffFormPhone(s.phone || '');
    setStaffFormRole(s.role);
    setStaffFormBranch(s.branchId);
    setStaffFormAllowedBranches(
      Array.isArray(s.allowedBranchIds) && s.allowedBranchIds.length > 0
        ? s.allowedBranchIds
        : [s.branchId]
    );
    setStaffFormPassword('');
    setStaffFormStatus(s.status || 'active');
    setStaffFormDob(s.dateOfBirth || '');
    setStaffFormGuarantorName(s.guarantorName || '');
    setStaffFormGuarantorPhone(s.guarantorPhone || '');
    setStaffFormGuarantorRel(s.guarantorRelationship || '');
    setStaffFormGuarantorAddress(s.guarantorAddress || '');
    setStaffFormGuarantorWorkplace(s.guarantorWorkplace || '');
    const prof = s.payrollProfile || {};
    setStaffFormBasicSalary(prof.basicSalary !== undefined && prof.basicSalary !== null ? String(prof.basicSalary) : '');
    setStaffFormHousing(prof.housingAllowance !== undefined && prof.housingAllowance !== null ? String(prof.housingAllowance) : '');
    setStaffFormTransport(prof.transportAllowance !== undefined && prof.transportAllowance !== null ? String(prof.transportAllowance) : '');
    setStaffFormOtherAllowances(prof.otherAllowances !== undefined && prof.otherAllowances !== null ? String(prof.otherAllowances) : '');
    setStaffFormBankName(prof.bankName || '');
    setStaffFormAccountNumber(prof.accountNumber || '');
    setStaffFormAccountName(prof.accountName || s.name || '');
    setIsStaffModalOpen(true);
  };

  const handleSaveStaffAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allowedBranches = Array.from(
        new Set([staffFormBranch, ...staffFormAllowedBranches].filter(Boolean))
      );
      const basicNum = Number(staffFormBasicSalary) || 0;
      const payrollProfile = basicNum > 0 ? {
        basicSalary: basicNum,
        housingAllowance: Number(staffFormHousing) || 0,
        transportAllowance: Number(staffFormTransport) || 0,
        otherAllowances: Number(staffFormOtherAllowances) || 0,
        bankName: staffFormBankName.trim(),
        accountNumber: staffFormAccountNumber.trim(),
        accountName: staffFormAccountName.trim() || staffFormName.trim(),
        status: 'active',
        effectiveDate: new Date().toISOString().slice(0, 10),
      } : null;

      if (editingStaffAccount) {
        const res = await fetch(`/api/staff/accounts/${editingStaffAccount.id}`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            name: staffFormName,
            phone: staffFormPhone,
            role: staffFormRole,
            branchId: staffFormBranch,
            allowedBranchIds: allowedBranches,
            status: staffFormStatus,
            dateOfBirth: staffFormDob,
            guarantorName: staffFormGuarantorName,
            guarantorPhone: staffFormGuarantorPhone,
            guarantorRelationship: staffFormGuarantorRel,
            guarantorAddress: staffFormGuarantorAddress,
            guarantorWorkplace: staffFormGuarantorWorkplace,
            payrollProfile,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update staff account');
        showToast('Staff account updated successfully!', 'success');
      } else {
        const res = await fetch('/api/staff/accounts', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            staffId: staffFormId,
            name: staffFormName,
            workEmail: staffFormEmail,
            phone: staffFormPhone,
            role: staffFormRole,
            branchId: staffFormBranch,
            allowedBranchIds: allowedBranches,
            initialPassword: staffFormPassword,
            dateOfBirth: staffFormDob,
            guarantorName: staffFormGuarantorName,
            guarantorPhone: staffFormGuarantorPhone,
            guarantorRelationship: staffFormGuarantorRel,
            guarantorAddress: staffFormGuarantorAddress,
            guarantorWorkplace: staffFormGuarantorWorkplace,
            payrollProfile,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create staff account');
        showToast('New staff account created successfully!', 'success');
      }
      setIsStaffModalOpen(false);
      fetchStaffAccounts();
    } catch (err: any) {
      showToast(err.message || 'Staff operation failed', 'error');
    }
  };

  const handleResetStaffPassword = async (id: string, name: string) => {
    const targetAcc = staffAccountsList.find((s) => s.id === id);
    const suggestedPass = `ChopReset@${Math.floor(1000 + Math.random() * 9000)}`;
    setAdminNewPasswordInput(suggestedPass);
    setResetCredentialsModal({
      id,
      name,
      staffId: targetAcc?.staffId || id,
      workEmail: targetAcc?.workEmail || '',
    });
  };

  const handleSaveAdminPasswordReset = async () => {
    if (!resetCredentialsModal) return;
    setIsResetSubmitting(true);
    try {
      const res = await fetch(`/api/staff/accounts/${resetCredentialsModal.id}/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ temporaryPassword: adminNewPasswordInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset failed');
      setResetCredentialsModal((prev) => (prev ? { ...prev, tempPass: adminNewPasswordInput } : null));
      showToast(`Password updated for ${resetCredentialsModal.name}. Active sessions invalidated.`, 'success');
      fetchStaffAccounts();
    } catch (err: any) {
      showToast(err.message || 'Password reset failed', 'error');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleGenerateStaffRecoveryPin = async () => {
    if (!resetCredentialsModal) return;
    setIsResetSubmitting(true);
    try {
      const res = await fetch(`/api/staff/accounts/${resetCredentialsModal.id}/generate-reset-pin`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate recovery PIN');
      setResetCredentialsModal((prev) =>
        prev ? { ...prev, recoveryPin: data.recoveryPin, pinExpiresAt: data.expiresAt } : null
      );
      showToast(`Single-use 15-minute recovery PIN generated for ${resetCredentialsModal.name}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Recovery PIN generation failed', 'error');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('choplife_staff_token') || '';
    return {
      Authorization: `Bearer ${token}`,
      ...extra,
    };
  };

  // Fetch Tables & Checks
  const fetchTablesAndChecks = async () => {
    try {
      const headers = getAuthHeaders();
      const [resTables, resChecks, resShift] = await Promise.all([
        fetch(`/api/pos/tables?branchId=${activeBranchId}`, { headers }),
        fetch(`/api/pos/checks?branchId=${activeBranchId}`, { headers }),
        fetch(`/api/pos/shifts/current?branchId=${activeBranchId}`, { headers }),
      ]);

      const [tablesParsed, checksParsed, shiftParsed] = await Promise.all([
        safeParseApiResponse(resTables),
        safeParseApiResponse(resChecks),
        safeParseApiResponse(resShift),
      ]);

      if (tablesParsed.ok && Array.isArray(tablesParsed.data)) {
        setTables(tablesParsed.data);
      }
      if (checksParsed.ok && Array.isArray(checksParsed.data)) {
        const loadedChecks = checksParsed.data;
        setChecks(loadedChecks);
        const savedCheckId = (() => {
          try {
            return sessionStorage.getItem('choplife_active_pos_check_id');
          } catch {
            return null;
          }
        })();
        const targetId = activeCheck?.id || savedCheckId;
        const matchedSaved = targetId
          ? loadedChecks.find(
              (c: any) =>
                c.id === targetId &&
                (c.status === 'open' || c.status === 'sent_to_kitchen' || c.status === 'partially_paid')
            )
          : null;
        if (matchedSaved) {
          setActiveCheck(matchedSaved);
        } else if (!activeCheck && loadedChecks.length > 0) {
          const openCheck = loadedChecks.find(
            (c: any) => c.status === 'open' || c.status === 'sent_to_kitchen' || c.status === 'partially_paid'
          );
          if (openCheck) setActiveCheck(openCheck);
        }
      }
      if (shiftParsed.ok && shiftParsed.data) {
        setCurrentShift(shiftParsed.data);
      }
    } catch (err) {
      console.error('Failed to load POS tables/checks:', err);
    }
  };

  // Fetch KDS
  const fetchKds = async () => {
    try {
      const res = await fetch(`/api/pos/kds/tickets?branchId=${activeBranchId}&includeRecentBumped=true`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) setKdsTickets(await res.json());
    } catch (err) {
      console.error('Failed to load KDS tickets:', err);
    }
  };

  // Fetch Dispatch
  const fetchDispatch = async () => {
    try {
      const res = await fetch(`/api/dispatch/tasks?branchId=${activeBranchId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) setDeliveryTasks(await res.json());
    } catch (err) {
      console.error('Failed to load dispatch tasks:', err);
    }
  };

  // Fetch Inventory
  const fetchInventory = async () => {
    try {
      const headers = getAuthHeaders();
      const [resInv, resLedger, resReq, resWst] = await Promise.all([
        fetch('/api/inventory/items', { headers }),
        fetch('/api/inventory/ledger', { headers }),
        fetch('/api/inventory/requests', { headers }),
        fetch('/api/inventory/wastage', { headers }),
      ]);
      if (resInv.ok) setInventoryList(await resInv.json());
      if (resLedger.ok) setStockLedger(await resLedger.json());
      if (resReq.ok) setStockRequests(await resReq.json());
      if (resWst.ok) setWastageLogs(await resWst.json());
    } catch (err) {
      console.error('Failed to load inventory:', err);
    }
  };

  // Fetch Staff Accounts
  const fetchStaffAccounts = async () => {
    try {
      const res = await fetch('/api/staff/accounts', {
        headers: getAuthHeaders(),
      });
      if (res.ok) setStaffAccountsList(await res.json());
      fetchUpcomingBirthdays();
    } catch (err) {
      console.error('Failed to load staff accounts:', err);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`/api/audit/logs?branchId=${activeBranchId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) setAuditLogsList(await res.json());
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  // Fetch Reports
  const fetchReports = async () => {
    try {
      const res = await fetch(`/api/reports/sales-summary?branchId=${activeBranchId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) setSalesSummary(await res.json());
    } catch (err) {
      console.error('Failed to load sales summary:', err);
    }
  };

  // Trigger reload on tab or branch change
  useEffect(() => {
    fetchTablesAndChecks();
    if (activeTab === 'kds') fetchKds();
    if (activeTab === 'dispatch') fetchDispatch();
    if (activeTab === 'inventory') fetchInventory();
    if (activeTab === 'staff') fetchStaffAccounts();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'reports') fetchReports();
  }, [activeBranchId, activeTab]);

  // Set default view by role while honoring explicit initialMode ('pos' vs 'admin')
  useEffect(() => {
    if (currentStaff) {
      if (initialMode === 'pos') {
        setInterfaceView('interface_b');
        if (!['pos', 'tables', 'kds', 'dispatch', 'shifts', 'loyalty', 'care', 'catering', 'expenses'].includes(activeTab)) {
          setActiveTab('pos');
        }
        return;
      }
      if (initialMode === 'admin' && canAccessBackend) {
        setInterfaceView('interface_c');
        if (['pos', 'tables', 'kds', 'dispatch'].includes(activeTab)) {
          setActiveTab(
            currentStaff.role === 'auditor'
              ? 'audit'
              : currentStaff.role === 'accountant'
              ? 'reports'
              : currentStaff.role === 'content_editor'
              ? 'cms'
              : currentStaff.role === 'menu_manager'
              ? 'menu_catalog'
              : 'staff'
          );
        }
        return;
      }
      if (['kitchen_lead', 'kitchen', 'kitchen_supervisor', 'pastry_chef'].includes(currentStaff.role)) {
        setActiveTab('kds');
        setInterfaceView('interface_b');
      } else if (['dispatch_manager', 'rider', 'internal_rider', 'external_rider'].includes(currentStaff.role)) {
        setActiveTab('dispatch');
        setInterfaceView('interface_b');
      } else if (['cashier'].includes(currentStaff.role)) {
        setActiveTab('pos');
        setInterfaceView('interface_b');
      } else if (['customer_service', 'receptionist'].includes(currentStaff.role)) {
        setActiveTab('tables');
        setInterfaceView('interface_b');
      } else if (['content_editor'].includes(currentStaff.role)) {
        setActiveTab('cms');
        setInterfaceView('interface_c');
      } else if (['menu_manager'].includes(currentStaff.role)) {
        setActiveTab('menu_catalog');
        setInterfaceView('interface_c');
      } else if (['storekeeper', 'store_manager'].includes(currentStaff.role)) {
        setActiveTab('inventory');
        setInterfaceView('interface_c');
      } else if (['accountant'].includes(currentStaff.role)) {
        setActiveTab('reports');
        setInterfaceView('interface_c');
      } else if (['auditor'].includes(currentStaff.role)) {
        setActiveTab('audit');
        setInterfaceView('interface_c');
      } else if (['super_admin', 'corporate_admin', 'admin', 'branch_manager'].includes(currentStaff.role)) {
        setInterfaceView('interface_c');
      }
    }
  }, [currentStaff?.id, initialMode]);

  // -------------------------------------------------------------
  // POS SUB-MODULE STATE
  // -------------------------------------------------------------
  const [posCategory, setPosCategory] = useState<string>('all');
  const [posSearch, setPosSearch] = useState<string>('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pos_terminal' | 'bank_transfer' | 'split' | 'wallet' | 'house_account'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [posRrn, setPosRrn] = useState<string>('');
  const [transferRef, setTransferRef] = useState<string>('');
  const [splitCashAmount, setSplitCashAmount] = useState<string>('');
  const [splitPosAmount, setSplitPosAmount] = useState<string>('');

  // Loyalty & House Account Payment State
  const [posCustomers, setPosCustomers] = useState<any[]>([]);
  const [posHouseAccounts, setPosHouseAccounts] = useState<any[]>([]);
  const [selectedCustomerIdForPayment, setSelectedCustomerIdForPayment] = useState<string>('');
  const [walletPinForPayment, setWalletPinForPayment] = useState<string>('');
  const [selectedHouseAccountIdForPayment, setSelectedHouseAccountIdForPayment] = useState<string>('');
  const [authorizedSignerForPayment, setAuthorizedSignerForPayment] = useState<string>('');

  useEffect(() => {
    if (isPaymentModalOpen) {
      const headers = getAuthHeaders();
      // Load customers
      fetch('/api/customers', { headers })
        .then((r) => r.json())
        .then((d) => setPosCustomers(d.customers || []))
        .catch(console.error);

      // Load corporate house accounts
      fetch('/api/house-accounts', { headers })
        .then((r) => r.json())
        .then((d) => setPosHouseAccounts(d.accounts || []))
        .catch(console.error);
    }
  }, [isPaymentModalOpen]);

  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState<boolean>(false);
  const [discountPercentInput, setDiscountPercentInput] = useState<number>(0);
  const [discountReasonInput, setDiscountReasonInput] = useState<string>('VIP Courtesy');
  const [isSplitBillModalOpen, setIsSplitBillModalOpen] = useState<boolean>(false);
  const [splitGuestCount, setSplitGuestCount] = useState<number>(2);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [lastPaidCheck, setLastPaidCheck] = useState<any | null>(null);

  // Filtered Products for POS (uses live catalogue from database, excluding draft/paused/archived/inactive items)
  const livePosCatalog = Array.isArray(products) && products.length > 0 ? products : MASTER_PRODUCTS;
  const filteredProducts = livePosCatalog.filter((p: any) => {
    if ((p.status && p.status !== 'published') || p.isActive === false) return false;
    if (Array.isArray(p.channels) && p.channels.length > 0 && !p.channels.includes('pos')) return false;
    const matchesCat = posCategory === 'all' || p.category === posCategory;
    const matchesSearch =
      posSearch.trim() === '' ||
      p.name.toLowerCase().includes(posSearch.toLowerCase()) ||
      (p.shortDescription && p.shortDescription.toLowerCase().includes(posSearch.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Open New Check Handler (enforces orderType and available table for dine_in)
  const handleOpenNewCheck = async (
    tableNum?: string,
    checkType: 'dine_in' | 'takeaway' | 'delivery' = 'dine_in',
    extra?: {
      tableId?: string;
      customerName?: string;
      customerPhone?: string;
      deliveryAddress?: string;
      deliveryZone?: string;
      deliveryFee?: number;
      riderId?: string;
      riderName?: string;
      guestCount?: number;
    }
  ) => {
    try {
      let resolvedTableNum = tableNum;
      let resolvedTableId = extra?.tableId;

      if (checkType === 'dine_in') {
        const availableTables = tables.filter((t) => t.status === 'available');
        if (!resolvedTableId && !resolvedTableNum) {
          if (availableTables.length === 0) {
            showToast('No available dining tables in this branch. Choose Takeout/Pickup or Delivery.', 'error');
            return;
          }
          resolvedTableId = availableTables[0].id;
          resolvedTableNum = `Table ${availableTables[0].tableNumber}`;
        } else {
          const cleanReq = String(resolvedTableNum || '').replace(/^table\s*/i, '').trim().toLowerCase();
          const matched = tables.find(
            (t) =>
              t.id === resolvedTableId ||
              String(t.tableNumber || '').toLowerCase() === String(resolvedTableNum || '').toLowerCase() ||
              String(t.tableNumber || '').replace(/^table\s*/i, '').trim().toLowerCase() === cleanReq
          );
          if (matched && matched.status !== 'available') {
            showToast(`Table ${matched.tableNumber} is currently occupied (${matched.status}). Please choose an available table.`, 'error');
            return;
          }
          if (matched) {
            resolvedTableId = matched.id;
            resolvedTableNum = String(matched.tableNumber).toLowerCase().startsWith('table')
              ? matched.tableNumber
              : `Table ${matched.tableNumber}`;
          }
        }
      }

      const res = await fetch('/api/pos/checks', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          branchId: activeBranchId,
          tableId: checkType === 'dine_in' ? resolvedTableId : undefined,
          tableNumber: checkType === 'dine_in' ? resolvedTableNum : undefined,
          checkType,
          customerName:
            extra?.customerName ||
            (checkType === 'dine_in'
              ? resolvedTableNum
                ? `Dine-In (${resolvedTableNum})`
                : 'Walk-in Table'
              : checkType === 'delivery'
              ? 'Delivery Customer'
              : 'Takeaway Customer'),
          customerPhone: extra?.customerPhone,
          deliveryAddress: checkType === 'delivery' ? extra?.deliveryAddress : undefined,
          deliveryZone: checkType === 'delivery' ? extra?.deliveryZone : undefined,
          deliveryFee: checkType === 'delivery' ? (extra?.deliveryFee ?? 1200) : 0,
          riderId: checkType === 'delivery' ? extra?.riderId : undefined,
          riderName: checkType === 'delivery' ? extra?.riderName : undefined,
          guestCount: extra?.guestCount || 1,
          items: [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCheck(data.check);
        fetchTablesAndChecks();
        showToast(`Opened new ${checkType.replace('_', '-')} check #${data.check.checkNumber}`);
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to open new check', 'error');
      }
    } catch (err) {
      showToast('Failed to open new check', 'error');
    }
  };

  // Add Item to Active Check
  const handleAddItemToCheck = async (product: Product) => {
    if (!activeCheck) {
      showToast('Please select an order type (Dine-In, Takeout, or Delivery) to start a new check first.', 'error');
      return;
    }

    const price = getProductPrice(product, activeBranchId);
    const defaultAddQty =
      product.isWholesale && !product.wholesalePricing?.enabled && Number(product.minOrderQty) > 1
        ? Number(product.minOrderQty)
        : 1;
    const existingIndex = activeCheck.items.findIndex(
      (it: any) => it.productId === product.id && it.status === 'pending' && !it.isPromoReward
    );

    let updatedItems = activeCheck.items.filter((it: any) => !it.isPromoReward);
    if (existingIndex >= 0) {
      const current = activeCheck.items[existingIndex];
      const targetIdx = updatedItems.findIndex((it: any) => it.id === current.id);
      if (targetIdx >= 0) {
        updatedItems[targetIdx] = {
          ...current,
          quantity: current.quantity + 1,
          totalPrice: (current.quantity + 1) * current.unitPrice,
        };
      }
    } else {
      updatedItems.push({
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: product.id,
        name: product.name,
        image: product.image,
        imageUrl: product.image,
        product,
        quantity: defaultAddQty,
        unitPrice: price,
        totalPrice: price * defaultAddQty,
        status: 'pending',
      });
    }

    await saveCheckItems(updatedItems);
  };

  // Update Item Quantity (supports +/- delta or direct numeric quantity entry)
  const handleUpdateItemQty = async (itemId: string, delta: number, exactQty?: number) => {
    if (!activeCheck) return;
    let updatedItems = activeCheck.items.filter((it: any) => !it.isPromoReward);
    const idx = updatedItems.findIndex((it: any) => it.id === itemId);
    if (idx === -1) return;

    const newQty = exactQty !== undefined ? Math.floor(Number(exactQty)) : updatedItems[idx].quantity + delta;
    if (!Number.isFinite(newQty) || newQty < 0 || newQty > 10000) {
      showToast('Please enter a valid quantity between 1 and 10,000.', 'error');
      return;
    }

    if (newQty <= 0) {
      updatedItems.splice(idx, 1);
    } else {
      updatedItems[idx] = {
        ...updatedItems[idx],
        quantity: newQty,
        totalPrice: newQty * updatedItems[idx].unitPrice,
      };
    }

    await saveCheckItems(updatedItems);
  };

  // Save Check Items helper
  const saveCheckItems = async (items: any[]) => {
    if (!activeCheck) return;
    try {
      const res = await fetch('/api/pos/checks', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...activeCheck,
          items,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCheck(data.check);
        fetchTablesAndChecks();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to update check', 'error');
      }
    } catch (err) {
      showToast('Failed to update check', 'error');
    }
  };

  // Send Active Check to Kitchen
  const handleSendToKitchen = async () => {
    if (!activeCheck) return;
    if (activeCheck.items.length === 0) {
      showToast('Cannot send empty check to kitchen', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/pos/checks/${activeCheck.id}/send-to-kitchen`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCheck(data.check);
        fetchTablesAndChecks();
        showToast(`Sent check #${data.check.checkNumber} to Kitchen Display System!`);
      }
    } catch (err) {
      showToast('Error sending order to kitchen', 'error');
    }
  };

  // Pay and Complete Check (Supports Full Remaining Balance or Mixed Tender)
  const handleCompletePayment = async () => {
    if (!activeCheck) return;
    const payableAmount = Number(activeCheck.remainingBalance ?? activeCheck.total);

    if (paymentMethod === 'wallet') {
      if (!selectedCustomerIdForPayment) {
        showToast('Please select a customer with an active digital wallet.', 'error');
        return;
      }
      const cust = posCustomers.find((c) => c.id === selectedCustomerIdForPayment);
      if (cust && cust.walletBalance < payableAmount) {
        showToast(
          `Insufficient wallet balance (₦${cust.walletBalance.toLocaleString()}). Required: ₦${payableAmount.toLocaleString()}`,
          'error'
        );
        return;
      }
      if (!walletPinForPayment) {
        showToast('Customer wallet PIN is required for settlement authorization.', 'error');
        return;
      }
    }

    if (paymentMethod === 'house_account') {
      if (!selectedHouseAccountIdForPayment) {
        showToast('Please select an authorized corporate house account.', 'error');
        return;
      }
      const acc = posHouseAccounts.find((a) => a.id === selectedHouseAccountIdForPayment);
      if (acc && acc.currentBalance + payableAmount > acc.creditLimit) {
        showToast(
          `Credit limit exceeded. Current: ₦${acc.currentBalance.toLocaleString()}, Limit: ₦${acc.creditLimit.toLocaleString()}`,
          'error'
        );
        return;
      }
    }

    if (paymentMethod === 'split') {
      const cashAmt = Math.round(Number(splitCashAmount) || 0);
      const posAmt = Math.round(Number(splitPosAmount) || 0);
      if (cashAmt + posAmt !== payableAmount) {
        showToast(
          `Mixed tender amounts (Cash ₦${cashAmt.toLocaleString()} + POS ₦${posAmt.toLocaleString()}) must equal payable balance ₦${payableAmount.toLocaleString()}.`,
          'error'
        );
        return;
      }
    }

    try {
      const paymentDetails: any = {
        cashTendered: Number(cashTendered) || payableAmount,
        posRrn,
        transferRef,
        splitCashAmount: Number(splitCashAmount) || 0,
        splitPosAmount: Number(splitPosAmount) || 0,
        customerId: selectedCustomerIdForPayment || undefined,
        walletPin: walletPinForPayment || undefined,
        houseAccountId: selectedHouseAccountIdForPayment || undefined,
        authorizedSigner: authorizedSignerForPayment || undefined,
      };

      const tenders =
        paymentMethod === 'split'
          ? [
              ...(Number(splitCashAmount) > 0
                ? [{ method: 'cash', amount: Math.round(Number(splitCashAmount)), reference: 'CASH-MIXED' }]
                : []),
              ...(Number(splitPosAmount) > 0
                ? [{ method: 'pos_terminal', amount: Math.round(Number(splitPosAmount)), reference: posRrn || 'POS-MIXED' }]
                : []),
            ]
          : undefined;

      const res = await fetch(`/api/pos/checks/${activeCheck.id}/pay`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          paymentMethod,
          paymentDetails,
          amountToPay: payableAmount,
          tenders,
          shiftId: currentShift?.id,
          idempotencyKey: `PAY-${activeCheck.id}-${payableAmount}-${Date.now()}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.isFullyPaid === false || data.check?.status === 'partially_paid') {
          setActiveCheck(data.check);
          fetchTablesAndChecks();
          showToast(
            `Partial payment recorded for Check #${data.check.checkNumber}. Remaining balance: ₦${Number(data.check.remainingBalance || 0).toLocaleString()}`
          );
        } else {
          setLastPaidCheck(data.check);
          setIsPaymentModalOpen(false);
          setIsReceiptModalOpen(true);
          setActiveCheck(null);
          setSelectedCustomerIdForPayment('');
          setSelectedHouseAccountIdForPayment('');
          setAuthorizedSignerForPayment('');
          fetchTablesAndChecks();
          showToast(
            `Check #${data.check.checkNumber} settled in full via ${paymentMethod.replace('_', ' ').toUpperCase()}! (₦${data.check.total.toLocaleString()})`
          );
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.requiresShift) {
          showToast('Active shift register required: Open a shift before accepting cash.', 'error');
          setIsPaymentModalOpen(false);
          setActiveTab('shifts');
        } else {
          showToast(errData.error || 'Failed to complete payment', 'error');
        }
      }
    } catch (err) {
      showToast('Failed to complete payment', 'error');
    }
  };

  // Apply Discount
  const handleApplyDiscount = async () => {
    if (!activeCheck) return;
    const discountAmt = Math.round((activeCheck.subtotal * discountPercentInput) / 100);
    try {
      const res = await fetch('/api/pos/checks', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...activeCheck,
          discountPercent: discountPercentInput,
          discountAmount: discountAmt,
          discountReason: discountReasonInput,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCheck(data.check);
        setIsDiscountModalOpen(false);
        showToast(`Applied ${discountPercentInput}% discount (₦${discountAmt})`);
      }
    } catch (err) {
      showToast('Failed to apply discount', 'error');
    }
  };

  // Dispatch Hub Operations: Remit Cash & Assign Rider
  const handleRemitCash = async (taskId: string) => {
    try {
      const res = await fetch(`/api/dispatch/tasks/${taskId}/remit-cash`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'COD payment remitted into branch till register.');
        fetchDispatch();
        fetchTablesAndChecks();
      } else {
        showToast(data.error || 'Failed to remit COD cash', 'error');
      }
    } catch (err) {
      showToast('Network error during COD remittance', 'error');
    }
  };

  const handleAssignRider = async (taskId: string, riderId: string) => {
    const rider = staffAccountsList.find((s) => s.id === riderId || s.staffId === riderId);
    try {
      const res = await fetch(`/api/dispatch/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          riderId: rider?.id || riderId,
          riderName: rider?.name || 'Assigned Rider',
        }),
      });
      if (res.ok) {
        showToast(`Rider ${rider?.name || ''} assigned successfully!`);
        fetchDispatch();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to assign rider', 'error');
      }
    } catch (err) {
      showToast('Failed to assign rider', 'error');
    }
  };

  // Inter-Branch Stock Indent Operations (DEFECT-P2-03)
  const handleDispatchStockRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/inventory/requests/${requestId}/dispatch`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      });
      if (res.ok) {
        showToast('Stock indent dispatched from source branch warehouse.');
        fetchInventory();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to dispatch stock transfer', 'error');
      }
    } catch (err) {
      showToast('Failed to dispatch stock transfer', 'error');
    }
  };

  const handleReceiveStockRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/inventory/requests/${requestId}/receive`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      });
      if (res.ok) {
        showToast('Stock indent received and added to destination inventory.');
        fetchInventory();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to receive stock transfer', 'error');
      }
    } catch (err) {
      showToast('Failed to receive stock transfer', 'error');
    }
  };

  // -------------------------------------------------------------
  // SHIFT MANAGEMENT SUB-MODULE STATE
  // -------------------------------------------------------------
  const [openingFloatInput, setOpeningFloatInput] = useState<string>('');
  const [isOpeningShiftModalOpen, setIsOpeningShiftModalOpen] = useState<boolean>(false);
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState<boolean>(false);
  const [cashMovementType, setCashMovementType] = useState<'safe_drop' | 'paid_out' | 'cash_refund' | 'adjustment'>('safe_drop');
  const [cashMovementAmount, setCashMovementAmount] = useState<string>('');
  const [cashMovementReason, setCashMovementReason] = useState<string>('');
  const [isClosingShiftModalOpen, setIsClosingShiftModalOpen] = useState<boolean>(false);
  const [countedCashInput, setCountedCashInput] = useState<string>('');
  const [closingNotesInput, setClosingNotesInput] = useState<string>('');
  const [isShiftZReportModalOpen, setIsShiftZReportModalOpen] = useState<boolean>(false);
  const [closedShiftReport, setClosedShiftReport] = useState<any | null>(null);

  // POS Extensions: Table Transfer
  const [isTableTransferModalOpen, setIsTableTransferModalOpen] = useState<boolean>(false);

  const handleOpenShift = async () => {
    if (!openingFloatInput || Number(openingFloatInput) < 0) {
      showToast('Please enter a valid opening float amount', 'error');
      return;
    }
    try {
      const res = await fetch('/api/pos/shifts/open', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          branchId: activeBranchId,
          openingFloat: Number(openingFloatInput),
          registerId: 'POS-REG-01',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentShift(data.shift);
        setIsOpeningShiftModalOpen(false);
        showToast(`Shift ${data.shift.shiftNumber} opened with float ₦${data.shift.openingFloat}!`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to open shift', 'error');
      }
    } catch (err) {
      showToast('Error opening shift', 'error');
    }
  };

  const handleLogCashMovement = async () => {
    if (!currentShift || !cashMovementAmount || Number(cashMovementAmount) <= 0) {
      showToast('Please enter a valid cash amount', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/pos/shifts/${currentShift.id}/cash-movement`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          movementType: cashMovementType,
          amount: Number(cashMovementAmount),
          reason: cashMovementReason || `${cashMovementType} record`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentShift(data.shift);
        setIsCashMovementModalOpen(false);
        setCashMovementAmount('');
        setCashMovementReason('');
        showToast(`Logged ${cashMovementType} of ₦${cashMovementAmount}!`);
      }
    } catch (err) {
      showToast('Failed to record cash movement', 'error');
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    try {
      const res = await fetch(`/api/pos/shifts/${currentShift.id}/close`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          countedCashInTill: Number(countedCashInput) || 0,
          notes: closingNotesInput,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setClosedShiftReport(data.shift);
        setIsShiftZReportModalOpen(true);
        setCurrentShift(null);
        setIsClosingShiftModalOpen(false);
        showToast(`Shift ${data.shift.shiftNumber} closed! Z-Report Generated.`);
      }
    } catch (err) {
      showToast('Failed to close shift', 'error');
    }
  };

  // Handle Table Transfer
  const handleTransferTable = async (newTableId: string, newTableNumber: string) => {
    if (!activeCheck) return;
    try {
      const res = await fetch(`/api/pos/checks/${activeCheck.id}/transfer-table`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          newTableId,
          newTableNumber,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCheck(data.check);
        setIsTableTransferModalOpen(false);
        fetchTablesAndChecks();
        showToast(`Check transferred to Table ${newTableNumber}!`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to transfer table', 'error');
      }
    } catch (err) {
      showToast('Error transferring table', 'error');
    }
  };

  // Save Split Shares Configuration without paying immediately
  const handleSaveSplitConfig = async (splitConfigPayload: any) => {
    if (!activeCheck) return null;
    try {
      const res = await fetch(`/api/pos/checks/${activeCheck.id}/split`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(splitConfigPayload),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCheck(data.check);
        fetchTablesAndChecks();
        return data.check;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to save split bill shares', 'error');
        return null;
      }
    } catch (err) {
      showToast('Failed to save split bill shares', 'error');
      return null;
    }
  };

  // Handle Settle Split Bill (Supports Individual Share Payment or Full Remaining Settlement)
  const handleSettleSplitBill = async (splitPayload: any) => {
    if (!activeCheck) return;
    try {
      if (splitPayload.splitConfigPayload) {
        await fetch(`/api/pos/checks/${activeCheck.id}/split`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(splitPayload.splitConfigPayload),
        });
      }

      const res = await fetch(`/api/pos/checks/${activeCheck.id}/pay`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          paymentMethod: splitPayload.paymentMethod,
          paymentDetails: splitPayload.paymentDetails,
          shareId: splitPayload.shareId,
          amountToPay: splitPayload.amountToPay,
          tenders: splitPayload.tenders,
          idempotencyKey: splitPayload.idempotencyKey,
          shiftId: currentShift?.id,
          activeShiftId: currentShift?.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        fetchTablesAndChecks();

        if (data.isFullyPaid === false || data.check?.status === 'partially_paid') {
          setActiveCheck(data.check);
          showToast(
            `Share settled! Check #${data.check.checkNumber} is Partially Paid — Remaining Due: ₦${Number(
              data.check.remainingBalance || 0
            ).toLocaleString()}`
          );
        } else {
          setLastPaidCheck(data.check);
          setIsSplitBillModalOpen(false);
          setIsReceiptModalOpen(true);
          setActiveCheck(null);
          showToast(`All split shares settled for Check #${data.check.checkNumber}!`);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.requiresShift) {
          showToast('Active shift register required: Open a shift before accepting cash.', 'error');
          setIsSplitBillModalOpen(false);
          setActiveTab('shifts');
        } else {
          showToast(err.error || 'Split bill payment failed', 'error');
        }
      }
    } catch (err) {
      showToast('Error settling split bill', 'error');
    }
  };

  // -------------------------------------------------------------
  // KDS TICKET ADVANCE, BUMP & RECALL
  // -------------------------------------------------------------
  const [kdsChannelFilter, setKdsChannelFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all');
  const [kdsShowBumped, setKdsShowBumped] = useState<boolean>(false);

  const handleAdvanceKdsItem = async (checkId: string, itemId: string, newStatus: string) => {
    try {
      await fetch(`/api/pos/kds/items/${checkId}/${itemId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: newStatus }),
      });
      fetchKds();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBumpKdsTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/pos/kds/tickets/${ticketId}/bump`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast('Ticket bumped & ready for pickup/delivery!', 'success');
        fetchKds();
      } else {
        showToast('Failed to bump ticket', 'error');
      }
    } catch {
      showToast('Network error bumping ticket', 'error');
    }
  };

  const handleRecallKdsTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/pos/kds/tickets/${ticketId}/recall`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast('Ticket recalled back to active preparation queue!', 'success');
        fetchKds();
      } else {
        showToast('Failed to recall ticket', 'error');
      }
    } catch {
      showToast('Network error recalling ticket', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF7F2] text-stone-900 flex flex-col font-sans select-none overflow-hidden">
      {/* Toast Notification (z-[120] above all modals and drawers) */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 left-4 sm:left-auto z-[120] max-w-md px-4 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center justify-between gap-3 transition-all animate-in slide-in-from-top-4 border pointer-events-auto ${
            toastMessage.type === 'error'
              ? 'bg-red-950 text-red-100 border-red-500'
              : 'bg-[#4D080F] text-[#FFC700] border-[#FFC700]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#FFC700] shrink-0" />
            )}
            <span className="leading-snug break-words">{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg opacity-75 hover:opacity-100 transition-opacity shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP PERSISTENT OPERATIONS BAR */}
      {/* ========================================================================= */}
      <header className="min-h-14 py-1.5 bg-white border-b border-stone-200 px-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-2xs">
        {/* Left: Brand & Hub Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile & Tablet Navigation Toggle Button */}
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className={`${activeTab === 'pos' ? 'xl:hidden' : 'lg:hidden'} p-2 rounded-xl bg-stone-100 border border-stone-200 text-[#800D15] hover:bg-stone-200 active:scale-95 transition-all shrink-0`}
            aria-label="Toggle Navigation Menu"
          >
            {isMobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#800D15] border border-[#FFC700]/40 flex items-center justify-center font-black text-[#FFC700] text-base sm:text-lg shadow-2xs shrink-0">
              C
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-stone-900 truncate">
                  Choplife Republic
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-[#800D15] text-[#FFC700] text-[9px] sm:text-[10px] font-black tracking-widest uppercase shadow-2xs">
                  {interfaceView === 'interface_c' ? 'BACK OFFICE' : 'FRONT OFFICE'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-stone-500 hidden sm:flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-[#800D15]" /> {currentTime}
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-stone-200 hidden lg:block" />

          {/* Branch Scoping Context */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-xs text-stone-500 font-medium hidden xl:inline">Branch:</span>
            {currentStaff?.role === 'super_admin' || currentStaff?.role === 'corporate_admin' || currentStaff?.role === 'auditor' || currentStaff?.role === 'accountant' ? (
              <select
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value as BranchId)}
                className="bg-stone-50 border border-stone-300 text-stone-900 text-xs font-bold rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#800D15]"
              >
                <option value="gra">GRA Flagship (Okogo St)</option>
                <option value="okabere">Okabere Hub (Sapele Rd)</option>
                <option value="ugbowo">Ugbowo Hub (UNIBEN)</option>
              </select>
            ) : (
              <span className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 text-xs font-bold text-stone-900 rounded-xl flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#800D15]" />
                {activeBranchId === 'gra' ? 'GRA Flagship' : activeBranchId === 'okabere' ? 'Okabere Hub' : 'Ugbowo Campus Hub'}
              </span>
            )}
          </div>
        </div>

        {/* Right: Shift Status & Staff Identity */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          <div className="hidden sm:block">
            <OfflineSyncBar compact />
          </div>
          {/* Shift Status Pill */}
          {currentShift ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono">{currentShift.shiftNumber}</span>
              <span className="text-[10px] text-emerald-700 hidden lg:inline">(Float: ₦{currentShift.openingFloat.toLocaleString()})</span>
            </div>
          ) : (
            <button
              onClick={() => setIsOpeningShiftModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#FFC700] hover:bg-amber-400 text-[#4D080F] text-[11px] sm:text-xs font-black flex items-center gap-1 transition-all shadow-2xs active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#800D15]" /> Open Shift
            </button>
          )}

          {/* Current Staff Badge */}
          <div className="hidden md:flex items-center gap-2 bg-stone-50 border border-stone-200 px-2.5 py-1 rounded-xl">
            <div className="w-6 h-6 rounded-lg bg-[#800D15] flex items-center justify-center text-[11px] font-black text-[#FFC700]">
              {currentStaff?.name ? currentStaff.name.charAt(0) : 'S'}
            </div>
            <div className="text-left leading-tight hidden lg:block">
              <p className="text-xs font-bold text-stone-900 truncate max-w-[110px]">{currentStaff?.name || 'Staff User'}</p>
              <p className="text-[9px] text-stone-500 uppercase tracking-wider font-semibold">{currentStaff?.role?.replace('_', ' ') || 'Cashier'}</p>
            </div>
          </div>

          {/* Hardware Printers Quick Trigger */}
          <button
            onClick={() => setIsHardwarePrinterOpen(true)}
            title="Hardware & Network Printers (TCP 9100 / ESC POS)"
            className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 text-xs font-bold items-center gap-1.5 transition-all shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#800D15]" />
            <span className="hidden xl:inline">Printers</span>
          </button>

          {/* Barcode & QR Scanner Quick Trigger */}
          <button
            onClick={() => setIsBarcodeScannerOpen(true)}
            title="Hardware & Optical Barcode Scanner"
            className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 text-xs font-bold items-center gap-1.5 transition-all shadow-2xs"
          >
            <Scan className="w-3.5 h-3.5 text-[#800D15]" />
            <span className="hidden xl:inline">Scanner</span>
          </button>

          {/* Customer-Facing Display (CFD) Mode */}
          <button
            onClick={() => setIsCfdModalOpen(true)}
            title="Customer-Facing Display (CFD)"
            className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-[#241311] hover:bg-[#FFC700]/20 hover:border-[#FFC700]/50 text-[#C5B4A5] hover:text-[#FFC700] border border-[#36221E] text-xs font-bold items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <Monitor className="w-3.5 h-3.5 text-[#FFC700]" />
            <span className="hidden xl:inline text-[11px]">CFD</span>
          </button>

          {/* Direct Switcher between Front-Office POS and Back-Office Admin */}
          {interfaceView === 'interface_b' && canAccessBackend && (
            <button
              onClick={() => {
                if (onNavigateRoute) {
                  onNavigateRoute('admin');
                } else {
                  setInterfaceView('interface_c');
                  setActiveTab('reports');
                }
              }}
              title="Switch to Back-Office Administration"
              className="px-2.5 py-1.5 rounded-xl bg-[#FFC700] hover:bg-[#FFE066] text-[#4D080F] text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#4D080F]" />
              <span>Back Office</span>
            </button>
          )}

          {interfaceView === 'interface_c' && (
            <button
              onClick={() => {
                if (onNavigateRoute) {
                  onNavigateRoute('pos');
                } else {
                  setInterfaceView('interface_b');
                  setActiveTab('pos');
                }
              }}
              title="Switch to Front-Office POS & Kitchen"
              className="px-2.5 py-1.5 rounded-xl bg-[#800D15] hover:bg-[#A3121B] text-[#FAF7F2] border border-[#FFC700]/30 text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
            >
              <Store className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>POS</span>
            </button>
          )}

          {/* Customer Storefront View Switcher */}
          <button
            onClick={() => {
              if (onNavigateRoute) {
                onNavigateRoute('storefront');
              } else {
                setIsStorefrontPreviewActive(true);
              }
            }}
            title="Preview Customer Storefront"
            className="px-2.5 py-1.5 rounded-xl bg-[#241311] hover:bg-[#FFC700]/20 hover:border-[#FFC700]/50 text-[#C5B4A5] hover:text-[#FFC700] border border-[#36221E] text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all"
          >
            <Eye className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Storefront</span>
          </button>

          {/* Secure Logout */}
          <button
            onClick={async () => {
              await logoutStaff();
              onNavigateRoute?.('storefront');
            }}
            title="Secure Staff Logout"
            className="p-1.5 sm:p-2 rounded-xl bg-[#241311] hover:bg-[#991B1B]/30 hover:border-[#991B1B] text-[#A89689] hover:text-[#EF4444] border border-[#36221E] transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Offline Connectivity & Synchronizer Banner */}
      <OfflineSyncBar />

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE BODY (SIDEBAR + MAIN CONTENT) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile & Tablet Slide-out Drawer */}
        {isMobileNavOpen && (
          <div className={`${activeTab === 'pos' ? 'xl:hidden' : 'lg:hidden'} fixed inset-0 z-50 flex`}>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
              onClick={() => setIsMobileNavOpen(false)}
            />
            {/* Drawer Content */}
            <div className="relative w-72 max-w-[85vw] bg-white border-r border-[#E5DEC9] h-full flex flex-col justify-between p-4 overflow-y-auto z-10 shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5DEC9]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#800D15] flex items-center justify-center font-bold text-[#FFC700] text-sm">
                      C
                    </div>
                    <span className="font-extrabold text-sm text-[#241311]">Staff Navigation</span>
                  </div>
                  <button
                    onClick={() => setIsMobileNavOpen(false)}
                    className="p-1.5 rounded-lg bg-[#FAF7F2] text-[#7A6A65] hover:text-[#241311] border border-[#E5DEC9]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile 3-Way Workspace Switcher (Storefront / Front-Office / Back-Office) */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A6A65] px-1">
                    Switch Workspace
                  </span>
                  <div className="grid grid-cols-3 gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#E5DEC9]">
                    <button
                      onClick={() => {
                        setIsMobileNavOpen(false);
                        if (onNavigateRoute) {
                          onNavigateRoute('storefront');
                        } else {
                          setIsStorefrontPreviewActive(true);
                        }
                      }}
                      className="py-1.5 px-1.5 text-[10px] font-black uppercase rounded-lg text-[#7A6A65] hover:text-[#241311] transition-all text-center"
                    >
                      Storefront
                    </button>
                    <button
                      onClick={() => {
                        setInterfaceView('interface_b');
                        if (['staff', 'audit', 'reports', 'inventory', 'cms', 'menu_catalog', 'payroll'].includes(activeTab)) {
                          setActiveTab('pos');
                        }
                        onNavigateRoute?.('pos');
                      }}
                      className={`py-1.5 px-1.5 text-[10px] font-black uppercase rounded-lg transition-all text-center ${
                        interfaceView === 'interface_b'
                          ? 'bg-[#800D15] text-white shadow-sm border border-[#FFC700]/30'
                          : 'text-[#7A6A65] hover:text-[#241311]'
                      }`}
                    >
                      Front-Office
                    </button>
                    {canAccessBackend && (
                      <button
                        onClick={() => {
                          setInterfaceView('interface_c');
                          if (['pos', 'tables', 'kds', 'dispatch'].includes(activeTab)) {
                            setActiveTab(currentStaff?.role === 'auditor' ? 'audit' : currentStaff?.role === 'accountant' ? 'reports' : currentStaff?.role === 'content_editor' ? 'cms' : currentStaff?.role === 'menu_manager' ? 'menu_catalog' : 'staff');
                          }
                          onNavigateRoute?.('admin');
                        }}
                        className={`py-1.5 px-1.5 text-[10px] font-black uppercase rounded-lg transition-all text-center ${
                          interfaceView === 'interface_c'
                            ? 'bg-[#FFC700] text-[#4D080F] shadow-sm'
                            : 'text-[#7A6A65] hover:text-[#241311]'
                        }`}
                      >
                        Back-Office
                      </button>
                    )}
                  </div>
                </div>

                {isFrontlineRole && (
                  <div className="px-3 py-1.5 bg-[#FFF8E7] border border-[#FFC700]/50 rounded-xl mb-2 text-[10px] font-bold text-[#800D15] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    <span>Front-Office Operations</span>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#7A6A65]">
                    {interfaceView === 'interface_c' ? 'Back-Office Management' : 'Front-Office Operations'}
                  </div>

                  {interfaceView === 'interface_b' ? (
                    <>
                      <button
                        onClick={() => { setActiveTab('pos'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'pos'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <Store className="w-4 h-4 text-[#FFC700]" />
                        <span>POS Register</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('tables'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'tables'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <LayoutGrid className="w-4 h-4 text-[#FFC700]" />
                        <span>Dine-in Tables</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('kds'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'kds'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <ChefHat className="w-4 h-4 text-[#FFC700]" />
                        <div className="flex-1 flex items-center justify-between">
                          <span>Kitchen Display</span>
                          {kdsTickets.length > 0 && (
                            <span className="px-2 py-0.5 bg-[#EF4444] text-white text-[10px] font-extrabold rounded-full">
                              {kdsTickets.length}
                            </span>
                          )}
                        </div>
                      </button>

                      <button
                        onClick={() => { setActiveTab('dispatch'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'dispatch'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <Truck className="w-4 h-4 text-[#FFC700]" />
                        <span>Delivery Dispatch</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('shifts'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'shifts'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <Clock className="w-4 h-4 text-[#FFC700]" />
                        <span>Cash Drawer & Shifts</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('expenses'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'expenses'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <Receipt className="w-4 h-4 text-[#FFC700]" />
                        <span>Expense Claims</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('catering'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'catering'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <UtensilsCrossed className="w-4 h-4 text-[#FFC700]" />
                        <span>Catering Orders</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('customercare'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'customercare'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <Phone className="w-4 h-4 text-[#FFC700]" />
                        <span>Customer Support</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('notifications'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'notifications'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <Bell className="w-4 h-4 text-[#FFC700]" />
                        <span>Messages & Alerts</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'auditor'].includes(currentStaff?.role || '') && (
                        <button
                          onClick={() => { setActiveTab('staff'); setIsMobileNavOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                            activeTab === 'staff'
                              ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                              : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                        >
                          <Users className="w-4 h-4 text-[#FFC700]" />
                          <span>Staff Directory & RBAC</span>
                        </button>
                      )}

                      {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'menu_manager'].includes(currentStaff?.role || '') && (
                        <button
                          onClick={() => { setActiveTab('menu_catalog'); setIsMobileNavOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                            activeTab === 'menu_catalog'
                              ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                              : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                        >
                          <UtensilsCrossed className="w-4 h-4 text-[#FFC700]" />
                          <span>Menu & Catalogue</span>
                        </button>
                      )}

                      {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'content_editor'].includes(currentStaff?.role || '') && (
                        <button
                          onClick={() => { setActiveTab('cms'); setIsMobileNavOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                            activeTab === 'cms'
                              ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                              : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                        >
                          <Globe className="w-4 h-4 text-[#FFC700]" />
                          <span>Website Content (CMS)</span>
                        </button>
                      )}

                      {['super_admin', 'corporate_admin', 'admin', 'store_manager', 'branch_manager', 'accountant', 'auditor'].includes(currentStaff?.role || '') && (
                        <>
                          <button
                            onClick={() => { setActiveTab('reports'); setIsMobileNavOpen(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                              activeTab === 'reports'
                                ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                                : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                            }`}
                          >
                            <BarChart3 className="w-4 h-4 text-[#FFC700]" />
                            <span>Live Executive Dashboard</span>
                          </button>
                          <button
                            onClick={() => { setActiveTab('enterprise_reports'); setIsMobileNavOpen(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                              activeTab === 'enterprise_reports'
                                ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                                : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                            }`}
                          >
                            <FileSpreadsheet className="w-4 h-4 text-[#FFC700]" />
                            <span>Reports &amp; Audited Exports</span>
                          </button>
                        </>
                      )}

                      {['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(currentStaff?.role || '') && (
                        <button
                          onClick={() => { setActiveTab('payroll'); setIsMobileNavOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                            activeTab === 'payroll'
                              ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                              : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                        >
                          <Banknote className="w-4 h-4 text-[#FFC700]" />
                          <span>Payroll Management</span>
                        </button>
                      )}

                      <button
                        onClick={() => { setActiveTab('expenses'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'expenses'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <Receipt className="w-4 h-4 text-[#FFC700]" />
                        <span>Expense Claims & Advances</span>
                      </button>

                      {['super_admin', 'corporate_admin', 'admin', 'store_manager', 'storekeeper', 'branch_manager', 'auditor', 'accountant'].includes(currentStaff?.role || '') && (
                        <button
                          onClick={() => { setActiveTab('inventory'); setIsMobileNavOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                            activeTab === 'inventory'
                              ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                        >
                          <Boxes className="w-4 h-4 text-[#FFC700]" />
                          <span>Inventory & Purchasing</span>
                        </button>
                      )}

                      {['super_admin', 'corporate_admin', 'admin', 'auditor', 'accountant', 'branch_manager'].includes(currentStaff?.role || '') && (
                        <button
                          onClick={() => { setActiveTab('audit'); setIsMobileNavOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                            activeTab === 'audit'
                              ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                              : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4 text-[#FFC700]" />
                          <span>Audit Logs</span>
                        </button>
                      )}

                      {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'accountant'].includes(currentStaff?.role || '') && (
                        <button
                          onClick={() => { setActiveTab('shifts'); setIsMobileNavOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                            activeTab === 'shifts'
                              ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                              : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                        >
                          <Clock className="w-4 h-4 text-[#FFC700]" />
                          <span>Shift Reconciliations</span>
                        </button>
                      )}

                      {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'accountant'].includes(currentStaff?.role || '') && (
                        <button
                          onClick={() => { setActiveTab('loyalty_vip'); setIsMobileNavOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                            activeTab === 'loyalty_vip'
                              ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                              : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                        >
                          <Award className="w-4 h-4 text-[#FFC700]" />
                          <span>Loyalty & House Accounts</span>
                        </button>
                      )}

                      <button
                        onClick={() => { setActiveTab('customercare'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'customercare'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <Phone className="w-4 h-4 text-[#FFC700]" />
                        <span>Customer Support</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('notifications'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'notifications'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <Bell className="w-4 h-4 text-[#FFC700]" />
                        <span>Messages & Alerts</span>
                      </button>

                      <button
                        onClick={() => { setActiveTab('catering'); setIsMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          activeTab === 'catering'
                            ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <UtensilsCrossed className="w-4 h-4 text-[#FFC700]" />
                        <span>Catering Planner</span>
                      </button>

                      {['super_admin', 'corporate_admin', 'admin', 'branch_manager'].includes(currentStaff?.role || '') && (
                        <button
                          onClick={() => { setActiveTab('settings'); setIsMobileNavOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                            activeTab === 'settings'
                              ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                              : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                        >
                          <Settings className="w-4 h-4 text-[#FFC700]" />
                          <span>System Configuration</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E5DEC9] space-y-2">
                <button
                  onClick={() => { setIsStorefrontPreviewActive(true); setIsMobileNavOpen(false); }}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#FAF7F2] text-[#241311] hover:text-[#800D15] text-xs font-bold flex items-center justify-center gap-2 border border-[#E5DEC9]"
                >
                  <Eye className="w-4 h-4" /> Switch to Storefront
                </button>
                <button
                  onClick={() => logoutStaff()}
                  className="w-full py-2.5 px-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold flex items-center justify-center gap-2 border border-red-200"
                >
                  <LogOut className="w-4 h-4" /> Staff Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Persistent Left Navigation (Desktop >= xl on POS, >= lg on Back-Office) */}
        <aside
          className={`${
            activeTab === 'pos' ? 'hidden xl:flex xl:w-56' : 'hidden lg:flex lg:w-52 xl:w-56'
          } bg-white border-r border-stone-200 flex-col justify-between shrink-0 p-3 overflow-y-auto shadow-xs`}
        >
          <div className="space-y-1">
            {/* Interface Switcher for Manager / Admin Roles */}
            {canAccessBackend && (
              <div className="flex bg-[#FAF7F2] p-1 rounded-xl border border-[#E5DEC9] mb-2.5">
                <button
                  onClick={() => {
                    setInterfaceView('interface_b');
                    if (['staff', 'audit', 'reports', 'inventory', 'cms', 'menu_catalog'].includes(activeTab)) {
                      setActiveTab('pos');
                    }
                  }}
                  className={`flex-1 py-1 px-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                    interfaceView === 'interface_b'
                      ? 'bg-[#800D15] text-white shadow-sm border border-[#FFC700]/30'
                      : 'text-[#7A6A65] hover:text-[#241311]'
                  }`}
                >
                  Front-Office
                </button>
                <button
                  onClick={() => {
                    setInterfaceView('interface_c');
                    if (['pos', 'tables', 'kds', 'dispatch'].includes(activeTab)) {
                      setActiveTab(currentStaff?.role === 'auditor' ? 'audit' : currentStaff?.role === 'accountant' ? 'reports' : currentStaff?.role === 'content_editor' ? 'cms' : currentStaff?.role === 'menu_manager' ? 'menu_catalog' : 'staff');
                    }
                  }}
                  className={`flex-1 py-1 px-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                    interfaceView === 'interface_c'
                      ? 'bg-[#FFC700] text-[#4D080F] shadow-sm'
                      : 'text-[#7A6A65] hover:text-[#241311]'
                  }`}
                >
                  Back-Office
                </button>
              </div>
            )}

            {isFrontlineRole && (
              <div className="px-2.5 py-1.5 bg-[#FFF8E7] border border-[#FFC700]/50 rounded-xl mb-2 text-[10px] font-bold text-[#800D15] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                <span className="truncate">Front-Office Operations</span>
              </div>
            )}

            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#7A6A65]">
              {interfaceView === 'interface_c' ? 'Back-Office Management' : 'Front-Office Operations'}
            </div>

            {interfaceView === 'interface_b' ? (
              <>
                <button
                  onClick={() => setActiveTab('pos')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'pos'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Store className="w-4 h-4 text-[#FFC700]" />
                  <span>POS Register</span>
                </button>

                <button
                  onClick={() => setActiveTab('tables')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'tables'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4 text-[#FFC700]" />
                  <span>Dine-in Tables</span>
                </button>

                <button
                  onClick={() => setActiveTab('kds')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'kds'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <ChefHat className="w-4 h-4 text-[#FFC700]" />
                  <div className="flex-1 flex items-center justify-between">
                    <span>Kitchen Display</span>
                    {kdsTickets.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-[#EF4444] text-white text-[10px] font-extrabold rounded-full">
                        {kdsTickets.length}
                      </span>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('dispatch')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'dispatch'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Truck className="w-4 h-4 text-[#FFC700]" />
                  <span>Delivery Dispatch</span>
                </button>

                <button
                  onClick={() => setActiveTab('shifts')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'shifts'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Clock className="w-4 h-4 text-[#FFC700]" />
                  <span>Cash Drawer & Shifts</span>
                </button>

                <button
                  onClick={() => setActiveTab('expenses')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'expenses'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Receipt className="w-4 h-4 text-[#FFC700]" />
                  <span>Expense Claims</span>
                </button>

                <button
                  onClick={() => setActiveTab('catering')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'catering'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4 text-[#FFC700]" />
                  <span>Catering Orders</span>
                </button>

                <button
                  onClick={() => setActiveTab('customercare')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'customercare'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Phone className="w-4 h-4 text-[#FFC700]" />
                  <span>Customer Support</span>
                </button>

                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'notifications'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Bell className="w-4 h-4 text-[#FFC700]" />
                  <span>Messages & Alerts</span>
                </button>
              </>
            ) : (
              <>
                {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'auditor'].includes(currentStaff?.role || '') && (
                  <button
                    onClick={() => setActiveTab('staff')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'staff'
                        ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <Users className="w-4 h-4 text-[#FFC700]" />
                    <span>Staff Directory & RBAC</span>
                  </button>
                )}

                {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'menu_manager'].includes(currentStaff?.role || '') && (
                  <button
                    onClick={() => setActiveTab('menu_catalog')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'menu_catalog'
                        ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <UtensilsCrossed className="w-4 h-4 text-[#FFC700]" />
                    <span>Menu & Catalogue</span>
                  </button>
                )}

                {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'content_editor'].includes(currentStaff?.role || '') && (
                  <button
                    onClick={() => setActiveTab('cms')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'cms'
                        ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-[#FFC700]" />
                    <span>Website Content (CMS)</span>
                  </button>
                )}

                {['super_admin', 'corporate_admin', 'admin', 'store_manager', 'branch_manager', 'accountant', 'auditor'].includes(currentStaff?.role || '') && (
                  <>
                    <button
                      onClick={() => setActiveTab('reports')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'reports'
                          ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                          : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4 text-[#FFC700]" />
                      <span>Live Executive Dashboard</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('enterprise_reports')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'enterprise_reports'
                          ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                          : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-[#FFC700]" />
                      <span>Reports &amp; Audited Exports</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setActiveTab('expenses')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    activeTab === 'expenses'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Receipt className="w-4 h-4 text-[#FFC700] shrink-0" />
                  <span className="text-left">Expense Claims & Advances</span>
                </button>

                {['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(currentStaff?.role || '') && (
                  <button
                    onClick={() => setActiveTab('payroll')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'payroll'
                        ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-[#FFC700]" />
                    <span>Payroll Management</span>
                  </button>
                )}

                {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'accountant', 'auditor'].includes(currentStaff?.role || '') && (
                  <button
                    onClick={() => setActiveTab('reconciliation')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                      activeTab === 'reconciliation'
                        ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-[#FFC700] shrink-0" />
                    <span className="text-left">Payment Reconciliation</span>
                  </button>
                )}

                {['super_admin', 'corporate_admin', 'admin', 'store_manager', 'storekeeper', 'branch_manager', 'auditor', 'accountant'].includes(currentStaff?.role || '') && (
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                      activeTab === 'inventory'
                        ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <Boxes className="w-4 h-4 text-[#FFC700] shrink-0" />
                    <span className="text-left">Inventory & Purchasing</span>
                  </button>
                )}

                {['super_admin', 'corporate_admin', 'admin', 'auditor', 'accountant', 'branch_manager'].includes(currentStaff?.role || '') && (
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'audit'
                        ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-[#FFC700]" />
                    <span>Audit Logs</span>
                  </button>
                )}

                {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'accountant'].includes(currentStaff?.role || '') && (
                  <button
                    onClick={() => setActiveTab('shifts')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'shifts'
                        ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-[#FFC700]" />
                    <span>Shift Reconciliations</span>
                  </button>
                )}

                {['super_admin', 'corporate_admin', 'admin', 'branch_manager', 'accountant'].includes(currentStaff?.role || '') && (
                  <button
                    onClick={() => setActiveTab('loyalty_vip')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                      activeTab === 'loyalty_vip'
                        ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <Award className="w-4 h-4 text-[#FFC700] shrink-0" />
                    <span className="text-left">Loyalty & House Accounts</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('customercare')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'customercare'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Phone className="w-4 h-4 text-[#FFC700]" />
                  <span>Customer Support</span>
                </button>

                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'notifications'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Bell className="w-4 h-4 text-[#FFC700]" />
                  <span>Messages & Alerts</span>
                </button>

                <button
                  onClick={() => setActiveTab('catering')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'catering'
                      ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4 text-[#FFC700]" />
                  <span>Catering Planner</span>
                </button>

                {['super_admin', 'corporate_admin', 'admin', 'branch_manager'].includes(currentStaff?.role || '') && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'settings'
                        ? 'bg-[#800D15] text-[#FAF7F2] shadow-md border border-[#FFC700]/30'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-[#FFC700]" />
                    <span>System Configuration</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-[#FAF7F2] border border-[#E5DEC9] p-2.5 rounded-xl text-[11px] text-[#7A6A65] space-y-1.5 mt-4">
            <p className="font-bold text-[#241311]">Active Checks: {checks.filter((c) => c.status === 'open' || c.status === 'sent_to_kitchen').length}</p>
            <p className="text-[10px]">Database: <span className="text-emerald-700 font-mono font-bold">PERSISTED (WAL)</span></p>
          </div>
        </aside>

        {/* Main Operational Stage */}
        <main className="flex-1 bg-[#FAF7F2] flex flex-col overflow-hidden relative">
          <RoleOperationalDashboardBanner
            currentStaff={currentStaff}
            activeBranchId={activeBranchId}
            branchName={
              branches.find((b) => b.id === activeBranchId)?.name ||
              (activeBranchId === 'gra' ? 'GRA Flagship (Okogo St)' : activeBranchId)
            }
            currentShift={currentShift}
            checks={checks}
            inventoryList={inventoryList}
            stockRequests={stockRequests}
            wastageLogs={wastageLogs}
            deliveryTasks={deliveryTasks}
            kdsTickets={kdsTickets}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenNewCheck={handleOpenNewCheck}
            onOpenShiftModal={() => setIsOpeningShiftModalOpen(true)}
          />
          {/* =================================================================== */}
          {/* 1. POS & ACTIVE CHECKS VIEW */}
          {/* =================================================================== */}
          {activeTab === 'pos' && (
            <WorkspacePosTab
              mobilePosView={mobilePosView}
              setMobilePosView={setMobilePosView}
              filteredProducts={filteredProducts}
              posSearch={posSearch}
              setPosSearch={setPosSearch}
              posCategory={posCategory}
              setPosCategory={setPosCategory}
              activeBranchId={activeBranchId}
              getProductPrice={getProductPrice}
              isProductAvailable={isProductAvailable}
              handleAddItemToCheck={handleAddItemToCheck}
              handleOpenNewCheck={handleOpenNewCheck}
              tables={tables}
              activeCheck={activeCheck}
              checks={checks}
              setActiveCheck={setActiveCheck}
              handleUpdateItemQty={handleUpdateItemQty}
              setIsDiscountModalOpen={setIsDiscountModalOpen}
              setIsSplitBillModalOpen={setIsSplitBillModalOpen}
              setIsTableTransferModalOpen={setIsTableTransferModalOpen}
              handleSendToKitchen={handleSendToKitchen}
              setIsPaymentModalOpen={setIsPaymentModalOpen}
            />
          )}

          {/* 2. FLOOR & TABLES VIEW */}
          {activeTab === 'tables' && (
            <WorkspaceTablesTab
              activeBranchId={activeBranchId}
              tables={tables}
              checks={checks}
              setActiveCheck={setActiveCheck}
              handleOpenNewCheck={handleOpenNewCheck}
              setActiveTab={setActiveTab}
            />
          )}

          {/* 3. KITCHEN DISPLAY SYSTEM (KDS) */}
          {activeTab === 'kds' && (
            <WorkspaceKdsTab
              kdsChannelFilter={kdsChannelFilter}
              setKdsChannelFilter={setKdsChannelFilter}
              kdsShowBumped={kdsShowBumped}
              setKdsShowBumped={setKdsShowBumped}
              fetchKds={fetchKds}
              kdsTickets={kdsTickets}
              handleAdvanceKdsItem={handleAdvanceKdsItem}
              handleRecallKdsTicket={handleRecallKdsTicket}
              handleBumpKdsTicket={handleBumpKdsTicket}
            />
          )}

          {/* 4. DISPATCH & RIDER FLEET MANAGEMENT HUB */}
          {activeTab === 'dispatch' && (
            <DispatchOperationsHub
              activeBranchId={activeBranchId}
              currentStaff={currentStaff as any}
              showToast={showToast}
            />
          )}

          {/* 5. MASTER INVENTORY & PURCHASING */}
          {activeTab === 'inventory' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <MasterInventoryManager
                selectedBranchId={activeBranchId}
                onSelectBranch={(bId) => setActiveBranchId(bId)}
              />
            </div>
          )}

          {/* 5.5. PHYSICAL STORE PAYMENT RECONCILIATION */}
          {activeTab === 'reconciliation' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <PaymentReconciliationManager />
            </div>
          )}

          {/* 5.8. OPERATIONAL EXPENSE CLAIMS, CASH ADVANCES & REIMBURSEMENTS */}
          {activeTab === 'expenses' && (
            <ExpenseClaimsWorkspace
              activeBranchId={activeBranchId}
              currentStaff={currentStaff!}
              showToast={showToast}
            />
          )}

          {/* 5.9. PAYROLL MANAGEMENT */}
          {activeTab === 'payroll' && (
            <PayrollManagementHub />
          )}

          {/* 6. SHIFTS & TILL RECONCILIATION */}
          {activeTab === 'shifts' && (
            <WorkspaceShiftsTab
              currentShift={currentShift}
              setIsCashMovementModalOpen={setIsCashMovementModalOpen}
              setIsClosingShiftModalOpen={setIsClosingShiftModalOpen}
              setIsOpeningShiftModalOpen={setIsOpeningShiftModalOpen}
            />
          )}

          {/* 7. EXECUTIVE ANALYTICS & BI DASHBOARD */}
          {activeTab === 'reports' && (
            !canAccessBackend ? (
              <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-800 text-red-500 flex items-center justify-center">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-[#241311]">Access Restricted — Interface C Required</h2>
                <p className="text-sm text-[#7A6A65] max-w-md">
                  Executive analytics, financial reports, and business intelligence are restricted to management and administrative personnel.
                </p>
                <button
                  onClick={() => setActiveTab('pos')}
                  className="px-5 py-2.5 bg-[#FFC700] text-[#4D080F] font-black text-xs uppercase rounded-xl hover:bg-[#E6B200] transition-colors"
                >
                  Return to POS Register
                </button>
              </div>
            ) : (
              <ExecutiveBIDashboard
                currentStaffRole={currentStaff?.role}
                currentStaffBranchId={currentStaff?.branchId}
                defaultBranchId={activeBranchId}
              />
            )
          )}

          {/* 7.5. DEDICATED ENTERPRISE REPORTS & AUDITED EXPORTS HUB */}
          {activeTab === 'enterprise_reports' && <EnterpriseReportsHub />}

          {/* 8. STAFF & ROLES (ChopLife RBAC & Directory) */}
          {activeTab === 'staff' && (
            <WorkspaceStaffTab
              canAccessBackend={canAccessBackend}
              setActiveTab={setActiveTab}
              staffSubTab={staffSubTab}
              setStaffSubTab={setStaffSubTab}
              handleOpenNewStaffModal={handleOpenNewStaffModal}
              upcomingBirthdays={upcomingBirthdays}
              staffAccountsList={staffAccountsList}
              setEffectiveAccessStaffId={setEffectiveAccessStaffId}
              setIsEffectiveAccessOpen={setIsEffectiveAccessOpen}
              handleEditStaffModal={handleEditStaffModal}
              handleResetStaffPassword={handleResetStaffPassword}
              currentStaffRole={currentStaff?.role}
              showToast={showToast}
            />
          )}

          {/* 9. SECURITY AUDIT LOGS */}
          {activeTab === 'audit' && (
            <WorkspaceAuditTab
              canAccessBackend={canAccessBackend}
              setActiveTab={setActiveTab}
              auditLogsList={auditLogsList}
            />
          )}

          {/* =================================================================== */}
          {/* 10. CUSTOMER CARE & SUPPORT HUB */}
          {/* =================================================================== */}
          {activeTab === 'customercare' && (
            <CustomerCareHub
              activeBranchId={activeBranchId}
              currentStaff={currentStaff!}
              showToast={showToast}
            />
          )}

          {/* =================================================================== */}
          {/* 10.5 AUTOMATED MULTI-CHANNEL NOTIFICATION ENGINE (SMS & WHATSAPP) */}
          {/* =================================================================== */}
          {activeTab === 'notifications' && (
            <div className="flex-1 overflow-y-auto">
              <NotificationHub
                activeBranchId={activeBranchId}
                currentStaff={currentStaff!}
                showToast={showToast}
              />
            </div>
          )}

          {/* =================================================================== */}
          {/* 11. CATERING PRODUCTION PLANNER & EVENT DISPATCH */}
          {/* =================================================================== */}
          {activeTab === 'catering' && (
            <div className="flex-1 overflow-y-auto">
              <CateringProductionPlanner />
            </div>
          )}

          {/* =================================================================== */}
          {/* 12. VIP LOYALTY, DIGITAL WALLETS & CORPORATE HOUSE ACCOUNTS */}
          {/* =================================================================== */}
          {activeTab === 'loyalty_vip' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <LoyaltyAndHouseAccountsHub
                activeBranchId={activeBranchId}
                currentStaff={currentStaff!}
                showToast={showToast}
              />
            </div>
          )}

          {/* =================================================================== */}
          {/* 13. MENU & CATALOGUE ADMINISTRATION */}
          {/* =================================================================== */}
          {activeTab === 'menu_catalog' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <MenuCatalogueManager />
            </div>
          )}

          {/* =================================================================== */}
          {/* 14. WEBSITE CONTENT MANAGEMENT (CMS) */}
          {/* =================================================================== */}
          {activeTab === 'cms' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <WebsiteCmsManager />
            </div>
          )}

          {/* =================================================================== */}
          {/* 15. ADVANCED SYSTEM CONFIGURATION & GOVERNANCE HUB */}
          {/* =================================================================== */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <SystemConfigurationHub />
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODALS: PAYMENT, DISCOUNT, OPEN SHIFT, CASH MOVEMENTS, RECEIPT */}
      {/* ========================================================================= */}

      {/* 1. Payment Modal (Warm Editorial Light Theme + Remaining Balance & Mixed Tender Support) */}
      {isPaymentModalOpen && activeCheck && (() => {
        const payableAmount = Number(activeCheck.remainingBalance ?? activeCheck.total);
        const alreadyPaid = Number(activeCheck.amountPaid || 0);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 font-montserrat text-[#241311]">
              <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
                <div>
                  <h3 className="font-titan text-base text-[#4D080F]">Settle Check #{activeCheck.checkNumber}</h3>
                  <p className="text-xs text-stone-500 font-semibold">{activeCheck.tableNumber || activeCheck.checkType}</p>
                </div>
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100"
                >
                  ✕
                </button>
              </div>

              {/* Total / Remaining Amount Banner */}
              <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9] text-center space-y-1">
                {alreadyPaid > 0 && (
                  <div className="flex justify-between text-[11px] text-stone-600 border-b border-[#E5DEC9] pb-1 mb-1">
                    <span>Check Total: ₦{activeCheck.total.toLocaleString()}</span>
                    <span className="text-emerald-700 font-bold">Already Paid: ₦{alreadyPaid.toLocaleString()}</span>
                  </div>
                )}
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  {alreadyPaid > 0 ? 'Remaining Balance Payable' : 'Total Amount Payable'}
                </span>
                <p className="font-mono font-black text-2xl text-[#800D15] mt-0.5">₦{payableAmount.toLocaleString()}</p>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-6 gap-1.5">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-[#800D15] border-[#800D15] text-[#FFC700] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E5DEC9] text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Banknote className="w-4 h-4" /> Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('pos_terminal')}
                  className={`p-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'pos_terminal'
                      ? 'bg-[#800D15] border-[#800D15] text-[#FFC700] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E5DEC9] text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <CreditCard className="w-4 h-4" /> POS
                </button>
                <button
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={`p-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'bank_transfer'
                      ? 'bg-[#800D15] border-[#800D15] text-[#FFC700] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E5DEC9] text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Building className="w-4 h-4" /> Transfer
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod('split');
                    const half = Math.floor(payableAmount / 2);
                    setSplitCashAmount(String(half));
                    setSplitPosAmount(String(payableAmount - half));
                  }}
                  className={`p-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'split'
                      ? 'bg-[#800D15] border-[#800D15] text-[#FFC700] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E5DEC9] text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Split className="w-4 h-4" /> Mixed
                </button>
                <button
                  onClick={() => setPaymentMethod('wallet')}
                  className={`p-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'wallet'
                      ? 'bg-[#800D15] border-[#800D15] text-[#FFC700] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E5DEC9] text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Wallet className="w-4 h-4" /> Wallet
                </button>
                <button
                  onClick={() => setPaymentMethod('house_account')}
                  className={`p-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'house_account'
                      ? 'bg-[#800D15] border-[#800D15] text-[#FFC700] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E5DEC9] text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Award className="w-4 h-4" /> Corp Acct
                </button>
              </div>

              {/* Payment Fields */}
              {paymentMethod === 'cash' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-700">Cash Tendered (₦)</label>
                  <input
                    type="number"
                    placeholder={String(payableAmount)}
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-sm text-[#241311] font-mono font-bold focus:outline-hidden focus:border-[#4D080F]"
                  />
                  {Number(cashTendered) > payableAmount && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-mono font-bold flex justify-between">
                      <span>Change Due:</span>
                      <span>₦{(Number(cashTendered) - payableAmount).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'pos_terminal' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-700">POS Terminal RRN / STAN Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 0048291038"
                    value={posRrn}
                    onChange={(e) => setPosRrn(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-sm text-[#241311] font-mono font-bold focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
              )}

              {paymentMethod === 'bank_transfer' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-700">Bank Transfer Session ID / Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. TRF-GTB-849102"
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-sm text-[#241311] font-mono font-bold focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
              )}

              {paymentMethod === 'split' && (
                <div className="space-y-2.5 bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DEC9]">
                  <p className="text-[11px] font-bold text-[#4D080F]">Mixed Tender Breakdown (Cash + POS)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-stone-600 block mb-1">Cash Leg (₦)</label>
                      <input
                        type="number"
                        value={splitCashAmount}
                        onChange={(e) => {
                          setSplitCashAmount(e.target.value);
                          const rem = Math.max(0, payableAmount - (Number(e.target.value) || 0));
                          setSplitPosAmount(String(rem));
                        }}
                        className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#241311]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-600 block mb-1">POS Leg (₦)</label>
                      <input
                        type="number"
                        value={splitPosAmount}
                        onChange={(e) => setSplitPosAmount(e.target.value)}
                        className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#241311]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 block mb-1">POS RRN / Ref</label>
                    <input
                      type="text"
                      placeholder="POS RRN Reference"
                      value={posRrn}
                      onChange={(e) => setPosRrn(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#241311]"
                    />
                  </div>
                </div>
              )}

              {/* DIGITAL WALLET PAYMENT FORM */}
              {paymentMethod === 'wallet' && (
                <div className="space-y-3 bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DEC9]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4D080F] flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-[#800D15]" /> Patron Digital Wallet
                    </span>
                    <span className="text-[10px] text-stone-500 font-semibold">Pre-paid Stored Float</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">Select Registered Member *</label>
                    <select
                      value={selectedCustomerIdForPayment}
                      onChange={(e) => setSelectedCustomerIdForPayment(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs text-[#241311] font-semibold focus:outline-hidden focus:border-[#4D080F]"
                    >
                      <option value="">-- Choose Member --</option>
                      {posCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone}) - Bal: ₦{Number(c.walletBalance).toLocaleString()} [{c.tier.toUpperCase()}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCustomerIdForPayment &&
                    (() => {
                      const cust = posCustomers.find((c) => c.id === selectedCustomerIdForPayment);
                      if (!cust) return null;
                      const canAfford = cust.walletBalance >= payableAmount;
                      return (
                        <div className="space-y-2 pt-1 border-t border-[#E5DEC9]">
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-600">Available Balance:</span>
                            <span className={`font-mono font-bold ${canAfford ? 'text-emerald-700' : 'text-red-700'}`}>
                              ₦{Number(cust.walletBalance).toLocaleString()}
                            </span>
                          </div>

                          {!canAfford && (
                            <div className="text-[11px] text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                              Insufficient balance. Patron needs ₦{(payableAmount - cust.walletBalance).toLocaleString()} top-up.
                            </div>
                          )}

                          <div>
                            <label className="text-[11px] font-bold text-stone-700 block mb-1">Customer 4-Digit Security PIN *</label>
                            <input
                              type="password"
                              maxLength={4}
                              placeholder="PIN"
                              value={walletPinForPayment}
                              onChange={(e) => setWalletPinForPayment(e.target.value)}
                              className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] font-mono tracking-widest focus:outline-hidden focus:border-[#4D080F]"
                            />
                          </div>
                        </div>
                      );
                    })()}
                </div>
              )}

              {/* CORPORATE HOUSE ACCOUNT PAYMENT FORM */}
              {paymentMethod === 'house_account' && (
                <div className="space-y-3 bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DEC9]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4D080F] flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-[#800D15]" /> Corporate House Account
                    </span>
                    <span className="text-[10px] text-stone-500 font-semibold">Direct Client Billing</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">Select Corporate Account *</label>
                    <select
                      value={selectedHouseAccountIdForPayment}
                      onChange={(e) => {
                        setSelectedHouseAccountIdForPayment(e.target.value);
                        const acc = posHouseAccounts.find((a) => a.id === e.target.value);
                        if (acc?.authorizedSigners?.[0]) {
                          setAuthorizedSignerForPayment(acc.authorizedSigners[0].name);
                        } else if (acc?.contactPerson) {
                          setAuthorizedSignerForPayment(acc.contactPerson);
                        }
                      }}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs text-[#241311] font-semibold focus:outline-hidden focus:border-[#4D080F]"
                    >
                      <option value="">-- Choose Corporate Account --</option>
                      {posHouseAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.companyName} ({a.accountCode}) - Avail: ₦{Math.max(0, a.creditLimit - a.currentBalance).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedHouseAccountIdForPayment &&
                    (() => {
                      const acc = posHouseAccounts.find((a) => a.id === selectedHouseAccountIdForPayment);
                      if (!acc) return null;
                      const availCredit = Math.max(0, acc.creditLimit - acc.currentBalance);
                      const canCharge = availCredit >= payableAmount;
                      return (
                        <div className="space-y-2 pt-1 border-t border-[#E5DEC9]">
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-600">Remaining Credit Line:</span>
                            <span className={`font-mono font-bold ${canCharge ? 'text-emerald-700' : 'text-red-700'}`}>
                              ₦{availCredit.toLocaleString()}
                            </span>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-stone-700 block mb-1">Authorized Signer *</label>
                            <input
                              type="text"
                              required
                              placeholder="Signer Full Name"
                              value={authorizedSignerForPayment}
                              onChange={(e) => setAuthorizedSignerForPayment(e.target.value)}
                              className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                            />
                          </div>
                        </div>
                      );
                    })()}
                </div>
              )}

              {/* Optional Loyalty Attaching for Cash / POS / Transfer */}
              {paymentMethod !== 'wallet' && (
                <div className="bg-[#FAF7F2] p-2.5 rounded-xl border border-[#E5DEC9]">
                  <div className="flex items-center justify-between text-[11px] text-stone-600">
                    <span className="flex items-center gap-1 font-bold text-[#4D080F]">
                      <Sparkles className="w-3 h-3 text-[#800D15]" /> VIP Patron Points & Stamps
                    </span>
                    <span>(Optional)</span>
                  </div>
                  <select
                    value={selectedCustomerIdForPayment}
                    onChange={(e) => setSelectedCustomerIdForPayment(e.target.value)}
                    className="mt-1.5 w-full bg-white border border-[#E5DEC9] rounded-lg px-2 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                  >
                    <option value="">-- No Member Attached --</option>
                    {posCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) [{c.tier.toUpperCase()}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Confirm Payment CTA */}
              <button
                onClick={handleCompletePayment}
                className="w-full py-3 bg-[#15803D] hover:bg-[#166534] text-white font-black text-sm rounded-xl transition-all shadow-md active:scale-95"
              >
                Confirm Settlement (₦{payableAmount.toLocaleString()}) & Print Receipt
              </button>
            </div>
          </div>
        );
      })()}

      {/* 2. Open Shift Modal */}
      {isOpeningShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-titan text-base text-[#4D080F]">Open New Shift</h3>
            <p className="text-xs text-stone-500 font-montserrat">Enter the counted physical cash float placed into the register till.</p>

            <div className="space-y-1.5 font-montserrat">
              <label className="text-xs font-bold text-stone-700">Opening Cash Float (₦)</label>
              <input
                type="number"
                placeholder="e.g. 10000"
                value={openingFloatInput}
                onChange={(e) => setOpeningFloatInput(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-sm text-[#241311] font-mono font-bold focus:outline-hidden focus:border-[#4D080F]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsOpeningShiftModalOpen(false)}
                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleOpenShift}
                className="flex-1 py-2 bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] text-xs font-titan uppercase tracking-wider rounded-xl shadow-xs transition-colors"
              >
                Open Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Discount Modal */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-titan text-base text-[#4D080F]">Apply Authorized Discount</h3>

            <div className="space-y-2 font-montserrat">
              <label className="text-xs font-bold text-stone-700">Discount Percentage (%)</label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDiscountPercentInput(pct)}
                    className={`py-1.5 rounded-lg text-xs font-titan border transition-all ${
                      discountPercentInput === pct
                        ? 'bg-[#E62E00] text-white border-[#E62E00] shadow-xs'
                        : 'bg-[#FAF7F2] text-stone-700 border-[#E5DEC9] hover:bg-white'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 font-montserrat">
              <label className="text-xs font-bold text-stone-700">Authorized Reason</label>
              <select
                value={discountReasonInput}
                onChange={(e) => setDiscountReasonInput(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] font-bold outline-none focus:border-[#4D080F]"
              >
                <option value="VIP Courtesy">VIP Courtesy</option>
                <option value="Staff Meal">Staff Meal</option>
                <option value="Management Approved">Management Approved</option>
                <option value="Customer Goodwill">Customer Goodwill</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsDiscountModalOpen(false)}
                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDiscount}
                className="flex-1 py-2 bg-[#E62E00] hover:bg-[#c92800] text-white text-xs font-titan uppercase tracking-wider rounded-xl shadow-xs transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Thermal Receipt Modal (Connected to Editable Receipt Template) */}
      {isReceiptModalOpen && lastPaidCheck && (() => {
        const tpl = getCachedReceiptTemplate('customer_receipt');
        const branchDetails = resolveBranchDetails(lastPaidCheck.branchId);
        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#FAF7F2] text-[#120B0A] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl font-mono text-xs animate-in zoom-in-95">
              <div className="text-center space-y-1 border-b border-dashed border-[#120B0A]/30 pb-3">
                <h4 className="font-black text-sm uppercase">{tpl?.brandName || 'CHOPLIFE REPUBLIC'}</h4>
                {tpl?.tagline && (
                  <p className="text-[10px] text-gray-700 font-bold uppercase">{tpl.tagline}</p>
                )}
                <p className="text-[10px] text-gray-600 uppercase font-semibold">
                  {branchDetails.name}
                </p>
                {(tpl?.showBranchAddress !== false) && (
                  <p className="text-[10px] text-gray-600">{branchDetails.address}</p>
                )}
                {(tpl?.showBranchPhone !== false) && (
                  <p className="text-[10px] text-gray-500">Tel: {tpl?.phone || branchDetails.phone}</p>
                )}
                {tpl?.customHeaderMessage && (
                  <p className="text-[10px] text-[#800D15] font-bold pt-0.5">{tpl.customHeaderMessage}</p>
                )}
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-[#120B0A]/30 pb-2">
                <div className="flex justify-between">
                  <span>Receipt #:</span>
                  <span className="font-bold">{lastPaidCheck.checkNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(lastPaidCheck.closedAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Table / Type:</span>
                  <span>{lastPaidCheck.tableNumber || lastPaidCheck.checkType}</span>
                </div>
                {(tpl?.showCashierName !== false) && (
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>{lastPaidCheck.closedByName}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-1.5 border-b border-dashed border-[#120B0A]/30 pb-2">
                {lastPaidCheck.items.map((it: any) => (
                  <div key={it.id} className="flex justify-between text-[11px]">
                    <span>{it.quantity}x {it.name}</span>
                    <span className="font-bold">₦{it.totalPrice.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-xs font-bold pt-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₦{lastPaidCheck.subtotal.toLocaleString()}</span>
                </div>
                {lastPaidCheck.discountAmount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount:</span>
                    <span>-₦{lastPaidCheck.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black pt-1 border-t border-[#120B0A]">
                  <span>TOTAL PAID:</span>
                  <span>₦{lastPaidCheck.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 uppercase pt-1">
                  <span>Payment Method:</span>
                  <span>{lastPaidCheck.paymentMethod}</span>
                </div>
                {Array.isArray(lastPaidCheck.payments) && lastPaidCheck.payments.length > 1 && (
                  <div className="pt-1.5 border-t border-dashed border-[#120B0A]/20 space-y-0.5 text-[10px] text-gray-700">
                    <span className="font-bold uppercase block">Split / Tender Breakdown:</span>
                    {lastPaidCheck.payments.map((p: any, idx: number) => (
                      <div key={p.id || idx} className="flex justify-between">
                        <span>
                          {p.shareId ? `${p.shareId} • ` : ''}
                          {String(p.method || '').replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="font-mono font-bold">₦{Number(p.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-[10px] text-center text-gray-500 pt-2 border-t border-dashed border-[#120B0A]/30 space-y-0.5">
                <p className="font-bold text-[#120B0A]">{tpl?.thankYouMessage || 'Thank you for dining at Choplife Republic!'}</p>
                {tpl?.customFooterMessage && <p>{tpl.customFooterMessage}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    dispatchCustomerReceipt(lastPaidCheck);
                  }}
                  className="w-full py-2 bg-[#800D15] hover:bg-[#4D080F] text-[#FFC700] font-sans font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Thermal
                </button>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="w-full py-2 bg-[#120B0A] text-[#FAF7F2] font-sans font-bold text-xs rounded-xl"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. Safe Drop / Paid Out Cash Movement Modal */}
      <CashMovementModal
        isOpen={isCashMovementModalOpen}
        onClose={() => setIsCashMovementModalOpen(false)}
        currentShift={currentShift}
        cashMovementType={cashMovementType}
        setCashMovementType={setCashMovementType}
        cashMovementAmount={cashMovementAmount}
        setCashMovementAmount={setCashMovementAmount}
        cashMovementReason={cashMovementReason}
        setCashMovementReason={setCashMovementReason}
        onSave={handleLogCashMovement}
      />

      {/* 6. Close Shift & Blind Till Balancing Modal */}
      <CloseShiftModal
        isOpen={isClosingShiftModalOpen}
        onClose={() => setIsClosingShiftModalOpen(false)}
        currentShift={currentShift}
        countedCashInput={countedCashInput}
        setCountedCashInput={setCountedCashInput}
        closingNotesInput={closingNotesInput}
        setClosingNotesInput={setClosingNotesInput}
        onConfirmClose={handleCloseShift}
      />

      {/* 7. Shift Z-Report Modal */}
      <ShiftZReportModal
        isOpen={isShiftZReportModalOpen}
        onClose={() => setIsShiftZReportModalOpen(false)}
        shiftReport={closedShiftReport}
        branchName={
          closedShiftReport?.branchId === 'gra'
            ? 'GRA Flagship (8a Okogo St)'
            : closedShiftReport?.branchId === 'okabere'
            ? 'Okabere Hub'
            : 'Ugbowo Campus Hub'
        }
      />

      {/* 8. Split Bill Modal */}
      <PosBillSplitModal
        isOpen={isSplitBillModalOpen}
        onClose={() => setIsSplitBillModalOpen(false)}
        activeCheck={activeCheck}
        onSettleSplit={handleSettleSplitBill}
        onSaveSplitConfig={handleSaveSplitConfig}
        showToast={showToast}
      />

      {/* 9. Table Transfer Modal */}
      <PosTableTransferModal
        isOpen={isTableTransferModalOpen}
        onClose={() => setIsTableTransferModalOpen(false)}
        activeCheck={activeCheck}
        tables={tables}
        onTransfer={handleTransferTable}
        showToast={showToast}
      />

      {/* 9b. Staff Account Creation & Editing Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveStaffAccount}
            className="bg-white border border-[#E5DEC9] rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 text-xs text-[#241311] overflow-hidden font-montserrat"
          >
            <div className="flex items-center justify-between border-b border-[#E5DEC9] px-6 py-4 shrink-0 bg-[#FAF7F2]">
              <h3 className="font-titan text-base text-[#4D080F]">
                {editingStaffAccount ? 'Edit Staff Account' : 'Create New Staff Account'}
              </h3>
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5 bg-white">
              <div>
                <label className="text-stone-700 font-bold block mb-1">Staff ID *</label>
                <input
                  type="text"
                  required
                  value={staffFormId}
                  onChange={(e) => setStaffFormId(e.target.value)}
                  disabled={!!editingStaffAccount}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] font-mono font-bold focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-stone-700 font-bold block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Osahon Enabulele"
                  value={staffFormName}
                  onChange={(e) => setStaffFormName(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                />
              </div>

              <div>
                <label className="text-stone-700 font-bold block mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. osahon@chopliferepublic.com"
                  value={staffFormEmail}
                  onChange={(e) => setStaffFormEmail(e.target.value)}
                  disabled={!!editingStaffAccount}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-stone-700 font-bold block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="08012345678"
                    value={staffFormPhone}
                    onChange={(e) => setStaffFormPhone(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
                <div>
                  <label className="text-stone-700 font-bold block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={staffFormDob}
                    onChange={(e) => setStaffFormDob(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-stone-700 font-bold block mb-1">Assigned Role *</label>
                  <select
                    value={staffFormRole}
                    onChange={(e) => setStaffFormRole(e.target.value as StaffRole)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs text-[#241311] font-bold focus:outline-hidden focus:border-[#4D080F]"
                  >
                    <option value="cashier">Cashier</option>
                    {currentStaff?.role !== 'branch_manager' && (
                      <>
                        <option value="branch_manager">Branch Manager</option>
                        <option value="corporate_admin">Corporate Admin</option>
                        <option value="super_admin">Super Administrator</option>
                      </>
                    )}
                    <option value="kitchen_lead">Kitchen Lead</option>
                    <option value="storekeeper">Storekeeper</option>
                    <option value="customer_care">Customer Care</option>
                    <option value="rider">Dispatch Rider</option>
                    {currentStaff?.role !== 'branch_manager' && (
                      <>
                        <option value="auditor">Auditor</option>
                        <option value="accountant">Accountant / Finance</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-stone-700 font-bold block mb-1">Primary Home Branch *</label>
                  <select
                    value={staffFormBranch}
                    onChange={(e) => setStaffFormBranch(e.target.value as BranchId)}
                    disabled={currentStaff?.role === 'branch_manager'}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs text-[#241311] font-bold focus:outline-hidden focus:border-[#4D080F] disabled:opacity-60"
                  >
                    {branches
                      .filter((b) => currentStaff?.role !== 'branch_manager' || b.id === currentStaff?.branchId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.shortName || b.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Multi-Branch Operational Privileges */}
              <div className="bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#E5DEC9]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-titan text-[#4D080F]">
                    Permitted Operational Branches
                  </label>
                  <span className="text-[10px] text-stone-500">
                    {currentStaff?.role === 'branch_manager' ? 'Branch Manager Scoped' : 'Multi-branch access'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 mb-2.5">
                  {currentStaff?.role === 'branch_manager'
                    ? 'Branch managers can only manage staff assigned to their home branch.'
                    : 'Select all restaurant locations this staff member can access and manage:'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {branches.map((b) => {
                    const isBranchMgr = currentStaff?.role === 'branch_manager';
                    const isSelfBranch = b.id === currentStaff?.branchId;
                    const isChecked = staffFormAllowedBranches.includes(b.id) || staffFormBranch === b.id;
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F] shadow-2xs font-bold'
                            : 'bg-white border-[#E5DEC9] text-stone-700 hover:bg-stone-50'
                        } ${isBranchMgr && !isSelfBranch ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={staffFormBranch === b.id || (isBranchMgr && !isSelfBranch)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStaffFormAllowedBranches((prev) => Array.from(new Set([...prev, b.id])));
                            } else {
                              if (staffFormAllowedBranches.length > 1) {
                                setStaffFormAllowedBranches((prev) => prev.filter((id) => id !== b.id));
                              }
                            }
                          }}
                          className="accent-[#FFC700] rounded"
                        />
                        <span className="truncate">{b.shortName || b.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Guarantor & Compliance Details (CR-13) */}
              <div className="bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#E5DEC9] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-titan text-[#4D080F]">Guarantor & Compliance Verification</label>
                  <span className="text-[10px] text-stone-500">Operational Due Diligence</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Guarantor Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Chief Osasere Igbinedion"
                      value={staffFormGuarantorName}
                      onChange={(e) => setStaffFormGuarantorName(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Guarantor Phone</label>
                    <input
                      type="tel"
                      placeholder="e.g. 08033001122"
                      value={staffFormGuarantorPhone}
                      onChange={(e) => setStaffFormGuarantorPhone(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Relationship</label>
                    <input
                      type="text"
                      placeholder="e.g. Uncle / Civil Servant"
                      value={staffFormGuarantorRel}
                      onChange={(e) => setStaffFormGuarantorRel(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Guarantor Workplace</label>
                    <input
                      type="text"
                      placeholder="e.g. Edo State Ministry of Health"
                      value={staffFormGuarantorWorkplace}
                      onChange={(e) => setStaffFormGuarantorWorkplace(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Guarantor Residential Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 14 Boundary Road, GRA, Benin City"
                    value={staffFormGuarantorAddress}
                    onChange={(e) => setStaffFormGuarantorAddress(e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                  />
                </div>
              </div>

              {/* Payroll & Compensation Details */}
              <div className="bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#E5DEC9] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-titan text-[#4D080F]">Payroll & Compensation</label>
                  <span className="text-[10px] text-stone-500">Monthly Remuneration</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Basic Salary (₦)</label>
                    <input
                      type="number"
                      min="0"
                      value={staffFormBasicSalary}
                      onChange={(e) => setStaffFormBasicSalary(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Housing Allowance (₦)</label>
                    <input
                      type="number"
                      min="0"
                      value={staffFormHousing}
                      onChange={(e) => setStaffFormHousing(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Transport Allowance (₦)</label>
                    <input
                      type="number"
                      min="0"
                      value={staffFormTransport}
                      onChange={(e) => setStaffFormTransport(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Other Allowances (₦)</label>
                    <input
                      type="number"
                      min="0"
                      value={staffFormOtherAllowances}
                      onChange={(e) => setStaffFormOtherAllowances(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Guaranty Trust Bank"
                      value={staffFormBankName}
                      onChange={(e) => setStaffFormBankName(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <label className="text-[10px] text-stone-600 font-bold">Account Number</label>
                      <button
                        type="button"
                        onClick={() => setShowMaskedAccount(!showMaskedAccount)}
                        className="text-[9px] text-[#4D080F] font-bold underline"
                      >
                        {showMaskedAccount ? 'Reveal' : 'Mask'}
                      </button>
                    </div>
                    <input
                      type={showMaskedAccount ? 'password' : 'text'}
                      placeholder="e.g. 0123456789"
                      value={staffFormAccountNumber}
                      onChange={(e) => setStaffFormAccountNumber(e.target.value)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-stone-600 font-bold block mb-0.5">Account Holder Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Oluwaseun Osineye"
                    value={staffFormAccountName}
                    onChange={(e) => setStaffFormAccountName(e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F]"
                  />
                  <p className="text-[10px] text-stone-500 mt-1 italic">
                    Note: An employee must have their basic salary and bank details configured to be included in automated payroll runs.
                  </p>
                </div>
              </div>

              {!editingStaffAccount && (
                <div>
                  <PasswordInput
                    label="Initial Password *"
                    required
                    value={staffFormPassword}
                    onChange={(e) => setStaffFormPassword(e.target.value)}
                    className="bg-[#FAF7F2] border-[#E5DEC9] text-[#241311]"
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
              )}

              {editingStaffAccount && (
                <div>
                  <label className="text-stone-700 font-bold block mb-1">Account Status</label>
                  <select
                    value={staffFormStatus}
                    onChange={(e) => setStaffFormStatus(e.target.value as any)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs text-[#241311] font-bold focus:outline-hidden focus:border-[#4D080F]"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="deactivated">Deactivated</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 px-6 py-4 border-t border-[#E5DEC9] bg-[#FAF7F2] shrink-0">
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] font-titan uppercase tracking-wider rounded-xl shadow-xs transition-colors"
              >
                {editingStaffAccount ? 'Update Staff' : 'Save Staff Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 10. Fleet & Network Hardware Thermal Printer Manager (TCP 9100 / ESC POS) */}
      <HardwarePrinterModal
        isOpen={isHardwarePrinterOpen}
        onClose={() => setIsHardwarePrinterOpen(false)}
      />

      {/* 11. Optical Camera & Hardware USB/Bluetooth Barcode Dispatch Scanner */}
      <BarcodeDispatchScanner
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        activeBranchId={activeBranchId}
        onScanSuccess={(result) => {
          showToast(result.message || 'Barcode scan action completed successfully!');
          fetchDispatch();
          fetchTablesAndChecks();
        }}
      />

      {/* 12. Effective Access Viewer Modal (ChopLife RBAC Inspector) */}
      <EffectiveAccessModal
        staffId={effectiveAccessStaffId}
        isOpen={isEffectiveAccessOpen}
        onClose={() => {
          setIsEffectiveAccessOpen(false);
          setEffectiveAccessStaffId(null);
        }}
        showToast={(msg) => showToast(msg, 'success')}
      />
      {isBirthdayModalOpen && currentStaff && (
        <BirthdayGreetingModal
          staffName={currentStaff.name}
          onClose={() => setIsBirthdayModalOpen(false)}
        />
      )}

      {/* 13. Change Password & Generate Recovery PIN Modal (Part D Section 16) */}
      {resetCredentialsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#E5DEC9] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 text-xs text-[#241311]">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#4D080F] text-[#FFC700] flex items-center justify-center font-bold text-lg shadow-xs">
                  🔑
                </div>
                <div>
                  <h3 className="font-titan text-base text-[#4D080F]">Change Password &amp; Recovery PIN</h3>
                  <p className="text-[11px] text-[#6E5953]">
                    Account: <strong className="text-[#4D080F] font-bold">{resetCredentialsModal.name}</strong> ({resetCredentialsModal.staffId})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResetCredentialsModal(null)}
                className="text-[#6E5953] hover:text-[#241311] p-1 rounded-lg hover:bg-stone-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct Password Set with Live Policy Checklist */}
            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-3 shadow-2xs">
              <PasswordInput
                label="Set New Password"
                value={adminNewPasswordInput}
                onChange={(e) => setAdminNewPasswordInput(e.target.value)}
                className="bg-[#FAF7F2] border-[#E5DEC9] text-[#241311] focus:border-[#4D080F]"
                placeholder="Enter new password..."
              />
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className={adminNewPasswordInput.length >= 8 ? 'text-emerald-700 font-bold' : 'text-stone-400'}>
                    {adminNewPasswordInput.length >= 8 ? '✓' : '○'}
                  </span>
                  <span className={adminNewPasswordInput.length >= 8 ? 'text-emerald-800 font-medium' : 'text-[#6E5953]'}>
                    At least 8 characters long
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={/[A-Za-z]/.test(adminNewPasswordInput) ? 'text-emerald-700 font-bold' : 'text-stone-400'}>
                    {/[A-Za-z]/.test(adminNewPasswordInput) ? '✓' : '○'}
                  </span>
                  <span className={/[A-Za-z]/.test(adminNewPasswordInput) ? 'text-emerald-800 font-medium' : 'text-[#6E5953]'}>
                    Contains at least one letter (A–Z)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={
                      /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(adminNewPasswordInput)
                        ? 'text-emerald-700 font-bold'
                        : 'text-stone-400'
                    }
                  >
                    {/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(adminNewPasswordInput) ? '✓' : '○'}
                  </span>
                  <span
                    className={
                      /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(adminNewPasswordInput)
                        ? 'text-emerald-800 font-medium'
                        : 'text-[#6E5953]'
                    }
                  >
                    Contains at least one number or symbol
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={
                    isResetSubmitting ||
                    adminNewPasswordInput.length < 8 ||
                    !/[A-Za-z]/.test(adminNewPasswordInput) ||
                    !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(adminNewPasswordInput)
                  }
                  onClick={handleSaveAdminPasswordReset}
                  className="flex-1 py-2.5 bg-[#4D080F] hover:bg-[#38060B] disabled:opacity-40 text-[#FFC700] font-titan rounded-xl transition-colors shadow-xs"
                >
                  Save New Password
                </button>
                <button
                  type="button"
                  disabled={isResetSubmitting}
                  onClick={handleGenerateStaffRecoveryPin}
                  className="px-3.5 py-2.5 bg-white hover:bg-[#FAF7F2] border border-[#4D080F]/40 text-[#4D080F] font-bold rounded-xl transition-colors"
                >
                  Generate PIN
                </button>
              </div>
            </div>

            {resetCredentialsModal.tempPass && (
              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-300 space-y-1.5 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                  One-Time Temporary Password (Salted Bcrypt Stored On Server):
                </span>
                <p className="text-[10px] text-emerald-800">
                  Copy this generated temporary secret now for the staff member. The server persists only the salted bcrypt hash and will not display this plaintext secret again.
                </p>
                <div className="flex items-center justify-between bg-white border border-emerald-200 px-3 py-2 rounded-xl font-mono text-sm font-bold text-emerald-900">
                  <span>{resetCredentialsModal.tempPass}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(resetCredentialsModal.tempPass || '');
                      showToast('Password copied to clipboard!', 'success');
                    }}
                    className="text-xs font-montserrat font-bold bg-[#4D080F] text-[#FFC700] px-2.5 py-1 rounded-lg hover:bg-[#38060B]"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {resetCredentialsModal.recoveryPin && (
              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-300 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                    Single-Use Recovery PIN (15-Min Expiry):
                  </span>
                  <span className="text-[10px] text-amber-700 font-medium">Invalidates prior PINs</span>
                </div>
                <div className="flex items-center justify-between bg-white border border-amber-200 px-3 py-2 rounded-xl font-mono text-base font-bold text-[#4D080F] tracking-widest">
                  <span>{resetCredentialsModal.recoveryPin}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(resetCredentialsModal.recoveryPin || '');
                      showToast('Recovery PIN copied to clipboard!', 'success');
                    }}
                    className="text-xs font-montserrat font-bold bg-[#FFC700] text-[#4D080F] px-2.5 py-1 rounded-lg hover:bg-amber-400"
                  >
                    Copy PIN
                  </button>
                </div>
                <p className="text-[10px] text-[#6E5953]">
                  Staff member can enter this PIN on the Staff Login &rarr; Forgot Password screen to set their own password.
                </p>
              </div>
            )}

            <button
              onClick={() => setResetCredentialsModal(null)}
              className="w-full py-2.5 bg-white hover:bg-stone-100 text-[#241311] font-bold text-xs rounded-xl transition-colors border border-[#E5DEC9]"
            >
              Close Window
            </button>
          </div>
        </div>
      )}

      {/* 10. Customer-Facing Display (CFD) Mode */}
      <CustomerFacingDisplayModal
        isOpen={isCfdModalOpen}
        onClose={() => setIsCfdModalOpen(false)}
        activeCheck={activeCheck}
        branchName={
          activeBranchId === 'gra'
            ? 'GRA Flagship (Okogo St)'
            : activeBranchId === 'okabere'
            ? 'Okabere Hub'
            : 'Ugbowo Campus Hub'
        }
        formatNaira={formatNaira}
        lastPaidCheck={lastPaidCheck}
      />

      {/* Mobile & Tablet Bottom Navigation Bar (Screens < lg) */}
      <nav className="lg:hidden bg-[#160E0C] border-t border-[#36221E] px-2 py-1 flex items-center justify-around z-30 shrink-0">
        <button
          onClick={() => { setActiveTab('pos'); setIsMobileNavOpen(false); }}
          className={`flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] rounded-xl transition-all ${
            activeTab === 'pos' ? 'text-[#FFC700] bg-[#800D15]/40' : 'text-[#A89689]'
          }`}
        >
          <Store className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Register</span>
        </button>
        <button
          onClick={() => { setActiveTab('tables'); setIsMobileNavOpen(false); }}
          className={`flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] rounded-xl transition-all ${
            activeTab === 'tables' ? 'text-[#FFC700] bg-[#800D15]/40' : 'text-[#A89689]'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Tables</span>
        </button>
        <button
          onClick={() => { setActiveTab('kds'); setIsMobileNavOpen(false); }}
          className={`flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] rounded-xl relative transition-all ${
            activeTab === 'kds' ? 'text-[#FFC700] bg-[#800D15]/40' : 'text-[#A89689]'
          }`}
        >
          <ChefHat className="w-5 h-5" />
          {kdsTickets.length > 0 && (
            <span className="absolute top-1 right-2 px-1 bg-[#EF4444] text-white text-[9px] font-extrabold rounded-full">
              {kdsTickets.length}
            </span>
          )}
          <span className="text-[10px] font-bold mt-0.5">Kitchen</span>
        </button>
        <button
          onClick={() => { setActiveTab('dispatch'); setIsMobileNavOpen(false); }}
          className={`flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] rounded-xl transition-all ${
            activeTab === 'dispatch' ? 'text-[#FFC700] bg-[#800D15]/40' : 'text-[#A89689]'
          }`}
        >
          <Truck className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Delivery</span>
        </button>
        {['super_admin', 'corporate_admin', 'admin', 'accountant'].includes(currentStaff?.role || '') && (
          <button
            onClick={() => { setActiveTab('payroll'); setIsMobileNavOpen(false); }}
            className={`flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] rounded-xl transition-all ${
              activeTab === 'payroll' ? 'text-[#FFC700] bg-[#800D15]/40' : 'text-[#A89689]'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-0.5">Payroll</span>
          </button>
        )}
        <button
          onClick={() => setIsMobileNavOpen(true)}
          className="flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] rounded-xl text-[#A89689] hover:text-[#FAF7F2] active:scale-95 transition-all"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">More</span>
        </button>
      </nav>
    </div>
  );
};
