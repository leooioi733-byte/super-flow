import * as THREE from 'three';
import { BeachAtmosphere, BeachTheme } from '../types/game';
import { getBeachHeightAt } from './oceanShader';

export interface BeachLifeSystem {
  group: THREE.Group;
  setConfig: (atmosphere: BeachAtmosphere, theme: BeachTheme) => void;
  update: (
    time: number,
    windStrength: number,
    dt?: number,
    camZ?: number,
    underwaterAmount?: number
  ) => {
    volleyballHitPulse: boolean;
  };
  dispose: () => void;
}

interface HumanCharacterRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

interface VolleyballPlayer {
  rig: HumanCharacterRig;
  baseX: number;
  baseZ: number;
  facingZ: number;
  sideSign: number; // -1 left side, +1 right side
  phase: number;
}

interface WalkerAgent {
  rig: HumanCharacterRig;
  xStart: number;
  xEnd: number;
  zBase: number;
  speed: number;
  phase: number;
  isLivelyOnly: boolean;
}

interface LoungerAgent {
  group: THREE.Group;
  armWave?: THREE.Group;
  phase: number;
  isLivelyOnly: boolean;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

const THEME_PALETTES: Record<
  BeachTheme,
  { primary: string; secondary: string; tertiary: string; trim: string }
> = {
  Tropical: {
    primary: '#1ea896',
    secondary: '#ff785a',
    tertiary: '#f4b942',
    trim: '#f9f5eb',
  },
  Sunset: {
    primary: '#d96b43',
    secondary: '#e8a849',
    tertiary: '#8c4356',
    trim: '#fdf1dc',
  },
  Classic: {
    primary: '#164266',
    secondary: '#c84b31',
    tertiary: '#2e6f73',
    trim: '#f4efe6',
  },
};

const _humanPelvisGeo = new THREE.BoxGeometry(0.28, 0.16, 0.18);
const _humanChestGeo = new THREE.BoxGeometry(0.32, 0.44, 0.2);
const _humanHeadGeo = new THREE.SphereGeometry(0.115, 10, 8);
const _humanHairGeo = new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.56);
const _humanArmGeo = new THREE.CylinderGeometry(0.042, 0.036, 0.48, 7);
_humanArmGeo.translate(0, -0.22, 0);
const _humanUpperLegGeo = new THREE.CylinderGeometry(0.068, 0.055, 0.44, 7);
_humanUpperLegGeo.translate(0, -0.22, 0);
const _humanLowerLegGeo = new THREE.CylinderGeometry(0.052, 0.04, 0.42, 7);
_humanLowerLegGeo.translate(0, -0.62, 0);
const _humanHairMat = new THREE.MeshStandardMaterial({ color: '#2b1e16', roughness: 0.85 });

function createBeachHuman(
  skinHex: string,
  topHex: string,
  shortsHex: string,
  hasShirt = true
): HumanCharacterRig {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.62 });
  const topMat = new THREE.MeshStandardMaterial({ color: hasShirt ? topHex : skinHex, roughness: 0.72 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: shortsHex, roughness: 0.78 });

  const hips = new THREE.Group();
  hips.position.y = 0.88;
  root.add(hips);

  const pelvis = new THREE.Mesh(_humanPelvisGeo, shortsMat);
  pelvis.castShadow = true;
  hips.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);

  const chest = new THREE.Mesh(_humanChestGeo, topMat);
  chest.position.y = 0.22;
  chest.castShadow = true;
  torso.add(chest);

  const head = new THREE.Mesh(_humanHeadGeo, skinMat);
  head.position.y = 0.56;
  head.castShadow = true;
  torso.add(head);

  const hair = new THREE.Mesh(_humanHairGeo, _humanHairMat);
  hair.position.y = 0.57;
  torso.add(hair);

  // Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(0.21, 0.42, 0);
  const laMesh = new THREE.Mesh(_humanArmGeo, skinMat);
  laMesh.castShadow = true;
  leftArm.add(laMesh);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(-0.21, 0.42, 0);
  const raMesh = new THREE.Mesh(_humanArmGeo, skinMat);
  raMesh.castShadow = true;
  rightArm.add(raMesh);
  torso.add(rightArm);

  // Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(0.09, -0.04, 0);
  const llTop = new THREE.Mesh(_humanUpperLegGeo, shortsMat);
  const llBot = new THREE.Mesh(_humanLowerLegGeo, skinMat);
  llTop.castShadow = true;
  llBot.castShadow = false;
  leftLeg.add(llTop, llBot);
  hips.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(-0.09, -0.04, 0);
  const rlTop = new THREE.Mesh(_humanUpperLegGeo, shortsMat);
  const rlBot = new THREE.Mesh(_humanLowerLegGeo, skinMat);
  rlTop.castShadow = true;
  rlBot.castShadow = false;
  rightLeg.add(rlTop, rlBot);
  hips.add(rightLeg);

  return { root, hips, torso, leftArm, rightArm, leftLeg, rightLeg };
}

