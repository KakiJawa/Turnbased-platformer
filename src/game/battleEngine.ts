import { MATERIAL_META, SKILL_TREE } from './data';
import {
  calculateDamage,
  computePlayerStats,
  generateEquipment,
  getSkillById,
  grantXp,
  rollRarityForEnemy,
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
} from './types';

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
  text: string;
  tone: 'info' | 'hit' | 'crit' | 'stagger' | 'heal' | 'enemy';
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
  wave: CombatEnemy[];
  waveIndex: number;
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

let logSeq = 1;

export function createBattleState(
  zone: number,
  encounterRarity: EnemyRarity,
  sourceEntityId: string,
  wave: CombatEnemy[]
): BattleState {
  const first = wave[0];
  return {
    zone,
    encounterRarity,
    sourceEntityId,
    wave,
    waveIndex: 0,
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
    logs: [
      {
        id: logSeq++,
        text: `Wave 1/${wave.length}: ${first.name} steps forward!`,
        tone: 'info',
      },
    ],
    rewards: {
      xp: 0,
      gold: 0,
      materials: {},
      items: [],
      levelsGained: 0,
    },
    pendingEnemyAction: null,
    comboCount: 0,
    comboDamage: 0,
    maxComboCount: 0,
    maxComboDamage: 0,
    comboFlashSeq: 0,
  };
}

export function addBattleLog(
  battle: BattleState,
  text: string,
  tone: BattleLogEntry['tone'] = 'info'
) {
  battle.logs = [{ id: logSeq++, text, tone }, ...battle.logs].slice(0, 6);
}

