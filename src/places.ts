// Places on a body: the record a page marks on the Moon or Mars (a landing, a rover, a crash or impact site, a named feature), the lookups over a body's list, and the helpers a page needs beside
// them: the sub-solar point, the terminator and the local solar time at a place, at any moment, from the package's own ephemeris and the IAU poles. Pure: no DOM, no clock reads. The lists
// themselves are the entry points `/places/moon` and `/places/mars`, so a page pays only for the body it shows.
import { apparent } from "./ephemeris.ts";
import { BODIES, type BodyId } from "./facts.ts";
import { cross, dot, type Vec3 } from "./vec.ts";
import { moment, type When } from "./when.ts";

export type { When } from "./when.ts";

/**
 * What a place is: a `crewed` landing (an Apollo lunar module), a `landing` (a lander that worked after touchdown), a `rover` that drove there, a `crash` (a craft that hit the surface and was lost, by accident or at the end of its mission), an
 * `impact` (a craft sent to hit it on purpose), a `planned` landing (announced, not flown) or a named `feature` of the surface.
 *
 * @example
 * ```ts
 * import type { PlaceKind } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const kinds: PlaceKind[] = ["crewed", "landing", "rover", "crash", "impact", "planned", "feature"];
 * console.log(kinds.length);
 * ```
 */
export type PlaceKind = "crewed" | "landing" | "rover" | "crash" | "impact" | "planned" | "feature";

/**
 * One place on a body. Latitude and longitude are planetocentric degrees, east positive, from -180 to 180: the Moon's in the mean Earth/polar axis frame, Mars's in its IAU frame. On Mars every place is planetocentric: the Gazetteer's features are, and a lander's `source.latitude` says whether its source is planetocentric, was a planetographic latitude `converted`, or does not state it (`not stated`, GCAT's own rows).
 *
 * @example
 * ```ts
 * import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
 * import type { Place } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const eagle: Place = PLACES_MOON.find((place) => place.id === "moon/apollo-11-lunar-module")!;
 * console.log(eagle.name.en, eagle.lat.toFixed(2), eagle.lon.toFixed(2), eagle.date);
 * ```
 */
export interface Place {
  /** `<body>/<slug>`, unique on the body. */
  id: string;
  kind: PlaceKind;
  /** The name in English and Japanese (a feature's Japanese name is its IAU name, which is Latin). */
  name: { en: string; ja: string };
  lat: number;
  lon: number;
  /** When it got there (ISO, UTC, to the minute where the source gives one; a month alone where only that is known), for a site. */
  date?: string;
  /** For a site: the craft, who ran it, its country code as the catalogue gives it, and how it ended up (`soft`, `hard`, `impact`, `crewed`). */
  mission?: string;
  operator?: string;
  country?: string;
  outcome?: "crewed" | "soft" | "hard" | "impact";
  /** True where the source gives the position to a degree or less, or says it is an estimate: the real place can be tens of kilometres from the point. */
  approximate?: true;
  /** Where the catalogue's own position differs from the one used by more than 0.05 degrees: `[lat, lon]`, kept so a page can show both. */
  gcatPosition?: readonly [number, number];
  /** The landing site's own name, where it has one (`Statio Tranquillitatis`, `Octavia E. Butler Landing`). */
  site?: string;
  /** A word from the catalogue about the object. */
  note?: string;
  /** When the craft stopped working on the surface, where known. */
  until?: string;
  /** The catalogue's own name for the object, for looking it up there. */
  gcatName?: string;
  /** For a feature: the IAU type and a plain word for it, the size in kilometres, and the date the name was approved. */
  feature?: { type: string; typeWord: { en: string; ja: string }; diameterKm: number; approved: string };
  /** For a planned landing: the announced date, its state, and the date the announcement was read. */
  planned?: { date: string; status: "announced" | "slipped" | "cancelled"; read: string };
  /** Where the record comes from, and the date that source's file was read. */
  source: { id: "iau-gazetteer" | "gcat-landercat" | "nssdca" | "pds-ode" | "nasa-mars24" | "agency"; read: string; latitude?: "planetocentric" | "converted" | "not stated" };
}

/**
 * The credit a page that shows places owes each source, one row for every `source.id` the tables use: the line to print, the licence or terms it rests on and the address. The lander catalogue's is a condition of its licence (CC BY 4.0: "data from GCAT (J. McDowell,
 * planet4589.org/space/gcat)"); the others are US government works, credited as their owners ask.
 *
 * @example
 * ```ts
 * import { PLACES_CREDITS } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(PLACES_CREDITS.map((credit) => credit.line).join("; "));
 * ```
 */
