import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { oceanAudio } from '../audio/oceanAudio';
import { InterviewTone, VictoryCutsceneKind } from '../types/career';
import {
  BeachAtmosphere,
  BeachEnvironmentConfig,
  BeachTheme,
  CameraMode,
  GraphicsSettings,
  MenuScreen,
  ReplayCameraAngle,
  SurfboardSpec,
  SurferProfile,
  SurfHUDState,
  SurfInputState,
  WeatherCondition,
  WeatherMode,
} from '../types/game';
import { BarrelCurlSystem, createBarrelCurlSystem } from './barrelCurlSystem';
import { BeachLifeSystem, createBeachLifeSystem } from './beachLifeSystem';
import {
  CoastalEnvironment,
  createCoastalEnvironment,
  createSurfboardGroup,
} from './coastalEnvironment';
import {
  createInterviewStageSystem,
  InterviewCameraPhase,
  InterviewStageSystem,
} from './interviewStageSystem';
import { createMarineLifeSystem, MarineLifeSystem } from './marineLifeSystem';
import {
  CareerHeatNpcSpec,
  createNpcSurferSystem,
  NpcSurferSystem,
} from './npcSurferSystem';
import { createOceanSystem, getBeachHeightAt, OceanSystem } from './oceanShader';
import { createProceduralTextures, ProceduralTextureSet } from './proceduralTextures';
import { createRainSystem, RainSystem } from './rainSystem';
import { ReplayBuffer } from './replayBuffer';
import { createSkySystem, SkySystem } from './skyShader';
import { createSurferRig, SurferRig } from './surferCharacter';
import {
  createVictoryCeremonyProps,
  VictoryCeremonyProps,
} from './victoryCeremonyProps';
import { createWaterParticleSystem, WaterParticleSystem } from './waterParticles';
import {
  sampleSurfWave,
  SURF_SPEED_KMH_FACTOR,
  SurferPhysicsState,
  SurfPhysicsEngine,
  SurfWaveParams,
} from './wavePhysics';

// Pre-allocated math helpers (zero GC inside animation loop)
const _camPosTarget = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _currentLook = new THREE.Vector3(8, 1.1, -55);
const _tpCurPos = new THREE.Vector3(-4, 4.4, 24);
const _tpQuat = new THREE.Quaternion();
const _tpLookMat = new THREE.Matrix4();
const _fpPos = new THREE.Vector3();
const _fpQuat = new THREE.Quaternion();
const _cutCamPos = new THREE.Vector3();
const _cutLookTarget = new THREE.Vector3();
const _vicPos = new THREE.Vector3();
const _vicBoardPos = new THREE.Vector3();
const _vicTrophyPos = new THREE.Vector3();
const _vicNormal = new THREE.Vector3(0, 1, 0);
const _intvSurferPos = new THREE.Vector3();
const _intvBoardPos = new THREE.Vector3();
const _intvShadowFocus = new THREE.Vector3();
const _prevCamPos = new THREE.Vector3(-4, 4.4, 24);
const _camDelta = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _bankQuat = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _sunDir = new THREE.Vector3();
const _targetShallowColor = new THREE.Color();
const _targetDeepColor = new THREE.Color();
const _targetHorizonColor = new THREE.Color();
const _targetFogColor = new THREE.Color();
const _warmHorizonColor = new THREE.Color('#efd0a6');
const _warmFogColor = new THREE.Color('#e3c8a4');
const _overcastHorizonColor = new THREE.Color('#9fb0be');
const _rainHorizonColor = new THREE.Color('#6b7e8e');
const _overcastFogColor = new THREE.Color('#98abb8');
const _rainFogColor = new THREE.Color('#647686');
const _sunWarmColor = new THREE.Color('#ffdfba');
const _sunOvercastColor = new THREE.Color('#c7d4df');
const _sunRainColor = new THREE.Color('#8ea2b3');
const _hemiSkySunny = new THREE.Color('#9ec7e8');
const _hemiSkyStorm = new THREE.Color('#6f8496');
const _hemiGroundSunny = new THREE.Color('#bfa98a');
const _hemiGroundStorm = new THREE.Color('#4f5e69');
const _rimSunny = new THREE.Color('#62b6cb');
const _rimStorm = new THREE.Color('#5c7b8c');

