// The searches behind the sun and moon times: the day a time belongs to, the instants when a body crosses an altitude or the meridian, found by sampling and bisection on this package's own positions.
// Shared by `suncalc` and `suncalc/legacy`. Pure: no DOM, no three.js.
import { horizontalOf, moonEquatorial, sunEquatorial, type Observer } from "./engine.ts";

const DAY_MS = 86_400_000;
const MOON_RADIUS_KM = 1737.4;
const SAMPLE_MS = 6 * 60_000;

/** A date or milliseconds since 1970 as milliseconds, throwing on anything that is not a moment. */
export function moment(date: Date | number, name = "date"): number {
  const ms = typeof date === "number" ? date : date.getTime();
  if (!Number.isFinite(ms)) throw new RangeError(`${name} must be a valid Date or a finite number of milliseconds, got ${String(date)}`);
  return ms;
}

export function place(latitude: number, longitude: number, heightM = 0): Observer {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError(`lat must be between -90 and 90 degrees, got ${latitude}`);
  if (!Number.isFinite(longitude)) throw new RangeError(`lng must be a finite number of degrees, got ${longitude}`);
  if (!Number.isFinite(heightM)) throw new RangeError(`height must be a finite number of metres, got ${heightM}`);
  return { latitude, longitude, heightM };
}


/** The window of a day: the local calendar day when a UTC offset is given, otherwise the solar day from one solar midnight to the next that holds the moment. Milliseconds, the end not included. */
export function dayWindow(ms: number, observer: Observer, utcOffset: number | undefined): [number, number] {
  if (utcOffset !== undefined) {
    if (!Number.isFinite(utcOffset)) throw new RangeError(`utcOffset must be a finite number of minutes east of UTC, got ${utcOffset}`);
    const start = Math.floor((ms + utcOffset * 60_000) / DAY_MS) * DAY_MS - utcOffset * 60_000;
    return [start, start + DAY_MS];
  }
  const nadir = nearestHourAngle(ms, observer, 180);
  const previous = nadir <= ms ? nadir : nearestHourAngle(nadir - DAY_MS, observer, 180);
  const next = nearestHourAngle(previous + DAY_MS, observer, 180);
  return [previous, next];
}

/** The Sun's hour angle in degrees from -180 to 180 for an observer (positive west, 0 on the meridian). */
export function sunHourAngle(ms: number, observer: Observer): number {
  return horizontalOf(sunEquatorial(ms), ms, observer).hourAngle;
}

/** The instant nearest to `ms` when the Sun's hour angle is `target` degrees (0 noon, 180 midnight), by Newton steps on the Sun's turn of about 360 degrees a day. */
export function nearestHourAngle(ms: number, observer: Observer, target: number): number {
  let t = ms;
  for (let i = 0; i < 8; i += 1) {
    const difference = ((((sunHourAngle(t, observer) - target) % 360) + 540) % 360) - 180;
    t -= (difference / 360) * DAY_MS;
    if (Math.abs(difference) < 1e-6) break;
  }
  return t;
}

/** The zero crossings of `f` in [start, end), as [instant, true when f goes up], found by sampling every `step` milliseconds and bisecting each bracket to about a tenth of a second. */
export function crossings(f: (ms: number) => number, start: number, end: number, step: number): Array<[number, boolean]> {
  const found: Array<[number, boolean]> = [];
  let t0 = start;
  let f0 = f(t0);
  while (t0 < end) {
    const t1 = Math.min(t0 + step, end);
    const f1 = f(t1);
    if ((f0 < 0 && f1 >= 0) || (f0 >= 0 && f1 < 0)) {
      let lo = t0;
      let hi = t1;
      let flo = f0;
      for (let i = 0; i < 26; i += 1) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if ((fm < 0) === (flo < 0)) {
          lo = mid;
          flo = fm;
        } else hi = mid;
      }
      const at = (lo + hi) / 2;
      if (at < end) found.push([at, f0 < 0]);
    }
    t0 = t1;
    f0 = f1;
  }
  return found;
}

