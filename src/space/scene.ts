// The space view as a scene for kazoku-ui's shared renderer: the Earth, the Moon, the Sun and the planets in their places, each drawn by the painter (`scene/painter.ts`) and lit by the
// Sun, so the Moon's phase and the Earth's day side come out of the light, not out of a table. Draws only when asked; holds no clock.
import type * as THREE from "three";
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import { BODIES, MOONS_OF, type BodyId, type MoonId } from "../facts.ts";
import type { ThreeParts } from "../scene/body.ts";
import type { SourceBook } from "../door/book.ts";
import { createSmallBodyPoints, type PointsThree } from "../door/points.ts";
import { toTerrestrialTime } from "../clock.ts";
import { moonOffset, orientation } from "../scene/orient.ts";
import { type PaintLabel, type Painting, type WakuseiPainter } from "../scene/painter.ts";
import "../bodies/all.ts";
import type { Vec3 } from "../vec.ts";
import { groundDirection } from "./aim.ts";
import { hostOf } from "./bodies.ts";
import { arrowSites, ARROWS_PER_ORBIT, chevron, MAX_ARROWS_PER_ORBIT, spinArrow, type OrbitArrow } from "./arrows.ts";
import { besideMoon, type BesideInput } from "./beside.ts";
import { coveredBy, type CoverEntry } from "./covered.ts";
import { spinAxis } from "./spin.ts";
import { createTrack, eclipticToScene, frameAt, moonOrbit, planetOrbit, SPACE_DWARFS, SPACE_MINORS, SPACE_PLANETS, type SpaceDwarf, type SpaceFrame, type SpaceMinor, type SpacePlanet, type SpaceVec3 } from "./frame.ts";
import { BALL_FRAGMENT, VERTEX } from "../scene/glsl.ts";
import { ridePose, type RideLook } from "./ride.ts";
import { moonDistance, orbitLine, placeAround, placeBodies, placeMoon, radiusIn, type ScaleMode } from "./scale.ts";
import { regionOrbits, regionView, type SunRegion } from "./regions.ts";
import { travelPlan, travelPose, type TravelBody, type TravelInput, type TravelKind, type TravelPlan } from "./travel.ts";


/** The parts of three.js the space view uses: the bodies' and a perspective camera. */
export type SpaceThree = ThreeParts & Pick<typeof THREE, "PerspectiveCamera">;

const RAD = Math.PI / 180;
/** The camera's distance, in radii of the body it looks at, at which that body fills the view at zoom 1. */
export const FIT_DISTANCE = 4.1;
const FOV = 35;
const ORBIT_POINTS = 96;
const ORBIT_BODIES = ["earth", ...SPACE_PLANETS, ...SPACE_DWARFS, ...SPACE_MINORS, "moon"] as const;
/** A dwarf planet or a minor body is drawn once it is this many CSS pixels across its radius, or when it is the body looked at: Sedna at true scale is never anything but a speck, and its picture is not made for it. */
const DWARF_MIN_PX = 0.4;
/** A colour as three numbers from 0 to 1, from `#rrggbb`. */
const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
/** How long each arrowhead on an orbit line is, in CSS pixels: small, so it reads at every zoom and never hides a body. */
const ARROW_PX = 9;
/** A body whose disc is this many CSS pixels across its radius is "close": the orbit lines that are not its own are hidden. */
const CLOSE_UP_PX = 30;
/** How long the Moon's ring is kept before it is worked out again from the Moon's place, in milliseconds: its path changes by a couple of hundred kilometres in that time. */
const MOON_RING_KEEP_MS = 5 * 86_400_000;
type OrbitBody = (typeof ORBIT_BODIES)[number];
/** How many radii across the picture of a body is at zoom 1 when it has more than its globe: Saturn's rings (to 2.27 radii) are inside the view, not cut by it. */
const FRAMED: Partial<Record<SpaceBody, number>> = { saturn: 2.3 };
/** The moons of a planet are shown once the planet is this many CSS pixels across its radius, and each is drawn at least this many pixels across its radius. */
const MOON_MIN_PLANET_PX = 4;
const MOON_MIN_PX = 2.2;
/** ...or a planet's moons are shown when the planet is smaller than that but its farthest moon is this many CSS pixels from it. */
const MOON_MIN_SYSTEM_PX = 30;
/** A moon that has been out of sight this long is let go (its pictures too). */
const MOON_KEEP_MS = 4000;
/** An orbiter is drawn as a dot this many CSS pixels across its radius, once its body is at least `ORBITER_HOST_PX` across its radius on the screen (nearer, the dots would all sit on the body's own dot). */
const ORBITER_PX = 2.2;
const ORBITER_HOST_PX = 24;
/** An orbiter's orbit line is worked out again when the moment has moved this far from the line's epoch (the node and periapsis drift a little a day). */
const ORBITER_LINE_KEEP_MS = 86_400_000;
/** The Roadster is drawn as a dot this many CSS pixels across its radius: a car is nothing at any scale of the view. */
const ROADSTER_PX = 3;
/** The Roadster's orbit line spans this long round the moment shown (about one trip round the Sun), and is worked out again when the moment has moved this far from the line's middle. */
const ROADSTER_ORBIT_MS = 560 * 86_400_000;
const ROADSTER_ORBIT_KEEP_MS = 30 * 86_400_000;

/**
 * The twenty-four bodies the space view places, names and lets a reader choose: the Earth, the Sun, the Moon, the seven other planets, Pluto, the eight other dwarf planets and the five minor bodies (Vesta, Pallas, Chiron, Pholus and Halley). The moons of the planets and of the dwarf planets are placed round their hosts.
 *
 * @example
 * ```ts no-run
 * import { SPACE_BODIES } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * console.log(SPACE_BODIES.join(", "));
 * ```
 */
export const SPACE_BODIES = ["earth", "sun", "moon", ...SPACE_PLANETS, ...SPACE_DWARFS, ...SPACE_MINORS] as const;

/**
 * One of the bodies in `SPACE_BODIES`, by the package's usual lower-case name.
 *
 * @example
 * ```ts no-run
 * import { SPACE_BODIES, type SpaceBody } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const mars: SpaceBody = "mars";
 * console.log(SPACE_BODIES.includes(mars));
 * ```
 */
export type SpaceBody = (typeof SPACE_BODIES)[number];

/**
 * How the bodies are lit: `sun` is the true light; `lit` is daylight from the camera's side on every body, so a view of a night side is never black.
 *
 * @example
 * ```ts no-run
 * import type { SpaceLight } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const light: SpaceLight = "lit";
 * console.log(light);
 * ```
 */
export type SpaceLight = "sun" | "lit";

/**
 * Any moving point a camera can ride: where it is and which way it goes at a moment, from the centre of the body it goes round, in kilometres and kilometres a second, in the scene's axes (J2000
 * equatorial, y north). It returns `null` when it cannot be placed then (its data too old, or it is gone). The space view knows nothing of what the point is: a satellite, a probe, a station.
 *
 * @example
 * ```ts no-run
 * import type { RidePoint } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const circle: RidePoint = { at: (ms) => ({ position: [7000 * Math.cos(ms / 1e6), 0, 7000 * Math.sin(ms / 1e6)], velocity: [0, 7.5, 0] }) };
 * console.log(circle.at(0)?.position[0]);
 * ```
 */
export interface RidePoint {
  at(ms: number): { position: SpaceVec3; velocity: SpaceVec3 } | null;
}

/**
 * What a camera can ride along with: a body of the view (`moon`, `mars`, ... going round the Earth), a moon of a planet in the view (`io`, going round Jupiter), or any moving point of your own.
 *
 * @example
 * ```ts no-run
 * import type { RideTarget } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const targets: RideTarget[] = ["moon", "io", { at: () => null }];
 * console.log(targets.length);
 * ```
 */
export type RideTarget = SpaceBody | MoonId | RidePoint;

/** What the scene rides: the target, the body it goes round, and how. */
export interface RideState {
  target: RideTarget;
  /** The body the target goes round: the Earth for a body of the view or a point (unless said), the planet for a moon. */
  around: SpaceBody;
  /** `from`: the camera is at the target, looking at the body it goes round. `follow`: the camera keeps a distance from it, looking at it. */
  view: "from" | "follow" | "beside";
  look: RideLook;
  /** For `follow` a point: how far the camera keeps, in kilometres. */
  distanceKm: number;
}

/** The camera as the last draw left it, for the next one to start from when the ride changes. */
export interface CameraPose {
  p: SpaceVec3;
  q: [number, number, number, number];
  fov: number;
  valid: boolean;
}

/** The Roadster's path as the view needs it: from `/roadster`, loaded only when the Roadster is shown. */
export interface RoadsterPath {
  /** Where the car is at a moment, in au from the Sun, ecliptic J2000 axes. */
  positionAu(ms: number): Vec3;
  /** The span the path covers, in milliseconds since 1970. */
  record: { start: number; end: number };
  /** The car's name, in English and Japanese. */
  name: { en: string; ja: string };
}

/** The orbiters as the view needs them: from `/orbiters`, loaded only when they are shown. */
export interface OrbiterSet {
  ids: readonly string[];
  centre(id: string): "moon" | "mars";
  /** Kilometres from the body's centre, ecliptic J2000; `null` for a craft with no path. */
  position(id: string, ms: number): Vec3 | null;
  path(id: string, ms: number, points: number): Vec3[];
  status(id: string, ms: number): "tracked" | "predicted" | "modelled" | "none";
  /** Whether the craft is drawn dim at a moment: a modelled path, or a predicted one that misses Horizons by more than a small share of its body's radius. */
  dim(id: string, ms: number): boolean;
  name(id: string): { en: string; ja: string };
}

