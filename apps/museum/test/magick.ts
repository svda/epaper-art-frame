export const hasMagick = Bun.which("magick") !== null;

export async function magick(...args: string[]): Promise<string> {
  const proc = Bun.spawn(["magick", ...args], { stdout: "pipe", stderr: "pipe" });
  const text = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) throw new Error(await new Response(proc.stderr).text());
  return text;
}

export async function size(path: string): Promise<[number, number]> {
  const [w, h] = (await magick("identify", "-format", "%w %h", path)).split(" ").map(Number);
  return [w as number, h as number];
}

export async function trimSize(path: string): Promise<[number, number]> {
  const [w, h] = (await magick(path, "-trim", "-format", "%w %h", "info:")).split(" ").map(Number);
  return [w as number, h as number];
}

export async function uniqueColours(path: string): Promise<Set<string>> {
  const out = await magick(path, "-unique-colors", "txt:-");
  const colours = new Set<string>();
  for (const line of out.split("\n").slice(1)) {
    for (const token of line.split(/\s+/)) {
      if (token.startsWith("#") && token.length === 7) colours.add(token.toUpperCase());
    }
  }
  return colours;
}
