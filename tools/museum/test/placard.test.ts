import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Exec, repoRoot, UsageError } from "@frame/cli";
import { compose, letter, placardMain, render, sanitise, truncate } from "../src/placard.ts";
import golden from "./golden/placard.json";
import { hasMagick, magick, size, trimSize, uniqueColours } from "./magick.ts";

const FONT = "/System/Library/Fonts/Supplemental/Georgia.ttf";
const PALETTE = join(repoRoot(), "tools", "epaper", "palette-spectra6.png");
const real = hasMagick && existsSync(FONT) ? test : test.skip;

function tempDir() {
  return mkdtempSync(join(tmpdir(), "placard-"));
}

function recorder() {
  const calls: string[][] = [];
  const exec: Exec = async (argv) => {
    calls.push(argv);
    return { code: 0, stdout: "10", stderr: "" };
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

describe("golden: magick argv matches placard.py", () => {
  const byName = (name: string): string[][] => {
    const found = golden.find((g) => g.name === name);
    if (!found) throw new Error(`no golden case ${name}`);
    return found.calls;
  };
  const drawing = (calls: string[][]) => calls.filter((c) => c.at(-1) !== "info:");

  test("compose", async () => {
    const { calls, exec } = recorder();
    await compose("/in/src.png", "/out/composed.png", exec);
    expect(calls).toEqual(byName("compose"));
  });

  test("compose derives its temp name by swapping only the last extension", async () => {
    const { calls, exec } = recorder();
    await compose("/o/RP-P-1956-733.composed.png", "/o/RP-P-1956-733.composed.png", exec);
    expect(calls).toEqual(byName("compose-nested-suffix"));
  });

  test("letter with a date", async () => {
    const { calls, exec } = recorder();
    await letter("/out/a.png", "Title", "Artist", "1890", {
      font: "/f/Georgia.ttf",
      out: "/out/b.png",
      exec,
    });
    expect(drawing(calls)).toEqual(byName("letter-with-date"));
  });

  test("letter without a date shows just the artist", async () => {
    const { calls, exec } = recorder();
    await letter("/out/a.png", "Title", "Artist", "", {
      font: "/f/Georgia.ttf",
      out: "/out/b.png",
      exec,
    });
    expect(drawing(calls)).toEqual(byName("letter-no-date"));
  });
});

describe("truncate", () => {
  const widthOf = async (text: string) => Array.from(text).length * 10;

  test("returns text that already fits unchanged", async () => {
    expect(await truncate("short", 100, widthOf)).toBe("short");
  });

  test("keeps the longest prefix that fits with the ellipsis", async () => {
    expect(await truncate("A".repeat(50), 100, widthOf)).toBe(`${"A".repeat(9)}…`);
  });

  test("counts code points, so an emoji is never split", async () => {
    const result = await truncate("😀".repeat(20), 50, widthOf);
    expect(result).toBe(`${"😀".repeat(4)}…`);
  });

  test("falls back to just the ellipsis when nothing else fits", async () => {
    expect(await truncate("A".repeat(50), 5, widthOf)).toBe("…");
  });
});

describe("render", () => {
  test("composes, then prepares through the art profile, then letters, in that order", async () => {
    const dir = tempDir();
    const source = join(dir, "source.png");
    const out = join(dir, "RP-X.png");
    const steps: string[] = [];
    const exec: Exec = async (argv) => {
      steps.push(
        argv.includes("-annotate") ? "letter" : argv.includes("-resize") ? "compose" : "other",
      );
      return { code: 0, stdout: "10", stderr: "" };
    };
    const prepared: string[][] = [];

    await render(source, "T", "A", "1890", out, {
      font: "/f.ttf",
      exec,
      prepare: async (composed, output) => {
        steps.push("prepare");
        prepared.push([composed, output]);
      },
    });

    expect(steps.filter((s) => s !== "other")).toEqual(["compose", "prepare", "letter"]);
    expect(prepared).toEqual([[join(dir, "RP-X.composed.png"), out]]);
  });

  test("the default prepare runs magick with the spectra6-133-art profile", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "s.png"), "x");
    const { calls, exec } = recorder();
    await render(join(dir, "s.png"), "T", "A", "", join(dir, "o.png"), { font: "/f.ttf", exec });
    const prepareCall = calls.find((c) => c.includes("-remap"));
    expect(prepareCall?.[prepareCall.indexOf("-remap") + 1]).toBe(PALETTE);
    expect(prepareCall).toContain("1600x1200^");
    expect(prepareCall?.at(-1)).toBe(join(dir, "o.png"));
  });

  test("PLACARD_FONT overrides the default font", async () => {
    const dir = tempDir();
    const { calls, exec } = recorder();
    await render(join(dir, "s.png"), "T", "A", "", join(dir, "o.png"), {
      exec,
      prepare: async () => {},
      env: { PLACARD_FONT: "/custom.ttf" },
    });
    const lettering = calls.find((c) => c.includes("-annotate"));
    expect(lettering?.[lettering.indexOf("-font") + 1]).toBe("/custom.ttf");
  });
});

