// A star drawn from numbers: its temperature gives the colour, its radius the size, its luminosity class the grain of its surface, its rotation how it turns, its activity the spots, its oblateness
// the shape and the darker equator. Nothing here is a photograph and the package holds no catalogue of stars: the page hands over the numbers. Pure: strings and numbers, no DOM, no three.js.
import { blackBodyRgb } from "./blackbody.ts";
import { BODIES, type BodyFacts, type Feature } from "./facts.ts";
import type { BodyLook } from "./scene/look.ts";

/**
 * A star's luminosity class, as the spectral type writes it: `0` a hypergiant, `Ia`, `Iab` and `Ib` supergiants, `II` a bright giant, `III` a giant, `IV` a subgiant, `V` a dwarf (the Sun is G2 V), `VI` a subdwarf and `D` a white dwarf.
 *
 * @example
 * ```ts
 * import { LUMINOSITY_CLASSES, type LuminosityClass } from "@johnmorrisdotca/wakusei-planets";
 *
 * const supergiant: LuminosityClass = LUMINOSITY_CLASSES[1];
 * console.log(supergiant, LUMINOSITY_CLASSES.length);
 * ```
 */
export const LUMINOSITY_CLASSES = ["0", "Ia", "Iab", "Ib", "II", "III", "IV", "V", "VI", "D"] as const;

/**
 * One of the classes in `LUMINOSITY_CLASSES`.
 *
 * @example
 * ```ts
 * import type { LuminosityClass } from "@johnmorrisdotca/wakusei-planets";
 *
 * const dwarf: LuminosityClass = "V";
 * console.log(dwarf);
 * ```
 */
export type LuminosityClass = (typeof LUMINOSITY_CLASSES)[number];

/**
 * The numbers that make a star's picture in `StarNumbers`, by name: the ones a page may mark as `estimated`.
 *
 * @example
 * ```ts
 * import type { StarNumberName } from "@johnmorrisdotca/wakusei-planets";
 *
 * const name: StarNumberName = "radiusSun";
 * console.log(name);
 * ```
 */
export type StarNumberName = "temperatureK" | "radiusSun" | "luminosityClass" | "rotationDays" | "oblateness";

/**
 * The numbers a star is drawn from. Only the temperature and the radius are needed; the rest has a stated default.
 *
 * @example
 * ```ts
 * import { starLook, type StarNumbers } from "@johnmorrisdotca/wakusei-planets";
 *
 * const betelgeuse: StarNumbers = { name: "Betelgeuse", temperatureK: 3600, radiusSun: 760, luminosityClass: "Ia", rotationDays: 2100 };
 * console.log(starLook(betelgeuse).colour);
 * ```
 */
export interface StarNumbers {
  /** What to call it: the picture's label. Default `Star`. */
  name?: string;
  /** The effective surface temperature in kelvin, 1,000 to 200,000. It sets the colour. */
  temperatureK: number;
  /** The radius in solar radii (the Sun is 1), above 0 and up to 5,000. It sets the size beside the Sun and the size of the rings drawn round the star. */
  radiusSun: number;
  /** The luminosity class: it sets how coarse the surface is (fine cells on a dwarf, a few giant cells on a supergiant, none on a white dwarf). Default `V`. */
  luminosityClass?: LuminosityClass;
  /** Days for one turn at the equator, negative when it turns backwards. Left out, a slow turn is drawn and the picture says the rotation is not given. */
  rotationDays?: number;
  /** How spotted it is, 0 to 1. Left out it follows the temperature and the class: none on hot stars, many on cool dwarfs and red dwarfs, few and large on giants. The spots are illustrative either way. */
  activity?: number;
  /** (equatorial radius - polar radius) / equatorial radius, 0 to 0.4. A fast spinner such as Altair is about 0.2. The star is drawn squashed, with the poles hotter than the equator (gravity darkening). Default 0. */
  oblateness?: number;
  /** The strength of the soft glow round the star, 0 to 1. Default 0.8. */
  corona?: number;
  /** The numbers above that are estimates, not measurements (a radius worked out from brightness, say). The picture says so. */
  estimated?: readonly StarNumberName[];
}

/**
 * How well a part of a star's picture is known: `measured` is a number the page gave, `estimated` one it marked as an estimate, `derived` is worked out from those numbers by a stated rule, and `illustrative` is invented to look right.
 *
 * @example
 * ```ts
 * import type { StarStatus } from "@johnmorrisdotca/wakusei-planets";
 *
 * const status: StarStatus = "illustrative";
 * console.log(status);
 * ```
 */
