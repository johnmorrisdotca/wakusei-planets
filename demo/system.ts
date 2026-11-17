// The flat solar system page: the Sun, the planets, the belts, the comets and our spacecraft (the Tesla Roadster among them) from above, drawn by <wakusei-flat-system>. Every place is the package's own for the time shown; nothing here asks a server for orbits.
// Drive the clock, go to a body (the map centres on it and follows it), press anything for its card, and switch the layers, the orbits, the paths and the scale on the map's own controls.
import { BODIES } from "../src/facts.ts";
import { BELTS } from "../src/belts/index.ts";
import { listComets } from "../src/comets.ts";
import { SPACECRAFT, SPACECRAFT_IDS, type SpacecraftId } from "../src/spacecraft.ts";
import { saySystem, systemColour, systemName, type SystemPick } from "../src/flat/system.ts";
import "../src/flat/system-define.ts";
import type { WakuseiFlatSystem } from "../src/flat/system-define.ts";
import { WORDS } from "./words.js";

type Lang = "en" | "ja";
const chooser = (): { lang: Lang; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: Lang; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const lang = (): Lang => chooser()?.lang ?? (document.documentElement.lang === "ja" ? "ja" : "en");
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

const system = $<WakuseiFlatSystem>("#system");
const SPEEDS = [1, 3600, 86400, 864_000, 8_640_000] as const;
/** The places to go to: the Sun, the Earth, the Tesla, and a craft and a comet a reader has heard of. */
const GOTO = ["sun", "earth", "roadster", "voyager1", "halley"] as const;
let speedAt = 0;
let chosen: SystemPick | null = null;
let following: string = "sun";
const AU_KM = 149_597_870.7;

// ----- the go-to buttons -----------------------------------------------------------------------------------------------------------------------------------------------------
const gotoBox = $("#goto");
for (const id of GOTO) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset["value"] = id;
  button.addEventListener("click", () => {
    following = id;
    system.center = id;
    system.zoom = id === "sun" ? 1 : id === "voyager1" || id === "halley" ? 2 : 4;
    system.selected = id === "sun" ? null : id;
    chosen = id === "sun" ? null : ({ kind: null, id, name: systemName(id, lang()), layer: null, distanceAu: null, x: null, y: null, predicted: null, via: "tap" } as SystemPick);
    render();
  });
  gotoBox.append(button);
}

// ----- the clock: Real time, Slower, Pause, Faster ---------------------------------------------------------------------------------------------------------------------------
const act: Record<string, () => void> = {
  live: () => {
    speedAt = 0;
    system.paused = false;
    system.speed = 1;
    system.time = "now";
  },
  slower: () => {
    speedAt = Math.max(0, speedAt - 1);
    system.speed = SPEEDS[speedAt]!;
  },
  pause: () => {
    system.paused = !system.paused;
  },
  faster: () => {
    speedAt = Math.min(SPEEDS.length - 1, speedAt + 1);
    system.speed = SPEEDS[speedAt]!;
  },
};
const clockBox = $("#clock");
for (const name of ["live", "slower", "pause", "faster"]) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset["act"] = name;
  button.addEventListener("click", () => {
    act[name]!();
    render();
  });
  clockBox.append(button);
}
const dateInput = $<HTMLInputElement>("#date");
dateInput.addEventListener("change", () => {
  const ms = Date.parse(`${dateInput.value}:00Z`);
  if (Number.isFinite(ms)) system.time = ms;
  render();
});
const shownTime = $("#shown-time");
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
system.addEventListener("wakusei-timechange", (event) => {
  const { time } = (event as CustomEvent<{ time: number }>).detail;
  shownTime.textContent = say("fl_now", { time: iso(time) });
  if (chosen?.id) card();
});

// ----- the one chosen -------------------------------------------------------------------------------------------------------------------------------------------------------
const number = (n: number): string => Math.round(n).toLocaleString(lang());
const distance = (au: number): string => say("sy_au", { au: au < 10 ? au.toFixed(2) : au.toFixed(1), km: number((au * AU_KM) / 1e6) });
function fact(list: HTMLElement, key: string, value: string): void {
  list.append(Object.assign(document.createElement("dt"), { textContent: say(key) }), Object.assign(document.createElement("dd"), { textContent: value }));
}

