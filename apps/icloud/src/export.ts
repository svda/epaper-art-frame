import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { exec as defaultExec, type Exec, runOrThrow } from "@frame/cli";
import { loadProfile, prepareImage } from "@frame/epaper";
import type { Photo } from "./photo-source.ts";

// ImageMagick cannot decode camera RAW without a delegate; macOS `sips` can, so RAW exports are
// pre-converted to JPEG before preparing.
const RAW_SUFFIXES = new Set(
  ".dng .cr2 .cr3 .nef .arw .raf .orf .rw2 .pef .srw .raw .x3f .rwl .sr2 .mrw .kdc .dcr".split(" "),
);

// A scheduled run has nobody to answer a macOS permission prompt, so never wait forever.
const EXPORT_TIMEOUT_MS = 5 * 60_000;

export type ExportFn = (photo: Photo, exportDir: string) => Promise<string[]>;

function scriptString(text: string): string {
  return `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Path(s) to the photo's image. Prefer a library original that is on disk. Otherwise ask Photos.app
// to export it, which downloads iCloud and Shared Album assets. An edited photo is exported
// rendered (without the originals flag): its original is not what is shown in Photos.
export async function exportPhoto(
  photo: Photo,
  exportDir: string,
  run: Exec = defaultExec,
): Promise<string[]> {
  if (photo.localPath && isFile(photo.localPath)) return [photo.localPath];
  if (!/^[0-9A-Fa-f-]+$/.test(photo.uuid)) throw new Error(`unsafe photo id: ${photo.uuid}`);

  mkdirSync(exportDir, { recursive: true });
  const originals = photo.adjusted ? "" : " with using originals";
  const script =
    `tell application "Photos" to export {media item id "${photo.uuid}/L0/001"} ` +
    `to (POSIX file ${scriptString(exportDir)})${originals}`;
  await runOrThrow(["osascript", "-e", script], { timeoutMs: EXPORT_TIMEOUT_MS }, run);

  const files = readdirSync(exportDir)
    .sort()
    .map((name) => join(exportDir, name))
    .filter(isFile);
  if (files.length === 0) throw new Error("original not available (still in iCloud?)");
  return files;
}

async function maybeConvertRaw(src: string, exportDir: string, run: Exec): Promise<string> {
  if (!RAW_SUFFIXES.has(extname(src).toLowerCase())) return src;
  const out = join(exportDir, `${basename(src, extname(src))}.jpg`);
  await runOrThrow(["sips", "-s", "format", "jpeg", src, "--out", out], undefined, run);
  if (!existsSync(out)) throw new Error(`RAW conversion produced no file for ${basename(src)}`);
  return out;
}

export interface PrepareOneDeps {
  exec?: Exec;
  exportFn?: ExportFn;
  profile?: string;
}

// Export one photo and prepare it to `dest` as a panel-ready PNG for the profile's panel.
export async function prepareOne(
  photo: Photo,
  dest: string,
  deps: PrepareOneDeps = {},
): Promise<void> {
  const run = deps.exec ?? defaultExec;
  const exportFn = deps.exportFn ?? ((p, dir) => exportPhoto(p, dir, run));
  const exportDir = mkdtempSync(join(tmpdir(), "epaper_export_"));
  try {
    const [first] = await exportFn(photo, exportDir);
    if (!first) throw new Error(`export produced no file for ${photo.uuid}`);
    const src = await maybeConvertRaw(first, exportDir, run);
    const profile = loadProfile(deps.profile, { env: {} });
    await prepareImage(src, { profile, outDir: dirname(dest), output: dest }, run);
  } finally {
    rmSync(exportDir, { recursive: true, force: true });
  }
}
