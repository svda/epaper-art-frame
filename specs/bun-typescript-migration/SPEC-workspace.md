# Spec: workspace (module of bun-typescript-migration)

Depends on: — · Consumers: epaper, museum, icloud

## Objective
Set up the root Bun workspace and the shared `@frame/cli` helpers so each tool port
only has to deal with its own domain logic.

## Deliverables
- Root `package.json` (private, `workspaces: ["tools/*"]`, scripts: `test`, `typecheck`,
  `lint`, `format`). Dev dependencies: `typescript`, `@types/bun`, `@biomejs/biome`.
  These are pre-approved.
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`,
  `types: ["bun"]`, `noEmit`.
- `biome.json` (2-space indent, 100 cols, double quotes).
- `.gitignore`: add `node_modules/`.
- `tools/cli` (`@frame/cli`):
  - `repoRoot()`: absolute repo root, found from the module's location rather than the cwd.
  - `parseArgs(spec, argv)`: a thin wrapper over `node:util` `parseArgs` that prints
    usage on `-h/--help` and throws `UsageError` for unknown flags.
  - `run(argv, opts)`: `Bun.spawn` wrapper that returns `{code, stdout, stderr}`, plus
    `runOrThrow`. Injectable for tests.
  - `parseEnvFile(text)`: `KEY=value`, `#` comments, optional quotes. Matches today's
    `parse_env_file` semantics.
  - `main(fn)`: maps `UsageError` to exit 2 and other errors to exit 1, with the message
    on stderr.

## API contract (consumed by other modules)
```ts
export class UsageError extends Error {}
export function repoRoot(): string;
export type Exec = (argv: string[], opts?: { cwd?: string; env?: Record<string,string> }) =>
  Promise<{ code: number; stdout: string; stderr: string }>;
export const exec: Exec;
export function parseEnvFile(text: string): Record<string, string>;
export function main(fn: (argv: string[]) => Promise<number | void>): void;
```

## Testing
`tools/cli/test/*.test.ts` covers env-file parsing (port the cases from
`icloud/tests/test_config.py::parse_env_file`), the exit-code mapping, and the
unknown-flag error.

## Success Criteria
- `bun install`, `bun test`, `bun run typecheck` and `bun run lint` pass at the root.
- The Python tools still work alongside this: uv projects are untouched.

## Boundaries
See the umbrella SPEC.md. Nothing else may be added to `@frame/cli` until a second
module needs it.
