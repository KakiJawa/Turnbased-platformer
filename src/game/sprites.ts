import { PALETTE } from './palette';
import { ActorAnimState, SpriteId } from './types';

// Helper to draw crisp pixel rectangles relative to actor anchor (center-bottom x, y)
function pxRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export interface SpriteDrawOptions {
  x: number; // Bottom-center X in internal 480x270 canvas coords
  y: number; // Bottom-center Y
  sprite: SpriteId;
  animState: ActorAnimState;
  time: number;
  facing?: 1 | -1;
  scale?: number;
  walkCycle?: number;
}

export function drawActorSprite(
  ctx: CanvasRenderingContext2D,
  opts: SpriteDrawOptions
) {
  const {
    x,
    y,
    sprite,
    animState,
    time,
    facing = 1,
    scale = 1,
    walkCycle = 0,
  } = opts;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  // Pose transforms per 5 required states: idle, attack, hit, staggered, death
  let offsetX = 0;
  let offsetY = 0;
  let rot = 0;
  let sx = facing * scale;
  let sy = scale;
  let hitFlash = false;

  if (animState === 'idle') {
    const bob = Math.sin(time * 4.5) > 0 ? -1 : 0;
    const walkBob = walkCycle > 0 ? Math.abs(Math.sin(walkCycle * 0.28)) * -3 : 0;
    offsetY = bob + walkBob;
  } else if (animState === 'attack') {
    offsetX = facing * 9 * scale;
    offsetY = -2 * scale;
    sx = facing * scale * 1.12;
    sy = scale * 0.92;
  } else if (animState === 'hit') {
    offsetX = -facing * 6 * scale;
    offsetY = -1 * scale;
    sx = facing * scale * 0.88;
    sy = scale * 1.1;
    hitFlash = Math.floor(time * 24) % 2 === 0;
  } else if (animState === 'staggered') {
    offsetX = Math.sin(time * 26) * 2 * scale;
    rot = -facing * 0.22;
    sy = scale * 0.85;
  } else if (animState === 'death') {
    rot = -facing * 1.48;
    offsetY = -4 * scale;
    ctx.globalAlpha = 0.65;
  }

  ctx.translate(Math.round(offsetX), Math.round(offsetY));
  if (rot !== 0) ctx.rotate(rot);
  ctx.scale(sx, sy);

  // Ground shadow
  if (animState !== 'death') {
    ctx.fillStyle = 'rgba(14, 11, 22, 0.45)';
    ctx.fillRect(-10, -2, 20, 3);
  }

  switch (sprite) {
    case 'villager':
      drawVillagerPixels(ctx, animState, time, walkCycle);
      break;
    case 'hero':
      drawHeroPixels(ctx, animState, time, walkCycle);
      break;
    case 'chicken':
      drawChickenPixels(ctx, animState, time);
      break;
    case 'pig':
    case 'war_boar':
      drawPigPixels(ctx, sprite === 'war_boar', animState);
      break;
    case 'cow':
      drawCowPixels(ctx, animState);
      break;
    case 'rooster_boss':
      drawRoosterBossPixels(ctx, animState, time);
      break;
    case 'wolf':
      drawWolfPixels(ctx, animState);
      break;
    case 'bandit':
      drawBanditPixels(ctx, animState);
      break;
    case 'golem':
    case 'treant_boss':
      drawGolemOrTreantPixels(ctx, sprite === 'treant_boss', animState);
      break;
    case 'orc':
    case 'orc_shaman':
    case 'warchief_boss':
      drawOrcPixels(ctx, sprite, animState);
      break;
    case 'wyvern':
    case 'drake_knight':
    case 'magma':
    case 'dragon_boss':
      drawDragonFamilyPixels(ctx, sprite, animState, time);
      break;
  }

  // Hit white flash overlay
  if (hitFlash) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillRect(-24, -40, 48, 44);
  }

  ctx.restore();

  // Staggered dizzy stars above head
  if (animState === 'staggered') {
    for (let i = 0; i < 3; i++) {
      const ang = time * 5 + (i * Math.PI * 2) / 3;
      const sxPos = Math.round(x + Math.cos(ang) * 10 * scale);
      const syPos = Math.round(y - 28 * scale + Math.sin(ang) * 3);
      pxRect(ctx, sxPos - 1, syPos - 1, 3, 3, PALETTE.gold);
    }
  }
}

