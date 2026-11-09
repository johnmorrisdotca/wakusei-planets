// What the Sun and the Moon look like from a place on the Earth at a moment: apparent right ascension and declination of date, parallax, refraction, altitude and azimuth, the phase and the bright limb.
// Written from the standard methods (Meeus, "Astronomical Algorithms", chapters 12, 21, 22, 40, 48; the IAU 1976 precession; IAU 1980 nutation, its largest terms) on this package's own positions: the Sun from the Earth's VSOP87B place,
// the Moon from ELP2000-82B. Pure: no DOM, no three.js. Time is UTC in milliseconds; UT1 is taken as UTC (up to 0.9 s, 0.004 degrees of turn of the Earth); the theories run in terrestrial time.
import { earthPosition, moonGeocentric } from "../theory.ts";
import { julianCenturies } from "../clock.ts";
import { greenwichApparentSiderealTime as greenwichSiderealTime, nutation } from "../sidereal.ts";
import { eclipticJ2000ToTrueEquatorialOfDate } from "./frames.ts";
import type { Vec3 as Vec } from "../vec.ts";
import type { EquatorialAngles, HorizontalAngles, Observer } from "./types.ts";
export type { Observer } from "./types.ts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const AU_KM = 149597870.7;
const LIGHT_KM_S = 299792.458;
/** The Earth's equatorial radius in kilometres and its flattening (WGS 84). */
const EARTH_RADIUS_KM = 6378.137;
const EARTH_FLATTENING = 1 / 298.257223563;

/** A body's place on the sky of date, as the Earth's centre sees it (apparent: light time, aberration for the Sun, nutation): angles in degrees, distance in kilometres. */
export interface Equatorial extends EquatorialAngles {
  distanceKm: number;
}

/** Where a body is in a place's sky: azimuth 0 to 360 from north through east, altitude, the hour angle (0 on the meridian, positive west) and the parallactic angle, all in degrees. */
export interface Horizontal extends HorizontalAngles {
  hourAngle: number;
  parallacticAngle: number;
  /** The distance from the place to the body in kilometres. */
  distanceKm: number;
}

const toEquatorial = (v: Vec, distanceKm: number): Equatorial => ({
  rightAscension: ((Math.atan2(v[1], v[0]) * DEG) % 360 + 360) % 360,
  declination: Math.asin(Math.max(-1, Math.min(1, v[2] / Math.hypot(v[0], v[1], v[2])))) * DEG,
  distanceKm,
});

const fromEquatorial = (e: Equatorial): Vec => {
  const ra = e.rightAscension * RAD;
  const dec = e.declination * RAD;
  return [e.distanceKm * Math.cos(dec) * Math.cos(ra), e.distanceKm * Math.cos(dec) * Math.sin(ra), e.distanceKm * Math.sin(dec)];
};

/** The Sun as seen from the Earth's centre: the apparent place of date, with the annual aberration (the Earth's speed over the speed of light, about 20 arc-seconds) and nutation. */
export function sunEquatorial(ms: number): Equatorial {
  const T = julianCenturies(ms);
  const earth = earthPosition(ms);
  const later = earthPosition(ms + 60_000);
  const sun: Vec = [-earth[0], -earth[1], -earth[2]];
  const distanceAu = Math.hypot(sun[0], sun[1], sun[2]);
  // the Earth's velocity in au per second, over the speed of light in au per second, moves the apparent direction toward where the Earth is heading
  const beta: Vec = [(later[0] - earth[0]) / 60 / (LIGHT_KM_S / AU_KM), (later[1] - earth[1]) / 60 / (LIGHT_KM_S / AU_KM), (later[2] - earth[2]) / 60 / (LIGHT_KM_S / AU_KM)];
  const aberrated: Vec = [sun[0] / distanceAu + beta[0], sun[1] / distanceAu + beta[1], sun[2] / distanceAu + beta[2]];
  return toEquatorial(eclipticJ2000ToTrueEquatorialOfDate(aberrated, T), distanceAu * AU_KM);
}

/** The Moon as seen from the Earth's centre: the apparent place of date, with the light time (the Moon is about 1.3 seconds away) and nutation. */
export function moonEquatorial(ms: number): Equatorial {
  const T = julianCenturies(ms);
  const first = moonGeocentric(ms);
  const distance = Math.hypot(first[0], first[1], first[2]);
  const geometric = moonGeocentric(ms - (distance / LIGHT_KM_S) * 1000);
  return toEquatorial(eclipticJ2000ToTrueEquatorialOfDate(geometric, T), Math.hypot(geometric[0], geometric[1], geometric[2]));
}

/** The apparent sidereal time at Greenwich in degrees, from the UTC instant taken as UT1. */
export { greenwichSiderealTime };

