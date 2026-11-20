import { rmSync } from "node:fs";
import { extname } from "node:path";
import {
  exec as defaultExec,
  type Exec,
  main,
  parseArgs,
  runOrThrow,
  UsageError,
} from "@frame/cli";
import { loadProfile, prepareImage } from "@frame/epaper";

const PROFILE = "spectra6-133-art";
const WIDTH = 1600;
const HEIGHT = 1200;

export type Prepare = (composed: string, out: string) => Promise<unknown>;

// A device-safe filename stem: no commas, quotes, brackets or slashes.
export function sanitise(objectNumber: string): string {
  return objectNumber.replace(/[^A-Za-z0-9._-]/g, "_");
}

function withSuffix(path: string, suffix: string): string {
  return path.slice(0, path.length - extname(path).length) + suffix;
}

// Fit the source into the full canvas, centred on white, never cropped.
export async function compose(source: string, out: string, run: Exec = defaultExec) {
  const area = `${WIDTH}x${HEIGHT}`;
  await runOrThrow(
    [
      "magick",
      source,
      "-auto-orient",
      "-colorspace",
      "sRGB",
      "-resize",
      area,
      "-background",
      "white",
      "-gravity",
      "center",
      "-extent",
      area,
      out,
    ],
    undefined,
    run,
  );
  return out;
}

export interface RenderOptions {
  exec?: Exec;
  prepare?: Prepare;
}

// Compose, then dither through the art profile.
export async function render(source: string, out: string, opts: RenderOptions = {}) {
  const run = opts.exec ?? defaultExec;
  const prepare: Prepare =
    opts.prepare ??
    ((composed, output) =>
      prepareImage(composed, { profile: loadProfile(PROFILE, { env: {} }), output }, run));
  const composed = withSuffix(out, ".composed.png");
  await compose(source, composed, run);
  await prepare(composed, out);
  rmSync(composed, { force: true });
  return out;
}

const USAGE = `usage: print.ts IMAGE OUT

Fit a print into a palette-only 1600x1200 PNG.`;

export interface PrintDeps extends RenderOptions {
  out?: (line: string) => void;
}

export async function printMain(argv: string[], deps: PrintDeps = {}): Promise<number> {
  const { positionals } = parseArgs({ usage: USAGE, options: {} }, argv);
  if (positionals.length !== 2) throw new UsageError(USAGE);
  const [image, out] = positionals as [string, string];
  await render(image, out, deps);
  (deps.out ?? console.log)(`wrote ${out}`);
  return 0;
}

if (import.meta.main) main((argv) => printMain(argv));
