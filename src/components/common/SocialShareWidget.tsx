import React, { useState } from 'react';
import { Share2, Check, Copy, MessageCircle } from 'lucide-react';
import { Product } from '../../types';

interface SocialShareWidgetProps {
  product?: Product;
  title?: string;
  description?: string;
  url?: string;
  variant?: 'compact' | 'full' | 'inline';
}

export const SocialShareWidget: React.FC<SocialShareWidgetProps> = ({
  product,
  title,
  description,
  url,
  variant = 'full',
}) => {
  const [copied, setCopied] = useState(false);

  const shareTitle =
    title ||
    (product
      ? `${product.name} at Choplife Republic (Benin City)`
      : 'Choplife Republic | 100% Maximum Enjoyment');

  const shareText =
    description ||
    (product
      ? `Check out ${product.name} (₦${(product.basePrice || product.price || 0).toLocaleString()}) from Choplife Republic in Benin City! 100% Maximum Enjoyment.`
      : 'Enjoy yourself, is that too much to ask? Order small chops, grills, shawarma & 100% bromate-free bread in Benin City!');

  const shareUrl =
    url || (typeof window !== 'undefined' ? window.location.href : 'https://chopliferepublic.ng');

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`${shareText}\n${shareUrl}`);

  // Social share URLs
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodedUrl}&hashtags=ChoplifeRepublic,BeninCityFood`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(shareText)}`;

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1.5" id="social-share-compact">
        <button
          onClick={handleNativeShare}
          className="p-1.5 rounded-xl bg-white/80 hover:bg-white text-[#4D080F] border border-[#E5DEC9] transition-all hover:scale-105 active:scale-95 shadow-2xs"
          title="Share dish"
        >
          <Share2 className="w-3.5 h-3.5 text-[#E62E00]" />
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 transition-all hover:scale-105 active:scale-95 shadow-2xs"
          title="Share on WhatsApp"
        >
          <MessageCircle className="w-3.5 h-3.5 fill-[#25D366]" />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF7F2] p-3.5 sm:p-4 rounded-2xl border border-[#E5DEC9] space-y-2.5" id="social-share-widget">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-titan text-[#4D080F] uppercase tracking-wide">
          <Share2 className="w-3.5 h-3.5 text-[#E62E00]" />
          <span>Share With Friends & Family</span>
        </div>
        {typeof navigator !== 'undefined' && !!(navigator as any).share && (
          <button
            onClick={handleNativeShare}
            className="text-[11px] font-montserrat font-bold text-[#E62E00] hover:underline"
          >
            Quick Share ↗
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {/* WhatsApp */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#006A2E] text-[10px] font-montserrat font-bold transition-all active:scale-95 group"
          title="Share via WhatsApp"
        >
          <span className="text-base group-hover:scale-110 transition-transform">💬</span>
          <span className="mt-0.5 truncate">WhatsApp</span>
        </a>

        {/* X / Twitter */}
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-black/5 hover:bg-black/10 border border-black/10 text-black text-[10px] font-montserrat font-bold transition-all active:scale-95 group"
          title="Share on X (Twitter)"
        >
          <span className="text-base font-bold group-hover:scale-110 transition-transform">𝕏</span>
          <span className="mt-0.5 truncate">X (Twitter)</span>
        </a>

        {/* Facebook */}
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/30 text-[#1877F2] text-[10px] font-montserrat font-bold transition-all active:scale-95 group"
          title="Share on Facebook"
        >
          <span className="text-base font-bold group-hover:scale-110 transition-transform">f</span>
          <span className="mt-0.5 truncate">Facebook</span>
        </a>

        {/* Telegram */}
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#0088CC]/10 hover:bg-[#0088CC]/20 border border-[#0088CC]/30 text-[#0088CC] text-[10px] font-montserrat font-bold transition-all active:scale-95 group"
          title="Share on Telegram"
        >
          <span className="text-base group-hover:scale-110 transition-transform">✈️</span>
          <span className="mt-0.5 truncate">Telegram</span>
        </a>

        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-montserrat font-bold transition-all active:scale-95 ${
            copied
              ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
              : 'bg-white hover:bg-gray-50 border-[#E5DEC9] text-[#4D080F]'
          }`}
          title="Copy link"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in" />
          ) : (
            <Copy className="w-4 h-4 text-[#7A6A65]" />
          )}
          <span className="mt-0.5 truncate">{copied ? 'Copied!' : 'Copy Link'}</span>
        </button>
      </div>
    </div>
  );
};
