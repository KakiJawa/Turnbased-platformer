import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './canvasRenderer';

export type WeatherKind =
  | 'pollen'
  | 'leaves'
  | 'rain'
  | 'fireflies'
  | 'embers'
  | 'snow'
  | 'arcane_ash'
  | 'volcanic_storm'
  | 'starfall'
  | 'void_rift';

export type TimeOfDay = 'morning' | 'afternoon' | 'overcast' | 'dusk' | 'night';

export interface WeatherProfile {
  zone: number;
  kind: WeatherKind;
  timeOfDay: TimeOfDay;
  label: string;
  particleCount: number;
  colors: string[];
  baseVx: number;
  baseVy: number;
  swayAmp: number;
  swayFreq: number;
  width: number;
  height: number;
  lightningInterval?: number;
}

export interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  sizeScale: number;
  colorIdx: number;
  layer: 'back' | 'front';
}

export interface DaylightCycleState {
  phaseRatio: number; // 0..1 continuous cycle
  overlayColor: string;
  overlayAlpha: number;
  starAlpha: number;
  sunOffsetY: number;
}

const ZONE_WEATHER_PROFILES: WeatherProfile[] = [
  {
    zone: 1,
    kind: 'pollen',
    timeOfDay: 'morning',
    label: 'Sunlit Pollen',
    particleCount: 28,
    colors: ['#fef08a', '#f7c948', '#ffffff', '#bef264'],
    baseVx: 10,
    baseVy: 5,
    swayAmp: 8,
    swayFreq: 1.4,
    width: 2,
    height: 2,
  },
  {
    zone: 2,
    kind: 'leaves',
    timeOfDay: 'afternoon',
    label: 'Forest Leaves',
    particleCount: 30,
    colors: ['#74c253', '#418a43', '#f28729', '#f7c948'],
    baseVx: -18,
    baseVy: 16,
    swayAmp: 14,
    swayFreq: 2.1,
    width: 3,
    height: 2,
  },
  {
    zone: 3,
    kind: 'rain',
    timeOfDay: 'overcast',
    label: 'Canyon Drizzle',
    particleCount: 54,
    colors: ['#93c5fd', '#bae6fd', '#60a5fa'],
    baseVx: -34,
    baseVy: 165,
    swayAmp: 0,
    swayFreq: 0,
    width: 1,
    height: 5,
  },
  {
    zone: 4,
    kind: 'fireflies',
    timeOfDay: 'dusk',
    label: 'Dusk Fireflies',
    particleCount: 32,
    colors: ['#fde047', '#facc15', '#fb923c', '#fef9c3'],
    baseVx: 4,
    baseVy: -6,
    swayAmp: 16,
    swayFreq: 1.9,
    width: 2,
    height: 2,
  },
  {
    zone: 5,
    kind: 'embers',
    timeOfDay: 'night',
    label: 'Rising Cinders',
    particleCount: 42,
    colors: ['#f28729', '#ef4444', '#facc15', '#fb923c'],
    baseVx: 8,
    baseVy: -28,
    swayAmp: 12,
    swayFreq: 2.5,
    width: 2,
    height: 2,
  },
  {
    zone: 6,
    kind: 'snow',
    timeOfDay: 'overcast',
    label: 'Ridge Flurries',
    particleCount: 48,
    colors: ['#ffffff', '#e0f2fe', '#bae6fd'],
    baseVx: -22,
    baseVy: 34,
    swayAmp: 13,
    swayFreq: 2.2,
    width: 2,
    height: 2,
    lightningInterval: 9.5,
  },
  {
    zone: 7,
    kind: 'arcane_ash',
    timeOfDay: 'night',
    label: 'Arcane Storm',
    particleCount: 46,
    colors: ['#c084fc', '#a855f7', '#e9d5ff', '#94a3b8'],
    baseVx: -14,
    baseVy: -18,
    swayAmp: 15,
    swayFreq: 2.0,
    width: 2,
    height: 2,
    lightningInterval: 7.0,
  },
  {
    zone: 8,
    kind: 'volcanic_storm',
    timeOfDay: 'night',
    label: 'Obsidian Embers',
    particleCount: 60,
    colors: ['#ef4444', '#f7c948', '#f28729', '#7b788a'],
    baseVx: 14,
    baseVy: -36,
    swayAmp: 16,
    swayFreq: 2.8,
    width: 2,
    height: 2,
    lightningInterval: 8.5,
  },
  {
    zone: 9,
    kind: 'starfall',
    timeOfDay: 'night',
    label: 'Starfall Tide',
    particleCount: 58,
    colors: ['#38bdf8', '#7dd3fc', '#c084fc', '#e0f2fe'],
    baseVx: -12,
    baseVy: 48,
    swayAmp: 10,
    swayFreq: 2.0,
    width: 2,
    height: 3,
    lightningInterval: 7.5,
  },
  {
    zone: 10,
    kind: 'void_rift',
    timeOfDay: 'night',
    label: 'Void Anomaly',
    particleCount: 64,
    colors: ['#c084fc', '#f43f5e', '#a855f7', '#ffffff'],
    baseVx: 18,
    baseVy: -42,
    swayAmp: 20,
    swayFreq: 3.4,
    width: 2,
    height: 3,
    lightningInterval: 5.5,
  },
];

