import * as THREE from 'three';
import { ExecutionQuality, FallType, ManeuverType, SurfPhase } from '../types/game';
import { SurferPhysicsState, SurfWaveParams } from './wavePhysics';

export const MAX_REPLAY_SECONDS = 15.0;
const RING_CAPACITY = 768; // ~16.5s at 45Hz + splash bursts

export interface ReplayFrame {
  recordTime: number;
  elapsedTime: number;
  // Wave parameters
  simTime: number;
  waveCenterZ: number;
  waveHeight: number;
  waveSpeed: number;
  steepness: number;
  power: number;
  breakX: number;
  breakDir: number;
  barrelFactor: number;
  waveLengthZ: number;
  // Surfer & Board physics
  posX: number;
  posY: number;
  posZ: number;
  heading: number;
  roll: number;
  pitch: number;
  boardNormalX: number;
  boardNormalY: number;
  boardNormalZ: number;
  phase: SurfPhase;
  speed: number;
  balance: number;
  paddleStrokePhase: number;
  duckDiveTimer: number;
  walkPhase: number;
  activeManeuver: ManeuverType | null;
  maneuverTimer: number;
  maneuverDuration: number;
  maneuverSpin: number;
  airHeight: number;
  landingCompression: number;
  inBarrel: boolean;
  barrelTimer: number;
  fallType: FallType;
  fallDir: number;
  fallIntensity: number;
  wipeoutTimer: number;
  submersionDepth: number;
  underwaterAmount: number;
  boardDetached: boolean;
  boardPosX: number;
  boardPosY: number;
  boardPosZ: number;
  boardHeading: number;
  boardRoll: number;
  boardPitch: number;
  justSplashed: boolean;
  splashIntensity: number;
  carvingIntensity: number;
  score: number;
  combo: number;
  waveNumber: number;
  timeScale: number;
  lastCallout: string;
  lastQuality: ExecutionQuality | null;
  calloutId: number;
}

