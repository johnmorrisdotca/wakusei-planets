// The star look: numbers in, a colour, a surface, a turn and an honest list of what is measured out; the line drawing; the code that puts a star in a page.
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { parseTemplate } from "@angular/compiler";
import { build } from "esbuild";
import { compile } from "svelte/compiler";
import ts from "typescript";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";
import { embedCode, embedCredit, EMBED_KINDS, LUMINOSITY_CLASSES, STAR_SUN, starLineSvg, starLook, type EmbedOptions, type StarNumbers } from "../src/index.ts";
import { registerStarLook, starLookOf } from "../src/scene/look.ts";

const BETELGEUSE: StarNumbers = { name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab", estimated: ["radiusSun"] };
const RIGEL: StarNumbers = { name: "Rigel", temperatureK: 12100, radiusSun: 78.9, luminosityClass: "Ia" };
const PROXIMA: StarNumbers = { name: "Proxima Centauri", temperatureK: 3042, radiusSun: 0.154, luminosityClass: "V", rotationDays: 83.5 };
const ALTAIR: StarNumbers = { name: "Altair", temperatureK: 7550, radiusSun: 1.79, luminosityClass: "V", rotationDays: 0.45, oblateness: 0.2 };
const DWARF: StarNumbers = { name: "Sirius B", temperatureK: 25200, radiusSun: 0.0084, luminosityClass: "D" };

const channels = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test("the colour is the black body of the temperature: red for a cool star, white for the Sun, blue for a hot one", () => {
  const [br, , bb] = channels(starLook(BETELGEUSE).colour);
  assert.ok(br! > bb! + 60, "Betelgeuse is red");
  const [sr, sg, sb] = channels(starLook(STAR_SUN).colour);
  assert.ok(sr! >= 250 && sg! > 230 && sb! > 215, "the Sun is near white");
  const [rr, , rb] = channels(starLook(RIGEL).colour);
  assert.ok(rb! > rr! + 40, "Rigel is blue");
});

test("a star is a pure function of its numbers, and the size is the radius in kilometres", () => {
  const a = starLook(PROXIMA);
  const b = starLook({ ...PROXIMA });
  assert.equal(a.key, b.key);
  assert.equal(a.look.surface, b.look.surface);
  assert.deepEqual(a.facts.features, b.facts.features);
  assert.ok(Math.abs(a.radiusKm - 0.154 * 695_700) < 1e-6);
  assert.equal(starLook({ temperatureK: 5000, radiusSun: 1 }).name, "Star");
  assert.notEqual(starLook({ ...PROXIMA, temperatureK: 3100 }).key, a.key);
});

test("an out-of-range number throws a RangeError that names it", () => {
  assert.throws(() => starLook({ temperatureK: 50, radiusSun: 1 }), /temperatureK must be a number from 1000 to 200000, got 50/);
  assert.throws(() => starLook({ temperatureK: 5000, radiusSun: 0 }), /radiusSun/);
  assert.throws(() => starLook({ temperatureK: 5000, radiusSun: Number.NaN }), /radiusSun/);
  assert.throws(() => starLook({ temperatureK: 5000, radiusSun: 1, oblateness: 0.9 }), /oblateness/);
  assert.throws(() => starLook({ temperatureK: 5000, radiusSun: 1, activity: 2 }), /activity/);
  assert.throws(() => starLook({ temperatureK: 5000, radiusSun: 1, rotationDays: 0 }), /rotationDays/);
  assert.throws(() => starLook({ temperatureK: 5000, radiusSun: 1, luminosityClass: "X" as never }), /luminosityClass/);
});

test("the surface is coarser the more luminous the class: fine cells on a dwarf, a few giant ones on a supergiant, none on a white dwarf", () => {
  const frequency = (cls: (typeof LUMINOSITY_CLASSES)[number]): number => {
    const found = /float g = fbm\(p \* ([\d.]+)/.exec(starLook({ temperatureK: 5000, radiusSun: 1, luminosityClass: cls }).look.surface);
    return found === null ? 0 : Number(found[1]);
  };
  const order = ["0", "Ia", "Iab", "Ib", "II", "III", "IV", "V"] as const;
  for (let i = 1; i < order.length; i += 1) assert.ok(frequency(order[i]!) > frequency(order[i - 1]!), `${order[i]} is finer than ${order[i - 1]}`);
  assert.equal(frequency("D"), 0);
  assert.ok(frequency("Ia") < 3 && frequency("V") >= 24);
});

test("spots: none on hot stars, many on cool dwarfs and red dwarfs, fewer on giants, and the page can say", () => {
  assert.equal(starLook(RIGEL).activity, 0);
  assert.equal(starLook(ALTAIR).activity, 0);
  assert.equal(starLook(DWARF).activity, 0);
  assert.ok(starLook(PROXIMA).activity > starLook(STAR_SUN).activity, "a red dwarf is more active than the Sun");
  assert.ok(starLook(STAR_SUN).activity > starLook({ ...STAR_SUN, luminosityClass: "III" }).activity, "a giant has fewer spots");
  assert.equal(starLook({ ...ALTAIR, activity: 0.5 }).activity, 0.5);
  const spots = (n: StarNumbers): number => (starLook(n).facts.features ?? []).filter((f) => f.kind === "circle" && f.fill === true).length;
  assert.equal(spots(RIGEL), 0);
  assert.ok(spots(PROXIMA) > spots(STAR_SUN));
  assert.ok(!starLook(RIGEL).look.surface.includes("float spot"), "no spot code when there are no spots");
});

test("rotation: the turn on a page is sped up, labelled, backwards for a negative period, and slow when none is given", () => {
  const sun = starLook(STAR_SUN);
  assert.equal(sun.turn.degreesPerSecond, 12);
  assert.ok(Math.abs(sun.turn.speedUp! - 12 / (360 / (25.38 * 86400))) < 1, "the speed-up is shown over real");
  assert.ok(starLook(ALTAIR).turn.degreesPerSecond > sun.turn.degreesPerSecond, "a fast spinner turns faster");
  assert.ok(starLook({ ...BETELGEUSE, rotationDays: 2100 }).turn.degreesPerSecond < sun.turn.degreesPerSecond);
  assert.ok(starLook({ ...STAR_SUN, rotationDays: -25 }).turn.degreesPerSecond < 0);
  const none = starLook(RIGEL);
  assert.equal(none.rotationDays, undefined);
  assert.equal(none.turn.speedUp, undefined);
  assert.equal(none.turn.degreesPerSecond, 12);
});

test("a flattened star is squashed, with hotter poles and a darker equator; a round one has neither", () => {
  const altair = starLook(ALTAIR);
  assert.equal(altair.facts.flattening, 0.2);
  assert.match(altair.look.surface, /col \*= mix\(/);
  assert.equal(starLook(STAR_SUN).facts.flattening, 0);
  assert.doesNotMatch(starLook(STAR_SUN).look.surface, /col \*= mix\(/);
  assert.deepEqual(altair.parts.map((p) => p.part).filter((p) => p === "shape" || p === "poles"), ["shape", "poles"]);
});

test("the edge darkens less on a hot star, and every star glows in its own colour", () => {
  assert.ok(starLook(RIGEL).look.limb! < starLook(STAR_SUN).look.limb!);
  assert.ok(starLook(BETELGEUSE).look.limb! > starLook(STAR_SUN).look.limb!);
  const glow = starLook(RIGEL).look.glow!;
  assert.ok(glow.colour[2] > glow.colour[0], "a blue star has a blue glow");
  assert.ok(starLook({ ...RIGEL, corona: 0 }).look.glow!.strength === 0);
  assert.equal(starLook(RIGEL).look.id, "sun");
  assert.equal(starLook(RIGEL).look.emissive, true);
});

test("honest: every part says how well it is known, in English and Japanese, and the invented ones are never called measured", () => {
  const star = starLook(BETELGEUSE);
  const by = Object.fromEntries(star.parts.map((p) => [p.part, p.status]));
  assert.equal(by["temperature"], "measured");
  assert.equal(by["size"], "estimated", "the page marked the radius as an estimate");
  assert.equal(by["colour"], "derived");
  assert.equal(by["edge"], "derived");
  for (const part of ["surface", "spots", "glow", "rotation"]) assert.equal(by[part], "illustrative", part);
  assert.equal(starLook(PROXIMA).parts.find((p) => p.part === "rotation")!.status, "measured");
  for (const p of star.parts) assert.ok(p.note.en.length > 8 && /[぀-ヿ一-鿿]/.test(p.note.ja), p.part);
  assert.match(star.disclaimer.en, /not a photo/);
  assert.match(star.disclaimer.ja, /写真ではありません/);
});

test("the line drawing: an outline, cells and spots as line work, and the Sun and the orbits drawn round it to size", () => {
  const svg = starLineSvg(BETELGEUSE, { size: 320 });
  assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>"));
  assert.match(svg, /aria-label="Line drawing of Betelgeuse, drawn from its numbers"/);
  assert.match(svg, /Jupiter's orbit/);
  assert.match(svg, /Earth's orbit/);
  assert.match(svg, /1,057 × Sun · 3,650 K · Iab/);
  assert.ok((svg.match(/<path/g) ?? []).length > 5, "cells and spots");
  const ja = starLineSvg(BETELGEUSE, { size: 320, lang: "ja" });
  assert.match(ja, /地球の軌道/);
  assert.match(ja, /太陽の1,057倍/);
  // a star the size of the Sun has no ring of its own size, and a white dwarf beside the Sun is outlined in the Sun's ring
  assert.doesNotMatch(starLineSvg(STAR_SUN, { size: 320 }), />Sun</);
  assert.match(starLineSvg(DWARF, { size: 320, fill: 0.0079 }), />Sun</);
  assert.equal(starLineSvg(ALTAIR, { size: 320 }), starLineSvg(ALTAIR, { size: 320 }));
  const flat = /<ellipse cx="[\d.]+" cy="[\d.]+" rx="([\d.]+)" ry="([\d.]+)"/.exec(starLineSvg(ALTAIR, { size: 320, tilt: 0, pitch: 0 }))!;
  assert.ok(Number(flat[2]) < Number(flat[1]) * 0.85, "an oblate star is squeezed along its pole");
});

test("a cheaper star for weak devices: no boiling surface, no prominences, and a key of its own", () => {
  const full = starLook(PROXIMA);
  const low = starLook(PROXIMA, { quality: "low" });
  assert.equal(full.quality, "full");
  assert.equal(low.quality, "low");
  assert.notEqual(full.key, low.key);
  assert.match(full.look.surface, /uniform float uTime/);
  assert.doesNotMatch(low.look.surface, /uTime/);
  assert.ok(full.look.glow!.prominence! > 0 && low.look.glow!.prominence === 0);
  assert.ok(full.parts.some((p) => p.part === "prominences" && p.status === "illustrative"));
  assert.ok(!low.parts.some((p) => p.part === "prominences"));
  assert.equal(starLook(RIGEL).look.glow!.prominence, 0, "a hot star has none");
});

test("a star can be registered by name and found again without regard to case", () => {
  const made = registerStarLook("Vega Test", { temperatureK: 9602, radiusSun: 2.36, luminosityClass: "V" });
  assert.equal(starLookOf("vega TEST"), made);
  assert.equal(made.name, "Vega Test");
  assert.equal(starLookOf("nobody"), undefined);
});

const CHOICES: EmbedOptions[] = [
  { body: "sun", star: BETELGEUSE, look: "realistic" },
  { body: "sun", star: { temperatureK: 3042, radiusSun: 0.154, luminosityClass: "V" }, look: "line", size: 240 },
  { body: "sun", star: { ...ALTAIR, name: 'The "fast" one & friend' }, look: "realistic", turn: 40 },
];

test("the code that puts a star in a page: the element's attributes, no body entry point, and every kind of page", () => {
  for (const kind of EMBED_KINDS) assert.ok(embedCode(CHOICES[0]!, kind).includes("Betelgeuse") || kind === "module", kind);
  const html = embedCode(CHOICES[0]!, "html");
  assert.match(html, /<wakusei-body star="Betelgeuse" look="realistic" temperature-k="3650" radius-sun="1057" luminosity-class="Iab" estimated="radiusSun"><\/wakusei-body>/);
  assert.equal((html.match(/<script/g) ?? []).length, 1, "only the element is loaded: the star look is in it");
  assert.doesNotMatch(html, /sun\/\+esm|body=/);
  assert.match(embedCode({ body: "sun", star: { temperatureK: 5000, radiusSun: 1 } }, "html"), /<wakusei-body star look="realistic" temperature-k="5000" radius-sun="1">/);
  const src = /src="([^"]+)"/.exec(embedCode(CHOICES[2]!, "iframe", { site: "https://example.com/w/" }))![1]!.replace(/&amp;/g, "&");
  const url = new URL(src);
  assert.equal(url.pathname, "/w/embed.html");
  assert.equal(url.searchParams.get("star"), 'The "fast" one & friend');
  assert.equal(url.searchParams.get("temperature-k"), "7550");
  assert.equal(url.searchParams.get("oblateness"), "0.2");
  assert.equal(url.searchParams.get("body"), null);
  assert.match(embedCredit(CHOICES[0]!), /not a photo/);
  assert.doesNotMatch(embedCredit(CHOICES[0]!), /public domain/);
});

const syntax = (code: string): string[] =>
  (ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true } }).diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));

