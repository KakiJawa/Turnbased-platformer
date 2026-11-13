import { ENEMY_TEMPLATES, MATERIAL_META, PET_CATALOG, SKILL_TREE } from './data';
import {
  calculateDamage,
  computePlayerStats,
  generateEquipment,
  getSkillById,
  grantXp,
  rollRarityForEnemy,
  spawnEnemyFromTemplate,
} from './rpgLogic';
import {
  ActiveBuff,
  ActorAnimState,
  CombatEnemy,
  ConsumableItem,
  EnemyRarity,
  EquipmentItem,
  EquipmentSlot,
  MaterialId,
  PlayerState,
  QteState,
  Stats,
} from './types';
import {
  applyWeatherStatModifiers,
  getWeatherCombatEffect,
  getWeatherFireDamageMultiplier,
  isFireEnemySprite,
  isFireSkillId,
} from './weather';

export type BattlePhase =
  | 'player_turn'
  | 'animating'
  | 'enemy_turn'
  | 'qte_dodge'
  | 'qte_counter'
  | 'wave_transition'
  | 'victory'
  | 'defeat';

export interface BattleLogEntry {
  id: number;
  turn?: number;
  text: string;
  tone: 'info' | 'hit' | 'crit' | 'stagger' | 'heal' | 'enemy' | 'miss';
}

export interface BattleRewards {
  xp: number;
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
  items: EquipmentItem[];
  levelsGained: number;
}

export interface BattleState {
  zone: number;
  encounterRarity: EnemyRarity;
  sourceEntityId: string;
  arenaTrialId?: string;
  wave: CombatEnemy[];
  waveIndex: number;
  adds: CombatEnemy[];
  targetEnemyUid: string | null;
  pendingEnemyQueue: string[];
  pendingActorUid: string | null;
  processedDefeatUids: string[];
  petTurnCounter: number;
  turnCount: number;
  phase: BattlePhase;
  phaseTimer: number;
  playerAnim: ActorAnimState;
  playerAnimTimer: number;
  playerGuarding: boolean;
  playerBuffs: ActiveBuff[];
  skillCooldowns: Record<string, number>;
  qte: QteState;
  logs: BattleLogEntry[];
  rewards: BattleRewards;
  pendingEnemyAction: 'basic' | 'special' | null;
  comboCount: number;
  comboDamage: number;
  maxComboCount: number;
  maxComboDamage: number;
  comboFlashSeq: number;
}

export interface ComboBonuses {
  critDmgBonus: number;
  staggerBonusPct: number;
  staggerMult: number;
  tierLabel: string;
  tierColor: string;
}

export function getComboBonuses(comboCount: number): ComboBonuses {
  if (comboCount <= 0) {
    return {
      critDmgBonus: 0,
      staggerBonusPct: 0,
      staggerMult: 1,
      tierLabel: '',
      tierColor: '#facc15',
    };
  }
  const critDmgBonus = Math.min(120, comboCount * 10);
  const staggerBonusPct = Math.min(80, comboCount * 8);
  const staggerMult = 1 + staggerBonusPct / 100;
  let tierLabel = 'CHAIN';
  let tierColor = '#facc15';
  if (comboCount >= 8) {
    tierLabel = 'GODLIKE!!!';
    tierColor = '#c084fc';
  } else if (comboCount >= 5) {
    tierLabel = 'FRENZY!!';
    tierColor = '#f43f5e';
  } else if (comboCount >= 3) {
    tierLabel = 'BLITZ!';
    tierColor = '#fb923c';
  }
  return {
    critDmgBonus,
    staggerBonusPct,
    staggerMult,
    tierLabel,
    tierColor,
  };
}

export function canUseComboFinisher(battle: BattleState): boolean {
  return battle.comboCount >= 5;
}

export function canUseStaggerExecute(battle: BattleState): boolean {
  const enemy = getActiveEnemy(battle);
  return battle.comboCount >= 3 && Boolean(enemy) && enemy.currentHp > 0 && enemy.staggeredTurns === 0;
}

let logSeq = 1;

export function createBattleState(
  zone: number,
  encounterRarity: EnemyRarity,
  sourceEntityId: string,
  wave: CombatEnemy[],
  options?: string | { arenaTrialId?: string; initialCombo?: number }
): BattleState {
  const opts =
    typeof options === 'string'
      ? { arenaTrialId: options, initialCombo: 0 }
      : options ?? {};
  const first = wave[0];
  const adds: CombatEnemy[] = [];
  const logs: BattleLogEntry[] = [
    {
      id: logSeq++,
      turn: 1,
      text: `Wave 1/${wave.length}: ${first.name} steps forward!`,
      tone: 'info',
    },
    {
      id: logSeq++,
      turn: 1,
      text: `Weather: ${getWeatherCombatEffect(zone).name} (${getWeatherCombatEffect(zone).shortEffect})`,
      tone: 'info',
    },
  ];

  // Dual-enemy encounters spawn partner add on the field alongside primary enemy
  if (!opts.arenaTrialId && first) {
    const tpl = ENEMY_TEMPLATES.find((t) => t.id === first.templateId);
    if (tpl?.dualPartnerId) {
      const partner = spawnEnemyFromTemplate(tpl.dualPartnerId);
      partner.isAdd = true;
      adds.push(partner);
      logs.unshift({
        id: logSeq++,
        turn: 1,
        text: `Dual Encounter: ${partner.name} flanks alongside ${first.name}!`,
        tone: 'enemy',
      });
    }
  }

  const startCombo = opts.initialCombo ?? 0;
  if (startCombo > 0) {
    logs.unshift({
      id: logSeq++,
      turn: 1,
      text: `Overdrive Convergence: Started battle with ${startCombo}x Combo!`,
      tone: 'stagger',
    });
  }

  return {
    zone,
    encounterRarity,
    sourceEntityId,
    arenaTrialId: opts.arenaTrialId,
    wave,
    waveIndex: 0,
    adds,
    targetEnemyUid: first?.uid ?? null,
    pendingEnemyQueue: [],
    pendingActorUid: null,
    processedDefeatUids: [],
    petTurnCounter: 0,
    turnCount: 1,
    phase: 'player_turn',
    phaseTimer: 0,
    playerAnim: 'idle',
    playerAnimTimer: 0,
    playerGuarding: false,
    playerBuffs: [],
    skillCooldowns: {},
    qte: {
      active: false,
      phase: 'dodge',
      promptLabel: '',
      cursor: 0,
      speed: 1.5,
      direction: 1,
      zoneStart: 0.36,
      zoneEnd: 0.64,
      result: 'pending',
      resultTimer: 0,
      pendingEnemyDamage: 0,
      pendingEnemyStagger: 0,
      pendingMoveName: '',
    },
    logs,
    rewards: {
      xp: 0,
      gold: 0,
      materials: {},
      items: [],
      levelsGained: 0,
    },
    pendingEnemyAction: null,
    comboCount: startCombo,
    comboDamage: 0,
    maxComboCount: startCombo,
    maxComboDamage: 0,
    comboFlashSeq: startCombo > 0 ? 1 : 0,
  };
}

export function addBattleLog(
  battle: BattleState,
  text: string,
  tone: BattleLogEntry['tone'] = 'info'
) {
  battle.logs = [
    { id: logSeq++, turn: battle.turnCount, text, tone },
    ...battle.logs,
  ].slice(0, 40);
}

export function getFieldEnemies(battle: BattleState): CombatEnemy[] {
  const list: CombatEnemy[] = [];
  const primary = battle.wave[battle.waveIndex];
  if (primary) list.push(primary);
  for (const add of battle.adds) {
    list.push(add);
  }
  return list;
}

export function getLivingFieldEnemies(battle: BattleState): CombatEnemy[] {
  return getFieldEnemies(battle).filter((e) => e.currentHp > 0);
}

export function getActiveEnemy(battle: BattleState): CombatEnemy {
  const field = getFieldEnemies(battle);
  if (battle.targetEnemyUid) {
    const selected = field.find(
      (e) => e.uid === battle.targetEnemyUid && e.currentHp > 0
    );
    if (selected) return selected;
  }
  const firstAlive = field.find((e) => e.currentHp > 0);
  if (firstAlive) {
    battle.targetEnemyUid = firstAlive.uid;
    return firstAlive;
  }
  return battle.wave[battle.waveIndex];
}

export function switchBattleTarget(
  battle: BattleState,
  uid?: string
): CombatEnemy | null {
  const living = getLivingFieldEnemies(battle);
  if (living.length === 0) return null;
  if (uid) {
    const found = living.find((e) => e.uid === uid);
    if (found) {
      battle.targetEnemyUid = found.uid;
      return found;
    }
  }
  const currIdx = living.findIndex((e) => e.uid === battle.targetEnemyUid);
  const next = living[(currIdx + 1) % living.length];
  battle.targetEnemyUid = next.uid;
  return next;
}

function getAttackerEnemy(battle: BattleState): CombatEnemy {
  const field = getFieldEnemies(battle);
  if (battle.pendingActorUid) {
    const actor = field.find((e) => e.uid === battle.pendingActorUid);
    if (actor) return actor;
  }
  return getLivingFieldEnemies(battle)[0] ?? getActiveEnemy(battle);
}

