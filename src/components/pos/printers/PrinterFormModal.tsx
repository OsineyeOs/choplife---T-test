import React, { useState, useEffect } from 'react';
import { X, Network, Save } from 'lucide-react';
import { DbPrinterProfile } from '../../../../server_db';

interface PrinterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (printer: Partial<DbPrinterProfile>) => Promise<void>;
  initialPrinter?: DbPrinterProfile | null;
}

export const PrinterFormModal: React.FC<PrinterFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPrinter,
}) => {
  const [formData, setFormData] = useState<Partial<DbPrinterProfile>>({
    name: '',
    branchId: 'ring-road',
    role: 'counter_pos',
    connectionType: 'network_ip',
    ip: '192.168.1.',
    port: 9100,
    paperWidth: '80mm',
    enabled: true,
    autoCut: true,
    soundBuzzer: false,
    kickDrawer: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setFormData({
        name: initialPrinter?.name || '',
        branchId: initialPrinter?.branchId || 'ring-road',
        role: initialPrinter?.role || 'counter_pos',
        connectionType: initialPrinter?.connectionType || 'network_ip',
        ip: initialPrinter?.ip || '192.168.1.100',
        port: initialPrinter?.port || 9100,
        paperWidth: initialPrinter?.paperWidth || '80mm',
        enabled: initialPrinter?.enabled ?? true,
        autoCut: initialPrinter?.autoCut ?? true,
        soundBuzzer: initialPrinter?.soundBuzzer ?? false,
        kickDrawer: initialPrinter?.kickDrawer ?? false,
      });
    }
  }, [isOpen, initialPrinter]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setError('Please provide a printer name');
      return;
    }
    if (formData.connectionType === 'network_ip' && !formData.ip?.trim()) {
      setError('Please provide a valid IP address');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        ...formData,
        id: initialPrinter?.id,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save printer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-80 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1C1211] text-[#FAF7F2] border-2 border-[#FFC700] rounded-2xl w-full max-w-lg p-6 shadow-2xl font-montserrat">
        <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#FFC700] text-[#4D080F]">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-titan text-lg text-white">
                {initialPrinter ? 'Edit Thermal Printer' : 'Register New Printer'}
              </h3>
              <p className="text-xs text-stone-400">ESC/POS Network or Hardware Peripheral</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-300 uppercase mb-1">
              Printer Friendly Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Counter Front POS Printer"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-sm text-white focus:outline-none focus:border-[#FFC700]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1">
                Station Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-sm text-white focus:outline-none focus:border-[#FFC700]"
              >
                <option value="counter_pos">Counter POS (Receipts)</option>
                <option value="kitchen_kot">Kitchen KOT (Food)</option>
                <option value="bakery">Grill & Flame Station</option>
                <option value="drinks">Bar & Drinks Station</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1">
                Paper Width
              </label>
              <select
                value={formData.paperWidth}
                onChange={(e) => setFormData({ ...formData, paperWidth: e.target.value as any })}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-sm text-white focus:outline-none focus:border-[#FFC700]"
              >
                <option value="80mm">80mm Roll (Standard POS)</option>
                <option value="58mm">58mm Roll (Compact Mobile)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1">
                LAN IP Address
              </label>
              <input
                type="text"
                placeholder="192.168.1.200"
                value={formData.ip}
                onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-[#FFC700]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1">
                Port
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) || 9100 })}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-[#FFC700]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-stone-800 space-y-2.5">
            <label className="flex items-center gap-2.5 text-xs text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoCut}
                onChange={(e) => setFormData({ ...formData, autoCut: e.target.checked })}
                className="w-4 h-4 accent-[#FFC700] rounded"
              />
              <span>Send Full Paper Cut command (GS V 66 0) at end of ticket</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.soundBuzzer}
                onChange={(e) => setFormData({ ...formData, soundBuzzer: e.target.checked })}
                className="w-4 h-4 accent-[#FFC700] rounded"
              />
              <span>Sound hardware buzzer on new order (Kitchen Alert)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.kickDrawer}
                onChange={(e) => setFormData({ ...formData, kickDrawer: e.target.checked })}
                className="w-4 h-4 accent-[#FFC700] rounded"
              />
              <span>Kick RJ11/RJ12 Cash Drawer on cash checkout (DLE DC4)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#FFC700] hover:bg-[#e6b300] text-[#4D080F] text-xs font-titan flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : initialPrinter ? 'Update Printer' : 'Save Printer Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
