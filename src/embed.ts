// The text to put a body in a page, for each way a page is made: a script tag from a CDN, an ES module, React, Vue, Angular, Svelte, or an iframe of `embed.html`. The demo's "Put it in your page"
// section shows these as the reader changes a choice, and the tests build or parse every one. Pure: no DOM.
import { embedSnippet } from "@johnmorrisdotca/kazoku-ui/embed-panel";
import { BODIES, DWARF_IDS, type BodyId, type Look } from "./facts.ts";
import { decodeScene } from "./portrait/model.ts";
import type { LineupSet } from "./lineup/data.ts";
import type { LineupLayout } from "./lineup/layout.ts";
import type { StarNumbers } from "./star.ts";
import { VERSION } from "./version.ts";

/**
 * The ways `embedCode` writes a body into a page.
 *
 * @example
 * ```ts
 * import { EMBED_KINDS } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(EMBED_KINDS.join(", "));
 * ```
 */
export const EMBED_KINDS = ["html", "module", "react", "vue", "angular", "svelte", "iframe"] as const;

/**
 * One of the ways in `EMBED_KINDS`.
 *
 * @example
 * ```ts
 * import { EMBED_KINDS, type EmbedKind } from "@johnmorrisdotca/wakusei-planets";
 *
 * const kind: EmbedKind = EMBED_KINDS[2];
 * console.log(kind);
 * ```
 */
export type EmbedKind = (typeof EMBED_KINDS)[number];

/**
 * What the reader chose: the body, how it is drawn, and whether it is a portrait or the sky at a date.
 *
 * @example
 * ```ts
 * import { embedCode, type EmbedOptions } from "@johnmorrisdotca/wakusei-planets";
 *
 * const options: EmbedOptions = { body: "saturn", look: "painted", size: 320, turn: 12 };
 * console.log(embedCode(options, "html"));
 * ```
 */
export interface EmbedOptions {
  body: BodyId;
  /** A star drawn from numbers instead of the body (`body` is then ignored: give `sun`, the one star among the bodies): the `star` attribute and the numbers' attributes (`temperature-k`, `radius-sun` and the rest) are written, and no entry point besides the element is loaded. `time` and `moons` do not apply to it. */
  star?: StarNumbers;
  look?: Look;
  /** The date and time as an ISO string, or `now`: the body as the Earth sees it then. Left out, a portrait. */
  time?: string;
  /** A planet with its moons on their orbits (needs `time`). */
  moons?: boolean;
  /** Degrees a second it turns by itself; left out or 0, it is still. */
  turn?: number;
  /** Pixels across. */
  size?: number;
  /** How far in the embed page starts, as its `zoom` address key has it (1 is the whole body). Left out or 1, the page starts at Fit. Only the iframe way carries it: the element's own start is Fit. */
  zoom?: number;
}

/**
 * Where the embed code points: the package's version on jsDelivr, and the published demo, where `embed.html` is.
 *
 * @example
 * ```ts
 * import { embedCode } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(embedCode({ body: "mars", look: "line" }, "iframe", { site: "https://example.com/wakusei/" }));
 * ```
 */
export interface EmbedSettings {
  /** The published demo's address, ending in a slash. */
  site?: string;
  /** The package's address on the CDN, with its version. */
  cdn?: string;
}

const SITE = "https://johnmorrisdotca.github.io/wakusei-planets/";
const CDN = `https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets@${VERSION}`;
const PACKAGE = "@johnmorrisdotca/wakusei-planets";

/** The entry point that holds a body's shaded and painted look: the body's own, `dwarfs` for the dwarf planets besides Pluto, `moons-<planet>` for a moon and `moons-dwarf` for a moon of a dwarf planet. */
export function entryOf(id: BodyId): string {
  const parent = BODIES[id].parent;
  if (parent === undefined) return (DWARF_IDS as readonly string[]).includes(id) ? "dwarfs" : id;
  return (DWARF_IDS as readonly string[]).includes(parent) ? "moons-dwarf" : `moons-${parent}`;
}

