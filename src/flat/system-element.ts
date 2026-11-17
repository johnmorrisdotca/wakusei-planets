// <wakusei-flat-system>: the solar system as a flat, top-down map. A canvas for the disc (the rings, the orbit lines) and a canvas for what moves: the planets, the dwarf planets, the belts as clouds of points, the comets and our spacecraft (the Tesla Roadster among them).
// The same family as <wakusei-flat> (the Moon and Mars): the same time, speed, paused, selected, controls, lang, dot-size and names attributes, the same `wakusei-flat-pick`, `-view`, `-filter` and `wakusei-timechange` events, the same pan, pinch and keyboard.
// Nothing runs on a timer when the clock is held, and nothing is drawn at rest, out of sight or in a hidden tab. This file registers nothing: `@johnmorrisdotca/wakusei-planets/flat/system/define` does.
import { BELT_IDS, BELTS, loadBeltBodies, type BeltBody, type BeltId } from "../belts/index.ts";
import { BELT_SAMPLE } from "../belts/totals.ts";
import { listComets } from "../comets.ts";
import { readSurfaceNames } from "../place-marks.ts";
import { planRadius, type PlanSpacing } from "../plan/layout.ts";
import { createGameClock, type GameClock } from "../space/clock.ts";
import { loadSpacecraft, SPACECRAFT, SPACECRAFT_IDS, type SpacecraftId } from "../spacecraft.ts";
import { MAX_ZOOM } from "./geometry.ts";
import {
  SYSTEM_DWARFS,
  SYSTEM_LAYERS,
  SYSTEM_RINGS,
  clampSystemView,
  craftPath,
  projectSystem,
  radiusAu,
  squeezeAu,
  systemBelts,
  systemColour,
  systemCometOrbit,
  systemMarks,
  systemName,
  systemOrbit,
  systemReach,
  systemScale,
  unprojectSystem,
  zoomSystemAbout,
  type SystemKind,
  type SystemLayer,
  type SystemMark,
  type SystemView,
} from "./system.ts";
import { saySystem } from "./system-words.ts";
import type { FlatLang } from "./words.ts";

const TIME_EVENT_MS = 250;
/** The furthest the pointer may move between going down and coming up and still be a tap, pixels. */
const TAP_SLOP = 5;
/** From this clock speed (ten days a second) a body is drawn with a short streak behind it. */
const STREAK_FROM = 864_000;
const STREAK_SECONDS = 0.25;
const STREAK_PX = 28;
/** Mercury's turn in radians a second of the map's time, which sets how often a running clock must draw. */
const MERCURY_RATE = (2 * Math.PI) / (87.969 * 86_400);

/**
 * What `wakusei-flat-pick` carries from the flat solar system: a body under the pointer, tapped, or reached by the keyboard. A tap on nothing sends `id: null` and clears the choice.
 *
 * @example
 * ```ts
 * import type { SystemPick } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const show = (pick: SystemPick): string => (pick.id === null ? "nothing" : `${pick.name} (${pick.kind}), ${pick.distanceAu?.toFixed(1)} au`);
 * console.log(typeof show);
 * ```
 */
export interface SystemPick {
  /** What was chosen: the Sun, a planet, a dwarf planet, an asteroid, a centaur, a comet, a spacecraft, or a `belt` body (one point of a belt). */
  kind: SystemKind | "belt" | null;
  /** The body's id (`earth`, `halley`, `roadster`), a belt body's name (`4 Vesta`), or null when a tap lands on nothing. */
  id: string | null;
  name: string | null;
  /** The layer it is in. */
  layer: SystemLayer | "sun" | null;
  /** The belt a belt body is in. */
  belt?: BeltId;
  /** Its distance from the Sun in astronomical units, and its place in the ecliptic plane in au (x to the March equinox). */
  distanceAu: number | null;
  x: number | null;
  y: number | null;
  /** True for a craft whose place is a prediction (the Tesla Roadster, a craft whose mission is over). */
  predicted: boolean | null;
  /** What chose it: a pointer going over it (`hover`), a tap or click (`tap`), or the keyboard (`key`). */
  via: "hover" | "tap" | "key";
}

interface Mk {
  mark: SystemMark;
  px: number;
  py: number;
  on: boolean;
  colour: string;
  dim: boolean;
}
type Chosen = { kind: "mark"; id: string } | { kind: "belt"; id: string; index: number };

const escape = (text: string): string => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const flag = (value: string | null): boolean => value !== null && !/^(off|false|no|0)$/i.test(value.trim());
const finite = (value: string | null, fallback: number): number => (value === null || value.trim() === "" || !Number.isFinite(Number(value)) ? fallback : Number(value));
const readTime = (value: string | null): number | "now" => {
  if (value === null || value.trim() === "" || value.trim().toLowerCase() === "now") return "now";
  const text = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(text) || !/T/.test(text) ? text : `${text}Z`);
  return Number.isFinite(ms) ? ms : "now";
};
/** A list attribute: `undefined` for all (left out, empty or `all`), an empty list for `off`, else the words in it. */
const readList = (value: string | null): string[] | undefined => {
  if (value === null || value.trim() === "" || /^(all|on|true|1)$/i.test(value.trim())) return undefined;
  if (/^(off|none|false|0)$/i.test(value.trim())) return [];
  return value.toLowerCase().split(/[\s,]+/).filter((one) => one !== "");
};
const prefersLessMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const hidden = (): boolean => typeof document !== "undefined" && document.visibilityState === "hidden";

