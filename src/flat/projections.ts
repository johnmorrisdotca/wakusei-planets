// Map projections for the painted maps: the sphere of any body flattened five ways, with the graticule, the outline and the Sun's mark, and a resampler that turns the body's own equirectangular picture into the projected one.
// Pure: numbers and pixel arrays in, numbers and pixel arrays out. No DOM, no clock reads, no dependency. Every map here is on the unit sphere: x grows east, y grows north, in radii.
import { subSolarPoint } from "../places.ts";
import type { BodyId } from "../facts.ts";
import { wrapLongitude } from "./geometry.ts";

const RAD = Math.PI / 180;
const HALF_PI = Math.PI / 2;

/**
 * The projections: `equirectangular` (the picture as drawn, a degree is a degree both ways), `mercator` (round, angles kept true; it stops at 85.05 degrees because the poles are at infinity), `sinusoidal` (equal area, the parallels keep their true length, the shape is a leaf), `mollweide` (equal area, an ellipse twice as wide as tall) and `azimuthal` (equidistant: the whole sphere as a disc about a chosen point, distances from that point true; the opposite point is the rim).
 *
 * @example
 * ```ts
 * import { PROJECTIONS } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(PROJECTIONS.join(", "));
 * ```
 */
export const PROJECTIONS = ["equirectangular", "mercator", "sinusoidal", "mollweide", "azimuthal"] as const;

/**
 * One of `PROJECTIONS`.
 *
 * @example
 * ```ts
 * import type { ProjectionId } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const id: ProjectionId = "mollweide";
 * console.log(id);
 * ```
 */
export type ProjectionId = (typeof PROJECTIONS)[number];

/**
 * The point a map is centred on, in degrees. Longitude centres every projection; latitude only turns the azimuthal one (the others keep the equator across the middle).
 *
 * @example
 * ```ts
 * import type { MapCentre } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const northPole: MapCentre = { lon: 0, lat: 90 };
 * console.log(northPole.lat);
 * ```
 */
export interface MapCentre {
  lon: number;
  lat: number;
}

/**
 * The furthest north or south the Mercator map goes, in degrees: where it becomes a square.
 *
 * @example
 * ```ts
 * import { MERCATOR_LIMIT } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(MERCATOR_LIMIT.toFixed(5));
 * ```
 */
export const MERCATOR_LIMIT = (2 * Math.atan(Math.exp(Math.PI)) - HALF_PI) / RAD;

const NO_CENTRE: MapCentre = { lon: 0, lat: 0 };
const finite = (n: number, fallback = 0): number => (Number.isFinite(n) ? n : fallback);

/**
 * Whether a name is one of the projections.
 *
 * @param value - Any value.
 * @returns True for a name in `PROJECTIONS`.
 *
 * @example
 * ```ts
 * import { isProjection } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(isProjection("mollweide"), isProjection("robinson"));
 * ```
 */
export const isProjection = (value: unknown): value is ProjectionId => typeof value === "string" && (PROJECTIONS as readonly string[]).includes(value);

/**
 * How far the map reaches from its middle, in radii: the half width and half height of the box that holds it.
 *
 * @param id - The projection.
 * @returns `halfWidth` and `halfHeight`.
 *
 * @example
 * ```ts
 * import { mapExtent } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(mapExtent("mollweide"), mapExtent("azimuthal"));
 * ```
 */
export function mapExtent(id: ProjectionId): { halfWidth: number; halfHeight: number } {
  switch (id) {
    case "equirectangular":
      return { halfWidth: Math.PI, halfHeight: HALF_PI };
    case "mercator":
      return { halfWidth: Math.PI, halfHeight: Math.PI };
    case "sinusoidal":
      return { halfWidth: Math.PI, halfHeight: HALF_PI };
    case "mollweide":
      return { halfWidth: 2 * Math.SQRT2, halfHeight: Math.SQRT2 };
    case "azimuthal":
      return { halfWidth: Math.PI, halfHeight: Math.PI };
  }
}

/** Mollweide's auxiliary angle: 2t + sin 2t = pi sin(lat), by Newton's method, with the poles set apart (the slope is zero there). */
function mollweideAngle(lat: number): number {
  if (Math.abs(lat) >= HALF_PI - 1e-9) return Math.sign(lat) * HALF_PI;
  const target = Math.PI * Math.sin(lat);
  let t = lat;
  for (let i = 0; i < 50; i += 1) {
    const slope = 2 + 2 * Math.cos(2 * t);
    if (slope < 1e-12) break;
    const step = (2 * t + Math.sin(2 * t) - target) / slope;
    t -= step;
    if (Math.abs(step) < 1e-14) break;
  }
  return Math.max(-HALF_PI, Math.min(HALF_PI, t));
}

