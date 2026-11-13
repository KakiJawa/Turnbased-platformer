import test from 'node:test';
import assert from 'node:assert/strict';
import {
  audio,
  getBattleIntensityFromHpRatio,
  getBattleIntervalMs,
  getPercussionPatternForStep,
} from './audio';

function countDrumHitsInBar(
  mood: 'battle' | 'boss',
  intensity: 'standard' | 'heated' | 'critical'
): number {
  let total = 0;
  for (let step = 0; step < 16; step++) {
    const p = getPercussionPatternForStep(mood, intensity, step);
    if (p.kick) total += 1;
    if (p.snare) total += 1;
    if (p.hihat) total += 1;
  }
  return total;
}

test('HP ratio maps cleanly to battle music intensity tiers', () => {
  assert.equal(getBattleIntensityFromHpRatio(1.0), 'standard');
  assert.equal(getBattleIntensityFromHpRatio(0.61), 'standard');
  assert.equal(getBattleIntensityFromHpRatio(0.6), 'heated');
  assert.equal(getBattleIntensityFromHpRatio(0.35), 'heated');
  assert.equal(getBattleIntensityFromHpRatio(0.3), 'critical');
  assert.equal(getBattleIntensityFromHpRatio(0.05), 'critical');
  assert.equal(getBattleIntensityFromHpRatio(-0.2), 'critical');
});

test('Tempo accelerates and percussion density increases as enemy HP drops', () => {
  for (const mood of ['battle', 'boss'] as const) {
    const tStd = getBattleIntervalMs(mood, 'standard');
    const tHeat = getBattleIntervalMs(mood, 'heated');
    const tCrit = getBattleIntervalMs(mood, 'critical');
    assert.ok(tStd > tHeat && tHeat > tCrit, `${mood} intervals should speed up`);

    const hitsStd = countDrumHitsInBar(mood, 'standard');
    const hitsHeat = countDrumHitsInBar(mood, 'heated');
    const hitsCrit = countDrumHitsInBar(mood, 'critical');
    assert.ok(
      hitsStd < hitsHeat && hitsHeat < hitsCrit,
      `${mood} percussion density (${hitsStd} < ${hitsHeat} < ${hitsCrit}) should escalate`
    );
  }
});

test('ChiptuneAudio updates battle intensity on HP changes and resets outside battle', () => {
  audio.setMood('battle');
  audio.setBattleEnemyHpRatio(1.0);
  assert.equal(audio.getBattleIntensity(), 'standard');

  audio.setBattleEnemyHpRatio(0.5);
  assert.equal(audio.getBattleIntensity(), 'heated');

  audio.setBattleEnemyHpRatio(0.2);
  assert.equal(audio.getBattleIntensity(), 'critical');

  // Wave transition back to full-HP enemy resets cleanly to standard
  audio.setBattleEnemyHpRatio(1.0);
  assert.equal(audio.getBattleIntensity(), 'standard');

  audio.setBattleEnemyHpRatio(0.15);
  assert.equal(audio.getBattleIntensity(), 'critical');

  // Leaving battle resets intensity
  audio.setMood('explore');
  assert.equal(audio.getBattleIntensity(), 'standard');
  audio.setMood('none');
});
