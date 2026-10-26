import type { NpmScriptPackage } from "./npm-scripts";

const DONE_MARKER = "__PASEO_NPM_SCRIPTS_DONE__";
// why: the typed command splits the marker with '' so its echo never matches the printed marker.
const TYPED_MARKER = "__PASEO_NPM_SCRIPTS_''DONE__";
// why: room for a two-line prompt (e.g. starship) after the marker; more output means the shell is busy.
const MAX_LINES_AFTER_MARKER = 2;

export function scriptTerminalName(pkg: Pick<NpmScriptPackage, "path">) {
  return pkg.path === "." ? "npm scripts" : `npm scripts · ${pkg.path}`;
}

// why: the command runs in an interactive shell, so the name is quoted for POSIX sh.
function shellQuote(value: string) {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

export function scriptCommand(packageManager: string, scriptName: string) {
  // why: zsh drops the rest of a `;` list after Ctrl-C; the trapped subshell exits normally,
  // so the marker still prints when a dev server is stopped. POSIX shells only (not fish).
  return `(trap 'exit 130' INT; ${packageManager} run ${shellQuote(scriptName)}); echo ${TYPED_MARKER}`;
}

type CaptureTail = (start: number) => Promise<{ lines: string[]; totalLines: number }>;

// why: capture includes the empty screen rows below the prompt, so a fixed tail can be all blank;
// widen the window until it reaches text instead of pulling the whole scrollback every time.
export async function captureTail(capture: CaptureTail) {
  for (let size = 64; ; size *= 4) {
    const { lines, totalLines } = await capture(-size);
    if (lines.some((line) => line.trim().length > 0) || size >= totalLines) return lines;
  }
}

// shortcut: only knows about commands this plugin typed; input typed by hand after the marker
// that prints nothing (e.g. `tail -f`) still looks idle. Upgrade when the SDK exposes shell state.
export function isIdleCapture(lines: readonly string[]) {
  const visible = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  const markerIndex = visible.lastIndexOf(DONE_MARKER);
  if (markerIndex === -1) return false;
  const after = visible.slice(markerIndex + 1);
  return after.length <= MAX_LINES_AFTER_MARKER && !after.some((line) => line.includes(TYPED_MARKER));
}
