export interface Settings {
  shake: boolean;
  dmgText: boolean;
  lowFx: boolean;
}
const KEY = 'tot_settings_v1';
export const settings: Settings = loadSettings();
export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '');
    return { shake: s.shake ?? true, dmgText: s.dmgText ?? true, lowFx: s.lowFx ?? false };
  } catch {
    return { shake: true, dmgText: true, lowFx: false };
  }
}
export function saveSettings() {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
