// Famous spacecraft: where they are at a date and their whole voyage. Each craft's path is a Chebyshev table fitted to JPL Horizons (scripts/make-spacecraft-data.py, src/craft/<craft>.ts) over the whole of Horizons' own record
// of it, loaded when asked for (`loadSpacecraft`) so a page pays only for the craft it draws. Positions are heliocentric, in kilometres, in the J2000 ecliptic frame like `heliocentric`. Pure: no DOM, no three.js.
import { craftSpan, craftState, craftTable } from "./data/craft.ts";
import { toTerrestrialTime } from "./clock.ts";
import { heliocentric } from "./ephemeris.ts";
import { SPACECRAFT, SPACECRAFT_IDS, type SpacecraftId } from "./spacecraft-facts.ts";
import { length, scale, sub, type Vec3 } from "./vec.ts";
import { moment, type When } from "./when.ts";

export { SPACECRAFT, SPACECRAFT_IDS, type SpacecraftEvent, type SpacecraftFacts, type SpacecraftId } from "./spacecraft-facts.ts";
export type { When } from "./when.ts";

const AU_KM = 149_597_870.7;
/** The speed of light in kilometres a second. */
const LIGHT_KM_PER_SECOND = 299_792.458;

const LOADERS: Readonly<Record<SpacecraftId, () => Promise<unknown>>> = {
  voyager1: () => import("./craft/voyager1.ts"),
  voyager2: () => import("./craft/voyager2.ts"),
  newhorizons: () => import("./craft/newhorizons.ts"),
  pioneer10: () => import("./craft/pioneer10.ts"),
  pioneer11: () => import("./craft/pioneer11.ts"),
  cassini: () => import("./craft/cassini.ts"),
  galileo: () => import("./craft/galileo.ts"),
  juno: () => import("./craft/juno.ts"),
  parker: () => import("./craft/parker.ts"),
  webb: () => import("./craft/webb.ts"),
};

function facts(id: SpacecraftId): (typeof SPACECRAFT)[SpacecraftId] {
  const found = (SPACECRAFT as Readonly<Record<string, (typeof SPACECRAFT)[SpacecraftId]>>)[id];
  if (found === undefined || !Object.hasOwn(SPACECRAFT, id)) throw new RangeError(`unknown spacecraft ${JSON.stringify(id)}; expected one of ${SPACECRAFT_IDS.join(", ")}`);
  return found;
}

/**
 * Load the fitted paths of some spacecraft (or all of them), each a table of its own that nothing else imports: about 6 kB gzipped for the Voyagers, the Pioneers, New Horizons and JWST, and more for the craft that orbited a planet.
 * Call it once before the other functions; it is safe to call again.
 *
 * @param ids - The craft to load; none means all ten.
 * @returns A promise that settles when every table is registered.
 *
 * @example
 * ```ts
 * import { loadSpacecraft, spacecraftPosition } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * await loadSpacecraft("voyager1");
 * const [x, y, z] = spacecraftPosition("voyager1", Date.UTC(2026, 10, 8));
 * console.log((Math.hypot(x, y, z) / 149597870.7).toFixed(0), "au from the Sun");
 * ```
 */
export async function loadSpacecraft(...ids: readonly SpacecraftId[]): Promise<void> {
  const wanted = ids.length === 0 ? SPACECRAFT_IDS : ids;
  for (const id of wanted) facts(id);
  await Promise.all(wanted.map((id) => LOADERS[id]()));
}

/** The terrestrial time of a moment on a craft's path, or a RangeError that names the moment and the record. */
function onPath(id: SpacecraftId, when: When): { tt: number; table: NonNullable<ReturnType<typeof craftTable>> } {
  const craft = facts(id);
  const ms = moment(when);
  const table = craftTable(id);
  if (table === undefined) throw new Error(`the path of ${craft.name.en} is not loaded: await loadSpacecraft(${JSON.stringify(id)}) first`);
  const tt = toTerrestrialTime(ms);
  const [first, last] = craftSpan(table);
  if (tt < first || tt > last) {
    throw new RangeError(`when ${new Date(ms).toISOString()} is outside the record of ${craft.name.en}, which runs from ${new Date(craft.record.start).toISOString()} to ${new Date(craft.record.end).toISOString()}`);
  }
  return { tt, table };
}

