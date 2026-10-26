import assert from "node:assert/strict";
import { test } from "node:test";
import { captureTail, isIdleCapture, scriptCommand } from "./terminal-reuse.ts";

const command = scriptCommand("bun", "dev");

test("a terminal is idle once the done marker is followed only by a prompt", () => {
  assert.equal(isIdleCapture([`% ${command}`, "ready", "__PASEO_NPM_SCRIPTS_DONE__", "", "% "]), true);
  assert.equal(isIdleCapture(["__PASEO_NPM_SCRIPTS_DONE__", "~/app on main", "❯"]), true);
});

test("a terminal is busy while a script runs or before any script finished", () => {
  assert.equal(isIdleCapture([`% ${command}`, "starting"]), false);
  assert.equal(isIdleCapture([`% ${command}`, "a", "b", "c"]), false);
  // A reused terminal right after the next command was typed.
  assert.equal(isIdleCapture(["__PASEO_NPM_SCRIPTS_DONE__", `% ${command}`]), false);
  // Output after the marker means something else is running.
  assert.equal(isIdleCapture(["__PASEO_NPM_SCRIPTS_DONE__", "% ", "log 1", "log 2"]), false);
});

test("the command quotes the script name and never echoes the printed marker", () => {
  assert.equal(scriptCommand("npm", "it's"), `(trap 'exit 130' INT; npm run 'it'\\''s'); echo __PASEO_NPM_SCRIPTS_''DONE__`);
  assert.equal(command.includes("__PASEO_NPM_SCRIPTS_DONE__"), false);
});

test("the tail capture skips the empty screen rows below the prompt", async () => {
  // The screen from the bug report: Ctrl-C, marker, prompt, then 80 empty rows.
  const screen = [
    "  ➜  press h + enter to show help",
    "^C",
    'error: script "dev" exited with code 130',
    "__PASEO_NPM_SCRIPTS_DONE__",
    " sam@samini  ~/Developer/vl2idle   main ",
    ...Array.from({ length: 80 }, () => ""),
  ];
  const starts: number[] = [];
  const lines = await captureTail(async (start) => {
    starts.push(start);
    return { lines: screen.slice(start), totalLines: screen.length };
  });
  assert.deepEqual(starts, [-64, -256]);
  assert.equal(isIdleCapture(lines), true);
});

test("the tail capture stops on an empty terminal", async () => {
  const lines = await captureTail(async () => ({ lines: ["", ""], totalLines: 2 }));
  assert.deepEqual(lines, ["", ""]);
});
