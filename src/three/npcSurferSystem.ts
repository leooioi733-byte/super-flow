import * as THREE from 'three';
import { SURFBOARDS } from '../data/surfData';
import {
  FallType,
  GraphicsPreset,
  ManeuverType,
  SurfboardSpec,
  SurferProfile,
} from '../types/game';
import { getBeachHeightAt } from './oceanShader';
import { createSurferRig, SurferRig } from './surferCharacter';
import { WaterParticleSystem } from './waterParticles';
import {
  getWaveShoaling,
  sampleSurfWave,
  SurferPhysicsState,
  SurfWaveParams,
  WaveSample,
} from './wavePhysics';

export type NpcSkillTier = 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro';

export type NpcAiState =
  | 'WAITING'
  | 'POSITIONING'
  | 'PADDLING'
  | 'CATCHING_WAVE'
  | 'RIDING'
  | 'MANEUVERING'
  | 'FALLING'
  | 'RECOVERING'
  | 'RETURNING';

export interface NpcPersonality {
  skill: NpcSkillTier;
  /** Offset from breakX in breakDir meters when hunting takeoff */
  preferredPeakOffset: number;
  /** Minimum / maximum wave height this surfer willingly paddles for */
  minWaveHeight: number;
  maxWaveHeight: number;
  /** 0..1 aggression in claiming waves and hitting critical sections */
  aggression: number;
  /** 0..1 maneuver execution consistency */
  consistency: number;
  /** Base probability factor for wiping out in steep lips/whitewater */
  wipeoutProneness: number;
  /** Lineup waiting anchor offset in world space */
  homeX: number;
  homeZ: number;
  /** Preferred maneuvers weighted for variety */
  favoriteManeuver: ManeuverType;
  /** Optional career AI focus weighting */
  styleFocus?: 'technical' | 'barrel' | 'allround';
}

export interface CareerHeatNpcSpec {
  id: string;
  name: string;
  profile: SurferProfile;
  boardId: string;
  skillLevel: number;
  barrelSkill: number;
  airSkill: number;
  consistency: number;
  styleFocus: 'technical' | 'barrel' | 'allround';
}

export interface NpcSurferAgent {
  id: string;
  name: string;
  personality: NpcPersonality;
  profile: SurferProfile;
  board: SurfboardSpec;
  rig: SurferRig;
  state: SurferPhysicsState;
  aiState: NpcAiState;
  aiTimer: number;
  decisionTimer: number;
  maneuverCooldown: number;
  targetX: number;
  targetZ: number;
  carvePhase: number;
  carveFreq: number;
  rideDuration: number;
  maxRideDuration: number;
  lastRideTimestamp: number;
  claimedWaveNum: number;
  abandonCooldown: number;
  lodTickCounter: number;
}

export interface NpcSurferSystem {
  group: THREE.Group;
  setEnabled: (enabled: boolean) => void;
  setQualityPreset: (preset: GraphicsPreset) => void;
  configureCareerHeatOpponents: (
    specs: CareerHeatNpcSpec[] | null,
    waveParams: SurfWaveParams,
    playerPos?: THREE.Vector3
  ) => void;
  resetLineup: (waveParams: SurfWaveParams, playerPos?: THREE.Vector3) => void;
  stepCutsceneFormation: (
    rawDt: number,
    simTime: number,
    waveParams: SurfWaveParams,
    stage: number,
    stageProgress: number
  ) => void;
  update: (
    rawDt: number,
    simTime: number,
    waveParams: SurfWaveParams,
    playerState: SurferPhysicsState,
    cameraPos: THREE.Vector3,
    waterParticles?: WaterParticleSystem | null
  ) => void;
  getAgentsSnapshot: () => readonly NpcSurferAgent[];
  dispose: () => void;
}

interface NpcRosterDef {
  id: string;
  name: string;
  boardId: string;
  profile: SurferProfile;
  personality: NpcPersonality;
}

const NPC_ROSTER: NpcRosterDef[] = [
  {
    id: 'npc-leo-pro',
    name: 'Léo Santana',
    boardId: 'phantom-carbon',
    profile: {
      id: 'npc-leo-pro',
      name: 'Léo Santana',
      origin: 'Saquarema',
      nationality: 'Brasil',
      stance: 'Regular',
      style: 'Pro Barrel & Aerials',
      suitColor: '#131d2b',
      accentColor: '#38d9c8',
      skinTone: '#b87a57',
      hairColor: '#181412',
    },
    personality: {
      skill: 'Pro',
      preferredPeakOffset: 3.5,
      minWaveHeight: 1.6,
      maxWaveHeight: 6.0,
      aggression: 0.92,
      consistency: 0.95,
      wipeoutProneness: 0.08,
      homeX: -6,
      homeZ: -38,
      favoriteManeuver: 'air',
    },
  },
  {
    id: 'npc-koa-adv',
    name: 'Koa Hale',
    boardId: 'marea-pro-fish',
    profile: {
      id: 'npc-koa-adv',
      name: 'Koa Hale',
      origin: 'Haleiwa',
      nationality: 'Havaí',
      stance: 'Goofy',
      style: 'Rail Power & Cutbacks',
      suitColor: '#0e283c',
      accentColor: '#f4c97a',
      skinTone: '#c58a66',
      hairColor: '#1f1916',
    },
    personality: {
      skill: 'Advanced',
      preferredPeakOffset: 8.5,
      minWaveHeight: 1.5,
      maxWaveHeight: 5.5,
      aggression: 0.8,
      consistency: 0.88,
      wipeoutProneness: 0.14,
      homeX: 11,
      homeZ: -34,
      favoriteManeuver: 'cutback',
    },
  },
  {
    id: 'npc-tiago-int',
    name: 'Tiago Mendes',
    boardId: 'vortex-pro',
    profile: {
      id: 'npc-tiago-int',
      name: 'Tiago Mendes',
      origin: 'Ericeira',
      nationality: 'Portugal',
      stance: 'Regular',
      style: 'Carves & Floaters',
      suitColor: '#162736',
      accentColor: '#e68a5c',
      skinTone: '#d7a283',
      hairColor: '#2e2119',
    },
    personality: {
      skill: 'Intermediate',
      preferredPeakOffset: 15.0,
      minWaveHeight: 1.4,
      maxWaveHeight: 4.5,
      aggression: 0.62,
      consistency: 0.72,
      wipeoutProneness: 0.28,
      homeX: -22,
      homeZ: -30,
      favoriteManeuver: 'floater',
    },
  },
  {
    id: 'npc-sora-int',
    name: 'Sora Takahashi',
    boardId: 'pacific-mid',
    profile: {
      id: 'npc-sora-int',
      name: 'Sora Takahashi',
      origin: 'Shonan',
      nationality: 'Japão',
      stance: 'Regular',
      style: 'Smooth Mid-Length Trim',
      suitColor: '#1a3242',
      accentColor: '#e7dcc8',
      skinTone: '#dcb194',
      hairColor: '#141418',
    },
    personality: {
      skill: 'Intermediate',
      preferredPeakOffset: 18.0,
      minWaveHeight: 1.3,
      maxWaveHeight: 4.3,
      aggression: 0.55,
      consistency: 0.75,
      wipeoutProneness: 0.25,
      homeX: 25,
      homeZ: -31,
      favoriteManeuver: 'bottomTurn',
    },
  },
  {
    id: 'npc-malia-beg',
    name: 'Malia Kekoa',
    boardId: 'keel-fish',
    profile: {
      id: 'npc-malia-beg',
      name: 'Malia Kekoa',
      origin: 'Waikiki',
      nationality: 'Havaí',
      stance: 'Goofy',
      style: 'Relaxed Shoulder Glide',
      suitColor: '#1c3a4c',
      accentColor: '#5eead4',
      skinTone: '#cf9573',
      hairColor: '#3a271b',
    },
    personality: {
      skill: 'Beginner',
      preferredPeakOffset: 24.0,
      minWaveHeight: 1.2,
      maxWaveHeight: 3.7,
      aggression: 0.35,
      consistency: 0.48,
      wipeoutProneness: 0.48,
      homeX: 36,
      homeZ: -25,
      favoriteManeuver: 'bottomTurn',
    },
  },
];

