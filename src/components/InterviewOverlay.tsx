import React from 'react';
import { ArrowRight, Award, Mic, SkipForward, TrendingUp } from 'lucide-react';
import { getSponsorRelationshipStatus } from '../career/careerEngine';
import {
  CareerSaveState,
  InterviewChoice,
  InterviewPrompt,
  InterviewTone,
} from '../types/career';

interface InterviewOverlayProps {
  prompt: InterviewPrompt;
  career: CareerSaveState;
  phase: 'question' | 'reaction';
  chosenChoice: InterviewChoice | null;
  onSelectChoice: (choice: InterviewChoice) => void;
  onContinueAfterReaction: () => void;
  onSkip: () => void;
}

const TONE_META: Record<
  InterviewTone,
  { label: string; border: string; badgeBg: string; badgeText: string; hoverBorder: string }
> = {
  humildade: {
    label: 'Humildade',
    border: 'border-[#38d9c8]/35',
    hoverBorder: 'hover:border-[#38d9c8]/85 hover:bg-[#0B3C5D]/85',
    badgeBg: 'bg-[#38d9c8]/15',
    badgeText: 'text-[#38d9c8]',
  },
  confianca: {
    label: 'Confiança',
    border: 'border-[#f4c97a]/40',
    hoverBorder: 'hover:border-[#f4c97a]/85 hover:bg-[#0B3C5D]/85',
    badgeBg: 'bg-[#f4c97a]/15',
    badgeText: 'text-[#f4c97a]',
  },
  provocacao: {
    label: 'Provocação',
    border: 'border-[#e68a5c]/40',
    hoverBorder: 'hover:border-[#e68a5c]/85 hover:bg-[#0B3C5D]/85',
    badgeBg: 'bg-[#e68a5c]/15',
    badgeText: 'text-[#e68a5c]',
  },
};

export const InterviewOverlay: React.FC<InterviewOverlayProps> = ({
  prompt,
  career,
  phase,
  chosenChoice,
  onSelectChoice,
  onContinueAfterReaction,
  onSkip,
}) => {
  const affinity = career.sponsorAffinity ?? 55;
  const sponsorStatus = getSponsorRelationshipStatus(affinity);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 lg:p-7">
      {/* Subtle top & bottom gradient scrims for readability without obscuring center 3D scene */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{
          background:
            'linear-gradient(to bottom, rgba(7, 23, 38, 0.72) 0%, rgba(7, 23, 38, 0) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-72"
        style={{
          background:
            'linear-gradient(to top, rgba(7, 23, 38, 0.88) 0%, rgba(7, 23, 38, 0.45) 55%, rgba(7, 23, 38, 0) 100%)',
        }}
      />

      {/* Top Broadcast Header */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-2.5">
        <div className="pointer-events-auto rounded-xl border border-white/15 bg-[#071726]/88 px-3.5 py-2.5 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#2596A6]/25 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#38d9c8]">
              <Mic className="h-3 w-3" />
              <span>{prompt.triggerBadge}</span>
            </span>
            <span className="text-[11px] font-medium text-[#E7DCC8]/85">
              {prompt.eventName} · {prompt.beachName}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-white/75">
            <span className="inline-flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-[#f4c97a]" />
              <span>Reputação:</span>
              <strong className="font-mono-tabular text-white">{career.reputation} pts</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-[#38d9c8]" />
              <span>Patrocinadores:</span>
              <strong className={sponsorStatus.tierColor}>{sponsorStatus.label}</strong>
              <span className="font-mono-tabular text-white/55">({affinity}/100)</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/25 bg-[#071726]/88 px-4 py-2 text-xs font-semibold text-white transition-colors hover:border-white/50 hover:bg-[#0B2338]"
        >
          <SkipForward className="h-4 w-4 text-[#E7DCC8]" />
          <span>Pular Entrevista</span>
        </button>
      </div>

      {/* Lower Interactive Press Card (keeps upper 55%+ clear for 3D Journalist + Surfer) */}
      <div className="relative z-10 mx-auto w-full max-w-4xl">
        {phase === 'question' ? (
          <div className="pointer-events-auto rounded-2xl border border-white/15 bg-[#071726]/92 p-3.5 shadow-2xl sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div>
                <span className="text-xs font-bold tracking-wide text-[#38d9c8]">
                  {prompt.journalistName}
                </span>
                <span className="mx-1.5 text-white/35">·</span>
                <span className="text-[11px] text-white/65">{prompt.mediaOutlet}</span>
              </div>
              <span className="text-[11px] font-medium text-[#E7DCC8]/85">
                {prompt.contextLine}
              </span>
            </div>

            <p className="mt-2.5 text-sm leading-snug font-medium text-white sm:text-base">
              &ldquo;{prompt.question}&rdquo;
            </p>

            <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
              {prompt.choices.map((choice, idx) => {
                const meta = TONE_META[choice.tone];
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => onSelectChoice(choice)}
                    className={`flex min-h-[44px] flex-col justify-between rounded-xl border bg-[#0B2338]/85 p-3 text-left transition-colors ${meta.border} ${meta.hoverBorder}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${meta.badgeBg} ${meta.badgeText}`}
                        >
                          {meta.label}
                        </span>
                        <span className="font-mono-tabular hidden text-[10px] text-white/40 sm:inline">
                          [{idx + 1}]
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-snug font-medium text-white/95">
                        {choice.text}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          chosenChoice && (
            <div className="pointer-events-auto rounded-2xl border border-white/15 bg-[#071726]/92 p-4 shadow-2xl sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-white">
                    {career.surfer.name}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${TONE_META[chosenChoice.tone].badgeBg} ${TONE_META[chosenChoice.tone].badgeText}`}
                  >
                    {TONE_META[chosenChoice.tone].label}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-[#38d9c8]">
                  {chosenChoice.consequenceLabel}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed font-medium text-[#F5E9D4] sm:text-base">
                {chosenChoice.reactionQuote}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-white/60">
                  Declaração registrada no histórico oficial da carreira.
                </span>
                <button
                  type="button"
                  onClick={onContinueAfterReaction}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2596A6] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#2eb0c2]"
                >
                  <span>Continuar Carreira</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
