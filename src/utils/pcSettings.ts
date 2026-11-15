import { saveCareerState } from '../career/careerEngine';
import { DEFAULT_KEY_BINDINGS, DEFAULT_SETTINGS, GRAPHICS_PRESETS } from '../data/surfData';
import { CareerSaveState } from '../types/career';
import {
  GameSettings,
  GraphicsPreset,
  GraphicsSettings,
  ManeuverActionId,
  ManeuverKeyBindings,
} from '../types/game';

const SETTINGS_STORAGE_KEY = 'flow_settings_v1';

const RESERVED_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyQ',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyH',
  'Space',
  'Escape',
  'ShiftLeft',
  'ShiftRight',
  'Tab',
  'Enter',
]);

export function isReservedControlKey(code: string): boolean {
  return RESERVED_KEYS.has(code);
}

export function formatKeyCodeLabel(code: string): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM${code.slice(6)}`;
  const map: Record<string, string> = {
    Space: 'ESPAÇO',
    ShiftLeft: 'SHIFT',
    ShiftRight: 'SHIFT',
    ControlLeft: 'CTRL',
    ControlRight: 'CTRL',
    AltLeft: 'ALT',
    AltRight: 'ALT',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
  };
  return map[code] ?? code.toUpperCase();
}

export function detectDefaultGraphicsSettings(): GraphicsSettings {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ...GRAPHICS_PRESETS.high };
  }

  const isCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

  if (isCoarsePointer && (cores <= 4 || (mem !== undefined && mem <= 4))) {
    return { ...GRAPHICS_PRESETS.medium };
  }
  if (!isCoarsePointer && cores >= 8 && (mem === undefined || mem >= 8)) {
    return { ...GRAPHICS_PRESETS.high };
  }
  if (cores <= 2 || (mem !== undefined && mem <= 2)) {
    return { ...GRAPHICS_PRESETS.low };
  }
  return { ...GRAPHICS_PRESETS.medium };
}

function sanitizeKeyBindings(raw?: Partial<ManeuverKeyBindings> | null): ManeuverKeyBindings {
  const next: ManeuverKeyBindings = { ...DEFAULT_KEY_BINDINGS };
  if (!raw) return next;
  const used = new Set<string>();
  const keys: ManeuverActionId[] = ['air', 'bottomTurn', 'cutback', 'floater', 'duckDive'];
  for (const k of keys) {
    const candidate = raw[k];
    if (
      typeof candidate === 'string' &&
      candidate.length > 0 &&
      !isReservedControlKey(candidate) &&
      !used.has(candidate)
    ) {
      next[k] = candidate;
      used.add(candidate);
    } else {
      used.add(next[k]);
    }
  }
  return next;
}

export function normalizeSettings(raw?: Partial<GameSettings> | null): GameSettings {
  const autoGraphics = detectDefaultGraphicsSettings();
  const baseGraphics = raw?.graphics
    ? {
        ...autoGraphics,
        ...raw.graphics,
      }
    : autoGraphics;

  const aspectMode =
    raw?.aspectMode ?? (raw?.aspectLock16x9 ? '16:9' : DEFAULT_SETTINGS.aspectMode);

  const oceanDetail =
    baseGraphics.waterQuality === 'low' ? 'Balanced' : (raw?.oceanDetail ?? DEFAULT_SETTINGS.oceanDetail);

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    aspectMode,
    aspectLock16x9: aspectMode === '16:9',
    oceanDetail,
    graphics: baseGraphics,
    keyBindings: sanitizeKeyBindings(raw?.keyBindings),
  };
}

export function loadGameSettings(): GameSettings {
  if (typeof window === 'undefined') return normalizeSettings(null);
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return normalizeSettings(null);
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return normalizeSettings(parsed);
  } catch {
    return normalizeSettings(null);
  }
}

export function saveGameSettings(settings: GameSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export function applyGraphicsPreset(preset: Exclude<GraphicsPreset, 'custom'>): GraphicsSettings {
  return { ...GRAPHICS_PRESETS[preset] };
}

export interface CrossDeviceBundle {
  bundleVersion: 1;
  exportedAt: string;
  career: CareerSaveState | null;
  settings: GameSettings;
  selections: {
    beachId: string;
    surferId: string;
    boardId: string;
  };
}

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function exportCrossDeviceBundleJson(
  career: CareerSaveState | null,
  settings: GameSettings,
  selections: { beachId: string; surferId: string; boardId: string }
): string {
  const payload: CrossDeviceBundle = {
    bundleVersion: 1,
    exportedAt: new Date().toISOString(),
    career,
    settings,
    selections,
  };
  return JSON.stringify(payload);
}

export function encodeCrossDeviceSyncCode(
  career: CareerSaveState | null,
  settings: GameSettings,
  selections: { beachId: string; surferId: string; boardId: string }
): string {
  const json = exportCrossDeviceBundleJson(career, settings, selections);
  return `FLOW1:${encodeBase64Utf8(json)}`;
}

export function parseCrossDeviceImport(rawInput: string): CrossDeviceBundle | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  try {
    const jsonText = trimmed.startsWith('FLOW1:')
      ? decodeBase64Utf8(trimmed.slice(6).trim())
      : trimmed;
    const parsed = JSON.parse(jsonText) as Partial<CrossDeviceBundle>;
    if (!parsed || parsed.bundleVersion !== 1 || !parsed.settings) {
      return null;
    }

    const validCareer =
      parsed.career &&
      parsed.career.version === 1 &&
      parsed.career.surfer &&
      Array.isArray(parsed.career.calendar)
        ? parsed.career
        : null;

    return {
      bundleVersion: 1,
      exportedAt: parsed.exportedAt ?? new Date().toISOString(),
      career: validCareer,
      settings: normalizeSettings(parsed.settings),
      selections: {
        beachId: parsed.selections?.beachId ?? 'kaluana-cove',
        surferId: parsed.selections?.surferId ?? 'kai-noa',
        boardId: parsed.selections?.boardId ?? 'vortex-pro',
      },
    };
  } catch {
    return null;
  }
}

export function applyCrossDeviceBundle(bundle: CrossDeviceBundle): void {
  saveGameSettings(bundle.settings);
  if (bundle.career) {
    saveCareerState(bundle.career);
  }
}
