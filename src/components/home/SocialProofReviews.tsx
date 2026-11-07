import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Star, Award, CheckCircle2, ExternalLink, Heart, MessageSquarePlus } from 'lucide-react';

interface ApiVerifiedReview {
  id: string;
  orderId: string;
  customerName: string;
  branchId: string;
  productRating?: number | null;
  productTags?: string[];
  deliveryRating?: number | null;
  deliveryTags?: string[];
  serviceRating?: number | null;
  serviceTags?: string[];
  rating: number;
  comment: string;
  verified: boolean;
  date: string;
}

export const SocialProofReviews: React.FC = () => {
  const { reviews, currentBranch, setIsReviewModalOpen } = useApp();
  const [serverReviews, setServerReviews] = useState<ApiVerifiedReview[]>([]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/reviews')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data || !Array.isArray(data.reviews)) return;
        setServerReviews(data.reviews);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [reviews.length]);

  const combinedReviews =
    serverReviews.length > 0
      ? serverReviews.map((r) => ({
          id: r.id,
          customerName: r.customerName,
          ratingOverall: r.rating,
          comment:
            r.comment ||
            [...(r.productTags || []), ...(r.deliveryTags || []), ...(r.serviceTags || [])].join(' • ') ||
            'Verified Choplife order rating',
          tags: [...(r.productTags || []), ...(r.deliveryTags || []), ...(r.serviceTags || [])],
          verified: true,
          date: new Date(r.date).toLocaleDateString('en-NG', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        }))
      : reviews.map((r) => ({
          id: r.id,
          customerName: r.customerName,
          ratingOverall: r.ratingOverall,
          comment: r.comment,
          tags: [] as string[],
          verified: r.verified,
          date: r.date,
        }));

  const averageRating =
    combinedReviews.length > 0
      ? (combinedReviews.reduce((acc, r) => acc + r.ratingOverall, 0) / combinedReviews.length).toFixed(1)
      : null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" id="social-proof-reviews">
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#E5DEC9] shadow-sm space-y-8">
        {/* Rating Header Badge */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-[#F0EAE1]">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#FFC700]/20 text-[#4D080F] px-3 py-1 rounded-full text-xs font-titan tracking-wider uppercase mb-1">
              <Award className="w-3.5 h-3.5 text-[#E62E00]" />
              VERIFIED CUSTOMER FEEDBACK & REVIEWS
            </div>
            <h2 className="font-titan text-2xl sm:text-3xl text-[#4D080F] tracking-tight">
              LOVED BY BENIN CITY
            </h2>
            <p className="text-xs sm:text-sm text-[#7A6A65] font-montserrat">
              Verified post-order ratings across Product, Delivery, and Customer Service at GRA, Okabere, and Ugbowo.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-[#FAF7F2] p-4 rounded-2xl border border-[#E5DEC9] shrink-0">
            {averageRating ? (
              <div className="text-center">
                <span className="font-titan text-3xl text-[#E62E00] leading-none block">{averageRating}</span>
                <div className="flex items-center gap-0.5 text-[#FFC700] mt-1 justify-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < Math.round(Number(averageRating))
                          ? 'fill-[#FFC700] text-[#FFC700]'
                          : 'text-[#D1C7BD]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Heart className="w-8 h-8 text-[#E62E00] mx-auto" />
                <span className="text-[10px] font-bold text-[#7A6A65] uppercase mt-1 block">Fresh Kitchen</span>
              </div>
            )}
            <div className="h-10 w-px bg-[#E5DEC9]" />
            <div className="text-xs font-montserrat text-[#5C4D49]">
              <p className="font-bold text-[#241311]">
                {combinedReviews.length > 0
                  ? `${combinedReviews.length} Verified ${combinedReviews.length === 1 ? 'Review' : 'Reviews'}`
                  : 'Verified Order Reviews'}
              </p>
              <a
                href={currentBranch.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E62E00] font-bold hover:underline flex items-center gap-1 mt-0.5"
              >
                <span>View Google Maps Profile</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Reviews Cards or Empty State */}
        {combinedReviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {combinedReviews.slice(0, 6).map((rev) => (
              <div
                key={rev.id}
                className="bg-[#FAF7F2] rounded-2xl p-5 border border-[#E5DEC9] space-y-3 flex flex-col justify-between"
                id={`review-card-${rev.id}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[#FFC700]">
                      {[...Array(Math.max(1, Math.min(5, rev.ratingOverall)))].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-[#FFC700]" />
                      ))}
                    </div>
                    <span className="text-[10px] font-montserrat text-[#7A6A65]">{rev.date}</span>
                  </div>

                  {rev.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rev.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-montserrat font-bold bg-[#FFF8E7] text-[#4D080F] border border-[#FFC700]/50 px-2 py-0.5 rounded-md"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {rev.comment && (
                    <p className="text-xs sm:text-sm text-[#241311] font-montserrat leading-relaxed italic">
                      &ldquo;{rev.comment}&rdquo;
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E5DEC9]/60 flex items-center justify-between text-xs font-montserrat">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-[#E62E00]/10 text-[#E62E00] font-titan text-[10px] flex items-center justify-center">
                      {rev.customerName ? rev.customerName[0] : 'G'}
                    </div>
                    <span className="font-bold text-[#4D080F]">{rev.customerName || 'Guest'}</span>
                  </div>

                  {rev.verified && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Verified Purchase
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 px-4 bg-[#FAF7F2] rounded-2xl border border-dashed border-[#D1C7BD] space-y-3">
            <MessageSquarePlus className="w-10 h-10 text-[#E62E00] mx-auto opacity-70" />
            <h3 className="font-titan text-base text-[#4D080F]">No verified reviews yet</h3>
            <p className="text-xs text-[#7A6A65] font-montserrat max-w-md mx-auto">
              Completed a Choplife Republic order recently? Rate our food quality, delivery speed, and customer service using your order number.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-[#F0EAE1] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-montserrat text-[#5C4D49]">
            <Heart className="w-4 h-4 text-[#E62E00] fill-[#E62E00]" />
            <span>Every review is verified against a paid and fulfilled Choplife Republic order.</span>
          </div>

          <button
            type="button"
            onClick={() => setIsReviewModalOpen(true)}
            className="w-full sm:w-auto bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-titan text-xs px-5 py-3 rounded-xl shadow-sm transition-transform active:scale-95 cursor-pointer"
            id="open-review-modal-btn"
          >
            + RATE A COMPLETED ORDER
          </button>
        </div>
      </div>
    </section>
  );
};