export function getEffectivePlayerCombatStats(
  player: PlayerState,
  battle: Pick<BattleState, 'zone' | 'playerBuffs'>
): Stats {
  return applyWeatherStatModifiers(
    computePlayerStats(player, battle.playerBuffs),
    battle.zone
  );
}

export function getEffectiveEnemyCombatStats(enemy: CombatEnemy): Stats {
  if (!enemy.buffs || enemy.buffs.length === 0) return enemy.stats;
  const s: Stats = { ...enemy.stats };
  for (const buff of enemy.buffs) {
    if (buff.type === 'atk_up') {
      s.atk = Math.round(s.atk * (1 + buff.potency / 100));
      s.matk = Math.round(s.matk * (1 + buff.potency / 100));
    } else if (buff.type === 'def_up') {
      s.def = Math.round(s.def * (1 + buff.potency / 100));
      s.mdef = Math.round(s.mdef * (1 + buff.potency / 100));
    } else if (buff.type === 'spd_up') {
      s.speed = Math.round(s.speed * (1 + buff.potency / 100));
    } else if (buff.type === 'armor_break') {
      s.def = Math.max(0, Math.round(s.def * (1 - buff.potency / 100)));
    } else if (buff.type === 'weaken') {
      s.atk = Math.max(1, Math.round(s.atk * (1 - buff.potency / 100)));
      s.matk = Math.max(1, Math.round(s.matk * (1 - buff.potency / 100)));
    }
  }
  return s;
}

export interface CombatActionEvents {
  sfx: (
    | 'hit'
    | 'crit'
    | 'staggerBreak'
    | 'block'
    | 'dodge'
    | 'counter'
    | 'heal'
    | 'ultimate'
    | 'victory'
    | 'defeat'
    | 'levelUp'
    | 'comboUp'
    | 'comboBreak'
  )[];
  vfx: {
    target: 'player' | 'enemy';
    text: string;
    color: string;
    yOffset?: number;
    burstColor?: string;
    burstCount?: number;
    hitstop?: number;
    trauma?: number;
    ringColor?: string;
    flashColor?: string;
  }[];
}

export function applyBuffToList(
  list: ActiveBuff[],
  newBuff: Omit<ActiveBuff, 'id'>
): ActiveBuff[] {
  const filtered = list.filter((b) => b.type !== newBuff.type);
  return [
    ...filtered,
    {
      ...newBuff,
      id: `${newBuff.type}_${Date.now()}_${Math.random()}`,
    },
  ];
}

export function tickBuffsAndCooldowns(
  battle: BattleState,
  player: PlayerState,
  events: CombatActionEvents
) {
  const pStats = getEffectivePlayerCombatStats(player, battle);
  const weatherFx = getWeatherCombatEffect(battle.zone);
  const fireMult = getWeatherFireDamageMultiplier(battle.zone);

  if (weatherFx.mpRegenPerTurn > 0 && player.currentMp < pStats.mp) {
    const beforeMp = player.currentMp;
    player.currentMp = Math.min(pStats.mp, player.currentMp + weatherFx.mpRegenPerTurn);
    const gainedMp = Math.round(player.currentMp - beforeMp);
    if (gainedMp > 0) {
      events.vfx.push({
        target: 'player',
        text: `+${gainedMp} MP (${weatherFx.name.toUpperCase()})`,
        color: '#38bdf8',
        yOffset: -24,
      });
    }
  }

  if (weatherFx.hpRegenPerTurn > 0 && player.currentHp < pStats.hp) {
    const beforeHp = player.currentHp;
    player.currentHp = Math.min(pStats.hp, player.currentHp + weatherFx.hpRegenPerTurn);
    const gainedHp = Math.round(player.currentHp - beforeHp);
    if (gainedHp > 0) {
      events.vfx.push({
        target: 'player',
        text: `+${gainedHp} HP (${weatherFx.name.toUpperCase()})`,
        color: '#4ade80',
        yOffset: -10,
      });
    }
  }

  const nextPlayerBuffs: ActiveBuff[] = [];
  for (const b of battle.playerBuffs) {
    if (b.type === 'regen') {
      const healAmt = Math.max(4, Math.round((pStats.hp * b.potency) / 100));
      player.currentHp = Math.min(pStats.hp, player.currentHp + healAmt);
      events.vfx.push({
        target: 'player',
        text: `+${healAmt} HP`,
        color: '#4ade80',
      });
    }
    if (b.turns - 1 > 0) {
      nextPlayerBuffs.push({ ...b, turns: b.turns - 1 });
    }
  }
  battle.playerBuffs = nextPlayerBuffs;

  // Tick buffs/burn across all living field enemies
  for (const enemy of getLivingFieldEnemies(battle)) {
    const nextEnemyBuffs: ActiveBuff[] = [];
    for (const b of enemy.buffs) {
      if (b.type === 'burn' && enemy.currentHp > 0) {
        const baseBurn = Math.max(4, Math.round((enemy.stats.hp * b.potency) / 200));
        const burnDmg = Math.max(2, Math.round(baseBurn * fireMult));
        enemy.currentHp = Math.max(0, enemy.currentHp - burnDmg);
        events.vfx.push({
          target: 'enemy',
          text: `-${burnDmg} BURN`,
          color: '#fb923c',
          burstColor: '#f97316',
          burstCount: 6,
        });
        addBattleLog(battle, `${enemy.name} took ${burnDmg} Burn damage!`, 'hit');
        if (enemy.currentHp > 0) {
          checkBossPhaseTransition(battle, enemy, events);
        }
      }
      if (b.turns - 1 > 0) {
        nextEnemyBuffs.push({ ...b, turns: b.turns - 1 });
      }
    }
    enemy.buffs = nextEnemyBuffs;
  }
}

export function checkBossPhaseTransition(
  battle: BattleState,
  enemy: CombatEnemy,
  events: CombatActionEvents
) {
  if (enemy.rarity !== 'boss' || enemy.currentHp <= 0) return;
  const hpRatio = enemy.currentHp / Math.max(1, enemy.stats.hp);

  // Phase 2 at <= 55% HP: Barrier + ATK boost + optional Summon
  if (enemy.bossPhase === 1 && hpRatio <= 0.55) {
    enemy.bossPhase = 2;
    enemy.shieldHits = 2;
    enemy.buffs = applyBuffToList(enemy.buffs, {
      type: 'atk_up',
      label: 'Phase 2 Fury',
      isDebuff: false,
      turns: 5,
      potency: 20,
    });
    events.sfx.push('staggerBreak');
    events.vfx.push({
      target: 'enemy',
      text: 'PHASE 2 · BARRIER!',
      color: '#facc15',
      yOffset: -36,
      burstColor: '#facc15',
      burstCount: 22,
      ringColor: '#facc15',
      hitstop: 0.06,
      trauma: 0.55,
    });
    addBattleLog(
      battle,
      `${enemy.name} enters Phase 2! Gained 2-hit Barrier & +20% ATK!`,
      'enemy'
    );

    if (
      enemy.summonTemplateId &&
      !enemy.summonedOnce &&
      battle.adds.filter((a) => a.currentHp > 0).length < 2
    ) {
      const add = spawnEnemyFromTemplate(enemy.summonTemplateId);
      add.isAdd = true;
      enemy.summonedOnce = true;
      battle.adds.push(add);
      events.vfx.push({
        target: 'enemy',
        text: `SUMMONED ${add.name.toUpperCase()}!`,
        color: '#c084fc',
        yOffset: -54,
        burstColor: '#c084fc',
        burstCount: 16,
      });
      addBattleLog(battle, `${enemy.name} summoned ${add.name} to the field!`, 'enemy');
    }
  }

  // Phase 3 Enrage at <= 28% HP
  if (enemy.bossPhase < 3 && hpRatio <= 0.28) {
    enemy.bossPhase = 3;
    enemy.enraged = true;
    if (enemy.enragedSpecialName) {
      enemy.specialName = enemy.enragedSpecialName;
    }
    enemy.specialMult = Math.round(enemy.specialMult * 1.2 * 100) / 100;
    enemy.ultimateCharge = Math.min(100, enemy.ultimateCharge + 50);
    enemy.buffs = applyBuffToList(enemy.buffs, {
      type: 'atk_up',
      label: 'ENRAGED',
      isDebuff: false,
      turns: 99,
      potency: 35,
    });
    enemy.buffs = applyBuffToList(enemy.buffs, {
      type: 'spd_up',
      label: 'Frenzy',
      isDebuff: false,
      turns: 99,
      potency: 30,
    });
    events.sfx.push('ultimate');
    events.vfx.push({
      target: 'enemy',
      text: 'ENRAGED!!',
      color: '#f43f5e',
      yOffset: -44,
      burstColor: '#f43f5e',
      burstCount: 28,
      ringColor: '#f43f5e',
      flashColor: '#f43f5e',
      hitstop: 0.08,
      trauma: 0.78,
    });
    addBattleLog(
      battle,
      `${enemy.name} is ENRAGED! (+35% ATK/MATK, ${enemy.specialName})`,
      'enemy'
    );
  }
}

