# Game artwork pipeline

The full reference-style production pass is installed: **175/175 Atlas entries**
are generated, reviewed and active in `public/assets/manifest.json`: 49 props,
24 tiles, 14 overlays, 66 animation sheets and 22 weapon/pickup icons. All use
the supplied Halloween screenshot as their style reference. Original procedural
assets and previous manifest overrides are preserved.

The live Collection / Asset Atlas is the source of truth. This pipeline covers
props (including buildings), ground tiles and edge overlays. The first export
contains **87 world assets: 49 props, 24 tiles and 14 overlays**. Use
`npm run art:world:prepare -- --all` for the complete **175-entry Atlas**, including
66 character/costume/monster animation sheets and 22 weapon/pickup icons. Existing
menu/concept artwork lives separately in `public/images/`.

Every job uses `art/reference/style-target.webp` (the provided screenshot) for
style, and a procedural atlas render for layout. `style.json` specifies painted
detail, navy moonlight, amber practical lights and 2:1 dimetric projection. The
briefs replace the old pixel-art medium while retaining each asset's description,
material colors, sign text, canvas proportions, footprint and anchor. The engine
adds darkness, fog, point lights and shadows, so these are not baked into props.

## Prepare the queue

```powershell
npm install
npm run dev
# Another terminal:
npm run art:world:prepare -- --all
npm run art:world:status
npm run art:world -- next
```

The exporter uses the existing `playwright-core` dependency and headless
Microsoft Edge, with no browser download. Node must support Vite 7. Override the
server URL with `--url http://127.0.0.1:5174/`; `--scale 4` is the default (1-4).

Prepare exports the live world registry, saves layout PNGs and one prompt per
asset, and creates `art/world/queue.json`. `prepare --offline` rebuilds the queue
from the last `atlas.json` without Vite. Re-export after changing registry specs.
Matching job fingerprints retain staged/active state; changed inputs reset jobs.
For a targeted registry change, use `prepare --all --keys key1,key2` to preserve
the other jobs' layout references. Include every asset whose specification changed.

Monster strips are arranged into compact 3x2 (or 2x2) generation grids and repacked
into the engine's original horizontal strips. Character sheets retain their
6x4 grid and 4/6/4/6 occupied cells. Generated base-character sheets are supplied
as an additional identity reference for that kid's ten costumes. Import checks
that every required animation frame is present and inactive cells remain empty.

## Generate with both references

```powershell
npm run art:world -- prompt --key house_0
```

`next` and `prompt` print a tool-ready prompt and absolute reference paths. The
assisting agent calls the **built-in image generator**, once per asset, with
those references in order and `transparent_background: true`. This is an agent
workflow: npm prepares jobs; it does not call an image API or start an unattended
generation service. No API key is needed in this mode.

To continue, request: "Generate the next five pending world assets from the
queue using both references; import, inspect and activate each passing asset."
Include the style screenshot on every call, generate related families together
and compare outputs at native size to catch style drift.

## Import, review and activate

```powershell
npm run art:world -- import --key house_0 --input "C:\path\generated.png"
# Inspect art/world/checks/house_0.png, then:
npm run art:world -- activate --key house_0
npm run art:world:validate
# With Vite running, also exercise the game's real PNG loader:
npm run art:world:validate -- --browser
# Also start gameplay and save art/world/checks/gameplay.png:
npm run art:world:validate -- --browser --scene
# Reload the game or reopen Collection.
```

Import preserves the source and checks static PNG format, real alpha, nonempty
art and canvas proportions. It resamples to the queued scale without cropping
props; terrain is masked to its diamond and checked for interior holes. Opaque
backgrounds are rejected and should be regenerated with actual transparency.

Aspect mismatches over 1% are rejected. For a differently framed **prop or icon**, measure
its footprint center or pickup/grip pivot in source pixels and pass `--source-anchor X,Y`. The
importer uniformly scales/translates it to the atlas anchor and refuses visible
clipping. It cannot infer footprint centers from arbitrary art. Overlays require
the correct canvas proportions. After inspecting a solid terrain diamond with
extra surrounding transparent padding, `--trim-tile` packs its visible bounds
to the canonical diamond; the same strict interior-hole checks still apply.

For visually confirmed equal-cell monster grids with unexpected overall canvas
proportions, `--align-grid` packs all poses using a shared uniform scale and feet
baseline. `--clear-unused` removes only engine-unused hero cells (last two cells
of idle rows), leaving required poses untouched. Original masters remain intact.

`batch --limit N` records exact generation prompts and references. `receive
--records-base64 BASE64` imports a UTF-8 JSON array of `{key,input}` records,
preserving raw masters even when packing fails. `contact --keys key1,key2`
creates `checks/current-batch.png`; inspect it before `activate-batch --keys
key1,key2`. Queue writes are atomic and mutations are serialized by a local lock.

The checkerboard review image places the procedural guide on the left and the
new art on the right, with pink ground-anchor crosshairs. Tiles also get a
`<key>-repeat.png` showing nine contiguous diamonds. Review silhouette, ground
contact, door/light positions, edge directions, style and tile seams. Automated
PNG checks cannot guarantee visual alignment, style consistency or seamlessness.

If you change a generation prompt, save the exact text and pass
`--prompt-file <workspace-relative-path>` during import. The pilot's actual prompt
is preserved in `samples/candy_stand.prompt.txt`.

Activation creates a versioned PNG in `public/assets/generated/world/`, saves
the previous override in `art/world/activations/`, and changes just that key in
`public/assets/manifest.json`. Original files remain on disk. Engine collision,
mirror and occlusion behavior and `maxScale` remain driven by existing specs.
Each game PNG has a `.png.json` sidecar with the exact prompt, spec, source sizes
and hashes. Validation checks dimensions, transparency, hashes and active maps.

```powershell
npm run art:world -- restore --key house_0
```

Restore only changes this asset's override and refuses to overwrite a newer
manifest edit. Local queue and activation records are required for restoration;
keep them along with raw masters when continuing production. Derived queue,
templates, prompts and review images are Git-ignored. Commit the scripts, style
brief/screenshot, generated game PNGs and sidecars, and manifest.

Vite ignores `art/` to avoid watching offline generation inputs and outputs.
Public game assets still use the normal runtime asset loader.
