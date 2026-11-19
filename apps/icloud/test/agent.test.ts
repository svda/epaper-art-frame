import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runMain } from "@frame/cli";
import { PLIST_TEMPLATE, renderPlist, resolveBunPath } from "../src/agent.ts";
import { syncAlbumMain } from "../src/sync-album.ts";

const hasPlutil = Bun.which("plutil") !== null;
const withPlutil = hasPlutil ? test : test.skip;

async function parsePlist(xml: string): Promise<Record<string, unknown>> {
  const proc = Bun.spawn(["plutil", "-convert", "json", "-o", "-", "--", "-"], {
    stdin: new Blob([xml]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`plutil rejected the plist: ${err}`);
  return JSON.parse(out);
}

const template = () => readFileSync(PLIST_TEMPLATE, "utf8");

const vars = {
  bun: "/opt/homebrew/bin/bun",
  script: "/repo/apps/icloud/src/sync-album.ts",
  workdir: "/repo/apps/icloud",
  stdout: "/repo/apps/icloud/sync.log",
  stderr: "/repo/apps/icloud/sync.err.log",
  intervalH: 6,
};

describe("renderPlist", () => {
  test("the template file exists", () => {
    expect(existsSync(PLIST_TEMPLATE)).toBe(true);
  });

  withPlutil("is a valid plist that schedules the sync with bun", async () => {
    const data = await parsePlist(renderPlist(template(), vars));

    expect(data.Label).toBe("com.sander.epaper-album");
    expect(data.ProgramArguments).toEqual([
      "/opt/homebrew/bin/bun",
      "/repo/apps/icloud/src/sync-album.ts",
    ]);
    expect(data.WorkingDirectory).toBe("/repo/apps/icloud");
    expect(data.StartInterval).toBe(6 * 3600);
    expect(data.RunAtLoad).toBe(true);
    expect(data.StandardOutPath).toBe("/repo/apps/icloud/sync.log");
    expect(data.StandardErrorPath).toBe("/repo/apps/icloud/sync.err.log");
  });

  withPlutil("sets a PATH that finds magick, scp and osascript", async () => {
    const data = await parsePlist(renderPlist(template(), vars));
    const path = (data.EnvironmentVariables as { PATH: string }).PATH;
    expect(path).toContain("/opt/homebrew/bin");
    expect(path).toContain("/usr/bin");
    expect(path.split(":")).toContain("/bin");
  });

  test("leaves no placeholders behind", () => {
    expect(renderPlist(template(), vars)).not.toContain("__");
  });

  test("the interval is converted from hours to seconds", () => {
    expect(renderPlist(template(), { ...vars, intervalH: 1 })).toContain("<integer>3600</integer>");
  });

  withPlutil("escapes XML so a path with & or < still yields a valid plist", async () => {
    const data = await parsePlist(
      renderPlist(template(), { ...vars, workdir: "/Users/a&b/<x>", stdout: '/tmp/"q".log' }),
    );
    expect(data.WorkingDirectory).toBe("/Users/a&b/<x>");
    expect(data.StandardOutPath).toBe('/tmp/"q".log');
  });
});

describe("resolveBunPath", () => {
  test("prefers the stable PATH entry over the versioned install path", () => {
    expect(
      resolveBunPath(() => "/opt/homebrew/bin/bun", "/opt/homebrew/Cellar/bun/1.4.0/bin/bun"),
    ).toBe("/opt/homebrew/bin/bun");
  });

  test("falls back to the running executable when bun is not on PATH", () => {
    expect(resolveBunPath(() => null, "/somewhere/bun")).toBe("/somewhere/bun");
  });
});

describe("sync-album --print-plist", () => {
  async function print(argv: string[]) {
    const out: string[] = [];
    const calls: string[] = [];
    const code = await runMain(
      (a) =>
        syncAlbumMain(a, {
          env: {},
          envFilePath: join("/nonexistent", ".env"),
          out: (l) => out.push(l),
          bunPath: "/opt/homebrew/bin/bun",
          preflight: () => {
            calls.push("preflight");
            return [];
          },
          openSource: () => {
            calls.push("openSource");
            return { list: () => [] };
          },
        }),
      argv,
      { out: () => {}, err: () => {} },
    );
    return { code, text: out.join("\n"), calls };
  }

  test("prints a plist for this checkout and runs nothing else", async () => {
    const { code, text, calls } = await print(["--print-plist"]);
    expect(code).toBe(0);
    expect(calls).toEqual([]);
    expect(text).toContain("<string>/opt/homebrew/bin/bun</string>");
    expect(text).toContain("apps/icloud/src/sync-album.ts</string>");
    expect(text).toContain("<integer>21600</integer>");
    expect(text).not.toContain("__");
  });

  test("--interval-h and SYNC_INTERVAL_H set the schedule", async () => {
    expect((await print(["--print-plist", "--interval-h", "2"])).text).toContain(
      "<integer>7200</integer>",
    );
  });

  test("an invalid configuration still fails before printing", async () => {
    expect((await print(["--print-plist", "--profile", "nope"])).code).toBe(2);
  });
});
