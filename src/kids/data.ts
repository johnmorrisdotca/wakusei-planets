// What the kids' colouring sheets say: the names (with the Japanese readings), the colours to colour with and the three facts, all worked out from the package's own numbers.
import { BODIES, PLANET_IDS, type BodyId, type HostId } from "../facts.ts";
import { meanSunAu } from "../ephemeris.ts";
import { ORBITS } from "../data/orbits.ts";

export type Lang = "en" | "ja";

/**
 * The bodies that have a colouring sheet of their own: the Sun, the planets and Pluto, and the big moons.
 *
 * @example
 * ```ts
 * import { KIDS_BODIES } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * console.log(KIDS_BODIES.length, KIDS_BODIES[0]);
 * ```
 */
export const KIDS_BODIES = ["sun", ...PLANET_IDS, "moon", "io", "europa", "ganymede", "callisto", "titan", "triton", "charon"] as const;
/**
 * The name of a body that has a colouring sheet: `sun`, a planet, `pluto`, `moon`, `io`, `europa`, `ganymede`, `callisto`, `titan`, `triton` or `charon`.
 *
 * @example
 * ```ts
 * import { KIDS_BODIES, type KidsBody } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * const body: KidsBody = KIDS_BODIES[5];
 * console.log(body);
 * ```
 */
export type KidsBody = (typeof KIDS_BODIES)[number];

/**
 * Every sheet: a colouring page for each of `KIDS_BODIES`, then `lineup`, all the planets in a row at their true relative size.
 *
 * @example
 * ```ts
 * import { KIDS_SHEETS } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * console.log(KIDS_SHEETS.at(-1));
 * ```
 */
export const KIDS_SHEETS = [...KIDS_BODIES, "lineup"] as const;
/**
 * The name of a sheet: a `KidsBody` or `lineup`.
 *
 * @example
 * ```ts
 * import { type KidsSheet } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * const sheet: KidsSheet = "lineup";
 * console.log(sheet);
 * ```
 */
export type KidsSheet = (typeof KIDS_SHEETS)[number];

const READING: Partial<Record<BodyId, string>> = {
  sun: "たいよう", mercury: "すいせい", venus: "きんせい", earth: "ちきゅう", mars: "かせい", jupiter: "もくせい", saturn: "どせい", uranus: "てんのうせい", neptune: "かいおうせい", pluto: "めいおうせい", moon: "つき",
};

/** A body's name for a child: in Japanese the reading in hiragana, then the kanji in brackets. */
export function kidsName(id: BodyId, lang: Lang): string {
  const name = BODIES[id].name;
  if (lang === "en") return name.en;
  const reading = READING[id];
  return reading === undefined ? name.ja : `${reading}（${name.ja}）`;
}

/** The name alone, as a child says it. */
export const kidsSay = (id: BodyId, lang: Lang): string => (lang === "ja" ? (READING[id] ?? BODIES[id].name.ja) : BODIES[id].name.en);

/** A colour to colour with: the real colour as `#rrggbb` and its name. */
export interface Swatch {
  hex: string;
  en: string;
  ja: string;
}
const s = (hex: string, en: string, ja: string): Swatch => ({ hex, en, ja });

