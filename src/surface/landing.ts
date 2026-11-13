// Apollo 17's powered descent as a function of time: where the lunar module is, how high, how fast and which way it points at each second from ignition to touchdown. What is REAL is what the Apollo 17 Mission
// Report (NASA, JSC-07904, NTRS 19730015117) prints: the times of the events (table 8-VI), the state at ignition (table 3-III: place, altitude, speed, heading), the altitudes it names in words (30,000 ft after the radar
// locked, 13,000 ft, pitchover at about 7,500 ft, manual takeover just under 300 ft, dust at 60 to 70 ft, touchdown at about 3 ft/s) and the place of touchdown. What is MADE is the smooth curve through those moments
// (the report prints no full table), the path on the ground between the start and the end, the attitude between events and the throttle. The page says so. Pure: no DOM.

const FT = 0.3048;
const NMI = 1852;
const R_MOON = 1_737_400;

/**
 * The descent's fixed facts: its length in seconds, when it began in real time, where the lunar module was at ignition, and the clock the view starts at (T+4:00, where the report has the radar locked: the first
 * four minutes are 530 km up-range of the ground the package has, so they are a time lapse of the clock with no ground).
 *
 * @example
 * ```ts
 * import { LANDING } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(`${LANDING.duration} s from ${new Date(LANDING.ignition).toISOString()}`);
 * ```
 */
export const LANDING = {
  /** Seconds from ignition to touchdown (the report's 12:05). */
  duration: 725,
  /** Ignition in real time: 110:09:53 ground elapsed time, 12:05 before the touchdown at 19:54:57 UTC on 1972-12-11. */
  ignition: Date.UTC(1972, 11, 11, 19, 42, 52),
  /** The clock the view starts at, in seconds from ignition. */
  viewStart: 240,
  /** At ignition (table 3-III): latitude and east longitude in degrees, altitude in metres (8.7 nautical miles), speed in m/s (5,550.3 ft/s) and heading (276.07 degrees). */
  start: { lat: 19.13, lon: 48.75, altitude: 8.7 * NMI, speed: 5550.3 * FT, heading: 276.07 },
  /** The ground speed the made curve ends at, and the descent rate at touchdown the report gives ("approximately 3 ft/sec"), in m/s. */
  touchdownDescent: 3 * FT,
} as const;

/** A time and a value, and whether the time and the value are the report's. */
type Anchor = readonly [t: number, value: number];

// The altitude through the moments the report names; the times of those it gives no clock for (30,000 ft, 13,000 ft, manual takeover, dust) are placed by us between the times it does give.
const ALTITUDE: readonly Anchor[] = [
  [0, LANDING.start.altitude],
  [255, 30_000 * FT],
  [500, 13_000 * FT],
  [562, 7_500 * FT],
  [658, 152],
  [678, 90],
  [715, 20],
  [722, 2.5],
  [725, 0],
];

// The speed along the ground: the start is the report's, the end is "near zero", the rest is made to fall smoothly and to cover the real distance from the start to the touchdown (the weights below are scaled to it).
const SPEED_SHAPE: readonly Anchor[] = [
  [0, LANDING.start.speed],
  [120, 1370],
  [255, 1000],
  [446, 430],
  [562, 60],
  [658, 8],
  [700, 1.5],
  [725, 0.5],
];

/** A piecewise cubic through points that never overshoots (Fritsch-Carlson), as a function of t. */
function monotone(points: readonly Anchor[]): (t: number) => number {
  const n = points.length;
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    h.push(points[i + 1]![0] - points[i]![0]);
    d.push((points[i + 1]![1] - points[i]![1]) / h[i]!);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i += 1) {
    if (d[i - 1]! * d[i]! <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i]! + h[i - 1]!;
      const w2 = h[i]! + 2 * h[i - 1]!;
      m[i] = (w1 + w2) / (w1 / d[i - 1]! + w2 / d[i]!);
    }
  }
  return (t: number): number => {
    if (t <= points[0]![0]) return points[0]![1];
    if (t >= points[n - 1]![0]) return points[n - 1]![1];
    let i = 0;
    while (t > points[i + 1]![0]) i += 1;
    const s = (t - points[i]![0]) / h[i]!;
    const [s2, s3] = [s * s, s * s * s];
    return (2 * s3 - 3 * s2 + 1) * points[i]![1] + (s3 - 2 * s2 + s) * h[i]! * m[i]! + (-2 * s3 + 3 * s2) * points[i + 1]![1] + (s3 - s2) * h[i]! * m[i + 1]!;
  };
}

