import { BattleState, getActiveEnemy } from './battleEngine';
import { MATERIAL_META, PET_CATALOG } from './data';
import { PALETTE, RARITY_META } from './palette';
import { PlatformerPlayer } from './platformer';
import {
  drawActorSprite,
  drawBouncePadSprite,
  drawChestSprite,
  drawFireplaceAndShopArt,
  drawGoldSprite,
  drawHazardSprite,
  drawMaterialSprite,
  drawPortalSprite,
  drawShrineSprite,
} from './sprites';
import { CombatEnemy, PlayerState, SpriteId, StageDefinition } from './types';
import { VfxManager } from './vfx';
import type { WeatherSystem } from './weather';

export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;

export const BATTLE_PLAYER_POS = { x: 126, y: 184 };
export const BATTLE_PET_POS = { x: 76, y: 182 };
export const BATTLE_ENEMY_POS = { x: 348, y: 184 };
export const BATTLE_ADD_POSITIONS = [
  { x: 422, y: 172 },
  { x: 274, y: 172 },
];

export function getPlayerSprite(playerState: PlayerState): SpriteId {
  if (playerState.classTier === 3) {
    if (playerState.tier3Branch === 'vanguard') return 'hero_vanguard';
    if (playerState.tier3Branch === 'spellblade') return 'hero_spellblade';
    if (playerState.tier3Branch === 'shadowstrider') return 'hero_shadowstrider';
  }
  return playerState.classTier >= 2 ? 'hero' : 'villager';
}

