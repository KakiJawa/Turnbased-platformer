import { useCallback, useEffect, useRef, useState } from 'react';
import { BattleHud } from './components/BattleHud';
import { ExploreHud } from './components/ExploreHud';
import { FireplaceTownModal, TownTab } from './components/FireplaceTownModal';
import { InventoryModal } from './components/InventoryModal';
import { SkillTreeModal } from './components/SkillTreeModal';
import { OutcomeModal, PauseModal, BattleVictoryModal, VictoryRecapData } from './components/StatusModals';
import { TitleOverlay } from './components/TitleOverlay';
import { audio } from './game/audio';
import {
  BattleState,
  CombatActionEvents,
  createBattleState,
  executePlayerAction,
  getActiveEnemy,
  getEquippedSkillsList,
  getLivingFieldEnemies,
  resolveQteInput,
  stepBattleTimeline,
  switchBattleTarget,
} from './game/battleEngine';
import {
  BATTLE_ADD_POSITIONS,
  BATTLE_ENEMY_POS,
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  renderBattleFrame,
  renderExploreFrame,
} from './game/canvasRenderer';
import {
  EncounterTransitionState,
  createEncounterTransition,
  renderEncounterTransition,
  startEncounterTransition,
  stepEncounterTransition,
} from './game/encounterTransition';
import { ARENA_TRIALS, MATERIAL_META, PET_CATALOG, SHOP_CONSUMABLES, TIER3_SPECIALIZATIONS } from './game/data';
import {
  clearRunState,
  getSavedRunSummary,
  loadRunState,
  saveRunState,
  ZoneEntityProgress,
} from './game/persistence';
import {
  PlatformerPlayer,
  createPlatformerPlayer,
  stepPlatformer,
} from './game/platformer';
import {
  advanceToHeroClass,
  advanceToTier3Class,
  bulkDisposeInventory,
  buyPetFamiliar,
  computePlayerStats,
  createInitialPlayer,
  enchantEquipment,
  equipPetFamiliar,
  generateEquipment,
  getVoidTowerMutator,
  grantXp,
  loadSkillPreset,
  reforgeEquipment,
  respecSkills,
  rollRarityForEnemy,
  saveSkillPreset,
  spawnArenaBossWave,
  spawnEnemyWave,
  spawnVoidTowerWave,
  toggleEquipSkill,
  toggleEquipmentLock,
  unlockSkillNode,
} from './game/rpgLogic';
import { buildStage } from './game/stages';
import {
  EquipmentSlot,
  GameMode,
  MaterialId,
  PlayerState,
  StageDefinition,
  WorldEntity,
} from './game/types';
import { VfxManager } from './game/vfx';
import { WeatherSystem } from './game/weather';

function snapshotStageProgress(stage: StageDefinition): ZoneEntityProgress {
  return {
    defeatedEntityIds: stage.entities
      .filter((e) => e.kind === 'enemy' && e.defeated)
      .map((e) => e.id),
    openedChestIds: stage.entities
      .filter((e) => e.kind === 'chest' && e.opened)
      .map((e) => e.id),
    collectedPickupIds: stage.entities
      .filter((e) => (e.kind === 'gold' || e.kind === 'material') && e.collected)
      .map((e) => e.id),
    usedShrineIds: stage.entities
      .filter((e) => e.kind === 'shrine' && e.used)
      .map((e) => e.id),
  };
}

