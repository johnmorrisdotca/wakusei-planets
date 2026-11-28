// <wakusei-body>: a body of the solar system as a web component. `look="line"` is an SVG and needs nothing else. `realistic` and `painted` are drawn with three.js through
// kazoku-ui's shared renderer (one WebGL context for the whole page), and need the body's own entry point loaded (`@johnmorrisdotca/wakusei-planets/jupiter`). It draws only when
// something changes, at most 30 times a second while it moves, and nothing while it is out of sight or the tab is hidden. A reader who prefers reduced motion gets a slower turn; `turn="0"` is the only stop.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { carryControls, type ElementControls } from "@johnmorrisdotca/kazoku-ui/view-controls";
import "./tables/ceres.ts";
import "./tables/dwarfs.ts";
import { loadMinorTables, loadMoonTheory } from "./tables/lazy.ts";
import { orbitPath, type Apparent } from "./ephemeris.ts";
import { BODIES, MINOR_IDS, type BodyFacts, type BodyId, type Look, type MoonId } from "./facts.ts";
import { extentOf, ROOM } from "./scene/extent.ts";
import { createGate, frameCap, type Gate } from "./gate.ts";
import { lineSvg, type LineOptions } from "./line.ts";
import { inCutOpening, interiorDepthHeading, interiorOf, type CutSize } from "./interior.ts";
import { rowsForInterior } from "./interior-profile.ts";
import { interiorSectionSvg } from "./interior-line.ts";
import { stellarExample } from "./stellar-interiors.ts";
import { starLook, type StarLook, type StarNumbers } from "./star.ts";
import { starLineSvg } from "./star-line.ts";
import { detailOf, lookOf, starLookOf } from "./scene/look.ts";
import { createLive, defaultTurn, REDUCED_TURN, type LiveFrame, type LiveRequest } from "./live.ts";
import { mapSourceFor, texturePaths, tilesBase } from "./scene/textures.ts";
import type { Credit, DataSource } from "./data-door.ts";
import { createDoorHost, type DoorHost } from "./door/host.ts";
import { ownCredit } from "./door/own.ts";
export { TEXTURE_BASE, TEXTURE_FAR_BASE, TILES_BASE } from "./scene/textures.ts";
import { mapWidthOf, ringWidthOf, zoomLimit } from "./scene/reach.ts";
import { viewPose } from "./scene/tumble.ts";
import type { DetailStats } from "./scene/detail.ts";
import type { TileLevel } from "./scene/tiles.ts";
import { createBodyItem, type BodyScene, type MoonDraw, type SceneState, type ThreeParts } from "./scene/body.ts";
import { estimatedRock, estimatedRockLine } from "./scene/estimated-rock.ts";
import { NAME_LABEL_ATTRIBUTES, nameLabelKey, nameLabelText, readNameLabel, type NameLabelOptions } from "./scene/name-label.ts";
import { bodyHandsOn, passLineView } from "./body-hands.ts";
import { delegates, onRegister } from "./scene/store.ts";
import { setThreeLoader, takeRenderer, type ContextState } from "./scene/shared.ts";
import { cross, RAD, turn as turnVec, type Vec3 } from "./vec.ts";
import { findPlace, PLACE_BODIES, type Place, type PlaceBody } from "./places.ts";
import { marksToShow, readPlaceLayers, readSurfaceNames, surfacePoint, turnToPlace, type PlaceLayer } from "./place-marks.ts";
import { createPlaceLayer, onPlacesLoader, placesLoader, type PlaceLayerView } from "./scene/place-layer.ts";
import { MOON_FILTER_ATTRIBUTES, normalizeMoonFilter, readMoonFilter, type MoonFilter } from "./moon-filters.ts";
import type { MoonsChoice } from "./space/moon-settings.ts";

export { setThreeLoader };
export { placeLine, setPlacesLoader } from "./scene/place-layer.ts";
export type { MoonDiscoveryRange, MoonDirection, MoonFilter, MoonSizeClass, MoonStatus } from "./moon-filters.ts";

/**
 * The moon clicked in a planet view, from the `wakusei-moon-select` event.
 * @example
 * ```ts no-run
 * import type { WakuseiMoonSelection } from "@johnmorrisdotca/wakusei-planets/element";
 * document.querySelector("wakusei-body")!.addEventListener("wakusei-moon-select", (event) => {
 *   const { id, host } = (event as CustomEvent<WakuseiMoonSelection>).detail;
 *   console.log(id, host);
 * });
 * ```
 */
export interface WakuseiMoonSelection {
  id: string;
  host: BodyId;
}

/**
 * What the element is doing: `line` (an SVG), `loading` (waiting for three.js or a picture, or for the element to come into sight: a still is made only for a picture on the screen, so one below the fold of a box that scrolls, a short card for instance, stays `loading` until it is scrolled to), `still` (a picture of the 3D look, nothing running), `live` (drawing), `lost` (the GPU took the context; it comes back by itself) or `unavailable` (no WebGL: the line drawing is shown).
 *
 * @example
 * ```ts no-run
 * import type { WakuseiState } from "@johnmorrisdotca/wakusei-planets/element";
 *
 * const done = (state: WakuseiState): boolean => state === "live" || state === "line";
 * console.log(done("still"));
 * ```
 */
export type WakuseiState = "line" | "loading" | "still" | "live" | "lost" | "unavailable";

