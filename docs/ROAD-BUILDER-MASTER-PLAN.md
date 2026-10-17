# Maple Falls road builder — master plan

Updated: 2026-10-13. Status: **design and implementation backlog, not a completed production builder**.

**v4 progress (Claude, 2026-10-13):** a working ground-space builder now renders a connected 7 × 5-cell network on grass
from the painted straight's own materials (see `ROAD-AUTOTILE-HANDOVER.md` → v4). Partly covers RB-010 (painted light
reproduced from the painting's measured lit/unlit response, sidewalk spill + slab-edge catch), RB-011 (painted asphalt
hex-tiled in world space), RB-013 (fan slabs on curves, rounded tee/cross curb returns), RB-030 (world-length dash phase,
worn double yellow) and RB-041 (gutter drifts, sidewalk patches). Cell size is now 20 m, not 16 m. RB-012 scale proof,
typed ports/adapters, lots, crossings and game integration remain open.

Latest art correction: v2's invented fine-gravel material and independent glitter reflection were rejected. Active v3 reverses the actual reference artwork: extract its cracked amber reflection, then adapt the matching surface/light together to a specific straight or bend. The owner approved the v3 bend's appearance. Preserve `output/road-autotile-v3/native/painted-3.png` unchanged. The corrected straight uses **flat beige unlit concrete + localized orange/gold sidewalk reflection from the same lamp as the road**, not orange/rounded shading on every slab. Native art, receipts, before/after and pending module-registration work are recorded in `ROAD-AUTOTILE-HANDOVER.md`. Native visual approval does not certify socket fit or complete this backlog.

This is the active road plan. It supersedes continuing independently generated town quadrants, independently painted empty plots, and the seven loosely matched paving cutouts. Preserve those assets and their receipts as evidence and reusable art. Do not resume their generation queues.

The owner's latest request is to plan the reusable builder thoroughly before expanding it: beautiful painted roads, unmistakable amber wet-road reflections, exact concrete sidewalks, rich but logical variety, traffic-light intersections, a road circle, dirt/parking connections, different sidewalk widths, automatic assembly, and mobile-safe rendering. The town is static; the authoring tools can be dynamic. No new gameplay balance, merge or publication is part of this planning pass.

## 1. What success actually looks like

The builder must produce the **streets of the approved reference town**, not a diagram that merely connects and not a flat grey ribbon with orange glow painted over it.

- Cool charcoal/navy asphalt, small visible aggregate and restrained wear.
- Beige concrete slabs with regular, perspective-correct joints, a crisp dark gutter and a small readable curb lip. Orange is localized lamp illumination, not the unlit material or rounded shading on each square.
- Amber lamp reflections with bright broken glints and a textured taper; concrete and curb catch the same light. They are essential to the material's appearance.
- Lanes, crossings, parking bays and stop lines follow their road's direction and purpose, not a screen-space grid.
- Leaves collect unevenly in gutters and corners, scatter sparsely across pavements, and leave most travel space clear.
- Curved residential roads, more ordered commercial streets, generous forecourts, realistic entrances, quieter service lanes and a farm dirt-road transition.
- Town-scale variety without changing material style, scale or lighting between pieces.
- Comfortable access to doors and combat spaces; no invisible road obstructions or blocked entrances disguised by pretty art.

Two references have different jobs:

| Reference | Authority | Local file |
| --- | --- | --- |
| Owner's complete town | Street hierarchy, curves, lot access, district proportions, warm pools against dusk | `output/town-art/static/ground/trace/town-reference.png` |
| Owner's approved road-loop image | Asphalt, slab concrete, dark gutter, amber specular and autumn debris | MAIN checkout `output/road-autotile-v1/sources/reference.png`; identical to `output/town-empty-v1/tiles/crossroads.png` |

The road-loop image's framing is steeper than the game's ground projection. Preserve its **materials and lighting**, not its incompatible screen-space shape. All delivered paving follows the game's 2:1 ground projection.

Open these while reviewing: [complete reference town](../art/town/static/ground/trace/town-reference.png), [approved road material image](../../../output/road-autotile-v1/sources/reference.png), [current connected road proof](../../../output/road-autotile-v1/road-builder-proof.png). Every phase's proof should include a reference comparison, not only a new image viewed alone.

## 2. Current evidence: keep, improve, do not overclaim

Current prototype: MAIN checkout `output/road-autotile-v1/`. Source scripts live in `scripts/town/roads/`.

| Present now | Evidence | Limit |
| --- | --- | --- |
| Four-edge connectivity and 16 topologies | `scripts/lib/road-autotile.mjs`; six geometry tests pass | One road width and one sidewalk width only; not the finished system |
| Painted asphalt/concrete base modules | Shared cleaned reference, all 16 modules at 1024 × 512 | Asphalt patch is only 92 × 152 source pixels; export size is not native material detail |
| Separate paint, light, sidewalk leaves and gutter leaves | Five PNG layers for each module | 80 fully decoded layers would consume 160 MiB before browser/GPU overhead; editor layout is not a runtime asset strategy |
| Shared socket pixel checks | `check` reports 17,024 comparisons | Compares the same port across module types, not all opposite-port joins or global slab/line continuity |
| Connected proof | `road-builder-proof.png`, 7168 × 3584; 25 sections | This is a road test arrangement, not the full town or 25 points of interest |
| Click/drag review editor | `review/road-builder.html` | No typed adapters, undo, saved feature constraints or production mobile integration yet |
| Specular restored after extraction loss | Latest proof visibly has stronger amber reflections | Curb/pavement patch registration, source-light anchoring and all orientations still need a rigorous close-up gate |
| Reproducible asset/browser audit | `scripts/town/roads/road-autotile-audit.mjs --browser`; `review/planning-audit.json` | Verifies 13 native receipts, all 80 layer dimensions/alpha, light containment/ROIs and memory; desktop page loading and Clear/Reset only, not game/mobile performance |

Native AI masters are generally 1254 × 1254. The sidewalk leaf master is 1387 × 1134. Final module rasters are derived/resampled 1024 × 512 exports. Neither assembled dimensions nor software enlargement creates new native detail.

The geometry tests and raster checks were rerun on 2026-10-13. Nothing in this document certifies production performance or perfect visual seams.

The restored representative straight/curve light layers reach alpha 255 and include painted pixels on both asphalt and pavement, with none outside paving. That establishes brightness/containment, not source-accurate lighting. The audit preserves those numerical baselines alongside the browser snapshot; inspect the composites rather than raising opacity until a metric passes.

## 3. Why the previous approaches failed — and the explicit prevention

