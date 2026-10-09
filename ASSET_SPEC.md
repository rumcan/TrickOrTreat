# Trick or Treat: Last Kid Standing — Art & Asset Spec

All art is currently **procedurally generated at boot** (so the prototype runs with no files).
Every asset has a registry key, so it can be swapped for hand-made or AI-generated **WEBP** art with no code changes.

## Pipeline
1. Open the game, go to **Asset Atlas / Art Spec** on the title screen.
2. Every asset is shown at native size with its key, size, frame grid, anchor and footprint, plus a **copy-ready AI prompt**.
3. Click **Export .webp template** to download the current procedural version (exact size, so it works as an img2img / control reference).
4. Save your final art as `public/assets/<file>` (e.g. `public/assets/tiles/tile_grass_0.webp`).
5. Add the key to `public/assets/manifest.json`:
   ```json
   { "overrides": { "tile_grass_0": "tiles/tile_grass_0.webp" } }
   ```
6. Reload. The atlas marks it **WEBP OVERRIDE**.

## Projection
* 2:1 dimetric ("isometric"), the same camera family as Diablo II and Commandos.
* **1 tile = 128 × 64 px diamond.** `sx = (x − y)·64`, `sy = (x + y)·32`.
* World X runs toward the screen's lower-right, world Y toward the lower-left.
* Visible building faces: **+Y face (lower-left)** and **+X face (lower-right)**. Doors and porches go on the +Y face.
* Scale: the kid is about 90 px tall; zombies about 90 px; one-storey walls 92 px, two-storey walls 148 px, plus a ~70 px gable roof.

## Ground tiles (128×64, seamless, transparent outside the diamond)
| key | content |
|---|---|
| tile_grass_0..3 | dark night lawn; variant 3 has extra fallen leaves |
| tile_road_0..2 | asphalt |
| tile_sidewalk_0..2 | concrete, split into 2×2 slabs by joints parallel to the edges |
| tile_dirt_0..1 | flower-bed soil with pebbles |
| tile_gravel_0..1 | cemetery gravel |
| tile_darkgrass_0..2 | overgrown woods / cemetery grass |
| tile_driveway_0..1 | smooth concrete |
| tile_flagstone_0..1 | stepping stones set in lawn |

## Edge overlays (128×64, transparent)
`ovl_curb_{ne,se,sw,nw}`, `ovl_grass_{ne,se,sw,nw}`, `ovl_roadline_{se,sw}`, `ovl_crosswalk_{x,y}`.
Edge naming: NE = neighbour at y−1, SE = x+1, SW = y+1, NW = x−1.

## Props
The anchor pixel = the **centre of the footprint on the ground**. Collision comes from the footprint in code, not from the pixels.
* `house_0..5`: footprint 4×3 or 3×3 (flipped variants are mirrored at runtime and swap to 3×4)
* `crypt` 3×2 · `candy_stand` 2×2 · `car_0..3` 2×1 (mirrored for 1×2)
* 1×1: `tree_{oak,dead,pine}_0..2`, `bush_0..2`, `hedge`, `fence_{picket,iron}_{x,y}`, `grave_0..2`, `pumpkin_0..1`, `streetlamp`, `mailbox`, `trashcan`, `hydrant`, `vending`, `scarecrow`

## Sprite sheets
* `hero_{tommy,sam,jess}`: 6×4 grid of 64×96 frames, feet at (32,90). Rows: idle front (4 frames), walk front (6), idle back (4), walk back (6). Left/right comes from flipping.
* `hero_<kid>_<costume>`: the same 6×4 grid/anchor as the base kid sheet, one per kid × costume (costumes: ghost, vampire, witch, hero, skeleton, pumpkin, astronaut, dino). Swapped in at runtime when a costume is worn, and also used as the floating "mannequin" costume pickup.
* `enemy_zombie|skeleton|ghost` 64×96 ×6 · `enemy_bat` 64×56 ×4 · `enemy_pumpkin` 64×80 ×6 · `enemy_witch` 72×112 ×6 · `enemy_werewolf` 96×128 ×6 · `enemy_king` 200×210 ×6

## Icons
`icon_<weapon>`: 64×32, pointing right, grip pivot at (16,20); also used as the in-hand sprite. `pickup_*`: 32×32.

## Occlusion / masks
* Multi-tile props (houses, crypt, cars, shop) use a footprint test: an entity is behind the prop if `x < x1 && y < y1`.
* While the kid is behind a tall prop, that prop fades to 45% and an x-ray silhouette of the kid is drawn over everything (Commandos-style).
* Collision grid: 4 cells per tile edge. Value 1 blocks walking (fences, hedges, graves, bushes). Value 2 blocks walking and bullets (houses, trunks, lamps, map edge).
