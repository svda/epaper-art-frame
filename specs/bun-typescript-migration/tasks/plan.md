# Implementation Plan: Bun / TypeScript migration

Spec: [`../SPEC.md`](../SPEC.md) (umbrella + capability map) · Tasks: [`todo.md`](./todo.md)

## Overview
Port `tools/` (three uv projects plus the sh scripts) to one Bun workspace, one module at
a time in map order: **workspace → epaper → museum ∥ icloud**. Python and TS run side by
side until each module passes its parity checks. A module's Python is deleted in that
module's final task, never earlier.

## Architecture Decisions
- **Pure core, thin CLI.** Every command exports `main(argv)`. Side effects (exec, fetch,
  fs, sqlite, osascript) are injected so tests use fakes.
- **ImageMagick is the only image engine.** `prepareImage` builds the same `magick` argv
  as `prepare_image.sh`, and golden tests lock that argv. dither.py is dropped (approved).
- **Library calls replace shell-outs.** museum and icloud import `@frame/epaper` instead
  of running `prepare_image.sh` or `push_to_ha.sh`.
- **Photos access is split in two.** `bun:sqlite` reads album membership and metadata
  (read-only), and `osascript` exports cloud-only, shared or edited photos. This matches
  osxphotos `use_photos_export=True`. Both sit behind one `PhotoSource` interface.
- **icloud goes first after the epaper checkpoint.** Its Photos/osascript spike (T-13) is
  the riskiest unknown in the migration. museum is low risk and can run in parallel.

## Phases
1. **Foundation:** T-01–T-02 (workspace)
2. **epaper:** T-03–T-07
3. **icloud:** T-08 spike, then T-09–T-13. **museum:** T-14–T-18. The two can run in parallel.
4. **Wrap-up:** T-19

Checkpoints come after T-02, T-07, T-13, T-18 and T-19 (see todo.md).

## Definition of Done (every task)
- `bun test && bun run typecheck && bun run lint` pass
- The Python tests of modules that haven't been migrated yet still pass (`uv run pytest`
  in each remaining tool)
- One commit per task with the `Spec:`/`Task:`/`Co-Authored-By:` trailers

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Photos.sqlite schema differs between macOS versions | High | T-08 spike on the real library. Detect the variant and fail closed. |
| osascript export is slow, or permission prompts break launchd | High | T-08 measures speed. Document the Automation + FDA grant for `bun`. |
| magick argv drift changes how the images look | Med | Golden argv tests, plus a size/palette check on sample photos (T-04) |
| Manifest JSON differs, so ESPHome breaks | High | Byte-for-byte golden test against the Python output (T-05) |
| rsync/push behaviour drifts | Med | Compare `--dry-run` command output with the sh version (T-06) |

## Open Questions
- Single `frame` bin vs per-command entries (default: one entry per command; revisit in T-19).
