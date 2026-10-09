# Trick or Treat: Last Kid Standing — Art & Asset Spec

The ground (tiles, curbs, road lines) and small props are **drawn procedurally at boot**, so the game runs with no files.
The **buildings, kids and monsters** ship as PNG files in `public/assets/` that you can replace with your own art.
Every graphic has a registry key and an exact spec (size, frame grid, anchor, footprint, AI prompt), listed in-game under
**Collection** (the Asset Atlas) and in `art/reference/specs.json`.

## Folders

| folder | what's in it |
|---|---|
| `public/assets/characters/` | `hero_<kid>.png` and `hero_<kid>_<costume>.png` sprite sheets (the game loads these) |
| `public/assets/monsters/` | `enemy_<type>.png` sprite sheets (the game loads these) |
| `public/assets/buildings/` | houses and district landmarks (the game loads these) |
| `public/assets/manifest.json` | which files replace which procedural asset |
| `art/reference/` | hi-res renders of the same art to feed an image generator (not loaded by the game), plus `specs.json` |
| `art/concept/` | the key art, logo and UI kit the menus are built from (`scripts/crop-ui-kit.py` cuts `public/images/ui/` from them) |

## Replacing art (the short version)

1. Take a reference from `art/reference/` (one clean pose per kid, costume and monster at 4×, full sheets for the base kids and
   monsters) or a building straight from `public/assets/buildings/`, and the prompt for it from `art/reference/specs.json`.
2. Generate your art. Keep the **layout** of the file you're replacing: same frame grid and rows for sprites, same canvas
   proportions for buildings. Higher resolution is fine and encouraged.
3. Save it over the PNG in `public/assets/…` (same name) and reload. Nothing else to edit.

### Resolution
The scale is detected from the image size: a 4× hero sheet (1536×1536 instead of 384×384) just works. Files bigger than
`maxScale` × the game size (default **2**, set in `manifest.json`) are resampled **once at load**, so the frame loop only ever blits
and memory stays bounded. 2× gives crisp sprites on high-DPI screens.

### Animated sprites
Any of these work for a sprite sheet entry in `manifest.json`:

```jsonc
{
  "overrides": {
    // a sheet / strip: frames left→right, one row per animation (see the row list per sheet below)
    "enemy_zombie": "monsters/enemy_zombie.png",
    // more or fewer frames than the original: give the count (all rows, or per row)
    "enemy_ghost": { "file": "monsters/ghost.png", "frames": 8 },
    "hero_tommy": { "file": "characters/tommy.png", "frames": [4, 8, 4, 8] },
    // an ANIMATED PNG (APNG): its frames are unpacked at load. For the 4-row kid sheets the frames are split
    // in row order (e.g. 4 + 6 + 4 + 6), or use "rows" below
    "enemy_bat": "monsters/bat.png",
    // single-frame files
    "enemy_witch": { "frames": ["monsters/witch_0.png", "monsters/witch_1.png", "monsters/witch_2.png"] },
    // one strip / APNG / frame list per row (kids: idle front, walk front, idle back, walk back)
    "hero_jess": { "rows": ["characters/jess_idle.png", "characters/jess_walk.png", "characters/jess_idle_back.png", "characters/jess_walk_back.png"] },
    // a different canvas: say where the feet / footprint centre is, in the file's own pixels
    "house_0": { "file": "buildings/house_0.png", "anchor": [1016, 1336] }
  }
}
```

Frames are re-packed into the engine's grid at load with each frame's anchor (feet) aligned, so frames can be any size.
GIF/WebP animations aren't decoded — export them as APNG or a sprite strip.

## Projection
* 2:1 dimetric ("isometric"), the same camera family as Diablo II and Commandos.
* **1 tile = 128 × 64 px diamond.** `sx = (x − y)·64`, `sy = (x + y)·32`.
* World X runs toward the screen's lower-right, world Y toward the lower-left.
* Visible building faces: **+Y face (lower-left)** and **+X face (lower-right)**. Doors and porches go on the +Y face.
* Scale: the kid is about 90 px tall; zombies about 90 px; one-storey walls 92 px, two-storey walls 148 px, plus a ~70 px gable roof.
* Draw at "neutral moonlit" exposure with no cast shadows: the engine adds darkness, lights and shadows.

## Sprite sheets (game size)
Left/right facing comes from flipping, so draw everything facing the camera (or away from it for the back rows).
Every kid × costume sheet (`hero_<kid>_<costume>`, costumes: ghost, vampire, witch, hero, skeleton, pumpkin, astronaut, dino) uses the same grid as the kid's base sheet.

