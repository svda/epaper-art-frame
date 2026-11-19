import { Database } from "bun:sqlite";
import { constants, copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Photo, PhotoSource } from "./photo-source.ts";

const CORE_DATA_EPOCH = 978307200;

const ASSET_COLUMNS = [
  "ZUUID",
  "ZDATECREATED",
  "ZFILENAME",
  "ZDIRECTORY",
  "ZKIND",
  "ZTRASHEDSTATE",
  "ZADJUSTMENTTIMESTAMP",
];

interface Row {
  uuid: string;
  created: number | null;
  filename: string;
  directory: string;
  kind: number;
  adjusted: number | null;
}

function unsupported(detail: string): Error {
  return new Error(`unsupported Photos library schema: ${detail}`);
}

// Reads Photos.sqlite from a throwaway copy so the live library is never opened, locked or
// written. Only the database and its -wal are copied: a copied -shm is a stale wal-index and
// hides recent changes, including the album itself.
export class PhotosDb implements PhotoSource {
  readonly copyPath: string;
  private readonly dir: string;
  private readonly db: Database;
  private readonly shareEnt: number | undefined;
  private readonly userAlbumJoin: { table: string; albumCol: string; assetCol: string } | undefined;

  constructor(private readonly library: string) {
    const source = join(library, "database", "Photos.sqlite");
    if (!existsSync(source)) throw new Error(`no Photos database in ${library}`);
    this.dir = mkdtempSync(join(tmpdir(), "photos-copy-"));
    this.copyPath = join(this.dir, "Photos.sqlite");
    try {
      // APFS clones the file instantly; elsewhere this falls back to a normal copy.
      copyFileSync(source, this.copyPath, constants.COPYFILE_FICLONE);
      if (existsSync(`${source}-wal`)) {
        copyFileSync(`${source}-wal`, `${this.copyPath}-wal`, constants.COPYFILE_FICLONE);
      }
      this.db = new Database(this.copyPath);
      this.db.run("pragma query_only=1");
      this.checkAssetColumns();
      this.shareEnt = this.entity("CollectionShare");
      this.userAlbumJoin = this.findUserAlbumJoin();
    } catch (error) {
      rmSync(this.dir, { recursive: true, force: true });
      throw error;
    }
  }

  private columns(table: string): string[] {
    return (this.db.query(`pragma table_info(${table})`).all() as { name: string }[]).map(
      (c) => c.name,
    );
  }

  private checkAssetColumns() {
    const have = new Set(this.columns("ZASSET"));
    const missing = ASSET_COLUMNS.filter((c) => !have.has(c));
    if (missing.length > 0) throw unsupported(`ZASSET is missing ${missing.join(", ")}`);
  }

  private entity(name: string): number | undefined {
    const row = this.db.query("select Z_ENT from Z_PRIMARYKEY where Z_NAME = ?").get(name) as {
      Z_ENT: number;
    } | null;
    return row?.Z_ENT;
  }

  // The album/asset join table is named after Core Data entity numbers, which change between
  // macOS versions (Z_34ASSETS with Z_34ALBUMS and Z_3ASSETS here), so derive it.
  private findUserAlbumJoin() {
    const albumEnt = this.entity("Album");
    const assetEnt = this.entity("Asset");
    if (albumEnt === undefined || assetEnt === undefined) {
      throw unsupported("Z_PRIMARYKEY has no Album/Asset entity");
    }
    const table = `Z_${albumEnt}ASSETS`;
    const albumCol = `Z_${albumEnt}ALBUMS`;
    const assetCol = `Z_${assetEnt}ASSETS`;
    const have = new Set(this.columns(table));
    if (!have.has(albumCol) || !have.has(assetCol)) {
      throw unsupported(`join table ${table} (${albumCol}, ${assetCol}) not found`);
    }
    return { table, albumCol, assetCol };
  }

  private query(where: string, ...params: (string | number)[]): Row[] {
    return this.db
      .query(
        `select a.ZUUID uuid, a.ZDATECREATED created, a.ZFILENAME filename,
                a.ZDIRECTORY directory, a.ZKIND kind, a.ZADJUSTMENTTIMESTAMP adjusted
           from ZASSET a where a.ZTRASHEDSTATE = 0 and ${where}`,
      )
      .all(...params) as Row[];
  }

  list(album: string): Photo[] {
    const rows: Row[] = [];
    if (this.shareEnt !== undefined) {
      rows.push(
        ...this.query(
          `a.ZCOLLECTIONSHARE in (select Z_PK from ZSHARE
             where ZTITLE = ? and ZTRASHEDSTATE = 0 and Z_ENT = ?)`,
          album,
          this.shareEnt,
        ),
      );
    }
    const join = this.userAlbumJoin;
    if (join) {
      rows.push(
        ...this.query(
          `a.Z_PK in (select j.${join.assetCol} from ${join.table} j
             join ZGENERICALBUM g on g.Z_PK = j.${join.albumCol}
             where g.ZTITLE = ? and g.ZKIND = 2 and g.ZTRASHEDSTATE = 0)`,
          album,
        ),
      );
    }

    const seen = new Set<string>();
    const photos: Photo[] = [];
    for (const row of rows) {
      if (seen.has(row.uuid)) continue;
      seen.add(row.uuid);
      const original = originalPath(this.library, row);
      photos.push({
        uuid: row.uuid,
        date: row.created === null ? null : new Date((row.created + CORE_DATA_EPOCH) * 1000),
        filename: row.filename,
        isMovie: row.kind === 1,
        adjusted: row.adjusted !== null,
        localPath: existsSync(original) ? original : null,
      });
    }
    return photos;
  }

  close(): void {
    this.db.close();
    rmSync(this.dir, { recursive: true, force: true });
  }
}

function originalPath(library: string, row: Row): string {
  return join(library, "originals", row.directory, row.filename);
}

export function openPhotosDb(library: string): PhotosDb {
  return new PhotosDb(library);
}
