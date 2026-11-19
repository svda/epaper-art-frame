# Spec: Bun / TypeScript migration (umbrella + capability map)

## Objective

Replace the Python (uv/pytest) and POSIX-sh tooling under `tools/` with one Bun +
TypeScript workspace. Who it's for: the repo owner, who runs these CLIs on macOS to
prepare artwork, sync iCloud favourites and Rijksmuseum prints, and deploy them to
Home Assistant.

Why:
- **Easier to maintain:** one language, typed end to end.
- **One toolchain:** `bun install` / `bun test` replace three uv projects, pytest and
  the sh scripts.
- **Ready for a web UI:** the profile, manifest and selection logic become importable
  TS modules that a future HA panel or web UI can reuse.

Out of scope: `config/esphome/**`, the firmware on the device, `www/**` artwork
content, and the woodworking specs.

## Capability Map (approved 2026-11-19)

| Module id | Responsibility | Depends on | Spec |
|---|---|---|---|
| workspace | Root Bun workspace, tsconfig, Biome, `bun test`, shared `@frame/cli` helpers (arg parsing, exec, repo paths, env files) | — | [SPEC-workspace.md](SPEC-workspace.md) |
| epaper | Device profiles, `prepare` (replaces prepare_image.sh + dither.py), `manifest`, `push` (replaces push_to_ha.sh) | workspace | [SPEC-epaper.md](SPEC-epaper.md) |
| museum | Rijksmuseum client, placard render, `sync-prints`, `set-mode` | epaper | [SPEC-museum.md](SPEC-museum.md) |
| icloud | Photos library read (replaces osxphotos), album selection/mirror, launchd plist, deploy | epaper | [SPEC-icloud.md](SPEC-icloud.md) |

Build order: **workspace → epaper → museum, icloud** (the last two can run in parallel).

Dependencies point one way only. museum and icloud import epaper as a library
(`@frame/epaper`). They no longer shell out to `prepare_image.sh` or `push_to_ha.sh`.

## Tech Stack (all modules)

- Bun ≥ 1.3 (runtime, package manager, test runner, `bun:sqlite`, native TOML import)
- TypeScript 5.x, `strict: true`, run directly by Bun (no build step)
- Biome for format + lint
- External CLIs, unchanged from today: ImageMagick 7 (`magick`, with HEIC support),
  `rsync`/`ssh` for deploy, `launchctl`
- npm runtime dependencies: **none planned.** Adding any needs approval (see Boundaries).

## Commands (repo root)

```
Install:   bun install
Test:      bun test
Test one:  bun test tools/epaper
Typecheck: bun run typecheck      # tsc --noEmit -p .
Lint:      bun run lint           # biome check .
Format:    bun run format         # biome check --write .
Run CLI:   bun tools/epaper/src/prepare.ts --profile spectra6-133 photo.heic
```

## Project Structure (target)

```
package.json            → workspaces: ["tools/*"], scripts above
tsconfig.json           → strict, shared by all tools
biome.json
tools/cli/              → @frame/cli shared helpers (workspace module)
tools/epaper/src/       → @frame/epaper library + CLI entry points
tools/epaper/test/
tools/museum/src/ test/ → fixtures/ moves under test/fixtures (same JSON)
tools/icloud/src/ test/
```

`profiles.json`, the palette PNGs, `prints.toml`, `.env.example` and the plist
template keep their names and formats.

## Code Style

```ts
// Pure core, thin CLI shell. Inject side effects so tests don't need a real disk/network.
export interface Profile {
  id: string;
  width: number;
  height: number;
  palette: string;     // absolute path once resolved
  artwork: string;     // absolute path once resolved
  preFilter: string[];
  dither: "FloydSteinberg" | "Riemersma" | "None";
}

export function loadProfile(id: string | undefined, file = PROFILES_PATH): Profile {
  const raw = readProfiles(file);
  const key = id ?? process.env.EPAPER_PROFILE ?? raw.default;
  const p = raw.profiles[key];
  if (!p) throw new UsageError(`unknown profile '${key}' (known: ${Object.keys(raw.profiles).join(", ")})`);
  return toProfile(key, p);
}
```

- camelCase in TS, snake_case JSON keys stay the same on disk (map them at the boundary).
- Named exports only; one CLI entry file per command, each `main(argv)` exported for tests.
- Errors: `UsageError` → exit 2, other failures → exit 1. Messages go to stderr.
- Run subprocesses with `Bun.spawn` and argv arrays. Never build a shell string.

## Testing Strategy

- `bun test`. Test files are `*.test.ts` in each tool's `test/`.
- **Parity first:** every existing pytest case gets a TS equivalent before the Python
  file is deleted. Each module spec lists the test files it must port.
- Unit tests inject fakes for exec/fs/fetch/sqlite. A few integration tests run real
  `magick` and are skipped when it isn't installed.
- Golden checks: CLI `--help` flags, manifest JSON and output paths match what the
  Python/sh version produces for the same input.
- Image output only has to be visually equivalent: same size and only palette colours,
  but not byte-identical.

## Boundaries

- **Always:** keep CLI flags, env vars (`EPAPER_PROFILE`, `EPAPER_IMAGES`,
  `EPAPER_DEST`, `EPAPER13_DEST`, `ALBUM`, …), file layouts and manifest formats
  compatible. Run `bun test && bun run typecheck && bun run lint` before every commit.
  Use one commit per task, with the trailer block from AGENTS.md.
- **Ask first:** adding any npm dependency. Changing a CLI flag, an on-disk format or
  the profiles.json schema. Touching `config/esphome/**`.
- **Never:** delete a Python/sh tool before its TS replacement passes the ported tests
  and one manual run against a real frame. Never commit `.env` files, Photos-library
  data or API keys. Never drop a failing test to get to green.
- ImageMagick stays as an external CLI. That covers HEIC decoding and dithering.

## Success Criteria

1. `bun install && bun test && bun run typecheck && bun run lint` pass on a clean checkout.
2. No `pyproject.toml`, `uv.lock`, `*.py` or tool `*.sh` files remain under `tools/`.
   `frame_views.py` in specs/ is out of scope.
3. Every user-facing command from today has a TS equivalent with the same flags. The
   READMEs document them.
4. The launchd agent and `set-mode` work on the real 13" frame, and the iCloud sync
   works on the real 5.65" frame.

## Open Questions

- Command naming: keep the script names (`prepare_image`) or use one `frame` bin with
  subcommands (`frame prepare`)? Default: one `bun` entry per command now, with an
  optional `bin` later.
- icloud: Photos.sqlite schema stability. See SPEC-icloud.md.
