import { useState, useSyncExternalStore } from 'react';
import { useBack } from './back';
import { expansion, hasFullGame } from '../game/expansion';
import { TALENTS, TALENT_BRANCHES, TALENT_BRANCH_SUB, TALENT_COLORS, TALENT_ROOT, TALENT_BY_ID, Talent, Save, storeSave, talentUnlocked, COSTUMES } from '../game/data';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { CandyIcon } from './common';

type NodeState = 'maxed' | 'owned' | 'available' | 'locked';
const BASE = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';

export function TalentTree({ save, onBack, onAgain, earned }: { save: Save; onBack: () => void; onAgain?: () => void; earned?: number }) {
  useBack(onBack);
  useSyncExternalStore(expansion.subscribe, expansion.snapshot, expansion.snapshot);
  const [, force] = useState(0);
  const [sel, setSel] = useState<string>('sharp');
  const [hover, setHover] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const ranks = save.talents;

  const stateOf = (t: Talent): NodeState => {
    if (t.premium && !hasFullGame()) return 'locked';
    const l = ranks[t.id] || 0;
    if (l >= t.max) return 'maxed';
    if (l > 0) return 'owned';
    return talentUnlocked(t, ranks) ? 'available' : 'locked';
  };
  const canBuy = (t: Talent) => {
    const st = stateOf(t);
    return (st === 'available' || st === 'owned') && save.soul >= t.cost(ranks[t.id] || 0);
  };
  const buy = (id: string) => {
    const t = TALENT_BY_ID[id];
    if (!canBuy(t)) return;
    save.soul -= t.cost(ranks[id] || 0);
    save.talents[id] = (ranks[id] || 0) + 1;
    storeSave(save);
    setFlash(id);
    setTimeout(() => setFlash(null), 450);
    force((n) => n + 1);
  };
  const refund = () => {
    let r = 0;
    for (const t of TALENTS) for (let l = 0; l < (ranks[t.id] || 0); l++) r += t.cost(l);
    save.soul += r;
    save.talents = {};
    storeSave(save);
    force((n) => n + 1);
  };
  const spent = (b: number) => TALENTS.filter((t) => t.branch === b).reduce((a, t) => a + (ranks[t.id] || 0), 0);

  // edges
  const edges: { x1: number; y1: number; x2: number; y2: number; b: number; lit: boolean; open: boolean }[] = [];
  for (const t of TALENTS) {
    const tl = (ranks[t.id] || 0) > 0;
    if (t.req.length === 0) edges.push({ x1: TALENT_ROOT.x, y1: TALENT_ROOT.y, x2: t.x, y2: t.y, b: t.branch, lit: tl, open: true });
    for (const r of t.req) {
      const s = TALENT_BY_ID[r];
      const sl = (ranks[r] || 0) > 0;
      edges.push({ x1: s.x, y1: s.y, x2: t.x, y2: t.y, b: t.branch, lit: sl && tl, open: sl });
    }
  }

  const focus = TALENT_BY_ID[hover || sel];
  const fl = ranks[focus.id] || 0;
  const fst = stateOf(focus);

  const icon = (id: string) => `${BASE}images/talents/${id}.webp`;
  const fc = TALENT_COLORS[focus.branch];

  return (
    <div className="talent-screen">
      {/* ===== tree: the whole constellation always fits its area ===== */}
      <div className="talent-sky">
        <img src={icon('back')} alt="" draggable={false} className="talent-sky-art" />
        {/* the viewBox leaves a margin all round, so labels, rank pips and the radio in the corner never collide with a star */}
        <svg viewBox="-40 -48 1080 1010" preserveAspectRatio="xMidYMid meet" className="talent-svg">
          <defs>
            <filter id="tglow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <radialGradient id="nodeFill">
              <stop offset="0%" stopColor="#241a38" />
              <stop offset="100%" stopColor="#07060d" />
            </radialGradient>
          </defs>

          {/* branch titles */}
          {[
            { b: 0, x: 95, y: 430 },
            { b: 1, x: 905, y: 430 },
            { b: 2, x: 815, y: 880 },
          ].map(({ b, x, y }) => (
            <g key={b} textAnchor="middle" style={{ paintOrder: 'stroke', stroke: '#05040b', strokeWidth: 6, strokeLinejoin: 'round' }}>
              <text x={x} y={y} fill={TALENT_COLORS[b]} fontSize="34" style={{ fontFamily: 'Anton, Impact, sans-serif', letterSpacing: 2 }}>{TALENT_BRANCHES[b].toUpperCase()}</text>
              <text x={x} y={y + 22} fill="#fff0da" fontSize="13" fontWeight="700" style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: 4, strokeWidth: 4 }}>{TALENT_BRANCH_SUB[b].toUpperCase()} · {spent(b)} PTS</text>
            </g>
          ))}

          {/* edges */}
          {edges.map((e, i) => (
            <g key={i}>
              <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#05040b" strokeOpacity="0.75" strokeWidth={e.lit ? 9 : 6} strokeLinecap="round" />
              {e.lit && <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={TALENT_COLORS[e.b]} strokeWidth="10" opacity="0.45" filter="url(#tglow)" />}
              <line
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke={e.lit || e.open ? TALENT_COLORS[e.b] : '#6a6480'}
                strokeOpacity={e.lit ? 1 : e.open ? 0.9 : 0.7}
                strokeWidth={e.lit ? 4.5 : 3}
                strokeLinecap="round"
                strokeDasharray={e.lit ? undefined : e.open ? '8 8' : '2 9'}
              >
                {e.open && !e.lit && <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.2s" repeatCount="indefinite" />}
              </line>
            </g>
          ))}

          {/* root */}
          <circle cx={TALENT_ROOT.x} cy={TALENT_ROOT.y} r="66" fill="#fb8016" opacity="0.35" filter="url(#tglow)" />
          <circle cx={TALENT_ROOT.x} cy={TALENT_ROOT.y} r="54" fill="url(#nodeFill)" stroke="#ffc94d" strokeWidth="5" />
          <circle cx={TALENT_ROOT.x} cy={TALENT_ROOT.y} r="63" fill="none" stroke="#ffc94d" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="5 5">
            <animateTransform attributeName="transform" type="rotate" from={`0 ${TALENT_ROOT.x} ${TALENT_ROOT.y}`} to={`360 ${TALENT_ROOT.x} ${TALENT_ROOT.y}`} dur="30s" repeatCount="indefinite" />
          </circle>
          <image href={icon('root')} x={TALENT_ROOT.x - 44} y={TALENT_ROOT.y - 44} width="88" height="88" />

          {/* nodes */}
          {TALENTS.map((t) => {
            const st = stateOf(t);
            const l = ranks[t.id] || 0;
            const c = TALENT_COLORS[t.branch];
            const R = t.capstone ? 40 : 31;
            const active = st === 'maxed' || st === 'owned';
            const affordable = canBuy(t);
            const isSel = sel === t.id;
            const ring = st === 'locked' ? '#5b5670' : st === 'maxed' ? '#ffc94d' : c;
            const shape = (r: number) => Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; return `${t.x + Math.cos(a) * r},${t.y + Math.sin(a) * r}`; }).join(' ');
            return (
              <g
                key={t.id}
                style={{ cursor: st === 'locked' ? 'not-allowed' : 'pointer' }}
                onMouseEnter={() => setHover(t.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => { setSel(t.id); buy(t.id); }}
              >
                {active && <circle cx={t.x} cy={t.y} r={R + 12} fill={c} opacity="0.5" filter="url(#tglow)" />}
                {affordable && (
                  <circle cx={t.x} cy={t.y} r={R + 6} fill="none" stroke={c} strokeWidth="3">
                    <animate attributeName="r" values={`${R + 4};${R + 14};${R + 4}`} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0;1" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                {t.capstone
                  ? <polygon points={shape(R + 5)} fill="url(#nodeFill)" stroke={ring} strokeWidth={active ? 5 : 3.5} strokeLinejoin="round" />
                  : <circle cx={t.x} cy={t.y} r={R} fill="url(#nodeFill)" stroke={ring} strokeWidth={active ? 5 : 3.5} />}
                {st === 'maxed' && (t.capstone
                  ? <polygon points={shape(R - 1)} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" />
                  : <circle cx={t.x} cy={t.y} r={R - 5} fill="none" stroke={c} strokeWidth="2.5" />)}
                {isSel && <circle cx={t.x} cy={t.y} r={R + 17} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" strokeDasharray="4 5" />}
                {flash === t.id && (
                  <circle cx={t.x} cy={t.y} r={R} fill="none" stroke="#fff" strokeWidth="4">
                    <animate attributeName="r" from={`${R}`} to={`${R + 40}`} dur="0.45s" fill="freeze" />
                    <animate attributeName="opacity" from="1" to="0" dur="0.45s" fill="freeze" />
                  </circle>
                )}
                <image href={icon(t.id)} x={t.x - R * 0.74} y={t.y - R * 0.74} width={R * 1.48} height={R * 1.48} opacity={st === 'locked' ? 0.5 : 1} style={{ filter: st === 'locked' ? 'grayscale(1) brightness(0.7)' : undefined }} />
                {/* rank pips */}
                {Array.from({ length: t.max }).map((_, k) => {
                  const span = Math.min(Math.PI * 0.9, t.max * 0.32);
                  const a = Math.PI / 2 + (t.max === 1 ? 0 : (k / (t.max - 1) - 0.5) * span);
                  return <circle key={k} cx={t.x + Math.cos(a) * (R + 11)} cy={t.y + Math.sin(a) * (R + 11)} r="4.4" fill={k < l ? c : '#07060d'} stroke={st === 'locked' ? '#5b5670' : c} strokeWidth="1.8" />;
                })}
                <text x={t.x} y={t.y - R - 11} textAnchor="middle" fill={st === 'locked' ? '#a39fb5' : '#ffffff'} fontSize="13" fontWeight="700" style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: 0.6, paintOrder: 'stroke', stroke: '#05040b', strokeWidth: 5, strokeLinejoin: 'round' }}>{t.name}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ===== side panel: the game's dark-paper look ===== */}
      <aside className="talent-side">
        <header>
          <div className="paper-kicker">Permanent upgrades</div>
          <h2 className="paper-title !text-[34px]">Talent constellations</h2>
          <span className="paper-rule" />
          <p className="mt-3 text-[13px] leading-snug text-[#c9bda6]">Click a star to invest Soul Candy. Each star unlocks the stars it links to.</p>
        </header>

        {earned !== undefined && (
          <section className="paper-card" style={{ borderLeft: '5px solid #c46bff' }}>
            <div className="label">Make the next run stronger</div>
            <div className="font-cond text-2xl leading-tight text-[#d9a8ff]">+{earned} Soul Candy earned this run</div>
            <p className="mt-1 text-xs text-[#8f8676]">Spend your permanent talent XP below. Run levels reset; these skills stay.</p>
          </section>
        )}

        <div className="flex items-stretch gap-2">
          <div className="talent-wallet" title="Soul Candy is earned at the end of every run (kills, time survived, boss).">
            <CandyIcon size={26} />
            <div>
              <div className="label">Soul Candy</div>
              <b>{save.soul}</b>
            </div>
          </div>
          <button className="hm-btn ghost" onClick={onBack}><ChevronLeft size={18} strokeWidth={3} /> Back</button>
        </div>
        {onAgain && <button className="hm-btn talent-replay w-full" onClick={onAgain}>Play again with these talents</button>}

        <section className="paper-card talent-focus" style={{ borderLeft: `5px solid ${fc}` }}>
          <div className="flex items-center gap-3">
            <div className="talent-focus-art" style={{ borderColor: fst === 'maxed' ? '#ffc94d' : fst === 'locked' ? '#5b5670' : fc }}>
              <img src={icon(focus.id)} alt="" draggable={false} style={{ filter: fst === 'locked' ? 'grayscale(1) brightness(0.7)' : undefined }} />
            </div>
            <div className="min-w-0">
              <div className="label" style={{ color: fc }}>{TALENT_BRANCHES[focus.branch]} · {TALENT_BRANCH_SUB[focus.branch]}{focus.capstone ? ' · Capstone' : ''}</div>
              <div className="font-cond text-[26px] uppercase leading-none text-[#fff0da]">{focus.name}</div>
            </div>
          </div>
          <p className="mt-3 text-[15px] font-semibold leading-snug text-[#f2e8d4]">{focus.desc}</p>
          <div className="mt-3 flex items-center gap-1.5">
            {Array.from({ length: focus.max }).map((_, k) => (
              <div key={k} className="talent-rank h-2.5 flex-1" style={{ background: k < fl ? fc : '#0f1518', borderColor: k < fl ? fc : undefined }} />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between font-cond2 text-xs font-bold uppercase tracking-[0.14em] text-[#8f8676]">
            <span>Rank {fl} / {focus.max}</span>
            {fst !== 'maxed' && <span className="text-[#d9a8ff]">Next: {focus.cost(fl)} candy</span>}
          </div>
          {focus.premium && !hasFullGame() && <p role="status" className="mt-3 border border-[#ffc453]/50 bg-black/30 p-3 text-sm text-white">Full-game talent: unlock Hide & Shriek using the button in the main-menu header. After unlocking, the linked talent requirements below still apply.</p>}
          {focus.req.length > 0 && (
            <div className="mt-2 font-cond2 text-[13px] font-semibold text-[#c9bda6]">
              Unlock by buying rank 1 in any one of:{' '}
              {focus.req.map((r) => (
                <span key={r} className={(ranks[r] || 0) > 0 ? 'mr-1.5 font-bold text-[#7CFF64]' : 'mr-1.5 font-bold text-[#ff6a5a]'}>{TALENT_BY_ID[r].name}</span>
              ))}
            </div>
          )}
          {fst !== 'locked' && fst !== 'maxed' && save.soul < focus.cost(fl) && <p className="mt-3 text-sm text-white">Earn {focus.cost(fl) - save.soul} more essence by completing a run to buy the next rank.</p>}
          {focus.id === 'master' && <div className="mt-2 font-cond2 text-xs font-semibold text-[#c9bda6]">One costume per kid: {COSTUMES.map((c) => c.icon).join(' ')}</div>}
          <button className="hm-btn mt-4 w-full" disabled={!canBuy(focus)} onClick={() => buy(focus.id)}>
            {fst === 'maxed' ? 'Mastered' : fst === 'locked' ? focus.premium && !hasFullGame() ? 'Full game required' : 'Buy a linked talent first' : `Invest · 🍬 ${focus.cost(fl)}`}
          </button>
        </section>

        <div className="grid grid-cols-3 gap-2">
          {TALENT_BRANCHES.map((b, i) => (
            <div key={b} className="paper-card !p-2.5 text-center" style={{ borderTop: `4px solid ${TALENT_COLORS[i]}` }}>
              <div className="label" style={{ color: TALENT_COLORS[i] }}>{b}</div>
              <div className="font-cond text-3xl leading-none text-[#fff0da]">{spent(i)}</div>
              <div className="label !text-[9px]">{TALENT_BRANCH_SUB[i]}</div>
            </div>
          ))}
        </div>

        <footer className="mt-auto flex flex-col gap-2.5 pt-2 font-cond2 text-xs font-semibold uppercase tracking-[0.08em] text-[#8f8676]">
          <div className="flex items-center gap-2.5"><span className="inline-block h-3.5 w-3.5 rounded-full border-[3px] border-[#fb8016]" /> Pulsing ring: you can afford it</div>
          <div className="flex items-center gap-2.5"><span className="inline-block h-0 w-7 border-t-[3px] border-dashed border-[#00d5ff]" /> Dashed path: unlocked, not bought</div>
          <div className="flex items-center gap-2.5"><span className="inline-block h-3.5 w-3.5 rounded-full border-[3px] border-[#ffc94d]" /> Gold ring: mastered</div>
          <button className="hm-btn ghost mt-1 !min-h-10 !text-sm" onClick={refund}><RotateCcw size={15} strokeWidth={2.6} /> Refund all points</button>
        </footer>
      </aside>
    </div>
  );
}
