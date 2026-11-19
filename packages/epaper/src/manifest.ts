import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, resolve } from "node:path";
import { type Exec, expandUser, main, parseArgs, UsageError } from "@frame/cli";
import { escapeNonAscii } from "./json.ts";
import { prepareMain } from "./prepare.ts";
import { defaultProfileId, loadProfile, resolveRaw } from "./profile.ts";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg"]);
export const MANIFEST_NAME = "manifest.json";

type Env = Record<string, string | undefined>;

function realResolve(path: string): string {
  const absolute = resolve(expandUser(path));
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

export function manifestDir(arg: string | undefined, profileId: string | undefined, env: Env) {
  if (arg) return realResolve(arg);
  if (env.EPAPER_IMAGES) return realResolve(env.EPAPER_IMAGES);
  return loadProfile(profileId, { env: {} }).artwork;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function findImages(folder: string): string[] {
  return readdirSync(folder)
    .filter(
      (name) =>
        !name.startsWith(".") &&
        name !== MANIFEST_NAME &&
        IMAGE_EXTS.has(extname(name).toLowerCase()) &&
        isFile(join(folder, name)),
    )
    .sort();
}

export function renderManifest(images: string[]): string {
  return `[${images.map((name) => escapeNonAscii(JSON.stringify(name))).join(", ")}]\n`;
}

export interface ManifestResult {
  path: string;
  images: string[];
  upToDate: boolean;
}

export function generateManifest(folder: string, opts: { check?: boolean } = {}): ManifestResult {
  const path = join(folder, MANIFEST_NAME);
  const images = findImages(folder);
  const desired = renderManifest(images);
  const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  const upToDate = current === desired;
  if (!opts.check) writeFileSync(path, desired);
  return { path, images, upToDate };
}

const USAGE = `usage: manifest.ts [options]

Regenerate manifest.json from the images in the artwork folder.

options:
  --dir DIR       artwork folder (overrides --profile)
  --profile ID    device profile: which panel this artwork is for
                  (default: the configured default profile)
  --check         do not write; exit non-zero if manifest.json is out of date
  --prepare       convert any .heic/.HEIC to dithered PNGs first
  -h, --help      show this help

The folder defaults to the profile's artwork folder and can be overridden with
--dir or $EPAPER_IMAGES.`;

export interface ManifestDeps {
  exec?: Exec;
  out?: (line: string) => void;
  err?: (line: string) => void;
  env?: Env;
}

export async function manifestMain(argv: string[], deps: ManifestDeps = {}): Promise<number> {
  const env = deps.env ?? process.env;
  const out = deps.out ?? console.log;
  const err = deps.err ?? console.error;
  const { values, positionals } = parseArgs(
    {
      usage: USAGE,
      options: {
        dir: { type: "string" },
        profile: { type: "string" },
        check: { type: "boolean" },
        prepare: { type: "boolean" },
      },
    },
    argv,
  );
  if (positionals.length > 0) throw new UsageError(`unexpected argument '${positionals[0]}'`);

  resolveRaw(values.profile);
  const profileName = values.profile ?? defaultProfileId();
  const folder = manifestDir(values.dir, profileName, env);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new Error(`artwork folder not found: ${folder}`);
  }

  if (values.prepare) {
    const heics = readdirSync(folder)
      .filter((name) => extname(name).toLowerCase() === ".heic" && isFile(join(folder, name)))
      .sort();
    for (const name of heics) {
      await prepareMain(["--profile", profileName, join(folder, name)], {
        exec: deps.exec,
        out,
        env,
      });
    }
  }

  const { path, images, upToDate } = generateManifest(folder, { check: values.check });
  if (values.check) {
    if (!upToDate) {
      err(`${path} is out of date (run manifest.ts)`);
      return 1;
    }
    out(`${path} is up to date (${images.length} image(s))`);
    return 0;
  }
  out(`wrote ${path}: ${images.length} image(s): ${images.length ? images.join(", ") : "(none)"}`);
  return 0;
}

if (import.meta.main) main((argv) => manifestMain(argv));
