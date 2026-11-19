import { join } from "node:path";

export const PLIST_TEMPLATE = join(import.meta.dir, "..", "com.sander.epaper-album.plist.template");

export interface PlistVars {
  bun: string;
  script: string;
  workdir: string;
  stdout: string;
  stderr: string;
  intervalH: number;
}

function xmlEscape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Fill the launchd template for this machine (absolute paths required).
export function renderPlist(template: string, vars: PlistVars): string {
  return template
    .replace("__BUN__", xmlEscape(vars.bun))
    .replace("__SCRIPT__", xmlEscape(vars.script))
    .replace("__WORKDIR__", xmlEscape(vars.workdir))
    .replace("__STDOUT__", xmlEscape(vars.stdout))
    .replace("__STDERR__", xmlEscape(vars.stderr))
    .replace("__INTERVAL__", String(vars.intervalH * 3600));
}

// launchd needs a path that survives upgrades: `bun` on PATH is a stable symlink, while the
// running executable is a versioned install path that disappears when Homebrew upgrades bun.
export function resolveBunPath(
  which: (name: string) => string | null = Bun.which,
  execPath: string = process.execPath,
): string {
  return which("bun") ?? execPath;
}