function drawVillagerPixels(
  ctx: CanvasRenderingContext2D,
  anim: ActorAnimState,
  time: number,
  walkCycle: number
) {
  const step = walkCycle > 0 ? Math.sin(walkCycle * 0.35) * 2 : 0;
  // Legs / Boots
  pxRect(ctx, -5, -7 + step, 4, 7, PALETTE.woodDark);
  pxRect(ctx, 1, -7 - step, 4, 7, PALETTE.woodMid);
  // Tunic
  pxRect(ctx, -7, -17, 14, 11, '#4f6d8a');
  pxRect(ctx, -7, -11, 14, 2, PALETTE.woodMid); // Belt
  pxRect(ctx, -1, -11, 2, 2, PALETTE.gold); // Buckle
  // Head
  pxRect(ctx, -6, -26, 12, 9, PALETTE.skinLight);
  pxRect(ctx, -6, -27, 12, 3, '#7c4a2d'); // Hair
  // Straw Hat
  pxRect(ctx, -9, -28, 18, 2, '#e6b84c');
  pxRect(ctx, -6, -31, 12, 3, '#f7c948');
  // Eye
  if (anim === 'staggered' || anim === 'hit') {
    pxRect(ctx, 2, -23, 2, 1, PALETTE.ink);
    pxRect(ctx, 3, -22, 2, 1, PALETTE.ink);
  } else {
    pxRect(ctx, 2, -23, 2, 3, PALETTE.ink);
  }
  // Pitchfork / Tool
  const armAngle = anim === 'attack' ? 1 : 0;
  if (armAngle) {
    pxRect(ctx, 5, -16, 14, 2, PALETTE.woodLight);
    pxRect(ctx, 17, -19, 2, 8, PALETTE.stoneLight);
    pxRect(ctx, 19, -19, 4, 1, PALETTE.white);
    pxRect(ctx, 19, -16, 4, 1, PALETTE.white);
    pxRect(ctx, 19, -13, 4, 1, PALETTE.white);
  } else {
    pxRect(ctx, 6, -22 + Math.sin(time * 3), 2, 18, PALETTE.woodLight);
    pxRect(ctx, 4, -25 + Math.sin(time * 3), 6, 2, PALETTE.stoneLight);
    pxRect(ctx, 4, -28 + Math.sin(time * 3), 1, 3, PALETTE.white);
    pxRect(ctx, 7, -28 + Math.sin(time * 3), 1, 3, PALETTE.white);
    pxRect(ctx, 9, -28 + Math.sin(time * 3), 1, 3, PALETTE.white);
  }
}

