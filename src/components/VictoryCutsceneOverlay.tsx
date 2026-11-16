import React from 'react';
import { Award, Crown, FastForward, MapPin, Trophy } from 'lucide-react';
import { VictoryCutsceneInfo } from '../types/career';
import { SurfHUDState } from '../types/game';

interface VictoryCutsceneOverlayProps {
  hud: SurfHUDState;
  info: VictoryCutsceneInfo;
  onSkip: () => void;
}

export const VictoryCutsceneOverlay: React.FC<VictoryCutsceneOverlayProps> = ({
  hud,
  info,
  onSkip,
}) => {
  const stage = hud.victoryCutsceneStage || 1;
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((hud.victoryCutsceneProgress ?? 0) * 100))
  );

  const isGoldTheme =
    info.kind === 'final_win' ||
    info.kind === 'championship_ceremony' ||
    info.kind === 'semifinal_win';
  const accentText = isGoldTheme ? 'text-[#f4c97a]' : 'text-[#38d9c8]';
  const accentBorder = isGoldTheme ? 'border-[#f4c97a]/55' : 'border-[#38d9c8]/55';
  const accentBar = isGoldTheme ? 'bg-[#f4c97a]' : 'bg-[#38d9c8]';

  const topKicker =
    info.kind === 'championship_ceremony'
      ? 'CERIMÔNIA OFICIAL DE PREMIAÇÃO · CIRCUITO FLOW'
      : info.kind === 'final_win'
        ? 'GRANDE FINAL ENCERRADA · CIRCUITO FLOW'
        : 'RESULTADO OFICIAL · CIRCUITO FLOW';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-6">
      {/* Subtle bottom-up gradient for crisp typography without obscuring central 3D action */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 sm:h-64"
        style={{
          background:
            'linear-gradient(to top, rgba(7, 23, 38, 0.88) 0%, rgba(7, 23, 38, 0.48) 58%, rgba(7, 23, 38, 0) 100%)',
        }}
      />

      {/* TOP BAR: Broadcast Metadata & Touch-Friendly "PULAR" Button */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1 rounded-lg border border-white/12 bg-[#071726]/82 px-3 py-2">
          <div
            className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold tracking-[0.18em] sm:text-[11px] ${accentText}`}
          >
            <span>{topKicker}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#E7DCC8]/90 sm:text-xs">
            <span className="font-semibold text-white">{info.eventName}</span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-[#38d9c8]" />
              {info.beachName}
            </span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span className="font-mono-tabular text-white/75">
              {info.roundLabel} · Temp. {info.season}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSkip}
          onPointerDown={(e) => e.stopPropagation()}
          className={`pointer-events-auto inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border border-white/25 bg-[#071726]/88 px-4 py-2 text-xs font-semibold tracking-wider text-white transition-colors hover:bg-[#0c243b] ${
            isGoldTheme ? 'hover:border-[#f4c97a]' : 'hover:border-[#38d9c8]'
          }`}
        >
          <span>PULAR</span>
          <FastForward className={`h-4 w-4 ${accentText}`} />
        </button>
      </div>

      {/* LOWER HUD BANNER: Keeps Center 3D Surfer & Trophy Unobstructed */}
      <div className="relative z-10 flex flex-col gap-2.5 sm:gap-3">
        {/* 1. VITÓRIA EM BATERIA */}
        {info.kind === 'heat_win' && (
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <div className="text-[11px] font-semibold tracking-[0.2em] text-[#38d9c8]">
                {info.roundLabel.toUpperCase()} · {info.playerName.toUpperCase()}
              </div>
              <h2
                className="font-display mt-0.5 text-3xl font-extrabold tracking-tight text-white sm:text-5xl"
                style={{ textShadow: '0 4px 22px rgba(7, 23, 38, 0.9)' }}
              >
                VITÓRIA!
              </h2>
              <p className="mt-1 text-xs text-[#E7DCC8]/90 sm:text-sm">
                Bateria dominada em {info.beachName} com somatório{' '}
                <span className="font-mono-tabular font-semibold text-white">
                  {info.playerScoreTotal.toFixed(2)} pts
                </span>
                .
              </p>
            </div>

            <div className="grid w-full max-w-lg grid-cols-2 gap-1.5 sm:grid-cols-4 lg:w-auto">
              {info.competitors.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg border px-2.5 py-2 ${
                    c.isPlayer
                      ? 'border-[#38d9c8]/75 bg-[#071726]/92'
                      : 'border-white/15 bg-[#071726]/82'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] text-white/65">
                    <span className="font-mono-tabular font-bold text-white">
                      {c.heatRank}º
                    </span>
                    <span className="font-mono-tabular">{c.nationalityCode}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs font-semibold text-white">
                    {c.name}
                  </div>
                  <div className="font-mono-tabular mt-0.5 text-sm font-bold text-[#38d9c8]">
                    {c.bestTwoTotal.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. VITÓRIA NAS QUARTAS DE FINAL */}
        {info.kind === 'quarterfinal_win' && (
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.2em] text-[#38d9c8]">
                <Award className="h-3.5 w-3.5" />
                <span>
                  {stage === 1
                    ? 'VITÓRIA NAS QUARTAS DE FINAL'
                    : 'AVANÇO CONFIRMADO NA CHAVE'}
                </span>
              </div>
              <h2
                className="font-display mt-0.5 text-2xl font-extrabold tracking-tight text-white sm:text-4xl"
                style={{ textShadow: '0 4px 22px rgba(7, 23, 38, 0.9)' }}
              >
                CLASSIFICADO PARA A SEMIFINAL
              </h2>
              <p className="mt-1 text-xs text-[#E7DCC8]/90 sm:text-sm">
                {info.playerName} garante vaga entre os quatro melhores de {info.eventName}.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {info.competitors.map((c) => (
                <div
                  key={c.id}
                  className={`min-w-[148px] flex-1 rounded-lg border px-3 py-2 sm:flex-none ${
                    c.isPlayer
                      ? 'border-[#38d9c8]/80 bg-[#071726]/92'
                      : 'border-white/15 bg-[#071726]/82'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-[11px] font-bold text-white/80">
                      {c.heatRank}º · {c.nationalityCode}
                    </span>
                    {c.isPlayer && (
                      <span className="text-[10px] font-bold tracking-wider text-[#38d9c8]">
                        AVANÇA
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs font-semibold text-white">
                    {c.name}
                  </div>
                  <div className="font-mono-tabular mt-0.5 flex items-baseline justify-between text-xs">
                    <span className="font-bold text-white">
                      {c.bestTwoTotal.toFixed(2)} pts
                    </span>
                    <span className="text-white/55">Melhor: {c.bestWave.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. VITÓRIA NA SEMIFINAL */}
        {info.kind === 'semifinal_win' && (
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded border border-[#f4c97a]/45 bg-[#071726]/88 px-2.5 py-0.5 text-[11px] font-bold tracking-[0.18em] text-[#f4c97a]">
                <Trophy className="h-3.5 w-3.5" />
                <span>SEMIFINAL CONCLUÍDA · VAGA GARANTIDA</span>
              </div>
              <h2
                className="font-display mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl"
                style={{ textShadow: '0 4px 24px rgba(7, 23, 38, 0.92)' }}
              >
                VOCÊ ESTÁ NA GRANDE FINAL!
              </h2>
              <p className="mt-1 text-xs text-[#E7DCC8] sm:text-sm">
                Atuação decisiva em {info.beachName} ({info.playerScoreTotal.toFixed(2)} pts ·{' '}
                {info.placementLabel}).
              </p>
            </div>

            <div className="grid w-full max-w-xl grid-cols-2 gap-1.5 sm:flex sm:flex-wrap lg:justify-end">
              {info.competitors.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg border px-3 py-2 sm:min-w-[145px] ${
                    c.isPlayer
                      ? 'border-[#f4c97a]/80 bg-[#071726]/92'
                      : c.advanced
                        ? 'border-[#38d9c8]/45 bg-[#071726]/85'
                        : 'border-white/12 bg-[#071726]/78'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="font-mono-tabular font-bold text-white/80">
                      {c.heatRank}º · {c.nationalityCode}
                    </span>
                    {c.advanced && (
                      <span className={c.isPlayer ? 'font-bold text-[#f4c97a]' : 'text-[#38d9c8]'}>
                        FINALISTA
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs font-semibold text-white">
                    {c.name}
                  </div>
                  <div className="font-mono-tabular mt-0.5 text-sm font-bold text-white">
                    {c.bestTwoTotal.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. VITÓRIA NA GRANDE FINAL */}
        {info.kind === 'final_win' && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.22em] text-[#f4c97a]">
                <Crown className="h-4 w-4" />
                <span>TÍTULO DO CAMPEONATO CONQUISTADO</span>
              </div>
              <h2
                className="font-display mt-0.5 text-4xl font-extrabold tracking-tight text-white sm:text-6xl"
                style={{ textShadow: '0 4px 26px rgba(7, 23, 38, 0.94)' }}
              >
                CAMPEÃO!
              </h2>
              <div className="mt-1 text-sm font-semibold text-[#f4c97a] sm:text-lg">
                {info.eventName}
              </div>
              <div className="mt-0.5 text-xs text-[#E7DCC8]/85">
                {info.playerName} ({info.playerNationalityCode}) · {info.beachName}
              </div>
            </div>

            {/* Definitive Final Scoreboard */}
            <div className="w-full max-w-lg rounded-xl border border-[#f4c97a]/45 bg-[#071726]/90 p-2.5 sm:p-3">
              <div className="mb-1.5 flex items-center justify-between border-b border-white/10 pb-1 text-[10px] font-semibold tracking-[0.16em] text-[#E7DCC8]/75">
                <span>PLACAR DEFINITIVO DA FINAL</span>
                <span className="font-mono-tabular">TOP 2 ONDAS</span>
              </div>
              <div className="space-y-1">
                {info.competitors.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1 text-xs ${
                      c.isPlayer
                        ? 'border border-[#f4c97a]/65 bg-[#f4c97a]/12 text-white'
                        : 'text-white/80'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`font-mono-tabular w-5 font-bold ${
                          c.heatRank === 1 ? 'text-[#f4c97a]' : 'text-white/60'
                        }`}
                      >
                        {c.heatRank}º
                      </span>
                      <span className="truncate font-semibold">{c.name}</span>
                      <span className="font-mono-tabular text-[10px] text-white/50">
                        {c.nationalityCode}
                      </span>
                    </div>
                    <div className="font-mono-tabular flex shrink-0 items-center gap-3">
                      <span className="hidden text-[11px] text-white/55 sm:inline">
                        Melhor {c.bestWave.toFixed(2)}
                      </span>
                      <span className="font-bold text-white">
                        {c.bestTwoTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. CONQUISTA DE CAMPEONATO (3D Trophy Award Ceremony) */}
        {info.kind === 'championship_ceremony' && (
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
            <div
              className={`max-w-lg rounded-xl border ${accentBorder} bg-[#071726]/90 p-3.5 sm:p-4`}
            >
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-[#f4c97a]">
                <Trophy className="h-4 w-4 shrink-0" />
                <span>CONQUISTA DE CAMPEONATO</span>
              </div>
              <h2 className="font-display mt-1 text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                {info.championshipTitle || info.eventName}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#E7DCC8]">
                <span className="font-semibold text-white">
                  {info.playerName} ({info.playerNationalityCode})
                </span>
                <span aria-hidden="true" className="text-white/30">·</span>
                <span className="font-semibold text-[#f4c97a]">{info.placementLabel}</span>
              </div>
              {(info.prizeWon || info.pointsEarned) && (
                <div className="font-mono-tabular mt-2 flex flex-wrap items-center gap-3 border-t border-white/10 pt-2 text-xs text-white/85">
                  {info.pointsEarned ? (
                    <span className="text-[#38d9c8]">+{info.pointsEarned} pts circuito</span>
                  ) : null}
                  {info.prizeWon ? (
                    <span className="text-[#f4c97a]">
                      +R$ {info.prizeWon.toLocaleString('pt-BR')}
                    </span>
                  ) : null}
                  <span>Melhor Onda: {info.playerBestWave.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="hidden rounded-lg border border-white/15 bg-[#071726]/85 px-3.5 py-2.5 text-right sm:block">
              <div className="text-[10px] font-semibold tracking-[0.18em] text-[#38d9c8]">
                TROFÉU OFICIAL · {info.tierName.toUpperCase()}
              </div>
              <div className="font-mono-tabular mt-0.5 text-sm font-bold text-white">
                {info.eventName}
              </div>
              <div className="text-[11px] text-[#E7DCC8]/75">
                {info.beachName} · Temporada {info.season}
              </div>
            </div>
          </div>
        )}

        {/* Slim timeline bar */}
        <div className="h-[2px] w-full overflow-hidden bg-white/15">
          <div
            className={`h-full transition-[width] duration-150 ${accentBar}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
