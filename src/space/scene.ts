// The space view as a scene for kazoku-ui's shared renderer: the Earth, the Moon, the Sun and the planets in their places, each drawn by the painter (`scene/painter.ts`) and lit by the
// Sun, so the Moon's phase and the Earth's day side come out of the light, not out of a table. Draws only when asked; holds no clock.
import type * as THREE from "three";
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import { BODIES, type MoonId } from "../facts.ts";
import type { ThreeParts } from "../scene/body.ts";
import { moonOffset } from "../scene/orient.ts";
import { type Painting, type WakuseiPainter } from "../scene/painter.ts";
import "../bodies/all.ts";
import type { Vec3 } from "../vec.ts";
import { groundDirection } from "./aim.ts";
import { createTrack, moonOrbit, planetOrbit, SPACE_PLANETS, type SpaceFrame, type SpacePlanet, type SpaceVec3 } from "./frame.ts";
import { ridePose, type RideLook } from "./ride.ts";
import { moonDistance, orbitLine, placeBodies, placeMoon, radiusIn, type ScaleMode } from "./scale.ts";


/** The parts of three.js the space view uses: the bodies' and a perspective camera. */
export type SpaceThree = ThreeParts & Pick<typeof THREE, "PerspectiveCamera">;

const RAD = Math.PI / 180;
/** The camera's distance, in radii of the body it looks at, at which that body fills the view at zoom 1. */
export const FIT_DISTANCE = 3.4;
const FOV = 35;
const ORBIT_POINTS = 96;
const ORBIT_BODIES = ["earth", ...SPACE_PLANETS, "moon"] as const;
/** How long the Moon's ring is kept before it is worked out again from the Moon's place, in milliseconds: its path changes by a couple of hundred kilometres in that time. */
const MOON_RING_KEEP_MS = 5 * 86_400_000;
type OrbitBody = (typeof ORBIT_BODIES)[number];
/** How many radii across the picture of a body is at zoom 1 when it has more than its globe: Saturn's rings (to 2.27 radii) are inside the view, not cut by it. */
const FRAMED: Partial<Record<SpaceBody, number>> = { saturn: 2.4 };
/** The moons of a planet are shown once the planet is this many CSS pixels across its radius, and each is drawn at least this many pixels across its radius. */
const MOON_MIN_PLANET_PX = 4;
const MOON_MIN_PX = 2.2;
/** A moon that has been out of sight this long is let go (its pictures too). */
const MOON_KEEP_MS = 4000;

/**
 * The eleven bodies the space view places, names and lets a reader choose: the Earth, the Sun, the Moon, the seven other planets and Pluto.
 *
 * @example
 * ```ts no-run
 * import { SPACE_BODIES } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * console.log(SPACE_BODIES.join(", "));
 * ```
 */
export const SPACE_BODIES = ["earth", "sun", "moon", ...SPACE_PLANETS] as const;

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
  view: "from" | "follow";
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
  /** The body the camera looks at, and (in `zoom`) fills the view with at 1x. */
  focus: SpaceBody;
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
  rings: { drawn: string[]; miss: Record<string, number> };
  /** How many frames the ephemeris has worked out. */
  lookups: number;
  /** Pixels a game-second moves things on the screen (the fastest turning body in sight): the draw rate follows it. */
  motion: number;
  /** The shared controls' view as the last draw used it, and how tall the view was (CSS pixels). */
  drawnView: { yaw: number; tilt: number; zoom: number; roll: number; panX: number; panY: number } | null;
  heightPx: number;
  camera: { position: [number, number, number]; fov: number };
  /** The body or point the camera rides along with, or null. */
  ride: RideState | null;
  /** Set at each draw: the target of the ride could not be placed, so the ordinary camera was used. */
  rideLost: boolean;
  /** A camera move in progress from where the last draw left it: when it began (ms of the page's clock), how long it takes. */
  transition: { start: number; duration: number; from: { p: SpaceVec3; q: [number, number, number, number]; fov: number } } | null;
  pose: CameraPose;
  /** Pixels a game-second that riding makes things move on the screen (0 when not riding): the draw rate follows it. */
  rideMotion: number;
  ratio(): number;
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
  focus: "earth",
  light: "sun",
  look: "realistic",
  drawn: null,
  painted: { bodies: 0, moons: 0, held: 0 },
  tiles: { requested: 0, loading: 0, failed: 0, shown: null },
  rings: { drawn: [], miss: {} },
  lookups: 0,
  motion: 0,
  drawnView: null,
  heightPx: 420,
  camera: { position: [0, 0, 0], fov: FOV },
  ride: null,
  rideLost: false,
  transition: null,
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
}

