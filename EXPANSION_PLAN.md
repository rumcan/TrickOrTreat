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
- [x] New content and reference-guided generated artwork (234 active Atlas entries, including all 43 treat cards, 15 new map props and the 16-direction Candy Cannon).
- [x] Durable Bits unlock implementation and isolated mock purchase tests.
- [ ] Confirm the exact Bits price for approximately $1, then activate the catalog item. The draft 100-Bits item is inactive; its USD equivalence is not verified.
- [x] Type-check, production build, 16 isolated tests, 30 seeded map/rescue scenarios, boss clears, desktop/mobile/media and production-loader checks.
- [x] RUN private deployment verified: version 1.1.0, server config h3QTycdrvZA6xrhxsh7s. The inactive unlock was uploaded with the private release; activation remains pending price confirmation.

## Final outstanding-item pass

- [x] Import all five supplied portraits and derive matching top-cropped HUD faces.
- [x] Center the kid picker between the logo and bottom menu; keep radio top-left and unlock top-right.
- [x] Raise player and companion guns to hand height above the hips.
- [x] Improve choice-card typography, spacing and white-text contrast.
- [x] Show collected effects first, with separate synergy and damage tabs and collapsed tier details.
- [x] Remove the duplicate costume interaction prompt.
- [x] Explain linked-rank and full-game talent locks, and insufficient essence.
- [x] Show named cyan rescue markers on the full map and countdown guidance in the HUD.
- [x] Steepen exponential XP progression and reduce incidental treat frequency. Later explicit requests add enemy scaling and premium skill buffs below.
- [x] Bound home rewards to Common–Rare, businesses to Rare–Epic and major buildings to Rare–Legendary.
- [x] Repeat four-boss cycles regardless of unrescued friends, with stronger wave scaling below.
- [x] Gate new full-game landmarks, rewards and mounted weapons by verified expansion access.
- [x] Generate and review every missing card/prop/cannon image, plus three corrected sidewalks; preserve prompts, references and original assets.
- [x] Prewarm every asset so lazy map landmarks cannot escape artwork validation or hitch on entry.
- [x] Hide Collection in all production menus, including URL-query overrides.

## Latest combat, rescue and purchase requests

- [x] Compound monster health by 60% and damage by 12% per wave: 60-second opening waves, 30-second endless waves. Scale living enemies without healing them.
- [x] Spawn shielded lieutenants each wave and give every boss rechargeable shields. Shields absorb damage first; uninterrupted damage postpones recharge; inventory/shop pauses freeze recharge.
- [x] Place all rescue kids in reachable scenery-free clearings, never inside buildings, and eliminate unchecked failed-search fallbacks.
- [x] Keep every missing kid on the minimap/full map; add a nearest-available rescue/gate arrow and visible rescue beacons. Remove bag arrows.
- [x] Buff Maya with full team recovery, two-gun refill, shield-breaking EMP, invulnerability and double damage. Buff Leo with a large damaging/stunning beacon, dash refill, invulnerability and triple damage.
- [x] Build an accessible responsive purchase catalogue displaying every premium kid, gun, treat, costume and talent, with generated artwork, a permanent-unlock CTA and restore support.
- [x] Validate combat and shields, 200 unobstructed rescue spawns, desktop/mobile catalogue, current UI and prior rescue/encounter regressions.
- [x] Publish this completed build privately: RUN version 1.1.2, game AFjPSjQH9kbcCl57sgO3, unchanged server config h3QTycdrvZA6xrhxsh7s.
- [x] Release PR created: [#6](https://github.com/rumcan/TrickOrTreat/pull/6); GitHub records the final merge status.
- [ ] Activate paid checkout only after the Bits-price choice is confirmed (100 Bits remains an inactive draft).
