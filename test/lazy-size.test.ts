// A page that shows one planet must not carry Jupiter's and Saturn's moon theories: the web component fetches them only when it draws those moons. With code splitting (what Vite and webpack do for
// a dynamic import) the component's own chunk stays at its old size and each theory is a chunk of its own.
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import { moonTheoryOf } from "../src/data/theories.ts";
import { loadMoonTheory } from "../src/tables/lazy.ts";

const root = new URL("..", import.meta.url).pathname;
const bundle = async (contents: string, splitting = true) => {
  const result = await build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, splitting, format: "esm", minify: true, outdir: "out", write: false, logLevel: "silent", platform: "browser", target: "es2020", external: ["three", "@johnmorrisdotca/kazoku-ui*"], loader: { ".css": "text", ".svg": "text", ".txt": "text" } });
  const files = result.outputFiles.map((file) => ({ text: file.text, gzip: gzipSync(file.contents, { level: 9 }).length }));
  return { entry: files.find((file) => !/\/chunk-/.test(result.outputFiles[files.indexOf(file)]!.path))!, chunks: files.filter((file) => file !== files[0]) };
};

test("the web component's own chunk does not hold the Galilean or Saturnian theory, and each theory is a chunk of its own", async () => {
  const lazy = await bundle(`import "./src/element.ts";`);
  const eager = await bundle(`import "./src/element.ts";`, false);
  const all = [lazy.entry, ...lazy.chunks];
  const holders = all.filter((file) => file.text.includes("1.4462132960212"));
  assert.equal(holders.length, 1, "Jupiter's terms are in one chunk");
  assert.notEqual(holders[0], lazy.entry, "and it is not the component's");
  assert.ok(!lazy.entry.text.includes("1.4462132960212"));
  assert.ok(lazy.entry.gzip + 10_000 < eager.entry.gzip, `component ${lazy.entry.gzip} bytes gzipped, in one piece with the theories inside it ${eager.entry.gzip}`);
  console.log(`web component chunk, gzipped: ${lazy.entry.gzip} bytes lazy, ${eager.entry.gzip} bytes in one piece with both theories in it; theory chunks ${lazy.chunks.map((c) => c.gzip).join(", ")}`);
});

test("asking for a planet's moons loads its theory once, and a planet without one is left alone", async () => {
  assert.equal(moonTheoryOf("io"), undefined);
  assert.equal(await loadMoonTheory("earth"), false);
  const first = loadMoonTheory("jupiter");
  assert.equal(await loadMoonTheory("jupiter"), false, "a second ask while it loads does not load again");
  assert.equal(await first, true);
  assert.ok(moonTheoryOf("io") !== undefined);
  assert.equal(await loadMoonTheory("jupiter"), false);
  assert.equal(moonTheoryOf("titan"), undefined, "Saturn's theory is not fetched for Jupiter");
});
