export const hasMagick = Bun.which("magick") !== null;

export async function magick(...args: string[]): Promise<string> {
  const proc = Bun.spawn(["magick", ...args], { stdout: "pipe", stderr: "pipe" });
  const text = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) throw new Error(await new Response(proc.stderr).text());
  return text;
}

export async function coloursOf(path: string): Promise<string[]> {
  const out = await magick(path, "-format", "%c", "histogram:info:");
  return out
    .split("\n")
    .filter((line) => line.includes("#"))
    .map((line) =>
      `#${(line.split("#").at(-1) ?? "").trim().split(/\s+/)[0]?.slice(0, 6)}`.toUpperCase(),
    )
    .sort();
}