function lerpAngleRad(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * Combined post-processing shader for subtle surfing speed blur, temporary water-impact
 * focus loss, refracting lens water droplets, whitewater screen wash, and underwater tint.
 */
const SurfCameraFXShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uAspect: { value: 1.777 },
    uBlurStrength: { value: 0.0 },
    uImpactBlur: { value: 0.0 },
    uDroplets: { value: 0.0 },
    uWhitewater: { value: 0.0 },
    uUnderwater: { value: 0.0 },
    uSlowMoGray: { value: 0.0 },
    uVelocityDir: { value: new THREE.Vector2(0.0, 0.0) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAspect;
    uniform float uBlurStrength;
    uniform float uImpactBlur;
    uniform float uDroplets;
    uniform float uWhitewater;
    uniform float uUnderwater;
    uniform float uSlowMoGray;
    uniform vec2 uVelocityDir;
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    // Procedural refracting water droplet layer on camera lens
    vec3 lensDropletLayer(vec2 uv, float scale, float slideSpeed) {
      vec2 aspectUv = vec2(uv.x * uAspect, uv.y) * scale;
      float colId = floor(aspectUv.x);
      float colRand = hash21(vec2(colId, scale));
      aspectUv.y += uTime * slideSpeed * (0.55 + colRand * 0.7) + colRand * 8.0;

      vec2 id = floor(aspectUv);
      vec2 gv = fract(aspectUv) - 0.5;
      float n = hash21(id);

      if (n < 0.52) return vec3(0.0);

      vec2 offset = (vec2(n, fract(n * 17.3)) - 0.5) * 0.42;
      vec2 d = gv - offset;
      d.y *= 0.78; // teardrop vertical stretch

      float r = 0.14 + fract(n * 31.7) * 0.14;
      float dist = length(d);
      float mask = smoothstep(r, r * 0.35, dist);
      float rim = smoothstep(r, r * 0.72, dist) * (1.0 - smoothstep(r * 0.65, r * 0.2, dist));

      return vec3(-d * mask * 0.16, rim * 0.25);
    }

    void main() {
      vec2 uv = vUv;

      // 1. Dynamic water distortion during impact wash or underwater plunge
      float distortAmt = uUnderwater * 0.011 + uWhitewater * 0.0065;
      if (distortAmt > 0.0005) {
        uv.x += sin(uv.y * 22.0 + uTime * 7.5) * distortAmt;
        uv.y += cos(uv.x * 18.0 - uTime * 6.2) * distortAmt * 0.8;
      }

      // 2. Camera lens water droplets (refracting & sliding down)
      float dropSpecular = 0.0;
      if (uDroplets > 0.01) {
        vec3 d1 = lensDropletLayer(uv, 6.5, 0.22);
        vec3 d2 = lensDropletLayer(uv + vec2(0.37, 0.19), 11.0, 0.34);
        vec2 refractOffset = (d1.xy + d2.xy * 0.7) * uDroplets;
        uv = clamp(uv + refractOffset, 0.002, 0.998);
        dropSpecular = (d1.z + d2.z * 0.65) * uDroplets;
      }

      vec4 base = texture2D(tDiffuse, uv);

      // 3. Controlled directional motion blur (edge-only) + temporary water-impact blur
      float totalBlur = max(uBlurStrength, uImpactBlur);
      if (totalBlur > 0.002) {
        vec2 fromCenter = uv - vec2(0.5, 0.48);
        float radialDist = length(fromCenter);
        float edgeMask = smoothstep(0.18, 0.70, radialDist);

        // Speed motion blur affects only outer periphery; impact blur gently softens wider lens briefly
        float effectiveMask = clamp(edgeMask * (uBlurStrength * 1.0) + mix(edgeMask, 1.0, 0.45) * uImpactBlur, 0.0, 1.0);
        vec2 dir = normalize(fromCenter + uVelocityDir * 0.55 + vec2(0.0001));
        vec2 stepVec = dir * (uBlurStrength * 0.009 + uImpactBlur * 0.014) * effectiveMask;
        vec2 ortho = vec2(-stepVec.y, stepVec.x) * 0.45;

        vec4 accum = base * 0.28;
        accum += texture2D(tDiffuse, clamp(uv - stepVec * 0.5, 0.002, 0.998)) * 0.20;
        accum += texture2D(tDiffuse, clamp(uv + stepVec * 0.5, 0.002, 0.998)) * 0.20;
        accum += texture2D(tDiffuse, clamp(uv - stepVec + ortho, 0.002, 0.998)) * 0.16;
        accum += texture2D(tDiffuse, clamp(uv + stepVec - ortho, 0.002, 0.998)) * 0.16;
        base = mix(base, accum, clamp(totalBlur * 1.15, 0.0, 1.0));
      }

      // 4. Droplet specular highlight & crisp rim glint
      base.rgb += vec3(0.88, 0.96, 1.0) * dropSpecular;

      // 5. Whitewater foam / mist sweep across lens edges on wave collision
      if (uWhitewater > 0.01) {
        float edge = smoothstep(0.22, 0.78, length(vUv - vec2(0.5, 0.46)));
        float foamStreak =
          sin(vUv.x * 26.0 + uTime * 9.0) * 0.5 +
          cos(vUv.y * 19.0 - uTime * 11.0) * 0.5;
        float mist = clamp((0.35 + edge * 0.75 + foamStreak * 0.22) * uWhitewater * 0.62, 0.0, 0.75);
        base.rgb = mix(base.rgb, vec3(0.87, 0.94, 0.96), mist);
      }

      // 6. Underwater submersion tint & subtle caustic light rays
      if (uUnderwater > 0.01) {
        float caustic =
          0.5 + 0.5 * sin(vUv.x * 14.0 + uTime * 4.5 + sin(vUv.y * 11.0 - uTime * 3.2));
        vec3 deepWaterColor = vec3(0.04, 0.31, 0.41) + vec3(0.05, 0.12, 0.14) * caustic;
        float vig = smoothstep(0.15, 0.88, length(vUv - 0.5));
        base.rgb = mix(base.rgb, deepWaterColor, uUnderwater * (0.42 + vig * 0.28));
      }

      // 7. Partial slate-gray cinematic desaturation during maneuver slow-motion (never 100% B&W)
      if (uSlowMoGray > 0.005) {
        float luma = dot(base.rgb, vec3(0.299, 0.587, 0.114));
        vec3 slateGray = vec3(luma) * vec3(0.96, 0.98, 1.03);
        base.rgb = mix(base.rgb, slateGray, clamp(uSlowMoGray * 0.60, 0.0, 0.64));
      }

      gl_FragColor = base;
    }
  `,
};

function detectSoftwareWebGL(): boolean {
  const probeCanvas = document.createElement('canvas');
  const gl = probeCanvas.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

export interface SceneUpdatePayload {
  screen: MenuScreen;
  beachEnv: BeachEnvironmentConfig;
  board: SurfboardSpec;
  surfer: SurferProfile;
  cameraMotion: boolean;
  cameraBlurEnabled: boolean;
  cameraShakeEnabled: boolean;
  cameraImpactIntensity: number;
  cameraMode: CameraMode;
  oceanDetailHigh: boolean;
  graphics: GraphicsSettings;
  paused: boolean;
  beachAtmosphere: BeachAtmosphere;
  beachTheme: BeachTheme;
  marineLifeEnabled: boolean;
  weatherMode: WeatherMode;
  startInWater?: boolean;
  careerOpponents?: CareerHeatNpcSpec[] | null;
  cutsceneRequest?: { key: string; seed: number } | null;
  victoryCutsceneRequest?: {
    key: string;
    kind: VictoryCutsceneKind;
    seed: number;
    accentColor?: string;
  } | null;
  interviewState?: {
    phase: InterviewCameraPhase;
    tone?: InterviewTone;
    accentColor?: string;
  } | null;
}

export class SurfSceneManager {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private cameraFxPass: ShaderPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private textures: ProceduralTextureSet;
  private sky: SkySystem;
  private ocean: OceanSystem;
  private coast: CoastalEnvironment;
  private beachLife: BeachLifeSystem;
  private marineLife: MarineLifeSystem;
  private barrelCurl: BarrelCurlSystem;
  private surferRig: SurferRig;
  private npcSurfers: NpcSurferSystem;
  private waterParticles: WaterParticleSystem;
  private rainSystem: RainSystem;
  private victoryCeremony: VictoryCeremonyProps;
  private interviewStage: InterviewStageSystem;
  private physics: SurfPhysicsEngine;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private fog: THREE.FogExp2;

  private boardAnchor: THREE.Group;
  private boardMeshGroup: THREE.Group | null = null;
  private activeBoardId = '';

  private screen: MenuScreen = 'home';
  private paused = false;
  private targetEnv: BeachEnvironmentConfig;
  private currentEnv: {
    waveAmplitude: number;
    waveFrequency: number;
    waveSpeed: number;
    choppiness: number;
    sunElevation: number;
    sunAzimuth: number;
    cloudDensity: number;
    windStrength: number;
    fogDensity: number;
  };
  private cameraMotion = true;
  private cameraBlurEnabled = true;
  private cameraShakeEnabled = true;
  private cameraImpactIntensity = 0.85;
  private cameraMode: CameraMode = 'thirdPerson';
  private fpBlend = 0;
  private oceanDetailHigh = true;
  private graphics: GraphicsSettings;
  private envMapTexture: THREE.Texture | null = null;
  private renderFogMult = 1.0;
  private lastRenderTime = 0;

  private surfInput: SurfInputState = {
    moveX: 0,
    moveY: 0,
    balanceAdjust: 0,
    balanceStabilize: false,
    requestedManeuver: null,
    requestedDuckDive: false,
  };
  private onHudUpdate?: (hud: SurfHUDState) => void;
  private hudEmitAccum = 0;
  private lastCalloutId = 0;
  private lastStartInWater = false;

  private weatherMode: WeatherMode = 'dynamic';
  private weatherCondition: WeatherCondition = 'sunny';
  private weatherCycleTimer = 0;
  private weatherOvercast = 0;
  private weatherRain = 0;

  private mouseX = 0;
  private mouseY = 0;
  private elapsedTime = 0;
  private lastTimestamp = 0;
  private frameId = 0;
  private disposed = false;

  // Dynamic optical & camera impact states
  private currentBlur = 0;
  private impactBlur = 0;
  private lensDroplets = 0;
  private whitewaterWash = 0;
  private underwaterBlend = 0;
  private slowMoGray = 0;
  private shakeTrauma = 0;
  private camBankRoll = 0;
  private lastPausedEmitted = false;
  private cachedCompletedWavesRef: SurfHUDState['completedWaves'] = [];
  private cachedCompletedWavesLen = -1;
  private menuShadowAccum = 0;
  private modalEnvAccum = 0;
  private lastEmittedPhase: SurfHUDState['phase'] = 'beachWalk';
  private lastScreenSeen: MenuScreen = 'home';

  // Versatile free-look & orbit camera controls (drag gestures in 1P and 3P)
  private camLookYaw = 0;
  private camLookPitch = 0;
  private camZoom = 1.0;
  private camLookYawTarget = 0;
  private camLookPitchTarget = 0;
  private camZoomTarget = 1.0;
  private mouseLookYaw = 0;
  private mouseLookPitch = 0;
  private mouseLookYawTarget = 0;
  private mouseLookPitchTarget = 0;
  private tpFollowHeading = Math.PI;
  private tpSmoothDist = 4.25;
  private tpSmoothHeight = 1.52;
  private dragPointerId: number | null = null;
  private dragLastX = 0;
  private dragLastY = 0;
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist = 0;
  private joystickActive = false;

  // 15-second Wave Replay system
  private replayBuffer = new ReplayBuffer();
  private replayActive = false;
  private replayPlaying = true;
  private replayTime = 0;
  private replayDuration = 0;
  private replaySpeed: 0.25 | 0.5 | 1 = 1;
  private replayAngle: ReplayCameraAngle = 'follow';
  private replaySeekPending = false;
  private replayBeachAnchor = new THREE.Vector3(4, 3.6, 17);
  private replayState!: SurferPhysicsState;
  private replayWave!: SurfWaveParams;
  private savedLiveElapsed = 0;
  private savedLiveState: SurferPhysicsState | null = null;
  private savedLiveWave: SurfWaveParams | null = null;
  private replayHudEmitAccum = 0;

  // Career Heat Opponents & Pre-Heat Cinematic Cutscene
  private careerOpponentsActive = false;
  private cutsceneActive = false;
  private cutsceneKey = '';
  private cutsceneTime = 0;
  private cutsceneSeed = 0;
  private cutsceneStage = 1;
  private cutsceneStageProgress = 0;
  private cutscenePrevStage = 0;
  private lastLaunchedCutsceneKey = '';
  private onCutsceneComplete?: (key: string) => void;

  // Cinematic Victory Cutscenes (5 scenes: Heat Win, Quartas, Semifinal, Final, Award Ceremony)
  private victoryCutsceneActive = false;
  private victoryCutsceneKey = '';
  private victoryCutsceneKind: VictoryCutsceneKind = 'heat_win';
  private victoryCutsceneTime = 0;
  private victoryCutsceneDuration = 5.2;
  private victoryCutsceneSeed = 0;
  private victoryCutsceneStage = 1;
  private victoryCutsceneStageProgress = 0;
  private victoryCutscenePrevStage = 0;
  private lastLaunchedVictoryKey = '';
  private victorySprayState!: SurferPhysicsState;
  private onVictoryCutsceneComplete?: (key: string) => void;

  // Post-Competition Interactive Press Interview Stage
  private interviewPhase: InterviewCameraPhase = 'question';
  private interviewTone: InterviewTone | undefined;

  private onContextLostCallback?: (lost: boolean) => void;

  constructor(
    container: HTMLElement,
    initialEnv: BeachEnvironmentConfig,
    initialBoard: SurfboardSpec,
    initialSurfer: SurferProfile,
    initialGraphics: GraphicsSettings,
    onHudUpdate?: (hud: SurfHUDState) => void,
    onContextLost?: (lost: boolean) => void,
    onCutsceneComplete?: (key: string) => void,
    onVictoryCutsceneComplete?: (key: string) => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onContextLostCallback = onContextLost;
    this.onCutsceneComplete = onCutsceneComplete;
    this.onVictoryCutsceneComplete = onVictoryCutsceneComplete;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.targetEnv = { ...initialEnv };
    this.graphics = { ...initialGraphics };
    this.oceanDetailHigh = initialGraphics.waterQuality !== 'low';
    this.currentEnv = {
      waveAmplitude: initialEnv.waveAmplitude,
      waveFrequency: initialEnv.waveFrequency,
      waveSpeed: initialEnv.waveSpeed,
      choppiness: initialEnv.choppiness,
      sunElevation: initialEnv.sunElevation,
      sunAzimuth: initialEnv.sunAzimuth,
      cloudDensity: initialEnv.cloudDensity,
      windStrength: initialEnv.windStrength,
      fogDensity: initialEnv.fogDensity,
    };

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    const pixelRatio = this.computeEffectivePixelRatio(initialGraphics.resolutionScale);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && initialGraphics.resolutionScale >= 0.8,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled =
      !this.isSoftwareGl && initialGraphics.shadowQuality !== 'off';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2('#dfcaa8', initialEnv.fogDensity);
    this.scene.fog = this.fog;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envMapTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = initialGraphics.reflectionsEnabled ? this.envMapTexture : null;
    pmremGenerator.dispose();

    // Camera with 0.14m near plane for crisp unobstructed first-person arm/board view
    const initialFar = this.getFarPlaneForTier(initialGraphics.renderDistance);
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.14, initialFar);
    this.camera.position.set(-4, 4.4, 24);
    _tpCurPos.copy(this.camera.position);
    _prevCamPos.copy(this.camera.position);
    _currentLook.set(8, 1.1, -55);
    this.camera.lookAt(_currentLook);

    // Post-Processing Pipeline (Water Impact FX, Lens Droplets, Underwater & Motion Blur) on GPU devices
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(width, height);
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      this.cameraFxPass = new ShaderPass(SurfCameraFXShader);
      this.cameraFxPass.uniforms.uAspect.value = width / height;
      this.cameraFxPass.renderToScreen = true;
      this.composer.addPass(this.cameraFxPass);
    }

    // Lighting Rig
    this.hemiLight = new THREE.HemisphereLight('#9ec7e8', '#bfa98a', 0.85);
    this.scene.add(this.hemiLight);

    const shadowRes = this.getShadowMapSize(initialGraphics.shadowQuality);
    this.sunLight = new THREE.DirectionalLight('#ffdfba', 2.4);
    this.sunLight.castShadow = !this.isSoftwareGl && initialGraphics.shadowQuality !== 'off';
    this.sunLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 160;
    const shadowBound = 55;
    this.sunLight.shadow.camera.left = -shadowBound;
    this.sunLight.shadow.camera.right = shadowBound;
    this.sunLight.shadow.camera.top = shadowBound;
    this.sunLight.shadow.camera.bottom = -shadowBound;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight('#62b6cb', 0.45);
    this.rimLight.position.set(30, 12, 35);
    this.scene.add(this.rimLight);

    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAnisotropy);

    this.sky = createSkySystem();
    this.scene.add(this.sky.mesh);

    this.ocean = createOceanSystem(
      this.textures.waterNormal,
      this.textures.foamNoise,
      initialGraphics.waterQuality
    );
    this.scene.add(this.ocean.mesh);

    this.coast = createCoastalEnvironment(this.textures);
    this.scene.add(this.coast.group);

    this.beachLife = createBeachLifeSystem();
    this.scene.add(this.beachLife.group);

    this.marineLife = createMarineLifeSystem();
    this.scene.add(this.marineLife.group);

    this.barrelCurl = createBarrelCurlSystem(this.textures.foamNoise);
    this.scene.add(this.barrelCurl.mesh);

    this.surferRig = createSurferRig(initialBoard, initialSurfer);
    this.surferRig.root.visible = false;
    this.scene.add(this.surferRig.root);

    this.npcSurfers = createNpcSurferSystem();
    this.scene.add(this.npcSurfers.group);

    this.waterParticles = createWaterParticleSystem();
    this.waterParticles.mesh.visible = false;
    this.scene.add(this.waterParticles.mesh);

    this.rainSystem = createRainSystem();
    this.scene.add(this.rainSystem.mesh);

    this.victoryCeremony = createVictoryCeremonyProps();
    this.scene.add(this.victoryCeremony.group);

    this.interviewStage = createInterviewStageSystem();
    this.scene.add(this.interviewStage.group);

    this.physics = new SurfPhysicsEngine(initialEnv);
    this.victorySprayState = this.clonePhysicsState(this.physics.state);

    // Shoreline Surfboard Anchor (for menu 'boards' showcase)
    this.boardAnchor = new THREE.Group();
    const boardX = -16.4;
    const boardZ = 16.4;
    const boardY = getBeachHeightAt(boardX, boardZ);
    this.boardAnchor.position.set(boardX, boardY + 0.06, boardZ);
    this.boardAnchor.rotation.set(-0.08, 0.55, 0.22);
    this.scene.add(this.boardAnchor);
    this.setShowcaseBoard(initialBoard);

    this.replayState = this.clonePhysicsState(this.physics.state);
    this.replayWave = { ...this.physics.waveParams };

    this.applyGraphicsSettings(initialGraphics, true);
    this.applySunAndAtmosphere(0);

    // Pre-compile all shaders up-front (including hidden gameplay & NPC objects) to eliminate runtime stutters
    if (!this.isSoftwareGl) {
      const prevCurl = this.barrelCurl.mesh.visible;
      const prevSurfer = this.surferRig.root.visible;
      const prevParticles = this.waterParticles.mesh.visible;
      const prevRain = this.rainSystem.mesh.visible;
      const prevCeremony = this.victoryCeremony.group.visible;
      const prevInterview = this.interviewStage.group.visible;
      this.barrelCurl.mesh.visible = true;
      this.surferRig.root.visible = true;
      this.npcSurfers.setEnabled(true);
      this.waterParticles.mesh.visible = true;
      this.rainSystem.mesh.visible = true;
      this.victoryCeremony.setVisible(true);
      this.interviewStage.setVisible(true);
      this.renderer.compile(this.scene, this.camera);
      this.barrelCurl.mesh.visible = prevCurl;
      this.surferRig.root.visible = prevSurfer;
      this.npcSurfers.setEnabled(false);
      this.waterParticles.mesh.visible = prevParticles;
      this.rainSystem.mesh.visible = prevRain;
      this.victoryCeremony.setVisible(prevCeremony);
      this.interviewStage.setVisible(prevInterview);
    }

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.handleCanvasPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handleCanvasPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.handleCanvasPointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.handleCanvasPointerUp);
    this.renderer.domElement.addEventListener('lostpointercapture', this.handleCanvasPointerUp);
    this.renderer.domElement.addEventListener('pointerleave', this.handleCanvasPointerLeave);
    this.renderer.domElement.addEventListener('contextmenu', this.handleCanvasContextMenu);
    this.renderer.domElement.addEventListener('wheel', this.handleCanvasWheel, { passive: false });
    this.renderer.domElement.addEventListener('dblclick', this.handleCanvasDblClick);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.lastTimestamp = performance.now();
    this.startLoop();
  }

  private handleCanvasContextMenu = (e: MouseEvent) => {
    if (this.screen === 'surfing') {
      e.preventDefault();
    }
  };

  private handleCanvasPointerDown = (e: PointerEvent) => {
    if (this.screen !== 'surfing') return;
    if (this.paused && !this.replayActive) return;
    if (this.joystickActive && e.pointerType === 'mouse') return;

    const canPinch =
      (!this.replayActive && this.cameraMode === 'thirdPerson') ||
      (this.replayActive && (this.replayAngle === 'follow' || this.replayAngle === 'helicopter'));

    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 2 && canPinch) {
      const it = this.activePointers.values();
      const p0 = it.next().value!;
      const p1 = it.next().value!;
      this.lastPinchDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      this.dragPointerId = null;
    } else if (this.dragPointerId === null) {
      this.dragPointerId = e.pointerId;
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
    }

    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without active pointer capture support
    }
  };

  private handleCanvasPointerMove = (e: PointerEvent) => {
    if (this.screen !== 'surfing') return;
    if (this.paused && !this.replayActive) return;
    if (this.joystickActive && e.pointerType === 'mouse') return;

    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const canPinch =
      (!this.replayActive && this.cameraMode === 'thirdPerson') ||
      (this.replayActive && (this.replayAngle === 'follow' || this.replayAngle === 'helicopter'));

    // Two-finger pinch zoom in orbit angles
    if (this.activePointers.size === 2 && canPinch) {
      const it = this.activePointers.values();
      const p0 = it.next().value!;
      const p1 = it.next().value!;
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (this.lastPinchDist > 0) {
        const delta = this.lastPinchDist - dist;
        this.camZoomTarget = THREE.MathUtils.clamp(
          this.camZoomTarget + delta * 0.0032,
          0.58,
          1.68
        );
      }
      this.lastPinchDist = dist;
      return;
    }

    const isFP = this.replayActive
      ? this.replayAngle === 'firstPerson'
      : this.cameraMode === 'firstPerson';

    // Explicit drag gesture (touch drag or mouse drag on open viewport) -> 360° free-look
    // Passive mouse-hover look is intentionally kept off during gameplay so moving the cursor
    // to the virtual joystick or maneuver buttons never twists the camera or steering.
    if (e.pointerId === this.dragPointerId) {
      const dx = e.clientX - this.dragLastX;
      const dy = e.clientY - this.dragLastY;
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;

      const yawSens = isFP ? 0.0052 : 0.0058;
      const pitchSens = isFP ? 0.0044 : 0.0042;

      this.camLookYawTarget -= dx * yawSens;
      if (isFP) {
        this.camLookPitchTarget = THREE.MathUtils.clamp(
          this.camLookPitchTarget - dy * pitchSens,
          -0.78,
          0.85
        );
      } else {
        this.camLookPitchTarget = THREE.MathUtils.clamp(
          this.camLookPitchTarget + dy * pitchSens,
          -0.32,
          0.92
        );
      }
    }
  };

  private handleCanvasPointerUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDist = 0;
    }
    if (e.pointerId === this.dragPointerId) {
      this.dragPointerId = null;
    }
    try {
      if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  private handleCanvasPointerLeave = () => {
    this.mouseLookYawTarget = 0;
    this.mouseLookPitchTarget = 0;
  };

  private handleCanvasWheel = (e: WheelEvent) => {
    if (this.screen !== 'surfing') return;
    if (this.paused && !this.replayActive) return;
    const canZoom = this.replayActive
      ? this.replayAngle === 'follow' || this.replayAngle === 'helicopter'
      : this.cameraMode === 'thirdPerson';
    if (!canZoom) return;
    e.preventDefault();
    this.camZoomTarget = THREE.MathUtils.clamp(
      this.camZoomTarget + e.deltaY * 0.0008,
      0.58,
      1.68
    );
  };

  private handleCanvasDblClick = () => {
    if (this.screen !== 'surfing') return;
    if (this.paused && !this.replayActive) return;
    this.resetCameraLook();
  };

  public resetCameraLook() {
    this.camLookYawTarget = 0;
    this.camLookPitchTarget = 0;
    this.camZoomTarget = 1.0;
    this.mouseLookYawTarget = 0;
    this.mouseLookPitchTarget = 0;
    this.emitHudState(true);
  }

  public setJoystickActive(active: boolean) {
    this.joystickActive = active;
    if (active) {
      this.mouseLookYawTarget = 0;
      this.mouseLookPitchTarget = 0;
    }
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.onContextLostCallback?.(true);
  };

  private handleContextRestored = () => {
    this.onContextLostCallback?.(false);
    this.lastTimestamp = performance.now();
    this.startLoop();
  };

  private handlePointerMove = (e: PointerEvent) => {
    const nx = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
    const ny = (e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
    this.mouseX = nx;
    this.mouseY = ny;
  };

  private computeEffectivePixelRatio(resolutionScale: number): number {
    if (this.isSoftwareGl) return 1;
    const isCoarse =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const maxDpr = isCoarse ? 1.35 : 1.65;
    const nativeDpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    return THREE.MathUtils.clamp(nativeDpr * resolutionScale, 0.5, maxDpr);
  }

  private getShadowMapSize(quality: GraphicsSettings['shadowQuality']): number {
    switch (quality) {
      case 'high':
        return 2048;
      case 'medium':
        return 1024;
      case 'low':
        return 512;
      default:
        return 512;
    }
  }

  private getFarPlaneForTier(tier: GraphicsSettings['renderDistance']): number {
    switch (tier) {
      case 'short':
        return 640;
      case 'medium':
        return 1050;
      case 'ultra':
        return 2000;
      default:
        return 1550;
    }
  }

  private applyGraphicsSettings(next: GraphicsSettings, force = false) {
    const prev = this.graphics;
    const resChanged = force || next.resolutionScale !== prev.resolutionScale;
    const shadowChanged = force || next.shadowQuality !== prev.shadowQuality;
    const distChanged = force || next.renderDistance !== prev.renderDistance;
    const waterChanged = force || next.waterQuality !== prev.waterQuality;
    const reflChanged = force || next.reflectionsEnabled !== prev.reflectionsEnabled;

    this.graphics = { ...next };
    this.oceanDetailHigh = next.waterQuality !== 'low';

    if (waterChanged) {
      if (!force) {
        this.ocean.rebuildDetail(next.waterQuality);
      }
      const pScale = next.waterQuality === 'high' ? 1.0 : next.waterQuality === 'medium' ? 0.68 : 0.35;
      this.waterParticles.setQualityScale(pScale);
      this.rainSystem.setQualityScale(pScale);
      this.ocean.material.uniforms.uWaterDetail.value =
        next.waterQuality === 'high' ? 1.0 : next.waterQuality === 'medium' ? 0.72 : 0.35;
    }

    if (reflChanged) {
      this.scene.environment = next.reflectionsEnabled ? this.envMapTexture : null;
      this.ocean.material.uniforms.uReflections.value = next.reflectionsEnabled ? 1.0 : 0.0;
    }

    if (force || next.preset !== prev.preset) {
      this.npcSurfers.setQualityPreset(next.preset);
    }

    if (shadowChanged) {
      const enabled = !this.isSoftwareGl && next.shadowQuality !== 'off';
      this.renderer.shadowMap.enabled = enabled;
      this.sunLight.castShadow = enabled;
      if (enabled) {
        this.renderer.shadowMap.type =
          next.shadowQuality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
        const size = this.getShadowMapSize(next.shadowQuality);
        if (this.sunLight.shadow.mapSize.x !== size) {
          this.sunLight.shadow.mapSize.set(size, size);
          this.sunLight.shadow.map?.dispose();
          this.sunLight.shadow.map = null;
        }
      }
      this.renderer.shadowMap.needsUpdate = true;
    }

    if (distChanged) {
      this.camera.far = this.getFarPlaneForTier(next.renderDistance);
      this.camera.updateProjectionMatrix();
      this.renderFogMult =
        next.renderDistance === 'short'
          ? 1.38
          : next.renderDistance === 'medium'
            ? 1.14
            : next.renderDistance === 'ultra'
              ? 0.85
              : 1.0;
    }

    if (resChanged) {
      this.handleResize();
    }
  }

  public handleResize = () => {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const pixelRatio = this.computeEffectivePixelRatio(this.graphics.resolutionScale);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);

    if (this.composer) {
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(width, height);
    }
    if (this.cameraFxPass) {
      this.cameraFxPass.uniforms.uAspect.value = width / height;
    }
  };

  public setSurfInput(input: Partial<SurfInputState>) {
    if (input.moveX !== undefined) this.surfInput.moveX = input.moveX;
    if (input.moveY !== undefined) this.surfInput.moveY = input.moveY;
    if (input.balanceAdjust !== undefined) this.surfInput.balanceAdjust = input.balanceAdjust;
    if (input.balanceStabilize !== undefined) {
      this.surfInput.balanceStabilize = input.balanceStabilize;
    }
    if (input.requestedManeuver !== undefined) {
      this.surfInput.requestedManeuver = input.requestedManeuver;
    }
    if (input.requestedDuckDive !== undefined) {
      this.surfInput.requestedDuckDive = input.requestedDuckDive;
    }
  }

  public restartSurfSession() {
    if (this.replayActive) {
      this.replayActive = false;
      this.savedLiveState = null;
      this.savedLiveWave = null;
    }
    this.replayBuffer.clear();
    this.physics.resetSession(this.targetEnv, this.lastStartInWater);
    this.npcSurfers.setEnabled(this.shouldEnableNpcs());
    if (this.shouldEnableNpcs()) {
      this.npcSurfers.resetLineup(this.physics.waveParams, this.physics.state.position);
    }
    this.waterParticles.reset();
    this.impactBlur = 0;
    this.lensDroplets = 0;
    this.whitewaterWash = 0;
    this.underwaterBlend = 0;
    this.slowMoGray = 0;
    this.shakeTrauma = 0;
    this.cachedCompletedWavesLen = -1;
    this.tpFollowHeading = Math.PI;
    this.camLookYaw = 0;
    this.camLookPitch = 0;
    this.camZoom = 1.0;
    this.camLookYawTarget = 0;
    this.camLookPitchTarget = 0;
    this.camZoomTarget = 1.0;
    this.mouseLookYaw = 0;
    this.mouseLookPitch = 0;
    this.mouseLookYawTarget = 0;
    this.mouseLookPitchTarget = 0;
    this.dragPointerId = null;
    this.activePointers.clear();
    this.lastPinchDist = 0;
    this.surferRig.setFirstPersonMode(this.cameraMode === 'firstPerson');
    this.emitHudState(true);
  }

  private clonePhysicsState(src: SurferPhysicsState): SurferPhysicsState {
    return {
      ...src,
      position: src.position.clone(),
      velocity: src.velocity.clone(),
      boardNormal: src.boardNormal.clone(),
      boardPos: src.boardPos.clone(),
      boardVel: src.boardVel.clone(),
      completedWaves: src.completedWaves.map((w) => ({ ...w })),
    };
  }

  public enterReplay() {
    if (this.screen !== 'surfing' || this.replayActive || !this.replayBuffer.hasClip()) {
      return;
    }
    this.savedLiveState = this.clonePhysicsState(this.physics.state);
    this.savedLiveWave = { ...this.physics.waveParams };
    this.savedLiveElapsed = this.elapsedTime;

    this.replayDuration = this.replayBuffer.getDuration();
    this.replayTime = 0;
    this.replayPlaying = true;
    this.replaySpeed = 1;
    this.replaySeekPending = true;
    this.replayBuffer.resetPlaybackCursor();
    this.replayBuffer.computeBeachAnchor(this.replayBeachAnchor);
    this.waterParticles.reset();

    this.replayActive = true;
    this.npcSurfers.setEnabled(false);
    this.paused = false;
    this.camLookYaw = 0;
    this.camLookPitch = 0;
    this.camLookYawTarget = 0;
    this.camLookPitchTarget = 0;
    this.camZoom = 1.0;
    this.camZoomTarget = 1.0;
    this.dragPointerId = null;
    this.activePointers.clear();
    oceanAudio.updateSurfTelemetry(0, 0, false, 0, false);
    this.emitHudState(true);
  }

  public exitReplay() {
    if (!this.replayActive) return;
    this.replayActive = false;
    this.npcSurfers.setEnabled(this.shouldEnableNpcs());

    if (this.savedLiveState) {
      this.physics.state = this.savedLiveState;
      this.savedLiveState = null;
    }
    if (this.savedLiveWave) {
      this.physics.waveParams = this.savedLiveWave;
      this.savedLiveWave = null;
    }
    this.elapsedTime = this.savedLiveElapsed;

    this.waterParticles.reset();
    this.surferRig.setFirstPersonMode(this.cameraMode === 'firstPerson');
    this.fpBlend = this.cameraMode === 'firstPerson' ? 1 : 0;
    this.surferRig.animate(this.physics.state, this.physics.waveParams.simTime, 0.12);

    this.camLookYaw = 0;
    this.camLookPitch = 0;
    this.camLookYawTarget = 0;
    this.camLookPitchTarget = 0;
    this.camZoom = 1.0;
    this.camZoomTarget = 1.0;
    this.dragPointerId = null;
    this.activePointers.clear();
    this.emitHudState(true);
  }

  public toggleReplayPlay() {
    if (!this.replayActive) return;
    this.replayPlaying = !this.replayPlaying;
    this.emitHudState(true);
  }

  public seekReplay(timeSeconds: number) {
    if (!this.replayActive) return;
    this.replayTime = THREE.MathUtils.clamp(timeSeconds, 0, Math.max(0.01, this.replayDuration));
    this.replaySeekPending = true;
    this.replayBuffer.resetPlaybackCursor();
    this.waterParticles.reset();
    this.emitHudState(true);
  }

  public restartReplay() {
    if (!this.replayActive) return;
    this.replayTime = 0;
    this.replayPlaying = true;
    this.replaySeekPending = true;
    this.replayBuffer.resetPlaybackCursor();
    this.waterParticles.reset();
    this.emitHudState(true);
  }

  public setReplaySpeed(speed: 0.25 | 0.5 | 1) {
    if (!this.replayActive) return;
    this.replaySpeed = speed;
    this.emitHudState(true);
  }

  public setReplayAngle(angle: ReplayCameraAngle) {
    if (!this.replayActive) return;
    this.replayAngle = angle;
    this.camLookYaw = 0;
    this.camLookPitch = 0;
    this.camLookYawTarget = 0;
    this.camLookPitchTarget = 0;
    this.camZoom = 1.0;
    this.camZoomTarget = 1.0;
    this.emitHudState(true);
  }

  public cycleReplayAngle() {
    const order: ReplayCameraAngle[] = ['follow', 'beach', 'waterline', 'helicopter', 'firstPerson'];
    const nextIdx = (order.indexOf(this.replayAngle) + 1) % order.length;
    this.setReplayAngle(order[nextIdx]);
  }

  private shouldEnableNpcs(): boolean {
    return !this.lastStartInWater || this.careerOpponentsActive;
  }

  public setCutsceneCompleteHandler(handler?: (key: string) => void) {
    this.onCutsceneComplete = handler;
  }

  public skipCutscene() {
    if (!this.cutsceneActive) return;
    this.completeCutscene();
  }

  public restartCareerHeatInWater() {
    if (this.replayActive) {
      this.replayActive = false;
      this.savedLiveState = null;
      this.savedLiveWave = null;
    }
    this.cutsceneActive = false;
    this.paused = false;
    this.replayBuffer.clear();
    this.physics.resetSession(this.targetEnv, true);
    this.npcSurfers.setEnabled(this.shouldEnableNpcs());
    if (this.shouldEnableNpcs()) {
      this.npcSurfers.resetLineup(this.physics.waveParams, this.physics.state.position);
    }
    this.waterParticles.reset();
    this.impactBlur = 0;
    this.lensDroplets = 0;
    this.whitewaterWash = 0;
    this.underwaterBlend = 0;
    this.slowMoGray = 0;
    this.shakeTrauma = 0;
    this.cachedCompletedWavesLen = -1;
    this.tpFollowHeading = Math.PI;
    this.camLookYaw = 0;
    this.camLookPitch = 0;
    this.camZoom = 1.0;
    this.camLookYawTarget = 0;
    this.camLookPitchTarget = 0;
    this.camZoomTarget = 1.0;
    this.mouseLookYaw = 0;
    this.mouseLookPitch = 0;
    this.mouseLookYawTarget = 0;
    this.mouseLookPitchTarget = 0;
    this.dragPointerId = null;
    this.activePointers.clear();
    this.lastPinchDist = 0;
    this.surferRig.setFirstPersonMode(this.cameraMode === 'firstPerson');
    this.fpBlend = this.cameraMode === 'firstPerson' ? 1 : 0;
    this.emitHudState(true);
  }

  private completeCutscene() {
    const finishedKey = this.cutsceneKey;
    this.cutsceneActive = false;
    this.cutsceneStage = 6;
    this.cutsceneStageProgress = 1;
    this.physics.finishCutsceneToLineup();
    this.npcSurfers.setEnabled(this.shouldEnableNpcs());
    if (this.shouldEnableNpcs()) {
      this.npcSurfers.resetLineup(this.physics.waveParams, this.physics.state.position);
    }
    this.waterParticles.reset();
    this.surferRig.setFirstPersonMode(false);
    this.fpBlend = 0;
    this.tpFollowHeading = Math.PI;
    this.camLookYaw = 0;
    this.camLookPitch = 0;
    this.camZoom = 1.0;
    this.camLookYawTarget = 0;
    this.camLookPitchTarget = 0;
    this.camZoomTarget = 1.0;
    this.mouseLookYaw = 0;
    this.mouseLookPitch = 0;
    this.mouseLookYawTarget = 0;
    this.mouseLookPitchTarget = 0;
    this.dragPointerId = null;
    this.activePointers.clear();
    this.emitHudState(true);
    if (finishedKey) {
      this.onCutsceneComplete?.(finishedKey);
    }
  }

  public setVictoryCutsceneCompleteHandler(handler?: (key: string) => void) {
    this.onVictoryCutsceneComplete = handler;
  }

  public skipVictoryCutscene() {
    if (!this.victoryCutsceneActive) return;
    this.completeVictoryCutscene();
  }

  private getVictoryDuration(kind: VictoryCutsceneKind): number {
    switch (kind) {
      case 'heat_win':
        return 5.0;
      case 'quarterfinal_win':
        return 5.6;
      case 'semifinal_win':
        return 6.4;
      case 'final_win':
        return 7.0;
      case 'championship_ceremony':
        return 7.5;
    }
  }

  private completeVictoryCutscene() {
    const finishedKey = this.victoryCutsceneKey;
    this.victoryCutsceneActive = false;
    this.victoryCutsceneStage = 3;
    this.victoryCutsceneStageProgress = 1;
    this.victoryCeremony.setVisible(false);
    this.emitHudState(true);
    if (finishedKey) {
      this.onVictoryCutsceneComplete?.(finishedKey);
    }
  }

  public updateState(payload: SceneUpdatePayload) {
    const wasSurfing = this.screen === 'surfing';
    const isNowSurfing = payload.screen === 'surfing';
    const wasInterview = this.screen === 'interview';
    const isNowInterview = payload.screen === 'interview';
    const cameraModeChanged = payload.cameraMode !== this.cameraMode;

    if (wasSurfing && !isNowSurfing && this.replayActive) {
      this.exitReplay();
    }

    if (payload.screen !== this.lastScreenSeen || payload.beachEnv !== this.targetEnv) {
      this.lastScreenSeen = payload.screen;
      this.menuShadowAccum = 0;
      this.renderer.shadowMap.needsUpdate = true;
    }

    this.screen = payload.screen;
    this.paused = payload.paused;
    this.targetEnv = payload.beachEnv;
    this.cameraMotion = payload.cameraMotion;
    this.cameraBlurEnabled = payload.cameraBlurEnabled;
    this.cameraShakeEnabled = payload.cameraShakeEnabled;
    this.cameraImpactIntensity = payload.cameraImpactIntensity;
    this.cameraMode = payload.cameraMode;
    this.weatherMode = payload.weatherMode;
    this.lastStartInWater = Boolean(payload.startInWater);
    this.careerOpponentsActive = Boolean(
      payload.careerOpponents && payload.careerOpponents.length > 0
    );

    if (cameraModeChanged) {
      // Recenter view cleanly when switching between 1P and 3P
      this.camLookYawTarget = 0;
      this.camLookPitchTarget = 0;
      this.mouseLookYawTarget = 0;
      this.mouseLookPitchTarget = 0;
      this.dragPointerId = null;
      this.activePointers.clear();
    }

    this.applyGraphicsSettings(payload.graphics, false);

    if (payload.board.id !== this.activeBoardId) {
      this.setShowcaseBoard(payload.board);
    }
    this.surferRig.updateBoard(payload.board);
    this.surferRig.updateProfile(payload.surfer);
    this.physics.updateBeachEnv(payload.beachEnv);
    this.beachLife.setConfig(payload.beachAtmosphere, payload.beachTheme);
    this.marineLife.setEnabled(payload.marineLifeEnabled);

    if (isNowSurfing) {
      this.npcSurfers.configureCareerHeatOpponents(
        payload.careerOpponents ?? null,
        this.physics.waveParams,
        this.physics.state.position
      );
    } else if (wasSurfing) {
      this.npcSurfers.configureCareerHeatOpponents(null, this.physics.waveParams);
    }

    const reqCutscene = isNowSurfing ? payload.cutsceneRequest : null;
    const shouldStartCutscene = Boolean(
      reqCutscene && reqCutscene.key !== this.lastLaunchedCutsceneKey
    );

    if ((!wasSurfing && isNowSurfing) || shouldStartCutscene) {
      this.replayActive = false;
      this.savedLiveState = null;
      this.savedLiveWave = null;
      this.replayBuffer.clear();
      this.physics.resetSession(payload.beachEnv, Boolean(payload.startInWater));

      const enableNpcs = this.shouldEnableNpcs();
      this.npcSurfers.setEnabled(enableNpcs);
      if (enableNpcs) {
        this.npcSurfers.resetLineup(this.physics.waveParams, this.physics.state.position);
      }

      if (shouldStartCutscene && reqCutscene) {
        this.lastLaunchedCutsceneKey = reqCutscene.key;
        this.cutsceneActive = true;
        this.cutsceneKey = reqCutscene.key;
        this.cutsceneSeed = reqCutscene.seed;
        this.cutsceneTime = 0;
        this.cutsceneStage = 1;
        this.cutsceneStageProgress = 0;
        this.cutscenePrevStage = 0;
        this.physics.stepCutscene(0.016, 1, 0);
        this.npcSurfers.setEnabled(true);
        this.npcSurfers.stepCutsceneFormation(
          0.016,
          this.physics.waveParams.simTime,
          this.physics.waveParams,
          1,
          0
        );
      } else if (!wasSurfing && isNowSurfing) {
        this.cutsceneActive = false;
      }

      this.waterParticles.reset();
      this.surferRig.root.visible = true;
      this.surferRig.setFirstPersonMode(!this.cutsceneActive && this.cameraMode === 'firstPerson');
      this.fpBlend = !this.cutsceneActive && this.cameraMode === 'firstPerson' ? 1 : 0;
      this.waterParticles.mesh.visible = true;
      this.boardAnchor.visible = false;
      this.impactBlur = 0;
      this.lensDroplets = 0;
      this.whitewaterWash = 0;
      this.underwaterBlend = 0;
      this.slowMoGray = 0;
      this.shakeTrauma = 0;
      this.cachedCompletedWavesLen = -1;
      this.tpFollowHeading = Math.PI;
      this.camLookYaw = 0;
      this.camLookPitch = 0;
      this.camZoom = 1.0;
      this.camLookYawTarget = 0;
      this.camLookPitchTarget = 0;
      this.camZoomTarget = 1.0;
      this.mouseLookYaw = 0;
      this.mouseLookPitch = 0;
      this.mouseLookYawTarget = 0;
      this.mouseLookPitchTarget = 0;
      this.dragPointerId = null;
      this.activePointers.clear();
      this.tpSmoothDist = 4.25;
      this.tpSmoothHeight = 1.52;
      _tpCurPos.copy(this.camera.position);
      this.emitHudState(true);
    } else if (wasSurfing && !isNowSurfing) {
      this.cutsceneActive = false;
      this.lastLaunchedCutsceneKey = '';
      this.victoryCutsceneActive = false;
      this.lastLaunchedVictoryKey = '';
      this.victoryCeremony.setVisible(false);
      this.replayActive = false;
      this.replayBuffer.clear();
      this.npcSurfers.setEnabled(false);
      this.surferRig.root.visible = false;
      this.surferRig.setFirstPersonMode(false);
      this.fpBlend = 0;
      this.waterParticles.mesh.visible = false;
      this.barrelCurl.mesh.visible = false;
      this.boardAnchor.visible = true;
      this.ocean.material.uniforms.uSurfMode.value = 0.0;
      this.impactBlur = 0;
      this.lensDroplets = 0;
      this.whitewaterWash = 0;
      this.underwaterBlend = 0;
      this.slowMoGray = 0;
      this.shakeTrauma = 0;
      this.mouseLookYawTarget = 0;
      this.mouseLookPitchTarget = 0;
      this.dragPointerId = null;
      this.activePointers.clear();
      this.camera.rotation.z = 0;
      oceanAudio.updateSurfTelemetry(0, 0, false, 0, false, this.weatherRain, 0);
    }

    const reqVictory = isNowSurfing ? payload.victoryCutsceneRequest : null;
    if (reqVictory && reqVictory.key !== this.lastLaunchedVictoryKey) {
      this.lastLaunchedVictoryKey = reqVictory.key;
      this.cutsceneActive = false;
      this.replayActive = false;
      this.paused = false;
      this.victoryCutsceneActive = true;
      this.victoryCutsceneKey = reqVictory.key;
      this.victoryCutsceneKind = reqVictory.kind;
      this.victoryCutsceneSeed = reqVictory.seed;
      this.victoryCutsceneTime = 0;
      this.victoryCutsceneDuration = this.getVictoryDuration(reqVictory.kind);
      this.victoryCutsceneStage = 1;
      this.victoryCutsceneStageProgress = 0;
      this.victoryCutscenePrevStage = 0;
      this.surferRig.root.visible = true;
      this.surferRig.setFirstPersonMode(false);
      this.fpBlend = 0;
      this.boardAnchor.visible = false;
      this.waterParticles.mesh.visible = reqVictory.kind !== 'championship_ceremony';
      this.waterParticles.reset();
      this.victoryCeremony.setVisible(
        reqVictory.kind === 'championship_ceremony',
        reqVictory.accentColor
      );
      this.impactBlur = 0;
      this.lensDroplets = 0;
      this.whitewaterWash = 0;
      this.underwaterBlend = 0;
      this.slowMoGray = 0;
      this.shakeTrauma = 0;
      if (reqVictory.kind === 'championship_ceremony') {
        this.npcSurfers.setEnabled(false);
        this.victoryCeremony.getSurferAnchor(_vicPos);
        this.camera.position.set(_vicPos.x + 2.4, _vicPos.y + 1.85, _vicPos.z - 5.2);
        _currentLook.set(_vicPos.x + 0.15, _vicPos.y + 1.05, _vicPos.z);
        this.camera.lookAt(_currentLook);
      } else {
        this.npcSurfers.setEnabled(true);
      }
      this.emitHudState(true);
    } else if (!reqVictory && this.victoryCutsceneActive) {
      this.victoryCutsceneActive = false;
      this.victoryCeremony.setVisible(false);
      this.emitHudState(true);
    }

    this.interviewPhase = payload.interviewState?.phase ?? 'question';
    this.interviewTone = payload.interviewState?.tone;

    if (isNowInterview) {
      this.interviewStage.setVisible(true, payload.interviewState?.accentColor);
      this.victoryCeremony.setVisible(false);
      this.cutsceneActive = false;
      this.victoryCutsceneActive = false;
      this.surferRig.root.visible = true;
      this.surferRig.setFirstPersonMode(false);
      this.fpBlend = 0;
      this.boardAnchor.visible = false;
      this.waterParticles.mesh.visible = false;
      this.barrelCurl.mesh.visible = false;
      this.npcSurfers.setEnabled(false);
      this.ocean.material.uniforms.uSurfMode.value = 0.0;
      if (!wasInterview) {
        this.interviewStage.getCameraTargets(
          this.interviewPhase,
          this.elapsedTime,
          this.camera.position,
          _currentLook
        );
        this.camera.lookAt(_currentLook);
        _tpCurPos.copy(this.camera.position);
        _prevCamPos.copy(this.camera.position);
      }
    } else if (wasInterview) {
      this.interviewStage.setVisible(false);
      if (!isNowSurfing) {
        this.surferRig.root.visible = false;
        this.boardAnchor.visible = true;
      }
    }
  }

  private setShowcaseBoard(spec: SurfboardSpec) {
    if (this.boardMeshGroup) {
      this.boardAnchor.remove(this.boardMeshGroup);
      this.boardMeshGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    this.boardMeshGroup = createSurfboardGroup(spec);
    this.boardAnchor.add(this.boardMeshGroup);
    this.activeBoardId = spec.id;
  }

  private updateWeather(rawDt: number) {
    if (this.weatherMode === 'dynamic') {
      if (!this.paused) {
        this.weatherCycleTimer = (this.weatherCycleTimer + rawDt) % 96;
      }
      const c = this.weatherCycleTimer;
      if (c < 28) {
        this.weatherCondition = 'sunny';
      } else if (c < 52) {
        this.weatherCondition = 'overcast';
      } else if (c < 78) {
        this.weatherCondition = 'rainy';
      } else {
        this.weatherCondition = 'overcast';
      }
    } else {
      this.weatherCondition = this.weatherMode;
    }

    const targetOvercast = this.weatherCondition === 'sunny' ? 0 : 1;
    const targetRain = this.weatherCondition === 'rainy' ? 1 : 0;
    const weatherLambda = rawDt > 0 ? 0.55 : 100;
    this.weatherOvercast = THREE.MathUtils.damp(
      this.weatherOvercast,
      targetOvercast,
      weatherLambda,
      rawDt
    );
    this.weatherRain = THREE.MathUtils.damp(
      this.weatherRain,
      targetRain,
      weatherLambda,
      rawDt
    );
  }

  private applySunAndAtmosphere(dt: number) {
    const dampLambda = dt > 0 ? 2.8 : 100;
    const env = this.currentEnv;
    const tgt = this.targetEnv;

    env.waveAmplitude = THREE.MathUtils.damp(env.waveAmplitude, tgt.waveAmplitude, dampLambda, dt);
    env.waveFrequency = THREE.MathUtils.damp(env.waveFrequency, tgt.waveFrequency, dampLambda, dt);
    env.waveSpeed = THREE.MathUtils.damp(env.waveSpeed, tgt.waveSpeed, dampLambda, dt);
    env.choppiness = THREE.MathUtils.damp(env.choppiness, tgt.choppiness, dampLambda, dt);
    env.sunElevation = THREE.MathUtils.damp(env.sunElevation, tgt.sunElevation, dampLambda, dt);
    env.sunAzimuth = THREE.MathUtils.damp(env.sunAzimuth, tgt.sunAzimuth, dampLambda, dt);
    env.cloudDensity = THREE.MathUtils.damp(env.cloudDensity, tgt.cloudDensity, dampLambda, dt);
    env.windStrength = THREE.MathUtils.damp(env.windStrength, tgt.windStrength, dampLambda, dt);
    env.fogDensity = THREE.MathUtils.damp(env.fogDensity, tgt.fogDensity, dampLambda, dt);

    const overcast = this.weatherOvercast;
    const rain = this.weatherRain;

    const sunElevBoost = this.cutsceneActive ? ((this.cutsceneSeed % 3) - 1) * 2.2 : 0;
    const phi = THREE.MathUtils.degToRad(90 - (env.sunElevation + sunElevBoost));
    const theta = THREE.MathUtils.degToRad(env.sunAzimuth);
    _sunDir.setFromSphericalCoords(1, phi, theta).normalize();

    if (this.screen === 'surfing' || this.screen === 'interview') {
      const focusPos =
        this.screen === 'interview'
          ? this.interviewStage.getShadowFocus(_intvShadowFocus)
          : this.victoryCutsceneActive && this.victoryCutsceneKind === 'championship_ceremony'
            ? this.victoryCeremony.getSurferAnchor(_vicPos)
            : this.physics.state.position;
      // Snap shadow target to 0.5m texel grid to prevent shadow edge shimmering/stutter
      const snapX = Math.round(focusPos.x * 2) * 0.5;
      const snapZ = Math.round(focusPos.z * 2) * 0.5;
      this.sunLight.position.set(
        snapX + _sunDir.x * 75,
        _sunDir.y * 75,
        snapZ + _sunDir.z * 75
      );
      this.sunLight.target.position.set(snapX, 0, snapZ);
    } else {
      this.sunLight.position.copy(_sunDir).multiplyScalar(75);
      this.sunLight.target.position.set(-15, 0, 5);
    }

    // Dynamic weather lighting & visibility modulation (zero allocations)
    this.sunLight.intensity = 2.45 * (1 - overcast * 0.58) * (1 - rain * 0.42);
    this.sunLight.color
      .copy(_sunWarmColor)
      .lerp(_sunOvercastColor, overcast)
      .lerp(_sunRainColor, rain);

    this.hemiLight.intensity = 0.88 + overcast * 0.08 - rain * 0.16;
    this.hemiLight.color.copy(_hemiSkySunny).lerp(_hemiSkyStorm, Math.max(overcast * 0.7, rain));
    this.hemiLight.groundColor.copy(_hemiGroundSunny).lerp(_hemiGroundStorm, Math.max(overcast * 0.75, rain));

    this.rimLight.intensity = 0.48 * (1 - overcast * 0.45 - rain * 0.3);
    this.rimLight.color.copy(_rimSunny).lerp(_rimStorm, Math.max(overcast * 0.65, rain));

    this.renderer.toneMappingExposure = 1.07 - overcast * 0.08 - rain * 0.1;

    const warmth = THREE.MathUtils.clamp((20 - env.sunElevation) / 10, 0, 1) * (1 - overcast * 0.75);
    _targetHorizonColor.set('#d8d4cc').lerp(_warmHorizonColor, warmth);
    _targetHorizonColor.lerp(_overcastHorizonColor, overcast * 0.82);
    _targetHorizonColor.lerp(_rainHorizonColor, rain * 0.72);

    _targetFogColor.set('#c7d4dc').lerp(_warmFogColor, warmth * 0.85);
    _targetFogColor.lerp(_overcastFogColor, overcast * 0.85);
    _targetFogColor.lerp(_rainFogColor, rain * 0.75);

    const effectiveFogDensity =
      env.fogDensity * (1 + overcast * 0.72 + rain * 1.4) * this.renderFogMult;
    const effectiveClouds = THREE.MathUtils.clamp(
      env.cloudDensity + overcast * (0.9 - env.cloudDensity) + rain * 0.1,
      0.08,
      1.0
    );
    const effectiveWind = env.windStrength + overcast * 0.25 + rain * 0.65;
    const effectiveChop = env.choppiness + rain * 0.22;

    this.fog.color.copy(_targetFogColor);
    this.fog.density = effectiveFogDensity;

    const skyU = this.sky.material.uniforms;
    skyU.uTime.value = this.elapsedTime;
    skyU.uSunDir.value.copy(_sunDir);
    skyU.uCloudDensity.value = effectiveClouds;
    skyU.uWindStrength.value = effectiveWind;
    skyU.uHorizonColor.value.copy(_targetHorizonColor);
    skyU.uOvercast.value = overcast;
    skyU.uRain.value = rain;

    const oceanU = this.ocean.material.uniforms;
    oceanU.uTime.value = this.elapsedTime;
    oceanU.uWaveAmplitude.value = env.waveAmplitude;
    oceanU.uWaveFrequency.value = env.waveFrequency;
    oceanU.uWaveSpeed.value = env.waveSpeed;
    oceanU.uChoppiness.value = effectiveChop;
    oceanU.uSunDir.value.copy(_sunDir);
    oceanU.uHorizonColor.value.copy(_targetHorizonColor);
    oceanU.uFogColor.value.copy(_targetFogColor);
    oceanU.uFogDensity.value = effectiveFogDensity;
    oceanU.uOvercast.value = overcast;
    oceanU.uRain.value = rain;

    _targetShallowColor.set(tgt.shallowColor);
    _targetDeepColor.set(tgt.deepColor);
    if (dt > 0) {
      const colorStep = 1 - Math.exp(-3.0 * dt);
      oceanU.uShallowColor.value.lerp(_targetShallowColor, colorStep);
      oceanU.uDeepColor.value.lerp(_targetDeepColor, colorStep);
    } else {
      oceanU.uShallowColor.value.copy(_targetShallowColor);
      oceanU.uDeepColor.value.copy(_targetDeepColor);
    }
  }

  private updateSurfingGameplay(rawDt: number) {
    if (this.paused) {
      oceanAudio.updateSurfTelemetry(0, 0, false, 0, false, this.weatherRain, 0);
      if (!this.lastPausedEmitted) {
        this.lastPausedEmitted = true;
        this.emitHudState(true);
      }
      return;
    }
    if (this.lastPausedEmitted) {
      this.lastPausedEmitted = false;
      this.emitHudState(true);
    }

    if (this.victoryCutsceneActive) {
      this.updateVictoryCutscene(rawDt);
      return;
    }

    if (this.cutsceneActive) {
      this.updatePreHeatCutscene(rawDt);
      return;
    }

    const s = this.physics.state;
    const wp = this.physics.waveParams;

    // Decouple camera steering vector from surfer heading during beachWalk/paddling/recovering
    // so sideways joystick inputs never spin the 3P camera in a feedback loop.
    const orbitYawForInput = this.tpFollowHeading + this.camLookYaw;
    _camFwd.set(Math.sin(orbitYawForInput), 0, Math.cos(orbitYawForInput)).normalize();

    const sample = this.physics.step(
      rawDt,
      this.surfInput,
      _camFwd.x,
      _camFwd.z,
      this.fpBlend > 0.5
    );
    this.surfInput.requestedManeuver = null;
    this.surfInput.requestedDuckDive = false;

    const simDt = Math.min(rawDt, 0.05) * s.timeScale;
    this.replayBuffer.record(rawDt, this.elapsedTime, s, wp);

    // Partial slate-gray camera factor specifically during maneuver/air slow-motion (or barrel spit-out pulse)
    const isManeuverSlowMo =
      s.phase === 'maneuver' ||
      s.phase === 'airborne' ||
      (s.slowMoHoldTimer > 0 && s.phase !== 'wipeout');
    const targetSlowMoGray = isManeuverSlowMo
      ? THREE.MathUtils.clamp((0.42 - s.timeScale) / 0.24, 0.65, 1.0)
      : 0.0;
    const prevSlowMoGray = this.slowMoGray;
    this.slowMoGray = THREE.MathUtils.damp(
      this.slowMoGray,
      targetSlowMoGray,
      targetSlowMoGray > this.slowMoGray ? 11.0 : 5.5,
      rawDt
    );

    // Audio feedback: dynamic water rush, underwater muffle, slow-mo warmth & rich gameplay SFX
    oceanAudio.updateSurfTelemetry(
      s.speed,
      s.carvingIntensity,
      s.inBarrel,
      s.underwaterAmount,
      s.phase !== 'beachWalk',
      this.weatherRain,
      this.slowMoGray
    );
    if (s.justCaughtWave) {
      oceanAudio.playTakeoffSound();
    }
    if (s.justDuckDived) {
      oceanAudio.playDuckDiveSound();
    }
    if (s.executedManeuverType && s.executedManeuverQuality) {
      oceanAudio.playManeuverSound(s.executedManeuverType, s.executedManeuverQuality);
    }
    if (s.failedManeuver) {
      oceanAudio.playManeuverFailSound();
    }
    if (s.justExitedBarrel) {
      oceanAudio.playBarrelSpitSound();
    }
    if (s.paddleStrokePulse) {
      oceanAudio.playPaddleStrokeSound(s.phase === 'recovering');
    }
    if (s.footstepPulse) {
      oceanAudio.playFootstepSound();
    }
    if (s.impactEventIntensity > 0.08) {
      const eff = s.impactEventIntensity * this.cameraImpactIntensity;
      if (this.cameraBlurEnabled) {
        this.impactBlur = Math.min(1.0, Math.max(this.impactBlur, eff * 0.88));
      }
      this.lensDroplets = Math.min(
        1.0,
        Math.max(this.lensDroplets, (0.34 + s.impactEventIntensity * 0.66) * Math.max(0.25, this.cameraImpactIntensity))
      );
      this.whitewaterWash = Math.min(
        1.0,
        Math.max(this.whitewaterWash, s.impactWhitewater * this.cameraImpactIntensity)
      );
      if (this.cameraShakeEnabled) {
        this.shakeTrauma = Math.min(1.0, Math.max(this.shakeTrauma, eff));
      }
      oceanAudio.playWaterImpact(s.impactEventIntensity);
    }
    if (s.justResurfaced) {
      this.lensDroplets = Math.min(
        1.0,
        Math.max(this.lensDroplets, 0.78 * Math.max(0.3, this.cameraImpactIntensity))
      );
      oceanAudio.playResurfaceSound();
    }
    if (s.inBarrel && this.cameraImpactIntensity > 0.05) {
      // Subtle spray droplets while flying through the barrel mist
      this.lensDroplets = Math.max(this.lensDroplets, 0.28 * this.cameraImpactIntensity);
    }

    // Sync Ocean shader uniforms
    const oceanU = this.ocean.material.uniforms;
    oceanU.uSurfMode.value = THREE.MathUtils.damp(oceanU.uSurfMode.value, 1.0, 8, rawDt);
    oceanU.uSurfSimTime.value = wp.simTime;
    oceanU.uWaveCenterZ.value = wp.waveCenterZ;
    oceanU.uSurfWaveHeight.value = wp.waveHeight;
    oceanU.uSurfWaveSpeed.value = wp.waveSpeed;
    oceanU.uSurfSteepness.value = wp.steepness;
    oceanU.uBreakX.value = wp.breakX;
    oceanU.uBreakDir.value = wp.breakDir;
    oceanU.uWaveLengthZ.value = wp.waveLengthZ;

    this.barrelCurl.update(
      wp,
      oceanU.uShallowColor.value,
      oceanU.uDeepColor.value,
      _sunDir,
      this.weatherOvercast,
      this.weatherRain
    );

    this.surferRig.animate(s, wp.simTime, Math.max(0.001, simDt));
    this.npcSurfers.update(simDt, wp.simTime, wp, s, this.camera.position, this.waterParticles);
    this.waterParticles.update(simDt, s);

    const slowMoThresholdCrossed =
      (prevSlowMoGray <= 0.1 && this.slowMoGray > 0.1) ||
      (prevSlowMoGray > 0.1 && this.slowMoGray <= 0.1);

    this.hudEmitAccum += rawDt;
    const isCalmPhase =
      s.phase === 'beachWalk' || s.phase === 'paddling' || s.phase === 'recovering';
    const emitInterval = isCalmPhase ? 0.1 : 0.075;
    const phaseChanged = s.phase !== this.lastEmittedPhase;
    if (
      this.hudEmitAccum >= emitInterval ||
      s.calloutId !== this.lastCalloutId ||
      slowMoThresholdCrossed ||
      phaseChanged
    ) {
      this.hudEmitAccum = 0;
      this.lastCalloutId = s.calloutId;
      this.emitHudState(false, sample.section);
    }
  }

  private updatePreHeatCutscene(rawDt: number) {
    const TOTAL_DURATION = 13.5;
    this.cutsceneTime += rawDt;

    if (this.cutsceneTime >= TOTAL_DURATION) {
      this.completeCutscene();
      return;
    }

    const t = this.cutsceneTime;
    let stage = 1;
    let stageStart = 0;
    let stageDur = 2.4;
    if (t < 2.4) {
      stage = 1;
      stageStart = 0;
      stageDur = 2.4;
    } else if (t < 4.8) {
      stage = 2;
      stageStart = 2.4;
      stageDur = 2.4;
    } else if (t < 7.6) {
      stage = 3;
      stageStart = 4.8;
      stageDur = 2.8;
    } else if (t < 9.8) {
      stage = 4;
      stageStart = 7.6;
      stageDur = 2.2;
    } else if (t < 11.8) {
      stage = 5;
      stageStart = 9.8;
      stageDur = 2.0;
    } else {
      stage = 6;
      stageStart = 11.8;
      stageDur = 1.7;
    }

    this.cutsceneStage = stage;
    this.cutsceneStageProgress = THREE.MathUtils.clamp((t - stageStart) / stageDur, 0, 1);

    if (stage !== this.cutscenePrevStage) {
      this.cutscenePrevStage = stage;
      oceanAudio.playCutsceneStageCue(stage, this.cutsceneSeed);
    }

    const s = this.physics.state;
    const wp = this.physics.waveParams;
    const sample = this.physics.stepCutscene(rawDt, stage, this.cutsceneStageProgress);

    if (s.paddleStrokePulse) {
      oceanAudio.playPaddleStrokeSound(false);
    }
    oceanAudio.updateSurfTelemetry(
      stage <= 2 ? 4.5 : s.speed,
      0.15,
      false,
      0,
      true,
      this.weatherRain,
      0
    );

    const oceanU = this.ocean.material.uniforms;
    oceanU.uSurfMode.value = THREE.MathUtils.damp(oceanU.uSurfMode.value, 1.0, 8, rawDt);
    oceanU.uSurfSimTime.value = wp.simTime;
    oceanU.uWaveCenterZ.value = wp.waveCenterZ;
    oceanU.uSurfWaveHeight.value = wp.waveHeight;
    oceanU.uSurfWaveSpeed.value = wp.waveSpeed;
    oceanU.uSurfSteepness.value = wp.steepness;
    oceanU.uBreakX.value = wp.breakX;
    oceanU.uBreakDir.value = wp.breakDir;
    oceanU.uWaveLengthZ.value = wp.waveLengthZ;

    this.barrelCurl.update(
      wp,
      oceanU.uShallowColor.value,
      oceanU.uDeepColor.value,
      _sunDir,
      this.weatherOvercast,
      this.weatherRain
    );

    this.surferRig.setFirstPersonMode(false);
    this.surferRig.animate(s, wp.simTime, Math.max(0.001, rawDt));
    this.npcSurfers.stepCutsceneFormation(
      rawDt,
      wp.simTime,
      wp,
      stage,
      this.cutsceneStageProgress
    );
    this.waterParticles.update(rawDt, s);

    this.hudEmitAccum += rawDt;
    if (this.hudEmitAccum >= 0.075) {
      this.hudEmitAccum = 0;
      this.emitHudState(false, sample.section);
    }
  }

  private updateVictoryCutscene(rawDt: number) {
    this.victoryCutsceneTime += rawDt;
    const totalDur = this.victoryCutsceneDuration;
    if (this.victoryCutsceneTime >= totalDur) {
      this.completeVictoryCutscene();
      return;
    }

    const overallP = THREE.MathUtils.clamp(this.victoryCutsceneTime / totalDur, 0, 1);
    const kind = this.victoryCutsceneKind;
    let stage = 1;
    let stageStart = 0;
    let stageDur = totalDur;

    if (kind === 'heat_win') {
      if (overallP < 0.45) {
        stage = 1;
        stageStart = 0;
        stageDur = totalDur * 0.45;
      } else {
        stage = 2;
        stageStart = totalDur * 0.45;
        stageDur = totalDur * 0.55;
      }
    } else if (kind === 'quarterfinal_win') {
      if (overallP < 0.42) {
        stage = 1;
        stageStart = 0;
        stageDur = totalDur * 0.42;
      } else {
        stage = 2;
        stageStart = totalDur * 0.42;
        stageDur = totalDur * 0.58;
      }
    } else {
      if (overallP < 0.34) {
        stage = 1;
        stageStart = 0;
        stageDur = totalDur * 0.34;
      } else if (overallP < 0.68) {
        stage = 2;
        stageStart = totalDur * 0.34;
        stageDur = totalDur * 0.34;
      } else {
        stage = 3;
        stageStart = totalDur * 0.68;
        stageDur = totalDur * 0.32;
      }
    }

    this.victoryCutsceneStage = stage;
    this.victoryCutsceneStageProgress = THREE.MathUtils.clamp(
      (this.victoryCutsceneTime - stageStart) / Math.max(0.1, stageDur),
      0,
      1
    );

    if (stage !== this.victoryCutscenePrevStage) {
      this.victoryCutscenePrevStage = stage;
      oceanAudio.playVictoryCutsceneCue(kind, stage);
    }

    const wp = this.physics.waveParams;
    const oceanU = this.ocean.material.uniforms;

    if (kind === 'championship_ceremony') {
      oceanAudio.updateSurfTelemetry(0, 0, false, 0, false, this.weatherRain, 0);
      oceanU.uSurfMode.value = THREE.MathUtils.damp(oceanU.uSurfMode.value, 0.0, 5.0, rawDt);
      this.barrelCurl.mesh.visible = false;
      this.victoryCeremony.update(this.elapsedTime, overallP);
      this.victoryCeremony.getSurferAnchor(_vicPos);
      this.victoryCeremony.getBoardAnchor(_vicBoardPos);
      _vicNormal.set(0, 1, 0);
      this.surferRig.animateVictory(
        kind,
        stage,
        this.victoryCutsceneStageProgress,
        this.elapsedTime,
        Math.max(0.001, rawDt),
        _vicPos,
        _vicNormal,
        Math.PI + 0.18,
        _vicBoardPos
      );
    } else {
      wp.simTime += rawDt * 0.9;
      wp.waveCenterZ += wp.waveSpeed * rawDt * 0.45;
      if (wp.waveCenterZ > 8) {
        wp.waveCenterZ = -125;
      }
      wp.breakX += wp.breakDir * wp.waveSpeed * 0.22 * rawDt;

      oceanU.uSurfMode.value = THREE.MathUtils.damp(oceanU.uSurfMode.value, 1.0, 6.0, rawDt);
      oceanU.uSurfSimTime.value = wp.simTime;
      oceanU.uWaveCenterZ.value = wp.waveCenterZ;
      oceanU.uSurfWaveHeight.value = wp.waveHeight;
      oceanU.uSurfWaveSpeed.value = wp.waveSpeed;
      oceanU.uSurfSteepness.value = wp.steepness;
      oceanU.uBreakX.value = wp.breakX;
      oceanU.uBreakDir.value = wp.breakDir;
      oceanU.uWaveLengthZ.value = wp.waveLengthZ;

      this.barrelCurl.update(
        wp,
        oceanU.uShallowColor.value,
        oceanU.uDeepColor.value,
        _sunDir,
        this.weatherOvercast,
        this.weatherRain
      );

      const dir = this.victoryCutsceneSeed % 2 === 0 ? 1 : -1;
      const glideSpeed = kind === 'final_win' && stage === 1 ? 7.2 : 3.2;
      const surferX = dir * (4.0 + this.victoryCutsceneTime * glideSpeed * 0.35);
      const surferZ = -18.0 + this.victoryCutsceneTime * 1.1;
      const sample = sampleSurfWave(surferX, surferZ, wp, _vicNormal);
      _vicPos.set(surferX, sample.height + 0.03, surferZ);
      const heading = Math.PI + dir * (kind === 'final_win' && stage === 1 ? 0.55 : 0.25);

      this.surferRig.animateVictory(
        kind,
        stage,
        this.victoryCutsceneStageProgress,
        this.elapsedTime,
        Math.max(0.001, rawDt),
        _vicPos,
        _vicNormal,
        heading
      );

      // Keep physics state position synced so water/camera collision stays accurate
      this.physics.state.position.copy(_vicPos);

      // Gentle celebratory spray wake behind board tail
      this.victorySprayState.position.copy(_vicPos);
      this.victorySprayState.heading = heading;
      this.victorySprayState.phase = 'riding';
      this.victorySprayState.speed = kind === 'final_win' && stage === 1 ? 10.5 : 5.5;
      this.victorySprayState.carvingIntensity = kind === 'semifinal_win' || kind === 'final_win' ? 0.42 : 0.18;
      this.victorySprayState.roll = dir * 0.25;
      this.npcSurfers.update(
        rawDt,
        wp.simTime,
        wp,
        this.physics.state,
        this.camera.position,
        this.waterParticles
      );
      this.waterParticles.update(rawDt, this.victorySprayState);

      oceanAudio.updateSurfTelemetry(
        this.victorySprayState.speed,
        0.15,
        false,
        0,
        true,
        this.weatherRain,
        0
      );
    }

    this.hudEmitAccum += rawDt;
    if (this.hudEmitAccum >= 0.075) {
      this.hudEmitAccum = 0;
      this.emitHudState(false, 'shoulder');
    }
  }

  private emitHudState(force: boolean, sectionOverride?: SurfHUDState['waveSection']) {
    if (!this.onHudUpdate) return;
    const s = this.replayActive ? this.replayState : this.physics.state;
    this.lastEmittedPhase = s.phase;
    if (s.completedWaves.length !== this.cachedCompletedWavesLen) {
      this.cachedCompletedWavesLen = s.completedWaves.length;
      this.cachedCompletedWavesRef = s.completedWaves.slice();
    }
    const postFxActive = Boolean(
      !this.isSoftwareGl && this.composer && this.graphics.postProcessingEnabled
    );
    this.onHudUpdate({
      phase: s.phase,
      score: s.score,
      combo: s.combo,
      comboTimer: s.comboTimer,
      speedKmh: Math.round(s.speed * SURF_SPEED_KMH_FACTOR),
      balance: s.balance,
      stability: s.stability,
      waveSection: sectionOverride ?? 'face',
      inBarrel: s.inBarrel,
      barrelTime: s.barrelTimer,
      timeScale: s.timeScale,
      lastCallout: s.lastCallout,
      lastQuality: s.lastQuality,
      calloutId: s.calloutId,
      sequenceChain: s.sequenceChain,
      maxSequenceChain: Math.max(s.maxSequenceChain, s.sequenceChain),
      sequenceTag: s.sequenceTag,
      sequenceTier: s.sequenceTier,
      waveNumber: s.waveNumber,
      currentWavePoints: s.currentWavePoints,
      currentWaveManeuvers: s.currentWaveManeuvers,
      currentWaveBestManeuver: s.currentWaveBestManeuver,
      currentWaveBarrelTime: s.currentWaveBarrelTime,
      completedWaves: this.cachedCompletedWavesRef,
      availability:
        this.replayActive || this.cutsceneActive || this.victoryCutsceneActive
          ? { bottomTurn: false, cutback: false, floater: false, air: false, duckDive: false }
          : this.physics.getManeuverAvailability(),
      isPaused:
        this.paused && !this.replayActive && !this.cutsceneActive && !this.victoryCutsceneActive,
      cameraMode: this.cameraMode,
      cameraModified:
        Math.abs(this.camLookYawTarget) > 0.04 ||
        Math.abs(this.camLookPitchTarget) > 0.04 ||
        Math.abs(this.camZoomTarget - 1.0) > 0.04,
      isUnderwater: s.underwaterAmount > 0.22,
      weather: this.weatherCondition,
      weatherMode: this.weatherMode,
      rainIntensity: this.weatherRain,
      maneuverSlowMo: this.slowMoGray,
      postFxActive,
      cutsceneActive: this.cutsceneActive,
      cutsceneStage: this.cutsceneStage,
      cutsceneProgress: this.cutsceneActive
        ? THREE.MathUtils.clamp(this.cutsceneTime / 13.5, 0, 1)
        : 0,
      victoryCutsceneActive: this.victoryCutsceneActive,
      victoryCutsceneKind: this.victoryCutsceneActive ? this.victoryCutsceneKind : null,
      victoryCutsceneStage: this.victoryCutsceneActive ? this.victoryCutsceneStage : 0,
      victoryCutsceneProgress: this.victoryCutsceneActive
        ? THREE.MathUtils.clamp(
            this.victoryCutsceneTime / Math.max(0.1, this.victoryCutsceneDuration),
            0,
            1
          )
        : 0,
      replay: {
        active: this.replayActive,
        playing: this.replayPlaying,
        available: this.replayBuffer.hasClip(),
        currentTime: this.replayTime,
        duration: this.replayActive ? this.replayDuration : this.replayBuffer.getDuration(),
        playbackSpeed: this.replaySpeed,
        cameraAngle: this.replayAngle,
      },
    });
    void force;
  }

  private updateCamera(rawDt: number) {
    if (this.screen === 'surfing') {
      this.updateSurfCamera(rawDt);
      return;
    }

    const motionScale = this.cameraMotion ? 1.0 : 0.0;
    const t = this.elapsedTime;

    const swayX = Math.sin(t * 0.23) * 0.65 * motionScale + this.mouseX * 0.55;
    const swayY = Math.cos(t * 0.31) * 0.16 * motionScale - this.mouseY * 0.25;
    const swayZ = Math.sin(t * 0.17) * 0.45 * motionScale;

    let targetFov = 46;

    switch (this.screen) {
      case 'home': {
        _camPosTarget.set(-3.5 + swayX, 4.35 + swayY, 24.5 + swayZ);
        _camLookTarget.set(8.5 + this.mouseX * 1.4, 1.15 - this.mouseY * 0.6, -55);
        targetFov = 46;
        break;
      }
      case 'beaches': {
        const [cx, cy, cz] = this.targetEnv.cameraPosition;
        const [lx, ly, lz] = this.targetEnv.cameraTarget;
        _camPosTarget.set(cx + swayX * 0.7, cy + swayY * 0.7, cz + swayZ * 0.7);
        _camLookTarget.set(lx + this.mouseX * 1.1, ly - this.mouseY * 0.5, lz);
        targetFov = 44;
        break;
      }
      case 'lineup': {
        const bobY = Math.sin(t * 1.15) * 0.22;
        _camPosTarget.set(6.0 + swayX * 0.8, 2.05 + bobY, -16.0 + swayZ * 0.6);
        _camLookTarget.set(22.0 + this.mouseX * 2.0, 1.25 - this.mouseY * 0.7, -58.0);
        targetFov = 50;
        break;
      }
      case 'boards': {
        _camPosTarget.set(-13.7 + swayX * 0.22, 2.25 + swayY * 0.2, 19.4 + swayZ * 0.2);
        _camLookTarget.set(-16.5, 1.1, 15.8);
        targetFov = 38;
        break;
      }
      case 'surfers': {
        _camPosTarget.set(-18.5 + swayX * 0.6, 5.1 + swayY * 0.6, 17.5 + swayZ * 0.5);
        _camLookTarget.set(6.0 + this.mouseX * 1.2, 1.25 - this.mouseY * 0.5, -48);
        targetFov = 45;
        break;
      }
      case 'settings':
      case 'career':
      case 'careerCreate': {
        _camPosTarget.set(-1.5 + swayX * 0.5, 4.6 + swayY * 0.5, 25.5 + swayZ * 0.5);
        _camLookTarget.set(10.0 + this.mouseX * 0.8, 1.2 - this.mouseY * 0.4, -55);
        targetFov = 46;
        break;
      }
      case 'interview': {
        targetFov = this.interviewStage.getCameraTargets(
          this.interviewPhase,
          t,
          _camPosTarget,
          _camLookTarget
        );
        break;
      }
    }

    const posLambda =
      this.screen === 'interview' ? 4.4 : this.screen === 'lineup' ? 1.9 : 2.6;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camPosTarget.x, posLambda, rawDt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camPosTarget.y, posLambda, rawDt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camPosTarget.z, posLambda, rawDt);

    const menuFloorY =
      this.screen === 'interview'
        ? getBeachHeightAt(this.camera.position.x, this.camera.position.z) + 0.45
        : Math.max(
            getBeachHeightAt(this.camera.position.x, this.camera.position.z) + 0.85,
            1.35 + this.currentEnv.waveAmplitude * 0.55
          );
    if (this.camera.position.y < menuFloorY) {
      this.camera.position.y = menuFloorY;
    }
    _tpCurPos.copy(this.camera.position);

    _currentLook.x = THREE.MathUtils.damp(_currentLook.x, _camLookTarget.x, 3.0, rawDt);
    _currentLook.y = THREE.MathUtils.damp(_currentLook.y, _camLookTarget.y, 3.0, rawDt);
    _currentLook.z = THREE.MathUtils.damp(_currentLook.z, _camLookTarget.z, 3.0, rawDt);
    this.camera.lookAt(_currentLook);

    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 2.8, rawDt);
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    this.currentBlur = THREE.MathUtils.damp(this.currentBlur, 0, 6, rawDt);
    this.impactBlur = THREE.MathUtils.damp(this.impactBlur, 0, 6, rawDt);
    this.lensDroplets = THREE.MathUtils.damp(this.lensDroplets, 0, 4, rawDt);
    this.whitewaterWash = THREE.MathUtils.damp(this.whitewaterWash, 0, 6, rawDt);
    this.underwaterBlend = THREE.MathUtils.damp(this.underwaterBlend, 0, 6, rawDt);
    this.slowMoGray = THREE.MathUtils.damp(this.slowMoGray, 0, 7, rawDt);
    this.syncPostFxUniforms();
  }

  private getSafeCameraMinY(camX: number, camZ: number, surferX: number, surferZ: number, minClearance: number): number {
    const wp = this.physics.waveParams;
    const waveAtCam = sampleSurfWave(camX, camZ, wp).height;
    const midX = (camX + surferX) * 0.5;
    const midZ = (camZ + surferZ) * 0.5;
    const waveAtMid = sampleSurfWave(midX, midZ, wp).height;
    const beachAtCam = getBeachHeightAt(camX, camZ);
    const beachAtMid = getBeachHeightAt(midX, midZ);
    return Math.max(
      waveAtCam + minClearance,
      waveAtMid + minClearance * 0.72,
      beachAtCam + minClearance,
      beachAtMid + minClearance * 0.65
    );
  }

  private updateCutsceneCamera(rawDt: number) {
    const s = this.physics.state;
    const wp = this.physics.waveParams;
    const p = this.cutsceneStageProgress;
    const smoothP = p * p * (3 - 2 * p);
    const dir = this.cutsceneSeed % 2 === 0 ? 1 : -1;
    const varAngle = ((this.cutsceneSeed % 5) - 2) * 0.85;
    const varHeight = (((this.cutsceneSeed >> 2) % 3) - 1) * 0.85;

    let targetFov = 46;
    if (this.cutsceneStage === 1) {
      // Coastal peak flyover sweeping over beach & lineup
      _cutCamPos.set(
        THREE.MathUtils.lerp(-24 * dir + varAngle * 1.6, 16 * dir + varAngle * 0.8, smoothP),
        THREE.MathUtils.lerp(13.2 + varHeight, 8.8 + varHeight * 0.4, smoothP),
        THREE.MathUtils.lerp(28, 12, smoothP)
      );
      _cutLookTarget.set(2 * dir + varAngle * 0.5, 1.4, -36);
      targetFov = 48;
    } else if (this.cutsceneStage === 2) {
      // Low glide framing sea conditions & approaching wave curl
      const waveZ = THREE.MathUtils.clamp(wp.waveCenterZ, -95, -18);
      _cutCamPos.set(
        wp.breakX + THREE.MathUtils.lerp(-18 * dir + varAngle, 14 * dir, smoothP),
        3.2 + wp.waveHeight * 0.45 + Math.max(0, varHeight * 0.4),
        waveZ + 17.5
      );
      _cutLookTarget.set(wp.breakX, wp.waveHeight * 0.45, waveZ - 4);
      targetFov = 44;
    } else if (this.cutsceneStage === 3) {
      // Close-up pass across player & AI competitors in shallow water
      _cutCamPos.set(
        THREE.MathUtils.lerp(-11 * dir, 10 * dir, smoothP),
        1.85 + Math.max(0, varHeight * 0.25),
        s.position.z - 5.2
      );
      _cutLookTarget.set(s.position.x + 1.4 * dir, s.position.y + 0.85, s.position.z);
      targetFov = 40;
    } else if (this.cutsceneStage === 4) {
      // Broadcast mid-angle framing surfers looking out to sea
      _cutCamPos.set(
        s.position.x + 8.5 * dir * (1 - smoothP * 0.35) + varAngle * 0.6,
        3.4 + Math.max(0, varHeight * 0.3),
        s.position.z + 9.0
      );
      _cutLookTarget.set(s.position.x, 1.35, -24);
      targetFov = 46;
    } else if (this.cutsceneStage === 5) {
      // Surfers paddling out toward lineup
      _cutCamPos.set(
        s.position.x + THREE.MathUtils.lerp(6.5 * dir, 2.2 * dir, smoothP),
        THREE.MathUtils.lerp(3.2, 2.1, smoothP),
        s.position.z + THREE.MathUtils.lerp(7.5, 5.2, smoothP)
      );
      _cutLookTarget.set(s.position.x, s.position.y + 0.75, s.position.z - 4.0);
      targetFov = 48;
    } else {
      // Stage 6: smooth blend right into the exact live gameplay 3P/1P pose
      const shoulderOffset = wp.breakDir;
      const followPosX = s.position.x + shoulderOffset * 1.1;
      const followPosY = s.position.y + 1.65;
      const followPosZ = s.position.z + 4.1;
      _cutCamPos.set(
        THREE.MathUtils.lerp(s.position.x + 2.2 * dir, followPosX, smoothP),
        THREE.MathUtils.lerp(2.1, followPosY, smoothP),
        THREE.MathUtils.lerp(s.position.z + 5.2, followPosZ, smoothP)
      );
      _cutLookTarget.set(
        THREE.MathUtils.lerp(s.position.x, s.position.x + shoulderOffset * 0.75, smoothP),
        s.position.y + 0.9,
        THREE.MathUtils.lerp(s.position.z - 4.0, s.position.z - 1.6, smoothP)
      );
      targetFov = THREE.MathUtils.lerp(48, this.cameraMode === 'firstPerson' ? 56 : 50, smoothP);
    }

    const safeMinY = this.getSafeCameraMinY(
      _cutCamPos.x,
      _cutCamPos.z,
      s.position.x,
      s.position.z,
      0.85
    );
    _cutCamPos.y = Math.max(_cutCamPos.y, safeMinY);

    const dampLambda = this.cutsceneStage === 6 ? 7.5 : 4.2;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _cutCamPos.x, dampLambda, rawDt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _cutCamPos.y, dampLambda, rawDt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _cutCamPos.z, dampLambda, rawDt);
    _tpCurPos.copy(this.camera.position);
    _prevCamPos.copy(this.camera.position);

    _currentLook.x = THREE.MathUtils.damp(_currentLook.x, _cutLookTarget.x, 5.2, rawDt);
    _currentLook.y = THREE.MathUtils.damp(_currentLook.y, _cutLookTarget.y, 5.2, rawDt);
    _currentLook.z = THREE.MathUtils.damp(_currentLook.z, _cutLookTarget.z, 5.2, rawDt);
    this.camera.lookAt(_currentLook);

    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 3.8, rawDt);
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    this.currentBlur = THREE.MathUtils.damp(this.currentBlur, 0, 6, rawDt);
    this.impactBlur = THREE.MathUtils.damp(this.impactBlur, 0, 6, rawDt);
    this.lensDroplets = THREE.MathUtils.damp(this.lensDroplets, 0, 4, rawDt);
    this.whitewaterWash = THREE.MathUtils.damp(this.whitewaterWash, 0, 6, rawDt);
    this.underwaterBlend = THREE.MathUtils.damp(this.underwaterBlend, 0, 6, rawDt);
    this.slowMoGray = THREE.MathUtils.damp(this.slowMoGray, 0, 7, rawDt);
    this.syncPostFxUniforms();
  }

  private updateVictoryCutsceneCamera(rawDt: number) {
    const kind = this.victoryCutsceneKind;
    const totalDur = Math.max(0.1, this.victoryCutsceneDuration);
    const p = THREE.MathUtils.clamp(this.victoryCutsceneTime / totalDur, 0, 1);
    const smoothP = p * p * (3 - 2 * p);
    const dir = this.victoryCutsceneSeed % 2 === 0 ? 1 : -1;

    let targetFov = 40;
    if (kind === 'championship_ceremony') {
      this.victoryCeremony.getSurferAnchor(_vicPos);
      this.victoryCeremony.getTrophyWorldPos(_vicTrophyPos);
      const midX = (_vicPos.x + _vicTrophyPos.x) * 0.5;
      const midY = _vicPos.y + 1.08;
      const midZ = (_vicPos.z + _vicTrophyPos.z) * 0.5;

      // Smoothly arc across the seaward side so sunlight lights surfer, surfboard & gold trophy
      const arcAngle = THREE.MathUtils.lerp(-0.42 * dir, 0.36 * dir, smoothP);
      const dist =
        this.victoryCutsceneStage === 1
          ? THREE.MathUtils.lerp(4.4, 3.25, this.victoryCutsceneStageProgress)
          : this.victoryCutsceneStage === 2
            ? THREE.MathUtils.lerp(3.25, 2.75, this.victoryCutsceneStageProgress)
            : THREE.MathUtils.lerp(2.75, 3.9, this.victoryCutsceneStageProgress);

      _cutCamPos.set(
        midX + Math.sin(arcAngle) * dist,
        midY + THREE.MathUtils.lerp(0.32, 0.14, smoothP),
        midZ - Math.cos(arcAngle) * dist
      );
      _cutLookTarget.set(
        this.victoryCutsceneStage === 2 ? _vicTrophyPos.x * 0.35 + midX * 0.65 : midX,
        midY,
        midZ
      );
      targetFov = this.victoryCutsceneStage === 2 ? 36 : 41;
      const sandMinY = getBeachHeightAt(_cutCamPos.x, _cutCamPos.z) + 0.55;
      _cutCamPos.y = Math.max(_cutCamPos.y, sandMinY);
    } else {
      const sp = _vicPos;
      let dist = 2.85;
      let camHeight = 1.25;
      let orbitAng = -0.35 * dir;

      if (kind === 'heat_win') {
        dist = THREE.MathUtils.lerp(2.9, 2.3, smoothP);
        camHeight = THREE.MathUtils.lerp(1.15, 1.32, smoothP);
        orbitAng = THREE.MathUtils.lerp(-0.55 * dir, 0.35 * dir, smoothP);
        targetFov = 37;
      } else if (kind === 'quarterfinal_win') {
        dist = THREE.MathUtils.lerp(3.45, 2.45, smoothP);
        camHeight = THREE.MathUtils.lerp(0.95, 1.38, smoothP);
        orbitAng = THREE.MathUtils.lerp(-0.75 * dir, 0.45 * dir, smoothP);
        targetFov = THREE.MathUtils.lerp(42, 37, smoothP);
      } else if (kind === 'semifinal_win') {
        dist = THREE.MathUtils.lerp(3.85, 2.55, smoothP);
        camHeight = THREE.MathUtils.lerp(1.05, 1.28, smoothP);
        orbitAng = THREE.MathUtils.lerp(-1.05 * dir, 0.72 * dir, smoothP);
        targetFov = THREE.MathUtils.lerp(44, 38, smoothP);
      } else {
        // 'final_win'
        dist =
          this.victoryCutsceneStage === 1
            ? THREE.MathUtils.lerp(4.9, 3.6, this.victoryCutsceneStageProgress)
            : THREE.MathUtils.lerp(3.6, 2.6, smoothP);
        camHeight = THREE.MathUtils.lerp(1.45, 1.22, smoothP);
        orbitAng = THREE.MathUtils.lerp(1.25 * dir, -0.38 * dir, smoothP);
        targetFov = THREE.MathUtils.lerp(46, 38, smoothP);
      }

      _cutCamPos.set(
        sp.x + Math.sin(orbitAng) * dist,
        sp.y + camHeight,
        sp.z - Math.cos(orbitAng) * dist
      );
      _cutLookTarget.set(sp.x, sp.y + 1.05, sp.z);
      const safeMinY = this.getSafeCameraMinY(_cutCamPos.x, _cutCamPos.z, sp.x, sp.z, 0.72);
      _cutCamPos.y = Math.max(_cutCamPos.y, safeMinY);
    }

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _cutCamPos.x, 4.8, rawDt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _cutCamPos.y, 4.8, rawDt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _cutCamPos.z, 4.8, rawDt);
    _tpCurPos.copy(this.camera.position);
    _prevCamPos.copy(this.camera.position);

    _currentLook.x = THREE.MathUtils.damp(_currentLook.x, _cutLookTarget.x, 5.6, rawDt);
    _currentLook.y = THREE.MathUtils.damp(_currentLook.y, _cutLookTarget.y, 5.6, rawDt);
    _currentLook.z = THREE.MathUtils.damp(_currentLook.z, _cutLookTarget.z, 5.6, rawDt);
    this.camera.lookAt(_currentLook);

    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 4.2, rawDt);
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    this.currentBlur = THREE.MathUtils.damp(this.currentBlur, 0, 6, rawDt);
    this.impactBlur = THREE.MathUtils.damp(this.impactBlur, 0, 6, rawDt);
    this.lensDroplets = THREE.MathUtils.damp(this.lensDroplets, 0, 4, rawDt);
    this.whitewaterWash = THREE.MathUtils.damp(this.whitewaterWash, 0, 6, rawDt);
    this.underwaterBlend = THREE.MathUtils.damp(this.underwaterBlend, 0, 6, rawDt);
    this.slowMoGray = THREE.MathUtils.damp(this.slowMoGray, 0, 7, rawDt);
    this.syncPostFxUniforms();
  }

  private updateSurfCamera(rawDt: number) {
    if (this.victoryCutsceneActive) {
      this.updateVictoryCutsceneCamera(rawDt);
      return;
    }
    if (this.cutsceneActive) {
      this.updateCutsceneCamera(rawDt);
      return;
    }
    const s = this.physics.state;
    const wp = this.physics.waveParams;
    const camDt = rawDt * (0.5 + 0.5 * s.timeScale);

    // Smooth free-look (drag + passive mouse movement), orbit & zoom interpolation
    this.camLookYaw = THREE.MathUtils.damp(this.camLookYaw, this.camLookYawTarget, 16, rawDt);
    this.camLookPitch = THREE.MathUtils.damp(this.camLookPitch, this.camLookPitchTarget, 16, rawDt);
    this.camZoom = THREE.MathUtils.damp(this.camZoom, this.camZoomTarget, 12, rawDt);
    this.mouseLookYaw = THREE.MathUtils.damp(this.mouseLookYaw, this.mouseLookYawTarget, 9.5, rawDt);
    this.mouseLookPitch = THREE.MathUtils.damp(this.mouseLookPitch, this.mouseLookPitchTarget, 9.5, rawDt);

    const effectiveYaw = this.camLookYaw + this.mouseLookYaw;
    const effectivePitch = this.camLookPitch + this.mouseLookPitch;

    // Smooth non-teleporting blend between Third-Person (0) and First-Person (1)
    const targetFp = this.cameraMode === 'firstPerson' ? 1.0 : 0.0;
    this.fpBlend = THREE.MathUtils.damp(this.fpBlend, targetFp, 7.5, rawDt);
    this.surferRig.setFirstPersonMode(this.fpBlend > 0.52);

    // Update decoupled 3P follow heading:
    // Fixed oceanward anchor while walking/paddling/swimming (prevents joystick spin loops),
    // smoothly chasing the surfboard once riding the wave.
    if (s.phase === 'beachWalk' || s.phase === 'paddling' || s.phase === 'recovering') {
      this.tpFollowHeading = lerpAngleRad(this.tpFollowHeading, Math.PI, 1 - Math.exp(-3.4 * camDt));
    } else if (s.phase !== 'wipeout') {
      this.tpFollowHeading = lerpAngleRad(this.tpFollowHeading, s.heading, 1 - Math.exp(-7.5 * camDt));
    }

    // --- 1. COMPUTE THIRD-PERSON SPHERICAL ORBIT AROUND SURFBOARD TRACKING ANCHOR ---
    const shoulderOffset = wp.breakDir;
    const orbitYaw = this.tpFollowHeading + effectiveYaw;
    const backX = -Math.sin(orbitYaw);
    const backZ = -Math.cos(orbitYaw);
    const rightX = Math.cos(orbitYaw);
    const rightZ = -Math.sin(orbitYaw);

    let followDist = 4.25;
    let followHeight = 1.52;
    let sideBias = shoulderOffset * 1.4;
    let tpFov = 50 + THREE.MathUtils.clamp((s.speed - 6) * 0.5, 0, 7);
    let targetBank = -s.roll * 0.14;
    let lookAheadX = s.position.x + Math.sin(s.heading) * 1.8 + shoulderOffset * 0.75;
    let lookAheadY = s.position.y + 0.9;
    let lookAheadZ = s.position.z + Math.cos(s.heading) * 1.6;

    if (s.phase === 'beachWalk') {
      followDist = 4.15;
      followHeight = 1.68;
      sideBias = 0.65;
      tpFov = 48;
      targetBank = 0;
      lookAheadX = s.position.x + Math.sin(s.heading) * 1.6;
      lookAheadY = s.position.y + 1.05;
      lookAheadZ = s.position.z + Math.cos(s.heading) * 1.6 - 0.6;
    } else if (s.phase === 'paddling') {
      followDist = 4.1;
      followHeight = 1.65;
      sideBias = shoulderOffset * 1.1;
      tpFov = 48;
      targetBank = 0;
    } else if (s.phase === 'duckDive') {
      followDist = 3.85;
      followHeight = s.submersionDepth > 0.12 ? 0.35 : 1.55;
      sideBias = shoulderOffset * 0.95;
      tpFov = 48;
      targetBank = 0;
      lookAheadY = s.position.y + 0.32;
    } else if (s.phase === 'barrel') {
      followDist = 2.95;
      followHeight = 1.02;
      sideBias = shoulderOffset * 0.92;
      tpFov = 56;
      targetBank = -s.roll * 0.1;
    } else if (s.phase === 'airborne') {
      followDist = 4.95;
      followHeight = 1.35;
      sideBias = shoulderOffset * 1.75;
      tpFov = 54;
      targetBank = s.roll * 0.12;
    } else if (s.phase === 'maneuver') {
      followDist = 4.15;
      followHeight = 1.45;
      sideBias = shoulderOffset * 1.65;
      tpFov = 52;
    } else if (s.phase === 'wipeout') {
      followDist = 4.4;
      followHeight = s.submersionDepth > 0.12 ? 0.45 : 1.75;
      sideBias = shoulderOffset * 1.05;
      tpFov = 50;
      targetBank = 0;
      lookAheadX = s.position.x;
      lookAheadY = s.position.y + 0.35;
      lookAheadZ = s.position.z;
    } else if (s.phase === 'recovering') {
      followDist = 4.55;
      followHeight = 1.92;
      sideBias = shoulderOffset * 0.85;
      tpFov = 50;
      targetBank = 0;
      lookAheadX = s.position.x * 0.65 + s.boardPos.x * 0.35;
      lookAheadY = s.position.y + 0.55;
      lookAheadZ = s.position.z * 0.65 + s.boardPos.z * 0.35;
    }

    // Damp surfboard tracking distance & elevation with slow-mo camDt while user orbit/zoom reacts smoothly on true sphere
    this.tpSmoothDist = THREE.MathUtils.damp(this.tpSmoothDist, followDist, 6.5, camDt);
    this.tpSmoothHeight = THREE.MathUtils.damp(this.tpSmoothHeight, followHeight, 6.5, camDt);

    const freeOrbitBlend = THREE.MathUtils.clamp(Math.abs(effectiveYaw) * 0.85, 0, 1);
    lookAheadX = THREE.MathUtils.lerp(lookAheadX, s.position.x, freeOrbitBlend);
    lookAheadZ = THREE.MathUtils.lerp(lookAheadZ, s.position.z, freeOrbitBlend);

    _camLookTarget.set(lookAheadX, lookAheadY, lookAheadZ);
    const trackLambda = s.phase === 'barrel' ? 9.5 : 8.2;
    _currentLook.x = THREE.MathUtils.damp(_currentLook.x, _camLookTarget.x, trackLambda, camDt);
    _currentLook.y = THREE.MathUtils.damp(_currentLook.y, _camLookTarget.y, trackLambda, camDt);
    _currentLook.z = THREE.MathUtils.damp(_currentLook.z, _camLookTarget.z, trackLambda, camDt);

    const scaledDist = this.tpSmoothDist * this.camZoom;
    const tpPitchOffset = this.cameraMode === 'thirdPerson' ? effectivePitch : 0;
    const horizScale = Math.cos(tpPitchOffset * 0.65);
    const orbitHeight =
      this.tpSmoothHeight - (lookAheadY - s.position.y) + Math.sin(tpPitchOffset) * scaledDist * 0.9;
    const sideWeight = Math.max(0.18, 1.0 - Math.min(1, Math.abs(effectiveYaw) * 0.5));

    const tgtX =
      _currentLook.x + backX * scaledDist * horizScale + rightX * sideBias * sideWeight;
    const tgtZ =
      _currentLook.z +
      backZ * scaledDist * horizScale +
      rightZ * sideBias * sideWeight -
      (s.phase === 'beachWalk' || s.phase === 'recovering' || freeOrbitBlend > 0.2 ? 0 : 0.45);

    const isIntentionalSubmersion =
      (s.phase === 'wipeout' || s.phase === 'duckDive') && s.submersionDepth > 0.08;
    const clearance = s.phase === 'barrel' ? 0.62 : 0.85;

    let minTargetY = -999;
    if (!isIntentionalSubmersion) {
      minTargetY = this.getSafeCameraMinY(tgtX, tgtZ, s.position.x, s.position.z, clearance);
    }

    _tpCurPos.set(
      tgtX,
      Math.max(minTargetY, _currentLook.y + orbitHeight),
      tgtZ
    );

    this.camBankRoll = THREE.MathUtils.damp(this.camBankRoll, targetBank * (1 - freeOrbitBlend * 0.7), 5.5, camDt);
    _tpLookMat.lookAt(_tpCurPos, _currentLook, _worldUp);
    _tpQuat.setFromRotationMatrix(_tpLookMat);
    if (Math.abs(this.camBankRoll) > 0.0005) {
      _bankQuat.setFromAxisAngle(_zAxis, this.camBankRoll);
      _tpQuat.multiply(_bankQuat);
    }

    // --- 2. COMPUTE FIRST-PERSON EYE POSE + FREE-LOOK ---
    const fpLookPitch = this.cameraMode === 'firstPerson' ? effectivePitch : 0;
    this.surferRig.getFirstPersonPose(s, effectiveYaw, fpLookPitch, _fpPos, _fpQuat);
    if (!isIntentionalSubmersion) {
      const waveHere = sampleSurfWave(_fpPos.x, _fpPos.z, wp).height;
      const beachHere = getBeachHeightAt(_fpPos.x, _fpPos.z);
      const fpFloor = Math.max(waveHere + 0.16, beachHere + 0.4);
      if (_fpPos.y < fpFloor) {
        _fpPos.y = fpFloor;
      }
    }

    // --- 3. SMOOTHLY BLEND 3P <-> 1P CAMERA ---
    this.camera.position.lerpVectors(_tpCurPos, _fpPos, this.fpBlend);
    this.camera.quaternion.slerpQuaternions(_tpQuat, _fpQuat, this.fpBlend);

    // --- 4. DAMPED WATER IMPACT CAMERA SHAKE ---
    this.shakeTrauma = THREE.MathUtils.damp(this.shakeTrauma, 0, 6.2, rawDt);
    if (this.cameraShakeEnabled && this.shakeTrauma > 0.01) {
      const amp = this.shakeTrauma * this.shakeTrauma * 0.14;
      const sx = Math.sin(this.elapsedTime * 54.0) * amp;
      const sy = Math.cos(this.elapsedTime * 68.0) * amp * 0.85;
      _camFwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      _camRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      _camUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
      this.camera.position.addScaledVector(_camRight, sx);
      this.camera.position.addScaledVector(_camUp, sy);
    }

    // Smooth FOV transition between 3P and wide immersive 1P
    const fpFov =
      s.phase === 'barrel' || s.phase === 'airborne'
        ? 72
        : s.phase === 'riding' || s.phase === 'maneuver'
          ? 68
          : 62;
    const targetFov = THREE.MathUtils.lerp(tpFov, fpFov, this.fpBlend);
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 4.5, rawDt);
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    // --- 5. POST-PROCESSING MOTION BLUR & WATER IMPACT OPTICS ---
    _camDelta.subVectors(this.camera.position, _prevCamPos);
    _prevCamPos.copy(this.camera.position);
    const camSpeed = _camDelta.length() / Math.max(rawDt, 0.001);
    const speedNorm = THREE.MathUtils.clamp((s.speed - 8.5) / 14.0, 0, 1);
    const camNorm = THREE.MathUtils.clamp((camSpeed - 7.5) / 18.0, 0, 1);

    // Keep sustained surfing motion blur very restrained so water & board remain sharp
    const rawSpeedBlur =
      !this.cameraBlurEnabled ||
      s.phase === 'beachWalk' ||
      s.phase === 'paddling' ||
      s.phase === 'wipeout' ||
      s.phase === 'recovering'
        ? 0.0
        : THREE.MathUtils.clamp(speedNorm * 0.20 + camNorm * 0.12 + (s.inBarrel ? 0.08 : 0), 0, 0.28);

    this.currentBlur = THREE.MathUtils.damp(this.currentBlur, rawSpeedBlur, 5.5, rawDt);
    this.impactBlur = THREE.MathUtils.damp(
      this.impactBlur,
      this.cameraBlurEnabled ? s.underwaterAmount * 0.42 : 0,
      3.8,
      rawDt
    );
    const rainDropTarget =
      s.underwaterAmount < 0.25 && this.weatherRain > 0.15
        ? this.weatherRain * 0.32 * Math.max(0.3, this.cameraImpactIntensity)
        : 0;
    this.lensDroplets = Math.max(
      rainDropTarget,
      THREE.MathUtils.damp(this.lensDroplets, 0, 0.68, rawDt)
    );
    this.whitewaterWash = THREE.MathUtils.damp(this.whitewaterWash, 0, 2.8, rawDt);
    this.underwaterBlend = THREE.MathUtils.damp(this.underwaterBlend, s.underwaterAmount, 9.0, rawDt);

    if (this.cameraFxPass) {
      this.cameraFxPass.uniforms.uVelocityDir.value.set(
        THREE.MathUtils.clamp(_camDelta.x * 2.5, -1, 1),
        THREE.MathUtils.clamp(_camDelta.y * 2.5, -1, 1)
      );
    }
    this.syncPostFxUniforms();
  }

  private syncPostFxUniforms() {
    if (!this.cameraFxPass) return;
    const u = this.cameraFxPass.uniforms;
    u.uTime.value = this.elapsedTime;
    u.uBlurStrength.value = this.currentBlur;
    u.uImpactBlur.value = this.impactBlur;
    u.uDroplets.value = this.lensDroplets;
    u.uWhitewater.value = this.whitewaterWash;
    u.uUnderwater.value = this.underwaterBlend;
    u.uSlowMoGray.value = this.slowMoGray;
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateReplayPlayback(rawDt: number) {
    const duration = Math.max(0.1, this.replayDuration);
    if (this.replayPlaying) {
      this.replayTime += rawDt * this.replaySpeed;
      if (this.replayTime >= duration) {
        this.replayTime %= duration;
        this.replayBuffer.resetPlaybackCursor();
        this.waterParticles.reset();
        this.replaySeekPending = true;
      }
    }

    const { elapsedTime } = this.replayBuffer.sampleAt(
      this.replayTime,
      this.replayPlaying,
      this.replayState,
      this.replayWave
    );
    this.elapsedTime = elapsedTime;

    const s = this.replayState;
    const wp = this.replayWave;

    const oceanU = this.ocean.material.uniforms;
    oceanU.uSurfMode.value = 1.0;
    oceanU.uSurfSimTime.value = wp.simTime;
    oceanU.uWaveCenterZ.value = wp.waveCenterZ;
    oceanU.uSurfWaveHeight.value = wp.waveHeight;
    oceanU.uSurfWaveSpeed.value = wp.waveSpeed;
    oceanU.uSurfSteepness.value = wp.steepness;
    oceanU.uBreakX.value = wp.breakX;
    oceanU.uBreakDir.value = wp.breakDir;
    oceanU.uWaveLengthZ.value = wp.waveLengthZ;

    this.barrelCurl.update(
      wp,
      oceanU.uShallowColor.value,
      oceanU.uDeepColor.value,
      _sunDir,
      this.weatherOvercast,
      this.weatherRain
    );

    this.surferRig.setFirstPersonMode(this.replayAngle === 'firstPerson');
    const animDt = this.replaySeekPending ? 0.14 : Math.max(0.001, rawDt * this.replaySpeed);
    this.replaySeekPending = false;
    this.surferRig.animate(s, wp.simTime, animDt);

    if (this.replayPlaying) {
      const simDt = Math.min(rawDt, 0.05) * s.timeScale * this.replaySpeed;
      this.waterParticles.update(Math.max(0.0005, simDt), s);
    }

    this.applySunAndAtmosphere(rawDt);
    this.coast.update(
      this.elapsedTime,
      this.currentEnv.windStrength,
      this.currentEnv.waveSpeed,
      rawDt,
      this.camera.position.z,
      this.underwaterBlend
    );
    this.beachLife.update(
      this.elapsedTime,
      this.currentEnv.windStrength,
      rawDt,
      this.camera.position.z,
      this.underwaterBlend
    );
    this.marineLife.update(this.elapsedTime, rawDt, s.position, wp, this.camera.position);

    this.updateReplayCamera(rawDt);
    this.rainSystem.update(
      rawDt,
      this.camera.position,
      this.weatherRain,
      this.currentEnv.windStrength + this.weatherRain * 0.5,
      this.underwaterBlend > 0.35
    );

    this.replayHudEmitAccum += rawDt;
    if (this.replayHudEmitAccum >= 0.075) {
      this.replayHudEmitAccum = 0;
      const sample = sampleSurfWave(s.position.x, s.position.z, wp);
      this.emitHudState(false, sample.section);
    }
  }

  private updateReplayCamera(rawDt: number) {
    const s = this.replayState;
    const wp = this.replayWave;

    this.camLookYaw = THREE.MathUtils.damp(this.camLookYaw, this.camLookYawTarget, 14, rawDt);
    this.camLookPitch = THREE.MathUtils.damp(this.camLookPitch, this.camLookPitchTarget, 14, rawDt);
    this.camZoom = THREE.MathUtils.damp(this.camZoom, this.camZoomTarget, 12, rawDt);

    let targetFov = 48;
    const isIntentionalSubmersion =
      (s.phase === 'wipeout' || s.phase === 'duckDive') && s.submersionDepth > 0.08;

    if (this.replayAngle === 'firstPerson') {
      this.surferRig.getFirstPersonPose(s, this.camLookYaw, this.camLookPitch, _fpPos, _fpQuat);
      if (!isIntentionalSubmersion) {
        const waveHere = sampleSurfWave(_fpPos.x, _fpPos.z, wp).height;
        const beachHere = getBeachHeightAt(_fpPos.x, _fpPos.z);
        const fpFloor = Math.max(waveHere + 0.16, beachHere + 0.4);
        if (_fpPos.y < fpFloor) _fpPos.y = fpFloor;
      }
      this.camera.position.copy(_fpPos);
      this.camera.quaternion.copy(_fpQuat);
      targetFov = s.phase === 'barrel' || s.phase === 'airborne' ? 72 : 66;
    } else if (this.replayAngle === 'beach') {
      // Shoreline broadcast telephoto camera panning smoothly across the wave
      this.camera.position.set(
        this.replayBeachAnchor.x,
        Math.max(this.replayBeachAnchor.y, getBeachHeightAt(this.replayBeachAnchor.x, this.replayBeachAnchor.z) + 1.4),
        this.replayBeachAnchor.z
      );
      _camLookTarget.set(s.position.x, s.position.y + 0.85, s.position.z);
      _currentLook.lerp(_camLookTarget, 1 - Math.exp(-9 * rawDt));
      this.camera.lookAt(_currentLook);
      targetFov = 28;
    } else if (this.replayAngle === 'waterline') {
      // Channel surf-photographer housing looking right back into the barrel & carving surfer
      const channelOffset = wp.breakDir * 5.2;
      const aheadZ = 3.2;
      const desiredX = s.position.x + channelOffset;
      const desiredZ = s.position.z + aheadZ;
      const waterAtCam = sampleSurfWave(desiredX, desiredZ, wp).height;
      const beachAtCam = getBeachHeightAt(desiredX, desiredZ);
      const desiredY = Math.max(waterAtCam + 0.58, beachAtCam + 0.65);

      _camPosTarget.set(desiredX, desiredY, desiredZ);
      this.camera.position.lerp(_camPosTarget, 1 - Math.exp(-6.5 * rawDt));
      _camLookTarget.set(s.position.x, s.position.y + 0.72, s.position.z);
      _currentLook.lerp(_camLookTarget, 1 - Math.exp(-10 * rawDt));
      this.camera.lookAt(_currentLook);
      targetFov = 56;
    } else if (this.replayAngle === 'helicopter') {
      // High aerial drone angle showing the full peeling wave & wake arc
      const orbitYaw = s.heading * 0.35 + Math.PI * 0.18 + this.camLookYaw;
      const dist = 10.8 * this.camZoom;
      const pitch = THREE.MathUtils.clamp(0.46 + this.camLookPitch * 0.5, 0.14, 1.05);
      const horiz = Math.cos(pitch) * dist;
      const camX = s.position.x - Math.sin(orbitYaw) * horiz + wp.breakDir * 2.2;
      const camZ = s.position.z - Math.cos(orbitYaw) * horiz + 2.8;
      const minY = this.getSafeCameraMinY(camX, camZ, s.position.x, s.position.z, 1.4);
      const camY = Math.max(minY, s.position.y + Math.sin(pitch) * dist + 1.8);

      _camPosTarget.set(camX, camY, camZ);
      this.camera.position.lerp(_camPosTarget, 1 - Math.exp(-6.5 * rawDt));
      _camLookTarget.set(s.position.x + wp.breakDir * 0.8, s.position.y + 0.65, s.position.z);
      _currentLook.lerp(_camLookTarget, 1 - Math.exp(-8.5 * rawDt));
      this.camera.lookAt(_currentLook);
      targetFov = 48;
    } else {
      // 'follow': Dynamic low-angle surfing chase cam with drag-to-orbit support
      const orbitYaw = s.heading + this.camLookYaw;
      const dist = 3.95 * this.camZoom;
      const horizScale = Math.cos(this.camLookPitch * 0.65);
      const backX = -Math.sin(orbitYaw);
      const backZ = -Math.cos(orbitYaw);
      const rightX = Math.cos(orbitYaw);
      const rightZ = -Math.sin(orbitYaw);
      const sideBias = wp.breakDir * 1.35 * Math.max(0.18, 1 - Math.abs(this.camLookYaw) * 0.45);

      const camX = s.position.x + backX * dist * horizScale + rightX * sideBias;
      const camZ = s.position.z + backZ * dist * horizScale + rightZ * sideBias;
      const minY = isIntentionalSubmersion
        ? -999
        : this.getSafeCameraMinY(camX, camZ, s.position.x, s.position.z, 0.78);
      const camY = Math.max(
        minY,
        s.position.y + 1.32 + Math.sin(this.camLookPitch) * dist * 0.88
      );

      this.camera.position.set(camX, camY, camZ);
      _camLookTarget.set(s.position.x, s.position.y + 0.85, s.position.z);
      _currentLook.lerp(_camLookTarget, 1 - Math.exp(-12 * rawDt));
      _tpLookMat.lookAt(this.camera.position, _currentLook, _worldUp);
      _tpQuat.setFromRotationMatrix(_tpLookMat);
      this.camBankRoll = THREE.MathUtils.damp(this.camBankRoll, -s.roll * 0.14, 6, rawDt);
      if (Math.abs(this.camBankRoll) > 0.0005 && Math.abs(this.camLookYaw) < 0.35) {
        _bankQuat.setFromAxisAngle(_zAxis, this.camBankRoll);
        _tpQuat.multiply(_bankQuat);
      }
      this.camera.quaternion.copy(_tpQuat);
      targetFov = s.phase === 'barrel' ? 56 : 50;
    }

    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6.0, rawDt);
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    this.currentBlur = THREE.MathUtils.damp(this.currentBlur, 0, 8, rawDt);
    this.impactBlur = THREE.MathUtils.damp(
      this.impactBlur,
      this.cameraBlurEnabled ? s.underwaterAmount * 0.35 : 0,
      6,
      rawDt
    );
    this.lensDroplets = THREE.MathUtils.damp(
      this.lensDroplets,
      this.replayAngle === 'waterline' || this.replayAngle === 'firstPerson'
        ? Math.max(s.inBarrel ? 0.25 : 0, s.underwaterAmount * 0.65) * this.cameraImpactIntensity
        : 0,
      2.5,
      rawDt
    );
    this.whitewaterWash = THREE.MathUtils.damp(this.whitewaterWash, 0, 6, rawDt);
    this.underwaterBlend = THREE.MathUtils.damp(this.underwaterBlend, s.underwaterAmount, 9, rawDt);
    const replayManeuverSlowMo =
      s.phase === 'maneuver' || s.phase === 'airborne' ? 0.9 : 0.0;
    this.slowMoGray = THREE.MathUtils.damp(this.slowMoGray, replayManeuverSlowMo, 9, rawDt);
    this.syncPostFxUniforms();
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      if (!this.isSoftwareGl && this.graphics.fpsLimit > 0) {
        const minIntervalMs = 1000 / this.graphics.fpsLimit;
        if (now - this.lastRenderTime < minIntervalMs - 1.5) {
          this.frameId = requestAnimationFrame(tick);
          return;
        }
        this.lastRenderTime = now;
      }

      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.updateWeather(dt);

      if (this.screen === 'surfing' && this.replayActive) {
        this.renderer.shadowMap.autoUpdate = true;
        this.updateReplayPlayback(dt);
      } else {
        const isFrozenPause = this.screen === 'surfing' && this.paused;
        if (this.screen === 'surfing' || this.screen === 'interview') {
          this.renderer.shadowMap.autoUpdate = !isFrozenPause;
        } else {
          this.renderer.shadowMap.autoUpdate = false;
          this.menuShadowAccum += dt;
          if (this.menuShadowAccum >= 0.12) {
            this.menuShadowAccum = 0;
            this.renderer.shadowMap.needsUpdate = true;
          }
        }

        if (this.screen === 'surfing') {
          this.updateSurfingGameplay(dt);
          if (!this.paused) {
            this.elapsedTime += dt * this.physics.state.timeScale;
          }
        } else {
          this.elapsedTime += dt;
          if (this.screen === 'interview') {
            this.interviewStage.update(
              this.elapsedTime,
              dt,
              this.interviewPhase,
              this.interviewTone
            );
            this.surferRig.animateInterview(
              this.interviewPhase,
              this.interviewTone,
              this.elapsedTime,
              dt,
              this.interviewStage.getSurferAnchor(_intvSurferPos),
              -1.69,
              this.interviewStage.getBoardAnchor(_intvBoardPos)
            );
          }
        }

        if (!isFrozenPause) {
          this.applySunAndAtmosphere(dt);
          this.coast.update(
            this.elapsedTime,
            this.currentEnv.windStrength + this.weatherRain * 0.45,
            this.currentEnv.waveSpeed,
            dt,
            this.camera.position.z,
            this.underwaterBlend
          );

          const isOpaqueModal =
            this.screen === 'career' ||
            this.screen === 'careerCreate' ||
            this.screen === 'settings';
          let runEnvDetails = true;
          let envDt = dt;
          if (isOpaqueModal) {
            this.modalEnvAccum += dt;
            if (this.modalEnvAccum < 0.05) {
              runEnvDetails = false;
            } else {
              envDt = this.modalEnvAccum;
              this.modalEnvAccum = 0;
            }
          } else {
            this.modalEnvAccum = 0;
          }

          if (runEnvDetails) {
            const { volleyballHitPulse } = this.beachLife.update(
              this.elapsedTime,
              this.currentEnv.windStrength + this.weatherRain * 0.45,
              envDt,
              this.camera.position.z,
              this.underwaterBlend
            );
            if (volleyballHitPulse && this.underwaterBlend < 0.25) {
              const distToCourt = Math.hypot(
                this.camera.position.x - 19.5,
                this.camera.position.z - 27.8
              );
              if (distToCourt < 56) {
                oceanAudio.playVolleyballHit(THREE.MathUtils.clamp(1 - distToCourt / 56, 0.08, 0.85));
              }
            }
            const activeSurferPos = this.screen === 'surfing' ? this.physics.state.position : null;
            const activeWave = this.screen === 'surfing' ? this.physics.waveParams : null;
            this.marineLife.update(
              this.elapsedTime,
              envDt,
              activeSurferPos,
              activeWave,
              this.camera.position
            );
          }

          if (this.screen !== 'surfing') {
            oceanAudio.updateSurfTelemetry(0, 0, false, 0, false, this.weatherRain);
          }
          this.updateCamera(dt);
          this.rainSystem.update(
            dt,
            this.camera.position,
            this.weatherRain,
            this.currentEnv.windStrength + this.weatherRain * 0.5,
            this.underwaterBlend > 0.35
          );
        } else {
          if (this.screen !== 'surfing') {
            oceanAudio.updateSurfTelemetry(0, 0, false, 0, false, this.weatherRain);
          }
        }
      }

      if (this.boardMeshGroup && this.boardAnchor.visible) {
        this.boardMeshGroup.position.y = Math.sin(this.elapsedTime * 1.3) * 0.006;
      }

      if (
        this.isSoftwareGl ||
        !this.composer ||
        !this.graphics.postProcessingEnabled ||
        this.screen !== 'surfing'
      ) {
        this.renderer.render(this.scene, this.camera);
      } else {
        this.composer.render();
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      tick();
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.handleCanvasPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.handleCanvasPointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.handleCanvasPointerUp);
    this.renderer.domElement.removeEventListener('pointercancel', this.handleCanvasPointerUp);
    this.renderer.domElement.removeEventListener('lostpointercapture', this.handleCanvasPointerUp);
    this.renderer.domElement.removeEventListener('pointerleave', this.handleCanvasPointerLeave);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleCanvasContextMenu);
    this.renderer.domElement.removeEventListener('wheel', this.handleCanvasWheel);
    this.renderer.domElement.removeEventListener('dblclick', this.handleCanvasDblClick);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.textures.dispose();
    this.coast.dispose();
    this.beachLife.dispose();
    this.marineLife.dispose();
    this.barrelCurl.dispose();
    this.surferRig.dispose();
    this.npcSurfers.dispose();
    this.waterParticles.dispose();
    this.rainSystem.dispose();
    this.victoryCeremony.dispose();
    this.interviewStage.dispose();
    this.sky.mesh.geometry.dispose();
    this.sky.material.dispose();
    this.ocean.mesh.geometry.dispose();
    this.ocean.material.dispose();
    this.envMapTexture?.dispose();

    if (this.boardMeshGroup) {
      this.boardMeshGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
