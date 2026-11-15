import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cloud,
  CloudRain,
  Compass,
  Lock,
  Medal,
  Minus,
  PlusCircle,
  Sun,
  Swords,
  Target,
  Trophy,
  User,
  Waves,
} from 'lucide-react';
import {
  computeGlobalWorldRanking,
  computeTierStandings,
  getBrandById,
  getTierOrderIndex,
  getTopRivalry,
  RankedCircuitEntry,
} from '../career/careerEngine';
import {
  ACCENT_COLOR_OPTIONS,
  CAREER_ACHIEVEMENTS_CATALOG,
  CAREER_BOARD_CATALOG,
  CAREER_PHOTOS,
  CAREER_SURF_STYLES,
  CAREER_TIERS,
  getCareerReputationLevel,
  HAIR_COLOR_OPTIONS,
  inferAiStyleFocus,
  REPUTATION_LEVELS,
  SKIN_TONE_OPTIONS,
  SPONSOR_BRANDS,
  SUIT_COLOR_OPTIONS,
  TIER_MAP,
} from '../data/careerData';
import { BEACH_SPOTS } from '../data/surfData';
import {
  AISurfer,
  CareerSaveState,
  CareerSurferCustomization,
  CareerTierId,
} from '../types/career';
import { SurfboardSpec, WeatherCondition } from '../types/game';
import { CareerTournamentOverlay } from './CareerTournamentOverlay';
import { SurferAvatar } from './SurferAvatar';

const STYLE_FOCUS_LABEL: Record<'technical' | 'barrel' | 'allround', string> = {
  technical: 'Técnico & Aéreos',
  barrel: 'Especialista em Tubos',
  allround: 'Versátil',
};

function renderWeatherIcon(weather: WeatherCondition) {
  if (weather === 'rainy') return <CloudRain className="h-3.5 w-3.5 text-[#5ec5db]" />;
  if (weather === 'overcast') return <Cloud className="h-3.5 w-3.5 text-slate-300" />;
  return <Sun className="h-3.5 w-3.5 text-[#f4c97a]" />;
}

type CareerTab = 'resumo' | 'calendario' | 'ranking' | 'patrocinios' | 'equipamentos' | 'perfil';

interface CareerHubScreenProps {
  career: CareerSaveState;
  boards: SurfboardSpec[];
  onBackHome: () => void;
  onStartNewCareerFlow: () => void;
  onStartEvent: (eventId: string) => void;
  onLaunchHeat: () => void;
  onAdvanceRound: () => void;
  onCloseFinishedEvent: () => void;
  onCancelPreHeat: () => void;
  onAdvanceSeason: () => void;
  onAcceptSponsor: (brandId: string) => void;
  onDeclineSponsor: (brandId: string) => void;
  onBuyBoard: (boardId: string) => void;
  onEquipBoard: (boardId: string) => void;
  onUpdateAppearance: (patch: Partial<CareerSurferCustomization>) => void;
  onDismissRivalryNotification: (notificationId: string) => void;
}

