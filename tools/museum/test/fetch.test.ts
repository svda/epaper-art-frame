import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Fetcher, HttpError } from "../src/fetcher.ts";

function makeFetcher(
  respond: (url: string, init: { headers: Record<string, string> }) => Response,
  opts: { refresh?: boolean } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "rijks-cache-"));
  const urls: string[] = [];
  const sleeps: number[] = [];
  let now = 0;
  const fetcher = new Fetcher(dir, {
    refresh: opts.refresh,
    fetchImpl: async (url, init) => {
      urls.push(url);
      return respond(url, init);
    },
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    clock: () => now,
  });
  return { fetcher, dir, urls, sleeps };
}

const json = (body: string) => new Response(body, { status: 200 });

describe("Fetcher", () => {
  test("a cache hit makes no request", async () => {
    const { fetcher, urls } = makeFetcher(() => json('{"ok": true}'));
    expect(await fetcher.getJson("https://example.test/x")).toEqual({ ok: true });
    expect(await fetcher.getJson("https://example.test/x")).toEqual({ ok: true });
    expect(urls).toHaveLength(1);
  });

  test("the cache file name is the sha256 of the url, so existing caches stay valid", async () => {
    const { fetcher, dir } = makeFetcher(() => json("{}"));
    await fetcher.getJson("https://example.test/x");
    const digest = new Bun.CryptoHasher("sha256").update("https://example.test/x").digest("hex");
    expect(existsSync(join(dir, "json", `${digest}.json`))).toBe(true);
  });

  test("reads a cache entry written by the Python tool", async () => {
    const { fetcher, dir, urls } = makeFetcher(() => json('{"live": true}'));
    const digest = new Bun.CryptoHasher("sha256").update("https://example.test/py").digest("hex");
    await Bun.write(join(dir, "json", `${digest}.json`), '{"cached": "\\u00e9"}');
    expect(await fetcher.getJson("https://example.test/py")).toEqual({ cached: "é" });
    expect(urls).toHaveLength(0);
  });

  test("text is always fetched live but still written to the cache", async () => {
    const { fetcher, dir, urls } = makeFetcher(() => json("<html></html>"));
    await fetcher.getText("https://example.test/set");
    await fetcher.getText("https://example.test/set");
    expect(urls).toHaveLength(2);
    const digest = new Bun.CryptoHasher("sha256").update("https://example.test/set").digest("hex");
    expect(readFileSync(join(dir, "text", `${digest}.html`), "utf8")).toBe("<html></html>");
  });

  test("refresh bypasses the cache", async () => {
    const { fetcher, urls } = makeFetcher(() => json('{"ok": true}'), { refresh: true });
    await fetcher.getJson("https://example.test/x");
    await fetcher.getJson("https://example.test/x");
    expect(urls).toHaveLength(2);
  });

  test("retries on 429 with backoff, then succeeds", async () => {
    let n = 0;
    const { fetcher, urls, sleeps } = makeFetcher(() =>
      ++n < 3 ? new Response("slow down", { status: 429 }) : json('{"ok": true}'),
    );
    expect(await fetcher.getJson("https://example.test/x")).toEqual({ ok: true });
    expect(urls).toHaveLength(3);
    expect(sleeps.filter((ms) => ms >= 500)).toEqual([500, 1000]);
  });

  test("retries on a 5xx", async () => {
    let n = 0;
    const { fetcher, urls } = makeFetcher(() =>
      ++n < 2 ? new Response("boom", { status: 503 }) : json("{}"),
    );
    await fetcher.getJson("https://example.test/x");
    expect(urls).toHaveLength(2);
  });

  test("gives up after the configured retries and throws the last HttpError", async () => {
    const { fetcher, urls } = makeFetcher(() => new Response("no", { status: 500 }));
    await expect(fetcher.getJson("https://example.test/x")).rejects.toThrow(HttpError);
    expect(urls).toHaveLength(4);
  });

  test("a 404 is not retried", async () => {
    const { fetcher, urls } = makeFetcher(() => new Response("nope", { status: 404 }));
    await expect(fetcher.getJson("https://example.test/x")).rejects.toThrow(HttpError);
    expect(urls).toHaveLength(1);
  });

  test("requests are spaced at least 250 ms apart", async () => {
    const { fetcher, sleeps } = makeFetcher(() => json("{}"));
    await fetcher.getJson("https://example.test/a");
    await fetcher.getJson("https://example.test/b");
    expect(sleeps.at(-1)).toBeGreaterThanOrEqual(250);
  });

  test("sends the polite User-Agent and Accept headers", async () => {
    let seen: Record<string, string> = {};
    const { fetcher } = makeFetcher((_url, init) => {
      seen = init.headers;
      return json("{}");
    });
    await fetcher.getJson("https://example.test/x");
    expect(seen["User-Agent"]).toBe("epaper-art-frame/print-wall");
    expect(seen.Accept).toBe("application/json");
  });

  test("download caches the body and copies it to each destination", async () => {
    const { fetcher, dir, urls } = makeFetcher(() => new Response("image-bytes"));
    const first = join(dir, "out", "a.jpg");
    const second = join(dir, "out", "b.jpg");
    await fetcher.download("https://example.test/img", first);
    await fetcher.download("https://example.test/img", second);
    expect(readFileSync(first, "utf8")).toBe("image-bytes");
    expect(readFileSync(second, "utf8")).toBe("image-bytes");
    expect(urls).toHaveLength(1);
  });
});
