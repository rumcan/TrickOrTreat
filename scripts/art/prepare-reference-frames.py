"""Cut fixed-size corners and clean, repeatable edge tiles from supplied frames."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/images/redesign'
for family in ['pause', 'settings']:
    im = Image.open(OUT / f'{family}-frame.webp').convert('RGBA')
    w, h = im.size
    boxes = {
        'tl': (0, 0, 128, 128), 'tr': (w-128, 0, w, 128),
        'bl': (0, h-128, 128, h), 'br': (w-128, h-128, w, h),
        'top': (160, 30, 224, 48), 'bottom': (160, h-40, 224, h-22),
        'left': (10, 220, 28, 284), 'right': (w-26, 220, w-8, 284),
    }
    for part, box in boxes.items():
        im.crop(box).save(OUT / f'{family}-part-{part}.webp', 'WEBP', lossless=True, method=6)
    # A square 3x3 atlas keeps all corner pixels fixed. Only the clean middle
    # 64px strips repeat; they stop at the corner, without protruding past it.
    atlas = Image.new('RGBA', (320, 320))
    for part, point in [('tl',(0,0)),('tr',(192,0)),('bl',(0,192)),('br',(192,192))]:
        corner = im.crop(boxes[part])
        pixels = corner.load()
        for y in range(128):
            for x in range(128):
                u = 127-x if part.endswith('r') else x
                v = 127-y if part.startswith('b') else y
                fade = min(1, (127-u)/24) if v > 55 else 1
                if u > 30: fade = min(fade, min(1, (127-v)/24))
                r,g,b,a = pixels[x,y]
                pixels[x,y] = (r,g,b,round(a*max(0,fade)))
        atlas.paste(corner, point)
    for part, point in [('top',(128,30)),('bottom',(128,280)),('left',(10,128)),('right',(294,128))]:
        atlas.paste(im.crop(boxes[part]),point)
    atlas.save(OUT / f'{family}-frame-atlas.webp','WEBP',lossless=True,method=6)
print('Prepared fixed corners and repeatable frame edges.')
