import { useMemo, useState } from 'react';
import { allAssets, downloadAsset, manifestTemplate, AssetCategory } from '../game/assets';
import { imgUrl, Btn } from './common';

const CATS: { id: AssetCategory; name: string; note: string }[] = [
  { id: 'tile', name: 'Ground tiles', note: '128×64 isometric diamonds (2:1). Must tile seamlessly; transparent outside the diamond. Several variants per material are picked at random.' },
  { id: 'overlay', name: 'Edge overlays', note: 'Transparent 128×64 decals drawn on top of a base tile: curbs (sidewalk→road), grass fringes, road centre lines, crosswalks. Edge names: NE = y-1 neighbour, SE = x+1, SW = y+1, NW = x-1.' },
  { id: 'prop', name: 'Props / buildings', note: 'Tall objects drawn in the depth-sorted pass. The anchor pixel sits on the CENTRE of the footprint on the ground. Collision comes from the footprint, NOT the pixels.' },
  { id: 'sheet', name: 'Sprite sheets', note: 'Strict grids; left→right frames, top→bottom rows. Feet on the anchor pixel in every frame. Left/right facing is produced by horizontal flipping.' },
  { id: 'icon', name: 'Icons & pickups', note: 'Weapon icons double as the in-hand sprite (rotated around the grip pivot).' },
];

export function Atlas({ onBack }: { onBack: () => void }) {
  const [cat, setCat] = useState<AssetCategory>('tile');
  const [copied, setCopied] = useState('');
  const assets = useMemo(() => allAssets(), []);
  const list = assets.filter((a) => a.spec.category === cat);
  const c = CATS.find((x) => x.id === cat)!;
  const copy = (k: string, t: string) => {
    navigator.clipboard?.writeText(t);
    setCopied(k);
    setTimeout(() => setCopied(''), 1200);
  };
  const dlManifest = () => {
    const a = document.createElement('a');
    a.href = 'data:application/json,' + encodeURIComponent(manifestTemplate());
    a.download = 'manifest.json';
    a.click();
  };
  return (
    <div className="absolute inset-0 overflow-auto bg-[#0a0812] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-cond text-5xl uppercase text-[#F9781B]" style={{ textShadow: '3px 3px 0 #000' }}>Asset Atlas · Collection</h2>
            <div className="mt-2 max-w-3xl text-sm text-slate-400">
              Every graphic in the game is listed here at native size, with its exact spec and a ready-to-use AI generation prompt. All of these are currently drawn procedurally at boot.
              To replace one, export or generate a <b className="text-orange-200">.webp</b> at the exact size, put it in <code className="text-orange-200">public/assets/&lt;file&gt;</code> and add its key to <code className="text-orange-200">public/assets/manifest.json</code>. It's picked up automatically on the next load.
            </div>
          </div>
          <div className="flex gap-2">
            <Btn variant="dark" onClick={dlManifest}>⬇ manifest.json template</Btn>
            <Btn onClick={onBack}>Back</Btn>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-slate-300 md:grid-cols-3">
          <div><div className="mb-1 font-black text-orange-300">Projection</div>2:1 dimetric ("isometric") like Diablo II / Commandos. World unit = 1 tile = 128×64 px diamond. Screen: sx=(x−y)·64, sy=(x+y)·32. A kid is ≈90 px tall (≈0.7 tile), a one-storey house ≈ 92 px walls + 70 px roof.</div>
          <div><div className="mb-1 font-black text-orange-300">Collision &amp; masks</div>A separate collision grid (4 cells per tile edge) marks walk-blocking (fences, hedges, graves) and shot-blocking (houses, trunks) cells. Multi-tile props use footprint occlusion: anything standing behind the footprint is drawn first, the prop fades out, and an x-ray silhouette of the kid shows through.</div>
          <div><div className="mb-1 font-black text-orange-300">Lighting</div>Draw art at "neutral moonlit" exposure. The engine adds the darkness layer, the kid's flashlight cone, and warm point lights (windows, porches, lamps, pumpkins). Don't bake strong cast shadows into sprites; the engine draws them.</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {CATS.map((k) => (
            <button key={k.id} onClick={() => setCat(k.id)} className={`kit-clip border-2 px-4 py-2 font-cond text-sm uppercase tracking-wide transition ${cat === k.id ? 'border-black bg-[#F9781B] text-black shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]' : 'border-[#3a3f4d] bg-[#171b24] text-[#9aa3b8] hover:text-[#F9781B]'}`}>
              {k.name} ({assets.filter((a) => a.spec.category === k.id).length})
            </button>
          ))}
        </div>
        <div className="mt-3 text-sm text-slate-400">{c.note}</div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map(({ spec, img, overridden }) => (
            <div key={spec.key} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#120d1c] p-4 md:flex-row">
              <div className="flex max-h-[340px] min-w-[140px] items-center justify-center overflow-auto rounded-lg border border-white/10 p-2" style={{ backgroundImage: 'repeating-conic-gradient(#1c1828 0% 25%, #15121f 0% 50%)', backgroundSize: '16px 16px' }}>
                <div className="relative">
                  <img src={imgUrl(img)} alt={spec.key} style={{ width: Math.min(img.width, 420), imageRendering: 'pixelated' }} />
                  {spec.anchor && (
                    <div className="absolute h-2 w-2 -translate-x-1 -translate-y-1 rounded-full border border-black bg-fuchsia-400" style={{ left: (spec.anchor[0] * Math.min(img.width, 420)) / img.width, top: (spec.anchor[1] * Math.min(img.width, 420)) / img.width }} title="anchor" />
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="flex items-center gap-2">
                  <code className="font-black text-orange-200">{spec.key}</code>
                  {overridden && <span className="rounded bg-green-600/30 px-1.5 text-[10px] font-black text-green-300">WEBP OVERRIDE</span>}
                </div>
                <div className="mt-1 text-slate-300">{spec.desc}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-400">
                  <div>Size: <b className="text-white">{spec.w}×{spec.h}</b></div>
                  <div>File: <b className="break-all text-white">{spec.file}</b></div>
                  {spec.frameW && <div>Frame: <b className="text-white">{spec.frameW}×{spec.frameH}</b> × {spec.frames}</div>}
                  {spec.anchor && <div>Anchor: <b className="text-fuchsia-300">({spec.anchor[0]}, {spec.anchor[1]})</b></div>}
                  {spec.footprint && <div>Footprint: <b className="text-white">{spec.footprint[0]}×{spec.footprint[1]} tiles</b></div>}
                </div>
                {spec.rows && <div className="mt-1 text-slate-400">Rows: {spec.rows.map((r, i) => <span key={i} className="mr-2 text-slate-200">{i}: {r}</span>)}</div>}
                <div className="mt-2 rounded-lg bg-black/50 p-2 text-[11px] leading-snug text-slate-300">{spec.prompt}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => copy(spec.key, spec.prompt)} className="rounded border border-white/15 px-2 py-1 font-bold hover:bg-white/10">{copied === spec.key ? '✓ Copied' : 'Copy prompt'}</button>
                  <button onClick={() => downloadAsset(spec.key)} className="rounded border border-orange-400/40 px-2 py-1 font-bold text-orange-200 hover:bg-orange-500/10">⬇ Export .webp template</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
