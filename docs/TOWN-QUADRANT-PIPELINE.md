# Reference-image town pipeline

This supersedes vector-guide generation in TOWN-HANDOVER.md. Work stays on
`feature/maple-falls-lived-in`; nothing is merged or published.

## Source and naming

The authoritative composition is `art/town/static/ground/trace/town-reference.png`.
Divide each parent into equal screen-space quadrants: 1 top-left, 2 top-right,
3 bottom-left, 4 bottom-right. Root is `1`; three subdivisions produce 64 leaves
named `1_a_b_c`. Keep exact source UV rectangles alongside every generated image.
No vector art or new procedural town layout is used in this pipeline.

The owner's `1_1.png`, `1_1_1.png`, and `1_1_1_1.png` are preserved as supplied
zoom studies. They reframe the church rather than retaining exact quarter
boundaries, so they are NOT registered ground tiles. Use them for detailed
object extraction; do not silently stitch them into the coordinate grid.

## Per-section checklist

The machine-readable queue and review page are produced by
`node scripts/town-quadrants.mjs prepare` and `node scripts/town-quadrants.mjs status`.
Each of the 84 zoom jobs has a separate prompt, parent and reference UV rectangle.
Each of the 64 leaves then needs ground cleanup and transparent solid-object
extraction. Status records distinguish generated, inspected, registered and
approved; an image file alone is NOT an approved game asset.

1. Generate the selected quarter from its parent, preserving boundaries and roads.
2. Inspect against the exact source crop: no added streets or relocated landmarks.
3. Generate each building and large landmark as ONE full-canvas, high-resolution
   transparent PNG. Never put a building in a multi-object generation sheet: that
   sacrifices native detail. Generate separate small-prop sheets for gravestones,
   lamps, bins and fences; trees and large vehicles also get their own canvases
   when needed. Never bake solid objects into terrain. Low leaves/soil stay flat.
4. Generate the corresponding ground-only image, preserving road/curb/path edges.
5. Register object feet and collision footprints against the root reference.
   Numeric collision data is necessary; it is not vector artwork.
6. Check adjoining edges, terrain holes, doors, occlusion and mobile memory.
7. Assemble a review map, then integrate gameplay only after registration passes.

## Current progress

- [x] Read the previous handover; preserve the traced layout commit 55dc1be.
- [x] Inspect the authoritative town reference and owner's deepest church study.
- [x] Identify coordinate drift in supplied zoom chain (studies, not UV tiles).
- [x] Preserve the three supplied studies in this branch.
- [x] Generate all four first-level quadrants (not yet registered).
- [ ] Generate all sixteen second-level quadrants.
- [ ] Generate all sixty-four third-level quadrants.
- [ ] Extract and inspect church/cemetery pilot atlas.
- [ ] Generate and register ground-only leaves and solid-object atlases.
- [ ] Assemble full map and verify gameplay, doors and collision.
- [ ] Commit/push checkpoint (no merge or publication).

## Resolution correction

The mixed church and regional atlases are studies ONLY. Their building cells
are rejected as building masters. They must never be packed or activated as
buildings. The owner explicitly requested individual high-resolution canvases
after seeing these; subsequent generation uses `building-*` / `landmark-*` ids.
The inventory in `art/town/quadrants/objects.json` tracks this corrected pass.
Large buildings must pass a native silhouette-resolution check before use.
Keep masters intact; generate mobile derivatives separately without upscaling.

Review the standalone masters at `/art/town/quadrants/index.html` on the town
development server (port 5192). Clicking opens the full PNG, not an atlas cell.
`node scripts/town-objects.mjs` records native visible bounds, alpha coverage,
clipping and preview paths. `node --test scripts/town-quadrants.test.mjs
scripts/town-objects.test.mjs` validates bookkeeping and resolution checks.
`node scripts/town-quadrant-viewer.test.mjs` checks desktop and portrait-phone UI.

Do not confuse `resolution-checked` with visually approved or integrated.
The raw image preview misleadingly displayed diffuse RGB haze beneath zero-alpha
pixels. Pixel checks and the browser composite verified that the barn cuts out
cleanly; do not reject it based on a viewer that ignores PNG alpha. A v2 attempt
is retained, but the original master remains the default.

### Standalone generation checkpoint

- [x] Generate all 25 individual buildings / large landmarks in objects.json.
- [x] All 25 preferred masters pass native visible-resolution, alpha and edge checks.
- [x] Preserve exact generation prompts and native PNG receipts.
- [x] Generate a continuous full-town ground-only study from the original image.
- [x] Unit checks for quadrant coverage, native visible resolution and alpha.
- [x] Review UI tested at 1440×900 and 390×844; full PNG opens on click.
- [x] Finish native-resolution retries for gazebo and fountain (square v2 masters).
- [ ] Complete all remaining quadrant zooms and leaf extraction.
- [ ] Remove surviving raised wall/fence fragments in the ground study.
- [ ] Register terrain, sprites, doors, collision and depth sorting in the map.

No new artwork is active in the live game. Ground studies are not approved tiles.
The queue currently contains 11 generated zooms (4 first-level, 7 second-level);
the remaining 73 zooms and leaf-specific extraction are still outstanding.
The 25-object inventory is a reusable town asset set, not a claim that every
unique building in every final leaf has been extracted or placed.

Prompts, image paths, hashes, dimensions and alpha information belong in the queue
and artifact receipts. Use the built-in image generator; preserve generated masters.
Never claim an AI zoom is a mathematically registered crop without checking it.