function drawHeroPixels(
  ctx: CanvasRenderingContext2D,
  anim: ActorAnimState,
  _time: number,
  walkCycle: number
) {
  const step = walkCycle > 0 ? Math.sin(walkCycle * 0.35) * 2 : 0;
  // Cape
  pxRect(ctx, -10, -18, 5, 13, '#b91c1c');
  // Greaves
  pxRect(ctx, -5, -7 + step, 4, 7, '#475569');
  pxRect(ctx, 1, -7 - step, 4, 7, '#64748b');
  // Armored Chestplate
  pxRect(ctx, -7, -18, 14, 12, '#94a3b8');
  pxRect(ctx, -5, -17, 10, 8, '#cbd5e1');
  pxRect(ctx, -7, -11, 14, 2, PALETTE.gold);
  // Head & Crested Helm
  pxRect(ctx, -6, -27, 12, 9, PALETTE.skinLight);
  pxRect(ctx, -7, -30, 14, 5, '#64748b');
  pxRect(ctx, -3, -34, 6, 4, PALETTE.gold);
  pxRect(ctx, 2, -24, 2, 3, PALETTE.cyanMagic);
  // Runed Greatsword
  if (anim === 'attack') {
    pxRect(ctx, 6, -15, 18, 3, '#e2e8f0');
    pxRect(ctx, 6, -14, 16, 1, PALETTE.cyanMagic);
    pxRect(ctx, 5, -18, 2, 9, PALETTE.gold);
  } else {
    pxRect(ctx, 7, -28, 3, 18, '#e2e8f0');
    pxRect(ctx, 8, -26, 1, 13, PALETTE.cyanMagic);
    pxRect(ctx, 5, -11, 7, 2, PALETTE.gold);
  }
}

function drawChickenPixels(
  ctx: CanvasRenderingContext2D,
  anim: ActorAnimState,
  time: number
) {
  pxRect(ctx, -4, -4, 2, 4, PALETTE.fireOrange);
  pxRect(ctx, 2, -4, 2, 4, PALETTE.fireOrange);
  pxRect(ctx, -7, -13, 14, 9, PALETTE.parchment);
  pxRect(ctx, -8, -11, 3, 5, PALETTE.cream); // Tail
  pxRect(ctx, 1, -18, 7, 7, PALETTE.white);
  pxRect(ctx, 2, -21, 5, 3, PALETTE.fireRed); // Comb
  pxRect(ctx, 8, -15, 4, 2, PALETTE.gold); // Beak
  pxRect(ctx, 4, -16, 2, 2, anim === 'staggered' ? PALETTE.crimson : PALETTE.ink);
  if (anim === 'attack' || Math.sin(time * 8) > 0.7) {
    pxRect(ctx, -3, -12, 6, 5, PALETTE.cream); // Wing flap
  }
}

function drawPigPixels(
  ctx: CanvasRenderingContext2D,
  armored: boolean,
  anim: ActorAnimState
) {
  pxRect(ctx, -8, -4, 3, 4, '#9d5364');
  pxRect(ctx, 4, -4, 3, 4, '#9d5364');
  const bodyCol = armored ? '#52525b' : '#f4a2a8';
  pxRect(ctx, -10, -14, 20, 10, bodyCol);
  if (armored) {
    pxRect(ctx, -8, -13, 16, 4, '#94a3b8');
  }
  pxRect(ctx, 5, -13, 7, 7, armored ? '#71717a' : '#f9bec7');
  pxRect(ctx, 11, -10, 3, 4, '#e07a94'); // Snout
  pxRect(ctx, 8, -11, 2, 2, anim === 'staggered' ? PALETTE.gold : PALETTE.ink);
  if (armored) {
    pxRect(ctx, 10, -7, 4, 2, PALETTE.white); // Tusks
  }
}

function drawCowPixels(ctx: CanvasRenderingContext2D, anim: ActorAnimState) {
  pxRect(ctx, -10, -5, 3, 5, PALETTE.ink);
  pxRect(ctx, 6, -5, 3, 5, PALETTE.ink);
  pxRect(ctx, -12, -17, 22, 12, PALETTE.white);
  pxRect(ctx, -9, -15, 6, 6, '#292524'); // Spot
  pxRect(ctx, 1, -13, 5, 5, '#292524');
  pxRect(ctx, 6, -18, 9, 9, PALETTE.white);
  pxRect(ctx, 7, -21, 2, 3, PALETTE.cream); // Horns
  pxRect(ctx, 12, -21, 2, 3, PALETTE.cream);
  pxRect(ctx, 12, -13, 4, 4, '#f4a2a8'); // Nose
  pxRect(ctx, 10, -16, 2, 2, anim === 'attack' ? PALETTE.crimson : PALETTE.ink);
}

