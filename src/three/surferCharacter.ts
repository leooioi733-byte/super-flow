import * as THREE from 'three';
import { InterviewTone, VictoryCutsceneKind } from '../types/career';
import { SurfboardSpec, SurferProfile } from '../types/game';
import { createSurfboardGroup } from './coastalEnvironment';
import { SurferPhysicsState } from './wavePhysics';

export interface SurferRig {
  root: THREE.Group;
  characterGroup: THREE.Group;
  boardContainer: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  updateBoard: (spec: SurfboardSpec) => void;
  updateProfile: (profile: SurferProfile) => void;
  setFirstPersonMode: (enabled: boolean) => void;
  getFirstPersonPose: (
    state: SurferPhysicsState,
    lookYawOffset: number,
    lookPitchOffset: number,
    outEyePos: THREE.Vector3,
    outQuat: THREE.Quaternion
  ) => void;
  animate: (state: SurferPhysicsState, time: number, dt: number) => void;
  animateVictory: (
    kind: VictoryCutsceneKind,
    stage: number,
    stageProgress: number,
    time: number,
    dt: number,
    worldPos: THREE.Vector3,
    waveNormal: THREE.Vector3,
    heading: number,
    boardAnchorWorld?: THREE.Vector3
  ) => void;
  animateInterview: (
    phase: 'question' | 'reaction',
    tone: InterviewTone | undefined,
    time: number,
    dt: number,
    worldPos: THREE.Vector3,
    heading: number,
    boardAnchorWorld?: THREE.Vector3
  ) => void;
  dispose: () => void;
}

const _up = new THREE.Vector3(0, 1, 0);
const _alignQuat = new THREE.Quaternion();
const _yawQuat = new THREE.Quaternion();
const _rollQuat = new THREE.Quaternion();
const _pitchQuat = new THREE.Quaternion();
const _spinQuat = new THREE.Quaternion();
const _bankQuat = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _xAxis = new THREE.Vector3(1, 0, 0);
const _fpTarget = new THREE.Vector3();
const _fpFwd = new THREE.Vector3();
const _fpUpVec = new THREE.Vector3();
const _fpLookMat = new THREE.Matrix4();

/**
 * Hierarchical articulated 3D surfer character standing/paddling on the active surfboard,
 * with independent detached-board transforms during wipeout & swim recovery and an accurate
 * head/eye anchor for seamless first-person surfing.
 */
export interface SurferRigOptions {
  castShadows?: boolean;
  shareStaticGeometries?: boolean;
}

interface SharedRigGeometries {
  pelvis: THREE.BufferGeometry;
  chest: THREE.BufferGeometry;
  chestBand: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
  skull: THREE.BufferGeometry;
  hair: THREE.BufferGeometry;
  upperArm: THREE.BufferGeometry;
  forearm: THREE.BufferGeometry;
  hand: THREE.BufferGeometry;
  thigh: THREE.BufferGeometry;
  shin: THREE.BufferGeometry;
  foot: THREE.BufferGeometry;
}

let cachedSharedGeos: SharedRigGeometries | null = null;