/** A place by its longitude from the middle (`dlon`, radians, not wrapped) and latitude (radians) on the four maps that keep the equator across the middle. */
function across(id: Exclude<ProjectionId, "azimuthal">, dlon: number, lat: number): { x: number; y: number } {
  switch (id) {
    case "equirectangular":
      return { x: dlon, y: lat };
    case "mercator": {
      const limit = MERCATOR_LIMIT * RAD;
      const clamped = Math.max(-limit, Math.min(limit, lat));
      return { x: dlon, y: Math.atanh(Math.sin(clamped)) };
    }
    case "sinusoidal":
      return { x: dlon * Math.cos(lat), y: lat };
    case "mollweide": {
      const t = mollweideAngle(lat);
      return { x: ((2 * Math.SQRT2) / Math.PI) * dlon * Math.cos(t), y: Math.SQRT2 * Math.sin(t) };
    }
  }
}

/** The azimuthal equidistant map about a centre: the angular distance and the bearing round to a point of the disc. At the opposite point the bearing is undefined, so it is the bottom of the rim. */
function disc(dlon: number, lat: number, centreLat: number): { x: number; y: number } {
  const cosC = Math.max(-1, Math.min(1, Math.sin(centreLat) * Math.sin(lat) + Math.cos(centreLat) * Math.cos(lat) * Math.cos(dlon)));
  const c = Math.acos(cosC);
  const sinC = Math.sin(c);
  if (sinC < 1e-12) return c < 1 ? { x: 0, y: 0 } : { x: 0, y: -Math.PI };
  const k = c / sinC;
  return { x: k * Math.cos(lat) * Math.sin(dlon), y: k * (Math.cos(centreLat) * Math.sin(lat) - Math.sin(centreLat) * Math.cos(lat) * Math.cos(dlon)) };
}

/**
 * Where a longitude and latitude fall on the map, in radii from its middle (x east, y north). Longitude is taken the short way round from the centre, so a place on the far side of the picture's seam lands at the right edge. Mercator holds a latitude beyond 85.05 degrees at 85.05, so a pole is a place on the top edge, never infinity.
 *
 * @param id - The projection.
 * @param lon - Degrees east.
 * @param lat - Degrees north.
 * @param centre - The point in the middle; the Greenwich-like prime meridian on the equator when left out.
 * @returns `x` and `y`.
 *
 * @example
 * ```ts
 * import { projectMap } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(projectMap("mollweide", 90, 45), projectMap("azimuthal", 0, 90, { lon: 0, lat: 90 }));
 * ```
 */
export function projectMap(id: ProjectionId, lon: number, lat: number, centre: MapCentre = NO_CENTRE): { x: number; y: number } {
  const dlon = wrapLongitude(finite(lon) - finite(centre.lon)) * RAD;
  const phi = Math.max(-90, Math.min(90, finite(lat))) * RAD;
  return id === "azimuthal" ? disc(dlon, phi, Math.max(-90, Math.min(90, finite(centre.lat))) * RAD) : across(id, dlon, phi);
}

/**
 * The longitude and latitude at a point of the map: the opposite of `projectMap`.
 *
 * @param id - The projection.
 * @param x - Radii east of the middle.
 * @param y - Radii north of the middle.
 * @param centre - The point in the middle.
 * @returns `lon` in -180 up to 180 and `lat`, or `null` when the point is outside the map's shape (beyond the leaf, the ellipse or the disc).
 *
 * @example
 * ```ts
 * import { unprojectMap } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(unprojectMap("sinusoidal", 0, 0), unprojectMap("mollweide", 2.8, 1.4));
 * ```
 */
