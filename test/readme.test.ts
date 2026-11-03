import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const readme = readFileSync("README.md", "utf8");
const version = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
const sources = [...readme.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!).concat([...readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]!));

test("every picture in the README is an absolute address, so npm's page shows the same picture as GitHub's", () => {
  assert.ok(sources.length >= 3);
  for (const src of sources) assert.match(src, /^https:\/\//, src);
});

// The family's thumbnail at the top is the one exception: its address is on main, so the README always shows the newest
// card (scripts/family-thumbnail.mjs, checked by test/family-thumbnail.test.ts).
const FAMILY_THUMBNAIL = "https://raw.githubusercontent.com/johnmorrisdotca/wakusei-planets/main/docs/images/thumbnail.png";

test("the README's own pictures are the files of this version's tag, and the files exist", () => {
  const own = sources.filter((src) => src.includes("raw.githubusercontent.com/johnmorrisdotca/wakusei-planets/") && src !== FAMILY_THUMBNAIL);
  assert.ok(own.length >= 2, "the hero and the lineup are there");
  for (const src of own) {
    const m = /wakusei-planets\/v([0-9.]+)\/(docs\/images\/[\w-]+\.png)$/.exec(src);
    assert.ok(m, src);
    assert.equal(m![1], version, `${src} is pinned to v${m![1]}, not v${version}`);
    assert.ok(existsSync(m![2]!), m![2]);
  }
});
