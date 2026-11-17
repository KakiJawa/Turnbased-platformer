import {
  BRANCH_META,
  ENEMY_TEMPLATES,
  ENEMY_VARIANTS,
  HERO_BASE_BONUS,
  HERO_GROWTH_PER_LEVEL,
  MATERIAL_META,
  PET_CATALOG,
  SKILL_TREE,
  STAT_LABELS,
  TIER3_SPECIALIZATIONS,
  VILLAGER_BASE_STATS,
  VILLAGER_GROWTH_PER_LEVEL,
  VOID_TOWER_MUTATORS,
} from './data';
import { RARITY_META, RARITY_ORDER } from './palette';
import {
  ActiveBuff,
  Affix,
  ArenaTrialDefinition,
  CombatEnemy,
  ConsumableItem,
  EnemyRarity,
  EnemyVariantId,
  EquipmentItem,
  EquipmentSlot,
  MaterialCounts,
  MaterialId,
  PetDefinition,
  PetEvolutionTier,
  PlayerState,
  Rarity,
  SkillDefinition,
  StatKey,
  Stats,
  Tier3SpecializationId,
  VoidTowerMutator,
} from './types';

export const MAX_EQUIPPED_SKILLS = 6;
export const MAX_TIER1_LEVEL = 20;
export const TIER3_UNLOCK_HERO_LEVEL = 10; // Total Character Lv. 30+ (20 Villager + 10 Hero)
export const MAX_ENCHANT_LEVEL = 10;