export const CareerHubScreen: React.FC<CareerHubScreenProps> = ({
  career,
  boards,
  onBackHome,
  onStartNewCareerFlow,
  onStartEvent,
  onLaunchHeat,
  onAdvanceRound,
  onCloseFinishedEvent,
  onCancelPreHeat,
  onAdvanceSeason,
  onAcceptSponsor,
  onDeclineSponsor,
  onBuyBoard,
  onEquipBoard,
  onUpdateAppearance,
  onDismissRivalryNotification,
}) => {
  const [tab, setTab] = useState<CareerTab>('resumo');
  const [rankingFilter, setRankingFilter] = useState<CareerTierId | 'global'>(career.tier);
  const [inspectedOpponent, setInspectedOpponent] = useState<AISurfer | null>(null);
  const [inspectedEventId, setInspectedEventId] = useState<string | null>(null);
  const [confirmNewCareer, setConfirmNewCareer] = useState(false);

  const tierInfo = TIER_MAP[career.tier];
  const nextEvent = career.calendar.find((e) => e.status === 'next') ?? null;
  const completedCount = career.calendar.filter((e) => e.status === 'completed').length;
  const seasonProgressPct = Math.round(
    (completedCount / Math.max(1, career.calendar.length)) * 100
  );

  const repLevel = useMemo(
    () => getCareerReputationLevel(career.reputation),
    [career.reputation]
  );
  const unlockedAchievementIds = career.unlockedAchievements ?? {};
  const unlockedAchievementsCount = Object.keys(unlockedAchievementIds).length;
  const careerObjectives = career.careerObjectives ?? [];
  const completedObjectivesCount = careerObjectives.filter((o) => o.completed).length;
  const titlesWon = career.titlesWon ?? [];

  const currentTierStandings = useMemo(
    () => computeTierStandings(career, career.tier),
    [career]
  );
  const playerStanding = currentTierStandings.find((r) => r.isPlayer);
  const playerRank = playerStanding?.rank ?? 8;

  const displayedRankings: RankedCircuitEntry[] = useMemo(() => {
    if (rankingFilter === 'global') return computeGlobalWorldRanking(career);
    return computeTierStandings(career, rankingFilter);
  }, [career, rankingFilter]);

  const invitedSponsorsCount = career.sponsors.filter((c) => c.status === 'invited').length;
  const activeSponsors = career.sponsors.filter((c) => c.status === 'active');
  const topRivalry = useMemo(() => getTopRivalry(career), [career]);
  const unseenRivalryNotif =
    (career.rivalryNotifications ?? []).find((n) => !n.seen) ?? null;

  // If tournament overlay or season finale overlay is active, render it cleanly
  if (career.activeTournament || career.pendingSeasonSummary) {
    return (
      <CareerTournamentOverlay
        career={career}
        onLaunchHeat={onLaunchHeat}
        onAdvanceRound={onAdvanceRound}
        onCloseFinishedEvent={onCloseFinishedEvent}
        onCancelPreHeat={onCancelPreHeat}
        onAdvanceSeason={onAdvanceSeason}
      />
    );
  }

  return (
    <div className="pointer-events-auto mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col overflow-y-auto rounded-2xl border border-white/15 bg-[#071726]/90 shadow-2xl sm:max-h-[calc(100dvh-1.75rem)] lg:max-h-[calc(100dvh-3rem)] lg:overflow-hidden [@media(max-height:600px)]:!overflow-y-auto">
      {/* MAIN ATHLETE HEADER */}
      <div className="relative border-b border-white/10 px-3.5 py-3 sm:px-5 sm:py-3.5 lg:shrink-0 lg:px-6 lg:py-4 [@media(max-height:600px)]:!shrink">
        <img
          src={CAREER_PHOTOS.reef}
          alt="Circuito Profissional FLOW"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#071726] via-[#071726]/90 to-[#071726]/75" />

        <div className="relative z-10 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <SurferAvatar
                name={career.surfer.name}
                suitColor={career.surfer.suitColor}
                accentColor={career.surfer.accentColor}
                skinTone={career.surfer.skinTone}
                hairColor={career.surfer.hairColor}
                size="md"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium tracking-[0.12em] text-[#38d9c8] sm:text-xs">
                  <span>{tierInfo.name}</span>
                  <span aria-hidden="true" className="text-white/30">·</span>
                  <span className="text-[#E7DCC8]/85">Temporada {career.season}</span>
                </div>
                <h2 className="font-display truncate text-lg font-bold text-white sm:text-xl lg:text-2xl">
                  {career.surfer.name}
                </h2>
                <div className="truncate text-[11px] text-white/65 sm:text-xs">
                  {career.surfer.nationality} ({career.surfer.nationalityCode}) · {career.surfer.stance} ·{' '}
                  <span className="text-[#E7DCC8]">{repLevel.current.title}</span>{' '}
                  (<span className="font-mono-tabular text-white/90">{career.reputation} Rep</span>)
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-[#0B2338]/80 px-2.5 py-1.5 text-xs font-medium text-white/85 transition-colors hover:border-white/30 hover:text-white sm:hidden"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Menu</span>
            </button>
          </div>

          {/* Key Career KPIs */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:flex lg:items-center lg:gap-2.5">
            <HeaderKPI label="Ranking" value={`#${playerRank}`} highlight />
            <HeaderKPI
              label="Premiações"
              value={`$${career.prizeBalance.toLocaleString()}`}
            />
            <HeaderKPI
              label="Temporada"
              value={`${completedCount}/${career.calendar.length} (${seasonProgressPct}%)`}
            />
            <HeaderKPI
              label="Próximo Evento"
              value={nextEvent ? nextEvent.name : 'Concluída'}
              compact
            />
          </div>
        </div>

        {/* Navigation Tabs & Back Button (Single-line scrollable tabs on mobile/landscape) */}
        <div className="relative z-10 mt-2.5 flex items-center justify-between gap-2.5 border-t border-white/10 pt-2.5 sm:mt-3 sm:pt-3">
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1">
            {(
              [
                { id: 'resumo', label: 'Painel', icon: Trophy },
                { id: 'calendario', label: 'Calendário', icon: Calendar },
                { id: 'ranking', label: 'Ranking', icon: Award },
                {
                  id: 'patrocinios',
                  label:
                    invitedSponsorsCount > 0
                      ? `Patrocínios (${invitedSponsorsCount})`
                      : 'Patrocínios',
                  icon: Briefcase,
                },
                { id: 'equipamentos', label: 'Equipamentos', icon: Waves },
                { id: 'perfil', label: 'Perfil & Histórico', icon: User },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                    active
                      ? 'bg-[#2596A6] text-white'
                      : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onBackHome}
            className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/15 bg-[#0B2338]/75 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white sm:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Menu Principal</span>
          </button>
        </div>
      </div>

      {/* BODY CONTENT */}
      <div className="min-h-0 flex-1 p-3.5 sm:p-5 lg:overflow-y-auto lg:p-6 [@media(max-height:600px)]:!overflow-visible">
        {/* RIVALRY / HEAD-TO-HEAD SPOTLIGHT NOTIFICATION */}
        {unseenRivalryNotif && (
          <div className="mb-5 rounded-xl border border-[#e68a5c]/50 bg-[#0B2338]/95 p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="flex items-start gap-3.5">
                <SurferAvatar
                  name={unseenRivalryNotif.rivalName}
                  suitColor={unseenRivalryNotif.rivalSuitColor}
                  accentColor={unseenRivalryNotif.rivalAccentColor}
                  skinTone={unseenRivalryNotif.rivalSkinTone}
                  hairColor={unseenRivalryNotif.rivalHairColor}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#e68a5c]">
                      <Swords className="h-3.5 w-3.5" />
                      <span>
                        {unseenRivalryNotif.kind === 'head_to_head_challenge'
                          ? 'Convocação Head-to-Head'
                          : 'Notificação de Rivalidade'}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-white/30">·</span>
                    <span className="text-white/70">{unseenRivalryNotif.eventName}</span>
                    {unseenRivalryNotif.marginLabel && (
                      <>
                        <span aria-hidden="true" className="text-white/30">·</span>
                        <span className="font-mono-tabular text-[#E7DCC8]">
                          {unseenRivalryNotif.marginLabel}
                        </span>
                      </>
                    )}
                  </div>

                  <h3 className="font-display mt-1 text-base font-bold text-white sm:text-lg">
                    {unseenRivalryNotif.title}
                  </h3>
                  <div className="text-xs text-white/60">
                    {unseenRivalryNotif.rivalNationalityCode} · Nível{' '}
                    <span className="font-mono-tabular text-white/85">
                      {unseenRivalryNotif.rivalSkillLevel}
                    </span>{' '}
                    · {unseenRivalryNotif.rivalStyle}
                  </div>

                  <p className="mt-2.5 text-xs italic leading-relaxed text-white/90 sm:text-sm">
                    {unseenRivalryNotif.dialogue}
                  </p>

                  {unseenRivalryNotif.rewardLabel && (
                    <p className="mt-2 text-xs font-medium text-[#38d9c8]">
                      {unseenRivalryNotif.rewardLabel}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                {unseenRivalryNotif.kind === 'head_to_head_challenge' && nextEvent && (
                  <button
                    type="button"
                    onClick={() => {
                      onDismissRivalryNotification(unseenRivalryNotif.id);
                      onStartEvent(nextEvent.id);
                    }}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#e68a5c] px-4 py-2 text-xs font-semibold text-[#071726] transition-colors hover:bg-[#f2a679]"
                  >
                    <span>Aceitar e Disputar Etapa</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDismissRivalryNotification(unseenRivalryNotif.id)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-white/85 transition-colors hover:bg-white/12 hover:text-white"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {tab === 'resumo' && (
          <div className="space-y-6">
            {/* Hero Next Championship Card */}
            {nextEvent ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0B2338]">
                <img
                  src={CAREER_PHOTOS[nextEvent.photoKey]}
                  alt={nextEvent.name}
                  referrerPolicy="no-referrer"
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#071726]/95 via-[#071726]/78 to-[#071726]/45" />

                <div className="relative z-10 flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5 lg:items-end lg:p-7">
                  <div className="min-w-0 max-w-xl">
                    <div className="text-[11px] font-medium tracking-[0.14em] text-[#38d9c8] sm:text-xs">
                      Próximo Campeonato · {nextEvent.deadlineLabel}
                    </div>
                    <h3 className="font-display mt-1 text-xl font-bold text-white sm:text-2xl lg:text-3xl">
                      {nextEvent.name}
                    </h3>
                    <p className="mt-1 text-xs text-[#E7DCC8]/90 sm:text-sm">
                      {nextEvent.location} · Ondas {nextEvent.waveHeightLabel} ·{' '}
                      {nextEvent.swellConditions}
                    </p>
                    <div className="font-mono-tabular mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/80 sm:mt-3 sm:gap-x-4 sm:text-xs">
                      <span>Premiação: ${nextEvent.prizePool.toLocaleString()}</span>
                      <span aria-hidden="true" className="text-white/30">·</span>
                      <span>1º Lugar: {nextEvent.pointsFirst.toLocaleString()} pts</span>
                      <span aria-hidden="true" className="text-white/30">·</span>
                      <span>
                        Prancha:{' '}
                        {boards.find((b) => b.id === career.equippedBoardId)?.name ?? 'Vortex 6.0'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => onStartEvent(nextEvent.id)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2596A6] px-5 py-2.5 text-xs font-semibold tracking-[0.12em] text-white shadow-lg transition-colors hover:bg-[#2eb0c2] sm:w-auto sm:px-6 sm:py-3 sm:text-sm"
                    >
                      <span>INICIAR CAMPEONATO</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-[#0B2338]/70 p-6 text-center">
                <p className="text-sm text-white/85">Todas as etapas desta temporada foram concluídas.</p>
              </div>
            )}

            {/* 4-Tier Progression Ladder & Season Goal */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="rounded-xl border border-white/12 bg-[#0B2338]/60 p-5 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-display text-sm font-semibold text-white">
                    Escalada Profissional (4 Divisões)
                  </h4>
                  <span className="text-xs text-[#38d9c8]">
                    {career.tier === 'mundial'
                      ? 'Meta: Top 1 para Título Mundial'
                      : `Meta de acesso: Top ${tierInfo.promoteTopN} no ranking`}
                  </span>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {CAREER_TIERS.map((t) => {
                    const curIdx = getTierOrderIndex(career.tier);
                    const tIdx = getTierOrderIndex(t.id);
                    const isCurrent = t.id === career.tier;
                    const isUnlocked = tIdx <= curIdx;
                    return (
                      <div
                        key={t.id}
                        className={`rounded-xl border p-3 ${
                          isCurrent
                            ? 'border-[#38d9c8]/75 bg-[#0B3C5D]/70'
                            : isUnlocked
                              ? 'border-white/20 bg-white/[0.04]'
                              : 'border-white/8 bg-[#071726]/45 opacity-60'
                        }`}
                      >
                        <div className="font-mono-tabular text-[10px] text-white/50">
                          Divisão {t.order}
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-white">
                          {t.shortName}
                        </div>
                        <div className="mt-1 text-[11px] text-[#E7DCC8]/75">
                          {isCurrent
                            ? `Atual · #${playerRank}`
                            : isUnlocked
                              ? 'Concluída'
                              : `Requer Top ${CAREER_TIERS[tIdx - 1]?.promoteTopN ?? 2}`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Season Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>Progresso da Temporada {career.season}</span>
                    <span className="font-mono-tabular text-white">
                      {completedCount} de {career.calendar.length} etapas
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#071726]">
                    <div
                      className="h-full rounded-full bg-[#2596A6] transition-all duration-300"
                      style={{ width: `${seasonProgressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Active Sponsors & Quick Ranking */}
              <div className="space-y-4 lg:col-span-5">
                <div className="rounded-xl border border-white/12 bg-[#0B2338]/60 p-5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-sm font-semibold text-white">
                      Top 3 do Circuito Atual
                    </h4>
                    <button
                      type="button"
                      onClick={() => setTab('ranking')}
                      className="text-xs font-medium text-[#38d9c8] hover:underline"
                    >
                      Ver tabela
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {currentTierStandings.slice(0, 3).map((r) => (
                      <div
                        key={r.id}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                          r.isPlayer
                            ? 'border border-[#38d9c8]/50 bg-[#2596A6]/20 text-white'
                            : 'bg-white/[0.03] text-white/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular font-bold text-white/70">
                            #{r.rank}
                          </span>
                          <span className="font-semibold">{r.name}</span>
                          <span className="text-[10px] text-white/45">{r.nationalityCode}</span>
                        </div>
                        <span className="font-mono-tabular font-semibold text-[#E7DCC8]">
                          {r.points.toLocaleString()} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/12 bg-[#0B2338]/60 p-5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-sm font-semibold text-white">
                      Patrocinadores
                    </h4>
                    <button
                      type="button"
                      onClick={() => setTab('patrocinios')}
                      className="text-xs font-medium text-[#38d9c8] hover:underline"
                    >
                      {invitedSponsorsCount > 0
                        ? `${invitedSponsorsCount} convite(s)`
                        : 'Gerenciar'}
                    </button>
                  </div>
                  {activeSponsors.length === 0 ? (
                    <p className="mt-2 text-xs text-white/60">
                      {invitedSponsorsCount > 0
                        ? 'Você possui convites de patrocínio aguardando resposta!'
                        : 'Dispute campeonatos para conquistar reputação e receber contratos.'}
                    </p>
                  ) : (
                    <div className="mt-2.5 space-y-2">
                      {activeSponsors.map((c) => {
                        const brand = getBrandById(c.brandId);
                        if (!brand) return null;
                        return (
                          <div
                            key={c.brandId}
                            className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs"
                          >
                            <div>
                              <div className="font-semibold text-white">{brand.name}</div>
                              <div className="text-[11px] text-white/55">{brand.objectiveLabel}</div>
                            </div>
                            <span className="font-mono-tabular text-[#38d9c8]">
                              {c.progress}/{c.target}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Reputation Level + Active Career Objectives */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Reputation & Career Standing */}
              <div className="rounded-xl border border-white/12 bg-[#0B2338]/60 p-5 lg:col-span-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Medal className="h-4 w-4 text-[#38d9c8]" />
                    <h4 className="font-display text-sm font-semibold text-white">
                      Reputação Profissional
                    </h4>
                  </div>
                  <span className="font-mono-tabular text-xs font-semibold text-[#38d9c8]">
                    Nível {repLevel.levelIndex}/{REPUTATION_LEVELS.length}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <div className="font-display text-lg font-bold text-white">
                    {repLevel.current.title}
                  </div>
                  <div className="font-mono-tabular text-xs text-[#E7DCC8]">
                    {career.reputation}
                    {repLevel.current.nextRep !== null ? ` / ${repLevel.current.nextRep} pts` : ' pts (Máx.)'}
                  </div>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#071726]">
                  <div
                    className="h-full rounded-full bg-[#38d9c8] transition-all duration-300"
                    style={{ width: `${repLevel.progressPct}%` }}
                  />
                </div>

                <div className="font-mono-tabular mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-white/50">Títulos</div>
                    <div className="font-bold text-[#f4c97a]">{titlesWon.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/50">Conquistas</div>
                    <div className="font-bold text-white">
                      {unlockedAchievementsCount}/{CAREER_ACHIEVEMENTS_CATALOG.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/50">Objetivos</div>
                    <div className="font-bold text-[#38d9c8]">
                      {completedObjectivesCount}/{careerObjectives.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Career Objectives & Challenges */}
              <div className="rounded-xl border border-white/12 bg-[#0B2338]/60 p-5 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#38d9c8]" />
                    <h4 className="font-display text-sm font-semibold text-white">
                      Objetivos &amp; Desafios da Carreira
                    </h4>
                  </div>
                  <span className="font-mono-tabular text-xs text-white/60">
                    {completedObjectivesCount} de {careerObjectives.length} concluídos
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {careerObjectives.slice(0, 6).map((obj) => {
                    const pct = Math.min(
                      100,
                      Math.round((obj.progress / Math.max(0.1, obj.targetValue)) * 100)
                    );
                    const progressText = Number.isInteger(obj.targetValue)
                      ? `${Math.floor(obj.progress)}/${obj.targetValue}`
                      : `${obj.progress.toFixed(1)}/${obj.targetValue.toFixed(1)}`;
                    return (
                      <div
                        key={obj.id}
                        className={`rounded-xl border p-3 ${
                          obj.completed
                            ? 'border-[#38d9c8]/50 bg-[#0B3C5D]/45'
                            : 'border-white/10 bg-[#071726]/45'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                              {obj.completed && (
                                <Check className="h-3.5 w-3.5 shrink-0 text-[#38d9c8]" />
                              )}
                              <span className="truncate">{obj.title}</span>
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/60">
                              {obj.description}
                            </p>
                          </div>
                          <span className="font-mono-tabular shrink-0 text-[11px] font-semibold text-[#E7DCC8]">
                            {progressText}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#071726]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                obj.completed ? 'bg-[#38d9c8]' : 'bg-[#2596A6]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono-tabular shrink-0 text-[10px] text-[#f4c97a]">
                            +${obj.rewardPrize} · +{obj.rewardRep} Rep
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Rivalry & Head-to-Head Spotlight */}
            <div className="rounded-xl border border-white/12 bg-[#0B2338]/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Swords className="h-4 w-4 text-[#e68a5c]" />
                  <h4 className="font-display text-sm font-semibold text-white">
                    Rivalidades &amp; Duelos Head-to-Head
                  </h4>
                </div>
                {topRivalry && (
                  <span className="text-xs font-medium text-[#e68a5c]">
                    {topRivalry.record.activeChallenge
                      ? 'Duelo Head-to-Head Confirmado na Próxima Etapa'
                      : topRivalry.record.intensity === 3
                        ? 'Arqui-Rivalidade'
                        : topRivalry.record.intensity === 2
                          ? 'Rivalidade Direta'
                          : 'Disputa Acirrada'}
                  </span>
                )}
              </div>

              {topRivalry ? (
                <div className="mt-3.5 flex flex-col justify-between gap-4 border-t border-white/10 pt-3.5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3.5">
                    <SurferAvatar
                      name={topRivalry.ai.name}
                      suitColor={topRivalry.ai.suitColor}
                      accentColor={topRivalry.ai.accentColor}
                      skinTone={topRivalry.ai.skinTone}
                      hairColor={topRivalry.ai.hairColor}
                      size="md"
                    />
                    <div>
                      <div className="text-sm font-bold text-white">
                        {topRivalry.ai.name}{' '}
                        <span className="text-xs font-normal text-white/55">
                          ({topRivalry.ai.nationalityCode}) · Nível {topRivalry.ai.skillLevel}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-white/70">
                        {topRivalry.ai.style} · Último encontro: {topRivalry.record.lastEventName} (
                        {topRivalry.record.lastMarginPts.toFixed(1)} pts)
                      </div>
                      {topRivalry.record.activeChallenge && (
                        <div className="mt-1 text-xs font-medium text-[#38d9c8]">
                          Prêmio extra de duelo: +$
                          {topRivalry.record.challengeBonusPrize.toLocaleString()} e +
                          {topRivalry.record.challengeBonusRep} Rep.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="font-mono-tabular text-left sm:text-right">
                      <div className="text-[10px] text-white/50">Placar Direto</div>
                      <div className="text-base font-bold text-white">
                        Você {topRivalry.record.playerWins} × {topRivalry.record.rivalWins}{' '}
                        {topRivalry.ai.name.split(' ')[0]}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRankingFilter(topRivalry.ai.tier);
                        setInspectedOpponent(topRivalry.ai);
                        setTab('ranking');
                      }}
                      className="min-h-[40px] rounded-lg border border-white/20 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-white/[0.12]"
                    >
                      Analisar Rival
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2.5 text-xs text-white/60">
                  Dispute baterias lado a lado contra os atletas mais fortes do circuito. Finalizações apertadas (diferença &le; 2.1 pts) despertam diálogos exclusivos e desafios Head-to-Head com bônus de premiação.
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SEASON CALENDAR */}
        {tab === 'calendario' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Calendário do Circuito — Temporada {career.season} ({tierInfo.name})
                </h3>
                <p className="text-xs text-white/65">
                  Acompanhe destinos, previsões do mar e resultados detalhados de cada etapa anterior.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {career.calendar.map((ev) => {
                const beach = BEACH_SPOTS.find((b) => b.id === ev.beachId);
                const isExpanded = inspectedEventId === ev.id;
                return (
                  <div
                    key={ev.id}
                    className={`relative overflow-hidden rounded-xl border p-4 sm:p-5 ${
                      ev.status === 'next'
                        ? 'border-[#38d9c8]/70 bg-[#0B3C5D]/45'
                        : ev.status === 'completed'
                          ? 'border-white/12 bg-[#0B2338]/55'
                          : 'border-white/10 bg-[#0B2338]/40'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`font-semibold ${
                              ev.status === 'next'
                                ? 'text-[#38d9c8]'
                                : ev.status === 'completed'
                                  ? 'text-[#E7DCC8]'
                                  : 'text-white/55'
                            }`}
                          >
                            {ev.status === 'next'
                              ? 'Próximo Evento'
                              : ev.status === 'completed'
                                ? 'Concluído'
                                : 'Evento Futuro'}
                          </span>
                          <span aria-hidden="true" className="text-white/25">·</span>
                          <span className="text-white/60">{ev.deadlineLabel}</span>
                          <span aria-hidden="true" className="text-white/25">·</span>
                          <span className="inline-flex items-center gap-1 text-white/75">
                            <Compass className="h-3 w-3 text-[#38d9c8]" />
                            {beach?.name ?? ev.location}
                          </span>
                        </div>

                        <h4 className="font-display mt-1 text-base font-bold text-white sm:text-lg">
                          {ev.orderIndex + 1}. {ev.name}
                        </h4>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/65">
                          <span className="font-mono-tabular">Ondas {ev.waveHeightLabel}</span>
                          <span aria-hidden="true" className="text-white/25">·</span>
                          <span className="inline-flex items-center gap-1">
                            {renderWeatherIcon(ev.weather)}
                            {ev.swellConditions}
                          </span>
                          <span aria-hidden="true" className="text-white/25">·</span>
                          <span className="font-mono-tabular">
                            Bolsa ${ev.prizePool.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {ev.status === 'next' && (
                          <button
                            type="button"
                            onClick={() => onStartEvent(ev.id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#2596A6] px-4 py-2 text-xs font-semibold tracking-wider text-white transition-colors hover:bg-[#2eb0c2]"
                          >
                            <span>Disputar Etapa</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {ev.status === 'completed' && ev.result && (
                          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                            <div className="text-left sm:text-right">
                              <div className="font-mono-tabular text-sm font-bold text-white">
                                {ev.result.placement}º Lugar · +{ev.result.pointsEarned} pts
                              </div>
                              <div className="font-mono-tabular text-xs text-[#E7DCC8]/80">
                                Melhor bateria {ev.result.bestHeatTotal.toFixed(1)} · Campeão:{' '}
                                <span className="text-white">{ev.result.championName}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setInspectedEventId((prev) => (prev === ev.id ? null : ev.id))
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/[0.12] hover:text-white"
                            >
                              <span>{isExpanded ? 'Ocultar' : 'Resultados'}</span>
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                        {ev.status === 'upcoming' && (
                          <span className="text-xs text-white/45">Aguardando etapa anterior</span>
                        )}
                      </div>
                    </div>

                    {/* Expanded Completed Stage Results Breakdown */}
                    {ev.status === 'completed' && ev.result && isExpanded && (
                      <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                        <div className="font-mono-tabular grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                          <div className="rounded-lg border border-white/10 bg-[#071726]/55 px-3 py-2">
                            <div className="text-[10px] text-white/50">Melhor Somatório</div>
                            <div className="text-sm font-bold text-white">
                              {ev.result.bestHeatTotal.toFixed(1)} / 20
                            </div>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-[#071726]/55 px-3 py-2">
                            <div className="text-[10px] text-white/50">Melhor Onda</div>
                            <div className="text-sm font-bold text-[#38d9c8]">
                              {ev.result.bestWave.toFixed(1)} / 10
                            </div>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-[#071726]/55 px-3 py-2">
                            <div className="text-[10px] text-white/50">Manobras Validadas</div>
                            <div className="text-sm font-bold text-white">
                              {ev.result.maneuversLanded}
                            </div>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-[#071726]/55 px-3 py-2">
                            <div className="text-[10px] text-white/50">Premiação Recebida</div>
                            <div className="text-sm font-bold text-[#f4c97a]">
                              +${ev.result.prizeEarned.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#071726]/55">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-white/10 text-white/50">
                              <tr>
                                <th className="px-3 py-2 font-medium">Pos.</th>
                                <th className="px-3 py-2 font-medium">Surfista</th>
                                <th className="px-3 py-2 font-medium text-right">Melhor Bateria</th>
                                <th className="px-3 py-2 font-medium text-right">Pontos</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/8">
                              {ev.result.topStandings.map((row) => (
                                <tr
                                  key={row.competitorId}
                                  className={
                                    row.isPlayer ? 'bg-[#2596A6]/18 text-white' : 'text-white/80'
                                  }
                                >
                                  <td className="font-mono-tabular px-3 py-2 font-semibold">
                                    {row.placement}º
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="font-semibold">{row.name}</span>
                                    <span className="ml-1.5 text-[10px] text-white/45">
                                      {row.nationalityCode}
                                    </span>
                                  </td>
                                  <td className="font-mono-tabular px-3 py-2 text-right">
                                    {row.bestHeatTotal.toFixed(1)}
                                  </td>
                                  <td className="font-mono-tabular px-3 py-2 text-right text-[#38d9c8]">
                                    +{row.pointsEarned.toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: WORLD & CIRCUIT RANKING */}
        {tab === 'ranking' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Ranking &amp; Classificação
                </h3>
                <p className="text-xs text-white/65">
                  Clique em qualquer adversário para analisar habilidades, estilo e histórico de resultados.
                </p>
              </div>

              <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1">
                {CAREER_TIERS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setRankingFilter(t.id)}
                    className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      rankingFilter === t.id
                        ? 'bg-[#2596A6] text-white'
                        : 'text-white/65 hover:text-white'
                    }`}
                  >
                    {t.shortName}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRankingFilter('global')}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    rankingFilter === 'global'
                      ? 'bg-[#2596A6] text-white'
                      : 'text-white/65 hover:text-white'
                  }`}
                >
                  Mundial Geral
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div
                className={`overflow-hidden rounded-xl border border-white/12 bg-[#0B2338]/60 ${
                  inspectedOpponent ? 'lg:col-span-8' : 'lg:col-span-12'
                }`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 text-white/55">
                      <tr>
                        <th className="px-3.5 py-2.5 font-medium">Pos.</th>
                        <th className="px-3.5 py-2.5 font-medium">Evol.</th>
                        <th className="px-3.5 py-2.5 font-medium">Surfista</th>
                        <th className="hidden px-3.5 py-2.5 font-medium sm:table-cell">Estilo</th>
                        <th className="px-3.5 py-2.5 font-medium text-right">Pontos</th>
                        <th className="hidden px-3.5 py-2.5 font-medium text-right md:table-cell">
                          Distância
                        </th>
                        <th className="px-3.5 py-2.5 font-medium text-right">Forma</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8">
                      {displayedRankings.map((row) => {
                        const isPromotionCut =
                          rankingFilter !== 'global' &&
                          rankingFilter === career.tier &&
                          tierInfo.promoteTopN > 0 &&
                          row.rank <= tierInfo.promoteTopN;
                        return (
                          <tr
                            key={row.id}
                            onClick={() => {
                              if (row.aiProfile) setInspectedOpponent(row.aiProfile);
                            }}
                            className={`transition-colors ${
                              row.isPlayer
                                ? 'bg-[#2596A6]/22 text-white'
                                : row.aiProfile
                                  ? 'cursor-pointer text-white/85 hover:bg-white/[0.06]'
                                  : 'text-white/80'
                            }`}
                          >
                            <td className="font-mono-tabular px-3.5 py-2.5 font-bold">
                              <span className={isPromotionCut ? 'text-[#38d9c8]' : ''}>
                                #{row.rank}
                              </span>
                            </td>
                            <td className="font-mono-tabular px-3.5 py-2.5">
                              {row.delta > 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-[#38d9c8]">
                                  <ArrowUp className="h-3 w-3" />
                                  {row.delta}
                                </span>
                              ) : row.delta < 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-[#e68a5c]">
                                  <ArrowDown className="h-3 w-3" />
                                  {Math.abs(row.delta)}
                                </span>
                              ) : (
                                <Minus className="h-3 w-3 text-white/35" />
                              )}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <div className="font-semibold">
                                {row.name}{' '}
                                <span className="ml-1 text-[10px] font-normal text-white/50">
                                  {row.nationalityCode}
                                </span>
                                {(() => {
                                  const riv = !row.isPlayer
                                    ? (career.rivalries ?? []).find((r) => r.rivalId === row.id)
                                    : undefined;
                                  if (!riv) return null;
                                  return (
                                    <span className="ml-1.5 text-[11px] font-medium text-[#e68a5c]">
                                      · {riv.activeChallenge ? 'Head-to-Head' : 'Rival'}
                                    </span>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="hidden px-3.5 py-2.5 text-white/60 sm:table-cell">
                              <div>{row.style}</div>
                              {row.aiProfile && (
                                <div className="text-[10px] text-[#38d9c8]/85">
                                  {STYLE_FOCUS_LABEL[row.aiProfile.styleFocus ?? inferAiStyleFocus(row.aiProfile)]}
                                </div>
                              )}
                            </td>
                            <td className="font-mono-tabular px-3.5 py-2.5 text-right font-semibold">
                              {row.points.toLocaleString()}
                            </td>
                            <td className="font-mono-tabular hidden px-3.5 py-2.5 text-right text-white/60 md:table-cell">
                              {row.gapToLeader === 0
                                ? 'Líder'
                                : `-${row.gapToLeader.toLocaleString()}`}
                            </td>
                            <td className="font-mono-tabular px-3.5 py-2.5 text-right text-white/75">
                              {row.recentResults.length > 0
                                ? row.recentResults
                                    .slice(0, 3)
                                    .map((p) => `${p}º`)
                                    .join(' · ')
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Opponent Inspector Panel */}
              {inspectedOpponent && (
                <div className="rounded-xl border border-white/15 bg-[#0B2338]/85 p-4 lg:col-span-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <SurferAvatar
                        name={inspectedOpponent.name}
                        suitColor={inspectedOpponent.suitColor}
                        accentColor={inspectedOpponent.accentColor}
                        skinTone={inspectedOpponent.skinTone}
                        hairColor={inspectedOpponent.hairColor}
                        size="md"
                      />
                      <div>
                        <div className="text-sm font-bold text-white">{inspectedOpponent.name}</div>
                        <div className="text-xs text-white/60">
                          {inspectedOpponent.nationality} ({inspectedOpponent.nationalityCode}) ·{' '}
                          {inspectedOpponent.stance}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectedOpponent(null)}
                      className="text-xs text-white/50 hover:text-white"
                    >
                      Fechar
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-[#E7DCC8]/85">{inspectedOpponent.style}</p>
                  <div className="mt-1 text-[11px] font-medium text-[#38d9c8]">
                    Perfil IA:{' '}
                    {STYLE_FOCUS_LABEL[inspectedOpponent.styleFocus ?? inferAiStyleFocus(inspectedOpponent)]}
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <StatBar label="Nível Geral" pct={inspectedOpponent.skillLevel} />
                    <StatBar
                      label="Leitura de Tubos"
                      pct={Math.round(inspectedOpponent.barrelSkill * 100)}
                    />
                    <StatBar
                      label="Aéreos & Explosão"
                      pct={Math.round(inspectedOpponent.airSkill * 100)}
                    />
                    <StatBar
                      label="Consistência"
                      pct={Math.round(inspectedOpponent.consistency * 100)}
                    />
                  </div>

                  <div className="font-mono-tabular mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center text-xs">
                    <div>
                      <div className="text-[10px] text-white/50">Vitórias</div>
                      <div className="font-bold text-white">{inspectedOpponent.wins}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/50">Pódios</div>
                      <div className="font-bold text-white">{inspectedOpponent.podiums}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/50">Melhor Onda</div>
                      <div className="font-bold text-[#38d9c8]">
                        {inspectedOpponent.bestWave > 0 ? inspectedOpponent.bestWave.toFixed(1) : '—'}
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const riv = (career.rivalries ?? []).find(
                      (r) => r.rivalId === inspectedOpponent.id
                    );
                    if (!riv) return null;
                    return (
                      <div className="mt-4 border-t border-white/10 pt-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#e68a5c]">
                            <Swords className="h-3.5 w-3.5" />
                            <span>Histórico Head-to-Head</span>
                          </span>
                          <span className="font-mono-tabular font-bold text-white">
                            {riv.playerWins} × {riv.rivalWins}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-white/65">
                          {riv.closeFinishes} chegada(s) acirrada(s) · Última margem:{' '}
                          <span className="font-mono-tabular text-[#E7DCC8]">
                            {riv.lastMarginPts.toFixed(1)} pts
                          </span>
                        </p>
                        {riv.activeChallenge && (
                          <p className="mt-1 text-[11px] font-medium text-[#38d9c8]">
                            Duelo Head-to-Head ativo para o próximo campeonato (+$
                            {riv.challengeBonusPrize.toLocaleString()}).
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SPONSORS */}
        {tab === 'patrocinios' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                Patrocínios &amp; Contratos
              </h3>
              <p className="text-xs text-white/65">
                Sua reputação atual (<span className="font-mono-tabular text-white">{career.reputation} pts</span>) e divisão determinam os convites de marcas.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {SPONSOR_BRANDS.map((brand) => {
                const contract = career.sponsors.find((c) => c.brandId === brand.id);
                const rewardBoard = brand.rewardBoardId
                  ? boards.find((b) => b.id === brand.rewardBoardId)
                  : null;
                return (
                  <div
                    key={brand.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 ${
                      contract?.status === 'invited'
                        ? 'border-[#38d9c8]/75 bg-[#0B3C5D]/55'
                        : contract?.status === 'active'
                          ? 'border-[#2596A6]/60 bg-[#0B2338]/85'
                          : 'border-white/10 bg-[#0B2338]/55'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-medium tracking-wider text-white/55">
                            {brand.category}
                          </div>
                          <h4 className="font-display text-base font-bold text-white">
                            {brand.name}
                          </h4>
                          <p className="mt-0.5 text-xs text-white/65">{brand.tagline}</p>
                        </div>

                        <span className="text-xs font-semibold text-[#38d9c8]">
                          {contract?.status === 'invited'
                            ? 'Convite Recebido'
                            : contract?.status === 'active'
                              ? 'Contrato Ativo'
                              : contract?.status === 'completed'
                                ? 'Objetivo Concluído'
                                : contract?.status === 'expired'
                                  ? 'Encerrado'
                                  : `Req: ${TIER_MAP[brand.minTier].shortName} · ${brand.minReputation} rep`}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-[#E7DCC8]/90">
                        <div>Objetivo: {brand.objectiveLabel}</div>
                        <div className="font-mono-tabular text-white/75">
                          Duração: {brand.durationEvents} etapas · Fixo: +${brand.stipendPerEvent}/etapa ·
                          Bônus final: +${brand.completionBonus} · +{Math.round(brand.prizeMultiplierBonus * 100)}% premiação
                        </div>
                        {rewardBoard && (
                          <div className="text-[#38d9c8]">
                            Recompensa extra: desbloqueia prancha {rewardBoard.name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-3">
                      {contract?.status === 'invited' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onAcceptSponsor(brand.id)}
                            className="rounded-lg bg-[#2596A6] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2eb0c2]"
                          >
                            Assinar Contrato
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeclineSponsor(brand.id)}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/65 hover:text-white"
                          >
                            Recusar
                          </button>
                        </div>
                      )}

                      {contract?.status === 'active' && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/70">
                            Progresso:{' '}
                            <strong className="font-mono-tabular text-white">
                              {contract.progress}/{contract.target}
                            </strong>
                          </span>
                          <span className="font-mono-tabular text-[#E7DCC8]">
                            Restam {contract.eventsRemaining} etapas
                          </span>
                        </div>
                      )}

                      {contract?.status === 'completed' && (
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#38d9c8]">
                          <Check className="h-3.5 w-3.5" />
                          <span>Contrato cumprido e bônus pago</span>
                        </div>
                      )}

                      {!contract && (
                        <div className="inline-flex items-center gap-1.5 text-xs text-white/45">
                          <Lock className="h-3.5 w-3.5" />
                          <span>Eleve sua reputação e divisão para desbloquear convite</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: EQUIPMENT / QUIVER */}
        {tab === 'equipamentos' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Quiver &amp; Equipamentos
                </h3>
                <p className="text-xs text-white/65">
                  Use seu saldo de premiações (<strong className="font-mono-tabular text-[#f4c97a]">${career.prizeBalance.toLocaleString()}</strong>) para adquirir pranchas de alta performance.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((b) => {
                const catalog = CAREER_BOARD_CATALOG.find((c) => c.id === b.id);
                const unlocked = career.unlockedBoardIds.includes(b.id);
                const equipped = career.equippedBoardId === b.id;
                const tierOk =
                  !catalog ||
                  getTierOrderIndex(career.tier) >= getTierOrderIndex(catalog.tierRequired);
                const canAfford = catalog ? career.prizeBalance >= catalog.price : true;

                return (
                  <div
                    key={b.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 ${
                      equipped
                        ? 'border-[#38d9c8]/80 bg-[#0B3C5D]/60'
                        : 'border-white/12 bg-[#0B2338]/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium tracking-wider text-[#38d9c8]">
                          {b.category}
                        </span>
                        <span
                          className="h-3 w-3 rounded-full border border-white/30"
                          style={{ backgroundColor: b.railColor }}
                        />
                      </div>
                      <h4 className="font-display mt-1 text-base font-bold text-white">{b.name}</h4>
                      <div className="font-mono-tabular mt-0.5 text-xs text-[#E7DCC8]/80">
                        {b.dimensions} · {b.volume} · {b.finSetup}
                      </div>
                      {catalog && (
                        <p className="mt-2 text-xs leading-relaxed text-white/65">
                          {catalog.perks}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-3">
                      {equipped ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#38d9c8]">
                          <Check className="h-3.5 w-3.5" />
                          <span>Equipada para competições</span>
                        </div>
                      ) : unlocked ? (
                        <button
                          type="button"
                          onClick={() => onEquipBoard(b.id)}
                          className="w-full rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                        >
                          Equipar Prancha
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono-tabular text-xs font-semibold text-[#f4c97a]">
                            ${catalog?.price.toLocaleString() ?? 0}
                          </span>
                          <button
                            type="button"
                            disabled={!tierOk || !canAfford}
                            onClick={() => onBuyBoard(b.id)}
                            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                              tierOk && canAfford
                                ? 'bg-[#2596A6] text-white hover:bg-[#2eb0c2]'
                                : 'cursor-not-allowed border border-white/10 bg-white/[0.04] text-white/40'
                            }`}
                          >
                            {!tierOk
                              ? `Req: ${TIER_MAP[catalog!.tierRequired].shortName}`
                              : !canAfford
                                ? 'Saldo Insuficiente'
                                : 'Comprar'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 6: PROFILE, CUSTOMIZATION & HISTORY */}
        {tab === 'perfil' && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-12 lg:gap-6">
            {/* Appearance Live Editor */}
            <div className="space-y-4 rounded-xl border border-white/12 bg-[#0B2338]/60 p-4 sm:p-5 md:col-span-5">
              <h3 className="font-display text-base font-bold text-white">
                Personalizar Aparência &amp; Estilo
              </h3>

              <div>
                <span className="text-xs text-white/70">Traje / Wetsuit</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {SUIT_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => onUpdateAppearance({ suitColor: c.hex })}
                      aria-label={`Wetsuit ${c.label}`}
                      className={`h-7 w-7 rounded-full border-2 ${
                        career.surfer.suitColor === c.hex ? 'border-[#38d9c8]' : 'border-white/25'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs text-white/70">Cor de Destaque</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {ACCENT_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => onUpdateAppearance({ accentColor: c.hex })}
                      aria-label={`Destaque ${c.label}`}
                      className={`h-7 w-7 rounded-full border-2 ${
                        career.surfer.accentColor === c.hex ? 'border-white' : 'border-white/25'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-white/70">Pele</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {SKIN_TONE_OPTIONS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => onUpdateAppearance({ skinTone: c.hex })}
                        aria-label={`Pele ${c.label}`}
                        className={`h-6 w-6 rounded-full border-2 ${
                          career.surfer.skinTone === c.hex ? 'border-[#38d9c8]' : 'border-white/20'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-white/70">Cabelo</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {HAIR_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => onUpdateAppearance({ hairColor: c.hex })}
                        aria-label={`Cabelo ${c.label}`}
                        className={`h-6 w-6 rounded-full border-2 ${
                          career.surfer.hairColor === c.hex ? 'border-[#38d9c8]' : 'border-white/20'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs text-white/70">Base &amp; Estilo</span>
                <div className="mt-1.5 flex gap-2">
                  {(['Regular', 'Goofy'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => onUpdateAppearance({ stance: st })}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                        career.surfer.stance === st
                          ? 'border-[#38d9c8] bg-[#2596A6] text-white'
                          : 'border-white/15 text-white/65'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <select
                  value={career.surfer.style}
                  onChange={(e) => onUpdateAppearance({ style: e.target.value })}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-[#071726] px-3 py-1.5 text-xs text-white"
                >
                  {CAREER_SURF_STYLES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-white/10 pt-3">
                {!confirmNewCareer ? (
                  <button
                    type="button"
                    onClick={() => setConfirmNewCareer(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#e68a5c] hover:underline"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Criar Nova Carreira</span>
                  </button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-[#e68a5c]/40 bg-[#e68a5c]/10 p-3 text-xs">
                    <p className="text-white/90">
                      Iniciar uma nova carreira substituirá o progresso atual. Deseja continuar?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={onStartNewCareerFlow}
                        className="rounded-md bg-[#e68a5c] px-3 py-1 font-semibold text-[#071726]"
                      >
                        Sim, Nova Carreira
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmNewCareer(false)}
                        className="rounded-md border border-white/20 px-3 py-1 text-white/75"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Career History & Past Seasons */}
            <div className="space-y-4 md:col-span-7">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <HeaderKPI label="Vitórias" value={`${career.wins}`} />
                <HeaderKPI label="Pódios" value={`${career.podiums}`} />
                <HeaderKPI
                  label="Melhor Onda"
                  value={career.bestWave > 0 ? career.bestWave.toFixed(1) : '—'}
                />
                <HeaderKPI
                  label="Ganhos Totais"
                  value={`$${career.totalCareerEarnings.toLocaleString()}`}
                />
              </div>

              {/* Titles & Trophy Room */}
              <div className="rounded-xl border border-white/12 bg-[#0B2338]/60 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-[#f4c97a]" />
                    <h3 className="font-display text-base font-bold text-white">
                      Sala de Troféus &amp; Títulos Conquistados
                    </h3>
                  </div>
                  <span className="font-mono-tabular text-xs font-semibold text-[#f4c97a]">
                    {titlesWon.length} título(s)
                  </span>
                </div>

                {titlesWon.length === 0 ? (
                  <p className="mt-2 text-xs text-white/60">
                    Vença uma etapa ou encerre uma temporada em 1º lugar para gravar seu primeiro troféu oficial.
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {titlesWon.map((title) => (
                      <div
                        key={title.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#f4c97a]/35 bg-[#071726]/55 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">{title.title}</div>
                          <div className="text-[10px] text-white/55">
                            Temp. {title.season} · {TIER_MAP[title.tier].shortName}
                          </div>
                        </div>
                        <Trophy className="h-4 w-4 shrink-0 text-[#f4c97a]" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Career Achievements & Technical Records */}
              <div className="rounded-xl border border-white/12 bg-[#0B2338]/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-[#38d9c8]" />
                    <h3 className="font-display text-base font-bold text-white">
                      Conquistas &amp; Recordes Técnicos
                    </h3>
                  </div>
                  <span className="font-mono-tabular text-xs text-[#38d9c8]">
                    {unlockedAchievementsCount}/{CAREER_ACHIEVEMENTS_CATALOG.length} desbloqueadas ·
                    Maior seq.: {career.maxSequenceInCareer ?? 0} · Maior tubo:{' '}
                    {(career.longestBarrelInCareer ?? 0).toFixed(1)}s
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CAREER_ACHIEVEMENTS_CATALOG.map((ach) => {
                    const isUnlocked = Boolean(unlockedAchievementIds[ach.id]);
                    return (
                      <div
                        key={ach.id}
                        className={`flex items-start justify-between gap-2 rounded-lg border p-2.5 text-xs ${
                          isUnlocked
                            ? 'border-[#38d9c8]/50 bg-[#0B3C5D]/45 text-white'
                            : 'border-white/8 bg-[#071726]/40 text-white/55'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-semibold">
                            {isUnlocked ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-[#38d9c8]" />
                            ) : (
                              <Lock className="h-3 w-3 shrink-0 text-white/35" />
                            )}
                            <span className="truncate">{ach.title}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-white/60">
                            {ach.description}
                          </p>
                        </div>
                        <span className="font-mono-tabular shrink-0 text-[10px] text-[#38d9c8]">
                          +{ach.repReward} Rep
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Season-by-Season Evolution */}
              {career.seasonSummaries.length > 0 && (
                <div className="rounded-xl border border-white/12 bg-[#0B2338]/60 p-5">
                  <h3 className="font-display text-base font-bold text-white">
                    Evolução por Temporadas
                  </h3>
                  <div className="mt-3 space-y-2">
                    {career.seasonSummaries.map((ss) => (
                      <div
                        key={`season-${ss.season}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#071726]/50 px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-white">
                            Temporada {ss.season} · {TIER_MAP[ss.tier].shortName}
                          </span>
                          <div className="text-[11px] text-white/60">
                            {ss.wonWorldTitle
                              ? 'Campeão Mundial FLOW'
                              : ss.promoted
                                ? `Promovido para ${TIER_MAP[ss.nextTier].shortName}`
                                : `Campeão: ${ss.championName}`}
                          </div>
                        </div>
                        <div className="font-mono-tabular text-right">
                          <div className="font-bold text-white">
                            #{ss.finalRank} · {ss.totalPoints.toLocaleString()} pts
                          </div>
                          <div className="text-[11px] text-[#E7DCC8]/80">
                            {ss.wins}V / {ss.podiums}P · ${ss.prizeEarned.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-white/12 bg-[#0B2338]/60 p-5">
                <h3 className="font-display text-base font-bold text-white">
                  Histórico de Competições
                </h3>
                {career.history.length === 0 ? (
                  <p className="mt-2 text-xs text-white/60">
                    Nenhum campeonato concluído ainda. Dispute a primeira etapa no Painel!
                  </p>
                ) : (
                  <div className="mt-3 max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-white/10 text-white/55">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Temp.</th>
                          <th className="py-2 pr-3 font-medium">Campeonato</th>
                          <th className="py-2 pr-3 font-medium text-right">Pos.</th>
                          <th className="py-2 pr-3 font-medium text-right">Melhor Bateria</th>
                          <th className="py-2 font-medium text-right">Pontos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/8">
                        {career.history.map((h, i) => (
                          <tr key={`${h.eventId}-${i}`} className="text-white/85">
                            <td className="font-mono-tabular py-2 pr-3 text-white/55">
                              T{h.season}
                            </td>
                            <td className="py-2 pr-3">
                              <div className="font-medium text-white">{h.eventName}</div>
                              <div className="text-[10px] text-white/50">
                                {TIER_MAP[h.tier].shortName} · {h.beachName}
                              </div>
                            </td>
                            <td className="font-mono-tabular py-2 pr-3 text-right font-bold">
                              {h.placement}º
                            </td>
                            <td className="font-mono-tabular py-2 pr-3 text-right">
                              {h.bestHeatTotal.toFixed(1)}
                            </td>
                            <td className="font-mono-tabular py-2 text-right text-[#38d9c8]">
                              +{h.pointsEarned}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function HeaderKPI({
  label,
  value,
  highlight = false,
  compact = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/12 bg-[#0B2338]/75 px-2.5 py-1.5 sm:px-3 sm:py-2">
      <div className="text-[10px] font-medium tracking-wide text-white/55">{label}</div>
      <div
        className={`font-mono-tabular mt-0.5 truncate font-bold ${
          compact ? 'text-xs lg:max-w-[155px]' : 'text-xs sm:text-sm'
        } ${highlight ? 'text-[#38d9c8]' : 'text-white'}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11px]">
        <span className="text-white/70">{label}</span>
        <span className="font-mono-tabular font-semibold text-white">{pct}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#071726]">
        <div
          className="h-full rounded-full bg-[#2596A6]"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
