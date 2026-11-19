// Record Linked Art fixtures for the resolver tests.
//
// Run from the repo root:
//
//   bun tools/museum/test/record-fixtures.ts [OUT_DIR]
//
// Writes one JSON file per object number (default: test/fixtures/). The tests never touch the
// network; re-run this only when the API shape changes.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { escapeNonAscii } from "@frame/epaper";

const HEADERS = { "User-Agent": "epaper-art-frame/print-wall", Accept: "application/json" };

const OBJECT_NUMBERS = [
  "RP-P-1956-733", // print, PD, landscape
  "SK-A-3089", // painting, PD, landscape
  "RP-F-00-630", // photograph, PD, landscape
  "RP-T-1921-120", // drawing, PD, landscape
  "RP-P-RMA1442", // poster, PD, portrait
  "RP-F-F02993", // photograph, In Copyright, unique number
  "RP-F-2019-299-6-6", // ambiguous: 166 objects share this prefix
  "XX-000-000", // unknown
];

type Rec = Record<string, unknown>;

async function get(url: string): Promise<Rec> {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

const first = (value: unknown): Rec => (Array.isArray(value) ? (value[0] ?? {}) : {}) as Rec;

export async function record(objectNumber: string): Promise<Rec> {
  const query = new URLSearchParams({ objectNumber }).toString();
  const search = await get(`https://data.rijksmuseum.nl/search/collection?${query}`);
  const out: Rec = { object_number: objectNumber, search };
  const ids = (Array.isArray(search.orderedItems) ? search.orderedItems : []).map(
    (item: Rec) => item.id as string,
  );
  if (ids.length === 0) return out;
  const object = await get(ids[0] as string);
  out.object = object;
  const shows = first(object.shows).id as string | undefined;
  if (!shows) return out;
  const visual = await get(shows);
  out.visual = visual;
  const digitalId = first(visual.digitally_shown_by).id as string | undefined;
  if (!digitalId) return out;
  const digital = await get(digitalId);
  out.digital = digital;
  const access = first(digital.access_point).id as string | undefined;
  if (access) out.info = await get(`${access.split("/full/")[0]}/info.json`);
  return out;
}

async function main() {
  const outDir = process.argv[2] ?? join(import.meta.dir, "fixtures");
  mkdirSync(outDir, { recursive: true });
  for (const number of OBJECT_NUMBERS) {
    const name = `${number.replaceAll("/", "_")}.json`;
    writeFileSync(
      join(outDir, name),
      `${escapeNonAscii(JSON.stringify(await record(number), null, 2))}\n`,
    );
    console.log(`wrote ${name}`);
    await Bun.sleep(400);
  }
}

if (import.meta.main) await main();
