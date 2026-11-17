// A fact sheet for the Sun, the eight planets and Pluto, and the definitions of the words a sky page uses (planet, dwarf planet, moon, asteroid, comet, meteoroid, meteor, meteorite), as plain data.
// Every number is the package's own (radius and rotation from the IAU working group's report, the distance from JPL's approximate elements) or a published figure with its source named here: the sidereal
// year from NASA's planetary fact sheets (https://nssdc.gsfc.nasa.gov/planetary/factsheet/, read 2026-11-17), the moon counts from JPL's planetary satellite page (read 2026-11-11, the same read as `/moon-catalogue`),
// the page links to NASA's own page for each body (each fetched 2026-11-17). The descriptions and definitions are written here in our own words; no text of NASA's, the IAU's or an encyclopedia's is copied.
// Pure: no DOM, no clock reads, no three.js.
import { BODIES, type PlanetId } from "./facts.ts";
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
export const MOONS_READ_ON = "2026-11-11";

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
    ja: "太陽系の中心にある恒星です。太陽系のほぼすべての質量を持ち、その光と熱がすべての惑星を支えています。",
  },
  mercury: {
    en: "The smallest planet and the nearest to the Sun. It is a dry, cratered rock with almost no air, so its days are scorching and its nights bitterly cold.",
    ja: "いちばん小さく、太陽にいちばん近い惑星です。クレーターだらけの乾いた岩の星で、空気がほとんどないため、昼は灼熱、夜は極寒になります。",
  },
  venus: {
    en: "A rocky planet almost the size of the Earth, wrapped in thick clouds and a heavy carbon dioxide atmosphere that makes it the hottest planet. It turns backwards, very slowly.",
    ja: "地球とほぼ同じ大きさの岩の惑星です。厚い雲と重い二酸化炭素の大気に包まれ、太陽系でいちばん高温です。とてもゆっくり、逆向きに自転します。",
  },
  earth: {
    en: "Our home, the only place known to have life. It is the one planet with liquid water on its surface, and it has one large Moon.",
    ja: "私たちの住む星で、生命が知られている唯一の場所です。表面に液体の水がある唯一の惑星で、大きな月を1つ持っています。",
  },
  mars: {
    en: "A cold, dry, rusty-red desert planet with a thin air of carbon dioxide, the tallest volcano known and two small moons. Robots have explored its surface for decades.",
    ja: "二酸化炭素の薄い大気をもつ、冷たく乾いた赤さび色の砂漠の惑星です。知られている中で最も高い火山と、2つの小さな月があります。何十年も前からロボットが地表を調べています。",
  },
  jupiter: {
    en: "The largest planet, a giant ball of hydrogen and helium with bands of cloud and a storm bigger than the Earth that has raged for centuries. It has a faint ring and a great many moons.",
    ja: "最大の惑星で、水素とヘリウムでできた巨大なガスの球です。雲の縞模様と、何百年も続く地球より大きな嵐があります。かすかな環と、たくさんの月を持っています。",
  },
  saturn: {
    en: "A giant planet of hydrogen and helium, famous for its wide, bright rings of ice. It is light enough that it would float in a big enough bath, and it has more known moons than any other planet.",
    ja: "水素とヘリウムでできた巨大な惑星で、氷でできた広く明るい環で知られています。とても軽く、十分に大きな風呂があれば浮かぶほどです。知られている月の数は惑星の中でいちばん多いです。",
  },
  uranus: {
    en: "A cold blue-green giant that spins on its side, as if rolling round the Sun. Its air of hydrogen, helium and methane gives it its colour, and it has faint rings and many moons.",
    ja: "冷たい青緑色の巨大な惑星で、横倒しになって、転がるように太陽のまわりを回ります。水素、ヘリウム、メタンの大気がその色を生みます。かすかな環と多くの月があります。",
  },
  neptune: {
    en: "The farthest planet from the Sun, a deep blue giant with the fastest winds known on any planet. It takes about 165 years to go once round the Sun and has faint rings and many moons.",
    ja: "太陽からいちばん遠い惑星で、濃い青色の巨大な惑星です。惑星の中で最も速い風が吹きます。太陽を1周するのに約165年かかり、かすかな環と多くの月があります。",
  },
  pluto: {
    en: "A small, icy dwarf planet in the Kuiper belt beyond Neptune, with a heart-shaped bright plain, a thin air that freezes and falls as snow when it moves away from the Sun, and five known moons.",
    ja: "海王星の外のカイパーベルトにある、小さく氷でできた準惑星です。ハート形の明るい平原があり、薄い大気は太陽から遠ざかると凍って雪になります。知られている月は5つです。",
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
 * The words that have a definition here.
 *
 * @example
 * ```ts
 * import { DEFINITION_IDS } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * console.log(DEFINITION_IDS.join(", "));
 * ```
 */
export const DEFINITION_IDS = ["planet", "dwarf-planet", "moon", "asteroid", "comet", "meteoroid", "meteor", "meteorite"] as const;

/**
 * A word that has a definition.
 *
 * @example
 * ```ts
 * import { DEFINITION_IDS, type DefinitionId } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * const id: DefinitionId = DEFINITION_IDS[0];
 * console.log(id);
 * ```
 */
export type DefinitionId = (typeof DEFINITION_IDS)[number];

/**
 * A definition in our own words, English and Japanese, with where the meaning comes from.
 *
 * @example
 * ```ts
 * import { definition, type Definition } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * const d: Definition = definition("meteor");
 * console.log(d.en, "-", d.source);
 * ```
 */
export interface Definition {
  id: DefinitionId;
  term: { en: string; ja: string };
  en: string;
  ja: string;
  /** Where the meaning comes from: a resolution, or the usage of the space agencies where nobody has made a formal definition. */
  source: string;
}

const DEFINITIONS: Record<DefinitionId, Omit<Definition, "id">> = {
  planet: {
    term: { en: "planet", ja: "惑星" },
    en: "A body that goes round the Sun, is massive enough for its own gravity to pull it nearly round, and has cleared the neighbourhood around its orbit of other bodies of comparable size.",
    ja: "太陽のまわりを回り、自分の重力でほぼ丸い形になるだけの質量があり、軌道の近くから同じくらいの大きさの天体を一掃した天体です。",
    source: "IAU General Assembly 2006, Resolution B5",
  },
  "dwarf-planet": {
    term: { en: "dwarf planet", ja: "準惑星" },
    en: "A body that goes round the Sun and is nearly round, but has not cleared the neighbourhood around its orbit, and is not a moon.",
    ja: "太陽のまわりを回り、ほぼ丸い形をしているものの、軌道の近くを一掃しておらず、衛星ではない天体です。",
    source: "IAU General Assembly 2006, Resolution B5",
  },
  moon: {
    term: { en: "moon", ja: "衛星 (月)" },
    en: "A natural body that goes round a planet, a dwarf planet or a smaller body, instead of going round the Sun on its own.",
    ja: "太陽のまわりを自分で回るのではなく、惑星、準惑星、またはより小さな天体のまわりを回る自然の天体です。",
    source: "common usage of the space agencies (the IAU has no formal definition of a moon)",
  },
  asteroid: {
    term: { en: "asteroid", ja: "小惑星" },
    en: "A small rocky or metallic body that goes round the Sun, most of them in the belt between Mars and Jupiter. It is smaller than a planet and does not grow a tail.",
    ja: "太陽のまわりを回る小さな岩や金属の天体で、多くは火星と木星のあいだの帯にあります。惑星より小さく、尾は生えません。",
    source: "usage of NASA and JPL (the IAU's 2006 term is small solar system body)",
  },
  comet: {
    term: { en: "comet", ja: "彗星" },
    en: "A small icy body that goes round the Sun. Near the Sun its ice turns to gas and dust and makes a glowing cloud and a tail that points away from the Sun.",
    ja: "太陽のまわりを回る小さな氷の天体です。太陽に近づくと氷がガスとちりになり、光る雲と、太陽と反対向きの尾ができます。",
    source: "usage of NASA and JPL (the IAU's 2006 term is small solar system body)",
  },
  meteoroid: {
    term: { en: "meteoroid", ja: "流星物質" },
    en: "A small solid piece of rock or metal in space, from a grain of dust up to about a metre across, too small to be called an asteroid.",
    ja: "宇宙にある小さな岩や金属のかけらで、ちりの粒から1メートルほどまでの大きさです。小惑星と呼ぶには小さすぎます。",
    source: "IAU Commission F1 definitions of 2017 (size limits to be re-checked against the IAU text)",
  },
  meteor: {
    term: { en: "meteor", ja: "流星" },
    en: "The streak of light made when a meteoroid hits the air of a planet at great speed and burns up. People call it a shooting star.",
    ja: "流星物質が惑星の大気に高速で突入し、燃えるときにできる光の筋です。「ながれ星」とも呼ばれます。",
    source: "IAU Commission F1 definitions of 2017",
  },
  meteorite: {
    term: { en: "meteorite", ja: "隕石" },
    en: "A piece of a meteoroid that survives the fall through the air and lands on the ground.",
    ja: "流星物質のうち、大気の中を落ちても燃えつきず、地面にたどり着いたかけらです。",
    source: "IAU Commission F1 definitions of 2017 and the Meteoritical Society's usage",
  },
};

/**
 * The definition of a word a sky page uses.
 *
 * @param id - `"planet"`, `"dwarf-planet"`, `"moon"`, `"asteroid"`, `"comet"`, `"meteoroid"`, `"meteor"` or `"meteorite"`.
 * @returns The definition (a new object each call).
 * @throws {RangeError} For a word that has none, naming it.
 *
 * @example
 * ```ts
 * import { definition } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
 *
 * console.log(definition("comet").ja);
 * ```
 */
export function definition(id: DefinitionId): Definition {
  const found = DEFINITIONS[id];
  if (!DEFINITION_IDS.includes(id) || found === undefined) throw new RangeError(`There is no definition for "${String(id)}"; it has ${DEFINITION_IDS.join(", ")}.`);
  return { id, term: { ...found.term }, en: found.en, ja: found.ja, source: found.source };
}
