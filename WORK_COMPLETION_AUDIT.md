# Requested work versus completed work

Checked 2026-10-10. This audit combines the previous completed expansion with the latest artwork, UI, balance, rescue and purchase requests. Later explicit enemy-scaling and premium-skill requests supersede the earlier XP-only balancing restriction.

## Priority follow-up: easy wins and mobile

The ordered checklist is in `REQUESTED_WORK_PLAN.md`. Batch 1 is publicly approved as RUN 1.1.7 and merged through [PR #10](https://github.com/rumcan/TrickOrTreat/pull/10), merge `b9bce5aba692436e0bab85fbf9ba89d648ec41ee`. Hosted exact-bundle/assets and active permanent 100-Bit storefront/restore/cancellation checks passed. Later instructions now explicitly permit free players to win premium vending prizes; this supersedes the historical preview-only implementation below. Premium vending prizes last for the run and do not grant the permanent entitlement. Spin prices now rise 30%, and unwanted weapons can be rejected and the orange exit used immediately after settlement.

Verification: TypeScript, vending odds/claim/reject/premium entitlement guards, desktop hover/mobile overlay behaviour, Pea-only starts, static costumes, full-height replay, fullscreen request and denial fallback, native multitouch at four sizes, 17 existing bug regressions, menu/layout regression and 234-asset production desktop/phone smoke passed. Browser fullscreen requires the Play gesture and host/browser support; physical phone certification is not claimed. The unfinished high-resolution card-art work is safely parked and is excluded from Batch 1.

## Next release: map, rescue, boss breaks, sounds and gun cards

Implemented and locally verified, awaiting production/deployment checkpoint: opened road-blockade hedges disappear with collision restored without unlocking intersecting closed gates; ground hordes spawn in reachable body-clear positions. Close chasing respects low hedges, navigation accounts for body clearance, and full-footprint spawn checks cannot miss small obstacles. Houses reserve continuous approaches, parked cars cannot cover porches, and every door is checked against an all-districts-open body-clear flood.

Missing friends have large green foreground beacons, green minimap marks and readable gate/nearest-kid directions. Boss kills clear hostile entities, conserve all boss XP in at most 15 piles, spill coin/chest/XP drops with golden trails and delay collection briefly so the burst is visible. A playable 20-second safe break has Visit upgrade shop and Skip buttons; menus/shop pause the countdown and repeated bosses still restart stronger.

Conventional shooting/impact/reload/pickup/door details and timed slot start/tile/settlement/exit sounds layer over unchanged deep recordings. Synthetic voices are limited to 12, cleaned up, throttled and routed through the existing mute/volume/limiter; dash remains the soft whoosh only.

All 13 gun card masters are generated at 1536x1024 with the built-in image generator and original style/sprite references. `art/weapon-cards/generation.json` records the exact prompts and provenance. The 26 responsive 480/960px WebPs total 888,826 bytes; they load lazily in large cards, prizes and premium showcase, never replace held/HUD sprites, and the main menu does not preload the entire set. The dark painted card background is intentional, not transparent.

Local verification: 780 reachable doors/48 clear rescue sites across 24 maps; 50 opening-guide seeds; actual low-hedge pursuit; exact boss XP, paused safe-break timer and UI shop/skip; all 13 masters and 26 WebPs; responsive card decoding; bounded/muted/cleaned audio layers and unchanged deep bus; four mobile viewports/native multitouch, all 17 bug regressions, 12 returning bosses and 5,720 held-gun combinations. Physical phone certification is not claimed.

Final local release checks: TypeScript, 27 isolated rules/input/purchase/geometry tests, retained easy-win/vending/build-menu regressions, packed production desktop/portrait/landscape gameplay (234 atlas assets), and production leaderboard reporting with a simulated SDK write all passed. No actual order, debit or leaderboard score was created.

## Approved public release: mobile, logo, leaderboard and vending reel

RUN 1.1.6 was approved publicly on 2026-10-10 with server config `zd5wSy5tCfJVFxFyEpAg`. Public hosted checks verified the exact audited bundle, 234 assets, free gameplay, active permanent 100-Bit purchase, and live survival/rescue all-time leaderboard configuration. Source merged through [PR #9](https://github.com/rumcan/TrickOrTreat/pull/9), merge `bbbc256bba641ee631e00da504b97dc3ea5a4816`; local main was synchronized.

- Main-menu left drawer: signed-in RUN usernames and longest survival times; separate neighbourhood/rescue boards, all-time ordering, own rank, pagination, refresh/retry, keyboard focus handling and phone layout. Guests, missing profiles and the SDK's synthetic local mock identity cannot view or query the boards. No fake seed names are configured.
- Production runs of at least 10 seconds submit elapsed gameplay seconds at the run result, never paused/loading time. Per-run guards block duplicate submissions, account changes, local development and preview runs; a later endless result can improve the record. Submission failures preserve local saves and do not pretend a rank was accepted.
- Both map vending machines now open a paused Midnight Candy Machine instead of the Candy Lady shop. Every player can spend earned run coins (60 initially, increasing 25% per play), with no keys, Bits or purchase API. Existing Candy Lady stands and boss upgrade breaks remain intact.
- The slowing reel rolls once, centers the real prize, displays a full winner card and requires an explicit treat collection or weapon-slot choice. Double-charge/claim guards, incorrect spin-id protection, old-weapon drops, close-during-spin/unclaimed-gun protection and keyboard focus containment during a paid spin prevent reward loss or duplication.
- Hover/focus/tap reveals full missed-prize details, including gun stats/inscriptions and treat effects/tags. Premium prizes appear as clearly labelled, inspectable previews for free players, with 0% win chance until unlocked. This default was explicitly raised with the user; no instruction to allow premium wins for free accounts has been received.
- Published rarity odds match actual prize weights: Common 50%, Uncommon 30%, Rare 15%, Epic 4%, Legendary 1%. Within each rarity, normally 75% treats and 25% guns; an exhausted one-off treat pool reallocates that rarity to guns. One-off powers are excluded when owned; stackable treats can repeat. The visual reel is explicitly described as a showcase, not a probability table.

Verification: TypeScript, 11 isolated auth/record/odds tests, drawer browser checks with simulated RUN data, actual vending gameplay/animation/inspection checks, production end-of-run reporting with a simulated SDK write, all 17 existing bug regressions, opening-guide/street checks, four mobile viewports plus desktop input, existing presentation/layout regression, production build and 234-asset production smoke passed. No real leaderboard scores, purchases or Bits were written. Physical phone certification and hosted backend operation are not claimed.

RUN integration follows the installed SDK types and official [leaderboard](https://github.com/series-ai/venus-sdk-docs/blob/main/rundot-developer-platform/api/LEADERBOARD.md) and [profile](https://github.com/series-ai/venus-sdk-docs/blob/main/rundot-developer-platform/api/PROFILE.md) documentation. `rundot/leaderboard.config.json` accompanies the next deployment. The casual board has server bounds/rate limiting and client duplicate guards, not server-verified combat/replay anti-cheat; do not attach monetary rewards to it.

## Previous local follow-up: mobile playability

Implemented after public 1.1.5 and included in the 1.1.6 release submission above.

- Add independent captured-pointer movement and aim/fire sticks, analog walking, a dead zone and directionally normalized dashes; retain automatic nearest-target firing.
- Add Interact/revive/cannon, reload, skill and dash/flee controls; weapon slots are tappable. Third-finger actions work while both sticks remain held, without duplicate synthetic clicks.
- Expose map and run inventory on phones, increase touch targets, clear held inputs on pause/focus loss/cancellation/rotation/restart, and hide controls during paused menus.
- Use dynamic viewport height and safe-area spacing, reserve camera space above the controls, retain scrolling in weapon inspection, and add touch instructions and a tappable intro skip.
- Keep desktop keyboard/mouse controls and the mouse-only HUD intact.

Verification: TypeScript, five isolated touch-input/action tests, native Chromium multi-touch browser checks at 390x844, 320x568, 844x390 and 768x1024, desktop input/layout regression, all 17 bug-audit cases and opening-guide/street tests passed. Production build and smoke checks also passed: all 234 artwork assets load, portrait/landscape touch controls and map/build/pause access work without development tools, and developer controls are absent. These are emulated browser checks, not physical iOS/Android device certification.

### Loading-screen logo optimization

Local follow-up, not yet committed or deployed: replace the runtime 1,871,892-byte PNG with a transparent 1240px WebP (271,664 bytes; 85.5% smaller), plus a 640px small variant (97,850 bytes). Preserve the supplied original PNG. Preload the exact current logo URL at high priority instead of obsolete logo/key-art files, give background/UI imagery lower priority, deduplicate UI preloads, and reveal the logo only after a complete decode with its layout space reserved. `art:logo` regenerates just the logo derivatives; the full presentation-art preparation also generates them.

Verification: delayed-download desktop and phone tests passed in development and production, verifying hidden-until-decoded rendering, stable layout, one shared optimized request, matching high-priority preload and no requests for the original/obsolete logo assets. Presentation tests passed for transparent alpha, dimensions, proportions and at least 80% size reduction, alongside existing responsive splash/thumbnail/audio checks. TypeScript, landing/picker layout regression, production build and production smoke checks passed (234 assets loaded; portrait/landscape phone controls retained).

## Current public release: enabled checkout and latest gameplay fixes

Deployed the tested game as RUN 1.1.5 on 2026-10-10, including the first-house guide, straight street geometry, shield-bubble removal and updated thumbnail. RUN approved the submission; Private, Review and Public tags now point to 1.1.5 with server config `t4GsIPaBxHExRrkvwmn4`. The full-game item is active at 100 RUN Bits, unique and non-consumable, granting one permanent `hide-and-shriek-full-game` entitlement.

Price verification: RUN's live currency-store display lists 200 Bits for USD 1.99, 500 for USD 4.99 and 1,000 for USD 9.99. Therefore 100 Bits is approximately USD 1 at the smaller bundles' rate, not a separate USD 1 cash checkout. The smallest currently displayed top-up is 200 Bits. No currency bundle or full-game purchase was made while checking these prices.

Verification: TypeScript, production build, 28 isolated tests, all 17 bug-audit regressions, opening-guide/streets, combat/rescue/store, landing, presentation, boss cycles, Epic costumes/special defenses, pickup radius and production smoke (234 loaded artwork assets) passed. New `test:run-purchase` verifies the hosted active catalogue, permanent entitlement/price mapping, enabled desktop/phone CTA, restore and a client-only cancelled purchase; it blocks real order writes. Real paid settlement is not claimed by these checks.

Merged into `main` through [PR #8](https://github.com/rumcan/TrickOrTreat/pull/8), merge commit `c354c34df7e045f090acac0e360dc810b6756ab1`; local main was fast-forwarded to match. The public hosted purchase check passed against config `t4GsIPaBxHExRrkvwmn4`: active listing and correct price/permanent entitlement, enabled responsive purchase CTA, restore and client-only cancellation, with no actual order or debit. This section supersedes the historical inactive-checkout and local-only statuses below.

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
