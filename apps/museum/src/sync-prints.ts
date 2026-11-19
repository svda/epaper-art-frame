import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { main, parseArgs, repoRoot, UsageError } from "@frame/cli";
import { manifestMain, renderManifest } from "@frame/epaper";
import { Fetcher } from "./fetcher.ts";
import { render as renderPlacard, sanitise } from "./placard.ts";
import { type Fetch, type FetchText, type Print, resolve, type Skip, setMembers } from "./rijks.ts";
import { setModeMain } from "./set-mode.ts";

const MUSEUM_DIR = join(import.meta.dir, "..");
const PROFILE = "spectra6-133-art";
const MANAGED_NAME = ".managed.json";
const DEFAULT_CONFIG = join(MUSEUM_DIR, "prints.toml");
const DEFAULT_CACHE = join(MUSEUM_DIR, ".cache");
const MODES_DIR = join(repoRoot(), "www", "epaper13-modes");
const ART_DIR = join(MODES_DIR, "art");

type Out = (line: string) => void;
type Result = Print | Skip;
export type Render = (item: Print, dest: string) => Promise<unknown>;
export type RegenerateManifest = (artDir: string) => Promise<unknown>;

export interface SyncResult {
  rendered: number;
  deleted: string[];
  failures: [string, string][];
}

export class DeployError extends Error {
  constructor(
    readonly cmd: string[],
    readonly code: number,
  ) {
    super(`${cmd.join(" ")} exited ${code}`);
  }
}

const pad3 = (n: number) => String(n).padStart(3, "0");

export function loadConfig(path: string): { setId: string; culture: string } {
  const data = Bun.TOML.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const setId = typeof data.set_id === "string" ? data.set_id : "";
  if (!setId) throw new UsageError(`no set_id in ${path}`);
  return { setId, culture: typeof data.culture === "string" ? data.culture : "nl" };
}

export async function run(
  configPath: string,
  fetchJson: Fetch,
  fetchText: FetchText,
  opts: { out?: Out; setId?: string } = {},
): Promise<{ index: number; result: Result }[]> {
  const out = opts.out ?? console.log;
  const config = loadConfig(configPath);
  const numbers = await setMembers(opts.setId || config.setId, config.culture, fetchText);
  const results: { index: number; result: Result }[] = [];
  for (const [i, number] of numbers.entries()) {
    const index = i + 1;
    const result = await resolve(number, fetchJson);
    results.push({ index, result });
    out(
      "reason" in result
        ? `${pad3(index)}  ${number}  skip: ${result.reason}`
        : `${pad3(index)}  ${number}  ${result.type}  ${result.rights}  ${result.width}x${result.height}  ok`,
    );
  }
  return results;
}

function readManaged(artDir: string): Set<string> {
  const state = join(artDir, MANAGED_NAME);
  return existsSync(state) ? new Set(JSON.parse(readFileSync(state, "utf8"))) : new Set();
}

function writeManaged(artDir: string, names: Set<string>) {
  mkdirSync(artDir, { recursive: true });
  writeFileSync(join(artDir, MANAGED_NAME), renderManifest([...names].sort()));
}

