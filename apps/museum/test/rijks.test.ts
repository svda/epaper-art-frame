import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Fetch, type Print, resolve, rightsOf, type Skip, setMembers } from "../src/rijks.ts";

const FIXTURES = join(import.meta.dir, "fixtures");

interface Recorded {
  search: Record<string, unknown>;
  object: { id: string } & Record<string, unknown>;
  visual: { id: string } & Record<string, unknown>;
  digital: { id: string } & Record<string, unknown>;
  info: Record<string, unknown>;
}

function recorded(objectNumber: string): Recorded {
  return JSON.parse(readFileSync(join(FIXTURES, `${objectNumber}.json`), "utf8"));
}

function fixtureFetch(objectNumber: string) {
  const data = recorded(objectNumber);
  const calls: string[] = [];
  const fetch: Fetch = async (url) => {
    calls.push(url);
    if (url.includes("/search/collection?")) return data.search;
    if (url === data.object.id) return data.object;
    if (url === data.visual.id) return data.visual;
    if (url === data.digital.id) return data.digital;
    if (url.endsWith("/info.json")) return data.info;
    throw new Error(`unexpected url: ${url}`);
  };
  return { fetch, calls };
}

function asPrint(result: Print | Skip): Print {
  if (!("title" in result)) throw new Error(`expected a Print, got skip: ${result.reason}`);
  return result;
}

