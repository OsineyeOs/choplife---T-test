import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BranchId, POSPayment } from '../../types';
import { KitchenDisplaySystem } from './KitchenDisplaySystem';
import { ShiftZReportModal } from './ShiftZReportModal';
import { OfflineSyncBar } from './OfflineSyncBar';
import { CustomerDisplayModal } from './CustomerDisplayModal';
import { usePOSCart } from '../../hooks/pos/usePOSCart';
import { usePOSCustomerLoyalty } from '../../hooks/pos/usePOSCustomerLoyalty';
import { usePOSPayment } from '../../hooks/pos/usePOSPayment';
import { usePOSPrinter } from '../../hooks/pos/usePOSPrinter';
import { POSPaymentModal } from './modals/POSPaymentModal';
import { POSReceiptModal } from './modals/POSReceiptModal';
import { POSHardwareModal } from './modals/POSHardwareModal';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  Bike,
  ShoppingBag,
  Building,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  User,
  MapPin,
  Search,
  CheckCircle2,
  Printer,
  Sparkles,
  UtensilsCrossed,
  Tag,
  Clock,
  Send,
  Coffee,
  ChefHat,
  Calculator,
  Split,
  Layers,
  Award,
  Wallet,
  Check,
  KeyRound,
  Lock,
  Wifi,
  WifiOff,
  RefreshCw,
  Sliders,
  Smartphone,
  MessageSquare,
  Scan,
  Monitor,
} from 'lucide-react';

