// Where the Sun, the Moon and the planets are in the sky at a moment, for a star chart or a "tonight" page: right ascension and declination of date and of J2000, distance, apparent magnitude, size, phase, elongation from the Sun and,
// for a place, azimuth and altitude. Pure: no DOM, no clock read, no three.js; the moment is passed in. It is the package's own positions packaged: the Sun and the Moon from the sky engine (`/suncalc`'s), the planets from VSOP87B
// (Pluto from its table) with light time and the annual aberration, the same turn from the ecliptic of J2000 to the true equator of date, and the observer's parallax and sidereal time of the engine.
import { julianCenturies } from "./clock.ts";
import { heliocentric, moonGeocentric, poleOf } from "./ephemeris.ts";
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
 * Where a body is in the sky of a place: azimuth in degrees from north through east (0 to 360), altitude in degrees (geometric, parallax in, no refraction) and with the standard refraction (`apparentAltitude`),
 * the hour angle (degrees, 0 on the meridian, positive west) and the parallactic angle.
 *
 * @example
 * ```ts no-run
 * import type { SkyHorizontal } from "@johnmorrisdotca/wakusei-planets/sky-bodies";
 *
 * const up = (h: SkyHorizontal): boolean => h.apparentAltitude > 0;
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
  // the annual aberration: the Earth's speed over the speed of light moves the apparent direction toward where the Earth is heading
  const later = earthPosition(ms + 60_000) as Vec;
  const beta: Vec = [(later[0] - earth[0]) / 60 / (LIGHT_KM_S / AU_KM), (later[1] - earth[1]) / 60 / (LIGHT_KM_S / AU_KM), (later[2] - earth[2]) / 60 / (LIGHT_KM_S / AU_KM)];
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
      return i <= 50 ? distance - 1.601 + 0.02267 * i - 0.0001302 * i ** 2 : distance - 0.367 - 0.02573 * i + 0.0003445 * i ** 2;
    case "jupiter": {
      if (i <= 12) return distance - 9.395 - 3.7e-4 * i + 6.16e-4 * i ** 2;
      const a = i / 180;
      return distance - 9.428 - 2.5 * Math.log10(1 - 1.507 * a - 0.363 * a ** 2 - 0.062 * a ** 3 + 2.809 * a ** 4 - 1.876 * a ** 5);
    }
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
  let body: Omit<SkyBody, "horizontal" | "aboveHorizon" | "id" | "name">;
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
    j2000 = j2000Equatorial(retarded);
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
  const out: SkyBody = { ...base, ...body } as SkyBody;
  if (id !== "sun") {
    out.elongationDeg = Math.acos(Math.max(-1, Math.min(1, dot(geoDirection, sunGeo)))) * DEG;
    // east of the Sun: its ecliptic longitude is ahead, by less than half a turn
    const ahead = wrap360(Math.atan2(geoDirection[1], geoDirection[0]) * DEG - Math.atan2(sunGeo[1], sunGeo[0]) * DEG);
    out.east = ahead < 180;
  }
  if (observer !== undefined) {
    const h = horizontalOf(equatorial, ms, observer);
    const apparent = h.altitude + refraction(h.altitude);
    out.horizontal = { azimuthDeg: h.azimuth, altitudeDeg: h.altitude, apparentAltitudeDeg: apparent, hourAngleDeg: h.hourAngle, parallacticAngleDeg: h.parallacticAngle };
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
  return bodyAt(id, moment(when), observer);
}

/**
 * Where the Sun, the Moon and the planets (and Pluto) are in the sky at a moment: right ascension and declination of date and of J2000, distance, apparent magnitude, angular diameter, phase and elongation from the Sun,
 * and, when a place is given, azimuth and altitude (the Moon's parallax in). Pure: the moment is passed in, nothing reads a clock. The list is plain data in the order `SKY_BODY_IDS`: a star chart takes it as data the page
 * passes in, it does not import this package. Rise, set and transit are in `/suncalc`.
 *
 * Accuracy, as the tests prove it against JPL Horizons on three dates (2024-03-20, 2026-06-21, 2030-12-01) and two places: the Sun, the planets and Pluto are within 0.1 arcminute in right ascension and declination, of date and of J2000;
 * the Moon within 0.05 arcminute of date and 0.3 of J2000; the distance-derived diameters within 0.1 per cent; the illuminated fraction within 0.02 per cent points and the elongation within 0.02 degrees; azimuth and altitude within
 * 0.1 arcminute, the Moon's parallax in. Magnitudes: within 0.02 for the Sun, Mercury, Venus, Jupiter and Saturn, 0.03 for Uranus and Neptune, 0.06 for the Moon, 0.1 for Mars (its surface markings are not modelled) and 0.5 for Pluto
 * (a fixed absolute magnitude, no more). Angles are degrees, distances astronomical units, sizes arcseconds.
 *
 * @param when - The moment: a `Date` or milliseconds since 1970 (UTC).
 * @param observer - The place: `latitude` degrees north, `longitude` degrees east, `heightM` metres (optional).
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
  const ms = moment(when);
  return SKY_BODY_IDS.map((id) => bodyAt(id, ms, observer));
}