export function getActiveEnemy(battle: BattleState): CombatEnemy {
  return battle.wave[battle.waveIndex];
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
  // Tick player buffs (regen, etc.)
  const pStats = computePlayerStats(player, battle.playerBuffs);
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

  // Tick enemy buffs (burn)
  const enemy = getActiveEnemy(battle);
  if (enemy && enemy.currentHp > 0) {
    const nextEnemyBuffs: ActiveBuff[] = [];
    for (const b of enemy.buffs) {
      if (b.type === 'burn') {
        const burnDmg = Math.max(4, Math.round((enemy.stats.hp * b.potency) / 200));
        enemy.currentHp = Math.max(0, enemy.currentHp - burnDmg);
        events.vfx.push({
          target: 'enemy',
          text: `-${burnDmg} BURN`,
          color: '#fb923c',
          burstColor: '#f97316',
          burstCount: 6,
        });
      }
      if (b.turns - 1 > 0) {
        nextEnemyBuffs.push({ ...b, turns: b.turns - 1 });
      }
    }
    enemy.buffs = nextEnemyBuffs;
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
): CombatActionEvents {
  const events: CombatActionEvents = { sfx: [], vfx: [] };
  if (battle.phase !== 'player_turn') return events;

  const enemy = getActiveEnemy(battle);
  const pStats = computePlayerStats(player, battle.playerBuffs);
  battle.playerGuarding = false;

  // Tick existing skill cooldowns when taking a turn action (excluding any skill cast this turn)
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
    player.currentMp = Math.min(pStats.mp, player.currentMp + 8);
    player.ultimateCharge = Math.min(100, player.ultimateCharge + 14);
    events.sfx.push('block');
    events.vfx.push({
      target: 'player',
      text: 'GUARD +8 MP',
      color: '#38bdf8',
      ringColor: '#38bdf8',
    });
    addBattleLog(battle, `${player.name} braces in Guard (+8 MP).`, 'info');
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
      const scaledStagger = Math.round(item.power * comboBonuses.staggerMult);
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
    const boostedAttacker = {
      ...pStats,
      critDmg: pStats.critDmg + comboBonuses.critDmgBonus,
    };
    const res = calculateDamage(boostedAttacker, enemy.stats, {
      damageType: 'physical',
      powerMult: 1.0,
      staggerPower: Math.round(24 * comboBonuses.staggerMult),
      defenderIsStaggered: enemy.staggeredTurns > 0,
    });
    applyPlayerDamageResult(battle, enemy, 'Basic Strike', res, events);
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
      // Hybrid Apex Zenith scales with ATK + MATK; active combo scales Crit DMG & Stagger DMG
      const baseOffense =
        skill.id === 'all_t2_ult'
          ? { ...pStats, atk: pStats.atk + Math.round(pStats.matk * 0.85) }
          : pStats;
      const effectiveAttacker = {
        ...baseOffense,
        critDmg: baseOffense.critDmg + comboBonuses.critDmgBonus,
      };
      const scaledStaggerPower = Math.round(
        (skill.staggerPower ?? 30) * comboBonuses.staggerMult
      );
      const res = calculateDamage(effectiveAttacker, enemy.stats, {
        damageType: skill.damageType === 'magical' ? 'magical' : 'physical',
        powerMult: skill.powerMult ?? 1.3,
        staggerPower: scaledStaggerPower,
        defenderIsStaggered: enemy.staggeredTurns > 0,
        bonusCrit: skill.passiveTag === 'high_crit' ? 25 : 0,
      });
      applyPlayerDamageResult(
        battle,
        enemy,
        skill.name,
        res,
        events,
        action.kind === 'ultimate'
      );
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
    enemy.staggeredTurns = 2; // Staggered! Skips turn and takes 1.5x damage
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

function applyPlayerDamageResult(
  battle: BattleState,
  enemy: CombatEnemy,
  moveName: string,
  res: ReturnType<typeof calculateDamage>,
  events: CombatActionEvents,
  isUltimate = false
) {
  if (res.isDodged) {
    events.sfx.push('dodge');
    events.vfx.push({ target: 'enemy', text: 'DODGED!', color: '#94a3b8' });
    addBattleLog(battle, `${enemy.name} dodged ${moveName}!`, 'info');
    return;
  }

  enemy.currentHp = Math.max(0, enemy.currentHp - res.damage);
  enemy.animState = enemy.currentHp === 0 ? 'death' : 'hit';
  enemy.animTimer = enemy.currentHp === 0 ? 0.65 : 0.36;

  // Build combo sequence & accumulate total combo damage
  battle.comboCount += 1;
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

  if (enemy.currentHp > 0) {
    dealStaggerToEnemy(battle, enemy, res.staggerDamage, events);
  }
}

function finishPlayerTurn(
  battle: BattleState,
  player: PlayerState,
  events: CombatActionEvents
) {
  const enemy = getActiveEnemy(battle);
  if (enemy.currentHp <= 0) {
    handleEnemyDefeated(battle, player, enemy, events);
    return;
  }
  battle.phase = 'animating';
  battle.phaseTimer = 0.48;
  battle.pendingEnemyAction =
    enemy.ultimateCharge >= 100 || Math.random() < 0.36 ? 'special' : 'basic';
}

export function handleEnemyDefeated(
  battle: BattleState,
  player: PlayerState,
  enemy: CombatEnemy,
  events: CombatActionEvents
) {
  enemy.animState = 'death';
  enemy.animTimer = 0.6;
  player.monstersDefeated += 1;
  player.gold += enemy.goldReward;
  player.materials[enemy.materialDrop.id] += enemy.materialDrop.amount;

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

  // Loot drop chance scaled by enemy rarity & zone
  const dropChance =
    enemy.rarity === 'boss' ? 1.0 : enemy.rarity === 'elite' ? 0.55 : 0.28;
  if (Math.random() < dropChance) {
    const slots: EquipmentSlot[] = ['weapon', 'armor', 'helm', 'charm'];
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const rarity = rollRarityForEnemy(enemy.rarity, battle.zone);
    const gear = generateEquipment(slot, rarity, battle.zone);
    player.inventory.push(gear);
    battle.rewards.items.push(gear);
  }

  addBattleLog(
    battle,
    `${enemy.name} defeated! +${enemy.xpReward} XP, +${enemy.goldReward}G, +${enemy.materialDrop.amount} ${MATERIAL_META[enemy.materialDrop.id].name}`,
    'stagger'
  );

  if (battle.waveIndex + 1 < battle.wave.length) {
    battle.phase = 'wave_transition';
    battle.phaseTimer = 0.85;
  } else {
    battle.phase = 'victory';
    battle.phaseTimer = 0.6;
    events.sfx.push('victory');
  }
}

export function stepBattleTimeline(
  battle: BattleState,
  player: PlayerState,
  dt: number
): CombatActionEvents {
  const events: CombatActionEvents = { sfx: [], vfx: [] };
  const enemy = getActiveEnemy(battle);

  // Decay actor anim timers back to idle/staggered
  if (battle.playerAnimTimer > 0) {
    battle.playerAnimTimer -= dt;
    if (battle.playerAnimTimer <= 0) {
      battle.playerAnim = 'idle';
    }
  }
  if (enemy && enemy.animTimer > 0) {
    enemy.animTimer -= dt;
    if (enemy.animTimer <= 0 && enemy.currentHp > 0) {
      enemy.animState = enemy.staggeredTurns > 0 ? 'staggered' : 'idle';
    }
  }

  // QTE Cursor movement for Dodge & Counter Attack
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
        resolveQteInput(battle, player, true, events); // Timed out -> fail
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
    const nextEnemy = getActiveEnemy(battle);
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

function executeEnemyTurn(
  battle: BattleState,
  player: PlayerState,
  events: CombatActionEvents
) {
  const enemy = getActiveEnemy(battle);
  if (!enemy || enemy.currentHp <= 0) return;

  // Recover from stagger?
  if (enemy.staggeredTurns > 0) {
    enemy.staggeredTurns -= 1;
    if (enemy.staggeredTurns === 0) {
      enemy.currentStagger = enemy.maxStagger;
      enemy.animState = 'idle';
      addBattleLog(battle, `${enemy.name} recovers from Stagger!`, 'info');
    } else {
      addBattleLog(battle, `${enemy.name} is Staggered and loses its turn!`, 'stagger');
      tickBuffsAndCooldowns(battle, player, events);
      if (enemy.currentHp <= 0) {
        handleEnemyDefeated(battle, player, enemy, events);
        return;
      }
      battle.turnCount += 1;
      battle.phase = 'player_turn';
      return;
    }
  }

  const pStats = computePlayerStats(player, battle.playerBuffs);
  const isSpecial = battle.pendingEnemyAction === 'special';

  if (isSpecial) {
    // Launch Dodge QTE!
    enemy.ultimateCharge = 0;
    const res = calculateDamage(enemy.stats, pStats, {
      damageType: 'physical',
      powerMult: enemy.specialMult,
      staggerPower: enemy.specialStagger,
      defenderIsStaggered: false,
      defenderIsGuarding: battle.playerGuarding,
      allowDodge: false,
    });
    battle.phase = 'qte_dodge';
    battle.qte = {
      active: true,
      phase: 'dodge',
      promptLabel: `DODGE ${enemy.specialName.toUpperCase()}!`,
      cursor: 0.05,
      speed: 1.55 + battle.zone * 0.12,
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
  enemy.ultimateCharge = Math.min(100, enemy.ultimateCharge + 35);
  const dmgType = enemy.stats.matk > enemy.stats.atk ? 'magical' : 'physical';
  const res = calculateDamage(enemy.stats, pStats, {
    damageType: dmgType,
    powerMult: 1.0,
    staggerPower: 18,
    defenderIsStaggered: false,
    defenderIsGuarding: battle.playerGuarding,
  });

  applyDamageToPlayer(battle, player, enemy.name, 'Attack', res, events);
  if (player.currentHp <= 0) {
    battle.phase = 'defeat';
    events.sfx.push('defeat');
    return;
  }

  tickBuffsAndCooldowns(battle, player, events);
  if (enemy.currentHp <= 0) {
    handleEnemyDefeated(battle, player, enemy, events);
    return;
  }
  battle.turnCount += 1;
  battle.phase = 'player_turn';
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
  const enemy = getActiveEnemy(battle);
  const pStats = computePlayerStats(player, battle.playerBuffs);
  const insideZone =
    !timedOut && qte.cursor >= qte.zoneStart && qte.cursor <= qte.zoneEnd;

  if (battle.phase === 'qte_dodge') {
    if (insideZone) {
      // Successful Dodge -> Immediately trigger Counter-Attack QTE!
      events.sfx.push('dodge');
      events.vfx.push({
        target: 'player',
        text: 'PERFECT DODGE!',
        color: '#38bdf8',
        ringColor: '#38bdf8',
      });
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
        speed: 1.8 + battle.zone * 0.12,
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
    enemy.animState = 'attack';
    enemy.animTimer = 0.4;
    applyDamageToPlayer(
      battle,
      player,
      enemy.name,
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
    if (player.currentHp <= 0) {
      battle.phase = 'defeat';
      events.sfx.push('defeat');
      return events;
    }
    tickBuffsAndCooldowns(battle, player, events);
    if (enemy.currentHp <= 0) {
      handleEnemyDefeated(battle, player, enemy, events);
      return events;
    }
    battle.turnCount += 1;
    battle.phase = 'player_turn';
    return events;
  }

  // Counter-Attack QTE phase
  qte.active = false;
  if (insideZone) {
    battle.playerAnim = 'attack';
    battle.playerAnimTimer = 0.42;
    player.ultimateCharge = Math.min(100, player.ultimateCharge + 24);
    const comboBonuses = getComboBonuses(battle.comboCount);
    const boostedAttacker = {
      ...pStats,
      critDmg: pStats.critDmg + comboBonuses.critDmgBonus,
    };
    const counterRes = calculateDamage(boostedAttacker, enemy.stats, {
      damageType: 'physical',
      powerMult: 1.65,
      staggerPower: Math.round(48 * comboBonuses.staggerMult),
      defenderIsStaggered: enemy.staggeredTurns > 0,
      forceCrit: true,
      allowDodge: false,
    });
    events.sfx.push('counter');
    applyPlayerDamageResult(battle, enemy, 'Counter Strike', counterRes, events);
    if (enemy.currentHp <= 0) {
      handleEnemyDefeated(battle, player, enemy, events);
      return events;
    }
  } else {
    addBattleLog(battle, 'Counter-Attack missed the timing window.', 'info');
  }

  tickBuffsAndCooldowns(battle, player, events);
  if (enemy.currentHp <= 0) {
    handleEnemyDefeated(battle, player, enemy, events);
    return events;
  }
  battle.turnCount += 1;
  battle.phase = 'player_turn';
  return events;
}

function applyDamageToPlayer(
  battle: BattleState,
  player: PlayerState,
  attackerName: string,
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
  if (res.isDodged) {
    events.sfx.push('dodge');
    events.vfx.push({ target: 'player', text: 'DODGE!', color: '#38bdf8' });
    addBattleLog(battle, `${player.name} nimbly dodged ${attackerName}!`, 'info');
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
