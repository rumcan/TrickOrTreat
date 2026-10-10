# Requested work versus completed work

Checked 2026-10-10. This audit combines the previous completed expansion with the latest artwork, UI, balance, rescue and purchase requests. Later explicit enemy-scaling and premium-skill requests supersede the earlier XP-only balancing restriction.

## Current release: enabled checkout and latest gameplay fixes

Deployed the latest tested game as RUN 1.1.5 on 2026-10-10, including the first-house guide, straight street geometry, shield-bubble removal and updated thumbnail. RUN accepted the public-release submission into Review. Its new server config is `t4GsIPaBxHExRrkvwmn4`; the full-game item is active at 100 RUN Bits, unique and non-consumable, granting one permanent `hide-and-shriek-full-game` entitlement. Public promotion remains subject to RUN approval.

Price verification: RUN's live currency-store display lists 200 Bits for USD 1.99, 500 for USD 4.99 and 1,000 for USD 9.99. Therefore 100 Bits is approximately USD 1 at the smaller bundles' rate, not a separate USD 1 cash checkout. The smallest currently displayed top-up is 200 Bits. No currency bundle or full-game purchase was made while checking these prices.

Verification: TypeScript, production build, 28 isolated tests, all 17 bug-audit regressions, opening-guide/streets, combat/rescue/store, landing, presentation, boss cycles, Epic costumes/special defenses, pickup radius and production smoke (234 loaded artwork assets) passed. New `test:run-purchase` verifies the hosted active catalogue, permanent entitlement/price mapping, enabled desktop/phone CTA, restore and a client-only cancelled purchase; it blocks real order writes. Real paid settlement is not claimed by these checks.

The release is prepared on `feature/maple-falls-live-checkout` for integration into `main`; GitHub records the final PR/merge state. This section supersedes the historical inactive-checkout and local-only statuses below.

## Previous thumbnail-only update

Uploaded the updated `art/new/thumb_posterpng.png` as the 512x512 RUN thumbnail in poster-only release 1.1.4 on 2026-10-10. RUN subsequently approved 1.1.4 publicly. The original supplied image is preserved, and `public/thumbnail.jpg` and `public/thumbnail.png` are updated for future builds. The preparation helper now supports `--thumbnail-only --poster thumb_posterpng.png`, without rewriting portraits or splash artwork.

Verification: presentation tests passed; hosted 1.1.4 JPG/WebP thumbnails match the supplied poster after RUN compression; hosted gameplay HTML is SHA-256 identical to the live 1.1.3 release. Server config remains `h3QTycdrvZA6xrhxsh7s`. Pending gameplay edits below were deliberately excluded from this thumbnail-only deployment.

## First-house guide and street alignment

Implemented after public RUN 1.1.3 and included in the latest 1.1.5 release submission above.

| Requested work | Result | Verification |
| --- | --- | --- |
| Pretty green arrow to a starting trick-or-treat house | Complete: glowing, bobbing green arrow points to a reachable, unvisited non-trick house; offscreen direction and nearby E prompt; hidden during intro/visits/menus | 50 seeded free/campaign starts; desktop, portrait and landscape minimap-overlap checks; screenshot review |
| Quick explanation after the first house visit | Complete: short green explanation in the paused loot screen, describing building rewards and Common–Legendary ranges; clears on picking loot and appears only once per run | Cancel/trick/success/restart lifecycle checks and real keyboard interaction |
| Remove round creature shields but retain blue bars | Complete: shield bubbles removed; shield mechanics and light-blue bars above HP remain unchanged | Actual canvas assertions and existing shield absorption/overflow/recharge regressions |
| Straighten sidewalks and repeating curbs | Complete: retain painted materials, sample slab interiors and reproject joints/curbs onto exact 2:1 world geometry; cache seven corrected canvases | All four repeating curb endpoint tests, sampled-strip bounds, three cached slab variants and before/after visual comparison |

Verification: TypeScript, isolated tests, opening-guide/street browser checks, all 17 prior bug-audit cases, combat/rescue/store, existing UI regressions, production build and production smoke test (234 loaded artwork assets). Original generated artwork is preserved.

## Latest published request: costumes and late-wave counters

Published publicly on RUN as version 1.1.3 on 2026-10-10. RUN review completed and the Public tag now points to 1.1.3. Source integration follows the user's subsequent merge request: the verified update is prepared on `feature/public-release-1.1.3` for a release PR targeting `main`; GitHub records the authoritative merge state.

