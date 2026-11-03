// Pin the README's pictures to this version's tag: npm shows the README away from the repository, so each picture is an absolute raw.githubusercontent.com address, and it must be the picture of
// the release the page belongs to. Run after a version bump: `node scripts/readme-images.mjs`.
import { readFileSync, writeFileSync } from "node:fs";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const path = new URL("../README.md", import.meta.url);
const text = readFileSync(path, "utf8");
const next = text.replace(/(raw\.githubusercontent\.com\/johnmorrisdotca\/wakusei-planets\/)v[0-9.]+(\/docs\/images\/)/g, `$1v${version}$2`);
if (next !== text) writeFileSync(path, next);
console.log(`README pictures pinned to v${version}`);
