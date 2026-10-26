import type { PluginServerContext } from "@getpaseo/plugin/server";
import { listNpmScripts } from "./server/npm-scripts";
import { listNpmScriptsRpc } from "./shared/npm-scripts";

export default function contribute(server: PluginServerContext) {
  server.handle(listNpmScriptsRpc, async ({ root }) => ({ packages: await listNpmScripts(root) }));
  return () => {};
}
