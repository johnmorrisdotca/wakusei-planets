// A fact sheet for the Sun, the eight planets and Pluto, as plain data.
// Every number is the package's own (radius and rotation from the IAU working group's report, the distance from JPL's approximate elements) or a published figure with its source named here: the sidereal
// year from NASA's planetary fact sheets (https://nssdc.gsfc.nasa.gov/planetary/factsheet/, read 2026-11-17), the moon counts from JPL's planetary satellite page (read 2026-11-11, the same read as `/moon-catalogue`),
// the page links to NASA's own page for each body (each fetched 2026-11-17). The descriptions are written here in our own words; no text of NASA's, the IAU's or an encyclopedia's is copied.
// Pure: no DOM, no clock reads, no three.js.
import { DWARF_ELEMENTS } from "./data/dwarf.ts";
import { MINOR_ELEMENTS } from "./data/minor.ts";
import { BODIES, DWARF_IDS, MINOR_IDS, type PlanetId } from "./facts.ts";
import { journeyStop } from "./stops.ts";

const KM_PER_MILE = 1.609344;
const AU_KM = 149_597_870.7;

/**
 * The bodies that have a fact sheet: the Sun, the eight planets and Pluto.
 *
 * @example
 * ```ts
 * import { FACT_SHEET_IDS } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * console.log(FACT_SHEET_IDS.join(", "));
 * ```
 */
export const FACT_SHEET_IDS = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;

/**
 * The name of a body that has a fact sheet.
 *
 * @example
 * ```ts
 * import { FACT_SHEET_IDS, type FactSheetId } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * const id: FactSheetId = FACT_SHEET_IDS[3];
 * console.log(id);
 * ```
 */
export type FactSheetId = (typeof FACT_SHEET_IDS)[number];

/**
 * A number in kilometres and in miles.
 *
 * @example
 * ```ts
 * import { factSheet, type Length } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * const radius: Length = factSheet("earth").radius;
 * console.log(Math.round(radius.km), Math.round(radius.miles));
 * ```
 */
export interface Length {
  km: number;
  miles: number;
}

/**
 * A fact sheet: what a page about a body usually says, as data.
 *
 * `radius` is the equatorial radius. `distanceFromSun` is the mean distance (zero for the Sun). `yearDays` is the sidereal year in Earth days (the time to go once round the Sun; `null` for the Sun) and
 * `rotationHours` the time to turn once on its axis against the stars (so it is not the length of a solar day: Venus's sidereal rotation is longer than its year's solar day), with `retrograde` true for a body
 * that turns backwards (Venus, Uranus and Pluto). `knownMoons` is the number of moons known on `moonsReadOn` (a date: the count moves as moons are found). `nasaPage` is NASA's own page about the body.
 * `description` is a short description in our own words.
 *
 * @example
 * ```ts
 * import { factSheet, type FactSheet } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * const mars: FactSheet = factSheet("mars");
 * console.log(mars.name.en, mars.knownMoons, mars.nasaPage);
 * ```
 */
export interface FactSheet {
  id: FactSheetId;
  name: { en: string; ja: string };
  kind: "star" | "planet" | "dwarf-planet";
  radius: Length;
  distanceFromSun: Length & { au: number };
  yearDays: number | null;
  rotationHours: number;
  retrograde: boolean;
  knownMoons: number;
  moonsReadOn: string;
  nasaPage: string;
  description: { en: string; ja: string };
}

/**
 * The date the moon counts were read from JPL's planetary satellite page, the same read as `/moon-catalogue`'s `MOON_CATALOGUE_FETCHED`.
 *
 * @example
 * ```ts
 * import { MOONS_READ_ON } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * console.log("moon counts read on", MOONS_READ_ON);
 * ```
 */
export const MOONS_READ_ON = "2026-11-18";

// The sidereal year in Earth days, NASA planetary fact sheets (orbital period).
const YEAR_DAYS: Record<Exclude<FactSheetId, "sun">, number> = {
  mercury: 87.969,
  venus: 224.701,
  earth: 365.256,
  mars: 686.98,
  jupiter: 4332.589,
  saturn: 10759.22,
  uranus: 30685.4,
  neptune: 60189,
  pluto: 90560,
};

// The known moons on MOONS_READ_ON (JPL's planetary satellite page); a test holds these to `/moon-catalogue`.
const MOONS: Record<FactSheetId, number> = { sun: 0, mercury: 0, venus: 0, earth: 1, mars: 2, jupiter: 115, saturn: 293, uranus: 29, neptune: 16, pluto: 5 };