/** The real colours of each body, a few words each. The first is the colour the package draws the body in. */
export const SWATCHES: Readonly<Record<KidsBody, readonly Swatch[]>> = {
  sun: [s("#ffcf4d", "Yellow", "きいろ"), s("#f28c28", "Orange", "オレンジ"), s("#5b3a29", "Dark brown", "こいちゃいろ")],
  mercury: [s("#a39b92", "Grey", "はいいろ"), s("#6f6a65", "Dark grey", "こいはいいろ"), s("#cfc7bb", "Light grey", "うすいはい")],
  venus: [s("#e8cf94", "Cream", "クリーム"), s("#e0b45a", "Gold", "きんいろ"), s("#c98a4b", "Orange", "オレンジ")],
  earth: [s("#3b78c4", "Blue", "あお"), s("#4f9a52", "Green", "みどり"), s("#9b7b4f", "Brown", "ちゃいろ"), s("#ffffff", "White", "しろ")],
  mars: [s("#c76a3f", "Rust", "さびいろ"), s("#7a4a35", "Brown", "ちゃいろ"), s("#d9a77a", "Sand", "すないろ"), s("#ffffff", "White", "しろ")],
  jupiter: [s("#e8d9bd", "Cream", "クリーム"), s("#c78b55", "Orange", "オレンジ"), s("#b9503a", "Red", "あか"), s("#ffffff", "White", "しろ")],
  saturn: [s("#e4d09c", "Gold", "きんいろ"), s("#efe3c2", "Cream", "クリーム"), s("#b39b73", "Brown", "ちゃいろ")],
  uranus: [s("#a9e0e5", "Light blue", "みずいろ"), s("#6fc2cb", "Teal", "あおみどり"), s("#7d868c", "Grey", "はいいろ")],
  neptune: [s("#4a6ee0", "Blue", "あお"), s("#2f46a8", "Dark blue", "こいあお"), s("#ffffff", "White", "しろ")],
  pluto: [s("#c9a98a", "Tan", "うすちゃいろ"), s("#8c6a50", "Brown", "ちゃいろ"), s("#ecdcc8", "Cream", "クリーム")],
  moon: [s("#b8b5ae", "Grey", "はいいろ"), s("#7c7a76", "Dark grey", "こいはいいろ"), s("#eeeeea", "White", "しろ")],
  io: [s("#e5d26a", "Yellow", "きいろ"), s("#d98b3a", "Orange", "オレンジ"), s("#3a3530", "Black", "くろ")],
  europa: [s("#dcd2c0", "Cream", "クリーム"), s("#a0664a", "Brown", "ちゃいろ"), s("#ffffff", "White", "しろ")],
  ganymede: [s("#a09484", "Tan", "うすちゃいろ"), s("#6f6458", "Dark brown", "こいちゃいろ"), s("#d7cdbd", "Light", "うすいいろ")],
  callisto: [s("#70675d", "Dark brown", "こいちゃいろ"), s("#a89c8c", "Tan", "うすちゃいろ"), s("#ffffff", "White", "しろ")],
  titan: [s("#dba84a", "Orange", "オレンジ"), s("#a8743a", "Brown", "ちゃいろ"), s("#f0d58a", "Yellow", "きいろ")],
  triton: [s("#cdbbac", "Cream", "クリーム"), s("#d9a9a0", "Pink", "ピンク"), s("#8d9aa6", "Blue-grey", "あおぐろ")],
  charon: [s("#9c9189", "Grey", "はいいろ"), s("#8b4a3a", "Red-brown", "あかちゃ"), s("#d8d2cc", "Light grey", "うすいはい")],
};

/** Round to three significant figures. */
const three = (n: number): number => {
  const digits = Math.floor(Math.log10(Math.abs(n))) + 1;
  const step = 10 ** (digits - 3);
  return Math.round(n / step) * step;
};
const group = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const one = (n: number): string => (Math.round(n * 10) / 10).toString();
/** 1 decimal below 100 (the "0" is dropped), whole above. */
const short = (n: number): string => (n < 100 ? one(n) : group(n));
const times = (n: number): string => (n >= 10 ? Math.round(n).toString() : one(n));

const EARTH_KM = BODIES.earth.radiusKm;

/** A body's width across the middle, in kilometres, to three figures. */
export const widthKm = (id: BodyId): number => three(BODIES[id].radiusKm * 2);

/** How many Earths wide a body is. */
export const earthsWide = (id: BodyId): number => BODIES[id].radiusKm / EARTH_KM;

const sizeFact = (id: KidsBody, lang: Lang): string => {
  const w = group(widthKm(id));
  const ratio = earthsWide(id);
  if (id === "earth") return lang === "ja" ? `よこはば ${w}km。わたしたちの おうち！` : `${w} km across. Our home!`;
  if (ratio > 0.9 && ratio < 1.1) return lang === "ja" ? `よこはば ${w}km。ちきゅうと ほとんど おなじ おおきさ。` : `${w} km across, almost as wide as Earth.`;
  if (ratio >= 1.1) return lang === "ja" ? `よこはば ${w}km。ちきゅうの ${times(ratio)}ばい。` : `${w} km across: ${times(ratio)} times as wide as Earth.`;
  return lang === "ja" ? `よこはば ${w}km。ちきゅうの ほうが ${times(1 / ratio)}ばい おおきい。` : `${w} km across. Earth is ${times(1 / ratio)} times wider.`;
};

const daysOrHours = (hours: number, lang: Lang): string => {
  if (hours < 48) return lang === "ja" ? `${one(hours)}じかん` : `${one(hours)} hours`;
  return lang === "ja" ? `${short(hours / 24)}にち` : `${short(hours / 24)} days`;
};

const spinFact = (id: KidsBody, lang: Lang): string => {
  const hours = Math.abs(BODIES[id].rotationHours);
  const time = daysOrHours(hours, lang);
  const back = BODIES[id].rotationHours < 0;
  if (lang === "ja") return `${back ? "ぎゃくむきに " : ""}${time}で 1かい まわる。`;
  return back ? `It spins backwards, once in ${time}.` : `It spins once in ${time}.`;
};

