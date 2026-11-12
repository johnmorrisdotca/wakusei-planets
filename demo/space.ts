// The space view page: one <wakusei-space> (one WebGL context for every body in it) with the family's view controls and replay bar around it. The choices are kept in the address.
// The date box follows the clock: <wakusei-space> sends `wakusei-timechange` while time runs and once when it holds, and the box shows it (never while the reader is typing in it).
// Play runs the clock from the date shown; Pause holds it there and writes it to the address (`t`); Back goes to the date the reader chose. `play=on` and `speed` stay in the address.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import "@johnmorrisdotca/kazoku-ui/replay-bar/define";
import type { ReplayBarElement, ReplayDetail } from "@johnmorrisdotca/kazoku-ui/replay-bar/element";
import type { ViewControlsElement, ViewChangeDetail } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { setThreeLoader, type BodyInfo, type SpacePreset, type WakuseiSpace } from "../src/space/element.ts";
import type { BodyId } from "../src/facts.ts";
import { findBody } from "../src/space/bodies.ts";
import { creditLine } from "../src/door/index.ts";
import { WORDS } from "./words.js";
import { bindBodyLabelRow, readBodyLabelState, renderBodyLabelRow } from "./body-label-row.ts";
import { bindPlacesRow, readPlacesState, renderPlacesRow } from "./places-row.ts";
// chikyu-earth is an optional peer: the demo carries its places layout so a page can lay places on the Earth (`earth-places`)
import "../src/earth-places.ts";
import type * as Orbiters from "../src/orbiters.ts";

const chooser = (): { lang: "en" | "ja"; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: "en" | "ja"; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));

setThreeLoader(() => import("./three-subset.ts"));

const space = document.querySelector<WakuseiSpace>("#space")!;
const controls = document.querySelector<ViewControlsElement>("kazoku-view-controls")!;
const replay = document.querySelector<ReplayBarElement>("#replay")!;
const when = document.querySelector<HTMLInputElement>("#when")!;
const nowButton = document.querySelector<HTMLButtonElement>("#now")!;
const caption = document.querySelector<HTMLElement>("#caption")!;
const scaleNote = document.querySelector<HTMLElement>("#scale-note")!;
const $$ = (selector: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(selector)];

// the element names bodies and the scale in the page's language from the start, not only after the reader changes it
space.setAttribute("lang", chooser()?.lang ?? "en");
const address = createAddressState({ defaults: {} });
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const DEFAULT_SPEED = 3600;
const state = {
  scale: pick(address.get("scale"), ["compressed", "true"], "true"),
  look: pick(address.get("look"), ["realistic", "painted"], "realistic"),
  light: pick(address.get("light"), ["sun", "lit"], "sun"),
  orbits: address.get("orbits") !== "0",
  names: address.get("names") !== "0",
  /** Starman and the Roadster, drawn on their orbit (their path is fetched the first time). */
  starman: address.get("starman") === "1",
  /** The spacecraft in orbit round the Moon and Mars (their paths are fetched the first time). */
  orbiters: address.get("orbiters") === "1",
  /** Every other known moon drawn as a dot, and the list of the planet's moons under the controls (`moons=all`). */
  allMoons: address.get("moons") === "all",
  /** The craft picked out, which orbit lines are drawn, and its ground track. */
  orbiter: address.get("orbiter") ?? "",
  orbiterLines: pick(address.get("olines"), ["all", "chosen", "none"], "all"),
  orbiterTrack: address.get("otrack") === "1",
  /** Playing: the clock runs from the date shown at `speed` times real time. A page opened with no date, speed or play in its address opens playing, from now, an hour a second (the first speed at which the Earth's turn shows); a link that names a date or a speed, and a reader who asked for reduced motion, get it still with Play ready. */
  play: address.get("play") === "on" || (!["play", "t", "speed"].some((key) => address.get(key) !== null) && !matchMedia("(prefers-reduced-motion: reduce)").matches),
  /** Times real time while playing; an old link with `speed=0` or none gets an hour a second. */
  speed: Number(address.get("speed") ?? 0) || DEFAULT_SPEED,
  time: address.get("t") ?? "now",
  ride: pick(address.get("ride"), ["", "moon", "moon:beside", "mars", "io", "orbiter"], ""),
  rideLook: pick(address.get("rlook"), ["down", "horizon"], "down"),
  goto: pick<SpacePreset>(address.get("goto"), ["earth", "moon", "sun", "inner", "solar-system", "jupiter-moons"], "earth"),
  /** How the camera moves between bodies: one of the view's named moves, kept in the address so each can be tried. */
  transition: pick(address.get("tr"), ["turn-travel", "direct", "look-back", "auto", "cut"], "turn-travel"),
  /** How slow the moves are: the plan's length times this. */
  pace: pick(address.get("pace"), ["0.5", "1", "2", "4"], "1"),
};
const bodyLabel = readBodyLabelState(address);
const places = readPlacesState(address);

