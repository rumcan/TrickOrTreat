/** Keep the opening pace, then compound XP costs so late-game kills don't flood the player with picks. */
export function xpFor(level: number): number {
  const base = 6 + level * 5 + level * level * 0.7;
  return Math.floor(base * Math.pow(1.1, level - 1));
}

/** Incidental bags grant treats about 11% of the time (previously 22%); doorbells remain the reliable source. */
export const BAG_LOOT: readonly (readonly [string, number])[] = [
  ['gun', 39], ['treat', 10], ['upgrade', 14], ['hoard', 14], ['aid', 10], ['costume', 1],
];

export interface RewardRange { min: number; max: number; label: string }
/** Building tiers apply to both treats and guns, including rerolls and bonus drops. */
export function rewardRangeFor(kind: string): RewardRange {
  if (kind === 'boss') return { min: 2, max: 4, label: 'Rare / Epic / Legendary' };
  if (kind === 'house') return { min: 0, max: 2, label: 'Common / Uncommon / Rare' };
  if (['school', 'church', 'barn', 'crypt'].includes(kind)) return { min: 2, max: 4, label: 'Rare / Epic / Legendary' };
  return { min: 2, max: 3, label: 'Rare / Epic' };
}

/**
 * A boss's gun: never below Rare, and Epic or better far more often than anywhere else in town (a doorbell at a
 * major building rolls Epic about 1 time in 10; a boss about 1 in 2 at no luck, before the Epic floor on its first gun).
 */
export function rollBossRarity(luck: number, minRarity = 2): number {
  const w = [0, 0, 40, 42 + luck * 2, 18 + luck * 1.5];
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return Math.max(minRarity, i);
  }
  return 4;
}
