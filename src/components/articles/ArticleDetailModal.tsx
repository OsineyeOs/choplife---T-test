import React from 'react';
import { Article } from '../../data/articles';
import { X, Clock, Share2, Tag, ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ArticleDetailModalProps {
  article: Article | null;
  onClose: () => void;
}

export const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({ article, onClose }) => {
  const { products, setSelectedProductForDetail, formatNaira } = useApp();

  if (!article) return null;

  const relatedProducts = (article.relatedProductIds || [])
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean);

  const handleShare = async () => {
    const shareData = {
      title: `${article.title} | Choplife Republic`,
      text: article.summary,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Article link copied to clipboard!');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      id="article-detail-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E5DEC9] flex flex-col justify-between">
        
        {/* Header Image & Close */}
        <div className="relative h-56 sm:h-64 w-full overflow-hidden rounded-t-3xl bg-[#4D080F]">
          <img
            src={article.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
            alt={article.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-xs transition-colors"
            id="close-article-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-titan uppercase tracking-widest bg-[#E62E00] text-white px-2.5 py-0.5 rounded-full">
                {article.category}
              </span>
              <span className="text-xs text-white/80 font-montserrat flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#FFC700]" />
                {article.readTime}
              </span>
            </div>
            <h2 className="font-titan text-xl sm:text-2xl text-white leading-tight drop-shadow-sm">
              {article.title}
            </h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-7 space-y-6 flex-1 overflow-y-auto">
          
          {/* Subtitle & Author Meta */}
          <div className="pb-4 border-b border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-montserrat font-bold text-[#4D080F]">
                By {article.author}
              </p>
              <p className="text-[11px] text-[#7A6A65] font-montserrat">
                Published {article.publishedDate} • Choplife Republic Benin City
              </p>
            </div>

            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F0EAE1] text-[#4D080F] border border-[#E5DEC9] text-xs font-montserrat font-bold transition-all w-fit"
            >
              <Share2 className="w-3.5 h-3.5 text-[#E62E00]" />
              <span>Share Article</span>
            </button>
          </div>

          {/* Article Summary Lead */}
          <p className="text-sm font-montserrat font-semibold text-[#4D080F] bg-[#FFF8E7] p-3.5 rounded-2xl border border-[#FFC700]/50 leading-relaxed">
            {article.summary}
          </p>

          {/* Paragraphs */}
          <div className="space-y-4 text-xs sm:text-sm text-[#241311] font-montserrat leading-relaxed">
            {article.content.map((paragraph, idx) => (
              <p key={idx} className="leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Tags */}
          <div className="pt-3 border-t border-[#E5DEC9] flex flex-wrap gap-1.5">
            {article.tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[10px] font-montserrat font-bold bg-[#FAF7F2] text-[#7A6A65] border border-[#E5DEC9] px-2.5 py-1 rounded-lg"
              >
                <Tag className="w-3 h-3 text-[#E62E00]" />
                {tag}
              </span>
            ))}
          </div>

          {/* Related Dishes from Menu */}
          {relatedProducts.length > 0 && (
            <div className="pt-4 border-t border-[#E5DEC9] space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-titan uppercase tracking-wide text-[#4D080F]">
                <Sparkles className="w-3.5 h-3.5 text-[#E62E00]" />
                <span>Featured Dishes Mentioned In This Article</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedProducts.map((prod: any) => (
                  <div
                    key={prod.id}
                    onClick={() => {
                      onClose();
                      setSelectedProductForDetail(prod);
                    }}
                    className="p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] hover:border-[#FFC700] cursor-pointer flex items-center gap-3 transition-all hover:shadow-xs group"
                  >
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-titan text-xs text-[#241311] group-hover:text-[#E62E00] truncate">
                        {prod.name}
                      </p>
                      <p className="text-[11px] font-bold text-[#E62E00]">
                        {formatNaira(prod.basePrice)}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#7A6A65] group-hover:translate-x-1 transition-transform shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF7F2] border-t border-[#E5DEC9] flex items-center justify-between text-xs font-montserrat">
          <span className="text-[#7A6A65]">
            Choplife Republic • 100% Maximum Enjoyment
          </span>
          <button
            onClick={onClose}
            className="bg-[#4D080F] text-white font-titan text-xs px-4 py-2 rounded-xl"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