export function executePlayerAction(
  battle: BattleState,
  player: PlayerState,
  action:
    | { kind: 'attack' }
    | { kind: 'guard' }
    | { kind: 'skill'; skillId: string }
    | { kind: 'ultimate' }
    | { kind: 'consumable'; itemId: string }
    | { kind: 'finisher'; mode: 'burst' | 'execute' }
): CombatActionEvents {
  const events: CombatActionEvents = { sfx: [], vfx: [] };
  if (battle.phase !== 'player_turn') return events;

  const enemy = getActiveEnemy(battle);
  const pStats = getEffectivePlayerCombatStats(player, battle);
  const weatherFx = getWeatherCombatEffect(battle.zone);
  const vanguardStaggerMult = player.tier3Branch === 'vanguard' ? 1.3 : 1;
  battle.playerGuarding = false;

  const usedSkillId = action.kind === 'skill' ? action.skillId : null;
  if (action.kind !== 'skill') {
    for (const id of Object.keys(battle.skillCooldowns)) {
      if (battle.skillCooldowns[id] > 0) {
        battle.skillCooldowns[id] -= 1;
      }
    }
  }

  if (action.kind === 'guard') {
    battle.playerGuarding = true;
    const hasRiposte = player.unlockedSkillIds.includes('def_t2_riposte');
    const mpGain = hasRiposte ? 18 : 8;
    const ultGain = hasRiposte ? 24 : 14;
    player.currentMp = Math.min(pStats.mp, player.currentMp + mpGain);
    player.ultimateCharge = Math.min(100, player.ultimateCharge + ultGain);

    if (hasRiposte) {
      battle.comboCount += 1;
      battle.comboFlashSeq += 1;
      battle.maxComboCount = Math.max(battle.maxComboCount, battle.comboCount);
      events.sfx.push('comboUp');
      events.vfx.push({
        target: 'player',
        text: 'RIPOSTE +1 COMBO',
        color: '#facc15',
        yOffset: -18,
      });
    }

    if (player.tier3Branch === 'vanguard') {
      const healAmt = Math.max(6, Math.round(pStats.hp * 0.06));
      player.currentHp = Math.min(pStats.hp, player.currentHp + healAmt);
      events.vfx.push({
        target: 'player',
        text: `BULWARK +${healAmt} HP`,
        color: '#4ade80',
        yOffset: -32,
      });
    }

    events.sfx.push('block');
    events.vfx.push({
      target: 'player',
      text: `GUARD +${mpGain} MP`,
      color: '#38bdf8',
      ringColor: '#38bdf8',
    });
    addBattleLog(battle, `${player.name} braces in Guard (+${mpGain} MP).`, 'info');
    finishPlayerTurn(battle, player, events);
    return events;
  }

  if (action.kind === 'consumable') {
    const item = player.consumables.find((c) => c.id === action.itemId);
    if (!item || item.quantity <= 0) return events;
    item.quantity -= 1;

    if (item.kind === 'heal_hp' || item.kind === 'heal_both') {
      player.currentHp = Math.min(pStats.hp, player.currentHp + item.power);
      events.sfx.push('heal');
      events.vfx.push({
        target: 'player',
        text: `+${item.power} HP`,
        color: '#4ade80',
        burstColor: '#4ade80',
        burstCount: 12,
      });
      addBattleLog(battle, `Used ${item.name} (+${item.power} HP).`, 'heal');
    } else if (item.kind === 'heal_mp') {
      player.currentMp = Math.min(pStats.mp, player.currentMp + item.power);
      events.sfx.push('heal');
      events.vfx.push({
        target: 'player',
        text: `+${item.power} MP`,
        color: '#38bdf8',
        burstColor: '#38bdf8',
        burstCount: 10,
      });
      addBattleLog(battle, `Used ${item.name} (+${item.power} MP).`, 'heal');
    } else if (item.kind === 'buff_atk') {
      battle.playerBuffs = applyBuffToList(battle.playerBuffs, {
        type: 'atk_up',
        label: 'Pepper Tonic',
        isDebuff: false,
        turns: item.duration ?? 3,
        potency: item.power,
      });
      events.sfx.push('heal');
      events.vfx.push({
        target: 'player',
        text: `+${item.power}% ATK`,
        color: '#facc15',
        ringColor: '#facc15',
      });
      addBattleLog(battle, `Drank ${item.name}!`, 'info');
    } else if (item.kind === 'stagger_bomb') {
      const comboBonuses = getComboBonuses(battle.comboCount);
      const scaledStagger = Math.round(item.power * comboBonuses.staggerMult * vanguardStaggerMult);
      battle.playerAnim = 'attack';
      battle.playerAnimTimer = 0.35;
      battle.comboCount += 1;
      battle.comboFlashSeq += 1;
      battle.maxComboCount = Math.max(battle.maxComboCount, battle.comboCount);
      dealStaggerToEnemy(battle, enemy, scaledStagger, events);
      events.sfx.push('hit', 'comboUp');
      events.vfx.push({
        target: 'enemy',
        text: `-${scaledStagger} STAGGER`,
        color: '#facc15',
        burstColor: '#facc15',
        burstCount: 16,
        trauma: 0.45,
      });
      addBattleLog(battle, `Threw ${item.name} (${battle.comboCount}x Combo)!`, 'stagger');
    }

    finishPlayerTurn(battle, player, events);
    return events;
  }

  if (action.kind === 'attack') {
    battle.playerAnim = 'attack';
    battle.playerAnimTimer = 0.35;
    player.currentMp = Math.min(pStats.mp, player.currentMp + 4);
    player.ultimateCharge = Math.min(100, player.ultimateCharge + 16);

    const comboBonuses = getComboBonuses(battle.comboCount);
    const hasCascade =
      player.unlockedSkillIds.includes('phy_t2_cascade') && battle.comboCount >= 3;
    const boostedAttacker = {
      ...pStats,
      critDmg: pStats.critDmg + comboBonuses.critDmgBonus + (hasCascade ? 10 : 0),
    };
    const eStats = getEffectiveEnemyCombatStats(enemy);
    const res = calculateDamage(boostedAttacker, eStats, {
      damageType: 'physical',
      powerMult: 1.0,
      staggerPower: Math.round(24 * comboBonuses.staggerMult * weatherFx.staggerMult * vanguardStaggerMult),
      defenderIsStaggered: enemy.staggeredTurns > 0,
      damageMult: hasCascade ? 1.18 : 1,
    });
    applyPlayerDamageResult(battle, player, enemy, 'Basic Strike', res, events);

    // Astral Spellblade trait: physical strikes ignite Burn!
    if (!res.isDodged && enemy.currentHp > 0 && player.tier3Branch === 'spellblade') {
      enemy.buffs = applyBuffToList(enemy.buffs, {
        type: 'burn',
        label: 'Arcane Burn',
        isDebuff: true,
        turns: 2,
        potency: 14,
      });
    }

    finishPlayerTurn(battle, player, events);
    return events;
  }

  if (action.kind === 'finisher') {
    if (action.mode === 'burst') {
      if (!canUseComboFinisher(battle)) return events;
      const usedHits = battle.comboCount;
      const usedDmg = battle.comboDamage;
      battle.comboCount = 0;
      battle.comboDamage = 0;
      battle.playerAnim = 'attack';
      battle.playerAnimTimer = 0.48;
      player.ultimateCharge = Math.min(100, player.ultimateCharge + 18);

      const finisherAttacker = {
        ...pStats,
        atk: Math.round(pStats.atk + usedDmg * 0.35),
        critDmg: pStats.critDmg + usedHits * 12,
      };
      const eStats = getEffectiveEnemyCombatStats(enemy);
      const res = calculateDamage(finisherAttacker, eStats, {
        damageType: 'physical',
        powerMult: 1.55 + usedHits * 0.14,
        staggerPower: Math.round((55 + usedHits * 6) * weatherFx.staggerMult * vanguardStaggerMult),
        defenderIsStaggered: enemy.staggeredTurns > 0,
        forceCrit: true,
        allowDodge: false,
      });

      if (enemy.shieldHits > 0) {
        enemy.shieldHits -= 1;
        res.damage = Math.max(1, Math.round(res.damage * 0.5));
        events.vfx.push({
          target: 'enemy',
          text: `BARRIER CRACKED (${enemy.shieldHits})`,
          color: '#facc15',
          yOffset: -22,
        });
      }

      enemy.currentHp = Math.max(0, enemy.currentHp - res.damage);
      enemy.animState = enemy.currentHp === 0 ? 'death' : 'hit';
      enemy.animTimer = enemy.currentHp === 0 ? 0.65 : 0.42;
      events.sfx.push('ultimate', 'crit');
      events.vfx.push({
        target: 'enemy',
        text: `FINISHER ${res.damage}!`,
        color: '#c084fc',
        yOffset: 6,
        burstColor: '#c084fc',
        burstCount: 34,
        hitstop: 0.1,
        trauma: 0.9,
        ringColor: '#facc15',
        flashColor: '#c084fc',
      });
      addBattleLog(
        battle,
        `COMBO FINISHER (${usedHits}x Stack) obliterated ${enemy.name} for ${res.damage} CRIT!`,
        'crit'
      );
      applyPassiveProcsOnHit(battle, player, pStats, res, events);
      if (enemy.currentHp > 0) {
        dealStaggerToEnemy(battle, enemy, res.staggerDamage, events);
        checkBossPhaseTransition(battle, enemy, events);
      }
      finishPlayerTurn(battle, player, events);
      return events;
    }

    if (!canUseStaggerExecute(battle)) return events;
    const usedHits = battle.comboCount;
    battle.comboCount = 0;
    battle.comboDamage = 0;
    battle.playerAnim = 'attack';
    battle.playerAnimTimer = 0.44;
    player.ultimateCharge = Math.min(100, player.ultimateCharge + 16);

    const eStats = getEffectiveEnemyCombatStats(enemy);
    const res = calculateDamage(pStats, eStats, {
      damageType: 'physical',
      powerMult: 1.35 + usedHits * 0.06,
      staggerPower: enemy.currentStagger,
      defenderIsStaggered: false,
      allowDodge: false,
    });
    enemy.currentHp = Math.max(0, enemy.currentHp - res.damage);
    enemy.animState = enemy.currentHp === 0 ? 'death' : 'hit';
    enemy.animTimer = enemy.currentHp === 0 ? 0.65 : 0.38;
    events.sfx.push('crit');
    events.vfx.push({
      target: 'enemy',
      text: `EXECUTE ${res.damage}!`,
      color: '#fb923c',
      yOffset: 6,
      burstColor: '#fb923c',
      burstCount: 24,
      hitstop: 0.08,
      trauma: 0.72,
    });
    addBattleLog(
      battle,
      `STAGGER EXECUTE (${usedHits}x Stack) hit ${enemy.name} for ${res.damage} and shattered posture!`,
      'stagger'
    );
    applyPassiveProcsOnHit(battle, player, pStats, res, events);
    if (enemy.currentHp > 0) {
      dealStaggerToEnemy(battle, enemy, Math.max(1, enemy.currentStagger), events);
      checkBossPhaseTransition(battle, enemy, events);
    }
    finishPlayerTurn(battle, player, events);
    return events;
  }

  if (action.kind === 'skill' || action.kind === 'ultimate') {
    const skillId =
      action.kind === 'ultimate' ? player.equippedUltimateId : action.skillId;
    const skill = getSkillById(skillId);
    if (!skill) return events;

    if (action.kind === 'ultimate') {
      if (player.ultimateCharge < 100) return events;
      player.ultimateCharge = 0;
      events.sfx.push('ultimate');
    } else {
      const mpCost = skill.mpCost ?? 0;
      if (player.currentMp < mpCost) return events;
      if ((battle.skillCooldowns[skill.id] ?? 0) > 0) return events;
      player.currentMp -= mpCost;
      for (const id of Object.keys(battle.skillCooldowns)) {
        if (id !== usedSkillId && battle.skillCooldowns[id] > 0) {
          battle.skillCooldowns[id] -= 1;
        }
      }
      battle.skillCooldowns[skill.id] = skill.cooldown ?? 1;
      player.ultimateCharge = Math.min(100, player.ultimateCharge + 22);

      // Passive Proc: Mana Flow (Lantern Mind / Archmage Soul) refunds 20%-35% skill MP cost
      if (
        mpCost > 0 &&
        (player.unlockedSkillIds.includes('mag_t1_focus') ||
          player.unlockedSkillIds.includes('mag_t2_sage'))
      ) {
        const pct = player.unlockedSkillIds.includes('mag_t2_sage') ? 0.35 : 0.2;
        const refund = Math.max(2, Math.round(mpCost * pct));
        player.currentMp = Math.min(pStats.mp, player.currentMp + refund);
        events.vfx.push({
          target: 'player',
          text: `MANA FLOW +${refund} MP`,
          color: '#38bdf8',
          yOffset: -20,
        });
      }
    }

    battle.playerAnim = 'attack';
    battle.playerAnimTimer = 0.42;

    if (skill.damageType === 'heal') {
      const healAmt = Math.round(pStats.hp * (skill.healPercent ?? 0.3));
      player.currentHp = Math.min(pStats.hp, player.currentHp + healAmt);
      events.sfx.push('heal');
      events.vfx.push({
        target: 'player',
        text: `+${healAmt} HP`,
        color: '#4ade80',
        burstColor: '#4ade80',
        burstCount: 16,
        ringColor: '#4ade80',
      });
      addBattleLog(battle, `${skill.name} heals ${healAmt} HP!`, 'heal');
    }

    // Combo Synergy: Inspiring Cadence (sup_t2_momentum) on heal/buff skills
    if (
      (skill.damageType === 'heal' || skill.damageType === 'buff') &&
      player.unlockedSkillIds.includes('sup_t2_momentum')
    ) {
      battle.comboCount += 1;
      battle.comboFlashSeq += 1;
      battle.maxComboCount = Math.max(battle.maxComboCount, battle.comboCount);
      events.sfx.push('comboUp');
      events.vfx.push({
        target: 'player',
        text: 'CADENCE +1 COMBO',
        color: '#4ade80',
        yOffset: -28,
      });
      if (battle.comboCount >= 4) {
        for (const cid of Object.keys(battle.skillCooldowns)) {
          if (cid !== skill.id && battle.skillCooldowns[cid] > 0) {
            battle.skillCooldowns[cid] = Math.max(0, battle.skillCooldowns[cid] - 1);
          }
        }
        addBattleLog(
          battle,
          `Inspiring Cadence (${battle.comboCount}x Combo) shaved 1t off skill cooldowns!`,
          'heal'
        );
      }
    }

    if (skill.buffApplied) {
      const b = skill.buffApplied;
      if (b.target === 'self') {
        battle.playerBuffs = applyBuffToList(battle.playerBuffs, {
          type: b.type,
          label: b.label,
          isDebuff: b.isDebuff,
          turns: b.turns,
          potency: b.potency,
        });
        events.sfx.push('heal');
        events.vfx.push({
          target: 'player',
          text: b.label.toUpperCase(),
          color: '#38bdf8',
          ringColor: '#38bdf8',
        });
        if (skill.damageType === 'buff') {
          addBattleLog(battle, `${player.name} activated ${skill.name} (${b.label})!`, 'heal');
        }
      } else {
        enemy.buffs = applyBuffToList(enemy.buffs, {
          type: b.type,
          label: b.label,
          isDebuff: b.isDebuff,
          turns: b.turns,
          potency: b.potency,
        });
      }
    }

    if (
      skill.damageType === 'physical' ||
      skill.damageType === 'magical' ||
      skill.damageType === 'debuff'
    ) {
      const comboBonuses = getComboBonuses(battle.comboCount);
      const isPhysicalSkill = skill.damageType === 'physical' || skill.damageType === 'debuff';
      const hasCascade =
        isPhysicalSkill &&
        player.unlockedSkillIds.includes('phy_t2_cascade') &&
        battle.comboCount >= 3;

      const baseOffense =
        skill.id === 'all_t2_ult'
          ? { ...pStats, atk: pStats.atk + Math.round(pStats.matk * 0.85) }
          : skill.id === 'spd_t3_ult'
          ? { ...pStats, atk: pStats.atk + Math.round(pStats.speed * 1.4) }
          : pStats;
      const effectiveAttacker = {
        ...baseOffense,
        critDmg: baseOffense.critDmg + comboBonuses.critDmgBonus + (hasCascade ? 10 : 0),
      };
      const scaledStaggerPower = Math.round(
        (skill.staggerPower ?? 30) *
          comboBonuses.staggerMult *
          weatherFx.staggerMult *
          vanguardStaggerMult
      );
      let weatherDmgMult = skill.damageType === 'magical' ? weatherFx.magicDmgMult : 1;
      if (isFireSkillId(skill.id)) {
        weatherDmgMult *= getWeatherFireDamageMultiplier(battle.zone);
      }
      if (hasCascade) {
        weatherDmgMult *= 1.18;
      }
      if (
        skill.damageType === 'magical' &&
        player.tier3Branch === 'spellblade' &&
        battle.comboCount >= 3
      ) {
        weatherDmgMult *= 1.18;
      }

      const rawEnemyStats = getEffectiveEnemyCombatStats(enemy);
      const effectiveDefenderStats =
        skill.passiveTag === 'armor_pierce'
          ? { ...rawEnemyStats, def: Math.round(rawEnemyStats.def * 0.7) }
          : rawEnemyStats;

      const res = calculateDamage(effectiveAttacker, effectiveDefenderStats, {
        damageType: skill.damageType === 'magical' ? 'magical' : 'physical',
        powerMult: skill.powerMult ?? 1.3,
        staggerPower: scaledStaggerPower,
        defenderIsStaggered: enemy.staggeredTurns > 0,
        bonusCrit: skill.passiveTag === 'high_crit' ? 25 : 0,
        damageMult: weatherDmgMult,
      });

      if (skill.id === 'spd_t3_ult' && !res.isDodged) {
        battle.comboCount += 2; // +2 here + 1 in applyPlayerDamageResult = +3 total!
      }

      applyPlayerDamageResult(
        battle,
        player,
        enemy,
        skill.name,
        res,
        events,
        action.kind === 'ultimate'
      );

      if (!res.isDodged && enemy.currentHp > 0 && skill.damageType === 'physical' && player.tier3Branch === 'spellblade') {
        enemy.buffs = applyBuffToList(enemy.buffs, {
          type: 'burn',
          label: 'Arcane Burn',
          isDebuff: true,
          turns: 2,
          potency: 14,
        });
      }

      // Combo Synergy: Elemental Resonance (mag_t2_resonance) on magical skills
      if (
        !res.isDodged &&
        enemy.currentHp > 0 &&
        skill.damageType === 'magical' &&
        player.unlockedSkillIds.includes('mag_t2_resonance')
      ) {
        let hadBurn = false;
        enemy.buffs = enemy.buffs.map((b) => {
          if (b.isDebuff) {
            if (b.type === 'burn') hadBurn = true;
            return { ...b, turns: b.turns + 1 };
          }
          return b;
        });
        if (hadBurn) {
          const sparkDmg = Math.max(5, Math.round(pStats.matk * 0.45));
          enemy.currentHp = Math.max(0, enemy.currentHp - sparkDmg);
          battle.comboDamage += sparkDmg;
          events.vfx.push({
            target: 'enemy',
            text: `RESONANCE +${sparkDmg}`,
            color: '#38bdf8',
            yOffset: -18,
            burstColor: '#fb923c',
            burstCount: 10,
          });
          addBattleLog(
            battle,
            `Elemental Resonance detonated Burn for +${sparkDmg} DMG & extended debuffs +1t!`,
            'crit'
          );
          if (enemy.currentHp > 0) {
            checkBossPhaseTransition(battle, enemy, events);
          }
        } else if (enemy.buffs.some((b) => b.isDebuff)) {
          addBattleLog(battle, `Elemental Resonance extended enemy debuffs +1t!`, 'info');
        }
      }
    }

    finishPlayerTurn(battle, player, events);
    return events;
  }

  return events;
}

