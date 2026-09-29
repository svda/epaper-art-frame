# E-paper image folder

Single source of truth for the frame's image rotation. On the Home Assistant
host this folder is served at `http://<ha>:8123/local/epaper/`.

## Add / remove images

1. Drop images in here (`*.png`, `*.jpg`, `*.jpeg`). ~600×448 (4:3) looks best;
   other sizes are drawn from the top-left and clipped to the panel.
2. Regenerate the manifest:
   ```
   python3 generate_manifest.py
   ```
3. Copy this folder to the HA host's `config/www/epaper/` (rsync / scp).

The device fetches `manifest.json` and shows the next image each wake, cycling
round-robin via a persisted index.

## Notes

- `manifest.json` is **generated** — do not edit it by hand.
- `python3 generate_manifest.py --check` exits non-zero if the manifest is out
  of date (handy as a pre-commit / CI check).
- Keep filenames simple (no commas, quotes or `]`) — the device parses the JSON
  array with a simple quoted-string scan.
- Images are quantised to the panel's 7 colours on-device.
