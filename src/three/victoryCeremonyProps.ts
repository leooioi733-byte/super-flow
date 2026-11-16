import * as THREE from 'three';
import { getBeachHeightAt } from './oceanShader';

export interface VictoryCeremonyProps {
  group: THREE.Group;
  setVisible: (visible: boolean, tierAccentHex?: string) => void;
  update: (time: number, stageProgress: number) => void;
  getSurferAnchor: (out: THREE.Vector3) => THREE.Vector3;
  getBoardAnchor: (out: THREE.Vector3) => THREE.Vector3;
  getTrophyWorldPos: (out: THREE.Vector3) => THREE.Vector3;
  dispose: () => void;
}

const STAGE_X = -4.5;
const STAGE_Z = 25.5;
const DECK_HEIGHT = 0.16;
const PLINTH_HEIGHT = 0.92;

/**
 * Composite procedural 3D Championship Trophy & Coastal Award Ceremony Stage.
 * Built exclusively from multi-part Lathe/Extrude/Tube PBR geometries grounded flush
 * onto the coastal sand terrain via getBeachHeightAt().
 */
export function createVictoryCeremonyProps(): VictoryCeremonyProps {
  const group = new THREE.Group();
  group.visible = false;

  const baseSandY = getBeachHeightAt(STAGE_X, STAGE_Z);
  group.position.set(STAGE_X, baseSandY, STAGE_Z);
  // Face the podium outward toward the sea & camera (-Z) with a welcoming 14° coastal angle
  group.rotation.y = Math.PI + 0.18;

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // --- PBR Materials with clear material roughness/metalness contrast ---
  const driftwoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#4e3929',
      roughness: 0.86,
      metalness: 0.02,
    })
  );
  const obsidianStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#0e1d2b',
      roughness: 0.42,
      metalness: 0.14,
    })
  );
  const goldMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#f4c65c',
      roughness: 0.16,
      metalness: 0.94,
      clearcoat: 0.65,
      clearcoatRoughness: 0.1,
    })
  );
  const brushedBrassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#d8a642',
      roughness: 0.28,
      metalness: 0.88,
    })
  );
  const crystalWaveMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#2dd4c4',
      emissive: '#0a4f52',
      emissiveIntensity: 0.28,
      roughness: 0.12,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.92,
    })
  );

  // 1. Grounded Two-Tier Coastal Driftwood Podium Deck (sunk slightly -0.06m so edges seat cleanly in sand)
  const deckLowerGeo = trackGeo(new THREE.CylinderGeometry(2.15, 2.28, DECK_HEIGHT + 0.08, 32));
  const deckLower = new THREE.Mesh(deckLowerGeo, driftwoodMat);
  deckLower.position.y = (DECK_HEIGHT - 0.08) * 0.5;
  deckLower.receiveShadow = true;
  deckLower.castShadow = true;
  group.add(deckLower);

  const deckRimGeo = trackGeo(new THREE.CylinderGeometry(1.94, 1.98, 0.045, 32));
  const deckRim = new THREE.Mesh(deckRimGeo, brushedBrassMat);
  deckRim.position.y = DECK_HEIGHT + 0.015;
  deckRim.receiveShadow = true;
  group.add(deckRim);

  const deckTopGeo = trackGeo(new THREE.CylinderGeometry(1.88, 1.88, 0.035, 32));
  const deckTop = new THREE.Mesh(deckTopGeo, obsidianStoneMat);
  deckTop.position.y = DECK_HEIGHT + 0.025;
  deckTop.receiveShadow = true;
  group.add(deckTop);

  // 2. Ceremonial Trophy Plinth Column to Champion's right (+0.62 X on stage)
  const trophyPlinthX = 0.62;
  const trophyPlinthZ = 0.24;

  const plinthFootGeo = trackGeo(new THREE.BoxGeometry(0.56, 0.1, 0.56));
  const plinthFoot = new THREE.Mesh(plinthFootGeo, obsidianStoneMat);
  plinthFoot.position.set(trophyPlinthX, DECK_HEIGHT + 0.09, trophyPlinthZ);
  plinthFoot.castShadow = true;
  plinthFoot.receiveShadow = true;
  group.add(plinthFoot);

  const plinthColGeo = trackGeo(new THREE.CylinderGeometry(0.19, 0.24, PLINTH_HEIGHT - 0.16, 20));
  const plinthCol = new THREE.Mesh(plinthColGeo, obsidianStoneMat);
  plinthCol.position.set(trophyPlinthX, DECK_HEIGHT + 0.14 + (PLINTH_HEIGHT - 0.16) * 0.5, trophyPlinthZ);
  plinthCol.castShadow = true;
  plinthCol.receiveShadow = true;
  group.add(plinthCol);

  const plinthCapGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.23, 0.08, 24));
  const plinthCap = new THREE.Mesh(plinthCapGeo, brushedBrassMat);
  plinthCap.position.set(trophyPlinthX, DECK_HEIGHT + PLINTH_HEIGHT, trophyPlinthZ);
  plinthCap.castShadow = true;
  plinthCap.receiveShadow = true;
  group.add(plinthCap);

  // 3. Composite Multi-Part 3D Championship Trophy mounted on top of plinth
  const trophyGroup = new THREE.Group();
  const trophyBaseY = DECK_HEIGHT + PLINTH_HEIGHT + 0.04;
  trophyGroup.position.set(trophyPlinthX, trophyBaseY, trophyPlinthZ);
  group.add(trophyGroup);

  // 3a. Stepped octagonal/dark walnut trophy base + gold nameplate
  const tBaseGeo = trackGeo(new THREE.CylinderGeometry(0.165, 0.19, 0.09, 16));
  const tBase = new THREE.Mesh(tBaseGeo, obsidianStoneMat);
  tBase.position.y = 0.045;
  tBase.castShadow = true;
  trophyGroup.add(tBase);

  const tCollarGeo = trackGeo(new THREE.CylinderGeometry(0.13, 0.16, 0.04, 24));
  const tCollar = new THREE.Mesh(tCollarGeo, goldMat);
  tCollar.position.y = 0.11;
  tCollar.castShadow = true;
  trophyGroup.add(tCollar);

  const plaqueGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.048, 0.02));
  const plaque = new THREE.Mesh(plaqueGeo, brushedBrassMat);
  plaque.position.set(0, 0.048, 0.175);
  trophyGroup.add(plaque);

  // 3b. Sculpted Gold Stem & Fluted Chalice Cup (LatheGeometry)
  const chaliceProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.13),
    new THREE.Vector2(0.105, 0.13),
    new THREE.Vector2(0.075, 0.17),
    new THREE.Vector2(0.042, 0.23),
    new THREE.Vector2(0.036, 0.31),
    new THREE.Vector2(0.068, 0.36),
    new THREE.Vector2(0.145, 0.46),
    new THREE.Vector2(0.185, 0.62),
    new THREE.Vector2(0.195, 0.68),
    new THREE.Vector2(0.172, 0.68),
    new THREE.Vector2(0.142, 0.50),
    new THREE.Vector2(0.055, 0.39),
    new THREE.Vector2(0.0, 0.38),
  ];
  const chaliceGeo = trackGeo(new THREE.LatheGeometry(chaliceProfile, 32));
  const chaliceMesh = new THREE.Mesh(chaliceGeo, goldMat);
  chaliceMesh.castShadow = true;
  trophyGroup.add(chaliceMesh);

  // 3c. Twin Sculptural Gold Ribbon Handles (TubeGeometry curves)
  for (const side of [-1, 1]) {
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.175, 0.62, 0),
      new THREE.Vector3(side * 0.275, 0.60, 0),
      new THREE.Vector3(side * 0.265, 0.44, 0),
      new THREE.Vector3(side * 0.115, 0.38, 0),
    ]);
    const handleGeo = trackGeo(new THREE.TubeGeometry(handleCurve, 24, 0.017, 10, false));
    const handleMesh = new THREE.Mesh(handleGeo, goldMat);
    handleMesh.castShadow = true;
    trophyGroup.add(handleMesh);
  }

  // 3d. Turquoise Crystal Curling Ocean Wave Crest rising from the Chalice (ExtrudeGeometry)
  const waveShape = new THREE.Shape();
  waveShape.moveTo(-0.11, 0.0);
  waveShape.quadraticCurveTo(-0.12, 0.19, -0.02, 0.29);
  waveShape.quadraticCurveTo(0.08, 0.37, 0.16, 0.31);
  waveShape.quadraticCurveTo(0.10, 0.27, 0.06, 0.22);
  waveShape.quadraticCurveTo(0.01, 0.15, 0.08, 0.0);
  waveShape.closePath();

  const waveCrestGeo = trackGeo(
    new THREE.ExtrudeGeometry(waveShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 3,
      curveSegments: 20,
    })
  );
  waveCrestGeo.translate(0, 0, -0.0225);
  const waveCrestMesh = new THREE.Mesh(waveCrestGeo, crystalWaveMat);
  waveCrestMesh.position.set(0, 0.56, 0);
  waveCrestMesh.castShadow = true;
  trophyGroup.add(waveCrestMesh);

  // 3e. Golden Halo Ring framing the crystal wave crest
  const ringGeo = trackGeo(new THREE.TorusGeometry(0.17, 0.014, 12, 36));
  const ringMesh = new THREE.Mesh(ringGeo, goldMat);
  ringMesh.position.set(0, 0.72, 0);
  ringMesh.castShadow = true;
  trophyGroup.add(ringMesh);

  // 4. Ceremonial Surfboard Stand / Cradle to Champion's left (-0.84 X)
  const cradleBaseGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.05, 0.38));
  const cradleBase = new THREE.Mesh(cradleBaseGeo, driftwoodMat);
  cradleBase.position.set(-0.84, DECK_HEIGHT + 0.065, -0.05);
  cradleBase.castShadow = true;
  cradleBase.receiveShadow = true;
  group.add(cradleBase);

  const cradleTrimGeo = trackGeo(new THREE.BoxGeometry(0.48, 0.02, 0.40));
  const cradleTrim = new THREE.Mesh(cradleTrimGeo, brushedBrassMat);
  cradleTrim.position.set(-0.84, DECK_HEIGHT + 0.045, -0.05);
  group.add(cradleTrim);

  // Subtle warm celebratory spotlight above the trophy & champion (zero shadows so zero FPS drop)
  const trophyGlow = new THREE.PointLight('#ffd98a', 1.4, 8.5, 1.6);
  trophyGlow.position.set(0.15, DECK_HEIGHT + 2.45, 0.95);
  group.add(trophyGlow);

  const setVisible = (visible: boolean, tierAccentHex?: string) => {
    group.visible = visible;
    if (visible && tierAccentHex) {
      crystalWaveMat.color.set(tierAccentHex);
      crystalWaveMat.emissive.set(tierAccentHex).multiplyScalar(0.32);
    }
  };

  const update = (time: number, stageProgress: number) => {
    if (!group.visible) return;
    // Gentle proud turntable spin on the trophy pedestal top & shimmering light pulse
    trophyGroup.rotation.y = Math.sin(time * 0.55) * 0.28 + stageProgress * 0.45;
    trophyGlow.intensity = 1.25 + Math.sin(time * 3.1) * 0.2;
  };

  const getSurferAnchor = (out: THREE.Vector3): THREE.Vector3 => {
    out.set(-0.22, DECK_HEIGHT + 0.04, 0.02);
    group.localToWorld(out);
    return out;
  };

  const getBoardAnchor = (out: THREE.Vector3): THREE.Vector3 => {
    out.set(-0.84, DECK_HEIGHT + 0.09, -0.05);
    group.localToWorld(out);
    return out;
  };

  const getTrophyWorldPos = (out: THREE.Vector3): THREE.Vector3 => {
    out.set(trophyPlinthX, trophyBaseY + 0.48, trophyPlinthZ);
    group.localToWorld(out);
    return out;
  };

  return {
    group,
    setVisible,
    update,
    getSurferAnchor,
    getBoardAnchor,
    getTrophyWorldPos,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