test("a star's code is valid in the ES module, Angular, Vue and Svelte ways", () => {
  for (const o of CHOICES) {
    assert.deepEqual(syntax(embedCode(o, "module")), [], JSON.stringify(o));
    const angular = embedCode(o, "angular");
    assert.deepEqual(syntax(angular), [], JSON.stringify(o));
    assert.deepEqual(parseTemplate(/template: `([^`]*)`/.exec(angular)![1]!, "planet.component.ts").errors ?? [], []);
    const { descriptor, errors } = parse(embedCode(o, "vue"));
    assert.deepEqual(errors, []);
    assert.match(compileScript(descriptor, { id: "planet" }).content, /onMounted/);
    assert.deepEqual(compileTemplate({ source: descriptor.template!.content, filename: "Planet.vue", id: "planet" }).errors, []);
    const svelte = compile(embedCode(o, "svelte"), { filename: "Planet.svelte", generate: "client" });
    assert.equal(svelte.warnings.filter((w) => w.code !== "custom_element_props_identifier").length, 0, JSON.stringify(o));
  }
});

test("the React component renders the star's element with its numbers", async () => {
  const dir = new URL("../.cache/star-test/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  try {
    for (const [i, o] of CHOICES.entries()) {
      const source = new URL(`star${i}.tsx`, dir).pathname;
      writeFileSync(source, `declare module "react" { namespace JSX { interface IntrinsicElements { "wakusei-body": any } } }\n${embedCode(o, "react")}`);
      const out = new URL(`star${i}.mjs`, dir).pathname;
      await build({ entryPoints: [source], outfile: out, bundle: true, format: "esm", platform: "node", jsx: "automatic", external: ["@johnmorrisdotca/wakusei-planets/*", "react", "react/*"], logLevel: "silent" });
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { createElement } = await import("react");
      const mod = (await import(`${out}?${i}`)) as { Planet: () => unknown };
      const html = renderToStaticMarkup(createElement(mod.Planet as never));
      assert.match(html, /<wakusei-body star="/, html);
      assert.match(html, new RegExp(`temperature-k="${o.star!.temperatureK}"`), html);
      assert.match(html, new RegExp(`look="${o.look}"`), html);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