function card(): void {
  const empty = $("#card-empty");
  const full = $("#card-body");
  const facts = $("#card-facts");
  facts.replaceChildren();
  $("#card-about").textContent = "";
  if (chosen === null || chosen.id === null) {
    empty.hidden = false;
    full.hidden = true;
    return;
  }
  empty.hidden = true;
  full.hidden = false;
  const l = lang();
  const id = chosen.id;
  const at = system.placeOf(id);
  const earth = system.placeOf("earth");
  $("#card-name").textContent = chosen.kind === "belt" ? id : systemName(id, l);
  const kind = chosen.kind ?? system.bodies.find((b) => b.id === id)?.kind ?? null;
  if (kind !== null) fact(facts, "sy_c_kind", saySystem(l, `kind_${kind}`));
  if (chosen.kind === "belt" && chosen.belt) fact(facts, "sy_c_belt", BELTS[chosen.belt].name[l]);
  const sun = at?.distanceAu ?? chosen.distanceAu;
  if (sun !== null && sun !== undefined && id !== "sun") fact(facts, "sy_c_sun", distance(sun));
  if (at && earth && id !== "earth" && id !== "sun") fact(facts, "sy_c_earth", distance(Math.hypot(at.au[0] - earth.au[0], at.au[1] - earth.au[1], at.au[2] - earth.au[2])));
  if (SPACECRAFT_IDS.includes(id as SpacecraftId)) {
    const craft = SPACECRAFT[id as SpacecraftId];
    fact(facts, "sy_c_agency", craft.agency);
    fact(facts, "sy_c_launch", new Date(craft.launch.date).toISOString().slice(0, 10));
    if (at === null) fact(facts, "sy_c_status", say("sy_no_path"));
    else if (system.bodies.find((b) => b.id === id)?.predicted) fact(facts, "sy_c_status", say("sy_predicted"));
    if (id === "roadster") $("#card-about").textContent = say("sy_starman", { name: SPACECRAFT.roadster.name[l] });
  } else {
    const comet = listComets().find((c) => c.id === id);
    if (comet?.periodYears) fact(facts, "sy_c_period", say("sy_years", { n: comet.periodYears.toFixed(1) }));
    if (comet) fact(facts, "sy_c_kind2", say(`sy_comet_${comet.kind}`));
    const body = (BODIES as Readonly<Record<string, { radiusKm?: number }>>)[id];
    if (body?.radiusKm && !comet) fact(facts, "sy_c_radius", `${number(body.radiusKm)} km`);
  }
}
system.addEventListener("wakusei-flat-pick", (event) => {
  const detail = (event as CustomEvent<SystemPick>).detail;
  // a pointer going over only names what is under it (the element's own tip); a tap or the keyboard chooses
  if (detail.via === "hover") return;
  chosen = detail.id === null ? null : detail;
  render();
});
system.addEventListener("wakusei-flat-view", () => {
  if (system.center === null) following = "";
  render();
});

// ----- the page -------------------------------------------------------------------------------------------------------------------------------------------------------------
function render(): void {
  for (const button of gotoBox.children as HTMLCollectionOf<HTMLButtonElement>) {
    const id = button.dataset["value"]!;
    button.replaceChildren();
    const dot = Object.assign(document.createElement("span"), { className: "flat-swatch", ariaHidden: "true" });
    dot.style.setProperty("--c", systemColour(id, id === "sun" ? "sun" : id === "earth" ? "planets" : id === "halley" ? "comets" : "craft"));
    button.append(dot, systemName(id, lang()));
    button.setAttribute("aria-pressed", String(following === id));
  }
  for (const button of clockBox.children as HTMLCollectionOf<HTMLButtonElement>) {
    const name = button.dataset["act"]!;
    button.textContent = say(name === "pause" ? (system.paused ? "fl_play" : "fl_pause") : `fl_${name}`);
    if (name === "live") button.setAttribute("aria-pressed", String(!system.paused && system.speed === 1));
    if (name === "pause") button.setAttribute("aria-pressed", String(system.paused));
    if (name === "slower") button.disabled = speedAt === 0;
    if (name === "faster") button.disabled = speedAt === SPEEDS.length - 1;
  }
  const m = system.time;
  shownTime.textContent = say("fl_now", { time: iso(m) });
  if (document.activeElement !== dateInput) dateInput.value = iso(m).replace(" ", "T");
  $("#caption").textContent = say("sy_caption", { n: system.bodies.filter((b) => b.shown).length, extent: system.extent });
  card();
  $("#code").textContent = [
    'import "@johnmorrisdotca/wakusei-planets/flat/system/define";',
    "",
    `<wakusei-flat-system selected="${chosen?.id ?? "roadster"}" track></wakusei-flat-system>`,
    "",
    'document.querySelector("wakusei-flat-system").addEventListener("wakusei-flat-pick", (event) => {',
    "  console.log(event.detail.name, event.detail.kind, event.detail.distanceAu);",
    "});",
  ].join("\n");
}

document.addEventListener("kazoku-languagechange", () =>
  queueMicrotask(() => {
    system.setAttribute("lang", lang());
    render();
  }),
);
window.addEventListener("wakusei-language", () => {
  system.setAttribute("lang", lang());
  render();
});
system.setAttribute("lang", lang());
render();
requestAnimationFrame(() => requestAnimationFrame(render));
// ready once the map has drawn with its craft and belts
const ready = setInterval(() => {
  if (system.getAttribute("data-state") === "ready") {
    clearInterval(ready);
    render();
    document.body.dataset["ready"] = "true";
  }
}, 50);
