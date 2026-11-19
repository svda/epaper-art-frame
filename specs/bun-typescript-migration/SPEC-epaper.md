# Spec: epaper (module of bun-typescript-migration)

Depends on: workspace · Consumers: museum, icloud

## Objective
Port the image pipeline: device profiles, preparing an image for a panel, manifest
generation and deploying to HA. It is exposed as a library (`@frame/epaper`) and as
CLIs that keep today's flags.

## Replaces → with
| Today | TS entry | Notes |
|---|---|---|
| device_profile.py | `src/profile.ts` (lib + CLI) | same flags: `[profile] [field]`, `--default --list --artwork --palette --json` |
| prepare_image.sh | `src/prepare.ts` | same flags: `--profile --out-dir --fit --rotate --dither`, `INPUT [OUTPUT]`, `$EPAPER_PROFILE`, `$EPAPER_IMAGES` |
| dither.py | **removed** | No profile uses `backend: epaper-dithering`; every profile is `magick`. `prepare` rejects unknown backends with a clear error. |
| generate_manifest.py | `src/manifest.ts` | same flags, including the HEIC-convert option, and byte-identical manifest JSON |
| push_to_ha.sh | `src/push.ts` | same options and positional `[user@]host:/path`; still rsync/ssh |

`profiles.json` and the palette PNGs stay where they are, unchanged.

## Library API
```ts
loadProfile(id?: string): Profile;  listProfiles(): string[];  defaultProfileId(): string;
prepareImage(input: string, opts: { profile: Profile; output?: string; fit?: boolean;
  rotate?: boolean; dither?: Dither }, exec?: Exec): Promise<string /* output path */>;
generateManifest(dir: string, opts?: {...}): Promise<Manifest>;
push(src: string, dest: string, opts?: {...}, exec?: Exec): Promise<void>;
```
`prepareImage` builds the same `magick` argv as the sh script does today: resize
cover/fit, pre_filter tokens, `-dither`, and `-remap palette`. Tests assert on the argv.

## Testing (port all)
`test_profile.py`, `test_palettes.py`, `test_generate_manifest.py`. `test_dither.py` is
dropped along with dither.py. New tests:
- golden argv for `prepare` per profile × fit/rotate
- an integration test (skipped without `magick`) that checks output dimensions match
  the profile and every pixel is a palette colour

## Success Criteria
- For each profile, the TS `prepare` output has the same size and palette as the sh
  output on 3 sample photos, including one HEIC.
- `manifest` on an existing `www/epaper13` folder produces JSON identical to the
  Python version's.
- `push --dry-run` produces the same rsync command as the sh version.
- The ESPHome devices keep loading the manifest.
- After that, delete the Python files, `*.sh`, `pyproject.toml` and `uv.lock`, and
  update the README.

## Decisions
- 2026-11-19: dither.py and the `epaper-dithering` backend are removed (approved).
