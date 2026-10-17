"""Prepare the supplied Maple Falls design masters without changing the originals.

Run: python scripts/prepare-redesign-art.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art' / 'redesign'
OUTPUT = ROOT / 'public' / 'images' / 'redesign'
OUTPUT.mkdir(parents=True, exist_ok=True)

background = Image.open(SOURCE / 'street-background.png')
background.save(OUTPUT / 'street-background.webp', 'WEBP', quality=94, method=6)
# The supplied composition stays intact; mobile uses CSS cover to choose its crop.
print('Prepared supplied street-background.webp')

# Lift the supplied Level Up lettering from its reference panel. Only the
# near-black panel pixels become transparent; the original painted letters stay.
heading = Image.open(SOURCE / 'reference-levelup.png').convert('RGBA').crop((205, 151, 705, 285))
pixels = heading.load()
for y in range(heading.height):
    for x in range(heading.width):
        r, g, b, _ = pixels[x, y]
        alpha = max(0, min(255, (max(r, g, b) - 54) * 5))
        pixels[x, y] = (r, g, b, alpha)
heading.save(OUTPUT / 'heading-levelup.webp', 'WEBP', lossless=True, method=6)
