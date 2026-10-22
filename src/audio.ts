export type SoundEvent = 'step' | 'push' | 'goal' | 'ungoal' | 'win' | 'click' | 'achievement';

type SafariWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** Original, entirely synthesized audio. Nothing is loaded or started before a gesture. */
export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private effectsBus?: GainNode;
  private musicEnabled = true;
  private effectsEnabled = true;
  private muted = false;
  private paused = false;
  private destroyed = false;
  private timer?: ReturnType<typeof setInterval>;
  private nextNote = 0;
  private beat = 0;
  private effortCount = 0;
  private readonly melody = [72, 76, 79, 76, 71, 74, 79, 74, 69, 72, 76, 72, 67, 71, 74, 71];
  private readonly roots = [48, 47, 45, 43];
  private readonly visibility = (): void => {
    if (!this.context || this.destroyed) return;
    if (document.hidden) {
      void this.context.suspend().catch(() => undefined);
    } else if (!this.paused) {
      void this.context.resume().then(() => { this.nextNote = this.context?.currentTime ?? 0; }).catch(() => undefined);
    }
  };

  async unlock(): Promise<void> {
    if (this.destroyed || typeof window === 'undefined') return;
    try {
      if (!this.context) {
        const Context = window.AudioContext ?? (window as SafariWindow).webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.master = this.context.createGain();
        this.musicBus = this.context.createGain();
        this.effectsBus = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.65;
        this.musicBus.gain.value = this.musicEnabled ? 0.2 : 0;
        this.effectsBus.gain.value = this.effectsEnabled ? 0.45 : 0;
        this.musicBus.connect(this.master);
        this.effectsBus.connect(this.master);
        this.master.connect(this.context.destination);
        document.addEventListener('visibilitychange', this.visibility);
        this.timer = setInterval(() => this.scheduleMusic(), 250);
      }
      if (!this.paused && !document.hidden && this.context.state === 'suspended') await this.context.resume();
      // A brief silent oscillator also unlocks older iOS Web Audio implementations.
      const oscillator = this.context.createOscillator();
      const silence = this.context.createGain();
      silence.gain.value = 0;
      oscillator.connect(silence);
      silence.connect(this.context.destination);
      oscillator.onended = () => { oscillator.disconnect(); silence.disconnect(); };
      oscillator.start();
      oscillator.stop(this.context.currentTime + 0.01);
      if (this.nextNote <= this.context.currentTime) this.nextNote = this.context.currentTime + 0.1;
      this.scheduleMusic();
    } catch {
      // Autoplay rejection, unavailable audio devices and denied permissions are non-fatal.
    }
  }

  private setGain(node: GainNode | undefined, value: number): void {
    if (!node || !this.context || this.context.state === 'closed') return;
    node.gain.cancelScheduledValues(this.context.currentTime);
    node.gain.setTargetAtTime(value, this.context.currentTime, 0.04);
  }

  setMusic(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.setGain(this.musicBus, enabled ? 0.2 : 0);
    if (enabled && this.context) this.nextNote = this.context.currentTime + 0.1;
  }

  setEffects(enabled: boolean): void {
    this.effectsEnabled = enabled;
    this.setGain(this.effectsBus, enabled ? 0.45 : 0);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.setGain(this.master, muted ? 0 : 0.65);
    if (!muted && this.context) this.nextNote = this.context.currentTime + 0.1;
  }

  private tone(frequency: number, start: number, duration: number, volume: number, bus: GainNode, type: OscillatorType = 'sine', endFrequency?: number): void {
    const context = this.context;
    if (!context || context.state === 'closed') return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    const attack = Math.min(0.025, duration * 0.2);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.025);
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (!context || !this.musicBus || context.state !== 'running' || !this.musicEnabled || this.muted || this.paused || document.hidden) return;
    if (this.nextNote < context.currentTime) this.nextNote = context.currentTime + 0.05;
    // A sparse, original Cmaj7 / G / Am7 / G phrase, with long gaps between notes.
    while (this.nextNote < context.currentTime + 0.6) {
      const midi = this.melody[this.beat % this.melody.length]!;
      const root = this.roots[Math.floor(this.beat / 4) % this.roots.length]!;
      const frequency = (note: number): number => 440 * 2 ** ((note - 69) / 12);
      this.tone(frequency(midi), this.nextNote, 2.5, 0.14, this.musicBus);
      this.tone(frequency(midi + 12), this.nextNote, 1.5, 0.018, this.musicBus);
      if (this.beat % 4 === 0) {
        this.tone(frequency(root), this.nextNote, 5.8, 0.09, this.musicBus);
        this.tone(frequency(root + 7), this.nextNote + 0.09, 5.3, 0.035, this.musicBus);
      }
      this.beat++;
      this.nextNote += 1.8;
    }
  }

  private effort(start: number, bus: GainNode): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    // A short voiced breath: a glottal source through two vowel-like resonances.
    // It is entirely synthesized, with no speech or recorded human voice.
    const source = context.createOscillator();
    const lowFormant = context.createBiquadFilter();
    const highFormant = context.createBiquadFilter();
    const envelope = context.createGain();
    const pitch = [116, 121, 111, 118][this.effortCount++ % 4]!;
    source.type = 'sawtooth';
    source.frequency.setValueAtTime(pitch, start);
    source.frequency.linearRampToValueAtTime(pitch * 1.075, start + .035);
    source.frequency.exponentialRampToValueAtTime(pitch * .74, start + .19);
    lowFormant.type = 'bandpass';
    lowFormant.frequency.setValueAtTime(510, start);
    lowFormant.frequency.linearRampToValueAtTime(410, start + .19);
    lowFormant.Q.value = 1.1;
    highFormant.type = 'bandpass';
    highFormant.frequency.setValueAtTime(1120, start);
    highFormant.frequency.linearRampToValueAtTime(930, start + .19);
    highFormant.Q.value = 1.6;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(.145, start + .025);
    envelope.gain.linearRampToValueAtTime(.09, start + .09);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + .21);
    source.connect(lowFormant); source.connect(highFormant);
    lowFormant.connect(envelope); highFormant.connect(envelope); envelope.connect(bus);
    source.onended = () => { source.disconnect(); lowFormant.disconnect(); highFormant.disconnect(); envelope.disconnect(); };
    source.start(start); source.stop(start + .23);
  }

  play(event: SoundEvent): void {
    const context = this.context;
    const bus = this.effectsBus;
    if (!context || !bus || context.state !== 'running' || !this.effectsEnabled || this.muted || this.paused || document.hidden || this.destroyed) return;
    const now = context.currentTime;
    if (event === 'push' || event === 'goal' || event === 'ungoal') this.effort(now, bus);
    switch (event) {
      case 'step': this.tone(185, now, 0.055, 0.095, bus, 'sine', 125); break;
      case 'push':
        this.tone(110, now, 0.13, 0.15, bus, 'triangle', 68);
        this.tone(235, now + 0.015, 0.055, 0.035, bus);
        break;
      case 'goal':
        this.tone(523.25, now, 0.24, 0.17, bus);
        this.tone(783.99, now + 0.065, 0.36, 0.13, bus);
        this.tone(1046.5, now + 0.12, 0.4, 0.055, bus);
        break;
      case 'ungoal': this.tone(440, now, 0.19, 0.08, bus, 'sine', 329.63); break;
      case 'click': this.tone(660, now, 0.045, 0.065, bus, 'sine', 880); break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => this.tone(note, now + index * 0.12, 0.75, 0.14, bus));
        this.tone(261.63, now + 0.36, 1.2, 0.09, bus);
        break;
      case 'achievement':
        [659.25, 880, 1318.51].forEach((note, index) => this.tone(note, now + index * 0.09, 0.55, 0.1, bus));
        break;
    }
  }

  suspend(): void {
    this.paused = true;
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined);
  }

  resume(): void {
    this.paused = false;
    if (!this.context || this.destroyed || document.hidden) return;
    this.nextNote = this.context.currentTime + 0.1;
    if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer) clearInterval(this.timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibility);
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined);
    this.context = undefined;
  }
}
