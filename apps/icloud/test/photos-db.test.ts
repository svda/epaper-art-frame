import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openPhotosDb, type PhotosDb } from "../src/photos-db.ts";

const CORE_DATA_EPOCH = 978307200;
const ALBUM = "epaper art frame";

interface AssetRow {
  pk: number;
  uuid: string;
  created?: number | null;
  filename?: string;
  directory?: string;
  kind?: number;
  trashed?: number;
  adjusted?: number | null;
  share?: number | null;
}

interface Layout {
  assetEnt: number;
  albumEnt: number;
  shareEnt: number;
  adjustedColumn: boolean;
}

const DEFAULT_LAYOUT: Layout = { assetEnt: 3, albumEnt: 34, shareEnt: 72, adjustedColumn: true };

const opened: PhotosDb[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

function makeLibrary(layout: Layout = DEFAULT_LAYOUT) {
  const library = join(mkdtempSync(join(tmpdir(), "photos-lib-")), "Test.photoslibrary");
  mkdirSync(join(library, "database"), { recursive: true });
  const dbPath = join(library, "database", "Photos.sqlite");
  const db = new Database(dbPath);
  db.run("pragma journal_mode=WAL");
  db.run("pragma wal_autocheckpoint=0");
  db.run(`create table Z_PRIMARYKEY (Z_ENT integer primary key, Z_NAME text)`);
  db.run(`create table ZASSET (Z_PK integer primary key, ZUUID text, ZDATECREATED real,
    ZFILENAME text, ZDIRECTORY text, ZKIND integer, ZTRASHEDSTATE integer,
    ${layout.adjustedColumn ? "ZADJUSTMENTTIMESTAMP real," : ""} ZCOLLECTIONSHARE integer)`);
  db.run(
    `create table ZSHARE (Z_PK integer primary key, Z_ENT integer, ZTITLE text, ZTRASHEDSTATE integer)`,
  );
  db.run(
    `create table ZGENERICALBUM (Z_PK integer primary key, ZKIND integer, ZTITLE text, ZTRASHEDSTATE integer)`,
  );
  db.run(
    `create table Z_${layout.albumEnt}ASSETS (Z_${layout.albumEnt}ALBUMS integer, Z_${layout.assetEnt}ASSETS integer)`,
  );
  db.run("insert into Z_PRIMARYKEY values (?, 'Asset'), (?, 'Album'), (?, 'CollectionShare')", [
    layout.assetEnt,
    layout.albumEnt,
    layout.shareEnt,
  ]);
  return {
    library,
    db,
    layout,
    asset(row: AssetRow) {
      const cols = [
        "Z_PK",
        "ZUUID",
        "ZDATECREATED",
        "ZFILENAME",
        "ZDIRECTORY",
        "ZKIND",
        "ZTRASHEDSTATE",
        "ZCOLLECTIONSHARE",
      ];
      const values: (string | number | null)[] = [
        row.pk,
        row.uuid,
        row.created === undefined ? 1000 : row.created,
        row.filename ?? `${row.uuid}.HEIC`,
        row.directory ?? "A",
        row.kind ?? 0,
        row.trashed ?? 0,
        row.share ?? null,
      ];
      if (layout.adjustedColumn) {
        cols.push("ZADJUSTMENTTIMESTAMP");
        values.push(row.adjusted ?? null);
      }
      db.run(
        `insert into ZASSET (${cols.join(",")}) values (${cols.map(() => "?").join(",")})`,
        values,
      );
    },
    share(pk: number, title: string, trashed = 0) {
      db.run("insert into ZSHARE values (?, ?, ?, ?)", [pk, layout.shareEnt, title, trashed]);
    },
    userAlbum(pk: number, title: string, members: number[], trashed = 0) {
      db.run("insert into ZGENERICALBUM values (?, 2, ?, ?)", [pk, title, trashed]);
      for (const m of members) {
        db.run(`insert into Z_${layout.albumEnt}ASSETS values (?, ?)`, [pk, m]);
      }
    },
  };
}

function open(library: string) {
  const photos = openPhotosDb(library);
  opened.push(photos);
  return photos;
}

describe("PhotosDb.list", () => {
  test("lists the assets of a Shared Album, converting Core Data dates", () => {
    const lib = makeLibrary();
    lib.share(8, ALBUM);
    lib.asset({ pk: 1, uuid: "A", created: 100, share: 8 });
    lib.asset({ pk: 2, uuid: "B", created: 200, share: 9 });

    const photos = open(lib.library).list(ALBUM);

    expect(photos).toHaveLength(1);
    expect(photos[0]?.uuid).toBe("A");
    expect(photos[0]?.date).toEqual(new Date((100 + CORE_DATA_EPOCH) * 1000));
  });

  test("lists the assets of a user album through the join table found via Z_PRIMARYKEY", () => {
    const lib = makeLibrary({ assetEnt: 3, albumEnt: 40, shareEnt: 90, adjustedColumn: true });
    lib.asset({ pk: 1, uuid: "A" });
    lib.asset({ pk: 2, uuid: "B" });
    lib.userAlbum(5, ALBUM, [1]);

    expect(
      open(lib.library)
        .list(ALBUM)
        .map((p) => p.uuid),
    ).toEqual(["A"]);
  });

  test("a title that is both a shared and a user album yields each photo once", () => {
    const lib = makeLibrary();
    lib.share(8, ALBUM);
    lib.asset({ pk: 1, uuid: "A", share: 8 });
    lib.asset({ pk: 2, uuid: "B" });
    lib.userAlbum(5, ALBUM, [1, 2]);

    expect(
      open(lib.library)
        .list(ALBUM)
        .map((p) => p.uuid)
        .sort(),
    ).toEqual(["A", "B"]);
  });

  test("an unknown album is an empty list", () => {
    const lib = makeLibrary();
    lib.asset({ pk: 1, uuid: "A" });
    expect(open(lib.library).list("nope")).toEqual([]);
  });

  test("trashed albums and trashed assets are ignored", () => {
    const lib = makeLibrary();
    lib.share(8, ALBUM, 1);
    lib.share(9, ALBUM);
    lib.asset({ pk: 1, uuid: "old", share: 8 });
    lib.asset({ pk: 2, uuid: "live", share: 9 });
    lib.asset({ pk: 3, uuid: "gone", share: 9, trashed: 1 });
    lib.userAlbum(5, ALBUM, [3], 1);

    expect(
      open(lib.library)
        .list(ALBUM)
        .map((p) => p.uuid),
    ).toEqual(["live"]);
  });

  test("flags movies and adjusted photos, and leaves undated photos undated", () => {
    const lib = makeLibrary();
    lib.share(8, ALBUM);
    lib.asset({ pk: 1, uuid: "plain", share: 8 });
    lib.asset({ pk: 2, uuid: "edited", share: 8, adjusted: 12345 });
    lib.asset({ pk: 3, uuid: "movie", share: 8, kind: 1 });
    lib.asset({ pk: 4, uuid: "undated", share: 8, created: null });

    const byUuid = Object.fromEntries(
      open(lib.library)
        .list(ALBUM)
        .map((p) => [p.uuid, p]),
    );
    expect(byUuid.plain).toMatchObject({ isMovie: false, adjusted: false });
    expect(byUuid.edited?.adjusted).toBe(true);
    expect(byUuid.movie?.isMovie).toBe(true);
    expect(byUuid.undated?.date).toBeNull();
  });

  test("reports the original's path only when the file is on disk", () => {
    const lib = makeLibrary();
    lib.share(8, ALBUM);
    lib.asset({ pk: 1, uuid: "local", share: 8, filename: "IMG_1.HEIC", directory: "7" });
    lib.asset({ pk: 2, uuid: "cloud", share: 8, filename: "IMG_2.HEIC", directory: "7" });
    mkdirSync(join(lib.library, "originals", "7"), { recursive: true });
    writeFileSync(join(lib.library, "originals", "7", "IMG_1.HEIC"), "x");

    const byUuid = Object.fromEntries(
      open(lib.library)
        .list(ALBUM)
        .map((p) => [p.uuid, p]),
    );
    expect(byUuid.local?.localPath).toBe(join(lib.library, "originals", "7", "IMG_1.HEIC"));
    expect(byUuid.cloud?.localPath).toBeNull();
    expect(byUuid.cloud?.filename).toBe("IMG_2.HEIC");
  });
});

describe("opening the library", () => {
  test("sees changes that only exist in the write-ahead log", () => {
    const lib = makeLibrary();
    lib.db.run("pragma wal_checkpoint(truncate)");
    lib.share(8, ALBUM);
    lib.asset({ pk: 1, uuid: "wal-only", share: 8 });
    expect(statSync(join(lib.library, "database", "Photos.sqlite-wal")).size).toBeGreaterThan(0);

    expect(
      open(lib.library)
        .list(ALBUM)
        .map((p) => p.uuid),
    ).toEqual(["wal-only"]);
  });

  test("ignores a stale -shm file next to the database", () => {
    const lib = makeLibrary();
    lib.share(8, ALBUM);
    lib.asset({ pk: 1, uuid: "A", share: 8 });
    lib.db.run("pragma wal_checkpoint(truncate)");
    lib.asset({ pk: 2, uuid: "B", share: 8 });
    writeFileSync(join(lib.library, "database", "Photos.sqlite-shm"), Buffer.alloc(32768, 7));

    expect(
      open(lib.library)
        .list(ALBUM)
        .map((p) => p.uuid)
        .sort(),
    ).toEqual(["A", "B"]);
  });

  test("never writes to the library", () => {
    const lib = makeLibrary();
    lib.share(8, ALBUM);
    lib.asset({ pk: 1, uuid: "A", share: 8 });
    const dir = join(lib.library, "database");
    const snapshot = () =>
      readdirSync(dir)
        .sort()
        .map((n) => [n, statSync(join(dir, n)).size, statSync(join(dir, n)).mtimeMs]);
    const before = snapshot();

    open(lib.library).list(ALBUM);

    expect(snapshot()).toEqual(before);
  });

  test("close removes the temporary copy", () => {
    const lib = makeLibrary();
    const photos = openPhotosDb(lib.library);
    const copy = photos.copyPath;
    expect(statSync(copy).isFile()).toBe(true);
    photos.close();
    expect(() => statSync(copy)).toThrow();
  });

  test("a library without a database is a clear error", () => {
    const empty = mkdtempSync(join(tmpdir(), "photos-empty-"));
    expect(() => openPhotosDb(empty)).toThrow(`no Photos database in ${empty}`);
  });

  test("an unsupported schema fails closed and names what is missing", () => {
    const lib = makeLibrary({ ...DEFAULT_LAYOUT, adjustedColumn: false });
    lib.share(8, ALBUM);
    lib.asset({ pk: 1, uuid: "A", share: 8 });
    expect(() => openPhotosDb(lib.library)).toThrow(
      /unsupported Photos library schema.*ZADJUSTMENTTIMESTAMP/,
    );
  });

  test("a library whose user-album join table cannot be found fails closed", () => {
    const lib = makeLibrary();
    lib.db.run("drop table Z_34ASSETS");
    expect(() => openPhotosDb(lib.library)).toThrow(
      /unsupported Photos library schema.*Z_34ASSETS/,
    );
  });
});