export function unprojectMap(id: ProjectionId, x: number, y: number, centre: MapCentre = NO_CENTRE): { lon: number; lat: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const lon0 = finite(centre.lon);
  const done = (dlon: number, lat: number): { lon: number; lat: number } | null => (Math.abs(dlon) > Math.PI + 1e-9 ? null : { lon: wrapLongitude(lon0 + dlon / RAD), lat: lat / RAD });
  switch (id) {
    case "equirectangular":
      return Math.abs(y) > HALF_PI ? null : done(x, y);
    case "mercator":
      return Math.abs(y) > Math.PI ? null : done(x, 2 * Math.atan(Math.exp(y)) - HALF_PI);
    case "sinusoidal": {
      if (Math.abs(y) > HALF_PI) return null;
      const cos = Math.cos(y);
      if (cos < 1e-12) return Math.abs(x) < 1e-9 ? done(0, y) : null;
      return done(x / cos, y);
    }
    case "mollweide": {
      if (Math.abs(y) > Math.SQRT2) return null;
      const t = Math.asin(Math.max(-1, Math.min(1, y / Math.SQRT2)));
      const lat = Math.asin(Math.max(-1, Math.min(1, (2 * t + Math.sin(2 * t)) / Math.PI)));
      const cos = Math.cos(t);
      if (cos < 1e-12) return Math.abs(x) < 1e-9 ? done(0, lat) : null;
      return done((Math.PI * x) / (2 * Math.SQRT2 * cos), lat);
    }
    case "azimuthal": {
      const rho = Math.hypot(x, y);
      if (rho > Math.PI) return null;
      const lat0 = Math.max(-90, Math.min(90, finite(centre.lat))) * RAD;
      if (rho < 1e-12) return { lon: wrapLongitude(lon0), lat: lat0 / RAD };
      const sinC = Math.sin(rho);
      const cosC = Math.cos(rho);
      const lat = Math.asin(Math.max(-1, Math.min(1, cosC * Math.sin(lat0) + (y * sinC * Math.cos(lat0)) / rho)));
      const dlon = Math.atan2(x * sinC, rho * Math.cos(lat0) * cosC - y * Math.sin(lat0) * sinC);
      return { lon: wrapLongitude(lon0 + dlon / RAD), lat: lat / RAD };
    }
  }
}

/**
 * One line of the graticule or the outline: points in radii, drawn in order; a graticule line that has to leave the map is several of these.
 *
 * @example
 * ```ts
 * import type { MapLine } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const line: MapLine = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
 * console.log(line.length);
 * ```
 */
export type MapLine = { x: number; y: number }[];

/**
 * One graticule line: a meridian or a parallel, with its value in degrees and the pieces to draw (a line the map has to cut is more than one).
 *
 * @example
 * ```ts
 * import type { GraticuleLine } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const line: GraticuleLine = { kind: "parallel", value: 0, lines: [[{ x: -3.14, y: 0 }, { x: 3.14, y: 0 }]] };
 * console.log(line.kind);
 * ```
 */
export interface GraticuleLine {
  kind: "meridian" | "parallel";
  /** Degrees: the longitude of a meridian, the latitude of a parallel. */
  value: number;
  lines: MapLine[];
}

/**
 * The lines of longitude and latitude at every `step` degrees, as polylines on the map. The four maps keep a line whole from edge to edge (a meridian on the picture's seam is drawn on both edges); on the azimuthal disc a line is cut where it crosses the rim, so nothing is drawn across the map. The poles on Mercator, where they are at infinity, are not drawn as parallels, and the meridians stop at 85.05 degrees. A parallel at a pole is a point on the sinusoidal and Mollweide maps and is left out.
 *
 * @param id - The projection.
 * @param step - Degrees between lines, 5 to 90 (30 when left out).
 * @param centre - The point in the middle.
 * @returns The lines, the equator and the prime meridian among them.
 *
 * @example
 * ```ts
 * import { graticule } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const lines = graticule("mollweide", 30);
 * console.log(lines.filter((l) => l.kind === "meridian").length, lines.filter((l) => l.kind === "parallel").length);
 * ```
 */
