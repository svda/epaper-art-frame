import { UsageError } from "@frame/cli";

export type Rec = Record<string, unknown>;

const ENGLISH = "http://vocab.getty.edu/aat/300388277";
const NAME_TYPE = "http://vocab.getty.edu/aat/300435417";
const SEARCH_URL = "https://data.rijksmuseum.nl/search/collection";
const SET_PAGE = "https://www.rijksmuseum.nl/{culture}/collectie/verzameling/{setId}";
const OBJECT_NUMBER = /"((?:SK|RP|BK|AK|NG|KOG)-[A-Z0-9.-]+)"/g;

const ACCEPTED_RIGHTS: Record<string, string> = {
  "creativecommons.org/publicdomain/mark/": "PD",
  "creativecommons.org/publicdomain/zero/": "CC0",
};

const TYPE_LABELS: Record<string, string> = {
  "https://id.rijksmuseum.nl/2208": "painting",
  "https://id.rijksmuseum.nl/220363": "drawing",
  "https://id.rijksmuseum.nl/220951": "photograph",
  "https://id.rijksmuseum.nl/22040": "print",
  "https://id.rijksmuseum.nl/2203113": "poster",
};

// How many objects may share a number prefix before the ambiguity is given up on instead of
// paged through one object at a time. Real collisions in the curated sets reach 59
// (NG-1986-5-5); a prefix shared by hundreds (RP-F-2019-299-6-6 matches 166) is still not worth
// 166 requests. The measure is the search's totalItems, not the size of the returned page.
const MAX_AMBIGUOUS_CANDIDATES = 100;

export type Fetch = (url: string) => Promise<Rec>;
export type FetchText = (url: string) => Promise<string>;

export interface Print {
  objectNumber: string;
  title: string;
  artist: string;
  date: string;
  rights: string;
  type: string;
  width: number;
  height: number;
  imageUrl: string;
}

export interface Skip {
  objectNumber: string;
  reason: string;
}

function asList(value: unknown): Rec[] {
  if (value === null || value === undefined) return [];
  return (Array.isArray(value) ? value : [value]) as Rec[];
}

