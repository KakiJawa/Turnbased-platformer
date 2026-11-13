import {
  BRANCH_META,
  ENEMY_TEMPLATES,
  HERO_BASE_BONUS,
  HERO_GROWTH_PER_LEVEL,
  MATERIAL_META,
  SKILL_TREE,
  STAT_LABELS,
  VILLAGER_BASE_STATS,
  VILLAGER_GROWTH_PER_LEVEL,
} from './data';
import { RARITY_META, RARITY_ORDER } from './palette';
import {
  ActiveBuff,
  Affix,
  CombatEnemy,
  ConsumableItem,
  EnemyRarity,
  EquipmentItem,
  EquipmentSlot,
  MaterialCounts,
  MaterialId,
  PlayerState,
  Rarity,
  SkillDefinition,
  StatKey,
  Stats,
} from './types';

export const MAX_EQUIPPED_SKILLS = 6;
export const MAX_TIER1_LEVEL = 20;
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
    highestZone: 1,
    monstersDefeated: 0,
  };
}

export function getXpToNextLevel(level: number, classTier: 1 | 2): number {
  if (classTier === 1) {
    // Smooth progression from Lv 1 -> 20
    return Math.round(45 + level * 22 + Math.pow(level, 1.55) * 6);
  }
  // Tier 2 Hero: noticeably steeper XP curve than Tier 1 Villager
  return Math.round(280 + level * 110 + Math.pow(level, 1.9) * 32);
}

export function canAdvanceClass(player: PlayerState): boolean {
  return player.classTier === 1 && player.level >= MAX_TIER1_LEVEL;
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
    next.currentHp = stats.hp;
    next.currentMp = stats.mp;
    next.currentStagger = next.maxStagger;
  }

  return { player: next, levelsGained };
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
  // If Tier 2 Hero, keep the full Lv. 20 Villager base + Hero Base Bonus + Hero growth per level!
  const villagerLevels =
    player.classTier === 1 ? player.level - 1 : MAX_TIER1_LEVEL - 1;
  for (const [k, perLv] of Object.entries(VILLAGER_GROWTH_PER_LEVEL)) {
    const key = k as StatKey;
    stats[key] += (perLv ?? 0) * villagerLevels;
  }

  if (player.classTier === 2) {
    for (const [k, bonus] of Object.entries(HERO_BASE_BONUS)) {
      const key = k as StatKey;
      stats[key] += bonus ?? 0;
    }
    const heroLevels = player.level - 1;
    for (const [k, perLv] of Object.entries(HERO_GROWTH_PER_LEVEL)) {
      const key = k as StatKey;
      stats[key] += (perLv ?? 0) * heroLevels;
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
      if (r < 0.3) return 'rare';
      if (r < 0.85) return 'uncommon';
      return 'common';
    }
    if (enemyRarity === 'elite') {
      if (r < 0.12) return 'rare';
      if (r < 0.58) return 'uncommon';
      return 'common';
    }
    if (r < 0.02) return 'rare';
    if (r < 0.16) return 'uncommon';
    return 'common';
  }

  // Zone 4 - 6: strictly Uncommon to Epic
  if (zone <= 6) {
    if (enemyRarity === 'boss') {
      if (r < 0.38) return 'epic';
      if (r < 0.88) return 'rare';
      return 'uncommon';
    }
    if (enemyRarity === 'elite') {
      if (r < 0.18) return 'epic';
      if (r < 0.7) return 'rare';
      return 'uncommon';
    }
    if (r < 0.05) return 'epic';
    if (r < 0.35) return 'rare';
    return 'uncommon';
  }

  // Zone 7+: Rare to Mythic
  if (enemyRarity === 'boss') {
    if (r < 0.08) return 'mythic';
    if (r < 0.35) return 'legendary';
    if (r < 0.8) return 'epic';
    return 'rare';
  }
  if (enemyRarity === 'elite') {
    if (r < 0.02) return 'mythic';
    if (r < 0.18) return 'legendary';
    if (r < 0.65) return 'epic';
    return 'rare';
  }
  if (r < 0.05) return 'legendary';
  if (r < 0.38) return 'epic';
  return 'rare';
}

