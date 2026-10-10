import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Sparkles, X, ChevronDown } from 'lucide-react';
import type { Game } from '../game/engine';
import { prizeName } from '../game/vending';
import type { VendingPrize } from '../game/vending';
import { VENDING_RARITY_ODDS } from '../game/vending-odds';
import { gameAudio } from '../game/audio';
import { RARITY } from '../game/config';
import { WeaponCard, TreatArt, RARITY_KIT } from './common';
import { WeaponCardArt } from './WeaponCardArt';
import { TagChips } from './BuildSheet';
import { SCROLL_TAGS } from '../game/build';

function PrizeArt({ prize }: { prize: VendingPrize }) {
  return prize.kind === 'treat' ? <TreatArt id={prize.scroll.id} /> : <WeaponCardArt id={prize.weapon.def.id} small className="vending-gun" />;
}
function PrizeDetails({ prize, game }: { prize: VendingPrize; game: Game }) {
  return <>
    {prize.premium && <p className="vending-premium"><Sparkles size={14} /> Premium {prize.kind === 'weapon' ? 'gun' : 'treat'} · everyone can win this run prize</p>}
    {prize.kind === 'weapon' ? <WeaponCard w={prize.weapon} stats={game.stats} compare={game.weapon} bigInsc className="!w-full" /> : <article className="vending-treat-detail" style={{ borderColor: RARITY_KIT[prize.rarity] }}>
      <div className="vending-detail-art"><PrizeArt prize={prize} /></div>
      <div className="paper-kicker" style={{ color: RARITY_KIT[prize.rarity] }}>{RARITY[prize.rarity].name} treat</div>
      <h3>{prize.scroll.name}</h3>{prize.scroll.quote && <p className="vending-quote">“{prize.scroll.quote}”</p>}
      <div className="vending-effect"><small>APPLIED EFFECT</small><strong>{prize.scroll.desc}</strong></div>
      <TagChips tags={SCROLL_TAGS[prize.scroll.id] || []} />
      <p className="vending-owned">Collected this run: {game.scrolls[prize.scroll.id] || 0}{prize.scroll.max === 1 ? ' · one-off power' : ' · repeatable, stacks with your build'}</p>
    </article>}
  </>;
}

