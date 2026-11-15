import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getBeachHeightAt } from './oceanShader';
import { sampleSurfWave, SurfWaveParams } from './wavePhysics';

export interface MarineLifeSystem {
  group: THREE.Group;
  setEnabled: (enabled: boolean) => void;
  update: (
    time: number,
    dt: number,
    surferPos: THREE.Vector3 | null,
    waveParams: SurfWaveParams | null,
    camPos?: THREE.Vector3 | null
  ) => void;
  dispose: () => void;
}

interface FishAgent {
  schoolCenterX: number;
  schoolCenterZ: number;
  radiusX: number;
  radiusZ: number;
  baseDepthOffset: number;
  speed: number;
  phase: number;
  scale: number;
  bobAmp: number;
  scatterX: number;
  scatterZ: number;
}

interface KelpBlade {
  x: number;
  y: number;
  z: number;
  scaleY: number;
  scaleXZ: number;
  rotY: number;
  phase: number;
}

interface SeaTurtle {
  group: THREE.Group;
  frontLeft: THREE.Mesh;
  frontRight: THREE.Mesh;
  rearLeft: THREE.Mesh;
  rearRight: THREE.Mesh;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  speed: number;
  phase: number;
}

interface DolphinAgent {
  group: THREE.Group;
  tailFluke: THREE.Mesh;
  baseX: number;
  baseZ: number;
  dirAngle: number;
  cyclePeriod: number;
  phaseOffset: number;
}

interface SeagullAgent {
  group: THREE.Group;
  leftWingPivot: THREE.Group;
  rightWingPivot: THREE.Group;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  baseY: number;
  speed: number;
  phase: number;
  flapSpeed: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildBranchingCoralGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.08, 0.14, 0.55, 6);
  trunk.translate(0, 0.25, 0);
  parts.push(trunk);

  const branches: [number, number, number, number, number][] = [
    [0.36, 0.22, 0.08, 0.45, 0.2],
    [-0.38, -0.25, 0.1, 0.42, -0.15],
    [0.12, -0.1, 0.42, 0.4, 0.4],
    [-0.18, 0.15, -0.35, 0.38, -0.35],
    [0.22, -0.28, -0.22, 0.35, 0.12],
  ];
  for (const [rx, rz, tx, len, ty] of branches) {
    const b = new THREE.CylinderGeometry(0.045, 0.085, len, 6);
    b.translate(0, len * 0.5, 0);
    b.rotateZ(rx);
    b.rotateX(rz);
    b.translate(tx * 0.25, 0.32 + Math.abs(ty) * 0.2, tx * 0.2);
    parts.push(b);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildFishGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Streamlined fusiform body along +Z
  const body = new THREE.SphereGeometry(0.11, 8, 6);
  body.scale(0.55, 0.88, 1.85);
  parts.push(body);

  // Tail fin at -Z
  const tail = new THREE.ConeGeometry(0.095, 0.16, 3);
  tail.rotateX(Math.PI / 2);
  tail.scale(0.32, 1.1, 1.0);
  tail.translate(0, 0, -0.22);
  parts.push(tail);

  // Dorsal fin
  const dorsal = new THREE.ConeGeometry(0.05, 0.1, 3);
  dorsal.rotateX(-0.35);
  dorsal.scale(0.35, 1.0, 1.2);
  dorsal.translate(0, 0.09, -0.02);
  parts.push(dorsal);

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function createSeaTurtle(scale: number): SeaTurtle {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const shellMat = new THREE.MeshStandardMaterial({
    color: '#3e5e3b',
    roughness: 0.6,
    metalness: 0.05,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: '#6b7d4c',
    roughness: 0.65,
    metalness: 0.02,
  });

  // Domed carapace
  const shellGeo = new THREE.SphereGeometry(0.52, 12, 8);
  shellGeo.scale(0.95, 0.42, 1.25);
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.position.y = 0.06;
  group.add(shell);

  // Shell rim
  const rimGeo = new THREE.TorusGeometry(0.49, 0.07, 6, 14);
  rimGeo.rotateX(Math.PI / 2);
  rimGeo.scale(0.96, 1.24, 0.65);
  const rim = new THREE.Mesh(rimGeo, skinMat);
  group.add(rim);

  // Head
  const headGeo = new THREE.SphereGeometry(0.14, 8, 6);
  headGeo.scale(0.85, 0.78, 1.25);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 0.03, 0.66);
  group.add(head);

  // 4 Flippers
  const frontFlipperGeo = new THREE.BoxGeometry(0.54, 0.04, 0.18);
  frontFlipperGeo.translate(0.25, 0, 0);
  const frontLeft = new THREE.Mesh(frontFlipperGeo, skinMat);
  frontLeft.position.set(0.32, 0.0, 0.25);
  frontLeft.rotation.y = -0.35;
  group.add(frontLeft);

  const frontRightGeo = new THREE.BoxGeometry(0.54, 0.04, 0.18);
  frontRightGeo.translate(-0.25, 0, 0);
  const frontRight = new THREE.Mesh(frontRightGeo, skinMat);
  frontRight.position.set(-0.32, 0.0, 0.25);
  frontRight.rotation.y = 0.35;
  group.add(frontRight);

  const rearGeo = new THREE.BoxGeometry(0.28, 0.035, 0.13);
  const rearLeft = new THREE.Mesh(rearGeo, skinMat);
  rearLeft.position.set(0.26, -0.02, -0.52);
  rearLeft.rotation.y = -0.6;
  group.add(rearLeft);

  const rearRight = new THREE.Mesh(rearGeo, skinMat);
  rearRight.position.set(-0.26, -0.02, -0.52);
  rearRight.rotation.y = 0.6;
  group.add(rearRight);

  return {
    group,
    frontLeft,
    frontRight,
    rearLeft,
    rearRight,
    cx: 0,
    cz: -30,
    rx: 10,
    rz: 6,
    speed: 0.25,
    phase: 0,
  };
}

