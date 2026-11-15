import { WeatherCondition } from './game';

export type CareerTierId = 'amador' | 'regional' | 'acesso' | 'mundial';

export interface CareerTierInfo {
  id: CareerTierId;
  order: number;
  name: string;
  shortName: string;
  description: string;
  promoteTopN: number; // Top N advance at end of season (0 on top tier = Champion)
  seasonEventsCount: number;
  heatDurationSeconds: number;
  roundsCount: 2 | 3; // 2 = Semifinal + Final, 3 = Quartas + Semifinal + Final
  prizePoolBase: number;
  pointsFirst: number;
  aiSkillRange: [number, number];
}

export interface CareerBoardItem {
  id: string;
  price: number;
  tierRequired: CareerTierId;
  sponsorBrandId?: string;
  perks: string;
}

export interface CareerSurferCustomization {
  name: string;
  nationality: string;
  nationalityCode: string;
  baseSurferId: string;
  stance: 'Regular' | 'Goofy';
  style: string;
  suitColor: string;
  accentColor: string;
  skinTone: string;
  hairColor: string;
}

export type AISurfStyleFocus = 'technical' | 'barrel' | 'allround';

export interface AISurfer {
  id: string;
  name: string;
  nationality: string;
  nationalityCode: string;
  tier: CareerTierId;
  skillLevel: number; // 45..97
  barrelSkill: number; // 0..1
  airSkill: number; // 0..1
  consistency: number; // 0..1
  styleFocus?: AISurfStyleFocus;
  style: string;
  suitColor: string;
  accentColor: string;
  skinTone: string;
  hairColor: string;
  stance: 'Regular' | 'Goofy';
  seasonPoints: number;
  careerPoints: number;
  previousRank: number;
  recentResults: number[];
  wins: number;
  podiums: number;
  bestWave: number;
}

export type CareerPhotoKey = 'reef' | 'beach' | 'twilight';

export interface CareerEventResult {
  placement: number; // 1..8
  bestHeatTotal: number;
  bestWave: number;
  pointsEarned: number;
  prizeEarned: number;
  sponsorBonusEarned: number;
  maneuversLanded: number;
  championName: string;
  topStandings: Array<{
    competitorId: string;
    name: string;
    nationalityCode: string;
    isPlayer: boolean;
    placement: number;
    bestHeatTotal: number;
    pointsEarned: number;
  }>;
}

export interface CareerEvent {
  id: string;
  season: number;
  orderIndex: number;
  tier: CareerTierId;
  name: string;
  location: string;
  beachId: string;
  weather: WeatherCondition;
  waveHeightLabel: string;
  swellConditions: string;
  deadlineLabel: string;
  prizePool: number;
  pointsFirst: number;
  photoKey: CareerPhotoKey;
  status: 'completed' | 'next' | 'upcoming';
  result?: CareerEventResult;
}

export type HeatRoundType = 'quartas' | 'semifinal' | 'final';

export interface HeatWaveRecord {
  waveNumber: number;
  score: number; // 0.0 .. 10.0 WSL scale
  rawPoints: number;
  barrelTime: number;
  maneuvers: number;
  bestManeuver: string;
  timestampSec: number;
}

export interface HeatCompetitor {
  id: string;
  name: string;
  nationalityCode: string;
  isPlayer: boolean;
  skillLevel: number;
  style: string;
  styleFocus?: AISurfStyleFocus;
  suitColor: string;
  accentColor: string;
  skinTone?: string;
  hairColor?: string;
  stance?: 'Regular' | 'Goofy';
  waves: HeatWaveRecord[];
  bestTwoTotal: number;
  heatRank: number;
  advanced: boolean;
  // Scheduled AI wave timestamps/scores for progressive live heat updates
  scheduledAiWaves?: Array<{ atElapsedSec: number; score: number; bestManeuver: string }>;
}

export interface HeatMatch {
  heatId: string;
  label: string;
  competitors: HeatCompetitor[];
  completed: boolean;
}

export interface RoundSummary {
  round: HeatRoundType;
  roundLabel: string;
  heats: HeatMatch[];
}

export interface TournamentMilestoneSummary {
  unlockedAchievements: string[]; // achievement ids
  completedObjectives: string[]; // objective titles
  earnedTitles: string[]; // title names
}

export interface ActiveTournamentState {
  eventId: string;
  tier: CareerTierId;
  currentRound: HeatRoundType;
  roundLabel: string;
  heats: HeatMatch[];
  playerHeatIndex: number;
  completedRounds: RoundSummary[];
  participantIds: string[]; // 8 seeded ids ('player' + 7 AI)
  heatCompletedAwaitingNext: boolean;
  eventFinished: boolean;
  finalResult?: CareerEventResult;
  headToHeadRivalId?: string;
  headToHeadSettledInEvent?: boolean;
  recentMilestones?: TournamentMilestoneSummary;
}

export type SponsorObjectiveType = 'semis' | 'podiums' | 'win' | 'highWave' | 'events';

export interface SponsorBrand {
  id: string;
  name: string;
  category: 'Equipamentos' | 'Vestuário' | 'Ótica & Tech' | 'Alta Performance';
  tagline: string;
  minTier: CareerTierId;
  minReputation: number;
  durationEvents: number;
  objectiveType: SponsorObjectiveType;
  objectiveTarget: number;
  objectiveLabel: string;
  stipendPerEvent: number;
  completionBonus: number;
  repBonus: number;
  prizeMultiplierBonus: number;
  rewardBoardId?: string;
  accentColor: string;
}