| Observed failure | Cause | Required prevention |
| --- | --- | --- |
| AI quadrants changed layout and could not be stitched | The generator was asked to divide/reconstruct the scene; every output reinvented detail | Local coordinates, local cropping and local assembly own geometry. AI does not split or stitch the town |
| Even locally cropped and enlarged chunks developed seams | Independent redraws changed surfaces, perspective and edge content | Shared master pixels and immutable connector collars; no full-town redraw for a module |
| Adjacent painted town tiles drifted in style | Conditioning each new tile on the last amplified style/scale errors | Every art request uses the original material master plus a deterministic guide; never a chain of descendants as sole style authority |
| Empty road-loop plots still did not join | Visually approximate ports are not exact positions, widths, tangents or slab phases | Typed port contract and opposite-edge raster/geometry tests, followed by native-size seam review |
| Isolated large paving pieces covered only a fraction of the town | They had arbitrary silhouettes and no interoperable connectors | A finite base vocabulary plus adapters and macro-pieces; large cutouts become source art, not automatic network units |
| Road aggregate had a grid or stretched around bends | UVs reset per cell, or a cross-road profile was wrapped over asphalt | Globally anchored, isotropic ground-space asphalt; road-relative gutter/curb mapping only where appropriate |
| Sidewalks were skew or had interrupted joints | Flat PNG rotation, approximate AI camera, arbitrary stretching and local joint phase | Ground-coordinate orientation; fixed widths; separately rectified slab/curb sources; shared joint anchors |
| Zebra stripes ran the wrong way | Screen-space orientation was mistaken for road-relative orientation | A crossing spans the road; each stripe's long axis follows traffic. Project from the ground basis |
| Bright specular did not survive extraction | Clipped to asphalt, excluded the lit curb, then repeatedly attenuated opacity | Preserve painted glint, curb and sidewalk as one light recipe; composite-test against the source, not alpha statistics alone |
| Specular can become an orange blob or a lit bar crossing the pavement | Broad colour-based extraction includes unrelated lit concrete and does not register material regions | Region-specific asphalt/curb/concrete patches, shared lamp anchor, measured mask; reject broad slab-wide rectangles |
| Some parking corners/entrances were implausible | Visual cutouts were accepted without real access and turning-space checks | Lot portal, curb opening, pedestrian apron and reachable road connection are mandatory |
| Buildings, cars, bikes and grass had inconsistent scale | Independently sized art, no shared calibration image | One scale proof with kid, car, door, house, lane and slab before mass production |
| A road grid dictated parcels; roads ended under playgrounds/cars | Layout and decoration were added independently | Parcels and protected corridors first; explicit road graph; compiler rejects overlaps |
| Too much repeated vegetation/debris hid weak ground art | Repetition was used to disguise joins | Roads must pass on bare neutral backing before dressing; decoration cannot hide broken geometry |
| Thousands of small overlays were too expensive | Authoring layers were treated as per-frame game draws | Offline compose sparse ground chunks; stream/cull a small working set; no runtime per-leaf objects |

**A successful metadata test does not override a visibly bad result. A beautiful standalone image does not override a broken connector. Both gates are required.**

## 4. Architecture: a graph, a painted kit, and a static-map compiler

```text
Authored road graph + parcel/access reservations
                 ↓
Typed ports → adapters → geometry/curb ownership → walkability
                 ↓
Shared painted materials + markings + anchored lights + seeded debris
                 ↓
Native connected proofs and validation
                 ↓
Offline quality-tier chunk bake → existing Canvas2D ground pass
```

The road builder is an **authoring/compiler system**, not a requirement to build every road from five live sprites every frame. The owner can edit roads dynamically in the review tool; the shipped town remains fixed and cached. Preserve JSON authoring data so the kit works for the next map too.

