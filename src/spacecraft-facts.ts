// What is known about each craft: names, launch, agency, status, NASA's mission page, and its voyage as a list of events. Facts typed from the pages named in NOTICE.md (read 2026-11-08), never guessed:
// a time is given only where the page gives one, else the event's `precision` is "day". Every flyby is tested against the closest approach of the fitted path (test/spacecraft.test.ts).
import type { PlanetId } from "./facts.ts";

/**
 * The ten craft: `voyager1`, `voyager2`, `newhorizons`, `pioneer10`, `pioneer11`, `cassini`, `galileo`, `juno`, `parker` and `webb`.
 *
 * @example
 * ```ts
 * import { SPACECRAFT_IDS } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * console.log(SPACECRAFT_IDS.join(", "));
 * ```
 */
export const SPACECRAFT_IDS = ["voyager1", "voyager2", "newhorizons", "pioneer10", "pioneer11", "cassini", "galileo", "juno", "parker", "webb"] as const;

/**
 * The name of a craft: `voyager1`, `cassini`, `webb`...
 *
 * @example
 * ```ts
 * import { SPACECRAFT_IDS, type SpacecraftId } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * const id: SpacecraftId = SPACECRAFT_IDS[0];
 * console.log(id);
 * ```
 */
export type SpacecraftId = (typeof SPACECRAFT_IDS)[number];

/**
 * One thing that happened on a craft's voyage.
 *
 * @example
 * ```ts
 * import { SPACECRAFT, type SpacecraftEvent } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * const jupiter: SpacecraftEvent = SPACECRAFT.voyager1.events.find((e) => e.body === "jupiter")!;
 * console.log(new Date(jupiter.date).toISOString(), jupiter.name.en);
 * ```
 */
export interface SpacecraftEvent {
  /** What happened: the launch, a flyby, going into orbit round a planet, getting to the place the craft works from, or the end of the mission. */
  kind: "launch" | "flyby" | "orbit-insertion" | "arrival" | "end";
  /** The moment, in milliseconds since 1970 (UTC). Where `precision` is "day", only the date is known: this is that day's noon. */
  date: number;
  /** "minute" where the page gives a time, "day" where it gives only a date. */
  precision: "minute" | "day";
  /** The name of the event in English and Japanese. */
  name: { en: string; ja: string };
  /** The planet (or Pluto) the event is at, when it is at one. A flyby of an asteroid or of Arrokoth has none. */
  body?: PlanetId;
  /** The closest the craft came, in kilometres, as NASA gives it: above the planet's cloud tops or the body's surface, or from a planet for the one distant pass (Cassini at Jupiter). Left out where NASA gives none. */
  distanceKm?: number;
}

/**
 * Facts about one craft.
 *
 * @example
 * ```ts
 * import { SPACECRAFT, type SpacecraftFacts } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * const cassini: SpacecraftFacts = SPACECRAFT.cassini;
 * console.log(cassini.name.ja, cassini.agency, cassini.status);
 * ```
 */
export interface SpacecraftFacts {
  id: SpacecraftId;
  /** The craft's name in English and Japanese. */
  name: { en: string; ja: string };
  /** The agency or agencies. */
  agency: string;
  /** The launch: when, from where and on what. */
  launch: { date: number; precision: "minute" | "day"; site: { en: string; ja: string }; vehicle: string };
  /** The end of the mission (the last signal, or the planned plunge), in milliseconds since 1970 (UTC), or `undefined` while it goes on. */
  end: number | undefined;
  /** "active" while NASA's page lists the mission as active, else "ended". */
  status: "active" | "ended";
  /** NASA's page for the mission. */
  url: string;
  /** The craft's number in JPL Horizons. */
  horizons: string;
  /** The span of Horizons' record of the craft, in milliseconds since 1970 (UTC), which is the span `spacecraftPosition` answers for. The record begins about an hour after the launch; for a craft still flying, its end is Horizons' predicted path. */
  record: { start: number; end: number };
  /** Places where Horizons' record steps by more than the fit's error because two solutions meet there: at `date` (milliseconds since 1970, UTC) the position jumps by `km` kilometres, and a line drawn through the path should break. Empty where the record is smooth. */
  joins: readonly { date: number; km: number }[];
  /** The voyage, in order. */
  events: readonly SpacecraftEvent[];
}

const T = Date.UTC;
const noon = (y: number, m: number, d: number): number => T(y, m - 1, d, 12);
const ev = (kind: SpacecraftEvent["kind"], date: number, precision: SpacecraftEvent["precision"], en: string, ja: string, more: { body?: PlanetId; distanceKm?: number } = {}): SpacecraftEvent => ({ kind, date, precision, name: { en, ja }, ...more });
const flyby = (date: number, precision: SpacecraftEvent["precision"], en: string, ja: string, body?: PlanetId, distanceKm?: number): SpacecraftEvent => ev("flyby", date, precision, en, ja, { ...(body === undefined ? {} : { body }), ...(distanceKm === undefined ? {} : { distanceKm }) });

