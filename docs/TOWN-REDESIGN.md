# Maple Falls: lived-in town redesign

Branch: `feature/maple-falls-lived-in`. Base: `main@f7fa8c9` (boss roster and arcade already merged). Worktree: `.codex-session/town-worktree`. Local preview: port 5192.

## Handoff rules

Read this document, `art/town/baseline.json`, `src/game/town-assets.ts` and `art/town/specs.json` before continuing. Mark each task immediately after its change. Never claim an image is installed merely because it was generated: generation, packed alpha/anchor validation, visual acceptance and runtime activation are separate stages. Keep exact prompts and raw masters. Do not merge/publish until navigation, desktop/mobile visuals and production loading pass. Do not change combat balance, premium ownership, bosses, the arcade interior or recruitment rules in this branch.

## Town-wide logic

Map stays 94×94 tiles with the existing four district gates and tutorial/rescue flow. Preserve the 128×64 diamond projection: X goes lower-right, Y lower-left, front doors on +Y. No perspective, random asset stretching, baked cast shadows or baked roads in building sprites.

Make the road grid read as a town rather than nine disconnected lots. Name the through routes, distinguish the central commercial strip from quieter neighbourhoods, join every public entrance to pavement, and add service routes behind shops. Maintain at least two tiles of clear pedestrian passage; larger boss-fighting spaces remain intentional, not empty lawns. Exact curbs and centre lines stay procedural/geometry-driven, not regenerated skew tiles.

| Area | Purpose and layout | Dressing logic |
| --- | --- | --- |
| Central Maple/Pine neighbourhood (24–45,24–45) | Existing home lots; the lower edge becomes a walkable Main Street shop row facing the road at y46. Leave the tutorial's starting sidewalk and first-house route clear. | Mailboxes at paths, bins at rear access, varied flowering gardens, worn footpaths, modest fences with gaps. |
| Main Street / downtown (24–69,39–69) | A coherent one/two-storey local retail frontage: groceries, hardware, bakery, barber, pharmacy, fish/tackle, laundromat; reuse diner and video store. Small public gathering spaces interrupt the row. | Front display windows, produce crates beside—not across—doors, planters, payphone, bikes, crosswalks, traffic lights at arterial junctions, stop signs on side streets. |
| Rear service lanes | Loading access behind the shop strip, linked at both ends; no dead-end traps. | Dumpsters, delivery crates, utility poles, cardboard and oil/wet patches near plausible sources. Never distribute identical rubbish every tile. |
| North school/civic quarter | Keep school/football and primary playground destinations; add post office/firehouse on accessible edge lots, school bus shelter and cycle parking. | Stop signs by school paths, shrub beds, bins by benches, worn dirt under play equipment. Preserve turrets and rescue gazebo. |
| East Starcade / Moonlight Court | Keep entrance and arcade portal visible; connect shops, parking and residential lanes. | Mixed parked cars, payphone and bicycle parking; litter concentrated at vending machines, planting islands at lot edges. |
| West cemetery / water tower | Keep iron fences and crypt; clear sensible paths with a few side clearings. | Ferns in shade, leaf drifts, old benches, sparse bare soil and boundary evergreens; do not clutter grave access. |
| South church/video/drive-in | Retain landmark identities and existing free/premium substitutions. Link destination paths to public roads. | Traffic/parking details at road edge, litter by snack bar, plants by seating, oil stains only where cars park. |
| Northwest rural fringe | Barn/pumpkin farm remains rural rather than becoming an urban strip. | Gravel shoulders, muddy wheel tracks, utility pole, picnic table, uneven grasses and foliage. |
| Outer woodland / minor empty pockets | Layer canopy, shrubs and ground patches; preserve clear routes and encounter space. | Use the existing nine tree variants, new ferns/grass/shrubs and varied decal combinations with contextual density limits. |

## Reuse first

