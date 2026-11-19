// The moons of the catalogue (`/moon-catalogue`) of the planets set to `all` (the attribute `moons`, or `moons-of` for one planet): every moon the view does not draw in full as a small pressable dot round its planet, and the
// orbit of every moon of it, coloured by group or by direction. A page turns them on with `moons`; the catalogue is then fetched as a chunk of its own, so a view without them never carries it. Each dot is at the moon's
// mean-orbit place, in its planet's radii, drawn nearer in a compressed view by the same mapping as the drawn moons (`moonDistance`). Each planet's orbits are one `LineSegments` made once for the scale, the colours and the
// month, then only moved and scaled with the planet: a view at rest draws nothing. three.js is handed in; nothing here imports it as a value. Needs `Points`, `PointsMaterial`, `LineSegments` and `LineBasicMaterial` from it
// (a page's own subset of three must hold them for this; without them nothing is drawn).
import type * as THREE from "three";
import { BODIES } from "../facts.ts";
import { OBLIQUITY, RAD, type Vec3 } from "../vec.ts";
import type { SpaceDwarf, SpacePlanet } from "./frame.ts";
import { moonDistance, type ScaleMode } from "./scale.ts";

/** The parts of three.js the dots and the orbits use, over and above the ones every body needs. */
export type DotsThree = Pick<typeof THREE, "BufferAttribute" | "BufferGeometry" | "Points" | "PointsMaterial" | "LineSegments" | "LineBasicMaterial">;

type Host = SpacePlanet | SpaceDwarf;

/** One moon to draw as a dot: its planet, and where it is from the planet's centre in kilometres, in the J2000 ecliptic frame (what `catalogueMoonPosition` gives). */
export interface MoonDot {
  host: Host;
  km: Vec3;
}

/** What `moons-colors` says an orbit's colour means: the moon's family, or the way it goes round. */
export type MoonColorChoice = "group" | "direction";

/** A moon of the catalogue as the layer needs it, without the catalogue's rows: the element makes these from the chunk, so this file never imports it. */
export interface SourceMoon {
  /** The catalogue's id (`himalia`). */
  id: string;
  /** What to print: the name, else the designation. */
  label: string;
  /** The Japanese name, where one is written down. */
  ja: string | null;
  host: Host;
  /** Whether the view draws it in full: then it is a body, not a dot, and only its orbit is drawn here. */
  full: boolean;
  /** `#rrggbb` of its orbit by group and by direction. */
  colors: Readonly<Record<MoonColorChoice, string>>;
}

/** The catalogue as a source of places and orbits. */
export interface MoonSource {
  /** The moons with an orbit, of every host. */
  moons: readonly SourceMoon[];
  /** Where a moon is at a moment, kilometres from its planet's centre, J2000 ecliptic. */
  position(moon: SourceMoon, ms: number): Vec3;
  /** A closed line of the orbit a moon follows at a moment, in the same frame and unit. */
  orbit(moon: SourceMoon, ms: number, points: number): Vec3[];
}

/** A dot's place on the screen, for a press. */
export interface MoonSpot {
  id: string;
  host: Host;
  x: number;
  y: number;
}

/** What one draw of the layer is given. */
export interface MoonLayerInput {
  source: MoonSource;
  /** The planets whose moons are all shown. */
  hosts: ReadonlySet<string>;
  by: MoonColorChoice;
  mode: ScaleMode;
  /** The view's moment, in milliseconds since 1970 (UTC). */
  time: number;
  /** Whether the view draws orbit lines at all (the attribute `orbits`). */
  orbits: boolean;
  at: (host: Host) => Vec3;
  radius: (host: Host) => number;
  ratio: number;
  /** The screen place of a point of the scene, or `null` off the screen or behind the camera. */
  spot: (point: Vec3) => { x: number; y: number } | null;
}

/** What a draw drew. */
export interface MoonLayerDrawn {
  dots: number;
  /** The orbits drawn. */
  orbits: number;
  /** The dots that are on the screen, for a press. */
  spots: MoonSpot[];
}

