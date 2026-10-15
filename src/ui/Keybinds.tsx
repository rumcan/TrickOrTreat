// Settings › Controls: every gameplay key is listed here and can be changed. A row asks for the next key press and
// hands it to game/keybinds, which is what the engine actually reads. Keys are never lost: a new key is taken away
// from whatever else had it, and the last key of an action cannot be removed.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { CornerDownLeft, RotateCw, X } from 'lucide-react';
import { BINDS, BindId, assignKey, bindingsOf, clearKey, keyLabel, keybindVersion, resetBinding, resetBindings, subscribeKeybinds } from '../game/keybind-store';
import { actionIsDefault } from '../game/keybind-store';
import { Keycap, KitButton } from './kit';

/** re-renders on any change, so keycaps anywhere in the UI follow the player's keys */
export function useKeybindVersion(): number {
  return useSyncExternalStore(subscribeKeybinds, keybindVersion, keybindVersion);
}

/** re-exported from the store, so UI files have one place to import from */
export { bindLabels, bindHint, primaryKey, keyLabel } from '../game/keybind-store';

/** keycap row for one action: [W] [↑]; `stack` lays them out as a column (the four movement keys side by side) */
export function BindKeys({ id, className = '', size = 'sm', stack = false }: { id: BindId; className?: string; size?: 'sm' | 'md'; stack?: boolean }) {
  useKeybindVersion();
  const cap = size === 'sm' ? '!h-5 !min-w-5 !px-1 !text-[11px]' : '';
  return (
    <span className={stack ? `inline-flex flex-col gap-0.5 ${className}` : `inline-flex flex-wrap items-center gap-1 ${className}`}>
      {bindingsOf(id).map((key, i) => <Keycap key={`${key}-${i}`} className={cap}>{keyLabel(key, size === 'sm')}</Keycap>)}
    </span>
  );
}

/**
 * The rebinding list. `compact` is the in-game pause version (no group headings, tighter rows); the title's
 * Settings panel uses the full one.
 */
export function KeybindEditor({ className = '', compact = false, children }: { className?: string; compact?: boolean; children?: ReactNode }) {
  useKeybindVersion();
  const [armed, setArmed] = useState<{ id: BindId; slot: number } | null>(null);
  const [note, setNote] = useState('');
  const [armedReset, setArmedReset] = useState(false);

  const stop = useCallback((event: KeyboardEvent) => {
    // the capture listener runs first, so the press never reaches the game's Input or the modal's own Escape handler
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, []);

  useEffect(() => {
    if (!armed) return;
    const onKey = (event: KeyboardEvent) => {
      stop(event);
      if (event.key === 'Escape') { setArmed(null); setNote('Kept the keys as they were.'); return; }
      const def = BINDS.find((b) => b.id === armed.id)!;
      const result = assignKey(armed.id, armed.slot, event.key);
      setNote(result.ok ? `${def.label} now uses ${keyLabel(event.key)}.` : result.reason);
      setArmed(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [armed, stop]);

  useEffect(() => { if (!armed) return; const timer = window.setTimeout(() => setNote(''), 4200); return () => window.clearTimeout(timer); }, [note, armed]);

  const pick = (id: BindId, slot: number) => { setArmed({ id, slot }); setNote(`Press the key for ${BINDS.find((b) => b.id === id)!.label}…`); };
  let lastGroup = '';

  return (
    <div className={className}>
      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        {BINDS.map((def) => {
          const group = compact || def.group === lastGroup ? '' : def.group;
          lastGroup = def.group;
          return (
            <div key={def.id}>
              {group && <div className="mt-4 mb-1.5 flex items-center gap-2 font-cond2 text-[12px] font-bold uppercase tracking-[.18em] text-[#ffa23c]"><span>{group}</span><span className="h-px flex-1 bg-[#ff7a18]/30" /></div>}
              <div className={`keybind-row ${armed?.id === def.id ? 'is-armed' : ''}`}>
                <div className="min-w-0">
                  <div className="keybind-name">{def.label}</div>
                  {!compact && <div className="keybind-desc">{def.desc}</div>}
                </div>
                <div className="keybind-keys">
                  {armed?.id === def.id ? (
                    <span className="keybind-waiting" role="status">Press a key… <span className="text-[#b9ad99]">(Esc keeps the old one)</span></span>
                  ) : (
                    <>
                      {bindingsOf(def.id).map((key, slot) => (
                        <button key={`${key}-${slot}`} type="button" className="keybind-key" aria-label={`Change ${def.label} key ${keyLabel(key)}`} title={`Click, then press the key you want for ${def.label.toLowerCase()}`} onClick={() => pick(def.id, slot)}>
                          {keyLabel(key)}
                        </button>
                      ))}
                      {bindingsOf(def.id).length > 1 && (
                        <button type="button" className="keybind-x" aria-label={`Remove the extra ${def.label} key`} title="Remove this alternative key" onClick={() => { const result = clearKey(def.id, bindingsOf(def.id).length - 1); if (!result.ok) setNote(result.reason); }}><X size={12} strokeWidth={3} /></button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <KitButton size="sm" variant="dark" icon={RotateCw} onClick={() => { resetBindings(); setNote('Every key is back to its default.'); }}>Reset all keys</KitButton>
        {armedReset
          ? <KitButton size="sm" variant="red" icon={CornerDownLeft} onClick={() => { setArmedReset(false); setNote('Pick an action to restore: the arrow on its right.'); }}>Cancel</KitButton>
          : <KitButton size="sm" variant="dark" onClick={() => setArmedReset(true)}>Restore one action…</KitButton>}
        <p role="status" aria-live="polite" className="keybind-note">{note || 'Click a key, then press the new one. Escape always closes menus; Tab always moves on.'}</p>
      </div>
      {armedReset && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BINDS.filter((def) => !actionIsDefault(def.id)).map((def) => (
            <button key={def.id} type="button" className="keybind-key" onClick={() => { resetBinding(def.id); setNote(`${def.label} is back to ${def.defaults.map((k) => keyLabel(k)).join(' / ')}.`); }}>↺ {def.label}</button>
          ))}
          {BINDS.every((def) => actionIsDefault(def.id)) && <span className="keybind-desc">Nothing has been changed yet.</span>}
        </div>
      )}
      {children}
    </div>
  );
}
