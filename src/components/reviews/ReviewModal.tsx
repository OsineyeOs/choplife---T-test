import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Star,
  CheckCircle2,
  MessageSquare,
  Utensils,
  Truck,
  HeartHandshake,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const PRODUCT_REVIEW_TAGS = [
  'Great taste',
  'Fresh',
  'Well prepared',
  'Good portion size',
  'Well presented',
  'Good value',
  'Good packaging',
  'As described',
  'Not as expected',
  'Quality concern',
] as const;

export const DELIVERY_REVIEW_TAGS = [
  'Arrived on time',
  'Fast delivery',
  'Order arrived safely',
  'Rider was polite',
  'Good delivery updates',
  'Packaging was secure',
  'Delivery was delayed',
  'Item was missing',
  'Packaging was damaged',
  'Order arrived in poor condition',
] as const;

export const SERVICE_REVIEW_TAGS = [
  'Helpful staff',
  'Friendly service',
  'Professional communication',
  'Quick response',
  'Issue resolved',
  'Easy ordering process',
  'Clear communication',
  'Service improvement needed',
] as const;

export const ReviewModal: React.FC = () => {
  const {
    isReviewModalOpen,
    setIsReviewModalOpen,
    addReview,
    selectedBranchId,
    customerProfile,
    orders,
  } = useApp();

  // Do NOT preselect 5 stars (Part N3)
  const [orderReference, setOrderReference] = useState('');
  const [customerName, setCustomerName] = useState(customerProfile.name || '');
  const [isPublicDisplayName, setIsPublicDisplayName] = useState(true);

  const [productRating, setProductRating] = useState<number>(0);
  const [selectedProductTags, setSelectedProductTags] = useState<string[]>([]);

  const [deliveryRating, setDeliveryRating] = useState<number>(0);
  const [selectedDeliveryTags, setSelectedDeliveryTags] = useState<string[]>([]);

  const [serviceRating, setServiceRating] = useState<number>(0);
  const [selectedServiceTags, setSelectedServiceTags] = useState<string[]>([]);

  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Pre-populate order reference from latest completed/delivered order if available
  useEffect(() => {
    if (!isReviewModalOpen) return;
    if (customerProfile.name && !customerName) {
      setCustomerName(customerProfile.name);
    }
    const completedOrder = orders.find(
      (o) =>
        (o as any).paymentStatus === 'paid' &&
        ((o as any).status === 'delivered' || (o as any).status === 'completed')
    );
    if (completedOrder && !orderReference) {
      setOrderReference((completedOrder as any).orderNumber || completedOrder.id);
    }
  }, [isReviewModalOpen, orders, customerProfile.name]);

  if (!isReviewModalOpen) return null;

  const toggleTag = (tag: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  };

  const handleClose = () => {
    setIsReviewModalOpen(false);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!orderReference.trim()) {
      setErrorMessage('Please enter your completed Choplife Order Number (e.g. ORD-...) to verify your purchase.');
      return;
    }

    if (productRating === 0 && deliveryRating === 0 && serviceRating === 0) {
      setErrorMessage('Please select at least one star rating (Product, Delivery, or Customer Service).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderReference.trim(),
          customerName: customerName.trim() || 'Verified Customer',
          customerPhone: customerProfile.phone || '',
          productRating: productRating > 0 ? productRating : null,
          productTags: selectedProductTags,
          deliveryRating: deliveryRating > 0 ? deliveryRating : null,
          deliveryTags: selectedDeliveryTags,
          serviceRating: serviceRating > 0 ? serviceRating : null,
          serviceTags: selectedServiceTags,
          comment: comment.trim(),
          isPublicDisplayName,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(
          data.error ||
            'Only paid and fulfilled (completed or delivered) orders are eligible for verified reviews.'
        );
        setSubmitting(false);
        return;
      }

      const activeRatings = [productRating, deliveryRating, serviceRating].filter((r) => r > 0);
      const avgRating =
        activeRatings.length > 0
          ? Math.round(activeRatings.reduce((a, b) => a + b, 0) / activeRatings.length)
          : 5;

      addReview({
        customerName: isPublicDisplayName ? customerName.trim() || 'Verified Customer' : 'Verified Customer',
        branchId: selectedBranchId,
        rating: avgRating,
        comment:
          comment.trim() ||
          [...selectedProductTags, ...selectedDeliveryTags, ...selectedServiceTags].join(' • ') ||
          'Verified order rating',
        verified: true,
      } as any);

      setSubmitted(true);
      setSubmitting(false);
      setTimeout(() => {
        setSubmitted(false);
        setProductRating(0);
        setDeliveryRating(0);
        setServiceRating(0);
        setSelectedProductTags([]);
        setSelectedDeliveryTags([]);
        setSelectedServiceTags([]);
        setComment('');
        setIsReviewModalOpen(false);
      }, 1600);
    } catch {
      setErrorMessage('Network error while verifying order. Please try again.');
      setSubmitting(false);
    }
  };

  const renderStarPicker = (
    value: number,
    onChange: (val: number) => void,
    idPrefix: string,
    label: string
  ) => (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          id={`${idPrefix}-star-${star}`}
          aria-label={`${label}: ${star} out of 5 stars`}
          onClick={() => onChange(value === star ? 0 : star)}
          className="p-1 transition-transform hover:scale-110 cursor-pointer"
        >
          <Star
            className={`w-6 h-6 ${
              star <= value ? 'text-[#FFC700] fill-[#FFC700]' : 'text-[#D1C7BD]'
            }`}
          />
        </button>
      ))}
      <span className="text-xs font-montserrat font-bold text-[#7A6A65] ml-1">
        {value > 0 ? `${value}/5` : 'Optional'}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={handleClose} />

      <div
        className="relative w-full max-w-2xl bg-[#FAF7F2] rounded-3xl shadow-2xl border-2 border-[#4D080F] overflow-hidden z-10 max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
      >
        {/* Header */}
        <div className="bg-[#4D080F] text-white p-5 flex items-center justify-between border-b border-[#6A040F] shrink-0">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-[#FFC700]" />
            <div>
              <h2 id="review-modal-title" className="font-titan text-lg tracking-wide">
                RATE YOUR CHOPLIFE ORDER
              </h2>
              <p className="text-[11px] text-white/75 font-montserrat flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FFC700]" />
                Verified Purchase Feedback • Rate Product, Delivery & Customer Service
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close review modal"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-titan text-xl text-[#4D080F]">THANK YOU FOR YOUR VERIFIED REVIEW!</h3>
            <p className="text-xs text-[#7A6A65] font-montserrat">
              Your feedback has been verified against your completed order and recorded.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto">
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs font-montserrat font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Order Reference & Customer Display Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-[#E5DEC9]">
              <div>
                <label className="text-xs font-bold text-[#4D080F] font-montserrat block mb-1">
                  Completed Order Number *
                </label>
                <input
                  type="text"
                  required
                  value={orderReference}
                  onChange={(e) => setOrderReference(e.target.value)}
                  placeholder="e.g. ORD-..."
                  id="review-order-id-input"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-sm font-montserrat focus:outline-none focus:border-[#E62E00]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#4D080F] font-montserrat block mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Osaze O."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-sm font-montserrat focus:outline-none focus:border-[#E62E00]"
                />
                <label className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] text-[#5C4D49] font-montserrat cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublicDisplayName}
                    onChange={(e) => setIsPublicDisplayName(e.target.checked)}
                    className="rounded border-[#D1C7BD] text-[#E62E00]"
                  />
                  <span>Show my name publicly on review</span>
                </label>
              </div>
            </div>

            {/* 1. PRODUCT RATING & TAGS */}
            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-[#E62E00]" />
                  <span className="font-titan text-sm text-[#4D080F]">1. FOOD & PRODUCT QUALITY</span>
                </div>
                {renderStarPicker(productRating, setProductRating, 'review-product', 'Product Rating')}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PRODUCT_REVIEW_TAGS.map((tag) => {
                  const active = selectedProductTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag, selectedProductTags, setSelectedProductTags)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-montserrat font-semibold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#E62E00] text-white border-[#E62E00]'
                          : 'bg-[#FAF7F2] text-[#4D080F] border-[#E5DEC9] hover:border-[#E62E00]/50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. DELIVERY RATING & TAGS */}
            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#E62E00]" />
                  <span className="font-titan text-sm text-[#4D080F]">2. DELIVERY EXPERIENCE</span>
                </div>
                {renderStarPicker(deliveryRating, setDeliveryRating, 'review-delivery', 'Delivery Rating')}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DELIVERY_REVIEW_TAGS.map((tag) => {
                  const active = selectedDeliveryTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag, selectedDeliveryTags, setSelectedDeliveryTags)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-montserrat font-semibold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#E62E00] text-white border-[#E62E00]'
                          : 'bg-[#FAF7F2] text-[#4D080F] border-[#E5DEC9] hover:border-[#E62E00]/50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. CUSTOMER SERVICE RATING & TAGS */}
            <div className="bg-white p-4 rounded-2xl border border-[#E5DEC9] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-[#E62E00]" />
                  <span className="font-titan text-sm text-[#4D080F]">3. CUSTOMER SERVICE</span>
                </div>
                {renderStarPicker(serviceRating, setServiceRating, 'review-service', 'Customer Service Rating')}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SERVICE_REVIEW_TAGS.map((tag) => {
                  const active = selectedServiceTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag, selectedServiceTags, setSelectedServiceTags)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-montserrat font-semibold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#E62E00] text-white border-[#E62E00]'
                          : 'bg-[#FAF7F2] text-[#4D080F] border-[#E5DEC9] hover:border-[#E62E00]/50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Written Comment */}
            <div>
              <label className="text-xs font-bold text-[#4D080F] font-montserrat block mb-1">
                Additional Comments (Optional)
              </label>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share any additional feedback about your meal, packaging, or delivery..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5DEC9] text-sm font-montserrat focus:outline-none focus:border-[#E62E00]"
              />
            </div>

            {/* Action Buttons: Skip vs Submit */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                id="skip-review-btn"
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white hover:bg-[#F2ECE1] text-[#5C4D49] border border-[#E5DEC9] font-montserrat font-bold text-xs cursor-pointer"
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={submitting}
                id="submit-verified-review-btn"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#E62E00] hover:bg-[#C92200] disabled:bg-stone-400 text-white font-titan text-xs sm:text-sm shadow-lg transition-all cursor-pointer"
              >
                {submitting ? 'VERIFYING ORDER...' : 'SUBMIT VERIFIED REVIEW'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