export type StarStatus = "measured" | "estimated" | "derived" | "illustrative";

/**
 * One part of a star's picture and how well it is known, with a sentence for a page to show in English and Japanese.
 *
 * @example
 * ```ts
 * import { starLook, type StarPart } from "@johnmorrisdotca/wakusei-planets";
 *
 * const parts: readonly StarPart[] = starLook({ temperatureK: 5772, radiusSun: 1 }).parts;
 * console.log(parts.map((part) => `${part.part}: ${part.status}`).join(", "));
 * ```
 */
export interface StarPart {
  part: "temperature" | "colour" | "size" | "edge" | "surface" | "spots" | "rotation" | "shape" | "poles" | "prominences" | "glow";
  status: StarStatus;
  note: { en: string; ja: string };
}

/**
 * A star ready to draw: its numbers with the defaults filled in, its colour, the shaded look and the facts the line drawing uses, how fast it turns on a page, and which parts of the picture are known and which invented.
 *
 * @example
 * ```ts
 * import { starLook } from "@johnmorrisdotca/wakusei-planets";
 *
 * const star = starLook({ name: "Sirius A", temperatureK: 9940, radiusSun: 1.71, luminosityClass: "V", rotationDays: 5.5 });
 * console.log(star.colour, star.disclaimer.en);
 * ```
 */
export interface StarLook {
  /** The numbers it was made from, as they were given. */
  numbers: StarNumbers;
  name: string;
  temperatureK: number;
  radiusSun: number;
  radiusKm: number;
  /** Which drawing this is: `full` or `low` (see `StarLookOptions`). */
  quality: "full" | "low";
  luminosityClass: LuminosityClass;
  /** `undefined` when the numbers gave none. */
  rotationDays: number | undefined;
  activity: number;
  oblateness: number;
  corona: number;
  /** The black-body colour of the temperature, `#rrggbb`. */
  colour: string;
  /** The colour the line drawing and a page's accents take: the bright cells of the shaded look, a little stronger than the plain black body so a star reads as coloured, `#rrggbb`. */
  tone: string;
  /** The shaded look: its `surface` is shader code with the numbers written into it. Its `id` is `sun`, the one star among the bodies. Draw it through the element's `star` attribute; it is not registered under a body. */
  look: BodyLook;
  /** The facts the line drawing uses: the Sun's, with this star's name, size, shape and the outlines of its cells and spots. */
  facts: BodyFacts;
  /** How it turns on a page: degrees a second (negative for backwards), and how many times faster than the star really turns that is (`undefined` when its rotation is not given). */
  turn: { degreesPerSecond: number; speedUp: number | undefined };
  /** Which parts of the picture are measured, estimated, derived or illustrative. */
  parts: readonly StarPart[];
  /** The sentence for a page to show with the picture. */
  disclaimer: { en: string; ja: string };
  /** The same numbers give the same key: the renderer keeps one drawing for each. */
  key: string;
}

const SUN_K = 5772;
const SUN_R_KM = 695_700;
/** How long the Sun takes to turn once at its equator, in days, and the turn a page shows for it, in degrees a second. */
const SUN_DAYS = 25.38;
const TURN = 12;

/**
 * The Sun as numbers: the first example of a star, and the size the others are drawn beside.
 *
 * @example
 * ```ts
 * import { STAR_SUN, starLook } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(STAR_SUN.temperatureK, starLook(STAR_SUN).turn.degreesPerSecond);
 * ```
 */
export const STAR_SUN: StarNumbers = { name: "Sun", temperatureK: SUN_K, radiusSun: 1, luminosityClass: "V", rotationDays: SUN_DAYS };

function within(name: string, value: number, low: number, high: number): number {
  if (!Number.isFinite(value) || value < low || value > high) throw new RangeError(`${name} must be a number from ${low} to ${high}, got ${String(value)}`);
  return value;
}