export function getZoneWeatherProfile(zone: number): WeatherProfile {
  const idx = Math.min(ZONE_WEATHER_PROFILES.length - 1, Math.max(0, Math.round(zone) - 1));
  return ZONE_WEATHER_PROFILES[idx];
}

export interface WeatherCombatEffect {
  kind: WeatherKind;
  name: string;
  summary: string;
  shortEffect: string;
  tone: 'buff' | 'mixed' | 'hazard';
  accent: string;
  mpRegenPerTurn: number;
  hpRegenPerTurn: number;
  /** Positive = fire resistance (+% reduces fire/burn dmg); Negative = reduced fire resistance (-% increases fire/burn dmg) */
  fireResistDeltaPct: number;
  magicDmgMult: number;
  staggerMult: number;
  critBonus: number;
  critDmgBonus: number;
  dodgeBonus: number;
  mdefMult: number;
  speedMult: number;
}

const WEATHER_COMBAT_EFFECTS: Record<WeatherKind, WeatherCombatEffect> = {
  pollen: {
    kind: 'pollen',
    name: 'Spring Breeze',
    summary: 'Warm sunlit air restores +4 HP/turn and grants +3% CRIT.',
    shortEffect: '+4 HP/t · +3% CRIT',
    tone: 'buff',
    accent: '#facc15',
    mpRegenPerTurn: 0,
    hpRegenPerTurn: 4,
    fireResistDeltaPct: 0,
    magicDmgMult: 1,
    staggerMult: 1,
    critBonus: 3,
    critDmgBonus: 0,
    dodgeBonus: 0,
    mdefMult: 1,
    speedMult: 1,
  },
  leaves: {
    kind: 'leaves',
    name: 'Swift Gale',
    summary: 'Brisk winds grant +5% DODGE and +10% Stagger DMG.',
    shortEffect: '+5% DODGE · +10% STAG',
    tone: 'buff',
    accent: '#4ade80',
    mpRegenPerTurn: 0,
    hpRegenPerTurn: 0,
    fireResistDeltaPct: 0,
    magicDmgMult: 1,
    staggerMult: 1.1,
    critBonus: 0,
    critDmgBonus: 0,
    dodgeBonus: 5,
    mdefMult: 1,
    speedMult: 1,
  },
  rain: {
    kind: 'rain',
    name: 'Rain Mist',
    summary: 'Soothing drizzle boosts MP regen (+5 MP/turn) and grants +15% Fire Res.',
    shortEffect: '+5 MP/t · +15% Fire Res',
    tone: 'buff',
    accent: '#38bdf8',
    mpRegenPerTurn: 5,
    hpRegenPerTurn: 0,
    fireResistDeltaPct: 15,
    magicDmgMult: 1,
    staggerMult: 1,
    critBonus: 0,
    critDmgBonus: 0,
    dodgeBonus: 0,
    mdefMult: 1,
    speedMult: 1,
  },
  fireflies: {
    kind: 'fireflies',
    name: 'Twilight Aura',
    summary: 'Luminous dusk restores +4 MP/turn and adds +10% CRIT DMG.',
    shortEffect: '+4 MP/t · +10% CRIT DMG',
    tone: 'buff',
    accent: '#fde047',
    mpRegenPerTurn: 4,
    hpRegenPerTurn: 0,
    fireResistDeltaPct: 0,
    magicDmgMult: 1,
    staggerMult: 1,
    critBonus: 0,
    critDmgBonus: 10,
    dodgeBonus: 0,
    mdefMult: 1,
    speedMult: 1,
  },
  embers: {
    kind: 'embers',
    name: 'Scorching Heat',
    summary: 'Sweltering heat lowers Fire Res by 15% (+15% Fire/Burn DMG) and boosts Magic DMG +8%.',
    shortEffect: '-15% Fire Res · +8% MAG',
    tone: 'mixed',
    accent: '#fb923c',
    mpRegenPerTurn: 0,
    hpRegenPerTurn: 0,
    fireResistDeltaPct: -15,
    magicDmgMult: 1.08,
    staggerMult: 1,
    critBonus: 0,
    critDmgBonus: 0,
    dodgeBonus: 0,
    mdefMult: 1,
    speedMult: 1,
  },
  snow: {
    kind: 'snow',
    name: 'Biting Frost',
    summary: 'Frigid flurries slow Speed by 8% but heighten Stagger DMG by +12%.',
    shortEffect: '-8% SPD · +12% STAG',
    tone: 'mixed',
    accent: '#bae6fd',
    mpRegenPerTurn: 0,
    hpRegenPerTurn: 0,
    fireResistDeltaPct: 0,
    magicDmgMult: 1,
    staggerMult: 1.12,
    critBonus: 0,
    critDmgBonus: 0,
    dodgeBonus: 0,
    mdefMult: 1,
    speedMult: 0.92,
  },
  arcane_ash: {
    kind: 'arcane_ash',
    name: 'Arcane Surge',
    summary: 'Charged ash grants +6 MP/turn & +10% Magic DMG, but lowers MDEF by 10%.',
    shortEffect: '+6 MP/t · +10% MAG · -10% MDEF',
    tone: 'mixed',
    accent: '#c084fc',
    mpRegenPerTurn: 6,
    hpRegenPerTurn: 0,
    fireResistDeltaPct: 0,
    magicDmgMult: 1.1,
    staggerMult: 1,
    critBonus: 0,
    critDmgBonus: 0,
    dodgeBonus: 0,
    mdefMult: 0.9,
    speedMult: 1,
  },
  volcanic_storm: {
    kind: 'volcanic_storm',
    name: 'Volcanic Heat',
    summary: 'Infernal storm lowers Fire Res by 20% (+20% Fire/Burn DMG) and adds +4% CRIT.',
    shortEffect: '-20% Fire Res · +4% CRIT',
    tone: 'hazard',
    accent: '#ef4444',
    mpRegenPerTurn: 0,
    hpRegenPerTurn: 0,
    fireResistDeltaPct: -20,
    magicDmgMult: 1,
    staggerMult: 1,
    critBonus: 4,
    critDmgBonus: 0,
    dodgeBonus: 0,
    mdefMult: 1,
    speedMult: 1,
  },
  starfall: {
    kind: 'starfall',
    name: 'Starfall Surge',
    summary: 'Cosmic starlight grants +8 MP/turn, +15% Magic DMG & +10% Stagger, but lowers MDEF by 12%.',
    shortEffect: '+8 MP/t · +15% MAG · -12% MDEF',
    tone: 'mixed',
    accent: '#38bdf8',
    mpRegenPerTurn: 8,
    hpRegenPerTurn: 0,
    fireResistDeltaPct: 10,
    magicDmgMult: 1.15,
    staggerMult: 1.1,
    critBonus: 0,
    critDmgBonus: 0,
    dodgeBonus: 0,
    mdefMult: 0.88,
    speedMult: 1,
  },
  void_rift: {
    kind: 'void_rift',
    name: 'Void Singularity',
    summary: 'Reality fracture grants +8% CRIT, +25% CRIT DMG & +18% Stagger, but lowers MDEF by 18%.',
    shortEffect: '+8% CRIT · +25% CDMG · -18% MDEF',
    tone: 'hazard',
    accent: '#c084fc',
    mpRegenPerTurn: 4,
    hpRegenPerTurn: 0,
    fireResistDeltaPct: -10,
    magicDmgMult: 1.1,
    staggerMult: 1.18,
    critBonus: 8,
    critDmgBonus: 25,
    dodgeBonus: 0,
    mdefMult: 0.82,
    speedMult: 1.05,
  },
};