function rec(value: unknown): Rec {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function names(obj: Rec): Rec[] {
  return asList(obj.identified_by).filter((n) => n.type === "Name" && text(n.content));
}

export function titleOf(obj: Rec): string {
  const all = names(obj);
  for (const name of all) {
    if (asList(name.language).some((lang) => lang.id === ENGLISH)) return name.content as string;
  }
  return text(all[0]?.content) ?? text(obj._label) ?? "Untitled";
}

function stripQualifier(name: string): string {
  let out = name;
  for (const suffix of [" (mentioned on object)", " (vermeld op object)"]) {
    out = out.replaceAll(suffix, "");
  }
  return out.trim();
}

// The Rijksmuseum puts the artist in `referred_to_by` (AAT 300435417) and the publisher/printer
// in `carried_out_by`; preferring the name field keeps the publisher off the placard.
export function artistsOf(obj: Rec): string[] {
  const prod = rec(obj.produced_by);
  const parts = [prod, ...asList(prod.part)];
  const found: string[] = [];
  for (const part of parts) {
    for (const ref of asList(part.referred_to_by)) {
      const classes = asList(ref.classified_as).map((c) => c.id);
      const content = text(ref.content);
      if (classes.includes(NAME_TYPE) && content) found.push(stripQualifier(content));
    }
  }
  if (found.length === 0) {
    for (const part of parts) {
      for (const creator of asList(part.carried_out_by)) {
        const label =
          text(creator._label) ??
          asList(creator.notation)
            .map((n) => text(n["@value"]))
            .find(Boolean);
        if (label) found.push(label);
      }
    }
  }
  return [...new Set(found.filter(Boolean))];
}

export function dateOf(obj: Rec): string {
  const timespan = asList(rec(obj.produced_by).timespan)[0] ?? {};
  for (const name of asList(timespan.identified_by)) {
    const content = text(name.content);
    if (content) return content;
  }
  return text(timespan.begin_of_the_begin) ?? "";
}

export function typeOf(obj: Rec): string {
  for (const cls of asList(obj.classified_as)) {
    const id = typeof cls.id === "string" ? cls.id : "";
    const label = TYPE_LABELS[id];
    if (label) return label;
    if (id) return id.slice(id.lastIndexOf("/") + 1);
  }
  return "unknown";
}

// Nothing is skipped on rights: the IIIF service serves every object and this frame is a
// private, non-commercial display. The label is surfaced in the dry-run so the status stays visible.
export function rightsOf(visualItem: Rec): string {
  const labels: string[] = [];
  for (const subject of asList(visualItem.subject_to)) {
    for (const cls of asList(subject.classified_as)) {
      const id = typeof cls.id === "string" ? cls.id : "";
      for (const [prefix, label] of Object.entries(ACCEPTED_RIGHTS)) {
        if (id.includes(prefix)) return label;
      }
      labels.push(text(cls._label) ?? id.slice(id.lastIndexOf("/") + 1));
    }
  }
  return labels[0] || "unknown";
}

async function resolveObject(objectNumber: string, obj: Rec, fetch: Fetch): Promise<Print | Skip> {
  const skip = (): Skip => ({ objectNumber, reason: "no-image" });
  const shows = asList(obj.shows);
  if (shows.length === 0) return skip();
  const visual = await fetch(String(shows[0]?.id));

  const rights = rightsOf(visual);
  const digitalIds = asList(visual.digitally_shown_by);
  if (digitalIds.length === 0) return skip();
  const digital = await fetch(String(digitalIds[0]?.id));
  const access = asList(digital.access_point);
  if (access.length === 0) return skip();
  const base = String(access[0]?.id).split("/full/")[0];

  const info = await fetch(`${base}/info.json`);
  const { width, height } = info;
  if (typeof width !== "number" || typeof height !== "number" || !width || !height) return skip();

  return {
    objectNumber,
    title: titleOf(obj),
    artist: artistsOf(obj).join(", ") || "Anonymous",
    date: dateOf(obj),
    rights,
    type: typeOf(obj),
    width,
    height,
    imageUrl: `${base}/full/!1600,1600/0/default.jpg`,
  };
}

function identifiers(obj: Rec): string[] {
  return asList(obj.identified_by)
    .filter((item) => item.type === "Identifier")
    .map((item) => text(item.content))
    .filter((id): id is string => id !== undefined);
}

function totalItems(search: Rec): number {
  const total = rec(search.partOf).totalItems;
  return typeof total === "number" ? total : asList(search.orderedItems).length;
}

export async function resolve(objectNumber: string, fetch: Fetch): Promise<Print | Skip> {
  const query = new URLSearchParams({ objectNumber }).toString();
  const search = await fetch(`${SEARCH_URL}?${query}`);
  const ids = asList(search.orderedItems).map((item) => String(item.id));
  if (ids.length === 0) return { objectNumber, reason: "not-found" };
  if (ids.length === 1) return resolveObject(objectNumber, await fetch(ids[0] as string), fetch);

  // The search matches prefixes as well as exact numbers (SK-A-4 also finds SK-A-400...), so
  // with a few hits only the record whose own identifier equals the set member is the right
  // one. A prefix shared by many objects stays skipped rather than costing a request each.
  if (totalItems(search) > MAX_AMBIGUOUS_CANDIDATES) return { objectNumber, reason: "ambiguous" };
  for (const id of ids) {
    const obj = await fetch(id);
    if (identifiers(obj).includes(objectNumber)) return resolveObject(objectNumber, obj, fetch);
  }
  return { objectNumber, reason: "ambiguous" };
}

// The set page is public and its Nuxt payload embeds the items. Only numbers are taken: the
// payload is a flat string table shared by every item, so a positional "title" belongs to
// whichever item owns it, not to the member. `resolve` disambiguates by identifier instead.
export async function setMembers(
  setId: string,
  culture: string,
  fetchText: FetchText,
): Promise<string[]> {
  const url = SET_PAGE.replace("{culture}", culture).replace("{setId}", setId);
  const html = await fetchText(url);
  const members = [...new Set([...html.matchAll(OBJECT_NUMBER)].map((m) => m[1] as string))];
  if (members.length === 0)
    throw new UsageError(`Rijksstudio set '${setId}' is empty or not found`);
  return members;
}
