import { homedir } from "node:os";
import { join } from "node:path";
import { expandUser, main, parseArgs, readEnvFile, repoRoot, UsageError } from "@frame/cli";
import { defaultProfileId, loadProfile, manifestMain, pushMain } from "@frame/epaper";
import { prepareOne as prepareOnePhoto } from "./export.ts";
import {
  applyArtwork,
  type PrepareOne,
  type RegenerateManifest,
  type SyncResult,
} from "./mirror.ts";
import type { Photo, PhotoSource } from "./photo-source.ts";
import { openPhotosDb } from "./photos-db.ts";
import { selectAlbum } from "./selection.ts";

export type { SyncResult } from "./mirror.ts";

const ICLOUD_DIR = join(import.meta.dir, "..");
const DEFAULT_ARTWORK = join(repoRoot(), "www", "epaper");
const DEFAULT_ENV_FILE = join(ICLOUD_DIR, ".env");
const DEFAULT_LIBRARY = join(homedir(), "Pictures", "Photos Library.photoslibrary");
const DEFAULT_INTERVAL_H = 6;

type Env = Record<string, string | undefined>;
type RunCli = (argv: string[]) => Promise<unknown>;

export interface Config {
  artworkDir: string;
  dest?: string;
  library?: string;
  album?: string;
  intervalH: number;
  dryRun: boolean;
  profile?: string;
}

export interface CliArgs {
  profile?: string;
  artworkDir?: string;
  dest?: string;
  library?: string;
  album?: string;
  intervalH?: number;
  dryRun?: boolean;
}

function pick(
  cli: string | number | undefined,
  env: Env,
  envFile: Env,
  key: string,
): string | number | undefined {
  if (cli !== undefined) return cli;
  return env[key] ?? envFile[key];
}

function asInt(value: string | number, key: string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\s*[+-]?\d+\s*$/.test(value)) return Number(value);
  throw new UsageError(`invalid ${key}: '${value}' (expected an integer)`);
}

// Precedence: command line > environment > .env file > default.
export function resolveConfig(
  args: CliArgs,
  env: Env,
  envFile: Env,
  defaultArtwork: string = DEFAULT_ARTWORK,
): Config {
  const intervalH = asInt(
    pick(args.intervalH, env, envFile, "SYNC_INTERVAL_H") ?? DEFAULT_INTERVAL_H,
    "SYNC_INTERVAL_H",
  );
  // `--profile` selects the panel, and its artwork folder is the default folder. Validate it even
  // when an artwork dir is given, so a typo fails loudly instead of preparing for the wrong panel.
  const profile = pick(args.profile, env, envFile, "EPAPER_PROFILE") as string | undefined;
  const resolvedProfile = loadProfile(profile, { env: {} });
  const artwork = pick(args.artworkDir, env, envFile, "EPAPER_IMAGES") as string | undefined;
  const library = pick(args.library, env, envFile, "PHOTOS_LIBRARY") as string | undefined;
  return {
    artworkDir: artwork ? expandUser(artwork) : profile ? resolvedProfile.artwork : defaultArtwork,
    dest: pick(args.dest, env, envFile, "EPAPER_DEST") as string | undefined,
    library: library ? expandUser(library) : undefined,
    album: pick(args.album, env, envFile, "ALBUM") as string | undefined,
    intervalH,
    dryRun: Boolean(args.dryRun),
    profile,
  };
}

// Names of required tools that are missing.
export function preflight(which: (name: string) => string | null = Bun.which): string[] {
  const missing: string[] = [];
  if (!which("magick")) missing.push("magick (ImageMagick 7)");
  if (!which("scp")) missing.push("scp");
  if (!which("osascript")) missing.push("osascript");
  return missing;
}

// Select the album's photos and mirror them into the artwork folder.
export async function sync(
  cfg: Config,
  source: PhotoSource,
  prepareOne: PrepareOne<Photo>,
  regenerateManifest: RegenerateManifest,
): Promise<SyncResult> {
  if (!cfg.album) throw new Error("no album configured (set ALBUM or --album)");
  return applyArtwork(
    selectAlbum(source, cfg.album),
    cfg.artworkDir,
    prepareOne,
    regenerateManifest,
    cfg.dryRun,
  );
}

export function summarize(result: SyncResult): string {
  const parts = [
    `prepared=${result.prepared}`,
    `kept=${result.kept.length}`,
    `deleted=${result.deleted.length}`,
  ];
  if (result.dryRun) parts.push("dry-run");
  if (result.failures.length > 0) parts.push(`failures=${result.failures.length}`);
  return `sync: ${parts.join(" ")}`;
}

export const exitCode = (result: SyncResult): number => (result.failures.length > 0 ? 1 : 0);

