import React, { useState, useEffect } from 'react';
import {
  Bike,
  Truck,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Sliders,
  ShieldCheck,
  Layers,
  ExternalLink,
  Plus,
  X,
  FileText,
  Printer,
  RotateCw,
  Navigation,
  Users,
  Banknote,
  CheckSquare,
  Square,
  MessageCircle,
  KeyRound,
  ArrowRight,
  Scan,
  Eye,
  EyeOff,
} from 'lucide-react';
import { BranchId, StaffAccount } from '../../types';
import { BarcodeDispatchScanner } from './BarcodeDispatchScanner';

export interface DispatchOperationsHubProps {
  activeBranchId: BranchId;
  currentStaff: StaffAccount;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DispatchOperationsHub: React.FC<DispatchOperationsHubProps> = ({
  activeBranchId,
  currentStaff,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'wholesale' | 'fleet'>('queue');
  const [tasks, setTasks] = useState<any[]>([]);
  const [wholesaleTasks, setWholesaleTasks] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Customer PIN Masking / Reveal State
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  const togglePinVisibility = async (taskId: string) => {
    if (!revealedPins[taskId]) {
      try {
        await fetch(`/api/dispatch/tasks/${taskId}/reveal-pin`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
      } catch (e) {
        console.error('Audit pin reveal error:', e);
      }
    }
    setRevealedPins((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // Batch Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [batchRiderId, setBatchRiderId] = useState<string>('');

  // OTP Verification Modal State
  const [selectedTaskForOtp, setSelectedTaskForOtp] = useState<any | null>(null);
  const [otpInput, setOtpInput] = useState<string>('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);

  // New Rider Registration Modal State
  const [isNewRiderModalOpen, setIsNewRiderModalOpen] = useState<boolean>(false);
  const [newRiderName, setNewRiderName] = useState<string>('');
  const [newRiderPhone, setNewRiderPhone] = useState<string>('');
  const [newRiderType, setNewRiderType] = useState<'internal_fleet' | 'external_partner'>('internal_fleet');
  const [newRiderPartner, setNewRiderPartner] = useState<string>('Choplife Fleet');
  const [newRiderBike, setNewRiderBike] = useState<string>('');

  // Remittance Slip Modal State
  const [remittanceSlipData, setRemittanceSlipData] = useState<any | null>(null);

  // Barcode / QR Dispatch Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerDefaultAction, setScannerDefaultAction] = useState<'pack' | 'pickup' | 'handover'>('pickup');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('choplife_staff_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // Fetch Delivery Tasks, Wholesale Bread Dispatch & Riders from API
  const fetchData = async () => {
    try {
      setLoading(true);
      const authHeaders = getAuthHeaders();
      const [tasksRes, wholesaleRes, ridersRes] = await Promise.all([
        fetch(`/api/dispatch/tasks?branchId=${activeBranchId}`, { headers: authHeaders, credentials: 'include' }),
        fetch(`/api/dispatch/wholesale?branchId=${activeBranchId}`, { headers: authHeaders, credentials: 'include' }),
        fetch(`/api/dispatch/riders?branchId=${activeBranchId}`, { headers: authHeaders, credentials: 'include' }),
      ]);

      if (tasksRes.ok) {
        const tData = await tasksRes.json();
        setTasks(Array.isArray(tData) ? tData : []);
      }
      if (wholesaleRes.ok) {
        const wData = await wholesaleRes.json();
        setWholesaleTasks(Array.isArray(wData) ? wData : []);
      }
      if (ridersRes.ok) {
        const rData = await ridersRes.json();
        setRiders(Array.isArray(rData) ? rData : []);
      }
    } catch (err) {
      console.error('[DISPATCH HUB] Failed to fetch dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWholesaleAssign = async (taskId: string, riderId: string) => {
    const rider = riders.find((r) => r.id === riderId);
    if (!rider) return;
    try {
      const res = await fetch(`/api/dispatch/wholesale/${taskId}/assign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          driverId: rider.id,
          driverName: rider.name,
          driverPhone: rider.phone,
          vehiclePlate: rider.bikeNumber || 'CHOPLIFE-VAN',
        }),
      });
      if (res.ok) {
        showToast(`Wholesale bread dispatch assigned to ${rider.name}`, 'success');
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to assign wholesale driver', 'error');
      }
    } catch {
      showToast('Failed to assign wholesale driver', 'error');
    }
  };

  const handleWholesaleStatusUpdate = async (taskId: string, status: string) => {
    try {
      const res = await fetch(`/api/dispatch/wholesale/${taskId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast(`Wholesale delivery status updated to ${status.replace(/_/g, ' ')}`, 'success');
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update wholesale status', 'error');
      }
    } catch {
      showToast('Failed to update wholesale status', 'error');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 12000);
    return () => clearInterval(interval);
  }, [activeBranchId]);

  // Unique Zones list from active tasks
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeRiders = Array.isArray(riders) ? riders : [];

  const uniqueZones = Array.from(
    new Set(safeTasks.map((t) => t.deliveryZone).filter(Boolean))
  );

  // Filtered Tasks
  const filteredTasks = safeTasks.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      t.orderNumber?.toLowerCase().includes(q) ||
      t.customerName?.toLowerCase().includes(q) ||
      t.customerPhone?.toLowerCase().includes(q) ||
      t.deliveryAddress?.toLowerCase().includes(q);

    const matchesZone = zoneFilter === 'all' || t.deliveryZone === zoneFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    return matchesSearch && matchesZone && matchesStatus;
  });

  // Toggle selection for batch assignment
  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPending = () => {
    const pendingIds = filteredTasks
      .filter((t) => t.status !== 'delivered' && t.status !== 'failed')
      .map((t) => t.id);
    if (selectedTaskIds.length === pendingIds.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(pendingIds);
    }
  };

  // Batch Assign Action
  const handleBatchAssign = async () => {
    if (selectedTaskIds.length === 0 || !batchRiderId) {
      showToast('Select deliveries and a rider first', 'error');
      return;
    }

    const rider = safeRiders.find((r) => r.id === batchRiderId);
    if (!rider) return;

    try {
      const res = await fetch('/api/dispatch/tasks/batch-assign', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          taskIds: selectedTaskIds,
          riderId: rider.id,
          riderName: rider.name,
        }),
      });

      if (res.ok) {
        showToast(
          `Batch assigned ${selectedTaskIds.length} orders to ${rider.name}`,
          'success'
        );
        setSelectedTaskIds([]);
        setBatchRiderId('');
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to batch assign', 'error');
      }
    } catch {
      showToast('Network error assigning batch', 'error');
    }
  };

  // Single Rider Assign
  const handleSingleAssign = async (taskId: string, riderId: string) => {
    const rider = safeRiders.find((r) => r.id === riderId);
    if (!rider) return;

    try {
      const res = await fetch(`/api/dispatch/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          riderId: rider.id,
          riderName: rider.name,
        }),
      });

      if (res.ok) {
        showToast(`Assigned to ${rider.name}`, 'success');
        fetchData();
      }
    } catch {
      showToast('Failed to assign rider', 'error');
    }
  };

  // Advance Task Status (e.g. out_for_delivery)
  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/dispatch/tasks/${taskId}/status`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        showToast(`Status updated to ${newStatus.replace('_', ' ')}`, 'success');
        fetchData();
      }
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  // Verify OTP Handover
  const handleVerifyOtp = async () => {
    if (!selectedTaskForOtp || !otpInput.trim()) {
      showToast('Please enter the 4-digit PIN', 'error');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await fetch(
        `/api/dispatch/tasks/${selectedTaskForOtp.id}/verify-otp`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify({ code: otpInput.trim() }),
        }
      );

      const data = await res.json();
      if (res.ok) {
        showToast(
          `Order #${selectedTaskForOtp.orderNumber} successfully delivered & verified!`,
          'success'
        );
        setSelectedTaskForOtp(null);
        setOtpInput('');
        fetchData();
      } else {
        showToast(data.error || 'Invalid Handover PIN', 'error');
      }
    } catch {
      showToast('Verification failed. Check network.', 'error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Remit Rider Cash (all unremitted COD orders for this rider)
  const handleRemitRiderCash = async (rider: any) => {
    const unremittedTasks = safeTasks.filter(
      (t) =>
        t.riderId === rider.id &&
        t.codAmountDue > 0 &&
        !t.cashRemitted &&
        (t.status === 'delivered' || t.status === 'arrived')
    );

    if (unremittedTasks.length === 0 && rider.cashInHand <= 0) {
      showToast(`No pending cash to remit for ${rider.name}`, 'info');
      return;
    }

    try {
      let totalRemitted = 0;
      for (const t of unremittedTasks) {
        const res = await fetch(`/api/dispatch/tasks/${t.id}/remit-cash`, {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (res.ok) {
          totalRemitted += t.codAmountCollected || t.codAmountDue || t.orderTotal;
        }
      }

      showToast(
        `Remitted ₦${totalRemitted.toLocaleString()} into Cashier Shift Till`,
        'success'
      );

      // Generate Slip Data
      setRemittanceSlipData({
        riderName: rider.name,
        bikeNumber: rider.bikeNumber || 'N/A',
        totalRemitted: totalRemitted > 0 ? totalRemitted : rider.cashInHand,
        ordersCount: unremittedTasks.length,
        cashierName: currentStaff.name,
        timestamp: new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }),
        branchId: activeBranchId,
      });

      fetchData();
    } catch {
      showToast('Error during cash remittance', 'error');
    }
  };

  // Register New Rider
  const handleRegisterRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiderName.trim() || !newRiderPhone.trim()) {
      showToast('Rider name and phone are required', 'error');
      return;
    }

    try {
      const res = await fetch('/api/dispatch/riders', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          name: newRiderName.trim(),
          phone: newRiderPhone.trim(),
          branchId: activeBranchId,
          type: newRiderType,
          partnerName: newRiderType === 'external_partner' ? newRiderPartner : 'Choplife Fleet',
          bikeNumber: newRiderBike.trim(),
          currentStatus: 'available',
        }),
      });

      if (res.ok) {
        showToast(`Rider "${newRiderName}" registered successfully!`, 'success');
        setIsNewRiderModalOpen(false);
        setNewRiderName('');
        setNewRiderPhone('');
        setNewRiderBike('');
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to add rider', 'error');
      }
    } catch {
      showToast('Network error registering rider', 'error');
    }
  };

  // Pre-formatted WhatsApp dispatch brief link
  const getWhatsAppDispatchLink = (task: any) => {
    const text = `🛵 *CHOPLIFE DISPATCH BRIEF*\nOrder: *#${task.orderNumber}*\nCustomer: *${task.customerName}* (${task.customerPhone})\nAddress: *${task.deliveryAddress}*\nLandmark: *${task.landmark || 'None'}*\nZone: *${task.deliveryZone}*\nPayment: *${task.paymentMethod === 'cash_on_delivery' ? `CASH TO COLLECT ₦${task.orderTotal?.toLocaleString()}` : 'PRE-PAID (NO CASH)'}*\nHandover PIN: *${task.pickupAuthorizationCode || 'N/A'}*\n\nPlease confirm pickup from branch kitchen!`;
    const cleanPhone = (task.customerPhone || '').replace(/\D/g, '').replace(/^0/, '234');
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // Metrics calculation
  const totalPending = safeTasks.filter((t) => t.status !== 'delivered' && t.status !== 'failed').length;
  const totalOutForDelivery = safeTasks.filter((t) => t.status === 'out_for_delivery').length;
  const totalDeliveredToday = safeTasks.filter((t) => t.status === 'delivered').length;
  const totalCodPendingTill = safeTasks
    .filter((t) => t.codAmountDue > 0 && !t.cashRemitted && t.status === 'delivered')
    .reduce((sum, t) => sum + (t.codAmountDue || t.orderTotal || 0), 0);

  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs font-montserrat bg-[#FAF7F2] text-stone-900">
      {/* 1. Header & Live Telemetry Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5DEC9] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-[#4D080F]">Dispatch Hub &amp; Route Management</h2>
            <span className="bg-[#4D080F] text-[#FFC700] text-[10px] font-titan uppercase px-2.5 py-0.5 rounded-full">
              Live Fleet
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Zone clustering, smart multi-drop batching, 4-digit OTP handover &amp; Cash on Delivery (COD) cashier till remittance
          </p>
        </div>

        {/* Tab Controls & Add Rider Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-[#FAF7F2] p-1 rounded-xl border border-[#E5DEC9] flex items-center">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'queue'
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-2xs'
                  : 'text-stone-600 hover:text-[#4D080F]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Meal Queue ({totalPending})</span>
            </button>
            <button
              onClick={() => setActiveTab('wholesale')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'wholesale'
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-2xs'
                  : 'text-stone-600 hover:text-[#4D080F]'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Wholesale Bread ({wholesaleTasks.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('fleet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'fleet'
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-2xs'
                  : 'text-stone-600 hover:text-[#4D080F]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Rider Fleet ({safeRiders.length})</span>
            </button>
          </div>

          <button
            onClick={() => {
              setScannerDefaultAction('pickup');
              setIsScannerOpen(true);
            }}
            className="px-3.5 py-2 bg-[#FFC700] hover:bg-amber-400 text-[#4D080F] font-titan rounded-xl flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            title="Open Optical & Hardware Barcode Scanner"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Scan Barcode</span>
          </button>

          <button
            onClick={() => setIsNewRiderModalOpen(true)}
            className="px-3 py-2 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Rider</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2 bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#4D080F] border border-[#E5DEC9] rounded-xl transition-all"
            title="Refresh Dispatch Board"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Key Telemetry Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5DEC9] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] text-stone-500 uppercase font-semibold">Pending Pickup</p>
            <p className="text-xl font-black text-amber-600 font-mono">{totalPending}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#E5DEC9] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] text-stone-500 uppercase font-semibold">On The Road</p>
            <p className="text-xl font-black text-blue-600 font-mono">{totalOutForDelivery}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#E5DEC9] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] text-stone-500 uppercase font-semibold">Delivered Today</p>
            <p className="text-xl font-black text-emerald-700 font-mono">{totalDeliveredToday}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#E5DEC9] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] text-stone-500 uppercase font-semibold">Unremitted COD</p>
            <p className="text-xl font-black text-red-600 font-mono">
              ₦{totalCodPendingTill.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center">
            <Banknote className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB: WHOLESALE BREAD DISPATCH QUEUE */}
      {/* =================================================================== */}
      {activeTab === 'wholesale' && (
        <div className="bg-white border border-[#E5DEC9] rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-3 bg-[#FAF7F2] border-b border-[#E5DEC9] flex items-center justify-between">
            <div>
              <h3 className="font-black text-sm text-[#4D080F] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#E62E00]" />
                Wholesale Bread Dispatch &amp; Logistics Manifest
              </h3>
              <p className="text-[11px] text-stone-500">
                Dedicated wholesale bakery distribution queue separated from ordinary restaurant meal delivery
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
              {wholesaleTasks.length} Wholesale Consignment(s)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F2] border-b border-[#E5DEC9] text-[#4D080F] uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-3">Order #</th>
                  <th className="p-3">Wholesale Customer</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3">Bread Items &amp; Crates</th>
                  <th className="p-3">Assigned Driver / Van</th>
                  <th className="p-3">Payment / Total</th>
                  <th className="p-3">Dispatch Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {wholesaleTasks.length > 0 ? (
                  wholesaleTasks.map((wt) => (
                    <tr key={wt.id} className="hover:bg-[#FAF7F2]/60">
                      <td className="p-3 font-mono font-bold text-[#4D080F]">{wt.orderNumber}</td>
                      <td className="p-3">
                        <p className="font-bold text-stone-900">{wt.customerName}</p>
                        <p className="text-[11px] text-stone-500">{wt.customerPhone}</p>
                      </td>
                      <td className="p-3 max-w-xs">
                        <p className="font-medium text-stone-900 truncate">{wt.deliveryAddress}</p>
                        <span className="text-[10px] text-stone-500">{wt.deliveryZone}</span>
                      </td>
                      <td className="p-3">
                        {Array.isArray(wt.itemsSummary) && wt.itemsSummary.length > 0 ? (
                          <div className="space-y-0.5">
                            {wt.itemsSummary.map((it: any, idx: number) => (
                              <div key={idx} className="text-[11px] font-semibold text-stone-800">
                                {it.quantity}x {it.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-400">Wholesale Bread Consignment</span>
                        )}
                      </td>
                      <td className="p-3">
                        {wt.riderName ? (
                          <div>
                            <p className="font-bold text-stone-900">{wt.riderName}</p>
                            {wt.vehiclePlate && (
                              <span className="text-[10px] font-mono text-stone-500">{wt.vehiclePlate}</span>
                            )}
                            <select
                              onChange={(e) => {
                                if (e.target.value) handleWholesaleAssign(wt.id, e.target.value);
                              }}
                              defaultValue=""
                              className="mt-1 block bg-[#FAF7F2] border border-[#E5DEC9] text-[10px] text-stone-600 rounded px-1.5 py-0.5"
                            >
                              <option value="" disabled>Reassign Driver...</option>
                              {safeRiders.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <select
                            onChange={(e) => {
                              if (e.target.value) handleWholesaleAssign(wt.id, e.target.value);
                            }}
                            defaultValue=""
                            className="bg-amber-50 border border-amber-300 text-xs font-bold text-[#4D080F] rounded-lg px-2 py-1"
                          >
                            <option value="" disabled>Assign Driver...</option>
                            {safeRiders.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="p-3">
                        <p className="font-mono font-bold text-stone-900">₦{Number(wt.orderTotal || 0).toLocaleString()}</p>
                        <span className="text-[10px] uppercase font-bold text-emerald-700">{wt.paymentStatus || 'paid'}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-900">
                          {String(wt.status || 'pending').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {wt.status !== 'out_for_delivery' && wt.status !== 'delivered' && (
                          <button
                            onClick={() => handleWholesaleStatusUpdate(wt.id, 'out_for_delivery')}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[10px]"
                          >
                            Dispatch Van
                          </button>
                        )}
                        {wt.status !== 'delivered' && (
                          <button
                            onClick={() => handleWholesaleStatusUpdate(wt.id, 'delivered')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px]"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-stone-400">
                      No wholesale bread dispatch consignments queued for this branch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: ACTIVE DISPATCH QUEUE & ROUTE BATCHING */}
      {/* =================================================================== */}
      {activeTab === 'queue' && (
        <div className="space-y-3">
          {/* Controls Bar: Search, Zone Clustering Filter, Status Filter */}
          <div className="bg-white p-3 rounded-2xl border border-[#E5DEC9] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search order #, customer, phone, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl pl-9 pr-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#4D080F]"
                />
              </div>

              {/* Zone Cluster Filter */}
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#4D080F]"
              >
                <option value="all">All Zones ({uniqueZones.length})</option>
                {uniqueZones.map((z) => (
                  <option key={z} value={z}>
                    Zone: {z}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#4D080F]"
              >
                <option value="all">All Statuses</option>
                <option value="assigned">Assigned</option>
                <option value="accepted">Kitchen Ready / Accepted</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>

            {/* Smart Batch Assignment Controls */}
            {selectedTaskIds.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-2">
                <span className="text-xs font-bold text-[#4D080F]">
                  {selectedTaskIds.length} Selected
                </span>
                <select
                  value={batchRiderId}
                  onChange={(e) => setBatchRiderId(e.target.value)}
                  className="bg-white border border-[#E5DEC9] rounded-lg px-2 py-1 text-xs text-stone-900 focus:outline-none"
                >
                  <option value="">Choose Rider to Batch...</option>
                  {safeRiders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.bikeNumber || r.type})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBatchAssign}
                  className="px-3 py-1 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-bold rounded-lg transition-all"
                >
                  Batch Assign
                </button>
              </div>
            )}
          </div>

          {/* Orders Table */}
          <div className="bg-white border border-[#E5DEC9] rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF7F2] border-b border-[#E5DEC9] text-[#4D080F] uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-3 w-8 text-center">
                      <button
                        onClick={handleSelectAllPending}
                        className="text-stone-400 hover:text-[#4D080F]"
                        title="Select all pending"
                      >
                        {selectedTaskIds.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-[#4D080F]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3">Order / Auth</th>
                    <th className="p-3">Customer Details</th>
                    <th className="p-3">Address / Zone</th>
                    <th className="p-3">Rider Fleet</th>
                    <th className="p-3">Payment / COD</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map((t) => {
                      const isSelected = selectedTaskIds.includes(t.id);
                      const isCod = t.paymentMethod === 'cash_on_delivery';

                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-[#FAF7F2]/60 transition-colors ${
                            isSelected ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="p-3 text-center">
                            <button
                              onClick={() => toggleSelectTask(t.id)}
                              className="text-stone-400 hover:text-[#4D080F]"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-[#4D080F]" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* Order & Handover PIN */}
                          <td className="p-3">
                            <p className="font-mono font-bold text-[#4D080F] text-sm">
                              {t.orderNumber}
                            </p>
                            <div className="inline-flex items-center gap-1.5 mt-0.5 px-2 py-0.5 bg-[#FAF7F2] rounded border border-[#E5DEC9] text-[10px] font-mono text-stone-600">
                              <KeyRound className="w-2.5 h-2.5 text-[#4D080F]" />
                              <span>PIN:</span>
                              <strong className="tracking-widest font-mono text-[#4D080F]">
                                {revealedPins[t.id] ? t.pickupAuthorizationCode || '---' : '••••'}
                              </strong>
                              <button
                                type="button"
                                onClick={() => togglePinVisibility(t.id)}
                                title={revealedPins[t.id] ? 'Hide customer PIN' : 'Reveal customer PIN (authorized staff only)'}
                                className="ml-1 text-stone-400 hover:text-[#4D080F] transition-colors focus:outline-none"
                              >
                                {revealedPins[t.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="p-3">
                            <p className="font-bold text-stone-900">{t.customerName}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                              <a
                                href={`tel:${t.customerPhone}`}
                                className="hover:text-[#4D080F] flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3 text-[#4D080F]" />
                                <span>{t.customerPhone}</span>
                              </a>
                            </div>
                          </td>

                          {/* Address & Zone */}
                          <td className="p-3 max-w-xs">
                            <p className="text-stone-900 truncate font-medium">
                              {t.deliveryAddress}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="bg-[#FAF7F2] text-stone-600 px-2 py-0.5 rounded text-[10px] border border-[#E5DEC9]">
                                {t.deliveryZone || 'Standard'}
                              </span>
                              {t.landmark && (
                                <span className="text-[10px] text-[#4D080F] font-semibold truncate">
                                  Near: {t.landmark}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Assigned Rider */}
                          <td className="p-3">
                            {t.riderName ? (
                              <div>
                                <p className="font-bold text-stone-900 flex items-center gap-1">
                                  <Bike className="w-3.5 h-3.5 text-[#4D080F]" />
                                  <span>{t.riderName}</span>
                                </p>
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) handleSingleAssign(t.id, e.target.value);
                                  }}
                                  defaultValue=""
                                  className="mt-1 bg-[#FAF7F2] border border-[#E5DEC9] text-[10px] text-stone-600 rounded px-1.5 py-0.5 focus:outline-none"
                                >
                                  <option value="" disabled>
                                    Reassign...
                                  </option>
                                  {safeRiders.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) handleSingleAssign(t.id, e.target.value);
                                }}
                                defaultValue=""
                                className="bg-[#FAF7F2] border border-[#E5DEC9] text-[11px] text-[#4D080F] font-bold rounded-lg px-2.5 py-1.5 focus:outline-none"
                              >
                                <option value="" disabled>
                                  + Assign Rider...
                                </option>
                                {safeRiders.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} ({r.bikeNumber || r.type})
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>

                          {/* Payment & COD */}
                          <td className="p-3 font-mono">
                            <p className="text-stone-900 font-bold">
                              ₦{Number(t.orderTotal || 0).toLocaleString()}
                            </p>
                            {isCod ? (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold rounded">
                                COD: ₦{Number(t.codAmountDue || t.orderTotal).toLocaleString()}
                              </span>
                            ) : (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded">
                                ✓ Paid Online
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                t.status === 'delivered'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : t.status === 'out_for_delivery'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {t.status.replace('_', ' ')}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                            <a
                              href={getWhatsAppDispatchLink(t)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg inline-flex items-center justify-center transition-all"
                              title="Share Dispatch Brief via WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>

                            {t.status === 'assigned' && (
                              <button
                                onClick={() => handleUpdateStatus(t.id, 'out_for_delivery')}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] shadow-2xs transition-all"
                              >
                                Dispatch ➔
                              </button>
                            )}

                            {t.status === 'out_for_delivery' && (
                              <button
                                onClick={() => {
                                  setSelectedTaskForOtp(t);
                                  setOtpInput('');
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] shadow-2xs transition-all"
                              >
                                Verify OTP &amp; Deliver
                              </button>
                            )}

                            {t.status === 'delivered' && isCod && !t.cashRemitted && (
                              <span className="text-[10px] text-red-600 font-bold">
                                COD Pending Till
                              </span>
                            )}

                            {t.status === 'delivered' && (!isCod || t.cashRemitted) && (
                              <span className="text-[10px] text-emerald-700 font-bold">
                                ✓ Completed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-stone-400">
                        No delivery tasks match the current search &amp; filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: RIDER FLEET ROSTER & COD TILL REMITTANCE */}
      {/* =================================================================== */}
      {activeTab === 'fleet' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {safeRiders.map((r) => {
              const riderTasks = safeTasks.filter((t) => t.riderId === r.id);
              const activeCount = riderTasks.filter(
                (t) => t.status === 'assigned' || t.status === 'out_for_delivery'
              ).length;
              const pendingCodTasks = riderTasks.filter(
                (t) =>
                  t.codAmountDue > 0 &&
                  !t.cashRemitted &&
                  (t.status === 'delivered' || t.status === 'out_for_delivery')
              );
              const unremittedCash = pendingCodTasks.reduce(
                (sum, t) => sum + (t.codAmountCollected || t.codAmountDue || 0),
                0
              );

              return (
                <div
                  key={r.id}
                  className="bg-white border border-[#E5DEC9] rounded-2xl p-4 flex flex-col justify-between shadow-2xs space-y-4 hover:border-[#4D080F]/40 transition-all"
                >
                  <div className="space-y-3">
                    {/* Top Row: Name & Status */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex items-center justify-center text-[#4D080F]">
                          <Bike className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-stone-900 text-sm">{r.name}</h3>
                          <p className="text-[10px] text-stone-500">
                            {r.type === 'internal_fleet' ? 'Internal Fleet' : r.partnerName || 'Partner Courier'}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.currentStatus === 'available'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {r.currentStatus || 'available'}
                      </span>
                    </div>

                    {/* Bike & Phone Info */}
                    <div className="grid grid-cols-2 gap-2 bg-[#FAF7F2] p-2.5 rounded-xl border border-[#E5DEC9] text-[11px]">
                      <div>
                        <span className="text-[9px] text-stone-500 uppercase block">Bike Number</span>
                        <span className="font-mono font-bold text-stone-900">
                          {r.bikeNumber || 'NO PLATE'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-stone-500 uppercase block">Contact</span>
                        <a
                          href={`tel:${r.phone}`}
                          className="font-bold text-[#4D080F] hover:underline"
                        >
                          {r.phone}
                        </a>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#E5DEC9]">
                        <p className="text-[9px] text-stone-500 uppercase">Active Drops</p>
                        <p className="font-mono font-bold text-sm text-blue-600">{activeCount}</p>
                      </div>
                      <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#E5DEC9]">
                        <p className="text-[9px] text-stone-500 uppercase">Today Done</p>
                        <p className="font-mono font-bold text-sm text-emerald-700">
                          {r.totalDeliveriesToday || riderTasks.filter((t) => t.status === 'delivered').length}
                        </p>
                      </div>
                      <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#E5DEC9]">
                        <p className="text-[9px] text-stone-500 uppercase">Cash In Hand</p>
                        <p className="font-mono font-bold text-sm text-red-600">
                          ₦{(unremittedCash > 0 ? unremittedCash : r.cashInHand || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Remittance Action */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-[10px] text-stone-500">
                      {pendingCodTasks.length} pending COD slip(s)
                    </span>

                    <button
                      onClick={() => handleRemitRiderCash(r)}
                      disabled={unremittedCash <= 0 && r.cashInHand <= 0}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Remit to Till</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. MODAL: 4-DIGIT DELIVERY HANDOVER OTP VERIFICATION */}
      {/* =================================================================== */}
      {selectedTaskForOtp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#4D080F]" />
                <h3 className="font-black text-[#4D080F] text-base">
                  Verify Delivery Handover PIN
                </h3>
              </div>
              <button
                onClick={() => setSelectedTaskForOtp(null)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Ask customer <strong className="text-stone-900">{selectedTaskForOtp.customerName}</strong> for their 4-digit Handover PIN displayed on their live order tracker to authorize handover.
            </p>

            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-stone-500">Order Number:</span>
                <span className="font-mono font-bold text-[#4D080F]">
                  {selectedTaskForOtp.orderNumber}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-stone-500">Delivery Address:</span>
                <span className="text-stone-900 truncate max-w-xs">
                  {selectedTaskForOtp.deliveryAddress}
                </span>
              </div>
              {selectedTaskForOtp.codAmountDue > 0 && (
                <div className="flex justify-between text-xs pt-2 border-t border-[#E5DEC9]">
                  <span className="text-red-600 font-bold">COD Cash to Collect:</span>
                  <span className="font-mono font-bold text-red-600 text-sm">
                    ₦{selectedTaskForOtp.codAmountDue.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* OTP Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-stone-500 uppercase font-bold">
                ENTER 4-DIGIT PIN:
              </label>
              <input
                type="text"
                maxLength={4}
                placeholder="e.g. 4821"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                autoFocus
                className="w-full text-center font-mono font-black text-3xl tracking-[0.4em] py-3 bg-[#FAF7F2] border-2 border-[#E5DEC9] focus:border-[#4D080F] rounded-2xl text-[#4D080F] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTaskForOtp(null)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={isVerifyingOtp || otpInput.length < 4}
                className="flex-1 py-2.5 bg-[#4D080F] hover:bg-[#3A050A] disabled:opacity-50 text-[#FFC700] font-bold rounded-xl shadow-xs transition-all"
              >
                {isVerifyingOtp ? 'Verifying...' : 'Authorize Delivery ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. MODAL: REGISTER NEW RIDER */}
      {/* =================================================================== */}
      {isNewRiderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-[#4D080F]" />
                <h3 className="font-black text-[#4D080F] text-base">
                  Register New Fleet Rider
                </h3>
              </div>
              <button
                onClick={() => setIsNewRiderModalOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterRider} className="space-y-3">
              <div>
                <label className="text-[10px] text-stone-500 uppercase font-bold block mb-1">
                  Rider Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Osaro Ikhide"
                  value={newRiderName}
                  onChange={(e) => setNewRiderName(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#4D080F]"
                />
              </div>

              <div>
                <label className="text-[10px] text-stone-500 uppercase font-bold block mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +234 803 123 4567"
                  value={newRiderPhone}
                  onChange={(e) => setNewRiderPhone(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#4D080F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-stone-500 uppercase font-bold block mb-1">
                    Fleet Type
                  </label>
                  <select
                    value={newRiderType}
                    onChange={(e) => setNewRiderType(e.target.value as any)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#4D080F]"
                  >
                    <option value="internal_fleet">Internal Fleet</option>
                    <option value="external_partner">Courier Partner</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase font-bold block mb-1">
                    Bike Plate No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BEN-334-ED"
                    value={newRiderBike}
                    onChange={(e) => setNewRiderBike(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#4D080F]"
                  />
                </div>
              </div>

              {newRiderType === 'external_partner' && (
                <div>
                  <label className="text-[10px] text-stone-500 uppercase font-bold block mb-1">
                    Partner Service Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chowdeck / Gokada / Max.ng / Bolt"
                    value={newRiderPartner}
                    onChange={(e) => setNewRiderPartner(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#4D080F]"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewRiderModalOpen(false)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-bold rounded-xl shadow-xs transition-all"
                >
                  Register Rider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. MODAL: PRINTABLE COD CASHIER REMITTANCE SLIP */}
      {/* =================================================================== */}
      {remittanceSlipData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 font-mono">
            <div className="text-center border-b pb-3 space-y-1">
              <h2 className="font-titan text-lg tracking-wider text-[#4D080F]">
                CHOPLIFE REPUBLIC
              </h2>
              <p className="text-[10px] uppercase text-gray-600">
                Official Rider COD Cash Remittance Slip
              </p>
              <p className="text-[9px] text-gray-500">
                Branch: {remittanceSlipData.branchId.toUpperCase()} Flagship Hub
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Date/Time:</span>
                <span className="font-bold">{remittanceSlipData.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rider Name:</span>
                <span className="font-bold">{remittanceSlipData.riderName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bike No:</span>
                <span className="font-bold">{remittanceSlipData.bikeNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cashier Sign-off:</span>
                <span className="font-bold">{remittanceSlipData.cashierName}</span>
              </div>
              <div className="flex justify-between pt-2 border-t text-sm font-bold">
                <span>TOTAL REMITTED:</span>
                <span className="text-[#E62E00]">
                  ₦{Number(remittanceSlipData.totalRemitted).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-gray-100 p-3 rounded-xl text-[10px] text-gray-600 text-center">
              ✓ Tender credited into active Cashier Shift Till &amp; verified in safe ledger.
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-gray-900 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
              <button
                onClick={() => setRemittanceSlipData(null)}
                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode / QR Optical & Hardware Wedge Scanner Modal */}
      <BarcodeDispatchScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        activeBranchId={activeBranchId}
        defaultAction={scannerDefaultAction}
        onScanSuccess={(result) => {
          showToast(`Barcode verified: ${result.message}`, 'success');
          fetchData();
        }}
      />
    </div>
  );
};
