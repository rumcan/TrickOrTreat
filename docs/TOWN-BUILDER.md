# Maple Falls Town Builder

A local app for painting the town: pick any sprite we have, click it onto the baked ground, move/mirror/scale it,
and everything saves to disk in world metres that map 1:1 onto the game's projection.

## Run it

```text
node scripts/town-builder/server.mjs --port 5190
```

Then open http://127.0.0.1:5190 (also available as the `town-builder` entry in `.claude/launch.json`).

## Build together on the network

Open **Share town**, enter your name, and press **Start sharing on this network**. Copy the invitation link and send it to someone on the same Wi-Fi or wired network. They open it in their browser; they do not need a second copy of the repo. Keep the host computer and builder running. **Stop sharing** closes network access and revokes the invitation. Sharing remains enabled across server restarts until you stop it.

Placements, moves, deletions and ground edits appear in both browsers automatically. Each person keeps their own camera, selection and Undo history. Independent changes merge, including different settings of the same object. If both change the same setting, a dialog asks **Use their change** or **Keep my change**. A disconnected browser retains its pending edits and merges them when the connection returns; keep its tab open until saving finishes. Rebuild ground publishes the latest accepted ground snapshot, and both browsers pick up the completed map. Edits made during a rebuild remain pending for the next rebuild.

The first invitation uses a physical network address when available; other adapter addresses are tucked into a drawer. If Windows asks, allow the running Node builder through the firewall for your home network. The builder opens its listening socket to the LAN only while sharing is enabled, requires the invitation for remote access, and permits only the host to change sharing settings.

Run `node scripts/town-builder/collaboration.test.mjs` from the repo root for isolated two-browser tests, real LAN invitation/access checks, conflict handling, Undo, reconnect, and all calibrated fence thumbnails. The test never saves into the live town.

The map banner always describes the active action: placing new objects, creating ground, or editing a selection. The object inspector appears only in Select / edit. Picking a library picture starts placement and clears the previous selection.

In **Lots & paving**, choose **Edit existing**, **Draw new**, or **Paint a shape**. Drawing never selects an old lot, even when the rectangle starts inside it. A completed rectangle switches to editing with its yellow outline selected. **Draw another item** begins a fresh item. Creation settings and selection settings are independent. Painted shapes continue across strokes until **New shape** or **Finish & edit shape**; **Continue painting** explicitly resumes a selected painted shape. Undo clears stale selection and brush references.

Surface and border pictures use the actual ground renderer. Border pictures match the chosen material. Ground edits save automatically and appear as outlines until **Rebuild ground** renders them. The status above the map distinguishes saving, saved edits awaiting rendering, and completed ground. Town statistics are available in the collapsed **Town overview** drawer.

Run `node scripts/town-builder/interaction-ui.test.mjs` from the repo root for the isolated create/edit interaction checks. Regenerate example images with `node scripts/town-builder/ui-examples.mjs`; this writes only `scripts/town-builder/app/examples/`.

## What you can do

| Tool | How |
| --- | --- |
| Paint (B) | Pick a sprite on the left, click the map. Set **Drag spacing** to paint rows (fences) or drift-scatter (trees, leaves); **Scatter** jitters position, **Size variety** varies scale, **Random mirror** flips. Alt-click a placed sprite to make it the brush. |
| Select (V) | Click a sprite (pixel-accurate), Shift-click to add, drag on empty ground to box-select, drag to move (snaps ½ m, Alt = free). Inspector edits X/Y/scale, mirror, duplicate, delete. |
| Pan / zoom | Wheel zooms at the cursor; Space-drag, right-drag or H pans. Minimap bottom-right. |
| Build / remove roads (R) | Choose Build road or Remove road, then click or drag across the 20 m grid. Hold Shift to erase temporarily. Undo restores the whole stroke. Rebuild ground replaces removed cells with grass. |
| Streetlights (J) | Paint actual lamp posts as selectable sprites. Move or delete them without rebaking. Reflections are independent. |
| Reflections (L) | Paint illumination from the approved asphalt response onto existing surfaces. Set strength/pool size; disable curb snapping for free placement. Shift-click or Erase removes a reflection. Bake ground afterward. |
| Pavement (U) | Paint beige paving patches with width/depth controls; drag for a strip. Shift-click or Erase removes painted patches. Undo restores an entire stroke. Bake afterward. |
| Presets | Reference POIs reuses existing shops with new small clutter sprites. Litter is walkable. Place frontage groups on existing paving; select individual members to adjust. |
| Lots (K) | Drag a rectangle: car park, plaza, dirt yard or sports field. Sides touching a road get a driveway automatically. |
| Rebuild ground | Renders roads/lots/paving/reflections into a new `map-version-*` directory and switches `map-current.json` only after the map is complete. Previous versions remain available; lamp posts stay editable sprites. |
| Export | Composes every sprite over the full-resolution ground: `output/town-builder/exports/<time>/tiles/*.png` + `town-half.webp`. |

