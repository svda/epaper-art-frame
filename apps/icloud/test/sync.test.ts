import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { runMain, UsageError } from "@frame/cli";
import type { Photo, PhotoSource } from "../src/photo-source.ts";
import {
  type Config,
  deploy,
  exitCode,
  manifestWriter,
  type SyncResult,
  summarize,
  sync,
  syncAlbumMain,
} from "../src/sync-album.ts";

const ALBUM = "epaper art frame";
const day = (n: number) => new Date(Date.UTC(2026, 0, n));

function photo(uuid: string, date: Date | null = day(1)): Photo {
  return { uuid, date, filename: `${uuid}.HEIC`, isMovie: false, adjusted: false, localPath: null };
}

const source = (...photos: Photo[]): PhotoSource => ({
  list: (album) => (album === ALBUM ? photos : []),
});

function tempDir() {
  return mkdtempSync(join(tmpdir(), "icloud-sync-"));
}

function cfg(artworkDir: string, over: Partial<Config> = {}): Config {
  return { artworkDir, intervalH: 6, dryRun: false, album: ALBUM, ...over };
}

const writePng = async (_p: Photo, dest: string) => writeFileSync(dest, "png");
const pngs = (dir: string) => readdirSync(dir).filter((n) => extname(n) === ".png");

function result(over: Partial<SyncResult> = {}): SyncResult {
  return { prepared: 0, kept: [], deleted: [], dryRun: false, failures: [], copied: 0, ...over };
}

describe("sync", () => {
  test("prepares every photo in the album", async () => {
    const dir = tempDir();
    const photos = [1, 2, 3, 4, 5].map((i) => photo(`u${i}`, day(i)));

    const res = await sync(cfg(dir), source(...photos), writePng, async () => {});

    expect(res.prepared).toBe(5);
    expect(pngs(dir).sort()).toEqual(["u1.png", "u2.png", "u3.png", "u4.png", "u5.png"]);
  });

  test("selects the way the Python tool did: movies out, newest first", async () => {
    const seen: string[] = [];
    const movie = { ...photo("m", day(9)), isMovie: true };
    await sync(
      cfg(tempDir()),
      source(photo("old", day(1)), movie, photo("new", day(5))),
      async (p, dest) => {
        seen.push(p.uuid);
        writeFileSync(dest, "x");
      },
      async () => {},
    );
    expect(seen).toEqual(["new", "old"]);
  });

  test("requires an album", async () => {
    await expect(
      sync(cfg(tempDir(), { album: undefined }), source(photo("u1")), writePng, async () => {}),
    ).rejects.toThrow("no album configured (set ALBUM or --album)");
  });

  test("a dry run changes nothing", async () => {
    const dir = tempDir();
    const res = await sync(
      cfg(dir, { dryRun: true }),
      source(photo("u1")),
      writePng,
      async () => {},
    );
    expect(res.dryRun).toBe(true);
    expect(pngs(dir)).toEqual([]);
  });
});

describe("summarize and exitCode", () => {
  test("the exit code is non-zero when any photo failed", () => {
    expect(exitCode(result({ prepared: 3 }))).toBe(0);
    expect(exitCode(result({ prepared: 2, failures: [["x", "boom"]] }))).toBe(1);
  });

  test("summarize reports counts and failures", () => {
    const text = summarize(
      result({
        prepared: 2,
        kept: ["a.png", "b.png"],
        deleted: ["c.png"],
        failures: [["x", "boom"]],
      }),
    );
    expect(text).toBe("sync: prepared=2 kept=2 deleted=1 failures=1");
  });

  test("summarize marks a dry run", () => {
    expect(summarize(result({ deleted: ["c.png"], dryRun: true }))).toBe(
      "sync: prepared=0 kept=0 deleted=1 dry-run",
    );
  });
});

describe("deploy", () => {
  test("skips when nothing changed", async () => {
    const calls: string[][] = [];
    await deploy("ha:/cfg/www/epaper", false, { push: async (a) => void calls.push(a) });
    expect(calls).toEqual([]);
  });

  test("pushes with an explicit profile and the destination when something changed", async () => {
    const calls: string[][] = [];
    await deploy("ha:/cfg/www/epaper", true, { push: async (a) => void calls.push(a) });
    expect(calls).toEqual([["--profile", "acep565", "ha:/cfg/www/epaper"]]);
  });

  test("uses the configured profile", async () => {
    const calls: string[][] = [];
    await deploy("ha:/x/epaper13", true, {
      profile: "spectra6-133",
      push: async (a) => void calls.push(a),
    });
    expect(calls[0]?.slice(0, 2)).toEqual(["--profile", "spectra6-133"]);
  });

  test("requires a destination when something changed", async () => {
    await expect(deploy(undefined, true, { push: async () => {} })).rejects.toThrow("EPAPER_DEST");
  });

  test("propagates a host failure", async () => {
    await expect(
      deploy("ha:/x", true, {
        push: async () => {
          throw new Error("ssh: host unreachable");
        },
      }),
    ).rejects.toThrow("unreachable");
  });
});

describe("manifestWriter", () => {
  test("calls the manifest tool for the artwork folder with the profile", async () => {
    const calls: string[][] = [];
    await manifestWriter(undefined, async (argv) => void calls.push(argv))("/art");
    expect(calls).toEqual([["--profile", "acep565", "--dir", "/art"]]);
  });
});

