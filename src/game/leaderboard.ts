import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { createLeaderboardService, cleanGuestTag, randomGuestTag } from './leaderboard-service';
import * as storage from './storage';

function timed<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('RUN records are unavailable. Please try again.')), 12000);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
const GUEST_TAG_KEY = 'tot_guest_tag_v1';
/** This device's guest letters: picked at random the first time, then whatever the player chose. */
export function guestTag(): string {
  const saved = cleanGuestTag(storage.getItem(GUEST_TAG_KEY));
  if (saved) return saved;
  const tag = randomGuestTag();
  storage.setItem(GUEST_TAG_KEY, tag);
  return tag;
}
/** Save new guest letters. False when they are not three letters A-Z or spell something that is not allowed. */
export function setGuestTag(input: string): boolean {
  const tag = cleanGuestTag(input);
  if (tag) storage.setItem(GUEST_TAG_KEY, tag);
  return !!tag;
}
export const leaderboard = createLeaderboardService({
  guestTag,
  profile: () => {
    if (RundotGameAPI.isMock()) throw new Error('RUN login is unavailable outside the host.');
    return RundotGameAPI.getProfile();
  },
  page: (mode, cursor) => timed(RundotGameAPI.leaderboard.getPagedScores({ mode, period: 'alltime', limit: 20, cursor })),
  rank: mode => timed(RundotGameAPI.leaderboard.getMyRank({ mode, period: 'alltime' })),
  submit: data => timed(RundotGameAPI.leaderboard.submitScore(data)),
}, !import.meta.env.DEV); // Local debugging must never write to the public boards.
