// The plan page: two <wakusei-plan> insets side by side, the solar system from above and one planet's moons from above its pole, with the date, the body marked on each, the spacing and the names in rows of clicks kept in the address.
// A press on a dot marks it. Nothing here runs on a timer: a plan draws when a choice changes.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { MOONS_OF, PLANET_IDS } from "../src/facts.ts";
import { PLAN_SYSTEMS, planAt, planName, planText, type PlanLang, type PlanSpacing, type PlanSystem } from "../src/plan/index.ts";
import "../src/plan/element.ts";
import type { PlanPick, WakuseiPlan } from "../src/plan/element.ts";
import { WORDS } from "./words.js";

const chooser = (): { lang: PlanLang; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: PlanLang; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const lang = (): PlanLang => chooser()?.lang ?? "en";
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const $$ = (selector: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(selector)];
const pressed = (button: Element, on: boolean): void => {
  button.setAttribute("aria-pressed", String(on));
  button.classList.toggle("on", on);
};

/** The bodies a reader can mark in the solar system beyond the Sun and the nine planets, and a craft. */
const BEYOND = ["ceres", "eris", "sedna", "halley", "chiron", "voyager1"] as const;
const SUN_MARKS: readonly string[] = ["sun", ...PLANET_IDS, ...BEYOND];
type Host = Exclude<PlanSystem, "sun">;
const HOSTS = PLAN_SYSTEMS.filter((system): system is Host => system !== "sun");

const sunPlan = $<WakuseiPlan>("#plan-sun");
const moonPlan = $<WakuseiPlan>("#plan-moons");
const address = createAddressState({ defaults: {} });
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const DAY = 86_400_000;

/** Noon of a local calendar day, in milliseconds: a day is chosen in the reader's own time zone. */
const noon = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12).getTime();
};
const dayOf = (ms: number): string => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const asked = address.get("date");
const state = {
  time: asked !== null && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? noon(asked) : Date.now(),
  sun: pick(address.get("mark"), SUN_MARKS, "mars"),
  host: pick<Host>(address.get("moons"), HOSTS, "jupiter"),
  moon: address.get("moon") ?? "io",
  spacing: pick<PlanSpacing>(address.get("spacing"), ["squeezed", "true"], "squeezed"),
  names: address.get("names") !== "off",
};
const moonsOf = (host: Host): readonly string[] => [host, ...MOONS_OF[host]];
if (!moonsOf(state.host).includes(state.moon)) state.moon = MOONS_OF[state.host][0];

/** A row of buttons, rebuilt only when its list changes. */
function fill(box: HTMLElement, ids: readonly string[], on: (id: string) => void, current: string): void {
  if ([...box.children].map((child) => (child as HTMLElement).dataset["id"]).join() !== ids.join()) {
    box.replaceChildren(
      ...ids.map((id) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset["id"] = id;
        button.addEventListener("click", () => on(id));
        return button;
      }),
    );
  }
  for (const button of box.querySelectorAll<HTMLButtonElement>("button")) {
    button.textContent = planName(button.dataset["id"]!, lang());
    pressed(button, button.dataset["id"] === current);
  }
}

/** The code for what is on the screen: the script tag, then each plan with only the attributes that are not the default. */
const code = (): string => {
  const extra = `${state.spacing === "squeezed" ? "" : ' spacing="true"'}${state.names ? "" : ' names="off"'}`;
  const time = `${new Date(state.time).toISOString().slice(0, 10)}T12:00Z`;
  return [
    '<script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/plan/element/+esm"></script>',
    `<wakusei-plan mark="${state.sun}" time="${time}"${extra}></wakusei-plan>`,
    `<wakusei-plan system="${state.host}" mark="${state.moon}" time="${time}"${extra}></wakusei-plan>`,
  ].join("\n");
};

function render(): void {
  const lng = lang();
  for (const plan of [sunPlan, moonPlan]) {
    plan.setAttribute("lang", lng);
    plan.setAttribute("time", String(state.time));
    plan.setAttribute("spacing", state.spacing);
    plan.setAttribute("names", state.names ? "on" : "off");
  }
  sunPlan.setAttribute("mark", state.sun);
  moonPlan.setAttribute("system", state.host);
  moonPlan.setAttribute("mark", state.moon);
  $<HTMLInputElement>("#date").value = dayOf(state.time);
  fill($("#sun-marks"), SUN_MARKS, (id) => ((state.sun = id), render()), state.sun);
  fill($("#moon-hosts"), HOSTS, (id) => ((state.host = id as Host), (state.moon = id), render()), state.host);
  fill($("#moon-marks"), moonsOf(state.host), (id) => ((state.moon = id), render()), state.moon);
  for (const b of $$("#spacings [data-spacing]")) pressed(b, b.dataset["spacing"] === state.spacing);
  for (const b of $$("#names [data-names]")) pressed(b, (b.dataset["names"] === "on") === state.names);
  $("#cap-sun").textContent = planText(planAt(state.time, { mark: state.sun, spacing: state.spacing }), lng).label;
  $("#cap-moons").textContent = planText(planAt(state.time, { system: state.host, mark: state.moon, spacing: state.spacing }), lng).label;
  $("#caption").textContent = say("pl_caption", { date: new Date(state.time).toLocaleDateString(lng === "ja" ? "ja-JP" : "en-CA", { dateStyle: "long" }) });
  address.set("date", dayOf(state.time));
  address.set("mark", state.sun === "mars" ? null : state.sun);
  address.set("moons", state.host === "jupiter" ? null : state.host);
  address.set("moon", state.moon === "io" ? null : state.moon);
  address.set("spacing", state.spacing === "squeezed" ? null : state.spacing);
  address.set("names", state.names ? null : "off");
  $("#code-text").textContent = code();
}

// --- choices -----------------------------------------------------------------------------------------------------------------------------------------
$("#date").addEventListener("change", (event) => {
  const value = (event.target as HTMLInputElement).value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  state.time = noon(value);
  render();
});
for (const b of $$("#steps [data-step]")) b.addEventListener("click", () => ((state.time += Number(b.dataset["step"]) * DAY), render()));
$("#today").addEventListener("click", () => ((state.time = Date.now()), render()));
for (const b of $$("#spacings [data-spacing]")) b.addEventListener("click", () => ((state.spacing = pick<PlanSpacing>(b.dataset["spacing"] ?? null, ["squeezed", "true"], "squeezed")), render()));
for (const b of $$("#names [data-names]")) b.addEventListener("click", () => ((state.names = b.dataset["names"] === "on"), render()));
sunPlan.addEventListener("wakusei-plan-pick", (event) => {
  const { id } = (event as CustomEvent<PlanPick>).detail;
  state.sun = id;
  // a planet that has moons also shows them in the plan beside it
  if ((HOSTS as readonly string[]).includes(id)) {
    state.host = id as Host;
    state.moon = id;
  }
  render();
});
moonPlan.addEventListener("wakusei-plan-pick", (event) => {
  state.moon = (event as CustomEvent<PlanPick>).detail.id;
  render();
});
window.addEventListener("wakusei-language", () => render());
render();
