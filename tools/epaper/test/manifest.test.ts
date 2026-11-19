import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { type Exec, UsageError } from "@frame/cli";
import { escapeNonAscii } from "../src/json.ts";
import {
  findImages,
  generateManifest,
  manifestDir,
  manifestMain,
  renderManifest,
} from "../src/manifest.ts";
import { loadProfile } from "../src/profile.ts";
import { hasMagick, magick } from "./magick.ts";

const maybe = hasMagick ? test : test.skip;

function folderWith(...names: string[]) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "manifest-")));
  for (const name of names) writeFileSync(join(dir, name), "not-a-real-png");
  return dir;
}

async function run(argv: string[], env: Record<string, string> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await manifestMain(argv, {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    env,
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("manifestDir picks the artwork folder", () => {
  test("defaults to the default profile's folder", () => {
    expect(manifestDir(undefined, undefined, {})).toBe(loadProfile("acep565").artwork);
  });

  test("a profile selects its own folder", () => {
    expect(manifestDir(undefined, "spectra6-133", {})).toBe(loadProfile("spectra6-133").artwork);
  });

  test("EPAPER_IMAGES beats the profile and --dir beats EPAPER_IMAGES", () => {
    const fromEnv = folderWith();
    const fromFlag = folderWith();
    expect(manifestDir(undefined, "acep565", { EPAPER_IMAGES: fromEnv })).toBe(fromEnv);
    expect(manifestDir(fromFlag, "acep565", { EPAPER_IMAGES: fromEnv })).toBe(fromFlag);
  });

  test("expands a leading ~ to the home directory", () => {
    expect(manifestDir("~/nowhere-epaper", undefined, {})).toBe(join(homedir(), "nowhere-epaper"));
  });
});

describe("manifest contents", () => {
  test("lists images sorted, skipping the manifest, hidden files, folders and non-images", () => {
    const dir = folderWith("b.png", "a.png", "manifest.json", ".hidden.png", "notes.txt", "x.heic");
    mkdirSync(join(dir, "folder.png"));
    expect(findImages(dir)).toEqual(["a.png", "b.png"]);
  });

  test("extensions match case-insensitively", () => {
    const dir = folderWith("A.PNG", "b.Jpg", "c.JPEG");
    expect(findImages(dir)).toEqual(["A.PNG", "b.Jpg", "c.JPEG"]);
  });

  test("renders byte-identically to Python's json.dumps for non-ASCII names", () => {
    const names = ["A.PNG", "a b.png", "b.png", "c.JPEG", "é.jpg", "日本.png", "😀.png"];
    expect(renderManifest(names)).toBe(
      '["A.PNG", "a b.png", "b.png", "c.JPEG", "\\u00e9.jpg", "\\u65e5\\u672c.png", "\\ud83d\\ude00.png"]\n',
    );
  });

  test("renders an empty folder as []", () => {
    expect(renderManifest([])).toBe("[]\n");
  });

  test("escapeNonAscii escapes DEL like Python does", () => {
    expect(escapeNonAscii("a\u007f")).toBe("a\\u007f");
  });
});

describe("generateManifest", () => {
  test("writes manifest.json and parses back to the sorted list", () => {
    const dir = folderWith("b.png", "a.png");
    const result = generateManifest(dir);
    expect(result.images).toEqual(["a.png", "b.png"]);
    expect(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"))).toEqual([
      "a.png",
      "b.png",
    ]);
  });

  test("check mode never writes", () => {
    const dir = folderWith("a.png");
    const result = generateManifest(dir, { check: true });
    expect(result.upToDate).toBe(false);
    expect(existsSync(join(dir, "manifest.json"))).toBe(false);
  });
});

describe("manifest CLI", () => {
  test("write prints the same summary as generate_manifest.py", async () => {
    const dir = folderWith("b.png", "a.png");
    const { code, out } = await run(["--dir", dir]);
    expect(code).toBe(0);
    expect(out).toBe(`wrote ${join(dir, "manifest.json")}: 2 image(s): a.png, b.png`);
  });

  test("an empty folder reports (none)", async () => {
    const dir = folderWith();
    expect((await run(["--dir", dir])).out).toBe(
      `wrote ${join(dir, "manifest.json")}: 0 image(s): (none)`,
    );
  });

  test("--check reports stale, then fresh, then stale again", async () => {
    const dir = folderWith("a.png");
    const stale = await run(["--dir", dir, "--check"]);
    expect(stale.code).toBe(1);
    expect(stale.err).toContain(`${join(dir, "manifest.json")} is out of date`);

    await run(["--dir", dir]);
    const fresh = await run(["--dir", dir, "--check"]);
    expect(fresh.code).toBe(0);
    expect(fresh.out).toBe(`${join(dir, "manifest.json")} is up to date (1 image(s))`);

    writeFileSync(join(dir, "b.png"), "x");
    expect((await run(["--dir", dir, "--check"])).code).toBe(1);
  });

  test("an unknown profile fails even when --dir overrides the folder", async () => {
    await expect(run(["--profile", "nope", "--dir", folderWith()])).rejects.toThrow(UsageError);
  });

  test("EPAPER_PROFILE is ignored, as in the Python tool", async () => {
    const result = await run(["--check"], {
      EPAPER_PROFILE: "no-such-panel",
      EPAPER_IMAGES: folderWith(),
    });
    expect(result.code).toBe(1);
  });

  test("a missing artwork folder is an error naming it", async () => {
    await expect(run(["--dir", "/no/such/folder"])).rejects.toThrow(
      "artwork folder not found: /no/such/folder",
    );
  });
});

describe("--prepare", () => {
  test("converts each HEIC through prepare for the chosen profile, in sorted order", async () => {
    const dir = folderWith("b.HEIC", "a.heic", "c.png");
    const calls: string[][] = [];
    const exec: Exec = async (argv) => {
      calls.push(argv);
      return { code: 0, stdout: "", stderr: "" };
    };
    const out: string[] = [];
    await manifestMain(["--dir", dir, "--profile", "spectra6-133", "--prepare"], {
      exec,
      out: (l) => out.push(l),
      err: () => {},
      env: { EPAPER_IMAGES: dir },
    });
    expect(calls.map((c) => c[1])).toEqual([join(dir, "a.heic"), join(dir, "b.HEIC")]);
    expect(calls.every((c) => c.includes("1600x1200^"))).toBe(true);
    expect(
      out.filter((l) => l.startsWith("wrote ") && l.includes("profile=spectra6-133")),
    ).toHaveLength(2);
  });

  maybe("end to end with ImageMagick: the PNG lands in the manifest", async () => {
    const dir = folderWith();
    await magick("-size", "320x200", "gradient:#ff4040-#2040ff", join(dir, "shot.heic"));
    const { code } = await run(["--dir", dir, "--prepare"], { EPAPER_IMAGES: dir });
    expect(code).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"))).toEqual(["shot.png"]);
  });
});
