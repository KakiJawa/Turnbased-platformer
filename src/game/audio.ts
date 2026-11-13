export type MusicMood = 'none' | 'title' | 'explore' | 'battle' | 'boss';

class ChiptuneAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private mood: MusicMood = 'none';
  private step = 0;
  private timer: number | null = null;
  private paused = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (mute) {
      this.stopMusicTimer();
    } else if (this.mood !== 'none' && !this.paused) {
      this.startMusicTimer();
    }
  }

  public setPaused(p: boolean) {
    this.paused = p;
    if (p) {
      this.stopMusicTimer();
    } else if (!this.muted && this.mood !== 'none') {
      this.startMusicTimer();
    }
  }

  public setMood(mood: MusicMood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this.step = 0;
    this.stopMusicTimer();
    if (mood !== 'none' && !this.muted && !this.paused) {
      this.startMusicTimer();
    }
  }

  private stopMusicTimer() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startMusicTimer() {
    this.stopMusicTimer();
    if (typeof window === 'undefined') return;
    const intervalMs =
      this.mood === 'boss' ? 145 : this.mood === 'battle' ? 175 : 230;
    this.timer = window.setInterval(() => {
      if (this.muted || this.paused) return;
      this.tickMusic();
    }, intervalMs);
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = 'square',
    vol = 0.06,
    slideTo?: number,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    }
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  private noiseBurst(dur: number, vol = 0.08, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const size = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime + delay);
  }

  private tickMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const s = this.step++;

    if (this.mood === 'title') {
      const lead = [392, 0, 493.88, 587.33, 659.25, 0, 587.33, 493.88, 392, 0, 440, 523.25, 587.33, 0, 493.88, 0];
      const bass = [130.81, 130.81, 196, 196, 164.81, 164.81, 146.83, 196];
      const n = lead[s % lead.length];
      const b = bass[Math.floor(s / 2) % bass.length];
      if (n > 0) this.tone(n, 0.16, 'triangle', 0.032);
      if (s % 2 === 0) this.tone(b, 0.22, 'square', 0.016);
      return;
    }

    if (this.mood === 'explore') {
      const lead = [329.63, 392, 440, 523.25, 493.88, 440, 392, 329.63, 293.66, 329.63, 392, 440, 392, 0, 329.63, 0];
      const bass = [130.81, 146.83, 164.81, 196];
      const n = lead[s % lead.length];
      const b = bass[Math.floor(s / 4) % bass.length];
      if (n > 0) this.tone(n, 0.14, 'triangle', 0.028);
      if (s % 4 === 0) this.tone(b, 0.26, 'square', 0.014);
      return;
    }

    if (this.mood === 'battle') {
      const lead = [440, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88, 523.25, 440, 440, 659.25, 587.33, 523.25, 493.88, 440, 392];
      const bass = [110, 110, 146.83, 164.81, 130.81, 130.81, 123.47, 164.81];
      const n = lead[s % lead.length];
      const b = bass[Math.floor(s / 2) % bass.length];
      this.tone(n, 0.11, 'square', 0.022);
      this.tone(b, 0.13, 'triangle', 0.03);
      if (s % 4 === 2) this.noiseBurst(0.04, 0.018);
      return;
    }

    if (this.mood === 'boss') {
      const lead = [220, 261.63, 311.13, 293.66, 220, 349.23, 329.63, 261.63, 246.94, 293.66, 392, 349.23, 329.63, 311.13, 293.66, 246.94];
      const bass = [82.41, 82.41, 98, 110, 87.31, 87.31, 103.83, 98];
      this.tone(lead[s % lead.length] * 2, 0.1, 'sawtooth', 0.022);
      this.tone(bass[s % bass.length], 0.11, 'square', 0.024);
      if (s % 2 === 1) this.noiseBurst(0.045, 0.025);
    }
  }

  public playMenuBlip() {
    this.tone(620 + Math.random() * 50, 0.06, 'square', 0.045, 860);
  }

  public playJump() {
    this.tone(240 + Math.random() * 25, 0.13, 'square', 0.05, 520);
  }

  public playCoin() {
    this.tone(987.77, 0.07, 'square', 0.055);
    this.tone(1318.51, 0.14, 'square', 0.055, undefined, 0.06);
  }

  public playChest() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.13, 'square', 0.055, undefined, i * 0.07)
    );
  }

  public playHit(heavy = false) {
    this.noiseBurst(heavy ? 0.14 : 0.08, heavy ? 0.12 : 0.08);
    this.tone(heavy ? 180 : 250, heavy ? 0.16 : 0.1, 'sawtooth', 0.07, 65);
  }

  public playCrit() {
    this.noiseBurst(0.16, 0.14);
    this.tone(520, 0.08, 'square', 0.08, 980);
    this.tone(220, 0.2, 'sawtooth', 0.09, 60, 0.04);
  }

  public playStaggerBreak() {
    this.noiseBurst(0.22, 0.15);
    [740, 587.33, 440, 293.66].forEach((f, i) =>
      this.tone(f, 0.11, 'sawtooth', 0.07, f * 0.7, i * 0.045)
    );
  }

  public playBlock() {
    this.tone(420, 0.08, 'triangle', 0.08, 210);
    this.tone(680, 0.06, 'square', 0.05, 510, 0.02);
  }

  public playDodge() {
    this.tone(420, 0.09, 'triangle', 0.06, 880);
  }

  public playCounter() {
    this.noiseBurst(0.14, 0.12);
    [523.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.1, 'square', 0.075, f * 1.15, i * 0.04)
    );
  }

  public playQteTick() {
    this.tone(720, 0.03, 'square', 0.03);
  }

  public playQteSuccess() {
    this.tone(659.25, 0.07, 'square', 0.065);
    this.tone(987.77, 0.14, 'square', 0.07, undefined, 0.06);
  }

  public playQteFail() {
    this.tone(220, 0.16, 'sawtooth', 0.07, 110);
  }

  public playHeal() {
    [440, 554.37, 659.25, 880].forEach((f, i) =>
      this.tone(f, 0.11, 'triangle', 0.06, undefined, i * 0.055)
    );
  }

  public playForge() {
    this.noiseBurst(0.06, 0.08);
    this.tone(880, 0.12, 'square', 0.07, 1240);
    this.tone(1174.66, 0.18, 'triangle', 0.06, undefined, 0.1);
  }

  public playLevelUp() {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
      this.tone(f, 0.14, 'square', 0.065, undefined, i * 0.08)
    );
  }

  public playUltimate() {
    this.noiseBurst(0.25, 0.14);
    [220, 330, 440, 660, 880, 1100].forEach((f, i) =>
      this.tone(f, 0.16, 'sawtooth', 0.065, f * 1.25, i * 0.05)
    );
  }

  public playVictory() {
    const notes = [523.25, 523.25, 523.25, 659.25, 783.99, 1046.5];
    const delays = [0, 0.12, 0.24, 0.36, 0.5, 0.68];
    notes.forEach((f, i) => this.tone(f, 0.16, 'square', 0.065, undefined, delays[i]));
  }

  public playDefeat() {
    [392, 349.23, 311.13, 261.63].forEach((f, i) =>
      this.tone(f, 0.22, 'sawtooth', 0.06, f * 0.88, i * 0.16)
    );
  }
}

export const audio = new ChiptuneAudio();