export interface SponsorContract {
  brandId: string;
  status: 'invited' | 'active' | 'completed' | 'expired';
  eventsRemaining: number;
  eventsTotal: number;
  progress: number;
  target: number;
  signedSeason: number;
}

export interface CareerHistoryEntry {
  season: number;
  tier: CareerTierId;
  eventId: string;
  eventName: string;
  beachName: string;
  placement: number;
  bestHeatTotal: number;
  bestWave: number;
  pointsEarned: number;
  prizeEarned: number;
  maneuversLanded: number;
}

export interface SeasonSummary {
  season: number;
  tier: CareerTierId;
  nextTier: CareerTierId;
  finalRank: number;
  totalPoints: number;
  promoted: boolean;
  wonWorldTitle: boolean;
  championName: string;
  wins: number;
  podiums: number;
  prizeEarned: number;
}

export type RivalryNotificationKind =
  | 'close_finish'
  | 'head_to_head_challenge'
  | 'duel_won'
  | 'duel_lost';

export interface RivalryRecord {
  rivalId: string;
  intensity: 1 | 2 | 3; // 1 = Tensão, 2 = Rivalidade, 3 = Arqui-Rivalidade
  heatMeetings: number;
  closeFinishes: number;
  playerWins: number;
  rivalWins: number;
  lastEventId: string;
  lastEventName: string;
  lastMarginPts: number;
  activeChallenge: boolean;
  challengeBonusPrize: number;
  challengeBonusRep: number;
}

export interface RivalryNotification {
  id: string;
  rivalId: string;
  rivalName: string;
  rivalNationalityCode: string;
  rivalSkillLevel: number;
  rivalStyle: string;
  rivalSuitColor: string;
  rivalAccentColor: string;
  rivalSkinTone: string;
  rivalHairColor: string;
  kind: RivalryNotificationKind;
  title: string;
  dialogue: string;
  contextLabel: string;
  marginLabel?: string;
  rewardLabel?: string;
  eventName: string;
  seen: boolean;
}

export interface CareerReputationLevel {
  id: string;
  title: string;
  minRep: number;
  nextRep: number | null;
}

export interface CareerAchievementDef {
  id: string;
  title: string;
  description: string;
  category: 'bateria' | 'manobras' | 'carreira' | 'elite';
  repReward: number;
}

export type CareerObjectiveKind =
  | 'heat_score'
  | 'sequence_chain'
  | 'excellent_wave'
  | 'barrel_time'
  | 'reach_final'
  | 'win_peak'
  | 'beat_rival';

export interface CareerObjective {
  id: string;
  title: string;
  description: string;
  kind: CareerObjectiveKind;
  targetValue: number;
  targetBeachId?: string;
  progress: number;
  completed: boolean;
  rewardPrize: number;
  rewardRep: number;
  tier: CareerTierId;
}

export interface CareerTitleRecord {
  id: string;
  season: number;
  tier: CareerTierId;
  title: string;
  eventName?: string;
  kind: 'event_title' | 'division_champion' | 'world_champion';
  earnedAt: string;
}

export interface CareerSaveState {
  version: number;
  createdAt: string;
  updatedAt: string;
  surfer: CareerSurferCustomization;
  equippedBoardId: string;
  unlockedBoardIds: string[];
  tier: CareerTierId;
  season: number;
  seasonPoints: number;
  careerPoints: number;
  previousRank: number;
  recentResults: number[];
  wins: number;
  podiums: number;
  bestWave: number;
  prizeBalance: number;
  totalCareerEarnings: number;
  reputation: number;
  calendar: CareerEvent[];
  opponents: AISurfer[];
  sponsors: SponsorContract[];
  history: CareerHistoryEntry[];
  seasonSummaries: SeasonSummary[];
  activeTournament: ActiveTournamentState | null;
  pendingSeasonSummary: SeasonSummary | null;
  rivalries?: RivalryRecord[];
  rivalryNotifications?: RivalryNotification[];
  unlockedAchievements?: Record<string, string>; // achievementId -> ISO date
  careerObjectives?: CareerObjective[];
  titlesWon?: CareerTitleRecord[];
  maxSequenceInCareer?: number;
  longestBarrelInCareer?: number;
}

export interface LiveCareerHeatHUD {
  eventName: string;
  roundLabel: string;
  timeRemainingSec: number;
  totalDurationSec: number;
  playerTotal: number;
  playerWaves: number[];
  playerRank: number;
  totalInHeat: number;
  topRivalName: string;
  topRivalTotal: number;
  advancingCount: number;
  neededToAdvance: number | null;
  opponentsSummary: Array<{
    id: string;
    name: string;
    nationalityCode: string;
    bestTwoTotal: number;
    heatRank: number;
    isH2HRival?: boolean;
  }>;
  isHeadToHeadDuel?: boolean;
  rivalNameInHeat?: string;
}

export interface CareerCutsceneInfo {
  heatKey: string;
  eventName: string;
  location: string;
  beachName: string;
  weather: WeatherCondition;
  weatherLabel: string;
  waveHeightLabel: string;
  swellConditions: string;
  roundLabel: string;
  heatLabel: string;
  heatDurationSec: number;
  seed: number;
  isFinal: boolean;
  isHeadToHead: boolean;
  competitors: Array<{
    id: string;
    name: string;
    nationalityCode: string;
    isPlayer: boolean;
    style: string;
    styleFocus: 'technical' | 'barrel' | 'allround';
    skillLevel: number;
    suitColor: string;
    accentColor: string;
    skinTone: string;
    hairColor: string;
    stance: 'Regular' | 'Goofy';
    isH2HRival?: boolean;
  }>;
}
