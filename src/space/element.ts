// <wakusei-space>: the Earth, the Moon, the Sun and the planets where they are at a date and time, drawn with three.js through kazoku-ui's shared renderer. Optional: the line drawings and
// the single bodies need none of it. It draws only when something changes, at most 30 times a second, and nothing while it is out of sight.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { carryControls, type ElementControls, type ViewController } from "@johnmorrisdotca/kazoku-ui/view-controls";
import { BODIES, MOONS_OF, type MoonId } from "../facts.ts";
import { createGate, frameCap, type Gate } from "../gate.ts";
import { createGameClock, type GameClock } from "./clock.ts";
import { createPainter, type WakuseiPainter } from "../scene/painter.ts";
import type { ThreeParts } from "../scene/body.ts";
import { setThreeLoader, takeRenderer } from "../scene/shared.ts";
import { texturePaths, tilesBase } from "../scene/textures.ts";
import { AU_IN_EARTH_RADII, EARTH_RADIUS_KM, frameAt, SPACE_PLANETS, type SpacePlanet } from "./frame.ts";
import { moonDistance, placeBodies, radiusIn, type ScaleMode } from "./scale.ts";
import type { RideLook } from "./ride.ts";
import { createSpaceItem, FIT_DISTANCE, newSpaceModel, SPACE_BODIES, type BodyPlace, type RidePoint, type RideState, type RideTarget, type SpaceBody, type SpaceLight, type SpaceModel } from "./scene.ts";

export { setThreeLoader, SPACE_BODIES, type RidePoint, type RideTarget, type SpaceBody, type SpaceLight };

/**
 * What a page can tell a reader about a body now.
 *
 * @example
 * ```ts no-run
 * import type { BodyInfo } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const info: BodyInfo = { id: "mars", name: "Mars", radiusKm: 3389.5, distanceKm: 225_000_000 };
 * console.log(`${info.name}: ${info.radiusKm} km`);
 * ```
 */
export interface BodyInfo {
  id: SpaceBody;
  /** The name shown beside the body. */
  name: string;
  /** Mean radius, kilometres. */
  radiusKm: number;
  /** Distance from the Earth's centre now, kilometres (0 for the Earth). */
  distanceKm: number;
}

/**
 * What the space view is doing: `loading`, `live`, `unavailable` (no WebGL), `lost` (the GPU took the context; it comes back by itself).
 *
 * @example
 * ```ts no-run
 * import type { SpaceState, WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const stateOf = (space: WakuseiSpace): SpaceState => space.stats.state;
 * console.log(typeof stateOf);
 * ```
 */
export type SpaceState = "loading" | "live" | "unavailable" | "lost";

/**
 * A named distance for `zoomFor`: the Earth, the Moon, the Sun, the inner planets, the whole solar system, or a planet with its nearer moons (`jupiter-moons`).
 *
 * @example
 * ```ts no-run
 * import type { SpacePreset, WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const zoomTo = (space: WakuseiSpace, preset: SpacePreset): number => space.zoomFor(preset);
 * console.log(typeof zoomTo);
 * ```
 */
export type SpacePreset = "earth" | "moon" | "sun" | "inner" | "solar-system" | `${Exclude<SpacePlanet, "mercury" | "venus">}-moons`;

/**
 * How a ride along is done: `view` `from` (the default) puts the camera at the target looking at the body it goes round, `follow` keeps it a distance from the target looking at it (`distanceKm`,
 * 3000 by default, for a point of your own; a body or a moon is kept at the distance the zoom says); `look` `down` (the default) or `horizon` is where a camera at the target points; `around` is the
 * body a point of your own goes round (the Earth by default); `smooth` (the default) glides from the old camera to the new one in about a second and a bit, and jumps instead for a reader who asked for reduced motion.
 *
 * @example
 * ```ts no-run
 * import type { RideOptions } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const options: RideOptions = { view: "from", look: "horizon", around: "mars" };
 * console.log(options.look);
 * ```
 */
export interface RideOptions {
  view?: "from" | "follow";
  look?: RideLook;
  distanceKm?: number;
  around?: SpaceBody;
  smooth?: boolean;
}

