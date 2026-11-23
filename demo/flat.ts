// The flat map page: any body the package has a picture of as a flat map, drawn by <wakusei-flat>, as the photo or as a line map. Round the Moon and Mars every dot is an orbiter at the place the package's own orbit puts it for the time shown.
// Choose the body (the one control that swaps the Earth's map for these, as in the satellites' page), drive the clock, press an orbiter or a mark, and set a site as "my place". Nothing here asks a server for orbits.
import "@johnmorrisdotca/hata/element/define";
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { BODIES } from "../src/facts.ts";
import { flagCodeOf } from "../src/landing-sites.ts";
import { FLAT_BODIES, coordinateText, flatBody, flatSun, hasPath, isFlatBody, orbiterColour, orbiterName, readLook, type FlatBodyId } from "../src/flat/index.ts";
import "../src/flat/define.ts";
import type { FlatPick, WakuseiFlat } from "../src/flat/define.ts";
import { ORBITER_FACTS, orbiterNumbers, type OrbiterId } from "../src/orbiters.ts";
import { localSolarTime, loadPlaces, PLACE_BODIES, type Place, type PlaceBody } from "../src/places.ts";
import { picturesCredit } from "../src/picture-credits.ts";
import { WORDS } from "./words.js";
import { startProjections } from "./flat-projections.ts";