const clamp = (v: number, low: number, high: number): number => Math.min(high, Math.max(low, v));
const lerp = (table: readonly (readonly [number, number])[], x: number): number => {
  if (x <= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i += 1) {
    const [x1, y1] = table[i]!;
    if (x <= x1) {
      const [x0, y0] = table[i - 1]!;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1]![1];
};

/** How spotted a star is when the page does not say: none on hot stars, many on cool dwarfs and red dwarfs, fewer on giants (their spots are big and few). */
function defaultActivity(temperatureK: number, cls: LuminosityClass, rotationDays: number | undefined): number {
  if (cls === "D") return 0;
  let a = lerp([[3000, 0.85], [3800, 0.8], [4500, 0.6], [SUN_K, 0.35], [6500, 0.15], [7000, 0.02], [7500, 0]], temperatureK);
  if (cls === "0" || cls === "Ia" || cls === "Iab" || cls === "Ib" || cls === "II" || cls === "III") a *= 0.55;
  if (rotationDays !== undefined) a *= Math.abs(rotationDays) < 5 ? 1.5 : Math.abs(rotationDays) > 60 ? 0.7 : 1;
  return clamp(a, 0, 1);
}

/** The coarseness of the surface by class: the noise frequency of the big cells on the unit sphere (the Sun's is 24), and the share of the finer cells in the mix. */
const GRAIN: Record<LuminosityClass, readonly [number, number]> = { "0": [1.8, 0.3], Ia: [2.2, 0.3], Iab: [2.7, 0.32], Ib: [3.2, 0.35], II: [4.5, 0.4], III: [7, 0.45], IV: [13, 0.5], V: [24, 0.55], VI: [28, 0.55], D: [0, 0] };

/** How many cell outlines the line drawing has, and how wide each is, in degrees, by class. */
const CELLS: Record<LuminosityClass, readonly [number, number]> = { "0": [6, 30], Ia: [7, 28], Iab: [9, 24], Ib: [12, 20], II: [18, 16], III: [28, 12], IV: [40, 9], V: [60, 6.5], VI: [70, 5], D: [0, 0] };

/** How strongly a surface shows its cells: full for a cool star, fading through the hot ones whose outer layers are not convecting, none for a white dwarf. */
const visibility = (temperatureK: number, cls: LuminosityClass): number => (cls === "D" ? 0 : clamp((9500 - temperatureK) / 3000, 0.12, 1));

const f = (x: number): string => x.toFixed(4);
const v3 = (c: readonly number[]): string => `vec3(${f(c[0]!)}, ${f(c[1]!)}, ${f(c[2]!)})`;
const unit = (kelvin: number): [number, number, number] => blackBodyRgb(kelvin).map((v) => v / 255) as [number, number, number];
const saturate = (c: readonly number[], s: number): [number, number, number] => {
  const l = c[0]! * 0.3 + c[1]! * 0.59 + c[2]! * 0.11;
  return [0, 1, 2].map((i) => clamp(l + (c[i]! - l) * s, 0, 1)) as [number, number, number];
};
const hex = (c: readonly number[]): string => `#${[0, 1, 2].map((i) => Math.round(clamp(c[i]!, 0, 1) * 255).toString(16).padStart(2, "0")).join("")}`;

/** Deterministic random numbers from a seed, so the same numbers give the same spots. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (text: string): number => [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** The outlines of a star's cells and spots for the line drawing, as features on the body (longitude and latitude in degrees). */
function features(cls: LuminosityClass, gran: number, activity: number, key: string): Feature[] {
  const rnd = random(seedOf(key));
  const out: Feature[] = [];
  const [count, width] = CELLS[cls];
  const cells = gran < 0.2 ? 0 : Math.round(count * gran);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < cells; i += 1) {
    const z = 1 - (2 * (i + 0.5)) / cells;
    const lat = (Math.asin(z) * 180) / Math.PI;
    const lon = ((((i * golden * 180) / Math.PI) % 360) + 360) % 360 - 180;
    out.push({ kind: "circle", lon, lat, radius: width * (0.55 + 0.35 * rnd()) });
  }
  const spots = Math.round(activity * 14);
  const giant = cls === "0" || cls === "Ia" || cls === "Iab" || cls === "Ib" || cls === "II" || cls === "III";
  const band = 25 + 43 * activity;
  for (let i = 0; i < spots; i += 1) {
    const lat = (rnd() * 2 - 1) * band;
    const lon = rnd() * 360 - 180;
    const radius = giant ? (cls === "III" ? 7 : 12) + rnd() * 5 : 2.2 + rnd() * 2.4;
    out.push({ kind: "circle", lon, lat, radius, fill: true });
    out.push({ kind: "circle", lon, lat, radius: radius * 1.7 });
  }
  return out;
}

