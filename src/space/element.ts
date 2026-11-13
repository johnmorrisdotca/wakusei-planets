// <wakusei-space>: the Earth, the Moon, the Sun and the planets where they are at a date and time, drawn with three.js through kazoku-ui's shared renderer. Optional: the line drawings and
// the single bodies need none of it. It draws only when something changes, at most 30 times a second, and nothing while it is out of sight.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { carryControls, type ElementControls, type ViewController } from "@johnmorrisdotca/kazoku-ui/view-controls";
import "../tables/minor.ts";
import { BODIES, BODY_IDS, MOONS_OF, type BodyId, type MoonId } from "../facts.ts";
import { createGate, frameCap, type Gate } from "../gate.ts";
import { arrowCount } from "./arrows.ts";
import { createGameClock, type GameClock } from "./clock.ts";
import { bodyKindOf, findBody, hopFrom, hostOf, HOP_ORDER, systemOf, type SpaceKind } from "./bodies.ts";
import { sightChanged, sightOf, type Sight, type SightEdge, type SightInput } from "./sight.ts";
import { chooseLabels, nameSpot, type LabelBox } from "./labels.ts";
import { coverArrows } from "./covered.ts";
import { createPainter, type WakuseiPainter } from "../scene/painter.ts";
import { NAME_LABEL_ATTRIBUTES, readNameLabel, type NameLabelOptions } from "../scene/name-label.ts";
import type { Credit, DataSource } from "../data-door.ts";
import { createDoorHost, type DoorHost } from "../door/host.ts";
import { ownCredit } from "../door/own.ts";
import { BELT_IDS, BELTS, beltFlight, beltNote, beltsSource, beltSpacing, loadBeltBodies, OORT, type BeltId } from "../belts/index.ts";
import type { ThreeParts } from "../scene/body.ts";
import { setThreeLoader, takeRenderer } from "../scene/shared.ts";
import { texturePaths, tilesBase } from "../scene/textures.ts";
import { AU_IN_EARTH_RADII, EARTH_RADIUS_KM, frameAt, SPACE_DWARFS, SPACE_MINORS, SPACE_PLANETS, type SpaceDwarf, type SpaceMinor, type SpacePlanet } from "./frame.ts";
import { moonOffset, orientation } from "../scene/orient.ts";
import { moonDistance, placeBodies, radiusIn, readMoonSize, type ScaleMode } from "./scale.ts";
import type { RideLook } from "./ride.ts";
import { groundDirection } from "./aim.ts";
import { besideMoon } from "./beside.ts";
import { SUN_REGIONS, type SunRegion } from "./regions.ts";
import { travelArrival, type TravelKind } from "./travel.ts";
import type { MoonDot } from "./all-moons.ts";
import { findPlace, PLACE_BODIES, type Place, type PlaceBody } from "../places.ts";
import { placeMarks, pointUnder, readPlaceLayers, spotView, type PlaceLayer } from "../place-marks.ts";
import { createPlaceLayer, onPlacesLoader, placesLoader, type PlaceLayerView } from "../scene/place-layer.ts";
import { createEarthPlaceLayer, EARTH_PLACE_MARKS, EARTH_PLACES_FROM_PX, earthPlacesLayout, onEarthPlacesLayout, readEarthPlaceLook, type EarthPlace, type EarthPlaceLayerView, type EarthPlaceLook, type EarthPlaceMark } from "../scene/earth-places.ts";
import { cross, dot, length, sub, unit, type Vec3 } from "../vec.ts";
import type { ArrivalCompanion } from "./travel.ts";
import { createSpaceItem, FIT_DISTANCE, moonScaleFor, newSpaceModel, SPACE_BODIES, type BodyPlace, type RidePoint, type RideState, type RideTarget, type SpaceBody, type SpaceLight, type SpaceModel } from "./scene.ts";
import { paintLengthOf, paintSwathOf, type PaintSpec } from "../paint/trail.ts";

export type { PaintSpec };

export { setPlacesLoader } from "../scene/place-layer.ts";
export { EARTH_PLACE_LOOKS, EARTH_PLACE_MARKS, type EarthPlace, type EarthPlaceKind, type EarthPlaceLook, type EarthPlaceMark } from "../scene/earth-places.ts";
export { setThreeLoader, SPACE_BODIES, type RidePoint, type RideTarget, type Sight, type SightEdge, type SpaceBody, type SpaceLight };

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
 * The body under the pointer, a finger or the keyboard's focus (`wakusei-body-hover`), with the system it belongs to: the body in its middle and that body's moons. The view draws their names and markers at full strength.
 *
 * @example
 * ```ts no-run
 * import type { BodyHover } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const hover: BodyHover = { id: "titan", name: "Titan", kind: "moon", host: "saturn", radiusKm: 2574.7, distanceKm: 1.4e9, system: { host: "saturn", moons: ["mimas", "titan"] } };
 * console.log(`${hover.name} is in ${hover.system.host}'s system`);
 * ```
 */
export interface BodyHover extends BodyInfo {
  system: { host: BodyId; moons: BodyId[] };
}

/**
 * Where a body is for the picture (`sight()` and `wakusei-sight`): whether it is in view, and if not, the edge it lies beyond and where along it, the way to it and whether it is behind the camera (`Sight`), with its id,
 * its kind and, for a moon, the body it goes round.
 *
 * @example
 * ```ts no-run
 * import type { BodySight } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const mars: BodySight = { id: "mars", kind: "planet", inView: false, behind: false, edge: "right", x: 640, y: 210, along: 210, angle: 84 };
 * console.log(mars.inView ? "in view" : `beyond the ${mars.edge} edge`);
 * ```
 */
export interface BodySight extends Sight {
  /** A body's id, or a craft's own id (`voyager1`, `roadster`) when `kind` is `spacecraft`. */
  id: string;
  kind: SpaceKind | "spacecraft";
  host?: BodyId;
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
  /** How the camera moves there: the view's `transition` by default. */
  transition?: TravelKind;
  /** How long the move takes, in milliseconds: the plan's own length by default. */
  duration?: number;
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
/** The kinds of move between two views, as `transition` names them. */
const TRAVEL_KINDS: readonly TravelKind[] = ["turn-travel", "direct", "look-back", "auto", "cut"];
const readTravel = (value: unknown, fallback: TravelKind): TravelKind => {
  const name = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (TRAVEL_KINDS as readonly string[]).includes(name) ? (name as TravelKind) : fallback;
};
const readPace = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(20, Math.max(0.05, n)) : fallback;
};
/** A zoom event less than this many milliseconds after the one before is of the same gesture (the family's own window for a turn of the wheel). */
const GESTURE_GAP_MS = 300;
const REGION_IDS: readonly SunRegion[] = SUN_REGIONS.map((region) => region.id);
const readRegion = (value: unknown): SunRegion | undefined => (typeof value === "string" && (REGION_IDS as readonly string[]).includes(value.trim().toLowerCase()) ? (value.trim().toLowerCase() as SunRegion) : undefined);
/** The far names' strength from the attribute: a number from 0 to 1, or undefined when it is not set or not a number. */
const readFar = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : undefined;
};
const RAD = Math.PI / 180;
const REAL_TIME_TICK_MS = 60_000;
/** The plain wheel in an immersive view is passed on as a pinch of this share, so a notch (100) zooms about 1.2 times, as the family's mouse wheel does with Alt. */
const WHEEL_AS_PINCH = 0.2;
/** The least time between two `wakusei-timechange` events while time runs: a few a second at most, however fast the picture is drawn. */
const TIME_EVENT_MS = 250;
/** A listener as `addEventListener` takes one, typed or not. */
type Listener = EventListenerOrEventListenerObject | ((this: HTMLElement, ev: never) => unknown) | null;
/** The least time between two `wakusei-sight` events while the view moves, in milliseconds. */
const SIGHT_EVENT_MS = 250;

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

const STYLE = `<style>:host{display:block;aspect-ratio:1/1;position:relative;overflow:hidden}:host([immersive]){aspect-ratio:auto;width:100%;height:100%;touch-action:none!important;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}#stage,#labels{position:absolute;inset:0}#labels{pointer-events:none;overflow:hidden}.sp-label{position:absolute;left:0;top:0;margin:0;padding:0;border:0;background:none;font:12px/16px system-ui,-apple-system,sans-serif;color:#fff;white-space:nowrap;text-shadow:0 0 3px #000,0 0 3px #000;will-change:transform;pointer-events:none}.sp-label:focus-visible{outline:2px solid #6cd0ff;outline-offset:2px;border-radius:4px}.sp-label::before{content:"";display:inline-block;width:5px;height:5px;margin:0 5px 1px -2px;border-radius:50%;background:#fff}.sp-label[data-flip]{display:flex;flex-direction:row-reverse}.sp-label[data-flip]::before{margin:0 -2px 1px 5px}.sp-label[hidden]{display:none}.sp-arrow{position:absolute;left:0;top:0;margin:0;padding:0 4px 0 0;border:0;background:none;font:12px/16px system-ui,-apple-system,sans-serif;color:#fff;opacity:.8;white-space:nowrap;text-shadow:0 0 3px #000,0 0 3px #000;will-change:transform;pointer-events:auto;cursor:pointer}.sp-arrow::before{content:"";display:inline-block;width:0;height:0;margin:0 5px 1px 0;border:5px solid transparent;border-left:7px solid #fff;transform:rotate(var(--turn,0deg));transform-origin:30% 50%}.sp-arrow[hidden]{display:none}.sp-arrow:focus-visible{outline:2px solid #6cd0ff;outline-offset:2px;border-radius:4px}.sp-label[data-far]:not([data-carried]),.sp-ring[data-far]:not([data-carried]){opacity:var(--wakusei-far-opacity,.5)}.sp-arrow[data-far]{opacity:calc(.8*var(--wakusei-far-opacity,.5))}.sp-label,.sp-ring,.sp-arrow{transition:opacity .35s ease}.sp-label[data-carried],.sp-ring[data-carried]{opacity:0;pointer-events:none}@media (prefers-reduced-motion:reduce){.sp-label,.sp-ring,.sp-arrow{transition:none}}.sp-ring{position:absolute;left:0;top:0;width:16px;height:16px;margin:-8px 0 0 -8px;box-sizing:border-box;border:1.5px solid rgba(255,255,255,.85);border-radius:50%;box-shadow:0 0 3px #000;pointer-events:none;will-change:transform}.sp-ring[hidden]{display:none}.sp-scale{position:absolute;left:10px;top:8px;margin:0;padding:0;font:12px/16px system-ui,-apple-system,sans-serif;color:#fff;opacity:.9;text-shadow:0 0 3px #000,0 0 3px #000;pointer-events:none}.sp-region{position:absolute;left:10px;bottom:8px;margin:0;padding:0;font:600 15px/20px system-ui,-apple-system,sans-serif;color:#fff;opacity:.95;text-shadow:0 0 4px #000,0 0 4px #000;pointer-events:none;transition:opacity .35s}.sp-region[hidden]{display:block;opacity:0}@media (prefers-reduced-motion:reduce){.sp-region{transition:none}}.sp-note{position:absolute;left:10px;right:10px;top:28px;max-width:44em;margin:0;padding:0;font:12px/16px system-ui,-apple-system,sans-serif;color:#fff;opacity:.92;text-shadow:0 0 3px #000,0 0 3px #000;pointer-events:none}.sp-note[hidden],.sp-oort[hidden]{display:none}.sp-oort{position:absolute;left:0;top:0;margin:0;padding:0;font:italic 12px/16px system-ui,-apple-system,sans-serif;color:#aeb8e6;white-space:nowrap;text-shadow:0 0 3px #000,0 0 3px #000;will-change:transform;pointer-events:none}</style><div id="stage"></div><div id="labels"></div><p class="sp-scale" part="scale" role="status"></p><p class="sp-region" id="region" part="region" role="status" hidden></p><p class="sp-note" part="note" role="status" hidden></p><p class="sp-oort" part="oort" hidden></p>`;

