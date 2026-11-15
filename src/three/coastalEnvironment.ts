import * as THREE from 'three';
import { getBeachHeightAt } from './oceanShader';
import { ProceduralTextureSet } from './proceduralTextures';
import { SurfboardSpec } from '../types/game';

export interface PalmFrondRef {
  instanceIndex: number;
  azimuth: number;
  baseRotX: number;
  baseRotZ: number;
  scale: number;
  phase: number;
}

export interface PalmCoconutRef {
  instanceIndex: number;
  localMatrix: THREE.Matrix4;
}

export interface AnimatedPalm {
  group: THREE.Group;
  crownX: number;
  crownY: number;
  crownZ: number;
  fronds: PalmFrondRef[];
  coconuts: PalmCoconutRef[];
  baseLeanX: number;
  baseLeanZ: number;
  phase: number;
}

export interface CoastalEnvironment {
  group: THREE.Group;
  beachMaterial: THREE.MeshStandardMaterial;
  palms: AnimatedPalm[];
  update: (
    time: number,
    windStrength: number,
    waveSpeed: number,
    dt?: number,
    camZ?: number,
    underwaterAmount?: number
  ) => void;
  dispose: () => void;
}

const _palmDummy = new THREE.Object3D();
const _crownLocalMat = new THREE.Matrix4();
const _crownWorldMat = new THREE.Matrix4();
const _pivotMat = new THREE.Matrix4();
const _finalInstMat = new THREE.Matrix4();

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createBeachTerrain(textures: ProceduralTextureSet): {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
} {
  const width = 460;
  const depth = 220;
  const segX = 160;
  const segZ = 110;

  const geometry = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geometry.rotateX(-Math.PI / 2);
  // Shift so Z spans from -135 (deep seabed) to +85 (upper beach)
  geometry.translate(0, 0, -25);

  const posAttr = geometry.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = getBeachHeightAt(x, z);
    posAttr.setY(i, y);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: textures.sandColor,
    normalMap: textures.sandNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.88,
    metalness: 0.0,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWaveSpeed = { value: 1.08 };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vTerrainWorldPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWaveSpeed;
         varying vec3 vTerrainWorldPos;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         // Tropical lush headland ground cover on elevated slopes
         float headlandVeg = smoothstep(1.6, 4.2, vTerrainWorldPos.y) * smoothstep(-24.0, -44.0, vTerrainWorldPos.x);
         float rightVeg = smoothstep(1.8, 4.0, vTerrainWorldPos.y) * smoothstep(64.0, 86.0, vTerrainWorldPos.x);
         float vegMask = clamp(max(headlandVeg, rightVeg), 0.0, 1.0);
         vec3 foliageGround = vec3(0.14, 0.24, 0.11);
         diffuseColor.rgb = mix(diffuseColor.rgb, foliageGround, vegMask * 0.85);

         // Wet sand darkening along the swash line
         float swashOsc = sin(uTime * 0.82 * uWaveSpeed - vTerrainWorldPos.x * 0.045) * 0.14;
         float wetness = 1.0 - smoothstep(0.05 + swashOsc, 0.82 + swashOsc, vTerrainWorldPos.y);
         wetness *= (1.0 - vegMask);
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.56, wetness);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float swashOscR = sin(uTime * 0.82 * uWaveSpeed - vTerrainWorldPos.x * 0.045) * 0.14;
         float wetRoughMask = 1.0 - smoothstep(0.05 + swashOscR, 0.72 + swashOscR, vTerrainWorldPos.y);
         roughnessFactor = mix(roughnessFactor, 0.09, wetRoughMask * 0.9);`
      );
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  return { mesh, material };
}

function createPalmFrondGeometry(): THREE.BufferGeometry {
  const length = 3.8;
  const width = 1.35;
  const geo = new THREE.PlaneGeometry(width, length, 4, 10);
  // Shift pivot to base of frond (y = 0 -> y = length)
  geo.translate(0, length / 2, 0);
  // Rotate so frond extends along +Z and curves downward under gravity
  geo.rotateX(Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const t = z / length; // 0 at trunk -> 1 at tip
    // Natural parabolic arch upward slightly at base, drooping gracefully toward tip
    const archY = Math.sin(t * Math.PI * 0.85) * 0.55 - Math.pow(t, 2.1) * 1.45;
    // Slight V-fold across leaflet spine
    const vFold = -Math.abs(x) * 0.18 * (0.4 + 0.6 * t);
    pos.setY(i, archY + vFold);
  }
  geo.computeVertexNormals();
  return geo;
}

function createPalmTree(
  x: number,
  z: number,
  scale: number,
  leanAngle: number,
  leanDir: number,
  seed: number,
  trunkMat: THREE.MeshStandardMaterial,
  shaftGeo: THREE.BufferGeometry,
  shaftMat: THREE.MeshStandardMaterial,
  frondColorsOut: THREE.Color[],
  coconutCounter: { count: number }
): AnimatedPalm {
  const rand = seededRandom(seed);
  const group = new THREE.Group();
  const groundY = getBeachHeightAt(x, z);
  group.position.set(x, groundY - 0.15, z);
  group.scale.setScalar(scale);

  // 1. Curved segmented trunk via TubeGeometry
  const trunkHeight = 8.2 + rand() * 2.4;
  const leanDist = Math.sin(leanAngle) * trunkHeight * 0.45;
  const dx = Math.cos(leanDir) * leanDist;
  const dz = Math.sin(leanDir) * leanDist;

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(dx * 0.25, trunkHeight * 0.35, dz * 0.25),
    new THREE.Vector3(dx * 0.65, trunkHeight * 0.72, dz * 0.65),
    new THREE.Vector3(dx, trunkHeight, dz),
  ]);

  const trunkGeo = new THREE.TubeGeometry(curve, 16, 0.22, 9, false);
  // Taper trunk radius from base to top
  const trunkPos = trunkGeo.attributes.position;
  const pt = new THREE.Vector3();
  for (let i = 0; i < trunkPos.count; i++) {
    const vy = trunkPos.getY(i);
    const t = Math.min(1, Math.max(0, vy / trunkHeight));
    curve.getPoint(t, pt);
    const taper = 1.25 - t * 0.52;
    trunkPos.setX(i, pt.x + (trunkPos.getX(i) - pt.x) * taper);
    trunkPos.setZ(i, pt.z + (trunkPos.getZ(i) - pt.z) * taper);
  }
  trunkGeo.computeVertexNormals();

  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  // 2. Crownshaft bulb at top of trunk (shared geometry & material)
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.position.set(dx, trunkHeight + 0.12, dz);
  group.add(shaftMesh);

  // Coconut cluster descriptors (instanced in single draw call)
  const coconuts: PalmCoconutRef[] = [];
  const nutCount = 3 + Math.floor(rand() * 2);
  for (let n = 0; n < nutCount; n++) {
    const a = (n / nutCount) * Math.PI * 2 + rand() * 0.5;
    _palmDummy.position.set(Math.cos(a) * 0.2, -0.05, Math.sin(a) * 0.2);
    _palmDummy.rotation.set(0, 0, 0);
    _palmDummy.scale.set(0.9, 1.15, 0.9);
    _palmDummy.updateMatrix();
    coconuts.push({
      instanceIndex: coconutCounter.count++,
      localMatrix: _palmDummy.matrix.clone(),
    });
  }

  // 3. 14 Arched Feather Fronds (batched into single InstancedMesh)
  const treeFrondColor = new THREE.Color().setHSL(0.25 + (rand() - 0.5) * 0.04, 0.42, 0.44);
  const fronds: PalmFrondRef[] = [];
  const frondCount = 14;
  for (let f = 0; f < frondCount; f++) {
    const tier = f < 6 ? 0 : 1;
    const azimuth = (f / (tier === 0 ? 6 : 8)) * Math.PI * 2 + tier * 0.42 + (rand() - 0.5) * 0.25;
    const baseRotX = tier === 0 ? -0.35 - rand() * 0.2 : 0.08 + rand() * 0.25;
    const baseRotZ = (rand() - 0.5) * 0.16;
    const frondScale = 0.85 + rand() * 0.28;

    const instanceIndex = frondColorsOut.length;
    frondColorsOut.push(treeFrondColor);
    fronds.push({
      instanceIndex,
      azimuth,
      baseRotX,
      baseRotZ,
      scale: frondScale,
      phase: rand() * Math.PI * 2,
    });
  }

  return {
    group,
    crownX: dx,
    crownY: trunkHeight,
    crownZ: dz,
    fronds,
    coconuts,
    baseLeanX: dx * 0.02,
    baseLeanZ: dz * 0.02,
    phase: rand() * Math.PI * 2,
  };
}

function createCoastalRocks(textures: ProceduralTextureSet): THREE.Group {
  const rockGroup = new THREE.Group();
  const baseGeo = new THREE.DodecahedronGeometry(1, 2);

  // Rock placement clusters on left headland and far right point
  const clusters: { x: number; z: number; sx: number; sy: number; sz: number; seed: number }[] = [
    { x: -34, z: 4, sx: 4.5, sy: 2.2, sz: 3.8, seed: 101 },
    { x: -38, z: -3, sx: 5.8, sy: 3.0, sz: 4.6, seed: 102 },
    { x: -45, z: -12, sx: 7.2, sy: 4.1, sz: 5.5, seed: 103 },
    { x: -31, z: 10, sx: 2.8, sy: 1.4, sz: 2.5, seed: 104 },
    { x: -53, z: -22, sx: 8.5, sy: 4.8, sz: 7.0, seed: 105 },
    { x: -42, z: 16, sx: 4.0, sy: 2.0, sz: 3.6, seed: 106 },
    { x: -27, z: 15, sx: 1.7, sy: 0.9, sz: 1.5, seed: 107 },
    { x: 76, z: -48, sx: 8.0, sy: 3.6, sz: 6.5, seed: 201 },
    { x: 84, z: -58, sx: 10.5, sy: 5.2, sz: 8.0, seed: 202 },
  ];

  const rockMat = new THREE.MeshStandardMaterial({
    map: textures.rockColor,
    color: new THREE.Color().setHSL(0.08, 0.1, 0.4),
    roughness: 0.88,
    metalness: 0.04,
  });

  clusters.forEach((c) => {
    const rand = seededRandom(c.seed);
    const geo = baseGeo.clone();
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const n =
        0.78 +
        0.24 * Math.sin(vx * 3.1 + c.seed) * Math.cos(vz * 2.7 + vy * 2.1) +
        0.12 * Math.sin(vy * 5.2 + vx * 4.1);
      pos.setXYZ(i, vx * n, vy * n, vz * n);
    }
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, rockMat);
    const groundY = getBeachHeightAt(c.x, c.z);
    mesh.position.set(c.x, groundY + c.sy * 0.18, c.z);
    mesh.scale.set(c.sx, c.sy, c.sz);
    mesh.rotation.set(rand() * 0.3, rand() * Math.PI * 2, rand() * 0.3);
    mesh.castShadow = c.sx > 3.5;
    mesh.receiveShadow = true;
    rockGroup.add(mesh);
  });

  baseGeo.dispose();
  return rockGroup;
}

export function createCoastalEnvironment(textures: ProceduralTextureSet): CoastalEnvironment {
  const group = new THREE.Group();

  // 1. Sculpted sandy beach & underwater seabed
  const { mesh: beachMesh, material: beachMaterial } = createBeachTerrain(textures);
  group.add(beachMesh);

  // 2. Coastal basalt boulders & rocky headland outcrops
  const rocks = createCoastalRocks(textures);
  group.add(rocks);

  // 3. Swaying coconut palm grove along headland, upper sandy dunes & right cove
  //    (Keeps central player spawn lane x in [-7..+7], z in [8..24] and volleyball court x in [14..28], z in [24..34] open)
  const sharedFrondGeo = createPalmFrondGeometry();
  const sharedFrondMat = new THREE.MeshStandardMaterial({
    map: textures.palmFrond,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.55,
    metalness: 0.02,
    color: '#ffffff',
  });
  const sharedShaftGeo = new THREE.CylinderGeometry(0.16, 0.23, 0.65, 10);
  const sharedShaftMat = new THREE.MeshStandardMaterial({
    color: '#4c5f2f',
    roughness: 0.72,
    metalness: 0.0,
  });
  const sharedNutGeo = new THREE.SphereGeometry(0.14, 10, 8);
  const sharedNutMat = new THREE.MeshStandardMaterial({
    color: '#5a3d24',
    roughness: 0.62,
    metalness: 0.0,
  });
  const trunkMats = [0, 1, 2, 3].map(
    (idx) =>
      new THREE.MeshStandardMaterial({
        map: textures.palmBark,
        color: new THREE.Color().setHSL(0.08, 0.22, 0.36 + idx * 0.025),
        roughness: 0.92,
        metalness: 0.0,
      })
  );

  const palmPlacements: { x: number; z: number; scale: number; lean: number; dir: number; seed: number }[] = [
    // Left rocky headland grove
    { x: -37, z: 18, scale: 0.92, lean: 0.32, dir: 0.4, seed: 11 },
    { x: -43, z: 10, scale: 1.06, lean: 0.38, dir: 0.25, seed: 22 },
    { x: -48, z: 1, scale: 0.98, lean: 0.28, dir: 0.55, seed: 33 },
    { x: -55, z: -9, scale: 1.12, lean: 0.42, dir: 0.15, seed: 44 },
    { x: -62, z: -19, scale: 0.95, lean: 0.35, dir: 0.35, seed: 55 },
    { x: -46, z: 24, scale: 0.86, lean: 0.25, dir: 0.6, seed: 66 },
    { x: -58, z: 14, scale: 1.04, lean: 0.3, dir: 0.2, seed: 77 },
    { x: -67, z: -4, scale: 1.15, lean: 0.24, dir: 0.4, seed: 88 },
    // Upper sandy beach palm avenue (left to right behind beach props)
    { x: -31, z: 30, scale: 1.02, lean: 0.28, dir: -0.9, seed: 121 },
    { x: -25, z: 36, scale: 0.94, lean: 0.22, dir: -1.1, seed: 132 },
    { x: -17, z: 40, scale: 1.10, lean: 0.31, dir: -1.35, seed: 143 },
    { x: -9, z: 44, scale: 0.98, lean: 0.24, dir: -1.5, seed: 154 },
    { x: 2, z: 46, scale: 1.08, lean: 0.27, dir: -1.6, seed: 165 },
    { x: 11, z: 43, scale: 0.95, lean: 0.22, dir: -1.75, seed: 176 },
    { x: 22, z: 42, scale: 1.12, lean: 0.29, dir: -1.85, seed: 187 },
    { x: 33, z: 39, scale: 1.04, lean: 0.34, dir: -1.95, seed: 198 },
    // Right sandy cove & distant point
    { x: 39, z: 28, scale: 0.92, lean: 0.36, dir: -2.15, seed: 209 },
    { x: 46, z: 34, scale: 1.08, lean: 0.28, dir: -2.0, seed: 220 },
    { x: 54, z: 26, scale: 0.96, lean: 0.33, dir: -2.25, seed: 231 },
    { x: 61, z: 18, scale: 1.05, lean: 0.31, dir: -2.4, seed: 242 },
    { x: 74, z: -38, scale: 0.95, lean: 0.34, dir: 2.7, seed: 99 },
    { x: 82, z: -46, scale: 1.08, lean: 0.29, dir: 2.9, seed: 110 },
  ];

  const palms: AnimatedPalm[] = [];
  const frondColors: THREE.Color[] = [];
  const coconutCounter = { count: 0 };

  palmPlacements.forEach((p, idx) => {
    const palm = createPalmTree(
      p.x,
      p.z,
      p.scale,
      p.lean,
      p.dir,
      p.seed,
      trunkMats[idx % trunkMats.length],
      sharedShaftGeo,
      sharedShaftMat,
      frondColors,
      coconutCounter
    );
    palms.push(palm);
    group.add(palm.group);
  });

  // Single-draw-call InstancedMesh for all 308 palm fronds
  const frondInst = new THREE.InstancedMesh(sharedFrondGeo, sharedFrondMat, frondColors.length);
  frondInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  frondInst.frustumCulled = false;
  frondInst.castShadow = false;
  for (let i = 0; i < frondColors.length; i++) {
    frondInst.setColorAt(i, frondColors[i]);
  }
  if (frondInst.instanceColor) frondInst.instanceColor.needsUpdate = true;
  group.add(frondInst);

  // Single-draw-call InstancedMesh for all coconut clusters
  const coconutInst = new THREE.InstancedMesh(
    sharedNutGeo,
    sharedNutMat,
    Math.max(1, coconutCounter.count)
  );
  coconutInst.count = coconutCounter.count;
  coconutInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  coconutInst.frustumCulled = false;
  coconutInst.castShadow = false;
  group.add(coconutInst);

  // 4. Lush tropical coastal shrubs & dune sea-oats around palm bases and headlands
  const bushGeo = new THREE.DodecahedronGeometry(0.65, 1);
  const bushPositions: [number, number, number][] = [
    [-35, 22, 1.1],
    [-41, 15, 1.35],
    [-49, 6, 1.5],
    [-32, 31, 1.2],
    [-23, 37, 1.05],
    [-14, 41, 1.25],
    [-4, 45, 1.3],
    [7, 45, 1.15],
    [18, 43, 1.25],
    [29, 40, 1.3],
    [38, 31, 1.15],
    [45, 35, 1.4],
    [52, 27, 1.25],
    [59, 20, 1.35],
    [-55, -2, 1.6],
    [72, -35, 1.5],
  ];
  const bushMat = new THREE.MeshStandardMaterial({
    color: '#2e6b34',
    roughness: 0.85,
    metalness: 0.0,
  });
  const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bushPositions.length);
  bushInst.castShadow = false;
  bushInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const bColor = new THREE.Color();
  for (let i = 0; i < bushPositions.length; i++) {
    const [bx, bz, bs] = bushPositions[i];
    const by = getBeachHeightAt(bx, bz);
    dummy.position.set(bx, by + 0.28 * bs, bz);
    dummy.rotation.set(0.1 * ((i % 3) - 1), i * 1.17, 0.08 * ((i % 2) - 0.5));
    dummy.scale.set(bs * 1.25, bs * 0.78, bs * 1.15);
    dummy.updateMatrix();
    bushInst.setMatrixAt(i, dummy.matrix);
    bColor.setHSL(0.28 + (i % 4) * 0.015, 0.45, 0.25 + (i % 3) * 0.04);
    bushInst.setColorAt(i, bColor);
  }
  bushInst.instanceMatrix.needsUpdate = true;
  if (bushInst.instanceColor) bushInst.instanceColor.needsUpdate = true;
  group.add(bushInst);

  const updatePalms = (time: number, windStrength: number) => {
    const windAmp = 0.03 + windStrength * 0.045;
    for (let i = 0; i < palms.length; i++) {
      const p = palms[i];
      const trunkSway = Math.sin(time * 0.9 + p.phase) * windAmp * 0.35;
      p.group.rotation.z = trunkSway;
      p.group.rotation.x = Math.cos(time * 0.72 + p.phase) * windAmp * 0.22;
      p.group.updateMatrix();

      _crownLocalMat.makeTranslation(p.crownX, p.crownY, p.crownZ);
      _crownWorldMat.multiplyMatrices(p.group.matrix, _crownLocalMat);

      for (let c = 0; c < p.coconuts.length; c++) {
        const nut = p.coconuts[c];
        _finalInstMat.multiplyMatrices(_crownWorldMat, nut.localMatrix);
        coconutInst.setMatrixAt(nut.instanceIndex, _finalInstMat);
      }

      for (let f = 0; f < p.fronds.length; f++) {
        const fr = p.fronds[f];
        const flutter = Math.sin(time * 2.1 + fr.phase + p.phase) * windAmp * 1.45;
        const gust = Math.cos(time * 1.35 + fr.phase * 0.7) * windAmp * 0.85;

        _pivotMat.makeRotationY(fr.azimuth);
        _palmDummy.position.set(0, 0.24, 0.1);
        _palmDummy.rotation.set(fr.baseRotX + flutter, 0, fr.baseRotZ + gust);
        _palmDummy.scale.setScalar(fr.scale);
        _palmDummy.updateMatrix();

        _finalInstMat.multiplyMatrices(_crownWorldMat, _pivotMat).multiply(_palmDummy.matrix);
        frondInst.setMatrixAt(fr.instanceIndex, _finalInstMat);
      }
    }
    frondInst.instanceMatrix.needsUpdate = true;
    coconutInst.instanceMatrix.needsUpdate = true;
  };

  // Populate initial frame matrices before first render
  updatePalms(0, 0.25);

  let palmAccum = 0;

  return {
    group,
    beachMaterial,
    palms,
    update: (
      time: number,
      windStrength: number,
      waveSpeed: number,
      dt = 0.016,
      camZ = 10,
      underwaterAmount = 0
    ) => {
      if (beachMaterial.userData.shader) {
        beachMaterial.userData.shader.uniforms.uTime.value = time;
        beachMaterial.userData.shader.uniforms.uWaveSpeed.value = waveSpeed;
      }

      if (underwaterAmount > 0.35) {
        return;
      }
      if (camZ < -10) {
        palmAccum += dt;
        if (palmAccum < 0.05) {
          return;
        }
        palmAccum = 0;
      } else {
        palmAccum = 0;
      }

      updatePalms(time, windStrength);
    },
    dispose: () => {
      sharedFrondGeo.dispose();
      sharedFrondMat.dispose();
      sharedShaftGeo.dispose();
      sharedShaftMat.dispose();
      sharedNutGeo.dispose();
      sharedNutMat.dispose();
      trunkMats.forEach((m) => m.dispose());
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

/**
 * Builds a composite 3D procedural surfboard (5+ distinct sub-parts):
 * 1. Sculpted surfboard hull with nose/tail rocker & beveled rails
 * 2. Inlaid cedar wood stringer
 * 3. Rail color pin-line / deck grip strip
 * 4. Textured EVA tail traction pad
 * 5. Beveled fiberglass fins (Thruster, Twin, or Single + 2)
 */
export interface SurfboardBuildOptions {
  castShadows?: boolean;
  lightweightMaterial?: boolean;
}

export function createSurfboardGroup(
  spec: SurfboardSpec,
  options?: SurfboardBuildOptions
): THREE.Group {
  const castShadows = options?.castShadows ?? true;
  const lightweight = options?.lightweightMaterial ?? false;
  const boardGroup = new THREE.Group();

  const boardLength = 2.05 * spec.lengthScale;
  const halfWidth = 0.26 * spec.widthScale;
  const thickness = 0.058;

  // Build closed top + bottom deck by constructing a custom extruded surfboard outline
  const shape = new THREE.Shape();
  const steps = lightweight ? 26 : 40;
  const outlinePoints: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = nose, 1 = tail
    const z = (0.5 - t) * boardLength;
    // Planform width curve
    let wFactor: number;
    if (t < 0.45) {
      const nt = t / 0.45;
      wFactor = Math.pow(Math.sin(nt * (Math.PI / 2)), 1.0 - spec.noseRoundness * 0.45);
    } else {
      const tt = (t - 0.45) / 0.55;
      const tailEnd = spec.tailType === 'pin' ? 0.06 : spec.tailType === 'swallow' ? 0.42 : 0.34;
      wFactor = 1.0 - Math.pow(tt, 1.55) * (1.0 - tailEnd);
    }
    outlinePoints.push([wFactor * halfWidth, z]);
  }

  shape.moveTo(0, boardLength * 0.5);
  for (let i = 1; i < outlinePoints.length; i++) {
    shape.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
  }
  if (spec.tailType === 'swallow') {
    shape.lineTo(0, -boardLength * 0.5 + 0.08);
  } else {
    shape.lineTo(0, -boardLength * 0.5);
  }
  for (let i = outlinePoints.length - 1; i >= 1; i--) {
    shape.lineTo(-outlinePoints[i][0], outlinePoints[i][1]);
  }
  shape.closePath();

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.018,
    bevelSegments: lightweight ? 2 : 4,
    curveSegments: lightweight ? 12 : 24,
  });
  extrudeGeo.rotateX(-Math.PI / 2);
  // Apply realistic surfboard rocker curve (nose lift & subtle tail lift)
  const ePos = extrudeGeo.attributes.position;
  for (let i = 0; i < ePos.count; i++) {
    const z = ePos.getZ(i);
    const t = (z + boardLength * 0.5) / boardLength; // 0 at tail, 1 at nose
    const noseRocker = Math.pow(Math.max(0, t - 0.45) / 0.55, 2.2) * 0.11;
    const tailRocker = Math.pow(Math.max(0, 0.35 - t) / 0.35, 2.0) * 0.035;
    ePos.setY(i, ePos.getY(i) + noseRocker + tailRocker);
  }
  extrudeGeo.computeVertexNormals();

  const hullMat = lightweight
    ? new THREE.MeshStandardMaterial({
        color: spec.hullColor,
        roughness: 0.22,
        metalness: 0.04,
      })
    : new THREE.MeshPhysicalMaterial({
        color: spec.hullColor,
        roughness: 0.18,
        metalness: 0.02,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      });
  const hullMesh = new THREE.Mesh(extrudeGeo, hullMat);
  hullMesh.castShadow = castShadows;
  hullMesh.receiveShadow = true;
  boardGroup.add(hullMesh);

  // 2. Cedar Wood Stringer inlaid down centerline
  const stringerGeo = new THREE.BoxGeometry(0.008, thickness + 0.033, boardLength * 0.94);
  const sPos = stringerGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const z = sPos.getZ(i);
    const t = (z + boardLength * 0.5) / boardLength;
    const noseRocker = Math.pow(Math.max(0, t - 0.45) / 0.55, 2.2) * 0.11;
    const tailRocker = Math.pow(Math.max(0, 0.35 - t) / 0.35, 2.0) * 0.035;
    sPos.setY(i, sPos.getY(i) + thickness * 0.5 + noseRocker + tailRocker);
  }
  stringerGeo.computeVertexNormals();
  const stringerMat = new THREE.MeshStandardMaterial({
    color: spec.stringerColor,
    roughness: 0.58,
    metalness: 0.0,
  });
  const stringerMesh = new THREE.Mesh(stringerGeo, stringerMat);
  boardGroup.add(stringerMesh);

  // 3. Accent Deck Pin-Line Stripe
  const stripeGeo = new THREE.BoxGeometry(halfWidth * 0.58, 0.004, boardLength * 0.42);
  const stripeMat = lightweight
    ? new THREE.MeshStandardMaterial({
        color: spec.railColor,
        roughness: 0.25,
        metalness: 0.06,
      })
    : new THREE.MeshPhysicalMaterial({
        color: spec.railColor,
        roughness: 0.22,
        metalness: 0.05,
        clearcoat: 0.9,
      });
  const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
  stripeMesh.position.set(0, thickness + 0.017, boardLength * 0.06);
  boardGroup.add(stripeMesh);

  // 4. Matte EVA Tail Traction Pad (distinct roughness >= 0.25 delta)
  const padGeo = new THREE.BoxGeometry(halfWidth * 0.72, 0.012, 0.34);
  const padMat = new THREE.MeshStandardMaterial({
    color: '#1b242c',
    roughness: 0.92,
    metalness: 0.0,
  });
  const padMesh = new THREE.Mesh(padGeo, padMat);
  padMesh.position.set(0, thickness + 0.025, -boardLength * 0.34);
  padMesh.rotation.x = -0.05;
  padMesh.castShadow = castShadows;
  boardGroup.add(padMesh);

  // Tail kick ridge
  const kickGeo = new THREE.BoxGeometry(halfWidth * 0.68, 0.024, 0.045);
  const kickMesh = new THREE.Mesh(kickGeo, padMat);
  kickMesh.position.set(0, thickness + 0.036, -boardLength * 0.43);
  kickMesh.rotation.x = 0.45;
  boardGroup.add(kickMesh);

  // 5. Fiberglass Fins (bottom side of board)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.quadraticCurveTo(0.06, 0.08, 0.11, 0.125);
  finShape.quadraticCurveTo(0.09, 0.05, 0.115, 0);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.007,
    bevelEnabled: !lightweight,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
  });
  finGeo.rotateY(Math.PI / 2);
  finGeo.rotateX(Math.PI);

  const finMat = new THREE.MeshStandardMaterial({
    color: spec.railColor,
    roughness: 0.28,
    metalness: 0.08,
  });

  if (spec.finSetup === 'Thruster' || spec.finSetup === 'Single + 2') {
    const centerFin = new THREE.Mesh(finGeo, finMat);
    centerFin.position.set(0.003, 0.008, -boardLength * 0.41);
    centerFin.scale.setScalar(spec.finSetup === 'Single + 2' ? 1.25 : 0.95);
    boardGroup.add(centerFin);
  }

  const sideScale = spec.finSetup === 'Twin' ? 1.22 : spec.finSetup === 'Single + 2' ? 0.72 : 0.92;
  for (const side of [-1, 1]) {
    const sideFin = new THREE.Mesh(finGeo, finMat);
    sideFin.position.set(side * halfWidth * 0.52, 0.005, -boardLength * 0.32);
    sideFin.rotation.y = side * 0.06;
    sideFin.rotation.z = side * 0.1;
    sideFin.scale.setScalar(sideScale);
    boardGroup.add(sideFin);
  }

  return boardGroup;
}
