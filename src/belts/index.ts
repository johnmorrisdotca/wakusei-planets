// The asteroid belts and the Kuiper belt as data: a few thousand numbered small bodies from NASA/JPL's Small-Body Database in seven belts (the main belt, the Hildas, the Jupiter Trojans, the Centaurs, and the Kuiper
// belt as classical, resonant and scattered objects), a source of them for `<wakusei-space>` (the data door: one instanced draw for each belt), where they are on a date, how many there are and how thickly they
// lie by distance from the Sun, and how far apart the bodies of a belt really are. The elements are in `./data.ts`, a chunk of its own that a page fetches only when it uses it. Pure: no DOM, no three.js.
import { BELT_EPOCH, BELT_SAMPLE, BELT_TOTALS } from "./totals.ts";
import type { SmallBody, SmallBodySource } from "../door/small-bodies.ts";
import { smallBodyAt } from "../door/small-bodies.ts";
import { madeHere } from "../door/own.ts";

/**
 * The belts, nearest the Sun first.
 *
 * @example
 * ```ts
 * import { BELT_IDS } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(BELT_IDS.join(", "));
 * ```
 */
export const BELT_IDS = ["main", "hilda", "trojan", "centaur", "classical", "resonant", "scattered"] as const;

/**
 * The name of a belt: `main`, `hilda`, `trojan`, `centaur`, `classical`, `resonant` or `scattered`.
 *
 * @example
 * ```ts
 * import { BELT_IDS, type BeltId } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const id: BeltId = BELT_IDS[2];
 * console.log(id);
 * ```
 */
export type BeltId = (typeof BELT_IDS)[number];

/**
 * What one belt is: its names, the colour its points are drawn in, how many of its bodies the database holds (`known`) and how many of those this package carries (`sample`, the brightest numbered ones).
 *
 * @example
 * ```ts
 * import { BELTS, type BeltInfo } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const main: BeltInfo = BELTS.main;
 * console.log(main.name.en, main.sample, main.known);
 * ```
 */
export interface BeltInfo {
  id: BeltId;
  name: { en: string; ja: string };
  /** What the belt is, in a few words. */
  about: { en: string; ja: string };
  /** The colour of its points, `#rrggbb`. */
  colour: string;
  /** How many bodies of this belt the Small-Body Database held on 2026-11-10. */
  known: number;
  /** How many of them this package carries: the brightest numbered ones. */
  sample: number;
  /** The belt's nearest and furthest distance from the Sun, in au (the limits of its class in the Small-Body Database, or the cut this package made, see NOTICE.md; the scattered disc has no outer limit, and 2,700 is just above the furthest body carried). */
  innerAu: number;
  outerAu: number;
}

const info = (id: BeltId, en: string, ja: string, aboutEn: string, aboutJa: string, colour: string, known: number, innerAu: number, outerAu: number): BeltInfo => ({ id, name: { en, ja }, about: { en: aboutEn, ja: aboutJa }, colour, known, sample: BELT_SAMPLE[id], innerAu, outerAu });

/**
 * The seven belts, by name.
 *
 * @example
 * ```ts
 * import { BELTS } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(BELTS.trojan.known > BELTS.centaur.known);
 * ```
 */