function createStripedUmbrellaTexture(c1: string, c2: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const stripes = 8;
  const w = canvas.width / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? c1 : c2;
    ctx.fillRect(i * w, 0, w + 1, canvas.height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createBeachLifeSystem(): BeachLifeSystem {
  const group = new THREE.Group();
  const livelyOnlyObjects: THREE.Object3D[] = [];
  const themedPrimaryMats: THREE.MeshStandardMaterial[] = [];
  const themedSecondaryMats: THREE.MeshStandardMaterial[] = [];
  const themedTertiaryMats: THREE.MeshStandardMaterial[] = [];
  const umbrellaMats: { mat: THREE.MeshStandardMaterial; slot: 0 | 1 | 2 }[] = [];
  const dynamicTextures: THREE.Texture[] = [];

  let texPrimary = createStripedUmbrellaTexture(THEME_PALETTES.Tropical.primary, THEME_PALETTES.Tropical.trim);
  let texSecondary = createStripedUmbrellaTexture(THEME_PALETTES.Tropical.secondary, THEME_PALETTES.Tropical.trim);
  let texTertiary = createStripedUmbrellaTexture(THEME_PALETTES.Tropical.tertiary, THEME_PALETTES.Tropical.trim);
  dynamicTextures.push(texPrimary, texSecondary, texTertiary);

  const woodMat = new THREE.MeshStandardMaterial({ color: '#8f6b47', roughness: 0.86 });
  const lightWoodMat = new THREE.MeshStandardMaterial({ color: '#c4a47c', roughness: 0.82 });
  const whitePaintMat = new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.68 });

  // --- 1. ACTIVE 2v2 BEACH VOLLEYBALL COURT (x ~ 14..26, z ~ 24..33) ---
  const vbCenterX = 19.5;
  const vbCenterZ = 27.8;
  const courtHalfX = 4.6;
  const courtHalfZ = 2.6;
  const vbGroundY = getBeachHeightAt(vbCenterX, vbCenterZ);

  const vbGroup = new THREE.Group();
  group.add(vbGroup);
  livelyOnlyObjects.push(vbGroup);

  // Court boundary lines conforming to beach height
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#e85d3f', roughness: 0.8 });
  themedSecondaryMats.push(tapeMat);
  const lineSpecs: [number, number, number, number][] = [
    [vbCenterX, vbCenterZ - courtHalfZ, courtHalfX * 2, 0.08],
    [vbCenterX, vbCenterZ + courtHalfZ, courtHalfX * 2, 0.08],
    [vbCenterX - courtHalfX, vbCenterZ, 0.08, courtHalfZ * 2],
    [vbCenterX + courtHalfX, vbCenterZ, 0.08, courtHalfZ * 2],
  ];
  for (const [lx, lz, lw, ld] of lineSpecs) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.025, ld), tapeMat);
    seg.position.set(lx, getBeachHeightAt(lx, lz) + 0.02, lz);
    vbGroup.add(seg);
  }

  // Volleyball net posts & mesh along X = vbCenterX (court runs East-West so match is clearly visible from ocean & menu!)
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.55, 8);
  for (const zOff of [-courtHalfZ - 0.25, courtHalfZ + 0.25]) {
    const px = vbCenterX;
    const pz = vbCenterZ + zOff;
    const py = getBeachHeightAt(px, pz);
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(px, py + 1.2, pz);
    post.castShadow = true;
    vbGroup.add(post);
  }

  const netSpan = (courtHalfZ + 0.2) * 2;
  const netMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(netSpan, 0.92, 12, 5),
    new THREE.MeshStandardMaterial({
      color: '#e5e7eb',
      wireframe: true,
      transparent: true,
      opacity: 0.72,
    })
  );
  netMesh.rotation.y = Math.PI / 2;
  netMesh.position.set(vbCenterX, vbGroundY + 1.88, vbCenterZ);
  vbGroup.add(netMesh);

  const topTape = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, netSpan), whitePaintMat);
  topTape.position.set(vbCenterX, vbGroundY + 2.34, vbCenterZ);
  vbGroup.add(topTape);

  // Volleyball sphere
  const ballMat = new THREE.MeshStandardMaterial({
    color: '#faf6eb',
    roughness: 0.42,
    metalness: 0.04,
  });
  const volleyball = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), ballMat);
  volleyball.castShadow = true;
  vbGroup.add(volleyball);

  // 4 Articulated Volleyball Players (2 left, 2 right)
  const vbPlayers: VolleyballPlayer[] = [
    {
      rig: createBeachHuman('#c88a62', '#ff785a', '#1d3557', false),
      baseX: vbCenterX - 2.3,
      baseZ: vbCenterZ - 1.1,
      facingZ: 0,
      sideSign: -1,
      phase: 0.0,
    },
    {
      rig: createBeachHuman('#8d5524', '#f4b942', '#264653', true),
      baseX: vbCenterX - 1.9,
      baseZ: vbCenterZ + 1.15,
      facingZ: 0,
      sideSign: -1,
      phase: 1.5,
    },
    {
      rig: createBeachHuman('#e0ac84', '#1ea896', '#0f2d42', true),
      baseX: vbCenterX + 2.2,
      baseZ: vbCenterZ - 1.05,
      facingZ: 0,
      sideSign: 1,
      phase: 0.75,
    },
    {
      rig: createBeachHuman('#b87a52', '#ffffff', '#e76f51', false),
      baseX: vbCenterX + 2.0,
      baseZ: vbCenterZ + 1.15,
      facingZ: 0,
      sideSign: 1,
      phase: 2.2,
    },
  ];
  vbPlayers.forEach((p) => {
    p.rig.root.rotation.y = p.sideSign < 0 ? Math.PI / 2 : -Math.PI / 2;
    p.rig.root.position.set(p.baseX, getBeachHeightAt(p.baseX, p.baseZ), p.baseZ);
    vbGroup.add(p.rig.root);
  });

  // --- 2. LIFEGUARD TOWER (x = -22, z = 24.5) ---
  const lgX = -22;
  const lgZ = 24.5;
  const lgY = getBeachHeightAt(lgX, lgZ);
  const lifeguardTower = new THREE.Group();
  lifeguardTower.position.set(lgX, lgY - 0.1, lgZ);
  lifeguardTower.rotation.y = 0.25;
  group.add(lifeguardTower);

  // Stilts
  const stiltGeo = new THREE.BoxGeometry(0.16, 2.5, 0.16);
  for (const sx of [-1.0, 1.0]) {
    for (const sz of [-1.0, 1.0]) {
      const stilt = new THREE.Mesh(stiltGeo, whitePaintMat);
      stilt.position.set(sx, 1.25, sz);
      stilt.castShadow = true;
      lifeguardTower.add(stilt);
    }
  }
  // Deck & Cabin
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 2.6), lightWoodMat);
  deck.position.y = 2.45;
  deck.castShadow = true;
  deck.receiveShadow = true;
  lifeguardTower.add(deck);

  const cabinMat = new THREE.MeshStandardMaterial({ color: THEME_PALETTES.Tropical.primary, roughness: 0.75 });
  themedPrimaryMats.push(cabinMat);
  const cabinWall = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.05, 1.9), whitePaintMat);
  cabinWall.position.set(0, 3.05, 0.15);
  cabinWall.castShadow = true;
  lifeguardTower.add(cabinWall);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.85, 0.72, 4), cabinMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 4.42, 0.05);
  roof.castShadow = true;
  lifeguardTower.add(roof);

  // Roof corner posts
  const rPostGeo = new THREE.BoxGeometry(0.1, 1.4, 0.1);
  for (const sx of [-0.92, 0.92]) {
    for (const sz of [-0.88, 0.92]) {
      const rp = new THREE.Mesh(rPostGeo, whitePaintMat);
      rp.position.set(sx, 3.6, sz);
      lifeguardTower.add(rp);
    }
  }

  // Red rescue buoy hanging on front rail
  const buoyMat = new THREE.MeshStandardMaterial({ color: '#d93829', roughness: 0.35 });
  const buoy = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.42, 4, 8), buoyMat);
  buoy.rotation.z = 0.25;
  buoy.position.set(0.65, 2.8, -0.95);
  lifeguardTower.add(buoy);

  // Fluttering wind flag on lifeguard roof
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 6), whitePaintMat);
  flagPole.position.set(0.9, 4.95, 0);
  lifeguardTower.add(flagPole);

  const flagMat = new THREE.MeshStandardMaterial({
    color: THEME_PALETTES.Tropical.secondary,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  themedSecondaryMats.push(flagMat);
  const flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.42, 6, 2), flagMat);
  flagMesh.position.set(1.28, 5.28, 0);
  lifeguardTower.add(flagMesh);

  // --- 3. BEACH SURF SHACK & SURFBOARD RACK (x = -12.5, z = 28.5) ---
  const shackX = -12.5;
  const shackZ = 28.5;
  const shackY = getBeachHeightAt(shackX, shackZ);
  const surfShack = new THREE.Group();
  surfShack.position.set(shackX, shackY - 0.05, shackZ);
  surfShack.rotation.y = 0.18;
  group.add(surfShack);

  const shackPostGeo = new THREE.CylinderGeometry(0.08, 0.09, 2.6, 7);
  for (const sx of [-1.7, 1.7]) {
    for (const sz of [-1.1, 1.1]) {
      const p = new THREE.Mesh(shackPostGeo, woodMat);
      p.position.set(sx, 1.3, sz);
      p.castShadow = true;
      surfShack.add(p);
    }
  }
  const shackRoofMat = new THREE.MeshStandardMaterial({ color: '#b5945b', roughness: 0.92 });
  const shackRoof = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.22, 2.9), shackRoofMat);
  shackRoof.position.set(0, 2.65, 0);
  shackRoof.rotation.x = 0.08;
  shackRoof.castShadow = true;
  surfShack.add(shackRoof);

  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.92, 0.72), lightWoodMat);
  counter.position.set(0, 0.46, -0.55);
  counter.castShadow = true;
  surfShack.add(counter);

  // Surfboard rack next to shack holding 4 colorful boards
  const rackColors = ['#2596a6', '#ff785a', '#f4b942', '#f7f4eb'];
  const rackBoardGeo = new THREE.SphereGeometry(0.23, 10, 8);
  rackBoardGeo.scale(1.0, 4.1, 0.14);
  for (let b = 0; b < 4; b++) {
    const bMat = new THREE.MeshStandardMaterial({
      color: rackColors[b],
      roughness: 0.22,
      metalness: 0.04,
    });
    const board = new THREE.Mesh(rackBoardGeo, bMat);
    board.position.set(2.2 + b * 0.34, 0.95, 0.2);
    board.rotation.set(-0.22, 0.1, 0.04 * (b - 1.5));
    board.castShadow = false;
    surfShack.add(board);
  }

  // --- 4. BEACH UMBRELLAS, LOUNGE CHAIRS, TOWELS, COOLERS & BEACH BALLS ---
  const umbrellaSpecs: { x: number; z: number; slot: 0 | 1 | 2; tilt: number; livelyOnly: boolean }[] = [
    { x: -16.5, z: 22.8, slot: 0, tilt: 0.08, livelyOnly: false },
    { x: -9.5, z: 23.2, slot: 1, tilt: -0.07, livelyOnly: false },
    { x: 9.8, z: 22.6, slot: 2, tilt: 0.06, livelyOnly: false },
    { x: 12.6, z: 24.4, slot: 0, tilt: -0.05, livelyOnly: true },
    { x: 28.5, z: 23.2, slot: 1, tilt: 0.08, livelyOnly: false },
    { x: 32.8, z: 24.8, slot: 2, tilt: -0.06, livelyOnly: true },
    { x: -27.5, z: 23.8, slot: 2, tilt: 0.07, livelyOnly: true },
    { x: 37.5, z: 21.8, slot: 0, tilt: -0.08, livelyOnly: true },
  ];

  const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.35, 7);
  const canopyGeo = new THREE.ConeGeometry(1.48, 0.56, 12, 1, true);
  const towelGeo = new THREE.BoxGeometry(0.98, 0.02, 1.85);
  const chairBaseGeo = new THREE.BoxGeometry(0.68, 0.08, 1.25);

  const loungerAgents: LoungerAgent[] = [];

  umbrellaSpecs.forEach((u, idx) => {
    const uy = getBeachHeightAt(u.x, u.z);
    const setGroup = new THREE.Group();
    setGroup.position.set(u.x, uy, u.z);
    group.add(setGroup);
    if (u.livelyOnly) livelyOnlyObjects.push(setGroup);

    // Pole & Canopy
    const pole = new THREE.Mesh(poleGeo, woodMat);
    pole.position.y = 1.12;
    pole.rotation.z = u.tilt;
    pole.castShadow = true;
    setGroup.add(pole);

    const tex = u.slot === 0 ? texPrimary : u.slot === 1 ? texSecondary : texTertiary;
    const canopyMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    umbrellaMats.push({ mat: canopyMat, slot: u.slot });

    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(-Math.sin(u.tilt) * 2.15, 2.22, 0);
    canopy.rotation.z = u.tilt;
    canopy.castShadow = true;
    setGroup.add(canopy);

    // Beach towel + cooler or wooden lounger
    const towelColor =
      u.slot === 0
        ? THEME_PALETTES.Tropical.primary
        : u.slot === 1
          ? THEME_PALETTES.Tropical.secondary
          : THEME_PALETTES.Tropical.tertiary;
    const towelMat = new THREE.MeshStandardMaterial({ color: towelColor, roughness: 0.92 });
    if (u.slot === 0) themedPrimaryMats.push(towelMat);
    else if (u.slot === 1) themedSecondaryMats.push(towelMat);
    else themedTertiaryMats.push(towelMat);

    const towel = new THREE.Mesh(towelGeo, towelMat);
    towel.position.set(0.75, 0.02, -0.35);
    towel.rotation.y = (idx % 3 - 1) * 0.14;
    towel.receiveShadow = true;
    setGroup.add(towel);

    if (idx % 2 === 0) {
      const chair = new THREE.Mesh(chairBaseGeo, lightWoodMat);
      chair.position.set(-0.78, 0.22, -0.25);
      chair.rotation.x = 0.08;
      chair.castShadow = false;
      setGroup.add(chair);

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.62, 0.08), lightWoodMat);
      back.position.set(-0.78, 0.48, 0.34);
      back.rotation.x = -0.52;
      back.castShadow = false;
      setGroup.add(back);
    }

    // Cooler box beside some umbrellas
    if (idx % 3 === 1) {
      const cooler = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.34, 0.32),
        new THREE.MeshStandardMaterial({ color: '#2b7a9b', roughness: 0.45 })
      );
      cooler.position.set(-0.55, 0.17, 0.42);
      cooler.castShadow = false;
      setGroup.add(cooler);
    }

    // Sunbather resting on towel for selected umbrellas
    if (idx === 0 || idx === 2 || idx === 4 || idx === 6) {
      const bather = createBeachHuman(
        idx % 2 === 0 ? '#c98e67' : '#dfa780',
        towelColor,
        '#1d3557',
        false
      );
      bather.root.position.set(0.75, 0.09, -0.35);
      bather.root.rotation.set(-Math.PI / 2 + 0.12, 0, (idx % 3 - 1) * 0.14);
      bather.torso.rotation.x = 0.28;
      setGroup.add(bather.root);
      loungerAgents.push({
        group: bather.root,
        armWave: bather.rightArm,
        phase: idx * 1.4,
        isLivelyOnly: u.livelyOnly,
      });
    }
  });

  // Colorful Beach Balls on sand
  const beachBallSpots: [number, number][] = [
    [13.4, 21.8],
    [-14.5, 21.0],
    [30.5, 22.0],
  ];
  const ballGeo = new THREE.SphereGeometry(0.24, 12, 10);
  beachBallSpots.forEach(([bx, bz], i) => {
    const bMat = new THREE.MeshStandardMaterial({
      color: i === 0 ? '#ff6b57' : i === 1 ? '#f4b942' : '#2ec4b6',
      roughness: 0.35,
    });
    const ball = new THREE.Mesh(ballGeo, bMat);
    ball.position.set(bx, getBeachHeightAt(bx, bz) + 0.22, bz);
    ball.castShadow = false;
    group.add(ball);
    if (i > 0) livelyOnlyObjects.push(ball);
  });

  // Driftwood logs resting near upper tide line
  const logSpots: [number, number, number][] = [
    [-29.5, 19.6, 0.35],
    [34.5, 18.8, -0.45],
    [-19.2, 20.5, 0.12],
  ];
  const logGeo = new THREE.CylinderGeometry(0.13, 0.16, 2.3, 8);
  const logMat = new THREE.MeshStandardMaterial({ color: '#7a6855', roughness: 0.94 });
  logSpots.forEach(([lx, lz, rot]) => {
    const log = new THREE.Mesh(logGeo, logMat);
    log.rotation.set(Math.PI / 2, rot, 0.05);
    log.position.set(lx, getBeachHeightAt(lx, lz) + 0.1, lz);
    log.castShadow = false;
    group.add(log);
  });

  // --- 5. INSTANCED SEASHELLS & STARFISH ALONG FORESHORE ---
  const shellCount = 90;
  const shellGeo = new THREE.ConeGeometry(0.08, 0.05, 5);
  const shellMat = new THREE.MeshStandardMaterial({ roughness: 0.65 });
  const shellInst = new THREE.InstancedMesh(shellGeo, shellMat, shellCount);
  for (let i = 0; i < shellCount; i++) {
    const sx = -32 + ((i * 73) % 68);
    const sz = 13.5 + ((i * 29) % 8.5);
    const sy = getBeachHeightAt(sx, sz);
    _dummy.position.set(sx, sy + 0.02, sz);
    _dummy.rotation.set(Math.PI / 2, i * 1.3, 0);
    _dummy.scale.setScalar(0.75 + (i % 4) * 0.25);
    _dummy.updateMatrix();
    shellInst.setMatrixAt(i, _dummy.matrix);
    _color.set(i % 6 === 0 ? '#e06d53' : i % 3 === 0 ? '#f3e5cf' : '#dfd0b8');
    shellInst.setColorAt(i, _color);
  }
  shellInst.instanceMatrix.needsUpdate = true;
  if (shellInst.instanceColor) shellInst.instanceColor.needsUpdate = true;
  group.add(shellInst);

  // --- 6. ANIMATED BEACH WALKERS, SURFERS WATCHING WAVES & SHALLOW WADERS ---
  const walkers: WalkerAgent[] = [
    // Left shoreline walkers (x in [-30..-9], clear of player's x in [-7..+7])
    {
      rig: createBeachHuman('#d8a07a', '#f7f4eb', '#2a9d8f', true),
      xStart: -28,
      xEnd: -9.5,
      zBase: 16.4,
      speed: 1.05,
      phase: 0.4,
      isLivelyOnly: false,
    },
    // Right shoreline walkers (x in [8.5..34])
    {
      rig: createBeachHuman('#9c6440', '#ff785a', '#1d3557', false),
      xStart: 9.0,
      xEnd: 32.0,
      zBase: 15.8,
      speed: 1.12,
      phase: 2.8,
      isLivelyOnly: false,
    },
    {
      rig: createBeachHuman('#e3b48e', '#f4b942', '#264653', true),
      xStart: 12.0,
      xEnd: 36.0,
      zBase: 18.2,
      speed: 0.92,
      phase: 4.5,
      isLivelyOnly: true,
    },
  ];
  walkers.forEach((w) => {
    group.add(w.rig.root);
    if (w.isLivelyOnly) livelyOnlyObjects.push(w.rig.root);
  });

  // Standing surfers / onlookers & waders facing ocean (-Z)
  const spectators: { rig: HumanCharacterRig; phase: number; livelyOnly: boolean; inWater: boolean }[] = [
    {
      rig: createBeachHuman('#b87a52', '#2596a6', '#0b2239', true),
      phase: 0.2,
      livelyOnly: false,
      inWater: false,
    },
    {
      rig: createBeachHuman('#e0ac84', '#ffffff', '#e76f51', false),
      phase: 1.7,
      livelyOnly: true,
      inWater: true,
    },
    {
      rig: createBeachHuman('#8d5524', '#f4b942', '#1d3557', false),
      phase: 3.1,
      livelyOnly: true,
      inWater: true,
    },
  ];
  const specCoords: [number, number][] = [
    [-9.2, 21.8], // Surfer near shack checking swell
    [-25.5, 11.8], // Wader in shallow shorewash left
    [29.5, 11.4], // Wader in shallow shorewash right
  ];
  spectators.forEach((sp, i) => {
    const [sx, sz] = specCoords[i];
    sp.rig.root.position.set(sx, getBeachHeightAt(sx, sz), sz);
    sp.rig.root.rotation.y = Math.PI; // Facing ocean (-Z)
    group.add(sp.rig.root);
    if (sp.livelyOnly) livelyOnlyObjects.push(sp.rig.root);
  });

  let currentAtmosphere: BeachAtmosphere = 'Lively';
  let currentTheme: BeachTheme = 'Tropical';
  let lastRallyHalf = -1;
  let distantAccum = 0;

  const setConfig = (atmosphere: BeachAtmosphere, theme: BeachTheme) => {
    if (atmosphere !== currentAtmosphere) {
      currentAtmosphere = atmosphere;
      const showLively = atmosphere === 'Lively';
      for (let i = 0; i < livelyOnlyObjects.length; i++) {
        livelyOnlyObjects[i].visible = showLively;
      }
    }

    if (theme !== currentTheme) {
      currentTheme = theme;
      const pal = THEME_PALETTES[theme];
      themedPrimaryMats.forEach((m) => m.color.set(pal.primary));
      themedSecondaryMats.forEach((m) => m.color.set(pal.secondary));
      themedTertiaryMats.forEach((m) => m.color.set(pal.tertiary));

      const nextPrimary = createStripedUmbrellaTexture(pal.primary, pal.trim);
      const nextSecondary = createStripedUmbrellaTexture(pal.secondary, pal.trim);
      const nextTertiary = createStripedUmbrellaTexture(pal.tertiary, pal.trim);
      dynamicTextures.push(nextPrimary, nextSecondary, nextTertiary);

      texPrimary.dispose();
      texSecondary.dispose();
      texTertiary.dispose();
      texPrimary = nextPrimary;
      texSecondary = nextSecondary;
      texTertiary = nextTertiary;

      umbrellaMats.forEach((item) => {
        item.mat.map =
          item.slot === 0 ? texPrimary : item.slot === 1 ? texSecondary : texTertiary;
        item.mat.needsUpdate = true;
      });
    }
  };

  return {
    group,
    setConfig,
    update: (time, windStrength, dt = 0.016, camZ = 10, underwaterAmount = 0) => {
      if (underwaterAmount > 0.35) {
        return { volleyballHitPulse: false };
      }
      if (camZ < -8) {
        distantAccum += dt;
        if (distantAccum < 0.065) {
          return { volleyballHitPulse: false };
        }
        distantAccum = 0;
      } else {
        distantAccum = 0;
      }
      let volleyballHitPulse = false;

      // 1. Lifeguard flag flutter
      const windAmp = 0.1 + windStrength * 0.25;
      flagMesh.rotation.y = Math.sin(time * (4.5 + windStrength * 3.0)) * windAmp;

      // 2. Active Volleyball Rally Animation
      if (vbGroup.visible) {
        const rallyFreq = 0.72; // ~1.4s per arc across net
        const rawCycle = time * rallyFreq;
        const rallyHalf = Math.floor(rawCycle);
        const u = rawCycle - rallyHalf; // 0..1 across current pass
        const goingRight = rallyHalf % 2 === 0;

        if (rallyHalf !== lastRallyHalf) {
          lastRallyHalf = rallyHalf;
          volleyballHitPulse = true;
        }

        const startX = goingRight ? vbCenterX - 2.3 : vbCenterX + 2.2;
        const endX = goingRight ? vbCenterX + 2.2 : vbCenterX - 2.3;
        const startZ = vbCenterZ + Math.sin(rallyHalf * 1.7) * 1.1;
        const endZ = vbCenterZ + Math.sin((rallyHalf + 1) * 1.7) * 1.1;

        const bx = THREE.MathUtils.lerp(startX, endX, u);
        const bz = THREE.MathUtils.lerp(startZ, endZ, u);
        const by = vbGroundY + 1.55 + Math.sin(u * Math.PI) * 2.15;
        volleyball.position.set(bx, by, bz);
        volleyball.rotation.x += 0.08;
        volleyball.rotation.z += 0.06;

        for (let i = 0; i < vbPlayers.length; i++) {
          const vp = vbPlayers[i];
          const isReceivingSide = (goingRight && vp.sideSign > 0) || (!goingRight && vp.sideSign < 0);
          const nearHit = isReceivingSide && u > 0.72;
          const jumpH = nearHit ? Math.sin(((u - 0.72) / 0.28) * Math.PI) * 0.42 : 0;
          const shuffleX = Math.sin(time * 2.4 + vp.phase) * 0.45;
          const shuffleZ = Math.cos(time * 1.9 + vp.phase) * 0.42;
          const px = vp.baseX + shuffleX;
          const pz = vp.baseZ + shuffleZ;
          const py = getBeachHeightAt(px, pz) + jumpH;
          vp.rig.root.position.set(px, py, pz);

          // Arms raise to bump/set/spike when ball approaches
          const armRaise = nearHit ? -2.35 : -0.75 + Math.sin(time * 3.5 + vp.phase) * 0.25;
          vp.rig.leftArm.rotation.x = armRaise;
          vp.rig.rightArm.rotation.x = armRaise;
          vp.rig.hips.position.y = 0.88 - Math.abs(Math.sin(time * 3.8 + vp.phase)) * 0.06;
        }
      }

      // 3. Shoreline Walkers strolling smoothly back and forth
      for (let i = 0; i < walkers.length; i++) {
        const w = walkers[i];
        if (!w.rig.root.visible) continue;
        const span = w.xEnd - w.xStart;
        const travel = (time * w.speed + w.phase * 5.0) % (span * 2);
        const forward = travel <= span;
        const wx = forward ? w.xStart + travel : w.xEnd - (travel - span);
        const wz = w.zBase + Math.sin(wx * 0.14) * 0.65;
        const wy = getBeachHeightAt(wx, wz);

        w.rig.root.position.set(wx, wy, wz);
        w.rig.root.rotation.y = forward ? Math.PI / 2 : -Math.PI / 2;

        const stride = Math.sin(time * 5.6 + w.phase) * 0.48;
        w.rig.leftLeg.rotation.x = stride;
        w.rig.rightLeg.rotation.x = -stride;
        w.rig.leftArm.rotation.x = -stride * 0.72;
        w.rig.rightArm.rotation.x = stride * 0.72;
        w.rig.hips.position.y = 0.88 + Math.abs(Math.cos(time * 5.6 + w.phase)) * 0.03;
      }

      // 4. Spectators & shallow water waders
      for (let i = 0; i < spectators.length; i++) {
        const sp = spectators[i];
        if (!sp.rig.root.visible) continue;
        const sway = Math.sin(time * 1.4 + sp.phase) * 0.08;
        sp.rig.torso.rotation.z = sway;
        if (sp.inWater) {
          sp.rig.leftArm.rotation.x = -0.35 + Math.sin(time * 2.2 + sp.phase) * 0.28;
          sp.rig.rightArm.rotation.x = -0.35 + Math.cos(time * 2.0 + sp.phase) * 0.28;
          sp.rig.hips.position.y = 0.85 + Math.sin(time * 2.4 + sp.phase) * 0.04;
        }
      }

      // 5. Sunbathers occasional relaxing stretch
      for (let i = 0; i < loungerAgents.length; i++) {
        const l = loungerAgents[i];
        if (!l.group.visible || !l.armWave) continue;
        l.armWave.rotation.z = 0.15 + Math.sin(time * 0.9 + l.phase) * 0.12;
      }

      return { volleyballHitPulse };
    },
    dispose: () => {
      dynamicTextures.forEach((t) => t.dispose());
      group.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    },
  };
}