Mirroring matters: the building art only shows a front on its **+Y face** (screen lower-left). Mirrored, the front
faces **+X** (screen lower-right). So frontages go on the north side of east-west streets and the west side of
north-south ones; that is how the 25 places were laid out. Mirroring also reverses lettering, so shops and venues
with signs (Video Vault, Moonlite marquee, Main Street shops) stay unmirrored and face +Y.

## Files

| Path | What |
| --- | --- |
| `scripts/town-builder/server.mjs` | Local server: static app, library, tiles, `/api/layout`, `/api/plan`, `/api/bake`, `/api/export` |
| `scripts/town-builder/app/` | The app (vanilla JS canvas, no build step) |
| `scripts/town-builder/library.mjs` | Builds the sprite library, including reviewed POI dressing and corrected arcade v2 sprites |
| `scripts/town-builder/arcade-library.mjs` | Adds existing arcade sprites without rebuilding unrelated library entries or changing the saved map |
| `scripts/town-builder/plan-maple-falls.mjs` | The 25-place town plan + starting sprites (regenerates `plans/maple-falls.json` and `layout-seed.json`) |
| `scripts/town-builder/bake.mjs` | Bakes a plan into map tiles + zoom pyramid + preview |
| `scripts/lib/town-scene.mjs` | Ground renderer: v4 roads, lots, driveways, bays, plazas, dirt, fields, lamp light, grass variety, leaves, lamps |
| `scripts/lib/road-v4-kit.mjs` | Road geometry: 20 m cells, 16 masks incl. cul-de-sac bulbs |
| `output/town-builder/layout.json` | **Your painted sprites** (autosaved). Falls back to `layout-seed.json` until the first edit. History copies in `layouts-history/`. |
| `output/town-builder/plans/maple-falls.json` | Ground plan: road cells, lots, lamps, the 25 places. History in `plans/history/`. |
| `output/town-builder/library/` | `library.json`, sprites (2× game scale WebP), thumbnails |
| `output/town-builder/map/` | Baked ground: `tiles/<level>/<x>_<y>.webp`, `full/*.png` (lossless level 0), `preview.webp`, `manifest.json` |

## Coordinates (for bringing a layout into the game)

Presets are fixed authored arrangements: no per-click item substitution, omission, jitter, size changes, automatic turns or mirroring. Their thumbnails show the actual saved sprites and positions. Saving a selection preserves its exact relative layout and facing, without a variation prompt. Brush scale explicitly resizes the whole group. `node scripts/town-builder/fix-presets.mjs` freezes legacy recipes and refreshes matching thumbnails, backing up originals under `presets/history/fixed-layout-*`; it never changes the map or existing placements.

Multi-selection: Shift-click or box-select sprites, then use **Selection → Resize (%) → Apply resize**, or the ±10% buttons / `[` and `]`. By default, both sprite sizes and spacing resize uniformly around the group's anchor centre. Uncheck **Scale spacing around group centre** to leave placements fixed. Relative sprite sizes remain intact, with a shared factor constrained to the supported 0.2–4× size range. One action is one undo step; resize saves normally.

Live development: serve on port 5190 with `node --watch scripts/town-builder/server.mjs --port 5190`. The browser checks for updates every two seconds: library/preset/baked-ground updates refresh in place without changing placements or undo history. App code changes reload after pending saves and active interactions finish, restoring the camera. Ground edits still require **Bake ground**; unfinished bakes are not shown. Server watch restarts after server-source edits. No automatic polling overwrites the owner's active layout.

Arcade art is available under **Arcade furniture**, **Arcade decor**, and **Arcade floor decals** (35 sprites). These reuse the packed game WebPs byte-for-byte, with game frame sizes, footprints and ground anchors intact. Front/back cabinets and pinball variants are separate brushes. Floor litter and the exit mat render below upright sprites. The rejected fallen chair and obsolete v1 artwork are excluded; overhead carpet is a material, not a placeable sprite. Register with `node scripts/town-builder/arcade-library.mjs`; the full library rebuild also retains these entries. Existing town placements are not changed. Refresh the browser to load the new categories.

World metres: **X** runs to screen lower-right, **Y** to screen lower-left; one game tile (128 × 64 px) is 2 m.
A map pixel at zoom 1 is `ox + (X−Y)·32, oy + (X+Y)·16` with `ox, oy` from `map/manifest.json → origin`.
Each sprite placement is `{id, x, y, flip, scale}` where `(x, y)` is the **footprint centre**. Library items give the
game-scale size `w × h`, the anchor `(ax, ay)` that lands on that point, and the footprint `fw × fh` tiles, using the
game's own rules (world atlas anchors, `townGeometry`, static specs, `referenceProp`). So `tile = (x/2, y/2)` in game tiles.

## Status

- Ground: v4 painted roads (see `ROAD-AUTOTILE-HANDOVER.md`), lots with driveways and worn bay lines, plazas from the
  same slabs, dirt yards, a football field, 43 lamps whose reflections all point at the bottom-centre of the picture
  with each lamp standing behind its brightest glint, mixed grass from `output/terrain-materials`.
