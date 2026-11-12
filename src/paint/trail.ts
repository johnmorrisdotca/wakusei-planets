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

const RAD = Math.PI / 180;

/** Every pixel within `theta` radians of `point`, row by row: each row's half-width in longitude is worked out, and a cap over the date line wraps to the other edge. */
const stampCap = (data: Uint8Array, point: GroundPoint, theta: number, minute: number): number => {
  if (!(theta > 0)) return stampDot(data, point, minute);
  const deg = theta / RAD;
  const sin1 = Math.sin(point.lat * RAD);
  const cos1 = Math.cos(point.lat * RAD);
  const cosTheta = Math.cos(theta);
  const y0 = paintPixel(0, Math.min(90, point.lat + deg)).y;
  const y1 = paintPixel(0, Math.max(-90, point.lat - deg)).y;
  let added = 0;
  for (let y = y0; y <= y1; y += 1) {
    const lat = (90 - ((y + 0.5) / PAINT_H) * 180) * RAD;
    const denominator = cos1 * Math.cos(lat);
    const need = cosTheta - sin1 * Math.sin(lat);
    let half: number;
    if (denominator < 1e-9) {
      if (need > 0) continue;
      half = 180;
    } else {
      const ratio = need / denominator;
      if (ratio > 1) continue;
      half = ratio <= -1 ? 180 : Math.acos(ratio) / RAD;
    }
    const first = Math.floor(((point.lon - half + 180) / 360) * PAINT_W);
    const last = Math.floor(((point.lon + half + 180) / 360) * PAINT_W);
    if (last - first >= PAINT_W - 1) {
      for (let x = 0; x < PAINT_W; x += 1) if (write(data, x, y, minute)) added += 1;
    } else {
      for (let x = first; x <= last; x += 1) if (write(data, ((x % PAINT_W) + PAINT_W) % PAINT_W, y, minute)) added += 1;
    }
  }
  return added;
};

const stampGround = (data: Uint8Array, swath: PaintSwath, ground: GroundPoint & { heightKm: number }, radiusKm: number, previous: GroundPoint | null, minute: number): { added: number; at: GroundPoint } => {
  const theta = swath === "coverage" ? coverageAngleRad(ground.heightKm, radiusKm) : 0;
  // a line is made of steps a third of a degree long; a swath of caps that overlap, a step of about seven tenths of the cap's radius
  const points = previous === null ? [ground] : trackSteps(previous, ground, swath === "coverage" ? Math.max(1, (theta / RAD) * 0.7) : 0.35);
  let added = 0;
  let cursor: GroundPoint | null = previous;
  for (const point of points) {
    if (swath === "coverage") added += stampCap(data, point, theta, minute);
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

/** The longest gap between two samples of the craft's place, so a line between them is the short way round the same great circle: a twentieth of a trip, and no more than four minutes (the body turns under it). */
const MAX_GAP = 240_000;
const MIN_GAP = 30_000;
/** Samples taken at most in one frame, and at most to lay down a whole length at once (a swath costs more a sample than a line). A gap is never more than a third of a trip, however many that takes. */
const FRAME_SAMPLES = 600;
const REBUILD_SAMPLES = { track: 4000, coverage: 1500 };

const gapOf = (periodMs: number | undefined): number => (periodMs !== undefined && periodMs > 0 ? Math.max(MIN_GAP, Math.min(MAX_GAP, periodMs / 20)) : TICK);

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
  /**
   * Stamp the ground crossed since the last call, and drop what has fallen out of the length. Returns true when `data` changed and should be uploaded. At rest, or with painting off, false.
   * `periodMs` is one trip of the craft: samples are taken often enough that the line between two follows the orbit, however fast the clock. A clock run backwards fills in the older end of the length.
   */
  step(ms: number, radiusKm: number, sample: (ms: number) => (GroundPoint & { heightKm: number }) | null, periodMs?: number): boolean;
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
  /** The last point stamped and the way the clock was going then, so a line carries on from it. */
  let previous: GroundPoint | null = null;
  let heading = 0;
  /** The buffer was emptied since the last step: the picture must be sent even if nothing new was stamped. */
  let stale = false;
  const reset = (): void => {
    data.fill(0);
    pixels = 0;
    lastMs = Number.NaN;
    previous = null;
    heading = 0;
    stale = true;
  };
  const dropOld = (now: number, span: number): void => {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const then = ((data[i] ?? 0) << 8) | (data[i + 1] ?? 0);
      const age = ageOf(then, now);
      // a tick of slack at each end, for the rounding of the stamp's minute
      if (age > span + 1 || age < -1) {
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
      reset();
      spec = { id, length, swath };
    },
    clear() {
      reset();
      spec = null;
    },
    step(ms, radiusKm, sample, periodMs) {
      if (!spec) {
        const upload = stale;
        stale = false;
        return upload;
      }
      if (!Number.isFinite(ms)) return false;
      if (Number.isFinite(lastMs) && ms === lastMs) {
        const upload = stale;
        stale = false;
        return upload;
      }
      const length = LENGTH_MS[spec.length];
      const gap = gapOf(periodMs);
      let dirty = stale;
      stale = false;
      /** Stamp the craft's place at each of `times`, one line from the one before. */
      const lay = (times: number[], way: number): void => {
        if (way !== heading) previous = null;
        heading = way;
        for (const at of times) {
          const ground = sample(at);
          if (!ground) {
            previous = null;
            continue;
          }
          const stamped = stampGround(data, spec!.swath, ground, radiusKm, previous, paintMinute(at));
          pixels += stamped.added;
          previous = stamped.at;
          dirty = true;
        }
      };
      const between = (from: number, to: number, cap: number): number[] => {
        const span = Math.abs(to - from);
        const count = Math.max(Math.min(cap, Math.max(1, Math.ceil(span / gap))), periodMs === undefined ? 1 : Math.ceil(span / (periodMs / 3)));
        return Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count);
      };
      if (!Number.isFinite(lastMs) || Math.abs(ms - lastMs) > length) {
        // the first moment, or a jump: the whole length is laid down again, oldest first
        data.fill(0);
        pixels = 0;
        previous = null;
        heading = 1;
        lay(between(ms - length, ms, REBUILD_SAMPLES[spec.swath]), 1);
      } else if (ms > lastMs) {
        lay(between(lastMs, ms, FRAME_SAMPLES), 1);
      } else {
        // backwards: the newer end falls away below, and the older end, which the clock has just uncovered, is laid down
        lay(between(lastMs - length, ms - length, FRAME_SAMPLES), -1);
      }
      dropOld(paintMinute(ms), length / TICK);
      lastMs = ms;
      return dirty || pixels > 0;
    },
  };
  return self;
}
