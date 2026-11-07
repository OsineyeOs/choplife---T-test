import React, { useState, useEffect } from 'react';
import { BranchId, StaffUser } from '../../types';
import {
  Search,
  Phone,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  User,
  ExternalLink,
  Plus,
  Tag,
  Gift,
  RefreshCw,
  Send,
  HelpCircle,
  Truck,
  ChefHat,
  ChevronRight,
} from 'lucide-react';

interface CustomerCareHubProps {
  activeBranchId: BranchId;
  currentStaff: StaffUser;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const CustomerCareHub: React.FC<CustomerCareHubProps> = ({
  activeBranchId,
  currentStaff,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'lookup' | 'tickets'>('lookup');

  // New Ticket Form State
  const [isTicketModalOpen, setIsTicketModalOpen] = useState<boolean>(false);
  const [ticketCategory, setTicketCategory] = useState<string>('delivery_delay');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [ticketDescription, setTicketDescription] = useState<string>('');

  // Resolve Ticket Form State
  const [resolvingTicket, setResolvingTicket] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [compensationType, setCompensationType] = useState<string>('none');
  const [compensationAmount, setCompensationAmount] = useState<string>('');

  // Edit Delivery Details Modal State
  const [isEditDeliveryOpen, setIsEditDeliveryOpen] = useState<boolean>(false);
  const [editAddress, setEditAddress] = useState<string>('');
  const [editLandmark, setEditLandmark] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [careNoteInput, setCareNoteInput] = useState<string>('');

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('choplife_staff_token') || '';
    return {
      Authorization: `Bearer ${token}`,
      ...extra,
    };
  };

  // Fetch Orders
  const fetchOrders = async (query = '') => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const url = `/api/orders?branchId=${activeBranchId}${query ? `&search=${encodeURIComponent(query)}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const safeOrders = Array.isArray(data) ? data : [];
        setOrders(safeOrders);
        if (safeOrders.length > 0 && !selectedOrder) {
          setSelectedOrder(safeOrders[0]);
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        setFetchError(errBody.error || `Order lookup request failed (HTTP ${res.status})`);
      }
    } catch (err: any) {
      console.error('Failed to load orders for care:', err);
      setFetchError(err?.message || 'Unable to reach order lookup service.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Tickets
  const fetchTickets = async () => {
    setTicketsError(null);
    try {
      const res = await fetch(`/api/customercare/tickets?branchId=${activeBranchId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setTicketsError(errBody.error || `Ticket feed request failed (HTTP ${res.status})`);
      }
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
      setTicketsError(err?.message || 'Unable to reach customer care ticket service.');
    }
  };

  useEffect(() => {
    fetchOrders(searchQuery);
    fetchTickets();
  }, [activeBranchId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(searchQuery);
  };

  // Fast-track order in KDS / Dispatch
  const handleFastTrackOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/customer-care`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          priority: 'urgent',
          customerCareNote: `Fast-tracked by Customer Support (${currentStaff.name}) for immediate kitchen & dispatch priority`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data.order);
        setOrders((prev) => prev.map((o) => (o.id === data.order.id ? data.order : o)));
        showToast(`Order #${data.order.orderNumber} marked as URGENT priority!`);
      } else {
        showToast('Failed to fast-track order', 'error');
      }
    } catch (err) {
      showToast('Error fast-tracking order', 'error');
    }
  };

  // Save edited delivery details
  const handleSaveDeliveryDetails = async () => {
    if (!selectedOrder) return;
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/customer-care`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          deliveryAddress: editAddress,
          landmark: editLandmark,
          deliveryNotes: editNotes,
          customerCareNote: careNoteInput || 'Delivery details updated by Customer Support',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data.order);
        setOrders((prev) => prev.map((o) => (o.id === data.order.id ? data.order : o)));
        setIsEditDeliveryOpen(false);
        setCareNoteInput('');
        showToast(`Updated delivery details for #${data.order.orderNumber}!`);
      } else {
        showToast('Failed to update details', 'error');
      }
    } catch (err) {
      showToast('Error updating details', 'error');
    }
  };

  // Open Edit Modal
  const openEditModal = (order: any) => {
    setSelectedOrder(order);
    setEditAddress(order.deliveryDetails?.deliveryAddress || order.deliveryAddress || '');
    setEditLandmark(order.deliveryDetails?.landmark || order.landmark || '');
    setEditNotes(order.deliveryDetails?.deliveryNotes || order.deliveryNotes || '');
    setIsEditDeliveryOpen(true);
  };

  // Create New Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) {
      showToast('Please select an order to attach the ticket to', 'error');
      return;
    }
    try {
      const res = await fetch('/api/customercare/tickets', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          orderId: selectedOrder.id,
          orderNumber: selectedOrder.orderNumber,
          customerName: selectedOrder.deliveryDetails?.customerName || selectedOrder.customerName || 'Customer',
          customerPhone: selectedOrder.deliveryDetails?.customerPhone || selectedOrder.customerPhone || '',
          branchId: activeBranchId,
          category: ticketCategory,
          priority: ticketPriority,
          description: ticketDescription,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTickets((prev) => [data.ticket, ...prev]);
        setIsTicketModalOpen(false);
        setTicketDescription('');
        showToast(`Created Care Ticket ${data.ticket.ticketNumber}!`);
      } else {
        showToast('Failed to create ticket', 'error');
      }
    } catch (err) {
      showToast('Error creating ticket', 'error');
    }
  };

  // Resolve Ticket
  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingTicket) return;
    try {
      const res = await fetch(`/api/customercare/tickets/${resolvingTicket.id}/resolve`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          resolutionNotes: resolutionNote,
          compensationType,
          compensationAmount: Number(compensationAmount) || 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTickets((prev) => prev.map((t) => (t.id === data.ticket.id ? data.ticket : t)));
        setResolvingTicket(null);
        setResolutionNote('');
        setCompensationAmount('');
        showToast(`Ticket ${data.ticket.ticketNumber} resolved successfully!`);
      } else {
        showToast('Failed to resolve ticket', 'error');
      }
    } catch (err) {
      showToast('Error resolving ticket', 'error');
    }
  };

  // WhatsApp helper
  const getWhatsAppLink = (phone: string, orderNumber: string, customerName: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '234' + clean.slice(1);
    if (!clean.startsWith('234')) clean = '234' + clean;
    const msg = `Hello ${customerName || 'there'}, this is Choplife Republic Customer Care regarding your order #${orderNumber}. How may we assist you today?`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-[#FAF7F2] text-[#241311]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5DEC9] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-[#241311]">Customer Care & Order Resolution Hub</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#800D15]/10 text-[#800D15] border border-[#800D15]/20">
              LIVE HOTLINE
            </span>
          </div>
          <p className="text-xs text-[#7A6A65]">
            Direct customer lookup, address adjustments, complaint resolution, and goodwill compensation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[#FAF7F2] p-1 rounded-xl border border-[#E5DEC9]">
            <button
              onClick={() => setActiveSubTab('lookup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'lookup'
                  ? 'bg-[#800D15] text-white shadow-xs'
                  : 'text-[#7A6A65] hover:text-[#241311]'
              }`}
            >
              Order Lookup
            </button>
            <button
              onClick={() => setActiveSubTab('tickets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'tickets'
                  ? 'bg-[#800D15] text-white shadow-xs'
                  : 'text-[#7A6A65] hover:text-[#241311]'
              }`}
            >
              <span>Care Tickets</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#FFC700] text-[#4D080F] text-[10px] font-black">
                {tickets.filter((t) => t.status === 'open').length}
              </span>
            </button>
          </div>

          <button
            onClick={() => {
              fetchOrders(searchQuery);
              fetchTickets();
            }}
            className="p-2 bg-[#FAF7F2] hover:bg-stone-100 border border-[#E5DEC9] rounded-xl text-[#5C4942] hover:text-[#241311] transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activeSubTab === 'lookup' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Search & Order List */}
          <div className="lg:col-span-5 space-y-3">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6A65]" />
              <input
                type="text"
                placeholder="Search phone (080...), order #, customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#E5DEC9] rounded-xl pl-9 pr-16 py-2.5 text-xs text-[#241311] placeholder-[#7A6A65] focus:outline-none focus:border-[#800D15]"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-[#800D15] hover:bg-[#A3121B] text-white text-[11px] font-bold rounded-lg transition-all"
              >
                Find
              </button>
            </form>

            {fetchError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{fetchError}</span>
                </div>
                <button
                  onClick={() => fetchOrders(searchQuery)}
                  className="px-2.5 py-1 bg-white border border-rose-300 rounded-lg font-bold text-[11px] text-rose-700 hover:bg-rose-100"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-2 space-y-2 max-h-[600px] overflow-y-auto shadow-2xs">
              {isLoading ? (
                <p className="text-xs text-[#7A6A65] text-center py-6">Searching branch orders...</p>
              ) : orders.length > 0 ? (
                orders.map((o) => {
                  const isSelected = selectedOrder?.id === o.id;
                  const custName = o.deliveryDetails?.customerName || o.customerName || 'Storefront Guest';
                  const custPhone = o.deliveryDetails?.customerPhone || o.customerPhone || 'N/A';
                  return (
                    <div
                      key={o.id}
                      onClick={() => setSelectedOrder(o)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFF8E7] border-[#800D15] shadow-xs'
                          : 'bg-white border-[#E5DEC9] hover:border-[#800D15]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-xs text-[#800D15]">#{o.orderNumber || o.id.slice(0, 8)}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            o.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : o.status === 'delivering' || o.status === 'in_transit'
                              ? 'bg-amber-100 text-amber-800'
                              : o.status === 'cancelled'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {o.status?.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="font-bold text-[#241311]">{custName}</span>
                        <span className="font-mono font-bold text-[#800D15]">₦{Number(o.total || o.totalAmount || 0).toLocaleString()}</span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[11px] text-[#7A6A65]">
                        <span>{custPhone}</span>
                        <span>{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {o.priority === 'urgent' && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <AlertTriangle className="w-3 h-3" /> URGENT CARE ESCALATION
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-[#7A6A65] space-y-1">
                  <Search className="w-8 h-8 mx-auto text-[#E5DEC9]" />
                  <p className="text-xs font-bold text-[#241311]">
                    {searchQuery ? `No orders matched "${searchQuery}"` : 'No orders found for this branch'}
                  </p>
                  <p className="text-[11px] text-[#7A6A65]">
                    Enter a customer phone number, order reference, or customer name to search.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Detail & Actions */}
          <div className="lg:col-span-7">
            {selectedOrder ? (
              <div className="bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-5 shadow-2xs">
                {/* Header & Quick Contacts */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DEC9] pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-lg text-[#800D15]">
                        #{selectedOrder.orderNumber || selectedOrder.id}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-[#800D15]/10 text-[#800D15] border border-[#800D15]/20">
                        {selectedOrder.orderType || 'Delivery'}
                      </span>
                    </div>
                    <p className="text-xs text-[#7A6A65] mt-0.5">
                      Placed on: {new Date(selectedOrder.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })}
                    </p>
                  </div>

                  {/* WhatsApp & Call Buttons */}
                  <div className="flex items-center gap-2">
                    {selectedOrder.deliveryDetails?.customerPhone && (
                      <>
                        <a
                          href={getWhatsAppLink(
                            selectedOrder.deliveryDetails.customerPhone,
                            selectedOrder.orderNumber || selectedOrder.id,
                            selectedOrder.deliveryDetails.customerName
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-[#120B0A] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                        <a
                          href={`tel:${selectedOrder.deliveryDetails.customerPhone}`}
                          className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-stone-100 text-[#241311] font-bold text-xs rounded-xl border border-[#E5DEC9] flex items-center gap-1.5 transition-all"
                        >
                          <Phone className="w-3.5 h-3.5 text-[#800D15]" /> Call
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Customer & Delivery Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-[#7A6A65] tracking-wider">Customer Profile</span>
                    <p className="font-bold text-sm text-[#241311]">
                      {selectedOrder.deliveryDetails?.customerName || selectedOrder.customerName || 'N/A'}
                    </p>
                    <p className="text-xs text-[#5C4942] flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#800D15]" />
                      {selectedOrder.deliveryDetails?.customerPhone || selectedOrder.customerPhone || 'N/A'}
                    </p>
                    <p className="text-xs text-[#7A6A65]">
                      Payment: <strong className="uppercase text-[#800D15]">{selectedOrder.paymentMethod}</strong> ({selectedOrder.paymentStatus})
                    </p>
                  </div>

                  <div className="p-3.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-1.5 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-[#7A6A65] tracking-wider">Delivery Destination</span>
                      <button
                        onClick={() => openEditModal(selectedOrder)}
                        className="text-[10px] text-[#800D15] hover:underline font-bold"
                      >
                        Edit Details
                      </button>
                    </div>
                    <p className="text-xs text-[#241311] font-medium leading-snug">
                      {selectedOrder.deliveryDetails?.deliveryAddress || selectedOrder.deliveryAddress || 'No street address provided'}
                    </p>
                    {selectedOrder.deliveryDetails?.landmark && (
                      <p className="text-[11px] text-[#7A6A65]">
                        Landmark: <span className="text-[#241311] font-medium">{selectedOrder.deliveryDetails.landmark}</span>
                      </p>
                    )}
                    {selectedOrder.deliveryDetails?.deliveryNotes && (
                      <p className="text-[11px] text-[#800D15] italic">
                        "{selectedOrder.deliveryDetails.deliveryNotes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Items in Order */}
                <div className="space-y-2">
                  <span className="text-xs uppercase font-bold text-[#7A6A65]">Ordered Items</span>
                  <div className="bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl divide-y divide-[#E5DEC9]">
                    {selectedOrder.items?.map((it: any, idx: number) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-[#241311]">{it.quantity}x {it.name}</span>
                          {it.notes && <p className="text-[10px] text-[#7A6A65] italic">{it.notes}</p>}
                        </div>
                        <span className="font-mono font-bold text-[#241311]">
                          ₦{Number(it.totalPrice || it.unitPrice * it.quantity || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="p-2.5 flex justify-between text-xs font-bold bg-white rounded-b-xl">
                      <span className="text-[#241311]">Total Payable</span>
                      <span className="font-mono text-sm font-black text-[#800D15]">
                        ₦{Number(selectedOrder.total || selectedOrder.totalAmount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Care Log Notes */}
                {selectedOrder.customerCareNotes && selectedOrder.customerCareNotes.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-amber-800">Resolution History</span>
                    {selectedOrder.customerCareNotes.map((note: any, idx: number) => (
                      <div key={idx} className="text-xs text-[#241311] border-b border-amber-200/60 pb-1 last:border-b-0">
                        <span className="text-[10px] text-amber-700 block">
                          {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by {note.staffName}:
                        </span>
                        <span>{note.note}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Bar */}
                <div className="pt-2 flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => handleFastTrackOrder(selectedOrder.id)}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Mark Urgent (Fast-Track)
                  </button>

                  <button
                    onClick={() => openEditModal(selectedOrder)}
                    className="px-3.5 py-2 bg-[#FAF7F2] hover:bg-stone-100 border border-[#E5DEC9] text-[#241311] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#800D15]" /> Edit Delivery Instructions
                  </button>

                  <button
                    onClick={() => setIsTicketModalOpen(true)}
                    className="px-3.5 py-2 bg-[#800D15] hover:bg-[#A3121B] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FFC700]" /> Open Complaint Ticket
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full bg-white border border-[#E5DEC9] rounded-2xl flex flex-col items-center justify-center p-8 text-center text-[#7A6A65] shadow-2xs">
                <Search className="w-12 h-12 text-[#E5DEC9] mb-2" />
                <h3 className="font-bold text-sm text-[#241311]">Select or Look Up an Order</h3>
                <p className="text-xs text-[#7A6A65] max-w-sm mt-1">
                  View customer contact numbers, update drop-off addresses, escalate delivery priority, and log care vouchers.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Care Tickets Tab */
        <div className="space-y-4">
          {ticketsError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{ticketsError}</span>
              </div>
              <button
                onClick={fetchTickets}
                className="px-2.5 py-1 bg-white border border-rose-300 rounded-lg font-bold text-[11px] text-rose-700 hover:bg-rose-100"
              >
                Retry
              </button>
            </div>
          )}

          <div className="bg-white border border-[#E5DEC9] rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F2] border-b border-[#E5DEC9] text-[#7A6A65] uppercase font-bold">
                <tr>
                  <th className="p-3">Ticket #</th>
                  <th className="p-3">Customer & Phone</th>
                  <th className="p-3">Order Ref</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DEC9]">
                {tickets.length > 0 ? (
                  tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-[#FAF7F2]">
                      <td className="p-3 font-mono font-bold text-[#800D15]">{t.ticketNumber}</td>
                      <td className="p-3">
                        <p className="font-bold text-[#241311]">{t.customerName}</p>
                        <span className="text-[10px] text-[#7A6A65]">{t.customerPhone}</span>
                      </td>
                      <td className="p-3 font-mono text-[#5C4942]">#{t.orderNumber || 'General'}</td>
                      <td className="p-3">
                        <span className="capitalize text-[#241311] font-medium">{t.category?.replace('_', ' ')}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            t.priority === 'urgent'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : t.priority === 'high'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            t.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {t.status === 'open' ? (
                          <button
                            onClick={() => {
                              setResolvingTicket(t);
                              setResolutionNote('');
                              setCompensationAmount('');
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-all"
                          >
                            Resolve & Settle
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#7A6A65]">
                            ✓ Closed by {t.resolvedByStaffName}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#7A6A65]">
                      No active customer care tickets for this branch. Everything running smoothly!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Delivery Details Modal */}
      {isEditDeliveryOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-black text-base text-[#241311]">
              Update Delivery Details for #{selectedOrder.orderNumber}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#5C4942]">Street Address / House No.</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#5C4942]">Landmark / Closest Junction</label>
                <input
                  type="text"
                  value={editLandmark}
                  onChange={(e) => setEditLandmark(e.target.value)}
                  placeholder="e.g. Opposite Oasis Bakery, by Boundary Rd"
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#5C4942]">Rider Delivery Instructions</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Call customer when reaching the gate"
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#5C4942]">Internal Support Log Note</label>
                <input
                  type="text"
                  value={careNoteInput}
                  onChange={(e) => setCareNoteInput(e.target.value)}
                  placeholder="Reason for change e.g. Customer called to correct wrong house number"
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsEditDeliveryOpen(false)}
                className="flex-1 py-2.5 bg-[#FAF7F2] border border-[#E5DEC9] text-[#5C4942] text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDeliveryDetails}
                className="flex-1 py-2.5 bg-[#800D15] text-white text-xs font-bold rounded-xl"
              >
                Save & Dispatch Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {isTicketModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTicket}
            className="bg-white border border-[#E5DEC9] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <h3 className="font-black text-base text-[#241311]">
              Open Care Ticket: Order #{selectedOrder.orderNumber}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#5C4942]">Issue Category</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                >
                  <option value="delivery_delay">Delivery Delay (Past Estimated Time)</option>
                  <option value="missing_item">Missing Item in Delivery Box</option>
                  <option value="food_quality">Food Quality / Temperature Issue</option>
                  <option value="wrong_order">Wrong Item / Variant Delivered</option>
                  <option value="rider_conduct">Rider Conduct / Route Issue</option>
                  <option value="cancellation_request">Customer Cancellation Request</option>
                  <option value="payment_dispute">Payment Dispute / Double Charge</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#5C4942]">Escalation Priority</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setTicketPriority(p)}
                      className={`py-1.5 rounded-lg font-bold uppercase text-[10px] border ${
                        ticketPriority === p
                          ? 'bg-[#800D15] text-white border-[#800D15]'
                          : 'bg-[#FAF7F2] text-[#5C4942] border-[#E5DEC9]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#5C4942]">Issue Description & Customer Remarks</label>
                <textarea
                  rows={3}
                  required
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Detail customer statements, items affected, or dispatch status..."
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTicketModalOpen(false)}
                className="flex-1 py-2.5 bg-[#FAF7F2] border border-[#E5DEC9] text-[#5C4942] text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#800D15] text-white text-xs font-bold rounded-xl"
              >
                Log Ticket
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resolve Ticket Modal */}
      {resolvingTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleResolveTicket}
            className="bg-white border border-[#E5DEC9] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <h3 className="font-black text-base text-[#241311]">
              Resolve Ticket #{resolvingTicket.ticketNumber}
            </h3>
            <p className="text-xs text-[#7A6A65]">Customer: {resolvingTicket.customerName} ({resolvingTicket.category})</p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#5C4942]">Resolution Action & Settlement Note</label>
                <textarea
                  rows={3}
                  required
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="e.g. Apologized to customer; replacement item dispatched with rider; customer satisfied."
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#5C4942]">Courtesy Compensation Granted</label>
                <select
                  value={compensationType}
                  onChange={(e) => setCompensationType(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311]"
                >
                  <option value="none">None (Standard Resolution / Guidance)</option>
                  <option value="replacement_item">Replacement Item Dispatched</option>
                  <option value="store_credit">Store Credit / Goodwill Voucher</option>
                  <option value="full_refund">Full / Partial Cash Refund</option>
                </select>
              </div>

              {compensationType !== 'none' && (
                <div className="space-y-1">
                  <label className="font-bold text-[#5C4942]">Compensation Value (₦)</label>
                  <input
                    type="number"
                    value={compensationAmount}
                    onChange={(e) => setCompensationAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-[#241311] font-mono focus:outline-none focus:border-[#800D15]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolvingTicket(null)}
                className="flex-1 py-2.5 bg-[#FAF7F2] border border-[#E5DEC9] text-[#5C4942] text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl"
              >
                Confirm Resolution
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
