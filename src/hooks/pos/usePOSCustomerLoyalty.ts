import { useState } from 'react';

export const usePOSCustomerLoyalty = () => {
  const [isMemberLookupOpen, setIsMemberLookupOpen] = useState<boolean>(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState<string>('');
  const [registeredCustomers, setRegisteredCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [registeredHouseAccounts, setRegisteredHouseAccounts] = useState<any[]>([]);
  const [selectedHouseAccount, setSelectedHouseAccount] = useState<any | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
  const [walletPin, setWalletPin] = useState<string>('');
  const [walletError, setWalletError] = useState<string>('');

  const fetchMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const [resCust, resAccts] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/house-accounts'),
      ]);
      if (resCust.ok) {
        const custData = await resCust.json();
        setRegisteredCustomers(custData.customers || []);
      }
      if (resAccts.ok) {
        const acctData = await resAccts.json();
        setRegisteredHouseAccounts(acctData.accounts || []);
      }
    } catch (err) {
      console.error('Failed to load customers for POS:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const resetSelection = () => {
    setSelectedCustomer(null);
    setSelectedHouseAccount(null);
    setWalletPin('');
    setWalletError('');
  };

  return {
    isMemberLookupOpen,
    setIsMemberLookupOpen,
    memberSearchTerm,
    setMemberSearchTerm,
    registeredCustomers,
    selectedCustomer,
    setSelectedCustomer,
    registeredHouseAccounts,
    selectedHouseAccount,
    setSelectedHouseAccount,
    isLoadingMembers,
    walletPin,
    setWalletPin,
    walletError,
    setWalletError,
    fetchMembers,
    resetSelection,
  };
};
