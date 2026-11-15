import React, { useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Sparkles } from 'lucide-react';
import {
  ACCENT_COLOR_OPTIONS,
  CAREER_BOARD_CATALOG,
  CAREER_NATIONALITIES,
  CAREER_PHOTOS,
  CAREER_SURF_STYLES,
  HAIR_COLOR_OPTIONS,
  SKIN_TONE_OPTIONS,
  SUIT_COLOR_OPTIONS,
} from '../data/careerData';
import { CareerSurferCustomization } from '../types/career';
import { SurfboardSpec, SurferProfile } from '../types/game';
import { SurferAvatar } from './SurferAvatar';

interface CareerCreateScreenProps {
  surfers: SurferProfile[];
  boards: SurfboardSpec[];
  hasExistingCareer: boolean;
  onCancel: () => void;
  onCreateCareer: (surfer: CareerSurferCustomization, startingBoardId: string) => void;
}

export const CareerCreateScreen: React.FC<CareerCreateScreenProps> = ({
  surfers,
  boards,
  hasExistingCareer,
  onCancel,
  onCreateCareer,
}) => {
  const starterBoardIds = CAREER_BOARD_CATALOG.filter((b) => b.price === 0).map((b) => b.id);
  const starterBoards = boards.filter((b) => starterBoardIds.includes(b.id));

  const initialBase = surfers[0];
  const [baseSurferId, setBaseSurferId] = useState(initialBase.id);
  const [name, setName] = useState(initialBase.name);
  const [nationality, setNationality] = useState(initialBase.nationality ?? 'Brasil');
  const [nationalityCode, setNationalityCode] = useState(
    CAREER_NATIONALITIES.find((n) => n.name === initialBase.nationality)?.code ?? 'BRA'
  );
  const [stance, setStance] = useState<'Regular' | 'Goofy'>(initialBase.stance);
  const [style, setStyle] = useState<string>(CAREER_SURF_STYLES[0]);
  const [suitColor, setSuitColor] = useState(initialBase.suitColor);
  const [accentColor, setAccentColor] = useState(initialBase.accentColor);
  const [skinTone, setSkinTone] = useState(initialBase.skinTone ?? SKIN_TONE_OPTIONS[2].hex);
  const [hairColor, setHairColor] = useState(initialBase.hairColor ?? HAIR_COLOR_OPTIONS[0].hex);
  const [boardId, setBoardId] = useState(starterBoards[0]?.id ?? 'vortex-pro');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSelectPresetCharacter = (s: SurferProfile) => {
    setBaseSurferId(s.id);
    setName(s.name);
    const nat = CAREER_NATIONALITIES.find((n) => n.name === s.nationality);
    if (nat) {
      setNationality(nat.name);
      setNationalityCode(nat.code);
    }
    setStance(s.stance);
    setSuitColor(s.suitColor);
    setAccentColor(s.accentColor);
    if (s.skinTone) setSkinTone(s.skinTone);
    if (s.hairColor) setHairColor(s.hairColor);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setErrorMsg('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    setErrorMsg('');
    onCreateCareer(
      {
        name: trimmed,
        nationality,
        nationalityCode,
        baseSurferId,
        stance,
        style,
        suitColor,
        accentColor,
        skinTone,
        hairColor,
      },
      boardId
    );
  };

  return (
    <div className="pointer-events-auto mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-y-auto rounded-2xl border border-white/15 bg-[#071726]/90 shadow-2xl sm:max-h-[calc(100dvh-1.75rem)] lg:max-h-[calc(100dvh-3rem)] lg:overflow-hidden [@media(max-height:600px)]:!overflow-y-auto">
      {/* Banner Header with Coastal Photography */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 lg:shrink-0 [@media(max-height:600px)]:!shrink">
        <img
          src={CAREER_PHOTOS.beach}
          alt="Praia de campeonato FLOW"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#071726] via-[#071726]/85 to-[#071726]/70" />

        <div className="relative z-10 flex min-w-0 items-center gap-3">
          <SurferAvatar
            name={name || 'Surfista'}
            suitColor={suitColor}
            accentColor={accentColor}
            skinTone={skinTone}
            hairColor={hairColor}
            size="md"
          />
          <div className="min-w-0">
            <div className="text-[11px] font-medium tracking-[0.14em] text-[#38d9c8] sm:text-xs">
              Nova Carreira Profissional
            </div>
            <h2 className="font-display truncate text-lg font-bold tracking-tight text-white sm:text-2xl">
              {name.trim() || 'Crie seu Surfista'}
            </h2>
            <p className="truncate text-xs text-[#E7DCC8]/80">
              {nationality} · {stance} · Circuito Amador — Temporada 1
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-[#071726]/75 px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:border-white/30 hover:text-white sm:px-3.5 sm:py-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{hasExistingCareer ? 'Voltar à Carreira' : 'Menu Inicial'}</span>
        </button>
      </div>

      {/* Form Content */}
      <form
        onSubmit={handleSubmit}
        className="min-h-0 flex-1 p-4 sm:p-6 lg:overflow-y-auto [@media(max-height:600px)]:!overflow-visible"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">
          {/* Column 1: Identity & Character Base */}
          <div className="space-y-5 md:col-span-6">
            <div>
              <h3 className="font-display text-sm font-semibold tracking-wide text-white">
                01. Identidade do Atleta
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="career-name"
                    className="block text-xs font-medium text-white/70"
                  >
                    Nome do Surfista
                  </label>
                  <input
                    id="career-name"
                    type="text"
                    maxLength={24}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Gabriel Silva"
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#0B2338]/80 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#38d9c8] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="career-nation"
                    className="block text-xs font-medium text-white/70"
                  >
                    Nacionalidade
                  </label>
                  <select
                    id="career-nation"
                    value={nationality}
                    onChange={(e) => {
                      const found = CAREER_NATIONALITIES.find((n) => n.name === e.target.value);
                      setNationality(e.target.value);
                      setNationalityCode(found?.code ?? 'INT');
                    }}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#0B2338]/80 px-3 py-2 text-sm text-white focus:border-[#38d9c8] focus:outline-none"
                  >
                    {CAREER_NATIONALITIES.map((n) => (
                      <option key={n.code} value={n.name} className="bg-[#071726]">
                        {n.name} ({n.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Character Base Picker */}
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold tracking-wide text-white">
                  02. Personagem Base
                </h3>
                <span className="text-xs text-white/55">Modelos do FLOW</span>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {surfers.map((s) => {
                  const active = baseSurferId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectPresetCharacter(s)}
                      className={`flex items-center gap-2.5 rounded-lg border p-2 text-left transition-all ${
                        active
                          ? 'border-[#38d9c8]/80 bg-[#0B3C5D]/70 text-white'
                          : 'border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25 hover:bg-white/[0.07]'
                      }`}
                    >
                      <SurferAvatar
                        name={s.name}
                        suitColor={s.suitColor}
                        accentColor={s.accentColor}
                        skinTone={s.skinTone}
                        hairColor={s.hairColor}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold">{s.name}</div>
                        <div className="truncate text-[11px] text-white/55">{s.origin}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stance & Surf Style */}
            <div className="border-t border-white/10 pt-4">
              <h3 className="font-display text-sm font-semibold tracking-wide text-white">
                03. Base e Estilo de Surfe
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {(['Regular', 'Goofy'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStance(st)}
                    className={`rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors ${
                      stance === st
                        ? 'border-[#38d9c8]/80 bg-[#2596A6] text-white'
                        : 'border-white/15 bg-white/[0.04] text-white/70 hover:text-white'
                    }`}
                  >
                    {st === 'Regular' ? 'Regular (Pé Esq. à Frente)' : 'Goofy (Pé Dir. à Frente)'}
                  </button>
                ))}
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {CAREER_SURF_STYLES.map((stOpt) => (
                  <button
                    key={stOpt}
                    type="button"
                    onClick={() => setStyle(stOpt)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      style === stOpt
                        ? 'border-[#38d9c8]/75 bg-[#0B3C5D]/65 text-white'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:text-white'
                    }`}
                  >
                    {stOpt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Appearance Customization & Equipment */}
          <div className="space-y-5 md:col-span-6">
            <div>
              <h3 className="font-display text-sm font-semibold tracking-wide text-white">
                04. Personalização de Aparência
              </h3>

              <div className="mt-3 space-y-3">
                <div>
                  <span className="text-xs text-white/70">Cor do Wetsuit</span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {SUIT_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setSuitColor(c.hex)}
                        title={c.label}
                        aria-label={`Wetsuit ${c.label}`}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform ${
                          suitColor === c.hex
                            ? 'scale-110 border-[#38d9c8]'
                            : 'border-white/25 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {suitColor === c.hex && <Check className="h-3.5 w-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-white/70">Detalhe do Traje</span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {ACCENT_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setAccentColor(c.hex)}
                        title={c.label}
                        aria-label={`Detalhe ${c.label}`}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform ${
                          accentColor === c.hex
                            ? 'scale-110 border-white'
                            : 'border-white/25 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {accentColor === c.hex && (
                          <Check className="h-3.5 w-3.5 text-[#071726]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-white/70">Tom de Pele</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {SKIN_TONE_OPTIONS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setSkinTone(c.hex)}
                          title={c.label}
                          aria-label={`Pele ${c.label}`}
                          className={`h-7 w-7 rounded-full border-2 transition-transform ${
                            skinTone === c.hex ? 'scale-110 border-[#38d9c8]' : 'border-white/20'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-white/70">Cabelo</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {HAIR_COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setHairColor(c.hex)}
                          title={c.label}
                          aria-label={`Cabelo ${c.label}`}
                          className={`h-7 w-7 rounded-full border-2 transition-transform ${
                            hairColor === c.hex ? 'scale-110 border-[#38d9c8]' : 'border-white/20'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Starting Surfboard */}
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold tracking-wide text-white">
                  05. Prancha Inicial (Quiver Amador)
                </h3>
                <span className="text-xs text-[#38d9c8]">Pranchas Pro desbloqueiam na carreira</span>
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {starterBoards.map((b) => {
                  const active = boardId === b.id;
                  const meta = CAREER_BOARD_CATALOG.find((c) => c.id === b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBoardId(b.id)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        active
                          ? 'border-[#38d9c8]/80 bg-[#0B3C5D]/70 text-white'
                          : 'border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white">{b.name}</div>
                      <div className="font-mono-tabular mt-0.5 text-[11px] text-[#E7DCC8]/80">
                        {b.category} · {b.volume}
                      </div>
                      {meta && (
                        <p className="mt-1 text-[11px] leading-snug text-white/60">{meta.perks}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-[#e68a5c]/50 bg-[#e68a5c]/15 px-3 py-2 text-xs text-[#f2a679]">
            {errorMsg}
          </div>
        )}

        {/* Submit Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-xs text-white/65">
            <Sparkles className="h-3.5 w-3.5 text-[#38d9c8]" />
            <span>Progresso salvo automaticamente no dispositivo</span>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2596A6] px-6 py-2.5 text-xs font-semibold tracking-[0.12em] text-white transition-colors hover:bg-[#2eb0c2] sm:text-sm"
          >
            <span>INICIAR CARREIRA</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
