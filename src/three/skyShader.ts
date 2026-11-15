import * as THREE from 'three';

export interface SkySystem {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

export function createSkySystem(): SkySystem {
  const geometry = new THREE.SphereGeometry(900, 48, 32);

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-0.32, 0.25, -0.91).normalize() },
      uCloudDensity: { value: 0.42 },
      uWindStrength: { value: 0.6 },
      uHorizonColor: { value: new THREE.Color('#eed3ad') },
      uZenithColor: { value: new THREE.Color('#1a5286') },
      uSunColor: { value: new THREE.Color('#fff2d6') },
      uOvercast: { value: 0.0 },
      uRain: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uCloudDensity;
      uniform float uWindStrength;
      uniform vec3 uHorizonColor;
      uniform vec3 uZenithColor;
      uniform vec3 uSunColor;
      uniform float uOvercast;
      uniform float uRain;

      varying vec3 vWorldDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = rot * p * 2.02;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float elev = clamp(dir.y, 0.0, 1.0);

        // Late afternoon atmospheric sky gradient modulated by overcast & rain
        float horizonFactor = pow(1.0 - elev, 2.8);
        vec3 sunnyMid = vec3(0.42, 0.66, 0.84);
        vec3 stormMid = mix(vec3(0.36, 0.44, 0.51), vec3(0.18, 0.24, 0.30), uRain);
        vec3 activeMid = mix(sunnyMid, stormMid, uOvercast);
        vec3 zenithCol = mix(uZenithColor, mix(vec3(0.24, 0.31, 0.38), vec3(0.11, 0.16, 0.22), uRain), uOvercast);

        vec3 midSky = mix(zenithCol, activeMid, pow(1.0 - elev, 1.25));
        vec3 skyColor = mix(midSky, uHorizonColor, horizonFactor * (0.88 + 0.10 * uOvercast));

        // Sun scattering & disc (dims behind overcast and storm cloud cover)
        float sunVis = (1.0 - uOvercast * 0.84) * (1.0 - uRain * 0.75);
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float mieGlow = (pow(sunDot, 7.0) * 0.36 + pow(sunDot, 42.0) * 0.45) * (1.0 - uOvercast * 0.72);
        float sunDisc = smoothstep(0.99935, 0.99985, sunDot) * sunVis;
        skyColor += vec3(1.0, 0.78, 0.50) * mieGlow * (0.45 + 0.55 * horizonFactor);
        skyColor = mix(skyColor, uSunColor * 1.35, sunDisc);

        // Scattered drifting clouds projected onto upper sky plane
        if (dir.y > 0.015) {
          vec2 cloudUv = dir.xz / (dir.y + 0.14);
          vec2 drift = vec2(uTime * 0.011 * (0.5 + uWindStrength), uTime * 0.004);
          float c1 = fbm(cloudUv * 0.75 + drift);
          float c2 = fbm(cloudUv * 1.65 - drift * 0.6 + vec2(4.2, 1.7));
          float cloudShape = c1 * 0.72 + c2 * 0.28;

          float effectiveDensity = clamp(mix(uCloudDensity, 0.92, uOvercast * 0.85) + uRain * 0.08, 0.0, 1.0);
          float threshold = mix(0.66, 0.24, effectiveDensity);
          float cloudAlpha = smoothstep(threshold, threshold + mix(0.22, 0.16, uOvercast), cloudShape);
          // Fade clouds smoothly near horizon to avoid hard cutoff
          cloudAlpha *= smoothstep(0.015, 0.14, dir.y);

          // Sunlit warm tops vs cool shaded storm undersides
          float sunLit = smoothstep(threshold - 0.05, threshold + 0.32, cloudShape + sunDot * 0.18 * sunVis);
          vec3 sunnyShadow = mix(vec3(0.56, 0.64, 0.74), vec3(0.76, 0.72, 0.74), horizonFactor);
          vec3 stormShadow = mix(vec3(0.32, 0.37, 0.44), vec3(0.16, 0.20, 0.26), uRain);
          vec3 cloudShadow = mix(sunnyShadow, stormShadow, uOvercast);

          vec3 sunnyBright = mix(vec3(0.98, 0.96, 0.93), vec3(1.0, 0.88, 0.72), sunDot * 0.7 + horizonFactor * 0.4);
          vec3 stormBright = mix(vec3(0.56, 0.61, 0.67), vec3(0.34, 0.39, 0.46), uRain);
          vec3 cloudBright = mix(sunnyBright, stormBright, uOvercast);
          vec3 cloudCol = mix(cloudShadow, cloudBright, sunLit);

          skyColor = mix(skyColor, cloudCol, cloudAlpha * mix(0.82, 0.94, uOvercast));
        }

        // Below horizon match atmospheric haze seamlessly
        if (dir.y <= 0.0) {
          skyColor = mix(uHorizonColor, vec3(0.06, 0.20, 0.32), clamp(-dir.y * 4.0, 0.0, 1.0));
        }

        gl_FragColor = vec4(skyColor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  return { mesh, material };
}
