// The family's must-have list as a check (kazoku-ui templates/check-standard.mjs, copied unchanged and held to one recorded hash).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

interface Standard {
  STANDARD_VERSION: string;
  standardOf(root: string): { missing: { item: string; say: string }[]; exempted: { item: string; reason: string }[] };
}
const standard = (await import(new URL("../scripts/check-standard.mjs", import.meta.url).href)) as Standard;
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

test("the checker is the recorded file, byte for byte", () => {
  assert.equal(standard.STANDARD_VERSION, "2026-11-03");
  assert.equal(sha("scripts/check-standard.mjs"), "f9197b71745fc6598e8bfb70c7265814b910a775fdf96c5b1b7ab2129772859f");
});

test("every item of the must-have list is there", () => {
  assert.deepEqual(standard.standardOf(".").missing, []);
});