function createDolphinMesh(): { group: THREE.Group; tailFluke: THREE.Mesh } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: '#526f86',
    roughness: 0.24,
    metalness: 0.06,
    clearcoat: 0.85,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: '#cddae2',
    roughness: 0.35,
  });

  // Streamlined body along +Z
  const torsoGeo = new THREE.SphereGeometry(0.26, 12, 10);
  torsoGeo.scale(0.85, 0.95, 3.8);
  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  group.add(torso);

  const bellyGeo = new THREE.SphereGeometry(0.22, 10, 8);
  bellyGeo.scale(0.75, 0.55, 3.1);
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.position.set(0, -0.07, 0.08);
  group.add(belly);

  // Rostrum / snout
  const snoutGeo = new THREE.ConeGeometry(0.11, 0.45, 8);
  snoutGeo.rotateX(Math.PI / 2);
  const snout = new THREE.Mesh(snoutGeo, bodyMat);
  snout.position.set(0, -0.04, 1.05);
  group.add(snout);

  // Curved dorsal fin
  const dorsalGeo = new THREE.ConeGeometry(0.14, 0.36, 4);
  dorsalGeo.rotateX(-0.42);
  dorsalGeo.scale(0.28, 1.0, 1.35);
  const dorsal = new THREE.Mesh(dorsalGeo, bodyMat);
  dorsal.position.set(0, 0.32, -0.05);
  group.add(dorsal);

  // Pectoral fins
  const pecGeo = new THREE.BoxGeometry(0.45, 0.03, 0.16);
  const leftPec = new THREE.Mesh(pecGeo, bodyMat);
  leftPec.position.set(0.22, -0.1, 0.24);
  leftPec.rotation.set(0.15, -0.45, -0.35);
  group.add(leftPec);

  const rightPec = new THREE.Mesh(pecGeo, bodyMat);
  rightPec.position.set(-0.22, -0.1, 0.24);
  rightPec.rotation.set(0.15, 0.45, 0.35);
  group.add(rightPec);

  // Tail fluke
  const flukeGeo = new THREE.BoxGeometry(0.58, 0.035, 0.22);
  const tailFluke = new THREE.Mesh(flukeGeo, bodyMat);
  tailFluke.position.set(0, 0, -1.0);
  group.add(tailFluke);

  return { group, tailFluke };
}

