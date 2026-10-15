# Art sources

Nothing in this folder is shipped with the game. The game reads `public/`.

## `reference/` — feed these to your image generator

Hi-res renders of the game's procedural ("vector") art, made by `scripts/export-art.mjs`:

* `characters/hero_<kid>.png`, `characters/hero_<kid>_<costume>.png` — one clean pose (first idle frame, facing the camera) at 4×.
* `characters/hero_<kid>_sheet@4x.png` — the whole sheet at 4× for the three base kids (rows: idle front, walk front, idle back, walk back).
* `monsters/enemy_<type>.png` + `enemy_<type>_sheet@4x.png` — pose and full animation strip at 4×.
* `specs.json` — every exported asset's file, size, frame grid, frames per row, anchor, footprint and a ready-made AI **prompt**.

The buildings are already big at game size: use `public/assets/buildings/*.png` directly (or `node scripts/export-art.mjs --buildings 2` for 2× renders).

When your art is ready, overwrite the matching file in `public/assets/` (same name, any whole-number scale, sprite sheet or
animated PNG) and reload the game. See `ASSET_SPEC.md` for frame counts, anchors and the manifest options.

## `concept/` — the look of the game

The key art, logo and UI kit the menus and HUD are built from. `python3 scripts/crop-ui-kit.py` cuts the portraits, banner
art and panel illustrations in `public/images/ui/` out of these sheets.

The Halloween kit the orange/black UI is built from (added with the 2026 redesign). These are references only: nothing here
is shipped, and `crop-ui-kit.py` still reads the original `ui-kit.webp` | `key-art.webp` pair.

* `title-screen.webp` — the title screen: town key art, logo, left menu column, Essence/Best chips, kid carousel, GO bar.
* `pause-menu.webp` — "Take a breather": the paused kicker, the numbered 01–07 menu rows and the
  In-hand weapon card (DPS · damage · fire rate · range · magazine · reload · pierce · inscriptions).
* `ui-kit-v2.webp` — buttons in every state, numbered menu rows with chevrons, hex icon tiles, radios/toggles/sliders,
  the tooltip plate, the pumpkin badge and the five character-card frames (Tommy, Sam, Jess, Maya, Leo + four blanks).
* `nine-slice-atlas.webp` — the grunge panel/button/banner nine-slice pieces the `.kit-*` and `.paper-*` shells are cut from.
* `maple-falls-iso.webp` — the isometric Maple Falls street the town is laid out from (128×64 tiles).

## `legacy/`

The previous logo, title and portrait images, kept for reference. The game no longer uses them.