const pressed = (button: HTMLElement, on: boolean): void => {
  button.setAttribute("aria-pressed", String(on));
  button.classList.toggle("on", on);
};
const localValue = (ms: number): string => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const isoSecond = (ms: number): string => new Date(ms).toISOString().slice(0, 19) + "Z";
/** The date the reader chose (the address, the box or Now): Back returns to it. */
let origin = state.time === "now" ? Date.now() : Date.parse(state.time);
if (!Number.isFinite(origin)) origin = Date.now();

let applied: string | undefined;
let appliedRide: string | undefined;

function render(): void {
  space.scale = state.scale;
  space.look = state.look;
  space.light = state.light;
  space.orbits = state.orbits;
  space.labels = state.names;
  space.roadster = state.starman;
  space.orbiters = state.orbiters;
  space.allMoons = state.allMoons;
  space.orbiter = state.orbiter || null;
  space.orbiterLines = state.orbiterLines;
  space.orbiterTrack = state.orbiterTrack;
  if (replay.playing !== state.play) replay.playing = state.play;
  state.play = replay.playing;
  if (applied !== state.time) {
    applied = state.time;
    space.time = state.time === "now" ? "now" : Date.parse(state.time);
  }
  // the speed is set after the date, so a clock that holds tells the page the date it was set to
  space.speed = state.play ? state.speed : 0;
  for (const b of $$("#scales [data-scale]")) pressed(b, b.dataset["scale"] === state.scale);
  for (const b of $$("#looks [data-look]")) pressed(b, b.dataset["look"] === state.look);
  for (const b of $$("#lights [data-light]")) pressed(b, b.dataset["light"] === state.light);
  for (const b of $$("#gotos [data-goto]")) pressed(b, b.dataset["goto"] === state.goto);
  space.transition = state.transition;
  space.pace = Number(state.pace);
  for (const b of $$("#transitions [data-transition]")) pressed(b, b.dataset["transition"] === state.transition);
  for (const b of $$("#paces [data-pace]")) pressed(b, b.dataset["pace"] === state.pace);
  stageName.textContent = space.region === null ? "" : space.stats.region?.name ?? "";
  (document.querySelector("#step-in") as HTMLButtonElement).disabled = space.region === null;
  for (const b of $$("#rides [data-ride]")) pressed(b, b.dataset["ride"] === state.ride);
  for (const b of $$("#ride-looks [data-ride-look]")) pressed(b, b.dataset["rideLook"] === state.rideLook);
  // riding the chosen craft waits for the orbiters' module
  const rideKey = `${state.ride}|${state.rideLook}|${state.ride === "orbiter" ? `${state.orbiter}|${orbiterModule !== null}` : ""}`;
  if (appliedRide !== rideKey) {
    appliedRide = rideKey;
    if (state.ride === "orbiter") {
      const id = state.orbiter as Orbiters.OrbiterId;
      if (orbiterModule !== null && orbiterModule.ORBITER_IDS.includes(id)) space.ride(orbiterModule.orbiterRidePoint(id), { around: orbiterModule.orbiterCentre(id), look: state.rideLook });
    } else {
      // "moon:beside" is the Moon seen from beyond it, with the Earth in view behind
      const [target, view] = state.ride.split(":") as ["moon" | "mars" | "io" | "", "beside" | undefined];
      space.ride(target === "" ? null : target, { look: state.rideLook, ...(view ? { view } : {}) });
    }
  }
  pressed(document.querySelector<HTMLElement>("#orbits")!, state.orbits);
  pressed(document.querySelector<HTMLElement>("#names")!, state.names);
  pressed(document.querySelector<HTMLElement>("#starman")!, state.starman);
  pressed(document.querySelector<HTMLElement>("#orbiters")!, state.orbiters);
  pressed(document.querySelector<HTMLElement>("#all-moons")!, state.allMoons);
  renderMoonList();
  renderOrbiters();
  renderBodyLabelRow(bodyLabel, space, address);
  renderPlacesRow(places, space, address);
  pressed(nowButton, state.time === "now");
  if (replay.getAttribute("speed") !== String(state.speed)) replay.setAttribute("speed", String(state.speed));
  replay.setAttribute("lang", chooser()?.lang ?? "en");
  replay.words = { start: say("sp_back") };
  if (!state.play && document.activeElement !== when) when.value = localValue(state.time === "now" ? space.time : Date.parse(state.time));
  scaleNote.textContent = say(state.scale === "true" ? "sp_note_true" : "sp_note_compressed");
  address.set("scale", state.scale === "true" ? null : state.scale);
  address.set("look", state.look === "realistic" ? null : state.look);
  address.set("light", state.light === "sun" ? null : state.light);
  address.set("orbits", state.orbits ? null : "0");
  address.set("names", state.names ? null : "0");
  address.set("starman", state.starman ? "1" : null);
  address.set("orbiters", state.orbiters ? "1" : null);
  address.set("moons", state.allMoons ? "all" : null);
  address.set("orbiter", state.orbiters && state.orbiter ? state.orbiter : null);
  address.set("olines", state.orbiters && state.orbiterLines !== "all" ? state.orbiterLines : null);
  address.set("otrack", state.orbiters && state.orbiterTrack ? "1" : null);
  address.set("play", state.play ? "on" : null);
  address.set("speed", state.speed === DEFAULT_SPEED ? null : String(state.speed));
  address.set("t", state.time === "now" ? null : state.time);
  address.set("goto", state.goto === "earth" || (state.goto as string) === "" ? null : state.goto);
  address.set("tr", state.transition === "turn-travel" ? null : state.transition);
  address.set("pace", state.pace === "1" ? null : state.pace);
  address.set("ride", state.ride === "" ? null : state.ride);
  address.set("rlook", state.rideLook === "down" ? null : state.rideLook);
}

