# Requested work versus completed work

Checked 2026-10-10. This audit combines the previous completed expansion with the latest artwork, UI, balance, rescue and purchase requests. Later explicit enemy-scaling and premium-skill requests supersede the earlier XP-only balancing restriction.

| Requested work | Result | Verification |
| --- | --- | --- |
| Install dependencies and run the project | Complete; dependencies installed and Vite available at http://127.0.0.1:5173/ | TypeScript, build and browser suites run successfully |
| Consistent reference-guided world artwork, all new treats and landmarks | Complete: 234 active assets; all 43 treat cards, 15 new props and 16-direction Candy Cannon; exact prompts and references retained | Atlas validation: 234 valid, zero pending/failed; production loads all 234 |
| Correct road markings and skewed sidewalks | Complete: marked/unmarked road selection, three regenerated straight sidewalk variants | Artwork geometry checks and repeated-tile visual review |
| Updated transparent logo, all five portraits, matching HUD faces, desktop/mobile splashes, square poster | Complete | Landing and presentation suites; transparent logo and poster file checks |
| Center kid selection/logo, radio top-left, unlock top-right; select kid then start | Complete; all five kids start directly with correct access gating | Landing suite, desktop and phone layouts |
| Radio copied from Heavy-Metal-GP, deep SFX plus subtle click/tick/swoosh, soft dash | Complete; deep base sounds preserved, details routed separately | 24 byte-identical tracks; all 15 sounds decode and radio plays |
| Raise and shrink guns; right-side pickup inspection; pause to read and choose slot | Complete for player and companion | 5,720 player combinations, four companion facings; six viewport pickup tests |
| Improved cards and readable white text; eliminate duplicate costume prompt | Complete | Outstanding UI suite and screenshot review |
| Run-build effects first, separate synergy/damage tabs, expandable tier explanations | Complete | UI tab/keyboard, contrast and collapsed-detail tests |
| End-of-run death/essence summary before spending on expanded talents; explain talent locks | Complete | Existing end-run flow and current talent-lock/UI tests |
| Steeper exponential XP, fewer incidental treats, location-specific rarity | Complete: home Common–Rare; business Rare–Epic; major landmark Rare–Legendary | Four progression unit tests and in-game reward/XP tests |
| Populate expanded map: drive-in, rental store, church, barn, primary school/playground and mounted cannon | Complete, gated to the full-game map | Expanded map/entrance checks and complete generated artwork |
| Safe initial spawn, solid hedge/gate boundaries, reachable district entrances | Complete | Swept collision/dash/ghost tests and seeded map checks |
| Intro cutscene, rescue friends, one companion, shared guns, automatic upgrades/loot, companion revival | Complete | Expansion suite: guardians, rescue, gun sharing, upgrade sync, downed/revive and 30 seeded maps |
| Find missing kids: minimap, full-map names, rescue arrow; no bag arrows; never inside houses | Complete; scenery-free reachable spawn search and foreground rescue beacons | 200 rescue positions across 50 maps; actual renderer labels and no bag indicator |
| Three additional bosses, monster clear and safe upgrade break, repeating stronger boss rounds | Complete: four boss types repeat independently of rescue progress | Twelve returning bosses over three rounds; each clear pauses and removes enemies/projectiles |
| Monsters become substantially tougher every wave | Complete: HP ×1.6 and damage ×1.12; living enemies scale without healing; progression carries into endless mode | Five successive opening-wave checks and recurring-boss regression |
| Lieutenants and bosses with rechargeable shields | Complete; damage absorbed first, overflow reaches HP, delay after hits, recharge frozen while paused | All four boss shields, lieutenant absorption/overflow/recharge/pause tests |
| Much stronger unlockable kid skills | Complete: Maya full recovery/refill/EMP, invulnerability and ×2 damage; Leo large blast/stun/slow, dash refill, invulnerability and ×3 damage | Actual skill effects and temporary-multiplier expiry checks |
| Green gore, red/off setting; optimized effects first | Complete with bounded particles/decals; no additional PNG animation necessary | Settings persistence, 900-particle/160-decal caps and render timings |
| Pretty purchase page displaying everything unlocked and a CTA | Complete: both kids, four guns, three treats, two costumes and nine talents, generated art, restore and permanent-unlock CTA | Full catalogue checked against live data, desktop/phone fit, image decode and Escape/focus restoration |
| Hide Collection on live/production | Complete; development-only, including query override protection | Production browser assertion |
| Publish latest update privately | Complete: RUN 1.1.2, private game AFjPSjQH9kbcCl57sgO3 | Deploy CLI confirmed success and private visibility |
| Create PR and merge main | Pending release verification and GitHub merge | Remote main and open-PR state checked |
| Activate approximately $1 permanent Bits unlock | Awaiting user price confirmation; draft 100 Bits remains inactive | Entitlement tests pass; no real checkout invoked |

## Verification run

TypeScript (`tsc --noEmit`), production build, atlas validation, 20 isolated tests (progression, entitlement store, art pipeline), and browser suites: combat/rescue/store, outstanding UI, landing, progression-game, weapon-layout, pickup-layout, expansion, encounters, boss-cycle, presentation, expansion-media and production. All passed. The artwork masters and prior versions remain in source; release packaging omits only unreferenced files from `dist`.

Real paid checkout is deliberately not tested: the catalogue item is inactive pending price confirmation. Premium gameplay is tested with the development-only access preview, which is absent from production.