export function getWeatherCombatEffect(zone: number): WeatherCombatEffect {
  const profile = getZoneWeatherProfile(zone);
  return WEATHER_COMBAT_EFFECTS[profile.kind];
}

export function getWeatherFireDamageMultiplier(zone: number): number {
  const fx = getWeatherCombatEffect(zone);
  // -15% Fire Res -> 1.15x Fire/Burn DMG; +15% Fire Res -> 0.85x Fire/Burn DMG
  return Math.max(0.5, 1 - fx.fireResistDeltaPct / 100);
}

export function isFireSkillId(skillId: string): boolean {
  return (
    skillId === 'mag_t1_spark' ||
    skillId === 'mag_t1_ult' ||
    skillId === 'mag_t3_supernova' ||
    skillId === 'all_t2_ult'
  );
}

export function isFireEnemySprite(sprite: string): boolean {
  return sprite === 'magma' || sprite === 'wyvern' || sprite === 'dragon_boss';
}

export function applyWeatherStatModifiers<
  T extends {
    crit: number;
    critDmg: number;
    dodge: number;
    mdef: number;
    speed: number;
  },
>(stats: T, zone: number): T {
  const fx = getWeatherCombatEffect(zone);
  return {
    ...stats,
    crit: Math.min(85, Math.max(0, Math.round(stats.crit + fx.critBonus))),
    critDmg: Math.max(100, Math.round(stats.critDmg + fx.critDmgBonus)),
    dodge: Math.min(60, Math.max(0, Math.round(stats.dodge + fx.dodgeBonus))),
    mdef: Math.max(0, Math.round(stats.mdef * fx.mdefMult)),
    speed: Math.max(1, Math.round(stats.speed * fx.speedMult)),
  };
}

