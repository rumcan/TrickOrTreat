"""Slice the built-in image generator's PNG masters into runtime UI parts.

No complete frame is resized to fit a panel. The runtime repeats the four edge
strips between fixed corners; heading pictures retain their natural proportions.
"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art/redesign/generated-v2'
OUTPUT = ROOT / 'public/images/generated-v2'
OUTPUT.mkdir(parents=True, exist_ok=True)

def save(name, image, trim=True):
    if trim:
        bounds = image.getchannel('A').point(lambda a: 255 if a > 5 else 0).getbbox()
        if bounds:
            image = image.crop(bounds)
    image.save(OUTPUT / (name + '.png'), optimize=True)
    return {'file': name + '.png', 'width': image.width, 'height': image.height}

ids = [
    'choose-kid', 'talents', 'trick-or-treat',
    'run-build', 'shop', 'how-to-play',
    'friends', 'controls', 'pick-treat',
    'boss-down', 'checkpoint', 'survived',
    'pinball-wizard', 'mixtape', 'eye-tiger',
]
headings = {}
desktop = Image.open(SOURCE / 'headings.png').convert('RGBA')
rows = [0, 150, 296, 430, 574, 724]
for index, name in enumerate(ids):
    column, row = index % 3, index // 3
    headings[name] = save('heading-' + name, desktop.crop((column * 724, rows[row], (column + 1) * 724, rows[row + 1])))

mobile = Image.open(SOURCE / 'headings-mobile.png').convert('RGBA')
rows = [0, 326, 636, 950, 1254]
for index, name in enumerate(ids[:6] + ['friends', 'pick-treat']):
    column, row = index % 2, index // 2
    headings[name]['mobile'] = save('heading-' + name + '-mobile', mobile.crop((column * 627, rows[row], (column + 1) * 627, rows[row + 1])))

frames = Image.open(SOURCE / 'frames.png').convert('RGBA')
for name, box in {
    'corner-tl': (96, 12, 352, 268), 'corner-tr': (904, 12, 1160, 268),
    'corner-bl': (96, 198, 352, 454), 'corner-br': (904, 198, 1160, 454),
}.items():
    part = frames.crop(box)
    if name.endswith(('bl', 'br')):
        # The sheet placed the lower corners below the upper ones. Clear the
        # unrelated pixels from the upper row while keeping this corner fixed.
        part.paste((0, 0, 0, 0), (0, 0, 256, 72))
    save(name, part, trim=False)

for name, box in {
    'edge-top': (80, 524, 304, 588),
    'edge-bottom': (394, 390, 534, 454),
    'edge-left': (729, 496, 793, 656),
    'edge-right': (1084, 496, 1148, 656),
}.items():
    save(name, frames.crop(box), trim=False)

for name, box in {
    'button-primary': (10, 735, 350, 887),
    'button-dark': (348, 738, 693, 885),
    'button-nav': (695, 764, 990, 860),
    'ink-tile': (1008, 700, 1226, 918),
    'card-green': (12, 902, 300, 1254),
    'card-purple': (338, 902, 626, 1254),
    'card-blue': (650, 902, 939, 1254),
    'card-orange': (949, 902, 1244, 1254),
}.items():
    save(name, frames.crop(box), trim=name != 'ink-tile')
save('button-paint-tile', frames.crop((150, 791, 214, 823)), trim=False)

(ROOT / 'src/ui/generated-art.json').write_text(json.dumps(headings, indent=2) + '\n', encoding='utf-8')
print(f'Prepared {len(headings)} desktop headings, 8 mobile headings and repeatable PNG frame parts.')
