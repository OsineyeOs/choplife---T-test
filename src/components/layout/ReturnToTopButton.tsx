import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export const ReturnToTopButton: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 360);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      id="return-to-top-btn"
      aria-label="Return to top"
      title="Return to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 sm:bottom-6 left-4 sm:left-6 z-40 inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-full bg-[#241311]/95 hover:bg-[#E62E00] text-white text-xs font-montserrat font-bold shadow-2xl border border-stone-600 transition-all cursor-pointer active:scale-95 hover:shadow-orange-500/20"
    >
      <ArrowUp className="w-4 h-4 text-[#FFC700]" />
      <span className="hidden sm:inline">Top</span>
    </button>
  );
};
