import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  exec,
  HelpRequested,
  parseArgs,
  parseEnvFile,
  readEnvFile,
  repoRoot,
  runMain,
  runOrThrow,
  UsageError,
} from "../src/index.ts";

describe("parseEnvFile", () => {
  test("ignores comments and blanks, strips quotes and surrounding whitespace", () => {
    const parsed = parseEnvFile(
      [
        "# a comment",
        "",
        "ALBUM=epaper art frame",
        "EPAPER_DEST='ha:/cfg/www/epaper'",
        'PHOTOS_LIBRARY="/Users/x/Pictures/Photos Library.photoslibrary"',
        "  SPACED = value  ",
      ].join("\n"),
    );
    expect(parsed.ALBUM).toBe("epaper art frame");
    expect(parsed.EPAPER_DEST).toBe("ha:/cfg/www/epaper");
    expect(parsed.PHOTOS_LIBRARY).toBe("/Users/x/Pictures/Photos Library.photoslibrary");
    expect(parsed.SPACED).toBe("value");
    expect(Object.keys(parsed)).not.toContain("# a comment");
  });

  test("skips lines without an equals sign", () => {
    expect(parseEnvFile("JUSTWORDS\nA=1")).toEqual({ A: "1" });
  });

  test("keeps everything after the first equals sign in the value", () => {
    expect(parseEnvFile("URL=a=b")).toEqual({ URL: "a=b" });
  });

  test("leaves mismatched quotes alone", () => {
    expect(parseEnvFile(`A="x'`)).toEqual({ A: `"x'` });
  });
});

describe("readEnvFile", () => {
  test("returns an empty object for a missing file", () => {
    expect(readEnvFile(join(tmpdir(), "does-not-exist.env"))).toEqual({});
  });

  test("parses an existing file", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-env-"));
    const file = join(dir, ".env");
    writeFileSync(file, "A=1\n");
    expect(readEnvFile(file)).toEqual({ A: "1" });
  });
});

describe("parseArgs", () => {
  const spec = {
    usage: "usage: tool [--fit] INPUT",
    options: { fit: { type: "boolean" as const } },
  };

  test("returns values and positionals", () => {
    const { values, positionals } = parseArgs(spec, ["--fit", "photo.jpg"]);
    expect(values.fit).toBe(true);
    expect(positionals).toEqual(["photo.jpg"]);
  });

  test("throws UsageError for an unknown flag", () => {
    expect(() => parseArgs(spec, ["--nope"])).toThrow(UsageError);
  });

  test("throws HelpRequested carrying the usage text for -h", () => {
    expect(() => parseArgs(spec, ["-h"])).toThrow(HelpRequested);
    try {
      parseArgs(spec, ["--help"]);
    } catch (error) {
      expect((error as HelpRequested).usage).toBe(spec.usage);
    }
  });
});

describe("runMain", () => {
  const quiet = { out: () => {}, err: () => {} };

  test("returns 0 when the function returns nothing", async () => {
    expect(await runMain(async () => {}, [], quiet)).toBe(0);
  });

  test("passes through a numeric exit code", async () => {
    expect(await runMain(async () => 7, [], quiet)).toBe(7);
  });

  test("maps UsageError to exit 2 and prints the message to stderr", async () => {
    const errors: string[] = [];
    const code = await runMain(
      async () => {
        throw new UsageError("bad flag");
      },
      [],
      { out: () => {}, err: (line) => errors.push(line) },
    );
    expect(code).toBe(2);
    expect(errors.join("")).toBe("error: bad flag\n");
  });

  test("maps other errors to exit 1", async () => {
    const code = await runMain(
      async () => {
        throw new Error("boom");
      },
      [],
      quiet,
    );
    expect(code).toBe(1);
  });

  test("prints usage to stdout and exits 0 on HelpRequested", async () => {
    const out: string[] = [];
    const code = await runMain(
      async () => {
        throw new HelpRequested("usage: tool");
      },
      [],
      { out: (line) => out.push(line), err: () => {} },
    );
    expect(code).toBe(0);
    expect(out.join("")).toContain("usage: tool");
  });
});

describe("repoRoot", () => {
  test("is the directory holding the workspace package.json, whatever the cwd", async () => {
    const pkg = await Bun.file(join(repoRoot(), "package.json")).json();
    expect(pkg.name).toBe("epaper-art-frame");
  });
});

describe("exec", () => {
  test("captures stdout and a zero exit code", async () => {
    const result = await exec(["echo", "hi"]);
    expect(result).toEqual({ code: 0, stdout: "hi\n", stderr: "" });
  });

  test("reports a non-zero exit code and stderr without throwing", async () => {
    const result = await exec(["sh", "-c", "echo oops >&2; exit 3"]);
    expect(result.code).toBe(3);
    expect(result.stderr).toBe("oops\n");
  });

  test("honours cwd and env", async () => {
    const result = await exec(["sh", "-c", "pwd; echo $FRAME_TEST"], {
      cwd: tmpdir(),
      env: { FRAME_TEST: "yes" },
    });
    expect(result.stdout).toContain("yes");
  });

  test("runOrThrow throws with stderr on a non-zero exit", async () => {
    await expect(runOrThrow(["sh", "-c", "echo bad >&2; exit 1"])).rejects.toThrow("bad");
  });
});
