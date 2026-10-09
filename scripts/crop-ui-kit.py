"""Cut the web UI images out of the concept art in art/concept/.

    python3 scripts/crop-ui-kit.py

Needs Pillow. Writes optimised WEBP files to public/images/ (logo, key art) and
public/images/ui/ (portraits, banner art, panel illustrations). Re-run it after
updating the concept sheets; the boxes below are pixel coordinates in those sheets.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "concept"
OUT = ROOT / "public" / "images"
UI = OUT / "ui"
UI.mkdir(parents=True, exist_ok=True)

kit = Image.open(SRC / "ui-kit.webp").convert("RGBA")
poster = Image.open(SRC / "key-art.webp").convert("RGB")
logo = Image.open(SRC / "logo.webp").convert("RGBA")


def save(im: Image.Image, path: Path, q: int = 88):
    im.save(path, "WEBP", quality=q, method=6)
    print(f"{path.relative_to(ROOT)}  {im.width}x{im.height}  {path.stat().st_size // 1024} KB")


# ---- logo: trim the transparent margin; a big one for the title, a small one for panels
box = logo.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
logo = logo.crop(box)
save(logo, OUT / "logo.webp", 90)
save(logo.resize((600, round(600 * logo.height / logo.width)), Image.LANCZOS), OUT / "logo_sm.webp", 90)

# ---- key art (title + loading background)
save(poster, OUT / "keyart.webp", 80)

# ---- portraits (big = character cards, face = HUD ring / toasts)
CROPS = {
    "portrait_tommy": (kit, (425, 12, 580, 262)),
    "portrait_jess": (kit, (922, 12, 1071, 262)),
    "portrait_ghost": (kit, (599, 12, 742, 261)),
    "portrait_skeleton": (kit, (760, 12, 904, 261)),
    "portrait_sam": (poster, (478, 352, 618, 582)),
    "face_tommy": (kit, (1099, 15, 1176, 93)),
    "face_jess": (kit, (1435, 15, 1514, 93)),
    "face_ghost": (kit, (1207, 15, 1285, 93)),
    "face_skeleton": (kit, (1320, 15, 1404, 93)),
    "face_sam": (poster, (505, 368, 613, 476)),
    # banner plate illustrations (text is rendered by the game)
    "banner_mission": (kit, (16, 553, 152, 626)),
    "banner_died": (kit, (16, 636, 168, 707)),
    "banner_level": (kit, (16, 716, 160, 784)),
    "banner_weapon": (kit, (16, 792, 142, 852)),
    "banner_tot": (kit, (16, 859, 132, 942)),
    # panel art
    "pause_art": (kit, (257, 332, 490, 400)),
    "info_pumpkin": (kit, (650, 621, 775, 756)),
    "skill_pumpkin": (kit, (740, 453, 798, 512)),
    "kit_logo": (kit, (11, 2, 390, 265)),
}
for name, (src, b) in CROPS.items():
    save(src.crop(b), UI / f"{name}.webp")
