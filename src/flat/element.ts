// <wakusei-flat>: the Moon or Mars on a flat map. A canvas for the map (the body's own picture, day and night, the Sun) with the landing, rover and crash sites on it, and a canvas for the orbiters, which move over it with their coverage circles and ground tracks.
// The same attributes, events and look as chikyu-earth's <chikyu-flat>, so a page can swap one for the other behind one control. Nothing runs on a timer when the clock is held, and nothing is drawn at rest, out of sight or in a hidden tab.
// This file registers nothing: `@johnmorrisdotca/wakusei-planets/flat/define` does.
import { coverageAngleRad } from "../ground-track.ts";
import { orbiterElements, type OrbiterId } from "../orbiters.ts";
import { flagCodeOf, LANDING_SITES, type LandingSite } from "../landing-sites.ts";
import { layerOf, placeRank, readPlaceLayers, readSurfaceNames, type PlaceLayer } from "../place-marks.ts";
import { loadPlaces, type Place, type PlaceKind } from "../places.ts";
import { texturePaths } from "../scene/textures.ts";
import { BODIES } from "../facts.ts";
import { createGameClock, type GameClock } from "../space/clock.ts";
import { flatBody, isFlatBody, orbiterColour, orbiterName, type FlatBodyId, type FlatBodyInfo } from "./bodies.ts";
import { MAX_ZOOM, clampView, pixelsPerDegree, projectFlat, wrapLongitude, zoomAbout, type FlatView } from "./geometry.ts";
import { circleOutline, flatOrbiter, flatSun, flatTrack, shadeNight, trackPieces, type FlatOrbiter } from "./scene.ts";
import { coordinateText, say, type FlatLang } from "./words.ts";
import type { OrbiterStatus } from "../orbiters.ts";
import type { GroundPoint } from "../ground-track.ts";

const RAD = Math.PI / 180;
const TIME_EVENT_MS = 250;
/** How long, in real seconds, a fast clock's streak covers, and the longest it is drawn, in pixels. */
const STREAK_SECONDS = 0.25;
const STREAK_PX = 28;
/** The furthest the pointer may move between going down and coming up and still be a tap, pixels. */
const TAP_SLOP = 5;
/** The clock speed from which the map is shaded in coarser cells and the tracks are worked out less often. */
const FAST_SPEED = 300;
/** The widths of the body's pictures: the package's own two, and the sharpest, which the repository holds. */
const WIDTHS = [1024, 2048] as const;

/**
 * What `wakusei-flat-pick` carries: an orbiter or a place under the pointer, tapped, or reached by the keyboard. A tap on nothing sends `id: null` and clears the choice.
 *
 * @example
 * ```ts
 * import type { FlatPick } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const show = (pick: FlatPick): string => (pick.id === null ? "nothing" : `${pick.name} (${pick.kind})`);
 * console.log(typeof show);
 * ```
 */
export interface FlatPick {
  /** What was chosen: an orbiter or a place on the surface. */
  kind: "orbiter" | "place" | null;
  /** An orbiter's id (`lro`) or a place's (`moon/apollo-11-lunar-module`); null when a tap lands on nothing. */
  id: string | null;
  name: string | null;
  body: FlatBodyId;
  /** Where it is: an orbiter's place on the ground below it at this moment. */
  lat: number | null;
  lon: number | null;
  /** An orbiter's height above the surface in kilometres. */
  altitudeKm: number | null;
  /** Where an orbiter's path comes from at this moment. */
  status: OrbiterStatus | null;
  /** A place's kind (`crewed`, `landing`, `rover`, `crash`, `feature`, ...). */
  placeKind: PlaceKind | null;
  /** For a place: the record of the place tables (the names in both languages, the kind, the mission, the operator, the country, the date, the feature's type and size). Left out for an orbiter and for a tap on nothing. */
  place?: Place;
  /** For a place that is a landing on the Moon or Mars (the lander, or the rover or descent stage on the same spot): the landing site (`/landing-sites`: names, the day, the agency, the country and its flag code, where each number is from). Left out for any other place. */
  site?: LandingSite;
  /** What chose it: a pointer going over it (`hover`), a tap or click (`tap`), or the keyboard (`key`). */
  via: "hover" | "tap" | "key";
}

