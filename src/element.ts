// <wakusei-body>: a body of the solar system as a web component. `look="line"` is an SVG and needs nothing else. `realistic` and `painted` are drawn with three.js through
// kazoku-ui's shared renderer (one WebGL context for the whole page), and need the body's own entry point loaded (`@johnmorrisdotca/wakusei-planets/jupiter`). It draws only when
// something changes, at most 30 times a second while it moves, and nothing while it is out of sight or the tab is hidden. A reader who prefers reduced motion gets a slower turn; `turn="0"` is the only stop.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { carryControls, type ElementControls } from "@johnmorrisdotca/kazoku-ui/view-controls";
import "./tables/ceres.ts";
import "./tables/dwarfs.ts";
import { loadMinorTables, loadMoonTheory } from "./tables/lazy.ts";
import { orbitPath, type Pose } from "./ephemeris.ts";
import { BODIES, MINOR_IDS, type BodyFacts, type BodyId, type Look, type MoonId } from "./facts.ts";
import { extentOf, ROOM } from "./scene/extent.ts";
import { createGate, frameCap, type Gate } from "./gate.ts";
import { lineSvg } from "./line.ts";
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
import type { DetailStats } from "./scene/detail.ts";
import type { TileLevel } from "./scene/tiles.ts";
import { createBodyItem, type BodyScene, type MoonDraw, type SceneState, type ThreeParts } from "./scene/body.ts";
import { NAME_LABEL_ATTRIBUTES, nameLabelKey, nameLabelText, readNameLabel, type NameLabelOptions } from "./scene/name-label.ts";
import { delegates, onRegister } from "./scene/store.ts";
import { setThreeLoader, takeRenderer, type ContextState } from "./scene/shared.ts";
import { turn as turnVec, type Vec3 } from "./vec.ts";
import { findPlace, PLACE_BODIES, type Place, type PlaceBody } from "./places.ts";
import { marksToShow, readPlaceLayers, readSurfaceNames, turnToPlace, type PlaceLayer } from "./place-marks.ts";
import { createPlaceLayer, onPlacesLoader, placesLoader, type PlaceLayerView } from "./scene/place-layer.ts";

export { setThreeLoader };
export { placeLine, setPlacesLoader } from "./scene/place-layer.ts";

