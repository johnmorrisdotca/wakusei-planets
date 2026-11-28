// /sky and its optional peer: astronomy-engine is reached from src/sky.ts and from nowhere else, and a missing peer names itself.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { exports: Record<string, string | { import?: string }>; peerDependencies: Record<string, string>; peerDependenciesMeta: Record<string, { optional?: boolean }>; devDependencies: Record<string, string> };

/** The source files under src/, as paths from the root. */
function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? sources(`${dir}/${entry.name}`) : /\.ts$/.test(entry.name) ? [`${dir}/${entry.name}`] : []));
}

test("astronomy-engine is declared an optional peer, in the range the plan chose, and stays the dev dependency the tests resolve", () => {
  assert.equal(pkg.peerDependencies["astronomy-engine"], ">=2.1.19 <3");
  assert.equal(pkg.peerDependenciesMeta["astronomy-engine"]?.optional, true);
  assert.equal(pkg.devDependencies["astronomy-engine"], "2.1.19");
  assert.equal((pkg.exports["./sky"] as { import: string }).import, "./dist/sky.js");
});

test("only src/sky.ts imports astronomy-engine: no other source file of src/ does", () => {
  const importers = sources("src").filter((file) => /from\s+["']astronomy-engine["']|import\(\s*["']astronomy-engine["']|require\(\s*["']astronomy-engine["']/.test(readFileSync(join(root, file), "utf8")));
  assert.deepEqual(importers, ["src/sky.ts"]);
});

test("the core and every other entry point never reach the peer: each one's import graph, by esbuild, has no astronomy-engine in it", async () => {
  const entries = Object.entries(pkg.exports).filter(([key]) => key !== "./sky").flatMap(([, value]) => (typeof value === "object" && value.import !== undefined ? [value.import.replace("./dist/", "src/").replace(/\.js$/, ".ts")] : [])).filter((file) => existsSync(join(root, file)));
  assert.ok(entries.length > 50, `found ${entries.length} entry points`);
  for (const entry of entries) {
    const result = await build({ entryPoints: [join(root, entry)], bundle: true, write: false, metafile: true, format: "esm", platform: "neutral", packages: "external", external: ["three", "node:*"], logLevel: "silent", outdir: "out", loader: { ".css": "text", ".svg": "text", ".txt": "text" } });
    const reached = Object.values(result.metafile.outputs).flatMap((output) => output.imports.map((one) => one.path));
    assert.ok(!reached.some((path) => path.startsWith("astronomy-engine")), `${entry} reaches astronomy-engine`);
    assert.ok(!Object.keys(result.metafile.inputs).some((path) => path.endsWith("src/sky.ts")), `${entry} reaches src/sky.ts`);
  }
});

test("/sky stays independent of rendering, the browser and the star catalogue", async () => {
  const result = await build({ entryPoints: [join(root, "src/sky.ts")], bundle: true, write: false, metafile: true, format: "esm", platform: "neutral", packages: "external", logLevel: "silent", outdir: "out" });
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(inputs.every((path) => /^src\/(sky|minimum|star-position|vec|when)\.ts$/.test(path)), `src/sky.ts reaches ${inputs.join(", ")}`);
});

test("with the peer missing, importing /sky fails at once and the error names astronomy-engine", () => {
  const program = `import { registerHooks } from "node:module";
registerHooks({ resolve(specifier, context, next) { if (specifier === "astronomy-engine") { const e = new Error("Cannot find package 'astronomy-engine' imported from " + context.parentURL); e.code = "ERR_MODULE_NOT_FOUND"; throw e; } return next(specifier, context); } });
try { await import(${JSON.stringify(join(root, "src/sky.ts"))}); console.log("LOADED"); } catch (error) { console.log(error.code + " " + error.message); }`;
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", program], { encoding: "utf8" }).trim();
  assert.match(out, /^ERR_MODULE_NOT_FOUND Cannot find package 'astronomy-engine'/);
});
