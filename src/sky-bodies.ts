// Where the Sun, the Moon and the planets are in the sky at a moment, for a star chart or a "tonight" page: right ascension and declination of date and of J2000, distance, apparent magnitude, size, phase, elongation from the Sun and,
// for a place, azimuth and altitude. Pure: no DOM, no clock read, no three.js; the moment is passed in. It is the package's own positions packaged: the Sun and the Moon from the sky engine (`/suncalc`'s), the planets from VSOP87B
// (Pluto from its table) with light time and the annual aberration, the same turn from the ecliptic of J2000 to the true equator of date, and the observer's parallax and sidereal time of the engine.
import { julianCenturies } from "./clock.ts";
import { heliocentric, heliocentricModel, moonGeocentric, poleOf } from "./ephemeris.ts";
import { BODIES } from "./facts.ts";
import { horizontalOf, moonEquatorial, moonPhase, refraction, sunEquatorial, type Equatorial } from "./sky/engine.ts";
import { eclipticJ2000ToTrueEquatorialOfDate } from "./sky/frames.ts";
import { moment } from "./sky/events.ts";
import { meanObliquityArcseconds } from "./sidereal.ts";
import { earthPosition } from "./theory.ts";
import type { Observer } from "./sky/types.ts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const AU_KM = 149597870.7;
const LIGHT_KM_S = 299792.458;
/** The days light takes to cross an astronomical unit. */
const LIGHT_DAYS_PER_AU = AU_KM / LIGHT_KM_S / 86400;
const OBLIQUITY_J2000 = (meanObliquityArcseconds(0) * Math.PI) / 648000;
const SUN_RADIUS_KM = 695700;
/** Within this many degrees of the zenith (0.36 arcseconds), and of a pole, the azimuth and the parallactic angle are 0: they are not defined there. */
const ZENITH_EPSILON_DEG = 1e-4;
const POLE_EPSILON_DEG = 1e-9;

type Vec = readonly [number, number, number];
const length = (v: Vec): number => Math.hypot(v[0], v[1], v[2]);
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Vec): Vec => {
  const l = length(v);
  return l === 0 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
};
const wrap360 = (a: number): number => ((a % 360) + 360) % 360;

/**
 * The moments the calls accept, in milliseconds since 1970: from 1750-01-01 to 2250-01-01 UTC, the years the package's own checks hold the planet series (VSOP87B) and the rest to (the accuracy guide: the series
 * "is good for the years 1750 to 2250 and slowly gets worse beyond"). A moment outside them throws a `RangeError` naming the range, so a number out of range is never returned as if it were good.
 *
 * @example
 * ```ts
 * import { SKY_RANGE } from "@johnmorrisdotca/wakusei-planets/sky-bodies";
 *
 * console.log(new Date(SKY_RANGE.from).getUTCFullYear(), new Date(SKY_RANGE.to).getUTCFullYear());
 * ```
 */
export const SKY_RANGE = { from: Date.UTC(1750, 0, 1), to: Date.UTC(2250, 0, 1) } as const;

/** The moment in milliseconds, held to {@link SKY_RANGE}. */
function inRange(when: Date | number): number {
  const ms = moment(when);
  if (ms < SKY_RANGE.from || ms >= SKY_RANGE.to) throw new RangeError("the sky is worked out for the years 1750 to 2250 only (from 1750-01-01 to 2250-01-01 UTC), the years the planet series is held to");
  return ms;
}

/** The place held to what it means: a latitude from -90 to 90 and a longitude and a height that are numbers, else a `RangeError` (a bad place never comes back as NaN fields). */
function checkObserver(observer: Observer | undefined): void {
  if (observer === undefined) return;
  if (observer === null || typeof observer !== "object") throw new RangeError("the observer must be { latitude, longitude, heightM? }");
  if (!Number.isFinite(observer.latitude) || observer.latitude < -90 || observer.latitude > 90) throw new RangeError(`the latitude must be a number from -90 to 90 degrees, got ${String(observer.latitude)}`);
  if (!Number.isFinite(observer.longitude)) throw new RangeError(`the longitude must be a finite number of degrees, got ${String(observer.longitude)}`);
  if (observer.heightM !== undefined && !Number.isFinite(observer.heightM)) throw new RangeError(`the height must be a finite number of metres, got ${String(observer.heightM)}`);
}