/** How long a planet takes to go once round the Sun, in days, from the size of its orbit (Kepler's third law). */
export const yearDays = (id: HostId): number => meanSunAu(id) ** 1.5 * 365.25;

const yearFact = (id: HostId, lang: Lang): string => {
  const days = yearDays(id);
  const years = days / 365.25;
  const time = years < 1.2 ? (lang === "ja" ? `${Math.round(days)}にち` : `${Math.round(days)} days`) : lang === "ja" ? `${times(years)}ねん` : `${times(years)} years`;
  return lang === "ja" ? `たいように 1しゅうするのに ${time}。` : `It goes around the Sun in ${time}.`;
};

/** How long a moon takes to go once round its planet, in days, from its mean motion. */
export const moonPeriodDays = (id: BodyId): number => 360 / Math.abs(ORBITS[id]!.sid);

const hostOf = (id: BodyId): HostId => BODIES[id].parent!;
const hostName = (id: BodyId, lang: Lang): string => kidsSay(hostOf(id), lang);

const orbitFact = (id: KidsBody, lang: Lang): string => {
  const days = short(moonPeriodDays(id));
  const back = BODIES[id].rotationHours < 0;
  if (lang === "ja") return `${hostName(id, lang)}を ${back ? "ぎゃくむきに " : ""}1しゅうするのに ${days}にち。`;
  return `It goes around ${hostName(id, lang)} in ${days} days${back ? ", backwards!" : "."}`;
};

const faceFact = (id: KidsBody, lang: Lang): string => (lang === "ja" ? `いつも おなじ めんを ${hostName(id, lang)}に むけている。` : `It always shows the same face to ${hostName(id, lang)}.`);

const sunFacts = (lang: Lang): string[] => [
  sizeFact("sun", lang),
  lang === "ja" ? `${one(BODIES.sun.rotationHours / 24)}にちで 1かい まわる。` : `It spins once in ${one(BODIES.sun.rotationHours / 24)} days.`,
  lang === "ja" ? "ちきゅうから やく 1おく5000まんkm。" : "It is about 150 million km from Earth.",
];

/**
 * The three facts on a body's sheet, in plain words, worked out from the package's numbers: its width and how it compares with Earth, how long it takes to spin and to go round, and for a moon the face it shows.
 * @param id - A body with a sheet.
 * @param lang - `en` or `ja`.
 * @returns Three short sentences.
 *
 * @example
 * ```ts
 * import { kidsFacts } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * console.log(kidsFacts("jupiter", "en"));
 * ```
 */
export function kidsFacts(id: KidsBody, lang: Lang = "en"): string[] {
  if (id === "sun") return sunFacts(lang);
  if (BODIES[id].kind === "moon") return [sizeFact(id, lang), orbitFact(id, lang), faceFact(id, lang)];
  return [sizeFact(id, lang), spinFact(id, lang), yearFact(id as HostId, lang)];
}

/** The planets of the lineup sheet, nearest the Sun first. */
export const LINEUP_IDS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"] as const;

/** The words on the sheets that are not a body's own. */
export const SAY = {
  en: { colour: "Colour me!", brand: "Space Program X", pack: "Wakusei Planets", credits: "Sizes and spins: IAU and NASA. Drawn from numbers, not copied.", lineup: "All the planets", lineupLine: "The planets in a row, drawn to the same scale.", rings: "Rings", info: "Colouring sheet" },
  ja: { colour: "ぬってね！", brand: "Space Program X", pack: "Wakusei Planets 惑星", credits: "おおきさや まわりかた: IAU と NASA。すうじから かいた え です。", lineup: "わくせいの ならびかた", lineupLine: "おなじ ものさしで ならべた わくせい。", rings: "リング", info: "ぬりえ" },
} as const;

/** The three facts of the lineup sheet: the biggest, the smallest and the Sun, at this sheet's scale (`mmPerKm`). */
export function lineupFacts(lang: Lang, mmPerKm: number): string[] {
  const radii = LINEUP_IDS.map((id) => [id, BODIES[id].radiusKm] as const);
  const biggest = radii.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const smallest = radii.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  const sun = Math.round((BODIES.sun.radiusKm * 2 * mmPerKm) / 10);
  const x = times(earthsWide(biggest));
  return lang === "ja"
    ? [`いちばん おおきい: ${kidsSay(biggest, lang)}。ちきゅうの ${x}ばい。`, `いちばん ちいさい: ${kidsSay(smallest, lang)}。`, `ここでは たいようは ${sun}cm にも なる！`]
    : [`Biggest: ${kidsSay(biggest, lang)}, ${x} times as wide as Earth.`, `Smallest: ${kidsSay(smallest, lang)}.`, `The Sun would be ${sun} cm wide here!`];
}

