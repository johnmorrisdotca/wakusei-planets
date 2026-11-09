// The size line-up's table of radii: every star's radius with its uncertainty, how it was got, and the refereed paper it comes from. Typed here, never read from a catalogue, an infographic or an encyclopedia.
// A radius is an angular diameter (interferometry, where it exists) times a distance. Where the star has no measured angular diameter, or its distance is not a measured one, the row says so (`basis`).
// Pure: strings and numbers, no DOM, no three.js. This package never imports hoshi-stars: the stars it needs are typed here.
import { BODIES } from "../facts.ts";
import type { StarNumbers } from "../star.ts";

/** The Sun's nominal radius in kilometres (IAU 2015 Resolution B3), the unit of every radius in the table. */
export const SUN_RADIUS_KM = 695_700;

/**
 * How well a radius is known: `defined` is the IAU's nominal value for the Sun, `angle` is a measured angular diameter times a measured distance, `weak-distance` is a measured angular diameter times a distance that is
 * not a parallax (so the size could be much off), and `luminosity` is worked out from the star's brightness, temperature and distance because no angular diameter has been measured.
 *
 * @example
 * ```ts
 * import { LINEUP_STARS, type RadiusBasis } from "@johnmorrisdotca/wakusei-planets";
 *
 * const basis: RadiusBasis = LINEUP_STARS[0]!.basis;
 * console.log(basis);
 * ```
 */
export type RadiusBasis = "defined" | "angle" | "weak-distance" | "luminosity";

/**
 * One row of the radius table: a star, its radius in Suns with the error on each side, how it was got, and the paper. `how` says whether the radius is the paper's own (`paper`) or was worked out here from numbers
 * the paper gives (`worked-out`: the radius of an angular diameter at the paper's distance, or of a luminosity and a temperature by the Stefan-Boltzmann law).
 *
 * @example
 * ```ts
 * import { LINEUP_STARS, type RadiusRow } from "@johnmorrisdotca/wakusei-planets";
 *
 * const row: RadiusRow = LINEUP_STARS.find((one) => one.id === "betelgeuse")!;
 * console.log(row.radiusSun, row.bibcodes[0]);
 * ```
 */
export interface RadiusRow {
  /** A short key: `sirius-a`. */
  id: string;
  name: { en: string; ja: string };
  /** The radius in solar radii (equatorial, for a star that is flattened). */
  radiusSun: number;
  /** The error below and above the radius, in solar radii, both positive or 0. */
  minus: number;
  plus: number;
  basis: RadiusBasis;
  how: "paper" | "worked-out";
  /** One sentence: what was measured and how the radius follows. */
  method: { en: string; ja: string };
  /** The measured angular diameter in milliarcseconds (limb-darkened, or Rosseland where the paper says so), when the radius comes from one. */
  thetaMas?: number;
  /** The distance in parsecs when it is the paper's own result and not a catalogue parallax (the catalogue parallaxes of Hipparcos and Gaia are not copied here). */
  distancePc?: number;
  /** The papers, as a short citation for a label. */
  cite: string;
  /** The ADS bibcodes of the papers the radius and the temperature come from, the first being the radius's. */
  bibcodes: readonly string[];
  /** The date the paper was read, `YYYY-MM-DD`. */
  read: string;
  /** What the literature disagrees about, when it does: it goes on the label and in the guide. */
  note?: { en: string; ja: string };
  /** Other published radii that are not used, and why. */
  others?: readonly { radiusSun: number; cite: string; why: { en: string; ja: string } }[];
  /** What the star is drawn from: the temperature, its class and the rest. The radius is filled in from this row. */
  look: Omit<StarNumbers, "radiusSun" | "name" | "estimated">;
  /** Where the temperature comes from. */
  temperatureFrom: string;
}

const READ = "2026-11-09";

/**
 * The stars of the line-up with their radii, smallest first: the Sun, Sirius A, Vega, Arcturus, Aldebaran, Rigel, Antares, Betelgeuse, VY Canis Majoris, WOH G64, UY Scuti and Stephenson 2-18. Each radius comes from a refereed
 * paper that measured the star's angular diameter and used a distance, except where the row's `basis` says otherwise; `NOTICE.md` and the guide list the sources and every disagreement.
 *
 * @example
 * ```ts
 * import { LINEUP_STARS } from "@johnmorrisdotca/wakusei-planets";
 *
 * for (const row of LINEUP_STARS) console.log(row.name.en, row.radiusSun, `(-${row.minus} +${row.plus})`, row.cite);
 * ```
 */
