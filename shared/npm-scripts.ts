import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const packageManagerSchema = z.enum(["npm", "pnpm", "yarn", "bun"]);

export const npmScriptPackageSchema = z.object({
  // Relative to the scanned root; "." is the root package.
  path: z.string(),
  dir: z.string(),
  packageManager: packageManagerSchema,
  scripts: z.array(z.object({ name: z.string(), body: z.string() })),
});

export type PackageManager = z.infer<typeof packageManagerSchema>;
export type NpmScriptPackage = z.infer<typeof npmScriptPackageSchema>;

export const listNpmScriptsRpc = defineRpc({
  name: "npm-scripts.list",
  input: z.object({ root: z.string().min(1) }),
  output: z.object({ packages: z.array(npmScriptPackageSchema) }),
});