function dealStaggerToEnemy(
  battle: BattleState,
  enemy: CombatEnemy,
  amount: number,
  events: CombatActionEvents
) {
  if (enemy.staggeredTurns > 0 || enemy.currentHp <= 0) return;
  enemy.currentStagger = Math.max(0, enemy.currentStagger - amount);
  if (enemy.currentStagger === 0) {
    enemy.staggeredTurns = 2;
    enemy.animState = 'staggered';
    enemy.animTimer = 1.1;
    if (battle.comboCount > 0) {
      battle.comboCount += 1;
      battle.comboFlashSeq += 1;
      battle.maxComboCount = Math.max(battle.maxComboCount, battle.comboCount);
    }
    events.sfx.push('staggerBreak');
    events.vfx.push({
      target: 'enemy',
      text: 'STAGGER BREAK!',
      color: '#facc15',
      yOffset: -32,
      burstColor: '#facc15',
      burstCount: 24,
      hitstop: 0.08,
      trauma: 0.7,
      ringColor: '#facc15',
      flashColor: '#facc15',
    });
    addBattleLog(battle, `${enemy.name} is STAGGERED! (+50% DMG taken)`, 'stagger');
  }
}

function applyPassiveProcsOnHit(
  battle: BattleState,
  player: PlayerState,
  pStats: ReturnType<typeof computePlayerStats>,
  res: ReturnType<typeof calculateDamage>,
  events: CombatActionEvents
) {
  if (res.isDodged) return;

  if (
    res.isCrit &&
    (player.unlockedSkillIds.includes('phy_t1_might') ||
      player.unlockedSkillIds.includes('phy_t2_mastery'))
  ) {
    const hasTitan = player.unlockedSkillIds.includes('phy_t2_mastery');
    const ultGain = hasTitan ? 14 : 8;
    player.ultimateCharge = Math.min(100, player.ultimateCharge + ultGain);
    if (hasTitan) {
      player.currentMp = Math.min(pStats.mp, player.currentMp + 8);
    }
    events.vfx.push({
      target: 'player',
      text: hasTitan ? `CRIT SURGE +${ultGain}% ULT +8 MP` : `CRIT SURGE +${ultGain}% ULT`,
      color: '#facc15',
      yOffset: -18,
    });
  }

  if (
    player.unlockedSkillIds.includes('all_t1_seed') ||
    player.unlockedSkillIds.includes('all_t2_awakening')
  ) {
    const pct = player.unlockedSkillIds.includes('all_t2_awakening') ? 0.07 : 0.04;
    const healAmt = Math.max(3, Math.round(pStats.hp * pct));
    player.currentHp = Math.min(pStats.hp, player.currentHp + healAmt);
    events.vfx.push({
      target: 'player',
      text: `HARVEST +${healAmt} HP`,
      color: '#4ade80',
      yOffset: -34,
    });
  }
}