export const BELTS: Readonly<Record<BeltId, BeltInfo>> = {
  main: info("main", "Main belt", "メインベルト", "between Mars and Jupiter, 2.0 to 3.2 au from the Sun", "火星と木星のあいだ、太陽から2.0〜3.2天文単位", "#d9d3c3", BELT_TOTALS.main, 2.0, 3.2),
  hilda: info("hilda", "Hildas", "ヒルダ群", "locked to Jupiter, 3.9 to 4.1 au out, in a rounded triangle", "木星と共鳴する天体。太陽から3.9〜4.1天文単位で、丸い三角形をなす", "#ffb86b", BELT_TOTALS.hilda, 3.9, 4.1),
  trojan: info("trojan", "Jupiter Trojans", "木星トロヤ群", "two swarms on Jupiter's orbit, 60 degrees ahead of it and 60 behind, 4.6 to 5.5 au out", "木星の軌道上で、木星の60度前と60度後ろにある2つの群れ。太陽から4.6〜5.5天文単位", "#7fd4ff", BELT_TOTALS.trojan, 4.6, 5.5),
  centaur: info("centaur", "Centaurs", "ケンタウルス族", "icy bodies on orbits that cross the giant planets, 5.5 to 30.1 au out", "巨大惑星の軌道と交わる氷の天体。太陽から5.5〜30.1天文単位", "#ff8fb1", BELT_TOTALS.centaur, 5.5, 30.1),
  classical: info("classical", "Kuiper belt, classical", "カイパーベルト (古典的)", "on nearly round orbits 39.4 to 48.4 au out, beyond Neptune", "海王星の外、太陽から39.4〜48.4天文単位のほぼ円形の軌道", "#9ee493", BELT_TOTALS.classical, 39.4, 48.4),
  resonant: info("resonant", "Kuiper belt, resonant", "カイパーベルト (共鳴)", "in step with Neptune (Pluto and the other plutinos are 3:2), 36 to 63 au out", "海王星と共鳴する天体 (冥王星などのプルティノは3:2共鳴)。太陽から36〜63天文単位", "#d6a8ff", BELT_TOTALS.resonant, 36, 63),
  scattered: info("scattered", "Kuiper belt, scattered", "カイパーベルト (散乱円盤)", "on long, tilted orbits thrown outwards by Neptune, 30 to 2,700 au out", "海王星に外へはじき出された、細長くかたむいた軌道。太陽から30〜2,700天文単位", "#ffe36b", BELT_TOTALS.scattered, 30, 2700),
};

/**
 * The Oort cloud, which no orbit in this package is drawn for: a shell of comets thought to lie round the whole solar system, from about 2,000 to about 100,000 astronomical units from the Sun (the outer edge
 * is far beyond anything measured). The space view draws it as a labelled shell where its distances fit.
 *
 * @example
 * ```ts
 * import { OORT } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(OORT.innerAu, OORT.outerAu);
 * ```
 */
export const OORT = { innerAu: 2000, outerAu: 100_000, name: { en: "Oort cloud", ja: "オールトの雲" }, about: { en: "where long-period comets are thought to come from: nothing in it has been seen", ja: "長周期彗星の起源と考えられる領域。そこにある天体はまだ見つかっていません" } } as const;

export { BELT_EPOCH };

export { BELT_TOTALS };

/**
 * A small body of a belt: the elements of `SmallBody` and the belt it is in.
 *
 * @example
 * ```ts
 * import type { BeltBody } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const achilles: BeltBody = { name: "588 Achilles", a: 5.216, e: 0.148, i: 10.3, node: 316.5, peri: 134.3, M0: 93.3, epoch: 2461200.5, H: 8.2, belt: "trojan" };
 * console.log(achilles.belt);
 * ```
 */
export interface BeltBody extends SmallBody {
  belt: BeltId;
}

/**
 * Reads the rows of one belt (`name|a|e|i|node|peri|M0|H`, one body to a line) into bodies.
 *
 * @param belt - The belt they are in.
 * @param rows - The text.
 * @param epoch - The Julian date the elements are given at.
 * @returns The bodies.
 *
 * @example
 * ```ts
 * import { parseBeltRows } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(parseBeltRows("trojan", "588 Achilles|5.216|.148|10.3|316.5|134.3|93.3|8.2", 2461200.5)[0]?.name);
 * ```
 */
export function parseBeltRows(belt: BeltId, rows: string, epoch: number): BeltBody[] {
  const out: BeltBody[] = [];
  for (const line of rows.split("\n")) {
    const f = line.split("|");
    if (f.length !== 8) continue;
    out.push({ name: f[0]!, a: Number(f[1]), e: Number(f[2]), i: Number(f[3]), node: Number(f[4]), peri: Number(f[5]), M0: Number(f[6]), epoch, H: Number(f[7]), belt });
  }
  return out;
}

let loaded: Promise<readonly BeltBody[]> | undefined;

/**
 * Fetches the bodies of every belt: a chunk of its own (about 70 kB gzipped), read once. A page that never calls this, and never draws the belts, does not carry it.
 *
 * @returns The bodies, belt by belt, the brightest first in each.
 *
 * @example
 * ```ts
 * import { loadBeltBodies } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const bodies = await loadBeltBodies();
 * console.log(bodies.length, bodies[0]?.belt);
 * ```
 */
