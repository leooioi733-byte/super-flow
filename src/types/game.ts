export type MenuScreen =
  | 'home'
  | 'beaches'
  | 'surfers'
  | 'boards'
  | 'settings'
  | 'lineup'
  | 'surfing'
  | 'career'
  | 'careerCreate';

export type CameraMode = 'thirdPerson' | 'firstPerson';

export type FallType = 'sideways' | 'backward' | 'forward' | 'lipSlam' | 'barrelPinch';

export interface BeachEnvironmentConfig {
  waveAmplitude: number;
  waveFrequency: number;
  waveSpeed: number;
  choppiness: number;
  shallowColor: string;
  deepColor: string;
  sunElevation: number; // degrees above horizon
  sunAzimuth: number; // degrees
  cloudDensity: number;
  windStrength: number;
  fogDensity: number;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
}

export interface BeachSpot {
  id: string;
  name: string;
  region: string;
  breakType: string;
  swellHeight: string;
  swellPeriod: string;
  wind: string;
  waterTemp: string;
  description: string;
  environment: BeachEnvironmentConfig;
}

export interface SurferProfile {
  id: string;
  name: string;
  origin: string;
  stance: 'Regular' | 'Goofy';
  style: string;
  suitColor: string;
  accentColor: string;
  skinTone?: string;
  hairColor?: string;
  nationality?: string;
}

export interface SurfboardSpec {
  id: string;
  name: string;
  category: 'Shortboard' | 'Twin Fish' | 'Mid-Length' | 'Gun';
  dimensions: string;
  volume: string;
  finSetup: 'Thruster' | 'Twin' | 'Single + 2';
  hullColor: string;
  railColor: string;
  stringerColor: string;
  lengthScale: number;
  widthScale: number;
  noseRoundness: number;
  tailType: 'squash' | 'swallow' | 'pin';
}

export type BeachTheme = 'Tropical' | 'Sunset' | 'Classic';
export type BeachAtmosphere = 'Lively' | 'Chill';
export type WeatherCondition = 'sunny' | 'overcast' | 'rainy';
export type WeatherMode = 'dynamic' | WeatherCondition;

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra' | 'custom';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high';
export type RenderDistanceTier = 'short' | 'medium' | 'far' | 'ultra';
export type WaterQualityTier = 'low' | 'medium' | 'high';
export type AspectMode = 'auto' | '16:9' | '16:10' | '21:9';
export type ManeuverActionId = 'air' | 'bottomTurn' | 'cutback' | 'floater' | 'duckDive';
export type ManeuverKeyBindings = Record<ManeuverActionId, string>;

export interface GraphicsSettings {
  preset: GraphicsPreset;
  resolutionScale: number; // 0.65 | 0.8 | 1.0 | 1.25
  shadowQuality: ShadowQuality;
  renderDistance: RenderDistanceTier;
  waterQuality: WaterQualityTier;
  reflectionsEnabled: boolean;
  postProcessingEnabled: boolean;
  fpsLimit: 0 | 30 | 60 | 120;
}

export interface GameSettings {
  oceanDetail: 'High' | 'Balanced';
  cameraMotion: boolean;
  cameraBlurEnabled: boolean;
  cameraShakeEnabled: boolean;
  cameraImpactIntensity: number; // 0..1
  audioEnabled: boolean;
  audioVolume: number;
  aspectLock16x9: boolean;
  aspectMode: AspectMode;
  beachAtmosphere: BeachAtmosphere;
  beachTheme: BeachTheme;
  marineLifeEnabled: boolean;
  weatherMode: WeatherMode;
  graphics: GraphicsSettings;
  keyBindings: ManeuverKeyBindings;
}

// --- SURFING GAMEPLAY TYPES ---

export type SurfPhase =
  | 'beachWalk'
  | 'paddling'
  | 'duckDive'
  | 'takeoff'
  | 'riding'
  | 'maneuver'
  | 'airborne'
  | 'barrel'
  | 'wipeout'
  | 'recovering';

export type ManeuverType = 'bottomTurn' | 'cutback' | 'floater' | 'air';

export type ExecutionQuality = 'Failed' | 'Basic' | 'Good' | 'Perfect';

export type WaveSection = 'flat' | 'shoulder' | 'face' | 'pocket' | 'lip' | 'whitewater';

export interface SurfInputState {
  moveX: number; // -1 (left) to +1 (right)
  moveY: number; // -1 (down/back) to +1 (up/forward)
  balanceAdjust: number; // -1 to +1 manual balance counter-lean
  balanceStabilize?: boolean; // Shift hold precision balance damper
  requestedManeuver: ManeuverType | null;
  requestedDuckDive?: boolean;
}

export interface ManeuverAvailability {
  bottomTurn: boolean;
  cutback: boolean;
  floater: boolean;
  air: boolean;
  duckDive: boolean;
}

export type ReplayCameraAngle =
  | 'follow'
  | 'beach'
  | 'waterline'
  | 'helicopter'
  | 'firstPerson';

export interface ReplayHUDState {
  active: boolean;
  playing: boolean;
  available: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: 0.25 | 0.5 | 1;
  cameraAngle: ReplayCameraAngle;
}

export interface CompletedWaveTelemetry {
  waveNumber: number;
  points: number;
  barrelTime: number;
  maneuvers: number;
  bestManeuver: string;
  maxSequenceChain?: number;
}

export interface SurfHUDState {
  phase: SurfPhase;
  score: number;
  combo: number;
  comboTimer: number; // 0..1
  speedKmh: number;
  balance: number; // -1..+1 (0 is centered)
  stability: number; // 0..1
  waveSection: WaveSection;
  inBarrel: boolean;
  barrelTime: number;
  timeScale: number;
  lastCallout: string;
  lastQuality: ExecutionQuality | null;
  calloutId: number;
  sequenceChain: number;
  sequenceTag: string;
  sequenceTier: number;
  maxSequenceChain: number;
  waveNumber: number;
  currentWavePoints: number;
  currentWaveManeuvers: number;
  currentWaveBestManeuver: string;
  currentWaveBarrelTime: number;
  completedWaves: CompletedWaveTelemetry[];
  availability: ManeuverAvailability;
  isPaused: boolean;
  cameraMode: CameraMode;
  cameraModified: boolean;
  isUnderwater: boolean;
  weather: WeatherCondition;
  weatherMode: WeatherMode;
  rainIntensity: number;
  maneuverSlowMo: number; // 0..1 smooth maneuver slow-motion factor
  postFxActive: boolean; // true when WebGL ShaderPass renders camera FX directly
  cutsceneActive: boolean;
  cutsceneStage: number; // 0 if inactive, 1..6 during pre-heat cutscene
  cutsceneProgress: number; // 0..1
  replay: ReplayHUDState;
}
