// The stars you can see without a telescope: the 5,080 of the Yale Bright Star Catalogue to visual magnitude 6.0, with their names, positions, proper motion, brightness and colour.
// An opt-in entry point (`@johnmorrisdotca/wakusei-planets/stars`): the table is about 100 kB gzipped and nothing else imports it. Pure: no DOM, no three.js, no state beyond the parsed table.
import { J2000_MS } from "./clock.ts";
import { blackBodyRgb } from "./blackbody.ts";
import { STAR_NAMES, STAR_ROWS } from "./data/stars.ts";
import { moment, type When } from "./when.ts";

/**
 * One star, as the Yale Bright Star Catalogue gives it. Positions are J2000 (equator and equinox of 2000, the FK5 frame, which is the ICRS to a fraction of an arc-second).
 *
 * @example
 * ```ts
 * import { starByName, type Star } from "@johnmorrisdotca/wakusei-planets/stars";
 *
 * const sirius: Star = starByName("Sirius")!;
 * console.log(sirius.designation, sirius.magnitude);
 * ```
 */
export interface Star {
  /** The Bright Star Catalogue (Harvard Revised) number: stable, and the key for `starByHr`. */
  hr: number;
  /** The common name where the star has one (the IAU Working Group on Star Names' spelling), else `undefined`. */
  name: string | undefined;
  /** The Bayer letter and constellation (`α CMa`), else the Flamsteed number and constellation (`9 CMa`), else `undefined`. */
  designation: string | undefined;
  /** The IAU three-letter constellation abbreviation (`CMa`) where the star has a Bayer or Flamsteed name, else `undefined`. */
  constellation: string | undefined;
  /** Right ascension in degrees at J2000, 0 up to 360. The catalogue gives it to a tenth of a second of time (1.5 arc-seconds at the equator). */
  rightAscension: number;
  /** Declination in degrees at J2000, -90 to 90. The catalogue gives it to an arc-second. */
  declination: number;
  /** Visual magnitude: smaller is brighter, and Sirius is -1.46. */
  magnitude: number;
  /** The colour index B-V in magnitudes, or `undefined` where the catalogue has none. Hot blue stars are about -0.3, the Sun 0.65, cool red stars above 1.5. */
  colourIndex: number | undefined;
  /** The spectral class and subclass (`A1`, `K1`), or an empty string where the catalogue gives none we read. */
  spectralClass: string;
  /** Proper motion in right ascension, in milliarcseconds a year, already multiplied by cos(declination) (a true angle on the sky). */
  properMotionRaMas: number;
  /** Proper motion in declination, in milliarcseconds a year. */
  properMotionDecMas: number;
  /** The annual parallax in milliarcseconds; 0 where the catalogue has none (the distance is then unknown). */
  parallaxMas: number;
}

const stored: Star[] = [];
const byHr = new Map<number, Star>();
const byText = new Map<string, Star>();

function load(): void {
  if (stored.length > 0) return;
  for (const row of STAR_ROWS.split("\n")) {
    const p = row.split("|");
    const hr = Number(p[0]);
    const letter = p[1]!;
    const flamsteed = p[2]!;
    const constellation = p[3]!;
    const designation = constellation === "" ? undefined : `${letter !== "" ? letter : flamsteed} ${constellation}`;
    const star: Star = Object.freeze({
      hr,
      name: STAR_NAMES[hr],
      designation: letter === "" && flamsteed === "" ? undefined : designation,
      constellation: constellation === "" ? undefined : constellation,
      rightAscension: (Number(p[4]) / 2400),
      declination: Number(p[5]) / 3600,
      magnitude: Number(p[8]) / 100,
      colourIndex: p[9] === "" ? undefined : Number(p[9]) / 100,
      spectralClass: p[10]!,
      properMotionRaMas: Number(p[6]),
      properMotionDecMas: Number(p[7]),
      parallaxMas: Number(p[11]),
    });
    stored.push(star);
    byHr.set(hr, star);
    for (const text of [star.name, star.designation]) if (text !== undefined) byText.set(text.toLowerCase(), star);
  }
}

/**
 * The stars to a magnitude, brightest first. The catalogue stops at magnitude 6.0, so the default is all 5,080.
 *
 * @param options - `magnitude`: the faintest to include (a star of exactly that magnitude is in). Brighter limits give shorter lists: 1.5 is 15 stars, 4 is 518, 5 is 1,630.
 * @returns A fresh array of the shared, frozen stars.
 *
 * @example
 * ```ts
 * import { stars } from "@johnmorrisdotca/wakusei-planets/stars";
 *
 * console.log(stars().length, stars({ magnitude: 2 }).map((s) => s.name ?? s.designation).slice(0, 3));
 * ```
 */
export function stars(options: { magnitude?: number } = {}): Star[] {
  load();
  const limit = options.magnitude ?? Number.POSITIVE_INFINITY;
  if (typeof limit !== "number" || Number.isNaN(limit)) throw new TypeError(`magnitude must be a number, got ${String(limit)}`);
  return stored.filter((star) => star.magnitude <= limit);
}

/**
 * A star by its Bright Star Catalogue number.
 *
 * @param hr - The HR number (Sirius is 2491).
 * @returns The star, or `undefined` if that number is not in this table (the table holds the stars to magnitude 6.0 only).
 *
 * @example
 * ```ts
 * import { starByHr } from "@johnmorrisdotca/wakusei-planets/stars";
 *
 * console.log(starByHr(2491)?.name);
 * ```
 */
