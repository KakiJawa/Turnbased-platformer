export type MusicMood = 'none' | 'title' | 'explore' | 'battle' | 'boss';

export type BattleIntensity = 'standard' | 'heated' | 'critical';

export interface PercussionStep {
  kick: boolean;
  snare: boolean;
  hihat: boolean;
}

export function getBattleIntensityFromHpRatio(hpRatio: number): BattleIntensity {
  const clamped = Math.max(0, Math.min(1, hpRatio));
  if (clamped <= 0.3) return 'critical';
  if (clamped <= 0.6) return 'heated';
  return 'standard';
}

export function getBattleIntervalMs(
  mood: MusicMood,
  intensity: BattleIntensity
): number {
  if (mood === 'boss') {
    if (intensity === 'critical') return 108;
    if (intensity === 'heated') return 128;
    return 148;
  }
  if (mood === 'battle') {
    if (intensity === 'critical') return 124;
    if (intensity === 'heated') return 148;
    return 175;
  }
  return 230;
}

export function getPercussionPatternForStep(
  mood: 'battle' | 'boss',
  intensity: BattleIntensity,
  step: number
): PercussionStep {
  const s = ((step % 16) + 16) % 16;

  if (mood === 'battle') {
    if (intensity === 'standard') {
      return {
        kick: s === 0 || s === 8,
        snare: s === 4 || s === 12,
        hihat: false,
      };
    }
    if (intensity === 'heated') {
      return {
        kick: s === 0 || s === 6 || s === 8 || s === 10,
        snare: s === 4 || s === 12,
        hihat: s === 2 || s === 6 || s === 10 || s === 14,
      };
    }
    // critical (<= 30% HP): driving kick, snare fill, rapid off-beat hi-hats
    return {
      kick: s === 0 || s === 3 || s === 6 || s === 8 || s === 10 || s === 14,
      snare: s === 4 || s === 12 || s === 15,
      hihat: s % 2 === 1,
    };
  }

  // Boss patterns
  if (intensity === 'standard') {
    return {
      kick: s === 0 || s === 4 || s === 8 || s === 12,
      snare: s === 2 || s === 6 || s === 10 || s === 14,
      hihat: false,
    };
  }
  if (intensity === 'heated') {
    return {
      kick: s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14,
      snare: s === 4 || s === 12,
      hihat: s === 2 || s === 6 || s === 10 || s === 14 || s === 15,
    };
  }
  // Boss critical (<= 30% HP): relentless double-kick & heavy snare/hi-hat barrage
  return {
    kick: s % 2 === 0,
    snare: s === 4 || s === 12 || s === 13 || s === 15,
    hihat: s % 2 === 1,
  };
}

class ChiptuneAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private mood: MusicMood = 'none';
  private battleIntensity: BattleIntensity = 'standard';
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

  public getBattleIntensity(): BattleIntensity {
    return this.battleIntensity;
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
    if (mood !== 'battle' && mood !== 'boss') {
      this.battleIntensity = 'standard';
    }
    this.step = 0;
    this.stopMusicTimer();
    if (mood !== 'none' && !this.muted && !this.paused) {
      this.startMusicTimer();
    }
  }

  public setBattleEnemyHpRatio(hpRatio: number) {
    const next = getBattleIntensityFromHpRatio(hpRatio);
    if (next === this.battleIntensity) return;
    const prev = this.battleIntensity;
    this.battleIntensity = next;

    if (
      (this.mood === 'battle' || this.mood === 'boss') &&
      !this.muted &&
      !this.paused
    ) {
      // Seamlessly update tempo without resetting current bar step
      this.startMusicTimer();
      // Accentuate escalation into heated/critical phase with a quick drum fill
      if (
        (prev === 'standard' && (next === 'heated' || next === 'critical')) ||
        (prev === 'heated' && next === 'critical')
      ) {
        this.playDrumSnare(next === 'critical' ? 0.045 : 0.032);
        if (next === 'critical') {
          this.tone(587.33, 0.07, 'square', 0.025, 880, 0.05);
        }
      }
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
    const intervalMs = getBattleIntervalMs(this.mood, this.battleIntensity);
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

  private playDrumKick(vol = 0.042) {
    this.tone(118, 0.08, 'triangle', vol, 36);
  }

  private playDrumSnare(vol = 0.026) {
    this.noiseBurst(0.055, vol);
    this.tone(185, 0.045, 'triangle', vol * 0.65, 92);
  }

  private playDrumHiHat(vol = 0.016) {
    this.noiseBurst(0.022, vol);
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
      const intensity = this.battleIntensity;
      const lead = [440, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88, 523.25, 440, 440, 659.25, 587.33, 523.25, 493.88, 440, 392];
      const bass = [110, 110, 146.83, 164.81, 130.81, 130.81, 123.47, 164.81];
      const n = lead[s % lead.length];
      const b = bass[Math.floor(s / 2) % bass.length];

      this.tone(
        n,
        intensity === 'critical' ? 0.095 : 0.11,
        intensity === 'critical' ? 'sawtooth' : 'square',
        intensity === 'standard' ? 0.022 : 0.025
      );
      this.tone(b, 0.12, 'triangle', intensity === 'critical' ? 0.036 : 0.03);

      // Layer urgency harmony at heated / critical HP stages
      if (intensity === 'heated' && s % 2 === 0) {
        this.tone(n * 1.5, 0.08, 'triangle', 0.012);
      } else if (intensity === 'critical') {
        this.tone(n * 1.5, 0.08, 'square', 0.014);
      }

      const drums = getPercussionPatternForStep('battle', intensity, s);
      if (drums.kick) this.playDrumKick(intensity === 'critical' ? 0.05 : 0.038);
      if (drums.snare) this.playDrumSnare(intensity === 'critical' ? 0.034 : 0.024);
      if (drums.hihat) this.playDrumHiHat(intensity === 'critical' ? 0.02 : 0.014);
      return;
    }

    if (this.mood === 'boss') {
      const intensity = this.battleIntensity;
      const lead = [220, 261.63, 311.13, 293.66, 220, 349.23, 329.63, 261.63, 246.94, 293.66, 392, 349.23, 329.63, 311.13, 293.66, 246.94];
      const bass = [82.41, 82.41, 98, 110, 87.31, 87.31, 103.83, 98];
      const n = lead[s % lead.length] * 2;
      const b = bass[s % bass.length];

      this.tone(n, 0.095, 'sawtooth', intensity === 'critical' ? 0.026 : 0.022);
      this.tone(b, 0.105, 'square', intensity === 'critical' ? 0.03 : 0.024);

      if (intensity === 'heated' && s % 2 === 0) {
        this.tone(n * 0.75, 0.08, 'square', 0.012);
      } else if (intensity === 'critical') {
        this.tone(n * 1.5, 0.075, 'square', 0.015);
      }

      const drums = getPercussionPatternForStep('boss', intensity, s);
      if (drums.kick) this.playDrumKick(intensity === 'critical' ? 0.056 : 0.044);
      if (drums.snare) this.playDrumSnare(intensity === 'critical' ? 0.038 : 0.028);
      if (drums.hihat) this.playDrumHiHat(intensity === 'critical' ? 0.024 : 0.016);
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

  public playComboChime(comboCount: number) {
    const step = Math.min(14, Math.max(1, comboCount));
    const baseFreq = 440 * Math.pow(2, step / 12);
    this.tone(baseFreq, 0.065, 'square', 0.045, baseFreq * 1.12);
    if (comboCount >= 3) {
      this.tone(baseFreq * 1.5, 0.09, 'triangle', 0.045, undefined, 0.04);
    }
  }

  public playComboBreak() {
    this.tone(240, 0.08, 'sawtooth', 0.055, 130);
    this.tone(160, 0.12, 'sawtooth', 0.055, 90, 0.06);
  }

  public playEncounter(rarity: 'normal' | 'elite' | 'boss') {
    if (rarity === 'boss') {
      this.noiseBurst(0.24, 0.14);
      this.tone(110, 0.3, 'sawtooth', 0.08, 75);
      const fanfare = [220, 311.13, 293.66, 440, 622.25];
      fanfare.forEach((f, i) =>
        this.tone(f, 0.16, 'sawtooth', 0.06, f * 1.03, i * 0.11)
      );
      return;
    }
    this.noiseBurst(0.11, 0.1);
    const notes =
      rarity === 'elite'
        ? [523.25, 622.25, 783.99, 1046.5, 1244.5]
        : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) =>
      this.tone(f, 0.085, 'square', 0.055, f * 1.06, i * 0.045)
    );
  }
}

export const audio = new ChiptuneAudio();