const parts = (s: { temperatureK: number; radiusSun: number; cls: LuminosityClass; rotationDays: number | undefined; oblateness: number; speedUp: number | undefined; estimated: ReadonlySet<StarNumberName>; prominence: boolean }): StarPart[] => {
  const known = (name: StarNumberName): StarStatus => (s.estimated.has(name) ? "estimated" : "measured");
  const ratio = s.radiusSun >= 10 ? Math.round(s.radiusSun).toLocaleString("en-US") : String(Number(s.radiusSun.toPrecision(3)));
  const out: StarPart[] = [
    { part: "temperature", status: known("temperatureK"), note: { en: `Surface temperature: ${Math.round(s.temperatureK).toLocaleString("en-US")} K, as given.`, ja: `表面の温度: ${Math.round(s.temperatureK)} K (与えられた数字)。` } },
    { part: "colour", status: "derived", note: { en: "Colour: a black body at that temperature, the way a camera shows it. It is not a spectrum.", ja: "色: その温度の黒体の色 (カメラで見た色)。スペクトルではありません。" } },
    { part: "size", status: known("radiusSun"), note: { en: `Size: ${ratio} times the Sun's radius, as given.`, ja: `大きさ: 太陽の半径の${ratio}倍 (与えられた数字)。` } },
    { part: "edge", status: "derived", note: { en: "Edge darkening: worked out from the temperature, roughly.", ja: "ふちの暗さ: 温度からおおよそ計算しています。" } },
    { part: "surface", status: "illustrative", note: { en: `Surface texture: how coarse it is follows the luminosity class (${s.cls}); the pattern itself is invented.`, ja: `表面のもよう: 細かさは明るさの階級 (${s.cls}) で決めています。もようは作りものです。` } },
    { part: "spots", status: "illustrative", note: { en: "Spots: how many follows the temperature and the class; where they are is invented. They are not observations.", ja: "黒点: 数は温度と階級から決めています。場所は作りものです。観測ではありません。" } },
  ];
  if (s.rotationDays === undefined) out.push({ part: "rotation", status: "illustrative", note: { en: "Turning: no rotation was given, so a slow turn is drawn.", ja: "自転: 数字がないので、ゆっくり回しています。" } });
  else {
    const times = s.speedUp === undefined ? "" : Math.round(s.speedUp).toLocaleString("en-US");
    out.push({ part: "rotation", status: known("rotationDays"), note: { en: `Turning: one turn in ${Number(Math.abs(s.rotationDays).toPrecision(3))} days, shown ${times} times faster than real.`, ja: `自転: 1周${Number(Math.abs(s.rotationDays).toPrecision(3))}日。実際の${times}倍の速さで見せています。` } });
  }
  if (s.oblateness > 0) {
    out.push({ part: "shape", status: known("oblateness"), note: { en: `Shape: flattened by ${Number(s.oblateness.toPrecision(2))}, as given.`, ja: `形: ${Number(s.oblateness.toPrecision(2))}だけつぶれています (与えられた数字)。` } });
    out.push({ part: "poles", status: "derived", note: { en: "Hotter poles and a darker equator (gravity darkening): worked out from the flattening.", ja: "極は熱く、赤道は暗い (重力暗化): つぶれ方から計算しています。" } });
  }
  if (s.prominence) out.push({ part: "prominences", status: "illustrative", note: { en: "Prominences and flares on the edge: drawn for looks on an active star, not observed.", ja: "ふちの炎 (プロミネンスやフレア): 活発な星に見た目のために描いています。観測ではありません。" } });
  out.push({ part: "glow", status: "illustrative", note: { en: "The soft glow round the star is for looks, not a measurement.", ja: "星のまわりのやわらかい光は、見た目のための作りものです。" } });
  return out;
};

/**
 * How much to spend drawing a star: `full` boils its granulation and draws prominences and flares on the edge of an active star; `low` is a still surface and a soft glow, for weak devices.
 *
 * @example
 * ```ts
 * import { starLook, type StarLookOptions } from "@johnmorrisdotca/wakusei-planets";
 *
 * const options: StarLookOptions = { quality: "low" };
 * console.log(starLook({ temperatureK: 3042, radiusSun: 0.154 }, options).quality);
 * ```
 */
export interface StarLookOptions {
  quality?: "full" | "low";
}