export function starByHr(hr: number): Star | undefined {
  load();
  return byHr.get(hr);
}

/**
 * A star by its common name (`Sirius`) or its designation (`α CMa`, `9 CMa`), ignoring case.
 *
 * @param text - The name or designation.
 * @returns The star, or `undefined`.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/wakusei-planets/stars";
 *
 * console.log(starByName("betelgeuse")?.designation, starByName("α Lyr")?.name);
 * ```
 */
export function starByName(text: string): Star | undefined {
  load();
  return byText.get(text.trim().toLowerCase());
}

const JULIAN_YEAR_MS = 365.25 * 86_400_000;

/**
 * Where a star is at a moment: its J2000 position carried forward (or back) by its proper motion in a straight line. The frame stays J2000, so precession to the date is not applied: use
 * the result with J2000 coordinates, or convert it to the date with `/coordinates`. A straight line is good to a fraction of an arc-second for centuries for nearly every star here; it is
 * not good for the few with large motion over millennia.
 *
 * @param star - A star.
 * @param when - The moment as a `Date` or milliseconds since 1970 (UTC); J2000 when left out.
 * @returns Right ascension and declination in degrees, J2000 frame, at that moment.
 *
 * @example
 * ```ts
 * import { starByName, starPosition } from "@johnmorrisdotca/wakusei-planets/stars";
 *
 * const now = starPosition(starByName("Arcturus")!, Date.UTC(2026, 10, 7));
 * console.log(now.declination.toFixed(3));
 * ```
 */
export function starPosition(star: Star, when?: When): { rightAscension: number; declination: number } {
  const years = (moment(when ?? J2000_MS) - J2000_MS) / JULIAN_YEAR_MS;
  const declination = star.declination + (star.properMotionDecMas * years) / 3_600_000;
  const cosine = Math.cos((star.declination * Math.PI) / 180);
  // The motion is a true angle on the sky: it stretches by 1 / cos(declination) in right ascension. At the poles the division is kept finite.
  const rightAscension = star.rightAscension + (star.properMotionRaMas * years) / 3_600_000 / Math.max(Math.abs(cosine), 1e-6);
  return { rightAscension: ((rightAscension % 360) + 360) % 360, declination: Math.max(-90, Math.min(90, declination)) };
}

/**
 * A star's distance from its parallax, in light-years.
 *
 * @param star - A star.
 * @returns Light-years, or `undefined` where the catalogue has no parallax (or a non-positive one).
 *
 * @example
 * ```ts
 * import { starByName, starDistanceLightYears } from "@johnmorrisdotca/wakusei-planets/stars";
 *
 * console.log(starDistanceLightYears(starByName("Sirius")!)?.toFixed(1));
 * ```
 */
export function starDistanceLightYears(star: Star): number | undefined {
  return star.parallaxMas > 0 ? 3261.563777 / star.parallaxMas : undefined;
}

/**
 * The surface temperature a colour index implies, in kelvin, by Ballesteros's relation between B-V and a black body. It is an estimate to a few hundred kelvin for most stars, and it runs cool for the hottest (about 16,600 K at -0.3).
 *
 * @param colourIndex - B-V in magnitudes.
 * @returns Kelvin.
 *
 * @example
 * ```ts
 * import { starTemperatureK } from "@johnmorrisdotca/wakusei-planets/stars";
 *
 * console.log(Math.round(starTemperatureK(0.65)));
 * ```
 */
export function starTemperatureK(colourIndex: number): number {
  if (!Number.isFinite(colourIndex)) throw new RangeError(`colourIndex must be a finite number, got ${colourIndex}`);
  return 4600 * (1 / (0.92 * colourIndex + 1.7) + 1 / (0.92 * colourIndex + 0.62));
}

/**
 * The colour of a black body at a temperature, as a `#rrggbb` string, for drawing a star. It is the colour a camera would show, not a measurement, and it uses an approximation of the
 * black-body locus (good to a few percent between 1,000 and 40,000 K).
 *
 * @param kelvin - Temperature in kelvin.
 * @returns A colour like `#a4bdff`.
 *
 * @example
 * ```ts
 * import { blackBodyColour } from "@johnmorrisdotca/wakusei-planets/stars";
 *
 * console.log(blackBodyColour(10000), blackBodyColour(3500));
 * ```
 */
export function blackBodyColour(kelvin: number): string {
  if (!Number.isFinite(kelvin) || kelvin <= 0) throw new RangeError(`kelvin must be a positive number, got ${kelvin}`);
  const [red, green, blue] = blackBodyRgb(kelvin);
  const byte = (v: number): string => Math.round(v).toString(16).padStart(2, "0");
  return `#${byte(red)}${byte(green)}${byte(blue)}`;
}

/**
 * The colour to draw a star: from its B-V index, or a plain white where the catalogue has none.
 *
 * @param star - A star.
 * @returns A `#rrggbb` string.
 *
 * @example
 * ```ts
 * import { starByName, starColour } from "@johnmorrisdotca/wakusei-planets/stars";
 *
 * console.log(starColour(starByName("Betelgeuse")!), starColour(starByName("Rigel")!));
 * ```
 */
export function starColour(star: Star): string {
  return star.colourIndex === undefined ? "#ffffff" : blackBodyColour(starTemperatureK(star.colourIndex));
}
