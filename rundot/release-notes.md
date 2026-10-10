# Phone fixes: drag to move, one-screen menu, Back closes popups

- Drag a finger anywhere on the play area to move. The two on-screen sticks are gone; the kid aims and fires alone.
- The title screen fits one phone screen in portrait and landscape, with no scrolling to reach the menu buttons.
- The browser Back gesture now closes the open popup (or pauses a run) instead of leaving the site. Every popup also
  has a close button pinned in the corner, and tall popups no longer open scrolled past their top.
- A tiny music mute key sits top-left in the game and on the phone menu.
- The fullscreen button is shown only where fullscreen can work. It no longer covers "Discover the full game".
- The open map has a real Close map button on touch screens, and a tap on the map closes it.

# Tougher monsters, bounded damage, gazebo hideouts and a looping loader

- The loading screen appears instantly from plain HTML with a looping bar instead of a progress bar that sat at 2%.
  The logo and the splash for the current orientation are smaller and are fetched before any sprite.
- Rescue campaign: every gated district now has a gazebo, and each missing friend waits beside one.
- Damage numbers start low: guns and skills deal 40% of their old values, numbers are abbreviated (1.5K, 2.3M) and
  at most 40 are on screen.
- Runaway damage is gone. Overcrit layers add instead of multiplying, and Lucky Streak, Momentum, Candy Corn Combo,
  Haunting, Inferno, Juggernaut, Bulwark and Sugar High all have ceilings. Treats stop at their maximum.
- 40% fewer monsters, each worth 60% more XP and coins. Monsters take about 2.7x as many shots from the first minute
  and gain 65% health a wave (was 60%); bosses have twice the health relative to the player.
- Guns reach 40% of their old range. Tractor Beam, Laser Sword, Danger-Zone Aviators and Heat-Vision Hunter each add
  2 m, and Maya and Leo have +50% gun range. Weapon cards show range.

# Easy wins and mobile visibility

- Everyone can win premium guns and treats from earned-coin vending spins, clearly labelled Premium. Prizes last for the run and do not permanently unlock the expansion.
- Spin prices start at 60 coins and rise 30% each time. Reject unwanted guns, or leave the machine; orange exit buttons make the choice visible.
- Desktop prize hover disappears automatically; touch/mobile screens show only the won item's full detail card.
- Fix the talent replay button's height and padding. All runs now start with only the Pea Shooter, without a free ground gun.
- Clean up radio wording, remove the In game preview tile, square skill icons and use static premium costume previews.
- Request fullscreen on mobile Play, provide a fullscreen button, and preserve gameplay when the browser or embedding host denies it.
- Reduce mobile world zoom, stick/action sizes and HUD clutter while retaining 44px touch targets.

# Mobile controls, faster logo, leaderboard and vending prizes

- Add independent movement and aim/fire touch sticks, mobile action buttons and responsive portrait/landscape menus.
- Replace the large loading-logo PNG with transparent, preloaded WebP and reveal it only after decoding.
- Add a logged-in-only main-menu leaderboard drawer with named survival/rescue records and all-time rankings.
- Submit eligible completed runs; anonymous, mock and development sessions do not submit scores.
- Replace map vending shops with an earned-coin prize reel, explicit rarity odds, inspectable missed prizes and detailed winner cards.
- Free players can use the machine. Premium prizes are clearly marked preview-only unless the full game is owned; no Bits or keys are charged for spins.
- Pause gameplay during the reel and guarantee a single charge and claim, including explicit weapon-slot selection.

# Rare Epic costumes, late-wave counters and gameplay fixes

## Loot and late-wave combat

- All kids start without a costume. Costume Master now improves rare finds and worn skill power, not starting equipment.
- All ten costumes are Epic with substantially stronger abilities, purple loot glows and rarity badges. Base costume chance is approximately 1.14% per bag or 2.5% per house/elite/special kill.
- From wave 11, fire/lightning/ecto-immune creatures appear. Wave 13 adds ricochet wards and armor; wave 15 adds shells requiring piercing 2+.
- Special frequency rises gradually to 40%; plenty of ordinary enemies remain easy to mow down. After wave 10, special/boss HP grows 18% per wave versus 6% for the lower-health crowd. Earlier waves are unchanged.
- Short, muted resistance reasons appear above creatures when hits are blocked or reduced, with strict clutter limits.
- Enemy and boss shield lines are light blue and sit above health. Status indicators cannot obscure them; shields absorb damage before health, with only excess damage carrying through.
- Reduce the base automatic loot pickup radius from 1.7 to 1.0 world units. Treat and talent range bonuses retain their existing effects.

## Gameplay fixes

- No free healing by repeatedly swapping HP costumes or weapon resonance.
- Clear held movement and firing controls when the window loses focus.
- Respect elemental immunity for companion beams; sync companion weapons after bag upgrades and weapon pickups.
- Keep rescue guardian health and shield scaling consistent.
- Preserve the death screen and safe boss shop when multiple events happen in the same frame; clear queued chain reactions between encounters.
- Ignore destroyed enemy shots. Fast player shots use swept creature/wall collision and resolve impacts in travel order.
- Prevent duplicate reward selection and accidental key-repeat picks.
- Compact nearby XP into ground piles without vacuuming distant loot or losing its XP value.

## Artwork and run-build polish

- Raise small held guns to the kids' hands, above the hips, for players and companions.
- All five new character portraits and matching HUD faces, with centered landing-page selection.
- Generate all 43 treat illustrations, 15 new map props and the Candy Cannon animation, using the established reference style.
- Regenerate all three sidewalk variants with straight, repeatable paving joints.
- Effects-first inventory, separate synergy/damage tabs, expandable tiers, improved cards and readable white text.
- One costume interaction prompt; clear talent prerequisites and cyan friend-rescue map markers.
- Steeper exponential XP curve, fewer incidental treats and building-specific reward rarities.
- Stronger recurring bosses after every campaign round, with paused upgrade breaks.
- Full-game landmarks and mounted cannons restricted to the expansion map.
- No development Collection button in production.
- Nearby gun comparison and pickup prompt moved to center-right, keeping movement visible.
- Add soft swoosh, click and tick detail; lift SFX tone slightly while retaining gain limits and muted treble.
- Use the supplied landscape splash on desktop and portrait splash on upright phones.
- Replace the RUN thumbnail with the supplied square poster.
- Opening monster HP compounds by 60% per wave; after wave 10, special/boss HP grows 18% versus 6% for the easy crowd. Damage grows 12% per wave.
- Rechargeable lieutenant and boss shields, readable blue shield bars and shield-break feedback.
- Rescue kids spawn in reachable, scenery-free clearings; rescue/gate arrows replace bag arrows, with visible world beacons.
- Overcharged Maya and Leo skills: team recovery, shield-breaking EMP, powerful night blast, invulnerability and temporary double/triple damage.
- Full-game purchase showcase with every exclusive kid, gun, treat, costume and talent, responsive artwork cards and permanent-unlock CTA.

Original survival remains free. Expansion checkout is enabled for 100 RUN Bits as a one-time permanent unlock.
## Maple Falls: clearer streets, first-house guide and full-game checkout

- Add a glowing green arrow to an accessible starting house and a one-time, paused explanation of building loot rarities.
- Straighten sidewalk paving joints and repeating curbs while retaining the painted artwork.
- Remove round creature shield bubbles; keep light-blue shield bars and shield-first damage.
- Use the latest supplied Maple Falls poster for the RUN thumbnail.
- Enable the permanent full-game unlock for 100 RUN Bits. The original survival game remains free.
