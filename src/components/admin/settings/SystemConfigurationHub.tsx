import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  CreditCard,
  Percent,
  Building,
  UtensilsCrossed,
  Boxes,
  Award,
  ShieldCheck,
  Bell,
  Printer,
  QrCode,
  Search,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Wifi,
  Plus,
  Trash2,
} from 'lucide-react';
import { QrCodesManagementPanel } from './QrCodesManagementPanel';

type SettingsSection =
  | 'financial'
  | 'tax'
  | 'operations'
  | 'menu'
  | 'inventory'
  | 'loyalty'
  | 'security'
  | 'notifications'
  | 'hardware'
  | 'qrcodes';

interface SystemSettingsData {
  financial: any;
  tax: any;
  operations: any;
  inventory: any;
  loyalty: any;
  security: any;
  hardware: any;
  notifications: any;
}

const DEFAULT_SYSTEM_SETTINGS: SystemSettingsData = {
  financial: {
    paymentMethods: [
      { id: 'cash', name: 'Cash Tender (NGN)', tenderType: 'cash', processingFeePercent: 0, enabled: true },
      { id: 'pos_terminal', name: 'Physical Store POS Terminal (Moniepoint / Baxi / OPay)', tenderType: 'pos_terminal', processingFeePercent: 0.5, enabled: true },
      { id: 'bank_transfer', name: 'Verified Bank Transfer', tenderType: 'bank_transfer', processingFeePercent: 0, enabled: true },
      { id: 'card', name: 'Paystack Online Card Gateway', tenderType: 'card', processingFeePercent: 1.5, enabled: true },
      { id: 'house_account', name: 'Corporate House Account (B2B AR)', tenderType: 'house_account', processingFeePercent: 0, enabled: true },
    ],
    posTerminals: [
      { id: 'TERM-01', label: 'Moniepoint POS 1 - GRA Counter', serialNumber: 'MP-8923011', branchId: 'gra' },
      { id: 'TERM-02', label: 'Baxi POS 2 - Okabere Counter', serialNumber: 'BX-4412980', branchId: 'okabere' },
      { id: 'TERM-03', label: 'OPay POS 3 - Ugbowo Express Counter', serialNumber: 'OP-7731209', branchId: 'ugbowo' },
    ],
    paystackConfig: {
      mode: 'live_ready',
      webhookEnforced: true,
    },
  },
  tax: {
    defaultVatRatePercent: 7.5,
    taxInclusivePricing: true,
    extraCharges: {
      packagingFeeDefault: 300,
    },
    controlledReasons: [
      { id: 'RSN-01', code: 'VOID_KITCHEN_ERR', category: 'void', label: 'Kitchen Preparation Error', requiresSupervisorPin: true },
      { id: 'RSN-02', code: 'VOID_GUEST_CHANGE', category: 'void', label: 'Guest Changed Order Before Fire', requiresSupervisorPin: true },
      { id: 'RSN-03', code: 'DISC_VIP_LOYALTY', category: 'discount', label: 'Executive / VIP Goodwill Discount', requiresSupervisorPin: true },
      { id: 'RSN-04', code: 'COMP_STAFF_MEAL', category: 'comp', label: 'Authorized Shift Staff Meal', requiresSupervisorPin: true },
    ],
  },
  operations: {
    branchSchedules: {
      gra: {
        isOperational: true,
        openTime: '08:00',
        closeTime: '19:00',
        staffOpenTime: '07:00',
        staffCloseTime: '19:00',
        dineInEnabled: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        bakeryHours: '07:30–19:00',
        operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        closedDays: [],
        timeZone: 'Africa/Lagos',
      },
      okabere: {
        isOperational: true,
        openTime: '08:00',
        closeTime: '21:00',
        staffOpenTime: '06:30',
        staffCloseTime: '21:00',
        dineInEnabled: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        bakeryHours: '08:00–20:30',
        operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        closedDays: [],
        timeZone: 'Africa/Lagos',
      },
      ugbowo: {
        isOperational: true,
        openTime: '08:00',
        closeTime: '18:00',
        staffOpenTime: '07:00',
        staffCloseTime: '18:00',
        dineInEnabled: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        bakeryHours: '08:00–18:00',
        operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        closedDays: ['sunday'],
        timeZone: 'Africa/Lagos',
      },
    },
    kitchenStations: [
      { id: 'KDS-QSR', name: 'Main Hot Kitchen & Rice Station', stationType: 'hot_kitchen' },
      { id: 'KDS-GRILL', name: 'Flame Grill, Shawarma & Suya Pit', stationType: 'grill_shawarma' },
      { id: 'KDS-CHOPS', name: 'Small Chops & Fry Station', stationType: 'pastry_fry' },
      { id: 'KDS-BAKERY', name: 'Fresh Bakery, Cakes & Drinks Bar', stationType: 'bakery_bar' },
    ],
  },
  inventory: {
    costingMethod: 'Weighted Average Perpetual Costing',
    poSupervisoryLimitNaira: 100000,
    autoDeductRecipesOnPosCheckout: true,
    negativeStockWarning: 'allow_with_audit_flag',
    cycleCountFrequency: 'Weekly (Every Sunday 22:00)',
  },
  loyalty: {
    accrualRateNairaPerPoint: 500,
    redemptionValueNairaPerPoint: 10,
    minimumRedemptionPoints: 50,
    tiers: [
      { name: 'Bronze Citizen', minSpend: 0, multiplier: '1.0x' },
      { name: 'Silver Republic', minSpend: 50000, multiplier: '1.25x' },
      { name: 'Gold President', minSpend: 150000, multiplier: '1.5x' },
      { name: 'Platinum Senator', minSpend: 500000, multiplier: '2.0x' },
    ],
  },
  security: {
    pinLength: 4,
    sessionTimeoutMinutes: 480,
    maxFailedPinAttempts: 5,
    requireSupervisorPinForVoids: true,
    requireSupervisorPinForPriceOverride: true,
    auditTrailRetentionDays: 365,
  },
  hardware: {
    receiptPaperWidth: '80mm Thermal Roll',
    autoPrintCustomerReceiptOnSettlement: false,
    autoOpenCashDrawerOnCashSale: false,
    customerDisplayMode: 'Dual-Screen BroadcastChannel + Polling',
  },
  notifications: {
    smsProvider: 'Termii NG (Sender: CHOPLIFE)',
    emailProvider: 'Resend Transactional',
    whatsappNumber: '+234 815 817 7897',
  },
};

