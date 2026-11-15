import careerBeachPhoto from '../assets/images/career_championship_beach_1794697517543.jpg';
import careerReefPhoto from '../assets/images/career_reef_lineup_1794697516643.jpg';
import careerTwilightPhoto from '../assets/images/career_twilight_point_1794697517749.jpg';
import {
  AISurfer,
  AISurfStyleFocus,
  CareerAchievementDef,
  CareerBoardItem,
  CareerEvent,
  CareerObjective,
  CareerPhotoKey,
  CareerReputationLevel,
  CareerTierId,
  CareerTierInfo,
  SponsorBrand,
} from '../types/career';
import { WeatherCondition } from '../types/game';

export const CAREER_PHOTOS: Record<CareerPhotoKey, string> = {
  reef: careerReefPhoto,
  beach: careerBeachPhoto,
  twilight: careerTwilightPhoto,
};

export const CAREER_TIERS: CareerTierInfo[] = [
  {
    id: 'amador',
    order: 1,
    name: 'Circuito Amador',
    shortName: 'Amador',
    description:
      'Etapas iniciais em praias acessíveis para construir base, pontuar no ranking e atrair os primeiros patrocinadores.',
    promoteTopN: 2,
    seasonEventsCount: 3,
    heatDurationSeconds: 110,
    roundsCount: 2, // Semifinal (4 surfistas) -> Final (4 surfistas)
    prizePoolBase: 1200,
    pointsFirst: 1000,
    aiSkillRange: [48, 63],
  },
  {
    id: 'regional',
    order: 2,
    name: 'Circuito Regional',
    shortName: 'Regional',
    description:
      'Baterias eliminatórias contra talentos locais experientes em swells consistentes e premiações maiores.',
    promoteTopN: 3,
    seasonEventsCount: 4,
    heatDurationSeconds: 115,
    roundsCount: 3, // Quartas -> Semifinal -> Final
    prizePoolBase: 3600,
    pointsFirst: 2500,
    aiSkillRange: [61, 75],
  },
  {
    id: 'acesso',
    order: 3,
    name: 'Circuito de Acesso Profissional',
    shortName: 'Acesso Pro',
    description:
      'Qualifying internacional de alto nível. Apenas os melhores do ranking conquistam vaga na elite mundial.',
    promoteTopN: 3,
    seasonEventsCount: 5,
    heatDurationSeconds: 120,
    roundsCount: 3,
    prizePoolBase: 8500,
    pointsFirst: 5000,
    aiSkillRange: [73, 86],
  },
  {
    id: 'mundial',
    order: 4,
    name: 'Circuito Mundial Profissional',
    shortName: 'Mundial Pro',
    description:
      'A divisão máxima do surfe profissional. Tubos pesados, aéreos críticos e a disputa pelo título mundial.',
    promoteTopN: 1, // 1º lugar = Campeão Mundial
    seasonEventsCount: 6,
    heatDurationSeconds: 125,
    roundsCount: 3,
    prizePoolBase: 22000,
    pointsFirst: 10000,
    aiSkillRange: [84, 96],
  },
];

export const TIER_MAP: Record<CareerTierId, CareerTierInfo> = {
  amador: CAREER_TIERS[0],
  regional: CAREER_TIERS[1],
  acesso: CAREER_TIERS[2],
  mundial: CAREER_TIERS[3],
};

export const CAREER_NATIONALITIES: Array<{ name: string; code: string }> = [
  { name: 'Brasil', code: 'BRA' },
  { name: 'Austrália', code: 'AUS' },
  { name: 'Havaí / EUA', code: 'HAW' },
  { name: 'Estados Unidos', code: 'USA' },
  { name: 'Portugal', code: 'PRT' },
  { name: 'França', code: 'FRA' },
  { name: 'Japão', code: 'JPN' },
  { name: 'África do Sul', code: 'ZAF' },
  { name: 'Indonésia', code: 'IDN' },
  { name: 'Peru', code: 'PER' },
];

export const CAREER_SURF_STYLES: string[] = [
  'Tubos Profundos & Rail Carving',
  'Aéreos Progressivos & Lip Attack',
  'Manobras Clássicas & Flow Fluido',
  'Power Surfe & Cutbacks Agressivos',
];

export const SUIT_COLOR_OPTIONS: Array<{ label: string; hex: string }> = [
  { label: 'Obsidiana', hex: '#0b2239' },
  { label: 'Azul Abismo', hex: '#0d1b2a' },
  { label: 'Petróleo', hex: '#0a2936' },
  { label: 'Grafite', hex: '#1e293b' },
  { label: 'Ardósia', hex: '#152b3c' },
  { label: 'Verde Mar', hex: '#0f2d2e' },
];

export const ACCENT_COLOR_OPTIONS: Array<{ label: string; hex: string }> = [
  { label: 'Turquesa FLOW', hex: '#2596a6' },
  { label: 'Ciano Recife', hex: '#38d9c8' },
  { label: 'Areia', hex: '#e7dcc8' },
  { label: 'Âmbar Solar', hex: '#f4c97a' },
  { label: 'Coral', hex: '#e68a5c' },
  { label: 'Branco Espuma', hex: '#f8fafc' },
];

