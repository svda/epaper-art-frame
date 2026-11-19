import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import {
  applyArtwork,
  MANAGED_NAME,
  planDeletions,
  readManaged,
  writeManaged,
} from "../src/mirror.ts";

const photo = (uuid: string) => ({ uuid });
const set = (...names: string[]) => new Set(names);

function tempDir() {
  return mkdtempSync(join(tmpdir(), "icloud-mirror-"));
}

const pngs = (dir: string) => new Set(readdirSync(dir).filter((n) => extname(n) === ".png"));

function makePrepare(log: [string, string][]) {
  return async (p: { uuid: string }, dest: string) => {
    writeFileSync(dest, `png:${p.uuid}`);
    log.push([p.uuid, dest.split("/").at(-1) as string]);
  };
}

function makeManifest(log: [string, string][]) {
  return async (dir: string) => {
    log.push(["manifest", dir]);
    writeFileSync(join(dir, "manifest.json"), `${JSON.stringify([...pngs(dir)].sort())}\n`);
  };
}

describe("planDeletions", () => {
  test("the first run deletes unmanaged pngs that are not selected", () => {
    expect(planDeletions(set("a.png", "b.png", "family.png"), set(), set("a.png"), true)).toEqual(
      set("b.png", "family.png"),
    );
  });

  test("later runs delete only managed stale files", () => {
    expect(
      planDeletions(
        set("a.png", "b.png", "family.png"),
        set("a.png", "b.png"),
        set("a.png"),
        false,
      ),
    ).toEqual(set("b.png"));
  });

  test("later runs leave unmanaged files alone", () => {
    expect(planDeletions(set("a.png", "family.png"), set("a.png"), set("a.png"), false)).toEqual(
      set(),
    );
  });

  test("nothing happens when managed equals current", () => {
    expect(planDeletions(set("a.png"), set("a.png"), set("a.png"), false)).toEqual(set());
  });
});

describe("managed state", () => {
  test("round-trips sorted, in the same format the Python tool wrote", () => {
    const dir = tempDir();
    writeManaged(dir, set("b.png", "a.png"));
    expect(readFileSync(join(dir, MANAGED_NAME), "utf8")).toBe('["a.png", "b.png"]\n');
    expect(readManaged(dir)).toEqual(set("a.png", "b.png"));
  });

  test("reads a state file written by the Python tool", () => {
    const dir = tempDir();
    writeFileSync(join(dir, MANAGED_NAME), '["x.png", "y.png"]\n');
    expect(readManaged(dir)).toEqual(set("x.png", "y.png"));
  });

  test("an absent state file is empty", () => {
    expect(readManaged(tempDir())).toEqual(set());
  });
});