| key | file | size | frame | frames per row | feet anchor |
|---|---|---|---|---|---|
| `hero_tommy`, `hero_sam`, `hero_jess` | `characters/hero_<kid>.png` | 384×384 | 64×96 | 4/6/4/6 (idle front, walk front, idle back, walk back) | (32, 90) |
| `enemy_zombie` | `monsters/enemy_zombie.png` | 384×96 | 64×96 | 6 | (32, 90) |
| `enemy_skeleton` | `monsters/enemy_skeleton.png` | 384×96 | 64×96 | 6 | (32, 90) |
| `enemy_ghost` | `monsters/enemy_ghost.png` | 384×96 | 64×96 | 6 | (32, 90) |
| `enemy_bat` | `monsters/enemy_bat.png` | 256×56 | 64×56 | 4 | (32, 52) |
| `enemy_pumpkin` | `monsters/enemy_pumpkin.png` | 384×80 | 64×80 | 6 | (32, 76) |
| `enemy_witch` | `monsters/enemy_witch.png` | 432×112 | 72×112 | 6 | (36, 106) |
| `enemy_werewolf` | `monsters/enemy_werewolf.png` | 576×128 | 96×128 | 6 | (48, 122) |
| `enemy_king` | `monsters/enemy_king.png` | 1200×210 | 200×210 | 6 | (100, 202) |

## Buildings (game size)
The anchor pixel = the **centre of the footprint on the ground**. Collision comes from the footprint in code, not the pixels.
Houses are also mirrored at runtime (the footprint then swaps to e.g. 3×4).

| key | file | size | anchor | footprint |
|---|---|---|---|---|
| `house_0` / `house_3` | `buildings/house_<n>.png` | 508×476 | (254, 334) | 4×3 |
| `house_1` / `house_5` | `buildings/house_<n>.png` | 508×532 | (254, 390) | 4×3 |
| `house_2` | `buildings/house_2.png` | 444×500 | (222, 374) | 3×3 |
| `house_4` | `buildings/house_4.png` | 444×444 | (222, 318) | 3×3 |
| `crypt` | `buildings/crypt.png` | 360×360 | (180, 250) | 3×2 |
| `candy_stand` | `buildings/candy_stand.png` | 296×318 | (148, 234) | 2×2 |
| `school` | `buildings/school.png` | 700×580 | (350, 390) | 6×4 |
| `arcade` | `buildings/arcade.png` | 508×454 | (254, 312) | 4×3 |
| `diner` | `buildings/diner.png` | 508×424 | (254, 282) | 4×3 |
| `video` | `buildings/video.png` | 434×382 | (217, 256) | 3×3 |
| `watertower` | `buildings/watertower.png` | 316×380 | (158, 318) | 2×2 |

## Everything else (procedural, replaceable the same way)
Add a manifest entry pointing at your PNG; the Atlas shows each key's exact size and anchor.

* Ground tiles (128×64, seamless, transparent outside the diamond): `tile_grass_0..3`, `tile_road_0..2`, `tile_sidewalk_0..2`, `tile_dirt_0..1`, `tile_gravel_0..1`, `tile_darkgrass_0..2`, `tile_driveway_0..1`, `tile_flagstone_0..1`, `tile_field_0..2`.
* Edge overlays (128×64): `ovl_curb_{ne,se,sw,nw}`, `ovl_grass_{ne,se,sw,nw}`, `ovl_roadline_{se,sw}`, `ovl_crosswalk_{x,y}`. NE = neighbour at y−1, SE = x+1, SW = y+1, NW = x−1.
* Small props (1×1 unless noted): `tree_{oak,dead,pine}_0..2`, `bush_0..2`, `hedge`, `fence_{picket,iron}_{x,y}`, `grave_0..2`, `pumpkin_0..1`, `streetlamp`, `mailbox`, `trashcan`, `hydrant`, `vending`, `scarecrow`, `car_0..3` (2×1), `gate` (2×2), `bleachers` (3×1), `goalposts`, `scoreboard`.
* Icons: `icon_<weapon>` 64×32 pointing right, grip pivot at (16,20), also used as the in-hand sprite; `pickup_*` 32×32.
  Tiles, overlays and icons are always resampled to their exact size.

## Re-exporting the procedural art

### Reference-guided world artwork

`npm run art:world:prepare` exports the live Atlas's buildings, props, terrain and
overlays into a generation queue. Each job pairs `art/reference/style-target.webp`
with a procedural layout guide, using the screenshot's painted style while
preserving projection, dimensions and footprint anchors. `npm run art:world -- next`
prints the next generation brief. Import generated transparent PNGs, inspect the
alignment preview, then activate versioned manifest entries. See
[art/world/README.md](art/world/README.md) for commands, validation and restoration.
`node scripts/export-art.mjs` (with `npm run dev` running, and Playwright installed) re-renders the vector art: missing files in
`public/assets/` are written and registered in the manifest (existing ones are **kept** unless `--force`), and `art/reference/` is
refreshed. `--scale 4` sets the reference resolution, `--all-sheets` adds full costume sheets, `--buildings 2` adds 2× building renders.
Single assets can also be downloaded from the Atlas at 1× or 4×.

## Occlusion / masks
* Multi-tile props (houses, crypt, cars, shop) use a footprint test: an entity is behind the prop if `x < x1 && y < y1`.
* While the kid is behind a tall prop, that prop fades to 45% and an x-ray silhouette of the kid is drawn over everything (Commandos-style).
* Collision grid: 4 cells per tile edge. Value 1 blocks walking (fences, hedges, graves, bushes). Value 2 blocks walking and bullets (houses, trunks, lamps, map edge).