/**
 * The names of the bodies `skyBodies` gives, in its order.
 *
 * @example
 * ```ts
 * import { SKY_BODY_IDS } from "@johnmorrisdotca/wakusei-planets/sky-bodies";
 *
 * console.log(SKY_BODY_IDS.length, SKY_BODY_IDS[1]);
 * ```
 */
export const SKY_BODY_IDS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
/**
 * The name of a body in the sky list.
 *
 * @example
 * ```ts
 * import { skyBody, type SkyBodyId } from "@johnmorrisdotca/wakusei-planets/sky-bodies";
 *
 * const id: SkyBodyId = "venus";
 * console.log(skyBody(id, Date.UTC(2026, 5, 21, 12)).name.en);
 * ```
 */
export type SkyBodyId = (typeof SKY_BODY_IDS)[number];

/**
 * Where a body is in the sky of a place: azimuth in degrees from north through east (0 to 360; 0 where it is not defined, at the zenith and the nadir and at a pole), altitude in degrees (geometric, parallax in, no refraction) and with the standard refraction (`apparentAltitude`),
 * the hour angle (degrees, 0 on the meridian, positive west) and the parallactic angle.
 *
 * @example
 * ```ts no-run
 * import type { SkyHorizontal } from "@johnmorrisdotca/wakusei-planets/sky-bodies";
 *
 * const up = (h: SkyHorizontal): boolean => h.apparentAltitudeDeg > 0;
 * console.log(typeof up);
 * ```
 */
export interface SkyHorizontal {
  azimuthDeg: number;
  altitudeDeg: number;
  apparentAltitudeDeg: number;
  hourAngleDeg: number;
  parallacticAngleDeg: number;
}

/**
 * One body of the sky list. Angles are degrees, distances astronomical units (and kilometres), sizes arcseconds. `equatorialDate` is the apparent place of date (the true equator and equinox of the moment, aberration and
 * nutation in), `equatorialJ2000` the same direction without aberration in the J2000 equatorial frame (what a chart on J2000 reads). The places are the Earth's centre's; `horizontal` is the place's.
 *
 * @example
 * ```ts no-run
 * import type { SkyBody } from "@johnmorrisdotca/wakusei-planets/sky-bodies";
 *
 * const bright = (list: SkyBody[]): SkyBody[] => list.filter((body) => body.magnitude < 2);
 * console.log(typeof bright);
 * ```
 */
export interface SkyBody {
  id: SkyBodyId;
  name: { en: string; ja: string };
  kind: "star" | "moon" | "planet" | "dwarf";
  /**
   * Whether the figures hold to the stated accuracy: `true` for every body inside the range the call accepts, except Pluto outside its fitted table (1800 to 2199), where its place comes from an approximate
   * orbit that is wrong by degrees: it is returned, with `accurate: false`, so one body does not break the list.
   */
  accurate: boolean;
  equatorialDate: { rightAscensionDeg: number; declinationDeg: number };
  equatorialJ2000: { rightAscensionDeg: number; declinationDeg: number };
  distanceAu: number;
  distanceKm: number;
  /** The apparent visual magnitude (Saturn's with its rings). */
  magnitude: number;
  angularDiameterArcsec: number;
  /** The Sun-body-Earth angle in degrees (0 full, 180 new). */
  phaseAngleDeg: number;
  illuminatedFraction: number;
  /** Degrees from the Sun, and which side: `east` is the evening side (the body follows the Sun). Left out for the Sun. */
  elongationDeg?: number;
  east?: boolean;
  /** The Moon only: the phase (0 new to 1, one cycle), waxing, and the bright limb's position angle in degrees eastward from north. */
  moon?: { phase: number; waxing: boolean; brightLimbAngleDeg: number };
  /** With an observer: where the body is in that place's sky. */
  horizontal?: SkyHorizontal;
  /** With an observer: the body's middle is above the horizon (the apparent altitude, with refraction, is above 0). */
  aboveHorizon?: boolean;
}

