import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import "@johnmorrisdotca/kazoku-ui/speed-buttons/define";
import "@johnmorrisdotca/kazoku-ui/replay-bar/define";
import type { ReplayBarElement, ReplayDetail } from "@johnmorrisdotca/kazoku-ui/replay-bar/element";
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import type { EmbedChangeDetail, EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import type { SpeedButtonsElement } from "@johnmorrisdotca/kazoku-ui/speed-buttons/element";
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import type { ViewChangeDetail } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { apparent, BODIES, DWARF_IDS, MOONS_OF, type BodyId } from "../src/index.ts";
import { embedCode, embedCredit, EMBED_KINDS, type EmbedKind, type EmbedOptions } from "../src/embed.ts";
import { lookOf } from "../src/scene/look.ts";
import "../src/element.ts";
import "../src/bodies/all.ts";
import "@johnmorrisdotca/chikyu-earth/element";
import "../src/bodies/earth.ts";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";
import { turnRate } from "../src/live.ts";
import { WORDS } from "./words.js";

type Look = "line" | "realistic" | "painted" | "illustrated";
const TILES: readonly BodyId[] = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const DWARF_TILES: readonly BodyId[] = DWARF_IDS;
/** The well-known moons, in a row of their own: the rest are under their planet. */
const MOON_TILES: readonly BodyId[] = ["moon", "phobos", "deimos", "io", "europa", "ganymede", "callisto", "enceladus", "titan", "triton", "charon"];
type Group = "planets" | "dwarfs" | "moons";
/** Which row of bodies a body is in: the planets (with the Sun), or the dwarf planets, each with their moons below. */
const groupOfBody = (id: BodyId): Group => ((DWARF_TILES as readonly string[]).includes(id) || (DWARF_TILES as readonly string[]).includes(BODIES[id].parent ?? "") ? "dwarfs" : "planets");
const TILES_OF: Record<Group, readonly BodyId[]> = { planets: TILES, dwarfs: DWARF_TILES, moons: MOON_TILES };
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
const pickerBox = document.querySelector<HTMLElement>("#picker");

if (main && controls && pickerBox) {
  const address = createAddressState({ defaults: { body: "jupiter", look: "realistic" } });
  const looks = [...document.querySelectorAll<HTMLButtonElement>("#looks [data-look]")];
  const skies = [...document.querySelectorAll<HTMLButtonElement>("#skies [data-sky]")];
  const replay = document.querySelector<ReplayBarElement>("#replay")!;
  const spinSpeed = document.querySelector<SpeedButtonsElement>("#spin-speed")!;
  const moonsButton = document.querySelector<HTMLButtonElement>("#moons")!;
  const scaleButton = document.querySelector<HTMLButtonElement>("#scale")!;
  const scaleRefs = document.querySelector<HTMLElement>("#scale-refs")!;
  const scaleInset = document.querySelector<HTMLElement>("#scale-inset")!;
  const scaleLeader = document.querySelector<SVGElement>("#scale-leader")!;
  const insetBody = document.querySelector<WakuseiBody>("#inset")!;
  const spinButton = document.querySelector<HTMLButtonElement>("#spin")!;
  const timeRow = document.querySelector<HTMLElement>("#time-row")!;
  const when = document.querySelector<HTMLInputElement>("#when")!;
  const nowButton = document.querySelector<HTMLButtonElement>("#now")!;
  const caption = document.querySelector<HTMLElement>("#caption")!;
  const status = document.querySelector<HTMLElement>("#status")!;

  const asAlso = (value: string | null): BodyId[] => (value ?? "").split(",").filter((id): id is BodyId => id in BODIES);
  const asBody = (value: string | null): BodyId => (value !== null && value in BODIES ? (value as BodyId) : "jupiter");
  const DEFAULT_SPEED = 3600;
  const state = {
    body: asBody(address.get("body")),
    look: (["line", "realistic", "painted", "illustrated"].includes(address.get("look") ?? "") ? address.get("look") : "realistic") as Look,
    real: address.get("sky") === "real" || address.get("moons") === "1",
    moons: address.get("moons") === "1",
    scale: address.get("scale") === "1",
    also: asAlso(address.get("with")),
    relative: address.get("rel") === "1",
    ref: (["planet", "earth", "sun"].includes(address.get("ref") ?? "") ? address.get("ref") : "earth") as "planet" | "earth" | "sun",
    spin: address.get("spin") === "1",
    /** Playing: the clock runs from the date shown at `speed` times real time (the replay bar; reduced motion leaves it off). */
    play: address.get("play") === "on",
    /** Times real time while playing. */
    speed: Number(address.get("speed") ?? 0) || DEFAULT_SPEED,
    spinSpeed: Number(address.get("spinspeed") ?? 1) || 1,
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

  // --- a line under every choice that says what it does, always there, and tied to its button for a screen reader ---------------------------------------------------------------------
  const NOTES: readonly (readonly [string, string])[] = [
    ['#looks [data-look="line"]', "note_line"],
    ['#looks [data-look="realistic"]', "note_realistic"],
    ['#looks [data-look="painted"]', "note_painted"],
    ["#spin", "note_spin"],
    ["#spin-speed", "note_spin_speed"],
    ['#skies [data-sky="portrait"]', "note_portrait"],
    ['#skies [data-sky="real"]', "note_sky"],
    ["#moons", "note_moons"],
    ["#scale", "note_scale"],
    ["#now", "note_now"],
    ["#replay", "note_speeds"],
  ];
  const noteLines: { button: HTMLElement; line: HTMLElement; key: string }[] = [];
  for (const [selector, key] of NOTES) {
    const button = document.querySelector<HTMLElement>(selector);
    const row = button?.closest<HTMLElement>(".fam-row");
    if (!button || !row) continue;
    let box = row.nextElementSibling as HTMLElement | null;
    if (!box || !box.classList.contains("choice-notes")) {
      box = document.createElement("div");
      box.className = "choice-notes";
      row.after(box);
    }
    const line = document.createElement("p");
    line.className = "fam-fine note";
    line.id = `note-${key}`;
    box.append(line);
    button.setAttribute("aria-describedby", line.id);
    noteLines.push({ button, line, key });
  }
  const renderNotes = (): void => {
    for (const { button, line, key } of noteLines) {
      line.textContent = say(key);
      line.hidden = button.hidden;
    }
  };

  // --- the picker: the bodies in a row and, under it, the moons of the planet chosen (or the planet of the moon chosen). The same picker is in "Put it in your page". -----------------------------
  interface Tile {
    button: HTMLButtonElement;
    body: WakuseiBody;
    name: HTMLElement;
  }
  interface Picker {
    sync(): void;
  }
  const pickers: Picker[] = [];
  /** The planet whose moons the picker shows now: the body itself, or the planet of a moon; none for the Sun, Mercury and Venus. */
  const planetOfChoice = (): BodyId | null => {
    const planet = (BODIES[state.body].parent ?? state.body) as BodyId;
    return planet in MOONS_OF ? planet : null;
  };
  const setAttrOn = (el: Element, name: string, value: string | null): void => {
    if (value === null) el.removeAttribute(name);
    else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  };
  function mountPicker(host: HTMLElement, tileClass: string, ids: { bodies?: string; moons?: string }): void {
    host.innerHTML = `<div class="group fam-seg groups" role="group" data-row="groups"><button type="button" data-group="planets" data-testid="group-planets"></button><button type="button" data-group="dwarfs" data-testid="group-dwarfs"></button><button type="button" data-group="moons" data-testid="group-moons"></button></div><div class="tiles"${ids.bodies ? ` id="${ids.bodies}"` : ""} role="group" data-row="bodies"></div><div class="moon-row"${ids.moons ? ` id="${ids.moons}"` : ""} hidden><h3></h3><div class="tiles" role="group" data-row="moons"></div></div>`;
    const bodiesRow = host.querySelector<HTMLElement>('[data-row="bodies"]')!;
    const moonRow = host.querySelector<HTMLElement>(".moon-row")!;
    const moonTiles = host.querySelector<HTMLElement>('[data-row="moons"]')!;
    const heading = moonRow.querySelector("h3")!;
    const cache = new Map<BodyId, Tile>();
    const tileOf = (id: BodyId): Tile => {
      let held = cache.get(id);
      if (held !== undefined) return held;
      const button = document.createElement("button");
      button.type = "button";
      button.className = tileClass;
      button.dataset["body"] = id;
      const body = document.createElement("wakusei-body") as WakuseiBody;
      body.setAttribute("body", id);
      body.setAttribute("live", "off");
      body.setAttribute("fit", "tight");
      const name = document.createElement("span");
      button.append(body, name);
      button.addEventListener("click", () => {
        state.body = id;
        if (!hasMoons()) state.moons = false;
        render();
      });
      held = { button, body, name };
      cache.set(id, held);
      return held;
    };
    const groupButtons = [...host.querySelectorAll<HTMLButtonElement>("[data-group]")];
    let group: Group = groupOfBody(state.body);
    let lastBody = state.body;
    let rowOf = "";
    for (const button of groupButtons) {
      button.addEventListener("click", () => {
        group = button.dataset["group"] as Group;
        render();
      });
    }
    let shown = "";
    pickers.push({
      sync() {
        if (state.body !== lastBody) {
          lastBody = state.body;
          if (!(group === "moons" && MOON_TILES.includes(state.body))) group = groupOfBody(state.body);
        }
        if (rowOf !== group) {
          rowOf = group;
          bodiesRow.replaceChildren(...TILES_OF[group].map((id) => tileOf(id).button));
        }
        for (const button of groupButtons) {
          button.textContent = say(`grp_${button.dataset["group"]}`);
          pressed(button, button.dataset["group"] === group);
        }
        const planet = planetOfChoice();
        const moons = planet === null ? [] : ([...MOONS_OF[planet as keyof typeof MOONS_OF]] as BodyId[]);
        const key = `${planet}|${lang()}`;
        if (key !== shown) {
          shown = key;
          moonTiles.replaceChildren(...moons.map((id) => tileOf(id).button));
          heading.textContent = planet === null ? "" : say("moonsOf", { planet: BODIES[planet].name[lang()] });
        }
        moonRow.hidden = moons.length === 0;
        for (const [id, tile] of cache) {
          setAttrOn(tile.body, "look", state.look);
          setAttrOn(tile.body, "texture-base", "textures/");
          setAttrOn(tile.body, "lang", lang());
          tile.name.textContent = BODIES[id].name[lang()];
          pressed(tile.button, id === state.body);
        }
      },
    });
  }
  mountPicker(pickerBox, "tile", { bodies: "tiles", moons: "moon-row" });
  const embedPicker = document.querySelector<HTMLElement>("#embed-picker");
  if (embedPicker) mountPicker(embedPicker, "pick", {});

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
  const isoSecond = (ms: number): string => new Date(ms).toISOString().slice(0, 19) + "Z";
  /** The date the reader chose (the address, the box or Now): Back returns to it. */
  let origin = timeMs();
  /** Where the clock is while it runs: the picture's own moment, the date shown in the box. */
  const shown = (): number => (state.play ? (main.time ?? timeMs()) : timeMs());
  /** Fold the moment reached into the chosen start before the clock's rate changes, so a new speed or a pause goes on from the date shown, not from where Play began. */
  const rebase = (): void => {
    if (state.play) state.time = isoSecond(shown());
  };

  function describe(): void {
    if (state.scale) return;
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
  const together = document.querySelector<HTMLElement>("#together")!;
  const togetherRow = document.querySelector<HTMLElement>("#together-row")!;
  const relativeButton = document.querySelector<HTMLButtonElement>("#relative")!;
  const orbitLink = document.querySelector<HTMLAnchorElement>("#orbit-link")!;
  /** The bodies of the system the big view is in: the planet and its moons, in a fixed order, for the push buttons under the view. */
  const systemOf = (): BodyId[] => {
    const planet = (BODIES[state.body].parent ?? state.body) as BodyId;
    return planet in MOONS_OF ? [planet, ...(MOONS_OF[planet as keyof typeof MOONS_OF] as readonly BodyId[])] : [state.body];
  };
  /** Push buttons under the big view, one for each body of its system, that stay where they are: the chosen one is pressed, and any others can be pressed with it to see them side by side. */
  function renderChips(): void {
    const system = systemOf();
    state.also = state.also.filter((id) => system.includes(id) && id !== state.body);
    const key = system.join(",") + lang();
    if (chips.dataset["key"] !== key) {
      chips.dataset["key"] = key;
      chips.replaceChildren();
      for (const id of system.length > 1 ? system : []) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset["chip"] = id;
        button.textContent = BODIES[id].name[lang()];
        button.addEventListener("click", () => {
          if (id === state.body) return;
          state.also = state.also.includes(id) ? state.also.filter((x) => x !== id) : [...state.also, id];
          render();
        });
        chips.append(button);
      }
    }
    for (const button of chips.querySelectorAll<HTMLButtonElement>("[data-chip]")) {
      const id = button.dataset["chip"] as BodyId;
      pressed(button, id === state.body || state.also.includes(id));
      button.setAttribute("aria-disabled", String(id === state.body));
    }
    // several at once, side by side: at the same size, or at their true sizes against each other
    const shown = system.filter((id) => id === state.body || state.also.includes(id));
    together.hidden = shown.length < 2;
    pressed(relativeButton, state.relative);
    if (shown.length < 2) return;
    // the same bodies in the portrait builder, each system at its true distances with its orbits drawn
    const scene = `arrange:orbit~scale:readable~look:${state.look}~${shown.map((id) => `${id}_0_0_0.3_0`).join("~")}`;
    orbitLink.href = `portrait.html?scene=${encodeURIComponent(scene)}`;
    const span = Math.max(...shown.map((id) => BODIES[id].radiusKm * (BODIES[id].axesKm ? Math.max(...BODIES[id].axesKm) / BODIES[id].radiusKm : 1))) * 1.06;
    const wanted = shown.join(",");
    if (togetherRow.dataset["ids"] !== wanted) {
      togetherRow.dataset["ids"] = wanted;
      togetherRow.replaceChildren(
        ...shown.map((id) => {
          const cell = document.createElement("div");
          cell.className = "together-cell";
          cell.dataset["body"] = id;
          const body = document.createElement("wakusei-body") as WakuseiBody;
          body.setAttribute("body", id);
          body.setAttribute("live", "off");
          body.setAttribute("fit", "tight");
          const name = document.createElement("span");
          cell.append(body, name);
          return cell;
        }),
      );
    }
    for (const cell of togetherRow.querySelectorAll<HTMLElement>(".together-cell")) {
      const id = cell.dataset["body"] as BodyId;
      const body = cell.querySelector<WakuseiBody>("wakusei-body")!;
      setAttrOn(body, "look", state.look);
      setAttrOn(body, "texture-base", "textures/");
      setAttrOn(body, "lang", lang());
      setAttrOn(body, "span-km", state.relative ? String(span) : null);
      cell.querySelector("span")!.textContent = BODIES[id].name[lang()];
    }
  }

  /** The body the big view is measured against: its planet (for a moon), the Earth or the Sun. Measured against itself, a body is the reference: drawn full size like the planets beside it. */
  const refOf = (): BodyId => {
    const parent = BODIES[state.body].parent;
    return state.ref === "sun" ? "sun" : state.ref === "planet" && parent !== undefined ? parent : "earth";
  };
  /** To scale: the big view draws the body at its true size against the one chosen; a body too small to see gets a magnified picture beside it, joined by a line. */
  function renderScale(): void {
    scaleRefs.hidden = !state.scale;
    const hasPlanet = BODIES[state.body].parent !== undefined;
    for (const b of scaleRefs.querySelectorAll<HTMLButtonElement>("[data-ref]")) {
      const planetOnly = b.dataset["ref"] === "planet";
      b.hidden = planetOnly && !hasPlanet;
      pressed(b, (b.dataset["ref"] === state.ref || (planetOnly === false && state.ref === "planet" && !hasPlanet && b.dataset["ref"] === "earth")));
    }
    if (!state.scale) {
      scaleInset.hidden = true;
      scaleLeader.setAttribute("hidden", "");
      main!.removeAttribute("scale-to");
      return;
    }
    const ref = refOf();
    main!.setAttribute("scale-to", ref);
    const own = BODIES[state.body].radiusKm;
    const against = BODIES[ref].radiusKm;
    const side = document.querySelector<HTMLElement>("#view")!.clientWidth || 560;
    const diameterPx = (side * own) / (against * 1.06);
    const small = diameterPx < 40;
    scaleInset.hidden = !small;
    if (small) scaleLeader.removeAttribute("hidden");
    else scaleLeader.setAttribute("hidden", "");
    if (small) {
      insetBody.setAttribute("fit", "tight");
      insetBody.setAttribute("body", state.body);
      insetBody.setAttribute("look", state.look);
      insetBody.setAttribute("texture-base", "textures/");
      insetBody.setAttribute("lang", lang());
    }
    const km = Math.round(own * 10) / 10;
    const ratio = own / against;
    const sizes = say("scaleCaption", { name: BODIES[state.body].name[lang()], km: km.toLocaleString(lang() === "ja" ? "ja-JP" : "en-US"), ratio: ratio >= 10 ? ratio.toFixed(0) : ratio >= 0.1 ? ratio.toFixed(2) : ratio.toPrecision(2), ref: BODIES[ref].name[lang()], refKm: Math.round(against).toLocaleString(lang() === "ja" ? "ja-JP" : "en-US") });
    caption.textContent = ref === state.body ? say("scaleCaptionSelf", { name: BODIES[state.body].name[lang()] }) : small ? `${sizes} ${say("scaleMagnified")}` : sizes;
  }

  /** A drag keeps the touched point under the pointer: the view controls are told the radius of the body's disc on the screen. */
  function syncGrab(): void {
    const radius = Math.round(main!.discRadius);
    if (radius > 0) setAttrOn(controls!, "grab-radius", String(radius));
  }
  new ResizeObserver(syncGrab).observe(main);

  function render(): void {
    const looksAvailable = lookOf(state.body)?.painted !== undefined;
    for (const b of looks) {
      if (b.dataset["look"] === "painted") b.hidden = true;
      pressed(b, b.dataset["look"] === "realistic" ? state.look === "realistic" || state.look === "painted" : b.dataset["look"] === state.look);
    }
    if (state.look === "painted" && !looksAvailable) notice(null);
    for (const b of skies) pressed(b, (b.dataset["sky"] === "real") === state.real);
    moonsButton.hidden = !hasMoons();
    pressed(moonsButton, state.moons && hasMoons());
    pressed(scaleButton, state.scale);
    renderScale();
    pressed(spinButton, state.spin);
    timeRow.hidden = !(state.real || state.moons);
    pressed(nowButton, state.time === "now");
    if (replay.playing !== state.play) replay.playing = state.play;
    state.play = replay.playing;
    if (replay.getAttribute("speed") !== String(state.speed)) replay.setAttribute("speed", String(state.speed));
    replay.setAttribute("lang", lang());
    replay.words = { start: say("back") };
    if (spinSpeed.value !== state.spinSpeed) spinSpeed.value = state.spinSpeed;
    spinSpeed.hidden = !state.spin || state.real || (state.moons && hasMoons());
    spinSpeed.setAttribute("lang", lang());
    spinSpeed.setAttribute("label", say("turnSpeed"));
    if (document.activeElement !== when) when.value = localValue(shown());

    const setAttr = (el: Element, name: string, value: string | null): void => {
      if (value === null) el.removeAttribute(name);
      else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
    };
    const real = state.real || (state.moons && hasMoons());
    setAttr(main!, "body", state.body);
    setAttr(main!, "look", state.look);
    setAttr(main!, "lang", lang());
    setAttr(main!, "texture-base", "textures/");
    setAttr(main!, "tiles", "tiles/");
    setAttr(main!, "time", real ? state.time : null);
    setAttr(main!, "rate", real ? String(state.play ? state.speed : 0) : null);
    // a dated picture turns with its own date's clock, so Play is what moves it; nothing is drawn while it holds
    setAttr(main!, "turn", state.spin && !real ? String((turnRate(state.body) < 0 ? -14 : 14) * state.spinSpeed) : "0");
    setAttr(main!, "moons", state.moons && hasMoons() ? "" : null);
    setAttr(main!, "pitch", state.moons && hasMoons() ? "26" : null);
    for (const picker of pickers) picker.sync();
    syncGrab();
    renderNotes();
    renderChips();
    renderEmbed();
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
    // the view controls hold the body in sight (a quarter of it stays in) and grab it exactly: they are told how big it is at Fit
    const view = document.querySelector<HTMLElement>("#view")!;
    const side = Math.min(view.clientWidth || 560, view.clientHeight || 560);
    const half = state.moons && hasMoons() ? 6 : 2.2;
    const disc = Math.max(24, Math.round(side / half));
    Reflect.set(controls!, "objectSize", { width: disc, height: disc });
    controls!.setAttribute("grab-radius", String(Math.round(disc / 2)));
    describe();
    address.set("body", state.body);
    address.set("look", state.look);
    address.set("sky", state.real ? "real" : null);
    address.set("moons", state.moons ? "1" : null);
    address.set("with", state.also.length > 0 ? state.also.join(",") : null);
    address.set("rel", state.relative ? "1" : null);
    address.set("scale", state.scale ? "1" : null);
    address.set("ref", state.scale && state.ref !== "earth" ? state.ref : null);
    address.set("spin", state.spin ? "1" : null);
    address.set("play", state.play ? "on" : null);
    address.set("speed", state.speed !== DEFAULT_SPEED ? String(state.speed) : null);
    address.set("spinspeed", state.spinSpeed !== 1 ? String(state.spinSpeed) : null);
    address.set("t", state.time !== "now" ? state.time : null);
  }

  // --- "Put it in your page": the family's panel, filled with the code for the body as it is set up above ---------------------------------------------
  const panel = document.querySelector<EmbedPanelElement>("#embed-panel")!;
  const embedOptions = (): EmbedOptions => {
    const real = state.real || (state.moons && hasMoons());
    return { body: state.body, look: state.look, size: panel.size, ...(real ? { time: state.time === "now" ? "now" : new Date(timeMs()).toISOString() } : {}), ...(state.moons && hasMoons() ? { moons: true } : {}), ...(state.spin && !real ? { turn: 14 } : {}) };
  };
  panel.kinds = EMBED_KINDS;
  const kept = address.get("embed");
  if (EMBED_KINDS.includes(kept as EmbedKind)) panel.kind = kept as string;
  panel.size = Number(address.get("size")) || 320;
  panel.generate = ({ kind, preview }) => embedCode(embedOptions(), kind as EmbedKind, preview ? { site: "" } : {});
  panel.preview = ({ kind }) => {
    if (kind === "iframe") return undefined;
    const options = embedOptions();
    const body = document.createElement("wakusei-body") as WakuseiBody;
    for (const [name, value] of Object.entries({ body: options.body, look: options.look ?? "realistic", size: String(panel.size), "texture-base": "textures/", lang: lang() })) body.setAttribute(name, value);
    if (options.time !== undefined) body.setAttribute("time", options.time);
    if (options.moons === true) body.setAttribute("moons", "");
    if (options.turn !== undefined) body.setAttribute("turn", String(options.turn));
    body.setAttribute("live", "off");
    return body;
  };
  panel.credits = () => embedCredit(embedOptions());
  panel.addEventListener("kazoku-embedchange", (event) => {
    const { kind, size } = (event as CustomEvent<EmbedChangeDetail>).detail;
    address.set("embed", kind === "html" ? null : kind);
    address.set("size", size === 320 ? null : String(size));
  });
  function renderEmbed(): void {
    const options = embedOptions();
    panel.setAttribute("lang", lang());
    panel.openHref = `embed.html?${new URLSearchParams({ body: options.body, look: options.look ?? "realistic", ...(options.time !== undefined ? { time: options.time } : {}), ...(options.moons === true ? { moons: "1" } : {}), ...(options.turn !== undefined ? { turn: String(options.turn) } : {}) }).toString()}`;
    panel.update();
  }

  for (const b of looks) b.addEventListener("click", () => ((state.look = (b.dataset["look"] ?? "realistic") as Look), render()));
  for (const b of skies) b.addEventListener("click", () => ((state.real = b.dataset["sky"] === "real"), render()));
  moonsButton.addEventListener("click", () => ((state.moons = !state.moons), (state.real = state.real || state.moons), render()));
  scaleButton.addEventListener("click", () => ((state.scale = !state.scale), render()));
  relativeButton.addEventListener("click", () => ((state.relative = !state.relative), render()));
  for (const b of scaleRefs.querySelectorAll<HTMLButtonElement>("[data-ref]")) b.addEventListener("click", () => ((state.ref = (b.dataset["ref"] ?? "earth") as typeof state.ref), render()));
  spinButton.addEventListener("click", () => ((state.spin = !state.spin), render()));
  nowButton.addEventListener("click", () => {
    state.time = "now";
    origin = Date.now();
    render();
  });
  when.addEventListener("change", () => {
    const ms = Date.parse(when.value);
    if (Number.isFinite(ms)) {
      state.time = new Date(ms).toISOString();
      origin = ms;
      render();
    }
  });
  // the clock: the picture tells the date while time runs (a few times a second) and once when it holds
  main.addEventListener("wakusei-timechange", (event) => {
    const { time, running } = (event as CustomEvent<{ time: number; running: boolean }>).detail;
    if (document.activeElement !== when) when.value = localValue(time);
    if (running) return;
    // the clock holds: the sky text is worked out for the date it stopped on (a Pause has already folded that date into the address)
    describe();
  });
  replay.addEventListener("kazoku-replay", (event) => {
    const { action, playing, reason } = (event as CustomEvent<ReplayDetail>).detail;
    if (reason !== "user") return;
    if (action === "start") {
      // Back: the date the reader chose, held
      state.play = false;
      state.time = isoSecond(origin);
      render();
      return;
    }
    if (action === "repeat") return;
    if (playing) {
      // Play starts from the date shown: "now" becomes that moment, so the clock does not jump to a later now
      if (state.time === "now") state.time = new Date().toISOString();
      state.play = true;
    } else {
      rebase();
      state.play = false;
    }
    render();
  });
  replay.addEventListener("kazoku-speedchange", (event) => {
    const { value, reason } = (event as CustomEvent<{ value: number; reason: string }>).detail;
    if (reason !== "user") return;
    rebase();
    state.speed = value;
    render();
  });
  // leaving while the clock runs: the date it had reached goes into the address, so a returning reader is where they were
  addEventListener("pagehide", () => {
    if (!state.play) return;
    address.set("t", isoSecond(shown()));
    address.flush();
  });
  spinSpeed.addEventListener("kazoku-speedchange", (event) => {
    const { value, reason } = (event as CustomEvent<{ value: number; reason: string }>).detail;
    if (reason !== "user") return;
    state.spinSpeed = value;
    render();
  });
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
