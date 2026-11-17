// The public API is held still: every export of every published entry point, with its signature, is in test/api-snapshot.txt. A change that was not meant fails here; one that is meant is recorded with `pnpm api:update`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
// @ts-expect-error: a script with no types of its own
import { surfaceOf } from "../scripts/api-surface.mjs";

test("the public API is what test/api-snapshot.txt records", () => {
  const recorded = readFileSync(new URL("./api-snapshot.txt", import.meta.url), "utf8");
  const now: string = surfaceOf();
  if (now === recorded) return;
  const was = new Set(recorded.split("\n"));
  const is = new Set(now.split("\n"));
  const gone = [...was].filter((line) => !is.has(line));
  const added = [...is].filter((line) => !was.has(line));
  assert.fail(`The public API changed. If you meant it, run pnpm api:update and commit test/api-snapshot.txt with the reason in the CHANGELOG.\nRemoved or changed:\n${gone.slice(0, 20).map((l) => `- ${l.slice(0, 160)}`).join("\n")}\nAdded or changed:\n${added.slice(0, 20).map((l) => `+ ${l.slice(0, 160)}`).join("\n")}`);
});
