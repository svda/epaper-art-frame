# Spec: icloud (module of bun-typescript-migration)

Depends on: epaper · Consumers: —

## Objective
Port `sync_album.py`: mirror the N most recent photos from a Photos album into a
profile's artwork folder, prepare them, write the manifest, deploy, and install the
launchd agent. osxphotos is replaced with native access.

## Replacing osxphotos (the risky part)
Proven by the T-08 spike on the real library (macOS 27.0.1, Photos schema model 270010300);
see "Spike findings" below.

- **Read:** copy `<library>/database/Photos.sqlite` and its `-wal` (never the `-shm`: a copied
  wal-index is stale and hides recent changes, including the album itself) into a temp dir,
  open the copy with `bun:sqlite` and `pragma query_only=1`. The library is never opened in
  place. Dates are Core Data seconds (add 978307200).
- **Album lookup:** the configured album can be either kind, so look it up in this order:
  1. **Shared Album (macOS 26+):** `ZSHARE` row with `ZTITLE = ?` and `ZTRASHEDSTATE = 0`;
     its assets are `ZASSET.ZCOLLECTIONSHARE = ZSHARE.Z_PK`. This is the configured
     `epaper art frame` album.
  2. **User album:** `ZGENERICALBUM` with `ZKIND = 2` and `ZTITLE = ?`, joined through the
     album/asset table whose name and columns come from `Z_PRIMARYKEY` (`Z_34ASSETS` with
     `Z_34ALBUMS`/`Z_3ASSETS` here; the numbers change between macOS versions). Not proven on
     real data; it is covered by a synthetic fixture only.
- **Selection (identical to `select_album`):** assets with `ZKIND = 0` (photos) and
  `ZTRASHEDSTATE = 0`; dated newest first, ties by uuid ascending, undated last.
- **Export (parity with osxphotos `use_photos_export=True`):** none of the 64 shared-album
  originals are on disk (`photo.path` is `None` for all), so every photo goes through Photos.app:
  `osascript -e 'tell application "Photos" to export {media item id "<uuid>/L0/001"} to
  (POSIX file "<dir>") [with using originals]'`. Add `with using originals` for un-adjusted
  photos and omit it for edited ones (`ZADJUSTMENTTIMESTAMP` not null) so the rendered image is
  exported. A photo that still fails is reported and skipped, as today. Copy straight from
  `originals/` only when the file exists there (not seen with shared albums).
- All of this sits behind a `PhotoSource` interface, so the selection and mirror logic
  is tested with fakes and the SQL lives in one file (`src/photos-db.ts`).
- If the schema differs between macOS versions, detect the variant from the table and
  column names. Any unsupported variant fails with a clear error and does no partial
  writes.

## Spike findings (T-08, 2026-11-19)
- **Selection matches:** for `epaper art frame` the TS query returns the same 64 assets in the
  same order as `select_album` (osxphotos); 8 are adjusted in both.
- **The album is a Shared Album**, stored in `ZSHARE` on this macOS, not in `ZGENERICALBUM`.
  The first spike attempt looked in the wrong table and found nothing.
- **Do not copy `-shm`.** With the stale `-shm` the album was missing from the copy.
- **Export works and is fast:** three photos (an un-adjusted newest one, an edited one, the
  oldest) exported in about 1 s each, none of them on disk beforehand, and all decode as JPEG.
  Shared-album originals come back as reduced JPEG derivatives (2048x1536 for a HEIC source),
  which is plenty for the 600x448 and 1600x1200 panels.
- **Permissions:** the terminal needs Full Disk Access (read worked) and Automation permission to
  control Photos (granted on first use). The launchd agent's host process needs both; see
  Open Questions.

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
- Resolved 2026-11-19: osxphotos does download iCloud/shared photos and render edits,
  so the osascript export path is required (the spike in T-08 de-risks it).
- Automation permission: launchd's `bun` needs permission to control Photos.app.
- Full Disk Access: launchd will need FDA granted to `bun` rather than to Python.
