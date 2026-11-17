import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_EQUIPPED_SKILLS,
  MAX_PET_LEVEL,
  MAX_TIER1_LEVEL,
  TIER3_UNLOCK_HERO_LEVEL,
  advanceToHeroClass,
  advanceToTier3Class,
  bulkDisposeInventory,
  buyPetFamiliar,
  calculateDamage,
  canAdvanceClass,
  canAdvanceToTier3,
  compareEquipmentStats,
  computePlayerStats,
  createInitialPlayer,
  enchantEquipment,
  equipPetFamiliar,
  generateEquipment,
  getPetEffectiveDefinition,
  getPetLevel,
  getRespecCost,
  getTotalCharacterLevel,
  getVoidTowerMutator,
  getXpToNextLevel,
  grantXp,
  loadSkillPreset,
  reforgeEquipment,
  respecSkills,
  restAtFireplace,
  rollRarityForEnemy,
  saveSkillPreset,
  spawnArenaBossWave,
  spawnEnemyFromTemplate,
  spawnEnemyWave,
  spawnVoidTowerWave,
  toggleEquipSkill,
  toggleEquipmentLock,
  trainPetFamiliar,
  unlockSkillNode,
} from './rpgLogic';
import { ARENA_TRIALS, ENEMY_VARIANTS, PET_CATALOG, SKILL_TREE } from './data';
import { EnemyVariantId } from './types';

test('Villager starts at Lv.1, advances to Hero at Lv.20 with steeper XP and higher growth', () => {
  let p = createInitialPlayer();
  assert.equal(p.classTier, 1);
  assert.equal(p.className, 'Villager');
  assert.equal(canAdvanceClass(p), false);

  // Grant enough XP to reach Lv.20
  const lv1Stats = computePlayerStats(p);
  const res = grantXp(p, 50000);
  p = res.player;
  assert.equal(p.level, MAX_TIER1_LEVEL);
  assert.equal(canAdvanceClass(p), true);

  const lv20VillagerStats = computePlayerStats(p);
  assert.ok(lv20VillagerStats.hp > lv1Stats.hp + 200);

  // Advance to Hero
  const hero = advanceToHeroClass(p);
  assert.equal(hero.classTier, 2);
  assert.equal(hero.className, 'Vanguard Hero');
  assert.equal(hero.level, 1);
  assert.ok(hero.skillPoints >= p.skillPoints + 2);

  // Hero Lv.1 XP requirement is harder than Villager Lv.1 XP requirement
  assert.ok(getXpToNextLevel(1, 2) > getXpToNextLevel(1, 1) * 3);

  // Hero level growth is higher than Villager growth
  const heroLv1Stats = computePlayerStats(hero);
  const heroLv2 = grantXp(hero, getXpToNextLevel(1, 2)).player;
  assert.equal(heroLv2.level, 2);
  const heroLv2Stats = computePlayerStats(heroLv2);
  assert.ok(heroLv2Stats.hp - heroLv1Stats.hp >= 28);
  assert.ok(heroLv2Stats.atk - heroLv1Stats.atk >= 5);
});

test('Skill tree unlocks across branches, enforces 6-skill + 1-ultimate loadout cap', () => {
  let p = createInitialPlayer();
  p.skillPoints = 20;

  // Unlock 7 active skills across branches
  const activeToUnlock = [
    'mag_t1_spark',
    'mag_t1_focus',
    'mag_t1_nova',
    'def_t1_brace',
    'def_t1_plate',
    'def_t1_slam',
    'sup_t1_mend',
    'sup_t1_warcry',
    'spd_t1_step',
    'spd_t1_flurry',
  ];
  for (const id of activeToUnlock) {
    p = unlockSkillNode(p, id);
  }
  assert.equal(p.equippedSkillIds.length, MAX_EQUIPPED_SKILLS);

  // Trying to equip a 7th active skill does not exceed 6
  const extraActive = SKILL_TREE.find(
    (s) =>
      s.kind === 'active' &&
      p.unlockedSkillIds.includes(s.id) &&
      !p.equippedSkillIds.includes(s.id)
  );
  assert.ok(extraActive);
  p = toggleEquipSkill(p, extraActive.id);
  assert.equal(p.equippedSkillIds.length, MAX_EQUIPPED_SKILLS);

  // Unlock ultimate and equip it
  p = unlockSkillNode(p, 'mag_t1_ult');
  assert.equal(p.equippedUltimateId, 'mag_t1_ult');
});