function getSharedRigGeometries(): SharedRigGeometries {
  if (!cachedSharedGeos) {
    cachedSharedGeos = {
      pelvis: new THREE.CapsuleGeometry(0.115, 0.1, 5, 10),
      chest: new THREE.CapsuleGeometry(0.145, 0.28, 6, 12),
      chestBand: new THREE.CylinderGeometry(0.152, 0.142, 0.11, 12),
      neck: new THREE.CylinderGeometry(0.048, 0.055, 0.1, 8),
      skull: new THREE.SphereGeometry(0.105, 12, 10),
      hair: new THREE.SphereGeometry(0.11, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
      upperArm: new THREE.CapsuleGeometry(0.045, 0.22, 5, 8),
      forearm: new THREE.CapsuleGeometry(0.038, 0.21, 5, 8),
      hand: new THREE.SphereGeometry(0.042, 7, 7),
      thigh: new THREE.CapsuleGeometry(0.068, 0.3, 5, 10),
      shin: new THREE.CapsuleGeometry(0.05, 0.32, 5, 10),
      foot: new THREE.BoxGeometry(0.085, 0.05, 0.21),
    };
  }
  return cachedSharedGeos;
}

export function createSurferRig(
  initialBoard: SurfboardSpec,
  initialProfile: SurferProfile,
  options?: SurferRigOptions
): SurferRig {
  const castShadows = options?.castShadows ?? true;
  const shareGeos = options?.shareStaticGeometries ?? false;
  const shared = shareGeos ? getSharedRigGeometries() : null;
  const root = new THREE.Group();

  // Surfboard container is a sibling of characterGroup so the board can separate
  // and react independently to the ocean surface after a wipeout.
  const boardContainer = new THREE.Group();
  root.add(boardContainer);

  let boardMesh = createSurfboardGroup(initialBoard, {
    castShadows,
    lightweightMaterial: shareGeos,
  });
  boardContainer.add(boardMesh);

  const characterGroup = new THREE.Group();
  root.add(characterGroup);

  const suitMat = new THREE.MeshStandardMaterial({
    color: initialProfile.suitColor,
    roughness: 0.72,
    metalness: 0.05,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: initialProfile.accentColor,
    roughness: 0.55,
    metalness: 0.08,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: initialProfile.skinTone ?? '#c98e6b',
    roughness: 0.62,
    metalness: 0.0,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: initialProfile.hairColor ?? '#1e1916',
    roughness: 0.88,
    metalness: 0.0,
  });

  // Character rig mounted inside characterGroup
  const hips = new THREE.Group();
  hips.position.set(0, 0.92, -0.05);
  characterGroup.add(hips);

  // Pelvis
  const pelvisMesh = new THREE.Mesh(
    shared ? shared.pelvis : new THREE.CapsuleGeometry(0.115, 0.1, 6, 12),
    suitMat
  );
  pelvisMesh.rotation.z = Math.PI / 2;
  pelvisMesh.castShadow = castShadows;
  pelvisMesh.userData.sharedGeo = Boolean(shared);
  hips.add(pelvisMesh);

  // Torso
  const torso = new THREE.Group();
  torso.position.set(0, 0.08, 0);
  hips.add(torso);

  const chestMesh = new THREE.Mesh(
    shared ? shared.chest : new THREE.CapsuleGeometry(0.145, 0.28, 8, 14),
    suitMat
  );
  chestMesh.position.set(0, 0.22, 0);
  chestMesh.scale.set(1.15, 1.0, 0.78);
  chestMesh.castShadow = castShadows;
  chestMesh.userData.sharedGeo = Boolean(shared);
  torso.add(chestMesh);

  // Wetsuit chest stripe accent
  const chestBand = new THREE.Mesh(
    shared ? shared.chestBand : new THREE.CylinderGeometry(0.152, 0.142, 0.11, 14),
    accentMat
  );
  chestBand.position.set(0, 0.29, 0);
  chestBand.scale.set(1.12, 1.0, 0.78);
  chestBand.userData.sharedGeo = Boolean(shared);
  torso.add(chestBand);

  // Head & Neck
  const head = new THREE.Group();
  head.position.set(0, 0.45, 0);
  torso.add(head);

  const neckMesh = new THREE.Mesh(
    shared ? shared.neck : new THREE.CylinderGeometry(0.048, 0.055, 0.1, 10),
    skinMat
  );
  neckMesh.position.y = 0.04;
  neckMesh.userData.sharedGeo = Boolean(shared);
  head.add(neckMesh);

  const skullMesh = new THREE.Mesh(
    shared ? shared.skull : new THREE.SphereGeometry(0.105, 16, 14),
    skinMat
  );
  skullMesh.position.y = 0.16;
  skullMesh.scale.set(0.92, 1.08, 0.98);
  skullMesh.castShadow = castShadows;
  skullMesh.userData.sharedGeo = Boolean(shared);
  head.add(skullMesh);

  const hairMesh = new THREE.Mesh(
    shared
      ? shared.hair
      : new THREE.SphereGeometry(0.11, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hairMesh.position.set(0, 0.17, -0.01);
  hairMesh.rotation.x = -0.18;
  hairMesh.userData.sharedGeo = Boolean(shared);
  head.add(hairMesh);

  // Exact eye-bridge anchor inside head coordinate frame for clip-free 1P camera
  const eyeAnchor = new THREE.Object3D();
  eyeAnchor.position.set(0, 0.21, 0.085);
  head.add(eyeAnchor);

  // Helper for articulated arms
  function buildArm(side: number) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.2, 0.36, 0);
    torso.add(shoulder);

    const upperArm = new THREE.Mesh(
      shared ? shared.upperArm : new THREE.CapsuleGeometry(0.045, 0.22, 6, 10),
      suitMat
    );
    upperArm.position.y = -0.13;
    upperArm.castShadow = castShadows;
    upperArm.userData.sharedGeo = Boolean(shared);
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.26, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(
      shared ? shared.forearm : new THREE.CapsuleGeometry(0.038, 0.21, 6, 10),
      skinMat
    );
    forearm.position.y = -0.12;
    forearm.castShadow = castShadows;
    forearm.userData.sharedGeo = Boolean(shared);
    elbow.add(forearm);

    const hand = new THREE.Mesh(
      shared ? shared.hand : new THREE.SphereGeometry(0.042, 8, 8),
      skinMat
    );
    hand.position.y = -0.25;
    hand.scale.set(0.85, 1.25, 0.65);
    hand.userData.sharedGeo = Boolean(shared);
    elbow.add(hand);

    return { shoulder, elbow };
  }

  const { shoulder: leftShoulder, elbow: leftElbow } = buildArm(-1);
  const { shoulder: rightShoulder, elbow: rightElbow } = buildArm(1);

  // Helper for articulated legs
  function buildLeg(side: number) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.095, -0.04, 0);
    hips.add(hip);

    const thigh = new THREE.Mesh(
      shared ? shared.thigh : new THREE.CapsuleGeometry(0.068, 0.3, 6, 12),
      suitMat
    );
    thigh.position.y = -0.18;
    thigh.castShadow = castShadows;
    thigh.userData.sharedGeo = Boolean(shared);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.37, 0);
    hip.add(knee);

    const shin = new THREE.Mesh(
      shared ? shared.shin : new THREE.CapsuleGeometry(0.05, 0.32, 6, 12),
      suitMat
    );
    shin.position.y = -0.19;
    shin.castShadow = castShadows;
    shin.userData.sharedGeo = Boolean(shared);
    knee.add(shin);

    const foot = new THREE.Mesh(
      shared ? shared.foot : new THREE.BoxGeometry(0.085, 0.05, 0.21),
      skinMat
    );
    foot.position.set(0, -0.4, 0.05);
    foot.userData.sharedGeo = Boolean(shared);
    knee.add(foot);

    return { hip, knee };
  }

  const { hip: leftHip, knee: leftKnee } = buildLeg(-1);
  const { hip: rightHip, knee: rightKnee } = buildLeg(1);

  let isGoofy = initialProfile.stance === 'Goofy';
  let currentBoardId = initialBoard.id;
  let lastProfileKey = `${initialProfile.suitColor}|${initialProfile.accentColor}|${initialProfile.skinTone ?? ''}|${initialProfile.hairColor ?? ''}|${initialProfile.stance}`;

  const updateBoard = (spec: SurfboardSpec) => {
    if (spec.id === currentBoardId) return;
    boardContainer.remove(boardMesh);
    boardMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
    boardMesh = createSurfboardGroup(spec, {
      castShadows,
      lightweightMaterial: shareGeos,
    });
    boardContainer.add(boardMesh);
    currentBoardId = spec.id;
  };

  const updateProfile = (profile: SurferProfile) => {
    const nextKey = `${profile.suitColor}|${profile.accentColor}|${profile.skinTone ?? ''}|${profile.hairColor ?? ''}|${profile.stance}`;
    if (nextKey === lastProfileKey) return;
    lastProfileKey = nextKey;
    suitMat.color.set(profile.suitColor);
    accentMat.color.set(profile.accentColor);
    skinMat.color.set(profile.skinTone ?? '#c98e6b');
    hairMat.color.set(profile.hairColor ?? '#1e1916');
    isGoofy = profile.stance === 'Goofy';
  };

  const setFirstPersonMode = (enabled: boolean) => {
    const bodyVisible = !enabled;
    neckMesh.visible = bodyVisible;
    skullMesh.visible = bodyVisible;
    hairMesh.visible = bodyVisible;
    chestMesh.visible = bodyVisible;
    chestBand.visible = bodyVisible;
  };

  const getFirstPersonPose = (
    state: SurferPhysicsState,
    lookYawOffset: number,
    lookPitchOffset: number,
    outEyePos: THREE.Vector3,
    outQuat: THREE.Quaternion
  ) => {
    root.updateMatrixWorld(true);
    eyeAnchor.getWorldPosition(outEyePos);

    if (state.phase === 'paddling' || state.phase === 'duckDive' || state.phase === 'recovering') {
      outEyePos.y += 0.07;
    }

    const fwdX = Math.sin(state.heading);
    const fwdZ = Math.cos(state.heading);

    if (state.phase === 'wipeout') {
      const wt = state.wipeoutTimer;
      const intensity = state.fallIntensity;
      const tumbleWave = Math.sin(wt * 6.5) * 0.45 * intensity;
      const basePitch =
        wt < 1.38
          ? -0.28 + Math.cos(wt * 5.2) * 0.35 * intensity
          : THREE.MathUtils.lerp(-0.24, -0.08, THREE.MathUtils.clamp((wt - 1.38) / 0.65, 0, 1));
      const yaw = state.heading + tumbleWave * 0.45 + lookYawOffset;
      const pitch = THREE.MathUtils.clamp(basePitch + lookPitchOffset, -0.95, 0.95);
      const cosP = Math.cos(pitch);

      _fpFwd
        .set(Math.sin(yaw) * cosP, Math.sin(pitch), Math.cos(yaw) * cosP)
        .normalize();
      _fpUpVec
        .set(Math.sin(tumbleWave) * 0.42 * state.fallDir, 1.0, Math.cos(wt * 4.8) * 0.18)
        .normalize();
      _fpTarget.copy(outEyePos).add(_fpFwd);
      _fpLookMat.lookAt(outEyePos, _fpTarget, _fpUpVec);
      outQuat.setFromRotationMatrix(_fpLookMat);
      return;
    }

    // Standard surfing / walking / paddling / recovering 1P pose + full free-look offset
    let baseYaw = state.heading;
    if (state.phase === 'recovering' && Math.abs(lookYawOffset) < 0.05) {
      const dx = state.boardPos.x - outEyePos.x;
      const dz = state.boardPos.z - outEyePos.z;
      if (Math.hypot(dx, dz) > 0.45) {
        baseYaw = Math.atan2(dx, dz);
      }
    } else if (state.phase === 'riding' || state.phase === 'maneuver' || state.phase === 'barrel') {
      baseYaw = state.heading - state.roll * 0.22;
    }

    const baseDownPitch =
      state.phase === 'beachWalk'
        ? -0.07
        : state.phase === 'duckDive'
          ? -0.18
          : state.phase === 'paddling' || state.phase === 'recovering'
            ? -0.10
            : state.phase === 'barrel'
              ? -0.09
              : state.phase === 'airborne'
                ? -0.18
                : -0.14;

    const viewYaw = baseYaw + lookYawOffset;
    const viewPitch = THREE.MathUtils.clamp(
      baseDownPitch - THREE.MathUtils.clamp(state.pitch * 0.55, -0.22, 0.22) + lookPitchOffset,
      -0.88,
      0.92
    );

    const cosP = Math.cos(viewPitch);
    _fpFwd
      .set(Math.sin(viewYaw) * cosP, Math.sin(viewPitch), Math.cos(viewYaw) * cosP)
      .normalize();

    const bankScale = Math.cos(THREE.MathUtils.clamp(lookYawOffset, -Math.PI * 0.5, Math.PI * 0.5));
    const bankAmount =
      state.phase === 'riding' || state.phase === 'maneuver' || state.phase === 'barrel'
        ? -state.roll * 0.28 * bankScale
        : state.phase === 'airborne'
          ? -state.roll * 0.18 * bankScale
          : 0;
    _fpUpVec.copy(_up).applyQuaternion(_bankQuat.setFromAxisAngle(_fpFwd, bankAmount));

    void fwdX;
    void fwdZ;
    _fpTarget.copy(outEyePos).add(_fpFwd);
    _fpLookMat.lookAt(outEyePos, _fpTarget, _fpUpVec);
    outQuat.setFromRotationMatrix(_fpLookMat);
  };

  const damp = THREE.MathUtils.damp;

  const animate = (state: SurferPhysicsState, time: number, dt: number) => {
    // 1. Position and orient character & surfboard independently when separated
    characterGroup.position.copy(state.position);

    if (state.boardDetached) {
      // Independent surfboard reacts directly to wave swells & curl
      boardContainer.position.copy(state.boardPos);
      _alignQuat.setFromUnitVectors(_up, state.boardNormal);
      _yawQuat.setFromAxisAngle(_yAxis, state.boardHeading);
      _rollQuat.setFromAxisAngle(_zAxis, state.boardRoll);
      _pitchQuat.setFromAxisAngle(_xAxis, state.boardPitch);
      boardContainer.quaternion
        .copy(_alignQuat)
        .multiply(_yawQuat)
        .multiply(_rollQuat)
        .multiply(_pitchQuat);

      // Character swims/tumbles independently by heading
      _yawQuat.setFromAxisAngle(_yAxis, state.heading);
      characterGroup.quaternion.copy(_yawQuat);
    } else {
      boardContainer.position.copy(state.position);
      _alignQuat.setFromUnitVectors(_up, state.boardNormal);
      _yawQuat.setFromAxisAngle(_yAxis, state.heading);
      _rollQuat.setFromAxisAngle(_zAxis, state.roll);
      _pitchQuat.setFromAxisAngle(_xAxis, state.pitch);
      _spinQuat.setFromAxisAngle(_yAxis, state.maneuverSpin);

      boardContainer.quaternion
        .copy(_alignQuat)
        .multiply(_yawQuat)
        .multiply(_spinQuat)
        .multiply(_rollQuat)
        .multiply(_pitchQuat);

      characterGroup.quaternion.copy(boardContainer.quaternion);
    }

    // 2. Procedural body posture per surfing phase (connected to board weight, velocity & landing absorption)
    const stanceSign = isGoofy ? -1 : 1;
    const speedFactor = THREE.MathUtils.clamp(state.speed / 16, 0, 1.15);
    const carveLean = THREE.MathUtils.clamp(state.roll, -0.88, 0.88);
    const bal = THREE.MathUtils.clamp(state.balance, -1.2, 1.2);
    const landComp = THREE.MathUtils.clamp(state.landingCompression ?? 0, 0, 1);
    const manIntensity = THREE.MathUtils.clamp(
      state.carvingIntensity * 0.65 + speedFactor * 0.45,
      0.35,
      1.3
    );

    let hipsY = 0.82;
    let hipsZ = -0.05;
    let hipsRotX = 0.04;
    let hipsRotY = stanceSign * 1.15;
    let hipsRotZ = 0;
    let torsoRotX = 0.24;
    let torsoRotY = 0;
    let torsoRotZ = 0;
    let headRotY = -hipsRotY * 0.82;
    let headRotX = -0.12;

    let lHipX = -0.45;
    let lKneeX = 0.85;
    let rHipX = -0.55;
    let rKneeX = 0.92;

    let lShX = -0.42;
    let lShZ = -0.55;
    let lElbX = -0.55;
    let rShX = -0.38;
    let rShZ = 0.65;
    let rElbX = -0.48;

    let boardOffsetX = 0;
    let boardOffsetY = 0;
    let boardOffsetZ = 0;
    let boardRotX = 0;
    let boardRotY = 0;
    let boardRotZ = 0;

    if (state.phase === 'beachWalk') {
      // Standing/walking on the beach carrying the surfboard tucked under the right arm
      const walkBlend = THREE.MathUtils.clamp(state.speed / 2.2, 0, 1);
      const stride = Math.sin(state.walkPhase) * walkBlend;
      const strideOpp = Math.sin(state.walkPhase + Math.PI) * walkBlend;

      hipsY = 0.87 + Math.abs(Math.sin(state.walkPhase)) * 0.032 * walkBlend;
      hipsZ = 0;
      hipsRotX = 0.04 * walkBlend;
      hipsRotY = 0;
      torsoRotX = 0.06 * walkBlend;
      torsoRotY = -stride * 0.08;
      torsoRotZ = stride * 0.03;
      headRotY = 0;
      headRotX = -0.04;

      // Alternating walking leg stride
      lHipX = stride * 0.52;
      lKneeX = Math.max(0.08, -stride * 0.45 + 0.22 * walkBlend);
      rHipX = strideOpp * 0.52;
      rKneeX = Math.max(0.08, -strideOpp * 0.45 + 0.22 * walkBlend);

      // Left arm swings naturally while right arm cradles the surfboard at the hip
      lShX = strideOpp * 0.48 - 0.08;
      lShZ = -0.22;
      lElbX = -0.28 - Math.max(0, strideOpp) * 0.25;

      rShX = -0.24;
      rShZ = 0.40;
      rElbX = -1.24;

      // Surfboard tucked edge-on under the surfer's right arm (slightly clear for 1P view)
      boardOffsetX = 0.34;
      boardOffsetY = 0.86 + Math.abs(Math.sin(state.walkPhase)) * 0.025 * walkBlend;
      boardOffsetZ = 0.08;
      boardRotX = 0.14;
      boardRotY = 0.05;
      boardRotZ = -1.34;
    } else if (state.phase === 'paddling') {
      // Prone on the board paddling with alternating crawl strokes
      hipsY = 0.14;
      hipsZ = -0.18;
      hipsRotX = 1.48;
      hipsRotY = 0;
      torsoRotX = -0.28; // chest arched up looking forward
      headRotY = 0;
      headRotX = -0.55;

      lHipX = 0.08;
      lKneeX = 0.12;
      rHipX = 0.08;
      rKneeX = 0.12;

      const stroke = state.paddleStrokePhase;
      lShX = -2.2 + Math.sin(stroke) * 1.25;
      lShZ = -0.38;
      lElbX = -0.35 - Math.max(0, Math.cos(stroke)) * 0.7;

      rShX = -2.2 + Math.sin(stroke + Math.PI) * 1.25;
      rShZ = 0.38;
      rElbX = -0.35 - Math.max(0, Math.cos(stroke + Math.PI)) * 0.7;
      torsoRotZ = Math.sin(stroke) * 0.14;
    } else if (state.phase === 'duckDive') {
      // Compact submerged duck dive: arms gripping forward rails, rear knee pressing tail
      const t = THREE.MathUtils.clamp(state.duckDiveTimer / 1.1, 0, 1);
      const pushPulse = Math.sin(t * Math.PI);
      hipsY = 0.15;
      hipsZ = -0.14;
      hipsRotX = 1.46;
      hipsRotY = 0;
      torsoRotX = 0.14 - (1 - pushPulse) * 0.22;
      headRotY = 0;
      headRotX = -0.35;

      lHipX = 0.06;
      lKneeX = 0.12;
      rHipX = -0.62 * pushPulse + 0.08 * (1 - pushPulse);
      rKneeX = 1.24 * pushPulse + 0.12 * (1 - pushPulse);

      lShX = -2.35;
      lShZ = -0.28;
      lElbX = -0.45;
      rShX = -2.35;
      rShZ = 0.28;
      rElbX = -0.45;
    } else if (state.phase === 'takeoff') {
      // Fluid 3-stage pop-up from prone push-up -> tucked knee drive -> spring into surf crouch
      const p = THREE.MathUtils.clamp(state.takeoffTimer / 0.42, 0, 1);
      const easeP = p * p * (3 - 2 * p);
      hipsY = THREE.MathUtils.lerp(0.24, 0.72, easeP);
      hipsZ = THREE.MathUtils.lerp(-0.14, -0.04, easeP);
      hipsRotX = THREE.MathUtils.lerp(1.12, 0.12, easeP);
      hipsRotY = THREE.MathUtils.lerp(0.25 * stanceSign, stanceSign * 1.15, easeP);
      torsoRotX = THREE.MathUtils.lerp(0.18, 0.42, easeP);
      torsoRotY = stanceSign * (1 - easeP) * 0.28;
      headRotY = -hipsRotY * 0.8;
      headRotX = THREE.MathUtils.lerp(-0.42, -0.15, easeP);

      lHipX = THREE.MathUtils.lerp(-0.35, -0.82, easeP);
      lKneeX = THREE.MathUtils.lerp(0.65, 1.38, easeP);
      rHipX = THREE.MathUtils.lerp(-0.45, -0.76, easeP);
      rKneeX = THREE.MathUtils.lerp(0.75, 1.30, easeP);

      lShX = THREE.MathUtils.lerp(-1.55, -0.65, easeP);
      lShZ = THREE.MathUtils.lerp(-0.35, -0.68, easeP);
      lElbX = THREE.MathUtils.lerp(-0.35, -0.72, easeP);
      rShX = THREE.MathUtils.lerp(-1.55, -0.58, easeP);
      rShZ = THREE.MathUtils.lerp(0.35, 0.72, easeP);
      rElbX = THREE.MathUtils.lerp(-0.35, -0.68, easeP);
    } else if (state.phase === 'barrel') {
      // Dynamic tube crouch: reactive low center of gravity, trailing arm lightly brushing wall
      const microBob = Math.sin(time * 4.2) * 0.018;
      hipsY = 0.61 - Math.abs(carveLean) * 0.04 + microBob;
      hipsZ = -0.06;
      hipsRotX = 0.22;
      hipsRotY = stanceSign * 1.08;
      hipsRotZ = bal * 0.14;
      torsoRotX = 0.56 + speedFactor * 0.08;
      torsoRotY = -carveLean * 0.28 - stanceSign * 0.18;
      torsoRotZ = carveLean * 0.32 + bal * 0.22;
      headRotY = -hipsRotY * 0.78 - torsoRotY * 0.55;
      headRotX = -0.22;

      lHipX = -1.04 - Math.abs(carveLean) * 0.12;
      lKneeX = 1.72 + Math.abs(carveLean) * 0.15;
      rHipX = -0.94;
      rKneeX = 1.62;

      // Trailing arm drops low to read the tube face; lead arm stays compact inside
      lShX = -0.52 - carveLean * 0.25;
      lShZ = -0.92 - bal * 0.28;
      lElbX = -0.28;
      rShX = -0.82;
      rShZ = 0.44 - bal * 0.22;
      rElbX = -0.95;
    } else if (state.phase === 'maneuver') {
      const dur = Math.max(0.1, state.maneuverDuration);
      const mProgress = THREE.MathUtils.clamp(state.maneuverTimer / dur, 0, 1);
      const bell = Math.sin(mProgress * Math.PI);
      const exitBlend = THREE.MathUtils.smoothstep(mProgress, 0.72, 1.0);

      if (state.activeManeuver === 'bottomTurn') {
        // 3-phase power bottom turn: entry sink -> deep compressed carve with trailing arm touch -> upward unweight
        const comp = bell * (0.82 + manIntensity * 0.25);
        hipsY = THREE.MathUtils.lerp(0.78 - comp * 0.19, 0.80, exitBlend);
        hipsZ = -0.06;
        hipsRotX = 0.12 + comp * 0.14;
        hipsRotY = stanceSign * (1.15 - comp * 0.25);
        hipsRotZ = carveLean * 0.22;

        torsoRotX = 0.34 + comp * 0.34;
        torsoRotY = -carveLean * 0.55 * comp;
        torsoRotZ = -carveLean * 0.42;
        headRotY = -hipsRotY * 0.75 - torsoRotY * 0.55; // eyes lock up onto the next lip section!
        headRotX = -0.18;

        lHipX = -0.78 - comp * 0.32;
        lKneeX = 1.32 + comp * 0.48;
        rHipX = -0.74 - comp * 0.28;
        rKneeX = 1.26 + comp * 0.44;

        rShX = -0.22 - comp * 0.25;
        rShZ = 0.48 + comp * 0.88;
        rElbX = -0.42 - comp * 0.42;
        lShX = -1.02 * comp - 0.45 * (1 - comp);
        lShZ = -0.82 - comp * 0.25;
        lElbX = -0.58 - comp * 0.35;
      } else if (state.activeManeuver === 'cutback') {
        // High-torque shoulder & hip whip carving back toward the whitewater pocket, then snapping forward
        const whip = bell * (0.85 + manIntensity * 0.22);
        const snapCurve = Math.sin(mProgress * Math.PI * 1.15);
        hipsY = 0.74 - whip * 0.08 + exitBlend * 0.06;
        hipsZ = -0.05;
        hipsRotX = 0.10 + whip * 0.10;
        hipsRotY = stanceSign * (1.12 - snapCurve * 0.48);
        hipsRotZ = carveLean * 0.20 + bal * 0.15;

        torsoRotY = -stanceSign * snapCurve * (0.85 + manIntensity * 0.18);
        torsoRotX = 0.38 + whip * 0.12;
        torsoRotZ = -carveLean * 0.38 + bal * 0.25;
        headRotY = -hipsRotY * 0.65 - torsoRotY * 0.68;
        headRotX = -0.14;

        lHipX = -0.72 - whip * 0.24;
        lKneeX = 1.24 + whip * 0.38;
        rHipX = -0.84 - whip * 0.18;
        rKneeX = 1.42 + whip * 0.32;

        lShX = -0.72 - snapCurve * 0.35;
        lShZ = -1.18 - whip * 0.22;
        lElbX = -0.62 - whip * 0.28;
        rShX = -0.52 + snapCurve * 0.32;
        rShZ = 1.12 + whip * 0.22;
        rElbX = -0.58 - whip * 0.25;
      } else if (state.activeManeuver === 'floater') {
        // Crest pop -> high-line poise with wide balance -> soft drop-down knee prep for water touch
        const landingPrep = THREE.MathUtils.smoothstep(mProgress, 0.72, 1.0);
        hipsY = 0.74 + bell * 0.04 - landingPrep * 0.12;
        hipsZ = -0.05;
        hipsRotX = 0.08 + landingPrep * 0.12;
        hipsRotY = stanceSign * 1.15;
        hipsRotZ = bal * 0.24;

        torsoRotX = 0.42 + landingPrep * 0.14;
        torsoRotY = Math.sin(mProgress * Math.PI * 2) * 0.16;
        torsoRotZ = -carveLean * 0.32 + bal * 0.35;
        headRotY = -hipsRotY * 0.82;
        headRotX = -0.14 - landingPrep * 0.08;

        lHipX = -0.86 - landingPrep * 0.20;
        lKneeX = 1.44 + landingPrep * 0.34;
        rHipX = -0.88 - landingPrep * 0.20;
        rKneeX = 1.48 + landingPrep * 0.34;

        lShX = -0.58;
        lShZ = -1.12 - Math.abs(bal) * 0.22;
        lElbX = -0.38;
        rShX = -0.58;
        rShZ = 1.12 + Math.abs(bal) * 0.22;
        rElbX = -0.38;
      }
    } else if (state.phase === 'airborne') {
      // Dynamic 3-phase aerial: (1) Lip Launch pop -> (2) Apex Grab/Tweak -> (3) Landing Prep Extension
      const launchBlend = THREE.MathUtils.clamp((state.verticalVel - 2.0) / 5.5, 0, 1);
      const descentBlend = THREE.MathUtils.clamp((-state.verticalVel - 1.4) / 5.0, 0, 1);
      const apexGrab = THREE.MathUtils.clamp(1 - launchBlend * 0.7 - descentBlend * 0.85, 0.15, 1);

      hipsY = 0.68 + launchBlend * 0.09 - descentBlend * 0.06;
      hipsZ = -0.04;
      hipsRotX = 0.06 - launchBlend * 0.08 + descentBlend * 0.14;
      hipsRotY = stanceSign * (1.12 + apexGrab * 0.16);
      hipsRotZ = bal * 0.18;

      torsoRotX = 0.56 * apexGrab + 0.34 * launchBlend + 0.44 * descentBlend;
      torsoRotY = stanceSign * (apexGrab * 0.28 - descentBlend * 0.15);
      torsoRotZ = -carveLean * 0.24 + bal * 0.22;
      headRotY = -hipsRotY * 0.78 - torsoRotY * 0.4;
      headRotX = descentBlend > 0.2 ? -0.24 : -0.12;

      // Tuck tightly at apex, uncoil smoothly to spot & absorb water landing
      lHipX = THREE.MathUtils.lerp(-1.18, -0.78, descentBlend);
      lKneeX = THREE.MathUtils.lerp(1.92, 1.32, descentBlend);
      rHipX = THREE.MathUtils.lerp(-1.08, -0.74, descentBlend);
      rKneeX = THREE.MathUtils.lerp(1.80, 1.26, descentBlend);

      // Lead hand reaches toward rail grab at apex, opens wide during descent for balance!
      lShX = THREE.MathUtils.lerp(-1.18, -0.52, descentBlend);
      lShZ = THREE.MathUtils.lerp(-0.32, -1.05, descentBlend);
      lElbX = THREE.MathUtils.lerp(-0.62, -0.35, descentBlend);

      rShX = THREE.MathUtils.lerp(-0.64, -0.45, descentBlend);
      rShZ = THREE.MathUtils.lerp(1.22, 1.05, descentBlend);
      rElbX = THREE.MathUtils.lerp(-0.45, -0.38, descentBlend);
    } else if (state.phase === 'wipeout') {
      // Directional fall, water entry tumble, and resurfacing animations
      const wt = state.wipeoutTimer;
      const inten = state.fallIntensity;
      const dir = state.fallDir;

      if (wt < 0.46) {
        // Phase A: Losing balance / thrown off board depending on fall type
        const eject = wt / 0.46;
        hipsY = 0.62 - eject * 0.25;
        hipsZ = 0;

        if (state.fallType === 'forward') {
          hipsRotX = 0.65 + eject * 1.45;
          torsoRotX = 0.65;
          headRotX = -0.25;
          lShX = -1.9;
          rShX = -1.9;
          lShZ = -0.65;
          rShZ = 0.65;
          lHipX = 0.25;
          rHipX = 0.15;
        } else if (state.fallType === 'backward') {
          hipsRotX = -0.75 - eject * 1.15;
          torsoRotX = -0.45;
          headRotX = 0.25;
          lShX = -2.35;
          rShX = -2.25;
          lShZ = -0.8;
          rShZ = 0.8;
          lHipX = -0.95;
          rHipX = -0.75;
        } else if (state.fallType === 'lipSlam' || state.fallType === 'barrelPinch') {
          hipsRotX = -0.4 + Math.sin(wt * 12) * 1.1 * inten;
          hipsRotZ = dir * (0.95 + eject * 1.3);
          hipsRotY = stanceSign * 0.6 + dir * wt * 4.2;
          torsoRotZ = dir * 0.55;
          lShX = -1.8 + Math.sin(wt * 15) * 0.8;
          rShX = -1.6 + Math.cos(wt * 14) * 0.8;
          lShZ = -1.1;
          rShZ = 1.1;
          lHipX = -0.4;
          rHipX = -0.9;
        } else {
          // 'sideways'
          hipsRotZ = dir * (0.65 + eject * 1.15);
          torsoRotZ = dir * 0.42;
          hipsRotX = 0.35;
          lShX = -1.5;
          rShX = -1.5;
          lShZ = -1.2;
          rShZ = 1.2;
          lHipX = -0.5;
          rHipX = -0.8;
        }
      } else if (wt < 1.38) {
        // Phase B: Submerged tumble under breaking wave turbulence
        const underP = wt - 0.46;
        hipsY = 0.22;
        hipsZ = 0;
        hipsRotX = 0.8 + Math.sin(underP * 6.5) * 1.15 * inten;
        hipsRotY = dir * underP * 2.4;
        hipsRotZ = Math.cos(underP * 5.8) * 1.25 * inten;
        torsoRotX = Math.sin(underP * 7.2) * 0.45;
        torsoRotZ = Math.cos(underP * 6.4) * 0.55;
        headRotY = 0;
        headRotX = 0.1;
        lShX = -1.4 + Math.sin(underP * 11) * 0.9;
        rShX = -1.4 + Math.cos(underP * 10) * 0.9;
        lShZ = -0.75;
        rShZ = 0.75;
        lHipX = -0.35 + Math.sin(underP * 9) * 0.45;
        rHipX = -0.45 + Math.cos(underP * 9) * 0.45;
      } else {
        // Phase C: Resurfacing kick back to ocean surface
        const surfP = THREE.MathUtils.clamp((wt - 1.38) / 0.65, 0, 1);
        hipsY = THREE.MathUtils.lerp(0.2, 0.16, surfP);
        hipsZ = 0;
        hipsRotX = THREE.MathUtils.lerp(0.75, 1.15, surfP);
        hipsRotY = 0;
        hipsRotZ = 0;
        torsoRotX = -0.25;
        headRotY = 0;
        headRotX = -0.45;
        lShX = -1.35 + Math.sin(time * 9) * 0.55;
        rShX = -1.35 + Math.cos(time * 9) * 0.55;
        lShZ = -0.55;
        rShZ = 0.55;
        lHipX = Math.sin(time * 12) * 0.35;
        rHipX = Math.sin(time * 12 + Math.PI) * 0.35;
      }
    } else if (state.phase === 'recovering') {
      // Freestyle swimming back to floating surfboard
      const stroke = state.paddleStrokePhase;
      const swimActive = THREE.MathUtils.clamp(state.speed / 1.8, 0.25, 1.0);
      hipsY = 0.08;
      hipsZ = -0.05;
      hipsRotX = 1.44;
      hipsRotY = 0;
      hipsRotZ = Math.sin(stroke) * 0.12 * swimActive;
      torsoRotX = -0.24;
      torsoRotZ = Math.sin(stroke) * 0.18 * swimActive;
      headRotY = 0;
      headRotX = -0.55;

      // Flutter kick
      lHipX = Math.sin(stroke * 2.1) * 0.34 * swimActive;
      lKneeX = 0.18 + Math.max(0, -Math.sin(stroke * 2.1)) * 0.28 * swimActive;
      rHipX = Math.sin(stroke * 2.1 + Math.PI) * 0.34 * swimActive;
      rKneeX = 0.18 + Math.max(0, -Math.sin(stroke * 2.1 + Math.PI)) * 0.28 * swimActive;

      // Alternating crawl arms
      lShX = -2.1 + Math.sin(stroke) * 1.25 * swimActive;
      lShZ = -0.35;
      lElbX = -0.3 - Math.max(0, Math.cos(stroke)) * 0.65 * swimActive;

      rShX = -2.1 + Math.sin(stroke + Math.PI) * 1.25 * swimActive;
      rShZ = 0.35;
      rElbX = -0.3 - Math.max(0, Math.cos(stroke + Math.PI)) * 0.65 * swimActive;
    } else {
      // Active 'riding' stance: fluid rail-to-rail knee drive, chop absorption, turn anticipation & landing crouch
      const breathe = Math.sin(time * 2.4) * 0.02;
      const chopFlex = Math.sin(time * (5.2 + speedFactor * 4.8)) * 0.022 * speedFactor;
      const carveDepth = Math.abs(carveLean) * 0.14;
      const landSquat = landComp * 0.22;

      hipsY = 0.82 - speedFactor * 0.07 - carveDepth - landSquat + breathe + chopFlex;
      hipsZ = -0.05 - carveDepth * 0.15;
      hipsRotX = 0.06 + carveDepth * 0.45 + landSquat * 0.55;
      hipsRotY = stanceSign * 1.15 - carveLean * 0.24;
      hipsRotZ = bal * 0.20 + carveLean * 0.10;

      // Upper body leans coherently into turns and counters balance shifts naturally
      torsoRotX = 0.24 + speedFactor * 0.14 + carveDepth * 0.65 + landSquat * 0.75;
      torsoRotY = -carveLean * 0.48 * stanceSign - bal * 0.16;
      torsoRotZ = -carveLean * 0.46 + bal * 0.34;
      headRotY = -hipsRotY * 0.80 - torsoRotY * 0.52 - carveLean * 0.22;
      headRotX = -0.10 - landSquat * 0.14;

      // Dynamic knee compression & rail weighting (front vs back leg pressure shifts with roll & pitch)
      const kneeExtra = carveDepth * 1.9 + landSquat * 2.1 - chopFlex * 2.4;
      const railWeight = carveLean * 0.18 * stanceSign;
      lHipX = -0.46 - kneeExtra * 0.52 - railWeight;
      lKneeX = 0.88 + kneeExtra + railWeight * 1.4;
      rHipX = -0.56 - kneeExtra * 0.52 + railWeight;
      rKneeX = 0.96 + kneeExtra - railWeight * 1.4;

      // Expressive arms & elbows react to speed, carve lean & balance compensation
      const armSpread = Math.abs(bal) * 0.48 + landComp * 0.35;
      lShZ = -0.66 - bal * 0.52 - armSpread * 0.55 + Math.sin(time * 2.1) * 0.05;
      rShZ = 0.66 - bal * 0.52 + armSpread * 0.55 - Math.sin(time * 2.1) * 0.05;
      lShX = -0.46 - carveLean * 0.42 - landSquat * 0.65;
      rShX = -0.42 + carveLean * 0.42 - landSquat * 0.65;
      lElbX = -0.56 - Math.abs(carveLean) * 0.36 - landComp * 0.45;
      rElbX = -0.52 - Math.abs(carveLean) * 0.32 - landComp * 0.45;
    }

    // Layered multi-rate damping removes rigid/robotic snaps between phases while keeping responsiveness
    const lowerLambda = state.phase === 'wipeout' ? 11.5 : state.phase === 'takeoff' ? 16.5 : 14.5;
    const upperLambda = state.phase === 'wipeout' ? 10.5 : 11.0;
    const armLambda = state.phase === 'wipeout' ? 12.0 : 12.5;
    const boardCarryLambda = state.phase === 'beachWalk' ? 12 : 18;

    boardMesh.position.x = damp(boardMesh.position.x, boardOffsetX, boardCarryLambda, dt);
    boardMesh.position.y = damp(boardMesh.position.y, boardOffsetY, boardCarryLambda, dt);
    boardMesh.position.z = damp(boardMesh.position.z, boardOffsetZ, boardCarryLambda, dt);
    boardMesh.rotation.x = damp(boardMesh.rotation.x, boardRotX, boardCarryLambda, dt);
    boardMesh.rotation.y = damp(boardMesh.rotation.y, boardRotY, boardCarryLambda, dt);
    boardMesh.rotation.z = damp(boardMesh.rotation.z, boardRotZ, boardCarryLambda, dt);

    hips.position.y = damp(hips.position.y, hipsY, lowerLambda, dt);
    hips.position.z = damp(hips.position.z, hipsZ, lowerLambda, dt);
    hips.rotation.x = damp(hips.rotation.x, hipsRotX, lowerLambda, dt);
    hips.rotation.y = damp(hips.rotation.y, hipsRotY, lowerLambda, dt);
    hips.rotation.z = damp(hips.rotation.z, hipsRotZ, lowerLambda, dt);

    torso.rotation.x = damp(torso.rotation.x, torsoRotX, upperLambda, dt);
    torso.rotation.y = damp(torso.rotation.y, torsoRotY, upperLambda, dt);
    torso.rotation.z = damp(torso.rotation.z, torsoRotZ, upperLambda, dt);

    head.rotation.x = damp(head.rotation.x, headRotX, upperLambda, dt);
    head.rotation.y = damp(head.rotation.y, headRotY, upperLambda, dt);

    leftHip.rotation.x = damp(leftHip.rotation.x, lHipX, lowerLambda, dt);
    leftKnee.rotation.x = damp(leftKnee.rotation.x, lKneeX, lowerLambda, dt);
    rightHip.rotation.x = damp(rightHip.rotation.x, rHipX, lowerLambda, dt);
    rightKnee.rotation.x = damp(rightKnee.rotation.x, rKneeX, lowerLambda, dt);

    leftShoulder.rotation.x = damp(leftShoulder.rotation.x, lShX, armLambda, dt);
    leftShoulder.rotation.z = damp(leftShoulder.rotation.z, lShZ, armLambda, dt);
    leftElbow.rotation.x = damp(leftElbow.rotation.x, lElbX, armLambda, dt);

    rightShoulder.rotation.x = damp(rightShoulder.rotation.x, rShX, armLambda, dt);
    rightShoulder.rotation.z = damp(rightShoulder.rotation.z, rShZ, armLambda, dt);
    rightElbow.rotation.x = damp(rightElbow.rotation.x, rElbX, armLambda, dt);
  };

  const animateVictory = (
    kind: VictoryCutsceneKind,
    stage: number,
    stageProgress: number,
    time: number,
    dt: number,
    worldPos: THREE.Vector3,
    waveNormal: THREE.Vector3,
    heading: number,
    boardAnchorWorld?: THREE.Vector3
  ) => {
    setFirstPersonMode(false);
    root.position.copy(worldPos);
    const damp = THREE.MathUtils.damp;
    const stanceSign = isGoofy ? -1 : 1;

    let hipsY = 0.86;
    let hipsZ = -0.04;
    let hipsRotX = 0.02;
    let hipsRotY = stanceSign * 0.85;
    let hipsRotZ = 0;
    let torsoRotX = 0.06;
    let torsoRotY = -stanceSign * 0.45;
    let torsoRotZ = 0;
    let headRotY = 0;
    let headRotX = -0.06;

    let lHipX = -0.22;
    let lKneeX = 0.42;
    let rHipX = -0.26;
    let rKneeX = 0.46;

    let lShX = -0.45;
    let lShZ = -0.58;
    let lElbX = -0.45;
    let rShX = -2.2;
    let rShZ = 0.48;
    let rElbX = -0.65;

    let boardOffsetX = 0;
    let boardOffsetY = 0;
    let boardOffsetZ = 0;
    let boardRotX = 0;
    let boardRotY = 0;
    let boardRotZ = 0;

    if (kind === 'championship_ceremony') {
      // Champion standing upright on the coastal podium stage beside trophy & board
      characterGroup.position.set(0, 0, 0);
      characterGroup.quaternion.setFromAxisAngle(_yAxis, heading);

      if (boardAnchorWorld) {
        boardContainer.position.set(
          boardAnchorWorld.x - worldPos.x,
          boardAnchorWorld.y - worldPos.y + 1.0,
          boardAnchorWorld.z - worldPos.z
        );
      } else {
        boardContainer.position.set(-0.62, 1.0, -0.06);
      }
      _yawQuat.setFromAxisAngle(_yAxis, heading + 0.14);
      _pitchQuat.setFromAxisAngle(_xAxis, -Math.PI * 0.46);
      _rollQuat.setFromAxisAngle(_zAxis, 0.06);
      boardContainer.quaternion.copy(_yawQuat).multiply(_pitchQuat).multiply(_rollQuat);

      const breathe = Math.sin(time * 2.2) * 0.014;
      hipsY = 0.89 + breathe;
      hipsZ = 0;
      hipsRotX = 0;
      hipsRotY = 0;
      hipsRotZ = 0;
      torsoRotX = -0.03;
      torsoRotY = Math.sin(time * 0.85) * 0.12;
      torsoRotZ = 0;
      headRotY = Math.sin(time * 1.15) * 0.16;
      headRotX = -0.05;

      lHipX = -0.04;
      lKneeX = 0.08;
      rHipX = -0.04;
      rKneeX = 0.08;

      if (stage === 1) {
        // Proud champion presentation stance gesturing toward the 3D Trophy
        rShX = -1.18 + Math.sin(time * 2.6) * 0.06;
        rShZ = 0.62;
        rElbX = -0.52;
        lShX = -0.18;
        lShZ = -0.32;
        lElbX = -0.35;
      } else {
        // Raised champion salute + crowd wave
        const pump = Math.sin(time * 3.8) * 0.1;
        rShX = -2.42 + pump;
        rShZ = 0.45;
        rElbX = -0.45 - Math.max(0, pump) * 0.5;
        lShX = stage >= 3 ? -2.05 + Math.sin(time * 5.0) * 0.18 : -0.32;
        lShZ = stage >= 3 ? -0.68 : -0.38;
        lElbX = stage >= 3 ? -0.52 : -0.42;
      }
    } else {
      // Water-based celebrations standing on surfboard riding ocean swell
      characterGroup.position.set(0, 0, 0);
      boardContainer.position.set(0, 0, 0);
      _alignQuat.setFromUnitVectors(_up, waveNormal);
      _yawQuat.setFromAxisAngle(_yAxis, heading);
      const boardRock = Math.sin(time * 2.4) * 0.045;
      _rollQuat.setFromAxisAngle(_zAxis, boardRock);
      const noseFloat = kind === 'final_win' && stage === 1 ? -0.08 : -0.04;
      _pitchQuat.setFromAxisAngle(_xAxis, noseFloat);
      boardContainer.quaternion
        .copy(_alignQuat)
        .multiply(_yawQuat)
        .multiply(_rollQuat)
        .multiply(_pitchQuat);
      characterGroup.quaternion.copy(boardContainer.quaternion);

      const bob = Math.sin(time * 3.2) * 0.018;

      if (kind === 'heat_win') {
        // Channel close-up fist pump celebration
        const pump = Math.sin(time * 6.2);
        hipsY = 0.85 + bob;
        hipsRotY = stanceSign * 0.72;
        torsoRotX = 0.04;
        torsoRotY = -stanceSign * 0.42;
        headRotY = Math.sin(time * 1.4) * 0.12;
        lShX = -0.42;
        lShZ = -0.78;
        lElbX = -0.58;
        rShX = -2.28 + pump * 0.24;
        rShZ = 0.44;
        rElbX = -0.78 + pump * 0.35;
      } else if (kind === 'quarterfinal_win') {
        // Confident fist-pump & proud shaka salute to camera
        const wave = Math.sin(time * 5.2);
        hipsY = 0.84 + bob;
        hipsRotY = stanceSign * 0.65;
        torsoRotX = 0.05;
        torsoRotY = -stanceSign * 0.35 + wave * 0.08;
        headRotY = Math.sin(time * 1.3) * 0.14;
        if (stage === 1) {
          rShX = -2.35 + wave * 0.22;
          rShZ = 0.52;
          rElbX = -0.72;
          lShX = -0.55;
          lShZ = -0.82;
          lElbX = -0.48;
        } else {
          // Wide arms celebratory glide
          rShX = -1.95 + wave * 0.15;
          rShZ = 0.88;
          rElbX = -0.35;
          lShX = -1.85 - wave * 0.12;
          lShZ = -0.85;
          lElbX = -0.38;
        }
      } else if (kind === 'semifinal_win') {
        // Intense celebratory V-pose & double-fist victory bounce
        const bounce = Math.abs(Math.sin(time * 5.0));
        hipsY = 0.86 + bounce * 0.045;
        hipsRotY = stanceSign * 0.42;
        torsoRotX = -0.04;
        torsoRotY = Math.sin(time * 2.2) * 0.22;
        torsoRotZ = Math.sin(time * 5.0) * 0.06;
        lHipX = -0.18 - bounce * 0.08;
        lKneeX = 0.34 + bounce * 0.14;
        rHipX = -0.22 - bounce * 0.08;
        rKneeX = 0.38 + bounce * 0.14;

        const armPump = Math.sin(time * 7.2) * 0.2;
        lShX = -2.52 + armPump;
        lShZ = -0.76;
        lElbX = -0.42 + armPump * 0.35;
        rShX = -2.52 - armPump * 0.8;
        rShZ = 0.76;
        rElbX = -0.42 - armPump * 0.35;
      } else {
        // 'final_win': Stage 1 post-wave victorious ride-out -> Stage 2 & 3 ecstatic Champion celebration
        if (stage === 1) {
          const tuck = 1 - stageProgress * 0.5;
          hipsY = 0.76 + (1 - tuck) * 0.1;
          hipsRotY = stanceSign * 1.05;
          torsoRotX = 0.24 * tuck;
          torsoRotY = -stanceSign * 0.25;
          lHipX = -0.45 * tuck - 0.18 * (1 - tuck);
          lKneeX = 0.85 * tuck + 0.34 * (1 - tuck);
          rHipX = -0.52 * tuck - 0.22 * (1 - tuck);
          rKneeX = 0.92 * tuck + 0.38 * (1 - tuck);
          lShX = -0.65;
          lShZ = -0.95;
          lElbX = -0.35;
          rShX = THREE.MathUtils.lerp(-0.55, -2.35, stageProgress);
          rShZ = 0.85;
          rElbX = -0.42;
        } else {
          const euphoria = Math.sin(time * 6.0);
          hipsY = 0.88 + Math.abs(euphoria) * 0.035;
          hipsRotY = stanceSign * 0.3;
          torsoRotX = -0.05;
          torsoRotY = Math.sin(time * 1.8) * 0.24;
          lHipX = -0.16;
          lKneeX = 0.3;
          rHipX = -0.2;
          rKneeX = 0.34;
          lShX = -2.58 + euphoria * 0.16;
          lShZ = -0.84;
          lElbX = -0.35;
          rShX = -2.58 - euphoria * 0.16;
          rShZ = 0.84;
          rElbX = -0.35;
        }
      }
    }

    const bodyLambda = 10.5;
    const armLambda = 13.0;

    boardMesh.position.x = damp(boardMesh.position.x, boardOffsetX, 14, dt);
    boardMesh.position.y = damp(boardMesh.position.y, boardOffsetY, 14, dt);
    boardMesh.position.z = damp(boardMesh.position.z, boardOffsetZ, 14, dt);
    boardMesh.rotation.x = damp(boardMesh.rotation.x, boardRotX, 14, dt);
    boardMesh.rotation.y = damp(boardMesh.rotation.y, boardRotY, 14, dt);
    boardMesh.rotation.z = damp(boardMesh.rotation.z, boardRotZ, 14, dt);

    hips.position.y = damp(hips.position.y, hipsY, bodyLambda, dt);
    hips.position.z = damp(hips.position.z, hipsZ, bodyLambda, dt);
    hips.rotation.x = damp(hips.rotation.x, hipsRotX, bodyLambda, dt);
    hips.rotation.y = damp(hips.rotation.y, hipsRotY, bodyLambda, dt);
    hips.rotation.z = damp(hips.rotation.z, hipsRotZ, bodyLambda, dt);

    torso.rotation.x = damp(torso.rotation.x, torsoRotX, bodyLambda, dt);
    torso.rotation.y = damp(torso.rotation.y, torsoRotY, bodyLambda, dt);
    torso.rotation.z = damp(torso.rotation.z, torsoRotZ, bodyLambda, dt);

    head.rotation.x = damp(head.rotation.x, headRotX, bodyLambda, dt);
    head.rotation.y = damp(head.rotation.y, headRotY, bodyLambda, dt);

    leftHip.rotation.x = damp(leftHip.rotation.x, lHipX, bodyLambda, dt);
    leftKnee.rotation.x = damp(leftKnee.rotation.x, lKneeX, bodyLambda, dt);
    rightHip.rotation.x = damp(rightHip.rotation.x, rHipX, bodyLambda, dt);
    rightKnee.rotation.x = damp(rightKnee.rotation.x, rKneeX, bodyLambda, dt);

    leftShoulder.rotation.x = damp(leftShoulder.rotation.x, lShX, armLambda, dt);
    leftShoulder.rotation.z = damp(leftShoulder.rotation.z, lShZ, armLambda, dt);
    leftElbow.rotation.x = damp(leftElbow.rotation.x, lElbX, armLambda, dt);

    rightShoulder.rotation.x = damp(rightShoulder.rotation.x, rShX, armLambda, dt);
    rightShoulder.rotation.z = damp(rightShoulder.rotation.z, rShZ, armLambda, dt);
    rightElbow.rotation.x = damp(rightElbow.rotation.x, rElbX, armLambda, dt);
  };

  const animateInterview = (
    phase: 'question' | 'reaction',
    tone: InterviewTone | undefined,
    time: number,
    dt: number,
    worldPos: THREE.Vector3,
    heading: number,
    boardAnchorWorld?: THREE.Vector3
  ) => {
    root.position.copy(worldPos);
    _yawQuat.setFromAxisAngle(_yAxis, heading);
    root.quaternion.copy(_yawQuat);

    characterGroup.position.set(0, 0, 0);
    characterGroup.rotation.set(0, 0, 0);

    boardContainer.position.set(0, 0, 0);
    boardContainer.rotation.set(0, 0, 0);

    let boardOffsetX = 0.65;
    let boardOffsetY = 0.04;
    let boardOffsetZ = 0;
    if (boardAnchorWorld) {
      const localX = boardAnchorWorld.x - worldPos.x;
      const localZ = boardAnchorWorld.z - worldPos.z;
      const cosH = Math.cos(-heading);
      const sinH = Math.sin(-heading);
      boardOffsetX = localX * cosH - localZ * sinH;
      boardOffsetZ = localX * sinH + localZ * cosH;
      boardOffsetY = 1.05 + (boardAnchorWorld.y - worldPos.y);
    }

    const breath = Math.sin(time * 2.3);
    let hipsY = 0.90 + breath * 0.008;
    const hipsRotY = Math.sin(time * 0.6) * 0.04;
    let torsoRotX = 0.03;
    let torsoRotY = 0.06;
    let torsoRotZ = 0;
    let headRotX = -0.02 + Math.sin(time * 1.9) * 0.03;
    let headRotY = 0.1 + Math.sin(time * 0.9) * 0.05;
    const lHipX = -0.04;
    const lKneeX = 0.08;
    const rHipX = -0.04;
    const rKneeX = 0.08;

    let lShX = -0.22;
    let lShZ = -0.14;
    let lElbX = -0.45;
    let rShX = -0.24;
    let rShZ = 0.14;
    let rElbX = -0.48;

    if (phase === 'question') {
      // Attentive listening athlete stance with relaxed hands & subtle listening nods
      headRotX = 0.02 + Math.sin(time * 3.1) * 0.045;
      headRotY = 0.14;
      lShX = -0.26;
      lShZ = -0.12;
      lElbX = -0.62;
      rShX = -0.3;
      rShZ = 0.12;
      rElbX = -0.68;
    } else if (tone === 'humildade') {
      // Respectful chest-tap gesture & warm appreciative nod
      const nod = Math.sin(time * 3.8) * 0.08;
      torsoRotX = 0.08;
      headRotX = 0.07 + nod;
      headRotY = 0.06;
      lShX = -0.22;
      lShZ = -0.16;
      lElbX = -0.45;
      rShX = -0.82 + Math.sin(time * 3.0) * 0.08;
      rShZ = 0.34;
      rElbX = -1.42;
    } else if (tone === 'provocacao') {
      // Bold, expressive swagger lean with assertive speaking gesture
      const pulse = Math.sin(time * 5.2);
      hipsY = 0.91 + Math.abs(pulse) * 0.015;
      torsoRotX = -0.06;
      torsoRotY = 0.12 + pulse * 0.07;
      torsoRotZ = -0.05;
      headRotX = -0.09;
      headRotY = 0.04 + pulse * 0.06;
      lShX = -0.78 + pulse * 0.22;
      lShZ = -0.42;
      lElbX = -0.58 + pulse * 0.18;
      rShX = -1.25 - pulse * 0.16;
      rShZ = 0.38;
      rElbX = -0.62;
    } else {
      // 'confianca': Composed champion stance with assured open hand gesture
      const speak = Math.sin(time * 4.2);
      torsoRotX = -0.02;
      torsoRotY = 0.05 + speak * 0.04;
      headRotX = -0.04 + speak * 0.04;
      headRotY = 0.05;
      lShX = -0.68 + speak * 0.15;
      lShZ = -0.28;
      lElbX = -0.85 + speak * 0.12;
      rShX = -0.52 - speak * 0.1;
      rShZ = 0.24;
      rElbX = -0.78;
    }

    const bodyLambda = 7.5;
    const armLambda = 9.0;

    boardMesh.position.x = damp(boardMesh.position.x, boardOffsetX, 14, dt);
    boardMesh.position.y = damp(boardMesh.position.y, boardOffsetY, 14, dt);
    boardMesh.position.z = damp(boardMesh.position.z, boardOffsetZ, 14, dt);
    boardMesh.rotation.x = damp(boardMesh.rotation.x, -Math.PI * 0.44, 14, dt);
    boardMesh.rotation.y = damp(boardMesh.rotation.y, 0.06, 14, dt);
    boardMesh.rotation.z = damp(boardMesh.rotation.z, 0.22, 14, dt);

    hips.position.y = damp(hips.position.y, hipsY, bodyLambda, dt);
    hips.position.z = damp(hips.position.z, 0, bodyLambda, dt);
    hips.rotation.x = damp(hips.rotation.x, 0, bodyLambda, dt);
    hips.rotation.y = damp(hips.rotation.y, hipsRotY, bodyLambda, dt);
    hips.rotation.z = damp(hips.rotation.z, 0, bodyLambda, dt);

    torso.rotation.x = damp(torso.rotation.x, torsoRotX, bodyLambda, dt);
    torso.rotation.y = damp(torso.rotation.y, torsoRotY, bodyLambda, dt);
    torso.rotation.z = damp(torso.rotation.z, torsoRotZ, bodyLambda, dt);

    head.rotation.x = damp(head.rotation.x, headRotX, bodyLambda, dt);
    head.rotation.y = damp(head.rotation.y, headRotY, bodyLambda, dt);

    leftHip.rotation.x = damp(leftHip.rotation.x, lHipX, bodyLambda, dt);
    leftKnee.rotation.x = damp(leftKnee.rotation.x, lKneeX, bodyLambda, dt);
    rightHip.rotation.x = damp(rightHip.rotation.x, rHipX, bodyLambda, dt);
    rightKnee.rotation.x = damp(rightKnee.rotation.x, rKneeX, bodyLambda, dt);

    leftShoulder.rotation.x = damp(leftShoulder.rotation.x, lShX, armLambda, dt);
    leftShoulder.rotation.z = damp(leftShoulder.rotation.z, lShZ, armLambda, dt);
    leftElbow.rotation.x = damp(leftElbow.rotation.x, lElbX, armLambda, dt);

    rightShoulder.rotation.x = damp(rightShoulder.rotation.x, rShX, armLambda, dt);
    rightShoulder.rotation.z = damp(rightShoulder.rotation.z, rShZ, armLambda, dt);
    rightElbow.rotation.x = damp(rightElbow.rotation.x, rElbX, armLambda, dt);
  };

  return {
    root,
    characterGroup,
    boardContainer,
    hips,
    torso,
    head,
    leftShoulder,
    leftElbow,
    rightShoulder,
    rightElbow,
    leftHip,
    leftKnee,
    rightHip,
    rightKnee,
    updateBoard,
    updateProfile,
    setFirstPersonMode,
    getFirstPersonPose,
    animate,
    animateVictory,
    animateInterview,
    dispose: () => {
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (!child.userData.sharedGeo) {
            child.geometry.dispose();
          }
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      suitMat.dispose();
      accentMat.dispose();
      skinMat.dispose();
      hairMat.dispose();
    },
  };
}
