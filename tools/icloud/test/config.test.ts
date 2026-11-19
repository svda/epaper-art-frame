import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { UsageError } from "@frame/cli";
import { type CliArgs, type Config, preflight, resolveConfig } from "../src/sync-album.ts";

const DEFAULT_ARTWORK = "/repo/www/epaper";

function resolve(
  over: { env?: Record<string, string>; envFile?: Record<string, string> } & CliArgs = {},
): Config {
  const { env = {}, envFile = {}, ...cli } = over;
  return resolveConfig(cli, env, envFile, DEFAULT_ARTWORK);
}

describe("resolveConfig", () => {
  test("defaults when nothing is set", () => {
    expect(resolve()).toEqual({
      artworkDir: DEFAULT_ARTWORK,
      dest: undefined,
      library: undefined,
      album: undefined,
      intervalH: 6,
      dryRun: false,
      profile: undefined,
    });
  });

  test("the environment overrides the default", () => {
    const cfg = resolve({ env: { ALBUM: "epaper art frame", EPAPER_DEST: "ha:/cfg/www/epaper" } });
    expect(cfg.album).toBe("epaper art frame");
    expect(cfg.dest).toBe("ha:/cfg/www/epaper");
  });

  test("the env file is used when the environment is silent", () => {
    const cfg = resolve({ envFile: { ALBUM: "Trips", PHOTOS_LIBRARY: "/lib.photoslibrary" } });
    expect(cfg.album).toBe("Trips");
    expect(cfg.library).toBe("/lib.photoslibrary");
  });

  test("the environment beats the env file", () => {
    expect(resolve({ env: { ALBUM: "A" }, envFile: { ALBUM: "B" } }).album).toBe("A");
  });

  test("the command line beats the environment and the env file", () => {
    expect(resolve({ env: { ALBUM: "A" }, envFile: { ALBUM: "B" }, album: "C" }).album).toBe("C");
  });

  test("an invalid interval is a clear error naming the setting", () => {
    expect(() => resolve({ env: { SYNC_INTERVAL_H: "not-a-number" } })).toThrow(UsageError);
    expect(() => resolve({ env: { SYNC_INTERVAL_H: "not-a-number" } })).toThrow("SYNC_INTERVAL_H");
  });

  test("a non-integer interval is rejected too", () => {
    expect(() => resolve({ env: { SYNC_INTERVAL_H: "1.5" } })).toThrow("SYNC_INTERVAL_H");
  });

  test("an interval from the env file is read", () => {
    expect(resolve({ envFile: { SYNC_INTERVAL_H: " 12 " } }).intervalH).toBe(12);
  });

  test("the artwork folder can be overridden by the environment", () => {
    expect(resolve({ env: { EPAPER_IMAGES: "/tmp/art" } }).artworkDir).toBe("/tmp/art");
  });

  test("a profile selects its own artwork folder", () => {
    const cfg = resolve({ env: { EPAPER_PROFILE: "spectra6-133" } });
    expect(cfg.profile).toBe("spectra6-133");
    expect(cfg.artworkDir.endsWith("/www/epaper13")).toBe(true);
  });

  test("an explicit artwork folder still wins over the profile, which still picks the palette", () => {
    const cfg = resolve({ env: { EPAPER_PROFILE: "spectra6-133", EPAPER_IMAGES: "/tmp/art" } });
    expect(cfg.artworkDir).toBe("/tmp/art");
    expect(cfg.profile).toBe("spectra6-133");
  });

  test("an unknown profile is a clean error, so a typo cannot prepare for the wrong panel", () => {
    expect(() => resolve({ env: { EPAPER_PROFILE: "no-such-panel" } })).toThrow(UsageError);
    expect(() => resolve({ env: { EPAPER_PROFILE: "no-such-panel" } })).toThrow("no-such-panel");
  });

  test("an unknown profile is rejected even when an artwork folder is given", () => {
    expect(() => resolve({ profile: "typo", artworkDir: "/tmp/x" })).toThrow("typo");
  });

  test("~ in the artwork folder and the library expands to the home directory", () => {
    const cfg = resolve({ artworkDir: "~/art", library: "~/Pictures/L.photoslibrary" });
    expect(cfg.artworkDir).toBe(join(homedir(), "art"));
    expect(cfg.library).toBe(join(homedir(), "Pictures/L.photoslibrary"));
  });

  test("an empty EPAPER_IMAGES falls through to the profile or default folder", () => {
    expect(resolve({ env: { EPAPER_IMAGES: "" } }).artworkDir).toBe(DEFAULT_ARTWORK);
  });
});

describe("preflight", () => {
  test("reports each missing tool", () => {
    const missing = preflight(() => null);
    expect(missing.some((m) => m.includes("magick"))).toBe(true);
    expect(missing.some((m) => m.includes("scp"))).toBe(true);
    expect(missing.some((m) => m.includes("osascript"))).toBe(true);
  });

  test("is empty when everything is present", () => {
    expect(preflight((name) => `/usr/bin/${name}`)).toEqual([]);
  });
});