function applyPlayerDamageResult(
  battle: BattleState,
  player: PlayerState,
  enemy: CombatEnemy,
  moveName: string,
  res: ReturnType<typeof calculateDamage>,
  events: CombatActionEvents,
  isUltimate = false
) {
  if (res.isDodged) {
    events.sfx.push('dodge');
    events.vfx.push({ target: 'enemy', text: 'DODGED!', color: '#94a3b8' });
    addBattleLog(battle, `${moveName} missed — ${enemy.name} dodged!`, 'miss');
    return;
  }

  // Boss Phase 2 Barrier absorbs 50% damage for shieldHits charges
  if (enemy.shieldHits > 0) {
    enemy.shieldHits -= 1;
    res.damage = Math.max(1, Math.round(res.damage * 0.5));
    res.staggerDamage = Math.max(1, Math.round(res.staggerDamage * 0.65));
    events.vfx.push({
      target: 'enemy',
      text: `BARRIER (${enemy.shieldHits} LEFT)`,
      color: '#facc15',
      yOffset: -20,
    });
  }

  enemy.currentHp = Math.max(0, enemy.currentHp - res.damage);
  enemy.animState = enemy.currentHp === 0 ? 'death' : 'hit';
  enemy.animTimer = enemy.currentHp === 0 ? 0.65 : 0.36;

  // Build combo sequence & accumulate total combo damage (+extra stack from Shadowstrider/Relentless Flurry on crit)
  const extraComboFromCrit =
    res.isCrit &&
    (player.unlockedSkillIds.includes('spd_t3_tempo') ||
      player.tier3Branch === 'shadowstrider')
      ? 1
      : 0;
  battle.comboCount += 1 + extraComboFromCrit;
  battle.comboDamage += res.damage;
  battle.comboFlashSeq += 1;
  battle.maxComboCount = Math.max(battle.maxComboCount, battle.comboCount);
  battle.maxComboDamage = Math.max(battle.maxComboDamage, battle.comboDamage);
  const comboBonuses = getComboBonuses(battle.comboCount);

  if (res.isCrit || isUltimate) {
    events.sfx.push('crit');
  } else {
    events.sfx.push('hit');
  }
  events.sfx.push('comboUp');

  const extraComboParticles = Math.min(16, battle.comboCount * 2);
  const isComboMilestone =
    battle.comboCount === 3 ||
    battle.comboCount === 5 ||
    battle.comboCount === 8 ||
    (battle.comboCount >= 10 && battle.comboCount % 2 === 0);

  events.vfx.push({
    target: 'enemy',
    text: res.isCrit ? `CRIT ${res.damage}!` : `${res.damage}`,
    color: res.isCrit ? '#facc15' : '#ffffff',
    yOffset: 10,
    burstColor: isUltimate
      ? '#a855f7'
      : res.isCrit
      ? '#facc15'
      : battle.comboCount >= 3
      ? comboBonuses.tierColor
      : '#ef4444',
    burstCount: (isUltimate ? 28 : res.isCrit ? 18 : 10) + extraComboParticles,
    hitstop: isUltimate ? 0.08 : res.isCrit ? 0.06 : 0.03,
    trauma: Math.min(0.95, (isUltimate ? 0.8 : res.isCrit ? 0.55 : 0.28) + Math.min(0.25, battle.comboCount * 0.03)),
    ringColor: isUltimate ? '#facc15' : isComboMilestone ? comboBonuses.tierColor : undefined,
    flashColor: isUltimate ? '#a855f7' : isComboMilestone ? comboBonuses.tierColor : undefined,
  });

  if (battle.comboCount >= 2) {
    events.vfx.push({
      target: 'enemy',
      text: `${battle.comboCount}x COMBO! ${battle.comboDamage} TOT`,
      color: comboBonuses.tierColor,
      yOffset: -46,
      hitstop: isComboMilestone ? 0.05 : undefined,
    });
  }

  addBattleLog(
    battle,
    `${moveName} hit ${enemy.name} for ${res.damage}${res.isCrit ? ' CRIT' : ''}${
      battle.comboCount >= 2 ? ` (${battle.comboCount}x · ${battle.comboDamage} TOT!)` : '!'
    }`,
    res.isCrit ? 'crit' : 'hit'
  );

  const pStats = getEffectivePlayerCombatStats(player, battle);
  applyPassiveProcsOnHit(battle, player, pStats, res, events);

  if (enemy.currentHp > 0) {
    dealStaggerToEnemy(battle, enemy, res.staggerDamage, events);
    checkBossPhaseTransition(battle, enemy, events);
  }
}