const CSS = `
:host{display:flex;flex-direction:column;gap:8px;color:inherit;font:inherit;container-type:inline-size;min-width:0}
:host([hidden]){display:none}
*{box-sizing:border-box}
.bar{display:grid;gap:6px}
.bar:empty{display:none}
.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;padding-bottom:2px}
.chips>*{flex:none}
@container (min-width:600px){.chips{flex-wrap:wrap;overflow:visible}}
.gap{flex:1 1 0}
button{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 35%,transparent);border-radius:999px;padding:3px 12px;min-height:32px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
button[aria-pressed="true"]{background:color-mix(in srgb,currentColor 14%,transparent);border-color:currentColor}
button:disabled{opacity:.45;cursor:default}
button:focus-visible{outline:3px solid #6cd0ff;outline-offset:2px}
@media (pointer:coarse){button{min-height:44px;padding:6px 14px}}
.chip .swatch{width:10px;height:10px;border-radius:50%;background:var(--c,#9aa5b1);flex:none}
.chip .n{opacity:.7;font-variant-numeric:tabular-nums;font-size:.85em}
.stage{position:relative;flex:1 1 auto;min-height:0;aspect-ratio:var(--wakusei-flat-aspect,3/2);overflow:hidden;border-radius:var(--wakusei-flat-radius,10px);background:var(--wakusei-flat-space,#05070f)}
@container (max-width:599px){.stage{aspect-ratio:var(--wakusei-flat-aspect-narrow,1/1)}}
canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.dots{outline:none;cursor:grab;touch-action:pan-y}
.dots[data-zoomed]{touch-action:none}
.dots:focus-visible{outline:3px solid #6cd0ff;outline-offset:-3px}
.ring{position:absolute;left:0;top:0;width:20px;height:20px;margin:-10px 0 0 -10px;border:2px solid #fff;border-radius:50%;pointer-events:none;box-shadow:0 0 0 1px #000,inset 0 0 0 1px #000}
.ring.hov{width:14px;height:14px;margin:-7px 0 0 -7px;border-width:1px}
.ring[hidden],.tip[hidden]{display:none}
.tip{position:absolute;left:0;top:0;pointer-events:none;background:rgba(8,14,28,.94);color:#fff;padding:4px 8px;border-radius:6px;font-size:.85em;line-height:1.3;max-width:calc(100% - 12px);width:max-content;border:1px solid rgba(255,255,255,.3)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;

/** Puts the styles in the shadow root so a strict Content-Security-Policy allows them: a constructable stylesheet is not inline markup. A browser without that gets a <style> carrying the element's `nonce`. */
const sheets = new Map<string, CSSStyleSheet>();
function adoptStyles(root: ShadowRoot, css: string, nonce: string): void {
  if (typeof CSSStyleSheet === "function" && "replaceSync" in CSSStyleSheet.prototype && "adoptedStyleSheets" in root) {
    try {
      let sheet = sheets.get(css);
      if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        sheets.set(css, sheet);
      }
      if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      return;
    } catch {
      // a browser that has the API and refuses it: the <style> below
    }
  }
  const style = root.ownerDocument.createElement("style");
  if (nonce) style.setAttribute("nonce", nonce);
  style.textContent = css;
  root.prepend(style);
}

const BELT_TOTAL_SAMPLE = BELT_IDS.reduce((sum, id) => sum + BELT_SAMPLE[id], 0);
const COMET_COUNT = listComets().length;

/**
 * The `<wakusei-flat-system>` custom element: the solar system as a flat, top-down map in the plane of the ecliptic, the planets at their places for the time shown, with their orbits, the dwarf planets and a few small bodies, the asteroid belts and the Kuiper belt as clouds of points,
 * 34 comets (with a tail turned from the Sun when near it), and our spacecraft, the Tesla Roadster among them, each with its whole path to draw. Import `@johnmorrisdotca/wakusei-planets/flat/system/define` to register the tag. It needs no WebGL and no peer.
 * Distances are squeezed by the plan's logarithm (`ln(1 + d / 0.1 au)`), so Mercury and Neptune both show, with rings at 1, 5, 10, 30 and 100 au, or `spacing="true"` for the real proportion. A body further out than the edge is left off; the edge is the smallest of 50, 100, 200, 500, 1,000 and 2,000 au that holds the planets, dwarf planets and craft shown.
 *
 * Attributes (the ones marked "same" are the names and meanings `<wakusei-flat>` has): `time` (same: `now`, an ISO date or milliseconds since 1970; live when absent), `speed` (same: 1 is real time, 0 holds, 86400 is a day a second, negative runs backwards), `paused` (same: hold the clock and keep the speed),
 * `selected` (same: the chosen body's id such as `earth`, `halley` or `roadster`), `center` (a body to centre the map on and follow: `sun` by default; a drag lets go of it), `dot-size` (same: pixels), `controls` (same: `none`, or any of `centre zoom orbits track scale chips`; all by default), `lang` (same: `en` or `ja`; the page's language by default),
 * `layers` (`planets dwarfs belts comets craft`: what is drawn; all by default, `off` for none), `craft`, `comets` and `belts` (`all`, `off` or ids with commas: which craft, comets or belts), `orbits` (`off` hides the orbit lines of the planets and dwarf planets), `track` (same: the whole path of the chosen craft and the orbit of the chosen comet, or of every one shown when none is chosen),
 * `spacing` (`squeezed`, the default, or `true`), `extent` (the distance at the edge in au; `auto`, the default, is the smallest step that holds what is shown), `names` (same: `off` for no names beside the bodies, or the most names to show). `footprint`, `shade`, `home-lon` and `home-lat` belong to a map of a surface and are not read.
 *
 * Events (the names `<wakusei-flat>` sends): `wakusei-flat-pick` (a body or a belt body under the pointer, tapped, or reached by the keyboard: a `SystemPick`; `detail.id` is null when a tap lands on nothing and clears the choice), `wakusei-flat-filter` (a chip changed what is shown: `{ layers }`),
 * `wakusei-flat-view` (the reader panned or zoomed: `{ center, x, y, zoom }`) and `wakusei-timechange` (`{ time, running, paused }`, at most four a second while time runs).
 * Style it with the custom properties `--wakusei-flat-space`, `--wakusei-flat-aspect`, `--wakusei-flat-aspect-narrow` and `--wakusei-flat-radius`.
 *
 * @example
 * ```ts no-run
 * import "@johnmorrisdotca/wakusei-planets/flat/system/define";
 * import type { WakuseiFlatSystem } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const system = document.createElement("wakusei-flat-system") as WakuseiFlatSystem;
 * system.setAttribute("selected", "roadster");
 * system.setAttribute("track", "");
 * document.body.append(system);
 * system.addEventListener("wakusei-flat-pick", (event) => console.log((event as CustomEvent).detail.name));
 * ```
 */
export class WakuseiFlatSystem extends HTMLElement {
  static observedAttributes = ["time", "speed", "paused", "orbits", "track", "selected", "center", "dot-size", "controls", "lang", "layers", "craft", "comets", "belts", "spacing", "extent", "names"];

  #clock: GameClock = createGameClock("now", 1);
  #speed = 1;
  #paused = false;
  #view: SystemView = { width: 0, height: 0, centerX: 0, centerY: 0, zoom: 1 };
  #follow: string | null = null;
  #dpr = 1;
  #layers = new Set<SystemLayer>(SYSTEM_LAYERS);
  #craftIds: string[] | undefined;
  #cometIds: string[] | undefined;
  #beltIds: BeltId[] = [...BELT_IDS];
  #orbits = true;
  #track = false;
  #spacing: PlanSpacing = "squeezed";
  #fixedExtent: number | undefined;
  #selected: Chosen | null = null;
  #pendingSelected: string | null = null;
  #cursor: Chosen | null = null;
  #hover: Chosen | null = null;
  #mks: Mk[] = [];
  #belts: readonly BeltBody[] = [];
  #beltXY = new Float32Array(0);
  #beltOn = 0;
  #extent = 50;
  #mercuryPx = 40;
  #craftLoaded = new Set<string>();
  #beltsAsked = false;
  #lastDraw = 0;
  #totalMs = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #frame = 0;
  #inView = true;
  #connected = false;
  #viewSent = "";
  #announced = -Infinity;
  #mapKey = "";
  #loads = 0;
  #stage: HTMLElement | undefined;
  #bar: HTMLElement | undefined;
  #mapCanvas: HTMLCanvasElement | undefined;
  #dotCanvas: HTMLCanvasElement | undefined;
  #selRing: HTMLElement | undefined;
  #hovRing: HTMLElement | undefined;
  #tip: HTMLElement | undefined;
  #live: HTMLElement | undefined;
  #sizer: ResizeObserver | undefined;
  #watcher: IntersectionObserver | undefined;
  #langWatch: MutationObserver | undefined;
  #pointers = new Map<number, { x: number; y: number }>();
  #drag: { x: number; y: number; moved: boolean; pinch: number } | null = null;
  #counts = { draws: 0, mapDraws: 0, dots: 0, lastMs: 0, maxMs: 0 };
  #measureCtx: CanvasRenderingContext2D | null | undefined;

  // --- the page's controls ---------------------------------------------------------------------------------------------------------------------

  /** The id of the chosen body (or the name of a chosen belt body), or null. Set it to choose one from code (no `wakusei-flat-pick` is sent), `null` to clear. */
  get selected(): string | null {
    return this.#selected?.id ?? null;
  }
  set selected(id: string | null) {
    this.#selected = this.#find(id);
    this.#sync();
    this.#request();
  }

  /** The id of the body the map is centred on and follows, or null while it is centred on the Sun or the reader has dragged it away. Set it to a body's id to centre there, or to `sun` or null for the Sun. */
  get center(): string | null {
    return this.#follow;
  }
  set center(id: string | null) {
    this.#follow = id === null || id === "" || id === "sun" ? null : id;
    if (this.#follow === null) this.#view = clampSystemView({ ...this.#view, centerX: 0, centerY: 0 });
    this.#mapKey = "";
    this.#sync();
    this.#request();
  }

  /** The zoom: 1 shows the whole disc, up to 8. */
  get zoom(): number {
    return this.#view.zoom;
  }
  set zoom(value: number) {
    this.#setView({ ...this.#view, zoom: value });
  }

  /** The moment shown, in milliseconds since the Unix epoch. Set it to a number (or a `Date`) to move the clock, or "now" to go live. */
  get time(): number {
    return this.#clock.advance(performance.now());
  }
  set time(value: number | Date | "now") {
    this.#clock.set(value === "now" ? "now" : typeof value === "number" ? value : value.getTime());
    this.#request();
    this.#schedule();
  }

  /** How fast the clock runs: 1 is real time, 0 holds, 86400 is a day a second, negative runs backwards. */
  get speed(): number {
    return this.#speed;
  }
  set speed(value: number) {
    this.#speed = Number.isFinite(value) ? value : 1;
    this.#clock.setSpeed(this.#paused ? 0 : this.#speed);
    this.#schedule();
    this.#request();
  }

  /** True while the clock is held with its speed kept: nothing is drawn but what the reader changes. Setting it false carries on from the moment shown at the same speed. */
  get paused(): boolean {
    return this.#paused;
  }
  set paused(value: boolean) {
    if (value === this.#paused) return;
    const now = performance.now();
    const shown = this.#clock.advance(now);
    this.#paused = value;
    this.#clock.set(shown, now);
    this.#clock.setSpeed(value ? 0 : this.#speed, now);
    this.#schedule();
    this.#request();
    this.dispatchEvent(new CustomEvent("wakusei-timechange", { detail: { time: shown, running: this.#running(), paused: value }, bubbles: true, composed: true }));
  }

  /** The language of the words: the `lang` attribute, else the page's. */
  get language(): FlatLang {
    return (this.getAttribute("lang") ?? this.closest("[lang]")?.getAttribute("lang") ?? this.ownerDocument.documentElement.lang ?? "en").toLowerCase().startsWith("ja") ? "ja" : "en";
  }

  /** The layers drawn now: `planets`, `dwarfs`, `belts`, `comets` and `craft`. */
  get layers(): readonly SystemLayer[] {
    return [...this.#layers];
  }

  /** The distance at the edge of the map in au, as of the last draw. */
  get extent(): number {
    return this.#extent;
  }

  /** The bodies drawn at the last draw, with their place on the screen: their ids, names, kinds and layers, whether each is inside the box, and its distance from the Sun in au. */
  get bodies(): readonly { id: string; name: string; kind: SystemKind; layer: SystemLayer | "sun"; shown: boolean; distanceAu: number; predicted: boolean }[] {
    const lang = this.language;
    return this.#mks.map((m) => ({ id: m.mark.id, name: systemName(m.mark.id, lang), kind: m.mark.kind, layer: m.mark.layer, shown: m.on, distanceAu: m.mark.distanceAu, predicted: m.dim }));
  }

  /** Counters for a test or a page: draws of the bodies, draws of the disc, the bodies and belt points drawn at the last draw, the milliseconds the last draw and the slowest took, and the canvases' size in pixels. */
  get stats(): { draws: number; mapDraws: number; dots: number; beltPoints: number; lastDrawMs: number; maxDrawMs: number; averageDrawMs: number; running: boolean; paused: boolean; extent: number; canvases: { width: number; height: number }[] } {
    const canvases = [this.#mapCanvas, this.#dotCanvas].filter((c): c is HTMLCanvasElement => c !== undefined).map((c) => ({ width: c.width, height: c.height }));
    return { draws: this.#counts.draws, mapDraws: this.#counts.mapDraws, dots: this.#counts.dots, beltPoints: this.#beltOn, lastDrawMs: this.#counts.lastMs, maxDrawMs: this.#counts.maxMs, averageDrawMs: this.#counts.draws > 0 ? this.#totalMs / this.#counts.draws : 0, running: this.#running(), paused: this.#paused, extent: this.#extent, canvases };
  }

  /** Where a body is on the screen as of the last draw, in CSS pixels from the map's top left, or null when it is not drawn (a layer off, outside the edge, or a craft with no path at the moment shown). */
  placeOf(id: string): { x: number; y: number; au: readonly [number, number, number]; distanceAu: number } | null {
    const one = this.#mks.find((m) => m.mark.id === id && m.on);
    return one ? { x: one.px, y: one.py, au: one.mark.au, distanceAu: one.mark.distanceAu } : null;
  }

  /** Choose a body from code, as a reader's tap would, without sending `wakusei-flat-pick`. An id the map does not hold, or `null`, clears the choice. */
  pick(id: string | null): void {
    this.selected = id;
  }

  // --- the element's life ----------------------------------------------------------------------------------------------------------------------

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    adoptStyles(root, CSS, this.getAttribute("nonce") ?? "");
    if (!this.#stage) this.#build(root);
    this.#connected = true;
    this.#readAll();
    this.#sizer = new ResizeObserver(() => {
      this.#measure();
      this.#request();
    });
    this.#sizer.observe(this.#stage!);
    if (typeof IntersectionObserver === "function") {
      this.#watcher = new IntersectionObserver((entries) => {
        const was = this.#visibleNow();
        this.#inView = entries[entries.length - 1]?.isIntersecting ?? true;
        if (!was && this.#visibleNow()) this.#wake();
      });
      this.#watcher.observe(this);
    }
    this.#langWatch = new MutationObserver(() => {
      if (!this.hasAttribute("lang")) this.#words();
    });
    this.#langWatch.observe(this.ownerDocument.documentElement, { attributes: true, attributeFilter: ["lang"] });
    document.addEventListener("visibilitychange", this.#onVisibility);
    this.#measure();
    this.#words();
    this.setAttribute("data-state", "loading");
    this.#fetch();
    this.#request();
    this.#schedule();
  }

  disconnectedCallback(): void {
    this.#connected = false;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    if (this.#frame) cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#sizer?.disconnect();
    this.#watcher?.disconnect();
    this.#langWatch?.disconnect();
    this.#sizer = this.#watcher = this.#langWatch = undefined;
    document.removeEventListener("visibilitychange", this.#onVisibility);
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (!this.#connected || old === value) return;
    this.#read(name);
    if (name === "lang" || name === "controls" || name === "layers" || name === "spacing") this.#words();
    if (name === "layers" || name === "craft" || name === "belts") this.#fetch();
    this.#sync();
    this.#request();
    this.#schedule();
  }

  #onVisibility = (): void => {
    if (this.#visibleNow()) this.#wake();
    else {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  };

  #visibleNow(): boolean {
    return this.#connected && this.#inView && !hidden();
  }

  /** Back in sight: bring the clock up to date, draw once, and start the timer again. */
  #wake(): void {
    this.#clock.advance(performance.now());
    this.#request();
    this.#schedule();
  }

  #readAll(): void {
    for (const name of WakuseiFlatSystem.observedAttributes) this.#read(name);
  }

  /** Take in one attribute. A change to one never undoes what the reader did with another (a chosen body, the pan). */
  #read(name: string): void {
    const value = this.getAttribute(name);
    if (name === "layers") {
      const list = readList(value);
      this.#layers = new Set(list === undefined ? SYSTEM_LAYERS : SYSTEM_LAYERS.filter((one) => list.includes(one)));
      this.#mapKey = "";
    } else if (name === "craft") this.#craftIds = readList(value);
    else if (name === "comets") this.#cometIds = readList(value);
    else if (name === "belts") {
      const list = readList(value);
      this.#beltIds = list === undefined ? [...BELT_IDS] : BELT_IDS.filter((one) => list.includes(one));
    } else if (name === "orbits") {
      this.#orbits = value === null ? true : flag(value);
      this.#mapKey = "";
    } else if (name === "track") this.#track = flag(value);
    else if (name === "spacing") {
      this.#spacing = value !== null && value.trim().toLowerCase() === "true" ? "true" : "squeezed";
      this.#mapKey = "";
    } else if (name === "extent") {
      const au = finite(value, Number.NaN);
      this.#fixedExtent = au > 0 ? au : undefined;
      this.#mapKey = "";
    } else if (name === "center") {
      const id = value === null ? "" : value.trim().toLowerCase();
      this.#follow = id === "" || id === "sun" ? null : id;
      if (this.#follow === null) this.#view = clampSystemView({ ...this.#view, centerX: 0, centerY: 0 });
      this.#mapKey = "";
    } else if (name === "selected") {
      this.#pendingSelected = null;
      this.#selected = value === null || value.trim() === "" ? null : this.#find(value.trim());
      if (this.#selected === null && value !== null && value.trim() !== "") this.#pendingSelected = value.trim();
    } else if (name === "paused") {
      if (flag(value) !== this.#paused) this.paused = flag(value);
    } else if (name === "time" || name === "speed") this.#readClock();
    else if (name === "dot-size" || name === "names") this.#mapKey = "";
  }

  #readClock(): void {
    const now = performance.now();
    this.#clock.advance(now);
    const mode = readTime(this.getAttribute("time"));
    const raw = this.getAttribute("speed");
    const speed = raw === null || raw.trim() === "" ? 1 : Number(raw);
    this.#speed = Number.isFinite(speed) ? speed : 1;
    this.#clock.set(mode, now);
    this.#clock.setSpeed(this.#paused ? 0 : this.#speed, now);
  }

  /** The body with this id, or the belt body with this name, from what the map holds. */
  #find(id: string | null): Chosen | null {
    if (id === null) return null;
    const key = id.trim().toLowerCase();
    if (key === "sun" || key === "") return key === "sun" ? { kind: "mark", id: "sun" } : null;
    if (this.#mks.some((m) => m.mark.id === key) || this.#knownId(key)) return { kind: "mark", id: key };
    const index = this.#belts.findIndex((b) => b.name.toLowerCase() === key);
    return index >= 0 ? { kind: "belt", id: this.#belts[index]!.name, index } : null;
  }

  #knownId(id: string): boolean {
    return (["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"].includes(id) || SYSTEM_DWARFS.includes(id) || SPACECRAFT_IDS.includes(id as SpacecraftId) || listComets().some((c) => c.id === id));
  }

  /** The things the map has to wait for: the craft's paths and the belts' elements, each fetched once, when a layer first asks for them. */
  #fetch(): void {
    if (this.#layers.has("craft")) {
      const wanted = (this.#craftIds ?? [...SPACECRAFT_IDS]).filter((id): id is SpacecraftId => SPACECRAFT_IDS.includes(id as SpacecraftId) && !this.#craftLoaded.has(id));
      if (wanted.length > 0) {
        for (const id of wanted) this.#craftLoaded.add(id);
        this.#loads += 1;
        void loadSpacecraft(...wanted).then(
          () => this.#loaded(),
          () => {
            for (const id of wanted) this.#craftLoaded.delete(id);
            this.#loaded();
          },
        );
      }
    }
    if (this.#layers.has("belts") && !this.#beltsAsked) {
      this.#beltsAsked = true;
      this.#loads += 1;
      void loadBeltBodies().then(
        (bodies) => {
          this.#belts = bodies;
          this.#beltXY = new Float32Array(bodies.length * 2);
          if (this.#pendingSelected !== null) {
            this.#selected = this.#find(this.#pendingSelected) ?? this.#selected;
            this.#pendingSelected = null;
          }
          this.#loaded();
        },
        () => {
          this.#beltsAsked = false;
          this.#loaded();
        },
      );
    }
  }

  #loaded(): void {
    this.#loads = Math.max(0, this.#loads - 1);
    if (!this.#connected) return;
    if (this.#pendingSelected !== null) {
      const found = this.#find(this.#pendingSelected);
      if (found) {
        this.#selected = found;
        this.#pendingSelected = null;
      }
    }
    this.#mapKey = "";
    this.#request();
  }

  // --- the clock -------------------------------------------------------------------------------------------------------------------------------

  /** The clock is running and the element is in sight: it asks for frames. A held clock, a hidden tab and a view out of sight ask for none. */
  #running(): boolean {
    return this.#visibleNow() && this.#clock.speed !== 0 && !this.#paused;
  }

  #fast(): boolean {
    return !this.#paused && Math.abs(this.#speed) >= STREAK_FROM;
  }

  /**
   * How often a running clock draws: as often as the innermost planet moves half a pixel, up to every frame, and at least once in 30 seconds (the belts and the craft are slower than Mercury); once a second at most for a reader who asked for reduced motion.
   */
  #rate(): number {
    let perSecond = (MERCURY_RATE * Math.abs(this.#speed) * this.#mercuryPx) / 0.5;
    perSecond = Math.min(60, Math.max(1 / 30, perSecond));
    if (prefersLessMotion()) perSecond = Math.min(perSecond, 1);
    return perSecond;
  }

  /** After a draw, or when something about the clock changed: ask for the next frame in time. Nothing at all when the clock is held or out of sight. */
  #schedule(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    if (!this.#running()) return;
    const wait = 1000 / this.#rate() - (performance.now() - this.#lastDraw);
    if (wait > 14) {
      this.#timer = setTimeout(() => {
        this.#timer = undefined;
        this.#request();
      }, wait);
    } else this.#request();
  }

  /** `wakusei-timechange`: the moment shown, at most four times a second while time runs. */
  #announceTime(ms: number): void {
    const now = performance.now();
    if (!this.#running() || now - this.#announced < TIME_EVENT_MS) return;
    this.#announced = now;
    this.dispatchEvent(new CustomEvent("wakusei-timechange", { detail: { time: ms, running: true, paused: false }, bubbles: true, composed: true }));
  }

  // --- the map ---------------------------------------------------------------------------------------------------------------------------------

  #measure(): void {
    const stage = this.#stage;
    if (!stage) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    // the canvases stay inside 6 million pixels and 4096 a side, whatever the screen
    const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 3, width > 0 && height > 0 ? Math.sqrt(6_000_000 / (width * height)) : 3, width > 0 || height > 0 ? 4096 / Math.max(width, height) : 3));
    if (width === this.#view.width && height === this.#view.height && dpr === this.#dpr) return;
    this.#dpr = dpr;
    this.#view = clampSystemView({ ...this.#view, width, height });
    for (const canvas of [this.#mapCanvas, this.#dotCanvas]) {
      if (!canvas) continue;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    }
    this.#mapKey = "";
  }

  #measureText(text: string): number {
    this.#measureCtx ??= this.ownerDocument.createElement("canvas").getContext("2d");
    const ctx = this.#measureCtx;
    if (ctx === null) return text.length * 6.5;
    ctx.font = "600 11px system-ui, sans-serif";
    return ctx.measureText(text).width;
  }

  /** The disc and what stands still on it: its edge, the rings with their distances, the orbit lines of the planets and dwarf planets (cut once a year of map time). Drawn again only when the view, the reach, the spacing or a layer changed. */
  #drawMap(ms: number): void {
    const canvas = this.#mapCanvas;
    const v = this.#view;
    if (!canvas || v.width === 0) return;
    const lang = this.language;
    const year = Math.floor(ms / (365.25 * 86_400_000));
    const key = [v.width, v.height, this.#dpr, v.centerX.toFixed(4), v.centerY.toFixed(4), v.zoom.toFixed(3), this.#extent, this.#spacing, this.#orbits, this.#layers.has("planets"), this.#layers.has("dwarfs"), year, lang].join("|");
    if (key === this.#mapKey) return;
    this.#mapKey = key;
    this.#counts.mapDraws += 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    ctx.clearRect(0, 0, v.width, v.height);
    const k = systemScale(v);
    const sun = projectSystem(v, 0, 0);
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, k, 0, Math.PI * 2);
    ctx.fillStyle = "#0a1224";
    ctx.fill();
    ctx.save();
    ctx.clip();
    // the rings: the Earth's distance, Jupiter's, Saturn's, Neptune's and the rest, left out where two would crowd
    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    let last = -Infinity;
    const rings: [number, number][] = [];
    for (const au of SYSTEM_RINGS) {
      if (au > this.#extent) continue;
      const r = planRadius(au, this.#extent, this.#spacing, 0.1) * k;
      if (r - last < 14) continue;
      last = r;
      rings.push([au, r]);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(150,175,215,.22)";
    for (const [, r] of rings) {
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (this.#orbits) {
      ctx.lineWidth = 1;
      const ids = [...(this.#layers.has("planets") ? ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] : []), ...(this.#layers.has("dwarfs") ? SYSTEM_DWARFS : [])];
      for (const id of ids) {
        const line = systemOrbit(id, ms);
        ctx.beginPath();
        line.forEach((p, i) => {
          const q = squeezeAu(p[0], p[1], this.#extent, this.#spacing);
          const at = projectSystem(v, q.x, q.y);
          if (i === 0) ctx.moveTo(at.x, at.y);
          else ctx.lineTo(at.x, at.y);
        });
        ctx.strokeStyle = this.#layers.has("planets") && !SYSTEM_DWARFS.includes(id) ? `${systemColour(id, "planets")}77` : "rgba(207,214,224,.32)";
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, k, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(150,175,215,.5)";
    ctx.stroke();
    // the distances, along a line up and to the right
    const angle = (-40 * Math.PI) / 180;
    ctx.fillStyle = "rgba(190,208,235,.85)";
    ctx.textAlign = "left";
    for (const [au, r] of rings) {
      const x = sun.x + Math.cos(angle) * r + 3;
      const y = sun.y + Math.sin(angle) * r;
      if (x < 0 || x > v.width - 30 || y < 8 || y > v.height - 8) continue;
      ctx.fillText(saySystem(lang, "ring", { n: au }), x, y - 7);
    }
    // the scale, said at the foot
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(190,208,235,.9)";
    ctx.fillText(saySystem(lang, this.#spacing === "squeezed" ? "scaleSqueezed" : "scaleTrue"), 8, v.height - 10);
  }

  // --- the bodies ------------------------------------------------------------------------------------------------------------------------------

  /** Whether a craft's place is a prediction: the car's always (its path is Horizons' prediction from 2018), and any craft's after its mission ended. */
  #predicted(id: string, ms: number): boolean {
    if (!SPACECRAFT_IDS.includes(id as SpacecraftId)) return false;
    const end = SPACECRAFT[id as SpacecraftId].end;
    return id === "roadster" || (end !== undefined && ms > end);
  }

  #draw(): void {
    const started = performance.now();
    const canvas = this.#dotCanvas;
    const v0 = this.#view;
    if (!canvas || v0.width === 0 || v0.height === 0) return;
    const ms = this.#clock.advance(started);
    const showLayers = [...this.#layers].filter((one) => one !== "belts");
    const marks = systemMarks(ms, { layers: showLayers, ...(this.#craftIds ? { craft: this.#craftIds } : {}), ...(this.#cometIds ? { comets: this.#cometIds } : {}), ...(this.#fixedExtent ? { extent: this.#fixedExtent } : {}), spacing: this.#spacing });
    this.#extent = systemReach(marks, this.#fixedExtent);
    // the marks are placed again on the reach: `systemMarks` already used it, so `x` and `y` are on this disc
    if (this.#follow !== null) {
      const at = marks.find((m) => m.id === this.#follow && !m.beyond);
      if (at) this.#view = clampSystemView({ ...this.#view, centerX: at.x, centerY: at.y });
    }
    const v = this.#view;
    this.#drawMap(ms);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    ctx.clearRect(0, 0, v.width, v.height);
    const k = systemScale(v);
    const size = finite(this.getAttribute("dot-size"), 0);
    const radius = (size > 0 ? size / 2 : 3.6) * Math.min(1.8, 0.85 + v.zoom * 0.15);
    const pad = radius + 4;
    const lang = this.language;
    const sun = projectSystem(v, 0, 0);
    const mks: Mk[] = marks.map((mark) => {
      const at = projectSystem(v, mark.x, mark.y);
      const on = !mark.beyond && at.x >= -pad && at.x <= v.width + pad && at.y >= -pad && at.y <= v.height + pad;
      return { mark, px: at.x, py: at.y, on, colour: systemColour(mark.id, mark.layer), dim: mark.layer === "craft" && this.#predicted(mark.id, ms) };
    });
    this.#mks = mks;
    const mercury = mks.find((m) => m.mark.id === "mercury");
    this.#mercuryPx = mercury ? Math.max(6, Math.hypot(mercury.px - sun.x, mercury.py - sun.y)) : 40;
    // the belts, as points, clipped to the disc
    this.#beltOn = 0;
    if (this.#layers.has("belts") && this.#belts.length > 0) {
      systemBelts(this.#belts, ms, this.#beltXY);
      const wanted = new Set(this.#beltIds);
      ctx.save();
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, k, 0, Math.PI * 2);
      ctx.clip();
      const side = Math.max(1.3, Math.min(2.6, 1.1 + v.zoom * 0.2));
      for (const belt of BELT_IDS) {
        if (!wanted.has(belt)) continue;
        ctx.fillStyle = BELTS[belt].colour;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        for (let i = 0; i < this.#belts.length; i += 1) {
          if (this.#belts[i]!.belt !== belt) continue;
          const q = squeezeAu(this.#beltXY[i * 2]!, this.#beltXY[i * 2 + 1]!, this.#extent, this.#spacing);
          if (q.r > 1) continue;
          const px = v.width / 2 + (q.x - v.centerX) * k;
          const py = v.height / 2 - (q.y - v.centerY) * k;
          if (px < -2 || px > v.width + 2 || py < -2 || py > v.height + 2) continue;
          ctx.rect(px - side / 2, py - side / 2, side, side);
          this.#beltOn += 1;
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    const chosenMark = this.#selected?.kind === "mark" ? (this.#selected as { id: string }).id : null;
    this.#drawLines(ctx, mks, chosenMark, ms);
    // a short streak behind each body at a fast clock
    const streak = this.#fast();
    if (streak) {
      const lag = this.#speed * 1000 * STREAK_SECONDS;
      const before = systemMarks(ms - lag, { layers: showLayers.filter((one) => one !== "comets"), ...(this.#craftIds ? { craft: this.#craftIds } : {}), extent: this.#extent, spacing: this.#spacing });
      const was = new Map(before.map((m) => [m.id, m]));
      ctx.lineCap = "butt";
      ctx.lineWidth = Math.max(1.5, radius * 1.1);
      ctx.globalAlpha = 0.7;
      for (const m of mks) {
        const b = was.get(m.mark.id);
        if (!m.on || !b || m.mark.layer === "sun" || b.beyond) continue;
        const at = projectSystem(v, b.x, b.y);
        const d = Math.hypot(at.x - m.px, at.y - m.py);
        if (d < 3) continue;
        const f = d > STREAK_PX ? STREAK_PX / d : 1;
        ctx.strokeStyle = m.colour;
        ctx.beginPath();
        ctx.moveTo(m.px + (at.x - m.px) * f, m.py + (at.y - m.py) * f);
        ctx.lineTo(m.px, m.py);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    let dots = 0;
    for (const m of mks) {
      if (!m.on) continue;
      dots += 1;
      this.#drawMark(ctx, m, radius, sun);
    }
    this.#drawBeltChoice(ctx, radius);
    this.#drawNames(ctx, mks, lang, chosenMark);
    this.#counts.draws += 1;
    this.#counts.dots = dots;
    this.#placeMarks();
    const took = performance.now() - started;
    this.#lastDraw = started;
    this.#totalMs += took;
    this.#counts.lastMs = took;
    if (took > this.#counts.maxMs) this.#counts.maxMs = took;
    if (this.#loads === 0 && this.getAttribute("data-state") !== "ready") this.setAttribute("data-state", "ready");
    this.#announceView();
    this.#announceTime(ms);
    this.#schedule();
  }

  /** One body: a circle for a planet, a smaller one for a dwarf planet or small body, a dot with a tail for a comet near the Sun, a diamond for a craft (a ring where its place is a prediction) and the Sun as a bright disc. */
  #drawMark(ctx: CanvasRenderingContext2D, m: Mk, radius: number, sun: { x: number; y: number }): void {
    const { mark, px, py, colour } = m;
    ctx.save();
    ctx.translate(px, py);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,0,0,.8)";
    if (mark.layer === "sun") {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.stroke();
    } else if (mark.layer === "craft") {
      ctx.rotate(Math.PI / 4);
      const s = mark.id === "roadster" ? radius * 0.95 : radius * 0.75;
      if (m.dim) {
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.fillStyle = `${colour}59`;
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-s, -s, s * 2, s * 2);
      } else {
        ctx.fillStyle = colour;
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.fillRect(-s, -s, s * 2, s * 2);
      }
      if (mark.id === "roadster") {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-s - 1.5, -s - 1.5, s * 2 + 3, s * 2 + 3);
      }
    } else if (mark.layer === "comets") {
      // a tail turned from the Sun, longer the nearer the Sun
      const len = 22 * (1 - Math.min(1, mark.planeAu / 8));
      const away = Math.hypot(px - sun.x, py - sun.y);
      if (len > 4 && away > 0) {
        const grad = ctx.createLinearGradient(0, 0, ((px - sun.x) / away) * len, ((py - sun.y) / away) * len);
        grad.addColorStop(0, "rgba(158,230,255,.9)");
        grad.addColorStop(1, "rgba(158,230,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(2, radius * 0.9);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(((px - sun.x) / away) * len, ((py - sun.y) / away) * len);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(0,0,0,.8)";
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, mark.layer === "dwarfs" ? radius * 0.7 : radius, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The chosen belt body, ringed on the canvas where it is (a belt body is one point of thousands, so it needs more than the choice ring). */
  #drawBeltChoice(ctx: CanvasRenderingContext2D, radius: number): void {
    const item = this.#selected;
    if (item?.kind !== "belt") return;
    const at = this.#at(item);
    if (!at) return;
    ctx.beginPath();
    ctx.arc(at.x, at.y, radius * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = BELTS[this.#belts[item.index]!.belt].colour;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /** The paths: a craft's whole path (the part behind the moment dashed), a comet's orbit, and the orbit of a chosen planet or small body in white; for the chosen one, or for every one shown when the `track` attribute is on and none is chosen. */
  #drawLines(ctx: CanvasRenderingContext2D, mks: readonly Mk[], chosen: string | null, ms: number): void {
    const v = this.#view;
    const k = systemScale(v);
    const sun = projectSystem(v, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, k, 0, Math.PI * 2);
    ctx.clip();
    const at = (x: number, y: number): { x: number; y: number } => {
      const q = squeezeAu(x, y, this.#extent, this.#spacing);
      return projectSystem(v, q.x, q.y);
    };
    const stroke = (points: readonly { x: number; y: number }[], colour: string, strong: boolean, dash: boolean): void => {
      if (points.length < 2) return;
      for (const pass of strong ? [0, 1] : [1]) {
        ctx.beginPath();
        points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.setLineDash(dash ? [4, 4] : []);
        ctx.lineWidth = pass === 0 ? 4 : strong ? 1.8 : 1.2;
        ctx.strokeStyle = pass === 0 ? "rgba(0,0,0,.55)" : strong ? "#ffffff" : colour;
        ctx.globalAlpha = strong || pass === 0 ? 1 : dash ? 0.5 : 0.85;
        ctx.stroke();
      }
    };
    for (const m of mks) {
      const { id, layer } = m.mark;
      const strong = chosen === id;
      if (!strong && !(this.#track && chosen === null)) continue;
      if (layer === "craft") {
        const path = craftPath(id);
        const now = path.filter((p) => p.ms <= ms).map((p) => at(p.x, p.y));
        const next = path.filter((p) => p.ms >= ms).map((p) => at(p.x, p.y));
        const here = { x: m.px, y: m.py };
        stroke([...now, here], m.colour, strong, true);
        stroke([here, ...next], m.colour, strong, false);
      } else if (layer === "comets") stroke(systemCometOrbit(id, this.#extent).map((p) => at(p[0], p[1])), m.colour, strong, false);
      else if ((layer === "planets" || layer === "dwarfs") && strong) stroke(systemOrbit(id, ms).map((p) => at(p[0], p[1])), m.colour, true, false);
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Names beside the bodies, as many as there is room for: the chosen first, then the Sun, planets, craft, dwarfs and comets; a name that would cover a surer one is left out. */
  #drawNames(ctx: CanvasRenderingContext2D, mks: readonly Mk[], lang: FlatLang, chosen: string | null): void {
    const names = readSurfaceNames(this.getAttribute("names"));
    if (!names.on) return;
    const v = this.#view;
    const limit = names.limit ?? Math.round(14 * v.zoom ** 1.4);
    const order: Record<string, number> = { sun: 1, planets: 2, craft: 3, dwarfs: 4, comets: 5 };
    const list = mks.filter((m) => m.on).sort((a, b) => (a.mark.id === chosen ? -1 : b.mark.id === chosen ? 1 : 0) || (order[a.mark.layer] ?? 9) - (order[b.mark.layer] ?? 9) || a.mark.planeAu - b.mark.planeAu);
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = list.map((m) => ({ x0: m.px - 6, y0: m.py - 6, x1: m.px + 6, y1: m.py + 6 }));
    const hit = (a: { x0: number; y0: number; x1: number; y1: number }): boolean => boxes.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0);
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    let named = 0;
    for (const m of list) {
      if (named >= limit && m.mark.id !== chosen) continue;
      const text = systemName(m.mark.id, lang);
      const width = this.#measureText(text);
      const right = { x0: m.px + 8, y0: m.py - 7, x1: m.px + 8 + width, y1: m.py + 7 };
      const left = { x0: m.px - 8 - width, y0: m.py - 7, x1: m.px - 8, y1: m.py + 7 };
      const fits = (b: typeof right): boolean => b.x0 >= 0 && b.x1 <= v.width && !hit(b);
      const side = fits(right) ? right : fits(left) ? left : null;
      if (side === null) continue;
      boxes.push(side);
      named += 1;
      ctx.textAlign = side === right ? "left" : "right";
      const x = side === right ? side.x0 : side.x1;
      ctx.strokeStyle = "rgba(0,0,0,.75)";
      ctx.strokeText(text, x, m.py);
      ctx.fillStyle = "#fff";
      ctx.fillText(text, x, m.py);
    }
  }

  #announceView(): void {
    const v = this.#view;
    const key = `${v.centerX.toFixed(3)},${v.centerY.toFixed(3)},${v.zoom.toFixed(2)},${this.#follow ?? ""}`;
    if (key === this.#viewSent) return;
    const first = this.#viewSent === "";
    this.#viewSent = key;
    if (!first) this.dispatchEvent(new CustomEvent("wakusei-flat-view", { detail: { center: this.#follow, x: v.centerX, y: v.centerY, zoom: v.zoom }, bubbles: true, composed: true }));
  }

  // --- the marks, the words and the controls ---------------------------------------------------------------------------------------------------

  #at(item: Chosen | null): { x: number; y: number } | null {
    if (item === null) return null;
    if (item.kind === "belt") {
      const i = item.index;
      if (i * 2 + 1 >= this.#beltXY.length) return null;
      const q = squeezeAu(this.#beltXY[i * 2]!, this.#beltXY[i * 2 + 1]!, this.#extent, this.#spacing);
      if (q.r > 1) return null;
      return projectSystem(this.#view, q.x, q.y);
    }
    const m = this.#mks.find((one) => one.mark.id === item.id);
    return m?.on ? { x: m.px, y: m.py } : null;
  }

  /** The rings round the chosen and the hovered body, and the name beside the one pointed at: a few DOM nodes moved, so they never ask for a draw. */
  #placeMarks(): void {
    const mark = (ring: HTMLElement | undefined, item: Chosen | null): { x: number; y: number } | null => {
      if (!ring) return null;
      const at = this.#at(item);
      if (!at) {
        ring.hidden = true;
        return null;
      }
      ring.hidden = false;
      ring.style.transform = `translate(${at.x.toFixed(1)}px,${at.y.toFixed(1)}px)`;
      return at;
    };
    const same = (a: Chosen | null, b: Chosen | null): boolean => a === b || (a !== null && b !== null && a.kind === b.kind && a.id === b.id);
    const picked = this.#cursor ?? this.#selected;
    const at = mark(this.#selRing, picked);
    const over = mark(this.#hovRing, this.#hover && !same(this.#hover, picked) ? this.#hover : null);
    const tip = this.#tip;
    if (!tip) return;
    const item = this.#hover ?? picked;
    const where = this.#hover ? (over ?? at) : at;
    if (!item || !where) {
      tip.hidden = true;
      return;
    }
    tip.hidden = false;
    const words = this.#describe(item);
    if (tip.textContent !== words) tip.textContent = words;
    const wide = tip.offsetWidth;
    const left = where.x + 14 + wide > this.#view.width ? Math.max(0, where.x - 14 - wide) : where.x + 14;
    const top = Math.max(0, Math.min(this.#view.height - tip.offsetHeight, where.y - 10));
    tip.style.transform = `translate(${left.toFixed(1)}px,${top.toFixed(1)}px)`;
  }

  #describe(item: Chosen): string {
    const lang = this.language;
    if (item.kind === "belt") {
      const body = this.#belts[item.index];
      if (!body) return item.id;
      const i = item.index;
      const d = Math.hypot(this.#beltXY[i * 2] ?? 0, this.#beltXY[i * 2 + 1] ?? 0);
      return saySystem(lang, "announceBody", { name: body.name, kind: BELTS[body.belt].name[lang], distance: d.toFixed(2), note: "" });
    }
    const m = this.#mks.find((one) => one.mark.id === item.id);
    if (item.id === "sun") return saySystem(lang, "announceSun", { name: systemName("sun", lang) });
    if (!m) return systemName(item.id, lang);
    const d = m.mark.distanceAu;
    return saySystem(lang, "announceBody", { name: systemName(item.id, lang), kind: saySystem(lang, `kind_${m.mark.kind}`), distance: d < 10 ? d.toFixed(2) : d.toFixed(1), note: m.dim ? saySystem(lang, "predicted") : "" });
  }

  #build(root: ShadowRoot): void {
    const d = root.ownerDocument;
    const bar = Object.assign(d.createElement("div"), { className: "bar" });
    bar.addEventListener("click", this.#onBar);
    const stage = Object.assign(d.createElement("div"), { className: "stage" });
    const map = Object.assign(d.createElement("canvas"), { className: "map" });
    map.setAttribute("aria-hidden", "true");
    const dots = Object.assign(d.createElement("canvas"), { className: "dots", tabIndex: 0 });
    dots.setAttribute("role", "application");
    const selRing = Object.assign(d.createElement("div"), { className: "ring sel", hidden: true });
    const hovRing = Object.assign(d.createElement("div"), { className: "ring hov", hidden: true });
    const tip = Object.assign(d.createElement("div"), { className: "tip", hidden: true });
    tip.setAttribute("aria-hidden", "true");
    const live = Object.assign(d.createElement("p"), { className: "sr", id: "live" });
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    const help = Object.assign(d.createElement("p"), { className: "sr", id: "help" });
    dots.setAttribute("aria-describedby", "help live");
    stage.append(map, dots, selRing, hovRing, tip);
    root.append(bar, stage, live, help);
    this.#bar = bar;
    this.#stage = stage;
    this.#mapCanvas = map;
    this.#dotCanvas = dots;
    this.#selRing = selRing;
    this.#hovRing = hovRing;
    this.#tip = tip;
    this.#live = live;
    dots.addEventListener("pointerdown", this.#onDown);
    dots.addEventListener("pointermove", this.#onMove);
    dots.addEventListener("pointerup", this.#onUp);
    dots.addEventListener("pointercancel", this.#onCancel);
    dots.addEventListener("pointerleave", this.#onLeave);
    dots.addEventListener("wheel", this.#onWheel, { passive: false });
    dots.addEventListener("keydown", this.#onKey);
    dots.addEventListener("blur", () => {
      if (this.#cursor) {
        this.#cursor = null;
        this.#placeMarks();
      }
    });
  }

  /** Which controls the `controls` attribute asks for. */
  #wants(): Set<string> {
    const raw = (this.getAttribute("controls") ?? "").trim().toLowerCase();
    if (raw === "none" || raw === "off") return new Set();
    const all = ["centre", "zoom", "orbits", "track", "scale", "chips"];
    if (raw === "" || raw === "all") return new Set(all);
    return new Set(raw.split(/[\s,]+/).map((one) => (one === "center" ? "centre" : one)));
  }

  /** The words the map and the buttons use, made again when the language, the controls or the layers change. */
  #words(): void {
    const bar = this.#bar;
    const dots = this.#dotCanvas;
    if (!bar || !dots) return;
    const lang = this.language;
    const wants = this.#wants();
    dots.setAttribute("aria-label", saySystem(lang, "map"));
    (this.shadowRoot!.querySelector("#help") as HTMLElement).textContent = `${saySystem(lang, "help")} ${saySystem(lang, this.#spacing === "squeezed" ? "scaleNoteSqueezed" : "scaleNoteTrue", { rings: SYSTEM_RINGS.filter((au) => au <= 100).join(", ") })}`;
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", saySystem(lang, "controls"));
    const button = (act: string, label: string, extra = ""): string => `<button type="button" data-act="${act}"${extra}>${escape(label)}</button>`;
    const rows: string[] = [];
    const first: string[] = [];
    if (wants.has("centre"))
      for (const id of ["sun", "earth"]) first.push(button("centre", saySystem(lang, id), ` data-id="${id}" aria-label="${escape(saySystem(lang, "centreOn", { where: saySystem(lang, id) }))}" aria-pressed="false"`));
    first.push(`<span class="gap"></span>`);
    if (wants.has("zoom")) first.push(button("zoomout", "−", ` aria-label="${escape(saySystem(lang, "zoomOut"))}"`), button("zoomin", "+", ` aria-label="${escape(saySystem(lang, "zoomIn"))}"`));
    if (wants.has("orbits")) first.push(button("orbits", saySystem(lang, "orbits"), ` aria-pressed="false"`));
    if (wants.has("track")) first.push(button("track", saySystem(lang, "track"), ` aria-pressed="false"`));
    if (wants.has("scale")) first.push(button("scale", saySystem(lang, "scaleSqueezed"), ` aria-pressed="false"`));
    if (first.length > 1) rows.push(`<div class="row">${first.join("")}</div>`);
    if (wants.has("chips")) {
      const counts: Record<SystemLayer, number> = { planets: 9, dwarfs: SYSTEM_DWARFS.length, belts: BELT_TOTAL_SAMPLE, comets: COMET_COUNT, craft: SPACECRAFT_IDS.length };
      const chip = (layer: SystemLayer): string => `<button type="button" class="chip" data-act="layer" data-layer="${layer}" aria-pressed="false"><span class="swatch" data-layer="${layer}"></span>${escape(saySystem(lang, layer))} <span class="n">${counts[layer].toLocaleString(lang)}</span></button>`;
      rows.push(`<div class="row chips" role="group" aria-label="${escape(saySystem(lang, "layersFilter"))}">${SYSTEM_LAYERS.map(chip).join("")}</div>`);
    }
    bar.innerHTML = rows.join("");
    // colours go on through the CSS object model: an inline style attribute in the markup would be refused by a strict Content-Security-Policy
    bar.querySelectorAll<HTMLElement>(".swatch").forEach((swatch) => swatch.style.setProperty("--c", systemColour("voyager1", swatch.dataset["layer"] as SystemLayer)));
    this.#sync();
  }

  /** Bring the pressed states of the buttons and chips up to date without making them again (a reader may be using one). */
  #sync(): void {
    const bar = this.#bar;
    if (!bar) return;
    bar.querySelectorAll<HTMLElement>('[data-act="centre"]').forEach((b) => b.setAttribute("aria-pressed", String((this.#follow ?? "sun") === b.dataset["id"])));
    bar.querySelectorAll('[data-act="orbits"]').forEach((b) => b.setAttribute("aria-pressed", String(this.#orbits)));
    bar.querySelectorAll('[data-act="track"]').forEach((b) => b.setAttribute("aria-pressed", String(this.#track)));
    bar.querySelectorAll('[data-act="scale"]').forEach((b) => b.setAttribute("aria-pressed", String(this.#spacing === "squeezed")));
    bar.querySelectorAll<HTMLElement>('[data-act="layer"]').forEach((b) => b.setAttribute("aria-pressed", String(this.#layers.has(b.dataset["layer"] as SystemLayer))));
    bar.querySelector<HTMLButtonElement>('[data-act="zoomin"]')?.toggleAttribute("disabled", this.#view.zoom >= MAX_ZOOM);
    bar.querySelector<HTMLButtonElement>('[data-act="zoomout"]')?.toggleAttribute("disabled", this.#view.zoom <= 1);
    if (this.#dotCanvas) this.#dotCanvas.toggleAttribute("data-zoomed", this.#view.zoom > 1);
  }

  #onBar = (event: Event): void => {
    const target = (event.target as Element | null)?.closest<HTMLElement>("button[data-act]");
    if (!target || target.hasAttribute("disabled")) return;
    const act = target.dataset["act"];
    const v = this.#view;
    if (act === "centre") this.center = target.dataset["id"] ?? null;
    else if (act === "zoomin") this.#setView(zoomSystemAbout(v, 1.6));
    else if (act === "zoomout") this.#setView(zoomSystemAbout(v, 1 / 1.6));
    else if (act === "orbits") {
      this.#orbits = !this.#orbits;
      this.#mapKey = "";
      this.#sync();
      this.#request();
    } else if (act === "track") {
      this.#track = !this.#track;
      this.#sync();
      this.#request();
    } else if (act === "scale") {
      this.#spacing = this.#spacing === "squeezed" ? "true" : "squeezed";
      this.#mapKey = "";
      this.#words();
      this.#request();
    } else if (act === "layer") {
      const layer = target.dataset["layer"] as SystemLayer;
      if (this.#layers.has(layer)) this.#layers.delete(layer);
      else this.#layers.add(layer);
      // a choice whose mark has just gone is let go
      if (this.#selected?.kind === "belt" && !this.#layers.has("belts")) this.#selected = null;
      const chosen = this.#selected;
      if (chosen?.kind === "mark" && this.#layerOf(chosen.id) === layer && !this.#layers.has(layer)) this.#selected = null;
      this.#mapKey = "";
      this.#fetch();
      this.#sync();
      this.#request();
      this.#schedule();
      this.dispatchEvent(new CustomEvent("wakusei-flat-filter", { detail: { layers: [...this.#layers] }, bubbles: true, composed: true }));
    }
  };

  /** The layer an id is in, or undefined. */
  #layerOf(id: string): SystemLayer | undefined {
    const layer = this.#mks.find((m) => m.mark.id === id)?.mark.layer;
    return layer === "sun" ? undefined : layer;
  }

  #setView(view: SystemView): void {
    this.#view = clampSystemView(view);
    this.#mapKey = "";
    this.#sync();
    this.#request();
  }

  // --- drawing, asked for ----------------------------------------------------------------------------------------------------------------------

  /** Ask for one draw at the next frame, however many reasons there are. Nothing is asked for out of sight or in a hidden tab: the draw is made when the element comes back. */
  #request(): void {
    if (!this.#connected) return;
    if (!this.#visibleNow()) return;
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#draw();
    });
  }

  // --- the pointer and the keyboard ------------------------------------------------------------------------------------------------------------

  #local(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const box = this.#dotCanvas!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  /** The body drawn nearest to a point, within `reach` pixels; a belt body only where no body is, and within a shorter reach. */
  #hit(x: number, y: number, reach: number): Chosen | null {
    let best: Chosen | null = null;
    let gap = reach * reach;
    for (const m of this.#mks) {
      if (!m.on) continue;
      const d = (m.px - x) ** 2 + (m.py - y) ** 2;
      if (d <= gap) {
        gap = d;
        best = { kind: "mark", id: m.mark.id };
      }
    }
    if (best !== null || !this.#layers.has("belts") || this.#belts.length === 0) return best;
    const v = this.#view;
    const k = systemScale(v);
    const near = (reach * 0.7) ** 2;
    let bestBelt = near;
    let index = -1;
    const wanted = new Set(this.#beltIds);
    for (let i = 0; i < this.#belts.length; i += 1) {
      if (!wanted.has(this.#belts[i]!.belt)) continue;
      const q = squeezeAu(this.#beltXY[i * 2]!, this.#beltXY[i * 2 + 1]!, this.#extent, this.#spacing);
      if (q.r > 1) continue;
      const d = (v.width / 2 + (q.x - v.centerX) * k - x) ** 2 + (v.height / 2 - (q.y - v.centerY) * k - y) ** 2;
      if (d <= bestBelt) {
        bestBelt = d;
        index = i;
      }
    }
    return index >= 0 ? { kind: "belt", id: this.#belts[index]!.name, index } : null;
  }

  #pick(item: Chosen | null, via: SystemPick["via"]): void {
    let detail: SystemPick;
    if (item === null) detail = { kind: null, id: null, name: null, layer: null, distanceAu: null, x: null, y: null, predicted: null, via };
    else if (item.kind === "belt") {
      const body = this.#belts[item.index];
      const x = this.#beltXY[item.index * 2] ?? 0;
      const y = this.#beltXY[item.index * 2 + 1] ?? 0;
      detail = { kind: "belt", id: item.id, name: item.id, layer: "belts", ...(body ? { belt: body.belt } : {}), distanceAu: Math.hypot(x, y), x, y, predicted: false, via };
    } else {
      const m = this.#mks.find((one) => one.mark.id === item.id);
      detail = { kind: m?.mark.kind ?? null, id: item.id, name: systemName(item.id, this.language), layer: m?.mark.layer ?? null, distanceAu: m?.mark.distanceAu ?? null, x: m?.mark.au[0] ?? null, y: m?.mark.au[1] ?? null, predicted: m ? m.dim : null, via };
    }
    this.dispatchEvent(new CustomEvent("wakusei-flat-pick", { detail, bubbles: true, composed: true }));
  }

  #choose(item: Chosen | null, via: SystemPick["via"]): void {
    const same = item !== null && this.#selected !== null && item.kind === this.#selected.kind && item.id === this.#selected.id;
    if (item === null && this.#selected === null) return;
    if (!same) {
      this.#selected = item;
      this.#request();
    }
    this.#sync();
    this.#placeMarks();
    if (item) {
      if (this.#live) this.#live.textContent = this.#describe(item);
      this.#pick(item, via);
    } else if (!same) this.#pick(null, via);
  }

  #onDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const at = this.#local(event);
    this.#pointers.set(event.pointerId, at);
    try {
      this.#dotCanvas!.setPointerCapture(event.pointerId);
    } catch {
      // a pointer that is already gone
    }
    this.#drag = { x: at.x, y: at.y, moved: this.#pointers.size === 2, pinch: this.#pointers.size === 2 ? this.#spread() : 0 };
    this.#dotCanvas!.style.cursor = "grabbing";
  };

  #spread(): number {
    const [a, b] = [...this.#pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  #onMove = (event: PointerEvent): void => {
    const at = this.#local(event);
    if (!this.#pointers.has(event.pointerId)) {
      if (event.pointerType === "mouse") this.#hoverAt(at.x, at.y);
      return;
    }
    const before = this.#pointers.get(event.pointerId)!;
    this.#pointers.set(event.pointerId, at);
    const drag = this.#drag;
    if (!drag) return;
    if (this.#pointers.size >= 2) {
      const spread = this.#spread();
      const [a, b] = [...this.#pointers.values()];
      if (drag.pinch > 0 && spread > 0 && a && b) {
        this.#view = zoomSystemAbout(this.#view, spread / drag.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        drag.pinch = spread;
        drag.moved = true;
        this.#mapKey = "";
        this.#sync();
        this.#request();
      }
      return;
    }
    if (!drag.moved && Math.hypot(at.x - drag.x, at.y - drag.y) < TAP_SLOP) return;
    drag.moved = true;
    const k = systemScale(this.#view);
    // a drag lets go of a followed body
    this.#follow = null;
    this.#view = clampSystemView({ ...this.#view, centerX: this.#view.centerX - (at.x - before.x) / k, centerY: this.#view.centerY + (at.y - before.y) / k });
    this.#mapKey = "";
    this.#hover = null;
    this.#sync();
    this.#request();
  };

  #onUp = (event: PointerEvent): void => {
    const at = this.#local(event);
    const drag = this.#drag;
    this.#pointers.delete(event.pointerId);
    try {
      this.#dotCanvas!.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    if (this.#pointers.size === 0) {
      this.#drag = null;
      this.#dotCanvas!.style.cursor = "";
      if (drag && !drag.moved) {
        // a tap: a finger needs more room than a mouse
        const hit = this.#hit(at.x, at.y, event.pointerType === "touch" ? 22 : 9);
        this.#hover = null;
        this.#choose(hit, "tap");
      }
    } else if (drag) drag.pinch = this.#spread();
  };

  #onCancel = (event: PointerEvent): void => {
    this.#pointers.delete(event.pointerId);
    if (this.#pointers.size === 0) {
      this.#drag = null;
      this.#dotCanvas!.style.cursor = "";
    }
  };

  #onLeave = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || this.#hover === null) return;
    this.#hover = null;
    this.#placeMarks();
  };

  #hoverAt(x: number, y: number): void {
    const hit = this.#hit(x, y, 8);
    if ((hit === null && this.#hover === null) || (hit !== null && this.#hover !== null && hit.kind === this.#hover.kind && hit.id === this.#hover.id)) return;
    this.#hover = hit;
    this.#placeMarks();
    if (hit) this.#pick(hit, "hover");
  }

  #onWheel = (event: WheelEvent): void => {
    // a plain wheel scrolls the page; Control or Command with the wheel (and a trackpad's pinch, which arrives as one) zooms
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const at = this.#local(event);
    this.#setView(zoomSystemAbout(this.#view, Math.exp(-event.deltaY * 0.01), at.x, at.y));
  };

  #onKey = (event: KeyboardEvent): void => {
    const key = event.key;
    if (key === "+" || key === "=") {
      event.preventDefault();
      this.#setView(zoomSystemAbout(this.#view, 1.6));
      return;
    }
    if (key === "-" || key === "_") {
      event.preventDefault();
      this.#setView(zoomSystemAbout(this.#view, 1 / 1.6));
      return;
    }
    if (key === "Escape") {
      if (this.#cursor || this.#selected) {
        this.#cursor = null;
        this.#choose(null, "key");
      }
      return;
    }
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      const item = this.#cursor ?? this.#selected;
      if (item) this.#choose(item, "key");
      return;
    }
    const step = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : key === "PageDown" ? 10 : key === "PageUp" ? -10 : 0;
    if (step === 0 && key !== "Home" && key !== "End") return;
    event.preventDefault();
    // the bodies on show, from the left of the map to the right (a belt body is reached by the pointer: the belts are a cloud, not a list)
    const list: { item: Chosen; x: number; y: number }[] = [];
    for (const m of this.#mks) if (m.on) list.push({ item: { kind: "mark", id: m.mark.id }, x: m.px, y: m.py });
    if (list.length === 0) return;
    list.sort((a, b) => a.x - b.x || a.y - b.y);
    const current = this.#cursor ?? this.#selected;
    const at = current ? list.findIndex((one) => one.item.kind === current.kind && one.item.id === current.id) : -1;
    const next = key === "Home" ? 0 : key === "End" ? list.length - 1 : at < 0 ? (step > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, at + step));
    this.#cursor = list[next]!.item;
    this.#placeMarks();
    if (this.#live) this.#live.textContent = this.#describe(this.#cursor);
    this.#pick(this.#cursor, "key");
  };

  /** The distance in au under a point of the box, in the map's present scale: for a page that reads where a pointer is. */
  auAt(x: number, y: number): number {
    const p = unprojectSystem(this.#view, x, y);
    return radiusAu(Math.hypot(p.x, p.y), this.#extent, this.#spacing);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "wakusei-flat-system": WakuseiFlatSystem;
  }
}
