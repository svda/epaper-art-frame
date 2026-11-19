import { statSync } from "node:fs";
import { basename } from "node:path";
import {
  exec as defaultExec,
  type Exec,
  main,
  parseArgs,
  runOrThrow,
  UsageError,
} from "@frame/cli";
import { generateManifest } from "./manifest.ts";
import { loadProfile, type Profile } from "./profile.ts";

export interface PushOptions {
  profile: Profile;
  dir?: string;
  dest: string;
  dryRun?: boolean;
}

export interface PushDeps {
  exec?: Exec;
  out?: (line: string) => void;
}

function shQuote(text: string): string {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function lastSegment(path: string): string {
  return basename(path.replace(/\/$/, ""));
}

export async function push(opts: PushOptions, deps: PushDeps = {}): Promise<void> {
  const run = deps.exec ?? defaultExec;
  const out = deps.out ?? console.log;
  const { profile } = opts;
  const images = opts.dir ?? profile.artwork;

  if (!opts.dest.includes(":")) throw new UsageError("destination must be [user@]host:/path");
  const dest = `${opts.dest.replace(/\/$/, "")}/`;
  const host = dest.slice(0, dest.indexOf(":"));
  const remoteDir = dest.slice(dest.indexOf(":") + 1);
  if (host.startsWith("-")) throw new UsageError(`invalid destination host '${host}'`);

  // The destination is not profile-aware: without this guard a non-default profile pushed to
  // the default destination would overwrite the other panel's rotation with wrong-sized images.
  if (!opts.dir && lastSegment(images) !== lastSegment(remoteDir)) {
    throw new UsageError(
      `destination '${remoteDir}' does not match profile '${profile.id}' artwork folder '${images}'\n` +
        "       refusing to deploy the wrong panel's artwork; pass --dir to override",
    );
  }
  if (!isDirectory(images)) throw new Error(`artwork folder not found: ${images}`);

  out("regenerating manifest.json");
  const { images: listed } = generateManifest(images);

  const files = listed.map((name) => `${images}/${name}`);
  if (files.length === 0) throw new Error(`no images to push in ${images}`);

  const manifest = `${images}/manifest.json`;
  out(`destination: ${host}:${remoteDir}`);
  out("files:");
  for (const file of [manifest, ...files]) out(`  ${file}`);

  if (opts.dryRun) {
    out("(dry run — nothing copied)");
    return;
  }

  await runOrThrow(["ssh", host, `mkdir -p ${shQuote(remoteDir)}`], undefined, run);
  await runOrThrow(["scp", manifest, ...files, dest], undefined, run);
  out(`pushed ${files.length + 1} file(s) to ${host}:${remoteDir}`);

  // Mirror the remote folder: the device only reads manifest.json, but without pruning,
  // stale pngs accumulate across runs.
  const listing = await run([
    "ssh",
    host,
    `cd ${shQuote(remoteDir)} && for f in *.png; do [ -f "$f" ] && printf '%s\\n' "$f"; done`,
  ]);
  if (listing.code !== 0) {
    out(`warning: could not list remote folder, skipping prune: ${listing.stderr.trim()}`);
    return;
  }
  const keep = new Set(listed);
  const stale = listing.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((name) => name && !keep.has(name));
  for (const name of stale) {
    await runOrThrow(
      ["ssh", "-n", host, `rm -f -- ${shQuote(`${remoteDir}/${name}`)}`],
      undefined,
      run,
    );
    out(`removed stale ${name}`);
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

const USAGE = `usage: push.ts [options] [user@]host:/path/to/config/www/epaper/

Regenerate manifest.json, then copy it and every image to the Home Assistant host.

options:
  --profile ID    device profile: which panel's artwork this is
                  (default: $EPAPER_PROFILE, or the configured default profile)
  --dir DIR       artwork folder (overrides --profile, or $EPAPER_IMAGES)
  -n, --dry-run   show what would be copied, then stop
  -h, --help      show this help

The destination may also be set via the EPAPER_DEST environment variable.`;

export interface PushMainDeps extends PushDeps {
  env?: Record<string, string | undefined>;
}

export async function pushMain(argv: string[], deps: PushMainDeps = {}): Promise<number> {
  const env = deps.env ?? process.env;
  const { values, positionals } = parseArgs(
    {
      usage: USAGE,
      options: {
        profile: { type: "string" },
        dir: { type: "string" },
        "dry-run": { type: "boolean", short: "n" },
      },
    },
    argv,
  );
  if (positionals.length > 1) throw new UsageError(`unexpected argument '${positionals[1]}'`);

  const profile = loadProfile(values.profile, { env });
  const dest = positionals[0] || env.EPAPER_DEST;
  if (!dest) throw new UsageError(USAGE);

  await push(
    {
      profile,
      dir: values.dir ?? (env.EPAPER_IMAGES || undefined),
      dest,
      dryRun: values["dry-run"],
    },
    { exec: deps.exec, out: deps.out },
  );
  return 0;
}

if (import.meta.main) {
  main(async (argv) => {
    if (!Bun.which("scp")) throw new Error("scp not found");
    return pushMain(argv);
  });
}
