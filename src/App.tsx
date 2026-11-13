import { useCallback, useEffect, useRef, useState } from 'react';
import { BattleHud } from './components/BattleHud';
import { ExploreHud } from './components/ExploreHud';
import { FireplaceTownModal } from './components/FireplaceTownModal';
import { InventoryModal } from './components/InventoryModal';
import { SkillTreeModal } from './components/SkillTreeModal';
import { OutcomeModal, PauseModal } from './components/StatusModals';
import { TitleOverlay } from './components/TitleOverlay';
import { audio } from './game/audio';
import {
  BattleState,
  CombatActionEvents,
  createBattleState,
  executePlayerAction,
  getActiveEnemy,
  getEquippedSkillsList,
  resolveQteInput,
  stepBattleTimeline,
} from './game/battleEngine';
import {
  BATTLE_ENEMY_POS,
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  renderBattleFrame,
  renderExploreFrame,
} from './game/canvasRenderer';
import { MATERIAL_META, SHOP_CONSUMABLES } from './game/data';
import {
  PlatformerPlayer,
  createPlatformerPlayer,
  stepPlatformer,
} from './game/platformer';
import {
  advanceToHeroClass,
  computePlayerStats,
  createInitialPlayer,
  enchantEquipment,
  generateEquipment,
  reforgeEquipment,
  rollRarityForEnemy,
  spawnEnemyWave,
  toggleEquipSkill,
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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable simulation refs (never cause 60Hz React re-renders)
  const modeRef = useRef<GameMode>('title');
  const playerRef = useRef<PlayerState>(createInitialPlayer());
  const stageRef = useRef<StageDefinition>(buildStage(1));
  const pPlayerRef = useRef<PlatformerPlayer>(createPlatformerPlayer());
  const battleRef = useRef<BattleState | null>(null);
  const vfxRef = useRef<VfxManager>(new VfxManager());
  const nearbyRef = useRef<WorldEntity | null>(null);
  const keysHeldRef = useRef<Set<string>>(new Set());
  const jumpJustPressedRef = useRef<boolean>(false);
  const activeModalRef = useRef<'none' | 'inventory' | 'skills' | 'town'>('none');

  // Discrete React UI state synced only on events/turns
  const [mode, setMode] = useState<GameMode>('title');
  const [activeModal, setActiveModal] = useState<
    'none' | 'inventory' | 'skills' | 'town'
  >('none');
  const [townInitialTab, setTownInitialTab] = useState<'shop' | 'blacksmith'>('shop');
  const [inspectEnemyOpen, setInspectEnemyOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [, setUiTick] = useState(0);

  const syncUi = useCallback(() => {
    setUiTick((t) => t + 1);
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
      const pos =
        v.target === 'enemy'
          ? { x: BATTLE_ENEMY_POS.x, y: BATTLE_ENEMY_POS.y - 38 }
          : { x: 126, y: 145 };
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
    playerRef.current = createInitialPlayer();
    stageRef.current = buildStage(1);
    pPlayerRef.current = createPlatformerPlayer();
    battleRef.current = null;
    nearbyRef.current = null;
    keysHeldRef.current.clear();
    setInspectEnemyOpen(false);
    openModal('none');
    updateMode('explore');
    syncUi();
  }, [openModal, syncUi, updateMode]);

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
      battleRef.current = createBattleState(stage.zone, rarity, ent.id, wave);
      keysHeldRef.current.clear();
      setInspectEnemyOpen(false);
      updateMode('battle');
      syncUi();
    },
    [syncUi, updateMode]
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
      if (nextZone <= 8) {
        playerRef.current.highestZone = Math.max(
          playerRef.current.highestZone,
          nextZone
        );
        stageRef.current = buildStage(nextZone);
        pPlayerRef.current = createPlatformerPlayer();
        audio.playLevelUp();
        showToast(`Entered Zone ${nextZone}: ${stageRef.current.name}!`);
        syncUi();
      }
    }
  }, [openModal, showToast, syncUi]);

  const handleBattleAction = useCallback(
    (
      action:
        | { kind: 'attack' }
        | { kind: 'guard' }
        | { kind: 'skill'; skillId: string }
        | { kind: 'ultimate' }
        | { kind: 'consumable'; itemId: string }
    ) => {
      const battle = battleRef.current;
      if (!battle || battle.phase !== 'player_turn') return;
      audio.unlock();
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
          startNewRun();
        }
        return;
      }

      if (code === 'KeyM') {
        const nextMuted = !audio.isMuted();
        audio.setMuted(nextMuted);
        setMuted(nextMuted);
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
          if (code === 'KeyQ') handleBattleAction({ kind: 'attack' });
          else if (code === 'KeyG') handleBattleAction({ kind: 'guard' });
          else if (code === 'KeyU') handleBattleAction({ kind: 'ultimate' });
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
    handleBattleAction,
    handleInteract,
    handleQteTrigger,
    openModal,
    startNewRun,
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
      const simDt = vfx.hitstop > 0 ? 0 : dt;

      const curMode = modeRef.current;

      if (curMode === 'explore' && activeModalRef.current === 'none') {
        const held = keysHeldRef.current;
        const left = held.has('ArrowLeft') || held.has('KeyA');
        const right = held.has('ArrowRight') || held.has('KeyD');
        const jumpHeld =
          held.has('Space') || held.has('ArrowUp') || held.has('KeyW');
        const jumpJustPressed = jumpJustPressedRef.current;
        jumpJustPressedRef.current = false;

        const stepRes = stepPlatformer(
          pPlayerRef.current,
          stageRef.current,
          { left, right, jumpJustPressed, jumpHeld },
          simDt
        );

        if (stepRes.jumped) {
          audio.playJump();
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
          syncUi();
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
          syncUi();
        }
        if (nearbyRef.current?.id !== stepRes.nearbyInteractable?.id) {
          nearbyRef.current = stepRes.nearbyInteractable;
          syncUi();
        }
        if (stepRes.triggeredEnemy) {
          startBattleFromWorldEntity(stepRes.triggeredEnemy);
        }
      } else if (curMode === 'battle' && battleRef.current) {
        const battle = battleRef.current;
        const prevPhase = battle.phase;
        const events = stepBattleTimeline(battle, playerRef.current, simDt);
        if (events.sfx.length > 0 || events.vfx.length > 0) {
          applyCombatEvents(events);
        }

        if (battle.phase === 'victory' && battle.phaseTimer <= 0.05) {
          // Mark world enemy defeated
          const worldEnt = stageRef.current.entities.find(
            (e) => e.id === battle.sourceEntityId
          );
          if (worldEnt) worldEnt.defeated = true;

          const rewards = battle.rewards;
          const isFinalBoss =
            stageRef.current.zone === 8 && battle.encounterRarity === 'boss';

          if (isFinalBoss) {
            battleRef.current = null;
            updateMode('victory');
            syncUi();
          } else {
            const rewardSummary = [
              `+${rewards.xp} XP`,
              `+${rewards.gold}G`,
              rewards.items.length > 0 ? `${rewards.items[0].name}!` : '',
            ]
              .filter(Boolean)
              .join(' · ');
            showToast(`Victory! ${rewardSummary}`);
            battleRef.current = null;
            updateMode('explore');
            syncUi();
          }
        } else if (battle.phase === 'defeat') {
          battleRef.current = null;
          updateMode('gameover');
          syncUi();
        } else if (
          prevPhase !== battle.phase ||
          battle.phase === 'qte_dodge' ||
          battle.phase === 'qte_counter'
        ) {
          syncUi();
        }
      }

      // Render active scene to 480x270 canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        if (curMode === 'battle' && battleRef.current) {
          renderBattleFrame(
            ctx,
            stageRef.current,
            battleRef.current,
            playerRef.current,
            vfx,
            elapsed
          );
        } else {
          renderExploreFrame(
            ctx,
            stageRef.current,
            pPlayerRef.current,
            playerRef.current,
            vfx,
            elapsed,
            curMode === 'title'
          );
        }
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, [applyCombatEvents, showToast, startBattleFromWorldEntity, syncUi, updateMode]);

  // Click Enemy on Canvas to Open Full Enemy Stat Inspector
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    audio.unlock();
    if (modeRef.current !== 'battle' || !battleRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * INTERNAL_WIDTH;
    const cy = ((e.clientY - rect.top) / rect.height) * INTERNAL_HEIGHT;

    if (
      Math.abs(cx - BATTLE_ENEMY_POS.x) < 62 &&
      cy > BATTLE_ENEMY_POS.y - 125 &&
      cy < BATTLE_ENEMY_POS.y + 15
    ) {
      audio.playMenuBlip();
      setInspectEnemyOpen((prev) => !prev);
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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1b162b] border-2 border-[#f7c948] px-4 py-2 font-pixel text-xs text-[#f7c948] shadow-[0_4px_0_#0e0b16] animate-juicy-pop pointer-events-none">
          {toast}
        </div>
      )}

      {/* Title Screen */}
      {mode === 'title' && <TitleOverlay onStart={startNewRun} />}

      {/* Explore HUD */}
      {mode === 'explore' && (
        <ExploreHud
          player={player}
          stage={stage}
          nearbyInteractable={nearbyRef.current}
          muted={muted}
          onToggleMute={() => {
            const next = !audio.isMuted();
            audio.setMuted(next);
            setMuted(next);
          }}
          onPause={() => updateMode('paused')}
          onOpenInventory={() => openModal('inventory')}
          onOpenSkillTree={() => openModal('skills')}
          onInteract={handleInteract}
          onSelectZone={(z) => {
            stageRef.current = buildStage(z);
            pPlayerRef.current = createPlatformerPlayer();
            nearbyRef.current = null;
            audio.playMenuBlip();
            showToast(`Traveled to Zone ${z}: ${stageRef.current.name}`);
            syncUi();
          }}
        />
      )}

      {/* Battle HUD */}
      {mode === 'battle' && battle && (
        <BattleHud
          player={player}
          battle={battle}
          inspectEnemyOpen={inspectEnemyOpen}
          muted={muted}
          onToggleMute={() => {
            const next = !audio.isMuted();
            audio.setMuted(next);
            setMuted(next);
          }}
          onToggleInspectEnemy={(open) => setInspectEnemyOpen(open)}
          onAction={handleBattleAction}
          onQteTrigger={handleQteTrigger}
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
            syncUi();
          }}
          onSellItem={(itemId) => {
            const idx = player.inventory.findIndex((i) => i.id === itemId);
            if (idx === -1) return;
            const item = player.inventory[idx];
            player.gold += item.sellValue;
            player.inventory.splice(idx, 1);
            audio.playCoin();
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
            syncUi();
          }}
          onToggleEquipSkill={(skillId) => {
            playerRef.current = toggleEquipSkill(playerRef.current, skillId);
            audio.playMenuBlip();
            syncUi();
          }}
          onAdvanceClass={() => {
            playerRef.current = advanceToHeroClass(playerRef.current);
            audio.playVictory();
            showToast('Class Advanced to Vanguard Hero (Tier 2)!');
            syncUi();
          }}
        />
      )}

      {/* Fireplace Shop & Blacksmith Modal */}
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
            syncUi();
          }}
          onBuyStarterGear={(slot, name, price) => {
            if (player.gold < price) return;
            player.gold -= price;
            player.inventory.push(generateEquipment(slot, 'common', 1, name));
            audio.playCoin();
            syncUi();
          }}
          onBuyMaterial={(mId) => {
            const price = MATERIAL_META[mId].price;
            if (player.gold < price) return;
            player.gold -= price;
            player.materials[mId] += 1;
            audio.playCoin();
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
            syncUi();
            return { ok: true, msg: `Reforged ${res.item.name} affixes!` };
          }}
        />
      )}

      {/* Pause Modal */}
      {mode === 'paused' && (
        <PauseModal
          onResume={() => updateMode(battleRef.current ? 'battle' : 'explore')}
          onRestart={startNewRun}
          onQuitToTitle={() => {
            battleRef.current = null;
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
        />
      )}
    </main>
  );
}