export const SKIN_TONE_OPTIONS: Array<{ label: string; hex: string }> = [
  { label: 'Claro', hex: '#e4b99d' },
  { label: 'Dourado', hex: '#d8ab8c' },
  { label: 'Bronzeado', hex: '#c98e6b' },
  { label: 'Moreno', hex: '#b37552' },
  { label: 'Escuro', hex: '#86533a' },
  { label: 'Profundo', hex: '#5f3b2a' },
];

export const HAIR_COLOR_OPTIONS: Array<{ label: string; hex: string }> = [
  { label: 'Preto', hex: '#151414' },
  { label: 'Castanho Escuro', hex: '#2e2119' },
  { label: 'Castanho Sol', hex: '#5c3c24' },
  { label: 'Loiro Praia', hex: '#b9935a' },
  { label: 'Ruivo', hex: '#8f472c' },
  { label: 'Platinado', hex: '#d4cfc4' },
];

export const CAREER_BOARD_CATALOG: CareerBoardItem[] = [
  {
    id: 'vortex-pro',
    price: 0,
    tierRequired: 'amador',
    perks: 'Equilíbrio versátil para manobras na face e tubos moderados.',
  },
  {
    id: 'keel-fish',
    price: 0,
    tierRequired: 'amador',
    perks: 'Gera velocidade fácil em ondas cheias e curvas soltas.',
  },
  {
    id: 'pacific-mid',
    price: 0,
    tierRequired: 'amador',
    perks: 'Estabilidade extra no drop e leitura suave de parede.',
  },
  {
    id: 'marea-pro-fish',
    price: 1600,
    tierRequired: 'regional',
    sponsorBrandId: 'marea-surf',
    perks: 'Biquilha de competição com resposta rápida no pocket.',
  },
  {
    id: 'deep-gun',
    price: 2800,
    tierRequired: 'regional',
    perks: 'Desenhada para ondas pesadas e drop seguro em séries grandes.',
  },
  {
    id: 'phantom-carbon',
    price: 4600,
    tierRequired: 'acesso',
    sponsorBrandId: 'trench-craft',
    perks: 'Shortboard de carbono ultraleve para aéreos e snaps críticos.',
  },
  {
    id: 'pelagic-stepup',
    price: 7500,
    tierRequired: 'mundial',
    sponsorBrandId: 'pelagic-labs',
    perks: 'Step-up de elite para tubos profundos do Circuito Mundial.',
  },
];

export const SPONSOR_BRANDS: SponsorBrand[] = [
  {
    id: 'kaluana-fins',
    name: 'Kaluana Fins',
    category: 'Equipamentos',
    tagline: 'Hidrodinâmica artesanal para linhas precisas',
    minTier: 'amador',
    minReputation: 20,
    durationEvents: 3,
    objectiveType: 'semis',
    objectiveTarget: 1,
    objectiveLabel: 'Alcançar 1 Semifinal ou melhor',
    stipendPerEvent: 280,
    completionBonus: 650,
    repBonus: 45,
    prizeMultiplierBonus: 0.08,
    accentColor: '#2596a6',
  },
  {
    id: 'marea-surf',
    name: 'Maréa Surf Co.',
    category: 'Vestuário',
    tagline: 'Vestuário técnico nascido nas bancadas do Pacífico',
    minTier: 'amador',
    minReputation: 45,
    durationEvents: 3,
    objectiveType: 'podiums',
    objectiveTarget: 1,
    objectiveLabel: 'Conquistar 1 Pódio (Top 3)',
    stipendPerEvent: 420,
    completionBonus: 1100,
    repBonus: 65,
    prizeMultiplierBonus: 0.1,
    rewardBoardId: 'marea-pro-fish',
    accentColor: '#38d9c8',
  },
  {
    id: 'pacifico-neoprene',
    name: 'Pacífico Neoprene',
    category: 'Vestuário',
    tagline: 'Flexibilidade térmica para sessões de alto impacto',
    minTier: 'regional',
    minReputation: 90,
    durationEvents: 4,
    objectiveType: 'highWave',
    objectiveTarget: 1,
    objectiveLabel: 'Registrar onda nota 7.5+ em bateria',
    stipendPerEvent: 750,
    completionBonus: 2100,
    repBonus: 85,
    prizeMultiplierBonus: 0.14,
    accentColor: '#e7dcc8',
  },
  {
    id: 'trench-craft',
    name: 'Trench Craft',
    category: 'Equipamentos',
    tagline: 'Shapes de competição em fibra de carbono',
    minTier: 'regional',
    minReputation: 140,
    durationEvents: 4,
    objectiveType: 'podiums',
    objectiveTarget: 2,
    objectiveLabel: 'Conquistar 2 Pódios durante o contrato',
    stipendPerEvent: 1050,
    completionBonus: 3200,
    repBonus: 110,
    prizeMultiplierBonus: 0.18,
    rewardBoardId: 'phantom-carbon',
    accentColor: '#38d9c8',
  },
  {
    id: 'solstice-optics',
    name: 'Solstice Optics',
    category: 'Ótica & Tech',
    tagline: 'Leitura polarizada de swell e performance em circuito',
    minTier: 'acesso',
    minReputation: 230,
    durationEvents: 4,
    objectiveType: 'semis',
    objectiveTarget: 3,
    objectiveLabel: 'Chegar a 3 Semifinais no circuito',
    stipendPerEvent: 1850,
    completionBonus: 5400,
    repBonus: 150,
    prizeMultiplierBonus: 0.22,
    accentColor: '#f4c97a',
  },
  {
    id: 'pelagic-labs',
    name: 'Pelagic Labs',
    category: 'Alta Performance',
    tagline: 'Engenharia de elite para os maiores tubos do mundo',
    minTier: 'mundial',
    minReputation: 360,
    durationEvents: 5,
    objectiveType: 'win',
    objectiveTarget: 1,
    objectiveLabel: 'Vencer 1 etapa do Circuito Mundial',
    stipendPerEvent: 3200,
    completionBonus: 11500,
    repBonus: 240,
    prizeMultiplierBonus: 0.3,
    rewardBoardId: 'pelagic-stepup',
    accentColor: '#e68a5c',
  },
];