export function manifestWriter(
  profile?: string,
  manifest: RunCli = (argv) => manifestMain(argv, { out: () => {} }),
): RegenerateManifest {
  return (artworkDir) =>
    manifest(["--profile", profile || defaultProfileId(), "--dir", artworkDir]);
}

// Push to the HA host when something changed; skip otherwise.
export async function deploy(
  dest: string | undefined,
  changed: boolean,
  deps: { profile?: string; push?: RunCli } = {},
): Promise<void> {
  if (!changed) return;
  if (!dest) throw new Error("no deploy destination configured (set EPAPER_DEST or --dest)");
  const push = deps.push ?? ((argv) => pushMain(argv, { out: () => {} }));
  await push(["--profile", deps.profile || defaultProfileId(), dest]);
}

const USAGE = `usage: sync-album.ts [options]

Mirror a Photos album into the e-paper artwork folder: select the album's photos (newest first),
prepare each for the panel, regenerate the manifest and deploy to Home Assistant.

options:
  --profile ID       device profile: which panel to prepare for
                     (default: $EPAPER_PROFILE, or the configured default profile)
  --artwork-dir DIR  artwork folder (overrides --profile)
  --dest DEST        deploy destination [user@]host:/path (default: $EPAPER_DEST)
  --library PATH     Photos library path (default: ~/Pictures/Photos Library.photoslibrary)
  --album NAME       Photos album name to mirror (default: $ALBUM)
  --interval-h N     launchd interval hours (default: ${DEFAULT_INTERVAL_H})
  --config FILE      env file (default: ${DEFAULT_ENV_FILE})
  -n, --dry-run      show what would happen; write nothing
  -h, --help         show this help`;

export interface SyncAlbumDeps {
  env?: Env;
  envFilePath?: string;
  out?: (line: string) => void;
  err?: (line: string) => void;
  preflight?: () => string[];
  openSource?: (library: string | undefined) => PhotoSource & { close?: () => void };
  prepareOne?: PrepareOne<Photo>;
  manifest?: RunCli;
  push?: RunCli;
}

export async function syncAlbumMain(argv: string[], deps: SyncAlbumDeps = {}): Promise<number> {
  const out = deps.out ?? console.log;
  const err = deps.err ?? console.error;
  const { values, positionals } = parseArgs(
    {
      usage: USAGE,
      options: {
        profile: { type: "string" },
        "artwork-dir": { type: "string" },
        dest: { type: "string" },
        library: { type: "string" },
        album: { type: "string" },
        "interval-h": { type: "string" },
        config: { type: "string" },
        "dry-run": { type: "boolean", short: "n" },
      },
    },
    argv,
  );
  if (positionals.length > 0) throw new UsageError(`unexpected argument '${positionals[0]}'`);

  const intervalH = values["interval-h"];
  if (intervalH !== undefined && !/^\s*[+-]?\d+\s*$/.test(intervalH)) {
    throw new UsageError(`--interval-h expects an integer, got '${intervalH}'`);
  }
  const envFile = readEnvFile(
    values.config ? expandUser(values.config) : (deps.envFilePath ?? DEFAULT_ENV_FILE),
  );
  const cfg = resolveConfig(
    {
      profile: values.profile,
      artworkDir: values["artwork-dir"],
      dest: values.dest,
      library: values.library,
      album: values.album,
      intervalH: intervalH === undefined ? undefined : Number(intervalH),
      dryRun: values["dry-run"],
    },
    deps.env ?? process.env,
    envFile,
  );

  const missing = (deps.preflight ?? preflight)();
  if (missing.length > 0) throw new Error(`missing required tools: ${missing.join(", ")}`);

  const source = (deps.openSource ?? ((library) => openPhotosDb(library ?? DEFAULT_LIBRARY)))(
    cfg.library,
  );
  let result: SyncResult;
  try {
    result = await sync(
      cfg,
      source,
      deps.prepareOne ??
        ((photo, dest) => prepareOnePhoto(photo, dest, { profile: cfg.profile || undefined })),
      manifestWriter(cfg.profile, deps.manifest),
    );
  } finally {
    source.close?.();
  }
  out(summarize(result));
  for (const [uuid, error] of result.failures) err(`  failed ${uuid}: ${error}`);

  if (!cfg.dryRun) {
    const changed = result.deleted.length > 0 || result.copied > 0;
    try {
      await deploy(cfg.dest, changed, { profile: cfg.profile, push: deps.push });
    } catch (error) {
      err(`error: deploy failed: ${(error as Error).message}`);
      return 1;
    }
    out(`deploy: ${changed ? `pushed to ${cfg.dest}` : "no changes"}`);
  }
  return exitCode(result);
}

if (import.meta.main) main((argv) => syncAlbumMain(argv));
