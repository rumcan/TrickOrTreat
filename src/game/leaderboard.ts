import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { createLeaderboardService } from './leaderboard-service';

function timed<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('RUN records are unavailable. Please try again.')), 12000);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
export const leaderboard = createLeaderboardService({
  profile: () => {
    if (RundotGameAPI.isMock()) throw new Error('RUN login is unavailable outside the host.');
    return RundotGameAPI.getProfile();
  },
  page: (mode, cursor) => timed(RundotGameAPI.leaderboard.getPagedScores({ mode, period: 'alltime', limit: 20, cursor })),
  rank: mode => timed(RundotGameAPI.leaderboard.getMyRank({ mode, period: 'alltime' })),
  submit: data => timed(RundotGameAPI.leaderboard.submitScore(data)),
}, !import.meta.env.DEV); // Local debugging must never write to the public boards.
