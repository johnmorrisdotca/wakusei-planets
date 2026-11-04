// The code builder: choose a body, its look, its size, the sky and its turning, and copy the code for any way a page is made. One screen, choices in rows; the preview is the body itself and the code is `embedCode`.
import "../src/element.ts";
import "../src/bodies/all.ts";
import "../src/bodies/earth.ts";
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import type { EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";
import { embedCode, embedCredit, EMBED_KINDS, type EmbedKind, type EmbedOptions } from "../src/embed.ts";
import { BODIES, DWARF_IDS, MOONS_OF, PLANET_IDS, type BodyId, type Look } from "../src/facts.ts";

setThreeLoader(() => import("./three-subset.ts"));

const GROUPS: readonly { id: string; label: string; bodies: readonly BodyId[] }[] = [
  { id: "sun", label: "The Sun and the planets", bodies: ["sun", ...PLANET_IDS] },
  { id: "dwarfs", label: "Dwarf planets", bodies: DWARF_IDS },
  ...Object.entries(MOONS_OF).map(([planet, moons]) => ({ id: planet, label: `Moons of ${BODIES[planet as keyof typeof MOONS_OF].name.en}`, bodies: moons as readonly BodyId[] })),
];
const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const state = { group: "sun", body: "saturn" as BodyId, look: "line" as Look, sky: "portrait", turn: 0 };
const panel = byId<EmbedPanelElement>("embed-panel");

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

function options(): EmbedOptions {
  const sky = state.sky === "now" ? { time: "now" } : {};
  return { body: state.body, look: state.look, size: panel.size, ...sky, ...(state.turn > 0 ? { turn: state.turn } : {}) };
}

function draw(): void {
  const group = GROUPS.find((one) => one.id === state.group) ?? GROUPS[0]!;
  fill("groups", GROUPS.map((one) => ({ id: one.id, label: one.label })), state.group, "group", (id) => {
    state.group = id;
    state.body = (GROUPS.find((one) => one.id === id)?.bodies[0] ?? "saturn") as BodyId;
    draw();
  });
  fill("bodies", group.bodies.map((id) => ({ id, label: BODIES[id].name.en })), state.body, "body", (id) => {
    state.body = id as BodyId;
    draw();
  });
  fill("looks", (["line", "realistic", "painted"] as const).map((id) => ({ id, label: id })), state.look, "look", (id) => {
    state.look = id as Look;
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
  panel.openHref = `embed.html?${new URLSearchParams({ body: state.body, look: state.look, ...(state.sky === "now" ? { time: "now" } : {}), ...(state.turn > 0 ? { turn: String(state.turn) } : {}) }).toString()}`;
  panel.update();
}

panel.kinds = EMBED_KINDS;
panel.generate = ({ kind, preview }) => embedCode(options(), kind as EmbedKind, preview ? { site: "" } : {});
panel.preview = ({ kind }) => {
  if (kind === "iframe") return undefined;
  const chosen = options();
  const element = document.createElement("wakusei-body") as WakuseiBody;
  for (const [name, value] of Object.entries({ body: chosen.body, look: chosen.look ?? "line", size: String(panel.size), "texture-base": "textures/", live: "off" })) element.setAttribute(name, value);
  if (chosen.time !== undefined) element.setAttribute("time", chosen.time);
  if (chosen.turn !== undefined) element.setAttribute("turn", String(chosen.turn));
  return element;
};
panel.credits = () => embedCredit(options());

draw();
document.documentElement.dataset["ready"] = "true";