/**
 * What the element is doing: `line` (an SVG), `loading` (waiting for three.js or a picture), `still` (a picture of the 3D look, nothing running), `live` (drawing), `lost` (the GPU took the context; it comes back by itself) or `unavailable` (no WebGL: the line drawing is shown).
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
const STAR_ATTRS = ["temperature-k", "radius-sun", "luminosity-class", "rotation-days", "activity", "oblateness", "corona", "estimated"] as const;

const readLook = (value: string | null): Look => (value === "realistic" || value === "painted" || value === "illustrated" ? value : "line");

const readTime = (value: string | null): number | "now" | undefined => {
  if (value === null || value === "") return undefined;
  if (value === "now") return "now";
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
};

const vectorKey = (v: Vec3): string => `${v[0].toFixed(2)},${v[1].toFixed(2)},${v[2].toFixed(2)}`;

function turnPose(pose: Pose, axis: Vec3, degrees: number): void {
  pose.pole = turnVec(pose.pole, axis, degrees);
  pose.meridian = turnVec(pose.meridian, axis, degrees);
  pose.light = turnVec(pose.light, axis, degrees);
}

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
#stage { position: absolute; inset: 0; }
#stage svg { display: block; width: 100%; height: 100%; }
</style><div id="stage"></div>`;

/**
 * The `<wakusei-body>` custom element: a body of the solar system, drawn in a look.
 *
 * Attributes: `body` (a name, such as `jupiter`), `look` (`line`, `realistic` or `painted`), `size` (pixels across), `time` (`now` or an ISO date: the body as the Earth sees it then; leave it out for a portrait),
 * `tilt`, `pitch`, `phase` and `meridian` (a portrait's pose, degrees), `turn` (a portrait turns this many degrees a second; left out, 12 a second, backwards when the body is, and a date keeps its orientation and adds this turn; `live="off"` stays still unless this is set; `0` stays still; reduced motion keeps a quarter of it), `rate` (simulated seconds for each real second), `moons` (draw the planet's moons on their orbits),
 * `range` (planet radii the moons picture reaches), `scale-to` (draw to scale with another body), `span-km` (draw to scale: the half-width of the picture in kilometres, the same in every picture of a lineup), `live` (`always`, `hover` or `off`: when it takes the page's one WebGL context), `texture-base` (where the surface pictures are) and `lang` (`en` or `ja`).
 *
 * It carries the shared view controls itself: a drag turns the body, two fingers pinch, Ctrl, Command or Alt with the wheel zooms (the plain wheel scrolls the page at Fit), the arrow keys, + and - and 0 work once it is focused.
 * `controls="none"` turns them off, and `live="off"` (a still, a thumbnail) starts without them (`controls` with no value brings them back). `zoom-min` and `zoom-max` set the range (0.1 to 50 for the line drawing; for the shaded looks 0.1 up to where the body's detail runs out, 8 at least and 1000 at most: see the close zoom guide); a `<kazoku-view-controls for="...">` takes over and reads it.
 * Close up, `tiles` is where the finer map tiles are (a folder address; `off` for none; by default the demo site's, unless `texture-base` names your own pictures): a window of them is laid over the painted map for the part in view and let go when it is not, and the zoom range of a body with tiles grows with them.
 * Whatever moves the view, `setView` sends a `wakusei-view` event with its `yaw`, `tilt`, `roll`, `zoom`, `panX` and `panY`.
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
  static observedAttributes = ["body", "star", "quality", ...STAR_ATTRS, "look", "size", "time", "tilt", "pitch", "phase", "meridian", "turn", "rate", "moons", "range", "scale-to", "span-km", "fit", "live", "texture-base", "texture-far-base", "tiles", "data", "lang", "labels", "places", "surface-names", ...NAME_LABEL_ATTRIBUTES];

  #stage!: HTMLElement;
  #state: WakuseiState = "line";
  #renderer: SharedRenderer<ThreeParts> | undefined;
  #release: (() => void) | undefined;
  #view: View | undefined;
  #viewKey = "";
  #viewSig = "";
  #delegateEl: HTMLElement | undefined;
  #delegateKind = "";
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
  #onHidden = (): void => {
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
    const { width, height } = this.getBoundingClientRect();
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
  /** The marks laid on the body now: each place's id, its layer and where its mark is, in CSS pixels from the picture's top left. */
  get placesShown(): readonly { id: string; layer: PlaceLayer; x: number; y: number }[] {
    return this.#placeLayer?.shown ?? [];
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
    const frame = this.#frameNow();
    const aim = turnToPlace(frame.pose.pole, frame.pose.meridian, place.lat, place.lon);
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
    if (options.smooth === false || this.#reduce || this.#view?.live !== true || typeof requestAnimationFrame !== "function") {
      apply(to.yaw, to.tilt, true);
      return place;
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
    return place;
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
        pick: (place, at) => this.dispatchEvent(new CustomEvent("wakusei-place", { detail: { body, place, x: at.x, y: at.y }, bubbles: true, composed: true })),
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
    const scale: Vec3 = ax ? [ax[1] / facts.radiusKm, ax[2] / facts.radiusKm, ax[0] / facts.radiusKm] : [1, 1 - facts.flattening, 1];
    const marks = marksToShow(this.#placeList.list, layers, {
      centre: [0, 0, 0],
      radius: 1,
      pole: state.pose.pole,
      meridian: state.pose.meridian,
      scale,
      toward: [0, 0, 1],
      project: (p) => ({ x: ((p[0] - left) / (2 * halfW)) * w, y: ((top - p[1]) / (2 * halfH)) * h }),
      width: w,
      height: h,
      radiusPx: (Math.min(w, h) / 2) * (state.zoom / state.extent),
    }, facts.radiusKm, names, [], this.getAttribute("lang") === "ja" ? "ja" : "en");
    this.#placeLayer.set(marks);
  }

  /** What the element is doing now. */
  get state(): WakuseiState {
    return this.#state;
  }
  /** Numbers for a test or a status line: the state, the texture width in use and the renderer's own counts. */
  get stats(): { state: WakuseiState; textureWidth: number; anchors: number; renderer: SharedRenderer<ThreeParts>["stats"] | undefined; tiles: DetailStats | undefined; zoomMax: number | undefined; label: BodyScene["label"] | null } {
    return { state: this.#state, textureWidth: this.#textureWidth, anchors: this.#live.anchors, renderer: this.#renderer?.stats, tiles: (this.#view?.scene as BodyScene | undefined)?.detail ?? this.#tiles, zoomMax: this.#hands?.controller.limits.zoomMax, label: (this.#view?.scene as BodyScene | undefined)?.label ?? null };
  }

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = TEMPLATE;
    this.#stage = root.getElementById("stage")!;
    this.#startedAt = performance.now();
    this.#door.book.ownOnly(this.getAttribute("data") === "own");
    this.#reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.#clockFromAttributes();
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    this.#gate = createGate(1000 / frameCap(30, { deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, hardwareConcurrency: navigator.hardwareConcurrency }), () => this.#frame());
    if (typeof IntersectionObserver === "function") {
      this.#io = new IntersectionObserver((entries) => {
        const last = entries[entries.length - 1];
        if (last === undefined) return;
        this.#visible = last.isIntersecting;
        if (this.#visible) {
          this.#still();
          this.#resume();
          if (this.look !== "line" && this.#view?.live !== true && this.#hasPriority()) void this.goLive();
        }
        else this.#stopTick();
      });
      this.#io.observe(this);
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
    clearTimeout(this.#clockTimer);
    this.#clockTimer = undefined;
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

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    // the name on the globe is read again when its attributes, the body, a star's numbers or the language change
    if (name === "body" || name === "star" || name === "lang" || (NAME_LABEL_ATTRIBUTES as readonly string[]).includes(name)) this.#labelHeld = undefined;
    if (name === "time" || name === "rate") {
      this.#clockFromAttributes();
      this.#syncClock(true);
    }
    if (name === "data") this.#door.book.ownOnly(this.getAttribute("data") === "own");
    if (name === "live") this.#applyHover();
    if (name === "live" || name === "look" || name === "body") this.#carry();
    if (name === "body" || name === "look" || name === "moons" || name === "range" || name === "scale-to" || name === "span-km" || name === "fit" || name === "star") {
      if (name === "body" || name === "look") this.#tileLevels = undefined;
      this.#refreshLimits();
    }
    this.#lastAnchors = -1;
    if (name === "places" || name === "lang" || name === "body" || name === "look" || name === "star" || name === "surface-names") this.#markPlaces();
    this.#queue();
  }

  /** Put the picture on the page's one WebGL context and draw it, moving if it is asked to. Resolves true when it is live. A `line` look has nothing to take and resolves false. */
  async goLive(): Promise<boolean> {
    if (this.look === "line") return false;
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
    const half = Math.max(1, Math.min(this.clientWidth, this.clientHeight)) / 2;
    const [yaw, tilt, roll, zoom, panX, panY] = [view.yaw ?? 0, view.tilt ?? 0, view.roll ?? 0, view.zoom ?? 1, -(view.panX ?? 0) / half, (view.panY ?? 0) / half];
    if (yaw === this.#yaw && tilt === this.#tilt && roll === this.#roll && zoom === this.#zoom && panX === this.#panX && panY === this.#panY) return;
    [this.#yaw, this.#tilt, this.#roll, this.#zoom, this.#panX, this.#panY] = [yaw, tilt, roll, zoom, panX, panY];
    this.dispatchEvent(new CustomEvent("wakusei-view", { detail: { yaw: this.#yaw, tilt: this.#tilt, roll: this.#roll, zoom: this.#zoom, panX: view.panX ?? 0, panY: view.panY ?? 0 } }));
    this.#queue(true);
  }

  /** Take the shared hands, unless the picture is a still (`live="off"`) or another package's drawing (the Earth's line look); the look decides the zoom range, so a new look takes new hands. */
  #carry(): void {
    const on = this.getAttribute("live") !== "off" && !(this.look === "line" && delegates.has(this.body));
    const key = `${on}|${this.look === "line"}`;
    if (this.#handsKey === key) {
      this.#refreshLimits();
      return;
    }
    this.#hands?.unbind();
    this.#handsKey = key;
    const limits = this.#limits();
    this.#limitKey = `${limits.zoomMax}|${this.look}`;
    this.#hands = carryControls(this, { on, limits, grabRadius: this.discRadius, objectSize: { width: this.discRadius * 2, height: this.discRadius * 2 }, onChange: (view) => this.setView(view) });
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
      let base: Partial<StarNumbers> = {};
      if (value.startsWith("{")) base = JSON.parse(value) as Partial<StarNumbers>;
      else if (value !== "") base = starLookOf(value)?.numbers ?? { name: value };
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
        ...(pick("corona") !== null ? { corona: number("corona") } : {}),
        ...(pick("estimated") !== null ? { estimated: pick("estimated")!.split(",").map((part) => part.trim()).filter((part) => part !== "") as StarNumbers["estimated"] } : {}),
      } as StarNumbers;
      this.#starMade = starLook(numbers, { quality });
    } catch (error) {
      this.setAttribute("data-error", `star: ${error instanceof Error ? error.message : String(error)}`);
    }
    return this.#starMade;
  }

  /** The facts of what is drawn: the body's, or the star's (the Sun's with its own size, shape and outlines). */
  #facts(): BodyFacts {
    return this.#star()?.facts ?? BODIES[this.body];
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
        pitch: this.hasAttribute("pitch") ? num(this.getAttribute("pitch"), 0) : undefined,
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
    return this.#reduce ? r.turn !== 0 : turning;
  }

  // --- the state of the scene --------------------------------------------------------------------------------------------------------------------

  #sceneOf(frame: LiveFrame): SceneState {
    const pose: Pose = { pole: frame.pose.pole, meridian: frame.pose.meridian, light: frame.pose.light };
    const tiltBy = this.#pitchDelta - this.#tilt;
    if (this.#yaw !== 0) pose.meridian = turnVec(pose.meridian, pose.pole, this.#yaw);
    if (tiltBy !== 0) turnPose(pose, [1, 0, 0], tiltBy);
    const roll = -this.#roll;
    if (roll !== 0) turnPose(pose, [0, 0, 1], roll);
    const r = this.#request();
    const extent = this.#extent(r.moons);
    const moons = r.moons ? this.#moonsOf(frame, extent, tiltBy, roll) : undefined;
    const label = this.#labelNow();
    return { pose, extent, sky: frame.time !== undefined, zoom: this.#zoom, panX: clampPan(this.#panX, extent, this.#zoom), panY: clampPan(this.#panY, extent, this.#zoom), moons, label };
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
    return extentOf(this.#facts(), {
      tight: this.getAttribute("fit") === "tight",
      spanKm: span > 0 ? span : undefined,
      scaleTo: scaleTo !== null && scaleTo in BODIES ? scaleTo : undefined,
      moons,
      range: range !== undefined && range > 0 ? range : undefined,
    });
  }

  /**
   * The zoom range now: a line drawing to 50; a shaded body as far as its detail goes (`scene/reach.ts`), which depends on how big its picture is (the radii it reaches at zoom 1: a moons picture reaches
   * six or more), on the widest map it has (the finest tile level, once the tiles are found) and on whether its surface is soft.
   */
  #limits(): { zoomMin: number; zoomMax: number; tiltMax: number } {
    if (this.look === "line") return LINE_LIMITS;
    if (this.hasAttribute("star")) return { zoomMin: 0.1, zoomMax: zoomLimit(1, 0, false), tiltMax: 90 };
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

  #moonsOf(frame: LiveFrame, extent: number, tilt: number, roll: number): MoonDraw[] {
    const moons: MoonDraw[] = [];
    for (const m of frame.moons) {
      if (m.distance <= extent * 1.05) {
        const orbit = this.#orbits.get(m.id as string);
        const tipped = tilt === 0 ? ([m.x, m.y, m.z] as Vec3) : turnVec([m.x, m.y, m.z], [1, 0, 0], tilt);
        const rotated = roll === 0 ? tipped : turnVec(tipped, [0, 0, 1], roll);
        moons.push({ id: m.id, x: rotated[0], y: rotated[1], z: rotated[2], orbit: orbit === undefined || (tilt === 0 && roll === 0) ? orbit : this.#tiltedOrbit(m.id as string, orbit, tilt, roll) });
      }
    }
    return moons;
  }

  #tilted = new Map<string, { source: Float32Array; tilt: number; roll: number; out: Float32Array }>();
  #tiltedOrbit(id: string, orbit: Float32Array, tilt: number, roll: number): Float32Array {
    const held = this.#tilted.get(id);
    if (held !== undefined && held.source === orbit && held.tilt === tilt && held.roll === roll) return held.out;
    const out = new Float32Array(orbit.length);
    for (let i = 0; i < orbit.length; i += 3) {
      const tipped = turnVec([orbit[i]!, orbit[i + 1]!, orbit[i + 2]!], [1, 0, 0], tilt);
      const v = roll === 0 ? tipped : turnVec(tipped, [0, 0, 1], roll);
      out[i] = v[0];
      out[i + 1] = v[1];
      out[i + 2] = v[2];
    }
    this.#tilted.set(id, { source: orbit, tilt, roll, out });
    return out;
  }

  /** The moons of Jupiter and Saturn follow their theories once those are fetched; until then the fitted orbits answer. */
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
    if (!r.moons || frame.time === undefined) return;
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

  async #refresh(): Promise<void> {
    if (!this.isConnected) return;
    this.setAttribute("aria-label", this.#label());
    if (this.hasAttribute("size")) this.style.setProperty("--wakusei-size", `${num(this.getAttribute("size"), 320)}px`);
    if (this.hasAttribute("star") && this.#star() === undefined) {
      this.#disposeView(true);
      this.#stage.innerHTML = "";
      this.#set("line");
      return;
    }
    const delegate = this.look === "line" ? delegates.get(this.body) : undefined;
    if (delegate !== undefined && (await this.#delegated(delegate))) return;
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
      if (undelegated) this.#resume();
      return;
    }
    const sig = `${this.#star()?.key ?? this.body}|${this.look}`;
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

  #label(): string {
    const star = this.#star();
    const ja = this.getAttribute("lang") === "ja";
    if (star !== undefined) return this.look === "line" ? (ja ? `${star.facts.name.ja}の線画。${star.disclaimer.ja}` : `${star.facts.name.en}, line drawing. ${star.disclaimer.en}`) : ja ? `${star.facts.name.ja}の陰影つきの絵。${star.disclaimer.ja}` : `${star.facts.name.en}, shaded star. ${star.disclaimer.en}`;
    const f = BODIES[this.body];
    const looks = { line: ja ? "線画" : "line drawing", realistic: ja ? "表面の地図" : "painted surface", painted: ja ? "表面の地図" : "painted surface", illustrated: ja ? "イラスト" : "illustrated drawing" } as const;
    return ja ? `${f.name.ja}の${looks[this.look]}` : `${f.name.en}, ${looks[this.look]}`;
  }

  #drawLine(): void {
    const r = this.#request();
    const frame = this.#frameNow();
    const scaleTo = this.getAttribute("scale-to") as BodyId | null;
    const stroke = getComputedStyle(this).getPropertyValue("--wakusei-line").trim();
    const paper = getComputedStyle(this).getPropertyValue("--wakusei-paper").trim();
    const scene = this.#sceneOf(frame);
    const size = 480;
    const star = this.#star();
    const draw = star === undefined ? (options: Parameters<typeof lineSvg>[1]) => lineSvg(this.body, options) : (options: Parameters<typeof lineSvg>[1]) => starLineSvg(star, options);
    const html = draw({
      size,
      pose: scene.pose,
      ...(r.moons ? { moons: true, ...(frame.time !== undefined ? { time: frame.time } : {}), range: scene.extent, moonsAt: (scene.moons ?? []).map((m) => ({ id: m.id as MoonId, x: m.x, y: m.y, z: m.z, distance: Math.hypot(m.x, m.y, m.z) })), orbits: new Map((scene.moons ?? []).filter((m) => m.orbit !== undefined).map((m) => [m.id as string, m.orbit!])) } : {}),
      fill: scaleTo !== null || this.hasAttribute("span-km") || this.getAttribute("fit") !== "tight" ? this.#fill() : undefined,
      lang: this.getAttribute("lang") === "ja" ? "ja" : undefined,
      labels: this.getAttribute("labels") === "off" ? false : undefined,
      stroke: stroke || undefined,
      paper: paper || undefined,
      ...(this.#zoom !== 1 ? { zoom: this.#zoom, panX: scene.panX, panY: scene.panY } : {}),
    });
    this.#stage.innerHTML = html;
  }

  #key(state: SceneState): string {
    const moons = (state.moons ?? []).map((m) => `${m.id}:${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(";");
    return `${this.#star()?.key ?? this.body}|${this.look}|${vectorKey(state.pose.pole)}|${vectorKey(state.pose.meridian)}|${vectorKey(state.pose.light)}|${state.extent.toFixed(2)}|${state.zoom.toFixed(2)}|${state.panX.toFixed(2)},${state.panY.toFixed(2)}|${moons}|${this.#labelKey()}`;
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
    this.#viewSig = `${this.#star()?.key ?? this.body}|${this.look}`;
    this.#stilled = false;
    this.#stage.innerHTML = "";
    const star = this.#star();
    const item = createBodyItem({
      id: this.body,
      ...(star === undefined ? {} : { shaded: star.look, facts: star.facts, assetKey: `star:${star.key}` }),
      look: this.look === "illustrated" ? "realistic" : "painted",
      key: this.#viewKey,
      state: () => this.#sceneState ?? state,
      ...texturePaths(this),
      wantedWidth: (discPx) => discPx * Math.min(2, window.devicePixelRatio || 1) * 1.6,
      tiles: {
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
  async #delegated(delegate: NonNullable<ReturnType<typeof delegates.get>>): Promise<boolean> {
    if (this.#view !== undefined) {
      this.#disposeView();
    }
    const center = this.hasAttribute("meridian") ? `${num(this.getAttribute("meridian"), 10)},20` : "10,20";
    const size = Math.round(this.clientWidth || 320);
    const fill = this.#fill();
    const key = `line|${center}|${fill}`;
    if (this.#delegateEl !== undefined && this.#delegateKind === key) return true;
    const el = await delegate.line({ center, size });
    if (el === null) return false;
    this.#delegateEl?.remove();
    this.#stage.innerHTML = "";
    el.style.cssText = `display:block;width:${fill * 100}%;height:${fill * 100}%;aspect-ratio:1;position:absolute;left:${(1 - fill) * 50}%;top:${(1 - fill) * 50}%`;
    this.#stage.append(el);
    this.#delegateEl = el;
    this.#delegateKind = key;
    this.#set("line");
    return true;
  }

  /** How much of the picture's width the body's disc takes: 1 alone, less in a scale picture (`scale-to`, `span-km`). */
  #fill(): number {
    const scaleTo = this.getAttribute("scale-to") as BodyId | null;
    const span = num(this.getAttribute("span-km"), 0);
    const half = span > 0 ? span : scaleTo !== null && scaleTo in BODIES ? BODIES[scaleTo].radiusKm * 1.06 : 0;
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
    else if (this.look === "line" && this.#visible && this.#moving) this.#lineTick();
  }

  #lineTick(): void {
    this.#stopTick();
    // a body another package draws (the Earth's globe) is that package's to turn: this package's line drawn here would replace it
    if (!this.#visible || document.visibilityState === "hidden" || !this.#moving || this.look !== "line" || this.#delegateEl !== undefined) return;
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
    if (state === "unavailable") this.#drawLine();
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wakusei-body")) customElements.define("wakusei-body", WakuseiBody);

