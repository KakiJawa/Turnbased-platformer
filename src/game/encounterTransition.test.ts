import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_CLOSE_DURATION,
  NORMAL_CLOSE_DURATION,
  createEncounterTransition,
  startEncounterTransition,
  stepEncounterTransition,
} from './encounterTransition';
import { WorldEntity } from './types';

test('Normal enemy encounter transition closes, triggers battle entry, opens, and returns to idle', () => {
  const chicken: WorldEntity = {
    id: 'z1_en_1',
    kind: 'enemy',
    x: 470,
    y: 228,
    w: 24,
    h: 24,
    enemyRarity: 'normal',
    enemyName: 'Wild Chicken',
  };

  let st = createEncounterTransition();
  assert.equal(st.active, false);

  st = startEncounterTransition(chicken, 120);
  assert.equal(st.active, true);
  assert.equal(st.phase, 'closing');
  assert.equal(st.rarity, 'normal');
  assert.equal(st.duration, NORMAL_CLOSE_DURATION);

  // Step through closing phase in small 0.05s increments
  let enteredEntity: WorldEntity | null = null;
  for (let i = 0; i < 20; i++) {
    const res = stepEncounterTransition(st, 0.05);
    st = res.state;
    if (res.readyToEnterBattle) {
      enteredEntity = res.readyToEnterBattle;
      break;
    }
  }
  assert.equal(enteredEntity?.id, 'z1_en_1');
  assert.equal(st.phase, 'opening');

  // Step through opening phase until inactive
  for (let i = 0; i < 15 && st.active; i++) {
    st = stepEncounterTransition(st, 0.05).state;
  }
  assert.equal(st.active, false);
  assert.equal(st.phase, 'idle');
});

test('Boss encounter transition uses longer dramatic Boss sequence than normal encounters', () => {
  const boss: WorldEntity = {
    id: 'z1_boss',
    kind: 'enemy',
    x: 1370,
    y: 228,
    w: 38,
    h: 38,
    enemyRarity: 'boss',
    enemyName: 'Giant Rooster King',
  };

  let st = startEncounterTransition(boss, 1000);
  assert.equal(st.rarity, 'boss');
  assert.equal(st.duration, BOSS_CLOSE_DURATION);
  assert.ok(BOSS_CLOSE_DURATION > NORMAL_CLOSE_DURATION);

  // At NORMAL_CLOSE_DURATION, Boss transition must still be closing (showing Boss banner)
  for (let i = 0; i < 13; i++) {
    const res = stepEncounterTransition(st, 0.05);
    st = res.state;
    assert.equal(res.readyToEnterBattle, null);
  }
  assert.equal(st.phase, 'closing');

  // Finish remaining Boss closing steps
  let enteredBoss: WorldEntity | null = null;
  for (let i = 0; i < 15; i++) {
    const res = stepEncounterTransition(st, 0.05);
    st = res.state;
    if (res.readyToEnterBattle) {
      enteredBoss = res.readyToEnterBattle;
      break;
    }
  }
  assert.equal(enteredBoss?.id, 'z1_boss');
  assert.equal(st.phase, 'opening');
});