/**
 * Everything the package draws a star with, from the numbers alone: the same numbers always give the same star. Throws a `RangeError` that names the number when one is out of range.
 *
 * The colour is the black body of `temperatureK`. The surface is grained by the luminosity class (and faint on hot stars, smooth on a white dwarf), spotted by `activity` (none on hot stars by default, many on
 * cool dwarfs), darker toward the edge by the temperature, flattened by `oblateness` with hotter poles, and ringed with a soft corona. The cells and the spots are invented; `parts` says which parts are not.
 *
 * @param numbers - The star's numbers.
 * @param options - `quality: "low"` for a cheaper drawing for weak devices (no boiling granulation, no prominences or flares); the default is `full`.
 * @returns The star ready to draw.
 *
 * @example
 * ```ts
 * import { starLook } from "@johnmorrisdotca/wakusei-planets";
 *
 * const rigel = starLook({ name: "Rigel", temperatureK: 12100, radiusSun: 78.9, luminosityClass: "Ia", rotationDays: 25 });
 * console.log(rigel.colour, rigel.activity, rigel.parts.filter((part) => part.status === "illustrative").length);
 * ```
 */
export function starLook(numbers: StarNumbers, options: StarLookOptions = {}): StarLook {
  const low = options.quality === "low";
  const temperatureK = within("temperatureK", numbers.temperatureK, 1000, 200_000);
  const radiusSun = within("radiusSun", numbers.radiusSun, 1e-4, 5000);
  const cls = numbers.luminosityClass ?? "V";
  if (!(LUMINOSITY_CLASSES as readonly string[]).includes(cls)) throw new RangeError(`luminosityClass must be one of ${LUMINOSITY_CLASSES.join(", ")}, got ${String(cls)}`);
  const rotationDays = numbers.rotationDays === undefined ? undefined : within("rotationDays", numbers.rotationDays, -1e6, 1e6);
  if (rotationDays === 0) throw new RangeError("rotationDays must not be 0: leave it out when the rotation is not known");
  const oblateness = numbers.oblateness === undefined ? 0 : within("oblateness", numbers.oblateness, 0, 0.4);
  const corona = numbers.corona === undefined ? 0.8 : within("corona", numbers.corona, 0, 1);
  const activity = numbers.activity === undefined ? defaultActivity(temperatureK, cls, rotationDays) : within("activity", numbers.activity, 0, 1);
  const name = numbers.name !== undefined && numbers.name.trim() !== "" ? numbers.name.trim() : "Star";
  const estimated = new Set(numbers.estimated ?? []);

  // colour: the black body for the cells, a cooler and more saturated one for the lanes between them
  const body = unit(temperatureK);
  const cell = saturate(unit(temperatureK * 1.06), 2);
  const lane = saturate(unit(temperatureK * (0.62 + 0.3 * clamp((temperatureK - 5000) / 7000, 0, 1))), 2.6).map((v) => v * 0.85) as [number, number, number];
  const gran = visibility(temperatureK, cls);
  const [grainFreq, grainFine] = GRAIN[cls];
  const band = 25 + 43 * activity;
  const threshold = 0.74 - 0.2 * activity;
  const spotFreq = cls === "0" || cls === "Ia" ? 2 : cls === "Iab" || cls === "Ib" || cls === "II" ? 2.6 : cls === "III" ? 3.4 : temperatureK < 3900 ? 6.5 : 5;

  // gravity darkening: the pole is hotter than the equator by (1 - 3e)^beta, beta 0.25 for a star whose envelope is radiative and 0.08 for a convective one (von Zeipel; Lucy)
  const beta = temperatureK > 7000 ? 0.25 : 0.08;
  const eq = oblateness > 0 ? Math.pow(Math.max(0.05, 1 - 3 * oblateness), beta) : 1;
  const pole = (2 * temperatureK) / (1 + eq);
  const ratioAt = (k: number): [number, number, number] => {
    const c = unit(k);
    const b = (k / temperatureK) ** 2;
    return [c[0] / body[0] * b, c[1] / body[1] * b, c[2] / body[2] * b];
  };

  const grain =
    cls === "D"
      ? "float cell = 0.8;"
      : low
        ? `float g = fbm(p * ${f(grainFreq)});
  float g2 = fbm(p * ${f(grainFreq * 2.9)} + 4.0);
  float cell = mix(0.8, smoothstep(0.32, 0.72, mix(g, g2, ${f(grainFine)})), ${f(gran)});`
        : `float boil = 0.5 + 0.5 * sin(uTime * 0.35);
  float g = fbm(p * ${f(grainFreq)} + vec3(0.0, 0.0, uTime * 0.004));
  float g2 = mix(fbm(p * ${f(grainFreq * 2.9)} + 4.0), fbm(p * ${f(grainFreq * 2.9)} + 11.0), boil);
  float cell = mix(0.8, smoothstep(0.32, 0.72, mix(g, g2, ${f(grainFine)})), ${f(gran)});`;
  const shape = oblateness > 0 ? `\n  col *= mix(${v3(ratioAt(pole))}, ${v3(ratioAt(eq * pole))}, 1.0 - p.z * p.z);` : "";
  const spots =
    activity > 0.02
      ? `
  float act = smoothstep(radians(${f(band)}), radians(8.0), abs(lat(p)));
  float sn = fbm(p * ${f(spotFreq)} + 3.0);
  float spot = smoothstep(${f(threshold)}, ${f(threshold + 0.08)}, sn) * act;
  float pen = smoothstep(${f(threshold - 0.07)}, ${f(threshold)}, sn) * act;
  col = mix(col, ${v3(lane.map((v) => v * 0.6))}, pen * 0.55);
  col = mix(col, ${v3(lane.map((v) => v * 0.16))}, spot * 0.92);`
      : "";
  const surface = `${low || cls === "D" ? "" : "\nuniform float uTime;"}
vec4 surface(vec3 p) {
  ${grain}
  vec3 col = mix(${v3(lane)}, ${v3(cell)}, cell);${low ? "" : "\n  col *= 0.8 + 0.4 * smoothstep(0.1, 0.9, cell);"}${shape}${spots}
  return vec4(col * 1.12, 0.0);
}`;

  // the edge: the exponent of the limb darkening, and the colour the edge shifts to (a cooler layer seen at a slant)
  const limb = clamp(0.5 + (SUN_K - temperatureK) / 30_000, 0.2, 0.7);
  const cool = unit(temperatureK * 0.78);
  const tint = [0, 1, 2].map((i) => Math.min(1, (cool[i]! / body[i]!) ** 1.4)) as [number, number, number];
  const glowColour = saturate(body, 1.1);
  const spread = clamp(2.4 + (SUN_K - temperatureK) / 12_000, 1.7, 3.4);
  const prominence = low || activity < 0.15 ? 0 : clamp(activity * 1.1, 0, 1);

  const speedReal = rotationDays === undefined ? undefined : 360 / (Math.abs(rotationDays) * 86_400);
  const shown = rotationDays === undefined ? TURN : clamp(TURN * (SUN_DAYS / Math.abs(rotationDays)) ** 0.4, 2, 60);
  const degreesPerSecond = (rotationDays !== undefined && rotationDays < 0 ? -1 : 1) * shown;
  const speedUp = speedReal === undefined ? undefined : shown / speedReal;

  const key = JSON.stringify([low ? "low" : "full", name, temperatureK, radiusSun, cls, rotationDays ?? null, activity, oblateness, corona]);
  const colour = hex(body);
  const look: BodyLook = { id: "sun", surface, emissive: true, limb, limbTint: tint, glow: { colour: glowColour, strength: 0.62 * corona, spread, rim: 0.3 * corona, prominence, seed: (seedOf(key) % 1000) / 1000 } };
  const facts: BodyFacts = {
    ...BODIES.sun,
    name: { en: name, ja: name === "Star" ? "恒星" : name },
    radiusKm: radiusSun * SUN_R_KM,
    flattening: oblateness,
    rotationHours: (rotationDays ?? SUN_DAYS) * 24,
    colour,
    features: features(cls, gran, activity, key),
  };
  const lines = parts({ temperatureK, radiusSun, cls, rotationDays, oblateness, speedUp, estimated, prominence: prominence > 0 });
  return {
    numbers,
    name,
    temperatureK,
    radiusSun,
    radiusKm: radiusSun * SUN_R_KM,
    quality: low ? "low" : "full",
    luminosityClass: cls,
    rotationDays,
    activity,
    oblateness,
    corona,
    colour,
    tone: hex(cell),
    look,
    facts,
    turn: { degreesPerSecond, speedUp },
    parts: lines,
    disclaimer: { en: `${name}: drawn from its numbers, not a photo.`, ja: `${name}: 数字から描いた絵で、写真ではありません。` },
    key,
  };
}
