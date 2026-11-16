# Implementation Plan: Print Wall

Spec: [`../SPEC.md`](../SPEC.md) (Revision 6, approved 2026-11-15) · Tasks: [`todo.md`](./todo.md)
Status: **approved** 2026-11-15

## Overview

Add an art mode to the 13.3" Spectra 6 frame. A new tool, `tools/museum/`, resolves a
hand-curated list of Rijksmuseum object numbers. It keeps only objects that are public
domain (PD/CC0) and landscape or square. Each one is rendered
as a 1600×1200 palette-only PNG with a placard strip, and the results are mirrored into
`www/epaper13-modes/art/`. `set_mode.sh` publishes either mode into the live folder
`www/epaper13/` and deploys it. Nothing changes on the device or on the 5.65" frame.

## Findings from planning (codebase vs. spec)

These came up while reading the code. T-01 records them in the spec.

1. **The album sync always deploys.** `sync_album.py` runs `push_to_ha.sh` after every
   non-dry-run and has no `--no-deploy` flag. With `--profile spectra6-133`, the push
   sends the **live** folder `www/epaper13/`, not the photos folder. After the migration,
   new album photos would never reach the frame. **Decision (2026-11-15):** add
   `set_mode.sh --refresh`, which republishes and deploys whichever mode is active. The
   13" photo refresh becomes `EPAPER_IMAGES=www/epaper13-modes/photos sync_album.py
   --profile spectra6-133 --dest "$EPAPER13_DEST"` followed by `set_mode.sh --refresh`.
   The album sync's own push only re-sends the live folder, which is harmless.
   `--dest` is required because `tools/icloud/.env` points `EPAPER_DEST` at the 5.65"
   folder, and the deploy script's folder-name check would reject it (exit 1). The
   album sync's code does not change.
2. **`art-sync` uses `--refresh`.** It calls `set_mode.sh --refresh` when `ACTIVE=art`,
   which does the same thing as `set_mode.sh art` but states the intent.
3. **`test_profile.py::test_both_panels_are_known`** asserts that exactly two profiles
   exist. T-04 updates it to include `spectra6-133-art`.
4. **The pre_filter review samples were out of date.** The spec listed the six
   print-technique samples, then the scope moved to paintings/drawings/photographs, then
   back to no allowlist. T-05 uses 2 prints, 2 paintings, 2 drawings and 2 photographs,
   resolved through the real `museum-source`.
5. **`shellcheck` is not installed.** T-06 installs it (`brew install shellcheck`). It is
   a dev tool only, not a runtime dependency.
6. **The palette contains exact `#000000` and `#FFFFFF`**, so 1-bit placard lettering
   added after dithering stays palette-only.
7. **The Linked Art record shape differs between types** (spike, 2026-11-15). For
   photographs, `produced_by.timespan` is a **list**, and creators sit under
   `produced_by.part[].carried_out_by[]` with `notation[].@value` instead of `_label`.
   The resolver and its fixtures must cover both shapes.
8. **The type allowlist was removed (Revision 7).** The user hand-picks, so the list is the
   filter. The resolver reports the type for the dry-run but does not filter on it.

## Architecture decisions

- **Pure resolver, injected I/O.** `rijks.py` splits pure functions (rights, type,
  orientation and metadata from JSON dicts) from a fetcher (HTTP, throttle, retry,
  cache). Tests use recorded fixtures and never touch the network.
- **No import from `tools/icloud`.** The art sync gets its own copy of the
  `.managed.json` mirror semantics (`plan_deletions`, about 10 lines). Importing
  `sync_album.py` would make the art tool depend on osxphotos.
- **Reuse the existing scripts unchanged.** `prepare_image.sh`, `generate_manifest.py`
  and `push_to_ha.sh` are called as subprocesses. `prepare_image.sh` gets the art profile.
- **Only `set_mode.sh` writes the live folder or deploys the 13" frame.** The art
  profile's artwork folder (`www/epaper13-modes/art`) deliberately fails
  `push_to_ha.sh`'s folder-name check.
