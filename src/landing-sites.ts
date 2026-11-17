// The landing sites: every landing on the Moon and Mars that touched down softly and was heard from, as one small plain list a page can draw a card, a flat map or a marker from. Pure: no DOM, no three.js, no tables of places;
// the record carries what a card needs (names in English and Japanese, the day, the point, who flew it, the country as a flag code, and where each number is from). The points are the ones the place tables (`/places/moon`, `/places/mars`)
// hold, and `test/landing-sites.test.ts` pins the two together, so a site on a card is the site on the globe. Typed by hand from the sources named in each record; nothing is guessed, and a site with no primary source is left out.
// Moon: NASA NSSDCA's "Table of Anthropogenic Impacts and Spacecraft on the Moon", read 2026-11-17 (every row below was checked against the page). Mars: the Mars Orbital Data Explorer's list of landing sites, NASA NSSDCA's Viking pages,
// NASA GISS's Mars24 lander list and GCAT, each named in the record; where the record's own source is GCAT, a NASA page (`checkedAgainst`) agrees with it to the 0.01 degree the page prints.
const NSS = "https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=";

/**
 * Where a site's coordinates come from: the source's name and the address of the page the numbers were read from.
 *
 * @example
 * ```ts
 * import type { LandingSource } from "@johnmorrisdotca/wakusei-planets/landing-sites";
 * import { LANDING_SITES } from "@johnmorrisdotca/wakusei-planets/landing-sites";
 *
 * const source: LandingSource = LANDING_SITES[0]!.source;
 * console.log(source.name, source.url);
 * ```
 */
export interface LandingSource {
  name: string;
  url: string;
}

/**
 * One landing site. `place` is the id of the same site in the place tables (`findPlace` on `/places/moon` or `/places/mars` takes it, and the 3D views' `wakusei-place` event carries it). Latitude is planetocentric and longitude east, from -180 to 180,
 * as in the place tables. `country` is an ISO 3166-1 alpha-2 code in capitals, and `SU` for the Soviet Union (the code ISO 3166-3 kept for it); `flagCodeOf` turns it into the code a flag element wants. `agency` is who flew it.
 * `source` is where the numbers were read, `checkedAgainst` a second NASA page that agrees, `page` the NSSDCA page of the mission where there is one, and `stand` the id of the site in the standing view (`/surface`), for the one place a reader can stand.
 *
 * @example
 * ```ts
 * import type { LandingSite } from "@johnmorrisdotca/wakusei-planets/landing-sites";
 * import { LANDING_SITES } from "@johnmorrisdotca/wakusei-planets/landing-sites";
 *
 * const site: LandingSite = LANDING_SITES.find((one) => one.id === "moon/apollo-17")!;
 * console.log(site.name.en, site.lat, site.lon, site.country, site.stand);
 * ```
 */
export interface LandingSite {
  /** `<body>/<slug>`, unique. */
  id: string;
  /** The id of the same place in the place tables. */
  place: string;
  /** The ids of the other places the tables hold on the same spot (the rover, the descent stage), so a mark on any of them is this site. */
  alsoAt?: readonly string[];
  body: "moon" | "mars";
  name: { en: string; ja: string };
  /** When it touched down (ISO, UTC, to the minute). */
  date: string;
  lat: number;
  lon: number;
  agency: { en: string; ja: string };
  /** ISO 3166-1 alpha-2 in capitals, or `SU`. */
  country: string;
  /** True where the source gives the point as "about" or says the real place can be kilometres away. */
  approximate?: true;
  /** The id of the site in the standing view, where a reader can stand there. */
  stand?: string;
  /** A word about how it ended, in English, where the sources say. */
  note?: string;
  source: LandingSource;
  /** A second page that gives the same place. */
  checkedAgainst?: LandingSource;
  /** The mission's page at NASA NSSDCA, where it loads. */
  page?: string;
}