describe("sync-album CLI", () => {
  async function run(
    argv: string[],
    over: {
      photos?: Photo[];
      env?: Record<string, string>;
      push?: (argv: string[]) => Promise<unknown>;
      prepare?: (p: Photo, dest: string) => Promise<unknown>;
      missing?: string[];
      closed?: string[];
    } = {},
  ) {
    const out: string[] = [];
    const err: string[] = [];
    const pushed: string[][] = [];
    const code = await runMain(
      (a) =>
        syncAlbumMain(a, {
          env: over.env ?? {},
          envFilePath: join(tempDir(), "missing.env"),
          out: (l) => out.push(l),
          err: (l) => err.push(l),
          preflight: () => over.missing ?? [],
          openSource: () => ({
            ...source(...(over.photos ?? [photo("u1")])),
            close: () => over.closed?.push("closed"),
          }),
          prepareOne: over.prepare ?? (async (_p, dest) => writeFileSync(dest, "png")),
          manifest: async () => {},
          push: over.push ?? (async (a) => void pushed.push(a)),
        }),
      argv,
      { out: () => {}, err: (t) => err.push(t.trimEnd()) },
    );
    return { code, out: out.join("\n"), err: err.join("\n"), pushed };
  }

  test("syncs, then deploys because something changed", async () => {
    const dir = tempDir();
    const result = await run(["--artwork-dir", dir, "--album", ALBUM, "--dest", "ha:/x/epaper"]);
    expect(result.code).toBe(0);
    expect(result.out).toBe("sync: prepared=1 kept=1 deleted=0\ndeploy: pushed to ha:/x/epaper");
    expect(result.pushed).toEqual([["--profile", "acep565", "ha:/x/epaper"]]);
    expect(pngs(dir)).toEqual(["u1.png"]);
  });

  test("a second identical run changes nothing and does not deploy", async () => {
    const dir = tempDir();
    const args = ["--artwork-dir", dir, "--album", ALBUM, "--dest", "ha:/x/epaper"];
    await run(args);
    const again = await run(args);
    expect(again.out).toBe("sync: prepared=1 kept=1 deleted=0\ndeploy: no changes");
    expect(again.pushed).toEqual([]);
  });

  test("a dry run prints the plan and neither writes nor deploys", async () => {
    const dir = tempDir();
    const result = await run([
      "-n",
      "--artwork-dir",
      dir,
      "--album",
      ALBUM,
      "--dest",
      "ha:/x/epaper",
    ]);
    expect(result.out).toBe("sync: prepared=0 kept=0 deleted=0 dry-run");
    expect(result.pushed).toEqual([]);
    expect(existsSync(join(dir, "manifest.json"))).toBe(false);
  });

  test("failed photos go to stderr and the exit code is 1", async () => {
    const result = await run(["--artwork-dir", tempDir(), "--album", ALBUM], {
      photos: [photo("good"), photo("bad")],
      prepare: async (p, dest) => {
        if (p.uuid === "bad") throw new Error("boom");
        writeFileSync(dest, "png");
      },
    });
    expect(result.code).toBe(1);
    expect(result.err).toContain("  failed bad: boom");
  });

  test("a deploy failure is reported and exits 1", async () => {
    const result = await run(
      ["--artwork-dir", tempDir(), "--album", ALBUM, "--dest", "ha:/x/epaper"],
      {
        push: async () => {
          throw new Error("host unreachable");
        },
      },
    );
    expect(result.code).toBe(1);
    expect(result.err).toContain("error: deploy failed: host unreachable");
  });

  test("a change with no destination configured is a deploy failure", async () => {
    const result = await run(["--artwork-dir", tempDir(), "--album", ALBUM]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("EPAPER_DEST");
  });

  test("missing tools are reported before anything runs", async () => {
    const result = await run(["--album", ALBUM], { missing: ["magick (ImageMagick 7)", "scp"] });
    expect(result.code).toBe(1);
    expect(result.err).toContain("error: missing required tools: magick (ImageMagick 7), scp");
  });

  test("closes the photo source when done", async () => {
    const closed: string[] = [];
    await run(["--artwork-dir", tempDir(), "--album", ALBUM], { closed });
    expect(closed).toEqual(["closed"]);
  });

  test("a bad configuration exits 2", async () => {
    const result = await run(["--profile", "no-such-panel"]);
    expect(result.code).toBe(2);
    expect(result.err).toContain("no-such-panel");
  });

  test("an interval that is not an integer exits 2", async () => {
    expect((await run(["--interval-h", "soon"])).code).toBe(2);
  });

  test("reads settings from the env file named by --config", async () => {
    const dir = tempDir();
    const config = join(tempDir(), "custom.env");
    writeFileSync(config, `ALBUM=${ALBUM}\nEPAPER_DEST='ha:/from/file/epaper'\n`);
    const result = await run(["--config", config, "--artwork-dir", dir]);
    expect(result.pushed).toEqual([["--profile", "acep565", "ha:/from/file/epaper"]]);
  });

  test("rejects unknown flags", async () => {
    await expect(syncAlbumMain(["--nope"], { out: () => {} })).rejects.toThrow(UsageError);
  });
});
