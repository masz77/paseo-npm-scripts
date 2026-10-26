import type { PluginClientContext } from "@getpaseo/plugin/client";
import { NpmScriptsPanel } from "./client/npm-scripts-panel";

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({
    id: "npm-scripts",
    title: "NPM Scripts",
    icon: "Terminal",
    context: "workspace",
    locations: ["explorer"],
    Component: NpmScriptsPanel,
  });
  return () => {};
}