export interface SpaceModel {
  /** Moment shown, milliseconds since the epoch. */
  time: number;
  mode: ScaleMode;
  /** The shared controls' yaw, tilt and zoom. */
  view: { yaw: number; tilt: number; zoom: number; roll: number; panX: number; panY: number };
  /** The home place: the camera starts above it. */
  centre: { lon: number; lat: number };
  /** The moment the camera was last pointed at the ground: it is fixed to the stars, not to the ground. */
  anchor: number | null;
  orbits: boolean;
  labels: boolean;
  /** Milliseconds of game time one second of wall time covers (the ephemeris is looked up once per such span). */
  stepMs: number;
  /** Game seconds for each second of wall time, with its sign (0 when the clock holds): the places a move is worked out for are those the clock reaches by its end. */
  speed: number;
  /** The body the camera looks at, and (in `zoom`) fills the view with at 1x: any body the package knows that the view can place (the eleven of `SPACE_BODIES` and the moons of the planets). */
  focus: BodyId;
  light: SpaceLight;
  /** How the painter draws the bodies (`realistic` or `painted`). */
  look: string;
  /** Filled at each draw. */
  drawn: { frame: SpaceFrame; distance: number; radiusPx: number } | null;
  /** What the painter has made now: the bodies drawn, and the moons shown. */
  painted: { bodies: number; moons: number; held: number };
  /** What the windows of finer map tiles on the bodies are doing, summed at the last draw: tile fetches made, tiles being fetched, tiles or windows that failed, and the finest level on a body now (`null` for none). */
  tiles: { requested: number; loading: number; failed: number; shown: number | null };
  /** The orbit lines drawn at the last draw, and how far each body is from its own line as a fraction of the line's radius (0 when it is on it). */
  rings: { drawn: string[]; miss: Record<string, number>; hidden: string[] };
  /** The arrowheads on the orbit lines at the last draw, by line: where each is and the way it points. */
  arrows: Record<string, OrbitArrow[]>;
  /** Help mode: draw, on the body looked at, the axis it turns about and a curved arrow showing which way it turns. */
  help: boolean;
  /** Help mode draws its lines whole over the globe (`true`); by default they have depth against the body they are on, so the axis shows only outside the globe and the part of the arrow behind it is hidden. */
  helpThrough: boolean;
  /** How many arrowheads each orbit line carries: 0 to `MAX_ARROWS_PER_ORBIT`, two by default. */
  arrowCount: number;
  /** Show the spacecraft in orbit round the Moon and Mars: a dot each on its orbit line, named, once its body is big enough on the screen. Off by default; their paths are loaded when first shown. */
  orbiters: boolean;
  orbiterSet: OrbiterSet | null;
  /** The orbiters at the last draw: how many were drawn, each drawn one's status, and which were drawn dim. */
  orbitersDrawn: { count: number; status: Record<string, "tracked" | "predicted" | "modelled" | "none">; dim: string[] };
  /** Show Starman and the Roadster: a small marked body on its orbit line, named. Off by default; its path is loaded when it is first shown. */
  roadster: boolean;
  roadsterPath: RoadsterPath | null;
  /** What the Roadster drew at the last draw: whether it was drawn (shown, its path in, and the moment within the record), its place in Earth radii from the Earth's centre, and its radius on the screen. */
  roadsterDrawn: { shown: boolean; position: [number, number, number] | null; radiusPx: number };
  /** The name written on each body's globe, or null for none; `labelVersion` goes up whenever it (or the language) changes, so each body is told once. */
  label: PaintLabel | null;
  labelVersion: number;
  /** The names on the globes at the last draw: how many are drawn (made, their font in, and big enough on the screen), and the one on the body looked at, or null. */
  labelsDrawn: { count: number; focus: { shown: boolean; text: string; turn: number } | null };
  /** How long an arrowhead drawn at the last draw is on the screen, in CSS pixels (measured from its own points), or 0 when none was drawn. */
  arrowPx: number;
  /** What the help arrow drew at the last draw, or null: the body, the axis it spins about (right-hand rule), the north pole, and the axis the drawn arc itself turns about (measured from its points). */
  helpDrawn: { body: BodyId; axis: Vec3; pole: Vec3; retrograde: boolean; arcTurn: Vec3 } | null;
  /** The data door at the last draw: how many small bodies are in the one instanced draw, and how many tiles or marks each source gave (by id): the credits. */
  door: { points: number; used: Record<string, number> };
  /** How many frames the ephemeris has worked out. */
  lookups: number;
  /** Pixels a game-second moves things on the screen (the fastest turning body in sight): the draw rate follows it. */
  motion: number;
  /** The shared controls' view as the last draw used it, and how tall the view was (CSS pixels). */
  drawnView: { yaw: number; tilt: number; zoom: number; roll: number; panX: number; panY: number } | null;
  heightPx: number;
  camera: {
    position: [number, number, number];
    fov: number;
    /** The picture's up in the scene's axes (y is the Earth's north): beside a moon it is the planet's own pole laid across the line of sight. */
    up: [number, number, number];
    /** Which way the camera looks, a unit vector in the scene's axes. */
    forward: [number, number, number];
  };
  /** The body or point the camera rides along with, or null. */
  ride: RideState | null;
  /** Set at each draw: the target of the ride could not be placed, so the ordinary camera was used. */
  rideLost: boolean;
  /** A camera move in progress from where the last draw left the camera to the view set up for the new target: see `SpaceTransition`. */
  transition: SpaceTransition | null;
  /** What the move is doing at this draw, or null when the camera is still: the kind and path of the move, its stage, how far along it is (0 to 1), its length, and whether the body left and the one gone to are in the picture. */
  travelling: { kind: Exclude<TravelKind, "auto">; path: TravelPlan["path"]; stage: "turn" | "travel" | "arrive"; progress: number; duration: number; leaving: boolean; destination: boolean } | null;
  /** The stage out from the Sun the view is framed on (`SUN_REGIONS`), or null for an ordinary view of the body looked at. */
  region: SunRegion | null;
  /** The region as the last draw framed it: how far out it reaches from the Sun and how far the camera stood back, in Earth radii. */
  regionDrawn: { id: SunRegion; reach: number; distance: number } | null;
  pose: CameraPose;
  /** Pixels a game-second that riding makes things move on the screen (0 when not riding): the draw rate follows it. */
  rideMotion: number;
  ratio(): number;
}

/**
 * A camera move from one view to the next, as the element asks for it: when it began (ms of the page's clock), the length a page asked for (0 to take the plan's own), the pace, the kind of move, where the
 * last draw left the camera, and the body being left and the one gone to (for the path to keep in the picture; null when unknown). The scene builds the path at the move's first draw (`input`, `plan`), from
 * that camera to the view it has just set up for the new target, and then draws `travelPose` of it until the move is over.
 *
 * @example
 * ```ts no-run
 * import type { SpaceTransition } from "@johnmorrisdotca/wakusei-planets/space/scene";
 *
 * const describe = (move: SpaceTransition): string => `${move.kind} from ${move.leaving ?? "?"} to ${move.destination ?? "?"}`;
 * console.log(typeof describe);
 * ```
 */
export interface SpaceTransition {
  start: number;
  duration: number;
  pace: number;
  kind: TravelKind;
  from: { p: SpaceVec3; q: [number, number, number, number]; fov: number };
  leaving: BodyId | null;
  destination: BodyId | null;
  /** How far the region being left reached from the Sun, when the move leaves a stage out from the Sun (a straight push in or pull back then). */
  leavingReach: number;
  input: TravelInput | null;
  plan: TravelPlan | null;
  /** The scene's origin (the place of the body looked at) when the path was worked out: the path is in places relative to it. */
  origin: Vec3;
}

export const newSpaceModel = (): SpaceModel => ({
  time: Date.now(),
  mode: "true",
  view: { yaw: 0, tilt: 0, zoom: 1, roll: 0, panX: 0, panY: 0 },
  centre: { lon: 0, lat: 0 },
  anchor: null,
  orbits: true,
  labels: true,
  stepMs: 1000,
  speed: 1,
  focus: "earth",
  light: "sun",
  look: "realistic",
  drawn: null,
  painted: { bodies: 0, moons: 0, held: 0 },
  tiles: { requested: 0, loading: 0, failed: 0, shown: null },
  rings: { drawn: [], miss: {}, hidden: [] },
  arrows: {},
  help: false,
  helpThrough: false,
  arrowPx: 0,
  arrowCount: ARROWS_PER_ORBIT,
  orbiters: false,
  orbiterSet: null,
  orbitersDrawn: { count: 0, status: {}, dim: [] },
  roadster: false,
  roadsterPath: null,
  roadsterDrawn: { shown: false, position: null, radiusPx: 0 },
  label: null,
  labelVersion: 0,
  labelsDrawn: { count: 0, focus: null },
  helpDrawn: null,
  door: { points: 0, used: {} },
  lookups: 0,
  motion: 0,
  drawnView: null,
  heightPx: 420,
  camera: { position: [0, 0, 0], fov: FOV, up: [0, 1, 0], forward: [0, 0, -1] },
  ride: null,
  rideLost: false,
  transition: null,
  travelling: null,
  region: null,
  regionDrawn: null,
  pose: { p: [0, 0, 0], q: [0, 0, 0, 1], fov: FOV, valid: false },
  rideMotion: 0,
  ratio: () => Math.min(globalThis.devicePixelRatio || 1, 2),
});

