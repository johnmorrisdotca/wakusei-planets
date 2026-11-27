// The code builder: choose a body, its look, its size, the sky and its turning, and copy the code for any way a page is made. One screen, choices in rows; the preview is the body itself and the code is `embedCode`.
import "../src/element.ts";
import "../src/bodies/all.ts";
import "@johnmorrisdotca/chikyu-earth/element";
import "../src/bodies/earth.ts";
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import type { EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";
import { embedCode, embedCredit, EMBED_KINDS, type EmbedKind, type EmbedOptions } from "../src/embed.ts";
import { BODIES, DWARF_IDS, MINOR_IDS, MOONS_OF, PLANET_IDS, type BodyId, type Look } from "../src/facts.ts";
import { moonFilterAttributes, type MoonFilter } from "../src/moon-filters.ts";
import { createMoonControls, moonWord } from "./moon-controls.ts";
import { WORDS } from "./words.js";

setThreeLoader(() => import("./three-subset.ts"));

const GROUPS: readonly { id: string; label: string; bodies: readonly BodyId[] }[] = [
  { id: "sun", label: "The Sun and the planets", bodies: ["sun", ...PLANET_IDS] },
  { id: "dwarfs", label: "Dwarf planets", bodies: DWARF_IDS },
  { id: "minor", label: "Small bodies", bodies: MINOR_IDS },
  ...Object.entries(MOONS_OF).map(([planet, moons]) => ({ id: planet, label: `Moons of ${BODIES[planet as keyof typeof MOONS_OF].name.en}`, bodies: moons as readonly BodyId[] })),
];
const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const pageLang = (): "en" | "ja" => ((Reflect.get(globalThis, "wakuseiLanguage") as { lang?: string } | undefined)?.lang === "ja" ? "ja" : "en");
const state = { group: "sun", body: "saturn" as BodyId, look: "line" as Look, sky: "portrait", turn: 0, zoom: 1, moons: "off" as "off" | "major" | "all", moonFilter: {} as MoonFilter, moonOrbits: true };
const panel = byId<EmbedPanelElement>("embed-panel");
const moonOrbits = byId<HTMLButtonElement>("builder-moon-orbits");
const hasMoonMode = (): boolean => state.body in MOONS_OF;
const activeMoons = (): boolean => hasMoonMode() && state.moons !== "off";
const moonControls = createMoonControls(byId("moon-filters"), (filter) => {
  state.moonFilter = filter;
  panel.openHref = openHref();
  panel.update();
}, (group, lang) => WORDS[lang][`sp_group_${group}`] ?? group);
moonOrbits.addEventListener("click", () => {
  state.moonOrbits = !state.moonOrbits;
  draw();
});

function fill(id: string, choices: readonly { id: string; label: string }[], chosen: string, prefix: string, on: (id: string) => void): void {
  const group = byId(id);
  group.replaceChildren(
    ...choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.dataset["testid"] = `${prefix}-${choice.id}`;
      button.setAttribute("aria-pressed", String(choice.id === chosen));
      button.addEventListener("click", () => on(choice.id));
      return button;
    }),
  );
}

function options(withZoom = true): EmbedOptions {
  const sky = state.sky === "now" || activeMoons() ? { time: "now" } : {};
  const moons = activeMoons() && state.moons !== "off" ? { moons: state.moons, moonFilter: state.moonFilter, moonOrbits: state.moonOrbits } : {};
  return { body: state.body, look: state.look, size: panel.size, lang: pageLang(), ...sky, ...moons, ...(state.turn > 0 ? { turn: state.turn } : {}), ...(withZoom ? { zoom: state.zoom } : {}) };
}

const openHref = (): string => {
  const chosen = options();
  const params = new URLSearchParams({ body: chosen.body, look: state.look, ...(chosen.time ? { time: chosen.time } : {}), ...(state.turn > 0 ? { turn: String(state.turn) } : {}), ...(state.zoom !== 1 ? { zoom: String(state.zoom) } : {}) });
  if (chosen.moons) {
    params.set("moons", String(chosen.moons));
    if (chosen.moonOrbits === false) params.set("moon-orbits", "off");
    for (const [name, value] of moonFilterAttributes(chosen.moonFilter)) params.set(name, value);
  }
  return `embed.html?${params}`;
};