export interface EventTemplate {
  name: string;
  location: string;
  beachId: string;
  weather: WeatherCondition;
  waveHeightLabel: string;
  swellConditions: string;
  photoKey: CareerPhotoKey;
}

export const TIER_EVENT_TEMPLATES: Record<CareerTierId, EventTemplate[]> = {
  amador: [
    {
      name: 'Copa Maré Aberta',
      location: 'Maré Lagoon · Coral Coast',
      beachId: 'bay-of-palms',
      weather: 'sunny',
      waveHeightLabel: '4–6 ft',
      swellConditions: 'Glassy · 12s · Vento fraco',
      photoKey: 'beach',
    },
    {
      name: 'Desafio Kaluana Júnior',
      location: 'Kaluana Cove · South Pacific',
      beachId: 'kaluana-cove',
      weather: 'sunny',
      waveHeightLabel: '6–7 ft',
      swellConditions: 'Offshore 8kt · 15s · Paredes limpas',
      photoKey: 'reef',
    },
    {
      name: 'Clássico da Baía',
      location: 'Maré Lagoon · Coral Coast',
      beachId: 'bay-of-palms',
      weather: 'overcast',
      waveHeightLabel: '5–7 ft',
      swellConditions: 'Nublado · 13s · Mar alinhado',
      photoKey: 'twilight',
    },
  ],
  regional: [
    {
      name: 'Open Costa dos Corais',
      location: 'Maré Lagoon · Coral Coast',
      beachId: 'bay-of-palms',
      weather: 'sunny',
      waveHeightLabel: '5–7 ft',
      swellConditions: 'Terral leve · 14s · Séries regulares',
      photoKey: 'beach',
    },
    {
      name: 'Kaluana Reef Invitational',
      location: 'Kaluana Cove · South Pacific',
      beachId: 'kaluana-cove',
      weather: 'overcast',
      waveHeightLabel: '6–8 ft',
      swellConditions: 'Offshore · 15s · Bancada rápida',
      photoKey: 'reef',
    },
    {
      name: 'Tavarua Trials',
      location: 'Tavarua Reef · Fiji',
      beachId: 'tavarua-point',
      weather: 'sunny',
      waveHeightLabel: '8–9 ft',
      swellConditions: 'Alísios 6kt · 17s · Tubos abertos',
      photoKey: 'reef',
    },
    {
      name: 'Etapa Tempestade do Sul',
      location: 'Kaena Headland · North Shore',
      beachId: 'north-headland',
      weather: 'rainy',
      waveHeightLabel: '8–10 ft',
      swellConditions: 'Chuva costeira · 16s · Parede pesada',
      photoKey: 'twilight',
    },
  ],
  acesso: [
    {
      name: 'Pacífico Qualifying Pro',
      location: 'Kaluana Cove · South Pacific',
      beachId: 'kaluana-cove',
      weather: 'sunny',
      waveHeightLabel: '7–9 ft',
      swellConditions: 'Offshore 8kt · 16s · Direitas longas',
      photoKey: 'reef',
    },
    {
      name: 'Fiji Reef Series',
      location: 'Tavarua Reef · Fiji',
      beachId: 'tavarua-point',
      weather: 'sunny',
      waveHeightLabel: '8–10 ft',
      swellConditions: 'Trade 6kt · 17s · Tubos translúcidos',
      photoKey: 'beach',
    },
    {
      name: 'Maré Pro Challenge',
      location: 'Maré Lagoon · Coral Coast',
      beachId: 'bay-of-palms',
      weather: 'overcast',
      waveHeightLabel: '6–8 ft',
      swellConditions: 'Nublado · 14s · Rampa para aéreos',
      photoKey: 'beach',
    },
    {
      name: 'Headland Heavy Cup',
      location: 'Kaena Headland · North Shore',
      beachId: 'north-headland',
      weather: 'rainy',
      waveHeightLabel: '10–12 ft',
      swellConditions: 'Chuva & swell · 18s · Seção crítica',
      photoKey: 'twilight',
    },
    {
      name: 'Finais do Acesso Pro',
      location: 'Tavarua Reef · Fiji',
      beachId: 'tavarua-point',
      weather: 'overcast',
      waveHeightLabel: '9–11 ft',
      swellConditions: 'Offshore · 18s · Valendo vaga na elite',
      photoKey: 'reef',
    },
  ],
  mundial: [
    {
      name: 'Kaluana World Open',
      location: 'Kaluana Cove · South Pacific',
      beachId: 'kaluana-cove',
      weather: 'sunny',
      waveHeightLabel: '7–9 ft',
      swellConditions: 'Perfeito · 16s · Paredes infinitas',
      photoKey: 'beach',
    },
    {
      name: 'Tavarua Cloudbreak Pro',
      location: 'Tavarua Reef · Fiji',
      beachId: 'tavarua-point',
      weather: 'sunny',
      waveHeightLabel: '9–11 ft',
      swellConditions: 'Trade 6kt · 18s · Tubos pesados',
      photoKey: 'reef',
    },
    {
      name: 'Coral Coast Masters',
      location: 'Maré Lagoon · Coral Coast',
      beachId: 'bay-of-palms',
      weather: 'overcast',
      waveHeightLabel: '6–8 ft',
      swellConditions: 'Glassy · 14s · Alta velocidade',
      photoKey: 'beach',
    },
    {
      name: 'Kaena North Shore Shootout',
      location: 'Kaena Headland · North Shore',
      beachId: 'north-headland',
      weather: 'sunny',
      waveHeightLabel: '10–14 ft',
      swellConditions: 'Swell épico · 19s · Tubos e drops',
      photoKey: 'twilight',
    },
    {
      name: 'Fiji Monsoon Classic',
      location: 'Tavarua Reef · Fiji',
      beachId: 'tavarua-point',
      weather: 'rainy',
      waveHeightLabel: '9–12 ft',
      swellConditions: 'Chuva tropical · 18s · Lip pesado',
      photoKey: 'twilight',
    },
    {
      name: 'FLOW World Finals',
      location: 'Kaena Headland · North Shore',
      beachId: 'north-headland',
      weather: 'sunny',
      waveHeightLabel: '12–14 ft',
      swellConditions: 'Swell de decisão · 19s · Título Mundial',
      photoKey: 'reef',
    },
  ],
};

