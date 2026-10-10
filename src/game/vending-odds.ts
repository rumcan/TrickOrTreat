export const VENDING_RARITY_ODDS = [50, 30, 15, 4, 1] as const;
export const VENDING_TREAT_SHARE = .75;
export function vendingCost(plays: number) {
  const count = Number.isFinite(plays) ? Math.max(0, Math.floor(plays)) : 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.round(60 * Math.pow(1.30, count)));
}
export function weightedPick<T extends { weight: number }>(pool: T[], random = Math.random): T | null {
  const available = pool.filter(item => Number.isFinite(item.weight) && item.weight > 0);
  const total = available.reduce((sum, item) => sum + item.weight, 0);
  if (!available.length) return null;
  let roll = Math.max(0, Math.min(1 - Number.EPSILON, random())) * total;
  for (const item of available) { roll -= item.weight; if (roll < 0) return item; }
  return available.at(-1)!;
}