export const PLACES_CREDITS: readonly { id: Place["source"]["id"]; line: string; licence: string; url: string }[] = [
  { id: "gcat-landercat", line: "data from GCAT (J. McDowell, planet4589.org/space/gcat)", licence: "CC BY 4.0", url: "https://planet4589.org/space/gcat/" },
  { id: "iau-gazetteer", line: "IAU Gazetteer of Planetary Nomenclature, U.S. Geological Survey", licence: "US public domain", url: "https://planetarynames.wr.usgs.gov/" },
  { id: "nssdca", line: "NASA NSSDCA", licence: "US government work (NASA content is generally not subject to copyright in the United States)", url: "https://nssdc.gsfc.nasa.gov/" },
  { id: "pds-ode", line: "NASA Planetary Data System, Mars Orbital Data Explorer", licence: "US government work", url: "https://ode.rsl.wustl.edu/mars/" },
  { id: "nasa-mars24", line: "NASA Goddard Institute for Space Studies, Mars24 Sunclock", licence: "US government work", url: "https://www.giss.nasa.gov/tools/mars24/" },
];

/**
 * The bodies that have places: `moon` and `mars`.
 *
 * @example
 * ```ts
 * import { PLACE_BODIES } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(PLACE_BODIES.join(", "));
 * ```
 */
export const PLACE_BODIES = ["moon", "mars"] as const;

/**
 * A body with places.
 *
 * @example
 * ```ts
 * import type { PlaceBody } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const body: PlaceBody = "mars";
 * console.log(body);
 * ```
 */
export type PlaceBody = (typeof PLACE_BODIES)[number];

/**
 * The places of one kind, or of several, from a body's list, in the list's order (sites by date, then features by size).
 *
 * @param places - A body's list (`PLACES_MOON`, `PLACES_MARS`).
 * @param kinds - The kinds wanted.
 * @returns Those places.
 *
 * @example
 * ```ts
 * import { PLACES_MARS } from "@johnmorrisdotca/wakusei-planets/places/mars";
 * import { placesOfKind } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(placesOfKind(PLACES_MARS, "rover").map((place) => place.name.en).join(", "));
 * ```
 */
export function placesOfKind(places: readonly Place[], ...kinds: readonly PlaceKind[]): Place[] {
  return places.filter((place) => kinds.includes(place.kind));
}

/**
 * A place by its id, or by its name in English or Japanese in any case, or `undefined`.
 *
 * @param places - A body's list.
 * @param text - `moon/apollo-11-lunar-module`, `Apollo 11 lunar module`, `Mare Imbrium`, `嫦娥4号`.
 * @returns The place, or `undefined` when none matches.
 *
 * @example
 * ```ts
 * import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
 * import { findPlace } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(findPlace(PLACES_MOON, "mare imbrium")?.feature?.diameterKm, findPlace(PLACES_MOON, "nowhere"));
 * ```
 */
export function findPlace(places: readonly Place[], text: string): Place | undefined {
  if (typeof text !== "string") return undefined;
  const wanted = text.trim().toLowerCase();
  return places.find((place) => place.id === wanted || place.name.en.toLowerCase() === wanted || place.name.ja === text.trim());
}

/**
 * The places within a distance of a point on the body, nearest first.
 *
 * @param places - A body's list.
 * @param lat - Planetocentric latitude in degrees.
 * @param lon - East longitude in degrees.
 * @param withinDeg - How far, as an angle at the body's centre, in degrees.
 * @returns The places with their distance in degrees.
 *
 * @example
 * ```ts
 * import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
 * import { placesNear } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(placesNear(PLACES_MOON, 0.67, 23.47, 3).map((near) => `${near.place.name.en} ${near.degrees.toFixed(2)}`).slice(0, 3).join("; "));
 * ```
 */
export function placesNear(places: readonly Place[], lat: number, lon: number, withinDeg: number): { place: Place; degrees: number }[] {
  const out: { place: Place; degrees: number }[] = [];
  for (const place of places) {
    const degrees = angleBetween(lat, lon, place.lat, place.lon);
    if (degrees <= withinDeg) out.push({ place, degrees });
  }
  return out.sort((a, b) => a.degrees - b.degrees);
}

const RAD = Math.PI / 180;

