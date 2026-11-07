import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  Wand2,
  Eye,
  ShieldAlert,
  Download,
  Copy,
} from 'lucide-react';

export interface QrCodeConfigEntry {
  id: string;
  branchId: 'gra' | 'okabere' | 'ugbowo';
  branchName: string;
  label: string;
  channel: 'digital_menu' | 'table_order' | 'pickup_counter' | 'feedback';
  tableNumber?: string;
  destinationUrl: string;
  active: boolean;
  scansCount: number;
  updatedAt: string;
  updatedBy?: string;
}

const BRANCH_LABELS: Record<string, string> = {
  gra: 'GRA Flagship Hub',
  okabere: 'Okabere Road Hub',
  ugbowo: 'Ugbowo Campus Hub',
};

/**
 * Generates a deterministic 21x21 QR-style SVG matrix from the destination URL
 * with canonical finder patterns so the visual QR code always reflects the saved URL.
 */
const DeterministicQrSvg: React.FC<{ value: string; size?: number; active?: boolean }> = ({
  value,
  size = 128,
  active = true,
}) => {
  const gridSize = 21;
  const str = value || 'https://chopliferepublic.com';

  // Compute multiple deterministic hashes from the URL string
  const hashes: number[] = [];
  for (let s = 0; s < 16; s++) {
    let h = 2166136261 ^ (s * 16777619);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    hashes.push(h >>> 0);
  }

  const isFinderModule = (r: number, c: number, topR: number, leftC: number) => {
    const dr = r - topR;
    const dc = c - leftC;
    if (dr < 0 || dr > 6 || dc < 0 || dc > 6) return null;
    if (dr === 0 || dr === 6 || dc === 0 || dc === 6) return true;
    if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) return true;
    return false;
  };

  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Quiet zone separators around 3 finder patterns
      if ((r === 7 && c <= 7) || (c === 7 && r <= 7)) continue;
      if ((r === 7 && c >= gridSize - 8) || (c === gridSize - 8 && r <= 7)) continue;
      if ((r === gridSize - 8 && c <= 7) || (c === 7 && r >= gridSize - 8)) continue;

      const f1 = isFinderModule(r, c, 0, 0);
      if (f1 !== null) {
        if (f1) cells.push({ r, c });
        continue;
      }
      const f2 = isFinderModule(r, c, 0, gridSize - 7);
      if (f2 !== null) {
        if (f2) cells.push({ r, c });
        continue;
      }
      const f3 = isFinderModule(r, c, gridSize - 7, 0);
      if (f3 !== null) {
        if (f3) cells.push({ r, c });
        continue;
      }

      // Timing patterns
      if (r === 6) {
        if (c % 2 === 0) cells.push({ r, c });
        continue;
      }
      if (c === 6) {
        if (r % 2 === 0) cells.push({ r, c });
        continue;
      }

      const bitIdx = r * gridSize + c;
      const hashWord = hashes[bitIdx % hashes.length];
      const bit = (hashWord >> ((bitIdx * 7) % 31)) & 1;
      if (bit === 1) {
        cells.push({ r, c });
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${gridSize + 2} ${gridSize + 2}`}
      className={`rounded-xl border border-[#E5DEC9] bg-white p-1.5 ${active ? '' : 'opacity-40 grayscale'}`}
      aria-label={`QR Code for ${str}`}
    >
      <rect width={gridSize + 2} height={gridSize + 2} fill="#FFFFFF" />
      {cells.map(({ r, c }) => (
        <rect
          key={`${r}-${c}`}
          x={c + 1}
          y={r + 1}
          width={0.95}
          height={0.95}
          rx={0.12}
          fill={active ? '#4D080F' : '#78716C'}
        />
      ))}
    </svg>
  );
};