export function getDynamicDaylightCycle(
  elapsedSeconds: number,
  zone: number
): DaylightCycleState {
  const profile = getZoneWeatherProfile(zone);
  // 90-second gentle ambient cycle
  const cycleSeconds = 90;
  const phaseRatio = ((elapsedSeconds % cycleSeconds) + cycleSeconds) % cycleSeconds / cycleSeconds;
  const wave = (Math.sin(phaseRatio * Math.PI * 2 - Math.PI / 2) + 1) * 0.5; // 0..1

  if (profile.timeOfDay === 'morning' || profile.timeOfDay === 'afternoon') {
    // Sunlit day shifting slightly toward warm golden hour then back
    return {
      phaseRatio,
      overlayColor: wave > 0.55 ? '#f59e0b' : '#1e293b',
      overlayAlpha: wave > 0.55 ? (wave - 0.55) * 0.18 : (0.55 - wave) * 0.08,
      starAlpha: Math.max(0, 0.25 - wave * 0.4),
      sunOffsetY: Math.round(wave * 10),
    };
  }

  if (profile.timeOfDay === 'overcast') {
    return {
      phaseRatio,
      overlayColor: '#0f172a',
      overlayAlpha: 0.08 + wave * 0.07,
      starAlpha: 0.12,
      sunOffsetY: 16,
    };
  }

  if (profile.timeOfDay === 'dusk') {
    return {
      phaseRatio,
      overlayColor: '#311042',
      overlayAlpha: 0.08 + wave * 0.1,
      starAlpha: 0.45 + wave * 0.35,
      sunOffsetY: 22,
    };
  }

  return {
    phaseRatio,
    overlayColor: '#0e0b16',
    overlayAlpha: 0.06 + wave * 0.08,
    starAlpha: 0.65 + wave * 0.3,
    sunOffsetY: 30,
  };
}

const MAX_WEATHER_PARTICLES = 64;

