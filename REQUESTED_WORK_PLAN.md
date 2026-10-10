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
- [x] Verify desktop/mobile, vending/premium reward guards, replay and production build; publish RUN and merge main. Public 1.1.7, PR #10 merged; exact hosted build and 100-Bit storefront checked.

## Batch 2: map, rescue, combat and media

- [x] Remove opened district hedges, retaining decoration only away from paved roads.
- [x] Fix creatures accumulating behind hedges; body-clearance routes, low-hedge chase collision and reachable horde spawns.
- [x] Add obvious green arrows above all missing rescue kids; keep minimap/directional guidance useful.
- [x] Make trick-or-treat doors approachable; full-footprint collision, reserved walkways, parked-car guards and connected porch validation.
- [x] Announce boss kills, spill rewards visibly with golden trails, and provide a skippable 20-second no-spawn shopping break.
- [x] Add slot-machine sound feedback and conventional shooting/gameplay detail layers without removing the existing deep sounds.
- [x] Finish all 13 high-resolution gun card illustrations in the established reference style; integrate optimized card-only art and retain small held/HUD sprites.
- [ ] Run regression checks, publish the remaining updates and merge main.

## Already delivered before this follow-up

RUN 1.1.6 is publicly approved and hosted checks passed (exact build, shop at 100 Bits, survival/rescue leaderboard configuration). Mobile sticks, loading-logo optimization, authenticated leaderboard and the original vending reel were merged through PR #9. Earlier verification and implementation details are in `WORK_COMPLETION_AUDIT.md`.

## Consolidated earlier requests (already delivered; latest instructions above take precedence)

Easy wins / presentation:

- [x] New transparent newlogo.png; centered bobbing logo and landing-page character picker.
- [x] All five updated portraits/HUD faces, desktop/portrait splashes and latest supplied RUN thumbnail.
- [x] Radio top-left, unlock top-right, select a kid then Go trick-or-treating.
- [x] Raise/shrink player/companion guns; center-right gun inspection and slot selection.
- [x] Readable cards/typography and white text; remove duplicate costume-equip prompt.
- [x] Collected effects first in run build; separate synergy/damage tabs and expandable tiers.
- [x] Death/essence tally before expanded talents; explain locked talent prerequisites.
- [x] Hide Collection/developer tools on live; attractive full-unlock catalogue and CTA.
- [x] Rename RUN game Trick or Treat - Maple Falls; permanent 100-Bit purchase and restore enabled.

Mobile / loading / records:

- [x] Movement and aim/fire sticks, interact/revive, reload, skill, dash, tappable weapon slots, map/build/pause and intro skip.
- [x] Multitouch, safe areas, portrait/landscape responsiveness and held-input cleanup on rotation/focus loss.
- [x] Smaller optimized logo, high-priority preload and complete-decode reveal.
- [x] Signed-in username/time leaderboards in a left main-menu drawer; guest gating and survival/rescue boards.

World / art / encounters:

- [x] Install dependencies and start/restart the development server.
- [x] Reference-driven world/treat/character/boss artwork pipeline; expansion vector placeholders replaced.
- [x] More guns, rarer stronger treats, costumes, expanded talent tree and two additional playable kids.
- [x] Populated map, drive-in, video rental, church, barn, primary school/playground and mounted Candy Cannon.
- [x] Safe initial spawn, solid locked boundaries and reachable district entrances.
- [x] Correct road center-line/plain variants and straight projected sidewalk slabs/curbs.
- [x] Hide-and-seek intro, downed friend rescue, one active fighter, weapon sharing, shared upgrades, companion loot and player revival.
- [x] Four boss types, hostile clear on death and stronger repeating rounds independent of rescue progress.
- [x] Large per-wave monster health/damage scaling; shielded lieutenants/bosses with blue bars absorbing hits first, no shield bubbles.
- [x] Wave-10+ immunities/ricochet/piercing defenses, subtle damage-reduction reasons and regular fodder alongside specials.
- [x] Powerful premium kid skills, no starting costumes, rare Epic costume drops and abilities.
- [x] Steeper exponential XP/fewer incidental treats; houses Common–Rare, businesses Rare–Epic, big landmarks include Legendary.
- [x] Weapon inscriptions, paused E inspection/slot choice, collected effects and synergies.
- [x] Green optimized gore with red/off settings; nerfed automatic pickup radius.
- [x] Deep generated SFX/imported radio, layered detail sounds and soft dash replacing the bang.
- [x] Bug audit, public publishing, checkout configuration verification, PRs and main merges.

Verification boundary: emulated phones and cancelled checkout are tested; physical iOS/Android certification and a real paid debit are not claimed. Batch 2 is locally implemented/verified; its final production/deployment checkpoint stays unchecked until approval and hosted verification.
