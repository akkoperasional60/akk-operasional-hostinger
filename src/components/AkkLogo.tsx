import React, { useId } from 'react';

interface AkkLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  subtitle?: string;
  variant?: 'light' | 'dark';
  showText?: boolean;
  className?: string;
}

export const AkkLogo: React.FC<AkkLogoProps> = ({
  size = 'md',
  showSubtitle = false,
  subtitle,
  variant = 'light',
  showText = true,
  className = ''
}) => {
  const uniqueId = useId().replace(/:/g, '');
  const blueGradientId = `akk-blue-grad-${uniqueId}`;
  const clipPathId = `akk-squircle-clip-${uniqueId}`;

  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const titleSizes = {
    sm: 'text-xs sm:text-sm',
    md: 'text-sm sm:text-base',
    lg: 'text-lg sm:text-xl',
    xl: 'text-xl sm:text-2xl'
  };

  return (
    <div className={`flex items-center ${showText ? 'gap-2.5' : 'justify-center'} select-none ${className}`}>
      {/* Official Anugrah Kemasan Kreatif Monogram Vector Logo with authentic vibrant blue body & transparent background */}
      <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center filter drop-shadow-md`}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            {/* Authentic vibrant blue gradient from original logo */}
            <linearGradient id={blueGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1E8AD5" />
              <stop offset="100%" stopColor="#0B6BB6" />
            </linearGradient>

            <clipPath id={clipPathId}>
              <rect width="100" height="100" rx="18" ry="18" />
            </clipPath>
          </defs>

          {/* 1. Official Vibrant Blue Squircle Body (Outside is transparent) */}
          <rect
            width="100"
            height="100"
            rx="18"
            ry="18"
            fill={`url(#${blueGradientId})`}
          />

          {/* 2. Monogram Art & Terracotta Dome */}
          <g clipPath={`url(#${clipPathId})`}>
            {/* Upper triangular peak and solid right leg of the letter 'A' */}
            <path
              d="M 50.5 15.5
                 L 94.5 94
                 L 81.5 94
                 L 68 73
                 C 55.5 67.5, 41 61.5, 30.5 51
                 Z"
              fill="#FFFFFF"
            />

            {/* Middle dynamic wave swoosh */}
            <path
              d="M 30.5 61
                 C 42 67, 54 71.5, 68 73.5
                 L 66 79
                 C 51 77, 38 72, 28 66
                 Z"
              fill="#FFFFFF"
            />

            {/* Lower white arch sweeping over the rising sun */}
            <path
              d="M 6.5 94
                 C 12 77.5, 26 64.5, 46 64.5
                 C 60 64.5, 72.5 72.5, 79.5 94
                 L 69.5 94
                 C 64.5 79.5, 56.5 74.5, 46 74.5
                 C 34 74.5, 23 82.5, 17 94
                 Z"
              fill="#FFFFFF"
            />

            {/* Terracotta / Warm Coral Rising Sun Dome */}
            <path
              d="M 25 94
                 C 25 79, 75 79, 75 94
                 Z"
              fill="#CB4E2A"
            />
          </g>
        </svg>
      </div>

      {/* Brand Title: ANUGRAH KEMASAN KREATIF */}
      {showText && (
        <div className="flex flex-col justify-center animate-fade-in">
          <div className="flex items-center gap-1.5 leading-tight">
            <span
              className={`font-black ${titleSizes[size]} tracking-tight ${
                variant === 'dark' ? 'text-slate-900' : 'text-slate-900 dark:text-white'
              }`}
            >
              ANUGRAH
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-amber-600 dark:text-amber-400 uppercase">
              KEMASAN KREATIF
            </span>
          </div>
          {showSubtitle && subtitle && (
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-tight">
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
