import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, BranchId, OrderStatus } from '../../types';
import {
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Filter,
  Layers,
  ChefHat,
  Truck,
  Sparkles,
  Search,
  Bell,
  RefreshCw,
  UtensilsCrossed,
  X,
  Check,
  ChevronRight,
  Eye,
  Building,
  Printer,
  BellRing,
  BookOpen,
  Keyboard,
  Thermometer,
  Timer,
} from 'lucide-react';

import { CHOPLIFE_SOP_RECIPES } from './kdsRecipeData';
import { HardwarePrinterModal } from './HardwarePrinterModal';
import { dispatchKitchenKot } from '../../utils/hardwarePrinter';

export type KdsStation = 'all' | 'grill' | 'kitchen_bakery' | 'packs_drinks' | 'expediter';

interface KitchenDisplaySystemProps {
  onClose?: () => void;
  initialStation?: KdsStation;
}

export const KitchenDisplaySystem: React.FC<KitchenDisplaySystemProps> = ({
  onClose,
  initialStation = 'all',
}) => {
  const {
    orders,
    branches,
    selectedBranchId,
    updateOrderStatus,
    formatNaira,
    currentStaff,
  } = useApp();

  const [activeBranch, setActiveBranch] = useState<BranchId>(selectedBranchId || 'gra');
  const [activeStation, setActiveStation] = useState<KdsStation>(initialStation);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [recalledOrders, setRecalledOrders] = useState<string[]>([]);
  const [isHardwarePrinterModalOpen, setIsHardwarePrinterModalOpen] = useState<boolean>(false);
  const [isPrintingKot, setIsPrintingKot] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bumpedTicketHistory, setBumpedTicketHistory] = useState<Order[]>([]);
  const [showBumped, setShowBumped] = useState<boolean>(false);
  const [selectedKotOrder, setSelectedKotOrder] = useState<Order | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null);

  const [isRecipeCardsOpen, setIsRecipeCardsOpen] = useState<boolean>(false);
  const [selectedRecipeStation, setSelectedRecipeStation] = useState<'grill' | 'kitchen' | 'bakery_fryer'>('grill');
  const [bumpToast, setBumpToast] = useState<string | null>(null);

  // Ref to track seen order IDs to chime on incoming online/store tickets
  const seenOrderIdsRef = React.useRef<Set<string>>(new Set(orders.map((o) => o.id)));

  // Ticking timer for real-time prep duration calculations
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio API tone generator for bump action
  const playBumpChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      // Audio context might be restricted before interaction
    }
  };

  // Web Audio API multi-tone kitchen bell for incoming new orders
  const playNewOrderChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + idx * 0.12);
        osc.stop(audioCtx.currentTime + idx * 0.12 + 0.4);
      });
    } catch (e) {
      // Audio context restricted
    }
  };

  // Detect new tickets dynamically arriving in active branch
  useEffect(() => {
    const newTickets = orders.filter(
      (o) =>
        o.branchId === activeBranch &&
        (o.orderStatus === 'received' || o.orderStatus === 'confirmed') &&
        !seenOrderIdsRef.current.has(o.id)
    );

    if (newTickets.length > 0) {
      const latest = newTickets[0];
      playNewOrderChime();
      setNewOrderAlert(`New Order #${latest.orderNumber} arrived in ${activeBranch.toUpperCase()}!`);
      const timer = setTimeout(() => setNewOrderAlert(null), 5000);
      // Mark all current order IDs as seen
      orders.forEach((o) => seenOrderIdsRef.current.add(o.id));
      return () => clearTimeout(timer);
    }
  }, [orders, activeBranch]);

  // Classify item station
  const getItemStation = (itemName: string): 'grill' | 'kitchen_bakery' | 'packs_drinks' => {
    const lower = itemName.toLowerCase();
    if (
      lower.includes('chicken') ||
      lower.includes('asun') ||
      lower.includes('turkey') ||
      lower.includes('fish') ||
      lower.includes('grill') ||
      lower.includes('wings') ||
      lower.includes('fries') ||
      lower.includes('shawarma')
    ) {
      return 'grill';
    }
    if (
      lower.includes('chops') ||
      lower.includes('samosa') ||
      lower.includes('spring roll') ||
      lower.includes('puff') ||
      lower.includes('zobo') ||
      lower.includes('drink') ||
      lower.includes('malt') ||
      lower.includes('water') ||
      lower.includes('coke')
    ) {
      return 'packs_drinks';
    }
    return 'kitchen_bakery'; // Jollof, Fried Rice, Soups, Bread, Meatpie
  };

  // Filter orders for KDS
  const kdsOrders = useMemo(() => {
    return orders.filter((ord) => {
      const matchesBranch = ord.branchId === activeBranch;
      const isLiveState =
        ord.orderStatus === 'received' ||
        ord.orderStatus === 'confirmed' ||
        ord.orderStatus === 'preparing' ||
        ord.orderStatus === 'ready' ||
        (showBumped && (ord.orderStatus === 'out_for_delivery' || ord.orderStatus === 'delivered' || (ord.orderStatus as any) === 'completed'));

      const matchesSearch =
        ord.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.deliveryDetails.customerName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesBranch && isLiveState && matchesSearch;
    });
  }, [orders, activeBranch, searchQuery, showBumped]);

  // Order prep urgency timing (Green < 10m, Amber 10-18m, Red > 18m)
  const getTicketTiming = (createdAt: string) => {
    const elapsedSeconds = Math.max(0, Math.floor((currentTime - new Date(createdAt).getTime()) / 1000));
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;

    let urgency: 'normal' | 'warning' | 'urgent' = 'normal';
    if (mins >= 18) urgency = 'urgent';
    else if (mins >= 10) urgency = 'warning';

    return { elapsedSeconds, mins, formatted, urgency };
  };

  // Bump order to next operational status
  const handleBumpOrder = (ord: Order) => {
    playBumpChime();
    let nextStatus: OrderStatus = 'preparing';
    if (ord.orderStatus === 'received' || ord.orderStatus === 'confirmed') {
      nextStatus = 'preparing';
    } else if (ord.orderStatus === 'preparing') {
      nextStatus = 'ready';
    } else if (ord.orderStatus === 'ready') {
      nextStatus = ord.orderType === 'dine-in' ? 'delivered' : 'out_for_delivery';
      // Add to recallable history
      setBumpedTicketHistory((prev) => [ord, ...prev.slice(0, 9)]);
    }
    updateOrderStatus(ord.id, nextStatus);
  };

  // Recall last completed ticket
  const handleRecallOrder = (ord: Order) => {
    updateOrderStatus(ord.id, 'ready');
    setBumpedTicketHistory((prev) => prev.filter((o) => o.id !== ord.id));
    playBumpChime();
  };

  // Filtered orders visible on the active station display
  const visibleOrders = useMemo(() => {
    return kdsOrders.filter((ord) => {
      if (activeStation === 'all' || activeStation === 'expediter') return true;
      return ord.items.some((it) => getItemStation(it.product.name) === activeStation);
    });
  }, [kdsOrders, activeStation]);

  // Commercial KDS Bump Bar Keyboard Listener
  // [Keys 1-8]: Bump corresponding ticket
  // [Space or 0]: Recall last bumped ticket
  // [Tab or ']' / '[']: Cycle forward/backward through stations
  // ['S' or 'R']: Toggle Kitchen SOP Recipe Card Guide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Keys 1 to 8: Bump corresponding ticket
      if (e.key >= '1' && e.key <= '8') {
        const index = parseInt(e.key, 10) - 1;
        const targetOrder = visibleOrders[index];
        if (targetOrder) {
          e.preventDefault();
          handleBumpOrder(targetOrder);
          setBumpToast(`Bumped #${targetOrder.orderNumber} via Key [${e.key}]`);
          setTimeout(() => setBumpToast(null), 2200);
        }
      } else if (e.key === ' ' || e.key === '0') {
        // Space or 0: Recall last bumped ticket
        if (bumpedTicketHistory.length > 0) {
          e.preventDefault();
          const last = bumpedTicketHistory[0];
          handleRecallOrder(last);
          setBumpToast(`Recalled #${last.orderNumber} via Key [SPACE]`);
          setTimeout(() => setBumpToast(null), 2200);
        }
      } else if (e.key === 'Tab' || e.key === ']') {
        e.preventDefault();
        const STATIONS: KdsStation[] = ['all', 'grill', 'kitchen_bakery', 'packs_drinks', 'expediter'];
        const currentIndex = STATIONS.indexOf(activeStation);
        const nextStation = STATIONS[(currentIndex + 1) % STATIONS.length];
        setActiveStation(nextStation);
      } else if (e.key === '[') {
        e.preventDefault();
        const STATIONS: KdsStation[] = ['all', 'grill', 'kitchen_bakery', 'packs_drinks', 'expediter'];
        const currentIndex = STATIONS.indexOf(activeStation);
        const prevStation = STATIONS[(currentIndex - 1 + STATIONS.length) % STATIONS.length];
        setActiveStation(prevStation);
      } else if (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsRecipeCardsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleOrders, bumpedTicketHistory, activeStation]);

  const getStationBadge = (st: KdsStation) => {
    switch (st) {
      case 'grill':
        return { label: 'GRILL & FRYER', color: 'bg-orange-500 text-white' };
      case 'kitchen_bakery':
        return { label: 'MAIN KITCHEN / BAKERY', color: 'bg-amber-600 text-white' };
      case 'packs_drinks':
        return { label: 'PACKS & CHOPS', color: 'bg-emerald-600 text-white' };
      case 'expediter':
        return { label: 'EXPEDITER & DISPATCH', color: 'bg-blue-600 text-white' };
      default:
        return { label: 'ALL STATIONS', color: 'bg-[#4D080F] text-[#FFC700]' };
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#181110] text-[#FAF7F2] font-montserrat rounded-3xl overflow-hidden shadow-2xl border border-stone-800">
      {/* Top KDS Control Bar */}
      <div className="bg-[#241311] border-b border-stone-800 p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center font-titan text-xl shadow-md">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#E62E00] text-white font-titan text-[10px] rounded-full uppercase tracking-wider animate-pulse">
                LIVE KDS DISPLAY
              </span>
              <span className="text-xs text-stone-400 font-mono">
                {new Date(currentTime).toLocaleTimeString()}
              </span>
            </div>
            <h2 className="font-titan text-lg sm:text-xl text-[#FAF7F2] flex items-center gap-2">
              ChopLife Kitchen Station Director
            </h2>
          </div>
        </div>

        {/* Branch Selector & Station Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[#181110] p-1 rounded-2xl border border-stone-800">
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBranch(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-titan transition-all ${
                  activeBranch === b.id
                    ? 'bg-[#FFC700] text-[#4D080F] shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {b.shortName}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition-all ${
              soundEnabled
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-400'
                : 'bg-stone-900 border-stone-700 text-stone-500'
            }`}
            title={soundEnabled ? 'Kitchen Bell Enabled' : 'Kitchen Bell Muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={playNewOrderChime}
            className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 text-xs font-titan flex items-center gap-1.5 transition-all active:scale-95"
            title="Test Kitchen Speaker Chime"
          >
            <BellRing className="w-3.5 h-3.5 text-[#FFC700]" />
            <span className="hidden sm:inline">Test Bell</span>
          </button>

          {/* Recipe SOP Button */}
          <button
            onClick={() => setIsRecipeCardsOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[#FFC700] text-xs font-titan flex items-center gap-1.5 transition-all active:scale-95"
            title="Open Kitchen SOP & Recipe Specs Guide (Keyboard: S)"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#FFC700]" />
            <span className="hidden sm:inline">Recipe SOPs</span>
            <span className="text-[10px] font-mono bg-black/40 px-1 py-0.2 rounded text-amber-300">[S]</span>
          </button>

          {/* Station Hardware Thermal Printer Config */}
          <button
            onClick={() => setIsHardwarePrinterModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 text-xs font-titan flex items-center gap-1.5 transition-all active:scale-95"
            title="Station Thermal Printer & Chits Settings"
          >
            <Printer className="w-3.5 h-3.5 text-[#FFC700]" />
            <span className="hidden sm:inline">Station Printer</span>
          </button>

          {/* Show Bumped Toggle */}
          <button
            onClick={() => setShowBumped(!showBumped)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-titan flex items-center gap-1.5 transition-all active:scale-95 ${
              showBumped
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-sm'
                : 'bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800'
            }`}
            title="Toggle visibility of recently bumped and completed tickets"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{showBumped ? '✓ Showing Bumped' : 'Show Bumped'}</span>
          </button>

          {/* Bump Bar Status Pill */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-stone-900 border border-stone-700/80 rounded-xl text-[10px] font-mono text-stone-300">
            <Keyboard className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Bump Bar: [1-8] Bump • [Space] Recall • [Tab] Station</span>
          </div>

          {bumpedTicketHistory.length > 0 && (
            <button
              onClick={() => handleRecallOrder(bumpedTicketHistory[0])}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded-xl text-xs font-titan flex items-center gap-1.5 border border-stone-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recall #{bumpedTicketHistory[0].orderNumber}
              <span className="text-[10px] font-mono opacity-70">[SPC]</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-stone-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* New Order Alert Banner */}
      {newOrderAlert && (
        <div className="bg-[#E62E00] text-white px-4 py-2 flex items-center justify-between text-xs font-titan shadow-lg shrink-0 border-b border-red-700">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#FFC700] animate-bounce" />
            <span>{newOrderAlert}</span>
          </div>
          <button
            onClick={() => setNewOrderAlert(null)}
            className="text-white/80 hover:text-white text-xs underline font-montserrat"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Station Filter Tabs */}
      <div className="bg-[#1F1716] px-4 py-2 border-b border-stone-800 flex items-center justify-between gap-3 overflow-x-auto shrink-0">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'All Stations', count: kdsOrders.length },
            {
              id: 'grill',
              label: '🔥 Grill & Fryer',
              count: kdsOrders.filter((o) => o.items.some((i) => getItemStation(i.product.name) === 'grill')).length,
            },
            {
              id: 'kitchen_bakery',
              label: '🍲 Main Kitchen / Bakery',
              count: kdsOrders.filter((o) => o.items.some((i) => getItemStation(i.product.name) === 'kitchen_bakery')).length,
            },
            {
              id: 'packs_drinks',
              label: '🥡 Packs & Drinks',
              count: kdsOrders.filter((o) => o.items.some((i) => getItemStation(i.product.name) === 'packs_drinks')).length,
            },
            {
              id: 'expediter',
              label: '📦 Expediter Dispatch',
              count: kdsOrders.filter((o) => o.orderStatus === 'ready').length,
            },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setActiveStation(st.id as KdsStation)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-titan transition-all whitespace-nowrap flex items-center gap-2 ${
                activeStation === st.id
                  ? 'bg-[#FFC700] text-[#4D080F] shadow-sm'
                  : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
              }`}
            >
              <span>{st.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeStation === st.id ? 'bg-[#4D080F] text-[#FFC700]' : 'bg-stone-800 text-stone-400'
                }`}
              >
                {st.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-48 shrink-0">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter ticket..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-900 border border-stone-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 placeholder-stone-500"
          />
        </div>
      </div>

      {/* Main KDS Order Cards Grid */}
      <div className="flex-1 p-4 overflow-y-auto bg-[#140D0C]">
        {kdsOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-stone-500">
            <CheckCircle2 className="w-16 h-16 text-emerald-600 mb-3 opacity-80" />
            <h3 className="font-titan text-xl text-stone-300">Kitchen Display is Clear!</h3>
            <p className="text-xs text-stone-400 max-w-sm mt-1">
              All tickets for {branches.find((b) => b.id === activeBranch)?.name} are prepped and served.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleOrders.map((ord, index) => {
              const timing = getTicketTiming(ord.createdAt);
              const isDineIn = ord.deliveryDetails.orderType === 'dine-in';
              const isDelivery = ord.deliveryDetails.orderType === 'delivery';

              // Filter items if specific station selected
              const displayItems = ord.items.filter((it) => {
                if (activeStation === 'all' || activeStation === 'expediter') return true;
                return getItemStation(it.product.name) === activeStation;
              });

              if (displayItems.length === 0 && activeStation !== 'all' && activeStation !== 'expediter') {
                return null;
              }

              // Color scheme based on urgency
              const urgencyHeader =
                timing.urgency === 'urgent'
                  ? 'bg-red-700 text-white animate-pulse'
                  : timing.urgency === 'warning'
                  ? 'bg-amber-600 text-stone-900'
                  : 'bg-emerald-700 text-white';

              return (
                <div
                  key={ord.id}
                  className="bg-[#241311] rounded-2xl border-2 border-stone-800 flex flex-col justify-between overflow-hidden shadow-xl hover:border-[#FFC700]/50 transition-all relative"
                >
                  {/* Ticket Header */}
                  <div className={`p-3 flex items-center justify-between font-titan ${urgencyHeader}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-base tracking-wider">#{ord.orderNumber}</span>
                      {index < 8 && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-amber-300 border border-amber-400/40">
                          KEY {index + 1}
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/20 uppercase">
                        {isDineIn ? (ord.tableNumber || 'Table') : isDelivery ? 'Delivery' : 'Takeaway'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {timing.formatted}
                    </div>
                  </div>

                  {/* Customer & Prep Info */}
                  <div className="px-3.5 py-2 bg-[#1C0F0E] border-b border-stone-800 flex items-center justify-between text-xs text-stone-400">
                    <span className="font-bold text-stone-300 truncate max-w-[150px]">
                      {ord.deliveryDetails.customerName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-titan uppercase ${
                        ord.orderStatus === 'ready'
                          ? 'bg-emerald-900 text-emerald-300'
                          : ord.orderStatus === 'preparing'
                          ? 'bg-amber-900 text-amber-300'
                          : 'bg-blue-900 text-blue-300'
                      }`}
                    >
                      {ord.orderStatus.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="p-3.5 space-y-2.5 flex-1 divide-y divide-stone-800/80">
                    {displayItems.map((item, idx) => (
                      <div key={idx} className="pt-2 first:pt-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className="w-6 h-6 rounded-lg bg-[#FFC700] text-[#4D080F] font-titan text-xs flex items-center justify-center shrink-0">
                              {item.quantity}x
                            </span>
                            <div>
                              <strong className="text-sm font-titan text-stone-100 block">
                                {item.product.name}
                              </strong>
                              {/* Station Tag */}
                              <span className="text-[9px] font-titan text-stone-400 uppercase">
                                [{getItemStation(item.product.name).replace('_', ' ')}]
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Modifiers & Special Instructions */}
                        {item.customization && (
                          <div className="ml-8 mt-1 space-y-0.5 text-[11px] text-amber-400/90 font-montserrat">
                            {item.customization.selectedOptions?.map((opt, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-amber-400" />
                                {opt.name}: {opt.choice}
                              </div>
                            ))}
                            {item.customization.selectedAddOns?.map((addon, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-amber-400" />
                                + {addon.name}
                              </div>
                            ))}
                            {item.customization.specialInstructions && (
                              <div className="text-[10px] bg-red-950/40 text-red-300 px-2 py-0.5 rounded border border-red-900/50 mt-1 font-bold">
                                NOTE: {item.customization.specialInstructions}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Customer General Note */}
                    {ord.deliveryDetails.specialInstructions && (
                      <div className="pt-2">
                        <span className="text-[10px] font-bold text-amber-300 block">
                          TICKET NOTE: {ord.deliveryDetails.specialInstructions}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bump & Print Button Footer */}
                  <div className="p-3 bg-[#1F1210] border-t border-stone-800 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedKotOrder(ord)}
                      className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition-colors shrink-0"
                      title="Print Thermal Kitchen Ticket (80mm KOT)"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {ord.orderStatus === 'out_for_delivery' || ord.orderStatus === 'delivered' || (ord.orderStatus as any) === 'completed' ? (
                      <button
                        onClick={() => handleRecallOrder(ord)}
                        className="flex-1 py-2.5 rounded-xl font-titan text-xs uppercase flex items-center justify-center gap-1.5 shadow-md transition-all bg-amber-600 hover:bg-amber-500 text-stone-900"
                        title="Recall order back to active kitchen prep queue"
                      >
                        <RotateCcw className="w-4 h-4" /> Recall to Kitchen
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBumpOrder(ord)}
                        className={`flex-1 py-2.5 rounded-xl font-titan text-xs uppercase flex items-center justify-center gap-1.5 shadow-md transition-all ${
                          ord.orderStatus === 'received' || ord.orderStatus === 'confirmed'
                            ? 'bg-amber-600 hover:bg-amber-500 text-stone-900'
                            : ord.orderStatus === 'preparing'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-[#0284C7] hover:bg-[#0369A1] text-white'
                        }`}
                      >
                        {ord.orderStatus === 'received' || ord.orderStatus === 'confirmed' ? (
                          <>
                            <Flame className="w-4 h-4" /> Start Prep
                          </>
                        ) : ord.orderStatus === 'preparing' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Mark Ready
                          </>
                        ) : (
                          <>
                            <Truck className="w-4 h-4" /> Bump
                          </>
                        )}
                        <span className="text-[10px] font-mono opacity-80 ml-0.5">
                          [{index < 8 ? `K${index + 1}` : 'TAP'}]
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 80mm THERMAL KITCHEN ORDER TICKET (KOT) MODAL */}
      {selectedKotOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white text-black rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col font-mono">
            {/* Modal Controls */}
            <div className="p-3 bg-stone-900 text-white rounded-t-2xl flex items-center justify-between font-sans print:hidden">
              <span className="font-titan text-xs flex items-center gap-1.5 text-amber-400">
                <Printer className="w-4 h-4" /> Thermal Kitchen Ticket (KOT)
              </span>
              <button
                onClick={() => setSelectedKotOrder(null)}
                className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 80mm Print Area */}
            <div className="p-5 text-xs space-y-3 leading-tight print:p-0 print:m-0" id="thermal-kot-chit">
              <div className="text-center pb-2 border-b-2 border-dashed border-stone-400">
                <p className="font-black text-base uppercase tracking-wider">CHOPLIFE REPUBLIC</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-600">
                  KITCHEN ORDER TICKET (KOT)
                </p>
                <p className="text-[11px] font-bold mt-1">
                  BRANCH: {selectedKotOrder.branchId.toUpperCase()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1 text-[11px] border-b border-stone-300 pb-2">
                <div>
                  <span className="text-stone-500 block text-[9px]">TICKET #</span>
                  <span className="font-black text-sm">#{selectedKotOrder.orderNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-stone-500 block text-[9px]">TYPE</span>
                  <span className="font-black uppercase bg-stone-200 px-1 py-0.5 rounded text-[10px]">
                    {selectedKotOrder.deliveryDetails.orderType === 'dine-in'
                      ? `TABLE ${selectedKotOrder.tableNumber || '1'}`
                      : selectedKotOrder.deliveryDetails.orderType.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[9px]">TIME</span>
                  <span className="font-bold">
                    {new Date(selectedKotOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-stone-500 block text-[9px]">EXPEDITER</span>
                  <span className="font-bold">{currentStaff?.name || 'Chef Lead'}</span>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2 py-1 border-b-2 border-dashed border-stone-400">
                <div className="flex justify-between font-bold text-[10px] text-stone-600 uppercase">
                  <span>QTY / ITEM</span>
                  <span>STATION</span>
                </div>
                {selectedKotOrder.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex items-start justify-between font-bold text-xs">
                      <span>
                        [{item.quantity}X] {item.product.name.toUpperCase()}
                      </span>
                      <span className="text-[9px] uppercase font-mono bg-stone-100 px-1">
                        {getItemStation(item.product.name).toUpperCase()}
                      </span>
                    </div>

                    {item.customization && (
                      <div className="pl-4 text-[10px] text-stone-700 font-sans space-y-0.5">
                        {item.customization.selectedOptions?.map((o, i) => (
                          <div key={i}>• {o.name}: {o.choice}</div>
                        ))}
                        {item.customization.selectedAddOns?.map((a, i) => (
                          <div key={i}>+ {a.name}</div>
                        ))}
                        {item.customization.specialInstructions && (
                          <div className="font-bold text-red-700 bg-red-50 px-1">
                            *** NOTE: {item.customization.specialInstructions} ***
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedKotOrder.deliveryDetails.specialInstructions && (
                <div className="p-2 bg-stone-100 rounded border border-stone-300 font-bold text-[10px]">
                  TICKET NOTE: {selectedKotOrder.deliveryDetails.specialInstructions}
                </div>
              )}

              <div className="text-center pt-2 text-[10px] text-stone-500 border-t border-stone-300">
                <span>Cooked Fresh & Hot • 100% Maximum Enjoyment</span>
              </div>
            </div>

            {/* Print & Action Footer */}
            <div className="p-4 bg-stone-100 border-t border-stone-300 rounded-b-2xl flex items-center justify-between gap-3 font-sans print:hidden">
              <button
                onClick={() => setSelectedKotOrder(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 font-titan text-xs rounded-xl"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  if (!selectedKotOrder) return;
                  setIsPrintingKot(true);
                  try {
                    await dispatchKitchenKot(selectedKotOrder, activeStation);
                  } finally {
                    setIsPrintingKot(false);
                  }
                }}
                disabled={isPrintingKot}
                className="px-5 py-2 bg-[#E62E00] hover:bg-[#c92800] text-white font-titan text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                <Printer className={`w-4 h-4 ${isPrintingKot ? 'animate-bounce' : ''}`} />
                <span>{isPrintingKot ? 'Printing KOT...' : 'Print Station Chit (80mm)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bump Bar Feedback Toast */}
      {bumpToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#FFC700] text-[#4D080F] px-4 py-2 rounded-2xl shadow-2xl font-titan text-xs flex items-center gap-2 border-2 border-[#4D080F] animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Keyboard className="w-4 h-4" />
          <span>{bumpToast}</span>
        </div>
      )}

      {/* Recipe Standards & SOP Guide Modal */}
      {isRecipeCardsOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-[#1C1211] text-[#FAF7F2] border border-stone-700 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#251513] border-b border-stone-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#E62E00] text-white text-[10px] font-titan rounded-full uppercase">
                      ChopLife SOP Standards
                    </span>
                    <span className="text-xs text-stone-400 font-mono">Kitchen QA & Consistency Guide</span>
                  </div>
                  <h3 className="font-titan text-lg sm:text-xl text-white">Line Cook Recipe & Prep Specifications</h3>
                </div>
              </div>
              <button
                onClick={() => setIsRecipeCardsOpen(false)}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Station Filter Tabs */}
            <div className="bg-[#180E0D] px-4 py-2.5 border-b border-stone-800 flex items-center gap-2 overflow-x-auto shrink-0">
              {[
                { id: 'all', label: 'All Recipes' },
                { id: 'grill', label: '🔥 Grill & Flame Station' },
                { id: 'kitchen', label: '🍲 Main Kitchen / Caldera' },
                { id: 'bakery_fryer', label: '🥟 Fryer & Bakery Station' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedRecipeStation(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-titan transition-all whitespace-nowrap ${
                    (tab.id === 'all' && selectedRecipeStation === 'all' as any) || selectedRecipeStation === tab.id
                      ? 'bg-[#FFC700] text-[#4D080F]'
                      : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Recipes Cards List */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {CHOPLIFE_SOP_RECIPES.filter(
                (r) => (selectedRecipeStation as string) === 'all' || r.station === selectedRecipeStation
              ).map((recipe) => (
                <div
                  key={recipe.id}
                  className="bg-[#241311] border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg hover:border-stone-700 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-3">
                    <div>
                      <span className="text-[10px] font-titan uppercase tracking-wider text-[#FFC700] bg-[#4D080F] px-2.5 py-0.5 rounded-md">
                        {recipe.stationLabel}
                      </span>
                      <h4 className="font-titan text-lg sm:text-xl text-white mt-1">{recipe.name}</h4>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/60 border border-red-800/60 text-red-300 rounded-xl text-xs font-mono font-bold">
                        <Thermometer className="w-3.5 h-3.5 text-red-400" />
                        <span>{recipe.criticalTemp}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-900 border border-stone-800 text-stone-300 rounded-xl text-xs font-mono">
                        <Timer className="w-3.5 h-3.5 text-amber-400" />
                        <span>{recipe.prepTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* Yield & Holding Specs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#180E0D] p-3 rounded-xl border border-stone-800/80 font-montserrat">
                    <div>
                      <span className="text-stone-400 block text-[10px] uppercase font-titan">Standard Batch Yield:</span>
                      <span className="text-stone-200 font-semibold">{recipe.yieldInfo}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px] uppercase font-titan">Holding Standard:</span>
                      <span className="text-stone-200 font-semibold">{recipe.holdingStandard}</span>
                    </div>
                  </div>

                  {/* Ingredients & Prep Steps Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Ingredients Column */}
                    <div className="bg-[#1A0F0E] p-3.5 rounded-xl border border-stone-800/60">
                      <h5 className="font-titan text-xs text-[#FFC700] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        Required Ingredients
                      </h5>
                      <ul className="space-y-1.5 text-xs text-stone-300">
                        {recipe.ingredients.map((ing, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-[#FFC700] text-[10px] mt-0.5">•</span>
                            <span>{ing}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Step-by-Step SOP Column */}
                    <div className="md:col-span-2 bg-[#1A0F0E] p-3.5 rounded-xl border border-stone-800/60">
                      <h5 className="font-titan text-xs text-[#FFC700] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5" />
                        Step-by-Step Kitchen Procedure
                      </h5>
                      <ol className="space-y-2 text-xs text-stone-300">
                        {recipe.steps.map((step, sIdx) => (
                          <li key={sIdx} className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-[#4D080F] text-[#FFC700] text-[10px] font-titan flex items-center justify-center shrink-0 mt-0.5 border border-[#FFC700]/30">
                              {sIdx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>

                      {/* Head Chef Quality Assurance Tip */}
                      <div className="mt-3.5 p-2.5 bg-amber-950/40 border border-amber-600/40 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-[#FFC700] shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-titan text-[11px] block text-[#FFC700] uppercase">Head Chef Quality Rule:</strong>
                          <span>{recipe.chefTip}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-[#251513] border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
              <span>Choplife Republic Standard Operating Procedures v2.4</span>
              <button
                onClick={() => setIsRecipeCardsOpen(false)}
                className="px-4 py-2 bg-[#FFC700] hover:bg-amber-400 text-[#4D080F] font-titan rounded-xl transition-all"
              >
                Close Reference Guide [Esc]
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Station Hardware Printer Modal */}
      <HardwarePrinterModal
        isOpen={isHardwarePrinterModalOpen}
        onClose={() => setIsHardwarePrinterModalOpen(false)}
      />

    </div>
  );
};
