import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import type { ViewChangeDetail } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { apparent, BODIES, MOONS_OF, PLANET_IDS, type BodyId } from "../src/index.ts";
import { lookOf } from "../src/scene/look.ts";
import "../src/element.ts";
import "../src/bodies/all.ts";
import "../src/bodies/earth.ts";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";
import { WORDS } from "./words.js";

type Look = "line" | "realistic" | "painted";
const TILES: readonly BodyId[] = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "moon"];
/** The moons, under their planets (the Moon is in the row above). */
const MOON_GROUPS = PLANET_IDS.filter((id) => id in MOONS_OF && id !== "earth").map((id) => ({ planet: id, moons: MOONS_OF[id as keyof typeof MOONS_OF] as readonly BodyId[] }));
/** The lineup: the same picture width in kilometres for every body, so the sizes are true to each other. Wide enough for Saturn's rings. */
const SPAN_KM = 150_000;
const FRAME_PX = 180;
const LINEUP: readonly BodyId[] = ["sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const MIN_VISIBLE_PX = 24;

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
  const addTile = (box: HTMLElement, id: BodyId): void => {
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
    box.append(button);
    tiles.set(id, { button, body, name });
  };
  for (const id of TILES) addTile(tilesBox, id);
  const moonGroups = document.querySelector<HTMLElement>("#moon-groups")!;
  for (const group of MOON_GROUPS) {
    const section = document.createElement("div");
    section.className = "moon-group";
    const heading = document.createElement("h3");
    heading.dataset["planet"] = group.planet;
    const box = document.createElement("div");
    box.className = "tiles";
    box.setAttribute("role", "group");
    box.dataset["planet"] = group.planet;
    section.append(heading, box);
    moonGroups.append(section);
    for (const id of group.moons) addTile(box, id);
  }

  // --- the lineup: every body at one scale ---------------------------------------------------------------------------------------------------------
  const lineupSection = document.querySelector<HTMLElement>("#lineup-section")!;
  const lineupBox = document.querySelector<HTMLElement>("#lineup")!;
  const lineup = new Map<BodyId, { cell: HTMLElement; body: WakuseiBody | null; inset: WakuseiBody | null; limb: SVGSVGElement | null; ratio: HTMLElement }>();
  const SVG = "http://www.w3.org/2000/svg";
  const kmPerPx = SPAN_KM / (FRAME_PX / 2);
  const makeBody = (id: BodyId, cls: string): WakuseiBody => {
    const body = document.createElement("wakusei-body") as WakuseiBody;
    body.className = cls;
    body.setAttribute("body", id);
    body.setAttribute("live", "off");
    return body;
  };
  for (const id of LINEUP) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.setAttribute("role", "listitem");
    cell.dataset["body"] = id;
    const diameterPx = (2 * BODIES[id].radiusKm) / kmPerPx;
    cell.dataset["diameterPx"] = diameterPx.toFixed(3);
    const frame = document.createElement("div");
    frame.className = "frame";
    let body: WakuseiBody | null = null;
    let inset: WakuseiBody | null = null;
    let limb: SVGSVGElement | null = null;
    if (id === "sun") {
      // far larger than the page: only its edge fits, a big curved limb
      limb = document.createElementNS(SVG, "svg");
      limb.setAttribute("class", "limb");
      limb.setAttribute("viewBox", `0 0 ${FRAME_PX} ${FRAME_PX}`);
      limb.setAttribute("aria-hidden", "true");
      const radius = BODIES.sun.radiusKm / kmPerPx;
      limb.innerHTML = `<defs><radialGradient id="sun-limb" gradientUnits="userSpaceOnUse" cx="${FRAME_PX * 0.8 - radius}" cy="${FRAME_PX / 2}" r="${radius}"><stop offset="0" stop-color="#fff0b0"/><stop offset="0.8" stop-color="#ffd37a"/><stop offset="0.94" stop-color="#ffb347"/><stop offset="1" stop-color="#c9561a"/></radialGradient></defs><circle class="disc" cx="${FRAME_PX * 0.8 - radius}" cy="${FRAME_PX / 2}" r="${radius}"/>`;
      frame.append(limb);
    } else {
      body = makeBody(id, "true");
      body.setAttribute("span-km", String(SPAN_KM));
      frame.append(body);
      if (diameterPx < MIN_VISIBLE_PX) {
        const leader = document.createElementNS(SVG, "svg");
        leader.setAttribute("class", "leader");
        leader.setAttribute("viewBox", `0 0 ${FRAME_PX} ${FRAME_PX}`);
        leader.setAttribute("aria-hidden", "true");
        leader.innerHTML = `<line x1="${FRAME_PX / 2}" y1="${FRAME_PX / 2}" x2="${FRAME_PX - 36}" y2="${FRAME_PX - 36}" stroke="#8fa1b8" stroke-width="1" stroke-dasharray="3 3"/><circle cx="${FRAME_PX / 2}" cy="${FRAME_PX / 2}" r="${Math.max(6, diameterPx)}" fill="none" stroke="#8fa1b8" stroke-width="1"/>`;
        inset = makeBody(id, "inset");
        frame.append(leader, inset);
      }
    }
    const name = document.createElement("span");
    const ratio = document.createElement("small");
    cell.append(frame, name, ratio);
    lineupBox.append(cell);
    lineup.set(id, { cell, body, inset, limb, ratio });
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

  const chips = document.querySelector<HTMLElement>("#chips")!;
  /** Buttons under the big view for the bodies it is related to: a planet's moons, or a moon's planet and its sister moons. */
  function renderChips(): void {
    const f = BODIES[state.body];
    const planet = (f.parent ?? state.body) as BodyId;
    const related: BodyId[] = planet in MOONS_OF ? [...(f.parent !== undefined ? [planet] : []), ...(MOONS_OF[planet as keyof typeof MOONS_OF] as readonly BodyId[])] : [];
    if (state.body === "moon") related.splice(0, related.length, "earth", "moon");
    if (state.body === "earth") related.splice(0, related.length, "moon");
    const key = related.join(",") + lang() + state.body;
    if (chips.dataset["key"] === key) return;
    chips.dataset["key"] = key;
    chips.replaceChildren();
    for (const id of related) {
      if (id === state.body) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset["chip"] = id;
      button.textContent = BODIES[id].name[lang()];
      button.addEventListener("click", () => {
        state.body = id;
        if (!hasMoons()) state.moons = false;
        render();
      });
      chips.append(button);
    }
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
    setAttr(main!, "texture-base", "textures/");
    setAttr(main!, "time", real ? state.time : null);
    setAttr(main!, "rate", real ? String(state.speed) : null);
    setAttr(main!, "turn", state.spin && !real ? "14" : null);
    setAttr(main!, "moons", state.moons && hasMoons() ? "" : null);
    setAttr(main!, "pitch", state.moons && hasMoons() ? "26" : null);
    for (const [id, tile] of tiles) {
      setAttr(tile.body, "look", state.look);
      setAttr(tile.body, "texture-base", "textures/");
      setAttr(tile.body, "lang", lang());
      tile.name.textContent = BODIES[id].name[lang()];
      pressed(tile.button, id === state.body);
    }
    for (const heading of moonGroups.querySelectorAll<HTMLElement>("h3[data-planet]")) heading.textContent = BODIES[heading.dataset["planet"] as BodyId].name[lang()];
    renderChips();
    lineupSection.hidden = !state.scale;
    if (state.scale) {
      const earthRadius = BODIES.earth.radiusKm;
      for (const [id, part] of lineup) {
        part.cell.setAttribute("aria-current", String(id === state.body));
        const label = part.cell.querySelector("span")!;
        label.textContent = BODIES[id].name[lang()];
        part.ratio.textContent = say("lineupRatio", { ratio: (BODIES[id].radiusKm / earthRadius).toFixed(BODIES[id].radiusKm / earthRadius >= 10 ? 0 : 2) });
        for (const el of [part.body, part.inset]) {
          if (el === null) continue;
          setAttr(el, "look", state.look);
          setAttr(el, "texture-base", "textures/");
          setAttr(el, "lang", lang());
        }
        part.limb?.classList.toggle("line", state.look === "line");
      }
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
    // Fit brings the body back to the middle at its first angle, however far it was moved or turned
    if (detail.reason === "fit" && (detail.panX !== 0 || detail.panY !== 0 || detail.yaw !== 0 || detail.tilt !== 0)) Reflect.get(controls, "controller").set({ yaw: 0, tilt: 0, panX: 0, panY: 0 }, true, "centre");
  });
  // a tap or a hover on the big view makes it live; the controls make it live too
  controls.addEventListener("pointerdown", () => void main.goLive());
  render();
}
