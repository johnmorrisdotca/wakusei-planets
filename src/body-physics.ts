// What a physics model of a body needs, as data (MODULES-1553): mass and GM, surface gravity, the air at the surface, and the surface temperature, each figure with where it was read and the day it was read, and left out where the source has none. Every number is a fact
// read from NASA's planetary fact sheets (NSSDC, https://nssdc.gsfc.nasa.gov/planetary/factsheet/) on 2026-11-18, one page for each body, with the page's own "Last Updated" day beside it; no text of the pages is copied. Pure: no DOM, no clock reads, no three.js.

/**
 * The bodies that have a physics sheet: the Sun, the eight planets, Pluto and the Moon.
 *
 * @example
 * ```ts
 * import { PHYSICS_IDS } from "@johnmorrisdotca/wakusei-planets/body-physics";
 *
 * console.log(PHYSICS_IDS.join(", "));
 * ```
 */
export const PHYSICS_IDS = ["sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;

/**
 * The id of a body that has a physics sheet.
 *
 * @example
 * ```ts
 * import { PHYSICS_IDS, type PhysicsId } from "@johnmorrisdotca/wakusei-planets/body-physics";
 *
 * const id: PhysicsId = PHYSICS_IDS[3];
 * console.log(id);
 * ```
 */
export type PhysicsId = (typeof PHYSICS_IDS)[number];

/**
 * Where a figure was read: the page, the day the page says it was last updated, and the day it was read for this package.
 *
 * @example
 * ```ts
 * import { bodyPhysics, type PhysicsSource } from "@johnmorrisdotca/wakusei-planets/body-physics";
 *
 * const source: PhysicsSource = bodyPhysics("mars").mass!.source;
 * console.log(source.url, source.pageUpdated, source.read);
 * ```
 */
export interface PhysicsSource {
  name: string;
  url: string;
  /** The day the page says it was last updated (`2025-05-19`). */
  pageUpdated: string;
  /** The day the page was read for this package. */
  read: string;
}

/**
 * One figure: its number in SI units (or the unit named), where it comes from, how the source writes it, and what it holds at.
 *
 * `quoted` is the source's own wording of the figure where it is not a plain number (`"~0.016 +/- 0.006 kg/m3"`, `"1014 mb"`, `">>1000 bars"`). `bound` is `"below"` for a figure the source gives as an upper limit and `"about"` for one it marks approximate. `uncertainty`
 * is the +/- the source gives, in the same unit. `low` and `high` are the range it gives (a season, a day). `level` says where a figure holds when it is not the surface: `"1 bar"` for the gas giants, whose sheets give gravity, density and temperature at the 1 bar level, and
 * `"top of photosphere"` for the Sun's pressure.
 *
 * @example
 * ```ts
 * import { bodyPhysics, type PhysicsReading } from "@johnmorrisdotca/wakusei-planets/body-physics";
 *
 * const density: PhysicsReading = bodyPhysics("mars").airDensity!;
 * console.log(density.value, density.unit, density.uncertainty, density.quoted);
 * ```
 */
export interface PhysicsReading {
  value: number;
  unit: "kg" | "km3/s2" | "m/s2" | "kg/m3" | "Pa" | "K";
  source: PhysicsSource;
  quoted?: string;
  bound?: "below" | "about";
  uncertainty?: number;
  low?: number;
  high?: number;
  level?: string;
  note?: string;
}

/**
 * The physics of a body. Each field is `null` where the source has no figure: the Sun, Mercury, the Moon and Pluto have no air density, and the Moon and Pluto's sheets give a range of temperature and no single figure (it is in `temperature.low` and `high`, with `value` `null`).
 *
 * @example
 * ```ts
 * import { bodyPhysics, type BodyPhysics } from "@johnmorrisdotca/wakusei-planets/body-physics";
 *
 * const earth: BodyPhysics = bodyPhysics("earth");
 * console.log(earth.surfaceGravity?.value, earth.pressure?.value, earth.temperature?.value);
 * ```
 */
export interface BodyPhysics {
  id: PhysicsId;
  /** The mass in kilograms. */
  mass: PhysicsReading | null;
  /** The gravitational parameter GM in km3/s2. */
  gm: PhysicsReading | null;
  /** The surface gravity in m/s2: the mean at the surface, the Sun's at its equator, and the gas giants' at the 1 bar level. */
  surfaceGravity: PhysicsReading | null;
  /** The density of the air at the surface in kg/m3, or at the 1 bar level for the gas giants. */
  airDensity: PhysicsReading | null;
  /** The pressure at the surface in pascals, at the 1 bar level (100,000 Pa, the sheet's level) for the gas giants, or at the top of the Sun's photosphere. */
  pressure: PhysicsReading | null;
  /** The temperature in kelvin: the mean at the surface, the 1 bar level's for the gas giants, the Sun's effective temperature. `value` is `null` where the sheet gives only a range. */
  temperature: (Omit<PhysicsReading, "value"> & { value: number | null }) | null;
}

const READ = "2026-11-18";
const PAGE = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/";
const NAME: Record<PhysicsId, string> = { sun: "Sun", mercury: "Mercury", venus: "Venus", earth: "Earth", moon: "Moon", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto" };
// the day each page says it was last updated (its own "Last Updated" line)
const UPDATED: Record<PhysicsId, string> = {
  sun: "2024-05-09",
  mercury: "2024-01-11",
  venus: "2024-01-11",
  earth: "2024-11-15",
  moon: "2024-01-11",
  mars: "2025-05-19",
  jupiter: "2024-10-02",
  saturn: "2025-03-18",
  uranus: "2024-10-02",
  neptune: "2024-10-03",
  pluto: "2024-01-11",
};

// the figures as the sheets print them: mass in 10^24 kg, GM in 10^6 km3/s2, gravity in m/s2, density in kg/m3, pressure in bar (the Sun's in mb), temperature in K. `quote` is the sheet's own words where they are not a plain number.
interface Row {
  mass: number;
  gm: number;
  gravity: number;
  density?: { value: number; quoted: string; bound?: "about"; uncertainty?: number; level?: string };
  pressure?: { bar: number; quoted: string; bound?: "below" | "about"; low?: number; high?: number; level?: string; note?: string };
  temperature?: { value: number | null; quoted: string; bound?: "about"; low?: number; high?: number; level?: string; note?: string };
  gravityLevel?: string;
  gravityNote?: string;
}
const ROWS: Record<PhysicsId, Row> = {
  sun: {
    mass: 1_988_400,
    gm: 132_712,
    gravity: 274.0,
    gravityNote: "at the equator",
    pressure: { bar: 0.000868, quoted: "0.868 mb", level: "top of photosphere" },
    temperature: { value: 5772, quoted: "5772 K", level: "effective", note: "the effective temperature; 4400 K at the top of the photosphere and 6600 K at the bottom" },
  },
  mercury: {
    mass: 0.3301,
    gm: 0.022032,
    gravity: 3.7,
    pressure: { bar: 5e-15, quoted: "<~5 x 10-15 bar", bound: "below" },
    temperature: { value: 440, quoted: "440 K (167 C)", note: "the average; 590 to 725 K on the sunward side" },
  },
  venus: {
    mass: 4.8673,
    gm: 0.32486,
    gravity: 8.87,
    density: { value: 65, quoted: "~65. kg/m3", bound: "about" },
    pressure: { bar: 92, quoted: "92 bars" },
    temperature: { value: 737, quoted: "737 K (464 C)" },
  },
  earth: {
    mass: 5.9722,
    gm: 0.3986,
    gravity: 9.82,
    density: { value: 1.217, quoted: "1.217 kg/m3" },
    pressure: { bar: 1.014, quoted: "1014 mb" },
    temperature: { value: 288, quoted: "288 K (15 C)", low: 283, high: 293, note: "the average; the diurnal range is 283 to 293 K" },
  },
  moon: {
    mass: 0.07346,
    gm: 0.0049,
    gravity: 1.62,
    pressure: { bar: 3e-15, quoted: "3 x 10-15 bar", note: "at night" },
    temperature: { value: null, quoted: "95 K to 390 K", low: 95, high: 390, note: "the diurnal range at the equator" },
  },
  mars: {
    mass: 0.64169,
    gm: 0.042828,
    gravity: 3.73,
    density: { value: 0.016, quoted: "~0.016 +/- 0.006 kg/m3", bound: "about", uncertainty: 0.006 },
    pressure: { bar: 0.00636, quoted: "6.36 mb at mean radius (variable from 4.0 to 8.7 mb depending on season)", low: 0.004, high: 0.0087, note: "at the mean radius" },
    temperature: { value: 214, quoted: "~214 K (-59 C)", bound: "about", low: 184, high: 242, note: "the average; the diurnal range 184 to 242 K is at the Viking 1 lander site" },
  },
  jupiter: {
    mass: 1_898.13,
    gm: 126.687,
    gravity: 25.92,
    gravityLevel: "1 bar",
    density: { value: 0.16, quoted: "0.16 kg/m3", level: "1 bar" },
    pressure: { bar: 1, quoted: "1 bar", level: "1 bar", note: "the 1 bar level, where the sheet gives the gravity, density and temperature; it gives no surface" },
    temperature: { value: 165, quoted: "165 K (-108 C)", level: "1 bar" },
  },
  saturn: {
    mass: 568.32,
    gm: 37.931,
    gravity: 11.19,
    gravityLevel: "1 bar",
    density: { value: 0.19, quoted: "0.19 kg/m3", level: "1 bar" },
    pressure: { bar: 1, quoted: "1 bar", level: "1 bar", note: "the 1 bar level, where the sheet gives the gravity, density and temperature; it gives no surface" },
    temperature: { value: 134, quoted: "134 K (-139 C)", level: "1 bar" },
  },
  uranus: {
    mass: 86.811,
    gm: 5.794,
    gravity: 9.01,
    gravityLevel: "1 bar",
    density: { value: 0.42, quoted: "0.42 kg/m3", level: "1 bar" },
    pressure: { bar: 1, quoted: "1 bar", level: "1 bar", note: "the 1 bar level, where the sheet gives the gravity, density and temperature; it gives no surface" },
    temperature: { value: 76, quoted: "76 K (-197 C)", level: "1 bar" },
  },
  neptune: {
    mass: 102.409,
    gm: 6.8351,
    gravity: 11.27,
    gravityLevel: "1 bar",
    density: { value: 0.45, quoted: "0.45 kg/m3", level: "1 bar" },
    pressure: { bar: 1, quoted: "1 bar", level: "1 bar", note: "the 1 bar level, where the sheet gives the gravity, density and temperature; it gives no surface" },
    temperature: { value: 72, quoted: "72 K (-201 C)", level: "1 bar" },
  },
  pluto: {
    mass: 0.01303,
    gm: 0.00087,
    gravity: 0.62,
    pressure: { bar: 1.3e-5, quoted: "~13 microbar", bound: "about" },
    temperature: { value: null, quoted: "24 - 38 K (-247 - -233 C)", low: 24, high: 38 },
  },
};

const BAR_PA = 100_000;
/** A product written without the float noise of a scale (`0.00636 * 1e5` is not 636 to the last bit). */
const scaled = (value: number, factor: number): number => Number((value * factor).toPrecision(12));

/**
 * The physics of the Sun, a planet, Pluto or the Moon: its mass and GM, its surface gravity, the air at its surface and its surface temperature, each with the page and day it was read from, and `null` where the source has none (the Sun, Mercury, the Moon and Pluto have no air
 * density).
 *
 * @param id - `"sun"`, `"mercury"` to `"neptune"`, `"pluto"` or `"moon"`.
 * @returns The physics (a new object each call).
 * @throws {RangeError} For an id that has no physics sheet, naming it.
 *
 * @example
 * ```ts
 * import { bodyPhysics } from "@johnmorrisdotca/wakusei-planets/body-physics";
 *
 * const jupiter = bodyPhysics("jupiter");
 * console.log(jupiter.surfaceGravity?.value, jupiter.surfaceGravity?.level, jupiter.temperature?.value, jupiter.temperature?.source.read);
 * ```
 */
export function bodyPhysics(id: PhysicsId): BodyPhysics {
  if (!PHYSICS_IDS.includes(id)) throw new RangeError(`There is no physics sheet for "${String(id)}"; there is one for ${PHYSICS_IDS.join(", ")}.`);
  const row = ROWS[id];
  const source = (): PhysicsSource => ({ name: `NASA NSSDC Planetary Fact Sheet: ${NAME[id]}`, url: `${PAGE}${id}fact.html`, pageUpdated: UPDATED[id], read: READ });
  const mass: PhysicsReading = { value: scaled(row.mass, 1e24), unit: "kg", source: source() };
  const gm: PhysicsReading = { value: scaled(row.gm, 1e6), unit: "km3/s2", source: source() };
  const gravity: PhysicsReading = { value: row.gravity, unit: "m/s2", source: source(), ...(row.gravityLevel === undefined ? {} : { level: row.gravityLevel }), ...(row.gravityNote === undefined ? {} : { note: row.gravityNote }) };
  const d = row.density;
  const p = row.pressure;
  const t = row.temperature;
  return {
    id,
    mass,
    gm,
    surfaceGravity: gravity,
    airDensity:
      d === undefined
        ? null
        : { value: d.value, unit: "kg/m3", source: source(), quoted: d.quoted, ...(d.bound === undefined ? {} : { bound: d.bound }), ...(d.uncertainty === undefined ? {} : { uncertainty: d.uncertainty }), ...(d.level === undefined ? {} : { level: d.level }) },
    pressure:
      p === undefined
        ? null
        : {
            value: scaled(p.bar, BAR_PA),
            unit: "Pa",
            source: source(),
            quoted: p.quoted,
            ...(p.bound === undefined ? {} : { bound: p.bound }),
            ...(p.low === undefined ? {} : { low: scaled(p.low, BAR_PA) }),
            ...(p.high === undefined ? {} : { high: scaled(p.high, BAR_PA) }),
            ...(p.level === undefined ? {} : { level: p.level }),
            ...(p.note === undefined ? {} : { note: p.note }),
          },
    temperature:
      t === undefined
        ? null
        : { value: t.value, unit: "K", source: source(), quoted: t.quoted, ...(t.bound === undefined ? {} : { bound: t.bound }), ...(t.low === undefined ? {} : { low: t.low }), ...(t.high === undefined ? {} : { high: t.high }), ...(t.level === undefined ? {} : { level: t.level }), ...(t.note === undefined ? {} : { note: t.note }) },
  };
}