function executePetAssistIfReady(
  battle: BattleState,
  player: PlayerState,
  events: CombatActionEvents
) {
  if (!player.equippedPetId) return;
  const pet = PET_CATALOG.find((p) => p.id === player.equippedPetId);
  if (!pet) return;

  battle.petTurnCounter += 1;
  if (battle.petTurnCounter < pet.assistEveryTurns) return;
  battle.petTurnCounter = 0;

  const pStats = getEffectivePlayerCombatStats(player, battle);
  if (pet.assistKind === 'heal_shield') {
    const healAmt = Math.max(8, Math.round((pStats.hp * pet.assistPower) / 100));
    player.currentHp = Math.min(pStats.hp, player.currentHp + healAmt);
    battle.playerBuffs = applyBuffToList(battle.playerBuffs, {
      type: 'def_up',
      label: pet.assistName,
      isDebuff: false,
      turns: 2,
      potency: 25,
    });
    events.sfx.push('heal');
    events.vfx.push({
      target: 'player',
      text: `${pet.name.toUpperCase()}: +${healAmt} HP`,
      color: pet.accent,
      yOffset: -36,
      ringColor: pet.accent,
    });
    addBattleLog(
      battle,
      `${pet.name} cast ${pet.assistName}: +${healAmt} HP & +25% DEF!`,
      'heal'
    );
    return;
  }

  const target = getActiveEnemy(battle);
  if (!target || target.currentHp <= 0) return;

  const eStats = getEffectiveEnemyCombatStats(target);
  const attacker: Stats =
    pet.assistKind === 'hybrid_ult'
      ? { ...pStats, atk: pStats.atk + Math.round(pStats.matk * 0.7) }
      : pStats;
  const res = calculateDamage(attacker, eStats, {
    damageType: pet.assistKind === 'magical_burn' ? 'magical' : 'physical',
    powerMult: pet.assistPower,
    staggerPower: pet.assistKind === 'hybrid_ult' ? 26 : 14,
    defenderIsStaggered: target.staggeredTurns > 0,
    allowDodge: false,
  });

  target.currentHp = Math.max(0, target.currentHp - res.damage);
  target.animState = target.currentHp === 0 ? 'death' : 'hit';
  target.animTimer = target.currentHp === 0 ? 0.65 : 0.3;
  battle.comboCount += 1;
  battle.comboDamage += res.damage;
  battle.comboFlashSeq += 1;
  battle.maxComboCount = Math.max(battle.maxComboCount, battle.comboCount);
  battle.maxComboDamage = Math.max(battle.maxComboDamage, battle.comboDamage);

  if (pet.assistKind === 'magical_burn' && target.currentHp > 0) {
    target.buffs = applyBuffToList(target.buffs, {
      type: 'burn',
      label: 'Cinder Burn',
      isDebuff: true,
      turns: 2,
      potency: 14,
    });
  }
  if (pet.assistKind === 'hybrid_ult') {
    player.ultimateCharge = Math.min(100, player.ultimateCharge + 10);
  }

  events.sfx.push('hit', 'comboUp');
  events.vfx.push({
    target: 'enemy',
    text: `${pet.name.toUpperCase()} -${res.damage}`,
    color: pet.accent,
    yOffset: -24,
    burstColor: pet.accent,
    burstCount: 10,
  });
  addBattleLog(
    battle,
    `${pet.name} assisted with ${pet.assistName} for ${res.damage} DMG!`,
    'hit'
  );
  if (target.currentHp > 0) {
    dealStaggerToEnemy(battle, target, res.staggerDamage, events);
    checkBossPhaseTransition(battle, target, events);
  }
}

function awardDefeatedEnemiesOnField(
  battle: BattleState,
  player: PlayerState,
  events: CombatActionEvents
): boolean {
  const deadUnprocessed = getFieldEnemies(battle).filter(
    (e) => e.currentHp <= 0 && !battle.processedDefeatUids.includes(e.uid)
  );
  for (const dead of deadUnprocessed) {
    grantEnemyDefeatRewards(battle, player, dead, events);
  }

  const living = getLivingFieldEnemies(battle);
  if (living.length > 0) {
    if (!living.some((e) => e.uid === battle.targetEnemyUid)) {
      battle.targetEnemyUid = living[0].uid;
    }
    return false;
  }

  // All field enemies defeated -> wave transition or battle victory
  if (battle.waveIndex + 1 < battle.wave.length) {
    battle.phase = 'wave_transition';
    battle.phaseTimer = 0.85;
  } else {
    battle.phase = 'victory';
    battle.phaseTimer = 0.6;
    events.sfx.push('victory');
  }
  return true;
}

function finishPlayerTurn(
  battle: BattleState,
  player: PlayerState,
  events: CombatActionEvents
) {
  // Trigger pet familiar assist if timer reached
  if (getLivingFieldEnemies(battle).length > 0) {
    executePetAssistIfReady(battle, player, events);
  }

  if (awardDefeatedEnemiesOnField(battle, player, events)) {
    return;
  }

  const living = getLivingFieldEnemies(battle);
  battle.pendingEnemyQueue = living.map((e) => e.uid);
  const firstActor = living[0];
  battle.pendingActorUid = firstActor.uid;
  battle.phase = 'animating';
  battle.phaseTimer = 0.48;
  battle.pendingEnemyAction =
    firstActor.ultimateCharge >= 100 || Math.random() < (firstActor.enraged ? 0.5 : 0.36)
      ? 'special'
      : 'basic';
}

function grantEnemyDefeatRewards(
  battle: BattleState,
  player: PlayerState,
  enemy: CombatEnemy,
  events: CombatActionEvents
) {
  if (battle.processedDefeatUids.includes(enemy.uid)) return;
  battle.processedDefeatUids.push(enemy.uid);

  enemy.animState = 'death';
  enemy.animTimer = 0.6;
  player.monstersDefeated += 1;
  player.gold += enemy.goldReward;
  player.materials[enemy.materialDrop.id] =
    (player.materials[enemy.materialDrop.id] ?? 0) + enemy.materialDrop.amount;

  const xpRes = grantXp(player, enemy.xpReward);
  Object.assign(player, xpRes.player);

  battle.rewards.xp += enemy.xpReward;
  battle.rewards.gold += enemy.goldReward;
  battle.rewards.materials[enemy.materialDrop.id] =
    (battle.rewards.materials[enemy.materialDrop.id] ?? 0) +
    enemy.materialDrop.amount;
  battle.rewards.levelsGained += xpRes.levelsGained;

  if (xpRes.levelsGained > 0) {
    events.sfx.push('levelUp');
    events.vfx.push({
      target: 'player',
      text: `LEVEL UP! Lv.${player.level}`,
      color: '#facc15',
      burstColor: '#facc15',
      burstCount: 22,
      ringColor: '#facc15',
    });
  }

  const dropChance =
    enemy.rarity === 'boss' ? 1.0 : enemy.rarity === 'elite' ? 0.55 : 0.28;
  if (Math.random() < dropChance) {
    const slots: EquipmentSlot[] = ['weapon', 'armor', 'helm', 'charm'];
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const rarity = rollRarityForEnemy(enemy.rarity, enemy.zone);
    const gear = generateEquipment(slot, rarity, enemy.zone);
    player.inventory.push(gear);
    battle.rewards.items.push(gear);
  }

  addBattleLog(
    battle,
    `${enemy.name} defeated! +${enemy.xpReward} XP, +${enemy.goldReward}G, +${enemy.materialDrop.amount} ${MATERIAL_META[enemy.materialDrop.id].name}`,
    'stagger'
  );
}

export function handleEnemyDefeated(
  battle: BattleState,
  player: PlayerState,
  enemy: CombatEnemy,
  events: CombatActionEvents
) {
  grantEnemyDefeatRewards(battle, player, enemy, events);
  awardDefeatedEnemiesOnField(battle, player, events);
}

