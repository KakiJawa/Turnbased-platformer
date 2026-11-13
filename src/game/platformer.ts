import { StageDefinition, WorldEntity } from './types';

export interface PlatformerPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  onGround: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  walkCycle: number;
  scaleX: number;
  scaleY: number;
  cameraX: number;
}

export interface PlatformerStepResult {
  collectedGold: number;
  collectedMaterial: { id: NonNullable<WorldEntity['materialId']>; amount: number } | null;
  jumped: boolean;
  nearbyInteractable: WorldEntity | null;
  triggeredEnemy: WorldEntity | null;
}

export function createPlatformerPlayer(): PlatformerPlayer {
  return {
    x: 68,
    y: 228,
    vx: 0,
    vy: 0,
    w: 14,
    h: 26,
    facing: 1,
    onGround: true,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    walkCycle: 0,
    scaleX: 1,
    scaleY: 1,
    cameraX: 0,
  };
}

export interface PlatformerInput {
  left: boolean;
  right: boolean;
  jumpJustPressed: boolean;
  jumpHeld: boolean;
}

const MOVE_SPEED = 118;
const GRAVITY = 560;
const JUMP_VELOCITY = -288;

export function stepPlatformer(
  player: PlatformerPlayer,
  stage: StageDefinition,
  input: PlatformerInput,
  dt: number
): PlatformerStepResult {
  let collectedGold = 0;
  let collectedMaterial: PlatformerStepResult['collectedMaterial'] = null;
  let jumped = false;

  // Horizontal movement
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    player.vx = dir * MOVE_SPEED;
    player.facing = dir > 0 ? 1 : -1;
    if (player.onGround) {
      player.walkCycle += Math.abs(player.vx) * dt;
    }
  } else {
    player.vx *= Math.pow(0.001, dt);
    if (Math.abs(player.vx) < 4) player.vx = 0;
  }

  // Coyote time & jump buffering
  if (player.onGround) {
    player.coyoteTimer = 0.1;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  if (input.jumpJustPressed) {
    player.jumpBufferTimer = 0.12;
  } else {
    player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
  }

  if (player.jumpBufferTimer > 0 && player.coyoteTimer > 0) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
    player.scaleX = 0.84;
    player.scaleY = 1.18;
    jumped = true;
  }

  // Variable jump height cut
  if (!input.jumpHeld && player.vy < -85) {
    player.vy *= 0.65;
  }

  // Gravity
  player.vy = Math.min(340, player.vy + GRAVITY * dt);

  // Horizontal integration
  player.x += player.vx * dt;
  player.x = Math.max(16, Math.min(stage.width - 16, player.x));

  // Vertical integration & one-way / ground platform landing
  const prevY = player.y;
  player.y += player.vy * dt;
  const wasOnGround = player.onGround;
  player.onGround = false;

  for (const plat of stage.platforms) {
    const withinX =
      player.x + player.w * 0.45 > plat.x &&
      player.x - player.w * 0.45 < plat.x + plat.w;
    if (!withinX) continue;

    if (player.vy >= 0 && prevY <= plat.y + 4 && player.y >= plat.y) {
      player.y = plat.y;
      player.vy = 0;
      player.onGround = true;
      if (!wasOnGround) {
        player.scaleX = 1.2;
        player.scaleY = 0.8;
      }
      break;
    }
  }

  // Smooth squash & stretch recovery
  player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 14);
  player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 14);

  // Patrol enemies & check pickups / encounters
  let nearbyInteractable: WorldEntity | null = null;
  let triggeredEnemy: WorldEntity | null = null;

  for (const ent of stage.entities) {
    if (ent.kind === 'enemy' && !ent.defeated) {
      if (ent.vx && ent.patrolMinX !== undefined && ent.patrolMaxX !== undefined) {
        ent.x += ent.vx * dt;
        if (ent.x <= ent.patrolMinX) {
          ent.x = ent.patrolMinX;
          ent.vx = Math.abs(ent.vx);
          ent.facing = 1;
        } else if (ent.x >= ent.patrolMaxX) {
          ent.x = ent.patrolMaxX;
          ent.vx = -Math.abs(ent.vx);
          ent.facing = -1;
        }
      }
    }

    const dx = Math.abs(player.x - ent.x);
    const dy = Math.abs(player.y - ent.y);

    if (ent.kind === 'gold' && !ent.collected && dx < 16 && dy < 22) {
      ent.collected = true;
      collectedGold += ent.amount ?? 10;
    } else if (ent.kind === 'material' && !ent.collected && dx < 16 && dy < 22) {
      ent.collected = true;
      if (ent.materialId) {
        collectedMaterial = { id: ent.materialId, amount: ent.amount ?? 1 };
      }
    } else if (ent.kind === 'enemy' && !ent.defeated && dx < 20 && dy < 28) {
      triggeredEnemy = ent;
    } else if (
      (ent.kind === 'fireplace' ||
        ent.kind === 'shop' ||
        (ent.kind === 'chest' && !ent.opened) ||
        ent.kind === 'portal') &&
      dx < 30 &&
      dy < 32
    ) {
      nearbyInteractable = ent;
    }
  }

  // Smooth camera clamping inside 480x270 viewport
  const targetCam = Math.max(0, Math.min(stage.width - 480, player.x - 190));
  player.cameraX += (targetCam - player.cameraX) * Math.min(1, dt * 8);

  return {
    collectedGold,
    collectedMaterial,
    jumped,
    nearbyInteractable,
    triggeredEnemy,
  };
}
