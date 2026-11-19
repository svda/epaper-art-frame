import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { Exec } from "@frame/cli";
import { exportPhoto, prepareOne } from "../src/export.ts";
import type { Photo } from "../src/photo-source.ts";

const UUID = "03D1362B-BF4D-4A46-975D-31AD25BF7A3C";

function photo(over: Partial<Photo> = {}): Photo {
  return {
    uuid: UUID,
    date: null,
    filename: "IMG_0001.HEIC",
    isMovie: false,
    adjusted: false,
    localPath: null,
    ...over,
  };
}

function tempDir() {
  return mkdtempSync(join(tmpdir(), "icloud-export-"));
}

// A Photos.app stand-in: records every command, and "exports" a file when asked to.
function fakeExec(opts: { exportName?: string; failOn?: string } = {}) {
  const calls: string[][] = [];
  const exec: Exec = async (argv) => {
    calls.push(argv);
    if (opts.failOn && argv[0] === opts.failOn) {
      return { code: 1, stdout: "", stderr: `${opts.failOn} blew up` };
    }
    if (argv[0] === "osascript" && opts.exportName) {
      const script = argv[2] ?? "";
      const dir = /POSIX file "([^"]+)"/.exec(script)?.[1];
      if (dir) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, opts.exportName), "x");
      }
    }
    if (argv[0] === "sips") writeFileSync(argv[argv.indexOf("--out") + 1] as string, "jpg");
    return { code: 0, stdout: "", stderr: "" };
  };
  return { calls, exec };
}

describe("exportPhoto", () => {
  test("uses the local original without asking Photos", async () => {
    const original = join(tempDir(), "orig.heic");
    writeFileSync(original, "x");
    const { calls, exec } = fakeExec();
    expect(
      await exportPhoto(photo({ localPath: original }), join(tempDir(), "staging"), exec),
    ).toEqual([original]);
    expect(calls).toHaveLength(0);
  });

  test("exports an off-disk photo through Photos.app and returns the exported files", async () => {
    const staging = join(tempDir(), "staging");
    const { calls, exec } = fakeExec({ exportName: "IMG_shared.jpeg" });

    const files = await exportPhoto(photo(), staging, exec);

    expect(files.map((f) => basename(f))).toEqual(["IMG_shared.jpeg"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.slice(0, 2)).toEqual(["osascript", "-e"]);
    expect(calls[0]?.[2]).toBe(
      `tell application "Photos" to export {media item id "${UUID}/L0/001"} to (POSIX file "${staging}") with using originals`,
    );
  });

  test("an edited photo is exported rendered, so the originals flag is left out", async () => {
    const { calls, exec } = fakeExec({ exportName: "IMG_edit.jpeg" });
    await exportPhoto(photo({ adjusted: true }), join(tempDir(), "staging"), exec);
    expect(calls[0]?.[2]).not.toContain("using originals");
    expect(calls[0]?.[2]).toEndWith(`")`);
  });

  test("runs osascript with a timeout so a permission prompt cannot hang a scheduled run", async () => {
    const seen: (number | undefined)[] = [];
    const exec: Exec = async (_argv, opts) => {
      seen.push(opts?.timeoutMs);
      return { code: 0, stdout: "", stderr: "" };
    };
    await exportPhoto(photo(), join(tempDir(), "staging"), exec).catch(() => {});
    expect(seen[0]).toBeGreaterThan(0);
  });

  test("raises when Photos produced no file", async () => {
    const { exec } = fakeExec();
    await expect(exportPhoto(photo(), join(tempDir(), "staging"), exec)).rejects.toThrow(
      "original not available",
    );
  });

  test("carries Photos' own error when the export command fails", async () => {
    const { exec } = fakeExec({ failOn: "osascript" });
    await expect(exportPhoto(photo(), join(tempDir(), "staging"), exec)).rejects.toThrow(
      "osascript blew up",
    );
  });

  test("refuses a uuid that is not safe to put in a script", async () => {
    const { calls, exec } = fakeExec();
    await expect(
      exportPhoto(photo({ uuid: 'x"; do shell script "id' }), join(tempDir(), "staging"), exec),
    ).rejects.toThrow("unsafe photo id");
    expect(calls).toHaveLength(0);
  });

  test("escapes quotes and backslashes in the export folder", async () => {
    const { calls, exec } = fakeExec();
    const dir = join(tempDir(), 'we"ird\\dir');
    await exportPhoto(photo(), dir, exec).catch(() => {});
    expect(calls[0]?.[2]).toContain(
      `POSIX file "${dir.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`,
    );
  });
});

describe("prepareOne", () => {
  function setup() {
    const dest = join(tempDir(), "out", "uuid-a.png");
    mkdirSync(join(dest, ".."), { recursive: true });
    return dest;
  }

  test("exports, then prepares for the default panel straight into the destination", async () => {
    const dest = setup();
    const { calls, exec } = fakeExec();
    let exportDir = "";

    await prepareOne(photo(), dest, {
      exec,
      exportFn: async (_photo, dir) => {
        exportDir = dir;
        const src = join(dir, "IMG_0001.HEIC");
        writeFileSync(src, "heic");
        return [src];
      },
    });

    const magick = calls.find((c) => c[0] === "magick");
    expect(magick?.[1]).toBe(join(exportDir, "IMG_0001.HEIC"));
    expect(magick?.at(-1)).toBe(dest);
    expect(magick).toContain("600x448^");
  });

  test("a profile selects that panel", async () => {
    const { calls, exec } = fakeExec();
    await prepareOne(photo(), setup(), {
      exec,
      profile: "spectra6-133",
      exportFn: async (_p, dir) => [join(dir, "a.jpg")],
    });
    expect(calls.find((c) => c[0] === "magick")).toContain("1600x1200^");
  });

  test("converts camera RAW to JPEG with sips before preparing", async () => {
    const { calls, exec } = fakeExec();
    await prepareOne(photo(), setup(), {
      exec,
      exportFn: async (_p, dir) => {
        const src = join(dir, "IMG_0001.DNG");
        writeFileSync(src, "raw");
        return [src];
      },
    });

    expect(calls[0]?.slice(0, 3)).toEqual(["sips", "-s", "format"]);
    expect(calls[0]).toContain("jpeg");
    expect(calls.at(-1)?.[0]).toBe("magick");
    expect(calls.at(-1)?.[1]).toEndWith("IMG_0001.jpg");
  });

  test("raises, naming the photo, when the export yields nothing", async () => {
    const { exec } = fakeExec();
    await expect(
      prepareOne(photo({ uuid: "uuid-x" }), setup(), { exec, exportFn: async () => [] }),
    ).rejects.toThrow("uuid-x");
  });

  test("propagates a failure from the prepare step", async () => {
    const { exec } = fakeExec({ failOn: "magick" });
    await expect(
      prepareOne(photo(), setup(), { exec, exportFn: async (_p, dir) => [join(dir, "x.heic")] }),
    ).rejects.toThrow("magick blew up");
  });

  test("cleans up its export folder, even when prepare fails", async () => {
    const seen: string[] = [];
    const exportFn = async (_p: Photo, dir: string) => {
      seen.push(dir);
      writeFileSync(join(dir, "x.heic"), "x");
      return [join(dir, "x.heic")];
    };
    await prepareOne(photo(), setup(), { exec: fakeExec().exec, exportFn });
    await prepareOne(photo(), setup(), {
      exec: fakeExec({ failOn: "magick" }).exec,
      exportFn,
    }).catch(() => {});
    expect(seen).toHaveLength(2);
    for (const dir of seen) expect(existsSync(dir)).toBe(false);
  });
});
