# The Starcade interior

Playable compact 32x32-tile interior (reduced from the earlier sparse 48x48). The original arcade door
now enters this separate scene with E (or mobile Interact). The green exit returns
to the exact outside door. All recruited friends travel with you. Unrescued kids
remain at their town hideouts. You cannot change rooms during an active boss fight.

171 placed fixtures and dressing props: kid-scaled CRT cabinets, pinball, two triple skee-ball banks, air hockey,
foosball, prize redemption, animatronic band stage, birthday party, photo booth,
token machine, pizza counter and red booths. Two rear walls enclose the cutaway
view; outer collision bounds enclose the entire room. Wide combat cross aisles
connect every landmark, shop and reward counter.

The lived-in dressing includes 118 static floor overlays: a Bigfoot movie
suit and sci-fi robot in glass cases, neon movie posters, VHS/CRT memorabilia,
a jukebox, gumball machines and potted plants. Popcorn, soda cups,
pizza boxes and discarded prize tickets are projected onto the carpet. Decorative
clutter never blocks combat aisles; the four large exhibits have real collision.
Litter is clustered near cabinets, booths and plants rather than spread
across a uniform grid. The central combat aisle remains clear.
Four generated large-pile variants add snack rubbish, birthday debris, paper and
prize tickets, and VHS/arcade junk at 24 walkable positions. They are floor overlays,
not solid props: the kid always draws above them and walks straight over them.
Cabinet rows, table games and restaurant booths are packed more closely together;
navigation checks cover the narrowed corridors as well as all destinations.
The rejected fallen-chair image is no longer placed anywhere in the room.
Cabinet bays mix space-shooter, maze-chase and racing designs, with separate blue
and green rear-facing cabinet sprites and rear-facing pinball. They are genuinely
painted rear views, not mirrored front sprites. Additional plants frame both ends
of the game bays and the exit without blocking the paths.

The exit has a large green-and-cream woven EXIT mat, a directional floor arrow,
green practical light and a readable return-to-Maple-Falls sign with E/touch hint.
The mat is a flat, walk-over overlay on the same 64/32 projection, not furniture.

## Concessions crew

Maya repairs a walkie-talkie and Leo reads a monster comic beside the pizza counter.
Each has a generated four-frame idle sheet using their existing character reference,
an anchored vector pose guide and the arcade's material/lighting reference. Native
frames are uniformly packed to WebP; original sheets, guides and prompts are retained
in `staff/`. They are slightly older than the hide-and-seek group.

Approach and press E or mobile Interact: combat pauses for a cancellable recruitment
card. Maya costs 120 earned coins; Leo costs 150. Both free and premium runs may hire
them for that run; this does not unlock their playable characters permanently. They
join the normal whole-team companion system, inherit gun levels, can revive the player
and travel between scenes. Workers do not respawn or charge twice on re-entry. The
chosen player never also appears as a worker. Premium intro/rescue rosters now contain
only the younger neighbourhood kids; Maya and Leo wait at the arcade, not a gazebo.

The pizza counter uses the real shop; the token machine uses the real vending
reel. Stage, prize and party counters use existing rare/epic doorstep rewards.
Normal waves, enemies, bosses and companion combat continue inside. Boss clears
remove active and inactive enemies, preserve the 20-second shopping window and
move/reopen town shops and doors when the player returns. Room loot and visited
counters persist across re-entry, rather than resetting for free rewards.

## Art pipeline

- `layout.svg`: generated vector floor plan, shared fixture coordinates.
- `v2/vector/`: corrected deterministic 2:1 vector masters.
- `v2/guides/`: each individual master centered in a 1024px transparent frame.
- `v2/generated/`: 37 separately generated images. Every generation received its
  own exact vector guide first, and `furniture-atlas.png` only for painted materials,
  palette and warm upper-left lighting. The atlas retains the user reference style.
- `v2/specs.json`: native dimensions, world footprints, anchors and guide transforms.
- `v2/prompts.json`: the exact built-in imagegen prompts and reference roles.
- `v2/alignment-report.json`: silhouette overlap and guide-viewport overflow.
- `public/assets/arcade/v2/`: registered WebP sprites and a sparse carpet material.
- `v2/preview-*.png`: actual in-game views of the corrected interior.

The earlier atlas attempts remain archived here for provenance but are not loaded.
The corrected pipeline never fits or stretches an opaque object's bounding box.
It reverses each guide's uniform framing transform and retains its vector anchor.
Sloping pinball/skee-ball playfields stay sloped; all ground and level tabletop
edges use the same 2:1 orthographic basis as the game. Carpet is drawn top-down
and projected to diamonds in code, not perspectivally distorted by the generator.

Assets are separate depth-sorted props. Furniture collision follows the vector
geometry; the floor material is projected to exact 2:1 diamonds by code. The
game never uses a flattened illustration as a walkable collision map.

Reproduce vector export and packing with a dev server on 5190:

```
npm run art:arcade:export
npm run art:arcade:pack
npm run test:arcade
npm run test:arcade:mobile
npm run test:arcade:staff
node scripts/art/arcade-v2-preview.mjs
```

Tests reject overlapping furniture, flood the room using the player's collision radius, check all destinations
and bounds, real E entry, state/loot persistence, inventory conservation, companion
travel/follow, actual hitscan damage and protection against boss-escape portals.
They also check indoor boss clears, the quiet shopping window, deferred town
shop relocation, sprite alpha/anchors and touch entry/map/exit in both orientations.
