# Town Builder variation queue

This local runner generates Town Builder sprite sheets through the signed-in RUN.world CLI. Its current production defaults are **RUN only**, with model and credit cap routed by subject kind. Buildings and vehicles use `gemini-3.1-flash-image-preview` with BRIA background removal, capped at **147 RUN credits per sheet**. Props, decals and other kinds use `gemini-3.1-flash-lite-image` with BRIA, capped at **90 RUN credits per sheet**. The earlier Flash Image + BiRefNet setup cost 165 credits per sheet. No OpenAI API key is needed.

Codex's built-in `image_gen.imagegen` integration remains available as an optional provider, configured for `gpt-6-luna`. It uses the existing Codex sign-in and does not need an API key, but it does not bypass account usage limits. Codex generation is currently stopped because account usage is exhausted. Its stop marker is `output/imagegen/town-variations/2026-10-17/STOP-codex`.

The runner itself calls neither an OpenAI API fallback nor another image provider. Prompts are passed as argument arrays or stdin, never through a shell.

## What is queued

The campaign snapshots every current entry in `output/town-builder/library/library.json`, including decals, ground paint and shadows, and adds 12 industrial buildings. The inventory contains **464 existing entries + 12 industrial subjects = 476 production subjects**. The manifest also contains six screenshot-reference pilot jobs per provider (three subjects, with and without the town screenshot), twelve pilot jobs overall, and production jobs for both providers, for **964 jobs total**. Only RUN production is active by default. Three RUN pilot sheets have been accepted for reuse in production, avoiding duplicate requests for those subjects; remaining production follows the per-kind routing above. Three Codex pilot sheets also exist, but Codex production is stopped due to exhausted account usage.

- Buildings: **one building per sheet**, changed footprint, facade, height and roof shape.
- Vehicles: **one new vehicle design with four useful views**: horizontal broadside, vertical front-on, vertical rear-on, and one diagonal. Keep paint, trim and load consistent; do not spend cells on mirrored corner pairs.
- Carts: **empty, tipped over, three nested together, loaded/opposite direction**.
- Other props and ground decals: **four genuinely different shapes, sizes and arrangements** in a 2 by 2 grid.
- Shadows: four translucent shadow variations.

Prompts specify the original painterly style, the late 1980s / early 1990s setting, vertical upright edges, and exact orthographic **2:1 ground-axis slopes ±0.5 (26.565°)**. They ask for a square 2048px transparent PNG; native output resolution depends on the generator. Outputs are never enlarged to pretend they have more detail.

Original library images and the customary `art/reference/style-target.webp` are always sent. The user's town screenshot is a third, optional context reference. Its role is explicitly limited to camera, materials and palette, excluding UI, scenery and background. Pilot review found the screenshot helpful for RUN litter (it removes dirt islands) and workshop variety. Current production policy uses the screenshot for RUN and excludes it for Codex. The stronger building and cheaper paper-litter samples passed initial visual review. The user rejected mirrored diagonal vehicle views, so the layout was changed to horizontal broadside, vertical front, vertical rear and one diagonal. The replacement car visibly meets that layout. All subjects are now enabled and all sheets remain available for manual review.

## Start, stop, resume

Run PowerShell from the main game folder:

```powershell
# Default: RUN production only, one active image, 90 seconds minimum between starts,
# stop accepting work at 20:00 South African time and let the current image finish.
./scripts/town-variations/start.ps1

# Explicitly run the reference experiment (already completed for this campaign):
./scripts/town-variations/start.ps1 -Phase pilot

# Codex is optional and currently stopped due to exhausted account usage:
./scripts/town-variations/start.ps1 -Provider codex -Phase production

# Progress (if Node is not on PATH, use the tested executable):
& 'C:\nvm\nvm\v24.21.0\node.exe' scripts/town-variations/runner.mjs status

# Refresh the local review gallery:
& 'C:\nvm\nvm\v24.21.0\node.exe' scripts/town-variations/runner.mjs review

# Stop RUN gracefully after its current image:
& 'C:\nvm\nvm\v24.21.0\node.exe' scripts/town-variations/runner.mjs stop --provider run

# Resume on another day; provide that day's deadline explicitly:
./scripts/town-variations/start.ps1 -Resume -Until '2026-10-18T20:00:00+02:00'
```

Use `-Provider codex` or `-Provider both` to explicitly select other providers. Use `-Only 'world:car_0'` or a comma-separated list of asset IDs to run a subset. Per-provider locks prevent duplicate workers. A deadline in the past is rejected by the launcher. Workers run hidden and survive the chat ending. **Keep the PC awake and connected**; this does not install a Windows service or change power settings. After a reboot, run the resume command. Completed sheets are skipped.

The RUN queue alone is likely to take multiple sessions. At a 90-second minimum gap, 476 subjects require almost 12 hours even if generation were instantaneous. Actual generation, limits and retries add time. Buildings and vehicles have the higher per-sheet credit cap listed above. The first subjects prioritize shopping carts, industrial buildings, litter, vehicles and placed assets. Untouched work remains pending for the next run. The campaign deadline is 20:00 SAST on October 17, 2026.

## Files and reference experiment

All campaign data lives in:

`output/imagegen/town-variations/2026-10-17/`

- `manifest.json`: frozen subject inventory, cell descriptions and job queue; the pre-production classification review is recorded here.
- `references/`: exact input snapshots, with hashes and source paths in the manifest.
- `prompts/<provider>/`: exact final prompts.
- `sheets/codex/` and `sheets/run/`: PNG sheets for later slicing, with JSON sidecars giving native cell rectangles and slot descriptions.
- `states/`: resumable per-job progress, input choices, checks and errors.
- `receipts/` and `attempts/`: provenance, native outputs from unsuccessful checks, and full CLI logs.
- `codex.log`, `run.log`, `*-worker.json`: worker progress and heartbeat.
- `reference-policy.json`: whether production requests include the town screenshot. Workers reread it before each new request.
- `review.html`: generated gallery, refreshed after completed production images or by the `review` command.

The reference experiment compares matching subjects and prompts with and without the screenshot. Image sampling is nondeterministic, so this is a small qualitative comparison, not proof of a universal improvement. Review camera fit, painting style, period details, distinct variants, clipping and background leakage. The current campaign policy includes the screenshot for RUN and excludes it for Codex.

No generated sheet is automatically sliced, registered, copied over an old asset, or exported into the playable game. Automated checks verify PNG format, alpha area, content in each cell, clear middle gutters and no major canvas clipping. They cannot establish correct object count, perspective, consistent car identity, artistic quality or pixel-perfect geometry. Every output keeps `visualReview: pending` for review and slicing.

Transient failures are retried up to three times; rate/quota limits up to six with cooldowns. Account authentication, exhausted credits or an unavailable image tool stop the affected provider for inspection. Other providers continue. Use `resume` after resolving the account issue. Failed jobs remain visible and are not silently marked complete.

## Verify the runner

```powershell
& 'C:\nvm\nvm\v24.21.0\node.exe' --test scripts/town-variations/runner.test.mjs
```

These tests use temporary synthetic PNGs, fake generation, and no account calls. They exercise sheet classification, command argument safety, camera/reference prompts, alpha/gutter/cell checks, backoff, stop behavior, skipping completed jobs and recovery after interrupted state updates.

For a completely new campaign, use `runner.mjs prepare --out <fresh-directory>`. Existing manifests are never overwritten. The screenshot must first exist at `output/town-builder/world-reference-2026-10-17.png`.
