import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cloud,
  CloudRain,
  Crown,
  Sparkles,
  Sun,
  Swords,
  Target,
  Trophy,
  Waves,
  X,
} from 'lucide-react';
import { getHeadToHeadStakes } from '../career/careerEngine';
import { CAREER_ACHIEVEMENTS_CATALOG, CAREER_PHOTOS, TIER_MAP } from '../data/careerData';
import { BEACH_SPOTS } from '../data/surfData';
import {
  AISurfStyleFocus,
  CareerSaveState,
  RivalryNotification,
  RoundSummary,
  SeasonSummary,
  TournamentMilestoneSummary,
} from '../types/career';
import { SurferAvatar } from './SurferAvatar';

const STYLE_FOCUS_LABEL: Record<AISurfStyleFocus, string> = {
  technical: 'Técnico & Aéreos',
  barrel: 'Especialista em Tubos',
  allround: 'Versátil',
};

interface CareerTournamentOverlayProps {
  career: CareerSaveState;
  onLaunchHeat: () => void;
  onAdvanceRound: () => void;
  onCloseFinishedEvent: () => void;
  onCancelPreHeat: () => void;
  onAdvanceSeason: () => void;
}

export const CareerTournamentOverlay: React.FC<CareerTournamentOverlayProps> = ({
  career,
  onLaunchHeat,
  onAdvanceRound,
  onCloseFinishedEvent,
  onCancelPreHeat,
  onAdvanceSeason,
}) => {
  const tournament = career.activeTournament;
  const seasonSummary = career.pendingSeasonSummary;

  if (seasonSummary && !tournament) {
    return <SeasonEndModal summary={seasonSummary} onAdvanceSeason={onAdvanceSeason} />;
  }

  if (!tournament) return null;

  const event = career.calendar.find((e) => e.id === tournament.eventId);
  if (!event) return null;

  const beach = BEACH_SPOTS.find((b) => b.id === event.beachId);
  const tierInfo = TIER_MAP[event.tier];
  const photoSrc = CAREER_PHOTOS[event.photoKey];

  // 1. EVENT FINISHED PODIUM & PAYOUT VIEW
  if (tournament.eventFinished && tournament.finalResult) {
    const res = tournament.finalResult;
    const isWin = res.placement === 1;
    const isPodium = res.placement <= 3;

    return (
      <div className="pointer-events-auto mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl border border-white/15 bg-[#071726]/92 shadow-2xl sm:max-h-[calc(100dvh-1.75rem)] lg:max-h-[calc(100dvh-3rem)] lg:overflow-hidden [@media(max-height:600px)]:!overflow-y-auto">
        <div className="relative border-b border-white/10 p-4 sm:p-5 lg:shrink-0 [@media(max-height:600px)]:!shrink">
          <img
            src={photoSrc}
            alt={event.name}
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#071726] via-[#071726]/88 to-[#071726]/65" />

          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              {isWin && (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#f4c97a]/55 bg-[#261f12]/85 text-[#f4c97a] shadow-lg sm:h-14 sm:w-14">
                  <Trophy className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
              )}
              <div>
                <div
                  className={`text-xs font-medium tracking-[0.14em] ${
                    isWin ? 'text-[#f4c97a]' : 'text-[#38d9c8]'
                  }`}
                >
                  {isWin ? 'TROFÉU CONQUISTADO' : 'Resultado Oficial'} · {event.name}
                </div>
                <h2 className="font-display mt-1 text-xl font-bold text-white sm:text-3xl">
                  {isWin
                    ? 'Campeão da Etapa!'
                    : isPodium
                      ? `${res.placement}º Lugar — Pódio Conquistado`
                      : `${res.placement}º Lugar Final`}
                </h2>
                <p className="mt-1 text-xs text-[#E7DCC8]/85">
                  {beach?.name ?? event.location} · Campeão: {res.championName}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <div className="rounded-xl border border-white/15 bg-[#0B2338]/85 px-3.5 py-2 text-right sm:px-4 sm:py-2.5">
                <div className="text-[11px] text-white/60">Pontos no Ranking</div>
                <div className="font-mono-tabular text-base font-bold text-[#38d9c8] sm:text-lg">
                  +{res.pointsEarned.toLocaleString()} pts
                </div>
              </div>
              <div className="rounded-xl border border-white/15 bg-[#0B2338]/85 px-3.5 py-2 text-right sm:px-4 sm:py-2.5">
                <div className="text-[11px] text-white/60">Premiação Total</div>
                <div className="font-mono-tabular text-base font-bold text-[#f4c97a] sm:text-lg">
                  +${res.prizeEarned.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 p-4 sm:p-6 lg:overflow-y-auto [@media(max-height:600px)]:!overflow-visible">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricBox label="Melhor Somatório" value={`${res.bestHeatTotal.toFixed(1)} / 20`} />
            <MetricBox label="Melhor Onda" value={`${res.bestWave.toFixed(1)} / 10`} />
            <MetricBox label="Manobras Validadas" value={`${res.maneuversLanded}`} />
            <MetricBox
              label="Bônus Patrocínio"
              value={res.sponsorBonusEarned > 0 ? `+$${res.sponsorBonusEarned}` : '$0'}
            />
          </div>

          {(() => {
            const eventRivNotif = (career.rivalryNotifications ?? []).find(
              (n) => !n.seen && n.eventName === event.name
            );
            return eventRivNotif ? <TournamentRivalryBanner notification={eventRivNotif} /> : null;
          })()}

          {tournament.recentMilestones && (
            <TournamentMilestonesBanner milestones={tournament.recentMilestones} />
          )}

          <div className="mt-5">
            <h3 className="font-display text-sm font-semibold text-white">
              Classificação Final do Campeonato
            </h3>
            <div className="mt-2.5 overflow-hidden rounded-xl border border-white/10 bg-[#0B2338]/55">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-white/55">
                  <tr>
                    <th className="px-3.5 py-2.5 font-medium">Pos.</th>
                    <th className="px-3.5 py-2.5 font-medium">Surfista</th>
                    <th className="px-3.5 py-2.5 font-medium text-right">Melhor Bateria</th>
                    <th className="px-3.5 py-2.5 font-medium text-right">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {res.topStandings.map((row) => (
                    <tr
                      key={row.competitorId}
                      className={row.isPlayer ? 'bg-[#2596A6]/18 text-white' : 'text-white/80'}
                    >
                      <td className="font-mono-tabular px-3.5 py-2.5 font-semibold">
                        {row.placement}º
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="font-semibold">{row.name}</span>
                        <span className="ml-2 text-[11px] text-white/50">
                          {row.nationalityCode}
                        </span>
                      </td>
                      <td className="font-mono-tabular px-3.5 py-2.5 text-right">
                        {row.bestHeatTotal.toFixed(1)}
                      </td>
                      <td className="font-mono-tabular px-3.5 py-2.5 text-right text-[#38d9c8]">
                        +{row.pointsEarned.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {tournament.completedRounds.length > 0 && (
            <div className="mt-5">
              <CompletedRoundsHistory rounds={tournament.completedRounds} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4 lg:shrink-0 [@media(max-height:600px)]:!shrink">
          <button
            type="button"
            onClick={onCloseFinishedEvent}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2596A6] px-6 py-2.5 text-xs font-semibold tracking-[0.1em] text-white transition-colors hover:bg-[#2eb0c2] sm:text-sm"
          >
            <span>
              {career.pendingSeasonSummary
                ? 'VER FECHAMENTO DA TEMPORADA'
                : 'CONTINUAR CARREIRA'}
            </span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // 2. HEAT COMPLETED AWAITING NEXT ROUND
  if (tournament.heatCompletedAwaitingNext) {
    const playerHeat = tournament.heats[tournament.playerHeatIndex];
    const sortedCompetitors = [...(playerHeat?.competitors ?? [])].sort(
      (a, b) => a.heatRank - b.heatRank
    );
    const playerComp = sortedCompetitors.find((c) => c.isPlayer);

    return (
      <div className="pointer-events-auto mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl border border-white/15 bg-[#071726]/92 shadow-2xl sm:max-h-[calc(100dvh-1.75rem)] lg:max-h-[calc(100dvh-3rem)] lg:overflow-hidden [@media(max-height:600px)]:!overflow-y-auto">
        <div className="relative border-b border-white/10 p-4 sm:p-5 lg:shrink-0 [@media(max-height:600px)]:!shrink">
          <img
            src={photoSrc}
            alt={event.name}
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#071726] via-[#071726]/90 to-[#071726]/70" />

          <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-medium tracking-[0.14em] text-[#38d9c8]">
                {event.name} · {tournament.roundLabel}
              </div>
              <h2 className="font-display mt-1 text-xl font-bold text-white sm:text-2xl">
                Classificado para a próxima fase!
              </h2>
              <p className="mt-0.5 text-xs text-[#E7DCC8]/80">
                Somatório das 2 melhores ondas: {(playerComp?.bestTwoTotal ?? 0).toFixed(1)} pts
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#38d9c8]/50 bg-[#0B3C5D]/75 px-3.5 py-2 text-xs font-semibold text-[#38d9c8]">
              <Award className="h-4 w-4" />
              <span>{playerComp?.heatRank ?? 1}º lugar na bateria</span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 p-4 sm:p-6 lg:overflow-y-auto [@media(max-height:600px)]:!overflow-visible">
          {(() => {
            const heatRivNotif = (career.rivalryNotifications ?? []).find(
              (n) => !n.seen && n.eventName === event.name
            );
            return heatRivNotif ? <TournamentRivalryBanner notification={heatRivNotif} /> : null;
          })()}

          {tournament.recentMilestones && (
            <TournamentMilestonesBanner milestones={tournament.recentMilestones} />
          )}

          {/* Player Heat Wave Breakdown */}
          <div>
            <h3 className="font-display text-sm font-semibold text-white">
              Resultado da Sua Bateria ({playerHeat?.label})
            </h3>
            <div className="mt-2.5 space-y-2">
              {sortedCompetitors.map((comp) => (
                <div
                  key={comp.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${
                    comp.isPlayer
                      ? 'border-[#38d9c8]/55 bg-[#0B3C5D]/55'
                      : 'border-white/10 bg-[#0B2338]/55'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular text-sm font-bold text-white/75">
                        {comp.heatRank}º
                      </span>
                      <span className="text-sm font-semibold text-white">{comp.name}</span>
                      <span className="text-[11px] text-white/50">{comp.nationalityCode}</span>
                      <span
                        className={`text-[11px] font-medium ${
                          comp.advanced ? 'text-[#38d9c8]' : 'text-white/45'
                        }`}
                      >
                        · {comp.advanced ? 'Avançou' : 'Eliminado'}
                      </span>
                    </div>
                    <div className="font-mono-tabular mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-white/65">
                      {comp.waves.length === 0 ? (
                        <span>Nenhuma onda pontuada</span>
                      ) : (
                        comp.waves.map((w, idx) => (
                          <span key={`${comp.id}-w-${idx}`}>
                            Onda {idx + 1}: <strong className="text-white">{w.score.toFixed(1)}</strong>{' '}
                            <span className="text-white/45">({w.bestManeuver})</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="font-mono-tabular text-right">
                    <div className="text-[11px] text-white/55">Total (Top 2)</div>
                    <div className="text-lg font-bold text-white">
                      {comp.bestTwoTotal.toFixed(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Other Heats in Round */}
          {tournament.heats.length > 1 && (
            <div>
              <h3 className="font-display text-sm font-semibold text-white">
                Demais Baterias da Rodada
              </h3>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {tournament.heats
                  .filter((_, i) => i !== tournament.playerHeatIndex)
                  .map((h) => (
                    <div
                      key={h.heatId}
                      className="rounded-xl border border-white/10 bg-[#0B2338]/55 p-3"
                    >
                      <div className="text-[11px] font-medium text-white/60">{h.label}</div>
                      <div className="mt-2 space-y-1.5">
                        {[...h.competitors]
                          .sort((a, b) => a.heatRank - b.heatRank)
                          .map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className={c.advanced ? 'font-semibold text-white' : 'text-white/50'}>
                                {c.heatRank}º {c.name}
                              </span>
                              <span className="font-mono-tabular text-[#E7DCC8]/85">
                                {c.bestTwoTotal.toFixed(1)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4 lg:shrink-0 [@media(max-height:600px)]:!shrink">
          <button
            type="button"
            onClick={onAdvanceRound}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2596A6] px-6 py-2.5 text-xs font-semibold tracking-[0.1em] text-white transition-colors hover:bg-[#2eb0c2] sm:text-sm"
          >
            <span>PRÓXIMA FASE DO CHAVEAMENTO</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // 3. PRE-HEAT BRIEFING & BRACKET VIEW
  const playerHeat = tournament.heats[tournament.playerHeatIndex];
  const advancingCount = (playerHeat?.competitors.length ?? 2) >= 4 ? 2 : 1;

  return (
    <div className="pointer-events-auto mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl border border-white/15 bg-[#071726]/92 shadow-2xl sm:max-h-[calc(100dvh-1.75rem)] lg:max-h-[calc(100dvh-3rem)] lg:overflow-hidden [@media(max-height:600px)]:!overflow-y-auto">
      <div className="relative border-b border-white/10 p-4 sm:p-5 lg:shrink-0 [@media(max-height:600px)]:!shrink">
        <img
          src={photoSrc}
          alt={event.name}
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#071726] via-[#071726]/86 to-[#071726]/65" />

        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-[0.14em] text-[#38d9c8]">
              <span>{tierInfo.name}</span>
              <span aria-hidden="true" className="text-white/35">·</span>
              <span>{tournament.roundLabel}</span>
            </div>
            <h2 className="font-display mt-1 text-xl font-bold text-white sm:text-3xl">
              {event.name}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#E7DCC8]/85">
              <span>{beach?.name ?? event.location}</span>
              <span aria-hidden="true" className="text-white/30">·</span>
              <span className="inline-flex items-center gap-1">
                <Waves className="h-3.5 w-3.5 text-[#38d9c8]" />
                {event.waveHeightLabel}
              </span>
              <span aria-hidden="true" className="text-white/30">·</span>
              <span className="inline-flex items-center gap-1">
                {event.weather === 'rainy' ? (
                  <CloudRain className="h-3.5 w-3.5 text-[#5ec5db]" />
                ) : event.weather === 'overcast' ? (
                  <Cloud className="h-3.5 w-3.5 text-slate-300" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-[#f4c97a]" />
                )}
                {event.swellConditions}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancelPreHeat}
            aria-label="Voltar ao painel da carreira"
            className="shrink-0 rounded-lg border border-white/15 bg-[#071726]/75 p-2 text-white/75 transition-colors hover:border-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 p-4 sm:p-6 lg:overflow-y-auto [@media(max-height:600px)]:!overflow-visible">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2596A6]/35 bg-[#0B3C5D]/40 px-4 py-3 text-xs text-white/85">
          <span>
            Duração da bateria: <strong className="font-mono-tabular text-white">{tierInfo.heatDurationSeconds}s</strong> ·
            Valem as <strong className="text-white">2 melhores ondas</strong> (manobras, combos e tubos reais).
          </span>
          <span className="font-mono-tabular font-semibold text-[#38d9c8]">
            Avança{advancingCount > 1 ? 'm' : ''}: Top {advancingCount}
          </span>
        </div>

        {/* Head-to-Head Duel Banner if rival is seeded into this heat */}
        {tournament.headToHeadRivalId &&
          !tournament.headToHeadSettledInEvent &&
          playerHeat?.competitors.some((c) => c.id === tournament.headToHeadRivalId) && (() => {
            const rivalAi = career.opponents.find((o) => o.id === tournament.headToHeadRivalId);
            const record = (career.rivalries ?? []).find(
              (r) => r.rivalId === tournament.headToHeadRivalId
            );
            const stakes = record
              ? { prize: record.challengeBonusPrize, rep: record.challengeBonusRep }
              : getHeadToHeadStakes(career.tier);
            if (!rivalAi) return null;
            return (
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#e68a5c]/45 bg-[#0B2338]/75 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <SurferAvatar
                    name={rivalAi.name}
                    suitColor={rivalAi.suitColor}
                    accentColor={rivalAi.accentColor}
                    skinTone={rivalAi.skinTone}
                    hairColor={rivalAi.hairColor}
                    size="sm"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e68a5c]">
                      <Swords className="h-3.5 w-3.5" />
                      <span>Duelo Head-to-Head Oficial · {rivalAi.name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-white/75">
                      Vença este confronto direto na bateria para faturar bônus de{' '}
                      <strong className="font-mono-tabular text-[#f4c97a]">
                        +${stakes.prize.toLocaleString()}
                      </strong>{' '}
                      e{' '}
                      <strong className="font-mono-tabular text-[#38d9c8]">
                        +{stakes.rep} Rep.
                      </strong>
                    </p>
                  </div>
                </div>
                {record && (
                  <div className="font-mono-tabular shrink-0 text-right text-xs text-white/75">
                    Retrospecto: <strong className="text-white">{record.playerWins} × {record.rivalWins}</strong>
                  </div>
                )}
              </div>
            );
          })()}

        {/* Player's Heat Lineup */}
        <div>
          <h3 className="font-display text-sm font-semibold text-white">
            Sua Bateria ({playerHeat?.label})
          </h3>
          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {playerHeat?.competitors.map((comp) => {
              const isH2HRival = comp.id === tournament.headToHeadRivalId;
              return (
                <div
                  key={comp.id}
                  className={`flex items-center justify-between rounded-xl border p-3.5 ${
                    comp.isPlayer
                      ? 'border-[#38d9c8]/65 bg-[#0B3C5D]/60'
                      : isH2HRival
                        ? 'border-[#e68a5c]/65 bg-[#261918]/55'
                        : 'border-white/10 bg-[#0B2338]/55'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-white/30"
                        style={{ backgroundColor: comp.accentColor }}
                      />
                      <span className="text-sm font-semibold text-white">{comp.name}</span>
                      <span className="text-[11px] text-white/50">{comp.nationalityCode}</span>
                      {isH2HRival && (
                        <span className="text-[11px] font-semibold text-[#e68a5c]">
                          · Rival H2H
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/65">
                      <span>{comp.style}</span>
                      {comp.styleFocus && !comp.isPlayer && (
                        <span className="text-[11px] text-[#38d9c8]/85">
                          · {STYLE_FOCUS_LABEL[comp.styleFocus]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="font-mono-tabular text-right">
                    <div className="text-[10px] text-white/50">Nível</div>
                    <div className="text-sm font-bold text-[#E7DCC8]">{comp.skillLevel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Full Round Bracket Overview */}
        {tournament.heats.length > 1 && (
          <div>
            <h3 className="font-display text-sm font-semibold text-white">
              Chaveamento da Rodada
            </h3>
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {tournament.heats.map((h, i) => (
                <div
                  key={h.heatId}
                  className={`rounded-xl border p-3 ${
                    i === tournament.playerHeatIndex
                      ? 'border-[#38d9c8]/45 bg-[#0B3C5D]/40'
                      : 'border-white/10 bg-[#0B2338]/45'
                  }`}
                >
                  <div className="text-[11px] font-medium text-white/60">{h.label}</div>
                  <div className="mt-1.5 space-y-1">
                    {h.competitors.map((c) => (
                      <div
                        key={c.id}
                        className={`truncate text-xs ${
                          c.isPlayer ? 'font-semibold text-[#38d9c8]' : 'text-white/75'
                        }`}
                      >
                        {c.name} <span className="text-white/40">({c.nationalityCode})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tournament.completedRounds.length > 0 && (
          <CompletedRoundsHistory rounds={tournament.completedRounds} defaultCollapsed />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4 lg:shrink-0 [@media(max-height:600px)]:!shrink">
        <button
          type="button"
          onClick={onCancelPreHeat}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          Voltar
        </button>

        <button
          type="button"
          onClick={onLaunchHeat}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2596A6] px-4 py-2.5 text-xs font-semibold tracking-[0.08em] text-white transition-colors hover:bg-[#2eb0c2] sm:px-6 sm:text-sm sm:tracking-[0.12em]"
        >
          <span>ENTRAR NA BATERIA (IR PARA A ÁGUA)</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B2338]/60 p-3">
      <div className="text-[11px] text-white/55">{label}</div>
      <div className="font-mono-tabular mt-1 text-base font-bold text-white">{value}</div>
    </div>
  );
}

function TournamentRivalryBanner({ notification }: { notification: RivalryNotification }) {
  const isChallenge = notification.kind === 'head_to_head_challenge';
  const isWin = notification.kind === 'duel_won';
  return (
    <div
      className={`mt-4 rounded-xl border p-4 ${
        isChallenge
          ? 'border-[#e68a5c]/50 bg-[#1f1b24]/85'
          : isWin
            ? 'border-[#38d9c8]/45 bg-[#0B3C5D]/55'
            : 'border-white/15 bg-[#0B2338]/75'
      }`}
    >
      <div className="flex items-start gap-3">
        <SurferAvatar
          name={notification.rivalName}
          suitColor={notification.rivalSuitColor}
          accentColor={notification.rivalAccentColor}
          skinTone={notification.rivalSkinTone}
          hairColor={notification.rivalHairColor}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-[#e68a5c]">
              <Swords className="h-3.5 w-3.5" />
              <span>{notification.title}</span>
            </span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span className="text-white/65">{notification.contextLabel}</span>
            {notification.marginLabel && (
              <>
                <span aria-hidden="true" className="text-white/30">·</span>
                <span className="font-mono-tabular text-[#E7DCC8]">
                  {notification.marginLabel}
                </span>
              </>
            )}
          </div>
          <p className="mt-1.5 text-xs italic leading-relaxed text-white/90">
            {notification.dialogue}
          </p>
          {notification.rewardLabel && (
            <p className="mt-1 text-xs font-medium text-[#38d9c8]">
              {notification.rewardLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TournamentMilestonesBanner({
  milestones,
}: {
  milestones: TournamentMilestoneSummary;
}) {
  const hasAnything =
    milestones.earnedTitles.length > 0 ||
    milestones.completedObjectives.length > 0 ||
    milestones.unlockedAchievements.length > 0;
  if (!hasAnything) return null;

  const achievementDefs = milestones.unlockedAchievements
    .map((id) => CAREER_ACHIEVEMENTS_CATALOG.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <div className="mt-4 rounded-xl border border-[#f4c97a]/40 bg-[#0B2338]/75 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-[#f4c97a]">
        <Sparkles className="h-3.5 w-3.5" />
        <span>MARCOS &amp; RECONHECIMENTO NA ETAPA</span>
      </div>
      <div className="mt-2.5 space-y-2 text-xs">
        {milestones.earnedTitles.map((title) => (
          <div
            key={`title-${title}`}
            className="flex items-center gap-2 rounded-lg border border-[#f4c97a]/35 bg-[#261f12]/70 px-3 py-2 text-white"
          >
            <Crown className="h-4 w-4 shrink-0 text-[#f4c97a]" />
            <span>
              Título conquistado: <strong className="text-[#f4c97a]">{title}</strong>
            </span>
          </div>
        ))}

        {milestones.completedObjectives.map((objTitle) => (
          <div
            key={`obj-${objTitle}`}
            className="flex items-center gap-2 rounded-lg border border-[#38d9c8]/30 bg-[#0B3C5D]/45 px-3 py-2 text-white"
          >
            <Target className="h-4 w-4 shrink-0 text-[#38d9c8]" />
            <span>
              Objetivo cumprido: <strong className="text-white">{objTitle}</strong>
            </span>
          </div>
        ))}

        {achievementDefs.map((ach) => (
          <div
            key={`ach-${ach.id}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#071726]/65 px-3 py-2 text-white/90"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#38d9c8]" />
              <span>
                Conquista: <strong className="text-white">{ach.title}</strong>
                <span className="ml-1.5 text-white/55">— {ach.description}</span>
              </span>
            </div>
            <span className="font-mono-tabular shrink-0 font-semibold text-[#38d9c8]">
              +{ach.repReward} Rep
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompletedRoundsHistory({
  rounds,
  defaultCollapsed = false,
}: {
  rounds: RoundSummary[];
  defaultCollapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0B2338]/50 p-3.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="font-display text-xs font-semibold tracking-[0.06em] text-white/90 sm:text-sm">
          Fases Disputadas no Campeonato ({rounds.length})
        </h3>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#38d9c8]">
          <span>{expanded ? 'Ocultar' : 'Ver chaveamento'}</span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          {rounds.map((r) => (
            <div key={r.round}>
              <div className="text-[11px] font-semibold tracking-[0.08em] text-[#38d9c8]">
                {r.roundLabel}
              </div>
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {r.heats.map((h) => (
                  <div
                    key={h.heatId}
                    className="rounded-lg border border-white/10 bg-[#071726]/65 p-2.5"
                  >
                    <div className="text-[10px] font-medium text-white/55">{h.label}</div>
                    <div className="mt-1 space-y-1">
                      {[...h.competitors]
                        .sort((a, b) => a.heatRank - b.heatRank)
                        .map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 text-[11px]"
                          >
                            <span
                              className={`truncate ${
                                c.isPlayer
                                  ? 'font-semibold text-[#38d9c8]'
                                  : c.advanced
                                    ? 'font-medium text-white'
                                    : 'text-white/45'
                              }`}
                            >
                              {c.heatRank}º {c.name}
                            </span>
                            <span className="font-mono-tabular shrink-0 text-white/75">
                              {c.bestTwoTotal.toFixed(1)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SeasonEndModal({
  summary,
  onAdvanceSeason,
}: {
  summary: SeasonSummary;
  onAdvanceSeason: () => void;
}) {
  const curTier = TIER_MAP[summary.tier];
  const nxtTier = TIER_MAP[summary.nextTier];
  const isChampion = summary.wonWorldTitle || summary.finalRank === 1;

  return (
    <div className="pointer-events-auto mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-white/15 bg-[#071726]/94 shadow-2xl sm:max-h-[calc(100dvh-1.75rem)] lg:max-h-[calc(100dvh-3rem)] lg:overflow-hidden [@media(max-height:600px)]:!overflow-y-auto">
      <div className="relative border-b border-white/10 p-4 sm:p-6 lg:shrink-0 [@media(max-height:600px)]:!shrink">
        <img
          src={CAREER_PHOTOS.twilight}
          alt="Encerramento da Temporada"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#071726] via-[#071726]/88 to-[#071726]/70" />

        <div className="relative z-10 flex items-center gap-3.5 sm:gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border sm:h-14 sm:w-14 ${
              isChampion
                ? 'border-[#f4c97a]/55 bg-[#261f12]/85 text-[#f4c97a]'
                : 'border-[#38d9c8]/40 bg-[#0B3C5D]/80 text-[#38d9c8]'
            }`}
          >
            <Trophy className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div>
            <div
              className={`text-xs font-medium tracking-[0.14em] ${
                isChampion ? 'text-[#f4c97a]' : 'text-[#38d9c8]'
              }`}
            >
              Fechamento da Temporada {summary.season} · {curTier.name}
            </div>
            <h2 className="font-display mt-1 text-xl font-bold text-white sm:text-2xl">
              {summary.wonWorldTitle
                ? 'Campeão Mundial do Circuito!'
                : summary.finalRank === 1
                  ? `Campeão da Divisão ${curTier.shortName}!`
                  : summary.promoted
                    ? `Classificado para o ${nxtTier.name}!`
                    : `Permanece no ${curTier.name}`}
            </h2>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 p-4 sm:p-6 lg:overflow-y-auto [@media(max-height:600px)]:!overflow-visible">
        <p className="text-xs leading-relaxed text-white/80 sm:text-sm">
          {summary.wonWorldTitle
            ? 'Você terminou no topo da elite mundial do FLOW e gravou seu nome na história do circuito.'
            : summary.promoted
              ? `Sua colocação final (#${summary.finalRank}) superou a linha de corte (Top ${curTier.promoteTopN}) e garantiu acesso oficial à próxima divisão.`
              : `Você encerrou a temporada em #${summary.finalRank}. É preciso terminar no Top ${curTier.promoteTopN} do ranking para conquistar promoção ao ${TIER_MAP[summary.tier === 'amador' ? 'regional' : summary.tier === 'regional' ? 'acesso' : 'mundial'].name}.`}
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <MetricBox label="Posição Final" value={`#${summary.finalRank}`} />
          <MetricBox label="Pontuação" value={summary.totalPoints.toLocaleString()} />
          <MetricBox label="Vitórias / Pódios" value={`${summary.wins} / ${summary.podiums}`} />
          <MetricBox label="Ganhos Temporada" value={`$${summary.prizeEarned.toLocaleString()}`} />
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0B2338]/60 px-4 py-3 text-xs text-[#E7DCC8]/85">
          Campeão da temporada: <strong className="text-white">{summary.championName}</strong>
        </div>
      </div>

      <div className="flex justify-end border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4 lg:shrink-0 [@media(max-height:600px)]:!shrink">
        <button
          type="button"
          onClick={onAdvanceSeason}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2596A6] px-6 py-2.5 text-xs font-semibold tracking-[0.1em] text-white transition-colors hover:bg-[#2eb0c2] sm:text-sm"
        >
          <span>INICIAR TEMPORADA {summary.season + 1}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
