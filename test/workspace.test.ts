import { expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const rootPath = root.pathname;

async function json(path: string) {
  return Bun.file(path).json();
}

function workspaceDirs(): string[] {
  return ["apps", "packages"].flatMap((group) =>
    readdirSync(join(rootPath, group), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(rootPath, group, d.name, "package.json")))
      .map((d) => join(rootPath, group, d.name)),
  );
}

test("root package is a private Bun workspace over apps/* and packages/*", async () => {
  const pkg = await json(join(rootPath, "package.json"));
  expect(pkg.private).toBe(true);
  expect(pkg.workspaces).toEqual(["apps/*", "packages/*"]);
});

test("root package exposes test, typecheck, lint and format scripts", async () => {
  const pkg = await json(join(rootPath, "package.json"));
  expect(Object.keys(pkg.scripts).sort()).toEqual(["format", "lint", "test", "typecheck"]);
});

test("the workspace has the expected apps and packages", () => {
  const names = workspaceDirs().map((d) => d.slice(rootPath.length));
  expect(names.sort()).toEqual(["apps/icloud", "apps/museum", "packages/cli", "packages/epaper"]);
});

test("every workspace package has its own test and typecheck scripts", async () => {
  for (const dir of workspaceDirs()) {
    const pkg = await json(join(dir, "package.json"));
    expect(pkg.scripts?.test, `${dir} test script`).toBe("bun test");
    expect(pkg.scripts?.typecheck, `${dir} typecheck script`).toBe("tsc --noEmit -p .");
  }
});

test("every workspace package has a tsconfig that extends the shared base", async () => {
  for (const dir of workspaceDirs()) {
    const tsconfig = await json(join(dir, "tsconfig.json"));
    expect(tsconfig.extends, `${dir} extends`).toBe("../../tsconfig.base.json");
  }
});

test("apps are never imported by packages", async () => {
  for (const dir of workspaceDirs().filter((d) => d.includes("/packages/"))) {
    const pkg = await json(join(dir, "package.json"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => ["@frame/icloud", "@frame/museum"].includes(d))).toEqual([]);
  }
});