/**
 * A body's places, loaded when asked for: the table of `/places/moon` or `/places/mars` arrives as a chunk of its own the first time, so a page that never asks for one does not carry it.
 *
 * @param body - `moon` or `mars`.
 * @returns The list: the sites first, by date, then the named features by size. An unknown body is a rejected `RangeError`.
 *
 * @example
 * ```ts
 * import { loadPlaces } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const mars = await loadPlaces("mars");
 * console.log(mars.length, "places on Mars");
 * ```
 */
export async function loadPlaces(body: PlaceBody): Promise<readonly Place[]> {
  if (body === "moon") return (await import("./places/moon.ts")).PLACES_MOON;
  if (body === "mars") return (await import("./places/mars.ts")).PLACES_MARS;
  throw new RangeError(`places are held for ${PLACE_BODIES.join(" and ")}, not "${String(body)}"`);
}

/**
 * The places of a body by kind, from its list (loaded on the first call): `listPlaces("moon", "crewed", "landing")`. With no kind it is every place.
 *
 * @param body - `moon` or `mars`.
 * @param kinds - The kinds wanted; none for all.
 * @returns The places in the list's order.
 *
 * @example
 * ```ts
 * import { listPlaces } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const rovers = await listPlaces("mars", "rover");
 * console.log(rovers.map((place) => place.name.en).join(", "));
 * ```
 */
export async function listPlaces(body: PlaceBody, ...kinds: readonly PlaceKind[]): Promise<Place[]> {
  const all = await loadPlaces(body);
  return kinds.length === 0 ? [...all] : placesOfKind(all, ...kinds);
}

/**
 * The place nearest to a point on the body, by great-circle distance, or `undefined` for an empty list. Give kinds to look only among those (`"feature"` for the named surface, the others for the visited places).
 *
 * @param places - A body's list.
 * @param lat - Planetocentric latitude in degrees.
 * @param lon - East longitude in degrees.
 * @param kinds - The kinds to look among; none for all.
 * @returns The place and its distance in degrees at the body's centre, or `undefined` when no place of those kinds is in the list.
 *
 * @example
 * ```ts
 * import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
 * import { nearestPlace } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const near = nearestPlace(PLACES_MOON, 20, 30.7, "crewed", "landing", "rover");
 * console.log(near?.place.name.en, near?.degrees.toFixed(2));
 * ```
 */
export function nearestPlace(places: readonly Place[], lat: number, lon: number, ...kinds: readonly PlaceKind[]): { place: Place; degrees: number } | undefined {
  let best: { place: Place; degrees: number } | undefined;
  for (const place of places) {
    if (kinds.length > 0 && !kinds.includes(place.kind)) continue;
    const degrees = angleBetween(lat, lon, place.lat, place.lon);
    if (best === undefined || degrees < best.degrees) best = { place, degrees };
  }
  return best;
}

/**
 * The distance over the surface between two places on a body, in kilometres: the great circle on a sphere of the body's equatorial radius from `BODIES` (1737.4 km for the Moon, 3396.19 km for Mars; flattening is not allowed for, which is 0.6 per cent on Mars and nothing on the Moon).
 *
 * @param body - `moon` or `mars`.
 * @param a - A place, or a latitude and east longitude.
 * @param b - The other.
 * @returns Kilometres.
 *
 * @example
 * ```ts
 * import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
 * import { findPlace, placeDistanceKm } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const a = findPlace(PLACES_MOON, "Apollo 11 lunar module")!;
 * const b = findPlace(PLACES_MOON, "Apollo 17 lunar module")!;
 * console.log(Math.round(placeDistanceKm("moon", a, b)), "km between Tranquility Base and Taurus-Littrow");
 * ```
 */
export function placeDistanceKm(body: PlaceBody, a: Place | { lat: number; lon: number }, b: Place | { lat: number; lon: number }): number {
  if (!PLACE_BODIES.includes(body)) throw new RangeError(`places are held for ${PLACE_BODIES.join(" and ")}, not "${String(body)}"`);
  return (angleBetween(a.lat, a.lon, b.lat, b.lon) * RAD * BODIES[body].radiusKm);
}

/**
 * The great-circle angle between two points on a sphere, in degrees.
 *
 * @param lat1 - The first point's latitude, degrees.
 * @param lon1 - Its longitude.
 * @param lat2 - The second point's latitude.
 * @param lon2 - Its longitude.
 * @returns The angle at the centre, 0 to 180.
 *
 * @example
 * ```ts
 * import { angleBetween } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(angleBetween(0, 0, 0, 90), angleBetween(90, 0, -90, 0));
 * ```
 */