export const LINEUP_STARS: readonly RadiusRow[] = [
  {
    id: "sun",
    name: { en: "Sun", ja: "太陽" },
    radiusSun: 1,
    minus: 0,
    plus: 0,
    basis: "defined",
    how: "paper",
    method: { en: "The IAU's nominal solar radius, 695,700 km, a defined value.", ja: "IAUが定めた太陽半径の公称値、695,700 km。" },
    cite: "Prša et al. 2016",
    bibcodes: ["2016AJ....152...41P"],
    read: READ,
    look: { temperatureK: 5772, luminosityClass: "V", rotationDays: 25.38 },
    temperatureFrom: "IAU 2015 Resolution B3 nominal effective temperature (Prša et al. 2016)",
  },
  {
    id: "sirius-a",
    name: { en: "Sirius A", ja: "シリウスA" },
    radiusSun: 1.7144,
    minus: 0.009,
    plus: 0.009,
    basis: "angle",
    how: "paper",
    method: { en: "Interferometry with SUSI gave an angular diameter of 6.048 mas (Davis et al. 2011); Bond et al. 2017 turn it into a radius with the star's parallax.", ja: "SUSI干渉計で角直径6.048 mas (Davis ほか 2011)。Bond ほか 2017 が視差から距離を求め、半径に換算しました。" },
    thetaMas: 6.048,
    distancePc: 2.6393,
    cite: "Bond et al. 2017; Davis et al. 2011",
    bibcodes: ["2017ApJ...840...70B", "2011PASA...28...58D"],
    read: READ,
    look: { temperatureK: 9845, luminosityClass: "V" },
    temperatureFrom: "Bond et al. 2017 (the values of Davis et al. 2011 with their parallax)",
  },
  {
    id: "vega",
    name: { en: "Vega", ja: "ベガ" },
    radiusSun: 2.726,
    minus: 0.006,
    plus: 0.006,
    basis: "angle",
    how: "paper",
    method: { en: "CHARA/MIRC interferometry fits a fast-spinning, flattened star seen almost pole-on: the equatorial radius is 2.726 Suns and the polar one 2.418, so the star is flattened by 0.113.", ja: "CHARA/MIRC干渉計の観測に、ほぼ極の方向から見た、高速で自転してつぶれた星のモデルを当てはめました。赤道半径は太陽の2.726倍、極半径は2.418倍で、扁平率は0.113です。" },
    thetaMas: 3.302,
    cite: "Monnier et al. 2012",
    bibcodes: ["2012ApJ...761L...3M"],
    read: READ,
    look: { temperatureK: 9660, luminosityClass: "V", rotationDays: 0.71, oblateness: 0.113 },
    temperatureFrom: "Monnier et al. 2012 (the apparent temperature of the fit)",
  },
  {
    id: "arcturus",
    name: { en: "Arcturus", ja: "アークトゥルス" },
    radiusSun: 25.4,
    minus: 0.2,
    plus: 0.2,
    basis: "angle",
    how: "paper",
    method: { en: "The limb-darkened angular diameter, 21.06 mas, is the weighted mean of the interferometric measurements; with the star's parallax it gives the radius.", ja: "周縁減光を補正した角直径21.06 masは、干渉計による測定の加重平均です。視差から求めた距離と合わせて半径を出しています。" },
    thetaMas: 21.06,
    cite: "Ramírez and Allende Prieto 2011",
    bibcodes: ["2011ApJ...743..135R"],
    read: READ,
    look: { temperatureK: 4286, luminosityClass: "III" },
    temperatureFrom: "Ramírez and Allende Prieto 2011",
  },
  {
    id: "aldebaran",
    name: { en: "Aldebaran", ja: "アルデバラン" },
    radiusSun: 44.2,
    minus: 0.9,
    plus: 0.9,
    basis: "angle",
    how: "paper",
    method: { en: "The mean of lunar-occultation and interferometric diameters, 20.58 mas once limb darkening is allowed for, at the star's parallax distance.", ja: "月による掩蔽と干渉計で測った直径の平均は、周縁減光を補正すると20.58 masです。視差から求めた距離を使って半径にしました。" },
    thetaMas: 20.58,
    cite: "Richichi and Roccatagliata 2005",
    bibcodes: ["2005A&A...433..305R"],
    read: READ,
    look: { temperatureK: 3934, luminosityClass: "III" },
    temperatureFrom: "Richichi and Roccatagliata 2005",
  },
  {
    id: "rigel",
    name: { en: "Rigel", ja: "リゲル" },
    radiusSun: 78.9,
    minus: 7.4,
    plus: 7.4,
    basis: "angle",
    how: "paper",
    method: { en: "The limb-darkened angular diameter, 2.75 mas (Aufdenberg et al. 2008), at the star's parallax distance; the distance is most of the error.", ja: "周縁減光を補正した角直径2.75 mas (Aufdenberg ほか 2008) に、視差から求めた距離を使って半径を出しました。誤差の大半は距離の不確かさによります。" },
    thetaMas: 2.75,
    cite: "Moravveji et al. 2012",
    bibcodes: ["2012ApJ...747..108M"],
    read: READ,
    look: { temperatureK: 12_100, luminosityClass: "Ia" },
    temperatureFrom: "Przybilla et al. 2010, as listed by Moravveji et al. 2012",
  },
  {
    id: "antares",
    name: { en: "Antares", ja: "アンタレス" },
    radiusSun: 680,
    minus: 99,
    plus: 139,
    basis: "angle",
    how: "paper",
    method: { en: "VLTI/AMBER interferometry gave a limb-darkened diameter of 37.38 mas; with the star's parallax the paper gets 680 Suns. The error is worked out here from the 17 percent error of that parallax.", ja: "VLTI/AMBER干渉計で、周縁減光を補正した直径37.38 mas。視差と合わせて、論文は太陽の680倍と出しています。誤差は、その視差の誤差17%からここで計算しました。" },
    thetaMas: 37.38,
    cite: "Ohnaka et al. 2013",
    bibcodes: ["2013A&A...555A..24O"],
    read: READ,
    look: { temperatureK: 3660, luminosityClass: "Iab" },
    temperatureFrom: "Ohnaka et al. 2013",
  },
  {
    id: "betelgeuse",
    name: { en: "Betelgeuse", ja: "ベテルギウス" },
    radiusSun: 1057,
    minus: 162,
    plus: 228,
    basis: "angle",
    how: "worked-out",
    method: {
      en: "The limb-darkened angular diameter, 44.28 mas (H-band interferometry, Haubois et al. 2009), at the distance of 222 pc (+48, -34) that Harper et al. 2017 get from radio and Hipparcos positions. Worked out here: half the angle times the distance.",
      ja: "周縁減光を補正した角直径44.28 mas (Hバンド干渉計、Haubois ほか 2009) と、Harper ほか 2017 が電波とヒッパルコス衛星の位置から得た距離222 pc (+48, -34)。角直径の半分に距離をかけて、ここで計算しました。",
    },
    thetaMas: 44.28,
    distancePc: 222,
    cite: "Haubois et al. 2009; Harper et al. 2017",
    bibcodes: ["2009A&A...508..923H", "2017AJ....154...11H", "2005ApJ...628..973L"],
    read: READ,
    note: {
      en: "The size is only as good as the distance, which is hard to measure for a star this big. The same angle at the other solution of Harper et al. (190 pc) gives about 905 Suns, and Joyce et al. 2020 get 764 Suns from stellar models and a distance of 168 pc. This line-up uses the measured angle and the paper's nominal distance; a size from models is not a measurement.",
      ja: "大きさは距離しだいですが、これほど大きい星の距離は測りにくいのです。Harper ほかのもう一つの解 (190 pc) だと、同じ角直径で太陽の約905倍、Joyce ほか 2020 は星のモデルと距離168 pcから764倍を出しています。ここでは、測った角直径と、論文が標準とした距離を使います。モデルから出した大きさは測定ではありません。",
    },
    others: [
      { radiusSun: 905, cite: "the same angle at 190 pc, Harper et al. 2017", why: { en: "their other solution, from the radio positions alone", ja: "電波の位置だけによる、もう一つの解" } },
      { radiusSun: 764, cite: "Joyce et al. 2020 (ApJ 902, 63)", why: { en: "from stellar models and asteroseismology, not from a measured size", ja: "測った大きさではなく、星のモデルと星震学から" } },
    ],
    look: { temperatureK: 3650, luminosityClass: "Iab" },
    temperatureFrom: "Levesque et al. 2005",
  },
  {
    id: "vy-canis-majoris",
    name: { en: "VY Canis Majoris", ja: "おおいぬ座VY星" },
    radiusSun: 1420,
    minus: 120,
    plus: 120,
    basis: "angle",
    how: "paper",
    method: {
      en: "VLTI/AMBER interferometry gave a Rosseland angular diameter of 11.3 mas (±0.3) at a distance of 1.17 kpc (±0.08), the mean of the radio parallaxes of Choi et al. 2008 and Zhang et al. 2012.",
      ja: "VLTI/AMBER干渉計でロスランド角直径11.3 mas (±0.3)。距離1.17 kpc (±0.08) は、Choi ほか 2008 と Zhang ほか 2012 の電波による視差の平均です。",
    },
    thetaMas: 11.3,
    distancePc: 1170,
    cite: "Wittkowski et al. 2012",
    bibcodes: ["2012A&A...540L..12W", "2012ApJ...744...23Z"],
    read: READ,
    note: {
      en: "Older papers used a distance of 1.5 kpc and drew a larger star. The radio parallaxes brought the distance to about 1.2 kpc and the radius down to about 1,400 Suns.",
      ja: "古い論文は距離を1.5 kpcとして、もっと大きな星だと考えていました。電波による視差で距離が約1.2 kpcになり、半径は太陽の約1,400倍になりました。",
    },
    look: { temperatureK: 3490, luminosityClass: "0" },
    temperatureFrom: "Wittkowski et al. 2012",
  },
  {
    id: "woh-g64",
    name: { en: "WOH G64", ja: "WOH G64" },
    radiusSun: 1540,
    minus: 77,
    plus: 77,
    basis: "luminosity",
    how: "paper",
    method: {
      en: "No angular diameter of the star itself has been measured. Levesque et al. 2009 fit its spectrum for a temperature of 3,400 K (±25) and take its brightness (log L = 5.45) at the 50 kpc of the Large Magellanic Cloud: 1,540 Suns, an error of 5 percent.",
      ja: "星そのものの角直径は測られていません。Levesque ほか 2009 は、スペクトルから温度3,400 K (±25) を求め、明るさ (log L = 5.45) を大マゼラン雲の距離50 kpcで使って、太陽の1,540倍、誤差5%と出しました。",
    },
    cite: "Levesque et al. 2009",
    bibcodes: ["2009AJ....137.4744L", "2008A&A...484..371O", "2024A&A...691L..15O"],
    read: READ,
    note: {
      en: "Ohnaka et al. 2008 got 1,730 Suns from a model of the dust round it, and the star changed between 2009 and 2016 (Ohnaka et al. 2024), so no single radius is final. The 2 mas image of 2024 is the dust, not the star's disc. The size here is from brightness and temperature: estimated, not measured.",
      ja: "Ohnaka ほか 2008 はまわりのちりのモデルから太陽の1,730倍を出しました。また、この星は2009年から2016年の間に変化しています (Ohnaka ほか 2024)。決まった半径はありません。2024年の2 masの画像は、星の円盤ではなくちりです。ここでの大きさは明るさと温度から求めたもので、測定ではなく推定です。",
    },
    others: [{ radiusSun: 1730, cite: "Ohnaka et al. 2008 (A&A 484, 371)", why: { en: "from a dust-torus model at an assumed temperature of 3,200 K", ja: "温度を3,200 Kと仮定した、ちりのトーラスのモデルから" } }],
    look: { temperatureK: 3400, luminosityClass: "Ia" },
    temperatureFrom: "Levesque et al. 2009",
  },
  {
    id: "uy-scuti",
    name: { en: "UY Scuti", ja: "たて座UY星" },
    radiusSun: 1708,
    minus: 192,
    plus: 192,
    basis: "weak-distance",
    how: "paper",
    method: {
      en: "VLTI/AMBER interferometry gave a Rosseland angular diameter of 5.48 mas (±0.10). The paper's distance, about 2.9 kpc, is an old estimate and not a parallax, so the radius could be well off.",
      ja: "VLTI/AMBER干渉計でロスランド角直径5.48 mas (±0.10)。論文の距離 (約2.9 kpc) は古い推定で視差ではないので、半径は大きくずれているかもしれません。",
    },
    thetaMas: 5.48,
    cite: "Arroyo-Torres et al. 2013",
    bibcodes: ["2013A&A...554A..76A"],
    read: READ,
    note: {
      en: "Only the angle is measured. At a distance of about 1.8 kpc from Gaia-era work the same angle gives about 1,060 Suns, and Healy et al. 2024 give a revised 909 Suns from photometry and a Gaia distance, not from a measured size. This line-up keeps the measured angle at the distance the measuring paper used, and says the size is uncertain; take 900 to 1,700 Suns as the range.",
      ja: "測ったのは角直径だけです。ガイア時代の距離約1.8 kpcなら、同じ角直径で太陽の約1,060倍になります。Healy ほか 2024 は、測った大きさではなく、測光とガイアの距離から改訂値の909倍を出しています。ここでは、測った角直径と、それを測った論文が使った距離を使い、大きさは不確かだと書きます。太陽の900倍から1,700倍の間と考えてください。",
    },
    others: [
      { radiusSun: 1060, cite: "the same angle at about 1.8 kpc", why: { en: "worked out here with a Gaia-era distance, which is not copied into this package", ja: "ガイア時代の距離を使った、ここでの計算 (その距離の値はこのパッケージには入れません)" } },
      { radiusSun: 909, cite: "Healy et al. 2024 (MNRAS 529, 3630)", why: { en: "from photometry and a Gaia distance, not from a measured size", ja: "測った大きさではなく、測光とガイアの距離から" } },
    ],
    look: { temperatureK: 3365, luminosityClass: "Ia" },
    temperatureFrom: "Arroyo-Torres et al. 2013",
  },
  {
    id: "stephenson-2-18",
    name: { en: "Stephenson 2-18", ja: "ステファンソン2-18" },
    radiusSun: 2150,
    minus: 290,
    plus: 710,
    basis: "luminosity",
    how: "worked-out",
    method: {
      en: "No angular diameter has been measured. Fok et al. 2012 fit its dust and get a temperature of 3,200 K and log L = 5.64 at 5.5 kpc (the cluster's kinematic distance, Deguchi et al. 2010). Worked out here by the Stefan-Boltzmann law; the error is from the distance alone (5.83, +1.91 -0.78 kpc, Davies et al. 2007).",
      ja: "角直径は測られていません。Fok ほか 2012 はちりのモデルから温度3,200 Kを求め、星団の運動学的な距離5.5 kpc (Deguchi ほか 2010) で log L = 5.64 としました。半径は、ステファン・ボルツマンの法則を使ってここで計算しました。誤差は距離だけによるものです (5.83 kpc、+1.91 -0.78、Davies ほか 2007)。",
    },
    cite: "Fok et al. 2012",
    bibcodes: ["2012ApJ...760...65F", "2007ApJ...671..781D", "2010PASJ...62..391D"],
    read: READ,
    note: {
      en: "Its distance is a kinematic one, uncertain by about a third, and its temperature comes from a dust model, so this is the least certain size here; it is estimated, not measured. Whether it or another star is the largest depends on those numbers.",
      ja: "距離は運動学的なもので約3分の1の不確かさがあり、温度はちりのモデルから出したものです。ここでいちばん不確かな大きさで、測定ではなく推定です。この星が最大かどうかは、これらの数字しだいです。",
    },
    look: { temperatureK: 3200, luminosityClass: "Ia" },
    temperatureFrom: "Fok et al. 2012 (a dust-shell fit)",
  },
];

