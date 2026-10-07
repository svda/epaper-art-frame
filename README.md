# E-Paper Art Frame

A battery-powered wall display that shows curated art on a 7-colour e-paper panel. The
device wakes once a day, fetches the next image from a folder served by Home Assistant,
renders it, and goes back to deep sleep. Favoriting a photo on an iPhone is the only
human action — the Mac syncs and deploys it automatically.

| | |
|---|---|
| Display | Waveshare 5.65" 7-colour ACeP, 600×448 (4-wire SPI) |
| Microcontroller | Soldered NULA DeepSleep ESP32-S3 (8 MB flash + 8 MB PSRAM) |
| Firmware | ESPHome ≥ 2026.9.0, stock `waveshare_epaper` `model: 5.65in-f` |
| Power | Single-cell LiPo (3000 mAh) + onboard TP4056M charger, ~7 µA deep sleep |
| Wake cycle | ~24 h sleep, ~1 min awake (drift tolerated) |
| Image source | Home Assistant `www/epaper/`, served at `/local/epaper/` |

## How it works

```
 iPhone                    Mac                                    ESP32-S3
 ──────                    ───                                    ────────
 tap ♥  →  iCloud  →  Photos library
                       │
                       ├─ tools/icloud/sync_favorites.py
                       │     select 50 newest favorites
                       │     → prepare_image.sh (600×448, 7-colour dither)
                       │     → mirror into www/epaper/ + regenerate manifest.json
                       │     → push_to_ha.sh (scp)
                       ▼
                 HA host: config/www/epaper/  ──HTTP──▶  daily wake:
                                                          fetch manifest.json
                                                          render next image (round-robin)
                                                          publish sensors → sleep 24 h
```

The device is a deep-sleep device: it is unreachable ~99.9% of the time. Home Assistant's
role is deliberately thin — it serves the images and observes the daily wake (battery
voltage, last image, WiFi). It never directs the device.

## Repository layout

| Path | Contents |
|---|---|
| `config/esphome/` | Device firmware (ESPHome YAML). `epaper-art-frame.yaml` is the main config; `epaper-bench.yaml`, `epaper-diag.yaml` and `nula-bringup.yaml` are bring-up aids. `secrets.yaml` is git-ignored. |
| `tools/epaper/` | Image pipeline: `prepare_image.sh` (HEIC/JPEG → 600×448 7-colour dithered PNG), `generate_manifest.py` (manifest writer), `push_to_ha.sh` (deploy to HA). See [`tools/epaper/README.md`](tools/epaper/README.md). |
| `tools/icloud/` | Automatic sync of the 50 most recent iCloud Favorites from the Mac's Photos library. See [`tools/icloud/README.md`](tools/icloud/README.md). |
| `www/epaper/` | Artwork folder: prepared images + generated `manifest.json`. Images and the manifest are git-ignored. |
| `specs/` | Specs and task lists: [`epaper-art-frame`](specs/epaper-art-frame/SPEC.md) (device), [`icloud-favorites-sync`](specs/icloud-favorites-sync/SPEC.md) (source), [`wooden-frame`](specs/wooden-frame/SPEC.md) (enclosure). |

## Firmware

The device uses stock ESPHome — no custom component. The panel is the Waveshare 5.65"
7-colour ACeP, driven by `waveshare_epaper` with `model: 5.65in-f` (requires ESPHome
≥ 2026.9.0).

```
.venv/bin/esphome config  config/esphome/epaper-art-frame.yaml   # validate
.venv/bin/esphome compile config/esphome/epaper-art-frame.yaml   # build
.venv/bin/esphome upload  config/esphome/epaper-art-frame.yaml   # flash (USB first, then OTA)
.venv/bin/esphome logs    --device epaper-art-frame.local        # logs over the network API
```

Notes:

- `esphome upload` does **not** recompile after a config edit — run `compile` first.
- The NULA logger console is `USB_SERIAL_JTAG`, not the CH340, so serial logs are silent;
  use the network API for logs.
- Use the HA host's DNS name (`server`), not `.local` mDNS — mDNS does not resolve from
  the ESP.
- Bench configs use a short `sleep_duration` so rotation is observable; set it to `24h`
  for deployment.

Pin map (single source of truth in the YAML header):

| Signal | GPIO |
|---|---|
| SPI CLK | 12 |
| SPI MOSI | 11 |
| EPD CS | 10 |
| EPD DC | 5 |
| EPD RST | 6 |
| EPD BUSY | 7 (`inverted: true` — panel BUSY is active-LOW) |
| BAT ADC | 4 (external divider required; disabled by default) |

## Image pipeline

The artwork folder defaults to `<repo>/www/epaper` and is served by HA at
`http://<ha>:8123/local/epaper/`.

```
# Prepare one photo (HEIC/JPEG/...) to a 600×448 7-colour dithered PNG
tools/epaper/prepare_image.sh ~/Downloads/IMG_1234.HEIC

# Regenerate the manifest (its only writer)
python3 tools/epaper/generate_manifest.py

# Deploy manifest + images to the HA host
tools/epaper/push_to_ha.sh user@host:/path/to/config/www/epaper/
```

On-device quantisation is not used: images are pre-dithered to the panel's exact 7-colour
palette (`tools/epaper/palette-acep7.png`) because raw RGB bands badly on photos. The
device cycles the manifest round-robin via an index persisted across deep-sleep reboots.

## iCloud Favorites sync

Mirrors the 50 most recent iCloud Favorites (by capture date) from the Mac's Photos
library into the artwork folder, prepares them, and deploys — on a `launchd` schedule,
with no manual steps. Requires Full Disk Access. See
[`tools/icloud/README.md`](tools/icloud/README.md) for setup, configuration, and
troubleshooting.

```
uv sync
.venv/bin/python tools/icloud/sync_favorites.py --dry-run   # preview, no writes
.venv/bin/python tools/icloud/sync_favorites.py             # sync + deploy
.venv/bin/python -m pytest tools/icloud/tests
```

## Enclosure

The frame is a handmade hardwood enclosure (measured, not catalogue-sized) specified
separately in [`specs/wooden-frame/SPEC.md`](specs/wooden-frame/SPEC.md). It carries the
panel, NULA, and battery, hides all electronics, and keeps the battery replaceable and
USB-C reachable while wall-mounted.

## Documentation

Each capability has a spec under `specs/<slug>/` with `SPEC.md`, `tasks/plan.md`, and
`tasks/todo.md`. Start with [`specs/epaper-art-frame/SPEC.md`](specs/epaper-art-frame/SPEC.md)
for the device design, decisions, power budget, and risks.