// Zero-GC scratch objects reused across all NPC updates
const _normalA = new THREE.Vector3();
const _normalB = new THREE.Vector3();
const _normalC = new THREE.Vector3();
const _blendedNormal = new THREE.Vector3();
const _sampleCenter: WaveSample = {
  height: 0,
  normal: new THREE.Vector3(0, 1, 0),
  slopeSteepness: 0,
  faceProgress: 0,
  section: 'flat',
  inBarrelZone: false,
  barrelDepth: 0,
  curlHeight: 0,
  curlOverhangZ: 0,
};

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function createNpcPhysicsState(x: number, z: number): SurferPhysicsState {
  return {
    position: new THREE.Vector3(x, 0.2, z),
    velocity: new THREE.Vector3(0, 0, 0),
    heading: Math.PI,
    roll: 0,
    pitch: 0,
    boardNormal: new THREE.Vector3(0, 1, 0),
    phase: 'paddling',
    speed: 0,
    balance: 0,
    stability: 1.0,
    catchProgress: 0,
    takeoffTimer: 0,
    duckDiveTimer: 0,
    duckDiveBonusAwarded: false,
    paddleStrokePhase: Math.random() * Math.PI * 2,
    walkPhase: 0,
    activeManeuver: null,
    maneuverTimer: 0,
    maneuverDuration: 1.0,
    maneuverQuality: null,
    maneuverSpin: 0,
    verticalVel: 0,
    airHeight: 0,
    inBarrel: false,
    barrelTimer: 0,
    barrelExitedAwarded: false,
    fallType: 'sideways',
    fallDir: 1,
    fallIntensity: 0.65,
    wipeoutTimer: 0,
    wipeoutSplashTriggered: false,
    submersionDepth: 0,
    underwaterAmount: 0,
    recoverTimer: 0,
    boardDetached: false,
    boardPos: new THREE.Vector3(x, 0.2, z),
    boardVel: new THREE.Vector3(0, 0, 0),
    boardHeading: Math.PI,
    boardRoll: 0,
    boardPitch: 0,
    impactEventIntensity: 0,
    impactWhitewater: 0,
    justResurfaced: false,
    score: 0,
    combo: 1,
    comboTimer: 0,
    timeScale: 1.0,
    targetTimeScale: 1.0,
    slowMoHoldTimer: 0,
    waveNumber: 1,
    currentWavePoints: 0,
    currentWaveManeuvers: 0,
    currentWaveBestManeuver: '',
    currentWaveBestManeuverPts: 0,
    currentWaveBarrelTime: 0,
    completedWaves: [],
    isBigBarrelWave: false,
    lastCallout: '',
    lastQuality: null,
    calloutId: 0,
    landingCompression: 0,
    sequenceChain: 0,
    maxSequenceChain: 0,
    sequenceTag: '',
    sequenceTier: 0,
    justSplashed: false,
    splashIntensity: 0,
    carvingIntensity: 0,
    executedManeuverType: null,
    executedManeuverQuality: null,
    failedManeuver: false,
    justCaughtWave: false,
    justDuckDived: false,
    justExitedBarrel: false,
    paddleStrokePulse: false,
    footstepPulse: false,
  };
}

/**
 * Autonomous AI NPC Surfer system (Etapa 1: AI Surf).
 * Drives independent 3D surfers with a 9-state AI machine, wave priority & anti-drop-in rules,
 * skill-tiered maneuver selection, wipeout & swim recovery, and distance-LOD performance.
 */
