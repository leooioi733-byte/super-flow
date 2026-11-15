import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Cloud,
  CloudRain,
  Eye,
  EyeOff,
  Film,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LiveCareerHeatHUD } from '../types/career';
import {
  ManeuverKeyBindings,
  ManeuverType,
  ReplayCameraAngle,
  SurfHUDState,
} from '../types/game';
import { formatKeyCodeLabel } from '../utils/pcSettings';

interface GameplayHUDProps {
  hud: SurfHUDState;
  beachName: string;
  audioEnabled: boolean;
  keyBindings: ManeuverKeyBindings;
  onToggleAudio: () => void;
  onToggleCamera: () => void;
  onResetCamera: () => void;
  onJoystickChange: (x: number, y: number) => void;
  onJoystickActiveChange: (active: boolean) => void;
  onBalanceChange: (val: number) => void;
  onTriggerManeuver: (type: ManeuverType) => void;
  onTriggerDuckDive: () => void;
  onCycleWeather: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onEnterReplay: () => void;
  onExitReplay: () => void;
  onToggleReplayPlay: () => void;
  onSeekReplay: (timeSeconds: number) => void;
  onRestartReplay: () => void;
  onSetReplaySpeed: (speed: 0.25 | 0.5 | 1) => void;
  onSetReplayAngle: (angle: ReplayCameraAngle) => void;
  onExitToBeaches: () => void;
  onExitToHome: () => void;
  careerHeatHud?: LiveCareerHeatHUD | null;
  onRestartCareerHeat?: () => void;
  onFinishCareerHeatEarly?: () => void;
  onAbandonCareerHeat?: () => void;
}

const REPLAY_ANGLES: { id: ReplayCameraAngle; label: string }[] = [
  { id: 'follow', label: 'Follow' },
  { id: 'beach', label: 'Beach' },
  { id: 'waterline', label: 'Waterline' },
  { id: 'helicopter', label: 'Drone' },
  { id: 'firstPerson', label: 'POV' },
];

const REPLAY_SPEEDS: Array<0.25 | 0.5 | 1> = [0.25, 0.5, 1];

function BottomTurnIllustration() {
  return (
    <svg viewBox="0 0 36 36" fill="none" className="h-7 w-7" aria-hidden="true">
      {/* Curved wave face trough */}
      <path
        d="M5 26 C12 27, 22 25, 30 16"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Deep bottom carve sweeping upward */}
      <path
        d="M8 12 C8 22, 16 25, 27 11"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* Arrow head + tiny surfboard */}
      <path
        d="M22.5 11.5 L27.3 10.6 L26.5 15.3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="14.5" cy="21.5" rx="3.4" ry="1.2" transform="rotate(-22 14.5 21.5)" fill="currentColor" />
    </svg>
  );
}

function CutbackIllustration() {
  return (
    <svg viewBox="0 0 36 36" fill="none" className="h-7 w-7" aria-hidden="true">
      {/* Wave shoulder line */}
      <path
        d="M6 25 Q18 23 30 25"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Sharp S-turn carving back into the pocket */}
      <path
        d="M9 22 C17 20, 27 18, 25 12 C23 7, 13 11, 13 16"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M10.2 13.5 L13.0 16.5 L16.2 13.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="24" cy="12" rx="3.2" ry="1.15" transform="rotate(62 24 12)" fill="currentColor" />
    </svg>
  );
}

function FloaterIllustration() {
  return (
    <svg viewBox="0 0 36 36" fill="none" className="h-7 w-7" aria-hidden="true">
      {/* Rolling wave crest arch */}
      <path
        d="M5 24 C10 14, 21 12, 30 22"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Gliding board riding smoothly over the lip */}
      <path
        d="M7 18 C13 10, 22 10, 28 16"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeDasharray="2.5 2.5"
      />
      <ellipse cx="18" cy="11.8" rx="4.6" ry="1.35" fill="currentColor" />
      <circle cx="13" cy="13.5" r="0.9" fill="currentColor" fillOpacity="0.7" />
      <circle cx="23" cy="13.5" r="0.9" fill="currentColor" fillOpacity="0.7" />
    </svg>
  );
}

