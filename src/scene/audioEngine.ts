import { AudioVolumesConfig } from '../sim/types';

export const DEFAULT_AUDIO_VOLUMES: AudioVolumesConfig = {
  master: 0.38,
  ocean: 0.85,
  motor: 0.75,
  effects: 0.85,
  radio: 0.85,
};

/**
 * 100% Procedural Web Audio API Maritime & Port Soundscape:
 * - Ocean waves & bow wake surf
 * - Rigging wind & sail luffing
 * - Rain streaks hiss
 * - Harbor dockyard ambience
 * - Auxiliary diesel/electric motor harmonic
 * - Footsteps (wood/concrete), hull creak/collision, rigging snaps, VHF radio squelch & alert pings
 * - Underwater lowpass resonance muffle when diving
 */
export class MaritimeAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;

  private surfGain: GainNode | null = null;
  private surfFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private harborGain: GainNode | null = null;
  private motorGain: GainNode | null = null;
  private motorOsc: OscillatorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private initialized = false;
  private volumes: AudioVolumesConfig = { ...DEFAULT_AUDIO_VOLUMES };
  private stepAccum = 0;

  public initOnUserGesture(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.value = 18000;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volumes.master;
      this.masterFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Shared 3-second looping pink-ish noise buffer
      const bufferSize = this.ctx.sampleRate * 3;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
      }

      // 1. Ocean surf & bow wake
      const surfSrc = this.ctx.createBufferSource();
      surfSrc.buffer = this.noiseBuffer;
      surfSrc.loop = true;
      this.surfFilter = this.ctx.createBiquadFilter();
      this.surfFilter.type = 'lowpass';
      this.surfFilter.frequency.value = 340;
      this.surfGain = this.ctx.createGain();
      this.surfGain.gain.value = 0.08;
      surfSrc.connect(this.surfFilter);
      this.surfFilter.connect(this.surfGain);
      this.surfGain.connect(this.masterFilter);
      surfSrc.start();

      // 2. Rigging wind
      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = this.noiseBuffer;
      windSrc.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 620;
      this.windFilter.Q.value = 2.2;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.02;
      windSrc.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterFilter);
      windSrc.start();

      // 3. Rain hiss
      const rainSrc = this.ctx.createBufferSource();
      rainSrc.buffer = this.noiseBuffer;
      rainSrc.loop = true;
      const rainFilter = this.ctx.createBiquadFilter();
      rainFilter.type = 'highpass';
      rainFilter.frequency.value = 1800;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      rainSrc.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.masterFilter);
      rainSrc.start();

      // 4. Port dockyard low rumble ambience
      const harborSrc = this.ctx.createBufferSource();
      harborSrc.buffer = this.noiseBuffer;
      harborSrc.loop = true;
      const harborFilter = this.ctx.createBiquadFilter();
      harborFilter.type = 'bandpass';
      harborFilter.frequency.value = 190;
      harborFilter.Q.value = 1.4;
      this.harborGain = this.ctx.createGain();
      this.harborGain.gain.value = 0;
      harborSrc.connect(harborFilter);
      harborFilter.connect(this.harborGain);
      this.harborGain.connect(this.masterFilter);
      harborSrc.start();

      // 5. Auxiliary diesel/electric hum
      this.motorOsc = this.ctx.createOscillator();
      this.motorOsc.type = 'triangle';
      this.motorOsc.frequency.value = 68;
      const motorFilter = this.ctx.createBiquadFilter();
      motorFilter.type = 'lowpass';
      motorFilter.frequency.value = 210;
      this.motorGain = this.ctx.createGain();
      this.motorGain.gain.value = 0;
      this.motorOsc.connect(motorFilter);
      motorFilter.connect(this.motorGain);
      this.motorGain.connect(this.masterFilter);
      this.motorOsc.start();

      this.initialized = true;
    } catch {
      // Audio unavailable
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : this.volumes.master,
        this.ctx.currentTime,
        0.08,
      );
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolumes(next: AudioVolumesConfig): void {
    this.volumes = { ...next };
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volumes.master, this.ctx.currentTime, 0.08);
    }
  }

  public getVolumes(): AudioVolumesConfig {
    return { ...this.volumes };
  }

  public playStep(onWoodPier: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterFilter || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(onWoodPier ? 155 : 105, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.07);
    g.gain.setValueAtTime(0.08 * this.volumes.effects, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.masterFilter);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playHullImpact(intensity01: number): void {
    if (!this.initialized || !this.ctx || !this.masterFilter || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.28);
    g.gain.setValueAtTime(Math.min(0.35, 0.12 + intensity01 * 0.22) * this.volumes.effects, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(g);
    g.connect(this.masterFilter);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  public playRiggingSnap(): void {
    if (!this.initialized || !this.ctx || !this.masterFilter || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1350;
    bp.Q.value = 3.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.09 * this.volumes.effects, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterFilter);
    src.start(now);
    src.stop(now + 0.12);
  }

  public playRadioChirp(): void {
    if (!this.initialized || !this.ctx || !this.masterFilter || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.setValueAtTime(1820, now + 0.055);
    g.gain.setValueAtTime(0.045 * this.volumes.radio, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.masterFilter);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playAlertBeep(): void {
    if (!this.initialized || !this.ctx || !this.masterFilter || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.09);
    g.gain.setValueAtTime(0.08 * this.volumes.effects, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.masterFilter);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public update(
    dt: number,
    boatSpeedKnots: number,
    apparentWindKnots: number,
    waveScale: number,
    throttle: number,
    luffingFactor: number,
    rainIntensity: number,
    distFromPortM: number,
    isUnderwater: boolean,
    charWalkSpeed: number,
    charOnWoodPier: boolean,
    isPlaying: boolean,
  ): void {
    if (
      !this.initialized ||
      !this.ctx ||
      !this.surfGain ||
      !this.windGain ||
      !this.motorGain ||
      !this.masterFilter
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!isPlaying) {
      this.surfGain.gain.setTargetAtTime(0.04 * this.volumes.ocean, now, 0.2);
      this.windGain.gain.setTargetAtTime(0.02 * this.volumes.ocean, now, 0.2);
      this.motorGain.gain.setTargetAtTime(0, now, 0.15);
      this.rainGain?.gain.setTargetAtTime(0, now, 0.2);
      this.harborGain?.gain.setTargetAtTime(0, now, 0.2);
      return;
    }

    // Underwater muffle
    this.masterFilter.frequency.setTargetAtTime(isUnderwater ? 420 : 18000, now, 0.14);

    const surfLvl = Math.min(0.45, 0.05 + boatSpeedKnots * 0.025 + waveScale * 0.06) * this.volumes.ocean;
    this.surfGain.gain.setTargetAtTime(surfLvl, now, 0.12);
    this.surfFilter?.frequency.setTargetAtTime(240 + boatSpeedKnots * 55 + waveScale * 110, now, 0.12);

    const luffFlutter = luffingFactor * 0.08 * (0.5 + 0.5 * Math.sin(now * 24));
    const windLvl = Math.min(0.32, apparentWindKnots * 0.008 + luffFlutter) * this.volumes.ocean;
    this.windGain.gain.setTargetAtTime(windLvl, now, 0.12);
    this.windFilter?.frequency.setTargetAtTime(420 + apparentWindKnots * 26, now, 0.12);

    const rainLvl = rainIntensity * 0.12 * this.volumes.ocean;
    this.rainGain?.gain.setTargetAtTime(rainLvl, now, 0.2);

    const portFactor = Math.max(0, 1 - distFromPortM / 180);
    this.harborGain?.gain.setTargetAtTime(portFactor * 0.055 * this.volumes.effects, now, 0.25);

    const throttleAbs = Math.abs(throttle);
    this.motorGain.gain.setTargetAtTime(throttleAbs * 0.11 * this.volumes.motor, now, 0.1);
    this.motorOsc?.frequency.setTargetAtTime(58 + throttleAbs * 72, now, 0.1);

    // Procedural footstep cadence
    if (charWalkSpeed > 0.8 && !isUnderwater) {
      this.stepAccum += dt * (charWalkSpeed > 5.0 ? 3.2 : 2.1);
      if (this.stepAccum >= 1) {
        this.stepAccum -= 1;
        this.playStep(charOnWoodPier);
      }
    } else {
      this.stepAccum = 0.6;
    }
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
