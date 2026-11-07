import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import {
  X,
  Bike,
  Phone,
  MapPin,
  Navigation,
  CheckCircle2,
  Clock,
  Banknote,
  ShieldCheck,
  RotateCw,
  ExternalLink,
  ChevronRight,
  PackageCheck,
  MessageCircle,
  KeyRound,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';

export const RiderPortalModal: React.FC = () => {
  const {
    isRiderPortalOpen,
    setIsRiderPortalOpen,
    orders,
    riders,
    updateOrderStatus,
    updateRiderCashInHand,
    formatNaira,
    currentStaff,
    setIsStaffLoginModalOpen,
  } = useApp();

  const safeRiders = Array.isArray(riders) ? riders : [];

  const isRiderRole =
    currentStaff?.role === 'rider' ||
    currentStaff?.role === 'internal_rider' ||
    currentStaff?.role === 'external_rider';

  const isSupervisorRole =
    currentStaff?.role === 'dispatch_manager' ||
    currentStaff?.role === 'branch_manager' ||
    currentStaff?.role === 'store_manager' ||
    currentStaff?.role === 'admin' ||
    currentStaff?.role === 'super_admin' ||
    currentStaff?.role === 'corporate_admin';

  // Match authenticated staff to registered fleet rider if available
  const matchedStaffRider = safeRiders.find(
    (r) =>
      r.id === currentStaff?.id ||
      r.name.toLowerCase() === currentStaff?.name?.toLowerCase()
  );

  const [activeRiderId, setActiveRiderId] = useState<string>(
    matchedStaffRider?.id || safeRiders[0]?.id || ''
  );

  // Sync rider when authenticated rider logs in
  React.useEffect(() => {
    if (matchedStaffRider) {
      setActiveRiderId(matchedStaffRider.id);
    }
  }, [matchedStaffRider?.id]);

  const [courierReleaseCode, setCourierReleaseCode] = useState<string>('');
  const [courierVerificationMsg, setCourierVerificationMsg] = useState<string>('');

  // Handover PIN Verification State
  const [verifyingOrder, setVerifyingOrder] = useState<Order | null>(null);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [codCollectedConfirmed, setCodCollectedConfirmed] = useState<boolean>(false);

  // Cash Remittance Modal State
  const [isRemitModalOpen, setIsRemitModalOpen] = useState<boolean>(false);
  const [remitSuccessMsg, setRemitSuccessMsg] = useState<string>('');

  if (!isRiderPortalOpen) return null;

  const currentRider = isRiderRole
    ? (matchedStaffRider || {
        id: currentStaff?.id || 'rdr-auth',
        name: currentStaff?.name || 'Assigned Rider',
        phone: currentStaff?.phone || '',
        branchId: currentStaff?.branchId || 'gra',
        type: (currentStaff?.role === 'external_rider' ? 'external_courier' : 'internal_fleet') as any,
        status: 'active' as any,
        cashInHand: 0,
      })
    : (safeRiders.find((r) => r.id === activeRiderId) || safeRiders[0] || {
        id: 'unassigned',
        name: 'Unassigned Rider',
        phone: '',
        branchId: 'gra',
        type: 'internal_fleet',
        status: 'idle',
        cashInHand: 0,
      });

  // Assigned orders for this rider
  const assignedOrders = orders.filter(
    (ord) =>
      currentRider?.name &&
      ((ord as any).riderId === currentRider.id || ord.riderName?.toLowerCase().includes(currentRider.name.toLowerCase())) &&
      ord.orderStatus !== 'cancelled'
  );

  const activeDeliveries = assignedOrders.filter(
    (ord) => ord.orderStatus === 'out_for_delivery' || ord.orderStatus === 'ready'
  );

  const completedDeliveries = assignedOrders.filter(
    (ord) => ord.orderStatus === 'delivered'
  );

  // Open Handover Verification Modal
  const handleInitiateDeliveryHandover = (ord: Order) => {
    setVerifyingOrder(ord);
    setEnteredPin('');
    setPinError('');
    setCodCollectedConfirmed(ord.paymentMethod !== 'cash_on_delivery');
  };

  // Record Granular Transit Checkpoint
  const [checkpointStatusMsg, setCheckpointStatusMsg] = useState<{ [orderId: string]: string }>({});
  const handlePostCheckpoint = async (orderId: string, checkpointNote: string) => {
    try {
      setCheckpointStatusMsg((prev) => ({ ...prev, [orderId]: `Updating: ${checkpointNote}...` }));
      await fetch(`/api/orders/${orderId}/checkpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint: 'transit_checkpoint', checkpointNote }),
      });
      setCheckpointStatusMsg((prev) => ({ ...prev, [orderId]: `✅ Posted: ${checkpointNote}` }));
      setTimeout(() => {
        setCheckpointStatusMsg((prev) => {
          const copy = { ...prev };
          delete copy[orderId];
          return copy;
        });
      }, 3000);
    } catch (err) {
      console.error('Failed to post checkpoint:', err);
    }
  };

  // Complete Handover Verification with PIN
  const handleConfirmDeliveryHandover = () => {
    if (!verifyingOrder) return;

    const expectedPin =
      (verifyingOrder as any).pickupAuthorizationCode ||
      (verifyingOrder as any).deliveryPin;

    if (!expectedPin || enteredPin.trim() !== expectedPin) {
      setPinError('Invalid Handover PIN. Ask the customer to show the 4-digit code in their order tracker.');
      return;
    }

    if (verifyingOrder.paymentMethod === 'cash_on_delivery' && !codCollectedConfirmed) {
      setPinError(`Please verify and confirm collection of ${formatNaira(verifyingOrder.total)} cash.`);
      return;
    }

    // Complete order delivery
    updateOrderStatus(verifyingOrder.id, 'delivered');
    if (verifyingOrder.paymentMethod === 'cash_on_delivery') {
      updateRiderCashInHand(currentRider.id, currentRider.cashInHand + verifyingOrder.total);
    }

    setVerifyingOrder(null);
  };

  // Remit cash in hand to branch cashier
  const handleRemitCash = () => {
    const amount = currentRider.cashInHand;
    updateRiderCashInHand(currentRider.id, 0);
    setRemitSuccessMsg(`Successfully remitted ${formatNaira(amount)} to Branch Cashier Till.`);
    setTimeout(() => {
      setRemitSuccessMsg('');
      setIsRemitModalOpen(false);
    }, 2000);
  };

  // External Courier Release Code Verifier
  const verifyCourierRelease = () => {
    const clean = courierReleaseCode.trim().toUpperCase();
    const found = orders.find(
      (o) => o.orderNumber.toUpperCase() === clean || o.id.toUpperCase() === clean
    );

    if (found) {
      setCourierVerificationMsg(
        `✅ RELEASE AUTHORIZED: Order #${found.orderNumber} for "${found.deliveryDetails.customerName}" is verified for pickup.`
      );
    } else {
      setCourierVerificationMsg('❌ INVALID OR UNFOUND ORDER CODE. Please re-check the customer order ID.');
    }
  };

  const cleanWhatsAppPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('0') ? '234' + digits.slice(1) : digits;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" id="rider-portal-modal">
      <div className="bg-[#FAF7F2] rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border-2 border-[#FFC700] flex flex-col justify-between">
        
        {/* Rider Portal Header */}
        <div className="bg-[#4D080F] text-white p-5 rounded-t-3xl flex items-center justify-between sticky top-0 z-20 border-b-2 border-[#FFC700]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E62E00] text-[#FFC700] flex items-center justify-center font-titan text-xl">
              🛵
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-titan text-lg sm:text-xl text-white">
                  RIDER & DISPATCH PORTAL
                </h2>
                <span className="bg-[#FFC700] text-[#4D080F] text-[10px] font-titan uppercase px-2 py-0.5 rounded-full">
                  Live Hub
                </span>
              </div>
              <p className="text-xs text-white/80 font-montserrat">
                Choplife Fleet & External Courier Pickups
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsRiderPortalOpen(false)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Authentication Notice if not authenticated */}
        {!currentStaff ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-red-100 text-[#E62E00] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="font-titan text-xl text-[#4D080F]">Rider Authentication Required</h3>
            <p className="text-xs text-[#7A6A65] font-montserrat max-w-md mx-auto leading-relaxed">
              For operational security, food hygiene chain-of-custody, and cash reconciliation, dispatch tasks and COD collection slips are strictly restricted to authenticated riders.
            </p>
            <button
              onClick={() => {
                setIsRiderPortalOpen(false);
                setIsStaffLoginModalOpen(true);
              }}
              className="bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-sm px-6 py-3 rounded-2xl shadow-lg transition-transform active:scale-95 inline-flex items-center gap-2"
              id="rider-modal-login-btn"
            >
              <KeyRound className="w-4 h-4" />
              <span>Log In with Rider Terminal PIN</span>
            </button>
          </div>
        ) : (
          <>
            {/* Rider Identity Header */}
            <div className="bg-white p-4 border-b border-[#E5DEC9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {isRiderRole ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-titan uppercase text-emerald-700 tracking-wider">
                      VERIFIED RIDER SESSION
                    </span>
                  </div>
                  <p className="font-titan text-base text-[#241311]">{currentStaff.name}</p>
                  <p className="text-[11px] text-[#7A6A65] font-mono">
                    Staff ID: {currentStaff.staffId || currentStaff.id} • {currentStaff.branchId.toUpperCase()} Branch
                  </p>
                </div>
              ) : isSupervisorRole ? (
                <div>
                  <label className="text-[10px] font-titan uppercase text-gray-500 block mb-1">
                    SUPERVISOR DISPATCH MONITOR — SELECT RIDER:
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-md">
                    {safeRiders.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setActiveRiderId(r.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all shrink-0 ${
                          activeRiderId === r.id
                            ? 'bg-[#E62E00] text-white shadow-xs'
                            : 'bg-[#FAF7F2] text-[#4D080F] border border-[#E5DEC9]'
                        }`}
                      >
                        {r.name} ({r.type === 'internal_fleet' ? 'Fleet' : 'Courier'})
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-[#4D080F]">{currentStaff.name}</p>
                  <p className="text-[11px] text-[#7A6A65]">Logged in as: {currentStaff.role}</p>
                </div>
              )}

              {/* Daily Stats Badge & Cash Remittance */}
              <div className="bg-[#FFF8E7] px-3.5 py-2 rounded-xl border border-[#FFC700] text-xs font-montserrat flex items-center gap-4 self-stretch sm:self-auto justify-between">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Today Drops</p>
                  <p className="font-titan text-sm text-[#4D080F]">{completedDeliveries.length} completed</p>
                </div>
                <div className="border-l border-amber-300 pl-3 flex items-center gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Cash In Hand</p>
                    <p className="font-titan text-sm text-[#E62E00]">{formatNaira(currentRider.cashInHand)}</p>
                  </div>
                  {currentRider.cashInHand > 0 && (
                    <button
                      onClick={() => setIsRemitModalOpen(true)}
                      className="px-2.5 py-1 bg-[#15803D] hover:bg-[#166534] text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-xs transition-all"
                      title="Remit cash to branch cashier"
                    >
                      <ArrowRightLeft className="w-3 h-3" /> Remit
                    </button>
                  )}
                </div>
              </div>
            </div>

        {/* Main Content Area */}
        <div className="p-5 sm:p-6 space-y-6 flex-1">
          
          {/* Section 1: Active Deliveries Queue */}
          <div className="space-y-3">
            <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-[#E62E00]" />
              ACTIVE DELIVERIES ({activeDeliveries.length})
            </h3>

            {activeDeliveries.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-[#E5DEC9] text-gray-500 text-xs font-montserrat space-y-1">
                <Bike className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="font-bold text-[#241311]">No pending delivery runs right now.</p>
                <p>Stand by at the kitchen counter for the next dispatch alert.</p>
              </div>
            ) : (
              activeDeliveries.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-[#FFC700] shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between border-b pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-titan text-base text-[#E62E00]">
                          #{ord.orderNumber}
                        </span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-titan uppercase px-2 py-0.5 rounded-full">
                          {ord.orderStatus === 'ready' ? 'Ready at Kitchen' : 'En Route to Customer'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-montserrat mt-0.5">
                        Payment: <strong>{ord.paymentMethod.replace(/_/g, ' ').toUpperCase()}</strong> ({formatNaira(ord.total)})
                      </p>
                    </div>

                    <span className="font-titan text-base text-[#241311]">
                      {formatNaira(ord.total)}
                    </span>
                  </div>

                  {/* Customer & Location */}
                  <div className="space-y-2 text-xs font-montserrat">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#241311] text-sm">
                        {ord.deliveryDetails.customerName}
                      </span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${ord.deliveryDetails.customerPhone}`}
                          className="px-2.5 py-1.5 bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#E62E00] border border-[#E5DEC9] rounded-xl font-bold flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call
                        </a>
                        <a
                          href={`https://wa.me/${cleanWhatsAppPhone(ord.deliveryDetails.customerPhone)}?text=${encodeURIComponent(
                            `Hello ${ord.deliveryDetails.customerName}, this is ${currentRider.name} from Choplife Republic dispatch. I am on my way with your order #${ord.orderNumber}!`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] border border-[#25D366]/30 rounded-xl font-bold flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" /> WhatsApp
                        </a>
                      </div>
                    </div>

                    <div className="p-3 bg-[#FAF7F2] rounded-xl flex items-start gap-2 text-gray-700">
                      <MapPin className="w-4 h-4 text-[#E62E00] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-[#241311]">{ord.deliveryDetails.address}</p>
                        <p className="text-[11px] text-gray-500">Zone: {ord.deliveryDetails.deliveryZone} {ord.deliveryDetails.landmark ? `• Near ${ord.deliveryDetails.landmark}` : ''}</p>
                      </div>
                    </div>
                  </div>

                  {/* Live Transit Checkpoint Status */}
                  {ord.orderStatus === 'ready' ? (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center justify-between">
                      <span className="text-xs text-amber-900 font-montserrat font-bold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Ready for pickup at kitchen pass
                      </span>
                      <button
                        onClick={() => {
                          updateOrderStatus(ord.id, 'out_for_delivery');
                          handlePostCheckpoint(ord.id, 'Departed Kitchen Pass');
                        }}
                        className="px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-titan uppercase rounded-lg shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <Bike className="w-3.5 h-3.5 text-[#FFC700]" />
                        Depart Branch
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#FFF8E7] p-3 rounded-xl border border-[#FFC700]/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-titan uppercase text-[#4D080F] flex items-center gap-1">
                          <Bike className="w-3 h-3 text-[#E62E00]" />
                          LIVE TRANSIT CHECKPOINT
                        </span>
                        {checkpointStatusMsg[ord.id] ? (
                          <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full animate-pulse">
                            {checkpointStatusMsg[ord.id]}
                          </span>
                        ) : (ord as any).riderCheckpoint ? (
                          <span className="text-[10px] bg-white border border-[#FFC700] text-[#4D080F] font-bold px-2 py-0.5 rounded-full">
                            Current: {(ord as any).riderCheckpoint}
                          </span>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: 'Departed Hub' },
                          { label: "Passing Ring Rd" },
                          { label: 'At Gate / Ringing' },
                        ].map((cp) => (
                          <button
                            key={cp.label}
                            type="button"
                            onClick={() => handlePostCheckpoint(ord.id, cp.label)}
                            className="py-1.5 px-2 bg-white hover:bg-[#4D080F] hover:text-[#FFC700] border border-[#E5DEC9] rounded-lg text-[10px] font-montserrat font-bold text-[#241311] transition-all text-center shadow-2xs active:scale-95"
                          >
                            {cp.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons for Rider */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t">
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(`${ord.deliveryDetails.address}, Benin City`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#241311] text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Navigation className="w-4 h-4 text-blue-600" />
                      Open Google Maps
                    </a>

                    <button
                      onClick={() => handleInitiateDeliveryHandover(ord)}
                      className="py-2.5 rounded-xl bg-[#E62E00] hover:bg-[#c92800] text-white text-xs font-titan uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <KeyRound className="w-4 h-4 text-[#FFC700]" />
                      Handover & Verify PIN
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Section 2: External Courier Release Authorization Check */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5DEC9] space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h3 className="font-titan text-xs text-[#4D080F] uppercase">
                EXTERNAL COURIER / CHOWDECK PICKUP RELEASE
              </h3>
            </div>
            <p className="text-xs text-gray-600 font-montserrat">
              For Chowdeck, Max, or private dispatch riders picking up orders on behalf of online customers. Enter the 5-digit Order ID to verify handover authorization.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. CL-73921 or 73921"
                value={courierReleaseCode}
                onChange={(e) => setCourierReleaseCode(e.target.value)}
                className="flex-1 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
              />
              <button
                onClick={verifyCourierRelease}
                className="px-4 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] text-xs font-titan uppercase tracking-wider"
              >
                Verify Release
              </button>
            </div>

            {courierVerificationMsg && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-montserrat text-blue-900">
                {courierVerificationMsg}
              </div>
            )}
          </div>

        </div>
        </>
        )}

      </div>

      {/* ========================================================================= */}
      {/* HANDOVER PIN VERIFICATION MODAL */}
      {/* ========================================================================= */}
      {verifyingOrder && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-[#FFC700] animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#4D080F] text-[#FFC700] flex items-center justify-center font-titan">
                  🔐
                </div>
                <div>
                  <h3 className="font-titan text-base text-[#4D080F]">Verify Delivery Handover</h3>
                  <p className="text-xs text-gray-500 font-montserrat">Order #{verifyingOrder.orderNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setVerifyingOrder(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Address Details */}
            <div className="p-3 bg-white rounded-2xl border border-[#E5DEC9] text-xs font-montserrat space-y-1">
              <div className="flex justify-between font-bold text-[#241311]">
                <span>{verifyingOrder.deliveryDetails.customerName}</span>
                <span className="text-[#E62E00]">{formatNaira(verifyingOrder.total)}</span>
              </div>
              <p className="text-gray-500">{verifyingOrder.deliveryDetails.address}</p>
            </div>

            {/* Cash on Delivery Collection Checkbox */}
            {verifyingOrder.paymentMethod === 'cash_on_delivery' && (
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-300 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs font-montserrat">
                  <Banknote className="w-4 h-4 text-amber-700" />
                  CASH ON DELIVERY COLLECTION REQUIRED
                </div>
                <label className="flex items-start gap-2.5 text-xs text-amber-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={codCollectedConfirmed}
                    onChange={(e) => setCodCollectedConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-[#E62E00] focus:ring-[#FFC700]"
                  />
                  <span>
                    I confirm that I have collected <strong>{formatNaira(verifyingOrder.total)}</strong> cash from the customer.
                  </span>
                </label>
              </div>
            )}

            {/* PIN Input Field */}
            <div className="space-y-2">
              <label className="block text-xs font-titan uppercase text-[#4D080F]">
                Customer Handover 4-Digit PIN:
              </label>
              <input
                type="text"
                maxLength={4}
                autoFocus
                placeholder="• • • •"
                value={enteredPin}
                onChange={(e) => {
                  setEnteredPin(e.target.value.replace(/\D/g, ''));
                  setPinError('');
                }}
                className="w-full text-center tracking-[0.5em] text-2xl font-mono font-black py-3 rounded-2xl bg-white border-2 border-[#FFC700] text-[#4D080F] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
              />
              <p className="text-[11px] text-gray-500 text-center font-montserrat">
                Ask the customer for the 4-digit security PIN displayed on their live order tracking screen.
              </p>
            </div>

            {/* Error Message */}
            {pinError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-montserrat text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setVerifyingOrder(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-montserrat font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeliveryHandover}
                className="flex-1 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-titan uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-[#FFC700]" />
                Confirm & Settle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASH REMITTANCE TO TILL MODAL */}
      {/* ========================================================================= */}
      {isRemitModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border-2 border-[#15803D] animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#15803D] text-white flex items-center justify-center font-titan">
                  💵
                </div>
                <div>
                  <h3 className="font-titan text-base text-[#241311]">Remit Cash to Till</h3>
                  <p className="text-xs text-gray-500 font-montserrat">Driver Shift Reconciliation</p>
                </div>
              </div>
              <button
                onClick={() => setIsRemitModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] text-center space-y-1">
              <span className="text-xs text-gray-500 font-montserrat">Current Cash In Hand</span>
              <p className="font-titan text-2xl text-[#15803D]">{formatNaira(currentRider.cashInHand)}</p>
              <p className="text-[11px] text-gray-400 font-montserrat">Rider: {currentRider.name}</p>
            </div>

            <p className="text-xs text-gray-600 font-montserrat leading-relaxed">
              Hand over the physical cash to the branch cashier. Once confirmed, your cash-in-hand balance will be cleared and logged into the active cashier till.
            </p>

            {remitSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-montserrat text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{remitSuccessMsg}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsRemitModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-montserrat font-bold rounded-xl"
              >
                Close
              </button>
              <button
                onClick={handleRemitCash}
                disabled={currentRider.cashInHand === 0 || !!remitSuccessMsg}
                className="flex-1 py-2.5 bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white text-xs font-titan uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                Confirm Remittance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