interface Orb extends FlatOrbiter {
  x: number;
  y: number;
  on: boolean;
  colour: string;
}
interface Mark {
  place: Place;
  layer: PlaceLayer;
  x: number;
  y: number;
}
type Chosen = { kind: "orbiter"; id: OrbiterId } | { kind: "place"; id: string };

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
const prefersLessMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const hidden = (): boolean => typeof document !== "undefined" && document.visibilityState === "hidden";
/** The landing site of each place of the tables that is on one: the lander's place, and the rover's and the descent stage's on the same spot. */
let siteOfPlace: Map<string, LandingSite> | undefined;
const siteOf = (id: string): LandingSite | undefined => {
  if (!siteOfPlace) {
    siteOfPlace = new Map();
    for (const site of LANDING_SITES) for (const place of [site.place, ...(site.alsoAt ?? [])]) siteOfPlace.set(place, site);
  }
  return siteOfPlace.get(id);
};
const FLAG_W = 21;
const LAYER_WORD: Readonly<Record<PlaceLayer, string>> = { landing: "landing", crash: "crash", planned: "planned", feature: "feature" };

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
.stage{position:relative;flex:1 1 auto;min-height:0;aspect-ratio:var(--wakusei-flat-aspect,2/1);overflow:hidden;border-radius:var(--wakusei-flat-radius,10px);background:var(--wakusei-flat-sea,#0b1830)}
@container (max-width:599px){.stage{aspect-ratio:var(--wakusei-flat-aspect-narrow,4/3)}}
canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.dots{outline:none;cursor:grab;touch-action:pan-y}
.dots[data-zoomed]{touch-action:none}
.dots:focus-visible{outline:3px solid #6cd0ff;outline-offset:-3px}
.ring{position:absolute;left:0;top:0;width:20px;height:20px;margin:-10px 0 0 -10px;border:2px solid #fff;border-radius:50%;pointer-events:none;box-shadow:0 0 0 1px #000,inset 0 0 0 1px #000}
.ring.hov{width:14px;height:14px;margin:-7px 0 0 -7px;border-width:1px}
.ring[hidden],.tip[hidden]{display:none}
.tip{position:absolute;left:0;top:0;pointer-events:none;background:rgba(8,14,28,.94);color:#fff;padding:4px 8px;border-radius:6px;font-size:.85em;line-height:1.3;max-width:calc(100% - 12px);width:max-content;border:1px solid rgba(255,255,255,.3)}
.msg{position:absolute;inset:0;display:grid;place-items:end center;margin:0;padding:8px;text-align:center;color:#fff;font-size:.85em;text-shadow:0 0 3px #000,0 0 3px #000;pointer-events:none}
.msg:empty{display:none}
.flags{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.flags[hidden]{display:none}
.flag{position:absolute;left:0;top:0;height:11px;width:16px;pointer-events:none}
.flag:not(:defined){display:none}
.tip .flag{position:static;display:inline-block;vertical-align:-1px;margin-right:6px}
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

/** Pictures already asked for, by address: a page with two maps of the same body fetches one. */
const pictures = new Map<string, Promise<HTMLImageElement>>();
function picture(url: string): Promise<HTMLImageElement> {
  let held = pictures.get(url);
  if (held === undefined) {
    held = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => {
        pictures.delete(url);
        reject(new Error(`the map ${url} could not be loaded`));
      };
      image.src = url;
    });
    pictures.set(url, held);
  }
  return held;
}

/**
 * The `<wakusei-flat>` custom element: the Moon or Mars on a flat map, with day and night from the Sun's direction for the time shown, the landing, rover and crash sites marked, and the spacecraft in orbit as dots that move over it. Import
 * `@johnmorrisdotca/wakusei-planets/flat/define` to register the tag. It needs no WebGL and no peer: the map is the package's own picture of the body (the same one the 3D views are painted from), fetched from the package's CDN folder unless `texture-base` says where yours are.
 *
 * Attributes (the ones marked "same" are the names and meanings `<chikyu-flat>` has): `body` (`moon`, the default, or `mars`), `center` (same: the longitude in the middle, degrees; 0, the near side or the prime meridian, by default; the map wraps round the body),
 * `home-lon` and `home-lat` (same: the reader's place, a chosen site: a marker, and the "My place" button, which appear only when given),
 * `footprint` and `track` (same: the circle on the ground the orbiter can see, and its ground track for one trip round; the footprint and track of the chosen orbiter, or of every orbiter shown when none is chosen), `footprint-elevation` (same: degrees above the horizon the circle is drawn for; 10 by default),
 * `paused` (same: hold the clock and keep the speed; nothing is drawn while it is held), `time` (same: `now`, an ISO date or milliseconds since 1970; live when absent), `speed` (same: 1 is real time, 0 holds, 86400 is a day a second, negative runs backwards),
 * `selected` (same: the chosen orbiter's id such as `lro`, or a place's id such as `moon/apollo-11-lunar-module`), `shade` (same: `off` for no night), `dot-size` (same: pixels), `controls` (same: `none`, or any of `centre zoom footprint track chips`; all by default), `lang` (same: `en` or `ja`; the page's language by default),
 * `orbiters` (`all`, the default, `off`, or some ids with commas: the orbiters drawn), `places` (the kinds of place marked, from `landing` (crewed, landing and rover sites), `crash` (crashes and impacts), `planned` and `feature` (named craters, seas and mountains); `landing` by default, `all` for every kind, `off` for none),
 * `names` (`off` for no names beside the marks, or the most names to show), `site-flags` (the landing sites carry their country's flag: `<hata-flag>` beside the name on the map and in the tip; the page imports `@johnmorrisdotca/hata`, and without it the name stands alone), `texture-base` and `texture-far-base` (where the body's pictures are: the package's folder on jsDelivr by default).
 *
 * Events (the same names as chikyu's with `wakusei-` for `chikyu-`): `wakusei-flat-pick` (an orbiter, a place of the tables (a landing, a rover, a crash, a crater, a mountain) or a landing site under the pointer, tapped, or reached by the keyboard: a `FlatPick` with `kind`, `id`, `name`, `via` and, for a place, `place` (its record) and `site` (the landing site, where it is one); `detail.id` is null when a tap lands on nothing and clears the choice), `wakusei-flat-filter` (a chip changed what is shown: `{ orbiters, layers }`),
 * `wakusei-flat-view` (the reader panned or zoomed: `{ center, zoom }`) and `wakusei-timechange` (`{ time, running, paused }`, at most four a second while time runs; the name the space view uses).
 * Style it with the custom properties `--wakusei-flat-sea`, `--wakusei-flat-aspect`, `--wakusei-flat-aspect-narrow` and `--wakusei-flat-radius`.
 *
 * @example
 * ```ts no-run
 * import "@johnmorrisdotca/wakusei-planets/flat/define";
 * import type { WakuseiFlat } from "@johnmorrisdotca/wakusei-planets/flat/define";
 *
 * const flat = document.createElement("wakusei-flat") as WakuseiFlat;
 * flat.setAttribute("body", "moon");
 * flat.setAttribute("track", "");
 * document.body.append(flat);
 * flat.addEventListener("wakusei-flat-pick", (event) => console.log((event as CustomEvent).detail.name));
 * ```
 */
export class WakuseiFlat extends HTMLElement {
  static observedAttributes = ["body", "center", "home-lon", "home-lat", "time", "speed", "paused", "footprint", "track", "footprint-elevation", "selected", "shade", "dot-size", "controls", "lang", "orbiters", "places", "names", "site-flags", "texture-base", "texture-far-base"];

  #body: FlatBodyId = "moon";
  #info: FlatBodyInfo = flatBody("moon");
  #clock: GameClock = createGameClock("now", 1);
  #speed = 1;
  #paused = false;
  #view: FlatView = { width: 0, height: 0, centerLon: 0, centerLat: 0, zoom: 1 };
  #dpr = 1;
  #places: readonly Place[] = [];
  #placeIds = new Map<string, Place>();
  #placesFor: FlatBodyId | "" = "";
  #layers = new Set<PlaceLayer>(["landing"]);
  #showOrbiters = true;
  #orbiterIds: OrbiterId[] = [];
  #footprint = false;
  #track = false;
  #selected: Chosen | null = null;
  #cursor: Chosen | null = null;
  #hover: Chosen | null = null;
  #orbs: Orb[] = [];
  #marks: Mark[] = [];
  #flagSpots: { x: number; y: number; code: string }[] = [];
  #flagLayer: HTMLElement | undefined;
  #lastDraw = 0;
  #totalMs = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #frame = 0;
  #inView = true;
  #connected = false;
  #viewSent = "";
  #announced = -Infinity;
  #mapKey = "";
  #image: HTMLImageElement | undefined;
  #imageWidth = 0;
  #imageAsked = "";
  #imageFailed = false;
  #imageTurn = 0;
  #placesTurn = 0;
  #shade: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; data: ImageData | null } | undefined;
  #tracks = new Map<string, { key: string; past: [GroundPoint, GroundPoint][]; future: [GroundPoint, GroundPoint][] }>();
  #stage: HTMLElement | undefined;
  #bar: HTMLElement | undefined;
  #mapCanvas: HTMLCanvasElement | undefined;
  #dotCanvas: HTMLCanvasElement | undefined;
  #selRing: HTMLElement | undefined;
  #hovRing: HTMLElement | undefined;
  #tip: HTMLElement | undefined;
  #live: HTMLElement | undefined;
  #msg: HTMLElement | undefined;
  #sizer: ResizeObserver | undefined;
  #watcher: IntersectionObserver | undefined;
  #langWatch: MutationObserver | undefined;
  #pointers = new Map<number, { x: number; y: number }>();
  #drag: { x: number; y: number; moved: boolean; pinch: number } | null = null;
  #counts = { draws: 0, mapDraws: 0, dots: 0, lastMs: 0, maxMs: 0 };
  #measureCtx: CanvasRenderingContext2D | null | undefined;

  // --- the page's controls ---------------------------------------------------------------------------------------------------------------------

  /** The body on the map: `moon` or `mars`. */
  get body(): FlatBodyId {
    return this.#body;
  }
  set body(value: FlatBodyId) {
    this.setAttribute("body", value);
  }

  /** Whether the landing sites carry their country's flag (the attribute `site-flags`): beside the name on the map, and in the tip. The flag is `<hata-flag>` from `@johnmorrisdotca/hata`, which the page imports; where it is not defined the name stands alone. */
  get siteFlags(): boolean {
    return this.hasAttribute("site-flags");
  }
  set siteFlags(on: boolean) {
    this.toggleAttribute("site-flags", on);
  }

  /** The id of the chosen orbiter or place, or null. Set it to choose one from code (no `wakusei-flat-pick` is sent), `null` to clear. */
  get selected(): string | null {
    return this.#selected?.id ?? null;
  }
  set selected(id: string | null) {
    this.#selected = this.#find(id);
    this.#sync();
    this.#request();
  }

  /** The longitude in the middle, degrees. Set it to centre the map there; a reader's pan changes it, and `wakusei-flat-view` tells the page. */
  get center(): number {
    return this.#view.centerLon;
  }
  set center(lon: number) {
    this.#setView({ ...this.#view, centerLon: lon });
  }

  /** The zoom: 1 shows the whole body, up to 8. */
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

  /** True while the clock is held with its speed kept (the page's Pause): nothing is drawn but what the reader changes. Setting it false carries on from the moment shown at the same speed. */
  get paused(): boolean {
    return this.#paused;
  }
  set paused(value: boolean) {
    if (value === this.#paused) return;
    const now = performance.now();
    const shown = this.#clock.advance(now);
    this.#paused = value;
    // held, the moment stays where it is even in real time: it does not jump to the wall clock when carried on
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

  /** The orbiters the map can draw for this body now: their ids, names and colours, and whether each has a path at the moment shown. A craft with no public path (Tianwen-1, CAPSTONE) is not in the list. */
  get orbiters(): readonly { id: string; name: string; colour: string; shown: boolean }[] {
    const lang = this.language;
    return this.#info.orbiters.filter((id) => orbiterElements(id) !== undefined).map((id) => ({ id, name: orbiterName(id, lang), colour: orbiterColour(id), shown: this.#orbiterIds.includes(id) }));
  }

  /** The places loaded for this body (every kind; the `places` attribute and the chips choose which are marked), or an empty list while they load. */
  get places(): readonly Place[] {
    return this.#places;
  }

  /** The kinds of place marked now: `landing`, `crash`, `planned` and `feature`. */
  get layers(): readonly PlaceLayer[] {
    return [...this.#layers];
  }

  /** Counters for a test or a page: draws of the dots, draws of the map, the orbiters drawn at the last draw, the milliseconds the last draw and the slowest took, the marks drawn, and the canvases' size in pixels. */
  get stats(): { draws: number; mapDraws: number; dots: number; marks: number; lastDrawMs: number; maxDrawMs: number; averageDrawMs: number; running: boolean; paused: boolean; fast: boolean; mapLoaded: boolean; canvases: { width: number; height: number }[] } {
    const canvases = [this.#mapCanvas, this.#dotCanvas].filter((c): c is HTMLCanvasElement => c !== undefined).map((c) => ({ width: c.width, height: c.height }));
    return { draws: this.#counts.draws, mapDraws: this.#counts.mapDraws, dots: this.#counts.dots, marks: this.#marks.length, lastDrawMs: this.#counts.lastMs, maxDrawMs: this.#counts.maxMs, averageDrawMs: this.#counts.draws > 0 ? this.#totalMs / this.#counts.draws : 0, running: this.#running(), paused: this.#paused, fast: this.#fast(), mapLoaded: this.#image !== undefined, canvases };
  }

  /** Where an orbiter or a place is on the screen as of the last draw, in CSS pixels from the map's top left, or null when it is not drawn (not shown, off the map, or an orbiter with no path). */
  placeOf(id: string): { x: number; y: number; lon: number; lat: number; altitudeKm: number | null } | null {
    const orb = this.#orbs.find((one) => one.id === id && one.on);
    if (orb) return { x: orb.x, y: orb.y, lon: orb.lon, lat: orb.lat, altitudeKm: orb.altitudeKm };
    const mark = this.#marks.find((one) => one.place.id === id);
    return mark ? { x: mark.x, y: mark.y, lon: mark.place.lon, lat: mark.place.lat, altitudeKm: null } : null;
  }

  /** Choose an orbiter or a place from code, as a reader's tap would, without sending `wakusei-flat-pick`. An id the map does not hold, or `null`, clears the choice. */
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
    // the page's language, when this element has none of its own
    this.#langWatch = new MutationObserver(() => {
      if (!this.hasAttribute("lang")) this.#words();
    });
    this.#langWatch.observe(this.ownerDocument.documentElement, { attributes: true, attributeFilter: ["lang"] });
    document.addEventListener("visibilitychange", this.#onVisibility);
    this.#measure();
    this.#words();
    this.setAttribute("data-state", "loading");
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
    if (name === "lang" || name === "controls" || name === "home-lon" || name === "home-lat" || name === "body" || name === "orbiters" || name === "places") this.#words();
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

  /** Take in every attribute the element has: when it comes into the page. `body` first, since the others are read for it. */
  #readAll(): void {
    this.#read("body");
    for (const name of WakuseiFlat.observedAttributes) if (name !== "body") this.#read(name);
  }

  /** Take in one attribute. A change to one never undoes what the reader did with another (a chosen orbiter, the pan). */
  #read(name: string): void {
    const value = this.getAttribute(name);
    if (name === "body") {
      const wanted = value === null ? "moon" : value.trim().toLowerCase();
      const next: FlatBodyId = isFlatBody(wanted) ? wanted : "moon";
      if (next !== this.#body || this.#placesFor === "") {
        this.#body = next;
        this.#info = flatBody(next);
        this.#selected = this.#cursor = this.#hover = null;
        this.#tracks.clear();
        this.#orbs = [];
        this.#marks = [];
        this.#places = [];
        this.#placeIds = new Map();
        this.#placesFor = "";
        this.#image = undefined;
        this.#imageWidth = 0;
        this.#imageAsked = "";
        this.#imageFailed = false;
        this.#mapKey = "";
        this.#view = clampView({ ...this.#view, centerLon: finite(this.getAttribute("center"), 0), centerLat: 0, zoom: 1 });
        this.#readOrbiters();
        this.#loadPlaces();
      }
    } else if (name === "center") {
      const lon = finite(value, Number.NaN);
      if (Number.isFinite(lon)) this.#view = clampView({ ...this.#view, centerLon: lon });
      this.#mapKey = "";
    } else if (name === "orbiters") this.#readOrbiters();
    else if (name === "places") {
      this.#layers = new Set(value === null ? (["landing"] as PlaceLayer[]) : /^(off|none|false|0)$/i.test(value.trim()) ? [] : readPlaceLayers(value));
      this.#mapKey = "";
    } else if (name === "footprint") this.#footprint = flag(value);
    else if (name === "track") {
      this.#track = flag(value);
      this.#tracks.clear();
    } else if (name === "selected") this.#selected = value === null || value.trim() === "" ? null : this.#find(value.trim());
    else if (name === "paused") {
      if (flag(value) !== this.#paused) this.paused = flag(value);
    } else if (name === "time" || name === "speed") this.#readClock();
    else if (name === "shade" || name === "dot-size" || name === "names" || name === "site-flags" || name === "home-lon" || name === "home-lat") this.#mapKey = "";
    else if (name === "texture-base" || name === "texture-far-base") {
      this.#imageAsked = "";
      this.#imageFailed = false;
    }
  }

  #readOrbiters(): void {
    const value = this.getAttribute("orbiters");
    const all = this.#info.orbiters.filter((id) => orbiterElements(id) !== undefined);
    if (value === null || value.trim() === "" || /^(all|on|true|1)$/i.test(value.trim())) {
      this.#showOrbiters = true;
      this.#orbiterIds = all;
    } else if (/^(off|none|false|0)$/i.test(value.trim())) {
      this.#showOrbiters = false;
      this.#orbiterIds = all;
    } else {
      const wanted = value.toLowerCase().split(/[\s,]+/).filter((one) => one !== "");
      this.#showOrbiters = true;
      this.#orbiterIds = all.filter((id) => wanted.includes(id));
    }
    this.#tracks.clear();
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

  /** The orbiter or place with this id, from what the map holds. */
  #find(id: string | null): Chosen | null {
    if (id === null) return null;
    if (this.#info.orbiters.includes(id as OrbiterId)) return { kind: "orbiter", id: id as OrbiterId };
    // a landing site's own id (`moon/apollo-11`) is its lander's place
    const place = LANDING_SITES.find((site) => site.id === id)?.place ?? id;
    return this.#placeIds.has(place) || /^(moon|mars)\//.test(place) ? { kind: "place", id: place } : null;
  }

  #loadPlaces(): void {
    const body = this.#body;
    this.#placesFor = body;
    const turn = (this.#placesTurn += 1);
    void loadPlaces(body).then(
      (list) => {
        if (turn !== this.#placesTurn || !this.#connected) return;
        this.#places = list;
        this.#placeIds = new Map(list.map((place) => [place.id, place]));
        const wanted = this.getAttribute("selected");
        if (this.#selected === null && wanted !== null && wanted.trim() !== "") this.#selected = this.#find(wanted.trim());
        this.#mapKey = "";
        this.#words();
        this.#request();
      },
      () => undefined,
    );
  }

  // --- the clock -------------------------------------------------------------------------------------------------------------------------------

  /** The clock is running and the element is in sight: it asks for frames. A held clock, a hidden tab and a view out of sight ask for none. */
  #running(): boolean {
    return this.#visibleNow() && this.#clock.speed !== 0 && !this.#paused;
  }

  /** Is the clock fast enough that the orbiters are drawn as streaks and the shading is coarser? */
  #fast(): boolean {
    return !this.#paused && Math.abs(this.#speed) >= FAST_SPEED;
  }

  /**
   * How often a running clock draws: as often as an orbiter (about 0.08 degree of the map a second) moves half a pixel, up to every frame, and at least once a second; once a second at most for a reader who asked for reduced motion.
   * With no orbiter to show, the pace of the night's edge (Mars turns 0.004 degree a second, the Moon's sunrise creeps along at 0.0001).
   */
  #rate(): number {
    const k = pixelsPerDegree(this.#view.width > 0 ? this.#view : { ...this.#view, width: 600, height: 300 });
    const dots = this.#showOrbiters && this.#orbiterIds.length > 0;
    let perSecond = ((dots ? 0.08 : this.#body === "mars" ? 0.0042 : 0.00015) * Math.abs(this.#speed) * k) / 0.5;
    perSecond = Math.min(60, Math.max(dots ? 1 : 1 / 30, perSecond));
    if (prefersLessMotion()) perSecond = Math.min(perSecond, 1);
    return perSecond;
  }

  /** After a draw, or when something about the clock changed: ask for the next frame in time, by a timer when frames are far apart. Nothing at all when the clock is held or out of sight. */
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

  /** The width of the picture the view needs, and its address; asks for it when it is not the one held. */
  #wantPicture(): void {
    if (this.#imageFailed || this.#view.width === 0) return;
    const need = 360 * pixelsPerDegree(this.#view) * this.#dpr;
    const width = WIDTHS.find((one) => one >= need) ?? WIDTHS[WIDTHS.length - 1]!;
    const paths = texturePaths(this);
    const url = `${width <= 1024 ? paths.textureBase() : paths.farBase()}${this.#body}-${width}.webp`;
    // a sharper picture already held is kept; the first is asked for at once, a sharper one when the view needs it
    if (url === this.#imageAsked || (this.#image !== undefined && this.#imageWidth >= width)) return;
    this.#imageAsked = url;
    const turn = (this.#imageTurn += 1);
    picture(url).then(
      (image) => {
        if (turn !== this.#imageTurn || !this.#connected) return;
        this.#image = image;
        this.#imageWidth = width;
        this.#mapKey = "";
        this.setAttribute("data-state", "ready");
        this.#request();
      },
      () => {
        if (turn !== this.#imageTurn) return;
        // a sharper picture that cannot be had leaves the one held; with none, the plain ground colour
        if (this.#image === undefined) {
          this.#imageFailed = true;
          this.setAttribute("data-state", "ready");
          this.#mapKey = "";
          this.#showMessage();
          this.#request();
        }
      },
    );
  }

  #measure(): void {
    const stage = this.#stage;
    if (!stage) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    // the canvases stay inside 6 million pixels and 4096 a side, whatever the screen
    const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 3, width > 0 && height > 0 ? Math.sqrt(6_000_000 / (width * height)) : 3, width > 0 || height > 0 ? 4096 / Math.max(width, height) : 3));
    if (width === this.#view.width && height === this.#view.height && dpr === this.#dpr) return;
    this.#dpr = dpr;
    this.#view = clampView({ ...this.#view, width, height });
    for (const canvas of [this.#mapCanvas, this.#dotCanvas]) {
      if (!canvas) continue;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    }
    this.#mapKey = "";
  }

  /** The place on the screen of a longitude and latitude, taking the copy of the world that falls in the box; null when none does. */
  #screen(lon: number, lat: number, pad = 0): { x: number; y: number } | null {
    const v = this.#view;
    const k = pixelsPerDegree(v);
    const wrap = 360 * k;
    const y = v.height / 2 - (lat - v.centerLat) * k;
    if (y < -pad || y > v.height + pad) return null;
    let x = v.width / 2 + wrapLongitude(lon - v.centerLon) * k;
    if (x < -pad && x + wrap <= v.width + pad) x += wrap;
    else if (x > v.width + pad && x - wrap >= -pad) x -= wrap;
    return x < -pad || x > v.width + pad ? null : { x, y };
  }

  #home(): { lon: number; lat: number } | null {
    const lon = finite(this.getAttribute("home-lon"), Number.NaN);
    const lat = finite(this.getAttribute("home-lat"), Number.NaN);
    return Number.isFinite(lon) && Number.isFinite(lat) ? { lon: wrapLongitude(lon), lat } : null;
  }

  #measureText(text: string): number {
    this.#measureCtx ??= this.ownerDocument.createElement("canvas").getContext("2d");
    const ctx = this.#measureCtx;
    if (ctx === null) return text.length * 6.5;
    ctx.font = "600 11px system-ui, sans-serif";
    return ctx.measureText(text).width;
  }

  /** The marks of the kinds on show that fall in the view, the most important first: every site, and of the named features as many as the zoom has room for. */
  #drawMap(ms: number): void {
    const canvas = this.#mapCanvas;
    const v = this.#view;
    if (!canvas || v.width === 0) return;
    this.#wantPicture();
    const sun = flatSun(this.#body, ms);
    const shade = this.getAttribute("shade") !== "off";
    const home = this.#home();
    const lang = this.language;
    const names = readSurfaceNames(this.getAttribute("names"));
    // the map is drawn again only when the view, the home, the marks, the picture or the Sun's place (about a quarter of a degree) changed
    const key = [v.width, v.height, this.#dpr, v.centerLon.toFixed(3), v.centerLat.toFixed(3), v.zoom.toFixed(3), shade ? Math.round(sun.lon * 4) : "x", shade ? Math.round(sun.lat * 4) : "x", this.#fast() ? "f" : "s", home ? `${home.lon},${home.lat}` : "", [...this.#layers].join("+"), this.#places.length, this.hasAttribute("site-flags"), names.on ? (names.limit ?? "on") : "off", lang, this.#imageWidth, this.#imageFailed].join("|");
    if (key === this.#mapKey) return;
    this.#mapKey = key;
    this.#counts.mapDraws += 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const k = pixelsPerDegree(v);
    const wrap = 360 * k;
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    ctx.fillStyle = this.#info.ground;
    ctx.fillRect(0, 0, v.width, v.height);
    // the body's picture: 360 degrees wide, drawn again a world to the left and right wherever the box is wider than the world
    if (this.#image) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const left = v.width / 2 + (-180 - v.centerLon) * k;
      const top = v.height / 2 - (90 - v.centerLat) * k;
      for (let x = left - Math.ceil(left / wrap) * wrap; x < v.width; x += wrap) ctx.drawImage(this.#image, x, top, wrap, 180 * k);
    }
    if (shade) this.#drawNight(ctx, sun);
    this.#drawGraticule(ctx);
    // the Sun overhead
    const at = projectFlat(v, sun.lon, sun.lat);
    for (const x of [at.x, at.x - wrap, at.x + wrap]) {
      if (x < -8 || x > v.width + 8) continue;
      ctx.beginPath();
      ctx.arc(x, at.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd54f";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.stroke();
    }
    this.#drawMarks(ctx, names, lang);
    if (home) {
      const place = projectFlat(v, home.lon, home.lat);
      for (const x of [place.x, place.x - wrap, place.x + wrap]) {
        if (x < -10 || x > v.width + 10) continue;
        ctx.save();
        ctx.translate(x, place.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#0b1830";
        ctx.lineWidth = 2;
        ctx.strokeRect(-4.5, -4.5, 9, 9);
        ctx.fillRect(-4.5, -4.5, 9, 9);
        ctx.restore();
      }
    }
    this.setAttribute("data-state", this.#image || this.#imageFailed ? "ready" : "loading");
  }

  /** The night side: the Sun's height at each cell of a grid laid over the view, turned into the night's colour and drawn over the picture, smoothed. Coarser cells at a fast clock. */
  #drawNight(ctx: CanvasRenderingContext2D, sun: GroundPoint): void {
    const v = this.#view;
    const cell = this.#fast() ? 4 : 2;
    const columns = Math.max(1, Math.ceil(v.width / cell));
    const rows = Math.max(1, Math.ceil(v.height / cell));
    let shade = this.#shade;
    if (!shade) {
      const canvas = this.ownerDocument.createElement("canvas");
      const own = canvas.getContext("2d");
      if (!own) return;
      shade = this.#shade = { canvas, ctx: own, data: null };
    }
    if (shade.canvas.width !== columns || shade.canvas.height !== rows || shade.data === null) {
      shade.canvas.width = columns;
      shade.canvas.height = rows;
      shade.data = shade.ctx.createImageData(columns, rows);
    }
    shadeNight(shade.data.data, columns, rows, cell, v, sun, this.#body);
    shade.ctx.putImageData(shade.data, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(shade.canvas, 0, 0, columns * cell, rows * cell);
  }

  #drawGraticule(ctx: CanvasRenderingContext2D): void {
    const v = this.#view;
    const k = pixelsPerDegree(v);
    const wrap = 360 * k;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lon = -180; lon < 180; lon += 30) {
      const x0 = v.width / 2 + wrapLongitude(lon - v.centerLon) * k;
      for (let x = x0 - Math.ceil((x0 + 1) / wrap) * wrap; x <= v.width; x += wrap) {
        if (x < -1) continue;
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, v.height);
      }
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = Math.round(v.height / 2 - (lat - v.centerLat) * k) + 0.5;
      if (y < 0 || y > v.height) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(v.width, y);
    }
    ctx.strokeStyle = "rgba(170,195,230,.32)";
    ctx.stroke();
  }

  /** The marks of the kinds on show: sites as shapes by kind, the named features as a small dot, and a name beside as many as there is room for. */
  #drawMarks(ctx: CanvasRenderingContext2D, names: { on: boolean; limit: number | null }, lang: FlatLang): void {
    const v = this.#view;
    this.#marks = [];
    this.#flagSpots = [];
    if (this.#layers.size === 0 || this.#places.length === 0) {
      this.#syncFlags();
      return;
    }
    const pad = 8;
    const flags = this.hasAttribute("site-flags");
    const shown: Mark[] = [];
    for (const place of this.#places) {
      const layer = layerOf(place.kind);
      if (!this.#layers.has(layer)) continue;
      const at = this.#screen(place.lon, place.lat, pad);
      if (at === null) continue;
      shown.push({ place, layer, x: at.x, y: at.y });
    }
    const rank = (place: Place): number => (place.kind === "crewed" ? -3_000_000 : placeRank(place));
    shown.sort((a, b) => rank(a.place) - rank(b.place));
    // a feature with no room for its name is marked by a small dot once the map is zoomed in far enough, so every feature can be pressed
    const limit = names.on ? (names.limit ?? Math.round(7 * v.zoom ** 1.7)) : 0;
    const dotsFrom = v.zoom >= 2.5;
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const hit = (a: { x0: number; y0: number; x1: number; y1: number }): boolean => boxes.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0);
    let named = 0;
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    const labels: { text: string; x: number; y: number; align: CanvasTextAlign }[] = [];
    const chosenId = this.#selected?.kind === "place" ? this.#selected.id : null;
    for (const mark of shown) {
      const feature = mark.layer === "feature";
      const site = siteOf(mark.place.id);
      // a landing site is named by its own name (Apollo 11), once, on the lander
      const text = site ? site.name[lang] : mark.place.name[lang];
      const flag = flags && site !== undefined ? flagCodeOf(site.country) : undefined;
      const room = flag === undefined ? 0 : FLAG_W;
      let label: { x0: number; y0: number; x1: number; y1: number; x: number; align: CanvasTextAlign; flagX: number } | null = null;
      if (names.on && (named < limit || mark.place.id === chosenId) && (site === undefined || site.place === mark.place.id)) {
        const width = this.#measureText(text) + room;
        const right = { x0: mark.x + 8, y0: mark.y - 7, x1: mark.x + 8 + width, y1: mark.y + 7, x: mark.x + 8 + room, align: "left" as CanvasTextAlign, flagX: mark.x + 8 };
        const left = { x0: mark.x - 8 - width, y0: mark.y - 7, x1: mark.x - 8, y1: mark.y + 7, x: mark.x - 8 - room, align: "right" as CanvasTextAlign, flagX: mark.x - 8 - FLAG_W + 3 };
        const fits = (b: typeof right): boolean => b.x0 >= 0 && b.x1 <= v.width && !hit(b);
        label = fits(right) ? right : fits(left) ? left : null;
      }
      // a feature is marked by its name, or by a dot when the map is zoomed in
      if (feature && label === null && !dotsFrom && mark.place.id !== chosenId) continue;
      if (label !== null) {
        boxes.push(label);
        labels.push({ text, x: label.x, y: mark.y, align: label.align });
        if (flag !== undefined) this.#flagSpots.push({ x: label.flagX, y: mark.y, code: flag });
        named += 1;
      }
      boxes.push({ x0: mark.x - 5, y0: mark.y - 5, x1: mark.x + 5, y1: mark.y + 5 });
      this.#marks.push(mark);
      this.#mark(ctx, mark);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,.72)";
    ctx.fillStyle = "#fff";
    for (const label of labels) {
      ctx.textAlign = label.align;
      ctx.strokeText(label.text, label.x, label.y);
      ctx.fillText(label.text, label.x, label.y);
    }
    this.#syncFlags();
  }

  /** The flags beside the names of the landing sites: `<hata-flag>` elements (from `@johnmorrisdotca/hata`, which the page imports; where it is not defined they draw nothing and the name stands alone), moved to the spots the map drew, each made once and kept. */
  #syncFlags(): void {
    const layer = this.#flagLayer;
    if (!layer) return;
    const spots = this.#flagSpots;
    layer.hidden = spots.length === 0;
    while (layer.children.length > spots.length) layer.lastElementChild!.remove();
    spots.forEach((spot, i) => {
      let flag = layer.children[i] as HTMLElement | undefined;
      if (!flag) {
        flag = this.ownerDocument.createElement("hata-flag");
        flag.className = "flag";
        flag.setAttribute("border", "");
        flag.setAttribute("aria-hidden", "true");
        layer.append(flag);
      }
      if (flag.getAttribute("code") !== spot.code) flag.setAttribute("code", spot.code);
      flag.style.transform = `translate(${spot.x.toFixed(1)}px,${(spot.y - 5.5).toFixed(1)}px)`;
    });
  }

  /** One mark: a diamond for a site (gold for a crewed one, white for a lander, outlined for a rover), a cross for a crash or an impact, a dashed ring for a planned landing and a small dot for a named feature. */
  #mark(ctx: CanvasRenderingContext2D, mark: Mark): void {
    const { x, y, place } = mark;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,0,0,.85)";
    const kind = place.kind;
    if (kind === "crewed" || kind === "landing" || kind === "rover") {
      ctx.rotate(Math.PI / 4);
      const s = kind === "crewed" ? 4.2 : kind === "landing" ? 3.6 : 3;
      ctx.fillStyle = kind === "crewed" ? "#ffd23f" : kind === "landing" ? "#ffffff" : "#6ee7a0";
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      ctx.fillRect(-s, -s, s * 2, s * 2);
    } else if (kind === "crash" || kind === "impact" || kind === "entry") {
      ctx.strokeStyle = "rgba(0,0,0,.85)";
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-3.5, -3.5);
      ctx.lineTo(3.5, 3.5);
      ctx.moveTo(3.5, -3.5);
      ctx.lineTo(-3.5, 3.5);
      ctx.stroke();
      ctx.strokeStyle = "#ff8a65";
      ctx.lineWidth = 1.7;
      ctx.stroke();
    } else if (kind === "planned") {
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = "rgba(0,0,0,.85)";
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#b9a7ff";
      ctx.lineWidth = 1.7;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- the orbiters ----------------------------------------------------------------------------------------------------------------------------

  #draw(): void {
    const started = performance.now();
    const canvas = this.#dotCanvas;
    const v = this.#view;
    if (!canvas || v.width === 0 || v.height === 0) return;
    const ms = this.#clock.advance(started);
    this.#drawMap(ms);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    ctx.clearRect(0, 0, v.width, v.height);
    const k = pixelsPerDegree(v);
    const size = finite(this.getAttribute("dot-size"), 0);
    const radius = (size > 0 ? size / 2 : 4) * Math.min(1.8, 0.85 + v.zoom * 0.15);
    const streak = this.#fast();
    const lag = streak ? this.#speed * 1000 * STREAK_SECONDS : 0;
    // where each orbiter is over the ground now: exact for any time, so a fast clock never makes a dot lag or jump out of its orbit
    const orbs: Orb[] = [];
    const behind: ({ x: number; y: number } | null)[] = [];
    if (this.#showOrbiters) {
      for (const id of this.#orbiterIds) {
        const state = flatOrbiter(id, ms);
        if (state === undefined) continue;
        const at = this.#screen(state.lon, state.lat, radius + 1);
        orbs.push({ ...state, x: at?.x ?? 0, y: at?.y ?? 0, on: at !== null, colour: orbiterColour(id) });
        let tail: { x: number; y: number } | null = null;
        if (streak && at !== null) {
          // where it was a moment ago on the same turn of the map, shortened to the streak's longest
          const before = flatOrbiter(id, ms - lag);
          if (before) {
            const x0 = at.x + wrapLongitude(before.lon - state.lon) * k;
            const y0 = v.height / 2 - (before.lat - v.centerLat) * k;
            const d = Math.hypot(x0 - at.x, y0 - at.y);
            const f = d > STREAK_PX ? STREAK_PX / d : 1;
            tail = d > 3 ? { x: at.x + (x0 - at.x) * f, y: at.y + (y0 - at.y) * f } : null;
          }
        }
        behind.push(tail);
      }
    }
    this.#orbs = orbs;
    const chosen = this.#selected?.kind === "orbiter" ? orbs.find((o) => o.id === (this.#selected as { id: string }).id && o.on) : undefined;
    this.#drawOver(ctx, orbs, chosen, ms);
    if (streak) {
      ctx.lineCap = "butt";
      ctx.lineWidth = Math.max(1.5, radius * 1.2);
      ctx.globalAlpha = 0.7;
      orbs.forEach((o, i) => {
        const tail = behind[i];
        if (!o.on || !tail) return;
        ctx.strokeStyle = o.colour;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(o.x, o.y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    let dots = 0;
    for (const o of orbs) {
      if (!o.on) continue;
      dots += 1;
      ctx.beginPath();
      ctx.arc(o.x, o.y, radius, 0, Math.PI * 2);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "rgba(0,0,0,.8)";
      if (o.dim) {
        // a position that is only approximate: a ring, not a solid dot
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(o.x, o.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = o.colour;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = o.colour;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = o.colour;
        ctx.fill();
        ctx.stroke();
      }
    }
    this.#counts.draws += 1;
    this.#counts.dots = dots;
    this.#placeMarks();
    this.#showMessage();
    const took = performance.now() - started;
    this.#lastDraw = started;
    this.#totalMs += took;
    this.#counts.lastMs = took;
    if (took > this.#counts.maxMs) this.#counts.maxMs = took;
    this.#announceView();
    this.#announceTime(ms);
    this.#schedule();
  }

  /** The coverage circles and the ground tracks, drawn before the dots so the dots lie on them. */
  #drawOver(ctx: CanvasRenderingContext2D, orbs: readonly Orb[], chosen: Orb | undefined, ms: number): void {
    const v = this.#view;
    const k = pixelsPerDegree(v);
    const wrap = 360 * k;
    if (this.#footprint) {
      const elevation = finite(this.getAttribute("footprint-elevation"), 10);
      for (const o of chosen ? [chosen] : orbs) {
        const angle = coverageAngleRad(o.altitudeKm, this.#info.radiusKm, elevation) / RAD;
        if (!(angle > 0)) continue;
        const ring = circleOutline(o.lat, o.lon, angle);
        const base = wrapLongitude(o.lon - v.centerLon);
        const xs = ring.points.map(([lon]) => v.width / 2 + (base + (lon - o.lon)) * k);
        const ys = ring.points.map(([, lat]) => v.height / 2 - (lat - v.centerLat) * k);
        const last = ring.points.length - 1;
        for (const shift of [-wrap, 0, wrap]) {
          const lo = Math.min(...xs) + shift;
          const hi = Math.max(...xs) + shift;
          if (hi < 0 || lo > v.width) continue;
          const outline = (): void => xs.forEach((x, i) => (i === 0 ? ctx.moveTo(x + shift, ys[i]!) : ctx.lineTo(x + shift, ys[i]!)));
          ctx.beginPath();
          outline();
          if (ring.pole !== 0) {
            // a circle that holds a pole is filled down to the map's edge; only its outline is stroked
            const edge = v.height / 2 - (ring.pole * 90 - v.centerLat) * k;
            ctx.lineTo(xs[last]! + shift, edge);
            ctx.lineTo(xs[0]! + shift, edge);
          }
          ctx.closePath();
          ctx.fillStyle = "rgba(255,255,255,.10)";
          ctx.fill();
          if (ring.pole !== 0) {
            ctx.beginPath();
            outline();
          }
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,.35)";
          ctx.stroke();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = "rgba(255,255,255,.75)";
          ctx.stroke();
        }
      }
    }
    if (this.#track || chosen) {
      for (const o of this.#track ? orbs : chosen ? [chosen] : []) {
        const lines = this.#trackOf(o.id, ms);
        const strong = chosen !== undefined && o.id === chosen.id;
        const draw = (pieces: readonly [GroundPoint, GroundPoint][], dash: boolean): void => {
          if (pieces.length === 0) return;
          for (const pass of strong ? [0, 1] : [1]) {
            ctx.beginPath();
            for (const [a, b] of pieces) {
              const xa = v.width / 2 + wrapLongitude(a.lon - v.centerLon) * k;
              const xb = xa + (b.lon - a.lon) * k;
              const ya = v.height / 2 - (a.lat - v.centerLat) * k;
              const yb = v.height / 2 - (b.lat - v.centerLat) * k;
              for (const shift of [-wrap, 0, wrap]) {
                if (Math.max(xa, xb) + shift < -2 || Math.min(xa, xb) + shift > v.width + 2) continue;
                ctx.moveTo(xa + shift, ya);
                ctx.lineTo(xb + shift, yb);
              }
            }
            ctx.setLineDash(dash ? [4, 4] : []);
            ctx.lineWidth = pass === 0 ? 4 : strong ? 1.8 : 1.2;
            ctx.strokeStyle = pass === 0 ? "rgba(0,0,0,.55)" : strong ? "#ffffff" : o.colour;
            ctx.globalAlpha = strong || pass === 0 ? 1 : dash ? 0.5 : 0.85;
            ctx.stroke();
          }
        };
        draw(lines.past, true);
        draw(lines.future, false);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** An orbiter's ground track for one trip round, half behind it and half ahead, worked out again when the clock has moved a fortieth of a trip (and, at a fast clock, a real second). */
  #trackOf(id: OrbiterId, ms: number): { past: [GroundPoint, GroundPoint][]; future: [GroundPoint, GroundPoint][] } {
    const days = orbiterElements(id)?.periodDays ?? 0;
    const every = Math.max((days * 86_400_000) / 40, this.#fast() ? Math.abs(this.#speed) * 1000 : 0);
    const key = `${Math.round(ms / every)}`;
    const held = this.#tracks.get(id);
    if (held && held.key === key) return held;
    const points = flatTrack(id, ms);
    const next = { key, past: trackPieces(points.filter((p) => p.ms <= ms)), future: trackPieces(points.filter((p) => p.ms >= ms)) };
    this.#tracks.set(id, next);
    return next;
  }

  #announceView(): void {
    const v = this.#view;
    const key = `${v.centerLon.toFixed(2)},${v.centerLat.toFixed(2)},${v.zoom.toFixed(2)}`;
    if (key === this.#viewSent) return;
    const first = this.#viewSent === "";
    this.#viewSent = key;
    if (!first) this.dispatchEvent(new CustomEvent("wakusei-flat-view", { detail: { center: v.centerLon, zoom: v.zoom }, bubbles: true, composed: true }));
  }

  // --- the marks, the words and the controls ---------------------------------------------------------------------------------------------------

  #at(item: Chosen | null): { x: number; y: number } | null {
    if (item === null) return null;
    if (item.kind === "orbiter") {
      const o = this.#orbs.find((one) => one.id === item.id);
      return o?.on ? { x: o.x, y: o.y } : null;
    }
    const mark = this.#marks.find((one) => one.place.id === item.id);
    return mark ? { x: mark.x, y: mark.y } : null;
  }

  /** The rings round the chosen and the hovered orbiter or place, and the name beside the one pointed at: a few DOM nodes moved, so they never ask for a draw of the dots. */
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
    // the words, and the flag of a landing site's country when the page asks for flags; made again only when they change
    const words = this.#describe(item);
    const code = item.kind === "place" && this.hasAttribute("site-flags") ? flagCodeOf(siteOf(item.id)?.country) : undefined;
    const key = `${code ?? ""}|${words}`;
    if (tip.dataset["key"] !== key) {
      tip.dataset["key"] = key;
      if (code === undefined) tip.textContent = words;
      else {
        const flag = this.ownerDocument.createElement("hata-flag");
        flag.className = "flag";
        flag.setAttribute("code", code);
        flag.setAttribute("border", "");
        flag.setAttribute("aria-hidden", "true");
        tip.replaceChildren(flag, words);
      }
    }
    const wide = tip.offsetWidth;
    const left = where.x + 14 + wide > this.#view.width ? Math.max(0, where.x - 14 - wide) : where.x + 14;
    const top = Math.max(0, Math.min(this.#view.height - tip.offsetHeight, where.y - 10));
    tip.style.transform = `translate(${left.toFixed(1)}px,${top.toFixed(1)}px)`;
  }

  #nameOfBody(lang: FlatLang): string {
    return BODIES[this.#body].name[lang];
  }

  #describe(item: Chosen): string {
    const lang = this.language;
    if (item.kind === "orbiter") {
      const o = this.#orbs.find((one) => one.id === item.id);
      return say(lang, "announceOrbiter", { name: orbiterName(item.id, lang), body: this.#nameOfBody(lang), altitude: o ? Math.round(o.altitudeKm).toLocaleString(lang) : "", note: o?.dim ? say(lang, "approximate") : "" });
    }
    const place = this.#placeIds.get(item.id);
    if (!place) return item.id;
    return say(lang, "announcePlace", { name: place.name[lang], kind: say(lang, `kind_${place.kind}`), body: this.#nameOfBody(lang), lat: coordinateText(lang, "lat", place.lat), lon: coordinateText(lang, "lon", place.lon) });
  }

  #showMessage(): void {
    const msg = this.#msg;
    if (!msg) return;
    msg.textContent = this.#imageFailed ? say(this.language, "mapMissing") : "";
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
    const msg = Object.assign(d.createElement("p"), { className: "msg" });
    msg.setAttribute("role", "status");
    const live = Object.assign(d.createElement("p"), { className: "sr", id: "live" });
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    const help = Object.assign(d.createElement("p"), { className: "sr", id: "help" });
    dots.setAttribute("aria-describedby", "help live");
    const flagLayer = Object.assign(d.createElement("div"), { className: "flags", hidden: true });
    stage.append(map, flagLayer, dots, selRing, hovRing, tip, msg);
    this.#flagLayer = flagLayer;
    root.append(bar, stage, live, help);
    this.#bar = bar;
    this.#stage = stage;
    this.#mapCanvas = map;
    this.#dotCanvas = dots;
    this.#selRing = selRing;
    this.#hovRing = hovRing;
    this.#tip = tip;
    this.#msg = msg;
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
    const all = ["centre", "zoom", "footprint", "track", "chips"];
    if (raw === "" || raw === "all") return new Set(all);
    return new Set(raw.split(/[\s,]+/).map((one) => (one === "center" ? "centre" : one)));
  }

  /** The words the map and the buttons use, made again when the language, the body, the places or the home change. */
  #words(): void {
    const bar = this.#bar;
    const dots = this.#dotCanvas;
    if (!bar || !dots) return;
    const lang = this.language;
    const wants = this.#wants();
    dots.setAttribute("aria-label", say(lang, "map", { body: this.#nameOfBody(lang) }));
    (this.shadowRoot!.querySelector("#help") as HTMLElement).textContent = say(lang, "help");
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", say(lang, "controls"));
    const button = (act: string, label: string, extra = ""): string => `<button type="button" data-act="${act}"${extra}>${escape(label)}</button>`;
    const rows: string[] = [];
    const first: string[] = [];
    if (wants.has("centre")) {
      this.#info.centres.forEach((c, i) => first.push(button("centre", say(lang, c.say), ` data-lon="${c.lon}" data-i="${i}" aria-label="${escape(say(lang, "centreOn", { where: say(lang, c.say) }))}" aria-pressed="false"`)));
      if (Number.isFinite(finite(this.getAttribute("home-lon"), Number.NaN))) first.push(button("home", say(lang, "myPlace"), ` aria-label="${escape(say(lang, "centreHome"))}" aria-pressed="false"`));
    }
    first.push(`<span class="gap"></span>`);
    if (wants.has("zoom")) first.push(button("zoomout", "−", ` aria-label="${escape(say(lang, "zoomOut"))}"`), button("zoomin", "+", ` aria-label="${escape(say(lang, "zoomIn"))}"`));
    if (wants.has("footprint")) first.push(button("footprint", say(lang, "footprint"), ` aria-pressed="false"`));
    if (wants.has("track")) first.push(button("track", say(lang, "groundTrack"), ` aria-pressed="false"`));
    if (first.length > 1) rows.push(`<div class="row">${first.join("")}</div>`);
    if (wants.has("chips")) {
      const counts = new Map<PlaceLayer, number>();
      for (const place of this.#places) counts.set(layerOf(place.kind), (counts.get(layerOf(place.kind)) ?? 0) + 1);
      const chip = (act: string, key: string, label: string, n: number): string => `<button type="button" class="chip" data-act="layer" data-layer="${act}" aria-pressed="false"><span class="swatch" data-key="${key}"></span>${escape(label)} <span class="n">${n.toLocaleString(lang)}</span></button>`;
      const chips = [chip("orbiters", "orbiters", say(lang, "orbiters"), this.#info.orbiters.filter((id) => orbiterElements(id) !== undefined).length)];
      for (const layer of ["landing", "crash", "planned", "feature"] as const) if ((counts.get(layer) ?? 0) > 0 || this.#places.length === 0) chips.push(chip(layer, LAYER_WORD[layer], say(lang, layer), counts.get(layer) ?? 0));
      rows.push(`<div class="row chips" role="group" aria-label="${escape(say(lang, "layersFilter"))}">${chips.join("")}</div>`);
    }
    bar.innerHTML = rows.join("");
    // colours go on through the CSS object model: an inline style attribute in the markup would be refused by a strict Content-Security-Policy
    const swatches: Record<string, string> = { orbiters: "#ffd23f", landing: "#ffffff", crash: "#ff8a65", planned: "#b9a7ff", feature: "#9aa5b1" };
    bar.querySelectorAll<HTMLElement>(".swatch").forEach((swatch) => swatch.style.setProperty("--c", swatches[swatch.dataset["key"] ?? ""] ?? "#9aa5b1"));
    this.#sync();
  }

  /** Bring the pressed states of the buttons and chips up to date without making them again (a reader may be using one). */
  #sync(): void {
    const bar = this.#bar;
    if (!bar) return;
    const home = finite(this.getAttribute("home-lon"), Number.NaN);
    bar.querySelectorAll<HTMLElement>('[data-act="centre"]').forEach((b) => b.setAttribute("aria-pressed", String(Math.abs(wrapLongitude(this.#view.centerLon - Number(b.dataset["lon"]))) < 0.5)));
    bar.querySelectorAll('[data-act="home"]').forEach((b) => b.setAttribute("aria-pressed", String(Number.isFinite(home) && Math.abs(wrapLongitude(this.#view.centerLon - home)) < 0.5)));
    bar.querySelectorAll('[data-act="footprint"]').forEach((b) => b.setAttribute("aria-pressed", String(this.#footprint)));
    bar.querySelectorAll('[data-act="track"]').forEach((b) => b.setAttribute("aria-pressed", String(this.#track)));
    bar.querySelectorAll<HTMLElement>('[data-act="layer"]').forEach((b) => {
      const layer = b.dataset["layer"]!;
      b.setAttribute("aria-pressed", String(layer === "orbiters" ? this.#showOrbiters : this.#layers.has(layer as PlaceLayer)));
    });
    bar.querySelector<HTMLButtonElement>('[data-act="zoomin"]')?.toggleAttribute("disabled", this.#view.zoom >= MAX_ZOOM);
    bar.querySelector<HTMLButtonElement>('[data-act="zoomout"]')?.toggleAttribute("disabled", this.#view.zoom <= 1);
    if (this.#dotCanvas) this.#dotCanvas.toggleAttribute("data-zoomed", this.#view.zoom > 1);
  }

  #onBar = (event: Event): void => {
    const target = (event.target as Element | null)?.closest<HTMLElement>("button[data-act]");
    if (!target || target.hasAttribute("disabled")) return;
    const act = target.dataset["act"];
    const v = this.#view;
    if (act === "centre") this.#setView({ ...v, centerLon: Number(target.dataset["lon"]) });
    else if (act === "home") {
      const home = this.#home();
      this.#setView({ ...v, centerLon: finite(this.getAttribute("home-lon"), 0), centerLat: v.zoom > 1 && home ? home.lat : v.centerLat });
    } else if (act === "zoomin") this.#setView(zoomAbout(v, 1.6));
    else if (act === "zoomout") this.#setView(zoomAbout(v, 1 / 1.6));
    else if (act === "footprint") {
      this.#footprint = !this.#footprint;
      this.#sync();
      this.#request();
    } else if (act === "track") {
      this.#track = !this.#track;
      this.#tracks.clear();
      this.#sync();
      this.#request();
    } else if (act === "layer") {
      const layer = target.dataset["layer"]!;
      if (layer === "orbiters") this.#showOrbiters = !this.#showOrbiters;
      else if (this.#layers.has(layer as PlaceLayer)) this.#layers.delete(layer as PlaceLayer);
      else this.#layers.add(layer as PlaceLayer);
      // a choice whose mark has just gone is let go
      if (this.#selected?.kind === "place" && !this.#layers.has(layerOf(this.#placeIds.get(this.#selected.id)?.kind ?? "feature"))) this.#selected = null;
      if (this.#selected?.kind === "orbiter" && !this.#showOrbiters) this.#selected = null;
      this.#mapKey = "";
      this.#sync();
      this.#request();
      this.#schedule();
      this.dispatchEvent(new CustomEvent("wakusei-flat-filter", { detail: { orbiters: this.#showOrbiters, layers: [...this.#layers] }, bubbles: true, composed: true }));
    }
  };

  #setView(view: FlatView): void {
    this.#view = clampView(view);
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

  /** The orbiter or mark drawn nearest to a point, within `reach` pixels (an orbiter is favoured: it is the one that moves). */
  #hit(x: number, y: number, reach: number): Chosen | null {
    let best: Chosen | null = null;
    let gap = reach * reach;
    for (const o of this.#orbs) {
      if (!o.on) continue;
      const d = (o.x - x) ** 2 + (o.y - y) ** 2 - 12;
      if (d <= gap) {
        gap = d;
        best = { kind: "orbiter", id: o.id };
      }
    }
    for (const mark of this.#marks) {
      const d = (mark.x - x) ** 2 + (mark.y - y) ** 2;
      if (d <= gap) {
        gap = d;
        best = { kind: "place", id: mark.place.id };
      }
    }
    return best;
  }

  #pick(item: Chosen | null, via: FlatPick["via"]): void {
    let detail: FlatPick;
    if (item === null) detail = { kind: null, id: null, name: null, body: this.#body, lat: null, lon: null, altitudeKm: null, status: null, placeKind: null, via };
    else if (item.kind === "orbiter") {
      const o = this.#orbs.find((one) => one.id === item.id);
      detail = { kind: "orbiter", id: item.id, name: orbiterName(item.id, this.language), body: this.#body, lat: o?.lat ?? null, lon: o?.lon ?? null, altitudeKm: o?.altitudeKm ?? null, status: o?.status ?? null, placeKind: null, via };
    } else {
      const place = this.#placeIds.get(item.id);
      const site = siteOf(item.id);
      detail = { kind: "place", id: item.id, name: place?.name[this.language] ?? item.id, body: this.#body, lat: place?.lat ?? null, lon: place?.lon ?? null, altitudeKm: null, status: null, placeKind: place?.kind ?? null, via, ...(place ? { place } : {}), ...(site ? { site } : {}) };
    }
    this.dispatchEvent(new CustomEvent("wakusei-flat-pick", { detail, bubbles: true, composed: true }));
  }

  #choose(item: Chosen | null, via: FlatPick["via"]): void {
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
      // a pointer going over the map with no button down: the one under it is named
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
        this.#view = zoomAbout(this.#view, spread / drag.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
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
    const k = pixelsPerDegree(this.#view);
    this.#view = clampView({ ...this.#view, centerLon: this.#view.centerLon - (at.x - before.x) / k, centerLat: this.#view.centerLat + (at.y - before.y) / k });
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
    this.#setView(zoomAbout(this.#view, Math.exp(-event.deltaY * 0.01), at.x, at.y));
  };

  #onKey = (event: KeyboardEvent): void => {
    const key = event.key;
    if (key === "+" || key === "=") {
      event.preventDefault();
      this.#setView(zoomAbout(this.#view, 1.6));
      return;
    }
    if (key === "-" || key === "_") {
      event.preventDefault();
      this.#setView(zoomAbout(this.#view, 1 / 1.6));
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
    // the orbiters and marks on show, from the left of the map to the right
    const list: { item: Chosen; x: number; y: number }[] = [];
    for (const o of this.#orbs) if (o.on) list.push({ item: { kind: "orbiter", id: o.id }, x: o.x, y: o.y });
    for (const m of this.#marks) list.push({ item: { kind: "place", id: m.place.id }, x: m.x, y: m.y });
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
}

declare global {
  interface HTMLElementTagNameMap {
    "wakusei-flat": WakuseiFlat;
  }
}
