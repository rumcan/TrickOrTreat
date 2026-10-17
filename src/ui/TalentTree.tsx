import { useState, useSyncExternalStore } from 'react';
import { useBack } from './back';
import { expansion, hasFullGame } from '../game/expansion';
import { TALENTS, TALENT_BRANCHES, TALENT_BRANCH_SUB, TALENT_COLORS, TALENT_ROOT, TALENT_BY_ID, Talent, Save, storeSave, talentUnlocked, talentCost, talentCap, COSTUMES } from '../game/data';
import { ChevronLeft, RotateCcw, ChevronsUp, Plus, Minus, LocateFixed, Scan } from 'lucide-react';
import { CandyIcon } from './common';
import { HeadingArt } from './HeadingArt';
import { PaintedFrame } from './PaintedFrame';
import { useTalentCamera } from './useTalentCamera';

type NodeState = 'maxed' | 'owned' | 'available' | 'locked';
const BASE = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';

export function TalentTree({ save, onBack, onAgain, earned, backLabel = 'Back' }: { save: Save; onBack: () => void; onAgain?: () => void; earned?: number; backLabel?: string }) {
  useBack(onBack);
  useSyncExternalStore(expansion.subscribe, expansion.snapshot, expansion.snapshot);
  const [, force] = useState(0);
  const [sel, setSel] = useState<string>('sharp');
  const [hover, setHover] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const camera = useTalentCamera();
  const ranks = save.talents;

  const stateOf = (t: Talent): NodeState => {
    if (t.premium && !hasFullGame()) return 'locked';
    const l = ranks[t.id] || 0;
    if (l >= talentCap(t)) return 'maxed';
    if (l > 0) return 'owned';
    return talentUnlocked(t, ranks) ? 'available' : 'locked';
  };
  const canBuy = (t: Talent) => {
    const st = stateOf(t);
    return (st === 'available' || st === 'owned') && save.soul >= talentCost(t, ranks[t.id] || 0);
  };
  const buy = (id: string, all = false) => {
    const t = TALENT_BY_ID[id];
    if (!canBuy(t)) return;
    // "all": pour every Essence you hold into this one star, rank after rank, for as long as it can be paid for
    do {
      save.soul -= talentCost(t, ranks[id] || 0);
      save.talents[id] = (ranks[id] || 0) + 1;
    } while (all && canBuy(t));
    storeSave(save);
    setFlash(id);
    setTimeout(() => setFlash(null), 450);
    force((n) => n + 1);
  };
  /** how many ranks of `t` the Essence in hand would buy, all spent here */
  const affordableRanks = (t: Talent) => {
    let n = 0, soul = save.soul, l = ranks[t.id] || 0;
    while (l < talentCap(t) && soul >= talentCost(t, l) && n < 10000) { soul -= talentCost(t, l); l++; n++; }
    return n;
  };
  const refund = () => {
    let r = 0;
    for (const t of TALENTS) for (let l = 0; l < (ranks[t.id] || 0); l++) r += talentCost(t, l);
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
      {/* Zoomable tree; dragging and pinching never purchases a talent. */}
      <div className="talent-sky">
        <img src={icon('back')} alt="" draggable={false} className="talent-sky-art" />
        <svg ref={camera.svgRef} viewBox={camera.viewBox} preserveAspectRatio="xMidYMid meet" className="talent-svg" aria-label="Talent constellation" {...camera.handlers}>
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
            { b: 1, x: 1135, y: 150 },
            { b: 2, x: 955, y: 945 },
            { b: 3, x: 1335, y: 325 },
          ].map(({ b, x, y }) => (
            <g key={b} textAnchor="middle" style={{ paintOrder: 'stroke', stroke: '#05040b', strokeWidth: 6, strokeLinejoin: 'round' }}>
              <text x={x} y={y} fill={TALENT_COLORS[b]} fontSize="34" style={{ fontFamily: '"Anton", Impact, sans-serif', letterSpacing: 3 }}>{TALENT_BRANCHES[b].toUpperCase()}</text>
              <text x={x} y={y + 22} fill="#fff0da" fontSize="13" fontWeight="700" style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: 5, strokeWidth: 4 }}>{TALENT_BRANCH_SUB[b].toUpperCase()} · {spent(b)} PTS</text>
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
            const mastered = l >= t.max;
            const ring = st === 'locked' ? '#5b5670' : mastered ? '#ffc94d' : c;
            const shape = (r: number) => Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; return `${t.x + Math.cos(a) * r},${t.y + Math.sin(a) * r}`; }).join(' ');
            return (
              <g
                key={t.id}
                data-talent-id={t.id}
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
                {mastered && (t.capstone
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
                {t.endless && l > t.max && <text x={t.x} y={t.y + R + 31} textAnchor="middle" fill="#ffc94d" fontSize="15" fontWeight="800" style={{ fontFamily: '"Barlow Condensed", sans-serif', paintOrder: 'stroke', stroke: '#05040b', strokeWidth: 5, strokeLinejoin: 'round' }}>+{l - t.max}</text>}
                <text className="talent-node-label" x={t.x} y={t.y - R - 11} textAnchor="middle" fill={st === 'locked' ? '#a39fb5' : '#ffffff'} fontSize="13" fontWeight="700" style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: 1.2, paintOrder: 'stroke', stroke: '#05040b', strokeWidth: 5, strokeLinejoin: 'round' }}>{t.name}{t.endless ? ' ∞' : ''}</text>
              </g>
            );
          })}
        </svg>
        <div className="talent-tree-tools" role="group" aria-label="Talent tree view">
          <div className="talent-tree-tool-row">
            <button type="button" aria-label="Zoom out talent tree" disabled={camera.zoom <= 1} onClick={() => camera.zoomBy(1 / 1.3)}><Minus size={18} /></button>
            <output aria-label="Talent tree zoom">{Math.round(camera.zoom * 100)}%</output>
            <button type="button" aria-label="Zoom in talent tree" disabled={camera.zoom >= 6} onClick={() => camera.zoomBy(1.3)}><Plus size={18} /></button>
            <button type="button" aria-label="Focus selected talent" title="Focus selected talent" onClick={() => camera.focus(TALENT_BY_ID[sel])}><LocateFixed size={18} /></button>
            <button type="button" aria-label="Fit entire talent tree" title="Fit entire talent tree" onClick={camera.fit}><Scan size={18} /><span>Fit</span></button>
          </div>
          <span className="talent-tree-hint">Drag to move · pinch or scroll to zoom</span>
        </div>
      </div>

      {/* ===== side panel: the game's dark-paper look ===== */}
      <aside className="talent-side generated-framed">
        <PaintedFrame />
        <div className="talent-panel-scroll">
        <header className="talent-panel-head">
          <div className="paper-kicker">Permanent upgrades</div>
          <h2 className="paper-title has-generated-heading"><HeadingArt name="talents" text="Talent constellations" /></h2>
          <span className="paper-rule" />
          <p className="talent-intro">Invest talent points in a star to unlock the stars it links to. Endless talents can keep ranking up.</p>
        </header>

        {earned !== undefined && (
          <section className="paper-card talent-earned" style={{ borderLeft: '5px solid #c46bff' }}>
            <div className="label">Make the next run stronger</div>
            <div className="font-cond text-2xl leading-tight text-[#d9a8ff]">+{earned} talent points earned this run</div>
            <p className="mt-1 text-xs text-[#8f8676]">Spend your permanent talent XP below. Run levels reset; these skills stay.</p>
          </section>
        )}

        <div className="talent-balance-row">
          <div className="talent-wallet" title="Talent points are earned at the end of every run (monsters, time survived, bosses and waves).">
            <CandyIcon size={26} />
            <div>
              <div className="label">Talent points</div>
              <b>{save.soul}</b>
            </div>
          </div>
        </div>

        <section className="paper-card talent-focus" style={{ borderLeft: `5px solid ${fc}` }}>
          <div className="talent-focus-head">
            <div className="talent-focus-art" style={{ borderColor: fst === 'maxed' ? '#ffc94d' : fst === 'locked' ? '#5b5670' : fc }}>
              <img src={icon(focus.id)} alt="" draggable={false} style={{ filter: fst === 'locked' ? 'grayscale(1) brightness(0.7)' : undefined }} />
            </div>
            <div className="min-w-0">
              <div className="label" style={{ color: fc }}>{TALENT_BRANCHES[focus.branch]} · {TALENT_BRANCH_SUB[focus.branch]}{focus.capstone ? focus.desc.startsWith('FINALE') ? ' · Finale' : ' · Capstone' : ''}</div>
              <div className="talent-focus-name">{focus.name}</div>
            </div>
          </div>
          <p className="talent-effect">{focus.desc}</p>
          {focus.endless && <p className="talent-endless">Endless talent: ranks continue beyond {focus.max}.</p>}
          <div className="mt-3 flex items-center gap-1.5">
            {Array.from({ length: focus.max }).map((_, k) => (
              <div key={k} className="talent-rank h-2.5 flex-1" style={{ background: k < fl ? fc : '#0f1518', borderColor: k < fl ? fc : undefined }} />
            ))}
          </div>
          <div className="talent-rank-meta">
            <span>{focus.endless && fl > focus.max ? `Rank ${fl} · ${fl - focus.max} past mastery` : `Rank ${fl} / ${focus.max}`}</span>
            {fst !== 'maxed' && <span className="text-[#d9a8ff]">Next: {talentCost(focus, fl)} talent points</span>}
          </div>
          {focus.premium && !hasFullGame() && <p role="status" className="mt-3 border border-[#ffc453]/50 bg-black/30 p-3 text-sm text-white">Full-game talent: unlock the full game using the button in the main-menu header. After unlocking, the linked talent requirements below still apply.</p>}
          {focus.req.length > 0 && (
            <div className="mt-2 font-cond2 text-[13px] font-semibold text-[#c9bda6]">
              Unlock by buying rank 1 in any one of:{' '}
              {focus.req.map((r) => (
                <span key={r} className={(ranks[r] || 0) > 0 ? 'mr-1.5 font-bold text-[#7CFF64]' : 'mr-1.5 font-bold text-[#ff6a5a]'}>{TALENT_BY_ID[r].name}</span>
              ))}
            </div>
          )}
          {fst !== 'locked' && fst !== 'maxed' && save.soul < talentCost(focus, fl) && <p className="mt-3 text-sm text-white">Earn {talentCost(focus, fl) - save.soul} more talent points by completing a run to buy the next rank.</p>}
          {focus.id === 'master' && <div className="mt-2 font-cond2 text-xs font-semibold text-[#c9bda6]">One costume per kid: {COSTUMES.map((c) => c.icon).join(' ')}</div>}
          <button className="hm-btn talent-invest w-full" disabled={!canBuy(focus)} onClick={() => buy(focus.id)}>
            {fst === 'maxed' ? 'Mastered' : focus.endless && fl >= focus.max && fst !== 'locked' ? `Rank up · ${talentCost(focus, fl)} talent points` : fst === 'locked' ? focus.premium && !hasFullGame() ? 'Full game required' : 'Buy a linked talent first' : `Invest · ${talentCost(focus, fl)} talent points`}
          </button>
          {focus.endless && fst !== 'locked' && affordableRanks(focus) > 1 && (
            <button className="hm-btn ghost mt-2 w-full" onClick={() => buy(focus.id, true)}>
              <ChevronsUp size={17} strokeWidth={2.8} /> Spend it all here · +{affordableRanks(focus)} ranks
            </button>
          )}
        </section>

        <div className="talent-branches">
          {TALENT_BRANCHES.map((b, i) => (
            <div key={b} className="paper-card !px-1 !py-2.5 text-center" style={{ borderTop: `4px solid ${TALENT_COLORS[i]}` }}>
              <div className="label" style={{ color: TALENT_COLORS[i] }}>{b}</div>
              <div className="font-cond text-3xl leading-none text-[#fff0da]">{spent(i)}</div>
              <div className="label !text-[9px]">{TALENT_BRANCH_SUB[i]}</div>
            </div>
          ))}
        </div>

        <details className="talent-guide">
          <summary>Tree guide</summary>
          <div><p><span className="talent-legend-ring" /> A pulsing ring means you can afford a rank.</p>
          <p><span className="talent-legend-path" /> A dashed path leads to an unlocked star.</p>
          <p><span className="talent-legend-ring talent-legend-ring--gold" /> A gold ring marks mastery.</p></div>
        </details>
        <button className="hm-btn ghost talent-refund" onClick={refund}><RotateCcw size={17} strokeWidth={2.6} /> Refund all points</button>
        </div>
        <footer className="talent-action-footer">
          <button className="hm-btn ghost" onClick={onBack}><ChevronLeft size={18} strokeWidth={3} /> {backLabel}</button>
          {onAgain && <button className="hm-btn talent-replay" onClick={onAgain}>Play again</button>}
        </footer>
      </aside>
    </div>
  );
}
