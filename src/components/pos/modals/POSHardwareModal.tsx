import React from 'react';
import { Printer, Scan, X } from 'lucide-react';
import { HardwarePrinterModal } from '../HardwarePrinterModal';
import { BarcodeDispatchScanner } from '../../dispatch/BarcodeDispatchScanner';

import { BranchId } from '../../../types';

interface POSHardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBranchId: BranchId;
  isPrinterModalOpen: boolean;
  setIsPrinterModalOpen: (open: boolean) => void;
  isScannerOpen: boolean;
  setIsScannerOpen: (open: boolean) => void;
  onScanSuccess?: (res: any) => void;
}

export const POSHardwareModal: React.FC<POSHardwareModalProps> = ({
  isOpen,
  onClose,
  activeBranchId,
  isPrinterModalOpen,
  setIsPrinterModalOpen,
  isScannerOpen,
  setIsScannerOpen,
  onScanSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-80 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FAF7F2] rounded-3xl w-full max-w-sm p-6 space-y-4 border-2 border-[#FFC700] shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-titan text-lg text-[#4D080F]">Hardware Manager</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={() => setIsPrinterModalOpen(true)}
            className="w-full flex items-center gap-3 p-4 bg-white border border-[#E5DEC9] rounded-2xl hover:border-[#FFC700] transition-all"
          >
            <Printer className="w-6 h-6 text-[#FFC700]" />
            <span className="font-montserrat font-bold text-sm text-[#241311]">Thermal Printer & Drawer</span>
          </button>
          
          <button
            onClick={() => setIsScannerOpen(true)}
            className="w-full flex items-center gap-3 p-4 bg-white border border-[#E5DEC9] rounded-2xl hover:border-[#FFC700] transition-all"
          >
            <Scan className="w-6 h-6 text-[#FFC700]" />
            <span className="font-montserrat font-bold text-sm text-[#241311]">Barcode / QR Scanner</span>
          </button>
        </div>
      </div>

      <HardwarePrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
      />

      <BarcodeDispatchScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        activeBranchId={activeBranchId}
        onScanSuccess={onScanSuccess || (() => {})}
      />
    </div>
  );
};
