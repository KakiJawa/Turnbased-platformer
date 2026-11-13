import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canUseComboFinisher,
  canUseStaggerExecute,
  createBattleState,
  executePlayerAction,
  getActiveEnemy,
  getComboBonuses,
  resolveQteInput,
  stepBattleTimeline,
} from './battleEngine';
import { createInitialPlayer, spawnEnemyFromTemplate } from './rpgLogic';
import { buildStage } from './stages';
import { createPlatformerPlayer, stepPlatformer } from './platformer';

test('Stagger break reduces stagger to 0 and enters staggered state', () => {
  const player = createInitialPlayer();
  const enemy = spawnEnemyFromTemplate('farm_chicken');
  enemy.currentStagger = 15; // Low stagger so next strike breaks it
  const battle = createBattleState(1, 'normal', 'z1_en_1', [enemy]);

  executePlayerAction(battle, player, { kind: 'attack' });
  if (enemy.currentHp > 0) {
    assert.equal(enemy.currentStagger, 0);
    assert.ok(enemy.staggeredTurns > 0);
    assert.equal(enemy.animState, 'staggered');
  }
});

test('Dodge QTE success transitions to Counter Attack QTE and deals counter strike', () => {
  const player = createInitialPlayer();
  const enemy = spawnEnemyFromTemplate('farm_pig');
  const battle = createBattleState(1, 'normal', 'z1_en_1', [enemy]);

  // Simulate dodge QTE with cursor inside green zone
  battle.phase = 'qte_dodge';
  battle.qte = {
    active: true,
    phase: 'dodge',
    promptLabel: 'DODGE!',
    cursor: 0.5,
    speed: 1.5,
    direction: 1,
    zoneStart: 0.36,
    zoneEnd: 0.64,
    result: 'pending',
    resultTimer: 2,
    pendingEnemyDamage: 20,
    pendingEnemyStagger: 20,
    pendingMoveName: 'Mud Charge',
  };

  const hpBefore = player.currentHp;
  resolveQteInput(battle, player, false);

  // Player took 0 damage and entered Counter Attack QTE!
  assert.equal(player.currentHp, hpBefore);
  assert.equal(battle.phase, 'qte_counter');

  // Now hit Counter Attack QTE inside zone
  battle.qte.cursor = 0.5;
  const enemyHpBefore = getActiveEnemy(battle).currentHp;
  resolveQteInput(battle, player, false);
  assert.ok(getActiveEnemy(battle).currentHp < enemyHpBefore);
});

test('Platformer movement, jump, and gold pickup work cleanly', () => {
  const stage = buildStage(1);
  const p = createPlatformerPlayer();
  const startX = p.x;

  const res = stepPlatformer(
    p,
    stage,
    { left: false, right: true, jumpJustPressed: true, jumpHeld: true },
    0.016
  );
  assert.equal(res.jumped, true);
  assert.ok(p.x > startX);
  assert.ok(p.vy < 0);

  // Simulate holding jump until apex to confirm player clears lowered elevated platform (y = 184)
  let minY = p.y;
  for (let i = 0; i < 40; i++) {
    stepPlatformer(
      p,
      stage,
      { left: false, right: false, jumpJustPressed: false, jumpHeld: true },
      0.016
    );
    if (p.y < minY) minY = p.y;
  }
  assert.ok(minY <= 184, `Expected jump apex <= 184 to clear platform, got ${minY}`);
});

