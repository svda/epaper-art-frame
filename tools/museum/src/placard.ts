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
const MARGIN = 24;
const STRIP = 120;
const ART_W = WIDTH - 2 * MARGIN;
const ART_H = HEIGHT - STRIP - MARGIN;
const DEFAULT_FONT = "/System/Library/Fonts/Supplemental/Georgia.ttf";
const TITLE_SIZE = 40;
const SUB_SIZE = 30;
const TEXT_MAX = WIDTH - 2 * MARGIN;

export type Prepare = (composed: string, out: string) => Promise<unknown>;
export type WidthOf = (text: string) => Promise<number>;

// A device-safe filename stem: no commas, quotes, brackets or slashes.
export function sanitise(objectNumber: string): string {
  return objectNumber.replace(/[^A-Za-z0-9._-]/g, "_");
}

function withSuffix(path: string, suffix: string): string {
  return path.slice(0, path.length - extname(path).length) + suffix;
}

async function magick(run: Exec, ...args: string[]): Promise<string> {
  return (await runOrThrow(["magick", ...args], undefined, run)).stdout;
}

export function fontWidth(font: string, pointsize: number, run: Exec = defaultExec): WidthOf {
  return async (text) => {
    const out = await magick(
      run,
      "-font",
      font,
      "-pointsize",
      String(pointsize),
      `label:${text}`,
      "-format",
      "%w",
      "info:",
    );
    return Number.parseInt(out, 10);
  };
}

// Shorten `text` with an ellipsis until it fits `maxWidth` pixels. Slices by code point so an
// emoji is never split, as the Python tool did.
export async function truncate(text: string, maxWidth: number, widthOf: WidthOf): Promise<string> {
  if ((await widthOf(text)) <= maxWidth) return text;
  const chars = Array.from(text);
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((await widthOf(`${chars.slice(0, mid).join("")}…`)) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${chars.slice(0, low).join("")}…`;
}

// Fit the source into the art area, centred on white, never cropped.
export async function compose(source: string, out: string, run: Exec = defaultExec) {
  const art = withSuffix(out, ".art.png");
  const area = `${ART_W}x${ART_H}`;
  await magick(
    run,
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
    art,
  );
  await magick(
    run,
    "-size",
    `${WIDTH}x${HEIGHT}`,
    "xc:white",
    art,
    "-geometry",
    `+${MARGIN}+${MARGIN}`,
    "-composite",
    out,
  );
  rmSync(art, { force: true });
  return out;
}

export interface LetterOptions {
  font: string;
  out: string;
  exec?: Exec;
}

// Draw the two placard lines as 1-bit black on white, then composite them under the artwork.
export async function letter(
  image: string,
  title: string,
  artist: string,
  date: string,
  opts: LetterOptions,
) {
  const run = opts.exec ?? defaultExec;
  const fittedTitle = await truncate(title, TEXT_MAX, fontWidth(opts.font, TITLE_SIZE, run));
  const subtitle = await truncate(
    date ? `${artist}, ${date}` : artist,
    TEXT_MAX,
    fontWidth(opts.font, SUB_SIZE, run),
  );
  const text = withSuffix(opts.out, ".text.png");
  await magick(
    run,
    "-size",
    `${WIDTH}x${STRIP}`,
    "xc:white",
    "-font",
    opts.font,
    "-fill",
    "black",
    "-gravity",
    "north",
    "-pointsize",
    String(TITLE_SIZE),
    "-annotate",
    "+0+20",
    fittedTitle,
    "-pointsize",
    String(SUB_SIZE),
    "-annotate",
    "+0+70",
    subtitle,
    "-threshold",
    "50%",
    "-alpha",
    "off",
    text,
  );
  await magick(
    run,
    image,
    text,
    "-gravity",
    "northwest",
    "-geometry",
    `+0+${HEIGHT - STRIP}`,
    "-composite",
    opts.out,
  );
  rmSync(text, { force: true });
  return opts.out;
}

export interface RenderOptions {
  font?: string;
  exec?: Exec;
  prepare?: Prepare;
  env?: Record<string, string | undefined>;
}

// Compose, dither through the art profile, then letter the placard.
export async function render(
  source: string,
  title: string,
  artist: string,
  date: string,
  out: string,
  opts: RenderOptions = {},
) {
  const run = opts.exec ?? defaultExec;
  const env = opts.env ?? process.env;
  const font = opts.font ?? env.PLACARD_FONT ?? DEFAULT_FONT;
  const prepare: Prepare =
    opts.prepare ??
    ((composed, output) =>
      prepareImage(composed, { profile: loadProfile(PROFILE, { env: {} }), output }, run));
  const composed = withSuffix(out, ".composed.png");
  await compose(source, composed, run);
  await prepare(composed, out);
  await letter(out, title, artist, date, { font, out, exec: run });
  rmSync(composed, { force: true });
  return out;
}

const USAGE = `usage: placard.ts IMAGE TITLE ARTIST DATE OUT

Compose a print and a gallery placard into a palette-only 1600x1200 PNG.
The font defaults to Georgia; set $PLACARD_FONT to use another.`;

export interface PlacardDeps extends RenderOptions {
  out?: (line: string) => void;
}

export async function placardMain(argv: string[], deps: PlacardDeps = {}): Promise<number> {
  const { positionals } = parseArgs({ usage: USAGE, options: {} }, argv);
  if (positionals.length !== 5) throw new UsageError(USAGE);
  const [image, title, artist, date, out] = positionals as [string, string, string, string, string];
  await render(image, title, artist, date, out, deps);
  (deps.out ?? console.log)(`wrote ${out}`);
  return 0;
}

if (import.meta.main) main((argv) => placardMain(argv));