function createEmptyFrame(): ReplayFrame {
  return {
    recordTime: 0,
    elapsedTime: 0,
    simTime: 0,
    waveCenterZ: 0,
    waveHeight: 0,
    waveSpeed: 0,
    steepness: 0,
    power: 0,
    breakX: 0,
    breakDir: 1,
    barrelFactor: 0,
    waveLengthZ: 36,
    posX: 0,
    posY: 0,
    posZ: 0,
    heading: 0,
    roll: 0,
    pitch: 0,
    boardNormalX: 0,
    boardNormalY: 1,
    boardNormalZ: 0,
    phase: 'beachWalk',
    speed: 0,
    balance: 0,
    paddleStrokePhase: 0,
    duckDiveTimer: 0,
    walkPhase: 0,
    activeManeuver: null,
    maneuverTimer: 0,
    maneuverDuration: 1,
    maneuverSpin: 0,
    airHeight: 0,
    landingCompression: 0,
    inBarrel: false,
    barrelTimer: 0,
    fallType: 'sideways',
    fallDir: 1,
    fallIntensity: 0.5,
    wipeoutTimer: 0,
    submersionDepth: 0,
    underwaterAmount: 0,
    boardDetached: false,
    boardPosX: 0,
    boardPosY: 0,
    boardPosZ: 0,
    boardHeading: 0,
    boardRoll: 0,
    boardPitch: 0,
    justSplashed: false,
    splashIntensity: 0,
    carvingIntensity: 0,
    score: 0,
    combo: 1,
    waveNumber: 1,
    timeScale: 1,
    lastCallout: '',
    lastQuality: null,
    calloutId: 0,
  };
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * Zero-GC fixed circular ring buffer storing the last 15 seconds of surf telemetry.
 */
export class ReplayBuffer {
  private ring: ReplayFrame[];
  private head = 0; // Index of oldest valid frame
  private count = 0;
  private recordClock = 0;
  private lastSampledClock = -1;
  private lastSplashOffset = -1;

  constructor() {
    this.ring = new Array<ReplayFrame>(RING_CAPACITY);
    for (let i = 0; i < RING_CAPACITY; i++) {
      this.ring[i] = createEmptyFrame();
    }
  }

  private at(logicalIdx: number): ReplayFrame {
    return this.ring[(this.head + logicalIdx) % RING_CAPACITY];
  }

  public clear() {
    this.head = 0;
    this.count = 0;
    this.recordClock = 0;
    this.lastSampledClock = -1;
    this.lastSplashOffset = -1;
  }

  public getDuration(): number {
    if (this.count < 2) return 0;
    return Math.max(0, this.at(this.count - 1).recordTime - this.at(0).recordTime);
  }

  public hasClip(): boolean {
    return this.count >= 12 && this.getDuration() >= 0.75;
  }

  public resetPlaybackCursor() {
    this.lastSplashOffset = -1;
  }

  public record(
    rawDt: number,
    elapsedTime: number,
    state: SurferPhysicsState,
    wp: SurfWaveParams
  ) {
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.recordClock += dt;

    // Sample up to ~45 Hz for smooth slow-motion interpolation while preserving splash bursts
    const minInterval = state.justSplashed ? 0 : 0.022;
    if (this.lastSampledClock >= 0 && this.recordClock - this.lastSampledClock < minInterval) {
      return;
    }
    this.lastSampledClock = this.recordClock;

    let writeIdx: number;
    if (this.count < RING_CAPACITY) {
      writeIdx = (this.head + this.count) % RING_CAPACITY;
      this.count++;
    } else {
      writeIdx = this.head;
      this.head = (this.head + 1) % RING_CAPACITY;
    }

    const f = this.ring[writeIdx];
    f.recordTime = this.recordClock;
    f.elapsedTime = elapsedTime;
    f.simTime = wp.simTime;
    f.waveCenterZ = wp.waveCenterZ;
    f.waveHeight = wp.waveHeight;
    f.waveSpeed = wp.waveSpeed;
    f.steepness = wp.steepness;
    f.power = wp.power;
    f.breakX = wp.breakX;
    f.breakDir = wp.breakDir;
    f.barrelFactor = wp.barrelFactor;
    f.waveLengthZ = wp.waveLengthZ;
    f.posX = state.position.x;
    f.posY = state.position.y;
    f.posZ = state.position.z;
    f.heading = state.heading;
    f.roll = state.roll;
    f.pitch = state.pitch;
    f.boardNormalX = state.boardNormal.x;
    f.boardNormalY = state.boardNormal.y;
    f.boardNormalZ = state.boardNormal.z;
    f.phase = state.phase;
    f.speed = state.speed;
    f.balance = state.balance;
    f.paddleStrokePhase = state.paddleStrokePhase;
    f.duckDiveTimer = state.duckDiveTimer;
    f.walkPhase = state.walkPhase;
    f.activeManeuver = state.activeManeuver;
    f.maneuverTimer = state.maneuverTimer;
    f.maneuverDuration = state.maneuverDuration;
    f.maneuverSpin = state.maneuverSpin;
    f.airHeight = state.airHeight;
    f.landingCompression = state.landingCompression;
    f.inBarrel = state.inBarrel;
    f.barrelTimer = state.barrelTimer;
    f.fallType = state.fallType;
    f.fallDir = state.fallDir;
    f.fallIntensity = state.fallIntensity;
    f.wipeoutTimer = state.wipeoutTimer;
    f.submersionDepth = state.submersionDepth;
    f.underwaterAmount = state.underwaterAmount;
    f.boardDetached = state.boardDetached;
    f.boardPosX = state.boardPos.x;
    f.boardPosY = state.boardPos.y;
    f.boardPosZ = state.boardPos.z;
    f.boardHeading = state.boardHeading;
    f.boardRoll = state.boardRoll;
    f.boardPitch = state.boardPitch;
    f.justSplashed = state.justSplashed;
    f.splashIntensity = state.splashIntensity;
    f.carvingIntensity = state.carvingIntensity;
    f.score = state.score;
    f.combo = state.combo;
    f.waveNumber = state.waveNumber;
    f.timeScale = state.timeScale;
    f.lastCallout = state.lastCallout;
    f.lastQuality = state.lastQuality;
    f.calloutId = state.calloutId;

    // Advance head pointer past frames older than MAX_REPLAY_SECONDS (O(1) per dropped frame, zero GC)
    const cutoff = this.recordClock - (MAX_REPLAY_SECONDS + 0.15);
    while (this.count > 2 && this.at(1).recordTime < cutoff) {
      this.head = (this.head + 1) % RING_CAPACITY;
      this.count--;
    }
  }

  /**
   * Computes a steady shoreline telephoto camera anchor that frames the whole captured ride.
   */
  public computeBeachAnchor(out: THREE.Vector3) {
    if (this.count === 0) {
      out.set(4, 3.6, 17);
      return;
    }
    let sumX = 0;
    let maxZ = -999;
    let maxH = 2.0;
    for (let i = 0; i < this.count; i++) {
      const f = this.at(i);
      sumX += f.posX;
      if (f.posZ > maxZ) maxZ = f.posZ;
      if (f.waveHeight > maxH) maxH = f.waveHeight;
    }
    const avgX = sumX / this.count;
    const last = this.at(this.count - 1);
    const camZ = THREE.MathUtils.clamp(Math.max(14.5, maxZ + 12.0), 14.5, 30.0);
    const camX = avgX + last.breakDir * 6.5;
    out.set(camX, 2.85 + maxH * 0.45, camZ);
  }

  /**
   * Samples an interpolated physics & wave snapshot at `replayTime` in [0, duration].
   */
  public sampleAt(
    replayTime: number,
    isPlayingForward: boolean,
    outState: SurferPhysicsState,
    outWave: SurfWaveParams
  ): { elapsedTime: number } {
    if (this.count === 0) {
      return { elapsedTime: 0 };
    }

    const first = this.at(0);
    const last = this.at(this.count - 1);
    const targetClock = THREE.MathUtils.clamp(
      first.recordTime + replayTime,
      first.recordTime,
      last.recordTime
    );

    // Binary search for bracketing frame index
    let lo = 0;
    let hi = this.count - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.at(mid).recordTime <= targetClock) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const a = this.at(lo);
    const b = this.at(Math.min(lo + 1, this.count - 1));
    const span = Math.max(0.0001, b.recordTime - a.recordTime);
    const t = a === b ? 0 : THREE.MathUtils.clamp((targetClock - a.recordTime) / span, 0, 1);

    const sameWave = a.waveNumber === b.waveNumber && Math.abs(b.waveCenterZ - a.waveCenterZ) < 12;
    const ref = t < 0.5 ? a : b;

    outWave.enabled = true;
    outWave.simTime = sameWave ? THREE.MathUtils.lerp(a.simTime, b.simTime, t) : ref.simTime;
    outWave.waveCenterZ = sameWave
      ? THREE.MathUtils.lerp(a.waveCenterZ, b.waveCenterZ, t)
      : ref.waveCenterZ;
    outWave.waveHeight = sameWave
      ? THREE.MathUtils.lerp(a.waveHeight, b.waveHeight, t)
      : ref.waveHeight;
    outWave.waveSpeed = sameWave
      ? THREE.MathUtils.lerp(a.waveSpeed, b.waveSpeed, t)
      : ref.waveSpeed;
    outWave.steepness = sameWave
      ? THREE.MathUtils.lerp(a.steepness, b.steepness, t)
      : ref.steepness;
    outWave.power = sameWave ? THREE.MathUtils.lerp(a.power, b.power, t) : ref.power;
    outWave.breakX = sameWave ? THREE.MathUtils.lerp(a.breakX, b.breakX, t) : ref.breakX;
    outWave.breakDir = ref.breakDir;
    outWave.barrelFactor = sameWave
      ? THREE.MathUtils.lerp(a.barrelFactor, b.barrelFactor, t)
      : ref.barrelFactor;
    outWave.waveLengthZ = sameWave
      ? THREE.MathUtils.lerp(a.waveLengthZ, b.waveLengthZ, t)
      : ref.waveLengthZ;

    const blend = sameWave && Math.abs(b.posZ - a.posZ) < 6;
    const lerpNum = (va: number, vb: number) =>
      blend ? THREE.MathUtils.lerp(va, vb, t) : t < 0.5 ? va : vb;

    outState.position.set(
      lerpNum(a.posX, b.posX),
      lerpNum(a.posY, b.posY),
      lerpNum(a.posZ, b.posZ)
    );
    outState.heading = blend ? lerpAngle(a.heading, b.heading, t) : ref.heading;
    outState.roll = lerpNum(a.roll, b.roll);
    outState.pitch = lerpNum(a.pitch, b.pitch);
    outState.boardNormal
      .set(
        lerpNum(a.boardNormalX, b.boardNormalX),
        lerpNum(a.boardNormalY, b.boardNormalY),
        lerpNum(a.boardNormalZ, b.boardNormalZ)
      )
      .normalize();

    outState.phase = ref.phase;
    outState.speed = lerpNum(a.speed, b.speed);
    outState.balance = lerpNum(a.balance, b.balance);
    outState.paddleStrokePhase = lerpNum(a.paddleStrokePhase, b.paddleStrokePhase);
    outState.duckDiveTimer = lerpNum(a.duckDiveTimer, b.duckDiveTimer);
    outState.walkPhase = lerpNum(a.walkPhase, b.walkPhase);
    outState.activeManeuver = ref.activeManeuver;
    outState.maneuverTimer = lerpNum(a.maneuverTimer, b.maneuverTimer);
    outState.maneuverDuration = ref.maneuverDuration;
    outState.maneuverSpin = blend ? lerpAngle(a.maneuverSpin, b.maneuverSpin, t) : ref.maneuverSpin;
    outState.airHeight = lerpNum(a.airHeight, b.airHeight);
    outState.landingCompression = lerpNum(a.landingCompression, b.landingCompression);
    outState.inBarrel = ref.inBarrel;
    outState.barrelTimer = lerpNum(a.barrelTimer, b.barrelTimer);
    outState.fallType = ref.fallType;
    outState.fallDir = ref.fallDir;
    outState.fallIntensity = ref.fallIntensity;
    outState.wipeoutTimer = lerpNum(a.wipeoutTimer, b.wipeoutTimer);
    outState.submersionDepth = lerpNum(a.submersionDepth, b.submersionDepth);
    outState.underwaterAmount = lerpNum(a.underwaterAmount, b.underwaterAmount);

    outState.boardDetached = ref.boardDetached;
    outState.boardPos.set(
      lerpNum(a.boardPosX, b.boardPosX),
      lerpNum(a.boardPosY, b.boardPosY),
      lerpNum(a.boardPosZ, b.boardPosZ)
    );
    outState.boardHeading = blend ? lerpAngle(a.boardHeading, b.boardHeading, t) : ref.boardHeading;
    outState.boardRoll = lerpNum(a.boardRoll, b.boardRoll);
    outState.boardPitch = lerpNum(a.boardPitch, b.boardPitch);

    outState.carvingIntensity = lerpNum(a.carvingIntensity, b.carvingIntensity);
    outState.score = ref.score;
    outState.combo = ref.combo;
    outState.waveNumber = ref.waveNumber;
    outState.timeScale = ref.timeScale;
    outState.lastCallout = ref.lastCallout;
    outState.lastQuality = ref.lastQuality;
    outState.calloutId = ref.calloutId;

    outState.justSplashed = false;
    outState.splashIntensity = 0;
    if (isPlayingForward && lo !== this.lastSplashOffset) {
      const startCheck = Math.max(0, this.lastSplashOffset + 1);
      for (let idx = startCheck; idx <= lo; idx++) {
        const frame = this.at(idx);
        if (frame.justSplashed) {
          outState.justSplashed = true;
          outState.splashIntensity = Math.max(outState.splashIntensity, frame.splashIntensity);
        }
      }
      this.lastSplashOffset = lo;
    } else if (!isPlayingForward) {
      this.lastSplashOffset = lo;
    }

    return {
      elapsedTime: THREE.MathUtils.lerp(a.elapsedTime, b.elapsedTime, t),
    };
  }
}
