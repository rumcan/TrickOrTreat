# Starcade illustrated asset pipeline

Built-in image generation; user-attached arcade illustration is the style
reference. `layout.svg` and `vector/*.png` are the deterministic geometry masters.
Runtime props remain separate depth-sorted sprites, never a flattened room mural.

## Furniture atlas

Transparent 2048x1536 sprite atlas, exactly four columns and three rows of 512px
cells. Reference roles: attached arcade image supplies the hand-painted miniature
look, rich navy shadows, warm amber practical lamps and magenta/cyan neon; vector
atlas supplies item order, 2:1 dimetric footprint and composition. Ignore any
gameplay screenshot. Each cell is isolated with clear gutters and no floor.

Row 1: upright CRT arcade cabinet; glass-topped pinball machine; bank of three
skee-ball lanes; blue air-hockey table.
Row 2: foosball table; long prize redemption counter and plush-toy shelves; pizza
restaurant counter with oven, soda dispenser and red menu signs; red vinyl booth
with table and opposite seating.
Row 3: small animatronic animal band on curtained stage; photo booth with curtain;
token exchange machine; birthday-party table with balloons and cake.

Era 1987-1993, Halloween pumpkins, believable wood/plastic/vinyl/CRT materials,
matching warm/cool lighting. No people, modern screens, real brands, exterior
ground, cast floor shadows or watermarks. Full clean silhouettes, plenty of alpha
padding. Preserve each object's footprint angle; retain all twelve items.

## Carpet material

Seamless square overhead carpet texture, navy indigo woven pile with sparse small
orange, red-magenta and muted cyan confetti squiggles, triangles and loops. Match
the reference's nostalgic 1990 arcade carpet. Even lighting, no perspective,
furniture, border, focal point or text. Engine projects this into exact 2:1 tiles.

## Rear wall

Transparent isolated straight eight-tile rear arcade wall, 2:1 dimetric view along
the screen-down-right axis. Dark wood wainscot, navy plaster, two colorful generic
space-game posters, small orange Halloween string lights and neon trim. Warm
practical amber light and cool navy shadows, same painted reference style. No
floor, roof, characters, watermark or extra wall returns. Full silhouette and
clear transparent padding.
