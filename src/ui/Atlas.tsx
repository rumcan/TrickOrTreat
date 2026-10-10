import { useMemo, useState } from 'react';
import { useBack } from './back';
import { ChevronLeft, Download, Copy, FileJson } from 'lucide-react';
import { allAssets, downloadAsset, manifestTemplate, AssetCategory, imgUrl } from '../game/assets';
import { KitButton, KitTitle } from './kit';

const CATS: { id: AssetCategory; name: string; note: string }[] = [
  { id: 'sheet', name: 'Characters & monsters', note: 'Sprite sheets: strict grids, frames left→right, rows top→bottom, feet on the anchor pixel in every frame. Left/right facing comes from flipping. Any whole-number multiple of the frame size works (e.g. 4× for AI art), and the frame count per row may change.' },
  { id: 'prop', name: 'Buildings & props', note: 'Drawn in the depth-sorted pass. The anchor pixel sits on the CENTRE of the footprint on the ground. Collision comes from the footprint, not the pixels. Hi-res files are fine: keep the same canvas proportions.' },
  { id: 'tile', name: 'Ground tiles', note: '128×64 isometric diamonds (2:1). Must tile seamlessly; transparent outside the diamond. Several variants per material are picked at random.' },
  { id: 'overlay', name: 'Edge overlays', note: 'Transparent 128×64 decals drawn on top of a base tile: curbs, grass fringes, road lines, crosswalks. Edge names: NE = y-1 neighbour, SE = x+1, SW = y+1, NW = x-1.' },
  { id: 'icon', name: 'Icons & pickups', note: 'Weapon icons double as the in-hand sprite (rotated around the grip pivot).' },
];

