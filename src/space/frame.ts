// Where the Sun, the Moon and the planets are, as seen from the centre of the Earth, for any date, from this package's own models (VSOP87B planets, the Pluto table, ELP2000 Moon).
// Positions are geometric (no aberration or nutation, about 20 arc-seconds), in the painter's axes: J2000 equatorial, x to the vernal equinox, y north. Pure: no DOM, no three.js.
import { heliocentric, moonGeocentric } from "../ephemeris.ts";
import { OBLIQUITY, RAD, type Vec3 } from "../vec.ts";
import { earthPosition } from "../theory.ts";
import { DAY_MS } from "../clock.ts";

/**
 * A position or direction as `[x, y, z]` in the scene's axes: J2000 equatorial, x to the vernal equinox, y north.
 *
 * @example
 * ```ts
 * import type { SpaceVec3 } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const origin: SpaceVec3 = [0, 0, 0];
 * console.log(origin);
 * ```
 */
export type SpaceVec3 = Vec3;

/** Kilometres in one astronomical unit. */
const AU_KM = 149_597_870.7;
/**
 * The Earth's equatorial radius in kilometres (IAU), the unit of the scene's distances.
 *
 * @example
 * ```ts
 * import { EARTH_RADIUS_KM } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(EARTH_RADIUS_KM);
 * ```
 */
export const EARTH_RADIUS_KM = 6378.137;
/**
 * Earth radii in one astronomical unit.
 *
 * @example
 * ```ts
 * import { AU_IN_EARTH_RADII } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(Math.round(AU_IN_EARTH_RADII));
 * ```
 */
export const AU_IN_EARTH_RADII = AU_KM / EARTH_RADIUS_KM;

/**
 * The planets the space view places, nearest the Sun first (the Earth is the middle of the view).
 *
 * @example
 * ```ts
 * import { SPACE_PLANETS } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(SPACE_PLANETS.join(", "));
 * ```
 */
export const SPACE_PLANETS = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;

/**
 * One of the planets in `SPACE_PLANETS`.
 *
 * @example
 * ```ts
 * import { planetOrbit, type SpacePlanet } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const planet: SpacePlanet = "mars";
 * console.log(planetOrbit(planet, Date.UTC(2026, 10, 2), 8).length);
 * ```
 */
export type SpacePlanet = (typeof SPACE_PLANETS)[number];

/**
 * Where everything is at one moment: positions in astronomical units from the Earth's centre, in J2000 equatorial axes with y north.
 *
 * @example
 * ```ts
 * import { frameAt, type SpaceFrame } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const frame: SpaceFrame = frameAt(Date.UTC(2026, 10, 2, 12));
 * console.log(Object.keys(frame.planets).length);
 * ```
 */
export interface SpaceFrame {
  ms: number;
  sun: Vec3;
  moon: Vec3;
  planets: Record<SpacePlanet, Vec3>;
}

/** An ecliptic J2000 vector in the scene's axes (equatorial J2000, y north). */
const scene = (v: Vec3): Vec3 => {
  const c = Math.cos(OBLIQUITY * RAD);
  const s = Math.sin(OBLIQUITY * RAD);
  return [v[0], v[1] * s + v[2] * c, -(v[1] * c - v[2] * s)];
};

/**
 * The state of the sky at `ms`: the Sun, the Moon and eight planets as seen from the Earth's centre, worked out by this package's own models in a fraction of a millisecond.
 *
 * @param ms - A moment, in milliseconds since the Unix epoch.
 * @returns The Sun, the Moon and the planets in astronomical units from the Earth's centre.
 *
 * @example
 * ```ts
 * import { frameAt } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const frame = frameAt(Date.UTC(2026, 10, 2, 12));
 * console.log(frame.moon.map((n) => n.toFixed(4)));
 * ```
 */