export function stepBattleTimeline(
  battle: BattleState,
  player: PlayerState,
  dt: number
): CombatActionEvents {
  const events: CombatActionEvents = { sfx: [], vfx: [] };

  // Decay actor anim timers back to idle/staggered across all enemies
  if (battle.playerAnimTimer > 0) {
    battle.playerAnimTimer -= dt;
    if (battle.playerAnimTimer <= 0) {
      battle.playerAnim = 'idle';
    }
  }
  for (const en of getFieldEnemies(battle)) {
    if (en.animTimer > 0) {
      en.animTimer -= dt;
      if (en.animTimer <= 0 && en.currentHp > 0) {
        en.animState = en.staggeredTurns > 0 ? 'staggered' : 'idle';
      }
    }
  }

  if (battle.phase === 'qte_dodge' || battle.phase === 'qte_counter') {
    const qte = battle.qte;
    if (qte.result === 'pending') {
      qte.cursor += qte.direction * qte.speed * dt;
      if (qte.cursor >= 1) {
        qte.cursor = 1;
        qte.direction = -1;
      } else if (qte.cursor <= 0) {
        qte.cursor = 0;
        qte.direction = 1;
      }
      qte.resultTimer -= dt;
      if (qte.resultTimer <= 0) {
        resolveQteInput(battle, player, true, events);
      }
    }
    return events;
  }

  if (battle.phaseTimer > 0) {
    battle.phaseTimer -= dt;
    if (battle.phaseTimer > 0) return events;
  }

  if (battle.phase === 'animating') {
    battle.phase = 'enemy_turn';
    executeEnemyTurn(battle, player, events);
    return events;
  }

  if (battle.phase === 'wave_transition') {
    battle.waveIndex += 1;
    battle.adds = [];
    battle.pendingEnemyQueue = [];
    battle.pendingActorUid = null;
    const nextEnemy = battle.wave[battle.waveIndex];
    battle.targetEnemyUid = nextEnemy?.uid ?? null;

    if (battle.arenaTrialId) {
      const pStats = getEffectivePlayerCombatStats(player, battle);
      const hpRec = Math.round(pStats.hp * 0.25);
      const mpRec = Math.round(pStats.mp * 0.25);
      player.currentHp = Math.min(pStats.hp, player.currentHp + hpRec);
      player.currentMp = Math.min(pStats.mp, player.currentMp + mpRec);
      addBattleLog(
        battle,
        `Arena Breather: Restored +${hpRec} HP & +${mpRec} MP before next challenger!`,
        'heal'
      );
    } else if (nextEnemy) {
      const tpl = ENEMY_TEMPLATES.find((t) => t.id === nextEnemy.templateId);
      if (tpl?.dualPartnerId) {
        const partner = spawnEnemyFromTemplate(tpl.dualPartnerId);
        partner.isAdd = true;
        battle.adds.push(partner);
        addBattleLog(battle, `${partner.name} joins ${nextEnemy.name}!`, 'enemy');
      }
    }

    addBattleLog(
      battle,
      `Wave ${battle.waveIndex + 1}/${battle.wave.length}: ${nextEnemy.name} appears!`,
      'info'
    );
    battle.phase = 'player_turn';
    return events;
  }

  return events;
}

function advanceEnemyTurnOrEndRound(
  battle: BattleState,
  player: PlayerState,
  events: CombatActionEvents
) {
  if (player.currentHp <= 0) {
    battle.phase = 'defeat';
    events.sfx.push('defeat');
    return;
  }

  // Remove processed actor from queue
  const currentActorUid = battle.pendingActorUid;
  battle.pendingEnemyQueue = battle.pendingEnemyQueue.filter((uid) => {
    if (uid === currentActorUid) return false;
    const found = getFieldEnemies(battle).find((e) => e.uid === uid);
    return Boolean(found && found.currentHp > 0);
  });

  if (battle.pendingEnemyQueue.length > 0) {
    const nextUid = battle.pendingEnemyQueue[0];
    const nextEnemy = getFieldEnemies(battle).find((e) => e.uid === nextUid);
    if (nextEnemy && nextEnemy.currentHp > 0) {
      battle.pendingActorUid = nextUid;
      battle.pendingEnemyAction =
        nextEnemy.ultimateCharge >= 100 || Math.random() < 0.3 ? 'special' : 'basic';
      executeEnemyTurn(battle, player, events);
      return;
    }
  }

  // All living enemies finished their round -> tick buffs/burn!
  tickBuffsAndCooldowns(battle, player, events);
  if (awardDefeatedEnemiesOnField(battle, player, events)) {
    return;
  }
  battle.pendingActorUid = null;
  battle.turnCount += 1;
  battle.phase = 'player_turn';
}

function executeEnemyTurn(
  battle: BattleState,
  player: PlayerState,
  events: CombatActionEvents
) {
  const enemy = getAttackerEnemy(battle);
  if (!enemy || enemy.currentHp <= 0) {
    advanceEnemyTurnOrEndRound(battle, player, events);
    return;
  }

  if (enemy.staggeredTurns > 0) {
    enemy.staggeredTurns -= 1;
    if (enemy.staggeredTurns === 0) {
      enemy.currentStagger = enemy.maxStagger;
      enemy.animState = 'idle';
      addBattleLog(battle, `${enemy.name} recovers from Stagger!`, 'info');
    } else {
      addBattleLog(battle, `${enemy.name} is Staggered and loses its turn!`, 'stagger');
      advanceEnemyTurnOrEndRound(battle, player, events);
      return;
    }
  }

  // Summoner monsters conjure an ally add once when alone on field
  if (
    enemy.rarity !== 'boss' &&
    enemy.summonTemplateId &&
    !enemy.summonedOnce &&
    battle.adds.filter((a) => a.currentHp > 0).length === 0
  ) {
    const add = spawnEnemyFromTemplate(enemy.summonTemplateId);
    add.isAdd = true;
    enemy.summonedOnce = true;
    battle.adds.push(add);
    enemy.animState = 'attack';
    enemy.animTimer = 0.4;
    events.sfx.push('heal');
    events.vfx.push({
      target: 'enemy',
      text: `SUMMONED ${add.name.toUpperCase()}!`,
      color: '#c084fc',
      yOffset: -30,
      burstColor: '#c084fc',
      burstCount: 16,
    });
    addBattleLog(battle, `${enemy.name} summoned ${add.name} into battle!`, 'enemy');
    advanceEnemyTurnOrEndRound(battle, player, events);
    return;
  }

  const pStats = getEffectivePlayerCombatStats(player, battle);
  const eStats = getEffectiveEnemyCombatStats(enemy);
  const enemyFireMult = isFireEnemySprite(enemy.sprite)
    ? getWeatherFireDamageMultiplier(battle.zone)
    : 1;
  const isSpecial = battle.pendingEnemyAction === 'special';

  if (isSpecial) {
    enemy.ultimateCharge = 0;
    const res = calculateDamage(eStats, pStats, {
      damageType: 'physical',
      powerMult: enemy.specialMult,
      staggerPower: enemy.specialStagger,
      defenderIsStaggered: false,
      defenderIsGuarding: battle.playerGuarding,
      damageMult: enemyFireMult,
      allowDodge: false,
    });
    battle.phase = 'qte_dodge';
    battle.qte = {
      active: true,
      phase: 'dodge',
      promptLabel: `DODGE ${enemy.specialName.toUpperCase()}!`,
      cursor: 0.05,
      speed: 1.55 + battle.zone * 0.11 + (enemy.enraged ? 0.2 : 0),
      direction: 1,
      zoneStart: 0.36,
      zoneEnd: 0.64,
      result: 'pending',
      resultTimer: 2.3,
      pendingEnemyDamage: res.damage,
      pendingEnemyStagger: res.staggerDamage,
      pendingMoveName: enemy.specialName,
    };
    addBattleLog(
      battle,
      `${enemy.name} telegraphs ${enemy.specialName}! Press SPACE or Click to DODGE!`,
      'enemy'
    );
    return;
  }

  // Standard Enemy Attack
  enemy.animState = 'attack';
  enemy.animTimer = 0.36;
  enemy.ultimateCharge = Math.min(100, enemy.ultimateCharge + (enemy.enraged ? 50 : 35));
  const dmgType = eStats.matk > eStats.atk ? 'magical' : 'physical';
  const res = calculateDamage(eStats, pStats, {
    damageType: dmgType,
    powerMult: 1.0,
    staggerPower: 18,
    defenderIsStaggered: false,
    defenderIsGuarding: battle.playerGuarding,
    damageMult: enemyFireMult,
  });

  applyDamageToPlayer(battle, player, enemy, 'Attack', res, events);
  if (awardDefeatedEnemiesOnField(battle, player, events)) {
    return;
  }
  advanceEnemyTurnOrEndRound(battle, player, events);
}

