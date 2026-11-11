// <wakusei-space>: the Earth, the Moon, the Sun and the planets where they are at a date and time, drawn with three.js through kazoku-ui's shared renderer. Optional: the line drawings and
// the single bodies need none of it. It draws only when something changes, at most 30 times a second, and nothing while it is out of sight.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { carryControls, type ElementControls, type ViewController } from "@johnmorrisdotca/kazoku-ui/view-controls";
import "../tables/minor.ts";
import { BODIES, MOONS_OF, type BodyId, type MoonId } from "../facts.ts";
import { createGate, frameCap, type Gate } from "../gate.ts";
import { arrowCount } from "./arrows.ts";
import { chooseTransition, DEFAULT_LAUNCH_MS, DEFAULT_TURN_MS, readMs, readTransition, type Transition } from "./glide.ts";
import { createGameClock, type GameClock } from "./clock.ts";
import { bodyKindOf, findBody, hopFrom, hostOf, HOP_ORDER, type SpaceKind } from "./bodies.ts";
import { chooseLabels, type LabelBox } from "./labels.ts";
import { createPainter, type WakuseiPainter } from "../scene/painter.ts";
import type { Credit, DataSource } from "../data-door.ts";
import { createDoorHost, type DoorHost } from "../door/host.ts";
import { ownCredit } from "../door/own.ts";
import { BELT_IDS, BELTS, beltFlight, beltNote, beltsSource, beltSpacing, loadBeltBodies, OORT, type BeltId } from "../belts/index.ts";
import type { ThreeParts } from "../scene/body.ts";
import { setThreeLoader, takeRenderer } from "../scene/shared.ts";
import { texturePaths, tilesBase } from "../scene/textures.ts";
import { AU_IN_EARTH_RADII, EARTH_RADIUS_KM, frameAt, SPACE_DWARFS, SPACE_MINORS, SPACE_PLANETS, type SpaceDwarf, type SpaceMinor, type SpacePlanet } from "./frame.ts";
import { moonOffset } from "../scene/orient.ts";
import { moonDistance, placeBodies, radiusIn, type ScaleMode } from "./scale.ts";
import type { RideLook } from "./ride.ts";
import { createSpaceItem, FIT_DISTANCE, newSpaceModel, SPACE_BODIES, type BodyPlace, type RidePoint, type RideState, type RideTarget, type SpaceBody, type SpaceLight, type SpaceModel } from "./scene.ts";

export { setThreeLoader, SPACE_BODIES, type RidePoint, type RideTarget, type SpaceBody, type SpaceLight };

/** Where a body is on the screen, in CSS pixels in the element: its centre and its radius. */
export type { BodyPlace };

/** The words the view says on itself for the scale in use. A page in another language gives its own with `scaleNames`. */
const SCALE_WORDS = {
  en: { true: "True distances", compressed: "Distances squeezed to fit" },
  ja: { true: "本当の距離", compressed: "距離を縮めて表示" },
} as const;
/** A body whose disc is smaller than this many CSS pixels across its radius is marked with a ring as well as its name. */
const RING_BELOW_PX = 4;

/**
 * What a page can tell a reader about a body now.
 *
 * @example
 * ```ts no-run
 * import type { BodyInfo } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const info: BodyInfo = { id: "mars", name: "Mars", kind: "planet", radiusKm: 3389.5, distanceKm: 225_000_000 };
 * console.log(`${info.name}: ${info.radiusKm} km`);
 * ```
 */
