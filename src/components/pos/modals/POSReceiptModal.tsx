import React from 'react';
import { X, Printer, Banknote, Smartphone } from 'lucide-react';

interface POSReceiptModalProps {
  formatNaira: (amount: number) => string;
  isOpen: boolean;
  completedOrder: any;
  receiptMode: 'customer' | 'kitchen';
  setReceiptMode: (mode: 'customer' | 'kitchen') => void;
  onClose: () => void;
  printReceipt: (order: any) => Promise<boolean>;
  printKitchenTicket: (order: any, kitchen: string) => Promise<boolean>;
  openCashDrawer: () => void;
  isPrinting: boolean;
  eReceiptPhone: string;
  setEReceiptPhone: (phone: string) => void;
  isSendingEReceipt: boolean;
  eReceiptStatus: string | null;
  handleSendDigitalReceipt: (channel: 'sms' | 'whatsapp' | 'both') => Promise<void>;
  currentBranch: any;
  setIsHardwarePrinterModalOpen: (open: boolean) => void;
}

export const POSReceiptModal: React.FC<POSReceiptModalProps> = ({
  formatNaira,
  isOpen,
  completedOrder,
  receiptMode,
  setReceiptMode,
  onClose,
  printReceipt,
  printKitchenTicket,
  openCashDrawer,
  isPrinting,
  eReceiptPhone,
  setEReceiptPhone,
  isSendingEReceipt,
  eReceiptStatus,
  handleSendDigitalReceipt,
  currentBranch,
  setIsHardwarePrinterModalOpen,
}) => {
  if (!isOpen || !completedOrder) return null;

  return (
    <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border-2 border-[#FFC700] p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setReceiptMode('customer')}
              className={`px-3 py-1 rounded-xl text-xs font-montserrat font-bold ${
                receiptMode === 'customer' ? 'bg-[#4D080F] text-[#FFC700]' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Customer Receipt
            </button>
            <button
              onClick={() => setReceiptMode('kitchen')}
              className={`px-3 py-1 rounded-xl text-xs font-montserrat font-bold ${
                receiptMode === 'kitchen' ? 'bg-[#E62E00] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Kitchen KOT Slip
            </button>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#FAF7F2] p-5 rounded-2xl border-2 border-dashed border-gray-300 font-mono text-xs text-[#241311] space-y-3 select-all">
          {receiptMode === 'customer' ? (
            <>
              <div className="text-center space-y-1">
                <h2 className="font-titan text-base tracking-wider text-[#4D080F]">CHOPLIFE REPUBLIC</h2>
                <p className="text-[10px]">{currentBranch.address}</p>
                <p className="text-[10px]">Tel: {currentBranch.phone}</p>
                <div className="border-b border-dashed border-gray-400 my-2" />
              </div>
              <div className="space-y-1 text-[11px]">
                <p><strong>Order #:</strong> {completedOrder.orderNumber}</p>
                <p><strong>Date:</strong> {completedOrder.timestamp}</p>
                <p><strong>Cashier:</strong> {completedOrder.cashier}</p>
              </div>
              <div className="space-y-1.5 text-[11px]">
                {completedOrder.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}x {item.product.name}</span>
                    <span>{formatNaira(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-b border-dashed border-gray-400 my-2" />
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-gray-400">
                <span>TOTAL PAID:</span>
                <span>{formatNaira(completedOrder.total)}</span>
              </div>
            </>
          ) : (
            <div className="text-center space-y-1 bg-red-100 p-2 rounded-xl border border-red-300">
              <h2 className="font-titan text-lg text-red-700">KITCHEN ORDER TICKET (KOT)</h2>
              <p className="text-xs font-bold">ORDER #{completedOrder.orderNumber}</p>
            </div>
          )}
        </div>

        {/* Digital e-Receipt (SMS / WhatsApp) Dispatcher */}
        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-titan text-[#4D080F]">
                    <Smartphone className="w-3.5 h-3.5 text-[#E62E00]" />
                    <span>Instant Digital e-Receipt</span>
                </div>
                {eReceiptStatus && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        eReceiptStatus.includes('sent') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                        {eReceiptStatus}
                    </span>
                )}
            </div>

            <div className="flex gap-2">
                <input
                    type="tel"
                    value={eReceiptPhone}
                    onChange={(e) => setEReceiptPhone(e.target.value)}
                    placeholder="Customer phone"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-mono"
                />
                <button type="button" onClick={() => handleSendDigitalReceipt('sms')} disabled={isSendingEReceipt} className="px-3 py-1.5 rounded-xl bg-[#4D080F] text-[#FFC700] text-[11px] font-titan uppercase shadow-sm">SMS</button>
                <button type="button" onClick={() => handleSendDigitalReceipt('whatsapp')} disabled={isSendingEReceipt} className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-titan uppercase shadow-sm">WA</button>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
            <div className="flex gap-2">
                <button
                    onClick={async () => {
                        if (receiptMode === 'customer') await printReceipt(completedOrder);
                        else await printKitchenTicket(completedOrder, 'Kitchen & Grill');
                    }}
                    disabled={isPrinting}
                    className="flex-1 py-3 rounded-2xl bg-[#4D080F] text-white text-xs font-titan uppercase shadow-md transition-all active:scale-98"
                >
                    <Printer className="w-4 h-4 text-[#FFC700]" />
                    {isPrinting ? 'PRINTING...' : 'PRINT'}
                </button>
                <button onClick={openCashDrawer} className="px-3 py-3 rounded-2xl bg-emerald-700 text-white text-xs font-titan shadow-sm" title="Drawer">
                    <Banknote className="w-4 h-4 text-emerald-200" />
                </button>
                <button onClick={onClose} className="px-4 py-3 rounded-2xl bg-gray-200 text-gray-800 text-xs font-montserrat font-bold">Close</button>
            </div>
        </div>
      </div>
    </div>
  );
};