function goTo(preset: SpacePreset): void {
  state.goto = preset;
  space.body = preset === "moon" ? "moon" : preset === "sun" ? "sun" : preset === "jupiter-moons" ? "jupiter" : "earth";
  controls.controller.set({ zoom: space.zoomFor(preset) }, true, "jump");
  render();
}

for (const b of $$("#scales [data-scale]")) b.addEventListener("click", () => ((state.scale = b.dataset["scale"] as typeof state.scale), render()));
for (const b of $$("#looks [data-look]")) b.addEventListener("click", () => ((state.look = b.dataset["look"] as typeof state.look), render()));
for (const b of $$("#lights [data-light]")) b.addEventListener("click", () => ((state.light = b.dataset["light"] as typeof state.light), render()));
for (const b of $$("#gotos [data-goto]")) b.addEventListener("click", () => goTo(b.dataset["goto"] as SpacePreset));
for (const b of $$("#transitions [data-transition]")) b.addEventListener("click", () => ((state.transition = b.dataset["transition"] as typeof state.transition), render()));
for (const b of $$("#paces [data-pace]")) b.addEventListener("click", () => ((state.pace = b.dataset["pace"] as typeof state.pace), render()));
const stageName = document.querySelector<HTMLOutputElement>("#stage-name")!;
// the stages out from the Sun: a step clears the Go to choice, since the view is at a stage, not at a preset
document.querySelector("#step-out")!.addEventListener("click", () => {
  if (space.stepOut() !== null) (state as { goto: string }).goto = "";
  render();
});
document.querySelector("#step-in")!.addEventListener("click", () => {
  const to = space.stepIn();
  if (to === "sun") state.goto = "sun";
  render();
});
space.addEventListener("wakusei-region", () => render());
space.addEventListener("wakusei-hop", () => render());
// riding along is for watching it go by: a ride starts the clock (Play), and the date box moves with it
for (const b of $$("#rides [data-ride]")) b.addEventListener("click", () => ((state.ride = b.dataset["ride"] as typeof state.ride), (state.play = state.play || state.ride !== ""), render()));
for (const b of $$("#ride-looks [data-ride-look]")) b.addEventListener("click", () => ((state.rideLook = b.dataset["rideLook"] as typeof state.rideLook), render()));
document.querySelector("#orbits")!.addEventListener("click", () => ((state.orbits = !state.orbits), render()));
document.querySelector("#names")!.addEventListener("click", () => ((state.names = !state.names), render()));
document.querySelector("#starman")!.addEventListener("click", () => ((state.starman = !state.starman), render()));
document.querySelector("#all-moons")!.addEventListener("click", () => ((state.allMoons = !state.allMoons), render()));

