# Town builder upgrade — active checklist

2026-10-13. Work on a branch of this repo (the builder is in `scripts/town-builder/`), preserving the owner's saved layout and ground plan. This changes the local builder, not the published game. Do not regenerate the town plan or overwrite painted sprites.

## Roads and editable dressing (first)

- [x] Remove upright street lamps from the baked ground. Migrated 43 posts to selectable, movable, deletable sprites; both originals preserved in `output/town-builder/migration-backups/2026-10-13T16-01-28-000Z`.
- [x] Independent reflection paint/erase tool; reflect on the current road/sidewalk material, never paste a foreign sidewalk image. Keep the existing cracked road specular response.
- [x] Pavement patch paint/erase tool using existing beige slabs; softer localized orange footprint, approximately double the previous area, with edge glints only inside the lamp pool.
- [x] Darker, quieter parking asphalt from the current material; smoothly blend driveways into it from the road.
- [x] Continuous parking sidewalks on all sides except actual driveway mouths (not whole-side removal).
- [x] Ignore out-of-map ghost road neighbours; terminate real disconnected ends with sidewalk-ringed turning bulbs. Fixed a false curb across each bulb's connecting port, caught during image review.
- [x] Direction-correct intersection centre lines, incoming-lane stop bars and zebra crossings.
- [x] Less uniform leaf sizes and drifts, concentrated at curbs and fading toward the road centre. Keep sidewalks patchy, not uniformly covered.
- [x] Renderer regression fixtures (11 checks), browser tests (7 checks), full 16,760×8,640 rebake and native-resolution review images. Old ground preserved under `map-before-2026-10-13T16-02-08-755Z`.

## Reference-derived POI presets (second)

- [x] Audit existing buildings and props before generation. Owner correction: reuse `town:fish_tackle` and `world:video_rental`; do not generate replacements. Duplicate shop trials are retained for provenance only and MUST NOT enter the library or presets. Their camera drift was visually confirmed.
- [x] Created 12 missing dressing sprites: canoe/rack, bait gear, freestanding video furniture, cartons, roller skates, and four varied litter patches. Reused bins, benches, planters, bikes and Halloween decorations already owned.
- [x] Visually checked new sprites against 2:1 projection guides and existing building artwork; numerical camera wording is not evidence of compliance. Guides were not followed for sheet framing, so reviewed crop rectangles and contacts are explicit. Uniform scaling only; no X/Y warping.
- [x] Separate transparent small-prop sheets; retained native images, prompts, receipts and individual crops in `output/town-art/builder-pois/`. Existing architecture remains unchanged; rejected duplicate trials are not registered.
- [x] Registered three deterministic presets with world-metre anchors: fishing frontage, video frontage, and walkable pavement litter. Use on existing paving; frontage groups leave the central door approach clear. They do not stamp terrain automatically.
- [x] Previewed assembled presets and tested stamping, save/reload, selection, undo and deletion in an isolated test layout. No random rotation/mirroring of lettered buildings.

Update this checklist after each implementation/verification step. Full game integration, collision import and publishing remain outside this builder pass.
