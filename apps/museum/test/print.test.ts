import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Exec, repoRoot, UsageError } from "@frame/cli";
import { compose, printMain, render, sanitise } from "../src/print.ts";
import { hasMagick, magick, size, trimSize, uniqueColours } from "./magick.ts";

const PALETTE = join(repoRoot(), "packages", "epaper", "palette-spectra6.png");
const real = hasMagick ? test : test.skip;

function tempDir() {
  return mkdtempSync(join(tmpdir(), "print-"));
}

function recorder() {
  const calls: string[][] = [];
  const exec: Exec = async (argv) => {
    calls.push(argv);
    return { code: 0, stdout: "", stderr: "" };
  };
  return { calls, exec };
}

describe("sanitise", () => {
  test("keeps device-safe characters", () => {
    expect(sanitise("RP-P-1956-733")).toBe("RP-P-1956-733");
  });

  test("replaces everything else with an underscore", () => {
    expect(sanitise("a/b c")).toBe("a_b_c");
    expect(sanitise(`x,"y"[z]`)).toBe("x__y__z_");
  });
});

describe("compose", () => {
  test("fits the source into the full 1600x1200 canvas", async () => {
    const { calls, exec } = recorder();
    await compose("/in/src.png", "/out/composed.png", exec);
    expect(calls).toHaveLength(1);
    const call = calls[0] ?? [];
    expect(call[call.indexOf("-resize") + 1]).toBe("1600x1200");
    expect(call[call.indexOf("-extent") + 1]).toBe("1600x1200");
    expect(call.at(-1)).toBe("/out/composed.png");
  });
});

describe("render", () => {
  test("composes, then prepares through the art profile", async () => {
    const dir = tempDir();
    const out = join(dir, "RP-X.png");
    const prepared: string[][] = [];

    await render(join(dir, "source.png"), out, {
      exec: recorder().exec,
      prepare: async (composed, output) => {
        prepared.push([composed, output]);
      },
    });

    expect(prepared).toEqual([[join(dir, "RP-X.composed.png"), out]]);
  });

  test("the default prepare runs magick with the spectra6-133-art profile", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "s.png"), "x");
    const { calls, exec } = recorder();
    await render(join(dir, "s.png"), join(dir, "o.png"), { exec });
    const prepareCall = calls.find((c) => c.includes("-remap"));
    expect(prepareCall?.[prepareCall.indexOf("-remap") + 1]).toBe(PALETTE);
    expect(prepareCall).toContain("1600x1200^");
    expect(prepareCall?.at(-1)).toBe(join(dir, "o.png"));
  });
});

describe("print CLI", () => {
  test("needs image and out", async () => {
    await expect(printMain(["a.png"], { exec: recorder().exec, out: () => {} })).rejects.toThrow(
      UsageError,
    );
  });

  test("prints where it wrote", async () => {
    const lines: string[] = [];
    const out = join(tempDir(), "o.png");
    await printMain(["s.png", out], {
      exec: recorder().exec,
      out: (l) => lines.push(l),
      prepare: async () => {},
    });
    expect(lines).toEqual([`wrote ${out}`]);
  });
});

describe("with real ImageMagick", () => {
  real("compose fits a tall source without cropping", async () => {
    const dir = tempDir();
    const source = join(dir, "tall.png");
    await magick("-size", "400x800", "xc:black", source);
    const out = join(dir, "composed.png");
    await compose(source, out);
    expect(await size(out)).toEqual([1600, 1200]);
    expect(await trimSize(out)).toEqual([600, 1200]);
  });

  real("compose fits a wide source without cropping", async () => {
    const dir = tempDir();
    const source = join(dir, "wide.png");
    await magick("-size", "800x400", "xc:black", source);
    const out = join(dir, "composed.png");
    await compose(source, out);
    expect(await size(out)).toEqual([1600, 1200]);
    expect(await trimSize(out)).toEqual([1600, 800]);
  });

  real("a full render uses only palette colours at the panel size", async () => {
    const dir = tempDir();
    const source = join(dir, "source.png");
    await magick("-size", "800x600", "xc:red", source);
    const out = join(dir, "out.png");
    await render(source, out);
    expect(await size(out)).toEqual([1600, 1200]);
    const palette = await uniqueColours(PALETTE);
    for (const colour of await uniqueColours(out)) expect(palette.has(colour)).toBe(true);
    expect(existsSync(join(dir, "out.composed.png"))).toBe(false);
    expect(readFileSync(out).length).toBeGreaterThan(0);
  });
});
