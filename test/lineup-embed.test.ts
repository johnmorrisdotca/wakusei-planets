// Every snippet the size line-up's "Put it in your page" writes is built, parsed or run here, for every kind and for the choices that change them.
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { parseTemplate } from "@angular/compiler";
import { build } from "esbuild";
import { compile } from "svelte/compiler";
import ts from "typescript";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";
import { EMBED_KINDS, lineupCode, lineupCredit, type LineupEmbed } from "../src/index.ts";

const CHOICES: LineupEmbed[] = [
  {},
  { stars: "bright", planets: true, at: "betelgeuse" },
  { stars: "largest", layout: "stack", zoom: 0.9123456, turn: false, width: 480 },
  { stars: ["sun", "rigel", "antares"], look: "painted", lang: "ja", planets: true },
];

const diagnostics = (code: string): string[] => (ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }, fileName: "x.ts" }).diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));

test("a plain page: one script tag from the CDN for the lineup's entry point, and the element with only the attributes that are not the default", () => {
  const plain = lineupCode({}, "html");
  assert.match(plain, /lineup\/\+esm/);
  assert.match(plain, /<wakusei-lineup ?><\/wakusei-lineup>/);
  const code = lineupCode({ stars: "bright", planets: true, layout: "stack", at: "betelgeuse", turn: false, look: "painted", lang: "ja", width: 480 }, "html");
  assert.match(code, /<wakusei-lineup stars="bright" planets layout="stack" at="betelgeuse" turn="off" look="painted" lang="ja" size="480"><\/wakusei-lineup>/);
  assert.match(lineupCode({ stars: ["sun", "rigel"] }, "html"), /stars="sun,rigel"/);
  assert.match(lineupCode({ at: "betelgeuse", zoom: 0.25 }, "html"), /zoom="0.25"/, "a zoom beats `at`");
  assert.doesNotMatch(lineupCode({ at: "betelgeuse", zoom: 0.25 }, "html"), /at="/);
  assert.doesNotMatch(lineupCode({ at: "sun" }, "html"), / at=/, "the Sun is where it starts anyway");
  assert.doesNotMatch(lineupCode({ stars: "all" }, "html"), /stars=/);
});

test("the ES module and the Angular component are valid TypeScript, and the Angular template parses", () => {
  for (const o of CHOICES) {
    assert.deepEqual(diagnostics(lineupCode(o, "module")), [], JSON.stringify(o));
    const angular = lineupCode(o, "angular");
    assert.deepEqual(diagnostics(angular), [], JSON.stringify(o));
    const template = /template: `([^`]*)`/.exec(angular)![1]!;
    const parsed = parseTemplate(template, "lineup.component.ts");
    assert.deepEqual(parsed.errors ?? [], []);
    assert.ok(parsed.nodes.length >= 1);
    assert.match(template, /wakusei-lineup/);
  }
});

test("the React component builds and renders the element with its attributes", async () => {
  const dir = new URL("../.cache/lineup-embed-test/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  try {
    for (const [i, o] of CHOICES.entries()) {
      const source = new URL(`lineup${i}.tsx`, dir).pathname;
      writeFileSync(source, `declare module "react" { namespace JSX { interface IntrinsicElements { "wakusei-lineup": any } } }\n${lineupCode(o, "react")}`);
      const out = new URL(`lineup${i}.mjs`, dir).pathname;
      await build({ entryPoints: [source], outfile: out, bundle: true, format: "esm", platform: "node", jsx: "automatic", external: ["@johnmorrisdotca/wakusei-planets/*", "react", "react/*"], logLevel: "silent" });
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { createElement } = await import("react");
      const mod = (await import(`${out}?${i}`)) as { Lineup: () => unknown };
      const html = renderToStaticMarkup(createElement(mod.Lineup as never));
      assert.match(html, /<wakusei-lineup/, html);
      if (o.stars === "bright") assert.match(html, /stars="bright"/, html);
      if (o.planets === true) assert.match(html, /planets/, html);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the Vue component and the Svelte component compile and name the element", () => {
  for (const o of CHOICES) {
    const { descriptor, errors } = parse(lineupCode(o, "vue"));
    assert.deepEqual(errors, []);
    assert.match(compileScript(descriptor, { id: "lineup" }).content, /onMounted/);
    const template = compileTemplate({ source: descriptor.template!.content, filename: "Lineup.vue", id: "lineup" });
    assert.deepEqual(template.errors, []);
    assert.match(template.code, /wakusei-lineup/);
    const svelte = compile(lineupCode(o, "svelte"), { filename: "Lineup.svelte", generate: "client" });
    assert.equal(svelte.warnings.filter((w) => w.code !== "custom_element_props_identifier").length, 0, JSON.stringify(o));
    assert.match(svelte.js.code, /wakusei-lineup/);
  }
});

test("the iframe points at the demo's embed page with the same names the page reads", () => {
  const code = lineupCode({ stars: "largest", planets: true, layout: "stack", zoom: 0.5, turn: false, look: "painted", width: 640 }, "iframe", { site: "https://example.com/w/" });
  const url = new URL(/src="([^"]+)"/.exec(code)![1]!.replace(/&amp;/g, "&"));
  assert.equal(url.origin + url.pathname, "https://example.com/w/embed.html");
  assert.equal(url.searchParams.get("lineup"), "1");
  assert.equal(url.searchParams.get("stars"), "largest");
  assert.equal(url.searchParams.get("planets"), "1");
  assert.equal(url.searchParams.get("layout"), "stack");
  assert.equal(url.searchParams.get("zoom"), "0.5");
  assert.equal(url.searchParams.get("turn"), "off");
  assert.equal(url.searchParams.get("look"), "painted");
  assert.match(code, /width="640"/);
  assert.match(code, /height="360"/, "the picture is 16 to 9");
});

test("there is a snippet for every kind, and the credit names what is used", () => {
  for (const kind of EMBED_KINDS) assert.ok(lineupCode({ stars: "bright" }, kind).includes("lineup"), kind);
  assert.match(lineupCredit({}), /refereed paper/);
  assert.doesNotMatch(lineupCredit({}), /Jupiter/);
  assert.match(lineupCredit({ planets: true }), /Earth and Jupiter/);
  assert.doesNotMatch(lineupCredit({ planets: true }), /Nestaeric/);
  assert.match(lineupCredit({ planets: true, look: "painted" }), /Nestaeric/);
  assert.match(lineupCredit({ planets: true, look: "painted" }), /CC BY 4.0/);
  assert.match(lineupCredit({ planets: true, look: "painted" }), /Changes made/);
  assert.match(lineupCredit({ planets: true, look: "painted" }), /Blue Marble/);
  assert.match(lineupCredit({ planets: true, look: "painted" }), /public domain/);
  const ja = lineupCredit({ planets: true, look: "painted", lang: "ja" });
  assert.match(ja, /木星/);
  assert.match(ja, /Nestaeric/);
  assert.match(ja, /CC BY 4.0/);
  assert.doesNotMatch(lineupCredit({ planets: true, lang: "ja" }), /Nestaeric/);
});
