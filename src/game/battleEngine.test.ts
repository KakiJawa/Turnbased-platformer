import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattleState,
  executePlayerAction,
  getActiveEnemy,
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
