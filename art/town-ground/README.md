# Town ground materials

The painted pixels the town builder's ground renderer (`scripts/lib/town-scene.mjs`) bakes the streets, sidewalks,
car parks and grass from. Everything the ground bake reads is here, so a fresh clone can rebuild the ground.

| Folder | What | Made by |
| --- | --- | --- |
| `roads/` | Road kit v4: asphalt (`asphalt-*.png`), sidewalk slabs (`slabs/`), curbs, the lamp-light pool stamp, light response (`manifest.json`) and the leaf sprites scattered along gutters (`leaves.json`, `leaves/`) | `scripts/town/roads/road-v4-sources.mjs`, `road-v4-leaves.mjs` (they write `output/road-autotile-v4/sources/`) |
| `terrain/` | Tileable grass and mud bases, grass/leaf decals and grass tufts | `scripts/town/materials/terrain-materials-art.mjs` (writes `output/terrain-materials/`) |
| `paving/` | `lot-asphalt-3.png`: the car-park asphalt (about 28 m across) | Generated texture, originally `output/paving-kit/lot-texture/` |

The street lamp drawn into the ground is the game's own sprite, `public/assets/generated/world/streetlamp-*.png`.

To change a material: regenerate it with its tool (output lands in `output/`), review it, then copy the approved files
here, keeping the names and folder layout that `roads/manifest.json` and `leaves.json` refer to.
