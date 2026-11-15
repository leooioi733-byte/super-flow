import * as THREE from 'three';

/**
 * Shared terrain / seabed height profile used by both the CPU beach mesh
 * and the ocean vertex/fragment shaders so shore depth & swash align seamlessly.
 *
 * Coordinate convention:
 *   z > +22  -> Dry upper sandy beach
 *   z in [+8..+22] -> Wet sloping foreshore
 *   z < +8   -> Sloping underwater seabed getting deeper toward -Z (open ocean)
 *   x < -38  -> Left rocky tropical headland curving forward into the bay
 */
export function getBeachHeightAt(x: number, z: number): number {
  // Natural gentle curve of the coastline bay
  const shoreCurve = Math.sin(x * 0.028) * 3.8 + Math.cos(x * 0.012 + 0.6) * 2.2;
  const distFromShoreline = z - (12.0 + shoreCurve);

  let h: number;
  if (distFromShoreline >= 0) {
    // Rising gently up the sandy beach
    h = distFromShoreline * 0.088 + Math.sin(x * 0.07 + z * 0.05) * 0.09;
  } else {
    // Sloping underwater seabed with subtle outer sandbar shelf around dist ~ -35
    const d = -distFromShoreline;
    const sandbar = Math.exp(-Math.pow((d - 34.0) / 14.0, 2.0)) * 0.95;
    h = -Math.pow(d, 0.86) * 0.145 + sandbar;
  }

  // Left tropical headland rising smoothly for palm grove & coastal rocks
  if (x < -30) {
    const headlandT = Math.min(1, (-30 - x) / 48);
    const smoothT = headlandT * headlandT * (3 - 2 * headlandT);
    const headlandZ = Math.exp(-Math.pow((z + 18) / 48, 2));
    h += smoothT * (3.8 + headlandZ * 6.5);
  }

  // Subtle distant right coastal point
  if (x > 65) {
    const rightT = Math.min(1, (x - 65) / 55);
    const smoothR = rightT * rightT * (3 - 2 * rightT);
    const rightZ = Math.exp(-Math.pow((z + 55) / 60, 2));
    h += smoothR * rightZ * 5.2;
  }

  return h;
}

import { WaterQualityTier } from '../types/game';

export interface OceanSystem {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  rebuildDetail: (quality: WaterQualityTier) => void;
}

