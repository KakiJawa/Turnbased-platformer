import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './canvasRenderer';
import { PALETTE } from './palette';
import { EnemyRarity, WorldEntity } from './types';

export type EncounterPhase = 'idle' | 'closing' | 'opening';

export interface EncounterTransitionState {
  active: boolean;
  phase: EncounterPhase;
  entity: WorldEntity | null;
  rarity: EnemyRarity;
  elapsed: number;
  duration: number;
  screenX: number;
  screenY: number;
}

export const NORMAL_CLOSE_DURATION = 0.62;
export const NORMAL_OPEN_DURATION = 0.26;
export const BOSS_CLOSE_DURATION = 1.05;
export const BOSS_OPEN_DURATION = 0.36;

export function createEncounterTransition(): EncounterTransitionState {
  return {
    active: false,
    phase: 'idle',
    entity: null,
    rarity: 'normal',
    elapsed: 0,
    duration: NORMAL_CLOSE_DURATION,
    screenX: INTERNAL_WIDTH / 2,
    screenY: INTERNAL_HEIGHT / 2,
  };
}

export function startEncounterTransition(
  entity: WorldEntity,
  cameraX: number
): EncounterTransitionState {
  const rarity: EnemyRarity = entity.enemyRarity ?? 'normal';
  const duration = rarity === 'boss' ? BOSS_CLOSE_DURATION : NORMAL_CLOSE_DURATION;
  const screenX = Math.max(
    24,
    Math.min(INTERNAL_WIDTH - 24, Math.round(entity.x - cameraX))
  );
  const screenY = Math.max(
    32,
    Math.min(INTERNAL_HEIGHT - 24, Math.round(entity.y - 16))
  );

  return {
    active: true,
    phase: 'closing',
    entity,
    rarity,
    elapsed: 0,
    duration,
    screenX,
    screenY,
  };
}

export function stepEncounterTransition(
  state: EncounterTransitionState,
  dt: number
): {
  state: EncounterTransitionState;
  readyToEnterBattle: WorldEntity | null;
} {
  if (!state.active || state.phase === 'idle') {
    return { state, readyToEnterBattle: null };
  }

  const safeDt = Math.min(Math.max(0, dt), 0.05);
  const nextElapsed = state.elapsed + safeDt;

  if (state.phase === 'closing' && nextElapsed >= state.duration) {
    const openDuration =
      state.rarity === 'boss' ? BOSS_OPEN_DURATION : NORMAL_OPEN_DURATION;
    return {
      state: {
        ...state,
        phase: 'opening',
        elapsed: 0,
        duration: openDuration,
      },
      readyToEnterBattle: state.entity,
    };
  }

  if (state.phase === 'opening' && nextElapsed >= state.duration) {
    return {
      state: createEncounterTransition(),
      readyToEnterBattle: null,
    };
  }

  return {
    state: {
      ...state,
      elapsed: nextElapsed,
    },
    readyToEnterBattle: null,
  };
}

function drawBossBanner(
  ctx: CanvasRenderingContext2D,
  bossName: string,
  progress: number
) {
  // Appears cleanly during boss closing sequence
  if (progress < 0.22) return;
  const bannerAlpha = Math.min(1, (progress - 0.22) / 0.16);
  const cy = Math.round(INTERNAL_HEIGHT / 2);

  ctx.save();
  ctx.globalAlpha = bannerAlpha;

  // Center crimson & obsidian bar
  const barH = 54;
  ctx.fillStyle = '#0e0b16';
  ctx.fillRect(0, cy - Math.round(barH / 2), INTERNAL_WIDTH, barH);
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(0, cy - Math.round(barH / 2) + 3, INTERNAL_WIDTH, barH - 6);
  ctx.fillStyle = '#1b0b14';
  ctx.fillRect(0, cy - Math.round(barH / 2) + 6, INTERNAL_WIDTH, barH - 12);

  // Gold & crimson pixel borders
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(0, cy - Math.round(barH / 2) + 2, INTERNAL_WIDTH, 2);
  ctx.fillRect(0, cy + Math.round(barH / 2) - 4, INTERNAL_WIDTH, 2);

  // Pulsing pixel caution chevrons on left & right
  const blink = Math.floor(progress * 24) % 2 === 0;
  ctx.fillStyle = blink ? PALETTE.gold : PALETTE.fireRed;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(18 + i * 12, cy - 4, 6, 8);
    ctx.fillRect(INTERNAL_WIDTH - 66 + i * 12, cy - 4, 6, 8);
  }

  // Sub-label
  ctx.font = 'bold 8px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fca5a5';
  ctx.fillText('WARNING // BOSS ENCOUNTER', INTERNAL_WIDTH / 2, cy - 9);

  // Boss Name
  ctx.font = 'bold 16px "Silkscreen", monospace';
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(bossName.toUpperCase(), INTERNAL_WIDTH / 2 + 2, cy + 13);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(bossName.toUpperCase(), INTERNAL_WIDTH / 2, cy + 11);

  ctx.restore();
}

