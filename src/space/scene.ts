// The space view as a scene for kazoku-ui's shared renderer: the Earth, the Moon, the Sun and the planets in their places, each drawn by the painter (`scene/painter.ts`) and lit by the
// Sun, so the Moon's phase and the Earth's day side come out of the light, not out of a table. Draws only when asked; holds no clock.
import type * as THREE from "three";
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import { BODIES } from "../facts.ts";
import type { ThreeParts } from "../scene/body.ts";
import { type Painting, type WakuseiPainter } from "../scene/painter.ts";
import "../bodies/all.ts";
import type { Vec3 } from "../vec.ts";
import { groundDirection } from "./aim.ts";
import { createTrack, planetOrbit, SPACE_PLANETS, type SpaceFrame, type SpacePlanet } from "./frame.ts";
import { placeAround, placeMoon, placeSun, radiusIn, type ScaleMode } from "./scale.ts";


/** The parts of three.js the space view uses: the bodies' and a perspective camera. */
export type SpaceThree = ThreeParts & Pick<typeof THREE, "PerspectiveCamera">;

const RAD = Math.PI / 180;
/** The camera's distance, in radii of the body it looks at, at which that body fills the view at zoom 1. */
export const FIT_DISTANCE = 3.4;
const FOV = 35;
const ORBIT_POINTS = 96;
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
 * How the Earth is lit: `sun` is the true light; `lit` is daylight from the camera's side, so a view of the night side is never black.
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

export interface SpaceModel {
  /** Moment shown, milliseconds since the epoch. */
  time: number;
  mode: ScaleMode;
  /** The shared controls' yaw, tilt and zoom. */
  view: { yaw: number; tilt: number; zoom: number };
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
  painted: { bodies: number; moons: number };
  /** How many frames the ephemeris has worked out. */
  lookups: number;
  /** Pixels a game-second moves things on the screen (the fastest turning body in sight): the draw rate follows it. */
  motion: number;
  /** The shared controls' view as the last draw used it, and how tall the view was (CSS pixels). */
  drawnView: { yaw: number; tilt: number; zoom: number } | null;
  heightPx: number;
  camera: { position: [number, number, number]; fov: number };
  ratio(): number;
}

export const newSpaceModel = (): SpaceModel => ({
  time: Date.now(),
  mode: "compressed",
  view: { yaw: 0, tilt: 0, zoom: 1 },
  centre: { lon: 0, lat: 0 },
  anchor: null,
  orbits: true,
  labels: true,
  stepMs: 1000,
  focus: "earth",
  light: "sun",
  look: "realistic",
  drawn: null,
  painted: { bodies: 0, moons: 0 },
  lookups: 0,
  motion: 0,
  drawnView: null,
  heightPx: 420,
  camera: { position: [0, 0, 0], fov: FOV },
  ratio: () => Math.min(globalThis.devicePixelRatio || 1, 2),
});

/** Where a body is on the screen: its centre and its apparent radius, in CSS pixels in the box. */
export interface BodyPlace {
  x: number;
  y: number;
  r: number;
}

