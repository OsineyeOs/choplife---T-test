import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, OrderDeliveryDetails, SavedAddress } from '../../types';
import {
  X,
  CreditCard,
  Building2,
  Banknote,
  Clock,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
  Calendar,
  Search,
  MapPin,
  Sparkles,
  Award,
} from 'lucide-react';
import {
  GRA_DELIVERY_ZONES,
  OKABERE_DELIVERY_ZONES,
  UGBOWO_DELIVERY_ZONES,
} from '../../data/deliveryMaster';
import { evaluateBranchOperatingStatus } from '../../utils/branchScheduling';

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutOpen,
    setIsCheckoutOpen,
    cart,
    cartSubtotal,
    cartPackagingFee,
    deliveryFee,
    cartDiscount,
    cartTotal,
    appliedCoupon,
    orderType,
    currentBranch,
    selectedBranchId,
    selectedDeliveryZone,
    setSelectedDeliveryZone,
    createOrder,
    formatNaira,
    getBranchWhatsAppUrl,
    generateWhatsAppCartText,
    customerProfile,
    updateCustomerProfile,
    customerLogin,
    clearSavedCheckoutDetails,
    addSavedAddress,
    orders,
  } = useApp();

  const hasSavedCheckoutProfile = Boolean(
    customerProfile.rememberCheckoutDetails !== false &&
      customerProfile.name &&
      customerProfile.phone
  );
  const savedAddresses = hasSavedCheckoutProfile ? customerProfile.savedAddresses || [] : [];
  const primaryAddress = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];

  const [step, setStep] = useState<'details' | 'payment' | 'processing' | 'failed'>('details');
  const [rememberForNextTime, setRememberForNextTime] = useState<boolean>(
    customerProfile.rememberCheckoutDetails !== false
  );
  const [addressLabel, setAddressLabel] = useState<SavedAddress['label']>('Home');
  const [branchClosedError, setBranchClosedError] = useState<string | null>(null);

  // Gather current branch zones from master delivery list
  const branchMasterZones =
    selectedBranchId === 'okabere'
      ? OKABERE_DELIVERY_ZONES
      : selectedBranchId === 'ugbowo'
      ? UGBOWO_DELIVERY_ZONES
      : GRA_DELIVERY_ZONES;

  const resolveValidBranchZone = (candidateZone?: string): string => {
    if (candidateZone && branchMasterZones.some((z) => z.locationName === candidateZone)) {
      return candidateZone;
    }
    if (selectedDeliveryZone && branchMasterZones.some((z) => z.locationName === selectedDeliveryZone)) {
      return selectedDeliveryZone;
    }
    return branchMasterZones[0]?.locationName || currentBranch.deliveryZones[0]?.name || 'Airport Road';
  };

  const [formData, setFormData] = useState<OrderDeliveryDetails>(() => ({
    customerName: hasSavedCheckoutProfile ? customerProfile.name || '' : '',
    customerPhone: hasSavedCheckoutProfile ? customerProfile.phone || '' : '',
    customerEmail: hasSavedCheckoutProfile ? customerProfile.email || '' : '',
    address: hasSavedCheckoutProfile ? primaryAddress?.address || '' : '',
    deliveryZone: resolveValidBranchZone(hasSavedCheckoutProfile ? primaryAddress?.deliveryZone : undefined),
    landmark: hasSavedCheckoutProfile ? primaryAddress?.landmark || '' : '',
    alternatePhone: hasSavedCheckoutProfile ? customerProfile.alternatePhone || '' : '',
    deliveryNotes: hasSavedCheckoutProfile ? customerProfile.defaultDeliveryNotes || '' : '',
    deliveryInstructions: hasSavedCheckoutProfile ? customerProfile.defaultDeliveryNotes || '' : '',
    preparationNotes: '',
    specialOccasionNote: '',
    scheduledTime: 'ASAP',
    isGiftOrder: false,
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    giftMessage: '',
    senderName: hasSavedCheckoutProfile ? customerProfile.name || '' : '',
    hideSenderIdentity: false,
  }));

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [zoneSearchQuery, setZoneSearchQuery] = useState('');
  const [bankTransferConfig, setBankTransferConfig] = useState<{
    configured: boolean;
    bankName: string | null;
    accountName: string | null;
    accountNumber: string | null;
    instructions: string;
  } | null>(null);
  const [transferReferenceInput, setTransferReferenceInput] = useState('');
  const [payerBankInput, setPayerBankInput] = useState('');
  const [isSignInExpanded, setIsSignInExpanded] = useState(false);
  const [signInPhoneInput, setSignInPhoneInput] = useState('');
  const [signInNameInput, setSignInNameInput] = useState('');
  const [signInError, setSignInError] = useState('');
  const isSubmittingOrderRef = React.useRef(false);
  const checkoutOrderIdRef = React.useRef<string>('');

  useEffect(() => {
    if (!isCheckoutOpen) {
      isSubmittingOrderRef.current = false;
      checkoutOrderIdRef.current = '';
      return;
    }
    if (!checkoutOrderIdRef.current) {
      checkoutOrderIdRef.current = `CL-${Math.floor(10000 + Math.random() * 90000)}`;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'processing') {
        setIsCheckoutOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCheckoutOpen, step, setIsCheckoutOpen]);

  useEffect(() => {
    if (!isCheckoutOpen) return;
    fetch('/api/payments/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.bankTransfer) {
          setBankTransferConfig(data.bankTransfer);
        }
      })
      .catch(() => {});
  }, [isCheckoutOpen]);

  // Sync profile and saved address whenever CheckoutModal opens, branch changes, or customer signs in
  useEffect(() => {
    if (!isCheckoutOpen) return;
    if (!hasSavedCheckoutProfile) {
      const defaultZone = resolveValidBranchZone(formData.deliveryZone);
      setFormData((prev) => ({
        ...prev,
        customerName: prev.customerName || '',
        customerPhone: prev.customerPhone || '',
        customerEmail: prev.customerEmail || '',
        address: prev.address || '',
        deliveryZone: defaultZone,
        landmark: prev.landmark || '',
        alternatePhone: prev.alternatePhone || '',
        deliveryNotes: prev.deliveryNotes || '',
        scheduledTime: prev.scheduledTime || 'ASAP',
      }));
      setRememberForNextTime(customerProfile.rememberCheckoutDetails !== false);
      return;
    }

    const latestAddr = customerProfile.savedAddresses?.find((a) => a.isDefault) || customerProfile.savedAddresses?.[0];
    const resolvedZone = resolveValidBranchZone(
      latestAddr?.deliveryZone || formData.deliveryZone
    );

    setFormData((prev) => ({
      ...prev,
      customerName: customerProfile.name || prev.customerName || '',
      customerPhone: customerProfile.phone || prev.customerPhone || '',
      customerEmail: customerProfile.email || prev.customerEmail || '',
      address: latestAddr?.address || prev.address || '',
      deliveryZone: resolvedZone,
      landmark: latestAddr?.landmark || prev.landmark || '',
      alternatePhone: customerProfile.alternatePhone || prev.alternatePhone || '',
      deliveryNotes: customerProfile.defaultDeliveryNotes || prev.deliveryNotes || '',
      deliveryInstructions: customerProfile.defaultDeliveryNotes || prev.deliveryInstructions || '',
    }));
    setRememberForNextTime(true);

    if (resolvedZone && resolvedZone !== selectedDeliveryZone) {
      setSelectedDeliveryZone(resolvedZone);
    }
  }, [
    isCheckoutOpen,
    selectedBranchId,
    hasSavedCheckoutProfile,
    customerProfile.isLoggedIn,
    customerProfile.name,
    customerProfile.phone,
  ]);

  if (!isCheckoutOpen) return null;

  const filteredZones = branchMasterZones.filter(
    (z) =>
      z.locationName.toLowerCase().includes(zoneSearchQuery.toLowerCase()) ||
      z.aliases.some((a) => a.toLowerCase().includes(zoneSearchQuery.toLowerCase()))
  );

  const handleSelectSavedAddress = (addr: SavedAddress) => {
    const validZone = resolveValidBranchZone(addr.deliveryZone);
    setFormData((prev) => ({
      ...prev,
      address: addr.address,
      deliveryZone: validZone,
      landmark: addr.landmark || '',
    }));
    setSelectedDeliveryZone(validZone);
    setAddressLabel(addr.label || 'Home');
  };

  const handleClearPrefilledDetails = () => {
    clearSavedCheckoutDetails();
    setFormData({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      address: '',
      deliveryZone: resolveValidBranchZone(),
      landmark: '',
      alternatePhone: '',
      deliveryNotes: '',
      scheduledTime: 'ASAP',
    });
    setRememberForNextTime(false);
    setIsSignInExpanded(false);
  };

  const handleInlineCustomerSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    const cleanPhone = signInPhoneInput.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      setSignInError('Please enter a valid 11-digit phone number to sign in.');
      return;
    }
    const candidateName =
      signInNameInput.trim() ||
      customerProfile.knownDisplayName ||
      formData.customerName.trim() ||
      '';
    customerLogin(candidateName, signInPhoneInput.trim());
    setIsSignInExpanded(false);
    setSignInPhoneInput('');
    setSignInNameInput('');
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rememberForNextTime && formData.customerName.trim() && formData.customerPhone.trim()) {
      customerLogin(
        formData.customerName.trim(),
        formData.customerPhone.trim(),
        formData.customerEmail?.trim() || undefined
      );

      // Build updated savedAddresses with current delivery address promoted as default ONLY if not a gift order
      // (preserve customer's own saved addresses when sending a gift to another recipient)
      let nextAddresses = [...(customerProfile.savedAddresses || []).filter((a) => a.id !== 'addr-default-gra')];
      if (!formData.isGiftOrder && orderType === 'delivery' && formData.address.trim()) {
        const normAddr = formData.address.trim().toLowerCase();
        const existingIdx = nextAddresses.findIndex(
          (a) => a.address.trim().toLowerCase() === normAddr
        );
        const newEntry: SavedAddress = {
          id: existingIdx > -1 ? nextAddresses[existingIdx].id : `addr-${Date.now()}`,
          label: addressLabel,
          address: formData.address.trim(),
          deliveryZone: formData.deliveryZone,
          landmark: formData.landmark?.trim() || undefined,
          isDefault: true,
        };
        if (existingIdx > -1) {
          nextAddresses.splice(existingIdx, 1);
        }
        nextAddresses = [
          newEntry,
          ...nextAddresses.map((a) => ({ ...a, isDefault: false })),
        ];
      }

      updateCustomerProfile({
        name: formData.customerName.trim(),
        knownDisplayName: formData.customerName.trim(),
        phone: formData.customerPhone.trim(),
        email: formData.customerEmail?.trim() || customerProfile.email,
        alternatePhone: formData.alternatePhone?.trim() || '',
        defaultDeliveryNotes: formData.isGiftOrder
          ? customerProfile.defaultDeliveryNotes || ''
          : formData.deliveryNotes?.trim() || '',
        rememberCheckoutDetails: true,
        preferredBranchId: selectedBranchId,
        savedAddresses: nextAddresses,
        isLoggedIn: true,
      });
    } else if (!rememberForNextTime) {
      clearSavedCheckoutDetails();
    }
    setStep('payment');
  };

  const handleCompleteOrder = () => {
    if (isSubmittingOrderRef.current || step === 'processing') return;
    const branchStatus = evaluateBranchOperatingStatus(selectedBranchId);
    if (!branchStatus.isOpen) {
      setBranchClosedError(`${branchStatus.reason} ${branchStatus.nextOpenNotice || ''}`);
      return;
    }
    isSubmittingOrderRef.current = true;
    setBranchClosedError(null);
    setStep('processing');
    const stableOrderId = checkoutOrderIdRef.current || `CL-${Math.floor(10000 + Math.random() * 90000)}`;

    setTimeout(() => {
      try {
        const effectivePaymentStatus =
          paymentMethod === 'bank_transfer' ? 'reconciliation_required' : 'pending';
        createOrder({
          id: stableOrderId,
          branchId: selectedBranchId,
          orderType,
          items: [...cart],
          subtotal: cartSubtotal,
          deliveryFee: orderType === 'delivery' ? deliveryFee : 0,
          packagingFee: cartPackagingFee,
          discount: cartDiscount,
          appliedCouponCode: appliedCoupon || undefined,
          total: cartTotal,
          paymentMethod,
          paymentStatus: effectivePaymentStatus,
          deliveryDetails: {
            ...formData,
            isGiftOrder: Boolean(formData.isGiftOrder),
            recipientName: formData.isGiftOrder ? (formData.recipientName || '').trim() : undefined,
            recipientPhone: formData.isGiftOrder ? (formData.recipientPhone || '').trim() : undefined,
            recipientAddress: formData.isGiftOrder ? (formData.address || '').trim() : undefined,
            giftMessage: formData.isGiftOrder ? (formData.giftMessage || '').trim().slice(0, 250) : undefined,
            senderName: formData.isGiftOrder
              ? formData.hideSenderIdentity
                ? 'Anonymous Sender'
                : (formData.senderName || formData.customerName || '').trim()
              : undefined,
            hideSenderIdentity: Boolean(formData.isGiftOrder && formData.hideSenderIdentity),
            deliveryNotes: formData.deliveryInstructions || formData.deliveryNotes || '',
            deliveryInstructions: formData.deliveryInstructions || formData.deliveryNotes || '',
            preparationNotes: formData.preparationNotes || '',
            specialOccasionNote: (formData.specialOccasionNote || '').slice(0, 160),
            specialOccasionDisclaimerAccepted: Boolean(formData.specialOccasionNote),
            scheduledTime:
              isScheduleExpanded && scheduledDateTime
                ? scheduledDateTime
                : 'Standard Dispatch (30–90 mins)',
          },
          orderChannel: 'website',
        });

        setIsCheckoutOpen(false);
        setStep('details');
      } finally {
        isSubmittingOrderRef.current = false;
      }
    }, 1200);
  };

  const pointsToEarn = Math.floor(cartTotal / 1000);
  const isReturningCustomerRecognized = Boolean(
    customerProfile.isLoggedIn && customerProfile.name && customerProfile.phone
  );
  const rememberedCustomerName = (customerProfile.knownDisplayName || customerProfile.name || '').trim();

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      id="checkout-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'processing') {
          setIsCheckoutOpen(false);
        }
      }}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[94dvh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E5DEC9] flex flex-col justify-between">
        
        {/* Header */}
        <div className="bg-[#4D080F] text-white p-4 sm:p-5 rounded-t-2xl sm:rounded-t-3xl flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
            {step === 'payment' && (
              <button
                onClick={() => setStep('details')}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                id="checkout-back-step-btn"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <span className="text-[10px] font-titan uppercase tracking-widest text-[#FFC700] block">
                SECURE FRICTIONLESS CHECKOUT
              </span>
              <h2 className="font-titan text-lg sm:text-xl text-white">
                {step === 'details' ? 'DELIVERY & CONTACT DETAILS' : 'SELECT PAYMENT METHOD'}
              </h2>
            </div>
          </div>

          <button
            onClick={() => setIsCheckoutOpen(false)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            id="close-checkout-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Processing Screen */}
        {step === 'processing' && (
          <div className="p-12 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-[#FFF8E7] border-4 border-[#E62E00] border-t-transparent animate-spin mx-auto" />
            <h3 className="font-titan text-2xl text-[#4D080F]">Processing Your Order...</h3>
            <p className="text-xs text-[#7A6A65] font-montserrat max-w-sm mx-auto">
              Connecting directly to Choplife Republic {currentBranch.shortName} kitchen terminal. Generating live dispatch ticket.
            </p>
          </div>
        )}

        {/* Step 1: Customer Details & Address */}
        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="p-5 sm:p-6 space-y-5 flex-1">
            
            {/* Branch & Fulfillment summary banner */}
            <div className="bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#E5DEC9] flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#7A6A65] font-montserrat uppercase font-bold">
                  FULFILLING KITCHEN
                </p>
                <p className="font-titan text-sm text-[#4D080F]">{currentBranch.name}</p>
              </div>
              <span className="text-xs font-montserrat font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-xl">
                {orderType === 'delivery' ? '🛵 Home Delivery' : '🏪 Branch Pickup'}
              </span>
            </div>

            {/* Returning Customer Fast-Fill Recognition Banner (Logged-in) OR Logged-Out Sign-In Prompt */}
            {isReturningCustomerRecognized ? (
              <div
                className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                id="returning-customer-prefill-banner"
              >
                <div className="flex items-center gap-2 text-xs font-montserrat text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Welcome back, <strong>{customerProfile.name}</strong>! Your saved details are pre-filled.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearPrefilledDetails}
                  className="text-[11px] font-montserrat font-bold text-rose-700 hover:underline self-end sm:self-auto shrink-0"
                  id="clear-saved-checkout-btn"
                >
                  Not you? Clear saved info
                </button>
              </div>
            ) : (
              <div
                className="bg-[#FFF8E7] border border-[#FFC700] rounded-2xl p-3.5 space-y-2.5"
                id="returning-customer-signin-prompt"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs font-montserrat text-[#4D080F] leading-snug">
                    {rememberedCustomerName ? (
                      <>
                        Hello, <strong>{rememberedCustomerName}</strong>. It looks like you&rsquo;re logged out. Please sign in to continue with your saved details.
                      </>
                    ) : (
                      <>Welcome back. Please sign in to continue with your saved details.</>
                    )}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsSignInExpanded(!isSignInExpanded)}
                      className="px-3 py-1.5 rounded-xl bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] font-titan text-xs transition-colors cursor-pointer"
                      id="checkout-toggle-signin-btn"
                    >
                      {isSignInExpanded ? 'Cancel' : 'Sign In'}
                    </button>
                    {rememberedCustomerName && (
                      <button
                        type="button"
                        onClick={handleClearPrefilledDetails}
                        className="text-[11px] font-montserrat font-bold text-rose-700 hover:underline"
                        id="checkout-switch-customer-btn"
                      >
                        Not you?
                      </button>
                    )}
                  </div>
                </div>

                {isSignInExpanded && (
                  <div className="pt-2 border-t border-[#FFC700]/50 space-y-2 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="tel"
                        placeholder="Registered Phone Number *"
                        value={signInPhoneInput}
                        onChange={(e) => setSignInPhoneInput(e.target.value)}
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                        id="checkout-signin-phone-input"
                      />
                      <input
                        type="text"
                        placeholder={rememberedCustomerName || 'Your Name (Optional)'}
                        value={signInNameInput}
                        onChange={(e) => setSignInNameInput(e.target.value)}
                        className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                        id="checkout-signin-name-input"
                      />
                    </div>
                    {signInError && (
                      <p className="text-[11px] text-rose-700 font-montserrat font-semibold">{signInError}</p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[#7A6A65] font-montserrat">
                        Your current cart ({cart.length} item{cart.length === 1 ? '' : 's'}) will be preserved.
                      </span>
                      <button
                        type="button"
                        onClick={handleInlineCustomerSignIn}
                        className="px-4 py-1.5 rounded-xl bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs shadow-xs cursor-pointer"
                        id="checkout-signin-submit-btn"
                      >
                        Restore Saved Details
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Saved Address Quick-Fill Chips if user has saved addresses */}
            {savedAddresses.length > 0 && orderType === 'delivery' && (
              <div className="space-y-1.5 bg-[#FFF8E7] p-3 rounded-2xl border border-[#FFC700]" id="saved-addresses-picker">
                <span className="text-[10px] font-titan uppercase tracking-wider text-[#4D080F] block">
                  1-CLICK SAVED DELIVERY ADDRESSES:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {savedAddresses.map((addr) => {
                    const isSelectedAddr =
                      formData.address.trim().toLowerCase() === addr.address.trim().toLowerCase();
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr)}
                        className={`text-xs font-montserrat font-semibold px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-all border ${
                          isSelectedAddr
                            ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F]'
                            : 'bg-white text-[#4D080F] border-[#E5DEC9] hover:border-[#E62E00]'
                        }`}
                        id={`saved-address-chip-${addr.id}`}
                      >
                        <MapPin className={`w-3 h-3 ${isSelectedAddr ? 'text-[#FFC700]' : 'text-[#E62E00]'}`} />
                        <span>
                          {addr.label}: {addr.address} ({addr.deliveryZone})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Customer Basic Details */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-titan text-xs text-[#4D080F] uppercase tracking-wider block">
                  {formData.isGiftOrder ? '1. YOUR BUYER ACCOUNT & CONTACT DETAILS' : '1. CONTACT INFORMATION'}
                </label>
                <label
                  htmlFor="checkout-gift-order-toggle"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-montserrat font-bold cursor-pointer transition-all ${
                    formData.isGiftOrder
                      ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F] shadow-xs'
                      : 'bg-[#FFF8E7] text-[#4D080F] border-[#FFC700] hover:bg-[#FFC700]/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    id="checkout-gift-order-toggle"
                    checked={Boolean(formData.isGiftOrder)}
                    onChange={(e) => {
                      const nextGift = e.target.checked;
                      setFormData((prev) => ({
                        ...prev,
                        isGiftOrder: nextGift,
                        senderName: prev.senderName || prev.customerName || '',
                        address: nextGift ? '' : primaryAddress?.address || prev.address || '',
                        landmark: nextGift ? '' : primaryAddress?.landmark || prev.landmark || '',
                      }));
                    }}
                    className="rounded border-[#FFC700] text-[#E62E00] focus:ring-[#E62E00]"
                  />
                  <span>🎁 Order as a Gift for Someone Else</span>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] mb-1 block">
                    {formData.isGiftOrder ? 'Your Name (Buyer) *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. James Doe"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2.5 text-xs font-montserrat text-[#241311] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                    id="checkout-name-input"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] mb-1 block">
                    {formData.isGiftOrder ? 'Your Phone (For Payment & Updates) *' : 'Phone / WhatsApp *'}
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 0801 234 5678"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2.5 text-xs font-montserrat text-[#241311] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                    id="checkout-phone-input"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] mb-1 block">
                  Email (Optional - for digital receipt)
                </label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                  id="checkout-email-input"
                />
              </div>
            </div>

            {/* Gift Recipient Section (when Gift Order is enabled) */}
            {formData.isGiftOrder && (
              <div
                id="checkout-gift-recipient-section"
                className="bg-gradient-to-br from-[#FFF8E7] to-[#FAF7F2] p-4 rounded-2xl border-2 border-[#FFC700] space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-titan text-xs text-[#4D080F] uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎁 GIFT RECIPIENT &amp; PERSONAL MESSAGE</span>
                  </span>
                  <span className="text-[10px] font-montserrat font-bold bg-[#4D080F] text-[#FFC700] px-2 py-0.5 rounded-full">
                    Account Protected
                  </span>
                </div>
                <p className="text-[11px] text-[#5C4D49] font-montserrat leading-snug">
                  We will deliver directly to your recipient while keeping this order under your account and loyalty profile.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-montserrat font-bold text-[#4D080F] mb-1 block">
                      Recipient Full Name *
                    </label>
                    <input
                      type="text"
                      required={Boolean(formData.isGiftOrder)}
                      placeholder="e.g. Adesuwa Obaseki"
                      value={formData.recipientName || ''}
                      onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                      id="checkout-recipient-name-input"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-montserrat font-bold text-[#4D080F] mb-1 block">
                      Recipient Phone Number *
                    </label>
                    <input
                      type="tel"
                      required={Boolean(formData.isGiftOrder)}
                      placeholder="e.g. 0803 555 9012"
                      value={formData.recipientPhone || ''}
                      onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                      id="checkout-recipient-phone-input"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-montserrat font-bold text-[#4D080F]">
                      Personal Gift Message (Printed on Gift Slip)
                    </label>
                    <span className="text-[10px] font-montserrat text-[#7A6A65]">
                      {(formData.giftMessage || '').length}/250
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={250}
                    placeholder="e.g. Happy Birthday Adesuwa! Sending you warm small chops and love from Lagos..."
                    value={formData.giftMessage || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, giftMessage: e.target.value.slice(0, 250) })
                    }
                    className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                    id="checkout-gift-message-input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                  <div>
                    <label className="text-[11px] font-montserrat font-bold text-[#4D080F] mb-1 block">
                      From (Sender Name on Gift Note)
                    </label>
                    <input
                      type="text"
                      disabled={Boolean(formData.hideSenderIdentity)}
                      placeholder={formData.customerName || 'Your Name'}
                      value={formData.hideSenderIdentity ? 'Anonymous Sender' : formData.senderName || ''}
                      onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                      className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311] disabled:bg-stone-100 disabled:text-stone-500"
                      id="checkout-gift-sender-input"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-montserrat text-[#4D080F] cursor-pointer pt-4">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.hideSenderIdentity)}
                      onChange={(e) =>
                        setFormData({ ...formData, hideSenderIdentity: e.target.checked })
                      }
                      className="rounded border-[#E5DEC9] text-[#E62E00] focus:ring-[#E62E00]"
                      id="checkout-gift-anonymous-checkbox"
                    />
                    <span className="font-semibold">Send anonymously (hide my name from recipient)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Delivery Address (if Delivery) */}
            {orderType === 'delivery' && (
              <div className="space-y-3 pt-2 border-t border-[#F0EAE1]">
                <div className="flex items-center justify-between">
                  <label className="font-titan text-xs text-[#4D080F] uppercase tracking-wider block">
                    {formData.isGiftOrder
                      ? '2. RECIPIENT DELIVERY ADDRESS IN BENIN CITY'
                      : '2. BENIN CITY DELIVERY ADDRESS'}
                  </label>
                  <div className="flex items-center gap-1">
                    {(['Home', 'Office', 'Hostel', 'Other'] as SavedAddress['label'][]).map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setAddressLabel(lbl)}
                        className={`text-[10px] font-montserrat font-bold px-2 py-0.5 rounded-lg border transition-colors ${
                          addressLabel === lbl
                            ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F]'
                            : 'bg-[#FAF7F2] text-[#7A6A65] border-[#E5DEC9]'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delivery Zone Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-montserrat font-bold text-[#5C4D49]">
                      Select Benin City Area / Zone *
                    </label>
                    <span className="text-[10px] text-[#7A6A65]">
                      {branchMasterZones.length} verified locations
                    </span>
                  </div>

                  <select
                    value={formData.deliveryZone}
                    onChange={(e) => {
                      setFormData({ ...formData, deliveryZone: e.target.value });
                      setSelectedDeliveryZone(e.target.value);
                    }}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2.5 text-xs font-montserrat font-semibold text-[#241311] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                    id="checkout-zone-select"
                  >
                    {branchMasterZones.map((zone) => (
                      <option key={zone.id} value={zone.locationName}>
                        {zone.locationName} — {formatNaira(zone.deliveryFee)} ({zone.estimatedMins})
                      </option>
                    ))}
                  </select>

                  <p className="text-[10px] text-[#7A6A65] font-montserrat mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#E62E00]" />
                    Estimated delivery time: <strong className="text-[#4D080F]">30–90 minutes</strong> across Benin City
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] mb-1 block">
                    Street Address / House / Flat *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Flat 3, Block B, 14 Airport Road"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2.5 text-xs font-montserrat text-[#241311] focus:outline-none focus:ring-2 focus:ring-[#E62E00]"
                    id="checkout-address-input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] mb-1 block">
                      Prominent Landmark
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Opposite Big Church / Fuel Station"
                      value={formData.landmark}
                      onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                      id="checkout-landmark-input"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] mb-1 block">
                      Alternate Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="Optional 2nd phone number"
                      value={formData.alternatePhone}
                      onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                      id="checkout-alt-phone-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] mb-1 block">
                    1. Delivery / Gate Instructions (For Dispatch Rider)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Green gate, call security at estate entrance, ask for Flat 4..."
                    value={formData.deliveryInstructions ?? formData.deliveryNotes ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        deliveryNotes: e.target.value,
                        deliveryInstructions: e.target.value,
                      })
                    }
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                    id="checkout-delivery-notes-input"
                  />
                </div>
              </div>
            )}

            {/* Separated Kitchen Preparation Notes & Special Occasion Request (Available for both Delivery and Pickup) */}
            <div className="space-y-3 pt-2 border-t border-[#F0EAE1]">
              <div>
                <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] mb-1 block">
                  2. Kitchen Preparation Notes (Optional — For Kitchen Team)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Light pepper, sauce on the side, well-done grill..."
                  value={formData.preparationNotes || ''}
                  onChange={(e) => setFormData({ ...formData, preparationNotes: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                  id="checkout-preparation-notes-input"
                />
              </div>

              <div className="bg-[#FFFDF9] p-3 rounded-xl border border-[#E5DEC9] space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-montserrat font-bold text-[#4D080F] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E62E00]" />
                    <span>3. Special Occasion Note (Optional — Birthday / Anniversary / Congrats)</span>
                  </label>
                  <span className="text-[10px] font-montserrat text-[#7A6A65]">
                    {(formData.specialOccasionNote || '').length}/160
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={160}
                  placeholder="e.g. Happy Birthday Osaze! Enjoy your small-chops platter..."
                  value={formData.specialOccasionNote || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, specialOccasionNote: e.target.value.slice(0, 160) })
                  }
                  className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                  id="checkout-special-occasion-note-input"
                />
                <p
                  className="text-[10px] text-[#7A6A65] font-montserrat leading-relaxed"
                  id="checkout-special-occasion-disclaimer"
                >
                  <strong>Please note:</strong> A special-occasion note is a courtesy request for a written message on the package and is <strong>not a guarantee</strong> of a complimentary greeting card, cake decoration, candle, or extra item.
                </p>
              </div>
            </div>

            {/* Remember My Details for Repeat Orders Toggle */}
            <div className="pt-2 border-t border-[#F0EAE1]">
              <label className="flex items-start gap-2.5 cursor-pointer select-none bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DEC9]">
                <input
                  type="checkbox"
                  checked={rememberForNextTime}
                  onChange={(e) => setRememberForNextTime(e.target.checked)}
                  className="mt-0.5 rounded border-[#E5DEC9] text-[#E62E00] focus:ring-[#E62E00]"
                  id="checkout-remember-details-checkbox"
                />
                <div className="text-xs font-montserrat">
                  <span className="font-bold text-[#4D080F] block">
                    Save my contact & delivery details on this device for 1-click repeat ordering
                  </span>
                  <span className="text-[11px] text-[#7A6A65]">
                    Skip typing your name, phone, and address next time you order. Uncheck if using a shared computer.
                  </span>
                </div>
              </label>
            </div>

            {/* Scheduled / Pre-Order Option */}
            <div className="pt-2 border-t border-[#F0EAE1]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#E62E00]" />
                  <span className="text-xs font-montserrat font-bold text-[#4D080F]">
                    Schedule for later / Pre-order?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScheduleExpanded(!isScheduleExpanded)}
                  className="text-xs font-titan text-[#E62E00] underline"
                >
                  {isScheduleExpanded ? 'Deliver ASAP' : 'Pick Time & Date'}
                </button>
              </div>

              {isScheduleExpanded && (
                <div className="mt-3 p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DEC9] space-y-2">
                  <label className="text-[11px] font-montserrat font-bold text-[#5C4D49] block">
                    Choose Delivery / Pickup Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                  />
                  <p className="text-[10px] text-[#7A6A65] font-montserrat">
                    We accept pre-orders up to 7 days in advance for meetings and parties.
                  </p>
                </div>
              )}
            </div>

            {/* Rewards Points notice */}
            {pointsToEarn > 0 && (
              <div className="p-2.5 bg-[#FFF8E7] rounded-xl border border-[#FFC700] flex items-center gap-2 text-xs font-montserrat text-[#4D080F]">
                <Award className="w-4 h-4 text-[#E62E00] shrink-0" />
                <span>
                  You will earn <strong className="text-[#E62E00]">+{pointsToEarn} Enjoyment Points</strong> on this order!
                </span>
              </div>
            )}

            {/* Submit Step 1 */}
            <div className="pt-4 border-t border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center justify-between sm:block">
                <span className="text-[10px] text-[#7A6A65] font-montserrat uppercase font-bold block">
                  ORDER TOTAL
                </span>
                <span className="font-titan text-xl text-[#E62E00]">{formatNaira(cartTotal)}</span>
              </div>

              <button
                type="submit"
                className="bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-sm py-3.5 px-6 rounded-2xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto"
                id="continue-to-payment-btn"
              >
                <span>CONTINUE TO PAYMENT</span>
                <ChevronRight className="w-4 h-4 text-[#FFC700]" />
              </button>
            </div>

          </form>
        )}

        {/* Step 2: Payment Method */}
        {step === 'payment' && (
          <div className="p-5 sm:p-6 space-y-6 flex-1">
            
            {/* Order Review Box */}
            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] space-y-2 text-xs font-montserrat">
              {formData.isGiftOrder ? (
                <>
                  <div className="flex items-center justify-between font-bold text-[#4D080F]">
                    <span>🎁 Gift Recipient:</span>
                    <span className="text-[#241311]">
                      {formData.recipientName} ({formData.recipientPhone})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#7A6A65]">
                    <span>Ordered By (Buyer):</span>
                    <span className="text-[#241311]">
                      {formData.customerName} ({formData.customerPhone})
                    </span>
                  </div>
                  {formData.giftMessage && (
                    <div className="p-2 bg-[#FFF8E7] rounded-xl border border-[#FFC700]/60 text-[11px] text-[#4D080F]">
                      <strong>Gift Note:</strong> &ldquo;{formData.giftMessage}&rdquo; —{' '}
                      <em>
                        {formData.hideSenderIdentity
                          ? 'Anonymous Sender'
                          : formData.senderName || formData.customerName}
                      </em>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between font-bold text-[#4D080F]">
                  <span>Delivering to:</span>
                  <span className="text-[#241311]">
                    {formData.customerName} ({formData.customerPhone})
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-[#7A6A65]">
                <span>Address / Area:</span>
                <span className="text-[#241311]">{formData.address || currentBranch.address}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#E5DEC9] font-titan text-sm text-[#E62E00]">
                <span>Amount to Pay:</span>
                <span className="text-base">{formatNaira(cartTotal)}</span>
              </div>
            </div>

            {/* Payment Methods Selection */}
            <div className="space-y-3">
              <label className="font-titan text-xs text-[#4D080F] uppercase tracking-wider block">
                CHOOSE PAYMENT METHOD
              </label>

              {/* 1. Card Gateway */}
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                  paymentMethod === 'card'
                    ? 'border-[#E62E00] bg-[#FFF8E7] shadow-xs'
                    : 'border-[#E5DEC9] bg-[#FAF7F2] hover:bg-white'
                }`}
                id="pay-method-card"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#E5DEC9] flex items-center justify-center text-[#E62E00]">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-titan text-xs sm:text-sm text-[#241311]">Debit / Credit Card</p>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                        Fastest
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7A6A65] font-montserrat">
                      Mastercard, Visa, Verve (Instant Confirmation)
                    </p>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === 'card' ? 'bg-[#E62E00] border-[#E62E00]' : 'border-gray-400'
                  }`}
                >
                  {paymentMethod === 'card' && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
              </button>

              {/* 2. Direct Bank Transfer */}
              <button
                type="button"
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                  paymentMethod === 'bank_transfer'
                    ? 'border-[#E62E00] bg-[#FFF8E7] shadow-xs'
                    : 'border-[#E5DEC9] bg-[#FAF7F2] hover:bg-white'
                }`}
                id="pay-method-transfer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#E5DEC9] flex items-center justify-center text-[#4D080F]">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-titan text-xs sm:text-sm text-[#241311]">Bank Transfer / USSD</p>
                    <p className="text-[11px] text-[#7A6A65] font-montserrat">
                      Virtual dynamic dedicated account generated
                    </p>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === 'bank_transfer' ? 'bg-[#E62E00] border-[#E62E00]' : 'border-gray-400'
                  }`}
                >
                  {paymentMethod === 'bank_transfer' && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
              </button>

              {/* Bank transfer info if selected (Never displays fabricated accounts) */}
              {paymentMethod === 'bank_transfer' && (
                <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] space-y-3 text-xs font-montserrat animate-in fade-in duration-150">
                  {bankTransferConfig?.configured ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-[#4D080F]">Configured Corporate Bank Transfer Account:</p>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Requires Cashier Confirmation
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-[#E5DEC9] space-y-1">
                        <p className="text-[11px] text-[#7A6A65]">
                          Bank: <strong className="text-[#241311]">{bankTransferConfig.bankName}</strong>
                        </p>
                        <p className="font-titan text-base text-[#E62E00] tracking-wider">
                          {bankTransferConfig.accountNumber}
                        </p>
                        <p className="text-[11px] text-[#7A6A65]">
                          Account Name: <strong className="text-[#241311]">{bankTransferConfig.accountName}</strong>
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Your Transfer Reference / Session ID"
                          value={transferReferenceInput}
                          onChange={(e) => setTransferReferenceInput(e.target.value)}
                          className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                          id="checkout-transfer-reference-input"
                        />
                        <input
                          type="text"
                          placeholder="Sender Bank Name"
                          value={payerBankInput}
                          onChange={(e) => setPayerBankInput(e.target.value)}
                          className="w-full bg-white border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs font-montserrat text-[#241311]"
                          id="checkout-transfer-bank-input"
                        />
                      </div>
                      <p className="text-[10px] text-[#7A6A65]">
                        {bankTransferConfig.instructions}
                      </p>
                    </>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-950 space-y-1">
                      <p className="font-bold text-xs">Direct Manual Bank Account Not Configured</p>
                      <p className="text-[11px] leading-relaxed">
                        {bankTransferConfig?.instructions ||
                          'Direct corporate bank account details have not yet been configured by the administrator. If you place this order as a Bank Transfer, our cashier team will contact you to reconcile payment before dispatch, or you can select Card (Paystack Transfer/Card) or Pay on Delivery.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Cash or POS on Delivery */}
              <button
                type="button"
                onClick={() => setPaymentMethod('pos_on_delivery')}
                className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                  paymentMethod === 'pos_on_delivery'
                    ? 'border-[#E62E00] bg-[#FFF8E7] shadow-xs'
                    : 'border-[#E5DEC9] bg-[#FAF7F2] hover:bg-white'
                }`}
                id="pay-method-pos"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#E5DEC9] flex items-center justify-center text-emerald-700">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-titan text-xs sm:text-sm text-[#241311]">Pay on Delivery (POS Card / Cash)</p>
                    <p className="text-[11px] text-[#7A6A65] font-montserrat">
                      Pay rider upon arrival at your doorstep
                    </p>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === 'pos_on_delivery' ? 'bg-[#E62E00] border-[#E62E00]' : 'border-gray-400'
                  }`}
                >
                  {paymentMethod === 'pos_on_delivery' && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
              </button>
            </div>

            {/* Fallback WhatsApp Button in case user prefers manual agent checkout */}
            <div className="bg-[#FFF8E7] p-3.5 rounded-2xl border border-[#FFC700] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#25D366] fill-[#25D366]" />
                <span className="text-xs font-montserrat font-bold text-[#4D080F]">
                  Prefer to pay via WhatsApp?
                </span>
              </div>
              <a
                href={getBranchWhatsAppUrl(selectedBranchId, generateWhatsAppCartText(cart, formData.address))}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-titan text-[#006039] bg-white px-3 py-1.5 rounded-xl border border-[#25D366] hover:bg-[#25D366]/10"
              >
                Chat on WhatsApp →
              </a>
            </div>

            {/* Chowdeck-Inspired "Pay For Me" Shareable Link */}
            <div className="bg-[#EBF9F3] p-3.5 rounded-2xl border border-[#43E29F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#006039] shrink-0" />
                <div>
                  <p className="text-xs font-montserrat font-bold text-[#006039]">
                    Want Someone Else to Pay? ("Pay For Me")
                  </p>
                  <p className="text-[10px] text-[#006039]/80">
                    Send order summary & payment link to a sponsor via WhatsApp
                  </p>
                </div>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Hello! Please can you help me pay for my Choplife Republic order? Total: ₦${cartTotal.toLocaleString()} at ${currentBranch.name}. Order items:\n` +
                  cart.map(i => `• ${i.product.name} (x${i.quantity}) - ₦${(i.unitPrice * i.quantity).toLocaleString()}`).join('\n') +
                  `\nThank you so much! ❤️`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-titan text-white bg-[#006039] hover:bg-[#005030] px-3 py-1.5 rounded-xl shadow-xs transition-transform active:scale-95 whitespace-nowrap"
                id="pay-for-me-whatsapp-btn"
              >
                Send Pay-For-Me Link 🔗
              </a>
            </div>

            {/* Branch Closed Warning Banner */}
            {(() => {
              const branchStatus = evaluateBranchOperatingStatus(selectedBranchId);
              const errMsg = branchClosedError || (!branchStatus.isOpen ? `${branchStatus.reason} ${branchStatus.nextOpenNotice || ''}` : null);
              if (errMsg) {
                return (
                  <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>{currentBranch.shortName} Ordering Currently Closed</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-snug">{errMsg}</p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Final Pay Action */}
            <div className="pt-4 border-t border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center justify-between sm:block">
                <span className="text-[10px] text-[#7A6A65] font-montserrat uppercase font-bold block">
                  TOTAL DUE
                </span>
                <span className="font-titan text-xl text-[#E62E00]">{formatNaira(cartTotal)}</span>
              </div>

              {(() => {
                const branchStatus = evaluateBranchOperatingStatus(selectedBranchId);
                const isOpen = branchStatus.isOpen;
                return (
                  <button
                    onClick={isOpen ? handleCompleteOrder : undefined}
                    disabled={!isOpen}
                    className={`font-titan text-sm sm:text-base py-3.5 px-6 rounded-2xl shadow-xl transition-transform flex items-center justify-center gap-2 w-full sm:w-auto ${
                      isOpen
                        ? 'bg-[#E62E00] hover:bg-[#C92200] text-white active:scale-95 cursor-pointer'
                        : 'bg-stone-300 text-stone-600 cursor-not-allowed shadow-none'
                    }`}
                    id="place-final-order-btn"
                  >
                    <ShieldCheck className={`w-5 h-5 ${isOpen ? 'text-[#FFC700]' : 'text-stone-500'}`} />
                    <span>{isOpen ? 'CONFIRM & PLACE ORDER' : 'BRANCH CLOSED'}</span>
                  </button>
                );
              })()}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
