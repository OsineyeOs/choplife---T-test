import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BranchId, Order, OrderStatus } from '../../types';
import {
  X,
  Truck,
  Bike,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  MessageSquare,
  ExternalLink,
  UserCheck,
  RotateCw,
  Sliders,
  DollarSign,
} from 'lucide-react';

export const DispatchHubModal: React.FC = () => {
  const {
    isRiderPortalOpen,
    setIsRiderPortalOpen,
    orders,
    branches,
    selectedBranchId,
    updateOrderStatus,
    riders,
    assignRiderToOrder,
    formatNaira,
    getBranchWhatsAppUrl,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'dispatch_queue' | 'rider_fleet' | 'external_couriers'>('dispatch_queue');
  const [branchFilter, setBranchFilter] = useState<BranchId>(selectedBranchId);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRiderForAssign, setSelectedRiderForAssign] = useState<Record<string, string>>({});

  const safeRiders = Array.isArray(riders) ? riders : [];

  // Filter orders for delivery/pickup dispatch
  const deliveryOrders = orders.filter((ord) => {
    const matchesBranch = ord.branchId === branchFilter;
    const matchesStatus =
      statusFilter === 'all'
        ? ord.orderStatus !== 'delivered' && ord.orderStatus !== 'cancelled'
        : ord.orderStatus === statusFilter;
    const matchesSearch =
      ord.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.deliveryDetails.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.deliveryDetails.address.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesBranch && matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'received':
        return <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-[10px] font-titan uppercase">New Order</span>;
      case 'confirmed':
        return <span className="bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full text-[10px] font-titan uppercase">Confirmed</span>;
      case 'preparing':
        return <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-titan uppercase">In Kitchen</span>;
      case 'ready':
        return <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-titan uppercase animate-pulse">Ready for Dispatch</span>;
      case 'out_for_delivery':
        return <span className="bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full text-[10px] font-titan uppercase">On the Road</span>;
      case 'delivered':
        return <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full text-[10px] font-titan uppercase">Delivered</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded-full text-[10px] font-titan uppercase">{status}</span>;
    }
  };

  const handleQuickAssign = (orderId: string) => {
    const riderId = selectedRiderForAssign[orderId];
    if (riderId) {
      assignRiderToOrder(orderId, riderId);
    }
  };

  const getWhatsAppRiderDispatchText = (ord: Order) => {
    const text = `🛵 *CHOPLIFE DISPATCH ASSIGNMENT*\nOrder: *#${ord.orderNumber}*\nCustomer: *${ord.deliveryDetails.customerName}* (${ord.deliveryDetails.customerPhone})\nAddress: *${ord.deliveryDetails.address}*\nZone: *${ord.deliveryDetails.deliveryZone}*\nTotal to Collect: *${formatNaira(ord.total)}* (${ord.paymentMethod === 'cash_on_delivery' ? 'CASH TO COLLECT' : 'ALREADY PAID'})\n\nPlease confirm pickup from kitchen!`;
    return encodeURIComponent(text);
  };

  // We show this modal when Dispatch Hub is requested
  // Note: AppContext also has a dedicated RiderPortalModal for individual drivers
  return (
    <div className="space-y-4">
      {/* Top Controls: Branch Switcher & Quick Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-titan uppercase text-[#4D080F]">BRANCH HUB:</span>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setBranchFilter(b.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all ${
                branchFilter === b.id
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                  : 'bg-white text-[#4D080F] border border-[#E5DEC9]'
              }`}
            >
              {b.shortName.replace(' Branch', '')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Status Tabs */}
          <div className="flex bg-white rounded-xl p-1 border border-[#E5DEC9] text-xs">
            {[
              { id: 'all', label: 'Active Queue' },
              { id: 'ready', label: 'Ready' },
              { id: 'out_for_delivery', label: 'En Route' },
              { id: 'delivered', label: 'Completed' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded-lg font-montserrat font-bold ${
                  statusFilter === st.id
                    ? 'bg-[#E62E00] text-white shadow-xs'
                    : 'text-gray-600 hover:text-[#241311]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="relative w-40 sm:w-56">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search order #, name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E5DEC9] rounded-xl pl-8 pr-3 py-1.5 text-xs font-montserrat text-[#241311]"
            />
          </div>
        </div>
      </div>

      {/* Orders Dispatch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deliveryOrders.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-10 text-center border border-[#E5DEC9] space-y-2">
            <Truck className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="font-titan text-base text-[#4D080F]">No Orders in This Dispatch View</h3>
            <p className="text-xs font-montserrat text-gray-500">
              New website and POS delivery orders will appear here for rider assignment.
            </p>
          </div>
        ) : (
          deliveryOrders.map((ord) => (
            <div
              key={ord.id}
              className="bg-white rounded-2xl p-4 border border-[#E5DEC9] hover:border-[#FFC700] transition-all shadow-xs space-y-3 flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-titan text-sm text-[#E62E00]">
                      #{ord.orderNumber}
                    </span>
                    {getStatusBadge(ord.orderStatus)}
                  </div>
                  <p className="text-[11px] text-gray-500 font-montserrat mt-0.5">
                    {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {ord.items.length} items • {ord.orderChannel.toUpperCase()}
                  </p>
                </div>

                <span className="font-titan text-sm text-[#241311]">
                  {formatNaira(ord.total)}
                </span>
              </div>

              {/* Customer & Address Details */}
              <div className="space-y-1.5 text-xs font-montserrat">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#241311]">
                    {ord.deliveryDetails.customerName}
                  </span>
                  <a
                    href={`tel:${ord.deliveryDetails.customerPhone}`}
                    className="text-[#E62E00] hover:underline flex items-center gap-1 font-bold"
                  >
                    <Phone className="w-3 h-3" /> {ord.deliveryDetails.customerPhone}
                  </a>
                </div>

                <div className="text-gray-600 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#E62E00] shrink-0 mt-0.5" />
                  <span>{ord.deliveryDetails.address} ({ord.deliveryDetails.deliveryZone})</span>
                </div>

                {/* Items preview */}
                <div className="p-2 bg-[#FAF7F2] rounded-xl text-[11px] text-gray-700">
                  {ord.items.map((it, i) => (
                    <span key={i} className="inline-block mr-2">
                      <strong>{it.quantity}x</strong> {it.product.name}{i < ord.items.length - 1 ? ',' : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Rider Assignment & Status Progression Bar */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                {ord.riderName ? (
                  <div className="flex items-center justify-between bg-green-50 p-2 rounded-xl border border-green-200 text-xs font-montserrat">
                    <div className="flex items-center gap-1.5 text-green-900 font-bold">
                      <Bike className="w-4 h-4 text-green-700" />
                      <span>Rider: {ord.riderName}</span>
                    </div>

                    <a
                      href={`https://wa.me/?text=${getWhatsAppRiderDispatchText(ord)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-700 hover:text-green-900 font-bold flex items-center gap-1 text-[11px]"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Dispatch
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedRiderForAssign[ord.id] || ''}
                      onChange={(e) =>
                        setSelectedRiderForAssign({
                          ...selectedRiderForAssign,
                          [ord.id]: e.target.value,
                        })
                      }
                      className="flex-1 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs font-montserrat text-[#241311]"
                    >
                      <option value="">Select Delivery Rider...</option>
                      {safeRiders.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.partnerName} - {r.currentStatus})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleQuickAssign(ord.id)}
                      disabled={!selectedRiderForAssign[ord.id]}
                      className="px-3 py-1.5 rounded-xl bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] text-xs font-titan uppercase tracking-wider disabled:opacity-40"
                    >
                      Assign
                    </button>
                  </div>
                )}

                {/* Quick Status Buttons */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  {[
                    { id: 'preparing', label: 'Kitchen' },
                    { id: 'ready', label: 'Ready' },
                    { id: 'out_for_delivery', label: 'Dispatched' },
                    { id: 'delivered', label: 'Delivered' },
                  ].map((step) => (
                    <button
                      key={step.id}
                      onClick={() => updateOrderStatus(ord.id, step.id as OrderStatus)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-titan uppercase transition-all ${
                        ord.orderStatus === step.id
                          ? 'bg-[#E62E00] text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {step.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Live Rider Fleet Status Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5DEC9] space-y-3">
        <h4 className="font-titan text-xs text-[#4D080F] uppercase flex items-center gap-2">
          <Bike className="w-4 h-4 text-[#E62E00]" />
          ACTIVE CHOPLIFE FLEET & COURIER RIDERS
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {safeRiders.map((r) => (
            <div
              key={r.id}
              className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] space-y-1 text-xs font-montserrat"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#241311]">{r.name}</span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    r.currentStatus === 'available'
                      ? 'bg-green-500'
                      : r.currentStatus === 'on_delivery'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-gray-400'
                  }`}
                  title={r.currentStatus}
                />
              </div>
              <p className="text-[10px] text-gray-500">{r.partnerName} • {r.bikeNumber}</p>
              <div className="flex justify-between text-[11px] pt-1 border-t border-gray-200">
                <span>Deliveries: <strong>{r.totalDeliveriesToday}</strong></span>
                <span>Cash: <strong>{formatNaira(r.cashInHand)}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