export function VendingMachine({ game, onDone }: { game: Game; onDone: () => void }) {
  const [, refresh] = useState(0), [peek, setPeek] = useState<VendingPrize | null>(null), [catalogueOpen, setCatalogueOpen] = useState(false);
  const frame = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null), modal = useRef<HTMLDivElement>(null), spinButton = useRef<HTMLButtonElement>(null);
  const catalogue = useMemo(() => game.vendingPool(), [game, game.vendingPlays, game.scrollOrder.length]);
  const spin = game.vendingSpin, spinning = spin?.status === 'spinning', unclaimed = spin?.status === 'won';
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hidePeek = () => { if (peekTimer.current) clearTimeout(peekTimer.current); setPeek(null); };
  const preview = (prize: VendingPrize) => {
    if (spinning || innerWidth <= 640 || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    hidePeek(); setPeek(prize); peekTimer.current = setTimeout(() => setPeek(null), 3000);
  };
  useEffect(() => {
    const hide = () => hidePeek(); window.addEventListener('resize', hide);
    return () => { window.removeEventListener('resize', hide); if (peekTimer.current) clearTimeout(peekTimer.current); };
  }, []);
  const shown = spin?.reel || catalogue.slice(0, 6);
  const update = () => { refresh(n => n + 1); onDone(); };
  const leave = () => { game.closeVending(); onDone(); };
  useEffect(() => { spinButton.current?.focus(); }, []);
  useEffect(() => { if (spinning) modal.current?.focus(); }, [spinning]);
  useEffect(() => {
    if (!spin || !frame.current || !track.current) return;
    const viewport = frame.current, reel = track.current;
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 4400;
    let animation: Animation | null = null, finished = false;
    const started = performance.now();
    const destination = () => {
      const tile = reel.children[spin.stop] as HTMLElement;
      return viewport.clientWidth / 2 - tile.offsetLeft - tile.offsetWidth / 2;
    };
    const settle = () => {
      if (finished) return; finished = true;
      reel.style.transform = `translateX(${destination()}px)`;
      animation?.cancel();
      game.settleVending(spin.id); refresh(n => n + 1);
    };
    const position = () => {
      if (spin.status !== 'spinning' || finished) { reel.style.transform = `translateX(${destination()}px)`; return; }
      const from = getComputedStyle(reel).transform;
      animation?.cancel();
      animation = reel.animate([{ transform: from === 'none' ? 'translateX(0px)' : from }, { transform: `translateX(${destination()}px)` }], {
        duration: Math.max(1, duration - (performance.now() - started)), easing: 'cubic-bezier(.08,.72,.15,1)', fill: 'forwards',
      });
      animation.onfinish = settle;
    };
    position();
    const observer = new ResizeObserver(position); observer.observe(viewport);
    // Tick only as actual tiles cross the marker, naturally slowing with the reel.
    let lastTile = -1;
    const ticks = spin.status === 'spinning' ? window.setInterval(() => {
      if (finished || document.visibilityState !== 'visible') return;
      const x = new DOMMatrixReadOnly(getComputedStyle(reel).transform).m41;
      const tile = reel.children[0] as HTMLElement;
      const index = Math.floor((viewport.clientWidth / 2 - x) / (tile.offsetWidth + 12));
      if (index !== lastTile) { lastTile = index; gameAudio.play('slotTick', .45); }
    }, 75) : 0;
    const timeout = spin.status === 'spinning' ? window.setTimeout(settle, duration + 200) : 0;
    return () => { observer.disconnect(); animation?.cancel(); clearInterval(ticks); clearTimeout(timeout); };
  }, [game, spin?.id]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key.toLowerCase() === 'e') { event.preventDefault(); if (peek) setPeek(null); else leave(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"])') || []);
      const first = buttons[0], last = buttons.at(-1);
      if (!first) { event.preventDefault(); modal.current?.focus(); return; }
      if (document.activeElement === modal.current) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  });
  return <div className="vending-backdrop"><div ref={modal} className="vending-machine" tabIndex={-1} role="dialog" aria-modal="true" aria-label="Midnight Candy Machine">
    <header className="vending-header"><div><div className="paper-kicker">Open to every kid · monsters paused</div><h2><Sparkles /> Midnight Candy Machine</h2><p>No keys. No Bits. Just the coins you found tonight. Premium prizes can be won by everyone.</p></div><div className="vending-wallet"><Coins size={20} /><strong>{game.p.coins}</strong><button className="records-icon" aria-label="Leave vending machine" disabled={spinning} onClick={leave}><X /></button></div></header>
    <div className="vending-reel-frame" ref={frame} data-testid="vending-reel"><div className="vending-reel" ref={track} key={spin?.id || 'preview'}>
      {shown.map((prize, index) => <button type="button" key={`${index}:${prize.key}`} className={`vending-tile ${spin && index === spin.stop && !spinning ? 'is-winner' : ''}`} style={{ '--prize-color': RARITY_KIT[prize.rarity] } as React.CSSProperties}
        aria-label={`Inspect ${prizeName(prize)}${prize.premium ? ' (premium prize)' : ''}`} tabIndex={spin ? Math.abs(index - spin.stop) <= 2 ? 0 : -1 : index < 5 ? 0 : -1} disabled={!!spinning} onMouseEnter={() => preview(prize)} onMouseLeave={hidePeek} onFocus={() => preview(prize)} onBlur={hidePeek}>
        <div className="vending-tile-art"><PrizeArt prize={prize} /></div><span>{RARITY[prize.rarity].name} {prize.kind === 'weapon' ? 'gun' : 'treat'}</span><strong>{prizeName(prize)}</strong>{prize.premium && <small><Sparkles size={10} /> PREMIUM {prize.kind === 'weapon' ? 'GUN' : 'TREAT'}</small>}
      </button>)}
    </div><div className="vending-marker" aria-hidden="true"><ChevronDown /></div></div>
    <div className="vending-state" role="status" aria-live="polite">{spinning ? 'The machine is choosing your prize…' : spin ? `${spin.status === 'claimed' ? 'Collected' : spin.status === 'rejected' ? 'Rejected' : 'You won'}: ${prizeName(spin.winner)}` : 'Insert coins. Spin the reel. Find something wicked.'}</div>
    {spin && !spinning && <section className="vending-winner" aria-label="Winning prize" key={spin.id}><div><div className="paper-kicker">{spin.status === 'claimed' ? 'Added to your run' : 'Your prize'}</div><PrizeDetails prize={spin.winner} game={game} /></div><div className="vending-claim">
      <h3>{spin.status === 'claimed' ? 'Make it count.' : spin.status === 'rejected' ? 'Gun rejected.' : 'This one is yours.'}</h3><p>Premium prizes are playable this run, even without the full game. They do not permanently unlock characters or areas.</p>
      {unclaimed && (spin.winner.kind === 'treat' ? <button className="hm-btn" onClick={() => { if (game.claimVending()) update(); }}>Collect treat</button> : <><p>Choose a slot, or reject the gun and leave. Equipping drops your old gun next to the machine.</p>{[0, 1].map(slot => <button key={slot} className="hm-btn" onClick={() => { if (game.claimVending(slot)) update(); }}>Equip slot {slot + 1} · {game.p.weapons[slot]?.def.name || 'Empty'}</button>)}<button className="hm-btn vending-exit" onClick={() => { game.rejectVending(); leave(); }}>Reject gun &amp; back to streets</button><p className="vending-note">Rejecting does not refund the spin.</p></>)}
      {spin.status === 'claimed' && <p className="vending-collected">Collected ✓</p>}
    </div></section>}
    <div className="vending-controls"><button ref={spinButton} className="hm-btn" disabled={spinning || unclaimed || game.p.coins < game.vendingPrice()} onClick={() => { hidePeek(); if (game.spinVending()) update(); }}><Sparkles size={18} /> {spin ? 'Spin again' : 'Spin the machine'} · {game.vendingPrice()} coins</button><button className="hm-btn ghost" disabled={spinning} aria-expanded={catalogueOpen} onClick={() => setCatalogueOpen(!catalogueOpen)}>Prize catalogue & odds</button><button className="hm-btn vending-exit" disabled={spinning} onClick={leave}>Back to the streets</button></div>
    {game.p.coins < game.vendingPrice() && !spinning && !unclaimed && <p className="vending-note">Find {game.vendingPrice() - game.p.coins} more coins to play. Every spin gives one prize; coins are earned in-game only.</p>}
    {catalogueOpen && <section className="vending-catalogue" aria-label="Prize catalogue"><h3>What’s inside</h3><p>Prize rarity odds: {VENDING_RARITY_ODDS.map((chance, r) => `${RARITY[r].name} ${chance}%`).join(' · ')}. Normally 75% treats / 25% guns within each rarity; if all one-off treats in a rarity are owned, that rarity awards guns instead.</p><p>The reel is a visual showcase, not the probability table. Everyone can win premium prizes. Duplicate stackable treats are allowed; owned one-off powers are excluded. Prices rise 30% after every spin.</p><div className="vending-catalogue-grid">{catalogue.filter(prize => prize.kind === 'treat' || prize.rarity === 3).map(prize => <button key={prize.key} onMouseEnter={() => preview(prize)} onMouseLeave={hidePeek} onFocus={() => preview(prize)} onBlur={hidePeek} style={{ borderColor: RARITY_KIT[prize.rarity] }}><div><PrizeArt prize={prize} /></div><strong>{prizeName(prize)}</strong><small>{prize.premium ? `Premium ${prize.kind === 'weapon' ? 'gun' : 'treat'} · everyone can win` : prize.kind === 'weapon' ? 'Gun · Common–Legendary' : `${RARITY[prize.rarity].name} treat`}</small></button>)}</div></section>}
    {peek && <aside className="vending-peek" role="region" aria-label="Prize details"><button className="records-icon" aria-label="Close prize details" onClick={() => setPeek(null)}><X /></button><div className="paper-kicker">Inspecting · {prizeName(peek)}</div><PrizeDetails prize={peek} game={game} /></aside>}
  </div></div>;
}