export function frameAt(ms: number): SpaceFrame {
  const earth = earthPosition(ms);
  const planets = {} as Record<SpacePlanet, Vec3>;
  for (const id of SPACE_PLANETS) {
    const h = heliocentric(id, ms);
    planets[id] = scene([h[0] - earth[0], h[1] - earth[1], h[2] - earth[2]]);
  }
  const moon = moonGeocentric(ms);
  return { ms, sun: scene([-earth[0], -earth[1], -earth[2]]), moon: scene([moon[0] / AU_KM, moon[1] / AU_KM, moon[2] / AU_KM]), planets };
}

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * A frame between two others, `t` from 0 to 1.
 *
 * @param a - The earlier frame.
 * @param b - The later frame.
 * @param t - How far from `a` to `b`, from 0 to 1.
 * @returns The frame at that fraction.
 *
 * @example
 * ```ts
 * import { blend, frameAt } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const start = Date.UTC(2026, 10, 2);
 * const middle = blend(frameAt(start), frameAt(start + 1000), 0.5);
 * console.log(middle.ms - start);
 * ```
 */
export function blend(a: SpaceFrame, b: SpaceFrame, t: number): SpaceFrame {
  const planets = {} as Record<SpacePlanet, Vec3>;
  for (const id of SPACE_PLANETS) planets[id] = lerp3(a.planets[id], b.planets[id], t);
  return { ms: a.ms + (b.ms - a.ms) * t, sun: lerp3(a.sun, b.sun, t), moon: lerp3(a.moon, b.moon, t), planets };
}

/**
 * Answers for any moment from two real ones: `at(ms)` works out a frame only when `ms` leaves the span the last two answers cover, and then looks `stepMs` ahead, so playing
 * time at a steady rate costs one pair of lookups every `stepMs` and every draw in between is arithmetic.
 *
 * @param initialStepMs - How far ahead the second answer looks, in milliseconds.
 * @returns A track: `at(ms)` for a frame, `lookups` for how many frames were worked out, `ends()` for the two answers it is between (undefined before the first `at`), `reset()` and `setStep(ms)`.
 *
 * @example
 * ```ts
 * import { createTrack } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const track = createTrack(1000);
 * const start = Date.UTC(2026, 10, 2);
 * for (let step = 0; step < 10; step += 1) track.at(start + step * 50);
 * console.log(track.lookups);
 * ```
 */
export function createTrack(initialStepMs = 1000) {
  let stepMs = initialStepMs;
  let a: SpaceFrame | undefined;
  let b: SpaceFrame | undefined;
  let lookups = 0;
  return {
    at(ms: number): SpaceFrame {
      if (!a || !b || ms < a.ms || ms > b.ms) {
        a = frameAt(ms);
        b = frameAt(ms + stepMs);
        lookups += 2;
      }
      return blend(a, b, (ms - a.ms) / (b.ms - a.ms));
    },
    /** The two answers the track is between now (undefined before the first). */
    ends(): [SpaceFrame, SpaceFrame] | undefined {
      return a && b ? [a, b] : undefined;
    },
    /** How many frames have been worked out. */
    get lookups(): number {
      return lookups;
    },
    reset(): void {
      a = undefined;
      b = undefined;
    },
    /** Look further ahead (a faster game clock): the next lookup uses it. */
    setStep(ms: number): void {
      stepMs = Math.max(1, ms);
      a = undefined;
      b = undefined;
    },
  };
}

const PERIOD_DAYS: Record<SpacePlanet | "earth", number> = { mercury: 87.97, venus: 224.7, earth: 365.256, mars: 686.98, jupiter: 4332.6, saturn: 10_759, uranus: 30_688, neptune: 60_182, pluto: 90_560 };

/**
 * The path a planet or the Earth takes round the Sun, as `count + 1` points round one trip from where the planet is at `ms`, from the Sun, in astronomical units and the scene's axes.
 *
 * @param id - The planet or `earth`.
 * @param ms - The moment the path starts at, in milliseconds since the Unix epoch.
 * @param count - How many segments to cut the trip into.
 * @returns `count + 1` points; the last is near the first.
 *
 * @example
 * ```ts
 * import { planetOrbit } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const points = planetOrbit("jupiter", Date.UTC(2026, 10, 2), 12);
 * console.log(points.length);
 * ```
 */
export function planetOrbit(id: SpacePlanet | "earth", ms: number, count = 96): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= count; i += 1) points.push(scene(heliocentric(id, ms + (i / count) * PERIOD_DAYS[id] * DAY_MS)));
  return points;
}
