# Terrain materials — owner-approved grass and mud workflow

Current priority: shrink grass and try generated asphalt/pavement materials over the ENTIRE fixed road network. See `docs/TOWN-ROAD-TEXTURE-REVIEW.md`. The earlier three-road-sample preview below is superseded by this new review, not promoted to production.

This supersedes the previous roads-only restriction for this new task. User wants one detailed repeating grass base, ten separately generated transparent grass/leaf decals with soft alpha edges, and a repeating soil/mud texture clipped to editable feathered vector shapes. No random town layout rewrite, no live deployment.

Latest request completed: export what we have as one full-resolution map with new material samples and existing scenery. Output: main repository output/town-materials-review/maple-falls-full-current.png, 12,224 x 6,264, 1,443 props. Review exporter is read-only and not wired into gameplay. New grass, soil, scattered-leaf and scattered-tuft sheets and eight available decals are included. Three road stretches and two paved lots use new isolated PNGs; other curves remain existing road artwork. Parking-corner omitted. Metadata and README explicitly record incomplete road assembly and feathered town dirt masks.

Native material generation progress: both base textures generated, extra sparse leaves and tuft sheets generated, eight of ten individual decals saved. Remaining decal-09-leaf-windrow and decal-10-mixed-autumn-grass must be generated/resumed from the base style. Individual JSON receipts contain exact prompts and sources; do not regenerate the completed eight. The full feathered vector-material demo and final 10-decal validation are still outstanding. The user interrupted generation to request the current full-town picture; do not report this whole checklist complete.

- [ ] Generate opaque seamless grass base from the attached grass/mud screenshot; ignore grid, handles and pavement.
- [ ] Generate opaque seamless soil/mud base matching the same scale and art.
- [ ] Generate ten different individual transparent decals derived from the grass base, not one small atlas.
- [ ] Inspect repeated bases and actual composited alpha edges; repair visible texture seams if needed.
- [ ] Demonstrate repeat-filled soil inside a feathered editable vector outline and overlapping decals over the grass.
- [ ] Export native PNGs, editable soil vector example, previews, exact prompts and validation receipts to output/terrain-materials.

Pipeline: scripts/town/materials/terrain-materials-art.mjs. Native generated masters and per-image provenance: output/town-art/terrain-materials/generated. Final image-generation tool: built-in image_gen. Mechanical compositing/repeating/cropping and the user-requested vector alpha mask use Sharp; no substitute generated art.

Parking corner warning: parking-corner.png is an open partial corner module, not a complete lot. Its irregular cut edges require further assembly. Do not present it as an intact finished parking lot or drop it into the game unreviewed.
