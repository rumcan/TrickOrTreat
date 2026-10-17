# Maple Falls — fixed art camera and style

**Framing update (2026-10-13):** the camera projection/period/style remain reference rules, but the 80m framing below belongs to the superseded full-plot workflow. Close-up road modules use the separate framing in [ROAD-BUILDER-MASTER-PLAN.md](ROAD-BUILDER-MASTER-PLAN.md); do not append the old 80m block to module jobs.

The authoritative prompt block is `output/town-art/empty-plots/style-rules.txt`. The terrain pipeline appends it verbatim and records its hash in every generation job/receipt. POI and sprite requests must use the same block.

| Property | Fixed specification |
| --- | --- |
| Projection | Orthographic 2:1 dimetric; matches `TW=128`, `TH=64` in `src/game/config.ts` |
| Camera heading | Along +X,+Y, 45° relative to the grid axes |
| Downward camera pitch | 30° below horizontal; 0° roll |
| Ground-axis screen angles | ±26.565°; not ±30° true isometric |
| Virtual camera height | 60m above ground target; 103.923m horizontal distance, 120m slant distance |
| Orthographic view width | 80m; fixed across tiles, independent of camera distance |
| Period and location | 1985–1992 small-town America |
| Time and theme | October 31, early evening/dusk, approximately 18:15 visual lighting |
| Rendering style | Crisp, richly textured painterly game art |
| Lighting | Navy ambient shade, restrained 2800K amber ground pools and damp-asphalt glints |
| Base contents | Roads, pavement, grass, dirt and small leaves only; no trees, buildings or poles |

The angle is derived from the chosen orthographic pose: at 45° heading the ground slope is `sin(pitch)`; `sin(30°)=0.5`, so the screen angle is `atan(0.5)=26.565°`. This is consistent with the game's `(x-y)*64`, `(x+y)*32` ground projection. Camera height is a reproducible pose specification, not a raster-generator capability guarantee. Prompted dimensions/angles require visual checks.

At a native square output of 1254px, the scale is 15.675px/m of camera-right distance. Perspective must never make far objects smaller. Roads may curve naturally, but straight ground-aligned details and future building footprints obey the same projection. Camera-height wording alone cannot lock scale; fixed orthographic framing and actual neighbour image bands do.

## Acceptance before extending a tile

- [ ] Square native output; report actual dimensions, no claimed AI enlargement.
- [ ] No buildings, trees, poles, cars or stray tall objects.
- [ ] Empty central plot with roads outside it and room for future door paths.
- [ ] 1–4 visually present exits match the reciprocal connection graph and actual neighbour pavement widths/positions.
- [ ] Ground lines/paving obey 2:1 projection; no perspective drift or floating diamond border.
- [ ] Lamp illumination is baked light only, not glowing fixtures/pole shadows.
- [ ] Asphalt/leaves/soil use small consistent texture scale; no curb break at joins.

Metadata graph tests cannot certify pixel geometry or AI compliance. Only reviewed tiles may guide neighbouring generation. POI generation starts after review of the empty network; exact footprints, collision, depth sorting and mobile actor scale follow afterwards.
