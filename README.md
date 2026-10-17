# Trick or Treat: Last Kid Standing

Halloween survival game with an optional Hide & Shriek rescue campaign.

Repository layout and housekeeping rules (where scripts, art and generated images go) are in
[AGENTS.md](AGENTS.md). Read it before adding files.

## Development

Use Node 22.12+ (Node 24 is tested), install with `npm ci`, then
`npm run dev:local` for the local game at http://localhost:5173/.
`npm run dev` uses the standard RUN SDK Vite configuration.
The title screen's **Preview expansion locally** button unlocks developer-only
testing without purchasing. It is absent from production builds.

Controls: WASD / arrows move, mouse aims, click fires, R reloads, 1/2 switch guns,
Space dashes, F uses the hero skill, E interacts / holds to revive, I opens the
run inventory, Esc pauses and M / Tab opens the map. During the opening, Space
or Enter skips dialogue. The paused Friends & shared guns screen selects the
one active helper and swaps weapons.

Settings include separate music/SFX levels and green, red or disabled gore.
The header radio preserves Heavy-Metal-GP's playback code and 24 original tracks.
Generated SFX use a soft envelope, low-pass filter and a maximum of eight voices.
There are 15 effects, including quiet swoosh/click/tick detail layers. The SFX
bus uses a 1 kHz low-pass and a subtle 1.04 playback-rate lift; music is unchanged.
Title/loading backgrounds select the supplied landscape or portrait splash by
screen orientation. `npm run art:presentation` prepares these and RUN's square
512x512 JPEG thumbnail from `art/new/`, preserving the original files.

## Verification

```powershell
npx tsc --noEmit
npm run art:world:test
npm run test:expansion
npm run test:encounters
npm run test:expansion:media
npm run art:world:validate -- --browser --scene
npm run build
# With npm run preview -- --port 5174 running:
npm run test:production
```

Browser tests require the dev server on port 5173 and Microsoft Edge. Media
verification also reads the unchanged music in sibling `../Heavy-Metal-GP`.
Tests mock all purchase transactions; they do not spend RUN Bits.

Production packing reduces generated art to the manifest's runtime `maxScale`
and omits inactive versions/provenance from `dist` only. Full-size source masters,
sidecars and previous overrides remain preserved in `public/assets/` and `art/`.

## Start the town builder

