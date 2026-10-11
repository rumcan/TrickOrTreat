import { useEffect, useRef, useSyncExternalStore } from 'react';
import { campaignOffered } from '../game/engine';
import { useBack } from './back';
import { createPortal } from 'react-dom';
import { expansion, hasFullGame } from '../game/expansion';
import { COSTUMES, ESSENCE_UNLOCK, HERO_COSTUME, HERO_INFO, SCROLLS, TALENTS, WEAPONS, essenceEarned, loadSave } from '../game/data';
import { ART, PORTRAITS } from './art';
import { HeroPreview, TreatArt, GunArt } from './common';
import { KitButton, KitTitle } from './kit';

const guns = WEAPONS.filter(w => w.premium), treats = SCROLLS.filter(t => t.premium);
const costumes = COSTUMES.filter(c => c.premium), talents = TALENTS.filter(t => t.premium);

export function UnlockShowcase({ onClose, onPlay }: { onClose: () => void; onPlay: () => void }) {
  useBack(onClose);
  const state = useSyncExternalStore(expansion.subscribe, expansion.snapshot, expansion.snapshot);
  const dialog = useRef<HTMLDivElement>(null), owned = hasFullGame();
  // the other way in: Essence earned over all your runs (spent or not)
  const earned = essenceEarned(loadSave());
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [onClose]);
  return createPortal(<div className="unlock-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="unlock-title" className="unlock-page">
      <header className="unlock-toolbar"><span>One unlock. Every night.</span><button onClick={onClose} aria-label="Close full game showcase">Close ×</button></header>
      <div className="unlock-scroll">
        <section className="unlock-hero" style={{ backgroundImage: `linear-gradient(90deg, #111620ed, #11162077), url("${ART.keyart}")` }}>
          <div className="unlock-kicker">The complete Trick or Treat adventure</div><h1 id="unlock-title">THE FULL GAME</h1>
          <p>Twenty-four bosses. One very long night.</p><p>Play as Maya or Leo, roam a bigger Maple Falls, and arm your crew with every full-game gun, treat, costume and talent. Share weapons with the friends who join you, upgrade together and let a buddy pick you up when the night gets rough.</p>
          <div className="unlock-badges"><span>2 powerful kids</span><span>{guns.length} guns</span><span>{treats.length} treats</span><span>{costumes.length} costumes</span><span>{talents.length} talents</span></div>
        </section>
        <nav className="unlock-nav" aria-label="Full game contents"><a href="#unlock-kids">Kids</a><a href="#unlock-guns">Guns</a><a href="#unlock-treats">Treats</a><a href="#unlock-costumes">Costumes</a><a href="#unlock-world">World &amp; talents</a></nav>
        <section id="unlock-kids" className="unlock-section"><KitTitle>Meet your secret weapons</KitTitle><div className="unlock-kids">
          {[3, 4].map(hero => <article key={hero} className="unlock-kid"><img src={PORTRAITS[hero]} alt={`${HERO_INFO[hero].name} portrait`} /><div><h3>{HERO_INFO[hero].name}</h3><p className="unlock-kicker">{HERO_INFO[hero].title}</p><p>{HERO_INFO[hero].passive}</p><h4>{HERO_INFO[hero].skill}</h4><p>{HERO_INFO[hero].skillDesc}</p></div></article>)}
        </div></section>
        <section id="unlock-guns" className="unlock-section"><KitTitle>Every exclusive gun</KitTitle><div className="unlock-grid">
          {guns.map(w => <article key={w.id} className="unlock-card"><div className="unlock-card-art unlock-card-gun"><GunArt id={w.id} alt={w.name} /></div><h3>{w.name}</h3><p>{w.desc}</p><span className="unlock-stat">{w.dmg} base damage · {w.rate} shots/s · {w.mag} magazine</span></article>)}
        </div></section>
        <section id="unlock-treats" className="unlock-section"><KitTitle>Every exclusive treat</KitTitle><div className="unlock-grid">
          {treats.map(t => <article key={t.id} className="unlock-card"><div className="unlock-card-art"><TreatArt id={t.id} /></div><h3>{t.name}</h3><p>{t.desc}</p><span className="unlock-stat">{t.max > 1 ? "Find and stack during your runs" : "One of a kind: a big gain at a real price"}</span></article>)}
        </div></section>
        <section id="unlock-costumes" className="unlock-section"><KitTitle>Dress for the darkest night</KitTitle><div className="unlock-grid">
          {costumes.map(c => <article key={c.id} className="unlock-card"><div className="unlock-card-art unlock-costume-art"><HeroPreview hero={HERO_COSTUME.indexOf(c.id)} costume={c.id} size={1.5} walking={false} staticFrame /></div><span className="text-xs font-bold uppercase text-[#c69fff]">{HERO_INFO[HERO_COSTUME.indexOf(c.id)].name}'s own Epic costume · rare drop</span><h3>{c.name}</h3><p>{c.power}</p><span className="unlock-stat">{c.perks}</span></article>)}
        </div></section>
        <section id="unlock-world" className="unlock-section"><KitTitle>A bigger night. A stronger crew.</KitTitle><p>Explore the drive-in, video rental store, church, barn and primary school playground. Mount the jungle-gym Candy Cannon and gear up for the night. Every player faces 24 increasingly powerful boss waves, each with its own crew, followed by an unstoppable tentacle giant.</p><h3>Permanent talent branches</h3><div className="unlock-talents">{talents.map(t => <article key={t.id}><strong>{t.name}</strong><p>{t.desc}</p></article>)}</div><p className="mt-4">Unlocks join the loot pool, rather than all appearing in your starting inventory. Earn treats and weapons through trick-or-treating and combat. The original survival game stays free.</p></section>
      </div>
      <footer className="unlock-footer"><div><strong>{owned ? state.earned && !state.owned ? 'Your full game is unlocked: you earned it' : 'Your full game is unlocked' : 'One permanent unlock'}</strong><p>No subscription. No repeat purchase to replay.</p>{!owned && <p className="unlock-earn" role="status">Or earn it by playing: the full game unlocks for free once you have earned more than {ESSENCE_UNLOCK.toLocaleString('en-US')} Essence. So far: {earned.toLocaleString('en-US')}.<span aria-hidden="true"><i style={{ width: `${Math.min(100, (earned / ESSENCE_UNLOCK) * 100)}%` }} /></span></p>}{!owned && !state.bits && !state.loading && <p>Browse now; checkout opens when the RUN shop is available.</p>}{state.error && <p role="status" className="text-[#ffd889]">{state.error}</p>}</div><div>
        <KitButton disabled={!owned && (state.loading || state.buying || !state.bits)} onClick={() => { if (owned) { onClose(); onPlay(); } else void expansion.purchase(); }}>{owned ? campaignOffered() ? 'Play rescue campaign' : 'Play the full game' : state.buying ? 'Checking unlock...' : state.loading ? 'Checking ownership...' : state.bits ? `Unlock forever - ${state.bits} RUN Bits` : 'Purchase currently unavailable'}</KitButton>
        <button className="mt-2 block text-sm underline" onClick={() => void expansion.restore()} disabled={state.buying || state.loading}>Restore purchase / retry</button>
      </div></footer>
    </div>
  </div>, document.body);
}
