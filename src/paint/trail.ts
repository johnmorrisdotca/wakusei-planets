// One fixed equirectangular buffer for a craft's ground track. A frame stamps only the ground just crossed.
// The picture fades a stamp by the minute stored in it. Nothing is rebuilt at rest and the buffer never grows.
import { BODIES, type BodyId } from "../facts.ts";
import { coverageAngleRad, splitTrail, trackSteps, type GroundPoint } from "../ground-track.ts";
import { orientation } from "../scene/orient.ts";
import { eclipticToScene } from "../space/frame.ts";
import { cross, dot, type Vec3 } from "../vec.ts";

export type PaintLength = "1d" | "1w" | "1m";
export type PaintSwath = "track" | "coverage";

/**
 * What to paint: which craft, how long the trail is kept, and whether it is the line under the craft or the ground where it stands 10° up.
 *
 * @example
 * ```ts
 * import type { PaintSpec } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const spec: PaintSpec = { id: "lro", length: "1d", swath: "track" };
 * console.log(spec.id);
 * ```
 */
export interface PaintSpec {
  /** An orbiter id, such as `lro` or `mro`. */
  id: string;
  /** How long the trail is kept, in simulated time. `1d` when left out. */
  length?: PaintLength;
  /** `track` paints the point under the craft (the default). `coverage` paints where it is at least 10° above the horizon. */
  swath?: PaintSwath;
}

const DAY = 86_400_000;
const LENGTH_MS: Record<PaintLength, number> = { "1d": DAY, "1w": 7 * DAY, "1m": 30 * DAY };
/** Two minutes a tick, so a month (21,600 ticks) fits in a signed 16-bit age. */
const TICK = 120_000;
/** Equirectangular, north at the first row, longitude −180 at the first column. */
export const PAINT_W = 1024;
export const PAINT_H = 512;

export const paintLengthOf = (length: PaintLength | undefined): PaintLength => (length === "1w" || length === "1m" ? length : "1d");
export const paintSwathOf = (swath: PaintSwath | undefined): PaintSwath => (swath === "coverage" ? "coverage" : "track");

/** Ticks since the epoch, in 16 bits. One tick is two minutes, so a month fits in a signed 16-bit age. */
export const paintMinute = (ms: number): number => Math.round(ms / TICK) & 0xffff;

/**
 * Where a craft is on a body's surface. `eclipticKm` is from the body's centre, ecliptic J2000, the same axes `/orbiters` uses.
 *
 * @param body - The body the craft goes round.
 * @param eclipticKm - The place, in kilometres from the body's centre.
 * @param ms - The instant, so the body has turned under the craft.
 * @returns Longitude, latitude and height.
 *
 * @example
 * ```ts
 * import { orientation } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * console.log(orientation("moon", Date.UTC(2026, 10, 11)).pole.length === 3);
 * ```
 */
export function groundUnder(body: BodyId, eclipticKm: Vec3, ms: number): GroundPoint & { heightKm: number } {
  const scene = eclipticToScene(eclipticKm);
  const { pole, meridian } = orientation(body, ms);
  const east = cross(pole, meridian);
  const x = dot(scene, east);
  const y = dot(scene, pole);
  const z = dot(scene, meridian);
  const radius = Math.hypot(x, y, z) || 1;
  return {
    lon: (Math.atan2(x, z) * 180) / Math.PI,
    lat: (Math.asin(Math.max(-1, Math.min(1, y / radius))) * 180) / Math.PI,
    heightKm: radius - BODIES[body].radiusKm,
  };
}

const paintPixel = (lon: number, lat: number): { x: number; y: number } => {
  const u = lon / 360 + 0.5;
  const v = 0.5 - lat / 180;
  return { x: Math.max(0, Math.min(PAINT_W - 1, Math.floor(u * PAINT_W))), y: Math.max(0, Math.min(PAINT_H - 1, Math.floor(v * PAINT_H))) };
};

const write = (data: Uint8Array, x: number, y: number, minute: number): boolean => {
  if (x < 0 || y < 0 || x >= PAINT_W || y >= PAINT_H) return false;
  const i = (y * PAINT_W + x) * 4;
  const fresh = data[i + 3] === 0;
  data[i] = (minute >> 8) & 255;
  data[i + 1] = minute & 255;
  data[i + 2] = 255;
  data[i + 3] = 255;
  return fresh;
};

const stampDot = (data: Uint8Array, point: GroundPoint, minute: number): number => {
  const at = paintPixel(point.lon, point.lat);
  return write(data, at.x, at.y, minute) ? 1 : 0;
};

const stampLine = (data: Uint8Array, a: GroundPoint, b: GroundPoint, minute: number): number => {
  const from = paintPixel(a.lon, a.lat);
  const to = paintPixel(b.lon, b.lat);
  if (Math.abs(to.x - from.x) > PAINT_W / 2) return 0;
  let added = 0;
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (write(data, x, y, minute)) added += 1;
    if (x === to.x && y === to.y) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return added;
};

const angular = (a: GroundPoint, b: GroundPoint): number => {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
};

