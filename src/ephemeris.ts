// Where the planets and their moons are at a date and time, and how a body looks from the Earth then: its pole, the face that turns toward us, where the Sun is.
// Planets Mercury to Neptune: the VSOP87B series of Bretagnon and Francou, truncated (data/vsop.ts), in terrestrial time (time.ts). Pluto: a Chebyshev table fitted to JPL Horizons for 1800 to 2200 (data/pluto.ts),
// and outside those years JPL's "Keplerian Elements for Approximate Positions of the Major Planets", Table 1 (https://ssd.jpl.nasa.gov/planets/approx_pos.html). The Moon: the largest terms of Meeus, "Astronomical Algorithms", chapter 47. Other moons: fitted to JPL Horizons (data/orbits.ts).
// Light travel time is allowed for, so a turning planet shows the face it really showed when the light left. Pure: no DOM, no three.js.
import { ORBITS, type OrbitElements } from "./data/orbits.ts";
import { DWARF_ELEMENTS } from "./data/dwarf.ts";
import { tableOf, type FittedTable } from "./data/tables.ts";
import { PLUTO, PLUTO_SEGMENT_MS, PLUTO_START } from "./data/pluto.ts";
import { VSOP87, type Variable } from "./data/vsop.ts";
import { toTerrestrialTime } from "./time.ts";
import { BODIES, MOONS_OF, type BodyId, type HostId, type MoonId, type PlanetId } from "./facts.ts";
import { add, cross, DEG, dot, fromRaDec, length, OBLIQUITY, RAD, scale, sub, toEcliptic, unit, wrap360, type Vec3 } from "./vec.ts";

/** Milliseconds since 1970 at J2000.0 (2000-01-01 12:00 TT, taken as UTC). */
const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY = 86_400_000;
const AU_KM = 149_597_870.7;
/** Light takes this many seconds to cross one astronomical unit. */
const LIGHT_SECONDS_PER_AU = 499.004784;

// a (au), e, I, L, long.peri, long.node (degrees), then their rates per Julian century.
const ELEMENTS: Record<PlanetId, readonly number[]> = {
  mercury: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, 0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  mars: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503, -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
  pluto: [39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684, -0.00031596, 0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482],
};

const centuries = (ms: number): number => (ms - J2000) / (DAY * 36525);
const days = (ms: number): number => (ms - J2000) / DAY;

