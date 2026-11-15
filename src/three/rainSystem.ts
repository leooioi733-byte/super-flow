import * as THREE from 'three';

export interface RainSystem {
  mesh: THREE.LineSegments;
  setQualityScale: (scale: number) => void;
  update: (
    dt: number,
    cameraPos: THREE.Vector3,
    rainIntensity: number,
    windStrength: number,
    isUnderwater: boolean
  ) => void;
  dispose: () => void;
}

const DROP_COUNT = 560;
const BOX_W = 54;
const BOX_H = 26;
const BOX_D = 54;

/**
 * Lightweight single-draw-call 3D rain streak system anchored around the camera.
 * Uses pre-allocated typed arrays for zero per-frame garbage collection.
 */
export function createRainSystem(): RainSystem {
  const positions = new Float32Array(DROP_COUNT * 6);
  const speeds = new Float32Array(DROP_COUNT);
  const lengths = new Float32Array(DROP_COUNT);
  const offsetsX = new Float32Array(DROP_COUNT);
  const offsetsY = new Float32Array(DROP_COUNT);
  const offsetsZ = new Float32Array(DROP_COUNT);

  for (let i = 0; i < DROP_COUNT; i++) {
    offsetsX[i] = (Math.random() - 0.5) * BOX_W;
    offsetsY[i] = Math.random() * BOX_H;
    offsetsZ[i] = (Math.random() - 0.5) * BOX_D;
    speeds[i] = 22 + Math.random() * 10;
    lengths[i] = 0.65 + Math.random() * 0.55;
  }

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', posAttr);

  const material = new THREE.LineBasicMaterial({
    color: '#c9ddec',
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });

  const mesh = new THREE.LineSegments(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 6;

  let qualityScale = 1.0;

  const setQualityScale = (scale: number) => {
    qualityScale = THREE.MathUtils.clamp(scale, 0.25, 1.0);
  };

  const update = (
    dt: number,
    cameraPos: THREE.Vector3,
    rainIntensity: number,
    windStrength: number,
    isUnderwater: boolean
  ) => {
    const activeOpacity = isUnderwater ? 0 : THREE.MathUtils.clamp(rainIntensity * 0.42, 0, 0.45);
    mesh.visible = activeOpacity > 0.01;
    if (!mesh.visible) return;

    material.opacity = activeOpacity;
    const activeDrops = Math.max(
      70,
      Math.floor(DROP_COUNT * qualityScale * THREE.MathUtils.clamp(rainIntensity, 0.2, 1))
    );
    geometry.setDrawRange(0, activeDrops * 2);

    const windX = (1.6 + windStrength * 3.8) * rainIntensity;
    const windZ = (0.8 + windStrength * 1.9) * rainIntensity;
    const halfW = BOX_W * 0.5;
    const halfD = BOX_D * 0.5;
    const minY = Math.max(0.1, cameraPos.y - 8);

    for (let i = 0; i < activeDrops; i++) {
      const spd = speeds[i];
      let ox = offsetsX[i] + windX * dt;
      let oy = offsetsY[i] - spd * dt;
      let oz = offsetsZ[i] + windZ * dt;

      if (oy < 0) {
        oy += BOX_H;
        ox = (Math.random() - 0.5) * BOX_W;
        oz = (Math.random() - 0.5) * BOX_D;
      }
      if (ox > halfW) ox -= BOX_W;
      else if (ox < -halfW) ox += BOX_W;
      if (oz > halfD) oz -= BOX_D;
      else if (oz < -halfD) oz += BOX_D;

      offsetsX[i] = ox;
      offsetsY[i] = oy;
      offsetsZ[i] = oz;

      const wx = cameraPos.x + ox;
      const wy = minY + oy;
      const wz = cameraPos.z + oz;

      const len = lengths[i];
      const invSpd = len / spd;
      const base = i * 6;
      positions[base] = wx;
      positions[base + 1] = wy;
      positions[base + 2] = wz;
      positions[base + 3] = wx - windX * invSpd;
      positions[base + 4] = wy + len;
      positions[base + 5] = wz - windZ * invSpd;
    }

    posAttr.needsUpdate = true;
  };

  return {
    mesh,
    setQualityScale,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
