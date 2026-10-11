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
- [ ] P05 Generate, inspect and pack ALL missing art before undertaking the map rebuild. **Highest priority.**
- [ ] L01 Replace ad-hoc placement with explicit district/block plans; reserve roads, paths, doors, rescue/turret access and alley corridors before decoration.
- [ ] L02 Rebuild connected road hierarchy/footpaths and install safe junction furniture without breaking curb geometry or gating.
- [ ] L03 Assemble Main Street storefronts, service alleys and civic edge lots using accepted art.
- [ ] L04 Pass through EVERY macro area in the table; retain sensible combat clearings and remove unexplained empty pockets.
- [ ] D01 Inspect residential subsections; improve garden variety and front/rear access cues.
- [ ] D02 Inspect retail subsections; add street furniture, delivery clutter and specific shop details.
- [ ] D03 Inspect school, arcade/parking, cemetery, church, drive-in and farm subsections individually.
- [ ] D04 Scatter context-aware non-colliding ground decals, avoiding tiled repetition and clear entrance crossings.
- [ ] Q01 Navigation regression: every door, shop, arcade portal, hideout and turret reachable after relevant gates open; no spawn in buildings; verify several seeds/free/full modes.
- [ ] Q02 Section-by-section screenshots: full scene, native-size art, overlaps/occlusion, lighting, road alignment and density; fill omissions and record findings.
- [ ] Q03 Mobile portrait/landscape, memory/draw-time checks, TypeScript, production build and asset-loading tests.
- [ ] Q04 Commit a complete tested handoff; update outstanding list honestly. Merge/deploy only if requested.

## Asset progress (update after every generated/packed/activated asset)

Legend: queued → generated → packed → accepted → active. A generated PNG is not a completed map change.

| Task | Asset | Intended location | Status |
| --- | --- | --- | --- |
| A01 | `fish_tackle` — Pike & Pine Outfitters | Main Street east end | queued |
| A02 | `grocery` — Maple Family Market | Main Street | queued |
| A03 | `hardware` — Bellamy Hardware | Main Street | queued |
| A04 | `bakery` — Rose's Bakery | Main Street | queued |
| A05 | `laundromat` — Spin Cycle Laundry | Residential/downtown seam | queued |
| A06 | `pharmacy` — Maple Pharmacy | Main Street civic corner | queued |
| A07 | `barber` — Clip Joint Barbers | Main Street | queued |
| A08 | `postoffice` — Maple Falls Post Office | Civic square | queued |
| A09 | `firestation` — Maple Falls Fire House | School/civic edge | queued |
| A10 | `dumpster` — Service-alley dumpster | Behind food/grocery stores | queued |
| A11 | `delivery_crates` — Delivery crates and dolly | Service alleys | queued |
| A12 | `planter_terracotta` — Terracotta storefront planter | Shop entrances | queued |
| A13 | `planter_square` — Square civic planter | Civic square | queued |
| A14 | `traffic_light` — Town traffic signal | Major intersections | queued |
| A15 | `stop_sign` — Residential stop sign | Residential side streets | queued |
| A16 | `street_sign` — Cross-street name sign | Street junctions | queued |
| A17 | `bus_stop` — Town bus-stop shelter | School and downtown | queued |
| A18 | `phone_booth` — Corner payphone | Main Street/arcade | queued |
| A19 | `bike_rack` — Bicycles and rack | School/arcade/storefronts | queued |
| A20 | `picnic_table` — Park picnic table | Parks/farm | queued |
| A21 | `utility_pole` — Utility pole | Rear service lanes | queued |
| A22 | `produce_stand` — Storefront produce crates | Grocery frontage beside clear entrance | queued |
| A23 | `fern` — Shaded fern clump | Shaded gardens/cemetery | queued |
| A24 | `hydrangea` — Garden hydrangea shrub | Residential front gardens | queued |
| A25 | `ornamental_grass` — Roadside ornamental grass | Verges/parks/drainage | queued |
| A26 | `bare_grass` — Trampled bare grass | Footpaths/desire lines | queued |
| A27 | `mud_grass` — Damp garden soil | Downspouts/garden corners | queued |
| A28 | `leaf_drift` — Autumn leaf drift | Curb corners/under trees | queued |
| A29 | `paper_litter` — Discarded paper litter | Bus stops/store alleys | queued |
| A30 | `bag_litter` — Alley rubbish pile | Behind dumpsters | queued |
| A31 | `puddle` — Shallow asphalt puddle | Alley drains/carparks | queued |
| A32 | `oil_stain` — Parking oil stain | Parking spaces/loading bay | queued |
| A33 | `paving_wear` — Fine pavement cracks | Alley/older pavement | queued |
| A34 | `wheel_wear` — Worn grass wheel tracks | Farm/service access | queued |
| A35 | `gravel_spill` — Verge gravel scatter | Driveway shoulders/farm | queued |

## Validation / change log

- 2026-10-11: branch created; current main and map code inspected; the boss/arcade work is already merged. Projection and functional paths must be preserved. Initial art queue: 35 assets. No production layout or asset overrides changed yet.
- Baseline/plan pass: exported both town modes, catalogued 139 reusable world assets, inspected the complete top-down layout, and produced 35 individual 2:1 vector guides. Reserved two-tile rear service lanes and nine new venue sites. Existing lower Starcade housing conflicts with the eastern shop strip and MUST be relocated before assembly; school roadside lamps must move around the firehouse apron. Exact generation prompts are retained in `art/town/prompts.json`.

## Next action for any agent

Finish P01/P04, then generate the queue using original `art/reference/style-target.webp` plus the individual guide. Save masters and exact prompts under `art/town/`, validate alpha and measured footprints, and update the asset table after each result. Only after art acceptance proceed to L01; don't replace the map with an untested random-scatter pass.