export function createInitialOpponents(): AISurfer[] {
  const specs: Array<
    Omit<
      AISurfer,
      'seasonPoints' | 'careerPoints' | 'previousRank' | 'recentResults' | 'wins' | 'podiums' | 'bestWave'
    >
  > = [
    // AMADOR (7)
    { id: 'ai-am-1', name: 'Lucas Prado', nationality: 'Brasil', nationalityCode: 'BRA', tier: 'amador', skillLevel: 54, barrelSkill: 0.42, airSkill: 0.56, consistency: 0.58, style: 'Aéreos & Energia Jovem', suitColor: '#0b2239', accentColor: '#38d9c8', skinTone: '#c98e6b', hairColor: '#1e1916', stance: 'Regular' },
    { id: 'ai-am-2', name: 'Noah Hale', nationality: 'Austrália', nationalityCode: 'AUS', tier: 'amador', skillLevel: 58, barrelSkill: 0.52, airSkill: 0.48, consistency: 0.64, style: 'Rail Clássico', suitColor: '#152b3c', accentColor: '#e7dcc8', skinTone: '#dfb397', hairColor: '#b9935a', stance: 'Goofy' },
    { id: 'ai-am-3', name: 'Mina Takahashi', nationality: 'Japão', nationalityCode: 'JPN', tier: 'amador', skillLevel: 60, barrelSkill: 0.5, airSkill: 0.54, consistency: 0.72, style: 'Cutbacks Precisos', suitColor: '#0d1b2a', accentColor: '#f4c97a', skinTone: '#d8ab8c', hairColor: '#151414', stance: 'Regular' },
    { id: 'ai-am-4', name: 'Diogo Pires', nationality: 'Portugal', nationalityCode: 'PRT', tier: 'amador', skillLevel: 52, barrelSkill: 0.48, airSkill: 0.45, consistency: 0.55, style: 'Bottom Turn Forte', suitColor: '#101d2e', accentColor: '#2596a6', skinTone: '#c98e6b', hairColor: '#2e2119', stance: 'Regular' },
    { id: 'ai-am-5', name: 'Ayla Cruz', nationality: 'Peru', nationalityCode: 'PER', tier: 'amador', skillLevel: 56, barrelSkill: 0.58, airSkill: 0.42, consistency: 0.62, style: 'Leitura de Parede', suitColor: '#0f2d2e', accentColor: '#e68a5c', skinTone: '#b37552', hairColor: '#151414', stance: 'Goofy' },
    { id: 'ai-am-6', name: 'Toby Vance', nationality: 'Estados Unidos', nationalityCode: 'USA', tier: 'amador', skillLevel: 50, barrelSkill: 0.4, airSkill: 0.58, consistency: 0.5, style: 'Floaters Rápidos', suitColor: '#1e293b', accentColor: '#f8fafc', skinTone: '#e4b99d', hairColor: '#5c3c24', stance: 'Regular' },
    { id: 'ai-am-7', name: 'Koa Kealoha', nationality: 'Havaí / EUA', nationalityCode: 'HAW', tier: 'amador', skillLevel: 62, barrelSkill: 0.65, airSkill: 0.5, consistency: 0.63, style: 'Tubos & Flow Natural', suitColor: '#0a2936', accentColor: '#2596a6', skinTone: '#b37552', hairColor: '#151414', stance: 'Goofy' },

    // REGIONAL (7)
    { id: 'ai-reg-1', name: 'Caio Medeiros', nationality: 'Brasil', nationalityCode: 'BRA', tier: 'regional', skillLevel: 72, barrelSkill: 0.64, airSkill: 0.78, consistency: 0.69, style: 'Aéreos & Snaps', suitColor: '#0b2239', accentColor: '#38d9c8', skinTone: '#b37552', hairColor: '#151414', stance: 'Regular' },
    { id: 'ai-reg-2', name: 'Ethan Gallagher', nationality: 'Austrália', nationalityCode: 'AUS', tier: 'regional', skillLevel: 74, barrelSkill: 0.72, airSkill: 0.65, consistency: 0.75, style: 'Power Carve', suitColor: '#152b3c', accentColor: '#f4c97a', skinTone: '#dfb397', hairColor: '#b9935a', stance: 'Regular' },
    { id: 'ai-reg-3', name: 'Inês Alencar', nationality: 'Portugal', nationalityCode: 'PRT', tier: 'regional', skillLevel: 69, barrelSkill: 0.7, airSkill: 0.6, consistency: 0.73, style: 'Linhas Profundas', suitColor: '#0d1b2a', accentColor: '#e7dcc8', skinTone: '#d8ab8c', hairColor: '#5c3c24', stance: 'Goofy' },
    { id: 'ai-reg-4', name: 'Théo Moreau', nationality: 'França', nationalityCode: 'FRA', tier: 'regional', skillLevel: 67, barrelSkill: 0.68, airSkill: 0.62, consistency: 0.66, style: 'Tubos Rápidos', suitColor: '#1e293b', accentColor: '#2596a6', skinTone: '#e4b99d', hairColor: '#2e2119', stance: 'Regular' },
    { id: 'ai-reg-5', name: 'Putu Mahendra', nationality: 'Indonésia', nationalityCode: 'IDN', tier: 'regional', skillLevel: 71, barrelSkill: 0.8, airSkill: 0.58, consistency: 0.7, style: 'Especialista em Tubos', suitColor: '#0f2d2e', accentColor: '#e68a5c', skinTone: '#b37552', hairColor: '#151414', stance: 'Goofy' },
    { id: 'ai-reg-6', name: 'Sipho Ndlovu', nationality: 'África do Sul', nationalityCode: 'ZAF', tier: 'regional', skillLevel: 65, barrelSkill: 0.62, airSkill: 0.64, consistency: 0.68, style: 'Velocidade de Parede', suitColor: '#101d2e', accentColor: '#f8fafc', skinTone: '#5f3b2a', hairColor: '#151414', stance: 'Regular' },
    { id: 'ai-reg-7', name: 'Riku Watanabe', nationality: 'Japão', nationalityCode: 'JPN', tier: 'regional', skillLevel: 68, barrelSkill: 0.6, airSkill: 0.72, consistency: 0.71, style: 'Manobras Conectadas', suitColor: '#0a2936', accentColor: '#38d9c8', skinTone: '#d8ab8c', hairColor: '#151414', stance: 'Goofy' },

    // ACESSO PRO (7)
    { id: 'ai-ac-1', name: 'Rafael Costa', nationality: 'Brasil', nationalityCode: 'BRA', tier: 'acesso', skillLevel: 84, barrelSkill: 0.78, airSkill: 0.89, consistency: 0.78, style: 'Aerials & Lip Attack', suitColor: '#0a2936', accentColor: '#38d9c8', skinTone: '#b77956', hairColor: '#171412', stance: 'Regular' },
    { id: 'ai-ac-2', name: 'Maya Sol', nationality: 'Austrália', nationalityCode: 'AUS', tier: 'acesso', skillLevel: 83, barrelSkill: 0.82, airSkill: 0.76, consistency: 0.84, style: 'Flow & Late Drops', suitColor: '#152b3c', accentColor: '#e7dcc8', skinTone: '#d9a484', hairColor: '#5c3c24', stance: 'Goofy' },
    { id: 'ai-ac-3', name: 'Kenji Sato', nationality: 'Japão', nationalityCode: 'JPN', tier: 'acesso', skillLevel: 81, barrelSkill: 0.74, airSkill: 0.82, consistency: 0.85, style: 'Cutbacks Técnicos', suitColor: '#101d2e', accentColor: '#f4c97a', skinTone: '#d8ab8c', hairColor: '#121215', stance: 'Goofy' },
    { id: 'ai-ac-4', name: 'Maddox Cole', nationality: 'Estados Unidos', nationalityCode: 'USA', tier: 'acesso', skillLevel: 79, barrelSkill: 0.76, airSkill: 0.8, consistency: 0.77, style: 'Floaters & Snaps', suitColor: '#1e293b', accentColor: '#2596a6', skinTone: '#dfb397', hairColor: '#5c3c24', stance: 'Regular' },
    { id: 'ai-ac-5', name: 'Vasco Ribeiro', nationality: 'Portugal', nationalityCode: 'PRT', tier: 'acesso', skillLevel: 77, barrelSkill: 0.83, airSkill: 0.7, consistency: 0.79, style: 'Tubos Pesados', suitColor: '#0d1b2a', accentColor: '#e68a5c', skinTone: '#c98e6b', hairColor: '#2e2119', stance: 'Regular' },
    { id: 'ai-ac-6', name: 'Made Wijaya', nationality: 'Indonésia', nationalityCode: 'IDN', tier: 'acesso', skillLevel: 82, barrelSkill: 0.88, airSkill: 0.74, consistency: 0.76, style: 'Tube Rider de Recife', suitColor: '#0f2d2e', accentColor: '#f8fafc', skinTone: '#b37552', hairColor: '#151414', stance: 'Goofy' },
    { id: 'ai-ac-7', name: 'Zoe Mokoena', nationality: 'África do Sul', nationalityCode: 'ZAF', tier: 'acesso', skillLevel: 80, barrelSkill: 0.79, airSkill: 0.75, consistency: 0.83, style: 'Open-Face Carve', suitColor: '#142438', accentColor: '#e68a5c', skinTone: '#86533a', hairColor: '#191412', stance: 'Regular' },

    // MUNDIAL PRO (7)
    { id: 'ai-pro-1', name: 'Kai Noa', nationality: 'Havaí / EUA', nationalityCode: 'HAW', tier: 'mundial', skillLevel: 95, barrelSkill: 0.96, airSkill: 0.88, consistency: 0.91, style: 'High-Line Barrel & Rail', suitColor: '#0b2239', accentColor: '#2596a6', skinTone: '#c98e6b', hairColor: '#1e1916', stance: 'Regular' },
    { id: 'ai-pro-2', name: 'Gabriel Moura', nationality: 'Brasil', nationalityCode: 'BRA', tier: 'mundial', skillLevel: 94, barrelSkill: 0.9, airSkill: 0.96, consistency: 0.89, style: 'Aéreos & Combos Explosivos', suitColor: '#0a2936', accentColor: '#38d9c8', skinTone: '#b37552', hairColor: '#151414', stance: 'Goofy' },
    { id: 'ai-pro-3', name: 'Lucas Verne', nationality: 'França', nationalityCode: 'FRA', tier: 'mundial', skillLevel: 91, barrelSkill: 0.88, airSkill: 0.86, consistency: 0.92, style: 'Power Turns & Lip Snap', suitColor: '#0d1b2a', accentColor: '#4da8b8', skinTone: '#dfb397', hairColor: '#3a2b20', stance: 'Regular' },
    { id: 'ai-pro-4', name: 'Jack Callahan', nationality: 'Austrália', nationalityCode: 'AUS', tier: 'mundial', skillLevel: 92, barrelSkill: 0.91, airSkill: 0.85, consistency: 0.9, style: 'Rail Clássico & Tubos', suitColor: '#152b3c', accentColor: '#f4c97a', skinTone: '#e4b99d', hairColor: '#b9935a', stance: 'Regular' },
    { id: 'ai-pro-5', name: 'Kanoa Hayashi', nationality: 'Japão', nationalityCode: 'JPN', tier: 'mundial', skillLevel: 89, barrelSkill: 0.84, airSkill: 0.9, consistency: 0.88, style: 'Velocidade & Precisão', suitColor: '#101d2e', accentColor: '#e7dcc8', skinTone: '#d8ab8c', hairColor: '#151414', stance: 'Regular' },
    { id: 'ai-pro-6', name: 'Wayde Van Der Berg', nationality: 'África do Sul', nationalityCode: 'ZAF', tier: 'mundial', skillLevel: 90, barrelSkill: 0.89, airSkill: 0.82, consistency: 0.91, style: 'Carving de Pointbreak', suitColor: '#142438', accentColor: '#e68a5c', skinTone: '#c98e6b', hairColor: '#5c3c24', stance: 'Regular' },
    { id: 'ai-pro-7', name: 'Rizal Santoso', nationality: 'Indonésia', nationalityCode: 'IDN', tier: 'mundial', skillLevel: 88, barrelSkill: 0.95, airSkill: 0.81, consistency: 0.85, style: 'Tubo Técnico Profundo', suitColor: '#0f2d2e', accentColor: '#38d9c8', skinTone: '#b37552', hairColor: '#151414', stance: 'Goofy' },
  ];

  return specs.map((s, idx) => ({
    ...s,
    styleFocus: inferAiStyleFocus(s),
    seasonPoints: 0,
    careerPoints: s.tier === 'mundial' ? 4200 + (7 - (idx % 7)) * 350 : s.tier === 'acesso' ? 1800 : s.tier === 'regional' ? 600 : 0,
    previousRank: (idx % 7) + 1,
    recentResults: [],
    wins: 0,
    podiums: 0,
    bestWave: 0,
  }));
}