export interface SpaceDeps {
  painter: () => WakuseiPainter;
  cap: () => number;
  invalidate: () => void;
  /** Bring the model's time up to the page's clock; called at the start of each draw, so a picture drawn late shows the moment it is drawn at and not the one of the last tick. */
  advance?: () => void;
  /** Where each body is on the screen, in CSS pixels in the box, or null when it is behind the camera. Called at each draw. */
  onLabels?: (places: Record<SpaceBody, BodyPlace | null>) => void;
  /** Called at the end of a draw while the camera is moving from one ride to another, so the next frame is asked for (at the page's frame cap). */
  onMoving?: () => void;
  /** The target of the ride could not be placed at this draw. */
  onRideLost?: () => void;
  /** The painter could not make a body (the three.js parts handed over lack something it needs). */
  onPainterError?: (error: unknown) => void;
}

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** How far a place is from the nearest point of a line through `points`, in the line's units. */
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
      const camera = new three.PerspectiveCamera(FOV, width / Math.max(1, height), 0.05, 1000);
      const target = new three.Vector3();
      const projected = new three.Vector3();
      const desiredQ = camera.quaternion.clone();
      const fromQ = camera.quaternion.clone();

      let ended = false;
      interface Slot {
        drawing: Painting | undefined;
        look: string | null;
        failed: boolean;
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
          const made = deps.painter().make(three, id, { look: model.look, invalidate: () => deps.invalidate(), ratio: model.ratio(), maxTexture: deps.cap() });
          if (ended) {
            made.dispose();
            return;
          }
          slot.drawing = made;
          scene.add(made.object);
        } catch (error) {
          slot.failed = true;
          deps.onPainterError?.(error);
        }
      };
      const slotOf = (id: string): Slot => {
        let slot = slots.get(id);
        if (!slot) slots.set(id, (slot = { drawing: undefined, look: null, failed: false }));
        return slot;
      };

      const orbits = new Map<OrbitBody, { line: THREE.Line; positions: Float32Array; samples: Vec3[]; epoch: number }>();
      for (const id of ORBIT_BODIES) {
        const positions = new Float32Array((ORBIT_POINTS + 1) * 3);
        const geometry = new three.BufferGeometry();
        geometry.setAttribute("position", new three.BufferAttribute(positions, 3));
        const line = new three.Line(geometry, new three.LineBasicMaterial({ color: id === "earth" ? "#6aa8ff" : id === "moon" ? "#c5cdd9" : BODIES[id].colour, transparent: true, opacity: 0.55 }));
        line.frustumCulled = false;
        scene.add(line);
        orbits.set(id, { line, positions, samples: [], epoch: Number.NaN });
      }
      const moonSlots = new Map<string, { slot: Slot; seen: number }>();
      let releaseTimer: ReturnType<typeof setTimeout> | undefined;

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
          const sunPos = pos.sun;
          const radiusOf = (id: SpaceBody): number => radiusIn(id, mode);
          const placeAll = (at: SpaceFrame): Record<SpaceBody, Vec3> => placeBodies(mode, at);
          // where a moon is round its planet, as the view draws it: in the planet's radii, drawn nearer in a compressed view where the real distance would cross the next planet's orbit
          const moonSite = (id: MoonId, at: number, host: SpacePlanet): Vec3 => {
            const real = moonOffset(id, at);
            const d = Math.hypot(real[0], real[1], real[2]);
            const k = d === 0 ? 1 : moonDistance(mode, host, d) / d;
            return [real[0] * k, real[1] * k, real[2] * k];
          };
          const toSunOf = (id: SpaceBody): Vec3 => unit(minus(frame.sun, id === "earth" ? [0, 0, 0] : id === "moon" ? frame.moon : id === "sun" ? [0, 0, 0] : frame.planets[id]));

          // riding along: the camera sits at a moving point and looks at the body it goes round (a moon over its planet, a point over any body). The point's place and way of going are in radii of
          // that body, from its centre; the body is drawn at `centre` with the radius `unitWorld`, so the same numbers place the camera in the scene.
          model.rideLost = false;
          model.rideMotion = 0;
          let focus: SpaceBody = model.focus;
          let focusPos: Vec3 = pos[focus];
          let focusRadius = radiusOf(focus);
          let aimWay = 1;
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
              if (ride.view === "follow") {
                focus = id;
                focusPos = pos[id];
                focusRadius = radiusOf(id);
              } else {
                const ends = track.ends();
                const was = ends ? placeAll(ends[0])[id] : pos[id];
                const will = ends ? placeAll(ends[1])[id] : pos[id];
                position = pos[id];
                velocity = minus(will, was);
                perSecond = ends ? Math.max(1e-3, (ends[1].ms - ends[0].ms) / 1000) : 1;
                hiddenBody = id;
              }
            } else if (typeof t === "string") {
              const id = t as MoonId;
              const offset = moonSite(id, model.time, around as SpacePlanet);
              const later = moonSite(id, model.time + 1000, around as SpacePlanet);
              if (ride.view === "follow") {
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
          if (rideFrom) {
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
            const across = focusRadius * (FRAMED[focus] ?? 1) * Math.max(1, size.height / Math.max(1, size.width));
            distance = Math.max(1.05 * focusRadius, (FIT_DISTANCE * across) / Math.max(1e-9, model.view.zoom));
            target.set(focusPos[0], focusPos[1], focusPos[2]);
            camera.position.set(target.x + aim[0] * distance, target.y + aim[1] * distance, target.z + aim[2] * distance);
            camera.up.set(0, 1, 0);
            camera.lookAt(target);
            camera.near = Math.max(0.0005, distance * 0.02 - focusRadius * 0.5, focusRadius * 0.01);
            camera.far = Math.max(2000, distance * 4 + (mode === "true" ? 40 * 23_481 : 400));
          }

          // a ride that changed: glide from where the last draw left the camera
          const glide = model.transition;
          if (glide) {
            const k = Math.min(1, (performance.now() - glide.start) / glide.duration);
            const ease = k * k * (3 - 2 * k);
            desiredQ.copy(camera.quaternion);
            camera.position.set(glide.from.p[0] + (camera.position.x - glide.from.p[0]) * ease, glide.from.p[1] + (camera.position.y - glide.from.p[1]) * ease, glide.from.p[2] + (camera.position.z - glide.from.p[2]) * ease);
            fromQ.set(glide.from.q[0], glide.from.q[1], glide.from.q[2], glide.from.q[3]);
            camera.quaternion.copy(fromQ.slerp(desiredQ, ease));
            fovNow = glide.from.fov + (fovNow - glide.from.fov) * ease;
            if (k >= 1) model.transition = null;
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
          model.camera = { position: [camera.position.x, camera.position.y, camera.position.z], fov: fovNow };
          model.pose = { p: [camera.position.x, camera.position.y, camera.position.z], q: [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w], fov: fovNow, valid: true };
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
            fill(id, slot);
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

          // the orbits round the Sun, placed by the same mapping as the bodies
          const drawnRings: string[] = [];
          const miss: Record<string, number> = {};
          for (const id of ORBIT_BODIES) {
            const o = orbits.get(id)!;
            o.line.visible = model.orbits;
            if (!model.orbits) continue;
            const keep = id === "moon" ? MOON_RING_KEEP_MS : 365 * 86_400_000;
            if (!Number.isFinite(o.epoch) || Math.abs(model.time - o.epoch) > keep) {
              o.samples = id === "moon" ? moonOrbit(model.time, ORBIT_POINTS) : planetOrbit(id, model.time, ORBIT_POINTS);
              o.epoch = model.time;
            }
            // the Moon's ring is round the Earth, which is the middle of the view; the others are round the Sun
            const line = id === "moon" ? o.samples.map((p) => placeMoon(mode, p)) : orbitLine(mode, sunPos, o.samples);
            for (let i = 0; i <= ORBIT_POINTS; i += 1) {
              o.positions[i * 3] = line[i]![0];
              o.positions[i * 3 + 1] = line[i]![1];
              o.positions[i * 3 + 2] = line[i]![2];
            }
            (o.line.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
            // how far the body is from its own line, against the line's size: the check that it sits on it
            const centre: Vec3 = id === "moon" ? pos.earth : sunPos;
            const radius = Math.hypot(...minus(line[0]!, centre)) || 1;
            drawnRings.push(id);
            miss[id] = distanceToLine(pos[id as SpaceBody], line) / radius;
          }
          model.rings = { drawn: drawnRings, miss };

          // the moons of a planet, once it is big enough on the screen to show them
          const now = performance.now();
          const seen = new Set<string>();
          for (const id of SPACE_PLANETS) {
            const planet = slotOf(id).drawing;
            if (!planet || px[id] < MOON_MIN_PLANET_PX) continue;
            const radius = radiusOf(id);
            for (const site of deps.painter().moons(id, model.time)) {
              const reach = Math.hypot(site.offset[0], site.offset[1], site.offset[2]);
              const k = reach === 0 ? 1 : moonDistance(mode, id, reach) / reach;
              const at: Vec3 = [pos[id][0] + site.offset[0] * k * radius, pos[id][1] + site.offset[1] * k * radius, pos[id][2] + site.offset[2] * k * radius];
              projected.set(at[0], at[1], at[2]).project(camera);
              if (projected.z > 1 || Math.abs(projected.x) > 1.25 || Math.abs(projected.y) > 1.25) continue;
              const key = site.name.toLowerCase();
              if (key === hiddenMoon) continue;
              let held = moonSlots.get(key);
              if (!held) moonSlots.set(key, (held = { slot: { drawing: undefined, look: null, failed: false }, seen: now }));
              held.seen = now;
              seen.add(key);
              fill(key, held.slot);
              const drawing = held.slot.drawing;
              if (!drawing) continue;
              const away = Math.hypot(at[0] - camera.position.x, at[1] - camera.position.y, at[2] - camera.position.z);
              const drawn = Math.max(site.radius * radius, (away * half * MOON_MIN_PX) / (size.height / 2));
              drawing.object.visible = true;
              drawing.object.position.set(at[0], at[1], at[2]);
              drawing.object.scale.setScalar(drawn);
              const moonPx = away <= drawn * 1.001 ? 1e5 : ((size.height / 2) * (drawn / Math.sqrt(away * away - drawn * drawn))) / half;
              drawing.update({ toSun: model.light === "lit" ? unit([camera.position.x - at[0], camera.position.y - at[1], camera.position.z - at[2]]) : toSunOf(id), ms: model.time, radiusPx: moonPx, view: { camera, width: size.width, height: size.height } });
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
          const tiles: SpaceModel["tiles"] = { requested: 0, loading: 0, failed: 0, shown: null };
          for (const painting of [...[...slots.values()].map((slot) => slot.drawing), ...[...moonSlots.values()].map((held) => held.slot.drawing)]) {
            const stats = painting?.tiles;
            if (stats === undefined) continue;
            tiles.requested += stats.requested;
            tiles.loading += stats.loading;
            tiles.failed += stats.failed;
            if (stats.shown !== null) tiles.shown = Math.max(tiles.shown ?? 0, stats.shown);
          }
          model.tiles = tiles;

          if (deps.onLabels && model.labels) {
            const places = {} as Record<SpaceBody, BodyPlace | null>;
            for (const id of SPACE_BODIES) {
              const at = id === hiddenBody || (rideFrom && id === rideFrom.around) ? null : labelFor(pos[id]);
              places[id] = at ? { x: at.x, y: at.y, r: px[id] } : null;
            }
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
        },
      };
    },
  };
}