const AGENCY = {
  NASA: { en: "NASA", ja: "NASA" },
  USSR: { en: "Soviet space programme", ja: "ソ連の宇宙計画" },
  CNSA: { en: "CNSA (China)", ja: "中国国家航天局 (CNSA)" },
  ISRO: { en: "ISRO", ja: "インド宇宙研究機関 (ISRO)" },
  JAXA: { en: "JAXA", ja: "宇宙航空研究開発機構 (JAXA)" },
  IM: { en: "Intuitive Machines", ja: "インテュイティブ・マシーンズ" },
  FF: { en: "Firefly Aerospace", ja: "ファイアフライ・エアロスペース" },
} as const;

const SRC_NASA_MOON: LandingSource = { name: "NASA NSSDCA, Table of Anthropogenic Impacts and Spacecraft on the Moon", url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html" };
const SRC_ODE: LandingSource = { name: "NASA Planetary Data System, Mars Orbital Data Explorer, landing sites", url: "https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm" };
const SRC_MARS24: LandingSource = { name: "NASA GISS, Mars24 Sunclock, Mars lander missions", url: "https://www.giss.nasa.gov/tools/mars24/help/landers.html" };
const SRC_GCAT: LandingSource = { name: "GCAT, J. McDowell (CC BY 4.0)", url: "https://planet4589.org/space/gcat/" };

/**
 * Every landing on the Moon and Mars that touched down softly and was heard from, 28 on the Moon (Apollo 11 to 17, Surveyor 1, 3, 5, 6 and 7, Luna 9, 13, 16, 17, 20, 21, 23 and 24, Chang'e 3, 4, 5 and 6, Chandrayaan-3, SLIM, IM-1, Blue Ghost 1 and IM-2) and 11 on
 * Mars (Mars 3, Viking 1 and 2, Pathfinder, Spirit, Opportunity, Phoenix, Curiosity, InSight, Perseverance and Zhurong), the Moon's first and Mars's after, each by date. Landers that did not survive the landing (Mars 2 and 6, Beagle 2, Schiaparelli) are not here; they are
 * in the place tables as crashes.
 *
 * @example
 * ```ts
 * import { LANDING_SITES } from "@johnmorrisdotca/wakusei-planets/landing-sites";
 *
 * console.log(LANDING_SITES.length, "sites;", LANDING_SITES.filter((site) => site.country === "CN").map((site) => site.name.en).join(", "));
 * ```
 */
export const LANDING_SITES: readonly LandingSite[] = [
  {
    id: "moon/luna-9", place: "moon/luna-9", body: "moon", name: { en: "Luna 9", ja: "ルナ9号" },
    date: "1966-02-03T18:45Z", lat: 7.13, lon: -64.37, agency: AGENCY.USSR,
    country: "SU", approximate: true,
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/surveyor-1", place: "moon/surveyor-1", body: "moon", name: { en: "Surveyor 1", ja: "サーベイヤー1号" },
    date: "1966-06-02T06:17Z", lat: -2.4745, lon: -43.3398, agency: AGENCY.NASA,
    country: "US",
    source: SRC_NASA_MOON, page: `${NSS}1966-045A`,
  },
  {
    id: "moon/luna-13", place: "moon/luna-13", body: "moon", name: { en: "Luna 13", ja: "ルナ13号" },
    date: "1966-12-24T18:01Z", lat: 18.87, lon: -62.05, agency: AGENCY.USSR,
    country: "SU",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/surveyor-3", place: "moon/surveyor-3", body: "moon", name: { en: "Surveyor 3", ja: "サーベイヤー3号" },
    date: "1967-04-20T00:04Z", lat: -3.0162, lon: -23.418, agency: AGENCY.NASA,
    country: "US",
    source: SRC_NASA_MOON, page: `${NSS}1967-035A`,
  },
  {
    id: "moon/surveyor-5", place: "moon/surveyor-5", body: "moon", name: { en: "Surveyor 5", ja: "サーベイヤー5号" },
    date: "1967-09-11T00:46Z", lat: 1.4551, lon: 23.1943, agency: AGENCY.NASA,
    country: "US",
    source: SRC_NASA_MOON, page: `${NSS}1967-084A`,
  },
  {
    id: "moon/surveyor-6", place: "moon/surveyor-6", body: "moon", name: { en: "Surveyor 6", ja: "サーベイヤー6号" },
    date: "1967-11-10T01:01Z", lat: 0.4742, lon: -1.4275, agency: AGENCY.NASA,
    country: "US",
    source: SRC_NASA_MOON, page: `${NSS}1967-112A`,
  },
  {
    id: "moon/surveyor-7", place: "moon/surveyor-7", body: "moon", name: { en: "Surveyor 7", ja: "サーベイヤー7号" },
    date: "1968-01-10T01:05Z", lat: -40.9812, lon: -11.5127, agency: AGENCY.NASA,
    country: "US",
    source: SRC_NASA_MOON, page: `${NSS}1968-001A`,
  },
  {
    id: "moon/apollo-11", place: "moon/apollo-11-lunar-module", body: "moon", name: { en: "Apollo 11", ja: "アポロ11号" },
    date: "1969-07-20T20:17Z", lat: 0.6742, lon: 23.4731, agency: AGENCY.NASA,
    country: "US",
    source: SRC_NASA_MOON, page: `${NSS}1969-059C`,
  },
  {
    id: "moon/apollo-12", place: "moon/apollo-12-lunar-module", body: "moon", name: { en: "Apollo 12", ja: "アポロ12号" },
    date: "1969-11-19T06:54Z", lat: -3.0128, lon: -23.4219, agency: AGENCY.NASA,
    country: "US",
    source: SRC_NASA_MOON, page: `${NSS}1969-099C`,
  },
  {
    id: "moon/luna-16", place: "moon/luna-16", body: "moon", name: { en: "Luna 16", ja: "ルナ16号" },
    date: "1970-09-20T05:17Z", lat: -0.5137, lon: 56.3638, agency: AGENCY.USSR,
    country: "SU",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/luna-17", place: "moon/luna-17", body: "moon", name: { en: "Luna 17", ja: "ルナ17号" },
    alsoAt: ["moon/lunokhod-1"],
    date: "1970-11-17T03:47Z", lat: 38.2376, lon: -35.0016, agency: AGENCY.USSR,
    country: "SU", note: "Carried Lunokhod 1.",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/apollo-14", place: "moon/apollo-14-lunar-module", body: "moon", name: { en: "Apollo 14", ja: "アポロ14号" },
    date: "1971-02-05T09:18Z", lat: -3.6459, lon: -17.4719, agency: AGENCY.NASA,
    country: "US",
    source: SRC_NASA_MOON, page: `${NSS}1971-008C`,
  },
  {
    id: "moon/apollo-15", place: "moon/apollo-15-lunar-module", body: "moon", name: { en: "Apollo 15", ja: "アポロ15号" },
    alsoAt: ["moon/apollo-15-lunar-rover"],
    date: "1971-07-30T22:16Z", lat: 26.1324, lon: 3.6333, agency: AGENCY.NASA,
    country: "US", stand: "apollo-15",
    source: SRC_NASA_MOON, page: `${NSS}1971-063C`,
  },
  {
    id: "moon/luna-20", place: "moon/luna-20", body: "moon", name: { en: "Luna 20", ja: "ルナ20号" },
    date: "1972-02-21T19:18Z", lat: 3.7863, lon: 56.6242, agency: AGENCY.USSR,
    country: "SU",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/apollo-16", place: "moon/apollo-16-lunar-module", body: "moon", name: { en: "Apollo 16", ja: "アポロ16号" },
    alsoAt: ["moon/apollo-16-lunar-rover"],
    date: "1972-04-21T02:23Z", lat: -8.9734, lon: 15.5011, agency: AGENCY.NASA,
    country: "US", stand: "apollo-16",
    source: SRC_NASA_MOON, page: `${NSS}1972-031C`,
  },
  {
    id: "moon/apollo-17", place: "moon/apollo-17-lunar-module", body: "moon", name: { en: "Apollo 17", ja: "アポロ17号" },
    alsoAt: ["moon/apollo-17-lunar-rover"],
    date: "1972-12-11T19:54Z", lat: 20.1911, lon: 30.7723, agency: AGENCY.NASA,
    country: "US", stand: "apollo-17",
    source: SRC_NASA_MOON, page: `${NSS}1972-096C`,
  },
  {
    id: "moon/luna-21", place: "moon/luna-21", body: "moon", name: { en: "Luna 21", ja: "ルナ21号" },
    date: "1973-01-15T22:35Z", lat: 25.9994, lon: 30.4076, agency: AGENCY.USSR,
    country: "SU", note: "Carried Lunokhod 2.",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/luna-23", place: "moon/luna-23", body: "moon", name: { en: "Luna 23", ja: "ルナ23号" },
    date: "1974-11-06T05:37Z", lat: 12.6667, lon: 62.1511, agency: AGENCY.USSR,
    country: "SU",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/luna-24", place: "moon/luna-24", body: "moon", name: { en: "Luna 24", ja: "ルナ24号" },
    date: "1976-08-18T06:36Z", lat: 12.7142, lon: 62.2129, agency: AGENCY.USSR,
    country: "SU",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/chang-e-3", place: "moon/chang-e-3", body: "moon", name: { en: "Chang'e 3", ja: "嫦娥3号" },
    alsoAt: ["moon/yutu"],
    date: "2013-12-14T13:11Z", lat: 44.1214, lon: -19.5117, agency: AGENCY.CNSA,
    country: "CN", stand: "chang-e-3",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/chang-e-4", place: "moon/chang-e-4", body: "moon", name: { en: "Chang'e 4", ja: "嫦娥4号" },
    alsoAt: ["moon/yutu-2"],
    date: "2019-01-03T02:26Z", lat: -45.4561, lon: 177.5885, agency: AGENCY.CNSA,
    country: "CN", stand: "chang-e-4",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/chang-e-5", place: "moon/chang-e-5-lander", body: "moon", name: { en: "Chang'e 5", ja: "嫦娥5号" },
    date: "2020-12-01T15:11Z", lat: 43.0576, lon: -51.9161, agency: AGENCY.CNSA,
    country: "CN",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/chandrayaan-3", place: "moon/chandrayaan-3-vikram", body: "moon", name: { en: "Chandrayaan-3", ja: "チャンドラヤーン3号" },
    alsoAt: ["moon/pragyan"],
    date: "2023-08-23T12:32Z", lat: -69.3741, lon: 32.32, agency: AGENCY.ISRO,
    country: "IN",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/slim", place: "moon/slim", body: "moon", name: { en: "SLIM", ja: "SLIM" },
    alsoAt: ["moon/lev-1", "moon/lev-2"],
    date: "2024-01-19T15:19Z", lat: -13.316, lon: 25.251, agency: AGENCY.JAXA,
    country: "JP",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/im-1", place: "moon/im-1-odysseus", body: "moon", name: { en: "IM-1 Odysseus", ja: "IM-1 オデュッセウス" },
    date: "2024-02-22T23:23Z", lat: -80.13, lon: 1.44, agency: AGENCY.IM,
    country: "US",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/chang-e-6", place: "moon/chang-e-6-lander", body: "moon", name: { en: "Chang'e 6", ja: "嫦娥6号" },
    date: "2024-06-01T22:23Z", lat: -41.6385, lon: -153.9852, agency: AGENCY.CNSA,
    country: "CN",
    source: SRC_NASA_MOON,
  },
  {
    id: "moon/blue-ghost-1", place: "moon/blue-ghost-1", body: "moon", name: { en: "Blue Ghost 1", ja: "ブルーゴースト ミッション1" },
    date: "2025-03-02T08:34Z", lat: 18.562, lon: 61.81, agency: AGENCY.FF,
    country: "US",
    source: SRC_NASA_MOON, page: `${NSS}2025-010A`,
  },
  {
    id: "moon/im-2", place: "moon/im-2-athena", body: "moon", name: { en: "IM-2 Athena", ja: "IM-2 アテナ" },
    date: "2025-03-06T17:28Z", lat: -84.7906, lon: 29.1957, agency: AGENCY.IM,
    country: "US",
    source: SRC_NASA_MOON, page: `${NSS}PRIME-1`,
  },
  {
    id: "mars/mars-3", place: "mars/mars-3-lander", body: "mars", name: { en: "Mars 3", ja: "マルス3号" },
    alsoAt: ["mars/prop-m"],
    date: "1971-12-02T13:47Z", lat: -45.045, lon: -157.977, agency: AGENCY.USSR,
    country: "SU", approximate: true, note: "Soft landed, then fell silent after about 20 seconds.",
    source: SRC_GCAT, checkedAgainst: SRC_MARS24,
  },
  {
    id: "mars/viking-1", place: "mars/viking-1", body: "mars", name: { en: "Viking 1", ja: "バイキング1号" },
    date: "1976-07-20T11:53Z", lat: 22.27, lon: -47.95, agency: AGENCY.NASA,
    country: "US",
    source: { name: "NASA NSSDCA, Viking 1 lander", url: `${NSS}1975-075C` }, checkedAgainst: SRC_MARS24, page: `${NSS}1975-075C`,
  },
  {
    id: "mars/viking-2", place: "mars/viking-2", body: "mars", name: { en: "Viking 2", ja: "バイキング2号" },
    date: "1976-09-03T22:37Z", lat: 47.6673, lon: 134.2809, agency: AGENCY.NASA,
    country: "US",
    source: { name: "NASA NSSDCA, Viking 2 lander", url: `${NSS}1975-083C` }, checkedAgainst: SRC_MARS24, page: `${NSS}1975-083C`,
  },
  {
    id: "mars/mars-pathfinder", place: "mars/mars-pathfinder", body: "mars", name: { en: "Mars Pathfinder", ja: "マーズ・パスファインダー" },
    alsoAt: ["mars/sojourner"],
    date: "1997-07-04T16:56Z", lat: 19.095, lon: -33.253, agency: AGENCY.NASA,
    country: "US",
    source: SRC_ODE, checkedAgainst: SRC_MARS24, page: `${NSS}1996-068A`,
  },
  {
    id: "mars/spirit", place: "mars/spirit", body: "mars", name: { en: "Spirit", ja: "スピリット" },
    alsoAt: ["mars/spirit-s-lander"],
    date: "2004-01-04T04:25Z", lat: -14.5719, lon: 175.4785, agency: AGENCY.NASA,
    country: "US",
    source: SRC_ODE, checkedAgainst: SRC_MARS24, page: `${NSS}2003-027A`,
  },
  {
    id: "mars/opportunity", place: "mars/opportunity", body: "mars", name: { en: "Opportunity", ja: "オポチュニティ" },
    alsoAt: ["mars/opportunity-s-lander"],
    date: "2004-01-25T04:54Z", lat: -1.9483, lon: -5.5258, agency: AGENCY.NASA,
    country: "US",
    source: SRC_ODE, checkedAgainst: SRC_MARS24, page: `${NSS}2003-032A`,
  },
  {
    id: "mars/phoenix", place: "mars/phoenix", body: "mars", name: { en: "Phoenix", ja: "フェニックス" },
    date: "2008-05-25T23:38Z", lat: 67.9859, lon: -125.75, agency: AGENCY.NASA,
    country: "US", note: "The source prints 68.22 N, a planetographic latitude; the latitude here is the planetocentric one.",
    source: SRC_ODE, checkedAgainst: SRC_MARS24, page: `${NSS}2007-034A`,
  },
  {
    id: "mars/curiosity", place: "mars/curiosity", body: "mars", name: { en: "Curiosity", ja: "キュリオシティ" },
    alsoAt: ["mars/curiosity-s-descent-stage"],
    date: "2012-08-06T05:17Z", lat: -4.5895, lon: 137.4417, agency: AGENCY.NASA,
    country: "US", stand: "curiosity",
    source: SRC_GCAT, checkedAgainst: SRC_ODE, page: `${NSS}2011-070A`,
  },
  {
    id: "mars/insight", place: "mars/insight", body: "mars", name: { en: "InSight", ja: "インサイト" },
    date: "2018-11-26T19:44Z", lat: 4.5, lon: 135.62, agency: AGENCY.NASA,
    country: "US",
    source: SRC_MARS24, page: `${NSS}2018-042A`,
  },
  {
    id: "mars/perseverance", place: "mars/perseverance", body: "mars", name: { en: "Perseverance", ja: "パーシビアランス" },
    alsoAt: ["mars/perseverance-s-descent-stage"],
    date: "2021-02-18T20:43Z", lat: 18.4446, lon: 77.4508, agency: AGENCY.NASA,
    country: "US", stand: "perseverance",
    source: SRC_GCAT, checkedAgainst: SRC_MARS24, page: `${NSS}2020-052A`,
  },
  {
    id: "mars/zhurong", place: "mars/zhurong", body: "mars", name: { en: "Zhurong", ja: "祝融号" },
    alsoAt: ["mars/tianwen-1-lander"],
    date: "2021-05-14T23:17Z", lat: 25.066, lon: 109.925, agency: AGENCY.CNSA,
    country: "CN",
    source: SRC_GCAT, checkedAgainst: SRC_MARS24,
  },
];

/**
 * The landing sites of one body, by date.
 *
 * @param body - `moon` or `mars`.
 * @returns Its sites.
 *
 * @example
 * ```ts
 * import { landingSitesOf } from "@johnmorrisdotca/wakusei-planets/landing-sites";
 *
 * console.log(landingSitesOf("mars").map((site) => `${site.name.en} ${site.date.slice(0, 4)}`).join(", "));
 * ```
 */
export function landingSitesOf(body: LandingSite["body"]): LandingSite[] {
  return LANDING_SITES.filter((site) => site.body === body);
}

/**
 * A landing site by its id (`moon/apollo-11`), by the id of its place in the place tables (`moon/apollo-11-lunar-module`, or its rover's), or by its name in English or Japanese in any case, or `undefined`.
 *
 * @param text - The id, place id or name.
 * @returns The site, or `undefined` when none matches.
 *
 * @example
 * ```ts
 * import { findLandingSite } from "@johnmorrisdotca/wakusei-planets/landing-sites";
 *
 * console.log(findLandingSite("moon/apollo-11-lunar-module")?.name.ja, findLandingSite("zhurong")?.country, findLandingSite("nowhere"));
 * ```
 */
export function findLandingSite(text: string): LandingSite | undefined {
  if (typeof text !== "string") return undefined;
  const wanted = text.trim().toLowerCase();
  return LANDING_SITES.find((site) => site.id === wanted || site.place === wanted || site.alsoAt?.includes(wanted) === true || site.name.en.toLowerCase() === wanted || site.name.ja === text.trim() || site.id.slice(site.id.indexOf("/") + 1) === wanted);
}

/**
 * The code a flag element (`<hata-flag code="...">`, from `@johnmorrisdotca/hata`) takes for a country as the place tables and the landing sites write it: the two letters of ISO 3166-1 in capitals, `SU` for the Soviet Union, and GCAT's `J` for Japan
 * (`JP`). A country with no flag to show (an agency of several countries) or with no code gives `undefined`.
 *
 * @param country - A site's `country`, or a place's.
 * @returns The code, or `undefined`.
 *
 * @example
 * ```ts
 * import { flagCodeOf } from "@johnmorrisdotca/wakusei-planets/landing-sites";
 *
 * console.log(flagCodeOf("J"), flagCodeOf("SU"), flagCodeOf("us"), flagCodeOf("ESA"), flagCodeOf(undefined));
 * ```
 */
export function flagCodeOf(country: string | undefined): string | undefined {
  if (country === undefined) return undefined;
  const code = country.trim().toUpperCase();
  if (code === "J") return "JP";
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}
