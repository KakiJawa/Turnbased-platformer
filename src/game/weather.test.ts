import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WeatherSystem,
  applyWeatherStatModifiers,
  getDynamicDaylightCycle,
  getWeatherCombatEffect,
  getWeatherFireDamageMultiplier,
  getZoneWeatherProfile,
} from './weather';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './canvasRenderer';
import {
  createBattleState,
  executePlayerAction,
  stepBattleTimeline,
  tickBuffsAndCooldowns,
} from './battleEngine';
import { createInitialPlayer, spawnEnemyFromTemplate } from './rpgLogic';

test('Every zone 1-8 has a distinct weather profile and valid daylight cycle state', () => {
  const seenKinds = new Set<string>();
  for (let z = 1; z <= 8; z++) {
    const profile = getZoneWeatherProfile(z);
    assert.equal(profile.zone, z);
    assert.ok(profile.particleCount > 0);
    assert.ok(profile.colors.length >= 3);
    seenKinds.add(profile.kind);

    const fx = getWeatherCombatEffect(z);
    assert.ok(fx.name.length > 0);
    assert.ok(fx.shortEffect.length > 0);

    const cycle = getDynamicDaylightCycle(12.5, z);
    assert.ok(cycle.overlayAlpha >= 0 && cycle.overlayAlpha <= 0.4);
    assert.ok(cycle.starAlpha >= 0 && cycle.starAlpha <= 1);
  }
  assert.equal(seenKinds.size, 8);
});

test('WeatherSystem steps particles cleanly, wraps screen bounds, and resets on zone change', () => {
  const weather = new WeatherSystem();
  const z1Before = weather.getActiveParticles(1).map((p) => ({ x: p.x, y: p.y }));
  assert.equal(z1Before.length, getZoneWeatherProfile(1).particleCount);

  weather.update(0.5, 1);
  const z1After = weather.getActiveParticles(1);
  let moved = false;
  for (let i = 0; i < z1After.length; i++) {
    if (z1After[i].x !== z1Before[i].x || z1After[i].y !== z1Before[i].y) {
      moved = true;
    }
    assert.ok(z1After[i].x >= -8 && z1After[i].x <= INTERNAL_WIDTH + 8);
    assert.ok(z1After[i].y >= -8 && z1After[i].y <= INTERNAL_HEIGHT + 8);
  }
  assert.equal(moved, true);

  // Switch to Zone 3 Rain (higher particle count, rapid downward vy)
  weather.update(0.2, 3);
  const z3Particles = weather.getActiveParticles(3);
  assert.equal(z3Particles.length, getZoneWeatherProfile(3).particleCount);
  assert.ok(z3Particles[0].vy > 100);

  // Switch to Zone 7 Storm & verify lightning flash triggers within 8s of normal frames
  weather.update(0.016, 7);
  let sawLightning = false;
  for (let i = 0; i < 80; i++) {
    weather.update(0.1, 7);
    if (weather.lightningAlpha > 0) sawLightning = true;
  }
  assert.equal(sawLightning, true);
});

test('Weather combat modifiers: Rain boosts MP regen, Heat reduces fire resistance, Frost slows speed', () => {
  const baseStats = {
    hp: 150,
    mp: 60,
    atk: 20,
    matk: 20,
    def: 10,
    mdef: 20,
    crit: 10,
    critDmg: 150,
    block: 5,
    dodge: 5,
    speed: 25,
  };

  // Rain (Zone 3) -> +5 MP/t & +15% Fire Res (0.85x fire dmg)
  const rainFx = getWeatherCombatEffect(3);
  assert.equal(rainFx.mpRegenPerTurn, 5);
  assert.equal(getWeatherFireDamageMultiplier(3), 0.85);

  // Heat (Zone 5 & 8) -> reduced fire resistance (1.15x / 1.20x fire dmg)
  assert.ok(getWeatherFireDamageMultiplier(5) > 1.1);
  assert.ok(getWeatherFireDamageMultiplier(8) >= 1.2);

  // Frost (Zone 6) lowers speed, Arcane Storm (Zone 7) lowers MDEF
  assert.ok(applyWeatherStatModifiers(baseStats, 6).speed < baseStats.speed);
  assert.ok(applyWeatherStatModifiers(baseStats, 7).mdef < baseStats.mdef);
  assert.equal(applyWeatherStatModifiers(baseStats, 1).crit, baseStats.crit + 3);

  // Rain MP regeneration triggers cleanly during battle turn tick
  const rainPlayer = createInitialPlayer();
  rainPlayer.currentMp = 20;
  const rainEnemy = spawnEnemyFromTemplate('farm_cow_elite');
  rainEnemy.stats.hp = 9999;
  rainEnemy.currentHp = 9999;
  rainEnemy.ultimateCharge = 0;
  const rainBattle = createBattleState(3, 'elite', 'z3_en', [rainEnemy]);
  executePlayerAction(rainBattle, rainPlayer, { kind: 'attack' });
  const mpAfterAttack = rainPlayer.currentMp; // 20 + 4 from Basic Attack = 24
  rainBattle.pendingEnemyAction = 'basic';
  const origRandom = Math.random;
  Math.random = () => 0.99;
  try {
    let sawRainPopup = false;
    for (let i = 0; i < 30 && rainBattle.phase !== 'player_turn'; i++) {
      const ev = stepBattleTimeline(rainBattle, rainPlayer, 0.05);
      if (ev.vfx.some((v) => v.text.includes('RAIN MIST'))) sawRainPopup = true;
    }
    assert.equal(sawRainPopup, true);
    assert.equal(rainPlayer.currentMp, mpAfterAttack + 5);
  } finally {
    Math.random = origRandom;
  }

  // Heat (Zone 5) deals noticeably higher Burn DoT than Rain (Zone 3) on identical enemy
  const makeBurningEnemy = () => {
    const e = spawnEnemyFromTemplate('farm_cow_elite');
    e.stats.hp = 1000;
    e.currentHp = 1000;
    e.buffs = [{ id: 'b1', type: 'burn', label: 'Burn', isDebuff: true, turns: 2, potency: 20 }];
    return e;
  };
  const eHeat = makeBurningEnemy();
  const bHeat = createBattleState(5, 'elite', 'e_heat', [eHeat]);
  tickBuffsAndCooldowns(bHeat, createInitialPlayer(), { sfx: [], vfx: [] });
  const heatBurnDmg = 1000 - eHeat.currentHp;

  const eRain = makeBurningEnemy();
  const bRain = createBattleState(3, 'elite', 'e_rain', [eRain]);
  tickBuffsAndCooldowns(bRain, createInitialPlayer(), { sfx: [], vfx: [] });
  const rainBurnDmg = 1000 - eRain.currentHp;

  assert.ok(heatBurnDmg > rainBurnDmg, `Expected Heat Burn (${heatBurnDmg}) > Rain Burn (${rainBurnDmg})`);
});
