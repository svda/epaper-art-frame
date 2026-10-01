# iCloud Favorites sync tooling

Mirrors the 50 most recent **iCloud Favorites** (by capture date) from the Mac's local Photos
library into the frame's artwork folder, prepares them to 600×448 dithered PNGs, and deploys them
to the Home Assistant host. The device is unchanged. See
[`../../specs/icloud-favorites-sync/SPEC.md`](../../specs/icloud-favorites-sync/SPEC.md).

The only human action is tapping the heart in Photos.

## Environment

Managed with [`uv`](https://docs.astral.sh/uv/). Python is pinned in `.python-version` (3.13);
dependencies are in `pyproject.toml` / `uv.lock`.

```
uv sync                 # creates .venv with osxphotos + pytest
.venv/bin/python -m pytest tests
```

`osxphotos` is Python-only; there is no TypeScript library that reads the Photos database.

## Full Disk Access (required)

Reading the Photos database requires **Full Disk Access** for whatever runs the sync. Without it,
osxphotos fails with `Operation not permitted: .../Photos.sqlite`.

System Settings → Privacy & Security → **Full Disk Access** → `+`:

- **Interactive runs:** add your terminal (e.g. **iTerm**), then fully quit and reopen it — TCC is
  only re-read on process start.
- **The launchd job:** add the Python binary the job runs, e.g.
  `~/.local/share/uv/python/cpython-3.13.15-macos-aarch64-none/bin/python3.13`.

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

**Full chain proven:** newest favorite (off-disk HEIC) → download → `prepare_image.sh` →
`600×448, colors=7`.

### Gotcha: `prepare_image.sh` argument order

Options must come **before** the positional input/output — its arg loop breaks at the first
non-option, so `prepare_image.sh INPUT --out-dir DIR` silently treats `--out-dir` as the output
path. Correct:

```
tools/epaper/prepare_image.sh --out-dir DIR INPUT [OUTPUT]
```

## Files

- `pyproject.toml` / `uv.lock` / `.python-version` — environment
- `sync_favorites.py` — selection + prepare + mirror + deploy (added in later tasks)
- `README.md` — this file