export function loadBeltBodies(): Promise<readonly BeltBody[]> {
  loaded ??= import("./data.ts").then((data) => Object.freeze(BELT_IDS.flatMap((id) => parseBeltRows(id, data.BELT_ROWS[id] ?? "", BELT_EPOCH))));
  return loaded;
}

/**
 * The belts as a source of the data door, which `<wakusei-space>` adds itself (turn it off with `belts="off"`, or `space.enableSource("wakusei-belts", false)`): the records are fetched when the view first reads them. It is the
 * package's own source, so it is credited with the rest of the package's data and `data="own"` keeps it.
 *
 * @returns A record source of `BeltBody` records.
 *
 * @example
 * ```ts
 * import { beltsSource } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(beltsSource().info.id, beltsSource().info.licence.name);
 * ```
 */
export function beltsSource(): SmallBodySource {
  return madeHere({
    kind: "records" as const,
    info: {
      id: "wakusei-belts",
      name: { en: "Asteroid and Kuiper belts", ja: "小惑星帯とカイパーベルト" },
      credit: { en: "Asteroid, Trojan, Centaur and Kuiper belt orbits: NASA/JPL Small-Body Database", ja: "小惑星帯・トロヤ群・ケンタウルス族・カイパーベルトの軌道：NASA/JPL小天体データベース" },
      licence: { name: "Public domain (NASA/JPL: not subject to copyright in the United States)", url: "https://www.nasa.gov/nasa-brand-center/images-and-media/" },
      url: "https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html",
      retrieved: "2026-11-10",
    },
    records: (): Promise<SmallBody[]> => loadBeltBodies().then((all) => [...all]),
  });
}

/**
 * Where the bodies are on a date: heliocentric ecliptic coordinates of J2000, in astronomical units, as `x, y, z` for each (the two-body orbit of each one's elements).
 *
 * @param bodies - The bodies, from `loadBeltBodies` or your own.
 * @param jd - The date, as a Julian date (TT).
 * @returns A `Float32Array` of three numbers a body.
 *
 * @example
 * ```ts
 * import { beltPositions } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const place = beltPositions([{ name: "T", a: 2.7, e: 0.1, i: 5, node: 80, peri: 70, M0: 10, epoch: 2461200.5, H: 9 }], 2461200.5);
 * console.log(Math.hypot(place[0]!, place[1]!, place[2]!).toFixed(2));
 * ```
 */
export function beltPositions(bodies: readonly SmallBody[], jd: number): Float32Array {
  const out = new Float32Array(bodies.length * 3);
  bodies.forEach((body, k) => out.set(smallBodyAt(body, jd), k * 3));
  return out;
}

/**
 * How many bodies each belt has among the ones given.
 *
 * @param bodies - The bodies.
 * @returns A count for every belt (zero where there are none).
 *
 * @example
 * ```ts
 * import { beltCounts } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(beltCounts([{ name: "T", a: 2.7, e: 0.1, i: 5, node: 80, peri: 70, M0: 10, epoch: 2461200.5, H: 9, belt: "main" }]).main);
 * ```
 */
export function beltCounts(bodies: readonly BeltBody[]): Record<BeltId, number> {
  const out = Object.fromEntries(BELT_IDS.map((id) => [id, 0])) as Record<BeltId, number>;
  for (const body of bodies) out[body.belt] += 1;
  return out;
}

/**
 * How the bodies lie by distance from the Sun on a date: for each slice of distance, how many there are and how many to the cubic astronomical unit (the slice is a ring as thick as the bodies in it are spread above and
 * below the ecliptic).
 *
 * @param bodies - The bodies.
 * @param jd - The date, as a Julian date (TT).
 * @param options - `from` and `to` (astronomical units, 0 and 60 by default) and `bins` (60 by default).
 * @returns The start of each slice, the count in it and the density in it.
 *
 * @example
 * ```ts
 * import { beltDensity } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const bodies = [{ name: "T", a: 2.7, e: 0.1, i: 5, node: 80, peri: 70, M0: 10, epoch: 2461200.5, H: 9, belt: "main" as const }];
 * console.log(beltDensity(bodies, 2461200.5, { from: 2, to: 4, bins: 4 }).count.join(","));
 * ```
 */