/**
 * What the camera is riding along with now: the target, the body it goes round, how (`from` or `follow`), where it looks, and the distance kept for a point.
 *
 * @example
 * ```ts no-run
 * import type { Riding } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const describe = (ride: Riding | null): string => (ride ? `${ride.view} ${typeof ride.target === "string" ? ride.target : "a point"}` : "not riding");
 * console.log(typeof describe);
 * ```
 */
export type Riding = RideState;

const readLight = (value: string | null): SpaceLight => (value === "lit" ? "lit" : "sun");
const RAD = Math.PI / 180;
const REAL_TIME_TICK_MS = 60_000;
/** The least time between two `wakusei-timechange` events while time runs: a few a second at most, however fast the picture is drawn. */
const TIME_EVENT_MS = 250;

const readCentre = (value: string | null): { lon: number; lat: number } | null => {
  if (!value) return null;
  const [lon, lat] = value.split(",").map((part) => Number(part.trim()));
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon!) > 180 || Math.abs(lat!) > 90) return null;
  return { lon: lon!, lat: lat! };
};
const readTime = (value: string | null): number | "now" => {
  if (value === null || value === "" || value === "now") return "now";
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : "now";
};
const readBody = (value: string): SpaceBody | undefined => {
  const id = value.toLowerCase();
  return (SPACE_BODIES as readonly string[]).includes(id) ? (id as SpaceBody) : undefined;
};

/**
 * The zoom range of the space view when it carries its own controls. The floor, a millionth, takes the camera out past Neptune in the true scale. The ceiling is where the camera reaches the body: it is held at
 * 1.05 radii from the surface (`FIT_DISTANCE` over the zoom), so past a zoom of about 3.2 nothing moves; 3 is where the finest map tiles of the Earth, Mars and the Moon (16384 pixels round) run out of detail too, so it is the same ceiling for both.
 */
const CARRIED_LIMITS = { zoomMin: 1e-6, zoomMax: 3, tiltMax: 90 } as const;

const STYLE = `<style>:host{display:block;aspect-ratio:1/1;position:relative;overflow:hidden}#stage,#labels{position:absolute;inset:0}#labels{pointer-events:none;overflow:hidden}.sp-label{position:absolute;left:0;top:0;margin:0;padding:0;border:0;background:none;font:12px/16px system-ui,-apple-system,sans-serif;color:#fff;white-space:nowrap;text-shadow:0 0 3px #000,0 0 3px #000;will-change:transform;pointer-events:none}.sp-label:focus-visible{outline:2px solid #6cd0ff;outline-offset:2px;border-radius:4px}.sp-label::before{content:"";display:inline-block;width:5px;height:5px;margin:0 5px 1px -2px;border-radius:50%;background:#fff}.sp-label[hidden]{display:none}</style><div id="stage"></div><div id="labels"></div>`;

/**
 * The `<wakusei-space>` custom element: the Earth, the Moon, the Sun and the planets where they are at a date and time, drawn with three.js through the shared renderer. It takes `center`
 * (`"lon,lat"`), `time` (`now` or an ISO date), `speed` (1 is real time, 0 holds, 86400 is a day a second, negative runs backwards), `scale` (`compressed` or `true`), `look` (`realistic` or `painted`),
 * `light` (`sun` or `lit`), `lang` (`en` or `ja`: the names), `labels` and `orbits` (`off` hides them), and `texture-base`, `texture-far-base`, `max-texture` and `tiles` (where the finer map tiles are, for a close zoom; `off` for none). Positions come from this package's own models. It draws
 * only when something changes, and nothing while it is out of sight.
 *
 * It carries the shared view controls itself: a drag turns the camera round the body, two fingers pinch, Ctrl, Command or Alt with the wheel zooms (the plain wheel scrolls the page), and the arrow keys, + and - and 0 work once it is
 * focused. `controls="none"` turns them off; `zoom-min` and `zoom-max` set the range (a millionth to 3 by default); a `<kazoku-view-controls for="...">` takes over and reads it.
 *
 * While time runs (`speed` is not 0) it sends `wakusei-timechange` with `detail: { time, running: true }`, `time` being the moment shown in milliseconds since 1970, at most four times a second however fast the picture is
 * drawn, and once with `running: false` when the clock holds (`speed` set to 0): a page writes the date into its date box from it. It is not sent for a `time` the page sets itself. `wakusei-time` is sent at every step the clock takes.
 *
 * @example
 * ```ts no-run
 * import type { WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const space = document.createElement("wakusei-space") as WakuseiSpace;
 * space.setAttribute("time", "2026-11-02T12:00Z");
 * space.setAttribute("speed", "86400");
 * space.addEventListener("wakusei-timechange", (event) => {
 *   const { time, running } = (event as CustomEvent<{ time: number; running: boolean }>).detail;
 *   console.log(new Date(time).toISOString(), running ? "running" : "held");
 * });
 * document.body.append(space);
 * ```
 */
