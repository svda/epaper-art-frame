# E-paper image folder

Single source of truth for the frame's image rotation. On the Home Assistant
host this folder is served at `http://<ha>:8123/local/epaper/`.

## Add / remove images

1. Prepare each image (see below) so it is 600×448 and dithered to the panel's
   7 colours, then drop it in here (`*.png`).
2. Regenerate the manifest:
   ```
   python3 generate_manifest.py
   ```
3. Deploy to the HA host (see below).

The device fetches `manifest.json` and shows the next image each wake, cycling
round-robin via a persisted index.

## Preparing a photo (e.g. an iPhone HEIC)

```
./prepare_image.sh IMG_1234.HEIC
```

This converts, crops to 600×448 and dithers to the panel's 7 colours. No extra
installs: it uses ImageMagick, which decodes HEIC directly.

Options:

- `--fit` — fit inside 600×448 with a white border instead of centre-cropping
- `--rotate` — rotate 90° first (portrait photos, or mounting the panel rotated)
- `--dither FloydSteinberg|Riemersma|None` — default `FloydSteinberg`

Without prep, ESPHome quantises on-device by RGB thresholds, which bands badly on
photos. `palette-acep7.png` holds the exact colours that map to the panel's 7
colour codes, so the prepared PNG renders exactly as intended.

## Deploy to Home Assistant

```
./push_to_ha.sh user@host:/path/to/config/www/epaper/
```

Regenerates `manifest.json`, then scp's it plus every image (except the palette)
to the host. The destination can also be set with the `EPAPER_DEST` environment
variable. `-n` / `--dry-run` shows what would be copied without copying.

## Notes

- `manifest.json` is **generated** — do not edit it by hand.
- `python3 generate_manifest.py --prepare` converts any `*.heic` / `*.HEIC` in
  this folder to dithered PNGs before scanning (leaves the HEIC in place).
- `python3 generate_manifest.py --check` exits non-zero if the manifest is out of
  date (handy as a pre-commit / CI check).
- Keep filenames simple (no commas, quotes or `]`) — the device parses the JSON
  array with a simple quoted-string scan.