function applyZoneProgressToStage(
  stage: StageDefinition,
  prog?: ZoneEntityProgress
): void {
  if (!prog) return;
  const defeatedSet = new Set(prog.defeatedEntityIds);
  const openedSet = new Set(prog.openedChestIds);
  const collectedSet = new Set(prog.collectedPickupIds);
  const shrineSet = new Set(prog.usedShrineIds);
  for (const ent of stage.entities) {
    if (ent.kind === 'enemy' && defeatedSet.has(ent.id)) ent.defeated = true;
    if (ent.kind === 'chest' && openedSet.has(ent.id)) ent.opened = true;
    if ((ent.kind === 'gold' || ent.kind === 'material') && collectedSet.has(ent.id)) {
      ent.collected = true;
    }
    if (ent.kind === 'shrine' && shrineSet.has(ent.id)) ent.used = true;
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable simulation refs (never cause 60Hz React re-renders)
  const modeRef = useRef<GameMode>('title');
  const playerRef = useRef<PlayerState>(createInitialPlayer());
  const stageRef = useRef<StageDefinition>(buildStage(1));
  const zoneProgressRef = useRef<Record<number, ZoneEntityProgress>>({});
  const pPlayerRef = useRef<PlatformerPlayer>(createPlatformerPlayer());
  const battleRef = useRef<BattleState | null>(null);
  const vfxRef = useRef<VfxManager>(new VfxManager());
  const weatherRef = useRef<WeatherSystem>(new WeatherSystem());
  const encounterRef = useRef<EncounterTransitionState>(createEncounterTransition());
  const nearbyRef = useRef<WorldEntity | null>(null);
  const nearBouncePadRef = useRef<WorldEntity | null>(null);
  const touchDirRef = useRef<-1 | 0 | 1>(0);
  const gamepadPrevRef = useRef<{ jump: boolean; interact: boolean }>({
    jump: false,
    interact: false,
  });
  const keysHeldRef = useRef<Set<string>>(new Set());
  const jumpJustPressedRef = useRef<boolean>(false);
  const activeModalRef = useRef<'none' | 'inventory' | 'skills' | 'town'>('none');
  const victoryRecapRef = useRef<VictoryRecapData | null>(null);
  const lastHudSyncXRef = useRef<number>(pPlayerRef.current.x);

  // Discrete React UI state synced only on events/turns
  const [mode, setMode] = useState<GameMode>('title');
  const [activeModal, setActiveModal] = useState<
    'none' | 'inventory' | 'skills' | 'town'
  >('none');
  const [townInitialTab, setTownInitialTab] = useState<TownTab>('shop');
  const [inspectEnemyOpen, setInspectEnemyOpen] = useState(false);
  const [battleItemsOpen, setBattleItemsOpen] = useState(false);
  const [victoryRecap, setVictoryRecap] = useState<VictoryRecapData | null>(null);
  const [savedSummary, setSavedSummary] = useState(() => getSavedRunSummary());
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [, setUiTick] = useState(0);

  const syncUi = useCallback(() => {
    setUiTick((t) => t + 1);
  }, []);

  const persistCurrentRun = useCallback(() => {
    const stage = stageRef.current;
    const snap = snapshotStageProgress(stage);
    zoneProgressRef.current[stage.zone] = snap;
    saveRunState({
      version: 1,
      savedAt: Date.now(),
      player: playerRef.current,
      zone: stage.zone,
      playerX: Math.round(pPlayerRef.current.x),
      defeatedEntityIds: snap.defeatedEntityIds,
      openedChestIds: snap.openedChestIds,
      collectedPickupIds: snap.collectedPickupIds,
      usedShrineIds: snap.usedShrineIds,
      zoneProgress: zoneProgressRef.current,
    });
    setSavedSummary(getSavedRunSummary());
  }, []);

  const dismissVictoryRecap = useCallback(() => {
    victoryRecapRef.current = null;
    setVictoryRecap(null);
    audio.playMenuBlip();
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 2600);
  }, []);

  const updateMode = useCallback((nextMode: GameMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
    if (nextMode === 'title') {
      document.body.dataset.state = 'title';
      audio.setMood('title');
      audio.setPaused(false);
    } else if (nextMode === 'paused') {
      document.body.dataset.state = 'paused';
      audio.setPaused(true);
    } else if (nextMode === 'victory' || nextMode === 'gameover') {
      document.body.dataset.state = 'gameover';
      audio.setMood('none');
    } else {
      document.body.dataset.state = 'playing';
      audio.setPaused(false);
      if (nextMode === 'explore') {
        audio.setMood('explore');
      } else if (nextMode === 'battle') {
        audio.setMood(
          battleRef.current?.encounterRarity === 'boss' ? 'boss' : 'battle'
        );
        const enemy = battleRef.current ? getActiveEnemy(battleRef.current) : null;
        if (enemy && enemy.stats.hp > 0) {
          audio.setBattleEnemyHpRatio(enemy.currentHp / enemy.stats.hp);
        }
      }
    }
  }, []);

  const openModal = useCallback(
    (m: 'none' | 'inventory' | 'skills' | 'town') => {
      activeModalRef.current = m;
      setActiveModal(m);
      keysHeldRef.current.clear();
      audio.playMenuBlip();
    },
    []
  );

  const applyCombatEvents = useCallback((events: CombatActionEvents) => {
    const vfx = vfxRef.current;
    const activeEnemy = battleRef.current ? getActiveEnemy(battleRef.current) : null;
    if (activeEnemy && activeEnemy.stats.hp > 0) {
      audio.setBattleEnemyHpRatio(activeEnemy.currentHp / activeEnemy.stats.hp);
    }
    const comboCount = battleRef.current?.comboCount ?? 0;
    for (const s of events.sfx) {
      if (s === 'hit') audio.playHit();
      else if (s === 'crit') audio.playCrit();
      else if (s === 'staggerBreak') audio.playStaggerBreak();
      else if (s === 'block') audio.playBlock();
      else if (s === 'dodge') audio.playDodge();
      else if (s === 'counter') audio.playCounter();
      else if (s === 'heal') audio.playHeal();
      else if (s === 'ultimate') audio.playUltimate();
      else if (s === 'levelUp') audio.playLevelUp();
      else if (s === 'victory') audio.playVictory();
      else if (s === 'defeat') audio.playDefeat();
      else if (s === 'comboUp') audio.playComboChime(comboCount);
      else if (s === 'comboBreak') audio.playComboBreak();
    }
    for (const v of events.vfx) {
      let pos = { x: 126, y: 145 };
      if (v.target === 'enemy') {
        const battle = battleRef.current;
        if (battle && v.targetUid) {
          const addIdx = battle.adds.findIndex((a) => a.uid === v.targetUid);
          if (addIdx !== -1) {
            const addPos = BATTLE_ADD_POSITIONS[addIdx] ?? BATTLE_ADD_POSITIONS[0];
            pos = { x: addPos.x, y: addPos.y - 34 };
          } else {
            pos = { x: BATTLE_ENEMY_POS.x, y: BATTLE_ENEMY_POS.y - 38 };
          }
        } else {
          pos = { x: BATTLE_ENEMY_POS.x, y: BATTLE_ENEMY_POS.y - 38 };
        }
      }
      const popY = pos.y + (v.yOffset ?? 0);
      vfx.spawnPopup(pos.x, popY, v.text, v.color, v.hitstop ? 1.25 : 1);
      if (v.burstColor) {
        vfx.spawnBurst(pos.x, pos.y + 10, v.burstCount ?? 10, v.burstColor);
      }
      if (v.ringColor) {
        vfx.spawnRing(pos.x, pos.y + 10, 40, v.ringColor);
      }
      if (v.flashColor) {
        vfx.triggerFlash(v.flashColor, 0.28);
      }
      if (v.hitstop) vfx.triggerHitstop(v.hitstop);
      if (v.trauma) vfx.addTrauma(v.trauma);
    }
  }, []);

  const startNewRun = useCallback(() => {
    audio.unlock();
    audio.playMenuBlip();
    clearRunState();
    playerRef.current = createInitialPlayer();
    stageRef.current = buildStage(1);
    zoneProgressRef.current = {};
    pPlayerRef.current = createPlatformerPlayer();
    lastHudSyncXRef.current = pPlayerRef.current.x;
    battleRef.current = null;
    encounterRef.current = createEncounterTransition();
    nearbyRef.current = null;
    nearBouncePadRef.current = null;
    touchDirRef.current = 0;
    victoryRecapRef.current = null;
    setVictoryRecap(null);
    keysHeldRef.current.clear();
    setInspectEnemyOpen(false);
    setBattleItemsOpen(false);
    openModal('none');
    updateMode('explore');
    persistCurrentRun();
    syncUi();
  }, [openModal, persistCurrentRun, syncUi, updateMode]);

  const continueSavedRun = useCallback(() => {
    const saved = loadRunState();
    if (!saved) {
      startNewRun();
      return;
    }
    audio.unlock();
    audio.playMenuBlip();
    const freshDefaults = createInitialPlayer();
    playerRef.current = {
      ...freshDefaults,
      ...saved.player,
      materials: {
        ...freshDefaults.materials,
        ...(saved.player.materials ?? {}),
      },
      ownedPetIds: saved.player.ownedPetIds ?? [],
      equippedPetId: saved.player.equippedPetId ?? null,
      completedArenaIds: saved.player.completedArenaIds ?? [],
      skillPresets: saved.player.skillPresets ?? freshDefaults.skillPresets,
      voidTowerUnlocked: saved.player.voidTowerUnlocked ?? false,
      voidTowerBestFloor: saved.player.voidTowerBestFloor ?? 0,
    };
    const allZoneProg: Record<number, ZoneEntityProgress> = {
      ...(saved.zoneProgress ?? {}),
    };
    if (!allZoneProg[saved.zone]) {
      allZoneProg[saved.zone] = {
        defeatedEntityIds: saved.defeatedEntityIds ?? [],
        openedChestIds: saved.openedChestIds ?? [],
        collectedPickupIds: saved.collectedPickupIds ?? [],
        usedShrineIds: saved.usedShrineIds ?? [],
      };
    }
    zoneProgressRef.current = allZoneProg;

    const stage = buildStage(saved.zone);
    applyZoneProgressToStage(stage, allZoneProg[saved.zone]);
    stageRef.current = stage;
    const pp = createPlatformerPlayer();
    pp.x = Math.max(24, Math.min(stage.width - 24, saved.playerX || 80));
    pp.petX = pp.x - 20;
    pp.petY = pp.y - 6;
    pPlayerRef.current = pp;
    lastHudSyncXRef.current = pp.x;
    battleRef.current = null;
    encounterRef.current = createEncounterTransition();
    nearbyRef.current = null;
    nearBouncePadRef.current = null;
    touchDirRef.current = 0;
    victoryRecapRef.current = null;
    setVictoryRecap(null);
    keysHeldRef.current.clear();
    setInspectEnemyOpen(false);
    setBattleItemsOpen(false);
    openModal('none');
    updateMode('explore');
    showToast(`Resumed Zone ${stage.zone}: ${stage.name}`);
    syncUi();
  }, [openModal, showToast, startNewRun, syncUi, updateMode]);

  const startBattleFromWorldEntity = useCallback(
    (ent: WorldEntity) => {
      const stage = stageRef.current;
      const rarity = ent.enemyRarity ?? 'normal';
      const preferredId =
        stage.zone === 1 && rarity === 'normal'
          ? ent.enemySprite === 'pig'
            ? 'farm_pig'
            : 'farm_chicken'
          : undefined;
      const wave = spawnEnemyWave(stage.zone, rarity, preferredId);
      const initialCombo = playerRef.current.unlockedSkillIds.includes('all_t3_overdrive') ? 2 : 0;
      battleRef.current = createBattleState(stage.zone, rarity, ent.id, wave, {
        initialCombo,
      });
      keysHeldRef.current.clear();
      setInspectEnemyOpen(false);
      setBattleItemsOpen(false);
      updateMode('battle');
      syncUi();
    },
    [syncUi, updateMode]
  );

  const handleStartArenaTrial = useCallback(
    (trialId: string) => {
      const trial = ARENA_TRIALS.find((t) => t.id === trialId);
      if (!trial || playerRef.current.highestZone < trial.minHighestZone) return;
      audio.unlock();
      audio.playEncounter('boss');
      const wave = spawnArenaBossWave(trial);
      const initialCombo = playerRef.current.unlockedSkillIds.includes('all_t3_overdrive') ? 2 : 0;
      battleRef.current = createBattleState(
        Math.max(stageRef.current.zone, trial.rewardZoneLevel),
        'boss',
        trial.id,
        wave,
        { arenaTrialId: trial.id, initialCombo }
      );
      openModal('none');
      keysHeldRef.current.clear();
      setInspectEnemyOpen(false);
      setBattleItemsOpen(false);
      updateMode('battle');
      syncUi();
    },
    [openModal, syncUi, updateMode]
  );

  const handleStartVoidTowerFloor = useCallback(
    (floor: number) => {
      if (!playerRef.current.voidTowerUnlocked) return;
      audio.unlock();
      const mutator = getVoidTowerMutator(floor);
      const wave = spawnVoidTowerWave(floor);
      const rarity = floor % 5 === 0 ? 'boss' : 'elite';
      audio.playEncounter(rarity);
      const initialCombo = playerRef.current.unlockedSkillIds.includes('all_t3_overdrive') ? 2 : 0;
      battleRef.current = createBattleState(10, rarity, `void_tower_f${floor}`, wave, {
        voidTowerFloor: floor,
        voidTowerMutator: mutator,
        initialCombo,
      });
      victoryRecapRef.current = null;
      setVictoryRecap(null);
      openModal('none');
      keysHeldRef.current.clear();
      setInspectEnemyOpen(false);
      setBattleItemsOpen(false);
      updateMode('battle');
      syncUi();
    },
    [openModal, syncUi, updateMode]
  );

  const handleInteract = useCallback(() => {
    const ent = nearbyRef.current;
    if (!ent || modeRef.current !== 'explore') return;

    if (ent.kind === 'fireplace') {
      const stats = computePlayerStats(playerRef.current);
      playerRef.current.currentHp = stats.hp;
      playerRef.current.currentMp = stats.mp;
      playerRef.current.currentStagger = playerRef.current.maxStagger;
      audio.playHeal();
      vfxRef.current.spawnBurst(ent.x, ent.y - 14, 14, '#f28729');
      showToast('Rested at Fireplace! HP, MP & Stagger restored.');
      setTownInitialTab('shop');
      openModal('town');
      persistCurrentRun();
      syncUi();
      return;
    }

    if (ent.kind === 'shop') {
      setTownInitialTab('shop');
      openModal('town');
      return;
    }

    if (ent.kind === 'chest' && !ent.opened) {
      ent.opened = true;
      const zone = stageRef.current.zone;
      const goldGain = 25 * zone + Math.floor(Math.random() * 20);
      const slots: EquipmentSlot[] = ['weapon', 'armor', 'helm', 'charm'];
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const rarity = rollRarityForEnemy(zone >= 4 ? 'elite' : 'normal', zone);
      const gear = generateEquipment(slot, rarity, zone);
      playerRef.current.gold += goldGain;
      playerRef.current.inventory.push(gear);
      audio.playChest();
      vfxRef.current.spawnBurst(ent.x, ent.y - 10, 18, '#f7c948');
      vfxRef.current.spawnPopup(ent.x, ent.y - 24, `+${goldGain}G & ${gear.name}!`, '#f7c948');
      showToast(`Chest opened: +${goldGain}G & ${gear.name} (${rarity})!`);
      persistCurrentRun();
      syncUi();
      return;
    }

    if (ent.kind === 'shrine' && !ent.used) {
      ent.used = true;
      const zone = stageRef.current.zone;
      const stats = computePlayerStats(playerRef.current);
      const hpGain = Math.round(stats.hp * 0.35);
      const mpGain = Math.round(stats.mp * 0.35);
      const goldGain = 35 * zone;
      playerRef.current.currentHp = Math.min(stats.hp, playerRef.current.currentHp + hpGain);
      playerRef.current.currentMp = Math.min(stats.mp, playerRef.current.currentMp + mpGain);
      playerRef.current.ultimateCharge = 100;
      playerRef.current.gold += goldGain;
      audio.playHeal();
      vfxRef.current.spawnBurst(ent.x, ent.y - 18, 20, '#38bdf8');
      vfxRef.current.spawnRing(ent.x, ent.y - 18, 36, '#facc15');
      vfxRef.current.spawnPopup(ent.x, ent.y - 30, `SHRINE BLESSING! +100% ULT +${goldGain}G`, '#38bdf8');
      showToast(`Blessing Shrine activated: +${hpGain} HP, +${mpGain} MP, 100% ULT & +${goldGain}G!`);
      persistCurrentRun();
      syncUi();
      return;
    }

    if (ent.kind === 'portal') {
      const bossDefeated = stageRef.current.entities.some(
        (e) => e.kind === 'enemy' && e.enemyRarity === 'boss' && e.defeated
      );
      if (!bossDefeated) {
        showToast('Defeat the Stage Boss first to unlock the Zone Portal!');
        return;
      }
      const nextZone = stageRef.current.zone + 1;
      if (nextZone <= 10) {
        zoneProgressRef.current[stageRef.current.zone] = snapshotStageProgress(
          stageRef.current
        );
        playerRef.current.highestZone = Math.max(
          playerRef.current.highestZone,
          nextZone
        );
        const nextStage = buildStage(nextZone);
        applyZoneProgressToStage(nextStage, zoneProgressRef.current[nextZone]);
        stageRef.current = nextStage;
        pPlayerRef.current = createPlatformerPlayer();
        lastHudSyncXRef.current = pPlayerRef.current.x;
        nearBouncePadRef.current = null;
        audio.playLevelUp();
        showToast(`Entered Zone ${nextZone}: ${stageRef.current.name}!`);
        persistCurrentRun();
        syncUi();
      }
    }
  }, [openModal, persistCurrentRun, showToast, syncUi]);

  const handleBattleAction = useCallback(
    (
      action:
        | { kind: 'attack' }
        | { kind: 'guard' }
        | { kind: 'skill'; skillId: string }
        | { kind: 'ultimate' }
        | { kind: 'consumable'; itemId: string }
        | { kind: 'finisher'; mode: 'burst' | 'execute' }
    ) => {
      const battle = battleRef.current;
      if (!battle || battle.phase !== 'player_turn') return;
      audio.unlock();
      if (action.kind !== 'consumable') {
        setBattleItemsOpen(false);
      }
      const events = executePlayerAction(battle, playerRef.current, action);
      applyCombatEvents(events);
      syncUi();
    },
    [applyCombatEvents, syncUi]
  );

  const handleQteTrigger = useCallback(() => {
    const battle = battleRef.current;
    if (!battle) return;
    if (battle.phase !== 'qte_dodge' && battle.phase !== 'qte_counter') return;
    audio.unlock();
    const events = resolveQteInput(battle, playerRef.current, false);
    applyCombatEvents(events);
    syncUi();
  }, [applyCombatEvents, syncUi]);

  // Boot query parameter ?autostart=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startNewRun();
    } else {
      document.body.dataset.state = 'title';
      audio.setMood('title');
    }
  }, [startNewRun]);

  // Unified Keyboard Input Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      if (modeRef.current === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          if (loadRunState()) {
            continueSavedRun();
          } else {
            startNewRun();
          }
        }
        return;
      }

      if (code === 'KeyM') {
        const nextMuted = !audio.isMuted();
        audio.setMuted(nextMuted);
        setMuted(nextMuted);
        return;
      }

      if (victoryRecapRef.current) {
        if (code === 'Space' || code === 'Enter' || code === 'Escape') {
          e.preventDefault();
          dismissVictoryRecap();
        }
        return;
      }

      if (encounterRef.current.phase === 'closing') {
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (activeModalRef.current !== 'none') {
          openModal('none');
          return;
        }
        if (modeRef.current === 'explore' || modeRef.current === 'battle') {
          updateMode('paused');
          return;
        }
        if (modeRef.current === 'paused') {
          updateMode(battleRef.current ? 'battle' : 'explore');
          return;
        }
      }

      if (modeRef.current === 'gameover' && code === 'KeyR') {
        startNewRun();
        return;
      }

      if (modeRef.current === 'explore') {
        if (code === 'KeyI' || code === 'Tab') {
          e.preventDefault();
          openModal(activeModalRef.current === 'inventory' ? 'none' : 'inventory');
          return;
        }
        if (code === 'KeyK') {
          openModal(activeModalRef.current === 'skills' ? 'none' : 'skills');
          return;
        }
        if (activeModalRef.current !== 'none') return;

        if (code === 'KeyE' || code === 'Enter') {
          handleInteract();
          return;
        }
        if (
          (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') &&
          !e.repeat
        ) {
          e.preventDefault();
          jumpJustPressedRef.current = true;
        }
        keysHeldRef.current.add(code);
      } else if (modeRef.current === 'battle') {
        const battle = battleRef.current;
        if (!battle) return;

        if (
          (battle.phase === 'qte_dodge' || battle.phase === 'qte_counter') &&
          (code === 'Space' || code === 'Enter')
        ) {
          e.preventDefault();
          handleQteTrigger();
          return;
        }

        if (battle.phase === 'player_turn') {
          if (code === 'Tab') {
            e.preventDefault();
            if (getLivingFieldEnemies(battle).length > 1) {
              switchBattleTarget(battle);
              audio.playMenuBlip();
              syncUi();
            }
          } else if (code === 'KeyQ') handleBattleAction({ kind: 'attack' });
          else if (code === 'KeyG') handleBattleAction({ kind: 'guard' });
          else if (code === 'KeyU') handleBattleAction({ kind: 'ultimate' });
          else if (code === 'KeyF') setBattleItemsOpen((v) => !v);
          else if (code === 'KeyX') handleBattleAction({ kind: 'finisher', mode: 'execute' });
          else if (code === 'KeyC') handleBattleAction({ kind: 'finisher', mode: 'burst' });
          else if (code.startsWith('Digit')) {
            const idx = Number(code.replace('Digit', '')) - 1;
            const equipped = getEquippedSkillsList(playerRef.current);
            if (equipped[idx]) {
              handleBattleAction({ kind: 'skill', skillId: equipped[idx].id });
            }
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const clearHeld = () => {
      keysHeldRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeld);
    document.addEventListener('visibilitychange', clearHeld);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeld);
      document.removeEventListener('visibilitychange', clearHeld);
    };
  }, [
    continueSavedRun,
    dismissVictoryRecap,
    handleBattleAction,
    handleInteract,
    handleQteTrigger,
    openModal,
    startNewRun,
    syncUi,
    updateMode,
  ]);

  // Main 60Hz RequestAnimationFrame Simulation & Render Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      elapsed += dt;

      const vfx = vfxRef.current;
      vfx.update(dt);
      const weather = weatherRef.current;
      weather.update(dt, stageRef.current.zone);
      const simDt = vfx.hitstop > 0 ? 0 : dt;

      const curMode = modeRef.current;

      if (
        curMode === 'explore' &&
        activeModalRef.current === 'none' &&
        !victoryRecapRef.current &&
        encounterRef.current.phase !== 'closing'
      ) {
        const held = keysHeldRef.current;
        let gpLeft = false;
        let gpRight = false;
        let gpJumpHeld = false;
        let gpJumpPress = false;
        let gpInteractPress = false;
        try {
          const pads = navigator.getGamepads?.() ?? [];
          const gp = pads.find((p) => p && p.connected);
          if (gp) {
            const ax0 = gp.axes[0] ?? 0;
            gpLeft = ax0 < -0.35 || Boolean(gp.buttons[14]?.pressed);
            gpRight = ax0 > 0.35 || Boolean(gp.buttons[15]?.pressed);
            gpJumpHeld = Boolean(gp.buttons[0]?.pressed);
            gpInteractPress = Boolean(gp.buttons[2]?.pressed || gp.buttons[3]?.pressed);
            if (gpJumpHeld && !gamepadPrevRef.current.jump) {
              gpJumpPress = true;
            }
            if (gpInteractPress && !gamepadPrevRef.current.interact) {
              handleInteract();
            }
            gamepadPrevRef.current = { jump: gpJumpHeld, interact: gpInteractPress };
          }
        } catch {
          // Gamepad API unavailable in headless contexts
        }

        const left =
          held.has('ArrowLeft') || held.has('KeyA') || touchDirRef.current === -1 || gpLeft;
        const right =
          held.has('ArrowRight') || held.has('KeyD') || touchDirRef.current === 1 || gpRight;
        const jumpHeld =
          held.has('Space') || held.has('ArrowUp') || held.has('KeyW') || gpJumpHeld;
        const jumpJustPressed = jumpJustPressedRef.current || gpJumpPress;
        jumpJustPressedRef.current = false;

        const stepRes = stepPlatformer(
          pPlayerRef.current,
          stageRef.current,
          { left, right, jumpJustPressed, jumpHeld },
          simDt
        );

        let movedEnough =
          Math.abs(pPlayerRef.current.x - lastHudSyncXRef.current) >= 18;
        if (stepRes.jumped) {
          audio.playJump();
        }
        if (stepRes.bounced) {
          audio.playJump();
          vfx.spawnBurst(pPlayerRef.current.x, pPlayerRef.current.y, 12, '#22d3ee');
        }
        if (stepRes.hazardDamagePct > 0) {
          const stats = computePlayerStats(playerRef.current);
          const hDmg = Math.max(4, Math.round((stats.hp * stepRes.hazardDamagePct) / 100));
          playerRef.current.currentHp = Math.max(1, playerRef.current.currentHp - hDmg);
          audio.playHit();
          vfx.addTrauma(0.35);
          vfx.spawnBurst(pPlayerRef.current.x, pPlayerRef.current.y - 8, 10, '#f43f5e');
          vfx.spawnPopup(
            pPlayerRef.current.x,
            pPlayerRef.current.y - 26,
            `-${hDmg} HAZARD!`,
            '#f43f5e'
          );
          movedEnough = true;
        }
        if (stepRes.collectedGold > 0) {
          playerRef.current.gold += stepRes.collectedGold;
          audio.playCoin();
          vfx.spawnPopup(
            pPlayerRef.current.x,
            pPlayerRef.current.y - 24,
            `+${stepRes.collectedGold}G`,
            '#f7c948'
          );
          persistCurrentRun();
          movedEnough = true;
        }
        if (stepRes.collectedMaterial) {
          const { id, amount } = stepRes.collectedMaterial;
          playerRef.current.materials[id] += amount;
          audio.playCoin();
          vfx.spawnPopup(
            pPlayerRef.current.x,
            pPlayerRef.current.y - 24,
            `+${amount} ${MATERIAL_META[id].name}`,
            MATERIAL_META[id].color
          );
          persistCurrentRun();
          movedEnough = true;
        }
        if (nearbyRef.current?.id !== stepRes.nearbyInteractable?.id) {
          nearbyRef.current = stepRes.nearbyInteractable;
          movedEnough = true;
        }
        if (nearBouncePadRef.current?.id !== stepRes.nearBouncePad?.id) {
          nearBouncePadRef.current = stepRes.nearBouncePad;
          movedEnough = true;
        }
        if (movedEnough) {
          lastHudSyncXRef.current = pPlayerRef.current.x;
          syncUi();
        }
        if (stepRes.triggeredEnemy) {
          const rarity = stepRes.triggeredEnemy.enemyRarity ?? 'normal';
          audio.unlock();
          audio.setMood('none');
          audio.playEncounter(rarity);
          vfx.addTrauma(rarity === 'boss' ? 0.85 : 0.48);
          keysHeldRef.current.clear();
          jumpJustPressedRef.current = false;
          encounterRef.current = startEncounterTransition(
            stepRes.triggeredEnemy,
            pPlayerRef.current.cameraX
          );
        }
      } else if (curMode === 'battle' && battleRef.current) {
        const battle = battleRef.current;
        const prevPhase = battle.phase;
        const events = stepBattleTimeline(battle, playerRef.current, simDt);
        if (events.sfx.length > 0 || events.vfx.length > 0) {
          applyCombatEvents(events);
        } else if (prevPhase !== battle.phase) {
          const activeEnemy = getActiveEnemy(battle);
          if (activeEnemy && activeEnemy.stats.hp > 0) {
            audio.setBattleEnemyHpRatio(activeEnemy.currentHp / activeEnemy.stats.hp);
          }
        }

        if (battle.phase === 'victory' && battle.phaseTimer <= 0.05) {
          const rewards = battle.rewards;
          const arenaTrial = battle.arenaTrialId
            ? ARENA_TRIALS.find((t) => t.id === battle.arenaTrialId)
            : undefined;

          if (battle.voidTowerFloor) {
            const floor = battle.voidTowerFloor;
            const isBossFloor = floor % 5 === 0;
            const bonusGold = 65 * floor;
            const bonusXp = 90 * floor;
            playerRef.current.gold += bonusGold;
            rewards.gold += bonusGold;

            const xpRes = grantXp(playerRef.current, bonusXp);
            Object.assign(playerRef.current, xpRes.player);
            rewards.xp += bonusXp;
            rewards.levelsGained += xpRes.levelsGained;

            playerRef.current.materials.voidEssence += isBossFloor ? 2 : 1;
            rewards.materials.voidEssence =
              (rewards.materials.voidEssence ?? 0) + (isBossFloor ? 2 : 1);

            if (isBossFloor) {
              playerRef.current.materials.starlightOre += 2;
              rewards.materials.starlightOre =
                (rewards.materials.starlightOre ?? 0) + 2;
              const slots: EquipmentSlot[] = ['weapon', 'armor', 'helm', 'charm'];
              const slot = slots[Math.floor(Math.random() * slots.length)];
              const mythicGear = generateEquipment(slot, 'mythic', 10);
              playerRef.current.inventory.push(mythicGear);
              rewards.items.push(mythicGear);
            }

            playerRef.current.voidTowerBestFloor = Math.max(
              playerRef.current.voidTowerBestFloor ?? 0,
              floor
            );

            // Restore +30% HP/MP after clearing a tower floor so players can keep climbing
            const stats = computePlayerStats(playerRef.current);
            playerRef.current.currentHp = Math.min(
              stats.hp,
              playerRef.current.currentHp + Math.round(stats.hp * 0.3)
            );
            playerRef.current.currentMp = Math.min(
              stats.mp,
              playerRef.current.currentMp + Math.round(stats.mp * 0.3)
            );

            const recap: VictoryRecapData = {
              zone: 10,
              title: `VOID TOWER FL.${floor} CLEARED!`,
              enemyName: battle.wave[0]?.name ?? `Floor ${floor}`,
              turnCount: battle.turnCount,
              xp: rewards.xp,
              gold: rewards.gold,
              materials: rewards.materials,
              items: rewards.items,
              levelsGained: rewards.levelsGained,
              maxComboCount: battle.maxComboCount,
              maxComboDamage: battle.maxComboDamage,
              voidTowerFloor: floor,
              nextVoidTowerFloor: floor + 1,
            };
            victoryRecapRef.current = recap;
            setVictoryRecap(recap);
            battleRef.current = null;
            setBattleItemsOpen(false);
            updateMode('explore');
            persistCurrentRun();
            syncUi();
          } else if (arenaTrial) {
            playerRef.current.gold += arenaTrial.bonusGold;
            rewards.gold += arenaTrial.bonusGold;
            const xpRes = grantXp(playerRef.current, arenaTrial.bonusXp);
            Object.assign(playerRef.current, xpRes.player);
            rewards.xp += arenaTrial.bonusXp;
            rewards.levelsGained += xpRes.levelsGained;

            const slots: EquipmentSlot[] = ['weapon', 'armor', 'helm', 'charm'];
            const slot = slots[Math.floor(Math.random() * slots.length)];
            const bonusGear = generateEquipment(
              slot,
              arenaTrial.guaranteedRarity,
              arenaTrial.rewardZoneLevel
            );
            playerRef.current.inventory.push(bonusGear);
            rewards.items.push(bonusGear);

            if (!playerRef.current.completedArenaIds.includes(arenaTrial.id)) {
              playerRef.current.completedArenaIds = [
                ...playerRef.current.completedArenaIds,
                arenaTrial.id,
              ];
            }

            const recap: VictoryRecapData = {
              zone: arenaTrial.rewardZoneLevel,
              title: `${arenaTrial.name.toUpperCase()} CLEARED!`,
              enemyName: arenaTrial.name,
              turnCount: battle.turnCount,
              xp: rewards.xp,
              gold: rewards.gold,
              materials: rewards.materials,
              items: rewards.items,
              levelsGained: rewards.levelsGained,
              maxComboCount: battle.maxComboCount,
              maxComboDamage: battle.maxComboDamage,
            };
            victoryRecapRef.current = recap;
            setVictoryRecap(recap);
            battleRef.current = null;
            setBattleItemsOpen(false);
            updateMode('explore');
            persistCurrentRun();
            syncUi();
          } else {
            const worldEnt = stageRef.current.entities.find(
              (e) => e.id === battle.sourceEntityId
            );
            if (worldEnt) worldEnt.defeated = true;

            const isFinalBoss =
              stageRef.current.zone === 10 && battle.encounterRarity === 'boss';

            if (isFinalBoss) {
              const firstFinalClear = !playerRef.current.voidTowerUnlocked;
              playerRef.current.voidTowerUnlocked = true;
              const stats = computePlayerStats(playerRef.current);
              playerRef.current.currentHp = Math.max(
                playerRef.current.currentHp,
                Math.round(stats.hp * 0.5)
              );
              playerRef.current.currentMp = Math.max(
                playerRef.current.currentMp,
                Math.round(stats.mp * 0.5)
              );
              battleRef.current = null;
              setBattleItemsOpen(false);
              persistCurrentRun();

              if (firstFinalClear) {
                updateMode('victory');
                syncUi();
              } else {
                const recap: VictoryRecapData = {
                  zone: 10,
                  title: 'ARCHITECT MALAKOR VANQUISHED!',
                  enemyName: worldEnt?.enemyName ?? battle.wave[0]?.name ?? 'Malakor',
                  turnCount: battle.turnCount,
                  xp: rewards.xp,
                  gold: rewards.gold,
                  materials: rewards.materials,
                  items: rewards.items,
                  levelsGained: rewards.levelsGained,
                  maxComboCount: battle.maxComboCount,
                  maxComboDamage: battle.maxComboDamage,
                };
                victoryRecapRef.current = recap;
                setVictoryRecap(recap);
                updateMode('explore');
                syncUi();
              }
            } else {
              if (stageRef.current.zone === 8 && battle.encounterRarity === 'boss') {
                playerRef.current.highestZone = Math.max(
                  playerRef.current.highestZone,
                  9
                );
                showToast('Ignis defeated! Zone 9 Sunken Starfall Ruins Portal unlocked!');
              }
              const recap: VictoryRecapData = {
                zone: battle.zone,
                enemyName: worldEnt?.enemyName ?? battle.wave[0]?.name ?? 'Monsters',
                turnCount: battle.turnCount,
                xp: rewards.xp,
                gold: rewards.gold,
                materials: rewards.materials,
                items: rewards.items,
                levelsGained: rewards.levelsGained,
                maxComboCount: battle.maxComboCount,
                maxComboDamage: battle.maxComboDamage,
              };
              victoryRecapRef.current = recap;
              setVictoryRecap(recap);
              battleRef.current = null;
              setBattleItemsOpen(false);
              updateMode('explore');
              persistCurrentRun();
              syncUi();
            }
          }
        } else if (battle.phase === 'defeat') {
          if (battle.arenaTrialId || battle.voidTowerFloor) {
            const stats = computePlayerStats(playerRef.current);
            playerRef.current.currentHp = Math.max(25, Math.round(stats.hp * 0.35));
            playerRef.current.currentMp = Math.round(stats.mp * 0.5);
            battleRef.current = null;
            setBattleItemsOpen(false);
            updateMode('explore');
            showToast(
              battle.voidTowerFloor
                ? `Defeated on Void Tower Fl.${battle.voidTowerFloor}! Returned safely to camp.`
                : 'Fell in Arena Trial! Restored safely at Wayside Camp.'
            );
            persistCurrentRun();
            syncUi();
          } else {
            clearRunState();
            setSavedSummary(null);
            battleRef.current = null;
            setBattleItemsOpen(false);
            updateMode('gameover');
            syncUi();
          }
        } else if (
          prevPhase !== battle.phase ||
          battle.phase === 'qte_dodge' ||
          battle.phase === 'qte_counter'
        ) {
          syncUi();
        }
      }

      if (curMode !== 'paused' && encounterRef.current.active) {
        const tr = stepEncounterTransition(encounterRef.current, dt);
        encounterRef.current = tr.state;
        if (tr.readyToEnterBattle) {
          startBattleFromWorldEntity(tr.readyToEnterBattle);
        }
      }

      // Render active scene to 480x270 canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const activeMode = modeRef.current;
        if (activeMode === 'battle' && battleRef.current) {
          renderBattleFrame(
            ctx,
            stageRef.current,
            battleRef.current,
            playerRef.current,
            vfx,
            elapsed,
            weather
          );
        } else {
          renderExploreFrame(
            ctx,
            stageRef.current,
            pPlayerRef.current,
            playerRef.current,
            vfx,
            elapsed,
            activeMode === 'title',
            weather
          );
        }

        if (encounterRef.current.active) {
          renderEncounterTransition(ctx, encounterRef.current);
        }
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, [applyCombatEvents, persistCurrentRun, startBattleFromWorldEntity, syncUi, updateMode]);

  // Click Enemy on Canvas to Target or Inspect Enemy Stats
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    audio.unlock();
    if (modeRef.current !== 'battle' || !battleRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * INTERNAL_WIDTH;
    const cy = ((e.clientY - rect.top) / rect.height) * INTERNAL_HEIGHT;
    const battle = battleRef.current;
    const currentTarget = getActiveEnemy(battle);

    // Check adds first so flanking adds can be clicked cleanly
    for (let i = 0; i < battle.adds.length; i++) {
      const add = battle.adds[i];
      if (!add || add.currentHp <= 0) continue;
      const pos = BATTLE_ADD_POSITIONS[i] ?? BATTLE_ADD_POSITIONS[0];
      if (Math.abs(cx - pos.x) < 42 && cy > pos.y - 100 && cy < pos.y + 15) {
        audio.playMenuBlip();
        if (currentTarget?.uid !== add.uid) {
          switchBattleTarget(battle, add.uid);
          syncUi();
        } else {
          setInspectEnemyOpen((prev) => !prev);
        }
        return;
      }
    }

    const primary = battle.wave[battle.waveIndex];
    if (
      primary &&
      primary.currentHp > 0 &&
      Math.abs(cx - BATTLE_ENEMY_POS.x) < 55 &&
      cy > BATTLE_ENEMY_POS.y - 125 &&
      cy < BATTLE_ENEMY_POS.y + 15
    ) {
      audio.playMenuBlip();
      if (currentTarget?.uid !== primary.uid) {
        switchBattleTarget(battle, primary.uid);
        syncUi();
      } else {
        setInspectEnemyOpen((prev) => !prev);
      }
    }
  };

  const player = playerRef.current;
  const stage = stageRef.current;
  const battle = battleRef.current;

  return (
    <main className="relative w-screen h-screen bg-[#0e0b16] flex items-center justify-center overflow-hidden">
      {/* Crisp 16-bit Pixel Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        width={INTERNAL_WIDTH}
        height={INTERNAL_HEIGHT}
        onClick={handleCanvasClick}
        className="pixel-canvas w-full h-full object-contain cursor-crosshair"
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 bg-[#1b162b] border-2 border-[#f7c948] px-4 py-2 font-pixel text-xs text-[#f7c948] shadow-[0_4px_0_#0e0b16] animate-juicy-pop pointer-events-none">
          {toast}
        </div>
      )}

      {/* Title Screen */}
      {mode === 'title' && (
        <TitleOverlay
          savedSummary={savedSummary}
          onContinue={continueSavedRun}
          onStart={startNewRun}
        />
      )}

      {/* Explore HUD */}
      {mode === 'explore' && (
        <ExploreHud
          player={player}
          stage={stage}
          playerX={pPlayerRef.current.x}
          nearbyInteractable={nearbyRef.current}
          nearBouncePad={nearBouncePadRef.current}
          muted={muted}
          onToggleMute={() => {
            const next = !audio.isMuted();
            audio.setMuted(next);
            setMuted(next);
          }}
          onPause={() => updateMode('paused')}
          onOpenInventory={() => openModal('inventory')}
          onOpenSkillTree={() => openModal('skills')}
          onOpenArena={() => {
            setTownInitialTab('arena');
            openModal('town');
          }}
          onOpenVoidTower={() => {
            setTownInitialTab('tower');
            openModal('town');
          }}
          onInteract={handleInteract}
          onSelectZone={(z) => {
            zoneProgressRef.current[stageRef.current.zone] = snapshotStageProgress(
              stageRef.current
            );
            const nextStage = buildStage(z);
            applyZoneProgressToStage(nextStage, zoneProgressRef.current[z]);
            stageRef.current = nextStage;
            pPlayerRef.current = createPlatformerPlayer();
            lastHudSyncXRef.current = pPlayerRef.current.x;
            nearbyRef.current = null;
            nearBouncePadRef.current = null;
            audio.playMenuBlip();
            showToast(`Traveled to Zone ${z}: ${stageRef.current.name}`);
            persistCurrentRun();
            syncUi();
          }}
          onTouchMove={(dir) => {
            touchDirRef.current = dir;
          }}
          onTouchJump={() => {
            jumpJustPressedRef.current = true;
          }}
        />
      )}

      {/* Battle HUD */}
      {mode === 'battle' && battle && (
        <BattleHud
          player={player}
          battle={battle}
          inspectEnemyOpen={inspectEnemyOpen}
          showItems={battleItemsOpen}
          muted={muted}
          onToggleMute={() => {
            const next = !audio.isMuted();
            audio.setMuted(next);
            setMuted(next);
          }}
          onToggleInspectEnemy={(open) => setInspectEnemyOpen(open)}
          onToggleShowItems={() => setBattleItemsOpen((v) => !v)}
          onSelectTarget={(uid) => {
            switchBattleTarget(battle, uid);
            audio.playMenuBlip();
            syncUi();
          }}
          onAction={handleBattleAction}
          onQteTrigger={handleQteTrigger}
        />
      )}

      {/* Battle Victory Recap Banner */}
      {mode === 'explore' && victoryRecap && activeModal === 'none' && (
        <BattleVictoryModal
          recap={victoryRecap}
          onContinue={dismissVictoryRecap}
          onContinueVoidTower={handleStartVoidTowerFloor}
        />
      )}

      {/* Inventory & Mid-Stage Equipment Modal */}
      {activeModal === 'inventory' && mode === 'explore' && (
        <InventoryModal
          player={player}
          onClose={() => openModal('none')}
          onEquipItem={(itemId) => {
            const idx = player.inventory.findIndex((i) => i.id === itemId);
            if (idx === -1) return;
            const item = player.inventory[idx];
            const prev = player.equipment[item.slot];
            player.equipment[item.slot] = item;
            player.inventory.splice(idx, 1);
            if (prev) player.inventory.push(prev);
            const stats = computePlayerStats(player);
            player.currentHp = Math.min(player.currentHp, stats.hp);
            player.currentMp = Math.min(player.currentMp, stats.mp);
            audio.playMenuBlip();
            persistCurrentRun();
            syncUi();
          }}
          onSellItem={(itemId) => {
            const idx = player.inventory.findIndex((i) => i.id === itemId);
            if (idx === -1) return;
            const item = player.inventory[idx];
            if (item.locked) return;
            player.gold += item.sellValue;
            player.inventory.splice(idx, 1);
            audio.playCoin();
            persistCurrentRun();
            syncUi();
          }}
          onToggleLockItem={(itemId) => {
            playerRef.current = toggleEquipmentLock(playerRef.current, itemId);
            audio.playMenuBlip();
            persistCurrentRun();
            syncUi();
          }}
          onBulkDispose={(maxRarity, bulkMode) => {
            const res = bulkDisposeInventory(playerRef.current, maxRarity, bulkMode);
            if (res.count === 0) return;
            playerRef.current = res.player;
            if (bulkMode === 'sell') {
              audio.playCoin();
              showToast(`Bulk sold ${res.count} items for +${res.goldGained}G!`);
            } else {
              audio.playForge();
              const matsStr = Object.entries(res.materialsGained)
                .map(([id, amt]) => `+${amt} ${MATERIAL_META[id as MaterialId].name}`)
                .join(', ');
              showToast(`Salvaged ${res.count} items (${matsStr})!`);
            }
            persistCurrentRun();
            syncUi();
          }}
        />
      )}

      {/* 6-Branch Skill Tree & Class Advancement Modal */}
      {activeModal === 'skills' && mode === 'explore' && (
        <SkillTreeModal
          player={player}
          onClose={() => openModal('none')}
          onUnlockSkill={(skillId) => {
            playerRef.current = unlockSkillNode(playerRef.current, skillId);
            audio.playLevelUp();
            persistCurrentRun();
            syncUi();
          }}
          onToggleEquipSkill={(skillId) => {
            playerRef.current = toggleEquipSkill(playerRef.current, skillId);
            audio.playMenuBlip();
            persistCurrentRun();
            syncUi();
          }}
          onAdvanceClass={() => {
            playerRef.current = advanceToHeroClass(playerRef.current);
            audio.playVictory();
            showToast('Class Advanced to Vanguard Hero (Tier 2)!');
            persistCurrentRun();
            syncUi();
          }}
          onAdvanceTier3={(branch) => {
            playerRef.current = advanceToTier3Class(playerRef.current, branch);
            const specName = TIER3_SPECIALIZATIONS[branch].name;
            audio.playVictory();
            showToast(`Ascended to Tier 3: ${specName}!`);
            persistCurrentRun();
            syncUi();
          }}
          onRespec={() => {
            const res = respecSkills(playerRef.current);
            if (!res.success) {
              return { ok: false, msg: res.reason ?? 'Cannot respec.' };
            }
            playerRef.current = res.player;
            audio.playMenuBlip();
            persistCurrentRun();
            syncUi();
            return {
              ok: true,
              msg: `Skill Tree reset! Refunded ${res.refundedPoints} Skill Points.`,
            };
          }}
          onSavePreset={(slotIndex) => {
            playerRef.current = saveSkillPreset(playerRef.current, slotIndex);
            audio.playMenuBlip();
            persistCurrentRun();
            syncUi();
          }}
          onLoadPreset={(slotIndex) => {
            playerRef.current = loadSkillPreset(playerRef.current, slotIndex);
            audio.playMenuBlip();
            persistCurrentRun();
            syncUi();
          }}
        />
      )}

      {/* Fireplace Shop, Blacksmith, Pet Familiars & Boss Rush Arena Modal */}
      {activeModal === 'town' && mode === 'explore' && (
        <FireplaceTownModal
          player={player}
          initialTab={townInitialTab}
          onClose={() => openModal('none')}
          onRestAtFireplace={() => {
            const stats = computePlayerStats(playerRef.current);
            playerRef.current.currentHp = stats.hp;
            playerRef.current.currentMp = stats.mp;
            playerRef.current.currentStagger = playerRef.current.maxStagger;
            audio.playHeal();
            persistCurrentRun();
            syncUi();
          }}
          onBuyConsumable={(cid) => {
            const tpl = SHOP_CONSUMABLES.find((c) => c.id === cid);
            if (!tpl || player.gold < tpl.price) return;
            player.gold -= tpl.price;
            const existing = player.consumables.find((c) => c.id === cid);
            if (existing) existing.quantity += 1;
            else player.consumables.push({ ...tpl, quantity: 1 });
            audio.playCoin();
            persistCurrentRun();
            syncUi();
          }}
          onBuyStarterGear={(slot, name, price) => {
            if (player.gold < price) return;
            player.gold -= price;
            player.inventory.push(generateEquipment(slot, 'common', 1, name));
            audio.playCoin();
            persistCurrentRun();
            syncUi();
          }}
          onBuyMaterial={(mId) => {
            const price = MATERIAL_META[mId].price;
            if (player.gold < price) return;
            player.gold -= price;
            player.materials[mId] += 1;
            audio.playCoin();
            persistCurrentRun();
            syncUi();
          }}
          onEnchantItem={(itemId, equippedSlot) => {
            const target = equippedSlot
              ? player.equipment[equippedSlot]
              : player.inventory.find((i) => i.id === itemId);
            if (!target) return { ok: false, msg: 'Item not found.' };
            const res = enchantEquipment(target, player.gold, player.materials);
            if (!res.success) return { ok: false, msg: res.reason ?? 'Cannot enchant.' };
            player.gold = res.gold;
            player.materials = res.materials;
            if (equippedSlot) {
              player.equipment[equippedSlot] = res.item;
            } else {
              const idx = player.inventory.findIndex((i) => i.id === itemId);
              if (idx !== -1) player.inventory[idx] = res.item;
            }
            audio.playForge();
            persistCurrentRun();
            syncUi();
            return { ok: true, msg: `Enchanted ${res.item.name} to +${res.item.level}!` };
          }}
          onReforgeItem={(itemId, equippedSlot) => {
            const target = equippedSlot
              ? player.equipment[equippedSlot]
              : player.inventory.find((i) => i.id === itemId);
            if (!target) return { ok: false, msg: 'Item not found.' };
            const res = reforgeEquipment(target, player.gold, player.materials);
            if (!res.success) return { ok: false, msg: res.reason ?? 'Cannot reforge.' };
            player.gold = res.gold;
            player.materials = res.materials;
            if (equippedSlot) {
              player.equipment[equippedSlot] = res.item;
            } else {
              const idx = player.inventory.findIndex((i) => i.id === itemId);
              if (idx !== -1) player.inventory[idx] = res.item;
            }
            audio.playForge();
            persistCurrentRun();
            syncUi();
            return { ok: true, msg: `Reforged ${res.item.name} affixes!` };
          }}
          onBuyPet={(petId) => {
            const res = buyPetFamiliar(playerRef.current, petId);
            if (!res.success) return { ok: false, msg: res.reason ?? 'Cannot adopt pet.' };
            playerRef.current = res.player;
            const pet = PET_CATALOG.find((p) => p.id === petId);
            audio.playCoin();
            showToast(`Adopted & summoned ${pet?.name ?? 'Familiar'}!`);
            persistCurrentRun();
            syncUi();
            return { ok: true, msg: `Adopted ${pet?.name ?? 'Familiar'}! Equipped and ready!` };
          }}
          onEquipPet={(petId) => {
            playerRef.current = equipPetFamiliar(playerRef.current, petId);
            audio.playMenuBlip();
            persistCurrentRun();
            syncUi();
          }}
          onStartArenaTrial={handleStartArenaTrial}
          onStartVoidTowerFloor={handleStartVoidTowerFloor}
        />
      )}

      {/* Pause Modal */}
      {mode === 'paused' && (
        <PauseModal
          onResume={() => updateMode(battleRef.current ? 'battle' : 'explore')}
          onRestart={startNewRun}
          onQuitToTitle={() => {
            if (!battleRef.current) {
              persistCurrentRun();
            }
            battleRef.current = null;
            encounterRef.current = createEncounterTransition();
            openModal('none');
            updateMode('title');
            syncUi();
          }}
        />
      )}

      {/* Victory / Game Over Modals */}
      {(mode === 'victory' || mode === 'gameover') && (
        <OutcomeModal
          kind={mode}
          player={player}
          zone={stage.zone}
          onRestart={startNewRun}
          onContinuePostgame={() => {
            updateMode('explore');
            showToast('Void Tower unlocked! Visit Wayside Camp anytime to climb.');
            syncUi();
          }}
          onEnterVoidTower={() => {
            handleStartVoidTowerFloor(1);
          }}
        />
      )}
    </main>
  );
}