function AirIllustration() {
  return (
    <svg viewBox="0 0 36 36" fill="none" className="h-7 w-7" aria-hidden="true">
      {/* Breaking wave lip below */}
      <path
        d="M5 26 C11 21, 17 19, 22 23 C25 25, 29 26, 31 26"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* Airborne trajectory arc */}
      <path
        d="M9 21 C12 10, 22 7, 28 16"
        stroke="currentColor"
        strokeWidth="2.0"
        strokeLinecap="round"
      />
      <path
        d="M24.2 15.8 L28.2 16.4 L28.6 12.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Angled surfboard mid-air */}
      <ellipse cx="18.5" cy="10.2" rx="4.4" ry="1.35" transform="rotate(-18 18.5 10.2)" fill="currentColor" />
    </svg>
  );
}

function DuckDiveIllustration() {
  return (
    <svg viewBox="0 0 36 36" fill="none" className="h-7 w-7" aria-hidden="true">
      {/* Breaking wave crest above */}
      <path
        d="M5 16 C11 10, 21 9, 28 15 C30 16.5, 31 18, 31 18"
        stroke="currentColor"
        strokeOpacity="0.48"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Dive-under path piercing beneath the wave */}
      <path
        d="M6 19 C11 27, 21 28, 28 19"
        stroke="currentColor"
        strokeWidth="2.0"
        strokeLinecap="round"
      />
      <path
        d="M24.2 19.3 L28.2 18.6 L28.4 22.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Submerged surfboard angled nose-down then up */}
      <ellipse cx="16.5" cy="24.2" rx="4.2" ry="1.25" transform="rotate(14 16.5 24.2)" fill="currentColor" />
    </svg>
  );
}

