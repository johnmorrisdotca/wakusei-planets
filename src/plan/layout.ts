// The plan: where the bodies are on a top-down map, from the package's own positions. Two systems: the solar system seen from above the ecliptic's north pole, and one planet's moons seen from above that planet's north pole.
// Distances are squeezed (a logarithm, so the inner planets and the outer ones both show in a few hundred pixels) or true. Pure: numbers in, numbers out; no DOM, no clock.
import { ORBITS } from "../data/orbits.ts";
import { heliocentric, heliocentricModel, moonVector } from "../ephemeris.ts";
import { BODIES, MOONS_OF, PLANET_IDS, type BodyId, type HostId, type MinorId, type MoonId } from "../facts.ts";
import { planetOrbit, SPACE_DWARFS, SPACE_MINORS, type SpaceDwarf, type SpaceMinor, type SpacePlanet } from "../space/frame.ts";
import { cross, dot, fromRaDec, toEcliptic, type Vec3 } from "../vec.ts";

const DAY = 86_400_000;
const AU_KM = 149_597_870.7;

/**
 * Which plan to draw: `"sun"` for the solar system from above, or a planet or dwarf planet that has moons (`earth`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto`, `orcus`, `haumea`, `eris`) for its moons from above its north pole.
 *
 * @example
 * ```ts
 * import type { PlanSystem } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const system: PlanSystem = "jupiter";
 * console.log(system);
 * ```
 */
export type PlanSystem = "sun" | keyof typeof MOONS_OF;

/**
 * Every system a plan can show: the Sun first, then each planet or dwarf planet that has moons, nearest the Sun first.
 *
 * @example
 * ```ts
 * import { PLAN_SYSTEMS } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * console.log(PLAN_SYSTEMS.join(", "));
 * ```
 */
export const PLAN_SYSTEMS: readonly PlanSystem[] = ["sun", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "orcus", "haumea", "eris"];

/**
 * How distances are drawn: `squeezed` (the default) puts a body at the logarithm of its distance, so Mercury and Neptune both show in a small picture, and `true` puts it at its real distance in proportion, which crowds the inner bodies near the middle.
 *
 * @example
 * ```ts
 * import type { PlanSpacing } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const spacing: PlanSpacing = "squeezed";
 * console.log(spacing);
 * ```
 */
export type PlanSpacing = "squeezed" | "true";

/**
 * What a dot is: the Sun (`star`), a `planet`, a `dwarf-planet`, a `moon`, an `asteroid`, a `centaur`, a `comet`, or a `spacecraft` handed in with `extras`.
 *
 * @example
 * ```ts
 * import type { PlanKind } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const kind: PlanKind = "comet";
 * console.log(kind);
 * ```
 */
export type PlanKind = "star" | "planet" | "dwarf-planet" | "moon" | "asteroid" | "centaur" | "comet" | "spacecraft";

/**
 * One body on the plan: where it is in the unit disc (x to the right, y up, the edge at 1), its real distance from the middle, and whether it is the one marked.
 *
 * @example
 * ```ts
 * import { planAt, type PlanDot } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const earth: PlanDot = planAt(Date.UTC(2026, 10, 11)).dots.find((dot) => dot.id === "earth")!;
 * console.log(earth.distance.toFixed(2), "au", earth.kind);
 * ```
 */
export interface PlanDot {
  id: string;
  kind: PlanKind;
  /** Across the unit disc, to the right. */
  x: number;
  /** Up the unit disc. */
  y: number;
  /** The distance from the middle in astronomical units (the solar system) or the planet's radii (a moon system). */
  distance: number;
  /** The one the plan is about. */
  marked: boolean;
  /** Further out than the edge of the plan: the dot is held on the edge. */
  beyond: boolean;
}

/**
 * The path of one body round the middle, as points in the unit disc. Points beyond the edge are kept, so a long orbit is cut by the edge and not squashed into it.
 *
 * @example
 * ```ts
 * import { planAt, type PlanOrbit } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const orbit: PlanOrbit = planAt(Date.UTC(2026, 10, 11)).orbits[0]!;
 * console.log(orbit.id, orbit.points.length);
 * ```
 */
