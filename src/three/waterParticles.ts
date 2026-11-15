import * as THREE from 'three';
import { SurferPhysicsState } from './wavePhysics';

interface SprayParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size: number;
}

export interface WaterParticleSystem {
  mesh: THREE.InstancedMesh;
  setQualityScale: (scale: number) => void;
  emitNpcSpray: (simDt: number, state: SurferPhysicsState, intensityScale?: number) => void;
  update: (simDt: number, state: SurferPhysicsState) => void;
  reset: () => void;
  dispose: () => void;
}

const MAX_PARTICLES = 380;
const _dummy = new THREE.Object3D();

/**
 * Compact swap-remove pooled InstancedMesh water spray, carve fan, and splash particle system.
 * Only active instances are integrated and uploaded to the GPU via mesh.count.
 */
export function createWaterParticleSystem(): WaterParticleSystem {
  const geometry = new THREE.IcosahedronGeometry(0.085, 1);
  const material = new THREE.MeshStandardMaterial({
    color: '#eef8fb',
    roughness: 0.35,
    metalness: 0.05,
    transparent: true,
    opacity: 0.85,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, MAX_PARTICLES);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;

  const pool: SprayParticle[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      age: 0,
      life: 1,
      size: 1,
    });
  }

  let activeCount = 0;
  let emitAccum = 0;
  let npcEmitAccum = 0;
  let qualityScale = 1.0;

  const setQualityScale = (scale: number) => {
    qualityScale = THREE.MathUtils.clamp(scale, 0.25, 1.0);
  };

  const spawn = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number
  ) => {
    let idx: number;
    if (activeCount < MAX_PARTICLES) {
      idx = activeCount;
      activeCount++;
    } else {
      // Recycle oldest slot at index 0
      idx = 0;
    }
    const p = pool[idx];
    p.pos.set(x, y, z);
    p.vel.set(vx, vy, vz);
    p.age = 0;
    p.life = life;
    p.size = size;
  };

  const reset = () => {
    emitAccum = 0;
    npcEmitAccum = 0;
    activeCount = 0;
    mesh.count = 0;
  };

  const emitNpcSpray = (simDt: number, state: SurferPhysicsState, intensityScale = 0.55) => {
    if (intensityScale <= 0.05 || simDt <= 0) return;

    if (
      (state.phase === 'riding' || state.phase === 'maneuver' || state.phase === 'barrel') &&
      state.speed > 5.0
    ) {
      const rate = (16 + state.carvingIntensity * 42) * qualityScale * intensityScale;
      npcEmitAccum = Math.min(npcEmitAccum + simDt * rate, 4);
      const tailDirX = -Math.sin(state.heading);
      const tailDirZ = -Math.cos(state.heading);

      while (npcEmitAccum >= 1) {
        npcEmitAccum -= 1;
        const spread = (Math.random() - 0.5) * 0.55;
        const fanSide = -Math.sign(state.roll || 1) * (0.45 + state.carvingIntensity * 1.8);
        spawn(
          state.position.x + tailDirX * 0.8 + (Math.random() - 0.5) * 0.2,
          state.position.y + 0.08,
          state.position.z + tailDirZ * 0.8 + (Math.random() - 0.5) * 0.2,
          tailDirX * (2.2 + state.speed * 0.18) + fanSide + spread,
          1.2 + state.carvingIntensity * 2.2 + Math.random() * 1.1,
          tailDirZ * (2.2 + state.speed * 0.18) + spread,
          0.38 + Math.random() * 0.28,
          0.5 + Math.random() * 0.65
        );
      }
    }

    if (state.justSplashed) {
      const burstCount = Math.max(
        2,
        Math.round(12 * state.splashIntensity * qualityScale * intensityScale)
      );
      for (let b = 0; b < burstCount; b++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (1.6 + Math.random() * 3.6) * state.splashIntensity;
        spawn(
          state.position.x + Math.cos(ang) * 0.3,
          state.position.y + 0.1,
          state.position.z + Math.sin(ang) * 0.3,
          Math.cos(ang) * spd,
          (2.0 + Math.random() * 3.4) * state.splashIntensity,
          Math.sin(ang) * spd,
          0.45 + Math.random() * 0.35,
          0.65 + Math.random() * 0.8
        );
      }
    }
  };

  const update = (simDt: number, state: SurferPhysicsState) => {
    // 1. Emit rooster-tail wake & carving rail spray
    if (
      (state.phase === 'riding' || state.phase === 'maneuver' || state.phase === 'barrel') &&
      state.speed > 4.5
    ) {
      const rate = (38 + state.carvingIntensity * 95) * qualityScale;
      emitAccum = Math.min(emitAccum + simDt * rate, 10);
      const tailDirX = -Math.sin(state.heading);
      const tailDirZ = -Math.cos(state.heading);

      while (emitAccum >= 1) {
        emitAccum -= 1;
        const spread = (Math.random() - 0.5) * 0.65;
        const fanSide = -Math.sign(state.roll || 1) * (0.5 + state.carvingIntensity * 2.2);
        spawn(
          state.position.x + tailDirX * 0.85 + (Math.random() - 0.5) * 0.25,
          state.position.y + 0.08,
          state.position.z + tailDirZ * 0.85 + (Math.random() - 0.5) * 0.25,
          tailDirX * (2.5 + state.speed * 0.2) + fanSide + spread,
          1.4 + state.carvingIntensity * 2.8 + Math.random() * 1.4,
          tailDirZ * (2.5 + state.speed * 0.2) + spread,
          0.42 + Math.random() * 0.35,
          0.55 + Math.random() * 0.85 + state.carvingIntensity * 0.45
        );
      }
    } else if ((state.phase === 'paddling' || state.phase === 'recovering') && state.speed > 0.75) {
      emitAccum = Math.min(emitAccum + simDt * (state.phase === 'recovering' ? 16 : 12), 6);
      while (emitAccum >= 1) {
        emitAccum -= 1;
        const side = Math.sin(state.paddleStrokePhase) >= 0 ? 1 : -1;
        spawn(
          state.position.x + side * 0.42,
          state.position.y + 0.06,
          state.position.z + 0.3,
          side * (0.8 + Math.random() * 0.6),
          0.9 + Math.random() * 0.7,
          -0.6 + Math.random() * 0.4,
          0.35,
          0.45 + Math.random() * 0.3
        );
      }
    }

    // 2. Emit burst splashes on takeoff, air launch, landing, maneuver whip, or wipeout
    if (state.justSplashed) {
      const burstCount = Math.round(24 * state.splashIntensity * qualityScale);
      for (let b = 0; b < burstCount; b++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (1.8 + Math.random() * 4.5) * state.splashIntensity;
        spawn(
          state.position.x + Math.cos(ang) * 0.35,
          state.position.y + 0.1,
          state.position.z + Math.sin(ang) * 0.35,
          Math.cos(ang) * spd,
          (2.4 + Math.random() * 4.2) * state.splashIntensity,
          Math.sin(ang) * spd,
          0.55 + Math.random() * 0.45,
          0.75 + Math.random() * 1.1
        );
      }
    }

    if (activeCount === 0) {
      mesh.count = 0;
      return;
    }

    // 3. Compact swap-remove integration over ONLY active particles
    let i = 0;
    while (i < activeCount) {
      const p = pool[i];
      p.age += simDt;
      if (p.age >= p.life) {
        const lastIdx = activeCount - 1;
        if (i !== lastIdx) {
          const tail = pool[lastIdx];
          pool[lastIdx] = p;
          pool[i] = tail;
        }
        activeCount--;
        continue;
      }

      p.vel.y -= 9.8 * simDt;
      p.pos.addScaledVector(p.vel, simDt);

      const t = p.age / p.life;
      const scale = p.size * Math.sin(Math.min(1, t * 2.5) * (Math.PI / 2)) * (1 - t * 0.75);

      _dummy.position.copy(p.pos);
      _dummy.scale.setScalar(Math.max(0.001, scale));
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      i++;
    }

    mesh.count = activeCount;
    if (activeCount > 0) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    mesh,
    setQualityScale,
    emitNpcSpray,
    update,
    reset,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