export function resolveQteInput(
  battle: BattleState,
  player: PlayerState,
  timedOut = false,
  existingEvents?: CombatActionEvents
): CombatActionEvents {
  const events = existingEvents ?? { sfx: [], vfx: [] };
  if (battle.phase !== 'qte_dodge' && battle.phase !== 'qte_counter') {
    return events;
  }
  const qte = battle.qte;
  const attacker = getAttackerEnemy(battle);
  const pStats = getEffectivePlayerCombatStats(player, battle);
  const weatherFx = getWeatherCombatEffect(battle.zone);
  const insideZone =
    !timedOut && qte.cursor >= qte.zoneStart && qte.cursor <= qte.zoneEnd;

  if (battle.phase === 'qte_dodge') {
    if (insideZone) {
      events.sfx.push('dodge');
      events.vfx.push({
        target: 'player',
        text: 'PERFECT DODGE!',
        color: '#38bdf8',
        ringColor: '#38bdf8',
      });
      if (
        player.unlockedSkillIds.includes('spd_t1_step') ||
        player.unlockedSkillIds.includes('spd_t2_phantom')
      ) {
        player.ultimateCharge = Math.min(100, player.ultimateCharge + 12);
        battle.playerBuffs = applyBuffToList(battle.playerBuffs, {
          type: 'spd_up',
          label: 'Shadow Step',
          isDebuff: false,
          turns: 2,
          potency: 25,
        });
        events.vfx.push({
          target: 'player',
          text: 'SHADOW STEP +12% ULT',
          color: '#facc15',
          yOffset: -18,
        });
      }
      addBattleLog(
        battle,
        `Dodged ${qte.pendingMoveName}! Counter-Attack window open!`,
        'stagger'
      );
      battle.phase = 'qte_counter';
      battle.qte = {
        ...qte,
        active: true,
        phase: 'counter',
        promptLabel: 'COUNTER ATTACK!',
        cursor: 0.1,
        speed: 1.8 + battle.zone * 0.1,
        direction: 1,
        zoneStart: 0.38,
        zoneEnd: 0.62,
        result: 'pending',
        resultTimer: 2.0,
      };
      return events;
    }

    // Failed Dodge -> Take full special move damage
    qte.active = false;
    attacker.animState = 'attack';
    attacker.animTimer = 0.4;
    applyDamageToPlayer(
      battle,
      player,
      attacker,
      qte.pendingMoveName,
      {
        damage: qte.pendingEnemyDamage,
        staggerDamage: qte.pendingEnemyStagger,
        isCrit: false,
        isBlocked: false,
        isDodged: false,
      },
      events
    );
    if (awardDefeatedEnemiesOnField(battle, player, events)) {
      return events;
    }
    advanceEnemyTurnOrEndRound(battle, player, events);
    return events;
  }

  // Counter-Attack QTE phase (hits attacker if alive, else active target)
  const counterTarget = attacker.currentHp > 0 ? attacker : getActiveEnemy(battle);
  qte.active = false;
  if (insideZone && counterTarget) {
    battle.playerAnim = 'attack';
    battle.playerAnimTimer = 0.42;
    player.ultimateCharge = Math.min(100, player.ultimateCharge + 24);
    const comboBonuses = getComboBonuses(battle.comboCount);
    const boostedAttacker = {
      ...pStats,
      critDmg: pStats.critDmg + comboBonuses.critDmgBonus,
    };
    const eStats = getEffectiveEnemyCombatStats(counterTarget);
    const shadowCounterMult = player.tier3Branch === 'shadowstrider' ? 1.35 : 1;
    const vanguardStaggerMult = player.tier3Branch === 'vanguard' ? 1.3 : 1;
    const counterRes = calculateDamage(boostedAttacker, eStats, {
      damageType: 'physical',
      powerMult: 1.65,
      staggerPower: Math.round(48 * comboBonuses.staggerMult * weatherFx.staggerMult * vanguardStaggerMult),
      defenderIsStaggered: counterTarget.staggeredTurns > 0,
      forceCrit: true,
      allowDodge: false,
      damageMult: shadowCounterMult,
    });
    events.sfx.push('counter');
    applyPlayerDamageResult(battle, player, counterTarget, 'Counter Strike', counterRes, events);
    if (awardDefeatedEnemiesOnField(battle, player, events)) {
      return events;
    }
  } else {
    addBattleLog(battle, 'Counter-Attack missed the timing window.', 'miss');
  }

  advanceEnemyTurnOrEndRound(battle, player, events);
  return events;
}

function applyDamageToPlayer(
  battle: BattleState,
  player: PlayerState,
  attacker: CombatEnemy,
  moveName: string,
  res: {
    damage: number;
    staggerDamage: number;
    isCrit: boolean;
    isBlocked: boolean;
    isDodged: boolean;
  },
  events: CombatActionEvents
) {
  const attackerName = attacker.name;
  if (res.isDodged) {
    events.sfx.push('dodge');
    events.vfx.push({ target: 'player', text: 'DODGE!', color: '#38bdf8' });
    if (
      player.unlockedSkillIds.includes('spd_t1_step') ||
      player.unlockedSkillIds.includes('spd_t2_phantom')
    ) {
      player.ultimateCharge = Math.min(100, player.ultimateCharge + 12);
      battle.playerBuffs = applyBuffToList(battle.playerBuffs, {
        type: 'spd_up',
        label: 'Shadow Step',
        isDebuff: false,
        turns: 2,
        potency: 25,
      });
      events.vfx.push({
        target: 'player',
        text: 'SHADOW STEP +12% ULT',
        color: '#facc15',
        yOffset: -18,
      });
    }
    addBattleLog(
      battle,
      `${attackerName}'s ${moveName} missed — ${player.name} dodged!`,
      'miss'
    );
    return;
  }

  player.currentHp = Math.max(0, player.currentHp - res.damage);
  player.currentStagger = Math.max(0, player.currentStagger - res.staggerDamage);
  player.ultimateCharge = Math.min(100, player.ultimateCharge + 10);

  if (player.currentStagger === 0) {
    player.currentStagger = player.maxStagger;
    battle.playerAnim = 'staggered';
    battle.playerAnimTimer = 0.65;
  } else {
    battle.playerAnim = player.currentHp === 0 ? 'death' : 'hit';
    battle.playerAnimTimer = player.currentHp === 0 ? 0.7 : 0.35;
  }

  // Passive Procs on Block / Guard
  if (res.isBlocked) {
    const pStats = getEffectivePlayerCombatStats(player, battle);
    if (player.unlockedSkillIds.includes('def_t2_riposte')) {
      battle.comboCount += 1;
      battle.comboFlashSeq += 1;
      battle.maxComboCount = Math.max(battle.maxComboCount, battle.comboCount);
      player.currentMp = Math.min(pStats.mp, player.currentMp + 10);
      player.ultimateCharge = Math.min(100, player.ultimateCharge + 10);
      events.vfx.push({
        target: 'player',
        text: 'PARRY RIPOSTE +1 COMBO',
        color: '#facc15',
        yOffset: -20,
      });
    }
    if (player.tier3Branch === 'vanguard') {
      const healAmt = Math.max(6, Math.round(pStats.hp * 0.06));
      player.currentHp = Math.min(pStats.hp, player.currentHp + healAmt);
      events.vfx.push({
        target: 'player',
        text: `BULWARK +${healAmt} HP`,
        color: '#4ade80',
        yOffset: -32,
      });
    }
    if (
      player.unlockedSkillIds.includes('def_t1_plate') ||
      player.unlockedSkillIds.includes('def_t2_bulwark')
    ) {
      if (attacker && attacker.currentHp > 0) {
        const mult = player.unlockedSkillIds.includes('def_t2_bulwark') ? 0.55 : 0.3;
        const thornsDmg = Math.max(4, Math.round(pStats.def * mult));
        attacker.currentHp = Math.max(0, attacker.currentHp - thornsDmg);
        events.vfx.push({
          target: 'enemy',
          text: `THORNS -${thornsDmg}`,
          color: '#94a3b8',
          yOffset: 16,
          burstColor: '#94a3b8',
          burstCount: 8,
        });
        if (attacker.currentHp > 0) {
          dealStaggerToEnemy(battle, attacker, 12, events);
          checkBossPhaseTransition(battle, attacker, events);
        }
      }
    }
  }

  events.sfx.push(res.isBlocked ? 'block' : 'hit');
  events.vfx.push({
    target: 'player',
    text: res.isBlocked ? `BLOCK -${res.damage}` : `-${res.damage}`,
    color: res.isBlocked ? '#94a3b8' : '#ef4444',
    burstColor: '#ef4444',
    burstCount: res.isBlocked ? 5 : 12,
    trauma: res.isBlocked ? 0.15 : 0.38,
  });

  if (!res.isBlocked && battle.comboCount > 0) {
    const brokenHits = battle.comboCount;
    const brokenDamage = battle.comboDamage;
    battle.comboCount = 0;
    battle.comboDamage = 0;
    if (brokenHits >= 2) {
      events.sfx.push('comboBreak');
      events.vfx.push({
        target: 'player',
        text: 'COMBO BROKEN!',
        color: '#fb7185',
        yOffset: -16,
      });
      addBattleLog(
        battle,
        `${attackerName}'s ${moveName} dealt ${res.damage} — ${brokenHits}x Combo (${brokenDamage} DMG) broken!`,
        'enemy'
      );
      return;
    }
  }

  addBattleLog(
    battle,
    `${attackerName}'s ${moveName} dealt ${res.damage}${res.isBlocked ? ' (Blocked)' : ''}!`,
    'enemy'
  );
}

export function getUnlockedConsumables(player: PlayerState): ConsumableItem[] {
  return player.consumables.filter((c) => c.quantity > 0);
}

export function getEquippedSkillsList(player: PlayerState) {
  return player.equippedSkillIds
    .map((id) => SKILL_TREE.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
}