export function renderExploreFrame(
  ctx: CanvasRenderingContext2D,
  stage: StageDefinition,
  pPlayer: PlatformerPlayer,
  playerState: PlayerState,
  vfx: VfxManager,
  time: number,
  isTitlePreview = false,
  weather?: WeatherSystem
) {
  ctx.imageSmoothingEnabled = false;
  const { ox, oy } = vfx.getShakeOffset();

  // Monotonic 16-bit stepped sky gradient
  ctx.fillStyle = stage.skyTop;
  ctx.fillRect(0, 0, INTERNAL_WIDTH, 85);
  ctx.fillStyle = stage.skyBottom;
  ctx.fillRect(0, 85, INTERNAL_WIDTH, INTERNAL_HEIGHT - 85);
  ctx.fillStyle = stage.skyTop;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, 72, INTERNAL_WIDTH, 32);
  ctx.globalAlpha = 1;

  const cam = isTitlePreview ? 0 : pPlayer.cameraX;
  weather?.renderSkyDecor(ctx, stage.zone, time, cam);

  // Parallax distant mountains / ruins / spires
  for (let i = 0; i < 8; i++) {
    const mx = Math.round(((i * 110 - cam * 0.25) % 880 + 880) % 880 - 90);
    ctx.fillStyle =
      stage.zone === 10
        ? '#1d0b33'
        : stage.zone === 9
        ? '#0f304a'
        : stage.zone >= 3
        ? '#261733'
        : '#2a4d5c';
    ctx.beginPath();
    ctx.moveTo(mx, 228);
    ctx.lineTo(mx + 55, 126 + (i % 2) * 18);
    ctx.lineTo(mx + 110, 228);
    ctx.fill();
  }

  // Drifting pixel clouds
  for (let i = 0; i < 5; i++) {
    const cx = Math.round(((i * 135 + time * 8 - cam * 0.12) % 640 + 640) % 640 - 60);
    const cy = 28 + (i % 3) * 18;
    ctx.fillStyle =
      stage.zone >= 9
        ? 'rgba(125,211,252,0.16)'
        : stage.zone >= 3
        ? 'rgba(220,180,200,0.22)'
        : 'rgba(255,255,255,0.28)';
    ctx.fillRect(cx, cy, 36, 8);
    ctx.fillRect(cx + 8, cy - 5, 20, 6);
  }

  weather?.renderParticles(ctx, stage.zone, time, 'back');

  ctx.save();
  ctx.translate(Math.round(-cam + ox), Math.round(oy));

  // Background props (fences in early zones, stone pillars / void crystals in late zones)
  for (let fx = 30; fx < stage.width; fx += 96) {
    if (stage.zone <= 2) {
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(fx, 214, 4, 14);
      ctx.fillRect(fx + 24, 214, 4, 14);
      ctx.fillStyle = PALETTE.woodMid;
      ctx.fillRect(fx - 2, 218, 32, 2);
    } else if (stage.zone === 9) {
      ctx.fillStyle = '#0c4a6e';
      ctx.fillRect(fx, 198, 9, 30);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(fx + 2, 194, 5, 4);
    } else if (stage.zone === 10) {
      ctx.fillStyle = '#2e1065';
      ctx.fillRect(fx, 196, 8, 32);
      ctx.fillStyle = '#e879f9';
      ctx.fillRect(fx + 2, 191, 4, 5);
    } else {
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(fx, 204, 8, 24);
      ctx.fillStyle = PALETTE.fireOrange;
      ctx.fillRect(fx + 2, 200, 4, 4);
    }
  }

  // Platforms (ground, wood, stone, crystal, void)
  for (const plat of stage.platforms) {
    if (plat.kind === 'ground') {
      ctx.fillStyle = stage.groundColor;
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = stage.grassColor;
      ctx.fillRect(plat.x, plat.y, plat.w, 6);
      ctx.fillStyle = stage.zone === 1 ? PALETTE.grassBright : stage.grassColor;
      for (let gx = plat.x; gx < plat.x + plat.w; gx += 16) {
        ctx.fillRect(gx + 2, plat.y - 2, 3, 2);
      }
    } else if (plat.kind === 'wood') {
      ctx.fillStyle = PALETTE.woodMid;
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = PALETTE.woodLight;
      ctx.fillRect(plat.x, plat.y, plat.w, 3);
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(plat.x, plat.y + plat.h - 2, plat.w, 2);
    } else if (plat.kind === 'crystal') {
      ctx.fillStyle = '#164e63';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(plat.x, plat.y, plat.w, 3);
      ctx.fillStyle = '#0e7490';
      ctx.fillRect(plat.x, plat.y + plat.h - 2, plat.w, 2);
    } else if (plat.kind === 'void') {
      ctx.fillStyle = '#2e1065';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = '#e879f9';
      ctx.fillRect(plat.x, plat.y, plat.w, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(plat.x, plat.y + plat.h - 2, plat.w, 2);
    } else {
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = PALETTE.stoneLight;
      ctx.fillRect(plat.x, plat.y, plat.w, 3);
    }
  }

  // World entities
  const bossDefeated = stage.entities.some(
    (e) => e.kind === 'enemy' && e.enemyRarity === 'boss' && e.defeated
  );

  for (const ent of stage.entities) {
    if (ent.kind === 'fireplace') {
      drawFireplaceAndShopArt(ctx, ent.x, ent.y, time);
    } else if (ent.kind === 'chest') {
      drawChestSprite(ctx, ent.x, ent.y, Boolean(ent.opened));
    } else if (ent.kind === 'gold' && !ent.collected) {
      drawGoldSprite(ctx, ent.x, ent.y, time);
    } else if (ent.kind === 'material' && !ent.collected) {
      const matColor = ent.materialId
        ? MATERIAL_META[ent.materialId].color
        : PALETTE.parchment;
      drawMaterialSprite(ctx, ent.x, ent.y, matColor, time);
    } else if (ent.kind === 'bounce_pad') {
      drawBouncePadSprite(ctx, ent.x, ent.y, time);
    } else if (ent.kind === 'hazard') {
      drawHazardSprite(
        ctx,
        ent.x,
        ent.y,
        ent.w,
        ent.hazardKind ?? 'spikes',
        time
      );
    } else if (ent.kind === 'shrine') {
      drawShrineSprite(ctx, ent.x, ent.y, Boolean(ent.used), time);
    } else if (ent.kind === 'portal') {
      if (bossDefeated || stage.zone < 4) {
        drawPortalSprite(ctx, ent.x, ent.y, time);
        if (!bossDefeated) {
          ctx.fillStyle = 'rgba(14,11,22,0.7)';
          ctx.fillRect(ent.x - 12, ent.y - 34, 24, 34);
        }
      }
    } else if (ent.kind === 'enemy' && !ent.defeated && ent.enemySprite) {
      const scale =
        ent.enemyRarity === 'boss' ? 1.4 : ent.enemyRarity === 'elite' ? 1.15 : 1;
      drawActorSprite(ctx, {
        x: ent.x,
        y: ent.y,
        sprite: ent.enemySprite,
        animState: 'idle',
        time,
        facing: ent.facing ?? -1,
        scale,
      });
      if (ent.enemyRarity === 'elite' || ent.enemyRarity === 'boss') {
        const tagColor =
          ent.enemyRarity === 'boss' ? PALETTE.crimson : PALETTE.gold;
        ctx.fillStyle = PALETTE.ink;
        ctx.fillRect(Math.round(ent.x - 16), Math.round(ent.y - 46 * scale), 32, 9);
        ctx.font = 'bold 7px "Silkscreen", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = tagColor;
        ctx.fillText(
          ent.enemyRarity === 'boss' ? 'BOSS' : 'ELITE',
          Math.round(ent.x),
          Math.round(ent.y - 46 * scale + 7)
        );
      }
    }
  }

  // Equipped Pet Familiar trailing behind player
  if (playerState.equippedPetId && !isTitlePreview) {
    const pet = PET_CATALOG.find((p) => p.id === playerState.equippedPetId);
    if (pet) {
      drawActorSprite(ctx, {
        x: pPlayer.petX,
        y: pPlayer.petY,
        sprite: pet.sprite,
        animState: 'idle',
        time,
        facing: pPlayer.facing,
        scale: 1,
      });
    }
  }

  // Player character sprite (flashes slightly during hazard invuln frames)
  const flashHide =
    pPlayer.invulnTimer > 0 && Math.floor(time * 20) % 2 === 0;
  if (!flashHide) {
    drawActorSprite(ctx, {
      x: pPlayer.x,
      y: pPlayer.y,
      sprite: getPlayerSprite(playerState),
      animState: 'idle',
      time,
      facing: pPlayer.facing,
      scale: 1,
      walkCycle: pPlayer.walkCycle,
    });
  }

  vfx.render(ctx);
  ctx.restore();
  weather?.renderParticles(ctx, stage.zone, time, 'front');
}