const orbiterLines = (value: string | null): "all" | "chosen" | "none" => (value === "chosen" || value === "none" ? value : "all");

/**
 * The `<wakusei-space>` custom element: the Earth, the Moon, the Sun and the planets where they are at a date and time, drawn with three.js through the shared renderer. It takes `center`
 * (`"lon,lat"`), `time` (`now` or an ISO date), `speed` (1 is real time, 0 holds, 86400 is a day a second, negative runs backwards), `scale` (`compressed` or `true`), `look` (`realistic` or `painted`),
 * `light` (`sun` or `lit`), `lang` (`en` or `ja`: the names), `labels` and `orbits` (`off` hides them), `all-moons` (every other known moon as a dot round its planet, from `/moon-catalogue`, fetched when first asked for), and `texture-base`, `texture-far-base`, `max-texture` and `tiles` (where the finer map tiles are, for a close zoom; `off` for none). Positions come from this package's own models. It draws
 * only when something changes, and nothing while it is out of sight.
 *
 * The names and markers of bodies outside the system in the middle of the view are drawn at half strength (`far-opacity`, 0 to 1). A body under the pointer, a finger or the keyboard's focus lights its own system instead and
 * sends `wakusei-body-hover` with the body and its system (`wakusei-body-hover-end` when none is). `sight()` says which bodies are in view and, for the rest, the edge of the picture each lies beyond; `wakusei-sight`
 * fires when that changes. None of these draws the picture again.
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
  static observedAttributes = ["center", "time", "speed", "scale", "labels", "labels-always", "covered", "roadster", "spacecraft", "orbiters", "orbiter", "orbiter-lines", "orbiter-track", "orbits", "help", "look", "light", "lang", "data", "arrows", "help-through", "places", "earth-places", "earth-places-look", "all-moons", "far-opacity", "transition", "pace", "belts", "moon-size", ...NAME_LABEL_ATTRIBUTES];

  #model: SpaceModel = newSpaceModel();
  #allMoons = false;
  #catalogue: Promise<(ms: number) => readonly MoonDot[]> | undefined;
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
  #markLayer: PlaceLayerView | undefined;
  #markList: { body: BodyId; list: readonly Place[] } | undefined;
  #markLoading: BodyId | undefined;
  #markHeard: (() => void) | undefined;
  #placeGlide = 0;
  #earthLayer: EarthPlaceLayerView | undefined;
  #earthSurface: Parameters<NonNullable<Parameters<typeof createSpaceItem>[1]["onEarth"]>>[0] = null;
  #earthHeard: (() => void) | undefined;
  #earthList: { text: string; list: readonly EarthPlace[] } | undefined;
  #earthOmitted = 0;
  #surface: Parameters<NonNullable<Parameters<typeof createSpaceItem>[1]["onSurface"]>>[0] = null;

  /** The shared controller behind the element's own hands: for a page that moves the view itself, such as `controller.set({ zoom: space.zoomFor("moon") })`. It is there while the element is connected, whether `controls` is `none` or not. */
  get controller(): ViewController | undefined {
    return this.#hands?.controller;
  }

  connectedCallback(): void {
    this.#model.centre = readCentre(this.getAttribute("center")) ?? this.#model.centre;
    this.#clock = createGameClock(readTime(this.getAttribute("time")), this.#readSpeed());
    this.#model.time = this.#clock.time;
    this.#model.mode = this.getAttribute("scale") === "compressed" ? "compressed" : "true";
    this.#model.moonSize = readMoonSize(this.getAttribute("moon-size") ?? 2);
    this.#model.labels = this.getAttribute("labels") !== "off";
    this.#labelsAlways = this.hasAttribute("labels-always") && this.getAttribute("labels-always") !== "off";
    this.#covered = this.getAttribute("covered") === "arrow" ? "arrow" : "name";
    this.roadster = this.hasAttribute("roadster") && this.getAttribute("roadster") !== "off";
    const craft = this.getAttribute("spacecraft");
    if (craft !== null && craft !== "off") this.spacecraft = craft;
    this.orbiters = this.hasAttribute("orbiters") && this.getAttribute("orbiters") !== "off";
    this.#model.orbiterChosen = this.getAttribute("orbiter") || null;
    this.#model.orbiterLines = orbiterLines(this.getAttribute("orbiter-lines"));
    this.#model.orbiterTrack = this.hasAttribute("orbiter-track") && this.getAttribute("orbiter-track") !== "off";
    this.#model.orbits = this.getAttribute("orbits") !== "off";
    this.#model.arrowCount = arrowCount(this.getAttribute("arrows"));
    this.#model.help = this.hasAttribute("help") && this.getAttribute("help") !== "off";
    this.#model.helpThrough = this.hasAttribute("help-through") && this.getAttribute("help-through") !== "off";
    this.#travel = { kind: readTravel(this.getAttribute("transition"), "turn-travel"), pace: readPace(this.getAttribute("pace"), 1) };
    this.#model.look = this.getAttribute("look") === "painted" ? "painted" : "realistic";
    this.#model.light = readLight(this.getAttribute("light"));
    this.#relabel();
    this.#door.book.ownOnly(this.getAttribute("data") === "own");
    this.#model.belts = readBelts(this.getAttribute("belts"));
    if (this.#door.book.get(BELTS_SOURCE_ID) === undefined) this.#door.book.addSource(beltsSource());
    this.#door.book.enableSource(BELTS_SOURCE_ID, this.#model.belts.length > 0);
    this.#model.stepMs = Math.max(1000, Math.abs(this.#clock.speed) * 1000);
    this.#model.speed = this.#clock.speed;
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", "The Earth, the Moon, the Sun and the planets in their places for the date shown");

    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = STYLE;
    this.#stage = root.getElementById("stage")!;
    this.#labelBox = root.getElementById("labels")!;
    this.#scaleLine = root.querySelector<HTMLElement>(".sp-scale")!;
    this.#regionLine = root.getElementById("region")!;
    this.#noteLine = root.querySelector<HTMLElement>(".sp-note")!;
    this.#oortLabel = root.querySelector<HTMLElement>(".sp-oort")!;
    this.#nameScale();
    this.#showRegion();
    this.#pool.clear();
    this.#rings.clear();
    this.#arrows.clear();

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
      onSight: (bodies, frame) => this.#see(bodies, frame),
      wantSight: () => this.#sightAsked || this.#sightListeners.size > 0,
      onSurface: (surface) => {
        this.#surface = surface;
        this.#markSurface();
      },
      wantEarth: () => this.hasAttribute("earth-places"),
      onEarth: (surface) => {
        this.#earthSurface = surface;
        this.#layEarthPlaces();
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
    this.addEventListener("pointermove", this.#move, { passive: true });
    this.addEventListener("pointerleave", this.#leave);
    // before the shared hands (which hear it after this): a plain wheel in an immersive view zooms
    this.addEventListener("wheel", this.#wheel, { capture: true, passive: false });
    this.#hands = carryControls(this, { limits: CARRIED_LIMITS, onChange: (view, info) => this.setView(view, info.final, info.reason) });
    this.#markHeard = onPlacesLoader(() => {
      this.#markList = undefined;
      this.#markSurface();
    });
    this.#earthHeard = onEarthPlacesLayout(() => {
      this.#earthList = undefined;
      this.#askEarthPlaces();
    });
    this.#labelBox.addEventListener("click", this.#labelClick);
    this.#labelBox.addEventListener("focusin", this.#labelFocus);
    this.#labelBox.addEventListener("focusout", this.#labelBlur);
    this.#farStrength();
  }

  disconnectedCallback(): void {
    this.#hands?.unbind();
    this.#hands = undefined;
    this.removeEventListener("pointerdown", this.#down);
    this.removeEventListener("pointermove", this.#move);
    this.removeEventListener("pointerleave", this.#leave);
    window.removeEventListener("pointerup", this.#lift, true);
    window.removeEventListener("pointercancel", this.#lift, true);
    if (this.#hovered !== null) this.#hover(null, this.#hoverBy);
    clearTimeout(this.#sightTimer);
    this.#sightTimer = undefined;
    this.removeEventListener("wheel", this.#wheel, { capture: true });
    window.removeEventListener("pointerup", this.#up, true);
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#gate?.cancel();
    this.#view?.dispose();
    this.#view = undefined;
    this.#taken?.release();
    this.#taken = undefined;
    this.#markLayer?.dispose();
    this.#markLayer = undefined;
    this.#markHeard?.();
    this.#markHeard = undefined;
    this.#earthLayer?.dispose();
    this.#earthLayer = undefined;
    this.#earthSurface = null;
    this.#earthHeard?.();
    this.#earthHeard = undefined;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "center") this.centre = readCentre(value) ?? { lon: 0, lat: 0 };
    else if (name === "time") this.time = readTime(value);
    else if (name === "speed") this.speed = this.#readSpeed();
    else if (name === "scale") this.scale = value === "compressed" ? "compressed" : "true";
    else if (name === "moon-size") this.moonSize = readMoonSize(value);
    else if (name === "labels") this.labels = value !== "off";
    else if (name === "labels-always") this.labelsAlways = value !== null && value !== "off";
    else if (name === "covered") this.covered = value === "arrow" ? "arrow" : "name";
    else if (name === "roadster") this.roadster = value !== null && value !== "off";
    else if (name === "spacecraft") this.spacecraft = value === null || value === "off" ? false : value;
    else if (name === "orbiters") this.orbiters = value !== null && value !== "off";
    else if (name === "orbiter") this.orbiter = value || null;
    else if (name === "orbiter-lines") this.orbiterLines = orbiterLines(value);
    else if (name === "orbiter-track") this.orbiterTrack = value !== null && value !== "off";
    else if (name === "orbits") this.orbits = value !== "off";
    else if (name === "all-moons") this.allMoons = value !== null && value !== "off";
    else if (name === "arrows") this.arrows = arrowCount(value);
    else if (name === "help") this.help = value !== null && value !== "off";
    else if (name === "far-opacity") this.#farStrength();
    else if (name === "help-through") this.helpThrough = value !== null && value !== "off";
    else if (name === "transition") this.transition = readTravel(value, "turn-travel");
    else if (name === "pace") this.pace = readPace(value, 1);
    else if (name === "look") this.look = value === "painted" ? "painted" : "realistic";
    else if (name === "light") this.light = readLight(value);
    else if (name === "data") this.#door.book.ownOnly(value === "own");
    else if (name === "belts") this.belts = readBelts(value);
    else if (name === "lang") {
      for (const [id, button] of this.#pool) this.#nameLabel(button, id);
      this.#nameScale();
      this.#showRegion();
      this.#showNote();
      this.#relabel();
    } else if ((NAME_LABEL_ATTRIBUTES as readonly string[]).includes(name)) this.#relabel();
    if (name === "places" || name === "lang") this.#markSurface();
    if (name === "earth-places" || name === "earth-places-look") this.#askEarthPlaces();
  }

  /**
   * The layers of places marked on the body looked at: any of `landing` (crewed landings, landers and rovers), `crash` (crash, impact and atmospheric-entry sites), `planned` (announced landings) and `feature` (named features), from
   * the `places` attribute (`places="landing crash"`; `places` alone or `all` for every layer). Only a body with places (`PLACE_BODIES` from `/places`) shows any, and only once it is big enough on the screen. Setting it writes the attribute.
   */
  get places(): PlaceLayer[] {
    return readPlaceLayers(this.getAttribute("places"));
  }
  set places(layers: readonly PlaceLayer[] | null) {
    if (layers === null || layers.length === 0) this.removeAttribute("places");
    else this.setAttribute("places", layers.join(" "));
  }
  /** The marks laid on the body looked at now: each place's id, its layer and where its mark is, in CSS pixels from the view's top left. */
  get placesShown(): readonly { id: string; layer: PlaceLayer; x: number; y: number }[] {
    return this.#markLayer?.shown ?? [];
  }

  /**
   * The reader's own place and the places they keep, drawn on the Earth wherever the camera looks: a list of `{ id, lon, lat, label, kind, color }` (`kind` is `here` or `favourite`), as JSON in the attribute `earth-places`.
   * Each is a marker standing out of the ground that turns with the Earth, is hidden on the far side, fades at the edge and keeps its size in pixels; a name shows beside it when there is room, never over another name. Setting the property
   * writes the attribute, and an empty list takes it away. It reads as the list chikyu-earth cleaned (a place with a longitude or latitude out of range is left out, at most 5,000). It draws nothing, and reads as empty, until the page has
   * imported `@johnmorrisdotca/wakusei-planets/earth-places`, which brings chikyu-earth's layout (an optional peer).
   *
   * @example
   * ```ts no-run
   * import "@johnmorrisdotca/wakusei-planets/earth-places";
   * import type { WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";
   *
   * const space = document.querySelector<WakuseiSpace>("wakusei-space")!;
   * space.earthPlaces = [{ id: "me", lon: -79.4, lat: 43.7, label: "You are here", kind: "here" }];
   * ```
   */
  get earthPlaces(): EarthPlace[] {
    return [...this.#readEarthPlaces()];
  }
  set earthPlaces(list: readonly EarthPlace[] | null) {
    if (list === null || list.length === 0) this.removeAttribute("earth-places");
    else this.setAttribute("earth-places", JSON.stringify(list));
  }
  /** How the places on the Earth are drawn (the attribute `earth-places-look`): `beam` (the default), `pin` or `ring`. Setting it writes the attribute. */
  get earthPlacesLook(): EarthPlaceLook {
    return readEarthPlaceLook(this.getAttribute("earth-places-look"));
  }
  set earthPlacesLook(look: EarthPlaceLook | null) {
    if (look === null) this.removeAttribute("earth-places-look");
    else this.setAttribute("earth-places-look", look);
  }
  /** The markers laid on the Earth now, as the last draw left them: each place's id and kind, where its foot is in CSS pixels from the view's top left and whether its name is drawn; `omitted` counts the places in sight beyond the first `EARTH_PLACE_MARKS`. */
  get earthPlacesShown(): { marks: readonly EarthPlaceMark[]; omitted: number } {
    return { marks: this.#earthLayer?.shown ?? [], omitted: this.#earthOmitted };
  }

  /**
   * Go to a place on a body: the view glides to the body (as `goTo` does), or on the body looked at turns round it, and the camera comes to rest straight above the place. The place is an id (`mars/perseverance`) or an English or Japanese name, on the body looked at
   * unless `body` names another. The zoom stays on the same body and is 1 (the whole body) on another, unless `zoom` is given. Resolves the place, or `undefined` when the body has no place by that name or cannot be looked at.
   *
   * @param text - The place's id or name.
   * @param options - `body`, `smooth` (true by default) and `zoom`.
   * @returns The place, once the move has started.
   */
  async goToPlace(text: string, options: { body?: BodyId | string; smooth?: boolean; zoom?: number } = {}): Promise<Place | undefined> {
    const body = options.body === undefined ? this.#model.focus : readBody(options.body);
    if (body === undefined || !(PLACE_BODIES as readonly string[]).includes(body)) return undefined;
    const list = await this.#loadMarks(body);
    const place = findPlace(list, text);
    if (place === undefined) return undefined;
    const model = this.#model;
    const same = body === model.focus;
    const zoom = options.zoom ?? (same ? model.view.zoom : 1);
    // on another body the view glides there (as goTo does) and arrives over the place; on the same one it turns round the body to it, never through it
    if (!same && !this.goTo(body, { smooth: options.smooth, zoom })) return undefined;
    // the camera sits along the place's outward direction, which the view's yaw and tilt give as a place on the Earth's globe at the moment the view was last pointed
    const { pole, meridian } = orientation(body, model.time);
    const east = cross(pole, meridian);
    const c = Math.cos(place.lat * RAD);
    const d: Vec3 = [0, 1, 2].map((i) => c * Math.cos(place.lon * RAD) * meridian[i]! + c * Math.sin(place.lon * RAD) * east[i]! + Math.sin(place.lat * RAD) * pole[i]!) as unknown as Vec3;
    model.anchor ??= model.time;
    const earth = orientation("earth", model.anchor);
    const lat = Math.asin(Math.max(-1, Math.min(1, dot(d, earth.pole)))) / RAD;
    const lon = Math.atan2(dot(d, cross(earth.pole, earth.meridian)), dot(d, earth.meridian)) / RAD;
    const from = { ...model.view };
    const to = { yaw: model.centre.lon - lon, tilt: model.centre.lat - lat, zoom };
    to.yaw = from.yaw + ((((to.yaw - from.yaw + 180) % 360) + 360) % 360) - 180;
    const apply = (yaw: number, tilt: number, z: number, final: boolean): void => {
      if (this.#hands !== undefined && !this.hasAttribute("data-kazoku-bar")) this.#hands.controller.set({ yaw, tilt, zoom: z }, final, "place");
      else this.setView({ yaw, tilt, zoom: z, roll: from.roll, panX: from.panX, panY: from.panY }, final);
    };
    const glide = (this.#placeGlide += 1);
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!same || options.smooth === false || reduced || typeof requestAnimationFrame !== "function") {
      apply(to.yaw, to.tilt, to.zoom, true);
      return place;
    }
    const start = performance.now();
    const step = (): void => {
      if (glide !== this.#placeGlide || !this.isConnected) return;
      const k = Math.min(1, (performance.now() - start) / 900);
      const ease = k * k * (3 - 2 * k);
      apply(from.yaw + (to.yaw - from.yaw) * ease, from.tilt + (to.tilt - from.tilt) * ease, from.zoom + (to.zoom - from.zoom) * ease, k >= 1);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return place;
  }

  #readEarthPlaces(): readonly EarthPlace[] {
    const text = this.getAttribute("earth-places");
    const using = earthPlacesLayout();
    if (text === null || using === undefined) return [];
    if (this.#earthList?.text === text) return this.#earthList.list;
    // the places that matter most first: where the reader is, then the rest in the order given
    const list = using.read(text);
    const ordered = [...list.filter((place) => place.kind === "here"), ...list.filter((place) => place.kind !== "here")];
    this.#earthList = { text, list: ordered };
    return ordered;
  }

  /** The places, the look or the layout changed: lay them from the last draw's Earth, or when there was none ask for one draw to learn it. */
  #askEarthPlaces(): void {
    if (!this.hasAttribute("earth-places")) {
      this.#earthLayer?.dispose();
      this.#earthLayer = undefined;
      this.#earthSurface = null;
      this.#earthOmitted = 0;
      return;
    }
    if (this.#earthSurface !== null) this.#layEarthPlaces();
    else this.#gate?.request();
  }

  /** Lay the places over the Earth as the last draw left it, or take them away. Draws nothing: it runs inside the draw the view makes anyway. */
  #layEarthPlaces(): void {
    const surface = this.#earthSurface;
    const root = this.shadowRoot;
    const using = earthPlacesLayout();
    const clear = (): void => {
      this.#earthLayer?.clear();
      this.#earthOmitted = 0;
    };
    if (surface === null || root === null || using === undefined || !this.hasAttribute("earth-places") || !(surface.radiusPx >= EARTH_PLACES_FROM_PX)) return clear();
    const places = this.#readEarthPlaces();
    if (places.length === 0) return clear();
    this.#earthLayer ??= createEarthPlaceLayer(root);
    const layer = this.#earthLayer;
    const facts = BODIES.earth;
    const scale: Vec3 = [1, 1 - facts.flattening, 1];
    const view = spotView({ ...surface, scale });
    const sun = surface.sun === null ? null : pointUnder(surface.sun, surface.pole, surface.meridian);
    const look = this.earthPlacesLook;
    const laid = using.layout(places, view, look, {
      size: (place) => (place.label === undefined ? null : { width: layer.width(place.label), height: 18 }),
      taken: this.#nameBoxes.map((one) => ({ left: one.x, top: one.y, width: one.width, height: one.height })),
      sun,
    });
    // the first few in sight stand up; the rest are counted, never silently left out
    const marks = { shapes: laid.shapes.slice(0, EARTH_PLACE_MARKS), labels: laid.labels };
    marks.labels = laid.labels.filter((spot) => marks.shapes.some((shape) => shape.index === spot.index));
    this.#earthOmitted = laid.shapes.length - marks.shapes.length;
    layer.set(places, marks, look);
  }

  async #loadMarks(body: BodyId): Promise<readonly Place[]> {
    if (this.#markList?.body === body) return this.#markList.list;
    const load = placesLoader();
    if (load === undefined) return [];
    const list = await load(body as PlaceBody);
    this.#markList = { body, list };
    return list;
  }

  /** Lay the marks of the places over the body looked at, as the last draw left it, or take them away. Draws nothing. */
  #markSurface(): void {
    const layers = this.places;
    const surface = this.#surface;
    const root = this.shadowRoot;
    if (layers.length === 0 || surface === null || root === null || !(PLACE_BODIES as readonly string[]).includes(surface.id)) {
      if (layers.length === 0 && this.#markLayer !== undefined) {
        this.#markLayer.dispose();
        this.#markLayer = undefined;
        if (this.getAttribute("role") === "group") this.setAttribute("role", "img");
      } else this.#markLayer?.clear();
      return;
    }
    const id = surface.id;
    if (this.#markList?.body !== id) {
      this.#markLayer?.clear();
      if (this.#markLoading !== id && placesLoader() !== undefined) {
        this.#markLoading = id;
        void this.#loadMarks(id).then(() => {
          this.#markLoading = undefined;
          if (this.#markList?.body === id) this.#markSurface();
        }, () => {
          this.#markLoading = undefined;
        });
      }
      return;
    }
    if (this.#markLayer === undefined) {
      this.#markLayer = createPlaceLayer(root, {
        lang: () => (this.getAttribute("lang") === "ja" ? "ja" : "en"),
        pick: (place, at) => this.dispatchEvent(new CustomEvent("wakusei-place", { detail: { body: id, place, x: at.x, y: at.y }, bubbles: true, composed: true })),
      });
      if (this.getAttribute("role") === "img") this.setAttribute("role", "group");
    }
    const facts = BODIES[id];
    const ax = facts.axesKm;
    const scale: Vec3 = ax ? [ax[1] / facts.radiusKm, ax[2] / facts.radiusKm, ax[0] / facts.radiusKm] : [1, 1 - facts.flattening, 1];
    this.#markLayer.set(placeMarks(this.#markList.list, layers, { ...surface, scale }, facts.radiusKm));
  }

  #bodyLabel: NameLabelOptions | null | undefined;
  /**
   * The name written on each body's globe (`{ look: "painted", strength: 0.5, repeat: "once", latitude: 0, facing: false, font: "Michroma", fallbackFont: "" }`), or `null` for none. Set, it takes the place of the
   * `body-label` attributes; set to `undefined` the attributes are read again. The text is each body's own name in the element's `lang` (capitals in English). A body too small on the screen (24 CSS pixels of radius by default) carries none.
   */
  get bodyLabel(): NameLabelOptions | null {
    return this.#bodyLabel !== undefined ? this.#bodyLabel : readNameLabel(this);
  }
  set bodyLabel(value: NameLabelOptions | null | undefined) {
    this.#bodyLabel = value;
    this.#relabel();
  }
  /** Tell the scene the name on the globes changed (the attributes, the property or the language): each body is told once at the next draw. */
  #relabel(): void {
    const options = this.bodyLabel;
    this.#model.label = options === null ? null : { ...options, lang: this.getAttribute("lang") === "ja" ? "ja" : "en" };
    this.#model.labelVersion += 1;
    this.#gate?.request();
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
    this.#model.speed = this.#clock.speed;
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

  /**
   * How many times larger than life to draw moons in the squeezed scale (`moon-size`; 2 by default, from 1 to 8). 1 is the real size. Ignored at true distances. A moon is never drawn larger than a quarter of its planet, into the planet or its rings, or across to the next moon's orbit: every moon of one planet is reduced by the same factor, so they keep their order of size, and `stats.moonSize` says the factor used.
   */
  get moonSize(): number {
    return this.#model.moonSize;
  }
  set moonSize(value: number) {
    this.#model.moonSize = readMoonSize(value);
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
    if (!value) for (const label of [...this.#pool.values(), ...this.#rings.values(), ...this.#arrows.values()]) label.hidden = true;
    this.#gate?.request();
  }

  #travel: { kind: TravelKind; pace: number } = { kind: "turn-travel", pace: 1 };
  #regionLine: HTMLElement | undefined;
  /** When the last zoom event was heard at a stage out from the Sun (ms of the page's clock). The events of one gesture (a pinch, a turn of the wheel) come less than `GESTURE_GAP_MS` apart: one gesture is one step. */
  #regionZoomAt = Number.NEGATIVE_INFINITY;
  /**
   * How the camera moves from one view to the next: `turn-travel` (the default: turn beside the body being left until the next is in the picture, then travel to it, never an empty frame), `direct` (a straight
   * eased glide), `look-back` (straight, watching the body left until the end), `auto` (`turn-travel`), `cut` (no move). The attribute `transition` says the same; `goTo` and `ride` take one for a single move. A
   * reader who asked for reduced motion always gets `cut`.
   */
  get transition(): TravelKind {
    return this.#travel.kind;
  }
  set transition(value: TravelKind) {
    this.#travel = { ...this.#travel, kind: readTravel(value, this.#travel.kind) };
  }
  /** How slow the moves are: the plan's own length times this (1 by default; 2 is twice as slow). The attribute `pace` says the same; `goTo` and `ride` take `duration` in milliseconds for a single move instead. */
  get pace(): number {
    return this.#travel.pace;
  }
  set pace(value: number) {
    this.#travel = { ...this.#travel, pace: readPace(value, this.#travel.pace) };
  }
  /** The stage out from the Sun the view is framed on (`inner-planets`, `asteroid-belt`, `outer-planets`, `kuiper-belt`, `whole-system`), or null for a view of a body. */
  get region(): SunRegion | null {
    return this.#model.region;
  }
  #orbitersLoading = false;
  /**
   * Show the spacecraft in orbit round the Moon and Mars (the attribute `orbiters`; off by default): each a small dot where `/orbiters` puts it on the date shown, scaled with its body, on its orbit line, with its
   * name beside it in the page's language, once the body is at least 24 CSS pixels in radius on the screen. A modelled path is drawn dim, and a predicted one whose measured error is more than 2 per cent of its body's radius (`orbiterDim`); a craft with no path is not drawn. The paths (a 9 kB module)
   * are loaded the first time they are shown. `stats.orbiters` says what was drawn and each one's status.
   */
  get orbiters(): boolean {
    return this.#model.orbiters;
  }
  set orbiters(value: boolean) {
    this.#model.orbiters = value;
    if (value && this.#model.orbiterSet === null && !this.#orbitersLoading) {
      this.#orbitersLoading = true;
      void import("../orbiters.ts").then(
        (mod) => {
          type Id = (typeof mod.ORBITER_IDS)[number];
          this.#model.orbiterSet = {
            ids: mod.ORBITER_IDS,
            centre: (id) => mod.orbiterCentre(id as Id),
            position: (id, ms) => (mod.orbiterElements(id as Id) === undefined ? null : mod.orbiterPosition(id as Id, ms)),
            path: (id, ms, points) => mod.orbiterPath(id as Id, ms, points),
            status: (id, ms) => mod.orbiterStatus(id as Id, ms),
            dim: (id, ms) => mod.orbiterDim(id as Id, ms),
            period: (id) => mod.orbiterElements(id as Id)?.periodDays ?? null,
            name: (id) => ({ ...mod.orbiterFacts(id as Id).name }),
          };
          this.#gate?.request();
        },
        () => {
          this.#orbitersLoading = false;
        },
      );
    }
    this.#gate?.request();
  }
  /**
   * Paint one orbiter's path on the body it goes round. `id` is an orbiter such as `lro` or `mro`. `length` is how long the trail is kept, in simulated time (`1d` when left out, or `1w`, `1m`).
   * `swath` is `track` (the point under the craft, the default) or `coverage` (where it is at least 10° above the horizon). Setting another craft clears the trail. `null` clears it.
   * The trail is drawn only while time is moving, one upload a frame, and nothing at rest.
   *
   * @example
   * ```ts no-run
   * import type { WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";
   *
   * const paint = (space: WakuseiSpace): void => {
   *   space.paint = { id: "lro", length: "1d", swath: "track" };
   * };
   * console.log(typeof paint);
   * ```
   */
  get paint(): PaintSpec | null {
    const spec = this.#model.paint;
    return spec === null ? null : { id: spec.id, length: paintLengthOf(spec.length), swath: paintSwathOf(spec.swath) };
  }
  set paint(value: PaintSpec | null) {
    if (value === null) {
      this.#model.paint = null;
      this.#model.paintTrail.clear();
    } else {
      const next = { id: String(value.id), length: paintLengthOf(value.length), swath: paintSwathOf(value.swath) };
      this.#model.paint = next;
      this.#model.paintTrail.set(next);
      this.orbiters = true;
    }
    this.#gate?.request();
  }
  /** Take the painted trail off the body. */
  clearPaint(): void {
    this.paint = null;
  }
  /** Texels the trail has painted. 0 after `clearPaint`, and again when the painted craft changes. */
  get paintPixels(): number {
    return this.#model.paintTrail.pixels;
  }
  #roadsterLoading = false;
  /**
   * Show Starman and the Tesla Roadster (the attribute `roadster`; off by default): a small marked body where `/roadster` puts the car on the date shown, on its orbit line (about one trip round the Sun), with its name
   * (`Starman`, `スターマン`) beside it, from the launch in 2018 to the end of 2035. Its path (a 20 kB table) is loaded the first time it is shown, and never when it is not. `stats.roadster` says what was drawn.
   */
  get roadster(): boolean {
    return this.#model.roadster;
  }
  set roadster(value: boolean) {
    this.#model.roadster = value;
    if (value && this.#model.roadsterPath === null && !this.#roadsterLoading) {
      this.#roadsterLoading = true;
      // the table comes with the module, so it is fetched only when the car is first shown
      void import("../roadster.ts").then(
        (mod) => {
          this.#model.roadsterPath = { positionAu: (ms) => mod.roadsterPositionAu(ms), record: { ...mod.ROADSTER.record }, name: { ...mod.ROADSTER.name } };
          this.#gate?.request();
        },
        () => {
          this.#roadsterLoading = false;
        },
      );
    }
    this.#gate?.request();
  }

  #craftToken = 0;
  /**
   * The deep-space craft (the attribute `spacecraft`; off by default). `true` or `"all"` draws every craft whose record covers the date. A space-separated list (`"voyager1 juno"`) draws those. Each craft's table loads the first time it is shown, and nothing loads while this is off. `stats.spacecraft` says what was drawn.
   */
  get spacecraft(): false | "all" | string {
    const show = this.#model.craftShow;
    if (show === null) return false;
    return show === "all" ? "all" : show.join(" ");
  }
  set spacecraft(value: boolean | string) {
    const next = value === false || value === "off" ? null : value === true || value === "all" || value === "true" ? "all" : value.split(/\s+/).filter((id) => id.length > 0);
    this.#model.craftShow = next === null || next === "all" ? next : next;
    if (next === null) {
      this.#model.craftPlaces = null;
      this.#model.craftIds = [];
      this.#model.craftNames = null;
      this.#gate?.request();
      return;
    }
    const token = ++this.#craftToken;
    const wanted = next;
    void import("../spacecraft.ts").then(async (mod) => {
      if (token !== this.#craftToken) return;
      const known = mod.SPACECRAFT_IDS as readonly string[];
      const ids = (wanted === "all" ? [...known] : wanted.filter((id) => known.includes(id))) as (typeof mod.SPACECRAFT_IDS)[number][];
      await mod.loadSpacecraft(...ids);
      if (token !== this.#craftToken || this.#model.craftShow === null) return;
      const au = 149_597_870.7;
      this.#model.craftIds = ids;
      this.#model.craftNames = (id, lang) => mod.SPACECRAFT[id as (typeof ids)[number]].name[lang];
      this.#model.craftPlaces = (ms) => ids.map((id) => {
        const craft = mod.SPACECRAFT[id];
        if (ms < craft.record.start || ms > craft.record.end || craft.record.end === 0) return { id, au: null };
        const km = mod.spacecraftPosition(id, ms);
        return { id, au: [km[0] / au, km[1] / au, km[2] / au] as [number, number, number] };
      });
      this.#gate?.request();
    });
    this.#gate?.request();
  }
  /**
   * The orbiter picked out (the attribute `orbiter`, an id from `/orbiters` such as `lro`; none by default): its orbit line is drawn brighter, it alone keeps its line when `orbiterLines` is
   * `chosen`, and its ground track is drawn when `orbiterTrack` is on.
   */
  get orbiter(): string | null {
    return this.#model.orbiterChosen;
  }
  set orbiter(value: string | null) {
    this.#model.orbiterChosen = value;
    this.#gate?.request();
  }
  /** Which orbiters' orbit lines are drawn (the attribute `orbiter-lines`): `all` (the default), `chosen` (the one `orbiter` names) or `none`. Apart from the planets' and moons' lines (`orbits`). */
  get orbiterLines(): "all" | "chosen" | "none" {
    return this.#model.orbiterLines;
  }
  set orbiterLines(value: "all" | "chosen" | "none") {
    this.#model.orbiterLines = orbiterLines(value);
    this.#gate?.request();
  }
  /**
   * Draw the chosen orbiter's ground track (the attribute `orbiter-track`; off by default): the line on its body under the craft from one trip before the moment shown to one trip after, the body
   * turning beneath it, so each trip crosses the equator further west.
   */
  get orbiterTrack(): boolean {
    return this.#model.orbiterTrack;
  }
  set orbiterTrack(value: boolean) {
    this.#model.orbiterTrack = value;
    this.#gate?.request();
  }
  #covered: "name" | "arrow" = "name";
  #arrows = new Map<string, HTMLElement>();
  /**
   * What a body behind another gets (the attribute `covered`): `name` (the default) draws its floating name and ring over the nearer body's disc as always; `arrow` draws instead one small quiet arrow just outside the
   * disc's edge on the side nearest the hidden body, pointing in behind it, with the surest hidden body's name beside it and the others counted (`Uranus +4`); a press on it goes to that body. The arrow goes as the body comes out.
   */
  get covered(): "name" | "arrow" {
    return this.#covered;
  }
  set covered(value: "name" | "arrow") {
    this.#covered = value;
    if (this.#places) this.#placeLabels(this.#places);
  }
  #labelsAlways = false;
  /**
   * Keep a body's floating name and dot while its name is drawn on its globe (the attribute `labels-always`; off by default). Off, a body that carries its drawn name (`body-label` on, and the body at least 24 CSS pixels in
   * radius) fades its floating name and dot out, and they fade back when it shrinks below that; bodies with no drawn name keep their floating names.
   */
  get labelsAlways(): boolean {
    return this.#labelsAlways;
  }
  set labelsAlways(value: boolean) {
    this.#labelsAlways = value;
    if (this.#places) this.#placeLabels(this.#places);
  }

  /**
   * How strongly the names and markers of bodies outside the system in the middle of the view are drawn, from 0 (not at all) to 1 (as strongly as the others): the attribute `far-opacity`, 0.5 when it is not set
   * (a page may set the CSS property `--wakusei-far-opacity` instead). The system in the middle is the body looked at, the body it goes round, and that body's moons; while a body is under the pointer, a finger or the
   * keyboard's focus, its own system is drawn at full strength instead, and the rest at this strength.
   */
  get farOpacity(): number {
    return readFar(this.getAttribute("far-opacity")) ?? 0.5;
  }
  set farOpacity(value: number) {
    this.setAttribute("far-opacity", String(Math.min(1, Math.max(0, value))));
  }

  #farStrength(): void {
    const far = readFar(this.getAttribute("far-opacity"));
    if (far === undefined) this.#labelBox?.style.removeProperty("--wakusei-far-opacity");
    else this.#labelBox?.style.setProperty("--wakusei-far-opacity", String(far));
  }

  /** The body under the pointer, a finger or the keyboard's focus now, or null: its system's names are drawn at full strength. */
  get hovered(): BodyId | null {
    return this.#hovered;
  }

  /**
   * Where each body is for the picture at the last draw: in view or not, and for one out of view the edge of the picture it lies beyond, the point on that edge, the way to it, and whether it is behind the camera. It
   * covers the Sun, the planets, the dwarf planets and the minor bodies, the moons of the body looked at and any other moon drawn; not the body the camera rides on. `wakusei-sight` fires with the same list whenever a
   * body comes into view or leaves it, changes edge, or moves 8 CSS pixels along its edge, at most four times a second with a last one when the view settles, and never at rest: a page draws its own tabs at the edges
   * from it. The view works it out only once it is asked: the first call (or the first `wakusei-sight` listener) asks for one draw, and the list is there from that draw on.
   */
  sight(): BodySight[] {
    if (!this.#sightAsked) {
      this.#sightAsked = true;
      this.#gate?.request();
    }
    return Object.values(this.#sight).map((one) => ({ ...one }));
  }

  #sightAsked = false;
  #sightListeners = new Set<NonNullable<Listener>>();
  // the sight of the bodies is worked out only for a page that listens for it (or has asked `sight()`)
  override addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  override addEventListener(type: string, listener: Listener, options?: boolean | AddEventListenerOptions): void {
    if (listener === null) return;
    super.addEventListener(type, listener as EventListenerOrEventListenerObject, options);
    if (type !== "wakusei-sight") return;
    const first = this.#sightListeners.size === 0 && !this.#sightAsked;
    this.#sightListeners.add(listener);
    if (first) this.#gate?.request();
  }
  override removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
  override removeEventListener(type: string, listener: Listener, options?: boolean | EventListenerOptions): void {
    if (listener === null) return;
    super.removeEventListener(type, listener as EventListenerOrEventListenerObject, options);
    if (type === "wakusei-sight") this.#sightListeners.delete(listener);
  }

  get orbits(): boolean {
    return this.#model.orbits;
  }
  set orbits(value: boolean) {
    this.#model.orbits = value;
    this.#gate?.request();
  }

  /**
   * Whether every other known moon is drawn as a small dot round its planet (the attribute `all-moons`): the moons of `/moon-catalogue` the view does not draw in full, each at its mean-orbit place. The catalogue is fetched,
   * as a chunk of its own, the first time they are turned on; a view that never turns them on never loads it.
   */
  get allMoons(): boolean {
    return this.#allMoons;
  }
  set allMoons(value: boolean) {
    this.#allMoons = value;
    if (!value) {
      this.#model.allMoons = null;
      this.#gate?.request();
      return;
    }
    this.#catalogue ??= import("../moon-catalogue.ts").then(({ MOON_CATALOGUE, catalogueMoonPosition }) => {
      const hosts: readonly string[] = [...SPACE_PLANETS, ...SPACE_DWARFS];
      const shown = MOON_CATALOGUE.filter((m) => !m.full && m.orbit !== null && hosts.includes(m.host));
      return (ms: number) => shown.map((m) => ({ host: m.host as SpacePlanet | SpaceDwarf, km: catalogueMoonPosition(m, ms)! }));
    });
    void this.#catalogue.then((dots) => {
      if (!this.#allMoons) return;
      this.#model.allMoons = dots;
      this.#gate?.request();
    });
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
  setView(view: { yaw: number; tilt: number; zoom: number; roll?: number; panX?: number; panY?: number }, final = true, reason?: string): void {
    const now = this.#model.view;
    if (this.#model.region !== null && view.zoom !== 1) {
      // at a stage out from the Sun a zoom gesture is a step: out to the next stage, in to the one before (or the Sun); one gesture, one step, and the controls go back to holding zoom 1 (the element's own
      // hands are set here; a bar bound to the element hears `wakusei-hop` with zoom 1, which a step or a refused gesture both announce)
      const at = performance.now();
      const fresh = at - this.#regionZoomAt > GESTURE_GAP_MS;
      this.#regionZoomAt = at;
      if (fresh && this.#model.transition === null) {
        if (view.zoom < 1) this.stepOut();
        else this.stepIn();
      } else this.#announceHop(1);
      this.#hands?.controller.set({ zoom: 1 }, true, "jump");
      return;
    }
    const [roll, panX, panY] = [view.roll ?? 0, view.panX ?? 0, view.panY ?? 0];
    if (view.yaw === now.yaw && view.tilt === now.tilt && view.zoom === now.zoom && roll === now.roll && panX === now.panX && panY === now.panY) return;
    // a double click jumps the zoom to 1 or to 2: stand so a companion is in the picture. A drag, a wheel step or the side just chosen does not.
    if (!this.#siding && reason === "zoom" && (view.zoom === 1 || view.zoom === 2) && Math.abs(view.zoom - now.zoom) > 0.4 && this.#model.pose.valid) {
      const side = this.#faceApproach(this.#model.focus);
      if (side) {
        this.#siding = true;
        this.#hands?.controller.set({ ...side, zoom: view.zoom, roll, panX: 0, panY: 0 }, true, "set");
        this.#siding = false;
        return;
      }
    }
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
   * Go to a body: it becomes the middle of the view and the zoom brings it whole into view (`zoom`, 1 by default; a planet's `-moons` preset for its system), travelling there from where the camera is (`transition`,
   * the view's own by default; `duration` in milliseconds, the plan's own by default) unless `smooth` is false or the reader asked for reduced motion. The travel arrives from the side it comes from, moved round
   * towards the Sun where that side would show the body mostly dark, so the way in is straight: the controls' yaw and tilt are set to that side. A stage out from the Sun (`inner-planets`, `asteroid-belt`,
   * `outer-planets`, `kuiper-belt`, `whole-system`) is a target too: the Sun is looked at and the camera stands back until the stage's orbits are all in the picture, with the stage's name shown. `wakusei-hop`
   * tells the page where it went and where the next and previous hops lead. A name in any case, in English or Japanese, works.
   *
   * @param target - A body's name (`"saturn"`, `"Saturn"`, `"土星"`) or a stage's id.
   * @param options - `smooth` (true by default), `zoom` (1 by default), `transition` and `duration`.
   * @returns Whether the view can go there.
   */
  goTo(target: BodyId | string, options: { smooth?: boolean; zoom?: number; transition?: TravelKind; duration?: number } = {}): boolean {
    const region = readRegion(target);
    if (region !== undefined) {
      this.#goToRegion(region, options);
      return true;
    }
    const id = readBody(target);
    if (!id) return false;
    const model = this.#model;
    const leaving = this.#leaving();
    this.#arrivedFrom = leaving;
    const kind = this.#moveKind(options, id);
    if (model.ride !== null) this.ride(null, { smooth: false });
    model.transition = this.#startMove(kind, leaving, id, options.duration);
    model.region = null;
    this.#showRegion();
    this.#selected = id;
    this.#model.focus = id;
    const zoom = options.zoom ?? 1;
    // the side the camera comes from, as the controls' yaw and tilt: the element's own hands are set to it here, and a bar bound to the element (which holds the view's state) hears it in the event with the zoom
    // a straight move (`direct`, `look-back`) keeps its destination in the picture all the way, and is not turned to a companion's side: that could take the destination out of the picture. A turning move may be, and its plan
    // works round the planet in a way that never leaves the picture empty (`travelPlan`).
    const swing = kind === "cut" || kind === "turn-travel";
    const side = this.#faceApproach(id, swing);
    if (!this.hasAttribute("data-kazoku-bar")) this.#hands?.controller.set(side ? { ...side, zoom } : { zoom }, true, "jump");
    this.#schedule();
    this.#gate?.request();
    this.#announceHop(zoom, side ?? undefined);
    return true;
  }

  /** The body the camera is at now: the target of the ride, or the body looked at. */
  #leaving(): BodyId {
    const ride = this.#model.ride;
    if (ride !== null) return typeof ride.target === "string" ? (ride.target as BodyId) : (ride.around as BodyId);
    return this.#model.focus;
  }

  /**
   * The kind of move a call gets: `cut` for `smooth: false`, for a reader who asked for reduced motion, or before the first draw; else the call's `transition`, or the view's. `auto` is `direct` when the
   * destination is on the screen as the move starts (it stays in view and grows), `turn-travel` when it is not.
   */
  #moveKind(options: { smooth?: boolean; transition?: TravelKind }, destination: BodyId | null = null): TravelKind {
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!(options.smooth ?? true) || reduced || !this.#model.pose.valid) return "cut";
    const kind = readTravel(options.transition, this.#travel.kind);
    if (kind !== "auto") return kind;
    const place = destination === null ? null : this.placeOf(destination);
    const inView = place !== null && place.x >= 0 && place.y >= 0 && place.x <= this.clientWidth && place.y <= this.clientHeight;
    return inView ? "direct" : "turn-travel";
  }

  /** A move from where the last draw left the camera, or null for a cut. The scene builds its path at the next draw. */
  #startMove(kind: TravelKind, leaving: BodyId | null, destination: BodyId | null, duration?: number): SpaceModel["transition"] {
    if (kind === "cut") return null;
    const pose = this.#model.pose;
    const leavingReach = this.#model.region !== null && leaving === "sun" ? (this.#model.regionDrawn?.reach ?? 0) : 0;
    return {
      start: performance.now(),
      duration: typeof duration === "number" && Number.isFinite(duration) && duration > 0 ? duration : 0,
      pace: this.#travel.pace,
      kind,
      from: { p: [pose.p[0], pose.p[1], pose.p[2]], q: [pose.q[0], pose.q[1], pose.q[2], pose.q[3]], fov: pose.fov },
      leaving,
      destination,
      leavingReach,
      input: null,
      plan: null,
      origin: [0, 0, 0],
    };
  }

  /** Where a body is drawn now, in Earth radii from the Earth's centre, and its drawn radius: the places the scene uses, worked out the same way. */
  #site(id: BodyId): { at: [number, number, number]; radius: number } {
    const mode = this.#model.mode;
    const pos = placeBodies(mode, frameAt(this.#model.time));
    if ((SPACE_BODIES as readonly string[]).includes(id)) return { at: [...pos[id as SpaceBody]] as [number, number, number], radius: radiusIn(id as SpaceBody, mode) };
    const host = (hostOf(id) ?? "earth") as SpacePlanet | SpaceDwarf;
    const real = moonOffset(id as MoonId, this.#model.time);
    const d = Math.hypot(real[0], real[1], real[2]);
    const k = (d === 0 ? 1 : moonDistance(mode, host, d) / d) * radiusIn(host, mode);
    const centre = pos[host];
    return { at: [centre[0] + real[0] * k, centre[1] + real[1] * k, centre[2] + real[2] * k], radius: Math.max(1e-6, (BODIES[id].radiusKm / BODIES[host].radiusKm) * radiusIn(host, mode) * moonScaleFor(mode, host, this.#model.moonSize, this.#model.time).factor) };
  }

  #siding = false;
  /** The body the camera was at when the latest arrival was chosen, so that body can stay in the picture. */
  #arrivedFrom: BodyId | null = null;

  /** Moons or the planet first, then the body left or the planet nearest that way, then the Sun. */
  #companions(id: BodyId): ArrivalCompanion[] {
    const out: ArrivalCompanion[] = [];
    const seen = new Set<string>();
    const add = (body: BodyId, rank: 1 | 2 | 3): void => {
      if (body === id || seen.has(body)) return;
      seen.add(body);
      out.push({ id: body, at: this.#site(body).at, rank });
    };
    const host = hostOf(id);
    if (host !== undefined) add(host, 1);
    for (const moon of (MOONS_OF as Record<string, readonly BodyId[]>)[id] ?? []) add(moon, 1);
    if (this.#arrivedFrom !== null) add(this.#arrivedFrom, 2);
    const here = this.#site(id).at;
    const from = sub(this.#model.camera.position, here);
    const approach = length(from) < 1e-9 ? ([0, 0, 1] as Vec3) : unit(from);
    let nearest: { id: BodyId; score: number } | null = null;
    for (const planet of ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"] as const) {
      if (planet === id) continue;
      const away = sub(this.#site(planet).at, here);
      if (length(away) < 1e-9) continue;
      const score = dot(unit(away), approach);
      if (score > 0.15 && (nearest === null || score > nearest.score)) nearest = { id: planet, score };
    }
    if (nearest !== null) add(nearest.id, 2);
    if (id !== "sun") add("sun", 3);
    return out;
  }

  /**
   * The controls' yaw and tilt that look at a body from the side the camera comes from, swung so a companion is in the picture and the body stays at least half lit; null when the camera has not drawn yet.
   * The reader's own later turn is not touched: this runs for an arrival and for a double click, not for a drag.
   */
  #faceApproach(id: BodyId, swing = true): { yaw: number; tilt: number } | null {
    const model = this.#model;
    if (!model.pose.valid) return null;
    const body = this.#site(id);
    const sun = id === "sun" ? undefined : this.#site("sun").at;
    const aspect = this.clientWidth > 0 && this.clientHeight > 0 ? this.clientWidth / this.clientHeight : 16 / 9;
    const wanted = travelArrival({ body: body.at, radius: body.radius, from: model.camera.position, sun, aspect, companions: swing ? this.#companions(id) : [] });
    model.companion = wanted.companion;
    const side: [number, number, number] = [wanted.position[0] - body.at[0], wanted.position[1] - body.at[1], wanted.position[2] - body.at[2]];
    const anchor = model.anchor ?? model.time;
    // the scene aims from the ground direction of (lon - yaw, lat - tilt) at the anchor moment: search the pair that lies along the wanted side, coarse then fine
    const score = (yaw: number, tilt: number): number => {
      const aim = groundDirection(model.centre.lon - yaw, Math.max(-90, Math.min(90, model.centre.lat - tilt)), anchor);
      return aim[0] * side[0] + aim[1] * side[1] + aim[2] * side[2];
    };
    let best = { yaw: model.view.yaw, tilt: model.view.tilt, score: -Infinity };
    for (let yaw = -180; yaw < 180; yaw += 6) for (let tilt = -85; tilt <= 85; tilt += 5) {
      const n = score(yaw, tilt);
      if (n > best.score) best = { yaw, tilt, score: n };
    }
    for (let yaw = best.yaw - 6; yaw <= best.yaw + 6; yaw += 1) for (let tilt = Math.max(-89, best.tilt - 5); tilt <= Math.min(89, best.tilt + 5); tilt += 1) {
      const n = score(yaw, tilt);
      if (n > best.score) best = { yaw, tilt, score: n };
    }
    return { yaw: best.yaw, tilt: best.tilt };
  }

  /** Go to a stage out from the Sun: the Sun is looked at and the camera stands back until every orbit of the stage is in the picture; from another stage the move is a straight pull back or push in. */
  #goToRegion(region: SunRegion, options: { smooth?: boolean; transition?: TravelKind; duration?: number }): void {
    const model = this.#model;
    const leaving = this.#leaving();
    const kind = this.#moveKind(options, "sun");
    if (model.ride !== null) this.ride(null, { smooth: false });
    model.transition = this.#startMove(kind, model.region !== null ? "sun" : leaving, "sun", options.duration);
    model.region = region;
    this.#selected = "sun";
    model.focus = "sun";
    // at a stage the controls hold zoom 1: a zoom gesture is taken as a step out or in, not as a zoom
    if (!this.hasAttribute("data-kazoku-bar")) this.#hands?.controller.set({ zoom: 1 }, true, "jump");
    this.#showRegion();
    this.#schedule();
    this.#gate?.request();
    this.#announceHop(1);
    this.dispatchEvent(new CustomEvent("wakusei-region", { detail: { region, name: this.#regionName(region) }, bubbles: true, composed: true }));
  }

  /** The next stage out from the Sun from where the view is (the first stage from a body), with the same move as `goTo`; null, and nothing done, when the view is already at the widest stage. */
  stepOut(options: { smooth?: boolean; transition?: TravelKind; duration?: number } = {}): SunRegion | null {
    const here = this.#model.region;
    const next = here === null ? REGION_IDS[0]! : REGION_IDS[REGION_IDS.indexOf(here) + 1];
    if (next === undefined) return null;
    this.#goToRegion(next, options);
    return next;
  }

  /** The next stage in towards the Sun from the stage the view is at, or the Sun itself (`"sun"`, zoom 1) from the first stage; null, and nothing done, when the view is not at a stage. */
  stepIn(options: { smooth?: boolean; transition?: TravelKind; duration?: number } = {}): SunRegion | "sun" | null {
    const here = this.#model.region;
    if (here === null) return null;
    const i = REGION_IDS.indexOf(here);
    if (i <= 0) {
      this.goTo("sun", options);
      return "sun";
    }
    this.#goToRegion(REGION_IDS[i - 1]!, options);
    return REGION_IDS[i - 1]!;
  }

  #regionName(region: SunRegion): string {
    const name = SUN_REGIONS.find((entry) => entry.id === region)!.name;
    return this.getAttribute("lang") === "ja" ? name.ja : name.en;
  }

  /** The stage's name in the corner of the view, in the element's language, or nothing at a body. */
  #showRegion(): void {
    const line = this.#regionLine;
    if (!line) return;
    const region = this.#model.region;
    line.textContent = region === null ? "" : this.#regionName(region);
    line.hidden = region === null;
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

  /** `zoom` is the zoom the page should bring the view to: given by `goTo`, left out when the body was only set (the zoom stays). `side` is the controls' yaw and tilt that look from the side the camera comes from, given by a `goTo` that travels. */
  #announceHop(zoom?: number, side?: { yaw: number; tilt: number }): void {
    this.dispatchEvent(new CustomEvent("wakusei-hop", { detail: { ...this.hopper, zoom, ...(side ? { yaw: side.yaw, tilt: side.tilt } : {}) }, bubbles: true, composed: true }));
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
    const leaving = this.#leaving();
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
    // a ride to somewhere other than the belt's own point ends the flight through it
    if (this.#flight !== null && (model.ride === null || model.ride.target !== this.#flight.point)) this.#flight = null;
    const destination = target !== null && typeof target === "string" ? (readBody(target) ?? null) : target === null ? this.#model.focus : null;
    model.transition = this.#startMove(this.#moveKind(options, destination), leaving, destination, options.duration);
    if (model.transition !== null && model.ride?.view === "beside" && typeof model.ride.target === "string") {
      // beside a moon the picture can be swung round the line from its planet by the controls' yaw: take the yaw that puts the camera nearest the side it comes from, so the way in is straight
      const yaw = this.#besideYaw(model.ride.target as MoonId | "moon");
      if (yaw !== null && !this.hasAttribute("data-kazoku-bar")) this.#hands?.controller.set({ yaw, tilt: 0 }, true, "jump");
    }
    model.region = null;
    this.#showRegion();
    this.#showNote();
    this.#schedule();
    this.#gate?.request();
    this.dispatchEvent(new CustomEvent("wakusei-ride", { detail: this.riding }));
  }

  /** The controls' yaw for the view from beside a moon that puts the camera nearest the side it comes from, in whole degrees; null before the first draw. */
  #besideYaw(moon: MoonId | "moon"): number | null {
    const model = this.#model;
    if (!model.pose.valid) return null;
    const host = (moon === "moon" ? "earth" : (hostOf(moon) ?? "earth")) as "earth" | SpacePlanet | SpaceDwarf;
    const site = this.#site(moon);
    const planet = this.#site(host);
    const sun = this.#site("sun").at;
    const north = orientation(host, model.time).pole;
    const from = model.camera.position;
    let best = { yaw: 0, near: -Infinity };
    for (let yaw = 0; yaw < 360; yaw += 10) {
      const camera = besideMoon({ moon: site.at, moonRadius: site.radius, host: planet.at, hostRadius: planet.radius, sun, north, aspect: 16 / 9, zoom: 1, yaw, tilt: 0 });
      const a: [number, number, number] = [camera.position[0] - site.at[0], camera.position[1] - site.at[1], camera.position[2] - site.at[2]];
      const b: [number, number, number] = [from[0] - site.at[0], from[1] - site.at[1], from[2] - site.at[2]];
      const near = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b) || 1);
      if (near > best.near) best = { yaw, near };
    }
    return best.yaw;
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
    camera: { position: [number, number, number]; fov: number; up: [number, number, number]; forward: [number, number, number] };
    /** What the painter has made at the last draw: the bodies with a drawing, the moons shown round a planet that is near, and the moons made and not yet let go. */
    bodies: { look: string; painted: number; moons: number; held: number };
    /** What the windows of finer map tiles on the bodies are doing at the last draw, summed: tile fetches made, tiles being fetched, tiles or windows that failed, and the finest level on a body now (`null` for none). */
    tiles: { requested: number; loading: number; failed: number; shown: number | null };
    ride: { riding: boolean; lost: boolean; gliding: boolean };
    /** The camera's move at the last draw, or null when it is still: its kind and path, its stage, how far along it is (0 to 1), its length in milliseconds, and whether the body left and the one gone to are in the picture. */
    travelling: { kind: string; path: string; stage: "turn" | "travel" | "arrive"; progress: number; duration: number; leaving: boolean; destination: boolean } | null;
    /** The stage out from the Sun the view is framed on, or null: its id and name, how far it reaches from the Sun and how far back the camera stands, in Earth radii. */
    region: { id: string; name: string; reach: number; distance: number } | null;
    /** The data door: the small bodies of a page's own sources in the one instanced draw (`points`), the package's own belts (`belts` bodies in `draws` instanced draws, one for each belt), and what the sources have done (tile loads started, failed and refused, bytes held, records read). */
    door: { points: number; belts: number; draws: number; sources: ReturnType<DoorHost["book"]["stats"]> };
    /** The catalogue's other moons (`all-moons`): whether they are asked for, whether the catalogue has loaded, and how many dots the last draw drew. */
    allMoons: { on: boolean; loaded: boolean; dots: number };
    /** The orbit lines drawn at the last draw (`earth`, the planets, `moon`), and how far each body is from its own line as a fraction of the line's radius: a body on its line reads under 0.01. */
    orbits: { drawn: string[]; miss: Record<string, number>; hidden: string[] };
    /** The arrowheads on the orbit lines at the last draw, by line (`earth`, the planets, `moon`): where each is and the way it points, the way the body goes (not the way the clock runs). */
    arrows: Record<string, { position: [number, number, number]; direction: [number, number, number] }[]>;
    /** How long an arrowhead on an orbit line is on the screen at the last draw, in CSS pixels (0 when none is drawn): the same at every zoom. */
    arrowPx: number;
    /** What help mode drew at the last draw, or null: the body, the axis it spins about, its north pole, and the axis the drawn arrow itself turns about. */
    help: { body: string; axis: [number, number, number]; pole: [number, number, number]; retrograde: boolean; arcTurn: [number, number, number] } | null;
    /** The names on the globes at the last draw: how many are drawn (made, their font in, and the body big enough on the screen), and the one on the body looked at (its text and its turn about the pole in radians), or null. */
    bodyLabels: { count: number; focus: { shown: boolean; text: string; turn: number; look: string } | null };
    /** Starman and the Roadster at the last draw: whether the car was drawn (shown, its path in, the moment within 2018 to 2035), its place in Earth radii from the Earth's centre, and its radius on the screen in CSS pixels. */
    roadster: { shown: boolean; position: [number, number, number] | null; radiusPx: number };
    /** The deep-space craft at the last draw: how many dots, each id's status (`drawn` or `outside` the record), and the ids drawn. */
    spacecraft: { count: number; status: Record<string, "drawn" | "outside">; drawn: string[] };
    /** How large the squeezed view drew the moons of the system in the middle: the factor asked for, the one used, and whether a limit cut it. At true distances `factor` is 1. */
    moonSize: { asked: number; factor: number; clamped: boolean };
    /** The orbiters at the last draw: how many dots were drawn (their body big enough on the screen), each drawn craft's status (`tracked`, `predicted`, `modelled`); `dim` lists the craft drawn dim (`orbiterDim` from `/orbiters`); `lines` how many orbit lines and `track` how many points of ground track were drawn. */
    orbiters: { count: number; status: Record<string, "tracked" | "predicted" | "modelled" | "none">; dim: string[]; lines: number; track: number };
    /** The body the last arrival kept in the picture beside the one gone to, or null. */
    companion: string | null;
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
      camera: { position: [...this.#model.camera.position], fov: this.#model.camera.fov, up: [...this.#model.camera.up], forward: [...this.#model.camera.forward] },
      bodies: { look: this.#model.look, painted: this.#model.painted.bodies, moons: this.#model.painted.moons, held: this.#model.painted.held },
      tiles: { ...this.#model.tiles },
      door: { points: this.#model.door.points, belts: this.#model.door.belts, draws: this.#model.door.draws, sources: this.#door.book.stats() },
      allMoons: { on: this.#allMoons, loaded: this.#model.allMoons !== null, dots: this.#model.moonDots },
      ride: { riding: this.#model.ride !== null, lost: this.#model.rideLost, gliding: this.#model.transition !== null },
      travelling: this.#model.travelling === null ? null : { ...this.#model.travelling },
      region: this.#model.region === null ? null : { id: this.#model.region, name: this.#regionName(this.#model.region), reach: this.#model.regionDrawn?.reach ?? 0, distance: this.#model.regionDrawn?.distance ?? 0 },
      orbits: { drawn: [...this.#model.rings.drawn], miss: { ...this.#model.rings.miss }, hidden: [...this.#model.rings.hidden] },
      arrows: Object.fromEntries(Object.entries(this.#model.arrows).map(([id, list]) => [id, list.map((a) => ({ position: [...a.position] as [number, number, number], direction: [...a.direction] as [number, number, number] }))])),
      arrowPx: this.#model.arrowPx,
      help: this.#model.helpDrawn ? { body: this.#model.helpDrawn.body, axis: [...this.#model.helpDrawn.axis], pole: [...this.#model.helpDrawn.pole], retrograde: this.#model.helpDrawn.retrograde, arcTurn: [...this.#model.helpDrawn.arcTurn] } : null,
      bodyLabels: { count: this.#model.labelsDrawn.count, focus: this.#model.labelsDrawn.focus === null ? null : { ...this.#model.labelsDrawn.focus } },
      orbiters: { count: this.#model.orbitersDrawn.count, status: { ...this.#model.orbitersDrawn.status }, dim: [...this.#model.orbitersDrawn.dim], lines: this.#model.orbitersDrawn.lines, track: this.#model.orbitersDrawn.track },
      roadster: { shown: this.#model.roadsterDrawn.shown, position: this.#model.roadsterDrawn.position === null ? null : [...this.#model.roadsterDrawn.position], radiusPx: this.#model.roadsterDrawn.radiusPx },
      spacecraft: { count: this.#model.craftDrawn.count, status: { ...this.#model.craftDrawn.status }, drawn: [...this.#model.craftDrawn.drawn] },
      companion: this.#model.companion,
      moonSize: { asked: this.#model.moonSize, factor: this.#model.moonDrawn.factor, clamped: this.#model.moonDrawn.clamped },
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
    const lang = this.getAttribute("lang") === "ja" ? "ja" : "en";
    if (id === "roadster") return this.#names[id] ?? this.#model.roadsterPath?.name[lang] ?? "Starman";
    if (this.#model.craftIds.includes(id)) return this.#names[id] ?? this.#model.craftNames?.(id, lang) ?? id;
    if (this.#model.orbiterSet !== null && this.#model.orbiterSet.ids.includes(id)) return this.#names[id] ?? this.#model.orbiterSet.name(id)[lang];
    return this.#names[id] ?? BODIES[id as BodyId].name[lang];
  }

  #placeLabels(places: Record<string, BodyPlace | null>): void {
    this.#places = places;
    const box = this.#labelBox;
    if (!box) return;
    const wanted: LabelBox[] = [];
    const spots = new Map<string, { x: number; y: number; small: boolean; carried: boolean; flipped: boolean }>();
    const frame = { width: box.clientWidth, height: box.clientHeight };
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
      const width = this.#widthOf(label);
      // beside the dot, on the side that stays inside the view
      const { x, y, flipped } = nameSpot(at, { width, height: 16 }, frame);
      // a body that carries its drawn name gives its floating name up (it fades, and leaves its place to the others) unless the page keeps both; a body behind another gives it up for the arrow
      const carried = at.named === true && !this.#labelsAlways;
      const covered = at.behind !== undefined && this.#covered === "arrow";
      if (covered) continue;
      spots.set(id, { x, y, small: at.r < RING_BELOW_PX, carried, flipped });
      if (!carried) wanted.push({ id, x, y, width, height: 16, rank: this.#rank(id), size: at.r });
    }
    // no two names overlap: a moon gives way to its planet and a planet to the Sun
    const shown = chooseLabels(wanted);
    for (const id of this.#model.craftIds) if (spots.has(id)) shown.add(id);
    const companion = this.#model.companion;
    if (companion !== null && spots.has(companion)) shown.add(companion);
    this.#nameBoxes = wanted.filter((one) => shown.has(one.id));
    for (const id of ids) {
      const label = this.#pool.get(id);
      const ring = this.#rings.get(id);
      if (!label || !ring) continue;
      const spot = spots.get(id);
      if (!spot || (!spot.carried && !shown.has(id))) {
        if (!label.hidden) label.hidden = true;
        if (!ring.hidden) ring.hidden = true;
        // a hidden name forgets its fade, so that when it comes back it fades in rather than popping
        if (label.hasAttribute("data-carried")) {
          label.removeAttribute("data-carried");
          ring.removeAttribute("data-carried");
          label.setAttribute("aria-hidden", "false");
          label.tabIndex = 0;
        }
        continue;
      }
      if (label.hidden) label.hidden = false;
      if (label.hasAttribute("data-carried") !== spot.carried) {
        label.toggleAttribute("data-carried", spot.carried);
        ring.toggleAttribute("data-carried", spot.carried);
        label.setAttribute("aria-hidden", String(spot.carried));
        label.tabIndex = spot.carried ? -1 : 0;
      }
      if (label.hasAttribute("data-flip") !== spot.flipped) label.toggleAttribute("data-flip", spot.flipped);
      label.style.transform = `translate(${spot.x}px,${spot.y}px)`;
      // a body too small to see is marked: a ring round the place it is, as well as its name
      if (ring.hidden === spot.small) ring.hidden = !spot.small;
      if (spot.small) ring.style.transform = `translate(${Math.round(places[id]!.x)}px,${Math.round(places[id]!.y)}px)`;
    }
    this.#placeArrows(places);
    this.#markFar();
  }

  // --- far names, and the system under the pointer ---------------------------------------------------------------------------------------------------
  #hovered: BodyId | null = null;
  #hoverBy: "pointer" | "focus" = "pointer";
  #nameBoxes: LabelBox[] = [];

  /** The bodies drawn at full strength: the system of the body under the pointer, or else the one in the middle of the view. */
  #lit(): Set<string> {
    // the Sun in the middle lights the Sun and the eight planets; a body pointed at, the Sun too, lights its own system
    if (this.#hovered === null && this.#model.focus === "sun") return new Set<string>(["sun", ...BODY_IDS.filter((id) => BODIES[id].kind === "planet")]);
    const { host, moons } = systemOf(this.#hovered ?? this.#model.focus);
    return new Set<string>([host, ...moons]);
  }

  /** Mark the names, rings and arrows of the bodies outside the lit system: they are drawn at the far strength. Only what changed is touched, and nothing is drawn again. */
  #markFar(): void {
    const lit = this.#lit();
    const mark = (el: HTMLElement, id: string | undefined): void => {
      const far = id !== undefined && !lit.has(id);
      if (el.hasAttribute("data-far") !== far) el.toggleAttribute("data-far", far);
    };
    for (const [id, label] of this.#pool) mark(label, id);
    for (const [id, ring] of this.#rings) mark(ring, id);
    for (const arrow of this.#arrows.values()) mark(arrow, arrow.dataset["body"]);
  }

  /** A body comes under the pointer, a finger or the keyboard's focus (`wakusei-body-hover`, with its system), or none does (`wakusei-body-hover-end`). */
  #hover(id: BodyId | null, by: "pointer" | "focus"): void {
    if (id === this.#hovered) {
      if (id !== null) this.#hoverBy = by;
      return;
    }
    const was = this.#hovered;
    this.#hovered = id;
    this.#hoverBy = by;
    this.#markFar();
    if (id !== null && ((id as string) === "roadster" || this.#model.craftIds.includes(id))) this.dispatchEvent(new CustomEvent("wakusei-body-hover", { detail: { id, name: this.#nameOf(id), kind: "spacecraft" }, bubbles: true, composed: true }));
    else if (id !== null) this.dispatchEvent(new CustomEvent("wakusei-body-hover", { detail: { ...this.bodyInfo(id), system: systemOf(id) } satisfies BodyHover, bubbles: true, composed: true }));
    else if (was !== null) this.dispatchEvent(new CustomEvent("wakusei-body-hover-end", { detail: { id: was }, bubbles: true, composed: true }));
  }

  /** The body at a point of the element, in CSS pixels: on its disc (at least 14 pixels round its place) or on its name. */
  #bodyAt(x: number, y: number): BodyId | null {
    if (!this.#places || !this.#model.labels) return null;
    let best: BodyId | null = null;
    let bestD = Infinity;
    for (const [id, at] of Object.entries(this.#places)) {
      if (!at) continue;
      const d = Math.hypot(x - at.x, y - at.y);
      if (d <= Math.max(at.r, 14) && d < bestD) {
        best = id as BodyId;
        bestD = d;
      }
    }
    if (best !== null) return best;
    for (const box of this.#nameBoxes) if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) return box.id as BodyId;
    return null;
  }

  #pointAt(event: PointerEvent): BodyId | null {
    const rect = this.getBoundingClientRect();
    return this.#bodyAt(event.clientX - rect.left, event.clientY - rect.top);
  }

  // a mouse or a pen that moves over the view with no button down; a drag that turns the view leaves the lit system as it is
  #move = (event: PointerEvent): void => {
    if (event.pointerType === "touch" || event.buttons !== 0) return;
    if (this.#hoverBy === "focus" && this.#hovered !== null) return;
    this.#hover(this.#pointAt(event), "pointer");
  };
  #leave = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" && this.#hoverBy === "pointer") this.#hover(null, "pointer");
  };
  #labelBlur = (event: FocusEvent): void => {
    const next = event.relatedTarget as HTMLElement | null;
    if (this.#hoverBy === "focus" && !(next && this.#labelBox?.contains(next))) this.#hover(null, "focus");
  };

  /** Where each body is for the picture: kept for `sight()`, and told to the page when it changes enough to matter. */
  #sight: Record<string, BodySight> = {};
  #told: Record<string, Sight> = {};
  #see(bodies: Record<string, SightInput>, frame: { width: number; height: number; axis: { x: number; y: number } }): void {
    const now: Record<string, BodySight> = {};
    for (const [id, input] of Object.entries(bodies)) {
      const body = id as BodyId;
      const craft = this.#model.craftIds.includes(id) || id === "roadster";
      const one: BodySight = { id, kind: craft ? "spacecraft" : bodyKindOf(body), ...sightOf(input, frame.width, frame.height, frame.axis) };
      const host = craft ? undefined : hostOf(body);
      if (host !== undefined) one.host = host;
      now[id] = one;
    }
    this.#sight = now;
    if (this.#sightTimer !== undefined || !sightChanged(this.#told, now)) return;
    // at most four times a second while the view moves; the last change is told when the wait is over
    const wait = this.#sightSent + SIGHT_EVENT_MS - performance.now();
    if (wait > 0) this.#sightTimer = setTimeout(this.#tellSight, wait);
    else this.#tellSight();
  }
  #sightSent = -Infinity;
  #sightTimer: ReturnType<typeof setTimeout> | undefined;
  #tellSight = (): void => {
    this.#sightTimer = undefined;
    if (!this.isConnected || !sightChanged(this.#told, this.#sight)) return;
    this.#told = this.#sight;
    this.#sightSent = performance.now();
    this.dispatchEvent(new CustomEvent("wakusei-sight", { detail: { bodies: Object.values(this.#sight).map((one) => ({ ...one })) } }));
  };

  /** The quiet arrows for the bodies behind others (`covered="arrow"`): one per covering disc, just outside its edge, named for the surest body behind and counting the rest. */
  #placeArrows(places: Record<string, BodyPlace | null>): void {
    const box = this.#labelBox;
    if (!box) return;
    const arrows = this.#covered === "arrow" && this.#model.labels ? coverArrows(places, (id) => this.#rank(id)) : [];
    const live = new Set<string>();
    for (const arrow of arrows) {
      live.add(arrow.cover);
      let el = this.#arrows.get(arrow.cover);
      if (!el) {
        const button = box.ownerDocument.createElement("button");
        button.type = "button";
        el = button;
        el.className = "sp-arrow";
        el.dataset["cover"] = arrow.cover;
        box.append(el);
        this.#arrows.set(arrow.cover, el);
      }
      const text = arrow.bodies.length > 1 ? `${this.#nameOf(arrow.lead)} +${arrow.bodies.length - 1}` : this.#nameOf(arrow.lead);
      if (el.dataset["body"] !== arrow.lead || el.textContent !== text) {
        el.dataset["body"] = arrow.lead;
        el.textContent = text;
        el.setAttribute("aria-label", `${arrow.bodies.map((id) => this.#nameOf(id)).join(", ")}: ${this.#nameOf(arrow.cover)} ${this.getAttribute("lang") === "ja" ? "の後ろ" : "is in front"}. ${this.#hint}`);
      }
      // the tip sits at the arrow's place and points into the disc; the name hangs off the far side, to the right of the tip for an arrow on the right half of the disc and to the left for one on the left
      const onLeft = Math.cos((arrow.angle * Math.PI) / 180) > 0;
      el.style.setProperty("--turn", `${Math.round(arrow.angle)}deg`);
      el.style.transform = `translate(${Math.round(arrow.x)}px,${Math.round(arrow.y - 8)}px)${onLeft ? " translateX(-100%)" : ""}`;
      if (el.hidden) el.hidden = false;
    }
    for (const [cover, el] of this.#arrows) if (!live.has(cover) && !el.hidden) el.hidden = true;
  }

  /** How sure a body's name is of its place: the body looked at first, then the Sun, the planets, the dwarf planets and minor bodies, and the moons. */
  #rank(id: string): number {
    if (id === this.#model.focus) return 0;
    if (id === "sun") return 1;
    if (id === "roadster" || this.#model.craftIds.includes(id)) return 3;
    if (this.#model.orbiterSet !== null && this.#model.orbiterSet.ids.includes(id)) return 5;
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
    if (event.pointerType === "touch") {
      // a finger lights the system it is on until it lifts
      this.#hover(this.#pointAt(event), "pointer");
      window.addEventListener("pointerup", this.#lift, { capture: true });
      window.addEventListener("pointercancel", this.#lift, { capture: true });
    }
    this.#downX = event.clientX;
    this.#downY = event.clientY;
    window.addEventListener("pointerup", this.#up, { capture: true, once: true });
  };
  #lift = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    window.removeEventListener("pointerup", this.#lift, true);
    window.removeEventListener("pointercancel", this.#lift, true);
    if (this.#hoverBy === "pointer") this.#hover(null, "pointer");
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
    const target = event.target as HTMLElement | null;
    const id = target?.dataset?.["body"] as BodyId | undefined;
    if (!id) return;
    // a press on a quiet arrow (a body behind another) goes to that body at once; a press on a name selects it first, as always
    if (target?.dataset?.["cover"] !== undefined) {
      if (canCentre(id)) this.goTo(id);
      else this.#press(id);
      return;
    }
    this.#press(id);
  };

  /**
   * A press on a body or its name. `wakusei-body-click` tells the page every time. The first press on a body selects it (`wakusei-body-select`, for the page's card); a second press on the body that is selected makes it
   * the middle of the view (`goTo`), unless it already is, so a press never sends the view anywhere else.
   */
  #press(id: BodyId): void {
    // the Roadster and the orbiters are no bodies of the package: a press on such a name says so and goes nowhere
    if ((id as string) === "roadster" || this.#model.craftIds.includes(id) || (this.#model.orbiterSet !== null && this.#model.orbiterSet.ids.includes(id))) {
      this.dispatchEvent(new CustomEvent("wakusei-body-click", { detail: { id, name: this.#nameOf(id), kind: "spacecraft" }, bubbles: true, composed: true }));
      return;
    }
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
    if (!id) return;
    // a craft's name is no body: focus tells the page its id and name, as a press does
    const craft = (id as string) === "roadster" || this.#model.craftIds.includes(id) || (this.#model.orbiterSet !== null && this.#model.orbiterSet.ids.includes(id));
    this.dispatchEvent(new CustomEvent("wakusei-body-focus", { detail: craft ? { id, name: this.#nameOf(id), kind: "spacecraft" } : this.bodyInfo(id), bubbles: true, composed: true }));
    this.#hover(id, "focus");
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
