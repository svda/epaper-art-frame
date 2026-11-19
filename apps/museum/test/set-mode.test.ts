import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMain, UsageError } from "@frame/cli";
import { setModeMain } from "../src/set-mode.ts";

const DEST = "stub:/srv/ha/config/www/epaper13/";
const rsync = Bun.which("rsync") !== null ? test : test.skip;

function touch(path: string, body = "png") {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
}

function makeTree() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "set-mode-")));
  for (const mode of ["art", "photos"])
    touch(join(root, "www/epaper13-modes", mode, `${mode}.png`));
  touch(join(root, "www/epaper13/.gitignore"), "*.png\n");
  touch(join(root, "www/epaper/keep.png"), "keep");
  return root;
}

function makeMigrationTree() {
  const root = makeTree();
  rmSync(join(root, "www/epaper13-modes/photos/photos.png"));
  touch(join(root, "www/epaper13/photo1.png"), "one");
  touch(join(root, "www/epaper13/photo2.png"), "two");
  touch(join(root, "www/epaper13/.managed.json"), '["photo1.png", "photo2.png"]\n');
  return root;
}

async function setMode(root: string, argv: string[], opts: { dest?: string | null } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const pushed: string[] = [];
  const dest = opts.dest === undefined ? DEST : opts.dest;
  const code = await runMain(
    (a) =>
      setModeMain(a, {
        root,
        out: (l) => out.push(l),
        push: async (d) => void pushed.push(d),
        env: dest === null ? {} : { EPAPER13_DEST: dest },
      }),
    argv,
    { out: () => {}, err: (t) => err.push(t) },
  );
  return { code, out: out.join("\n"), err: err.join(""), pushed };
}

const live = (root: string) => readdirSync(join(root, "www/epaper13")).sort();
const active = (root: string) => join(root, "www/epaper13-modes/ACTIVE");