test('1-turn skill cooldown stays 1 on player next turn and clears after taking next action', () => {
  const player = createInitialPlayer();
  const enemy = spawnEnemyFromTemplate('farm_cow_elite');
  enemy.stats.hp = 9999;
  enemy.currentHp = 9999;
  enemy.ultimateCharge = 0;
  const battle = createBattleState(1, 'elite', 'z1_en_3', [enemy]);

  // Turn 1: Cast Pitchfork Thrust (phy_t1_slash, cooldown 1)
  executePlayerAction(battle, player, { kind: 'skill', skillId: 'phy_t1_slash' });
  assert.equal(battle.skillCooldowns['phy_t1_slash'], 1);

  // Advance timeline through animating + enemy turn (forcing basic enemy attack so no QTE blocks)
  battle.pendingEnemyAction = 'basic';
  for (let i = 0; i < 30 && battle.phase !== 'player_turn'; i++) {
    stepBattleTimeline(battle, player, 0.05);
  }
  assert.equal(battle.phase, 'player_turn');
  assert.equal(battle.turnCount, 2);

  // Cooldown must STILL be 1 when Turn 2 starts (not decremented during enemy turn!)
  assert.equal(battle.skillCooldowns['phy_t1_slash'], 1);

  // Trying to recast phy_t1_slash on Turn 2 must be blocked
  const mpBeforeBlockedCast = player.currentMp;
  executePlayerAction(battle, player, { kind: 'skill', skillId: 'phy_t1_slash' });
  assert.equal(player.currentMp, mpBeforeBlockedCast);
  assert.equal(battle.phase, 'player_turn');

  // Taking Basic Strike on Turn 2 ticks down existing cooldown to 0
  executePlayerAction(battle, player, { kind: 'attack' });
  assert.equal(battle.skillCooldowns['phy_t1_slash'], 0);
});

test('QTE cursor sweeps across the track and bounces smoothly inside stepBattleTimeline', () => {
  const player = createInitialPlayer();
  const enemy = spawnEnemyFromTemplate('farm_pig');
  const battle = createBattleState(1, 'normal', 'z1_en_1', [enemy]);

  battle.phase = 'qte_dodge';
  battle.qte = {
    active: true,
    phase: 'dodge',
    promptLabel: 'DODGE!',
    cursor: 0.1,
    speed: 2.0,
    direction: 1,
    zoneStart: 0.36,
    zoneEnd: 0.64,
    result: 'pending',
    resultTimer: 2.0,
    pendingEnemyDamage: 15,
    pendingEnemyStagger: 15,
    pendingMoveName: 'Mud Charge',
  };

  const c0 = battle.qte.cursor;
  stepBattleTimeline(battle, player, 0.1);
  const c1 = battle.qte.cursor;
  assert.ok(c1 > c0, `Expected cursor to advance from ${c0}, got ${c1}`);

  // Step past right edge to verify bounce
  for (let i = 0; i < 10; i++) {
    stepBattleTimeline(battle, player, 0.05);
  }
  assert.equal(battle.qte.direction, -1);
});