const equatorialOf = (v: Vec): { rightAscensionDeg: number; declinationDeg: number } => ({ rightAscensionDeg: wrap360(Math.atan2(v[1], v[0]) * DEG), declinationDeg: Math.asin(Math.max(-1, Math.min(1, v[2] / length(v)))) * DEG });
/** A J2000 ecliptic vector in the J2000 equatorial frame. */
const j2000Equatorial = (v: Vec): Vec => [v[0], v[1] * Math.cos(OBLIQUITY_J2000) - v[2] * Math.sin(OBLIQUITY_J2000), v[1] * Math.sin(OBLIQUITY_J2000) + v[2] * Math.cos(OBLIQUITY_J2000)];

/** The annual aberration: the Earth's speed over the speed of light, a vector in the J2000 ecliptic that moves the apparent direction toward where the Earth is heading. */
function earthBeta(ms: number): Vec {
  const earth = earthPosition(ms) as Vec;
  const later = earthPosition(ms + 60_000) as Vec;
  return [(later[0] - earth[0]) / 60 / (LIGHT_KM_S / AU_KM), (later[1] - earth[1]) / 60 / (LIGHT_KM_S / AU_KM), (later[2] - earth[2]) / 60 / (LIGHT_KM_S / AU_KM)];
}

/** A planet as the Earth's centre sees it at `ms`: its direction in the J2000 ecliptic with light time, the same with the Earth's aberration, its distance and its distance from the Sun at the moment the light left it. */
function planetGeometry(id: "mercury" | "venus" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune" | "pluto", ms: number): { geo: Vec; aberrated: Vec; distanceAu: number; sunAu: number; helio: Vec } {
  const earth = earthPosition(ms) as Vec;
  let tau = 0;
  let helio = heliocentric(id, ms) as Vec;
  for (let k = 0; k < 4; k += 1) {
    helio = heliocentric(id, ms - tau * 86_400_000) as Vec;
    tau = length(sub(helio, earth)) * LIGHT_DAYS_PER_AU;
  }
  const geo = sub(helio, earth);
  const distanceAu = length(geo);
  const beta = earthBeta(ms);
  const direction = unit(geo);
  return { geo, aberrated: [direction[0] + beta[0], direction[1] + beta[1], direction[2] + beta[2]], distanceAu, sunAu: length(helio), helio };
}

/** The planetocentric latitude, degrees, of the direction from a planet to a point (the Earth or the Sun), north positive: how open its equator, or its rings, are to that point. */
const latitudeToward = (id: SkyBodyId, helio: Vec, point: Vec): number => Math.asin(Math.max(-1, Math.min(1, dot(poleOf(id), unit(sub(point, helio)))))) * DEG;

