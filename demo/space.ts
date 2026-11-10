// The space view page: one <wakusei-space> (one WebGL context for every body in it) with the family's view controls and replay bar around it. The choices are kept in the address.
// The date box follows the clock: <wakusei-space> sends `wakusei-timechange` while time runs and once when it holds, and the box shows it (never while the reader is typing in it).
// Play runs the clock from the date shown; Pause holds it there and writes it to the address (`t`); Back goes to the date the reader chose. `play=on` and `speed` stay in the address.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import "@johnmorrisdotca/kazoku-ui/replay-bar/define";
import type { ReplayBarElement, ReplayDetail } from "@johnmorrisdotca/kazoku-ui/replay-bar/element";
import type { ViewControlsElement, ViewChangeDetail } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { setThreeLoader, type BodyInfo, type SpacePreset, type WakuseiSpace } from "../src/space/element.ts";
import { WORDS } from "./words.js";

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

const address = createAddressState({ defaults: {} });
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const DEFAULT_SPEED = 3600;
const state = {
  scale: pick(address.get("scale"), ["compressed", "true"], "true"),
  look: pick(address.get("look"), ["realistic", "painted"], "realistic"),
  light: pick(address.get("light"), ["sun", "lit"], "sun"),
  orbits: address.get("orbits") !== "0",
  names: address.get("names") !== "0",
  /** Playing: the clock runs from the date shown at `speed` times real time. Reduced motion leaves it off (the bar sees to that). */
  play: address.get("play") === "on",
  /** Times real time while playing; an old link with `speed=0` or none gets an hour a second. */
  speed: Number(address.get("speed") ?? 0) || DEFAULT_SPEED,
  time: address.get("t") ?? "now",
  ride: pick(address.get("ride"), ["", "moon", "mars", "io"], ""),
  rideLook: pick(address.get("rlook"), ["down", "horizon"], "down"),
  goto: pick<SpacePreset>(address.get("goto"), ["earth", "moon", "sun", "inner", "solar-system", "jupiter-moons"], "earth"),
};

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
  for (const b of $$("#rides [data-ride]")) pressed(b, b.dataset["ride"] === state.ride);
  for (const b of $$("#ride-looks [data-ride-look]")) pressed(b, b.dataset["rideLook"] === state.rideLook);
  if (appliedRide !== `${state.ride}|${state.rideLook}`) {
    appliedRide = `${state.ride}|${state.rideLook}`;
    space.ride(state.ride === "" ? null : (state.ride as "moon" | "mars" | "io"), { look: state.rideLook });
  }
  pressed(document.querySelector<HTMLElement>("#orbits")!, state.orbits);
  pressed(document.querySelector<HTMLElement>("#names")!, state.names);
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
  address.set("play", state.play ? "on" : null);
  address.set("speed", state.speed === DEFAULT_SPEED ? null : String(state.speed));
  address.set("t", state.time === "now" ? null : state.time);
  address.set("goto", state.goto === "earth" ? null : state.goto);
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
// riding along is for watching it go by: a ride starts the clock (Play), and the date box moves with it
for (const b of $$("#rides [data-ride]")) b.addEventListener("click", () => ((state.ride = b.dataset["ride"] as typeof state.ride), (state.play = state.play || state.ride !== ""), render()));
for (const b of $$("#ride-looks [data-ride-look]")) b.addEventListener("click", () => ((state.rideLook = b.dataset["rideLook"] as typeof state.rideLook), render()));
document.querySelector("#orbits")!.addEventListener("click", () => ((state.orbits = !state.orbits), render()));
document.querySelector("#names")!.addEventListener("click", () => ((state.names = !state.names), render()));
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
  // pressing the body already looked at changes nothing: the two presses of a double press (zoom in, zoom out) must not each start the view over
  if (space.body !== info.id) {
    space.body = info.id;
    controls.controller.set({ zoom: 1 }, true, "jump");
  }
});
window.addEventListener("wakusei-language", () => {
  space.setAttribute("lang", chooser()?.lang ?? "en");
  render();
});
render();
