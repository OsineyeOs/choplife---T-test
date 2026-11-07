import React from 'react';
import { RefreshCw, RotateCcw, CheckCircle2 } from 'lucide-react';

interface WorkspaceKdsTabProps {
  kdsChannelFilter: string;
  setKdsChannelFilter: (f: any) => void;
  kdsShowBumped: boolean;
  setKdsShowBumped: (b: boolean) => void;
  fetchKds: () => void;
  kdsTickets: any[];
  handleAdvanceKdsItem: (ticketId: string, itemId: string, status: string) => void;
  handleRecallKdsTicket: (ticketId: string) => void;
  handleBumpKdsTicket: (ticketId: string) => void;
}

export const WorkspaceKdsTab: React.FC<WorkspaceKdsTabProps> = ({
  kdsChannelFilter,
  setKdsChannelFilter,
  kdsShowBumped,
  setKdsShowBumped,
  fetchKds,
  kdsTickets,
  handleAdvanceKdsItem,
  handleRecallKdsTicket,
  handleBumpKdsTicket,
}) => {
  const filteredTickets = kdsTickets.filter((ticket) => {
    if (!kdsShowBumped && ticket.status === 'ready') return false;
    if (kdsChannelFilter === 'all') return true;
    const channel = (ticket.checkType || '').toLowerCase();
    if (kdsChannelFilter === 'dine_in') return channel.includes('dine') || ticket.tableNumber;
    if (kdsChannelFilter === 'takeaway') return channel.includes('takeaway');
    if (kdsChannelFilter === 'delivery') return channel.includes('delivery');
    return true;
  });

  return (
    <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#FAF7F2]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-stone-900">Kitchen Display System (KDS)</h2>
            <span className="bg-[#800D15] text-[#FFC700] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-2xs">
              Live Expediting
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Station preparation queues, elapsed cooking timers, single-touch Bump &amp; Recall
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Channel Filter */}
          <div className="bg-stone-100 p-1 rounded-xl border border-stone-200 flex items-center">
            {['all', 'dine_in', 'takeaway', 'delivery'].map((ch) => (
              <button
                key={ch}
                onClick={() => setKdsChannelFilter(ch)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all capitalize ${
                  kdsChannelFilter === ch
                    ? 'bg-[#800D15] text-[#FFC700] shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {ch.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={() => setKdsShowBumped(!kdsShowBumped)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              kdsShowBumped
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <span>{kdsShowBumped ? '✓ Showing Bumped' : 'Show Bumped'}</span>
          </button>

          <button
            onClick={fetchKds}
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded-xl transition-all"
            title="Refresh Queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-stone-500 shadow-2xs">
          <p className="text-base font-extrabold text-stone-900">Kitchen queue is all caught up!</p>
          <p className="text-xs mt-1">No active tickets waiting in preparation for this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTickets.map((ticket) => {
            const elapsedMinutes = Math.floor(
              (Date.now() - new Date(ticket.openedAt).getTime()) / 60000
            );
            const isLate = elapsedMinutes > 15 && ticket.status !== 'ready';
            const isReady = ticket.status === 'ready';

            return (
              <div
                key={ticket.id}
                className={`rounded-2xl border p-4 flex flex-col justify-between shadow-2xs transition-all ${
                  isReady
                    ? 'bg-emerald-50/90 border-emerald-300'
                    : isLate
                    ? 'bg-red-50/90 border-red-300'
                    : 'bg-white border-stone-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-black text-sm text-[#800D15]">#{ticket.checkNumber}</span>
                      <p className="text-xs font-bold text-stone-900">
                        {ticket.tableNumber || ticket.checkType || 'Order'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          isReady
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isLate
                            ? 'bg-red-600 text-white shadow-2xs'
                            : 'bg-stone-100 text-stone-700 border border-stone-200'
                        }`}
                      >
                        {isReady ? 'READY' : `${elapsedMinutes}m ago`}
                      </span>
                      {ticket.checkType && (
                        <span className="text-[9px] uppercase font-bold text-stone-500">
                          {ticket.checkType}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-stone-200 pt-2">
                    {ticket.items.map((it: any) => (
                      <div
                        key={it.id}
                        onClick={() =>
                          handleAdvanceKdsItem(
                            ticket.id,
                            it.id,
                            it.status === 'ready' ? 'sent_to_kitchen' : 'ready'
                          )
                        }
                        className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer border transition-all ${
                          it.status === 'ready'
                            ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900 line-through'
                            : 'bg-stone-50 border-stone-200 text-stone-900 hover:border-[#800D15]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-[#800D15]">
                            {it.quantity}x
                          </span>
                          <span className="font-bold truncate max-w-[140px]">{it.name}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-stone-500">
                          {it.status === 'ready' ? '✓ Ready' : 'Prep'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-stone-200 space-y-2">
                  <div className="flex justify-between items-center text-[11px] text-stone-500">
                    <span>Server: {ticket.openedByName || 'Counter'}</span>
                    <span className="font-bold text-stone-900">{ticket.items.length} Items</span>
                  </div>

                  <div className="pt-1">
                    {isReady ? (
                      <button
                        onClick={() => handleRecallKdsTicket(ticket.id)}
                        className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-amber-800 border border-stone-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                        <span>Recall to Kitchen</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBumpKdsTicket(ticket.id)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Bump Ticket (All Ready)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
