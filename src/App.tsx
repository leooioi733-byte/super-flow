import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { oceanAudio } from './audio/oceanAudio';
import {
  acceptSponsorInvite,
  advanceToNextSeason,
  advanceTournamentToNextRound,
  buildCareerHeatNpcSpecs,
  buildHeatCompetitorWavesFromTelemetry,
  buildHeatCutsceneInfo,
  buyCareerBoard,
  careerCustomizationToSurferProfile,
  computeLiveHeatHUD,
  createNewCareer,
  declineSponsorInvite,
  dismissFinishedTournament,
  dismissRivalryNotification,
  equipCareerBoard,
  finalizePlayerHeat,
  loadCareerSave,
  startChampionshipTournament,
  updateCareerCustomization,
} from './career/careerEngine';
import { CareerCreateScreen } from './components/CareerCreateScreen';
import { CareerHubScreen } from './components/CareerHubScreen';
import { GameplayHUD } from './components/GameplayHUD';
import { HeatCutsceneOverlay } from './components/HeatCutsceneOverlay';
import { LandscapePromptModal } from './components/LandscapePromptModal';
import { MenuOverlay } from './components/MenuOverlay';
import { OfflineIndicator } from './components/PWAInstallButton';
import { TIER_MAP } from './data/careerData';
import {
  BEACH_SPOTS,
  SURFBOARDS,
  SURFER_PROFILES,
} from './data/surfData';
import { SurfSceneManager } from './three/SurfSceneManager';
import {
  CareerSaveState,
  CareerSurferCustomization,
} from './types/career';
import {
  AspectMode,
  BeachSpot,
  CameraMode,
  GameSettings,
  ManeuverType,
  MenuScreen,
  ReplayCameraAngle,
  SurfboardSpec,
  SurferProfile,
  SurfHUDState,
  SurfPhase,
  WeatherMode,
} from './types/game';
import {
  applyCrossDeviceBundle,
  CrossDeviceBundle,
  loadGameSettings,
  saveGameSettings,
} from './utils/pcSettings';