function drawRoosterBossPixels(
  ctx: CanvasRenderingContext2D,
  anim: ActorAnimState,
  time: number
) {
  pxRect(ctx, -6, -6, 3, 6, PALETTE.fireOrange);
  pxRect(ctx, 3, -6, 3, 6, PALETTE.fireOrange);
  pxRect(ctx, -12, -20, 22, 14, '#fef3c7');
  pxRect(ctx, -16, -24, 7, 10, '#dc2626'); // Big tail plumes
  pxRect(ctx, -14, -22, 4, 8, PALETTE.gold);
  pxRect(ctx, 2, -28, 10, 10, PALETTE.white);
  pxRect(ctx, 2, -33, 9, 5, PALETTE.fireRed); // Crown comb
  pxRect(ctx, 12, -24, 6, 3, PALETTE.gold); // Giant beak
  pxRect(ctx, 7, -25, 2, 2, PALETTE.crimson);
  if (anim === 'attack' || Math.sin(time * 7) > 0) {
    pxRect(ctx, -5, -18, 10, 7, '#fde68a');
  }
}

function drawWolfPixels(ctx: CanvasRenderingContext2D, anim: ActorAnimState) {
  pxRect(ctx, -9, -5, 3, 5, '#475569');
  pxRect(ctx, 5, -5, 3, 5, '#475569');
  pxRect(ctx, -11, -14, 20, 9, '#64748b');
  pxRect(ctx, -15, -15, 5, 4, '#94a3b8'); // Tail
  pxRect(ctx, 6, -18, 9, 8, '#64748b');
  pxRect(ctx, 7, -21, 2, 3, '#475569'); // Ears
  pxRect(ctx, 11, -21, 2, 3, '#475569');
  pxRect(ctx, 13, -14, 4, 3, '#334155');
  pxRect(ctx, 10, -16, 2, 2, anim === 'staggered' ? PALETTE.gold : PALETTE.crimson);
}

function drawBanditPixels(ctx: CanvasRenderingContext2D, anim: ActorAnimState) {
  pxRect(ctx, -5, -7, 4, 7, '#1e293b');
  pxRect(ctx, 1, -7, 4, 7, '#1e293b');
  pxRect(ctx, -7, -17, 14, 10, '#3f3f46');
  pxRect(ctx, -6, -26, 12, 9, PALETTE.skinShadow);
  pxRect(ctx, -7, -28, 14, 4, '#991b1b'); // Bandana
  pxRect(ctx, 2, -23, 2, 2, PALETTE.white);
  pxRect(ctx, anim === 'attack' ? 8 : 6, -15, 10, 2, '#cbd5e1'); // Dagger
}

function drawGolemOrTreantPixels(
  ctx: CanvasRenderingContext2D,
  isTreant: boolean,
  anim: ActorAnimState
) {
  const main = isTreant ? '#5c3a21' : '#64748b';
  const accent = isTreant ? '#22c55e' : '#4ade80';
  pxRect(ctx, -9, -8, 6, 8, main);
  pxRect(ctx, 3, -8, 6, 8, main);
  pxRect(ctx, -12, -24, 24, 17, main);
  pxRect(ctx, -10, -25, 20, 4, accent); // Moss/leaves
  pxRect(ctx, -7, -32, 14, 9, main);
  pxRect(ctx, -4, -29, 3, 3, anim === 'staggered' ? PALETTE.white : PALETTE.gold);
  pxRect(ctx, 2, -29, 3, 3, anim === 'staggered' ? PALETTE.white : PALETTE.gold);
  // Heavy arms
  pxRect(ctx, -16, -22, 4, 14, main);
  pxRect(ctx, 12, anim === 'attack' ? -24 : -20, 5, 14, main);
}

