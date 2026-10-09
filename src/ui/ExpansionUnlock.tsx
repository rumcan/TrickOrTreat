import { useSyncExternalStore } from 'react';
import { expansion, hasFullGame } from '../game/expansion';
import { KitButton, KitTitle } from './kit';

export function ExpansionUnlock({ onPlay, compact = false }: { onPlay: () => void; compact?: boolean }) {
  const state = useSyncExternalStore(expansion.subscribe, expansion.snapshot, expansion.snapshot);
  return <section aria-label="Full game unlock" className={`kit-panel text-[#f2e6c9] ${compact ? 'ml-auto w-[48vw] max-w-xs p-2 sm:p-3 [&_.kit-btn]:w-full [&_.kit-btn_span]:whitespace-normal' : 'mx-auto max-w-2xl p-4'}`}>
    <div className={`flex flex-wrap gap-2 ${compact ? 'justify-end' : 'items-center justify-between'}`}><div>{compact ? <div className="font-cond2 text-xs font-bold uppercase tracking-widest text-[#ffc453]">Hide & Shriek · Full game</div> : <><KitTitle className="text-2xl">Hide & Shriek · Full game</KitTitle><p className="text-sm text-[#9aa0a6]">Rescue your friends · one fighting companion · new kids, guns, costumes & talents</p></>}</div>
    {hasFullGame() ? <KitButton size={compact ? 'sm' : 'md'} onClick={onPlay}>Play rescue campaign{state.preview ? ' (dev preview)' : ''}</KitButton> : <KitButton size={compact ? 'sm' : 'md'} disabled={state.loading || state.buying || !state.bits} onClick={() => void expansion.purchase()}>{state.buying ? 'Checking unlock…' : state.loading ? 'Checking ownership…' : state.bits ? `Unlock forever · ${state.bits} RUN Bits` : 'Unlock not available yet'}</KitButton>}</div>
    {!compact && <p className="mt-2 text-xs text-[#9aa0a6]">Original survival stays free. One permanent purchase; no repeat charge to replay.</p>}
    {state.error && <p role="status" className="mt-2 text-xs text-[#ffc453]">{state.error}</p>}
    <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${compact ? 'justify-end' : ''}`}><button onClick={() => void expansion.restore()} disabled={state.buying || state.loading}>Restore purchase / retry</button>{import.meta.env.DEV && !hasFullGame() && <button onClick={() => expansion.preview()}>Preview expansion locally · no charge</button>}</div>
  </section>;
}
