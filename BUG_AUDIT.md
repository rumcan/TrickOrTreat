# Gameplay bug audit — 2026-10-10

Reviewed input lifecycle, run-state transitions, player stats/gear changes, loot sources, weapon upgrades, companion/rescue behavior, elemental defenses, projectile collision, shield presentation, rewards, persistence, production gating and release configuration.

## Reproduced and corrected

All 17 cases below first failed in a browser against the reviewed code, then passed after correction. The final wall-order case extends the fast-projectile fix; the other cases reproduce existing behavior.

| Case | Correction |
| --- | --- |
| Movement/fire remained held after focus loss | Reset keyboard/mouse controls on blur and hidden-tab transition; detach listeners on cleanup |
| Costume swapping refilled health | Preserve current health percentage when maximum HP changes |
| Weapon resonance swapping refilled health | Apply the same invariant to changing weapon-derived HP |
| Houses retained a 32% costume chance | Apply a rare 2.5% base chance, scaling with Costume Master and capped at 6% |
| Bag upgrades did not update companion guns | Sync team weapon levels after the upgrade |
| Upgraded pickups did not update companion guns | Sync after inspected pickups and direct reward-slot equips |
| Companion beams bypassed elemental immunity | Pass the firing companion weapon's element into beam hit resolution |
| Guardian HP reset left disproportionate shields | Scale guardian HP with waves and rebuild its shield at 60% of max HP |
| A fatal hit at a door could show a reward instead of death | Stop gameplay phases immediately on terminal/menu transitions |
| Boss-killing costume nova could still take a stale fatal hit | Preserve the safe shop when the nova ends the encounter |
| Queued chain reactions survived a boss break | Clear queued procs alongside enemies/projectiles |
| Destroyed enemy bullets could still hit | Skip dead projectiles before processing movement/contact |
| Fast player projectiles skipped creatures | Sweep collision over the traveled segment, sorting impacts |
| Fast player projectiles skipped thin wall cells | Sample the entire traveled wall path |
| A later wall discarded an earlier creature hit | Resolve creature impacts before the wall contact |
| Duplicate selection granted an extra treat/negative pending level count | Accept only currently offered choices while the reward screen is active; ignore repeated keydown |
| More than 500 drops bypassed the pickup-radius nerf | Merge settled, same-cell XP piles while preserving value and leaving distant loot on the ground |

## Verification and release

The new reproducible suite is `npm run test:bug-audit`. Additional coverage includes TypeScript, 24 isolated progression/entitlement/art tests, costume defenses, pickup bounds, progression rewards, all boss rounds and shields, 200 rescue sites, 30 seeded expansion maps, UI/layout, supplied artwork, audio and a production smoke test. Release status is recorded in `WORK_COMPLETION_AUDIT.md`.

RUN version 1.1.3 was uploaded and submitted for public release. Both the hosted review build and unkeyed public game pass the exact-bundle, 234-asset, gameplay, catalogue, inventory and production-gating checks. RUN approval completed and the Public release tag is verified at 1.1.3. The public browser used no authenticated account or share key.

No real purchase is executed during testing. Paid checkout remains inactive pending price confirmation. Developer access preview and Collection are excluded from production. Tests reduce risk; this is not a guarantee that every possible playthrough is bug-free.