/** The dots and the orbits of the view. */
export interface MoonLayer {
  update(input: MoonLayerInput): MoonLayerDrawn;
  /** The moons whose orbits a planet's `LineSegments` holds, in order, each with how many segments it has and its orbit's `#rrggbb`: segment number n of the object belongs to the moon where the running total passes n. For a hover on a line. */
  orbitMoons(host: string): readonly { id: string; segments: number; colour: string }[];
  /** The planet's orbits, in the planet's radii round its centre, moved and scaled with the planet; `undefined` before they are built. For a hover on a line. */
  orbitObject(host: string): THREE.LineSegments | undefined;
  /** The opacity every orbit is drawn at, from `MOON_ORBIT_OPACITY` made fainter as the view crowds and goes out. Nothing is drawn by it. */
  setOrbitOpacity(opacity: number): void;
  dispose(): void;
}

/** The most dots drawn: more than every known moon, with room for the years of finds to come. */
export const MAX_MOON_DOTS = 1024;
/** A dot's size, in CSS pixels across. */
const DOT_PX = 3;
/** The opacity of every orbit line, set here and nowhere else. */
export const MOON_ORBIT_OPACITY = 0.6;
/** How many points go round an orbit. */
export const MOON_ORBIT_POINTS = 72;
/** An orbit is drawn again when the view's moment is this far from the one it was drawn for: the orbits of the irregular moons turn over years. */
export const MOON_ORBIT_KEEP_MS = 20 * 86_400_000;

const C = Math.cos(OBLIQUITY * RAD);
const S = Math.sin(OBLIQUITY * RAD);

/** An ecliptic J2000 vector in the scene's axes (equatorial, y to the celestial north pole), as `moonOffset` turns a moon's. */
const toScene = (v: Vec3): Vec3 => [v[0], v[1] * S + v[2] * C, -(v[1] * C - v[2] * S)];

/** `#rrggbb` as three numbers from 0 to 1. */
const rgb = (hex: string): Vec3 => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * Where the view draws a moon of the catalogue: its place from the planet in the planet's radii, turned into the scene's axes and drawn nearer in a compressed view (the same mapping as the drawn moons).
 *
 * @param mode - The scale of the view.
 * @param dot - The moon's host and its place in kilometres.
 * @returns The offset from the planet's centre, in the planet's radii, in the scene's axes.
 */
export function moonDotOffset(mode: ScaleMode, dot: MoonDot): Vec3 {
  const r = BODIES[dot.host].radiusKm;
  const v = toScene([dot.km[0] / r, dot.km[1] / r, dot.km[2] / r]);
  const d = Math.hypot(v[0], v[1], v[2]);
  const k = d === 0 ? 1 : moonDistance(mode, dot.host, d) / d;
  return [v[0] * k, v[1] * k, v[2] * k];
}