describe("applyArtwork", () => {
  test("the first run adopts the folder and writes the manifest last", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "family.png"), "old");
    writeFileSync(join(dir, "old.png"), "old");
    const log: [string, string][] = [];

    const result = await applyArtwork([photo("uuid-a")], dir, makePrepare(log), makeManifest(log));

    expect(pngs(dir)).toEqual(set("uuid-a.png"));
    expect(result.deleted).toEqual(["family.png", "old.png"]);
    expect(readManaged(dir)).toEqual(set("uuid-a.png"));
    expect(log.at(-1)?.[0]).toBe("manifest");
  });

  test("later runs keep unmanaged files and delete managed stale ones", async () => {
    const dir = tempDir();
    writeManaged(dir, set("uuid-a.png", "uuid-b.png"));
    for (const name of ["uuid-a.png", "uuid-b.png", "family.png"])
      writeFileSync(join(dir, name), "x");
    const log: [string, string][] = [];

    const result = await applyArtwork([photo("uuid-a")], dir, makePrepare(log), makeManifest(log));

    expect(pngs(dir)).toEqual(set("uuid-a.png", "family.png"));
    expect(result.deleted).toEqual(["uuid-b.png"]);
    expect(readManaged(dir)).toEqual(set("uuid-a.png"));
  });

  test("prepares into uuid-named files", async () => {
    const dir = tempDir();
    const log: [string, string][] = [];
    await applyArtwork([photo("uuid-a"), photo("uuid-b")], dir, makePrepare(log), makeManifest([]));
    expect(log.map(([, name]) => name).sort()).toEqual(["uuid-a.png", "uuid-b.png"]);
    expect(readFileSync(join(dir, "uuid-a.png"), "utf8")).toBe("png:uuid-a");
  });

  test("a dry run writes nothing and plans the deletions", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "family.png"), "old");
    const log: [string, string][] = [];

    const result = await applyArtwork(
      [photo("uuid-a")],
      dir,
      makePrepare(log),
      makeManifest(log),
      true,
    );

    expect(pngs(dir)).toEqual(set("family.png"));
    expect(existsSync(join(dir, MANAGED_NAME))).toBe(false);
    expect(existsSync(join(dir, "manifest.json"))).toBe(false);
    expect(log).toEqual([]);
    expect(result).toMatchObject({ deleted: ["family.png"], dryRun: true, prepared: 0 });
  });

  test("a dry run reports which selected photos are already kept", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "uuid-a.png"), "x");
    const result = await applyArtwork(
      [photo("uuid-a"), photo("uuid-b")],
      dir,
      makePrepare([]),
      makeManifest([]),
      true,
    );
    expect(result.kept).toEqual(["uuid-a.png"]);
  });

  test("an empty selection mirrors to empty", async () => {
    const dir = tempDir();
    writeManaged(dir, set("uuid-a.png"));
    writeFileSync(join(dir, "uuid-a.png"), "x");

    const result = await applyArtwork([], dir, makePrepare([]), makeManifest([]));

    expect(pngs(dir)).toEqual(set());
    expect(result.deleted).toEqual(["uuid-a.png"]);
    expect(readManaged(dir)).toEqual(set());
  });

  test("copies only when the content changed", async () => {
    const dir = tempDir();
    const prepare = async (_p: { uuid: string }, dest: string) => writeFileSync(dest, "same-bytes");
    const first = await applyArtwork([photo("uuid-a")], dir, prepare, async () => {});
    const second = await applyArtwork([photo("uuid-a")], dir, prepare, async () => {});
    expect(first.copied).toBe(1);
    expect(second.copied).toBe(0);
  });

  test("a total prepare failure does not wipe the folder", async () => {
    const dir = tempDir();
    writeManaged(dir, set("uuid-a.png"));
    writeFileSync(join(dir, "uuid-a.png"), "x");
    const manifests: string[] = [];

    const result = await applyArtwork(
      [photo("uuid-a"), photo("uuid-b")],
      dir,
      async () => {
        throw new Error("no export");
      },
      async (d) => void manifests.push(d),
    );

    expect(pngs(dir)).toEqual(set("uuid-a.png"));
    expect(result.deleted).toEqual([]);
    expect(result.failures).toHaveLength(2);
    expect(manifests).toEqual([dir]);
  });

  test("continues past a failing photo and reports it", async () => {
    const dir = tempDir();
    const result = await applyArtwork(
      [photo("good"), photo("bad")],
      dir,
      async (p, dest) => {
        if (p.uuid === "bad") throw new Error("no export");
        writeFileSync(dest, "png");
      },
      async () => {},
    );

    expect(pngs(dir)).toEqual(set("good.png"));
    expect(result.failures).toEqual([["bad", "no export"]]);
    expect(result.kept).toEqual(["good.png"]);
    expect(result.prepared).toBe(1);
  });

  test("a failed staging leaves nothing behind in the temp area", async () => {
    const dir = tempDir();
    const stages: string[] = [];
    await applyArtwork(
      [photo("a")],
      dir,
      async (_p, dest) => {
        stages.push(join(dest, ".."));
        writeFileSync(dest, "x");
      },
      async () => {},
    );
    expect(existsSync(stages[0] as string)).toBe(false);
  });
});
