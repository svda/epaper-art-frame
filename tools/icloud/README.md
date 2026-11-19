# iCloud album sync tooling

Mirrors a **Photos album** (configured via `ALBUM`; currently the shared album "epaper art
frame") from the Mac's local Photos library into the frame's artwork folder, prepares each photo
to a 600×448 dithered PNG, and deploys them to the Home Assistant host. The device is unchanged.
See [`../../specs/icloud-album-sync/SPEC.md`](../../specs/icloud-album-sync/SPEC.md).

The only human action is adding/removing photos in the album.

## Environment

Bun/TypeScript, in the repo's workspace. From the repo root:

```
bun install
bun test tools/icloud
```

The Photos database is read directly with `bun:sqlite` (from a throwaway copy, never in place),
and photos that are not on disk (every Shared Album photo) are exported through Photos.app with
`osascript`. Requires ImageMagick 7 (`magick`), `scp` and macOS `sips` (for camera RAW).

## Run

```
bun tools/icloud/src/sync-album.ts            # sync + deploy
bun tools/icloud/src/sync-album.ts --dry-run  # show what would happen; write nothing
```

Config comes from `tools/icloud/.env` (see `.env.example`), overridden by real environment
variables, overridden by CLI flags. Keys: `EPAPER_DEST`, `PHOTOS_LIBRARY`, `ALBUM`,
`SYNC_INTERVAL_H`, `EPAPER_IMAGES`, `EPAPER_PROFILE`.

`EPAPER_PROFILE` selects which panel to prepare for, and with it the artwork folder: the default
(`acep565`) is the deployed 5.65" frame and `www/epaper/`, while `spectra6-133` is the 13.3"
Spectra 6 frame and `www/epaper13/`. It is passed through to `prepare.ts` and
`manifest.ts`, so the prepared images match that panel's dimensions and palette. See
[`../epaper/profiles.json`](../epaper/profiles.json).

## 13" frame: art and photo modes

The 13.3" frame can show either the album photos or the Rijksmuseum art set. Each mode
lives in its own folder under `www/epaper13-modes/`, and `bun tools/museum/src/set-mode.ts`
publishes one into the live `www/epaper13/` folder and deploys it.

After the one-time migration (`bun tools/museum/src/set-mode.ts --migrate`), refresh the 13"
photos with the existing override and the 13" destination, then republish:

```
EPAPER_IMAGES=www/epaper13-modes/photos \
  bun tools/icloud/src/sync-album.ts --profile spectra6-133 \
  --dest "$EPAPER13_DEST"
bun tools/museum/src/set-mode.ts --refresh
```

`--dest` is required: `tools/icloud/.env` points `EPAPER_DEST` at the 5.65" folder, and
`push.ts` refuses a destination whose folder name does not match the profile's
artwork folder. Running the sync without `EPAPER_IMAGES` writes the live folder directly
and bypasses the modes; `set-mode.ts --status` shows the drift.

## Schedule (launchd)

Every `SYNC_INTERVAL_H` hours, and at login:

```
bun tools/icloud/src/sync-album.ts --print-plist \
  > ~/Library/LaunchAgents/com.sander.epaper-album.plist
launchctl load -w ~/Library/LaunchAgents/com.sander.epaper-album.plist
launchctl list | grep epaper-album
```

The plist runs `bun` by its stable PATH location (`/opt/homebrew/bin/bun`), not the versioned
Homebrew install path, so a `brew upgrade` does not break it. The job logs to
`tools/icloud/sync.log` and `sync.err.log`. Reload after a config change:

```
launchctl unload ~/Library/LaunchAgents/com.sander.epaper-album.plist
launchctl load -w ~/Library/LaunchAgents/com.sander.epaper-album.plist
```

## Permissions (required)

Two macOS privacy permissions are needed, for whatever runs the sync:

1. **Full Disk Access** — to read the Photos database. Without it the sync fails with
   `Operation not permitted: .../Photos.sqlite`.
2. **Automation → Photos** — to export photos through Photos.app. macOS asks the first time; if you
   decline, the export fails with `Not authorized to send Apple events to Photos`.
   Re-enable it under System Settings → Privacy & Security → **Automation**.

System Settings → Privacy & Security → **Full Disk Access** → `+`:

- **Interactive runs:** add your terminal (e.g. **iTerm**), then fully quit and reopen it — TCC is
  only re-read on process start.
- **The launchd job:** launchd runs `bun` directly, so *that binary* — not your terminal — needs
  Full Disk Access. Add the resolved executable (`readlink -f $(which bun)`), and answer the
  Automation prompt for it the first time the job exports a photo. Run the job once by hand to
  trigger the prompt: `launchctl kickstart -k gui/$(id -u)/com.sander.epaper-album`.

Photos.app export is given 5 minutes per photo, so a permission prompt nobody answers cannot hang
a scheduled run forever.

## Spike findings (T-01, 2026-10-01)

Verified against the real library on this machine:

| Fact | Value |
|---|---|
| osxphotos | 0.77.2 |
| macOS | 26.6.2 (Tahoe) |
| Library | `~/Pictures/Photos Library.photoslibrary` |
| Total photos | 27,483 |
| Favorites (non-movie) | 292 |
| **Originals on disk (top 50)** | **8 / 50** — "Optimize Mac Storage" is ON (Q5) |

**Off-disk originals are retrievable.** `PhotoInfo.export(dest, use_photos_export=True)` downloads
the original via Photos.app (proven: a 1.18 MB HEIC). Note the per-photo `export()` has **no**
`download_missing` argument — that is an `ExportOptions` (CLI) field; the per-photo equivalent is
`use_photos_export=True`.

**Full chain proven:** newest favorite (off-disk HEIC) → download → `prepare.ts` →
`600×448, colors=7`.

### Note: `prepare.ts` argument order

The old shell script broke at the first non-option, so options had to precede the positional
input/output. `prepare.ts` accepts them in any order, but this tool still passes options first:

```
bun tools/epaper/src/prepare.ts --out-dir DIR INPUT [OUTPUT]
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Operation not permitted: .../Photos.sqlite` | Full Disk Access missing — see Permissions |
| `Not authorized to send Apple events to Photos` / `osascript timed out` | Automation permission for Photos missing or unanswered — see Permissions |
| `original not available (still in iCloud?)` | Photo not downloadable; check iCloud sign-in. The run logs it and continues |
| `prepare.ts failed` | ImageMagick missing or the file isn't an image — the message includes magick's stderr |
| `no deploy destination configured` | Set `EPAPER_DEST` in `.env` |
| `deploy failed: ...` | HA host unreachable or the path is wrong; the local folder is left intact |
| A photo doesn't appear | Photos hasn't synced it yet — it appears on a later run |
| Stale files linger on the HA host | `push.ts` prunes stale PNGs on the host after each push; if the listing over ssh fails it skips pruning, and the device is manifest-driven so leftovers are inert |
| Edited photos | The sync uses the **original** (`photo.path`), not the edited render |

## Non-goals

`icloudpd` / disabling Advanced Data Protection; iCloud Shared Albums; any host beyond the
existing Home Assistant box; live "show now" device control; device firmware changes; porting
`manifest.ts` to another language.

## Files

- `package.json` — the `@frame/icloud` workspace package
- `src/photos-db.ts` — reads Photos.sqlite from a throwaway copy (Shared and user albums)
- `src/selection.ts` — album selection (movies out, newest first, uuid ties, undated last)
- `src/export.ts` — on-disk original or Photos.app export via `osascript`; RAW via `sips`; prepare
- `src/mirror.ts` — staging, first-run adoption, managed state, never-wipe-on-total-failure
- `src/sync-album.ts` — config, preflight, sync, deploy, CLI (`--print-plist` for launchd)
- `src/agent.ts` — launchd plist rendering
- `com.sander.epaper-album.plist.template` — launchd template (rendered by `--print-plist`)
- `test/` — bun test suite (synthetic Photos library, fakes for Photos.app and the host)
- `README.md` — this file