import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UsageError } from "@frame/cli";
import type { Fetch, FetchText, Print } from "../src/rijks.ts";
import {
  applyArtwork,
  DeployError,
  loadConfig,
  planDeletions,
  run,
  sync,
  syncPrintsMain,
} from "../src/sync-prints.ts";

const FIXTURES = join(import.meta.dir, "fixtures");

function makePrint(objectNumber = "A"): Print {
  return {
    objectNumber,
    title: "Title",
    artist: "Artist",
    date: "1890",
    rights: "PD",
    type: "print",
    width: 10,
    height: 10,
    imageUrl: "https://example.test/img",
  };
}

type Rec = Record<string, unknown>;

function allFixturesFetch(): Fetch {
  const bySearch = new Map<string, Rec>();
  const byUrl = new Map<string, Rec>();
  for (const name of readdirSync(FIXTURES).filter((n) => n.endsWith(".json"))) {
    const data = JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
    bySearch.set(data.object_number, data.search);
    for (const key of ["object", "visual", "digital"]) {
      if (data[key]) byUrl.set(data[key].id, data[key]);
    }
    if (data.info && data.digital) {
      const base = (data.digital.access_point[0].id as string).split("/full/")[0];
      byUrl.set(`${base}/info.json`, data.info);
    }
  }
  return async (url) => {
    if (url.includes("/search/collection?")) {
      const number = new URL(url).searchParams.get("objectNumber") as string;
      return bySearch.get(number) ?? { orderedItems: [] };
    }
    const hit = byUrl.get(url);
    if (!hit) throw new Error(`unexpected url: ${url}`);
    return hit;
  };
}

function setFetch(numbers: string[]): [Fetch, FetchText] {
  const html = `"UserSetObjectApiModel","id","node","Title",${numbers.map((n) => `"${n}"`).join("")}`;
  const fetchText: FetchText = async (url) => {
    if (url.includes("/collectie/verzameling/")) return html;
    throw new Error(`unexpected url: ${url}`);
  };
  return [allFixturesFetch(), fetchText];
}

function tempDir() {
  return mkdtempSync(join(tmpdir(), "sync-prints-"));
}

function writeConfig(dir: string, body = 'set_id = "test"\nculture = "en"\n') {
  const path = join(dir, "prints.toml");
  writeFileSync(path, body);
  return path;
}

const write = (bytes: string) => async (_item: Print, dest: string) => {
  writeFileSync(dest, bytes);
};

describe("loadConfig", () => {
  test("reads set_id and culture", () => {
    expect(loadConfig(writeConfig(tempDir()))).toEqual({ setId: "test", culture: "en" });
  });

  test("culture defaults to nl", () => {
    expect(loadConfig(writeConfig(tempDir(), 'set_id = "x"\n')).culture).toBe("nl");
  });

  test("a missing set_id is a usage error naming the file", () => {
    const path = writeConfig(tempDir(), 'culture = "nl"\n');
    expect(() => loadConfig(path)).toThrow(UsageError);
    expect(() => loadConfig(path)).toThrow(`no set_id in ${path}`);
  });

  test("reads the repo's real prints.toml", () => {
    const { setId, culture } = loadConfig(join(import.meta.dir, "..", "prints.toml"));
    expect(setId).toMatch(/^epaper--/);
    expect(culture).toBe("nl");
  });
});

describe("run (dry run)", () => {
  test("reports ok lines and skip reasons in the set's order", async () => {
    const lines: string[] = [];
    const results = await run(
      writeConfig(tempDir()),
      ...setFetch(["RP-P-1956-733", "SK-A-3089", "RP-F-2019-299-6-6", "SK-000-000"]),
      { out: (l) => lines.push(l) },
    );

    expect(results).toHaveLength(4);
    expect(lines[0]).toBe("001  RP-P-1956-733  print  PD  5706x3896  ok");
    expect(lines[1]).toStartWith("002  SK-A-3089  painting  PD  ");
    expect(lines[1]).toEndWith("ok");
    expect(lines[2]).toBe("003  RP-F-2019-299-6-6  skip: ambiguous");
    expect(lines[3]).toBe("004  SK-000-000  skip: not-found");
  });

  test("keeps going after a skip", async () => {
    const lines: string[] = [];
    const results = await run(writeConfig(tempDir()), ...setFetch(["SK-000-000", "SK-A-3089"]), {
      out: (l) => lines.push(l),
    });
    expect(results).toHaveLength(2);
    expect(lines[0]).toContain("skip: not-found");
    expect(lines[1]).toEndWith("ok");
  });

  test("--set overrides the configured set id", async () => {
    const urls: string[] = [];
    const fetchText: FetchText = async (url) => {
      urls.push(url);
      return '"SK-A-1"';
    };
    await run(writeConfig(tempDir()), async () => ({ orderedItems: [] }), fetchText, {
      out: () => {},
      setId: "override",
    });
    expect(urls).toEqual(["https://www.rijksmuseum.nl/en/collectie/verzameling/override"]);
  });
});