test('Tiered equipment Common -> Mythic scales affixes and Blacksmith enchant/reforge works', () => {
  const common = generateEquipment('weapon', 'common', 1);
  const mythic = generateEquipment('weapon', 'mythic', 1);
  assert.equal(common.affixes.length, 0);
  assert.equal(mythic.affixes.length, 5);
  assert.ok((mythic.baseStats.atk ?? 0) > (common.baseStats.atk ?? 0) * 2.5);

  const mats = {
    feather: 10,
    hide: 10,
    ironShard: 5,
    orcFang: 5,
    dragonScale: 5,
    starlightOre: 5,
    voidEssence: 5,
  };
  const ench = enchantEquipment(mythic, 2000, mats);
  assert.equal(ench.success, true);
  assert.equal(ench.item.level, 1);

  const ref = reforgeEquipment(ench.item, ench.gold, ench.materials);
  assert.equal(ref.success, true);
  assert.equal(ref.item.affixes.length, 5);
});

test('Staggered targets take 1.5x damage and wave spawner creates 1-3 enemies', () => {
  const atk = {
    hp: 100, mp: 50, atk: 40, matk: 10, def: 10, mdef: 10,
    crit: 0, critDmg: 150, block: 0, dodge: 0, speed: 15,
  };
  const def = {
    hp: 100, mp: 20, atk: 10, matk: 10, def: 10, mdef: 10,
    crit: 0, critDmg: 150, block: 0, dodge: 0, speed: 10,
  };

  const normalHit = calculateDamage(atk, def, {
    damageType: 'physical',
    powerMult: 1,
    staggerPower: 25,
    defenderIsStaggered: false,
    allowDodge: false,
    rng: () => 0.99,
  });
  const staggeredHit = calculateDamage(atk, def, {
    damageType: 'physical',
    powerMult: 1,
    staggerPower: 25,
    defenderIsStaggered: true,
    allowDodge: false,
    rng: () => 0.99,
  });
  assert.ok(staggeredHit.damage >= Math.floor(normalHit.damage * 1.45));

  for (let i = 0; i < 8; i++) {
    const wave = spawnEnemyWave(1, 'normal');
    assert.ok(wave.length >= 1 && wave.length <= 3);
  }
  const bossWave = spawnEnemyWave(1, 'boss');
  assert.equal(bossWave.length, 1);
  assert.equal(bossWave[0].rarity, 'boss');
});

test('Zone-gated equipment rarity strictly limits Zones 1-3, 4-6, 7-8, and boosts 9-10 Mythics', () => {
  const samples = [0.0, 0.01, 0.05, 0.15, 0.3, 0.5, 0.75, 0.99];
  const enemyRarities: ('normal' | 'elite' | 'boss')[] = ['normal', 'elite', 'boss'];

  for (const zone of [1, 2, 3]) {
    for (const er of enemyRarities) {
      for (const s of samples) {
        const dropped = rollRarityForEnemy(er, zone, () => s);
        assert.ok(
          dropped === 'common' || dropped === 'uncommon' || dropped === 'rare',
          `Zone ${zone} ${er} dropped unexpected ${dropped}`
        );
      }
    }
  }

  for (const zone of [4, 5, 6]) {
    for (const er of enemyRarities) {
      for (const s of samples) {
        const dropped = rollRarityForEnemy(er, zone, () => s);
        assert.ok(
          dropped === 'uncommon' || dropped === 'rare' || dropped === 'epic',
          `Zone ${zone} ${er} dropped unexpected ${dropped}`
        );
      }
    }
  }

  for (const zone of [7, 8]) {
    for (const er of enemyRarities) {
      for (const s of samples) {
        const dropped = rollRarityForEnemy(er, zone, () => s);
        assert.ok(
          dropped === 'rare' || dropped === 'epic' || dropped === 'legendary' || dropped === 'mythic',
          `Zone ${zone} ${er} dropped unexpected ${dropped}`
        );
      }
    }
    assert.equal(rollRarityForEnemy('boss', zone, () => 0.01), 'mythic');
    assert.equal(rollRarityForEnemy('boss', zone, () => 0.15), 'legendary');
  }

  // Zones 9-10 never drop lower than Rare on normals or Epic on bosses/elites
  for (const zone of [9, 10]) {
    assert.equal(rollRarityForEnemy('boss', zone, () => 0.18), 'mythic');
    assert.equal(rollRarityForEnemy('boss', zone, () => 0.55), 'legendary');
    assert.equal(rollRarityForEnemy('normal', zone, () => 0.95), 'rare');
  }
});

