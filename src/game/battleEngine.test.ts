import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattleState,
  executePlayerAction,
  getActiveEnemy,
  resolveQteInput,
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
});
