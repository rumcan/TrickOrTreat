"""Slice the supplied, transparent redesign sheets without repainting their artwork."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art' / 'redesign'
OUTPUT = ROOT / 'public' / 'images' / 'redesign'
OUTPUT.mkdir(parents=True, exist_ok=True)

SHEETS = {name: Image.open(SOURCE / f'{name}.png').convert('RGBA') for name in ['pause-settings-sheet', 'menu-sheet']}

def sprite(sheet, name, box, trim=True):
    art = SHEETS[sheet].crop(box)
    if trim:
        bounds = art.getchannel('A').point(lambda alpha: 255 if alpha > 3 else 0).getbbox()
        if bounds:
            art = art.crop(bounds)
    art.save(OUTPUT / f'{name}.webp', 'WEBP', lossless=True, method=6)
    print(f'{name}: {art.width} x {art.height}')

for name, box in {
    'pause-frame': (0, 0, 839, 545),
    'settings-frame': (840, 0, 1672, 546),
    'button-selected': (6, 545, 770, 693),
    'button-primary': (773, 548, 1190, 685),
    'button-danger': (1203, 548, 1662, 687),
    'heading-pause': (3, 696, 728, 941),
    'heading-settings': (735, 697, 1204, 941),
    'button-close': (1194, 699, 1330, 841),
    'button-resume': (1329, 677, 1638, 754),
    'button-confirm': (1330, 749, 1638, 828),
    'button-reset': (1322, 826, 1648, 928),
}.items():
    sprite('pause-settings-sheet', name, box)

for name, box in {
    'nav-play': (8, 0, 372, 80),
    'nav-records': (8, 80, 372, 146),
    'nav-talents': (8, 146, 372, 213),
    'nav-character': (8, 213, 372, 280),
    'nav-howto': (8, 280, 372, 347),
    'nav-settings': (8, 347, 372, 413),
    'nav-fullscreen': (8, 413, 372, 480),
    'button-go': (376, 0, 779, 94),
    'button-dark': (1073, 897, 1298, 950),
    'card-orange': (890, 485, 1050, 727),
    'card-purple': (1051, 485, 1208, 727),
    'card-common': (1209, 485, 1362, 727),
    'card-blue': (1363, 485, 1536, 727),
    'small-frame-orange': (6, 726, 345, 887),
    'small-frame-taped': (345, 726, 633, 888),
    'small-frame-simple': (633, 726, 866, 887),
    'small-frame-leaves': (868, 725, 1082, 888),
    'autumn-foliage': (1137, 252, 1380, 385),
    'pumpkin-decoration': (1022, 313, 1141, 425),
    'texture-ink': (1225, 515, 1342, 694),
}.items():
    sprite('menu-sheet', name, box)