export interface BodyInfo {
  id: BodyId;
  /** The name shown beside the body. */
  name: string;
  /** The Sun, a planet, a dwarf planet or a moon. */
  kind: SpaceKind;
  /** For a moon, the planet it goes round. */
  host?: BodyId;
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
export type SpacePreset = "earth" | "moon" | "sun" | "inner" | "solar-system" | `${Exclude<SpacePlanet, "mercury" | "venus">}-moons` | `${"orcus" | "haumea" | "eris"}-moons`;

/**
 * How a ride along is done: `view` `from` (the default) puts the camera at the target looking at the body it goes round, `beside` (for a moon) puts it beyond the moon and off the line to its planet, the moon large in the foreground and the planet in view behind it, `follow` keeps it a distance from the target looking at it (`distanceKm`,
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
  view?: "from" | "follow" | "beside";
  look?: RideLook;
  distanceKm?: number;
  around?: SpaceBody;
  smooth?: boolean;
  /** How the camera gets there: `direct` (a slow launch, then on), `cut` (no glide); `look-back` and `auto` glide as `direct` for a ride. The view's own `transition` where left out. */
  transition?: Transition;
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

/** The id of the package's own source of the belts: it is in every view, but is not one of `sources`. */
const BELTS_SOURCE_ID = "wakusei-belts";
/** The belts the attribute `belts` names: all of them where it is left out or says `all`, none for `off`, else a list of names separated by commas or spaces. */
const readBelts = (value: string | null): readonly BeltId[] => {
  if (value === null || value.trim() === "" || value.trim() === "all") return BELT_IDS;
  if (value.trim() === "off" || value.trim() === "none") return [];
  const named = value.split(/[\s,]+/).filter((id): id is BeltId => (BELT_IDS as readonly string[]).includes(id));
  return BELT_IDS.filter((id) => named.includes(id));
};
const readLight = (value: string | null): SpaceLight => (value === "lit" ? "lit" : "sun");
const RAD = Math.PI / 180;
const REAL_TIME_TICK_MS = 60_000;
/** The plain wheel in an immersive view is passed on as a pinch of this share, so a notch (100) zooms about 1.2 times, as the family's mouse wheel does with Alt. */
const WHEEL_AS_PINCH = 0.2;
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
/** A body the view can put at its middle: the eleven of `SPACE_BODIES` and the moons of the planets in them. */
const canCentre = (id: BodyId): boolean => (SPACE_BODIES as readonly string[]).includes(id) || (BODIES[id].kind === "moon" && (SPACE_BODIES as readonly string[]).includes(hostOf(id) ?? ""));
const readBody = (value: string): BodyId | undefined => {
  const id = findBody(value);
  return id !== undefined && canCentre(id) ? id : undefined;
};

/**
 * The zoom range of the space view when it carries its own controls. The floor, a millionth, takes the camera out past Neptune in the true scale. The ceiling is where the camera reaches the body: it is held at
 * 1.05 radii from the surface (`FIT_DISTANCE` over the zoom), so past a zoom of about 3.9 nothing moves; 3.6 is where the finest map tiles of the Earth, Mars and the Moon (16384 pixels round) run out of detail too, so it is the same ceiling for both.
 */
const CARRIED_LIMITS = { zoomMin: 1e-6, zoomMax: 3.6, tiltMax: 90 } as const;

const STYLE = `<style>:host{display:block;aspect-ratio:1/1;position:relative;overflow:hidden}:host([immersive]){aspect-ratio:auto;width:100%;height:100%;touch-action:none!important;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}#stage,#labels{position:absolute;inset:0}#labels{pointer-events:none;overflow:hidden}.sp-label{position:absolute;left:0;top:0;margin:0;padding:0;border:0;background:none;font:12px/16px system-ui,-apple-system,sans-serif;color:#fff;white-space:nowrap;text-shadow:0 0 3px #000,0 0 3px #000;will-change:transform;pointer-events:none}.sp-label:focus-visible{outline:2px solid #6cd0ff;outline-offset:2px;border-radius:4px}.sp-label::before{content:"";display:inline-block;width:5px;height:5px;margin:0 5px 1px -2px;border-radius:50%;background:#fff}.sp-label[hidden]{display:none}.sp-ring{position:absolute;left:0;top:0;width:16px;height:16px;margin:-8px 0 0 -8px;box-sizing:border-box;border:1.5px solid rgba(255,255,255,.85);border-radius:50%;box-shadow:0 0 3px #000;pointer-events:none;will-change:transform}.sp-ring[hidden]{display:none}.sp-scale{position:absolute;left:10px;top:8px;margin:0;padding:0;font:12px/16px system-ui,-apple-system,sans-serif;color:#fff;opacity:.9;text-shadow:0 0 3px #000,0 0 3px #000;pointer-events:none}.sp-note{position:absolute;left:10px;right:10px;top:28px;max-width:44em;margin:0;padding:0;font:12px/16px system-ui,-apple-system,sans-serif;color:#fff;opacity:.92;text-shadow:0 0 3px #000,0 0 3px #000;pointer-events:none}.sp-note[hidden],.sp-oort[hidden]{display:none}.sp-oort{position:absolute;left:0;top:0;margin:0;padding:0;font:italic 12px/16px system-ui,-apple-system,sans-serif;color:#aeb8e6;white-space:nowrap;text-shadow:0 0 3px #000,0 0 3px #000;will-change:transform;pointer-events:none}</style><div id="stage"></div><div id="labels"></div><p class="sp-scale" part="scale" role="status"></p><p class="sp-note" part="note" role="status" hidden></p><p class="sp-oort" part="oort" hidden></p>`;

/**
 * The `<wakusei-space>` custom element: the Earth, the Moon, the Sun and the planets where they are at a date and time, drawn with three.js through the shared renderer. It takes `center`
 * (`"lon,lat"`), `time` (`now` or an ISO date), `speed` (1 is real time, 0 holds, 86400 is a day a second, negative runs backwards), `scale` (`compressed` or `true`), `look` (`realistic` or `painted`),
 * `light` (`sun` or `lit`), `lang` (`en` or `ja`: the names), `labels` and `orbits` (`off` hides them), and `texture-base`, `texture-far-base`, `max-texture` and `tiles` (where the finer map tiles are, for a close zoom; `off` for none). Positions come from this package's own models. It draws
 * only when something changes, and nothing while it is out of sight.
 *
 * `immersive` makes it a full-screen view: it fills the box it is in, whatever the shape (the body looked at is framed by the shorter side), the plain wheel zooms and a drag anywhere on it turns it. Without it Ctrl, Command or Alt with the wheel zooms and the plain wheel scrolls the page.
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
  static observedAttributes = ["center", "time", "speed", "scale", "labels", "orbits", "help", "look", "light", "lang", "data", "arrows", "transition", "launch", "turn", "help-through", "belts"];

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
  #pool = new Map<string, HTMLElement>();
  #places: Record<string, BodyPlace | null> | undefined;
  #names: Partial<Record<string, string>> = {};
  #selected: BodyId | null = null;
  #scaleNames: Partial<Record<ScaleMode, string>> = {};
  #rings = new Map<string, HTMLElement>();
  #scaleLine: HTMLElement | undefined;
  #noteLine: HTMLElement | undefined;
  #oortLabel: HTMLElement | undefined;
  /** The belt the camera is flying through, and the point it flies on (the ride's target, to know the ride is still this one). */
  #flight: { belt: BeltId; point: ReturnType<typeof beltFlight> } | null = null;
  #spacing = new Map<BeltId, { known: number; drawn: number }>();
  #hint = "choose to look at it";
  #painter: WakuseiPainter | undefined;
  #door: DoorHost = createDoorHost(
    this,
    {
      // the package's own: the pictures and the positions of the bodies drawn, and the finer tiles of a window on a body (the folder's: a source of a page's is counted by its id)
      own: () => {
        const own: Credit[] = [];
        const drawn = this.#model.painted.bodies;
        if (drawn > 0) own.push(ownCredit("wakusei-pictures", drawn), ownCredit("wakusei-orbits", drawn));
        for (const [id, used] of Object.entries(this.#model.door.used)) if (this.#door.book.get(id) === undefined) own.push(ownCredit(id, used));
        return own;
      },
      used: () => new Map(Object.entries(this.#model.door.used)),
    },
    { kinds: ["tiles", "records"] },
    () => this.#gate?.request(),
  );
  #focusBeforeRide: BodyId = "earth";
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
    this.#model.mode = this.getAttribute("scale") === "compressed" ? "compressed" : "true";
    this.#model.labels = this.getAttribute("labels") !== "off";
    this.#model.orbits = this.getAttribute("orbits") !== "off";
    this.#model.arrowCount = arrowCount(this.getAttribute("arrows"));
    this.#model.leave = { transition: readTransition(this.getAttribute("transition")), launchMs: readMs(this.getAttribute("launch"), DEFAULT_LAUNCH_MS), turnMs: readMs(this.getAttribute("turn"), DEFAULT_TURN_MS) };
    this.#model.help = this.hasAttribute("help") && this.getAttribute("help") !== "off";
    this.#model.helpThrough = this.hasAttribute("help-through") && this.getAttribute("help-through") !== "off";
    this.#model.look = this.getAttribute("look") === "painted" ? "painted" : "realistic";
    this.#model.light = readLight(this.getAttribute("light"));
    this.#door.book.ownOnly(this.getAttribute("data") === "own");
    this.#model.belts = readBelts(this.getAttribute("belts"));
    if (this.#door.book.get(BELTS_SOURCE_ID) === undefined) this.#door.book.addSource(beltsSource());
    this.#door.book.enableSource(BELTS_SOURCE_ID, this.#model.belts.length > 0);
    this.#model.stepMs = Math.max(1000, Math.abs(this.#clock.speed) * 1000);
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", "The Earth, the Moon, the Sun and the planets in their places for the date shown");

    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = STYLE;
    this.#stage = root.getElementById("stage")!;
    this.#labelBox = root.getElementById("labels")!;
    this.#scaleLine = root.querySelector<HTMLElement>(".sp-scale")!;
    this.#noteLine = root.querySelector<HTMLElement>(".sp-note")!;
    this.#oortLabel = root.querySelector<HTMLElement>(".sp-oort")!;
    this.#nameScale();
    this.#pool.clear();
    this.#rings.clear();

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
      book: this.#door.book,
      cap: () => this.#textureCap(),
      invalidate: () => this.#gate?.request(),
      advance: () => this.#advance(),
      onLabels: (places) => {
        this.#placeLabels(places);
        this.#placeOort();
        this.#door.announce();
      },
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
    // before the shared hands (which hear it after this): a plain wheel in an immersive view zooms
    this.addEventListener("wheel", this.#wheel, { capture: true, passive: false });
    this.#hands = carryControls(this, { limits: CARRIED_LIMITS, onChange: (view, info) => this.setView(view, info.final) });
    this.#labelBox.addEventListener("click", this.#labelClick);
    this.#labelBox.addEventListener("focusin", this.#labelFocus);
  }

  disconnectedCallback(): void {
    this.#hands?.unbind();
    this.#hands = undefined;
    this.removeEventListener("pointerdown", this.#down);
    this.removeEventListener("wheel", this.#wheel, { capture: true });
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
    else if (name === "scale") this.scale = value === "compressed" ? "compressed" : "true";
    else if (name === "labels") this.labels = value !== "off";
    else if (name === "orbits") this.orbits = value !== "off";
    else if (name === "arrows") this.arrows = arrowCount(value);
    else if (name === "transition") this.transition = readTransition(value);
    else if (name === "launch") this.launchMs = readMs(value, DEFAULT_LAUNCH_MS);
    else if (name === "turn") this.turnMs = readMs(value, DEFAULT_TURN_MS);
    else if (name === "help") this.help = value !== null && value !== "off";
    else if (name === "help-through") this.helpThrough = value !== null && value !== "off";
    else if (name === "look") this.look = value === "painted" ? "painted" : "realistic";
    else if (name === "light") this.light = readLight(value);
    else if (name === "data") this.#door.book.ownOnly(value === "own");
    else if (name === "belts") this.belts = readBelts(value);
    else if (name === "lang") {
      for (const [id, button] of this.#pool) this.#nameLabel(button, id);
      this.#nameScale();
      this.#showNote();
    }
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

  /** `true` (the default: real distances and sizes; a body too small to see is marked with a ring and its name) or `compressed` (every direction real, the distances squeezed). The scale in use is always named on the view. */
  get scale(): ScaleMode {
    return this.#model.mode;
  }
  set scale(value: ScaleMode) {
    this.#model.mode = value;
    // a flight through a belt is at true distances: the squeezed scale does not map a camera that moves among the bodies
    if (value !== "true" && this.#flight !== null) this.leaveBelt();
    this.#nameScale();
    this.#gate?.request();
  }

  /** The words naming the scale on the view, for a page in another language (`{ true: "距離はそのまま" }`). A scale left out keeps its words in the element's `lang`. */
  get scaleNames(): Partial<Record<ScaleMode, string>> {
    return { ...this.#scaleNames };
  }
  set scaleNames(value: Partial<Record<ScaleMode, string>>) {
    this.#scaleNames = { ...value };
    this.#nameScale();
  }

  get labels(): boolean {
    return this.#model.labels;
  }
  set labels(value: boolean) {
    this.#model.labels = value;
    if (!value) for (const label of [...this.#pool.values(), ...this.#rings.values()]) label.hidden = true;
    this.#gate?.request();
  }

  get orbits(): boolean {
    return this.#model.orbits;
  }
  set orbits(value: boolean) {
    this.#model.orbits = value;
    this.#gate?.request();
  }

  /** How many small arrowheads each orbit line carries to show which way the body goes: 2 by default, at most 4, 0 for none (the attribute `arrows` says the same). Anything else is made a whole number in that range. */
  get arrows(): number {
    return this.#model.arrowCount;
  }
  set arrows(value: number) {
    this.#model.arrowCount = arrowCount(value);
    this.#gate?.request();
  }

  /**
   * Help mode (the `help` attribute; off by default): on the body looked at, a line along its axis and a curved arrow round it showing which way it spins, by the right-hand rule about the axis it really turns about, so it is
   * right for Venus and Uranus, which turn backwards, and for Uranus on its side. By default the lines are hidden where the globe covers them (`helpThrough` draws them whole over it).
   */
  get help(): boolean {
    return this.#model.help;
  }
  set help(value: boolean) {
    this.#model.help = value;
    this.#gate?.request();
  }

  /**
   * Whether help mode's lines are drawn whole over the globe, as they were (the attribute `help-through`; off by default). Off, they have depth against the body they are on: the axis runs into the near pole and comes out of the
   * far pole only where that end is not behind the globe, and the part of the curved arrow that passes behind the globe is hidden.
   */
  get helpThrough(): boolean {
    return this.#model.helpThrough;
  }
  set helpThrough(value: boolean) {
    this.#model.helpThrough = value;
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

  /** The body the camera looks at: any body the view places, by name in any case (`earth`, `sun`, `moon`, `mercury` to `neptune`, `pluto`, and the moons of the planets such as `titan`). At zoom 1 it fills the view; the yaw and tilt turn the camera round it. Setting it moves the camera there at once and keeps the zoom; `goTo` glides and brings the body into view. */
  get body(): BodyId {
    return this.#model.focus;
  }
  set body(name: BodyId | string) {
    const id = readBody(name);
    if (!id) return;
    this.#centre(id);
  }

  /** Move the camera to `id` (not yet drawn) and tell the page. */
  #centre(id: BodyId): void {
    const was = this.#model.focus;
    this.#model.focus = id;
    this.#gate?.request();
    if (was !== id) this.#announceHop();
  }

  /** What the hopper can do from where it is: the body at the middle, and the bodies the previous and next hop lead to. */
  get hopper(): { current: BodyInfo; previous: BodyInfo; next: BodyInfo } {
    const here = this.#model.focus;
    return { current: this.bodyInfo(here), previous: this.bodyInfo(hopFrom(here, -1, canCentre)), next: this.bodyInfo(hopFrom(here, 1, canCentre)) };
  }

  /**
   * How the camera leaves a body for the next (every `goTo`, the hopper's `next` and `previous`, and a ride): `direct` (the default: a slow launch, then straight at the destination, which stays in view and grows), `look-back` (pull away
   * watching the body being left, then turn to the destination over the last part of the trip), `auto` (`direct` when the destination is in view where the trip starts, `look-back` when it is not) or `cut` (no glide). A reader who prefers
   * reduced motion always gets `cut`. The attribute `transition` says the same, and `goTo(name, { transition })` chooses for one trip.
   */
  get transition(): Transition {
    return this.#model.leave.transition;
  }
  set transition(value: Transition) {
    this.#model.leave = { ...this.#model.leave, transition: readTransition(value, this.#model.leave.transition) };
  }

  /** How long the slow launch of a glide lasts, in milliseconds (the attribute `launch`): the camera takes this long to cover the first fifth of the trip, so the departure is seen. 500 by default, 0 for a quick glide, at most 10,000. */
  get launchMs(): number {
    return this.#model.leave.launchMs;
  }
  set launchMs(value: number) {
    this.#model.leave = { ...this.#model.leave, launchMs: readMs(value, this.#model.leave.launchMs) };
  }

  /** How long the turn to the destination lasts in `look-back` and `auto`, in milliseconds (the attribute `turn`): the last stretch of the trip. 700 by default. */
  get turnMs(): number {
    return this.#model.leave.turnMs;
  }
  set turnMs(value: number) {
    this.#model.leave = { ...this.#model.leave, turnMs: readMs(value, this.#model.leave.turnMs) };
  }

  /** Whether a body is on the screen now: its place at the last draw is inside the element. */
  #inView(id: BodyId): boolean {
    const at = this.#places?.[id];
    if (!at) return false;
    const box = this.getBoundingClientRect();
    return at.x >= 0 && at.y >= 0 && at.x <= box.width && at.y <= box.height;
  }

  /**
   * Go to a body: it becomes the middle of the view and the zoom brings it whole into view (`zoom`, 1 by default; a planet's `-moons` preset for its system), gliding there from where the camera is unless `smooth` is
   * false or the reader asked for reduced motion. `wakusei-hop` tells the page where it went and where the next and previous hops lead. A name in any case, in English or Japanese, works.
   *
   * @param target - A body's name (`"saturn"`, `"Saturn"`, `"土星"`).
   * @param options - `smooth` (true by default) and `zoom` (1 by default).
   * @returns Whether the view can go there.
   */
  goTo(target: BodyId | string, options: { smooth?: boolean; zoom?: number; transition?: Transition } = {}): boolean {
    const id = readBody(target);
    if (!id) return false;
    const model = this.#model;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pose = model.pose;
    const kind = chooseTransition(readTransition(options.transition, model.leave.transition), this.#inView(id));
    const glide = (options.smooth ?? true) && !reduced && pose.valid && model.ride === null && kind !== "cut";
    const leaving = model.focus === id ? null : model.focus;
    if (model.ride !== null) this.ride(null, { smooth: false });
    model.transition = glide ? { start: performance.now(), kind: kind === "look-back" ? "look-back" : "direct", launchMs: model.leave.launchMs, turnMs: model.leave.turnMs, leaving, from: { p: [pose.p[0], pose.p[1], pose.p[2]], q: [pose.q[0], pose.q[1], pose.q[2], pose.q[3]], fov: pose.fov } } : null;
    this.#selected = id;
    this.#model.focus = id;
    const zoom = options.zoom ?? 1;
    // a bar bound to the element holds the view's state: it applies the zoom the page hears in the event; without one the element's own hands do
    if (!this.hasAttribute("data-kazoku-bar")) this.#hands?.controller.set({ zoom }, true, "jump");
    this.#schedule();
    this.#gate?.request();
    this.#announceHop(zoom);
    return true;
  }

  /** Go to the next body in the order of `bodyList()` (the Sun, Mercury, Venus, the Earth, the Moon, Mars, Phobos, Deimos, Ceres, Jupiter, its moons, and on), round to the Sun after the last. */
  next(options: { smooth?: boolean } = {}): BodyInfo {
    this.goTo(hopFrom(this.#model.focus, 1, canCentre), options);
    return this.bodyInfo(this.#model.focus);
  }

  /** Go to the previous body in the same order. */
  previous(options: { smooth?: boolean } = {}): BodyInfo {
    this.goTo(hopFrom(this.#model.focus, -1, canCentre), options);
    return this.bodyInfo(this.#model.focus);
  }

  /** Every body the view can go to, in the hopper's order, with its kind and, for a moon, its planet: a page's jump list. */
  bodyList(): BodyInfo[] {
    return HOP_ORDER.filter(canCentre).map((id) => this.bodyInfo(id));
  }

  /** The body a press has chosen and the page may be showing a card for, or null. A second press on it, or `goTo`, makes it the middle of the view. */
  get selected(): BodyId | null {
    return this.#selected;
  }
  set selected(id: BodyId | null) {
    this.#selected = id;
  }

  /** `zoom` is the zoom the page should bring the view to: given by `goTo`, left out when the body was only set (the zoom stays). */
  #announceHop(zoom?: number): void {
    this.dispatchEvent(new CustomEvent("wakusei-hop", { detail: { ...this.hopper, zoom }, bubbles: true, composed: true }));
  }

  /** The words shown beside each body, for a page in another language (`{ mars: "火星" }`). A body left out keeps its name in the element's `lang`. */
  get bodyNames(): Partial<Record<string, string>> {
    return { ...this.#names };
  }
  set bodyNames(value: Partial<Record<string, string>>) {
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
  bodyInfo(id: BodyId): BodyInfo {
    const frame = this.#model.drawn?.frame ?? frameAt(this.#model.time);
    const km = AU_IN_EARTH_RADII * EARTH_RADIUS_KM;
    let geo: readonly [number, number, number] = [Number.NaN, Number.NaN, Number.NaN];
    const host = hostOf(id);
    if (id === "earth") geo = [0, 0, 0];
    else if (id === "sun") geo = frame.sun;
    else if (id === "moon") geo = frame.moon;
    else if ((SPACE_PLANETS as readonly string[]).includes(id)) geo = frame.planets[id as SpacePlanet];
    else if ((SPACE_DWARFS as readonly string[]).includes(id)) geo = frame.dwarfs[id as SpaceDwarf];
    else if ((SPACE_MINORS as readonly string[]).includes(id)) geo = frame.minors[id as SpaceMinor];
    else if (host !== undefined && ((SPACE_PLANETS as readonly string[]).includes(host) || (SPACE_DWARFS as readonly string[]).includes(host))) {
      // a moon: its planet's place and its offset in the planet's radii
      const at = (SPACE_DWARFS as readonly string[]).includes(host) ? frame.dwarfs[host as SpaceDwarf] : frame.planets[host as SpacePlanet];
      const offset = moonOffset(id as MoonId, this.#model.time);
      const radius = BODIES[host].radiusKm / km;
      geo = [at[0] + offset[0] * radius, at[1] + offset[1] * radius, at[2] + offset[2] * radius];
    }
    const info: BodyInfo = { id, name: this.#nameOf(id), kind: bodyKindOf(id), radiusKm: BODIES[id].radiusKm, distanceKm: Math.hypot(geo[0], geo[1], geo[2]) * km };
    if (host !== undefined) info.host = host;
    return info;
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
    if (this.#flight !== null && (model.ride === null || model.ride.target !== this.#flight.point)) this.#flight = null;
    this.#showNote();
    const pose = model.pose;
    const rideKind = chooseTransition(readTransition(options.transition, model.leave.transition), true);
    model.transition = (options.smooth ?? true) && !reduced && pose.valid && rideKind !== "cut" ? { start: performance.now(), kind: "direct", launchMs: model.leave.launchMs, turnMs: model.leave.turnMs, leaving: null, from: { p: [pose.p[0], pose.p[1], pose.p[2]], q: [pose.q[0], pose.q[1], pose.q[2], pose.q[3]], fov: pose.fov } } : null;
    this.#schedule();
    this.#gate?.request();
    this.dispatchEvent(new CustomEvent("wakusei-ride", { detail: this.riding }));
  }

  #resolveRide(target: RideTarget, options: RideOptions): RideState | undefined {
    const look = options.look ?? "down";
    const distanceKm = Math.max(100, options.distanceKm ?? 3000);
    if (typeof target !== "string") {
      const around = options.around && (SPACE_BODIES as readonly string[]).includes(options.around) ? options.around : "earth";
      if (options.view === "beside") return undefined;
      return { target, around, view: options.view ?? "from", look, distanceKm };
    }
    const id = target.toLowerCase();
    if ((SPACE_BODIES as readonly string[]).includes(id)) {
      // the view from beside a moon is for a moon: of the bodies of the view only the Moon is one
      if (options.view === "beside" && id !== "moon") return undefined;
      return { target: id as SpaceBody, around: "earth", view: id === "earth" ? "follow" : (options.view ?? "from"), look, distanceKm };
    }
    for (const [planet, moons] of Object.entries(MOONS_OF)) {
      if (!(moons as readonly string[]).includes(id) || !(SPACE_BODIES as readonly string[]).includes(planet) || planet === "earth") continue;
      return { target: id as MoonId, around: planet as SpaceBody, view: options.view ?? "from", look, distanceKm };
    }
    return undefined;
  }

  /**
   * The belts drawn, by name (`main`, `hilda`, `trojan`, `centaur`, `classical`, `resonant`, `scattered`): all seven by default, `[]` for none. The attribute `belts` says the same (`belts="off"`, `belts="main trojan"`). Each belt is one instanced draw of its own
   * colour, from the package's own source of NASA/JPL's Small-Body Database (`@johnmorrisdotca/wakusei-planets/belts`), fetched when the view first draws it.
   */
  get belts(): readonly BeltId[] {
    return this.#model.belts;
  }
  set belts(list: readonly BeltId[]) {
    this.#model.belts = BELT_IDS.filter((id) => list.includes(id));
    if (this.#flight !== null && !this.#model.belts.includes(this.#flight.belt)) this.leaveBelt();
    // with no belt shown the source is switched off, so its bodies are neither read nor held (the chunk of them is not fetched)
    this.#door.book.enableSource(BELTS_SOURCE_ID, this.#model.belts.length > 0);
    this.#gate?.request();
  }

  /**
   * Fly into a belt: the camera goes to a point on a circular orbit in the middle of the belt, tilted a few degrees to the ecliptic so that it passes through the belt's thickness, looking the way it goes with the ecliptic's north at the top, at true
   * distances (the squeezed scale is left), and a drag looks about. The dots round it are the belt's bodies; a line on the view says how many bodies there really are, and that neighbours are millions of kilometres apart, which is why the picture is
   * mostly empty. Time runs as the clock says (`speed`). `leaveBelt()` goes back.
   *
   * @param belt - The belt, `main` by default.
   * @param options - `smooth` (a glide, true by default).
   */
  enterBelt(belt: BeltId = "main", options: { smooth?: boolean } = {}): void {
    if (!(BELT_IDS as readonly string[]).includes(belt)) throw new RangeError(`belt must be one of ${BELT_IDS.join(", ")}, got ${JSON.stringify(belt)}`);
    if (this.#model.mode !== "true") this.scale = "true";
    if (!this.#model.belts.includes(belt)) this.belts = [...this.#model.belts, belt];
    const point = beltFlight(belt);
    this.#flight = { belt, point };
    this.ride(point, { around: "sun", view: "from", look: "ahead", smooth: options.smooth ?? true });
    // the note needs the bodies to know how thickly they lie; the line is shown as soon as they are here
    void loadBeltBodies().then((bodies) => {
      this.#spacing.set(belt, beltSpacing(belt, bodies, 2_461_200.5));
      this.#showNote();
    });
    this.#showNote();
  }

  /** Come out of a belt: the camera goes back to the body it looked at before. */
  leaveBelt(options: { smooth?: boolean } = {}): void {
    if (this.#flight === null) return;
    this.#flight = null;
    this.ride(null, { smooth: options.smooth ?? true });
    this.#showNote();
  }

  /** The belt the camera is flying through, or null. */
  get flyingThrough(): BeltId | null {
    return this.#flight?.belt ?? null;
  }

  /** The line about a belt that is on the view while the camera is in one, and the label of the Oort cloud's shell when it is drawn. */
  #showNote(): void {
    if (this.#noteLine === undefined) return;
    const riding = this.#model.ride;
    if (this.#flight !== null && (riding === null || riding.target !== this.#flight.point)) this.#flight = null;
    const spacing = this.#flight === null ? undefined : this.#spacing.get(this.#flight.belt);
    const language = this.getAttribute("lang") === "ja" ? "ja" : "en";
    if (this.#flight === null) {
      this.#noteLine.hidden = true;
      this.#noteLine.textContent = "";
    } else {
      this.#noteLine.hidden = false;
      this.#noteLine.textContent = spacing === undefined ? BELTS[this.#flight.belt].name[language] : beltNote(this.#flight.belt, spacing, language);
    }
    if (this.#oortLabel !== undefined) this.#oortLabel.textContent = `${OORT.name[language]} (${language === "ja" ? "内側のふち 約" : "inner edge about "}${OORT.innerAu.toLocaleString(language === "ja" ? "ja-JP" : "en-US")}${language === "ja" ? "天文単位" : " au"})`;
  }

  /** Where the Oort label goes: at the point of the shell the scene found, or hidden when the shell is not drawn. */
  #placeOort(): void {
    if (this.#oortLabel === undefined) return;
    const at = this.#model.oort;
    if (at === null) {
      if (!this.#oortLabel.hidden) this.#oortLabel.hidden = true;
      return;
    }
    if (this.#oortLabel.textContent === "") this.#showNote();
    if (this.#oortLabel.hidden) this.#oortLabel.hidden = false;
    this.#oortLabel.style.transform = `translate(${Math.round(at.x) + 6}px,${Math.round(at.y) - 8}px)`;
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
  zoomFor(named: SpacePreset | string): number {
    const mode = this.#model.mode;
    // a name in any case; one that is no preset gives 1, the zoom that fills the view with the body looked at, not NaN
    const preset = String(named).toLowerCase() as SpacePreset;
    if (!["earth", "moon", "sun", "inner", "solar-system"].includes(preset) && !(preset.endsWith("-moons") && findBody(preset.slice(0, -6)) !== undefined)) return 1;
    if (preset.endsWith("-moons")) {
      const id = preset.slice(0, -6) as SpacePlanet | SpaceDwarf;
      const sites = this.#painterNow().moons(id, this.#model.time);
      const distances = sites.map((site) => moonDistance(mode, id, Math.hypot(...site.offset)));
      // the moons within 22 radii; a system whose moons are all farther (a dwarf planet's) is framed by them all
      const near = distances.filter((r) => r <= 22);
      const reach = Math.max(1, ...(near.length > 0 ? near : distances));
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
    if (preset === "earth") return 1;
    const zoom = FIT_DISTANCE / Math.max(FIT_DISTANCE, reach * 3.4);
    // the Moon's own picture is a quarter of the Earth's in the compressed scale (it was drawn as 0.9 of it): the view of its orbit is still the one that holds the Earth too, three Moon-distances out
    return preset === "moon" && mode === "compressed" ? zoom * (radiusIn("moon", mode) / 0.9) : zoom;
  }

  /**
   * The outside sources of this view (the data door): maps of a body, which take the place of the folder of tiles for it, and records of small bodies, which are drawn as points in one instanced draw. Each carries its own
   * licence and credit. Assign a list to replace them; a source `validateSource` refuses throws a `TypeError` and changes nothing. A property, not an attribute: data is not text.
   */
  get sources(): readonly DataSource[] {
    return this.#door.sources().filter((source) => source.info.id !== BELTS_SOURCE_ID);
  }
  set sources(list: readonly DataSource[]) {
    const own = this.#door.book.get(BELTS_SOURCE_ID);
    this.#door.setSources(own === undefined ? list : [own, ...list]);
  }
  /** Adds one source (checked at once: a `TypeError` for an empty credit, no licence, a clashing id or a map source with no body). Returns the function that removes it. */
  addSource(source: DataSource): () => void {
    return this.#door.book.addSource(source);
  }
  /** Removes a source by id: its loads are aborted, its tiles and records freed, its points and window taken off the picture, and its credit goes. Returns whether there was one. */
  removeSource(id: string): boolean {
    return this.#door.book.removeSource(id);
  }
  /** Switches a source off (`false`) or on, for a layers panel. */
  enableSource(id: string, on: boolean): void {
    this.#door.book.enableSource(id, on);
  }
  /**
   * The sources whose data was in the last drawn frame, the package's own first: the surface pictures and the positions of the bodies, the finer map tiles where a window of them is on a body, and each source of yours that
   * gave points or tiles. `creditLine(credits, "en" | "ja")` from `@johnmorrisdotca/wakusei-planets/door` writes them with the licences. `wakusei-creditschange` fires when this set changes (not at each frame), with `detail: { credits }`.
   */
  credits(): Credit[] {
    return this.#door.credits();
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
    /** The data door: the small bodies of a page's own sources in the one instanced draw (`points`), the package's own belts (`belts` bodies in `draws` instanced draws, one for each belt), and what the sources have done (tile loads started, failed and refused, bytes held, records read). */
    door: { points: number; belts: number; draws: number; sources: ReturnType<DoorHost["book"]["stats"]> };
    /** The orbit lines drawn at the last draw (`earth`, the planets, `moon`), and how far each body is from its own line as a fraction of the line's radius: a body on its line reads under 0.01. */
    orbits: { drawn: string[]; miss: Record<string, number>; hidden: string[] };
    /** The arrowheads on the orbit lines at the last draw, by line (`earth`, the planets, `moon`): where each is and the way it points, the way the body goes (not the way the clock runs). */
    arrows: Record<string, { position: [number, number, number]; direction: [number, number, number] }[]>;
    /** How long an arrowhead on an orbit line is on the screen at the last draw, in CSS pixels (0 when none is drawn): the same at every zoom. */
    arrowPx: number;
    /** What help mode drew at the last draw, or null: the body, the axis it spins about, its north pole, and the axis the drawn arrow itself turns about. */
    help: { body: string; axis: [number, number, number]; pole: [number, number, number]; retrograde: boolean; arcTurn: [number, number, number] } | null;
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
      door: { points: this.#model.door.points, belts: this.#model.door.belts, draws: this.#model.door.draws, sources: this.#door.book.stats() },
      ride: { riding: this.#model.ride !== null, lost: this.#model.rideLost, gliding: this.#model.transition !== null },
      orbits: { drawn: [...this.#model.rings.drawn], miss: { ...this.#model.rings.miss }, hidden: [...this.#model.rings.hidden] },
      arrows: Object.fromEntries(Object.entries(this.#model.arrows).map(([id, list]) => [id, list.map((a) => ({ position: [...a.position] as [number, number, number], direction: [...a.direction] as [number, number, number] }))])),
      arrowPx: this.#model.arrowPx,
      help: this.#model.helpDrawn ? { body: this.#model.helpDrawn.body, axis: [...this.#model.helpDrawn.axis], pole: [...this.#model.helpDrawn.pole], retrograde: this.#model.helpDrawn.retrograde, arcTurn: [...this.#model.helpDrawn.arcTurn] } : null,
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
  #nameOf(id: string): string {
    return this.#names[id] ?? BODIES[id as BodyId].name[this.getAttribute("lang") === "ja" ? "ja" : "en"];
  }

  #placeLabels(places: Record<string, BodyPlace | null>): void {
    this.#places = places;
    const box = this.#labelBox;
    if (!box) return;
    const wanted: LabelBox[] = [];
    const spots = new Map<string, { x: number; y: number; small: boolean }>();
    const ids = [...new Set([...SPACE_BODIES, ...this.#pool.keys(), ...Object.keys(places)])];
    for (const id of ids) {
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
      let ring = this.#rings.get(id);
      if (!ring) {
        ring = box.ownerDocument.createElement("div");
        ring.className = "sp-ring";
        ring.dataset["ring"] = id;
        ring.hidden = true;
        box.append(ring);
        this.#rings.set(id, ring);
      }
      if (!at) continue;
      const x = Math.round(at.x + Math.max(4, Math.min(at.r, 40)));
      const y = Math.round(at.y - 8);
      spots.set(id, { x, y, small: at.r < RING_BELOW_PX });
      wanted.push({ id, x, y, width: this.#widthOf(label), height: 16, rank: this.#rank(id), size: at.r });
    }
    // no two names overlap: a moon gives way to its planet and a planet to the Sun
    const shown = chooseLabels(wanted);
    for (const id of ids) {
      const label = this.#pool.get(id);
      const ring = this.#rings.get(id);
      if (!label || !ring) continue;
      const spot = spots.get(id);
      if (!spot || !shown.has(id)) {
        if (!label.hidden) label.hidden = true;
        if (!ring.hidden) ring.hidden = true;
        continue;
      }
      if (label.hidden) label.hidden = false;
      label.style.transform = `translate(${spot.x}px,${spot.y}px)`;
      // a body too small to see is marked: a ring round the place it is, as well as its name
      if (ring.hidden === spot.small) ring.hidden = !spot.small;
      if (spot.small) ring.style.transform = `translate(${Math.round(places[id]!.x)}px,${Math.round(places[id]!.y)}px)`;
    }
  }

  /** How sure a body's name is of its place: the body looked at first, then the Sun, the planets, the dwarf planets and minor bodies, and the moons. */
  #rank(id: string): number {
    if (id === this.#model.focus) return 0;
    if (id === "sun") return 1;
    const kind = bodyKindOf(id as BodyId);
    return kind === "moon" ? 4 : kind === "planet" || kind === "star" ? 2 : 3;
  }

  #widths = new WeakMap<HTMLElement, number>();
  /** The width of a name's box on the screen, measured when its words change and not at every frame. */
  #widthOf(label: HTMLElement): number {
    let width = this.#widths.get(label);
    if (width === undefined) {
      const hidden = label.hidden;
      if (hidden) label.hidden = false;
      width = label.offsetWidth;
      if (hidden) label.hidden = true;
      if (width > 0) this.#widths.set(label, width);
    }
    return width;
  }

  /** Say which scale is on, on the view itself. */
  #nameScale(): void {
    if (!this.#scaleLine) return;
    const words = SCALE_WORDS[this.getAttribute("lang") === "ja" ? "ja" : "en"];
    this.#scaleLine.textContent = this.#scaleNames[this.#model.mode] ?? words[this.#model.mode];
  }

  /** Where a body is on the screen now: its centre and radius in CSS pixels in the element, or `null` when it is behind the camera or not drawn. */
  placeOf(id: BodyId): BodyPlace | null {
    const at = this.#places?.[id];
    return at ? { ...at } : null;
  }

  #nameLabel(button: HTMLElement, id: string): void {
    const text = this.#nameOf(id);
    button.textContent = text;
    this.#widths.delete(button);
    button.setAttribute("aria-label", `${text}: ${this.#hint}`);
  }

  /** True for the full-screen mode (the `immersive` attribute): the element fills its box in any shape, a plain wheel zooms instead of scrolling the page, and a touch drag turns the view instead of scrolling it. */
  get immersive(): boolean {
    return this.hasAttribute("immersive");
  }
  set immersive(value: boolean) {
    this.toggleAttribute("immersive", value);
  }

  // In an immersive view a plain wheel zooms. It is passed on to the shared hands as the wheel's own pinch (Ctrl and a small step), so whichever hands hold the view (the element's, or a bar bound to it) apply it with their limits;
  // Ctrl, Command, Alt and Shift with the wheel are the family's own and are left alone.
  #wheel = (event: WheelEvent): void => {
    if (!this.hasAttribute("immersive") || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const pixels = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaMode === 2 ? event.deltaY * 800 : event.deltaY;
    this.dispatchEvent(new WheelEvent("wheel", { deltaY: Math.max(-250, Math.min(250, pixels)) * WHEEL_AS_PINCH, deltaMode: 0, clientX: event.clientX, clientY: event.clientY, ctrlKey: true, bubbles: true, cancelable: true, composed: true }));
  };

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
    let best: BodyId | undefined;
    let bestD = Infinity;
    for (const [id, at] of Object.entries(this.#places)) {
      if (!at) continue;
      const d = Math.hypot(x - at.x, y - at.y);
      if (d <= Math.max(at.r, 14) && d < bestD) {
        best = id as BodyId;
        bestD = d;
      }
    }
    if (best) this.#press(best);
  };
  #labelClick = (event: Event): void => {
    const id = (event.target as HTMLElement | null)?.dataset?.["body"] as BodyId | undefined;
    if (id) this.#press(id);
  };

  /**
   * A press on a body or its name. `wakusei-body-click` tells the page every time. The first press on a body selects it (`wakusei-body-select`, for the page's card); a second press on the body that is selected makes it
   * the middle of the view (`goTo`), unless it already is, so a press never sends the view anywhere else.
   */
  #press(id: BodyId): void {
    this.dispatchEvent(new CustomEvent("wakusei-body-click", { detail: this.bodyInfo(id), bubbles: true, composed: true }));
    if (this.#selected === id) {
      if (canCentre(id) && this.#model.focus !== id) this.goTo(id);
      return;
    }
    this.#selected = id;
    this.dispatchEvent(new CustomEvent("wakusei-body-select", { detail: this.bodyInfo(id), bubbles: true, composed: true }));
  }
  #labelFocus = (event: Event): void => {
    const id = (event.target as HTMLElement | null)?.dataset?.["body"] as BodyId | undefined;
    if (id) this.dispatchEvent(new CustomEvent("wakusei-body-focus", { detail: this.bodyInfo(id), bubbles: true, composed: true }));
  };

  // --- the rest --------------------------------------------------------------------------------------------------------------------------------------
  #painterNow(): WakuseiPainter {
    return (this.#painter ??= createPainter({ textureBase: texturePaths(this).textureBase(), farBase: texturePaths(this).farBase(), tiles: tilesBase(this) ?? "off", book: this.#door.book }));
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
