// The moons of the catalogue (`/moon-catalogue`) that the space view does not draw in full, as small dots round their planets, all in one draw. A page turns them on with `all-moons`; the catalogue is then fetched as a chunk
// of its own, so a view without them never carries it. Each dot is at the moon's mean-orbit place, in its planet's radii, drawn nearer in a compressed view by the same mapping as the drawn moons (`moonDistance`). three.js is
// handed in; nothing here imports it as a value. Needs `Points` and `PointsMaterial` from it (a page's own subset of three must hold them for this; without them the dots are not drawn).
import type * as THREE from "three";
import { BODIES } from "../facts.ts";
import { OBLIQUITY, RAD, type Vec3 } from "../vec.ts";
import type { SpaceDwarf, SpacePlanet } from "./frame.ts";
import { moonDistance, type ScaleMode } from "./scale.ts";

/** The parts of three.js the dots use, over and above the ones every body needs. */
export type DotsThree = Pick<typeof THREE, "BufferAttribute" | "BufferGeometry" | "Points" | "PointsMaterial">;

/** One moon to draw as a dot: its planet, and where it is from the planet's centre in kilometres, in the J2000 ecliptic frame (what `catalogueMoonPosition` gives). */
export interface MoonDot {
  host: SpacePlanet | SpaceDwarf;
  km: Vec3;
}

/** The dots of the view. */
export interface MoonDots {
  object: THREE.Points;
  /** Places the dots: `at(host)` is where the host is drawn and `radius(host)` its drawn radius, in the view's units. Returns how many are drawn. */
  update(dots: readonly MoonDot[], mode: ScaleMode, at: (host: SpacePlanet | SpaceDwarf) => Vec3, radius: (host: SpacePlanet | SpaceDwarf) => number, ratio: number): number;
  dispose(): void;
}

/** The most dots drawn: more than every known moon, with room for the years of finds to come. */
export const MAX_MOON_DOTS = 1024;
/** A dot's size, in CSS pixels across. */
const DOT_PX = 3;

const C = Math.cos(OBLIQUITY * RAD);
const S = Math.sin(OBLIQUITY * RAD);

/** An ecliptic J2000 vector in the scene's axes (equatorial, y to the celestial north pole), as `moonOffset` turns a moon's. */
const toScene = (v: Vec3): Vec3 => [v[0], v[1] * S + v[2] * C, -(v[1] * C - v[2] * S)];

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

/** The dots, in one `Points` draw that is hidden until it has something to show. */
export function createMoonDots(T: DotsThree): MoonDots {
  const positions = new Float32Array(MAX_MOON_DOTS * 3);
  const geometry = new T.BufferGeometry();
  const attribute = new T.BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);
  geometry.setDrawRange(0, 0);
  const material = new T.PointsMaterial({ color: 0xc9cdd4, size: DOT_PX, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false });
  const object = new T.Points(geometry, material);
  object.frustumCulled = false;
  object.visible = false;
  return {
    object,
    update(dots, mode, at, radius, ratio) {
      const count = Math.min(MAX_MOON_DOTS, dots.length);
      for (let k = 0; k < count; k += 1) {
        const dot = dots[k]!;
        const o = moonDotOffset(mode, dot);
        const c = at(dot.host);
        const r = radius(dot.host);
        positions[k * 3] = c[0] + o[0] * r;
        positions[k * 3 + 1] = c[1] + o[1] * r;
        positions[k * 3 + 2] = c[2] + o[2] * r;
      }
      attribute.needsUpdate = true;
      geometry.setDrawRange(0, count);
      material.size = DOT_PX * ratio;
      object.visible = count > 0;
      return count;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
