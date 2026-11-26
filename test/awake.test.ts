// A long local browser check holds the Mac awake (MODULES-572): an idle-sleep assertion on macOS, and the same command everywhere else.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { awakeCommand } from "../scripts/awake.mjs";

test("a Mac wraps the command in an idle-sleep assertion and nowhere else changes it", () => {
  assert.deepEqual(awakeCommand("darwin", ["playwright", "test", "--project=freeze"]), { command: "caffeinate", args: ["-i", "playwright", "test", "--project=freeze"] });
  assert.deepEqual(awakeCommand("linux", ["playwright", "test"]), { command: "playwright", args: ["test"] });
  assert.deepEqual(awakeCommand("win32", ["node", "scripts/screenshots.ts"]), { command: "node", args: ["scripts/screenshots.ts"] });
});

test("an empty command is refused", () => {
  assert.throws(() => awakeCommand("darwin", []), /command/);
});

test("the long local browser commands hold that assertion", () => {
  const scripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts as Record<string, string>;
  for (const name of ["test:demo", "test:demo:one", "test:freeze", "test:soak", "screenshots"]) {
    assert.match(scripts[name], /node scripts\/awake\.mjs /, name);
  }
});
