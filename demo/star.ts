// The star page: one <wakusei-body star="..."> drawn from numbers (temperature, radius, class, rotation, flattening, spots) with the family's view controls, seven stars to start from and the numbers to change.
// It says which parts of the picture are measured and which are drawn for looks, and "Put it in your page" writes the code for the star as it is set up. The choices are kept in the address.
import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import type { EmbedChangeDetail, EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import type { ViewChangeDetail, ViewControlsElement } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { embedCode, embedCredit, EMBED_KINDS, type EmbedKind, type EmbedOptions } from "../src/embed.ts";
import { registerStarLook } from "../src/scene/look.ts";
import { LUMINOSITY_CLASSES, starLook, STAR_SUN, type LuminosityClass, type StarNumbers } from "../src/star.ts";
import "../src/element.ts";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";
import { WORDS } from "./words.js";

const chooser = (): { lang: "en" | "ja"; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: "en" | "ja"; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const lang = (): "en" | "ja" => chooser()?.lang ?? "en";

setThreeLoader(() => import("./three-subset.ts"));

/**
 * The stars to start from. The numbers are published values (Sun: IAU nominal; Vega: Monnier et al. 2012; Sirius A: Bond et al. 2017; Betelgeuse: Joyce et al. 2020; Rigel: Moravveji et al. 2013; Proxima: Ribas et al. 2017 and Kiraga and Stepien 2007;
 * Altair: Monnier et al. 2007; Sirius B: Bond et al. 2017). A number that is only roughly known is marked `estimated`, and a rotation nobody has measured is left out.
 */
const PRESETS: readonly { id: string; numbers: StarNumbers; ja: string }[] = [
  { id: "sun", numbers: { ...STAR_SUN }, ja: "太陽" },
  { id: "sirius-a", numbers: { name: "Sirius A", temperatureK: 9940, radiusSun: 1.711, luminosityClass: "V", rotationDays: 5.5, estimated: ["rotationDays"] }, ja: "シリウスA" },
  { id: "betelgeuse", numbers: { name: "Betelgeuse", temperatureK: 3600, radiusSun: 764, luminosityClass: "Iab", estimated: ["radiusSun"] }, ja: "ベテルギウス" },
  { id: "rigel", numbers: { name: "Rigel", temperatureK: 12100, radiusSun: 78.9, luminosityClass: "Ia" }, ja: "リゲル" },
  { id: "vega", numbers: { name: "Vega", temperatureK: 9602, radiusSun: 2.362, luminosityClass: "V", rotationDays: 0.68, oblateness: 0.11 }, ja: "ベガ" },
  { id: "proxima", numbers: { name: "Proxima Centauri", temperatureK: 3042, radiusSun: 0.154, luminosityClass: "V", rotationDays: 83.5 }, ja: "プロキシマ・ケンタウリ" },
  { id: "altair", numbers: { name: "Altair", temperatureK: 7550, radiusSun: 1.79, luminosityClass: "V", rotationDays: 0.45, oblateness: 0.2, estimated: ["rotationDays"] }, ja: "アルタイル" },
  { id: "white-dwarf", numbers: { name: "Sirius B", temperatureK: 25200, radiusSun: 0.0084, luminosityClass: "D" }, ja: "白色矮星 (シリウスB)" },
];
for (const preset of PRESETS) registerStarLook(preset.numbers.name ?? preset.id, preset.numbers);

const star = document.querySelector<WakuseiBody>("#star")!;
const controls = document.querySelector<ViewControlsElement>("kazoku-view-controls")!;
const caption = document.querySelector<HTMLElement>("#caption")!;
const honesty = document.querySelector<HTMLElement>("#honesty")!;
const presetsBox = document.querySelector<HTMLElement>("#presets")!;
const partsBox = document.querySelector<HTMLElement>("#parts")!;
const errorBox = document.querySelector<HTMLElement>("#error")!;
const inputs = {
  temperature: document.querySelector<HTMLInputElement>("#n-temperature")!,
  radius: document.querySelector<HTMLInputElement>("#n-radius")!,
  class: document.querySelector<HTMLSelectElement>("#n-class")!,
  rotation: document.querySelector<HTMLInputElement>("#n-rotation")!,
  oblateness: document.querySelector<HTMLInputElement>("#n-oblateness")!,
  activity: document.querySelector<HTMLInputElement>("#n-activity")!,
};
const panel = document.querySelector<EmbedPanelElement>("#embed-panel")!;
const $$ = (selector: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(selector)];
const pressed = (button: HTMLElement, on: boolean): void => {
  button.setAttribute("aria-pressed", String(on));
  button.classList.toggle("on", on);
};

const address = createAddressState({ defaults: { star: "sun" } });
const asLook = (value: string | null): "line" | "realistic" => (value === "line" ? "line" : "realistic");
const KEYS = { temperatureK: "temperature-k", radiusSun: "radius-sun", luminosityClass: "luminosity-class", rotationDays: "rotation-days", oblateness: "oblateness", activity: "activity" } as const;

const fromAddress = (): { preset: string | null; numbers: StarNumbers } => {
  const id = address.get("star") ?? "sun";
  const preset = PRESETS.find((one) => one.id === id);
  if (preset !== undefined) return { preset: preset.id, numbers: preset.numbers };
  const read = (key: string): number | undefined => (address.get(key) === null ? undefined : Number(address.get(key)));
  const numbers: StarNumbers = { name: "Custom", temperatureK: read(KEYS.temperatureK) ?? 5772, radiusSun: read(KEYS.radiusSun) ?? 1 };
  const cls = address.get(KEYS.luminosityClass);
  if (cls !== null && (LUMINOSITY_CLASSES as readonly string[]).includes(cls)) numbers.luminosityClass = cls as LuminosityClass;
  for (const key of ["rotationDays", "oblateness", "activity"] as const) {
    const value = read(KEYS[key]);
    if (value !== undefined) numbers[key] = value;
  }
  return { preset: null, numbers };
};

const state = { ...fromAddress(), look: asLook(address.get("look")), spin: address.get("spin") === "1", scale: address.get("scale") === "1" };

for (const cls of LUMINOSITY_CLASSES) inputs.class.append(new Option(cls, cls));
for (const preset of PRESETS) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset["preset"] = preset.id;
  button.addEventListener("click", () => {
    state.preset = preset.id;
    state.numbers = preset.numbers;
    render();
  });
  presetsBox.append(button);
}

const group = (value: number): string => value.toLocaleString("en-US");
const short = (value: number): string => (value >= 10 ? group(Math.round(value)) : String(Number(value.toPrecision(3))));

function render(): void {
  const lng = lang();
  const numbers = state.numbers;
  // the element draws the star: a registered one by its name, a changed one from its numbers
  if (state.preset !== null) star.setAttribute("star", numbers.name ?? state.preset);
  else star.setAttribute("star", JSON.stringify(numbers));
  star.setAttribute("look", state.look);
  star.setAttribute("lang", lng);
  star.setAttribute("turn", state.spin ? String(Math.round(star.starLook?.turn.degreesPerSecond ?? 12)) : "0");
  if (state.scale) star.setAttribute("scale-to", "sun");
  else star.removeAttribute("scale-to");
  const made = star.starLook;
  errorBox.hidden = made !== undefined;
  errorBox.textContent = star.getAttribute("data-error") ?? "";

  for (const button of $$("#presets [data-preset]")) {
    const preset = PRESETS.find((one) => one.id === button.dataset["preset"])!;
    button.textContent = lng === "ja" ? preset.ja : (preset.numbers.name === "Sun" ? say("st_sun") : preset.id === "white-dwarf" ? say("st_white_dwarf") : preset.numbers.name ?? preset.id);
    pressed(button, button.dataset["preset"] === state.preset);
  }
  for (const b of $$("#looks [data-look]")) pressed(b, b.dataset["look"] === state.look);
  pressed(document.querySelector<HTMLElement>("#spin")!, state.spin);
  pressed(document.querySelector<HTMLElement>("#scale")!, state.scale);

  if (document.activeElement !== inputs.temperature) inputs.temperature.value = String(numbers.temperatureK);
  if (document.activeElement !== inputs.radius) inputs.radius.value = String(numbers.radiusSun);
  inputs.class.value = numbers.luminosityClass ?? "V";
  if (document.activeElement !== inputs.rotation) inputs.rotation.value = numbers.rotationDays === undefined ? "" : String(numbers.rotationDays);
  if (document.activeElement !== inputs.oblateness) inputs.oblateness.value = numbers.oblateness === undefined ? "" : String(numbers.oblateness);
  if (document.activeElement !== inputs.activity) inputs.activity.value = numbers.activity === undefined ? "" : String(numbers.activity);

  if (made !== undefined) {
    const turning = made.rotationDays === undefined ? say("st_turn_unknown") : say("st_turn", { days: short(Math.abs(made.rotationDays)), times: group(Math.round(made.turn.speedUp ?? 1)) });
    caption.textContent = `${made.facts.name[lng]}: ${say("st_caption", { radius: short(made.radiusSun), k: group(Math.round(made.temperatureK)), cls: made.luminosityClass })} ${state.spin ? turning : ""}`.trim();
    honesty.textContent = made.disclaimer[lng];
    partsBox.replaceChildren(
      ...made.parts.map((part) => {
        const item = document.createElement("li");
        item.dataset["part"] = part.part;
        item.dataset["status"] = part.status;
        const badge = document.createElement("span");
        badge.className = "fam-badge";
        badge.dataset["tone"] = part.status === "illustrative" ? "bad" : part.status === "derived" ? "" : "good";
        badge.textContent = say(`st_${part.status}`);
        const text = document.createElement("span");
        text.textContent = part.note[lng];
        item.append(badge, " ", text);
        return item;
      }),
    );
  } else {
    caption.textContent = "";
    honesty.textContent = "";
    partsBox.replaceChildren();
  }
  address.set("star", state.preset ?? "custom");
  address.set("look", state.look === "realistic" ? null : state.look);
  address.set("spin", state.spin ? "1" : null);
  address.set("scale", state.scale ? "1" : null);
  for (const [key, name] of Object.entries(KEYS)) address.set(name, state.preset === null && numbers[key as keyof typeof KEYS] !== undefined ? String(numbers[key as keyof typeof KEYS]) : null);

  const view = document.querySelector<HTMLElement>("#view")!;
  const side = Math.min(view.clientWidth || 560, view.clientHeight || 560);
  const disc = Math.max(24, Math.round(side / 2.2));
  Reflect.set(controls, "objectSize", { width: disc, height: disc });
  controls.setAttribute("grab-radius", String(Math.round(disc / 2)));
  renderEmbed();
}

/** The numbers in the fields, as a star: a blank rotation, flattening or spots is left out. */
function readFields(): StarNumbers {
  const optional = (input: HTMLInputElement): number | undefined => (input.value.trim() === "" ? undefined : Number(input.value));
  const numbers: StarNumbers = { name: "Custom", temperatureK: Number(inputs.temperature.value), radiusSun: Number(inputs.radius.value), luminosityClass: inputs.class.value as LuminosityClass };
  for (const [key, input] of [["rotationDays", inputs.rotation], ["oblateness", inputs.oblateness], ["activity", inputs.activity]] as const) {
    const value = optional(input);
    if (value !== undefined) numbers[key] = value;
  }
  return numbers;
}
for (const input of Object.values(inputs)) {
  input.addEventListener("change", () => {
    const numbers = readFields();
    try {
      starLook(numbers);
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error instanceof Error ? error.message : String(error);
      return;
    }
    state.preset = null;
    state.numbers = numbers;
    render();
  });
}

// --- "Put it in your page" ---------------------------------------------------------------------------------------------------------------------------
const embedOptions = (): EmbedOptions => ({ body: "sun", star: state.numbers, look: state.look, size: panel.size, ...(state.spin ? { turn: Math.round(star.starLook?.turn.degreesPerSecond ?? 12) } : {}) });
panel.kinds = EMBED_KINDS;
const kept = address.get("embed");
if (EMBED_KINDS.includes(kept as EmbedKind)) panel.kind = kept as string;
panel.size = Number(address.get("size")) || 320;
panel.generate = ({ kind, preview }) => embedCode(embedOptions(), kind as EmbedKind, preview ? { site: "" } : {});
panel.preview = ({ kind }) => {
  if (kind === "iframe") return undefined;
  const options = embedOptions();
  const element = document.createElement("wakusei-body") as WakuseiBody;
  element.setAttribute("star", JSON.stringify(options.star));
  for (const [name, value] of Object.entries({ look: options.look ?? "realistic", size: String(panel.size), lang: lang(), live: "off" })) element.setAttribute(name, value);
  return element;
};
panel.credits = () => embedCredit(embedOptions());
panel.addEventListener("kazoku-embedchange", (event) => {
  const { kind, size } = (event as CustomEvent<EmbedChangeDetail>).detail;
  address.set("embed", kind === "html" ? null : kind);
  address.set("size", size === 320 ? null : String(size));
});
function renderEmbed(): void {
  const options = embedOptions();
  const query = new URLSearchParams(embedCode(options, "iframe", { site: "" }).match(/src="([^"]*)"/)?.[1]?.split("?")[1] ?? "");
  panel.setAttribute("lang", lang());
  panel.openHref = `embed.html?${query.toString()}`;
  panel.update();
}

for (const b of $$("#looks [data-look]")) b.addEventListener("click", () => ((state.look = asLook(b.dataset["look"] ?? null)), render()));
document.querySelector("#spin")!.addEventListener("click", () => ((state.spin = !state.spin), render()));
document.querySelector("#scale")!.addEventListener("click", () => ((state.scale = !state.scale), render()));
controls.addEventListener("kazoku-viewchange", (event) => star.setView((event as CustomEvent<ViewChangeDetail>).detail));
controls.addEventListener("pointerdown", () => void star.goLive());
window.addEventListener("wakusei-language", () => render());
new ResizeObserver(() => {
  const radius = Math.round(star.discRadius);
  if (radius > 0) controls.setAttribute("grab-radius", String(radius));
}).observe(star);
render();
