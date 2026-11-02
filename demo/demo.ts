import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import type { ViewChangeDetail } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { apparent, BODIES, MOONS_OF, type BodyId } from "../src/index.ts";
import { lookOf } from "../src/scene/look.ts";
import "../src/element.ts";
import "../src/bodies/all.ts";
import "../src/bodies/earth.ts";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";
import { WORDS } from "./words.js";

type Look = "line" | "realistic" | "painted";
const TILES: readonly BodyId[] = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "moon"];

/** A word of the page in the language it is in now (the family's chooser, set by the page), English if the chooser is not there. */
const chooser = (): { lang: "en" | "ja"; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: "en" | "ja"; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const lang = (): "en" | "ja" => chooser()?.lang ?? "en";

setThreeLoader(() => import("./three-subset.ts"));

const main = document.querySelector<WakuseiBody>("#main");
const controls = document.querySelector("kazoku-view-controls");
const tilesBox = document.querySelector<HTMLElement>("#tiles");

if (main && controls && tilesBox) {
  const address = createAddressState({ defaults: { body: "jupiter", look: "realistic" } });
  const looks = [...document.querySelectorAll<HTMLButtonElement>("#looks [data-look]")];
  const skies = [...document.querySelectorAll<HTMLButtonElement>("#skies [data-sky]")];
  const speeds = [...document.querySelectorAll<HTMLButtonElement>("#speeds [data-speed]")];
  const moonsButton = document.querySelector<HTMLButtonElement>("#moons")!;
  const scaleButton = document.querySelector<HTMLButtonElement>("#scale")!;
  const spinButton = document.querySelector<HTMLButtonElement>("#spin")!;
  const timeRow = document.querySelector<HTMLElement>("#time-row")!;
  const when = document.querySelector<HTMLInputElement>("#when")!;
  const nowButton = document.querySelector<HTMLButtonElement>("#now")!;
  const caption = document.querySelector<HTMLElement>("#caption")!;
  const status = document.querySelector<HTMLElement>("#status")!;

  const asBody = (value: string | null): BodyId => (value !== null && value in BODIES ? (value as BodyId) : "jupiter");
  const state = {
    body: asBody(address.get("body")),
    look: (["line", "realistic", "painted"].includes(address.get("look") ?? "") ? address.get("look") : "realistic") as Look,
    real: address.get("sky") === "real" || address.get("moons") === "1",
    moons: address.get("moons") === "1",
    scale: address.get("scale") === "1",
    spin: address.get("spin") === "1",
    speed: Number(address.get("speed") ?? 1) || 1,
    time: address.get("t") ?? "now",
  };

  const localValue = (ms: number): string => {
    const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  };
  const pressed = (button: HTMLElement, on: boolean): void => {
    button.setAttribute("aria-pressed", String(on));
    button.classList.toggle("on", on);
  };
  const notice = (text: string | null): void => {
    status.hidden = text === null;
    status.textContent = text ?? "";
  };

  const tiles = new Map<BodyId, { button: HTMLButtonElement; body: WakuseiBody; name: HTMLElement }>();
  for (const id of TILES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tile";
    button.dataset["body"] = id;
    const body = document.createElement("wakusei-body") as WakuseiBody;
    body.setAttribute("body", id);
    body.setAttribute("live", "off");
    const name = document.createElement("span");
    button.append(body, name);
    button.addEventListener("click", () => {
      state.body = id;
      if (!hasMoons()) state.moons = false;
      render();
    });
    tilesBox.append(button);
    tiles.set(id, { button, body, name });
  }

  const hasMoons = (): boolean => state.body in MOONS_OF;
  const timeMs = (): number => (state.time === "now" ? Date.now() : Date.parse(state.time));

  function describe(): void {
    const f = BODIES[state.body];
    const name = f.name[lang()];
    if (!state.real) {
      caption.textContent = say("caption", { name, radius: Math.round(f.radiusKm).toLocaleString(lang() === "ja" ? "ja-JP" : "en-US"), tilt: f.tiltDeg });
      return;
    }
    const a = apparent(state.body, timeMs());
    const date = new Date(timeMs()).toISOString().slice(0, 16).replace("T", " ") + " UTC";
    const lit = Math.round(a.illumination * 100);
    caption.textContent = f.rings !== undefined ? say("captionSky", { name, date, lit, open: Math.abs(a.subObserverLat).toFixed(1) }) : say("captionSky2", { name, date, lit });
  }

  function render(): void {
    const looksAvailable = lookOf(state.body)?.painted !== undefined;
    for (const b of looks) {
      if (b.dataset["look"] === "painted") b.hidden = !TILES.some((id) => lookOf(id)?.painted !== undefined);
      pressed(b, b.dataset["look"] === state.look);
    }
    if (state.look === "painted" && !looksAvailable) notice(null);
    for (const b of skies) pressed(b, (b.dataset["sky"] === "real") === state.real);
    moonsButton.hidden = !hasMoons();
    pressed(moonsButton, state.moons && hasMoons());
    pressed(scaleButton, state.scale);
    pressed(spinButton, state.spin);
    timeRow.hidden = !(state.real || state.moons);
    pressed(nowButton, state.time === "now");
    for (const b of speeds) pressed(b, Number(b.dataset["speed"]) === state.speed);
    if (document.activeElement !== when) when.value = localValue(timeMs());

    const setAttr = (el: Element, name: string, value: string | null): void => {
      if (value === null) el.removeAttribute(name);
      else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
    };
    const real = state.real || (state.moons && hasMoons());
    setAttr(main!, "body", state.body);
    setAttr(main!, "look", state.look);
    setAttr(main!, "lang", lang());
    setAttr(main!, "time", real ? state.time : null);
    setAttr(main!, "rate", real ? String(state.speed) : null);
    setAttr(main!, "turn", state.spin && !real ? "14" : null);
    setAttr(main!, "moons", state.moons && hasMoons() ? "" : null);
    setAttr(main!, "pitch", state.moons && hasMoons() ? "26" : null);
    for (const [id, tile] of tiles) {
      setAttr(tile.body, "look", state.look === "line" ? "line" : "realistic");
      setAttr(tile.body, "lang", lang());
      setAttr(tile.body, "scale-to", state.scale ? "jupiter" : null);
      tile.name.textContent = BODIES[id].name[lang()];
      pressed(tile.button, id === state.body);
    }
    describe();
    address.set("body", state.body);
    address.set("look", state.look);
    address.set("sky", state.real ? "real" : null);
    address.set("moons", state.moons ? "1" : null);
    address.set("scale", state.scale ? "1" : null);
    address.set("spin", state.spin ? "1" : null);
    address.set("speed", state.speed !== 1 ? String(state.speed) : null);
    address.set("t", state.time !== "now" ? state.time : null);
  }

  for (const b of looks) b.addEventListener("click", () => ((state.look = (b.dataset["look"] ?? "realistic") as Look), render()));
  for (const b of skies) b.addEventListener("click", () => ((state.real = b.dataset["sky"] === "real"), render()));
  moonsButton.addEventListener("click", () => ((state.moons = !state.moons), (state.real = state.real || state.moons), render()));
  scaleButton.addEventListener("click", () => ((state.scale = !state.scale), render()));
  spinButton.addEventListener("click", () => ((state.spin = !state.spin), render()));
  nowButton.addEventListener("click", () => ((state.time = "now"), render()));
  when.addEventListener("change", () => {
    const ms = Date.parse(when.value);
    if (Number.isFinite(ms)) {
      state.time = new Date(ms).toISOString();
      render();
    }
  });
  for (const b of speeds) b.addEventListener("click", () => ((state.speed = Number(b.dataset["speed"])), render()));
  window.addEventListener("wakusei-language", () => render());
  main.addEventListener("wakusei-state", (event) => {
    const { state: s } = (event as CustomEvent<{ state: string }>).detail;
    if (s === "unavailable") notice(say("noWebgl"));
  });

  controls.addEventListener("kazoku-viewchange", (event) => {
    const detail = (event as CustomEvent<ViewChangeDetail>).detail;
    main.setView(detail);
  });
  // a tap or a hover on the big view makes it live; the controls make it live too
  controls.addEventListener("pointerdown", () => void main.goLive());
  render();
}