export function Atlas({ onBack }: { onBack: () => void }) {
  useBack(onBack);
  const [cat, setCat] = useState<AssetCategory>('sheet');
  const [copied, setCopied] = useState('');
  const assets = useMemo(() => allAssets(), []);
  const list = assets.filter((a) => a.spec.category === cat);
  const c = CATS.find((x) => x.id === cat)!;
  const files = assets.filter((a) => a.file).length;
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
    <div className="absolute inset-0 overflow-auto bg-[#0b0c10] text-[#f2e6c9]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <KitTitle className="text-4xl sm:text-5xl">Collection · Asset atlas</KitTitle>
            <div className="mt-2 max-w-3xl font-ui text-sm leading-relaxed text-[#9aa0a6]">
              Every graphic in the game at native size, with its exact spec and a ready-to-use AI prompt. <b className="text-[#f2e6c9]">{files}</b> of {assets.length} currently come from PNG files in{' '}
              <code className="text-[#ffc453]">public/assets/</code>; the rest are drawn procedurally at boot. Replace a PNG (any scale, sprite sheet or animated PNG) and reload. See <code className="text-[#ffc453]">ASSET_SPEC.md</code>.
            </div>
          </div>
          <div className="flex gap-2">
            <KitButton variant="dark" size="sm" icon={FileJson} iconColor="#ffc453" onClick={dlManifest}>manifest.json</KitButton>
            <KitButton variant="cream" size="sm" icon={ChevronLeft} onClick={onBack}>Back</KitButton>
          </div>
        </div>

        <div className="kit-panel mt-6 grid grid-cols-1 gap-4 p-4 font-ui text-[13px] leading-relaxed text-[#c9c1ad] md:grid-cols-3">
          <div><div className="mb-1 font-cond text-base uppercase text-[#fb8016]">Projection</div>2:1 dimetric ("isometric") like Diablo II / Commandos. 1 tile = 128×64 px diamond. Screen: sx=(x−y)·64, sy=(x+y)·32. A kid is ≈90 px tall, a one-storey house ≈ 92 px walls + 70 px roof.</div>
          <div><div className="mb-1 font-cond text-base uppercase text-[#fb8016]">Collision &amp; masks</div>A separate collision grid (4 cells per tile edge) marks walk-blocking and shot-blocking cells. Multi-tile props use footprint occlusion: the prop fades out and an x-ray silhouette of the kid shows through.</div>
          <div><div className="mb-1 font-cond text-base uppercase text-[#fb8016]">Lighting</div>Draw art at "neutral moonlit" exposure. The engine adds the darkness, the flashlight cone and warm point lights. Don't bake cast shadows into sprites; the engine draws them.</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {CATS.map((k) => (
            <KitButton key={k.id} size="sm" variant={cat === k.id ? 'orange' : 'dark'} onClick={() => setCat(k.id)}>
              {k.name} ({assets.filter((a) => a.spec.category === k.id).length})
            </KitButton>
          ))}
        </div>
        <div className="mt-3 font-ui text-sm text-[#9aa0a6]">{c.note}</div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map(({ spec, img, file, scale, w, h, anchor, rowFrames }) => {
            const dw = Math.min(w, 420), k = dw / w;
            return (
              <div key={spec.key} className="kit-panel flex flex-col gap-3 p-4 md:flex-row">
                <div className="flex max-h-[340px] min-w-[140px] items-center justify-center overflow-auto border border-[#2a2d33] p-2" style={{ backgroundImage: 'repeating-conic-gradient(#1c1b24 0% 25%, #15141c 0% 50%)', backgroundSize: '16px 16px' }}>
                  <div className="relative">
                    <img src={imgUrl(img)} alt={spec.key} style={{ width: dw, height: h * k, imageRendering: scale > 1 ? 'auto' : 'pixelated' }} />
                    {spec.anchor && <div className="absolute h-2 w-2 -translate-x-1 -translate-y-1 rounded-full border border-black bg-fuchsia-400" style={{ left: anchor[0] * k, top: anchor[1] * k }} title="anchor" />}
                  </div>
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-bold text-[#ffc453]">{spec.key}</code>
                    {file ? (
                      <span className="rounded-[3px] bg-[#5ea26b]/25 px-1.5 font-cond2 text-[11px] font-bold uppercase tracking-wide text-[#9ee6a8]" title={file}>PNG file{scale > 1 ? ` · ${scale}×` : ''}</span>
                    ) : (
                      <span className="rounded-[3px] bg-white/10 px-1.5 font-cond2 text-[11px] font-bold uppercase tracking-wide text-[#9aa0a6]">Procedural</span>
                    )}
                  </div>
                  <div className="mt-1 text-[#c9c1ad]">{spec.desc}</div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[#9aa0a6]">
                    <div>Size: <b className="text-white">{spec.w}×{spec.h}</b></div>
                    <div>File: <b className="break-all text-white">{file || spec.file}</b></div>
                    {spec.frameW && <div>Frame: <b className="text-white">{spec.frameW}×{spec.frameH}</b> · frames {rowFrames.join('/')}</div>}
                    {spec.anchor && <div>Anchor: <b className="text-fuchsia-300">({spec.anchor[0]}, {spec.anchor[1]})</b></div>}
                    {spec.footprint && <div>Footprint: <b className="text-white">{spec.footprint[0]}×{spec.footprint[1]} tiles</b></div>}
                  </div>
                  {spec.rows && <div className="mt-1 text-[#9aa0a6]">Rows: {spec.rows.map((r, i) => <span key={i} className="mr-2 text-[#e6dcc4]">{i}: {r}</span>)}</div>}
                  <div className="mt-2 border border-[#2a2d33] bg-black/40 p-2 text-[11px] leading-snug text-[#c9c1ad]">{spec.prompt}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <KitButton size="sm" variant="dark" icon={Copy} onClick={() => copy(spec.key, spec.prompt)}>{copied === spec.key ? 'Copied' : 'Prompt'}</KitButton>
                    <KitButton size="sm" variant="dark" icon={Download} iconColor="#fb8016" onClick={() => downloadAsset(spec.key, 1)}>PNG 1×</KitButton>
                    <KitButton size="sm" variant="dark" icon={Download} iconColor="#fb8016" onClick={() => downloadAsset(spec.key, 4)}>PNG 4×</KitButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
