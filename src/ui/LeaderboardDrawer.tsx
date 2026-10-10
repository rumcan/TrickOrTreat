import { useEffect, useRef, useState } from 'react';
import { Trophy, X, RotateCw, Clock3, ChevronRight } from 'lucide-react';
import { leaderboard } from '../game/leaderboard';
import type { BoardEntry, BoardMode, BoardRank } from '../game/leaderboard-service';
import { fmtTime } from './common';

export function LeaderboardDrawer() {
  const [profile, setProfile] = useState(leaderboard.profile);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BoardMode>('survival');
  const [rows, setRows] = useState<BoardEntry[]>([]);
  const [rank, setRank] = useState<BoardRank | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0), closeRef = useRef<HTMLButtonElement>(null), triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const sync = () => setProfile(leaderboard.profile());
    window.addEventListener('focus', sync);
    const timer = setInterval(sync, 15000);
    return () => { window.removeEventListener('focus', sync); clearInterval(timer); };
  }, []);
  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  const load = async (next?: string) => {
    const ticket = ++generation.current;
    setBusy(true); setError('');
    if (!next) { setRows([]); setRank(null); setCursor(null); }
    try {
      const result = await leaderboard.read(mode, next);
      if (ticket !== generation.current) return;
      setRows(previous => next ? [...previous, ...result.page.entries.filter(row => !previous.some(p => p.profileId === row.profileId))] : result.page.entries);
      setRank(result.rank); setCursor(result.page.nextCursor || null);
    } catch (err) { if (ticket === generation.current) setError(err instanceof Error ? err.message : 'Records unavailable. Please retry.'); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  useEffect(() => {
    if (!profile) { setOpen(false); setRows([]); setRank(null); setCursor(null); }
    if (open && profile) { closeRef.current?.focus(); void load(); }
    return () => { generation.current++; };
  }, [open, mode, profile?.id]);
  useEffect(() => {
    if (!open) return;
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(document.querySelectorAll<HTMLElement>('.records-drawer button:not(:disabled)'));
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [open]);
  if (!profile) return null;
  return <>
    <button ref={triggerRef} className="records-trigger" aria-label="Open time leaderboard" aria-expanded={open} aria-controls="time-records" onClick={() => setOpen(true)}><Trophy size={20} /><span>Night records</span><ChevronRight size={16} /></button>
    {open && <div className="records-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
      <aside id="time-records" className="records-drawer" role="dialog" aria-modal="true" aria-label="Time leaderboard">
        <header><div><div className="paper-kicker">Maple Falls hall of fame</div><h2><Trophy size={28} /> Night records</h2></div><button ref={closeRef} className="records-icon" aria-label="Close leaderboard" onClick={close}><X /></button></header>
        <p className="records-intro">The longest nights. The bravest kids. Your best survival time, ranked against signed-in RUN players.</p>
        <div className="records-tabs" role="group" aria-label="Leaderboard mode">{(['survival', 'rescue'] as const).map(m => <button key={m} aria-pressed={m === mode} onClick={() => setMode(m)}>{m === 'survival' ? 'Neighbourhood' : 'Rescue campaign'}</button>)}</div>
        <div className="records-you"><span>Playing as <strong>{profile.username}</strong></span><span>{rank?.rank ? `#${rank.rank} · ${fmtTime(rank.score || 0)}` : 'Finish a run to set a record'}</span></div>
        <div className="records-list" aria-live="polite" aria-busy={busy}>
          {rows.map(row => <div key={row.profileId} className={`records-row ${row.profileId === profile.id ? 'is-you' : ''}`}><span className="records-rank">{row.rank ? `#${row.rank}` : '—'}</span><strong title={row.username}>{row.username}{row.profileId === profile.id && <small>YOU</small>}</strong><span className="records-time"><Clock3 size={14} />{fmtTime(row.score)}</span></div>)}
          {busy && <p role="status">Fetching night records…</p>}
          {!busy && !error && !rows.length && <p>No records yet. Be the first to survive the night.</p>}
          {error && <p role="alert">{error}</p>}
        </div>
        <footer><button className="hm-btn ghost" disabled={busy} onClick={() => void load()}><RotateCw size={16} /> Refresh</button>{cursor && <button className="hm-btn" disabled={busy} onClick={() => void load(cursor)}>More records</button>}<small>All time · longest first · one best time per player<br />Runs shorter than 10s and local previews are not ranked.</small></footer>
      </aside>
    </div>}
  </>;
}
