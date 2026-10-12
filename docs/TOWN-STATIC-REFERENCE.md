# Static Maple Falls — reference-led town plan

Authoritative request (2026-10-12): match the user's supplied complete isometric town, not the previous fixed road grid. Layout is static. Build districts on their own merits, then connect roads. Only layout/art changes; return a new full image for critique. No merge/deployment or combat/balance changes.

## Composition and rules

The reference's overall silhouette is the target: wooded diamond, farm at the apex; church and cemetery together on the upper-left flank; compact two-sided Main Street in the middle; drive-in on the lower-left flank; residential terraces and garages on the right/lower edge; park on the right; diner/arcade beside the park. Preserve the existing schools in a self-contained campus off the farm-to-town approach. Unequal footprints, not equal square districts. No road through a playground, field or cinema parking bay.

Town units remain the engine's exact 2:1 dimetric projection. Every building has a planned footprint, front approach and plausible road access. Every home has a driveway. Residential garages, parking and rear storefront service lanes are actual props/ground, not painted into a monolithic background. New cars use genuine front/rear camera variants: never rotate a flat bitmap to simulate 3D.

## Work checklist (update after each change)

- [x] S01 Inspect current map and gameplay coupling. Old cross-map hedges, progression and rescue code assume the road grid; keep this visual/layout proposal isolated from live gameplay until reviewed. Reuse real sprites and painter ordering.
- [x] S02 Fix a static reference-led district plan before drawing connecting streets. Keep the previous full image for comparison.
- [x] S03 Generate direction-varied cars, different vehicle models, rear-facing stores and detached garages from exact vector geometry and the established art reference. Preserve raw masters, guides and prompts.
- [~] S04 (first pass built, not yet reviewed section by section) Assemble farm and school/civic campus; inspect field, playground and bus pull-off independently.
- [~] S05 (first pass built, not yet reviewed section by section) Assemble church/cemetery as one coherent precinct with grave paths, chapel forecourt and approach lane.
- [~] S06 (first pass built, not yet reviewed section by section) Assemble two-sided Main Street with rear-facing southern shops, rear alleys, service doors, bins and deliveries.
- [~] S07 (first pass built, not yet reviewed section by section) Assemble park, arcade/diner strip and residential terraces with every driveway and garage connected.
- [~] S08 (first pass built, not yet reviewed section by section) Assemble drive-in with screen-facing parking rows, internal aisles and one clear entrance; no through-road inside.
- [~] S09 (first pass built, not yet reviewed section by section) Connect districts with a finite set of offset main streets and local lanes, derived from their entrances; no repeated global road lines.
- [ ] S10 Export individual before/after district images; submit each before and after to image generation as a composition study. Studies are labelled concepts, never substituted for actual map evidence.
- [ ] S11 Meticulous section review: footprints, road conflicts, doorway access, parking orientation, rear-service detail, natural vegetation margins, consistent scale and lighting. Correct failures and re-export.
- [ ] S12 Run static-layout/road/door/driveway/collision invariants and TypeScript/build; export final whole-town image, labelled districts and zoomable review page. Save evidence and return link.

## Status after the second session (2026-10-12, a different agent picked this up)

The first session stopped mid-check. What was finished afterwards, all inside the same isolated builder:

- The builder threw on three conflicts and now completes: the house at (79,69) sat in the Parkway (moved one tile down, and the lane in front of it straightened); the Cinema approach ran into the protected drive-in lot (it now ends at the lot's edge, with a private gravel apron as the one entrance, and Willow Court starts from its end).
- `scripts/town-static-check.mjs` passes: 14 homes, 14 garages, 14 connected driveways, no road through a protected area, every entrance reachable, 7 vehicle variants, and a building fades when the character stands behind it (opacity 0.36, back to 1.0 on leaving).
- `scripts/town-static-overview.mjs` exports the whole town (12224x6282) with district crops and the review page. Its comparison list no longer expects a separate Lantern Row district.
- NOT done: S10 (composition studies), S11 (meticulous section review) and the rest of S12. Compared with the reference the town is still sparse: wide lawns, few trees between lots, straight streets with square corners, 14 homes where the reference has several dozen.
- New sprite art can be made with RUN instead of the built-in image tool: `rundot generate image --reference-image art/reference/style-target.webp --reference-image art/town/static/guides/<id>.png --remove-background` takes the same two inputs (style target, then geometry guide) and the same prompts.

## Handoff boundaries

The proposed layout is a real `GameMap`-compatible static scenery builder with collision and entrance data, exported through the same painter order as the game. It is not an AI-generated full-map background. Live gate timing, boss/rescue logic, shop relocation and premium ownership remain untouched during the layout review. Promotion into live gameplay requires relocating that old coordinate-coupled progression deliberately; do not silently open the entire game or relocate friends to arbitrary clearings.

New work lives in `src/game/town-static.ts`, `src/game/town-static-plan.ts`, `src/game/art/town-static.ts`, `art/town/static/` and the static review/export scripts. Prior town-review image and native asset masters are retained. Mark only work actually finished. Reference-to-vector-to-art prompts/provenance must accompany new generated sprites.
