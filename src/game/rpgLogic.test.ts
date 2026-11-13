import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_EQUIPPED_SKILLS,
  MAX_TIER1_LEVEL,
  advanceToHeroClass,
  calculateDamage,
  canAdvanceClass,
  computePlayerStats,
  createInitialPlayer,
  enchantEquipment,
  generateEquipment,
  getXpToNextLevel,
  grantXp,
  reforgeEquipment,
  rollRarityForEnemy,
  spawnEnemyWave,
  toggleEquipSkill,
  unlockSkillNode,
} from './rpgLogic';
import { SKILL_TREE } from './data';

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

  const mats = { feather: 10, hide: 10, ironShard: 5, orcFang: 5, dragonScale: 5 };
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

test('Zone-gated equipment rarity strictly limits Zones 1-3 to Common-Rare, 4-6 to Uncommon-Epic, 7-8 to Rare-Mythic', () => {
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
});