export function createNpcSurferSystem(): NpcSurferSystem {
  const group = new THREE.Group();
  let enabled = false;
  let maxActiveCount = 5;
  let simClock = 0;

  // Global wave priority lock so multiple NPCs never scramble for the exact same peak
  let claimedWaveNumber = -1;
  let claimedWaveOwnerId: string | null = null;
  let prevWaveCenterZ = -999;
  let waveScanTimer = 0;

  const freeAgents: NpcSurferAgent[] = NPC_ROSTER.map((def, idx) => {
    const board = SURFBOARDS.find((b) => b.id === def.boardId) ?? SURFBOARDS[0];
    const rig = createSurferRig(board, def.profile, {
      castShadows: false,
      shareStaticGeometries: true,
    });
    const state = createNpcPhysicsState(def.personality.homeX, def.personality.homeZ);
    rig.root.visible = false;
    group.add(rig.root);

    return {
      id: def.id,
      name: def.name,
      personality: def.personality,
      profile: def.profile,
      board,
      rig,
      state,
      aiState: 'WAITING',
      aiTimer: 0,
      decisionTimer: idx * 0.024, // Staggered ~9Hz decision ticks across agents
      maneuverCooldown: 1.2 + idx * 0.4,
      targetX: def.personality.homeX,
      targetZ: def.personality.homeZ,
      carvePhase: idx * 1.4,
      carveFreq: 1.45 + idx * 0.16,
      rideDuration: 0,
      maxRideDuration: 9.0,
      lastRideTimestamp: -15 + idx * 2.5,
      claimedWaveNum: -1,
      abandonCooldown: 0,
      lodTickCounter: idx,
    };
  });

  let careerAgents: NpcSurferAgent[] = [];
  let careerOpponentsKey = '';
  let agents: NpcSurferAgent[] = freeAgents;

  const getActiveCount = () =>
    careerAgents.length > 0 ? agents.length : Math.min(agents.length, maxActiveCount);

  const syncAgentVisibility = () => {
    const activeCount = getActiveCount();
    for (let i = 0; i < freeAgents.length; i++) {
      freeAgents[i].rig.root.visible =
        enabled && careerAgents.length === 0 && i < activeCount;
    }
    for (let i = 0; i < careerAgents.length; i++) {
      careerAgents[i].rig.root.visible = enabled && i < activeCount;
    }
  };

  const disposeCareerAgents = () => {
    for (let i = 0; i < careerAgents.length; i++) {
      group.remove(careerAgents[i].rig.root);
      careerAgents[i].rig.dispose();
    }
    careerAgents = [];
  };

  const resetLineup = (waveParams: SurfWaveParams, playerPos?: THREE.Vector3) => {
    claimedWaveNumber = -1;
    claimedWaveOwnerId = null;
    prevWaveCenterZ = waveParams.waveCenterZ;
    waveScanTimer = 0;
    simClock = 0;

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      let x = a.personality.homeX;
      let z = a.personality.homeZ;
      if (playerPos) {
        const dx = x - playerPos.x;
        const dz = z - playerPos.z;
        if (dx * dx + dz * dz < 100) {
          x += dx >= 0 ? 12 : -12;
        }
      }
      const waterY = sampleSurfWave(x, z, waveParams, _normalA).height;
      const beachY = getBeachHeightAt(x, z);

      a.state.position.set(x, Math.max(beachY + 0.04, waterY + 0.025), z);
      a.state.velocity.set(0, 0, 0);
      a.state.heading = Math.PI + (i % 2 === 0 ? 0.18 : -0.18);
      a.state.roll = 0;
      a.state.pitch = 0;
      a.state.boardNormal.copy(_normalA);
      a.state.phase = 'paddling';
      a.state.speed = 0;
      a.state.balance = 0;
      a.state.stability = 1.0;
      a.state.catchProgress = 0;
      a.state.boardDetached = false;
      a.state.boardPos.copy(a.state.position);
      a.state.boardHeading = a.state.heading;
      a.state.activeManeuver = null;
      a.state.inBarrel = false;
      a.state.maneuverSpin = 0;
      a.state.airHeight = 0;
      a.state.verticalVel = 0;
      a.state.justSplashed = false;

      a.aiState = 'WAITING';
      a.aiTimer = 0;
      a.decisionTimer = i * 0.024;
      a.maneuverCooldown = 1.0;
      a.targetX = x;
      a.targetZ = z;
      a.rideDuration = 0;
      a.claimedWaveNum = -1;
      a.abandonCooldown = 0;
    }

    syncAgentVisibility();
    const activeCount = getActiveCount();
    for (let i = 0; i < activeCount; i++) {
      if (agents[i].rig.root.visible) {
        agents[i].rig.animate(agents[i].state, waveParams.simTime, 0.1);
      }
    }
  };

  const configureCareerHeatOpponents = (
    specs: CareerHeatNpcSpec[] | null,
    waveParams: SurfWaveParams,
    playerPos?: THREE.Vector3
  ) => {
    if (!specs || specs.length === 0) {
      if (careerAgents.length > 0 || careerOpponentsKey !== '') {
        disposeCareerAgents();
        careerOpponentsKey = '';
        agents = freeAgents;
        syncAgentVisibility();
      }
      return;
    }

    const nextKey = specs.map((sp) => `${sp.id}:${sp.boardId}:${sp.styleFocus}`).join('|');
    if (nextKey !== careerOpponentsKey) {
      disposeCareerAgents();
      careerOpponentsKey = nextKey;

      const homeAnchors: Array<[number, number]> =
        specs.length === 1
          ? [[9.5, -24]]
          : [
              [-11.5, -26],
              [10.5, -24],
              [21.0, -30],
            ];

      careerAgents = specs.slice(0, 3).map((sp, idx) => {
        const board = SURFBOARDS.find((b) => b.id === sp.boardId) ?? SURFBOARDS[0];
        const rig = createSurferRig(board, sp.profile, {
          castShadows: false,
          shareStaticGeometries: true,
        });
        const [homeX, homeZ] = homeAnchors[idx] ?? [10 + idx * 8, -26];
        const skillTier: NpcSkillTier =
          sp.skillLevel >= 82
            ? 'Pro'
            : sp.skillLevel >= 64
              ? 'Advanced'
              : sp.skillLevel >= 45
                ? 'Intermediate'
                : 'Beginner';
        const consistency = THREE.MathUtils.clamp(sp.consistency, 0.45, 0.96);
        const preferredPeakOffset =
          sp.styleFocus === 'barrel' ? 3.2 : sp.styleFocus === 'technical' ? 6.5 : 8.0;
        const favoriteManeuver: ManeuverType =
          sp.styleFocus === 'technical'
            ? sp.airSkill >= 72
              ? 'air'
              : 'cutback'
            : sp.styleFocus === 'barrel'
              ? 'bottomTurn'
              : 'cutback';

        const personality: NpcPersonality = {
          skill: skillTier,
          preferredPeakOffset,
          minWaveHeight: 1.3,
          maxWaveHeight: 6.2,
          aggression: THREE.MathUtils.clamp(0.55 + sp.skillLevel * 0.0042, 0.55, 0.96),
          consistency,
          wipeoutProneness: THREE.MathUtils.clamp((1 - consistency) * 0.65, 0.06, 0.38),
          homeX,
          homeZ,
          favoriteManeuver,
          styleFocus: sp.styleFocus,
        };

        const state = createNpcPhysicsState(homeX, homeZ);
        rig.root.visible = false;
        group.add(rig.root);

        return {
          id: sp.id,
          name: sp.name,
          personality,
          profile: sp.profile,
          board,
          rig,
          state,
          aiState: 'WAITING',
          aiTimer: 0,
          decisionTimer: idx * 0.025,
          maneuverCooldown: 1.1 + idx * 0.25,
          targetX: homeX,
          targetZ: homeZ,
          carvePhase: idx * 1.6,
          carveFreq: 1.5 + idx * 0.14,
          rideDuration: 0,
          maxRideDuration: 10.0,
          lastRideTimestamp: -12 + idx * 2.0,
          claimedWaveNum: -1,
          abandonCooldown: 0,
          lodTickCounter: idx,
        };
      });

      agents = careerAgents;
      resetLineup(waveParams, playerPos);
    } else {
      agents = careerAgents;
      syncAgentVisibility();
    }
  };

  const setEnabled = (val: boolean) => {
    enabled = val;
    group.visible = val;
    syncAgentVisibility();
  };

  const setQualityPreset = (preset: GraphicsPreset) => {
    maxActiveCount = preset === 'low' ? 2 : preset === 'medium' ? 3 : 5;
    syncAgentVisibility();
  };

  /**
   * Computes whether the human player holds priority over the current wave or is actively riding near an NPC.
   */
  const isPlayerUsingMainWave = (
    playerState: SurferPhysicsState,
    wp: SurfWaveParams
  ): boolean => {
    if (
      playerState.phase === 'takeoff' ||
      playerState.phase === 'riding' ||
      playerState.phase === 'maneuver' ||
      playerState.phase === 'airborne' ||
      playerState.phase === 'barrel'
    ) {
      return true;
    }
    if (playerState.phase === 'paddling' || playerState.phase === 'duckDive') {
      const dz = playerState.position.z - wp.waveCenterZ;
      const nearCrest = dz > -6 && dz < 28;
      const paddlingShoreward = playerState.velocity.z > 0.45 || playerState.catchProgress > 0.08;
      const nearPeak = Math.abs(playerState.position.x - wp.breakX) < 30;
      if (nearCrest && (paddlingShoreward || nearPeak)) {
        return true;
      }
    }
    return false;
  };

  /**
   * Checks whether an NPC's position or projected path threatens to cross the player's surfing line.
   */
  const threatensPlayerPath = (
    npc: NpcSurferAgent,
    playerState: SurferPhysicsState
  ): boolean => {
    const s = npc.state;
    const dx = s.position.x - playerState.position.x;
    const dz = s.position.z - playerState.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < 11 * 11) return true;

    const playerActivelySurfing =
      playerState.phase === 'takeoff' ||
      playerState.phase === 'riding' ||
      playerState.phase === 'maneuver' ||
      playerState.phase === 'airborne' ||
      playerState.phase === 'barrel';

    if (!playerActivelySurfing) return false;

    // Project 1.6s ahead along player's velocity corridor
    const pvLen = Math.hypot(playerState.velocity.x, playerState.velocity.z);
    if (pvLen > 1.2) {
      const pvx = playerState.velocity.x / pvLen;
      const pvz = playerState.velocity.z / pvLen;
      const proj = dx * pvx + dz * pvz;
      if (proj > -4 && proj < 26) {
        const perp = Math.abs(dx * -pvz + dz * pvx);
        if (perp < 10.5) return true;
      }
    }
    return false;
  };

  /**
   * Coordinator chooses at most one ready NPC for the incoming wave when player does not claim priority.
   */
  const evaluateWavePriority = (
    wp: SurfWaveParams,
    playerState: SurferPhysicsState,
    activeCount: number
  ) => {
    const waveNum = playerState.waveNumber;

    // Reset lock cleanly on new wave (or automatic wave wrap while player stays on beach/lineup)
    if (waveNum !== claimedWaveNumber || wp.waveCenterZ < prevWaveCenterZ - 40) {
      claimedWaveNumber = waveNum;
      claimedWaveOwnerId = null;
    }
    prevWaveCenterZ = wp.waveCenterZ;

    const playerPriority = isPlayerUsingMainWave(playerState, wp);
    if (playerPriority) {
      claimedWaveOwnerId = null;
      return;
    }

    // If an owner already has this wave and is actively paddling/catching/riding it, keep priority
    if (claimedWaveOwnerId !== null) {
      let owner: NpcSurferAgent | null = null;
      for (let i = 0; i < activeCount; i++) {
        if (agents[i].id === claimedWaveOwnerId) {
          owner = agents[i];
          break;
        }
      }
      if (
        owner &&
        (owner.aiState === 'PADDLING' ||
          owner.aiState === 'CATCHING_WAVE' ||
          owner.aiState === 'RIDING' ||
          owner.aiState === 'MANEUVERING')
      ) {
        return;
      }
      claimedWaveOwnerId = null;
    }

    // Ideal scan window when swell approaches the outer lineup
    const dzFromLineup = -26 - wp.waveCenterZ;
    if (dzFromLineup < -14 || dzFromLineup > 34) return;

    let bestAgent: NpcSurferAgent | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < activeCount; i++) {
      const a = agents[i];
      if (a.aiState !== 'WAITING' && a.aiState !== 'POSITIONING') continue;
      if (a.abandonCooldown > 0) continue;

      const p = a.personality;
      if (wp.waveHeight < p.minWaveHeight || wp.waveHeight > p.maxWaveHeight) continue;

      const dz = a.state.position.z - wp.waveCenterZ;
      // Pick up wave within realistic sprint-paddle distance so NPC always reaches the face cleanly
      if (dz < 5 || dz > 24) continue;

      // Ensure NPC is not in the player's personal space
      const distToPlayer = Math.hypot(
        a.state.position.x - playerState.position.x,
        a.state.position.z - playerState.position.z
      );
      if (distToPlayer < 12 && playerState.phase !== 'beachWalk') continue;

      const idealX = wp.breakX + wp.breakDir * p.preferredPeakOffset;
      const xErr = Math.abs(a.state.position.x - idealX);
      const waitBonus = Math.min(28, (simClock - a.lastRideTimestamp) * 1.5);
      const skillFit =
        wp.waveHeight >= 3.2
          ? p.skill === 'Pro'
            ? 14
            : p.skill === 'Advanced'
              ? 10
              : -8
          : 4;

      const score = waitBonus + skillFit + p.aggression * 8 - xErr * 0.45 - Math.abs(dz - 15) * 0.35;
      if (score > bestScore) {
        bestScore = score;
        bestAgent = a;
      }
    }

    if (bestAgent) {
      claimedWaveOwnerId = bestAgent.id;
      bestAgent.claimedWaveNum = waveNum;
      bestAgent.aiState = 'PADDLING';
      bestAgent.aiTimer = 0;
    }
  };

  const triggerNpcWipeout = (
    agent: NpcSurferAgent,
    fallType: FallType,
    intensity: number,
    dir: number
  ) => {
    const s = agent.state;
    agent.aiState = 'FALLING';
    agent.aiTimer = 0;
    s.phase = 'wipeout';
    s.inBarrel = false;
    s.activeManeuver = null;
    s.airHeight = 0;
    s.verticalVel = 0;
    s.fallType = fallType;
    s.fallIntensity = intensity;
    s.fallDir = dir;
    s.wipeoutTimer = 0;
    s.wipeoutSplashTriggered = true;
    s.justSplashed = true;
    s.splashIntensity = Math.max(0.7, intensity);

    if (!s.boardDetached) {
      s.boardDetached = true;
      s.boardPos.copy(s.position);
      s.boardHeading = s.heading;
      s.boardRoll = s.roll;
      s.boardPitch = s.pitch;
      s.boardVel.set(
        s.velocity.x * 0.45 + dir * 2.2,
        1.6,
        s.velocity.z * 0.4 + 1.1
      );
    }

    if (claimedWaveOwnerId === agent.id) {
      claimedWaveOwnerId = null;
    }
  };

  const chooseNpcManeuver = (
    agent: NpcSurferAgent,
    sample: WaveSample
  ): ManeuverType | null => {
    const p = agent.personality;
    const speed = agent.state.speed;
    if (agent.maneuverCooldown > 0 || speed < 6.4) return null;

    if (p.skill === 'Beginner') {
      if (sample.faceProgress < 0.55 && Math.random() < 0.42) return 'bottomTurn';
      if ((sample.section === 'face' || sample.section === 'shoulder') && speed > 7.2 && Math.random() < 0.24) {
        return 'cutback';
      }
      return null;
    }

    if (p.skill === 'Intermediate') {
      if (sample.faceProgress < 0.48 && Math.random() < 0.55) return 'bottomTurn';
      if ((sample.section === 'lip' || sample.faceProgress > 0.54) && speed > 7.2 && Math.random() < 0.42) {
        return 'floater';
      }
      if ((sample.section === 'face' || sample.section === 'shoulder') && speed > 7.4 && Math.random() < 0.52) {
        return 'cutback';
      }
      return null;
    }

    // Advanced & Pro: dynamic wave-section combos shaped by styleFocus
    const techBias = p.styleFocus === 'technical' ? 0.18 : p.styleFocus === 'barrel' ? -0.1 : 0;
    const allowAir = (p.skill === 'Pro' ? 0.62 : 0.36) + techBias;
    if (
      (sample.section === 'lip' || sample.section === 'pocket' || sample.faceProgress > 0.56) &&
      speed >= 8.8 &&
      Math.random() < allowAir
    ) {
      return 'air';
    }
    if ((sample.section === 'lip' || sample.faceProgress > 0.52) && speed >= 7.0 && Math.random() < 0.55) {
      return 'floater';
    }
    if ((sample.section === 'shoulder' || sample.section === 'face') && speed >= 7.2 && Math.random() < 0.68 + techBias * 0.5) {
      return 'cutback';
    }
    if (sample.faceProgress < 0.54 && Math.random() < 0.65) {
      return 'bottomTurn';
    }
    return null;
  };

  /**
   * Staggered high-level AI state evaluation (~9Hz per NPC).
   */
  const runAiDecision = (
    agent: NpcSurferAgent,
    wp: SurfWaveParams,
    playerState: SurferPhysicsState,
    activeCount: number
  ) => {
    const s = agent.state;
    const p = agent.personality;
    const playerOwnsWave = isPlayerUsingMainWave(playerState, wp);

    if (agent.aiState === 'WAITING') {
      // Gently choose an available lineup spot around the surfer's preferred reef zone
      const driftX = Math.sin(simClock * 0.18 + agent.carvePhase) * 5.0;
      const lineupX = THREE.MathUtils.clamp(p.homeX + driftX, -48, 48);
      const lineupZ = p.homeZ;
      const distHome = Math.hypot(s.position.x - lineupX, s.position.z - lineupZ);
      if (distHome > 6.5 || agent.aiTimer > 4.5) {
        agent.targetX = lineupX;
        agent.targetZ = lineupZ;
        agent.aiState = 'POSITIONING';
        agent.aiTimer = 0;
      }
    } else if (agent.aiState === 'POSITIONING') {
      const distTarget = Math.hypot(s.position.x - agent.targetX, s.position.z - agent.targetZ);
      if (distTarget < 2.6 || agent.aiTimer > 5.5) {
        agent.aiState = 'WAITING';
        agent.aiTimer = 0;
      }
    } else if (agent.aiState === 'PADDLING') {
      const dz = s.position.z - wp.waveCenterZ;
      const lostPriority =
        playerOwnsWave ||
        (claimedWaveOwnerId !== null && claimedWaveOwnerId !== agent.id) ||
        threatensPlayerPath(agent, playerState);

      if (
        lostPriority ||
        dz < -4.5 ||
        dz > 30 ||
        wp.waveHeight > p.maxWaveHeight + 0.4 ||
        agent.aiTimer > 9.5
      ) {
        // Abandon wave attempt cleanly!
        if (claimedWaveOwnerId === agent.id) claimedWaveOwnerId = null;
        agent.abandonCooldown = 2.0;
        agent.aiState = 'POSITIONING';
        agent.aiTimer = 0;
        agent.targetX = p.homeX;
        agent.targetZ = p.homeZ;
        s.catchProgress = 0;
      }
    } else if (agent.aiState === 'RIDING') {
      const sample = sampleSurfWave(s.position.x, s.position.z, wp, _normalB);
      const nearShore = s.position.z > 2.5 || getBeachHeightAt(s.position.x, s.position.z) > -0.35;
      const waveDead = sample.slopeSteepness < 0.08 && agent.rideDuration > 2.0;
      const mustYieldToPlayer = threatensPlayerPath(agent, playerState);

      if (nearShore || waveDead || agent.rideDuration >= agent.maxRideDuration || mustYieldToPlayer) {
        // Kick out cleanly over the back/shoulder of the wave and paddle back to lineup
        s.inBarrel = false;
        s.phase = 'paddling';
        s.heading = Math.PI - wp.breakDir * 0.35;
        s.velocity.multiplyScalar(0.35);
        agent.aiState = 'RETURNING';
        agent.aiTimer = 0;
        agent.lastRideTimestamp = simClock;
        agent.targetX = p.homeX;
        agent.targetZ = p.homeZ;
        if (claimedWaveOwnerId === agent.id) claimedWaveOwnerId = null;
        return;
      }

      // Check barrel survival / pinch for Beginners
      if (sample.inBarrelZone && p.skill === 'Beginner' && Math.random() < 0.35) {
        triggerNpcWipeout(agent, 'barrelPinch', 0.85, -wp.breakDir);
        return;
      }

      // Trigger autonomous skill-based maneuvers!
      if (!s.inBarrel && agent.maneuverCooldown <= 0) {
        const chosen = chooseNpcManeuver(agent, sample);
        if (chosen) {
          s.activeManeuver = chosen;
          s.maneuverTimer = 0;
          s.maneuverSpin = 0;
          s.maneuverDuration =
            chosen === 'air' ? 1.15 : chosen === 'cutback' ? 1.05 : chosen === 'floater' ? 1.0 : 0.9;
          if (chosen === 'air') {
            s.phase = 'airborne';
            s.airHeight = 0.06;
            s.verticalVel = p.skill === 'Pro' ? 7.6 : 6.2;
          } else {
            s.phase = 'maneuver';
          }
          s.justSplashed = true;
          s.splashIntensity = chosen === 'air' ? 0.78 : 0.68;
          agent.aiState = 'MANEUVERING';
          agent.aiTimer = 0;
          agent.maneuverCooldown = p.skill === 'Pro' ? 1.4 : p.skill === 'Advanced' ? 1.85 : 2.5;
        }
      }
    } else if (agent.aiState === 'RETURNING') {
      // Watch out for player if returning near active surfing pocket
      if (threatensPlayerPath(agent, playerState)) {
        agent.targetX =
          s.position.x >= playerState.position.x
            ? THREE.MathUtils.clamp(playerState.position.x + 18, -55, 55)
            : THREE.MathUtils.clamp(playerState.position.x - 18, -55, 55);
      } else {
        agent.targetX = p.homeX;
        agent.targetZ = p.homeZ;
      }

      const distHome = Math.hypot(s.position.x - agent.targetX, s.position.z - agent.targetZ);
      if (distHome < 4.5 || (s.position.z <= p.homeZ + 3 && agent.aiTimer > 2.5)) {
        agent.aiState = 'WAITING';
        agent.aiTimer = 0;
      }
    }

    // Extra NPC-NPC avoidance adjustment for targetX when waiting/positioning
    for (let j = 0; j < activeCount; j++) {
      const other = agents[j];
      if (other === agent) continue;
      const dx = s.position.x - other.state.position.x;
      const dz = s.position.z - other.state.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < 25 && dSq > 0.01 && (agent.aiState === 'WAITING' || agent.aiState === 'POSITIONING')) {
        agent.targetX = THREE.MathUtils.clamp(agent.targetX + (dx >= 0 ? 3.5 : -3.5), -54, 54);
      }
    }
  };

  /**
   * Aligns surfboard smoothly to wave surface (3-point close-up or fast 1-point distant LOD).
   */
  const alignBoardToSurface = (
    s: SurferPhysicsState,
    wp: SurfWaveParams,
    highDetail: boolean,
    dt: number
  ) => {
    const center = sampleSurfWave(s.position.x, s.position.z, wp, _normalA);
    const beachY = getBeachHeightAt(s.position.x, s.position.z);
    let targetY = center.height;

    if (highDetail) {
      const fx = Math.sin(s.heading);
      const fz = Math.cos(s.heading);
      const rx = fz;
      const rz = -fx;
      const nose = sampleSurfWave(s.position.x + fx * 0.9, s.position.z + fz * 0.9, wp, _normalB);
      const tail = sampleSurfWave(s.position.x - fx * 0.9, s.position.z - fz * 0.9, wp, _normalC);
      const side = sampleSurfWave(s.position.x + rx * 0.3, s.position.z + rz * 0.3, wp);
      targetY = (center.height * 2 + nose.height + tail.height + side.height) * 0.2;
      _blendedNormal
        .copy(_normalA)
        .multiplyScalar(2)
        .add(_normalB)
        .add(_normalC)
        .normalize();
      s.boardNormal.lerp(_blendedNormal, 1 - Math.exp(-12 * dt));
    } else {
      s.boardNormal.lerp(_normalA, 1 - Math.exp(-10 * dt));
    }

    if (s.phase !== 'airborne' && s.phase !== 'wipeout' && s.phase !== 'duckDive') {
      s.position.y = THREE.MathUtils.damp(
        s.position.y,
        Math.max(beachY + 0.04, targetY + 0.03),
        16,
        dt
      );
    }

    _sampleCenter.height = center.height;
    _sampleCenter.slopeSteepness = center.slopeSteepness;
    _sampleCenter.faceProgress = center.faceProgress;
    _sampleCenter.section = center.section;
    _sampleCenter.inBarrelZone = center.inBarrelZone;
    _sampleCenter.barrelDepth = center.barrelDepth;
    _sampleCenter.curlHeight = center.curlHeight;
  };

  /**
   * Advances continuous NPC kinematics & animations per frame with zero allocations.
   */
  const stepAgentPhysics = (
    agent: NpcSurferAgent,
    dt: number,
    wp: SurfWaveParams,
    playerState: SurferPhysicsState,
    activeCount: number,
    highDetail: boolean
  ) => {
    const s = agent.state;
    const p = agent.personality;

    s.justSplashed = false;
    s.splashIntensity = 0;
    if (s.landingCompression > 0 && s.phase !== 'airborne') {
      s.landingCompression *= Math.exp(-6.5 * dt);
      if (s.landingCompression < 0.01) s.landingCompression = 0;
    }
    agent.aiTimer += dt;
    if (agent.maneuverCooldown > 0) agent.maneuverCooldown = Math.max(0, agent.maneuverCooldown - dt);
    if (agent.abandonCooldown > 0) agent.abandonCooldown = Math.max(0, agent.abandonCooldown - dt);

    // Gentle mutual repulsion so surfers never overlap meshes
    let sepX = 0;
    let sepZ = 0;
    for (let j = 0; j < activeCount; j++) {
      const other = agents[j];
      if (other === agent) continue;
      const dx = s.position.x - other.state.position.x;
      const dz = s.position.z - other.state.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < 18 && dSq > 0.01) {
        const d = Math.sqrt(dSq);
        const f = (4.2 - d) * 2.5;
        sepX += (dx / d) * f;
        sepZ += (dz / d) * f;
      }
    }
    // Player personal safety bubble
    {
      const dx = s.position.x - playerState.position.x;
      const dz = s.position.z - playerState.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < 36 && dSq > 0.01) {
        const d = Math.sqrt(dSq);
        const f = (6.0 - d) * 4.5;
        sepX += (dx / d) * f;
        sepZ += (dz / d) * f;
      }
    }

    if (agent.aiState === 'WAITING') {
      s.phase = 'paddling';
      s.velocity.x = THREE.MathUtils.damp(s.velocity.x, sepX * 0.3, 4, dt);
      s.velocity.z = THREE.MathUtils.damp(s.velocity.z, sepZ * 0.3, 4, dt);
      s.position.x += s.velocity.x * dt;
      s.position.z += s.velocity.z * dt;
      // Face seaward waiting for sets, glancing lightly toward incoming swell
      const waitYaw = Math.PI + Math.sin(wp.simTime * 0.45 + agent.carvePhase) * 0.28;
      s.heading = lerpAngle(s.heading, waitYaw, 1 - Math.exp(-2.8 * dt));
      s.speed = Math.hypot(s.velocity.x, s.velocity.z);
      s.paddleStrokePhase += dt * 1.3;
      s.roll = THREE.MathUtils.damp(s.roll, 0, 5, dt);
      s.pitch = THREE.MathUtils.damp(s.pitch, 0, 5, dt);
      alignBoardToSurface(s, wp, highDetail, dt);
    } else if (agent.aiState === 'POSITIONING' || agent.aiState === 'RETURNING') {
      const dx = agent.targetX - s.position.x;
      const dz = agent.targetZ - s.position.z;
      const dist = Math.hypot(dx, dz);
      const desiredHeading = dist > 0.4 ? Math.atan2(dx, dz) : Math.PI;
      s.heading = lerpAngle(s.heading, desiredHeading, 1 - Math.exp(-5.0 * dt));

      const paddleSpeed = agent.aiState === 'RETURNING' ? 5.6 : 4.1;
      const targetVx = (dist > 0.4 ? (dx / dist) * paddleSpeed : 0) + sepX;
      const targetVz = (dist > 0.4 ? (dz / dist) * paddleSpeed : 0) + sepZ;
      s.velocity.x = THREE.MathUtils.damp(s.velocity.x, targetVx, 4.5, dt);
      s.velocity.z = THREE.MathUtils.damp(s.velocity.z, targetVz, 4.5, dt);
      s.position.x += s.velocity.x * dt;
      s.position.z += s.velocity.z * dt;
      s.speed = Math.hypot(s.velocity.x, s.velocity.z);
      s.paddleStrokePhase += dt * (2.6 + s.speed * 0.4);
      s.roll = THREE.MathUtils.damp(s.roll, 0, 6, dt);

      alignBoardToSurface(s, wp, highDetail, dt);

      // Duck-dive automatically if an incoming breaking wave sweeps over a returning NPC!
      const waveDz = s.position.z - wp.waveCenterZ;
      if (
        agent.aiState === 'RETURNING' &&
        s.phase !== 'duckDive' &&
        waveDz > 0.5 &&
        waveDz < 6.5 &&
        (_sampleCenter.section === 'whitewater' || _sampleCenter.section === 'lip' || _sampleCenter.slopeSteepness > 0.25) &&
        Math.cos(s.heading) < -0.2
      ) {
        s.phase = 'duckDive';
        s.duckDiveTimer = 0;
        s.justSplashed = true;
        s.splashIntensity = 0.5;
      }

      if (s.phase === 'duckDive') {
        s.duckDiveTimer += dt;
        const diveT = THREE.MathUtils.clamp(s.duckDiveTimer / 1.0, 0, 1);
        const depth = Math.sin(diveT * Math.PI) * 0.85;
        s.submersionDepth = depth;
        s.position.y = Math.max(
          getBeachHeightAt(s.position.x, s.position.z) + 0.08,
          _sampleCenter.height - depth
        );
        s.pitch = diveT < 0.45 ? 0.55 : -0.3;
        if (diveT >= 1.0) {
          s.phase = 'paddling';
          s.submersionDepth = 0;
          s.pitch = 0;
        }
      } else {
        s.phase = 'paddling';
        s.pitch = THREE.MathUtils.damp(s.pitch, 0, 6, dt);
      }
    } else if (agent.aiState === 'PADDLING') {
      s.phase = 'paddling';
      const targetLineX = wp.breakX + wp.breakDir * Math.min(p.preferredPeakOffset, 18);
      const steerX = THREE.MathUtils.clamp((targetLineX - s.position.x) * 0.08, -0.45, 0.45);
      const paddleYaw = steerX + wp.breakDir * 0.28;
      s.heading = lerpAngle(s.heading, paddleYaw, 1 - Math.exp(-6.5 * dt));

      const dz = s.position.z - wp.waveCenterZ;
      // Sprint harder as the swell lip closes in behind the surfer
      const sprintBoost = dz < 12 ? 1.15 : 0.92;
      const paddleDrive = (13.8 + p.aggression * 2.4) * sprintBoost;
      s.velocity.x += (Math.sin(s.heading) * paddleDrive + sepX * 0.4) * dt;
      s.velocity.z += (Math.cos(s.heading) * paddleDrive + sepZ * 0.4) * dt;
      s.velocity.multiplyScalar(Math.exp(-1.8 * dt));

      alignBoardToSurface(s, wp, highDetail, dt);

      if (dz > -2.0 && dz < 11.5) {
        const slopePush = 17.5 * _sampleCenter.slopeSteepness;
        s.velocity.z += slopePush * dt;
        s.velocity.x += wp.breakDir * slopePush * 0.45 * dt;
      }

      s.position.x += s.velocity.x * dt;
      s.position.z += s.velocity.z * dt;
      s.speed = Math.hypot(s.velocity.x, s.velocity.z);
      s.paddleStrokePhase += dt * (3.2 + s.speed * 0.42);
      s.roll = THREE.MathUtils.damp(s.roll, 0, 6, dt);
      s.pitch = THREE.MathUtils.damp(s.pitch, 0.06, 6, dt);

      const onFace = dz >= -0.8 && dz <= 10.2 && _sampleCenter.slopeSteepness > 0.11 && s.velocity.z > 0.4;
      if (onFace && s.speed >= 6.8) {
        s.catchProgress += dt * (4.6 + p.aggression * 1.6);
        if (s.catchProgress >= 1.0) {
          agent.aiState = 'CATCHING_WAVE';
          agent.aiTimer = 0;
          s.phase = 'takeoff';
          s.takeoffTimer = 0;
          s.velocity.z = Math.max(s.velocity.z, wp.waveSpeed * 0.94);
          s.velocity.x += wp.breakDir * 3.4;
          s.speed = Math.hypot(s.velocity.x, s.velocity.z);
          s.heading = Math.atan2(s.velocity.x, s.velocity.z);
          s.justSplashed = true;
          s.splashIntensity = 0.65;
          agent.rideDuration = 0;
          agent.maxRideDuration = 5.5 + p.consistency * 5.0 + Math.random() * 2.5;
        }
      } else {
        s.catchProgress = Math.max(0, s.catchProgress - dt * 0.5);
      }
    } else if (agent.aiState === 'CATCHING_WAVE') {
      s.phase = 'takeoff';
      s.takeoffTimer += dt;
      alignBoardToSurface(s, wp, highDetail, dt);

      s.velocity.z += 11.5 * Math.max(0.35, _sampleCenter.slopeSteepness) * dt;
      s.velocity.x += wp.breakDir * 4.5 * dt;
      s.position.x += s.velocity.x * dt;
      s.position.z += s.velocity.z * dt;
      s.speed = Math.hypot(s.velocity.x, s.velocity.z);
      s.heading = lerpAngle(s.heading, Math.atan2(s.velocity.x, s.velocity.z), 1 - Math.exp(-8 * dt));
      s.pitch = THREE.MathUtils.damp(s.pitch, 0.05, 8, dt);

      if (s.takeoffTimer >= 0.38) {
        // Beginners sometimes stumble on steep takeoffs
        const steepDropRisk =
          p.skill === 'Beginner' && _sampleCenter.curlHeight > 3.1 && Math.random() < 0.3;
        if (steepDropRisk) {
          triggerNpcWipeout(agent, 'forward', 0.78, wp.breakDir);
          return;
        }
        agent.aiState = 'RIDING';
        agent.aiTimer = 0;
        s.phase = 'riding';
      }
    } else if (agent.aiState === 'RIDING') {
      agent.rideDuration += dt;
      alignBoardToSurface(s, wp, highDetail, dt);

      // Dynamic carving trajectory down the peeling wave wall
      agent.carvePhase += dt * agent.carveFreq;
      const carveOsc = Math.sin(agent.carvePhase) * (0.34 + p.aggression * 0.25);

      // Desired Z stays comfortably in front pocket/mid-face of the moving wave
      const idealZ = wp.waveCenterZ + (s.inBarrel ? 2.6 : 3.4 + Math.sin(agent.carvePhase * 0.7) * 1.4);
      const zCorrection = THREE.MathUtils.clamp((idealZ - s.position.z) * 0.42, -0.5, 0.55);

      // Keep lateral line moving along breakDir without outrunning shoulder or falling into whitewater
      const relBreak = (s.position.x - wp.breakX) * wp.breakDir;
      let pocketBias = 0;
      if (relBreak < 3.5) pocketBias = 0.45; // Accelerate out of whitewater
      else if (relBreak > p.preferredPeakOffset + 10) pocketBias = -0.35; // Cut back slightly toward pocket

      const baseRideHeading = Math.atan2(
        wp.breakDir * (0.95 + pocketBias),
        0.58 + zCorrection + carveOsc * 0.35
      );
      s.heading = lerpAngle(s.heading, baseRideHeading, 1 - Math.exp(-5.8 * dt));

      const targetSpeed = THREE.MathUtils.clamp(
        wp.waveSpeed * (1.12 + p.aggression * 0.25) + _sampleCenter.slopeSteepness * 3.5,
        8.2,
        19.5
      );
      s.speed = THREE.MathUtils.damp(s.speed, targetSpeed, 4.5, dt);

      const dirX = Math.sin(s.heading);
      const dirZ = Math.cos(s.heading);
      s.velocity.x = THREE.MathUtils.damp(s.velocity.x, dirX * s.speed + sepX * 0.5, 8, dt);
      s.velocity.z = THREE.MathUtils.damp(
        s.velocity.z,
        dirZ * s.speed + wp.waveSpeed * 0.22 + sepZ * 0.5,
        8,
        dt
      );
      s.position.x += s.velocity.x * dt;
      s.position.z += s.velocity.z * dt;

      const targetRoll = THREE.MathUtils.clamp(carveOsc * 0.95, -0.68, 0.68);
      s.roll = THREE.MathUtils.damp(s.roll, targetRoll, 8, dt);
      s.pitch = THREE.MathUtils.damp(s.pitch, dirZ * 0.05, 8, dt);
      s.balance = THREE.MathUtils.damp(
        s.balance,
        carveOsc * (1.15 - p.consistency * 0.65),
        5,
        dt
      );
      s.carvingIntensity = THREE.MathUtils.clamp(
        Math.abs(carveOsc) * 1.45 * (s.speed / 12.0),
        0.15,
        1.15
      );

      // Barrel Riding detection for Intermediate / Advanced / Pro
      if (_sampleCenter.inBarrelZone && p.skill !== 'Beginner') {
        if (!s.inBarrel) {
          s.inBarrel = true;
          s.phase = 'barrel';
          s.barrelTimer = 0;
        }
        s.barrelTimer += dt;
        // High line inside tube
        s.roll = THREE.MathUtils.damp(s.roll, wp.breakDir * 0.22, 10, dt);
        if (_sampleCenter.section === 'whitewater' && s.barrelTimer > 0.35) {
          if (Math.random() < p.wipeoutProneness * 1.8) {
            triggerNpcWipeout(agent, 'barrelPinch', 0.92, -wp.breakDir);
            return;
          }
        }
      } else if (s.inBarrel) {
        s.inBarrel = false;
        s.phase = 'riding';
        s.justSplashed = true;
        s.splashIntensity = 0.72;
      }

      // Whitewater stumble check
      if (_sampleCenter.section === 'whitewater' && !s.inBarrel) {
        if (Math.random() < p.wipeoutProneness * dt * 1.55) {
          triggerNpcWipeout(agent, 'lipSlam', 0.82, wp.breakDir);
          return;
        }
      }
    } else if (agent.aiState === 'MANEUVERING') {
      agent.rideDuration += dt;
      s.maneuverTimer += dt;
      const mProgress = THREE.MathUtils.clamp(s.maneuverTimer / s.maneuverDuration, 0, 1);

      if (s.activeManeuver === 'air') {
        s.phase = 'airborne';
        s.verticalVel -= 14.8 * dt;
        s.airHeight += s.verticalVel * dt;

        // Pro surfers occasionally throw a clean 360 air spin
        if (p.skill === 'Pro') {
          s.maneuverSpin = mProgress * Math.PI * 2;
        } else {
          s.maneuverSpin = Math.sin(mProgress * Math.PI) * 0.75 * wp.breakDir;
        }

        s.position.x += s.velocity.x * dt;
        s.position.z += (s.velocity.z * 0.88 + wp.waveSpeed * 0.22) * dt;

        const surf = sampleSurfWave(s.position.x, s.position.z, wp, _normalA);
        s.position.y = surf.height + Math.max(0, s.airHeight);
        s.pitch = THREE.MathUtils.damp(s.pitch, THREE.MathUtils.clamp(-s.verticalVel * 0.05, -0.35, 0.35), 10, dt);

        if (s.airHeight <= 0 && s.verticalVel < 0) {
          s.airHeight = 0;
          s.verticalVel = 0;
          s.maneuverSpin = 0;
          s.justSplashed = true;
          s.splashIntensity = 0.82;

          // Landing check based on skill consistency
          if (Math.random() > p.consistency * 0.96 + 0.04) {
            triggerNpcWipeout(agent, 'sideways', 0.85, wp.breakDir);
            return;
          }
          s.activeManeuver = null;
          s.phase = 'riding';
          s.landingCompression = 0.72;
          agent.aiState = 'RIDING';
          agent.aiTimer = 0;
        }
      } else {
        s.phase = 'maneuver';
        alignBoardToSurface(s, wp, highDetail, dt);

        const whip = Math.sin(mProgress * Math.PI);
        if (s.activeManeuver === 'bottomTurn') {
          s.roll = THREE.MathUtils.damp(s.roll, -wp.breakDir * 0.72 * whip, 14, dt);
          s.heading += wp.breakDir * 0.9 * Math.cos(mProgress * Math.PI) * dt;
        } else if (s.activeManeuver === 'cutback') {
          s.roll = THREE.MathUtils.damp(s.roll, wp.breakDir * 0.78 * whip, 14, dt);
          s.heading -= wp.breakDir * 1.75 * Math.cos(mProgress * Math.PI) * dt;
        } else {
          // Floater riding high across lip (frame-rate independent surface lift)
          s.roll = THREE.MathUtils.damp(s.roll, -wp.breakDir * 0.35, 10, dt);
          s.position.y = THREE.MathUtils.damp(
            s.position.y,
            _sampleCenter.height + 0.06 + whip * 0.34,
            16,
            dt
          );
        }

        const dirX = Math.sin(s.heading);
        const dirZ = Math.cos(s.heading);
        s.velocity.x = THREE.MathUtils.damp(s.velocity.x, dirX * s.speed, 8, dt);
        s.velocity.z = THREE.MathUtils.damp(s.velocity.z, dirZ * s.speed + wp.waveSpeed * 0.2, 8, dt);
        s.position.x += s.velocity.x * dt;
        s.position.z += s.velocity.z * dt;
        s.carvingIntensity = 0.95;

        if (mProgress >= 1.0) {
          if (Math.random() > p.consistency + 0.14) {
            triggerNpcWipeout(agent, 'backward', 0.72, -wp.breakDir);
            return;
          }
          s.activeManeuver = null;
          s.phase = 'riding';
          agent.aiState = 'RIDING';
          agent.aiTimer = 0;
        }
      }
    } else if (agent.aiState === 'FALLING') {
      s.phase = 'wipeout';
      s.wipeoutTimer += dt;
      s.velocity.multiplyScalar(Math.exp(-3.5 * dt));
      s.position.x += s.velocity.x * dt;
      s.position.z += s.velocity.z * dt;

      const waterHere = sampleSurfWave(s.position.x, s.position.z, wp, _normalA);
      const beachY = getBeachHeightAt(s.position.x, s.position.z);
      const subDepth =
        s.wipeoutTimer < 0.35
          ? 0
          : s.wipeoutTimer < 1.25
            ? Math.sin(((s.wipeoutTimer - 0.35) / 0.9) * Math.PI) * 0.78
            : 0;
      s.submersionDepth = subDepth;
      s.position.y = THREE.MathUtils.damp(
        s.position.y,
        Math.max(beachY + 0.08, waterHere.height - subDepth),
        14,
        dt
      );

      // Update detached surfboard floating/tossed in whitewater
      s.boardVel.multiplyScalar(Math.exp(-2.2 * dt));
      s.boardPos.x += s.boardVel.x * dt;
      s.boardPos.z += s.boardVel.z * dt;
      const bWater = sampleSurfWave(s.boardPos.x, s.boardPos.z, wp, _normalB);
      s.boardPos.y = THREE.MathUtils.damp(s.boardPos.y, bWater.height + 0.035, 12, dt);
      s.boardHeading += 1.4 * dt * s.fallDir;
      s.boardRoll = Math.sin(wp.simTime * 5.0 + agent.carvePhase) * 0.35;
      s.boardPitch = Math.cos(wp.simTime * 4.2) * 0.2;

      if (s.wipeoutTimer >= 1.85) {
        agent.aiState = 'RECOVERING';
        agent.aiTimer = 0;
        s.phase = 'recovering';
        s.submersionDepth = 0;
        s.recoverTimer = 0;
      }
    } else if (agent.aiState === 'RECOVERING') {
      s.phase = 'recovering';
      s.recoverTimer += dt;

      // Board bobs gently on ocean surface
      const bWater = sampleSurfWave(s.boardPos.x, s.boardPos.z, wp, _normalB);
      s.boardPos.y = THREE.MathUtils.damp(
        s.boardPos.y,
        Math.max(getBeachHeightAt(s.boardPos.x, s.boardPos.z) + 0.04, bWater.height + 0.035),
        12,
        dt
      );
      s.boardRoll = THREE.MathUtils.damp(s.boardRoll, Math.sin(wp.simTime * 2.5) * 0.1, 6, dt);
      s.boardPitch = THREE.MathUtils.damp(s.boardPitch, Math.cos(wp.simTime * 2.0) * 0.06, 6, dt);

      const dx = s.boardPos.x - s.position.x;
      const dz = s.boardPos.z - s.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.15) {
        s.heading = lerpAngle(s.heading, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
        const swimSpd = 3.2;
        s.velocity.x = (dx / dist) * swimSpd;
        s.velocity.z = (dz / dist) * swimSpd;
        s.position.x += s.velocity.x * dt;
        s.position.z += s.velocity.z * dt;
      }
      s.speed = Math.hypot(s.velocity.x, s.velocity.z);
      s.paddleStrokePhase += dt * 6.5;

      const waterHere = sampleSurfWave(s.position.x, s.position.z, wp);
      s.position.y = THREE.MathUtils.damp(
        s.position.y,
        Math.max(getBeachHeightAt(s.position.x, s.position.z) + 0.06, waterHere.height - 0.06),
        14,
        dt
      );

      if (dist < 1.05 || s.recoverTimer > 4.2) {
        // Reclaim board & paddle back out to lineup
        s.boardDetached = false;
        s.phase = 'paddling';
        s.justSplashed = true;
        s.splashIntensity = 0.38;
        agent.aiState = 'RETURNING';
        agent.aiTimer = 0;
        agent.lastRideTimestamp = simClock;
        agent.targetX = p.homeX;
        agent.targetZ = p.homeZ;
      }
    }

    // Clamp NPCs safely inside the playable ocean expanse
    s.position.x = THREE.MathUtils.clamp(s.position.x, -145, 145);
    s.position.z = THREE.MathUtils.clamp(s.position.z, -140, 2);
  };

  const stepCutsceneFormation = (
    rawDt: number,
    simTime: number,
    waveParams: SurfWaveParams,
    stage: number,
    stageProgress: number
  ) => {
    if (!enabled) return;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    const activeCount = getActiveCount();
    const shoreSlotsX = activeCount === 1 ? [3.2] : [-5.8, 3.0, 7.6];

    for (let i = 0; i < activeCount; i++) {
      const a = agents[i];
      const s = a.state;
      const shoreX = shoreSlotsX[i] ?? 4 + i * 3.5;
      const shoreZ = 2.8 + (i % 2) * 0.65;

      let targetX = shoreX;
      let targetZ = shoreZ;
      if (stage === 5) {
        const smooth = THREE.MathUtils.clamp(stageProgress, 0, 1);
        const t = smooth * smooth * (3 - 2 * smooth);
        targetX = THREE.MathUtils.lerp(shoreX, a.personality.homeX, t);
        targetZ = THREE.MathUtils.lerp(shoreZ, a.personality.homeZ, t);
        s.paddleStrokePhase += dt * (6.4 + i * 0.4);
        s.speed = 4.0;
      } else if (stage >= 6) {
        targetX = a.personality.homeX;
        targetZ = a.personality.homeZ;
        s.paddleStrokePhase += dt * 1.4;
        s.speed = 0.5;
      } else {
        s.paddleStrokePhase += dt * 0.9;
        s.speed = 0;
      }

      s.position.x = THREE.MathUtils.damp(s.position.x, targetX, stage === 5 ? 8 : 6, dt);
      s.position.z = THREE.MathUtils.damp(s.position.z, targetZ, stage === 5 ? 8 : 6, dt);
      s.heading = lerpAngle(s.heading, Math.PI, 1 - Math.exp(-7 * dt));
      s.phase = 'paddling';
      s.boardDetached = false;
      alignBoardToSurface(s, waveParams, true, dt);
      a.rig.root.visible = true;
      a.rig.animate(s, simTime, dt);
    }
  };

  const update = (
    rawDt: number,
    simTime: number,
    waveParams: SurfWaveParams,
    playerState: SurferPhysicsState,
    cameraPos: THREE.Vector3,
    waterParticles?: WaterParticleSystem | null
  ) => {
    if (!enabled || rawDt <= 0) return;

    const dt = Math.min(rawDt, 0.05);
    const activeCount = getActiveCount();
    simClock += dt;

    // Periodic coordinator wave scan (~10Hz)
    waveScanTimer += dt;
    if (waveScanTimer >= 0.1) {
      waveScanTimer = 0;
      evaluateWavePriority(waveParams, playerState, activeCount);
    }

    // Also guard wave priority in real time if player drops into the pocket while an NPC is paddling
    if (claimedWaveOwnerId !== null && isPlayerUsingMainWave(playerState, waveParams)) {
      claimedWaveOwnerId = null;
    }

    for (let i = 0; i < activeCount; i++) {
      const agent = agents[i];
      const s = agent.state;

      // Distance from camera determines LOD tier
      const dx = s.position.x - cameraPos.x;
      const dz = s.position.z - cameraPos.z;
      const distSq = dx * dx + dz * dz;
      const highDetail = distSq < 65 * 65;
      const veryFar = distSq > 120 * 120;

      // Staggered AI state decision (~9Hz per NPC)
      agent.decisionTimer += dt;
      if (agent.decisionTimer >= 0.11) {
        agent.decisionTimer = 0;
        runAiDecision(agent, waveParams, playerState, activeCount);
      }

      stepAgentPhysics(agent, dt, waveParams, playerState, activeCount, highDetail);

      // LOD skeletal rig animation: skip every 2nd tick when very distant (>120m)
      agent.lodTickCounter++;
      if (!veryFar || (agent.lodTickCounter & 1) === 0) {
        agent.rig.animate(s, simTime, veryFar ? dt * 2 : dt);
      }

      // Emit carving spray & splashes into shared single-draw-call WaterParticleSystem for nearby NPCs
      if (waterParticles && distSq < 68 * 68) {
        const distFactor = THREE.MathUtils.clamp(1.0 - Math.sqrt(distSq) / 72, 0.25, 0.72);
        waterParticles.emitNpcSpray(dt, s, distFactor);
      }
    }

    // Keep shoaling query warm if needed elsewhere
    void getWaveShoaling;
  };

  const getAgentsSnapshot = () => agents.slice(0, getActiveCount());

  const dispose = () => {
    for (let i = 0; i < freeAgents.length; i++) {
      freeAgents[i].rig.dispose();
    }
    disposeCareerAgents();
  };

  return {
    group,
    setEnabled,
    setQualityPreset,
    configureCareerHeatOpponents,
    resetLineup,
    stepCutsceneFormation,
    update,
    getAgentsSnapshot,
    dispose,
  };
}