export function beltDensity(bodies: readonly SmallBody[], jd: number, options: { from?: number; to?: number; bins?: number } = {}): { start: number[]; count: number[]; perCubicAu: number[] } {
  const from = options.from ?? 0;
  const to = options.to ?? 60;
  const bins = Math.max(1, Math.round(options.bins ?? 60));
  const width = (to - from) / bins;
  const count = new Array<number>(bins).fill(0);
  const z2 = new Array<number>(bins).fill(0);
  for (const body of bodies) {
    const [x, y, z] = smallBodyAt(body, jd);
    const k = Math.floor((Math.hypot(x, y, z) - from) / width);
    if (k < 0 || k >= bins) continue;
    count[k]! += 1;
    z2[k]! += z * z;
  }
  const start = count.map((_, k) => from + k * width);
  const perCubicAu = count.map((n, k) => {
    if (n < 2) return 0;
    // a flat ring of the slice's width: its half-thickness from the spread of the bodies above and below the plane (a uniform layer of half-thickness h has a root-mean-square height of h over the square root of three)
    const h = Math.max(0.02, Math.sqrt(3 * (z2[k]! / n)));
    const r0 = from + k * width;
    return n / (Math.PI * ((r0 + width) ** 2 - r0 ** 2) * 2 * h);
  });
  return { start, count, perCubicAu };
}

/** Kilometres in an astronomical unit. */
const AU_KM = 149_597_870.7;

/**
 * How far apart the bodies of a belt really are, as a typical distance between neighbours: the belt as a ring (from the tenth to the ninetieth percentile of its bodies' distances from the Sun, as thick as they are
 * spread above and below the ecliptic) shared among the bodies the database holds. Space is mostly empty: even the main belt's 1.4 million known bodies are millions of kilometres apart (the Moon is 384,000 km from the Earth), and the ones
 * this package draws, a few hundred or thousand of them, are much further apart than that. The estimate is rough (a belt's edge is not sharp) and the real number of bodies is more than the known one, so the true spacing is less.
 *
 * @param belt - The belt.
 * @param bodies - The bodies of every belt (or at least of this one).
 * @param jd - The date, as a Julian date (TT).
 * @returns `known` (kilometres between neighbours if the belt held only the bodies the database knows of), `drawn` (the same for the bodies given), and the ring's `innerAu`, `outerAu` and `thicknessAu`.
 *
 * @example
 * ```ts
 * import { beltSpacing } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const bodies = Array.from({ length: 50 }, (_, k) => ({ name: String(k), a: 2.2 + k * 0.02, e: 0.1, i: 5, node: k * 7, peri: 70, M0: k * 11, epoch: 2461200.5, H: 9, belt: "main" as const }));
 * console.log(Math.round(beltSpacing("main", bodies, 2461200.5).known / 1e6), "million km");
 * ```
 */
export function beltSpacing(belt: BeltId, bodies: readonly BeltBody[], jd: number): { known: number; drawn: number; innerAu: number; outerAu: number; thicknessAu: number } {
  const mine = bodies.filter((body) => body.belt === belt);
  const r: number[] = [];
  let z2 = 0;
  for (const body of mine) {
    const [x, y, z] = smallBodyAt(body, jd);
    r.push(Math.hypot(x, y, z));
    z2 += z * z;
  }
  r.sort((a, b) => a - b);
  const at = (q: number): number => r[Math.min(r.length - 1, Math.max(0, Math.floor(q * r.length)))] ?? 0;
  const inner = at(0.1);
  const outer = at(0.9);
  const half = Math.sqrt(3 * (z2 / Math.max(1, mine.length)));
  const volume = Math.PI * (outer ** 2 - inner ** 2) * 2 * half;
  const apart = (n: number): number => (n > 0 && volume > 0 ? Math.cbrt(volume / n) * AU_KM : 0);
  return { known: apart(BELTS[belt].known), drawn: apart(mine.length), innerAu: inner, outerAu: outer, thicknessAu: 2 * half };
}

/**
 * The sentence the space view shows while the camera is in a belt, in English or Japanese: what it is, how many bodies are known, how far apart they really are (in Moon distances, the Moon being 384,400 km from the Earth), and
 * that the dots drawn are only the brightest few and are made big enough to see.
 *
 * @param belt - The belt.
 * @param spacing - From `beltSpacing`.
 * @param language - `en` or `ja`.
 * @returns A sentence or two.
 *
 * @example
 * ```ts
 * import { beltNote } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(beltNote("main", { known: 2_800_000, drawn: 30_000_000 }, "en"));
 * ```
 */