let idCounter = 1;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}_${Math.floor(Math.random() * 10000)}`;
}

export function createInitialPlayer(): PlayerState {
  const starterWeapon = generateEquipment('weapon', 'common', 1, 'Wooden Pitchfork');
  const starterArmor = generateEquipment('armor', 'common', 1, 'Linen Shirt');

  return {
    name: 'Pip',
    classTier: 1,
    className: 'Villager',
    level: 1,
    xp: 0,
    skillPoints: 1, // Start with 1 skill point so player can try the Skill Tree early
    unlockedSkillIds: ['phy_t1_slash'],
    equippedSkillIds: ['phy_t1_slash'],
    equippedUltimateId: '',
    skillPresets: [
      { name: 'Preset 1', skillIds: ['phy_t1_slash'], ultimateId: '' },
      { name: 'Preset 2', skillIds: ['phy_t1_slash'], ultimateId: '' },
    ],
    currentHp: VILLAGER_BASE_STATS.hp + 12,
    currentMp: VILLAGER_BASE_STATS.mp,
    ultimateCharge: 0,
    maxStagger: 100,
    currentStagger: 100,
    gold: 60,
    materials: {
      feather: 2,
      hide: 1,
      ironShard: 0,
      orcFang: 0,
      dragonScale: 0,
      starlightOre: 0,
      voidEssence: 0,
    },
    equipment: {
      weapon: starterWeapon,
      armor: starterArmor,
      helm: null,
      charm: null,
    },
    inventory: [],
    consumables: [
      {
        id: 'potion_hp_sm',
        name: 'Apple Cider',
        description: 'Restores 75 HP in battle.',
        kind: 'heal_hp',
        power: 75,
        price: 20,
        quantity: 3,
      },
      {
        id: 'potion_mp_sm',
        name: 'Moonberry Tea',
        description: 'Restores 40 MP in battle.',
        kind: 'heal_mp',
        power: 40,
        price: 25,
        quantity: 2,
      },
    ],
    ownedPetIds: [],
    petLevels: {},
    equippedPetId: null,
    completedArenaIds: [],
    arenaBestTurns: {},
    voidTowerUnlocked: false,
    voidTowerBestFloor: 0,
    highestZone: 1,
    monstersDefeated: 0,
  };
}

export function getTotalCharacterLevel(player: Pick<PlayerState, 'classTier' | 'level'>): number {
  if (player.classTier === 1) return player.level;
  if (player.classTier === 2) return MAX_TIER1_LEVEL + player.level;
  return MAX_TIER1_LEVEL + TIER3_UNLOCK_HERO_LEVEL + player.level;
}

export function getXpToNextLevel(level: number, classTier: 1 | 2 | 3): number {
  if (classTier === 1) {
    // Measured Tier 1 curve Lv 1 -> 20
    return Math.round(58 + level * 30 + Math.pow(level, 1.65) * 8);
  }
  if (classTier === 2) {
    // Tier 2 Hero: steeper midgame curve
    return Math.round(360 + level * 145 + Math.pow(level, 1.95) * 42);
  }
  // Tier 3 Endgame Specialization
  return Math.round(1200 + level * 340 + Math.pow(level, 2.05) * 85);
}

export function canAdvanceClass(player: PlayerState): boolean {
  return player.classTier === 1 && player.level >= MAX_TIER1_LEVEL;
}

export function canAdvanceToTier3(player: PlayerState): boolean {
  return player.classTier === 2 && getTotalCharacterLevel(player) >= 30;
}

export function advanceToHeroClass(player: PlayerState): PlayerState {
  if (!canAdvanceClass(player)) return player;
  const updated: PlayerState = {
    ...player,
    classTier: 2,
    className: 'Vanguard Hero',
    level: 1,
    xp: 0,
    skillPoints: player.skillPoints + 2, // Bonus 2 points on advancement!
  };
  const newStats = computePlayerStats(updated);
  updated.currentHp = newStats.hp;
  updated.currentMp = newStats.mp;
  updated.currentStagger = updated.maxStagger;
  return updated;
}

export function advanceToTier3Class(
  player: PlayerState,
  branch: Tier3SpecializationId
): PlayerState {
  if (!canAdvanceToTier3(player)) return player;
  const spec = TIER3_SPECIALIZATIONS[branch];
  const updated: PlayerState = {
    ...player,
    classTier: 3,
    tier3Branch: branch,
    className: spec.name,
    level: 1,
    xp: 0,
    skillPoints: player.skillPoints + 3,
  };
  const newStats = computePlayerStats(updated);
  updated.currentHp = newStats.hp;
  updated.currentMp = newStats.mp;
  updated.currentStagger = updated.maxStagger;
  return updated;
}

export function grantXp(
  player: PlayerState,
  amount: number
): { player: PlayerState; levelsGained: number } {
  let next = { ...player, xp: player.xp + amount };
  let levelsGained = 0;

  while (true) {
    if (next.classTier === 1 && next.level >= MAX_TIER1_LEVEL) {
      // Cap Tier 1 XP at Lv. 20 until advancing
      next.xp = Math.min(next.xp, getXpToNextLevel(MAX_TIER1_LEVEL, 1));
      break;
    }
    const needed = getXpToNextLevel(next.level, next.classTier);
    if (next.xp < needed) break;
    next.xp -= needed;
    next.level += 1;
    next.skillPoints += 1;
    levelsGained += 1;
  }

  if (levelsGained > 0) {
    const stats = computePlayerStats(next);
    next.currentHp = Math.min(stats.hp, next.currentHp + Math.round(stats.hp * 0.25));
    next.currentMp = Math.min(stats.mp, next.currentMp + Math.round(stats.mp * 0.25));
    next.currentStagger = next.maxStagger;
  }

  return { player: next, levelsGained };
}

export function getFireplaceHealFraction(zone: number): number {
  return zone <= 2 ? 1.0 : 0.65;
}

export function restAtFireplace(
  player: PlayerState,
  zone: number
): { player: PlayerState; hpRecovered: number; mpRecovered: number; fullHeal: boolean } {
  const stats = computePlayerStats(player);
  const frac = getFireplaceHealFraction(zone);
  const nextHp =
    frac >= 1 ? stats.hp : Math.min(stats.hp, player.currentHp + Math.round(stats.hp * frac));
  const nextMp =
    frac >= 1 ? stats.mp : Math.min(stats.mp, player.currentMp + Math.round(stats.mp * frac));
  const updated: PlayerState = {
    ...player,
    currentHp: nextHp,
    currentMp: nextMp,
    currentStagger: player.maxStagger,
  };
  return {
    player: updated,
    hpRecovered: Math.max(0, nextHp - player.currentHp),
    mpRecovered: Math.max(0, nextMp - player.currentMp),
    fullHeal: frac >= 1,
  };
}

export function getEquipmentEffectiveStats(item: EquipmentItem): Partial<Stats> {
  const result: Partial<Stats> = {};
  const keys = new Set<StatKey>([
    ...(Object.keys(item.baseStats) as StatKey[]),
    ...(Object.keys(item.growthPerLevel) as StatKey[]),
  ]);
  for (const k of keys) {
    const base = item.baseStats[k] ?? 0;
    const growth = item.growthPerLevel[k] ?? 0;
    result[k] = Math.round((base + growth * item.level) * 10) / 10;
  }
  for (const affix of item.affixes) {
    result[affix.stat] = Math.round(((result[affix.stat] ?? 0) + affix.value) * 10) / 10;
  }
  return result;
}

export function computePlayerStats(
  player: PlayerState,
  activeBuffs: ActiveBuff[] = []
): Stats {
  const stats: Stats = { ...VILLAGER_BASE_STATS };

  // Level growth: if Tier 1, apply Villager growth for levels gained.
  // If Tier 2/3, keep full Villager base + Hero Base Bonus + Hero growth + Tier 3 specialization!
  const villagerLevels =
    player.classTier === 1 ? player.level - 1 : MAX_TIER1_LEVEL - 1;
  for (const [k, perLv] of Object.entries(VILLAGER_GROWTH_PER_LEVEL)) {
    const key = k as StatKey;
    stats[key] += (perLv ?? 0) * villagerLevels;
  }

  if (player.classTier >= 2) {
    for (const [k, bonus] of Object.entries(HERO_BASE_BONUS)) {
      const key = k as StatKey;
      stats[key] += bonus ?? 0;
    }
    const heroLevels =
      player.classTier === 2
        ? player.level - 1
        : TIER3_UNLOCK_HERO_LEVEL - 1;
    for (const [k, perLv] of Object.entries(HERO_GROWTH_PER_LEVEL)) {
      const key = k as StatKey;
      stats[key] += (perLv ?? 0) * heroLevels;
    }
  }

  if (player.classTier === 3 && player.tier3Branch) {
    const spec = TIER3_SPECIALIZATIONS[player.tier3Branch];
    for (const [k, bonus] of Object.entries(spec.statBonus)) {
      const key = k as StatKey;
      stats[key] += bonus ?? 0;
    }
    const t3Levels = player.level - 1;
    for (const [k, perLv] of Object.entries(spec.growthPerLevel)) {
      const key = k as StatKey;
      stats[key] += (perLv ?? 0) * t3Levels;
    }
  }

  // Equipped Pet Familiar passive stat bonus (scaled with Pet Bond Lv.1-5)
  if (player.equippedPetId) {
    const petLv = getPetLevel(player, player.equippedPetId);
    const effectivePet = getPetEffectiveDefinition(player.equippedPetId, petLv);
    if (effectivePet) {
      for (const [k, val] of Object.entries(effectivePet.statBonus)) {
        const key = k as StatKey;
        stats[key] += val ?? 0;
      }
    }
  }

  // Skill tree stat/passive nodes
  for (const skillId of player.unlockedSkillIds) {
    const node = SKILL_TREE.find((s) => s.id === skillId);
    if (node?.statBonus) {
      for (const [k, val] of Object.entries(node.statBonus)) {
        const key = k as StatKey;
        stats[key] += val ?? 0;
      }
    }
  }

  // 4-slot equipment stats
  for (const slot of ['weapon', 'armor', 'helm', 'charm'] as EquipmentSlot[]) {
    const item = player.equipment[slot];
    if (!item) continue;
    const itemStats = getEquipmentEffectiveStats(item);
    for (const [k, val] of Object.entries(itemStats)) {
      const key = k as StatKey;
      stats[key] += val ?? 0;
    }
  }

  // Active battle buffs / debuffs
  for (const buff of activeBuffs) {
    if (buff.type === 'atk_up') {
      stats.atk = stats.atk * (1 + buff.potency / 100);
      stats.matk = stats.matk * (1 + buff.potency / 100);
    } else if (buff.type === 'def_up') {
      stats.def = stats.def * (1 + buff.potency / 100);
      stats.mdef = stats.mdef * (1 + buff.potency / 100);
    } else if (buff.type === 'spd_up') {
      stats.speed = stats.speed * (1 + buff.potency / 100);
    } else if (buff.type === 'armor_break') {
      stats.def = Math.max(0, stats.def * (1 - buff.potency / 100));
    } else if (buff.type === 'weaken') {
      stats.atk = Math.max(1, stats.atk * (1 - buff.potency / 100));
      stats.matk = Math.max(1, stats.matk * (1 - buff.potency / 100));
    }
  }

  // Round cleanly and clamp percentages
  stats.hp = Math.round(stats.hp);
  stats.mp = Math.round(stats.mp);
  stats.atk = Math.round(stats.atk);
  stats.matk = Math.round(stats.matk);
  stats.def = Math.round(stats.def);
  stats.mdef = Math.round(stats.mdef);
  stats.crit = Math.min(85, Math.round(stats.crit));
  stats.critDmg = Math.round(stats.critDmg);
  stats.block = Math.min(65, Math.round(stats.block));
  stats.dodge = Math.min(60, Math.round(stats.dodge));
  stats.speed = Math.round(stats.speed);

  return stats;
}

export function canUnlockSkill(player: PlayerState, skillId: string): boolean {
  const node = SKILL_TREE.find((s) => s.id === skillId);
  if (!node) return false;
  if (player.unlockedSkillIds.includes(skillId)) return false;
  if (player.skillPoints < node.costPoints) return false;
  if (player.classTier < node.tierRequired) return false;
  return node.prerequisiteIds.every((req) => player.unlockedSkillIds.includes(req));
}

export function unlockSkillNode(player: PlayerState, skillId: string): PlayerState {
  if (!canUnlockSkill(player, skillId)) return player;
  const node = SKILL_TREE.find((s) => s.id === skillId)!;

  let equippedSkillIds = [...player.equippedSkillIds];
  let equippedUltimateId = player.equippedUltimateId;

  if (node.kind === 'active' && equippedSkillIds.length < MAX_EQUIPPED_SKILLS) {
    equippedSkillIds.push(node.id);
  } else if (node.kind === 'ultimate' && !equippedUltimateId) {
    equippedUltimateId = node.id;
  }

  const next: PlayerState = {
    ...player,
    skillPoints: player.skillPoints - node.costPoints,
    unlockedSkillIds: [...player.unlockedSkillIds, skillId],
    equippedSkillIds,
    equippedUltimateId,
  };

  // Clamp HP/MP up if max increased
  const stats = computePlayerStats(next);
  next.currentHp = Math.min(stats.hp, next.currentHp + (node.statBonus?.hp ?? 0));
  next.currentMp = Math.min(stats.mp, next.currentMp + (node.statBonus?.mp ?? 0));
  return next;
}

export function toggleEquipSkill(player: PlayerState, skillId: string): PlayerState {
  const node = SKILL_TREE.find((s) => s.id === skillId);
  if (!node || !player.unlockedSkillIds.includes(skillId)) return player;

  if (node.kind === 'ultimate') {
    return {
      ...player,
      equippedUltimateId: player.equippedUltimateId === skillId ? '' : skillId,
    };
  }
  if (node.kind !== 'active') return player;

  const isEquipped = player.equippedSkillIds.includes(skillId);
  if (isEquipped) {
    return {
      ...player,
      equippedSkillIds: player.equippedSkillIds.filter((id) => id !== skillId),
    };
  }
  if (player.equippedSkillIds.length >= MAX_EQUIPPED_SKILLS) {
    return player; // Loadout full (max 6)
  }
  return {
    ...player,
    equippedSkillIds: [...player.equippedSkillIds, skillId],
  };
}

export function getRespecCost(player: PlayerState): number {
  const extraUnlocked = player.unlockedSkillIds.filter((id) => id !== 'phy_t1_slash').length;
  if (extraUnlocked === 0) return 0;
  return Math.max(30, extraUnlocked * 15);
}

export function respecSkills(player: PlayerState): {
  success: boolean;
  player: PlayerState;
  refundedPoints: number;
  reason?: string;
} {
  const extraIds = player.unlockedSkillIds.filter((id) => id !== 'phy_t1_slash');
  if (extraIds.length === 0) {
    return {
      success: false,
      player,
      refundedPoints: 0,
      reason: 'No unlocked skills to refund yet.',
    };
  }
  const cost = getRespecCost(player);
  if (player.gold < cost) {
    return {
      success: false,
      player,
      refundedPoints: 0,
      reason: `Need ${cost} Gold to respec.`,
    };
  }
  let refundedPoints = 0;
  for (const id of extraIds) {
    const node = SKILL_TREE.find((s) => s.id === id);
    refundedPoints += node?.costPoints ?? 1;
  }
  const next: PlayerState = {
    ...player,
    gold: player.gold - cost,
    skillPoints: player.skillPoints + refundedPoints,
    unlockedSkillIds: ['phy_t1_slash'],
    equippedSkillIds: ['phy_t1_slash'],
    equippedUltimateId: '',
  };
  const stats = computePlayerStats(next);
  next.currentHp = Math.min(stats.hp, next.currentHp);
  next.currentMp = Math.min(stats.mp, next.currentMp);
  return { success: true, player: next, refundedPoints };
}

export function saveSkillPreset(player: PlayerState, slotIndex: number): PlayerState {
  const existing = player.skillPresets ?? [
    { name: 'Preset 1', skillIds: ['phy_t1_slash'], ultimateId: '' },
    { name: 'Preset 2', skillIds: ['phy_t1_slash'], ultimateId: '' },
  ];
  const updated = existing.map((p, idx) =>
    idx === slotIndex
      ? {
          ...p,
          skillIds: [...player.equippedSkillIds],
          ultimateId: player.equippedUltimateId,
        }
      : p
  );
  return { ...player, skillPresets: updated };
}

export function loadSkillPreset(player: PlayerState, slotIndex: number): PlayerState {
  const preset = player.skillPresets?.[slotIndex];
  if (!preset) return player;
  const validSkills = preset.skillIds
    .filter((id) => player.unlockedSkillIds.includes(id))
    .slice(0, MAX_EQUIPPED_SKILLS);
  const validUlt =
    preset.ultimateId && player.unlockedSkillIds.includes(preset.ultimateId)
      ? preset.ultimateId
      : '';
  return {
    ...player,
    equippedSkillIds: validSkills.length > 0 ? validSkills : ['phy_t1_slash'],
    equippedUltimateId: validUlt,
  };
}

export function compareEquipmentStats(
  candidate: EquipmentItem,
  equipped: EquipmentItem | null
): Partial<Record<StatKey, number>> {
  const candStats = getEquipmentEffectiveStats(candidate);
  const eqStats = equipped ? getEquipmentEffectiveStats(equipped) : {};
  const keys = new Set<StatKey>([
    ...(Object.keys(candStats) as StatKey[]),
    ...(Object.keys(eqStats) as StatKey[]),
  ]);
  const diff: Partial<Record<StatKey, number>> = {};
  for (const k of keys) {
    const delta = Math.round(((candStats[k] ?? 0) - (eqStats[k] ?? 0)) * 10) / 10;
    if (delta !== 0) {
      diff[k] = delta;
    }
  }
  return diff;
}

export function bulkDisposeInventory(
  player: PlayerState,
  maxRarity: 'common' | 'uncommon',
  mode: 'sell' | 'salvage'
): {
  player: PlayerState;
  count: number;
  goldGained: number;
  materialsGained: Partial<Record<MaterialId, number>>;
} {
  const maxIdx = RARITY_ORDER.indexOf(maxRarity);
  const kept: EquipmentItem[] = [];
  let count = 0;
  let goldGained = 0;
  const materialsGained: Partial<Record<MaterialId, number>> = {};
  const nextMaterials: MaterialCounts = { ...player.materials };

  const tierMaterialMap: MaterialId[] = [
    'feather',
    'hide',
    'ironShard',
    'orcFang',
    'dragonScale',
    'starlightOre',
    'voidEssence',
  ];

  for (const item of player.inventory) {
    if (!item.locked && RARITY_ORDER.indexOf(item.rarity) <= maxIdx) {
      count += 1;
      if (mode === 'sell') {
        goldGained += item.sellValue;
      } else {
        const matIdx = Math.min(
          tierMaterialMap.length - 1,
          Math.max(0, Math.floor((item.tierLevel - 1) / 1.5))
        );
        const matId = tierMaterialMap[matIdx];
        const amt = item.rarity === 'uncommon' ? 2 : 1;
        nextMaterials[matId] = (nextMaterials[matId] ?? 0) + amt;
        materialsGained[matId] = (materialsGained[matId] ?? 0) + amt;
        goldGained += Math.max(2, Math.floor(item.sellValue * 0.25));
      }
    } else {
      kept.push(item);
    }
  }

  if (count === 0) {
    return { player, count: 0, goldGained: 0, materialsGained: {} };
  }

  return {
    player: {
      ...player,
      gold: player.gold + goldGained,
      materials: nextMaterials,
      inventory: kept,
    },
    count,
    goldGained,
    materialsGained,
  };
}

const SLOT_NAME_PREFIXES: Record<Rarity, string[]> = {
  common: ['Worn', 'Simple', 'Rustic'],
  uncommon: ['Sturdy', 'Hunter', 'Tempered'],
  rare: ['Runed', 'Knightly', 'Arcane'],
  epic: ['Dread', 'Vanguard', 'Stormforged'],
  legendary: ['Royal', 'Dragonbane', 'Solar'],
  mythic: ['Celestial', 'Eternal', 'Primordial'],
};

const SLOT_BASE_NAMES: Record<EquipmentSlot, string[]> = {
  weapon: ['Pitchfork', 'Broadsword', 'Warhammer', 'Greatsword'],
  armor: ['Tunic', 'Brigandine', 'Scaleplate', 'Dragonmail'],
  helm: ['Straw Hat', 'Iron Helm', 'Crested Sallet', 'Crown'],
  charm: ['Boots', 'Greaves', 'Talisman', 'Sigil'],
};

const AFFIX_POOL: { stat: StatKey; min: number; max: number }[] = [
  { stat: 'hp', min: 14, max: 32 },
  { stat: 'mp', min: 6, max: 16 },
  { stat: 'atk', min: 3, max: 9 },
  { stat: 'matk', min: 3, max: 9 },
  { stat: 'def', min: 2, max: 6 },
  { stat: 'mdef', min: 2, max: 6 },
  { stat: 'crit', min: 2, max: 6 },
  { stat: 'critDmg', min: 6, max: 16 },
  { stat: 'block', min: 2, max: 5 },
  { stat: 'dodge', min: 2, max: 5 },
  { stat: 'speed', min: 2, max: 6 },
];

export function rollAffixes(rarity: Rarity, tierLevel: number): Affix[] {
  const count = RARITY_META[rarity].affixCount;
  if (count === 0) return [];
  const scale = 1 + (tierLevel - 1) * 0.45;
  const used = new Set<StatKey>();
  const affixes: Affix[] = [];

  for (let i = 0; i < count; i++) {
    const candidates = AFFIX_POOL.filter((a) => !used.has(a.stat));
    const pick = candidates[Math.floor(Math.random() * candidates.length)] ?? AFFIX_POOL[0];
    used.add(pick.stat);
    const val = Math.max(
      1,
      Math.round(
        (pick.min + Math.random() * (pick.max - pick.min)) *
          scale *
          (0.85 + RARITY_META[rarity].statMult * 0.25)
      )
    );
    affixes.push({
      stat: pick.stat,
      value: val,
      label: `+${val} ${STAT_LABELS[pick.stat]}`,
    });
  }
  return affixes;
}

export function generateEquipment(
  slot: EquipmentSlot,
  rarity: Rarity,
  zoneLevel: number,
  customName?: string
): EquipmentItem {
  const meta = RARITY_META[rarity];
  const zoneScale = 1 + (zoneLevel - 1) * 0.7;
  const baseStats: Partial<Stats> = {};
  const growthPerLevel: Partial<Stats> = {};

  if (slot === 'weapon') {
    baseStats.atk = Math.round(6 * zoneScale * meta.statMult);
    baseStats.matk = Math.round(5 * zoneScale * meta.statMult);
    baseStats.crit = Math.round(2 * meta.statMult);
    growthPerLevel.atk = Math.round(1.8 * zoneScale * meta.growthMult * 10) / 10;
    growthPerLevel.matk = Math.round(1.5 * zoneScale * meta.growthMult * 10) / 10;
  } else if (slot === 'armor') {
    baseStats.hp = Math.round(26 * zoneScale * meta.statMult);
    baseStats.def = Math.round(4 * zoneScale * meta.statMult);
    baseStats.mdef = Math.round(3 * zoneScale * meta.statMult);
    growthPerLevel.hp = Math.round(7 * zoneScale * meta.growthMult);
    growthPerLevel.def = Math.round(1.2 * zoneScale * meta.growthMult * 10) / 10;
  } else if (slot === 'helm') {
    baseStats.hp = Math.round(16 * zoneScale * meta.statMult);
    baseStats.mp = Math.round(8 * zoneScale * meta.statMult);
    baseStats.mdef = Math.round(3 * zoneScale * meta.statMult);
    baseStats.block = Math.round(2 * meta.statMult);
    growthPerLevel.hp = Math.round(4.5 * zoneScale * meta.growthMult);
    growthPerLevel.mp = Math.round(2.5 * zoneScale * meta.growthMult);
  } else {
    baseStats.speed = Math.round(3 * meta.statMult);
    baseStats.dodge = Math.round(2 * meta.statMult);
    baseStats.critDmg = Math.round(8 * meta.statMult);
    growthPerLevel.speed = Math.round(0.8 * meta.growthMult * 10) / 10;
    growthPerLevel.critDmg = Math.round(3 * meta.growthMult);
  }

  const prefixes = SLOT_NAME_PREFIXES[rarity];
  const baseNames = SLOT_BASE_NAMES[slot];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const baseName = baseNames[Math.min(baseNames.length - 1, Math.max(0, zoneLevel - 1))];
  const name = customName ?? `${prefix} ${baseName}`;

  const tierIdx = RARITY_ORDER.indexOf(rarity) + 1;
  return {
    id: nextId('eq'),
    name,
    slot,
    rarity,
    level: 0,
    tierLevel: zoneLevel,
    baseStats,
    growthPerLevel,
    affixes: rollAffixes(rarity, zoneLevel),
    sellValue: Math.round(12 * tierIdx * zoneScale),
  };
}

export function rollRarityForEnemy(
  enemyRarity: EnemyRarity,
  zone = 1,
  rng: () => number = Math.random
): Rarity {
  const r = rng();

  // Zone 1 - 3: strictly Common to Rare
  if (zone <= 3) {
    if (enemyRarity === 'boss') {
      if (r < 0.25) return 'rare';
      if (r < 0.78) return 'uncommon';
      return 'common';
    }
    if (enemyRarity === 'elite') {
      if (r < 0.09) return 'rare';
      if (r < 0.5) return 'uncommon';
      return 'common';
    }
    if (r < 0.015) return 'rare';
    if (r < 0.14) return 'uncommon';
    return 'common';
  }

  // Zone 4 - 6: strictly Uncommon to Epic
  if (zone <= 6) {
    if (enemyRarity === 'boss') {
      if (r < 0.3) return 'epic';
      if (r < 0.8) return 'rare';
      return 'uncommon';
    }
    if (enemyRarity === 'elite') {
      if (r < 0.14) return 'epic';
      if (r < 0.6) return 'rare';
      return 'uncommon';
    }
    if (r < 0.03) return 'epic';
    if (r < 0.28) return 'rare';
    return 'uncommon';
  }

  // Zone 7 - 8: Rare to Mythic
  if (zone <= 8) {
    if (enemyRarity === 'boss') {
      if (r < 0.06) return 'mythic';
      if (r < 0.3) return 'legendary';
      if (r < 0.76) return 'epic';
      return 'rare';
    }
    if (enemyRarity === 'elite') {
      if (r < 0.015) return 'mythic';
      if (r < 0.14) return 'legendary';
      if (r < 0.58) return 'epic';
      return 'rare';
    }
    if (r < 0.035) return 'legendary';
    if (r < 0.32) return 'epic';
    return 'rare';
  }

  // Zone 9 - 10 Endgame: Elevated Mythic & Legendary loot
  if (enemyRarity === 'boss') {
    if (r < 0.19) return 'mythic';
    if (r < 0.58) return 'legendary';
    return 'epic';
  }
  if (enemyRarity === 'elite') {
    if (r < 0.06) return 'mythic';
    if (r < 0.28) return 'legendary';
    return 'epic';
  }
  if (r < 0.1) return 'legendary';
  if (r < 0.5) return 'epic';
  return 'rare';
}

export const MAX_PET_LEVEL = 5;

export function getPetLevel(
  player: Pick<PlayerState, 'petLevels'>,
  petId: string
): number {
  return Math.max(1, Math.min(MAX_PET_LEVEL, player.petLevels?.[petId] ?? 1));
}

export function getPetEvolutionTier(
  pet: PetDefinition,
  level: number
): PetEvolutionTier {
  const clamped = Math.max(1, Math.min(MAX_PET_LEVEL, level));
  let chosen = pet.evolutions[0];
  for (const evo of pet.evolutions) {
    if (clamped >= evo.minLevel) {
      chosen = evo;
    }
  }
  return chosen;
}

export interface EffectivePetDefinition extends PetDefinition {
  level: number;
  evoTitle: string;
  evolutionStage: 1 | 2 | 3;
}

export function getPetEffectiveDefinition(
  petId: string,
  level = 1
): EffectivePetDefinition | undefined {
  const pet = PET_CATALOG.find((p) => p.id === petId);
  if (!pet) return undefined;
  const clamped = Math.max(1, Math.min(MAX_PET_LEVEL, level));
  const evo = getPetEvolutionTier(pet, clamped);
  const statMult = 1 + (clamped - 1) * 0.28;
  const scaledBonus: Partial<Stats> = {};
  for (const [k, v] of Object.entries(pet.statBonus)) {
    const key = k as StatKey;
    scaledBonus[key] = Math.round((v ?? 0) * statMult);
  }
  const scaledPower =
    pet.assistKind === 'heal_shield'
      ? Math.round(pet.assistPower + (clamped - 1) * 1.5)
      : Math.round(pet.assistPower * (1 + (clamped - 1) * 0.22) * 100) / 100;
  const cd = clamped >= 5 && pet.assistEveryTurns === 3 ? 2 : pet.assistEveryTurns;
  const evolutionStage: 1 | 2 | 3 = clamped >= 5 ? 3 : clamped >= 3 ? 2 : 1;

  return {
    ...pet,
    level: clamped,
    name: evo.formName,
    evoTitle: evo.title,
    evolutionStage,
    statBonus: scaledBonus,
    assistEveryTurns: cd,
    assistName: evo.assistName,
    assistDesc: evo.assistDesc,
    assistPower: scaledPower,
  };
}

export function getPetTrainCost(
  petId: string,
  currentLevel: number
): { gold: number; materialId: MaterialId; materialAmount: number } {
  const pet = PET_CATALOG.find((p) => p.id === petId) ?? PET_CATALOG[0];
  const lv = Math.max(1, Math.min(MAX_PET_LEVEL - 1, currentLevel));
  const gold = Math.max(180, Math.round(pet.price * (0.45 + lv * 0.38)));
  let materialId: MaterialId = 'feather';
  let materialAmount = 3;
  if (lv === 1) {
    materialId = petId === 'pet_chick' ? 'feather' : 'hide';
    materialAmount = 3;
  } else if (lv === 2) {
    materialId = petId === 'pet_drake' ? 'orcFang' : 'ironShard';
    materialAmount = 3;
  } else if (lv === 3) {
    materialId = petId === 'pet_wisp' || petId === 'pet_drake' ? 'dragonScale' : 'orcFang';
    materialAmount = 3;
  } else {
    materialId = petId === 'pet_drake' ? 'voidEssence' : 'starlightOre';
    materialAmount = petId === 'pet_drake' ? 2 : 3;
  }
  return { gold, materialId, materialAmount };
}

export function trainPetFamiliar(
  player: PlayerState,
  petId: string
): {
  success: boolean;
  player: PlayerState;
  newLevel: number;
  evolved: boolean;
  reason?: string;
} {
  if (!(player.ownedPetIds ?? []).includes(petId)) {
    return {
      success: false,
      player,
      newLevel: 1,
      evolved: false,
      reason: 'Adopt this companion first.',
    };
  }
  const curLv = getPetLevel(player, petId);
  if (curLv >= MAX_PET_LEVEL) {
    return {
      success: false,
      player,
      newLevel: curLv,
      evolved: false,
      reason: 'Max Bond Lv.5 already reached.',
    };
  }
  const cost = getPetTrainCost(petId, curLv);
  if (player.gold < cost.gold) {
    return {
      success: false,
      player,
      newLevel: curLv,
      evolved: false,
      reason: `Need ${cost.gold} Gold.`,
    };
  }
  if ((player.materials[cost.materialId] ?? 0) < cost.materialAmount) {
    return {
      success: false,
      player,
      newLevel: curLv,
      evolved: false,
      reason: `Need ${cost.materialAmount}x ${MATERIAL_META[cost.materialId].name}.`,
    };
  }

  const prevStats = computePlayerStats(player);
  const nextLv = curLv + 1;
  const next: PlayerState = {
    ...player,
    gold: player.gold - cost.gold,
    materials: {
      ...player.materials,
      [cost.materialId]: (player.materials[cost.materialId] ?? 0) - cost.materialAmount,
    },
    petLevels: {
      ...(player.petLevels ?? {}),
      [petId]: nextLv,
    },
  };
  const newStats = computePlayerStats(next);
  const hpGain = Math.max(0, newStats.hp - prevStats.hp);
  const mpGain = Math.max(0, newStats.mp - prevStats.mp);
  next.currentHp = Math.min(newStats.hp, next.currentHp + hpGain);
  next.currentMp = Math.min(newStats.mp, next.currentMp + mpGain);
  return {
    success: true,
    player: next,
    newLevel: nextLv,
    evolved: nextLv === 3 || nextLv === 5,
  };
}

export function buyPetFamiliar(
  player: PlayerState,
  petId: string
): { success: boolean; player: PlayerState; reason?: string } {
  const pet = PET_CATALOG.find((p) => p.id === petId);
  if (!pet) return { success: false, player, reason: 'Pet not found.' };
  const owned = player.ownedPetIds ?? [];
  if (owned.includes(petId)) {
    return { success: false, player, reason: `${pet.name} is already adopted.` };
  }
  if (player.gold < pet.price) {
    return { success: false, player, reason: `Need ${pet.price} Gold.` };
  }
  const next: PlayerState = {
    ...player,
    gold: player.gold - pet.price,
    ownedPetIds: [...owned, petId],
    petLevels: { ...(player.petLevels ?? {}), [petId]: 1 },
    equippedPetId: petId, // Automatically equip newly adopted pet!
  };
  const stats = computePlayerStats(next);
  next.currentHp = Math.min(stats.hp, next.currentHp + (pet.statBonus.hp ?? 0));
  next.currentMp = Math.min(stats.mp, next.currentMp + (pet.statBonus.mp ?? 0));
  return { success: true, player: next };
}

export function equipPetFamiliar(player: PlayerState, petId: string | null): PlayerState {
  if (petId === null) {
    const next = { ...player, equippedPetId: null };
    const stats = computePlayerStats(next);
    next.currentHp = Math.min(stats.hp, next.currentHp);
    next.currentMp = Math.min(stats.mp, next.currentMp);
    return next;
  }
  if (!(player.ownedPetIds ?? []).includes(petId)) return player;
  const next = { ...player, equippedPetId: petId };
  const stats = computePlayerStats(next);
  next.currentHp = Math.min(stats.hp, next.currentHp);
  next.currentMp = Math.min(stats.mp, next.currentMp);
  return next;
}

export function getEnchantCost(item: EquipmentItem): {
  gold: number;
  materialId: MaterialId;
  materialAmount: number;
} {
  const tierIdx = RARITY_ORDER.indexOf(item.rarity) + 1;
  const highLvlSpike = item.level >= 5 ? (item.level - 4) * 28 : 0;
  const gold = Math.round(
    (36 + item.level * 30 + highLvlSpike) * tierIdx * (1 + (item.tierLevel - 1) * 0.45)
  );
  const materialOrder: MaterialId[] = [
    'feather',
    'hide',
    'ironShard',
    'orcFang',
    'dragonScale',
    'starlightOre',
    'voidEssence',
  ];
  const matIdx = Math.min(
    materialOrder.length - 1,
    Math.max(0, Math.floor((item.tierLevel - 1) / 1.5) + (item.level >= 6 ? 1 : 0))
  );
  return {
    gold,
    materialId: materialOrder[matIdx],
    materialAmount: 1 + Math.floor(item.level * 0.75) + (item.level >= 7 ? 1 : 0),
  };
}

export function getReforgeCost(item: EquipmentItem): {
  gold: number;
  materialId: MaterialId;
  materialAmount: number;
} {
  const tierIdx = RARITY_ORDER.indexOf(item.rarity) + 1;
  const gold = Math.round(55 * tierIdx * (1 + (item.tierLevel - 1) * 0.45));
  const matId: MaterialId =
    item.tierLevel >= 10
      ? 'voidEssence'
      : item.tierLevel >= 9
      ? 'starlightOre'
      : item.tierLevel >= 4
      ? 'dragonScale'
      : item.tierLevel === 3
      ? 'orcFang'
      : item.tierLevel === 2
      ? 'ironShard'
      : 'hide';
  return {
    gold,
    materialId: matId,
    materialAmount: Math.max(1, Math.ceil(tierIdx * 0.75)),
  };
}

export function enchantEquipment(
  item: EquipmentItem,
  gold: number,
  materials: MaterialCounts
): { success: boolean; item: EquipmentItem; gold: number; materials: MaterialCounts; reason?: string } {
  if (item.level >= MAX_ENCHANT_LEVEL) {
    return { success: false, item, gold, materials, reason: 'Max enchant level (+10) reached.' };
  }
  const cost = getEnchantCost(item);
  if (gold < cost.gold) {
    return { success: false, item, gold, materials, reason: `Need ${cost.gold} Gold.` };
  }
  if (materials[cost.materialId] < cost.materialAmount) {
    return {
      success: false,
      item,
      gold,
      materials,
      reason: `Need ${cost.materialAmount}x ${MATERIAL_META[cost.materialId].name}.`,
    };
  }
  return {
    success: true,
    item: { ...item, level: item.level + 1 },
    gold: gold - cost.gold,
    materials: {
      ...materials,
      [cost.materialId]: materials[cost.materialId] - cost.materialAmount,
    },
  };
}

export function reforgeEquipment(
  item: EquipmentItem,
  gold: number,
  materials: MaterialCounts
): { success: boolean; item: EquipmentItem; gold: number; materials: MaterialCounts; reason?: string } {
  if (RARITY_META[item.rarity].affixCount === 0) {
    return { success: false, item, gold, materials, reason: 'Common items have no affixes to reforge.' };
  }
  const cost = getReforgeCost(item);
  if (gold < cost.gold) {
    return { success: false, item, gold, materials, reason: `Need ${cost.gold} Gold.` };
  }
  if (materials[cost.materialId] < cost.materialAmount) {
    return {
      success: false,
      item,
      gold,
      materials,
      reason: `Need ${cost.materialAmount}x ${MATERIAL_META[cost.materialId].name}.`,
    };
  }
  return {
    success: true,
    item: {
      ...item,
      affixes: rollAffixes(item.rarity, item.tierLevel),
    },
    gold: gold - cost.gold,
    materials: {
      ...materials,
      [cost.materialId]: materials[cost.materialId] - cost.materialAmount,
    },
  };
}

export function rollEnemyVariant(
  zone: number,
  rarity: EnemyRarity,
  rng: () => number = Math.random
): EnemyVariantId {
  if (rarity === 'boss') return 'standard';
  if (zone <= 1) return rng() < 0.2 ? 'fierce' : 'standard';
  const r = rng();
  const variantChance = Math.min(0.85, 0.25 + zone * 0.06 + (rarity === 'elite' ? 0.15 : 0));
  if (r > variantChance) return 'standard';
  const earlyPool: EnemyVariantId[] = ['fierce', 'armored', 'swift'];
  const midPool: EnemyVariantId[] = [
    'fierce',
    'armored',
    'swift',
    'vampiric',
    'hexed',
    'thorny',
  ];
  const latePool: EnemyVariantId[] = [
    'fierce',
    'armored',
    'swift',
    'vampiric',
    'hexed',
    'colossal',
    'thorny',
    'twinborn',
    'corrupted',
  ];
  const pool = zone <= 3 ? earlyPool : zone <= 6 ? midPool : latePool;
  return pool[Math.floor(rng() * pool.length)] ?? 'standard';
}

export function spawnEnemyFromTemplate(
  templateId: string,
  levelScale = 0,
  variantId: EnemyVariantId = 'standard',
  xpMult = 1
): CombatEnemy {
  const tpl =
    ENEMY_TEMPLATES.find((e) => e.id === templateId) ?? ENEMY_TEMPLATES[0];
  const variant = ENEMY_VARIANTS[variantId] ?? ENEMY_VARIANTS.standard;
  const mult = 1 + levelScale * 0.12;
  const stats: Stats = {
    hp: Math.round(tpl.baseStats.hp * mult * (variant.hpMult ?? 1)),
    mp: Math.round(tpl.baseStats.mp * mult),
    atk: Math.round(tpl.baseStats.atk * mult * (variant.atkMult ?? 1)),
    matk: Math.round(tpl.baseStats.matk * mult * (variant.matkMult ?? 1)),
    def: Math.round(tpl.baseStats.def * mult * (variant.defMult ?? 1)),
    mdef: Math.round(tpl.baseStats.mdef * mult * (variant.mdefMult ?? 1)),
    crit: Math.min(80, tpl.baseStats.crit + (variant.critBonus ?? 0)),
    critDmg: tpl.baseStats.critDmg,
    block: Math.min(55, tpl.baseStats.block + (variant.blockBonus ?? 0)),
    dodge: Math.min(50, tpl.baseStats.dodge + (variant.dodgeBonus ?? 0)),
    speed: Math.max(5, Math.round(tpl.baseStats.speed * (variant.spdMult ?? 1))),
  };
  const baseGold =
    tpl.goldReward[0] +
    Math.floor(Math.random() * (tpl.goldReward[1] - tpl.goldReward[0] + 1));
  const matAmt =
    tpl.materialDrop.min +
    Math.floor(Math.random() * (tpl.materialDrop.max - tpl.materialDrop.min + 1)) +
    (variant.extraMaterial ?? 0);

  return {
    uid: nextId('en'),
    templateId: tpl.id,
    sprite: tpl.sprite,
    name: variant.prefix ? `${variant.prefix} ${tpl.name}` : tpl.name,
    variantId: variant.id,
    variantPrefix: variant.prefix || undefined,
    variantAccent: variant.accent,
    variantDesc: variant.id === 'standard' ? undefined : variant.shortDesc,
    zone: tpl.zone,
    rarity: tpl.rarity,
    level: tpl.zone * 5 + levelScale,
    stats,
    currentHp: stats.hp,
    currentMp: stats.mp,
    ultimateCharge: 20,
    maxStagger: Math.round(tpl.maxStagger * (variant.maxStaggerMult ?? 1)),
    currentStagger: Math.round(tpl.maxStagger * (variant.maxStaggerMult ?? 1)),
    staggeredTurns: 0,
    animState: 'idle',
    animTimer: 0,
    specialName: tpl.specialName,
    specialMult: tpl.specialMult,
    specialStagger: tpl.specialStagger,
    enragedSpecialName: tpl.enragedSpecialName,
    summonTemplateId: tpl.summonTemplateId,
    bossPhase: 1,
    enraged: false,
    shieldHits: variant.startShieldHits ?? 0,
    summonedOnce: false,
    buffs: [],
    xpReward: Math.max(1, Math.round(tpl.xpReward * (variant.xpMult ?? 1) * xpMult)),
    goldReward: Math.round(baseGold * (variant.goldMult ?? 1)),
    materialDrop: { id: tpl.materialDrop.id, amount: matAmt },
  };
}

export function spawnEnemyWave(
  zone: number,
  encounterRarity: EnemyRarity,
  preferredTemplateId?: string,
  preferredVariant?: EnemyVariantId
): CombatEnemy[] {
  if (encounterRarity === 'boss') {
    const boss = ENEMY_TEMPLATES.find(
      (e) => e.zone === zone && e.rarity === 'boss'
    );
    return [spawnEnemyFromTemplate(boss?.id ?? 'farm_rooster_boss', 0, preferredVariant ?? 'standard')];
  }

  const waveCount = 1 + Math.floor(Math.random() * 3); // 1 - 3 enemies per encounter!
  const zoneNormals = ENEMY_TEMPLATES.filter(
    (e) => e.zone === zone && e.rarity === 'normal'
  );
  const zoneElites = ENEMY_TEMPLATES.filter(
    (e) => e.zone === zone && e.rarity === 'elite'
  );

  const wave: CombatEnemy[] = [];
  for (let i = 0; i < waveCount; i++) {
    const diminishingXp = i === 0 ? 1 : 0.55;
    if (i === 0 && preferredTemplateId) {
      const varId = preferredVariant ?? rollEnemyVariant(zone, encounterRarity);
      wave.push(spawnEnemyFromTemplate(preferredTemplateId, 0, varId, diminishingXp));
    } else if (encounterRarity === 'elite' && i === waveCount - 1 && zoneElites.length > 0) {
      const varId = i === 0 && preferredVariant ? preferredVariant : rollEnemyVariant(zone, 'elite');
      wave.push(spawnEnemyFromTemplate(zoneElites[0].id, 0, varId, diminishingXp));
    } else {
      const pick =
        zoneNormals[Math.floor(Math.random() * zoneNormals.length)] ??
        ENEMY_TEMPLATES[0];
      const varId = i === 0 && preferredVariant ? preferredVariant : rollEnemyVariant(zone, 'normal');
      wave.push(spawnEnemyFromTemplate(pick.id, 0, varId, diminishingXp));
    }
  }
  return wave;
}

export function toggleEquipmentLock(player: PlayerState, itemId: string): PlayerState {
  const nextInv = player.inventory.map((it) =>
    it.id === itemId ? { ...it, locked: !it.locked } : it
  );
  return { ...player, inventory: nextInv };
}

export function spawnArenaBossWave(trial: ArenaTrialDefinition): CombatEnemy[] {
  return trial.bossTemplateIds.map((id, idx) =>
    spawnEnemyFromTemplate(id, 0, trial.variantIds?.[idx] ?? 'standard')
  );
}

export function getVoidTowerMutator(floor: number): VoidTowerMutator {
  const idx = Math.abs(Math.max(1, floor) - 1) % VOID_TOWER_MUTATORS.length;
  return VOID_TOWER_MUTATORS[idx];
}

export function spawnVoidTowerWave(
  floor: number,
  mutator: VoidTowerMutator = getVoidTowerMutator(floor)
): CombatEnemy[] {
  const safeFloor = Math.max(1, Math.floor(floor));
  const isBossFloor = safeFloor % 5 === 0;
  const levelScale = 2 + safeFloor * 2;
  const hpMult = (1 + (safeFloor - 1) * 0.16) * (mutator.id === 'fractured_space' ? 1.2 : 1);
  const dmgMult = 1 + (safeFloor - 1) * 0.12;
  const defMult = 1 + (safeFloor - 1) * 0.08;

  const bossPool = ['citadel_boss', 'peak_dragon_boss', 'star_empress_boss', 'void_architect_boss'];
  const floorPool = ['void_warden', 'star_leviathan', 'void_harbinger', 'star_sentinel', 'void_stalker'];
  const towerVariants: EnemyVariantId[] = [
    'fierce',
    'armored',
    'swift',
    'vampiric',
    'hexed',
    'thorny',
    'colossal',
    'corrupted',
  ];

  const templateIds = isBossFloor
    ? [bossPool[(Math.floor(safeFloor / 5) - 1) % bossPool.length]]
    : [
        floorPool[safeFloor % floorPool.length],
        floorPool[(safeFloor + 2) % floorPool.length],
      ];

  return templateIds.map((tplId, idx) => {
    const varId: EnemyVariantId =
      safeFloor >= 2 && (idx === 0 || isBossFloor)
        ? towerVariants[(safeFloor + idx) % towerVariants.length]
        : 'standard';
    const en = spawnEnemyFromTemplate(tplId, levelScale, varId, idx === 0 ? 1 : 0.55);
    en.zone = 10;
    en.level = 50 + safeFloor * 3;
    en.name = `F${safeFloor} · ${en.name}`;
    en.stats.hp = Math.round(en.stats.hp * hpMult);
    en.currentHp = en.stats.hp;
    en.stats.atk = Math.round(en.stats.atk * dmgMult);
    en.stats.matk = Math.round(en.stats.matk * dmgMult);
    en.stats.def = Math.round(en.stats.def * defMult);
    en.stats.mdef = Math.round(en.stats.mdef * defMult);
    en.xpReward = Math.round(en.xpReward * (1 + safeFloor * 0.15));
    en.goldReward = Math.round(en.goldReward * (1 + safeFloor * 0.2));
    if (mutator.id === 'abyssal_fury') {
      en.buffs = [
        {
          id: `vt_fury_${safeFloor}_${idx}`,
          type: 'atk_up',
          label: 'Abyssal Fury',
          isDebuff: false,
          turns: 99,
          potency: 25,
        },
        {
          id: `vt_spd_${safeFloor}_${idx}`,
          type: 'spd_up',
          label: 'Abyssal Haste',
          isDebuff: false,
          turns: 99,
          potency: 20,
        },
      ];
    }
    if (mutator.id === 'void_barrier' && idx === 0) {
      en.shieldHits = Math.max(en.shieldHits, 2);
    }
    return en;
  });
}

export interface DamageResult {
  damage: number;
  staggerDamage: number;
  isCrit: boolean;
  isBlocked: boolean;
  isDodged: boolean;
}

export function calculateDamage(
  attacker: Stats,
  defender: Stats,
  options: {
    damageType: 'physical' | 'magical';
    powerMult: number;
    staggerPower: number;
    defenderIsStaggered: boolean;
    defenderIsGuarding?: boolean;
    bonusCrit?: number;
    damageMult?: number;
    forceCrit?: boolean;
    allowDodge?: boolean;
    rng?: () => number;
  }
): DamageResult {
  const rand = options.rng ?? Math.random;

  if (options.allowDodge !== false && rand() * 100 < defender.dodge) {
    return {
      damage: 0,
      staggerDamage: 0,
      isCrit: false,
      isBlocked: false,
      isDodged: true,
    };
  }

  const rawOffense =
    options.damageType === 'physical'
      ? attacker.atk * options.powerMult
      : attacker.matk * options.powerMult;
  const rawDefense =
    options.damageType === 'physical' ? defender.def : defender.mdef;

  // Balanced RPG mitigation curve
  const mitigation = 100 / (100 + rawDefense * 1.65);
  let damage = Math.max(1, rawOffense * mitigation);

  const critChance = Math.min(95, attacker.crit + (options.bonusCrit ?? 0));
  const isCrit = options.forceCrit || rand() * 100 < critChance;
  if (isCrit) {
    damage *= attacker.critDmg / 100;
  }

  const isBlocked =
    !options.defenderIsStaggered &&
    (options.defenderIsGuarding || rand() * 100 < defender.block);
  if (isBlocked) {
    damage *= options.defenderIsGuarding ? 0.45 : 0.62;
  }

  if (options.defenderIsStaggered) {
    damage *= 1.5; // Staggered targets take 150% damage!
  }

  if (options.damageMult !== undefined && options.damageMult !== 1) {
    damage *= options.damageMult;
  }

  const staggerDamage = options.defenderIsStaggered
    ? 0
    : Math.max(
        1,
        Math.round(options.staggerPower * (isCrit ? 1.25 : 1) * (isBlocked ? 0.7 : 1))
      );

  return {
    damage: Math.max(1, Math.round(damage)),
    staggerDamage,
    isCrit,
    isBlocked,
    isDodged: false,
  };
}

export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILL_TREE.find((s) => s.id === id);
}

export function getBranchLabel(branch: keyof typeof BRANCH_META): string {
  return BRANCH_META[branch].label;
}