| Requested work | Result | Verification |
| --- | --- | --- |
| No costumes equipped at the start | Complete for all five kids, both modes and existing Costume Master saves; no guaranteed starter costume pickup | Ten browser start cases |
| Rare costume drops with Epic abilities | Complete: all ten costumes are Epic; approximately 1.14% base bag chance and 2.5% house/elite/special chance; ordinary kills do not drop costumes | Loot-weight tests, rarity checks and actual Witch, Skeleton and Vampire powers |
| Increasing special defenses after wave 10 | Complete: elemental immunities from wave 11, armor/ricochet wards from 13, strong-piercing-only shells from 15; special frequency grows from 12% to a 40% cap | Pure spawn/defense tests and real bullet, beam, explosion, burn and death-spread tests |
| Subtle explanations above resistant creatures | Complete: short, muted 10px hit reasons, throttled per creature, maximum eight on screen | Bounded-feedback assertion and screenshot review |
| Light-blue shield line above health, destroyed first | Complete for shielded enemies and boss HUD; status markers moved below HP to keep the shield line clear; existing shield-first damage preserved | Canvas geometry/color checks, boss HUD layout and shield-only/overflow browser assertions |
| Nerf automatic pickup radius | Complete: base radius reduced from 1.7 to 1.0 world units (41% smaller); pickup-range upgrades remain unchanged | Browser boundary tests for XP, coins and healing, fresh-drop delay, manual-item exclusions and stacked treat/talent bonuses |
| Keep ordinary hordes easy while specials demand better builds | Complete: ordinary mobs remain the majority; late ordinary HP grows 6% per wave versus 18% for specials/elites/bosses, with reduced crowd baseline; early scaling and 12% damage growth unchanged | HP-split, wave-transition and boss-cycle checks |

The old Costume Master capstone now improves costume discovery and worn skill power rather than equipping one at spawn. Epic purple ground glows and rarity badges communicate the new reward tier. The post-wave-10 split supersedes the earlier uniform HP growth recorded below.

Latest verification: TypeScript, 24 isolated tests, all 17 reproduced bug-audit cases, costume-specials gameplay, pickup bounds, progression-game, combat/rescue/store, boss-cycle, outstanding UI, expansion, encounters and media regressions, production build and production browser smoke test. Historical release checks below describe the earlier private 1.1.2 build.

## Detailed bug review and public-release request

The [bug audit](BUG_AUDIT.md) records all 17 reproduced and corrected cases, including health-swap exploits, companion upgrade/element handling, stale death/shop transitions, projectile tunnelling, duplicate rewards and excessive-drop pickup bypasses. All targeted regressions pass. The production build loads all 234 active artwork assets and excludes developer Collection/access-preview controls.

RUN deployment succeeded for version 1.1.3 with unchanged server config h3QTycdrvZA6xrhxsh7s. The public-release request initially entered Review; approval subsequently completed and the release tags confirm Public version 1.1.3.

Public game: https://run.world/catalog/game/AFjPSjQH9kbcCl57sgO3. Paid checkout remains inactive pending price confirmation.

Hosted review and public verification both passed in fresh signed-out browsers: the deployed game module is SHA-256 identical to the audited build, all 234 artwork assets load, free gameplay, purchase catalogue and inventory work, and developer controls are absent. Public verification uses no share key or authenticated account. Before approval, the unkeyed catalogue returned "Game Not Found"; the first check immediately after approval exceeded the two-minute startup budget, then a retry with asset-loading diagnostics passed. The reusable hosted check is `npm run test:public-release` (defaults to the unkeyed public URL and allows four minutes for a cold first load).

## Previously completed expansion and release

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
| Create PR and merge main | [Release PR #6](https://github.com/rumcan/TrickOrTreat/pull/6), targeting main | GitHub records the authoritative merge state and merge commit |
| Activate approximately $1 permanent Bits unlock | Awaiting user price confirmation; draft 100 Bits remains inactive | Entitlement tests pass; no real checkout invoked |

## Verification run

TypeScript (`tsc --noEmit`), production build, atlas validation, 20 isolated tests (progression, entitlement store, art pipeline), and browser suites: combat/rescue/store, outstanding UI, landing, progression-game, weapon-layout, pickup-layout, expansion, encounters, boss-cycle, presentation, expansion-media and production. All passed. The artwork masters and prior versions remain in source; release packaging omits only unreferenced files from `dist`.

Real paid checkout is deliberately not tested: the catalogue item is inactive pending price confirmation. Premium gameplay is tested with the development-only access preview, which is absent from production.