/** The apparent visual magnitude of a planet from the Astronomical Almanac's formulas, as Mallama and Hilton (2018) give them, for the phase angle `i` in degrees; `r` and `delta` in au. */
function planetMagnitude(id: SkyBodyId, i: number, r: number, delta: number, helio: Vec, earth: Vec): number {
  const distance = 5 * Math.log10(r * delta);
  switch (id) {
    case "mercury":
      return distance - 0.613 + 6.328e-2 * i - 1.6336e-3 * i ** 2 + 3.3644e-5 * i ** 3 - 3.4265e-7 * i ** 4 + 1.6893e-9 * i ** 5 - 3.0334e-12 * i ** 6;
    case "venus":
      return i <= 163.7 ? distance - 4.384 - 1.044e-3 * i + 3.687e-4 * i ** 2 - 2.814e-6 * i ** 3 + 8.938e-9 * i ** 4 : distance + 236.05828 - 2.81914 * i + 8.39034e-3 * i ** 2;
    case "mars":
      // the paper's second formula (beyond 50 degrees) is not here: the Earth never sees Mars more than about 47 degrees from full
      return distance - 1.601 + 0.02267 * i - 0.0001302 * i ** 2;
    case "jupiter":
      // the paper's formula for the first 12 degrees; the Earth never sees Jupiter past 12 degrees of phase, so the formula for beyond is not here
      return distance - 9.395 - 3.7e-4 * i + 6.16e-4 * i ** 2;
    case "saturn": {
      // the globe and its rings, as the Almanac gives it (Mallama 2012, the paper's Eq. 10): the rings brighten it with how open they are to the Earth and to the Sun; the angle never passes 6.5 degrees from the Earth
      const earthLatitude = latitudeToward("saturn", helio, earth);
      const sunLatitude = latitudeToward("saturn", helio, [0, 0, 0]);
      const tilt = earthLatitude * sunLatitude > 0 ? Math.sqrt(earthLatitude * sunLatitude) * RAD : 0;
      return distance - 8.914 - 1.825 * Math.sin(tilt) + 0.026 * i - 0.378 * Math.sin(tilt) * Math.exp(-2.25 * i);
    }
    case "uranus": {
      // the planetographic latitudes of the Earth and of the Sun: the poles are brighter (flattening 0.0022927)
      const graphic = (centric: number): number => Math.atan(Math.tan(centric * RAD) / (1 - 0.0022927) ** 2) * DEG;
      const mean = (Math.abs(graphic(latitudeToward("uranus", helio, earth))) + Math.abs(graphic(latitudeToward("uranus", helio, [0, 0, 0])))) / 2;
      return distance - 7.11 - 8.4e-4 * mean + 6.587e-3 * i + 1.045e-4 * i ** 2;
    }
    case "neptune":
      // the brightness after 2000 (the paper's Eq. 16 gives the constant for the years before as well)
      return distance - 7.0 + 7.944e-3 * i + 9.617e-5 * i ** 2;
    case "pluto":
      // JPL's absolute magnitude for Pluto (H = -0.55): no phase term, the angle never passes 2 degrees
      return distance - 0.55;
    default:
      return distance;
  }
}