export function inferAiStyleFocus(ai: {
  barrelSkill: number;
  airSkill: number;
  style: string;
}): AISurfStyleFocus {
  const lower = ai.style.toLowerCase();
  if (
    ai.barrelSkill - ai.airSkill >= 0.08 ||
    lower.includes('tubo') ||
    lower.includes('barrel') ||
    lower.includes('tube')
  ) {
    return 'barrel';
  }
  if (
    ai.airSkill - ai.barrelSkill >= 0.06 ||
    lower.includes('aéreo') ||
    lower.includes('aerial') ||
    lower.includes('cutback') ||
    lower.includes('snap') ||
    lower.includes('floater') ||
    lower.includes('conectad')
  ) {
    return 'technical';
  }
  return 'allround';
}

export const REPUTATION_LEVELS: CareerReputationLevel[] = [
  { id: 'novato', title: 'Novato da Praia', minRep: 0, nextRep: 60 },
  { id: 'promessa', title: 'Promessa Local', minRep: 60, nextRep: 140 },
  { id: 'competidor', title: 'Competidor Respeitado', minRep: 140, nextRep: 240 },
  { id: 'destaque', title: 'Destaque do Circuito', minRep: 240, nextRep: 380 },
  { id: 'elite', title: 'Contender de Elite', minRep: 380, nextRep: 560 },
  { id: 'icone', title: 'Ícone Mundial FLOW', minRep: 560, nextRep: 800 },
  { id: 'lenda', title: 'Lenda dos Mares', minRep: 800, nextRep: null },
];