function createSeagull(): SeagullAgent {
  const group = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 0.75 });
  const tipMat = new THREE.MeshStandardMaterial({ color: '#394654', roughness: 0.8 });
  const beakMat = new THREE.MeshStandardMaterial({ color: '#e69f28', roughness: 0.55 });

  const bodyGeo = new THREE.SphereGeometry(0.11, 8, 6);
  bodyGeo.scale(0.75, 0.72, 2.2);
  const body = new THREE.Mesh(bodyGeo, whiteMat);
  group.add(body);

  const beakGeo = new THREE.ConeGeometry(0.03, 0.14, 5);
  beakGeo.rotateX(Math.PI / 2);
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.position.set(0, 0.01, 0.27);
  group.add(beak);

  const wingGeo = new THREE.BoxGeometry(0.52, 0.02, 0.16);
  const wingTipGeo = new THREE.BoxGeometry(0.22, 0.018, 0.12);

  const leftWingPivot = new THREE.Group();
  leftWingPivot.position.set(0.06, 0.02, 0.03);
  const lw = new THREE.Mesh(wingGeo, whiteMat);
  lw.position.set(0.26, 0, 0);
  const lwt = new THREE.Mesh(wingTipGeo, tipMat);
  lwt.position.set(0.58, 0, -0.02);
  leftWingPivot.add(lw, lwt);
  group.add(leftWingPivot);

  const rightWingPivot = new THREE.Group();
  rightWingPivot.position.set(-0.06, 0.02, 0.03);
  const rw = new THREE.Mesh(wingGeo, whiteMat);
  rw.position.set(-0.26, 0, 0);
  const rwt = new THREE.Mesh(wingTipGeo, tipMat);
  rwt.position.set(-0.58, 0, -0.02);
  rightWingPivot.add(rw, rwt);
  group.add(rightWingPivot);

  return {
    group,
    leftWingPivot,
    rightWingPivot,
    cx: 0,
    cz: -10,
    rx: 18,
    rz: 12,
    baseY: 12,
    speed: 0.3,
    phase: 0,
    flapSpeed: 6,
  };
}