describe("placard CLI", () => {
  test("needs image, title, artist, date and out", async () => {
    await expect(
      placardMain(["a.png", "T", "A"], { exec: recorder().exec, out: () => {} }),
    ).rejects.toThrow(UsageError);
  });

  test("prints where it wrote", async () => {
    const dir = tempDir();
    const lines: string[] = [];
    const out = join(dir, "o.png");
    await placardMain(["s.png", "T", "A", "1890", out], {
      exec: recorder().exec,
      out: (l) => lines.push(l),
      prepare: async () => {},
      env: { PLACARD_FONT: "/f.ttf" },
    });
    expect(lines).toEqual([`wrote ${out}`]);
  });
});

describe("with real ImageMagick and the Georgia font", () => {
  real("truncate adds an ellipsis to a very long title", async () => {
    const { fontWidth } = await import("../src/placard.ts");
    const result = await truncate("A".repeat(200), 1520, fontWidth(FONT, 40));
    expect(result.endsWith("…")).toBe(true);
    expect(Array.from(result).length).toBeLessThan(200);
  });

  real("compose fits a tall source without cropping", async () => {
    const dir = tempDir();
    const source = join(dir, "tall.png");
    await magick("-size", "400x800", "xc:black", source);
    const out = join(dir, "composed.png");
    await compose(source, out);
    expect(await size(out)).toEqual([1600, 1200]);
    expect(await trimSize(out)).toEqual([528, 1056]);
  });

  real("compose fits a wide source without cropping", async () => {
    const dir = tempDir();
    const source = join(dir, "wide.png");
    await magick("-size", "800x400", "xc:black", source);
    const out = join(dir, "composed.png");
    await compose(source, out);
    expect(await size(out)).toEqual([1600, 1200]);
    expect(await trimSize(out)).toEqual([1552, 776]);
  });

  real("the lettering strip is black text on white", async () => {
    const dir = tempDir();
    const base = join(dir, "base.png");
    await magick("-size", "1600x1200", "xc:white", base);
    const out = join(dir, "lettered.png");
    await letter(base, "Title", "Artist", "1890", { font: FONT, out });
    const strip = join(dir, "strip.png");
    await magick(out, "-crop", "1600x120+0+1080", "+repage", strip);
    expect([...(await uniqueColours(strip))].sort()).toEqual(["#000000", "#FFFFFF"]);
  });

  real("a full render uses only palette colours at the panel size", async () => {
    const dir = tempDir();
    const source = join(dir, "source.png");
    await magick("-size", "800x600", "xc:red", source);
    const out = join(dir, "out.png");
    await render(source, "Title", "Artist", "1890", out, { font: FONT });
    expect(await size(out)).toEqual([1600, 1200]);
    const palette = await uniqueColours(PALETTE);
    for (const colour of await uniqueColours(out)) expect(palette.has(colour)).toBe(true);
    expect(existsSync(join(dir, "out.composed.png"))).toBe(false);
    expect(readFileSync(out).length).toBeGreaterThan(0);
  });
});
