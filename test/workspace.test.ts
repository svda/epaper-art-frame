import { expect, test } from "bun:test";

const root = new URL("../", import.meta.url);

test("root package is a private Bun workspace over tools/*", async () => {
  const pkg = await Bun.file(new URL("package.json", root)).json();
  expect(pkg.private).toBe(true);
  expect(pkg.workspaces).toEqual(["tools/*"]);
});

test("root package exposes test, typecheck, lint and format scripts", async () => {
  const pkg = await Bun.file(new URL("package.json", root)).json();
  expect(Object.keys(pkg.scripts).sort()).toEqual(["format", "lint", "test", "typecheck"]);
});
