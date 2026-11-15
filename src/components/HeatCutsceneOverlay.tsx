import React from 'react';
import { Cloud, CloudRain, FastForward, Sun, Swords, Waves } from 'lucide-react';
import { CareerCutsceneInfo } from '../types/career';
import { SurfHUDState } from '../types/game';

interface HeatCutsceneOverlayProps {
  hud: SurfHUDState;
  info: CareerCutsceneInfo;
  onSkip: () => void;
}

const STYLE_FOCUS_LABELS: Record<'technical' | 'barrel' | 'allround', string> = {
  technical: 'Técnico & Aéreos',
  barrel: 'Especialista em Tubos',
  allround: 'Versátil',
};

const WEATHER_LABELS = {
  sunny: 'Sol & Vento Limpo',
  overcast: 'Nublado Técnico',
  rainy: 'Chuva Costeira',
} as const;

export const HeatCutsceneOverlay: React.FC<HeatCutsceneOverlayProps> = ({
  hud,
  info,
  onSkip,
}) => {
  const stage = hud.cutsceneStage ?? 1;
  const progressPct = Math.min(100, Math.max(0, Math.round((hud.cutsceneProgress ?? 0) * 100)));

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Broadcast Letterbox Bar + Discreet Skip Control */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-[#38d9c8]">
            <span>TRANSMISSÃO OFICIAL · CIRCUITO FLOW</span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span className="font-mono-tabular text-white/70">CENA {stage}/6</span>
            {info.isHeadToHead && (
              <>
                <span aria-hidden="true" className="text-white/30">·</span>
                <span className="inline-flex items-center gap-1 text-[#e68a5c]">
                  <Swords className="h-3 w-3" />
                  DUELO HEAD-TO-HEAD
                </span>
              </>
            )}
          </div>
          <div className="font-mono-tabular text-xs text-[#E7DCC8]/85">
            {info.roundLabel} · {info.heatLabel} · {info.heatDurationSec}s
          </div>
        </div>

        <button
          type="button"
          onClick={onSkip}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-[#071726]/75 px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:border-[#38d9c8]/70 hover:bg-[#071726] hover:text-white"
        >
          <span>Pular Introdução</span>
          <FastForward className="h-3.5 w-3.5 text-[#38d9c8]" />
        </button>
      </div>

      {/* Stage-Driven Center/Lower Broadcast Callouts */}
      <div className="mb-1 flex flex-col gap-3 sm:mb-2">
        {(stage === 1 || stage === 2) && (
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold tracking-[0.18em] text-[#38d9c8]">
              {stage === 1 ? 'APRESENTAÇÃO DO PICO' : 'CONDIÇÕES DO MAR'}
            </div>
            <h2
              className="font-display mt-1 text-2xl font-bold text-white sm:text-4xl"
              style={{ textShadow: '0 2px 18px rgba(7, 23, 38, 0.85)' }}
            >
              {stage === 1 ? info.eventName : info.beachName}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#E7DCC8] sm:text-sm">
              <span>{info.location}</span>
              <span aria-hidden="true" className="text-white/35">·</span>
              <span className="font-mono-tabular inline-flex items-center gap-1.5">
                <Waves className="h-3.5 w-3.5 text-[#38d9c8]" />
                {info.waveHeightLabel}
              </span>
              <span aria-hidden="true" className="text-white/35">·</span>
              <span className="inline-flex items-center gap-1.5">
                {info.weather === 'rainy' ? (
                  <CloudRain className="h-3.5 w-3.5 text-[#5ec5db]" />
                ) : info.weather === 'overcast' ? (
                  <Cloud className="h-3.5 w-3.5 text-slate-300" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-[#f4c97a]" />
                )}
                {WEATHER_LABELS[info.weather]} · {info.swellConditions}
              </span>
            </div>
          </div>
        )}

        {(stage === 3 || stage === 4) && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.18em] text-[#38d9c8]">
                  {stage === 3 ? 'CHAMADA DOS COMPETIDORES' : 'REGULAMENTO DA BATERIA'}
                </div>
                <div
                  className="font-display text-lg font-bold text-white sm:text-2xl"
                  style={{ textShadow: '0 2px 14px rgba(7, 23, 38, 0.85)' }}
                >
                  {stage === 3
                    ? `${info.competitors.length} Surfistas na Água`
                    : `Somatório Top 2 Ondas · ${info.heatDurationSec}s`}
                </div>
              </div>
            </div>

            <div className="grid max-w-4xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {info.competitors.map((comp) => (
                <div
                  key={comp.id}
                  className={`rounded-lg border px-3 py-2 ${
                    comp.isPlayer
                      ? 'border-[#38d9c8]/75 bg-[#071726]/85'
                      : 'border-white/15 bg-[#071726]/72'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/30"
                        style={{ backgroundColor: comp.accentColor }}
                      />
                      <span className="truncate text-xs font-semibold text-white">
                        {comp.name}
                      </span>
                    </div>
                    <span className="font-mono-tabular shrink-0 text-[10px] text-white/60">
                      {comp.nationalityCode}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-[#E7DCC8]/75">
                    {comp.isPlayer
                      ? 'Você · Atleta Oficial'
                      : `${STYLE_FOCUS_LABELS[comp.styleFocus]} · ${comp.style}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage >= 5 && (
          <div className="max-w-lg">
            <div className="text-[11px] font-semibold tracking-[0.18em] text-[#38d9c8]">
              {stage === 5 ? 'ENTRADA NO CANAL' : 'LINEUP FORMADO'}
            </div>
            <div
              className="font-display mt-0.5 text-xl font-bold text-white sm:text-2xl"
              style={{ textShadow: '0 2px 14px rgba(7, 23, 38, 0.85)' }}
            >
              {stage === 5
                ? 'Competidores remando para o pico'
                : 'Bateria autorizada · Boas ondas!'}
            </div>
          </div>
        )}

        {/* Slim timeline bar */}
        <div className="h-[2px] w-full overflow-hidden bg-white/15">
          <div
            className="h-full bg-[#38d9c8] transition-[width] duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
