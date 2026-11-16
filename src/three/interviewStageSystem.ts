import * as THREE from 'three';
import { InterviewTone } from '../types/career';
import { getBeachHeightAt } from './oceanShader';

export type InterviewCameraPhase = 'question' | 'reaction';

export interface InterviewStageSystem {
  group: THREE.Group;
  setVisible: (visible: boolean, accentHex?: string) => void;
  update: (
    time: number,
    dt: number,
    phase: InterviewCameraPhase,
    tone?: InterviewTone
  ) => void;
  getSurferAnchor: (out: THREE.Vector3) => THREE.Vector3;
  getBoardAnchor: (out: THREE.Vector3) => THREE.Vector3;
  getCameraTargets: (
    phase: InterviewCameraPhase,
    time: number,
    outCamPos: THREE.Vector3,
    outLookTarget: THREE.Vector3
  ) => number;
  getShadowFocus: (out: THREE.Vector3) => THREE.Vector3;
  dispose: () => void;
}

const STAGE_X = 3.8;
const STAGE_Z = 24.8;
const DECK_TOP = 0.05;

function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

/**
 * Generates a crisp high-resolution coastal press backdrop banner texture
 * with FLOW Circuito Oficial branding and subtle sponsor step-and-repeat marks.
 */
function createPressBannerTexture(accentHex = '#2596a6'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Deep oceanic navy gradient base
    const grad = ctx.createLinearGradient(0, 0, 1024, 512);
    grad.addColorStop(0, '#071c2e');
    grad.addColorStop(0.55, '#0b2d47');
    grad.addColorStop(1, '#082135');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Accent wave ribbon across lower backdrop
    ctx.fillStyle = accentHex;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.moveTo(0, 390);
    ctx.bezierCurveTo(260, 310, 620, 445, 1024, 340);
    ctx.lineTo(1024, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Subtle geometric sponsor grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    for (let x = 128; x < 1024; x += 256) {
      ctx.beginPath();
      ctx.moveTo(x, 36);
      ctx.lineTo(x, 476);
      ctx.stroke();
    }
    for (let y = 170; y < 480; y += 155) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(984, y);
      ctx.stroke();
    }

    // Center hero crest
    ctx.fillStyle = '#38d9c8';
    ctx.font = 'bold 24px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CIRCUITO MUNDIAL · ZONA DE IMPRENSA', 512, 118);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 84px Inter, system-ui, sans-serif';
    ctx.fillText('FLOW SURF', 512, 224);

    // Step-and-repeat sponsor emblems
    const sponsors = ['MARÉ TECH', 'SOLAR WAVE', 'COASTAL LAB', 'OCEANO PRO'];
    ctx.font = 'bold 26px Inter, system-ui, sans-serif';
    sponsors.forEach((label, idx) => {
      const col = idx % 2 === 0 ? 225 : 799;
      const row = idx < 2 ? 325 : 418;
      ctx.fillStyle = 'rgba(231, 220, 200, 0.78)';
      ctx.fillText(label, col, row);
    });

    // Center bottom bar
    ctx.fillStyle = '#f4c97a';
    ctx.font = 'bold 24px Inter, system-ui, sans-serif';
    ctx.fillText('ENTREVISTA OFICIAL PÓS-BATERIA', 512, 418);

    // Border trim
    ctx.strokeStyle = 'rgba(56, 217, 200, 0.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, 996, 484);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createMicFlagTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#092236';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#38d9c8';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 236, 236);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 54px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FLOW', 128, 128);
    ctx.fillStyle = '#38d9c8';
    ctx.font = 'bold 28px Inter, system-ui, sans-serif';
    ctx.fillText('PRESS', 128, 174);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Interactive 3D Post-Competition Press Zone with branded truss backdrop,
 * broadcast camera tripod, surfboard stand, and an articulated 3D Journalist
 * holding a branded FLOW Press microphone.
 */