export const GameplayHUD: React.FC<GameplayHUDProps> = React.memo(({
  hud,
  beachName,
  audioEnabled,
  keyBindings,
  onToggleAudio,
  onToggleCamera,
  onResetCamera,
  onJoystickChange,
  onJoystickActiveChange,
  onBalanceChange,
  onTriggerManeuver,
  onTriggerDuckDive,
  onCycleWeather,
  onTogglePause,
  onRestart,
  onEnterReplay,
  onExitReplay,
  onToggleReplayPlay,
  onSeekReplay,
  onRestartReplay,
  onSetReplaySpeed,
  onSetReplayAngle,
  onExitToBeaches,
  onExitToHome,
  careerHeatHud,
  onRestartCareerHeat,
  onFinishCareerHeatEarly,
  onAbandonCareerHeat,
}) => {
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joyActive, setJoyActive] = useState(false);
  const [calloutVisible, setCalloutVisible] = useState(false);
  const [replayMenuHidden, setReplayMenuHidden] = useState(false);

  // Fade maneuver feedback smoothly after calloutId updates
  useEffect(() => {
    if (!hud.lastCallout) return;
    setCalloutVisible(true);
    const timer = window.setTimeout(() => setCalloutVisible(false), 2100);
    return () => window.clearTimeout(timer);
  }, [hud.calloutId, hud.lastCallout]);

  // Reset joystick & replay HUD visibility cleanly when replay closes or game pauses
  useEffect(() => {
    if (!hud.replay.active) {
      setReplayMenuHidden(false);
    }
    if (hud.isPaused || hud.replay.active) {
      if (joyPointerId.current !== null) {
        joyPointerId.current = null;
        setJoyActive(false);
        setKnobPos({ x: 0, y: 0 });
        onJoystickChange(0, 0);
        onJoystickActiveChange(false);
      }
    }
  }, [hud.isPaused, hud.replay.active, onJoystickChange, onJoystickActiveChange]);

  const updateJoystickFromPointer = (clientX: number, clientY: number) => {
    const el = joyBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    setKnobPos({ x: dx, y: dy });
    // Invert Y so dragging up on joystick = +1 (up the wave / walk forward / paddle out)
    onJoystickChange(dx / maxR, -dy / maxR);
  };

  const handleJoyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (joyPointerId.current !== null) return;
    joyPointerId.current = e.pointerId;
    setJoyActive(true);
    onJoystickActiveChange(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic pointer capture failures
    }
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const handleJoyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    e.preventDefault();
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const handleJoyPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    joyPointerId.current = null;
    setJoyActive(false);
    setKnobPos({ x: 0, y: 0 });
    onJoystickChange(0, 0);
    onJoystickActiveChange(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const isRiding =
    hud.phase === 'riding' ||
    hud.phase === 'barrel' ||
    hud.phase === 'maneuver' ||
    hud.phase === 'airborne';

  const balancePct = Math.max(0, Math.min(100, (hud.balance * 0.5 + 0.5) * 100));
  const balanceCritical = Math.abs(hud.balance) > 0.72;

  const qualityTextColor =
    hud.lastQuality === 'Perfect'
      ? 'text-[#38d9c8]'
      : hud.lastQuality === 'Good'
        ? 'text-white'
        : hud.lastQuality === 'Failed'
          ? 'text-[#f2a679]'
          : 'text-[#E7DCC8]';

  // --- PRE-HEAT CUTSCENE TAKES OVER HUD CLEANLY ---
  if (hud.cutsceneActive) {
    return null;
  }

  // --- REPLAY HUD MODE ---
  if (hud.replay.active) {
    const duration = Math.max(0.1, hud.replay.duration);
    const cur = Math.min(duration, Math.max(0, hud.replay.currentTime));

    return (
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
        {/* Partial slate-gray fallback when post-processing is disabled during maneuver slow-mo */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-[#10202e]/32 transition-opacity duration-200 ${
            !hud.postFxActive && hud.maneuverSlowMo > 0.08 ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Underwater tint if viewing underwater portion of wipeout replay */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
            hud.isUnderwater ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(12, 86, 112, 0.16) 0%, rgba(6, 48, 66, 0.52) 100%)',
          }}
        />

        {/* REPLAY TOP BAR */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="relative flex items-center justify-between gap-3"
        >
          {!replayMenuHidden ? (
            <>
              <div className="pointer-events-auto flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onExitReplay}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/15 bg-[#071726]/75 px-3 text-xs font-medium text-white transition-colors hover:border-white/30 hover:bg-[#071726]/90"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Surf</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 text-xs text-[#E7DCC8]/85">
                  <span className="font-medium tracking-wide text-white">15s Replay</span>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span className="font-mono-tabular">Wave {hud.waveNumber}</span>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span className="font-mono-tabular">{hud.speedKmh} km/h</span>
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                {hud.lastCallout && (
                  <span
                    className={`font-display text-xs font-semibold tracking-[0.08em] sm:text-sm ${qualityTextColor}`}
                    style={{ textShadow: '0 2px 12px rgba(7, 23, 38, 0.85)' }}
                  >
                    {hud.lastCallout}
                  </span>
                )}
              </div>

              <div className="pointer-events-auto flex items-center gap-2">
                {hud.cameraModified && (
                  <button
                    type="button"
                    onClick={onResetCamera}
                    aria-label="Center camera"
                    title="Centralizar Câmera (H)"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-[#071726]/70 text-white/85 transition-colors hover:border-white/30 hover:bg-[#071726]/90"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[#E7DCC8]" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleAudio}
                  aria-label={audioEnabled ? 'Mute ocean audio' : 'Enable ocean audio'}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-[#071726]/70 text-white/85 transition-colors hover:border-white/30 hover:bg-[#071726]/90"
                >
                  {audioEnabled ? (
                    <Volume2 className="h-4 w-4 text-[#2596A6]" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-white/65" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setReplayMenuHidden(true)}
                  aria-label="Hide replay menu"
                  title="Esconder menu do replay"
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/15 bg-[#071726]/70 px-2.5 text-xs font-medium text-white/85 transition-colors hover:border-white/30 hover:bg-[#071726]/90"
                >
                  <EyeOff className="h-3.5 w-3.5 text-[#E7DCC8]" />
                  <span className="hidden sm:inline">Hide Menu</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div aria-hidden="true" />
              <button
                type="button"
                onClick={() => setReplayMenuHidden(false)}
                aria-label="Show replay menu"
                title="Mostrar menu do replay"
                className="pointer-events-auto inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/15 bg-[#071726]/72 px-2.5 text-xs font-medium text-white/85 transition-colors hover:border-white/30 hover:bg-[#071726]/88 hover:text-white"
              >
                <Eye className="h-3.5 w-3.5 text-[#38d9c8]" />
                <span>Show Menu</span>
              </button>
            </>
          )}
        </div>

        {/* REPLAY BOTTOM UNIFIED CONTROL DOCK (zero viewport occlusion) */}
        {!replayMenuHidden && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto mx-auto w-[min(660px,95vw)] rounded-xl border border-white/15 bg-[#071726]/82 p-3 shadow-2xl"
        >
          {/* Camera Angles Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
            <span className="text-[11px] font-medium tracking-wide text-white/55">
              Camera Angle <span className="hidden md:inline text-white/35">(T)</span>
            </span>
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-white/5 p-1">
              {REPLAY_ANGLES.map((angle) => {
                const active = hud.replay.cameraAngle === angle.id;
                return (
                  <button
                    key={angle.id}
                    type="button"
                    onClick={() => onSetReplayAngle(angle.id)}
                    className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#2596A6] text-white'
                        : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {angle.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Playback Transport + 15s Timeline Scrubber */}
          <div className="mt-2.5 flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onRestartReplay}
              aria-label="Restart replay clip"
              title="Restart clip"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/85 transition-colors hover:bg-white/12 hover:text-white"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleReplayPlay}
              aria-label={hud.replay.playing ? 'Pause replay' : 'Play replay'}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2596A6] text-white transition-colors hover:bg-[#2eb0c2]"
            >
              {hud.replay.playing ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={duration}
              step={0.02}
              value={cur}
              aria-label="Replay timeline"
              onChange={(e) => onSeekReplay(parseFloat(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-[#2596A6]"
            />

            <span className="font-mono-tabular shrink-0 text-[11px] text-[#E7DCC8]/90">
              {cur.toFixed(1)}s / {duration.toFixed(1)}s
            </span>

            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/5 p-0.5">
              {REPLAY_SPEEDS.map((spd) => {
                const active = hud.replay.playbackSpeed === spd;
                return (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => onSetReplaySpeed(spd)}
                    className={`font-mono-tabular whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'text-white/65 hover:text-white'
                    }`}
                  >
                    {spd}×
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
      {/* Partial slate-gray fallback when post-processing is disabled during maneuver slow-mo */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-[#10202e]/32 transition-opacity duration-200 ${
          !hud.postFxActive && hud.maneuverSlowMo > 0.08 ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Brief non-blur underwater radial tint fallback during wipeout submersion */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
          hud.isUnderwater ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(12, 86, 112, 0.16) 0%, rgba(6, 48, 66, 0.52) 100%)',
        }}
      />

      {/* TOP BAR: Minimal Score, Combo, Callout, Pause */}
      <div className="relative flex items-start justify-between gap-4">
        {/* Top-Left: Score & Discreet Combo */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex items-center gap-2.5 sm:gap-3"
        >
          <button
            type="button"
            onClick={onTogglePause}
            aria-label="Pause surfing"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-[#071726]/65 text-white/85 transition-colors hover:border-white/30 hover:bg-[#071726]/85 hover:text-white"
          >
            <Pause className="h-4 w-4" />
          </button>

          <div className="flex items-baseline gap-2 rounded-lg border border-white/12 bg-[#071726]/55 px-3 py-1.5">
            <span className="font-mono-tabular text-base font-semibold tracking-tight text-white sm:text-lg">
              {hud.score.toLocaleString()}
            </span>
            {hud.combo > 1 && (
              <span className="font-mono-tabular text-xs font-semibold text-[#2596A6]">
                ×{hud.combo}
              </span>
            )}
          </div>
        </div>

        {/* Top-Center: Minimal Maneuver / Barrel Callout */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`transition-all duration-300 ${
              calloutVisible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
            }`}
          >
            <span
              className={`font-display text-sm font-semibold tracking-[0.08em] sm:text-base ${qualityTextColor}`}
              style={{ textShadow: '0 2px 12px rgba(7, 23, 38, 0.85)' }}
            >
              {hud.lastCallout}
            </span>
          </div>
          {hud.sequenceChain >= 2 && hud.sequenceTag && (
            <div
              className={`font-mono-tabular mt-0.5 text-[11px] font-medium tracking-[0.06em] transition-opacity duration-300 ${
                hud.sequenceTier >= 3
                  ? 'text-[#38d9c8]'
                  : hud.sequenceTier === 2
                    ? 'text-[#f4c97a]'
                    : 'text-[#E7DCC8]/85'
              } ${calloutVisible ? 'opacity-100' : 'opacity-65'}`}
              style={{ textShadow: '0 2px 10px rgba(7, 23, 38, 0.85)' }}
            >
              {hud.sequenceTag}
            </div>
          )}
          {hud.inBarrel && (
            <div className="font-mono-tabular mt-1 text-xs font-medium tracking-[0.14em] text-[#38d9c8]">
              BARREL · {hud.barrelTime.toFixed(1)}s
            </div>
          )}
        </div>

        {/* Top-Right: Weather, Speed, Replay, Recenter, 1P/3P & Audio */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex items-center gap-2"
        >
          <button
            type="button"
            onClick={onCycleWeather}
            aria-label={`Weather: ${hud.weather}. Click to change weather mode`}
            title={`Weather: ${hud.weatherMode === 'dynamic' ? `Auto (${hud.weather})` : hud.weather}`}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/15 bg-[#071726]/55 px-2.5 text-xs font-medium text-white/85 transition-colors hover:border-white/30 hover:bg-[#071726]/85"
          >
            {hud.weather === 'rainy' ? (
              <CloudRain className="h-3.5 w-3.5 text-[#5ec5db]" />
            ) : hud.weather === 'overcast' ? (
              <Cloud className="h-3.5 w-3.5 text-slate-300" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-[#f4c97a]" />
            )}
            <span className="hidden md:inline capitalize">
              {hud.weatherMode === 'dynamic' ? `Auto · ${hud.weather}` : hud.weather}
            </span>
          </button>

          <div
            className={`font-mono-tabular flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
              hud.phase === 'paddling' && hud.speedKmh >= 50
                ? 'border-[#38d9c8]/75 bg-[#0B3C5D]/80 text-[#38d9c8]'
                : 'border-white/12 bg-[#071726]/55 text-[#E7DCC8]/90'
            }`}
            title={
              hud.phase === 'paddling'
                ? 'Reach 50 km/h to catch the wave'
                : 'Current speed'
            }
          >
            <span>{hud.speedKmh}</span>
            {hud.phase === 'paddling' && (
              <span className="text-[10px] text-white/45">/ 50</span>
            )}
            <span className="text-white/50">km/h</span>
          </div>

          <button
            type="button"
            disabled={!hud.replay.available}
            onClick={onEnterReplay}
            aria-label="Watch 15 second wave replay"
            title="Watch 15s Replay (R)"
            className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-medium transition-colors ${
              hud.replay.available
                ? 'border-white/15 bg-[#071726]/55 text-white/90 hover:border-white/30 hover:bg-[#071726]/85'
                : 'border-white/10 bg-[#071726]/35 text-white/35 cursor-not-allowed'
            }`}
          >
            <Film className="h-3.5 w-3.5 text-[#38d9c8]" />
            <span className="hidden sm:inline">Replay</span>
          </button>

          {hud.cameraModified && (
            <button
              type="button"
              onClick={onResetCamera}
              aria-label="Center camera"
              title="Centralizar Câmera (H / Duplo clique)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-[#071726]/55 text-white/85 transition-colors hover:border-white/30 hover:bg-[#071726]/85"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#E7DCC8]" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCamera}
            aria-label={
              hud.cameraMode === 'firstPerson'
                ? 'Switch to third-person camera'
                : 'Switch to first-person camera'
            }
            title="Alternar Câmera 1P/3P (T) · Arraste para olhar"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold tracking-wider transition-colors ${
              hud.cameraMode === 'firstPerson'
                ? 'border-[#38d9c8]/75 bg-[#0B3C5D]/80 text-[#38d9c8]'
                : 'border-white/15 bg-[#071726]/55 text-white/85 hover:border-white/30 hover:bg-[#071726]/85'
            }`}
          >
            {hud.cameraMode === 'firstPerson' ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            <span className="font-mono-tabular">
              {hud.cameraMode === 'firstPerson' ? '1P' : '3P'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleAudio}
            aria-label={audioEnabled ? 'Mute ocean audio' : 'Enable ocean audio'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-[#071726]/55 text-white/85 transition-colors hover:border-white/30 hover:bg-[#071726]/85"
          >
            {audioEnabled ? (
              <Volume2 className="h-4 w-4 text-[#2596A6]" />
            ) : (
              <VolumeX className="h-4 w-4 text-white/65" />
            )}
          </button>
        </div>
      </div>

      {/* DISCREET CAREER HEAT SCOREBOARD STRIP */}
      {careerHeatHud && (
        <div className="pointer-events-none flex justify-center pt-1.5">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-white/15 bg-[#071726]/65 px-3 py-1.5 text-[11px] text-white/90 shadow-lg sm:gap-x-4 sm:text-xs">
            <span className="font-semibold tracking-wide text-[#38d9c8]">
              {careerHeatHud.roundLabel}
            </span>
            {careerHeatHud.isHeadToHeadDuel && (
              <>
                <span aria-hidden="true" className="text-white/25">|</span>
                <span className="font-semibold tracking-wide text-[#e68a5c]">
                  Duelo Head-to-Head
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-white/25">|</span>
            <span
              className={`font-mono-tabular font-bold ${
                careerHeatHud.timeRemainingSec <= 15 ? 'text-[#f2a679]' : 'text-white'
              }`}
            >
              {Math.floor(careerHeatHud.timeRemainingSec / 60)}:
              {String(careerHeatHud.timeRemainingSec % 60).padStart(2, '0')}
            </span>
            <span aria-hidden="true" className="text-white/25">|</span>
            <span className="font-mono-tabular">
              <span className="text-white/60">Você </span>
              <strong className="text-white">{careerHeatHud.playerTotal.toFixed(1)}</strong>
              {careerHeatHud.playerWaves.length > 0 && (
                <span className="ml-1 text-[10px] text-[#E7DCC8]/80">
                  ({careerHeatHud.playerWaves.map((w) => w.toFixed(1)).join(' + ')})
                </span>
              )}
            </span>
            <span aria-hidden="true" className="text-white/25">|</span>
            <span
              className={`font-mono-tabular font-semibold ${
                careerHeatHud.playerRank <= careerHeatHud.advancingCount
                  ? 'text-[#38d9c8]'
                  : 'text-[#f2a679]'
              }`}
            >
              {careerHeatHud.playerRank}º/{careerHeatHud.totalInHeat}
            </span>
            <span className="hidden text-white/60 sm:inline">
              · vs {careerHeatHud.topRivalName}{' '}
              <span className="font-mono-tabular text-white/85">
                {careerHeatHud.topRivalTotal.toFixed(1)}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* BOTTOM CORNERS: Left Virtual Joystick, Center Slim Balance Meter, Right Illustrated Maneuver Buttons */}
      <div className="flex items-end justify-between gap-4">
        {/* LEFT SIDE: Virtual Touch Joystick (pointer-isolated only on the stick circle) */}
        <div className="pointer-events-none flex flex-col items-start gap-1 p-1">
          <div
            ref={joyBaseRef}
            onPointerDown={(e) => {
              e.stopPropagation();
              handleJoyPointerDown(e);
            }}
            onPointerMove={handleJoyPointerMove}
            onPointerUp={handleJoyPointerUp}
            onPointerCancel={handleJoyPointerUp}
            onLostPointerCapture={handleJoyPointerUp}
            role="application"
            aria-label="Directional surfing joystick"
            className="pointer-events-auto relative flex h-24 w-24 touch-none select-none items-center justify-center rounded-full border border-white/22 bg-[#071726]/45 sm:h-28 sm:w-28"
          >
            {/* Subtle crosshairs */}
            <div className="pointer-events-none absolute inset-3.5 rounded-full border border-white/10" />
            <div
              className={`pointer-events-none h-10 w-10 rounded-full border border-white/50 bg-white/22 ${
                joyActive ? '' : 'transition-transform duration-100'
              }`}
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              }}
            />
          </div>
          <span className="pointer-events-none hidden pl-1 text-[10px] tracking-wide text-white/50 md:inline">
            {hud.phase === 'beachWalk'
              ? 'WASD / Espaço · Caminhar'
              : hud.phase === 'paddling'
                ? 'WASD / Espaço · Remar'
                : hud.phase === 'recovering'
                  ? 'WASD / Espaço · Nadar à prancha'
                  : 'WASD · Direção e Trim'}
          </span>
        </div>

        {/* BOTTOM-CENTER: Slim Balance Indicator & Touch Balance Nudge */}
        {isRiding && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto mb-1 flex flex-col items-center gap-1"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onBalanceChange(-1);
                }}
                onPointerUp={() => onBalanceChange(0)}
                onPointerCancel={() => onBalanceChange(0)}
                onPointerLeave={() => onBalanceChange(0)}
                aria-label="Lean balance left"
                className="flex h-7 w-7 touch-none items-center justify-center rounded-full border border-white/18 bg-[#071726]/60 text-[11px] font-medium text-white/80 active:bg-[#2596A6]/60"
              >
                L
              </button>

              <div className="relative h-2 w-24 overflow-hidden rounded-full border border-white/15 bg-[#071726]/70 sm:w-32">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/30" />
                <div
                  className={`absolute top-0 h-full w-3 -translate-x-1/2 rounded-full transition-colors ${
                    balanceCritical ? 'bg-[#e68a5c]' : 'bg-[#2596A6]'
                  }`}
                  style={{ left: `${balancePct}%` }}
                />
              </div>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onBalanceChange(1);
                }}
                onPointerUp={() => onBalanceChange(0)}
                onPointerCancel={() => onBalanceChange(0)}
                onPointerLeave={() => onBalanceChange(0)}
                aria-label="Lean balance right"
                className="flex h-7 w-7 touch-none items-center justify-center rounded-full border border-white/18 bg-[#071726]/60 text-[11px] font-medium text-white/80 active:bg-[#2596A6]/60"
              >
                R
              </button>
            </div>
            <span className="hidden text-[10px] tracking-wide text-white/45 md:inline">
              Q / E Equilíbrio · Shift Estabilizar
            </span>
          </div>
        )}

        {/* RIGHT SIDE: Tactile Illustrated Circular Maneuver Buttons (hints pass pointer events through to camera) */}
        <div className="pointer-events-none flex flex-col items-end gap-2">
          {hud.phase === 'beachWalk' && (
            <div className="pointer-events-none flex items-center gap-1.5 text-xs tracking-wide text-[#E7DCC8]/90 select-none">
              <Sparkles className="h-3.5 w-3.5 text-[#2596A6]" />
              <span>Walk with your board to the water</span>
            </div>
          )}
          {hud.phase === 'paddling' && (
            <div className="pointer-events-none flex items-center gap-1.5 text-xs tracking-wide text-[#E7DCC8]/90 select-none">
              <Sparkles className="h-3.5 w-3.5 text-[#2596A6]" />
              <span>
                {hud.speedKmh >= 50
                  ? '50 km/h reached · Drop in on the wave!'
                  : `Reach 50 km/h to surf · Duck Dive (${formatKeyCodeLabel(keyBindings.duckDive)})`}
              </span>
            </div>
          )}
          {hud.phase === 'recovering' && (
            <div className="pointer-events-none flex items-center gap-1.5 text-xs tracking-wide text-[#E7DCC8]/90 select-none">
              <Sparkles className="h-3.5 w-3.5 text-[#2596A6]" />
              <span>Swim back to your surfboard</span>
            </div>
          )}

          <div className="pointer-events-none grid grid-cols-3 gap-x-3 gap-y-2">
            <div aria-hidden="true" />
            <ManeuverButton
              label="Bottom"
              shortcut={formatKeyCodeLabel(keyBindings.bottomTurn)}
              ariaLabel={`Bottom Turn (${formatKeyCodeLabel(keyBindings.bottomTurn)})`}
              ready={hud.availability.bottomTurn}
              disabled={!isRiding}
              illustration={<BottomTurnIllustration />}
              onTrigger={() => onTriggerManeuver('bottomTurn')}
            />
            <ManeuverButton
              label="Cutback"
              shortcut={formatKeyCodeLabel(keyBindings.cutback)}
              ariaLabel={`Cutback (${formatKeyCodeLabel(keyBindings.cutback)})`}
              ready={hud.availability.cutback}
              disabled={!isRiding}
              illustration={<CutbackIllustration />}
              onTrigger={() => onTriggerManeuver('cutback')}
            />
            <ManeuverButton
              label="Duck Dive"
              shortcut={formatKeyCodeLabel(keyBindings.duckDive)}
              ariaLabel={`Duck Dive / Furar a Onda (${formatKeyCodeLabel(keyBindings.duckDive)})`}
              ready={hud.availability.duckDive}
              disabled={hud.phase !== 'paddling'}
              illustration={<DuckDiveIllustration />}
              onTrigger={onTriggerDuckDive}
            />
            <ManeuverButton
              label="Floater"
              shortcut={formatKeyCodeLabel(keyBindings.floater)}
              ariaLabel={`Floater (${formatKeyCodeLabel(keyBindings.floater)})`}
              ready={hud.availability.floater}
              disabled={!isRiding}
              illustration={<FloaterIllustration />}
              onTrigger={() => onTriggerManeuver('floater')}
            />
            <ManeuverButton
              label="Air"
              shortcut={formatKeyCodeLabel(keyBindings.air)}
              ariaLabel={`Aerial (${formatKeyCodeLabel(keyBindings.air)})`}
              ready={hud.availability.air}
              disabled={!isRiding}
              illustration={<AirIllustration />}
              onTrigger={() => onTriggerManeuver('air')}
            />
          </div>
        </div>
      </div>

      {/* PAUSE MODAL */}
      {hud.isPaused && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#071726]/75 p-4"
        >
          <div className="w-full max-w-xs rounded-xl border border-white/15 bg-[#071726]/95 p-5 text-center">
            <div className="text-xs font-medium tracking-[0.16em] text-[#2596A6]">
              {careerHeatHud ? `${careerHeatHud.eventName} · ${careerHeatHud.roundLabel}` : beachName}
            </div>
            <h2 className="font-display mt-1 text-2xl font-bold text-white">Paused</h2>
            <div className="font-mono-tabular mt-1 text-xs text-[#E7DCC8]/80">
              {careerHeatHud
                ? `Nota ${careerHeatHud.playerTotal.toFixed(1)} (${careerHeatHud.playerRank}º/${careerHeatHud.totalInHeat}) · Onda ${hud.waveNumber}`
                : `Score ${hud.score.toLocaleString()} · Wave ${hud.waveNumber}`}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={onTogglePause}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2596A6] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2eb0c2]"
              >
                <Play className="h-4 w-4" />
                <span>Resume</span>
              </button>
              {hud.replay.available && (
                <button
                  type="button"
                  onClick={onEnterReplay}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#38d9c8]/40 bg-[#0B3C5D]/70 px-4 py-2 text-sm font-medium text-[#38d9c8] transition-colors hover:bg-[#0B3C5D]"
                >
                  <Film className="h-4 w-4" />
                  <span>Watch 15s Replay</span>
                </button>
              )}
              {careerHeatHud ? (
                <>
                  {onRestartCareerHeat && (
                    <button
                      type="button"
                      onClick={onRestartCareerHeat}
                      className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
                    >
                      Reiniciar Bateria
                    </button>
                  )}
                  {onFinishCareerHeatEarly && (
                    <button
                      type="button"
                      onClick={onFinishCareerHeatEarly}
                      className="rounded-lg border border-[#38d9c8]/40 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                    >
                      Finalizar Bateria Agora
                    </button>
                  )}
                  {onAbandonCareerHeat && (
                    <button
                      type="button"
                      onClick={onAbandonCareerHeat}
                      className="rounded-lg px-4 py-1.5 text-xs font-medium text-white/65 transition-colors hover:text-white"
                    >
                      Voltar ao Painel da Carreira
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onRestart}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
                  >
                    Restart Session
                  </button>
                  <button
                    type="button"
                    onClick={onExitToBeaches}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
                  >
                    Change Beach
                  </button>
                  <button
                    type="button"
                    onClick={onExitToHome}
                    className="rounded-lg px-4 py-1.5 text-xs font-medium text-white/60 transition-colors hover:text-white"
                  >
                    Main Menu
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

interface ManeuverButtonProps {
  label: string;
  shortcut?: string;
  ariaLabel: string;
  ready: boolean;
  disabled: boolean;
  illustration: React.ReactNode;
  onTrigger: () => void;
}

const ManeuverButton: React.FC<ManeuverButtonProps> = ({
  label,
  shortcut,
  ariaLabel,
  ready,
  disabled,
  illustration,
  onTrigger,
}) => {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!disabled) onTrigger();
        }}
        className={`relative flex h-13 w-13 touch-none select-none items-center justify-center rounded-full border-2 shadow-lg transition-all duration-150 active:translate-y-0.5 active:scale-92 sm:h-15 sm:w-15 ${
          disabled
            ? 'pointer-events-none border-white/12 bg-[#071726]/38 text-white/30'
            : ready
              ? 'pointer-events-auto border-[#38d9c8]/85 bg-[#0B3C5D]/88 text-[#38d9c8] shadow-[0_6px_18px_rgba(37,150,166,0.35)] hover:bg-[#135378]'
              : 'pointer-events-auto border-white/25 bg-[#071726]/65 text-white/82 hover:border-white/45 hover:bg-[#0B3C5D]/75'
        }`}
      >
        {/* Inner tactile bevel ring */}
        <span className="pointer-events-none absolute inset-1 rounded-full border border-white/12" />
        {illustration}
        {shortcut && (
          <span
            aria-hidden="true"
            className={`font-mono-tabular pointer-events-none absolute -top-1.5 -right-1.5 hidden h-5 min-w-[20px] items-center justify-center rounded-md border px-1 text-[10px] font-bold shadow md:inline-flex ${
              disabled
                ? 'border-white/15 bg-[#071726]/80 text-white/35'
                : ready
                  ? 'border-[#38d9c8] bg-[#0B3C5D] text-[#38d9c8]'
                  : 'border-white/25 bg-[#071726]/90 text-[#E7DCC8]'
            }`}
          >
            {shortcut}
          </span>
        )}
      </button>
      <span
        className={`text-[10px] font-medium tracking-wide ${
          disabled ? 'text-white/30' : ready ? 'text-[#E7DCC8]' : 'text-white/65'
        }`}
        style={{ textShadow: '0 1px 6px rgba(7, 23, 38, 0.85)' }}
      >
        {label}
      </span>
    </div>
  );
};