const stampCap = (data: Uint8Array, point: GroundPoint, theta: number, minute: number): number => {
  if (!(theta > 0)) return stampDot(data, point, minute);
  const deg = (theta * 180) / Math.PI;
  const cosLat = Math.max(0.15, Math.cos((point.lat * Math.PI) / 180));
  const dLon = Math.min(180, deg / cosLat);
  const pole = Math.abs(point.lat) + deg >= 90;
  const west = pole ? -180 : point.lon - dLon;
  const east = pole ? 180 : point.lon + dLon;
  const south = Math.max(-90, point.lat - deg);
  const north = Math.min(90, point.lat + deg);
  const a = paintPixel(west, north);
  const b = paintPixel(east, south);
  let added = 0;
  const x0 = pole ? 0 : Math.max(0, Math.min(a.x, b.x));
  const x1 = pole ? PAINT_W - 1 : Math.min(PAINT_W - 1, Math.max(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y));
  const y1 = Math.min(PAINT_H - 1, Math.max(a.y, b.y));
  for (let y = y0; y <= y1; y += 1) {
    const lat = 90 - ((y + 0.5) / PAINT_H) * 180;
    for (let x = x0; x <= x1; x += 1) {
      const lon = ((x + 0.5) / PAINT_W) * 360 - 180;
      if (angular(point, { lon, lat }) <= theta && write(data, x, y, minute)) added += 1;
    }
  }
  return added;
};

const stampGround = (data: Uint8Array, swath: PaintSwath, ground: GroundPoint & { heightKm: number }, radiusKm: number, previous: GroundPoint | null, minute: number): { added: number; at: GroundPoint } => {
  const points = previous === null ? [ground] : trackSteps(previous, ground, swath === "coverage" ? 2 : 0.35);
  let added = 0;
  let cursor: GroundPoint | null = previous;
  for (const point of points) {
    if (swath === "coverage") added += stampCap(data, point, coverageAngleRad(ground.heightKm, radiusKm), minute);
    else if (cursor === null) added += stampDot(data, point, minute);
    else for (const [from, to] of splitTrail(cursor, point)) added += stampLine(data, from, to, minute);
    cursor = point;
  }
  return { added, at: ground };
};

const ageOf = (then: number, now: number): number => {
  let age = now - then;
  if (age < -32768) age += 65536;
  if (age > 32768) age -= 65536;
  return age;
};

export interface PaintTrail {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly pixels: number;
  readonly on: boolean;
  readonly length: PaintLength;
  readonly swath: PaintSwath;
  readonly id: string;
  readonly spanMinutes: number;
  set(spec: PaintSpec | null): void;
  clear(): void;
  /** Stamp the ground crossed since the last call. Returns true when `data` changed and should be uploaded. At rest, or with painting off, false. */
  step(ms: number, radiusKm: number, sample: (ms: number) => (GroundPoint & { heightKm: number }) | null): boolean;
}

/**
 * The trail buffer. One for a view. `set` with another craft clears what was painted.
 *
 * @example
 * ```ts
 * import { splitDateLine } from "@johnmorrisdotca/wakusei-planets/ground-track";
 *
 * console.log(splitDateLine({ lon: 170, lat: 0 }, { lon: -170, lat: 4 }).length === 2);
 * ```
 */
export function createPaintTrail(): PaintTrail {
  const data = new Uint8Array(PAINT_W * PAINT_H * 4);
  let spec: { id: string; length: PaintLength; swath: PaintSwath } | null = null;
  let pixels = 0;
  let lastMs = Number.NaN;
  let previous: GroundPoint | null = null;
  let uploadClear = false;
  const dropOld = (now: number, span: number): void => {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const then = ((data[i] ?? 0) << 8) | (data[i + 1] ?? 0);
      const age = ageOf(then, now);
      if (age > span || age < -1) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        pixels -= 1;
      }
    }
  };
  const self: PaintTrail = {
    data,
    width: PAINT_W,
    height: PAINT_H,
    get pixels() {
      return pixels;
    },
    get on() {
      return spec !== null;
    },
    get length() {
      return spec?.length ?? "1d";
    },
    get swath() {
      return spec?.swath ?? "track";
    },
    get id() {
      return spec?.id ?? "";
    },
    get spanMinutes() {
      return LENGTH_MS[spec?.length ?? "1d"] / TICK;
    },
    set(next) {
      if (!next) {
        self.clear();
        return;
      }
      const id = String(next.id);
      const length = paintLengthOf(next.length);
      const swath = paintSwathOf(next.swath);
      if (spec && spec.id === id && spec.length === length && spec.swath === swath) return;
      data.fill(0);
      pixels = 0;
      lastMs = Number.NaN;
      previous = null;
      spec = { id, length, swath };
    },
    clear() {
      data.fill(0);
      pixels = 0;
      lastMs = Number.NaN;
      previous = null;
      spec = null;
      uploadClear = true;
    },
    step(ms, radiusKm, sample) {
      if (!spec) {
        const upload = uploadClear;
        uploadClear = false;
        return upload;
      }
      if (!Number.isFinite(ms)) return false;
      if (Number.isFinite(lastMs) && ms === lastMs) return false;
      const length = LENGTH_MS[spec.length];
      let dirty = false;
      const put = (at: number): void => {
        const ground = sample(at);
        if (!ground) return;
        const stamped = stampGround(data, spec!.swath, ground, radiusKm, previous, paintMinute(at));
        pixels += stamped.added;
        previous = stamped.at;
        dirty = true;
      };
      if (!Number.isFinite(lastMs) || Math.abs(ms - lastMs) > length) {
        data.fill(0);
        pixels = 0;
        previous = null;
        const steps = Math.min(180, Math.max(1, Math.ceil(length / 120_000)));
        for (let i = steps; i >= 0; i -= 1) put(ms - (length * i) / steps);
      } else {
        const span = ms - lastMs;
        const steps = Math.min(64, Math.max(1, Math.ceil(Math.abs(span) / 30_000)));
        for (let i = 1; i <= steps; i += 1) put(lastMs + (span * i) / steps);
      }
      dropOld(paintMinute(ms), length / TICK);
      lastMs = ms;
      return dirty || pixels > 0;
    },
  };
  return self;
}