export class WakuseiSpace extends HTMLElement {
  static observedAttributes = ["center", "time", "speed", "scale", "labels", "orbits", "look", "light", "lang"];

  #model: SpaceModel = newSpaceModel();
  #clock: GameClock = createGameClock("now", 1);
  #view: View | undefined;
  #gate: Gate | undefined;
  #taken: { renderer: SharedRenderer<ThreeParts>; release(): void } | undefined;
  #stage: HTMLElement | undefined;
  #labelBox: HTMLElement | undefined;
  #state: SpaceState = "loading";
  #timer: ReturnType<typeof setTimeout> | undefined;
  #announced = -Infinity;
  #pool = new Map<SpaceBody, HTMLElement>();
  #places: Record<SpaceBody, BodyPlace | null> | undefined;
  #names: Partial<Record<SpaceBody, string>> = {};
  #hint = "choose to look at it";
  #painter: WakuseiPainter | undefined;
  #focusBeforeRide: SpaceBody = "earth";
  #lostTold = false;
  #hands: ElementControls | undefined;

  /** The shared controller behind the element's own hands: for a page that moves the view itself, such as `controller.set({ zoom: space.zoomFor("moon") })`. It is there while the element is connected, whether `controls` is `none` or not. */
  get controller(): ViewController | undefined {
    return this.#hands?.controller;
  }

