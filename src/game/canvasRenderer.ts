import { BattleState, getActiveEnemy } from './battleEngine';
import { MATERIAL_META } from './data';
import { PALETTE, RARITY_META } from './palette';
import { PlatformerPlayer } from './platformer';
import {
  drawActorSprite,
  drawChestSprite,
  drawFireplaceAndShopArt,
  drawGoldSprite,
  drawMaterialSprite,
  drawPortalSprite,
} from './sprites';
import { PlayerState, StageDefinition } from './types';
import { VfxManager } from './vfx';
import type { WeatherSystem } from './weather';

export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;

export const BATTLE_PLAYER_POS = { x: 126, y: 184 };
export const BATTLE_ENEMY_POS = { x: 348, y: 184 };

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

  // Parallax distant mountains
  for (let i = 0; i < 8; i++) {
    const mx = Math.round(((i * 110 - cam * 0.25) % 880 + 880) % 880 - 90);
    ctx.fillStyle = stage.zone >= 3 ? '#261733' : '#2a4d5c';
    ctx.beginPath();
    ctx.moveTo(mx, 228);
    ctx.lineTo(mx + 55, 130 + (i % 2) * 18);
    ctx.lineTo(mx + 110, 228);
    ctx.fill();
  }

  // Drifting pixel clouds
  for (let i = 0; i < 5; i++) {
    const cx = Math.round(((i * 135 + time * 8 - cam * 0.12) % 640 + 640) % 640 - 60);
    const cy = 28 + (i % 3) * 18;
    ctx.fillStyle = stage.zone >= 3 ? 'rgba(220,180,200,0.22)' : 'rgba(255,255,255,0.28)';
    ctx.fillRect(cx, cy, 36, 8);
    ctx.fillRect(cx + 8, cy - 5, 20, 6);
  }

  weather?.renderParticles(ctx, stage.zone, time, 'back');

  ctx.save();
  ctx.translate(Math.round(-cam + ox), Math.round(oy));

  // Background wooden fence posts & pixel trees for depth
  for (let fx = 30; fx < stage.width; fx += 96) {
    if (stage.zone <= 2) {
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(fx, 214, 4, 14);
      ctx.fillRect(fx + 24, 214, 4, 14);
      ctx.fillStyle = PALETTE.woodMid;
      ctx.fillRect(fx - 2, 218, 32, 2);
    } else {
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(fx, 204, 8, 24);
      ctx.fillStyle = PALETTE.fireOrange;
      ctx.fillRect(fx + 2, 200, 4, 4);
    }
  }

  // Platforms
  for (const plat of stage.platforms) {
    if (plat.kind === 'ground') {
      ctx.fillStyle = stage.groundColor;
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = stage.grassColor;
      ctx.fillRect(plat.x, plat.y, plat.w, 6);
      // Pixel grass blades
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
    } else {
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = PALETTE.stoneLight;
      ctx.fillRect(plat.x, plat.y, plat.w, 3);
    }
  }

  // World entities (Fireplace + Shop art, Chests, Gold, Materials, Enemies, Portal)
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
      // Subtle rarity marker above elite/boss in world
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

  // Player character sprite
  drawActorSprite(ctx, {
    x: pPlayer.x,
    y: pPlayer.y,
    sprite: playerState.classTier === 2 ? 'hero' : 'villager',
    animState: 'idle',
    time,
    facing: pPlayer.facing,
    scale: 1,
    walkCycle: pPlayer.walkCycle,
  });

  vfx.render(ctx);
  ctx.restore();
  weather?.renderParticles(ctx, stage.zone, time, 'front');
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
  const enemy = getActiveEnemy(battle);

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
    ctx.fillStyle = stage.zone >= 3 ? '#24142e' : '#244552';
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

  // Arena pedestals
  ctx.fillStyle = 'rgba(14, 11, 22, 0.35)';
  ctx.fillRect(BATTLE_PLAYER_POS.x - 28, BATTLE_PLAYER_POS.y - 2, 56, 7);
  ctx.fillRect(BATTLE_ENEMY_POS.x - 34, BATTLE_ENEMY_POS.y - 2, 68, 8);

  // Player Guard Shield aura
  if (battle.playerGuarding) {
    ctx.save();
    ctx.strokeStyle = PALETTE.cyanMagic;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.65 + Math.sin(time * 8) * 0.2;
    ctx.strokeRect(BATTLE_PLAYER_POS.x - 24, BATTLE_PLAYER_POS.y - 68, 48, 66);
    ctx.restore();
  }

  // Player Sprite (2x scale in battle!)
  drawActorSprite(ctx, {
    x: BATTLE_PLAYER_POS.x,
    y: BATTLE_PLAYER_POS.y,
    sprite: playerState.classTier === 2 ? 'hero' : 'villager',
    animState: battle.playerAnim,
    time,
    facing: 1,
    scale: 2,
  });

  // Enemy Sprite (2x scale, 2.35x for Boss)
  if (enemy) {
    const eScale = enemy.rarity === 'boss' ? 2.35 : enemy.rarity === 'elite' ? 2.15 : 2;
    drawActorSprite(ctx, {
      x: BATTLE_ENEMY_POS.x,
      y: BATTLE_ENEMY_POS.y,
      sprite: enemy.sprite,
      animState: enemy.animState,
      time,
      facing: -1,
      scale: eScale,
    });

    // Overhead Enemy Name + HP Bar + Stagger Bar (no giant stat box)
    const barW = 92;
    const bx = Math.round(BATTLE_ENEMY_POS.x - barW / 2);
    const spriteHeadOffset =
      enemy.sprite === 'chicken' || enemy.sprite === 'pig' ? 54 : 80;
    const by = Math.round(BATTLE_ENEMY_POS.y - spriteHeadOffset - 22);

    // Name & Rarity label
    ctx.font = 'bold 8px "Silkscreen", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(enemy.name, BATTLE_ENEMY_POS.x + 1, by - 3);
    ctx.fillStyle =
      enemy.rarity === 'boss'
        ? '#fb7185'
        : enemy.rarity === 'elite'
        ? PALETTE.gold
        : PALETTE.parchment;
    ctx.fillText(enemy.name, BATTLE_ENEMY_POS.x, by - 4);

    // HP bar frame
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(bx - 1, by, barW + 2, 8);
    ctx.fillStyle = '#331c24';
    ctx.fillRect(bx, by + 1, barW, 6);
    const hpRatio = Math.max(0, enemy.currentHp / Math.max(1, enemy.stats.hp));
    ctx.fillStyle = '#ef4444';
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

    // Staggered tag or Click hint
    ctx.font = '7px "Silkscreen", monospace';
    ctx.fillStyle = PALETTE.ink;
    if (enemy.staggeredTurns > 0) {
      ctx.fillText('STAGGERED!', BATTLE_ENEMY_POS.x + 1, by + 24);
      ctx.fillStyle = '#facc15';
      ctx.fillText('STAGGERED!', BATTLE_ENEMY_POS.x, by + 23);
    } else {
      ctx.fillText('CLICK TO INSPECT', BATTLE_ENEMY_POS.x + 1, by + 24);
      ctx.fillStyle = '#e6d8bd';
      ctx.fillText('CLICK TO INSPECT', BATTLE_ENEMY_POS.x, by + 23);
    }
  }

  vfx.render(ctx);
  ctx.restore();
  weather?.renderParticles(ctx, stage.zone, time, 'front');
}

export function getRarityColor(rarity: keyof typeof RARITY_META): string {
  return RARITY_META[rarity].color;
}
