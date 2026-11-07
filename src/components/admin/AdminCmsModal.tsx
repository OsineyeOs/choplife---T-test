import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { BranchId, OrderStatus, InventoryItem, AccountingSummary, Order, StaffRole } from '../../types';
import { validateMenuData } from '../../utils/menuValidation';
import { DEALS_LIST } from '../../data/menu';
import { GRA_DELIVERY_ZONES, OKABERE_DELIVERY_ZONES, UGBOWO_DELIVERY_ZONES } from '../../data/deliveryMaster';
import MasterInventoryManager from '../inventory/MasterInventoryManager';
import {
  X,
  ShieldCheck,
  Store,
  Sliders,
  DollarSign,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Truck,
  Flame,
  Search,
  Plus,
  FileSpreadsheet,
  History,
  Lock,
  Layers,
  ShoppingBag,
  Bike,
  CreditCard,
  Building,
  Printer,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Filter,
  FileCheck,
  TrendingUp,
  Award,
  Users,
  Eye,
  ChevronRight,
  ArrowRight,
  Phone,
  Clock,
  MapPin,
  Tag,
} from 'lucide-react';

export const AdminCmsModal: React.FC = () => {
  const {
    isAdminOpen,
    setIsAdminOpen,
    setIsStaffPosOpen,
    setIsRiderPortalOpen,
    navigateToOperations,
    products,
    branches,
    orders,
    toggleProductStock,
    updateProductBranchPrice,
    updateOrderStatus,
    isProductAvailable,
    getProductPrice,
    inventoryItems,
    updateInventoryStock,
    restockInventoryItem,
    accountingReconciliations,
    saveShiftReconciliation,
    auditLogs,
    addAuditLog,
    currentStaff,
    formatNaira,
    riders,
    staffAccounts,
    fetchStaffAccounts,
    createStaffAccount,
    updateStaffAccount,
    resetStaffPassword,
    revokeStaffSessions,
    logoutStaff,
  } = useApp();

  type AdminTab =
    | 'dashboard'
    | 'orders'
    | 'inventory'
    | 'delivery'
    | 'promotions'
    | 'rewards'
    | 'accounting'
    | 'audit'
    | 'staff'
    | 'validation';

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<BranchId>('gra');
  const [cmsSearch, setCmsSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);

  // Staff Management State
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffId, setNewStaffId] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('cashier');
  const [newStaffBranch, setNewStaffBranch] = useState<BranchId>('gra');
  const [newStaffPass, setNewStaffPass] = useState('');
  const [staffActionMsg, setStaffActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetPassModalStaff, setResetPassModalStaff] = useState<{ id: string; name: string } | null>(null);
  const [temporaryPassInput, setTemporaryPassInput] = useState('');

  // Delivery Zones local search
  const [zoneSearchQuery, setZoneSearchQuery] = useState('');

  // Validation State
  const [validationRunKey, setValidationRunKey] = useState<number>(0);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Restock modal state
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockAmount, setRestockAmount] = useState<string>('');
  const [restockNotes, setRestockNotes] = useState<string>('');

  // Shift Reconciliation State
  const [declaredCash, setDeclaredCash] = useState<string>('');
  const [reconcileSuccessMsg, setReconcileSuccessMsg] = useState<string>('');

  // Compute live validation report
  const validationReport = useMemo(() => {
    return validateMenuData(products, DEALS_LIST);
  }, [products, validationRunKey]);

  // Combined master delivery zones
  const allMasterDeliveryZones = useMemo(() => {
    return [
      ...GRA_DELIVERY_ZONES.map((z) => ({ ...z, branchLabel: 'GRA Hub' })),
      ...OKABERE_DELIVERY_ZONES.map((z) => ({ ...z, branchLabel: 'Okabere Hub' })),
      ...UGBOWO_DELIVERY_ZONES.map((z) => ({ ...z, branchLabel: 'Ugbowo Hub' })),
    ];
  }, []);

  if (!isAdminOpen) return null;

  // Branch Orders & KPIs
  const branchOrders = orders.filter(
    (o) => selectedBranchFilter === 'gra' || o.branchId === selectedBranchFilter
  );
  const grossSales = branchOrders.reduce((sum, o) => sum + o.total, 0);
  const averageOrderValue = branchOrders.length > 0 ? Math.round(grossSales / branchOrders.length) : 0;
  
  const cashSales = branchOrders
    .filter((o) => o.paymentMethod === 'cash_on_delivery')
    .reduce((sum, o) => sum + o.total, 0);
  const transferSales = branchOrders
    .filter((o) => o.paymentMethod === 'bank_transfer')
    .reduce((sum, o) => sum + o.total, 0);
  const posSales = branchOrders
    .filter((o) => o.paymentMethod === 'pos_on_delivery')
    .reduce((sum, o) => sum + o.total, 0);
  const onlineSales = branchOrders
    .filter((o) => o.paymentMethod === 'card')
    .reduce((sum, o) => sum + o.total, 0);

  const numericDeclaredCash = parseFloat(declaredCash) || 0;
  const expectedCashInTill = cashSales;
  const cashVariance = numericDeclaredCash - expectedCashInTill;

  // Filter products by branch and search
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(cmsSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(cmsSearch.toLowerCase()) ||
      (p.subcategory && p.subcategory.toLowerCase().includes(cmsSearch.toLowerCase()))
  );

  // Filter orders by status & search
  const filteredOrders = branchOrders.filter((o) => {
    if (orderStatusFilter !== 'all' && o.orderStatus !== orderStatusFilter) return false;
    if (cmsSearch.trim()) {
      const q = cmsSearch.toLowerCase();
      const matchesId = o.id.toLowerCase().includes(q) || (o.orderNumber && o.orderNumber.toLowerCase().includes(q));
      const customerName = o.deliveryDetails?.customerName || '';
      const customerPhone = o.deliveryDetails?.customerPhone || '';
      const matchesCustomer = customerName.toLowerCase().includes(q) || customerPhone.includes(q);
      const matchesItem = o.items.some((it) => it.product.name.toLowerCase().includes(q));
      if (!matchesId && !matchesCustomer && !matchesItem) return false;
    }
    return true;
  });

  // Filtered delivery zones
  const filteredDeliveryZones = allMasterDeliveryZones.filter(
    (z) =>
      z.locationName.toLowerCase().includes(zoneSearchQuery.toLowerCase()) ||
      z.aliases.some((a) => a.toLowerCase().includes(zoneSearchQuery.toLowerCase()))
  );

  const handleExecuteRestock = () => {
    if (!restockItem || !restockAmount) return;
    const added = parseFloat(restockAmount) || 0;
    if (added > 0) {
      restockInventoryItem(restockItem.id, selectedBranchFilter, added, restockNotes);
      addAuditLog({
        staffName: currentStaff?.name || 'Staff',
        staffRole: currentStaff?.role || 'staff',
        branchId: selectedBranchFilter,
        actionType: 'STOCK_MODIFIED',
        details: `Restocked ${added} ${restockItem.unit} of ${restockItem.name} at ${selectedBranchFilter.toUpperCase()}`,
      });
      setRestockItem(null);
      setRestockAmount('');
      setRestockNotes('');
    }
  };

  const handleSaveEodReconciliation = () => {
    const summary: AccountingSummary = {
      branchId: selectedBranchFilter,
      date: new Date().toLocaleDateString('en-GB'),
      grossSales,
      totalOrders: branchOrders.length,
      cashSales,
      transferSales,
      posSales,
      onlineSales,
      packagingCollected: branchOrders.reduce((sum, o) => sum + o.packagingFee, 0),
      deliveryFeesCollected: branchOrders.reduce((sum, o) => sum + o.deliveryFee, 0),
      discountsGiven: branchOrders.reduce((sum, o) => sum + o.discount, 0),
      declaredCashInTill: numericDeclaredCash,
      cashVariance,
      reconciledBy: currentStaff?.name || 'Manager',
      reconciledAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    saveShiftReconciliation(summary);
    addAuditLog({
      staffName: currentStaff?.name || 'Manager',
      staffRole: currentStaff?.role || 'manager',
      branchId: selectedBranchFilter,
      actionType: 'EOD_RECONCILED',
      details: `Shift reconciliation locked for ${selectedBranchFilter.toUpperCase()}. Declared: ₦${numericDeclaredCash}, Variance: ₦${cashVariance}`,
    });
    setReconcileSuccessMsg(`✅ Shift reconciliation saved & locked for ${selectedBranchFilter.toUpperCase()}!`);
    setTimeout(() => setReconcileSuccessMsg(''), 4000);
  };

  const handleCopyReport = () => {
    const reportText = `CHOPLIFE MENU INTEGRITY REPORT
Generated: ${validationReport.timestamp}
Status: ${validationReport.isClean ? '100% VERIFIED CLEAN' : 'ISSUES DETECTED'}
Total Products: ${validationReport.totalProductsChecked}
Total Deals/Combos: ${validationReport.totalDealsChecked}
Total Issues: ${validationReport.totalIssuesFound} (Errors: ${validationReport.errorCount}, Warnings: ${validationReport.warningCount})

Category Breakdown:
${Object.entries(validationReport.categoryCounts).map(([cat, count]) => ` - ${cat}: ${count}`).join('\n')}

${validationReport.issues.length > 0 ? '\nIssues List:\n' + validationReport.issues.map((i) => `[${i.severity.toUpperCase()}] (${i.type}) ${i.itemName} (${i.itemId}): ${i.message}`).join('\n') : 'No issues found.'}`;

    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  const ORDER_STATUS_TABS: { id: string; label: string }[] = [
    { id: 'all', label: 'All Orders' },
    { id: 'received', label: 'Received' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'preparing', label: 'Preparing' },
    { id: 'ready', label: 'Ready' },
    { id: 'out_for_delivery', label: 'Out for Delivery' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      id="admin-cms-modal"
    >
      <div className="bg-[#FAF7F2] rounded-3xl w-full max-w-7xl max-h-[94vh] overflow-y-auto shadow-2xl border-2 border-[#FFC700] flex flex-col justify-between">
        
        {/* Command Center Header */}
        <div className="bg-[#4D080F] text-white p-4 sm:p-5 rounded-t-3xl flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 border-b-2 border-[#FFC700]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E62E00] text-[#FFC700] flex items-center justify-center font-titan text-xl shadow-md shrink-0">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-titan text-base sm:text-xl text-white">
                  CHOPLIFE ENTERPRISE OPERATIONS & SUPER ADMIN
                </h2>
                <span className="bg-[#FFC700] text-[#4D080F] text-[10px] font-titan uppercase px-2 py-0.5 rounded-full">
                  {currentStaff?.role?.replace('_', ' ').toUpperCase() || 'SUPER ADMIN'}
                </span>
              </div>
              <p className="text-xs text-white/80 font-montserrat hidden sm:block">
                Branch Operations, Live Kitchen Dispatch, Stock 86, Zone Logistics & Audit Trail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Launch POS Button */}
            <button
              onClick={() => {
                setIsAdminOpen(false);
                navigateToOperations('pos');
              }}
              className="px-3 py-1.5 rounded-xl bg-[#E62E00] hover:bg-[#c92800] text-white text-xs font-titan uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              id="admin-launch-pos-btn"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#FFC700]" />
              <span className="hidden sm:inline">Staff POS</span>
            </button>

            {/* Quick Launch Rider Portal */}
            <button
              onClick={() => {
                setIsAdminOpen(false);
                setIsRiderPortalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFC700] border border-[#FFC700]/50 text-xs font-montserrat font-bold flex items-center gap-1.5 transition-all"
              id="admin-launch-rider-btn"
            >
              <Bike className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rider App</span>
            </button>

            {/* Logout Staff Button */}
            <button
              onClick={() => logoutStaff()}
              className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/40 text-xs font-montserrat font-bold flex items-center gap-1.5 transition-all"
              id="admin-logout-btn"
              title="Sign out of staff session"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            <button
              onClick={() => setIsAdminOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              id="admin-close-modal-btn"
              aria-label="Close Admin Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Operational Navigation Tabs */}
        <div className="bg-white px-3 sm:px-5 py-2.5 border-b border-[#E5DEC9] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Operations Dashboard', icon: <TrendingUp className="w-4 h-4" /> },
            { id: 'orders', label: `Orders & Dispatch (${orders.length})`, icon: <Truck className="w-4 h-4" /> },
            { id: 'inventory', label: 'Inventory & Stock 86', icon: <Sliders className="w-4 h-4" /> },
            { id: 'delivery', label: 'Delivery Zones & Pricing', icon: <MapPin className="w-4 h-4" /> },
            { id: 'promotions', label: 'Approved Combos & Platters', icon: <Sparkles className="w-4 h-4" /> },
            { id: 'rewards', label: 'Rewards Admin (₦1k=1pt)', icon: <Award className="w-4 h-4" /> },
            { id: 'accounting', label: 'Shift Accounting & Till', icon: <DollarSign className="w-4 h-4" /> },
            { id: 'audit', label: `Audit Trail (${auditLogs.length})`, icon: <History className="w-4 h-4" /> },
            { id: 'staff', label: 'Staff & Roles', icon: <Users className="w-4 h-4" /> },
            {
              id: 'validation',
              label: `Data Integrity ${validationReport.totalIssuesFound > 0 ? `(${validationReport.totalIssuesFound})` : '✓'}`,
              icon: <ShieldCheck className="w-4 h-4" />,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                  : 'bg-[#FAF7F2] text-[#4D080F] border border-[#E5DEC9] hover:bg-[#F2ECE1]'
              }`}
              id={`admin-tab-${tab.id}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Executive & Operational Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="p-4 sm:p-6 space-y-6 flex-1">
            {/* Branch Selector Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5DEC9]">
              <div>
                <span className="text-[10px] font-titan uppercase tracking-wider text-[#7A6A65] block">
                  VIEW METRICS FOR BRANCH
                </span>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBranchFilter(b.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all ${
                        selectedBranchFilter === b.id
                          ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                          : 'bg-[#FAF7F2] text-[#4D080F] border border-[#E5DEC9]'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-right text-xs font-montserrat">
                <p className="text-gray-500">
                  Current Time: <strong>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                </p>
                <p className="text-emerald-700 font-bold">● All 3 Branch Kitchens Operational</p>
              </div>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-1">
                <span className="text-[10px] font-titan uppercase text-gray-500 block">Today's Gross Sales</span>
                <p className="font-titan text-2xl text-[#E62E00]">{formatNaira(grossSales)}</p>
                <p className="text-[10px] text-gray-400 font-montserrat">{branchOrders.length} total orders logged</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-1">
                <span className="text-[10px] font-titan uppercase text-gray-500 block">Avg Order Value (AOV)</span>
                <p className="font-titan text-2xl text-[#4D080F]">{formatNaira(averageOrderValue)}</p>
                <p className="text-[10px] text-gray-400 font-montserrat">Per customer transaction</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-1">
                <span className="text-[10px] font-titan uppercase text-gray-500 block">Active In-Kitchen / Dispatch</span>
                <p className="font-titan text-2xl text-amber-600">
                  {branchOrders.filter((o) => o.orderStatus === 'preparing' || o.orderStatus === 'out_for_delivery').length}
                </p>
                <p className="text-[10px] text-gray-400 font-montserrat">Live fulfilment queue</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-1">
                <span className="text-[10px] font-titan uppercase text-gray-500 block">Active Dispatch Riders</span>
                <p className="font-titan text-2xl text-blue-600">
                  {riders.filter((r) => r.status !== 'offline').length} / {riders.length}
                </p>
                <p className="text-[10px] text-gray-400 font-montserrat">Benin City delivery fleet</p>
              </div>
            </div>

            {/* Quick Actions & Live Kitchen Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-[#E5DEC9] space-y-3">
                <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#E62E00]" />
                  RECENT ORDERS READY FOR ACTION
                </h3>
                <div className="space-y-2">
                  {branchOrders.slice(0, 4).map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9] flex items-center justify-between gap-2 text-xs font-montserrat"
                    >
                      <div>
                        <span className="font-titan text-[#4D080F] block">
                          #{ord.orderNumber || ord.id} • {ord.deliveryDetails?.customerName || 'Customer'}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {ord.items.length} items • {formatNaira(ord.total)} • {ord.orderType.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedOrderForView(ord);
                          setActiveTab('orders');
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-[#FFC700] text-[#4D080F] border border-[#E5DEC9] rounded-lg font-bold text-[11px] transition-colors"
                      >
                        Manage
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#FFF8E7] p-5 rounded-3xl border border-[#FFC700] space-y-3">
                <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  APPROVED MENU COMPLIANCE STATUS
                </h3>
                <p className="text-xs text-[#7A6A65] font-montserrat">
                  All active dishes, platters, and bakery loaves strictly adhere to the approved Benin City menu specification.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-montserrat">
                  <div className="p-2.5 bg-white rounded-xl border border-[#E5DEC9]">
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">Approved Dishes</span>
                    <strong className="text-sm font-titan text-[#4D080F]">{products.length} Products</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-[#E5DEC9]">
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">Loyalty Rule</span>
                    <strong className="text-sm font-titan text-emerald-700">₦1,000 = 1 Point</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: High-Usability Order Management */}
        {activeTab === 'orders' && (
          <div className="p-4 sm:p-6 space-y-4 flex-1">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5DEC9]">
              <div className="w-full sm:w-72 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search order #, customer, phone..."
                  value={cmsSearch}
                  onChange={(e) => setCmsSearch(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl pl-9 pr-3 py-2 text-xs font-montserrat text-[#241311]"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                {ORDER_STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setOrderStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold whitespace-nowrap transition-all ${
                      orderStatusFilter === tab.id
                        ? 'bg-[#4D080F] text-[#FFC700]'
                        : 'bg-[#FAF7F2] text-[#4D080F] border border-[#E5DEC9]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Order Cards (< 640px) */}
            <div className="sm:hidden space-y-3">
              {filteredOrders.map((ord) => {
                const customerName = ord.deliveryDetails?.customerName || 'Customer';
                const customerPhone = ord.deliveryDetails?.customerPhone || '';

                return (
                  <div
                    key={ord.id}
                    className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-titan text-sm text-[#4D080F]">#{ord.orderNumber || ord.id}</span>
                      <span className="bg-amber-100 text-amber-900 text-[10px] font-titan px-2 py-0.5 rounded-full uppercase">
                        {ord.orderStatus.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs font-montserrat text-gray-600 space-y-0.5">
                      <p className="font-bold text-[#241311]">{customerName} {customerPhone ? `(${customerPhone})` : ''}</p>
                      <p className="text-gray-500">
                        {ord.items.length} items • Total: <strong className="text-[#E62E00]">{formatNaira(ord.total)}</strong>
                      </p>
                      <p className="text-gray-400 text-[11px]">{new Date(ord.createdAt).toLocaleTimeString()}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <select
                        value={ord.orderStatus}
                        onChange={(e) => updateOrderStatus(ord.id, e.target.value as OrderStatus)}
                        className="bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-montserrat font-bold rounded-lg px-2 py-1 flex-1 text-[#4D080F]"
                      >
                        <option value="received">Received</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready">Ready</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>

                      <button
                        onClick={() => setSelectedOrderForView(ord)}
                        className="px-3 py-1 bg-[#4D080F] text-[#FFC700] text-xs font-montserrat font-bold rounded-lg"
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Orders Table (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-[#E5DEC9] bg-white">
              <table className="w-full text-left text-xs font-montserrat">
                <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
                  <tr>
                    <th className="p-3">Order #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Branch / Type</th>
                    <th className="p-3">Items Summary</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DEC9]">
                  {filteredOrders.map((ord) => {
                    const customerName = ord.deliveryDetails?.customerName || 'Customer';
                    const customerPhone = ord.deliveryDetails?.customerPhone || '';

                    return (
                      <tr key={ord.id} className="hover:bg-[#FFF8E7]/40 transition-colors">
                        <td className="p-3 font-titan text-[#4D080F]">#{ord.orderNumber || ord.id}</td>
                        <td className="p-3">
                          <strong className="block text-[#241311]">{customerName}</strong>
                          <span className="text-[11px] text-gray-500">{customerPhone}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-titan uppercase text-[#4D080F]">{ord.branchId}</span>
                          <span className="text-[10px] block text-gray-500 capitalize">{ord.orderType}</span>
                        </td>
                        <td className="p-3 max-w-xs truncate text-gray-700">
                          {ord.items.map((i) => `${i.quantity}x ${i.product.name}`).join(', ')}
                        </td>
                        <td className="p-3 font-titan text-[#E62E00]">{formatNaira(ord.total)}</td>
                        <td className="p-3">
                          <select
                            value={ord.orderStatus}
                            onChange={(e) => updateOrderStatus(ord.id, e.target.value as OrderStatus)}
                            className="bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-montserrat font-bold rounded-lg px-2 py-1 text-[#4D080F]"
                          >
                            <option value="received">Received</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="preparing">Preparing</option>
                            <option value="ready">Ready</option>
                            <option value="out_for_delivery">Out for Delivery</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedOrderForView(ord)}
                            className="px-3 py-1 bg-[#FAF7F2] hover:bg-[#FFC700] text-[#4D080F] font-bold rounded-lg border border-[#E5DEC9] transition-colors"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Order Details Modal Overlay if selected */}
            {selectedOrderForView && (
              <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
                <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl border-2 border-[#FFC700]">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <span className="text-[10px] font-titan text-[#E62E00] uppercase">Order Breakdown</span>
                      <h3 className="font-titan text-lg text-[#4D080F]">
                        #{selectedOrderForView.orderNumber || selectedOrderForView.id}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedOrderForView(null)}
                      className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs font-montserrat text-gray-700">
                    <div className="flex justify-between py-1 border-b">
                      <span>Customer:</span>
                      <strong>
                        {selectedOrderForView.deliveryDetails?.customerName || 'Customer'} (
                        {selectedOrderForView.deliveryDetails?.customerPhone || 'N/A'})
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Address / Zone:</span>
                      <strong>{selectedOrderForView.deliveryDetails?.address || 'Pick up in store'}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Payment Method:</span>
                      <strong className="uppercase">{selectedOrderForView.paymentMethod.replace('_', ' ')}</strong>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#E5DEC9] space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedOrderForView.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-xs font-montserrat">
                        <span>{it.quantity}x {it.product.name}</span>
                        <strong>{formatNaira(it.unitPrice * it.quantity)}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Pricing Total */}
                  <div className="space-y-1 text-xs font-montserrat border-t pt-2">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal:</span>
                      <span>{formatNaira(selectedOrderForView.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Delivery Fee:</span>
                      <span>{formatNaira(selectedOrderForView.deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Packaging:</span>
                      <span>{formatNaira(selectedOrderForView.packagingFee)}</span>
                    </div>
                    <div className="flex justify-between font-titan text-base text-[#E62E00] pt-1">
                      <span>Grand Total:</span>
                      <span>{formatNaira(selectedOrderForView.total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedOrderForView(null)}
                    className="w-full bg-[#4D080F] text-[#FFC700] font-titan text-xs py-2.5 rounded-xl uppercase"
                  >
                    Close Order View
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Inventory & Live Menu Stock 86 */}
        {activeTab === 'inventory' && (
          <div className="p-4 sm:p-6 space-y-6 flex-1">
            {/* Master Inventory ERP Engine */}
            <MasterInventoryManager
              selectedBranchId={selectedBranchFilter}
              onSelectBranch={setSelectedBranchFilter}
            />

            {/* Menu Items 86 & Price Override Table */}
            <div className="space-y-3 pt-4 border-t border-[#E5DEC9]">
              <div className="flex items-center justify-between">
                <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#E62E00]" />
                  FAST 86 DISH AVAILABILITY & BRANCH OVERRIDE
                </h3>
                <span className="text-xs font-montserrat text-gray-500">
                  Target Branch: <strong className="uppercase text-[#4D080F]">{selectedBranchFilter}</strong>
                </span>
              </div>

              {/* Mobile Product 86 Cards */}
              <div className="sm:hidden space-y-3">
                {filteredProducts.map((p) => {
                  const available = isProductAvailable(p.id, selectedBranchFilter);
                  const currentPrice = getProductPrice(p, selectedBranchFilter);

                  return (
                    <div
                      key={p.id}
                      className="bg-white p-3.5 rounded-2xl border border-[#E5DEC9] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-[#241311]">{p.name}</span>
                        <span className="font-titan text-xs text-[#E62E00]">
                          {formatNaira(currentPrice)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-montserrat text-gray-500">
                        <span className="capitalize">{p.category}</span>
                        <span>{available ? '✅ In Stock' : '❌ 86 Out of Stock'}</span>
                      </div>
                      <button
                        onClick={() => toggleProductStock(p.id, selectedBranchFilter)}
                        className={`w-full py-2 rounded-xl text-xs font-titan uppercase transition-all ${
                          available
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-green-600 text-white'
                        }`}
                      >
                        {available ? '86 This Item (Disable)' : 'Put In Stock'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto rounded-2xl border border-[#E5DEC9] bg-white">
                <table className="w-full text-left text-xs font-montserrat">
                  <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
                    <tr>
                      <th className="p-3">Dish / Item</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Base Price</th>
                      <th className="p-3">Branch Price</th>
                      <th className="p-3">Stock Status ({selectedBranchFilter.toUpperCase()})</th>
                      <th className="p-3 text-right">86 Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DEC9]">
                    {filteredProducts.map((p) => {
                      const available = isProductAvailable(p.id, selectedBranchFilter);
                      const currentPrice = getProductPrice(p, selectedBranchFilter);

                      return (
                        <tr key={p.id} className="hover:bg-[#FFF8E7]/50 transition-colors">
                          <td className="p-3 flex items-center gap-2.5 font-bold text-[#241311]">
                            <img
                              src={p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                              alt={p.name}
                              className="w-9 h-9 rounded-xl object-cover"
                            />
                            <div>
                              <span>{p.name}</span>
                              {p.isPopular && (
                                <span className="ml-1.5 text-[9px] text-[#E62E00] font-titan uppercase">
                                  ★ Popular
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-gray-500 capitalize">{p.category}</td>
                          <td className="p-3 font-titan text-gray-700">{formatNaira(p.basePrice)}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              defaultValue={currentPrice}
                              onBlur={(e) => {
                                const newP = parseFloat(e.target.value);
                                if (newP > 0) {
                                  updateProductBranchPrice(p.id, selectedBranchFilter, newP);
                                }
                              }}
                              className="w-24 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2 py-1 font-titan text-xs text-[#241311]"
                            />
                          </td>
                          <td className="p-3">
                            {available ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-titan uppercase bg-green-100 text-green-800">
                                <CheckCircle2 className="w-3 h-3" /> In Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-titan uppercase bg-red-100 text-red-800">
                                <AlertTriangle className="w-3 h-3" /> 86'd / Sold Out
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => toggleProductStock(p.id, selectedBranchFilter)}
                              className={`px-3 py-1 rounded-xl text-xs font-titan uppercase tracking-wider transition-all ${
                                available
                                  ? 'bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              {available ? '86 Item' : 'Put In Stock'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Delivery Zones & Pricing Logistics */}
        {activeTab === 'delivery' && (
          <div className="p-4 sm:p-6 space-y-4 flex-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5DEC9]">
              <div>
                <h3 className="font-titan text-sm text-[#4D080F] uppercase">
                  BENIN CITY APPROVED DELIVERY SCHEDULE ({allMasterDeliveryZones.length} LOCATIONS)
                </h3>
                <p className="text-xs text-gray-500 font-montserrat">
                  Search approved delivery zones, dispatch hubs, flat rate fees, and transit windows across Benin City.
                </p>
              </div>

              <div className="w-full sm:w-64 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Benin zone (GRA, Ugbowo...)"
                  value={zoneSearchQuery}
                  onChange={(e) => setZoneSearchQuery(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl pl-9 pr-3 py-2 text-xs font-montserrat text-[#241311]"
                />
              </div>
            </div>

            {/* Zones Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto pr-1">
              {filteredDeliveryZones.map((zone) => (
                <div
                  key={zone.id}
                  className="bg-white p-3.5 rounded-2xl border border-[#E5DEC9] flex flex-col justify-between space-y-2 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-titan text-xs text-[#4D080F]">{zone.locationName}</h4>
                      <span className="font-titan text-xs text-[#E62E00]">
                        {formatNaira(zone.deliveryFee)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-montserrat mt-0.5">
                      Hub: <strong>{zone.branchLabel}</strong> • Aliases: {zone.aliases.slice(0, 2).join(', ')}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-montserrat">
                    <span className="text-emerald-700 font-bold">● Approved Zone</span>
                    <span className="text-gray-400">{zone.estimatedMins}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Approved Promotions & Combos Viewer */}
        {activeTab === 'promotions' && (
          <div className="p-4 sm:p-6 space-y-4 flex-1">
            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9]">
              <h3 className="font-titan text-sm text-[#4D080F] uppercase">
                FEATURED APPROVED COMBOS & PARTY PLATTERS
              </h3>
              <p className="text-xs text-gray-500 font-montserrat">
                All promotions reference canonical products. No duplicate or derived unapproved SKUs can be introduced.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {DEALS_LIST.map((deal) => (
                <div
                  key={deal.id}
                  className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-3 flex flex-col justify-between shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-titan uppercase bg-[#FFF8E7] text-[#E62E00] px-2 py-0.5 rounded-full border border-[#FFC700]">
                        {deal.badge}
                      </span>
                      <span className="font-titan text-sm text-[#E62E00]">
                        {formatNaira(deal.dealPrice)}
                      </span>
                    </div>
                    <h4 className="font-titan text-sm text-[#4D080F] mt-1">{deal.title}</h4>
                    <p className="text-xs text-gray-600 font-montserrat mt-1">{deal.description}</p>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-montserrat">
                    <span className="text-gray-400 line-through">
                      {formatNaira(deal.originalPrice)}
                    </span>
                    <span className="text-green-700 font-bold">
                      Save {formatNaira(deal.savings)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Rewards Configuration & Rule Inspector */}
        {activeTab === 'rewards' && (
          <div className="p-4 sm:p-6 space-y-6 flex-1">
            <div className="bg-[#FFF8E7] p-5 rounded-3xl border-2 border-[#FFC700] space-y-3">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-[#E62E00]" />
                <div>
                  <span className="text-[10px] font-titan uppercase text-[#E62E00] tracking-widest block">
                    CENTRALIZED LOYALTY REWARDS RULE
                  </span>
                  <h3 className="font-titan text-lg text-[#4D080F]">
                    Every ₦1,000 Spent = 1 Loyalty Point
                  </h3>
                </div>
              </div>
              <p className="text-xs text-gray-700 font-montserrat max-w-xl">
                Customers automatically earn 1 point for every completed ₦1,000 on approved food orders. Points are redeemable for free Zobo drinks and Small Chops boxes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-2">
                <span className="font-titan text-xs text-[#4D080F] uppercase block">Earning Multiplier</span>
                <p className="font-titan text-2xl text-[#E62E00]">1.0 pt / ₦1,000</p>
                <p className="text-[10px] text-gray-400 font-montserrat">Applied automatically at checkout</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-2">
                <span className="font-titan text-xs text-[#4D080F] uppercase block">Chilled Zobo Reward Tier</span>
                <p className="font-titan text-2xl text-blue-700">10 Points</p>
                <p className="text-[10px] text-gray-400 font-montserrat">Redeem for chilled drink</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-2">
                <span className="font-titan text-xs text-[#4D080F] uppercase block">Small Chops Box Tier</span>
                <p className="font-titan text-2xl text-green-700">25 Points</p>
                <p className="text-[10px] text-gray-400 font-montserrat">Redeem for Mini Small Chops pack</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Shift Accounting & Z-Report */}
        {activeTab === 'accounting' && (
          <div className="p-4 sm:p-6 space-y-6 flex-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5DEC9]">
              <div>
                <label className="text-[10px] font-titan uppercase text-gray-500 block">
                  RECONCILE REGISTER FOR BRANCH:
                </label>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBranchFilter(b.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all ${
                        selectedBranchFilter === b.id
                          ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                          : 'bg-[#FAF7F2] text-[#4D080F] border border-[#E5DEC9]'
                      }`}
                    >
                      {b.shortName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-right text-xs font-montserrat">
                <p className="text-gray-500">Today: <strong>{new Date().toLocaleDateString('en-GB')}</strong></p>
                <p className="text-gray-500">Auditor: <strong>{currentStaff?.name || 'Manager'}</strong></p>
              </div>
            </div>

            {/* Cash in Till Calculator */}
            <div className="bg-[#FFF8E7] p-5 rounded-2xl border border-[#FFC700] space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#4D080F]" />
                <h3 className="font-titan text-sm text-[#4D080F] uppercase">
                  PHYSICAL CASH IN TILL AUDIT & Z-REPORT
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-montserrat">
                <div>
                  <label className="text-[10px] font-titan uppercase text-[#4D080F] block mb-1">
                    1. Expected Cash in Drawer
                  </label>
                  <div className="p-2.5 bg-white rounded-xl border border-[#E5DEC9] font-titan text-sm text-[#4D080F]">
                    {formatNaira(expectedCashInTill)}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-titan uppercase text-[#4D080F] block mb-1">
                    2. Counted Physical Cash Tendered (₦)
                  </label>
                  <input
                    type="number"
                    value={declaredCash}
                    onChange={(e) => setDeclaredCash(e.target.value)}
                    placeholder="Enter counted amount..."
                    className="w-full bg-white border border-[#E5DEC9] rounded-xl p-2.5 font-titan text-sm text-[#241311]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-titan uppercase text-[#4D080F] block mb-1">
                    3. Cash Variance (Overage / Shortage)
                  </label>
                  <div
                    className={`p-2.5 rounded-xl border font-titan text-sm flex items-center justify-between ${
                      cashVariance === 0
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : cashVariance > 0
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : 'bg-red-100 text-red-800 border-red-300'
                    }`}
                  >
                    <span>{formatNaira(cashVariance)}</span>
                    <span className="text-[10px] font-montserrat">
                      {cashVariance === 0 ? 'BALANCED' : cashVariance > 0 ? 'OVERAGE' : 'SHORTAGE'}
                    </span>
                  </div>
                </div>
              </div>

              {reconcileSuccessMsg && (
                <div className="p-3 bg-green-100 border border-green-300 rounded-xl text-xs font-montserrat text-green-900 font-bold">
                  {reconcileSuccessMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleSaveEodReconciliation}
                  className="px-5 py-2.5 rounded-xl bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] font-titan uppercase text-xs tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Lock & Commit Shift Reconciliation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 8: Chronological Audit Trail */}
        {activeTab === 'audit' && (
          <div className="p-4 sm:p-6 space-y-4 flex-1">
            <h3 className="font-titan text-xs text-[#4D080F] uppercase flex items-center gap-2">
              <History className="w-4 h-4 text-[#E62E00]" />
              CHRONOLOGICAL AUDIT & SECURITY TRAIL ({auditLogs.length})
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-[#E5DEC9] bg-white">
              <table className="w-full text-left text-xs font-montserrat">
                <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Staff Member</th>
                    <th className="p-3">Branch</th>
                    <th className="p-3">Action Type</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-[#241311] whitespace-nowrap">
                        {log.staffName} ({log.staffRole})
                      </td>
                      <td className="p-3 font-titan uppercase text-[#4D080F]">{log.branchId}</td>
                      <td className="p-3">
                        <span className="bg-gray-100 text-gray-800 text-[10px] font-titan uppercase px-2 py-0.5 rounded-md">
                          {log.actionType}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 9: Staff & Roles */}
        {activeTab === 'staff' && (
          <div className="p-4 sm:p-6 space-y-5 flex-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#E62E00]" />
                  STAFF ACCOUNTS & ROLE-BASED ACCESS CONTROL ({staffAccounts.length})
                </h3>
                <p className="text-xs text-gray-500 font-montserrat">
                  Manage internal restaurant staff members, permissions, and cryptographic access.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => fetchStaffAccounts()}
                  className="px-3 py-2 rounded-xl border border-[#E5DEC9] bg-white hover:bg-gray-50 text-xs font-montserrat font-bold text-[#4D080F] flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setIsAddStaffOpen(true);
                    setStaffActionMsg(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#E62E00] hover:bg-[#C92200] text-white text-xs font-titan flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Add Staff Member
                </button>
              </div>
            </div>

            {staffActionMsg && (
              <div
                className={`p-3.5 rounded-xl text-xs font-montserrat flex items-center gap-2 ${
                  staffActionMsg.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {staffActionMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{staffActionMsg.text}</span>
              </div>
            )}

            {/* Staff Accounts Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#E5DEC9] bg-white">
              <table className="w-full text-left text-xs font-montserrat">
                <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
                  <tr>
                    <th className="p-3.5">Staff Name & ID</th>
                    <th className="p-3.5">Work Email / Phone</th>
                    <th className="p-3.5">Assigned Branch</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {staffAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500 font-montserrat">
                        No staff accounts provisioned yet. Use the "Add Staff Member" button to create team credentials.
                      </td>
                    </tr>
                  ) : (
                    staffAccounts.map((st) => (
                      <tr key={st.id} className="hover:bg-gray-50/80">
                        <td className="p-3.5">
                          <div className="font-bold text-[#241311]">{st.name}</div>
                          <div className="text-[11px] font-mono text-gray-500">{st.staffId || st.id}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="text-gray-700">{st.workEmail || '—'}</div>
                          <div className="text-[11px] text-gray-400">{st.phone || '—'}</div>
                        </td>
                        <td className="p-3.5">
                          <span className="font-titan text-[11px] uppercase text-[#4D080F]">
                            {st.branchId ? st.branchId.toUpperCase() : 'ALL'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="bg-[#4D080F] text-[#FFC700] text-[9px] font-titan uppercase px-2.5 py-1 rounded-md">
                            {st.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`text-[10px] font-titan uppercase px-2 py-0.5 rounded-full ${
                              st.isActive !== false
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {st.isActive !== false ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setResetPassModalStaff({ id: st.id, name: st.name });
                              setTemporaryPassInput('');
                              setStaffActionMsg(null);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-[#E5DEC9] bg-[#FAF7F2] hover:bg-white text-[11px] font-montserrat font-bold text-[#4D080F] transition-colors"
                            title="Reset Temporary Password"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={async () => {
                              const res = await revokeStaffSessions(st.id);
                              if (res.success) {
                                setStaffActionMsg({ type: 'success', text: `Revoked active sessions for ${st.name}.` });
                              } else {
                                setStaffActionMsg({ type: 'error', text: res.error || 'Revocation failed.' });
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[11px] font-montserrat font-bold text-red-700 transition-colors"
                            title="Revoke all active sessions"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal: Add New Staff Member */}
            {isAddStaffOpen && (
              <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-[#E5DEC9] space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
                    <h4 className="font-titan text-base text-[#4D080F] uppercase">PROVISION NEW STAFF ACCOUNT</h4>
                    <button onClick={() => setIsAddStaffOpen(false)} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (newStaffPass.length < 8) {
                        setStaffActionMsg({ type: 'error', text: 'Password must be at least 8 characters long.' });
                        return;
                      }
                      const res = await createStaffAccount({
                        name: newStaffName.trim(),
                        staffId: newStaffId.trim(),
                        workEmail: newStaffEmail.trim(),
                        phone: newStaffPhone.trim() || undefined,
                        role: newStaffRole,
                        branchId: newStaffBranch,
                        initialPassword: newStaffPass,
                      });

                      if (res.success) {
                        setIsAddStaffOpen(false);
                        setNewStaffName('');
                        setNewStaffId('');
                        setNewStaffEmail('');
                        setNewStaffPhone('');
                        setNewStaffPass('');
                        setStaffActionMsg({ type: 'success', text: 'Staff account successfully provisioned.' });
                      } else {
                        setStaffActionMsg({ type: 'error', text: res.error || 'Failed to create staff account.' });
                      }
                    }}
                    className="space-y-3 text-xs font-montserrat"
                  >
                    <div>
                      <label className="block font-titan text-[#4D080F] uppercase text-[10px] mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Chidinma Okafor"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#FFC700]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-titan text-[#4D080F] uppercase text-[10px] mb-1">Staff ID Code</label>
                        <input
                          type="text"
                          required
                          placeholder="CL-POS-008"
                          value={newStaffId}
                          onChange={(e) => setNewStaffId(e.target.value)}
                          className="w-full p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#FFC700]"
                        />
                      </div>
                      <div>
                        <label className="block font-titan text-[#4D080F] uppercase text-[10px] mb-1">Work Email</label>
                        <input
                          type="email"
                          required
                          placeholder="chidinma@choplife.ng"
                          value={newStaffEmail}
                          onChange={(e) => setNewStaffEmail(e.target.value)}
                          className="w-full p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#FFC700]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-titan text-[#4D080F] uppercase text-[10px] mb-1">Operational Role</label>
                        <select
                          value={newStaffRole}
                          onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                          className="w-full p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#FFC700]"
                        >
                          <option value="cashier">Cashier / POS</option>
                          <option value="kitchen_lead">Kitchen Lead</option>
                          <option value="rider">Lead Rider / Dispatch</option>
                          <option value="store_manager">Store Manager</option>
                          <option value="accountant">Accountant</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-titan text-[#4D080F] uppercase text-[10px] mb-1">Branch Station</label>
                        <select
                          value={newStaffBranch}
                          onChange={(e) => setNewStaffBranch(e.target.value as BranchId)}
                          className="w-full p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#FFC700]"
                        >
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-titan text-[#4D080F] uppercase text-[10px] mb-1">
                        Initial Password (min 8 characters)
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={newStaffPass}
                        onChange={(e) => setNewStaffPass(e.target.value)}
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#FFC700]"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddStaffOpen(false)}
                        className="w-1/3 py-2.5 rounded-xl border border-[#E5DEC9] text-[#7A6A65] font-titan text-xs"
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        className="w-2/3 py-2.5 rounded-xl bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs shadow-md"
                      >
                        CREATE ACCOUNT
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Reset Temporary Password */}
            {resetPassModalStaff && (
              <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-[#E5DEC9] space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
                    <h4 className="font-titan text-sm text-[#4D080F] uppercase">
                      RESET PASSWORD: {resetPassModalStaff.name}
                    </h4>
                    <button
                      onClick={() => setResetPassModalStaff(null)}
                      className="p-1 rounded-full text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (temporaryPassInput.length < 8) {
                        setStaffActionMsg({ type: 'error', text: 'Temporary password must be at least 8 characters.' });
                        return;
                      }
                      const res = await resetStaffPassword(resetPassModalStaff.id, temporaryPassInput);
                      if (res.success) {
                        setStaffActionMsg({
                          type: 'success',
                          text: `Password reset successfully for ${resetPassModalStaff.name}.`,
                        });
                        setResetPassModalStaff(null);
                      } else {
                        setStaffActionMsg({ type: 'error', text: res.error || 'Failed to reset password.' });
                      }
                    }}
                    className="space-y-3 text-xs font-montserrat"
                  >
                    <p className="text-gray-600">
                      Assign a temporary password. The staff member will use this credential on next login.
                    </p>
                    <div>
                      <label className="block font-titan text-[#4D080F] uppercase text-[10px] mb-1">
                        TEMPORARY PASSWORD (MIN 8 CHARS)
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={temporaryPassInput}
                        onChange={(e) => setTemporaryPassInput(e.target.value)}
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#FFC700]"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setResetPassModalStaff(null)}
                        className="w-1/3 py-2.5 rounded-xl border border-[#E5DEC9] text-[#7A6A65] font-titan text-xs"
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        className="w-2/3 py-2.5 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#241311] font-titan text-xs shadow-md"
                      >
                        SET PASSWORD
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 10: Validation */}
        {activeTab === 'validation' && (
          <div className="p-4 sm:p-6 space-y-6 flex-1">
            <div className="bg-white p-5 rounded-3xl border border-[#E5DEC9] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center font-titan text-2xl">
                  🛡️
                </div>
                <div>
                  <h3 className="font-titan text-base text-[#4D080F]">
                    MENU & DATA INTEGRITY VERIFICATION
                  </h3>
                  <p className="text-xs text-gray-500 font-montserrat">
                    Continuous automated audit against unapproved terminology, price mismatches, and schema rules.
                  </p>
                </div>
              </div>

              <button
                onClick={handleCopyReport}
                className="px-3.5 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] text-xs font-montserrat font-bold flex items-center gap-1.5"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReport ? 'Report Copied!' : 'Export Report'}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