- 25 places, each with its key building(s); trees, parked cars, bushes and Halloween porch dressing seeded for a start.
- Upgrade: old lamps migrated with backups, parking asphalt darkened with blended driveway mouths, continuous lot sidewalks, boundary road caps, intersection crossings/stop bars, separate painting tools and working preset-save API. See `TOWN-BUILDER-UPGRADE.md`.
- Not done: the game does not read `layout.json` yet; no water; no collision export; baking edits re-renders the whole map. None of this local builder work is published.

## Shadows, layering, groups and ground (Claude, 2026-10-13 evening)

- **Shape shadows.** `scripts/town-builder/shadows.mjs` gives every upright sprite its own feathered ground shape, saved as
  `library/shadows/<id>.webp`, and records the same shape as `base {shape, hx, hy, dx, dy}`, a ready-made collision box.
  Buildings and vehicles use their footprint (vehicles a darker pool past the tyres); poles, lamps, signs and hydrants
  get a small dark footprint at the measured bottom of the drawing; trees use the trunk, not the canopy; fences a thin
  strip. The server runs `ensureShadows()` at start-up, so new sprites get one automatically. The app and export draw
  them after ground decals and before upright sprites, one image draw each. `--force` regenerates all of them.
- **Layering.** Bring to front / Move to back (`Shift+]` / `Shift+[`), and **Forward one / Back one** (`.` / `,` or
  PgUp/PgDn), which slip the sprite past the next one it overlaps using a small depth offset `o`.
- **Groups.** `Ctrl+G` / `Ctrl+Shift+G`. Clicking a member selects the group; Alt-click picks one. Stamped presets are grouped.
- **Lots & paving.** Pavement patches moved into Lots & paving (surface "Pavement patch"); `U` jumps there. **Edge**:
  sidewalk ring + curb / curb only / no border, for new lots and the selected lot or patch.
- **Car parks** use their own large painted surface (`output/paving-kit/lot-texture/lot-asphalt-3.png`, RUN image
  generation), no darkening layer, so reflections on lots match the road.
- **Reflections** all point straight south (down the screen).
- **Drawers.** Two palette columns, inner scrolling. The right drawer shows settings for the current tool (brush,
  selection, ground). Places moved to the **Go to place…** dropdown.

Tests: `node --test scripts/town-builder/ui.test.mjs scripts/town-builder/group-layer.test.mjs` (throwaway data folders).
- **Lot paint brush** (Lots & paving → Tool: Paint brush): ● circle or ◆ isometric square, Small 3 m / Medium 6 m /
  Large 12 m or the slider, `[` `]` to resize. A stroke grows one lot (stored as `stamps:[{s:'c'|'q',x,y,r,neg?}]`,
  blended with a smooth minimum so dabs merge with soft corners); Shift erases; **New shape** starts a separate lot.
  Surface and Edge work as for rectangles (pavement-patch surface maps to Plaza slabs). Painted lots get no automatic
  driveway: paint the shape up to the road.
- **Ctrl+C** copies the selection; **Ctrl+V** pastes it at the mouse, as many times as you like (groups pasted as new groups).
- **Lots & paving → Tool: Select**: click any car park, plaza, yard, field, painted shape or pavement patch (hover
  outlines what you'd pick; patches win over the lot under them, then the smallest shape). Drag to move (¼ m snap,
  Alt free; bays, driveway openings and painted stamps move with it), yellow handles resize rectangles, arrows nudge,
  Delete removes; the drawer changes surface and edge and has Duplicate.

Road removals have red crosses until the next successful rebuild. The road action is explicit and idempotent: revisiting a cell while building keeps it, and revisiting an erased cell keeps it erased. A single drag is one undo step.

Ground rebuilds render a frozen plan into a new `map-version-*` folder. All pixels start from the grass/material scene, so removed road/lots/paving/glow cannot survive from the old map. Only a complete map can be published. Publication atomically switches `map-current.json`, avoiding Windows errors when the old map directory is open. Existing map folders stay available for recovery. The server and export tool follow the active map pointer. The manifest includes the baked ground plan so pending edits and deletions remain visible after a browser reload.

Run `node scripts/town-builder/road-rebuild.test.mjs` for real bake, publication, road drag, and removal checks in an isolated town. It compares the finished pixels with a freshly rendered empty scene. Generated test data and PNG reviews are ignored under `/output/`.

## Ground paint (texture painter)

Library category **Ground paint**: the lot and paving surfaces as paintable flat decals, rendered by the ground
renderer itself (`scripts/town-builder/texture-paint.mjs`, re-run to regenerate). Surfaces: car-park asphalt, plaza
slabs, beige pavement and dirt yard; soft dabs at 2, 4 and 8 m (several cuts each), soft squares at 4 and 8 m, and
hard-edged slab tiles at 2.5 and 5 m that join without a seam. Picking one sets the drag spacing it was made for,
switches on random mirror and turns scatter and size variety off; slab and pavement dabs snap to the 2.5 m slab grid
(Alt places freely) so joints line up between dabs. Placed dabs start on layer -100, under leaves and litter, and need
no ground rebuild. Asphalt cuts are chosen from the calmest part of the car-park texture so a stroke does not repeat
its painted markings. Test: `node scripts/town-builder/texture-paint.test.mjs` (throwaway town).