/**
 * Where a craft is at a moment: x, y, z in kilometres from the Sun, in the J2000 ecliptic frame (the same axes as `heliocentric`, which is in astronomical units).
 * The path comes from Horizons, which is the craft's tracked path to now and its planned path after, so a moment in the future is a prediction. A moment outside the record (before about an hour after launch, or past its end) throws a RangeError.
 *
 * @param id - The craft.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The position in kilometres.
 *
 * @example
 * ```ts
 * import { loadSpacecraft, spacecraftPosition } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * await loadSpacecraft("newhorizons");
 * console.log(spacecraftPosition("newhorizons", new Date("2015-07-14T11:49:00Z")).map((n) => Math.round(n / 1e6)));
 * ```
 */
export function spacecraftPosition(id: SpacecraftId, when: When): Vec3 {
  const { tt, table } = onPath(id, when);
  return craftState(table, tt)!.position;
}

/**
 * A craft's velocity relative to the Sun at a moment, in kilometres a second, in the same frame as `spacecraftPosition`.
 *
 * @param id - The craft.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The velocity.
 *
 * @example
 * ```ts
 * import { loadSpacecraft, spacecraftVelocity } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * await loadSpacecraft("voyager2");
 * console.log(spacecraftVelocity("voyager2", Date.UTC(2026, 0, 1)).map((n) => n.toFixed(1)));
 * ```
 */
export function spacecraftVelocity(id: SpacecraftId, when: When): Vec3 {
  const { tt, table } = onPath(id, when);
  return craftState(table, tt)!.velocity;
}

/**
 * A craft's speed relative to the Sun at a moment, in kilometres a second. Within about 3 per cent of Horizons' own figure at worst, and usually far closer.
 *
 * @param id - The craft.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The speed.
 *
 * @example
 * ```ts
 * import { loadSpacecraft, spacecraftSpeed } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * await loadSpacecraft("voyager1");
 * console.log(spacecraftSpeed("voyager1", Date.UTC(2026, 10, 8)).toFixed(1), "km/s");
 * ```
 */
export function spacecraftSpeed(id: SpacecraftId, when: When): number {
  return length(spacecraftVelocity(id, when));
}

/**
 * A craft's distance from the Sun at a moment, in kilometres.
 *
 * @param id - The craft.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The distance.
 *
 * @example
 * ```ts
 * import { loadSpacecraft, spacecraftSunDistance } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * await loadSpacecraft("parker");
 * console.log((spacecraftSunDistance("parker", Date.UTC(2024, 11, 24, 11, 53)) / 1e6).toFixed(1), "million km");
 * ```
 */
export function spacecraftSunDistance(id: SpacecraftId, when: When): number {
  return length(spacecraftPosition(id, when));
}

/**
 * A craft's distance from the Earth's centre at a moment, in kilometres: the craft's path from Horizons and the Earth from VSOP87B (a few thousand kilometres at most), both for the same instant, with no allowance for the light's travel.
 *
 * @param id - The craft.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The distance.
 *
 * @example
 * ```ts
 * import { loadSpacecraft, spacecraftEarthDistance } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * await loadSpacecraft("webb");
 * console.log((spacecraftEarthDistance("webb", Date.UTC(2026, 10, 8)) / 1e6).toFixed(2), "million km");
 * ```
 */
export function spacecraftEarthDistance(id: SpacecraftId, when: When): number {
  const ms = moment(when);
  return length(sub(spacecraftPosition(id, ms), scale(heliocentric("earth", ms), AU_KM)));
}

/**
 * How long a radio signal takes from the Earth to a craft (or back), at a moment, in seconds: the distance from the Earth over the speed of light.
 *
 * @param id - The craft.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns One-way light time in seconds.
 *
 * @example
 * ```ts
 * import { loadSpacecraft, spacecraftLightTime } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * await loadSpacecraft("voyager1");
 * console.log((spacecraftLightTime("voyager1", Date.UTC(2026, 10, 8)) / 3600).toFixed(1), "hours");
 * ```
 */
export function spacecraftLightTime(id: SpacecraftId, when: When): number {
  return spacecraftEarthDistance(id, when) / LIGHT_KM_PER_SECOND;
}

/**
 * The worst error of a craft's loaded path against Horizons, in kilometres, as measured when it was made: on samples held back from the fit and on fresh samples at random times. It grows with the craft's distance from the Sun (a millionth of it in cruise), and is 1,000 km or better near a planet.
 *
 * @param id - The craft.
 * @returns The error in kilometres.
 *
 * @example
 * ```ts
 * import { loadSpacecraft, spacecraftErrorKm } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * await loadSpacecraft("juno");
 * console.log(spacecraftErrorKm("juno") < 1000);
 * ```
 */
export function spacecraftErrorKm(id: SpacecraftId): number {
  const table = craftTable(id);
  if (table === undefined) throw new Error(`the path of ${facts(id).name.en} is not loaded: await loadSpacecraft(${JSON.stringify(id)}) first`);
  return table.worst;
}
