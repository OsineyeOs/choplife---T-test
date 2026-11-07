/**
 * ChopLife POS Offline Synchronization & Resilient Queue Manager
 * Ensures cashiers in Benin City can take orders, process cash tenders,
 * and print receipts even with intermittent or zero internet connectivity.
 */

export interface OfflineAction {
  id: string;
  action: 'CREATE_CHECK' | 'UPDATE_CHECK' | 'PAY_CHECK' | 'CASH_MOVEMENT' | 'CREATE_ORDER';
  payload: any;
  createdAt: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
}

export interface OfflineManagerStatus {
  isOnline: boolean;
  queuedCount: number;
  lastSyncTimestamp: string | null;
  isSyncing: boolean;
}

const STORAGE_KEY = 'choplife_offline_pos_queue';
const LAST_SYNC_KEY = 'choplife_last_offline_sync';

type Listener = (status: OfflineManagerStatus) => void;
const listeners: Set<Listener> = new Set();

let isSyncingInProgress = false;

// Determine initial online state
let currentOnlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;

function notifyListeners() {
  const status: OfflineManagerStatus = {
    isOnline: currentOnlineStatus,
    queuedCount: getOfflineQueue().filter((a) => a.status === 'pending' || a.status === 'failed').length,
    lastSyncTimestamp: localStorage.getItem(LAST_SYNC_KEY),
    isSyncing: isSyncingInProgress,
  };
  listeners.forEach((fn) => fn(status));
}

// Window event listeners for network changes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    currentOnlineStatus = true;
    notifyListeners();
    // Auto sync when connection is restored
    syncOfflineQueueNow();
  });

  window.addEventListener('offline', () => {
    currentOnlineStatus = false;
    notifyListeners();
  });
}

/**
 * Retrieves all items currently stored in the offline queue
 */
export function getOfflineQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('[OFFLINE] Failed to read offline queue:', err);
    return [];
  }
}

/**
 * Saves queue back to local storage
 */
function saveOfflineQueue(queue: OfflineAction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    notifyListeners();
  } catch (err) {
    console.error('[OFFLINE] Failed to persist offline queue:', err);
  }
}

/**
 * Adds an action to the offline queue
 */
export function enqueueOfflineAction(
  action: OfflineAction['action'],
  payload: any
): OfflineAction {
  const newAction: OfflineAction = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };

  const current = getOfflineQueue();
  current.push(newAction);
  saveOfflineQueue(current);
  return newAction;
}

/**
 * Removes an action from the queue by ID
 */
export function removeOfflineAction(id: string) {
  const current = getOfflineQueue().filter((a) => a.id !== id);
  saveOfflineQueue(current);
}

/**
 * Generates an offline fallback Check / Order identifier
 */
export function generateOfflineReference(prefix: string = 'CL-OFF'): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${rand}`;
}

/**
 * Synchronizes the offline queue with the backend server
 */
export async function syncOfflineQueueNow(): Promise<{
  success: boolean;
  syncedCount: number;
  failedCount: number;
  results: any[];
}> {
  if (isSyncingInProgress) {
    return { success: false, syncedCount: 0, failedCount: 0, results: [] };
  }

  const queue = getOfflineQueue();
  const pendingItems = queue.filter((a) => a.status === 'pending' || a.status === 'failed');

  if (pendingItems.length === 0) {
    return { success: true, syncedCount: 0, failedCount: 0, results: [] };
  }

  isSyncingInProgress = true;
  notifyListeners();

  try {
    const token = localStorage.getItem('choplife_staff_token') || '';
    const res = await fetch('/api/pos/sync-offline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: pendingItems }),
    });

    if (res.ok) {
      const data = await res.json();
      const updatedQueue = queue.filter(
        (action) => !data.syncedIds.includes(action.id)
      );
      saveOfflineQueue(updatedQueue);
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      return {
        success: true,
        syncedCount: data.syncedIds.length,
        failedCount: data.failedIds?.length || 0,
        results: data.results || [],
      };
    } else {
      // Mark retry on items
      const updatedQueue = queue.map((action) => {
        if (pendingItems.some((p) => p.id === action.id)) {
          return {
            ...action,
            retryCount: action.retryCount + 1,
            status: 'failed' as const,
            error: 'Server responded with error',
          };
        }
        return action;
      });
      saveOfflineQueue(updatedQueue);
      return { success: false, syncedCount: 0, failedCount: pendingItems.length, results: [] };
    }
  } catch (err: any) {
    console.error('[OFFLINE SYNC] Network error during sync:', err);
    return { success: false, syncedCount: 0, failedCount: pendingItems.length, results: [] };
  } finally {
    isSyncingInProgress = false;
    notifyListeners();
  }
}

/**
 * Clears all pending offline actions
 */
export function clearOfflineQueue() {
  saveOfflineQueue([]);
}

/**
 * Subscribe to offline status changes (online/offline, queue count, sync state)
 */
export function subscribeToOfflineStatus(listener: Listener): () => void {
  listeners.add(listener);
  // Initial fire
  listener({
    isOnline: currentOnlineStatus,
    queuedCount: getOfflineQueue().filter((a) => a.status === 'pending' || a.status === 'failed').length,
    lastSyncTimestamp: localStorage.getItem(LAST_SYNC_KEY),
    isSyncing: isSyncingInProgress,
  });

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Proactively unregisters broken or stale Service Workers and clears stale caches
 */
export function cleanupStaleServiceWorkers(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  const promises: Promise<any>[] = [];

  if ('serviceWorker' in navigator) {
    promises.push(
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        return Promise.all(
          registrations.map((reg) => {
            console.log('[PWA] Unregistering service worker scope:', reg.scope);
            return reg.unregister();
          })
        );
      }).catch((e) => console.warn('[PWA] Error unregistering service workers:', e))
    );
  }

  if ('caches' in window) {
    promises.push(
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key.includes('choplife') || key.includes('v1') || key.includes('pos')) {
              console.log('[PWA] Purging stale cache:', key);
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        );
      }).catch((e) => console.warn('[PWA] Error purging caches:', e))
    );
  }

  return Promise.all(promises).then(() => undefined);
}

/**
 * Register the Service Worker in the browser safely (disabled in dev / preview to prevent stale asset poisoning)
 */
export function registerChoplifeServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // In AI Studio preview or Vite development environment, purge stale service workers
  // to avoid serving outdated bundles or blank screens
  const isDevOrPreview =
    window.location.hostname.includes('run.app') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port === '3000';

  if (isDevOrPreview) {
    cleanupStaleServiceWorkers();
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] ServiceWorker registration failed:', err);
      });
  });
}
