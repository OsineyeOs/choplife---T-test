import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  Sliders,
  FileText,
  Network,
  CheckCircle2,
  HelpCircle,
  Volume2,
  DollarSign,
  Scissors,
} from 'lucide-react';
import {
  loadHardwarePrinterState,
  saveHardwarePrinterState,
  HardwarePrinterState,
} from '../../utils/hardwarePrinter';
import { PrinterListTab } from './printers/PrinterListTab';
import { ReceiptTemplateEditorTab } from './printers/ReceiptTemplateEditorTab';
import { HardwareDiagnosticsTab } from './printers/HardwareDiagnosticsTab';
import { PrintBridgeGuideModal } from './printers/PrintBridgeGuideModal';

interface HardwarePrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwarePrinterModal: React.FC<HardwarePrinterModalProps> = ({ isOpen, onClose }) => {
  const [printerState, setPrinterState] = useState<HardwarePrinterState>(() => loadHardwarePrinterState());
  const [activeTab, setActiveTab] = useState<'fleet' | 'templates' | 'diagnostics' | 'settings'>('fleet');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPrinterState(loadHardwarePrinterState());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleToggleConfig = (key: keyof typeof printerState.config) => {
    const updated = {
      ...printerState,
      config: {
        ...printerState.config,
        [key]: !printerState.config[key],
      },
    };
    setPrinterState(updated);
    saveHardwarePrinterState(updated);
    showFeedback(`Toggled ${String(key)}: ${updated.config[key] ? 'Enabled' : 'Disabled'}`);
  };

  const handlePaperWidthChange = (width: '80mm' | '58mm') => {
    const updated = {
      ...printerState,
      config: {
        ...printerState.config,
        paperWidth: width,
        lineCharacters: width === '80mm' ? 48 : 32,
      },
    };
    setPrinterState(updated);
    saveHardwarePrinterState(updated);
    showFeedback(`Default roll width set to ${width}`);
  };

  return (
    <div className="fixed inset-0 z-70 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="bg-white text-stone-900 border-2 border-[#E5DEC9] rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-montserrat">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#FAF7F2] border-b border-[#E5DEC9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-titan uppercase border ${
                    printerState.networkPrinters && printerState.networkPrinters.length > 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-900 border-amber-300'
                  }`}
                >
                  {printerState.networkPrinters && printerState.networkPrinters.length > 0
                    ? `${printerState.networkPrinters.length} PRINTERS CONFIGURED`
                    : '0 NETWORK PRINTERS • BROWSER PRINT READY'}
                </span>
                <span className="text-xs text-[#6E5953] font-mono">
                  {printerState.config.paperWidth} Default ESC/POS
                </span>
              </div>
              <h3 className="font-titan text-lg sm:text-xl text-[#4D080F]">
                Choplife Republic Thermal Printers &amp; Peripherals
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="p-2 rounded-xl bg-white hover:bg-[#FAF7F2] border border-[#E5DEC9] text-[#4D080F] transition-colors"
              title="Print Bridge Architecture Guide"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white hover:bg-[#FAF7F2] border border-[#E5DEC9] text-stone-500 hover:text-stone-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-[#FAF7F2] px-4 py-2 border-b border-[#E5DEC9] flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-titan transition-all flex items-center gap-1.5 ${
              activeTab === 'fleet'
                ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                : 'bg-white border border-[#E5DEC9] text-stone-600 hover:text-stone-900'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Printer Fleet & Drivers
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-titan transition-all flex items-center gap-1.5 ${
              activeTab === 'templates'
                ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                : 'bg-white border border-[#E5DEC9] text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Receipt & KOT Templates (6)
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-titan transition-all flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                : 'bg-white border border-[#E5DEC9] text-stone-600 hover:text-stone-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Hardware Tests & Cash Drawer
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-titan transition-all flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                : 'bg-white border border-[#E5DEC9] text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Preferences
          </button>
        </div>

        {/* Feedback Alert Bar */}
        {feedback && (
          <div className="bg-[#FFC700] text-[#4D080F] px-4 py-2 text-xs font-titan flex items-center justify-between shrink-0 shadow-inner">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="font-bold text-sm">
              ✕
            </button>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#FAF7F2]">
          {activeTab === 'fleet' && <PrinterListTab onFeedback={showFeedback} />}

          {activeTab === 'templates' && <ReceiptTemplateEditorTab />}

          {activeTab === 'diagnostics' && <HardwareDiagnosticsTab onFeedback={showFeedback} />}

          {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto space-y-5">
              <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl space-y-4 shadow-xs">
                <h4 className="font-titan text-sm text-stone-900">Default Paper Roll Formatting</h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePaperWidthChange('80mm')}
                    className={`flex-1 p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                      printerState.config.paperWidth === '80mm'
                        ? 'bg-[#4D080F] border-[#4D080F] text-[#FFC700]'
                        : 'bg-[#FAF7F2] border-[#E5DEC9] text-stone-600'
                    }`}
                  >
                    80mm Thermal (48 Cols)
                  </button>
                  <button
                    onClick={() => handlePaperWidthChange('58mm')}
                    className={`flex-1 p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                      printerState.config.paperWidth === '58mm'
                        ? 'bg-[#4D080F] border-[#4D080F] text-[#FFC700]'
                        : 'bg-[#FAF7F2] border-[#E5DEC9] text-stone-600'
                    }`}
                  >
                    58mm Thermal (32 Cols)
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white border border-[#E5DEC9] rounded-2xl space-y-3 shadow-xs">
                <h4 className="font-titan text-sm text-stone-900">POS Automation Rules</h4>

                <label className="flex items-center justify-between p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9] cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Scissors className="w-5 h-5 text-[#4D080F]" />
                    <div>
                      <div className="text-xs font-bold text-stone-900">Auto Paper Cut</div>
                      <div className="text-[11px] text-stone-500">
                        Append ESC/POS cut commands (GS V) automatically
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerState.config.autoCut}
                    onChange={() => handleToggleConfig('autoCut')}
                    className="w-4 h-4 accent-[#4D080F] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9] cursor-pointer">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <div>
                      <div className="text-xs font-bold text-stone-900">Auto Cash Drawer Kick</div>
                      <div className="text-[11px] text-stone-500">
                        Pulse drawer solenoid (Pin 2/5) on Cash tender checkout
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerState.config.autoOpenDrawer}
                    onChange={() => handleToggleConfig('autoOpenDrawer')}
                    className="w-4 h-4 accent-[#4D080F] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9] cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-5 h-5 text-amber-600" />
                    <div>
                      <div className="text-xs font-bold text-stone-900">Kitchen Ticket Buzzer</div>
                      <div className="text-[11px] text-stone-500">
                        Sound hardware buzzer when new KOT is received
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerState.config.soundBuzzer}
                    onChange={() => handleToggleConfig('soundBuzzer')}
                    className="w-4 h-4 accent-[#4D080F] rounded"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      <PrintBridgeGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