export function angleBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  for (const value of [lat1, lon1, lat2, lon2]) if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(`a latitude or longitude must be a finite number of degrees, got ${String(value)}`);
  const a = unitOf(lat1, lon1);
  const b = unitOf(lat2, lon2);
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / RAD;
}

/** A unit vector in the body's frame for a latitude and east longitude: x along the prime meridian, z the pole, y 90 degrees east. */
const unitOf = (lat: number, lon: number): Vec3 => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];

/**
 * The sub-solar point of a body at a moment: the latitude and east longitude where the Sun is overhead, from the package's own ephemeris and the body's IAU pole and prime meridian.
 *
 * @param id - `moon`, `mars` or any body the package has a pole and a Sun direction for.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The point, in degrees.
 *
 * @example
 * ```ts
 * import { subSolarPoint } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const sun = subSolarPoint("mars", Date.UTC(2026, 10, 11, 12));
 * console.log(sun.lat.toFixed(1), sun.lon.toFixed(1));
 * ```
 */
export function subSolarPoint(id: BodyId, when: When): { lat: number; lon: number } {
  const ms = moment(when);
  const pose = apparent(id, ms);
  const east = cross(pose.pole, pose.meridian);
  const s = pose.light;
  const lat = Math.asin(Math.max(-1, Math.min(1, dot(s, pose.pole)))) / RAD;
  const lon = Math.atan2(dot(s, east), dot(s, pose.meridian)) / RAD;
  return { lat, lon };
}

/**
 * The terminator at a moment: points round the great circle 90 degrees from the sub-solar point, in degrees, for a line on a map or a globe. The first point is at the pole-most place of the circle
 * and they go east from there.
 *
 * @param id - The body.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param points - How many points (the first is repeated at the end).
 * @returns The points.
 *
 * @example
 * ```ts
 * import { terminator } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const line = terminator("moon", Date.UTC(2026, 10, 11), 8);
 * console.log(line.length, line.map((p) => p.lat.toFixed(0)).join(" "));
 * ```
 */
export function terminator(id: BodyId, when: When, points = 72): { lat: number; lon: number }[] {
  const sun = subSolarPoint(id, when);
  const s = unitOf(sun.lat, sun.lon);
  // two unit vectors at right angles to the Sun's: one towards the pole, one east
  const u: Vec3 = [-Math.sin(sun.lat * RAD) * Math.cos(sun.lon * RAD), -Math.sin(sun.lat * RAD) * Math.sin(sun.lon * RAD), Math.cos(sun.lat * RAD)];
  const v = cross(s, u);
  const out: { lat: number; lon: number }[] = [];
  for (let k = 0; k <= points; k += 1) {
    const a = (2 * Math.PI * k) / points;
    const p: Vec3 = [u[0] * Math.cos(a) + v[0] * Math.sin(a), u[1] * Math.cos(a) + v[1] * Math.sin(a), u[2] * Math.cos(a) + v[2] * Math.sin(a)];
    out.push({ lat: Math.asin(Math.max(-1, Math.min(1, p[2]))) / RAD, lon: Math.atan2(p[1], p[0]) / RAD });
  }
  return out;
}

/**
 * The local solar time at a place at a moment, in hours from 0 to 24: 12 where the Sun is on the meridian (the sub-solar longitude), an hour later for every 15 degrees east of it, as on the Earth.
 *
 * @param id - The body.
 * @param lon - The place's east longitude, degrees.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns Hours, 0 to 24, of the body's own solar day.
 *
 * @example
 * ```ts
 * import { localSolarTime, subSolarPoint } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const when = Date.UTC(2026, 10, 11, 12);
 * console.log(localSolarTime("moon", subSolarPoint("moon", when).lon, when).toFixed(1), "o'clock under the Sun");
 * ```
 */
export function localSolarTime(id: BodyId, lon: number, when: When): number {
  const sun = subSolarPoint(id, when);
  return ((((lon - sun.lon) / 15 + 12) % 24) + 24) % 24;
}

/**
 * Whether the Sun is up at a place at a moment (its centre above the horizon of a smooth sphere).
 *
 * @param id - The body.
 * @param lat - The place's latitude.
 * @param lon - Its east longitude.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns True in daylight.
 *
 * @example
 * ```ts
 * import { isDaylight } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(isDaylight("mars", 18.44, 77.45, Date.UTC(2026, 10, 11, 12)));
 * ```
 */
export function isDaylight(id: BodyId, lat: number, lon: number, when: When): boolean {
  const sun = subSolarPoint(id, when);
  return angleBetween(lat, lon, sun.lat, sun.lon) < 90;
}
