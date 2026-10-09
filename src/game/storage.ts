// RUN.world sandboxes H5 games, so `localStorage` throws there. Saves go through the SDK's device cache instead.
// It is async, so the known keys are read once at boot (see main.tsx) and served synchronously from memory; writes
// update memory immediately and persist in the background.
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

export const STORAGE_KEYS = ['tot_survivors_save_v1', 'tot_settings_v1'] as const;

const cache = new Map<string, string>();

export async function preloadStorage(): Promise<void> {
  await Promise.all(STORAGE_KEYS.map(async (key) => {
    try {
      const value = await RundotGameAPI.deviceCache.getItem(key);
      if (value !== null && value !== undefined) cache.set(key, value);
    } catch { /* storage unavailable: start fresh */ }
  }));
}

export function getItem(key: string): string | null {
  return cache.get(key) ?? null;
}

export function setItem(key: string, value: string): void {
  cache.set(key, value);
  Promise.resolve().then(() => RundotGameAPI.deviceCache.setItem(key, value)).catch(() => { /* storage unavailable */ });
}

export function clearAll(): Promise<unknown> {
  return Promise.all(STORAGE_KEYS.map((key) => {
    cache.delete(key);
    return Promise.resolve().then(() => RundotGameAPI.deviceCache.removeItem(key)).catch(() => { /* storage unavailable */ });
  }));
}
