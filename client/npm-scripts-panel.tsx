import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { usePaseo, useRpc, useWorkspace } from "@getpaseo/plugin/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { NpmScriptPackage } from "../shared/npm-scripts";
import { listNpmScriptsRpc } from "../shared/npm-scripts";
import { captureTail, isIdleCapture, scriptCommand, scriptTerminalName } from "../shared/terminal-reuse";

type RunRequest = { pkg: NpmScriptPackage; script: NpmScriptPackage["scripts"][number] };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export function NpmScriptsPanel({ workspaceId, theme }: PluginWorkspacePanelProps) {
  const directory = useWorkspace(workspaceId, (workspace) => workspace.directory);
  const paseo = usePaseo();
  const listScripts = useRpc(listNpmScriptsRpc);
  const claimed = useRef(new Set<string>());

  const scripts = useQuery({
    queryKey: ["npm-scripts", workspaceId, directory],
    queryFn: () => listScripts({ root: directory ?? "" }),
    enabled: directory !== null,
  });

  const run = useMutation({
    mutationFn: async ({ pkg, script }: RunRequest) => {
      const workspace = paseo.workspaces.ref(workspaceId);
      const name = scriptTerminalName(pkg);
      const { entries } = await workspace.terminals.list();
      let terminal = null;
      for (const entry of entries) {
        // why: only reuse terminals this plugin opened for this folder; other terminals give no idle signal.
        if (entry.name !== name || entry.cwd !== pkg.dir || claimed.current.has(entry.id)) continue;
        const handle = paseo.terminals.ref(entry);
        const lines = await captureTail((start) => handle.capture({ start }));
        if (isIdleCapture(lines)) {
          terminal = handle;
          break;
        }
      }
      terminal ??= await workspace.terminals.create({ name, cwd: pkg.dir });
      // why: a second click can capture before the shell echoes the first command, so hold the
      // terminal until its screen shows that command.
      claimed.current.add(terminal.id);
      const claimedId = terminal.id;
      setTimeout(() => claimed.current.delete(claimedId), 1000);
      terminal.write(scriptCommand(pkg.packageManager, script.name));
      terminal.sendKeys(["Enter"]);
    },
  });

  const styles = useMemo(
    () => ({
      panel: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding: 12, gap: 12 },
      header: { flexDirection: "row" as const, justifyContent: "space-between" as const },
      title: { color: theme.colors.foreground, fontWeight: "600" as const },
      muted: { color: theme.colors.foregroundMuted, fontSize: 12 },
      error: { color: theme.colors.foreground, fontSize: 12 },
      group: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 6,
        overflow: "hidden" as const,
      },
      rootGroup: { borderColor: theme.colors.accent },
      groupHeader: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: theme.colors.surface2,
      },
      groupTitle: { flex: 1, color: theme.colors.foreground, fontSize: 12, fontWeight: "600" as const },
      badge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        backgroundColor: theme.colors.accent,
      },
      badgeText: { color: theme.colors.accentForeground, fontSize: 11, fontWeight: "600" as const },
      row: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      },
      rowText: { flex: 1 },
      name: { color: theme.colors.foreground },
      button: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: theme.colors.accent,
      },
      buttonText: { color: theme.colors.accentForeground, fontSize: 12 },
    }),
    [theme],
  );

  const packages = scripts.data?.packages ?? [];

  return (
    <ScrollView style={styles.panel} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>NPM scripts</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh scripts"
          onPress={() => void scripts.refetch()}
        >
          <Text style={styles.muted}>Refresh</Text>
        </Pressable>
      </View>

      {scripts.isPending ? <Text style={styles.muted}>Loading scripts…</Text> : null}
      {scripts.isError ? (
        <Text style={styles.error}>Could not read package.json files: {errorMessage(scripts.error)}</Text>
      ) : null}
      {scripts.isSuccess && packages.length === 0 ? (
        <Text style={styles.muted}>No package.json scripts in this project.</Text>
      ) : null}

      {packages.map((pkg) => (
        <View key={pkg.path} style={pkg.path === "." ? [styles.group, styles.rootGroup] : styles.group}>
          <View style={styles.groupHeader}>
            {pkg.path === "." ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Root</Text>
              </View>
            ) : null}
            <Text style={styles.groupTitle} numberOfLines={1}>
              {pkg.path === "." ? "package.json" : `${pkg.path}/package.json`}
            </Text>
            <Text style={styles.muted}>{pkg.packageManager}</Text>
          </View>
          {pkg.scripts.map((script) => (
            <View key={script.name} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.name}>{script.name}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {script.body}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Run ${script.name}`}
                style={styles.button}
                onPress={() => run.mutate({ pkg, script })}
              >
                <Text style={styles.buttonText}>Run</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ))}

      {run.isError ? (
        <Text style={styles.error}>Could not start the script: {errorMessage(run.error)}</Text>
      ) : null}
    </ScrollView>
  );
}