const NASA: Record<FactSheetId, string> = {
  sun: "https://science.nasa.gov/sun/",
  mercury: "https://science.nasa.gov/mercury/",
  venus: "https://science.nasa.gov/venus/",
  earth: "https://science.nasa.gov/earth/",
  mars: "https://science.nasa.gov/mars/",
  jupiter: "https://science.nasa.gov/jupiter/",
  saturn: "https://science.nasa.gov/saturn/",
  uranus: "https://science.nasa.gov/uranus/",
  neptune: "https://science.nasa.gov/neptune/",
  pluto: "https://science.nasa.gov/dwarf-planets/pluto/",
};

const DESCRIPTION: Record<FactSheetId, { en: string; ja: string }> = {
  sun: {
    en: "The star at the centre of the solar system. It holds almost all of the system's mass and its light and heat keep every planet going.",
    ja: "太陽系の中心にある恒星です。太陽系の質量のほぼすべてを占め、その光と熱がすべての惑星を支えています。",
  },
  mercury: {
    en: "The smallest planet and the nearest to the Sun. It is a dry, cratered rock with almost no air, so its days are scorching and its nights bitterly cold.",
    ja: "いちばん小さく、太陽にいちばん近い惑星です。クレーターだらけの乾いた岩の星で、空気がほとんどないため、昼は灼熱、夜は極寒になります。",
  },
  venus: {
    en: "A rocky planet almost the size of the Earth, wrapped in thick clouds and a heavy carbon dioxide atmosphere that makes it the hottest planet. It turns backwards, very slowly.",
    ja: "地球とほぼ同じ大きさの岩の惑星です。厚い雲と二酸化炭素の濃い大気に包まれ、惑星の中でいちばん高温です。とてもゆっくり、逆向きに自転します。",
  },
  earth: {
    en: "Our home, the only place known to have life. It is the one planet with liquid water on its surface, and it has one large Moon.",
    ja: "私たちの住む星で、生命が確認されている唯一の場所です。表面に液体の水がある唯一の惑星で、大きな衛星を1つ持っています。",
  },
  mars: {
    en: "A cold, dry, rusty-red desert planet with a thin air of carbon dioxide, the tallest volcano known and two small moons. Robots have explored its surface for decades.",
    ja: "二酸化炭素の薄い大気を持つ、冷たく乾いた赤さび色の砂漠の惑星です。知られている中で最も高い火山と、2つの小さな衛星があります。何十年も前からロボットが地表を調べています。",
  },
  jupiter: {
    en: "The largest planet, a giant ball of hydrogen and helium with bands of cloud and a storm bigger than the Earth that has raged for centuries. It has a faint ring and a great many moons.",
    ja: "最大の惑星で、水素とヘリウムでできた巨大なガスの球です。雲の縞模様と、何百年も続く地球より大きな嵐があります。かすかな環と、たくさんの衛星を持っています。",
  },
  saturn: {
    en: "A giant planet of hydrogen and helium, famous for its wide, bright rings of ice. It is light enough that it would float in a big enough bath, and it has more known moons than any other planet.",
    ja: "水素とヘリウムでできた巨大な惑星で、氷でできた広く明るい環で知られています。密度が水より小さく、十分に大きなお風呂があれば浮かぶほどです。知られている衛星の数は惑星の中でいちばん多いです。",
  },
  uranus: {
    en: "A cold blue-green giant that spins on its side, as if rolling round the Sun. Its air of hydrogen, helium and methane gives it its colour, and it has faint rings and many moons.",
    ja: "冷たい青緑色の巨大な惑星で、横倒しになって、転がるように太陽のまわりを回ります。水素、ヘリウム、メタンの大気がその色を生みます。かすかな環と多くの衛星があります。",
  },
  neptune: {
    en: "The farthest planet from the Sun, a deep blue giant with the fastest winds known on any planet. It takes about 165 years to go once round the Sun and has faint rings and many moons.",
    ja: "太陽からいちばん遠い惑星で、濃い青色の巨大な惑星です。知られている中で最も速い風が吹きます。太陽を1周するのに約165年かかり、かすかな環と多くの衛星があります。",
  },
  pluto: {
    en: "A small, icy dwarf planet in the Kuiper belt beyond Neptune, with a heart-shaped bright plain, a thin air that freezes and falls as snow when it moves away from the Sun, and five known moons.",
    ja: "海王星より外側のカイパーベルトにある、小さく氷でできた準惑星です。ハート形の明るい平原があり、薄い大気は太陽から遠ざかると凍って雪になります。知られている衛星は5つです。",
  },
};

/**
 * The fact sheet of the Sun, a planet or Pluto.
 *
 * @param id - `"sun"`, `"mercury"` to `"neptune"`, or `"pluto"`.
 * @returns The sheet (a new object each call).
 * @throws {RangeError} For an id that has no fact sheet, naming it.
 *
 * @example
 * ```ts
 * import { factSheet } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * const venus = factSheet("venus");
 * console.log(venus.yearDays, venus.retrograde, venus.description.en);
 * ```
 */