test('Side-by-side gear comparison and bulk sell/salvage work accurately', () => {
  const equipped = generateEquipment('weapon', 'common', 1);
  const upgrade = generateEquipment('weapon', 'rare', 2);
  const diff = compareEquipmentStats(upgrade, equipped);
  assert.ok((diff.atk ?? 0) > 0);

  let p = createInitialPlayer();
  const c1 = generateEquipment('armor', 'common', 1);
  const u1 = generateEquipment('helm', 'uncommon', 2);
  const r1 = generateEquipment('weapon', 'rare', 3);
  p.inventory = [c1, u1, r1];

  const sold = bulkDisposeInventory(p, 'uncommon', 'sell');
  assert.equal(sold.count, 2);
  assert.equal(sold.goldGained, c1.sellValue + u1.sellValue);
  assert.equal(sold.player.inventory.length, 1);
  assert.equal(sold.player.inventory[0].id, r1.id);

  const salvaged = bulkDisposeInventory(p, 'uncommon', 'salvage');
  assert.equal(salvaged.count, 2);
  assert.equal(salvaged.player.inventory.length, 1);
  const totalMatsGained = Object.values(salvaged.materialsGained).reduce(
    (acc, n) => acc + (n ?? 0),
    0
  );
  assert.equal(totalMatsGained, 3);
});

test('Skill respec refunds points for gold and loadout presets save/load cleanly', () => {
  let p = createInitialPlayer();
  p.skillPoints = 4;
  p.gold = 200;

  p = unlockSkillNode(p, 'mag_t1_spark');
  p = unlockSkillNode(p, 'mag_t1_focus');
  p = unlockSkillNode(p, 'mag_t1_nova');
  assert.equal(p.skillPoints, 1);

  p = saveSkillPreset(p, 0);
  p = toggleEquipSkill(p, 'mag_t1_spark'); // unequip spark
  assert.equal(p.equippedSkillIds.includes('mag_t1_spark'), false);

  p = loadSkillPreset(p, 0);
  assert.equal(p.equippedSkillIds.includes('mag_t1_spark'), true);

  // Respec with insufficient gold fails
  const broke = respecSkills({ ...p, gold: 5 });
  assert.equal(broke.success, false);

  const cost = getRespecCost(p);
  assert.ok(cost >= 30);
  const res = respecSkills(p);
  assert.equal(res.success, true);
  assert.equal(res.refundedPoints, 3);
  assert.equal(res.player.skillPoints, 4);
  assert.equal(res.player.gold, 200 - cost);
  assert.deepEqual(res.player.unlockedSkillIds, ['phy_t1_slash']);
});

test('Tier 3 Class Specialization unlocks at Total Character Lv. 30+ and boosts stats & skills', () => {
  let p = createInitialPlayer();
  p = grantXp(p, 50000).player;
  let hero = advanceToHeroClass(p);
  assert.equal(getTotalCharacterLevel(hero), 21);
  assert.equal(canAdvanceToTier3(hero), false);

  hero.level = TIER3_UNLOCK_HERO_LEVEL; // Hero Lv.10 => Total Lv.30
  assert.equal(getTotalCharacterLevel(hero), 30);
  assert.equal(canAdvanceToTier3(hero), true);

  const heroStatsBefore = computePlayerStats(hero);
  const spellblade = advanceToTier3Class(hero, 'spellblade');
  assert.equal(spellblade.classTier, 3);
  assert.equal(spellblade.tier3Branch, 'spellblade');
  assert.equal(spellblade.className, 'Astral Spellblade');
  assert.equal(spellblade.skillPoints, hero.skillPoints + 3);

  const t3Stats = computePlayerStats(spellblade);
  assert.ok(t3Stats.matk > heroStatsBefore.matk + 30);
  assert.ok(t3Stats.hp >= heroStatsBefore.hp + 140);
  assert.ok(getXpToNextLevel(1, 3) > getXpToNextLevel(1, 2));
});

