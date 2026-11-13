export type StatKey =
  | 'hp'
  | 'mp'
  | 'atk'
  | 'matk'
  | 'def'
  | 'mdef'
  | 'crit'
  | 'critDmg'
  | 'block'
  | 'dodge'
  | 'speed';

export type Stats = Record<StatKey, number>;

export type EquipmentSlot = 'weapon' | 'armor' | 'helm' | 'charm';

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export interface Affix {
  stat: StatKey;
  value: number;
  label: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: Rarity;
  level: number; // Enchant level (+0 to +10)
  tierLevel: number; // Base item power level (zone scaling)
  baseStats: Partial<Stats>;
  growthPerLevel: Partial<Stats>;
  affixes: Affix[];
  sellValue: number;
}

export interface ConsumableItem {
  id: string;
  name: string;
  description: string;
  kind: 'heal_hp' | 'heal_mp' | 'heal_both' | 'buff_atk' | 'buff_def' | 'stagger_bomb';
  power: number;
  duration?: number;
  price: number;
  quantity: number;
}

export interface MaterialCounts {
  feather: number;
  hide: number;
  ironShard: number;
  orcFang: number;
  dragonScale: number;
}

export type MaterialId = keyof MaterialCounts;

export type SkillBranch =
  | 'physical'
  | 'magical'
  | 'defensive'
  | 'support'
  | 'speed'
  | 'allstat';

export type SkillNodeKind = 'active' | 'ultimate' | 'passive' | 'stat';

export type BuffType =
  | 'atk_up'
  | 'def_up'
  | 'spd_up'
  | 'regen'
  | 'shield'
  | 'burn'
  | 'armor_break'
  | 'weaken';

export interface ActiveBuff {
  id: string;
  type: BuffType;
  label: string;
  isDebuff: boolean;
  turns: number;
  potency: number; // percentage or flat value
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  branch: SkillBranch;
  kind: SkillNodeKind;
  tierRequired: 1 | 2;
  prerequisiteIds: string[];
  costPoints: number;
  // Active / Ultimate properties
  mpCost?: number;
  cooldown?: number; // 1-5 turns for active skills
  damageType?: 'physical' | 'magical' | 'heal' | 'buff' | 'debuff';
  powerMult?: number; // e.g., 1.4 = 140% ATK or MATK
  staggerPower?: number; // stagger damage dealt
  healPercent?: number;
  buffApplied?: {
    target: 'self' | 'enemy';
    type: BuffType;
    label: string;
    isDebuff: boolean;
    turns: number;
    potency: number;
  };
  // Passive / Stat properties
  statBonus?: Partial<Stats>;
  passiveTag?: string;
}

export type ActorAnimState = 'idle' | 'attack' | 'hit' | 'staggered' | 'death';

export type EnemyRarity = 'normal' | 'elite' | 'boss';

export type SpriteId =
  | 'villager'
  | 'hero'
  | 'chicken'
  | 'pig'
  | 'cow'
  | 'rooster_boss'
  | 'wolf'
  | 'bandit'
  | 'golem'
  | 'treant_boss'
  | 'orc'
  | 'orc_shaman'
  | 'war_boar'
  | 'warchief_boss'
  | 'wyvern'
  | 'drake_knight'
  | 'magma'
  | 'dragon_boss';

export interface EnemyTemplate {
  id: string;
  sprite: SpriteId;
  name: string;
  zone: number;
  rarity: EnemyRarity;
  baseStats: Stats;
  maxStagger: number;
  specialName: string;
  specialMult: number;
  specialStagger: number;
  xpReward: number;
  goldReward: [number, number];
  materialDrop: { id: MaterialId; min: number; max: number };
}

export interface CombatEnemy {
  uid: string;
  templateId: string;
  sprite: SpriteId;
  name: string;
  zone: number;
  rarity: EnemyRarity;
  level: number;
  stats: Stats;
  currentHp: number;
  currentMp: number;
  ultimateCharge: number; // 0..100
  maxStagger: number;
  currentStagger: number; // Starts at maxStagger, breaks at 0
  staggeredTurns: number;
  animState: ActorAnimState;
  animTimer: number;
  specialName: string;
  specialMult: number;
  specialStagger: number;
  buffs: ActiveBuff[];
  xpReward: number;
  goldReward: number;
  materialDrop: { id: MaterialId; amount: number };
}

export interface SkillPreset {
  name: string;
  skillIds: string[];
  ultimateId: string;
}

export interface PlayerState {
  name: string;
  classTier: 1 | 2;
  className: string; // 'Villager' | 'Vanguard Hero'
  level: number;
  xp: number;
  skillPoints: number;
  unlockedSkillIds: string[];
  equippedSkillIds: string[]; // Max 6
  equippedUltimateId: string; // Max 1
  skillPresets?: SkillPreset[];
  currentHp: number;
  currentMp: number;
  ultimateCharge: number; // 0..100
  maxStagger: number;
  currentStagger: number;
  gold: number;
  materials: MaterialCounts;
  equipment: Record<EquipmentSlot, EquipmentItem | null>;
  inventory: EquipmentItem[];
  consumables: ConsumableItem[];
  highestZone: number;
  monstersDefeated: number;
}

export interface QteState {
  active: boolean;
  phase: 'dodge' | 'counter';
  promptLabel: string;
  cursor: number; // 0..1
  speed: number;
  direction: 1 | -1;
  zoneStart: number; // 0..1
  zoneEnd: number; // 0..1
  result: 'pending' | 'success' | 'fail';
  resultTimer: number;
  pendingEnemyDamage: number;
  pendingEnemyStagger: number;
  pendingMoveName: string;
}

export interface PlatformRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'ground' | 'wood' | 'stone';
}

export type WorldObjectKind =
  | 'gold'
  | 'material'
  | 'chest'
  | 'fireplace'
  | 'shop'
  | 'enemy'
  | 'portal';

export interface WorldEntity {
  id: string;
  kind: WorldObjectKind;
  x: number;
  y: number;
  w: number;
  h: number;
  collected?: boolean;
  opened?: boolean;
  defeated?: boolean;
  amount?: number;
  materialId?: MaterialId;
  enemyRarity?: EnemyRarity;
  enemySprite?: SpriteId;
  enemyName?: string;
  patrolMinX?: number;
  patrolMaxX?: number;
  vx?: number;
  facing?: 1 | -1;
}

export interface StageDefinition {
  zone: number;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  skyTop: string;
  skyBottom: string;
  groundColor: string;
  grassColor: string;
  platforms: PlatformRect[];
  entities: WorldEntity[];
}

export type GameMode = 'title' | 'explore' | 'battle' | 'paused' | 'victory' | 'gameover';