// Files to delete: everything we own that is no longer selected.
export function planDeletions(
  existing: Set<string>,
  managed: Set<string>,
  current: Set<string>,
  firstRun: boolean,
): Set<string> {
  const owned = firstRun ? existing : new Set([...managed].filter((n) => existing.has(n)));
  return new Set([...owned].filter((n) => !current.has(n)));
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Render into a staging dir, then mirror the art folder and write the manifest.
export async function applyArtwork(
  prints: { index: number; item: Print }[],
  artDir: string,
  render: Render,
  regenerateManifest: RegenerateManifest,
): Promise<SyncResult> {
  const managed = readManaged(artDir);
  const firstRun = !existsSync(join(artDir, MANAGED_NAME));
  const existing = new Set(
    existsSync(artDir)
      ? readdirSync(artDir).filter((n) => extname(n) === ".png" && isFile(join(artDir, n)))
      : [],
  );
  mkdirSync(artDir, { recursive: true });
  const stage = mkdtempSync(join(tmpdir(), "print_wall_stage_"));
  const failures: [string, string][] = [];
  const rendered: string[] = [];
  try {
    for (const { index, item } of prints) {
      const name = `${pad3(index)}-${sanitise(item.objectNumber)}.png`;
      try {
        await render(item, join(stage, name));
        rendered.push(name);
      } catch (error) {
        failures.push([item.objectNumber, (error as Error).message]);
      }
    }

    // Every render failed: mirroring would wipe the rotation over a transient failure, so only
    // regenerate the manifest to match the folder as it is.
    if (prints.length > 0 && rendered.length === 0) {
      await regenerateManifest(artDir);
      return { rendered: 0, deleted: [], failures };
    }

    const deletions = planDeletions(existing, managed, new Set(rendered), firstRun);
    for (const name of rendered) {
      const staged = join(stage, name);
      const dest = join(artDir, name);
      if (!(isFile(dest) && readFileSync(dest).equals(readFileSync(staged)))) {
        copyFileSync(staged, dest);
      }
    }
    for (const name of deletions) rmSync(join(artDir, name), { force: true });
    writeManaged(artDir, new Set(rendered));
    await regenerateManifest(artDir);
    return { rendered: rendered.length, deleted: [...deletions].sort(), failures };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

export function activeMode(modesDir: string): string | undefined {
  const path = join(modesDir, "ACTIVE");
  return isFile(path) ? readFileSync(path, "utf8").trim() || undefined : undefined;
}

const regenerateManifest: RegenerateManifest = (artDir) =>
  manifestMain(["--profile", PROFILE, "--dir", artDir], { out: () => {} });

export async function refreshActive(
  setMode: (argv: string[]) => Promise<unknown> = setModeMain,
  err: (line: string) => void = console.error,
): Promise<void> {
  try {
    await setMode(["--refresh"]);
  } catch (error) {
    err(`error: ${(error as Error).message}`);
    throw new DeployError(["set-mode.ts", "--refresh"], 1);
  }
}

export interface SyncArgs {
  configPath: string;
  fetchJson: Fetch;
  fetchText: FetchText;
  artDir: string;
  render: Render;
  regenerateManifest: RegenerateManifest;
  active: string | undefined;
  deploy: boolean;
  setId?: string;
  deployFn?: () => Promise<unknown>;
  out?: Out;
}

export async function sync(args: SyncArgs): Promise<number> {
  const out = args.out ?? console.log;
  const results = await run(args.configPath, args.fetchJson, args.fetchText, {
    out,
    setId: args.setId,
  });
  const prints = results.flatMap(({ index, result }) =>
    "reason" in result ? [] : [{ index, item: result }],
  );
  const skipped = results.length - prints.length;
  if (prints.length === 0) {
    out("sync: no renderable objects; nothing changed");
    return 0;
  }
  const result = await applyArtwork(prints, args.artDir, args.render, args.regenerateManifest);
  out(
    `sync: resolved=${prints.length} skipped=${skipped} ` +
      `rendered=${result.rendered} deleted=${result.deleted.length}`,
  );
  for (const [number, error] of result.failures) out(`  failed ${number}: ${error}`);

  if (args.active === "art" && args.deploy) {
    try {
      await (args.deployFn ?? refreshActive)();
    } catch (error) {
      if (!(error instanceof DeployError)) throw error;
      out(
        `deploy failed: ${error.cmd.join(" ")} exited ${error.code} (art is staged in ${args.artDir})`,
      );
      out("fix the error above, then run bun apps/museum/src/set-mode.ts --refresh");
      return 1;
    }
    out("deploy: refreshed art mode");
  } else {
    out(
      `art staged (${prints.length} objects); active mode is ${args.active ?? "none"} ` +
        "— run set-mode.ts art to show them",
    );
  }
  return result.failures.length > 0 ? 1 : 0;
}

const USAGE = `usage: sync-prints.ts [options]

Resolve a Rijksstudio set, render it, mirror the art folder, and deploy if active.

options:
  --config PATH   config file (default: apps/museum/prints.toml)
  --set ID        override the configured set id
  --dry-run       resolve and report only; render nothing
  --refresh       bypass the local cache
  --no-deploy     stage the art without refreshing the live folder
  -h, --help      show this help`;

export interface SyncPrintsDeps {
  fetchJson?: Fetch;
  fetchText?: FetchText;
  render?: Render;
  artDir?: string;
  modesDir?: string;
  deployFn?: () => Promise<unknown>;
  out?: Out;
}

export async function syncPrintsMain(argv: string[], deps: SyncPrintsDeps = {}): Promise<number> {
  const { values, positionals } = parseArgs(
    {
      usage: USAGE,
      options: {
        config: { type: "string" },
        set: { type: "string" },
        "dry-run": { type: "boolean" },
        refresh: { type: "boolean" },
        "no-deploy": { type: "boolean" },
      },
    },
    argv,
  );
  if (positionals.length > 0) throw new UsageError(`unexpected argument '${positionals[0]}'`);

  const fetcher = new Fetcher(DEFAULT_CACHE, { refresh: values.refresh });
  const fetchJson = deps.fetchJson ?? ((url) => fetcher.getJson(url));
  const fetchText = deps.fetchText ?? ((url) => fetcher.getText(url));
  const configPath = values.config ?? DEFAULT_CONFIG;

  if (values["dry-run"]) {
    await run(configPath, fetchJson, fetchText, { out: deps.out, setId: values.set });
    return 0;
  }

  const render: Render =
    deps.render ??
    (async (item, dest) => {
      const tmp = mkdtempSync(join(tmpdir(), "print_wall_src_"));
      try {
        const source = await fetcher.download(item.imageUrl, join(tmp, "source.jpg"));
        await renderPlacard(source, item.title, item.artist, item.date, dest);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });

  return sync({
    configPath,
    fetchJson,
    fetchText,
    artDir: deps.artDir ?? ART_DIR,
    render,
    regenerateManifest,
    active: activeMode(deps.modesDir ?? MODES_DIR),
    deploy: !values["no-deploy"],
    setId: values.set,
    deployFn: deps.deployFn,
    out: deps.out,
  });
}

if (import.meta.main) main((argv) => syncPrintsMain(argv));