// The moons of the planet in view, from the catalogue (fetched the first time "All moons" is on): the counts, a row of its groups, and a table that scrolls in its own box.
let catalogue: typeof import("../src/moon-catalogue.ts") | undefined;
let moonGroup = "";
function renderMoonList(): void {
  const panel = document.querySelector<HTMLElement>("#moon-list")!;
  panel.hidden = !state.allMoons;
  if (!state.allMoons) return;
  if (catalogue === undefined) {
    void import("../src/moon-catalogue.ts").then((mod) => ((catalogue = mod), renderMoonList()));
    return;
  }
  const here = space.bodyInfo(space.body);
  const host = (here.kind === "moon" ? here.host : here.id) as BodyId;
  const all = catalogue.catalogueMoonsOf(host as Parameters<typeof catalogue.catalogueMoonsOf>[0]);
  const hostName = space.bodyInfo(host).name;
  document.querySelector("#moon-list-h")!.textContent = say("sp_moons_of", { name: hostName });
  const named = all.filter((m) => m.named).length;
  document.querySelector("#moon-count")!.textContent = all.length === 0 ? say("sp_moons_none", { name: hostName }) : say("sp_moons_count", { count: all.length, named, date: catalogue.MOON_CATALOGUE_FETCHED });
  const groups = [...new Set(all.map((m) => m.group))];
  if (!groups.includes(moonGroup as never)) moonGroup = "";
  document.querySelector("#moon-groups")!.replaceChildren(
    ...["", ...groups].map((g) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = g === "" ? say("sp_moon_group_all") : say(`sp_group_${g}`);
      pressed(button, g === moonGroup);
      button.addEventListener("click", () => ((moonGroup = g), renderMoonList()));
      return button;
    }),
  );
  const lang = chooser()?.lang ?? "en";
  const rows = all.filter((m) => moonGroup === "" || m.group === moonGroup);
  document.querySelector("#moon-rows")!.replaceChildren(
    ...rows.map((m) => {
      const tr = document.createElement("tr");
      const name = lang === "ja" && m.ja !== null ? m.ja : m.label;
      const found = m.discovery.year === null ? "" : `${m.discovery.year}${m.discovery.by ? ` · ${m.discovery.by}` : ""}`;
      const size = m.radiusKm === null ? "" : `${m.radiusKm.toLocaleString("en-US")} km${m.radiusFrom === "derived" ? " *" : ""}`;
      for (const text of [name, say(`sp_group_${m.group}`), found, size, say(`sp_grade_${m.full ? "full" : m.grade}`)]) tr.append(Object.assign(document.createElement("td"), { textContent: text }));
      return tr;
    }),
  );
}
space.addEventListener("wakusei-hop", () => renderMoonList());
window.addEventListener("wakusei-language", () => queueMicrotask(renderMoonList));
document.querySelector("#orbiters")!.addEventListener("click", () => {
  state.orbiters = !state.orbiters;
  if (!state.orbiters && state.ride === "orbiter") state.ride = "";
  render();
});
for (const b of $$("#orbiter-lines [data-olines]")) b.addEventListener("click", () => ((state.orbiterLines = b.dataset["olines"] as typeof state.orbiterLines), render()));
document.querySelector("#orbiter-track")!.addEventListener("click", () => ((state.orbiterTrack = !state.orbiterTrack), render()));