- **The shell script is tested with a pytest harness.** It runs `set_mode.sh` inside a temp
  copy of the repo layout (`tools/museum/`, `tools/epaper/`, `www/`) with `push_to_ha.sh`
  replaced by a stub that records its arguments.

## Dependency graph

```
T-01 spec sync ─┬─ T-02 resolver ── T-03 fetch + dry-run ─┐
                ├─ T-04 profile + placard ────────────────┼─ T-05 render review
                └─ T-06 set_mode.sh ── T-07 --migrate     │
                                                          ▼
                      T-08 art sync (T-03, T-04, T-06) ── T-09 docs ── T-10 hardware E2E
```

**Parallel after T-01:** the resolver track (T-02 → T-03), the placard track (T-04) and
the modes track (T-06 → T-07). T-05 needs T-03 and T-04. T-08 needs T-03, T-04 and T-06.

## Task list

### Phase 0: Spec sync
- [x] T-01: Bring the spec in line with the plan

### Phase 1: Source
- [x] T-02: Scaffold `tools/museum` and the pure resolver
- [x] T-03: Live fetcher, cache, and `sync_prints.py --dry-run`

### Checkpoint A: Source
- [ ] `uv run --directory tools/museum pytest` passes
- [ ] A live `--dry-run` shows ok, `type`, rights, and `portrait` lines

### Phase 2: Rendering
- [x] T-04: Art profile row and placard renderer
- [x] T-05: Render review: pre_filter, font, sizes (human choice)

### Checkpoint B: Rendering
- [ ] Both test suites pass; Q1 and Q2 resolved in the spec

### Phase 3: Modes
- [x] T-06: `set_mode.sh` publish, record, deploy, refresh, status
- [x] T-07: `set_mode.sh --migrate`

### Checkpoint C: Modes
- [ ] Mode switching proven on temp trees; `shellcheck` clean

### Phase 4: Art sync and ship
- [x] T-08: Full `sync_prints.py` run
- [x] T-09: READMEs
- [x] T-10: Hardware end-to-end

### Phase 5: Rijksstudio set source
- [x] T-11: Replace the local list with a Rijksstudio set

### Checkpoint D: Complete
- [ ] All 7 spec success criteria met; Q3 resolved on the panel

## Definition of Done (every task)

- Its Verify command passes and the existing suites still pass
  (`uv run --directory tools/epaper pytest`, plus `tools/museum` once it exists).
- No writes to `www/epaper/`, no change to the 5.65" launchd job, and nothing committed
  from `.cache/`, prepared PNGs, `ACTIVE` or generated manifests.
- Commits carry `Spec: specs/print-wall/SPEC.md` and the task's `Task:` line.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| A worker runs `set_mode.sh` or `--migrate` against the real tree | **High.** Moves or replaces the live 13" photos; deploys to HA | T-06 and T-07 are tested on temp trees only, and their acceptance criteria forbid real-tree runs. T-07 and T-10 are `Risk: high`, so `/dispatch` stops for sign-off |
| `push_to_ha.sh` deletes remote PNGs that are not in the manifest | **High.** One mode wipes the other on HA | Only `set_mode.sh` deploys; the art folder fails the folder-name check on purpose; tests stub the push |
| The Linked Art record shape varies by type | Medium. Wrong or missing artist or date | Fixtures cover both shapes (finding 7); a missing field falls back instead of crashing |
| The Rijksmuseum API rate-limits or changes | Medium | Throttle, retry and cache; fixtures pin the shape; failures are reported per entry |
| Placard lettering speckles | Low | 1-bit text after dithering; a test asserts strip pixels are only `#000000` or `#FFFFFF` |
| ImageMagick missing in a test environment | Low | Placard tests skip with a reason when `magick` is absent |

## Open questions

Q1–Q3 (pre_filter, font, sizes) are settled by T-05 and T-10. Q4–Q7 stay deferred, as in
the spec.
