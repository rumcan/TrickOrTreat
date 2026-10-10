import type { Elem } from './config';

export type EnemyAffix = 'stormproof' | 'fireproof' | 'ectoproof' | 'ricochet' | 'armored' | 'piercing';
export interface DamageProfile { element?: Elem | null; pierce?: number; ricochet?: boolean }
export const AFFIX_INFO: Record<EnemyAffix, { name: string; color: string }> = {
  stormproof: { name: 'Stormproof', color: '#99dcff' },
  fireproof: { name: 'Fireproof', color: '#ffa975' },
  ectoproof: { name: 'Ectoproof', color: '#bcf5b2' },
  ricochet: { name: 'Ricochet ward', color: '#d9b8ff' },
  armored: { name: 'Armored', color: '#d6d9e2' },
  piercing: { name: 'Piercing 2+ only', color: '#ffd597' },
};
export function specialChance(wave: number) { return wave <= 10 ? 0 : Math.min(0.4, 0.12 + (wave - 11) * 0.02); }
export function rollAffix(wave: number, random = Math.random): EnemyAffix | null {
  if (wave <= 10 || random() >= specialChance(wave)) return null;
  const types = Object.keys(AFFIX_INFO) as EnemyAffix[];
  // Piercing-only shells arrive gradually, after elemental wards have been introduced.
  const count = wave < 13 ? 3 : wave < 15 ? 5 : 6;
  return types[Math.min(count - 1, Math.floor(random() * count))];
}
export function damageDefense(affix: EnemyAffix | null, hit: DamageProfile = {}) {
  if (affix === 'stormproof' && hit.element === 'shock') return { multiplier: 0, reason: 'Lightning immune' };
  if (affix === 'fireproof' && hit.element === 'fire') return { multiplier: 0, reason: 'Fire immune' };
  if (affix === 'ectoproof' && hit.element === 'ecto') return { multiplier: 0, reason: 'Ecto immune' };
  if (affix === 'ricochet' && hit.ricochet) return { multiplier: 0, reason: 'Ricochet blocked' };
  if (affix === 'piercing' && (hit.pierce ?? 0) < 2) return { multiplier: 0, reason: 'Needs piercing 2+' };
  if (affix === 'armored' && (hit.pierce ?? 0) < 1) return { multiplier: 0.2, reason: 'Armor -80%' };
  return { multiplier: 1, reason: '' };
}
/** Monster health per wave: x1.65 a wave to wave 10, then specials keep climbing faster than the ordinary crowd. */
export const WAVE_HP = 1.65;
export function enemyHealthScale(wave: number, fodder = false) {
  if (wave <= 10) return Math.pow(WAVE_HP, wave - 1);
  return Math.pow(WAVE_HP, 9) * (fodder ? 0.18 * Math.pow(1.08, wave - 10) : Math.pow(1.2, wave - 10));
}
