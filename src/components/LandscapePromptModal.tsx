import React, { useEffect, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { MenuScreen } from '../types/game';

interface LandscapePromptModalProps {
  screen: MenuScreen;
}

export const LandscapePromptModal: React.FC<LandscapePromptModalProps> = ({ screen }) => {
  const isCompactPortrait = () =>
    typeof window !== 'undefined' &&
    window.innerHeight > window.innerWidth &&
    Math.min(window.innerWidth, window.innerHeight) < 768;

  const [isPortrait, setIsPortrait] = useState<boolean>(isCompactPortrait);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const portraitNow = isCompactPortrait();
      setIsPortrait(portraitNow);
      if (!portraitNow) {
        setDismissed(false);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Re-prompt when entering active surfing if still holding mobile device vertically
  useEffect(() => {
    if (screen === 'surfing' && isCompactPortrait()) {
      setDismissed(false);
    }
  }, [screen]);

  const handleRequestLandscapeFullscreen = async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      const orient = screenOrientationLock();
      if (orient) {
        await orient.lock('landscape');
      }
    } catch {
      // Orientation lock may not be permitted outside standalone/fullscreen on some browsers
    }
  };

  if (!isPortrait || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="landscape-prompt-title"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#071726]/88 p-6 text-center"
    >
      <div className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#0B2338]/95 p-6 shadow-2xl">
        {/* Animated phone rotation illustration */}
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[#2596A6]/35 bg-[#071726]/70">
          <svg
            viewBox="0 0 64 64"
            fill="none"
            className="h-12 w-12 text-[#38d9c8]"
            aria-hidden="true"
          >
            {/* Curved rotation arrow */}
            <path
              d="M46 18 A18 18 0 0 1 50 38"
              stroke="currentColor"
              strokeOpacity="0.65"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M45 36 L50.5 39 L52.5 33"
              stroke="currentColor"
              strokeOpacity="0.65"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Phone outline rotating to horizontal */}
            <g className="origin-center animate-rotate-landscape" style={{ transformBox: 'fill-box' }}>
              <rect
                x="22"
                y="14"
                width="20"
                height="34"
                rx="3.5"
                stroke="#ffffff"
                strokeWidth="2.4"
              />
              <line
                x1="29"
                y1="43"
                x2="35"
                y2="43"
                stroke="#38d9c8"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          </svg>
        </div>

        <h2 id="landscape-prompt-title" className="font-display text-xl font-bold text-white">
          Vire a tela para a horizontal
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-[#E7DCC8]/80">
          Para jogar FLOW e enxergar toda a onda com os controles confortáveis, gire seu aparelho
          para o modo paisagem.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleRequestLandscapeFullscreen}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2596A6] px-4 py-2.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-[#2eb0c2]"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Girar / Tela Cheia Horizontal</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg py-1.5 text-xs font-medium text-white/55 transition-colors hover:text-white/85"
          >
            Continuar mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
};

function screenOrientationLock(): { lock: (orientation: string) => Promise<void> } | null {
  if (typeof window === 'undefined' || !window.screen?.orientation) return null;
  const o = window.screen.orientation as unknown as { lock?: (orientation: string) => Promise<void> };
  return typeof o.lock === 'function' ? { lock: o.lock.bind(window.screen.orientation) } : null;
}
