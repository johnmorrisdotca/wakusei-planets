// The copy-paste snippet and the texture addresses name VERSION, so a release that bumps package.json only would ship the old package.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { VERSION } from "../src/version.ts";

test("VERSION matches package.json", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  assert.equal(VERSION, pkg.version);
});
