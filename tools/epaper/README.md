# E-paper image tooling

Scripts for preparing images and deploying them to the frames' Home Assistant
host.

Everything panel-specific comes from a **profile** (`profiles.json`): the pixel
dimensions, the colour palette, and the artwork folder. Adding a device is a row
in that file — not an `if` in a script.

| Profile | Panel | Output | Palette | Artwork | HA path |
|---|---|---|---|---|---|
| `acep565` **(default)** | Waveshare 5.65" 7-colour ACeP | 600×448 | `palette-acep7.png` (7) | `www/epaper/` | `/local/epaper/` |
| `spectra6-133` | Seeed EE02 + 13.3" Spectra 6, landscape | 1600×1200 | `palette-spectra6.png` (6) | `www/epaper13/` | `/local/epaper13/` |

```
python3 device_profile.py --list          # every profile
python3 device_profile.py spectra6-133    # one profile's fields as JSON
```

Every script takes `--profile ID` and falls back to `$EPAPER_PROFILE`, then to
the configured default. **The default is the deployed 5.65" frame**, so existing
invocations and the launchd iCloud sync keep working unchanged.

## Add / remove images

1. Prepare each image (see below) so it matches the panel, then put it in the
   profile's artwork folder.
2. Regenerate the manifest:
   ```
   python3 generate_manifest.py                        # default profile
   python3 generate_manifest.py --profile spectra6-133
   ```
3. Deploy:
   ```
   ./push_to_ha.sh user@host:/path/to/config/www/epaper/
   ./push_to_ha.sh --profile spectra6-133 user@host:/path/to/config/www/epaper13/
   ```

The device fetches `manifest.json` and shows the next image each wake, cycling
round-robin via a persisted index.

## Preparing a photo (e.g. an iPhone HEIC)

```
./prepare_image.sh ~/Downloads/IMG_1234.HEIC                          # 5.65" frame
./prepare_image.sh --profile spectra6-133 ~/Downloads/IMG_1234.HEIC   # 13.3" frame
```

Converts, crops to the profile's dimensions and dithers to its palette, writing
the PNG into that profile's artwork folder. No extra installs: ImageMagick
decodes HEIC directly.

Options:

- `--profile ID` — which panel to prepare for (default: the default profile)
- `--out-dir DIR` — where to write the PNG (default: the profile's artwork folder)
- `--fit` — fit inside the panel with a white border instead of centre-cropping
- `--rotate` — rotate 90° first (portrait photos, or mounting the panel rotated)
- `--dither FloydSteinberg|Riemersma|None` — default `FloydSteinberg`

Without prep, ESPHome quantises on-device by RGB thresholds, which bands badly on
photos. Each `palette-*.png` holds the exact colours that map to the panel's
colour codes, so the prepared PNG renders exactly as intended.

## Bulk: convert HEICs already in an artwork folder

```
python3 generate_manifest.py --prepare --profile spectra6-133
```

## Tests

```
uv run --directory tools/epaper pytest
```

## Files

- `profiles.json` — the profile table (single source of truth for panels)
- `device_profile.py` — reads it; importable and a CLI. Not named `profile.py`,
  which would shadow the stdlib `profile` module.
- `generate_manifest.py` — rewrites `<artwork>/manifest.json` (its only writer)
- `prepare_image.sh` — HEIC/JPEG/... → dithered PNG at the profile's size/palette
- `push_to_ha.sh` — regenerate the manifest, then scp the manifest + images to HA
- `palette-acep7.png`, `palette-spectra6.png` — the panels' colours, as golden files
- `tests/` — pytest suite

## Notes

- `manifest.json` is generated — do not edit it by hand, and it is not tracked in git.
- Artwork images are not tracked in git (see each folder's `.gitignore`).
- `python3 generate_manifest.py --check` exits non-zero if the manifest is stale.
- `generate_manifest.py --profile` is validated even when `--dir` overrides the
  folder, so a typo'd profile fails loudly rather than preparing for the wrong panel.
- Keep filenames simple (no commas, quotes or `]`) — the device parses the JSON
  array with a simple quoted-string scan.
