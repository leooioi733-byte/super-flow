import { VictoryCutsceneKind } from '../types/career';
import { ExecutionQuality, ManeuverType } from '../types/game';

class OceanAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private sfxGain: GainNode | null = null;
  private surfFilter: BiquadFilterNode | null = null;
  private surfGain: GainNode | null = null;
  private wakeFilter: BiquadFilterNode | null = null;
  private wakeGain: GainNode | null = null;
  private breezeFilter: BiquadFilterNode | null = null;
  private breezeGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isPlaying = false;
  private wantedEnabled = true;
  private volume = 0.55;
  private nextGullTime = 0;
  private nextWaveSurgeTime = 0;
  private lastImpactTime = 0;
  private lastPaddleTime = 0;
  private lastStepTime = 0;
  private lastClickTime = 0;

  private ensureContext() {
    if (this.ctx) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();

    // Gentle master dynamics & warmth filter (modulates during underwater / slow-motion)
    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.value = 18000;
    masterFilter.Q.value = 0.5;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.18;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;

    masterFilter.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Dedicated SFX bus routed through masterFilter & masterGain so volume/mute/muffle always apply
    const sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.92;
    sfxGain.connect(masterFilter);

    // 4-second seamless pink/brown noise buffer for ocean roar, splashes, carving & planing hiss
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const output = buffer.getChannelData(channel);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
        b6 = white * 0.115926;
      }
    }
    this.noiseBuffer = buffer;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const surfFilter = ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.value = 330;
    surfFilter.Q.value = 0.65;

    const surfGain = ctx.createGain();
    surfGain.gain.value = 0.36;

    // Secondary board-water wake channel (modulated dynamically during surfing)
    const wakeSource = ctx.createBufferSource();
    wakeSource.buffer = buffer;
    wakeSource.loop = true;

    const wakeFilter = ctx.createBiquadFilter();
    wakeFilter.type = 'bandpass';
    wakeFilter.frequency.value = 920;
    wakeFilter.Q.value = 0.75;

    const wakeGain = ctx.createGain();
    wakeGain.gain.value = 0.0;

    // Slow ocean wave swell LFO (~0.115 Hz = ~8.7s period)
    const lfoOsc = ctx.createOscillator();
    lfoOsc.type = 'sine';
    lfoOsc.frequency.value = 0.115;

    const lfoFreqGain = ctx.createGain();
    lfoFreqGain.gain.value = 240;

    const lfoAmpGain = ctx.createGain();
    lfoAmpGain.gain.value = 0.19;

    lfoOsc.connect(lfoFreqGain);
    lfoFreqGain.connect(surfFilter.frequency);

    lfoOsc.connect(lfoAmpGain);
    lfoAmpGain.connect(surfGain.gain);

    // Coastal palm-breeze & shoreline air layer
    const breezeSource = ctx.createBufferSource();
    breezeSource.buffer = buffer;
    breezeSource.loop = true;

    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.value = 1280;
    breezeFilter.Q.value = 0.55;

    const breezeGain = ctx.createGain();
    breezeGain.gain.value = 0.075;

    // Rain patter layer (bandpass-filtered broadband noise)
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 2250;
    rainFilter.Q.value = 0.45;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;

    noiseSource.connect(surfFilter);
    surfFilter.connect(surfGain);
    surfGain.connect(masterFilter);

    wakeSource.connect(wakeFilter);
    wakeFilter.connect(wakeGain);
    wakeGain.connect(masterFilter);

    breezeSource.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(masterFilter);

    rainSource.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(masterFilter);

    noiseSource.start();
    wakeSource.start();
    breezeSource.start(0, 1.3);
    rainSource.start(0, 2.7);
    lfoOsc.start();

    this.ctx = ctx;
    this.masterGain = masterGain;
    this.masterFilter = masterFilter;
    this.sfxGain = sfxGain;
    this.surfFilter = surfFilter;
    this.surfGain = surfGain;
    this.wakeFilter = wakeFilter;
    this.wakeGain = wakeGain;
    this.breezeFilter = breezeFilter;
    this.breezeGain = breezeGain;
    this.rainFilter = rainFilter;
    this.rainGain = rainGain;
    this.lfoOsc = lfoOsc;
    this.nextGullTime = ctx.currentTime + 2.2;
    this.nextWaveSurgeTime = ctx.currentTime + 3.5;
  }

  /**
   * Ensures Web Audio starts seamlessly on the user's very first pointer/keyboard gesture
   * whenever audio is enabled in settings.
   */
  public unlockOnGesture(enabled: boolean, volume = this.volume) {
    this.wantedEnabled = enabled;
    this.volume = volume;
    if (!enabled) return;

    const needsStart = !this.ctx || !this.isPlaying || this.ctx.state === 'suspended';
    if (needsStart) {
      this.setEnabled(true, volume);
    }
  }

  public setEnabled(enabled: boolean, volume = this.volume) {
    this.wantedEnabled = enabled;
    this.volume = volume;
    if (enabled) {
      this.ensureContext();
      if (!this.ctx || !this.masterGain) return;
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.masterGain.gain.setTargetAtTime(this.volume * 0.68, this.ctx.currentTime, 0.32);
      this.isPlaying = true;
    } else if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.22);
      this.isPlaying = false;
    }
  }

  public setVolume(volume: number) {
    this.volume = volume;
    if (this.isPlaying && this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(volume * 0.68, this.ctx.currentTime, 0.1);
    }
  }

  private ready(): boolean {
    if (!this.wantedEnabled) return false;
    if (!this.ctx || !this.sfxGain) return false;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.isPlaying;
  }

  public suspendForBackground() {
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  public resumeFromBackground() {
    if (this.wantedEnabled && this.isPlaying && this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  /**
   * Dynamically shapes ambient ocean, board planing wake, underwater muffling & slow-motion warmth.
   */
  public updateSurfTelemetry(
    speed: number,
    carvingIntensity: number,
    inBarrel: boolean,
    underwaterFactor: number,
    isWaterActive: boolean,
    rainIntensity = 0,
    slowMoFactor = 0
  ) {
    if (!this.ready() || !this.ctx || !this.surfFilter || !this.wakeFilter || !this.wakeGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const sub = Math.max(0, Math.min(1, underwaterFactor));
    const rain = Math.max(0, Math.min(1, rainIntensity));
    const slow = Math.max(0, Math.min(1, slowMoFactor));

    // Warm cinematic master filter: slightly mellow high-cut during maneuver slow-motion & deep muffle underwater
    if (this.masterFilter) {
      const targetMasterCutoff =
        sub > 0.05
          ? 2400 - sub * 1850
          : slow > 0.05
            ? 14000 - slow * 10200
            : 18000;
      this.masterFilter.frequency.setTargetAtTime(targetMasterCutoff, now, 0.09);
    }

    // Muffle ambient ocean roar deeply underwater; heighten hollow resonance inside barrel
    const targetCutoff =
      sub > 0.05
        ? 330 - sub * 220
        : inBarrel
          ? 610
          : 330 + Math.min(220, speed * 11);
    this.surfFilter.frequency.setTargetAtTime(targetCutoff, now, 0.09);

    // Coastal breeze & distant beach life fade gently underwater & during slow-mo focus
    if (this.breezeGain && this.breezeFilter) {
      const targetBreeze =
        (1 - sub) * (1 - slow * 0.45) * (isWaterActive ? 0.05 : 0.088) * (1 + rain * 0.4);
      this.breezeGain.gain.setTargetAtTime(targetBreeze, now, 0.25);
      this.breezeFilter.frequency.setTargetAtTime(isWaterActive ? 1120 : 1420, now, 0.3);
    }

    // Dynamic rainfall hiss & underwater muffle
    if (this.rainGain && this.rainFilter) {
      const targetRainGain = rain * (1 - sub * 0.85) * 0.22;
      const targetRainFreq = 2250 - sub * 1650;
      this.rainGain.gain.setTargetAtTime(targetRainGain, now, 0.22);
      this.rainFilter.frequency.setTargetAtTime(targetRainFreq, now, 0.14);
    }

    // Continuous board-on-water carving rush
    if (!isWaterActive || sub > 0.45) {
      this.wakeGain.gain.setTargetAtTime(0.0, now, 0.12);
    } else {
      const speedNorm = Math.max(0, Math.min(1, (speed - 2.2) / 14));
      const targetWakeGain =
        (speedNorm * 0.24 + carvingIntensity * 0.22 + (inBarrel ? 0.19 : 0)) *
        (1 - sub) *
        (1 - slow * 0.35);
      const targetWakeFreq = (680 + speed * 54 + carvingIntensity * 420) * (1 - slow * 0.32);
      this.wakeGain.gain.setTargetAtTime(targetWakeGain, now, 0.08);
      this.wakeFilter.frequency.setTargetAtTime(targetWakeFreq, now, 0.08);
    }

    // Periodic ambient coastal seagulls & breaking wave swells while above water
    if (sub < 0.2 && now >= this.nextGullTime) {
      this.nextGullTime = now + 6.5 + Math.random() * 7.5;
      this.playSeagullCall(isWaterActive ? 0.48 : 0.82);
    }
    if (sub < 0.35 && now >= this.nextWaveSurgeTime) {
      this.nextWaveSurgeTime = now + 6.8 + Math.random() * 4.8;
      this.playWaveBreakSurge(inBarrel ? 0.92 : 0.56);
    }
  }

  /**
   * Procedural coastal seagull cry with dual-harmonic downward pitch glide.
   */
  public playSeagullCall(distanceScale = 0.82) {
    if (!this.ready() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const calls = Math.random() > 0.45 ? 2 : 1;

    for (let c = 0; c < calls; c++) {
      const t0 = now + c * 0.36;
      const baseFreq = 1600 + Math.random() * 340;

      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc2.type = 'sine';

      osc.frequency.setValueAtTime(baseFreq * 0.88, t0);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.16, t0 + 0.07);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, t0 + 0.27);

      osc2.frequency.setValueAtTime(baseFreq * 1.76, t0);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.22, t0 + 0.07);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.38, t0 + 0.27);

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 2.1;

      const gain = this.ctx.createGain();
      const peak = 0.03 * distanceScale;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);

      osc.connect(bp);
      osc2.connect(bp);
      bp.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t0);
      osc2.start(t0);
      osc.stop(t0 + 0.3);
      osc2.stop(t0 + 0.3);
    }
  }

  /**
   * Subtle rolling deep whitewater swell surge.
   */
  public playWaveBreakSurge(intensity = 0.65) {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(210, now);
    filter.frequency.linearRampToValueAtTime(640, now + 0.9);
    filter.frequency.exponentialRampToValueAtTime(180, now + 2.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16 * intensity, now + 0.75);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.9);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, Math.random() * 2.0);
    src.stop(now + 3.0);
  }

  /**
   * Soft distant leather volleyball pop synced with the beach match rally.
   */
  public playVolleyballHit(proximity = 0.6) {
    if (!this.ready() || !this.ctx || !this.sfxGain || proximity <= 0.05) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(215 + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.075);

    gain.gain.setValueAtTime(0.075 * proximity, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Crisp wave drop-in swell rush when catching a wave past 50 km/h.
   */
  public playTakeoffSound() {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.exponentialRampToValueAtTime(1350, now + 0.28);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.65);
    filter.Q.value = 0.85;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, Math.random() * 2.0);
    src.stop(now + 0.7);
  }

  /**
   * Deep bubble-plunge whoosh when duck diving beneath an incoming crest.
   */
  public playDuckDiveSound() {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Low water plunge thud
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(145, now);
    subOsc.frequency.exponentialRampToValueAtTime(52, now + 0.26);
    subGain.gain.setValueAtTime(0.18, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 0.3);

    // Filtered underwater glide whoosh
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(980, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.52);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.28, now + 0.05);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.56);

    src.connect(lp);
    lp.connect(nGain);
    nGain.connect(this.sfxGain);
    src.start(now, Math.random() * 2.0);
    src.stop(now + 0.6);
  }

  /**
   * Expressive carving spray whip & warm harmonic feedback on maneuver execution.
   */
  public playManeuverSound(type: ManeuverType, quality: ExecutionQuality) {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // 1. Water carve / air-launch spray sweep
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const startFreq = type === 'bottomTurn' ? 420 : type === 'air' ? 920 : 620;
    const peakFreq = type === 'air' ? 2100 : type === 'cutback' ? 1650 : 1350;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.16);
    filter.frequency.exponentialRampToValueAtTime(480, now + 0.48);
    filter.Q.value = type === 'air' ? 0.7 : 1.05;

    const qualScale = quality === 'Perfect' ? 1.15 : quality === 'Good' ? 1.0 : 0.85;
    const sprayGain = this.ctx.createGain();
    sprayGain.gain.setValueAtTime(0.001, now);
    sprayGain.gain.linearRampToValueAtTime(0.32 * qualScale, now + 0.05);
    sprayGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    src.connect(filter);
    filter.connect(sprayGain);
    sprayGain.connect(this.sfxGain);
    src.start(now, Math.random() * 2.0);
    src.stop(now + 0.54);

    // 2. Cozy warm harmonic accent (subtle pentatonic tone scaled by quality)
    const noteBase = quality === 'Perfect' ? 587.33 : quality === 'Good' ? 493.88 : 392.0;
    const osc = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(noteBase, now + 0.02);
    if (quality === 'Perfect') {
      osc.frequency.setValueAtTime(noteBase * 1.25, now + 0.11);
    }
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.linearRampToValueAtTime(quality === 'Perfect' ? 0.075 : 0.05, now + 0.03);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + (quality === 'Perfect' ? 0.34 : 0.22));
    osc.connect(toneGain);
    toneGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  /**
   * Muted water slap / stumble feedback when a maneuver misses timing or section.
   */
  public playManeuverFailSound() {
    if (!this.ready() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(88, now + 0.16);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Euphoric deep tube spit-out rush when exiting a clean barrel.
   */
  public playBarrelSpitSound() {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(280, now);
    bp.frequency.exponentialRampToValueAtTime(1600, now + 0.25);
    bp.frequency.exponentialRampToValueAtTime(500, now + 0.72);
    bp.Q.value = 0.85;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.38, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.76);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, Math.random() * 2.0);
    src.stop(now + 0.8);

    // Warm celebratory fifth chime
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now + 0.04);
    osc.frequency.setValueAtTime(783.99, now + 0.14);
    oGain.gain.setValueAtTime(0.0001, now + 0.04);
    oGain.gain.linearRampToValueAtTime(0.065, now + 0.07);
    oGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    osc.connect(oGain);
    oGain.connect(this.sfxGain);
    osc.start(now + 0.04);
    osc.stop(now + 0.45);
  }

  /**
   * Soft rhythmic water scoop for paddling or swimming recovery strokes.
   */
  public playPaddleStrokeSound(isSwimming = false) {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPaddleTime < 0.28) return;
    this.lastPaddleTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isSwimming ? 540 : 660, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.18);
    filter.Q.value = 1.1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isSwimming ? 0.14 : 0.11, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.21);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, Math.random() * 2.0);
    src.stop(now + 0.23);
  }

  /**
   * Gentle soft coastal sand footstep while walking toward the shoreline.
   */
  public playFootstepSound() {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStepTime < 0.24) return;
    this.lastStepTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750 + Math.random() * 180, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, Math.random() * 2.0);
    src.stop(now + 0.11);
  }

  /**
   * Plays a layered physical water impact / splash burst scaled by collision intensity (0..1).
   */
  public playWaterImpact(intensity: number) {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastImpactTime < 0.14) return;
    this.lastImpactTime = now;

    const amt = Math.max(0.15, Math.min(1.0, intensity));

    // 1. Sub-surface heavy thump for strong/medium wave slams
    if (amt > 0.3) {
      const thump = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(94 + amt * 42, now);
      thump.frequency.exponentialRampToValueAtTime(34, now + 0.28);
      thumpGain.gain.setValueAtTime(0.24 * amt, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      thump.connect(thumpGain);
      thumpGain.connect(this.sfxGain);
      thump.start(now);
      thump.stop(now + 0.34);
    }

    // 2. Filtered broadband splash burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350 - amt * 420, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.45 + amt * 0.35);
    filter.Q.value = 0.65;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.42 * amt, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5 + amt * 0.45);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, Math.random() * 2.0);
    src.stop(now + 0.55 + amt * 0.48);
  }

  /**
   * Plays a crisp water-break & breath-catching sound when resurfacing from a fall or duck dive.
   */
  public playResurfaceSound() {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(1180, now + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, Math.random() * 2.0);
    src.stop(now + 0.45);
  }

  public playSoftClick(pitch = 420) {
    if (!this.wantedEnabled) return;
    if (!this.ctx || !this.sfxGain) {
      this.setEnabled(true, this.volume);
    }
    if (!this.ctx || !this.sfxGain || !this.isPlaying) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    if (now - this.lastClickTime < 0.04) return;
    this.lastClickTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.74, now + 0.075);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  /**
   * Subtle coastal atmosphere & championship broadcast audio cues during pre-heat cutscenes.
   */
  public playCutsceneStageCue(stage: number, seed = 0) {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    if (stage === 1 || stage === 4) {
      // Gentle warm chord pad swell to anchor the championship intro without overpowering the ocean
      const freqs = stage === 1 ? [196, 293.66, 392] : [220, 329.63, 440];
      const transpose = seed % 2 === 0 ? 1.0 : 1.05946;
      for (let i = 0; i < freqs.length; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freqs[i] * transpose, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.032 / (i + 1), now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 1.95);
      }
    }

    if (stage === 1 || stage === 2) {
      // Soft distant seabird / coastal wind sweep
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(stage === 1 ? 620 : 480, now);
      filter.frequency.exponentialRampToValueAtTime(stage === 1 ? 340 : 280, now + 1.4);
      filter.Q.value = 1.4;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      src.start(now, Math.random() * 2.0);
      src.stop(now + 1.55);
    }

    if (stage === 6) {
      // Crisp subtle start-heat horn tone
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.25);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.065, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.7);
    }
  }

  /**
   * Procedural musical fanfares, warm harmonic chords, and coastal crowd cheer swells
   * for each stage of the 5 cinematic victory cutscenes.
   */
  public playVictoryCutsceneCue(kind: VictoryCutsceneKind, stage: number) {
    if (!this.ready() || !this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const sfx = this.sfxGain;
    const ctx = this.ctx;

    const playArpNote = (freq: number, delay: number, dur: number, vol: number, wave: OscillatorType = 'triangle') => {
      const t0 = now + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(sfx);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    };

    const playCrowdWash = (delay: number, dur: number, vol: number, centerHz = 820) => {
      if (!this.noiseBuffer) return;
      const t0 = now + delay;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(centerHz * 0.75, t0);
      filter.frequency.linearRampToValueAtTime(centerHz * 1.15, t0 + dur * 0.4);
      filter.frequency.exponentialRampToValueAtTime(centerHz * 0.65, t0 + dur);
      filter.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(sfx);
      src.start(t0, Math.random() * 2.0);
      src.stop(t0 + dur + 0.06);
    };

    if (kind === 'heat_win') {
      if (stage === 1) {
        // Bright major triad rising chime
        [392.0, 493.88, 587.33, 783.99].forEach((f, idx) => {
          playArpNote(f, idx * 0.09, 0.95, 0.065, 'triangle');
        });
        playCrowdWash(0.1, 1.4, 0.08, 720);
      } else {
        playArpNote(587.33, 0, 1.1, 0.04, 'sine');
        playArpNote(783.99, 0.08, 1.1, 0.04, 'sine');
      }
    } else if (kind === 'quarterfinal_win') {
      if (stage === 1) {
        [329.63, 415.3, 493.88, 659.25].forEach((f, idx) => {
          playArpNote(f, idx * 0.09, 1.1, 0.065, 'triangle');
        });
        playCrowdWash(0.05, 1.5, 0.09, 760);
      } else if (stage === 2) {
        playArpNote(493.88, 0, 1.25, 0.05, 'sine');
        playArpNote(659.25, 0.06, 1.35, 0.055, 'triangle');
      }
    } else if (kind === 'semifinal_win') {
      if (stage === 1) {
        // Energetic rising fanfare + beach crowd cheer swell
        [293.66, 369.99, 440.0, 587.33, 739.99].forEach((f, idx) => {
          playArpNote(f, idx * 0.085, 1.25, 0.072, 'triangle');
        });
        playCrowdWash(0.05, 1.9, 0.13, 880);
      } else if (stage === 2) {
        [440.0, 554.37, 659.25, 880.0].forEach((f, idx) => {
          playArpNote(f, idx * 0.07, 1.4, 0.058, 'triangle');
        });
      } else {
        playArpNote(587.33, 0, 1.5, 0.055, 'sine');
        playArpNote(880.0, 0.08, 1.6, 0.06, 'sine');
      }
    } else if (kind === 'final_win') {
      if (stage === 1) {
        // Dramatic post-wave crescendo chord
        [261.63, 329.63, 392.0, 523.25].forEach((f) => {
          playArpNote(f, 0.05, 2.0, 0.055, 'triangle');
        });
        playCrowdWash(0.1, 2.0, 0.12, 820);
      } else if (stage === 2) {
        // Full "CAMPEÃO!" triumphant brass-like arpeggio
        [261.63, 329.63, 392.0, 493.88, 523.25, 659.25, 783.99].forEach((f, idx) => {
          playArpNote(f, idx * 0.075, 1.85, 0.072, idx % 2 === 0 ? 'triangle' : 'sine');
        });
        playCrowdWash(0.05, 2.4, 0.16, 940);
      } else {
        playArpNote(523.25, 0, 1.9, 0.05, 'sine');
        playArpNote(659.25, 0.05, 1.9, 0.05, 'sine');
        playArpNote(783.99, 0.1, 1.9, 0.05, 'sine');
      }
    } else if (kind === 'championship_ceremony') {
      if (stage === 1) {
        // Golden podium reveal harmonic swell + applause texture
        [220.0, 277.18, 329.63, 440.0, 554.37, 659.25].forEach((f, idx) => {
          playArpNote(f, idx * 0.09, 2.2, 0.062, 'triangle');
        });
        playCrowdWash(0.15, 2.5, 0.14, 960);
      } else if (stage === 2) {
        // Championship Trophy shimmer & major 9th chord
        [329.63, 440.0, 554.37, 659.25, 830.61, 987.77].forEach((f, idx) => {
          playArpNote(f, idx * 0.08, 2.1, 0.058, 'sine');
        });
        playCrowdWash(0.05, 2.2, 0.12, 920);
      } else {
        playArpNote(440.0, 0, 2.1, 0.045, 'triangle');
        playArpNote(659.25, 0.06, 2.1, 0.048, 'sine');
        playArpNote(880.0, 0.12, 2.2, 0.045, 'sine');
      }
    }
  }

  /**
   * Subtle broadcast press zone chimes and tone-matched audio feedback
   * for post-competition interviews.
   */
  public playInterviewCue(
    cue: 'open' | 'select_humildade' | 'select_confianca' | 'select_provocacao' | 'skip'
  ) {
    if (!this.ready() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const ctx = this.ctx;
    const sfx = this.sfxGain;

    const note = (freq: number, delay: number, dur: number, vol: number, wave: OscillatorType = 'sine') => {
      const t0 = now + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(sfx);
      osc.start(t0);
      osc.stop(t0 + dur + 0.04);
    };

    if (cue === 'open') {
      // Crisp broadcast live-mic chime
      note(440.0, 0.0, 0.35, 0.042, 'sine');
      note(554.37, 0.08, 0.48, 0.045, 'triangle');
      note(659.25, 0.16, 0.65, 0.04, 'sine');
    } else if (cue === 'select_humildade') {
      // Warm resolved acoustic chord
      note(392.0, 0.0, 0.55, 0.045, 'sine');
      note(493.88, 0.06, 0.6, 0.042, 'sine');
      note(587.33, 0.12, 0.72, 0.04, 'triangle');
    } else if (cue === 'select_confianca') {
      // Confident rising fifths
      note(440.0, 0.0, 0.45, 0.048, 'triangle');
      note(659.25, 0.07, 0.65, 0.05, 'triangle');
      note(880.0, 0.15, 0.72, 0.042, 'sine');
    } else if (cue === 'select_provocacao') {
      // Bold punchy stinger
      note(329.63, 0.0, 0.36, 0.055, 'sawtooth');
      note(493.88, 0.06, 0.48, 0.048, 'triangle');
      note(622.25, 0.13, 0.58, 0.042, 'triangle');
    } else {
      note(369.99, 0.0, 0.22, 0.032, 'sine');
    }
  }

  public dispose() {
    if (this.lfoOsc) {
      try {
        this.lfoOsc.stop();
      } catch {
        // ignore if already stopped
      }
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export const oceanAudio = new OceanAudioEngine();