export function createMarineLifeSystem(): MarineLifeSystem {
  const group = new THREE.Group();
  const rand = seededRandom(8421);

  // --- 1. CORAL REEF GARDENS ON SUBMERGED SEABED (z in [-86, +2]) ---
  const reefGroup = new THREE.Group();
  group.add(reefGroup);

  // Brain / Boulder Corals
  const brainGeo = new THREE.IcosahedronGeometry(0.42, 1);
  const brainPos = brainGeo.attributes.position;
  for (let i = 0; i < brainPos.count; i++) {
    const vx = brainPos.getX(i);
    const vy = brainPos.getY(i);
    const vz = brainPos.getZ(i);
    const bump = 1 + 0.14 * Math.sin(vx * 9 + vz * 8 + vy * 7);
    brainPos.setXYZ(i, vx * bump, Math.max(-0.18, vy * 0.85 * bump), vz * bump);
  }
  brainGeo.computeVertexNormals();
  const brainMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02 });
  const brainCount = 92;
  const brainInst = new THREE.InstancedMesh(brainGeo, brainMat, brainCount);
  brainInst.receiveShadow = true;

  // Branching Staghorn Corals
  const branchGeo = buildBranchingCoralGeo();
  const branchMat = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.03 });
  const branchCount = 108;
  const branchInst = new THREE.InstancedMesh(branchGeo, branchMat, branchCount);
  branchInst.receiveShadow = true;

  // Table / Fan Corals
  const plateGeo = new THREE.CylinderGeometry(0.55, 0.14, 0.18, 9);
  plateGeo.translate(0, 0.22, 0);
  const plateMat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.04 });
  const plateCount = 62;
  const plateInst = new THREE.InstancedMesh(plateGeo, plateMat, plateCount);
  plateInst.receiveShadow = true;

  const coralPalette = [
    '#e87a64', // warm reef coral
    '#f2a65a', // golden mustard coral
    '#34b3a0', // seafoam turquoise
    '#d96b96', // reef magenta rose
    '#9b84d4', // lavender staghorn
    '#e8cf86', // sand ochre brain coral
    '#4395c7', // deep teal plate
  ];

  // Reef cluster centers across shallow & mid sandbar/reef shelves (visible through clear water!)
  const reefClusters: [number, number][] = [
    [-22, -16],
    [-12, -26],
    [16, -20],
    [28, -32],
    [-26, -38],
    [8, -44],
    [-8, -56],
    [24, -52],
    [-34, -22],
    [38, -22],
    [4, -14],
    [-18, -8],
    [20, -10],
    [-40, -45],
    [44, -46],
    [0, -72],
  ];

  const placeCoralInstances = (
    inst: THREE.InstancedMesh,
    count: number,
    minScale: number,
    maxScale: number
  ) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 6) {
      guard++;
      const cluster = reefClusters[placed % reefClusters.length];
      const angle = rand() * Math.PI * 2;
      const dist = Math.pow(rand(), 0.7) * 10.5;
      const x = cluster[0] + Math.cos(angle) * dist;
      const z = cluster[1] + Math.sin(angle) * dist;
      const groundY = getBeachHeightAt(x, z);
      // Ensure strictly underwater seabed (avoid dry shore or headland rocks)
      if (groundY > -0.58 || x < -42 || x > 62) continue;

      const s = minScale + rand() * (maxScale - minScale);
      _dummy.position.set(x, groundY - 0.05, z);
      _dummy.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI * 2, (rand() - 0.5) * 0.25);
      _dummy.scale.set(s * (0.85 + rand() * 0.35), s * (0.8 + rand() * 0.45), s * (0.85 + rand() * 0.35));
      _dummy.updateMatrix();
      inst.setMatrixAt(placed, _dummy.matrix);

      _color.set(coralPalette[Math.floor(rand() * coralPalette.length)]);
      _color.offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.08);
      inst.setColorAt(placed, _color);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  };

  placeCoralInstances(brainInst, brainCount, 0.85, 1.9);
  placeCoralInstances(branchInst, branchCount, 0.9, 1.85);
  placeCoralInstances(plateInst, plateCount, 0.95, 2.1);

  reefGroup.add(brainInst, branchInst, plateInst);

  // --- 2. SWAYING SEAGRASS & KELP RIBBONS ---
  const kelpGeo = new THREE.PlaneGeometry(0.24, 1.1, 1, 4);
  kelpGeo.translate(0, 0.55, 0);
  const kelpMat = new THREE.MeshStandardMaterial({
    color: '#2d7a4f',
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const kelpCount = 150;
  const kelpInst = new THREE.InstancedMesh(kelpGeo, kelpMat, kelpCount);
  kelpInst.frustumCulled = false;
  const kelpBlades: KelpBlade[] = [];

  for (let i = 0; i < kelpCount * 3 && kelpBlades.length < kelpCount; i++) {
    const cluster = reefClusters[i % reefClusters.length];
    const x = cluster[0] + (rand() - 0.5) * 18;
    const z = cluster[1] + (rand() - 0.5) * 18;
    const y = getBeachHeightAt(x, z);
    if (y > -0.75 || x < -42 || x > 62) continue;

    const blade: KelpBlade = {
      x,
      y: y - 0.04,
      z,
      scaleY: 0.7 + rand() * 1.15,
      scaleXZ: 0.8 + rand() * 0.7,
      rotY: rand() * Math.PI * 2,
      phase: rand() * Math.PI * 2,
    };
    const idx = kelpBlades.length;
    kelpBlades.push(blade);
    _color.setHSL(0.32 + (rand() - 0.5) * 0.06, 0.52, 0.25 + rand() * 0.14);
    kelpInst.setColorAt(idx, _color);
  }
  kelpInst.count = kelpBlades.length;
  if (kelpInst.instanceColor) kelpInst.instanceColor.needsUpdate = true;
  reefGroup.add(kelpInst);

  // --- 3. TROPICAL REEF FISH SCHOOLS (~115 FISH) ---
  const fishGeo = buildFishGeo();
  const fishMat = new THREE.MeshStandardMaterial({
    roughness: 0.32,
    metalness: 0.18,
  });
  const fishAgents: FishAgent[] = [];
  const schoolCenters: [number, number, number, string][] = [
    [-16, -20, 24, '#f5c23b'], // Yellow tang school
    [14, -22, 24, '#36d1dc'], // Turquoise reef chromis
    [-6, -36, 22, '#ff7e47'], // Reef anthias
    [24, -36, 22, '#4f86f7'], // Cobalt damselfish
    [2, -14, 24, '#cfdce6'], // Silver baitfish near shallow bar
  ];

  const totalFish = schoolCenters.reduce((sum, s) => sum + s[2], 0);
  const fishInst = new THREE.InstancedMesh(fishGeo, fishMat, totalFish);
  fishInst.frustumCulled = false;

  let fIdx = 0;
  for (let sc = 0; sc < schoolCenters.length; sc++) {
    const [sx, sz, count, hex] = schoolCenters[sc];
    for (let j = 0; j < count; j++) {
      fishAgents.push({
        schoolCenterX: sx + (rand() - 0.5) * 3.5,
        schoolCenterZ: sz + (rand() - 0.5) * 3.5,
        radiusX: 3.5 + rand() * 5.8,
        radiusZ: 2.8 + rand() * 4.5,
        baseDepthOffset: 0.35 + rand() * 1.15,
        speed: (0.42 + rand() * 0.38) * (sc % 2 === 0 ? 1 : -1),
        phase: (j / count) * Math.PI * 2 + rand() * 0.45,
        scale: 0.72 + rand() * 0.65,
        bobAmp: 0.08 + rand() * 0.1,
        scatterX: 0,
        scatterZ: 0,
      });
      _color.set(hex).offsetHSL((rand() - 0.5) * 0.04, 0.05, (rand() - 0.5) * 0.08);
      fishInst.setColorAt(fIdx, _color);
      fIdx++;
    }
  }
  if (fishInst.instanceColor) fishInst.instanceColor.needsUpdate = true;
  group.add(fishInst);

  // --- 4. SEA TURTLES GLIDING OVER REEF ---
  const turtles: SeaTurtle[] = [
    Object.assign(createSeaTurtle(0.95), {
      cx: -14,
      cz: -28,
      rx: 11,
      rz: 7,
      speed: 0.19,
      phase: 0.4,
    }),
    Object.assign(createSeaTurtle(1.12), {
      cx: 18,
      cz: -38,
      rx: 13,
      rz: 8,
      speed: -0.16,
      phase: 2.3,
    }),
    Object.assign(createSeaTurtle(0.84), {
      cx: 2,
      cz: -18,
      rx: 9,
      rz: 5,
      speed: 0.22,
      phase: 4.1,
    }),
  ];
  turtles.forEach((t) => group.add(t.group));

  // --- 5. LEAPING DOLPHIN POD IN OUTER OCEAN ---
  const dolphins: DolphinAgent[] = [
    { ...createDolphinMesh(), baseX: -28, baseZ: -86, dirAngle: 0.35, cyclePeriod: 9.5, phaseOffset: 0.0 },
    { ...createDolphinMesh(), baseX: -25.5, baseZ: -88, dirAngle: 0.35, cyclePeriod: 9.5, phaseOffset: 0.45 },
    { ...createDolphinMesh(), baseX: 28, baseZ: -96, dirAngle: -0.45, cyclePeriod: 11.2, phaseOffset: 4.6 },
  ];
  dolphins.forEach((d) => {
    d.group.scale.setScalar(1.05);
    group.add(d.group);
  });

  // --- 6. SOARING COASTAL SEAGULLS ---
  const gulls: SeagullAgent[] = [
    { ...createSeagull(), cx: -8, cz: -14, rx: 22, rz: 16, baseY: 11.5, speed: 0.28, phase: 0.2, flapSpeed: 6.2 },
    { ...createSeagull(), cx: 12, cz: -6, rx: 26, rz: 18, baseY: 13.8, speed: -0.24, phase: 1.9, flapSpeed: 5.8 },
    { ...createSeagull(), cx: -22, cz: 4, rx: 18, rz: 14, baseY: 10.2, speed: 0.33, phase: 3.1, flapSpeed: 6.6 },
    { ...createSeagull(), cx: 26, cz: -24, rx: 28, rz: 20, baseY: 15.0, speed: 0.22, phase: 4.4, flapSpeed: 5.5 },
    { ...createSeagull(), cx: 0, cz: -34, rx: 32, rz: 22, baseY: 16.5, speed: -0.2, phase: 5.3, flapSpeed: 5.9 },
    { ...createSeagull(), cx: -12, cz: 14, rx: 16, rz: 12, baseY: 9.4, speed: 0.36, phase: 2.6, flapSpeed: 6.8 },
  ];
  gulls.forEach((g) => group.add(g.group));

  let enabled = true;
  let kelpAccum = 0.05;
  let fishAccum = 0.05;
  let turtleAccum = 0.04;

  return {
    group,
    setEnabled: (val: boolean) => {
      enabled = val;
      group.visible = val;
    },
    update: (time, dt, surferPos, waveParams, camPos = null) => {
      if (!enabled) return;

      const onHighDryBeach = camPos !== null && camPos.z > 14 && camPos.y > 2.4;

      // 1. Kelp & seagrass gentle surge sway (throttled to ~22Hz, skipped from upper beach)
      if (!onHighDryBeach) {
        kelpAccum += dt;
        if (kelpAccum >= 0.045) {
          kelpAccum = 0;
          for (let i = 0; i < kelpBlades.length; i++) {
            const k = kelpBlades[i];
            const swayX = Math.sin(time * 1.9 + k.phase + k.x * 0.2) * 0.32;
            const swayZ = Math.cos(time * 1.5 + k.phase + k.z * 0.2) * 0.26;
            _dummy.position.set(k.x, k.y, k.z);
            _dummy.rotation.set(swayZ, k.rotY, swayX);
            _dummy.scale.set(k.scaleXZ, k.scaleY, k.scaleXZ);
            _dummy.updateMatrix();
            kelpInst.setMatrixAt(i, _dummy.matrix);
          }
          kelpInst.instanceMatrix.needsUpdate = true;
        }

        // 2. Fish schools orbiting reef & scattering gently away from nearby surfer (throttled ~25Hz)
        fishAccum += dt;
        if (fishAccum >= 0.04) {
          const fishDt = fishAccum;
          fishAccum = 0;
          for (let i = 0; i < fishAgents.length; i++) {
            const f = fishAgents[i];
            const ang = time * f.speed + f.phase;
            let fx = f.schoolCenterX + Math.cos(ang) * f.radiusX;
            let fz = f.schoolCenterZ + Math.sin(ang) * f.radiusZ;

            if (surferPos) {
              const dx = fx - surferPos.x;
              const dz = fz - surferPos.z;
              const distSq = dx * dx + dz * dz;
              if (distSq < 36 && distSq > 0.01) {
                const d = Math.sqrt(distSq);
                const push = (6 - d) * 0.65;
                f.scatterX = THREE.MathUtils.damp(f.scatterX, (dx / d) * push, 6, fishDt);
                f.scatterZ = THREE.MathUtils.damp(f.scatterZ, (dz / d) * push, 6, fishDt);
              } else if (Math.abs(f.scatterX) > 0.002 || Math.abs(f.scatterZ) > 0.002) {
                f.scatterX = THREE.MathUtils.damp(f.scatterX, 0, 2.2, fishDt);
                f.scatterZ = THREE.MathUtils.damp(f.scatterZ, 0, 2.2, fishDt);
              }
            }
            fx += f.scatterX;
            fz += f.scatterZ;

            const seabedY = getBeachHeightAt(fx, fz);
            const nearWave = waveParams !== null && Math.abs(fz - waveParams.waveCenterZ) < 22;
            const waterY = nearWave ? sampleSurfWave(fx, fz, waveParams).height : 0.15;
            const desiredY = seabedY + f.baseDepthOffset + Math.sin(time * 2.8 + f.phase) * f.bobAmp;
            const fy = THREE.MathUtils.clamp(desiredY, seabedY + 0.22, waterY - 0.26);

            // Tangent heading along ellipse + subtle tail wag
            const vx = -Math.sin(ang) * f.radiusX * f.speed;
            const vz = Math.cos(ang) * f.radiusZ * f.speed;
            const yaw = Math.atan2(vx, vz) + Math.sin(time * 9.5 + f.phase) * 0.12;

            _dummy.position.set(fx, fy, fz);
            _dummy.rotation.set(0, yaw, 0);
            _dummy.scale.setScalar(f.scale);
            _dummy.updateMatrix();
            fishInst.setMatrixAt(i, _dummy.matrix);
          }
          fishInst.instanceMatrix.needsUpdate = true;
        }
      }

      // 3. Sea turtles swimming cleanly below surface (throttled ~30Hz)
      turtleAccum += dt;
      if (turtleAccum >= 0.032) {
        turtleAccum = 0;
        for (let i = 0; i < turtles.length; i++) {
          const tu = turtles[i];
          const ang = time * tu.speed + tu.phase;
          const tx = tu.cx + Math.cos(ang) * tu.rx;
          const tz = tu.cz + Math.sin(ang) * tu.rz;
          const seabedY = getBeachHeightAt(tx, tz);
          const nearWave = waveParams !== null && Math.abs(tz - waveParams.waveCenterZ) < 22;
          const waterY = nearWave ? sampleSurfWave(tx, tz, waveParams).height : 0.15;
          const ty = THREE.MathUtils.clamp(
            seabedY + 0.85 + Math.sin(time * 1.1 + tu.phase) * 0.18,
            seabedY + 0.35,
            waterY - 0.35
          );

          const vx = -Math.sin(ang) * tu.rx * tu.speed;
          const vz = Math.cos(ang) * tu.rz * tu.speed;
          tu.group.position.set(tx, ty, tz);
          tu.group.rotation.set(Math.sin(time * 1.4 + tu.phase) * 0.06, Math.atan2(vx, vz), 0);

          const stroke = Math.sin(time * 2.5 + tu.phase);
          tu.frontLeft.rotation.z = stroke * 0.45;
          tu.frontRight.rotation.z = -stroke * 0.45;
          tu.rearLeft.rotation.z = -stroke * 0.2;
          tu.rearRight.rotation.z = stroke * 0.2;
        }
      }

      // 4. Dolphins leaping in rhythmic outer-ocean arcs
      for (let i = 0; i < dolphins.length; i++) {
        const dp = dolphins[i];
        const cycle = ((time + dp.phaseOffset) % dp.cyclePeriod) / dp.cyclePeriod;
        // Leap window occupies [0.12 .. 0.38] of cycle
        if (cycle >= 0.12 && cycle <= 0.38) {
          dp.group.visible = true;
          const u = (cycle - 0.12) / 0.26; // 0 -> 1
          const fwdDist = (u - 0.5) * 9.5;
          const dx = dp.baseX + Math.sin(dp.dirAngle) * fwdDist;
          const dz = dp.baseZ + Math.cos(dp.dirAngle) * fwdDist;
          const waterY = waveParams ? sampleSurfWave(dx, dz, waveParams).height : 0.2;
          const arcY = Math.sin(u * Math.PI) * 2.55 - 0.55;
          const pitch = -(Math.cos(u * Math.PI) * 0.85);
          dp.group.position.set(dx, waterY + arcY, dz);
          dp.group.rotation.set(pitch, dp.dirAngle, 0);
          dp.tailFluke.rotation.x = Math.sin(time * 14) * 0.32;
        } else {
          dp.group.visible = false;
        }
      }

      // 5. Coastal seagulls soaring & gliding (skipped when camera is submerged)
      if (!camPos || camPos.y >= -0.15) {
        for (let i = 0; i < gulls.length; i++) {
          const g = gulls[i];
          const ang = time * g.speed + g.phase;
          const gx = g.cx + Math.cos(ang) * g.rx;
          const gz = g.cz + Math.sin(ang) * g.rz;
          const gy = g.baseY + Math.sin(time * 0.8 + g.phase) * 1.4;

          const vx = -Math.sin(ang) * g.rx * g.speed;
          const vz = Math.cos(ang) * g.rz * g.speed;
          const yaw = Math.atan2(vx, vz);
          const bank = (g.speed > 0 ? -0.22 : 0.22) + Math.sin(time * 1.2 + g.phase) * 0.08;

          g.group.position.set(gx, gy, gz);
          g.group.rotation.set(0, yaw, bank);

          // Alternate flapping bursts with peaceful soaring glides
          const glideEnvelope = Math.max(0.15, Math.sin(time * 0.55 + g.phase));
          const flap = Math.sin(time * g.flapSpeed + g.phase) * 0.55 * glideEnvelope;
          g.leftWingPivot.rotation.z = flap;
          g.rightWingPivot.rotation.z = -flap;
        }
      }
    },
    dispose: () => {
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