  connectedCallback(): void {
    this.#model.centre = readCentre(this.getAttribute("center")) ?? this.#model.centre;
    this.#clock = createGameClock(readTime(this.getAttribute("time")), this.#readSpeed());
    this.#model.time = this.#clock.time;
    this.#model.mode = this.getAttribute("scale") === "true" ? "true" : "compressed";
    this.#model.labels = this.getAttribute("labels") !== "off";
    this.#model.orbits = this.getAttribute("orbits") !== "off";
    this.#model.look = this.getAttribute("look") === "painted" ? "painted" : "realistic";
    this.#model.light = readLight(this.getAttribute("light"));
    this.#model.stepMs = Math.max(1000, Math.abs(this.#clock.speed) * 1000);
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", "The Earth, the Moon, the Sun and the planets in their places for the date shown");

    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = STYLE;
    this.#stage = root.getElementById("stage")!;
    this.#labelBox = root.getElementById("labels")!;
    this.#pool.clear();

    const nav = navigator as Navigator & { deviceMemory?: number };
    this.#gate = createGate(1000 / frameCap(30, { deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency }), () => this.#view?.invalidate());
    this.#stage.addEventListener("webglcontextlost", this.#lost, true);
    this.#stage.addEventListener("webglcontextrestored", this.#restored, true);

    const taken = takeRenderer((state) => {
      if (state === "unavailable") this.#fail("WebGL is not available");
    });
    this.#taken = taken;
    const item = createSpaceItem(this.#model, {
      painter: () => this.#painterNow(),
      cap: () => this.#textureCap(),
      invalidate: () => this.#gate?.request(),
      advance: () => this.#advance(),
      onLabels: (places) => this.#placeLabels(places),
      onMoving: () => this.#gate?.request(),
      onRideLost: () => this.#rideLost(),
      onPainterError: (error) => this.dispatchEvent(new CustomEvent("wakusei-bodies-unavailable", { detail: { reason: error instanceof Error ? error.message : String(error) } })),
    });
    this.#view = taken.renderer.view(this.#stage, item, { still: null });
    this.#set("loading");
    void this.#view.focus().then((live) => {
      if (live) {
        this.#set("live");
        this.dispatchEvent(new CustomEvent("wakusei-ready"));
      } else if (this.#state === "loading") this.#set("unavailable");
    });
    this.#schedule();
    this.addEventListener("pointerdown", this.#down);
    this.#hands = carryControls(this, { limits: CARRIED_LIMITS, onChange: (view, info) => this.setView(view, info.final) });
    this.#labelBox.addEventListener("click", this.#labelClick);
    this.#labelBox.addEventListener("focusin", this.#labelFocus);
  }

  disconnectedCallback(): void {
    this.#hands?.unbind();
    this.#hands = undefined;
    this.removeEventListener("pointerdown", this.#down);
    window.removeEventListener("pointerup", this.#up, true);
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#gate?.cancel();
    this.#view?.dispose();
    this.#view = undefined;
    this.#taken?.release();
    this.#taken = undefined;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "center") this.centre = readCentre(value) ?? { lon: 0, lat: 0 };
    else if (name === "time") this.time = readTime(value);
    else if (name === "speed") this.speed = this.#readSpeed();
    else if (name === "scale") this.scale = value === "true" ? "true" : "compressed";
    else if (name === "labels") this.labels = value !== "off";
    else if (name === "orbits") this.orbits = value !== "off";
    else if (name === "look") this.look = value === "painted" ? "painted" : "realistic";
    else if (name === "light") this.light = readLight(value);
    else if (name === "lang") for (const [id, button] of this.#pool) this.#nameLabel(button, id);
  }

  /** The home place the camera starts above, as longitude and latitude in degrees. */
  get centre(): { lon: number; lat: number } {
    return { ...this.#model.centre };
  }
  set centre(value: { lon: number; lat: number }) {
    this.#model.centre = { ...value };
    this.#gate?.request();
  }

  /** The moment shown: milliseconds since the epoch, or "now" to follow the clock. Setting it points the camera at the same place on the ground again. */
  get time(): number {
    this.#advance();
    return this.#model.time;
  }
  set time(value: number | Date | "now") {
    this.#clock.set(value instanceof Date ? value.getTime() : value);
    this.#model.time = this.#clock.time;
    this.#model.anchor = null;
    this.#schedule();
    this.#gate?.request();
  }

  /** Seconds of game time per second: 1 is real time, 0 holds still, negative runs backwards. */
  get speed(): number {
    return this.#clock.speed;
  }
  set speed(value: number) {
    // time up to this moment is worked out at the old speed (the clock does that), so a hold keeps the moment the reader saw last
    const was = this.#clock.speed;
    this.#clock.setSpeed(value);
    if (this.isConnected) this.#model.time = this.#clock.time;
    this.#model.stepMs = Math.max(1000, Math.abs(this.#clock.speed) * 1000);
    this.#schedule();
    this.#gate?.request();
    if (this.#clock.speed === 0 && was !== 0) this.#announce(false);
  }

  /** `compressed` (the default: every direction real, the distances squeezed) or `true` (real distances and sizes). */
  get scale(): ScaleMode {
    return this.#model.mode;
  }
  set scale(value: ScaleMode) {
    this.#model.mode = value;
    this.#gate?.request();
  }

  get labels(): boolean {
    return this.#model.labels;
  }
  set labels(value: boolean) {
    this.#model.labels = value;
    if (!value) for (const label of this.#pool.values()) label.hidden = true;
    this.#gate?.request();
  }

  get orbits(): boolean {
    return this.#model.orbits;
  }
  set orbits(value: boolean) {
    this.#model.orbits = value;
    this.#gate?.request();
  }

  /** How the bodies are drawn: `realistic` (shaded from the body's real colours and features) or `painted` (public-domain surface maps). */
  get look(): "realistic" | "painted" {
    return this.#model.look === "painted" ? "painted" : "realistic";
  }
  set look(value: "realistic" | "painted") {
    this.#model.look = value;
    this.#gate?.request();
  }

  /** How the Earth is lit: `sun` (true, the default) or `lit` (as if by daylight from the camera's side, so the night side is never a black frame). The Sun, the Moon and the planets keep their true places. */
  get light(): SpaceLight {
    return this.#model.light;
  }
  set light(value: SpaceLight) {
    this.#model.light = value;
    this.#gate?.request();
  }

  /**
   * The shared controls' camera: yaw and tilt turn the view (the Earth's surface moves right for a drag right and up for a drag up), zoom brings the camera in (1 shows the body looked at, less shows the sky round it), `roll` (degrees) turns the picture clockwise about the line of sight, and `panX` and `panY` move everything in the picture by exactly that many CSS pixels (right and down are positive). A turn that
   * moves nothing on the screen by half a pixel is kept for the next draw but does not cause one unless `final` is true (the default).
   *
   * @param view - The controls' yaw and tilt in degrees and zoom.
   * @param final - False for the frames of a turn that is still going on (Auto-turn, a drag); true when it has settled.
   */
  setView(view: { yaw: number; tilt: number; zoom: number; roll?: number; panX?: number; panY?: number }, final = true): void {
    const now = this.#model.view;
    const [roll, panX, panY] = [view.roll ?? 0, view.panX ?? 0, view.panY ?? 0];
    if (view.yaw === now.yaw && view.tilt === now.tilt && view.zoom === now.zoom && roll === now.roll && panX === now.panX && panY === now.panY) return;
    this.#model.view = { yaw: view.yaw, tilt: view.tilt, zoom: view.zoom, roll, panX, panY };
    this.dispatchEvent(new CustomEvent("wakusei-view", { detail: { yaw: view.yaw, tilt: view.tilt, zoom: view.zoom, roll, panX, panY } }));
    const drawn = this.#model.drawnView;
    if (drawn && !final && view.zoom === drawn.zoom) {
      const turned = Math.max(Math.abs(view.yaw - drawn.yaw), Math.abs(view.tilt - drawn.tilt), Math.abs(roll - drawn.roll)) * RAD;
      if (turned * (this.#model.heightPx / 2) < 0.5 && Math.max(Math.abs(panX - drawn.panX), Math.abs(panY - drawn.panY)) < 0.5) return;
    }
    this.#gate?.request();
  }

  /** The body the camera looks at (`earth`, `sun`, `moon`, `mercury` to `neptune`, `pluto`): at zoom 1 it fills the view; the yaw and tilt turn the camera round it. */
  get body(): SpaceBody {
    return this.#model.focus;
  }
  set body(name: SpaceBody) {
    const id = readBody(name);
    if (!id) return;
    this.#model.focus = id;
    this.#gate?.request();
  }

  /** The words shown beside each body, for a page in another language (`{ mars: "火星" }`). A body left out keeps its name in the element's `lang`. */
  get bodyNames(): Partial<Record<SpaceBody, string>> {
    return { ...this.#names };
  }
  set bodyNames(value: Partial<Record<SpaceBody, string>>) {
    this.#names = { ...value };
    for (const [id, button] of this.#pool) this.#nameLabel(button, id);
  }

  /** What a screen reader hears after a body's name: "choose to look at it" by default, or the page's own words. */
  get bodyHint(): string {
    return this.#hint;
  }
  set bodyHint(value: string) {
    this.#hint = value;
    for (const [id, button] of this.#pool) this.#nameLabel(button, id);
  }

  /** The name, radius and distance from the Earth of a body now, for a page's own caption. */
  bodyInfo(id: SpaceBody): BodyInfo {
    const frame = this.#model.drawn?.frame ?? frameAt(this.#model.time);
    const geo = id === "earth" ? ([0, 0, 0] as const) : id === "sun" ? frame.sun : id === "moon" ? frame.moon : frame.planets[id];
    return { id, name: this.#nameOf(id), radiusKm: BODIES[id].radiusKm, distanceKm: Math.hypot(geo[0], geo[1], geo[2]) * AU_IN_EARTH_RADII * EARTH_RADIUS_KM };
  }

  // --- riding along -------------------------------------------------------------------------------------------------------------------------------
  /**
   * Ride along with a body, a moon or a moving point of your own. By default the camera sits at it and looks at the body it goes round, with the way it is going at the top of the picture, at its real place for the moment shown,
   * so the ground slides beneath as it moves along its orbit. A drag looks about from there (a drag right turns the camera to its left and a drag up tips it towards the bottom of its picture, so the ground follows the pointer), the shared
   * controls' zoom narrows the view. A body of the view (`"moon"`, `"mars"`) goes round the Earth; a moon (`"io"`) goes round its planet; a point of your own (`{ at(ms) }`, a satellite, a probe) goes round `around` (the Earth by default) and the
   * element knows nothing of what it is. Another call switches smoothly; `null` stops. The draw rate follows how fast the picture moves, never more than 30 a second (one a second for a reader who asked for reduced motion), and nothing is drawn out of sight.
   *
   * @param target - A body name, a moon name, a point, or `null` to stop.
   * @param options - `view`, `look`, `distanceKm`, `around`, `smooth` (see `RideOptions`).
   */
  ride(target: RideTarget | null, options: RideOptions = {}): void {
    const model = this.#model;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wasRiding = model.ride !== null;
    if (target === null) {
      model.ride = null;
      model.focus = this.#focusBeforeRide;
    } else {
      const found = this.#resolveRide(target, options);
      if (!found) return;
      if (!wasRiding) this.#focusBeforeRide = model.focus;
      model.ride = found;
      if (found.view === "follow" && typeof target === "string" && (SPACE_BODIES as readonly string[]).includes(target)) model.focus = target as SpaceBody;
      else if (wasRiding) model.focus = this.#focusBeforeRide;
    }
    this.#lostTold = false;
    const pose = model.pose;
    model.transition = (options.smooth ?? true) && !reduced && pose.valid ? { start: performance.now(), duration: 1200, from: { p: [pose.p[0], pose.p[1], pose.p[2]], q: [pose.q[0], pose.q[1], pose.q[2], pose.q[3]], fov: pose.fov } } : null;
    this.#schedule();
    this.#gate?.request();
    this.dispatchEvent(new CustomEvent("wakusei-ride", { detail: this.riding }));
  }

  #resolveRide(target: RideTarget, options: RideOptions): RideState | undefined {
    const look = options.look ?? "down";
    const distanceKm = Math.max(100, options.distanceKm ?? 3000);
    if (typeof target !== "string") {
      const around = options.around && (SPACE_BODIES as readonly string[]).includes(options.around) ? options.around : "earth";
      return { target, around, view: options.view ?? "from", look, distanceKm };
    }
    const id = target.toLowerCase();
    if ((SPACE_BODIES as readonly string[]).includes(id)) return { target: id as SpaceBody, around: "earth", view: id === "earth" ? "follow" : (options.view ?? "from"), look, distanceKm };
    for (const [planet, moons] of Object.entries(MOONS_OF)) {
      if (!(moons as readonly string[]).includes(id) || !(SPACE_BODIES as readonly string[]).includes(planet) || planet === "earth") continue;
      return { target: id as MoonId, around: planet as SpaceBody, view: options.view ?? "from", look, distanceKm };
    }
    return undefined;
  }

  /** What the camera is riding along with now, or null. */
  get riding(): Riding | null {
    return this.#model.ride ? { ...this.#model.ride } : null;
  }

  #rideLost(): void {
    if (this.#lostTold) return;
    this.#lostTold = true;
    this.dispatchEvent(new CustomEvent("wakusei-ride-lost", { detail: this.riding }));
  }

  /** The zoom that shows a part of the sky: the Earth alone, the Moon's orbit, the Sun, the planets out to Mars, all of them, or a planet's nearer moons, at this scale and moment. */
  zoomFor(preset: SpacePreset): number {
    const mode = this.#model.mode;
    if (preset.endsWith("-moons")) {
      const id = preset.slice(0, -6) as SpacePlanet;
      const sites = this.#painterNow().moons(id, this.#model.time);
      const reach = Math.max(1, ...sites.map((site) => moonDistance(mode, id, Math.hypot(...site.offset))).filter((r) => r <= 22));
      const radius = radiusIn(id, mode);
      return Math.min(1, (FIT_DISTANCE * radius) / ((reach * radius * 1.15) / Math.tan(17.5 * RAD)));
    }
    const frame = this.#model.drawn?.frame ?? frameAt(this.#model.time);
    const places = placeBodies(mode, frame);
    const away = (id: SpaceBody): number => Math.hypot(...places[id]);
    const reach = {
      earth: 0,
      moon: away("moon"),
      sun: away("sun"),
      inner: Math.max(away("mercury"), away("venus"), away("mars"), away("sun")),
      "solar-system": Math.max(...SPACE_PLANETS.map(away), away("sun")),
    }[preset as Exclude<SpacePreset, `${string}-moons`>];
    return preset === "earth" ? 1 : FIT_DISTANCE / Math.max(FIT_DISTANCE, reach * 3.4);
  }

  /** What the element is doing, for a page or a test. */
  get stats(): {
    state: SpaceState;
    draws: number;
    contexts: number;
    canvas: { width: number; height: number; pixels: number };
    /** How far the camera is from the body it looks at, in that body's radii. */
    distance: number;
    assets: { entries: number; refs: number };
    time: number;
    /** How many frames the ephemeris has worked out. */
    lookups: number;
    /** The camera as the last draw left it: its place in Earth radii from the Earth's centre, and its field of view in degrees. */
    camera: { position: [number, number, number]; fov: number };
    /** What the painter has made at the last draw: the bodies with a drawing, the moons shown round a planet that is near, and the moons made and not yet let go. */
    bodies: { look: string; painted: number; moons: number; held: number };
    /** What the windows of finer map tiles on the bodies are doing at the last draw, summed: tile fetches made, tiles being fetched, tiles or windows that failed, and the finest level on a body now (`null` for none). */
    tiles: { requested: number; loading: number; failed: number; shown: number | null };
    ride: { riding: boolean; lost: boolean; gliding: boolean };
  } {
    const stats = this.#taken?.renderer.stats;
    return {
      state: this.#state,
      draws: stats?.draws ?? 0,
      contexts: stats?.contexts ?? 0,
      canvas: stats?.canvas ?? { width: 0, height: 0, pixels: 0 },
      distance: this.#model.drawn?.distance ?? 0,
      assets: { entries: stats?.assets.entries ?? 0, refs: stats?.assets.refs ?? 0 },
      time: this.time,
      lookups: this.#model.lookups,
      camera: { position: [...this.#model.camera.position], fov: this.#model.camera.fov },
      bodies: { look: this.#model.look, painted: this.#model.painted.bodies, moons: this.#model.painted.moons, held: this.#model.painted.held },
      tiles: { ...this.#model.tiles },
      ride: { riding: this.#model.ride !== null, lost: this.#model.rideLost, gliding: this.#model.transition !== null },
    };
  }

  // --- the game clock ----------------------------------------------------------------------------------------------------------------------------
  #readSpeed(): number {
    const raw = this.getAttribute("speed");
    const value = raw === null || raw === "" ? 1 : Number(raw);
    return Number.isFinite(value) ? value : 1;
  }

  /** While time runs, draw as often as it shows: real time once a minute; faster time as often as the fastest turning body in sight moves a pixel (1 to 30 times a second). A ride along moves the whole picture, so real time draws about as often as a pixel moves (once a second at least), and a reader who asked for reduced motion gets one step a second. */
  #schedule(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    if (!this.isConnected || this.#clock.speed === 0) return;
    const riding = this.#model.ride !== null;
    const pixels = Math.max(this.#model.motion || 0.015, this.#model.rideMotion) * Math.abs(this.#clock.speed);
    let perSecond = Math.min(30, Math.max(1, pixels));
    if (riding && typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) perSecond = 1;
    const wait = !riding && this.#clock.speed === 1 ? REAL_TIME_TICK_MS : 1000 / perSecond;
    this.#timer = setTimeout(this.#tick, wait);
  }

  /** Bring the moment shown up to the page's clock, by the time that really passed at the speed it has run at, however few frames were drawn (`createGameClock`). */
  #advance(): void {
    if (this.isConnected) this.#model.time = this.#clock.advance();
  }

  /** Tell the page the moment shown: at most four times a second while time runs (`running`), and once, at once, when it holds. */
  #announce(running: boolean): void {
    const now = performance.now();
    if (running && now - this.#announced < TIME_EVENT_MS) return;
    this.#announced = running ? now : -Infinity;
    this.dispatchEvent(new CustomEvent("wakusei-timechange", { detail: { time: this.#model.time, running } }));
  }

  #tick = (): void => {
    this.#advance();
    this.#gate?.request();
    this.#schedule();
    this.dispatchEvent(new CustomEvent("wakusei-time", { detail: { time: this.#model.time } }));
    this.#announce(this.#clock.speed !== 0);
  };

  // --- labels --------------------------------------------------------------------------------------------------------------------------------------
  #nameOf(id: SpaceBody): string {
    return this.#names[id] ?? BODIES[id].name[this.getAttribute("lang") === "ja" ? "ja" : "en"];
  }

  #placeLabels(places: Record<SpaceBody, BodyPlace | null>): void {
    this.#places = places;
    const box = this.#labelBox;
    if (!box) return;
    for (const id of SPACE_BODIES) {
      let label = this.#pool.get(id);
      const at = places[id];
      if (!label) {
        if (!at) continue;
        const button = box.ownerDocument.createElement("button");
        button.type = "button";
        button.className = "sp-label";
        button.dataset["body"] = id;
        this.#nameLabel(button, id);
        box.append(button);
        this.#pool.set(id, button);
        label = button;
      }
      if (!at) {
        if (!label.hidden) label.hidden = true;
        continue;
      }
      if (label.hidden) label.hidden = false;
      label.style.transform = `translate(${Math.round(at.x + Math.max(4, Math.min(at.r, 40)))}px,${Math.round(at.y - 8)}px)`;
    }
  }

  #nameLabel(button: HTMLElement, id: SpaceBody): void {
    const text = this.#nameOf(id);
    button.textContent = text;
    button.setAttribute("aria-label", `${text}: ${this.#hint}`);
  }

  // A body is chosen by pressing on it or on its name (and by Tab and Enter on the name); a drag that turns the view is not a choice.
  #downX = 0;
  #downY = 0;
  #down = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.#downX = event.clientX;
    this.#downY = event.clientY;
    window.addEventListener("pointerup", this.#up, { capture: true, once: true });
  };
  #up = (event: PointerEvent): void => {
    if (Math.hypot(event.clientX - this.#downX, event.clientY - this.#downY) > 6) return;
    if (!this.#places) return;
    const rect = this.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best: SpaceBody | undefined;
    let bestD = Infinity;
    for (const id of SPACE_BODIES) {
      const at = this.#places[id];
      if (!at) continue;
      const d = Math.hypot(x - at.x, y - at.y);
      if (d <= Math.max(at.r, 14) && d < bestD) {
        best = id;
        bestD = d;
      }
    }
    if (best) this.dispatchEvent(new CustomEvent("wakusei-body-click", { detail: this.bodyInfo(best), bubbles: true, composed: true }));
  };
  #labelClick = (event: Event): void => {
    const id = (event.target as HTMLElement | null)?.dataset?.["body"] as SpaceBody | undefined;
    if (id) this.dispatchEvent(new CustomEvent("wakusei-body-click", { detail: this.bodyInfo(id), bubbles: true, composed: true }));
  };
  #labelFocus = (event: Event): void => {
    const id = (event.target as HTMLElement | null)?.dataset?.["body"] as SpaceBody | undefined;
    if (id) this.dispatchEvent(new CustomEvent("wakusei-body-focus", { detail: this.bodyInfo(id), bubbles: true, composed: true }));
  };

  // --- the rest --------------------------------------------------------------------------------------------------------------------------------------
  #painterNow(): WakuseiPainter {
    return (this.#painter ??= createPainter({ textureBase: texturePaths(this).textureBase(), farBase: texturePaths(this).farBase(), tiles: tilesBase(this) ?? "off" }));
  }

  #textureCap(): number {
    const given = Number(this.getAttribute("max-texture"));
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const cap = Number.isFinite(given) && given > 0 ? Math.min(given, 4096) : 2048;
    return memory !== undefined && memory <= 2 ? Math.min(cap, 2048) : cap;
  }

  #lost = (): void => this.#set("lost");
  #restored = (): void => this.#set("live");

  #set(state: SpaceState): void {
    if (this.#state === state) return;
    this.#state = state;
    this.dataset["state"] = state;
    this.dispatchEvent(new CustomEvent("wakusei-state", { detail: { state } }));
  }

  #fail(reason: string): void {
    this.#set("unavailable");
    this.dispatchEvent(new CustomEvent("wakusei-unavailable", { detail: { reason } }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "wakusei-space": WakuseiSpace;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wakusei-space")) {
  customElements.define("wakusei-space", WakuseiSpace);
}