Open PowerShell in the **main game folder**, not one of its worktrees (the
builder edits the town in that folder's `output/town-builder/`):

```powershell
Set-Location "C:\Work Admin\PERSONAL\Repos\TrickOrTreat"
node scripts/town-builder/server.mjs --port 5190
```

Open **http://localhost:5190/**. Leave that terminal running while editing and
exporting; press Ctrl+C there to stop the builder. If it is already running,
open the URL instead of starting another server on the same port.

There are now two independent building spaces: **Maple Falls** at
http://localhost:5190/ and **New Town** at http://localhost:5192/. Use the map
selector beside the town name to switch; it saves pending edits before leaving.
Start both local builders with `node scripts/town/town-maps.mjs` from the main game
folder. New Town saves its layout, ground plan, lighting, bakes and exports under
`output/town-builder/maps/second-town/`, sharing the original sprite library and
presets. Starting it again preserves your edits. In-game travel between the towns
has not been added yet.

If PowerShell cannot find `node` or `npm`, the tested installation on this PC
can be enabled for the current terminal with:

```powershell
$env:Path = "C:\nvm\nvm\v24.21.0;$env:Path"
```

The builder automatically saves edits. Wait for its **saved** indicator before
exporting. The working files are:

| Location | Contents |
| --- | --- |
| `scripts/town-builder/` | Builder app, server, library tools and game exporter (committed) |
| `scripts/lib/town-scene.mjs`, `scripts/lib/town-paths.mjs` | Ground renderer and the builder's folder locations |
| `scripts/town/roads/`, `scripts/town/materials/` | Tools that made the road and grass materials the ground renderer paints with |
| `output/town-builder/layout.json` | Placed objects |
| `output/town-builder/plans/maple-falls.json` | Ground plan, roads and lighting settings |
| `output/town-builder/library/` | Object artwork and library metadata |
| `output/town-builder/map-current.json` | Pointer to the current ground bake (`map-version-*`). Each **Rebuild ground** keeps the current and previous bake and deletes older ones |
| `output/road-autotile-v4/`, `output/terrain-materials/`, `output/paving-kit/` | Road, grass and car-park materials the ground bake reads |
| `output/town-art/` | The town's working art (raw generations, guides, sprite masters). Set `TOWN_ART` to use another folder |

`output/` is local and Git-ignored. Back it up along with the game: a fresh Git
clone has the builder but not your editable town data or its materials.

## Update the playable game map after editing

1. In the builder, finish editing and wait for **saved**. If you changed the
   ground plan (roads, lots, paving or ground lighting), click **Rebuild ground**
   and wait for it to finish successfully. Do not export while a rebuild is
   still running.
2. Keep the builder running on **5190**. The game exporter uses it to render
   fences. In a **second PowerShell terminal**, return to the main game folder:

   ```powershell
   Set-Location "C:\Work Admin\PERSONAL\Repos\TrickOrTreat"
   ```

3. Back up the current playable map before replacing it:

   ```powershell
   Copy-Item -LiteralPath "public/assets/town-built" -Destination "output/town-built-backup-$(Get-Date -Format yyyyMMdd-HHmmss)" -Recurse
   ```

4. Generate the playable map. Wait for the final **done** message; this can take
   several minutes. The exporter replaces `public/assets/town-built/` in the main
   game folder: `town.json` alongside `ground/`, `sprites/` and `sprites-hd/`.

   ```powershell
   node scripts/town-builder/export-game.mjs
   ```

5. Run `npm run dev:local` in another terminal (or use the existing server),
   reload http://localhost:5173/, and start a **new run**. Check the changed area,
   doors, collision, lighting and the in-game map. Existing runs keep their
   already-created map. Then build the game with `npm run build` before uploading.

The builder's **Export image** button produces a picture for review. It does
not replace the playable map or publish anything to RUN.world. The game reads
`public/assets/town-built/`; editing `output/town-builder/` alone does not update it.

## Publish to RUN.world manually

Use the main game folder throughout. This game's ID is
`AFjPSjQH9kbcCl57sgO3`, already set in `game.config.prod.json`. Update that
existing game; there is no need to run `rundot init` again.

1. Verify the RUN CLI is available and sign into the account with access to
   this game:

   ```powershell
   rundot --help
   rundot login
   ```

   On this PC the CLI is installed at
   `C:\Users\Francois Smit\AppData\Local\Programs\Rundot\rundot.exe`.
   If `rundot` is not on PATH, invoke that executable with PowerShell's `&`
   operator. Installation instructions are in the
   [official CLI repository](https://github.com/series-ai/rundot-cli-releases#installation).

2. If the town changed, complete the map-export steps above first.
   Build the latest game, including release asset packing:

   ```powershell
   npx tsc --noEmit
   npm run build
   ```

   Both must succeed. Upload **`dist/` from the main game**, not the builder's
   worktree or `output/`. For a local production check, run
   `npm run preview -- --port 5174`, open http://localhost:5174/, and check a run.

3. Choose one upload route:

   **Unlisted test version** — upload and use the share URL returned by the CLI:

   ```powershell
   rundot deploy --game-id AFjPSjQH9kbcCl57sgO3 --build-path ./dist --json
   ```

   **Public release submission** — upload a new version for public review:

   ```powershell
   rundot deploy --game-id AFjPSjQH9kbcCl57sgO3 --build-path ./dist --public --json
   ```

   Deploy automatically increments the version. `--public` submits it for
   review; it is not a guarantee of immediate Explore visibility. An unlisted
   upload does not replace the currently public version.

4. To promote an already-uploaded, tested version, list versions and submit
   that **exact version** instead of uploading again:

   ```powershell
   rundot game list-versions --game-id AFjPSjQH9kbcCl57sgO3
   # Replace 1.2.3 with the new version you tested:
   rundot game set-public --game-id AFjPSjQH9kbcCl57sgO3 --version 1.2.3
   ```

   A submission must be newer than the currently public version. Open the
   returned share URL to verify the uploaded build. The game's catalog address
   is https://run.world/catalog/game/AFjPSjQH9kbcCl57sgO3.

See the [official deployment guide](https://github.com/series-ai/venus-sdk-docs/blob/main/rundot-developer-platform/deploying-your-game.md)
and [CLI reference](https://github.com/series-ai/rundot-cli-releases#deploy)
for publishing and visibility details.

## Paid expansion

The original survival game remains free.

`rundot/shop.config.json` declares a permanent, unique, server-entitled unlock.
**The item is inactive until the exact Bits price is confirmed.** Its draft
100-Bits price does not assert a $1 conversion. Set the confirmed value and
activate the catalog only after that decision. Ownership is restored from RUN,
not trusted from local storage. Purchase retries reuse an idempotency key;
cancelled, failed or unverified orders never grant access.

Private-release catalog testing may require RUN Playground. Playground
purchases use real wallets: use the isolated mock tests for failure cases.

See [docs/EXPANSION_PLAN.md](docs/EXPANSION_PLAN.md) for the design and completion checklist
and [art/world/README.md](art/world/README.md) for exact-reference artwork generation,
review, packing and activation. Each generated Atlas PNG has a provenance sidecar.