export interface PlanOrbit {
  id: string;
  /** The orbit of the body the plan is about. */
  marked: boolean;
  points: readonly (readonly [number, number])[];
}

/**
 * A plan: what to draw for a moment, in the unit disc. `unit` says what `extent` and each dot's `distance` count.
 *
 * @example
 * ```ts
 * import { planAt, type Plan } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const plan: Plan = planAt(Date.UTC(2026, 10, 11), { system: "jupiter", mark: "io" });
 * console.log(plan.unit, plan.extent.toFixed(1), plan.dots.length);
 * ```
 */
export interface Plan {
  system: PlanSystem;
  /** The moment, in milliseconds since 1970 (UTC). */
  time: number;
  spacing: PlanSpacing;
  /** `au` for the solar system, `radii` (the planet's equatorial radii) for a moon system. */
  unit: "au" | "radii";
  /** The distance at the edge of the plan, in `unit`. */
  extent: number;
  /** The distance squeezed spacing treats as near the middle; with `extent` it fixes the logarithm. */
  inner: number;
  /** The Sun, or the planet the moons go round, at the middle. */
  centre: PlanDot;
  /** The bodies round the middle. */
  dots: PlanDot[];
  /** The path of each body round the middle. */
  orbits: PlanOrbit[];
  /** The id of the body marked, or `undefined`. */
  marked: string | undefined;
}

/**
 * A body the package has no position for, handed in by the page: a craft from `/spacecraft`, say.
 *
 * @example
 * ```ts
 * import type { PlanExtra } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const probe: PlanExtra = { id: "voyager1", au: [-40, -120, 90], kind: "spacecraft" };
 * console.log(probe.id);
 * ```
 */
export interface PlanExtra {
  id: string;
  /** Its place from the Sun in the J2000 ecliptic frame, in astronomical units (kilometres over 149,597,870.7). Only the solar-system plan draws it. */
  au: Vec3;
  /** Default `spacecraft`. */
  kind?: PlanKind;
}

/**
 * What `planAt` is asked: the system, the body to mark, the spacing, and any extra bodies.
 *
 * @example
 * ```ts
 * import type { PlanOptions } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const options: PlanOptions = { system: "saturn", mark: "titan", spacing: "squeezed" };
 * console.log(options.mark);
 * ```
 */
export interface PlanOptions {
  /** Default `sun`. */
  system?: PlanSystem;
  /** The body the plan is about. In the solar system a moon marks its planet; in a moon system a moon of another planet marks nothing. */
  mark?: string;
  /** Default `squeezed`. */
  spacing?: PlanSpacing;
  /** Bodies of your own, such as a craft's place. */
  extras?: readonly PlanExtra[];
}

/** The reaches the solar-system plan steps through, in au: the plan is the smallest of them that holds every dot, so a mark that goes further out redraws the scale in whole steps and the planets keep their places in between. */
const SUN_EXTENTS = [50, 100, 200, 500, 1000, 2000] as const;
/** The distance, in au, squeezed spacing treats as close to the Sun: Mercury is then about a quarter of the way out and Neptune nine tenths. */
const SUN_INNER = 0.1;
/** A moon system's inner scale, in the planet's radii. */
const MOON_INNER = 1;
/** A moon system's edge is this far past its furthest moon at its furthest. */
const MOON_MARGIN = 1.08;
/** The points of each orbit line. */
const ORBIT_POINTS = 96;
/** How long an orbit line stands before it is cut again: a planet's path changes less than a pixel in a year, a moon's in a week. */
const SUN_BUCKET = 365.25 * DAY;
const MOON_BUCKET = 7 * DAY;

/**
 * Where a distance goes on the plan, 0 at the middle and 1 at the edge. Squeezed is `ln(1 + d / inner) / ln(1 + extent / inner)`, which spreads the inner bodies a good deal and the outer ones a little; true is `d / extent`.
 *
 * @param distance - The distance from the middle, in the plan's unit.
 * @param extent - The distance at the edge.
 * @param spacing - `squeezed` or `true`.
 * @param inner - The distance squeezed spacing treats as near the middle.
 * @returns The place on the radius: 0 to 1 within the edge, more beyond it.
 *
 * @example
 * ```ts
 * import { planRadius } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * console.log(planRadius(1, 50, "squeezed", 0.1).toFixed(2), planRadius(1, 50, "true", 0.1).toFixed(2));
 * ```
 */