function bodyAt(id: SkyBodyId, ms: number, observer: Observer | undefined): SkyBody {
  const facts = BODIES[id];
  const base = { id, name: { en: facts.name.en, ja: facts.name.ja } };
  let equatorial: Equatorial;
  let j2000: Vec;
  let body: Omit<SkyBody, "horizontal" | "aboveHorizon" | "id" | "name" | "accurate">;
  const earth = earthPosition(ms) as Vec;
  const sunGeo = unit([-earth[0], -earth[1], -earth[2]]);
  const T = julianCenturies(ms);
  let geoDirection: Vec;
  if (id === "sun") {
    equatorial = sunEquatorial(ms);
    geoDirection = sunGeo;
    j2000 = j2000Equatorial(sunGeo);
    const distanceKm = equatorial.distanceKm;
    body = {
      kind: "star",
      equatorialDate: { rightAscensionDeg: equatorial.rightAscension, declinationDeg: equatorial.declination },
      equatorialJ2000: equatorialOf(j2000),
      distanceAu: distanceKm / AU_KM,
      distanceKm,
      magnitude: -26.74 + 5 * Math.log10(distanceKm / AU_KM),
      angularDiameterArcsec: 2 * Math.asin(SUN_RADIUS_KM / distanceKm) * DEG * 3600,
      phaseAngleDeg: 0,
      illuminatedFraction: 1,
    };
  } else if (id === "moon") {
    equatorial = moonEquatorial(ms);
    const first = moonGeocentric(ms) as Vec;
    const retarded = moonGeocentric(ms - (length(first) / LIGHT_KM_S) * 1000) as Vec;
    geoDirection = unit(retarded);
    // The Moon's series of this package gives the direction with the Earth's aberration already in it (its place of date agrees with JPL Horizons' apparent place to under an arcsecond, and with the aberration
    // taken out its J2000 place agrees with Horizons' astrometric (ICRF) place to 0.7 arcsecond; left in, it is 1 to 13 arcseconds off, the size and the pattern of the annual aberration). So the J2000 direction,
    // which has none, is the retarded one with the aberration taken out.
    const beta = earthBeta(ms);
    const direction = unit(retarded);
    j2000 = j2000Equatorial(unit([direction[0] - beta[0], direction[1] - beta[1], direction[2] - beta[2]]));
    const phase = moonPhase(ms);
    const phaseAngle = Math.acos(Math.max(-1, Math.min(1, 2 * phase.fraction - 1))) * DEG;
    const distanceKm = equatorial.distanceKm;
    body = {
      kind: "moon",
      equatorialDate: { rightAscensionDeg: equatorial.rightAscension, declinationDeg: equatorial.declination },
      equatorialJ2000: equatorialOf(j2000),
      distanceAu: distanceKm / AU_KM,
      distanceKm,
      // the usual phase law of the Moon's V magnitude, at its mean distance of 384,400 km
      magnitude: -12.73 + 0.026 * phaseAngle + 4e-9 * phaseAngle ** 4 + 5 * Math.log10(distanceKm / 384_400),
      angularDiameterArcsec: 2 * Math.asin(facts.radiusKm / distanceKm) * DEG * 3600,
      phaseAngleDeg: phaseAngle,
      illuminatedFraction: phase.fraction,
      moon: { phase: phase.phase, waxing: phase.waxing, brightLimbAngleDeg: phase.angle },
    };
  } else {
    const g = planetGeometry(id, ms);
    geoDirection = unit(g.geo);
    j2000 = j2000Equatorial(g.geo);
    const dateVector = eclipticJ2000ToTrueEquatorialOfDate(g.aberrated, T);
    equatorial = { rightAscension: wrap360(Math.atan2(dateVector[1], dateVector[0]) * DEG), declination: Math.asin(dateVector[2] / length(dateVector)) * DEG, distanceKm: g.distanceAu * AU_KM };
    const earthSun = length(earth);
    const cosPhase = (g.sunAu ** 2 + g.distanceAu ** 2 - earthSun ** 2) / (2 * g.sunAu * g.distanceAu);
    const phaseAngle = Math.acos(Math.max(-1, Math.min(1, cosPhase))) * DEG;
    body = {
      kind: id === "pluto" ? "dwarf" : "planet",
      equatorialDate: { rightAscensionDeg: equatorial.rightAscension, declinationDeg: equatorial.declination },
      equatorialJ2000: equatorialOf(j2000),
      distanceAu: g.distanceAu,
      distanceKm: g.distanceAu * AU_KM,
      magnitude: planetMagnitude(id, phaseAngle, g.sunAu, g.distanceAu, g.helio, earth),
      angularDiameterArcsec: 2 * Math.asin(facts.radiusKm / (g.distanceAu * AU_KM)) * DEG * 3600,
      phaseAngleDeg: phaseAngle,
      illuminatedFraction: (1 + cosPhase) / 2,
    };
  }
  // Pluto is from a table fitted for 1800 to 2199; outside it the package falls back on an approximate orbit that is off by degrees
  const accurate = id !== "pluto" || heliocentricModel("pluto", ms).theory === "chebyshev";
  const out: SkyBody = { ...base, ...body, accurate } as SkyBody;
  if (id !== "sun") {
    out.elongationDeg = Math.acos(Math.max(-1, Math.min(1, dot(geoDirection, sunGeo)))) * DEG;
    // the evening side: its right ascension is ahead of the Sun's by less than half a turn, so it crosses the meridian and sets after the Sun (JPL Horizons' "trailing", /T). Close to the Sun, where a planet
    // has a large ecliptic latitude (Venus near its inferior conjunction), this is the side in the sky and not the side in ecliptic longitude.
    out.east = wrap360(equatorial.rightAscension - sunEquatorial(ms).rightAscension) < 180;
  }
  if (observer !== undefined) {
    const h = horizontalOf(equatorial, ms, observer);
    const apparent = h.altitude + refraction(h.altitude);
    // At the zenith (or the nadir) every direction is the same, and at a pole every direction is south (or north): the azimuth and the parallactic angle are not defined there, and the arithmetic gives
    // 0 or 180 by rounding noise, and an azimuth that depends on the longitude at a pole. They are 0 there, always.
    const atZenith = Math.abs(h.altitude) >= 90 - ZENITH_EPSILON_DEG;
    const atPole = Math.abs(observer.latitude) >= 90 - POLE_EPSILON_DEG;
    out.horizontal = { azimuthDeg: atZenith || atPole ? 0 : h.azimuth, altitudeDeg: h.altitude, apparentAltitudeDeg: apparent, hourAngleDeg: h.hourAngle, parallacticAngleDeg: atZenith || atPole ? 0 : h.parallacticAngle };
    out.aboveHorizon = apparent > 0;
  }
  return out;
}

