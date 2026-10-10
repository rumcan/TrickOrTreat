export type BoardMode = 'survival' | 'rescue';
export interface BoardProfile { id: string; username: string; isAnonymous?: boolean }
export interface BoardEntry { profileId: string; username: string; score: number; rank: number | null; isSeed?: boolean }
export interface BoardPage { entries: BoardEntry[]; nextCursor?: string | null; totalEntries: number; playerRank?: number | null }
export interface BoardRank { rank: number | null; score?: number; totalPlayers: number }
export interface RunRecord { profileId: string; lastAttempt: number }
interface BoardPort {
  profile: () => BoardProfile;
  page: (mode: BoardMode, cursor?: string) => Promise<BoardPage>;
  rank: (mode: BoardMode) => Promise<BoardRank>;
  submit: (data: { score: number; duration: number; mode: BoardMode; period: string; metadata: Record<string, number | string | boolean> }) => Promise<{ accepted: boolean; rank?: number | null; reason?: string | null }>;
}

export function createLeaderboardService(port: BoardPort, allowSubmission = true) {
  const profile = () => {
    try {
      const p = port.profile();
      return p?.id && p.username && p.id !== 'unknown-user' && p.isAnonymous !== true ? p : null;
    } catch { return null; }
  };
  const requireProfile = () => { const p = profile(); if (!p) throw new Error('Sign in to RUN to view records.'); return p; };
  return {
    profile,
    beginRun(): RunRecord | null { const p = profile(); return p && allowSubmission ? { profileId: p.id, lastAttempt: -1 } : null; },
    async read(mode: BoardMode, cursor?: string) {
      const p = requireProfile();
      const [page, rank] = await Promise.all([port.page(mode, cursor), port.rank(mode)]);
      if (profile()?.id !== p.id) throw new Error('Your RUN session changed. Please reopen the records.');
      return { page: { ...page, entries: page.entries.filter(e => !e.isSeed && Number.isFinite(e.score) && e.score >= 10) }, rank };
    },
    async finish(run: RunRecord | null, mode: BoardMode, time: number, metadata: Record<string, number | string | boolean>, practice = false) {
      const p = profile();
      if (!run || !p || p.id !== run.profileId || practice || !allowSubmission) return '';
      const seconds = Math.floor(time);
      if (!Number.isFinite(seconds) || seconds < 10 || seconds > 86400 || seconds <= run.lastAttempt) return '';
      run.lastAttempt = seconds; // Guard duplicate victory/death callbacks, including in-flight submissions.
      try {
        const result = await port.submit({ score: seconds, duration: seconds, mode, period: 'alltime', metadata });
        if (profile()?.id !== p.id) return '';
        if (!result.accepted) return 'RUN kept your previous record, or could not accept this run.';
        return result.rank ? `Time recorded on RUN · rank #${result.rank}` : 'Time recorded on RUN';
      } catch { return 'Could not upload your time. Your local record is safe.'; }
    },
  };
}