/** Solve Kepler's equation for the eccentric anomaly, all in radians. */
export function kepler(meanAnomaly: number, e: number): number {
  let m = meanAnomaly % (2 * Math.PI);
  if (m > Math.PI) m -= 2 * Math.PI;
  if (m < -Math.PI) m += 2 * Math.PI;
  let E = e < 0.8 ? m : Math.PI;
  for (let i = 0; i < 12; i += 1) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** A planet from its VSOP87B series: longitude, latitude and radius at a moment in terrestrial time, as x, y, z in the J2000 ecliptic. */
function vsopPosition(series: readonly [Variable, Variable, Variable], terrestrialMs: number): Vec3 {
  const t = (terrestrialMs - J2000) / (365_250 * DAY);
  const spherical = [0, 0, 0];
  for (let k = 0; k < 3; k += 1) {
    let sum = 0;
    let power = 1;
    for (const terms of series[k]!) {
      let s = 0;
      for (const [amplitude, phase, frequency] of terms) s += amplitude * Math.cos(phase + frequency * t);
      sum += power * s;
      power *= t;
    }
    spherical[k] = sum;
  }
  const [longitude, latitude, radius] = spherical as [number, number, number];
  const cosLatitude = Math.cos(latitude);
  return [radius * cosLatitude * Math.cos(longitude), radius * cosLatitude * Math.sin(longitude), radius * Math.sin(latitude)];
}

const PLUTO_TABLE: FittedTable = { start: PLUTO_START, segment: PLUTO_SEGMENT_MS, worst: 0, segments: PLUTO };

/** A position from a Chebyshev table, as x, y, z in au, or undefined outside the years it covers. */
function fittedPosition(table: FittedTable, terrestrialMs: number): Vec3 | undefined {
  const segment = Math.floor((terrestrialMs - table.start) / table.segment);
  const coefficients = table.segments[segment];
  if (coefficients === undefined) return undefined;
  const x = (2 * (terrestrialMs - table.start - segment * table.segment)) / table.segment - 1;
  const at = (axis: readonly number[]): number => {
    let b1 = 0;
    let b2 = 0;
    for (let k = axis.length - 1; k >= 1; k -= 1) {
      const b0 = 2 * x * b1 - b2 + axis[k]!;
      b2 = b1;
      b1 = b0;
    }
    return x * b1 - b2 + axis[0]!;
  };
  return [at(coefficients[0]!), at(coefficients[1]!), at(coefficients[2]!)];
}

/** Each planet's mass as a fraction of the Sun's (IAU 2012 and JPL DE440 values; the Earth with its Moon), to find the Sun's place among the planets. */
const MASS_OVER_SUN: Readonly<Record<string, number>> = {
  mercury: 1 / 6023657.33,
  venus: 1 / 408523.72,
  earth: 1 / 328900.56,
  mars: 1 / 3098703.59,
  jupiter: 1 / 1047.3486,
  saturn: 1 / 3497.9018,
  uranus: 1 / 22902.98,
  neptune: 1 / 19412.26,
};

/** The barycentre of the solar system seen from the Sun (J2000 ecliptic, au): the planets' mass-weighted places, which move the Sun about a million kilometres in twelve years. */
function barycentreFromSun(terrestrialMs: number): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  let total = 1;
  for (const id of Object.keys(MASS_OVER_SUN)) {
    const m = MASS_OVER_SUN[id]!;
    const p = vsopPosition(VSOP87[id]!, terrestrialMs);
    x += m * p[0];
    y += m * p[1];
    z += m * p[2];
    total += m;
  }
  return [x / total, y / total, z / total];
}

/**
 * A planet's or dwarf planet's position in the Sun's frame (J2000 ecliptic, astronomical units) at a time: Mercury to Neptune from the VSOP87B series, and Pluto and the other dwarf planets from tables fitted to Horizons (each within a few arc-seconds or better, see the accuracy guide; outside a table's years a dwarf planet falls back to the osculating elements of one epoch from JPL's Small-Body Database).
 * @param planet - The planet's or dwarf planet's name.
 * @param ms - The instant, in milliseconds since 1970 (UTC).
 * @returns The position as x, y, z in au.
 *
 * @example
 * ```ts
 * import { heliocentric } from "@johnmorrisdotca/wakusei-planets";
 *
 * const [x, y, z] = heliocentric("earth", Date.UTC(2026, 0, 3));
 * console.log(Math.hypot(x, y, z).toFixed(3));
 * ```
 */