export function planRadius(distance: number, extent: number, spacing: PlanSpacing, inner: number): number {
  const d = Math.max(0, distance);
  return spacing === "true" ? d / extent : Math.log1p(d / inner) / Math.log1p(extent / inner);
}

/**
 * The reach of the solar-system plan that holds a farthest body: the smallest of 50, 100, 200, 500, 1,000 and 2,000 au that is at least `farthest` (2,000 beyond that).
 *
 * @param farthest - The distance of the farthest dot, in au.
 * @returns The distance at the edge, in au.
 *
 * @example
 * ```ts
 * import { planSunExtent } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * console.log(planSunExtent(30), planSunExtent(83), planSunExtent(170));
 * ```
 */
export function planSunExtent(farthest: number): number {
  return SUN_EXTENTS.find((step) => step >= farthest) ?? SUN_EXTENTS[SUN_EXTENTS.length - 1]!;
}

const orbitCache = new Map<string, readonly (readonly [number, number])[]>();
const remember = (key: string, make: () => readonly (readonly [number, number])[]): readonly (readonly [number, number])[] => {
  let found = orbitCache.get(key);
  if (found === undefined) {
    if (orbitCache.size > 400) orbitCache.clear();
    found = make();
    orbitCache.set(key, found);
  }
  return found;
};

const SUN_BODIES: readonly (SpacePlanet | SpaceDwarf | SpaceMinor | "earth")[] = [...PLANET_IDS];

/** A body in the solar-system plan: a planet, a dwarf planet or a minor body, or a moon's planet. */
const sunBodyOf = (id: string): string | undefined => {
  if (id === "sun") return "sun";
  const facts = (BODIES as Readonly<Record<string, (typeof BODIES)[BodyId]>>)[id];
  if (facts === undefined) return undefined;
  if (facts.kind === "moon") return facts.parent ?? "earth";
  return facts.kind === "star" ? "sun" : id;
};

/** A heliocentric orbit, as points in the ecliptic plane in au: a trip round the Sun from the start of the year or so the moment is in. */
function sunOrbit(id: SpacePlanet | SpaceDwarf | SpaceMinor | "earth", time: number): readonly (readonly [number, number])[] {
  const bucket = Math.floor(time / SUN_BUCKET);
  // the theory is in the key: a table imported after the first draw gives a better line than the elements it replaces
  return remember(`${id}|${bucket}|${heliocentricModel(id as HostId | MinorId, time).theory}`, () => planetOrbit(id, bucket * SUN_BUCKET, ORBIT_POINTS).map((p) => {
    // planetOrbit answers in the scene's axes (J2000 equatorial with y north and z toward the viewer): back to equatorial, then to the ecliptic
    const ecliptic = toEcliptic([p[0], -p[2], p[1]]);
    return [ecliptic[0], ecliptic[1]] as const;
  }));
}

/** The axes of a planet's north pole as seen in the J2000 ecliptic: x along its equator, y a quarter turn on, z up its pole. */
function poleBasis(host: HostId): { x: Vec3; y: Vec3; z: Vec3 } {
  const { ra, dec } = BODIES[host].pole;
  const z = toEcliptic(fromRaDec(ra, dec));
  const x = toEcliptic(fromRaDec(ra + 90, 0));
  return { x, y: cross(z, x), z };
}

/** A moon's place from its planet, in the planet's radii, in the view from above its north pole. */
function overPole(host: HostId, id: MoonId, time: number): [number, number] {
  const basis = poleBasis(host);
  const v = moonVector(id, time);
  const radius = BODIES[host].radiusKm;
  return [dot(v, basis.x) / radius, dot(v, basis.y) / radius];
}