export const SystemConfigurationHub: React.FC = () => {
  const { products } = useApp();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };
  const [activeSection, setActiveSection] = useState<SettingsSection>('financial');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettingsData>(DEFAULT_SYSTEM_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [testResult, setTestResult] = useState<{ provider: string; message: string; success: boolean } | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [imageAudit, setImageAudit] = useState<any>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [qrDirectory, setQrDirectory] = useState<any[]>([
    { branchId: 'gra', branchName: 'GRA Flagship Outlet', digitalMenuUrl: `${window.location.origin}/?branch=gra&channel=qr_table` },
    { branchId: 'okabere', branchName: 'Okabere Outlet', digitalMenuUrl: `${window.location.origin}/?branch=okabere&channel=qr_table` },
    { branchId: 'ugbowo', branchName: 'Ugbowo Express Outlet', digitalMenuUrl: `${window.location.origin}/?branch=ugbowo&channel=qr_table` },
  ]);

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('choplife_staff_token') || sessionStorage.getItem('choplife_staff_token') || '';
    return { Authorization: `Bearer ${token}`, ...extra };
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data?.settings) {
          setSettings({
            financial: { ...DEFAULT_SYSTEM_SETTINGS.financial, ...(data.settings.financial || {}) },
            tax: { ...DEFAULT_SYSTEM_SETTINGS.tax, ...(data.settings.tax || {}) },
            operations: { ...DEFAULT_SYSTEM_SETTINGS.operations, ...(data.settings.operations || {}) },
            inventory: { ...DEFAULT_SYSTEM_SETTINGS.inventory, ...(data.settings.inventory || {}) },
            loyalty: { ...DEFAULT_SYSTEM_SETTINGS.loyalty, ...(data.settings.loyalty || {}) },
            security: { ...DEFAULT_SYSTEM_SETTINGS.security, ...(data.settings.security || {}) },
            hardware: { ...DEFAULT_SYSTEM_SETTINGS.hardware, ...(data.settings.hardware || {}) },
            notifications: { ...DEFAULT_SYSTEM_SETTINGS.notifications, ...(data.settings.notifications || {}) },
          });
        }
      }
    } catch {
      // Fallback to DEFAULT_SYSTEM_SETTINGS
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSection = async (section: SettingsSection) => {
    if (!settings || !settings[section as keyof SystemSettingsData]) return;

    if (section === 'operations' && settings.operations?.branchSchedules) {
      for (const [bId, sched] of Object.entries(settings.operations.branchSchedules as Record<string, any>)) {
        if (sched.openTime && sched.closeTime && sched.openTime >= sched.closeTime) {
          showToast(`Invalid hours for ${bId.toUpperCase()}: Open time (${sched.openTime}) must precede Close time (${sched.closeTime}).`, 'error');
          return;
        }
        if (sched.staffOpenTime && sched.staffCloseTime && sched.staffOpenTime >= sched.staffCloseTime) {
          showToast(`Invalid staff shift for ${bId.toUpperCase()}: Staff In (${sched.staffOpenTime}) must precede Staff Out (${sched.staffCloseTime}).`, 'error');
          return;
        }
        if (sched.staffOpenTime && sched.openTime && sched.staffOpenTime > sched.openTime) {
          showToast(`Invalid staff schedule for ${bId.toUpperCase()}: Staff In (${sched.staffOpenTime}) must begin before or at public opening (${sched.openTime}).`, 'error');
          return;
        }
      }
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/settings/${section}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(settings[section as keyof SystemSettingsData]),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.settings && data.settings[section]) {
          setSettings((prev) => ({
            ...prev,
            [section]: { ...prev[section as keyof SystemSettingsData], ...data.settings[section] },
          }));
        }
        setHasChanges(false);
        showToast(data.message || `Saved ${section} configuration to persistent database.`, 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Failed to save ${section} settings (HTTP ${res.status}).`, 'error');
      }
    } catch {
      showToast(`Network error while saving ${section} configuration.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSectionField = (section: keyof SystemSettingsData, field: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleTestConnection = async (provider: string) => {
    try {
      setTestingProvider(provider);
      setTestResult(null);
      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          provider,
          message: data.message || `Verified ${provider.toUpperCase()} endpoint configuration.`,
          success: Boolean(data.success !== false),
        });
        showToast(`Verified ${provider.toUpperCase()} connection status.`, 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        setTestResult({
          provider,
          message: err.error || `${provider.toUpperCase()} test failed (HTTP ${res.status}).`,
          success: false,
        });
      }
    } catch {
      setTestResult({ provider, message: 'Network error during test handshake', success: false });
    } finally {
      setTestingProvider(null);
    }
  };

  const runImageAudit = async () => {
    try {
      setLoadingAudit(true);
      const res = await fetch('/api/settings/catalogue/image-audit', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setImageAudit(data);
        return;
      }
    } catch {
      // Compute from live products context
    } finally {
      setLoadingAudit(false);
    }

    const totalProducts = products.length;
    const withImages = products.filter((p) => p.image && p.image.trim().length > 0).length;
    const missingImages = totalProducts - withImages;
    const categoryBreakdown: Record<string, { total: number; withImage: number }> = {};
    products.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { total: 0, withImage: 0 };
      categoryBreakdown[cat].total += 1;
      if (p.image && p.image.trim().length > 0) categoryBreakdown[cat].withImage += 1;
    });
    setImageAudit({ totalProducts, withImages, missingImages, categoryBreakdown });
  };

  const fetchQrDirectory = async () => {
    try {
      const res = await fetch('/api/settings/qr-codes', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.qrCodes) && data.qrCodes.length > 0) {
          setQrDirectory(data.qrCodes);
        }
      }
    } catch {
      // Keep default QR directory
    }
  };

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'financial', label: 'Financial & Payments', icon: <CreditCard className="w-4 h-4" />, desc: 'Tenders, POS terminals, Paystack & accounts' },
    { id: 'tax', label: 'Tax & Commercial Rules', icon: <Percent className="w-4 h-4" />, desc: 'VAT rates, discounts, reason codes & meal accounts' },
    { id: 'operations', label: 'Outlet Operations', icon: <Building className="w-4 h-4" />, desc: 'Branch hours, channels, dining areas & kitchen stations' },
    { id: 'menu', label: 'Menu & Catalogue Audit', icon: <UtensilsCrossed className="w-4 h-4" />, desc: 'Modifier rules & catalogue image completeness' },
    { id: 'inventory', label: 'Inventory & Procurement', icon: <Boxes className="w-4 h-4" />, desc: 'PO limits, count schedules & conversion units' },
    { id: 'loyalty', label: 'Customer & Loyalty', icon: <Award className="w-4 h-4" />, desc: 'Points accrual, tiers, house AR & retention' },
    { id: 'security', label: 'Security & Access', icon: <ShieldCheck className="w-4 h-4" />, desc: 'Password policies, session timeouts & lockouts' },
    { id: 'notifications', label: 'Notifications & Alerts', icon: <Bell className="w-4 h-4" />, desc: 'Termii SMS, Email, WhatsApp & message templates' },
    { id: 'hardware', label: 'Hardware & Displays', icon: <Printer className="w-4 h-4" />, desc: 'Printer paper widths, auto-cut & customer display' },
    { id: 'qrcodes', label: 'QR Codes & Logs', icon: <QrCode className="w-4 h-4" />, desc: 'Table ordering QR codes & operational logs' },
  ];

  const filteredSections = sections.filter(
    (s) =>
      s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !settings) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center text-xs text-stone-500">
        <RotateCcw className="w-5 h-5 animate-spin mr-2 text-[#800D15]" />
        Loading system configuration hierarchy...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FAF7F2] text-stone-900 rounded-3xl border border-[#E5DEC9] overflow-hidden shadow-2xs">
      {toast && (
        <div
          id="system-settings-toast"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-lg text-xs font-bold flex items-center gap-2 border ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="border-b border-[#E5DEC9] px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#FFC700] px-2.5 py-0.5 rounded-full bg-[#4D080F]">
              Back-Office Governance
            </span>
            <span className="text-xs text-stone-500 font-semibold">Choplife Republic Enterprise Core</span>
          </div>
          <h1 className="text-lg font-black text-[#4D080F] mt-1 flex items-center gap-2">
            System Settings &amp; Operations Configuration
          </h1>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {hasChanges && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Unsaved Changes</span>
            </div>
          )}
          {activeSection !== 'menu' && activeSection !== 'qrcodes' && (
            <button
              id="save-system-settings-btn"
              onClick={() => handleSaveSection(activeSection)}
              disabled={saving}
              className="px-4 py-2 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-50"
            >
              {saving ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Configuration</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Horizontal Scrollable Tab Bar on Mobile/Tablet (< xl), Left Sidebar on Desktop (xl+) */}
      <div className="flex-1 flex flex-col xl:flex-row min-h-0 overflow-hidden">
        {/* Navigation Sidebar / Strip */}
        <div className="w-full xl:w-72 bg-white border-b xl:border-b-0 xl:border-r border-[#E5DEC9] flex flex-col shrink-0">
          <div className="p-2.5 sm:p-3 border-b border-[#E5DEC9]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search settings modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl pl-8 pr-3 py-1.5 sm:py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#4D080F]"
              />
            </div>
          </div>

          <div className="flex xl:flex-col overflow-x-auto xl:overflow-y-auto p-2 gap-1.5 xl:space-y-1 no-scrollbar">
            {filteredSections.map((sec) => (
              <button
                key={sec.id}
                id={`settings-tab-${sec.id}`}
                onClick={() => {
                  setActiveSection(sec.id);
                  setTestResult(null);
                  if (sec.id === 'menu' && !imageAudit) runImageAudit();
                  if (sec.id === 'qrcodes') fetchQrDirectory();
                }}
                className={`shrink-0 xl:w-full text-left px-3 py-2 xl:p-2.5 rounded-xl transition-all flex items-center xl:items-start gap-2.5 ${
                  activeSection === sec.id
                    ? 'bg-[#4D080F] text-white font-bold shadow-xs'
                    : 'bg-[#FAF7F2] xl:bg-transparent text-stone-700 hover:bg-[#FAF7F2] hover:text-[#4D080F] border xl:border-0 border-[#E5DEC9]'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    activeSection === sec.id ? 'bg-[#FFC700] text-[#4D080F]' : 'bg-white xl:bg-[#FAF7F2] text-[#4D080F] border border-[#E5DEC9]'
                  }`}
                >
                  {sec.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs whitespace-nowrap xl:whitespace-normal xl:truncate">{sec.label}</div>
                  <div className={`hidden xl:block text-[10px] line-clamp-1 mt-0.5 ${activeSection === sec.id ? 'text-stone-200' : 'text-stone-500'}`}>
                    {sec.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Section View Pane */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#FAF7F2]">
          {/* Module A: Financial & Payments */}
          {activeSection === 'financial' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-base font-black text-[#4D080F]">Module A: Financial, Payments &amp; Settlement Settings</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Configure authorized tender types, POS card terminals, processing fee rates, and Paystack gateway modes.
                </p>
              </div>

              {/* Tender Types */}
              <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold text-[#4D080F] uppercase tracking-wider">Active Payment Tenders &amp; Processing Fees</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {settings.financial?.paymentMethods?.map((pm: any, idx: number) => (
                    <div key={pm.id} className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-2">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <input
                          type="text"
                          value={pm.name}
                          onChange={(e) => {
                            const updated = [...(settings.financial?.paymentMethods || [])];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            updateSectionField('financial', 'paymentMethods', updated);
                          }}
                          className="flex-1 min-w-0 bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1 text-xs font-bold text-stone-900"
                        />
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={Boolean(pm.enabled)}
                            onChange={(e) => {
                              const updated = [...(settings.financial?.paymentMethods || [])];
                              updated[idx] = { ...updated[idx], enabled: e.target.checked };
                              updateSectionField('financial', 'paymentMethods', updated);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-600">
                        <span className="font-mono">Tender ID: {pm.tenderType}</span>
                        <div className="flex items-center gap-1.5">
                          <span>Fee (%):</span>
                          <input
                            type="number"
                            step="0.1"
                            value={pm.processingFeePercent ?? 0}
                            onChange={(e) => {
                              const updated = [...(settings.financial?.paymentMethods || [])];
                              updated[idx] = { ...updated[idx], processingFeePercent: parseFloat(e.target.value) || 0 };
                              updateSectionField('financial', 'paymentMethods', updated);
                            }}
                            className="w-16 bg-white border border-[#E5DEC9] rounded px-2 py-0.5 text-xs font-mono font-bold text-[#4D080F]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Physical POS Terminals */}
              <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#4D080F] uppercase tracking-wider">Assigned POS Card Terminals</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = (settings.financial?.posTerminals?.length || 0) + 1;
                      const updated = [
                        ...(settings.financial?.posTerminals || []),
                        {
                          id: `TERM-0${nextIdx}`,
                          label: `POS Terminal ${nextIdx}`,
                          serialNumber: `SN-${Date.now().toString().slice(-6)}`,
                          branchId: 'gra',
                        },
                      ];
                      updateSectionField('financial', 'posTerminals', updated);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FFF8E7] border border-[#FFC700] text-[#800D15] text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Terminal
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {settings.financial?.posTerminals?.map((term: any, idx: number) => (
                    <div key={term.id || idx} className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={term.label}
                          onChange={(e) => {
                            const updated = [...(settings.financial?.posTerminals || [])];
                            updated[idx] = { ...updated[idx], label: e.target.value };
                            updateSectionField('financial', 'posTerminals', updated);
                          }}
                          className="flex-1 bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1 text-xs font-bold text-stone-900"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (settings.financial?.posTerminals || []).filter((_: any, i: number) => i !== idx);
                            updateSectionField('financial', 'posTerminals', updated);
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Remove Terminal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-stone-500 block">Serial Number</label>
                          <input
                            type="text"
                            value={term.serialNumber}
                            onChange={(e) => {
                              const updated = [...(settings.financial?.posTerminals || [])];
                              updated[idx] = { ...updated[idx], serialNumber: e.target.value };
                              updateSectionField('financial', 'posTerminals', updated);
                            }}
                            className="w-full bg-white border border-[#E5DEC9] rounded px-2 py-1 text-xs font-mono text-stone-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-stone-500 block">Assigned Branch</label>
                          <select
                            value={term.branchId || 'gra'}
                            onChange={(e) => {
                              const updated = [...(settings.financial?.posTerminals || [])];
                              updated[idx] = { ...updated[idx], branchId: e.target.value };
                              updateSectionField('financial', 'posTerminals', updated);
                            }}
                            className="w-full bg-white border border-[#E5DEC9] rounded px-2 py-1 text-xs font-bold text-stone-800"
                          >
                            <option value="gra">GRA Flagship</option>
                            <option value="okabere">Okabere</option>
                            <option value="ugbowo">Ugbowo</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paystack Connection & Gateway Mode */}
              <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#4D080F] uppercase tracking-wider">Paystack Gateway Status &amp; Diagnostics</h3>
                  <button
                    onClick={() => handleTestConnection('paystack')}
                    disabled={testingProvider === 'paystack'}
                    className="px-3 py-1.5 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <Wifi className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>{testingProvider === 'paystack' ? 'Testing Handshake...' : 'Test Connection'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9]">
                    <label className="text-[10px] text-stone-500 font-bold block mb-1">Operating Mode</label>
                    <select
                      value={settings.financial?.paystackConfig?.mode || 'live_ready'}
                      onChange={(e) =>
                        updateSectionField('financial', 'paystackConfig', {
                          ...(settings.financial?.paystackConfig || {}),
                          mode: e.target.value,
                        })
                      }
                      className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#4D080F]"
                    >
                      <option value="live_ready">LIVE READY</option>
                      <option value="sandbox">SANDBOX / TEST</option>
                    </select>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex flex-col justify-between">
                    <span className="text-[10px] text-stone-500 font-bold">HMAC-SHA512 Webhook Guard</span>
                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(settings.financial?.paystackConfig?.webhookEnforced ?? true)}
                        onChange={(e) =>
                          updateSectionField('financial', 'paystackConfig', {
                            ...(settings.financial?.paystackConfig || {}),
                            webhookEnforced: e.target.checked,
                          })
                        }
                      />
                      <span className="text-xs font-bold text-emerald-700">Enforce Signature Check</span>
                    </label>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9]">
                    <div className="text-[10px] text-stone-500 font-bold">Secret Key Masking</div>
                    <div className="font-bold text-stone-900 mt-2">PROTECTED (Server-Side Only)</div>
                  </div>
                </div>
                {testResult?.provider === 'paystack' && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Module B: Tax & Commercial Charges */}
          {activeSection === 'tax' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-base font-black text-[#4D080F]">Module B: Tax, Surcharges &amp; Controlled Reasons</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Authoritative Nigerian VAT configuration, extra packaging surcharges, discount limits, and reason codes.
                </p>
              </div>

              <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold text-[#4D080F] uppercase tracking-wider">Statutory Tax &amp; Pricing Scheme</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9]">
                    <label className="text-[10px] text-stone-500 font-bold block mb-1">Standard VAT Rate (%)</label>
                    <input
                      id="tax-vat-rate-input"
                      type="number"
                      step="0.1"
                      value={settings.tax?.defaultVatRatePercent ?? 7.5}
                      onChange={(e) => updateSectionField('tax', 'defaultVatRatePercent', parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-mono font-bold text-[#4D080F]"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9]">
                    <label className="text-[10px] text-stone-500 font-bold block mb-1">Pricing Display Mode</label>
                    <select
                      value={settings.tax?.taxInclusivePricing ? 'inclusive' : 'exclusive'}
                      onChange={(e) => updateSectionField('tax', 'taxInclusivePricing', e.target.value === 'inclusive')}
                      className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-bold text-stone-900"
                    >
                      <option value="inclusive">Tax Inclusive (Retail QSR)</option>
                      <option value="exclusive">Tax Exclusive (Add at Checkout)</option>
                    </select>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9]">
                    <label className="text-[10px] text-stone-500 font-bold block mb-1">Default Packaging Fee (₦)</label>
                    <input
                      id="tax-packaging-fee-input"
                      type="number"
                      value={settings.tax?.extraCharges?.packagingFeeDefault ?? 300}
                      onChange={(e) =>
                        updateSectionField('tax', 'extraCharges', {
                          ...(settings.tax?.extraCharges || {}),
                          packagingFeeDefault: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-mono font-bold text-[#4D080F]"
                    />
                  </div>
                </div>
              </div>

              {/* Controlled Reason Codes */}
              <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold text-[#4D080F] uppercase tracking-wider">Controlled Reason Codes (Audited Operations)</h3>
                <div className="space-y-2">
                  {settings.tax?.controlledReasons?.map((r: any, idx: number) => (
                    <div
                      key={r.id || idx}
                      className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex flex-wrap items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-[#4D080F] text-[#FFC700] uppercase shrink-0">
                          {r.category}
                        </span>
                        <input
                          type="text"
                          value={r.label}
                          onChange={(e) => {
                            const updated = [...(settings.tax?.controlledReasons || [])];
                            updated[idx] = { ...updated[idx], label: e.target.value };
                            updateSectionField('tax', 'controlledReasons', updated);
                          }}
                          className="flex-1 min-w-0 bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1 text-xs font-bold text-stone-900"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(r.requiresSupervisorPin)}
                            onChange={(e) => {
                              const updated = [...(settings.tax?.controlledReasons || [])];
                              updated[idx] = { ...updated[idx], requiresSupervisorPin: e.target.checked };
                              updateSectionField('tax', 'controlledReasons', updated);
                            }}
                          />
                          <span>Require Supervisor PIN</span>
                        </label>
                        <span className="text-[10px] font-mono text-stone-500">{r.code}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Module C: Outlet & Operations */}
          {activeSection === 'operations' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-base font-black text-[#4D080F]">Module C: Outlet, Branch &amp; Kitchen Routing</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Manage branch operating hours, service channels, and kitchen preparation stations across Benin City outlets.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {Object.entries(settings.operations?.branchSchedules || {}).map(([branchId, sched]: [string, any]) => {
                  const branchNames: Record<string, string> = {
                    gra: 'GRA Flagship',
                    okabere: 'Okabere Hub',
                    ugbowo: 'Ugbowo Campus Hub',
                  };
                  const isSundayClosed = Array.isArray(sched.closedDays) && sched.closedDays.includes('sunday');
                  const hasHourError = sched.openTime && sched.closeTime && sched.openTime >= sched.closeTime;
                  const hasStaffError = sched.staffOpenTime && sched.staffCloseTime && sched.staffOpenTime >= sched.staffCloseTime;

                  return (
                    <div key={branchId} className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                      {/* Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-[#E5DEC9]">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-[#4D080F] uppercase tracking-wide">
                              {branchNames[branchId] || `${branchId.toUpperCase()} Branch`}
                            </span>
                            <span className="text-[9px] font-mono font-bold bg-[#FAF7F2] text-[#4D080F] px-1.5 py-0.5 rounded border border-[#E5DEC9]">
                              WAT UTC+1
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-500 font-medium">
                            {isSundayClosed ? 'Mon–Sat (Closed Sundays)' : 'Daily (Mon–Sun)'}
                          </span>
                        </div>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(sched.isOperational)}
                            onChange={(e) => {
                              const updated = {
                                ...(settings.operations?.branchSchedules || {}),
                                [branchId]: { ...sched, isOperational: e.target.checked },
                              };
                              updateSectionField('operations', 'branchSchedules', updated);
                            }}
                          />
                          <span className={sched.isOperational ? 'text-emerald-700' : 'text-red-700'}>
                            {sched.isOperational ? 'OPEN' : 'PAUSED'}
                          </span>
                        </label>
                      </div>

                      {/* Public Customer Ordering Hours */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#4D080F]">Public Customer Hours</span>
                          <span className="text-[9px] text-stone-500 font-mono">Storefront Ordering</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-stone-500 block">Open Time</label>
                            <input
                              type="time"
                              value={sched.openTime || '08:00'}
                              onChange={(e) => {
                                const updated = {
                                  ...(settings.operations?.branchSchedules || {}),
                                  [branchId]: { ...sched, openTime: e.target.value },
                                };
                                updateSectionField('operations', 'branchSchedules', updated);
                              }}
                              className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded px-2 py-1 text-xs font-mono font-bold text-stone-900"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 block">Close Time</label>
                            <input
                              type="time"
                              value={sched.closeTime || '19:00'}
                              onChange={(e) => {
                                const updated = {
                                  ...(settings.operations?.branchSchedules || {}),
                                  [branchId]: { ...sched, closeTime: e.target.value },
                                };
                                updateSectionField('operations', 'branchSchedules', updated);
                              }}
                              className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded px-2 py-1 text-xs font-mono font-bold text-stone-900"
                            />
                          </div>
                        </div>
                        {hasHourError && (
                          <p className="text-[10px] text-red-600 font-bold">Error: Open time must precede close time.</p>
                        )}
                      </div>

                      {/* Staff Operational Shift Hours */}
                      <div className="space-y-1.5 pt-2 border-t border-stone-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#4D080F]">Staff Operating Shift</span>
                          <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded font-medium">Kitchen &amp; Prep</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-stone-500 block">Staff In</label>
                            <input
                              type="time"
                              value={sched.staffOpenTime || '07:00'}
                              onChange={(e) => {
                                const updated = {
                                  ...(settings.operations?.branchSchedules || {}),
                                  [branchId]: { ...sched, staffOpenTime: e.target.value },
                                };
                                updateSectionField('operations', 'branchSchedules', updated);
                              }}
                              className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded px-2 py-1 text-xs font-mono font-bold text-stone-900"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 block">Staff Out</label>
                            <input
                              type="time"
                              value={sched.staffCloseTime || '19:00'}
                              onChange={(e) => {
                                const updated = {
                                  ...(settings.operations?.branchSchedules || {}),
                                  [branchId]: { ...sched, staffCloseTime: e.target.value },
                                };
                                updateSectionField('operations', 'branchSchedules', updated);
                              }}
                              className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded px-2 py-1 text-xs font-mono font-bold text-stone-900"
                            />
                          </div>
                        </div>
                        {hasStaffError && (
                          <p className="text-[10px] text-red-600 font-bold">Error: Staff in must precede staff out.</p>
                        )}
                      </div>

                      {/* Operating Days / Sunday Closed */}
                      <div className="pt-2 border-t border-stone-100 text-xs">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-[10px] text-stone-600 font-bold">Sunday Operation</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={!isSundayClosed}
                              onChange={(e) => {
                                const currentlyOpen = e.target.checked;
                                const closedDays = currentlyOpen ? [] : ['sunday'];
                                const operatingDays = currentlyOpen
                                  ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                                  : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                                const updated = {
                                  ...(settings.operations?.branchSchedules || {}),
                                  [branchId]: { ...sched, closedDays, operatingDays },
                                };
                                updateSectionField('operations', 'branchSchedules', updated);
                              }}
                            />
                            <span className={`text-[10px] font-bold ${!isSundayClosed ? 'text-emerald-700' : 'text-amber-800'}`}>
                              {!isSundayClosed ? 'Open Sundays' : 'Closed Sundays'}
                            </span>
                          </div>
                        </label>
                      </div>

                      {/* Bakery Hours */}
                      <div className="space-y-1 pt-2 border-t border-stone-100 text-xs">
                        <label className="text-[10px] text-stone-500 block">Bakery Schedule (Preserved)</label>
                        <input
                          type="text"
                          value={sched.bakeryHours || ''}
                          placeholder="e.g. 07:30–19:00"
                          onChange={(e) => {
                            const updated = {
                              ...(settings.operations?.branchSchedules || {}),
                              [branchId]: { ...sched, bakeryHours: e.target.value },
                            };
                            updateSectionField('operations', 'branchSchedules', updated);
                          }}
                          className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded px-2 py-1 text-xs font-mono text-stone-900"
                        />
                      </div>

                      {/* Channel Toggles */}
                      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-[#E5DEC9] text-xs">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(sched.dineInEnabled)}
                            onChange={(e) => {
                              const updated = {
                                ...(settings.operations?.branchSchedules || {}),
                                [branchId]: { ...sched, dineInEnabled: e.target.checked },
                              };
                              updateSectionField('operations', 'branchSchedules', updated);
                            }}
                          />
                          <span className="text-[10px] font-semibold text-stone-700">Dine-In</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(sched.deliveryEnabled)}
                            onChange={(e) => {
                              const updated = {
                                ...(settings.operations?.branchSchedules || {}),
                                [branchId]: { ...sched, deliveryEnabled: e.target.checked },
                              };
                              updateSectionField('operations', 'branchSchedules', updated);
                            }}
                          />
                          <span className="text-[10px] font-semibold text-stone-700">Delivery</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(sched.pickupEnabled !== false)}
                            onChange={(e) => {
                              const updated = {
                                ...(settings.operations?.branchSchedules || {}),
                                [branchId]: { ...sched, pickupEnabled: e.target.checked },
                              };
                              updateSectionField('operations', 'branchSchedules', updated);
                            }}
                          />
                          <span className="text-[10px] font-semibold text-stone-700">Pickup</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Kitchen Stations */}
              <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold text-[#4D080F] uppercase tracking-wider">Kitchen Display Stations</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {settings.operations?.kitchenStations?.map((st: any, idx: number) => (
                    <div
                      key={st.id || idx}
                      className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <input
                          type="text"
                          value={st.name}
                          onChange={(e) => {
                            const updated = [...(settings.operations?.kitchenStations || [])];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            updateSectionField('operations', 'kitchenStations', updated);
                          }}
                          className="flex-1 min-w-0 bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1 text-xs font-bold text-stone-900"
                        />
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 shrink-0 font-mono">
                          {st.id}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span>Station Routing Category:</span>
                        <select
                          value={st.stationType}
                          onChange={(e) => {
                            const updated = [...(settings.operations?.kitchenStations || [])];
                            updated[idx] = { ...updated[idx], stationType: e.target.value };
                            updateSectionField('operations', 'kitchenStations', updated);
                          }}
                          className="bg-white border border-[#E5DEC9] rounded px-2 py-0.5 text-xs font-mono text-stone-800"
                        >
                          <option value="hot_kitchen">hot_kitchen</option>
                          <option value="grill_shawarma">grill_shawarma</option>
                          <option value="pastry_fry">pastry_fry</option>
                          <option value="bakery_bar">bakery_bar</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Module D: Menu & Catalogue Audit */}
          {activeSection === 'menu' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-[#4D080F]">Module D: Menu &amp; Catalogue Image Completeness Audit</h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Detect missing product images and verify POS/Storefront display compliance across all catalogue items.
                  </p>
                </div>
                <button
                  onClick={runImageAudit}
                  disabled={loadingAudit}
                  className="px-3 py-1.5 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                  <span>Re-scan Catalogue</span>
                </button>
              </div>

              {imageAudit && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] shadow-2xs">
                    <div className="text-[10px] text-stone-500 uppercase font-bold">Total Catalogue SKUs</div>
                    <div className="text-2xl font-black text-[#4D080F] mt-1">{imageAudit.totalProducts}</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] shadow-2xs">
                    <div className="text-[10px] text-stone-500 uppercase font-bold">Items With Verified Photo</div>
                    <div className="text-2xl font-black text-emerald-700 mt-1">{imageAudit.withImages}</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] shadow-2xs">
                    <div className="text-[10px] text-stone-500 uppercase font-bold">Clean Typographic Fallback</div>
                    <div className="text-2xl font-black text-amber-600 mt-1">{imageAudit.missingImages}</div>
                  </div>
                </div>
              )}

              {imageAudit?.categoryBreakdown && (
                <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                  <h3 className="text-xs font-bold text-[#4D080F] uppercase tracking-wider">Image Coverage by Menu Category</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {Object.entries(imageAudit.categoryBreakdown).map(([cat, stats]: [string, any]) => (
                      <div key={cat} className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-xs">
                        <div className="font-bold text-stone-900 capitalize truncate">{cat}</div>
                        <div className="text-[10px] text-stone-500 mt-1">
                          Coverage: <strong className="text-emerald-700">{stats.withImage}</strong> / {stats.total}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Module E: Inventory & Procurement */}
          {activeSection === 'inventory' && (
            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 space-y-4 max-w-4xl shadow-2xs">
              <div>
                <h2 className="text-base font-black text-[#4D080F]">Module E: Inventory &amp; Procurement Governance Policy</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Configure valuation methodology, purchase order approval thresholds, and stock depletion rules.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Inventory Costing Method
                  </label>
                  <select
                    value={settings.inventory?.costingMethod || 'Weighted Average Perpetual Costing'}
                    onChange={(e) => updateSectionField('inventory', 'costingMethod', e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-bold text-stone-900"
                  >
                    <option value="Weighted Average Perpetual Costing">Weighted Average Perpetual Costing</option>
                    <option value="FIFO (First-In, First-Out)">FIFO (First-In, First-Out)</option>
                    <option value="Standard Recipe Costing">Standard Recipe Costing</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    PO Supervisory Limit (₦)
                  </label>
                  <input
                    id="inventory-po-limit-input"
                    type="number"
                    step="5000"
                    value={settings.inventory?.poSupervisoryLimitNaira ?? 100000}
                    onChange={(e) => updateSectionField('inventory', 'poSupervisoryLimitNaira', parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-mono font-bold text-[#4D080F]"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Negative Stock Handling
                  </label>
                  <select
                    value={settings.inventory?.negativeStockWarning || 'allow_with_audit_flag'}
                    onChange={(e) => updateSectionField('inventory', 'negativeStockWarning', e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-bold text-stone-900"
                  >
                    <option value="allow_with_audit_flag">Allow Checkout with Audit Exception Flag</option>
                    <option value="strict_block">Strictly Block Checkout When Depleted</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Cycle Count Schedule
                  </label>
                  <input
                    type="text"
                    value={settings.inventory?.cycleCountFrequency || ''}
                    onChange={(e) => updateSectionField('inventory', 'cycleCountFrequency', e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-bold text-stone-900"
                  />
                </div>

                <div className="sm:col-span-2 p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-stone-900">Auto-Deduct Recipe BOM on POS Checkout</div>
                    <div className="text-[10px] text-stone-500">Automatically decrement raw ingredients when a POS or online order is settled</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.inventory?.autoDeductRecipesOnPosCheckout ?? true)}
                    onChange={(e) => updateSectionField('inventory', 'autoDeductRecipesOnPosCheckout', e.target.checked)}
                    className="w-4 h-4 accent-[#4D080F]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Module F: Customer & Loyalty */}
          {activeSection === 'loyalty' && (
            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 space-y-4 max-w-4xl shadow-2xs">
              <div>
                <h2 className="text-base font-black text-[#4D080F]">Module F: Customer Loyalty &amp; Rewards Policy</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Configure points accrual rates, Naira redemption values, and VIP membership tiers.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Spend Per 1 Point (₦)
                  </label>
                  <input
                    id="loyalty-accrual-input"
                    type="number"
                    value={settings.loyalty?.accrualRateNairaPerPoint ?? 500}
                    onChange={(e) => updateSectionField('loyalty', 'accrualRateNairaPerPoint', parseInt(e.target.value, 10) || 100)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-mono font-bold text-[#4D080F]"
                  />
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Redemption Value Per Point (₦)
                  </label>
                  <input
                    type="number"
                    value={settings.loyalty?.redemptionValueNairaPerPoint ?? 10}
                    onChange={(e) => updateSectionField('loyalty', 'redemptionValueNairaPerPoint', parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-mono font-bold text-[#4D080F]"
                  />
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Minimum Redemption Points
                  </label>
                  <input
                    type="number"
                    value={settings.loyalty?.minimumRedemptionPoints ?? 50}
                    onChange={(e) => updateSectionField('loyalty', 'minimumRedemptionPoints', parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-mono font-bold text-[#4D080F]"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-[#4D080F] uppercase tracking-wider">Loyalty Membership Tiers</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(settings.loyalty?.tiers || []).map((tier: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] grid grid-cols-3 gap-2 items-center text-xs">
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => {
                          const updated = [...(settings.loyalty?.tiers || [])];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          updateSectionField('loyalty', 'tiers', updated);
                        }}
                        className="bg-white border border-[#E5DEC9] rounded px-2 py-1 font-bold text-stone-900"
                      />
                      <input
                        type="number"
                        value={tier.minSpend}
                        onChange={(e) => {
                          const updated = [...(settings.loyalty?.tiers || [])];
                          updated[idx] = { ...updated[idx], minSpend: parseInt(e.target.value, 10) || 0 };
                          updateSectionField('loyalty', 'tiers', updated);
                        }}
                        className="bg-white border border-[#E5DEC9] rounded px-2 py-1 font-mono text-stone-800"
                        title="Min Spend (NGN)"
                      />
                      <input
                        type="text"
                        value={tier.multiplier}
                        onChange={(e) => {
                          const updated = [...(settings.loyalty?.tiers || [])];
                          updated[idx] = { ...updated[idx], multiplier: e.target.value };
                          updateSectionField('loyalty', 'tiers', updated);
                        }}
                        className="bg-white border border-[#E5DEC9] rounded px-2 py-1 font-mono font-bold text-[#800D15]"
                        title="Multiplier"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Module G: Security & Access */}
          {activeSection === 'security' && (
            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 space-y-4 max-w-4xl shadow-2xs">
              <div>
                <h2 className="text-base font-black text-[#4D080F]">Module G: Security, PIN &amp; Session Governance</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Configure terminal PIN lengths, brute-force lockout thresholds, and supervisor override requirements.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Terminal PIN Length (Digits)
                  </label>
                  <select
                    value={settings.security?.pinLength ?? 4}
                    onChange={(e) => updateSectionField('security', 'pinLength', parseInt(e.target.value, 10) || 4)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-bold text-stone-900"
                  >
                    <option value={4}>4-Digit Quick PIN</option>
                    <option value={6}>6-Digit High-Security PIN</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Session Timeout (Minutes)
                  </label>
                  <input
                    id="security-session-timeout-input"
                    type="number"
                    value={settings.security?.sessionTimeoutMinutes ?? 480}
                    onChange={(e) => updateSectionField('security', 'sessionTimeoutMinutes', parseInt(e.target.value, 10) || 60)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-mono font-bold text-[#4D080F]"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Max Failed Login Attempts Before Lockout
                  </label>
                  <input
                    type="number"
                    value={settings.security?.maxFailedPinAttempts ?? 5}
                    onChange={(e) => updateSectionField('security', 'maxFailedPinAttempts', parseInt(e.target.value, 10) || 3)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-mono font-bold text-[#4D080F]"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Audit Trail Retention (Days)
                  </label>
                  <input
                    type="number"
                    value={settings.security?.auditTrailRetentionDays ?? 365}
                    onChange={(e) => updateSectionField('security', 'auditTrailRetentionDays', parseInt(e.target.value, 10) || 90)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-mono font-bold text-[#4D080F]"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">Require Supervisor PIN for Ticket Voids</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.security?.requireSupervisorPinForVoids ?? true)}
                    onChange={(e) => updateSectionField('security', 'requireSupervisorPinForVoids', e.target.checked)}
                    className="w-4 h-4 accent-[#4D080F]"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">Require Supervisor PIN for Price Overrides</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.security?.requireSupervisorPinForPriceOverride ?? true)}
                    onChange={(e) => updateSectionField('security', 'requireSupervisorPinForPriceOverride', e.target.checked)}
                    className="w-4 h-4 accent-[#4D080F]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Module I: Hardware & Displays */}
          {activeSection === 'hardware' && (
            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 space-y-4 max-w-4xl shadow-2xs">
              <div>
                <h2 className="text-base font-black text-[#4D080F]">Module I: Hardware, Thermal Printers &amp; CDS Displays</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Configure ESC/POS thermal paper widths, cash drawer triggers, and Customer Display Screen (CDS) sync modes.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Default Receipt Paper Width
                  </label>
                  <select
                    value={settings.hardware?.receiptPaperWidth || '80mm Thermal Roll'}
                    onChange={(e) => updateSectionField('hardware', 'receiptPaperWidth', e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-bold text-stone-900"
                  >
                    <option value="80mm Thermal Roll">80mm Thermal Roll (Standard POS)</option>
                    <option value="58mm Thermal Roll">58mm Thermal Roll (Compact Handheld)</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Customer Display Screen (CDS) Sync Mode
                  </label>
                  <select
                    value={settings.hardware?.customerDisplayMode || 'Dual-Screen BroadcastChannel + Polling'}
                    onChange={(e) => updateSectionField('hardware', 'customerDisplayMode', e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-lg p-2 text-xs font-bold text-stone-900"
                  >
                    <option value="Dual-Screen BroadcastChannel + Polling">Dual-Screen BroadcastChannel + Polling</option>
                    <option value="LocalStorage Event Mirroring">LocalStorage Event Mirroring</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">Auto-Print Customer Receipt on Settlement</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.hardware?.autoPrintCustomerReceiptOnSettlement)}
                    onChange={(e) => updateSectionField('hardware', 'autoPrintCustomerReceiptOnSettlement', e.target.checked)}
                    className="w-4 h-4 accent-[#4D080F]"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">Auto-Kick RJ11 Cash Drawer on Cash Sale</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.hardware?.autoOpenCashDrawerOnCashSale)}
                    onChange={(e) => updateSectionField('hardware', 'autoOpenCashDrawerOnCashSale', e.target.checked)}
                    className="w-4 h-4 accent-[#4D080F]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Module H: Notifications & Templates */}
          {activeSection === 'notifications' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-base font-black text-[#4D080F]">Module H: Notification Providers, Handshakes &amp; Templates</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Configure and test Termii SMS, Resend email, and WhatsApp dispatch endpoints.
                </p>
              </div>

              <div className="bg-white border border-[#E5DEC9] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-2xs">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                    SMS Gateway Provider
                  </label>
                  <input
                    type="text"
                    value={settings.notifications?.smsProvider || ''}
                    onChange={(e) => updateSectionField('notifications', 'smsProvider', e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg p-2 text-xs font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                    Email Dispatch Engine
                  </label>
                  <input
                    type="text"
                    value={settings.notifications?.emailProvider || ''}
                    onChange={(e) => updateSectionField('notifications', 'emailProvider', e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg p-2 text-xs font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                    Official WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={settings.notifications?.whatsappNumber || ''}
                    onChange={(e) => updateSectionField('notifications', 'whatsappNumber', e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg p-2 text-xs font-mono font-bold text-[#4D080F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] shadow-2xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs font-bold text-stone-900">Termii SMS Gateway</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{settings.notifications?.smsProvider}</div>
                  </div>
                  <button
                    onClick={() => handleTestConnection('termii')}
                    disabled={testingProvider === 'termii'}
                    className="w-full py-2 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Wifi className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>{testingProvider === 'termii' ? 'Pinging...' : 'Test Termii SMS'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] shadow-2xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs font-bold text-stone-900">Resend Email Engine</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{settings.notifications?.emailProvider}</div>
                  </div>
                  <button
                    onClick={() => handleTestConnection('resend')}
                    disabled={testingProvider === 'resend'}
                    className="w-full py-2 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Wifi className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>{testingProvider === 'resend' ? 'Pinging...' : 'Test Email Dispatch'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E5DEC9] shadow-2xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs font-bold text-stone-900">WhatsApp Cloud API</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">Phone: {settings.notifications?.whatsappNumber}</div>
                  </div>
                  <button
                    onClick={() => handleTestConnection('meta_whatsapp')}
                    disabled={testingProvider === 'meta_whatsapp'}
                    className="w-full py-2 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Wifi className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>{testingProvider === 'meta_whatsapp' ? 'Pinging...' : 'Test WhatsApp'}</span>
                  </button>
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Module J: QR Codes & Operations */}
          {activeSection === 'qrcodes' && (
            <QrCodesManagementPanel getAuthHeaders={getAuthHeaders} showToast={showToast} />
          )}
        </div>
      </div>
    </div>
  );
};