function renderBattleEnemyActor(
  ctx: CanvasRenderingContext2D,
  enemy: CombatEnemy,
  pos: { x: number; y: number },
  isTargeted: boolean,
  isPrimarySlot: boolean,
  time: number
) {
  const baseScale =
    enemy.rarity === 'boss' ? 2.35 : enemy.rarity === 'elite' ? 2.15 : 2;
  const eScale = isPrimarySlot ? baseScale : Math.max(1.45, baseScale * 0.78);

  // Enraged Crimson Aura around Phase 3 Boss
  if (enemy.enraged && enemy.currentHp > 0) {
    ctx.save();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55 + Math.sin(time * 12) * 0.3;
    ctx.strokeRect(
      Math.round(pos.x - 36),
      Math.round(pos.y - 84),
      72,
      84
    );
    ctx.restore();
  }

  // Pedestal shadow
  ctx.fillStyle = 'rgba(14, 11, 22, 0.35)';
  ctx.fillRect(Math.round(pos.x - 28), Math.round(pos.y - 2), 56, 7);

  drawActorSprite(ctx, {
    x: pos.x,
    y: pos.y,
    sprite: enemy.sprite,
    animState: enemy.animState,
    time,
    facing: -1,
    scale: eScale,
  });

  if (enemy.currentHp <= 0) return;

  const barW = isPrimarySlot ? 92 : 68;
  const bx = Math.round(pos.x - barW / 2);
  const spriteHeadOffset =
    enemy.sprite === 'chicken' || enemy.sprite === 'pig' ? 54 : isPrimarySlot ? 80 : 62;
  const by = Math.round(pos.y - spriteHeadOffset - 22);

  // Active target chevron
  if (isTargeted) {
    const bounce = Math.sin(time * 8) * 2;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(Math.round(pos.x - 4), Math.round(by - 20 + bounce), 8, 3);
    ctx.fillRect(Math.round(pos.x - 2), Math.round(by - 17 + bounce), 4, 2);
  }

  // Name & Phase/Barrier tag
  ctx.font = isPrimarySlot ? 'bold 8px "Silkscreen", monospace' : 'bold 7px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(enemy.name, pos.x + 1, by - 3);
  ctx.fillStyle =
    enemy.enraged
      ? '#f43f5e'
      : enemy.rarity === 'boss'
      ? '#fb7185'
      : enemy.rarity === 'elite'
      ? PALETTE.gold
      : PALETTE.parchment;
  ctx.fillText(enemy.name, pos.x, by - 4);

  // HP bar frame
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(bx - 1, by, barW + 2, 8);
  ctx.fillStyle = '#331c24';
  ctx.fillRect(bx, by + 1, barW, 6);
  const hpRatio = Math.max(0, enemy.currentHp / Math.max(1, enemy.stats.hp));
  ctx.fillStyle = enemy.enraged ? '#f43f5e' : '#ef4444';
  ctx.fillRect(bx, by + 1, Math.round(barW * hpRatio), 6);

  // Stagger bar directly beneath HP bar
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(bx - 1, by + 9, barW + 2, 6);
  ctx.fillStyle = '#292214';
  ctx.fillRect(bx, by + 10, barW, 4);
  const stagRatio =
    enemy.staggeredTurns > 0
      ? 0
      : Math.max(0, enemy.currentStagger / Math.max(1, enemy.maxStagger));
  ctx.fillStyle = enemy.staggeredTurns > 0 ? '#facc15' : '#f59e0b';
  ctx.fillRect(bx, by + 10, Math.round(barW * stagRatio), 4);

  // Shield pips if Phase 2 barrier is active
  if (enemy.shieldHits > 0) {
    for (let s = 0; s < enemy.shieldHits; s++) {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(bx + s * 10, by + 17, 7, 4);
    }
  }

  if (isPrimarySlot) {
    ctx.font = '7px "Silkscreen", monospace';
    ctx.fillStyle = PALETTE.ink;
    const tag =
      enemy.staggeredTurns > 0
        ? 'STAGGERED!'
        : enemy.enraged
        ? 'PHASE 3 ENRAGED'
        : enemy.bossPhase === 2
        ? 'PHASE 2'
        : isTargeted
        ? 'TARGETED'
        : 'CLICK TO TARGET';
    ctx.fillText(tag, pos.x + 1, by + 26);
    ctx.fillStyle =
      enemy.staggeredTurns > 0
        ? '#facc15'
        : enemy.enraged
        ? '#f43f5e'
        : '#e6d8bd';
    ctx.fillText(tag, pos.x, by + 25);
  }
}

