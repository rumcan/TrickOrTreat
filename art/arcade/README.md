# The Starcade interior

Playable 48x48-tile interior: four 24x24 town blocks. The original arcade door
now enters this separate scene with E (or mobile Interact). The green exit returns
to the exact outside door. All recruited friends travel with you. Unrescued kids
remain at their town hideouts. You cannot change rooms during an active boss fight.

52 fixtures: CRT cabinets, pinball, two triple skee-ball banks, air hockey,
foosball, prize redemption, animatronic band stage, birthday party, photo booth,
token machine, pizza counter and red booths. Two rear walls enclose the cutaway
view; outer collision bounds enclose the entire room. Wide combat cross aisles
connect every landmark, shop and reward counter.

The pizza counter uses the real shop; the token machine uses the real vending
reel. Stage, prize and party counters use existing rare/epic doorstep rewards.
Normal waves, enemies, bosses and companion combat continue inside. Boss clears
remove active and inactive enemies, preserve the 20-second shopping window and
move/reopen town shops and doors when the player returns. Room loot and visited
counters persist across re-entry, rather than resetting for free rewards.

## Art pipeline

- `layout.svg`: generated vector floor plan, shared fixture coordinates.
- `vector/`: deterministic isometric canvas masters.
- `vector-atlas.png`: generator composition/footprint reference.
- `furniture-atlas.png`, `carpet.png`, `wall.png`: built-in generated masters,
  styled from the user-attached arcade illustration; true alpha on props/walls.
- `specs.json`: exact canvas dimensions, footprint-centre anchors and prompts.
- `PROMPTS.md`: retained prompt set and reference roles.
- `public/assets/arcade/`: 12 separate furniture sprites, two wall orientations
  and one carpet texture, packed to WebP and registered in the normal manifest.

Assets are separate depth-sorted props. Furniture collision follows the vector
geometry; the floor material is projected to exact 2:1 diamonds by code. The
game never uses a flattened illustration as a walkable collision map.

Reproduce vector export and packing with a dev server on 5173:

```
npm run art:arcade:export
npm run art:arcade:pack
npm run test:arcade
node scripts/arcade-art.test.mjs
node scripts/arcade-mobile.test.mjs
```

Tests flood the room using the player's collision radius, check all destinations
and bounds, real E entry, state/loot persistence, inventory conservation, companion
travel/follow, actual hitscan damage and protection against boss-escape portals.
They also check indoor boss clears, the quiet shopping window, deferred town
shop relocation, sprite alpha/anchors and touch entry/map/exit in both orientations.
