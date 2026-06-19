// All sound is synthesized at runtime with the Web Audio API. No external assets.

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambienceNodes: AudioNode[] = [];
  private ambienceOn = false;
  private disposed = false;

  private ensure(): AudioContext | null {
    if (this.disposed) return null;
    if (!this.ctx) {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.85;
        this.master.connect(this.ctx.destination);
        this.noiseBuffer = this.makeNoise(this.ctx, 2);
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  // Must be called from a user gesture (autoplay policy).
  resume(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  private makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private env(
    gain: GainNode,
    peak: number,
    attack: number,
    decay: number,
    t = this.now(),
  ) {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // --- Gunshot: filtered noise crack + low thump ---
  gunshot(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t = this.now();

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "highpass";
    bp.frequency.value = 900;
    const g = ctx.createGain();
    this.env(g, 0.5, 0.001, 0.14, t);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.16);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const og = ctx.createGain();
    this.env(og, 0.6, 0.001, 0.16, t);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  dryFire(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = this.now();
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 320;
    const g = ctx.createGain();
    this.env(g, 0.08, 0.001, 0.05, t);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  // --- Thunder: layered low-freq oscillator sweep + rumble noise ---
  thunder(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t = this.now();

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(24, t + 1.6);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 160;
    const g = ctx.createGain();
    this.env(g, 0.55, 0.04, 1.8, t);
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 2.0);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const nlp = ctx.createBiquadFilter();
    nlp.type = "lowpass";
    nlp.frequency.value = 220;
    const ng = ctx.createGain();
    this.env(ng, 0.35, 0.3, 1.9, t);
    src.connect(nlp).connect(ng).connect(this.master);
    src.start(t);
    src.stop(t + 2.2);
  }

  chirp(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = this.now();
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
    const g = ctx.createGain();
    this.env(g, 0.25, 0.005, 0.18, t);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  ammoPickup(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = this.now();
    [440, 587].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = f;
      const g = ctx.createGain();
      this.env(g, 0.12, 0.005, 0.1, t + i * 0.07);
      osc.connect(g).connect(this.master!);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.14);
    });
  }

  keyPickup(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = this.now();
    [523, 659, 784, 1046].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const g = ctx.createGain();
      this.env(g, 0.2, 0.005, 0.22, t + i * 0.08);
      osc.connect(g).connect(this.master!);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.26);
    });
  }

  // --- Jumpscare: harsh low-freq noise burst + dissonant screech ---
  jumpscare(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t = this.now();

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1800, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 1.0);
    const g = ctx.createGain();
    this.env(g, 0.9, 0.001, 1.2, t);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 1.3);

    [311, 415, 466].forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f * 2, t);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.8);
      const og = ctx.createGain();
      this.env(og, 0.25, 0.001, 1.0, t);
      osc.connect(og).connect(this.master!);
      osc.start(t);
      osc.stop(t + 1.1);
    });
  }

  footstep(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t = this.now();
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 350;
    const g = ctx.createGain();
    this.env(g, 0.08, 0.002, 0.08, t);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.1);
  }

  // --- Ambience: dark drone + slow filtered noise wind ---
  startAmbience(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer || this.ambienceOn) return;
    this.ambienceOn = true;
    const t = this.now();

    const drone = ctx.createOscillator();
    drone.type = "sawtooth";
    drone.frequency.value = 42;
    const dlp = ctx.createBiquadFilter();
    dlp.type = "lowpass";
    dlp.frequency.value = 120;
    const dg = ctx.createGain();
    dg.gain.setValueAtTime(0.0001, t);
    dg.gain.exponentialRampToValueAtTime(0.12, t + 3);
    drone.connect(dlp).connect(dg).connect(this.master);
    drone.start(t);

    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const wlp = ctx.createBiquadFilter();
    wlp.type = "bandpass";
    wlp.frequency.value = 380;
    wlp.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.0001, t);
    wg.gain.exponentialRampToValueAtTime(0.05, t + 4);
    // slow LFO on the wind volume for unease
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(wg.gain);
    wind.connect(wlp).connect(wg).connect(this.master);
    wind.start(t);
    lfo.start(t);

    this.ambienceNodes = [drone, wind, lfo, dg, wg];
  }

  stopAmbience(): void {
    if (!this.ctx) return;
    this.ambienceOn = false;
    for (const n of this.ambienceNodes) {
      try {
        (n as OscillatorNode).stop?.();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.ambienceNodes = [];
  }

  dispose(): void {
    this.disposed = true;
    this.stopAmbience();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