/** The great-circle distance in metres between two places on the Moon given in degrees (a sphere of 1,737.4 km). */
function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const [p1, p2, dl] = [(lat1 * Math.PI) / 180, (lat2 * Math.PI) / 180, ((lon2 - lon1) * Math.PI) / 180];
  const a = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return R_MOON * Math.acos(Math.min(1, Math.max(-1, a)));
}

/** The place of touchdown the report gives is the lunar module's own place in the package (the orbiter's picture of it): the site point of Apollo 17 as the places list has it. */
const SITE = { lat: 20.1911, lon: 30.7723 };

const altitudeAt = monotone(ALTITUDE);
const DISTANCE = distance(LANDING.start.lat, LANDING.start.lon, SITE.lat, SITE.lon);

/** The speed curve scaled in its middle so that it covers the real distance from ignition to touchdown, and the distance still to go at each second. */
const { speedAt, toGoAt } = (() => {
  const total = (k: number): { f: (t: number) => number; to: number[] } => {
    const shape = SPEED_SHAPE.map(([t, v], i): Anchor => (i === 0 || i === SPEED_SHAPE.length - 1 ? [t, v] : [t, v * k]));
    const f = monotone(shape);
    const to: number[] = new Array(LANDING.duration + 1).fill(0);
    for (let t = LANDING.duration - 1; t >= 0; t -= 1) to[t] = to[t + 1]! + (f(t) + f(t + 1)) / 2;
    return { f, to };
  };
  let [lo, hi] = [0.5, 1.5];
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    if (total(mid).to[0]! < DISTANCE) lo = mid;
    else hi = mid;
  }
  const fit = total((lo + hi) / 2);
  return {
    speedAt: fit.f,
    toGoAt: (t: number): number => {
      const c = Math.min(Math.max(t, 0), LANDING.duration);
      const i = Math.min(LANDING.duration - 1, Math.floor(c));
      return fit.to[i]! - (fit.to[i]! - fit.to[i + 1]!) * (c - i);
    },
  };
})();

/**
 * Where the lunar module is and how it moves at one moment of the descent.
 *
 * @example
 * ```ts
 * import { landingAt, type LandingPose } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const pose: LandingPose = landingAt(600);
 * console.log(`${Math.round(pose.altitude)} m up, ${pose.descent.toFixed(1)} m/s down, throttle ${pose.throttle.toFixed(2)}`);
 * ```
 */
export interface LandingPose {
  /** Seconds from ignition. */
  t: number;
  /** Metres over the ground under it, and metres a second down (positive down) and along the ground. */
  altitude: number;
  descent: number;
  speed: number;
  /** Metres still to go along the ground to the touchdown point. */
  toGo: number;
  /** Metres east and north of the touchdown point, on the site's plane, and the heading it flies, degrees clockwise from north. */
  east: number;
  north: number;
  heading: number;
  /** The way the crew's window looks, degrees above the horizon (negative looks down), and the share of full thrust. */
  pitch: number;
  throttle: number;
}

/** The direction from the touchdown back to the start of the descent on the site's plane (east, north), and the heading flown, from the two places. */
const BACK = (() => {
  const dLat = SITE.lat - LANDING.start.lat;
  const north = -R_MOON * (dLat * Math.PI) / 180;
  const east = R_MOON * Math.cos(((SITE.lat + LANDING.start.lat) / 2 * Math.PI) / 180) * (((LANDING.start.lon - SITE.lon) * Math.PI) / 180);
  const length = Math.hypot(east, north);
  return { east: east / length, north: north / length, heading: ((Math.atan2(-east, -north) * 180) / Math.PI + 360) % 360 };
})();

/**
 * The lunar module at a moment of the descent. The altitude passes through the altitudes the report names, the speed starts at the report's and covers the real distance to the touchdown point, and the rest is a
 * smooth curve of ours: `east` and `north` are on a straight line back from the touchdown point toward where the descent began, in metres on the site's plane (the curve of the Moon is the ground's to take off).
 *
 * @param t - Seconds from ignition (held between 0 and the length of the descent).
 * @returns The pose.
 *
 * @example
 * ```ts
 * import { landingAt } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const high = landingAt(562);
 * console.log(`${Math.round(high.altitude)} m up at the high gate, ${high.speed.toFixed(0)} m/s along, ${Math.round(high.toGo)} m to go`);
 * ```
 */