export function getCareerReputationLevel(reputation: number): {
  current: CareerReputationLevel;
  levelIndex: number;
  progressPct: number;
} {
  let idx = 0;
  for (let i = 0; i < REPUTATION_LEVELS.length; i++) {
    if (reputation >= REPUTATION_LEVELS[i].minRep) {
      idx = i;
    }
  }
  const current = REPUTATION_LEVELS[idx];
  const progressPct =
    current.nextRep === null
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(((reputation - current.minRep) / Math.max(1, current.nextRep - current.minRep)) * 100)
          )
        );
  return { current, levelIndex: idx + 1, progressPct };
}

export const CAREER_ACHIEVEMENTS_CATALOG: CareerAchievementDef[] = [
  {
    id: 'first-heat-win',
    title: 'Estreia Vitoriosa',
    description: 'Vença sua primeira bateria oficial no Circuito FLOW.',
    category: 'bateria',
    repReward: 15,
  },
  {
    id: 'first-event-title',
    title: 'Primeiro Troféu',
    description: 'Conquiste o 1º lugar geral em uma etapa do campeonato.',
    category: 'carreira',
    repReward: 30,
  },
  {
    id: 'excellent-wave',
    title: 'Onda Excelente',
    description: 'Registre uma nota 8.0 ou superior em bateria oficial.',
    category: 'bateria',
    repReward: 25,
  },
  {
    id: 'nine-club',
    title: 'Clube do 9+',
    description: 'Alcance uma onda memorável com nota 9.0 ou maior.',
    category: 'elite',
    repReward: 45,
  },
  {
    id: 'flow-combo',
    title: 'Conexão Fluida',
    description: 'Complete uma sequência de 3 ou mais manobras em uma única onda.',
    category: 'manobras',
    repReward: 25,
  },
  {
    id: 'barrel-master',
    title: 'Visão de Tubo',
    description: 'Complete um tubo limpo de 1.5s ou mais dentro de uma bateria.',
    category: 'manobras',
    repReward: 30,
  },
  {
    id: 'rivalry-victor',
    title: 'Vencedor de Duelo',
    description: 'Vença um confronto direto Head-to-Head contra um rival.',
    category: 'bateria',
    repReward: 35,
  },
  {
    id: 'sponsor-complete',
    title: 'Atleta Patrocinado',
    description: 'Cumpra integralmente um contrato de patrocínio.',
    category: 'carreira',
    repReward: 25,
  },
  {
    id: 'tier-promotion',
    title: 'Ascensão de Divisão',
    description: 'Garanta acesso para uma divisão superior do Circuito FLOW.',
    category: 'carreira',
    repReward: 50,
  },
  {
    id: 'world-champion',
    title: 'Campeão Mundial FLOW',
    description: 'Termine a temporada do Circuito Mundial Profissional em 1º lugar.',
    category: 'elite',
    repReward: 120,
  },
];