export function heliocentric(planet: HostId, ms: number): Vec3 {
  const vsop = VSOP87[planet];
  if (vsop !== undefined) return vsopPosition(vsop, toTerrestrialTime(ms));
  if (planet === "pluto") {
    const table = fittedPosition(PLUTO_TABLE, toTerrestrialTime(ms));
    if (table !== undefined) return table;
  }
  const fitted = tableOf(planet);
  if (fitted !== undefined) {
    const tt = toTerrestrialTime(ms);
    const table = fittedPosition(fitted, tt);
    if (table !== undefined) {
      const sun = barycentreFromSun(tt);
      return [table[0] + sun[0], table[1] + sun[1], table[2] + sun[2]];
    }
  }
  let a: number;
  let e: number;
  let I: number;
  let node: number;
  let w: number;
  let E: number;
  const dwarf = DWARF_ELEMENTS[planet as keyof typeof DWARF_ELEMENTS];
  if (dwarf !== undefined) {
    // a dwarf planet: the osculating elements of one epoch, run as a plain ellipse (good for years either side of it)
    a = dwarf.a;
    e = dwarf.e;
    I = dwarf.i * RAD;
    node = dwarf.node * RAD;
    w = dwarf.w * RAD;
    E = kepler((dwarf.m + (dwarf.n * (ms - dwarf.epoch)) / DAY) * RAD, e);
  } else {
    const el = ELEMENTS[planet as PlanetId];
    const T = centuries(ms);
    a = el[0]! + el[6]! * T;
    e = el[1]! + el[7]! * T;
    I = (el[2]! + el[8]! * T) * RAD;
    const L = el[3]! + el[9]! * T;
    const peri = el[4]! + el[10]! * T;
    node = (el[5]! + el[11]! * T) * RAD;
    w = peri * RAD - node;
    E = kepler((L - peri) * RAD, e);
  }
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cn = Math.cos(node);
  const sn = Math.sin(node);
  const ci = Math.cos(I);
  const si = Math.sin(I);
  return [(cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y, (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y, sw * si * x + cw * si * y];
}

/**
 * Mean distance from the Sun, in astronomical units: a planet's semi-major axis at J2000, or a dwarf planet's semi-major axis at the epoch of its elements.
 * @param id - A planet or a dwarf planet.
 * @returns The semi-major axis in au.
 *
 * @example
 * ```ts
 * import { meanSunAu } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(meanSunAu("earth").toFixed(3));
 * ```
 */
export function meanSunAu(id: HostId): number {
  const dwarf = DWARF_ELEMENTS[id as keyof typeof DWARF_ELEMENTS];
  return dwarf !== undefined ? dwarf.a : ELEMENTS[id as PlanetId][0]!;
}

/**
 * The Moon's position from the Earth's centre (J2000 ecliptic, kilometres), from the largest terms of Meeus's lunar series.
 * @param ms - The instant, in milliseconds since 1970.
 * @returns The position as x, y, z in kilometres.
 *
 * @example
 * ```ts
 * import { moonGeocentric } from "@johnmorrisdotca/wakusei-planets";
 *
 * const [x, y, z] = moonGeocentric(Date.UTC(2026, 10, 2));
 * console.log(Math.round(Math.hypot(x, y, z)) > 350000);
 * ```
 */
export function moonGeocentric(ms: number): Vec3 {
  const T = centuries(ms);
  const Lm = 218.3164477 + 481267.88123421 * T;
  const D = (297.8501921 + 445267.1114034 * T) * RAD;
  const M = (357.5291092 + 35999.0502909 * T) * RAD;
  const Mp = (134.9633964 + 477198.8675055 * T) * RAD;
  const F = (93.272095 + 483202.0175233 * T) * RAD;
  const lon = Lm + 6.289 * Math.sin(Mp) + 1.274 * Math.sin(2 * D - Mp) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * Mp) - 0.186 * Math.sin(M) - 0.114 * Math.sin(2 * F) - 0.059 * Math.sin(2 * D - 2 * Mp) - 0.057 * Math.sin(2 * D - M - Mp) + 0.053 * Math.sin(2 * D + Mp) + 0.046 * Math.sin(2 * D - M) + 0.041 * Math.sin(Mp - M);
  const lat = 5.128 * Math.sin(F) + 0.2806 * Math.sin(Mp + F) + 0.2777 * Math.sin(Mp - F) + 0.1732 * Math.sin(2 * D - F);
  const dist = 385000.56 - 20905.355 * Math.cos(Mp) - 3699.111 * Math.cos(2 * D - Mp) - 2955.968 * Math.cos(2 * D) - 569.925 * Math.cos(2 * Mp) + 48.888 * Math.cos(M) - 3.149 * Math.cos(2 * F);
  // The longitude is of the date; take off the precession since J2000 (about 1.4 degrees a century) to put it in the J2000 frame.
  const lam = (lon - 1.3969713 * T) * RAD;
  const bet = lat * RAD;
  return [dist * Math.cos(bet) * Math.cos(lam), dist * Math.cos(bet) * Math.sin(lam), dist * Math.sin(bet)];
}

/** The north pole of a body as a J2000 ecliptic unit vector. */
export function poleOf(id: BodyId): Vec3 {
  const { ra, dec } = BODIES[id].pole;
  return toEcliptic(fromRaDec(ra, dec));
}

/** The prime meridian's direction (J2000 ecliptic unit vector) when it has turned to `w` degrees. */
export function primeMeridian(id: BodyId, w: number): Vec3 {
  const { ra, dec } = BODIES[id].pole;
  const pole = fromRaDec(ra, dec);
  const node = fromRaDec(ra + 90, 0);
  const third = cross(pole, node);
  const c = Math.cos(w * RAD);
  const s = Math.sin(w * RAD);
  return toEcliptic([node[0] * c + third[0] * s, node[1] * c + third[1] * s, node[2] * c + third[2] * s]);
}

/**
 * The way a body is turned toward the viewer, in the viewer's frame (x to the right, y up, z toward the viewer), as unit vectors: its north pole, the direction of longitude 0 and the Sun's direction.
 *
 * @example
 * ```ts
 * import { portrait, type Pose } from "@johnmorrisdotca/wakusei-planets";
 *
 * const pose: Pose = portrait("saturn");
 * console.log(pose.pole.map((n) => n.toFixed(2)).join(", "));
 * ```
 */
export interface Pose {
  /** The north pole. */
  pole: Vec3;
  /** The direction of longitude 0 on the equator. */
  meridian: Vec3;
  /** The direction of the Sun, from the body. */
  light: Vec3;
}

/**
 * What the sky shows of a body at a time: its pose, the latitude the viewer sees it from (how open its rings are), the longitude at the middle of the disc, the phase and the size.
 *
 * @example
 * ```ts
 * import { apparent, type Apparent } from "@johnmorrisdotca/wakusei-planets";
 *
 * const moon: Apparent = apparent("moon", Date.UTC(2026, 10, 24, 14));
 * console.log(moon.illumination.toFixed(2));
 * ```
 */
export interface Apparent extends Pose {
  /** How the body is turned. */
  id: BodyId;
  /** The instant, in milliseconds since 1970. */
  time: number;
  /** Degrees above (positive) or below the body's equator that the viewer sees it from: how open its rings are. */
  subObserverLat: number;
  /** The longitude at the middle of the disc, degrees east, 0 to 360. */
  centralMeridian: number;
  /** The Sun–body–viewer angle in degrees: 0 is full, 180 is new. */
  phaseAngle: number;
  /** The fraction of the disc that is lit, 0 to 1. */
  illumination: number;
  /** The distance from the viewer in kilometres. */
  distanceKm: number;
  /** The angular diameter in degrees. */
  diameterDeg: number;
  /** The viewer's frame in J2000 ecliptic vectors, to turn more vectors into the same view. */
  frame: { right: Vec3; up: Vec3; toward: Vec3 };
}

const north: Vec3 = [0, Math.sin(OBLIQUITY * RAD), Math.cos(OBLIQUITY * RAD)];

/** The viewer's axes for looking along `u` (toward the body): north up, east to the left. */
export function viewFrame(toBody: Vec3): { right: Vec3; up: Vec3; toward: Vec3 } {
  const u = unit(toBody);
  const up = unit(sub(north, scale(u, dot(north, u))));
  const right = unit(cross(u, north));
  return { right, up, toward: scale(u, -1) };
}

const screen = (frame: { right: Vec3; up: Vec3; toward: Vec3 }, v: Vec3): Vec3 => [dot(v, frame.right), dot(v, frame.up), dot(v, frame.toward)];

/** The Earth's position and the geocentric vector to `id`, in au and J2000 ecliptic, at the time the light left. */
function geometry(id: BodyId, ms: number): { earth: Vec3; target: Vec3; sunFrom: Vec3; emit: number; distanceAu: number } {
  const earth = heliocentric("earth", ms);
  if (id === "sun") {
    const g = scale(earth, -1);
    return { earth, target: g, sunFrom: g, emit: ms - length(g) * LIGHT_SECONDS_PER_AU * 1000, distanceAu: length(g) };
  }
  if (id === "moon") {
    const g = scale(moonGeocentric(ms), 1 / AU_KM);
    return { earth, target: g, sunFrom: scale(earth, -1), emit: ms - length(g) * LIGHT_SECONDS_PER_AU * 1000, distanceAu: length(g) };
  }
  if (id === "earth") {
    // The same side of the pair as the Moon is seen from: a Moon's distance out, opposite the Moon, so the Earth and the Moon show the same phase.
    const g = scale(moonGeocentric(ms), 1 / AU_KM);
    return { earth, target: g, sunFrom: scale(earth, -1), emit: ms - length(g) * LIGHT_SECONDS_PER_AU * 1000, distanceAu: length(g) };
  }
  const facts = BODIES[id];
  const planet: HostId = (facts.parent ?? id) as HostId;
  let emit = ms;
  let h = heliocentric(planet, ms);
  let g = sub(h, earth);
  for (let i = 0; i < 2; i += 1) {
    emit = ms - length(g) * LIGHT_SECONDS_PER_AU * 1000;
    h = heliocentric(planet, emit);
    g = sub(h, earth);
  }
  return { earth, target: g, sunFrom: scale(h, -1), emit, distanceAu: length(g) };
}

/**
 * How a body looks from the Earth at a time, from its real pole, rotation and the Sun's direction. A moon that keeps one face to its planet shows that face to the planet.
 *
 * @param id - The body's name.
 * @param time - The instant, in milliseconds since 1970 (`Date.now()`).
 * @returns The pole, the prime meridian and the Sun's direction in the viewer's frame, with the phase and the size.
 *
 * @example
 * ```ts
 * import { apparent } from "@johnmorrisdotca/wakusei-planets";
 *
 * const saturn = apparent("saturn", Date.UTC(2026, 10, 2));
 * console.log(saturn.subObserverLat.toFixed(1), saturn.illumination.toFixed(2));
 * ```
 */
export function apparent(id: BodyId, time: number): Apparent {
  const facts = BODIES[id];
  const { target, sunFrom, emit, distanceAu } = geometry(id, time);
  let toBody = target;
  let moonOffset: Vec3 | undefined;
  if (facts.parent !== undefined && id !== "moon") {
    moonOffset = moonVector(id as MoonId, emit);
    toBody = add(target, scale(moonOffset, 1 / AU_KM));
  }
  const frame = viewFrame(toBody);
  const light = screen(frame, unit(sunFrom));
  const toward = unit(scale(toBody, -1));
  let poleEcl: Vec3;
  let meridianEcl: Vec3;
  if (facts.synchronous === true && id !== "moon" && moonOffset !== undefined) {
    // the face toward the planet: the direction from the moon to the planet, in the equator
    poleEcl = poleOf(facts.parent as HostId);
    const planetward = scale(unit(moonOffset), -1);
    meridianEcl = unit(sub(planetward, scale(poleEcl, dot(planetward, poleEcl))));
  } else {
    const w = facts.prime.w0 + facts.prime.rate * days(emit);
    poleEcl = poleOf(id);
    meridianEcl = primeMeridian(id, wrap360(w));
  }
  const pole = screen(frame, poleEcl);
  const meridian = screen(frame, meridianEcl);
  const subObserverLat = Math.asin(Math.max(-1, Math.min(1, pole[2]))) * DEG;
  const east = cross(poleEcl, meridianEcl);
  const centralMeridian = wrap360(Math.atan2(dot(toward, east), dot(toward, meridianEcl)) * DEG);
  const cosPhase = Math.max(-1, Math.min(1, light[2]));
  const phaseAngle = Math.acos(cosPhase) * DEG;
  const distanceKm = id === "sun" ? distanceAu * AU_KM : length(toBody) * AU_KM;
  return {
    id,
    time,
    pole,
    meridian,
    light,
    subObserverLat,
    centralMeridian,
    phaseAngle,
    illumination: id === "sun" ? 1 : (1 + cosPhase) / 2,
    distanceKm,
    diameterDeg: 2 * Math.asin(Math.min(1, facts.radiusKm / distanceKm)) * DEG,
    frame,
  };
}

/** A moon's position from its planet's centre (J2000 ecliptic, kilometres) at a time. */
export function moonVector(id: MoonId, ms: number): Vec3 {
  if (id === "moon") return moonGeocentric(ms);
  const orbit = ORBITS[id];
  if (orbit === undefined) throw new Error(`no orbit for ${id}`);
  return orbitVector(orbit, ms);
}

function referenceBasis(orbit: OrbitElements): { x: Vec3; y: Vec3; z: Vec3 } {
  if (orbit.frame === "ecliptic") return { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  if (orbit.frame === "j2000") return { x: toEcliptic([1, 0, 0]), y: toEcliptic([0, 1, 0]), z: toEcliptic([0, 0, 1]) };
  const pole = orbit.frame === "laplace" && orbit.pole !== undefined ? orbit.pole : ([BODIES[orbit.parent as HostId].pole.ra, BODIES[orbit.parent as HostId].pole.dec] as const);
  const z = fromRaDec(pole[0], pole[1]);
  const x = fromRaDec(pole[0] + 90, 0);
  return { x: toEcliptic(x), y: toEcliptic(cross(z, x)), z: toEcliptic(z) };
}

const basisCache = new Map<string, { x: Vec3; y: Vec3; z: Vec3 }>();

function orbitVector(orbit: OrbitElements, ms: number): Vec3 {
  const key = `${orbit.parent}:${orbit.frame}:${orbit.pole?.join(",") ?? ""}`;
  let basis = basisCache.get(key);
  if (basis === undefined) {
    basis = referenceBasis(orbit);
    basisCache.set(key, basis);
  }
  const dt = (ms - orbit.epoch) / DAY;
  const w = orbit.w + orbit.dw * dt;
  const node = orbit.node + orbit.dn * dt;
  const lambda0 = orbit.w + orbit.node + orbit.m;
  const swing = orbit.wave === undefined ? 0 : orbit.wave[0] * Math.sin((2 * Math.PI * dt) / orbit.wave[1] + orbit.wave[2] * RAD);
  const M = lambda0 + orbit.sid * dt + 0.5 * (orbit.acc ?? 0) * dt * dt + swing - w - node;
  const E = kepler(M * RAD, orbit.e);
  const x = orbit.a * (Math.cos(E) - orbit.e);
  const y = orbit.a * Math.sqrt(1 - orbit.e * orbit.e) * Math.sin(E);
  const cw = Math.cos(w * RAD);
  const sw = Math.sin(w * RAD);
  const cn = Math.cos(node * RAD);
  const sn = Math.sin(node * RAD);
  const ci = Math.cos(orbit.i * RAD);
  const si = Math.sin(orbit.i * RAD);
  const px = (cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y;
  const py = (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y;
  const pz = sw * si * x + cw * si * y;
  return [px * basis.x[0] + py * basis.y[0] + pz * basis.z[0], px * basis.x[1] + py * basis.y[1] + pz * basis.z[1], px * basis.x[2] + py * basis.y[2] + pz * basis.z[2]];
}

/**
 * One moon, placed in a planet's system: in planet radii, x to the right, y up, z toward the viewer, with its distance from the planet and its phase angle.
 *
 * @example
 * ```ts
 * import { system, type MoonPlace } from "@johnmorrisdotca/wakusei-planets";
 *
 * const io: MoonPlace | undefined = system("jupiter", Date.UTC(2026, 10, 2)).moons[0];
 * console.log(io?.id, io?.distance.toFixed(1));
 * ```
 */
export interface MoonPlace {
  id: MoonId;
  x: number;
  y: number;
  z: number;
  /** The distance from the planet's centre in planet radii. */
  distance: number;
  /** The Sun–moon–viewer angle in degrees (0 is full). */
  phaseAngle: number;
}

/**
 * A planet's own pose and its moons as the Earth sees them at a time, nearest first.
 *
 * @example
 * ```ts
 * import { system, type System } from "@johnmorrisdotca/wakusei-planets";
 *
 * const jupiter: System = system("jupiter", Date.UTC(2026, 10, 2));
 * console.log(jupiter.moons.length);
 * ```
 */
export interface System {
  planet: Apparent;
  moons: MoonPlace[];
}

/**
 * A planet and its moons as the Earth sees them at a time: each moon's place in planet radii, in the viewer's frame (x right, y up, z toward the viewer).
 *
 * @param planet - The planet's name.
 * @param time - The instant, in milliseconds since 1970.
 * @returns The planet's pose and every moon of it, nearest first.
 *
 * @example
 * ```ts
 * import { system } from "@johnmorrisdotca/wakusei-planets";
 *
 * const { moons } = system("jupiter", Date.UTC(2026, 10, 2, 12));
 * console.log(moons.map((moon) => `${moon.id} ${moon.x.toFixed(1)}`).join(", "));
 * ```
 */
export function system(planet: HostId, time: number): System {
  const pose = apparent(planet, time);
  const emit = time - pose.distanceKm / AU_KM * LIGHT_SECONDS_PER_AU * 1000;
  const radius = BODIES[planet].radiusKm;
  const ids: readonly MoonId[] = planet in MOONS_OF ? MOONS_OF[planet as keyof typeof MOONS_OF] : [];
  const moons = ids.map((id): MoonPlace => {
    const v = moonVector(id, emit);
    const s = screen(pose.frame, v);
    const km = length(v);
    const place: Vec3 = [s[0] / radius, s[1] / radius, s[2] / radius];
    return { id, x: place[0], y: place[1], z: place[2], distance: km / radius, phaseAngle: pose.phaseAngle };
  });
  return { planet: pose, moons: moons.sort((a, b) => a.distance - b.distance) };
}

/**
 * The path one moon follows round its planet over one trip, as the Earth sees it at `time`: x, y, z in planet radii, in the viewer's frame at that moment.
 *
 * @param id - The moon's name.
 * @param time - The instant, in milliseconds since 1970.
 * @param points - How many points to make. Default 96.
 * @returns A flat array of `points` triples, x, y, z each; empty for a moon with no orbit.
 *
 * @example
 * ```ts
 * import { orbitPath } from "@johnmorrisdotca/wakusei-planets";
 *
 * const path = orbitPath("io", Date.UTC(2026, 10, 2), 8);
 * console.log(path.length / 3);
 * ```
 */
export function orbitPath(id: MoonId, time: number, points = 96): Float32Array {
  const facts = BODIES[id];
  const planet = (facts.parent ?? "earth") as HostId;
  const orbit = id === "moon" ? undefined : ORBITS[id];
  const rate = id === "moon" ? 13.1763585 : orbit?.sid;
  if (rate === undefined) return new Float32Array(0);
  const pose = apparent(planet, time);
  const radius = BODIES[planet].radiusKm;
  const period = (360 / Math.abs(rate)) * DAY;
  const emit = time - (pose.distanceKm / AU_KM) * LIGHT_SECONDS_PER_AU * 1000;
  const out = new Float32Array(points * 3);
  for (let k = 0; k < points; k += 1) {
    const v = moonVector(id, emit + (k / points) * period);
    const s = screen(pose.frame, v);
    out[k * 3] = s[0] / radius;
    out[k * 3 + 1] = s[1] / radius;
    out[k * 3 + 2] = s[2] / radius;
  }
  return out;
}

/** The planets' moons that are near enough to draw in a system view, nearest first, with how far each goes in planet radii. */
export function nearMoons(planet: HostId, within = 80): { id: MoonId; reach: number }[] {
  const ids: readonly MoonId[] = planet in MOONS_OF ? MOONS_OF[planet as keyof typeof MOONS_OF] : [];
  const radius = BODIES[planet].radiusKm;
  return ids
    .map((id) => ({ id, reach: id === "moon" ? 405500 / radius : ((ORBITS[id]?.a ?? 0) * (1 + (ORBITS[id]?.e ?? 0))) / radius }))
    .filter((m) => m.reach <= within)
    .sort((a, b) => a.reach - b.reach);
}
