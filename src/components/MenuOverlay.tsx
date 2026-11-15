import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Compass,
  Copy,
  Download,
  Gamepad2,
  Monitor,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Upload,
  User,
  Volume2,
  VolumeX,
  Waves,
} from 'lucide-react';
import { DEFAULT_KEY_BINDINGS } from '../data/surfData';
import { CareerSaveState } from '../types/career';
import {
  AspectMode,
  BeachSpot,
  GameSettings,
  GraphicsPreset,
  GraphicsSettings,
  ManeuverActionId,
  MenuScreen,
  RenderDistanceTier,
  ShadowQuality,
  SurfboardSpec,
  SurferProfile,
  WaterQualityTier,
} from '../types/game';
import {
  applyGraphicsPreset,
  CrossDeviceBundle,
  detectDefaultGraphicsSettings,
  encodeCrossDeviceSyncCode,
  exportCrossDeviceBundleJson,
  formatKeyCodeLabel,
  isReservedControlKey,
  parseCrossDeviceImport,
} from '../utils/pcSettings';
import { PWAInstallButton } from './PWAInstallButton';

interface MenuOverlayProps {
  screen: MenuScreen;
  onNavigate: (screen: MenuScreen) => void;
  beaches: BeachSpot[];
  selectedBeach: BeachSpot;
  onSelectBeach: (beach: BeachSpot) => void;
  surfers: SurferProfile[];
  selectedSurfer: SurferProfile;
  onSelectSurfer: (surfer: SurferProfile) => void;
  boards: SurfboardSpec[];
  selectedBoard: SurfboardSpec;
  onSelectBoard: (board: SurfboardSpec) => void;
  settings: GameSettings;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onOpenCareer: () => void;
  career: CareerSaveState | null;
  onImportBundle: (bundle: CrossDeviceBundle) => void;
  onCapturingKeyChange?: (capturing: boolean) => void;
}

type SettingsTab = 'geral' | 'graficos' | 'controles';

const MANEUVER_LABELS: {
  id: ManeuverActionId;
  name: string;
  desc: string;
}[] = [
  {
    id: 'air',
    name: 'Aéreo (Aerial)',
    desc: 'Lança no lip com velocidade suficiente (≥ 31 km/h)',
  },
  {
    id: 'bottomTurn',
    name: 'Bottom Turn',
    desc: 'Cavada forte na base da onda para ganhar linha e velocidade',
  },
  {
    id: 'cutback',
    name: 'Cutback',
    desc: 'Retorno rápido ao pocket quando estiver no ombro da onda',
  },
  {
    id: 'floater',
    name: 'Floater',
    desc: 'Desliza sobre a crista ou espuma no topo da onda',
  },
  {
    id: 'duckDive',
    name: 'Duck Dive (Furar Onda)',
    desc: 'Mergulha sob a onda que se aproxima durante a remada',
  },
];

function SurfboardIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.5c3.2 3.4 4.5 7.8 4.2 12.6-.2 2.6-1.4 4.8-4.2 6.4-2.8-1.6-4-3.8-4.2-6.4C7.5 10.3 8.8 5.9 12 2.5Z" />
      <path d="M12 3v18" />
    </svg>
  );
}