function draw(): void {
  const group = GROUPS.find((one) => one.id === state.group) ?? GROUPS[0]!;
  fill("groups", GROUPS.map((one) => ({ id: one.id, label: one.label })), state.group, "group", (id) => {
    state.group = id;
    state.body = (GROUPS.find((one) => one.id === id)?.bodies[0] ?? "saturn") as BodyId;
    draw();
  });
  fill("bodies", group.bodies.map((id) => ({ id, label: BODIES[id].name.en })), state.body, "body", (id) => {
    state.body = id as BodyId;
    state.zoom = 1;
    draw();
  });
  fill("looks", (["line", "realistic", "painted"] as const).map((id) => ({ id, label: id })), state.look, "look", (id) => {
    state.look = id as Look;
    state.zoom = 1;
    draw();
  });
  fill("skies", [{ id: "portrait", label: "A portrait" }, { id: "now", label: "The sky right now" }], state.sky, "sky", (id) => {
    state.sky = id;
    draw();
  });
  fill("turns", [{ id: "0", label: "Still" }, { id: "12", label: "Slow" }, { id: "30", label: "Fast" }], String(state.turn), "turn", (id) => {
    state.turn = Number(id);
    draw();
  });
  byId("builder-moons").hidden = !hasMoonMode();
  byId("builder-moons-title").textContent = moonWord("moons", pageLang());
  fill("moon-modes", (["off", "major", "all"] as const).map((id) => ({ id, label: moonWord(id, pageLang()) })), state.moons, "moon-mode", (id) => {
    state.moons = id as typeof state.moons;
    draw();
  });
  moonControls.render(activeMoons(), state.moonFilter, pageLang());
  moonOrbits.hidden = !activeMoons();
  moonOrbits.textContent = moonWord("orbits", pageLang());
  moonOrbits.setAttribute("aria-pressed", String(state.moonOrbits));
  panel.openHref = openHref();
  panel.update();
}

function zoomed(zoom: number): void {
  if (Math.abs(zoom - state.zoom) < 0.001) return;
  state.zoom = zoom;
  panel.openHref = openHref();
  panel.update();
}

panel.kinds = EMBED_KINDS;
// the preview's own code leaves the zoom out, so zooming the picture does not make a new one
panel.generate = ({ kind, preview }) => embedCode(options(!preview), kind as EmbedKind, preview ? { site: "" } : {});
panel.preview = ({ kind }) => {
  if (kind === "iframe") return undefined;
  const chosen = options(false);
  const element = document.createElement("wakusei-body") as WakuseiBody;
  for (const [name, value] of Object.entries({ body: chosen.body, look: chosen.look ?? "line", size: String(panel.size), "texture-base": "textures/", live: "hover", controls: "" })) element.setAttribute(name, value);
  element.addEventListener("wakusei-view", (event) => zoomed((event as CustomEvent<{ zoom: number }>).detail.zoom));
  if (chosen.time !== undefined) element.setAttribute("time", chosen.time);
  if (chosen.moons) {
    element.setAttribute("moons", String(chosen.moons));
    element.moonFilter = chosen.moonFilter ?? {};
    if (chosen.moonOrbits === false) element.setAttribute("moon-orbits", "off");
  }
  if (chosen.turn !== undefined) element.setAttribute("turn", String(chosen.turn));
  return element;
};
panel.credits = () => embedCredit(options());

// the iframe tab shows the embed page itself: it says how far in it is
window.addEventListener("message", (event) => {
  const data = event.data as { wakusei?: string; zoom?: number } | null;
  if (event.origin !== location.origin || data?.wakusei !== "view" || typeof data.zoom !== "number") return;
  zoomed(data.zoom);
});
window.addEventListener("wakusei-language", draw);

draw();
document.documentElement.dataset["ready"] = "true";
