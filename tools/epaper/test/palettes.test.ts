import { describe, expect, test } from "bun:test";
import { listProfiles, loadProfile } from "../src/profile.ts";

const hasMagick = Bun.which("magick") !== null;
const maybe = hasMagick ? test : test.skip;

const SIX = ["#000000", "#0000FF", "#00FF00", "#FF0000", "#FFFF00", "#FFFFFF"];
const ORANGE = "#FF8000";

async function magick(...args: string[]): Promise<string> {
  const proc = Bun.spawn(["magick", ...args], { stdout: "pipe", stderr: "pipe" });
  const text = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) throw new Error(await new Response(proc.stderr).text());
  return text;
}

async function coloursOf(path: string): Promise<string[]> {
  const out = await magick(path, "-format", "%c", "histogram:info:");
  const found = out
    .split("\n")
    .filter((line) => line.includes("#"))
    .map((line) =>
      `#${(line.split("#").at(-1) ?? "").trim().split(/\s+/)[0]?.slice(0, 6)}`.toUpperCase(),
    );
  return found.sort();
}

describe("palette golden files hold exactly the panel colours", () => {
  maybe("spectra6 palette has exactly the six Spectra 6 colours", async () => {
    expect(await coloursOf(loadProfile("spectra6-133").palette)).toEqual([...SIX].sort());
  });

  maybe("acep7 palette is the six plus orange", async () => {
    expect(await coloursOf(loadProfile("acep565").palette)).toEqual([...SIX, ORANGE].sort());
  });

  maybe("palettes are N x 1 strips with one pixel per colour", async () => {
    for (const id of listProfiles()) {
      const p = loadProfile(id);
      expect(await magick("identify", "-format", "%wx%h", p.palette)).toBe(`${p.colours}x1`);
    }
  });
});
