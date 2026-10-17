"""Crop generated masters without resampling. Borders repeat at runtime."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/redesign/generated-v3'
OUTPUT = ROOT / 'public/images/generated-v3'
OUTPUT.mkdir(parents=True, exist_ok=True)

def trim(image):
    bounds = image.getchannel('A').point(lambda a: 255 if a > 10 else 0).getbbox()
    return image.crop(bounds) if bounds else image

sheet = Image.open(SOURCE / 'notifications.png').convert('RGBA')
rows = [0, 280, 524, 768, 1024]
names = ['weapon', 'died', 'level', 'tot', 'mission', 'boss', 'survived', 'map']
for index, name in enumerate(names):
    row, column = divmod(index, 2)
    image = trim(sheet.crop((column * 768, rows[row], (column + 1) * 768, rows[row + 1])))
    image.save(OUTPUT / f'notice-{name}.png', optimize=True)

sheet = Image.open(SOURCE / 'buttons.png').convert('RGBA')
for name, box in [('amber', (0, 0, 1916, 280)), ('muted', (0, 280, 1916, 540)), ('danger', (0, 540, 1916, 821))]:
    trim(sheet.crop(box)).save(OUTPUT / f'button-{name}.png', optimize=True)
print('Prepared eight illustrated announcements, eight event emblems and three transparent repeating button borders.')

# Dedicated emblem sheet contains no lettering, including dynamic notices.
sheet = Image.open(SOURCE / 'emblems.png').convert('RGBA')
for index, name in enumerate(names):
    row, column = divmod(index, 4)
    cw, ch = sheet.width // 4, sheet.height // 2
    trim(sheet.crop((column*cw, row*ch, (column+1)*cw, (row+1)*ch))).save(OUTPUT / f'emblem-{name}.png', optimize=True)

# The menu rows come directly from the original full-screen composition.
from PIL import ImageDraw
sheet = Image.open(ROOT / 'art/redesign/reference-title.png').convert('RGBA')
boxes = {'play': (39,117,298,167), 'records': (39,169,267,218), 'talents': (39,220,267,269), 'character': (39,270,267,320), 'howto': (39,321,267,372), 'settings': (39,373,267,422), 'fullscreen': (39,424,267,473)}
for name, box in boxes.items():
    part = sheet.crop(box)
    mask = Image.new('L', part.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((1,1,part.width-2,part.height-2), radius=7, fill=255)
    part.putalpha(mask)
    part.save(OUTPUT / f'nav-reference-{name}.png', optimize=True)
trim(Image.open(SOURCE / 'button-go-reference.png').convert('RGBA')).save(OUTPUT / 'button-go-reference.png', optimize=True)

# Original painted HUD section labels; keep their colour pixels and discard ink.
sheet = Image.open(ROOT / 'art/redesign/reference-gameplay.png').convert('RGBA')
for name, box in {'treats': (15,97,76,124), 'synergy': (14,640,79,668), 'friends': (13,846,79,876)}.items():
    part = sheet.crop(box)
    part.putdata([(r,g,b,255 if r > 90 and g > 35 and r > b * 1.6 else 0) for r,g,b,a in part.getdata()])
    part.save(OUTPUT / f'rail-{name}.png', optimize=True)