test('Pet Familiars can be purchased with gold, equipped, and grant passive stats; Arena spawns boss waves', () => {
  let p = createInitialPlayer();
  const drake = PET_CATALOG.find((pet) => pet.id === 'pet_drake')!;
  const broke = buyPetFamiliar(p, drake.id);
  assert.equal(broke.success, false);

  p.gold = 5000;
  const statsBefore = computePlayerStats(p);
  const adopted = buyPetFamiliar(p, drake.id);
  assert.equal(adopted.success, true);
  assert.equal(adopted.player.gold, 5000 - drake.price);
  assert.equal(adopted.player.equippedPetId, drake.id);
  assert.ok(adopted.player.ownedPetIds.includes(drake.id));

  const statsWithPet = computePlayerStats(adopted.player);
  assert.ok(statsWithPet.atk > statsBefore.atk);
  assert.ok(statsWithPet.matk > statsBefore.matk);

  const unequipped = equipPetFamiliar(adopted.player, null);
  assert.equal(unequipped.equippedPetId, null);
  assert.equal(computePlayerStats(unequipped).atk, statsBefore.atk);

  // Arena trial spawns exact sequence of bosses
  const apex = ARENA_TRIALS.find((t) => t.id === 'arena_apex')!;
  const bossWave = spawnArenaBossWave(apex);
  assert.equal(bossWave.length, apex.bossTemplateIds.length);
  assert.ok(bossWave.every((b) => b.rarity === 'boss'));
});

test('Equipment locking protects items from bulk sell/salvage and Void Tower scales per floor', () => {
  let p = createInitialPlayer();
  const c1 = generateEquipment('armor', 'common', 1);
  const c2 = generateEquipment('helm', 'uncommon', 1);
  p.inventory = [c1, c2];

  // Lock c1; only c2 should be disposed in bulk
  p = toggleEquipmentLock(p, c1.id);
  assert.equal(p.inventory[0].locked, true);

  const sold = bulkDisposeInventory(p, 'uncommon', 'sell');
  assert.equal(sold.count, 1);
  assert.equal(sold.goldGained, c2.sellValue);
  assert.equal(sold.player.inventory.length, 1);
  assert.equal(sold.player.inventory[0].id, c1.id);

  // Unlock c1 and sell it normally
  const unlocked = toggleEquipmentLock(sold.player, c1.id);
  assert.equal(unlocked.inventory[0].locked, false);
  const soldUnlocked = bulkDisposeInventory(unlocked, 'uncommon', 'sell');
  assert.equal(soldUnlocked.count, 1);
  assert.equal(soldUnlocked.player.inventory.length, 0);

  // Void Tower floor scaling & mutators
  const f1Wave = spawnVoidTowerWave(1);
  const f5Wave = spawnVoidTowerWave(5);
  assert.equal(f1Wave.length, 2);
  assert.equal(f5Wave.length, 1);
  assert.equal(f5Wave[0].rarity, 'boss');
  assert.ok(f5Wave[0].stats.hp > f1Wave[0].stats.hp * 1.4);
  const mut1 = getVoidTowerMutator(1);
  const mut2 = getVoidTowerMutator(2);
  assert.notEqual(mut1.id, mut2.id);
});

test('Pet Bond Training evolves Lv.1 -> Lv.3 Awakened -> Lv.5 Apex with stronger stats & shorter CD', () => {
  let p = createInitialPlayer();
  p.gold = 25000;
  p.materials = {
    feather: 50,
    hide: 50,
    ironShard: 50,
    orcFang: 50,
    dragonScale: 50,
    starlightOre: 50,
    voidEssence: 50,
  };
  p = buyPetFamiliar(p, 'pet_chick').player;
  assert.equal(getPetLevel(p, 'pet_chick'), 1);

  const eff1 = getPetEffectiveDefinition('pet_chick', 1)!;
  assert.equal(eff1.evolutionStage, 1);
  assert.equal(eff1.assistEveryTurns, 3);
  const statsLv1 = computePlayerStats(p);

  // Train Lv.1 -> Lv.2 -> Lv.3 (Awakened evolution)
  let t = trainPetFamiliar(p, 'pet_chick');
  assert.equal(t.success, true);
  assert.equal(t.newLevel, 2);
  assert.equal(t.evolved, false);

  t = trainPetFamiliar(t.player, 'pet_chick');
  assert.equal(t.success, true);
  assert.equal(t.newLevel, 3);
  assert.equal(t.evolved, true);
  const eff3 = getPetEffectiveDefinition('pet_chick', 3)!;
  assert.equal(eff3.evolutionStage, 2);
  assert.notEqual(eff3.name, eff1.name);

  // Train Lv.3 -> Lv.4 -> Lv.5 (Apex evolution reduces 3t -> 2t CD!)
  t = trainPetFamiliar(t.player, 'pet_chick');
  t = trainPetFamiliar(t.player, 'pet_chick');
  assert.equal(t.newLevel, MAX_PET_LEVEL);
  assert.equal(t.evolved, true);
  const eff5 = getPetEffectiveDefinition('pet_chick', 5)!;
  assert.equal(eff5.evolutionStage, 3);
  assert.equal(eff5.assistEveryTurns, 2);

  const statsLv5 = computePlayerStats(t.player);
  assert.ok(statsLv5.hp > statsLv1.hp);
  assert.ok(statsLv5.crit > statsLv1.crit);

  // Capped at Lv.5
  const capped = trainPetFamiliar(t.player, 'pet_chick');
  assert.equal(capped.success, false);
});

