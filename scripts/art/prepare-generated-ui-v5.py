"""Prepare generated UI masters for repeating CSS borders and natural-size headings."""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/redesign/generated-v5'
OUTPUT = ROOT / 'public/images/generated-v5'


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    button = Image.open(SOURCE / 'button-blank.png').convert('RGBA')
    button.crop((80, 120, 2100, 550)).save(OUTPUT / 'button-rim.png')
    quarter = button.crop((1000, 260, 1096, 356))
    strip = Image.new('RGBA', (192, 96))
    strip.paste(quarter, (0, 0))
    strip.paste(ImageOps.mirror(quarter), (96, 0))
    tile = Image.new('RGBA', (192, 192))
    tile.paste(strip, (0, 0))
    tile.paste(ImageOps.flip(strip), (0, 96))
    tile.save(OUTPUT / 'button-paint.png')
    heading = Image.open(SOURCE / 'heading-records.png').convert('RGBA')
    bounds = heading.getchannel('A').point(lambda alpha: 255 if alpha > 8 else 0).getbbox()
    heading.crop(bounds).save(OUTPUT / 'heading-records.png')
    print(f'Prepared UI assets in {OUTPUT}')


if __name__ == '__main__':
    main()
