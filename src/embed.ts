// The text to put a body in a page, for each way a page is made: a script tag from a CDN, an ES module, React, Vue, Angular, Svelte, or an iframe of `embed.html`. The demo's "Put it in your page"
// section shows these as the reader changes a choice, and the tests build or parse every one. Pure: no DOM.
import { BODIES, type BodyId, type Look } from "./facts.ts";
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
  look?: Look;
  /** The date and time as an ISO string, or `now`: the body as the Earth sees it then. Left out, a portrait. */
  time?: string;
  /** A planet with its moons on their orbits (needs `time`). */
  moons?: boolean;
  /** Degrees a second it turns by itself; left out or 0, it is still. */
  turn?: number;
  /** Pixels across. */
  size?: number;
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

/** The entry point that holds a body's shaded and painted look. */
export function entryOf(id: BodyId): string {
  const parent = BODIES[id].parent;
  return parent === undefined ? id : `moons-${parent}`;
}

/** The attributes of the element for these choices, in the order they are written. */
function attributesOf(o: EmbedOptions): [string, string][] {
  const out: [string, string][] = [["body", o.body], ["look", o.look ?? "realistic"]];
  if (o.size !== undefined && o.size !== 320) out.push(["size", String(o.size)]);
  if (o.time !== undefined) out.push(["time", o.time]);
  if (o.moons === true && o.time !== undefined) out.push(["moons", ""]);
  if (o.turn !== undefined && o.turn > 0) out.push(["turn", String(o.turn)]);
  return out;
}

const quote = (v: string): string => `"${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
const tagAttrs = (o: EmbedOptions): string => attributesOf(o).map(([k, v]) => (v === "" ? k : `${k}=${quote(v)}`)).join(" ");
const needsShading = (o: EmbedOptions): boolean => (o.look ?? "realistic") !== "line";

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
  const shaded = needsShading(options);
  const entry = entryOf(options.body);
  const size = options.size ?? 320;
  if (kind === "iframe") {
    const query = new URLSearchParams({ body: options.body, look: options.look ?? "realistic" });
    if (options.time !== undefined) query.set("time", options.time);
    if (options.moons === true && options.time !== undefined) query.set("moons", "1");
    if (options.turn !== undefined && options.turn > 0) query.set("turn", String(options.turn));
    return `<iframe\n  src=${quote(`${site}embed.html?${query.toString()}`)}\n  title=${quote(BODIES[options.body].name.en)}\n  width="${size}"\n  height="${size}"\n  loading="lazy"\n  style="border: 0"\n></iframe>`;
  }
  if (kind === "html") {
    const scripts = [`<script type="module" src="${cdn}/element/+esm"></script>`, ...(shaded ? [`<script type="module" src="${cdn}/${entry}/+esm"></script>`] : [])];
    return `${scripts.join("\n")}\n\n<wakusei-body ${tagAttrs(options)}></wakusei-body>`;
  }
  const imports = [`import "${PACKAGE}/element";`, ...(shaded ? [`import "${PACKAGE}/${entry}";`] : [])];
  if (kind === "module") {
    const sets = attributesOf(options).map(([k, v]) => `planet.setAttribute(${JSON.stringify(k)}, ${JSON.stringify(v)});`);
    return `${imports.join("\n")}\n\nconst planet = document.createElement("wakusei-body");\n${sets.join("\n")}\ndocument.querySelector("#planet").append(planet);`;
  }
  const dynamic = [`void import("${PACKAGE}/element");`, ...(shaded ? [`void import("${PACKAGE}/${entry}");`] : [])];
  if (kind === "react") {
    const props = attributesOf(options).map(([k, v]) => (v === "" ? k : `${k}=${quote(v)}`)).join(" ");
    return `import { useEffect } from "react";\n\nexport function Planet() {\n  useEffect(() => {\n    // The element needs a browser, so it is imported in an effect, never at the top of the file.\n${dynamic.map((l) => `    ${l}`).join("\n")}\n  }, []);\n  return <wakusei-body ${props} />;\n}`;
  }
  if (kind === "vue") {
    return `<script setup lang="ts">\nimport { onMounted } from "vue";\n\nonMounted(() => {\n${dynamic.map((l) => `  ${l}`).join("\n")}\n});\n</script>\n\n<template>\n  <wakusei-body ${tagAttrs(options)}></wakusei-body>\n</template>`;
  }
  if (kind === "angular") {
    return `import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from "@angular/core";\n\n@Component({\n  selector: "app-planet",\n  standalone: true,\n  schemas: [CUSTOM_ELEMENTS_SCHEMA],\n  template: \`<wakusei-body ${tagAttrs(options)}></wakusei-body>\`,\n})\nexport class PlanetComponent implements OnInit {\n  ngOnInit(): void {\n    // The element needs a browser: ngOnInit also runs when a server renders.\n    if (typeof window !== "undefined") {\n${dynamic.map((l) => `      ${l}`).join("\n")}\n    }\n  }\n}`;
  }
  return `<script lang="ts">\n  import { onMount } from "svelte";\n\n  onMount(() => {\n${dynamic.map((l) => `    ${l}`).join("\n")}\n  });\n</script>\n\n<wakusei-body ${tagAttrs(options)}></wakusei-body>`;
}

/**
 * The credits that travel with a picture of a body: the line and shaded looks are drawn from numbers, the painted look uses public-domain pictures.
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
  const base = "Wakusei Planets by John Morris (MIT). Sizes, tilt and rotation: IAU and NASA fact sheets.";
  const painted = (options.look ?? "realistic") === "painted" ? " Surface pictures: NASA, USGS and JPL imagery in the public domain (details in the package's NOTICE.md)." : "";
  const earth = options.body === "earth" ? " Earth: NASA Earth Observatory, Blue Marble." : "";
  return `${base}${painted}${earth}`;
}
