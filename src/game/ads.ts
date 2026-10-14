// Rewarded ads through RUN (RundotGameAPI.ads). The host shows the ad; the game only asks and reacts.
// On desktop and mobile web RUN has no ads (capabilities.ads is false): the game then offers nothing ad-related.
// Every SDK call can reject, so everything here answers a plain boolean instead.
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

const DEV = (import.meta as unknown as { env: { DEV?: boolean } }).env.DEV === true;
/** development and tests: `window.__totAd = true | false` stands in for the ad (watched to the end, or not) */
const standIn = (): boolean | undefined => (DEV ? (globalThis as { __totAd?: boolean }).__totAd : undefined);

/** can this player be offered a rewarded ad at all? */
export function adsAvailable(): boolean {
  if (standIn() !== undefined) return true;
  try { return !RundotGameAPI.isMock() && RundotGameAPI.system.getEnvironment().capabilities.ads === true; } catch { return false; }
}
/** Show a rewarded ad. True only when the player earned the reward (watched it through). */
export async function watchRewardedAd(name: string): Promise<boolean> {
  const fake = standIn();
  if (fake !== undefined) { await new Promise((done) => setTimeout(done, 300)); return fake; }
  try {
    if (!(await RundotGameAPI.ads.isRewardedAdReadyAsync())) return false;
    return (await RundotGameAPI.ads.showRewardedAdAsync({ adDisplayId: name, adDisplayName: name })) === true;
  } catch { return false; }
}
