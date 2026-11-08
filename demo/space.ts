// The space view page: one <wakusei-space> (one WebGL context for every body in it) with the family's view controls and speed buttons around it. The choices are kept in the address.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import "@johnmorrisdotca/kazoku-ui/speed-buttons/define";
import type { SpeedButtonsElement } from "@johnmorrisdotca/kazoku-ui/speed-buttons/element";
import type { ViewControlsElement, ViewChangeDetail } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { setThreeLoader, type BodyInfo, type SpacePreset, type WakuseiSpace } from "../src/space/element.ts";
import { WORDS } from "./words.js";

const chooser = (): { lang: "en" | "ja"; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: "en" | "ja"; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));

setThreeLoader(() => import("./three-subset.ts"));

const space = document.querySelector<WakuseiSpace>("#space")!;
const controls = document.querySelector<ViewControlsElement>("kazoku-view-controls")!;
const speeds = document.querySelector<SpeedButtonsElement>("#speeds")!;
const when = document.querySelector<HTMLInputElement>("#when")!;
const nowButton = document.querySelector<HTMLButtonElement>("#now")!;
const caption = document.querySelector<HTMLElement>("#caption")!;
const scaleNote = document.querySelector<HTMLElement>("#scale-note")!;
const $$ = (selector: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(selector)];

const address = createAddressState({ defaults: {} });
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const state = {
  scale: pick(address.get("scale"), ["compressed", "true"], "compressed"),
  look: pick(address.get("look"), ["realistic", "painted"], "realistic"),
  light: pick(address.get("light"), ["sun", "lit"], "sun"),
  orbits: address.get("orbits") !== "0",
  names: address.get("names") !== "0",
  speed: Number(address.get("speed") ?? 0) || 0,
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

let applied: string | undefined;
let appliedRide: string | undefined;

function render(): void {
  space.scale = state.scale;
  space.look = state.look;
  space.light = state.light;
  space.orbits = state.orbits;
  space.labels = state.names;
  space.speed = state.speed;
  if (applied !== state.time) {
    applied = state.time;
    space.time = state.time === "now" ? "now" : Date.parse(state.time);
  }
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
  speeds.value = state.speed;
  when.value = localValue(state.time === "now" ? Date.now() : Date.parse(state.time));
  scaleNote.textContent = say(state.scale === "true" ? "sp_note_true" : "sp_note_compressed");
  address.set("scale", state.scale === "compressed" ? null : state.scale);
  address.set("look", state.look === "realistic" ? null : state.look);
  address.set("light", state.light === "sun" ? null : state.light);
  address.set("orbits", state.orbits ? null : "0");
  address.set("names", state.names ? null : "0");
  address.set("speed", state.speed === 0 ? null : String(state.speed));
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
for (const b of $$("#rides [data-ride]")) b.addEventListener("click", () => ((state.ride = b.dataset["ride"] as typeof state.ride), render()));
for (const b of $$("#ride-looks [data-ride-look]")) b.addEventListener("click", () => ((state.rideLook = b.dataset["rideLook"] as typeof state.rideLook), render()));
document.querySelector("#orbits")!.addEventListener("click", () => ((state.orbits = !state.orbits), render()));
document.querySelector("#names")!.addEventListener("click", () => ((state.names = !state.names), render()));
nowButton.addEventListener("click", () => ((state.time = "now"), render()));
when.addEventListener("change", () => {
  const ms = Date.parse(when.value);
  if (Number.isFinite(ms)) {
    state.time = new Date(ms).toISOString().slice(0, 16) + "Z";
    render();
  }
});
speeds.addEventListener("kazoku-speedchange", (event) => {
  const { value, reason } = (event as CustomEvent<{ value: number; reason: string }>).detail;
  if (reason !== "user") return;
  state.speed = value;
  render();
});
controls.addEventListener("kazoku-viewchange", (event) => {
  const detail = (event as CustomEvent<ViewChangeDetail>).detail;
  space.setView(detail, detail.final);
});
space.addEventListener("wakusei-body-click", (event) => {
  const info = (event as CustomEvent<BodyInfo>).detail;
  caption.textContent = say("sp_picked", { name: info.name, radius: Math.round(info.radiusKm).toLocaleString("en-US"), distance: Math.round(info.distanceKm).toLocaleString("en-US") });
  space.body = info.id;
  controls.controller.set({ zoom: 1 }, true, "jump");
});
window.addEventListener("wakusei-language", () => {
  space.setAttribute("lang", chooser()?.lang ?? "en");
  render();
});
render();