const INITIAL_HUD: SurfHUDState = {
  phase: 'beachWalk',
  score: 0,
  combo: 1,
  comboTimer: 0,
  speedKmh: 0,
  balance: 0,
  stability: 1,
  waveSection: 'flat',
  inBarrel: false,
  barrelTime: 0,
  timeScale: 1,
  lastCallout: '',
  lastQuality: null,
  calloutId: 0,
  sequenceChain: 0,
  maxSequenceChain: 0,
  sequenceTag: '',
  sequenceTier: 0,
  waveNumber: 1,
  currentWavePoints: 0,
  currentWaveManeuvers: 0,
  currentWaveBestManeuver: '',
  currentWaveBarrelTime: 0,
  completedWaves: [],
  availability: {
    bottomTurn: false,
    cutback: false,
    floater: false,
    air: false,
    duckDive: false,
  },
  isPaused: false,
  cameraMode: 'thirdPerson',
  cameraModified: false,
  isUnderwater: false,
  weather: 'sunny',
  weatherMode: 'dynamic',
  rainIntensity: 0,
  maneuverSlowMo: 0,
  postFxActive: true,
  cutsceneActive: false,
  cutsceneStage: 0,
  cutsceneProgress: 0,
  replay: {
    active: false,
    playing: true,
    available: false,
    currentTime: 0,
    duration: 0,
    playbackSpeed: 1,
    cameraAngle: 'follow',
  },
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneManagerRef = useRef<SurfSceneManager | null>(null);

  const [screen, setScreen] = useState<MenuScreen>('home');
  const [selectedBeach, setSelectedBeach] = useState<BeachSpot>(BEACH_SPOTS[0]);
  const [selectedSurfer, setSelectedSurfer] = useState<SurferProfile>(SURFER_PROFILES[0]);
  const [selectedBoard, setSelectedBoard] = useState<SurfboardSpec>(SURFBOARDS[0]);
  const [settings, setSettings] = useState<GameSettings>(() => loadGameSettings());
  const [cameraMode, setCameraMode] = useState<CameraMode>('thirdPerson');
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState<SurfHUDState>(INITIAL_HUD);
  const [contextLost, setContextLost] = useState(false);
  const [isCapturingKey, setIsCapturingKey] = useState(false);

  // Career Mode persistent state & active competition heat tracking
  const [career, setCareer] = useState<CareerSaveState | null>(() => loadCareerSave());
  const [isCareerHeatActive, setIsCareerHeatActive] = useState(false);
  const [heatElapsedSec, setHeatElapsedSec] = useState(0);
  const [seenCutsceneKeys, setSeenCutsceneKeys] = useState<Set<string>>(() => new Set());

  const initialSettingsRef = useRef<GameSettings>(settings);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const heldManeuverKeysRef = useRef<Set<string>>(new Set());
  const touchJoyRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchBalanceRef = useRef<number>(0);
  const hudPhaseRef = useRef<SurfPhase>('beachWalk');
  const hudRef = useRef<SurfHUDState>(INITIAL_HUD);
  const careerRef = useRef<CareerSaveState | null>(career);
  const heatElapsedRef = useRef<number>(0);
  const heatFinalizedRef = useRef<boolean>(false);

  useEffect(() => {
    careerRef.current = career;
  }, [career]);

  useEffect(() => {
    heatElapsedRef.current = heatElapsedSec;
  }, [heatElapsedSec]);

  const syncCombinedInput = useCallback(() => {
    const keys = heldKeysRef.current;
    let kx = 0;
    let ky = 0;
    let kBal = 0;

    if (keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) ky += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) ky -= 1;
    if (keys.has('KeyQ')) kBal -= 1;
    if (keys.has('KeyE')) kBal += 1;

    // Contextual Space: forward paddle / swim / beach walk assist when not riding
    if (
      keys.has('Space') &&
      (hudPhaseRef.current === 'beachWalk' ||
        hudPhaseRef.current === 'paddling' ||
        hudPhaseRef.current === 'recovering')
    ) {
      ky += 1;
    }

    const balanceStabilize = keys.has('ShiftLeft') || keys.has('ShiftRight');

    const moveX = Math.max(-1, Math.min(1, kx + touchJoyRef.current.x));
    const moveY = Math.max(-1, Math.min(1, ky + touchJoyRef.current.y));
    const balanceAdjust = Math.max(-1, Math.min(1, kBal + touchBalanceRef.current));

    sceneManagerRef.current?.setSurfInput({ moveX, moveY, balanceAdjust, balanceStabilize });
  }, []);

  // Mount WebGL scene once in isolated container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;
    const initSettings = initialSettingsRef.current;

    const manager = new SurfSceneManager(
      mount,
      BEACH_SPOTS[0].environment,
      SURFBOARDS[0],
      SURFER_PROFILES[0],
      initSettings.graphics,
      (nextHud) => {
        hudPhaseRef.current = nextHud.phase;
        hudRef.current = nextHud;
        setHud(nextHud);
      },
      (lost) => setContextLost(lost),
      (finishedKey) => {
        if (!finishedKey) return;
        setSeenCutsceneKeys((prev) => {
          if (prev.has(finishedKey)) return prev;
          const next = new Set(prev);
          next.add(finishedKey);
          return next;
        });
      }
    );
    sceneManagerRef.current = manager;

    return () => {
      manager.dispose();
      sceneManagerRef.current = null;
      oceanAudio.dispose();
    };
  }, []);

  // Unlock & start Web Audio seamlessly on first user gesture when audio is enabled
  useEffect(() => {
    if (!settings.audioEnabled) return;
    const unlock = () => {
      oceanAudio.unlockOnGesture(settings.audioEnabled, settings.audioVolume);
    };
    window.addEventListener('pointerdown', unlock, { passive: true, capture: true });
    window.addEventListener('keydown', unlock, { passive: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [settings.audioEnabled, settings.audioVolume]);

  // Android / Capacitor & mobile WebView lifecycle: suspend audio and pause gameplay when backgrounded
  useEffect(() => {
    const handleBackground = () => {
      heldKeysRef.current.clear();
      heldManeuverKeysRef.current.clear();
      touchJoyRef.current = { x: 0, y: 0 };
      touchBalanceRef.current = 0;
      sceneManagerRef.current?.setJoystickActive(false);
      sceneManagerRef.current?.setSurfInput({
        moveX: 0,
        moveY: 0,
        balanceAdjust: 0,
        balanceStabilize: false,
      });
      oceanAudio.suspendForBackground();
      if (screen === 'surfing' && !hudRef.current.replay.active) {
        setPaused(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBackground();
      } else {
        oceanAudio.resumeFromBackground();
      }
    };

    const handlePageShow = () => {
      oceanAudio.resumeFromBackground();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleBackground);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleBackground);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [screen]);

  const activeTournamentEvent = useMemo(() => {
    if (!career?.activeTournament) return null;
    return career.calendar.find((e) => e.id === career.activeTournament?.eventId) ?? null;
  }, [career]);

  const activeSceneBeach = useMemo(() => {
    if (isCareerHeatActive && activeTournamentEvent) {
      return BEACH_SPOTS.find((b) => b.id === activeTournamentEvent.beachId) ?? selectedBeach;
    }
    return selectedBeach;
  }, [isCareerHeatActive, activeTournamentEvent, selectedBeach]);

  const activeSceneSurfer = useMemo(() => {
    if ((isCareerHeatActive || screen === 'career') && career) {
      return careerCustomizationToSurferProfile(career.surfer);
    }
    return selectedSurfer;
  }, [isCareerHeatActive, screen, career, selectedSurfer]);

  const activeSceneBoard = useMemo(() => {
    if ((isCareerHeatActive || screen === 'career') && career) {
      return SURFBOARDS.find((b) => b.id === career.equippedBoardId) ?? selectedBoard;
    }
    return selectedBoard;
  }, [isCareerHeatActive, screen, career, selectedBoard]);

  const activeSceneWeatherMode: WeatherMode =
    isCareerHeatActive && activeTournamentEvent
      ? activeTournamentEvent.weather
      : settings.weatherMode;

  const activeHeatCutsceneInfo = useMemo(() => {
    if (!isCareerHeatActive || !career?.activeTournament) return null;
    return buildHeatCutsceneInfo(career);
  }, [isCareerHeatActive, career]);

  const activeHeatNpcSpecs = useMemo(() => {
    if (!isCareerHeatActive || !career?.activeTournament) return null;
    return buildCareerHeatNpcSpecs(career);
  }, [isCareerHeatActive, career]);

  const activeCutsceneRequest = useMemo(() => {
    if (screen !== 'surfing' || !isCareerHeatActive || !activeHeatCutsceneInfo) return null;
    if (seenCutsceneKeys.has(activeHeatCutsceneInfo.heatKey)) return null;
    return {
      key: activeHeatCutsceneInfo.heatKey,
      seed: activeHeatCutsceneInfo.seed,
    };
  }, [screen, isCareerHeatActive, activeHeatCutsceneInfo, seenCutsceneKeys]);

  const completeCareerHeat = useCallback((finalElapsed?: number) => {
    if (heatFinalizedRef.current) return;
    const curCareer = careerRef.current;
    if (!curCareer?.activeTournament) return;
    heatFinalizedRef.current = true;

    const latestHud = hudRef.current;
    const elapsed = finalElapsed ?? heatElapsedRef.current;
    const playerWaves = buildHeatCompetitorWavesFromTelemetry(
      latestHud.completedWaves,
      latestHud.currentWavePoints,
      latestHud.currentWaveBarrelTime,
      latestHud.currentWaveManeuvers,
      latestHud.currentWaveBestManeuver,
      latestHud.waveNumber,
      elapsed
    );

    const maxSequenceChain = Math.max(
      latestHud.maxSequenceChain ?? 0,
      latestHud.sequenceChain ?? 0,
      ...latestHud.completedWaves.map((w) => w.maxSequenceChain ?? 0)
    );
    const maxBarrelDuration = Math.max(
      latestHud.currentWaveBarrelTime ?? 0,
      ...latestHud.completedWaves.map((w) => w.barrelTime ?? 0)
    );
    const excellentWavesCount = playerWaves.filter((w) => w.score >= 8.0).length;

    const updated = finalizePlayerHeat(curCareer, playerWaves, {
      maxSequenceChain,
      maxBarrelDuration,
      excellentWavesCount,
    });
    setCareer(updated);
    setIsCareerHeatActive(false);
    setPaused(false);
    oceanAudio.playSoftClick(520);
    setScreen('career');
  }, []);

  // Competition Heat Countdown Timer (paused cleanly during cutscenes, pauses, and replays)
  useEffect(() => {
    if (
      screen !== 'surfing' ||
      !isCareerHeatActive ||
      paused ||
      hud.replay.active ||
      hud.cutsceneActive
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setHeatElapsedSec((prev) => {
        const next = prev + 0.5;
        const curCareer = careerRef.current;
        const totalDur = curCareer ? TIER_MAP[curCareer.tier].heatDurationSeconds : 90;
        if (next >= totalDur && !heatFinalizedRef.current) {
          queueMicrotask(() => completeCareerHeat(totalDur));
        }
        return next;
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [screen, isCareerHeatActive, paused, hud.replay.active, hud.cutsceneActive, completeCareerHeat]);

  const liveCareerHeatHud = useMemo(() => {
    if (
      screen !== 'surfing' ||
      !isCareerHeatActive ||
      !career?.activeTournament ||
      hud.replay.active ||
      hud.cutsceneActive
    ) {
      return null;
    }
    const totalDur = TIER_MAP[career.tier].heatDurationSeconds;
    const playerWaves = buildHeatCompetitorWavesFromTelemetry(
      hud.completedWaves,
      hud.currentWavePoints,
      hud.currentWaveBarrelTime,
      hud.currentWaveManeuvers,
      hud.currentWaveBestManeuver,
      hud.waveNumber,
      heatElapsedSec
    );
    return computeLiveHeatHUD(career, playerWaves, heatElapsedSec, totalDur);
  }, [screen, isCareerHeatActive, career, hud, heatElapsedSec]);

  // Push React UI selections to the running 3D simulation without remounting
  useEffect(() => {
    sceneManagerRef.current?.updateState({
      screen,
      beachEnv: activeSceneBeach.environment,
      board: activeSceneBoard,
      surfer: activeSceneSurfer,
      cameraMotion: settings.cameraMotion,
      cameraBlurEnabled: settings.cameraBlurEnabled,
      cameraShakeEnabled: settings.cameraShakeEnabled,
      cameraImpactIntensity: settings.cameraImpactIntensity,
      cameraMode,
      oceanDetailHigh: settings.graphics.waterQuality !== 'low',
      graphics: settings.graphics,
      paused,
      beachAtmosphere: settings.beachAtmosphere,
      beachTheme: settings.beachTheme,
      marineLifeEnabled: settings.marineLifeEnabled,
      weatherMode: activeSceneWeatherMode,
      startInWater: isCareerHeatActive && screen === 'surfing',
      careerOpponents: isCareerHeatActive && screen === 'surfing' ? activeHeatNpcSpecs : null,
      cutsceneRequest: activeCutsceneRequest,
    });
  }, [
    screen,
    activeSceneBeach,
    activeSceneBoard,
    activeSceneSurfer,
    settings.cameraMotion,
    settings.cameraBlurEnabled,
    settings.cameraShakeEnabled,
    settings.cameraImpactIntensity,
    cameraMode,
    settings.graphics,
    paused,
    settings.beachAtmosphere,
    settings.beachTheme,
    settings.marineLifeEnabled,
    activeSceneWeatherMode,
    isCareerHeatActive,
    activeHeatNpcSpecs,
    activeCutsceneRequest,
  ]);

  // Handle resize when aspect ratio framing changes
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      sceneManagerRef.current?.handleResize();
    });
    return () => cancelAnimationFrame(id);
  }, [settings.aspectMode, settings.aspectLock16x9]);

  // Global keyboard & blur handlers for menus and responsive surfing/replay controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isCapturingKey) return;

      const targetTag = (e.target as HTMLElement | null)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'SELECT' || targetTag === 'TEXTAREA') {
        return;
      }

      if (screen === 'surfing') {
        if (hud.replay.active) {
          if (e.key === 'Escape' || e.code === 'KeyR') {
            e.preventDefault();
            oceanAudio.playSoftClick(380);
            sceneManagerRef.current?.exitReplay();
          } else if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            oceanAudio.playSoftClick(460);
            sceneManagerRef.current?.toggleReplayPlay();
          } else if (e.code === 'KeyT' && !e.repeat) {
            oceanAudio.playSoftClick(480);
            sceneManagerRef.current?.cycleReplayAngle();
          } else if (e.code === 'KeyH' && !e.repeat) {
            oceanAudio.playSoftClick(440);
            sceneManagerRef.current?.resetCameraLook();
          }
          return;
        }

        if (hud.cutsceneActive) {
          if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
            e.preventDefault();
            oceanAudio.playSoftClick(420);
            sceneManagerRef.current?.skipCutscene();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            oceanAudio.playSoftClick(420);
            sceneManagerRef.current?.skipCutscene();
          }
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          setPaused((prev) => !prev);
          return;
        }
        if (paused) return;

        const kb = settings.keyBindings;

        if (!e.repeat) {
          if (e.code === 'KeyR' && hud.replay.available) {
            oceanAudio.playSoftClick(500);
            sceneManagerRef.current?.enterReplay();
            return;
          } else if (e.code === 'KeyT') {
            oceanAudio.playSoftClick(480);
            setCameraMode((prev) => (prev === 'thirdPerson' ? 'firstPerson' : 'thirdPerson'));
            return;
          } else if (e.code === 'KeyH') {
            oceanAudio.playSoftClick(440);
            sceneManagerRef.current?.resetCameraLook();
            return;
          } else if (!heldManeuverKeysRef.current.has(e.code)) {
            // Definitive 5 Dedicated Maneuver Keys (single fire per press, never repeated on hold)
            if (e.code === kb.air) {
              heldManeuverKeysRef.current.add(e.code);
              sceneManagerRef.current?.setSurfInput({ requestedManeuver: 'air' });
              return;
            } else if (e.code === kb.bottomTurn) {
              heldManeuverKeysRef.current.add(e.code);
              sceneManagerRef.current?.setSurfInput({ requestedManeuver: 'bottomTurn' });
              return;
            } else if (e.code === kb.cutback) {
              heldManeuverKeysRef.current.add(e.code);
              sceneManagerRef.current?.setSurfInput({ requestedManeuver: 'cutback' });
              return;
            } else if (e.code === kb.floater) {
              heldManeuverKeysRef.current.add(e.code);
              sceneManagerRef.current?.setSurfInput({ requestedManeuver: 'floater' });
              return;
            } else if (e.code === kb.duckDive) {
              heldManeuverKeysRef.current.add(e.code);
              oceanAudio.playSoftClick(340);
              sceneManagerRef.current?.setSurfInput({ requestedDuckDive: true });
              return;
            }
          }
        }

        if (e.code === 'Space') {
          e.preventDefault();
        }

        heldKeysRef.current.add(e.code);
        syncCombinedInput();
        return;
      }

      if (e.key === 'Escape' && screen !== 'home') {
        if (screen === 'career' && (career?.activeTournament || career?.pendingSeasonSummary)) {
          return;
        }
        oceanAudio.playSoftClick(360);
        if (screen === 'careerCreate') {
          setScreen(career ? 'career' : 'home');
        } else {
          setScreen(screen === 'lineup' ? 'beaches' : 'home');
        }
      } else if ((e.key === 'Enter' || e.key === ' ') && (screen === 'home' || screen === 'beaches')) {
        if (targetTag === 'BUTTON') return;
        e.preventDefault();
        oceanAudio.playSoftClick(460);
        setScreen(screen === 'home' ? 'beaches' : 'surfing');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldManeuverKeysRef.current.delete(e.code);
      if (heldKeysRef.current.delete(e.code)) {
        syncCombinedInput();
      }
    };

    const onWindowBlur = () => {
      heldKeysRef.current.clear();
      heldManeuverKeysRef.current.clear();
      touchJoyRef.current = { x: 0, y: 0 };
      touchBalanceRef.current = 0;
      sceneManagerRef.current?.setJoystickActive(false);
      sceneManagerRef.current?.setSurfInput({
        moveX: 0,
        moveY: 0,
        balanceAdjust: 0,
        balanceStabilize: false,
      });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [
    screen,
    paused,
    hud.replay.active,
    hud.replay.available,
    hud.cutsceneActive,
    syncCombinedInput,
    career,
    settings.keyBindings,
    isCapturingKey,
  ]);

  // Career Mode Handlers
  const handleOpenCareer = useCallback(() => {
    oceanAudio.playSoftClick(460);
    setPaused(false);
    setScreen(career ? 'career' : 'careerCreate');
  }, [career]);

  const handleCreateCareer = useCallback(
    (surferCustom: CareerSurferCustomization, startingBoardId: string) => {
      oceanAudio.playSoftClick(520);
      const created = createNewCareer(surferCustom, startingBoardId);
      setCareer(created);
      setScreen('career');
    },
    []
  );

  const handleStartEvent = useCallback((eventId: string) => {
    setCareer((prev) => {
      if (!prev) return prev;
      oceanAudio.playSoftClick(480);
      return startChampionshipTournament(prev, eventId);
    });
  }, []);

  const handleLaunchHeat = useCallback(() => {
    oceanAudio.playSoftClick(540);
    heatFinalizedRef.current = false;
    setHeatElapsedSec(0);
    setIsCareerHeatActive(true);
    setPaused(false);
    setScreen('surfing');
  }, []);

  const handleRestartCareerHeat = useCallback(() => {
    oceanAudio.playSoftClick(480);
    heatFinalizedRef.current = false;
    setHeatElapsedSec(0);
    setPaused(false);
    sceneManagerRef.current?.restartCareerHeatInWater();
  }, []);

  const handleSkipCutscene = useCallback(() => {
    oceanAudio.playSoftClick(440);
    sceneManagerRef.current?.skipCutscene();
  }, []);

  const handleAbandonCareerHeat = useCallback(() => {
    oceanAudio.playSoftClick(360);
    setIsCareerHeatActive(false);
    setPaused(false);
    setScreen('career');
  }, []);

  const handleAdvanceRound = useCallback(() => {
    setCareer((prev) => {
      if (!prev) return prev;
      oceanAudio.playSoftClick(480);
      return advanceTournamentToNextRound(prev);
    });
  }, []);

  const handleCloseFinishedEvent = useCallback(() => {
    setCareer((prev) => {
      if (!prev) return prev;
      oceanAudio.playSoftClick(440);
      return dismissFinishedTournament(prev);
    });
  }, []);

  const handleAdvanceSeason = useCallback(() => {
    setCareer((prev) => {
      if (!prev) return prev;
      oceanAudio.playSoftClick(520);
      return advanceToNextSeason(prev);
    });
  }, []);

  const handleAcceptSponsor = useCallback((brandId: string) => {
    setCareer((prev) => {
      if (!prev) return prev;
      oceanAudio.playSoftClick(500);
      return acceptSponsorInvite(prev, brandId);
    });
  }, []);

  const handleDeclineSponsor = useCallback((brandId: string) => {
    setCareer((prev) => {
      if (!prev) return prev;
      oceanAudio.playSoftClick(360);
      return declineSponsorInvite(prev, brandId);
    });
  }, []);

  const handleBuyBoard = useCallback((boardId: string) => {
    setCareer((prev) => {
      if (!prev) return prev;
      oceanAudio.playSoftClick(520);
      return buyCareerBoard(prev, boardId);
    });
  }, []);

  const handleEquipBoard = useCallback((boardId: string) => {
    setCareer((prev) => {
      if (!prev) return prev;
      oceanAudio.playSoftClick(440);
      return equipCareerBoard(prev, boardId);
    });
  }, []);

  const handleUpdateAppearance = useCallback((patch: Partial<CareerSurferCustomization>) => {
    setCareer((prev) => {
      if (!prev) return prev;
      oceanAudio.playSoftClick(420);
      return updateCareerCustomization(prev, patch);
    });
  }, []);

  const handleDismissRivalryNotification = useCallback((notificationId: string) => {
    setCareer((prev) => {
      if (!prev) return prev;
      oceanAudio.playSoftClick(440);
      return dismissRivalryNotification(prev, notificationId);
    });
  }, []);

  const handleNavigate = useCallback((next: MenuScreen) => {
    oceanAudio.playSoftClick(next === 'home' ? 360 : 460);
    setPaused(false);
    setScreen(next);
  }, []);

  const handleSelectBeach = useCallback((beach: BeachSpot) => {
    oceanAudio.playSoftClick(420);
    setSelectedBeach(beach);
  }, []);

  const handleSelectSurfer = useCallback((surfer: SurferProfile) => {
    oceanAudio.playSoftClick(420);
    setSelectedSurfer(surfer);
  }, []);

  const handleSelectBoard = useCallback((board: SurfboardSpec) => {
    oceanAudio.playSoftClick(440);
    setSelectedBoard(board);
  }, []);

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveGameSettings(next);
      if (patch.audioEnabled !== undefined || patch.audioVolume !== undefined) {
        oceanAudio.setEnabled(next.audioEnabled, next.audioVolume);
        if (patch.audioEnabled) {
          oceanAudio.playSoftClick(480);
        }
      }
      return next;
    });
  }, []);

  const handleImportBundle = useCallback((bundle: CrossDeviceBundle) => {
    applyCrossDeviceBundle(bundle);
    setSettings(bundle.settings);
    oceanAudio.setEnabled(bundle.settings.audioEnabled, bundle.settings.audioVolume);
    if (bundle.career) {
      setCareer(bundle.career);
    }
    const foundBeach = BEACH_SPOTS.find((b) => b.id === bundle.selections.beachId);
    if (foundBeach) setSelectedBeach(foundBeach);
    const foundSurfer = SURFER_PROFILES.find((s) => s.id === bundle.selections.surferId);
    if (foundSurfer) setSelectedSurfer(foundSurfer);
    const foundBoard = SURFBOARDS.find((b) => b.id === bundle.selections.boardId);
    if (foundBoard) setSelectedBoard(foundBoard);
    oceanAudio.playSoftClick(520);
  }, []);

  const handleJoystickChange = useCallback(
    (x: number, y: number) => {
      touchJoyRef.current = { x, y };
      syncCombinedInput();
    },
    [syncCombinedInput]
  );

  const handleJoystickActiveChange = useCallback((active: boolean) => {
    sceneManagerRef.current?.setJoystickActive(active);
  }, []);

  const handleBalanceChange = useCallback(
    (val: number) => {
      touchBalanceRef.current = val;
      syncCombinedInput();
    },
    [syncCombinedInput]
  );

  const handleTriggerManeuver = useCallback((type: ManeuverType) => {
    oceanAudio.playSoftClick(520);
    sceneManagerRef.current?.setSurfInput({ requestedManeuver: type });
  }, []);

  const handleTriggerDuckDive = useCallback(() => {
    oceanAudio.playSoftClick(340);
    sceneManagerRef.current?.setSurfInput({ requestedDuckDive: true });
  }, []);

  const handleCycleWeather = useCallback(() => {
    const order: WeatherMode[] = ['dynamic', 'sunny', 'overcast', 'rainy'];
    oceanAudio.playSoftClick(450);
    setSettings((prev) => {
      const idx = order.indexOf(prev.weatherMode);
      const nextMode = order[(idx + 1) % order.length];
      const next = { ...prev, weatherMode: nextMode };
      saveGameSettings(next);
      return next;
    });
  }, []);

  const handleRestartSurf = useCallback(() => {
    setPaused(false);
    sceneManagerRef.current?.restartSurfSession();
  }, []);

  const handleToggleCamera = useCallback(() => {
    oceanAudio.playSoftClick(480);
    setCameraMode((prev) => (prev === 'thirdPerson' ? 'firstPerson' : 'thirdPerson'));
  }, []);

  const handleResetCamera = useCallback(() => {
    oceanAudio.playSoftClick(440);
    sceneManagerRef.current?.resetCameraLook();
  }, []);

  const handleEnterReplay = useCallback(() => {
    oceanAudio.playSoftClick(500);
    setPaused(false);
    sceneManagerRef.current?.enterReplay();
  }, []);

  const handleExitReplay = useCallback(() => {
    oceanAudio.playSoftClick(380);
    sceneManagerRef.current?.exitReplay();
  }, []);

  const handleToggleReplayPlay = useCallback(() => {
    oceanAudio.playSoftClick(460);
    sceneManagerRef.current?.toggleReplayPlay();
  }, []);

  const handleSeekReplay = useCallback((timeSeconds: number) => {
    sceneManagerRef.current?.seekReplay(timeSeconds);
  }, []);

  const handleRestartReplay = useCallback(() => {
    oceanAudio.playSoftClick(460);
    sceneManagerRef.current?.restartReplay();
  }, []);

  const handleSetReplaySpeed = useCallback((speed: 0.25 | 0.5 | 1) => {
    oceanAudio.playSoftClick(440);
    sceneManagerRef.current?.setReplaySpeed(speed);
  }, []);

  const handleSetReplayAngle = useCallback((angle: ReplayCameraAngle) => {
    oceanAudio.playSoftClick(480);
    sceneManagerRef.current?.setReplayAngle(angle);
  }, []);

  const handleToggleAudio = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, audioEnabled: !prev.audioEnabled };
      saveGameSettings(next);
      oceanAudio.setEnabled(next.audioEnabled, next.audioVolume);
      if (next.audioEnabled) {
        oceanAudio.playSoftClick(480);
      }
      return next;
    });
  }, []);

  const handleTogglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const handleFinishCareerHeatEarly = useCallback(() => {
    completeCareerHeat();
  }, [completeCareerHeat]);

  const handleExitToBeaches = useCallback(() => {
    setPaused(false);
    setIsCareerHeatActive(false);
    setScreen('beaches');
  }, []);

  const handleExitToHome = useCallback(() => {
    setPaused(false);
    setIsCareerHeatActive(false);
    setScreen('home');
  }, []);

  const viewportFrameClass = getViewportFrameClass(settings.aspectMode);

  return (
    <main className="relative flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-[#071726]">
      <div className={viewportFrameClass}>
        {/* Isolated 3D WebGL Viewport */}
        <div
          ref={canvasMountRef}
          className="absolute inset-0 h-full w-full"
          aria-label="FLOW 3D Tropical Ocean Environment"
        />

        {/* Subtle legibility gradient on lower-left only for home wordmark */}
        {screen === 'home' && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 14% 84%, rgba(7, 23, 38, 0.48) 0%, rgba(7, 23, 38, 0.16) 36%, rgba(7, 23, 38, 0) 64%)',
            }}
          />
        )}

        {/* WebGL Context Lost Fallback */}
        {contextLost && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#071726]/90 text-center">
            <div>
              <p className="font-display text-lg font-semibold text-white">
                Restoring 3D Ocean Surface
              </p>
              <p className="mt-1 text-sm text-white/70">
                Graphics context interrupted. Reinitializing renderer...
              </p>
            </div>
          </div>
        )}

        {/* UI Layer: GameplayHUD + HeatCutsceneOverlay vs Career Screens vs Preserved MenuOverlay */}
        {screen === 'surfing' ? (
          <>
            <GameplayHUD
              hud={hud}
              beachName={activeSceneBeach.name}
              audioEnabled={settings.audioEnabled}
              keyBindings={settings.keyBindings}
              onToggleAudio={handleToggleAudio}
              onToggleCamera={handleToggleCamera}
              onResetCamera={handleResetCamera}
              onJoystickChange={handleJoystickChange}
              onJoystickActiveChange={handleJoystickActiveChange}
              onBalanceChange={handleBalanceChange}
              onTriggerManeuver={handleTriggerManeuver}
              onTriggerDuckDive={handleTriggerDuckDive}
              onCycleWeather={handleCycleWeather}
              onTogglePause={handleTogglePause}
              onRestart={handleRestartSurf}
              onEnterReplay={handleEnterReplay}
              onExitReplay={handleExitReplay}
              onToggleReplayPlay={handleToggleReplayPlay}
              onSeekReplay={handleSeekReplay}
              onRestartReplay={handleRestartReplay}
              onSetReplaySpeed={handleSetReplaySpeed}
              onSetReplayAngle={handleSetReplayAngle}
              onExitToBeaches={handleExitToBeaches}
              onExitToHome={handleExitToHome}
              careerHeatHud={liveCareerHeatHud}
              onRestartCareerHeat={
                isCareerHeatActive ? handleRestartCareerHeat : undefined
              }
              onFinishCareerHeatEarly={
                isCareerHeatActive ? handleFinishCareerHeatEarly : undefined
              }
              onAbandonCareerHeat={
                isCareerHeatActive ? handleAbandonCareerHeat : undefined
              }
            />
            {isCareerHeatActive && hud.cutsceneActive && activeHeatCutsceneInfo && (
              <HeatCutsceneOverlay
                hud={hud}
                info={activeHeatCutsceneInfo}
                onSkip={handleSkipCutscene}
              />
            )}
          </>
        ) : screen === 'careerCreate' ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-2 sm:p-3.5 lg:p-6">
            <CareerCreateScreen
              surfers={SURFER_PROFILES}
              boards={SURFBOARDS}
              hasExistingCareer={Boolean(career)}
              onCancel={() => {
                oceanAudio.playSoftClick(360);
                setScreen(career ? 'career' : 'home');
              }}
              onCreateCareer={handleCreateCareer}
            />
          </div>
        ) : screen === 'career' && career ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-2 sm:p-3.5 lg:p-6">
            <CareerHubScreen
              career={career}
              boards={SURFBOARDS}
              onBackHome={() => handleNavigate('home')}
              onStartNewCareerFlow={() => {
                oceanAudio.playSoftClick(420);
                setScreen('careerCreate');
              }}
              onStartEvent={handleStartEvent}
              onLaunchHeat={handleLaunchHeat}
              onAdvanceRound={handleAdvanceRound}
              onCloseFinishedEvent={handleCloseFinishedEvent}
              onCancelPreHeat={handleCloseFinishedEvent}
              onAdvanceSeason={handleAdvanceSeason}
              onAcceptSponsor={handleAcceptSponsor}
              onDeclineSponsor={handleDeclineSponsor}
              onBuyBoard={handleBuyBoard}
              onEquipBoard={handleEquipBoard}
              onUpdateAppearance={handleUpdateAppearance}
              onDismissRivalryNotification={handleDismissRivalryNotification}
            />
          </div>
        ) : (
          <MenuOverlay
            screen={screen}
            onNavigate={handleNavigate}
            beaches={BEACH_SPOTS}
            selectedBeach={selectedBeach}
            onSelectBeach={handleSelectBeach}
            surfers={SURFER_PROFILES}
            selectedSurfer={selectedSurfer}
            onSelectSurfer={handleSelectSurfer}
            boards={SURFBOARDS}
            selectedBoard={selectedBoard}
            onSelectBoard={handleSelectBoard}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onOpenCareer={handleOpenCareer}
            career={career}
            onImportBundle={handleImportBundle}
            onCapturingKeyChange={setIsCapturingKey}
          />
        )}

        {/* Horizontal orientation prompt when entering in portrait */}
        <LandscapePromptModal screen={screen} />

        {/* Discreet offline indicator when network is unavailable */}
        <OfflineIndicator />
      </div>
    </main>
  );
}

function getViewportFrameClass(mode: AspectMode): string {
  switch (mode) {
    case '16:9':
      return 'relative aspect-video max-h-full w-full max-w-[177.78vh] overflow-hidden shadow-2xl';
    case '16:10':
      return 'relative aspect-[16/10] max-h-full w-full max-w-[160vh] overflow-hidden shadow-2xl';
    case '21:9':
      return 'relative aspect-[21/9] max-h-full w-full max-w-[233.33vh] overflow-hidden shadow-2xl';
    default:
      return 'relative h-full w-full overflow-hidden';
  }
}
