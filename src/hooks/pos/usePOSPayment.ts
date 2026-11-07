import { useState } from 'react';
import { processPayment, chargeWallet, chargeHouseAccount } from '../../services/pos/paymentService';

export const usePOSPayment = () => {
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pos_terminal' | 'bank_transfer' | 'split' | 'wallet' | 'house_account'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [bankRef, setBankRef] = useState<string>('');
  const [posRrn, setPosRrn] = useState<string>('');
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitPos, setSplitPos] = useState<string>('');

  const resetPaymentState = () => {
    setIsPaymentOpen(false);
    setPaymentMethod('cash');
    setCashTendered('');
    setBankRef('');
    setPosRrn('');
    setSplitCash('');
    setSplitPos('');
  };

  return {
    isPaymentOpen,
    setIsPaymentOpen,
    paymentMethod,
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
    resetPaymentState,
    processPayment,
    chargeWallet,
    chargeHouseAccount,
  };
};
