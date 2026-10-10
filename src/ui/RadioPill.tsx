// The radio pill (ported from HexMatch's MUSIC-1 widget): ‹ station ›, play/pause, what is playing, skip, and a volume
// slider. It sits in the top bar of each screen. On a phone it is just the play key; a long press shows the line.
// Its popups (volume, the phone's now-playing line) open toward whichever side of the screen has room.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight, Music2, Pause, Play, SkipForward, Volume2 } from 'lucide-react';
import { radio } from '../game/sound/radio';
import '../radio.css';

export default function RadioPill({ compact = false }: { compact?: boolean }) {
  const view = useSyncExternalStore((fn) => radio.subscribe(fn), () => radio.snapshot(), () => radio.snapshot());
  const [vol, setVol] = useState(false);
  const [peek, setPeek] = useState(false);
  const [place, setPlace] = useState<{ up: boolean; left: boolean }>({ up: false, left: false });
  const root = useRef<HTMLDivElement>(null);
  const hold = useRef<number | null>(null);
  /** open up when the pill sits in the lower half of the screen, and anchor to the screen edge it is nearest */
  const measure = () => {
    const r = root.current?.getBoundingClientRect();
    if (r) setPlace({ up: r.top + r.height / 2 > window.innerHeight / 2, left: r.left + r.width / 2 < window.innerWidth / 2 });
  };
  useEffect(() => {
    if (!vol) return;
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setVol(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setVol(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc); };
  }, [vol]);
  const held = useRef(false);
  useEffect(() => () => { if (hold.current !== null) window.clearTimeout(hold.current); }, []);
  const { settings, playing, text, station } = view;
  const label = !settings.enabled ? 'Turn the radio on' : `Turn the radio off (${station.name})`;
  return (
    <div ref={root} className={`radio-pill ${compact ? 'compact' : ''}`} data-drop={place.up ? 'up' : 'down'} data-align={place.left ? 'left' : 'right'} data-on={settings.enabled ? '1' : '0'} data-playing={playing ? '1' : '0'} data-peek={peek ? '1' : '0'} role="group" aria-label="Radio" title={`${station.name}: ${station.genre}. Maple Falls after-dark radio.`} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setVol(false); e.stopPropagation(); }}>
      <button type="button" className="radio-step" aria-label="Previous station" data-sound="none" onClick={() => radio.stepStation(-1)} disabled={!settings.enabled}><ChevronLeft size={14} /></button>
      <button
        type="button"
        className="radio-play"
        aria-pressed={settings.enabled}
        aria-label={label}
        title={label}
        data-sound="none"
        onPointerDown={() => {
          held.current = false;
          hold.current = window.setTimeout(() => { held.current = true; measure(); setPeek(true); window.setTimeout(() => setPeek(false), 1800); }, 450);
        }}
        onPointerUp={() => { if (hold.current !== null) window.clearTimeout(hold.current); }}
        onPointerLeave={() => { if (hold.current !== null) window.clearTimeout(hold.current); }}
        onClick={() => { if (!held.current) radio.toggle(); held.current = false; }}
      >
        {settings.enabled ? <Pause size={14} /> : <Play size={14} />}
        <Music2 size={12} className="radio-note" aria-hidden="true" />
      </button>
      <span className="radio-now" aria-live="polite"><span className="radio-now-text">{text}</span></span>
      <button type="button" className="radio-step" aria-label="Next station" data-sound="none" onClick={() => radio.stepStation(1)} disabled={!settings.enabled}><ChevronRight size={14} /></button>
      <button type="button" className="radio-skip" aria-label="Next track" title="Next track" data-sound="none" onClick={() => radio.skip()} disabled={!settings.enabled}><SkipForward size={13} /></button>
      <button type="button" className="radio-vol" aria-label={`Music volume, ${Math.round(settings.volume * 100)} percent`} aria-expanded={vol} data-sound="none" onClick={() => { measure(); setVol((v) => !v); }}><Volume2 size={13} /></button>
      {vol && (
        <span className="radio-slider">
          <span className="radio-pop-head"><span className="radio-pop-kicker">Music volume</span><b className="radio-pop-val">{Math.round(settings.volume * 100)}%</b></span>
          <input type="range" min={0} max={1} step={0.05} value={settings.volume} aria-label="Music volume" className="kit-range radio-range" style={{ ['--p' as string]: `${settings.volume * 100}%` }} onChange={(e) => radio.setVolume(Number(e.target.value))} />
          <span className="radio-pop-station">{station.name}</span>
        </span>
      )}
    </div>
  );
}