const num = (value: string | null, fallback: number): number => {
  if (value === null || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** A device that should get the cheaper star: little memory or two cores or fewer. `quality="full"` or `quality="low"` on the element decides it instead. */
const weakDevice = (): boolean => {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { deviceMemory?: number });
  return nav !== undefined && ((nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2);
};

/** The attributes that carry a star's numbers beside `star`, and the number each is. */
const STAR_ATTRS = ["temperature-k", "radius-sun", "luminosity-class", "rotation-days", "activity", "oblateness", "inclination-deg", "corona", "variable-period-days", "variable-amplitude", "estimated"] as const;

const readLook = (value: string | null): Look => (value === "realistic" || value === "painted" || value === "illustrated" ? value : "line");

const readTime = (value: string | null): number | "now" | undefined => {
  if (value === null || value === "") return undefined;
  if (value === "now") return "now";
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
};

const vectorKey = (v: Vec3): string => `${v[0].toFixed(2)},${v[1].toFixed(2)},${v[2].toFixed(2)}`;

/** Keep the body in the picture: at least a quarter of its width stays inside the edge, however far the view is moved. `pan` is in half-widths of the picture. */
function clampPan(pan: number, extent: number, zoom: number): number {
  const half = extent / Math.max(0.05, zoom);
  const limit = 1 + 0.5 / half;
  return Math.max(-limit, Math.min(limit, pan));
}

/**
 * The zoom range of a body that carries its own controls. The floor is arbitrary: a tenth of Fit leaves room to see the whole body small. A line drawing is vector and has detail at any scale, so it goes to 50.
 * The shaded looks go as far as their detail does (`#limits`, `scene/reach.ts`): the real detail of a map runs out when a texel of it is wider than about a pixel and a half, and the generic detail the shader adds
 * (noise, so a body never goes smooth) carries a rocky body twice as far and a soft one (a gas giant) three times. The widest map of a body is its finest tile level when the tiles are found, else its 2048 picture, so
 * the limit of a body with tiles rises when they are found. No body goes below 8, the limit these looks had before the tiles, and none above 1000.
 */
const LINE_LIMITS = { zoomMin: 0.1, zoomMax: 50, tiltMax: 90 } as const;
const TEMPLATE = `<style>
:host { display: block; width: var(--wakusei-size, 320px); max-width: 100%; aspect-ratio: 1 / 1; position: relative; contain: layout style; }
#picture { display: contents; }
#stage { position: absolute; inset: 0; bottom: var(--cutaway-band, 0px); }
#cutaway-panel { position: absolute; z-index: 2; left: 8px; right: 8px; bottom: 8px; margin: 0; padding: 6px 8px; background: color-mix(in srgb, Canvas 88%, transparent); color: CanvasText; font: 12px/1.35 system-ui, sans-serif; }
:host([data-stellar-cut]) { aspect-ratio: auto; }
:host([data-stellar-cut]) #stage { position: relative; inset: auto; width: 100%; aspect-ratio: 1; max-height: 460px; }
:host([data-stellar-cut]) #cutaway-panel { position: relative; inset: auto; margin: 0 8px 8px; }
#picture:has(#stellar-detail:not([hidden])) { display: grid; grid-template-columns: minmax(0, 1fr) min(40%, clamp(104px, 25%, 192px)); align-items: center; padding-inline-end: 8px; }
#stellar-detail { display: grid; justify-items: center; gap: 6px; margin: 0; padding: 8px 4px; text-align: center; overflow-wrap: anywhere; font: 12px/1.35 system-ui, sans-serif; border: 1px solid color-mix(in srgb, CanvasText 24%, transparent); border-radius: 12px; color: CanvasText; background: color-mix(in srgb, Canvas 92%, transparent); }
#stellar-detail[hidden] { display: none; }
#stellar-detail svg { width: min(100%, 112px); height: auto; }
#stellar-detail strong, #stellar-detail [data-scale] { display: block; }
#stellar-detail [data-scale] { margin-top: 4px; }
#cutaway-panel[hidden] { display: none; }
#cutaway-heading { margin: 0 0 4px; font-weight: 600; }
#cutaway { margin: 0; padding: 0; list-style: none; }
#cutaway[hidden] { display: none; }
#cutaway li { display: grid; grid-template-columns: 12px 1fr; gap: 2px 8px; align-items: baseline; }
#cutaway li[data-empty], #cutaway li[data-note] { display: block; }
#cutaway li[data-note] { margin-top: 4px; }
:host([data-stellar-cut]) [data-name] { font-weight: 600; }
:host([data-stellar-cut]) [data-depth] { font-variant-numeric: tabular-nums; }
#cutaway [data-swatch] { width: 12px; height: 12px; }
#stage svg { display: block; width: 100%; height: 100%; }
#estimate { position: absolute; z-index: 2; left: 2px; right: 2px; bottom: 1px; margin: 0; max-height: 2.4em; overflow: hidden; text-align: center; font: 10px/1.2 system-ui, sans-serif; color: inherit; pointer-events: none; }
#estimate[hidden] { display: none; }
:host([data-shape="estimated"]) #stage { bottom: 22px; }
#moon-name { position: absolute; z-index: 2; bottom: 8px; left: 50%; transform: translateX(-50%); margin: 0; padding: 2px 6px; max-width: 90%; background: Canvas; color: CanvasText; font: 12px system-ui, sans-serif; pointer-events: none; }
#moon-name[hidden] { display: none; }
</style><div id="picture"><div id="stage"></div><figure id="stellar-detail" hidden></figure></div><p id="estimate" hidden></p><p id="moon-name" hidden></p><div id="cutaway-panel" hidden><p id="cutaway-heading" hidden></p><ol id="cutaway" hidden></ol></div>`;

/**
 * The `<wakusei-body>` custom element: a body of the solar system, drawn in a look.
 *
 * Attributes: `body` (a name, such as `jupiter`), `look` (`line`, `realistic` or `painted`), `size` (pixels across), `time` (`now` or an ISO date: the body as the Earth sees it then; leave it out for a portrait),
 * `tilt`, `pitch`, `phase` and `meridian` (a portrait's pose, degrees), `turn` (a portrait turns this many degrees a second; left out, 12 a second, backwards when the body is, and a date keeps its orientation and adds this turn; `live="off"` stays still unless this is set; `0` stays still; reduced motion keeps a quarter of it), `rate` (simulated seconds for each real second), `moons` (draw the planet's moons on their orbits),
 * `range` (planet radii the moons picture reaches), `scale-to` (draw to scale with another body), `span-km` (draw to scale: the half-width of the picture in kilometres, the same in every picture of a lineup), `live` (`always`, `hover` or `off`: when it takes the page's one WebGL context), `texture-base` (where the surface pictures are) and `lang` (`en` or `ja`).
 * A `body` that names a catalogue moon the package does not draw in full (such as `himalia`, or `S/2003 J 18`) is an estimated rock: the size is the catalogue radius, the shape is a guess from that id, and the picture says the shape is estimated. A size worked out from the brightness says so. Any other unknown name stays the Earth.
 *
 * It carries the shared view controls itself: a drag turns the body, two fingers pinch, Ctrl, Command or Alt with the wheel zooms (the plain wheel scrolls the page at Fit), the arrow keys, + and - and 0 work once it is focused.
 * `controls="none"` turns them off, and `live="off"` (a still, a thumbnail) starts without them (`controls` with no value brings them back). `still-size` is the long side of the still in CSS pixels; the still is made at that times the device pixel ratio (up to 3), where the page's default is 160 device pixels, so a still shown large is sharp. `zoom-min` and `zoom-max` set the range (0.1 to 50 for the line drawing; for the shaded looks 0.1 up to where the body's detail runs out, 8 at least and 1000 at most: see the close zoom guide); a `<kazoku-view-controls for="...">` takes over and reads it.
 * Close up, `tiles` is where the finer map tiles are (a folder address; `off` for none; by default the demo site's, unless `texture-base` names your own pictures): a window of them is laid over the painted map for the part in view and let go when it is not, and the zoom range of a body with tiles grows with them.
 * Whatever moves the view, `setView` sends a `wakusei-view` event with its `yaw`, `tilt`, `roll`, `zoom`, `panX` and `panY`.
 * `earth-from="chikyu"` (the Earth in the shaded looks only, and only when the page has imported chikyu-earth's realistic element) draws the Earth with chikyu-earth's `<chikyu-earth-realistic>`: day and night by the real Sun, lights, clouds and air, at `meridian` and, when there is a `time`, held at that date; `earth-texture-base` is the folder of its pictures. It is the other package's picture, so tilt, moons, places and the shared view controls do not apply to it.
 * `cutaway` (off when absent or `off`) opens a quarter of the globe toward the camera. The shells are true spheres at the model's radii and the opening stays toward the camera, so the rims stay round; the Sun is whole discs. The legend names the layers. On a narrow picture it sits below the body. Set its value to `half` or `quarter` for a filled cut in a shaded look or a cross-section in the line look. Add `cutaway-flow` to play illustrative motion for supported layers. Only a body with sourced figures is cut; the others stay whole and the legend says so. See the guide "A cutaway of the interior".
 * `places` marks the places on the body in the shaded looks, by layer (`landing`, `crash`, `planned`, `feature`; the lists come from `setPlacesLoader`), with `wakusei-place` on a click and `goToPlace` to turn one to the middle: see the guide "Places on the Moon, Mars and 31 more bodies".
 * `body-label` writes the body's name on its globe in the shaded looks (`painted`, `etched`, `outline` or `burned`; absent for none), with `body-label-strength`, `-repeat`, `-latitude`, `-facing`, `-font`, `-fallback-font` and `-tone` (`auto`, `light` or `dark` letters: auto takes dark ones for a `painted` look on a light body) beside it, and the `bodyLabel` property takes the same as an object: see the guide "A name on the body".
 * A dated picture (a `time`, or `moons`) has a clock: `rate` is the simulated seconds for each real second, and `rate="0"` holds it, drawing nothing. While it runs (`rate` not 0), `wakusei-timechange` carries
 * `detail: { time, running: true }` (`time` is the moment shown in milliseconds since 1970; four times a second, once a second at real time; only while the tab is shown, whether or not the picture is on screen), and once with
 * `running: false` when the clock is held: a page writes the date into its date box from it. The `time` property reads the moment shown, and `undefined` for a portrait with no date.
 *
 * @example
 * ```ts no-run
 * import { WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";
 * import "@johnmorrisdotca/wakusei-planets/saturn";
 *
 * const saturn = document.createElement("wakusei-body") as WakuseiBody;
 * saturn.setAttribute("body", "saturn");
 * saturn.setAttribute("look", "realistic");
 * document.body.append(saturn);
 * ```
 */
export class WakuseiBody extends HTMLElement {
  static observedAttributes = ["body", "star", "quality", ...STAR_ATTRS, "look", "size", "time", "tilt", "pitch", "phase", "meridian", "turn", "rate", "moons", "moon-orbits", ...MOON_FILTER_ATTRIBUTES, "range", "scale-to", "span-km", "fit", "live", "still-size", "texture-base", "texture-far-base", "tiles", "data", "lang", "labels", "places", "surface-names", "site-flags", "cutaway", "cutaway-flow", "earth-from", "earth-texture-base", ...NAME_LABEL_ATTRIBUTES];

  #stage!: HTMLElement;
  #moonModule: typeof import("./scene/body-moons.ts") | undefined;
  #moonLoading = false;
  #moonFilter: MoonFilter = {};
  #moonFilterKey = "{}";
  #moonSelection: ReturnType<typeof import("./scene/body-moons.ts").bodyMoonSelection> | undefined;
  #moonSelectionKey = "";
  #moonPointer: { id: number; x: number; y: number } | undefined;
  #moonPoints: { state: SceneState; dots: readonly { id: string; label: string; ja: string | null; at: Vec3; color: string }[] } | undefined;
  #state: WakuseiState = "line";
  #renderer: SharedRenderer<ThreeParts> | undefined;
  #release: (() => void) | undefined;
  #view: View | undefined;
  #viewKey = "";
  #viewSig = "";
  #delegateEl: HTMLElement | undefined;
  #delegateKind = "";
  /** Whether the body is another package's drawing at the moment: the Earth's line look (chikyu-earth's globe), or its realistic Earth in a shaded look when the page asked for it (`earth-from="chikyu"`). */
  #delegating(): "line" | "shaded" | undefined {
    if (this.#cutSize() !== undefined) return undefined;
    const delegate = delegates.get(this.body);
    if (delegate === undefined) return undefined;
    if (this.look === "line") {
      const moons = this.moons;
      return moons !== null && (moons === "all" || this.#moonFilterKey !== "{}" || this.getAttribute("moon-orbits") === "off") ? undefined : "line";
    }
    return this.body === "earth" && this.getAttribute("earth-from") === "chikyu" && delegate.shaded !== undefined ? "shaded" : undefined;
  }
  #stilled = false;
  #wantLive = false;
  #visible = typeof IntersectionObserver !== "function";
  #io: IntersectionObserver | undefined;
  #tick: ReturnType<typeof setTimeout> | undefined;
  #clockTimer: ReturnType<typeof setTimeout> | undefined;
  #clockRan = false;
  #refreshQueued = false;
  #gate: Gate | undefined;
  #live = createLive();
  #startedAt = 0;
  #start: number | undefined;
  #yaw = 0;
  #tilt = 0;
  #roll = 0;
  #pitchDelta = 0;
  /** True while the shared controller tumbles the view about all three axes: the pose is then drawn so it follows the controller's orientation (`scene/tumble.ts`). */
  #tumble = false;
  #lastAnchors = -1;
  #zoom = 1;
  #panX = 0;
  #panY = 0;
  #orbits = new Map<string, Float32Array>();
  #orbitKey = "";
  #textureWidth = 0;
  #sceneState: SceneState | undefined;
  #unsub: (() => void) | undefined;
  #reduce = false;
  #motionPreference: MediaQueryList | undefined;
  #flowSince: number | undefined;
  #flowHeld = 0;
  #hands: ElementControls | undefined;
  #handsKey = "";
  #limitKey = "";
  #tileLevels: readonly TileLevel[] | undefined;
  #tiles: DetailStats | undefined;
  #bodyLabel: NameLabelOptions | null | undefined;
  #placeLayer: PlaceLayerView | undefined;
  #placeList: { body: BodyId; list: readonly Place[] } | undefined;
  #placeLoading: BodyId | undefined;
  #placeGlide = 0;
  #placeResize: ResizeObserver | undefined;
  #placeHeard: (() => void) | undefined;
  #door: DoorHost = createDoorHost(
    this,
    {
      own: () => {
        // the body's own pictures and, where a window of the package's own tiles is on it, those
        const own: Credit[] = [];
        if (this.look !== "line" && this.#view !== undefined && this.#textureWidth > 0) own.push(ownCredit("wakusei-pictures", 1));
        const shown = (this.#view?.scene as BodyScene | undefined)?.detail;
        if (shown?.source !== undefined && this.#door.book.get(shown.source.id) === undefined) own.push(ownCredit(shown.source.id, shown.used));
        return own;
      },
      used: () => {
        const shown = (this.#view?.scene as BodyScene | undefined)?.detail;
        return shown?.source === undefined ? new Map() : new Map([[shown.source.id, shown.used]]);
      },
    },
    { kinds: ["tiles"] },
    // a source added, removed or switched, or a tile arrived: look at the view again (the window is chosen at a sync), then draw
    () => {
      if (this.#view?.live === true) this.#sync();
      this.#view?.invalidate();
    },
  );
  #hover = (): void => void this.goLive();
  #onContext = (state: ContextState): void => {
    if (state === "unavailable") this.#set("unavailable");
    else if (state === "lost") this.#set("lost");
    else if (this.#view?.live) this.#set("live");
  };
  #onMotionChange = (): void => {
    if (!this.hasAttribute("cutaway-flow")) return;
    this.#syncCutawayFlow();
    this.#queue();
  };
  #onHidden = (): void => {
    this.#syncCutawayFlow();
    if (document.visibilityState === "hidden") this.#stopTick();
    else this.#resume();
    this.#syncClock();
  };

  /**
   * The outside sources of map for this body (the data door): each carries its own licence and credit, and a map source for the body takes the place of the folder of tiles. Assign a list to replace them; a source that
   * `validateSource` refuses, or that is not a map source, throws a `TypeError` and changes nothing. A property, not an attribute: data is not text.
   */
  get sources(): readonly DataSource[] {
    return this.#door.sources();
  }
  set sources(list: readonly DataSource[]) {
    this.#door.setSources(list);
  }
  /** Adds one source (checked at once: a `TypeError` for an empty credit, no licence, a clashing id or a source that is not a map source). Returns the function that removes it. */
  addSource(source: DataSource): () => void {
    return this.#door.book.addSource(source);
  }
  /** Removes a source by id: its loads are aborted and its tiles freed, and its credit goes. Returns whether there was one. */
  removeSource(id: string): boolean {
    return this.#door.book.removeSource(id);
  }
  /** Switches a source off (`false`) or on, for a layers panel. Off aborts its loads, frees its tiles and drops its credit. */
  enableSource(id: string, on: boolean): void {
    this.#door.book.enableSource(id, on);
  }
  /**
   * The sources whose data is in the last drawn frame, the package's own first: the surface picture, the finer map tiles when a window of them is on the body, and each source of yours that gave tiles. `creditLine(credits, "en" | "ja")`
   * from `@johnmorrisdotca/wakusei-planets/door` writes them as a line with the licences. `wakusei-creditschange` fires when this set changes (not at each frame) with `detail: { credits }`.
   */
  credits(): Credit[] {
    return this.#door.credits();
  }
  /** What the sources have done: tile loads started, failed and refused, and the bytes held. */
  get sourceStats(): ReturnType<DoorHost["book"]["stats"]> {
    return this.#door.book.stats();
  }

  /** The moment the dated picture shows, in milliseconds since 1970, or `undefined` for a portrait with no date. */
  get time(): number | undefined {
    const r = this.#request();
    return r.start === undefined ? undefined : r.start + (performance.now() - r.startedAt) * r.rate;
  }

  /** The radius of the body's disc on the screen in CSS pixels, at the picture's own size: what `grab-radius` on the shared view controls wants for a drag that keeps the touched point under the pointer. */
  get discRadius(): number {
    const { width, height } = (this.#cutSize() === undefined ? this : (this.#stage ?? this)).getBoundingClientRect();
    return (Math.min(width, height) / 2) * this.#fill();
  }
  get body(): BodyId {
    if (this.hasAttribute("star")) return "sun";
    const id = this.getAttribute("body") as BodyId | null;
    return id !== null && id in BODIES ? id : "earth";
  }
  /**
   * The star drawn instead of a body, when the `star` attribute is there: its numbers with the defaults filled in, its colour, the turn it shows, and `parts`, which says what is measured and what is invented.
   * `undefined` for a body, or while the star's numbers are not complete (`data-error` says what is wrong). Set it to an object of numbers to draw a star, or to `null` to go back to the body.
   */
  get starLook(): StarLook | undefined {
    return this.#star();
  }
  set star(numbers: StarNumbers | string | null | undefined) {
    if (numbers === null || numbers === undefined) this.removeAttribute("star");
    else this.setAttribute("star", typeof numbers === "string" ? numbers : JSON.stringify(numbers));
  }
  get star(): StarNumbers | undefined {
    return this.#star()?.numbers;
  }
  get look(): Look {
    return readLook(this.getAttribute("look"));
  }
  /**
   * The name written on the body's globe in the shaded looks, as an object (`{ look: "painted", strength: 0.5, repeat: "once", latitude: 0, facing: false, font: "Michroma", fallbackFont: "" }`), or `null` for none.
   * Set, it takes the place of the `body-label` attributes; set to `undefined` the attributes are read again. The text is the body's own name in the element's `lang`, in capitals in English.
   */
  get bodyLabel(): NameLabelOptions | null {
    return this.#bodyLabel !== undefined ? this.#bodyLabel : readNameLabel(this);
  }
  set bodyLabel(value: NameLabelOptions | null | undefined) {
    this.#bodyLabel = value;
    this.#labelHeld = undefined;
    this.#lastAnchors = -1;
    this.#queue();
  }
  /**
   * The layers of places marked on the body in the shaded looks: any of `landing` (the crewed landings, landers and rovers), `crash` (the crash, impact and atmospheric-entry sites), `planned` (announced landings) and
   * `feature` (named features), from the `places` attribute (`places="landing crash"`; `places` alone or `all` for every layer). A body with no places (see `PLACE_BODIES` from `/places`) shows none. Setting it writes the attribute.
   */
  get places(): PlaceLayer[] {
    return readPlaceLayers(this.getAttribute("places"));
  }
  set places(layers: readonly PlaceLayer[] | null) {
    if (layers === null || layers.length === 0) this.removeAttribute("places");
    else this.setAttribute("places", layers.join(" "));
  }
  /**
   * Whether the places carry their country's flag (the attribute `site-flags`): the tip of a place with a country shows its flag, and on a body close enough on the screen (110 pixels of radius) the landing sites (`LANDING_SITES` from
   * `/landing-sites`) are named beside their dots, each with its flag. The flag is `<hata-flag>` from `@johnmorrisdotca/hata`, which the page imports itself (`import "@johnmorrisdotca/hata/element/define"`); until it is defined the name stands alone. Needs `places`.
   * The `wakusei-place` event's detail carries the landing site as `site` where the place is one. Setting it writes the attribute.
   */
  get siteFlags(): boolean {
    return this.hasAttribute("site-flags");
  }
  set siteFlags(on: boolean) {
    this.toggleAttribute("site-flags", on);
  }
  /** The marks laid on the body now: each place's id, its layer and where its mark is, in CSS pixels from the picture's top left. */
  get placesShown(): readonly { id: string; layer: PlaceLayer; x: number; y: number }[] {
    return this.#placeLayer?.shown ?? [];
  }

  /**
   * Which point of the body is in the middle of the picture, as a longitude (east) and latitude (north) in the body's own fixed frame: what the camera looks straight down on, with the view's turn, tilt
   * and roll and the pose of the date (or the portrait) counted in. `faceTo` is the other way round. `undefined` for a star.
   *
   * @returns The point, or `undefined`.
   *
   * @example
   * ```ts no-run
   * import type { WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";
   *
   * const body = document.querySelector<WakuseiBody>("wakusei-body")!;
   * console.log(body.subCameraPoint());
   * ```
   */
  subCameraPoint(): { lon: number; lat: number } | undefined {
    if (this.hasAttribute("star")) return undefined;
    const { pose } = this.#sceneOf(this.#frameNow());
    const east = cross(pose.pole, pose.meridian);
    return { lon: Math.atan2(east[2], pose.meridian[2]) / RAD, lat: Math.asin(Math.max(-1, Math.min(1, pose.pole[2]))) / RAD };
  }

  /**
   * Turn the body so a point of it (east longitude, north latitude, degrees) is in the middle of the disc: the turn `goToPlace` makes, for a point instead of a named place (at once for a still, for a reader who
   * prefers reduced motion, or with `smooth: false`); the zoom stays.
   *
   * @param point - The longitude and latitude to bring to the middle.
   * @param options - `smooth` (true by default).
   *
   * @example
   * ```ts no-run
   * import type { WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";
   *
   * document.querySelector<WakuseiBody>("wakusei-body")!.faceTo({ lon: 139.7, lat: 35.7 }, { smooth: false });
   * ```
   */
  faceTo(point: { lon: number; lat: number }, options: { smooth?: boolean } = {}): void {
    if (this.hasAttribute("star") || !Number.isFinite(point.lon) || !Number.isFinite(point.lat)) return;
    this.#turnTo(point.lat, point.lon, options.smooth);
  }

  /**
   * Turn the body so a place is in the middle of the disc, at a pace you can follow while the picture is live (at once for a still, for a reader who prefers reduced motion, or with `smooth: false`); the zoom stays. The place is an id (`moon/apollo-11-lunar-module`),
   * or an English or Japanese name. A body that turns by itself carries the place on from there (`turn="0"` keeps it). Resolves the place, or `undefined` when the body has no place by that name.
   *
   * @param text - The place's id or name.
   * @param options - `smooth` (true by default).
   * @returns The place, once the turn has started.
   */
  async goToPlace(text: string, options: { smooth?: boolean } = {}): Promise<Place | undefined> {
    const list = await this.#loadPlaces();
    const place = list === undefined ? undefined : findPlace(list, text);
    if (place === undefined) return undefined;
    this.#turnTo(place.lat, place.lon, options.smooth);
    return place;
  }

  /** Turn the body so a point of it (latitude, east longitude, degrees) is in the middle of the disc: the glide of `goToPlace` and `faceTo`. */
  #turnTo(lat: number, lon: number, smooth: boolean | undefined): void {
    const frame = this.#frameNow();
    const aim = turnToPlace(frame.pose.pole, frame.pose.meridian, lat, lon);
    const to = { yaw: aim.yaw, tilt: this.#pitchDelta - aim.tilt };
    const from = { yaw: this.#yaw, tilt: this.#tilt };
    // the shorter way round
    to.yaw = from.yaw + ((((to.yaw - from.yaw + 180) % 360) + 360) % 360) - 180;
    const apply = (yaw: number, tilt: number, final: boolean): void => {
      const controller = this.#hands?.controller;
      if (controller !== undefined && !this.hasAttribute("data-kazoku-bar")) controller.set({ yaw, tilt }, final, "place");
      else this.setView({ yaw, tilt, roll: this.#roll, zoom: this.#zoom });
    };
    const glide = (this.#placeGlide += 1);
    // a still (not live) is made again for every change of view: it goes there at once
    if (smooth === false || this.#reduce || this.#view?.live !== true || typeof requestAnimationFrame !== "function") {
      apply(to.yaw, to.tilt, true);
      return;
    }
    const start = performance.now();
    const step = (): void => {
      if (glide !== this.#placeGlide || !this.isConnected) return;
      const k = Math.min(1, (performance.now() - start) / 900);
      const ease = k * k * (3 - 2 * k);
      apply(from.yaw + (to.yaw - from.yaw) * ease, from.tilt + (to.tilt - from.tilt) * ease, k >= 1);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** The body's list of places, loaded the first time it is asked for; `undefined` for a body that has none. */
  async #loadPlaces(): Promise<readonly Place[] | undefined> {
    const body = this.body;
    if (this.#placeList?.body === body) return this.#placeList.list;
    const load = placesLoader();
    if (load === undefined || this.hasAttribute("star") || !(PLACE_BODIES as readonly string[]).includes(body)) return undefined;
    const list = await load(body as PlaceBody);
    if (this.body === body) this.#placeList = { body, list };
    return list;
  }

  /** Lay the marks of the places over the picture as the scene state has it, or take them away. Draws nothing. */
  #markPlaces(state: SceneState | undefined = this.#sceneState): void {
    const layers = this.places;
    const names = readSurfaceNames(this.getAttribute("surface-names"));
    const shaded = this.look !== "line" && this.#view !== undefined && !this.hasAttribute("star");
    if ((!names.on && layers.length === 0) || !shaded || state === undefined) {
      if (this.#placeLayer !== undefined) {
        this.#placeLayer.dispose();
        this.#placeLayer = undefined;
        if (this.getAttribute("role") === "group") this.setAttribute("role", "img");
      }
      return;
    }
    const body = this.body;
    if (this.#placeList?.body !== body) {
      if (this.#placeLoading !== body && placesLoader() !== undefined && (PLACE_BODIES as readonly string[]).includes(body)) {
        this.#placeLoading = body;
        void this.#loadPlaces().then(() => {
          this.#placeLoading = undefined;
          if (this.#placeList?.body === body) this.#markPlaces();
        }, () => {
          this.#placeLoading = undefined;
        });
      }
      this.#placeLayer?.clear();
      return;
    }
    if (this.#placeLayer === undefined && this.shadowRoot !== null) {
      this.#placeLayer = createPlaceLayer(this.shadowRoot, {
        lang: () => (this.getAttribute("lang") === "ja" ? "ja" : "en"),
        flags: () => this.hasAttribute("site-flags"),
        pick: (place, site, at) => this.dispatchEvent(new CustomEvent("wakusei-place", { detail: { body, place, site, x: at.x, y: at.y }, bubbles: true, composed: true })),
      });
      // a picture with buttons in it is a group, not an image
      if (this.getAttribute("role") === "img") this.setAttribute("role", "group");
    }
    const w = this.#stage.clientWidth;
    const h = this.#stage.clientHeight;
    if (this.#placeLayer === undefined || w <= 0 || h <= 0) return;
    const aspect = w / h;
    const half = state.extent / Math.max(0.05, state.zoom);
    const halfW = aspect >= 1 ? half * aspect : half;
    const halfH = aspect >= 1 ? half : half / aspect;
    const left = state.panX * half - halfW;
    const top = state.panY * half + halfH;
    const facts = this.#facts();
    const ax = facts.axesKm;
    const size = this.#cutSize();
    const scale: Vec3 = size !== undefined ? [1, 1, 1] :
      ax ? [ax[1] / facts.radiusKm, ax[2] / facts.radiusKm, ax[0] / facts.radiusKm] : [1, 1 - facts.flattening, 1];
    const view = {
      centre: [0, 0, 0] as Vec3,
      radius: 1,
      pole: state.pose.pole,
      meridian: state.pose.meridian,
      scale,
      toward: [0, 0, 1] as Vec3,
      project: (p: Vec3) => ({ x: ((p[0] - left) / (2 * halfW)) * w, y: ((top - p[1]) / (2 * halfH)) * h }),
      width: w,
      height: h,
      radiusPx: (Math.min(w, h) / 2) * (state.zoom / state.extent),
    };
    const open = size !== undefined || (this.#cutawayOn() && this.body !== "sun" && interiorOf(this.body) !== undefined);
    const marks = marksToShow(this.#placeList.list, layers, view, facts.radiusKm, names, [], this.getAttribute("lang") === "ja" ? "ja" : "en").filter((mark) => !open || !inCutOpening(surfacePoint(view, mark.place.lat, mark.place.lon).point, size));
    this.#placeLayer.set(marks, (Math.min(w, h) / 2) * (state.zoom / state.extent));
  }

  /** What the element is doing now. */
  get state(): WakuseiState {
    return this.#state;
  }

  /** The planet's major moons, its entire catalogue, or no moons. A bare `moons` attribute keeps the major view. */
  get moons(): MoonsChoice | null {
    const value = this.getAttribute("moons");
    return value === null ? null : value.trim().toLowerCase() === "all" ? "all" : "major";
  }
  set moons(value: MoonsChoice | null) {
    if (value === null) this.removeAttribute("moons");
    else this.setAttribute("moons", value);
  }

  /** Which moons to show. The matching attributes are `moon-status`, `moon-size-class`, `moon-group`, `moon-direction` and `moon-discovered`. */
  get moonFilter(): MoonFilter {
    return normalizeMoonFilter(this.#moonFilter);
  }
  set moonFilter(value: MoonFilter) {
    const filter = normalizeMoonFilter(value);
    const key = JSON.stringify(filter);
    if (key === this.#moonFilterKey) return;
    this.#moonFilter = filter;
    this.#moonFilterKey = key;
    this.#hideMoonName();
    this.#syncMoonSelection();
    if (this.isConnected) this.#queue();
  }

  #syncMoonSelection(): void {
    const all = this.moons === "all";
    if (this.hasAttribute("star") || this.moons === null || (!all && this.#moonFilterKey === "{}")) {
      this.#moonSelection = undefined;
      this.#moonSelectionKey = "";
      return;
    }
    const key = `${this.body}|${this.moons}|${this.#moonFilterKey}`;
    if (this.#moonSelectionKey === key) return;
    if (this.#moonModule !== undefined) {
      this.#moonSelectionKey = key;
      this.#moonSelection = this.#moonModule.bodyMoonSelection(this.body, this.#moonFilter, all);
    } else if (this.isConnected && !this.#moonLoading) {
      this.#moonLoading = true;
      void import("./scene/body-moons.ts").then((module) => {
        this.#moonModule = module;
        this.#moonLoading = false;
        this.#syncMoonSelection();
        if (!this.isConnected) return;
        this.#refreshLimits();
        this.#queue();
      }, () => { this.#moonLoading = false; });
    }
  }

  #smallMoons(state: SceneState) {
    if (this.#moonPoints?.state === state) return this.#moonPoints.dots;
    const catalogue = state.moonCatalogue;
    const module = this.#moonModule;
    const dots = catalogue === undefined || module === undefined ? [] : catalogue.source.moons.map((moon) => ({
      id: moon.id,
      label: moon.label,
      ja: moon.ja,
      at: module.bodyMoonPoint(catalogue, moon.host, catalogue.source.position(moon, catalogue.time)),
      color: moon.newest ? "#fff1a6" : moon.colors.group,
    }));
    this.#moonPoints = { state, dots };
    return dots;
  }

  #pickedMoon(event: MouseEvent): { id: string; label: string } | undefined {
    const state = this.#sceneState;
    if (this.moons === null || state === undefined || this.#delegateEl !== undefined || this.#cutSize() !== undefined) return undefined;
    const box = this.#stage.getBoundingClientRect();
    const line = this.look === "line" || this.#state === "unavailable";
    const half = Math.min(box.width, box.height) / 2;
    const fit = line ? 0.94 : 1;
    const radius = half * fit / state.extent;
    const centreX = box.left + box.width / 2 - half * state.panX;
    const centreY = box.top + box.height / 2 + half * state.panY;
    const ja = this.getAttribute("lang") === "ja";
    let best: { id: string; label: string } | undefined;
    let distance = 10;
    const pick = (id: string, label: string, [x, y, z]: Vec3, zoom: number): void => {
      if (z < 0 && Math.hypot(x, y) < 1) return;
      const gap = Math.hypot(event.clientX - centreX - x * radius * zoom, event.clientY - centreY + y * radius * zoom);
      if (gap < distance) {
        best = { id, label };
        distance = gap;
      }
    };
    for (const moon of this.#smallMoons(state)) pick(moon.id, (ja ? moon.ja : null) ?? moon.label, moon.at, state.zoom);
    for (const moon of state.moons ?? []) pick(moon.id, BODIES[moon.id].name[ja ? "ja" : "en"], [moon.x, moon.y, moon.z], line ? 1 : state.zoom);
    return best;
  }

  #moonDown = (event: PointerEvent): void => {
    this.#moonPointer = undefined;
    if (this.moons === null || !event.isPrimary || event.button !== 0 || !event.composedPath().includes(this.#stage)) return;
    this.#moonPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  #showMoonName(moon?: { label: string }): void {
    const name = this.shadowRoot?.getElementById("moon-name");
    if (name === null || name === undefined) return;
    name.hidden = moon === undefined;
    if (moon !== undefined && name.textContent !== moon.label) name.textContent = moon.label;
  }
  #hideMoonName = (): void => this.#showMoonName();
  #moonHover = (event: PointerEvent): void => {
    const start = this.#moonPointer;
    if (start !== undefined && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) this.#moonPointer = undefined;
    if (event.buttons === 0 && event.pointerType !== "touch" && this.moons !== null) {
      this.#showMoonName(event.composedPath().includes(this.#stage) ? this.#pickedMoon(event) : undefined);
    }
  };
  #moonCancel = (): void => { this.#moonPointer = undefined; };
  #moonUp = (event: PointerEvent): void => {
    const start = this.#moonPointer;
    this.#moonPointer = undefined;
    if (start?.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) return;
    const moon = this.#pickedMoon(event);
    this.#showMoonName(moon);
    if (moon !== undefined) this.dispatchEvent(new CustomEvent<WakuseiMoonSelection>("wakusei-moon-select", { detail: { id: moon.id, host: this.body }, bubbles: true, composed: true }));
  };
  /** Numbers for a test or a status line: the state, the texture width in use and the renderer's own counts. */
  get stats(): { state: WakuseiState; textureWidth: number; anchors: number; renderer: SharedRenderer<ThreeParts>["stats"] | undefined; tiles: DetailStats | undefined; zoomMax: number | undefined; label: BodyScene["label"] | null } {
    return { state: this.#state, textureWidth: this.#textureWidth, anchors: this.#live.anchors, renderer: this.#renderer?.stats, tiles: (this.#view?.scene as BodyScene | undefined)?.detail ?? this.#tiles, zoomMax: this.#hands?.controller.limits.zoomMax, label: (this.#view?.scene as BodyScene | undefined)?.label ?? null };
  }

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = TEMPLATE;
    this.#stage = root.getElementById("stage")!;
    // The shared controls can capture a pointer to the host before it comes up.
    this.addEventListener("pointerdown", this.#moonDown, true);
    this.addEventListener("pointermove", this.#moonHover);
    this.addEventListener("pointerleave", this.#hideMoonName);
    this.addEventListener("pointercancel", this.#moonCancel);
    this.addEventListener("pointerup", this.#moonUp);
    this.#syncMoonSelection();
    this.#startedAt = performance.now();
    this.#door.book.ownOnly(this.getAttribute("data") === "own");
    this.#motionPreference = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined;
    this.#reduce = this.#motionPreference?.matches ?? false;
    this.#motionPreference?.addEventListener("change", this.#onMotionChange);
    this.#syncCutawayFlow();
    this.#clockFromAttributes();
    this.#stillSide();
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    this.#gate = createGate(1000 / frameCap(30, { deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, hardwareConcurrency: navigator.hardwareConcurrency }), () => this.#frame());
    if (typeof IntersectionObserver === "function") {
      this.#io = new IntersectionObserver((entries) => {
        const last = entries[entries.length - 1];
        if (last === undefined) return;
        this.#visible = last.isIntersecting;
        this.#syncCutawayFlow();
        if (this.#visible) {
          this.#still();
          this.#resume();
          if (this.look !== "line" && this.#view?.live !== true && this.#hasPriority()) void this.goLive();
        }
        else this.#stopTick();
      });
      this.#io.observe(this.#stage);
    }
    document.addEventListener("visibilitychange", this.#onHidden);
    this.#syncClock();
    this.#unsub = onRegister(() => {
      this.#carry();
      this.#queue();
    });
    this.#applyHover();
    for (const name of ["pointerdown", "wheel", "keydown"]) this.addEventListener(name, this.#measure, true);
    if (typeof ResizeObserver === "function") {
      this.#placeResize = new ResizeObserver(() => {
        this.#fitCutaway();
        if (this.#placeLayer !== undefined) this.#markPlaces();
      });
      this.#placeResize.observe(this.#stage);
    }
    this.#placeHeard = onPlacesLoader(() => {
      this.#placeList = undefined;
      this.#markPlaces();
    });
    this.#carry();
    this.#queue();
  }

  disconnectedCallback(): void {
    this.removeEventListener("pointerdown", this.#moonDown, true);
    this.removeEventListener("pointermove", this.#moonHover);
    this.removeEventListener("pointerleave", this.#hideMoonName);
    this.removeEventListener("pointercancel", this.#moonCancel);
    this.removeEventListener("pointerup", this.#moonUp);
    this.#moonCancel();
    clearTimeout(this.#clockTimer);
    this.#clockTimer = undefined;
    this.#motionPreference?.removeEventListener("change", this.#onMotionChange);
    this.#motionPreference = undefined;
    this.#flowSince = undefined;
    this.#flowHeld = 0;
    this.#stopTick();
    this.#gate?.cancel();
    this.#io?.disconnect();
    document.removeEventListener("visibilitychange", this.#onHidden);
    this.#unsub?.();
    this.#applyHover(false);
    for (const name of ["pointerdown", "wheel", "keydown"]) this.removeEventListener(name, this.#measure, true);
    this.#hands?.unbind();
    this.#hands = undefined;
    this.#handsKey = "";
    this.#disposeView(true);
    this.#placeLayer?.dispose();
    this.#placeLayer = undefined;
    this.#placeResize?.disconnect();
    this.#placeResize = undefined;
    this.#placeHeard?.();
    this.#placeHeard = undefined;
  }

  /**
   * The sharpness of the still, from `still-size` (CSS pixels on its long side): the shared renderer reads `data-still-size` (device pixels) from the element, so it is kept at `still-size` times the device pixel ratio (up to 3), and the picture is sharp on a screen that has more pixels than CSS pixels.
   * A page that sets `data-still-size` itself, and no `still-size`, is left alone. Returns true when the value changed.
   */
  #stillSide(): boolean {
    const asked = Number(this.getAttribute("still-size"));
    if (!this.hasAttribute("still-size") || !Number.isFinite(asked) || asked <= 0) return false;
    const side = String(Math.round(Math.min(2048, Math.max(16, asked * Math.min(3, window.devicePixelRatio || 1)))));
    if (this.getAttribute("data-still-size") === side) return false;
    this.setAttribute("data-still-size", side);
    return true;
  }

  attributeChangedCallback(name: string): void {
    if ((MOON_FILTER_ATTRIBUTES as readonly string[]).includes(name)) {
      this.moonFilter = readMoonFilter(this);
      return;
    }
    if (!this.isConnected) return;
    if (name === "body" || name === "star" || name === "moons") {
      this.#hideMoonName();
      this.#syncMoonSelection();
    }
    // the name on the globe is read again when its attributes, the body, a star's numbers or the language change
    if (name === "body" || name === "star" || name === "lang" || (NAME_LABEL_ATTRIBUTES as readonly string[]).includes(name)) this.#labelHeld = undefined;
    if (name === "time" || name === "rate") {
      this.#clockFromAttributes();
      this.#syncClock(true);
    }
    if (name === "body" || name === "star") {
      this.#flowSince = undefined;
      this.#flowHeld = 0;
    }
    if (name === "data") this.#door.book.ownOnly(this.getAttribute("data") === "own");
    if (name === "live") this.#applyHover();
    if (name === "still-size" && this.#stillSide()) this.#still();
    if (name === "live" || name === "look" || name === "body" || name === "earth-from" || name === "cutaway") this.#carry();
    if (name === "body" || name === "look" || name === "cutaway" || name === "moons" || name === "range" || name === "scale-to" || name === "span-km" || name === "fit" || name === "star") {
      if (name === "body" || name === "look") this.#tileLevels = undefined;
      this.#refreshLimits();
    }
    this.#lastAnchors = -1;
    if (name === "places" || name === "site-flags" || name === "lang" || name === "body" || name === "look" || name === "star" || name === "cutaway" || name === "surface-names") this.#markPlaces();
    this.#queue();
  }

  /** Put the picture on the page's one WebGL context and draw it, moving if it is asked to. Resolves true when it is live. A `line` look has nothing to take and resolves false. */
  async goLive(): Promise<boolean> {
    if (this.look === "line" || this.#delegateEl !== undefined) return false;
    this.#wantLive = true;
    await this.#ensureView();
    const ok = (await this.#view?.focus()) === true;
    if (ok) {
      this.#set("live");
      this.#sync();
      this.#resume();
    } else if (this.#state !== "unavailable" && this.#state !== "lost") this.#set("still");
    return ok;
  }

  /** Give the WebGL context back: the picture stays as a still. */
  rest(): void {
    this.#wantLive = false;
    this.#stopTick();
    if (this.#view !== undefined) {
      this.#view.blur();
      if (this.look !== "line" && this.#state !== "unavailable") {
        this.#set("still");
        this.#rekey();
      }
    }
  }

  /** The shared controllers' camera: `yaw` turns the body about its pole, `tilt` tips its top away from you as it grows (a drag up moves the surface up), `roll` turns the picture clockwise about the line of sight, `zoom` scales it, and `panX` and `panY` move it by that many CSS pixels from the middle. */
  setView(view: { yaw?: number; tilt?: number; roll?: number; zoom?: number; panX?: number; panY?: number }): void {
    const stage = this.#cutSize() === undefined ? this : (this.#stage ?? this);
    const half = Math.max(1, Math.min(stage.clientWidth, stage.clientHeight)) / 2;
    const [yaw, tilt, roll, zoom, panX, panY] = [view.yaw ?? 0, view.tilt ?? 0, view.roll ?? 0, view.zoom ?? 1, -(view.panX ?? 0) / half, (view.panY ?? 0) / half];
    if (yaw === this.#yaw && tilt === this.#tilt && roll === this.#roll && zoom === this.#zoom && panX === this.#panX && panY === this.#panY) return;
    [this.#yaw, this.#tilt, this.#roll, this.#zoom, this.#panX, this.#panY] = [yaw, tilt, roll, zoom, panX, panY];
    if (this.#delegating() === "line") passLineView(this.#delegateEl, { yaw, tilt, zoom, panX: view.panX ?? 0, panY: view.panY ?? 0 });
    this.dispatchEvent(new CustomEvent("wakusei-view", { detail: { yaw: this.#yaw, tilt: this.#tilt, roll: this.#roll, zoom: this.#zoom, panX: view.panX ?? 0, panY: view.panY ?? 0 } }));
    this.#queue(true);
  }

  /** Take the shared hands, unless the picture is a still (`live="off"`) or another package's shaded Earth. The line Earth takes them and the view is passed on to its globe. The look decides the zoom range, so a new look takes new hands. */
  #carry(): void {
    const on = bodyHandsOn(this.getAttribute("live"), this.#delegating());
    const key = `${on}|${this.look === "line"}|${this.#delegating() ?? ""}`;
    if (this.#handsKey === key) {
      this.#refreshLimits();
      return;
    }
    this.#hands?.unbind();
    this.#handsKey = key;
    const limits = this.#limits();
    this.#limitKey = `${limits.zoomMax}|${this.look}`;
    this.#hands = carryControls(this, { on, limits, grabRadius: this.discRadius, objectSize: { width: this.discRadius * 2, height: this.discRadius * 2 }, onChange: (view) => {
      this.#tumble = this.#hands?.controller.turnAxis === "all";
      this.setView(view);
    } });
    if (this.#zoom !== 1 || this.#yaw !== 0 || this.#tilt !== 0 || this.#panX !== 0 || this.#panY !== 0 || this.#roll !== 0) {
      if (!this.hasAttribute("data-kazoku-bar")) this.setView({});
    }
  }

  /** The disc is a different size on the screen after the picture or the page is resized: a gesture is told before it starts. */
  #measure = (): void => {
    const controller = this.#hands?.controller;
    if (controller === undefined) return;
    const disc = this.discRadius;
    if (disc <= 0) return;
    controller.grabRadius = disc;
    controller.objectSize = { width: disc * 2, height: disc * 2 };
  };

  // --- the star ---------------------------------------------------------------------------------------------------------------------------------------

  #starKey = "";
  #starMade: StarLook | undefined;

  /** The star the attributes describe: `star` is a JSON object of numbers, the name of a star registered with `registerStarLook`, or empty with the numbers in the other attributes, which are laid over it. */
  #star(): StarLook | undefined {
    if (!this.hasAttribute("star")) return undefined;
    const quality = this.getAttribute("quality") === "low" || (this.getAttribute("quality") !== "full" && weakDevice()) ? "low" : "full";
    const key = JSON.stringify([quality, this.getAttribute("star"), ...STAR_ATTRS.map((name) => this.getAttribute(name)), starLookOf(this.getAttribute("star") ?? "")?.key]);
    if (key === this.#starKey) return this.#starMade;
    this.#starKey = key;
    this.#starMade = undefined;
    this.removeAttribute("data-error");
    try {
      const value = (this.getAttribute("star") ?? "").trim();
      const example = stellarExample(value);
      let base: Partial<StarNumbers> = {};
      if (value.startsWith("{")) base = JSON.parse(value) as Partial<StarNumbers>;
      else if (value !== "") base = example?.numbers ?? starLookOf(value)?.numbers ?? { name: value };
      const pick = (name: (typeof STAR_ATTRS)[number]): string | null => this.getAttribute(name);
      const number = (name: (typeof STAR_ATTRS)[number]): number | undefined => (pick(name) === null ? undefined : Number(pick(name)));
      const numbers = {
        ...base,
        ...(pick("temperature-k") !== null ? { temperatureK: number("temperature-k") } : {}),
        ...(pick("radius-sun") !== null ? { radiusSun: number("radius-sun") } : {}),
        ...(pick("luminosity-class") !== null ? { luminosityClass: pick("luminosity-class") as StarNumbers["luminosityClass"] } : {}),
        ...(pick("rotation-days") !== null ? { rotationDays: number("rotation-days") } : {}),
        ...(pick("activity") !== null ? { activity: number("activity") } : {}),
        ...(pick("oblateness") !== null ? { oblateness: number("oblateness") } : {}),
        ...(pick("inclination-deg") !== null ? { inclinationDeg: number("inclination-deg") } : {}),
        ...(pick("corona") !== null ? { corona: number("corona") } : {}),
        ...(pick("variable-period-days") !== null ? { variablePeriodDays: number("variable-period-days") } : {}),
        ...(pick("variable-amplitude") !== null ? { variableAmplitude: number("variable-amplitude") } : {}),
        ...(pick("estimated") !== null ? { estimated: pick("estimated")!.split(",").map((part) => part.trim()).filter((part) => part !== "") as StarNumbers["estimated"] } : {}),
      } as StarNumbers;
      const made = starLook(numbers, { quality });
      this.#starMade = example === undefined ? made : { ...made, facts: { ...made.facts, name: example.name } };
    } catch (error) {
      this.setAttribute("data-error", `star: ${error instanceof Error ? error.message : String(error)}`);
    }
    return this.#starMade;
  }

  /** A catalogue moon this element draws as an estimated rock, or `null` when `body` is a body the package draws in full (or not a moon). */
  #estimate() {
    if (this.hasAttribute("star")) return null;
    const id = this.getAttribute("body");
    if (id === null || id in BODIES) return null;
    return estimatedRock(id);
  }

  /** The facts of what is drawn: the body's, the star's (the Sun's with its own size, shape and outlines), or an estimated rock's. */
  #facts(): BodyFacts {
    return this.#star()?.facts ?? this.#estimate()?.facts ?? BODIES[this.body];
  }

  // --- the clock ------------------------------------------------------------------------------------------------------------------------------------

  #clockFromAttributes(): void {
    const t = readTime(this.getAttribute("time"));
    this.#startedAt = performance.now();
    this.#start = t === "now" ? Date.now() : t;
  }

  /**
   * Tell the page the moment shown while a dated clock runs (`rate` not 0): `wakusei-timechange` with `{ time, running: true }` four times a second (once a second at real time), only while the
   * tab is shown (the date box is often below the picture), and once with `running: false` when the clock holds. `loud` says the clock was just set (a new `time` or `rate`), so a hold is announced.
   */
  #syncClock(loud = false): void {
    clearTimeout(this.#clockTimer);
    this.#clockTimer = undefined;
    const r = this.#request();
    const dated = r.start !== undefined;
    const running = dated && r.rate !== 0;
    if (!this.isConnected) return;
    if (!running) {
      if (loud && dated && this.#clockRan) this.dispatchEvent(new CustomEvent("wakusei-timechange", { detail: { time: this.time, running: false } }));
      this.#clockRan = false;
      return;
    }
    this.#clockRan = true;
    if (document.visibilityState === "hidden") return;
    const step = (): void => {
      this.dispatchEvent(new CustomEvent("wakusei-timechange", { detail: { time: this.time, running: true } }));
      this.#clockTimer = setTimeout(step, Math.abs(this.#request().rate) === 1 ? 1000 : 250);
    };
    step();
  }

  #request(): LiveRequest {
    const star = this.#star();
    const moons = this.hasAttribute("moons") && !this.hasAttribute("star");
    return {
      id: this.body,
      start: this.hasAttribute("star") ? undefined : (this.#start ?? (moons ? Date.now() : undefined)),
      startedAt: this.#startedAt,
      rate: Math.max(-1e7, Math.min(1e7, num(this.getAttribute("rate"), 1))),
      moons,
      portrait: {
        tilt: this.hasAttribute("tilt") ? num(this.getAttribute("tilt"), 0) : undefined,
        pitch: this.hasAttribute("pitch") ? num(this.getAttribute("pitch"), 0) : star?.inclinationDeg,
        phase: this.hasAttribute("phase") ? num(this.getAttribute("phase"), 0) : undefined,
        spin: this.hasAttribute("meridian") ? num(this.getAttribute("meridian"), 0) : undefined,
      },
      turn: (this.hasAttribute("turn") ? num(this.getAttribute("turn"), 0) : this.getAttribute("live") === "off" ? 0 : star !== undefined ? star.turn.degreesPerSecond : defaultTurn(this.body)) * (this.#reduce ? REDUCED_TURN : 1),
    };
  }

  /** The picture moves on its own: a turn, or time running faster (or backwards) than the clock. A held clock (`rate="0"`) moves nothing. */
  get #moving(): boolean {
    const r = this.#request();
    const turning = r.turn !== 0 || (r.start !== undefined && r.rate !== 1 && r.rate !== 0);
    if (this.#isSection()) return this.#flowSince !== undefined;
    return this.#flowSince !== undefined || (this.#reduce ? r.turn !== 0 : turning);
  }

  // --- the state of the scene --------------------------------------------------------------------------------------------------------------------

  #sceneOf(frame: LiveFrame): SceneState {
    const tiltBy = this.#pitchDelta - this.#tilt;
    const roll = this.#tumble ? this.#roll : -this.#roll;
    const pose = viewPose(frame.pose, this.#yaw, tiltBy, roll, this.#tumble);
    const r = this.#request();
    const extent = this.#extent(r.moons);
    const spin = this.#tumble ? this.#yaw : 0;
    const rotateMoon = (vector: Vec3): Vec3 => {
      const spun = spin === 0 ? vector : turnVec(vector, [0, 1, 0], spin);
      const tilted = tiltBy === 0 ? spun : turnVec(spun, [1, 0, 0], tiltBy);
      return roll === 0 ? tilted : turnVec(tilted, [0, 0, 1], roll);
    };
    const moons = r.moons ? this.#moonsOf(frame, extent, tiltBy, roll, spin, rotateMoon) : undefined;
    const moonCatalogue = this.#moonSelection !== undefined && frame.time !== undefined && "frame" in frame.pose
      ? this.#moonModule?.bodyMoonCatalogue(this.#moonSelection, this.body, frame.pose as Apparent, frame.time, rotateMoon)
      : undefined;
    const moonOrbits = this.getAttribute("moon-orbits") !== "off";
    const label = this.#labelNow();
    return { pose, extent, cutawaySeconds: this.#cutawaySeconds(), sky: frame.time !== undefined, zoom: this.#zoom, panX: clampPan(this.#panX, extent, this.#zoom), panY: clampPan(this.#panY, extent, this.#zoom), moons, moonCatalogue, moonOrbits, label };
  }

  #labelHeld: { options: ({ text: string } & NameLabelOptions) | null; key: string } | undefined;
  /** The name on the globe the attributes or the property ask for, with its text in the element's language: the same object (and key) until something about it changes, so a draw compares by reference. */
  #labelNow(): ({ text: string } & NameLabelOptions) | null {
    return this.#labelHeld === undefined ? (this.#labelHeld = this.#readLabel()).options : this.#labelHeld.options;
  }
  #labelKey(): string {
    return (this.#labelHeld ??= this.#readLabel()).key;
  }
  #readLabel(): { options: ({ text: string } & NameLabelOptions) | null; key: string } {
    const options = this.bodyLabel;
    if (options === null) return { options: null, key: "" };
    const text = nameLabelText(this.#facts().name, this.getAttribute("lang") === "ja" ? "ja" : "en");
    return { options: { ...options, text }, key: nameLabelKey(text, options) };
  }

  /** Body radii from the middle of the picture to its edge at zoom 1, for the attributes now. */
  #extent(moons: boolean): number {
    const scaleTo = this.getAttribute("scale-to") as BodyId | null;
    const range = this.hasAttribute("range") ? num(this.getAttribute("range"), 0) : undefined;
    const span = num(this.getAttribute("span-km"), 0);
    if (!moons && !range && !span && scaleTo === null && this.#cutSize() !== undefined) {
      if (this.#isSection()) return 1.18;
      // Wide rings can make a tight fit smaller than the ordinary view. Keep the cut at least that large in its stage.
      return Math.min(ROOM, Math.max(1.2, extentOf(this.#facts(), { tight: true })));
    }
    const extent = extentOf(this.#facts(), {
      tight: this.getAttribute("fit") === "tight",
      spanKm: span > 0 ? span : undefined,
      scaleTo: scaleTo !== null && scaleTo in BODIES ? scaleTo : undefined,
      moons,
      range: range !== undefined && range > 0 ? range : undefined,
    });
    return moons && !(range !== undefined && range > 0) ? Math.max(extent, this.#moonSelection?.extent ?? 0) : extent;
  }

  /**
   * The zoom range now: a line drawing to 50; a shaded body as far as its detail goes (`scene/reach.ts`), which depends on how big its picture is (the radii it reaches at zoom 1: a moons picture reaches
   * six or more), on the widest map it has (the finest tile level, once the tiles are found) and on whether its surface is soft.
   */
  #limits(): { zoomMin: number; zoomMax: number; tiltMax: number } {
    if (this.look === "line") return LINE_LIMITS;
    if (this.hasAttribute("star") || this.#estimate() !== null) return { zoomMin: 0.1, zoomMax: zoomLimit(1, 0, false), tiltMax: 90 };
    const moons = this.hasAttribute("moons");
    const look = lookOf(this.body);
    const painted = this.look !== "illustrated" && look?.painted !== undefined;
    const width = mapWidthOf(look, painted, this.#tileLevels);
    const smooth = look !== undefined && detailOf(look).stretch > 1;
    return { zoomMin: 0.1, zoomMax: look?.emissive === true ? zoomLimit(1, 0, false) : zoomLimit(this.#extent(moons), width, smooth, painted ? ringWidthOf(look, BODIES[this.body].radiusKm) : 0), tiltMax: 90 };
  }

  /** Tell the shared controls the zoom range, when it has changed (a new body, the moons turned on, the tiles found). */
  #refreshLimits(): void {
    if (this.#hands === undefined) return;
    const limits = this.#limits();
    const key = `${limits.zoomMax}|${this.look}`;
    if (key === this.#limitKey) return;
    this.#limitKey = key;
    this.#hands.setLimits(limits);
  }

  #moonsOf(frame: LiveFrame, extent: number, tilt: number, roll: number, spin: number, rotate: (vector: Vec3) => Vec3): MoonDraw[] {
    const moons: MoonDraw[] = [];
    for (const m of frame.moons) {
      if (m.distance <= extent * 1.05 && (this.#moonSelection === undefined || this.#moonSelection.full.has(m.id))) {
        const orbit = this.getAttribute("moon-orbits") === "off" ? undefined : this.#orbits.get(m.id as string);
        const rotated = rotate([m.x, m.y, m.z]);
        moons.push({ id: m.id, x: rotated[0], y: rotated[1], z: rotated[2], orbit: orbit === undefined || (spin === 0 && tilt === 0 && roll === 0) ? orbit : this.#tiltedOrbit(m.id as string, orbit, tilt, roll, spin) });
      }
    }
    return moons;
  }

  #tilted = new Map<string, { source: Float32Array; tilt: number; roll: number; spin: number; out: Float32Array }>();
  #tiltedOrbit(id: string, orbit: Float32Array, tilt: number, roll: number, spin: number): Float32Array {
    const held = this.#tilted.get(id);
    if (held !== undefined && held.source === orbit && held.tilt === tilt && held.roll === roll && held.spin === spin) return held.out;
    const out = new Float32Array(orbit.length);
    for (let i = 0; i < orbit.length; i += 3) {
      const spun = spin === 0 ? ([orbit[i]!, orbit[i + 1]!, orbit[i + 2]!] as Vec3) : turnVec([orbit[i]!, orbit[i + 1]!, orbit[i + 2]!], [0, 1, 0], spin);
      const tipped = turnVec(spun, [1, 0, 0], tilt);
      const v = roll === 0 ? tipped : turnVec(tipped, [0, 0, 1], roll);
      out[i] = v[0];
      out[i + 1] = v[1];
      out[i + 2] = v[2];
    }
    this.#tilted.set(id, { source: orbit, tilt, roll, spin, out });
    return out;
  }

  /** Use this planet's moon theory once fetched. The fitted orbits can draw the first frame. */
  #wantTheory(id: BodyId): void {
    const planet = BODIES[id].parent ?? id;
    void loadMoonTheory(planet).then((loaded) => {
      if (!loaded) return;
      this.#live = createLive();
      this.#orbitKey = "";
      this.#queue(true);
    });
  }

  #ensureOrbits(frame: LiveFrame): void {
    const r = this.#request();
    if (!r.moons || frame.time === undefined || this.getAttribute("moon-orbits") === "off") return;
    const bucket = `${r.id}:${Math.floor(frame.time / 3_600_000)}`;
    if (bucket === this.#orbitKey) return;
    this.#orbitKey = bucket;
    this.#orbits.clear();
    for (const m of frame.moons) this.#orbits.set(m.id as string, orbitPath(m.id as MoonId, frame.time));
  }

  #frameNow(): LiveFrame {
    const request = this.#request();
    if (request.moons) this.#wantTheory(request.id);
    // a minor body with a date is placed from its fitted table, fetched the first time one is asked for
    if (request.start !== undefined && (MINOR_IDS as readonly string[]).includes(request.id)) {
      void loadMinorTables().then((loaded) => {
        if (!loaded) return;
        this.#live = createLive();
        this.#queue(true);
      });
    }
    const frame = this.#live.at(request, performance.now());
    if (frame.anchors !== this.#lastAnchors) {
      this.#lastAnchors = frame.anchors;
      const b = (Math.asin(Math.max(-1, Math.min(1, frame.pose.pole[2]))) * 180) / Math.PI;
      this.#pitchDelta = this.hasAttribute("pitch") && frame.time !== undefined ? Math.round((num(this.getAttribute("pitch"), 0) - b) * 10) / 10 : 0;
    }
    this.#ensureOrbits(frame);
    return frame;
  }

  // --- drawing ------------------------------------------------------------------------------------------------------------------------------------

  #queue(now = false): void {
    if (this.#refreshQueued && !now) return;
    this.#refreshQueued = true;
    queueMicrotask(() => {
      this.#refreshQueued = false;
      if (this.isConnected) void this.#refresh();
    });
  }

  /** The picture's identity: a new one disposes the view and builds it again, so a cutaway gives its shells back when it is turned off. */
  #signature(): string {
    return `${this.#star()?.key ?? this.#estimate()?.id ?? this.body}|${this.look}|${this.#cutSize() ?? (this.#cutawayOn() ? "cut" : "whole")}`;
  }

  #cutawayOn(): boolean {
    const value = this.getAttribute("cutaway");
    return value !== null && value !== "off" && value !== "0";
  }

  #stellarExample() {
    const example = stellarExample(this.getAttribute("star")?.trim());
    if (example === undefined) return undefined;
    const numbers = this.#star()?.numbers;
    const source = example.numbers;
    return numbers !== undefined && numbers.radiusSun === source.radiusSun && numbers.temperatureK === source.temperatureK &&
      numbers.luminosityClass === source.luminosityClass && numbers.rotationDays === source.rotationDays &&
      numbers.oblateness === source.oblateness ? example : undefined;
  }

  #interior() {
    if (this.hasAttribute("star")) return this.#stellarExample()?.interior;
    return this.#estimate() === null ? interiorOf(this.body) : undefined;
  }

  #cutSize(): CutSize | undefined {
    const value = this.getAttribute("cutaway");
    if ((value === "" || value === "classic") && this.#stellarExample() !== undefined) return "quarter";
    if (value !== "half" && value !== "quarter") return undefined;
    return this.#interior() === undefined ? undefined : value;
  }

  #isSection(): boolean {
    return (this.look === "line" || this.#state === "unavailable") && this.#cutSize() !== undefined;
  }

  #cutawaySeconds(): number {
    return this.#flowHeld + (this.#flowSince === undefined ? 0 : (performance.now() - this.#flowSince) / 1000);
  }

  #syncCutawayFlow(): void {
    const value = this.getAttribute("cutaway-flow");
    const active = value !== null && value !== "off" && value !== "0" && this.#cutSize() !== undefined &&
      this.#visible && document.visibilityState !== "hidden" && !this.#motionPreference?.matches &&
      this.#interior()?.layers.some((layer) => layer.flow === true);
    if (active && this.#flowSince === undefined) this.#flowSince = performance.now();
    else if (!active && this.#flowSince !== undefined) {
      this.#flowHeld = this.#cutawaySeconds();
      this.#flowSince = undefined;
    }
  }

  /** On a narrow picture the legend takes a band under the body, so it is never drawn across the globe. */
  #fitCutaway(): void {
    const panel = this.shadowRoot?.querySelector("#cutaway-panel");
    if (!(panel instanceof HTMLElement)) return;
    const narrow = this.clientWidth > 0 && this.clientWidth <= 480;
    const band = !this.hasAttribute("data-stellar-cut") && !panel.hidden && (narrow || this.#cutSize() !== undefined) ? panel.offsetHeight + 8 : 0;
    const next = `${band}px`;
    if (this.style.getPropertyValue("--cutaway-band") !== next) this.style.setProperty("--cutaway-band", next);
  }

  /** The legend and any magnified detail are laid out without WebGL objects. */
  #syncLegend(): void {
    const list = this.shadowRoot?.querySelector("#cutaway");
    const panel = this.shadowRoot?.querySelector("#cutaway-panel");
    const heading = this.shadowRoot?.querySelector("#cutaway-heading");
    const detail = this.shadowRoot?.querySelector("#stellar-detail");
    if (!(list instanceof HTMLOListElement) || !(panel instanceof HTMLElement) || !(heading instanceof HTMLElement) || !(detail instanceof HTMLElement)) return;
    const example = this.#cutawayOn() ? this.#stellarExample() : undefined;
    this.toggleAttribute("data-stellar-cut", example !== undefined);
    detail.hidden = example?.detail === undefined;
    detail.replaceChildren();
    if (!this.#cutawayOn()) {
      panel.hidden = true;
      list.hidden = true;
      heading.hidden = true;
      list.replaceChildren();
      this.#fitCutaway();
      return;
    }
    panel.hidden = false;
    list.hidden = false;
    list.replaceChildren();
    const lang = this.getAttribute("lang") === "ja" ? "ja" : "en";
    const interior = this.hasAttribute("star") ? example?.interior : this.#interior();
    if (interior === undefined) {
      heading.hidden = true;
      const item = document.createElement("li");
      item.dataset.empty = "";
      item.textContent = lang === "ja" ? "この天体の内部は、このパッケージには出典つきの数値がありません。" : "This body has no sourced interior in this package.";
      list.append(item);
      this.#fitCutaway();
      return;
    }
    heading.hidden = false;
    heading.textContent = example === undefined ? interiorDepthHeading(lang) : (lang === "ja" ? "中心からの半径" : "Radius from the centre");
    for (const row of rowsForInterior(interior, lang, example !== undefined)) {
      const item = document.createElement("li");
      item.dataset.layer = row.id;
      const swatch = document.createElement("span");
      swatch.dataset.swatch = "";
      swatch.style.background = row.colour;
      const text = document.createElement("span");
      const name = document.createElement("b");
      name.dataset.name = "";
      name.textContent = row.name;
      const depth = document.createElement("span");
      depth.dataset.depth = "";
      depth.textContent = row.depth;
      const made = document.createElement("span");
      made.dataset.made = "";
      made.textContent = row.madeOf;
      text.append(name, " ", depth, " ", made);
      item.append(swatch, text);
      list.append(item);
    }
    if (example?.detail !== undefined) {
      const layers = interior.layers.slice(0, example.detail);
      const radiusKm = layers.at(-1)!.outerKm;
      const label = lang === "ja" ? "中心核と水素燃焼殻の拡大図" : "Magnified core and hydrogen-burning shell";
      detail.innerHTML = interiorSectionSvg({ ...interior, radiusKm, layers }, label, { size: 112, fill: 0.94 });
      const caption = document.createElement("figcaption");
      const title = document.createElement("strong");
      title.textContent = label;
      const scale = document.createElement("span");
      scale.dataset.scale = "";
      const edge = Number(radiusKm.toPrecision(3)).toLocaleString(lang === "ja" ? "ja-JP" : "en-CA");
      const percent = (100 * radiusKm / interior.radiusKm).toPrecision(2);
      scale.textContent = lang === "ja" ? `中心から 0〜${edge} km（全半径の ${percent}%）` : `0–${edge} km from centre, inner ${percent}% of the radius`;
      caption.append(title, scale);
      detail.append(caption);
    }
    let explanation = interior.note?.[lang];
    if (interior.body === "earth" && this.#cutSize() !== undefined) {
      explanation = lang === "ja" ? "表面近くの明るい点は、模式的なマグマだまりを示します。" : "Bright pockets show illustrative magma near the surface.";
    }
    if (explanation !== undefined) {
      const note = document.createElement("li");
      note.dataset.note = "";
      note.textContent = explanation;
      if (example !== undefined) {
        const source = document.createElement("a");
        source.href = interior.source.page;
        source.target = "_blank";
        source.rel = "noopener";
        source.textContent = lang === "ja" ? "モデルの出典" : "Source model";
        note.append(" ", source);
      }
      list.append(note);
    }
    this.#fitCutaway();
  }

  async #refresh(): Promise<void> {
    if (!this.isConnected) return;
    this.#syncCutawayFlow();
    this.#syncLegend();
    this.#syncEstimate();
    this.setAttribute("aria-label", this.#label());
    if (this.hasAttribute("size")) this.style.setProperty("--wakusei-size", `${num(this.getAttribute("size"), 320)}px`);
    if (this.hasAttribute("star") && this.#star() === undefined) {
      this.#disposeView(true);
      this.#stage.innerHTML = "";
      this.#set("line");
      return;
    }
    const kind = this.#estimate() === null ? this.#delegating() : undefined;
    const delegate = kind === undefined ? undefined : delegates.get(this.body);
    if (delegate !== undefined && kind !== undefined && (await this.#delegated(delegate, kind))) return;
    const undelegated = this.#delegateEl !== undefined;
    if (this.#delegateEl !== undefined) {
      this.#delegateEl.remove();
      this.#delegateEl = undefined;
      this.#delegateKind = "";
    }
    const wants3d = this.look !== "line" && this.#state !== "unavailable";
    if (!wants3d) {
      if (this.#view !== undefined) this.#disposeView(true);
      this.#drawLine();
      if (this.look === "line") this.#set("line");
      // the tick stopped while the other package's globe was shown
      if (undelegated || this.#isSection() || this.moons === "all") this.#resume();
      return;
    }
    const sig = this.#signature();
    if (this.#view !== undefined && this.#viewSig !== sig) {
      if (this.#view.live) this.#wantLive = true;
      this.#disposeView();
    }
    if (this.#view === undefined || this.#viewKey === "") await this.#ensureView();
    if (this.#view?.live !== true && this.#wantLive) {
      void this.goLive();
      return;
    }
    if (this.#view?.live === true) {
      this.#sync();
      this.#view.invalidate();
      if (this.#cutSize() !== undefined || this.moons === "all") this.#resume();
    } else {
      this.#rekey();
      if (this.#wantLive || this.#hasPriority()) void this.goLive();
    }
  }

  #hasPriority(): boolean {
    const mode = this.getAttribute("live") ?? "always";
    return mode === "always" && this.#visible;
  }

  #applyHover(allow = true): void {
    const events = ["pointerenter", "focusin", "pointerdown"];
    for (const name of events) this.removeEventListener(name, this.#hover);
    if (allow && (this.getAttribute("live") ?? "always") === "hover") {
      for (const name of events) this.addEventListener(name, this.#hover);
    }
  }

  #syncEstimate(): void {
    const rock = this.#estimate();
    const note = this.shadowRoot?.querySelector("#estimate");
    if (rock === null) {
      this.removeAttribute("data-shape");
      this.removeAttribute("data-size");
      this.removeAttribute("data-estimated");
      if (note instanceof HTMLElement) {
        note.hidden = true;
        note.textContent = "";
      }
      return;
    }
    this.dataset.shape = "estimated";
    this.dataset.size = rock.sizeFrom;
    this.dataset.estimated = rock.id;
    if (note instanceof HTMLElement) {
      note.hidden = false;
      note.textContent = this.getAttribute("lang") === "ja" ? rock.line.ja : rock.line.en;
      note.title = this.getAttribute("lang") === "ja" ? rock.legend.ja : rock.legend.en;
    }
  }

  #label(): string {
    const star = this.#star();
    const ja = this.getAttribute("lang") === "ja";
    const rock = this.#estimate();
    if (rock !== null) {
      const note = ja ? rock.note.ja : rock.note.en;
      return ja ? `${rock.label}。${note}` : `${rock.label}. ${note}`;
    }
    const f = star?.facts ?? BODIES[this.body];
    const size = this.#cutSize();
    if (size !== undefined) {
      if (this.#isSection()) return ja ? `${f.name.ja}の断面` : `${f.name.en} cross-section`;
      return ja ? `${f.name.ja}の${size === "half" ? "半分" : "4分の1"}を開いた図` : `${f.name.en}, ${size} cutaway`;
    }
    if (star !== undefined) return this.look === "line" ? (ja ? `${star.facts.name.ja}の線画。${star.disclaimer.ja}` : `${star.facts.name.en}, line drawing. ${star.disclaimer.en}`) : ja ? `${star.facts.name.ja}の陰影つきの絵。${star.disclaimer.ja}` : `${star.facts.name.en}, shaded star. ${star.disclaimer.en}`;
    const looks = { line: ja ? "線画" : "line drawing", realistic: ja ? "表面の地図" : "painted surface", painted: ja ? "表面の地図" : "painted surface", illustrated: ja ? "イラスト" : "illustrated drawing" } as const;
    return ja ? `${f.name.ja}の${looks[this.look]}` : `${f.name.en}, ${looks[this.look]}`;
  }

  #drawLine(): void {
    const rock = this.#estimate();
    if (rock !== null) {
      this.#stage.innerHTML = estimatedRockLine(rock, 480);
      return;
    }
    const r = this.#request();
    const frame = this.#frameNow();
    const scaleTo = this.getAttribute("scale-to") as BodyId | null;
    const stroke = getComputedStyle(this).getPropertyValue("--wakusei-line").trim();
    const paper = getComputedStyle(this).getPropertyValue("--wakusei-paper").trim();
    const scene = this.#sceneOf(frame);
    this.#sceneState = scene;
    const size = 480;
    const star = this.#star();
    const draw = (options: LineOptions) => {
      if (star === undefined) return lineSvg(this.body, options);
      const interior = options.cutaway ? this.#interior() : undefined;
      if (interior === undefined) return starLineSvg(star, options);
      const label = options.lang === "ja" ? `${star.facts.name.ja}の断面` : `${star.facts.name.en} cross-section`;
      return interiorSectionSvg(interior, label, options);
    };
    const catalogueMoons = scene.moonCatalogue === undefined ? undefined : this.#lineCatalogue(scene);
    const html = draw({
      size,
      ...(this.#isSection() ? { cutaway: true, cutawaySeconds: scene.cutawaySeconds } : {}),
      pose: scene.pose,
      ...(r.moons ? { moons: true, ...(frame.time !== undefined ? { time: frame.time } : {}), range: scene.extent, moonsAt: (scene.moons ?? []).map((m) => ({ id: m.id as MoonId, x: m.x, y: m.y, z: m.z, distance: Math.hypot(m.x, m.y, m.z) })), orbits: new Map((scene.moons ?? []).filter((m) => m.orbit !== undefined).map((m) => [m.id as string, m.orbit!])) } : {}),
      moonOrbits: scene.moonOrbits,
      catalogueMoons,
      fill: scaleTo !== null || this.hasAttribute("span-km") || this.getAttribute("fit") !== "tight" || this.#isSection() ? this.#fill() : undefined,
      lang: this.getAttribute("lang") === "ja" ? "ja" : undefined,
      labels: this.getAttribute("labels") === "off" || this.moons === "all" ? false : undefined,
      stroke: stroke || undefined,
      paper: paper || undefined,
      ...(this.#zoom !== 1 ? { zoom: this.#zoom, panX: scene.panX, panY: scene.panY } : {}),
    });
    this.#stage.innerHTML = html;
  }

  #lineOrbits: { source: NonNullable<SceneState["moonCatalogue"]>["source"]; time: number; byId: ReadonlyMap<string, readonly Vec3[]> } | undefined;
  #lineCatalogue(scene: SceneState): LineOptions["catalogueMoons"] {
    const dots = this.#smallMoons(scene);
    const catalogue = scene.moonCatalogue;
    const module = this.#moonModule;
    if (!scene.moonOrbits || catalogue === undefined || module === undefined) return dots;
    if (this.#lineOrbits?.source !== catalogue.source || Math.abs(this.#lineOrbits.time - catalogue.time) > 20 * 86_400_000) {
      this.#lineOrbits = {
        source: catalogue.source,
        time: catalogue.time,
        byId: new Map(catalogue.source.moons.map((moon) => [moon.id, catalogue.source.orbit(moon, catalogue.time, 36)])),
      };
    }
    const paths = this.#lineOrbits.byId;
    return dots.map((dot, index) => {
      const moon = catalogue.source.moons[index]!;
      return { ...dot, orbit: paths.get(moon.id)?.map((point) => module.bodyMoonPoint(catalogue, moon.host, point)) };
    });
  }

  #key(state: SceneState): string {
    const moons = (state.moons ?? []).map((m) => `${m.id}:${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(";");
    const flow = this.#cutSize() === undefined ? "" : this.#flowHeld.toFixed(3);
    const catalogue = state.moonCatalogue === undefined ? "" : `|${this.#moonSelectionKey}|${Math.round(state.moonCatalogue.time / 1000)}|${state.moonCatalogue.axes.map(vectorKey).join(",")}`;
    const paths = state.moonOrbits === false ? "|no-moon-orbits" : "";
    return `${this.#signature()}|${flow}|${vectorKey(state.pose.pole)}|${vectorKey(state.pose.meridian)}|${vectorKey(state.pose.light)}|${state.extent.toFixed(2)}|${state.zoom.toFixed(2)}|${state.panX.toFixed(2)},${state.panY.toFixed(2)}|${moons}|${this.#labelKey()}${catalogue}${paths}`;
  }

  // Replacing a view keeps the renderer lease; leaving 3D gives it back.
  #disposeView(releaseRenderer = false): void {
    this.#view?.dispose();
    this.#view = undefined;
    this.#viewKey = "";
    if (releaseRenderer) {
      this.#release?.();
      this.#release = undefined;
      this.#renderer = undefined;
    }
  }

  /** The renderer, the view and its first still. */
  async #ensureView(): Promise<void> {
    if (this.#renderer === undefined) {
      const taken = takeRenderer(this.#onContext);
      this.#renderer = taken.renderer;
      this.#release = taken.release;
    }
    if (this.#view === undefined) this.#makeView();
  }

  #makeView(): void {
    const frame = this.#frameNow();
    const state = this.#sceneOf(frame);
    this.#sceneState = state;
    this.#viewKey = this.#key(state);
    this.#viewSig = this.#signature();
    this.#stilled = false;
    this.#stage.innerHTML = "";
    const star = this.#star();
    const rock = this.#estimate();
    const interior = this.#cutawayOn() ? this.#interior() : undefined;
    const item = createBodyItem({
      id: this.body,
      ...(star !== undefined ? { shaded: star.look, facts: star.facts, assetKey: `star:${star.key}` } : rock === null ? {} : { shaded: rock.look, facts: rock.facts, assetKey: `rock:${rock.id}`, coarse: true }),
      look: this.look === "illustrated" ? "realistic" : "painted",
      cutaway: interior === undefined ? false : (this.#cutSize() ?? true),
      ...(interior === undefined ? {} : { interior }),
      onShells: (count) => {
        this.dataset.shells = String(count);
      },
      key: this.#viewKey,
      state: () => this.#sceneState ?? state,
      ...texturePaths(this),
      wantedWidth: (discPx) => discPx * Math.min(2, window.devicePixelRatio || 1) * 1.6,
      tiles: {
        polarBase: () => tilesBase(this),
        source: (body) => mapSourceFor(this.#door.book, tilesBase(this), body),
        book: this.#door.book,
        ratio: () => window.devicePixelRatio || 1,
        allowed: () => ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) > 2,
        onLevels: (levels) => {
          this.#tileLevels = levels;
          this.#refreshLimits();
        },
      },
      redraw: () => {
        // the tile levels were read, or a window is ready: look at the view again (the window is chosen at a sync), then draw
        if (this.#view?.live === true) this.#sync();
        this.#view?.invalidate();
        this.#door.announce();
      },
      report: (note) => {
        this.#textureWidth = note.width;
        this.#door.announce();
        if (note.failed === true) this.setAttribute("data-fallback", "shader");
        else this.removeAttribute("data-fallback");
      },
    });
    this.#view = this.#renderer!.view(this.#stage, item);
    this.#markPlaces(state);
    this.#set("loading");
    if (this.#visible) this.#still();
  }

  /** A body whose line look another package draws (the Earth's globe with its countries). It is drawn at the body's size in a scale picture, never larger than the picture. */
  async #delegated(delegate: NonNullable<ReturnType<typeof delegates.get>>, kind: "line" | "shaded"): Promise<boolean> {
    if (this.#view !== undefined) {
      this.#disposeView();
    }
    const center = this.hasAttribute("meridian") ? `${num(this.getAttribute("meridian"), 10)},20` : "10,20";
    const size = Math.round(this.clientWidth || 320);
    const fill = this.#fill();
    const time = kind === "shaded" && this.hasAttribute("time") && this.getAttribute("time") !== "now" ? this.getAttribute("time") : null;
    const textureBase = kind === "shaded" ? this.getAttribute("earth-texture-base") : null;
    const key = `${kind}|${center}|${fill}|${time ?? ""}|${textureBase ?? ""}`;
    if (this.#delegateEl !== undefined && this.#delegateKind === key) return true;
    const el = kind === "shaded" ? await delegate.shaded!({ center, size, time, textureBase }) : await delegate.line({ center, size });
    if (el === null) return false;
    this.#delegateEl?.remove();
    this.#stage.innerHTML = "";
    el.style.cssText = `display:block;width:${fill * 100}%;height:${fill * 100}%;aspect-ratio:1;position:absolute;left:${(1 - fill) * 50}%;top:${(1 - fill) * 50}%`;
    this.#stage.append(el);
    this.#delegateEl = el;
    this.#delegateKind = key;
    if (kind === "line") {
      const half = Math.max(1, Math.min(this.clientWidth, this.clientHeight)) / 2;
      passLineView(el, { yaw: this.#yaw, tilt: this.#tilt, zoom: this.#zoom, panX: -this.#panX * half, panY: this.#panY * half });
    }
    // the line Earth is a drawing; the realistic Earth is the other package's picture, which it draws and moves itself: here it is a picture shown, with no view of this package's own
    this.#set(kind === "line" ? "line" : "still");
    return true;
  }

  /** How much of the picture's width the body's disc takes: 1 alone, less in a scale picture (`scale-to`, `span-km`). */
  #fill(): number {
    const scaleTo = this.getAttribute("scale-to") as BodyId | null;
    const span = num(this.getAttribute("span-km"), 0);
    const half = span > 0 ? span : scaleTo !== null && scaleTo in BODIES ? BODIES[scaleTo].radiusKm * 1.06 : 0;
    if (half === 0 && this.#cutSize() !== undefined) return 1 / this.#extent(false);
    return half > 0 ? Math.max(this.hasAttribute("star") ? 0.001 : 0.01, Math.min(1, this.#facts().radiusKm / half)) : this.getAttribute("fit") === "tight" ? 1 : 1 / ROOM;
  }

  /** Make the view's still, once, when it is in sight. */
  #still(): void {
    if (this.#stilled || this.#view === undefined) return;
    this.#stilled = true;
    void this.#view.showStill().then(() => {
      if (this.#state === "loading") this.#set("still");
    });
  }

  /** Make a new view when what is shown has changed enough that the still would be wrong. */
  #rekey(): void {
    if (this.#renderer === undefined || this.#view === undefined || this.#view.live) return;
    const state = this.#sceneOf(this.#frameNow());
    const key = this.#key(state);
    if (key === this.#viewKey && this.#view.item !== undefined) return;
    this.#disposeView();
    this.#makeView();
  }

  /** Hand the live scene the current state. */
  #sync(): void {
    const scene = this.#view?.scene as BodyScene | undefined;
    if (scene === undefined || typeof scene.apply !== "function") return;
    const state = this.#sceneOf(this.#frameNow());
    this.#sceneState = state;
    scene.apply(state);
    this.#markPlaces(state);
    this.#textureWidth = scene.textureWidth;
    this.#door.announce();
  }

  // --- moving ---------------------------------------------------------------------------------------------------------------------------------------

  #frame(): void {
    if (this.#view?.live !== true || !this.#visible || document.visibilityState === "hidden") return;
    this.#sync();
    this.#view.invalidate();
    if (this.#moving) this.#tick = setTimeout(() => this.#gate?.request(), 0);
  }

  #resume(): void {
    this.#stopTick();
    if (this.#view?.live === true && this.#visible && this.#moving && document.visibilityState !== "hidden") this.#gate?.request();
    else if ((this.look === "line" || this.#isSection()) && this.#visible && this.#moving) this.#lineTick();
  }

  #lineTick(): void {
    this.#stopTick();
    // a body another package draws (the Earth's globe) is that package's to turn: this package's line drawn here would replace it
    if (!this.#visible || document.visibilityState === "hidden" || !this.#moving || (this.look !== "line" && !this.#isSection()) || this.#delegateEl !== undefined) return;
    this.#drawLine();
    this.#tick = setTimeout(() => this.#lineTick(), 1000 / 30);
  }

  #stopTick(): void {
    clearTimeout(this.#tick);
    this.#tick = undefined;
    this.#gate?.cancel();
  }

  #set(state: WakuseiState): void {
    if (state === this.#state) return;
    this.#state = state;
    this.setAttribute("data-state", state);
    this.dispatchEvent(new CustomEvent("wakusei-state", { detail: { state } }));
    this.#door.announce();
    if (state === "unavailable") {
      this.setAttribute("aria-label", this.#label());
      this.#drawLine();
      if (this.#isSection()) this.#resume();
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wakusei-body")) customElements.define("wakusei-body", WakuseiBody);

