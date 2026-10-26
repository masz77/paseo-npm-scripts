import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import type { NpmScriptPackage, PackageManager } from "../shared/npm-scripts";

// why: dependency and build output folders hold package.json files that are not project scripts,
// and walking node_modules is the slow part of a scan.
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "build", "out", "coverage"]);
// why: bounds the walk so a large monorepo cannot stall the daemon; deeper packages are not listed.
const MAX_DEPTH = 4;
const PACKAGE_MANAGERS: readonly PackageManager[] = ["npm", "pnpm", "yarn", "bun"];
// why: checked in order, so bun.lock wins over an older bun.lockb in the same folder.
const LOCKFILES: readonly [string, PackageManager][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
];

async function exists(path: string) {
  return stat(path).then(
    () => true,
    () => false,
  );
}

async function findPackageDirs(dir: string, depth: number, found: string[]) {
  if (await exists(join(dir, "package.json"))) found.push(dir);
  if (depth === MAX_DEPTH) return;
  // why: the root must throw so a bad path shows an error; a subfolder we cannot read should not hide the rest.
  const entries = await readdir(dir, { withFileTypes: true }).catch((error: unknown) => {
    if (depth === 0) throw error;
    return [];
  });
  for (const entry of entries) {
    // why: symlinks are not followed, so a link cycle cannot loop the walk.
    if (!entry.isDirectory() || entry.name.startsWith(".") || SKIPPED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    await findPackageDirs(join(dir, entry.name), depth + 1, found);
  }
}

async function readManifest(dir: string) {
  const text = await readFile(join(dir, "package.json"), "utf8");
  try {
    const manifest: unknown = JSON.parse(text);
    return typeof manifest === "object" && manifest !== null ? manifest : null;
  } catch {
    // why: a broken package.json in one folder should not hide the other packages.
    return null;
  }
}

function scriptEntries(manifest: object) {
  const scripts = "scripts" in manifest ? manifest.scripts : undefined;
  if (typeof scripts !== "object" || scripts === null) return [];
  return Object.entries(scripts)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, body]) => ({ name, body }));
}

function declaredPackageManager(manifest: object): PackageManager | null {
  // why: packageManager is a corepack field like "pnpm@9.1.0"; only the name before "@" matters here.
  const declared = "packageManager" in manifest ? manifest.packageManager : undefined;
  if (typeof declared !== "string") return null;
  const name = declared.split("@")[0] as PackageManager;
  return PACKAGE_MANAGERS.includes(name) ? name : null;
}

async function lockfilePackageManager(dir: string, root: string): Promise<PackageManager> {
  // why: a monorepo keeps one lockfile at the root, so a subpackage looks upward until the root.
  for (let current = dir; ; current = dirname(current)) {
    for (const [file, manager] of LOCKFILES) {
      if (await exists(join(current, file))) return manager;
    }
    if (current === root || dirname(current) === current) return "npm";
  }
}

export async function listNpmScripts(root: string): Promise<NpmScriptPackage[]> {
  const absoluteRoot = resolve(root);
  const dirs: string[] = [];
  await findPackageDirs(absoluteRoot, 0, dirs);

  const packages: NpmScriptPackage[] = [];
  for (const dir of dirs) {
    const manifest = await readManifest(dir);
    if (!manifest) continue;
    const scripts = scriptEntries(manifest);
    if (scripts.length === 0) continue;
    const packageManager =
      declaredPackageManager(manifest) ?? (await lockfilePackageManager(dir, absoluteRoot));
    packages.push({
      path: relative(absoluteRoot, dir) || ".",
      dir,
      packageManager,
      scripts,
    });
  }

  return packages.sort((a, b) => {
    if (a.path === b.path) return 0;
    if (a.path === ".") return -1;
    if (b.path === ".") return 1;
    return a.path.localeCompare(b.path);
  });
}