export function beltNote(belt: BeltId, spacing: { known: number; drawn: number }, language: "en" | "ja"): string {
  const b = BELTS[belt];
  const moons = (km: number): string => (km / 384_400 < 10 ? (km / 384_400).toFixed(1) : String(Math.round(km / 384_400)));
  const million = (km: number): string => (km / 1e6 < 10 ? (km / 1e6).toFixed(1) : String(Math.round(km / 1e6)));
  const known = b.known.toLocaleString(language === "ja" ? "ja-JP" : "en-US");
  // in Japanese a distance is in 万 (ten thousand) or 億 (a hundred million) kilometres
  const wide = (km: number): string => (km >= 1e8 ? `${(km / 1e8).toFixed(1)}億km` : `${Math.round(km / 1e4).toLocaleString("ja-JP")}万km`);
  if (language === "ja") {
    return `${b.name.ja}：知られている天体は${known}個ありますが、空間がとても広いので、となりの天体まではふつう約${wide(spacing.known)} (月までの距離の約${Number(moons(spacing.known)).toLocaleString("ja-JP")}倍) も離れています。ここはほとんど何もない空間です。描いてあるのは、いちばん明るい${b.sample.toLocaleString("ja-JP")}個だけで (間隔は約${wide(spacing.drawn)})、見えるように大きめの点にしています。`;
  }
  return `${b.name.en}: ${known} bodies are known, but they fill so much room that neighbours are typically ${million(spacing.known)} million km apart, about ${moons(spacing.known)} Moon distances: space here is almost all empty. The ${b.sample.toLocaleString("en-US")} drawn are only the brightest, about ${million(spacing.drawn)} million km apart, and each dot is made large enough to see.`;
}

/** How fast the flight goes, in astronomical units a day of game time (it is a flight, not an orbit: the belt's own bodies go about thirty times slower, so they drift past). */
const FLIGHT_AU_PER_DAY = 0.3;

/**
 * A point that flies through a belt, for `<wakusei-space>`'s `ride`: a circle round the Sun in the belt's middle at 0.3 astronomical units a day of game time (about 500 kilometres a second, thirty times the speed of the bodies, which drift past), tilted
 * a few degrees to the ecliptic so that it passes through the belt's thickness, going the way the planets go. It returns the place and the velocity in kilometres and kilometres a second from the Sun's centre, in the space view's axes (equatorial J2000, y north).
 *
 * @param belt - The belt.
 * @returns A `RidePoint`: `at(ms)` gives its place and velocity at a moment.
 *
 * @example
 * ```ts
 * import { beltFlight } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const at = beltFlight("main").at(Date.UTC(2026, 10, 10));
 * console.log(Math.round(Math.hypot(...at.position) / 149_597_870.7 * 10) / 10, "au");
 * ```
 */
export function beltFlight(belt: BeltId): { at(ms: number): { position: [number, number, number]; velocity: [number, number, number] } } {
  const radii: Record<BeltId, number> = { main: 2.7, hilda: 4, trojan: 5.2, centaur: 12, classical: 43, resonant: 39.5, scattered: 60 };
  const r = radii[belt] * AU_KM;
  const speed = (FLIGHT_AU_PER_DAY * AU_KM) / 86400;
  const tilt = (6 * Math.PI) / 180;
  const obliquity = (23.4392911 * Math.PI) / 180;
  const omega = speed / r;
  // from the ecliptic of J2000 to the scene's axes: x the same, the others turned by the obliquity (as space/frame.ts does)
  const scene = (v: [number, number, number]): [number, number, number] => [v[0], v[1] * Math.sin(obliquity) + v[2] * Math.cos(obliquity), -(v[1] * Math.cos(obliquity) - v[2] * Math.sin(obliquity))];
  return {
    at(ms) {
      const t = (ms - Date.UTC(2000, 0, 1, 12)) / 1000;
      const phase = omega * t;
      // a circle in the plane tilted `tilt` about the x axis
      const c = Math.cos(phase);
      const s = Math.sin(phase);
      const position: [number, number, number] = [r * c, r * s * Math.cos(tilt), r * s * Math.sin(tilt)];
      const velocity: [number, number, number] = [-speed * s, speed * c * Math.cos(tilt), speed * c * Math.sin(tilt)];
      return { position: scene(position), velocity: scene(velocity) };
    },
  };
}