/** The dots and the orbits, each a draw that is hidden until it has something to show. */
export function createMoonLayer(T: DotsThree, parent: THREE.Object3D): MoonLayer {
  // the dots: one `Points` for every host
  const positions = new Float32Array(MAX_MOON_DOTS * 3);
  const colors = new Float32Array(MAX_MOON_DOTS * 3);
  const dotGeometry = new T.BufferGeometry();
  const dotPositions = new T.BufferAttribute(positions, 3);
  const dotColors = new T.BufferAttribute(colors, 3);
  dotGeometry.setAttribute("position", dotPositions);
  dotGeometry.setAttribute("color", dotColors);
  dotGeometry.setDrawRange(0, 0);
  const dotMaterial = new T.PointsMaterial({ color: 0xffffff, vertexColors: true, size: DOT_PX, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false });
  const dots = new T.Points(dotGeometry, dotMaterial);
  dots.frustumCulled = false;
  dots.visible = false;
  parent.add(dots);

  // the orbits: one `LineSegments` for each host, in the planet's radii round the planet's centre, moved and scaled with it
  const lineMaterial = new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: MOON_ORBIT_OPACITY, depthWrite: false });
  const lines = new Map<string, { object: THREE.LineSegments; geometry: THREE.BufferGeometry; count: number; moons: { id: string; segments: number; colour: string }[] }>();
  let built: { source: MoonSource; key: string; time: number } | null = null;

  const orbitsKey = (input: MoonLayerInput): string => `${input.mode}|${input.by}|${[...input.hosts].sort().join(",")}`;
  // draws the orbits again: for the scale, the colours, the planets chosen or a month's turning
  const build = (input: MoonLayerInput): number => {
    let total = 0;
    for (const entry of lines.values()) entry.object.visible = false;
    for (const host of input.hosts) {
      const rings: { moon: SourceMoon; points: Vec3[] }[] = [];
      for (const moon of input.source.moons) {
        if (moon.host !== host || moon.id === "moon") continue;
        const points = input.source.orbit(moon, input.time, MOON_ORBIT_POINTS);
        if (points.length > 1) rings.push({ moon, points });
      }
      const segments = rings.reduce((sum, ring) => sum + ring.points.length - 1, 0);
      const array = new Float32Array(segments * 6);
      const tint = new Float32Array(segments * 6);
      let k = 0;
      for (const { moon, points } of rings) {
        const c = rgb(moon.colors[input.by]);
        const offsets = points.map((km) => moonDotOffset(input.mode, { host: moon.host, km }));
        for (let i = 0; i + 1 < offsets.length; i += 1) {
          for (const v of [offsets[i]!, offsets[i + 1]!]) {
            array.set(v, k * 3);
            tint.set(c, k * 3);
            k += 1;
          }
        }
      }
      let entry = lines.get(host);
      if (entry === undefined) {
        const geometry = new T.BufferGeometry();
        const object = new T.LineSegments(geometry, lineMaterial);
        object.frustumCulled = false;
        entry = { object, geometry, count: 0, moons: [] };
        lines.set(host, entry);
        parent.add(object);
      }
      entry.geometry.setAttribute("position", new T.BufferAttribute(array, 3));
      entry.geometry.setAttribute("color", new T.BufferAttribute(tint, 3));
      entry.count = rings.length;
      entry.moons = rings.map((ring) => ({ id: ring.moon.id, segments: ring.points.length - 1, colour: ring.moon.colors[input.by] }));
      total += rings.length;
    }
    built = { source: input.source, key: orbitsKey(input), time: input.time };
    return total;
  };

  return {
    update(input) {
      const wanted = input.orbits && input.hosts.size > 0;
      // the orbits
      let orbitsDrawn = 0;
      if (wanted) {
        if (built === null || built.source !== input.source || built.key !== orbitsKey(input) || Math.abs(input.time - built.time) > MOON_ORBIT_KEEP_MS) build(input);
        for (const [host, entry] of lines) {
          const on = input.hosts.has(host);
          entry.object.visible = on;
          if (!on) continue;
          const c = input.at(host as Host);
          entry.object.position.set(c[0], c[1], c[2]);
          entry.object.scale.setScalar(input.radius(host as Host));
          orbitsDrawn += entry.count;
        }
      } else for (const entry of lines.values()) entry.object.visible = false;
      // the dots, of the moons the view does not draw in full, in the planets chosen
      const shown = input.hosts.size === 0 ? [] : input.source.moons.filter((m) => !m.full && input.hosts.has(m.host));
      const count = Math.min(MAX_MOON_DOTS, shown.length);
      const spots: MoonSpot[] = [];
      for (let k = 0; k < count; k += 1) {
        const moon = shown[k]!;
        const o = moonDotOffset(input.mode, { host: moon.host, km: input.source.position(moon, input.time) });
        const c = input.at(moon.host);
        const r = input.radius(moon.host);
        const x = c[0] + o[0] * r;
        const y = c[1] + o[1] * r;
        const z = c[2] + o[2] * r;
        positions[k * 3] = x;
        positions[k * 3 + 1] = y;
        positions[k * 3 + 2] = z;
        colors.set(rgb(moon.colors[input.by]), k * 3);
        const spot = input.spot([x, y, z]);
        if (spot !== null) spots.push({ id: moon.id, host: moon.host, x: spot.x, y: spot.y });
      }
      dotPositions.needsUpdate = true;
      dotColors.needsUpdate = true;
      dotGeometry.setDrawRange(0, count);
      dotMaterial.size = DOT_PX * input.ratio;
      dots.visible = count > 0;
      return { dots: count, orbits: orbitsDrawn, spots };
    },
    orbitMoons: (host) => lines.get(host)?.moons ?? [],
    orbitObject: (host) => lines.get(host)?.object,
    setOrbitOpacity(opacity) {
      lineMaterial.opacity = opacity;
    },
    dispose() {
      parent.remove(dots);
      for (const entry of lines.values()) parent.remove(entry.object);
      dotGeometry.dispose();
      dotMaterial.dispose();
      lineMaterial.dispose();
      for (const entry of lines.values()) entry.geometry.dispose();
    },
  };
}
