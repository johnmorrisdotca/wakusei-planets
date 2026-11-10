// The citation file is what GitHub's "Cite this repository" button reads: its version must be the package's, and what it names must be where it says.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const cff = readFileSync("CITATION.cff", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { name: string; version: string };

test("CITATION.cff has the fields the format needs, the package's version, the repository and the MIT licence", () => {
  assert.match(cff, /^cff-version: 1\.2\.0$/m);
  for (const key of ["message", "title", "authors", "version", "repository-code", "license"]) assert.match(cff, new RegExp(`^${key}:`, "m"), key);
  assert.match(cff, /^ {2}- family-names: Morris\n {4}given-names: John$/m);
  assert.match(cff, /^repository-code: "https:\/\/github\.com\/johnmorrisdotca\/wakusei-planets"$/m);
  assert.match(cff, /^license: MIT$/m);
  assert.match(cff, new RegExp(`^repository-artifact: "https://www\\.npmjs\\.com/package/${pkg.name}"$`, "m"));
});

test("CITATION.cff names the version in package.json: change both together when you release", () => {
  assert.match(cff, new RegExp(`^version: ${pkg.version.replace(/\./g, "\\.")}$`, "m"));
});

test("the README's citation names the same version", () => {
  const readme = readFileSync("README.md", "utf8");
  assert.ok(readme.includes(`*Wakusei Planets* (version ${pkg.version}) [Computer software]`), "README.md's How to cite names the package's version");
});
