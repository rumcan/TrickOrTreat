# Whole-network road texture review

Current request: grass is oversized; the isolated road samples cover too little of the town. Try better textures across the existing fixed street network before returning to isolated road assembly. Do not change gameplay, town layout, buildings, or collision.

- [x] Generate separate opaque asphalt and concrete pavement materials from the new isolated road artwork using built-in imagegen. Native files and exact prompt receipts: `output/town-art/road-materials/`.
- [x] Add opt-in material rendering to `buildStaticTown`. All street-covered cells receive globally anchored, rectified material UVs, including curves, intersections, full-road cells and full-pavement cells.
- [x] Preserve traced road geometry, curbs, crossing locations, buildings, collision, driveways and entrances.
- [x] Add non-repeating amber asphalt reflections from real light sources. This layout has no freestanding lamp props; nearby porch/window lights supply 36 road reflection pools.
- [x] Reduce grass base repetition from 768 to 256 screen pixels; shrink individual grass/leaf decal patches and scatter sheets proportionally.
- [x] Remove the three straight sample overlays. Keep the complete parking lot and forecourt pieces; exclude the questionable parking corner.
- [x] Export and visually inspect the native full map and district detail crops: 12,224 x 6,264 PNG, 83,397,686 bytes; quick-view WebP and Main Street/school/diner crops alongside it.
- [x] Verify TypeScript, geometry equality, complete street coverage, material UV phase and the existing town accessibility/fading test. `npx tsc --noEmit` and `git diff --check` pass. The exporter asserts unchanged geometry and all 2,247 street-covered cells retextured across 12 streets, checks ten material phase offsets, and requires nonzero reflections. All 43 doors reachable, zero road conflicts, building fade/restoration verified.
- [ ] Obtain owner review before promoting these review-only materials into live gameplay.

Run Vite on port 5192, then `node scripts/town-materials-review.mjs`. Output goes to the MAIN repository's `output/town-road-texture-review/`; the previous `output/town-materials-review/` export is preserved for comparison. The exporter checks unchanged collision, ground, props, doors and start coordinates against the default town builder, plus complete material coverage and tile UV offsets. `node scripts/town-static-check.mjs` exercises the unchanged default town and building fading.

Implementation: `src/game/town-road-materials.ts`, optional third builder argument in `town-static.ts`, and review-only `town-materials-review.ts`. `surfaceGround` preserves the actual underlay of partially street-covered cells, preventing stepped full-tile pavements below curved road masks. Default `buildPlayableTown()` still uses the existing artwork. No merge or publication is included in this task.

Known remaining work: complete lot/forecourt seam alignment, organic feathered soil masks, and the two unfinished individual terrain decals from the earlier request. This review is not a claim that the whole town art backlog is complete.