The first 16-way mask is an efficient selector for equal-profile, orthogonal ports. It is not enough for all materials/widths. Extend it with typed ports and reserved macro-pieces rather than forcing every combination into an enormous atlas. Edge matching is a well-established road-tile approach; mixed edge/corner sets grow quickly, which is a reason to keep cosmetic and geometry variants separate. [Tiled terrain documentation](https://doc.mapeditor.org/en/stable/manual/terrain/).

Automatic placement/decorating is a separate rule pass, not geometry chosen randomly. Tiled's rule-based automapping is a useful reference for this separation; the existing custom Canvas2D engine does not need a new editor dependency. [Tiled automapping](https://doc.mapeditor.org/en/stable/manual/automapping/).

## 5. Camera, units and scale contract

Fixed projection: orthographic **2:1 dimetric**, camera heading 45°, pitch 30° below horizontal, roll zero. Ground axes project at ±26.565°, not true-isometric ±30°. At prototype scale:

```text
cell side = 16 authored metres; axis scale = 32 px/m
project(x,y) = (512 + 32(x-y), 16(x+y))
module ground extent = 1024 × 512 px
```

The source frame is 1254 square with diamond corners `(627,371)`, `(1139,627)`, `(627,883)`, `(115,627)`. Orthographic camera-right framing is approximately 27.71m, not the old 80m full-plot frame. Keep camera geometry and framing as separate fields. Imagegen camera wording is guidance, not a precision guarantee; the code-owned projection is authoritative.

**Proposed integration calibration:** one current game world tile represents two authored metres, so a 16m road module spans 8 × 8 game tiles. This follows from current `HW=64`, `HH=32`; it is a proposed visual calibration, not an existing physical-world simulation. Verify before adopting. Do not rescale speed, hitboxes or combat balance to compensate for art.

Scale proof must show one child, a 4.3–4.8m car, a doorway, one existing house, a shop frontage, a 6.5m road and the same concrete slabs. Use ground footprint, not sprite bounding-box height, for alignment. Refit an asset's anchor/footprint or generate a true orientation variant; do not stretch whole buildings/cars to force them into a lot.

Create material sources at enough native texel density for the final camera. The current tiny asphalt crop is a prototype limitation. Prefer a larger clean extraction; if inadequate, request one tightly controlled high-detail material master using the approved source. A flat material-only source may be rectified top-down for sampling; delivered road modules remain dimetric. Reject giant gravel, giant cracks and flower-sized leaves.

## 6. Typed connection contract — preventing combinatorial explosion

Every open port records:

```text
position + outward tangent
surface family + paved width + lane count
left/right sidewalk width + curb/shoulder treatment
curb opening interval, if any
boundary material sample/phase + slab joint anchor
line style + marking phase ownership
```

Left/right are relative to the directed road tangent. Opposite outward tangents reverse that convention: validate A-left against B-right, not A-left against B-left. Normalize into a shared edge basis before testing.

Default ports remain at the four diamond-edge midpoints. Non-midpoint entrances and angled sockets belong to declared macro-pieces with explicit external ports; do not quietly move a normal connector to fit art. Candidate port collar is the current 2m; large features must be large enough to leave it intact. Collar geometry must be straight/tangent-continuous, not just recoloured after an incompatible bend has already been generated.

Specific v1 audit issue: its curve starts bending after a 1m straight stem although the colour socket is declared 2m deep. The current checks sample only the first 0.8m. Extend true straight geometry to the full collar and adjust the arc/macro footprint; widening the checked area without solving this would merely expose a defect, not fix it.

Planned road profiles (dimensions are initial art calibration values, reviewable together):

| Profile | Asphalt/ground width | Purpose | Default sidewalks |
| --- | --- | --- | --- |
| Residential | 6.5m, two lanes | Most town roads; approved material identity | 1.8m each side |
| Main Street | 7.5m, two lanes | Shops, signals, selective curb parking | 3m commercial side; 1.8m opposite |
| Service lane | 3.5m, one lane | Alleys, loading and access roads | 0 or 1m |
| Farm dirt road | 3.5m | Farm/rural entrance | No curb; painted dirt shoulder |
| Parking/forecourt | Open area; 5.5–6m entrance where appropriate | School, church, drive-in, diner, gas station | Deliberate pedestrian apron, not a sidewalk ring across the opening |

Independent side presets: **none 0m, thin 1m, standard 1.8m, thick 3m**. A street can have different widths on its two sides. These are stable authored choices, not random per-piece choices. A width change requires an explicit taper/adapter; never stretch the adjacent PNG.

Do not generate every product of width × material × two sidewalk widths × marks × lights × debris. Keep:

1. A small library of approved geometry families.
2. Shared asphalt, concrete and curb material sources.
3. Explicit structural adapters where contracts differ.
4. Separate cosmetic recipes compiled only for combinations actually used by the map.

Unsupported connections show a warning and remain invalid. No nearest-looking fallback, silently capped through-road, or hidden curb across an entrance.

## 7. Geometry kit: simple parts and genuinely useful complexity

| Family | Minimum deliverable | Automatic behaviour and safeguards |
| --- | --- | --- |
| Standard topology | Existing 16 masks, improved geometry and paving | Select from neighbours; isolated tile is a test/editor state, not a normal town road |
| Straights | Both projected axes; gentle wear variants | Continuous material/marking phases; edits do not reshuffle distant variants |
| Curves | Standard quarter-bend; broad 2 × 2 sweep | The current 7m centre radius is tight for a road plus sidewalks; broad sweeps need reserved footprint, not a forced 1-cell squeeze |
| S-bend/offset | 2 × 2 or longer macro | Tangent-continuous ends; preserve clear inside pedestrian width |
| T/X junction | Four T orientations and X; softened curb returns | One asphalt union; remove internal curbs and duplicate dark outlines |
| Angled junction | One controlled skew-T after the orthogonal kit passes | Explicit tangent/port declarations and larger footprint; no screen-space PNG rotation |
| Cul-de-sac | Small dead end and larger residential bulb | Room for a clear turnaround; no centre line crossing the cap |
| Road circle | A 3 × 3 minimum roundabout macro, scalable after review | Explicit island and four optional entries; logical lane circulation and connections |
| Width adapter | Service↔residential; residential↔Main Street | Taper over at least one full section; lanes and sidewalks transition together |
| Sidewalk adapter | Each width pair, plus one-sided termination | Short joint-consistent taper/termination; cannot leave a blunt wall at a walkway |
| Surface adapter | Asphalt↔dirt; asphalt↔lot | Asphalt ends naturally; no curb sealing the entrance; shoulder debris and wear make the transition believable |
| Entrances | House driveway, narrow alley, full parking entrance, separate forecourt entry/exit | Cut curb and gutter only where access requires; preserve through-walkway or a correctly painted apron |
| Parking geometry | Single/double rows, corners/end bays, open apron, service yard | Spaces obey car size; reserve aisle, door approach and connection before decoration |

The roundabout is not four corner PNGs overlapped to fake a circle. Candidate dimensions: outside paved radius about 12m, 6m travel ring, central island radius about 6m, plus outside pavement/curb. A 48m footprint accommodates transitions. Final dimensions come from the scale and walkability proof. The island may be low planting/Halloween decoration; any tall fountain/sign/tree is a separate occluding prop.

Macro ports must still line up with real neighbouring connectors. An even 2 × 2 macro's edge midpoint lies between two ordinary module ports: putting a port there would create an unjoinable half-cell road. Use explicit valid edge offsets (8m or 24m on a 32m side) or an explicit registered adapter. Odd 3 × 3 macros can use their edge midpoint (24m on a 48m side). Validate each external port against the adjoining cell/graph before generating artwork. Do not confuse a convenient macro centre with a valid socket.

The kit's grid is an assembly aid, not a requirement to divide the town into identical square parcels. Keep the authored road graph and parcel dimensions independent of exported chunks. Reserved sweeps/offsets join sites at their required positions; if an irregular route cannot be expressed by an approved piece, add a measured macro with valid sockets rather than move buildings onto a compulsory global street grid. Arbitrary spline editing is a later extension using the same material/boundary compiler, not a reason to skip the finite kit's seam gates.

Do not add an invisible roundabout obstacle. Island collision exists only where visible solid decoration/raised structure requires it; asphalt/paving remain navigable. This is visual town planning, not a new driving simulation.

## 8. Perfect sidewalks: a first-class subsystem

The curb establishes structure; paving is fitted to it. Use distinct painted sources for concrete slab surface, gutter, curb top and camera-facing lip. Do not map the entire cross-road strip across each new width.

1. Solve the full road/lot asphalt union first.
2. Determine outer boundaries and explicit curb openings.
3. Offset each boundary by its selected pavement width; detect self-intersections and thin inside corners.
4. Give each boundary a stable direction and arc-length coordinate.
5. Place slab rows at **fixed physical size**, with a shared joint anchor at ports.
6. Sample approved painted slab joints; do not draw a new vector grid over the pavement.
7. Use dedicated raster corner fan/miter pieces where rectangular joints would stretch.
8. Bake gutter, curb lip and concrete once, with unique boundary ownership.

Thick sidewalks add rows rather than enlarge slabs. Thin sidewalks use fewer rows/cut edge pieces. No-sidewalk roads still need a deliberate termination: curb-only, rolled edge or dirt shoulder; removing concrete must not leave a glowing line hanging in grass.

Inner and outer curves have different lengths. A joint cannot be made uniformly square across an arbitrarily tight curve by stretching the texture. Use authored fan segments for tight turns; subdivide broad bends along arc length. Reject curves whose inner pavement collapses. A full closed loop rarely has an integer number of slabs: put one intentional cut slab at a least-visible planned break, not a joint jump at every tile. Bound small spacing correction to roughly 2%; otherwise add the cut piece.

Junction corners are semantic features, not the accidental `min(distance-to-arm)` result. Add curb returns, optional dropped crossings and deliberate corner slabs. Test no inner curbs remain across asphalt unions or lot entrances. Concrete/gutter colour must remain identical in all widths and orientations.

## 9. Asphalt: detailed, continuous, not a repeated carpet

Separate grain, large-scale wear and lighting:

- **Grain:** one approved rectified, genuinely repeatable raster source, globally anchored in ground coordinates. No independent random rotation per module, no reset at cell origin and no inflated stones.
- **Road-relative wear:** subtle painted patches following traffic/gutter direction; unmarked lane centres remain readable. Rare repaired patches, oil marks and drain surrounds are raster decals, not new road texture families.
- **Macro variation:** two or three restrained clean/worn/damp source recipes matched for colour and density. Transition over a planned patch, not an abrupt material switch at tile edges.
- **Specular:** separate authored light recipes, described below. Do not put the same lamp streak in the grain texture or it repeats everywhere.

If two-way road wear is directional, use longitudinal arc-length mapping only for that wear; do not stretch aggregate along the same coordinates. At intersections use one shared ground-space grain field, with clipped wear entering from each arm. Do not ask AI to create a unique asphalt identity for every topology.

The existing toroidal overlap extraction is an expedient prototype. Check its 4m repetition at native zoom for visible waves/grid/blur; replace the source master if those patterns remain. Blending a bad patch into periodicity is not proof of a good material.

## 10. Specular: highest-priority visual gate

Here “specular” means the **painted damp-asphalt reflection of a warm town light**, not a real-time PBR shader. The required look is in the approved reference: textured broken amber sheen with a bright curb catch and a taper into cool road. No generic circular gradient, flat orange puddle or white bloom.

### Painted light recipe

Each recipe records a light anchor at a believable roadside location, orientation, footprint, paint source and region masks for asphalt / dark gutter / curb / concrete. Asphalt receives a narrow textured streak; the curb catches a sharper bright edge; the pavement receives a softer spill. All belong to **one pool** and align to the same source.

Use the original bright painted pixels at native resolution. First improve extraction/registration; generate replacement light art only where the source lacks the orientation or surface treatment needed. A paired lit/unlit image is useful only if geometry and material pixels actually remain registered; imagegen may redraw them, so do not assume the difference is a valid light map.

The present red-minus-blue threshold is a temporary extraction heuristic, not the final material method: it can discard pale/yellow glints or include unrelated warm concrete. Prefer a measured region mask and a source-registered painted replacement patch. Feather the transparent boundary **once**; do not multiply an already feathered alpha a second time. Do not add to or screen-blend the whole image and wash out the asphalt. Start with normal source-over, tune on the actual composite, and keep a before/after source proof.

### Placement rules

- At most one owned pool per road section; many sections remain unlit. No repeated stripe of identical lights on every tile.
- Macro-pieces enumerate their internal road sections and light owners explicitly. A circle can have a few well-spaced pools owned by different sections; one pool clipped into two chunks still counts once. Do not interpret a macro's size as permission to stack several reflections on the same short road stretch.
- Default lamp interval approximately 24–32 authored metres, varied by street function and actual available frontage; close junctions get a coordinated plan, not independent random pools.
- Prefer real lamp/porch/storefront anchors. New freestanding lamps use existing sprites if their scale/style work; art request must not bake poles into the road.
- Strong specular on damp asphalt persists in **all** quality tiers. Reducing resolution/debris must not remove the part the owner explicitly values.
- Pools crossing a module/chunk boundary have one global owner and are clipped from the same image into both chunks. Never double-composite them or force a black gap at the socket collar.
- Suppress a second overlapping pool, or assign the brightest single source; do not stack several orange washes in one short section.
- Ground-plane transformations change orientation; do not mirror/rotate the finished lighting blindly. Camera and ambient direction stay fixed. Generate a genuinely different orientation if reprojection cannot preserve the material treatment.
- Markings under illumination receive the appropriate light/occlusion treatment; simply painting opaque yellow over the finished glint makes a pasted-on stripe.

### Acceptance and regression

Compare unlit/lit/source side by side at 100% and at real gameplay/phone zoom. Confirm recognizable grain inside the bright streak, bright curb catch, controlled soft concrete spill, no rectangular patch, no glow on transparent grass and no clipped halo. Save small golden-image fixtures for each orientation and a connected seam-spanning pool.

Record alpha occupancy/peak and composite luminance/colour contrast in a fixed ROI relative to its unlit neighbour. Numerical thresholds are calibrated from the accepted source proof, not invented to make a failing image pass. A bright alpha value alone says nothing about whether the reflection looks right. The current stronger extraction is visible in the rebuilt proof, but **source-anchored, region-accurate glints remain the first implementation milestone**.

## 11. Markings, crossings and traffic-light (“robot”) intersections

Road markings are the only visible road content permitted to be vector-drawn. Create them in **ground coordinates**, antialias once at bake time, add slight transparency/wear, then export raster layers. No runtime line renderer is required.

Marking recipes:

- Residential yellow centre dashes; double-yellow Main Street sections where appropriate.
- Unmarked service/farm roads; selective white edge/lane lines, not decoration on every road.
- Correct zebra/ladder crossings, stop bars and turn arrows at declared pedestrian/junction sites.
- Parking bays, accessible-bay markings, fire/loading zones and entry/exit arrows where useful.
- Roundabout yield entries and circulation marks; centre dashes do not cut through the island.

Use street/segment-owned arc-length phase, never `dashPhase=0` for each tile. The current 16m section and 3m dash period do not divide evenly; tile-local phase will visibly restart. At junctions terminate centre lines before the crossing/stop line, and choose a deliberate outgoing phase. Around a closed loop choose a compatible total pattern or put the phase reset at a marked junction; do not squeeze one conspicuously short dash into a visible curve.

Crossing orientation rule: the group bridges the two sidewalks **across** traffic; each long stripe is **parallel to traffic**. Construct it from the local tangent/normal, then project. Keep stripes within asphalt except an intentional dropped curb landing. A curve crossing belongs to a short nearly straight approach, not the tightest part of a bend.

Interpret “robots” as traffic lights. Add a few coherent signalized Main Street intersections, not a dense modern-city traffic scheme. Generate/reuse period-appropriate American signal/stop-sign sprites separately; poles are colliding, depth-sorted props anchored to safe pavement corners. Signal lens animation is optional and tiny. It must not introduce waits, red-light collision or moving car gameplay without a new request. Align crossing ramps, stop bars and poles as one junction recipe. No pole in a doorway or travel lane.

Automatic defaults are based on authored street roles: residential T/X gets a simple junction and selected stop-controlled crossings; a designated busy Main Street crossing gets the signal recipe; a lot portal gets an apron, not a miniature intersection; farm/service connectors stay unmarked. The owner can override these recipes. Use one consistent American right-hand traffic convention for arrows/sign placement, and a period-appropriate town rotary appearance rather than conspicuously modern junction furniture.

## 12. Parking lots, dirt connections and pedestrian continuity

**Parking:** use the same asphalt family with a slightly quieter/worn recipe. The entrance is an actual connected portal with curb/gutter interruption and a flatter apron. Through-sidewalk can cross a residential driveway with appropriate paving; a full lot entrance needs a coherent crossing treatment, not a curb wall. Reserve an aisle of roughly 6m for 90° bays, bays around 2.5 × 5m, and an accessible front walk. Review sizes against current cars, not merely those numbers.

Support single/double bay rows, small nose-in courts, angled bays later, corners/end bays and a pedestrian-only small paved court. A court with no viable car entrance must not be filled with cars: use bikes/motorcycles where plausible, as the owner requested. Large drive-in/car parks get explicit gate/entrance and exit. Do not route a road underneath parked cars, screens or queue equipment.

**Dirt:** an asphalt-to-dirt adapter has a ragged but clear paved end, dark worn threshold, shoulder transition and fading tyre wear. It must be authored from matching reference materials with a transparent irregular edge, not a brown vector rectangle or a broad soil-generation project. Source dirt can be reused from existing terrain art. Lines stop deliberately, sidewalks terminate safely and any ditch/solid border leaves the connecting passage open. Avoid a bright amber asphalt glint copied onto dry dirt; softer painted light can accompany a real farm lamp.

**Sidewalks:** preserve a continuous pedestrian route to every intended door. At a change of width, taper the outer edge while maintaining the curb line if road width is unchanged. At a road widening, coordinate both road and curb shifts. Do not fill an irregular residual wedge with a giant stretched concrete texture; use an explicit small apron/transition.

## 13. Debris and lived-in variation without clutter

Reuse the two generated leaf sources as starting material, but do not accept their current repeated narrow bands as final distribution. There must be genuinely different sparse scatter, broken drift and little corner accumulations. Sources stay separate from base paving and specular.

Use a stable seed derived from map seed + persistent segment/feature ID + material side. Choose placements at compile time. Rules use road context, not a coin flip for each tile:

- Gutter leaves concentrate near low edges, drains and quiet inner bends, with gaps.
- Sidewalk leaves are sparse with small clusters at steps/planters, never a uniform floral border.
- Main Street is cleaner near shop doors; alleys may have restrained paper/can litter.
- Parking may have an occasional oil patch or faded repair; driveways stay open.
- Keep crossings/stop bars/door approach and interaction markers legible. Avoid covering the brightest glint with a leaf carpet.
- Details do not own collision. Solid bins/planters/parked bikes are separate props with footprints.

Candidate supporting raster art: three sidewalk-leaf patches, three gutter drifts, two tiny paper/can scatters, two subtle asphalt wear/repair patches, one drain and one manhole set if existing art cannot be reused. First inspect existing assets; do not generate a large unrelated props backlog.

Variation must not change structural pixels at connectors. A local edit must not reseed the whole street. The current editor's sorted-index `%6` lights and `%3` leaves will move when an earlier cell is added; replace this with persistent feature ownership.

## 14. Automatic build/edit rules and authoring UX

The editor's default action draws a named road profile, not arbitrary art. It should show a ghost preview, snap valid connectors, update nearby topology and display invalid joins visibly.

Required controls: profile; left/right pavement; curvature/sweep; junction type; lamp recipe; automatic debris density; erase; undo/redo; load/save JSON; reset; export proof; layer toggles; zoom/pan. Separate geometry options from dressing so the owner can inspect bare connections. Include source/provenance and scale ruler overlays only in review mode; they never ship as grids on the road.

Compiler ordering is fixed:

1. Validate authored roads, parcels, external ports and macro footprints.
2. Resolve connectivity and explicitly insert allowed adapters; preview the occupied footprint before commit.
3. Build asphalt unions and boundary/curb ownership; solve sidewalk paths and openings.
4. Validate pedestrian/door/lot access and gameplay clearances.
5. Resolve global material and joint coordinates.
6. Apply marking/junction semantics.
7. Bind actual light anchors, choose single-pool ownership and source orientation.
8. Add deterministic context-aware debris/wear with exclusion masks.
9. Validate source art and connected native proofs.
10. Bake requested chunk/tier and write placement, collision and quality manifest.

Edits invalidate the touched features, connected material-phase run if necessary, nearby decoration exclusions and intersecting chunks. Do not globally re-randomize. Macro placement is atomic and cannot be partly erased into broken quarter pieces. Undo includes adapters/reservations, not just the clicked cell. Import/export records schema version and stable IDs.

Every authored feature has an explicit intent and stable key, for example:

```text
feature id: maple-main-west-junction
role: Main Street / junction
ports: typed N,E,S,W with world positions and reciprocal neighbour IDs
sidewalks: commercial side thick, opposite standard
recipe: signal junction, marked crossings
light anchor: lamp-main-west-01; at most one owned pool in this section
access reservations: shop doors + alley portal + pedestrian apron
dressing: contextual, seeded from feature ID; excluded from crossings/doors
```

This metadata drives art and validation. It must not be inferred from the colour of the finished picture or silently regenerated from the order in a list.

## 15. Town planning: use the reference hierarchy, not a compulsory grid

Use the complete reference image throughout reviews. The builder should support:

- Farm near the upper edge, with a quieter dirt/service branch.
- School and church/cemetery districts with connected frontage, forecourt and correctly entered lots.
- Central Main Street shop rows, broader pavements and selected controlled crossings; rear loading/service access.
- Park ring road/road-circle feature, with generous internal pedestrian/combat space.
- Gas/diner roadside forecourts with meaningful entrances, not floating disconnected asphalt.
- Drive-in lower-left with car circulation and a genuine street portal.
- Curved residential loops, individual driveway curb cuts and garages; not identical house-and-tree stamps.

These are reference-compatible layout goals, not a mandate to reproduce every pixel or restart the town art. Start with one composed demonstration district containing shops, a home, a signal junction, a broad bend, a small circle, lot entrance and farm-lane adapter. Use existing building art where orientation works; scale buildings intentionally, props modestly. Reserve sites and corridors before dressing.

No new trees are baked into road assets. Existing varied Halloween decorations/trees can later dress lots and pavement edges without hiding errors. A full-town assembly comes only after the road proof and scale district pass.

## 16. Rendering and performance: keep the look, remove the repeated work

The existing game uses Canvas2D, view-culls `floorChunks`, caps DPR at 2, and already packs road overlays in `src/game/town-ground-chunks.ts`. Reuse that route. Do not add a GPU/PBR renderer or thousands of live decal objects to solve a static ground problem.

Authoring layers remain editable masters, but **offline bake** asphalt + paving + markings + static painted specular + selected debris into tight sparse ground chunks. Preserve independent inputs so a low-detail bake can omit leaves without repainting the road. Pre-rendering static/repeated canvas content is supported by the Canvas API performance guidance. [MDN canvas optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).

### Proposed quality tiers

| Tier | Pavement, road lines and amber specular | Optional debris | Asset residency |
| --- | --- | --- | --- |
| High | Full approved detail | Full context-aware dressing | Higher-resolution visible chunks, bounded cache |
| Balanced | Same material identity/glints; lower raster tier if needed | About half density, no tiny litter | Smaller visible cache |
| Low | Keep clear curb, crossings and the full light recipe | Leaves/litter omitted | Reduced-resolution chunks; lowest bounded cache |

A “road debris” setting selects a different baked recipe/manifest. Hiding a checkbox does not save draw calls or decoded memory if debris was already baked and the same images are still resident. Do not keep high and low chunk sets decoded together. Swap visible chunks incrementally, release the old set, and keep collision byte-identical.

### Memory and workload

- Current 80 authoring layers: `80 × 1024 × 512 × 4 = 160 MiB` of raw RGBA, before extra copies. Do **not** preload all of them in the game.
- Current full 7168 × 3584 proof: approximately 98 MiB raw RGBA. It is a review export, not a runtime monolithic image.
- A 1024 × 512 RGBA chunk is 2 MiB; a 512 × 256 chunk is 0.5 MiB. PNG/WebP file size is not decoded-memory size.
- Initial mobile road-only cache target: ≤24 MiB decoded, ≤8 MiB temporary work. Initial desktop target: ≤64 MiB road-only. These are design budgets, **not measured guarantees**; count decoded images, canvases and duplicate backing resources.
- Stream visible chunks plus a one-chunk guard band, prioritize the camera centre and cap cache by actual bytes. If the guard band exceeds budget, lower the requested tier or retain fewer offscreen chunks; do not allow unbounded allocation.
- Prebake at native/half tiers and benchmark. Choose tier by actual projected pixels at current zoom/DPR, not by “phone” alone. Do not upscale a low tier conspicuously at large desktop zoom.
- Track image lifetimes. Close unused ImageBitmaps if used, release canvas stores and object URLs, and remove retained source references; merely culling a draw does not free memory. [MDN ImageBitmap resource lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/transferToImageBitmap).
- Workers/OffscreenCanvas are an optional load-time enhancement with an ordinary-canvas fallback. Do not make the map depend on that API just to be playable.
- Keep lossless painted masters. Test lossless WebP/PNG for release assets and compare any proposed lossy encoding at curb joints, dark asphalt, translucent leaves and amber glints; bandwidth savings cannot silently erase the specular. Fix colour-profile/alpha consistency across encoders before approving a release tier.
- No per-frame `getImageData`, UV sampling, line construction, leaf placement, `shadowBlur`, glow filtering or full-town baking. Ground draw cost is a small number of cached visible chunk draws.

Bake chunk edges with source-context bleed, then crop exactly once. At runtime use one camera transform and consistent destination coordinates; independent per-chunk rounding creates gaps. Keep alpha premultiplication/resampling consistent. If an atlas is used, extrude transparent edge colour to prevent filtered halos, but do not overlap opaque sidewalks to conceal bad joins. Test fractional camera movement and zoom, not just integer screenshot positions.

Initial performance gate: road rendering must fit within roughly 2ms median / 4ms p95 on a named representative phone and preserve the game's measured combat frame rate within about 10% of its baseline. These are targets to refine after measurement, not universal hardware promises. Record baseline and new road-only/full-frame p50/p95 over the same 60-second combat route; also test a 10-minute pan/run for allocation growth. Emulated phone viewports do not prove phone performance.

## 17. Gameplay/collision contract

Use the same graph-derived ground masks for visual access and collision clearance. Roads, pavements, driveways, paint, leaves and light patches are walkable. Curbs are visual unless existing game rules deliberately make a visible object solid; never treat a thin drawn curb as an invisible wall.

Props/architecture keep explicit footprints. Validate all door approach points, arcade portal, shops, rescue locations, starting position and street connections. Use current `blockedCircle`/collision grid as authority for the actor, not only point flood-fill. Door and path clearance must accommodate the player plus margin; two-way companion movement needs a wider channel. Plan for enemy approach routes and broad combat sites.

Different quality tiers and leaf toggles never change collision. Surface/sidewalk width presets are **authoring choices**; do not swap them at runtime as graphics settings and move walkable space underneath actors. Keep destruction/gate/door changes separate from baked ground, invalidate only affected dressing if needed, and do not bake movable shops or destructible cars into the street.

## 18. Image pipeline: exact construction, controlled painted detail

Follow the imagegen skill using the built-in generator. No alternate paid API/CLI route without explicit permission. For each asset inspect refs, save a structured prompt and reference hashes, preserve native PNG/alpha and actual dimensions, record native vs derived rasters, then inspect the composite.

Primary input roles for a new module:

1. **Edit target:** deterministic grass-backed paving guide built from approved painted source pixels with exact ports and slab anchors.
2. **Style master:** the approved original road material/lighting reference; never a drifted neighbour as sole master.
3. **Optional detail insert:** a labelled exact source for a missing curb corner/light/decal.

Ask for one module/recipe at a time. The initial guide may use transparent/colour masks for geometry instructions, but **final asphalt/concrete/curbs remain painted raster**, not vector colours. Grass is a temporary extraction background or review backing, not part of the shipped road atlas. The owner can supply/background-paint grass/soil; this plan does not restart a grass-generation job.

The successful workflow is: geometry guide → restrained paint edit → native review → transparent extraction → compare footprint → locally enforce approved connectors → export orientation variants in ground coordinates → connected proof. Preserve failed curve/end attempts: one reframed the curve, one turned the end into a straight. Do not accept an output just because the prompt asked for fixed geometry.

Connector restoration can fix local edge pixels, not a fundamentally wrong centreline/tangent. Reject major reframing or incompatible silhouettes; regenerate that one module or texture-map shared art deterministically. Repeated retries do not expand the approved geometric tolerance.

Large buildings remain individual high-resolution sprites, not on sheets with small debris. Flat wear/debris can be baked; occluding lamps/buildings/bins remain props. Do not ask the generator to make a whole stitched town or upscaled quadrant in this phase.

### Reusable prompt contract

Every job embeds the same period/palette/camera/material block plus its geometry/region-specific constraints. Include: 1985–1992 American small town, Halloween early evening, cool navy ambient, restrained warm amber wet-asphalt glints, exact master concrete/gutter, fixed framing, no trees/buildings/poles/lines/leaves unless the specific recipe requests them. Mark which image is the edit target and which is style only. For a light job explicitly request the curb catch and pavement spill rather than only “small central glow.” For cutouts request actual alpha, no restyling/reframe or fake checkerboard.

Prompted resolution is not output resolution. Measure it. Preserve a receipt for every accepted/rejected native asset and its downstream dependencies; changing a source requires invalidating every bake that used its hash.

## 19. Acceptance gates: pictures, geometry, and the running game

### Gate A — material/scale/light calibration

One straight source comparison, both road axes, one curve, all sidewalk widths, a kid/car/house proof, and lit/unlit/source crops. Inspect at 100% and actual desktop/phone zoom. No expansion until concrete and specular look right.

### Gate B — exhaustive compatible joins

Test all compatible opposite-port pairs, orientations, widths and structural adapters at native resolution. Compare connector silhouettes, tangents, widths, joint phase and material continuity in shared coordinates. Current same-port comparisons remain a regression check but are insufficient alone.

Also test S-bends, closed-loop phase closure, T/X curb unions, macro reservation, no double light/curb ownership, dirt shoulders and lot apron openings. Treat line/debris/glint overlap and inverse projection as separate fixtures. Test alpha over black, light and intended grass backgrounds; no green fringe, floating paving or false transparent corners.

The seam board should deliberately include awkward cases: thick-on-one-side through a rotated curve; a service road joining Main Street; a road↔dirt join beside a narrow sidewalk termination; a parking apron touching a junction; and a lit pool spanning two exported chunks. If a combination is unsupported, validation must reject it clearly instead of exporting a plausible-looking broken substitute. Exhaustive pairing applies to the declared compatible contracts, not every theoretical combination the compiler deliberately excludes.

### Gate C — complexity proof before full town

One connected, moderately dressed demonstration containing a traffic-light intersection, residential broad curve, road circle, narrow service lane, three sidewalk widths plus none, dirt adapter, small lot, larger lot, driveway and access to real building doors. Export bare ground, lit ground, dressed ground and buildings-on native full PNGs plus close-ups. The owner must see all the system's claims working together.

### Gate D — runtime and access

Collision/access tests across all graphics tiers; browser/real-phone pan, zoom, orientation change and touch play; slow-load case, missing/corrupt chunk handling, return-to-menu and repeated-run resource cleanup. A missing chunk uses a small same-material fallback/loading region without changing collision or briefly exposing a void; report load error visibly in diagnostics.

Test representative combat, not an empty road showcase. Confirm ground under projectiles/effects remains readable, painted lights are not double-lit by existing runtime bloom, and no road sprite depth-sorts above the player. Check existing destruction/portal/shop/rescue flows before promotion.

### Gate E — reference-town assembly

Build districts around the reference hierarchy and selected existing sprites. Inspect full town, each district, each approach/junction and native close-up. Roads must not cross buildings/playgrounds, parking must have actual road portals, and scale must be consistent. Only then propose live promotion/merge/publish separately.

## 20. Prioritized implementation ledger

Progress labels: `[x]` is completed evidence; `[ ]` is outstanding. Record the artifact, checks and review note after **each** completed item. Do not mark an entire phase complete because one image exists.

### Phase 0 — decisions and truthful baseline (this pass)

- [x] RB-001 Inspect approved road image, complete reference town, earlier handovers and current connected proof.
- [x] RB-002 Rerun six geometry tests and existing 17,024 socket comparisons; document their actual coverage.
- [x] RB-003 Record failure causes, camera/scale contract, layered architecture, typed ports, quality strategy and priorities in this plan.
- [x] RB-004 Persist a reproducible baseline audit: source hashes, sampler detail density, highlight ROIs/brightness proxies, alpha stats, raw-memory estimate and desktop browser snapshot. Script: `road-autotile-audit.mjs --browser`; report: `review/planning-audit.json`. Source camera rectification and mobile performance are explicitly not certified.

### Phase 1 — lock the beauty before adding breadth

- [ ] RB-010 Register matching painted specular to asphalt/gutter/curb/concrete; beige unlit sidewalks, localized pavement spill from the SAME lamp, no orange shading on every slab. V3 bend appearance approved and straight corrected; exact sockets, on/off layers and both orientations remain outstanding.
- [ ] RB-011 Rectify/extract or generate sufficient-detail shared asphalt and separate concrete/curb sources; reject grid/repetition/large aggregate.
- [ ] RB-012 Calibrate child/car/door/house/road/slab scale with existing art and current mobile camera.
- [ ] RB-013 Replace stretched curve joints with approved fan pieces and improve T/X curb returns; inspect close-ups.
- [ ] RB-014 Add all opposite-port seam fixtures, alpha-composite checks and accepted light/sidewalk golden images.

**Exit:** native material/scale proof that retains the road reference's glint and paving quality. No bulk road art before this.

### Phase 2 — stable modular connections and authoring

- [ ] RB-020 Implement typed port normalization and valid-connection schema; validate reversed side conventions.
- [ ] RB-021 Implement left/right none/thin/standard/thick pavements and fixed-size slab row placement.
- [ ] RB-022 Add width/sidewalk tapers and terminations; reject unsupported joins explicitly.
- [ ] RB-023 Add broad quarter sweep, S-bend and cul-de-sac macros with atomic reservation.
- [ ] RB-024 Add stable feature IDs/seeds, incremental invalidation, undo/redo and versioned import/export to the editor.
- [ ] RB-025 Pass native compatible-pair join board including all new structural adapters.

**Exit:** connecting/editing a varied bare network never introduces a phase jump, incompatible width or internal curb.

### Phase 3 — intersections, circle, lots and dirt

- [ ] RB-030 Compile continuous marking phases and correct crossings, stop/yield bars, lanes and worn paint.
- [ ] RB-031 Build traffic-light intersection recipe with period-appropriate separate signal props and safe corners.
- [ ] RB-032 Build roundabout macro with optional entries, coherent island and connected walking paths.
- [ ] RB-033 Build driveway/alley/lot apron curb cuts and explicit road portals; test every entrance.
- [ ] RB-034 Build small/large lot geometry and bay markings with real car/aisle scale; pedestrian-only court variant.
- [ ] RB-035 Build asphalt-to-dirt adapter using existing dirt material where possible; phase out lines/curbs properly.
- [ ] RB-036 Export and inspect Gate C connected complexity proof using existing buildings.

**Exit:** the varied network looks like a believable town street system, not a set of unconnected samples.

### Phase 4 — beautiful automatic dressing

- [ ] RB-040 Replace sorted-index light placement with actual lamp/frontage anchors, one-pool ownership and seam-spanning bake.
- [ ] RB-041 Add sparse/clustered gutter and sidewalk variants with deterministic exclusion masks.
- [ ] RB-042 Add restrained painted wear/drains/litter only where context warrants; reuse existing sources first.
- [ ] RB-043 Review dressed complexity proof against both reference images and bare ground; decoration cannot hide defects.

### Phase 5 — game-ready performance and integration

- [ ] RB-050 Offline chunk compiler, exact placement/bounds/bleed metadata, lossless masters and tested release encoding.
- [ ] RB-051 High/Balanced/Low bake manifests with retained specular and switchable debris; byte-identical collision.
- [ ] RB-052 Visible-chunk loading, byte-bounded cache, resource release and missing-chunk fallback.
- [ ] RB-053 Opt-in integration with existing `floorChunks` renderer; prevent duplicate old roads or doubled light washes.
- [ ] RB-054 Real-device/frame/memory benchmarks during combat and long pan; tune tiers from measurements.
- [ ] RB-055 Run door/start/shop/portal/rescue/companion reachability and existing game regressions.

### Phase 6 — assemble and critique the reference-compatible town

- [ ] RB-060 Author fixed district road graph/parcel reservations with the reference town open beside it.
- [ ] RB-061 Place existing buildings/props at calibrated scale; real lot access and every residential driveway.
- [ ] RB-062 Inspect every district and approach, then add only missing variation/Halloween dressing.
- [ ] RB-063 Deliver entire native-resolution map, close-up sections, reproducible inputs, manifests and remaining defect list.
- [ ] RB-064 After explicit promotion direction: review merge/deployment separately; retain old map fallback until checks pass.

## 21. Risks and decision rules

| Risk | Trigger | Mitigation / stop rule |
| --- | --- | --- |
| Style drift | New source no longer matches approved grain/slab/colour | Original master in every request; reject rather than colour-grade a different style into acceptance |
| Specular becomes optional or dull | Low tier removes it; composite loses curb catch | Light recipe is structural material appearance, retained at all tiers; block phase exit |
| Slab joint warping | Tight inside curves or widened sidewalks stretch source | Fan/cut pieces, extra rows and larger radii; no whole-profile stretch |
| Asset combinations explode | Generating every mixed-width/sidewalk/light state | Separate recipes/adapters; bake only authored combinations; report count and bytes before art batch |
| Macro does not fit | Sweep/circle consumes a building/corridor | Reserve footprint and preview before commit; move/resize explicitly, never overlay |
| Source detail is too low | Exported 1K texture magnifies a tiny crop | Obtain better native source first; label derived resolution honestly |
| Randomness alters distant town | Local edit changes ordering/count | Persistent IDs and local seed streams; test unaffected output hashes |
| Phantom collision | Visually open pavement/entrance blocks player | Same geometry/access masks; actor-radius checks and full route walk |
| Seam hidden by dressing | Bare proof fails but leaf/tree proof looks fine | Gate bare/neutral proof first, then dress |
| Alpha/filter halo | Dark/green fringe during pan/zoom | Correct premultiplication/edge padding, exact chunk ownership, multibackground/fractional-camera tests |
| Too much decoded memory | Preload atlas, duplicate canvas caches or full map | Prebaked streamed chunks, byte caps and lifecycle tracking; no dual-tier residency |
| Quality switch stutters | All chunks synchronously rebaked/decoded | Prebaked tier manifests, centre-first incremental loads; no frame-time terrain compiler |
| Art hides gameplay | Bloom/debris masks enemies, shots or doors | In-combat proof; bound glints, clear approach/marking masks, optional debris reduction |
| Existing engine lighting doubles sheen | Painted road plus existing lamp wash | Compare actual scene; retain small dynamic object light if useful, avoid duplicate ground reflection |
| Plan is mistaken for delivery | Checklist/art files treated as live features | Keep statuses, artifacts and test notes distinct; no merge/deploy claim without doing it |

If a structural source cannot meet geometry and style after targeted correction, fall back to deterministic sampling of the approved painted material, not a new full-map generation. If that sampled result cannot meet the visual gate, improve the source/corner art before widening the scope. Do not keep producing more town sections to avoid solving the foundation.

## 22. Implementation files and handoff discipline

Existing starting points:

- `scripts/lib/road-autotile.mjs`: projection, topology, socket/surface geometry.
- `scripts/town/roads/road-autotile-art.mjs`: source prompts, immutable native ingest and receipts.
- `scripts/town/roads/road-autotile-build.mjs`: raster sampler, optional layers, proof, export and current checks.
- `scripts/town/roads/road-autotile.test.mjs`: six geometry tests.
- `scripts/town/roads/road-autotile-audit.mjs`: read existing native/derived sources, verify receipts, measure light/size/memory and optionally smoke-test the offline review page.
- `scripts/town/roads/road-autotile-review.html`: current offline review editor.
- `src/game/town-ground-chunks.ts`: existing sparse road chunk packing.
- `src/game/render.ts`: existing ground pass/culling/camera, not modified by this plan.
- `src/game/town-static.ts`: fixed-layout road/parcel/access builder, existing prior changes must be preserved.
- `src/game/config.ts`: current game projection and collision-grid units.

Proposed new source organization after Gate A: versioned `output/town-art/roads-v2/` for approved sources/receipts; explicit typed graph and recipe data; build/test scripts split into geometry, materials, markings/lights/dressing and chunk compiler. Do not rename or overwrite v1 sources. Keep native source and derived runtime exports separate.

Every implementation change updates a stable RB item with artifact path, test command/result and native review note. A new agent reads this plan and `ROAD-AUTOTILE-HANDOVER.md` first, verifies the current checkout/dirty files, then takes the first unchecked dependency-ready item. Never rerun an existing art `init` or overwrite referenced masters. Do not include credentials in prompts or receipts.

Commands currently verified, from the repo root (Node must be available):

```text
node --test scripts/town/roads/road-autotile.test.mjs
node scripts/town/roads/road-autotile-build.mjs check
node scripts/town/roads/road-autotile-build.mjs demo
node scripts/town/roads/road-autotile-build.mjs editor
node scripts/town/roads/road-autotile-audit.mjs --browser
```

On the current Windows environment the available Node executable is `C:/nvm4w/nodejs/node.exe`; sandbox access may require the normal approval path. Outputs resolve to the repo root's `output/road-autotile-v1`. Verify exact paths before running a bake.

## 23. Next job, deliberately narrow

**RB-010 through RB-014: specular, concrete, native material detail and a trustworthy two-orientation/curve join proof.**

The owner has approved the direction of the current modular proof. Preserve that progress. The next visual improvement must be a convincing source-anchored wet glint and perfect paving at realistic scale, not another giant batch of roads. Once that foundation passes, widen the kit in dependency order: side profiles/adapters → broad curves → junction/circle/lot/dirt → automatic dressing → chunked gameplay integration → the complete town.
