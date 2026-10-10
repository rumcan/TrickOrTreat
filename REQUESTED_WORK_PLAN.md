# Maple Falls — prioritized follow-up

Requested 2026-10-10. Publish and merge Batch 1 before proceeding with Batch 2.

## Batch 1: easy wins and mobile first

- [x] Allow everyone to win premium vending guns/treats; label premium prizes without unlocking the expansion.
- [x] Increase spin prices slightly faster, with each successive spin costing more.
- [x] Allow rejecting a won gun, closing the machine and returning to play; orange Back to the streets action.
- [x] Transient desktop prize hover; no mobile hover overlays, with won-item details retained.
- [x] Fix talent-tree replay button height/padding and prevent flex shrinking.
- [x] Start with the Pea Shooter only; remove the free ground gun.
- [x] Remove Heavy Metal GP references from the radio.
- [x] Remove the small In game sprite tile from character selection.
- [x] Fix stretched skill-icon boxes on character cards.
- [x] Use static, cleanly framed costume previews in the premium showcase.
- [x] Request fullscreen on the mobile Start gesture, expose a fullscreen control, and handle unsupported/denied requests gracefully.
- [x] Reduce mobile visual clutter, control footprint and world zoom in portrait/landscape while preserving usable touch targets.
- [ ] Verify desktop/mobile, vending/premium reward guards, replay and production build; publish RUN and merge main.

## Batch 2: map, rescue, combat and media

- [ ] Remove opened district hedges, retaining decoration only away from paved roads.
- [ ] Fix creatures accumulating behind hedges; verify pathfinding and spawn reachability.
- [ ] Add obvious green arrows above all missing rescue kids; keep minimap/directional guidance useful.
- [ ] Make every trick-or-treat door approachable; validate free/campaign map seeds and gated access.
- [ ] Announce boss kills, spill rewards visibly with golden trails, and provide a skippable 20-second no-spawn shopping break.
- [ ] Add slot-machine sound feedback and conventional shooting/gameplay detail layers without removing the existing deep sounds.
- [ ] Finish all 13 high-resolution gun card illustrations in the established reference style; integrate optimized card-only art and retain small held/HUD sprites.
- [ ] Run regression checks, publish the remaining updates and merge main.

## Already delivered before this follow-up

RUN 1.1.6 is publicly approved and hosted checks passed (exact build, shop at 100 Bits, survival/rescue leaderboard configuration). Mobile sticks, loading-logo optimization, authenticated leaderboard and the original vending reel were merged through PR #9. Four gun illustrations have been generated; integration is parked safely while Batch 1 is prioritized. Earlier requests and their historical verification are in `WORK_COMPLETION_AUDIT.md`.