describe("resolve", () => {
  test("a print resolves with metadata", async () => {
    const { fetch } = fixtureFetch("RP-P-1956-733");
    const result = asPrint(await resolve("RP-P-1956-733", fetch));

    expect(result.objectNumber).toBe("RP-P-1956-733");
    expect(result.title).toBe("Under the Wave off Kanagawa");
    expect(result.artist).toBe("Katsushika Hokusai");
    expect(result.date).toBe("1829 - 1833");
    expect(result.rights).toBe("PD");
    expect(result.type).toBe("print");
    expect([result.width, result.height]).toEqual([5706, 3896]);
    expect(result.imageUrl.startsWith("https://iiif.micr.io/")).toBe(true);
    expect(result.imageUrl.endsWith("/full/!1600,1600/0/default.jpg")).toBe(true);
  });

  test("a painting resolves", async () => {
    const { fetch } = fixtureFetch("SK-A-3089");
    const result = asPrint(await resolve("SK-A-3089", fetch));
    expect(result.title).toBe("Cat at Play");
    expect(result.artist).toBe("Henriëtte Ronner");
    expect(result.type).toBe("painting");
    expect(result.rights).toBe("PD");
  });

  test("a photograph resolves", async () => {
    const { fetch } = fixtureFetch("RP-F-00-630");
    const result = asPrint(await resolve("RP-F-00-630", fetch));
    expect(result.artist).toBe("George Hendrik Breitner");
    expect(result.type).toBe("photograph");
    expect(result.rights).toBe("PD");
  });

  test("a drawing resolves", async () => {
    const { fetch } = fixtureFetch("RP-T-1921-120");
    const result = asPrint(await resolve("RP-T-1921-120", fetch));
    expect(result.title).toBe("Het Armenhuis te Rotterdam");
    expect(result.type).toBe("drawing");
    expect(result.rights).toBe("PD");
  });

  test("the rights label reports the object's own term when it is not public domain", () => {
    expect(rightsOf(recorded("RP-F-F02993").visual)).toBe("Copyright");
  });

  test("an ambiguous object number shared by many objects is skipped without fetching any", async () => {
    const { fetch, calls } = fixtureFetch("RP-F-2019-299-6-6");
    const result = await resolve("RP-F-2019-299-6-6", fetch);
    expect(result).toEqual({ objectNumber: "RP-F-2019-299-6-6", reason: "ambiguous" });
    expect(calls).toHaveLength(1);
  });

  test("an unknown object number is skipped as not-found", async () => {
    const { fetch } = fixtureFetch("XX-000-000");
    expect(await resolve("XX-000-000", fetch)).toEqual({
      objectNumber: "XX-000-000",
      reason: "not-found",
    });
  });

  test("a missing info.json is skipped, not crashed", async () => {
    const { fetch } = fixtureFetch("RP-P-1956-733");
    const broken: Fetch = async (url) => (url.endsWith("/info.json") ? {} : fetch(url));
    expect(await resolve("RP-P-1956-733", broken)).toEqual({
      objectNumber: "RP-P-1956-733",
      reason: "no-image",
    });
  });

  test("metadata falls back when fields are missing", async () => {
    const { fetch } = fixtureFetch("RP-P-1956-733");
    const data = recorded("RP-P-1956-733");
    const bare = {
      id: data.object.id,
      type: "HumanMadeObject",
      classified_as: [],
      shows: data.object.shows,
    };
    const fetchBare: Fetch = async (url) => (url === data.object.id ? bare : fetch(url));

    const result = asPrint(await resolve("RP-P-1956-733", fetchBare));
    expect(result.title).toBe("Untitled");
    expect(result.artist).toBe("Anonymous");
    expect(result.date).toBe("");
    expect(result.type).toBe("unknown");
  });

  test("a few prefix matches are disambiguated by the record's own identifier", async () => {
    const fetch: Fetch = async (url) => {
      if (url.includes("/search/collection?")) {
        return { orderedItems: [{ id: "obj1" }, { id: "obj2" }] };
      }
      if (url === "obj1") {
        return {
          id: "obj1",
          identified_by: [
            { type: "Identifier", content: "SK-A-400" },
            { type: "Name", content: "Wrong" },
          ],
          shows: [{ id: "vis1" }],
        };
      }
      if (url === "obj2") {
        return {
          id: "obj2",
          identified_by: [
            { type: "Identifier", content: "SK-A-4" },
            { type: "Name", content: "Right" },
          ],
          shows: [{ id: "vis2" }],
        };
      }
      if (url === "vis2") {
        return {
          subject_to: [
            { classified_as: [{ id: "https://creativecommons.org/publicdomain/mark/1.0/" }] },
          ],
          digitally_shown_by: [{ id: "dig2" }],
        };
      }
      if (url === "dig2") {
        return { access_point: [{ id: "https://iiif.micr.io/x/full/max/0/default.jpg" }] };
      }
      if (url.endsWith("/info.json")) return { width: 100, height: 50 };
      throw new Error(`unexpected url: ${url}`);
    };

    expect(asPrint(await resolve("SK-A-4", fetch)).title).toBe("Right");
  });

  test("a prefix match whose records never carry the number stays ambiguous", async () => {
    const fetch: Fetch = async (url) => {
      if (url.includes("/search/collection?")) {
        return { orderedItems: [{ id: "a" }, { id: "b" }] };
      }
      return { id: url, identified_by: [{ type: "Identifier", content: "SK-A-400" }] };
    };
    expect(await resolve("SK-A-4", fetch)).toEqual({ objectNumber: "SK-A-4", reason: "ambiguous" });
  });

  test("the search url carries the object number as a query parameter", async () => {
    const urls: string[] = [];
    const fetch: Fetch = async (url) => {
      urls.push(url);
      return { orderedItems: [] };
    };
    await resolve("SK-A-3089", fetch);
    expect(urls).toEqual(["https://data.rijksmuseum.nl/search/collection?objectNumber=SK-A-3089"]);
  });
});

describe("setMembers", () => {
  test("returns object numbers in order, without repeats", async () => {
    const html =
      '"UserSetObjectApiModel","id","node","De Yodo rivier in maanlicht",' +
      '"RP-P-1912-609","SK-A-3089","RP-P-1912-609"';
    expect(await setMembers("epaper--abc", "nl", async () => html)).toEqual([
      "RP-P-1912-609",
      "SK-A-3089",
    ]);
  });

  test("builds the set page url from the culture and set id", async () => {
    const urls: string[] = [];
    await setMembers("epaper--abc", "en", async (url) => {
      urls.push(url);
      return '"SK-A-1"';
    });
    expect(urls).toEqual(["https://www.rijksmuseum.nl/en/collectie/verzameling/epaper--abc"]);
  });

  test("an empty set is fatal", async () => {
    await expect(setMembers("epaper--abc", "nl", async () => "<html></html>")).rejects.toThrow(
      "Rijksstudio set 'epaper--abc' is empty or not found",
    );
  });
});
