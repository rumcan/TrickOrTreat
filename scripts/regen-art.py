# Regenerates every Asset Atlas graphic with `rundot generate image`, in the look of art/reference/style-target.webp.
#
#   npm run dev                          # another terminal (only needed when art/regen/specs.json is missing)
#   python scripts/regen-art.py [--only key1,key2] [--cat sheet,prop,...] [--workers 3] [--force] [--no-apply]
#
# For each asset the generator gets two reference images:
#   1. art/reference/style-target.webp   the look (palette, lighting, painting style)
#   2. its current procedural render     the layout (exact canvas, frame grid, anchor, silhouette sizes), padded to
#                                        the nearest supported aspect ratio so the result maps back pixel for pixel
# Results: art/regen/raw/<key>.png (as generated, resumable: existing files are skipped unless --force), then fitted to
# the spec canvas at SCALE x and written to public/assets/<file> + registered in public/assets/manifest.json.
# Ground tiles and edge overlays are cut with the procedural alpha (diamond / decal shape) instead of background removal.
import argparse, base64, io, json, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REGEN = ROOT / 'art/regen'
STYLE = ROOT / 'art/reference/style-target.webp'
SCALE = 2  # whole-number scale written to public/assets (manifest maxScale is 2)
RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']

STYLE_TEXT = (
    'STYLE: match reference image 1 exactly - the same rich hand-painted, detailed painterly game art as that Halloween '
    'isometric ARPG screenshot: moody night, cold blue moonlight, warm orange glows from pumpkins and windows, autumn '
    'reds and oranges, soft painted shading with a clean dark outline. Ignore any "pixel art" wording above: paint it '
    'like reference 1. LAYOUT: reference image 2 is a placeholder of THIS asset - keep its exact canvas, composition, '
    'object positions, sizes, camera angle and (for sprite sheets) the exact frame grid and pose per frame; only '
    'replace its flat placeholder rendering with the reference-1 style. Single asset only, no text, no UI, no frame '
    'borders, no scenery or ground beyond what reference 2 shows.'
)
NEGATIVE = 'text, watermark, UI, HUD, border, frame lines, extra characters, background scenery, cast shadow, photo'

lock = threading.Lock()
def log(msg):
    with lock:
        line = time.strftime('%H:%M:%S ') + msg
        print(line, flush=True)
        with open(REGEN / 'log.txt', 'a', encoding='utf-8') as f:
            f.write(line + '\n')

def nearest_ratio(w, h):
    r = w / h
    return min(RATIOS, key=lambda s: abs(__import__('math').log(r / (int(s.split(':')[0]) / int(s.split(':')[1])))))

def padded_box(w, h, ratio):
    """canvas (W, H) of the given ratio that holds w x h centred, and the offset of the asset inside it"""
    a, b = map(int, ratio.split(':'))
    W, H = (w, round(w * b / a)) if w / h >= a / b else (round(h * a / b), h)
    W, H = max(W, w), max(H, h)
    return W, H, (W - w) // 2, (H - h) // 2

def layout_ref(spec, render):
    W, H, ox, oy = padded_box(spec['w'], spec['h'], spec['ratio'])
    canvas = Image.new('RGBA', (W, H), (255, 0, 255, 0))
    canvas.paste(render, (ox, oy), render)
    k = max(1, 1024 // max(W, H))
    canvas = canvas.resize((W * k, H * k), Image.NEAREST)
    bg = Image.new('RGBA', canvas.size, (40, 40, 48, 255))  # dark neutral so the placeholder silhouette reads
    bg.alpha_composite(canvas)
    out = REGEN / 'layout' / f"{spec['key']}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    bg.convert('RGB').save(out)
    return out

def generate(spec, render, force):
    raw = REGEN / 'raw' / f"{spec['key']}.png"
    if raw.exists() and not force:
        return raw
    raw.parent.mkdir(parents=True, exist_ok=True)
    cut = spec['category'] in ('tile', 'overlay')
    cmd = ['rundot', 'generate', 'image', '--prompt', spec['prompt'] + '\n\n' + STYLE_TEXT,
           '--negative-prompt', NEGATIVE, '--aspect-ratio', spec['ratio'],
           '--reference-image', str(STYLE), '--reference-image', str(layout_ref(spec, render)),
           '--out', str(raw)]
    if not cut:
        cmd += ['--remove-background', '--remove-background-model', 'birefnet']
    for attempt in range(3):
        p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if p.returncode == 0 and raw.exists():
            return raw
        log(f"  retry {spec['key']} ({attempt + 1}): {(p.stderr or p.stdout).strip().splitlines()[-1:]}")
        time.sleep(10)
    raise RuntimeError('generation failed')

def fit(spec, render, raw):
    w, h = spec['w'], spec['h']
    W, H, ox, oy = padded_box(w, h, spec['ratio'])
    img = Image.open(raw).convert('RGBA').resize((W * SCALE, H * SCALE), Image.LANCZOS)
    img = img.crop((ox * SCALE, oy * SCALE, (ox + w) * SCALE, (oy + h) * SCALE))
    if spec['category'] in ('tile', 'overlay'):
        mask = render.getchannel('A').resize(img.size, Image.LANCZOS)
        img.putalpha(mask)
    dest = ROOT / 'public/assets' / spec['file']
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, optimize=True)
    return dest

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--cat', default='')
    ap.add_argument('--workers', type=int, default=3)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--no-apply', action='store_true')
    a = ap.parse_args()

    REGEN.mkdir(parents=True, exist_ok=True)
    specs_path = REGEN / 'specs.json'
    if not specs_path.exists():
        subprocess.run(['node', 'scripts/regen-art-dump.mjs'], cwd=ROOT, check=True)
    specs = json.loads(specs_path.read_text(encoding='utf-8'))
    if a.only:
        keep = set(a.only.split(','))
        specs = [s for s in specs if s['key'] in keep]
    if a.cat:
        keep = set(a.cat.split(','))
        specs = [s for s in specs if s['category'] in keep]
    # sheets first (characters & monsters matter most), then buildings, icons, tiles, overlays
    order = {'sheet': 0, 'prop': 1, 'icon': 2, 'tile': 3, 'overlay': 4}
    specs.sort(key=lambda s: order.get(s['category'], 9))
    log(f'regen start: {len(specs)} assets, workers={a.workers}')

    manifest_path = ROOT / 'public/assets/manifest.json'
    done, failed = [], []

    def one(spec):
        spec['ratio'] = nearest_ratio(spec['w'], spec['h'])
        render = Image.open(io.BytesIO(base64.b64decode(spec['render']))).convert('RGBA')
        try:
            raw = generate(spec, render, a.force)
            if not a.no_apply:
                fit(spec, render, raw)
                with lock:
                    m = json.loads(manifest_path.read_text(encoding='utf-8'))
                    m.setdefault('overrides', {})[spec['key']] = spec['file']
                    manifest_path.write_text(json.dumps(m, indent=2) + '\n', encoding='utf-8')
            done.append(spec['key'])
            log(f"ok   {spec['key']}  ({len(done) + len(failed)}/{len(specs)})")
        except Exception as e:  # keep going; rerun the script to retry the failures
            failed.append(spec['key'])
            log(f"FAIL {spec['key']}: {e}")

    with ThreadPoolExecutor(a.workers) as ex:
        list(ex.map(one, specs))
    log(f'regen done: {len(done)} ok, {len(failed)} failed' + (f": {','.join(failed)}" if failed else ''))
    sys.exit(1 if failed else 0)

if __name__ == '__main__':
    main()
