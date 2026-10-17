# Places v5: authoring a preset the owner's way

The owner paints Maple Falls by hand in the town builder. Presets must look like **their** blocks: same scale, same density,
same spacing, same attention to detail, and every item placed for a reason (what it is for in a lived-in 1988 small
town at Halloween, and what it does for the picture). The design grammar measured from their blocks is in
`RULES.md` (same folder). Read it first, then look at the owner's renders it cites.

## Files

| Path | What |
| --- | --- |
| `places-v5/kit.mjs` | Authoring kit: `Preset`, `RUNS`, `scaleOf`, `ITEMS`, validation |
| `places-v5/presets/<id>.mjs` | One preset per file. Default export: `() => P.done()` |
| `places-v5/stage.mjs` | Renders a preset inside a real road block with the real ground renderer |
| `places-v5/scales.json` | Owner scales: median of their placements (`source: owner`, with min/max), else reviewed or estimated |
| `places-v5/build.mjs` | Builds every preset into `output/town-builder/presets/places.json` (+ thumbnails) |
| `output/town-builder/presets-v5-study/renders/` | Renders of the owner's blocks (the bar to meet) |
| `output/town-builder/presets-v5-study/data/B*.json` | The owner's blocks as block-local tables (u, v, scale, flip, box) |
| `output/town-builder/presets-v5-study/render-region.mjs` | Zoom into any part of the owner's town: `node <it> X0 Y0 X1 Y1 out.png K [--labels]` |

## Coordinates

Block-local metres. `u` runs along world +X (screen lower-right) from the block's **west** sidewalk edge; `v` runs along
world +Y (screen lower-left) from the **north** sidewalk edge. A standard block is 69.4 x 69.4 m. Beyond each edge:
sidewalk 0 to 2.05 m, curb at 2.05 m, road centre 5.3 m. On screen the block is a diamond: north edge = upper-right side,
west edge = upper-left side, south edge = lower-left side (the front the viewer sees most), east edge = lower-right side.

The stamp point is the block centre, and the app snaps a block preset to the centre of a block of its size, so items
land exactly where you put them relative to the sidewalks.

Facing: unflipped buildings show their front (door, porch, sign) toward +Y = the SOUTH street. `flip: true` turns the
front toward +X = the EAST street. Nothing faces north or west: on those streets use rear-view sprites (categories
"House backs", "House rear & side views", `*_rear`, `expansion:boarded-store-rear`), or face an interior court like the
owner's grocery row in B4. Mirroring reverses lettering: never flip a building whose sign has words.

## Kit

```js
import {Preset,RUNS,scaleOf,ITEMS} from '../kit.mjs';
export default function(){
 const P=Preset({id:'place-maple-lane',name:'Maple Lane',desc:'...',fit:{w:69.4,h:69.4},story:'one paragraph: the block\'s story'});
 P.section('Lot 1: the Hendersons (south-west corner)');           // labels the next placements in the review notes
 P.put('world:house_1',12,56,{why:{use:'family home facing Maple Lane',look:'the tallest roof anchors the corner'}});
 P.put('ref:halloween-mums',8.2,61.4,{mul:1.1,why:{use:'...',look:'...'}}); // mul = times the owner scale; scale = absolute
 P.run('picket',[0.6,67.6],[22,67.6],{skip:[2],why:{use:'...',look:'...'}}); // straight runs along u or v; skip = gap indexes
 P.lot({surface:'asphalt',u0:19,v0:57,u1:24.5,v1:71,openings:[{side:'S',a0:19.5,a1:24}],why:{...}}); // drive across the sidewalk
 P.pave({u0:9,v0:62,u1:10.6,v1:69.4,why:{...}});                    // front walk
 P.put('world:hydrant',30,70.4,{street:true,why:{...}});           // on the sidewalk: street:true
 return P.done();
}
```

- `put(id,u,v,{flip,scale|mul,z,o,street,why})`. Default scale = the owner's (scales.json). Stay inside the owner's
  min-max for that sprite; vary within it to hide repeats. `z` = draw layer (higher draws on top; use for things that
  must sit in front of a porch or on a table), `o` = small depth nudge.
- `run(kind,[u0,v0],[u1,v1],{skip,why})` lays fence or hedge segments end to end exactly like the owner's fence tool
  (kinds in `RUNS`: picket, privacy, chain, chainTall, iron, gardenPicket, splitRail, hedge). Step = segment length.
- `line(id,[u0,v0],[u1,v1],count,{...})` evenly spaced repeats (parking meters, wheel stops, bollards).
- `lot`, `pave`, `glow` add ground (car parks, drives, dirt yards, slabs, lamp glow). Ground needs **Rebuild ground** in
  the app after stamping, so keep it purposeful.
- Every call needs `why:{use,look}`: a real reason, specific to this spot ("use: the bin waits by the drive for Tuesday
  pickup; look: a dark vertical that stops the eye at the lot line"), never boilerplate. A run shares one why.
- `done()` returns `{preset,errors,warnings}`. Errors must be zero. Read every warning: overlaps above 35% of the
  smaller footprint, scales outside the owner's range, items outside the block.

## Render and look

```
STAGE_WORKERS=3 node scripts/town-builder/places-v5/stage.mjs scripts/town-builder/places-v5/presets/<id>.mjs <out.png> [--labels]
STAGE_WORKERS=3 node scripts/town-builder/places-v5/stage.mjs scripts/town-builder/places-v5/presets/<id>.mjs <out.png> --k 0.9 --crop u0,v0,u1,v1 --labels
```
Run from the repo root. Whole block at the default k 0.4 takes ~30-60 s (ground cached by plan);
close-ups are the way to judge detail: crop one lot (about 25 x 25 m) at k 0.9. `--labels` prints `#index name` at each
member so you can find and fix items. Put your images in `output/town-builder/presets-v5-study/stage/<id>/`.

Compare every render with the owner's renders at the same scale (`presets-v5-study/renders/blk-*.png` are k 0.4,
`render-region.mjs` gives owner close-ups at any k). If yours looks emptier, flatter, more regular, bigger-buildinged or
smaller-propped than theirs, it is not done.

## Done means

1. Zero errors; every warning either fixed or deliberately kept with a reason in a `P.note()`.
2. A whole-block render and close-ups of every lot/zone that hold up next to the owner's blocks at full resolution.
3. Every member has a specific use and look reason; the preset's `story` and section names tell the block's story.
