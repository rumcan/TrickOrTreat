# Hide & Shriek verification — 9 October 2026

Implemented and checked locally:

- TypeScript `tsc --noEmit`: passed.
- 16 isolated purchase-store and image-packing tests: passed, no wallet transactions.
- Gameplay/rescue checks: passed across all five kids and 30 seeded maps.
- Starts are clear of buildings; four rescue sites are unreachable while locked
  and reachable after the appropriate gate opens. Swept dash/ghost movement
  respects progression walls.
- Guardian rescue, single active helper, gun swaps, upgrade synchronization,
  companion-only loot, player downed/revive and once-only rewards: passed.
- Four ordered boss clears remove enemies/projectiles, freeze time and allow
  upgrades without counting despawned monsters as kills: passed.
- Green/red/off gore and persistence: passed. Stress run stays within 900
  particles / 160 decals (300 / 60 in reduced-effects mode). Visual review used
  the optimized particle/decal implementation; no gore animation PNGs required.
- Desktop/mobile inventory, opening dialogue, death-summary-to-talents and replay
  with purchased talent stats: passed.
- 24 radio recordings match Heavy-Metal-GP byte-for-byte; playback passed.
- All 12 generated SFX fetched and decoded. The 700 Hz low-pass attenuates
  4 kHz by approximately 30.5 dB; soft fades, gain limits and voice caps apply.
- Source artwork: 175 active, 0 pending, 0 failed. Browser runtime validation
  loaded all 175 overrides through the actual development asset loader.
- Optimized production build: all 175 overrides fetched successfully; no failed
  overrides or browser exceptions. Free play and inventory work. Developer
  preview and engine debugging handle are absent; unpaid expansion stays locked.

Private deployment completed successfully:

- Game `AFjPSjQH9kbcCl57sgO3`, version **1.1.0**, visibility **private**.
- Server config `h3QTycdrvZA6xrhxsh7s` uploaded and pinned to the private tag.
- RUN CLI confirmed the new version and private share URL after upload.
- Private share-link HTTP check returned 200 successfully (redirecting to run.world).
- Build size approximately 138 MB, reduced from 337 MB. Only reproducible `dist`
  assets were resized/omitted; original artwork, old overrides and provenance
  remain intact. Subsequent `npm run build` repeats this packing.

Remaining release decision: confirm the exact Bits price approximating $1.
The draft 100-Bits unique permanent unlock is **inactive**, not a verified
USD conversion. Production expansion checkout is intentionally unavailable
until pricing is confirmed. Restore/success/cancel/retry/refund behavior was
tested with mocks, not real wallet purchases. Private storefront availability
may also require testing in RUN Playground when checkout is activated.

Browser review images are saved in ignored `art/world/checks/`.

## Version 1.1.1 — visual/audio polish

- Three additional RUN-generated SFX (swoosh, click, tick), 6 credits total;
  all 15 recordings decoded and the unchanged radio playback passed.
- SFX low-pass raised from 700 Hz to 1 kHz; 1.04 playback rate gives a small
  pitch lift. Treble at 4 kHz remains attenuated by approximately 24.2 dB.
  Soft gain envelopes, existing volume settings and eight-voice cap remain.
- Detail layers verified on dash, reload and pickup events. Gun changes,
  weapon pickups and button presses use the quiet mechanism click.
- Desktop and landscape-phone splash: supplied `art/new/splash.png`.
  Portrait splash: supplied `art/new/splash_portrait.png`. Responsive source
  selection and decoding passed at 1440x900, 390x844 and 844x390.
- Thumbnail: supplied `art/new/thumb_posterpng.png`, resized without cropping
  to RUN's 512x512 JPEG. Automated verification matches the exact poster-derived
  bytes. Original PNG and previous thumbnails preserved; deploy automatically
  uploads `public/thumbnail.jpg` using RUN's documented thumbnail workflow.
- Earlier fixes included: 5,720 waist-height held-gun render combinations,
  four companion facing combinations and six pickup-panel viewport checks passed.
- Type-check, build, production asset loading/free-play/locked-checkout and all
  16 isolated regression tests passed.
- RUN deploy confirmed **1.1.1**, visibility **private**. Server catalog unchanged,
  and expansion checkout remains inactive pending price confirmation.
