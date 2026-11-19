import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import {
  exec as defaultExec,
  type Exec,
  main,
  parseArgs,
  runOrThrow,
  UsageError,
} from "@frame/cli";
import { type Dither, loadProfile, type Profile } from "./profile.ts";

export interface PrepareOptions {
  profile: Profile;
  output?: string;
  outDir?: string;
  fit?: boolean;
  rotate?: boolean;
  dither?: Dither;
}

const DITHER_METHODS: readonly string[] = ["FloydSteinberg", "Riemersma", "None"];

export function magickArgs(input: string, output: string, opts: PrepareOptions): string[] {
  const { profile } = opts;
  const geometry = `${profile.width}x${profile.height}`;
  const resize = opts.fit
    ? ["-resize", geometry, "-background", "white", "-gravity", "center", "-extent", geometry]
    : ["-resize", `${geometry}^`, "-gravity", "center", "-extent", geometry];
  return [
    input,
    "-auto-orient",
    "-colorspace",
    "sRGB",
    ...(opts.rotate ? ["-rotate", "90"] : []),
    ...profile.preFilter,
    ...resize,
    "-dither",
    opts.dither ?? profile.dither,
    "-remap",
    profile.palette,
    "-strip",
    "-depth",
    "8",
    output,
  ];
}

function defaultOutput(input: string, dir: string): string {
  const name = basename(input);
  const dot = name.lastIndexOf(".");
  return join(dir, `${dot === -1 ? name : name.slice(0, dot)}.png`);
}

export async function prepareImage(
  input: string,
  opts: PrepareOptions,
  run: Exec = defaultExec,
): Promise<string> {
  const { profile } = opts;
  if (profile.backend !== "magick") {
    throw new UsageError(
      `profile '${profile.id}' uses backend '${profile.backend}'; only 'magick' is supported`,
    );
  }
  if (!existsSync(profile.palette)) throw new Error(`palette not found: ${profile.palette}`);

  let output = opts.output;
  if (!output) {
    const dir = opts.outDir ?? profile.artwork;
    if (!existsSync(dir)) throw new Error(`output folder not found: ${dir}`);
    output = defaultOutput(input, dir);
  }
  await runOrThrow(["magick", ...magickArgs(input, output, opts)], undefined, run);
  return output;
}

const USAGE = `usage: prepare.ts [options] INPUT [OUTPUT]

  INPUT    any format ImageMagick can read (HEIC, JPEG, PNG, ...)
  OUTPUT   defaults to <artwork>/<INPUT basename>.png

options:
  --profile ID     device profile: which panel to prepare for
                   (default: $EPAPER_PROFILE, or the configured default profile)
  --out-dir DIR    where to write the PNG (default: $EPAPER_IMAGES, or the profile's artwork folder)
  --fit            fit inside the panel and pad with white
                   (default is cover + centre-crop, which fills the panel)
  --rotate         rotate 90 degrees first, for portrait photos/mounting
  --dither METHOD  FloydSteinberg (default), Riemersma or None
  -h, --help       show this help

Profiles live in profiles.json; run \`bun profile.ts --list\`.
Requires ImageMagick 7 ("magick") built with HEIC support.`;

export interface PrepareDeps {
  exec?: Exec;
  out?: (line: string) => void;
  env?: Record<string, string | undefined>;
}

export async function prepareMain(argv: string[], deps: PrepareDeps = {}): Promise<number> {
  const env = deps.env ?? process.env;
  const out = deps.out ?? console.log;
  const { values, positionals } = parseArgs(
    {
      usage: USAGE,
      options: {
        profile: { type: "string" },
        "out-dir": { type: "string" },
        fit: { type: "boolean" },
        rotate: { type: "boolean" },
        dither: { type: "string" },
      },
    },
    argv,
  );
  const [input, output] = positionals;
  if (!input) throw new UsageError(USAGE);
  if (positionals.length > 2) throw new UsageError(`unexpected argument '${positionals[2]}'`);
  if (values.dither !== undefined && !DITHER_METHODS.includes(values.dither)) {
    throw new UsageError(`unknown dither '${values.dither}' (known: ${DITHER_METHODS.join(", ")})`);
  }

  const profile = loadProfile(values.profile, { env });
  const dither = (values.dither as Dither | undefined) ?? profile.dither;
  const written = await prepareImage(
    input,
    {
      profile,
      output,
      outDir: values["out-dir"] ?? (env.EPAPER_IMAGES || undefined),
      fit: values.fit,
      rotate: values.rotate,
      dither,
    },
    deps.exec,
  );
  out(
    `wrote ${written} (${profile.width}x${profile.height}, ${profile.colours}-colour dithered, ` +
      `profile=${profile.id}, backend=magick, dither=${dither})`,
  );
  return 0;
}

if (import.meta.main) {
  main(async (argv) => {
    if (!Bun.which("magick")) throw new Error("ImageMagick 7 ('magick') not found");
    return prepareMain(argv);
  });
}