export function landingAt(t: number): LandingPose {
  const c = Math.min(Math.max(t, 0), LANDING.duration);
  const altitude = altitudeAt(c);
  const ce = Math.min(Math.max(c, 0.25), LANDING.duration - 0.25);
  const descent = -(altitudeAt(ce + 0.25) - altitudeAt(ce - 0.25)) / 0.5;
  const toGo = toGoAt(c);
  // the window: level in the braking, then the pitchover to look down at the site from the high gate, easing toward the horizon near the ground
  const ease = (a: number, b: number, from: number, to: number): number => {
    const s = Math.min(1, Math.max(0, (c - from) / (to - from)));
    return a + (b - a) * (s * s * (3 - 2 * s));
  };
  const pitch = c < 562 ? ease(10, 14, 0, 562) : c < 658 ? ease(14, -38, 562, 590) : ease(-38, -20, 658, 725);
  const throttle = c < 28 ? 0.1 + 0.9 * (c / 28) : c < 446 ? 1 : c < 562 ? 0.57 : 0.34 + 0.12 * Math.sin(c / 7);
  return {
    t: c,
    altitude,
    descent,
    speed: speedAt(c),
    toGo,
    east: BACK.east * toGo,
    north: BACK.north * toGo,
    heading: BACK.heading,
    pitch,
    throttle,
  };
}

/**
 * One event the page shows as it passes: when (seconds from ignition), what it is in English and Japanese, and whether its TIME is the report's (the altitude events are placed by us on the curve).
 *
 * @example
 * ```ts
 * import { CALLOUTS, type Callout } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const touchdown: Callout = CALLOUTS.find((c) => c.id === "touchdown")!;
 * console.log(touchdown.en, touchdown.reported);
 * ```
 */
export interface Callout {
  id: string;
  t: number;
  en: string;
  ja: string;
  /** True where the time comes from the report's table of events; false where it is the moment the made curve reaches the altitude the report names. */
  reported: boolean;
}

const when = (altitude: number): number => {
  let t = 0;
  while (t < LANDING.duration && altitudeAt(t) > altitude) t += 0.5;
  return t;
};

/**
 * The events of the descent as the report gives them (the times in its table of events) and the altitudes it names (placed on the curve), in the order they pass.
 *
 * @example
 * ```ts
 * import { CALLOUTS } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(CALLOUTS.map((c) => `T+${c.t}s ${c.en}`).join("; "));
 * ```
 */
export const CALLOUTS: readonly Callout[] = [
  { id: "ignition", t: 0, en: "Descent engine ignition", ja: "降下エンジン点火", reported: true },
  { id: "full", t: 28, en: "Full throttle", ja: "全開", reported: true },
  { id: "radar", t: 215, en: "Landing radar locks on", ja: "着陸レーダーが捉える", reported: true },
  { id: "throttle", t: 446, en: "Throttle down", ja: "スロットルを絞る", reported: true },
  { id: "high-gate", t: 562, en: "High gate: the approach phase, pitchover at about 7,500 ft", ja: "ハイゲート：進入フェーズ、高度約7,500フィートでピッチオーバー", reported: true },
  { id: "redesignation", t: 573, en: "First landing-point redesignation (eight in all)", ja: "最初の着陸点の変更（全部で8回）", reported: true },
  { id: "low-gate", t: 658, en: "Low gate: the landing phase", ja: "ローゲート：着陸フェーズ", reported: true },
  { id: "manual", t: when(300 * FT), en: "The Commander takes over by hand, just under 300 ft", ja: "司令官が手動操縦に切り替え（高度約300フィート未満）", reported: false },
  { id: "dust", t: when(70 * FT), en: "Dust first seen, at 60 to 70 ft", ja: "砂ぼこりが見え始める（高度60〜70フィート）", reported: false },
  { id: "touchdown", t: LANDING.duration, en: "Touchdown, 12:05 after ignition, at about 3 ft/s down", ja: "着陸（点火から12分5秒、降下速度は毎秒約3フィート）", reported: true },
];

/**
 * The events that have passed by a moment, the latest last.
 *
 * @param t - Seconds from ignition.
 * @returns The events with a time at or before `t`.
 *
 * @example
 * ```ts
 * import { calloutsBy } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(calloutsBy(600).map((c) => c.id).join(", "));
 * ```
 */
export function calloutsBy(t: number): Callout[] {
  return CALLOUTS.filter((c) => c.t <= t + 1e-9);
}

/**
 * The clock as the page shows it: `T+04:00` from ignition, and the ground elapsed time of the mission (ignition was 110:09:53).
 *
 * @param t - Seconds from ignition.
 * @returns The two clocks as text.
 *
 * @example
 * ```ts
 * import { clockText } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(clockText(240));
 * ```
 */
export function clockText(t: number): { t: string; get: string } {
  const two = (n: number): string => String(Math.floor(n)).padStart(2, "0");
  const s = Math.max(0, Math.floor(t));
  const g = 110 * 3600 + 9 * 60 + 53 + s;
  return { t: `T+${two(s / 60)}:${two(s % 60)}`, get: `${Math.floor(g / 3600)}:${two((g % 3600) / 60)}:${two(g % 60)}` };
}
