import { useMemo, useState, useSyncExternalStore } from 'react';
import { expansion, hasFullGame } from '../game/expansion';
import { TALENTS, TALENT_BRANCHES, TALENT_BRANCH_SUB, TALENT_COLORS, TALENT_ROOT, TALENT_BY_ID, Talent, Save, storeSave, talentUnlocked, COSTUMES } from '../game/data';
import { makeRng } from '../game/config';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { KitButton, KitTitle, Chip } from './kit';
import { CandyIcon } from './common';

type NodeState = 'maxed' | 'owned' | 'available' | 'locked';

export function TalentTree({ save, onBack, onAgain, earned }: { save: Save; onBack: () => void; onAgain?: () => void; earned?: number }) {
  useSyncExternalStore(expansion.subscribe, expansion.snapshot, expansion.snapshot);
  const [, force] = useState(0);
  const [sel, setSel] = useState<string>('sharp');
  const [hover, setHover] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const ranks = save.talents;

  const stars = useMemo(() => {
    const r = makeRng(42);
    return Array.from({ length: 220 }, () => ({ x: r() * 1000, y: r() * 900, s: r() * 1.6 + 0.3, o: r() * 0.7 + 0.15, tw: r() * 4 + 2 }));
  }, []);

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

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto bg-[#0E1117] pt-14 text-[#F4E8D5] lg:flex-row">
      {/* ===== tree ===== */}
      <div className="relative min-h-[440px] flex-1 lg:min-h-0">
        <div className="absolute left-5 top-0 z-10">
          <KitTitle className="text-4xl">Talent constellations</KitTitle>
          <div className="font-cond2 text-xs font-semibold uppercase tracking-widest text-[#9aa3b8]">Click a star to invest Soul Candy · each star unlocks the stars it links to</div>
        </div>
        <svg viewBox="0 0 1000 900" preserveAspectRatio="xMidYMid meet" className="absolute inset-x-0 bottom-0 top-16 h-[calc(100%-4rem)] w-full select-none">
          <defs>
            <filter id="tglow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="tglow2" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {TALENT_COLORS.map((c, i) => (
              <radialGradient key={i} id={`neb${i}`}>
                <stop offset="0%" stopColor={c} stopOpacity="0.22" />
                <stop offset="100%" stopColor={c} stopOpacity="0" />
              </radialGradient>
            ))}
            <radialGradient id="nodeFill">
              <stop offset="0%" stopColor="#2a2040" />
              <stop offset="100%" stopColor="#0d0a16" />
            </radialGradient>
          </defs>
          {/* nebulae per branch */}
          <ellipse cx="290" cy="220" rx="300" ry="260" fill="url(#neb0)" />
          <ellipse cx="710" cy="220" rx="300" ry="260" fill="url(#neb1)" />
          <ellipse cx="500" cy="720" rx="340" ry="220" fill="url(#neb2)" />
          {/* stars */}
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#dfe6ff" opacity={s.o}>
              <animate attributeName="opacity" values={`${s.o};${s.o * 0.25};${s.o}`} dur={`${s.tw}s`} repeatCount="indefinite" />
            </circle>
          ))}
          {/* outer rings */}
          <circle cx={TALENT_ROOT.x} cy={TALENT_ROOT.y} r="120" fill="none" stroke="rgba(255,170,80,0.08)" strokeWidth="1" />
          <circle cx={TALENT_ROOT.x} cy={TALENT_ROOT.y} r="300" fill="none" stroke="rgba(255,170,80,0.06)" strokeWidth="1" strokeDasharray="2 8" />
          <circle cx={TALENT_ROOT.x} cy={TALENT_ROOT.y} r="420" fill="none" stroke="rgba(255,170,80,0.05)" strokeWidth="1" strokeDasharray="2 10" />

          {/* branch titles */}
          {[
            { b: 0, x: 95, y: 420 },
            { b: 1, x: 905, y: 420 },
            { b: 2, x: 830, y: 860 },
          ].map(({ b, x, y }) => (
            <g key={b} textAnchor="middle">
              <text x={x} y={y} fill={TALENT_COLORS[b]} opacity="0.85" fontSize="26" fontWeight="900" style={{ fontFamily: 'Impact, system-ui', letterSpacing: 2 }}>{TALENT_BRANCHES[b].toUpperCase()}</text>
              <text x={x} y={y + 20} fill="#9aa3b8" fontSize="12" fontWeight="700" style={{ letterSpacing: 4 }}>{TALENT_BRANCH_SUB[b].toUpperCase()} · {spent(b)} PTS</text>
            </g>
          ))}

          {/* edges */}
          {edges.map((e, i) => (
            <g key={i}>
              {e.lit && <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={TALENT_COLORS[e.b]} strokeWidth="7" opacity="0.25" filter="url(#tglow)" />}
              <line
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke={e.lit ? TALENT_COLORS[e.b] : e.open ? TALENT_COLORS[e.b] : '#3a3550'}
                strokeOpacity={e.lit ? 1 : e.open ? 0.55 : 0.6}
                strokeWidth={e.lit ? 3 : 2}
                strokeDasharray={e.lit ? undefined : e.open ? '6 6' : '2 6'}
              >
                {e.open && !e.lit && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1.2s" repeatCount="indefinite" />}
              </line>
            </g>
          ))}

          {/* root */}
          <g filter="url(#tglow2)">
            <circle cx={TALENT_ROOT.x} cy={TALENT_ROOT.y} r="50" fill="url(#nodeFill)" stroke="#ffb347" strokeWidth="3" />
            <circle cx={TALENT_ROOT.x} cy={TALENT_ROOT.y} r="58" fill="none" stroke="#ffb347" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="4 4">
              <animateTransform attributeName="transform" type="rotate" from={`0 ${TALENT_ROOT.x} ${TALENT_ROOT.y}`} to={`360 ${TALENT_ROOT.x} ${TALENT_ROOT.y}`} dur="30s" repeatCount="indefinite" />
            </circle>
          </g>
          <text x={TALENT_ROOT.x} y={TALENT_ROOT.y + 13} textAnchor="middle" fontSize="38">🎃</text>
          <text x={TALENT_ROOT.x} y={TALENT_ROOT.y + 76} textAnchor="middle" fill="#ffcf8a" fontSize="12" fontWeight="900" style={{ letterSpacing: 2 }}>TRICK-OR-TREATER</text>

          {/* nodes */}
          {TALENTS.map((t) => {
            const st = stateOf(t);
            const l = ranks[t.id] || 0;
            const c = TALENT_COLORS[t.branch];
            const R = t.capstone ? 38 : 29;
            const active = st === 'maxed' || st === 'owned';
            const affordable = canBuy(t);
            const isSel = sel === t.id;
            return (
              <g
                key={t.id}
                style={{ cursor: st === 'locked' ? 'not-allowed' : 'pointer' }}
                onMouseEnter={() => setHover(t.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => { setSel(t.id); buy(t.id); }}
              >
                {active && <circle cx={t.x} cy={t.y} r={R + 10} fill={c} opacity="0.18" filter="url(#tglow)" />}
                {affordable && (
                  <circle cx={t.x} cy={t.y} r={R + 6} fill="none" stroke={c} strokeWidth="2">
                    <animate attributeName="r" values={`${R + 4};${R + 12};${R + 4}`} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                {t.capstone ? (
                  <polygon
                    points={Array.from({ length: 8 }, (_, k) => {
                      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
                      return `${t.x + Math.cos(a) * (R + 4)},${t.y + Math.sin(a) * (R + 4)}`;
                    }).join(' ')}
                    fill="url(#nodeFill)"
                    stroke={st === 'locked' ? '#3a3550' : c}
                    strokeWidth={active ? 3.5 : 2}
                    filter={active ? 'url(#tglow2)' : undefined}
                  />
                ) : (
                  <circle cx={t.x} cy={t.y} r={R} fill="url(#nodeFill)" stroke={st === 'locked' ? '#3a3550' : c} strokeWidth={active ? 3.5 : 2} filter={active ? 'url(#tglow2)' : undefined} />
                )}
                {isSel && <circle cx={t.x} cy={t.y} r={R + 16} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="3 5" />}
                {flash === t.id && (
                  <circle cx={t.x} cy={t.y} r={R} fill="none" stroke="#fff" strokeWidth="4">
                    <animate attributeName="r" from={`${R}`} to={`${R + 40}`} dur="0.45s" fill="freeze" />
                    <animate attributeName="opacity" from="1" to="0" dur="0.45s" fill="freeze" />
                  </circle>
                )}
                <text x={t.x} y={t.y + (t.capstone ? 11 : 9)} textAnchor="middle" fontSize={t.capstone ? 30 : 24} opacity={st === 'locked' ? 0.3 : 1} style={{ filter: st === 'locked' ? 'grayscale(1)' : undefined }}>{t.icon}</text>
                {/* rank pips */}
                {Array.from({ length: t.max }).map((_, k) => {
                  const span = Math.min(Math.PI * 0.9, t.max * 0.32);
                  const a = Math.PI / 2 + (t.max === 1 ? 0 : (k / (t.max - 1) - 0.5) * span);
                  return <circle key={k} cx={t.x + Math.cos(a) * (R + 9)} cy={t.y + Math.sin(a) * (R + 9)} r="3.6" fill={k < l ? c : '#1a1626'} stroke={st === 'locked' ? '#3a3550' : c} strokeWidth="1.2" />;
                })}
                <text x={t.x} y={t.y - R - 10} textAnchor="middle" fill={st === 'locked' ? '#5a5570' : '#e8e4f4'} fontSize="11.5" fontWeight="800" style={{ paintOrder: 'stroke', stroke: '#05040b', strokeWidth: 4 }}>{t.name}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ===== side panel ===== */}
      <div className="relative z-10 flex w-full shrink-0 flex-col gap-4 border-t border-[#3a3f4d] bg-[#0e0f13]/95 p-5 lg:w-[340px] lg:border-l lg:border-t-0">
        {earned !== undefined && <section className="kit-panel p-3"><KitTitle className="text-2xl">Make the next run stronger</KitTitle><p className="mt-1 text-sm text-[#b98aff]">+{earned} Soul Candy earned this run</p><p className="text-xs text-[#9aa0a6]">Spend your permanent talent XP below. Run levels reset; these skills stay.</p></section>}
        <div className="flex items-center justify-between">
          <Chip icon={<CandyIcon size={22} />} className="!text-2xl" color="#b98aff">{save.soul}</Chip>
          <KitButton variant="cream" size="sm" icon={ChevronLeft} onClick={onBack}>Back</KitButton>
        </div>
        {onAgain && <KitButton onClick={onAgain}>Play again with these talents</KitButton>}
        <div className="font-cond2 text-[12px] font-semibold text-[#9aa0a6]">Soul Candy is earned at the end of every run (kills, time survived, boss).</div>

        <div className="kit-panel p-4" style={{ borderColor: TALENT_COLORS[focus.branch], boxShadow: `0 0 0 1px #000, 0 0 30px ${TALENT_COLORS[focus.branch]}22` }}>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[6px] border-2 bg-[#0E1117] text-3xl" style={{ borderColor: TALENT_COLORS[focus.branch] }}>{focus.icon}</div>
            <div>
              <div className="font-cond text-lg uppercase leading-tight text-[#F4E8D5]">{focus.name}</div>
              <div className="font-cond2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: TALENT_COLORS[focus.branch] }}>
                {TALENT_BRANCHES[focus.branch]} {focus.capstone && '· Capstone'}
              </div>
            </div>
          </div>
          <div className="mt-3 text-sm text-[#F4E8D5]/90">{focus.desc}</div>
          <div className="mt-3 flex items-center gap-1">
            {Array.from({ length: focus.max }).map((_, k) => (
              <div key={k} className="h-2 flex-1 rounded-sm" style={{ background: k < fl ? TALENT_COLORS[focus.branch] : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
          <div className="mt-1 text-xs text-slate-400">Rank {fl} / {focus.max}</div>
          {focus.premium && !hasFullGame() && <p role="status" className="mt-3 rounded border border-[#ffc453]/40 bg-black/30 p-3 text-sm text-white">Full-game talent: unlock Hide & Shriek using the button in the main-menu header. After unlocking, the linked talent requirements below still apply.</p>}
          {focus.req.length > 0 && (
            <div className="mt-2 font-cond2 text-xs font-semibold text-[#9aa3b8]">
              Unlock by buying rank 1 in any one of:{' '}
              {focus.req.map((r) => (
                <span key={r} className={(ranks[r] || 0) > 0 ? 'mr-1 font-bold text-[#7CFF64]' : 'mr-1 font-bold text-[#E63946]'}>{TALENT_BY_ID[r].name}</span>
              ))}
            </div>
          )}
          {fst !== 'locked' && fst !== 'maxed' && save.soul < focus.cost(fl) && <p className="mt-3 text-sm text-white">Earn {focus.cost(fl) - save.soul} more essence by completing a run to buy the next rank.</p>}
          {focus.id === 'master' && <div className="mt-2 font-cond2 text-[11px] font-semibold text-[#9aa3b8]">Costumes: {COSTUMES.map((c) => c.icon).join(' ')}</div>}
          <KitButton disabled={!canBuy(focus)} onClick={() => buy(focus.id)} className="mt-4 w-full">
            {fst === 'maxed' ? 'Mastered' : fst === 'locked' ? focus.premium && !hasFullGame() ? 'Full game required' : 'Buy a linked talent first' : `Invest · 🍬 ${focus.cost(fl)}`}
          </KitButton>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {TALENT_BRANCHES.map((b, i) => (
            <div key={b} className="kit-tile p-2">
              <div className="font-cond2 text-[10px] font-bold uppercase tracking-wider" style={{ color: TALENT_COLORS[i] }}>{b}</div>
              <div className="font-cond text-xl text-[#F4E8D5]">{spent(i)}</div>
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2 font-cond2 text-[11px] font-semibold text-[#5a6070]">
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full border-2 border-[#F9781B]" /> Pulsing ring = you can afford it</div>
          <div className="flex items-center gap-2"><span className="inline-block h-0 w-6 border-t-2 border-dashed border-[#4fb3ff]" /> Dashed path = unlocked, not bought</div>
          <KitButton variant="dark" size="sm" icon={RotateCcw} onClick={refund}>Refund all points</KitButton>
        </div>
      </div>
    </div>
  );
}
