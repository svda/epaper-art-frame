import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Exec, repoRoot, UsageError } from "@frame/cli";
import { prepareImage, prepareMain } from "../src/prepare.ts";
import { loadProfile } from "../src/profile.ts";
import fixtures from "./fixtures/prepare-argv.json";
import { coloursOf, hasMagick, magick } from "./magick.ts";

const maybe = hasMagick ? test : test.skip;
const REPO = repoRoot();

function recorder(code = 0, stderr = "") {
  const calls: string[][] = [];
  const exec: Exec = async (argv) => {
    calls.push(argv);
    return { code, stdout: "", stderr };
  };
  return { calls, exec };
}

function tempDir() {
  return mkdtempSync(join(tmpdir(), "prepare-"));
}

describe("golden: argv and summary match prepare_image.sh", () => {
  for (const c of fixtures) {
    const label = `${c.profile} fit=${c.fit} rotate=${c.rotate} dither=${c.dither ?? "profile"}`;
    test(label, async () => {
      const { calls, exec } = recorder();
      const lines: string[] = [];
      const argv = ["--profile", c.profile];
      if (c.fit) argv.push("--fit");
      if (c.rotate) argv.push("--rotate");
      if (c.dither) argv.push("--dither", c.dither);
      argv.push("/in/photo.HEIC", "/out/photo.png");

      const code = await prepareMain(argv, { exec, out: (l) => lines.push(l), env: {} });

      expect(code).toBe(0);
      expect(calls).toHaveLength(1);
      const [bin, ...args] = calls[0] ?? [];
      expect(bin).toBe("magick");
      expect(args.map((a) => a.replace(REPO, "<repo>"))).toEqual(c.argv);
      expect(lines.join("\n").replace(REPO, "<repo>")).toBe(c.stdout);
    });
  }
});

describe("prepareImage", () => {
  test("defaults the output to <artwork>/<input stem>.png", async () => {
    const dir = tempDir();
    const { calls, exec } = recorder();
    const out = await prepareImage(
      "/photos/IMG_0001.final.HEIC",
      { profile: loadProfile("acep565"), outDir: dir },
      exec,
    );
    expect(out).toBe(join(dir, "IMG_0001.final.png"));
    expect(calls[0]?.at(-1)).toBe(out);
  });

  test("keeps a name with no extension whole", async () => {
    const dir = tempDir();
    const { exec } = recorder();
    const out = await prepareImage(
      "/photos/scan",
      { profile: loadProfile("acep565"), outDir: dir },
      exec,
    );
    expect(out).toBe(join(dir, "scan.png"));
  });

  test("fails when the default output folder does not exist", async () => {
    const { exec } = recorder();
    await expect(
      prepareImage(
        "/photos/a.jpg",
        { profile: loadProfile("acep565"), outDir: "/no/such/dir" },
        exec,
      ),
    ).rejects.toThrow("output folder not found: /no/such/dir");
  });

  test("an explicit output skips the folder check", async () => {
    const { exec } = recorder();
    const out = await prepareImage(
      "/photos/a.jpg",
      { profile: loadProfile("acep565"), output: "/no/such/dir/x.png" },
      exec,
    );
    expect(out).toBe("/no/such/dir/x.png");
  });

  test("fails when the palette file is missing", async () => {
    const { exec } = recorder();
    const profile = { ...loadProfile("acep565"), palette: "/no/palette.png" };
    await expect(prepareImage("/a.jpg", { profile, output: "/o.png" }, exec)).rejects.toThrow(
      "palette not found: /no/palette.png",
    );
  });

  test("rejects a backend other than magick with a UsageError", async () => {
    const { calls, exec } = recorder();
    const profile = { ...loadProfile("acep565"), backend: "epaper-dithering" };
    await expect(prepareImage("/a.jpg", { profile, output: "/o.png" }, exec)).rejects.toThrow(
      UsageError,
    );
    expect(calls).toHaveLength(0);
  });

  test("surfaces magick's stderr when it fails", async () => {
    const { exec } = recorder(1, "no decode delegate");
    await expect(
      prepareImage("/a.jpg", { profile: loadProfile("acep565"), output: "/o.png" }, exec),
    ).rejects.toThrow("no decode delegate");
  });
});

