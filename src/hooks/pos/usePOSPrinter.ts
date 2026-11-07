import { useState } from 'react';
import {
  loadHardwarePrinterState,
  kickCashDrawerPeripheral,
  dispatchCustomerReceipt,
  dispatchKitchenKot,
} from '../../utils/hardwarePrinter';

export const usePOSPrinter = () => {
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const printReceipt = async (order: any) => {
    setIsPrinting(true);
    setPrintError(null);
    try {
      const result = await dispatchCustomerReceipt(order);
      if (!result.success) throw new Error(result.error || 'Printing failed');
      return true;
    } catch (err: any) {
      setPrintError(err.message || 'Failed to print receipt');
      return false;
    } finally {
      setIsPrinting(false);
    }
  };

  const printKitchenTicket = async (order: any, station: string = 'all') => {
    setIsPrinting(true);
    setPrintError(null);
    try {
      const result = await dispatchKitchenKot(order, station);
      if (!result.success) throw new Error(result.error || 'Printing KOT failed');
      return true;
    } catch (err: any) {
      setPrintError(err.message || 'Failed to print KOT');
      return false;
    } finally {
      setIsPrinting(false);
    }
  };

  const openCashDrawer = async () => {
    try {
      await kickCashDrawerPeripheral();
      return true;
    } catch (err) {
      console.error('Failed to open cash drawer', err);
      return false;
    }
  };

  return {
    isPrinting,
    printError,
    printReceipt,
    printKitchenTicket,
    openCashDrawer,
    loadPrinterState: loadHardwarePrinterState,
  };
};