export function buildCareerObjectivesForTier(
  tier: CareerTierId,
  season: number,
  calendar: CareerEvent[]
): CareerObjective[] {
  const tierIndex = tier === 'mundial' ? 3 : tier === 'acesso' ? 2 : tier === 'regional' ? 1 : 0;
  const prizeScale = 1 + tierIndex * 1.45;
  const repScale = 1 + tierIndex * 0.65;

  const targetHeatScore = [10.5, 12.2, 13.8, 15.2][tierIndex];
  const targetWaveScore = [7.2, 7.8, 8.2, 8.6][tierIndex];
  const targetSeq = tierIndex >= 2 ? 3 : 2;
  const targetBarrelSec = tierIndex >= 2 ? 1.6 : 1.0;

  const showcaseEvent = calendar[Math.min(1, calendar.length - 1)] ?? calendar[0];

  const objectives: CareerObjective[] = [
    {
      id: `obj-s${season}-${tier}-score`,
      title: `Somatório ${targetHeatScore.toFixed(1)}+ em Bateria`,
      description: `Alcance pelo menos ${targetHeatScore.toFixed(1)} pontos combinados nas 2 melhores ondas de uma bateria.`,
      kind: 'heat_score',
      targetValue: targetHeatScore,
      progress: 0,
      completed: false,
      rewardPrize: Math.round((320 * prizeScale) / 10) * 10,
      rewardRep: Math.round(18 * repScale),
      tier,
    },
    {
      id: `obj-s${season}-${tier}-seq`,
      title: `Sequência de ${targetSeq} Manobras`,
      description: `Conecte ${targetSeq} manobras diferentes em fluxo na mesma onda durante uma bateria.`,
      kind: 'sequence_chain',
      targetValue: targetSeq,
      progress: 0,
      completed: false,
      rewardPrize: Math.round((280 * prizeScale) / 10) * 10,
      rewardRep: Math.round(16 * repScale),
      tier,
    },
    {
      id: `obj-s${season}-${tier}-wave`,
      title: `Onda Nota ${targetWaveScore.toFixed(1)}+`,
      description: `Execute uma onda consistente para receber nota ${targetWaveScore.toFixed(1)} ou maior dos juízes.`,
      kind: 'excellent_wave',
      targetValue: targetWaveScore,
      progress: 0,
      completed: false,
      rewardPrize: Math.round((350 * prizeScale) / 10) * 10,
      rewardRep: Math.round(20 * repScale),
      tier,
    },
    {
      id: `obj-s${season}-${tier}-final`,
      title: 'Chegar à Final da Etapa',
      description: `Avance pelas eliminatórias até disputar a Final de um campeonato do circuito.`,
      kind: 'reach_final',
      targetValue: 1,
      progress: 0,
      completed: false,
      rewardPrize: Math.round((420 * prizeScale) / 10) * 10,
      rewardRep: Math.round(24 * repScale),
      tier,
    },
  ];

  if (tierIndex >= 1) {
    objectives.push({
      id: `obj-s${season}-${tier}-barrel`,
      title: `Tubo Limpo (${targetBarrelSec.toFixed(1)}s+)`,
      description: `Encaixe um tubo limpo de ${targetBarrelSec.toFixed(1)}s ou mais em uma bateria oficial.`,
      kind: 'barrel_time',
      targetValue: targetBarrelSec,
      progress: 0,
      completed: false,
      rewardPrize: Math.round((380 * prizeScale) / 10) * 10,
      rewardRep: Math.round(22 * repScale),
      tier,
    });
  }

  if (showcaseEvent) {
    objectives.push({
      id: `obj-s${season}-${tier}-peak`,
      title: `Título em ${showcaseEvent.name}`,
      description: `Vença a etapa ${showcaseEvent.name} para consolidar domínio nesse pico.`,
      kind: 'win_peak',
      targetValue: 1,
      targetBeachId: showcaseEvent.beachId,
      progress: 0,
      completed: false,
      rewardPrize: Math.round((560 * prizeScale) / 10) * 10,
      rewardRep: Math.round(32 * repScale),
      tier,
    });
  }

  return objectives;
}

