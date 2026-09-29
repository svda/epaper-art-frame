# E-paper image tooling

Scripts for preparing images and deploying them to the frame's Home Assistant
host.

The **artwork folder** holds the images and the generated `manifest.json`. It
defaults to `<repo>/www/epaper` and can be overridden with `--dir` or the
`EPAPER_IMAGES` environment variable. On the HA host it is served at
`http://<ha>:8123/local/epaper/`.

## Add / remove images

1. Prepare each image (see below) so it is 600×448 and dithered to the panel's
   7 colours, then put it in the artwork folder.
2. Regenerate the manifest:
   ```
   python3 generate_manifest.py
   ```
3. Deploy:
   ```
   ./push_to_ha.sh user@host:/path/to/config/www/epaper/
   ```

The device fetches `manifest.json` and shows the next image each wake, cycling
round-robin via a persisted index.

## Preparing a photo (e.g. an iPhone HEIC)

```
./prepare_image.sh ~/Downloads/IMG_1234.HEIC
```

Converts, crops to 600×448 and dithers to the panel's 7 colours, writing the PNG
into the artwork folder. No extra installs: ImageMagick decodes HEIC directly.

Options:

- `--out-dir DIR` — where to write the PNG (default: the artwork folder)
- `--fit` — fit inside 600×448 with a white border instead of centre-cropping
- `--rotate` — rotate 90° first (portrait photos, or mounting the panel rotated)
- `--dither FloydSteinberg|Riemersma|None` — default `FloydSteinberg`

Without prep, ESPHome quantises on-device by RGB thresholds, which bands badly on
photos. `palette-acep7.png` holds the exact colours that map to the panel's 7
colour codes, so the prepared PNG renders exactly as intended.

## Bulk: convert HEICs already in the artwork folder

```
python3 generate_manifest.py --prepare
```

## Files

- `generate_manifest.py` — rewrites `<artwork>/manifest.json` (its only writer)
- `prepare_image.sh` — HEIC/JPEG/... → 600×448 7-colour dithered PNG
- `push_to_ha.sh` — regenerate the manifest, then scp the manifest + images to HA
- `palette-acep7.png` — the 7 colours, as a golden file

## Notes

- `manifest.json` is generated — do not edit it by hand, and it is not tracked in git.
- Artwork images are not tracked in git (see `www/epaper/.gitignore`).
- `python3 generate_manifest.py --check` exits non-zero if the manifest is stale.
- Keep filenames simple (no commas, quotes or `]`) — the device parses the JSON
  array with a simple quoted-string scan.