interface QrCodesManagementPanelProps {
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const QrCodesManagementPanel: React.FC<QrCodesManagementPanelProps> = ({
  getAuthHeaders,
  showToast,
}) => {
  const [qrConfigs, setQrConfigs] = useState<QrCodeConfigEntry[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<QrCodeConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [operationalLogs, setOperationalLogs] = useState<any>(null);

  const fetchQrConfigs = async () => {
    try {
      setLoading(true);
      const [qrRes, logsRes] = await Promise.all([
        fetch('/api/settings/qr-codes', { headers: getAuthHeaders() }),
        fetch('/api/settings/operational-logs', { headers: getAuthHeaders() }),
      ]);
      if (qrRes.ok) {
        const data = await qrRes.json();
        const list = Array.isArray(data.configuredQrCodes) ? data.configuredQrCodes : [];
        setQrConfigs(JSON.parse(JSON.stringify(list)));
        setSavedSnapshot(JSON.parse(JSON.stringify(list)));
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setOperationalLogs(logsData);
      }
    } catch {
      showToast('Failed to load QR code configurations.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQrConfigs();
  }, []);

  const updateItem = (id: string, patch: Partial<QrCodeConfigEntry>) => {
    setValidationError(null);
    setQrConfigs((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        if (patch.branchId) {
          next.branchName = BRANCH_LABELS[patch.branchId] || patch.branchId.toUpperCase();
        }
        return next;
      })
    );
  };

  const buildStandardUrl = (item: QrCodeConfigEntry): string => {
    const origin = window.location.origin.includes('localhost')
      ? 'https://chopliferepublic.com'
      : window.location.origin;
    const params = new URLSearchParams();
    params.set('branch', item.branchId);
    if (item.channel === 'digital_menu') {
      params.set('view', 'menu');
      params.set('qr', 'true');
    } else if (item.channel === 'table_order') {
      params.set('view', 'menu');
      if (item.tableNumber && item.tableNumber !== 'All Tables') {
        params.set('table', item.tableNumber);
      }
      params.set('qr', 'true');
    } else if (item.channel === 'pickup_counter') {
      params.set('orderType', 'pickup');
      params.set('view', 'menu');
      params.set('qr', 'true');
    } else {
      params.set('view', 'feedback');
      params.set('qr', 'true');
    }
    return `${origin}/?${params.toString()}`;
  };

  const handleAddQrCode = () => {
    const newItem: QrCodeConfigEntry = {
      id: `qr_gra_${Date.now()}`,
      branchId: 'gra',
      branchName: BRANCH_LABELS.gra,
      label: `GRA Flagship — Table T-${qrConfigs.length + 1} Direct Order`,
      channel: 'table_order',
      tableNumber: `T-${qrConfigs.length + 1}`,
      destinationUrl: `https://chopliferepublic.com/?branch=gra&view=menu&table=T-${qrConfigs.length + 1}&qr=true`,
      active: true,
      scansCount: 0,
      updatedAt: new Date().toISOString(),
    };
    setQrConfigs((prev) => [...prev, newItem]);
  };

  const handleRemoveQrCode = (id: string) => {
    setQrConfigs((prev) => prev.filter((q) => q.id !== id));
  };

  const validateBeforeConfirmation = () => {
    setValidationError(null);
    if (qrConfigs.length === 0) {
      setValidationError('At least one branch QR code configuration must remain active.');
      return;
    }
    for (const q of qrConfigs) {
      if (!q.label || !q.label.trim()) {
        setValidationError('All QR code cards must have a display label.');
        return;
      }
      if (!['gra', 'okabere', 'ugbowo'].includes(q.branchId)) {
        setValidationError(`Invalid branch association "${q.branchId}" on "${q.label}".`);
        return;
      }
      const url = (q.destinationUrl || '').trim();
      if (!url || (!url.startsWith('https://') && !url.startsWith('http://') && !url.startsWith('/'))) {
        setValidationError(
          `Invalid destination URL "${url}" on "${q.label}". URL must start with https://, http://, or /.`
        );
        return;
      }
      if (url.startsWith('http')) {
        try {
          new URL(url);
        } catch {
          setValidationError(`Malformed destination URL "${url}" on "${q.label}".`);
          return;
        }
      }
    }
    setConfirmSaveOpen(true);
  };

  const handleConfirmSave = async () => {
    try {
      setSaving(true);
      setValidationError(null);
      const res = await fetch('/api/settings/qr-codes', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ configuredQrCodes: qrConfigs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || `Failed to save QR code configurations (HTTP ${res.status}).`;
        setValidationError(msg);
        showToast(msg, 'error');
        setConfirmSaveOpen(false);
        return;
      }
      const updated = Array.isArray(data.configuredQrCodes) ? data.configuredQrCodes : qrConfigs;
      setQrConfigs(JSON.parse(JSON.stringify(updated)));
      setSavedSnapshot(JSON.parse(JSON.stringify(updated)));
      setConfirmSaveOpen(false);
      showToast('QR code configurations persisted and regenerated.', 'success');
    } catch {
      showToast('Network error while saving QR code configurations.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = JSON.stringify(qrConfigs) !== JSON.stringify(savedSnapshot);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-[#E5DEC9] shadow-2xs">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm sm:text-base font-black text-[#4D080F]">
              Module J: Editable Dine-In Table QR Codes, Digital Channels &amp; Audit Logs
            </h2>
            {hasUnsavedChanges && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Unsaved Edits
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Configure branch associations, table/channel parameters, and destination URLs. QR codes regenerate automatically to match the saved destination.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAddQrCode}
            className="px-3.5 py-2 rounded-xl border border-[#D8CDBE] bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#4D080F] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add QR Endpoint</span>
          </button>

          <button
            type="button"
            onClick={validateBeforeConfirmation}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Review & Save QR Configs'}</span>
          </button>
        </div>
      </div>

      {validationError && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-stone-500 bg-white rounded-2xl border border-[#E5DEC9]">
          Loading branch QR code configurations...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {qrConfigs.map((item) => (
            <div
              key={item.id}
              className={`bg-white border rounded-2xl p-5 space-y-4 shadow-2xs transition-all ${
                item.active ? 'border-[#E5DEC9]' : 'border-stone-200 bg-stone-50/70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <DeterministicQrSvg value={item.destinationUrl} size={96} active={item.active} />
                  <div className="space-y-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        item.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {item.active ? 'Active QR Endpoint' : 'Inactive / Disabled'}
                    </span>
                    <div className="text-xs font-black text-[#4D080F]">{item.branchName}</div>
                    <div className="text-[11px] text-stone-500">
                      Channel: <strong className="uppercase">{item.channel.replace('_', ' ')}</strong> · Table/Ref:{' '}
                      <strong>{item.tableNumber || 'All Tables'}</strong>
                    </div>
                    {item.updatedBy && (
                      <div className="text-[10px] text-stone-400">
                        Last saved by {item.updatedBy}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={(e) => updateItem(item.id, { active: e.target.checked })}
                      className="rounded border-stone-300 text-[#4D080F]"
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveQrCode(item.id)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
                    title="Remove QR entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#4D080F] mb-1">
                    Display Label / Placard Title
                  </label>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateItem(item.id, { label: e.target.value })}
                    className="w-full p-2 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2] text-xs font-semibold text-[#241311]"
                    placeholder="e.g., GRA Flagship — Main Digital Menu"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#4D080F] mb-1">
                    Branch Association
                  </label>
                  <select
                    value={item.branchId}
                    onChange={(e) =>
                      updateItem(item.id, { branchId: e.target.value as 'gra' | 'okabere' | 'ugbowo' })
                    }
                    className="w-full p-2 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2] text-xs text-[#241311]"
                  >
                    <option value="gra">GRA Flagship Hub (gra)</option>
                    <option value="okabere">Okabere Road Hub (okabere)</option>
                    <option value="ugbowo">Ugbowo Campus Hub (ugbowo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#4D080F] mb-1">
                    Ordering Channel / View
                  </label>
                  <select
                    value={item.channel}
                    onChange={(e) =>
                      updateItem(item.id, {
                        channel: e.target.value as QrCodeConfigEntry['channel'],
                      })
                    }
                    className="w-full p-2 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2] text-xs text-[#241311]"
                  >
                    <option value="digital_menu">Digital Menu View</option>
                    <option value="table_order">Dine-In Table Ordering</option>
                    <option value="pickup_counter">Express Pickup Counter</option>
                    <option value="feedback">Guest Care &amp; Feedback</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#4D080F] mb-1">
                    Table / Counter Association
                  </label>
                  <input
                    type="text"
                    value={item.tableNumber || ''}
                    onChange={(e) => updateItem(item.id, { tableNumber: e.target.value })}
                    placeholder="e.g., VIP-01, T-04, or All Tables"
                    className="w-full p-2 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2] text-xs text-[#241311]"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, { destinationUrl: buildStandardUrl(item) })}
                    className="w-full py-2 px-3 rounded-xl border border-[#D8CDBE] bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#4D080F] text-[11px] font-bold flex items-center justify-center gap-1.5"
                    title="Auto-build URL from Branch, Channel, and Table fields"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Sync URL from Branch &amp; Table</span>
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#4D080F] mb-1">
                    Destination URL / Storefront Route
                  </label>
                  <input
                    type="text"
                    value={item.destinationUrl}
                    onChange={(e) => updateItem(item.id, { destinationUrl: e.target.value })}
                    placeholder="https://chopliferepublic.com/?branch=gra&view=menu&qr=true"
                    className="w-full p-2 rounded-xl border border-[#E5DEC9] bg-[#FAF7F2] text-xs font-mono text-[#241311]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(item.destinationUrl);
                    showToast(`Copied destination URL for ${item.label}`, 'success');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#4D080F] text-[11px] font-bold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy URL</span>
                </button>

                <a
                  href={item.destinationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] text-[11px] font-bold rounded-xl flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Destination Link</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Operational Audit & Webhook Logs Summary */}
      {operationalLogs && (
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-[#4D080F]">
                Recent System Configuration &amp; Operational Audit Trail
              </h3>
              <p className="text-[11px] text-stone-500">
                Total Audit Events: {operationalLogs.stats?.auditLogsCount || 0} · Active Shifts:{' '}
                {operationalLogs.stats?.activeShiftsCount || 0} · Print Jobs:{' '}
                {operationalLogs.stats?.hardwarePrintJobsCount || 0}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchQrConfigs}
              className="p-2 rounded-xl bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#4D080F] border border-[#E5DEC9]"
              title="Refresh QR configs and audit logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-stone-100 text-xs">
            {(operationalLogs.recentAuditLogs || []).slice(0, 8).map((log: any) => (
              <div key={log.id} className="py-2 flex items-start justify-between gap-4">
                <div>
                  <span className="font-bold text-[#4D080F]">{log.actionType}</span> —{' '}
                  <span className="text-stone-700">{log.details}</span>
                </div>
                <div className="text-[10px] text-stone-400 shrink-0">
                  {log.staffName} ({log.branchId}) · {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview & Confirmation Modal before saving consequential QR changes */}
      {confirmSaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-[#FAF7F2] rounded-3xl p-6 max-w-xl w-full border border-[#E5DEC9] shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-[#E5DEC9] pb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#4D080F] text-[#FFC700] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-titan text-base text-[#241311] uppercase">
                  Confirm QR Code Destination Changes
                </h3>
                <p className="text-xs text-[#78665A]">
                  Verify branch bindings and destination URLs before overwriting printed/table QR routing
                </p>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 bg-white p-3 rounded-2xl border border-[#E5DEC9] text-xs">
              {qrConfigs.map((q) => (
                <div key={q.id} className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex items-center gap-3">
                  <DeterministicQrSvg value={q.destinationUrl} size={48} active={q.active} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[#241311] truncate">
                      {q.label} ({q.branchId.toUpperCase()} · {q.tableNumber || 'All'})
                    </div>
                    <div className="text-[10px] font-mono text-stone-600 truncate">{q.destinationUrl}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      q.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {q.active ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSaveOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#D8CDBE] bg-white text-[#241311] text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] text-xs font-bold flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{saving ? 'Persisting...' : 'Confirm & Publish QR Codes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
