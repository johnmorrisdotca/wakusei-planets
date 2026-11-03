// The text to put a body in a page, for each way a page is made: a script tag from a CDN, an ES module, React, Vue, Angular, Svelte, or an iframe of `embed.html`. The demo's "Put it in your page"
// section shows these as the reader changes a choice, and the tests build or parse every one. Pure: no DOM.
import { BODIES, type BodyId, type Look } from "./facts.ts";
import { decodeScene } from "./portrait/model.ts";
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

const attrText = (attrs: Spec["attrs"]): string => attrs.map(([k, v]) => (v === "" ? k : `${k}=${quote(v)}`)).join(" ");

function snippet(kind: EmbedKind, spec: Spec, cdn: string): string {
  const Name = spec.name.charAt(0).toUpperCase() + spec.name.slice(1);
  const tagAttrs2 = attrText(spec.attrs);
  if (kind === "iframe") {
    const f = spec.iframe;
    return `<iframe\n  src=${quote(f.src)}\n  title=${quote(f.title)}\n  width="${f.width}"\n  height="${f.height}"\n  loading="lazy"\n  style="border: 0"\n></iframe>`;
  }
  if (kind === "html") {
    const scripts = [`<script type="module" src="${cdn}/${spec.element}/+esm"></script>`, ...spec.entries.map((e) => `<script type="module" src="${cdn}/${e}/+esm"></script>`)];
    return `${scripts.join("\n")}\n\n<${spec.tag} ${tagAttrs2}></${spec.tag}>`;
  }
  const imports = [`import "${PACKAGE}/${spec.element}";`, ...spec.entries.map((e) => `import "${PACKAGE}/${e}";`)];
  if (kind === "module") {
    const sets = spec.attrs.map(([k, v]) => `${spec.name}.setAttribute(${JSON.stringify(k)}, ${JSON.stringify(v)});`);
    return `${imports.join("\n")}\n\nconst ${spec.name} = document.createElement("${spec.tag}");\n${sets.join("\n")}\ndocument.querySelector("#${spec.name}").append(${spec.name});`;
  }
  const dynamic = [`void import("${PACKAGE}/${spec.element}");`, ...spec.entries.map((e) => `void import("${PACKAGE}/${e}");`)];
  if (kind === "react") {
    return `import { useEffect } from "react";\n\nexport function ${Name}() {\n  useEffect(() => {\n    // The element needs a browser, so it is imported in an effect, never at the top of the file.\n${dynamic.map((l) => `    ${l}`).join("\n")}\n  }, []);\n  return <${spec.tag} ${tagAttrs2} />;\n}`;
  }
  if (kind === "vue") {
    return `<script setup lang="ts">\nimport { onMounted } from "vue";\n\nonMounted(() => {\n${dynamic.map((l) => `  ${l}`).join("\n")}\n});\n</script>\n\n<template>\n  <${spec.tag} ${tagAttrs2}></${spec.tag}>\n</template>`;
  }
  if (kind === "angular") {
    return `import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from "@angular/core";\n\n@Component({\n  selector: "app-${spec.name}",\n  standalone: true,\n  schemas: [CUSTOM_ELEMENTS_SCHEMA],\n  template: \`<${spec.tag} ${tagAttrs2}></${spec.tag}>\`,\n})\nexport class ${Name}Component implements OnInit {\n  ngOnInit(): void {\n    // The element needs a browser: ngOnInit also runs when a server renders.\n    if (typeof window !== "undefined") {\n${dynamic.map((l) => `      ${l}`).join("\n")}\n    }\n  }\n}`;
  }
  return `<script lang="ts">\n  import { onMount } from "svelte";\n\n  onMount(() => {\n${dynamic.map((l) => `    ${l}`).join("\n")}\n  });\n</script>\n\n<${spec.tag} ${tagAttrs2}></${spec.tag}>`;
}

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
  const query = new URLSearchParams({ body: options.body, look: options.look ?? "realistic" });
  if (options.time !== undefined) query.set("time", options.time);
  if (options.moons === true && options.time !== undefined) query.set("moons", "1");
  if (options.turn !== undefined && options.turn > 0) query.set("turn", String(options.turn));
  return snippet(
    kind,
    {
      tag: "wakusei-body",
      element: "element",
      entries: needsShading(options) ? [entryOf(options.body)] : [],
      attrs: attributesOf(options),
      name: "planet",
      iframe: { src: `${site}embed.html?${query.toString()}`, title: BODIES[options.body].name.en, width: size, height: size },
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
