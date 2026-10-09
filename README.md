# Trick or Treat: Last Kid Standing

Halloween survival game with an optional Hide & Shriek rescue campaign.

## Development

Use Node 22.12+ (Node 24 is tested), install with `npm ci`, then `npm run dev`.
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

## Private release and paid expansion

RUN game ID: `AFjPSjQH9kbcCl57sgO3`. Publish privately with:

```powershell
npm run build
rundot deploy --game-id AFjPSjQH9kbcCl57sgO3 --build-path ./dist --json
```

Do not add `--public`. Private releases are hidden from Explore but accessible
through their share link. The original survival game remains free.

`rundot/shop.config.json` declares a permanent, unique, server-entitled unlock.
**The item is inactive until the exact Bits price is confirmed.** Its draft
100-Bits price does not assert a $1 conversion. Set the confirmed value and
activate the catalog only after that decision. Ownership is restored from RUN,
not trusted from local storage. Purchase retries reuse an idempotency key;
cancelled, failed or unverified orders never grant access.

Private-release catalog testing may require RUN Playground. Playground
purchases use real wallets: use the isolated mock tests for failure cases.

See [EXPANSION_PLAN.md](EXPANSION_PLAN.md) for the design and completion checklist
and [art/world/README.md](art/world/README.md) for exact-reference artwork generation,
review, packing and activation. Each generated Atlas PNG has a provenance sidecar.
