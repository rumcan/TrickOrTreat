# Painted modular roads — active workflow

## Town builder (Claude, 2026-10-13, later) — CURRENT ENTRY POINT

The v4 renderer below now lives in `scripts/lib/town-scene.mjs` (tile-baked, parallel) and drives the Maple Falls
Town Builder app: 25 places, cul-de-sacs, car parks with driveways and bays, plazas, dirt yards, a football field,
grass variety from `output/terrain-materials`, and lamp reflections that all point at the bottom-centre of the picture
with each street lamp standing behind its brightest glint. Read [TOWN-BUILDER.md](TOWN-BUILDER.md).
`scripts/town/roads/road-v4-render.mjs` is the earlier single-image demo and is superseded.

## v4 road builder (Claude, 2026-10-13)

Codex ran out of usage before the owner's last request ("bigger, more orange pavement light with highlights on slab
edges; build roads on a map with our grass; scattered leaves on the pavement; less uniform gutter leaves, bigger, denser at
the curb and thinning toward the middle"). Mid-session the owner added: brown grime decal on the pavement, wear on the
road lines, the same leaves on the grass, and street lamps standing mid-sidewalk rather than on the curb edge.

**Why v4 changed approach.** The v3 bend and straight paintings ignore their geometry guides (both are zoomed in and drawn
at ~29.4° true isometric, not the game's 26.57° 2:1), and the bend's slabs are 3.4 m peach squares vs the straight's 2.5 m
beige ones. They cannot be joined as pieces. v4 keeps their *materials and light* and owns the *geometry*:

- Straight painting rectified to ground space by homography (1104 px = 20 m). Its asphalt, 11 slab tiles, camera-side and
  far-side curb/gutter strips are cut out as literal painted pixels (`output/road-autotile-v4/sources/`). Painted dashes
  are removed by patch inpainting; the uniform orange gutter dot rows are removed.
- Geometry (`scripts/lib/road-v4-kit.mjs`): 20 m cells, ports at edge midpoints, 6.5 m asphalt, 2.05 m sidewalk band,
  bend centre radius 7.5 m with 2.5 m stems. Curbs are half-planes and rounded quarter-planes, so straights, all four
  bends, four tees and the cross meet exactly. Slabs are laid along every curb with a joint at every port (radial joints on
  curves). Curb face width follows the curb's facing toward the camera (visible on far curbs, hidden on near curbs).
- Asphalt is the painted texture, flattened and hex-tiled in WORLD coordinates (no cell seams, no grid).
- Lamp light reproduces the painting: the pool shape is measured from the painting (screen-locked streak, like a real wet
  reflection) and the lit colour is a per-intensity table measured from the painting's own lit vs. unlit asphalt
  (`manifest.json` → `light`). `review/compare-straight.png` shows the painted straight next to the builder at the
  same lamp position.
- Pavement: wider orange spill centred on the lamp post (σ 4.2 m) and lamp-facing slab edge highlights. Brown grime
  (stain tint measured on the owner's S-bend painting), joint dirt and grass-edge mud; worn dashes / double yellow
  (chips, occasional worn gaps). Grime/wear switch off with `GRIME=0` / `WEAR=0`.
- Leaves: 953 sprites cut from the existing transparent leaf scatters (orange/red only). Gutter drifts hug the curb and
  strays thin out toward the centre line; patches on some sidewalk stretches; the same leaves on the grass.
- Street lamp: the game's existing painted `art/world/staged/streetlamp-57c1616a5a639908.png` at game size, standing
  mid-sidewalk.

Commands (from the repo root):

```text
node scripts/town/roads/road-v4-sources.mjs       # rectify + cut sources, fit the light table
node scripts/town/roads/road-v4-leaves.mjs        # cut leaf sprites
node scripts/town/roads/road-v4-render.mjs town 1 # full map at game scale (zoom 1 = 32 px per axis metre) ~1 min
node scripts/town/roads/road-v4-render.mjs compare 1 && node scripts/town/roads/road-v4-compare.mjs
```

Outputs: `output/road-autotile-v4/maps/town.png` (7760 × 3920, game scale), `town-preview.webp`,
`town-roads-transparent.png` (paving + leaves only), `closeups/`.

Not done yet / honest limits:
- The approved v3 bend painting is not used pixel-for-pixel; bends are built from the straight's materials so they join.
- Only one asphalt material, one road profile and one sidewalk width; no driveways, lots, crossings, stop bars, dirt
  adapters or roundabout yet (master plan Phases 2–3).
- Lamps are placed by hand per layout, on camera-facing curbs. A lamp on a near-side curb would get only the pavement spill.
- Grass is the existing tile at the approved 256 px repeat; the owner plans to paint grass/soil sheets.
- Not integrated in the game; no chunk baking or mobile performance work (Phase 5). Nothing merged or published.

**ACTIVE MASTER PLAN:** read [ROAD-BUILDER-MASTER-PLAN.md](ROAD-BUILDER-MASTER-PLAN.md) first. The owner requested a thorough design for a beautiful, reusable, automatic road builder. That document records the reference town, rejected approaches, typed connections, sidewalk variants, traffic-light junctions, roundabouts, parking/dirt adapters, preserved specular, runtime budgets, risks and stable RB task IDs. This file records the v1 prototype baseline, not completion of that larger plan.

This supersedes the 25 independently painted empty plots and the old seven loosely fitted road sections. Preserve those trials; do not continue their generation queues.

## Latest art checkpoint — reference-first v3

The v2 structural fixes are retained, but its newly generated granular asphalt, independent glitter-like reflection and orange-tinted repeating concrete were **rejected by the owner**. Do not promote v2 material art or describe it as matching the approved reference.

The active art masters are in the MAIN checkout's `output/road-autotile-v3/`:

- `native/reflection-extracted.png`: built-in imagegen edit of the owner's exact cracked amber close-up. Dark fissures cross the light; no sidewalk is included in this extraction. This is an AI extraction/remaster, not a claim of byte-identical original pixels.
- `native/painted-3.png`: custom bend with its own matching cracked road reflection and localized light on the inside sidewalk. The owner said **“the bend looks perfect.”** Keep this native master immutable. SHA-256 `7b293c3b1fdd9ff004e85e06c74df8556bda67d832cbb492f995e51539808264`.
- `native/painted-10.png`: first reference-derived straight, retained as the before-image. Its repeated warm slabs prompted the next correction.
- `native/painted-10-sidewalk-light.png`: targeted built-in edit of the straight. Unlit paving is **beige and planar**, not orange on every block or rounded/pillowy. One existing road lamp produces a localized orange/gold pool on the adjacent sidewalk as well as the road. This straight still needs the owner's visual acceptance.
- Every stage has a saved `jobs/*.json` prompt/reference list and immutable `native/*.json` receipt with native dimensions and source/reference hashes. The two module masters are natively 1254-square; exported size must not be described as additional generated detail.

The owner's key clarification: **specular/illumination is required on BOTH asphalt and sidewalk.** Beige concrete is the underlying material; warmth comes from a real lamp's local reflection, not a tint applied to every slab. The curb catch, concrete spill, concrete joints and cracked road sheen belong to the same fixed light source. Keep the approved bend's appearance; do not generate generic new textures, unrelated specular decals or independently lit slab squares.

Commands from the repo root:

```powershell
node scripts/town/roads/road-autotile-reference-review.mjs
node --test scripts/town/roads/road-autotile.test.mjs scripts/town/roads/road-autotile-quality.test.mjs
```

Review: `output/road-autotile-v3/review/sidewalk-lighting-comparison.png` and `review/reference-art-validation.json`. These prove native provenance, localized light on both surfaces and an unchanged approved bend. They are **NOT** a connected new atlas or a full town. Still needed: register these AI cutouts to the exact sockets, preserve their matching lit/unlit texture/joints, use shared connector collars, fit the other axis/bends/junctions, verify all joins at native resolution and run the game/mobile scale proof. Do not regenerate all topologies until this straight is accepted.

Structural v2 retained work: individual ground-space leaf sprites (no stretched ribbons), supersampled paving/markings, stable variant hashing, shared-socket pixel audit and a viewport-sized review canvas. Geometry tests now include continuity of junction signed distance so false dark triangular curbs cannot return. The old v2 exported atlas predates that last geometry change; do not claim its exports already contain it.

No merge, publication or live terrain replacement has occurred in this road-art pass. Preserve unrelated dirty town/game changes.

## Owner's requirements

- Match the asphalt, beige slab sidewalks, localized orange lamp illumination and curbs in `output/town-empty-v1/tiles/crossroads.png`. Camera geometry must still be corrected to the game's 2:1 projection; material style is not negotiable. Do not bake the orange illumination into every sidewalk slab.
- Build roads from interchangeable isometric parts, with genuinely matching connectors: straights, curves, junctions and later driveway/parking entrances.
- First create grass-backed artwork. Then remove the grass and slice/export the paving as transparent PNGs. Grass is not part of the road atlas.
- Only road markings may be vector-drawn, with some transparency. Asphalt and sidewalks must be painted raster art.
- At most one warm specular highlight per section. Keep illumination variants separate from connectivity, and avoid bright seams at connectors.
- Sidewalk leaves and road/gutter leaves are separate transparent decals, never baked into every repeated road tile.

## Engineering contract

Use a four-edge road-connection bitmask to select the appropriate tile. This is an edge-matched terrain system, not an independently regenerated full-town picture. Reference: [Tiled terrain edge sets](https://doc.mapeditor.org/en/stable/manual/terrain/).

Every connector has a fixed position, tangent, asphalt width, sidewalk width and concrete-slab phase. Share source pixels/materials rather than ask the generator to independently approximate each connector. Lock connectors during centre artwork generation, then enforce their shared raster profile during slicing. Review both alpha silhouettes and painted joins. Passing a bitmask test alone is not visual approval.

Do not rotate a flat PNG 90 degrees on screen: that breaks the ground projection. Change orientation in ground coordinates, then project with `(x-y)*scale, (x+y)*scale/2`. All variants use the same material master. The fixed camera pitch/heading remain 30/45 degrees; close-up source framing is recorded separately from the old 80m full-plot framing.

Do not replace live terrain until the connected proof looks good. No publishing/merging in this step.

## Checklist

- [x] Record the revised workflow and inspect the exact approved reference.
- [x] Produce/inspect a clean material master: remove road lines and paving leaves without redesigning the surfaces.
- [x] Extract shared painted asphalt, slab/curb profiles and provisional highlight samples, preserving provenance. Source detail and highlight registration still require Gate A of the master plan.
- [x] Implement the initial road bitmask selection, fixed isometric projection and shared-raster assembler.
- [ ] Generate/inspect grass-backed straight, curve and intersection artwork with the shared sockets.
- [x] Export 16 transparent mechanically projected modules and orientation variants from shared painted sources; do not mistake this for proof that every independent AI cutout fits.
- [x] Generate separate sidewalk and gutter leaf decals.
- [x] Add optional translucent line overlays and provisional single-highlight variants; brightness is restored, source-accurate curb registration remains outstanding.
- [ ] Test every connector pair, alpha, scale, all road masks and deterministic assembly.
- [x] Assemble/inspect the current connected proof and deliver the full PNG plus interactive review. Owner approved the direction, not all unfinished production features.

Mark changes after each step. Retain failed candidates with honest review notes. Do not claim exact material fidelity, geometry or seamlessness until the corresponding native proof was inspected.

## Measured baseline — 2026-10-13

- Working checkout at the time: the Codex worktree on branch `feature/maple-falls-lived-in` (the builder now lives in `scripts/town-builder/`). Preserve unrelated dirty files. No gameplay integration, merge or publish occurred in this pass.
- Delivery is in the repo root's `output/road-autotile-v1`.
- `node --test scripts/town/roads/road-autotile.test.mjs`: six tests pass.
- `node scripts/town/roads/road-autotile-build.mjs check`: 16 base modules, 17,024 shared-socket comparisons pass. These compare each SAME port across topologies; all OPPOSITE-port/phase join tests are still needed.
- `node scripts/town/roads/road-autotile-build.mjs demo`: 25-section proof, 7168 × 3584; transparent version, opaque neutral-backing PNG, and 2800 × 1400 preview. This is not the full town.
- `node scripts/town/roads/road-autotile-build.mjs editor`: regenerated self-contained offline review page with current highlights/leaves.
- `node scripts/town/roads/road-autotile-audit.mjs --browser`: 13 native receipts and their reference hashes verified, 80 layer dimensions/alpha checked; report `review/planning-audit.json`. Chrome loads the review with zero page errors; Clear/Reset work. Screenshot: `review/planning-browser.png`. This is not mobile or combat-performance verification.
- All 80 editable layers fully decoded cost 160 MiB before overhead; the full proof is 98 MiB raw RGBA. Do not ship them all preloaded. Follow the master plan's offline bake/visible-chunk strategy.

### Art decisions and defects

`native/material-master.png` is the cleaned 1254-square source. Final bases sample its painted pixels, rather than stitching arbitrary AI cutout silhouettes. `sources/profile.json` fixes a 178 × 108 curb/paving sample; the asphalt source crop is 92 × 152. Actual detail density must improve before claiming high-resolution production materials.

Five grass-backed AI drafts and five cutouts exist. The freeform curve draft zoomed/reframed, and the end draft became a straight; both are rejected as module geometry. Their cutout requests used fixed raster guides instead. Keep all source jobs/receipts, including failures. Native receipt review fields remain pending until their individual acceptance/rejection is recorded explicitly.

The original reflection extraction clipped the brightest curb/pavement and reduced opacity twice. The latest bake includes the lit curb/pavement and recovers peak alpha 255; curve and straight samples contain visible light pixels on both asphalt and sidewalk, none outside paving. `review/road-light-before.png` retains the prior proof. **This restores visibility, not final correct registration:** broad warm pavement patches must become source-anchored asphalt/gutter/curb/concrete recipes (RB-010).

Native sources usually are 1254 × 1254; the sidewalk leaf source is 1387 × 1134. Module exports are derived 1024 × 512. No software enlargement is presented as higher native detail. The neutral green proof backing is not a new grass asset.

Next dependency-ready work: the master plan's Gate A / RB-010–014. Do not launch more independently painted full-town plots.