/** A star's numbers as the attributes that carry them, in the order they are written: the same names are the iframe's address keys. */
function starAttributes(star: StarNumbers): [string, string][] {
  const out: [string, string][] = [["temperature-k", String(star.temperatureK)], ["radius-sun", String(star.radiusSun)]];
  if (star.luminosityClass !== undefined) out.push(["luminosity-class", star.luminosityClass]);
  if (star.rotationDays !== undefined) out.push(["rotation-days", String(star.rotationDays)]);
  if (star.activity !== undefined) out.push(["activity", String(star.activity)]);
  if (star.oblateness !== undefined) out.push(["oblateness", String(star.oblateness)]);
  if (star.corona !== undefined) out.push(["corona", String(star.corona)]);
  if (star.estimated !== undefined && star.estimated.length > 0) out.push(["estimated", star.estimated.join(",")]);
  return out;
}

/** The attributes of the element for these choices, in the order they are written. */
function attributesOf(o: EmbedOptions): [string, string][] {
  const out: [string, string][] = o.star !== undefined ? [["star", o.star.name ?? ""], ["look", o.look ?? "realistic"]] : [["body", o.body], ["look", o.look ?? "realistic"]];
  if (o.size !== undefined && o.size !== 320) out.push(["size", String(o.size)]);
  if (o.star !== undefined) out.push(...starAttributes(o.star));
  if (o.time !== undefined && o.star === undefined) out.push(["time", o.time]);
  if (o.moons === true && o.time !== undefined && o.star === undefined) out.push(["moons", ""]);
  if (o.turn !== undefined && o.turn > 0) out.push(["turn", String(o.turn)]);
  return out;
}

const needsShading = (o: EmbedOptions): boolean => (o.look ?? "realistic") !== "line";

interface Spec {
  /** The element's tag, and the entry point (under the package name) that defines it. */
  tag: string;
  element: string;
  /** The entry points that hold the looks of the bodies drawn, or none for a line drawing. */
  entries: readonly string[];
  attrs: readonly (readonly [string, string])[];
  /** The name the React, Angular and plain module examples use: `planet` gives `Planet`, `PlanetComponent`, `app-planet` and `#planet`. */
  name: string;
  iframe: { src: string; title: string; width: number; height: number };
}

/** The seven ways are kazoku-ui's: one description of the element gives every one of them. */
const snippet = (kind: EmbedKind, spec: Spec, cdn: string): string => embedSnippet(kind, { ...spec, package: PACKAGE, cdn });

/**
 * The text that puts a body in a page, for one way of making the page. Each way is built, parsed or run by the package's tests: the plain HTML one with a script tag from jsDelivr, an ES module, a React component,
 * a Vue single-file component, an Angular standalone component, a Svelte component, and an iframe of the demo's `embed.html`.
 *
 * @param options - The body, its look, the date, the moons, the turn and the size.
 * @param kind - The way the page is made; `html` by default.
 * @param settings - The CDN and the demo's address, when they are not the package's own.
 * @returns The text to paste into the page's source.
 *
 * @example
 * ```ts
 * import { embedCode } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(embedCode({ body: "jupiter", look: "realistic", time: "now", moons: true }, "react"));
 * ```
 */
export function embedCode(options: EmbedOptions, kind: EmbedKind = "html", settings: EmbedSettings = {}): string {
  const cdn = settings.cdn ?? CDN;
  const site = settings.site ?? SITE;
  const size = options.size ?? 320;
  const body = options.body;
  const query = new URLSearchParams(options.star !== undefined ? { ...(options.star.name !== undefined ? { star: options.star.name } : { star: "" }), look: options.look ?? "realistic", ...Object.fromEntries(starAttributes(options.star)) } : { body, look: options.look ?? "realistic" });
  if (options.time !== undefined && options.star === undefined) query.set("time", options.time);
  if (options.moons === true && options.time !== undefined && options.star === undefined) query.set("moons", "1");
  if (options.turn !== undefined && options.turn > 0) query.set("turn", String(options.turn));
  if (options.zoom !== undefined && options.zoom !== 1 && Number.isFinite(options.zoom) && options.zoom > 0) query.set("zoom", String(Math.round(options.zoom * 1000) / 1000));
  return snippet(
    kind,
    {
      tag: "wakusei-body",
      element: "element",
      entries: needsShading(options) && options.star === undefined ? [entryOf(body)] : [],
      attrs: attributesOf(options),
      name: "planet",
      iframe: { src: `${site}embed.html?${query.toString()}`, title: options.star !== undefined ? (options.star.name ?? "Star") : BODIES[body].name.en, width: size, height: size },
    },
    cdn,
  );
}

