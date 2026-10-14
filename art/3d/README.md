# Held-gun character pipeline

Each kid has exactly one costume: Tommy/Pumpkin Head, Sam/Space Cadet,
Jess/Vampire, Maya/Cardboard Knight, Leo/Moon Moth. Do not generate or preload
cross-kid costume combinations.

RUN-generated A-pose references and GLB masters live in each character directory.
`node scripts/make-hero-3d.mjs <id> "<description>"` reuses an existing A-pose
reference. `node scripts/render-hero-3d.mjs <id>` renders a walk GLB, or a rigged
GLB with a local six-keyframe walk if no real animation is available.
The pipeline preserves model and rig masters instead of deleting paid assets.

Runtime uses optimized WebP sprites, not Three.js or GLB files. Each sprite has
eight directions, idle plus six walk frames, and a separate forearm/hand layer.
The hand positions in `src/game/art/hero3d.json` anchor the held weapon. Frames
are 112px at 2x, with padding below the feet and beside broad costumes.
All looks share white ambient light, a warm key and a cool rim. Local cloth and
cardboard exports are normalized to matte materials instead of glTF's default metal.

## Takeover checkpoint — 2026-10-10

- Complete models: all five plain kids and all five own costumes.
- Jess/Vampire uses local keyframes; RUN's rig export only had a bind-pose clip.
- Maya/Knight and Leo/Moth were completed with the user-approved local Hunyuan
  service, then locally rigged with each kid's existing skeleton and walk clip.
  `node scripts/rig-local-costume.mjs maya_knight|leo_moth` performs rig transfer,
  cleans tiny disconnected reconstruction islands and normalizes matte materials.
- RUN CLI confirms 163,202 account credits, but 3D/animation jobs return
  `AI_POLICY_BUDGET_EXHAUSTED`; this is not an exhausted account balance.
- Local jobs: Maya `c24562d1792e`, Leo `a5704908f850`. The user started Hunyuan
  after Ollama's Qwen was unloaded. No MCP credentials are stored here.
- Painted sprites remain a fallback while a held-gun sheet loads. Decoded sheets
  use a four-entry LRU cache to avoid retaining all looks across repeated phone runs.

`node scripts/render-hero-batch.mjs` renders all ten looks with two workers and
merges per-look hand metadata only after all jobs finish, preventing write races.

`npm run test:weapon-layout` requires all ten held-gun sprite sets. For an explicit
partial-art diagnostic only, set `TOT_ALLOW_INCOMPLETE_HERO3D=1`; that reports the
missing sets and does not constitute a complete release-art pass.

Never store MCP bearer credentials in this directory or in generation scripts.