/** The ordered sets of stars the page and the element offer: the first eight (the Sun and the bright stars), and the Sun with the four largest known. */
const SETS = {
  bright: ["sun", "sirius-a", "vega", "arcturus", "aldebaran", "rigel", "antares", "betelgeuse"],
  largest: ["sun", "betelgeuse", "vy-canis-majoris", "woh-g64", "uy-scuti", "stephenson-2-18"],
} as const;

/**
 * The names of the sets of stars: `all` is every star in the table, `bright` the Sun, Sirius A, Vega, Arcturus, Aldebaran, Rigel, Antares and Betelgeuse, and `largest` the Sun beside the largest stars known.
 *
 * @example
 * ```ts
 * import { LINEUP_SETS, type LineupSet } from "@johnmorrisdotca/wakusei-planets";
 *
 * const set: LineupSet = LINEUP_SETS[1];
 * console.log(set);
 * ```
 */
export const LINEUP_SETS = ["all", "bright", "largest"] as const;

/**
 * One of the sets in `LINEUP_SETS`.
 *
 * @example
 * ```ts
 * import type { LineupSet } from "@johnmorrisdotca/wakusei-planets";
 *
 * const set: LineupSet = "largest";
 * console.log(set);
 * ```
 */
export type LineupSet = (typeof LINEUP_SETS)[number];