test('All 9 non-elemental Enemy Variants mutate stats & rewards without elemental affinities', () => {
  const variantIds: EnemyVariantId[] = [
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
  const base = spawnEnemyFromTemplate('orc_warrior', 0, 'standard');
  for (const vid of variantIds) {
    const meta = ENEMY_VARIANTS[vid];
    assert.ok(meta, `Missing variant meta for ${vid}`);
    assert.equal('element' in meta, false);
    const vEnemy = spawnEnemyFromTemplate('orc_warrior', 0, vid);
    assert.equal(vEnemy.variantId, vid);
    assert.ok(vEnemy.name.startsWith(meta.prefix));
    assert.ok(vEnemy.xpReward >= base.xpReward);
    if (vid === 'armored') {
      assert.ok(vEnemy.stats.def > base.stats.def);
      assert.ok(vEnemy.shieldHits >= 2);
    } else if (vid === 'colossal') {
      assert.ok(vEnemy.stats.hp > base.stats.hp * 1.4);
      assert.ok(vEnemy.maxStagger > base.maxStagger * 1.3);
    } else if (vid === 'swift') {
      assert.ok(vEnemy.stats.speed > base.stats.speed);
      assert.ok(vEnemy.stats.dodge > base.stats.dodge);
    }
  }
});

test('Part A: Expanded 7 Arena Trials, scaled Fireplace healing, +25% level-up heal, and diminishing wave XP', () => {
  assert.ok(ARENA_TRIALS.length >= 7);
  for (const t of ARENA_TRIALS) {
    assert.ok(t.parTurns > 0);
  }
  const noPotTrial = ARENA_TRIALS.find((t) => t.id === 'arena_no_pot')!;
  assert.equal(noPotTrial.noConsumables, true);
  const noPotWave = spawnArenaBossWave(noPotTrial);
  assert.equal(noPotWave.length, noPotTrial.bossTemplateIds.length);
  assert.ok(noPotWave.some((e) => e.variantId !== 'standard'));

  // Fireplace Z1-2 = 100% heal, Z3+ = 65% heal
  const wounded = createInitialPlayer();
  wounded.currentHp = 10;
  wounded.currentMp = 0;
  const z1Rest = restAtFireplace(wounded, 1);
  assert.equal(z1Rest.fullHeal, true);
  assert.equal(z1Rest.player.currentHp, computePlayerStats(wounded).hp);

  const z4Rest = restAtFireplace(wounded, 4);
  assert.equal(z4Rest.fullHeal, false);
  assert.ok(z4Rest.player.currentHp < computePlayerStats(wounded).hp);
  assert.ok(z4Rest.player.currentHp > 10);

  // Level-up heals +25% Max HP instead of 100%
  const lowHero = createInitialPlayer();
  lowHero.currentHp = 10;
  const lvlRes = grantXp(lowHero, getXpToNextLevel(1, 1));
  assert.equal(lvlRes.levelsGained, 1);
  const maxAfterLvl = computePlayerStats(lvlRes.player).hp;
  assert.ok(lvlRes.player.currentHp < maxAfterLvl, 'Level up should not full heal to 100%');
  assert.ok(lvlRes.player.currentHp >= 10 + Math.round(maxAfterLvl * 0.2));

  // Diminishing wave XP for secondary slots (55%)
  const single = spawnEnemyFromTemplate('orc_warrior', 0, 'standard', 1);
  const secondary = spawnEnemyFromTemplate('orc_warrior', 0, 'standard', 0.55);
  assert.ok(secondary.xpReward < single.xpReward);
});