/**
 * One body of the sky list at a moment, for a place when one is given. See {@link skyBodies}.
 *
 * @param id - The body: `sun`, `moon`, `mercury` to `neptune`, or `pluto`.
 * @param when - The moment: a `Date` or milliseconds since 1970 (UTC).
 * @param observer - The place, if any.
 * @returns The body.
 *
 * @example
 * ```ts
 * import { skyBody } from "@johnmorrisdotca/wakusei-planets/sky-bodies";
 *
 * const mars = skyBody("mars", Date.UTC(2026, 5, 21, 12), { latitude: 35.69, longitude: 139.69 });
 * console.log(mars.name.en, mars.aboveHorizon);
 * ```
 */
export function skyBody(id: SkyBodyId, when: Date | number, observer?: Observer): SkyBody {
  if (!(SKY_BODY_IDS as readonly string[]).includes(id)) throw new RangeError(`unknown body: ${String(id)}`);
  checkObserver(observer);
  return bodyAt(id, inRange(when), observer);
}

/**
 * Where the Sun, the Moon and the planets (and Pluto) are in the sky at a moment: right ascension and declination of date and of J2000, distance, apparent magnitude, angular diameter, phase and elongation from the Sun,
 * and, when a place is given, azimuth and altitude (the Moon's parallax in). Pure: the moment is passed in, nothing reads a clock. The list is plain data in the order `SKY_BODY_IDS`: a star chart takes it as data the page
 * passes in, it does not import this package. Rise, set and transit are in `/suncalc`.
 *
 * Every body has `accurate`: true where the figures hold to the accuracy below; Pluto outside the years its table is fitted for (1800 to 2199) is returned with `accurate: false`, because its place there is from an approximate orbit that can be wrong by degrees.
 *
 * Accuracy, as the tests prove it, CHECKED against JPL Horizons on three dates, 2024-03-20, 2026-06-21 and 2030-12-01 (2024 to 2030 only), and two places; the series are held to it for the years 1750 to 2250 by the package's own checks, and a moment outside those years throws a `RangeError` ({@link SKY_RANGE}). Within them: the Sun, the planets and Pluto are within 0.1 arcminute in right ascension and declination, of date and of J2000;
 * the Moon within 0.02 arcminute of date and 0.015 of J2000; the distance-derived diameters within 0.1 per cent; the illuminated fraction within 0.02 per cent points and the elongation within 0.02 degrees; azimuth and altitude within
 * 0.1 arcminute, the Moon's parallax in. Magnitudes: within 0.02 for the Sun, Mercury, Venus, Jupiter and Saturn, 0.03 for Uranus and Neptune, 0.06 for the Moon, 0.1 for Mars (its surface markings are not modelled) and 0.5 for Pluto
 * (a fixed absolute magnitude, no more). Angles are degrees, distances astronomical units, sizes arcseconds.
 *
 * @param when - The moment: a `Date` or milliseconds since 1970 (UTC).
 * @param observer - The place: `latitude` degrees north (from -90 to 90), `longitude` degrees east (any finite number), `heightM` metres (optional, finite); anything else throws a `RangeError`.
 * @returns The ten bodies, the Sun first.
 *
 * @example
 * ```ts
 * import { skyBodies } from "@johnmorrisdotca/wakusei-planets/sky-bodies";
 *
 * const tonight = skyBodies(Date.UTC(2026, 5, 21, 12), { latitude: 35.69, longitude: 139.69, heightM: 40 });
 * console.log(tonight.filter((body) => body.aboveHorizon).map((body) => body.id));
 * ```
 */
export function skyBodies(when: Date | number, observer?: Observer): SkyBody[] {
  checkObserver(observer);
  const ms = inRange(when);
  return SKY_BODY_IDS.map((id) => bodyAt(id, ms, observer));
}
