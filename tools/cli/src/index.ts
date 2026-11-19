import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs as nodeParseArgs, type ParseArgsOptionsConfig } from "node:util";

export class UsageError extends Error {}

export class HelpRequested extends Error {
  constructor(readonly usage: string) {
    super(usage);
  }
}

export function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

export interface ArgSpec<O extends ParseArgsOptionsConfig> {
  usage: string;
  options: O;
}

export function parseArgs<const O extends ParseArgsOptionsConfig>(
  spec: ArgSpec<O>,
  argv: string[],
) {
  if (argv.includes("-h") || argv.includes("--help")) throw new HelpRequested(spec.usage);
  try {
    return nodeParseArgs({
      args: argv,
      options: spec.options,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    throw new UsageError(`${(error as Error).message}\n${spec.usage}`);
  }
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type Exec = (
  argv: string[],
  opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
) => Promise<ExecResult>;

export const exec: Exec = async (argv, opts = {}) => {
  const proc = Bun.spawn(argv, {
    cwd: opts.cwd,
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
    stdout: "pipe",
    stderr: "pipe",
    timeout: opts.timeoutMs,
    killSignal: "SIGKILL",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const timedOut = opts.timeoutMs !== undefined && proc.signalCode === "SIGKILL";
  return {
    code,
    stdout,
    stderr: timedOut ? `${stderr}${argv[0]} timed out after ${opts.timeoutMs} ms\n` : stderr,
  };
};

export async function runOrThrow(
  argv: string[],
  opts?: Parameters<Exec>[1],
  run: Exec = exec,
): Promise<ExecResult> {
  const result = await run(argv, opts);
  if (result.code !== 0) {
    throw new Error(`${argv[0]} exited ${result.code}: ${result.stderr.trim()}`);
  }
  return result;
}

export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const first = value[0];
    if (value.length >= 2 && first === value.at(-1) && (first === '"' || first === "'")) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function readEnvFile(path: string): Record<string, string> {
  return existsSync(path) ? parseEnvFile(readFileSync(path, "utf8")) : {};
}

export interface Sinks {
  out: (text: string) => void;
  err: (text: string) => void;
}

const stdio: Sinks = {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
};

export type Command = (argv: string[]) => Promise<unknown>;

export async function runMain(fn: Command, argv: string[], sinks: Sinks = stdio): Promise<number> {
  try {
    const result = await fn(argv);
    return typeof result === "number" ? result : 0;
  } catch (error) {
    if (error instanceof HelpRequested) {
      sinks.out(`${error.usage}\n`);
      return 0;
    }
    sinks.err(`error: ${(error as Error).message}\n`);
    return error instanceof UsageError ? 2 : 1;
  }
}

export function main(fn: Command): void {
  runMain(fn, process.argv.slice(2)).then((code) => process.exit(code));
}