/** One moon's orbit round its planet in the planet's radii, one trip from the week the moment is in. */
function moonOrbit(host: HostId, id: MoonId, time: number): readonly (readonly [number, number])[] {
  const bucket = Math.floor(time / MOON_BUCKET);
  return remember(`${host}:${id}|${bucket}`, () => {
    const rate = ORBITS[id]?.sid;
    if (rate === undefined || rate === 0) return [];
    const start = bucket * MOON_BUCKET;
    const period = (360 / Math.abs(rate)) * DAY;
    const points: [number, number][] = [];
    for (let k = 0; k <= ORBIT_POINTS; k += 1) points.push(overPole(host, id, start + (k / ORBIT_POINTS) * period));
    return points;
  });
}

/** The farthest a moon goes from its planet, in the planet's radii. */
function reachOf(host: HostId, id: MoonId): number {
  const radius = BODIES[host].radiusKm;
  if (id === "moon") return (405_500 / radius);
  const orbit = ORBITS[id];
  return orbit === undefined ? 0 : (orbit.a * (1 + orbit.e)) / radius;
}

const squeeze = (point: readonly [number, number], extent: number, spacing: PlanSpacing, inner: number): [number, number] => {
  const d = Math.hypot(point[0], point[1]);
  if (d === 0) return [0, 0];
  const k = planRadius(d, extent, spacing, inner) / d;
  return [point[0] * k, point[1] * k];
};

const place = (id: string, kind: PlanKind, point: readonly [number, number], extent: number, spacing: PlanSpacing, inner: number, marked: boolean): PlanDot => {
  const distance = Math.hypot(point[0], point[1]);
  const at = squeeze(point, extent, spacing, inner);
  const r = Math.hypot(at[0], at[1]);
  const beyond = r > 1;
  return { id, kind, x: beyond ? at[0] / r : at[0], y: beyond ? at[1] / r : at[1], distance, marked, beyond };
};

/**
 * The plan for a moment: the solar system seen from above the ecliptic's north pole (x toward the March equinox, planets going anticlockwise), or one planet's moons seen from above its north pole. Every position is the package's own (VSOP87B,
 * the fitted tables, the moon theories) for `time`, with no allowance for light's travel. The orbit lines are cut once a year in the solar system and once a week for moons, which is finer than a pixel; the dots are exact.
 *
 * The solar-system plan holds the eight planets and Pluto, and the body marked if it is a dwarf planet or a minor body (and any `extras`), and stands at the smallest of 50, 100, 200, 500, 1,000 and 2,000 au that holds them all.
 * A moon system holds every moon of the planet and stands a little past the furthest of them. A moon system is seen from above the planet's IAU north pole, so a planet that spins backward about it (Uranus) has its moons go clockwise.
 * Pluto comes from its fitted table. The other dwarf planets and the minor bodies come from the osculating elements of one epoch, unless you have imported `@johnmorrisdotca/wakusei-planets/tables` (or `/tables/ceres`, `/tables/dwarfs`, `/tables/minor`), which fit them to Horizons; `<wakusei-plan>` imports the one it needs when such a body is marked.
 * `mark` is read in lower case. A `system` that is not in `PLAN_SYSTEMS` throws a `RangeError` that lists them.
 *
 * @param time - The moment, in milliseconds since 1970 (UTC).
 * @param options - The system, the body to mark, the spacing and any extras.
 * @returns The plan.
 * @throws RangeError when `options.system` is not one of `PLAN_SYSTEMS`.
 *
 * @example
 * ```ts
 * import { planAt } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const sky = planAt(Date.UTC(2026, 10, 11), { mark: "mars" });
 * const mars = sky.dots.find((dot) => dot.id === "mars")!;
 * console.log(sky.extent, mars.marked, mars.distance.toFixed(2), "au");
 *
 * const jupiter = planAt(Date.UTC(2026, 10, 11), { system: "jupiter", mark: "io" });
 * console.log(jupiter.dots.map((dot) => dot.id).join(", "));
 * ```
 */
