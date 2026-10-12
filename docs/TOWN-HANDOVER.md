# Town handover: the reference town's layout, in tiles

Written 2026-10-12 for whoever picks up the Maple Falls town next. Branch `feature/maple-falls-lived-in`, worktree
`.codex-session/town-worktree`. Nothing here is merged or published, and nothing in the live game uses it yet.

## What the owner asked for

1. "We need this town. I want you to get this town's layout in tiles." The town is the picture at
   `art/town/static/ground/trace/town-reference.png` (an isometric night town: farm at the top, school and church on
   the left, Main Street in the middle, a pond park on the right, drive-in at the lower left, homes at the bottom).
2. "Def need curved roads. Maybe we can generate the town without the buildings and cars and just roads in massive
   tiles?"
3. Standing rule from the earlier art chat: anything a character can walk behind stays a separate sprite that can fade;
   the ground itself may be static.

## Where it stands

Done and working (builds with no conflicts, all doors reachable):

- The reference is traced and converted to the game's 94 x 94 tile grid.
- `src/game/town-static.ts` now builds the town on that layout, with smooth curved streets.
- A quick render: `art/town/static/ground/layout-render.webp`. Compare it with the reference picture.

Not done: see "Open work" below. The big review page (`scripts/town-static-overview.mjs`) and the layout check
(`scripts/town-static-check.mjs`) have NOT been re-run since the rewrite.

## How the trace works

- `art/town/static/ground/trace/trace.json` is the hand trace, in PIXELS of the reference picture: road centre lines,
  landmark points/outlines, home positions, and the picture's four corners.
- `node scripts/town-trace.mjs` turns it into tiles (`src/game/town-trace.json`) and draws the trace back on the
  picture as proof sheets (`trace/check-full.png`, and nine zoomed `check-0..8.png`, which are git-ignored).
  - `--print` prints the tile coordinates.
  - `--px x,y ...` converts picture pixels to tiles.
  - `--at <section> u,v ...` converts a point read off a zoomed proof section to picture pixels (to paste into trace.json).
- The corners in trace.json are where the picture's straight edges would meet. The picture itself is cropped and
  rounded at its left, right and bottom corners, so do not use the visible corners (that was my first mistake: it bent
  the south-east of the map by up to ten tiles).
- `"inset": 3` shrinks the layout slightly so the game keeps a wooded margin around it.
- Projection reminder: world +X is screen lower-right, +Y is screen lower-left.

## How the map is built

`src/game/town-static-plan.ts`
- `STATIC_STREETS`: 12 streets as centre lines through traced points (tile coordinates, width 3).
- `smoothStreet()`: turns a street into a dense smooth curve (centripetal Catmull-Rom). Use this everywhere a street
  is drawn or measured, so everything agrees.
- `STATIC_CROSSINGS`, `STATIC_DISTRICTS` (same nine ids the review page expects).

`src/game/town-static.ts` (`buildStaticTown()`), in order:
0. Streets are stroked into a small mask; each tile gets a road, pavement and centre-line coverage (0..1).
1. Lots, yards and forecourts are painted (tile-aligned rectangles), then tiles mostly covered by a street become
   ROAD / SIDEWALK.
2. Buildings are placed at the traced positions. `add()` throws if something stands on a street or overlaps, so a bad
   placement fails loudly with its coordinates.
3. Every door gets a flagstone path to the nearest paved tile (breadth-first search around obstacles).
4. Trees, bushes, lamps.
5. Ground art. A tile a street only partly covers keeps the neighbouring surface as its base and gets a per-tile
   overlay with the street drawn in the tile's own projection: pavement, kerb, asphalt, dashed centre line, crossings.
   That is what makes the roads curve. Textures are the existing road and pavement tiles.

`mirror(sprite)` flips a sprite so it faces +X instead of +Y. It is a stand-in: light comes from the wrong side and
any lettering would read backwards.

Quick look after a change (dev server must be running on 5192; the root `.claude/launch.json` has a `town` entry):

```bash
node scripts/town-layout-render.mjs
```

It prints the audit and writes `art/town/static/ground/layout-render.png` (git-ignored; the `.webp` beside it is the
committed copy).

## Stand-ins and missing art

These places exist in the reference but have no sprite, so something else stands there:

| Place | Stand-in now | Needs |
|---|---|---|
| Gas station with canopy | old video store sprite | new building + canopy |
| Fountain in the plaza | a square planter on a flagstone disc | fountain sprite |
| Silo and windmill at the farm | water tower | silo, windmill |
| Corner store | Video Vault | could stay, or a general store |
| Drive-in screen (faces +X) | mirrored screen | a real +X-facing screen |
| One home facing +X (66,48) | mirrored house | +X-facing house art |
| Mansion on Willow Link | tallest house sprite | larger house |
| Basketball court | plain concrete lot | court markings |

Not in the reference but kept because the game needs them: the Starcade (block north of Main Street, with its own
lot), the upgrade shop kiosk (plaza), the fire house and post office (second row behind the shops).

## Open work, most useful first

1. Compare `layout-render.webp` with the reference and tune. What I can already see:
   - Streets read wider than the reference (3 tiles plus a tile of pavement each side). Try width 2 on the lanes.
   - The reference has about 24 homes, the map has 18. Picket fences, hedges and yard detail are missing.
   - Far fewer trees inside the town than the reference; the reference is dense with orange and red trees.
   - Homes south of Lantern Lane face away from it and only get a footpath round the back.
2. Re-run `node scripts/town-static-check.mjs` (I changed one assertion: not every home has a garage now) and
   `node scripts/town-static-overview.mjs` (full-size review page). Neither has been run since the rewrite.
3. `scripts/town-ground-guide.mjs` (ground-only guide for painting the ground as massive tiles) is stale: it still
   rounds corners with `arcTo` and draws the pond at its old place. Switch it to `smoothStreet()` and read the pond
   from the builder, then try the owner's idea: guide + style reference -> painted ground chunks with
   `rundot generate` (repeat `--reference-image`; about one generation a minute; decimal options need a comma).
4. Memory: the smooth streets are about 2,400 per-tile overlay canvases (128 x 64). Fine for the review, probably too
   much for phones. Bake them into larger chunks, or replace them with the painted ground from step 3.
5. `docs/TOWN-STATIC-REFERENCE.md` still describes the previous, invented layout.
6. Live game integration (gates, friend rescue, shop, spawn rules on the new map) has not been started.
   `buildStaticTown()` is still review-only (`liveGameplayChanged: false`).

## Rules that still apply

- Merge and publish only when the owner says so.
- Use run.world credits (`rundot generate ...`) for images.
- Do not leave work uncommitted; push the branch.
