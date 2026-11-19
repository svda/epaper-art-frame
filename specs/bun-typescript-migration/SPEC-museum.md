# Spec: museum (module of bun-typescript-migration)

Depends on: epaper · Consumers: —

## Objective
Port the Rijksmuseum print sync: resolve object ids, fetch the image and metadata,
render a placard, publish into the art/photos modes, and switch the live 13" folder.

## Replaces → with
| Today | TS entry | Notes |
|---|---|---|
| rijks.py | `src/rijks.ts` | Uses `fetch` with an injectable fetcher. Keeps the cache layout, retry/backoff and hashing (`node:crypto`). |
| placard.py | `src/placard.ts` | Same positional args `image title artist date out`. Same `magick` argv. |
| sync_prints.py | `src/sync-prints.ts` | `--config --set --dry-run --refresh --no-deploy`. Reads `prints.toml` through Bun's TOML import or `Bun.TOML.parse`. |
| set_mode.sh | `src/set-mode.ts` | `art\|photos`, `--refresh`, `--migrate`, `--status`, `-n/--dry-run`, `--no-deploy`, `$EPAPER13_DEST`. Calls the `@frame/epaper` manifest and push functions directly. |
| tests/record_fixtures.py | `test/record-fixtures.ts` | A manual script, not run in CI. |

## Testing (port all)
`test_rijks.py`, `test_fetch.py`, `test_placard.py`, `test_sync_prints.py` and
`test_set_mode.py` become `*.test.ts`. The existing JSON fixtures are reused as-is
under `test/fixtures/`. No network access in tests.

## Success Criteria
- All ported tests pass.
- `sync-prints --dry-run` prints the same plan as the Python version for the current
  `prints.toml`.
- `set-mode art` then `set-mode photos` on the real 13" frame switches the content,
  and `--status` reports it.
- Then delete the Python and sh files plus the uv files, and update the README.
