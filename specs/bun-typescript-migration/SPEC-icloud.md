# Spec: icloud (module of bun-typescript-migration)

Depends on: epaper · Consumers: —

## Objective
Port `sync_album.py`: mirror the N most recent photos from a Photos album into a
profile's artwork folder, prepare them, write the manifest, deploy, and install the
launchd agent. osxphotos is replaced with native access.

## Replacing osxphotos (the risky part)
- **Read:** open `<library>/database/Photos.sqlite` **read-only** with `bun:sqlite`
  (`?mode=ro&immutable=1`, on a temp copy if the file is locked). Query the album
  membership plus each asset's uuid, date, original filename and directory, and
  whether it's local or in the cloud only.
- **Export:** copy the original out of `<library>/originals/<dir>/<file>`. Assets that
  are cloud-only or missing locally are **skipped and reported**, not downloaded.
  This matches the current behaviour if osxphotos was also only exporting local
  originals; verify that first.
- All of this sits behind a `PhotoSource` interface, so the selection and mirror logic
  is tested with fakes and the SQL lives in one file (`src/photos-db.ts`).
- If the schema differs between macOS versions, detect the variant from the table and
  column names. Any unsupported variant fails with a clear error and does no partial
  writes.

## Replaces → with
| Today | TS |
|---|---|
| sync_album.py CLI | `src/sync-album.ts`: same flags `--profile --artwork-dir --dest --library --album --interval-h --config -n/--dry-run` plus the install/uninstall agent options. Reads `.env` via `@frame/cli`. |
| prepare via sh / deploy via sh | `@frame/epaper` `prepareImage` / `push` |
| plist template | unchanged file, rendered by `src/agent.ts`. ProgramArguments now point at `bun` + `sync-album.ts`. |

## Testing (port all)
`test_agent.py`, `test_config.py`, `test_deploy.py`, `test_export.py`, `test_mirror.py`,
`test_selection.py` and `test_sync.py`. A new `photos-db.test.ts` runs against a small
synthetic SQLite fixture built in the test, so no real library is committed.

## Success Criteria
- All ported tests pass.
- `sync-album --dry-run` against the real system library selects the same N photos as
  the Python version.
- The installed launchd agent runs one scheduled sync end to end on the 5.65" frame.
- Then delete the Python and uv files, and update the README.

## Open Questions
- Does the current setup depend on osxphotos downloading iCloud-only originals? If it
  does, we need a fallback (AppleScript/`osascript` export through Photos.app), and
  that changes the scope.
- Full Disk Access: launchd will need FDA granted to `bun` rather than to Python.
