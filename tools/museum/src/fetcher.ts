import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Rec } from "./rijks.ts";

const HEADERS = {
  "User-Agent": "epaper-art-frame/print-wall",
  Accept: "application/json",
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

export type FetchImpl = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<Response>;

export interface FetcherOptions {
  refresh?: boolean;
  fetchImpl?: FetchImpl;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
  minIntervalMs?: number;
  retries?: number;
}

function writeFile(path: string, data: string | Uint8Array) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

// HTTP with a disk cache, polite spacing, and retry on 429/5xx. The cache layout matches the
// Python tool's, so an existing .cache/ stays valid.
export class Fetcher {
  private readonly refresh: boolean;
  private readonly fetchImpl: FetchImpl;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly clock: () => number;
  private readonly minIntervalMs: number;
  private readonly retries: number;
  private last: number | undefined;

  constructor(
    private readonly cacheDir: string,
    opts: FetcherOptions = {},
  ) {
    this.refresh = opts.refresh ?? false;
    this.fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
    this.sleep = opts.sleep ?? ((ms) => Bun.sleep(ms));
    this.clock = opts.clock ?? (() => performance.now());
    this.minIntervalMs = opts.minIntervalMs ?? 250;
    this.retries = opts.retries ?? 3;
  }

  private cachePath(url: string, kind: string, suffix: string): string {
    const digest = createHash("sha256").update(url, "utf8").digest("hex");
    return join(this.cacheDir, kind, `${digest}.${suffix}`);
  }

  private async throttle(): Promise<void> {
    if (this.last !== undefined) {
      const wait = this.minIntervalMs - (this.clock() - this.last);
      if (wait > 0) await this.sleep(wait);
    }
    this.last = this.clock();
  }

  private async request(url: string): Promise<Uint8Array> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      const response = await this.fetchImpl(url, { headers: HEADERS });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
      const retryable =
        response.status === 429 || (response.status >= 500 && response.status < 600);
      if (!retryable || attempt >= this.retries) throw new HttpError(response.status, url);
      await this.sleep(500 * 2 ** attempt);
    }
  }

  async getJson(url: string): Promise<Rec> {
    const path = this.cachePath(url, "json", "json");
    if (existsSync(path) && !this.refresh) return JSON.parse(readFileSync(path, "utf8"));
    const data = JSON.parse(new TextDecoder().decode(await this.request(url)));
    writeFile(path, JSON.stringify(data));
    return data;
  }

  // Always live. The only text fetch is a Rijksstudio set page, and the point of running the sync
  // is to pick up changes to the set: a cached page turns "add objects, run the sync" into a
  // silent no-op. The body is still written to the cache for inspection.
  async getText(url: string): Promise<string> {
    const body = new TextDecoder().decode(await this.request(url));
    writeFile(this.cachePath(url, "text", "html"), body);
    return body;
  }

  async download(url: string, dest: string): Promise<string> {
    const path = this.cachePath(url, "images", "bin");
    let body: Uint8Array;
    if (existsSync(path) && !this.refresh) {
      body = readFileSync(path);
    } else {
      body = await this.request(url);
      writeFile(path, body);
    }
    writeFile(dest, body);
    return dest;
  }
}