/**
 * The ten craft and their facts, keyed by id.
 *
 * @example
 * ```ts
 * import { SPACECRAFT } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 *
 * console.log(SPACECRAFT.voyager1.name.ja, new Date(SPACECRAFT.voyager1.launch.date).toISOString());
 * ```
 */
export const SPACECRAFT: Readonly<Record<SpacecraftId, SpacecraftFacts>> = {
  voyager1: {
    id: "voyager1",
    name: { en: "Voyager 1", ja: "ボイジャー1号" },
    agency: "NASA",
    launch: { date: T(1977, 8, 5, 12, 56, 1), precision: "minute", site: { en: "Cape Canaveral, Florida (Launch Complex 41)", ja: "ケープカナベラル 41番発射施設 (フロリダ州)" }, vehicle: "Titan IIIE-Centaur" },
    end: undefined,
    status: "active",
    url: "https://science.nasa.gov/mission/voyager/voyager-1/",
    horizons: "-31",
    record: { start: 242_315_917_199, end: 4_102_444_730_199 },
    joins: [{ date: 347_155_166_199, km: 65_200 }],
    events: [
      ev("launch", T(1977, 8, 5, 12, 56, 1), "minute", "Launch", "打ち上げ"),
      flyby(T(1979, 2, 5, 12, 5), "minute", "Jupiter flyby", "木星フライバイ", "jupiter", 280_000),
      flyby(T(1980, 10, 12, 23, 46), "minute", "Saturn flyby", "土星フライバイ", "saturn", 126_000),
    ],
  },
  voyager2: {
    id: "voyager2",
    name: { en: "Voyager 2", ja: "ボイジャー2号" },
    agency: "NASA",
    launch: { date: T(1977, 7, 20, 14, 29, 44), precision: "minute", site: { en: "Cape Canaveral, Florida (Launch Complex 41)", ja: "ケープカナベラル 41番発射施設 (フロリダ州)" }, vehicle: "Titan IIIE-Centaur" },
    end: undefined,
    status: "active",
    url: "https://science.nasa.gov/mission/voyager/voyager-2/",
    horizons: "-32",
    record: { start: 240_939_104_999, end: 4_102_444_729_999 },
    joins: [{ date: 620_380_819_999, km: 13_700 }],
    events: [
      ev("launch", T(1977, 7, 20, 14, 29, 44), "minute", "Launch", "打ち上げ"),
      flyby(T(1979, 6, 9, 22, 29), "minute", "Jupiter flyby", "木星フライバイ", "jupiter", 645_000),
      flyby(noon(1981, 8, 26), "day", "Saturn flyby", "土星フライバイ", "saturn", 101_000),
      flyby(T(1986, 0, 24, 17, 59), "minute", "Uranus flyby", "天王星フライバイ", "uranus", 81_500),
      flyby(T(1989, 7, 25, 3, 56), "minute", "Neptune flyby", "海王星フライバイ", "neptune", 4_800),
    ],
  },
  newhorizons: {
    id: "newhorizons",
    name: { en: "New Horizons", ja: "ニュー・ホライズンズ" },
    agency: "NASA",
    launch: { date: T(2006, 0, 19, 19, 0, 0), precision: "minute", site: { en: "Cape Canaveral, Florida (Launch Complex 41)", ja: "ケープカナベラル 41番発射施設 (フロリダ州)" }, vehicle: "Atlas V 551" },
    end: undefined,
    status: "active",
    url: "https://science.nasa.gov/mission/new-horizons/",
    horizons: "-98",
    record: { start: 1_137_700_214_146, end: 2_524_607_930_146 },
    joins: [],
    events: [
      ev("launch", T(2006, 0, 19, 19, 0, 0), "minute", "Launch", "打ち上げ"),
      flyby(noon(2006, 6, 13), "day", "Flyby of asteroid 132524 APL", "小惑星 132524 APL フライバイ", undefined, 101_867),
      flyby(T(2007, 1, 28, 5, 43, 40), "minute", "Jupiter flyby", "木星フライバイ", "jupiter"),
      flyby(T(2015, 6, 14, 11, 49), "minute", "Pluto flyby", "冥王星フライバイ", "pluto"),
      flyby(noon(2019, 1, 1), "day", "Flyby of Arrokoth", "アロコス フライバイ", undefined, 3_500),
    ],
  },
  pioneer10: {
    id: "pioneer10",
    name: { en: "Pioneer 10", ja: "パイオニア10号" },
    agency: "NASA",
    launch: { date: T(1972, 2, 2, 1, 49, 4), precision: "minute", site: { en: "Cape Canaveral, Florida (Launch Complex 36A)", ja: "ケープカナベラル 36A発射施設 (フロリダ州)" }, vehicle: "Atlas-Centaur" },
    end: T(2003, 0, 23, 12),
    status: "ended",
    url: "https://science.nasa.gov/mission/pioneer-10/",
    horizons: "-23",
    record: { start: 68_436_241_001, end: 2_524_607_931_001 },
    joins: [{ date: 70_284_612_001, km: 6_500 }, { date: 125_539_174_001, km: 19_400 }, { date: 424_224_010_001, km: 126_400 }, { date: 631_238_409_001, km: 31_900 }],
    events: [
      ev("launch", T(1972, 2, 2, 1, 49, 4), "minute", "Launch", "打ち上げ"),
      flyby(T(1973, 11, 4, 2, 26), "minute", "Jupiter flyby", "木星フライバイ", "jupiter", 130_354),
      ev("end", T(2003, 0, 23, 12), "day", "Last signal received", "最後の電波を受信"),
    ],
  },
  pioneer11: {
    id: "pioneer11",
    name: { en: "Pioneer 11", ja: "パイオニア11号" },
    agency: "NASA",
    launch: { date: T(1973, 3, 6, 2, 11), precision: "minute", site: { en: "Cape Canaveral, Florida (Launch Complex 36B)", ja: "ケープカナベラル 36B発射施設 (フロリダ州)" }, vehicle: "Atlas-Centaur" },
    end: T(1995, 8, 30, 12),
    status: "ended",
    url: "https://science.nasa.gov/mission/pioneer-11/",
    horizons: "-24",
    record: { start: 102_911_101_002, end: 2_524_607_931_002 },
    joins: [{ date: 135_622_819_002, km: 64_200 }, { date: 155_797_215_002, km: 3_300 }, { date: 201_943_154_002, km: 458_900 }, { date: 269_136_019_002, km: 12_100 }, { date: 310_262_422_002, km: 32_100 }, { date: 473_299_210_002, km: 376_100 }],
    events: [
      ev("launch", T(1973, 3, 6, 2, 11), "minute", "Launch", "打ち上げ"),
      flyby(T(1974, 11, 3, 5, 22), "minute", "Jupiter flyby", "木星フライバイ", "jupiter", 42_500),
      flyby(T(1979, 8, 1, 16, 31), "minute", "Saturn flyby", "土星フライバイ", "saturn", 20_900),
      ev("end", T(1995, 8, 30, 12), "day", "Last contact", "最後の通信"),
    ],
  },
  cassini: {
    id: "cassini",
    name: { en: "Cassini", ja: "カッシーニ" },
    agency: "NASA, ESA, ASI",
    launch: { date: noon(1997, 10, 15), precision: "day", site: { en: "Cape Canaveral, Florida", ja: "ケープカナベラル (フロリダ州)" }, vehicle: "Titan IVB/Centaur" },
    end: noon(2017, 9, 15),
    status: "ended",
    url: "https://science.nasa.gov/mission/cassini/",
    horizons: "-82",
    record: { start: 876_907_569_388, end: 1_505_476_609_388 },
    joins: [{ date: 1_018_483_137_388, km: 6_200 }],
    events: [
      ev("launch", noon(1997, 10, 15), "day", "Launch", "打ち上げ"),
      flyby(noon(1998, 4, 26), "day", "Venus flyby", "金星フライバイ", "venus", 284),
      flyby(noon(1999, 6, 24), "day", "Second Venus flyby", "2回目の金星フライバイ", "venus", 600),
      flyby(noon(1999, 8, 18), "day", "Earth flyby", "地球フライバイ", "earth", 1_100),
      flyby(noon(2000, 12, 30), "day", "Jupiter flyby", "木星フライバイ", "jupiter", 10_000_000),
      ev("orbit-insertion", noon(2004, 7, 1), "day", "Saturn orbit insertion", "土星周回軌道に入る", { body: "saturn" }),
      ev("end", noon(2017, 9, 15), "day", "Grand Finale: plunge into Saturn", "グランドフィナーレ: 土星に突入"),
    ],
  },
  galileo: {
    id: "galileo",
    name: { en: "Galileo", ja: "ガリレオ" },
    agency: "NASA",
    launch: { date: T(1989, 9, 18, 23, 15), precision: "minute", site: { en: "Kennedy Space Center, Florida", ja: "ケネディ宇宙センター (フロリダ州)" }, vehicle: "Space Shuttle Atlantis (STS-34)" },
    end: noon(2003, 9, 21),
    status: "ended",
    url: "https://science.nasa.gov/mission/galileo/",
    horizons: "-77",
    record: { start: 624_763_718_076, end: 1_064_923_135_076 },
    joins: [],
    events: [
      ev("launch", T(1989, 9, 18, 23, 15), "minute", "Launch", "打ち上げ"),
      flyby(noon(1990, 2, 10), "day", "Venus flyby", "金星フライバイ", "venus", 16_000),
      flyby(noon(1990, 12, 8), "day", "Earth flyby", "地球フライバイ", "earth", 960),
      flyby(noon(1991, 10, 29), "day", "Flyby of asteroid Gaspra", "小惑星ガスプラ フライバイ", undefined, 1_601),
      flyby(noon(1992, 12, 8), "day", "Second Earth flyby", "2回目の地球フライバイ", "earth", 303),
      flyby(noon(1993, 8, 28), "day", "Flyby of asteroid Ida", "小惑星イダ フライバイ", undefined, 2_400),
      ev("orbit-insertion", noon(1995, 12, 7), "day", "Jupiter orbit insertion", "木星周回軌道に入る", { body: "jupiter" }),
      ev("end", noon(2003, 9, 21), "day", "Plunge into Jupiter", "木星に突入"),
    ],
  },
  juno: {
    id: "juno",
    name: { en: "Juno", ja: "ジュノー" },
    agency: "NASA",
    launch: { date: T(2011, 7, 5, 16, 25), precision: "minute", site: { en: "Cape Canaveral, Florida (Launch Complex 41)", ja: "ケープカナベラル 41番発射施設 (フロリダ州)" }, vehicle: "Atlas V 551" },
    end: undefined,
    status: "active",
    url: "https://science.nasa.gov/mission/juno/",
    horizons: "-61",
    record: { start: 1_312_564_686_999, end: 1_851_471_472_999 },
    joins: [],
    events: [
      ev("launch", T(2011, 7, 5, 16, 25), "minute", "Launch", "打ち上げ"),
      flyby(T(2013, 9, 9, 19, 21), "minute", "Earth flyby", "地球フライバイ", "earth", 559),
      ev("orbit-insertion", noon(2016, 7, 5), "day", "Jupiter orbit insertion", "木星周回軌道に入る", { body: "jupiter", distanceKm: 4_200 }),
    ],
  },
  parker: {
    id: "parker",
    name: { en: "Parker Solar Probe", ja: "パーカー・ソーラー・プローブ" },
    agency: "NASA",
    launch: { date: T(2018, 7, 12, 7, 31), precision: "minute", site: { en: "Cape Canaveral, Florida", ja: "ケープカナベラル (フロリダ州)" }, vehicle: "Delta IV Heavy" },
    end: undefined,
    status: "active",
    url: "https://science.nasa.gov/mission/parker-solar-probe/",
    horizons: "-96",
    record: { start: 1_534_061_715_159, end: 1_893_455_931_159 },
    joins: [{ date: 1_750_831_215_159, km: 79_800 }, { date: 1_802_822_412_159, km: 7_600 }],
    events: [
      ev("launch", T(2018, 7, 12, 7, 31), "minute", "Launch", "打ち上げ"),
      flyby(noon(2018, 10, 3), "day", "Venus flyby", "金星フライバイ", "venus", 2_500),
      flyby(noon(2019, 12, 26), "day", "Second Venus flyby", "2回目の金星フライバイ", "venus", 3_000),
      flyby(noon(2020, 7, 11), "day", "Third Venus flyby", "3回目の金星フライバイ", "venus", 800),
      flyby(noon(2021, 2, 20), "day", "Fourth Venus flyby", "4回目の金星フライバイ", "venus", 2_400),
      flyby(noon(2021, 10, 16), "day", "Fifth Venus flyby", "5回目の金星フライバイ", "venus", 3_800),
      flyby(noon(2023, 8, 21), "day", "Sixth Venus flyby", "6回目の金星フライバイ", "venus", 3_900),
      flyby(noon(2024, 11, 6), "day", "Seventh Venus flyby", "7回目の金星フライバイ", "venus", 300),
    ],
  },
  webb: {
    id: "webb",
    name: { en: "James Webb Space Telescope", ja: "ジェイムズ・ウェッブ宇宙望遠鏡" },
    agency: "NASA, ESA, CSA",
    launch: { date: T(2021, 11, 25, 12, 20), precision: "minute", site: { en: "Kourou, French Guiana (ELA-3)", ja: "クールー (フランス領ギアナ) ELA-3" }, vehicle: "Ariane 5" },
    end: undefined,
    status: "active",
    url: "https://science.nasa.gov/mission/webb/",
    horizons: "-170",
    record: { start: 1_640_437_201_000, end: 1_951_343_999_000 },
    joins: [],
    events: [
      ev("launch", T(2021, 11, 25, 12, 20), "minute", "Launch", "打ち上げ"),
      ev("arrival", noon(2022, 1, 24), "day", "Arrival at the Sun–Earth second Lagrange point (L2)", "太陽・地球系の第2ラグランジュ点 (L2) に到着"),
    ],
  },
};
