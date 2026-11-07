import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, LanguageCode } from '../../context/LanguageContext';
import { Globe, ChevronDown, Check } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'compact' | 'full' | 'header';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { language, setLanguage, currentLanguageOption, languages, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectLanguage = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef} id="language-switcher-container">
      {/* Trigger Button */}
      {variant === 'header' ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[#FAF7F2] border border-white/20 text-[11px] font-montserrat font-bold transition-all shadow-2xs hover:border-[#FFC700] active:scale-95"
          id="language-switcher-header-btn"
          aria-expanded={isOpen}
          aria-haspopup="true"
          title="Change language / Yi èdè padà / Tòrò ẹvbe"
        >
          <span className="text-xs">{currentLanguageOption.flag}</span>
          <span className="uppercase text-[10px] tracking-wider text-[#FFC700]">
            {currentLanguageOption.code}
          </span>
          <ChevronDown className={`w-3 h-3 text-[#FFC700] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#E5DEC9] text-[#4D080F] text-xs font-montserrat font-bold transition-all shadow-2xs hover:border-[#E62E00] active:scale-95"
          id="language-switcher-btn"
          aria-expanded={isOpen}
          aria-haspopup="true"
          title="Select display language"
        >
          <Globe className="w-3.5 h-3.5 text-[#E62E00]" />
          <span className="text-sm leading-none">{currentLanguageOption.flag}</span>
          <span className="hidden md:inline font-bold text-xs text-[#241311]">
            {currentLanguageOption.label}
          </span>
          <span className="md:hidden uppercase text-[11px] font-bold text-[#241311]">
            {currentLanguageOption.code}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-[#7A6A65] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Floating Menu - Clamped within screen width on mobile (max-w-[calc(100vw-1.5rem)]) */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-[#E5DEC9] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${
            variant === 'header' ? 'right-0 origin-top-right' : 'right-0'
          }`}
          role="menu"
          aria-orientation="vertical"
          id="language-dropdown-menu"
        >
          <div className="px-3.5 py-2 border-b border-[#F0EAE1]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-titan uppercase tracking-wider text-[#4D080F]">
                CHOPLIFE LANGUAGE
              </span>
              <span className="text-[10px] text-[#7A6A65] font-montserrat">
                5 Languages
              </span>
            </div>
            <p className="text-[11px] text-[#7A6A65] font-montserrat mt-0.5">
              Select your preferred language
            </p>
          </div>

          <div className="p-1 space-y-1 max-h-72 overflow-y-auto">
            {languages.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors font-montserrat ${
                    isSelected
                      ? 'bg-[#FFF8E7] text-[#4D080F] font-bold border border-[#FFC700]/50'
                      : 'hover:bg-[#FAF7F2] text-[#241311]'
                  }`}
                  role="menuitem"
                  id={`language-option-${lang.code}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{lang.flag}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate">{lang.nativeName}</span>
                        <span className="text-[10px] font-mono text-[#7A6A65] uppercase px-1 py-0.2 bg-gray-100 rounded shrink-0">
                          {lang.code}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#7A6A65] truncate">{lang.region}</p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[#E62E00] text-white flex items-center justify-center shrink-0 ml-2">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="px-3 py-2 bg-[#FAF7F2] border-t border-[#F0EAE1] rounded-b-xl text-[10px] text-[#7A6A65] text-center font-montserrat">
            Choplife Republic • Benin City, Edo State
          </div>
        </div>
      )}
    </div>
  );
};
