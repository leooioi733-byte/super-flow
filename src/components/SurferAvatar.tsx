import React from 'react';

interface SurferAvatarProps {
  name: string;
  suitColor: string;
  accentColor: string;
  skinTone?: string;
  hairColor?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SurferAvatar: React.FC<SurferAvatarProps> = ({
  name,
  suitColor,
  accentColor,
  skinTone = '#c98e6b',
  hairColor = '#1e1916',
  size = 'md',
}) => {
  const sizeClass =
    size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl border border-white/20 bg-[#0B2338] ${sizeClass}`}
      aria-label={`Retrato de ${name}`}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`bg-${suitColor.replace('#', '')}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0B3C5D" />
            <stop offset="100%" stopColor="#071726" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill={`url(#bg-${suitColor.replace('#', '')})`} />
        {/* Subtle ocean horizon arc */}
        <path d="M0 44 Q32 36 64 44 L64 64 L0 64 Z" fill={accentColor} fillOpacity="0.16" />
        {/* Wetsuit shoulders */}
        <path d="M10 64 C11 49, 20 44, 32 44 C44 44, 53 49, 54 64 Z" fill={suitColor} />
        {/* Wetsuit chest stripe */}
        <path d="M18 52 Q32 47 46 52 L48 58 Q32 53 16 58 Z" fill={accentColor} fillOpacity="0.92" />
        {/* Neck */}
        <rect x="27" y="36" width="10" height="10" rx="4" fill={skinTone} />
        {/* Face / Head */}
        <ellipse cx="32" cy="27" rx="11" ry="12.5" fill={skinTone} />
        {/* Hair */}
        <path
          d="M20.5 25 C20 15, 27 11, 33 11.5 C40 12, 44 17, 43.5 25 C40 20, 35 19, 31 19.5 C26 20, 23 22, 20.5 25 Z"
          fill={hairColor}
        />
      </svg>
    </div>
  );
};
