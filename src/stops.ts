// Every body as one row a trip can use. Gravity is typed from pages read on 2026-11-04, never guessed.
// GM, where a page prints it: JPL "Planetary Satellite Physical Parameters" (https://ssd.jpl.nasa.gov/sats/phys_par/) for the
// Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto and the moons on that page. NASA fact sheets
// (https://nssdc.gsfc.nasa.gov/planetary/factsheet/) for the Sun (132,712 × 10^6), Mercury (0.022032 × 10^6) and Venus (0.32486 × 10^6).
// Ceres, Eris, Makemake and Haumea: the mass on JPL "Planetary Physical Parameters" (https://ssd.jpl.nasa.gov/planets/phys_par.html)
// times the CODATA 2018 G that page names. Escape speeds for the Sun and those planets are the speeds those pages print.
// A moon's escape speed is sqrt(2 GM / radius) from this package's radius. Nereid, and the dwarf planets and moons
// whose pages do not print a mass, are left empty.
import { heliocentric, meanSunAu, moonVector } from "./ephemeris.ts";
import { BODIES, BODY_IDS, type BodyFacts, type BodyId, type HostId, type MoonId } from "./facts.ts";
import { add, scale, type Vec3 } from "./vec.ts";

/** The astronomical unit the ephemeris uses, in kilometres. */
const AU_KM = 149_597_870.7;
/** CODATA 2018 G, in km^3 kg^-1 s^-2: the value JPL's planetary page names (6.67430 × 10^-11 m^3 kg^-1 s^-2). */
const G_KM3_PER_KG = 6.6743e-20;

const mass = (kg: number): number => kg * G_KM3_PER_KG;

/** GM in km^3/s^2. A body missing here has no published value in the pages above. */
const GM: Partial<Record<BodyId, number>> = {
  sun: 132_712_000_000,
  mercury: 22_032,
  venus: 324_860,
  earth: 398_600.436,
  mars: 42_828.37362,
  jupiter: 126_686_531.9,
  saturn: 37_931_206.23,
  uranus: 5_793_951.3,
  neptune: 6_835_099.97,
  pluto: 869.3,
  ceres: mass(938.416e18),
  eris: mass(16_600e18),
  makemake: mass(3_100e18),
  haumea: mass(4_006e18),
  moon: 4_902.8,
  phobos: 0.0007087,
  deimos: 0.0000962,
  io: 5_959.91547,
  europa: 3_202.7121,
  ganymede: 9_887.83275,
  callisto: 7_179.2834,
  mimas: 2.50349,
  enceladus: 7.21037,
  tethys: 41.21353,
  dione: 73.11607,
  rhea: 153.94175,
  titan: 8_978.1371,
  iapetus: 120.51511,
  miranda: 4.3,
  ariel: 83.5,
  umbriel: 85.1,
  titania: 226.9,
  oberon: 205.3,
  triton: 1_428.49546,
  proteus: 2.58342,
  charon: 106.1,
  nix: 0.0015,
  hydra: 0.002,
};

/** Escape speed in km/s, where a page prints one. Anything else is worked out from GM and the radius. */
const ESCAPE: Partial<Record<BodyId, number>> = {
  sun: 617.6,
  mercury: 4.25,
  venus: 10.36,
  earth: 11.19,
  mars: 5.03,
  jupiter: 60.2,
  saturn: 36.09,
  uranus: 21.38,
  neptune: 23.56,
  pluto: 1.21,
  ceres: 0.51,
  eris: 1.36,
  makemake: 0.76,
  haumea: 0.78,
};

/**
 * One body, with what a trip needs. `gmKm3s2`, `massKg` and `escapeKmS` are empty together when no page read here gives a mass.
 *
 * @example
 * ```ts
 * import { journeyStop, type JourneyStop } from "@johnmorrisdotca/wakusei-planets";
 *
 * const earth: JourneyStop = journeyStop("earth");
 * console.log(earth.sunAu.toFixed(3), earth.escapeKmS);
 * ```
 */
export interface JourneyStop {
  id: BodyId;
  kind: BodyFacts["kind"];
  /** The body a moon goes round. */
  parent?: HostId;
  name: { en: string; ja: string };
  /** Equatorial radius in kilometres, the same number as `BODIES` (a moon's mean radius). */
  radiusKm: number;
  /** Mean distance from the Sun in astronomical units. `0` for the Sun. A moon uses its parent's. */
  sunAu: number;
  /** Gravitational parameter, km^3/s^2. Empty when no cited page gives it. */
  gmKm3s2: number | null;
  /** Mass in kilograms, GM / G with CODATA 2018 G. Empty when GM is empty. */
  massKg: number | null;
  /** Escape speed in km/s: the published figure, or `sqrt(2 GM / radius)` for a moon. Empty when GM is empty. */
  escapeKmS: number | null;
}

const stopOf = (id: BodyId): JourneyStop => {
  const facts = BODIES[id];
  const gm = GM[id] ?? null;
  const host = facts.kind === "moon" ? facts.parent : id === "sun" ? undefined : (id as HostId);
  return {
    id,
    kind: facts.kind,
    ...(facts.parent === undefined ? {} : { parent: facts.parent }),
    name: facts.name,
    radiusKm: facts.radiusKm,
    sunAu: id === "sun" || host === undefined ? 0 : meanSunAu(host),
    gmKm3s2: gm,
    massKg: gm === null ? null : gm / G_KM3_PER_KG,
    escapeKmS: ESCAPE[id] ?? (gm === null ? null : Math.sqrt((2 * gm) / facts.radiusKm)),
  };
};

/**
 * Every body, in the same order as `BODY_IDS`: the Sun, the planets, the dwarf planets, then the moons.
 *
 * @example
 * ```ts
 * import { BODY_IDS, JOURNEY_STOPS } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(JOURNEY_STOPS.length === BODY_IDS.length, JOURNEY_STOPS[0]?.id);
 * ```
 */
export const JOURNEY_STOPS: readonly JourneyStop[] = BODY_IDS.map(stopOf);

const BY_ID = new Map(JOURNEY_STOPS.map((stop) => [stop.id, stop]));

/**
 * One body's row.
 * @param id - The body's name.
 * @returns That body's stop.
 *
 * @example
 * ```ts
 * import { journeyStop } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(journeyStop("titan").parent, journeyStop("titan").gmKm3s2);
 * ```
 */
export function journeyStop(id: BodyId): JourneyStop {
  const stop = BY_ID.get(id);
  if (stop === undefined) throw new Error(`no stop for ${id}`);
  return stop;
}

/**
 * Where a body is in the Sun's frame at an instant, in astronomical units. The Sun is the origin. A moon is its parent plus its offset.
 * @param id - The body's name.
 * @param ms - The instant, in milliseconds since 1970.
 * @returns The position as x, y, z in au.
 *
 * @example
 * ```ts
 * import { stopPlaceAu } from "@johnmorrisdotca/wakusei-planets";
 *
 * const [x, y, z] = stopPlaceAu("mars", Date.UTC(2026, 10, 2));
 * console.log(Math.hypot(x, y, z).toFixed(3));
 * ```
 */
export function stopPlaceAu(id: BodyId, ms: number): Vec3 {
  if (id === "sun") return [0, 0, 0];
  const facts = BODIES[id];
  if (facts.kind !== "moon") return heliocentric(id as HostId, ms);
  if (facts.parent === undefined) throw new Error(`no parent for ${id}`);
  return add(heliocentric(facts.parent, ms), scale(moonVector(id as MoonId, ms), 1 / AU_KM));
}