export function buildRivalDialogue(
  ai: AISurfer,
  kind: 'close_finish' | 'head_to_head_challenge' | 'duel_won' | 'duel_lost',
  playerWonExchange: boolean,
  eventName: string,
  marginPts: number
): string {
  const marginText = `${marginPts.toFixed(1)} pts`;
  const styleLower = ai.style.toLowerCase();
  const isTubeSpecialist = styleLower.includes('tubo') || styleLower.includes('barrel');
  const isAerialSpecialist = styleLower.includes('aéreo') || styleLower.includes('aerial');

  if (kind === 'head_to_head_challenge') {
    if (isTubeSpecialist) {
      return `"Decidimos por ${marginText} em ${eventName}. Na próxima etapa quero você comigo no mesmo pico, onda por onda dentro do tubo — sem margem para desculpas."`;
    }
    if (isAerialSpecialist) {
      return `"Você encostou forte em ${eventName} (${marginText}). Já pedi chaveamento direto: vamos resolver essa disputa no lip na próxima bateria Head-to-Head."`;
    }
    return `"Diferença de apenas ${marginText} em ${eventName} não fecha a conta. A liga confirmou nosso duelo Head-to-Head — prepare sua melhor linha."`;
  }

  if (kind === 'duel_won') {
    return `"Você levou o duelo em ${eventName} por ${marginText} e segurou a pressão na hora certa. Respeito o surf, mas o próximo pico ainda tem meu nome."`;
  }

  if (kind === 'duel_lost') {
    return `"Mostrei no mar por que sustento esse nível no circuito. ${marginText} em ${eventName} — treina o drop, porque quando a série entrar de novo estarei lá."`;
  }

  // close_finish
  if (playerWonExchange) {
    return isAerialSpecialist
      ? `"Você me passou por ${marginText} em ${eventName}. Boa leitura de seção, mas na próxima bateria eu solto tudo no lip."`
      : `"Ficou por ${marginText} em ${eventName}. De olho em você no ranking — não vai ter espaço fácil na próxima chamada."`;
  }

  return isTubeSpecialist
    ? `"Por ${marginText} em ${eventName} eu fechei na frente. Você chegou perto da minha linha, mas o fundo do reef ainda cobra caro."`
    : `"Diferença mínima de ${marginText} em ${eventName}. Continue remando forte assim — essa disputa está só começando."`;
}