/**
 * Where a body is on the screen: its centre and its apparent radius, in CSS pixels in the box.
 *
 * @example
 * ```ts no-run
 * import type { BodyPlace } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const centre: BodyPlace = { x: 320, y: 200, r: 48 };
 * console.log(centre.r);
 * ```
 */
export interface BodyPlace {
  x: number;
  y: number;
  r: number;
  /** True while the body's name is drawn on its globe (`body-label` on, and the body big enough): the floating name beside it gives way. */
  named?: boolean;
  /** The id of the nearer body whose disc covers this body's place on the screen, when one does. */
  behind?: string;
}

export interface SpaceDeps {
  painter: () => WakuseiPainter;
  /** The view's sources (the data door): small bodies are drawn as points from it. Left out, none are. */
  book?: SourceBook;
  cap: () => number;
  invalidate: () => void;
  /** Bring the model's time up to the page's clock; called at the start of each draw, so a picture drawn late shows the moment it is drawn at and not the one of the last tick. */
  advance?: () => void;
  /** Where each body is on the screen, in CSS pixels in the box, or null when it is behind the camera. Called at each draw. */
  onLabels?: (places: Record<string, BodyPlace | null>) => void;
  /** Called at the end of a draw while the camera is moving from one ride to another, so the next frame is asked for (at the page's frame cap). */
  onMoving?: () => void;
  /** The target of the ride could not be placed at this draw. */
  onRideLost?: () => void;
  /** The painter could not make a body (the three.js parts handed over lack something it needs). */
  onPainterError?: (error: unknown) => void;
}

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** How far a place is from the nearest point of a line through `points`, in the line's units. */
const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function distanceToLine(place: Vec3, points: readonly Vec3[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const ab = minus(b, a);
    const am = minus(place, a);
    const len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (am[0] * ab[0] + am[1] * ab[1] + am[2] * ab[2]) / len2));
    best = Math.min(best, Math.hypot(place[0] - (a[0] + ab[0] * t), place[1] - (a[1] + ab[1] * t), place[2] - (a[2] + ab[2] * t)));
  }
  return best;
}

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