function buildOceanGeometry(quality: WaterQualityTier): THREE.BufferGeometry {
  const segX = quality === 'high' ? 148 : quality === 'medium' ? 108 : 76;
  const segZ = quality === 'high' ? 156 : quality === 'medium' ? 114 : 82;

  const width = 880;
  const zNear = 30;
  const zFar = -540;

  const positions = new Float32Array((segX + 1) * (segZ + 1) * 3);
  const uvs = new Float32Array((segX + 1) * (segZ + 1) * 2);
  const indices = new Uint16Array(segX * segZ * 6);
  let ptr = 0;

  for (let iz = 0; iz <= segZ; iz++) {
    // Non-linear distribution: ultra-dense near shore/surf zone, expanding smoothly to horizon
    const tz = iz / segZ;
    const curvedZ = Math.pow(tz, 2.15);
    const z = zNear + (zFar - zNear) * curvedZ;

    // Slight width flare toward the horizon
    const rowWidth = width * (0.42 + 0.58 * tz);

    for (let ix = 0; ix <= segX; ix++) {
      const tx = ix / segX;
      const x = (tx - 0.5) * rowWidth;
      const idx = iz * (segX + 1) + ix;

      positions[idx * 3] = x;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = z;

      uvs[idx * 2] = x * 0.025;
      uvs[idx * 2 + 1] = z * 0.025;
    }
  }

  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * (segX + 1) + ix;
      const b = a + 1;
      const c = a + (segX + 1);
      const d = c + 1;
      indices[ptr++] = a;
      indices[ptr++] = b;
      indices[ptr++] = c;
      indices[ptr++] = b;
      indices[ptr++] = d;
      indices[ptr++] = c;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function createOceanSystem(
  waterNormal: THREE.Texture,
  foamNoise: THREE.Texture,
  initialQuality: WaterQualityTier
): OceanSystem {
  let geometry = buildOceanGeometry(initialQuality);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uWaveAmplitude: { value: 1.05 },
      uWaveFrequency: { value: 0.082 },
      uWaveSpeed: { value: 1.08 },
      uChoppiness: { value: 0.42 },
      uShallowColor: { value: new THREE.Color('#26b6ad') },
      uDeepColor: { value: new THREE.Color('#063354') },
      uSunDir: { value: new THREE.Vector3(-0.32, 0.25, -0.91).normalize() },
      uSunColor: { value: new THREE.Color('#fff0d2') },
      uHorizonColor: { value: new THREE.Color('#eed3ad') },
      uZenithColor: { value: new THREE.Color('#1a5286') },
      uFogColor: { value: new THREE.Color('#dfc9ad') },
      uFogDensity: { value: 0.0024 },
      uWaterNormal: { value: waterNormal },
      uFoamNoise: { value: foamNoise },
      uSurfMode: { value: 0.0 },
      uSurfSimTime: { value: 0.0 },
      uWaveCenterZ: { value: -58.0 },
      uSurfWaveHeight: { value: 2.6 },
      uSurfWaveSpeed: { value: 9.0 },
      uSurfSteepness: { value: 0.9 },
      uBreakX: { value: -18.0 },
      uBreakDir: { value: 1.0 },
      uWaveLengthZ: { value: 34.0 },
      uOvercast: { value: 0.0 },
      uRain: { value: 0.0 },
      uWaterDetail: { value: initialQuality === 'high' ? 1.0 : initialQuality === 'medium' ? 0.72 : 0.35 },
      uReflections: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWaveAmplitude;
      uniform float uWaveFrequency;
      uniform float uWaveSpeed;
      uniform float uChoppiness;

      uniform float uSurfMode;
      uniform float uSurfSimTime;
      uniform float uWaveCenterZ;
      uniform float uSurfWaveHeight;
      uniform float uSurfWaveSpeed;
      uniform float uSurfSteepness;
      uniform float uBreakX;
      uniform float uBreakDir;
      uniform float uWaveLengthZ;

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vCrestFactor;
      varying float vSeabedY;
      varying float vSwashSurge;
      varying float vSurfWhitewater;

      // Must mirror CPU getBeachHeightAt(x, z) for seamless shoreline depth
      float getSeabedHeight(float x, float z) {
        float shoreCurve = sin(x * 0.028) * 3.8 + cos(x * 0.012 + 0.6) * 2.2;
        float distFromShoreline = z - (12.0 + shoreCurve);
        float h = 0.0;
        if (distFromShoreline >= 0.0) {
          h = distFromShoreline * 0.088;
        } else {
          float d = -distFromShoreline;
          float sandbar = exp(-pow((d - 34.0) / 14.0, 2.0)) * 0.95;
          h = -pow(d, 0.86) * 0.145 + sandbar;
        }
        return h;
      }

      vec3 gerstnerWave(
        vec2 pos,
        vec2 dir,
        float steepness,
        float wavelength,
        float speedMult,
        float ampScale,
        inout vec3 tangent,
        inout vec3 binormal
      ) {
        float k = 6.2831853 / wavelength;
        float c = sqrt(9.8 / k) * speedMult * uWaveSpeed;
        vec2 d = normalize(dir);
        float f = k * (dot(d, pos) - c * uTime);
        float a = (steepness / k) * ampScale;

        float cosF = cos(f);
        float sinF = sin(f);

        tangent += vec3(
          -d.x * d.x * (steepness * ampScale * sinF),
          d.x * (steepness * ampScale * cosF),
          -d.x * d.y * (steepness * ampScale * sinF)
        );
        binormal += vec3(
          -d.x * d.y * (steepness * ampScale * sinF),
          d.y * (steepness * ampScale * cosF),
          -d.y * d.y * (steepness * ampScale * sinF)
        );

        return vec3(
          d.x * (a * cosF),
          a * sinF,
          d.y * (a * cosF)
        );
      }

      void evaluateSurfWave(in vec3 basePos, out vec3 outPos, out vec3 outNormal, out float outCrest, out float outWW) {
        float t = uSurfSimTime;
        float x = basePos.x;
        float z = basePos.z;

        float swellBase = sin(z * 0.065 - t * 1.35 + x * 0.01) * 0.28
                        + cos(z * 0.12 - t * 1.9 - x * 0.03) * 0.11;
        float dSwellDz = cos(z * 0.065 - t * 1.35 + x * 0.01) * 0.28 * 0.065;
        float dSwellDx = cos(z * 0.065 - t * 1.35 + x * 0.01) * 0.28 * 0.01;

        float dz = z - uWaveCenterZ;
        float halfW = uWaveLengthZ * 0.5;
        float relBreak = (x - uBreakX) * uBreakDir;

        // Shared progressive shoaling & breaking curve matching CPU getWaveShoaling()
        float shoalBuild = smoothstep(-135.0, -36.0, uWaveCenterZ);
        float shoreDecay = smoothstep(-2.0, 13.0, uWaveCenterZ);
        float heightScale = (0.58 + shoalBuild * 0.52) * (1.0 - shoreDecay * 0.34);
        float steepScale = (0.62 + shoalBuild * 0.46) * (1.0 - shoreDecay * 0.25);
        float breakProgress = smoothstep(-82.0, -26.0, uWaveCenterZ);

        float lateralDecay = exp(-pow((x - uBreakX) / 145.0, 2.0));
        float shoulderTaper = 1.0 - smoothstep(14.0, 72.0, relBreak) * 0.42;
        float whitewaterDamp = 1.0 - smoothstep(4.0, 28.0, -relBreak) * (0.14 + 0.22 * breakProgress);
        float localH = uSurfWaveHeight * heightScale * lateralDecay * shoulderTaper * whitewaterDamp;

        float pocketSteepBoost = 1.0 + exp(-pow((relBreak - 5.5) / 11.0, 2.0)) * 0.45 * uSurfSteepness * steepScale;

        float waveY = 0.0;
        float dWaveDz = 0.0;
        float dWaveDx = 0.0;

        if (dz >= -halfW && dz <= halfW) {
          if (dz >= 0.0) {
            float frontSpan = 10.5 / max(0.75, pocketSteepBoost * 0.85);
            float u = min(1.0, dz / frontSpan);
            float curve = pow(max(0.0, 1.0 - u), 1.85);
            waveY = localH * curve;
            if (u < 0.999) {
              dWaveDz = -localH * 1.85 * pow(max(0.0001, 1.0 - u), 0.85) / frontSpan;
            }
          } else {
            float backSpan = 19.0;
            float u = min(1.0, -dz / backSpan);
            float curve = pow(max(0.0, 1.0 - u), 1.55);
            waveY = localH * curve;
            if (u < 0.999) {
              dWaveDz = localH * 1.55 * pow(max(0.0001, 1.0 - u), 0.55) / backSpan;
            }
          }
          float shoulderSlopeFactor = -0.006 * uBreakDir * smoothstep(6.0, 55.0, relBreak);
          dWaveDx = waveY * shoulderSlopeFactor;
        }

        // Distant horizon groundswell lines rolling in behind the active wave (strictly dz < -24)
        float distantFade = smoothstep(-24.0, -48.0, dz) * (1.0 - smoothstep(-320.0, -490.0, z));
        float ph1 = z * 0.105 - t * 1.15 + x * 0.008;
        float ph2 = z * 0.072 - t * 0.85 - x * 0.006 + 1.7;
        float sw1 = 0.5 + 0.5 * sin(ph1);
        float sw2 = 0.5 + 0.5 * sin(ph2);
        float distantSwellY = distantFade * (pow(sw1, 2.3) * 0.95 + pow(sw2, 2.1) * 0.65);
        float dDistantDz = distantFade * (2.3 * pow(max(0.001, sw1), 1.3) * 0.5 * cos(ph1) * 0.105 * 0.95
                                        + 2.1 * pow(max(0.001, sw2), 1.1) * 0.5 * cos(ph2) * 0.072 * 0.65);

        float wwTurb = 0.0;
        float wwFoamMask = 0.0;
        if (breakProgress > 0.04 && relBreak < 2.0 && dz >= -2.5 && dz <= 9.5) {
          float wwStrength = smoothstep(0.0, 6.0, 2.0 - relBreak) * breakProgress;
          float frontFade = 1.0 - smoothstep(4.0, 9.5, dz);
          wwTurb = wwStrength * frontFade * (sin(x * 0.75 + t * 5.5) * 0.14 + cos(z * 0.9 - t * 6.8) * 0.12 + 0.18);
          wwFoamMask = wwStrength * frontFade;
        }

        // Extra lip crest foam along breaking edge (scales in as wave shoals over reef)
        float lipFoam = exp(-pow(dz / 1.4, 2.0))
                      * smoothstep(-2.0, 6.0, relBreak)
                      * (1.0 - smoothstep(10.0, 26.0, relBreak))
                      * smoothstep(0.15, 0.72, breakProgress);
        float distantCrest = distantFade * smoothstep(0.75, 1.35, distantSwellY) * smoothstep(-260.0, -70.0, z) * 0.42;

        outPos = vec3(x, swellBase + waveY + distantSwellY + wwTurb, z);
        outNormal = normalize(vec3(-(dWaveDx + dSwellDx), 1.0, -(dWaveDz + dSwellDz + dDistantDz)));
        outCrest = clamp(lipFoam * 0.85 + wwFoamMask * 0.75 + distantCrest, 0.0, 1.0);
        outWW = clamp(wwFoamMask + lipFoam * 0.65, 0.0, 1.0);
      }

      void main() {
        vec3 pos = position;
        float seabedY = getSeabedHeight(pos.x, pos.z);
        float rawDepth = max(0.0, -seabedY);

        float swashPhase = sin(uTime * 0.82 * uWaveSpeed - pos.x * 0.045) * 0.5
                         + sin(uTime * 0.41 * uWaveSpeed + pos.x * 0.025) * 0.5;

        vec3 finalPos;
        if (uSurfMode <= 0.001) {
          float shoal = smoothstep(0.15, 3.6, rawDepth);
          float outerBarPeak = exp(-pow((rawDepth - 2.9) / 2.6, 2.0)) * 0.48;
          float horizonRoll = smoothstep(-440.0, -140.0, pos.z);
          float ampScale = uWaveAmplitude * (0.20 + 0.80 * shoal + outerBarPeak) * (0.65 + 0.35 * horizonRoll);

          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 0.0, 1.0);
          vec3 offset = vec3(0.0);

          float wlBase = 1.0 / max(0.03, uWaveFrequency);
          offset += gerstnerWave(pos.xz, vec2(0.14, 0.99), 0.27 + uChoppiness * 0.14, wlBase * 3.4, 1.0, ampScale, tangent, binormal);
          offset += gerstnerWave(pos.xz, vec2(-0.12, 0.99), 0.21 + uChoppiness * 0.11, wlBase * 2.25, 1.06, ampScale, tangent, binormal);
          offset += gerstnerWave(pos.xz, vec2(0.28, 0.96), 0.14 + uChoppiness * 0.09, wlBase * 1.4, 0.96, ampScale, tangent, binormal);
          offset += gerstnerWave(pos.xz, vec2(-0.34, 0.94), 0.09 + uChoppiness * 0.07, wlBase * 0.82, 1.12, ampScale, tangent, binormal);
          offset += gerstnerWave(pos.xz, vec2(0.52, 0.85), 0.06 + uChoppiness * 0.06, wlBase * 0.48, 1.24, ampScale * 0.8, tangent, binormal);
          offset += gerstnerWave(pos.xz, vec2(-0.46, 0.89), 0.05 + uChoppiness * 0.05, wlBase * 0.31, 1.35, ampScale * 0.7, tangent, binormal);

          float nearShoreMask = 1.0 - smoothstep(0.0, 2.4, rawDepth);
          offset.y += swashPhase * 0.16 * nearShoreMask;

          finalPos = pos + offset;
          vNormal = normalize(cross(binormal, tangent));
          float breakingZone = smoothstep(0.28, 1.6, rawDepth) * (1.0 - smoothstep(4.2, 8.8, rawDepth));
          float crestHeight = smoothstep(0.22 * uWaveAmplitude, 0.92 * uWaveAmplitude, offset.y);
          float pitchForward = clamp(vNormal.z * 0.95, 0.0, 1.0);
          vCrestFactor = clamp(crestHeight * (0.42 + 1.05 * breakingZone) + pitchForward * 0.52 * breakingZone, 0.0, 1.0);
          vSurfWhitewater = 0.0;
        } else if (uSurfMode >= 0.999) {
          vec3 surfPos;
          vec3 surfNormal;
          float surfCrest;
          float surfWW;
          evaluateSurfWave(pos, surfPos, surfNormal, surfCrest, surfWW);
          finalPos = surfPos;
          vNormal = surfNormal;
          vCrestFactor = surfCrest;
          vSurfWhitewater = surfWW;
        } else {
          // Menu Gerstner Ocean during brief transition into surfing
          float shoal = smoothstep(0.15, 3.6, rawDepth);
          float outerBarPeak = exp(-pow((rawDepth - 2.9) / 2.6, 2.0)) * 0.48;
          float horizonRoll = smoothstep(-440.0, -140.0, pos.z);
          float ampScale = uWaveAmplitude * (0.20 + 0.80 * shoal + outerBarPeak) * (0.65 + 0.35 * horizonRoll);

          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 0.0, 1.0);
          vec3 offset = vec3(0.0);

          float wlBase = 1.0 / max(0.03, uWaveFrequency);
          offset += gerstnerWave(pos.xz, vec2(0.14, 0.99), 0.27 + uChoppiness * 0.14, wlBase * 3.4, 1.0, ampScale, tangent, binormal);
          offset += gerstnerWave(pos.xz, vec2(-0.12, 0.99), 0.21 + uChoppiness * 0.11, wlBase * 2.25, 1.06, ampScale, tangent, binormal);
          offset += gerstnerWave(pos.xz, vec2(0.28, 0.96), 0.14 + uChoppiness * 0.09, wlBase * 1.4, 0.96, ampScale, tangent, binormal);
          offset += gerstnerWave(pos.xz, vec2(-0.34, 0.94), 0.09 + uChoppiness * 0.07, wlBase * 0.82, 1.12, ampScale, tangent, binormal);
          offset += gerstnerWave(pos.xz, vec2(0.52, 0.85), 0.06 + uChoppiness * 0.06, wlBase * 0.48, 1.24, ampScale * 0.8, tangent, binormal);
          offset += gerstnerWave(pos.xz, vec2(-0.46, 0.89), 0.05 + uChoppiness * 0.05, wlBase * 0.31, 1.35, ampScale * 0.7, tangent, binormal);

          float nearShoreMask = 1.0 - smoothstep(0.0, 2.4, rawDepth);
          offset.y += swashPhase * 0.16 * nearShoreMask;

          vec3 menuPos = pos + offset;
          vec3 menuNormal = normalize(cross(binormal, tangent));
          float breakingZone = smoothstep(0.28, 1.6, rawDepth) * (1.0 - smoothstep(4.2, 8.8, rawDepth));
          float crestHeight = smoothstep(0.22 * uWaveAmplitude, 0.92 * uWaveAmplitude, offset.y);
          float pitchForward = clamp(menuNormal.z * 0.95, 0.0, 1.0);
          float menuCrest = clamp(crestHeight * (0.42 + 1.05 * breakingZone) + pitchForward * 0.52 * breakingZone, 0.0, 1.0);

          vec3 surfPos;
          vec3 surfNormal;
          float surfCrest;
          float surfWW;
          evaluateSurfWave(pos, surfPos, surfNormal, surfCrest, surfWW);

          finalPos = mix(menuPos, surfPos, uSurfMode);
          vNormal = normalize(mix(menuNormal, surfNormal, uSurfMode));
          vCrestFactor = mix(menuCrest, surfCrest, uSurfMode);
          vSurfWhitewater = surfWW * uSurfMode;
        }

        vWorldPos = (modelMatrix * vec4(finalPos, 1.0)).xyz;
        vSeabedY = seabedY;
        vSwashSurge = swashPhase;

        gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uWaveSpeed;
      uniform float uSurfMode;
      uniform float uSurfSimTime;
      uniform vec3 uShallowColor;
      uniform vec3 uDeepColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uZenithColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform sampler2D uWaterNormal;
      uniform sampler2D uFoamNoise;
      uniform float uOvercast;
      uniform float uRain;
      uniform float uWaterDetail;
      uniform float uReflections;

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vCrestFactor;
      varying float vSeabedY;
      varying float vSwashSurge;
      varying float vSurfWhitewater;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        float rippleTime = mix(uTime, uSurfSimTime, uSurfMode);

        // Dual-scrolling high-frequency capillary ripples
        vec2 uv1 = vWorldPos.xz * 0.045 + vec2(rippleTime * 0.024, rippleTime * 0.036 * uWaveSpeed);
        vec2 uv2 = vWorldPos.xz * 0.115 - vec2(rippleTime * 0.031, -rippleTime * 0.021 * uWaveSpeed);
        vec3 n1 = texture2D(uWaterNormal, uv1).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uWaterNormal, uv2).xyz * 2.0 - 1.0;

        float camDist = length(cameraPosition - vWorldPos);
        float detailFade = 1.0 - smoothstep(45.0, 260.0, camDist);

        vec3 N = normalize(
          vNormal + vec3(n1.x + n2.x * 0.65, 0.0, n1.y + n2.y * 0.65) * (0.18 + uRain * 0.11) * detailFade
        );

        // Raindrop surface patter micro-ripples when raining
        float rainSparkle = 0.0;
        if (uRain > 0.02 && camDist < 120.0) {
          float p1 = sin(vWorldPos.x * 7.5 + rippleTime * 19.0) * cos(vWorldPos.z * 7.9 - rippleTime * 17.0);
          float p2 = sin(vWorldPos.x * 13.0 - rippleTime * 23.0 + 1.4) * cos(vWorldPos.z * 12.2 + rippleTime * 21.0);
          rainSparkle = smoothstep(0.55, 0.98, 0.5 + 0.5 * (p1 * p2)) * uRain * (1.0 - smoothstep(30.0, 120.0, camDist));
          N = normalize(N + vec3(p1, 0.0, p2) * 0.06 * uRain * detailFade);
        }

        // Water depth relative to sandy seabed
        float waterDepth = vWorldPos.y - vSeabedY;
        float shoreAlpha = smoothstep(-0.02, 0.14, waterDepth);
        if (shoreAlpha < 0.01) discard;

        // Beer-Lambert depth color absorption + crystal shallow visibility for coral reef & fish
        // Overcast & rain dampen vivid turquoise toward deeper storm-slate teal
        float depthRatio = 1.0 - exp(-max(0.0, waterDepth) * 0.32);
        vec3 activeShallow = mix(uShallowColor, vec3(0.11, 0.32, 0.35), clamp(uOvercast * 0.55 + uRain * 0.35, 0.0, 0.85));
        vec3 activeDeep = mix(uDeepColor, vec3(0.02, 0.11, 0.17), clamp(uOvercast * 0.5 + uRain * 0.4, 0.0, 0.85));
        vec3 waterBodyColor = mix(activeShallow, activeDeep, depthRatio);

        float clarity = exp(-max(0.0, waterDepth) * 0.95) * (1.0 - uRain * 0.42);
        vec3 sandTint = vec3(0.76, 0.71, 0.58) * (1.0 - uOvercast * 0.25);
        waterBodyColor = mix(waterBodyColor, sandTint * 0.85, clarity * 0.45);

        // Sunlit underwater caustics shimmering over shallow sandbar & coral reef (fade under clouds & far distance)
        float sunFactor = (1.0 - uOvercast * 0.72) * (1.0 - uRain * 0.65);
        if (uWaterDetail > 0.5 && camDist < 125.0) {
          float causticZone = smoothstep(0.15, 0.8, waterDepth) * (1.0 - smoothstep(3.2, 8.8, waterDepth));
          float c1 = sin(vWorldPos.x * 1.15 + rippleTime * 1.6 + cos(vWorldPos.z * 1.05 - rippleTime * 1.2));
          float c2 = cos(vWorldPos.z * 1.35 + rippleTime * 1.4 - sin(vWorldPos.x * 0.95 + rippleTime * 1.1));
          float causticNet = pow(clamp(0.5 + 0.5 * (c1 * c2), 0.0, 1.0), 4.0);
          waterBodyColor += vec3(0.28, 0.62, 0.58) * causticNet * causticZone * 0.55 * sunFactor * uWaterDetail;
        }

        // Subsurface scattering inside backlit curling wave faces
        float sssMask = pow(max(0.0, dot(V, -L + N * 0.55)), 3.0) * (0.4 + 0.6 * vCrestFactor);
        vec3 sssColor = mix(vec3(0.18, 0.82, 0.78), vec3(0.14, 0.44, 0.46), uOvercast * 0.7);
        waterBodyColor += sssColor * sssMask * 0.45 * (0.35 + 0.65 * sunFactor);

        // Schlick Fresnel sky & horizon reflection (controlled by uReflections)
        float cosTheta = max(dot(N, V), 0.0);
        float fresnel = 0.02 + 0.98 * pow(1.0 - cosTheta, 5.0);
        vec3 color = waterBodyColor;
        if (uReflections > 0.5) {
          vec3 R = reflect(-V, N);
          float skyGrad = smoothstep(-0.05, 0.55, max(R.y, 0.0));
          vec3 stormZenith = mix(uZenithColor * 1.15, vec3(0.20, 0.25, 0.30), clamp(uOvercast * 0.8 + uRain * 0.2, 0.0, 1.0));
          vec3 skyRefl = mix(uHorizonColor * 0.95, stormZenith, skyGrad);
          float sunReflGlow = pow(max(dot(R, L), 0.0), 8.0) * sunFactor;
          skyRefl += uSunColor * sunReflGlow * 0.35;
          color = mix(waterBodyColor, skyRefl, clamp(fresnel * 0.88, 0.0, 0.92));
        } else {
          color = mix(waterBodyColor, uHorizonColor * 0.75, clamp(fresnel * 0.32, 0.0, 0.35));
        }

        // GGX-inspired crisp sun specular shimmer (diffused in overcast/rain)
        vec3 H = normalize(L + V);
        float NdotH = max(dot(N, H), 0.0);
        float specTight = pow(NdotH, 320.0) * 2.8 * sunFactor;
        float specBroad = pow(NdotH, 36.0) * 0.24 * (0.35 + 0.65 * sunFactor);
        color += uSunColor * (specTight + specBroad);
        color += vec3(0.55, 0.65, 0.72) * rainSparkle * 0.16;

        // Procedural cellular whitewater foam
        vec2 foamUv1 = vWorldPos.xz * 0.095 + vec2(0.0, -rippleTime * 0.055 * uWaveSpeed);
        vec2 foamUv2 = vWorldPos.xz * 0.24 + vec2(rippleTime * 0.02, -rippleTime * 0.08 * uWaveSpeed);
        float fTex1 = texture2D(uFoamNoise, foamUv1).r;
        float fTex2 = texture2D(uFoamNoise, foamUv2).r;
        float foamPattern = fTex1 * 0.65 + fTex2 * 0.45;

        float crestFoam = smoothstep(0.38, 0.82, vCrestFactor * (0.58 + 0.72 * foamPattern));
        float wwFoam = smoothstep(0.15, 0.65, vSurfWhitewater * (0.65 + 0.65 * foamPattern));

        float swashBand = (1.0 - smoothstep(0.02, 0.48, waterDepth)) * smoothstep(-0.01, 0.06, waterDepth);
        float swashLace = smoothstep(0.24, 0.68, swashBand * (0.55 + 0.75 * foamPattern) + (vSwashSurge * 0.12));

        float totalFoam = clamp(max(max(crestFoam, wwFoam), swashLace * 0.95), 0.0, 1.0);

        float foamLit = (0.72 + 0.28 * max(dot(N, L), 0.0)) * (1.0 - uOvercast * 0.22 - uRain * 0.16);
        vec3 foamColor = mix(vec3(0.68, 0.78, 0.84), vec3(0.95, 0.95, 0.93), clamp(foamLit, 0.0, 1.0));
        color = mix(color, foamColor, totalFoam * 0.94);

        // Exponential distance fog (reduces distant wave visibility in overcast/rain)
        float fogFactor = 1.0 - exp(-pow(camDist * uFogDensity, 2.0));
        color = mix(color, uFogColor, clamp(fogFactor, 0.0, 1.0));

        // Crystal-clear shallow reef translucency (slightly cloudier in storm/rain)
        float reefTranslucency = mix(0.68 + uRain * 0.18, 0.96, smoothstep(0.8, 6.2, waterDepth));
        float finalAlpha = mix(shoreAlpha * reefTranslucency, 1.0, clamp(totalFoam + fresnel * 0.45, 0.0, 1.0));

        gl_FragColor = vec4(color, finalAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = false;

  return {
    mesh,
    material,
    rebuildDetail: (quality: WaterQualityTier) => {
      const next = buildOceanGeometry(quality);
      mesh.geometry.dispose();
      mesh.geometry = next;
      geometry = next;
      material.uniforms.uWaterDetail.value =
        quality === 'high' ? 1.0 : quality === 'medium' ? 0.72 : 0.35;
    },
  };
}