export function renderEncounterTransition(
  ctx: CanvasRenderingContext2D,
  state: EncounterTransitionState
) {
  if (!state.active || state.phase === 'idle') return;

  const t = Math.max(0, Math.min(1, state.elapsed / Math.max(0.001, state.duration)));
  const isBoss = state.rarity === 'boss';
  const isElite = state.rarity === 'elite';

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (state.phase === 'closing') {
    if (isBoss) {
      // 1) Crimson sky eclipse & impact strobe (0..0.40)
      if (t < 0.4) {
        const strobe = Math.floor(t * 28) % 2 === 0;
        ctx.fillStyle = strobe
          ? 'rgba(220, 38, 38, 0.38)'
          : 'rgba(14, 11, 22, 0.55)';
        ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

        // Stepped pixel lightning fork toward boss
        ctx.fillStyle = strobe ? '#fef08a' : '#f87171';
        let lx = state.screenX;
        for (let seg = 0; seg < 10; seg++) {
          const ly = seg * Math.round(state.screenY / 10);
          const jitter = ((seg % 2 === 0 ? 1 : -1) * (10 - seg)) + (strobe ? 3 : -3);
          ctx.fillRect(Math.round(lx + jitter), ly, 3, Math.round(state.screenY / 10) + 2);
        }
      }

      // 2) Converging dark-crimson pixel speed rays around boss
      const rayProg = Math.min(1, t / 0.55);
      const rayOuter = 280 - rayProg * 210;
      ctx.fillStyle = '#f87171';
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + t * 2.2;
        for (let step = 0; step < 5; step++) {
          const r = rayOuter + step * 9;
          const px = Math.round(state.screenX + Math.cos(ang) * r);
          const py = Math.round(state.screenY + Math.sin(ang) * r);
          ctx.fillRect(px - 1, py - 1, 3, 3);
        }
      }

      // 3) Stepped Pixel Shatter-Iris + Heavy Horizontal Crimson Curtains
      const wipe = Math.max(0, Math.min(1, (t - 0.12) / 0.78));
      const eased = wipe * wipe * (3 - 2 * wipe);

      // Top & bottom boss curtains slamming inward
      const curtainH = Math.round((INTERNAL_HEIGHT / 2 + 6) * eased);
      ctx.fillStyle = '#0e0b16';
      ctx.fillRect(0, 0, INTERNAL_WIDTH, curtainH);
      ctx.fillRect(0, INTERNAL_HEIGHT - curtainH, INTERNAL_WIDTH, curtainH);

      // Glowing crimson/gold jagged trim on curtains
      if (curtainH > 3 && curtainH < INTERNAL_HEIGHT / 2) {
        for (let bx = 0; bx < INTERNAL_WIDTH; bx += 12) {
          const tooth = (bx / 12) % 2 === 0 ? 4 : 0;
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(bx, curtainH - 3 + tooth, 10, 3);
          ctx.fillRect(bx, INTERNAL_HEIGHT - curtainH - tooth, 10, 3);
        }
      }

      // Stepped pixel diamond iris closing around boss
      const irisRadius = Math.round((1 - eased) * 290);
      if (irisRadius < 270) {
        const block = 10;
        ctx.fillStyle = '#0e0b16';
        for (let gy = 0; gy < INTERNAL_HEIGHT; gy += block) {
          for (let gx = 0; gx < INTERNAL_WIDTH; gx += block) {
            const dx = Math.abs(gx + block / 2 - state.screenX);
            const dy = Math.abs(gy + block / 2 - state.screenY) * 1.35;
            if (dx + dy > irisRadius) {
              ctx.fillRect(gx, gy, block, block);
            }
          }
        }
      }

      drawBossBanner(
        ctx,
        state.entity?.enemyName ?? 'Stage Boss',
        t
      );
    } else {
      // NORMAL / ELITE ENCOUNTER: Flash + Speed Lines + Interlocking Pixel Blade Shutters
      const accent = isElite ? '#fb923c' : PALETTE.gold;

      // 1) Crisp JRPG impact flash (0..0.24)
      if (t < 0.24) {
        const flashOn = Math.floor(t * 25) % 2 === 0;
        ctx.fillStyle = flashOn
          ? isElite
            ? 'rgba(251, 146, 60, 0.34)'
            : 'rgba(255, 250, 220, 0.36)'
          : 'rgba(14, 11, 22, 0.22)';
        ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

        // Stepped radial burst lines from enemy
        ctx.fillStyle = accent;
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + 0.2;
          const dist = 16 + t * 140;
          const px = Math.round(state.screenX + Math.cos(ang) * dist);
          const py = Math.round(state.screenY + Math.sin(ang) * dist);
          ctx.fillRect(px - 2, py - 2, 4, 4);
        }
      }

      // 2) "! ENCOUNTER !" or "!! ELITE AMBUSH !!" pixel badge over target
      if (t < 0.72) {
        const popScale = t < 0.15 ? 0.75 + (t / 0.15) * 0.25 : 1;
        const bx = Math.round(
          Math.max(76, Math.min(INTERNAL_WIDTH - 76, state.screenX))
        );
        const by = Math.round(Math.max(44, state.screenY - 34));
        const bw = Math.round((isElite ? 128 : 104) * popScale);
        const bh = 18;
        ctx.fillStyle = '#0e0b16';
        ctx.fillRect(bx - Math.round(bw / 2), by - 10, bw, bh);
        ctx.fillStyle = accent;
        ctx.fillRect(bx - Math.round(bw / 2), by - 10, bw, 2);
        ctx.fillRect(bx - Math.round(bw / 2), by + 6, bw, 2);
        ctx.font = 'bold 9px "Silkscreen", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = accent;
        ctx.fillText(isElite ? '!! ELITE !!' : '! ENCOUNTER !', bx, by + 2);
      }

      // 3) 18-strip Interlocking Pixel Blade Shutters + static leading edge (0.14..1.0)
      const wipe = Math.max(0, Math.min(1, (t - 0.14) / 0.86));
      const eased = wipe * wipe * (3 - 2 * wipe);
      const bandH = 15; // 18 * 15 = 270
      const bands = Math.ceil(INTERNAL_HEIGHT / bandH);

      for (let b = 0; b < bands; b++) {
        const y = b * bandH;
        const stagger = ((b % 3) * 0.06);
        const localWipe = Math.max(0, Math.min(1, (eased - stagger) / 0.88));
        const w = Math.round((INTERNAL_WIDTH + 16) * localWipe);
        if (w <= 0) continue;

        const fromLeft = b % 2 === 0;
        const x = fromLeft ? 0 : INTERNAL_WIDTH - w;

        ctx.fillStyle = '#0e0b16';
        ctx.fillRect(x, y, w, bandH);

        // Razor gold/orange blade tip & static pixel speckles
        if (localWipe < 0.99) {
          const tipX = fromLeft ? x + w - 4 : x;
          ctx.fillStyle = accent;
          ctx.fillRect(tipX, y, 4, bandH);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(tipX + (fromLeft ? -3 : 4), y + ((b * 5) % 10), 2, 3);
        }
      }
    }
  } else {
    // OPENING PHASE: Snap shutters rapidly outward to reveal Battle Scene
    const open = 1 - t;
    const eased = open * open;

    if (isBoss) {
      const curtainH = Math.round((INTERNAL_HEIGHT / 2 + 4) * eased);
      ctx.fillStyle = '#0e0b16';
      ctx.fillRect(0, 0, INTERNAL_WIDTH, curtainH);
      ctx.fillRect(0, INTERNAL_HEIGHT - curtainH, INTERNAL_WIDTH, curtainH);
      if (curtainH > 2) {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, curtainH - 2, INTERNAL_WIDTH, 2);
        ctx.fillRect(0, INTERNAL_HEIGHT - curtainH, INTERNAL_WIDTH, 2);
      }
    } else {
      const halfW = Math.round((INTERNAL_WIDTH / 2 + 8) * eased);
      ctx.fillStyle = '#0e0b16';
      ctx.fillRect(0, 0, halfW, INTERNAL_HEIGHT);
      ctx.fillRect(INTERNAL_WIDTH - halfW, 0, halfW, INTERNAL_HEIGHT);
      if (halfW > 4) {
        ctx.fillStyle = isElite ? '#fb923c' : PALETTE.gold;
        ctx.fillRect(halfW - 3, 0, 3, INTERNAL_HEIGHT);
        ctx.fillRect(INTERNAL_WIDTH - halfW, 0, 3, INTERNAL_HEIGHT);
      }
    }
  }

  ctx.restore();
}
