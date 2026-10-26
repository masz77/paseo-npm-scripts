import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { listNpmScripts } from "./npm-scripts.ts";

async function write(root: string, file: string, content: string) {
  await mkdir(join(root, file, ".."), { recursive: true });
  await writeFile(join(root, file), content);
}

test("lists root and nested package scripts with detected package managers", async () => {
  const root = await mkdtemp(join(tmpdir(), "npm-scripts-"));
  await write(root, "package.json", JSON.stringify({ packageManager: "pnpm@9.1.0", scripts: { dev: "vite" } }));
  await write(root, "bun.lock", "");
  await write(root, "apps/backend/package.json", JSON.stringify({ scripts: { dev: "wrangler dev", "lint:fix": 1 } }));
  await write(root, "apps/backend/node_modules/pkg/package.json", JSON.stringify({ scripts: { x: "y" } }));
  await write(root, "broken/package.json", "{ not json");
  await write(root, "empty/package.json", JSON.stringify({ name: "empty" }));

  const packages = await listNpmScripts(root);

  assert.deepEqual(
    packages.map(({ path, packageManager, scripts }) => ({ path, packageManager, scripts })),
    [
      { path: ".", packageManager: "pnpm", scripts: [{ name: "dev", body: "vite" }] },
      { path: "apps/backend", packageManager: "bun", scripts: [{ name: "dev", body: "wrangler dev" }] },
    ],
  );
});

test("a missing root throws so the panel can show an error", async () => {
  await assert.rejects(listNpmScripts(join(tmpdir(), "npm-scripts-missing-root-does-not-exist")));
});