Keep the six house designs and mirrored variants; oak/pine/dead tree variants; bushes, pumpkins, picket/iron fences; benches, lamps, hydrants, mailboxes and bins; four car styles; diner, video shops, arcade, schools, church, drive-in, snack bar, barn, gazebo and crypt. Keep existing clean road/sidewalk bases plus procedural curb/crosswalk/centre-line geometry. Reuse arcade litter only where its objects make outdoor sense; don't put pinball trash everywhere. The new assets below fill missing town functions and micro-detail—not duplicates of the existing library.

## Ordered checklist

- [x] P00 Create an isolated branch from latest local main; do not disturb another agent's worktree.
- [x] P01 Export holistic baseline: both free/full town layouts, road network, entrances, gates, hideouts, occupancy and current world-art inventory. Evidence: `art/town/baseline.json`, both baseline SVGs; **139 reusable world assets**.
- [x] P02 Define reuse inventory and district roles before adding art.
- [x] P03 Specify the initial missing-asset queue and each item's logical location.
- [x] P04 Draw labelled whole-town plan and exact 2:1 vector guides for every new asset. Evidence: `art/town/master-plan.svg`, `src/game/town-plan.ts`, 35 individual guides and `art/town/specs.json`.
- [x] P05 Generate, inspect and pack ALL 35 missing assets before undertaking the map rebuild. **Highest priority.** All originals, revisions and exact prompts retained; 35 PNGs pass packing checks.
- [x] L01 Replace ad-hoc placement with explicit district/block plans; reserve roads, paths, doors, rescue/turret access and alley corridors before decoration.
- [x] L02 Rebuild connected road hierarchy/footpaths and install safe junction furniture without breaking curb geometry or gating.
- [x] L03 Assemble Main Street storefronts, service alleys and civic edge lots using accepted art.
- [x] L04 Pass through EVERY macro area in the table; retain sensible combat clearings and remove unexplained empty pockets.
- [x] D01 Inspect residential subsections; improve garden variety and front/rear access cues.
- [x] D02 Inspect retail subsections; add street furniture, delivery clutter and specific shop details.
- [x] D03 Inspect school, arcade/parking, cemetery, church, drive-in and farm subsections individually.
- [x] D04 Scatter context-aware non-colliding ground decals, avoiding tiled repetition and clear entrance crossings.
- [x] Q01 Navigation regression: every door, shop, arcade portal, hideout and turret reachable after relevant gates open; no spawn in buildings; verify several seeds/free/full modes.
- [x] Q02 Section-by-section screenshots: full scene, native-size art, overlaps/occlusion, lighting, road alignment and density; fill omissions and record findings.
- [x] Q03 Mobile portrait/landscape emulation, memory/draw-time checks, TypeScript, production build and asset-loading tests. Evidence: `art/town/validation.json`; physical-phone verification remains a manual follow-up.
- [x] Q04 Commit a complete tested handoff; update outstanding list honestly. Merge/deploy only if requested.

## Asset progress (update after every generated/packed/activated asset)

Legend: queued → generated → packed → accepted → active. A generated PNG is not a completed map change.

