import * as storage from './storage';
export interface Settings {
  /** screen-shake strength 0..1 */
  shake: number;
  /** night brightness 0..1 (0 = the original darkness) */
  bright: number;
  dmgText: boolean;
  lowFx: boolean;
}
const KEY = 'tot_settings_v1';
export const settings: Settings = loadSettings();
export function loadSettings(): Settings {
  try {
    const s = JSON.parse(storage.getItem(KEY) || '');
    const num = (v: unknown, d: number) => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : typeof v === 'boolean' ? (v ? 1 : 0) : d);
    return { shake: num(s.shake, 1), bright: num(s.bright, 0), dmgText: s.dmgText ?? true, lowFx: s.lowFx ?? false };
  } catch {
    return { shake: 1, bright: 0, dmgText: true, lowFx: false };
  }
}
export function saveSettings() {
  storage.setItem(KEY, JSON.stringify(settings));
}