/** The height of the horizon below level for an observer `height` metres up, in degrees (the dip, with the refraction along it). */
export const dip = (heightM: number): number => 0.0347 * Math.sqrt(Math.max(0, heightM));


/** The Sun's times of a day: when it crosses each row's altitude going up and going down, with solar noon and the solar midnight that leads into it. */
export interface SunDay {
  noon: number;
  nadir: number;
  /** For each row `[angle, morningName, eveningName]`: the instants, or null for one that does not happen in the window. */
  events: Map<string, number | null>;
  alwaysUp: boolean;
  alwaysDown: boolean;
}

/**
 * The Sun's day at a place: `utcOffset` in minutes east of UTC picks the local calendar day holding `ms`, and `undefined` the solar day (one solar midnight to the next).
 * A row at the horizon (between -1 and 0 degrees) is lowered by the dip of the horizon for an observer `heightM` metres up.
 */
export function sunDay(ms: number, observer: Observer, utcOffset: number | undefined, rows: ReadonlyArray<readonly [number, string, string]>): SunDay {
  const [start, end] = dayWindow(ms, observer, utcOffset);
  const altitude = (t: number): number => horizontalOf(sunEquatorial(t), t, observer).altitude;
  const solarNoon = nearestHourAngle(start + 12 * 3_600_000, observer, 0);
  const noon = solarNoon < start - 1000 ? nearestHourAngle(solarNoon + DAY_MS, observer, 0) : solarNoon;
  // the solar midnight that leads into this day's solar noon, as suncalc does: it can fall a few minutes before a calendar day begins
  const nadir = nearestHourAngle(noon - DAY_MS / 2, observer, 180);
  const cache = new Map<number, number>();
  const sampled = (t: number): number => {
    let v = cache.get(t);
    if (v === undefined) {
      v = altitude(t);
      cache.set(t, v);
    }
    return v;
  };
  const events = new Map<string, number | null>();
  const height = observer.heightM ?? 0;
  for (const [angle, morning, evening] of rows) {
    const level = angle - (angle > -1 && angle < 0 ? dip(height) : 0);
    const found = crossings((t) => sampled(t) - level, start, end, 10 * 60_000);
    events.set(morning, found.find(([, rising]) => rising)?.[0] ?? null);
    events.set(evening, found.find(([, rising]) => !rising)?.[0] ?? null);
  }
  const sunrise = events.get("sunrise");
  const sunset = events.get("sunset");
  const none = sunrise === null && sunset === null;
  const high = none && altitude(noon) > -0.833 - dip(height);
  return { noon, nadir, events, alwaysUp: high, alwaysDown: none && !high };
}

/** The Moon between two instants at a place: rise and set (the upper limb at the horizon through 34 arc-minutes of refraction), the upper and lower meridian crossings, and whether it stays up or down. */
export function moonDay(start: number, end: number, observer: Observer): { rise: number | null; set: number | null; transit: number | null; lowerTransit: number | null; alwaysUp: boolean; alwaysDown: boolean } {
  // the centre's geometric altitude plus the refraction and the radius of the disc is zero at the rise and the set
  const above = (t: number): number => {
    const h = horizontalOf(moonEquatorial(t), t, observer);
    return h.altitude + 34 / 60 + (Math.asin(MOON_RADIUS_KM / h.distanceKm) * 180) / Math.PI;
  };
  const meridian = (t: number): number => Math.sin((horizontalOf(moonEquatorial(t), t, observer).hourAngle * Math.PI) / 180);
  const edges = crossings(above, start, end, SAMPLE_MS);
  const turns = crossings(meridian, start, end, SAMPLE_MS);
  const rise = edges.find(([, rising]) => rising)?.[0] ?? null;
  const set = edges.find(([, rising]) => !rising)?.[0] ?? null;
  const none = rise === null && set === null;
  const up = none && above(start) > 0;
  return { rise, set, transit: turns.find(([, rising]) => rising)?.[0] ?? null, lowerTransit: turns.find(([, rising]) => !rising)?.[0] ?? null, alwaysUp: up, alwaysDown: none && !up };
}