describe("set-mode (ported from set_mode.sh)", () => {
  rsync("switching to art publishes, records ACTIVE, writes the manifest and deploys", async () => {
    const root = makeTree();
    const result = await setMode(root, ["art"]);
    expect(result.code).toBe(0);
    expect(live(root)).toEqual([".gitignore", "art.png", "manifest.json"]);
    expect(readFileSync(active(root), "utf8")).toBe("art\n");
    expect(JSON.parse(readFileSync(join(root, "www/epaper13/manifest.json"), "utf8"))).toEqual([
      "art.png",
    ]);
    expect(result.pushed).toEqual([DEST]);
    expect(result.out).toContain(`published art -> ${join(root, "www/epaper13")}`);
    expect(result.out).toContain("note: the frame keeps one rotation counter across modes");
  });

  rsync("switching to photos replaces the art", async () => {
    const root = makeTree();
    expect((await setMode(root, ["art"])).code).toBe(0);
    expect((await setMode(root, ["photos"])).code).toBe(0);
    expect(live(root)).toEqual([".gitignore", "manifest.json", "photos.png"]);
    expect(readFileSync(active(root), "utf8").trim()).toBe("photos");
  });

  rsync("an empty mode refuses and leaves the live folder untouched", async () => {
    const root = makeTree();
    await setMode(root, ["art"]);
    const before = live(root);
    rmSync(join(root, "www/epaper13-modes/photos/photos.png"));
    const result = await setMode(root, ["photos"]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("mode 'photos' has no PNGs");
    expect(live(root)).toEqual(before);
  });

  test("a missing mode folder is an error naming it", async () => {
    const root = makeTree();
    rmSync(join(root, "www/epaper13-modes/art"), { recursive: true });
    const result = await setMode(root, ["art"]);
    expect(result.code).toBe(1);
    expect(result.err).toContain(`mode folder not found: ${join(root, "www/epaper13-modes/art")}`);
  });

  rsync("--dry-run changes nothing and says what it would do", async () => {
    const root = makeTree();
    const before = live(root);
    const result = await setMode(root, ["--dry-run", "art"]);
    expect(result.code).toBe(0);
    expect(live(root)).toEqual(before);
    expect(existsSync(active(root))).toBe(false);
    expect(result.pushed).toEqual([]);
    expect(result.out).toContain(`would publish art -> ${join(root, "www/epaper13")}`);
    expect(result.out).toContain("would write ACTIVE=art");
    expect(result.out).toContain(
      `would deploy: bun ${join(root, "packages/epaper/src/push.ts")} --profile spectra6-133 ${DEST}`,
    );
    expect(result.out).toContain("art.png");
  });

  test("--dry-run on a missing live folder says it would create it", async () => {
    const root = makeTree();
    rmSync(join(root, "www/epaper13"), { recursive: true });
    const result = await setMode(root, ["-n", "art"]);
    expect(result.out).toContain(`would create ${join(root, "www/epaper13")}`);
  });

  test("--refresh without a recorded active mode refuses", async () => {
    const root = makeTree();
    const result = await setMode(root, ["--refresh"]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("no ACTIVE mode recorded");
  });

  rsync("--refresh republishes the active mode", async () => {
    const root = makeTree();
    await setMode(root, ["art"]);
    touch(join(root, "www/epaper13-modes/art/new.png"));
    const result = await setMode(root, ["--refresh"]);
    expect(result.code).toBe(0);
    expect(existsSync(join(root, "www/epaper13/new.png"))).toBe(true);
  });

  rsync("--status reports the active mode and counts", async () => {
    const root = makeTree();
    await setMode(root, ["art"]);
    const result = await setMode(root, ["--status"]);
    expect(result.code).toBe(0);
    expect(result.out.split("\n")).toEqual(["active: art", "art: 1 PNG(s)", "photos: 1 PNG(s)"]);
  });

  test("--status with nothing recorded says none", async () => {
    const result = await setMode(makeTree(), ["--status"]);
    expect(result.out.split("\n")[0]).toBe("active: none");
  });

  rsync("--no-deploy publishes without pushing", async () => {
    const root = makeTree();
    const result = await setMode(root, ["--no-deploy", "art"]);
    expect(result.code).toBe(0);
    expect(existsSync(join(root, "www/epaper13/art.png"))).toBe(true);
    expect(readFileSync(active(root), "utf8").trim()).toBe("art");
    expect(result.pushed).toEqual([]);
  });

  test("a missing destination fails before publishing anything", async () => {
    const root = makeTree();
    const before = live(root);
    const result = await setMode(root, ["art"], { dest: null });
    expect(result.code).toBe(1);
    expect(result.err).toContain("EPAPER13_DEST is not set");
    expect(live(root)).toEqual(before);
    expect(existsSync(active(root))).toBe(false);
  });

  rsync("the 5.65in frame's folder is never touched", async () => {
    const root = makeTree();
    await setMode(root, ["art"]);
    expect(readFileSync(join(root, "www/epaper/keep.png"), "utf8")).toBe("keep");
  });
});

describe("set-mode --migrate", () => {
  rsync("moves the live photos into the photos mode and records it", async () => {
    const root = makeMigrationTree();
    const result = await setMode(root, ["--migrate"]);
    expect(result.code).toBe(0);
    const photos = join(root, "www/epaper13-modes/photos");
    expect(readdirSync(photos).sort()).toEqual([".managed.json", "photo1.png", "photo2.png"]);
    expect(readFileSync(join(photos, "photo1.png"), "utf8")).toBe("one");
    expect(readFileSync(join(photos, ".managed.json"), "utf8")).toBe(
      '["photo1.png", "photo2.png"]\n',
    );
    expect(readFileSync(active(root), "utf8").trim()).toBe("photos");
    expect(existsSync(join(root, "www/epaper13/manifest.json"))).toBe(true);
    expect(result.pushed).toEqual([]);
  });

  rsync("is idempotent", async () => {
    const root = makeMigrationTree();
    await setMode(root, ["--migrate"]);
    const before = live(root);
    const again = await setMode(root, ["--migrate"]);
    expect(again.code).toBe(0);
    expect(again.out).toContain("already migrated");
    expect(live(root)).toEqual(before);
  });

  test("--dry-run lists what it would move and changes nothing", async () => {
    const root = makeMigrationTree();
    const before = live(root);
    const result = await setMode(root, ["--migrate", "--dry-run"]);
    expect(result.code).toBe(0);
    expect(live(root)).toEqual(before);
    expect(existsSync(active(root))).toBe(false);
    expect(result.out.split("\n")).toEqual([
      `would move 2 PNG(s) from ${join(root, "www/epaper13")} to ${join(root, "www/epaper13-modes/photos")}`,
      "  photo1.png",
      "  photo2.png",
      "  .managed.json",
      "would write ACTIVE=photos",
    ]);
  });

  test("refuses when the live folder has no PNGs to migrate", async () => {
    const root = makeTree();
    rmSync(join(root, "www/epaper13-modes/photos/photos.png"));
    const result = await setMode(root, ["--migrate"]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("no PNGs");
    expect(existsSync(active(root))).toBe(false);
  });
});

describe("set-mode arguments", () => {
  test("needs a mode or an action", async () => {
    expect((await setMode(makeTree(), [])).code).toBe(2);
  });

  test("an unknown mode is an error", async () => {
    const result = await setMode(makeTree(), ["sepia"]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("unknown argument: sepia");
  });

  test("rejects unknown flags with a usage error", async () => {
    await expect(setModeMain(["--nope"], { out: () => {} })).rejects.toThrow(UsageError);
  });

  test("rejects combining actions", async () => {
    await expect(setModeMain(["--status", "--migrate"], { out: () => {} })).rejects.toThrow(
      UsageError,
    );
  });
});