describe("prepare CLI", () => {
  const base = { out: () => {}, env: {} as Record<string, string> };

  test("needs an input", async () => {
    await expect(prepareMain([], { ...base, exec: recorder().exec })).rejects.toThrow(UsageError);
  });

  test("rejects unknown flags", async () => {
    await expect(
      prepareMain(["--nope", "a.jpg"], { ...base, exec: recorder().exec }),
    ).rejects.toThrow(UsageError);
  });

  test("rejects an unknown dither method", async () => {
    await expect(
      prepareMain(["--dither", "Sparkle", "a.jpg", "o.png"], { ...base, exec: recorder().exec }),
    ).rejects.toThrow(UsageError);
  });

  test("EPAPER_IMAGES is the default output folder and --out-dir overrides it", async () => {
    const fromEnv = tempDir();
    const fromFlag = tempDir();
    const { calls, exec } = recorder();
    await prepareMain(["a.jpg"], { ...base, exec, env: { EPAPER_IMAGES: fromEnv } });
    await prepareMain(["--out-dir", fromFlag, "a.jpg"], {
      ...base,
      exec,
      env: { EPAPER_IMAGES: fromEnv },
    });
    expect(calls[0]?.at(-1)).toBe(join(fromEnv, "a.png"));
    expect(calls[1]?.at(-1)).toBe(join(fromFlag, "a.png"));
  });

  test("EPAPER_PROFILE picks the panel when --profile is absent", async () => {
    const { calls, exec } = recorder();
    await prepareMain(["a.jpg", "o.png"], {
      ...base,
      exec,
      env: { EPAPER_PROFILE: "spectra6-133" },
    });
    expect(calls[0]).toContain("1600x1200^");
  });
});

describe("integration with real ImageMagick", () => {
  async function sample(dir: string, name: string, size: string) {
    const path = join(dir, name);
    await magick("-size", size, "gradient:#ff4040-#2040ff", "-swirl", "90", path);
    return path;
  }

  const panels = ["acep565", "spectra6-133"] as const;

  for (const id of panels) {
    maybe(`${id}: output has the panel size and only palette colours`, async () => {
      const dir = tempDir();
      const profile = loadProfile(id);
      const input = await sample(dir, "in.png", "320x200");
      const output = join(dir, "out.png");
      await prepareMain(["--profile", id, input, output], {
        exec: undefined,
        out: () => {},
        env: {},
      });
      expect(await magick("identify", "-format", "%wx%h", output)).toBe(
        `${profile.width}x${profile.height}`,
      );
      const allowed = new Set(await coloursOf(profile.palette));
      for (const colour of await coloursOf(output)) expect(allowed.has(colour)).toBe(true);
    });
  }

  maybe("--fit pads with white and --rotate turns a portrait photo", async () => {
    const dir = tempDir();
    const input = await sample(dir, "portrait.png", "200x320");
    const output = join(dir, "out.png");
    await prepareMain(["--fit", "--rotate", input, output], {
      exec: undefined,
      out: () => {},
      env: {},
    });
    expect(await magick("identify", "-format", "%wx%h", output)).toBe("600x448");
  });

  maybe("reads a HEIC input", async () => {
    const dir = tempDir();
    const heic = join(dir, "in.heic");
    await magick("-size", "320x200", "gradient:#ff4040-#2040ff", heic);
    const output = join(dir, "out.png");
    mkdirSync(dir, { recursive: true });
    await prepareMain([heic, output], { exec: undefined, out: () => {}, env: {} });
    expect(existsSync(output)).toBe(true);
    expect(await magick("identify", "-format", "%wx%h", output)).toBe("600x448");
  });
});
