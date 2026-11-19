import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Exec, runMain, UsageError } from "@frame/cli";
import { loadProfile } from "../src/profile.ts";
import { push, pushMain } from "../src/push.ts";
import golden from "./fixtures/push-golden.json";

function tempDir() {
  return realpathSync(mkdtempSync(join(tmpdir(), "push-")));
}

function folderWith(files: string[]) {
  const dir = tempDir();
  for (const f of files) writeFileSync(join(dir, f), "x");
  return dir;
}

function fakeRemote(opts: { stale?: string; staleFails?: boolean; failOn?: string } = {}) {
  const calls: string[][] = [];
  const exec: Exec = async (argv) => {
    calls.push(argv);
    if (opts.failOn && argv.join(" ").includes(opts.failOn)) {
      return { code: 255, stdout: "", stderr: "Permission denied" };
    }
    if (argv.join(" ").includes("for f in")) {
      return opts.staleFails
        ? { code: 255, stdout: "", stderr: "" }
        : { code: 0, stdout: opts.stale ?? "", stderr: "" };
    }
    return { code: 0, stdout: "", stderr: "" };
  };
  return { calls, exec };
}

async function run(argv: string[], deps: { exec: Exec; env?: Record<string, string> }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runMain(
    (a) => pushMain(a, { exec: deps.exec, out: (l) => out.push(l), env: deps.env ?? {} }),
    argv,
    { out: () => {}, err: (t) => err.push(t) },
  );
  return { code, stdout: out.length ? `${out.join("\n")}\n` : "", stderr: err.join("") };
}

describe("golden: behaves like push_to_ha.sh", () => {
  for (const c of golden) {
    test(c.name, async () => {
      const dir = folderWith(c.files);
      const sub = (s: string) => s.replaceAll("<dir>", dir).replaceAll("<repo>", "");
      const { calls, exec } = fakeRemote({ stale: c.stale ?? undefined, staleFails: c.staleFail });

      const result = await run(c.args.map(sub), { exec });

      expect(result.code).toBe(c.code);
      expect(result.stdout).toBe(c.stdout.replaceAll("<dir>", dir));
      expect(calls).toEqual(c.calls.map((call) => call.map((a) => a.replaceAll("<dir>", dir))));
      if (c.manifest !== null) {
        expect(readFileSync(join(dir, "manifest.json"), "utf8")).toBe(c.manifest);
      }
      const first = c.stderrHas[0]?.replace(/^error: /, "");
      if (first && !first.startsWith("usage:")) {
        expect(result.stderr).toContain(
          first
            .replaceAll("<repo>", "")
            .replaceAll("<dir>", dir)
            .replace(/artwork folder '.*'$/, ""),
        );
      }
    });
  }
});

describe("push", () => {
  const acep = loadProfile("acep565");

  test("a profile-derived folder must match the destination's last path segment", async () => {
    const dir = join(tempDir(), "epaper");
    mkdirSync(dir);
    writeFileSync(join(dir, "a.png"), "x");
    const profile = { ...acep, artwork: dir };
    const { exec } = fakeRemote();
    const out = () => {};
    await expect(
      push({ profile, dest: "ha:/config/www/epaper13/", dryRun: true }, { exec, out }),
    ).rejects.toThrow(UsageError);
    await push({ profile, dest: "ha:/config/www/epaper/", dryRun: true }, { exec, out });
  });

  test("an explicit --dir bypasses the profile guard", async () => {
    const dir = folderWith(["a.png"]);
    const { calls, exec } = fakeRemote();
    await push(
      { profile: acep, dir, dest: "ha:/anything/else/", dryRun: true },
      { exec, out: () => {} },
    );
    expect(calls).toHaveLength(0);
  });

  test("dry run writes the manifest but runs no ssh or scp", async () => {
    const dir = folderWith(["a.png"]);
    const { calls, exec } = fakeRemote();
    await push({ profile: acep, dir, dest: "ha:/x/", dryRun: true }, { exec, out: () => {} });
    expect(existsSync(join(dir, "manifest.json"))).toBe(true);
    expect(calls).toHaveLength(0);
  });

  test("shell-quotes remote paths so a stale name with a quote cannot break out", async () => {
    const dir = folderWith(["a.png"]);
    const { calls, exec } = fakeRemote({ stale: "it's.png\n" });
    await push({ profile: acep, dir, dest: "ha:/d/" }, { exec, out: () => {} });
    expect(calls.at(-1)).toEqual(["ssh", "-n", "ha", "rm -f -- '/d//it'\\''s.png'"]);
  });

  test("never prunes a png that the manifest still lists", async () => {
    const dir = folderWith(["a.png", "b.png"]);
    const { calls, exec } = fakeRemote({ stale: "a.png\nb.png\n" });
    await push({ profile: acep, dir, dest: "ha:/d/" }, { exec, out: () => {} });
    expect(calls.filter((c) => c.join(" ").includes("rm -f"))).toHaveLength(0);
  });

  test("copies every file the manifest lists, including uppercase extensions", async () => {
    const dir = folderWith(["a.png", "B.JPG"]);
    const { calls, exec } = fakeRemote();
    await push({ profile: acep, dir, dest: "ha:/d/" }, { exec, out: () => {} });
    const scp = calls.find((c) => c[0] === "scp");
    expect(scp).toEqual(["scp", `${dir}/manifest.json`, `${dir}/B.JPG`, `${dir}/a.png`, "ha:/d/"]);
  });

  test("rejects a host that ssh would parse as an option", async () => {
    const dir = folderWith(["a.png"]);
    const { calls, exec } = fakeRemote();
    await expect(
      push({ profile: acep, dir, dest: "-oProxyCommand=x:/d/" }, { exec, out: () => {} }),
    ).rejects.toThrow(UsageError);
    expect(calls).toHaveLength(0);
  });

  test("a failing ssh mkdir aborts before scp and carries ssh's stderr", async () => {
    const dir = folderWith(["a.png"]);
    const { calls, exec } = fakeRemote({ failOn: "mkdir" });
    await expect(
      push({ profile: acep, dir, dest: "ha:/d/" }, { exec, out: () => {} }),
    ).rejects.toThrow("Permission denied");
    expect(calls.some((c) => c[0] === "scp")).toBe(false);
  });
});

describe("push CLI", () => {
  test("EPAPER_DEST is the destination when none is given", async () => {
    const dir = folderWith(["a.png"]);
    const { exec } = fakeRemote();
    const result = await run(["--dir", dir, "-n"], { exec, env: { EPAPER_DEST: "ha:/w/epaper/" } });
    expect(result.stdout).toContain("destination: ha:/w/epaper/");
  });

  test("EPAPER_IMAGES counts as an explicit folder and skips the guard", async () => {
    const dir = folderWith(["a.png"]);
    const { exec } = fakeRemote();
    const result = await run(["-n", "ha:/totally/different/"], {
      exec,
      env: { EPAPER_IMAGES: dir },
    });
    expect(result.code).toBe(0);
  });

  test("EPAPER_PROFILE selects the panel", async () => {
    const { exec } = fakeRemote();
    const result = await run(["ha:/config/www/epaper/"], {
      exec,
      env: { EPAPER_PROFILE: "spectra6-133" },
    });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("spectra6-133");
  });

  test("rejects unknown flags with exit 2", async () => {
    const { exec } = fakeRemote();
    expect((await run(["--nope", "ha:/x/"], { exec })).code).toBe(2);
  });
});
