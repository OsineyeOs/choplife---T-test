import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  subscribeToOfflineStatus,
  syncOfflineQueueNow,
  clearOfflineQueue,
  OfflineManagerStatus,
} from '../../utils/offlineManager';

interface OfflineSyncBarProps {
  onSyncComplete?: (count: number) => void;
  compact?: boolean;
}

export const OfflineSyncBar: React.FC<OfflineSyncBarProps> = ({ onSyncComplete, compact = false }) => {
  const [status, setStatus] = useState<OfflineManagerStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    queuedCount: 0,
    lastSyncTimestamp: null,
    isSyncing: false,
  });
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToOfflineStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const handleManualSync = async () => {
    const res = await syncOfflineQueueNow();
    if (res.success && res.syncedCount > 0) {
      setSyncFeedback(`Synced ${res.syncedCount} offline transaction(s)!`);
      if (onSyncComplete) onSyncComplete(res.syncedCount);
    } else if (res.success && res.syncedCount === 0) {
      setSyncFeedback('All offline records are up to date.');
    } else {
      setSyncFeedback('Sync failed. Will retry automatically.');
    }
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all ${
            status.isOnline
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-800 border border-amber-300 animate-pulse'
          }`}
          title={status.isOnline ? 'Online - Live Cloud Sync' : 'Offline - Caching to Local Storage'}
        >
          {status.isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-amber-600" />}
          <span>{status.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          {status.queuedCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-extrabold">
              {status.queuedCount}
            </span>
          )}
        </div>

        {status.queuedCount > 0 && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={status.isSyncing || !status.isOnline}
            className="px-2.5 py-1 rounded-lg bg-[#FFC700] hover:bg-[#e6b400] text-[#4D080F] text-xs font-titan flex items-center gap-1 transition-all disabled:opacity-50"
            title="Sync Queued Transactions to Central Database"
          >
            <RefreshCw className={`w-3 h-3 ${status.isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        )}
      </div>
    );
  }

  // When online with no queued offline records, do not consume vertical height with a large banner
  if (status.isOnline && status.queuedCount === 0 && !status.isSyncing && !syncFeedback) {
    return null;
  }

  return (
    <div
      className={`mx-3 my-1.5 p-2.5 rounded-xl border transition-all shrink-0 ${
        status.isOnline
          ? status.queuedCount > 0
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-white border-[#E5DEC9] text-stone-700 shadow-xs'
          : 'bg-amber-50 border-amber-400 text-amber-900 animate-pulse'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              status.isOnline
                ? status.queuedCount > 0
                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {status.isOnline ? (
              status.queuedCount > 0 ? (
                <Layers className="w-4 h-4 text-amber-600" />
              ) : (
                <Wifi className="w-4 h-4 text-emerald-600" />
              )
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-titan text-xs text-stone-900">
                {status.isOnline
                  ? status.queuedCount > 0
                    ? 'Online With Queued Offline Sales'
                    : 'Cloud Connected - Real-time Sync Active'
                  : 'Port Harcourt Branch Offline Mode Engaged'}
              </span>
              <span
                className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-bold uppercase ${
                  status.isOnline
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-500 text-black font-extrabold'
                }`}
              >
                {status.isOnline ? 'Online' : 'Offline Mode'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-montserrat">
              {status.isOnline
                ? status.queuedCount > 0
                  ? `${status.queuedCount} order(s) cached locally awaiting reconciliation.`
                  : 'All transactions are instantly persisted to central server.'
                : 'POS orders, cash tenders, and thermal receipts continue uninterrupted with zero downtime.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {syncFeedback && (
            <span className="text-xs text-amber-700 font-bold font-montserrat animate-in fade-in">
              {syncFeedback}
            </span>
          )}

          {status.queuedCount > 0 && (
            <>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={status.isSyncing || !status.isOnline}
                className="px-3 py-1.5 rounded-xl bg-[#FFC700] hover:bg-[#e6b400] text-[#4D080F] text-xs font-titan flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${status.isSyncing ? 'animate-spin' : ''}`} />
                <span>{status.isSyncing ? 'Syncing...' : `Sync Now (${status.queuedCount})`}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Clear offline queue? Warning: unsynced offline records will be discarded.')) {
                    clearOfflineQueue();
                  }
                }}
                className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all"
                title="Discard Offline Queue"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
