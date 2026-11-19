import { describe, expect, test } from "bun:test";
import type { Photo, PhotoSource } from "../src/photo-source.ts";
import { selectAlbum } from "../src/selection.ts";

const ALBUM = "epaper art frame";

function photo(uuid: string, date: Date | null, isMovie = false): Photo {
  return { uuid, date, filename: `${uuid}.HEIC`, isMovie, adjusted: false, localPath: null };
}

function source(albums: Record<string, Photo[]>): PhotoSource {
  return { list: (album) => albums[album] ?? [] };
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n));
const uuids = (photos: Photo[]) => photos.map((p) => p.uuid);

describe("selectAlbum", () => {
  test("selects every photo in the album", () => {
    const photos = [photo("a", day(1)), photo("b", day(2))];
    expect(uuids(selectAlbum(source({ [ALBUM]: photos }), ALBUM))).toEqual(["b", "a"]);
  });

  test("excludes photos that are not in the album", () => {
    const db = source({ [ALBUM]: [photo("in", day(1))], other: [photo("out", day(2))] });
    expect(uuids(selectAlbum(db, ALBUM))).toEqual(["in"]);
  });

  test("excludes movies", () => {
    const db = source({ [ALBUM]: [photo("a", day(1)), photo("m", day(3), true)] });
    expect(uuids(selectAlbum(db, ALBUM))).toEqual(["a"]);
  });

  test("orders by capture date, newest first", () => {
    const db = source({
      [ALBUM]: [photo("old", day(1)), photo("new", day(9)), photo("mid", day(5))],
    });
    expect(uuids(selectAlbum(db, ALBUM))).toEqual(["new", "mid", "old"]);
  });

  test("returns all photos with no cap", () => {
    const many = Array.from({ length: 10 }, (_, i) => photo(`p${i + 1}`, day(i + 1)));
    expect(selectAlbum(source({ [ALBUM]: many }), ALBUM)).toHaveLength(10);
  });

  test("an empty album selects nothing", () => {
    expect(selectAlbum(source({}), ALBUM)).toEqual([]);
  });

  test("ties on capture date are broken by uuid, ascending", () => {
    const db = source({ [ALBUM]: [photo("b", day(5)), photo("a", day(5)), photo("c", day(5))] });
    expect(uuids(selectAlbum(db, ALBUM))).toEqual(["a", "b", "c"]);
  });

  test("undated photos sort last, by uuid", () => {
    const db = source({
      [ALBUM]: [photo("z", null), photo("dated", day(1)), photo("y", null)],
    });
    expect(uuids(selectAlbum(db, ALBUM))).toEqual(["dated", "y", "z"]);
  });

  test("does not mutate the source's list", () => {
    const photos = [photo("a", day(1)), photo("b", day(2))];
    selectAlbum(source({ [ALBUM]: photos }), ALBUM);
    expect(uuids(photos)).toEqual(["a", "b"]);
  });
});