/**
 * A scene of the portrait builder to put in a page: the scene as the builder writes it in its address, how wide the picture is, and the look to draw it in if not the scene's own.
 *
 * @example
 * ```ts
 * import { portraitCode, type PortraitEmbed } from "@johnmorrisdotca/wakusei-planets";
 *
 * const options: PortraitEmbed = { scene: "look:painted~jupiter_0_0_0.3_0~io_0_0_0.1_0", width: 640 };
 * console.log(portraitCode(options, "html").includes("wakusei-portrait"));
 * ```
 */
export interface PortraitEmbed {
  /** The scene as text (`encodeScene`). */
  scene: string;
  /** Pixels across; default 720. */
  width?: number;
}

/**
 * The text that puts a portrait scene in a page, for each way a page is made, as `embedCode` does for a single body. The bodies' own entry points are loaded only for the bodies in the scene
 * (all of them when there are more than six kinds), and none for the line look.
 *
 * @param options - The scene and the width.
 * @param kind - The way the page is made; `html` by default.
 * @param settings - The CDN and the demo's address, when they are not the package's own.
 * @returns The text to paste into the page's source.
 *
 * @example
 * ```ts
 * import { portraitCode } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(portraitCode({ scene: "look:painted~jupiter_0_0_0.3_0~io_0_0_0.1_0" }, "vue"));
 * ```
 */
export function portraitCode(options: PortraitEmbed, kind: EmbedKind = "html", settings: EmbedSettings = {}): string {
  const cdn = settings.cdn ?? CDN;
  const site = settings.site ?? SITE;
  const width = options.width ?? 720;
  const scene = decodeScene(options.scene);
  const kinds = [...new Set(scene.items.map((i) => entryOf(i.body)))];
  const entries = scene.look === "line" ? [] : kinds.length > 6 ? ["all"] : kinds;
  const attrs: [string, string][] = [["scene", options.scene]];
  if (width !== 720) attrs.push(["size", String(width)]);
  return snippet(
    kind,
    { tag: "wakusei-portrait", element: "portrait", entries, attrs, name: "portrait", iframe: { src: `${site}embed.html?${new URLSearchParams({ scene: options.scene }).toString()}`, title: "Wakusei Planets portrait", width, height: Math.round(width / scene.aspect) } },
    cdn,
  );
}

/**
 * The size line-up to put in a page: which stars, the planets, how they stand, where the camera starts, and how wide it is.
 *
 * @example
 * ```ts
 * import { lineupCode, type LineupEmbed } from "@johnmorrisdotca/wakusei-planets";
 *
 * const options: LineupEmbed = { stars: "bright", planets: true, at: "betelgeuse", width: 720 };
 * console.log(lineupCode(options, "html"));
 * ```
 */
export interface LineupEmbed {
  /** `all` (the default), `bright` or `largest`, or a list of ids from `LINEUP_STARS`. */
  stars?: LineupSet | readonly string[];
  /** Add the Earth and Jupiter. */
  planets?: boolean;
  /** `row` (the default) or `stack`. */
  layout?: LineupLayout;
  /** The id of the body the camera starts on; the Sun when left out. */
  at?: string;
  /** Where the camera starts, 0 to 1 (over `at`). */
  zoom?: number;
  /** False stops the bodies turning by themselves. */
  turn?: boolean;
  /** The planets' look: `realistic` (the default) or `painted`. */
  look?: "realistic" | "painted";
  /** The words: `en` (the default) or `ja`. */
  lang?: "en" | "ja";
  /** Pixels across; default 720. */
  width?: number;
}

