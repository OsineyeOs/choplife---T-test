import React from 'react';
import { X, Network, Terminal, ShieldAlert, Cpu, CheckCircle2, Copy } from 'lucide-react';

interface PrintBridgeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrintBridgeGuideModal: React.FC<PrintBridgeGuideModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const bridgeCommand = `# Install & run the Choplife Republic Local Print Bridge on your LAN receipt server:
npx choplife-pos-bridge --port 9100 --listen 0.0.0.0`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bridgeCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-80 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1C1211] text-[#FAF7F2] border-2 border-[#FFC700] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl font-montserrat overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-[#251513] border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FFC700] text-[#4D080F]">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-titan text-lg text-white">Choplife Hardware Print Architecture</h3>
              <p className="text-xs text-stone-400">Connecting Web POS to Physical Thermal Printers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-stone-300">
          {/* Security Banner */}
          <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-300 text-sm mb-1">Browser & Cloud Network Boundary</h4>
              <p className="leading-relaxed">
                Modern browsers and cloud servers cannot open arbitrary raw TCP sockets to private internal IP addresses
                (e.g., <code>192.168.1.x</code>) without physical network route peering or a secure local relay. Choplife Republic
                strictly rejects fake virtual spoolers and reports genuine socket reachability status.
              </p>
            </div>
          </div>

          {/* 3 Genuine Paths */}
          <div>
            <h4 className="font-titan text-sm text-white mb-3">Supported Printing Channels</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 bg-stone-900 border border-stone-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-[#FFC700] font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>1. Direct Browser Dialog</span>
                </div>
                <p className="text-stone-400 text-[11px] leading-relaxed">
                  Default and universally supported. Uses an isolated thermal stylesheet (58mm/80mm) sent directly to your OS system print dialog or default thermal driver.
                </p>
                <div className="text-[10px] text-emerald-400 font-mono">Zero driver setup required</div>
              </div>

              <div className="p-4 bg-stone-900 border border-stone-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-[#FFC700] font-bold">
                  <Cpu className="w-4 h-4" />
                  <span>2. WebUSB / WebSerial</span>
                </div>
                <p className="text-stone-400 text-[11px] leading-relaxed">
                  Connect POS thermal printers or cash drawers directly via USB or RS-232 COM port on Chrome or Edge desktop browsers. Sends raw ESC/POS binary packets.
                </p>
                <div className="text-[10px] text-amber-400 font-mono">Chrome / Edge desktop</div>
              </div>

              <div className="p-4 bg-stone-900 border border-stone-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-[#FFC700] font-bold">
                  <Network className="w-4 h-4" />
                  <span>3. Local Print Bridge / LAN</span>
                </div>
                <p className="text-stone-400 text-[11px] leading-relaxed">
                  For kitchen ticket dispatch across branch LAN ethernet/Wi-Fi printers (Epson, Star, Xprinter, Rongta). Run the lightweight bridge on any local branch machine.
                </p>
                <div className="text-[10px] text-sky-400 font-mono">High-volume restaurant POS</div>
              </div>
            </div>
          </div>

          {/* Local Bridge Command */}
          <div className="p-4 bg-black/60 border border-stone-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-300 font-bold">
                <Terminal className="w-4 h-4 text-[#FFC700]" />
                <span>Branch Local Print Bridge Agent</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-mono"
              >
                <Copy className="w-3 h-3" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="p-3 bg-stone-950 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
              {bridgeCommand}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#251513] border-t border-stone-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#FFC700] hover:bg-[#e6b300] text-[#4D080F] text-xs font-titan"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