function drawOrcPixels(
  ctx: CanvasRenderingContext2D,
  sprite: 'orc' | 'orc_shaman' | 'warchief_boss',
  anim: ActorAnimState
) {
  const isBoss = sprite === 'warchief_boss';
  const isShaman = sprite === 'orc_shaman';
  const skin = isBoss ? '#365314' : '#4d7c0f';
  const armor = isShaman ? '#581c87' : isBoss ? '#7f1d1d' : '#57534e';

  pxRect(ctx, -6, -8, 5, 8, '#292524');
  pxRect(ctx, 1, -8, 5, 8, '#292524');
  pxRect(ctx, -9, -21, 18, 13, armor);
  pxRect(ctx, -7, -30, 14, 9, skin);
  pxRect(ctx, -5, -26, 2, 2, PALETTE.crimson);
  pxRect(ctx, 3, -26, 2, 2, PALETTE.crimson);
  pxRect(ctx, -4, -22, 2, 2, PALETTE.white); // Tusks
  pxRect(ctx, 2, -22, 2, 2, PALETTE.white);

  if (isShaman) {
    pxRect(ctx, 9, -28, 2, 24, PALETTE.woodLight);
    pxRect(ctx, 7, -31, 6, 4, PALETTE.violetArcane);
  } else {
    pxRect(ctx, anim === 'attack' ? 10 : 8, -22, 3, 18, '#94a3b8');
    pxRect(ctx, anim === 'attack' ? 11 : 9, -25, 7, 7, '#cbd5e1'); // Axe head
  }
}

function drawDragonFamilyPixels(
  ctx: CanvasRenderingContext2D,
  sprite: 'wyvern' | 'drake_knight' | 'magma' | 'dragon_boss',
  anim: ActorAnimState,
  time: number
) {
  const wingFlap = Math.sin(time * 6) * 3;
  const bodyCol =
    sprite === 'dragon_boss'
      ? '#b91c1c'
      : sprite === 'drake_knight'
      ? '#4338ca'
      : '#334155';
  const bellyCol = sprite === 'dragon_boss' ? '#fbbf24' : '#94a3b8';

  // Wings
  pxRect(ctx, -18, -28 + wingFlap, 10, 14, '#7f1d1d');
  pxRect(ctx, -15, -31 + wingFlap, 6, 4, bodyCol);

  // Tail
  pxRect(ctx, -16, -9, 9, 4, bodyCol);
  // Legs
  pxRect(ctx, -6, -7, 4, 7, bodyCol);
  pxRect(ctx, 3, -7, 4, 7, bodyCol);
  // Torso
  pxRect(ctx, -9, -21, 18, 14, bodyCol);
  pxRect(ctx, -4, -19, 10, 11, bellyCol);
  // Neck & Head
  pxRect(ctx, 2, -29, 12, 10, bodyCol);
  pxRect(ctx, 9, -26, 8, 5, bodyCol);
  pxRect(ctx, 1, -33, 3, 4, PALETTE.gold); // Horns
  pxRect(ctx, 6, -33, 3, 4, PALETTE.gold);
  pxRect(ctx, 9, -28, 2, 2, anim === 'staggered' ? PALETTE.white : PALETTE.gold);

  if (anim === 'attack' && sprite === 'dragon_boss') {
    pxRect(ctx, 17, -26, 8, 4, PALETTE.fireOrange);
    pxRect(ctx, 23, -27, 5, 6, PALETTE.gold);
  }
}

