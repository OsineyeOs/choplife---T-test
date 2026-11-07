import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Flame,
  Volume2,
  Printer,
  Code,
  Zap,
  Activity,
  Wine,
} from 'lucide-react';
import {
  kickCashDrawerPeripheral,
  printThermalHtml,
  getCachedReceiptTemplate,
} from '../../../utils/hardwarePrinter';
import {
  renderReceiptHtml,
  generateSampleReceiptData,
  ReceiptDocumentType,
} from '../../../utils/receiptRenderer';

interface HardwareDiagnosticsTabProps {
  onFeedback: (msg: string) => void;
}

export const HardwareDiagnosticsTab: React.FC<HardwareDiagnosticsTabProps> = ({ onFeedback }) => {
  const [activePulse, setActivePulse] = useState<boolean>(false);
  const [logEntries, setLogEntries] = useState<Array<{ time: string; action: string; status: string }>>([]);

  const addLog = (action: string, status: string) => {
    const time = new Date().toLocaleTimeString('en-GB');
    setLogEntries((prev) => [{ time, action, status }, ...prev.slice(0, 9)]);
    onFeedback(`${action}: ${status}`);
  };

  const handleTestDocument = async (docType: ReceiptDocumentType, label: string) => {
    try {
      const sample = generateSampleReceiptData(docType);
      const savedTemplate = getCachedReceiptTemplate(docType);
      const paperWidth = savedTemplate?.paperWidth || '80mm';
      const html = renderReceiptHtml({
        documentType: docType,
        order: sample,
        template: savedTemplate,
        paperWidth,
      });
      await printThermalHtml(html, paperWidth);
      addLog(`Test ${label}`, 'Dispatched to Browser Print Dialog (TEST RECEIPT — NOT A SALE)');
    } catch (err: any) {
      addLog(`Test ${label}`, `Failed: ${err.message}`);
    }
  };

  const handleDrawerKick = async () => {
    try {
      setActivePulse(true);
      await kickCashDrawerPeripheral();
      const token = localStorage.getItem('choplife_staff_token');
      fetch('/api/pos/printers/kick-drawer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Hardware Diagnostics Test' }),
      }).catch(() => {});
      addLog('Cash Drawer Kick', 'Dispatched pulse command on Pin 2/5 (RJ11)');
      setTimeout(() => setActivePulse(false), 800);
    } catch (err: any) {
      addLog('Cash Drawer Kick', `Failed: ${err.message}`);
      setActivePulse(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Test Print Grid */}
      <div>
        <h4 className="font-titan text-sm text-[#4D080F] mb-1">Self-Test Diagnostic Documents</h4>
        <p className="text-xs text-[#6E5953] mb-3">
          Dispatch test tickets formatted with authentic Benin City branch details to verify alignment and fonts.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleTestDocument('customer_receipt', 'Customer Receipt')}
            className="p-3 rounded-xl bg-white border border-[#E5DEC9] hover:border-[#4D080F] hover:shadow-md text-left transition-all group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-5 h-5 text-[#4D080F]" />
              <span className="text-[10px] font-mono text-[#6E5953] bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E5DEC9]">80mm</span>
            </div>
            <div className="font-titan text-xs text-[#4D080F] group-hover:text-[#800D15]">
              Customer Receipt
            </div>
            <div className="text-[10px] text-[#6E5953] mt-0.5">Itemized VAT + Payment</div>
          </button>

          <button
            onClick={() => handleTestDocument('kitchen_kot', 'Kitchen KOT')}
            className="p-3 rounded-xl bg-white border border-[#E5DEC9] hover:border-[#4D080F] hover:shadow-md text-left transition-all group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <Printer className="w-5 h-5 text-amber-600" />
              <span className="text-[10px] font-mono text-[#6E5953] bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E5DEC9]">80mm</span>
            </div>
            <div className="font-titan text-xs text-[#4D080F] group-hover:text-[#800D15]">
              Kitchen Food KOT
            </div>
            <div className="text-[10px] text-[#6E5953] mt-0.5">Expediter & Line Cooks</div>
          </button>

          <button
            onClick={() => handleTestDocument('grill_kot', 'Grill Ticket')}
            className="p-3 rounded-xl bg-white border border-[#E5DEC9] hover:border-[#4D080F] hover:shadow-md text-left transition-all group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <Flame className="w-5 h-5 text-[#E62E00]" />
              <span className="text-[10px] font-mono text-[#6E5953] bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E5DEC9]">80mm</span>
            </div>
            <div className="font-titan text-xs text-[#4D080F] group-hover:text-[#800D15]">
              Grill & Suya Ticket
            </div>
            <div className="text-[10px] text-[#6E5953] mt-0.5">Flame BBQ Station</div>
          </button>

          <button
            onClick={() => handleTestDocument('bar_kot', 'Bar Slip')}
            className="p-3 rounded-xl bg-white border border-[#E5DEC9] hover:border-[#4D080F] hover:shadow-md text-left transition-all group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <Wine className="w-5 h-5 text-purple-700" />
              <span className="text-[10px] font-mono text-[#6E5953] bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E5DEC9]">80mm</span>
            </div>
            <div className="font-titan text-xs text-[#4D080F] group-hover:text-[#800D15]">
              Bar & Drinks Chit
            </div>
            <div className="text-[10px] text-[#6E5953] mt-0.5">Cocktails & Mocktails</div>
          </button>

          <button
            onClick={() => handleTestDocument('bill_check', 'Bill Check')}
            className="p-3 rounded-xl bg-white border border-[#E5DEC9] hover:border-[#4D080F] hover:shadow-md text-left transition-all group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-emerald-700" />
              <span className="text-[10px] font-mono text-[#6E5953] bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E5DEC9]">80mm</span>
            </div>
            <div className="font-titan text-xs text-[#4D080F] group-hover:text-[#800D15]">
              Pro-forma Bill Check
            </div>
            <div className="text-[10px] text-[#6E5953] mt-0.5">Table Guest Pre-bill</div>
          </button>

          <button
            onClick={() => handleTestDocument('shift_z_report', 'Shift Z-Report')}
            className="p-3 rounded-xl bg-white border border-[#E5DEC9] hover:border-[#4D080F] hover:shadow-md text-left transition-all group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <span className="text-[10px] font-mono text-[#6E5953] bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E5DEC9]">80mm</span>
            </div>
            <div className="font-titan text-xs text-[#4D080F] group-hover:text-[#800D15]">
              Shift Z-Report
            </div>
            <div className="text-[10px] text-[#6E5953] mt-0.5">Financial Reconciliation</div>
          </button>
        </div>
      </div>

      {/* Cash Drawer Pulse & Hardware Diagnostics */}
      <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-700" />
            <h4 className="font-titan text-sm text-[#4D080F]">RJ11 / RJ12 Cash Drawer Peripheral</h4>
          </div>
          <p className="text-xs text-[#6E5953] mt-1">
            Sends an electric solenoid pulse (<code className="bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E5DEC9] font-mono text-emerald-800 font-bold">DLE DC4 1 1 1</code>) through the thermal printer's DK port.
          </p>
        </div>

        <button
          onClick={handleDrawerKick}
          className={`px-5 py-2.5 rounded-xl font-titan text-xs flex items-center gap-2 transition-all shadow-xs ${
            activePulse
              ? 'bg-emerald-500 text-white scale-105 shadow-emerald-500/50'
              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-[#FFC700]" />
          {activePulse ? 'KICK PULSE ACTIVE!' : 'Kick Cash Drawer (Pin 2/5)'}
        </button>
      </div>

      {/* ESC/POS Command Matrix */}
      <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-[#4D080F]" />
          <h4 className="font-titan text-xs text-[#4D080F]">Authoritative ESC/POS Command Bytecodes</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9]">
            <span className="text-[#6E5953] block text-[10px]">Init Printer:</span>
            <span className="text-emerald-800 font-bold">1B 40 (ESC @)</span>
          </div>
          <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9]">
            <span className="text-[#6E5953] block text-[10px]">Drawer Kick:</span>
            <span className="text-emerald-800 font-bold">10 14 01 01 01</span>
          </div>
          <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9]">
            <span className="text-[#6E5953] block text-[10px]">Partial Cut:</span>
            <span className="text-emerald-800 font-bold">1D 56 42 00 (GS V)</span>
          </div>
          <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9]">
            <span className="text-[#6E5953] block text-[10px]">Buzzer Alert:</span>
            <span className="text-emerald-800 font-bold">1B 42 03 02</span>
          </div>
        </div>
      </div>

      {/* Live Activity Log */}
      {logEntries.length > 0 && (
        <div className="p-3 bg-white border border-[#E5DEC9] rounded-xl space-y-1 shadow-2xs">
          <div className="text-[10px] font-titan text-[#4D080F] uppercase tracking-wider mb-1">
            Session Diagnostic Log
          </div>
          {logEntries.map((entry, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs font-mono py-0.5">
              <span className="text-[#6E5953]">[{entry.time}] {entry.action}</span>
              <span className="text-emerald-700 font-bold">{entry.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