export function createSpaceItem(model: SpaceModel, deps: SpaceDeps): Item3D<ThreeParts> {
  return {
    key: "wakusei-planets:space",
    build({ three: parts, width, height }: BuildContext<ThreeParts>): Scene3D {
      const three = parts as SpaceThree;
      let size = { width, height };
      const track = createTrack(model.stepMs);
      let trackStep = model.stepMs;
      const scene = new three.Scene();
      // the small bodies of the record sources, in one instanced draw (a page's own subset of three needs the two instanced classes for it)
      const points = deps.book !== undefined && typeof (three as Partial<PointsThree>).InstancedBufferGeometry === "function" ? createSmallBodyPoints(three as unknown as PointsThree) : undefined;
      if (points !== undefined) scene.add(points.object);
      let pointsVersion = -1;
      const camera = new three.PerspectiveCamera(FOV, width / Math.max(1, height), 0.05, 1000);
      const target = new three.Vector3();
      const projected = new three.Vector3();
      const fromQ = camera.quaternion.clone();
      const scratchA = new three.Vector3();
      const scratchB = new three.Vector3();
      // the orbit lines of a stage out from the Sun, kept while the stage, the scale and the day are the same
      let regionLines: { id: SunRegion; mode: ScaleMode; epoch: number; lines: Vec3[][] } | null = null;

      let ended = false;
      interface Slot {
        drawing: Painting | undefined;
        look: string | null;
        failed: boolean;
        /** The `model.labelVersion` the drawing was last told of. */
        labelled: number;
      }
      const slots = new Map<string, Slot>();
      const empty = (slot: Slot): void => {
        if (!slot.drawing) return;
        scene.remove(slot.drawing.object);
        slot.drawing.dispose();
        slot.drawing = undefined;
      };
      const fill = (id: string, slot: Slot): void => {
        if (slot.look === model.look || slot.failed) return;
        empty(slot);
        slot.look = model.look;
        try {
          const made = deps.painter().make(three, id, { look: model.look, mapped: true, invalidate: () => deps.invalidate(), ratio: model.ratio(), maxTexture: deps.cap(), label: model.label });
          if (ended) {
            made.dispose();
            return;
          }
          slot.drawing = made;
          slot.labelled = model.labelVersion;
          scene.add(made.object);
        } catch (error) {
          slot.failed = true;
          deps.onPainterError?.(error);
        }
      };
      const slotOf = (id: string): Slot => {
        let slot = slots.get(id);
        if (!slot) slots.set(id, (slot = { drawing: undefined, look: null, failed: false, labelled: -1 }));
        return slot;
      };
      /** A body whose name setting changed since it was made is told the new one (once). */
      const relabel = (slot: Slot): void => {
        if (slot.drawing === undefined || slot.labelled === model.labelVersion) return;
        slot.labelled = model.labelVersion;
        slot.drawing.setLabel(model.label);
      };

      // each line has its colour and a fade (the fourth number of the colour) at every point, so that near the body looked at the part of a line that would cross it is let go
      const orbits = new Map<OrbitBody, { line: THREE.Line; positions: Float32Array; colours: Float32Array; faded: boolean; samples: Vec3[]; epoch: number }>();
      for (const id of ORBIT_BODIES) {
        const positions = new Float32Array((ORBIT_POINTS + 1) * 3);
        const colours = new Float32Array((ORBIT_POINTS + 1) * 4);
        const base = rgb(id === "earth" ? "#6aa8ff" : id === "moon" ? "#c5cdd9" : BODIES[id].colour);
        for (let i = 0; i <= ORBIT_POINTS; i += 1) colours.set([base[0], base[1], base[2], 1], i * 4);
        const geometry = new three.BufferGeometry();
        geometry.setAttribute("position", new three.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new three.BufferAttribute(colours, 4));
        const line = new three.Line(geometry, new three.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 }));
        line.frustumCulled = false;
        scene.add(line);
        orbits.set(id, { line, positions, colours, faded: false, samples: [], epoch: Number.NaN });
      }
      // the arrowheads of every orbit line: two strokes each, in the colour of the line, in one object; and the help mode's axis and curved arrow in another (drawn over the body, not hidden by it)
      const ARROW_VERTICES = ORBIT_BODIES.length * MAX_ARROWS_PER_ORBIT * 4;
      const arrowPositions = new Float32Array(ARROW_VERTICES * 3);
      const arrowColours = new Float32Array(ARROW_VERTICES * 3);
      const arrowGeometry = new three.BufferGeometry();
      arrowGeometry.setAttribute("position", new three.BufferAttribute(arrowPositions, 3));
      arrowGeometry.setAttribute("color", new three.BufferAttribute(arrowColours, 3));
      const arrowLines = new three.LineSegments(arrowGeometry, new three.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));
      arrowLines.frustumCulled = false;
      scene.add(arrowLines);
      ORBIT_BODIES.forEach((id, k) => {
        const c = rgb(id === "earth" ? "#6aa8ff" : id === "moon" ? "#c5cdd9" : BODIES[id].colour);
        for (let v = 0; v < MAX_ARROWS_PER_ORBIT * 4; v += 1) arrowColours.set(c, (k * MAX_ARROWS_PER_ORBIT * 4 + v) * 3);
      });
      const HELP_SEGMENTS = 28;
      const HELP_VERTICES = (1 + HELP_SEGMENTS + 2) * 2;
      const helpPositions = new Float32Array(HELP_VERTICES * 3);
      const helpColours = new Float32Array(HELP_VERTICES * 3);
      const helpGeometry = new three.BufferGeometry();
      helpGeometry.setAttribute("position", new three.BufferAttribute(helpPositions, 3));
      helpGeometry.setAttribute("color", new three.BufferAttribute(helpColours, 3));
      const helpLines = new three.LineSegments(helpGeometry, new three.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthTest: false }));
      helpLines.frustumCulled = false;
      helpLines.renderOrder = 10;
      helpLines.visible = false;
      scene.add(helpLines);
      const AXIS_COLOUR = rgb("#9fd0ff");
      const SPIN_COLOUR = rgb("#ffd24a");
      for (let v = 0; v < HELP_VERTICES; v += 1) {
        const c = v < 2 ? AXIS_COLOUR : SPIN_COLOUR;
        helpColours.set(c, v * 3);
      }
      const moonSlots = new Map<string, { slot: Slot; seen: number }>();
      let releaseTimer: ReturnType<typeof setTimeout> | undefined;
      // Starman and the Roadster: a dot (a shaded ball, lit by the Sun) on its own orbit line, in the car's warm red; made once, shown only while the view asks for it
      const roadsterGeometry = new three.SphereGeometry(1, 24, 12);
      const roadsterMaterial = new three.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: BALL_FRAGMENT, uniforms: { uLight: { value: new three.Vector3(0, 0, 1) }, uColour: { value: new three.Vector3(0.93, 0.28, 0.2) } } });
      const roadsterMesh = new three.Mesh(roadsterGeometry, roadsterMaterial);
      roadsterMesh.visible = false;
      roadsterMesh.frustumCulled = false;
      scene.add(roadsterMesh);
      const roadsterPositions = new Float32Array((ORBIT_POINTS + 1) * 3);
      const roadsterLineGeometry = new three.BufferGeometry();
      roadsterLineGeometry.setAttribute("position", new three.BufferAttribute(roadsterPositions, 3));
      const roadsterLine = new three.Line(roadsterLineGeometry, new three.LineBasicMaterial({ color: 0xe8705a, transparent: true, opacity: 0.55 }));
      roadsterLine.visible = false;
      roadsterLine.frustumCulled = false;
      scene.add(roadsterLine);
      const roadsterOrbit = { samples: [] as Vec3[], epoch: Number.NaN };
      // the orbiters: a dot and a line each, made the first time the craft is drawn, kept for the view's life
      interface OrbiterDrawing {
        mesh: THREE.Mesh;
        material: THREE.ShaderMaterial;
        line: THREE.Line;
        lineMaterial: THREE.LineBasicMaterial;
        positions: Float32Array;
        epoch: number;
      }
      const orbiterDrawings = new Map<string, OrbiterDrawing>();
      const orbiterGeometry = new three.SphereGeometry(1, 16, 8);
      const orbiterDrawing = (id: string): OrbiterDrawing => {
        let drawing = orbiterDrawings.get(id);
        if (drawing !== undefined) return drawing;
        const material = new three.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: BALL_FRAGMENT, uniforms: { uLight: { value: new three.Vector3(0, 0, 1) }, uColour: { value: new three.Vector3(0.75, 0.9, 1) } } });
        const mesh = new three.Mesh(orbiterGeometry, material);
        mesh.frustumCulled = false;
        scene.add(mesh);
        const positions = new Float32Array((ORBIT_POINTS + 1) * 3);
        const geometry = new three.BufferGeometry();
        geometry.setAttribute("position", new three.BufferAttribute(positions, 3));
        const lineMaterial = new three.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.45 });
        const line = new three.Line(geometry, lineMaterial);
        line.frustumCulled = false;
        scene.add(line);
        drawing = { mesh, material, line, lineMaterial, positions, epoch: Number.NaN };
        orbiterDrawings.set(id, drawing);
        return drawing;
      };

      const labelFor = (v: Vec3): { x: number; y: number } | null => {
        projected.set(v[0], v[1], v[2]).project(camera);
        if (projected.z > 1 || projected.z < -1) return null;
        return { x: ((projected.x + 1) / 2) * size.width, y: ((1 - projected.y) / 2) * size.height };
      };

      return {
        scene,
        camera,
        update() {
          deps.advance?.();
          const frame = track.at(model.time);
          model.lookups = track.lookups;
          if (model.stepMs !== trackStep) {
            trackStep = model.stepMs;
            track.setStep(model.stepMs);
          }
          const mode = model.mode;
          const pos = placeBodies(mode, frame);
          const radiusOf = (id: SpaceBody): number => radiusIn(id, mode);
          // where a moon is round its planet, as the view draws it: in the planet's radii, drawn nearer in a compressed view where the real distance would cross the next planet's orbit
          const moonSite = (id: MoonId, at: number, host: SpacePlanet | SpaceDwarf): Vec3 => {
            const real = moonOffset(id, at);
            const d = Math.hypot(real[0], real[1], real[2]);
            const k = d === 0 ? 1 : moonDistance(mode, host, d) / d;
            return [real[0] * k, real[1] * k, real[2] * k];
          };
          // The places are in Earth radii from the Earth's centre, which at a dwarf planet is millions: a body a few hundredths of a radius across (Phobos, Eris seen close) would be lost to the GPU's single-precision
          // numbers, which the bodies' shaders use for world positions. So the whole scene is moved to put the body looked at (or the target of a ride) at the origin: every place below is relative to it, and the
          // camera's place that is reported, and kept for a glide, has it added back.
          const absoluteSite = (id: BodyId): Vec3 => {
            if ((SPACE_BODIES as readonly string[]).includes(id)) return pos[id as SpaceBody];
            const host = (hostOf(id) ?? "earth") as SpacePlanet | SpaceDwarf;
            const offset = moonSite(id as MoonId, model.time, host);
            const hostRadius = radiusOf(host);
            return [pos[host][0] + offset[0] * hostRadius, pos[host][1] + offset[1] * hostRadius, pos[host][2] + offset[2] * hostRadius];
          };
          const held = model.ride;
          const origin: Vec3 = absoluteSite(held ? (typeof held.target === "string" ? (held.target as BodyId) : held.around) : model.focus);
          for (const id of Object.keys(pos) as (keyof typeof pos)[]) pos[id] = minus(pos[id], origin);
          const sunPos = pos.sun;
          const placeAll = (at: SpaceFrame): Record<SpaceBody, Vec3> => {
            const placed = placeBodies(mode, at);
            for (const id of Object.keys(placed) as (keyof typeof placed)[]) placed[id] = minus(placed[id], origin);
            return placed;
          };
          const toSunOf = (id: SpaceBody): Vec3 => unit(minus(frame.sun, id === "earth" ? [0, 0, 0] : id === "moon" ? frame.moon : id === "sun" ? [0, 0, 0] : (SPACE_DWARFS as readonly string[]).includes(id) ? frame.dwarfs[id as SpaceDwarf] : (SPACE_MINORS as readonly string[]).includes(id) ? frame.minors[id as SpaceMinor] : frame.planets[id as SpacePlanet]));

          // riding along: the camera sits at a moving point and looks at the body it goes round (a moon over its planet, a point over any body). The point's place and way of going are in radii of
          // that body, from its centre; the body is drawn at `centre` with the radius `unitWorld`, so the same numbers place the camera in the scene.
          model.rideLost = false;
          model.rideMotion = 0;
          let focus: BodyId = model.focus;
          let focusPos: Vec3;
          let focusRadius: number;
          if ((SPACE_BODIES as readonly string[]).includes(focus)) {
            focusPos = pos[focus as SpaceBody];
            focusRadius = radiusOf(focus as SpaceBody);
          } else {
            // a moon of a planet: its place round the planet, in the planet's radii as the view draws them
            const host = (hostOf(focus) ?? "earth") as SpacePlanet | SpaceDwarf;
            const offset = moonSite(focus as MoonId, model.time, host);
            const hostRadius = radiusOf(host);
            focusPos = [pos[host][0] + offset[0] * hostRadius, pos[host][1] + offset[1] * hostRadius, pos[host][2] + offset[2] * hostRadius];
            focusRadius = Math.max(1e-9, (BODIES[focus].radiusKm / BODIES[host].radiusKm) * hostRadius);
          }
          let aimWay = 1;
          let besideIn: Omit<BesideInput, "aspect" | "zoom" | "yaw" | "tilt"> | null = null;
          let rideFrom: { around: SpaceBody; centre: Vec3; unitWorld: number; position: Vec3; velocity: Vec3; perSecond: number; hiddenBody: SpaceBody | null; hiddenMoon: string | null } | null = null;
          const ride = model.ride;
          if (ride) {
            const t = ride.target;
            const around = ride.around;
            const unitWorld = radiusOf(around);
            const centre = pos[around];
            let position: Vec3 | undefined;
            let velocity: Vec3 = [0, 0, 0];
            let perSecond = 1;
            let hiddenBody: SpaceBody | null = null;
            let hiddenMoon: string | null = null;
            if (typeof t === "string" && (SPACE_BODIES as readonly string[]).includes(t)) {
              const id = t as SpaceBody;
              if (ride.view === "beside") {
                // beyond the Moon and off the line to the Earth, the Earth in view behind it
                if (id === "moon") besideIn = { moon: pos.moon, moonRadius: radiusOf("moon"), host: pos.earth, hostRadius: radiusOf("earth"), sun: pos.sun, north: orientation("earth", model.time).pole };
                focus = id;
                focusPos = pos[id];
                focusRadius = radiusOf(id);
              } else if (ride.view === "follow") {
                focus = id;
                focusPos = pos[id];
                focusRadius = radiusOf(id);
              } else {
                const ends = track.ends();
                const was = ends ? placeAll(ends[0])[id] : pos[id];
                const will = ends ? placeAll(ends[1])[id] : pos[id];
                // from the centre of the body it goes round (the places are relative to the origin the scene was moved to)
                position = minus(pos[id], centre);
                velocity = minus(will, was);
                perSecond = ends ? Math.max(1e-3, (ends[1].ms - ends[0].ms) / 1000) : 1;
                hiddenBody = id;
              }
            } else if (typeof t === "string") {
              const id = t as MoonId;
              const offset = moonSite(id, model.time, around as SpacePlanet | SpaceDwarf);
              const later = moonSite(id, model.time + 1000, around as SpacePlanet | SpaceDwarf);
              if (ride.view === "beside") {
                const there: Vec3 = [centre[0] + offset[0] * unitWorld, centre[1] + offset[1] * unitWorld, centre[2] + offset[2] * unitWorld];
                const radius = Math.max(1e-6, (BODIES[id].radiusKm / BODIES[around as SpacePlanet].radiusKm) * unitWorld);
                besideIn = { moon: there, moonRadius: radius, host: centre, hostRadius: unitWorld, sun: pos.sun, north: orientation(around as BodyId, model.time).pole };
                focus = id;
                focusPos = there;
                focusRadius = radius;
              } else if (ride.view === "follow") {
                focusPos = [centre[0] + offset[0] * unitWorld, centre[1] + offset[1] * unitWorld, centre[2] + offset[2] * unitWorld];
                focusRadius = Math.max(1e-6, (BODIES[id].radiusKm / BODIES[around as SpacePlanet].radiusKm) * unitWorld);
              } else {
                position = offset;
                velocity = minus(later, offset);
                hiddenMoon = id;
              }
            } else {
              const place = t.at(model.time);
              if (!place) model.rideLost = true;
              else {
                const km = BODIES[around].radiusKm;
                const inRadii: Vec3 = [place.position[0] / km, place.position[1] / km, place.position[2] / km];
                if (ride.view === "follow") {
                  focusPos = [centre[0] + inRadii[0] * unitWorld, centre[1] + inRadii[1] * unitWorld, centre[2] + inRadii[2] * unitWorld];
                  focusRadius = Math.max(1e-6, (ride.distanceKm / km / FIT_DISTANCE) * unitWorld);
                  aimWay = -1;
                } else {
                  position = inRadii;
                  velocity = [place.velocity[0] / km, place.velocity[1] / km, place.velocity[2] / km];
                }
              }
            }
            if (position && ride.view === "from") rideFrom = { around, centre, unitWorld, position, velocity, perSecond, hiddenBody, hiddenMoon };
          }

          let fovNow = FOV;
          let distance = 0;
          if (besideIn) {
            const view = besideMoon({ ...besideIn, aspect: size.width / Math.max(1, size.height), zoom: model.view.zoom, yaw: model.view.yaw, tilt: model.view.tilt });
            camera.position.set(view.position[0], view.position[1], view.position[2]);
            camera.up.set(view.up[0], view.up[1], view.up[2]);
            camera.lookAt(view.position[0] + view.forward[0], view.position[1] + view.forward[1], view.position[2] + view.forward[2]);
            fovNow = view.fov;
            distance = view.distance;
            camera.near = Math.max(1e-4, (view.distance - besideIn.moonRadius) * 0.1);
            camera.far = Math.max(2000, 400 + (mode === "true" ? 40 * 23_481 : 0));
          } else if (rideFrom) {
            const pose = ridePose({ position: rideFrom.position, velocity: rideFrom.velocity, radius: 1, look: ride!.look, yaw: model.view.yaw, tilt: model.view.tilt, zoom: model.view.zoom });
            const { centre, unitWorld } = rideFrom;
            camera.position.set(centre[0] + pose.position[0] * unitWorld, centre[1] + pose.position[1] * unitWorld, centre[2] + pose.position[2] * unitWorld);
            camera.up.set(pose.up[0], pose.up[1], pose.up[2]);
            camera.lookAt(camera.position.x + pose.forward[0], camera.position.y + pose.forward[1], camera.position.z + pose.forward[2]);
            fovNow = pose.fov;
            const away = Math.hypot(...rideFrom.position);
            camera.near = Math.max(0.0008, Math.min(0.05, (away - 1) * 0.1)) * unitWorld;
            camera.far = Math.max(2000, 400 + (mode === "true" ? 40 * 23_481 : 0));
            distance = away * unitWorld;
            // how fast the ground goes by under the camera, in pixels a game-second: its speed over its height, times the focal length in pixels
            const focal = size.height / 2 / Math.tan((fovNow / 2) * RAD);
            const height = Math.max(50 / BODIES[rideFrom.around].radiusKm, away - 1);
            model.rideMotion = (Math.hypot(...rideFrom.velocity) / rideFrom.perSecond / height) * focal;
          } else {
            // looks at the focus body from the direction the sky was in when it was last moved, turned by yaw and tilt, as far as the zoom says
            model.anchor ??= model.time;
            const lon = model.centre.lon - aimWay * model.view.yaw;
            const lat = Math.max(-90, Math.min(90, model.centre.lat - aimWay * model.view.tilt));
            const aim = groundDirection(lon, lat, model.anchor);
            // at zoom 1 the whole picture of the body fits the shorter side of the view, in any shape: a tall view is as far again as it is taller than wide, and a ringed body is framed with its rings
            const across = focusRadius * (FRAMED[focus as SpaceBody] ?? 1) * Math.max(1, size.height / Math.max(1, size.width));
            distance = Math.max(1.05 * focusRadius, (FIT_DISTANCE * across) / Math.max(1e-9, model.view.zoom));
            target.set(focusPos[0], focusPos[1], focusPos[2]);
            model.regionDrawn = null;
            if (model.region !== null && focus === "sun") {
              // a stage out from the Sun: the camera stands back along the same line of sight until every orbit of the stage is in the picture, whatever the zoom says
              if (regionLines === null || regionLines.id !== model.region || regionLines.mode !== mode || Math.abs(model.time - regionLines.epoch) > 86_400_000) {
                regionLines = { id: model.region, mode, epoch: model.time, lines: regionOrbits(model.region, mode, model.time).map((line) => line.map((p) => minus(p, origin))) };
              }
              const framed = regionView({ centre: focusPos, orbits: regionLines.lines, aspect: size.width / Math.max(1, size.height), forward: [-aim[0], -aim[1], -aim[2]], up: [0, 1, 0] });
              distance = Math.hypot(framed.position[0] - focusPos[0], framed.position[1] - focusPos[1], framed.position[2] - focusPos[2]);
              model.regionDrawn = { id: model.region, reach: framed.reach, distance };
            }
            camera.position.set(target.x + aim[0] * distance, target.y + aim[1] * distance, target.z + aim[2] * distance);
            camera.up.set(0, 1, 0);
            camera.lookAt(target);
            camera.near = Math.max(0.0005, distance * 0.02 - focusRadius * 0.5, focusRadius * 0.01);
            camera.far = Math.max(2000, distance * 4 + (mode === "true" ? 40 * 23_481 : 400));
          }

          // a move to a new target: the camera travels from where the last draw left it to the view just set up, along the path `travelPose` gives (the body left kept in the picture through the
          // turn, the destination from then on, nothing passed close), worked out once at the move's first draw
          const glide = model.transition;
          model.travelling = null;
          if (glide) {
            if (glide.input === null) {
              // the pose the last draw left is absolute (from the Earth's centre); the scene is now relative to the new origin
              const from: Vec3 = [glide.from.p[0] - origin[0], glide.from.p[1] - origin[1], glide.from.p[2] - origin[2]];
              fromQ.set(glide.from.q[0], glide.from.q[1], glide.from.q[2], glide.from.q[3]);
              const sf = scratchA.set(0, 0, -1).applyQuaternion(fromQ);
              const su = scratchB.set(0, 1, 0).applyQuaternion(fromQ);
              const start = { position: from, forward: [sf.x, sf.y, sf.z] as Vec3, up: [su.x, su.y, su.z] as Vec3, fov: glide.from.fov };
              const ef = scratchA.set(0, 0, -1).applyQuaternion(camera.quaternion);
              const eu = scratchB.set(0, 1, 0).applyQuaternion(camera.quaternion);
              const radiusOfAny = (id: BodyId): number => {
                if ((SPACE_BODIES as readonly string[]).includes(id)) return radiusOf(id as SpaceBody);
                const host = (hostOf(id) ?? "earth") as SpacePlanet | SpaceDwarf;
                return Math.max(1e-6, (BODIES[id].radiusKm / BODIES[host].radiusKm) * radiusOf(host));
              };
              // every body is where the clock puts it as the move starts and where it puts it as the move ends (`later`, in the scene's places as of this draw): a clock that runs moves them, the Moon about three
              // Earth radii in five game hours
              const familyOf = (id: BodyId | null): BodyId | null => (id === null ? null : id === "moon" ? "earth" : (hostOf(id) as BodyId | undefined) ?? id);
              const family = familyOf(glide.leaving);
              const around = family !== null && family === familyOf(glide.destination) && (glide.leaving !== glide.destination) && (glide.leaving !== family || glide.destination !== family) ? family : null;
              const build = (ms: number): { input: TravelInput; plan: TravelPlan } => {
                const later = ms === model.time ? pos : placeBodies(mode, frameAt(ms));
                if (later !== pos) for (const id of Object.keys(later) as (keyof typeof later)[]) later[id] = minus(later[id], origin);
                const siteAt = (id: BodyId, table: typeof pos, at: number): Vec3 => {
                  if ((SPACE_BODIES as readonly string[]).includes(id)) return table[id as SpaceBody];
                  const host = (hostOf(id) ?? "earth") as SpacePlanet | SpaceDwarf;
                  const offset = moonSite(id as MoonId, at, host);
                  const hostRadius = radiusOf(host);
                  return [table[host][0] + offset[0] * hostRadius, table[host][1] + offset[1] * hostRadius, table[host][2] + offset[2] * hostRadius];
                };
                const bodyOf = (id: BodyId | null): TravelBody | null => (id === null ? null : { from: siteAt(id, pos, model.time), to: siteAt(id, later, ms), radius: radiusOfAny(id) });
                const destination: TravelBody = bodyOf(glide.destination) ?? { from: focusPos, to: focusPos, radius: focusRadius };
                if (model.regionDrawn !== null && glide.destination === "sun") destination.reach = model.regionDrawn.reach;
                const leaving: TravelBody = bodyOf(glide.leaving) ?? { ...destination };
                if (glide.leavingReach > 0 && glide.leaving === "sun") leaving.reach = glide.leavingReach;
                // the last view is the one framed for the destination where it is now: it moves with the destination
                const shift = destination.to === undefined ? [0, 0, 0] : [destination.to[0] - destination.from[0], destination.to[1] - destination.from[1], destination.to[2] - destination.from[2]];
                const end = { position: [camera.position.x + shift[0]!, camera.position.y + shift[1]!, camera.position.z + shift[2]!] as Vec3, forward: [ef.x, ef.y, ef.z] as Vec3, up: [eu.x, eu.y, eu.z] as Vec3, fov: fovNow };
                // every body of the view is kept clear of, the two ends of the move and the planet circled aside
                const others = (SPACE_BODIES as readonly BodyId[]).filter((id) => id !== glide.leaving && id !== glide.destination && id !== family).map((id) => bodyOf(id)!);
                const input: TravelInput = { start, end, leaving, destination, others, aspect: size.width / Math.max(1, size.height), kind: glide.kind, pace: glide.pace };
                if (around !== null) input.around = bodyOf(around)!;
                return { input, plan: travelPlan(input) };
              };
              // the length of the move is worked out for bodies that stand still, then the move is worked out again for where the clock takes them in that time (once: the length may change a little)
              let built = build(model.time);
              if (model.speed !== 0) {
                const duration = glide.duration > 0 ? glide.duration : built.plan.duration;
                built = build(model.time + duration * model.speed);
              }
              glide.input = built.input;
              glide.plan = built.plan;
              glide.origin = origin;
              if (glide.duration <= 0) glide.duration = glide.plan.duration;
            }
            const k = Math.min(1, (performance.now() - glide.start) / Math.max(1, glide.duration));
            const sample = travelPose(glide.input, k, glide.plan!);
            // the path is in the scene's places as of the move's first draw: the scene's origin moves with the body looked at, so the camera is moved by as much
            const [ox, oy, oz] = [glide.origin[0] - origin[0], glide.origin[1] - origin[1], glide.origin[2] - origin[2]];
            camera.position.set(sample.position[0] + ox, sample.position[1] + oy, sample.position[2] + oz);
            camera.up.set(sample.up[0], sample.up[1], sample.up[2]);
            target.set(camera.position.x + sample.forward[0], camera.position.y + sample.forward[1], camera.position.z + sample.forward[2]);
            camera.lookAt(target);
            fovNow = sample.fov;
            model.travelling = { kind: glide.plan!.kind, path: glide.plan!.path, stage: sample.stage, progress: k, duration: glide.duration, leaving: sample.leaving.inside, destination: sample.destination.inside };
            // the move is over at its last draw: nothing is travelling after it
            if (k >= 1) {
              model.transition = null;
              model.travelling = null;
            }
          }
          // the controls' roll turns the picture clockwise about the line of sight, and a pan moves everything by that many CSS pixels at any depth: the window of the projection moves the other way
          if (model.view.roll !== 0) camera.rotateZ(model.view.roll * RAD);
          camera.fov = fovNow;
          camera.aspect = size.width / Math.max(1, size.height);
          if (model.view.panX !== 0 || model.view.panY !== 0) camera.setViewOffset(size.width, size.height, -model.view.panX, -model.view.panY, size.width, size.height);
          else camera.clearViewOffset();
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld();
          const hiddenBody = rideFrom?.hiddenBody ?? null;
          const hiddenMoon = rideFrom?.hiddenMoon ?? null;
          const e2 = camera.matrixWorld.elements;
          model.camera = { position: [camera.position.x + origin[0], camera.position.y + origin[1], camera.position.z + origin[2]], fov: fovNow, up: [e2[4]!, e2[5]!, e2[6]!], forward: [-e2[8]!, -e2[9]!, -e2[10]!] };
          model.pose = { p: [camera.position.x + origin[0], camera.position.y + origin[1], camera.position.z + origin[2]], q: [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w], fov: fovNow, valid: true };
          model.drawnView = { yaw: model.view.yaw, tilt: model.view.tilt, zoom: model.view.zoom, roll: model.view.roll, panX: model.view.panX, panY: model.view.panY };
          model.heightPx = size.height;

          // how many pixels across each body is: for the pictures it needs and for what is chosen
          const half = Math.tan((fovNow / 2) * RAD);
          const radiusPxOf = (id: SpaceBody): number => {
            const d = Math.hypot(pos[id][0] - camera.position.x, pos[id][1] - camera.position.y, pos[id][2] - camera.position.z);
            const r = radiusOf(id);
            return d <= r * 1.001 ? 1e5 : ((size.height / 2) * (r / Math.sqrt(d * d - r * r))) / half;
          };
          const px = {} as Record<SpaceBody, number>;
          for (const id of SPACE_BODIES) px[id] = radiusPxOf(id);
          model.drawn = { frame, distance, radiusPx: px.earth };
          let motion = 0;
          for (const id of SPACE_BODIES) motion = Math.max(motion, (Math.abs(BODIES[id].prime.rate) / 86_400) * RAD * Math.min(px[id], size.height));
          model.motion = motion;

          // the bodies, drawn by the painter, one slot each
          let paintedBodies = 0;
          for (const id of SPACE_BODIES) {
            const slot = slotOf(id);
            // a dwarf planet or minor body too small to see is not made, and one that was made but has shrunk away is hidden
            const unseen = ((SPACE_DWARFS as readonly string[]).includes(id) || (SPACE_MINORS as readonly string[]).includes(id)) && px[id] < DWARF_MIN_PX && focus !== id && model.focus !== id && hostOf(model.focus) !== id;
            if (unseen) {
              if (slot.drawing) slot.drawing.object.visible = false;
              continue;
            }
            fill(id, slot);
            relabel(slot);
            const drawing = slot.drawing;
            if (!drawing) continue;
            paintedBodies += 1;
            drawing.object.visible = id !== hiddenBody;
            drawing.object.position.set(pos[id][0], pos[id][1], pos[id][2]);
            drawing.object.scale.setScalar(radiusOf(id));
            if (drawing.billboard) drawing.object.quaternion.copy(camera.quaternion);
            const lit = id !== "sun" && model.light === "lit";
            const toSun = lit ? unit([camera.position.x - pos[id][0], camera.position.y - pos[id][1], camera.position.z - pos[id][2]]) : toSunOf(id);
            drawing.update({ toSun, ms: model.time, radiusPx: px[id], view: { camera, width: size.width, height: size.height } });
          }
          model.painted.bodies = paintedBodies;
          if (points !== undefined && deps.book !== undefined) {
            if (pointsVersion !== deps.book.version) {
              pointsVersion = deps.book.version;
              points.set(deps.book.smallBodies());
            }
            const ratio = model.ratio();
            points.update({ jd: toTerrestrialTime(model.time) / 86_400_000 + 2_440_587.5, mode, sun: sunPos, width: size.width * ratio, height: size.height * ratio, ratio });
            model.door.points = points.count;
          }

          // the orbits round the Sun, placed by the same mapping as the bodies
          const drawnRings: string[] = [];
          const hiddenRings: string[] = [];
          const miss: Record<string, number> = {};
          // Close to a body (its disc is a few dozen pixels across) the other orbit lines are seen edge-on, long straight scratches across it: only the lines of its own system are kept, and of those the part near it fades
          const nearId = (rideFrom ? rideFrom.around : (SPACE_BODIES as readonly string[]).includes(focus) ? focus : (hostOf(focus) ?? "earth")) as SpaceBody;
          const closeUp = px[nearId] >= CLOSE_UP_PX;
          const ownLine = (id: OrbitBody): boolean => id === nearId || (id === "moon" && (nearId === "earth" || nearId === "moon"));
          const nearRadius = radiusOf(nearId);
          for (const id of ORBIT_BODIES) {
            const o = orbits.get(id)!;
            const hide = closeUp && !ownLine(id);
            o.line.visible = model.orbits && !hide;
            if (!model.orbits) continue;
            const keep = id === "moon" ? MOON_RING_KEEP_MS : 365 * 86_400_000;
            if (!Number.isFinite(o.epoch) || Math.abs(model.time - o.epoch) > keep) {
              o.samples = id === "moon" ? moonOrbit(model.time, ORBIT_POINTS) : planetOrbit(id, model.time, ORBIT_POINTS);
              o.epoch = model.time;
            }
            // the Moon's ring is round the Earth, which is the middle of the view; the others are round the Sun
            const line = id === "moon" ? o.samples.map((p) => plus(placeMoon(mode, p), pos.earth)) : orbitLine(mode, sunPos, o.samples);
            for (let i = 0; i <= ORBIT_POINTS; i += 1) {
              o.positions[i * 3] = line[i]![0];
              o.positions[i * 3 + 1] = line[i]![1];
              o.positions[i * 3 + 2] = line[i]![2];
            }
            (o.line.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
            // the part of its own line near the body is let go, from 3 radii out to 12 (a close view sees a few radii across): never a line across the disc
            const fade = closeUp && ownLine(id);
            if (fade || o.faded) {
              for (let i = 0; i <= ORBIT_POINTS; i += 1) {
                const away = Math.hypot(line[i]![0] - pos[nearId][0], line[i]![1] - pos[nearId][1], line[i]![2] - pos[nearId][2]) / nearRadius;
                const t = Math.max(0, Math.min(1, (away - 3) / 9));
                o.colours[i * 4 + 3] = fade ? t * t * (3 - 2 * t) : 1;
              }
              (o.line.geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
              o.faded = fade;
            }
            if (hide) hiddenRings.push(id);
            // how far the body is from its own line, against the line's size: the check that it sits on it
            const centre: Vec3 = id === "moon" ? pos.earth : sunPos;
            const radius = Math.hypot(...minus(line[0]!, centre)) || 1;
            drawnRings.push(id);
            miss[id] = distanceToLine(pos[id as SpaceBody], line) / radius;
          }
          model.rings = { drawn: drawnRings, miss, hidden: hiddenRings };

          // Starman and the Roadster: where the table puts the car, in the same mapping as the planets, as a dot a few pixels across, on its orbit line (about one trip round the Sun, from the table, worked out again every month)
          const path = model.roadster ? model.roadsterPath : null;
          let roadsterAt: Vec3 | null = null;
          let roadsterPx = 0;
          if (path !== null && model.time >= path.record.start && model.time <= path.record.end) {
            roadsterAt = placeAround(mode, sunPos, eclipticToScene(path.positionAu(model.time)));
            const away = Math.hypot(roadsterAt[0] - camera.position.x, roadsterAt[1] - camera.position.y, roadsterAt[2] - camera.position.z);
            const drawn = (away * half * ROADSTER_PX) / (size.height / 2);
            roadsterPx = away <= drawn ? 1e5 : ((size.height / 2) * (drawn / Math.sqrt(away * away - drawn * drawn))) / half;
            roadsterMesh.visible = true;
            roadsterMesh.position.set(roadsterAt[0], roadsterAt[1], roadsterAt[2]);
            roadsterMesh.scale.setScalar(drawn);
            (roadsterMaterial.uniforms.uLight!.value as THREE.Vector3).set(...unit(minus(sunPos, roadsterAt)));
            if (!Number.isFinite(roadsterOrbit.epoch) || Math.abs(model.time - roadsterOrbit.epoch) > ROADSTER_ORBIT_KEEP_MS) {
              roadsterOrbit.samples = [];
              for (let i = 0; i <= ORBIT_POINTS; i += 1) {
                const t = Math.max(path.record.start, Math.min(path.record.end, model.time - ROADSTER_ORBIT_MS / 2 + (ROADSTER_ORBIT_MS * i) / ORBIT_POINTS));
                roadsterOrbit.samples.push(eclipticToScene(path.positionAu(t)));
              }
              roadsterOrbit.epoch = model.time;
            }
            const line = orbitLine(mode, sunPos, roadsterOrbit.samples);
            for (let i = 0; i <= ORBIT_POINTS; i += 1) {
              roadsterPositions[i * 3] = line[i]![0];
              roadsterPositions[i * 3 + 1] = line[i]![1];
              roadsterPositions[i * 3 + 2] = line[i]![2];
            }
            (roadsterLineGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
            roadsterLine.visible = model.orbits && !closeUp;
          } else {
            roadsterMesh.visible = false;
            roadsterLine.visible = false;
          }
          // the orbiters round the Moon and Mars: each a dot at the table's place, scaled with its body's drawn radius, on its orbit line, once its body is big enough on the screen; a modelled path is drawn dim
          const orbiterSet = model.orbiters ? model.orbiterSet : null;
          const orbiterPlaces: Record<string, { at: Vec3; px: number }> = {};
          const orbiterStatus: Record<string, "tracked" | "predicted" | "modelled" | "none"> = {};
          const orbitersDim: string[] = [];
          if (orbiterSet !== null) {
            for (const id of orbiterSet.ids) {
              const centre = orbiterSet.centre(id);
              const hostPx = px[centre];
              const km = BODIES[centre].radiusKm;
              const at = hostPx >= ORBITER_HOST_PX ? orbiterSet.position(id, model.time) : null;
              const drawing = orbiterDrawings.get(id) ?? (at === null ? undefined : orbiterDrawing(id));
              if (drawing === undefined) continue;
              if (at === null) {
                drawing.mesh.visible = false;
                drawing.line.visible = false;
                continue;
              }
              const status = orbiterSet.status(id, model.time);
              const hostRadius = radiusOf(centre);
              const here = eclipticToScene(at);
              const place: Vec3 = [pos[centre][0] + (here[0] / km) * hostRadius, pos[centre][1] + (here[1] / km) * hostRadius, pos[centre][2] + (here[2] / km) * hostRadius];
              const away = Math.hypot(place[0] - camera.position.x, place[1] - camera.position.y, place[2] - camera.position.z);
              const drawn = (away * half * ORBITER_PX) / (size.height / 2);
              const dotPx = away <= drawn ? 1e5 : ((size.height / 2) * (drawn / Math.sqrt(away * away - drawn * drawn))) / half;
              drawing.mesh.visible = true;
              drawing.mesh.position.set(place[0], place[1], place[2]);
              drawing.mesh.scale.setScalar(drawn);
              (drawing.material.uniforms.uLight!.value as THREE.Vector3).set(...toSunOf(centre));
              const dim = orbiterSet.dim(id, model.time);
              (drawing.material.uniforms.uColour!.value as THREE.Vector3).set(dim ? 0.55 : 0.75, dim ? 0.6 : 0.9, dim ? 0.65 : 1);
              if (!Number.isFinite(drawing.epoch) || Math.abs(model.time - drawing.epoch) > ORBITER_LINE_KEEP_MS) {
                const points = orbiterSet.path(id, model.time, ORBIT_POINTS);
                for (let i = 0; i <= ORBIT_POINTS; i += 1) {
                  const p = eclipticToScene(points[i] ?? [0, 0, 0]);
                  drawing.positions[i * 3] = p[0] / km;
                  drawing.positions[i * 3 + 1] = p[1] / km;
                  drawing.positions[i * 3 + 2] = p[2] / km;
                }
                (drawing.line.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
                drawing.epoch = model.time;
              }
              // the line is in the body's radii round the origin: placed and scaled with the body
              drawing.line.position.set(pos[centre][0], pos[centre][1], pos[centre][2]);
              drawing.line.scale.setScalar(hostRadius);
              drawing.lineMaterial.opacity = dim ? 0.25 : 0.45;
              drawing.line.visible = model.orbits;
              orbiterPlaces[id] = { at: place, px: dotPx };
              orbiterStatus[id] = status;
              if (dim) orbitersDim.push(id);
            }
          } else {
            for (const drawing of orbiterDrawings.values()) {
              drawing.mesh.visible = false;
              drawing.line.visible = false;
            }
          }
          model.orbitersDrawn = { count: Object.keys(orbiterPlaces).length, status: orbiterStatus, dim: orbitersDim };
          model.roadsterDrawn = { shown: roadsterAt !== null, position: roadsterAt === null ? null : [roadsterAt[0] + origin[0], roadsterAt[1] + origin[1], roadsterAt[2] + origin[2]], radiusPx: roadsterPx };

          // the arrowheads on the lines: small in screen pixels at the place, pointing the way the body goes (the lines run from the body once round in the order it goes, whichever way the clock runs)
          const e = camera.matrixWorld.elements;
          const camRight: Vec3 = [e[0]!, e[1]!, e[2]!];
          const camUp: Vec3 = [e[4]!, e[5]!, e[6]!];
          const camForward: Vec3 = [-e[8]!, -e[9]!, -e[10]!];
          const pixel = (at: Vec3): number => {
            const d = (at[0] - camera.position.x) * camForward[0] + (at[1] - camera.position.y) * camForward[1] + (at[2] - camera.position.z) * camForward[2];
            return d <= 0 ? 0 : (d * 2 * half) / Math.max(1, size.height);
          };
          const arrowsNow: Record<string, OrbitArrow[]> = {};
          let measured = 0;
          arrowPositions.fill(0);
          ORBIT_BODIES.forEach((id, k) => {
            const o = orbits.get(id)!;
            if (!model.orbits || !drawnRings.includes(id) || hiddenRings.includes(id)) return;
            const line: Vec3[] = [];
            for (let i = 0; i <= ORBIT_POINTS; i += 1) line.push([o.positions[i * 3]!, o.positions[i * 3 + 1]!, o.positions[i * 3 + 2]!]);
            const sites = arrowSites(line, model.arrowCount);
            arrowsNow[id] = sites;
            sites.forEach((site, j) => {
              // an arrow on the faded part of a line goes with it
              if (closeUp && Math.hypot(site.position[0] - pos[nearId][0], site.position[1] - pos[nearId][1], site.position[2] - pos[nearId][2]) < 12 * nearRadius) return;
              const head = chevron(site.position, site.direction, camRight, camUp, ARROW_PX * pixel(site.position));
              if (!head) return;
              const base = (k * MAX_ARROWS_PER_ORBIT + j) * 4 * 3;
              arrowPositions.set([...head[0], ...head[1], ...head[0], ...head[2]], base);
              if (measured === 0) {
                const tip = labelFor(head[0]);
                const wing = labelFor(head[1]);
                if (tip && wing) measured = Math.hypot(tip.x - wing.x, tip.y - wing.y);
              }
            });
          });
          model.arrows = arrowsNow;
          model.arrowPx = measured;
          arrowLines.visible = model.orbits;
          (arrowGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
          (arrowGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;

          // help mode: on the body looked at, the line of its axis and a curved arrow round it the way it turns
          helpLines.visible = model.help;
          // by default the lines are hidden where the globe covers them: the depth test against the body, whose own drawing writes depth
          (helpLines.material as THREE.LineBasicMaterial).depthTest = !model.helpThrough;
          model.helpDrawn = null;
          if (model.help) {
            const turn = spinAxis(focus, model.time);
            const spin = spinArrow(focusPos, turn.axis, 1.3 * focusRadius, 0.4 * focusRadius, HELP_SEGMENTS);
            const reach = 1.8 * focusRadius;
            const segments: Vec3[] = [
              [focusPos[0] - turn.pole[0] * reach, focusPos[1] - turn.pole[1] * reach, focusPos[2] - turn.pole[2] * reach],
              [focusPos[0] + turn.pole[0] * reach, focusPos[1] + turn.pole[1] * reach, focusPos[2] + turn.pole[2] * reach],
            ];
            for (let i = 0; i < HELP_SEGMENTS; i += 1) segments.push(spin.arc[i]!, spin.arc[i + 1]!);
            const tip = spin.arc[HELP_SEGMENTS]!;
            segments.push(tip, spin.head[0], tip, spin.head[1]);
            segments.forEach((p, i) => helpPositions.set(p, i * 3));
            (helpGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
            // the axis the drawn arc turns about, measured from its own points, round the middle of its circle
            const middle: Vec3 = [focusPos[0] + turn.axis[0] * 0.4 * focusRadius, focusPos[1] + turn.axis[1] * 0.4 * focusRadius, focusPos[2] + turn.axis[2] * 0.4 * focusRadius];
            let sum: Vec3 = [0, 0, 0];
            for (let i = 0; i < HELP_SEGMENTS; i += 1) {
              const a = minus(spin.arc[i]!, middle);
              const b = minus(spin.arc[i + 1]!, middle);
              sum = [sum[0] + a[1] * b[2] - a[2] * b[1], sum[1] + a[2] * b[0] - a[0] * b[2], sum[2] + a[0] * b[1] - a[1] * b[0]];
            }
            model.helpDrawn = { body: focus, axis: turn.axis, pole: turn.pole, retrograde: turn.retrograde, arcTurn: unit(sum) };
          }

          // the moons of a planet, once it is big enough on the screen to show them
          const now = performance.now();
          const seen = new Set<string>();
          const moonPlaces: Record<string, BodyPlace> = {};
          const moonDistances: Record<string, number> = {};
          for (const id of [...SPACE_PLANETS, ...SPACE_DWARFS]) {
            const planet = slotOf(id).drawing;
            if (!planet) continue;
            const sites = ((MOONS_OF as Record<string, readonly MoonId[]>)[id] ?? []).map((moon) => ({ name: moon as string, offset: moonOffset(moon, model.time), radius: BODIES[moon].radiusKm / BODIES[id].radiusKm }));
            // the moons are shown once the planet is a few pixels across, or the system round it is wide enough on the screen to tell its moons from the planet, or one of its moons is the body looked at
            let spread = 1;
            for (const site of sites) spread = Math.max(spread, moonDistance(mode, id, Math.hypot(site.offset[0], site.offset[1], site.offset[2])));
            if (px[id] < MOON_MIN_PLANET_PX && px[id] * spread < MOON_MIN_SYSTEM_PX && hostOf(model.focus) !== id) continue;
            const radius = radiusOf(id);
            for (const site of sites) {
              const reach = Math.hypot(site.offset[0], site.offset[1], site.offset[2]);
              const k = reach === 0 ? 1 : moonDistance(mode, id, reach) / reach;
              const at: Vec3 = [pos[id][0] + site.offset[0] * k * radius, pos[id][1] + site.offset[1] * k * radius, pos[id][2] + site.offset[2] * k * radius];
              projected.set(at[0], at[1], at[2]).project(camera);
              if (projected.z > 1 || Math.abs(projected.x) > 1.25 || Math.abs(projected.y) > 1.25) continue;
              const key = site.name;
              if (key === hiddenMoon) continue;
              let held = moonSlots.get(key);
              if (!held) moonSlots.set(key, (held = { slot: { drawing: undefined, look: null, failed: false, labelled: -1 }, seen: now }));
              held.seen = now;
              seen.add(key);
              fill(key, held.slot);
              relabel(held.slot);
              const drawing = held.slot.drawing;
              if (!drawing) continue;
              const away = Math.hypot(at[0] - camera.position.x, at[1] - camera.position.y, at[2] - camera.position.z);
              const drawn = Math.max(site.radius * radius, (away * half * MOON_MIN_PX) / (size.height / 2));
              drawing.object.visible = true;
              drawing.object.position.set(at[0], at[1], at[2]);
              drawing.object.scale.setScalar(drawn);
              const moonPx = away <= drawn * 1.001 ? 1e5 : ((size.height / 2) * (drawn / Math.sqrt(away * away - drawn * drawn))) / half;
              drawing.update({ toSun: model.light === "lit" ? unit([camera.position.x - at[0], camera.position.y - at[1], camera.position.z - at[2]]) : toSunOf(id), ms: model.time, radiusPx: moonPx, view: { camera, width: size.width, height: size.height } });
              const spot = labelFor(at);
              if (spot) {
                moonPlaces[key] = { x: spot.x, y: spot.y, r: moonPx, named: drawing.label?.shown === true };
                moonDistances[key] = away;
              }
            }
          }
          let soonest = Number.POSITIVE_INFINITY;
          for (const [key, held] of moonSlots) {
            if (seen.has(key)) continue;
            if (held.slot.drawing) held.slot.drawing.object.visible = false;
            if (now - held.seen > MOON_KEEP_MS) {
              empty(held.slot);
              moonSlots.delete(key);
            } else soonest = Math.min(soonest, held.seen + MOON_KEEP_MS - now);
          }
          // a view at rest draws nothing, so a moon that has left the view would be kept for ever: ask for one more draw when the first of them is due to be let go
          if (releaseTimer !== undefined) clearTimeout(releaseTimer);
          releaseTimer = soonest < Number.POSITIVE_INFINITY ? setTimeout(() => deps.invalidate(), soonest + 50) : undefined;
          let paintedMoons = 0;
          for (const held of moonSlots.values()) if (held.slot.drawing?.object.visible) paintedMoons += 1;
          model.painted.moons = paintedMoons;
          model.painted.held = moonSlots.size;
          // one pass over every drawing (the bodies, then the moons): the names drawn, the tile windows summed, and the sources whose tiles are on a body
          let labelsDrawn = 0;
          const tiles: SpaceModel["tiles"] = { requested: 0, loading: 0, failed: 0, shown: null };
          const used: Record<string, number> = {};
          const tally = (painting: Painting | undefined): void => {
            if (painting === undefined) return;
            if (painting.object.visible && painting.label?.shown) labelsDrawn += 1;
            const stats = painting.tiles;
            if (stats === undefined) return;
            tiles.requested += stats.requested;
            tiles.loading += stats.loading;
            tiles.failed += stats.failed;
            if (stats.shown !== null) tiles.shown = Math.max(tiles.shown ?? 0, stats.shown);
            if (stats.source !== undefined) used[stats.source.id] = (used[stats.source.id] ?? 0) + stats.used;
          };
          for (const slot of slots.values()) tally(slot.drawing);
          for (const held of moonSlots.values()) tally(held.slot.drawing);
          model.labelsDrawn = { count: labelsDrawn, focus: (slots.get(focus)?.drawing ?? moonSlots.get(focus)?.slot.drawing)?.label ?? null };
          model.tiles = tiles;
          if (points !== undefined && deps.book !== undefined && points.count > 0) for (const [id, read] of deps.book.recordReads()) used[id] = read.records.length;
          model.door.used = used;

          if (deps.onLabels && model.labels) {
            const places: Record<string, BodyPlace | null> = { ...moonPlaces };
            for (const id of SPACE_BODIES) {
              const at = id === hiddenBody || (rideFrom && id === rideFrom.around) ? null : labelFor(pos[id]);
              const drawing = slots.get(id)?.drawing;
              places[id] = at ? { x: at.x, y: at.y, r: px[id], named: drawing !== undefined && drawing.object.visible && drawing.label?.shown === true } : null;
            }
            for (const [id, { at, px: dotPx }] of Object.entries(orbiterPlaces)) {
              const spot = labelFor(at);
              places[id] = spot ? { x: spot.x, y: spot.y, r: dotPx } : null;
              if (spot) moonDistances[id] = Math.hypot(at[0] - camera.position.x, at[1] - camera.position.y, at[2] - camera.position.z);
            }
            if (roadsterAt !== null) {
              const spot = labelFor(roadsterAt);
              places["roadster"] = spot ? { x: spot.x, y: spot.y, r: roadsterPx } : null;
              if (spot) moonDistances["roadster"] = Math.hypot(roadsterAt[0] - camera.position.x, roadsterAt[1] - camera.position.y, roadsterAt[2] - camera.position.z);
            }
            // a body behind another: its place is inside a nearer body's disc
            const entries: CoverEntry[] = [];
            for (const [id, at] of Object.entries(places)) {
              if (at === null) continue;
              const distance = (SPACE_BODIES as readonly string[]).includes(id) ? Math.hypot(pos[id as SpaceBody][0] - camera.position.x, pos[id as SpaceBody][1] - camera.position.y, pos[id as SpaceBody][2] - camera.position.z) : moonDistances[id];
              if (distance !== undefined) entries.push({ id, x: at.x, y: at.y, r: at.r, distance });
            }
            for (const [id, cover] of coveredBy(entries)) places[id]!.behind = cover;
            deps.onLabels(places);
          }
          if (model.rideLost) deps.onRideLost?.();
          if (model.transition) deps.onMoving?.();
          return false;
        },
        resize(w, h) {
          size = { width: w, height: h };
        },
        dispose() {
          points?.dispose();
          if (releaseTimer !== undefined) clearTimeout(releaseTimer);
          ended = true;
          for (const slot of slots.values()) empty(slot);
          slots.clear();
          for (const held of moonSlots.values()) empty(held.slot);
          moonSlots.clear();
          for (const o of orbits.values()) {
            o.line.geometry.dispose();
            (o.line.material as THREE.Material).dispose();
          }
          for (const lines of [arrowLines, helpLines, roadsterLine]) {
            lines.geometry.dispose();
            (lines.material as THREE.Material).dispose();
          }
          roadsterGeometry.dispose();
          roadsterMaterial.dispose();
          for (const drawing of orbiterDrawings.values()) {
            drawing.material.dispose();
            drawing.line.geometry.dispose();
            drawing.lineMaterial.dispose();
          }
          orbiterGeometry.dispose();
        },
      };
    },
  };
}