export function drawFireplaceAndShopArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number
) {
  // ---- Cozy Fireplace (Warm Campfire + Stone Hearth) ----
  pxRect(ctx, x - 14, y - 5, 28, 5, PALETTE.stoneDark);
  pxRect(ctx, x - 10, y - 8, 20, 4, PALETTE.woodDark);
  const flicker = Math.sin(time * 12) * 2;
  pxRect(ctx, x - 7, y - 18 + flicker, 14, 11 - flicker, PALETTE.fireRed);
  pxRect(ctx, x - 4, y - 16 - flicker * 0.5, 8, 9, PALETTE.fireOrange);
  pxRect(ctx, x - 2, y - 12, 4, 5, PALETTE.gold);

  // Warm radial glow
  ctx.save();
  ctx.globalAlpha = 0.14 + Math.sin(time * 8) * 0.03;
  ctx.fillStyle = PALETTE.fireOrange;
  ctx.beginPath();
  ctx.arc(x, y - 10, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- Shop & Blacksmith Stall Art right next to Fireplace ----
  const sx = x + 36;
  // Wooden posts
  pxRect(ctx, sx - 16, y - 34, 3, 34, PALETTE.woodMid);
  pxRect(ctx, sx + 14, y - 34, 3, 34, PALETTE.woodMid);
  // Striped awning roof
  for (let i = 0; i < 6; i++) {
    pxRect(
      ctx,
      sx - 18 + i * 6,
      y - 38,
      6,
      6,
      i % 2 === 0 ? PALETTE.fireRed : PALETTE.parchment
    );
  }
  // Shop counter & potions
  pxRect(ctx, sx - 15, y - 13, 31, 13, PALETTE.woodDark);
  pxRect(ctx, sx - 16, y - 14, 33, 3, PALETTE.woodLight);
  // Merchant NPC
  pxRect(ctx, sx - 4, y - 26, 8, 12, '#3b82f6');
  pxRect(ctx, sx - 3, y - 31, 6, 5, PALETTE.skinLight);
  pxRect(ctx, sx - 5, y - 32, 10, 2, PALETTE.gold);
  // Potion bottles on counter
  pxRect(ctx, sx - 12, y - 18, 3, 4, PALETTE.crimson);
  pxRect(ctx, sx + 8, y - 18, 3, 4, PALETTE.cyanMagic);
  // Blacksmith Anvil beside the stall
  const ax = sx + 26;
  pxRect(ctx, ax - 5, y - 6, 10, 6, PALETTE.woodDark);
  pxRect(ctx, ax - 7, y - 11, 14, 5, PALETTE.stoneLight);
  pxRect(ctx, ax - 9, y - 13, 18, 3, '#cbd5e1');
}

export function drawChestSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opened: boolean
) {
  pxRect(ctx, x - 9, y - 12, 18, 12, PALETTE.woodMid);
  pxRect(ctx, x - 9, y - 14, 18, 3, opened ? PALETTE.woodDark : PALETTE.woodLight);
  pxRect(ctx, x - 9, y - 8, 18, 2, PALETTE.gold);
  pxRect(ctx, x - 2, y - 9, 4, 4, PALETTE.gold);
  if (opened) {
    pxRect(ctx, x - 7, y - 14, 14, 3, PALETTE.ink);
  }
}

export function drawGoldSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number
) {
  const bob = Math.sin(time * 5 + x * 0.1) * 2;
  pxRect(ctx, x - 4, y - 10 + bob, 8, 8, PALETTE.gold);
  pxRect(ctx, x - 2, y - 8 + bob, 4, 4, '#fef08a');
}

export function drawMaterialSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  time: number
) {
  const bob = Math.cos(time * 4.5 + x * 0.1) * 2;
  pxRect(ctx, x - 4, y - 10 + bob, 8, 8, PALETTE.slateMid);
  pxRect(ctx, x - 3, y - 9 + bob, 6, 6, color);
}

export function drawPortalSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number
) {
  const pulse = Math.sin(time * 6) * 2;
  pxRect(ctx, x - 12, y - 34, 24, 34, PALETTE.stoneDark);
  pxRect(ctx, x - 8, y - 30, 16, 30, PALETTE.violetArcane);
  pxRect(ctx, x - 5 + pulse * 0.3, y - 26, 10, 24, PALETTE.cyanMagic);
}