export function graticule(id: ProjectionId, step = 30, centre: MapCentre = NO_CENTRE): GraticuleLine[] {
  const every = Math.min(90, Math.max(5, finite(step, 30)));
  const lon0 = finite(centre.lon);
  const lat0 = finite(centre.lat);
  const out: GraticuleLine[] = [];
  const sample = 1;
  const latLimit = id === "mercator" ? MERCATOR_LIMIT : 90;
  const cut = (points: { x: number; y: number }[]): MapLine[] => {
    const pieces: MapLine[] = [];
    let piece: MapLine = [];
    let last: { x: number; y: number } | null = null;
    for (const point of points) {
      // a jump of more than a quarter radius between one-degree samples is the rim of the disc, not a line
      if (last !== null && Math.hypot(point.x - last.x, point.y - last.y) > 0.25) {
        if (piece.length > 1) pieces.push(piece);
        piece = [];
      }
      piece.push(point);
      last = point;
    }
    if (piece.length > 1) pieces.push(piece);
    return pieces;
  };
  // meridians: every multiple of the step across the 360 degrees from the left edge to the right edge of the map
  const first = Math.ceil((lon0 - 180) / every) * every;
  for (let lon = first; lon <= lon0 + 180 + 1e-9; lon += every) {
    const points: { x: number; y: number }[] = [];
    for (let lat = -latLimit; lat <= latLimit + 1e-9; lat += sample) {
      const phi = Math.min(latLimit, lat) * RAD;
      points.push(id === "azimuthal" ? disc(wrapLongitude(lon - lon0) * RAD, phi, lat0 * RAD) : across(id, (lon - lon0) * RAD, phi));
    }
    out.push({ kind: "meridian", value: wrapLongitude(lon), lines: cut(points) });
  }
  // parallels: the equator and every multiple of the step out from it, short of the poles (a point on two of the maps, at infinity on the third)
  const parallel = (lat: number): void => {
    const points: { x: number; y: number }[] = [];
    for (let lon = lon0 - 180; lon <= lon0 + 180 + 1e-9; lon += sample) points.push(id === "azimuthal" ? disc(wrapLongitude(lon - lon0) * RAD, lat * RAD, lat0 * RAD) : across(id, (lon - lon0) * RAD, lat * RAD));
    out.push({ kind: "parallel", value: lat, lines: cut(points) });
  };
  parallel(0);
  for (let lat = every; lat < Math.min(90, latLimit) - 1e-9; lat += every) {
    parallel(lat);
    parallel(-lat);
  }
  return out;
}

/**
 * The edge of the map as one closed line, for a frame: the rectangle, the square, the leaf, the ellipse or the disc.
 *
 * @param id - The projection.
 * @returns The points, the first repeated at the end.
 *
 * @example
 * ```ts
 * import { mapOutline } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(mapOutline("sinusoidal").length > 100);
 * ```
 */
export function mapOutline(id: ProjectionId): MapLine {
  if (id === "azimuthal") {
    const ring: MapLine = [];
    for (let a = 0; a < 360; a += 2) ring.push({ x: Math.PI * Math.sin(a * RAD), y: Math.PI * Math.cos(a * RAD) });
    ring.push({ ...ring[0]! });
    return ring;
  }
  if (id === "equirectangular" || id === "mercator") {
    const { halfWidth, halfHeight } = mapExtent(id);
    return [
      { x: -halfWidth, y: halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: -halfWidth, y: -halfHeight },
      { x: -halfWidth, y: halfHeight },
    ];
  }
  // the leaf and the ellipse: down the east edge, then up the west
  const points: MapLine = [];
  for (let lat = 90; lat >= -90; lat -= 1) points.push(across(id, Math.PI, lat * RAD));
  for (let lat = -90; lat <= 90; lat += 1) points.push(across(id, -Math.PI, lat * RAD));
  points.push({ ...points[0]! });
  return points;
}

/**
 * How the map sits in a box: pixels for one radius and the box's middle, with `zoom` (1 fits the whole map).
 *
 * @example
 * ```ts
 * import type { MapFit } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const fit: MapFit = { scale: 100, cx: 400, cy: 200 };
 * console.log(fit.scale);
 * ```
 */
export interface MapFit {
  scale: number;
  cx: number;
  cy: number;
}

/**
 * Fit a projection into a box so the whole map shows, with a margin of a few pixels.
 *
 * @param id - The projection.
 * @param width - Box width in pixels.
 * @param height - Box height in pixels.
 * @param zoom - 1 or more; the map is held to its middle.
 * @returns The scale and the middle.
 *
 * @example
 * ```ts
 * import { fitMap } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(fitMap("mollweide", 800, 400));
 * ```
 */
export function fitMap(id: ProjectionId, width: number, height: number, zoom = 1): MapFit {
  const { halfWidth, halfHeight } = mapExtent(id);
  const room = 4;
  const scale = Math.max(0, Math.min((width - 2 * room) / (2 * halfWidth), (height - 2 * room) / (2 * halfHeight))) * Math.max(1, finite(zoom, 1));
  return { scale, cx: width / 2, cy: height / 2 };
}

/**
 * A point of the map in pixels of the box (y grows down).
 *
 * @param fit - From `fitMap`.
 * @param point - A point in radii.
 * @returns `x` and `y` in pixels.
 *
 * @example
 * ```ts
 * import { fitMap, mapPixels, projectMap } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(mapPixels(fitMap("mercator", 400, 400), projectMap("mercator", 10, 20)));
 * ```
 */