| Task | Asset | Intended location | Status |
| --- | --- | --- | --- |
| A01 | `fish_tackle` — Pike & Pine Outfitters | Main Street east end | active; generated PNG override |
| A02 | `grocery` — Maple Family Market | Main Street | active; generated PNG override |
| A03 | `hardware` — Bellamy Hardware | Main Street | active; generated PNG override |
| A04 | `bakery` — Rose's Bakery | Main Street | active; generated PNG override |
| A05 | `laundromat` — Spin Cycle Laundry | Residential/downtown seam | active; generated PNG override |
| A06 | `pharmacy` — Maple Pharmacy | Main Street civic corner | active; generated PNG override |
| A07 | `barber` — Clip Joint Barbers | Main Street | active; generated PNG override |
| A08 | `postoffice` — Maple Falls Post Office | Civic square | active v3 |
| A09 | `firestation` — Maple Falls Fire House | School/civic edge | active; generated PNG override |
| A10 | `dumpster` — Service-alley dumpster | Behind food/grocery stores | active; generated PNG override |
| A11 | `delivery_crates` — Delivery crates and dolly | Service alleys | active; generated PNG override |
| A12 | `planter_terracotta` — Terracotta storefront planter | Shop entrances | active; generated PNG override |
| A13 | `planter_square` — Square civic planter | Civic square | active; generated PNG override |
| A14 | `traffic_light` — Town traffic signal | Major intersections | active; generated PNG override |
| A15 | `stop_sign` — Residential stop sign | Residential side streets | active; generated PNG override |
| A16 | `street_sign` — Cross-street name sign | Street junctions | active; generated PNG override |
| A17 | `bus_stop` — Town bus-stop shelter | School and downtown | active; generated PNG override |
| A18 | `phone_booth` — Corner payphone | Main Street/arcade | active; generated PNG override |
| A19 | `bike_rack` — Bicycles and rack | School/arcade/storefronts | active; generated PNG override |
| A20 | `picnic_table` — Park picnic table | Parks/farm | active; generated PNG override |
| A21 | `utility_pole` — Utility pole | Rear service lanes | active; generated PNG override |
| A22 | `produce_stand` — Storefront produce crates | Grocery frontage beside clear entrance | active; generated PNG override |
| A23 | `fern` — Shaded fern clump | Shaded gardens/cemetery | active; generated PNG override |
| A24 | `hydrangea` — Garden hydrangea shrub | Residential front gardens | active; generated PNG override |
| A25 | `ornamental_grass` — Roadside ornamental grass | Verges/parks/drainage | active; generated PNG override |
| A26 | `bare_grass` — Trampled bare grass | Footpaths/desire lines | active; generated PNG override |
| A27 | `mud_grass` — Damp garden soil | Downspouts/garden corners | active; generated PNG override |
| A28 | `leaf_drift` — Autumn leaf drift | Curb corners/under trees | active; generated PNG override |
| A29 | `paper_litter` — Discarded paper litter | Bus stops/store alleys | active; generated PNG override |
| A30 | `bag_litter` — Alley rubbish pile | Behind dumpsters | active; generated PNG override |
| A31 | `puddle` — Shallow asphalt puddle | Alley drains/carparks | active; generated PNG override |
| A32 | `oil_stain` — Parking oil stain | Parking spaces/loading bay | active; generated PNG override |
| A33 | `paving_wear` — Fine pavement cracks | Alley/older pavement | active; generated PNG override |
| A34 | `wheel_wear` — Worn grass wheel tracks | Farm/service access | active; generated PNG override |
| A35 | `gravel_spill` — Verge gravel scatter | Driveway shoulders/farm | active; generated PNG override |

## Validation / change log

### Micro-section review checklist

Every subsection has its own placement/inspection flags and brief in `art/town/section-audit.json`. Update both flags after working on that subsection; review again after neighbouring changes. S01–S25 cover front doors, rear lanes, two shopping frontages, alleys, major/minor road approaches, both schools, Starcade entrance/parking, east homes/park, relocated housing, crypt paths, historic civic forecourt, diner/video, residential lanes, church, Video Vault, drive-in cars/snack bar, farm and woodland. Do not call D01–D04 complete while any subsection remains unreviewed.

For each subsection check: logical entrance/exit; at least two tiles of main passage; foreground occlusion; useful collision shape; lighting matches neighbouring assets; variety at both building and ground level; no obvious repeated decal grid; bins/litter/soil located near a plausible source. Preserve intentional fighting space.

Relocation rule for L01: the Starcade housing block's lower two lots currently conflict with the eastern retail strip. Keep its upper row at the existing location; move only its lower row to a six-tile-high lot strip beginning (50,63), putting the house bodies at (51,64) and (57,64). Reserve those lots before tree scatter, while keeping the adjacent southern sidewalk unobstructed. Do not delete the homes or place the shops on top of them.