const STAR_POSITIONS: ReadonlyArray<{ x: number; y: number; phase: number; big: boolean }> = [
  { x: 34, y: 18, phase: 0.2, big: true },
  { x: 78, y: 31, phase: 1.4, big: false },
  { x: 112, y: 14, phase: 2.3, big: false },
  { x: 164, y: 27, phase: 0.8, big: true },
  { x: 205, y: 16, phase: 3.1, big: false },
  { x: 248, y: 36, phase: 1.9, big: false },
  { x: 296, y: 20, phase: 4.2, big: true },
  { x: 342, y: 29, phase: 2.7, big: false },
  { x: 388, y: 15, phase: 0.5, big: false },
  { x: 432, y: 34, phase: 3.6, big: true },
  { x: 458, y: 19, phase: 1.1, big: false },
];

export class WeatherSystem {
  private particles: WeatherParticle[];
  private activeZone = 0;
  private elapsed = 0;
  private lightningCooldown = 0;
  public lightningAlpha = 0;

  constructor() {
    this.particles = Array.from({ length: MAX_WEATHER_PARTICLES }, (_, i) => ({
      x: (i * 53) % INTERNAL_WIDTH,
      y: (i * 37) % INTERNAL_HEIGHT,
      vx: 0,
      vy: 0,
      phase: i * 0.71,
      sizeScale: i % 3 === 0 ? 1.5 : 1,
      colorIdx: i,
      layer: i % 3 === 0 ? 'front' : 'back',
    }));
    this.syncZone(1);
  }

  public syncZone(zone: number) {
    if (this.activeZone === zone) return;
    this.activeZone = zone;
    const profile = getZoneWeatherProfile(zone);
    this.lightningCooldown = profile.lightningInterval ?? 0;
    this.lightningAlpha = 0;

    for (let i = 0; i < MAX_WEATHER_PARTICLES; i++) {
      const p = this.particles[i];
      // Deterministic pseudo-random spread so SSR/tests are predictable & clean
      const seedA = ((i * 73 + zone * 31) % 100) / 100;
      const seedB = ((i * 41 + zone * 19) % 100) / 100;
      p.x = (seedA * INTERNAL_WIDTH + i * 7) % INTERNAL_WIDTH;
      p.y = (seedB * INTERNAL_HEIGHT + i * 11) % INTERNAL_HEIGHT;
      const speedVar = 0.78 + seedA * 0.48;
      p.vx = profile.baseVx * speedVar;
      p.vy = profile.baseVy * speedVar;
      p.phase = i * 0.85 + seedB * Math.PI * 2;
      p.colorIdx = i % profile.colors.length;
      p.sizeScale = i % 4 === 0 ? 1.5 : 1;
      p.layer = i % 3 === 0 ? 'front' : 'back';
    }
  }