test('Combo counter scales Crit DMG & Stagger DMG, tracks total damage, preserves on guard, and breaks on unblocked hit', () => {
  assert.equal(getComboBonuses(0).critDmgBonus, 0);
  assert.equal(getComboBonuses(0).staggerMult, 1);
  assert.equal(getComboBonuses(3).tierLabel, 'BLITZ!');
  assert.equal(getComboBonuses(5).critDmgBonus, 50);
  assert.equal(getComboBonuses(5).staggerBonusPct, 40);
  assert.equal(getComboBonuses(8).tierLabel, 'GODLIKE!!!');

  const origRandom = Math.random;
  Math.random = () => 0.99; // Ensure no random dodge/block/crit flakiness
  try {
    const player = createInitialPlayer();
    const enemy = spawnEnemyFromTemplate('farm_cow_elite');
    enemy.stats.hp = 9999;
    enemy.currentHp = 9999;
    enemy.maxStagger = 9999;
    enemy.currentStagger = 9999;
    enemy.stats.dodge = 0;
    enemy.stats.block = 0;
    enemy.ultimateCharge = 0;

    const battle = createBattleState(1, 'elite', 'z1_en_3', [enemy]);

    // Hit 1: Basic Attack
    executePlayerAction(battle, player, { kind: 'attack' });
    const dmg1 = 9999 - enemy.currentHp;
    const stag1 = 9999 - enemy.currentStagger;
    assert.equal(battle.comboCount, 1);
    assert.equal(battle.comboDamage, dmg1);
    assert.ok(dmg1 > 0 && stag1 > 0);

    // Guard preserves combo across enemy turn
    battle.phase = 'player_turn';
    executePlayerAction(battle, player, { kind: 'guard' });
    battle.pendingEnemyAction = 'basic';
    for (let i = 0; i < 30 && battle.phase !== 'player_turn'; i++) {
      stepBattleTimeline(battle, player, 0.05);
    }
    assert.equal(battle.phase, 'player_turn');
    assert.equal(battle.comboCount, 1, 'Guarding enemy hit should preserve active combo');

    // Boost combo to 5 hits and verify Counter Strike gets scaling Crit DMG + Stagger DMG vs 0 combo
    const basePlayer = createInitialPlayer();
    const enemyA = spawnEnemyFromTemplate('farm_cow_elite');
    enemyA.stats.hp = 9999;
    enemyA.currentHp = 9999;
    enemyA.maxStagger = 9999;
    enemyA.currentStagger = 9999;
    const bNoCombo = createBattleState(1, 'elite', 'eA', [enemyA]);
    bNoCombo.phase = 'qte_counter';
    bNoCombo.qte = {
      active: true, phase: 'counter', promptLabel: 'COUNTER!',
      cursor: 0.5, speed: 1, direction: 1, zoneStart: 0.35, zoneEnd: 0.65,
      result: 'pending', resultTimer: 2, pendingEnemyDamage: 10, pendingEnemyStagger: 10, pendingMoveName: 'Horn',
    };
    resolveQteInput(bNoCombo, { ...basePlayer }, false);
    const dmgNoCombo = 9999 - enemyA.currentHp;
    const stagNoCombo = 9999 - enemyA.currentStagger;

    const enemyB = spawnEnemyFromTemplate('farm_cow_elite');
    enemyB.stats.hp = 9999;
    enemyB.currentHp = 9999;
    enemyB.maxStagger = 9999;
    enemyB.currentStagger = 9999;
    const bWithCombo = createBattleState(1, 'elite', 'eB', [enemyB]);
    bWithCombo.comboCount = 5;
    bWithCombo.comboDamage = 200;
    bWithCombo.phase = 'qte_counter';
    bWithCombo.qte = { ...bNoCombo.qte };
    resolveQteInput(bWithCombo, { ...basePlayer }, false);
    const dmgWithCombo = 9999 - enemyB.currentHp;
    const stagWithCombo = 9999 - enemyB.currentStagger;

    assert.ok(dmgWithCombo > dmgNoCombo, `Expected combo crit dmg ${dmgWithCombo} > ${dmgNoCombo}`);
    assert.ok(stagWithCombo > stagNoCombo, `Expected combo stagger dmg ${stagWithCombo} > ${stagNoCombo}`);
    assert.equal(bWithCombo.comboCount, 6);
    assert.equal(bWithCombo.comboDamage, 200 + dmgWithCombo);

    // Unblocked enemy hit breaks the combo back to 0
    bWithCombo.phase = 'player_turn';
    executePlayerAction(bWithCombo, { ...basePlayer }, { kind: 'skill', skillId: 'phy_t1_slash' });
    bWithCombo.pendingEnemyAction = 'basic';
    let sawComboBreak = false;
    for (let i = 0; i < 30 && bWithCombo.phase !== 'player_turn'; i++) {
      const ev = stepBattleTimeline(bWithCombo, { ...basePlayer }, 0.05);
      if (ev.sfx.includes('comboBreak')) sawComboBreak = true;
    }
    assert.equal(sawComboBreak, true);
    assert.equal(bWithCombo.comboCount, 0);
    assert.equal(bWithCombo.comboDamage, 0);
  } finally {
    Math.random = origRandom;
  }
});