/** The element's attributes for a line-up, in the order they are written. */
function lineupAttributes(o: LineupEmbed): [string, string][] {
  const out: [string, string][] = [];
  const stars = o.stars === undefined || o.stars === "all" ? undefined : typeof o.stars === "string" ? o.stars : o.stars.join(",");
  if (stars !== undefined) out.push(["stars", stars]);
  if (o.planets === true) out.push(["planets", ""]);
  if (o.layout === "stack") out.push(["layout", "stack"]);
  if (o.zoom !== undefined && Number.isFinite(o.zoom)) out.push(["zoom", String(Math.round(o.zoom * 1000) / 1000)]);
  else if (o.at !== undefined && o.at !== "sun") out.push(["at", o.at]);
  if (o.turn === false) out.push(["turn", "off"]);
  if (o.look === "painted") out.push(["look", "painted"]);
  if (o.lang === "ja") out.push(["lang", "ja"]);
  if (o.width !== undefined && o.width !== 720) out.push(["size", String(o.width)]);
  return out;
}

/**
 * The text that puts the size line-up in a page, for each way a page is made, as `embedCode` does for a single body: a script tag, an ES module, React, Vue, Angular, Svelte or an iframe of the demo's `embed.html`.
 * Every way is built, parsed or run by the package's tests.
 *
 * @param options - The stars, the planets, the layout, where the camera starts and the width.
 * @param kind - The way the page is made; `html` by default.
 * @param settings - The CDN and the demo's address, when they are not the package's own.
 * @returns The text to paste into the page's source.
 *
 * @example
 * ```ts
 * import { lineupCode } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(lineupCode({ stars: "largest", at: "vy-canis-majoris" }, "react"));
 * ```
 */
export function lineupCode(options: LineupEmbed, kind: EmbedKind = "html", settings: EmbedSettings = {}): string {
  const cdn = settings.cdn ?? CDN;
  const site = settings.site ?? SITE;
  const width = options.width ?? 720;
  const attrs = lineupAttributes(options);
  const query = new URLSearchParams([["lineup", "1"], ...attrs.map(([name, value]) => [name, name === "planets" ? "1" : value] as [string, string])]);
  return snippet(
    kind,
    { tag: "wakusei-lineup", element: "lineup", entries: [], attrs, name: "lineup", iframe: { src: `${site}embed.html?${query.toString()}`, title: "Wakusei Planets size line-up", width, height: Math.round((width * 9) / 16) } },
    cdn,
  );
}

/**
 * The credits that travel with a picture of the size line-up: the radii are from refereed papers, the stars are drawn from numbers and not photographs, and the planets' sizes are the IAU's and NASA's.
 *
 * @param options - The choices, so the planets and their pictures are named only when they are used.
 * @returns A short line of credit to put near the picture.
 *
 * @example
 * ```ts
 * import { lineupCredit } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(lineupCredit({ planets: true }));
 * ```
 */
export function lineupCredit(options: LineupEmbed): string {
  const base = "Wakusei Planets by John Morris (MIT). Sizes at true relative scale; each star's radius is from a refereed paper that measured its angular diameter (sources and disagreements in the package's NOTICE.md). The stars are drawn from their numbers, not photographs: the cells, spots and glow are illustrative.";
  const planets = options.planets === true ? " Earth and Jupiter: IAU and NASA sizes." + (options.look === "painted" ? " Surface pictures: NASA and Nestaeric (CC BY 4.0), see NOTICE.md." : "") : "";
  return `${base}${planets}`;
}

/**
 * The credits that travel with a picture of a body: the line and illustrated looks are drawn from numbers, and `realistic` and `painted` use the surface maps.
 *
 * @param options - The choices, so only what is used is named.
 * @returns A short line of credit to put near the picture.
 *
 * @example
 * ```ts
 * import { embedCredit } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(embedCredit({ body: "mars", look: "painted" }));
 * ```
 */
export function embedCredit(options: EmbedOptions): string {
  if (options.star !== undefined) return "Wakusei Planets by John Morris (MIT). A star drawn from its numbers, not a photo: the colour from its temperature, the size from its radius; the surface cells, spots and glow are illustrative.";
  const base = "Wakusei Planets by John Morris (MIT). Sizes, tilt and rotation: IAU and NASA fact sheets.";
  const photos = options.look !== "line" && options.look !== "illustrated";
  const painted = photos ? " Surface pictures: NASA, USGS and JPL imagery in the public domain (details in the package's NOTICE.md)." : "";
  const earth = options.body === "earth" ? " Earth: NASA Earth Observatory, Blue Marble." : "";
  return `${base}${painted}${earth}`;
}