/**
 * Something the line-up draws: a star of the table, or a planet from the package's facts. The size, the error and what to say about it are all here.
 *
 * @example
 * ```ts
 * import { lineupBodies, type LineupBody } from "@johnmorrisdotca/wakusei-planets";
 *
 * const first: LineupBody = lineupBodies({ planets: true })[0]!;
 * console.log(first.kind, first.id, first.radiusKm);
 * ```
 */
export interface LineupBody {
  id: string;
  kind: "star" | "planet";
  name: { en: string; ja: string };
  radiusSun: number;
  radiusKm: number;
  /** The error in solar radii below and above (0 for a planet and the Sun). */
  minus: number;
  plus: number;
  /** A planet: the body's id in the package's facts. */
  body?: "earth" | "jupiter";
  /** A star: its row of the table. */
  row?: RadiusRow;
  /** How flattened the body is at its poles, 0 to 1. */
  flattening: number;
}

/** The planets the line-up adds beside the stars: their equatorial radii are the package's own facts (IAU and NASA). */
const PLANETS = ["earth", "jupiter"] as const;

/**
 * What the line-up draws for some choices, smallest first: the stars of a set (or the ids of your own list) and, with `planets`, the Earth and Jupiter. The radius of a planet is its equatorial radius from the package's facts.
 * An id that is not in the table throws a `RangeError`.
 *
 * @param options - `set` (`all` by default, or a list of ids from `LINEUP_STARS`) and `planets` (add the Earth and Jupiter).
 * @returns The bodies, ordered by radius.
 *
 * @example
 * ```ts
 * import { lineupBodies } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(lineupBodies({ set: "bright", planets: true }).map((body) => body.id).join(", "));
 * ```
 */
