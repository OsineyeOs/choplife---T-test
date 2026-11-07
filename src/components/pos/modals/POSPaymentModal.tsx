import React from 'react';
import { X, CreditCard, Banknote, Building, Wallet, Award, RotateCcw } from 'lucide-react';

interface POSPaymentModalProps {
  formatNaira: (amount: number) => string;
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  currentBranch: any;
  orderType: string;
  tableNumber: string;
  customerName: string;
  paymentState: any;
  setPaymentMethod: (method: any) => void;
  cashTendered: string;
  setCashTendered: (val: string) => void;
  bankRef: string;
  setBankRef: (val: string) => void;
  posRrn: string;
  setPosRrn: (val: string) => void;
  splitCash: string;
  setSplitCash: (val: string) => void;
  splitPos: string;
  setSplitPos: (val: string) => void;
  walletError: string;
  setWalletError: (val: string) => void;
  selectedCustomer: any;
  selectedHouseAccount: any;
  walletPin: string;
  setWalletPin: (val: string) => void;
  changeDue: number;
  onMemberLookupOpen: () => void;
  fetchMembers: () => void;
  onComplete: () => void;
}

export const POSPaymentModal: React.FC<POSPaymentModalProps> = ({
  formatNaira,
  isOpen,
  onClose,
  grandTotal,
  currentBranch,
  orderType,
  tableNumber,
  customerName,
  paymentState,
  setPaymentMethod,
  cashTendered,
  setCashTendered,
  bankRef,
  setBankRef,
  posRrn,
  setPosRrn,
  splitCash,
  setSplitCash,
  splitPos,
  setSplitPos,
  walletError,
  setWalletError,
  selectedCustomer,
  selectedHouseAccount,
  walletPin,
  setWalletPin,
  changeDue,
  onMemberLookupOpen,
  fetchMembers,
  onComplete,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border-2 border-[#FFC700] p-6 space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-titan text-lg text-[#4D080F] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#E62E00]" />
            COMPLETE PAYMENT
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#FFF8E7] p-4 rounded-2xl border border-[#FFC700] flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-600 font-montserrat uppercase">Amount Payable</p>
            <p className="font-titan text-2xl text-[#E62E00]">{formatNaira(grandTotal)}</p>
          </div>
          <div className="text-right text-xs text-gray-500 font-montserrat">
            <p>Branch: <strong>{currentBranch.shortName}</strong></p>
            <p>{orderType.toUpperCase()} • {tableNumber || customerName}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { id: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4" /> },
            { id: 'pos_terminal', label: 'Card POS', icon: <CreditCard className="w-4 h-4" /> },
            { id: 'bank_transfer', label: 'Transfer', icon: <Building className="w-4 h-4" /> },
            { id: 'wallet', label: 'Wallet', icon: <Wallet className="w-4 h-4" /> },
            { id: 'house_account', label: 'Corp Tab', icon: <Award className="w-4 h-4" /> },
            { id: 'split', label: 'Split', icon: <RotateCcw className="w-4 h-4" /> },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setPaymentMethod(m.id);
                setWalletError('');
              }}
              className={`p-2.5 rounded-2xl text-[11px] font-montserrat font-bold flex flex-col items-center gap-1 border transition-all ${
                paymentState.paymentMethod === m.id
                  ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F] shadow-sm ring-2 ring-[#FFC700]/50'
                  : 'bg-[#FAF7F2] text-[#241311] border-[#E5DEC9] hover:bg-[#F2ECE1]'
              }`}
            >
              {m.icon}
              <span className="truncate w-full text-center">{m.label}</span>
            </button>
          ))}
        </div>

        {walletError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-montserrat font-bold text-red-700 flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            <span>{walletError}</span>
          </div>
        )}
        
        <button
            onClick={onComplete}
            className="w-full py-4 bg-[#E62E00] hover:bg-[#c92800] text-white rounded-2xl font-titan uppercase tracking-wider shadow-lg transition-all"
        >
            Confirm Payment
        </button>
      </div>
    </div>
  );
};
