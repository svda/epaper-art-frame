import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { renderManifest } from "@frame/epaper";

export const MANAGED_NAME = ".managed.json";

export interface SyncResult {
  prepared: number;
  kept: string[];
  deleted: string[];
  dryRun: boolean;
  failures: [string, string][];
  copied: number;
}

export type PrepareOne<P> = (photo: P, dest: string) => Promise<unknown>;
export type RegenerateManifest = (artworkDir: string) => Promise<unknown>;

export function readManaged(artworkDir: string): Set<string> {
  const state = join(artworkDir, MANAGED_NAME);
  if (!existsSync(state)) return new Set();
  let names: unknown;
  try {
    names = JSON.parse(readFileSync(state, "utf8"));
  } catch {
    names = undefined;
  }
  if (!Array.isArray(names) || !names.every((n) => typeof n === "string")) {
    throw new Error(`${state} is corrupt: expected a JSON array of file names`);
  }
  return new Set(names);
}

export function writeManaged(artworkDir: string, names: Set<string>): void {
  mkdirSync(artworkDir, { recursive: true });
  writeFileSync(join(artworkDir, MANAGED_NAME), renderManifest([...names].sort()));
}

// Files to delete: everything we own that is no longer selected. On the first run (no managed
// state) the sync adopts the folder and owns every PNG in it; afterwards it only ever deletes
// files it previously managed.
export function planDeletions(
  existing: Set<string>,
  managed: Set<string>,
  current: Set<string>,
  firstRun: boolean,
): Set<string> {
  const owned = firstRun ? existing : new Set([...managed].filter((n) => existing.has(n)));
  return new Set([...owned].filter((n) => !current.has(n)));
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Prepare the selected photos into the artwork folder and mirror it. Preparation happens in a
// staging dir first, so a failure leaves the artwork folder untouched. A photo that cannot be
// prepared is recorded in `failures` and skipped; the rest proceed. The manifest is regenerated
// last, by its own writer.
export async function applyArtwork<P extends { uuid: string }>(
  photos: P[],
  artworkDir: string,
  prepareOne: PrepareOne<P>,
  regenerateManifest: RegenerateManifest,
  dryRun = false,
): Promise<SyncResult> {
  const managed = readManaged(artworkDir);
  const firstRun = !existsSync(join(artworkDir, MANAGED_NAME));
  const existing = new Set(
    existsSync(artworkDir)
      ? readdirSync(artworkDir).filter((n) => extname(n) === ".png" && isFile(join(artworkDir, n)))
      : [],
  );

  if (dryRun) {
    const current = new Set(photos.map((p) => `${p.uuid}.png`));
    return {
      prepared: 0,
      kept: [...current].filter((n) => existing.has(n)).sort(),
      deleted: [...planDeletions(existing, managed, current, firstRun)].sort(),
      dryRun: true,
      failures: [],
      copied: 0,
    };
  }

  mkdirSync(artworkDir, { recursive: true });
  const stage = mkdtempSync(join(tmpdir(), "epaper_stage_"));
  const failures: [string, string][] = [];
  const prepared: string[] = [];
  try {
    for (const photo of photos) {
      try {
        await prepareOne(photo, join(stage, `${photo.uuid}.png`));
        prepared.push(photo.uuid);
      } catch (error) {
        failures.push([photo.uuid, (error as Error).message]);
      }
    }

    const current = new Set(prepared.map((uuid) => `${uuid}.png`));

    // Every selected photo failed. Do not mirror: deleting the whole folder over a transient
    // export failure would wipe the rotation. Leave it intact and regenerate the manifest.
    if (photos.length > 0 && prepared.length === 0) {
      await regenerateManifest(artworkDir);
      return {
        prepared: 0,
        kept: [...existing].sort(),
        deleted: [],
        dryRun: false,
        failures,
        copied: 0,
      };
    }

    const deletions = planDeletions(existing, managed, current, firstRun);
    let copied = 0;
    for (const name of current) {
      const staged = join(stage, name);
      const dest = join(artworkDir, name);
      if (!(isFile(dest) && readFileSync(dest).equals(readFileSync(staged)))) {
        copyFileSync(staged, dest);
        copied++;
      }
    }
    for (const name of deletions) rmSync(join(artworkDir, name), { force: true });
    writeManaged(artworkDir, current);
    await regenerateManifest(artworkDir);

    return {
      prepared: current.size,
      kept: [...current].sort(),
      deleted: [...deletions].sort(),
      dryRun: false,
      failures,
      copied,
    };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