export function getEnchantCost(item: EquipmentItem): {
  gold: number;
  materialId: MaterialId;
  materialAmount: number;
} {
  const tierIdx = RARITY_ORDER.indexOf(item.rarity) + 1;
  const gold = Math.round((25 + item.level * 20) * tierIdx * (1 + (item.tierLevel - 1) * 0.4));
  const materialOrder: MaterialId[] = [
    'feather',
    'hide',
    'ironShard',
    'orcFang',
    'dragonScale',
  ];
  const matIdx = Math.min(
    materialOrder.length - 1,
    Math.max(0, item.tierLevel - 1 + (item.level >= 5 ? 1 : 0))
  );
  return {
    gold,
    materialId: materialOrder[matIdx],
    materialAmount: 1 + Math.floor(item.level / 2),
  };
}

export function getReforgeCost(item: EquipmentItem): {
  gold: number;
  materialId: MaterialId;
  materialAmount: number;
} {
  const tierIdx = RARITY_ORDER.indexOf(item.rarity) + 1;
  const gold = Math.round(35 * tierIdx * (1 + (item.tierLevel - 1) * 0.4));
  const matId: MaterialId =
    item.tierLevel >= 4
      ? 'dragonScale'
      : item.tierLevel === 3
      ? 'orcFang'
      : item.tierLevel === 2
      ? 'ironShard'
      : 'hide';
  return {
    gold,
    materialId: matId,
    materialAmount: Math.max(1, Math.floor(tierIdx / 2)),
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

export function spawnEnemyFromTemplate(
  templateId: string,
  levelScale = 0
): CombatEnemy {
  const tpl =
    ENEMY_TEMPLATES.find((e) => e.id === templateId) ?? ENEMY_TEMPLATES[0];
  const mult = 1 + levelScale * 0.12;
  const stats: Stats = {
    hp: Math.round(tpl.baseStats.hp * mult),
    mp: Math.round(tpl.baseStats.mp * mult),
    atk: Math.round(tpl.baseStats.atk * mult),
    matk: Math.round(tpl.baseStats.matk * mult),
    def: Math.round(tpl.baseStats.def * mult),
    mdef: Math.round(tpl.baseStats.mdef * mult),
    crit: tpl.baseStats.crit,
    critDmg: tpl.baseStats.critDmg,
    block: tpl.baseStats.block,
    dodge: tpl.baseStats.dodge,
    speed: tpl.baseStats.speed,
  };
  const gold =
    tpl.goldReward[0] +
    Math.floor(Math.random() * (tpl.goldReward[1] - tpl.goldReward[0] + 1));
  const matAmt =
    tpl.materialDrop.min +
    Math.floor(Math.random() * (tpl.materialDrop.max - tpl.materialDrop.min + 1));

  return {
    uid: nextId('en'),
    templateId: tpl.id,
    sprite: tpl.sprite,
    name: tpl.name,
    zone: tpl.zone,
    rarity: tpl.rarity,
    level: tpl.zone * 5 + levelScale,
    stats,
    currentHp: stats.hp,
    currentMp: stats.mp,
    ultimateCharge: 20,
    maxStagger: tpl.maxStagger,
    currentStagger: tpl.maxStagger,
    staggeredTurns: 0,
    animState: 'idle',
    animTimer: 0,
    specialName: tpl.specialName,
    specialMult: tpl.specialMult,
    specialStagger: tpl.specialStagger,
    buffs: [],
    xpReward: tpl.xpReward,
    goldReward: gold,
    materialDrop: { id: tpl.materialDrop.id, amount: matAmt },
  };
}

export function spawnEnemyWave(
  zone: number,
  encounterRarity: EnemyRarity,
  preferredTemplateId?: string
): CombatEnemy[] {
  if (encounterRarity === 'boss') {
    const boss = ENEMY_TEMPLATES.find(
      (e) => e.zone === zone && e.rarity === 'boss'
    );
    return [spawnEnemyFromTemplate(boss?.id ?? 'farm_rooster_boss')];
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
    if (i === 0 && preferredTemplateId) {
      wave.push(spawnEnemyFromTemplate(preferredTemplateId));
    } else if (encounterRarity === 'elite' && i === waveCount - 1 && zoneElites.length > 0) {
      wave.push(spawnEnemyFromTemplate(zoneElites[0].id));
    } else {
      const pick =
        zoneNormals[Math.floor(Math.random() * zoneNormals.length)] ??
        ENEMY_TEMPLATES[0];
      wave.push(spawnEnemyFromTemplate(pick.id));
    }
  }
  return wave;
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
