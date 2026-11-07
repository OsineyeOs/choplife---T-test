import React from 'react';

interface BrandLogoProps {
  className?: string;
  variant?: 'full' | 'compact' | 'icon-only' | 'badge';
  theme?: 'default' | 'light' | 'white' | 'dark' | 'yellow';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  variant = 'full',
  theme = 'default',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-8 sm:h-11',
    lg: 'h-16',
    xl: 'h-24',
  };

  const getColors = () => {
    switch (theme) {
      case 'white':
        return {
          flag: '#FFFFFF',
          utensils: '#6A040F',
          textMain: '#FFFFFF',
          textStar: '#FFC700',
          textSub: '#FFFFFF',
        };
      case 'light':
        return {
          flag: '#FFC700',
          utensils: '#4D080F',
          textMain: '#FFFFFF',
          textStar: '#FFC700',
          textSub: '#FDE047',
        };
      case 'dark':
        return {
          flag: '#FFC700',
          utensils: '#4D080F',
          textMain: '#FFFFFF',
          textStar: '#FFC700',
          textSub: '#D1D5DB',
        };
      case 'yellow':
        return {
          flag: '#E62E00',
          utensils: '#FFFFFF',
          textMain: '#4D080F',
          textStar: '#E62E00',
          textSub: '#4D080F',
        };
      default:
        return {
          flag: '#FFC700',
          utensils: '#6A040F',
          textMain: '#E62E00',
          textStar: '#4D080F',
          textSub: '#6A040F',
        };
    }
  };

  const colors = getColors();

  if (variant === 'icon-only') {
    return (
      <div className={`inline-flex items-center justify-center ${sizeClasses[size]} ${className}`} id="brand-logo-icon">
        <svg viewBox="0 0 100 80" className="h-full w-auto filter drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Flag Pole */}
          <path d="M22 10 L22 75" stroke={colors.textMain} strokeWidth="4" strokeLinecap="round" />
          <circle cx="22" cy="9" r="4" fill={colors.flag} />
          {/* Wavy Flag */}
          <path
            d="M24 14 C36 12 44 20 60 16 C76 12 84 18 86 16 L84 52 C72 56 62 48 46 52 C32 56 24 50 24 50 Z"
            fill={colors.flag}
          />
          {/* Dripping sauce under flag */}
          <path
            d="M38 52 C38 60 41 64 43 64 C45 64 46 59 46 52"
            fill={colors.flag}
          />
          {/* Crossed Fork & Spoon */}
          {/* Fork */}
          <path
            d="M48 24 L62 42 M51 22 L46 29 M54 25 L49 32 M57 28 L52 35"
            stroke={colors.utensils}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Spoon */}
          <path
            d="M62 24 L48 42 M60 22 C64 26 62 30 58 30 C54 30 56 24 60 22 Z"
            stroke={colors.utensils}
            strokeWidth="3.5"
            fill={colors.utensils}
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 bg-[#4D080F] text-white px-3 py-1.5 rounded-full shadow-md border border-[#FFC700]/30 ${className}`} id="brand-logo-badge">
        <BrandLogo variant="icon-only" size="sm" />
        <span className="font-titan tracking-wider text-xs uppercase text-[#FFC700]">CHOPLIFE REPUBLIC</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 sm:gap-2.5 select-none ${className}`} id="brand-logo-full">
      {/* SVG Flag Icon */}
      <div className={`${sizeClasses[size]} flex-shrink-0`}>
        <svg viewBox="0 0 100 85" className="h-full w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Flag Pole */}
          <path d="M20 10 L20 78" stroke="#E62E00" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="20" cy="8" r="4.5" fill="#FFC700" stroke="#E62E00" strokeWidth="1.5" />
          {/* Wavy Flag */}
          <path
            d="M22 14 C36 11 46 22 62 17 C78 12 86 19 88 17 L86 54 C72 58 64 49 48 54 C34 58 22 51 22 51 Z"
            fill="#FFC700"
          />
          {/* Dripping sauce */}
          <path
            d="M42 53 C42 66 45 70 47 70 C49 70 51 64 51 53"
            fill="#FFC700"
          />
          {/* Crossed Fork & Spoon */}
          <path
            d="M46 23 L62 44 M49 21 L44 28 M52 24 L47 31 M55 27 L50 34"
            stroke="#6A040F"
            strokeWidth="3.8"
            strokeLinecap="round"
          />
          <path
            d="M62 23 L46 44 M61 21 C65 25 63 30 58 29 C54 28 56 22 61 21 Z"
            stroke="#6A040F"
            strokeWidth="3.8"
            fill="#6A040F"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Typography lockup */}
      <div className="flex flex-col leading-none">
        <span className={`font-titan tracking-tight ${
          theme === 'white' ? 'text-white' : 'text-[#E62E00]'
        } ${size === 'sm' ? 'text-base sm:text-lg' : size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-base sm:text-xl'}`}>
          CHOPLIFE
        </span>
        <div className="flex items-center gap-1">
          <span className={`font-titan text-[9px] sm:text-xs tracking-wider ${
            theme === 'white' ? 'text-[#FFC700]' : 'text-[#4D080F]'
          }`}>
            ★ REPUBLIC ★
          </span>
        </div>
        <span className={`hidden sm:block font-montserrat font-bold text-[8px] uppercase tracking-[0.2em] ${
          theme === 'white' ? 'text-white/80' : 'text-[#6A040F]/80'
        }`}>
          SINCE 2022
        </span>
      </div>
    </div>
  );
};