export function createInterviewStageSystem(): InterviewStageSystem {
  const group = new THREE.Group();
  group.visible = false;

  const baseSandY = getBeachHeightAt(STAGE_X, STAGE_Z);
  group.position.set(STAGE_X, baseSandY, STAGE_Z);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  // --- Shared PBR Materials ---
  const matSlateDeck = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#102130',
      roughness: 0.78,
      metalness: 0.08,
    })
  );
  const matTimber = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#5a412e',
      roughness: 0.85,
      metalness: 0.03,
    })
  );
  const matAluminum = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#cdd6de',
      roughness: 0.28,
      metalness: 0.86,
    })
  );
  const matDarkMetal = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#1a2028',
      roughness: 0.42,
      metalness: 0.72,
    })
  );
  const matGoldTrim = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#e5b85c',
      roughness: 0.24,
      metalness: 0.9,
    })
  );
  const matAccentGlow = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#2596a6',
      emissive: '#135461',
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.2,
    })
  );

  // 1. Grounded Press Mat & Timber Border Platform (sunk cleanly into sand)
  const basePlate = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(3.9, 0.11, 2.75)),
    matTimber
  );
  basePlate.position.set(0.15, -0.015, 0.05);
  basePlate.receiveShadow = true;
  basePlate.castShadow = true;
  group.add(basePlate);

  const carpetMatMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(3.62, 0.025, 2.48)),
    matSlateDeck
  );
  carpetMatMesh.position.set(0.15, DECK_TOP - 0.005, 0.05);
  carpetMatMesh.receiveShadow = true;
  group.add(carpetMatMesh);

  // 2. Branded Press Step-and-Repeat Truss Wall behind/to the right of the surfer
  const wallGroup = new THREE.Group();
  wallGroup.position.set(1.52, DECK_TOP, 0.36);
  wallGroup.rotation.y = -1.42;
  group.add(wallGroup);

  const bannerTex = trackTex(createPressBannerTexture());
  const bannerMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.62,
      metalness: 0.05,
    })
  );

  const WALL_W = 3.2;
  const WALL_H = 2.05;
  const wallCenterY = 1.24;

  // Backing frame & printed vinyl banner
  const panelFrame = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(WALL_W + 0.14, WALL_H + 0.12, 0.09)),
    matDarkMetal
  );
  panelFrame.position.set(0, wallCenterY, -0.02);
  panelFrame.castShadow = true;
  panelFrame.receiveShadow = true;
  wallGroup.add(panelFrame);

  const bannerMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(WALL_W, WALL_H)),
    bannerMat
  );
  bannerMesh.position.set(0, wallCenterY, 0.032);
  wallGroup.add(bannerMesh);

  // Vertical aluminum truss columns & base plates
  const postGeo = trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 2.38, 12));
  const footGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.045, 0.44));
  for (const sx of [-WALL_W * 0.5 - 0.12, WALL_W * 0.5 + 0.12]) {
    const post = new THREE.Mesh(postGeo, matAluminum);
    post.position.set(sx, 1.19, 0);
    post.castShadow = true;
    wallGroup.add(post);

    const foot = new THREE.Mesh(footGeo, matDarkMetal);
    foot.position.set(sx, 0.02, 0);
    wallGroup.add(foot);
  }

  // Top truss beam + two subtle warm studio press lamps
  const topBeam = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.034, 0.034, WALL_W + 0.42, 12)),
    matAluminum
  );
  topBeam.rotation.z = Math.PI / 2;
  topBeam.position.set(0, 2.36, 0.02);
  topBeam.castShadow = true;
  wallGroup.add(topBeam);

  const lampHousingGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.075, 0.14, 12));
  for (const lx of [-0.95, 0.95]) {
    const lamp = new THREE.Mesh(lampHousingGeo, matDarkMetal);
    lamp.position.set(lx, 2.36, 0.22);
    lamp.rotation.x = 0.68;
    wallGroup.add(lamp);
  }

  // 3. Surfboard Display Cradle next to Surfer
  const cradleGroup = new THREE.Group();
  cradleGroup.position.set(1.08, DECK_TOP, -0.78);
  cradleGroup.rotation.y = -1.65;
  group.add(cradleGroup);

  const cradleFoot = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.42, 0.04, 0.34)),
    matTimber
  );
  cradleFoot.position.y = 0.02;
  cradleFoot.castShadow = true;
  cradleGroup.add(cradleFoot);

  const cradleTrim = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.44, 0.018, 0.36)),
    matAccentGlow
  );
  cradleTrim.position.y = 0.009;
  cradleGroup.add(cradleTrim);

  // 4. Broadcast TV Camera on Aluminum Tripod (foreground accent outside main sightline)
  const camProp = new THREE.Group();
  camProp.position.set(-1.35, DECK_TOP, -1.02);
  camProp.rotation.y = 1.92;
  group.add(camProp);

  const legGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.012, 1.38, 8));
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const legPivot = new THREE.Group();
    legPivot.position.set(0, 1.32, 0);
    legPivot.rotation.y = ang;
    const legMesh = new THREE.Mesh(legGeo, matAluminum);
    legMesh.rotation.z = 0.24;
    legMesh.position.set(-0.16, -0.66, 0);
    legMesh.castShadow = true;
    legPivot.add(legMesh);
    camProp.add(legPivot);
  }

  const camBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.18, 0.2, 0.38)),
    matDarkMetal
  );
  camBody.position.set(0, 1.44, 0);
  camBody.castShadow = true;
  camProp.add(camBody);

  const camLens = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.068, 0.055, 0.22, 16)),
    matDarkMetal
  );
  camLens.rotation.x = Math.PI / 2;
  camLens.position.set(0, 1.44, 0.28);
  camProp.add(camLens);

  const tallyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ff4242',
      emissive: '#ff2b2b',
      emissiveIntensity: 1.4,
      roughness: 0.2,
    })
  );
  const tallyLed = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.018, 8, 8)),
    tallyMat
  );
  tallyLed.position.set(0, 1.56, 0.16);
  camProp.add(tallyLed);

  // 5. Articulated 3D Journalist Character holding Multi-Part Handheld Microphone
  const jRoot = new THREE.Group();
  jRoot.position.set(-0.74, DECK_TOP, 0.26);
  jRoot.rotation.y = 1.88; // Faces surfer at (+0.48, DECK_TOP, -0.15)
  group.add(jRoot);

  const jJacketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#172a3e',
      roughness: 0.68,
      metalness: 0.06,
    })
  );
  const jShirtMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f2f5f7',
      roughness: 0.58,
      metalness: 0.02,
    })
  );
  const jTrousersMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#222b36',
      roughness: 0.78,
      metalness: 0.04,
    })
  );
  const jSkinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#d49a74',
      roughness: 0.6,
      metalness: 0.0,
    })
  );
  const jHairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#241a15',
      roughness: 0.86,
      metalness: 0.0,
    })
  );
  const jLanyardMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#38d9c8',
      roughness: 0.45,
      metalness: 0.15,
    })
  );

  const jHips = new THREE.Group();
  jHips.position.set(0, 0.89, 0);
  jRoot.add(jHips);

  const jPelvis = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.11, 0.09, 6, 12)),
    jTrousersMat
  );
  jPelvis.rotation.z = Math.PI / 2;
  jPelvis.castShadow = true;
  jHips.add(jPelvis);

  const jTorso = new THREE.Group();
  jTorso.position.set(0, 0.07, 0);
  jHips.add(jTorso);

  const jChest = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.14, 0.27, 8, 14)),
    jJacketMat
  );
  jChest.position.set(0, 0.21, 0);
  jChest.scale.set(1.12, 1.0, 0.78);
  jChest.castShadow = true;
  jTorso.add(jChest);

  // Shirt V-front collar insert
  const jShirt = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.11, 0.22, 0.04)),
    jShirtMat
  );
  jShirt.position.set(0, 0.27, 0.105);
  jTorso.add(jShirt);

  // Press credential lanyard & pass card
  const lanyardStrap = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.024, 0.21, 0.012)),
    jLanyardMat
  );
  lanyardStrap.position.set(0.025, 0.25, 0.122);
  lanyardStrap.rotation.z = -0.18;
  jTorso.add(lanyardStrap);

  const pressBadge = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.075, 0.095, 0.012)),
    jShirtMat
  );
  pressBadge.position.set(0.035, 0.14, 0.126);
  jTorso.add(pressBadge);

  // Head + Hair + Broadcast Earpiece
  const jHead = new THREE.Group();
  jHead.position.set(0, 0.44, 0);
  jTorso.add(jHead);

  const jNeck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.045, 0.052, 0.095, 10)),
    jSkinMat
  );
  jNeck.position.y = 0.04;
  jHead.add(jNeck);

  const jSkull = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.102, 16, 14)),
    jSkinMat
  );
  jSkull.position.y = 0.155;
  jSkull.scale.set(0.92, 1.06, 0.96);
  jSkull.castShadow = true;
  jHead.add(jSkull);

  const jHair = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.108, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)),
    jHairMat
  );
  jHair.position.set(0, 0.165, -0.01);
  jHair.rotation.x = -0.22;
  jHead.add(jHair);

  const earpiece = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.022, 8, 8)),
    matDarkMetal
  );
  earpiece.position.set(0.098, 0.145, 0.01);
  jHead.add(earpiece);

  // Legs
  const jThighGeo = trackGeo(new THREE.CapsuleGeometry(0.064, 0.28, 6, 10));
  const jShinGeo = trackGeo(new THREE.CapsuleGeometry(0.048, 0.31, 6, 10));
  const jShoeGeo = trackGeo(new THREE.BoxGeometry(0.09, 0.055, 0.21));
  const jShoeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.72 })
  );

  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.09, -0.04, 0);
    jHips.add(hip);

    const thigh = new THREE.Mesh(jThighGeo, jTrousersMat);
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Mesh(jShinGeo, jTrousersMat);
    shin.position.y = -0.56;
    shin.castShadow = true;
    hip.add(shin);

    const shoe = new THREE.Mesh(jShoeGeo, jShoeMat);
    shoe.position.set(0, -0.82, 0.05);
    shoe.castShadow = true;
    hip.add(shoe);
  }

  // Arms (Left = expressive conversational hand, Right = articulated arm holding 3D Microphone)
  const jUpperGeo = trackGeo(new THREE.CapsuleGeometry(0.044, 0.21, 6, 10));
  const jForeGeo = trackGeo(new THREE.CapsuleGeometry(0.036, 0.19, 6, 10));
  const jHandGeo = trackGeo(new THREE.SphereGeometry(0.039, 8, 8));

  const jLeftShoulder = new THREE.Group();
  jLeftShoulder.position.set(-0.19, 0.35, 0);
  jTorso.add(jLeftShoulder);

  const jLeftUpper = new THREE.Mesh(jUpperGeo, jJacketMat);
  jLeftUpper.position.y = -0.12;
  jLeftUpper.castShadow = true;
  jLeftShoulder.add(jLeftUpper);

  const jLeftElbow = new THREE.Group();
  jLeftElbow.position.set(0, -0.24, 0);
  jLeftShoulder.add(jLeftElbow);

  const jLeftFore = new THREE.Mesh(jForeGeo, jJacketMat);
  jLeftFore.position.y = -0.11;
  jLeftFore.castShadow = true;
  jLeftElbow.add(jLeftFore);

  const jLeftHand = new THREE.Mesh(jHandGeo, jSkinMat);
  jLeftHand.position.y = -0.23;
  jLeftHand.scale.set(0.85, 1.2, 0.65);
  jLeftElbow.add(jLeftHand);

  const jRightShoulder = new THREE.Group();
  jRightShoulder.position.set(0.19, 0.35, 0);
  jTorso.add(jRightShoulder);

  const jRightUpper = new THREE.Mesh(jUpperGeo, jJacketMat);
  jRightUpper.position.y = -0.12;
  jRightUpper.castShadow = true;
  jRightShoulder.add(jRightUpper);

  const jRightElbow = new THREE.Group();
  jRightElbow.position.set(0, -0.24, 0);
  jRightShoulder.add(jRightElbow);

  const jRightFore = new THREE.Mesh(jForeGeo, jJacketMat);
  jRightFore.position.y = -0.11;
  jRightFore.castShadow = true;
  jRightElbow.add(jRightFore);

  const jRightHand = new THREE.Mesh(jHandGeo, jSkinMat);
  jRightHand.position.y = -0.23;
  jRightHand.scale.set(0.85, 1.2, 0.65);
  jRightElbow.add(jRightHand);

  // Composite 3D Handheld Broadcast Microphone mounted cleanly inside Journalist's Right Hand
  const micGroup = new THREE.Group();
  micGroup.position.set(0, -0.24, 0.03);
  micGroup.rotation.x = 1.05; // Points microphone head forward along forearm reach
  jRightElbow.add(micGroup);

  const micHandle = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.015, 0.012, 0.19, 12)),
    matDarkMetal
  );
  micHandle.position.y = 0.04;
  micHandle.castShadow = true;
  micGroup.add(micHandle);

  const micCollar = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.02, 0.016, 0.022, 12)),
    matGoldTrim
  );
  micCollar.position.y = 0.135;
  micGroup.add(micCollar);

  const micFlagTex = trackTex(createMicFlagTexture());
  const micFlagMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: micFlagTex,
      roughness: 0.45,
      metalness: 0.1,
    })
  );
  const micFlag = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.068, 0.062, 0.068)),
    micFlagMat
  );
  micFlag.position.y = 0.092;
  micFlag.castShadow = true;
  micGroup.add(micFlag);

  const micFoam = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.034, 14, 12)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#14171c', roughness: 0.92 }))
  );
  micFoam.position.y = 0.172;
  micFoam.scale.set(1, 1.15, 1);
  micFoam.castShadow = true;
  micGroup.add(micFoam);

  // Soft warm coastal press fill light (no shadow map cost)
  const pressLight = new THREE.PointLight('#ffe5ba', 1.35, 9.0, 1.6);
  pressLight.position.set(-0.35, 2.55, -1.25);
  group.add(pressLight);

  // Animator state
  let jTalkBlend = 0;

  const setVisible = (visible: boolean, accentHex?: string) => {
    group.visible = visible;
    if (visible && accentHex) {
      matAccentGlow.color.set(accentHex);
      matAccentGlow.emissive.set(accentHex).multiplyScalar(0.35);
    }
  };

  const update = (
    time: number,
    dt: number,
    phase: InterviewCameraPhase,
    tone?: InterviewTone
  ) => {
    if (!group.visible) return;
    const safeDt = Math.max(0.001, dt);

    const isQuestion = phase === 'question';
    jTalkBlend = damp(jTalkBlend, isQuestion ? 1 : 0, 5.5, safeDt);

    // Journalist natural breathing, conversational nodding & mic choreography
    const breath = Math.sin(time * 2.1);
    const speakWave = Math.sin(time * 7.2) * jTalkBlend;
    const nod =
      phase === 'reaction'
        ? tone === 'humildade' || tone === 'confianca'
          ? Math.sin(time * 4.4) * 0.09
          : Math.sin(time * 3.1) * 0.05
        : Math.sin(time * 3.8) * 0.04;

    jHips.position.y = 0.89 + breath * 0.008;
    jHips.rotation.y = Math.sin(time * 0.7) * 0.04;
    jTorso.rotation.x = 0.04 + jTalkBlend * 0.05;
    jTorso.rotation.y = -0.06 + speakWave * 0.035;
    jHead.rotation.x = -0.04 + nod + speakWave * 0.04;
    jHead.rotation.y = -0.14 + Math.sin(time * 1.1) * 0.05;

    // Left arm conversational hand motion during question, relaxed rest while athlete speaks
    const tgtLShX = THREE.MathUtils.lerp(-0.18, -0.58 + speakWave * 0.14, jTalkBlend);
    const tgtLShZ = THREE.MathUtils.lerp(-0.12, -0.22, jTalkBlend);
    const tgtLElbX = THREE.MathUtils.lerp(-0.36, -0.95 + Math.cos(time * 5.2) * 0.12, jTalkBlend);

    // Right arm holding microphone: held near journalist while asking, extended smoothly toward athlete when athlete reacts
    const tgtRShX = THREE.MathUtils.lerp(-0.92, -0.78, jTalkBlend);
    const tgtRShZ = THREE.MathUtils.lerp(-0.24, 0.16, jTalkBlend);
    const tgtRElbX = THREE.MathUtils.lerp(-0.42, -1.08 + speakWave * 0.06, jTalkBlend);

    jLeftShoulder.rotation.x = damp(jLeftShoulder.rotation.x, tgtLShX, 7.5, safeDt);
    jLeftShoulder.rotation.z = damp(jLeftShoulder.rotation.z, tgtLShZ, 7.5, safeDt);
    jLeftElbow.rotation.x = damp(jLeftElbow.rotation.x, tgtLElbX, 8.5, safeDt);

    jRightShoulder.rotation.x = damp(jRightShoulder.rotation.x, tgtRShX, 6.5, safeDt);
    jRightShoulder.rotation.z = damp(jRightShoulder.rotation.z, tgtRShZ, 6.5, safeDt);
    jRightElbow.rotation.x = damp(jRightElbow.rotation.x, tgtRElbX, 7.5, safeDt);

    pressLight.intensity = 1.3 + Math.sin(time * 2.4) * 0.1;
  };

  const getSurferAnchor = (out: THREE.Vector3): THREE.Vector3 => {
    out.set(0.48, DECK_TOP, -0.15);
    return group.localToWorld(out);
  };

  const getBoardAnchor = (out: THREE.Vector3): THREE.Vector3 => {
    out.set(1.08, DECK_TOP + 0.05, -0.78);
    return group.localToWorld(out);
  };

  const getCameraTargets = (
    phase: InterviewCameraPhase,
    time: number,
    outCamPos: THREE.Vector3,
    outLookTarget: THREE.Vector3
  ): number => {
    const breatheX = Math.sin(time * 0.42) * 0.08;
    const breatheY = Math.cos(time * 0.55) * 0.035;

    if (phase === 'reaction') {
      // Flattering medium close-up on Surfer reacting (placed in upper 58% of viewport above answer banner)
      outCamPos.set(
        STAGE_X - 1.65 + breatheX * 0.6,
        baseSandY + DECK_TOP + 1.48 + breatheY,
        STAGE_Z - 1.25
      );
      outLookTarget.set(STAGE_X + 0.38, baseSandY + DECK_TOP + 1.02, STAGE_Z - 0.14);
      return 36;
    }

    // Question / Choosing phase: balanced 2-shot showing Journalist with Microphone + Surfer + FLOW Press Wall & ocean horizon
    outCamPos.set(
      STAGE_X - 3.35 + breatheX,
      baseSandY + DECK_TOP + 1.58 + breatheY,
      STAGE_Z - 0.85
    );
    outLookTarget.set(STAGE_X + 0.25, baseSandY + DECK_TOP + 0.96, STAGE_Z + 0.02);
    return 41;
  };

  const getShadowFocus = (out: THREE.Vector3): THREE.Vector3 => {
    return out.set(STAGE_X, baseSandY, STAGE_Z);
  };

  return {
    group,
    setVisible,
    update,
    getSurferAnchor,
    getBoardAnchor,
    getCameraTargets,
    getShadowFocus,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