describe("planDeletions", () => {
  test("adopts everything on the first run", () => {
    expect(planDeletions(new Set(["a.png", "b.png"]), new Set(), new Set(["a.png"]), true)).toEqual(
      new Set(["b.png"]),
    );
  });

  test("afterwards only deletes files it manages", () => {
    const existing = new Set(["a.png", "b.png"]);
    expect(planDeletions(existing, new Set(["a.png"]), new Set(["a.png"]), false)).toEqual(
      new Set(),
    );
    expect(planDeletions(existing, new Set(["a.png"]), new Set(["c.png"]), false)).toEqual(
      new Set(["a.png"]),
    );
  });
});

describe("applyArtwork", () => {
  test("mirrors the folder and records what it manages", async () => {
    const art = join(tempDir(), "art");
    mkdirSync(art);
    writeFileSync(join(art, "stale.png"), "stale");
    const manifests: string[] = [];

    const result = await applyArtwork(
      [{ index: 1, item: makePrint("A") }],
      art,
      write("new"),
      async (dir) => {
        manifests.push(dir);
      },
    );

    expect(readFileSync(join(art, "001-A.png"), "utf8")).toBe("new");
    expect(readdirSync(art).sort()).toEqual([".managed.json", "001-A.png"]);
    expect(readFileSync(join(art, ".managed.json"), "utf8")).toBe('["001-A.png"]\n');
    expect(manifests).toEqual([art]);
    expect(result).toEqual({ rendered: 1, deleted: ["stale.png"], failures: [] });
  });

  test("names files <index>-<sanitised object number>.png", async () => {
    const art = tempDir();
    await applyArtwork([{ index: 12, item: makePrint("A/B c") }], art, write("x"), async () => {});
    expect(readdirSync(art)).toContain("012-A_B_c.png");
  });

  test("keeps files it does not manage", async () => {
    const art = tempDir();
    writeFileSync(join(art, ".managed.json"), '["old.png"]\n');
    writeFileSync(join(art, "old.png"), "old");
    writeFileSync(join(art, "keep.png"), "keep");

    await applyArtwork([{ index: 1, item: makePrint("A") }], art, write("x"), async () => {});

    expect(readdirSync(art)).toContain("keep.png");
    expect(readdirSync(art)).not.toContain("old.png");
  });

  test("when every render fails the folder is left alone and the manifest regenerated", async () => {
    const art = tempDir();
    writeFileSync(join(art, "old.png"), "old");
    writeFileSync(join(art, ".managed.json"), '["old.png"]\n');
    const manifests: string[] = [];

    const result = await applyArtwork(
      [{ index: 1, item: makePrint("A") }],
      art,
      async () => {
        throw new Error("boom");
      },
      async (dir) => {
        manifests.push(dir);
      },
    );

    expect(readFileSync(join(art, "old.png"), "utf8")).toBe("old");
    expect(result).toEqual({ rendered: 0, deleted: [], failures: [["A", "boom"]] });
    expect(manifests).toEqual([art]);
  });

  test("one failed render does not stop the others", async () => {
    const art = tempDir();
    const result = await applyArtwork(
      [
        { index: 1, item: makePrint("BAD") },
        { index: 2, item: makePrint("OK") },
      ],
      art,
      async (item, dest) => {
        if (item.objectNumber === "BAD") throw new Error("nope");
        writeFileSync(dest, "x");
      },
      async () => {},
    );
    expect(result.rendered).toBe(1);
    expect(result.failures).toEqual([["BAD", "nope"]]);
    expect(readdirSync(art)).toContain("002-OK.png");
  });

  test("a no-op rerun leaves every file byte-identical", async () => {
    const art = join(tempDir(), "art");
    const snapshot = () =>
      Object.fromEntries(readdirSync(art).map((n) => [n, readFileSync(join(art, n), "utf8")]));

    await applyArtwork([{ index: 1, item: makePrint("A") }], art, write("same"), async () => {});
    const before = snapshot();
    await applyArtwork([{ index: 1, item: makePrint("A") }], art, write("same"), async () => {});

    expect(snapshot()).toEqual(before);
  });
});