type Lang = "en" | "ja";
const chooser = (): { lang: Lang; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: Lang; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const lang = (): Lang => chooser()?.lang ?? (document.documentElement.lang === "ja" ? "ja" : "en");
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

const flat = $<WakuseiFlat>("#flat");
const address = createAddressState({ defaults: {} });
const SPEEDS = [1, 10, 60, 600, 3600, 86400] as const;
/** The sites offered as "my place", by body: the ones a reader has heard of. */
const TRY_PLACES: Readonly<Partial<Record<FlatBodyId, readonly string[]>>> = {
  moon: ["moon/apollo-11-lunar-module", "moon/apollo-17-lunar-module", "moon/chang-e-4", "moon/chandrayaan-3-vikram"],
  mars: ["mars/perseverance", "mars/curiosity", "mars/viking-1", "mars/zhurong"],
};

/** The row of planets and the Moon; the other moons have a row of their own. */
const MAIN: readonly FlatBodyId[] = ["mercury", "venus", "earth", "moon", "mars", "ceres", "vesta", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const MOONS = FLAT_BODIES.filter((id) => !MAIN.includes(id));
/** The places offered as "my place" for a body: the ones a reader has heard of, or the first few the package holds. */
const tryPlaces = (): readonly string[] => TRY_PLACES[body] ?? places.slice(0, 4).map((place) => place.id);

const asked = address.get("body");
let body: FlatBodyId = isFlatBody(asked) ? asked : "moon";
let home = address.get("place") ?? "";
let places: readonly Place[] = [];
let speedAt = 0;
let chosen: FlatPick | null = null;
flat.setAttribute("body", body);
if (readLook(address.get("look")) === "map") flat.setAttribute("look", "map");
flat.addEventListener("wakusei-flat-look", (event) => address.set("look", (event as CustomEvent<{ look: string }>).detail.look === "map" ? "map" : null));

// ----- the rows of buttons --------------------------------------------------------------------------------------------------------------------------------------------------
const rows: (() => void)[] = [];
function buttons(container: string, items: () => readonly { value: string; text: string; colour?: string }[], current: () => string, choose: (value: string) => void): void {
  const box = $(container);
  rows.push(() => {
    const list = items();
    if (box.children.length !== list.length || [...box.children].map((child) => (child as HTMLElement).dataset["value"]).join() !== list.map((one) => one.value).join()) {
      box.replaceChildren(
        ...list.map((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset["value"] = item.value;
          button.addEventListener("click", () => choose(item.value));
          return button;
        }),
      );
    }
    list.forEach((item, i) => {
      const button = box.children[i] as HTMLButtonElement;
      button.textContent = item.text;
      if (item.colour !== undefined) {
        const dot = Object.assign(document.createElement("span"), { className: "flat-swatch", ariaHidden: "true" });
        dot.style.setProperty("--c", item.colour);
        button.prepend(dot);
      }
      button.setAttribute("aria-pressed", String(item.value === current()));
    });
  });
}
const chooseBody = (value: string): void => {
  body = value as FlatBodyId;
  home = "";
  chosen = null;
  places = [];
  flat.removeAttribute("selected");
  flat.setAttribute("body", body);
  address.set("body", body === "moon" ? null : body);
  address.set("place", null);
  applyHome();
  void loadList();
  render();
};
buttons("#bodies", () => MAIN.map((id) => ({ value: id, text: BODIES[id].name[lang()] })), () => body, chooseBody);
buttons("#moons", () => MOONS.map((id) => ({ value: id, text: BODIES[id].name[lang()] })), () => body, chooseBody);
buttons("#places", () => [{ value: "", text: say("fl_place_none") }, ...tryPlaces().map((id) => ({ value: id, text: places.find((p) => p.id === id)?.name[lang()] ?? id }))], () => home, (value) => {
  home = value;
  applyHome();
  render();
});
buttons("#orbiters", () => flatBody(body).orbiters.filter(hasPath).map((id) => ({ value: id, text: orbiterName(id, lang(), true), colour: orbiterColour(id) })), () => (chosen?.kind === "orbiter" ? (chosen.id ?? "") : ""), (value) => {
  flat.selected = flat.selected === value ? null : value;
  chosen = flat.selected === null ? null : ({ kind: "orbiter", id: flat.selected, name: orbiterName(value as OrbiterId, lang()), body, lat: null, lon: null, altitudeKm: null, status: null, placeKind: null, via: "tap" } as FlatPick);
  render();
});

function applyHome(): void {
  const one = places.find((p) => p.id === home);
  address.set("place", one ? home : null);
  if (!one) {
    flat.removeAttribute("home-lon");
    flat.removeAttribute("home-lat");
    return;
  }
  flat.setAttribute("home-lon", String(one.lon));
  flat.setAttribute("home-lat", String(one.lat));
}

// ----- the clock: Real time, Slower, Pause, Faster ---------------------------------------------------------------------------------------------------------------------------
const act: Record<string, () => void> = {
  live: () => {
    speedAt = 0;
    flat.paused = false;
    flat.speed = 1;
    flat.time = "now";
  },
  slower: () => {
    speedAt = Math.max(0, speedAt - 1);
    flat.speed = SPEEDS[speedAt]!;
  },
  pause: () => {
    flat.paused = !flat.paused;
  },
  faster: () => {
    speedAt = Math.min(SPEEDS.length - 1, speedAt + 1);
    flat.speed = SPEEDS[speedAt]!;
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
  if (Number.isFinite(ms)) flat.time = ms;
  render();
});
const shownTime = $("#shown-time");
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
flat.addEventListener("wakusei-timechange", (event) => {
  const { time } = (event as CustomEvent<{ time: number }>).detail;
  shownTime.textContent = say("fl_now", { time: iso(time) });
  caption(time);
  projections.render();
  if (chosen?.kind === "orbiter") card();
});

// ----- the one chosen -------------------------------------------------------------------------------------------------------------------------------------------------------
const number = (n: number): string => Math.round(n).toLocaleString(lang());
const period = (days: number): string => {
  const minutes = days * 1440;
  return minutes >= 90 ? say("fl_hm", { h: Math.floor(minutes / 60), m: Math.round(minutes % 60) }) : say("fl_min", { m: Math.round(minutes) });
};
const bodyName = (): string => BODIES[body].name[lang()];

function fact(list: HTMLElement, key: string, value: string): void {
  list.append(Object.assign(document.createElement("dt"), { textContent: say(key) }), Object.assign(document.createElement("dd"), { textContent: value }));
}

function card(): void {
  const empty = $("#card-empty");
  const full = $("#card-body");
  const facts = $("#card-facts");
  const button = $("#make-home");
  facts.replaceChildren();
  $("#card-source").hidden = true;
  if (chosen === null || chosen.id === null) {
    empty.hidden = false;
    full.hidden = true;
    return;
  }
  empty.hidden = true;
  full.hidden = false;
  const l = lang();
  const ms = flat.time;
  if (chosen.kind === "orbiter") {
    const id = chosen.id as OrbiterId;
    const f = ORBITER_FACTS[id];
    const n = orbiterNumbers(id, ms);
    $("#card-name").textContent = f.name[l];
    fact(facts, "fl_c_operator", f.operator);
    if (n) {
      fact(facts, "fl_c_height", `${number(n.altitudeKm)} km`);
      fact(facts, "fl_c_speed", say("fl_kms", { v: n.speedKmS.toFixed(2) }));
      fact(facts, "fl_c_period", period(n.periodDays));
      fact(facts, "fl_c_tilt", `${n.inclinationDeg.toFixed(1)}°`);
      fact(facts, "fl_c_path", say(`fl_status_${n.status}`) + (n.errorKm === null ? "" : say("fl_error", { km: number(n.errorKm) })));
    }
    $("#card-about").textContent = f.about[l];
    button.hidden = true;
    $("#card-source").hidden = true;
    return;
  }
  const place = places.find((p) => p.id === chosen!.id);
  if (!place) {
    full.hidden = true;
    return;
  }
  // the page draws the card: the event carries the place and, for a landing, the landing site with its country's flag code
  const site = chosen.site;
  const name = $("#card-name");
  name.replaceChildren();
  const code = site ? flagCodeOf(site.country) : undefined;
  if (code !== undefined) name.append(Object.assign(document.createElement("hata-flag"), { className: "flat-flag" }), " ");
  if (code !== undefined) name.querySelector("hata-flag")!.setAttribute("code", code);
  name.append((site?.name[l] ?? place.name[l]) as string);
  fact(facts, "fl_c_kind", say(`fl_kind_${place.kind}`));
  if (site) {
    fact(facts, "fl_c_agency", site.agency[l]);
    fact(facts, "fl_c_when", site.date.slice(0, 10));
  }
  fact(facts, "fl_c_where", `${coordinateText(l, "lat", place.lat)}, ${coordinateText(l, "lon", place.lon)}`);
  const solar = localSolarTime(body, place.lon, ms);
  fact(facts, "fl_c_solar", `${String(Math.floor(solar)).padStart(2, "0")}:${String(Math.floor((solar % 1) * 60)).padStart(2, "0")}`);
  if (place.date && !site) fact(facts, "fl_c_when", place.date.slice(0, 10));
  if (place.site) fact(facts, "fl_c_site", place.site);
  if (place.mission) fact(facts, "fl_c_mission", place.mission);
  if (place.operator) fact(facts, "fl_c_operator", `${place.operator}${place.country ? ` (${place.country})` : ""}`);
  $("#card-about").textContent = place.approximate || site?.approximate ? say("fl_approx") : "";
  const link = $<HTMLAnchorElement>("#card-source");
  link.hidden = !site;
  if (site) {
    link.href = site.source.url;
    link.textContent = say("fl_source", { name: site.source.name });
  }
  button.hidden = false;
}
$("#make-home").addEventListener("click", () => {
  if (chosen?.kind !== "place" || chosen.id === null) return;
  home = chosen.id;
  applyHome();
  render();
});
flat.addEventListener("wakusei-flat-pick", (event) => {
  const detail = (event as CustomEvent<FlatPick>).detail;
  // a pointer going over only names what is under it (the element's own tip); a tap or the keyboard chooses
  if (detail.via === "hover") return;
  chosen = detail.id === null ? null : detail;
  render();
});

// ----- any body in a projection ---------------------------------------------------------------------------------------------------------------------------------------------
const projections = startProjections({ say, lang, time: () => flat.time, get: (key) => address.get(key), set: (key, value) => address.set(key, value), textureBase: "textures/" });
Reflect.set(window, "wakuseiProjections", projections);

// ----- the page -------------------------------------------------------------------------------------------------------------------------------------------------------------
function caption(ms = flat.time): void {
  const sun = flatSun(body, ms);
  const l = lang();
  $("#caption").textContent = say("fl_caption", { body: bodyName(), lat: coordinateText(l, "lat", sun.lat), lon: coordinateText(l, "lon", sun.lon) });
}

function render(): void {
  for (const row of rows) row();
  for (const button of clockBox.children as HTMLCollectionOf<HTMLButtonElement>) {
    const name = button.dataset["act"]!;
    button.textContent = say(name === "pause" ? (flat.paused ? "fl_play" : "fl_pause") : `fl_${name}`);
    if (name === "live") button.setAttribute("aria-pressed", String(!flat.paused && flat.speed === 1));
    if (name === "pause") button.setAttribute("aria-pressed", String(flat.paused));
    if (name === "slower") button.disabled = speedAt === 0;
    if (name === "faster") button.disabled = speedAt === SPEEDS.length - 1;
  }
  $("#orbiters-row").hidden = flatBody(body).orbiters.length === 0;
  $("#places-row").hidden = places.length === 0;
  const missing = flatBody(body).orbiters.filter((id) => !hasPath(id));
  $("#nopath").textContent = missing.length === 0 ? "" : say("fl_nopath", { names: missing.map((id) => orbiterName(id, lang())).join(lang() === "ja" ? "、" : ", ") });
  const l = lang();
  const m = flat.time;
  shownTime.textContent = say("fl_now", { time: iso(m) });
  if (document.activeElement !== dateInput) dateInput.value = iso(m).replace(" ", "T");
  $("#credits-map").textContent = picturesCredit([body], l);
  caption(m);
  projections.render();
  card();
  $("#code").textContent = [
    'import "@johnmorrisdotca/wakusei-planets/flat/define";',
    "",
    `<wakusei-flat body="${body}" track site-flags${home && places.find((p) => p.id === home) ? ` home-lon="${places.find((p) => p.id === home)!.lon}" home-lat="${places.find((p) => p.id === home)!.lat}"` : ""}></wakusei-flat>`,
    "",
    'document.querySelector("wakusei-flat").addEventListener("wakusei-flat-pick", (event) => {',
    "  console.log(event.detail.name, event.detail.kind);",
    "});",
  ].join("\n");
}

async function loadList(): Promise<void> {
  const wanted = body;
  const list = (PLACE_BODIES as readonly string[]).includes(wanted) ? await loadPlaces(wanted as PlaceBody) : [];
  if (wanted !== body) return;
  places = list;
  if (home !== "") applyHome();
  render();
}

document.addEventListener("kazoku-languagechange", () =>
  queueMicrotask(() => {
    flat.setAttribute("lang", lang());
    render();
  }),
);
window.addEventListener("wakusei-language", () => {
  flat.setAttribute("lang", lang());
  render();
});
flat.setAttribute("site-flags", "");
flat.setAttribute("lang", lang());
render();
void loadList().then(() => {
  document.body.dataset["ready"] = "true";
});
