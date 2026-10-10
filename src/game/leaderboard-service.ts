// Players who are not signed in to RUN appear on the Night Records as "Guest_ABC": the word Guest plus three letters
// they pick themselves. Three capital letters cannot carry a name, a link or a sentence, and the few rude
// three-letter spellings are refused, so no free-text moderation is needed.
const BLOCKED = new Set([
  'ASS', 'AZZ', 'ARS', 'ANL', 'ANU', 'BUM', 'BJS', 'CUM', 'CUN', 'CNT', 'KNT', 'COK', 'COC', 'COX', 'KOK', 'CLT', 'DIK', 'DIC', 'DCK', 'DIX', 'DYK',
  'FAG', 'FGT', 'FUK', 'FUC', 'FCK', 'FUX', 'FUQ', 'FKU', 'FAP', 'GAY', 'HOE', 'HOR', 'JEW', 'JIZ', 'JAP', 'KKK', 'KYS', 'KUM', 'LSD', 'NIG', 'NGR', 'NGA', 'NAZ',
  'PEE', 'PIS', 'POO', 'PUS', 'PMS', 'RAP', 'SEX', 'SXY', 'SHT', 'SUK', 'SUC', 'SOB', 'STD', 'TIT', 'TTS', 'VAG', 'VAJ', 'WOP', 'WTF', 'XXX', 'HIV', 'KIL', 'DIE',
]);
/** Three capital letters A-Z, or null when the input is not exactly that or spells something rude. */
export function cleanGuestTag(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const tag = input.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(tag) && !BLOCKED.has(tag) ? tag : null;
}
export function randomGuestTag(random: () => number = Math.random): string {
  for (;;) {
    const tag = Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.min(25, Math.floor(random() * 26)))).join('');
    if (cleanGuestTag(tag)) return tag;
  }
}
export const guestName = (tag: string) => `Guest_${tag}`;

export type BoardMode = 'survival' | 'rescue';
/** `guest`: not signed in to RUN; `username` is then "Guest_" plus their three letters */
export interface BoardProfile { id: string; username: string; isAnonymous?: boolean; guest?: boolean }
export interface BoardEntry { profileId: string; username: string; score: number; rank: number | null; isSeed?: boolean; metadata?: Record<string, unknown> | null }
export interface BoardPage { entries: BoardEntry[]; nextCursor?: string | null; totalEntries: number; playerRank?: number | null }
export interface BoardRank { rank: number | null; score?: number; totalPlayers: number }
export interface RunRecord { profileId: string; lastAttempt: number }
interface BoardPort {
  profile: () => BoardProfile;
  /** the three letters this device's guest chose (see guest-tag.ts) */
  guestTag: () => string;
  page: (mode: BoardMode, cursor?: string) => Promise<BoardPage>;
  rank: (mode: BoardMode) => Promise<BoardRank>;
  submit: (data: { score: number; duration: number; mode: BoardMode; period: string; metadata: Record<string, number | string | boolean> }) => Promise<{ accepted: boolean; rank?: number | null; reason?: string | null }>;
}

export function createLeaderboardService(port: BoardPort, allowSubmission = true) {
  const profile = () => {
    try {
      const p = port.profile();
      // 'unknown-user' is the placeholder a local Playground hands out before any session exists
      if (!p?.id || p.id === 'unknown-user') return null;
      if (p.isAnonymous === true) {
        // not signed in: a real RUN guest session. They rank as Guest_ plus their own three letters.
        const tag = cleanGuestTag(port.guestTag());
        return tag ? { id: p.id, username: guestName(tag), isAnonymous: true, guest: true } : null;
      }
      return p.username ? p : null;
    } catch { return null; }
  };
  const requireProfile = () => { const p = profile(); if (!p) throw new Error('Night records are unavailable right now.'); return p; };
  /** what a row shows: guests by their three letters, never by a host-assigned or free-text name */
  const shown = (entry: BoardEntry, me: BoardProfile): BoardEntry => {
    if (me.guest && entry.profileId === me.id) return { ...entry, username: me.username };
    if (!entry.metadata || !('guestTag' in entry.metadata)) return entry;
    const tag = cleanGuestTag(entry.metadata.guestTag);
    return { ...entry, username: tag ? guestName(tag) : 'Guest' };
  };
  return {
    profile,
    beginRun(): RunRecord | null { const p = profile(); return p && allowSubmission ? { profileId: p.id, lastAttempt: -1 } : null; },
    async read(mode: BoardMode, cursor?: string) {
      const p = requireProfile();
      const [page, rank] = await Promise.all([port.page(mode, cursor), port.rank(mode)]);
      if (profile()?.id !== p.id) throw new Error('Your RUN session changed. Please reopen the records.');
      return { page: { ...page, entries: page.entries.filter(e => !e.isSeed && Number.isFinite(e.score) && e.score >= 10).map(e => shown(e, p)) }, rank };
    },
    async finish(run: RunRecord | null, mode: BoardMode, time: number, metadata: Record<string, number | string | boolean>, practice = false) {
      const p = profile();
      if (!run || !p || p.id !== run.profileId || practice || !allowSubmission) return '';
      const seconds = Math.floor(time);
      if (!Number.isFinite(seconds) || seconds < 10 || seconds > 86400 || seconds <= run.lastAttempt) return '';
      run.lastAttempt = seconds; // Guard duplicate victory/death callbacks, including in-flight submissions.
      try {
        const result = await port.submit({ score: seconds, duration: seconds, mode, period: 'alltime', metadata: p.guest ? { ...metadata, guestTag: p.username.slice(-3) } : metadata });
        if (profile()?.id !== p.id) return '';
        if (!result.accepted) return 'RUN kept your previous record, or could not accept this run.';
        return result.rank ? `Time recorded on RUN · rank #${result.rank}` : 'Time recorded on RUN';
      } catch { return 'Could not upload your time. Your local record is safe.'; }
    },
  };
}