export function factSheet(id: FactSheetId): FactSheet {
  if (!FACT_SHEET_IDS.includes(id)) throw new RangeError(`There is no fact sheet for "${String(id)}"; it has one for ${FACT_SHEET_IDS.join(", ")}.`);
  const facts = BODIES[id];
  const au = id === "sun" ? 0 : journeyStop(id).sunAu;
  const km = (value: number): Length => ({ km: value, miles: value / KM_PER_MILE });
  return {
    id,
    name: { ...facts.name },
    kind: facts.kind === "star" ? "star" : facts.kind === "dwarf-planet" ? "dwarf-planet" : "planet",
    radius: km(facts.radiusKm),
    distanceFromSun: { ...km(au * AU_KM), au },
    yearDays: id === "sun" ? null : YEAR_DAYS[id as PlanetId],
    rotationHours: Math.abs(facts.rotationHours),
    retrograde: facts.rotationHours < 0,
    knownMoons: MOONS[id],
    moonsReadOn: MOONS_READ_ON,
    nasaPage: NASA[id],
    description: { ...DESCRIPTION[id] },
  };
}

/**
 * The dwarf planets besides Pluto, and the minor bodies the package draws, nearest the Sun first within each group.
 *
 * @example
 * ```ts
 * import { MINOR_FACT_IDS } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * console.log(MINOR_FACT_IDS.includes("ceres"), MINOR_FACT_IDS.includes("halley"));
 * ```
 */
export const MINOR_FACT_IDS = [...DWARF_IDS, ...MINOR_IDS] as const;

/**
 * The name of a dwarf planet besides Pluto, or of a minor body, that has an orbit fact.
 *
 * @example
 * ```ts
 * import { MINOR_FACT_IDS, type MinorFactId } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * const id: MinorFactId = MINOR_FACT_IDS[0];
 * console.log(id);
 * ```
 */
export type MinorFactId = (typeof MINOR_FACT_IDS)[number];

/**
 * The orbit a card can print for a dwarf planet besides Pluto, or for a minor body: the osculating ellipse the package already stores, not a new fit.
 *
 * `aAu` is the semi-major axis and `perihelionAu` the closest the ellipse comes to the Sun, both in astronomical units. `periodDays` is the sidereal period, 360 degrees divided by the mean motion in degrees a day.
 * `epochMs` is the epoch of those elements, in milliseconds since 1970. Pluto is not here: its fact sheet carries the year, and its place is the fitted table, not one ellipse. Discovery is `discoveryOf` in `/discovery`.
 *
 * @example
 * ```ts
 * import { minorFact, type MinorFact } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * const vesta: MinorFact = minorFact("vesta");
 * console.log(vesta.aAu, vesta.periodDays);
 * ```
 */
export interface MinorFact {
  id: MinorFactId;
  name: { en: string; ja: string };
  kind: "dwarf-planet" | "asteroid" | "centaur" | "comet";
  aAu: number;
  perihelionAu: number;
  periodDays: number;
  epochMs: number;
}

/**
 * The orbit fact for a dwarf planet besides Pluto, or for a minor body the package draws.
 *
 * @param id - One of {@link MINOR_FACT_IDS} (`ceres`, `vesta`, `halley`).
 * @returns The fact (a new object each call).
 * @throws {RangeError} For an id that has none, naming it. Pluto's sheet is `factSheet("pluto")`.
 *
 * @example
 * ```ts
 * import { minorFact } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * const halley = minorFact("halley");
 * console.log(halley.perihelionAu < 1, halley.kind);
 * ```
 */
export function minorFact(id: MinorFactId): MinorFact {
  if (!(MINOR_FACT_IDS as readonly string[]).includes(id)) throw new RangeError(`There is no orbit fact for "${String(id)}"; it has one for ${MINOR_FACT_IDS.join(", ")}.`);
  const elements = (DWARF_IDS as readonly string[]).includes(id) ? DWARF_ELEMENTS[id as (typeof DWARF_IDS)[number]] : MINOR_ELEMENTS[id as (typeof MINOR_IDS)[number]];
  const facts = BODIES[id];
  const kind = facts.kind;
  if (kind !== "dwarf-planet" && kind !== "asteroid" && kind !== "centaur" && kind !== "comet") throw new RangeError(`"${id}" is not a dwarf planet or a minor body.`);
  return {
    id,
    name: { en: facts.name.en, ja: facts.name.ja },
    kind,
    aAu: elements.a,
    perihelionAu: elements.a * (1 - elements.e),
    periodDays: 360 / elements.n,
    epochMs: elements.epoch,
  };
}
