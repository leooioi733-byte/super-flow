import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Compass, RefreshCw, Waves } from 'lucide-react';
import { buildChampionshipLoadingQueue } from '../data/loadingTipsData';

export interface ChampionshipLoadingContext {
  eventName: string;
  tierName: string;
  beachName: string;
  location: string;
  roundLabel: string;
  heatLabel: string;
  waveHeightLabel: string;
  swellConditions: string;
  photoSrc?: string;
  seed: number;
}

interface ChampionshipLoadingScreenProps {
  isOpen: boolean;
  context: ChampionshipLoadingContext | null;
  progress: number;
  stageLabel: string;
  canEnterNow: boolean;
  onEnterNow: () => void;
}

export const ChampionshipLoadingScreen: React.FC<ChampionshipLoadingScreenProps> = ({
  isOpen,
  context,
  progress,
  stageLabel,
  canEnterNow,
  onEnterNow,
}) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  const seed = context?.seed ?? 1;
  const queue = useMemo(() => buildChampionshipLoadingQueue(seed), [seed]);

  useEffect(() => {
    if (!isOpen) return;
    setTipIndex(0);
    setImageFailed(false);
  }, [isOpen, seed]);

  // Gently auto-rotate tip/trivia card if loading stays open longer than 6.5s
  useEffect(() => {
    if (!isOpen || queue.length <= 1) return;
    const timer = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % queue.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [isOpen, queue.length]);

  if (!isOpen || !context) return null;

  const activeItem = queue[tipIndex % queue.length] ?? queue[0];
  const isTip = activeItem?.category === 'dica';
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  const handleNextTip = () => {
    if (queue.length <= 1) return;
    setTipIndex((prev) => (prev + 1) % queue.length);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Carregando cena do campeonato: ${context.eventName}`}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute inset-0 z-30 flex flex-col justify-between overflow-y-auto bg-[#071726] text-white"
    >
      {/* Atmospheric Championship Backdrop with safe gradient fallback */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {context.photoSrc && !imageFailed && (
          <img
            src={context.photoSrc}
            alt={context.eventName}
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full scale-105 object-cover opacity-32"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(7, 23, 38, 0.92) 0%, rgba(7, 23, 38, 0.72) 45%, rgba(7, 23, 38, 0.96) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 22% 28%, rgba(37, 150, 166, 0.22) 0%, rgba(7, 23, 38, 0) 58%)',
          }}
        />
      </div>

      {/* Top Championship Stage Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 pt-5 sm:px-8 sm:pt-7 [@media(max-height:540px)]:pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#38d9c8]">
            <span>{context.tierName}</span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span>{context.roundLabel}</span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span className="text-[#E7DCC8]/85">{context.heatLabel}</span>
          </div>

          <h1 className="font-display mt-1.5 truncate text-xl font-bold tracking-tight text-white sm:text-3xl [@media(max-height:540px)]:text-lg">
            {context.eventName}
          </h1>
        </div>

        <div className="font-mono-tabular flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#E7DCC8]/85 sm:text-sm">
          <span className="font-medium text-white">{context.beachName}</span>
          <span aria-hidden="true" className="text-white/30">·</span>
          <span>{context.location}</span>
          <span aria-hidden="true" className="text-white/30">·</span>
          <span className="text-[#38d9c8]">{context.waveHeightLabel}</span>
          <span aria-hidden="true" className="text-white/30">·</span>
          <span>{context.swellConditions}</span>
        </div>
      </header>

      {/* Center Editorial Card: Tip / Surf Trivia */}
      <div className="relative z-10 mx-auto my-auto flex w-full max-w-5xl flex-col px-5 py-4 sm:px-8 sm:py-6 [@media(max-height:540px)]:py-2.5">
        {activeItem && (
          <section
            aria-live="polite"
            className="w-full max-w-3xl rounded-2xl border border-white/12 bg-[#0B2338]/92 p-5 shadow-2xl sm:p-7 [@media(max-height:540px)]:p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5 [@media(max-height:540px)]:pb-2.5">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    isTip
                      ? 'border-[#38d9c8]/35 bg-[#071726] text-[#38d9c8]'
                      : 'border-[#f4c97a]/35 bg-[#071726] text-[#f4c97a]'
                  }`}
                >
                  {isTip ? <Compass className="h-4 w-4" /> : <Waves className="h-4 w-4" />}
                </span>
                <div>
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      isTip ? 'text-[#38d9c8]' : 'text-[#f4c97a]'
                    }`}
                  >
                    {isTip ? 'Dica de Jogabilidade' : 'Curiosidade do Surfe'}
                  </div>
                  <div className="text-xs text-white/60">
                    {activeItem.kicker}
                    <span aria-hidden="true" className="mx-1.5 text-white/30">·</span>
                    <span className="font-mono-tabular text-white/50">
                      {tipIndex + 1}/{queue.length}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextTip}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/15 bg-[#071726]/80 px-3.5 py-2 text-xs font-medium text-white/85 transition-colors hover:border-[#38d9c8]/55 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#38d9c8]" />
                <span>{isTip ? 'Ver curiosidade' : 'Ver dica prática'}</span>
              </button>
            </div>

            <div className="pt-4 [@media(max-height:540px)]:pt-3">
              <h2 className="font-display text-lg font-bold leading-snug text-white sm:text-2xl [@media(max-height:540px)]:text-base">
                {activeItem.title}
              </h2>
              <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-[#E7DCC8]/90 sm:text-base [@media(max-height:540px)]:mt-1.5 [@media(max-height:540px)]:text-xs">
                {activeItem.body}
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Bottom Progress Track & Smooth Enter Action */}
      <footer className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-5 sm:px-8 sm:pb-7 [@media(max-height:540px)]:pb-4">
        <div className="flex flex-col gap-3 border-t border-white/12 pt-4 sm:flex-row sm:items-center sm:justify-between [@media(max-height:540px)]:pt-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
              <span className="font-medium text-[#E7DCC8]">{stageLabel}</span>
              <span className="font-mono-tabular font-semibold text-[#38d9c8]">
                {clampedProgress}%
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={clampedProgress}
              aria-label="Progresso de carregamento da cena do campeonato"
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/12"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2596A6] to-[#38d9c8] transition-[width] duration-200 ease-out motion-reduce:transition-none"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end">
            {canEnterNow ? (
              <button
                type="button"
                onClick={onEnterNow}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#2596A6] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#2eb0c2] sm:text-sm"
              >
                <span>Entrar na Água</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex min-h-[44px] items-center text-xs text-white/55">
                Sincronizando cenário e competidores
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
