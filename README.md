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
                       ├─ apps/icloud/src/sync-album.ts
                       │     select 50 newest favorites
                       │     → prepare.ts (600×448, 7-colour dither)
                       │     → mirror into www/epaper/ + regenerate manifest.json
                       │     → push.ts (scp)
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
| `config/esphome/` | Device firmware (ESPHome YAML). `common/` holds the shared packages — `base.yaml` (api/ota/wifi/logger) and `art-frame.yaml` (the fetch→render→sleep pipeline); `devices/` holds one file per flashable config, the deployed frames plus the bring-up aids. `devices/secrets.yaml` is git-ignored. |
| `packages/epaper/` | Image pipeline (Bun/TypeScript): `prepare.ts` (HEIC/JPEG → 600×448 7-colour dithered PNG), `manifest.ts` (manifest writer), `push.ts` (deploy to HA). See [`packages/epaper/README.md`](packages/epaper/README.md). |
| `apps/icloud/` | Automatic sync of a Photos album (the shared album "epaper art frame") from the Mac's Photos library. See [`apps/icloud/README.md`](apps/icloud/README.md). |
| `apps/museum/` | Rijksmuseum print wall for the 13" frame: Rijksstudio set → placarded PNGs, plus `set-mode` to switch between art and photos. See [`apps/museum/README.md`](apps/museum/README.md). |
| `packages/cli/` | `@frame/cli`: shared helpers (argument parsing, subprocesses, env files, exit codes) used by the tools above. |
| `www/epaper/` | Artwork folder: prepared images + generated `manifest.json`. Images and the manifest are git-ignored. |
| `specs/` | Specs and task lists: [`epaper-art-frame`](specs/epaper-art-frame/SPEC.md) (device), [`icloud-album-sync`](specs/icloud-album-sync/SPEC.md) (source), [`wooden-frame`](specs/wooden-frame/SPEC.md) (enclosure), [`ee02-13in-spectra6`](specs/ee02-13in-spectra6/SPEC.md) (second frame + multi-device support). |

## Devices

Every flashable config lives in `config/esphome/devices/`. Each is a **device file** — the
`substitutions`, `esp32`/`psram`/`spi`/`display`, and any device-specific sensors — that pulls in
the shared packages from `config/esphome/common/`:

```yaml
packages:
  base: !include ../common/base.yaml
  art_frame: !include ../common/art-frame.yaml
```

| Device | Board | Panel | Config | Artwork | HA path |
|---|---|---|---|---|---|
| `epaper-art-frame` | Soldered NULA DeepSleep ESP32-S3 | Waveshare 5.65" 7-colour ACeP, 600×448 | `devices/epaper-art-frame.yaml` | `www/epaper/` | `/local/epaper/` |

`devices/` also holds the bring-up aids, which are standalone (they deliberately do *not* pull in
`common/`): `epaper-bench.yaml`, `epaper-diag.yaml`, `nula-bringup.yaml`, `ee02-bringup.yaml`.

A second frame — a Seeed EE02 with a 13.3" six-colour Spectra 6 panel — is specified in
[`specs/ee02-13in-spectra6/SPEC.md`](specs/ee02-13in-spectra6/SPEC.md) and will add a row here
when built.

## Firmware

The 5.65" frame uses stock ESPHome — no custom component. The panel is the Waveshare 5.65"
7-colour ACeP, driven by `waveshare_epaper` with `model: 5.65in-f` (requires ESPHome
≥ 2026.9.0).

Commands run **from the repo root**. `ESPHOME_DATA_DIR` is pinned as an **absolute** path so every
device shares one build cache — a relative value is re-relativised against the config dir, doubles
the path, and fails the build.

```
# Validate / build / flash the deployed frame
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome config  config/esphome/devices/epaper-art-frame.yaml
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome compile config/esphome/devices/epaper-art-frame.yaml
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome upload  config/esphome/devices/epaper-art-frame.yaml

# Logs over the network API
.venv/bin/esphome logs --device epaper-art-frame.local
```

Notes:

- `esphome upload` does **not** recompile after a config edit — run `compile` first.
- All `!secret` references in the pipeline live in `config/esphome/common/`. `secrets.yaml` lives
  in `config/esphome/devices/` (git-ignored), beside the configs that use it — ESPHome resolves
  `!secret` relative to the *including* file and falls back to the **main config's** directory,
  not to `config/esphome/`.
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

## Tooling (Bun / TypeScript)

This repo is a Bun monorepo: `apps/` holds the runnable tools (`icloud`, `museum`) and `packages/` the
shared libraries (`cli`, `epaper`); apps may import packages, never the reverse. Prerequisites: [Bun](https://bun.sh) ≥ 1.3,
ImageMagick 7 (`magick`, with HEIC support), `ssh`/`scp`, and `rsync` (for `set-mode`); the iCloud
sync also needs macOS (Photos, `osascript`, `sips`).

```
bun install            # once
bun test               # whole workspace
bun run typecheck      # tsc --noEmit, root and every package
bun run lint           # biome check
bun run format         # biome check --write
```

| Command | What it does |
|---|---|
| `bun packages/epaper/src/profile.ts --list` | Device profiles (panel size, palette, artwork folder) |
| `bun packages/epaper/src/prepare.ts IMG.HEIC` | Photo → panel-ready dithered PNG |
| `bun packages/epaper/src/manifest.ts` | Regenerate `manifest.json` (`--check`, `--prepare`) |
| `bun packages/epaper/src/push.ts user@host:/path/` | Deploy manifest + images to Home Assistant |
| `bun apps/icloud/src/sync-album.ts` | Mirror the Photos album, then deploy (`--dry-run`, `--print-plist`) |
| `bun apps/museum/src/sync-prints.ts` | Rijksstudio set → art-mode PNGs (`--dry-run`) |
| `bun apps/museum/src/set-mode.ts art\|photos` | Switch the 13" frame's mode (`--status`, `--refresh`, `--migrate`) |
| `bun apps/museum/src/placard.ts IMG TITLE ARTIST DATE OUT` | Render one placarded print |

Each command takes `-h`/`--help`. Per-tool details are in the READMEs under `apps/` and `packages/`. Every package also has its own
`bun test` and `bun run typecheck`; from the root, `bun run --filter @frame/icloud test` runs one.

## Image pipeline

The artwork folder defaults to `<repo>/www/epaper` and is served by HA at
`http://<ha>:8123/local/epaper/`.

```
# Prepare one photo (HEIC/JPEG/...) to a 600×448 7-colour dithered PNG
bun packages/epaper/src/prepare.ts ~/Downloads/IMG_1234.HEIC

# Regenerate the manifest (its only writer)
bun packages/epaper/src/manifest.ts

# Deploy manifest + images to the HA host
bun packages/epaper/src/push.ts user@host:/path/to/config/www/epaper/
```

On-device quantisation is not used: images are pre-dithered to the panel's exact 7-colour
palette (`packages/epaper/palette-acep7.png`) because raw RGB bands badly on photos. The
device cycles the manifest round-robin via an index persisted across deep-sleep reboots.

## iCloud album sync

Mirrors a Photos album (newest first by capture date) from the Mac's Photos
library into the artwork folder, prepares the photos, and deploys — on a `launchd` schedule,
with no manual steps. Requires Full Disk Access and Automation permission for Photos. See
[`apps/icloud/README.md`](apps/icloud/README.md) for setup, configuration, and
troubleshooting.

```
bun install
bun apps/icloud/src/sync-album.ts --dry-run   # preview, no writes
bun apps/icloud/src/sync-album.ts             # sync + deploy
bun test apps/icloud
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
