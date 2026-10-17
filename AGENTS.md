# Working in this repo (agents: read this first)

Trick or Treat: Last Kid Standing, a Vite + React + TypeScript game published to RUN (run.world).
How to run, test, build, publish and use the town builder is in `README.md`. This file is about **keeping the
repo tidy**. It got cluttered once (stale reports at the root, 100+ scripts in one folder, generated images
ignored file by file, a PowerShell cache committed); these rules stop that from happening again.

## Where things go

| Folder | What belongs there |
| --- | --- |
| `src/` | Game source. |
| `public/` | Everything the game loads at runtime. **All of it ships in `dist/`, so all of it is committed.** |
| `art/` | Committed source art: the cut pieces and masters the game or the town builder uses, grouped by topic (`art/arcade/`, `art/town-variations/`, ...). |
| `scripts/tests/` | Game tests (`*.test.mjs`), run from the repo root. Wire each one into `package.json` as `test:*`. |
| `scripts/art/` | Art pipeline tools (prepare, pack, export, render, regen). |
| `scripts/audio/` | Sound generation and measurement. |
| `scripts/build/` | Steps of `npm run build`. |
| `scripts/town-builder/` | The town builder: app, server, library/preset tools, ground bake and game exporter, with its tests. |
| `scripts/town/`, `scripts/town-variations/` | Town builder launchers, the road and ground-material tools (`roads/`, `materials/`), and the RUN variation generator + slicer. |
| `scripts/lib/` | Shared helpers for the scripts above. |
| `docs/` | Design and reference docs that stay true (asset spec, buildcraft, expansion design). |
| `release-notes/` | Player-facing notes; `release-notes/changelogs/` holds the changelog sent with each RUN deploy. |
| `rundot/` | RUN configuration only (`leaderboard.config.json`, `shop.config.json`). |
| `output/` | **Git-ignored.** Everything generated or temporary: raw image generations, test screenshots, reviews, exports, backups, the town builder's data. |

The repo root holds only `README.md`, `AGENTS.md`, `CLAUDE.md` and tool config. No new files at the root.

## Generated images (RUN, Codex, anything else)

1. Raw generations (sheets, attempts, references, prompts, review galleries) live in `output/` and are never committed.
2. Images the game or the town builder actually uses are **sliced** (cut, trimmed to their alpha) and committed:
   runtime files under `public/`, source cuts under `art/<topic>/`. For town variation sheets:
   `node scripts/town-variations/slice.mjs` (see its README).
3. After slicing, the source sheet moves to a git-ignored archive folder (for example `<campaign>/sliced/`).
4. **Delete every image from RUN's library after it is downloaded**: `rundot assets rm <generation-id> --service imagegen`.
   The creator library is capped at 1 GB; once full, every generation fails with `IMAGE_GEN_CREATOR_QUOTA_EXCEEDED`.
   The `generationId` is in the `--json` output of `rundot generate`. `scripts/town-variations/runner.mjs` does this
   automatically; any new generation script must do the same.

## .gitignore

- Ignore **folders**, never single files. If the game loads a file, it is committed; if it is a draft, it belongs in `output/`.
- New scratch locations get a folder rule with a one-line comment saying what lands there.

## Tests and scripts

- A new script goes in the matching `scripts/` subfolder, never flat in `scripts/`. Debug and one-off scripts go in
  `output/` or `.claude/` (both ignored), not in the repo.
- When a feature is removed or rewritten, update or delete its tests in the same change. Don't leave failing or
  unwired tests behind.
- Browser tests expect the dev server on `http://127.0.0.1:5173/` (`npm run dev:local -- --host 127.0.0.1`) and Microsoft Edge.

## Reports and plans

Don't commit point-in-time reports (bug audits, verification logs, work-completion checklists). Put them in the PR
description. Long-lived design docs go in `docs/`.

## Worktrees and other sessions

- Other sessions' git worktrees sit inside this checkout (`.codex-session/`, `.arcade-worktree/`, `.built-worktree/`).
  They are ignored. Never delete one without checking `git -C <worktree> status` for uncommitted work.
- The town builder is committed in `scripts/town-builder/`. Its paths come from `scripts/lib/town-paths.mjs`: `ROOT`
  is the repo root and the town's working art is `TOWN_ART` (default `output/town-art/`, never committed).
- `.codex-session/town-worktree` still holds the static-town ground pipeline tools and the original town art. Don't
  delete it until those have moved.
- Before `git add -A`, check `git status --short` for unexpected folders or a lowercase ` m <dir>` (a worktree).

## The owner's data

Never overwrite or regenerate `output/town-builder/layout.json`, `output/town-builder/plans/` or the
`output/town-builder/maps/` the owner paints in. Back up `output/town-builder/library/library.json` before
changing it.