test('Combo Finisher and Stagger Execute consume combo stacks for burst crit & instant Stagger Break', () => {
  const player = createInitialPlayer();
  const enemy = spawnEnemyFromTemplate('farm_cow_elite');
  enemy.stats.hp = 9999;
  enemy.currentHp = 9999;
  enemy.maxStagger = 150;
  enemy.currentStagger = 150;

  const battle = createBattleState(1, 'elite', 'z1_en_3', [enemy]);
  assert.equal(canUseStaggerExecute(battle), false);
  assert.equal(canUseComboFinisher(battle), false);

  // Build 3-hit stack -> Stagger Execute ready
  battle.comboCount = 3;
  battle.comboDamage = 90;
  assert.equal(canUseStaggerExecute(battle), true);
  assert.equal(canUseComboFinisher(battle), false);

  executePlayerAction(battle, player, { kind: 'finisher', mode: 'execute' });
  assert.equal(enemy.currentStagger, 0);
  assert.ok(enemy.staggeredTurns > 0);
  assert.equal(battle.comboCount, 0);
  assert.equal(battle.comboDamage, 0);

  // Build 5-hit stack -> Combo Finisher deals big damage scaled by comboDamage
  battle.phase = 'player_turn';
  battle.comboCount = 5;
  battle.comboDamage = 300;
  assert.equal(canUseComboFinisher(battle), true);
  const hpBefore = enemy.currentHp;
  executePlayerAction(battle, player, { kind: 'finisher', mode: 'burst' });
  const burstDmg = hpBefore - enemy.currentHp;
  assert.ok(burstDmg >= 120, `Expected finisher burst dmg >= 120, got ${burstDmg}`);
  assert.equal(battle.comboCount, 0);
  assert.equal(battle.comboDamage, 0);
});

test('In-battle passive procs trigger Mana Flow, Harvest, Thorns, and Shadow Step', () => {
  const player = createInitialPlayer();
  player.unlockedSkillIds.push('mag_t1_focus', 'def_t1_plate', 'spd_t1_step', 'all_t1_seed');
  player.currentHp = 60; // wounded so Harvest heal is visible
  player.currentMp = 30;
  player.ultimateCharge = 0;

  const enemy = spawnEnemyFromTemplate('farm_cow_elite');
  enemy.stats.hp = 9999;
  enemy.currentHp = 9999;
  enemy.maxStagger = 9999;
  enemy.currentStagger = 9999;
  const battle = createBattleState(1, 'elite', 'z1_en_3', [enemy]);

  // Mana Flow refunds part of Pitchfork Thrust (8 MP cost -> net spend < 8)
  const mpBefore = player.currentMp;
  const castEv = executePlayerAction(battle, player, { kind: 'skill', skillId: 'phy_t1_slash' });
  const hasHarvest = castEv.vfx.some((v) => v.text.includes('HARVEST'));
  const hasManaFlow = castEv.vfx.some((v) => v.text.includes('MANA FLOW'));
  assert.equal(hasManaFlow, true);
  assert.equal(hasHarvest, true);
  assert.ok(player.currentMp > mpBefore - 8);
  assert.ok(player.currentHp > 60);

  // Guard + enemy basic hit triggers Thorns damage to enemy
  battle.phase = 'player_turn';
  executePlayerAction(battle, player, { kind: 'guard' });
  const enemyHpBefore = enemy.currentHp;
  battle.pendingEnemyAction = 'basic';
  const origRandom = Math.random;
  Math.random = () => 0.99;
  try {
    let sawThorns = false;
    for (let i = 0; i < 30 && battle.phase !== 'player_turn'; i++) {
      const ev = stepBattleTimeline(battle, player, 0.05);
      if (ev.vfx.some((v) => v.text.includes('THORNS'))) sawThorns = true;
    }
    assert.equal(sawThorns, true);
    assert.ok(enemy.currentHp < enemyHpBefore);
  } finally {
    Math.random = origRandom;
  }

  // QTE Dodge triggers Shadow Step (+12% ULT & spd_up buff)
  player.ultimateCharge = 0;
  battle.phase = 'qte_dodge';
  battle.qte = {
    active: true,
    phase: 'dodge',
    promptLabel: 'DODGE!',
    cursor: 0.5,
    speed: 1,
    direction: 1,
    zoneStart: 0.35,
    zoneEnd: 0.65,
    result: 'pending',
    resultTimer: 2,
    pendingEnemyDamage: 20,
    pendingEnemyStagger: 15,
    pendingMoveName: 'Horn',
  };
  const dodgeEv = resolveQteInput(battle, player, false);
  assert.ok(dodgeEv.vfx.some((v) => v.text.includes('SHADOW STEP')));
  assert.ok(player.ultimateCharge >= 12);
  assert.ok(battle.playerBuffs.some((b) => b.type === 'spd_up'));
});
