// Throwaway T-08 spike: list a Shared Album's assets from a COPY of Photos.sqlite (macOS 26+).
// Usage: bun tools/icloud/spike/probe.ts "<album title>" [library.photoslibrary]
import { Database } from "bun:sqlite";
import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const CORE_DATA_EPOCH = 978307200;
const title = process.argv[2] ?? "epaper art frame";
const library = process.argv[3] ?? join(homedir(), "Pictures", "Photos Library.photoslibrary");

// Copy the DB and its WAL only. A copied -shm is a stale wal-index and hides recent changes.
const dir = mkdtempSync(join(tmpdir(), "photos-spike-"));
for (const name of ["Photos.sqlite", "Photos.sqlite-wal"]) {
  const src = join(library, "database", name);
  if (existsSync(src)) copyFileSync(src, join(dir, name));
}
const db = new Database(join(dir, "Photos.sqlite"));
db.run("pragma query_only=1");

const share = db
  .query("select Z_PK from ZSHARE where ZTITLE = ? and ZTRASHEDSTATE = 0")
  .all(title) as { Z_PK: number }[];
if (share.length !== 1) throw new Error(`expected one shared album '${title}', found ${share.length}`);

const rows = db
  .query(
    `select a.ZUUID uuid, a.ZDATECREATED created, a.ZFILENAME filename, a.ZDIRECTORY directory,
            a.ZKIND kind, a.ZADJUSTMENTTIMESTAMP adjusted, a.ZCLOUDLOCALSTATE cloudState,
            x.ZORIGINALFILENAME original
       from ZASSET a left join ZADDITIONALASSETATTRIBUTES x on x.ZASSET = a.Z_PK
      where a.ZCOLLECTIONSHARE = ? and a.ZTRASHEDSTATE = 0 and a.ZKIND = 0`,
  )
  .all(share[0]?.Z_PK) as Record<string, unknown>[];

const assets = rows.map((r) => ({
  uuid: r.uuid as string,
  date: r.created == null ? null : (r.created as number) + CORE_DATA_EPOCH,
  filename: r.filename as string,
  original: r.original as string | null,
  adjusted: r.adjusted != null,
  onDisk: existsSync(join(library, "originals", String(r.directory), String(r.filename))),
}));

// Same order as select_album: dated newest first, uuid ascending on ties, undated last.
assets.sort((a, b) => {
  if ((a.date === null) !== (b.date === null)) return a.date === null ? 1 : -1;
  if (a.date !== b.date) return (b.date ?? 0) - (a.date ?? 0);
  return a.uuid < b.uuid ? -1 : 1;
});
console.log(JSON.stringify(assets.map((a) => a.uuid)));
console.error(
  `${assets.length} assets; onDisk=${assets.filter((a) => a.onDisk).length} adjusted=${assets.filter((a) => a.adjusted).length}`,
);
