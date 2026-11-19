import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { main, parseArgs, repoRoot, UsageError } from "@frame/cli";
import { escapeNonAscii } from "./json.ts";

const EPAPER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROFILES_PATH = resolve(EPAPER_DIR, "profiles.json");

export const FIELDS = [
  "description",
  "width",
  "height",
  "colours",
  "palette",
  "artwork",
  "ha_dir",
  "backend",
  "pre_filter",
  "dither",
] as const;

const DITHERS = ["FloydSteinberg", "Riemersma", "None"] as const;
export type Dither = (typeof DITHERS)[number];

export interface RawProfile {
  description: string;
  width: number;
  height: number;
  colours: number;
  palette: string;
  artwork: string;
  ha_dir: string;
  backend: string;
  pre_filter: string;
  dither: string;
}

interface ProfilesFile {
  default: string;
  profiles: Record<string, RawProfile>;
}

export interface Profile {
  id: string;
  description: string;
  width: number;
  height: number;
  colours: number;
  palette: string;
  artwork: string;
  haDir: string;
  backend: string;
  preFilter: string[];
  dither: Dither;
}

export function readProfiles(file = PROFILES_PATH): ProfilesFile {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function defaultProfileId(file = PROFILES_PATH): string {
  return readProfiles(file).default;
}

export function listProfiles(file = PROFILES_PATH): string[] {
  return Object.keys(readProfiles(file).profiles).sort();
}

export function resolveRaw(
  id: string | undefined,
  file = PROFILES_PATH,
): { id: string; raw: RawProfile } {
  const data = readProfiles(file);
  const key = id || data.default;
  const raw = data.profiles[key];
  if (!raw) {
    throw new UsageError(
      `unknown profile '${key}' (known: ${Object.keys(data.profiles).sort().join(", ")})`,
    );
  }
  return { id: key, raw };
}

function isDither(value: string): value is Dither {
  return (DITHERS as readonly string[]).includes(value);
}

export function loadProfile(
  id?: string,
  opts: { file?: string; env?: Record<string, string | undefined> } = {},
): Profile {
  const env = opts.env ?? process.env;
  const file = opts.file ?? PROFILES_PATH;
  const { id: key, raw } = resolveRaw(id || env.EPAPER_PROFILE, file);
  if (!isDither(raw.dither)) {
    throw new UsageError(
      `profile '${key}' has unknown dither '${raw.dither}' (known: ${DITHERS.join(", ")})`,
    );
  }
  return {
    id: key,
    description: raw.description,
    width: raw.width,
    height: raw.height,
    colours: raw.colours,
    palette: resolve(EPAPER_DIR, raw.palette),
    artwork: resolve(repoRoot(), raw.artwork),
    haDir: raw.ha_dir,
    backend: raw.backend,
    preFilter: raw.pre_filter.split(/\s+/).filter(Boolean),
    dither: raw.dither,
  };
}

const USAGE = `usage: profile.ts [options] [profile] [field]

  profile.ts --default             print the default profile id
  profile.ts --list                print every profile id, one per line
  profile.ts <id>                  print the id (validates it exists)
  profile.ts <id> <field>          print one field
  profile.ts <id> --artwork        print the absolute artwork directory
  profile.ts <id> --palette        print the absolute palette path
  profile.ts <id> --json           print the whole profile as JSON

fields: ${FIELDS.join(", ")}
<id> may be omitted to use $EPAPER_PROFILE or the configured default.`;

export async function profileMain(
  argv: string[],
  out: (line: string) => void = console.log,
): Promise<number> {
  const { values, positionals } = parseArgs(
    {
      usage: USAGE,
      options: {
        default: { type: "boolean" },
        list: { type: "boolean" },
        artwork: { type: "boolean" },
        palette: { type: "boolean" },
        json: { type: "boolean" },
      },
    },
    argv,
  );
  const [name, field] = positionals;
  if (positionals.length > 2) throw new UsageError(`unexpected argument '${positionals[2]}'`);

  if (values.default) {
    out(defaultProfileId());
    return 0;
  }
  if (values.list) {
    for (const id of listProfiles()) out(id);
    return 0;
  }

  const { id, raw } = resolveRaw(name || process.env.EPAPER_PROFILE);
  if (values.json) {
    const sorted = Object.fromEntries(
      Object.entries({ id, ...raw }).sort(([a], [b]) => (a < b ? -1 : 1)),
    );
    out(escapeNonAscii(JSON.stringify(sorted, null, 2)));
  } else if (values.artwork) {
    out(loadProfile(id).artwork);
  } else if (values.palette) {
    out(loadProfile(id).palette);
  } else if (field) {
    if (!(FIELDS as readonly string[]).includes(field)) {
      throw new UsageError(`invalid field '${field}' (choose from ${FIELDS.join(", ")})`);
    }
    out(String(raw[field as (typeof FIELDS)[number]]));
  } else {
    out(id);
  }
  return 0;
}

if (import.meta.main) main(profileMain);
