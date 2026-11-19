import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { UsageError } from "@frame/cli";
import { defaultProfileId, listProfiles, loadProfile, profileMain } from "../src/profile.ts";

async function cli(...argv: string[]) {
  const lines: string[] = [];
  const code = await profileMain(argv, (line) => lines.push(line));
  return { code, text: lines.join("\n") };
}

describe("profiles table", () => {
  test("the default profile is acep565 so the deployed 5.65in frame keeps working", () => {
    expect(defaultProfileId()).toBe("acep565");
    expect(loadProfile(undefined, { env: {} }).id).toBe("acep565");
  });

  test("lists exactly the known profiles, sorted", () => {
    expect(listProfiles()).toEqual(["acep565", "spectra6-133", "spectra6-133-art"]);
  });

  test("acep565 geometry and Home Assistant dir", () => {
    const p = loadProfile("acep565");
    expect([p.width, p.height]).toEqual([600, 448]);
    expect(p.colours).toBe(7);
    expect(p.haDir).toBe("local/epaper");
    expect(p.palette.endsWith("palette-acep7.png")).toBe(true);
  });

  test("spectra6 is landscape with its own Home Assistant dir", () => {
    const p = loadProfile("spectra6-133");
    expect([p.width, p.height]).toEqual([1600, 1200]);
    expect(p.colours).toBe(6);
    expect(p.haDir).toBe("local/epaper13");
    expect(p.palette.endsWith("palette-spectra6.png")).toBe(true);
  });

  test("art profile shares the panel and palette but has its own artwork folder", () => {
    const art = loadProfile("spectra6-133-art");
    const photo = loadProfile("spectra6-133");
    expect([art.width, art.height]).toEqual([photo.width, photo.height]);
    expect(art.palette).toBe(photo.palette);
    expect(art.artwork.endsWith("www/epaper13-modes/art")).toBe(true);
    expect(art.artwork).not.toBe(photo.artwork);
  });

  test("artwork dirs and palettes resolve to absolute paths", () => {
    const acep = loadProfile("acep565");
    const spectra = loadProfile("spectra6-133");
    expect(isAbsolute(acep.artwork)).toBe(true);
    expect(isAbsolute(acep.palette)).toBe(true);
    expect(acep.artwork).not.toBe(spectra.artwork);
  });

  test("every profile palette file exists", async () => {
    for (const id of listProfiles()) {
      expect(await Bun.file(loadProfile(id).palette).exists()).toBe(true);
    }
  });

  test("acep565 uses magick with no pre-filter", () => {
    const p = loadProfile("acep565");
    expect(p.backend).toBe("magick");
    expect(p.preFilter).toEqual([]);
  });

  test("spectra6 uses magick with the colour pre-filter as separate argv tokens", () => {
    const p = loadProfile("spectra6-133");
    expect(p.backend).toBe("magick");
    expect(p.preFilter).toEqual(["-modulate", "95,160", "-sigmoidal-contrast", "4,50%"]);
  });

  test("dither defaults come from the profile", () => {
    expect(loadProfile("acep565").dither).toBe("FloydSteinberg");
  });
});

describe("loadProfile selection", () => {
  test("an unknown profile fails with a UsageError naming the known ids", () => {
    expect(() => loadProfile("no-such-panel")).toThrow(UsageError);
    expect(() => loadProfile("no-such-panel")).toThrow("spectra6-133");
  });

  test("EPAPER_PROFILE picks the profile when none is named", () => {
    expect(loadProfile(undefined, { env: { EPAPER_PROFILE: "spectra6-133" } }).id).toBe(
      "spectra6-133",
    );
  });

  test("an explicit id wins over EPAPER_PROFILE", () => {
    expect(loadProfile("acep565", { env: { EPAPER_PROFILE: "spectra6-133" } }).id).toBe("acep565");
  });

  test("rejects a dither method the pipeline does not know", () => {
    const dir = mkdtempSync(join(tmpdir(), "profiles-"));
    const file = join(dir, "profiles.json");
    writeFileSync(
      file,
      JSON.stringify({
        default: "x",
        profiles: {
          x: {
            description: "d",
            width: 1,
            height: 1,
            colours: 6,
            palette: "p.png",
            artwork: "a",
            ha_dir: "h",
            backend: "magick",
            pre_filter: "",
            dither: "Sparkle",
          },
        },
      }),
    );
    expect(() => loadProfile("x", { file })).toThrow(UsageError);
  });
});

describe("profile CLI (same output as device_profile.py)", () => {
  test("--default prints the default id", async () => {
    expect(await cli("--default")).toEqual({ code: 0, text: "acep565" });
  });

  test("--list prints every id, sorted, one per line", async () => {
    expect((await cli("--list")).text).toBe("acep565\nspectra6-133\nspectra6-133-art");
  });

  test("<id> prints the id after validating it", async () => {
    expect((await cli("spectra6-133")).text).toBe("spectra6-133");
  });

  test("<id> <field> prints the raw profiles.json value", async () => {
    expect((await cli("spectra6-133", "width")).text).toBe("1600");
    expect((await cli("acep565", "palette")).text).toBe("palette-acep7.png");
    expect((await cli("acep565", "ha_dir")).text).toBe("local/epaper");
    expect((await cli("spectra6-133", "pre_filter")).text).toBe(
      "-modulate 95,160 -sigmoidal-contrast 4,50%",
    );
  });

  test("--artwork and --palette print absolute paths", async () => {
    expect(isAbsolute((await cli("acep565", "--artwork")).text)).toBe(true);
    expect(
      (await cli("acep565", "--palette")).text.endsWith("tools/epaper/palette-acep7.png"),
    ).toBe(true);
  });

  test("--json prints id plus the raw profile with sorted keys and ASCII escapes", async () => {
    const { text } = await cli("spectra6-133-art", "--json");
    const parsed = JSON.parse(text);
    expect(parsed.id).toBe("spectra6-133-art");
    expect(Object.keys(parsed)).toEqual(Object.keys(parsed).sort());
    expect(text).toContain("\\u2014");
    expect(text).not.toContain("\u2014");
    expect(text.split("\n")[1]).toMatch(/^ {2}"/);
  });

  test("an unknown field is a usage error", async () => {
    await expect(cli("acep565", "nope")).rejects.toThrow(UsageError);
  });

  test("with no arguments prints the default profile id", async () => {
    expect((await cli()).text).toBe("acep565");
  });
});