export function lineupBodies(options: { set?: LineupSet | readonly string[]; planets?: boolean } = {}): LineupBody[] {
  const set = options.set ?? "all";
  const ids = typeof set === "string" ? (set === "all" ? LINEUP_STARS.map((row) => row.id) : [...SETS[set]]) : set;
  const stars = ids.map((id): LineupBody => {
    const row = LINEUP_STARS.find((one) => one.id === id);
    if (row === undefined) throw new RangeError(`no star called ${id} in the line-up: ${LINEUP_STARS.map((one) => one.id).join(", ")}`);
    return { id: row.id, kind: "star", name: row.name, radiusSun: row.radiusSun, radiusKm: row.radiusSun * SUN_RADIUS_KM, minus: row.minus, plus: row.plus, row, flattening: row.look.oblateness ?? 0 };
  });
  const planets =
    options.planets === true
      ? PLANETS.map((id): LineupBody => ({ id, kind: "planet", name: BODIES[id].name, radiusSun: BODIES[id].radiusKm / SUN_RADIUS_KM, radiusKm: BODIES[id].radiusKm, minus: 0, plus: 0, body: id, flattening: BODIES[id].flattening }))
      : [];
  return [...planets, ...stars].sort((a, b) => a.radiusSun - b.radiusSun);
}