describe("sync", () => {
  function args(over: Partial<Parameters<typeof sync>[0]> = {}) {
    const dir = tempDir();
    const lines: string[] = [];
    const [fetchJson, fetchText] = setFetch(["RP-P-1956-733"]);
    return {
      lines,
      args: {
        configPath: writeConfig(dir),
        fetchJson,
        fetchText,
        artDir: join(dir, "art"),
        render: write("x"),
        regenerateManifest: async () => {},
        active: "art" as string | undefined,
        deploy: true,
        out: (l: string) => lines.push(l),
        ...over,
      },
    };
  }

  test("deploys when art is the active mode", async () => {
    const calls: string[] = [];
    const { args: a, lines } = args({ deployFn: async () => void calls.push("refresh") });
    expect(await sync(a)).toBe(0);
    expect(calls).toEqual(["refresh"]);
    expect(lines).toContain("deploy: refreshed art mode");
  });

  test("reports a deploy failure without throwing and exits 1", async () => {
    const { args: a, lines } = args({
      deployFn: async () => {
        throw new DeployError(["set_mode.sh", "--refresh"], 1);
      },
    });
    expect(await sync(a)).toBe(1);
    expect(lines.some((l) => l.startsWith("deploy failed: set_mode.sh --refresh exited 1"))).toBe(
      true,
    );
    expect(lines.some((l) => l.includes("set_mode.sh --refresh"))).toBe(true);
  });

  test("only stages when photos is active", async () => {
    const calls: string[] = [];
    const { args: a, lines } = args({
      active: "photos",
      deployFn: async () => void calls.push("x"),
    });
    await sync(a);
    expect(calls).toEqual([]);
    expect(lines.some((l) => l.includes("staged") && l.includes("active mode is photos"))).toBe(
      true,
    );
  });

  test("--no-deploy stages even when art is active", async () => {
    const calls: string[] = [];
    const { args: a, lines } = args({ deploy: false, deployFn: async () => void calls.push("x") });
    await sync(a);
    expect(calls).toEqual([]);
    expect(lines.some((l) => l.includes("staged"))).toBe(true);
  });

  test("reports the active mode as none when there is none", async () => {
    const { args: a, lines } = args({ active: undefined });
    await sync(a);
    expect(lines.some((l) => l.includes("active mode is none"))).toBe(true);
  });

  test("exits non-zero when a render fails", async () => {
    const { args: a } = args({
      active: "photos",
      render: async () => {
        throw new Error("boom");
      },
    });
    expect(await sync(a)).not.toBe(0);
  });

  test("changes nothing when no object resolves", async () => {
    const [fetchJson, fetchText] = setFetch(["SK-000-000"]);
    const { args: a, lines } = args({ fetchJson, fetchText });
    expect(await sync(a)).toBe(0);
    expect(lines.at(-1)).toBe("sync: no renderable objects; nothing changed");
  });

  test("prints the sync summary", async () => {
    const { args: a, lines } = args({ active: "photos" });
    await sync(a);
    expect(lines).toContain("sync: resolved=1 skipped=0 rendered=1 deleted=0");
  });
});

describe("sync-prints CLI", () => {
  test("--dry-run prints the plan and renders nothing", async () => {
    const dir = tempDir();
    const lines: string[] = [];
    const [fetchJson, fetchText] = setFetch(["SK-A-3089"]);
    const code = await syncPrintsMain(["--dry-run", "--config", writeConfig(dir)], {
      fetchJson,
      fetchText,
      artDir: join(dir, "art"),
      out: (l) => lines.push(l),
    });
    expect(code).toBe(0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toStartWith("001  SK-A-3089  painting");
    expect(readdirSync(dir)).toEqual(["prints.toml"]);
  });

  test("rejects unknown flags", async () => {
    await expect(syncPrintsMain(["--nope"], { out: () => {} })).rejects.toThrow(UsageError);
  });
});