  public update(dt: number, zone: number) {
    this.syncZone(zone);
    const safeDt = Math.min(Math.max(0, dt), 0.1);
    this.elapsed += safeDt;
    const profile = getZoneWeatherProfile(zone);

    if (this.lightningAlpha > 0) {
      this.lightningAlpha = Math.max(0, this.lightningAlpha - safeDt * 2.4);
    }
    if (profile.lightningInterval && profile.lightningInterval > 0) {
      this.lightningCooldown -= safeDt;
      if (this.lightningCooldown <= 0) {
        this.lightningCooldown = profile.lightningInterval;
        this.lightningAlpha = 0.32;
      }
    }

    const count = Math.min(MAX_WEATHER_PARTICLES, profile.particleCount);
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      const sway =
        profile.swayAmp > 0
          ? Math.sin(this.elapsed * profile.swayFreq + p.phase) * profile.swayAmp
          : 0;
      p.x += (p.vx + sway) * safeDt;
      p.y += p.vy * safeDt;

      // Wrap cleanly across screen bounds
      if (p.x < -8) p.x += INTERNAL_WIDTH + 12;
      else if (p.x > INTERNAL_WIDTH + 8) p.x -= INTERNAL_WIDTH + 12;

      if (p.y < -8) p.y += INTERNAL_HEIGHT + 12;
      else if (p.y > INTERNAL_HEIGHT + 8) p.y -= INTERNAL_HEIGHT + 12;
    }
  }

  public getActiveParticles(zone: number): ReadonlyArray<WeatherParticle> {
    this.syncZone(zone);
    const count = Math.min(
      MAX_WEATHER_PARTICLES,
      getZoneWeatherProfile(zone).particleCount
    );
    return this.particles.slice(0, count);
  }

  public renderSkyDecor(
    ctx: CanvasRenderingContext2D,
    zone: number,
    time: number,
    cameraX: number
  ) {
    const profile = getZoneWeatherProfile(zone);
    const cycle = getDynamicDaylightCycle(time, zone);

    // Subtle stepped daylight/twilight tint over sky
    if (cycle.overlayAlpha > 0.005) {
      ctx.save();
      ctx.globalAlpha = cycle.overlayAlpha;
      ctx.fillStyle = cycle.overlayColor;
      ctx.fillRect(0, 0, INTERNAL_WIDTH, 185);
      ctx.restore();
    }

    // Crisp twinkling 16-bit stars at dusk / night
    if (cycle.starAlpha > 0.05) {
      ctx.save();
      for (const st of STAR_POSITIONS) {
        const twinkle = 0.45 + 0.55 * Math.sin(time * 2.6 + st.phase);
        ctx.globalAlpha = Math.max(0.08, Math.min(1, cycle.starAlpha * twinkle));
        const sx = Math.round(((st.x - cameraX * 0.04) % INTERNAL_WIDTH + INTERNAL_WIDTH) % INTERNAL_WIDTH);
        ctx.fillStyle = zone === 7 ? '#e9d5ff' : '#fef9c3';
        ctx.fillRect(sx, st.y, st.big ? 2 : 1, st.big ? 2 : 1);
      }
      ctx.restore();
    }

    // Pixel Sun (Zones 1-2) or Crescent Moon (Zones 4, 7, 8)
    const celestialX = Math.round(396 - (cameraX * 0.03) % 40);
    if (profile.timeOfDay === 'morning' || profile.timeOfDay === 'afternoon') {
      const sunY = 22 + cycle.sunOffsetY;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(celestialX - 3, sunY - 3, 20, 20);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#f7c948';
      ctx.fillRect(celestialX, sunY, 14, 14);
      ctx.fillStyle = '#fef9c3';
      ctx.fillRect(celestialX + 2, sunY + 2, 10, 10);
      ctx.restore();
    } else if (profile.timeOfDay === 'dusk' || profile.timeOfDay === 'night') {
      const moonY = 20;
      ctx.save();
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = zone === 8 ? '#fca5a5' : '#fef08a';
      ctx.fillRect(celestialX, moonY, 12, 12);
      ctx.fillStyle = zone === 8 ? '#160c1c' : zone === 7 ? '#1d1224' : '#2a183b';
      ctx.fillRect(celestialX + 4, moonY + 1, 9, 9);
      ctx.restore();
    }

    // Brief 16-bit storm lightning flash in sky
    if (this.lightningAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.lightningAlpha;
      ctx.fillStyle = zone === 7 ? '#e9d5ff' : '#e0f2fe';
      ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
      ctx.restore();
    }
  }

  public renderParticles(
    ctx: CanvasRenderingContext2D,
    zone: number,
    time: number,
    layer: 'back' | 'front'
  ) {
    this.syncZone(zone);
    const profile = getZoneWeatherProfile(zone);
    const count = Math.min(MAX_WEATHER_PARTICLES, profile.particleCount);

    ctx.save();
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      if (p.layer !== layer) continue;

      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const color = profile.colors[p.colorIdx % profile.colors.length];

      let alpha = layer === 'back' ? 0.48 : 0.85;
      if (profile.kind === 'fireflies' || profile.kind === 'pollen') {
        const pulse = 0.4 + 0.6 * ((Math.sin(time * 3.4 + p.phase) + 1) * 0.5);
        alpha *= pulse;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;

      if (profile.kind === 'rain' || profile.kind === 'starfall') {
        // Crisp 1px slanted streak (drawn as stepped 2px micro-segments for pixel fidelity)
        ctx.fillRect(x, y, 1, 3);
        ctx.fillRect(x - 1, y + 3, 1, 2);
      } else if (profile.kind === 'leaves' || profile.kind === 'void_rift') {
        const w = layer === 'front' ? 3 : 2;
        const h = 2;
        ctx.fillRect(x, y, w, h);
      } else {
        const sz = layer === 'front' && p.sizeScale > 1.2 ? 2 : 1;
        ctx.fillRect(x, y, sz, sz);
      }
    }
    ctx.restore();
  }
}
