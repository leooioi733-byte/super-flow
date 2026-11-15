import * as THREE from 'three';
import { getWaveShoaling, SurfWaveParams } from './wavePhysics';

export interface BarrelCurlSystem {
  mesh: THREE.Mesh;
  update: (
    params: SurfWaveParams,
    shallowColor: THREE.Color,
    deepColor: THREE.Color,
    sunDir: THREE.Vector3,
    overcast?: number,
    rain?: number
  ) => void;
  dispose: () => void;
}

/**
 * Dynamic 3D overhanging curling wave lip & hollow barrel tunnel mesh.
 * Attaches seamlessly along the crest of the active surfing wave, arching
 * forward over the trough to form a translucent turquoise barrel roof and
 * tumbling whitewater lip.
 */
export function createBarrelCurlSystem(foamNoise: THREE.Texture): BarrelCurlSystem {
  const segAlong = 72; // along X (from broken whitewater through barrel curl onto shoulder)
  const segArc = 16;   // along the curling arch from crest -> lip tip

  const geometry = new THREE.BufferGeometry();
  const vertexCount = (segAlong + 1) * (segArc + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint16Array(segAlong * segArc * 6);
  let ptr = 0;

  for (let i = 0; i <= segAlong; i++) {
    for (let j = 0; j <= segArc; j++) {
      const idx = i * (segArc + 1) + j;
      uvs[idx * 2] = i / segAlong;
      uvs[idx * 2 + 1] = j / segArc;
    }
  }

  for (let i = 0; i < segAlong; i++) {
    for (let j = 0; j < segArc; j++) {
      const a = i * (segArc + 1) + j;
      const b = a + 1;
      const c = a + (segArc + 1);
      const d = c + 1;
      indices[ptr++] = a;
      indices[ptr++] = c;
      indices[ptr++] = b;
      indices[ptr++] = b;
      indices[ptr++] = c;
      indices[ptr++] = d;
    }
  }

  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const normAttr = new THREE.BufferAttribute(normals, 3);
  normAttr.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('normal', normAttr);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  // Precompute v^1.62 once at creation time (zero per-frame allocations)
  const vPow = new Float32Array(segArc + 1);
  for (let j = 0; j <= segArc; j++) {
    vPow[j] = Math.pow(j / segArc, 1.62);
  }

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uShallowColor: { value: new THREE.Color('#26b6ad') },
      uDeepColor: { value: new THREE.Color('#063354') },
      uSunDir: { value: new THREE.Vector3(-0.3, 0.3, -0.9).normalize() },
      uFoamNoise: { value: foamNoise },
      uOvercast: { value: 0.0 },
      uRain: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uShallowColor;
      uniform vec3 uDeepColor;
      uniform vec3 uSunDir;
      uniform sampler2D uFoamNoise;
      uniform float uOvercast;
      uniform float uRain;

      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);
        vec3 N = normalize(vNormalW);

        // Moving textured foam ribbons rushing down the curling lip
        vec2 fUv1 = vec2(vUv.x * 7.5 + uTime * 0.15, vUv.y * 2.2 - uTime * 1.45);
        vec2 fUv2 = vec2(vUv.x * 14.0 - uTime * 0.1, vUv.y * 3.8 - uTime * 2.1);
        float foam1 = texture2D(uFoamNoise, fUv1).r;
        float foam2 = texture2D(uFoamNoise, fUv2).r;
        float foamMix = foam1 * 0.65 + foam2 * 0.45;

        // Tip of the curling lip + broken whitewater zone turns foamy white
        float lipTipMask = smoothstep(0.48, 0.96, vUv.y);
        float brokenEndMask = 1.0 - smoothstep(0.18, 0.56, vUv.x);
        float shoulderFade = 1.0 - smoothstep(0.72, 0.98, vUv.x);
        float brokenFade = smoothstep(0.02, 0.14, vUv.x);

        // Translucent sunlit turquoise inside the upper barrel wall, darker shadow beneath
        float sunVis = (1.0 - uOvercast * 0.7) * (1.0 - uRain * 0.5);
        float backlit = pow(max(0.0, dot(V, -L + N * 0.35)), 2.2) * (0.35 + 0.65 * sunVis);
        vec3 stormShallow = mix(uShallowColor, vec3(0.11, 0.32, 0.35), clamp(uOvercast * 0.55 + uRain * 0.35, 0.0, 0.85));
        vec3 stormDeep = mix(uDeepColor, vec3(0.02, 0.11, 0.17), clamp(uOvercast * 0.5 + uRain * 0.4, 0.0, 0.85));
        vec3 baseWater = mix(stormDeep * 0.82, stormShallow * 1.15, 0.45 + 0.55 * backlit);
        baseWater += vec3(0.22, 0.85, 0.80) * backlit * 0.38;

        // Interior barrel shadow vs exterior sun glint
        float lightDiff = (0.45 + 0.55 * max(dot(N, L), 0.0)) * (1.0 - uOvercast * 0.25 - uRain * 0.18);
        baseWater *= lightDiff;

        float foamAmount = clamp(
          (lipTipMask * 0.72 + brokenEndMask * 0.62) * (0.45 + 0.85 * foamMix),
          0.0,
          1.0
        );
        vec3 foamColor = mix(vec3(0.68, 0.79, 0.85), vec3(0.96, 0.95, 0.92), clamp(lightDiff, 0.0, 1.0));
        vec3 color = mix(baseWater, foamColor, foamAmount);

        float alpha = clamp(
          (0.62 + foamAmount * 0.36) * shoulderFade * brokenFade * smoothstep(0.0, 0.12, vUv.y),
          0.0,
          0.96
        );
        if (alpha < 0.02) discard;

        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 4;

  const update = (
    params: SurfWaveParams,
    shallowColor: THREE.Color,
    deepColor: THREE.Color,
    sunDir: THREE.Vector3,
    overcast = 0,
    rain = 0
  ) => {
    const { heightScale, breakProgress } = getWaveShoaling(params.waveCenterZ);
    const curlReveal = THREE.MathUtils.smoothstep(breakProgress, 0.18, 0.74);
    mesh.visible = params.enabled && curlReveal > 0.02;
    if (!mesh.visible) return;

    material.uniforms.uTime.value = params.simTime;
    material.uniforms.uShallowColor.value.copy(shallowColor);
    material.uniforms.uDeepColor.value.copy(deepColor);
    material.uniforms.uSunDir.value.copy(sunDir);
    material.uniforms.uOvercast.value = overcast;
    material.uniforms.uRain.value = rain;

    const t = params.simTime;
    // Span from well behind breakX (broken whitewater) to shoulder ahead of breakX
    const startRel = -22;
    const endRel = 20;

    for (let i = 0; i <= segAlong; i++) {
      const u = i / segAlong;
      const relBreak = startRel + (endRel - startRel) * u;
      const wx = params.breakX + relBreak * params.breakDir;

      // Local height matching sampleSurfWave crest
      const swellBase =
        Math.sin(params.waveCenterZ * 0.065 - t * 1.35 + wx * 0.01) * 0.28 +
        Math.cos(params.waveCenterZ * 0.12 - t * 1.9 - wx * 0.03) * 0.11;
      const shoulderTaper = 1.0 - THREE.MathUtils.smoothstep(relBreak, 14, 72) * 0.42;
      const whitewaterDamp = 1.0 - THREE.MathUtils.smoothstep(-relBreak, 4, 28) * (0.14 + 0.22 * breakProgress);
      const localH = params.waveHeight * heightScale * shoulderTaper * whitewaterDamp;

      // Curl arch amount: builds naturally as wave pitches over the reef
      const curlStrength =
        params.barrelFactor *
        curlReveal *
        (1.0 - THREE.MathUtils.smoothstep(relBreak, 6.5, 19.5)) *
        THREE.MathUtils.smoothstep(relBreak, -21.5, -3.0);

      // Spacious hollow arch on large set waves so the surfer fits comfortably inside the tube
      const bigTubeScale = localH >= 3.0 ? 1.18 : 1.0;
      const archRadiusZ = (1.25 + localH * 0.82 * bigTubeScale) * (0.28 + 0.72 * curlStrength);
      const dropY = localH * (0.22 + 0.72 * curlStrength);
      const thetaStep = (Math.PI * (0.68 + 0.46 * curlStrength)) / segArc;
      const archLiftAmp = localH * 0.22 * curlStrength * bigTubeScale;
      const crestBaseY = swellBase + localH * 1.02;

      for (let j = 0; j <= segArc; j++) {
        const theta = j * thetaStep;
        const cz = params.waveCenterZ + Math.sin(theta * 0.72) * archRadiusZ * 1.48;
        const cy = crestBaseY + Math.sin(theta) * archLiftAmp - vPow[j] * dropY;

        const idx = i * (segArc + 1) + j;
        posAttr.setXYZ(idx, wx, cy, cz);

        const ny = Math.cos(theta * 0.75);
        const nz = Math.sin(theta * 0.75);
        normAttr.setXYZ(idx, 0, ny, nz);
      }
    }

    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
  };

  return {
    mesh,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
