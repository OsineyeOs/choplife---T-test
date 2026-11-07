import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { OrderStatus } from '../../types';
import {
  X,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Truck,
  Flame,
  Package,
  Store,
  ChevronRight,
  Star,
  Smartphone,
  MessageSquare,
  Printer,
  Bike,
  Navigation,
} from 'lucide-react';

const ORDER_STEPS: { status: OrderStatus; label: string; icon: React.ReactNode; desc: string }[] = [
  { status: 'received', label: 'Order Confirmed', icon: <CheckCircle2 className="w-4 h-4" />, desc: 'Kitchen acknowledged ticket' },
  { status: 'preparing', label: 'In Kitchen / Grilling', icon: <Flame className="w-4 h-4" />, desc: 'Freshly firing your feast' },
  { status: 'ready', label: 'Thermal Packaged', icon: <Package className="w-4 h-4" />, desc: 'Sealed for heat retention' },
  { status: 'out_for_delivery', label: 'Rider Dispatched', icon: <Truck className="w-4 h-4" />, desc: 'En route in Benin City' },
  { status: 'delivered', label: 'Delivered / Enjoyed', icon: <Sparkles className="w-4 h-4" />, desc: '100% Maximum Enjoyment' },
];

export const OrderTrackerModal: React.FC = () => {
  const {
    activeTrackingOrder,
    setActiveTrackingOrder,
    reorder,
    formatNaira,
    getBranchWhatsAppUrl,
    setIsReviewModalOpen,
  } = useApp();

  const [simulatedMinutesLeft, setSimulatedMinutesLeft] = useState(28);
  const [orderNotifs, setOrderNotifs] = useState<any[]>([]);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState<boolean>(false);
  const [liveOrder, setLiveOrder] = useState<any>(activeTrackingOrder);

  useEffect(() => {
    setLiveOrder(activeTrackingOrder);
  }, [activeTrackingOrder]);

  // Live polling for real-time status and rider transit checkpoints
  useEffect(() => {
    if (!liveOrder?.id && !liveOrder?.orderNumber) return;
    const targetKey = liveOrder.id || liveOrder.orderNumber;
    let isMounted = true;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${targetKey}`);
        if (res.ok && isMounted) {
          const freshData = await res.json();
          setLiveOrder((prev: any) => {
            if (!prev) return freshData;
            return {
              ...prev,
              ...freshData,
              orderStatus: freshData.orderStatus || freshData.status || prev.orderStatus,
            };
          });
        }
      } catch (e) {
        // silent polling catch
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [liveOrder?.id, liveOrder?.orderNumber]);

  useEffect(() => {
    const orderNum = liveOrder?.orderNumber || activeTrackingOrder?.orderNumber;
    if (orderNum) {
      fetch(`/api/notifications?search=${orderNum}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setOrderNotifs(data);
        })
        .catch(() => {});
    }
  }, [liveOrder?.orderNumber, activeTrackingOrder?.orderNumber]);

  const order = liveOrder || activeTrackingOrder;

  useEffect(() => {
    if (!order) return;
    const interval = setInterval(() => {
      setSimulatedMinutesLeft((prev) => Math.max(1, prev - 1));
    }, 45000);
    return () => clearInterval(interval);
  }, [order]);

  if (!order) return null;

  const currentStepIndex = ORDER_STEPS.findIndex((s) => s.status === order.orderStatus);
  const activeStepIdx = currentStepIndex >= 0 ? currentStepIndex : 1;

  const handleReorderClick = () => {
    reorder(order);
    setActiveTrackingOrder(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      id="order-tracker-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setActiveTrackingOrder(null);
        }
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl border-2 border-[#FFC700] flex flex-col justify-between">
        
        {/* Header */}
        <div className="bg-[#4D080F] text-white p-5 sm:p-6 rounded-t-3xl flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center font-titan text-xl animate-pulse">
              🛵
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-titan text-lg sm:text-xl text-white">
                  LIVE ORDER TRACKER
                </h2>
                <span className="bg-[#E62E00] text-[#FFC700] font-titan text-[10px] px-2 py-0.5 rounded-full">
                  #{order.orderNumber}
                </span>
              </div>
              <p className="text-[11px] text-white/80 font-montserrat">
                Branch: <span className="font-bold text-[#FFC700]">{order.branchId.toUpperCase()}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTrackingOrder(null)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            id="close-tracker-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tracker Body */}
        <div className="p-5 sm:p-6 space-y-6 flex-1">
          
          {/* Estimated Delivery Time Countdown Box */}
          <div className="bg-gradient-to-br from-[#FFF8E7] to-[#FAF7F2] p-5 rounded-3xl border-2 border-[#FFC700] text-center space-y-2 shadow-sm">
            <span className="text-[10px] font-titan uppercase tracking-widest text-[#E62E00] block">
              ESTIMATED ARRIVAL TIME
            </span>
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-6 h-6 text-[#E62E00] animate-bounce" />
              <span className="font-titan text-3xl sm:text-4xl text-[#4D080F]">
                {order.orderStatus === 'delivered' ? 'DELIVERED' : `${simulatedMinutesLeft} - ${simulatedMinutesLeft + 15} MINS`}
              </span>
            </div>
            <p className="text-xs text-[#5C4D49] font-montserrat">
              {order.orderStatus === 'delivered'
                ? 'Your meal has been delivered. Enjoy yourself!'
                : `Dispatched from Choplife Republic to ${order.deliveryDetails.address || 'your destination'}`}
            </p>
          </div>

          {/* Gift Order Slip & Recipient Card */}
          {(Boolean((order as any).isGiftOrder) || Boolean(order.deliveryDetails?.isGiftOrder)) && (
            <div
              id="tracker-gift-order-slip"
              className="bg-gradient-to-br from-[#4D080F] to-[#241311] text-white p-4 sm:p-5 rounded-3xl border-2 border-[#FFC700] space-y-2.5 shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-titan uppercase tracking-widest text-[#FFC700] bg-white/10 px-2.5 py-1 rounded-full">
                  🎁 OFFICIAL CHOPLIFE GIFT SLIP
                </span>
                <span className="text-[11px] font-montserrat text-white/80">
                  Order #{order.orderNumber}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-montserrat pt-1">
                <div>
                  <span className="text-[10px] uppercase text-white/60 block">Delivering To (Recipient)</span>
                  <span className="font-bold text-[#FFC700]">
                    {order.deliveryDetails?.recipientName || (order as any).giftDetails?.recipientName} (
                    {order.deliveryDetails?.recipientPhone || (order as any).giftDetails?.recipientPhone})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-white/60 block">Sent With Love From</span>
                  <span className="font-bold text-white">
                    {order.deliveryDetails?.hideSenderIdentity || (order as any).giftDetails?.hideSenderIdentity
                      ? 'Anonymous Sender'
                      : order.deliveryDetails?.senderName ||
                        (order as any).giftDetails?.senderName ||
                        order.deliveryDetails?.customerName}
                  </span>
                </div>
              </div>
              {(order.deliveryDetails?.giftMessage || (order as any).giftDetails?.giftMessage) && (
                <div className="p-3 rounded-2xl bg-white/10 border border-[#FFC700]/30 text-xs font-montserrat italic text-[#FFF8E7]">
                  &ldquo;{order.deliveryDetails?.giftMessage || (order as any).giftDetails?.giftMessage}&rdquo;
                </div>
              )}
            </div>
          )}

          {/* Stepper Progress Bar */}
          <div className="space-y-4">
            <h3 className="font-titan text-xs text-[#4D080F] uppercase tracking-wider">
              ORDER PROGRESS & KITCHEN STATUS
            </h3>

            <div className="space-y-3 relative">
              {ORDER_STEPS.map((step, idx) => {
                const isPassed = idx <= activeStepIdx;
                const isCurrent = idx === activeStepIdx;

                return (
                  <div key={step.status} className="flex items-start gap-3 relative">
                    {/* Vertical connecting line */}
                    {idx < ORDER_STEPS.length - 1 && (
                      <div
                        className={`absolute left-4 top-8 w-0.5 h-8 -ml-px ${
                          idx < activeStepIdx ? 'bg-[#E62E00]' : 'bg-[#E5DEC9]'
                        }`}
                      />
                    )}

                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 font-bold transition-colors ${
                        isPassed
                          ? 'bg-[#E62E00] text-white shadow-xs'
                          : 'bg-[#FAF7F2] text-[#7A6A65] border border-[#E5DEC9]'
                      } ${isCurrent ? 'ring-4 ring-[#FFC700]/50' : ''}`}
                    >
                      {step.icon}
                    </div>

                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <p className={`font-titan text-xs sm:text-sm ${
                          isPassed ? 'text-[#4D080F]' : 'text-[#7A6A65]'
                        }`}>
                          {step.label}
                        </p>
                        {isCurrent && (
                          <span className="text-[10px] font-titan text-[#E62E00] bg-[#FFF8E7] px-2 py-0.5 rounded-full border border-[#FFC700]">
                            ACTIVE NOW
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#7A6A65] font-montserrat">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Handover OTP Verification PIN */}
          {order.orderType === 'delivery' && order.orderStatus !== 'delivered' && (
            <div className="bg-gradient-to-r from-[#FFF8E7] to-[#FAF7F2] p-4 rounded-2xl border-2 border-dashed border-[#FFC700] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFC700]/30 text-[#4D080F] flex items-center justify-center font-bold text-lg">
                  🔐
                </div>
                <div>
                  <p className="text-[10px] font-titan uppercase tracking-wider text-[#7A6A65]">
                    DELIVERY HANDOVER PIN
                  </p>
                  <p className="text-xs text-[#5C4D49] font-montserrat">
                    Give this 4-digit code to your dispatch rider upon arrival
                  </p>
                </div>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl border border-[#FFC700] shadow-xs flex items-center gap-2">
                <span className="font-mono font-black text-2xl tracking-[0.25em] text-[#E62E00]">
                  {(order as any).pickupAuthorizationCode || (order as any).deliveryPin || (order.id ? order.id.slice(-4).toUpperCase() : '----')}
                </span>
              </div>
            </div>
          )}

          {/* Dedicated Dispatch Rider Card */}
          {order.riderName && order.orderType === 'delivery' && (
            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E62E00] text-white flex items-center justify-center font-titan text-base">
                  🛵
                </div>
                <div>
                  <p className="text-[10px] text-[#7A6A65] font-montserrat uppercase font-bold">ASSIGNED RIDER</p>
                  <p className="font-titan text-xs sm:text-sm text-[#241311]">{order.riderName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <a
                  href={`tel:${order.riderPhone || '08037890123'}`}
                  className="flex-1 sm:flex-initial bg-white hover:bg-gray-100 text-[#4D080F] px-3 py-2 rounded-xl border border-[#E5DEC9] flex items-center justify-center gap-1.5 text-xs font-montserrat font-bold shadow-2xs"
                  title="Call Rider"
                >
                  <Phone className="w-3.5 h-3.5 text-[#E62E00]" />
                  <span>Call Rider</span>
                </a>
                <a
                  href={`https://wa.me/234${(order.riderPhone || '08037890123').replace(/^0/, '')}?text=${encodeURIComponent(`Hello, I am tracking my Choplife Republic order #${order.orderNumber}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-initial bg-[#25D366] hover:bg-[#20bd5a] text-white px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-montserrat font-bold shadow-2xs"
                  title="WhatsApp Rider"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          )}

          {/* Real-time Transit Checkpoint & Corridor Updates */}
          {(order.riderCheckpoint || order.orderStatus === 'out_for_delivery') && order.orderStatus !== 'delivered' && (
            <div className="bg-gradient-to-r from-[#FFF8E7] to-[#FAF7F2] p-4 rounded-2xl border-2 border-[#FFC700] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E62E00] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E62E00]"></span>
                  </span>
                  <span className="text-[10px] font-titan uppercase tracking-widest text-[#E62E00] flex items-center gap-1">
                    <Bike className="w-3.5 h-3.5 text-[#E62E00]" />
                    LIVE TRANSIT CHECKPOINT
                  </span>
                </div>
                {order.checkpointAt && (
                  <span className="text-[10px] font-montserrat text-gray-600 font-bold bg-white px-2 py-0.5 rounded-md border border-[#E5DEC9]">
                    Updated {new Date(order.checkpointAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-titan text-sm sm:text-base text-[#4D080F]">
                    {order.riderCheckpoint || 'En Route to Destination'}
                  </p>
                  <p className="text-[11px] text-[#5C4D49] font-montserrat">
                    Dispatch team is active in Benin City corridor
                  </p>
                </div>
                <div className="w-9 h-9 rounded-2xl bg-[#4D080F] text-[#FFC700] flex items-center justify-center font-titan text-base shrink-0 shadow-xs">
                  <Navigation className="w-4 h-4 text-[#FFC700] animate-spin" style={{ animationDuration: '6s' }} />
                </div>
              </div>

              {/* Transit Route Progression Bar */}
              <div className="pt-2 border-t border-[#E5DEC9] flex items-center justify-between text-[10px] font-montserrat font-bold text-gray-500">
                <span className="text-[#4D080F] flex items-center gap-1">
                  <Store className="w-3 h-3 text-[#E62E00]" /> {order.branchId.toUpperCase()} Hub
                </span>
                <span className="text-gray-300">━━━━━</span>
                <span className={order.riderCheckpoint ? 'text-[#E62E00]' : 'text-gray-400'}>
                  King's Square / Ring Rd
                </span>
                <span className="text-gray-300">━━━━━</span>
                <span className="text-emerald-700 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600" /> Customer Gate
                </span>
              </div>
            </div>
          )}

          {/* Live Multi-Channel SMS & WhatsApp Status Updates */}
          {orderNotifs.length > 0 && (
            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-titan text-xs text-[#4D080F] uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#E62E00]" />
                  SMS & WhatsApp Updates ({orderNotifs.length})
                </h4>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Handset Delivered
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {orderNotifs.map((n: any) => (
                  <div
                    key={n.id}
                    className="p-2.5 rounded-xl bg-white border border-[#E5DEC9]/80 text-[11px] font-montserrat space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span className="font-bold text-[#241311] flex items-center gap-1">
                        {n.channel === 'whatsapp' ? (
                          <MessageSquare className="w-3 h-3 text-emerald-600 inline" />
                        ) : (
                          <Smartphone className="w-3 h-3 text-blue-600 inline" />
                        )}
                        {n.channel.toUpperCase()} via {n.provider === 'termii' ? 'Termii DND' : 'Meta Cloud API'}
                      </span>
                      <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-gray-700 leading-snug">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items Summary in Order */}
          <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] space-y-2">
            <h4 className="font-titan text-xs text-[#4D080F] uppercase tracking-wider">
              ORDERED ITEMS ({order.items.length})
            </h4>
            <div className="space-y-1.5 divide-y divide-[#E5DEC9]/60">
              {order.items.map((item) => (
                <div key={item.id} className="pt-1.5 flex items-center justify-between text-xs font-montserrat">
                  <span className="text-[#241311] font-semibold">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="font-titan text-[#E62E00]">
                    {formatNaira(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-[#E5DEC9] flex items-center justify-between font-titan text-sm text-[#4D080F]">
              <span>TOTAL PAID</span>
              <span className="text-base text-[#E62E00]">{formatNaira(order.total)}</span>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-[#FAF7F2] p-4 sm:p-5 rounded-b-3xl border-t border-[#E5DEC9] flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsPrintingReceipt(true)}
              className="flex-1 sm:flex-initial px-3.5 py-3 bg-white hover:bg-stone-50 text-[#4D080F] border border-[#E5DEC9] font-titan text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
              id="tracker-print-receipt-btn"
              title="Print Customer Thermal Receipt"
            >
              <Printer className="w-4 h-4 text-[#E62E00]" />
              <span>Receipt</span>
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Tracking my Choplife Republic Feast! Order #${order.orderNumber} is ${order.orderStatus.replace('_', ' ').toUpperCase()} at ${order.branchId.toUpperCase()} branch.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial px-3.5 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-titan text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
              id="tracker-whatsapp-share-btn"
              title="Share Order Update on WhatsApp"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>Share</span>
            </a>
          </div>

          <button
            onClick={handleReorderClick}
            className="w-full sm:w-auto flex-1 bg-[#4D080F] hover:bg-[#3D0007] text-[#FFC700] font-titan text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
            id="tracker-reorder-btn"
          >
            <RotateCcw className="w-4 h-4" />
            <span>REORDER MEAL</span>
          </button>

          <button
            onClick={() => {
              setActiveTrackingOrder(null);
              setIsReviewModalOpen(true);
            }}
            className="w-full sm:w-auto bg-[#FFC700] hover:bg-[#FFD733] text-[#4D080F] font-titan text-xs py-3 px-4 rounded-2xl shadow-sm flex items-center justify-center gap-1.5 shrink-0"
            id="tracker-rate-meal-btn"
          >
            <Star className="w-4 h-4 fill-[#4D080F]" />
            <span>Rate</span>
          </button>
        </div>

      </div>

      {/* 80mm CUSTOMER THERMAL RECEIPT MODAL */}
      {isPrintingReceipt && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white text-black rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col font-mono">
            {/* Modal Controls */}
            <div className="p-3 bg-[#4D080F] text-white rounded-t-2xl flex items-center justify-between font-sans print:hidden">
              <span className="font-titan text-xs flex items-center gap-1.5 text-[#FFC700]">
                <Printer className="w-4 h-4" /> Customer Thermal Receipt (80mm)
              </span>
              <button
                onClick={() => setIsPrintingReceipt(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="p-5 text-xs space-y-3 leading-tight print:p-0 print:m-0">
              <div className="text-center pb-2 border-b-2 border-dashed border-stone-400">
                <p className="font-black text-base uppercase tracking-wider">CHOPLIFE REPUBLIC</p>
                <p className="text-[10px] font-bold text-stone-600">
                  Maximum Enjoyment Guaranteed
                </p>
                <p className="text-[11px] font-bold mt-1">
                  {order.branchId.toUpperCase()} BRANCH • BENIN CITY
                </p>
              </div>

              <div className="space-y-1 text-[11px] border-b border-stone-300 pb-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">ORDER NO:</span>
                  <span className="font-bold">#{order.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">DATE:</span>
                  <span>{new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">CUSTOMER:</span>
                  <span className="font-bold">{order.deliveryDetails.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">TYPE:</span>
                  <span className="font-bold uppercase">{order.deliveryDetails.orderType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">PAYMENT:</span>
                  <span className="font-bold uppercase text-emerald-800">{order.paymentMethod || 'Online Paid'}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5 py-1 border-b-2 border-dashed border-stone-400">
                <div className="flex justify-between font-bold text-[10px] text-stone-600 uppercase">
                  <span>ITEM</span>
                  <span>AMOUNT</span>
                </div>
                {order.items.map((it, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between font-bold text-xs">
                      <span>{it.quantity}x {it.product.name}</span>
                      <span>₦{(it.unitPrice * it.quantity).toLocaleString()}</span>
                    </div>
                    {it.customization && (
                      <div className="pl-3 text-[10px] text-stone-600 font-sans">
                        {it.customization.selectedOptions?.map((o, i) => (
                          <div key={i}>• {o.name}: {o.choice}</div>
                        ))}
                        {it.customization.selectedAddOns?.map((a, i) => (
                          <div key={i}>+ {a.name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-xs border-b border-stone-300 pb-2">
                <div className="flex justify-between">
                  <span className="text-stone-600">Subtotal:</span>
                  <span>₦{order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toLocaleString()}</span>
                </div>
                {order.deliveryFee ? (
                  <div className="flex justify-between">
                    <span className="text-stone-600">Delivery Fee:</span>
                    <span>₦{order.deliveryFee.toLocaleString()}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-black text-sm pt-1 border-t border-stone-300">
                  <span>TOTAL PAID:</span>
                  <span>₦{order.total.toLocaleString()}</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-stone-600 space-y-1">
                <p className="font-bold">THANK YOU FOR YOUR PATRONAGE!</p>
                <p>Support: choplife.republic@gmail.com</p>
                <p>Eat Well. Live Soft. Chop Life.</p>
              </div>
            </div>

            {/* Print Footer */}
            <div className="p-4 bg-stone-100 border-t border-stone-300 rounded-b-2xl flex items-center justify-between gap-3 font-sans print:hidden">
              <button
                onClick={() => setIsPrintingReceipt(false)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 font-titan text-xs rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-[#E62E00] hover:bg-[#c92800] text-white font-titan text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
