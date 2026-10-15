# Maple Falls UI redesign

The PNGs in this folder are the supplied design masters and remain unchanged.
The original street background is used by the title, loading screen and menu
backdrops. Existing character, gun and treat illustrations remain live assets.

Run `npm run art:redesign` to reproduce the optimized artwork in
`public/images/redesign/`.

Buttons use real HTML labels and Lucide icons. Their native background and
48px SVG frame tile preserve 12px corners and repeat the 24px edge segments.
Do not put baked labels or complete painted button sprites behind the text:
they deform at different sizes and disappear when hover changes the background.
Panels use CSS borders and fixed-size corner decorations. Texture tiles keep
their original size.

The supplied pause, settings and level-up lettering is rendered directly from
the supplied artwork at one consistent aspect ratio. Dynamic typography uses
the user's nominated font families:

| Role | Family |
| --- | --- |
| Other horror headings and treat names | Nosifer |
| Menu entries and action buttons | Bebas Neue |
| Weapon names, HUD labels and section titles | Teko |
| Stats and readable small text | Rajdhani |
| Timer | Orbitron |

These are bundled locally from the official
[Google Fonts repository](https://github.com/google/fonts), with SIL Open Font
License files in `public/fonts/`. Anton and Barlow remain fallbacks. Road Rage
is no longer used. Another Danger's downloadable demo is not bundled; the
[foundry's commercial product](https://thebrandedquotes.sellfy.store/p/lez5/)
requires a separate license, with suitable embedding rights.

`scripts/prepare-reference-frames.py` cuts 128px fixed corners and clean 64px
edge tiles from the supplied frames. Only those clean edge strips repeat;
spiderwebs and leaves stay in their corners instead of being stretched or
repeated down the panel.

Run `npm run test:redesign` to capture the desktop screens and
`npm run test:redesign:mobile` for the compact layouts. The harness starts its
own local Vite server with file watching and hosting middleware disabled.
It checks actual button hover visibility, repeatable borders, compact CTA
dimensions, image loading, overflow and browser errors.

Screenshots, the five supplied-design comparisons and an HTML review gallery
are written to `art/redesign-checks/after/`. The gameplay screenshot is a live
run: its map view, counters, loot and weapon stats vary from the design sample.