// the orbiters' row and card: the module is fetched when Orbiters is first switched on, as the element fetches it
let orbiterModule: typeof Orbiters | null = null;
let orbiterLoading = false;
/** The famous landing site each body's next pass is worked out for, from `/places`, fetched with the first craft picked there. */
const PASS_PLACE = { moon: "moon/apollo-11-lunar-module", mars: "mars/perseverance" } as const;
const passPlaces: Partial<Record<"moon" | "mars", { lat: number; lon: number; name: { en: string; ja: string } } | null>> = {};
/** The pass worked out last, kept while the moment shown is before its end: the search is not run at every frame. */
let passCache: { key: string; from: number; pass: Orbiters.OrbiterPass | undefined } | null = null;
function renderOrbiters(): void {
  document.querySelector<HTMLElement>("#orbiter-row")!.hidden = !state.orbiters;
  document.querySelector<HTMLElement>("#orbiter-tools")!.hidden = !state.orbiters;
  const card = document.querySelector<HTMLElement>("#orbiter-card")!;
  card.hidden = !state.orbiters;
  if (!state.orbiters) return;
  if (orbiterModule === null) {
    if (!orbiterLoading) {
      orbiterLoading = true;
      void import("../src/orbiters.ts").then((mod) => {
        orbiterModule = mod;
        render();
      });
    }
    return;
  }
  const mod = orbiterModule;
  const lang = chooser()?.lang ?? "en";
  for (const centre of ["moon", "mars"] as const) {
    const group = document.querySelector<HTMLElement>(`#orbiter-picks-${centre}`)!;
    const ids = mod.ORBITER_IDS.filter((id) => mod.orbiterCentre(id) === centre);
    if (group.childElementCount !== ids.length) {
      group.replaceChildren(
        ...ids.map((id) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset["orbiter"] = id;
          button.addEventListener("click", () => {
            state.orbiter = state.orbiter === id ? "" : id;
            if (state.orbiter === "" && state.ride === "orbiter") state.ride = "";
            // the craft's body is brought into view, close enough for its craft to be drawn
            if (state.orbiter !== "" && space.body !== centre) space.goTo(centre);
            render();
          });
          return button;
        }),
      );
    }
    for (const button of group.querySelectorAll<HTMLButtonElement>("button")) {
      const id = button.dataset["orbiter"] as Orbiters.OrbiterId;
      button.textContent = mod.orbiterFacts(id).short[lang];
      button.title = mod.orbiterFacts(id).name[lang];
      pressed(button, state.orbiter === id);
    }
  }
  for (const b of $$("#orbiter-lines [data-olines]")) pressed(b, b.dataset["olines"] === state.orbiterLines);
  pressed(document.querySelector<HTMLElement>("#orbiter-track")!, state.orbiterTrack);
  const id = mod.ORBITER_IDS.includes(state.orbiter as Orbiters.OrbiterId) ? (state.orbiter as Orbiters.OrbiterId) : null;
  const elements = id === null ? undefined : mod.orbiterElements(id);
  document.querySelector<HTMLButtonElement>('#rides [data-ride="orbiter"]')!.hidden = elements === undefined;
  if (id === null) {
    card.replaceChildren(line(say("sp_ocard_pick")));
    return;
  }
  const ms = space.time;
  const facts = mod.orbiterFacts(id);
  const year = facts.launch.date.slice(0, 4);
  const lines: HTMLElement[] = [line(`${facts.name[lang]}: ${facts.operator}, ${facts.launch.vehicle ? say("sp_ocard_launch", { year, vehicle: facts.launch.vehicle }) : say("sp_ocard_launch_year", { year })}`)];
  lines.push(line(facts.about[lang]));
  if (facts.instruments.length > 0) lines.push(line(say("sp_ocard_instruments", { list: facts.instruments.map((one) => one.short ?? one.name).join(", ") })));
  const numbers = mod.orbiterNumbers(id, ms);
  const local = (when: string | number): string => new Date(when).toLocaleString(lang === "ja" ? "ja-JP" : "en-CA", { dateStyle: "medium", timeStyle: "short" });
  const day = (iso: string): string => new Date(`${iso.slice(0, 10)}T12:00Z`).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-CA", { dateStyle: "medium" });
  if (numbers !== undefined && elements !== undefined) {
    const minutes = numbers.periodDays * 1440;
    const period = minutes < 600 ? say("sp_minutes", { n: Math.round(minutes) }) : say("sp_hours", { n: (minutes / 60).toFixed(1) });
    lines.push(line(say("sp_ocard_numbers", { alt: Math.round(numbers.altitudeKm).toLocaleString("en-US"), speed: numbers.speedKmS.toFixed(2), period, inc: numbers.inclinationDeg.toFixed(1) })));
    const err = numbers.errorKm === null ? "" : Math.round(numbers.errorKm).toLocaleString("en-US");
    const statusLine = numbers.status === "tracked" ? say("sp_ocard_tracked", { err }) : numbers.status === "predicted" ? say("sp_ocard_predicted", { date: local(elements.fitUntil), err }) : say("sp_ocard_modelled");
    lines.push(line(`${statusLine} ${say("sp_ocard_good", { date: local(elements.validUntil), read: day(elements.retrieved) })}`));
  } else {
    lines.push(line(say("sp_ocard_none")));
  }
  if (facts.status.state === "ended") lines.push(line(facts.status.note?.[lang] ?? say("sp_ocard_ended")));
  else if (facts.status.note) lines.push(line(facts.status.note[lang]));
  if (elements !== undefined) {
    const centre = mod.orbiterCentre(id);
    const place = passPlaces[centre];
    if (place === undefined) {
      passPlaces[centre] = null;
      void import("../src/places.ts").then(async (places) => {
        const found = (await places.loadPlaces(centre)).find((one) => one.id === PASS_PLACE[centre]);
        passPlaces[centre] = found ? { lat: found.lat, lon: found.lon, name: found.name } : null;
        render();
      });
    } else if (place !== null) {
      const key = `${id}|${centre}`;
      if (passCache === null || passCache.key !== key || ms < passCache.from || (passCache.pass !== undefined && ms > passCache.pass.set) || (passCache.pass === undefined && ms > passCache.from + 86_400_000)) {
        passCache = { key, from: ms, pass: mod.orbiterNextPass(id, place, ms) };
      }
      const pass = passCache.pass;
      lines.push(line(pass === undefined ? say("sp_ocard_nopass", { place: place.name[lang] }) : say("sp_ocard_pass", { place: place.name[lang], time: local(pass.highest), elev: Math.round(pass.elevationDeg) })));
    }
  }
  card.replaceChildren(...lines);
}
function line(text: string): HTMLElement {
  return Object.assign(document.createElement("div"), { textContent: text });
}
bindBodyLabelRow(bodyLabel, render);
bindPlacesRow(places, space, render, () => chooser()?.lang ?? "en");
nowButton.addEventListener("click", () => {
  state.time = "now";
  origin = Date.now();
  applied = undefined;
  render();
  when.value = localValue(space.time);
});
when.addEventListener("change", () => {
  const ms = Date.parse(when.value);
  if (Number.isFinite(ms)) {
    state.time = isoSecond(ms);
    origin = ms;
    applied = undefined;
    render();
  }
});
// the clock: the element tells the date while time runs (a few times a second) and once when it holds
space.addEventListener("wakusei-timechange", (event) => {
  const { time, running } = (event as CustomEvent<{ time: number; running: boolean }>).detail;
  if (document.activeElement !== when) when.value = localValue(time);
  if (state.orbiters && state.orbiter) renderOrbiters();
  if (running) return;
  // the clock holds: the date it stopped on is the date shown, and the address keeps it
  state.time = isoSecond(time);
  applied = state.time;
  address.set("t", state.time);
  pressed(nowButton, false);
});
replay.addEventListener("kazoku-replay", (event) => {
  const { action, playing, reason } = (event as CustomEvent<ReplayDetail>).detail;
  if (reason !== "user") return;
  if (action === "start") {
    // Back: the date the reader chose, held
    state.play = false;
    state.time = isoSecond(origin);
    applied = undefined;
    render();
    when.value = localValue(origin);
    return;
  }
  if (action === "repeat") return;
  state.play = playing;
  if (playing && document.activeElement !== when) when.value = localValue(space.time);
  render();
});
replay.addEventListener("kazoku-speedchange", (event) => {
  const { value, reason } = (event as CustomEvent<{ value: number; reason: string }>).detail;
  if (reason !== "user") return;
  state.speed = value;
  render();
});
// leaving while the clock runs: the date it had reached goes into the address, so a returning reader is where they were
addEventListener("pagehide", () => {
  if (!state.play) return;
  address.set("t", isoSecond(space.time));
  address.flush();
});
controls.addEventListener("kazoku-viewchange", (event) => {
  const detail = (event as CustomEvent<ViewChangeDetail>).detail;
  space.setView(detail, detail.final);
});
space.addEventListener("wakusei-body-click", (event) => {
  const info = (event as CustomEvent<BodyInfo>).detail;
  caption.textContent = say("sp_picked", { name: info.name, radius: Math.round(info.radiusKm).toLocaleString("en-US"), distance: Math.round(info.distanceKm).toLocaleString("en-US") });
});
// the first press on a body selects it and offers to go there; a second press on it goes, and so does the button. A press never sends the view anywhere else.
const goThere = document.querySelector<HTMLButtonElement>("#go-there")!;
space.addEventListener("wakusei-body-select", (event) => {
  const info = (event as CustomEvent<BodyInfo>).detail;
  goThere.hidden = info.id === space.body;
  goThere.textContent = `${say("sp_go")}: ${info.name}`;
});
goThere.addEventListener("click", () => {
  if (space.selected) space.goTo(space.selected);
});
// the hopper: two arrows with the names of where each leads. The bar holds the zoom, so the page applies the one the hop asks for.
const hopPrev = document.querySelector<HTMLButtonElement>("#hop-prev")!;
const hopNext = document.querySelector<HTMLButtonElement>("#hop-next")!;
function showHop(): void {
  const { current, previous, next } = space.hopper;
  document.querySelector("#hop-prev-name")!.textContent = previous.name;
  document.querySelector("#hop-next-name")!.textContent = next.name;
  hopPrev.setAttribute("aria-label", `${say("sp_hop_prev")}: ${previous.name}`);
  hopNext.setAttribute("aria-label", `${say("sp_hop_next")}: ${next.name}`);
  document.querySelector("#hop-now")!.textContent = say("sp_hop_now", { name: current.name });
  goThere.hidden = space.selected === null || space.selected === current.id;
}
hopPrev.addEventListener("click", () => space.previous());
hopNext.addEventListener("click", () => space.next());
space.addEventListener("wakusei-hop", (event) => {
  const { zoom, yaw, tilt } = (event as CustomEvent<{ zoom?: number; yaw?: number; tilt?: number }>).detail;
  if (zoom !== undefined) {
    // a move that travels also says the side the camera comes from, so the way in is straight
    controls.controller.set(yaw !== undefined && tilt !== undefined ? { zoom, yaw, tilt } : { zoom }, true, "jump");
    (state as { goto: string }).goto = "";
  }
  showHop();
  render();
});
// the family's Help switch is the element's help mode: with it on, the body looked at shows its axis and a curved arrow for the way it spins
const followHelp = (): void => {
  space.help = document.documentElement.getAttribute("data-help") === "on";
};
document.addEventListener("family-help", followHelp);
followHelp();
// the picker: a kind (the Sun and planets, dwarf planets, small bodies, moons), for a moon the planet it goes round, then the body; or a search by name. A choice goes there.
type PickKind = "planet" | "dwarf-planet" | "minor" | "moon";
const choice = { kind: "planet" as PickKind, host: "" };
/** The picker's kind of a body: the Sun is among the planets, and asteroids, centaurs and comets are the small bodies. */
const kindOf = (info: BodyInfo): PickKind => (info.kind === "star" ? "planet" : info.kind === "asteroid" || info.kind === "centaur" || info.kind === "comet" ? "minor" : info.kind);
const labelled = (button: HTMLButtonElement, info: BodyInfo, on: boolean): void => {
  button.dataset["id"] = info.id;
  button.textContent = info.name;
  button.setAttribute("aria-pressed", String(on));
  button.classList.toggle("on", on);
};
function renderPicker(): void {
  const all = space.bodyList();
  const here = space.body;
  const hereInfo = all.find((info) => info.id === here);
  const hosts = [...new Set(all.filter((info) => info.kind === "moon").map((info) => info.host as BodyId))];
  if (choice.kind === "moon" && (!choice.host || !hosts.includes(choice.host as BodyId))) choice.host = hosts[0] ?? "";
  for (const b of $$("#kinds [data-kind]")) pressed(b, b.dataset["kind"] === choice.kind);
  document.querySelector<HTMLElement>("#hosts-row")!.hidden = choice.kind !== "moon";
  document.querySelector<HTMLElement>("#hosts")!.replaceChildren(
    ...hosts.map((id) => {
      const button = document.createElement("button");
      button.type = "button";
      labelled(button, all.find((info) => info.id === id) ?? space.bodyInfo(id), id === choice.host);
      button.addEventListener("click", () => ((choice.host = id), renderPicker()));
      return button;
    }),
  );
  const choices = all.filter((info) => kindOf(info) === choice.kind && (choice.kind !== "moon" || info.host === choice.host));
  document.querySelector<HTMLElement>("#choices")!.replaceChildren(
    ...choices.map((info) => {
      const button = document.createElement("button");
      button.type = "button";
      labelled(button, info, info.id === here);
      button.addEventListener("click", () => space.goTo(info.id));
      return button;
    }),
  );
  // the search list holds every body's name, in the page's language
  document.querySelector("#find-list")!.replaceChildren(...all.map((info) => Object.assign(document.createElement("option"), { value: info.name })));
  document.querySelector<HTMLInputElement>("#find")!.placeholder = say("sp_search_placeholder");
  // a planet with moons can be shown with them
  const system = document.querySelector<HTMLButtonElement>("#system")!;
  const hasMoons = hereInfo !== undefined && hereInfo.kind !== "moon" && hosts.includes(hereInfo.id);
  system.hidden = !hasMoons;
  if (hasMoons) system.dataset["body"] = hereInfo.id;
}
document.querySelector("#find")!.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  const found = findBody(input.value);
  if (found && space.goTo(found)) input.value = "";
});
document.querySelector("#system")!.addEventListener("click", (event) => {
  const id = (event.currentTarget as HTMLElement).dataset["body"] as BodyId | undefined;
  if (!id) return;
  const preset = (id === "earth" ? "moon" : `${id}-moons`) as SpacePreset;
  space.goTo(id, { zoom: space.zoomFor(preset) });
});
for (const b of $$("#kinds [data-kind]")) b.addEventListener("click", () => ((choice.kind = b.dataset["kind"] as typeof choice.kind), renderPicker()));
space.addEventListener("wakusei-hop", renderPicker);
window.addEventListener("wakusei-language", () => queueMicrotask(renderPicker));
space.addEventListener("wakusei-ready", renderPicker);
renderPicker();
export type { BodyId };
window.addEventListener("wakusei-language", () => {
  space.setAttribute("lang", chooser()?.lang ?? "en");
  render();
  showHop();
});
// whose data is on the screen: the credit line of the view, in the page's language (the data door); `?data=own` ignores every outside source at once
const doorLine = document.querySelector<HTMLElement>("#door-credit");
if (doorLine) {
  const show = (): void => {
    doorLine.textContent = creditLine(space.credits(), chooser()?.lang ?? "en");
  };
  space.addEventListener("wakusei-creditschange", show);
  window.addEventListener("wakusei-language", show);
  show();
}
if (new URLSearchParams(location.search).get("data") === "own") space.setAttribute("data", "own");
// an address with a Go to choice in it opens at that view, not at the Earth with the choice only marked
if (state.goto !== "earth" && (state.goto as string) !== "") goTo(state.goto);
render();
showHop();