- 2026-10-11: branch created; current main and map code inspected; the boss/arcade work is already merged. Projection and functional paths must be preserved. Initial art queue: 35 assets. No production layout or asset overrides changed yet.
- Baseline/plan pass: exported both town modes, catalogued 139 reusable world assets, inspected the complete top-down layout, and produced 35 individual 2:1 vector guides. Reserved two-tile rear service lanes and nine new venue sites. Existing lower Starcade housing conflicts with the eastern shop strip and MUST be relocated before assembly; school roadside lamps must move around the firehouse apron. Exact generation prompts are retained in `art/town/prompts.json`.
- Art pass: all 35 initial masters generated and retained with per-image provenance. 34 sprites are visually accepted and pass alpha, size, border and ground-pivot checks; the post office is being regenerated for a more faithful 4:3 footprint. New PNGs are staged in `public/assets/town/`, not silently added to the live town. The layout/review checklist remains outstanding.

## Next action for any agent

- Art completion: post office v3 matches the vector footprint (2x pivot correction +3,-11 pixels). All 35 pass alpha/canvas/margin/pivot checks and now load as generated overrides. Initial masters and both rejected post office attempts remain available.
- Layout pass: nine venues installed in both modes; rear alleys and paved ends, Main Street promenade, school/civic lanes and Starcade walk reserved before scatter. Lower Starcade houses moved to (51,64) and (57,64); school lamps/scoreboard moved off civic lane. Five seeds per mode pass all doorbells, shops, rescue points, turret approaches, locked opening tutorial and new-building overlap checks.
- Section review: all 25 subsections inspected in normal night lighting and a placement-only view. Review notes are stored per subsection. Added chapel street/forecourt links, separate drive-in pedestrian lane, snack bar apron, Video Vault approach and farm/barn access; shifted lamps out of those routes. Contextual hydrangeas/ferns/grass, leaf/soil/parking/debris decals and street furniture enrich existing districts rather than replacing intentional fighting spaces.
- Checks: TypeScript and production build pass. Production regression loads all 354 assets, retains premium ownership gates, hides developer tools, and verifies actual touch controls, map/inventory, pause/resume at 390x844 and 844x390. These are emulated phone checks in desktop Edge, not physical-device performance guarantees. Local rendering medians were about 6ms, p95 <=14ms in the two phone viewports.

The first full town redesign and all 35 art jobs are implemented, reviewed and validated. The packed release loads all 35 town assets without errors: 17,820,839 bytes of PNGs become 2,682,648 bytes of release WebPs, with unchanged dimensions/anchors/alpha; decoded native 2x sprite storage is about 47.4 MB. Machine-readable results are retained in `art/town/validation.json`. For additional polish, retain the existing plan/provenance and add new numbered tasks; do not reset the completed checklist. Physical-phone playtesting is still a manual follow-up. Merge/deploy is not requested in this job.

## Reproducing the handoff

- Run the dev server on5192, then `npm run test:town:art` and `npm run test:town:layout`. The latter rebuilds 25 night/placement screenshots and reports in ignored `art/town/checks/`.
- Build with `npm run build`, preview on5193, then `npm run test:town:production`. The regular production regression can use `TOT_PRODUCTION_URL=http://127.0.0.1:5193/`.
- PNG masters and exact imagegen prompts are in `art/town/generated/`; original briefs are in `art/town/prompts.json`. The built-in imagegen used the original style reference plus each individual vector guide. Packing reverses guide letterboxing, measures building ground pivots and never stretches footprints independently.
- `npm run art:town:pack` repacks selected source masters; it does not activate overrides. `art:town:prepare` intentionally refuses to overwrite the preserved before-redesign baseline. Production packing changes dist only, retaining all PNG masters.
- Keep the other agent's root/main and arcade worktree untouched. This isolated branch is based on the main commit recorded above; integrate any later main updates deliberately before a future merge.
