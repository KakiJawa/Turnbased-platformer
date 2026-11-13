import { PlayerState } from './types';

export const SAVE_STORAGE_KEY = 'villagers_trial_save_v1';

export interface SavedRunData {
  version: 1;
  savedAt: number;
  player: PlayerState;
  zone: number;
  playerX: number;
  defeatedEntityIds: string[];
  openedChestIds: string[];
  collectedPickupIds: string[];
}

export function saveRunState(data: SavedRunData): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadRunState(): SavedRunData | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedRunData;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.player ||
      typeof parsed.zone !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearRunState(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignore storage quota / security errors
  }
}

export function getSavedRunSummary(): {
  className: string;
  level: number;
  zone: number;
  gold: number;
} | null {
  const saved = loadRunState();
  if (!saved) return null;
  return {
    className: saved.player.className,
    level: saved.player.level,
    zone: saved.zone,
    gold: saved.player.gold,
  };
}