export const StaffPosModal: React.FC = () => {
  const {
    isStaffPosOpen,
    setIsStaffPosOpen,
    products,
    branches,
    selectedBranchId,
    currentStaff,
    staffUsers,
    setCurrentStaff,
    loginStaffWithPin,
    createPOSOrder,
    heldTickets,
    holdCurrentPOSTicket,
    restoreHeldTicket,
    deleteHeldTicket,
    formatNaira,
    getProductPrice,
    isProductAvailable,
    offlineQueueCount,
    isOnline,
    syncOfflineQueue,
    riders,
  } = useApp();

  // Offline Sync State
  const [isSyncingQueue, setIsSyncingQueue] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleSyncOffline = async () => {
    setIsSyncingQueue(true);
    try {
      const res = await syncOfflineQueue();
      if (res.syncedCount > 0) {
        setSyncToast(`Synced ${res.syncedCount} offline POS order(s) to cloud!`);
        setTimeout(() => setSyncToast(null), 3000);
      } else {
        setSyncToast('All POS orders are already synchronized.');
        setTimeout(() => setSyncToast(null), 2200);
      }
    } finally {
      setIsSyncingQueue(false);
    }
  };

  // POS State
  const [posBranchId, setPosBranchId] = useState<BranchId>(selectedBranchId);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const {
    posItems,
    setPosItems,
    addItem,
    updateQuantity,
    setDirectQuantity,
    clearCart,
    subtotal,
    packagingFee,
    posDeliveryFee,
    setPosDeliveryFee,
    totalDiscount,
    grandTotal,
    discountPercent,
    setDiscountPercent,
    customDiscountAmount,
    setCustomDiscountAmount,
    redeemedChopPoints,
    setRedeemedChopPoints,
    isPackagingIncluded,
    setIsPackagingIncluded,
  } = usePOSCart();

  const [orderType, setOrderType] = useState<'dine-in' | 'pickup' | 'delivery'>('dine-in');
  const [tableNumber, setTableNumber] = useState<string>('Table 01');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Delivery Specific States
  const POS_DELIVERY_ZONES = [
    { name: 'GRA Benin / Boundary Rd', fee: 1200 },
    { name: 'Airport Road / Oko', fee: 1500 },
    { name: 'Ring Road / City Center', fee: 1500 },
    { name: 'Okabere / Sapele Rd', fee: 1800 },
    { name: 'Ugbowo / UNIBEN Campus', fee: 2000 },
    { name: 'Ikpoba Hill / Ramat Park', fee: 2200 },
    { name: 'Ekenwan / Campus 2', fee: 2200 },
    { name: 'Aduwawa / Bypass', fee: 2500 },
    { name: 'Custom Distance / Dispatch', fee: 1500 },
  ];

  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryZone, setDeliveryZone] = useState<string>('GRA Benin / Boundary Rd');
  const [deliveryPhone, setDeliveryPhone] = useState<string>('');
  const [deliveryRiderType, setDeliveryRiderType] = useState<'internal_fleet' | 'external_partner'>('internal_fleet');
  const [assignedRiderId, setAssignedRiderId] = useState<string>('');

  const safeRiders = Array.isArray(riders) ? riders : [];

  const handleSelectOrderType = (type: 'dine-in' | 'pickup' | 'delivery') => {
    setOrderType(type);
    if (type === 'delivery') {
      const matched = POS_DELIVERY_ZONES.find((z) => z.name === deliveryZone) || POS_DELIVERY_ZONES[0];
      setPosDeliveryFee(matched.fee);
    } else {
      setPosDeliveryFee(0);
    }
  };

  const handleZoneChange = (zoneName: string) => {
    setDeliveryZone(zoneName);
    const matched = POS_DELIVERY_ZONES.find((z) => z.name === zoneName);
    if (matched) {
      setPosDeliveryFee(matched.fee);
    }
  };

  const {
    isMemberLookupOpen,
    setIsMemberLookupOpen,
    memberSearchTerm,
    setMemberSearchTerm,
    registeredCustomers,
    selectedCustomer,
    setSelectedCustomer,
    registeredHouseAccounts,
    selectedHouseAccount,
    setSelectedHouseAccount,
    isLoadingMembers,
    walletPin,
    setWalletPin,
    walletError,
    setWalletError,
    fetchMembers,
    resetSelection,
  } = usePOSCustomerLoyalty();

  // Payment Modal State
  const {
    isPaymentOpen,
    setIsPaymentOpen,
    paymentMethod,
    setPaymentMethod,
    cashTendered,
    setCashTendered,
    bankRef,
    setBankRef,
    posRrn,
    setPosRrn,
    splitCash,
    setSplitCash,
    splitPos,
    setSplitPos,
    resetPaymentState,
    processPayment,
    chargeWallet,
    chargeHouseAccount,
  } = usePOSPayment();

  // Receipt / Success State
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [receiptMode, setReceiptMode] = useState<'customer' | 'kitchen'>('customer');
  const {
    isPrinting,
    printError,
    printReceipt,
    printKitchenTicket,
    openCashDrawer,
  } = usePOSPrinter();

  const [isHardwarePrinterModalOpen, setIsHardwarePrinterModalOpen] = useState<boolean>(false);
  const [isPosScannerOpen, setIsPosScannerOpen] = useState<boolean>(false);
  const [isHardwareManagerOpen, setIsHardwareManagerOpen] = useState<boolean>(false);
  const [eReceiptPhone, setEReceiptPhone] = useState<string>('');
  const [isSendingEReceipt, setIsSendingEReceipt] = useState<boolean>(false);
  const [eReceiptStatus, setEReceiptStatus] = useState<string | null>(null);

  const handleSendDigitalReceipt = async (channel: 'sms' | 'whatsapp' | 'both') => {
    if (!completedOrder || !eReceiptPhone.trim()) {
      setEReceiptStatus('Enter phone number');
      return;
    }
    setIsSendingEReceipt(true);
    setEReceiptStatus(null);
    try {
      const res = await fetch('/api/notifications/send-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('choplife_staff_token') || ''}`,
        },
        body: JSON.stringify({
          orderNumber: completedOrder.orderNumber,
          customerPhone: eReceiptPhone.trim(),
          customerName: completedOrder.deliveryDetails?.customerName || 'Valued Customer',
          channel,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEReceiptStatus(`Receipt sent via ${channel === 'both' ? 'SMS & WhatsApp' : channel.toUpperCase()}!`);
        setTimeout(() => setEReceiptStatus(null), 4000);
      } else {
        setEReceiptStatus(data.error || 'Failed to send receipt');
      }
    } catch {
      setEReceiptStatus('Network error sending receipt');
    } finally {
      setIsSendingEReceipt(false);
    }
  };

  // Held ticket popup
  const [isHoldTrayOpen, setIsHoldTrayOpen] = useState<boolean>(false);
  const [holdNote, setHoldNote] = useState<string>('');

  // Phase 3 Extensions: KDS, Shift Z-Report, Split-Bill & Table Selector
  const [isKdsViewOpen, setIsKdsViewOpen] = useState<boolean>(false);
  const [isZReportOpen, setIsZReportOpen] = useState<boolean>(false);
  const [isSplitBillOpen, setIsSplitBillOpen] = useState<boolean>(false);
  const [splitGuestCount, setSplitGuestCount] = useState<number>(2);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState<boolean>(false);
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState<boolean>(false);

  // Quick Server / Cashier PIN Switcher State
  const [isSwitchStaffOpen, setIsSwitchStaffOpen] = useState<boolean>(false);
  const [switchPin, setSwitchPin] = useState<string>('');
  const [switchPinError, setSwitchPinError] = useState<string>('');
  const [isSwitchingStaff, setIsSwitchingStaff] = useState<boolean>(false);
  const [switchSuccessMsg, setSwitchSuccessMsg] = useState<string>('');

  const handleSwitchStaffPin = async (pinToUse?: string) => {
    const pin = pinToUse || switchPin;
    if (!pin || pin.length < 4) {
      setSwitchPinError('Please enter a 4-digit staff PIN.');
      return;
    }
    setIsSwitchingStaff(true);
    setSwitchPinError('');
    try {
      const res = await loginStaffWithPin(pin, posBranchId);
      if (res.success && res.staff) {
        setSwitchSuccessMsg(`Switched to ${res.staff.name}`);
        setTimeout(() => {
          setIsSwitchStaffOpen(false);
          setSwitchPin('');
          setSwitchSuccessMsg('');
        }, 800);
      } else {
        setSwitchPinError(res.error || 'Invalid PIN. Access denied.');
        setSwitchPin('');
      }
    } catch {
      setSwitchPinError('Could not authenticate. Please try again.');
    } finally {
      setIsSwitchingStaff(false);
    }
  };

  // Web Audio Synthesizer: Authentic POS Cash Drawer Bell & Mechanical Release
  const playCashDrawerChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      // Tone 1: High metallic bell ding (1046Hz -> 2093Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046, now);
      osc1.frequency.exponentialRampToValueAtTime(2093, now + 0.15);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Tone 2: Spring-loaded drawer clink (180Hz -> 80Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(200, now + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.28);
      gain2.gain.setValueAtTime(0.3, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.32);
    } catch (e) {
      console.warn('Audio context error:', e);
    }
  };


  if (!isStaffPosOpen) return null;

  const currentBranch = branches.find((b) => b.id === posBranchId) || branches[0];

  // Filtering products for POS (strictly excluding paused/inactive/archived items)
  const filteredProducts = products.filter((p) => {
    if ((p.status && p.status !== 'published') || (p as any).isActive === false) return false;
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Cart and Discount Logic provided by usePOSCart hook


  // Cash change calculation
  const numericTendered = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, numericTendered - grandTotal);



  // Hold / Park Order
  const handleHoldOrder = () => {
    if (posItems.length === 0) return;
    const ticketName = `${tableNumber || customerName} - ${posItems.length} items (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    holdCurrentPOSTicket(ticketName, posItems, posBranchId, customerName, tableNumber);
    clearCart(resetSelection);
    setIsHoldTrayOpen(false);
  };

  // Retrieve Held Order
  const handleRestoreTicket = (ticketId: string) => {
    const ticket = restoreHeldTicket(ticketId);
    if (ticket) {
      setPosItems(ticket.items);
      setPosBranchId(ticket.branchId);
      if (ticket.customerName) setCustomerName(ticket.customerName);
      if (ticket.tableNumber) setTableNumber(ticket.tableNumber);
      setIsHoldTrayOpen(false);
    }
  };

  // Finalize Payment & Order Creation
  const handleCompletePOSSale = async () => {
    if (posItems.length === 0) return;

    // Wallet Payment Validation
    if (paymentMethod === 'wallet') {
      if (!selectedCustomer) {
        setWalletError('Please select a registered customer to charge digital wallet.');
        return;
      }
      if ((selectedCustomer.walletBalance || 0) < grandTotal) {
        setWalletError(`Insufficient wallet balance (Available: ${formatNaira(selectedCustomer.walletBalance || 0)})`);
        return;
      }
      setWalletError('');
    }

    // Corporate House Account Validation
    if (paymentMethod === 'house_account') {
      if (!selectedHouseAccount) {
        setWalletError('Please select a corporate house account.');
        return;
      }
      const avail = selectedHouseAccount.creditLimit - (selectedHouseAccount.currentBalance || 0);
      if (avail < grandTotal) {
        setWalletError(`Exceeds corporate credit limit (Available: ${formatNaira(avail)})`);
        return;
      }
      setWalletError('');
    }

    let finalPaymentMethod: any = 'card';
    if (paymentMethod === 'cash') {
      finalPaymentMethod = 'cash_on_delivery';
      playCashDrawerChime();
    }
    if (paymentMethod === 'bank_transfer') finalPaymentMethod = 'bank_transfer';
    if (paymentMethod === 'pos_terminal') finalPaymentMethod = 'pos_on_delivery';
    if (paymentMethod === 'wallet') finalPaymentMethod = 'card';
    if (paymentMethod === 'house_account') finalPaymentMethod = 'card';

    const posPaymentInfo: POSPayment = {
      method: paymentMethod as any,
      cashTendered: paymentMethod === 'cash' ? numericTendered : undefined,
      changeDue: paymentMethod === 'cash' ? changeDue : undefined,
      bankTransferRef: paymentMethod === 'bank_transfer' ? bankRef : undefined,
      posTerminalRrn: paymentMethod === 'pos_terminal' ? posRrn : undefined,
      splitCashAmount: paymentMethod === 'split' ? parseFloat(splitCash) || 0 : undefined,
      splitPosAmount: paymentMethod === 'split' ? parseFloat(splitPos) || 0 : undefined,
    };

    const assignedRiderObj = safeRiders.find((r) => r.id === assignedRiderId);
    const newOrder = createPOSOrder({
      branchId: posBranchId,
      orderType,
      items: posItems,
      subtotal,
      deliveryFee: orderType === 'delivery' ? posDeliveryFee : 0,
      packagingFee,
      discount: totalDiscount,
      total: grandTotal,
      paymentMethod: finalPaymentMethod,
      paymentStatus: 'paid',
      deliveryDetails: {
        customerName: customerName || (orderType === 'delivery' ? 'Delivery Guest' : 'Walk-in Guest'),
        customerPhone: (orderType === 'delivery' ? deliveryPhone : customerPhone) || customerPhone || currentBranch.phone,
        address: orderType === 'delivery'
          ? (deliveryAddress || `${deliveryZone}, Benin City`)
          : `${orderType === 'dine-in' ? tableNumber : 'Takeaway Counter'}, ${currentBranch.name}`,
        deliveryZone: orderType === 'delivery' ? deliveryZone : currentBranch.name,
      },
      orderChannel: (orderType === 'delivery' ? 'phone' : 'walk-in') as any,
      posPayment: {
        ...posPaymentInfo,
        riderId: orderType === 'delivery' ? (assignedRiderId || undefined) : undefined,
        riderName: orderType === 'delivery' ? assignedRiderObj?.name : undefined,
        riderType: orderType === 'delivery' ? deliveryRiderType : undefined,
      } as any,
    });

    // Execute server-side charges for wallet or corporate house account
    try {
      if (paymentMethod === 'wallet' && selectedCustomer) {
        await chargeWallet(
          selectedCustomer.id,
          grandTotal,
          newOrder.id,
          newOrder.orderNumber,
          `POS Order #${newOrder.orderNumber} at ${currentBranch.name}`
        );
      }

      if (paymentMethod === 'house_account' && selectedHouseAccount) {
        await chargeHouseAccount(
          selectedHouseAccount.id,
          grandTotal,
          newOrder.id,
          newOrder.orderNumber,
          `In-store POS dining order #${newOrder.orderNumber}`,
          customerName || 'Authorized Officer'
        );
      }
    } catch (apiErr) {
      console.error('Failed to post backend account charge:', apiErr);
    }

    setCompletedOrder({
      ...newOrder,
      posPayment: posPaymentInfo,
      cashier: currentStaff?.name || 'Cashier',
      timestamp: new Date().toLocaleString(),
    });


    setIsPaymentOpen(false);
    setEReceiptPhone(newOrder.deliveryDetails?.customerPhone || '');
    setEReceiptStatus(null);
    setIsReceiptOpen(true);
    clearCart(resetSelection);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#1E0507]/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200" id="staff-pos-modal">
      <div className="bg-[#FAF7F2] rounded-3xl w-full max-w-7xl h-[94vh] shadow-2xl border-2 border-[#FFC700] flex flex-col overflow-hidden">
        
        {/* Top POS Action Bar */}
        <div className="bg-[#4D080F] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#FFC700] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E62E00] text-[#FFC700] flex items-center justify-center font-titan text-xl shadow-md">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-titan text-lg sm:text-xl text-white tracking-wide">
                  CHOPLIFE STAFF POS
                </h1>
                <span className="bg-[#FFC700] text-[#4D080F] text-[10px] font-titan uppercase px-2 py-0.5 rounded-full">
                  Terminal 01
                </span>
              </div>
              <div className="text-xs text-white/80 font-montserrat flex flex-wrap items-center gap-2">
                <span>Branch: <strong className="text-[#FFC700]">{currentBranch.shortName}</strong></span>
                <span>•</span>
                <span>Staff: <strong className="text-white">{currentStaff?.name || 'Cashier'}</strong> ({currentStaff?.role})</span>
                <button
                  onClick={() => {
                    setSwitchPin('');
                    setSwitchPinError('');
                    setSwitchSuccessMsg('');
                    setIsSwitchStaffOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-white/15 hover:bg-[#FFC700] hover:text-[#4D080F] text-[#FFC700] text-[10px] font-titan uppercase tracking-wide transition-all active:scale-95 flex items-center gap-1 border border-white/20 hover:border-[#FFC700]"
                  title="Fast PIN Switch Server"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Switch</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Staff & Branch Selectors */}
          <div className="flex items-center gap-2">
            {/* Offline-First Connectivity & Sync Badge */}
            <div className="flex items-center gap-1.5">
              <div
                className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1.5 border transition-all ${
                  isOnline && offlineQueueCount === 0
                    ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-300'
                    : !isOnline
                    ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse'
                    : 'bg-amber-950/80 border-amber-500 text-amber-300'
                }`}
                title={
                  !isOnline
                    ? `Offline Mode Active (${offlineQueueCount} queued locally)`
                    : offlineQueueCount > 0
                    ? `${offlineQueueCount} order(s) pending background sync`
                    : 'Cloud Database Online & Synchronized'
                }
              >
                {!isOnline ? (
                  <WifiOff className="w-3 h-3 text-red-400" />
                ) : (
                  <Wifi className="w-3 h-3 text-emerald-400" />
                )}
                <span className="hidden sm:inline">
                  {!isOnline
                    ? `OFFLINE (${offlineQueueCount})`
                    : offlineQueueCount > 0
                    ? `SYNC QUEUE (${offlineQueueCount})`
                    : 'ONLINE'}
                </span>
              </div>

              {offlineQueueCount > 0 && isOnline && (
                <button
                  onClick={handleSyncOffline}
                  disabled={isSyncingQueue}
                  className="px-2.5 py-1 rounded-xl bg-[#FFC700] hover:bg-amber-400 text-[#4D080F] font-titan text-[10px] flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                  title="Force background sync now"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingQueue ? 'animate-spin' : ''}`} />
                  <span>Sync ({offlineQueueCount})</span>
                </button>
              )}
            </div>

            {/* Customer Display Trigger */}
            <button
              onClick={() => setIsCustomerDisplayOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#241311] hover:bg-[#3d201d] text-[#FFC700] border border-[#FFC700]/50 text-xs font-titan uppercase tracking-wide flex items-center gap-1.5 shadow-xs transition-all"
              title="Open Customer-Facing POS Display"
            >
              <Monitor className="w-4 h-4 text-[#FFC700]" />
              <span className="hidden sm:inline">Customer Display</span>
            </button>

            {/* Live Kitchen KDS Modal Trigger */}
            <button
              onClick={() => setIsKdsViewOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#E62E00] hover:bg-[#c92800] text-white text-xs font-titan uppercase tracking-wide flex items-center gap-1.5 shadow-xs transition-all"
              title="Open Kitchen Display System"
            >
              <ChefHat className="w-4 h-4 text-[#FFC700]" />
              <span className="hidden sm:inline">Live KDS</span>
            </button>

            {/* Shift Z-Report Modal Trigger */}
            <button
              onClick={() => setIsZReportOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#FAF7F2]/10 hover:bg-[#FAF7F2]/20 text-[#FFC700] border border-[#FFC700]/40 text-xs font-montserrat font-bold flex items-center gap-1.5 transition-all"
              title="End Shift / Cash Drawer Z-Report"
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden md:inline">Z-Report</span>
            </button>

            {/* Hardware Manager Button */}
            <button
              onClick={() => setIsHardwareManagerOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-montserrat font-bold flex items-center gap-1.5 transition-all shadow-xs"
              title="Configure Thermal Printer, Cash Drawer & Scanner"
            >
              <Printer className="w-4 h-4 text-[#FFC700]" />
              <span className="hidden lg:inline">Hardware Manager</span>
            </button>

            {/* Branch Switcher */}
            <div className="flex bg-black/30 rounded-xl p-1 border border-white/20">
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setPosBranchId(b.id)}
                  className={`px-3 py-1 text-xs font-montserrat font-bold rounded-lg transition-all ${
                    posBranchId === b.id
                      ? 'bg-[#FFC700] text-[#4D080F] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {b.shortName.replace(' Branch', '')}
                </button>
              ))}
            </div>

            {/* Held Tickets Button */}
            <button
              onClick={() => setIsHoldTrayOpen(true)}
              className="relative px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFC700] border border-[#FFC700]/50 text-xs font-montserrat font-bold flex items-center gap-1.5 transition-all"
            >
              <PauseCircle className="w-4 h-4" />
              <span>Held</span>
              {heldTickets.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#E62E00] text-white text-[10px] flex items-center justify-center font-bold">
                  {heldTickets.length}
                </span>
              )}
            </button>

            {/* Close POS Button */}
            <button
              onClick={() => setIsStaffPosOpen(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close POS"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Offline Connectivity & Synchronizer Banner */}
        <OfflineSyncBar />

        {/* Main 2-Column POS Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left Column: Categories, Search & Products Grid */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-[#E5DEC9] bg-white">
            
            {/* Search & Category Filter Header */}
            <div className="p-4 border-b border-[#E5DEC9] bg-[#FAF7F2] space-y-3 shrink-0">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search menu or scan dish name (e.g. Shawarma, Croaker, Jollof)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-2xl pl-10 pr-4 py-2.5 text-sm font-montserrat text-[#241311] focus:outline-hidden focus:ring-2 focus:ring-[#E62E00]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Genuine 3-Way Order Type Selector */}
                <div className="flex items-center bg-[#FAF7F2] p-1 rounded-2xl border border-[#E5DEC9] shrink-0 gap-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleSelectOrderType('dine-in')}
                    className={`px-3 py-2 rounded-xl text-xs font-titan transition-all flex items-center gap-1.5 ${
                      orderType === 'dine-in'
                        ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                        : 'text-stone-600 hover:text-[#4D080F] hover:bg-white'
                    }`}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                    <span>Dine-In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectOrderType('pickup')}
                    className={`px-3 py-2 rounded-xl text-xs font-titan transition-all flex items-center gap-1.5 ${
                      orderType === 'pickup'
                        ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                        : 'text-stone-600 hover:text-[#4D080F] hover:bg-white'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Takeaway</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectOrderType('delivery')}
                    className={`px-3 py-2 rounded-xl text-xs font-titan transition-all flex items-center gap-1.5 ${
                      orderType === 'delivery'
                        ? 'bg-[#E62E00] text-white shadow-xs'
                        : 'text-stone-600 hover:text-[#E62E00] hover:bg-white'
                    }`}
                  >
                    <Bike className="w-3.5 h-3.5" />
                    <span>Delivery</span>
                  </button>
                </div>
              </div>

              {/* Fast Category Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'all', label: 'All Items' },
                  { id: 'small-chops', label: '🥟 Small Chops' },
                  { id: 'bakery', label: '🍞 Bakery Bread' },
                  { id: 'rice-meals', label: '🍲 Rice & Mains' },
                  { id: 'soups-swallows', label: '🥣 Soups & Swallows' },
                  { id: 'shawarma', label: '🌯 Shawarma' },
                  { id: 'grills', label: '🍗 Grills & Fish' },
                  { id: 'party-packs', label: '👑 Party Platters' },
                  { id: 'fast-food', label: '🍱 Combos' },
                  { id: 'bites-snacks', label: '🥐 Pastries' },
                  { id: 'desserts', label: '🍨 Parfait' },
                  { id: 'drinks', label: '🍹 Drinks & Zobo' },
                  { id: 'packaging', label: '📦 Packaging' },
                  { id: 'deals', label: '🎉 Deals' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap transition-all ${
                      activeCategory === cat.id
                        ? 'bg-[#E62E00] text-white shadow-xs'
                        : 'bg-white text-[#4D080F] border border-[#E5DEC9] hover:bg-[#F2ECE1]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-[#FAF7F2]">
              {filteredProducts.map((product) => {
                const inStock = isProductAvailable(product.id, posBranchId);
                const price = getProductPrice(product, posBranchId);

                return (
                  <button
                    key={product.id}
                    onClick={() => inStock && addItem(product)}
                    disabled={!inStock}
                    className={`text-left p-3 rounded-2xl border transition-all flex flex-col justify-between group ${
                      inStock
                        ? 'bg-white border-[#E5DEC9] hover:border-[#E62E00] hover:shadow-md active:scale-95'
                        : 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <div className="relative h-24 sm:h-28 w-full rounded-xl overflow-hidden mb-2 bg-gray-100">
                        <img
                          src={product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {!inStock && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="bg-red-600 text-white text-[10px] font-titan uppercase px-2 py-0.5 rounded-md">
                              SOLD OUT
                            </span>
                          </div>
                        )}
                        {product.isPopular && (
                          <span className="absolute top-1.5 left-1.5 bg-[#FFC700] text-[#4D080F] text-[9px] font-titan uppercase px-1.5 py-0.5 rounded-md shadow-xs">
                            Popular
                          </span>
                        )}
                      </div>

                      <h3 className="font-titan text-xs sm:text-sm text-[#241311] line-clamp-2 leading-tight">
                        {product.name}
                      </h3>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="font-titan text-xs sm:text-sm text-[#E62E00]">
                        {formatNaira(price)}
                      </span>
                      {inStock && (
                        <div className="w-6 h-6 rounded-full bg-[#FAF7F2] text-[#4D080F] group-hover:bg-[#E62E00] group-hover:text-white flex items-center justify-center transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Order Bill & Quick Checkout */}
          <div className="w-full lg:w-[420px] bg-[#FAF7F2] flex flex-col justify-between border-t lg:border-t-0 shrink-0">
            
            {/* Guest / Table Info & Loyalty Lookup */}
            <div className="p-4 bg-white border-b border-[#E5DEC9] space-y-2.5 shrink-0">
              {orderType === 'dine-in' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10px] font-titan uppercase text-gray-500">
                        Table No.
                      </label>
                      <button
                        onClick={() => setIsTablePickerOpen(true)}
                        className="text-[10px] text-[#E62E00] font-bold hover:underline"
                      >
                        Layout Map
                      </button>
                    </div>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="Table 01"
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs font-montserrat font-bold text-[#241311]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-titan uppercase text-gray-500 block mb-0.5">
                      Guest Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Walk-in Guest"
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs font-montserrat text-[#241311]"
                    />
                  </div>
                </div>
              )}

              {orderType === 'pickup' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-titan uppercase text-gray-500 block mb-0.5">
                      Counter / Pickup Tag
                    </label>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="Takeaway Counter"
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs font-montserrat font-bold text-[#241311]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-titan uppercase text-gray-500 block mb-0.5">
                      Customer Name & Phone
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer Name"
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs font-montserrat text-[#241311]"
                    />
                  </div>
                </div>
              )}

              {orderType === 'delivery' && (
                <div className="space-y-2 bg-[#FAF7F2] p-2.5 rounded-2xl border border-[#E5DEC9]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-titan uppercase text-[#E62E00] flex items-center gap-1">
                      <Bike className="w-3.5 h-3.5" /> Delivery Order Details
                    </span>
                    <span className="text-[10px] font-mono text-gray-500 font-bold">
                      Fee: ₦{posDeliveryFee.toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-titan uppercase text-gray-500 block mb-0.5">
                        Customer Recipient
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Recipient Name"
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2 py-1 text-xs font-montserrat text-[#241311]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-titan uppercase text-gray-500 block mb-0.5">
                        Recipient Phone
                      </label>
                      <input
                        type="tel"
                        value={deliveryPhone}
                        onChange={(e) => setDeliveryPhone(e.target.value)}
                        placeholder="080... phone"
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2 py-1 text-xs font-montserrat text-[#241311]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-titan uppercase text-gray-500 block mb-0.5">
                        Delivery Zone
                      </label>
                      <select
                        value={deliveryZone}
                        onChange={(e) => handleZoneChange(e.target.value)}
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2 py-1 text-xs font-montserrat text-[#241311]"
                      >
                        {POS_DELIVERY_ZONES.map((z) => (
                          <option key={z.name} value={z.name}>
                            {z.name} (₦{z.fee})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-titan uppercase text-gray-500 block mb-0.5">
                        Delivery Fee (₦)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={posDeliveryFee}
                        onChange={(e) => setPosDeliveryFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2 py-1 text-xs font-montserrat font-bold text-[#E62E00]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-titan uppercase text-gray-500 block mb-0.5">
                      Delivery Street Address / Landmark
                    </label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="e.g. 14 Boundary Rd, Opp. Motel Benin"
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2 py-1 text-xs font-montserrat text-[#241311]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <label className="text-[9px] font-titan uppercase text-gray-500 block mb-0.5">
                        Rider Fleet / Partner
                      </label>
                      <select
                        value={deliveryRiderType}
                        onChange={(e) => setDeliveryRiderType(e.target.value as any)}
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2 py-1 text-[11px] font-montserrat text-[#241311]"
                      >
                        <option value="internal_fleet">Choplife Fleet</option>
                        <option value="external_partner">External Courier</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-titan uppercase text-gray-500 block mb-0.5">
                        Assign Rider
                      </label>
                      <select
                        value={assignedRiderId}
                        onChange={(e) => setAssignedRiderId(e.target.value)}
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-2 py-1 text-[11px] font-montserrat text-[#241311]"
                      >
                        <option value="">Auto-Assign / Dispatch Desk</option>
                        {safeRiders.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.phone || r.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Member / House Account Status or Lookup Button */}
              <div className="pt-1">
                {selectedCustomer ? (
                  <div className="bg-[#FFF8E7] border border-[#FFC700] rounded-xl p-2.5 flex items-center justify-between text-xs font-montserrat shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-[#E62E00]" />
                        <span className="font-titan text-[#4D080F] text-xs">{selectedCustomer.name}</span>
                        <span className="px-1.5 py-0.2 bg-[#FFC700] text-[#4D080F] font-bold text-[9px] rounded uppercase">
                          {selectedCustomer.tier || 'Silver'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-600">
                        ChopPoints: <strong className="text-[#E62E00]">{selectedCustomer.loyaltyPoints || 0} pts</strong> • 
                        Wallet: <strong className="text-emerald-700">{formatNaira(selectedCustomer.walletBalance || 0)}</strong> •
                        Stamps: <strong className="text-amber-800">{selectedCustomer.stampCount || 0}/10</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(selectedCustomer.loyaltyPoints || 0) >= 100 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (redeemedChopPoints > 0) {
                              setRedeemedChopPoints(0);
                            } else {
                              const maxRedeem = Math.min(selectedCustomer.loyaltyPoints, subtotal);
                              setRedeemedChopPoints(maxRedeem);
                            }
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-titan uppercase transition-all ${
                            redeemedChopPoints > 0
                              ? 'bg-green-600 text-white shadow-xs'
                              : 'bg-[#4D080F] text-[#FFC700] hover:bg-[#38050A]'
                          }`}
                        >
                          {redeemedChopPoints > 0 ? `Redeemed ${redeemedChopPoints} pts (-${formatNaira(redeemedChopPoints)})` : 'Redeem Pts'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setRedeemedChopPoints(0);
                          setCustomerName('Walk-in Customer');
                          setCustomerPhone('');
                        }}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Unlink Customer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : selectedHouseAccount ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 flex items-center justify-between text-xs font-montserrat shadow-2xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-purple-700" />
                        <span className="font-titan text-purple-900 text-xs">{selectedHouseAccount.companyName}</span>
                        <span className="px-1.5 py-0.2 bg-purple-200 text-purple-800 font-bold text-[9px] rounded uppercase">
                          Corporate Tab
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-600">
                        Available Credit: <strong className="text-purple-800">{formatNaira(selectedHouseAccount.creditLimit - (selectedHouseAccount.currentBalance || 0))}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedHouseAccount(null);
                        setCustomerName('Walk-in Customer');
                        setCustomerPhone('');
                      }}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Unlink Account"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMemberLookupOpen(true);
                      fetchMembers();
                    }}
                    className="w-full py-1.5 px-3 bg-[#FFF8E7] hover:bg-[#ffefc9] border border-[#FFC700] rounded-xl text-[11px] font-titan text-[#4D080F] flex items-center justify-center gap-1.5 transition-colors shadow-2xs active:scale-98"
                  >
                    <Award className="w-3.5 h-3.5 text-[#E62E00]" />
                    <span>Lookup Loyalty VIP / Corporate Account</span>
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-gray-100">
              {posItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                  <UtensilsCrossed className="w-12 h-12 text-[#E5DEC9] mb-3 animate-pulse" />
                  <p className="font-titan text-sm text-[#4D080F]">No Items Added Yet</p>
                  <p className="text-xs font-montserrat mt-1">
                    Tap dishes on the left to add items to this POS ticket.
                  </p>
                </div>
              ) : (
                posItems.map((item) => (
                  <div key={item.id} className="pt-2 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-montserrat font-bold text-xs text-[#241311]">
                        {item.product.name}
                      </h4>
                      <p className="text-[11px] text-gray-500 font-montserrat">
                        {formatNaira(item.unitPrice)} each
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1 bg-white border border-[#E5DEC9] rounded-xl px-1.5 py-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-5 h-5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#4D080F] flex items-center justify-center font-bold"
                        title="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        step={1}
                        aria-label={`Quantity for ${item.product.name}`}
                        value={item.quantity}
                        onChange={(e) => setDirectQuantity(item.id, Number(e.target.value))}
                        className="w-11 h-5 rounded bg-[#FAF7F2] border border-[#E5DEC9] text-center font-titan text-xs text-[#241311] focus:outline-none focus:border-[#E62E00] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-5 h-5 rounded-lg bg-[#E62E00] hover:bg-[#c92800] text-white flex items-center justify-center font-bold"
                        title="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="text-right w-16">
                      <span className="font-titan text-xs text-[#241311]">
                        {formatNaira(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Discount & Packaging Bar */}
            <div className="p-3 bg-[#FFF8E7] border-t border-[#E5DEC9] space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-montserrat font-bold text-[#4D080F] flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Discount:
                </span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        setDiscountPercent(pct);
                        setCustomDiscountAmount(0);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-titan transition-all ${
                        discountPercent === pct && customDiscountAmount === 0
                          ? 'bg-[#E62E00] text-white'
                          : 'bg-white text-gray-700 border border-[#E5DEC9]'
                      }`}
                    >
                      {pct === 0 ? 'None' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-montserrat text-xs text-[#4D080F]">
                  <input
                    type="checkbox"
                    checked={isPackagingIncluded}
                    onChange={(e) => setIsPackagingIncluded(e.target.checked)}
                    className="accent-[#E62E00] rounded-sm"
                  />
                  <span>Takeaway Packaging (+₦400)</span>
                </label>

                <button
                  onClick={() => clearCart(() => setWalletError(''))}
                  className="text-[10px] text-red-600 hover:underline font-montserrat font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear Ticket
                </button>
              </div>
            </div>

            {/* Totals Summary & Charge CTA */}
            <div className="p-4 bg-white border-t border-[#E5DEC9] space-y-3 shrink-0">
              <div className="space-y-1 text-xs font-montserrat">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-bold">{formatNaira(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-green-600 font-bold">
                    <span>Discount:</span>
                    <span>-{formatNaira(totalDiscount)}</span>
                  </div>
                )}
                {packagingFee > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Packaging:</span>
                    <span>+{formatNaira(packagingFee)}</span>
                  </div>
                )}
                {orderType === 'delivery' && posDeliveryFee > 0 && (
                  <div className="flex justify-between text-[#E62E00] font-bold">
                    <span className="flex items-center gap-1">
                      <Bike className="w-3.5 h-3.5" />
                      Delivery Fee ({deliveryZone.split('/')[0].trim()}):
                    </span>
                    <span>+{formatNaira(posDeliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-titan text-[#241311] pt-1 border-t border-gray-100">
                  <span>TOTAL DUE:</span>
                  <span className="text-[#E62E00]">{formatNaira(grandTotal)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={handleHoldOrder}
                  disabled={posItems.length === 0}
                  className="px-2 py-3 rounded-2xl bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#4D080F] border border-[#E5DEC9] text-[11px] font-titan uppercase tracking-wider flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  title="Park / Hold Ticket"
                >
                  <PauseCircle className="w-4 h-4 text-[#FFC700]" />
                  <span>Hold</span>
                </button>

                <button
                  onClick={() => setIsSplitBillOpen(true)}
                  disabled={posItems.length === 0}
                  className="px-2 py-3 rounded-2xl bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#4D080F] border border-[#E5DEC9] text-[11px] font-titan uppercase tracking-wider flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  title="Split Bill Between Guests"
                >
                  <Split className="w-4 h-4 text-[#4D080F]" />
                  <span>Split</span>
                </button>

                <button
                  onClick={() => {
                    if (posItems.length > 0) {
                      setCashTendered(grandTotal.toString());
                      setIsPaymentOpen(true);
                    }
                  }}
                  disabled={posItems.length === 0}
                  className="col-span-2 px-3 py-3 rounded-2xl bg-[#E62E00] hover:bg-[#c92800] text-white shadow-lg text-xs font-titan uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Banknote className="w-4 h-4 text-[#FFC700]" />
                  <span>PAY {formatNaira(grandTotal)}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <POSPaymentModal 
          isOpen={isPaymentOpen}
          formatNaira={formatNaira}
          onClose={() => setIsPaymentOpen(false)}
          grandTotal={grandTotal}
          currentBranch={currentBranch}
          orderType={orderType}
          tableNumber={tableNumber}
          customerName={customerName}
          paymentState={{
            paymentMethod,
            cashTendered,
            bankRef,
            posRrn,
            splitCash,
            splitPos,
          }}
          setPaymentMethod={setPaymentMethod}
          cashTendered={cashTendered}
          setCashTendered={setCashTendered}
          bankRef={bankRef}
          setBankRef={setBankRef}
          posRrn={posRrn}
          setPosRrn={setPosRrn}
          splitCash={splitCash}
          setSplitCash={setSplitCash}
          splitPos={splitPos}
          setSplitPos={setSplitPos}
          walletError={walletError}
          setWalletError={setWalletError}
          selectedCustomer={selectedCustomer}
          selectedHouseAccount={selectedHouseAccount}
          walletPin={walletPin}
          setWalletPin={setWalletPin}
          changeDue={changeDue}
          onMemberLookupOpen={() => {setIsMemberLookupOpen(true); fetchMembers();}}
          fetchMembers={fetchMembers}
          onComplete={handleCompletePOSSale}
        />


        <POSReceiptModal
          isOpen={isReceiptOpen}
          formatNaira={formatNaira}
          completedOrder={completedOrder}
          receiptMode={receiptMode}
          setReceiptMode={setReceiptMode}
          onClose={() => setIsReceiptOpen(false)}
          printReceipt={printReceipt}
          printKitchenTicket={printKitchenTicket}
          openCashDrawer={openCashDrawer}
          isPrinting={isPrinting}
          eReceiptPhone={eReceiptPhone}
          setEReceiptPhone={setEReceiptPhone}
          isSendingEReceipt={isSendingEReceipt}
          eReceiptStatus={eReceiptStatus}
          handleSendDigitalReceipt={handleSendDigitalReceipt}
          currentBranch={currentBranch}
          setIsHardwarePrinterModalOpen={setIsHardwarePrinterModalOpen}
        />


        {/* --- MODAL 3: HELD TICKETS TRAY --- */}
        {isHoldTrayOpen && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border-2 border-[#FFC700] p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-titan text-base text-[#4D080F] flex items-center gap-2">
                  <PauseCircle className="w-5 h-5 text-[#FFC700]" />
                  PARKED & HELD TICKETS ({heldTickets.length})
                </h3>
                <button onClick={() => setIsHoldTrayOpen(false)} className="p-1 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2">
                {heldTickets.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-8">
                    No held tickets found.
                  </p>
                ) : (
                  heldTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] flex items-center justify-between gap-3 hover:border-[#E62E00]"
                    >
                      <div>
                        <h4 className="font-montserrat font-bold text-xs text-[#241311]">
                          {ticket.ticketName}
                        </h4>
                        <p className="text-[10px] text-gray-500">
                          {ticket.items.length} items • Branch: {ticket.branchId.toUpperCase()}
                        </p>
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleRestoreTicket(ticket.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#E62E00] text-white text-xs font-titan uppercase"
                        >
                          Recall
                        </button>
                        <button
                          onClick={() => deleteHeldTicket(ticket.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL 4: SPLIT-BILL CALCULATOR --- */}
        {isSplitBillOpen && (
          <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border-2 border-[#FFC700] p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Split className="w-5 h-5 text-[#E62E00]" />
                  <h3 className="font-titan text-base text-[#4D080F]">SPLIT BILL CALCULATOR</h3>
                </div>
                <button
                  onClick={() => setIsSplitBillOpen(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#FFF8E7] p-4 rounded-2xl border border-[#FFC700]/60 space-y-1">
                <span className="text-xs text-gray-500 font-montserrat uppercase">Total Bill Amount</span>
                <p className="font-titan text-2xl text-[#E62E00]">{formatNaira(grandTotal)}</p>
                <p className="text-[11px] text-gray-500 font-montserrat">{posItems.length} items ordered for {tableNumber || customerName}</p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-montserrat font-bold text-gray-700 block">
                  Select Number of Guests Splitting:
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSplitGuestCount(num)}
                      className={`py-2 rounded-xl font-titan text-sm transition-all ${
                        splitGuestCount === num
                          ? 'bg-[#4D080F] text-[#FFC700] shadow-xs ring-2 ring-[#FFC700]'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {num} Ways
                    </button>
                  ))}
                </div>

                <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] text-center space-y-1">
                  <span className="text-xs text-gray-500 font-montserrat uppercase font-bold">Amount Per Person:</span>
                  <p className="font-titan text-3xl text-emerald-700">
                    {formatNaira(Math.ceil(grandTotal / splitGuestCount))}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono">
                    ({splitGuestCount} payments of {formatNaira(Math.ceil(grandTotal / splitGuestCount))})
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSplitBillOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-montserrat font-bold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSplitBillOpen(false);
                    setCashTendered(Math.ceil(grandTotal / splitGuestCount).toString());
                    setIsPaymentOpen(true);
                  }}
                  className="px-5 py-2 bg-[#E62E00] text-white rounded-xl text-xs font-titan uppercase shadow-xs"
                >
                  Proceed with First Split Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL 5: RESTAURANT TABLE LAYOUT SELECTOR --- */}
        {isTablePickerOpen && (
          <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border-2 border-[#FFC700] p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <span className="text-[10px] font-titan uppercase text-[#4D080F]">Floor Map</span>
                  <h3 className="font-titan text-base text-[#4D080F]">Select Dining Table</h3>
                </div>
                <button
                  onClick={() => setIsTablePickerOpen(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-xs font-titan text-gray-600 uppercase block mb-2">Main Dining Lounge</span>
                  <div className="grid grid-cols-4 gap-2">
                    {['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05', 'Table 06', 'Table 07', 'Table 08'].map((tbl) => (
                      <button
                        key={tbl}
                        onClick={() => {
                          setTableNumber(tbl);
                          setIsTablePickerOpen(false);
                        }}
                        className={`p-3 rounded-2xl text-xs font-titan border transition-all ${
                          tableNumber === tbl
                            ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F] shadow-sm'
                            : 'bg-[#FAF7F2] text-[#241311] border-[#E5DEC9] hover:border-[#E62E00]'
                        }`}
                      >
                        {tbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-titan text-gray-600 uppercase block mb-2">VIP Booths & Outdoor Garden</span>
                  <div className="grid grid-cols-3 gap-2">
                    {['VIP Booth 01', 'VIP Booth 02', 'VIP Booth 03', 'Terrace 01', 'Terrace 02', 'Terrace 03'].map((tbl) => (
                      <button
                        key={tbl}
                        onClick={() => {
                          setTableNumber(tbl);
                          setIsTablePickerOpen(false);
                        }}
                        className={`p-3 rounded-2xl text-xs font-titan border transition-all ${
                          tableNumber === tbl
                            ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F] shadow-sm'
                            : 'bg-[#FAF7F2] text-[#241311] border-[#E5DEC9] hover:border-[#E62E00]'
                        }`}
                      >
                        {tbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL 6: LIVE KITCHEN DISPLAY SYSTEM OVERLAY --- */}
        {isKdsViewOpen && (
          <div className="fixed inset-0 z-80 bg-black/90 backdrop-blur-md flex flex-col p-2 sm:p-4 animate-in fade-in">
            <div className="flex justify-end p-2">
              <button
                onClick={() => setIsKdsViewOpen(false)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-titan uppercase flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> Exit KDS Screen
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <KitchenDisplaySystem />
            </div>
          </div>
        )}

        {/* --- MODAL 7: SHIFT RECONCILIATION Z-REPORT OVERLAY --- */}
        {isZReportOpen && (
          <ShiftZReportModal
            onClose={() => setIsZReportOpen(false)}
            branchId={posBranchId}
          />
        )}

        {/* --- MODAL 8: CUSTOMER LOYALTY & CORPORATE TAB LOOKUP --- */}
        {isMemberLookupOpen && (
          <div className="fixed inset-0 z-80 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#FAF7F2] rounded-3xl w-full max-w-xl max-h-[85vh] shadow-2xl border-2 border-[#FFC700] p-6 flex flex-col space-y-4">
              
              <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#E62E00]" />
                  <h3 className="font-titan text-base text-[#4D080F]">
                    CHOPLIFE MEMBERS & CORPORATE DIRECTORY
                  </h3>
                </div>
                <button
                  onClick={() => setIsMemberLookupOpen(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  placeholder="Search customer name, phone (080...), or company..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E5DEC9] rounded-2xl text-xs font-montserrat text-[#241311] focus:ring-2 focus:ring-[#FFC700]"
                  autoFocus
                />
              </div>

              {/* Results List */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Registered Customers */}
                <div className="space-y-2">
                  <p className="text-[10px] font-titan uppercase text-gray-500 tracking-wider">
                    VIP & Loyalty Members ({registeredCustomers.filter((c) =>
                      c.name?.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                      c.phone?.includes(memberSearchTerm)
                    ).length})
                  </p>

                  <div className="space-y-2">
                    {registeredCustomers
                      .filter((c) =>
                        c.name?.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                        c.phone?.includes(memberSearchTerm) ||
                        c.email?.toLowerCase().includes(memberSearchTerm.toLowerCase())
                      )
                      .slice(0, 10)
                      .map((cust) => (
                        <div
                          key={cust.id}
                          className="p-3 bg-white rounded-2xl border border-[#E5DEC9] hover:border-[#FFC700] flex items-center justify-between gap-3 transition-all"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-titan text-sm text-[#241311]">{cust.name}</span>
                              <span className="px-1.5 py-0.5 bg-[#FFC700] text-[#4D080F] text-[9px] font-bold rounded uppercase">
                                {cust.tier || 'Silver'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 font-montserrat">
                              {cust.phone} • {cust.email}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-[11px] font-montserrat">
                              <span className="text-[#E62E00] font-bold">
                                {cust.loyaltyPoints || 0} ChopPoints
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="text-emerald-700 font-bold">
                                Wallet: {formatNaira(cust.walletBalance || 0)}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="text-amber-800">
                                Stamps: {cust.stampCount || 0}/10
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setSelectedHouseAccount(null);
                              setCustomerName(cust.name);
                              setCustomerPhone(cust.phone);
                              setIsMemberLookupOpen(false);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] text-xs font-titan uppercase tracking-wider shrink-0 transition-all active:scale-95"
                          >
                            Select
                          </button>
                        </div>
                      ))}

                    {registeredCustomers.length === 0 && !isLoadingMembers && (
                      <p className="text-xs text-gray-400 italic py-2">
                        No registered loyalty members loaded yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Corporate House Accounts */}
                <div className="space-y-2 pt-2 border-t border-[#E5DEC9]">
                  <p className="text-[10px] font-titan uppercase text-purple-800 tracking-wider">
                    Corporate House Accounts ({registeredHouseAccounts.filter((h) =>
                      h.companyName?.toLowerCase().includes(memberSearchTerm.toLowerCase())
                    ).length})
                  </p>

                  <div className="space-y-2">
                    {registeredHouseAccounts
                      .filter((h) =>
                        h.companyName?.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                        h.contactPerson?.toLowerCase().includes(memberSearchTerm.toLowerCase())
                      )
                      .map((acct) => {
                        const available = acct.creditLimit - (acct.currentBalance || 0);
                        return (
                          <div
                            key={acct.id}
                            className="p-3 bg-purple-50/50 rounded-2xl border border-purple-200 hover:border-purple-400 flex items-center justify-between gap-3 transition-all"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <Building className="w-3.5 h-3.5 text-purple-700" />
                                <span className="font-titan text-sm text-purple-900">{acct.companyName}</span>
                                <span className="px-1.5 py-0.5 bg-purple-200 text-purple-800 text-[9px] font-bold rounded uppercase">
                                  {acct.paymentTerms || 'NET 30'}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-600 font-montserrat">
                                Contact: {acct.contactPerson} ({acct.phone})
                              </p>
                              <p className="text-[11px] text-purple-800 font-montserrat font-bold mt-0.5">
                                Avail Credit: {formatNaira(available)} / Limit: {formatNaira(acct.creditLimit)}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedHouseAccount(acct);
                                setSelectedCustomer(null);
                                setCustomerName(`${acct.companyName} (Attn: ${acct.contactPerson})`);
                                setCustomerPhone(acct.phone);
                                setIsMemberLookupOpen(false);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-purple-900 hover:bg-purple-950 text-[#FFC700] text-xs font-titan uppercase tracking-wider shrink-0 transition-all active:scale-95"
                            >
                              Select Tab
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E5DEC9] flex justify-end">
                <button
                  onClick={() => setIsMemberLookupOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-montserrat font-bold"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

        {/* --- MODAL 9: QUICK CASHIER & SERVER PIN SWITCHER --- */}
        {isSwitchStaffOpen && (
          <div className="fixed inset-0 z-80 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#FAF7F2] rounded-3xl w-full max-w-sm shadow-2xl border-2 border-[#FFC700] p-6 flex flex-col space-y-4">
              
              <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-[#E62E00]" />
                  <div>
                    <h3 className="font-titan text-base text-[#4D080F]">
                      SWITCH CASHIER / SERVER
                    </h3>
                    <p className="text-[10px] text-gray-500 font-montserrat">
                      Enter 4-digit staff PIN to change active server
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSwitchStaffOpen(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status & Alerts */}
              {switchSuccessMsg ? (
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-titan text-center animate-bounce">
                  ✅ {switchSuccessMsg}
                </div>
              ) : switchPinError ? (
                <div className="p-2 bg-red-100 text-red-800 rounded-xl text-xs font-montserrat font-bold text-center">
                  ⚠️ {switchPinError}
                </div>
              ) : null}

              {/* PIN Digits Display */}
              <div className="flex items-center justify-center gap-3 py-2 bg-white rounded-2xl border border-[#E5DEC9]">
                {[0, 1, 2, 3].map((index) => {
                  const hasDigit = switchPin.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-4 h-4 rounded-full transition-all duration-150 ${
                        hasDigit ? 'bg-[#E62E00] scale-110 shadow-xs' : 'bg-gray-200'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Numeric Touch Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      if (switchPin.length < 4) {
                        const newPin = switchPin + digit.toString();
                        setSwitchPin(newPin);
                        if (newPin.length === 4) {
                          handleSwitchStaffPin(newPin);
                        }
                      }
                    }}
                    className="h-12 bg-white hover:bg-[#FFF8E7] active:bg-[#FFC700] border border-[#E5DEC9] rounded-2xl font-titan text-lg text-[#241311] shadow-2xs transition-all active:scale-95 flex items-center justify-center"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setSwitchPin('');
                    setSwitchPinError('');
                  }}
                  className="h-12 bg-gray-100 hover:bg-gray-200 border border-[#E5DEC9] rounded-2xl font-titan text-xs uppercase text-gray-700 shadow-2xs transition-all active:scale-95 flex items-center justify-center"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (switchPin.length < 4) {
                      const newPin = switchPin + '0';
                      setSwitchPin(newPin);
                      if (newPin.length === 4) {
                        handleSwitchStaffPin(newPin);
                      }
                    }
                  }}
                  className="h-12 bg-white hover:bg-[#FFF8E7] active:bg-[#FFC700] border border-[#E5DEC9] rounded-2xl font-titan text-lg text-[#241311] shadow-2xs transition-all active:scale-95 flex items-center justify-center"
                >
                  0
                </button>

                <button
                  type="button"
                  disabled={isSwitchingStaff || switchPin.length < 4}
                  onClick={() => handleSwitchStaffPin()}
                  className="h-12 bg-[#4D080F] hover:bg-[#38050a] disabled:bg-gray-300 text-[#FFC700] rounded-2xl font-titan text-xs uppercase tracking-wider shadow-2xs transition-all active:scale-95 flex items-center justify-center"
                >
                  {isSwitchingStaff ? '...' : 'OK'}
                </button>
              </div>

              {/* Quick Staff Hint */}
              <div className="pt-2 border-t border-[#E5DEC9] text-center">
                <p className="text-[10px] text-gray-400 font-montserrat">
                  Current: <strong className="text-[#4D080F]">{currentStaff?.name || 'Cashier'}</strong> ({posBranchId.toUpperCase()})
                </p>
              </div>

            </div>
          </div>
        )}

        {/* Offline Sync Floating Notification */}
        {syncToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#4D080F] text-[#FFC700] px-5 py-2.5 rounded-2xl shadow-2xl font-titan text-xs flex items-center gap-2 border-2 border-[#FFC700] animate-in fade-in slide-in-from-bottom-2 duration-150">
            <RefreshCw className="w-4 h-4 text-[#FFC700]" />
            <span>{syncToast}</span>
          </div>
        )}

        {/* Hardware Manager Modal */}
        <POSHardwareModal
          isOpen={isHardwareManagerOpen}
          onClose={() => setIsHardwareManagerOpen(false)}
          activeBranchId={posBranchId}
          isPrinterModalOpen={isHardwarePrinterModalOpen}
          setIsPrinterModalOpen={setIsHardwarePrinterModalOpen}
          isScannerOpen={isPosScannerOpen}
          setIsScannerOpen={setIsPosScannerOpen}
          onScanSuccess={(res) => {
            setSyncToast(res.message || 'Scanned successfully!');
            setTimeout(() => setSyncToast(null), 4000);
          }}
        />

        {/* Customer POS Display Modal */}
        <CustomerDisplayModal
          isOpen={isCustomerDisplayOpen}
          onClose={() => setIsCustomerDisplayOpen(false)}
          cart={posItems}
          subtotal={subtotal}
          packagingFee={packagingFee}
          discount={totalDiscount}
          total={grandTotal}
          branchName={currentBranch.name}
          cashierName={currentStaff?.name}
          paymentStatus={isPaymentOpen ? 'pending' : completedOrder ? 'paid' : 'unpaid'}
          lastCompletedOrderNumber={completedOrder?.orderNumber}
        />

      </div>
    </div>
  );
};