export const mapPixels = (fit: MapFit, point: { x: number; y: number }): { x: number; y: number } => ({ x: fit.cx + point.x * fit.scale, y: fit.cy - point.y * fit.scale });

/**
 * Where the Sun is overhead on a body, as a point of the map: the sub-solar point worked from the body's pole and spin and put through the projection. On a map that does not show that side of the body (the azimuthal disc shows all of it) the point is still found; the mark is on the picture whenever it can be.
 *
 * @param id - The projection.
 * @param body - A body with a pole and spin (a planet, dwarf planet or moon; the Sun has none).
 * @param ms - Milliseconds since 1970 (UTC).
 * @param centre - The point in the middle.
 * @returns The point on the map in radii, and the place on the body.
 *
 * @example
 * ```ts
 * import { mapSun } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const sun = mapSun("equirectangular", "moon", Date.UTC(1969, 6, 20, 20, 17, 40));
 * console.log(sun.lat.toFixed(0), sun.lon.toFixed(0));
 * ```
 */
export function mapSun(id: ProjectionId, body: BodyId, ms: number, centre: MapCentre = NO_CENTRE): { x: number; y: number; lon: number; lat: number } {
  const sun = subSolarPoint(body, ms);
  const lon = wrapLongitude(sun.lon);
  return { ...projectMap(id, lon, sun.lat, centre), lon, lat: sun.lat };
}

/**
 * A picture as pixels: its size and RGBA bytes, row by row from the top, as `ImageData` holds them.
 *
 * @example
 * ```ts
 * import type { MapPixels } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const one: MapPixels = { width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255]) };
 * console.log(one.width);
 * ```
 */
export interface MapPixels {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

/**
 * Turn a body's painted map (an equirectangular picture, the whole body from -180 to 180 east and 90 to -90 north) into the same body in another projection: for every pixel of the answer the place on the body it shows is found with `unprojectMap` and the colour is read from the picture, smoothly between its pixels, wrapping across the seam and holding at the poles. Pixels outside the map's shape are transparent.
 *
 * @param source - The painted map.
 * @param id - The projection.
 * @param width - Answer width in pixels.
 * @param height - Answer height in pixels.
 * @param options - `centre` (the middle) and `zoom` (1 fits the whole map).
 * @returns RGBA bytes, `width` by `height`.
 *
 * @example
 * ```ts
 * import { resampleMap } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const grey = { width: 2, height: 1, data: [0, 0, 0, 255, 255, 255, 255, 255] };
 * const out = resampleMap(grey, "equirectangular", 4, 2);
 * console.log(out.length);
 * ```
 */
export function resampleMap(source: MapPixels, id: ProjectionId, width: number, height: number, options: { centre?: MapCentre; zoom?: number } = {}): Uint8ClampedArray {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  const out = new Uint8ClampedArray(w * h * 4);
  if (source.width < 1 || source.height < 1 || w === 0 || h === 0) return out;
  const centre = options.centre ?? NO_CENTRE;
  const fit = fitMap(id, w, h, options.zoom);
  const { width: sw, height: sh, data } = source;
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const at = unprojectMap(id, (px + 0.5 - fit.cx) / fit.scale, (fit.cy - (py + 0.5)) / fit.scale, centre);
      if (at === null) continue;
      // the picture's pixel centres are at (i + 0.5) / size of the way across; longitude wraps, latitude holds at the poles
      const u = ((at.lon + 180) / 360) * sw - 0.5;
      const v = Math.max(0, Math.min(sh - 1, ((90 - at.lat) / 180) * sh - 0.5));
      const x0 = Math.floor(u);
      const y0 = Math.floor(v);
      const fx = u - x0;
      const fy = v - y0;
      const xa = ((x0 % sw) + sw) % sw;
      const xb = (((x0 + 1) % sw) + sw) % sw;
      const ya = y0;
      const yb = Math.min(sh - 1, y0 + 1);
      const o = (py * w + px) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const top = data[(ya * sw + xa) * 4 + channel]! * (1 - fx) + data[(ya * sw + xb) * 4 + channel]! * fx;
        const bottom = data[(yb * sw + xa) * 4 + channel]! * (1 - fx) + data[(yb * sw + xb) * 4 + channel]! * fx;
        out[o + channel] = top * (1 - fy) + bottom * fy;
      }
    }
  }
  return out;
}
