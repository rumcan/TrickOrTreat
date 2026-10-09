# Hide & Shriek expansion

## Player loop

Keep the original survival game free. A permanent RUN Bits unlock opens the
Hide & Shriek rescue campaign, new kids, new weapons/costumes, expanded districts
and advanced talents. Never deduct Bits on startup; show the platform confirmation
only after an explicit Unlock click. Use a server-backed durable entitlement,
restore it on startup, and confirm the actual Bits/USD relationship before pricing.

1. Five friends meet under the streetlights. Speech bubbles explain hide-and-seek;
   the selected kid counts, the others hide, then monsters interrupt the game.
   Allow skipping; no damage or spawning during the opening.
2. Fight through the neighbourhood. District gates open on the existing run
   schedule; defeat each rescue site's guardian after entering. Hold interaction beside
   a downed friend to revive them; damage interrupts the rescue channel.
3. Each rescued friend joins the roster. Only one accompanies the player; switch
   from the paused team screen. Give them a weapon there. Companion loot is
   separately owned, and companion weapons keep pace with player upgrades.
4. An active friend follows reachable paths, fights visible enemies and can
   revive a downed player. A timed downed state gives a chance to recover;
   without rescue, end the run. Prevent indefinite revive chains with cooldowns.
5. Inventory (I / pause menu) lists every applied treat, stack count and effect,
   both weapon loadouts/traits, costume, hero passive and current derived stats.
6. End-of-run rewards are granted exactly once. Show You died / Victory first,
   tally combat XP, kills, survival and bosses into persistent essence (Soul
   Candy in the saved data), then explicitly open talents. Replay applies the
   purchased talents. Run XP levels remain temporary.

## Content target

- Two playable kids: Maya (The Fixer: reload/repair support) and Leo (The Night
  Scout: mobility/slow-field support), each with a distinct active skill.
- Four weapons: Gloom Drum, Marshmallow Mortar, Bubblegum Rail and Acorn Repeater.
- Two costumes: Knight and Moth; support new kids wearing all existing costumes.
- Additional housing and activity in underused districts; four rescue sites,
  visible ward/guardian state, map objectives and friend progress in the HUD.
- Nine advanced talents across offense, defense and utility/team support.

## Audio and art

Port Heavy-Metal-GP's radio player, pill and existing music files; keep the exact
audio and playback behaviour, change only game-specific names/integration.
Generate RUN sound effects for shots, impacts, reload, pickups, doors, damage,
revive, guardian, skills and victory. Retain low, soft body sounds; the later
audio-polish request adds gentle lower-mid swooshes, wooden ticks and toy-mechanism
clicks, with a small pitch/filter lift. No piercing treble or harsh attacks. Use
a low-pass bus, conservative gain, user volume/mute and concurrency limits.

Register all new visual assets in the Atlas first, export exact layouts, generate
one asset per call using art/reference/style-target.webp plus the layout guide,
and supply each new kid's base sheet as costume identity reference. Preserve
4/6/4/6 animation cells, alpha, native anchors and 2:1 projection. Inspect, pack
and activate using the existing versioned art pipeline. No placeholder art in
the release build.

## Verification and release

- Test inventory totals, reward idempotency, talent persistence/gating, rescue
  state transitions, one-active-companion rule, loadout transfers and upgrade sync.
- Browser-test opening, inventory, rescue, downed/revive, end tree and replay;
  test radio playback and audio network/decode failures without game crashes.
- Validate every Atlas override, type-check and build. Exercise purchase sandbox
  success/cancel/error/restore; never unlock on a failed/cancelled transaction.
- Publish to existing RUN game AFjPSjQH9kbcCl57sgO3 as private (share-link accessible,
  hidden from Explore), verify deployment status and return its share link.

## Progress

## Follow-up fixes and encounters

- [x] Place every player start on the open central sidewalk, outside all house footprints.
- [x] Seal district hedges even through occupied cells; ghost costumes cannot phase through progression walls. Substep movement to prevent dash tunnelling.
- [x] Unmarked generated paved-road base tiles; lane markings only on the centre seam, not both road lanes.
- [x] Three additional premium bosses: Headmistress Hex, Howler Alpha and Graveyard Warden, followed by the Pumpkin King. Different attack patterns, four encounter rounds.
- [x] Every boss clear despawns enemies and projectiles without farming extra kills, pauses spawning/time and opens a safe weapon/treat upgrade shop. Explicit continue starts the next round.
- [x] Death/victory summary first: essence earned from combat XP, kills, survival and bosses, total balance, then a deliberate Spend essence on talents button.
- [x] Default green monster blood/gore, red and off settings, bounded lightweight splatter particles and ground decals. Inspected and stress-tested; no additional PNG animation needed.

- [x] Existing game, Atlas pipeline and sibling radio located.
- [x] Local execution and RUN authentication retried successfully.
- [x] Inventory and end-of-run progression UI.
- [x] Radio port and generated sound effects (24 unchanged music files, 15 SFX including the later swoosh/click/tick polish).
- [x] Rescue campaign and companion gameplay.
- [x] New content and reference-guided generated artwork (175 active Atlas entries).
- [x] Durable Bits unlock implementation and isolated mock purchase tests.
- [ ] Confirm the exact Bits price for approximately $1, then activate the catalog item. The draft 100-Bits item is inactive; its USD equivalence is not verified.
- [x] Type-check, production build, 16 isolated tests, 30 seeded map/rescue scenarios, boss clears, desktop/mobile/media and production-loader checks.
- [x] RUN private deployment verified: version 1.1.0, server config h3QTycdrvZA6xrhxsh7s. The inactive unlock was uploaded with the private release; activation remains pending price confirmation.
