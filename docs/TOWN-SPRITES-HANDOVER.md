# Town Builder sprite expansion and fence repair

Local-only work; not merged, published or deployed to Run.world. The live local builder is http://127.0.0.1:5190/ and the alpha-aware gallery is http://127.0.0.1:5190/sprite-review/.

## Locations and progress

Source: `scripts/town-builder/` in this repo. Data is the main checkout's `output/town-builder`; sprite masters are in `output/town-art/`. Another agent is actively changing the builder; preserve unrelated edits and the owner's layout.

`output/town-art/expansion-1988/manifest.json` is the authoritative planned/registered asset status. `PROGRESS.md` is regenerated from it. `native/` contains untouched full-resolution generated PNGs; `sprites/` contains alpha-cropped accepted PNGs. Buildings are individual images, never mixed into low-resolution prop sheets. `prompts/` and `receipts/production-index.json` retain built-in imagegen inputs and provenance; individual receipts may include rejected iterations. Some older receipts were reconstructed from the saved prompt rather than the full iteration history.

## Commands (from the repo root)

```powershell
node scripts/town-builder/expansion-guides.mjs
node scripts/town-builder/expansion-review.mjs asset-id another-id
node scripts/town-builder/register-expansion.mjs reviewed-id another-reviewed-id
node scripts/town-builder/expansion-catalog.mjs
node scripts/town-builder/expansion-validation.test.mjs
node scripts/town-builder/fence-projection.test.mjs
node scripts/town-builder/export-fences.mjs
node scripts/town-builder/group-layer.test.mjs
```

Use the built-in image generation tool, transparent background, each guide plus existing artwork as explicitly labelled references. Inspect every new image on an alpha-aware contact sheet before registration. Raw RGB below alpha zero may look like a halo in some image viewers but is invisible in the builder. Never automatically register unreviewed output. Physical sizes for most props are design estimates; an AI prompt alone does not prove a mathematically correct camera.

## Fence repair

The generated chain-link Y fence's post bases measured approximately slope -0.413 instead of -0.5. Prompted geometry was insufficient. All 16 existing straight fence types now have measured source end-post coordinates and an exact projected plane in library metadata (`item.fence`). End-post bases AND tops follow slopes +/-0.5, with equal physical post heights, constant lengths, vertical posts, and thin collision shadows.

`app/fence-projection.js` projects the original material once into a cached canvas per fence type. Normal rendering remains one image draw per instance. The palette, on-map preview, alpha hit masks and PNG export use the same calibrated geometry. The native painted PNGs remain untouched and are NOT the corrected game-ready geometry. Get corrected PNGs from `/fence-render/<encoded-library-id>.png` (8x logical size); `?r=2` serves palette resolution. Keep the corresponding projected anchors and physical sizes if moving these into gameplay. `calibrate-fences.mjs` recalibrates library metadata after a library rebuild/fence registration; source registration hooks preserve this correction.

Fence drag painting locks to its world axis, fills gaps when the mouse jumps, and joins sections by physical length times scale. Random jitter/size/mirroring is disabled for fence strokes. Select same-axis pieces and use **Align fence run to grid** to repair manually drifted runs. Undo works. Opposite-axis pieces are not silently flattened into one run.

Only old unmarked `expansion:chainlink-y` placements receive a one-time nearby-run repair; unrelated poses are unchanged. The owner removed the nine offending sections during the fix; do not restore those deleted objects. `output/town-builder/backups/layout-before-fence-grid-fix.json` preserves the pre-fix state. Tests use isolated fixtures on ports 5197/5198, never the owner's live layout.

Proof: http://127.0.0.1:5190/sprite-review/fences-grid-verified.png shows a synthetic joined run on actual map ground with the cyan grid guide. It is a regression fixture, not a modification of the owner's placements.

## Live updates

Builder polls library/code versions every two seconds, preserves placement/camera/history during library updates, and delays code reload while dragging or unsaved. No need to restart it for new library assets. Do not launch a duplicate server. It was started as a hidden Node watch process; if absent, use `node --watch scripts/town-builder/server.mjs --port 5190`.