export function renderBattleFrame(
  ctx: CanvasRenderingContext2D,
  stage: StageDefinition,
  battle: BattleState,
  playerState: PlayerState,
  vfx: VfxManager,
  time: number,
  weather?: WeatherSystem
) {
  ctx.imageSmoothingEnabled = false;
  const { ox, oy } = vfx.getShakeOffset();
  const activeEnemy = getActiveEnemy(battle);
  const primaryEnemy = battle.wave[battle.waveIndex];

  ctx.save();
  ctx.translate(ox, oy);

  // Dramatic 16-bit Battle Backdrop
  ctx.fillStyle = stage.skyTop;
  ctx.fillRect(0, 0, INTERNAL_WIDTH, 92);
  ctx.fillStyle = stage.skyBottom;
  ctx.fillRect(0, 92, INTERNAL_WIDTH, 92);

  weather?.renderSkyDecor(ctx, stage.zone, time, 0);

  // Distant silhouettes
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle =
      stage.zone === 10
        ? '#1b0930'
        : stage.zone === 9
        ? '#0f2c44'
        : stage.zone >= 3
        ? '#24142e'
        : '#244552';
    ctx.beginPath();
    ctx.moveTo(i * 95 - 20, 184);
    ctx.lineTo(i * 95 + 35, 118 + (i % 2) * 16);
    ctx.lineTo(i * 95 + 90, 184);
    ctx.fill();
  }

  weather?.renderParticles(ctx, stage.zone, time, 'back');

  // Arena Floor
  ctx.fillStyle = stage.grassColor;
  ctx.fillRect(0, 180, INTERNAL_WIDTH, 14);
  ctx.fillStyle = stage.groundColor;
  ctx.fillRect(0, 194, INTERNAL_WIDTH, 76);

  // Player pedestal
  ctx.fillStyle = 'rgba(14, 11, 22, 0.35)';
  ctx.fillRect(BATTLE_PLAYER_POS.x - 28, BATTLE_PLAYER_POS.y - 2, 56, 7);

  // Player Guard Shield aura
  if (battle.playerGuarding) {
    ctx.save();
    ctx.strokeStyle = PALETTE.cyanMagic;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.65 + Math.sin(time * 8) * 0.2;
    ctx.strokeRect(BATTLE_PLAYER_POS.x - 24, BATTLE_PLAYER_POS.y - 68, 48, 66);
    ctx.restore();
  }

  // Equipped Pet Familiar on left flank in Battle
  if (playerState.equippedPetId) {
    const pet = PET_CATALOG.find((p) => p.id === playerState.equippedPetId);
    if (pet) {
      drawActorSprite(ctx, {
        x: BATTLE_PET_POS.x,
        y: BATTLE_PET_POS.y,
        sprite: pet.sprite,
        animState: battle.petTurnCounter === 0 && battle.turnCount > 1 ? 'attack' : 'idle',
        time,
        facing: 1,
        scale: 1.55,
      });
    }
  }

  // Player Sprite (2x scale in battle!)
  drawActorSprite(ctx, {
    x: BATTLE_PLAYER_POS.x,
    y: BATTLE_PLAYER_POS.y,
    sprite: getPlayerSprite(playerState),
    animState: battle.playerAnim,
    time,
    facing: 1,
    scale: 2,
  });

  // Render adds slightly behind/flanking primary enemy, then primary enemy
  battle.adds.slice(0, 2).forEach((add, idx) => {
    const pos = BATTLE_ADD_POSITIONS[idx] ?? BATTLE_ADD_POSITIONS[0];
    renderBattleEnemyActor(
      ctx,
      add,
      pos,
      activeEnemy?.uid === add.uid,
      false,
      time
    );
  });

  if (primaryEnemy) {
    renderBattleEnemyActor(
      ctx,
      primaryEnemy,
      BATTLE_ENEMY_POS,
      activeEnemy?.uid === primaryEnemy.uid,
      true,
      time
    );
  }

  vfx.render(ctx);
  ctx.restore();
  weather?.renderParticles(ctx, stage.zone, time, 'front');
}

export function getRarityColor(rarity: keyof typeof RARITY_META): string {
  return RARITY_META[rarity].color;
}
