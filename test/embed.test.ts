// Every snippet the "Put it in your page" configurator writes is built, parsed or run here, for every kind and for the choices that change them (a shaded look loads the body's own entry; a time and moons add attributes).
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { parseTemplate } from "@angular/compiler";
import { build } from "esbuild";
import { compile } from "svelte/compiler";
import ts from "typescript";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";
import { BODY_IDS, embedCode, embedCredit, EMBED_KINDS, type EmbedOptions } from "../src/index.ts";
import { entryOf } from "../src/embed.ts";

const CHOICES: EmbedOptions[] = [
  { body: "jupiter", look: "realistic" },
  { body: "saturn", look: "line", size: 240 },
  { body: "mars", look: "painted", time: "2026-11-02T12:00:00.000Z", turn: 12 },
  { body: "io", look: "painted", time: "now", moons: true },
  { body: "jupiter", look: "realistic", time: "now", moons: true, size: 480 },
  { body: "earth", look: "painted" },
];

const syntax = (code: string, tsx = false): ts.Diagnostic[] => ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, ...(tsx ? {} : {}) }, fileName: tsx ? "x.tsx" : "x.ts" }).diagnostics ?? [];

test("a plain page: script tags from the CDN, the body's own entry only for a shaded look, and the element", () => {
  const line = embedCode({ body: "saturn", look: "line" }, "html");
  assert.match(line, /element\/\+esm/);
  assert.doesNotMatch(line, /saturn\/\+esm/);
  const shaded = embedCode({ body: "saturn", look: "painted" }, "html");
  assert.match(shaded, /saturn\/\+esm/);
  assert.match(shaded, /<wakusei-body body="saturn" look="painted"><\/wakusei-body>/);
  assert.match(embedCode({ body: "io", look: "realistic", time: "now", moons: true }, "html"), /moons-jupiter\/\+esm/);
  assert.match(embedCode({ body: "jupiter", look: "realistic", time: "now", moons: true }, "html"), /time="now" moons>/);
  assert.doesNotMatch(embedCode({ body: "jupiter", look: "realistic", moons: true }, "html"), /moons/, "moons need a date");
  assert.match(embedCode({ body: "mars", look: "line", size: 240 }, "html"), /size="240"/);
});

test("every body's entry point exists in the package", async () => {
  const pkg = (await import("../package.json", { with: { type: "json" } })).default as { exports: Record<string, unknown> };
  for (const id of BODY_IDS) assert.ok(`./${entryOf(id)}` in pkg.exports, `${id}: ./${entryOf(id)}`);
});

test("the ES module and the Angular component are valid TypeScript, and the Angular template parses", () => {
  for (const o of CHOICES) {
    assert.deepEqual(syntax(embedCode(o, "module")).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], JSON.stringify(o));
    const angular = embedCode(o, "angular");
    assert.deepEqual(syntax(angular).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], JSON.stringify(o));
    const template = /template: `([^`]*)`/.exec(angular)![1]!;
    const parsed = parseTemplate(template, "planet.component.ts");
    assert.deepEqual(parsed.errors ?? [], []);
    assert.ok(parsed.nodes.length >= 1);
  }
});

test("the React component builds and renders the element with its attributes", async () => {
  const dir = new URL("../.cache/embed-test/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  try {
    for (const [i, o] of CHOICES.entries()) {
      const source = new URL(`planet${i}.tsx`, dir).pathname;
      writeFileSync(source, `declare module "react" { namespace JSX { interface IntrinsicElements { "wakusei-body": any } } }\n${embedCode(o, "react")}`);
      const out = new URL(`planet${i}.mjs`, dir).pathname;
      await build({ entryPoints: [source], outfile: out, bundle: true, format: "esm", platform: "node", jsx: "automatic", external: ["@johnmorrisdotca/wakusei-planets/*", "react", "react/*"], logLevel: "silent" });
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { createElement } = await import("react");
      const mod = (await import(`${out}?${i}`)) as { Planet: () => unknown };
      const html = renderToStaticMarkup(createElement(mod.Planet as never));
      assert.match(html, new RegExp(`<wakusei-body body="${o.body}"`), html);
      assert.match(html, new RegExp(`look="${o.look ?? "realistic"}"`), html);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the Vue component compiles, script and template, and names the element", () => {
  for (const o of CHOICES) {
    const { descriptor, errors } = parse(embedCode(o, "vue"));
    assert.deepEqual(errors, []);
    const script = compileScript(descriptor, { id: "planet" });
    assert.match(script.content, /onMounted/);
    const template = compileTemplate({ source: descriptor.template!.content, filename: "Planet.vue", id: "planet" });
    assert.deepEqual(template.errors, []);
    assert.match(template.code, /wakusei-body/);
  }
});

test("the Svelte component compiles", () => {
  for (const o of CHOICES) {
    const result = compile(embedCode(o, "svelte"), { filename: "Planet.svelte", generate: "client" });
    assert.equal(result.warnings.filter((w) => w.code !== "custom_element_props_identifier").length, 0, JSON.stringify(o));
    assert.match(result.js.code, /wakusei-body/);
  }
});

test("the iframe points at the demo's embed page with the same names the page reads", () => {
  const code = embedCode({ body: "jupiter", look: "painted", time: "2026-11-02T12:00:00.000Z", moons: true, turn: 8, size: 400 }, "iframe", { site: "https://example.com/w/" });
  const src = /src="([^"]+)"/.exec(code)![1]!.replace(/&amp;/g, "&");
  const url = new URL(src);
  assert.equal(url.origin + url.pathname, "https://example.com/w/embed.html");
  assert.equal(url.searchParams.get("body"), "jupiter");
  assert.equal(url.searchParams.get("look"), "painted");
  assert.equal(url.searchParams.get("moons"), "1");
  assert.equal(url.searchParams.get("turn"), "8");
  assert.match(code, /width="400"/);
});

test("there is a snippet for every kind, and the credit names what is used", () => {
  for (const kind of EMBED_KINDS) assert.ok(embedCode({ body: "mars", look: "painted" }, kind).includes("mars"), kind);
  assert.match(embedCredit({ body: "mars", look: "painted" }), /public domain/);
  assert.doesNotMatch(embedCredit({ body: "mars", look: "line" }), /public domain/);
  assert.match(embedCredit({ body: "earth", look: "painted" }), /Blue Marble/);
});
