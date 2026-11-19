import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  exec as defaultExec,
  type Exec,
  main,
  parseArgs,
  repoRoot,
  runOrThrow,
  UsageError,
} from "@frame/cli";
import { manifestMain, pushMain } from "@frame/epaper";

const PROFILE = "spectra6-133";
const MODES = ["art", "photos"];
const NO_DEST =
  "EPAPER13_DEST is not set (e.g. EPAPER13_DEST=server:/srv/home-assistant/config/www/epaper13/)";

type Out = (line: string) => void;

export interface SetModeDeps {
  root?: string;
  out?: Out;
  exec?: Exec;
  push?: (dest: string) => Promise<unknown>;
  manifest?: (liveDir: string) => Promise<unknown>;
  env?: Record<string, string | undefined>;
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function pngs(dir: string): string[] {
  if (!isDir(dir)) return [];
  return readdirSync(dir)
    .filter((n) => !n.startsWith(".") && n.endsWith(".png") && isFile(join(dir, n)))
    .sort();
}

function readActive(modesDir: string): string {
  const path = join(modesDir, "ACTIVE");
  return isFile(path) ? readFileSync(path, "utf8").trim() : "";
}

class Switcher {
  readonly modes: string;
  readonly live: string;
  private readonly pushScript: string;
  private readonly dest: string;
  private readonly run: Exec;
  private readonly out: Out;

  constructor(
    private readonly deps: SetModeDeps,
    readonly dryRun: boolean,
    private deploy: boolean,
  ) {
    const root = deps.root ?? repoRoot();
    this.pushScript = join(root, "tools", "epaper", "src", "push.ts");
    this.modes = join(root, "www", "epaper13-modes");
    this.live = join(root, "www", "epaper13");
    this.dest = (deps.env ?? process.env).EPAPER13_DEST ?? "";
    this.run = deps.exec ?? defaultExec;
    this.out = deps.out ?? console.log;
  }

  private async mirror(src: string, extra: string[]): Promise<string> {
    const result = await runOrThrow(
      [
        "rsync",
        "-a",
        "--delete",
        ...extra,
        "--include=*.png",
        "--exclude=*",
        `${src}/`,
        `${this.live}/`,
      ],
      undefined,
      this.run,
    );
    return result.stdout;
  }

  async publish(mode: string): Promise<void> {
    const src = join(this.modes, mode);
    if (!isDir(src)) throw new Error(`mode folder not found: ${src}`);
    if (pngs(src).length === 0) throw new Error(`mode '${mode}' has no PNGs`);
    if (this.deploy && !this.dest) throw new Error(NO_DEST);

    if (this.dryRun) {
      this.out(`would publish ${mode} -> ${this.live}`);
      if (isDir(this.live)) {
        const listing = await this.mirror(src, ["--dry-run", "--itemize-changes"]);
        for (const line of listing.split("\n").filter(Boolean)) this.out(line);
      } else {
        this.out(`would create ${this.live}`);
      }
      this.out(`would write ACTIVE=${mode}`);
      if (this.deploy)
        this.out(`would deploy: bun ${this.pushScript} --profile ${PROFILE} ${this.dest}`);
      return;
    }

    mkdirSync(this.live, { recursive: true });
    await this.mirror(src, []);
    await (
      this.deps.manifest ??
      ((dir) => manifestMain(["--profile", PROFILE, "--dir", dir], { out: () => {} }))
    )(this.live);
    writeFileSync(join(this.modes, "ACTIVE"), `${mode}\n`);
    this.out(`published ${mode} -> ${this.live}`);

    if (this.deploy) {
      await (
        this.deps.push ?? ((dest) => pushMain(["--profile", PROFILE, dest], { out: this.out }))
      )(this.dest);
    }
    this.out(
      "note: the frame keeps one rotation counter across modes; it continues from wherever it is.",
    );
  }

  async migrate(): Promise<void> {
    const photos = join(this.modes, "photos");
    if (pngs(photos).length > 0) {
      this.out(`already migrated: ${photos} has PNGs`);
      return;
    }
    const moving = pngs(this.live);
    if (moving.length === 0) throw new Error(`no PNGs in ${this.live} to migrate`);
    const managed = isFile(join(this.live, ".managed.json"));

    if (this.dryRun) {
      this.out(`would move ${moving.length} PNG(s) from ${this.live} to ${photos}`);
      for (const name of moving) this.out(`  ${name}`);
      if (managed) this.out("  .managed.json");
      this.out("would write ACTIVE=photos");
      return;
    }

    mkdirSync(photos, { recursive: true });
    for (const name of moving) renameSync(join(this.live, name), join(photos, name));
    if (managed) renameSync(join(this.live, ".managed.json"), join(photos, ".managed.json"));
    this.deploy = false;
    await this.publish("photos");
  }
}

const USAGE = `usage: set-mode.ts [options] art|photos
       set-mode.ts [options] --refresh
       set-mode.ts [options] --migrate
       set-mode.ts --status

Publish one mode (art or photos) into the live 13" folder and deploy it.

options:
  -n, --dry-run   show what would change, then stop
      --no-deploy publish and record the mode, but do not push
  -h, --help      show this help`;

export async function setModeMain(argv: string[], deps: SetModeDeps = {}): Promise<number> {
  const { values, positionals } = parseArgs(
    {
      usage: USAGE,
      options: {
        "dry-run": { type: "boolean", short: "n" },
        "no-deploy": { type: "boolean" },
        refresh: { type: "boolean" },
        migrate: { type: "boolean" },
        status: { type: "boolean" },
      },
    },
    argv,
  );
  for (const arg of positionals) {
    if (!MODES.includes(arg)) throw new Error(`unknown argument: ${arg}`);
  }
  const actions = (["refresh", "migrate", "status"] as const).filter((a) => values[a]);
  if (actions.length > 1) throw new UsageError(`choose one of --${actions.join(", --")}\n${USAGE}`);

  const out = deps.out ?? console.log;
  const switcher = new Switcher(deps, values["dry-run"] ?? false, !values["no-deploy"]);

  if (values.status) {
    out(`active: ${readActive(switcher.modes) || "none"}`);
    for (const mode of MODES) out(`${mode}: ${pngs(join(switcher.modes, mode)).length} PNG(s)`);
    return 0;
  }
  if (values.refresh) {
    const active = readActive(switcher.modes);
    if (!active) throw new Error("no ACTIVE mode recorded; run set-mode.ts art|photos first");
    await switcher.publish(active);
    return 0;
  }
  if (values.migrate) {
    await switcher.migrate();
    return 0;
  }
  const mode = positionals.at(-1);
  if (!mode) throw new UsageError(USAGE);
  await switcher.publish(mode);
  return 0;
}

if (import.meta.main) main((argv) => setModeMain(argv));