export const MenuOverlay: React.FC<MenuOverlayProps> = ({
  screen,
  onNavigate,
  beaches,
  selectedBeach,
  onSelectBeach,
  surfers,
  selectedSurfer,
  onSelectSurfer,
  boards,
  selectedBoard,
  onSelectBoard,
  settings,
  onUpdateSettings,
  onOpenCareer,
  career,
  onImportBundle,
  onCapturingKeyChange,
}) => {
  const isHome = screen === 'home';

  const [settingsTab, setSettingsTab] = useState<SettingsTab>('geral');
  const [capturingAction, setCapturingAction] = useState<ManeuverActionId | null>(null);
  const [keyStatusMsg, setKeyStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [syncInput, setSyncInput] = useState('');
  const [syncStatus, setSyncStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onCapturingKeyChange?.(capturingAction !== null);
  }, [capturingAction, onCapturingKeyChange]);

  useEffect(() => {
    if (screen !== 'settings') {
      setCapturingAction(null);
    }
  }, [screen]);

  useEffect(() => {
    if (!capturingAction) return;

    const handleCaptureKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        setCapturingAction(null);
        setKeyStatusMsg(null);
        return;
      }

      if (isReservedControlKey(e.code)) {
        setKeyStatusMsg({
          text: `A tecla ${formatKeyCodeLabel(e.code)} é reservada para movimentação/sistema.`,
          error: true,
        });
        return;
      }

      const nextBindings = { ...settings.keyBindings };
      const previousKeyForSlot = nextBindings[capturingAction];

      // If another maneuver uses this key, swap cleanly so all 5 stay unique
      for (const item of MANEUVER_LABELS) {
        if (item.id !== capturingAction && nextBindings[item.id] === e.code) {
          nextBindings[item.id] = previousKeyForSlot;
        }
      }
      nextBindings[capturingAction] = e.code;

      onUpdateSettings({ keyBindings: nextBindings });
      const label = MANEUVER_LABELS.find((m) => m.id === capturingAction)?.name ?? capturingAction;
      setKeyStatusMsg({
        text: `${label} definida para [${formatKeyCodeLabel(e.code)}].`,
        error: false,
      });
      setCapturingAction(null);
    };

    window.addEventListener('keydown', handleCaptureKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleCaptureKey, { capture: true });
    };
  }, [capturingAction, settings.keyBindings, onUpdateSettings]);

  const updateGraphicsField = (patch: Partial<GraphicsSettings>) => {
    const nextGraphics: GraphicsSettings = {
      ...settings.graphics,
      ...patch,
      preset: patch.preset ?? 'custom',
    };
    onUpdateSettings({
      graphics: nextGraphics,
      oceanDetail: nextGraphics.waterQuality === 'low' ? 'Balanced' : 'High',
    });
  };

  const handleSelectPreset = (preset: Exclude<GraphicsPreset, 'custom'>) => {
    const nextGraphics = applyGraphicsPreset(preset);
    onUpdateSettings({
      graphics: nextGraphics,
      oceanDetail: nextGraphics.waterQuality === 'low' ? 'Balanced' : 'High',
    });
  };

  const handleAutoDetectGraphics = () => {
    const detected = detectDefaultGraphicsSettings();
    onUpdateSettings({
      graphics: detected,
      oceanDetail: detected.waterQuality === 'low' ? 'Balanced' : 'High',
    });
  };

  const handleCopySyncCode = async () => {
    const code = encodeCrossDeviceSyncCode(career, settings, {
      beachId: selectedBeach.id,
      surferId: selectedSurfer.id,
      boardId: selectedBoard.id,
    });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        setSyncStatus({
          text: 'Código de sincronização copiado! Cole-o no outro dispositivo (PC ou Android).',
        });
      } else {
        setSyncInput(code);
        setSyncStatus({
          text: 'Código gerado no campo abaixo — copie manualmente para transferir.',
        });
      }
    } catch {
      setSyncInput(code);
      setSyncStatus({
        text: 'Código gerado no campo abaixo — copie manualmente para transferir.',
      });
    }
  };

  const handleDownloadSaveFile = () => {
    const json = exportCrossDeviceBundleJson(career, settings, {
      beachId: selectedBeach.id,
      surferId: selectedSurfer.id,
      boardId: selectedBoard.id,
    });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-backup-${new Date().toISOString().slice(0, 10)}.flowsave.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setSyncStatus({ text: 'Backup .flowsave.json exportado com carreira e configurações.' });
  };

  const handleApplySyncText = () => {
    const parsed = parseCrossDeviceImport(syncInput);
    if (!parsed) {
      setSyncStatus({
        text: 'Código ou JSON inválido. Verifique o código FLOW1:... completo e tente novamente.',
        error: true,
      });
      return;
    }
    onImportBundle(parsed);
    setSyncInput('');
    setSyncStatus({
      text: parsed.career
        ? `Sincronizado! Carreira (${parsed.career.surfer.name}) e configurações aplicadas.`
        : 'Configurações importadas com sucesso (save de carreira atual preservado).',
    });
  };

  const handleUploadSaveFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = parseCrossDeviceImport(content);
      if (!parsed) {
        setSyncStatus({
          text: 'Arquivo inválido. Selecione um backup .flowsave.json gerado pelo FLOW.',
          error: true,
        });
        return;
      }
      onImportBundle(parsed);
      setSyncStatus({
        text: parsed.career
          ? `Backup restaurado! Carreira de ${parsed.career.surfer.name} e configurações carregadas.`
          : 'Configurações do backup aplicadas (carreira existente mantida).',
      });
    } catch {
      setSyncStatus({ text: 'Não foi possível ler o arquivo selecionado.', error: true });
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-3 p-3 sm:gap-4 sm:p-6 md:p-8 lg:p-12 [@media(max-height:540px)]:!gap-2.5 [@media(max-height:540px)]:!p-3">
      {/* Top Bar: Subtle Audio Control & Contextual Back Navigation */}
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-3">
        <div className="pointer-events-auto shrink-0">
          {!isHome ? (
            <button
              type="button"
              onClick={() => onNavigate(screen === 'lineup' ? 'beaches' : 'home')}
              className="group inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#071726]/75 px-3.5 py-1.5 text-xs font-medium tracking-wide text-white/90 transition-all duration-200 hover:border-white/30 hover:bg-[#071726]/90 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2596A6] sm:px-4 sm:py-2 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4 text-[#E7DCC8] transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span>{screen === 'lineup' ? 'Beaches' : 'Main Menu'}</span>
            </button>
          ) : (
            <div className="h-8 sm:h-9" />
          )}
        </div>

        {/* Discreet Sound Toggle + Active Rider Summary on Subscreens */}
        <div className="pointer-events-auto flex min-w-0 items-center gap-2.5 sm:gap-4">
          {!isHome && (
            <div className="hidden min-w-0 sm:flex items-center gap-2 text-xs tracking-wide text-white/80 drop-shadow-[0_1px_6px_rgba(7,23,38,0.65)]">
              <span className="truncate">{selectedBeach.name}</span>
              <span aria-hidden="true" className="shrink-0 text-white/40">
                ·
              </span>
              <span className="truncate">{selectedSurfer.name}</span>
              <span aria-hidden="true" className="shrink-0 text-white/40">
                ·
              </span>
              <span className="truncate">{selectedBoard.name}</span>
            </div>
          )}

          <PWAInstallButton variant="topbar" />

          <button
            type="button"
            onClick={() => onUpdateSettings({ audioEnabled: !settings.audioEnabled })}
            aria-label={settings.audioEnabled ? 'Mute ocean audio' : 'Enable ocean audio'}
            title={settings.audioEnabled ? 'Ocean Audio: On' : 'Ocean Audio: Off'}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-[#071726]/65 text-white/85 transition-all duration-200 hover:border-white/30 hover:bg-[#071726]/85 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2596A6] sm:h-10 sm:w-10"
          >
            {settings.audioEnabled ? (
              <Volume2 className="h-4 w-4 text-[#2596A6]" />
            ) : (
              <VolumeX className="h-4 w-4 text-white/70" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area: Leaves Central Ocean Unobstructed */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
        {/* HOME SCREEN: Left-Aligned Minimalist Editorial Lockup (Preserved Original Design) */}
        {screen === 'home' && (
          <div className="pointer-events-auto mb-1 max-h-full max-w-xl overflow-y-auto transition-opacity duration-300 sm:mb-2">
            {/* Game Logo */}
            <h1
              className="font-display text-4xl font-extrabold tracking-[0.2em] text-white sm:text-6xl lg:text-7xl"
              style={{
                textShadow: '0 4px 28px rgba(7, 23, 38, 0.45)',
              }}
            >
              FLOW
            </h1>

            {/* Primary Mode Selection */}
            <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-7">
              <button
                type="button"
                onClick={() => onNavigate('beaches')}
                className="group inline-flex min-w-[186px] items-center justify-between gap-4 rounded-lg border border-white/30 bg-[#071726]/68 px-5 py-2.5 text-xs font-semibold tracking-[0.18em] text-white transition-all duration-200 hover:border-[#2596A6]/90 hover:bg-[#0B3C5D]/88 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2596A6] active:scale-[0.99] sm:min-w-[210px] sm:gap-5 sm:px-6 sm:py-3.5 sm:text-sm"
              >
                <span>FREE SURF</span>
                <ChevronRight className="h-4 w-4 text-[#E7DCC8] transition-transform duration-200 group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                onClick={onOpenCareer}
                className="group inline-flex min-w-[186px] items-center justify-between gap-4 rounded-lg border border-[#38d9c8]/45 bg-[#0B3C5D]/78 px-5 py-2.5 text-xs font-semibold tracking-[0.18em] text-white transition-all duration-200 hover:border-[#38d9c8] hover:bg-[#2596A6]/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2596A6] active:scale-[0.99] sm:min-w-[218px] sm:gap-5 sm:px-6 sm:py-3.5 sm:text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-[#38d9c8] transition-colors group-hover:text-white" />
                  <span>CAREER MODE</span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#E7DCC8] transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </div>

            {/* Secondary Discreet Menu */}
            <nav
              aria-label="Secondary Menu"
              className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 sm:mt-6 sm:gap-x-6 sm:gap-y-2.5"
            >
              <button
                type="button"
                onClick={() => onNavigate('beaches')}
                className="group inline-flex items-center gap-1.5 py-1 text-xs font-medium text-white/82 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2596A6] sm:gap-2 sm:text-sm"
              >
                <Waves className="h-3.5 w-3.5 text-white/65 transition-colors group-hover:text-[#2596A6]" />
                <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-white/50">
                  Beaches
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('surfers')}
                className="group inline-flex items-center gap-1.5 py-1 text-xs font-medium text-white/82 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2596A6] sm:gap-2 sm:text-sm"
              >
                <User className="h-3.5 w-3.5 text-white/65 transition-colors group-hover:text-[#2596A6]" />
                <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-white/50">
                  Surfers
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('boards')}
                className="group inline-flex items-center gap-1.5 py-1 text-xs font-medium text-white/82 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2596A6] sm:gap-2 sm:text-sm"
              >
                <SurfboardIcon className="h-3.5 w-3.5 text-white/65 transition-colors group-hover:text-[#2596A6]" />
                <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-white/50">
                  Boards
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="group inline-flex items-center gap-1.5 py-1 text-xs font-medium text-white/82 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2596A6] sm:gap-2 sm:text-sm"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-white/65 transition-colors group-hover:text-[#2596A6]" />
                <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-white/50">
                  Settings
                </span>
              </button>
            </nav>
          </div>
        )}

        {/* BEACH SELECTION EXPERIENCE */}
        {screen === 'beaches' && (
          <div className="pointer-events-auto mx-auto max-h-full w-full max-w-5xl overflow-y-auto rounded-xl border border-white/15 bg-[#071726]/76 p-4 sm:p-5 md:p-6 [@media(max-height:540px)]:!p-3.5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-5 [@media(max-height:540px)]:!gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-[#2596A6]">
                  <Compass className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{selectedBeach.region}</span>
                  <span aria-hidden="true" className="text-white/30">
                    ·
                  </span>
                  <span className="truncate text-[#E7DCC8]/85">{selectedBeach.breakType}</span>
                </div>

                <h2 className="font-display mt-1 text-xl font-bold tracking-tight text-white sm:mt-1.5 sm:text-3xl [@media(max-height:540px)]:!mt-0.5 [@media(max-height:540px)]:!text-xl">
                  {selectedBeach.name}
                </h2>

                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/75 sm:mt-1.5 sm:text-sm [@media(max-height:540px)]:!mt-0.5 [@media(max-height:540px)]:!text-xs">
                  {selectedBeach.description}
                </p>

                <div className="font-mono-tabular mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#E7DCC8]/90 sm:mt-3 sm:gap-x-4 [@media(max-height:540px)]:!mt-1.5">
                  <span>Swell {selectedBeach.swellHeight}</span>
                  <span aria-hidden="true" className="text-white/25">
                    /
                  </span>
                  <span>Period {selectedBeach.swellPeriod}</span>
                  <span aria-hidden="true" className="text-white/25">
                    /
                  </span>
                  <span>{selectedBeach.wind}</span>
                  <span aria-hidden="true" className="text-white/25">
                    /
                  </span>
                  <span>Water {selectedBeach.waterTemp}</span>
                </div>
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate('surfing')}
                  className="group inline-flex items-center gap-2.5 rounded-lg border border-[#2596A6]/60 bg-[#0B3C5D]/85 px-5 py-2.5 text-xs font-semibold tracking-[0.14em] text-white transition-all duration-200 hover:border-[#2596A6] hover:bg-[#2596A6]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2596A6] sm:gap-3 sm:px-6 sm:py-3 sm:text-sm [@media(max-height:540px)]:!px-4 [@media(max-height:540px)]:!py-2"
                >
                  <span>PADDLE OUT</span>
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>

            {/* Restrained Horizontal Break Selector */}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 sm:mt-4 sm:grid-cols-4 sm:pt-4 [@media(max-height:540px)]:!mt-2.5 [@media(max-height:540px)]:!pt-2.5">
              {beaches.map((beach) => {
                const active = beach.id === selectedBeach.id;
                return (
                  <button
                    key={beach.id}
                    type="button"
                    onClick={() => onSelectBeach(beach)}
                    className={`rounded-lg px-3.5 py-2 text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2596A6] sm:py-2.5 [@media(max-height:540px)]:!px-3 [@media(max-height:540px)]:!py-1.5 ${
                      active
                        ? 'border border-white/25 bg-white/12 text-white'
                        : 'border border-transparent bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <div className="truncate text-sm font-semibold">{beach.name}</div>
                    <div className="font-mono-tabular mt-0.5 truncate text-xs text-white/60">
                      {beach.swellHeight} · {beach.swellPeriod}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* IN-WATER LINEUP PREVIEW */}
        {screen === 'lineup' && (
          <div className="pointer-events-auto mx-auto flex max-h-full w-full max-w-4xl items-center justify-between overflow-y-auto rounded-xl border border-white/15 bg-[#071726]/72 px-5 py-3.5">
            <div>
              <div className="font-display text-base font-semibold text-white">
                {selectedBeach.name} — In the Lineup
              </div>
              <div className="font-mono-tabular mt-0.5 text-xs text-[#E7DCC8]/85">
                {selectedBeach.swellHeight} · {selectedBeach.swellPeriod} · {selectedBoard.name}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('beaches')}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium tracking-wider text-white transition-colors hover:bg-white/20"
            >
              Change Break
            </button>
          </div>
        )}

        {/* SURFERS SELECTION */}
        {screen === 'surfers' && (
          <div className="pointer-events-auto mx-auto max-h-full w-full max-w-4xl overflow-y-auto rounded-xl border border-white/15 bg-[#071726]/76 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <div className="text-xs font-medium tracking-[0.14em] text-[#2596A6]">
                  Surfer Profile
                </div>
                <h2 className="font-display mt-1 text-xl font-bold text-white sm:text-2xl">
                  {selectedSurfer.name}
                </h2>
                <p className="mt-0.5 text-xs text-white/75 sm:mt-1 sm:text-sm">
                  {selectedSurfer.origin} · {selectedSurfer.stance} Stance · {selectedSurfer.style}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('beaches')}
                className="shrink-0 rounded-lg border border-white/25 bg-[#0B3C5D]/80 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-white transition-colors hover:bg-[#2596A6]/85 sm:px-5 sm:py-2.5"
              >
                SELECT BEACH
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/10 pt-3 sm:mt-5 sm:grid-cols-3 sm:gap-2.5 sm:pt-4">
              {surfers.map((surfer) => {
                const active = surfer.id === selectedSurfer.id;
                return (
                  <button
                    key={surfer.id}
                    type="button"
                    onClick={() => onSelectSurfer(surfer)}
                    className={`rounded-lg px-3.5 py-2.5 text-left transition-all duration-200 sm:px-4 sm:py-3 ${
                      active
                        ? 'border border-white/25 bg-white/12 text-white'
                        : 'border border-transparent bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{surfer.name}</span>
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-white/30"
                        style={{ backgroundColor: surfer.accentColor }}
                      />
                    </div>
                    <div className="mt-0.5 text-xs text-white/60 sm:mt-1">
                      {surfer.origin} · {surfer.stance}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* BOARDS SELECTION (Live 3D Shoreline Showcase) */}
        {screen === 'boards' && (
          <div className="pointer-events-auto mx-auto max-h-full w-full max-w-5xl overflow-y-auto rounded-xl border border-white/15 bg-[#071726]/76 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div>
                <div className="text-xs font-medium tracking-[0.14em] text-[#2596A6]">
                  {selectedBoard.category}
                </div>
                <h2 className="font-display mt-1 text-2xl font-bold text-white">
                  {selectedBoard.name}
                </h2>
                <div className="font-mono-tabular mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-[#E7DCC8]/90">
                  <span>{selectedBoard.dimensions}</span>
                  <span aria-hidden="true" className="text-white/25">
                    /
                  </span>
                  <span>{selectedBoard.volume}</span>
                  <span aria-hidden="true" className="text-white/25">
                    /
                  </span>
                  <span>{selectedBoard.finSetup} Fins</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('beaches')}
                className="shrink-0 rounded-lg border border-white/25 bg-[#0B3C5D]/80 px-5 py-2.5 text-xs font-semibold tracking-[0.14em] text-white transition-colors hover:bg-[#2596A6]/85"
              >
                TAKE TO WATER
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 sm:grid-cols-4">
              {boards.map((board) => {
                const active = board.id === selectedBoard.id;
                return (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => onSelectBoard(board)}
                    className={`rounded-lg px-3.5 py-2.5 text-left transition-all duration-200 ${
                      active
                        ? 'border border-white/25 bg-white/12 text-white'
                        : 'border border-transparent bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <div className="text-sm font-semibold">{board.name}</div>
                    <div className="mt-0.5 text-xs text-white/60">
                      {board.category} · {board.volume}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SETTINGS — Multiplatform 3-Tab Panel (Geral & Tela | Gráficos | Controles & Dados) */}
        {screen === 'settings' && (
          <div className="pointer-events-auto mx-auto flex max-h-full w-full max-w-4xl flex-col overflow-y-auto rounded-2xl border border-white/15 bg-[#071726]/86 shadow-2xl lg:overflow-hidden [@media(max-height:600px)]:!overflow-y-auto">
            {/* Header + Horizontal Tabs */}
            <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:shrink-0 [@media(max-height:600px)]:!shrink">
              <div>
                <h2 className="font-display text-lg font-bold text-white sm:text-xl">
                  Configurações &amp; Multiplataforma
                </h2>
                <p className="mt-0.5 text-xs text-white/65">
                  Tela, qualidade gráfica, mapeamento de teclado (PC) e sincronização de dados
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] p-1">
                <button
                  type="button"
                  onClick={() => setSettingsTab('geral')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    settingsTab === 'geral'
                      ? 'bg-[#2596A6] text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  <span>Geral &amp; Tela</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('graficos')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    settingsTab === 'graficos'
                      ? 'bg-[#2596A6] text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Gráficos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('controles')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    settingsTab === 'controles'
                      ? 'bg-[#2596A6] text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Gamepad2 className="h-3.5 w-3.5" />
                  <span>Controles &amp; Dados</span>
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="min-h-0 flex-1 p-4 sm:p-6 lg:overflow-y-auto [@media(max-height:600px)]:!overflow-visible">
              {/* TAB 1: GERAL & TELA */}
              {settingsTab === 'geral' && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {/* Screen & Audio Column */}
                  <div className="space-y-4 rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                    <h3 className="font-display text-sm font-semibold text-[#38d9c8]">
                      Tela, Câmera &amp; Áudio
                    </h3>

                    {/* Aspect Ratio Mode */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-sm text-white/90">Proporção de Tela</span>
                        <span className="font-mono-tabular text-[11px] text-white/55">
                          16:9 / 16:10 / Ultrawide
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
                        {(
                          [
                            { id: 'auto', label: 'Auto' },
                            { id: '16:9', label: '16:9' },
                            { id: '16:10', label: '16:10' },
                            { id: '21:9', label: '21:9' },
                          ] as { id: AspectMode; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              onUpdateSettings({
                                aspectMode: opt.id,
                                aspectLock16x9: opt.id === '16:9',
                              })
                            }
                            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                              settings.aspectMode === opt.id
                                ? 'bg-[#2596A6] text-white'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Camera Motion */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/90">Cinematic Camera Drift</span>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ cameraMotion: !settings.cameraMotion })}
                        className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          settings.cameraMotion
                            ? 'border-[#2596A6]/70 bg-[#2596A6]/25 text-white'
                            : 'border-white/15 bg-white/[0.04] text-white/65'
                        }`}
                      >
                        {settings.cameraMotion ? 'Ativo' : 'Estático'}
                      </button>
                    </div>

                    {/* Camera Blur */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/90">Water Impact &amp; Motion Blur</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ cameraBlurEnabled: !settings.cameraBlurEnabled })
                        }
                        className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          settings.cameraBlurEnabled
                            ? 'border-[#2596A6]/70 bg-[#2596A6]/25 text-white'
                            : 'border-white/15 bg-white/[0.04] text-white/65'
                        }`}
                      >
                        {settings.cameraBlurEnabled ? 'Ativo' : 'Desligado'}
                      </button>
                    </div>

                    {/* Camera Shake */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/90">Impact Camera Shake</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ cameraShakeEnabled: !settings.cameraShakeEnabled })
                        }
                        className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          settings.cameraShakeEnabled
                            ? 'border-[#2596A6]/70 bg-[#2596A6]/25 text-white'
                            : 'border-white/15 bg-white/[0.04] text-white/65'
                        }`}
                      >
                        {settings.cameraShakeEnabled ? 'Ativo' : 'Desligado'}
                      </button>
                    </div>

                    {/* Impact FX */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/75">Impact FX Intensity</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={settings.cameraImpactIntensity}
                        onChange={(e) =>
                          onUpdateSettings({ cameraImpactIntensity: parseFloat(e.target.value) })
                        }
                        aria-label="Water impact visual intensity"
                        className="h-1.5 flex-1 cursor-pointer accent-[#2596A6]"
                      />
                    </div>

                    {/* Audio */}
                    <div className="space-y-2 border-t border-white/10 pt-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-white/90">Ambient Ocean Audio</span>
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ audioEnabled: !settings.audioEnabled })}
                          className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                            settings.audioEnabled
                              ? 'border-[#2596A6]/70 bg-[#2596A6]/25 text-white'
                              : 'border-white/15 bg-white/[0.04] text-white/65'
                          }`}
                        >
                          {settings.audioEnabled ? 'Ligado' : 'Mudo'}
                        </button>
                      </div>
                      {settings.audioEnabled && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-white/60">Volume</span>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={settings.audioVolume}
                            onChange={(e) =>
                              onUpdateSettings({ audioVolume: parseFloat(e.target.value) })
                            }
                            aria-label="Ocean audio volume"
                            className="h-1.5 flex-1 cursor-pointer accent-[#2596A6]"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Beach & Environment Column */}
                  <div className="space-y-4 rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                    <h3 className="font-display text-sm font-semibold text-[#38d9c8]">
                      Ambiente &amp; Clima da Praia
                    </h3>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/90">Beach Atmosphere</span>
                      <div className="flex rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
                        {(['Lively', 'Chill'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => onUpdateSettings({ beachAtmosphere: mode })}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                              settings.beachAtmosphere === mode
                                ? 'bg-[#2596A6] text-white'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/90">Beach Style</span>
                      <div className="flex rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
                        {(['Tropical', 'Sunset', 'Classic'] as const).map((theme) => (
                          <button
                            key={theme}
                            type="button"
                            onClick={() => onUpdateSettings({ beachTheme: theme })}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                              settings.beachTheme === theme
                                ? 'bg-[#2596A6] text-white'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            {theme}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/90">Weather</span>
                      <div className="flex rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
                        {(
                          [
                            { id: 'dynamic', label: 'Auto' },
                            { id: 'sunny', label: 'Sunny' },
                            { id: 'overcast', label: 'Overcast' },
                            { id: 'rainy', label: 'Rainy' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onUpdateSettings({ weatherMode: opt.id })}
                            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                              settings.weatherMode === opt.id
                                ? 'bg-[#2596A6] text-white'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/90">Reef Corals &amp; Marine Life</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ marineLifeEnabled: !settings.marineLifeEnabled })
                        }
                        className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          settings.marineLifeEnabled
                            ? 'border-[#2596A6]/70 bg-[#2596A6]/25 text-white'
                            : 'border-white/15 bg-white/[0.04] text-white/65'
                        }`}
                      >
                        {settings.marineLifeEnabled ? 'Ativo' : 'Mínimo'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
                      <span className="text-sm text-white/90">Instalar no Dispositivo (PWA)</span>
                      <PWAInstallButton variant="settings" />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: GRÁFICOS & DESEMPENHO */}
              {settingsTab === 'graficos' && (
                <div className="space-y-5">
                  {/* Quality Presets */}
                  <div className="rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-[#38d9c8]">
                          Perfil de Qualidade Gráfica
                        </h3>
                        <p className="mt-0.5 text-xs text-white/60">
                          Ajuste automático ou escolha entre Baixa, Média, Alta e Ultra
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoDetectGraphics}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#38d9c8]/40 bg-[#0B3C5D]/70 px-3 py-1.5 text-xs font-medium text-[#38d9c8] transition-colors hover:bg-[#2596A6] hover:text-white"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Auto-Detectar Hardware</span>
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {(
                        [
                          { id: 'low', label: 'Baixa', hint: 'Máximo FPS' },
                          { id: 'medium', label: 'Média', hint: 'Equilibrado' },
                          { id: 'high', label: 'Alta', hint: 'Padrão PC' },
                          { id: 'ultra', label: 'Ultra', hint: 'Nitidez 125%' },
                        ] as const
                      ).map((p) => {
                        const active = settings.graphics.preset === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectPreset(p.id)}
                            className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                              active
                                ? 'border-[#38d9c8] bg-[#2596A6]/30 text-white'
                                : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white'
                            }`}
                          >
                            <div className="text-xs font-semibold">{p.label}</div>
                            <div className="text-[11px] text-white/55">{p.hint}</div>
                          </button>
                        );
                      })}
                      <div
                        className={`rounded-lg border px-3 py-2.5 text-left ${
                          settings.graphics.preset === 'custom'
                            ? 'border-[#f4c97a]/75 bg-[#f4c97a]/15 text-white'
                            : 'border-white/10 bg-white/[0.02] text-white/40'
                        }`}
                      >
                        <div className="text-xs font-semibold">Personalizada</div>
                        <div className="text-[11px] opacity-75">Ajuste fino</div>
                      </div>
                    </div>
                  </div>

                  {/* Individual Graphics Controls */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Resolution Scale */}
                    <div className="rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-white/90">Resolução de Renderização</span>
                        <span className="font-mono-tabular text-xs text-[#38d9c8]">
                          {Math.round(settings.graphics.resolutionScale * 100)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
                        {[
                          { val: 0.65, label: '65%' },
                          { val: 0.8, label: '80%' },
                          { val: 1.0, label: '100%' },
                          { val: 1.25, label: '125%' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => updateGraphicsField({ resolutionScale: opt.val })}
                            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                              Math.abs(settings.graphics.resolutionScale - opt.val) < 0.02
                                ? 'bg-[#2596A6] text-white'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Shadow Quality */}
                    <div className="rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-white/90">Qualidade das Sombras</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
                        {(
                          [
                            { id: 'off', label: 'Off' },
                            { id: 'low', label: 'Baixa' },
                            { id: 'medium', label: 'Média' },
                            { id: 'high', label: 'Alta' },
                          ] as { id: ShadowQuality; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateGraphicsField({ shadowQuality: opt.id })}
                            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                              settings.graphics.shadowQuality === opt.id
                                ? 'bg-[#2596A6] text-white'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Render Distance */}
                    <div className="rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-white/90">Distância de Renderização</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
                        {(
                          [
                            { id: 'short', label: 'Curta' },
                            { id: 'medium', label: 'Média' },
                            { id: 'far', label: 'Longa' },
                            { id: 'ultra', label: 'Ultra' },
                          ] as { id: RenderDistanceTier; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateGraphicsField({ renderDistance: opt.id })}
                            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                              settings.graphics.renderDistance === opt.id
                                ? 'bg-[#2596A6] text-white'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Water Quality */}
                    <div className="rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-white/90">Efeitos de Água &amp; Partículas</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
                        {(
                          [
                            { id: 'low', label: 'Baixa' },
                            { id: 'medium', label: 'Média' },
                            { id: 'high', label: 'Alta' },
                          ] as { id: WaterQualityTier; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateGraphicsField({ waterQuality: opt.id })}
                            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                              settings.graphics.waterQuality === opt.id
                                ? 'bg-[#2596A6] text-white'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reflections & Post-Processing */}
                    <div className="space-y-3 rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-white/90">Reflexos na Água</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateGraphicsField({
                              reflectionsEnabled: !settings.graphics.reflectionsEnabled,
                            })
                          }
                          className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                            settings.graphics.reflectionsEnabled
                              ? 'border-[#2596A6]/70 bg-[#2596A6]/25 text-white'
                              : 'border-white/15 bg-white/[0.04] text-white/65'
                          }`}
                        >
                          {settings.graphics.reflectionsEnabled ? 'Ativados' : 'Desativados'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-white/90">Pós-Processamento Óptico</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateGraphicsField({
                              postProcessingEnabled: !settings.graphics.postProcessingEnabled,
                            })
                          }
                          className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                            settings.graphics.postProcessingEnabled
                              ? 'border-[#2596A6]/70 bg-[#2596A6]/25 text-white'
                              : 'border-white/15 bg-white/[0.04] text-white/65'
                          }`}
                        >
                          {settings.graphics.postProcessingEnabled ? 'Ativado' : 'Desativado'}
                        </button>
                      </div>
                    </div>

                    {/* FPS Limit */}
                    <div className="rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-white/90">Limite de FPS</span>
                        <span className="font-mono-tabular text-xs text-white/60">
                          {settings.graphics.fpsLimit === 0
                            ? 'VSync / Ilimitado'
                            : `${settings.graphics.fpsLimit} FPS`}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
                        {([0, 30, 60, 120] as const).map((cap) => (
                          <button
                            key={cap}
                            type="button"
                            onClick={() => updateGraphicsField({ fpsLimit: cap })}
                            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                              settings.graphics.fpsLimit === cap
                                ? 'bg-[#2596A6] text-white'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            {cap === 0 ? 'Livre' : `${cap}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CONTROLES & DADOS MULTIPLATAFORMA */}
              {settingsTab === 'controles' && (
                <div className="space-y-5">
                  {/* Remappable 5 Dedicated Maneuvers */}
                  <div className="rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-[#38d9c8]">
                          Teclas Exclusivas de Manobra (PC)
                        </h3>
                        <p className="mt-0.5 text-xs text-white/65">
                          Clique em uma tecla para remapear. Cada comando executa uma única manobra por pressionamento.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCapturingAction(null);
                          onUpdateSettings({ keyBindings: { ...DEFAULT_KEY_BINDINGS } });
                          setKeyStatusMsg({
                            text: 'Teclas restauradas para o padrão (Z, X, C, V, B).',
                          });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Restaurar Padrão (Z/X/C/V/B)</span>
                      </button>
                    </div>

                    {keyStatusMsg && (
                      <div
                        className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                          keyStatusMsg.error
                            ? 'border-[#e68a5c]/50 bg-[#e68a5c]/15 text-[#f2a679]'
                            : 'border-[#38d9c8]/40 bg-[#38d9c8]/12 text-[#8df0e5]'
                        }`}
                      >
                        {keyStatusMsg.text}
                      </div>
                    )}

                    <div className="mt-3 divide-y divide-white/8">
                      {MANEUVER_LABELS.map((item) => {
                        const isCapturing = capturingAction === item.id;
                        const boundCode = settings.keyBindings[item.id];
                        return (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white">{item.name}</div>
                              <div className="text-xs text-white/55">{item.desc}</div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setKeyStatusMsg(null);
                                setCapturingAction(isCapturing ? null : item.id);
                              }}
                              className={`font-mono-tabular min-w-[116px] rounded-lg border px-3.5 py-1.5 text-center text-xs font-bold transition-all ${
                                isCapturing
                                  ? 'animate-pulse border-[#38d9c8] bg-[#2596A6] text-white'
                                  : 'border-white/25 bg-[#071726]/80 text-[#E7DCC8] hover:border-[#38d9c8]/75 hover:text-white'
                              }`}
                            >
                              {isCapturing ? 'Pressione tecla...' : formatKeyCodeLabel(boundCode)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Full PC + Android Controls Reference */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                      <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-white/85">
                        Controles de Movimentação &amp; Câmera (PC)
                      </h4>
                      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <ControlRow k="W A S D / Setas" v="Remar, caminhar e dirigir" />
                        <ControlRow k="ESPAÇO" v="Remada extra / Play-Pause Replay" />
                        <ControlRow k="SHIFT" v="Estabilizar equilíbrio na onda" />
                        <ControlRow k="Q / E" v="Inclinação manual na prancha" />
                        <ControlRow k="T" v="Alternar Câmera 1P / 3P" />
                        <ControlRow k="H" v="Centralizar Câmera" />
                        <ControlRow k="R" v="Abrir / Fechar Replay 15s" />
                        <ControlRow k="ESC" v="Pausar / Voltar" />
                        <ControlRow k="Mouse (Arrastar/Scroll)" v="Olhar livre e Zoom" />
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                      <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-white/85">
                        Controles Touch (Android / Tablet)
                      </h4>
                      <p className="mt-2 text-xs leading-relaxed text-white/65">
                        Todos os controles táteis originais seguem ativos automaticamente em telas touch: joystick direcional à esquerda, controle de equilíbrio à direita, botões contextuais de manobras, botão de Duck Dive e arraste livre na tela para câmera e zoom em pinça.
                      </p>
                    </div>
                  </div>

                  {/* Cross-Device Progress Sync (PC <-> Android) */}
                  <div className="rounded-xl border border-white/10 bg-[#0B2338]/45 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-[#38d9c8]">
                          Compartilhar Progresso entre PC e Android
                        </h3>
                        <p className="mt-0.5 text-xs text-white/65">
                          Transfira Carreira, pranchas desbloqueadas, troféus e configurações sem sobrescrever seu save local por acidente.
                        </p>
                      </div>
                      <span className="font-mono-tabular rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/75">
                        {career
                          ? `Carreira ativa: ${career.surfer.name} (T${career.season})`
                          : 'Nenhuma carreira local salva'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCopySyncCode}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#38d9c8]/45 bg-[#0B3C5D]/75 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2596A6]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar Código de Sincronização</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadSaveFile}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-white/[0.12]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Exportar Arquivo (.flowsave.json)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-white/[0.12]"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>Importar Arquivo</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,.flowsave.json,application/json"
                        onChange={handleUploadSaveFile}
                        className="hidden"
                      />
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={syncInput}
                        onChange={(e) => setSyncInput(e.target.value)}
                        placeholder="Cole aqui o código FLOW1:... de outro dispositivo para importar"
                        className="font-mono-tabular flex-1 rounded-lg border border-white/15 bg-[#071726]/80 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:border-[#38d9c8] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplySyncText}
                        disabled={!syncInput.trim()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2596A6] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2eb0c2] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Aplicar Código</span>
                      </button>
                    </div>

                    {syncStatus && (
                      <div
                        className={`mt-2.5 rounded-lg border px-3 py-2 text-xs ${
                          syncStatus.error
                            ? 'border-[#e68a5c]/50 bg-[#e68a5c]/15 text-[#f2a679]'
                            : 'border-[#38d9c8]/40 bg-[#38d9c8]/12 text-[#8df0e5]'
                        }`}
                      >
                        {syncStatus.text}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function ControlRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/5 py-1">
      <span className="font-mono-tabular font-semibold text-[#E7DCC8]">{k}</span>
      <span className="text-right text-white/65">{v}</span>
    </div>
  );
}