/** The observer's place from the Earth's centre in the true equator of date, in kilometres, with the turn of the Earth (Meeus ch. 11). */
export function observerVector(observer: Observer, ms: number): Vec {
  const lat = observer.latitude * RAD;
  const height = (observer.heightM ?? 0) / 1000;
  const u = Math.atan((1 - EARTH_FLATTENING) * Math.tan(lat));
  const rhoSin = (1 - EARTH_FLATTENING) * Math.sin(u) + (height / EARTH_RADIUS_KM) * Math.sin(lat);
  const rhoCos = Math.cos(u) + (height / EARTH_RADIUS_KM) * Math.cos(lat);
  const theta = (greenwichSiderealTime(ms) + observer.longitude) * RAD;
  return [EARTH_RADIUS_KM * rhoCos * Math.cos(theta), EARTH_RADIUS_KM * rhoCos * Math.sin(theta), EARTH_RADIUS_KM * rhoSin];
}

/**
 * Altitude, azimuth, hour angle and parallactic angle of a body for an observer: topocentric (parallax taken out of the Earth's centre to the place) and geometric, with no refraction.
 * `ms` is the instant the observer's sky turns for; the body's place `equatorial` is its apparent place at that instant.
 */
export function horizontalOf(equatorial: Equatorial, ms: number, observer: Observer): Horizontal {
  const body = fromEquatorial(equatorial);
  const place = observerVector(observer, ms);
  const topo: Vec = [body[0] - place[0], body[1] - place[1], body[2] - place[2]];
  const distanceKm = Math.hypot(topo[0], topo[1], topo[2]);
  const ra = Math.atan2(topo[1], topo[0]);
  const dec = Math.asin(topo[2] / distanceKm);
  const lat = observer.latitude * RAD;
  const H = (greenwichSiderealTime(ms) + observer.longitude) * RAD - ra;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const azimuth = Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H));
  const parallactic = Math.atan2(Math.sin(H), Math.tan(lat) * Math.cos(dec) - Math.sin(dec) * Math.cos(H));
  return {
    azimuth: (((azimuth * DEG) % 360) + 360) % 360,
    altitude: altitude * DEG,
    hourAngle: ((((H * DEG) % 360) + 540) % 360) - 180,
    parallacticAngle: parallactic * DEG,
    distanceKm,
  };
}

/**
 * The refraction of the atmosphere in degrees at a geometric altitude in degrees (Saemundsson's formula, standard air at 10 degrees C and 1010 hPa): it lifts a body toward the zenith.
 * It is smooth through the horizon and fades to nothing below -2 degrees.
 */
export function refraction(altitude: number): number {
  if (altitude < -2) return 0;
  const h = Math.max(altitude, -1);
  const r = 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * RAD) / 60;
  return altitude < -1 ? r * (altitude + 2) : r;
}

/** The Moon's phase: the illuminated fraction 0 to 1, the phase 0 to 1 (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter), the bright limb's position angle in degrees eastward from north, and whether it is waxing. */
export function moonPhase(ms: number): { fraction: number; phase: number; angle: number; waxing: boolean } {
  const sun = sunEquatorial(ms);
  const moon = moonEquatorial(ms);
  const sunV = fromEquatorial(sun);
  const moonV = fromEquatorial(moon);
  const psi = Math.acos(Math.max(-1, Math.min(1, (sunV[0] * moonV[0] + sunV[1] * moonV[1] + sunV[2] * moonV[2]) / (sun.distanceKm * moon.distanceKm))));
  // the angle at the Moon between the Sun and the Earth (Meeus ch. 48)
  const inc = Math.atan2(sun.distanceKm * Math.sin(psi), moon.distanceKm - sun.distanceKm * Math.cos(psi));
  const fraction = (1 + Math.cos(inc)) / 2;
  const a0 = sun.rightAscension * RAD;
  const d0 = sun.declination * RAD;
  const a = moon.rightAscension * RAD;
  const d = moon.declination * RAD;
  const angle = Math.atan2(Math.cos(d0) * Math.sin(a0 - a), Math.sin(d0) * Math.cos(d) - Math.cos(d0) * Math.sin(d) * Math.cos(a0 - a)) * DEG;
  // waxing while the Moon is east of the Sun along the ecliptic: its longitude is ahead by under half a turn
  const n = nutation(julianCenturies(ms));
  const epsilon = n.meanObliquity + n.obliquity;
  const longitudeOf = (v: Vec): number => Math.atan2(v[1] * Math.cos(epsilon) + v[2] * Math.sin(epsilon), v[0]) * DEG;
  const ahead = (((longitudeOf(moonV) - longitudeOf(sunV)) % 360) + 360) % 360;
  const waxing = ahead < 180;
  const phase = waxing ? 0.5 - inc / (2 * Math.PI) : 0.5 + inc / (2 * Math.PI);
  return { fraction, phase: phase >= 1 ? phase - 1 : phase, angle: ((angle % 360) + 360) % 360, waxing };
}