export function planAt(time: number, options: PlanOptions = {}): Plan {
  const system = options.system ?? "sun";
  if (!(PLAN_SYSTEMS as readonly string[]).includes(system)) throw new RangeError(`unknown plan system ${JSON.stringify(system)}; expected one of ${PLAN_SYSTEMS.join(", ")}`);
  if (options.mark !== undefined) options = { ...options, mark: options.mark.trim().toLowerCase() };
  const spacing: PlanSpacing = options.spacing === "true" ? "true" : "squeezed";
  return system === "sun" ? sunPlan(time, options, spacing) : moonPlan(time, system, options, spacing);
}

function sunPlan(time: number, options: PlanOptions, spacing: PlanSpacing): Plan {
  const wanted = options.mark === undefined ? undefined : sunBodyOf(options.mark) ?? ((options.extras ?? []).some((one) => one.id === options.mark) ? options.mark : undefined);
  const ids: string[] = [...SUN_BODIES];
  if (wanted !== undefined && wanted !== "sun" && !ids.includes(wanted) && ((SPACE_DWARFS as readonly string[]).includes(wanted) || (SPACE_MINORS as readonly string[]).includes(wanted))) ids.push(wanted);
  const raw: { id: string; kind: PlanKind; point: [number, number] }[] = [];
  for (const id of ids) {
    const v = heliocentric(id as HostId | MinorId, time);
    raw.push({ id, kind: BODIES[id as BodyId].kind, point: [v[0], v[1]] });
  }
  for (const extra of options.extras ?? []) raw.push({ id: extra.id, kind: extra.kind ?? "spacecraft", point: [extra.au[0], extra.au[1]] });
  // the plan is a view from above, so a body's distance is its distance in the ecliptic plane: its height does not push the edge out
  const farthest = Math.max(...raw.map((one) => Math.hypot(one.point[0], one.point[1])));
  const extent = planSunExtent(farthest);
  const dots = raw.map((one) => place(one.id, one.kind, one.point, extent, spacing, SUN_INNER, one.id === wanted));
  const orbits: PlanOrbit[] = ids
    .map((id) => ({ id, marked: id === wanted, points: sunOrbit(id as SpacePlanet | SpaceDwarf | SpaceMinor | "earth", time).map((p) => squeeze(p, extent, spacing, SUN_INNER)) }));
  const centre: PlanDot = { id: "sun", kind: "star", x: 0, y: 0, distance: 0, marked: wanted === "sun", beyond: false };
  return { system: "sun", time, spacing, unit: "au", extent, inner: SUN_INNER, centre, dots: dots.sort((a, b) => Number(a.marked) - Number(b.marked)), orbits: orbits.sort((a, b) => Number(a.marked) - Number(b.marked)), marked: wanted };
}

function moonPlan(time: number, host: Exclude<PlanSystem, "sun">, options: PlanOptions, spacing: PlanSpacing): Plan {
  const moons: readonly MoonId[] = MOONS_OF[host];
  const wanted = options.mark !== undefined && (options.mark === host || (moons as readonly string[]).includes(options.mark)) ? options.mark : undefined;
  const extent = Math.max(...moons.map((id) => reachOf(host, id))) * MOON_MARGIN;
  const dots = moons.map((id) => place(id, "moon", overPole(host, id, time), extent, spacing, MOON_INNER, id === wanted));
  const orbits: PlanOrbit[] = moons.map((id) => ({ id, marked: id === wanted, points: moonOrbit(host, id, time).map((p) => squeeze(p, extent, spacing, MOON_INNER)) }));
  const centre: PlanDot = { id: host, kind: BODIES[host].kind, x: 0, y: 0, distance: 0, marked: wanted === host, beyond: false };
  return { system: host, time, spacing, unit: "radii", extent, inner: MOON_INNER, centre, dots: dots.sort((a, b) => Number(a.marked) - Number(b.marked)), orbits: orbits.sort((a, b) => Number(a.marked) - Number(b.marked)), marked: wanted };
}

/**
 * Kilometres in an astronomical unit, for turning a craft's place from `/spacecraft` (kilometres) into the astronomical units `PlanExtra` takes.
 *
 * @example
 * ```ts
 * import { PLAN_AU_KM } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * console.log((PLAN_AU_KM / 1e6).toFixed(1), "million km");
 * ```
 */
export const PLAN_AU_KM = AU_KM;
