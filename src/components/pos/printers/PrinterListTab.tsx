import React, { useState, useEffect } from 'react';
import {
  Network,
  Plus,
  RefreshCw,
  Usb,
  Radio,
  CheckCircle2,
  AlertCircle,
  Scissors,
  DollarSign,
  Volume2,
  Trash2,
  Edit2,
  Code,
  HelpCircle,
  Wifi,
  Power,
  Lock,
} from 'lucide-react';
import { DbPrinterProfile } from '../../../../server_db';
import { PrinterFormModal } from './PrinterFormModal';
import { PrintBridgeGuideModal } from './PrintBridgeGuideModal';
import {
  connectSerialPrinter,
  connectUsbPrinter,
  pingNetworkPrinter,
  sendRawEscPosOverNetwork,
  bytesToHex,
  loadHardwarePrinterState,
  HardwarePrinterState,
} from '../../../utils/hardwarePrinter';
import { buildTestPageEscPos } from '../../../utils/escpos';
import { useApp } from '../../../context/AppContext';

interface PrinterListTabProps {
  onFeedback: (msg: string) => void;
}

function getAuthHeaders(includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    const token = localStorage.getItem('choplife_staff_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore storage errors
  }
  return headers;
}

export const PrinterListTab: React.FC<PrinterListTabProps> = ({ onFeedback }) => {
  const { currentStaff } = useApp();
  const [printers, setPrinters] = useState<DbPrinterProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [editingPrinter, setEditingPrinter] = useState<DbPrinterProfile | null>(null);
  const [hexModal, setHexModal] = useState<{ name: string; hex: string } | null>(null);
  const [pingStates, setPingStates] = useState<{
    [id: string]: { status: 'checking' | 'online' | 'offline'; latencyMs?: number; message?: string };
  }>({});

  const [hardwareState, setHardwareState] = useState<HardwarePrinterState>(loadHardwarePrinterState());
  const hasWebUsb = typeof navigator !== 'undefined' && 'usb' in navigator;
  const hasWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

  const staffPrivileges: string[] = (currentStaff as any)?.privileges || [];
  const isSuperOrAdmin =
    currentStaff?.role === 'super_admin' ||
    currentStaff?.role === 'admin' ||
    currentStaff?.role === 'corporate_admin' ||
    currentStaff?.role === 'branch_manager';
  const canManagePrinters = isSuperOrAdmin || staffPrivileges.includes('hardware.printers.manage');
  const canTestPrinters = isSuperOrAdmin || staffPrivileges.includes('hardware.printers.test') || canManagePrinters;

  useEffect(() => {
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/pos/printers', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.printers) ? data.printers : [];
        setPrinters(list);
      } else {
        const errData = await res.json().catch(() => ({}));
        onFeedback(errData.error || 'Could not load printer list from server');
      }
    } catch (err: any) {
      console.error('Failed to fetch printers:', err);
      onFeedback('Could not load printer list from server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEnabled = async (printer: DbPrinterProfile) => {
    if (!canManagePrinters) {
      onFeedback('Insufficient permissions: hardware.printers.manage required');
      return;
    }
    try {
      const res = await fetch(`/api/pos/printers/${printer.id}/toggle`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const updated = data.printer || data;
        setPrinters((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        onFeedback(`${updated.name} is now ${updated.enabled ? 'Active' : 'Disabled'}`);
      } else {
        onFeedback(data.error || 'Failed to toggle printer');
      }
    } catch (err: any) {
      onFeedback('Failed to toggle printer');
    }
  };

  const handleDeletePrinter = async (id: string, name: string) => {
    if (!canManagePrinters) {
      onFeedback('Insufficient permissions: hardware.printers.manage required');
      return;
    }
    try {
      const res = await fetch(`/api/pos/printers/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPrinters((prev) => prev.filter((p) => p.id !== id));
        onFeedback(`Removed printer ${name}`);
      } else {
        onFeedback(data.error || 'Failed to remove printer');
      }
    } catch (err: any) {
      onFeedback('Failed to remove printer');
    }
  };

  const handleSavePrinter = async (printerData: Partial<DbPrinterProfile>) => {
    if (!canManagePrinters) {
      throw new Error('Insufficient permissions: hardware.printers.manage required');
    }
    if (printerData.id) {
      const res = await fetch(`/api/pos/printers/${printerData.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify(printerData),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const updated = data.printer || data;
        setPrinters((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        onFeedback(`Updated ${updated.name}`);
      } else {
        throw new Error(data.error || 'Failed to update printer');
      }
    } else {
      const res = await fetch('/api/pos/printers', {
        method: 'POST',
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify(printerData),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const created = data.printer || data;
        setPrinters((prev) => [...prev, created]);
        onFeedback(`Registered new printer: ${created.name}`);
      } else {
        throw new Error(data.error || 'Failed to register printer');
      }
    }
  };

  const handlePing = async (printer: DbPrinterProfile) => {
    if (!canTestPrinters) {
      onFeedback('Insufficient permissions: hardware.printers.test required');
      return;
    }
    setPingStates((prev) => ({
      ...prev,
      [printer.id]: { status: 'checking' },
    }));

    const res = await pingNetworkPrinter(printer.ip, printer.port);
    setPingStates((prev) => ({
      ...prev,
      [printer.id]: {
        status: res.online ? 'online' : 'offline',
        latencyMs: res.latencyMs,
        message: res.message,
      },
    }));
    onFeedback(`${printer.name}: ${res.message}`);
  };

  const handleDirectTestPrint = async (printer: DbPrinterProfile) => {
    if (!canTestPrinters) {
      onFeedback('Insufficient permissions: hardware.printers.test required');
      return;
    }
    onFeedback(`Streaming ESC/POS packet to ${printer.ip}:${printer.port}...`);
    const testBytes = buildTestPageEscPos({
      ...hardwareState.config,
      paperWidth: printer.paperWidth,
    });
    const res = await sendRawEscPosOverNetwork(
      testBytes,
      printer.ip,
      printer.port,
      printer.name,
      printer.paperWidth
    );
    onFeedback(res.message);
  };

  const handleInspectHex = (printer: DbPrinterProfile) => {
    const testBytes = buildTestPageEscPos({
      ...hardwareState.config,
      paperWidth: printer.paperWidth,
    });
    const hex = bytesToHex(testBytes);
    const formatted =
      hex.match(/.{1,2}/g)?.reduce((acc, byte, idx) => {
        return acc + byte + ((idx + 1) % 16 === 0 ? '\n' : ' ');
      }, '') || hex;

    setHexModal({
      name: printer.name,
      hex: formatted,
    });
  };

  const handleConnectUsb = async () => {
    const res = await connectUsbPrinter();
    if (res.success) {
      setHardwareState(loadHardwarePrinterState());
      onFeedback(`Connected via WebUSB: ${res.deviceName}`);
    } else {
      onFeedback(`WebUSB: ${res.error}`);
    }
  };

  const handleConnectSerial = async () => {
    const res = await connectSerialPrinter();
    if (res.success) {
      setHardwareState(loadHardwarePrinterState());
      onFeedback(`Connected via WebSerial: ${res.deviceName}`);
    } else {
      onFeedback(`WebSerial: ${res.error}`);
    }
  };

  return (
    <div className="space-y-4">
      {!canManagePrinters && (
        <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl flex items-center gap-2.5 text-amber-200 text-xs">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>View-Only Printer Fleet Mode:</strong> Your role does not include{' '}
            <code className="text-amber-300 font-mono">hardware.printers.manage</code>. Contact a Superadmin or Branch Manager to add, modify, or remove printer profiles.
          </span>
        </div>
      )}

      {/* Top Banner: Local Drivers & Direct Peripheral Connections */}
      <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-titan text-sm text-[#4D080F]">Direct Terminal Peripherals</h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
              Active Driver: {hardwareState.connectionType.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-[#6E5953] mt-0.5">
            Connect local desktop thermal printers via USB cable or Serial COM port.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleConnectUsb}
            disabled={!hasWebUsb}
            title={hasWebUsb ? 'Connect USB printer' : 'WebUSB requires Chrome or Edge'}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF7F2] disabled:opacity-40 text-[#241311] border border-[#E5DEC9] text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Usb className="w-3.5 h-3.5 text-[#4D080F]" />
            WebUSB {hasWebUsb ? 'Ready' : '(No API)'}
          </button>

          <button
            onClick={handleConnectSerial}
            disabled={!hasWebSerial}
            title={hasWebSerial ? 'Connect RS232 Serial printer' : 'WebSerial requires Chrome or Edge'}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF7F2] disabled:opacity-40 text-[#241311] border border-[#E5DEC9] text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Radio className="w-3.5 h-3.5 text-[#4D080F]" />
            WebSerial {hasWebSerial ? 'Ready' : '(No API)'}
          </button>

          <button
            onClick={() => setIsGuideOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#EFEAE0] text-[#4D080F] border border-[#E5DEC9] text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Architecture Guide
          </button>
        </div>
      </div>

      {/* Fleet List Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-titan text-sm text-[#4D080F]">Configured Thermal Printer Fleet</h4>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FAF7F2] text-[#4D080F] border border-[#E5DEC9]">
            {printers.length} Registered
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPrinters}
            className="p-1.5 rounded-xl bg-white hover:bg-stone-100 text-[#6E5953] hover:text-[#241311] border border-[#E5DEC9] transition-colors"
            title="Refresh fleet"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {canManagePrinters && (
            <button
              onClick={() => {
                setEditingPrinter(null);
                setIsFormOpen(true);
              }}
              id="add-printer-profile-btn"
              className="px-3.5 py-1.5 rounded-xl bg-[#4D080F] hover:bg-[#38060B] text-[#FFC700] text-xs font-titan flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Printer Profile
            </button>
          )}
        </div>
      </div>

      {/* Printer Fleet Cards */}
      {isLoading ? (
        <div className="p-8 text-center text-[#6E5953] text-xs">Loading printer fleet...</div>
      ) : printers.length === 0 ? (
        <div className="p-8 text-center bg-white border-2 border-dashed border-[#E5DEC9] rounded-2xl shadow-2xs">
          <Network className="w-8 h-8 text-[#4D080F]/40 mx-auto mb-2" />
          <p className="text-sm font-titan text-[#4D080F]">No Network Printers Registered</p>
          <p className="text-xs text-[#6E5953] max-w-sm mx-auto mt-1 mb-4">
            Register your branch POS thermal printers, Kitchen KOT ticket stations, or Suya Grill slips.
          </p>
          {canManagePrinters && (
            <button
              onClick={() => {
                setEditingPrinter(null);
                setIsFormOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] text-xs font-titan inline-flex items-center gap-2 shadow-xs hover:bg-[#38060B]"
            >
              <Plus className="w-4 h-4" />
              Register First Printer
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {printers.map((printer) => {
            const ping = pingStates[printer.id];
            return (
              <div
                key={printer.id}
                className={`p-4 rounded-2xl border transition-all ${
                  printer.enabled
                    ? 'bg-white border-[#E5DEC9] hover:border-[#4D080F] shadow-2xs'
                    : 'bg-[#FAF7F2] border-stone-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-titan text-sm text-[#4D080F]">{printer.name}</h5>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FAF7F2] text-[#4D080F] border border-[#E5DEC9]">
                        {printer.paperWidth}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-[#6E5953] mt-1">
                      {printer.ip}:{printer.port} • <span className="uppercase">{printer.role.replace('_', ' ')}</span>
                    </div>
                  </div>

                  {canManagePrinters && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleEnabled(printer)}
                        title={printer.enabled ? 'Disable printer' : 'Enable printer'}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                          printer.enabled
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingPrinter(printer);
                          setIsFormOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-[#FAF7F2] hover:bg-stone-200 text-[#4D080F] border border-[#E5DEC9]"
                        title="Edit configuration"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePrinter(printer.id, printer.name)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                        title="Delete profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Hardware flags */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#E5DEC9] text-[11px] text-[#6E5953]">
                  {printer.autoCut && (
                    <span className="flex items-center gap-1" title="Auto-cutter enabled">
                      <Scissors className="w-3 h-3 text-[#FFC700]" /> Auto-cut
                    </span>
                  )}
                  {printer.kickDrawer && (
                    <span className="flex items-center gap-1" title="Cash drawer kick enabled">
                      <DollarSign className="w-3 h-3 text-emerald-400" /> Cash Drawer
                    </span>
                  )}
                  {printer.soundBuzzer && (
                    <span className="flex items-center gap-1" title="Kitchen buzzer alert enabled">
                      <Volume2 className="w-3 h-3 text-amber-400" /> Buzzer
                    </span>
                  )}
                </div>

                {/* Ping result status */}
                {ping && (
                  <div
                    className={`mt-2 p-2 rounded-lg text-[11px] font-mono flex items-center justify-between ${
                      ping.status === 'checking'
                        ? 'bg-stone-800 text-stone-300'
                        : ping.status === 'online'
                        ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                        : 'bg-red-950/70 border border-red-500/40 text-red-300'
                    }`}
                  >
                    <span>
                      {ping.status === 'checking'
                        ? 'Pinging raw TCP port...'
                        : ping.status === 'online'
                        ? `TCP Port Reachable (${ping.latencyMs}ms)`
                        : 'Offline / Unreachable'}
                    </span>
                    <span className="text-[10px] opacity-80">{ping.message}</span>
                  </div>
                )}

                {/* Actions Bar */}
                <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-stone-800/60">
                  <button
                    onClick={() => handleInspectHex(printer)}
                    className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white text-[11px] font-mono flex items-center gap-1"
                  >
                    <Code className="w-3 h-3" />
                    ESC/POS Hex
                  </button>
                  <button
                    onClick={() => handlePing(printer)}
                    disabled={!canTestPrinters}
                    className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-[#FFC700] text-[11px] font-bold flex items-center gap-1"
                  >
                    <Wifi className="w-3 h-3" />
                    Ping LAN
                  </button>
                  <button
                    onClick={() => handleDirectTestPrint(printer)}
                    disabled={!canTestPrinters}
                    className="px-3 py-1 rounded bg-[#FFC700]/20 hover:bg-[#FFC700]/30 disabled:opacity-40 border border-[#FFC700]/40 text-[#FFC700] text-[11px] font-bold flex items-center gap-1"
                  >
                    Direct Test
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hex Dump Modal */}
      {hexModal && (
        <div className="fixed inset-0 z-90 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C1211] text-[#FAF7F2] border-2 border-[#FFC700] rounded-2xl w-full max-w-xl p-5 shadow-2xl font-montserrat">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-[#FFC700]" />
                <h4 className="font-titan text-base text-white">ESC/POS Raw Command Stream</h4>
              </div>
              <button
                onClick={() => setHexModal(null)}
                className="p-1 rounded bg-stone-800 text-stone-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-stone-400 mb-2">
              Binary byte stream generated for <span className="text-white font-bold">{hexModal.name}</span>.
            </p>
            <pre className="p-3 bg-black rounded-lg text-emerald-400 font-mono text-[11px] max-h-64 overflow-y-auto leading-relaxed border border-stone-800">
              {hexModal.hex}
            </pre>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setHexModal(null)}
                className="px-4 py-1.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <PrinterFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingPrinter(null);
        }}
        onSave={handleSavePrinter}
        initialPrinter={editingPrinter}
      />

      <PrintBridgeGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
