import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BranchId } from '../../types';
import {
  Sparkles,
  Calendar,
  Users,
  UtensilsCrossed,
  Layers,
  ChefHat,
  CheckCircle2,
  AlertCircle,
  Truck,
  DollarSign,
  Printer,
  FileCheck,
  Plus,
  Flame,
  Clock,
  Building,
  Check,
  X,
  Send,
  ClipboardList,
  CheckSquare,
  PackageCheck,
} from 'lucide-react';

interface CateringEventOrder {
  id: string;
  referenceNo: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  eventDate: string;
  eventTime: string;
  venueAddress: string;
  guestCount: number;
  packageStyle: string;
  totalCost: number;
  depositPaid: number;
  balanceDue: number;
  status: 'inquiry' | 'order_placed' | 'deposit_paid' | 'batch_scheduled' | 'prepped_packed' | 'dispatched_setup' | 'completed';
  assignedBranch: BranchId;
  specialRequests: string;
  createdAt: string;
}

export const CateringProductionPlanner: React.FC = () => {
  const {
    branches,
    selectedBranchId,
    inventoryItems,
    formatNaira,
    currentStaff,
  } = useApp();

  const [events, setEvents] = useState<CateringEventOrder[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CateringEventOrder | null>(null);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState<boolean>(false);
  const [activePlannerTab, setActivePlannerTab] = useState<'events_list' | 'batch_bom_planner' | 'proforma_quote' | 'beo_packing_sheet'>('events_list');
  const [contractFilter, setContractFilter] = useState<'all' | 'deposit_pending' | 'upcoming' | 'completed'>('all');
  const [packedItems, setPackedItems] = useState<{ [key: string]: boolean }>({
    'chafers': true,
    'sterno': true,
    'tongs': true,
    'cambro_hot': true,
  });

  const fetchCateringEvents = async () => {
    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      const res = await fetch(`/api/catering/events?branchId=${selectedBranchId || 'all'}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: CateringEventOrder[] = data.map((d: any) => ({
            id: d.id,
            referenceNo: d.contractNumber || d.referenceNo || `CAT-${d.id.slice(-4)}`,
            clientName: d.clientName,
            clientPhone: d.clientPhone,
            clientEmail: d.clientEmail || `${(d.clientName || 'client').toLowerCase().replace(/\s+/g, '')}@gmail.com`,
            eventDate: d.eventDate,
            eventTime: d.eventTime || '12:00',
            venueAddress: d.venueAddress || 'Venue to be confirmed',
            guestCount: Number(d.guestCount) || 50,
            packageStyle: d.packageStyle || 'General Catering',
            totalCost: Number(d.totalBudget ?? d.totalCost) || 0,
            depositPaid: Number(d.depositAmount ?? d.depositPaid) || 0,
            balanceDue: Number(d.balanceDue ?? ((d.totalBudget || d.totalCost || 0) - (d.depositAmount || d.depositPaid || 0))) || 0,
            status: d.status || 'inquiry',
            assignedBranch: d.branchId || d.assignedBranch || 'gra',
            specialRequests: d.specialInstructions || d.specialRequests || '',
            createdAt: d.createdAt || new Date().toISOString(),
          }));
          setEvents(mapped);
          setSelectedEvent((prev) => {
            if (prev && mapped.some((m) => m.id === prev.id)) {
              return mapped.find((m) => m.id === prev.id) || null;
            }
            return mapped.length > 0 ? mapped[0] : null;
          });
        }
      }
    } catch (err) {
      console.warn('Error fetching catering events:', err);
    }
  };

  useEffect(() => {
    fetchCateringEvents();
  }, [selectedBranchId]);

  const togglePackedItem = (itemKey: string) => {
    setPackedItems((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }));
  };

  // New Event Form State (Defaulting to upcoming business date)
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newEventDate, setNewEventDate] = useState('2026-10-28');
  const [newEventTime, setNewEventTime] = useState('13:00');
  const [newVenue, setNewVenue] = useState('');
  const [newGuests, setNewGuests] = useState(100);
  const [newPackage, setNewPackage] = useState<'chops_fiesta' | 'jollof_grills' | 'shawarma_bar' | 'executive'>('jollof_grills');
  const [newBranch, setNewBranch] = useState<BranchId>('gra');
  const [newNotes, setNewNotes] = useState('');

  // Calculate BOM Ingredient Requirements for Selected Event or Guest Count
  const calculateIngredientBOM = (guestCount: number, pkg: string) => {
    // Requirements per 100 guests scaling factor
    const factor = guestCount / 100;

    return [
      {
        ingredientName: 'Fresh Chicken Drumsticks & Thighs',
        sku: 'RAW-CHK-001',
        requiredQty: Math.round(25 * factor),
        unit: 'KG',
        estimatedCost: Math.round(25 * factor * 3500),
      },
      {
        ingredientName: 'Nigerian Long Grain Parboiled Rice',
        sku: 'RAW-RIC-001',
        requiredQty: Math.round(1.0 * factor * 10) / 10,
        unit: 'BAG (50KG)',
        estimatedCost: Math.round(1.0 * factor * 82000),
      },
      {
        ingredientName: 'Refined Vegetable Cooking Oil',
        sku: 'RAW-OIL-001',
        requiredQty: Math.round(20 * factor),
        unit: 'LITERS',
        estimatedCost: Math.round(20 * factor * 2200),
      },
      {
        ingredientName: 'Spring Roll Wrappers (40pk)',
        sku: 'RAW-SPR-001',
        requiredQty: Math.round(10 * factor),
        unit: 'PACKS',
        estimatedCost: Math.round(10 * factor * 1800),
      },
      {
        ingredientName: 'Premium Baker Flour & Puff Mix',
        sku: 'RAW-FLR-001',
        requiredQty: Math.round(15 * factor),
        unit: 'KG',
        estimatedCost: Math.round(15 * factor * 1400),
      },
      {
        ingredientName: 'Fresh Habanero Peppers & Onions',
        sku: 'RAW-PEP-001',
        requiredQty: Math.round(12 * factor),
        unit: 'KG',
        estimatedCost: Math.round(12 * factor * 1600),
      },
      {
        ingredientName: 'Disposable Bento Catering Boxes & Cutlery',
        sku: 'PKG-BOX-001',
        requiredQty: guestCount,
        unit: 'SETS',
        estimatedCost: guestCount * 150,
      },
    ];
  };

  const currentBOM = useMemo(() => {
    if (!selectedEvent) return [];
    return calculateIngredientBOM(selectedEvent.guestCount, selectedEvent.packageStyle);
  }, [selectedEvent]);

  const totalBOMCost = currentBOM.reduce((sum, item) => sum + item.estimatedCost, 0);

  // Status Progression Handler
  const handleUpdateEventStatus = async (eventId: string, nextStatus: CateringEventOrder['status']) => {
    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      await fetch(`/api/catering/events/${eventId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (err) {
      console.warn('Network error updating status on backend, applying locally:', err);
    }
    setEvents((prev) =>
      prev.map((evt) => (evt.id === eventId ? { ...evt, status: nextStatus } : evt))
    );
    if (selectedEvent && selectedEvent.id === eventId) {
      setSelectedEvent((prev) => (prev ? { ...prev, status: nextStatus } : null));
    }
  };

  // Record Deposit or Full Balance Settlement
  const handleRecordDeposit = async (eventId: string, isFullSettlement = false) => {
    const targetEvt = events.find((e) => e.id === eventId);
    if (!targetEvt) return;
    const newDeposit = isFullSettlement ? targetEvt.totalCost : Math.round(targetEvt.totalCost * 0.7);
    const newBal = targetEvt.totalCost - newDeposit;
    const nextStatus = isFullSettlement ? 'completed' : 'deposit_paid';

    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      await fetch(`/api/catering/events/${eventId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: nextStatus,
          depositAmount: newDeposit,
          notes: isFullSettlement ? 'Settled in full via cashier deposit' : '70% milestone deposit recorded',
        }),
      });
    } catch (err) {
      console.warn('Network error updating deposit on backend:', err);
    }

    setEvents((prev) =>
      prev.map((evt) =>
        evt.id === eventId
          ? { ...evt, depositPaid: newDeposit, balanceDue: newBal, status: nextStatus }
          : evt
      )
    );
    if (selectedEvent && selectedEvent.id === eventId) {
      setSelectedEvent((prev) =>
        prev
          ? { ...prev, depositPaid: newDeposit, balanceDue: newBal, status: nextStatus }
          : null
      );
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    let costPerHead = 4500;
    if (newPackage === 'chops_fiesta') costPerHead = 3200;
    if (newPackage === 'shawarma_bar') costPerHead = 3800;
    if (newPackage === 'executive') costPerHead = 6500;

    const totalCost = (costPerHead * newGuests) + 15000; // includes setup/chafing equipment
    const depositPaid = Math.round(totalCost * 0.7);

    const newEvt: CateringEventOrder = {
      id: `cat-evt-${Date.now()}`,
      referenceNo: `CAT-2026-${(events.length + 1).toString().padStart(3, '0')}`,
      clientName: newClientName,
      clientPhone: newClientPhone,
      clientEmail: `${newClientName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      eventDate: newEventDate,
      eventTime: newEventTime,
      venueAddress: newVenue,
      guestCount: Number(newGuests),
      packageStyle: newPackage.toUpperCase().replace('_', ' '),
      totalCost,
      depositPaid,
      balanceDue: totalCost - depositPaid,
      status: 'deposit_paid',
      assignedBranch: newBranch,
      specialRequests: newNotes,
      createdAt: new Date().toISOString(),
    };

    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      await fetch('/api/catering/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          branchId: newBranch,
          clientName: newClientName,
          clientPhone: newClientPhone,
          clientEmail: newEvt.clientEmail,
          eventDate: newEventDate,
          eventTime: newEventTime,
          venueAddress: newVenue,
          guestCount: Number(newGuests),
          packageStyle: newEvt.packageStyle,
          totalBudget: totalCost,
          depositAmount: depositPaid,
          specialInstructions: newNotes,
        }),
      });
    } catch (err) {
      console.warn('Network error creating catering event on backend:', err);
    }

    setEvents([newEvt, ...events]);
    setSelectedEvent(newEvt);
    setIsNewEventModalOpen(false);
  };

  const getStatusBadge = (st: CateringEventOrder['status']) => {
    switch (st) {
      case 'inquiry':
        return <span className="bg-gray-100 text-gray-800 text-[10px] font-titan uppercase px-2.5 py-0.5 rounded-full">Inquiry</span>;
      case 'order_placed':
        return <span className="bg-amber-100 text-amber-900 text-[10px] font-titan uppercase px-2.5 py-0.5 rounded-full border border-amber-300">Order Placed (Deposit Pending)</span>;
      case 'deposit_paid':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-titan uppercase px-2.5 py-0.5 rounded-full">70% Deposit Confirmed</span>;
      case 'batch_scheduled':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-titan uppercase px-2.5 py-0.5 rounded-full">Commissary Batch Scheduled</span>;
      case 'prepped_packed':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-titan uppercase px-2.5 py-0.5 rounded-full">Prepped & Packaged</span>;
      case 'dispatched_setup':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-titan uppercase px-2.5 py-0.5 rounded-full">Dispatched / Setup Live</span>;
      case 'completed':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-titan uppercase px-2.5 py-0.5 rounded-full">Completed & Settled</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Planner Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5DEC9] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#FFC700]/20 text-[#4D080F] font-titan text-[10px] rounded-full uppercase tracking-wider">
              ENTERPRISE LOGISTICS & PRODUCTION
            </span>
            <span className="text-xs text-emerald-700 font-montserrat font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Commissary BOM Synced
            </span>
          </div>
          <h2 className="font-titan text-xl text-[#4D080F] mt-1">
            ChopLife Catering & Commissary Batch Production Engine
          </h2>
          <p className="text-xs text-gray-500 font-montserrat">
            Automated raw ingredient bill of materials, Central Store allocation, milestone deposit tracking & pro-forma generation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewEventModalOpen(true)}
            className="px-4 py-2 bg-[#4D080F] hover:bg-[#38050A] text-[#FFC700] rounded-xl text-xs font-titan uppercase flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Book New Event Contract
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5DEC9] pb-2 overflow-x-auto">
        <button
          onClick={() => setActivePlannerTab('events_list')}
          className={`px-4 py-2 rounded-xl text-xs font-titan uppercase transition-all whitespace-nowrap ${
            activePlannerTab === 'events_list'
              ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
              : 'bg-white text-gray-700 hover:bg-[#FFF8E7] border border-[#E5DEC9]'
          }`}
        >
          Active Catering Contracts ({events.length})
        </button>

        <button
          onClick={() => setActivePlannerTab('batch_bom_planner')}
          className={`px-4 py-2 rounded-xl text-xs font-titan uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activePlannerTab === 'batch_bom_planner'
              ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
              : 'bg-white text-gray-700 hover:bg-[#FFF8E7] border border-[#E5DEC9]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Commissary Batch Planner
        </button>

        <button
          onClick={() => setActivePlannerTab('proforma_quote')}
          className={`px-4 py-2 rounded-xl text-xs font-titan uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activePlannerTab === 'proforma_quote'
              ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
              : 'bg-white text-gray-700 hover:bg-[#FFF8E7] border border-[#E5DEC9]'
          }`}
        >
          <Printer className="w-3.5 h-3.5" /> Pro-Forma Quotation
        </button>

        <button
          onClick={() => setActivePlannerTab('beo_packing_sheet')}
          className={`px-4 py-2 rounded-xl text-xs font-titan uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activePlannerTab === 'beo_packing_sheet'
              ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
              : 'bg-white text-gray-700 hover:bg-[#FFF8E7] border border-[#E5DEC9]'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" /> BEO & Packing Sheet
        </button>
      </div>

      {/* TAB 1: CATERING CONTRACTS */}
      {activePlannerTab === 'events_list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Contracts List with Category Filter Pills */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9] text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setContractFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  contractFilter === 'all'
                    ? 'bg-[#4D080F] text-[#FFC700]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({events.length})
              </button>
              <button
                type="button"
                onClick={() => setContractFilter('deposit_pending')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  contractFilter === 'deposit_pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 hover:text-amber-950'
                }`}
              >
                Deposit Pending ({events.filter((e) => e.status === 'order_placed' || e.status === 'inquiry' || (e.balanceDue > 0 && e.depositPaid === 0)).length})
              </button>
              <button
                type="button"
                onClick={() => setContractFilter('upcoming')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  contractFilter === 'upcoming'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Upcoming ({events.filter((e) => e.status !== 'completed' && e.eventDate >= '2026-10-22').length})
              </button>
              <button
                type="button"
                onClick={() => setContractFilter('completed')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  contractFilter === 'completed'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Settled ({events.filter((e) => e.status === 'completed' || e.eventDate < '2026-10-22').length})
              </button>
            </div>

            {events
              .filter((e) => {
                if (contractFilter === 'deposit_pending') {
                  return e.status === 'order_placed' || e.status === 'inquiry' || (e.balanceDue > 0 && e.depositPaid === 0);
                }
                if (contractFilter === 'upcoming') {
                  return e.status !== 'completed' && e.eventDate >= '2026-10-22';
                }
                if (contractFilter === 'completed') {
                  return e.status === 'completed' || e.eventDate < '2026-10-22';
                }
                return true;
              }).length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-[#E5DEC9] text-center space-y-2">
                  <Calendar className="w-7 h-7 text-[#4D080F]/40 mx-auto" />
                  <h4 className="font-titan text-sm text-[#4D080F]">No Catering Bookings</h4>
                  <p className="text-xs text-gray-500 font-montserrat">
                    No active bookings for this filter. Use "+ New Catering Contract" to record genuine event contracts.
                  </p>
                </div>
              ) : (
                events
                  .filter((e) => {
                    if (contractFilter === 'deposit_pending') {
                      return e.status === 'order_placed' || e.status === 'inquiry' || (e.balanceDue > 0 && e.depositPaid === 0);
                    }
                    if (contractFilter === 'upcoming') {
                      return e.status !== 'completed' && e.eventDate >= '2026-10-22';
                    }
                    if (contractFilter === 'completed') {
                      return e.status === 'completed' || e.eventDate < '2026-10-22';
                    }
                    return true;
                  })
                  .map((evt) => (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedEvent?.id === evt.id
                          ? 'bg-[#FFF8E7] border-[#4D080F] shadow-sm ring-2 ring-[#FFC700]/30'
                          : 'bg-white border-[#E5DEC9] hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-titan text-xs text-[#4D080F]">{evt.referenceNo}</span>
                        {getStatusBadge(evt.status)}
                      </div>

                      <h4 className="font-titan text-base text-[#241311] mt-1.5">{evt.clientName}</h4>
                      <p className="text-xs text-gray-500 font-montserrat flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3 text-gray-400" /> {evt.guestCount} Guests • {evt.packageStyle}
                      </p>

                      <div className="mt-3 pt-2 border-t border-[#E5DEC9] flex items-center justify-between text-xs font-montserrat">
                        <span className="text-gray-500">{new Date(evt.eventDate).toLocaleDateString()} @ {evt.eventTime}</span>
                        <strong className="font-titan text-[#4D080F]">{formatNaira(evt.totalCost)}</strong>
                      </div>
                    </div>
                  ))
              )}
          </div>

          {/* Detailed Event Contract Card & Lifecycle Actions */}
          {!selectedEvent ? (
            <div className="lg:col-span-2 bg-white rounded-3xl p-8 sm:p-12 border border-[#E5DEC9] text-center space-y-3 flex flex-col items-center justify-center min-h-[380px] shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#FFF8E7] border border-[#FFC700]/40 flex items-center justify-center text-[#4D080F]">
                <Calendar className="w-8 h-8 text-[#4D080F]" />
              </div>
              <h3 className="font-titan text-lg text-[#241311]">No Catering Event Selected</h3>
              <p className="text-xs text-gray-500 font-montserrat max-w-sm">
                Select a catering booking from the list or create a new contract with client details, guest headcount, and banquet package.
              </p>
              <button
                onClick={() => setIsNewEventModalOpen(true)}
                className="bg-[#4D080F] hover:bg-[#660B14] text-[#FFC700] font-titan text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Record New Catering Contract
              </button>
            </div>
          ) : (
            <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-[#E5DEC9] space-y-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5DEC9] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-titan text-sm text-[#4D080F]">{selectedEvent.referenceNo}</span>
                    {getStatusBadge(selectedEvent.status)}
                  </div>
                  <h3 className="font-titan text-xl text-[#241311] mt-1">{selectedEvent.clientName}</h3>
                  <p className="text-xs text-gray-500 font-montserrat">
                    Contact: {selectedEvent.clientPhone} | {selectedEvent.clientEmail}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-gray-400 uppercase font-bold block">Contract Value</span>
                  <strong className="font-titan text-xl text-emerald-700">
                    {formatNaira(selectedEvent.totalCost)}
                  </strong>
                </div>
              </div>

              {/* Event Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] text-xs font-montserrat">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Date & Time</span>
                  <strong className="text-[#241311]">{selectedEvent.eventDate} ({selectedEvent.eventTime})</strong>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Guest Count</span>
                  <strong className="text-[#4D080F] font-titan text-sm">{selectedEvent.guestCount} Guests</strong>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Fulfillment Hub</span>
                  <strong className="text-[#241311] uppercase font-bold">{selectedEvent.assignedBranch} Branch</strong>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Balance Due</span>
                  <strong className={`font-titan text-sm ${selectedEvent.balanceDue > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {selectedEvent.balanceDue > 0 ? formatNaira(selectedEvent.balanceDue) : 'PAID IN FULL'}
                  </strong>
                </div>
              </div>

              {/* Outstanding Financial Settlement Action */}
              {selectedEvent.balanceDue > 0 && (
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-amber-950 block">Deposit & Balance Reconciliation</span>
                    <span className="text-[11px] text-amber-800">
                      Outstanding: <strong>{formatNaira(selectedEvent.balanceDue)}</strong> (Paid so far: {formatNaira(selectedEvent.depositPaid)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedEvent.depositPaid === 0 && (
                      <button
                        type="button"
                        onClick={() => handleRecordDeposit(selectedEvent.id, false)}
                        className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                      >
                        Confirm 70% Deposit ({formatNaira(Math.round(selectedEvent.totalCost * 0.7))})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRecordDeposit(selectedEvent.id, true)}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      Settle Full Balance ({formatNaira(selectedEvent.balanceDue)})
                    </button>
                  </div>
                </div>
              )}

              {/* Venue & Special Instructions */}
              <div className="space-y-2 text-xs font-montserrat">
                <div className="flex items-start gap-2 bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DEC9]">
                  <Truck className="w-4 h-4 text-[#4D080F] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#241311]">Venue & Setup Address:</strong>
                    <span className="text-gray-600">{selectedEvent.venueAddress}</span>
                  </div>
                </div>

                {selectedEvent.specialRequests && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900">
                    <strong className="block">Special Prep & Logistics Requests:</strong>
                    <span>{selectedEvent.specialRequests}</span>
                  </div>
                )}
              </div>

              {/* Milestone Progress Workflow */}
              <div className="pt-2 space-y-3">
                <h4 className="font-titan text-xs text-[#4D080F] uppercase">Milestone Progression Control</h4>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    onClick={() => handleUpdateEventStatus(selectedEvent.id, 'order_placed')}
                    className={`p-2.5 rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedEvent.status === 'order_placed'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" /> Order Placed
                  </button>

                  <button
                    onClick={() => handleUpdateEventStatus(selectedEvent.id, 'deposit_paid')}
                    className={`p-2.5 rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedEvent.status === 'deposit_paid'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" /> 70% Deposit Paid
                  </button>

                  <button
                    onClick={() => handleUpdateEventStatus(selectedEvent.id, 'batch_scheduled')}
                    className={`p-2.5 rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedEvent.status === 'batch_scheduled'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Batch Scheduled
                  </button>

                  <button
                    onClick={() => handleUpdateEventStatus(selectedEvent.id, 'prepped_packed')}
                    className={`p-2.5 rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedEvent.status === 'prepped_packed'
                        ? 'bg-amber-700 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ChefHat className="w-3.5 h-3.5" /> Prepped & Packed
                  </button>

                  <button
                    onClick={() => handleUpdateEventStatus(selectedEvent.id, 'completed')}
                    className={`p-2.5 rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedEvent.status === 'completed'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completed & Settled
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State for Detail Tabs if no Event Selected */}
      {activePlannerTab !== 'events_list' && !selectedEvent && (
        <div className="bg-white rounded-3xl p-10 sm:p-14 border border-[#E5DEC9] text-center space-y-3 flex flex-col items-center justify-center min-h-[360px] shadow-sm">
          <UtensilsCrossed className="w-12 h-12 text-[#4D080F]/40" />
          <h3 className="font-titan text-xl text-[#241311]">No Catering Event Selected</h3>
          <p className="text-xs text-gray-500 font-montserrat max-w-sm">
            Please return to the "Catering Contracts" tab to select or create a booking before viewing its Commissary Bill of Materials, Pro-Forma Quotation, or BEO Logistics Sheet.
          </p>
          <button
            onClick={() => setActivePlannerTab('events_list')}
            className="mt-2 px-5 py-2.5 bg-[#4D080F] hover:bg-[#660B14] text-[#FFC700] rounded-xl text-xs font-titan uppercase transition-all shadow-sm"
          >
            Return to Contracts List
          </button>
        </div>
      )}

      {/* TAB 2: INGREDIENT BATCH BOM PLANNER */}
      {activePlannerTab === 'batch_bom_planner' && selectedEvent && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E5DEC9] space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#E5DEC9] pb-3">
            <div>
              <span className="text-[10px] font-titan uppercase text-[#4D080F]">Commissary Production Calculation</span>
              <h3 className="font-titan text-lg text-[#241311]">
                Bill of Materials for {selectedEvent.clientName} ({selectedEvent.guestCount} Guests)
              </h3>
            </div>

            <span className="font-titan text-base text-[#4D080F]">
              Total Raw Material Cost: {formatNaira(totalBOMCost)} (Gross Margin: {(((selectedEvent.totalCost - totalBOMCost) / selectedEvent.totalCost) * 100).toFixed(1)}%)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-montserrat">
              <thead className="bg-[#FAF7F2] text-[#4D080F] font-titan uppercase text-[10px] border-b border-[#E5DEC9]">
                <tr>
                  <th className="p-3">Raw Ingredient & SKU</th>
                  <th className="p-3 text-center">Batch Required Qty</th>
                  <th className="p-3 text-center">Commissary Stock Status</th>
                  <th className="p-3 text-right">Calculated Prep Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentBOM.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#FFF8E7]/30">
                    <td className="p-3">
                      <strong className="block text-[#241311]">{item.ingredientName}</strong>
                      <span className="text-[10px] font-mono text-gray-400">{item.sku}</span>
                    </td>
                    <td className="p-3 text-center font-titan text-[#4D080F]">
                      {item.requiredQty} {item.unit}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-titan rounded-full">
                        In Stock & Reserved
                      </span>
                    </td>
                    <td className="p-3 text-right font-titan text-gray-700">
                      {formatNaira(item.estimatedCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-3 flex items-center justify-end">
            <button
              onClick={() => alert(`Reserved ${currentBOM.length} raw ingredient lines in Commissary Store for ${selectedEvent.referenceNo}!`)}
              className="px-5 py-2.5 bg-[#4D080F] hover:bg-[#38050A] text-[#FFC700] text-xs font-titan uppercase rounded-xl shadow-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Lock & Deduct from Commissary Inventory
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: PRO-FORMA QUOTATION GENERATOR */}
      {activePlannerTab === 'proforma_quote' && selectedEvent && (
        <div className="bg-white rounded-3xl p-6 border border-[#E5DEC9] shadow-md space-y-6 max-w-3xl mx-auto">
          {/* Proforma Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="font-titan text-2xl text-[#4D080F]">CHOPLIFE REPUBLIC</h3>
              <p className="text-xs text-gray-500 font-montserrat">
                Industrial Catering & Large Event Logistics Division
              </p>
              <p className="text-[11px] text-gray-400 font-montserrat">
                GRA / Okabere / Ugbowo Hubs • Benin City, Edo State
              </p>
            </div>

            <div className="text-right">
              <span className="px-3 py-1 bg-[#4D080F] text-[#FFC700] font-titan text-xs rounded-lg uppercase">
                OFFICIAL QUOTATION
              </span>
              <p className="text-xs font-mono text-gray-500 mt-1">Ref: {selectedEvent.referenceNo}</p>
              <p className="text-xs font-montserrat text-gray-400">Date: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Client & Event Info */}
          <div className="grid grid-cols-2 gap-4 text-xs font-montserrat bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9]">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Billed To:</span>
              <strong className="text-sm font-titan text-[#241311]">{selectedEvent.clientName}</strong>
              <p className="text-gray-600">{selectedEvent.clientPhone}</p>
              <p className="text-gray-600">{selectedEvent.clientEmail}</p>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Event Details:</span>
              <p><strong>Date:</strong> {selectedEvent.eventDate} @ {selectedEvent.eventTime}</p>
              <p><strong>Venue:</strong> {selectedEvent.venueAddress}</p>
              <p><strong>Guest Headcount:</strong> {selectedEvent.guestCount} Persons</p>
            </div>
          </div>

          {/* Items & Pricing Breakdown */}
          <div className="space-y-2">
            <table className="w-full text-left text-xs font-montserrat">
              <thead className="bg-[#4D080F] text-[#FFC700] font-titan text-[10px] uppercase">
                <tr>
                  <th className="p-2.5 rounded-l-xl">Description</th>
                  <th className="p-2.5 text-center">Guests</th>
                  <th className="p-2.5 text-right">Rate / Guest</th>
                  <th className="p-2.5 text-right rounded-r-xl">Amount (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="p-3 font-bold text-[#241311]">
                    {selectedEvent.packageStyle}
                    <span className="block text-[10px] text-gray-500 font-normal">
                      Includes hot chaffing dishes, buffet presentation, and full culinary preparation
                    </span>
                  </td>
                  <td className="p-3 text-center">{selectedEvent.guestCount}</td>
                  <td className="p-3 text-right font-mono">{formatNaira(Math.round(selectedEvent.totalCost / selectedEvent.guestCount))}</td>
                  <td className="p-3 text-right font-titan text-[#4D080F]">{formatNaira(selectedEvent.totalCost - 15000)}</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[#241311]">
                    Logistics, Setup, Chafing Fuel & Uniformed Service Crew
                  </td>
                  <td className="p-3 text-center">1 Team</td>
                  <td className="p-3 text-right font-mono">₦15,000</td>
                  <td className="p-3 text-right font-titan text-[#4D080F]">₦15,000</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals and Bank Details */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#E5DEC9] text-xs font-montserrat">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[10px] font-titan uppercase text-gray-600 block">Bank Settlement Details</span>
              <p className="font-bold text-[#4D080F]">Choplife Republic Ltd</p>
              <p className="text-gray-600">Bank: Moniepoint MFB / Zenith Bank</p>
              <p className="text-gray-600">Account No: <strong>8123456789</strong></p>
            </div>

            <div className="space-y-1.5 text-right">
              <div className="flex justify-between">
                <span className="text-gray-500">Gross Total:</span>
                <strong className="font-titan text-base text-[#4D080F]">{formatNaira(selectedEvent.totalCost)}</strong>
              </div>
              <div className="flex justify-between text-purple-700">
                <span>70% Booking Deposit Paid:</span>
                <strong>{formatNaira(selectedEvent.depositPaid)}</strong>
              </div>
              <div className="flex justify-between font-titan text-sm text-red-600 pt-1 border-t">
                <span>Outstanding Balance Due:</span>
                <span>{formatNaira(selectedEvent.balanceDue)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-titan uppercase rounded-xl shadow-xs flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print Quotation
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: BANQUET EVENT ORDER (BEO) & LOGISTICS PACKING SHEET */}
      {activePlannerTab === 'beo_packing_sheet' && selectedEvent && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#4D080F] shadow-md space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-[#4D080F] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#4D080F] text-[#FFC700] text-[10px] font-titan uppercase px-2.5 py-1 rounded-md">
                  OFFICIAL BEO MANIFEST
                </span>
                <span className="text-xs font-montserrat text-gray-500">
                  REF #{selectedEvent.referenceNo}
                </span>
              </div>
              <h2 className="font-titan text-2xl text-[#4D080F] mt-1">
                BANQUET EVENT ORDER & PACKING SHEET
              </h2>
              <p className="text-xs text-gray-600 font-montserrat">
                Production Kitchen Hub: <strong>Choplife {selectedEvent.assignedBranch.toUpperCase()}</strong> • Event Type: <strong>{selectedEvent.packageStyle}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] rounded-xl text-xs font-titan uppercase flex items-center gap-2 shadow-xs transition-all"
              >
                <Printer className="w-4 h-4" /> Print BEO & Packing Manifest
              </button>
            </div>
          </div>

          {/* Event Logistics Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] text-xs font-montserrat">
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-titan block">Client / Host</span>
              <strong className="text-[#241311] block text-sm">{selectedEvent.clientName}</strong>
              <span className="text-gray-500">{selectedEvent.clientPhone}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-titan block">Event Date & Time</span>
              <strong className="text-[#E62E00] block text-sm">{selectedEvent.eventDate}</strong>
              <span className="text-gray-700">Serving Time: {selectedEvent.eventTime}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-titan block">Guest Count</span>
              <strong className="text-[#4D080F] block text-sm">{selectedEvent.guestCount} Guests</strong>
              <span className="text-gray-500">Scalable Prep Factor: {(selectedEvent.guestCount / 100).toFixed(1)}x</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-titan block">Venue & Delivery</span>
              <strong className="text-[#241311] block">{selectedEvent.venueAddress}</strong>
              <span className="text-emerald-700 font-bold">Setup: 1.5 hrs prior</span>
            </div>
          </div>

          {/* Section 1: Hot & Cold Holding Food Handover */}
          <div className="space-y-3">
            <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-[#E62E00]" />
              1. Prepared Food Pans & Cambro Carriers Handover
            </h3>

            <div className="border border-[#E5DEC9] rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs font-montserrat">
                <thead className="bg-[#4D080F] text-[#FFC700] text-[10px] uppercase font-titan">
                  <tr>
                    <th className="p-3">Item Description</th>
                    <th className="p-3 text-center">Packaging Pan / Container</th>
                    <th className="p-3 text-center">Portion / Count</th>
                    <th className="p-3 text-center">Holding Temp Spec</th>
                    <th className="p-3 text-center">Kitchen Handover Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DEC9]">
                  {[
                    {
                      name: 'Smoky Firewood Jollof Rice (Party Style)',
                      container: 'Full GN 1/1 Food Pan (65mm)',
                      portions: `${Math.ceil(selectedEvent.guestCount * 0.75)} pax`,
                      temp: 'Hot Holding > 65°C',
                      key: 'food_jollof',
                    },
                    {
                      name: 'Special Fried Rice w/ Liver & Crisp Veggies',
                      container: 'Full GN 1/1 Food Pan (65mm)',
                      portions: `${Math.ceil(selectedEvent.guestCount * 0.5)} pax`,
                      temp: 'Hot Holding > 65°C',
                      key: 'food_fried_rice',
                    },
                    {
                      name: 'Choplife Flame-Grilled Quarter Chicken & Turkey',
                      container: 'Half GN 1/2 Deep Food Pans (2x)',
                      portions: `${selectedEvent.guestCount} pieces`,
                      temp: 'Hot Holding > 70°C',
                      key: 'food_chicken',
                    },
                    {
                      name: 'Mega Small Chops (Samosa, Spring Rolls, Puff-Puff)',
                      container: 'Vented Catering Chops Boxes (5x)',
                      portions: `${selectedEvent.guestCount * 3} pcs total`,
                      temp: 'Crisp Ambient Dry',
                      key: 'food_small_chops',
                    },
                    {
                      name: 'Signature Pepper Sauce & Asun Drizzle',
                      container: 'Squeeze Bottles & Warm Pan',
                      portions: '3 Liters',
                      temp: 'Hot Holding > 60°C',
                      key: 'food_sauces',
                    },
                    {
                      name: 'Chilled Hibiscus Zobo & Fruit Juice Pitchers',
                      container: 'Insulated Cold Beverage Dispenser',
                      portions: `${selectedEvent.guestCount} servings`,
                      temp: 'Chilled < 5°C',
                      key: 'food_drinks',
                    },
                  ].map((row) => (
                    <tr key={row.key} className="hover:bg-[#FAF7F2]">
                      <td className="p-3 font-bold text-[#241311]">{row.name}</td>
                      <td className="p-3 text-center text-gray-700">{row.container}</td>
                      <td className="p-3 text-center font-bold text-[#4D080F]">{row.portions}</td>
                      <td className="p-3 text-center text-xs font-mono text-emerald-800">{row.temp}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => togglePackedItem(row.key)}
                          className={`px-3 py-1 rounded-xl text-[10px] font-titan uppercase transition-all flex items-center justify-center gap-1 mx-auto ${
                            packedItems[row.key]
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border'
                          }`}
                        >
                          {packedItems[row.key] ? (
                            <>
                              <Check className="w-3 h-3" /> Inspected & Loaded
                            </>
                          ) : (
                            'Pending Prep'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Hardware & Equipment Packing Manifest */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-titan text-sm text-[#4D080F] uppercase flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#E62E00]" />
                2. Banquet Equipment & Service Hardware Manifest
              </h3>
              <span className="text-xs font-montserrat text-gray-500">
                Audit at dispatch & venue return
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: 'chafers', name: 'Stainless Chafing Dishes (Roll-Top / Lift)', qty: `${Math.ceil(selectedEvent.guestCount / 40)} Units` },
                { id: 'sterno', name: 'Sterno Chafing Fuel Cans (2-Hour Burning)', qty: `${Math.ceil(selectedEvent.guestCount / 40) * 2} Cans` },
                { id: 'tongs', name: 'Heavy-Duty Serving Tongs & Deep Ladles', qty: '8 Pairs' },
                { id: 'cambro_hot', name: 'Cambro Insulated Front-Loading Carriers', qty: '3 Boxes' },
                { id: 'table_linens', name: 'Buffet Skirting & Dark Red Linens', qty: '4 Sets' },
                { id: 'plates_cutlery', name: 'Guest Plates, Fork/Spoon Packs & 2-Ply Napkins', qty: `${selectedEvent.guestCount + 20} Packs` },
                { id: 'trash_bins', name: 'Pop-Up Heavy Duty Disposal Bins & Liners', qty: '4 Sets' },
                { id: 'hand_sanitizer', name: 'Touchless Sanitizer & Server Gloves', qty: '2 Boxes' },
                { id: 'takeaway_foil', name: 'Catering Foil & VIP Takeaway Boxes', qty: '50 Packs' },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => togglePackedItem(item.id)}
                  className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-2 ${
                    packedItems[item.id]
                      ? 'bg-emerald-50/70 border-emerald-500 text-emerald-950'
                      : 'bg-[#FAF7F2] border-[#E5DEC9] hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center mt-0.5 transition-all ${
                        packedItems[item.id] ? 'bg-emerald-600 text-white' : 'border border-gray-400 bg-white'
                      }`}
                    >
                      {packedItems[item.id] && <Check className="w-3 h-3" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">{item.name}</p>
                      <p className="text-[10px] text-gray-500 font-montserrat mt-0.5 font-semibold">
                        Qty: {item.qty}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-titan uppercase px-2 py-0.5 rounded ${
                      packedItems[item.id] ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {packedItems[item.id] ? 'Packed' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Sign-Off and Dispatch Handover */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t-2 border-[#4D080F] text-xs font-montserrat">
            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9] space-y-2">
              <span className="text-[10px] font-titan uppercase text-gray-500 block">
                1. Head Chef / Kitchen Lead Sign-Off
              </span>
              <p className="font-bold text-[#241311]">Kitchen Pass Release: PASSED</p>
              <p className="text-[11px] text-gray-500">All portions & food temps verified before seal.</p>
              <div className="pt-2 border-t border-dashed border-gray-300">
                <span className="text-[10px] text-gray-400 font-mono">Sign: Chef Osagie (Branch Lead)</span>
              </div>
            </div>

            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9] space-y-2">
              <span className="text-[10px] font-titan uppercase text-gray-500 block">
                2. Logistics / Van Driver Sign-Off
              </span>
              <p className="font-bold text-[#241311]">Van Loading: VERIFIED</p>
              <p className="text-[11px] text-gray-500">Chafers & food cambros strapped and secured.</p>
              <div className="pt-2 border-t border-dashed border-gray-300">
                <span className="text-[10px] text-gray-400 font-mono">Sign: Choplife Logistics Van 02</span>
              </div>
            </div>

            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9] space-y-2">
              <span className="text-[10px] font-titan uppercase text-gray-500 block">
                3. On-Site Banquet Captain Sign-Off
              </span>
              <p className="font-bold text-[#241311]">Venue Setup & Handover</p>
              <p className="text-[11px] text-gray-500">Audit completed upon client arrival at venue.</p>
              <div className="pt-2 border-t border-dashed border-gray-300">
                <span className="text-[10px] text-gray-400 font-mono">Sign: ___________________</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* NEW EVENT CONTRACT MODAL */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 space-y-4 shadow-2xl border-2 border-[#FFC700] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-titan text-[#4D080F] uppercase">Enterprise Event Booking</span>
                <h3 className="font-titan text-lg text-[#4D080F]">Book New Catering Contract</h3>
              </div>
              <button
                onClick={() => setIsNewEventModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                    Client Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chief Osasuyi Igbinedion"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                  />
                </div>

                <div>
                  <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                    Client Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 08031234567"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                  />
                </div>

                <div>
                  <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                    Serving Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                  />
                </div>

                <div>
                  <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                    Expected Guests
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="2000"
                    required
                    value={newGuests}
                    onChange={(e) => setNewGuests(Number(e.target.value))}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-titan text-[#4D080F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                    Catering Package Style
                  </label>
                  <select
                    value={newPackage}
                    onChange={(e) => setNewPackage(e.target.value as any)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat font-bold text-[#4D080F]"
                  >
                    <option value="jollof_grills">Party Jollof & Charcoal Grills (₦4,500/head)</option>
                    <option value="chops_fiesta">Mega Small Chops Fiesta (₦3,200/head)</option>
                    <option value="shawarma_bar">Shawarma & Finger Foods Bar (₦3,800/head)</option>
                    <option value="executive">Executive Multi-Course Feast (₦6,500/head)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                    Primary Production Hub
                  </label>
                  <select
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value as BranchId)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat font-bold text-[#4D080F]"
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
                <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                  Event Venue & Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Victor Uwaifo Creative Hub, Airport Rd, Benin City"
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                />
              </div>

              <div>
                <label className="text-xs font-montserrat font-bold text-gray-700 block mb-1">
                  Special Kitchen Prep Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 50 packs extra spicy; 2 VIP buffet warming trays requested"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl p-2 text-xs font-montserrat text-[#241311]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewEventModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-montserrat font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4D080F] hover:bg-[#38050A] text-[#FFC700] text-xs font-titan uppercase rounded-xl shadow-xs"
                >
                  Register Event & Calculate BOM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