export interface SpaceDeps {
  painter: () => WakuseiPainter;
  cap: () => number;
  invalidate: () => void;
  /** Where each body is on the screen, in CSS pixels in the box, or null when it is behind the camera. Called at each draw. */
  onLabels?: (places: Record<SpaceBody, BodyPlace | null>) => void;
  /** The painter could not make a body (the three.js parts handed over lack something it needs). */
  onPainterError?: (error: unknown) => void;
}

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

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

      const orbits = new Map<SpacePlanet, { line: THREE.Line; positions: Float32Array; samples: Vec3[]; epoch: number }>();
      for (const id of SPACE_PLANETS) {
        const positions = new Float32Array((ORBIT_POINTS + 1) * 3);
        const geometry = new three.BufferGeometry();
        geometry.setAttribute("position", new three.BufferAttribute(positions, 3));
        const line = new three.Line(geometry, new three.LineBasicMaterial({ color: BODIES[id].colour, transparent: true, opacity: 0.55 }));
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
          const frame = track.at(model.time);
          model.lookups = track.lookups;
          if (model.stepMs !== trackStep) {
            trackStep = model.stepMs;
            track.setStep(model.stepMs);
          }
          const mode = model.mode;
          const sunPos = placeSun(mode, frame.sun);
          const pos = { earth: [0, 0, 0] as Vec3, moon: placeMoon(mode, frame.moon), sun: sunPos } as Record<SpaceBody, Vec3>;
          for (const id of SPACE_PLANETS) pos[id] = placeAround(mode, sunPos, minus(frame.planets[id], frame.sun));
          const radiusOf = (id: SpaceBody): number => radiusIn(id, mode);
          const toSunOf = (id: SpaceBody): Vec3 => unit(minus(frame.sun, id === "earth" ? [0, 0, 0] : id === "moon" ? frame.moon : id === "sun" ? [0, 0, 0] : frame.planets[id]));

          // the camera: looks at the focus body from the direction the sky was in when it was last moved, turned by yaw and tilt, as far as the zoom says
          const focusPos = pos[model.focus];
          const focusRadius = radiusOf(model.focus);
          model.anchor ??= model.time;
          const lon = model.centre.lon - model.view.yaw;
          const lat = Math.max(-90, Math.min(90, model.centre.lat - model.view.tilt));
          const aim = groundDirection(lon, lat, model.anchor);
          const distance = Math.max(1.05 * focusRadius, (FIT_DISTANCE * focusRadius) / Math.max(1e-9, model.view.zoom));
          target.set(focusPos[0], focusPos[1], focusPos[2]);
          camera.position.set(target.x + aim[0] * distance, target.y + aim[1] * distance, target.z + aim[2] * distance);
          camera.up.set(0, 1, 0);
          camera.lookAt(target);
          camera.near = Math.max(0.0005, distance * 0.02 - focusRadius * 0.5, focusRadius * 0.01);
          camera.far = Math.max(2000, distance * 4 + (mode === "true" ? 40 * 23_481 : 400));
          camera.fov = FOV;
          camera.aspect = size.width / Math.max(1, size.height);
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld();
          model.camera = { position: [camera.position.x, camera.position.y, camera.position.z], fov: FOV };
          model.drawnView = { yaw: model.view.yaw, tilt: model.view.tilt, zoom: model.view.zoom };
          model.heightPx = size.height;

          // how many pixels across each body is: for the pictures it needs and for what is chosen
          const half = Math.tan((FOV / 2) * RAD);
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
            drawing.object.position.set(pos[id][0], pos[id][1], pos[id][2]);
            drawing.object.scale.setScalar(radiusOf(id));
            if (drawing.billboard) drawing.object.quaternion.copy(camera.quaternion);
            const lit = id === "earth" && model.light === "lit";
            const toSun = lit ? unit([camera.position.x, camera.position.y, camera.position.z]) : toSunOf(id);
            drawing.update({ toSun, ms: model.time, radiusPx: px[id] });
          }
          model.painted.bodies = paintedBodies;

          // the planets' orbits round the Sun
          for (const id of SPACE_PLANETS) {
            const o = orbits.get(id)!;
            o.line.visible = model.orbits;
            if (!model.orbits) continue;
            if (!Number.isFinite(o.epoch) || Math.abs(model.time - o.epoch) > 365 * 86_400_000) {
              o.samples = planetOrbit(id, model.time, ORBIT_POINTS);
              o.epoch = model.time;
            }
            for (let i = 0; i <= ORBIT_POINTS; i += 1) {
              const p = placeAround(mode, sunPos, o.samples[i]!);
              o.positions[i * 3] = p[0];
              o.positions[i * 3 + 1] = p[1];
              o.positions[i * 3 + 2] = p[2];
            }
            (o.line.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
          }

          // the moons of a planet, once it is big enough on the screen to show them
          const now = performance.now();
          const seen = new Set<string>();
          for (const id of SPACE_PLANETS) {
            const planet = slotOf(id).drawing;
            if (!planet || px[id] < MOON_MIN_PLANET_PX) continue;
            const radius = radiusOf(id);
            for (const site of deps.painter().moons(id, model.time)) {
              const at: Vec3 = [pos[id][0] + site.offset[0] * radius, pos[id][1] + site.offset[1] * radius, pos[id][2] + site.offset[2] * radius];
              projected.set(at[0], at[1], at[2]).project(camera);
              if (projected.z > 1 || Math.abs(projected.x) > 1.25 || Math.abs(projected.y) > 1.25) continue;
              const key = site.name.toLowerCase();
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
              drawing.update({ toSun: toSunOf(id), ms: model.time, radiusPx: moonPx });
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

          if (deps.onLabels && model.labels) {
            const places = {} as Record<SpaceBody, BodyPlace | null>;
            for (const id of SPACE_BODIES) {
              const at = labelFor(pos[id]);
              places[id] = at ? { x: at.x, y: at.y, r: px[id] } : null;
            }
            deps.onLabels(places);
          }
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

