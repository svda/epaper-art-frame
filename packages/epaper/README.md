# E-paper image tooling

Bun/TypeScript tools for preparing images and deploying them to the frames' Home
Assistant host. Run them from the repo root after `bun install`.

Everything panel-specific comes from a **profile** (`profiles.json`): the pixel
dimensions, the colour palette, and the artwork folder. Adding a device is a row
in that file — not an `if` in a script.

| Profile | Panel | Output | Palette | Artwork | HA path |
|---|---|---|---|---|---|
| `acep565` **(default)** | Waveshare 5.65" 7-colour ACeP | 600×448 | `palette-acep7.png` (7) | `www/epaper/` | `/local/epaper/` |
| `spectra6-133` | Seeed EE02 + 13.3" Spectra 6, landscape | 1600×1200 | `palette-spectra6.png` (6) | `www/epaper13/` | `/local/epaper13/` |
| `spectra6-133-art` | Same panel, art mode (no pre-filter) | 1600×1200 | `palette-spectra6.png` (6) | `www/epaper13-modes/art/` | `/local/epaper13/` |

```
bun packages/epaper/src/profile.ts --list                  # every profile
bun packages/epaper/src/profile.ts spectra6-133 --json     # one profile's fields as JSON
```

`prepare` and `push` take `--profile ID` and fall back to `$EPAPER_PROFILE`, then to
the configured default; `manifest` takes `--profile ID` and falls back to the
default (it ignores `$EPAPER_PROFILE`). **The default is the deployed 5.65" frame**,
so existing invocations and the launchd iCloud sync keep working unchanged.

## Add / remove images

1. Prepare each image (see below) so it matches the panel, then put it in the
   profile's artwork folder.
2. Regenerate the manifest:
   ```
   bun packages/epaper/src/manifest.ts                        # default profile
   bun packages/epaper/src/manifest.ts --profile spectra6-133
   ```
3. Deploy:
   ```
   bun packages/epaper/src/push.ts user@host:/path/to/config/www/epaper/
   bun packages/epaper/src/push.ts --profile spectra6-133 user@host:/path/to/config/www/epaper13/
   ```

The device fetches `manifest.json` and shows the next image each wake, cycling
round-robin via a persisted index.

## Preparing a photo (e.g. an iPhone HEIC)

```
bun packages/epaper/src/prepare.ts ~/Downloads/IMG_1234.HEIC                          # 5.65" frame
bun packages/epaper/src/prepare.ts --profile spectra6-133 ~/Downloads/IMG_1234.HEIC   # 13.3" frame
```

Converts, crops to the profile's dimensions and dithers to its palette, writing
the PNG into that profile's artwork folder. Requires ImageMagick 7 (`magick`)
built with HEIC support; no other installs.

Options:

- `--profile ID` — which panel to prepare for (default: the default profile)
- `--out-dir DIR` — where to write the PNG (default: `$EPAPER_IMAGES`, or the profile's artwork folder)
- `--fit` — fit inside the panel with a white border instead of centre-cropping
- `--rotate` — rotate 90° first (portrait photos, or mounting the panel rotated)
- `--dither FloydSteinberg|Riemersma|None` — default `FloydSteinberg`

Without prep, ESPHome quantises on-device by RGB thresholds, which bands badly on
photos. Each `palette-*.png` holds the exact colours that map to the panel's
colour codes, so the prepared PNG renders exactly as intended.

## Bulk: convert HEICs already in an artwork folder

```
bun packages/epaper/src/manifest.ts --prepare --profile spectra6-133
```

## Tests

```
bun test packages/epaper
```

## Library use

Other tools import the same code instead of shelling out:

```ts
import { loadProfile, prepareImage, generateManifest, push } from "@frame/epaper";
```

## Files

- `profiles.json` — the profile table (single source of truth for panels)
- `src/profile.ts` — reads it; importable and a CLI
- `src/prepare.ts` — HEIC/JPEG/... → dithered PNG at the profile's size/palette
- `src/manifest.ts` — rewrites `<artwork>/manifest.json` (its only writer)
- `src/push.ts` — regenerate the manifest, then scp the manifest + images to HA and
  prune stale remote PNGs
- `palette-acep7.png`, `palette-spectra6.png` — the panels' colours, as golden files
- `test/` — bun test suite (golden fixtures in `test/fixtures/`)

## Notes

- `manifest.json` is generated — do not edit it by hand, and it is not tracked in git.
- Artwork images are not tracked in git (see each folder's `.gitignore`).
- `bun packages/epaper/src/manifest.ts --check` exits non-zero if the manifest is stale.
- `manifest.ts --profile` is validated even when `--dir` overrides the folder, so a
  typo'd profile fails loudly rather than preparing for the wrong panel.
- `push.ts` refuses a destination whose last folder name does not match the profile's
  artwork folder; pass `--dir` to override deliberately.
- Keep filenames simple (no commas, quotes or `]`) — the device parses the JSON
  array with a simple quoted-string scan.
