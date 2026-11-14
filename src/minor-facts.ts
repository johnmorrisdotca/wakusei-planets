// Public facts for the minor bodies and dwarf planets the space view places: the size and shape of the orbit, the period, and who found the body and when. Every figure is typed from NASA/JPL's Small-Body Database
// lookup API (https://ssd-api.jpl.nasa.gov/sbdb.api, read one object at a time on 2026-11-13) as a plain fact, with the uncertainty (`sigma`) and the epoch the database gives with it; each record says which answer it
// is typed from (`source`). The discovery is as the database states it (the date and the finders' names in its form, the place it names), and is left out where the database gives none. Nothing is copied from any
// text. NOTICE.md names the source and the terms. Pure: no DOM, no clock reads, no three.js.

const SBDB = "NASA/JPL Small-Body Database lookup API";
const READ = "2026-11-13";

/**
 * The bodies there are facts for: the five minor bodies the view places (Vesta, Pallas, Chiron, Pholus, Halley's comet) and the dwarf planets (Ceres, Pluto, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna).
 *
 * @example
 * ```ts
 * import { MINOR_FACT_IDS } from "@johnmorrisdotca/wakusei-planets/minor-facts";
 *
 * console.log(MINOR_FACT_IDS.join(", "));
 * ```
 */
export const MINOR_FACT_IDS = ["ceres", "pallas", "vesta", "chiron", "pholus", "halley", "pluto", "orcus", "haumea", "quaoar", "makemake", "gonggong", "eris", "sedna"] as const;

/**
 * The id of a body there are facts for, the same one the space view and `BODIES` use.
 *
 * @example
 * ```ts
 * import { MINOR_FACT_IDS, type MinorFactId } from "@johnmorrisdotca/wakusei-planets/minor-facts";
 *
 * const id: MinorFactId = MINOR_FACT_IDS[0];
 * console.log(id);
 * ```
 */
export type MinorFactId = (typeof MINOR_FACT_IDS)[number];

/**
 * One figure as the database gives it: the value and its one-sigma uncertainty, in the same unit, or `null` where the database gives none (it gives none for Pluto's orbit).
 *
 * @example
 * ```ts
 * import { MINOR_FACTS, type MinorFigure } from "@johnmorrisdotca/wakusei-planets/minor-facts";
 *
 * const a: MinorFigure = MINOR_FACTS.vesta.orbit.semiMajorAxisAu;
 * console.log(a.value, a.sigma);
 * ```
 */
export interface MinorFigure {
  value: number;
  sigma: number | null;
}

/**
 * The orbit as osculating elements at one moment, the epoch: the orbit the body would follow if only the Sun pulled on it from then on. The planets' pull changes the real orbit a little, so these are the values at
 * the epoch and not for all time (the semi-major axis and the period of a comet most of all). `epoch` is a Julian date (TDB) and is the database's own for each body: 2461200.5 (2026-06-09) for all but Pluto
 * (2457588.5, 2016-07-19) and Halley (2439875.5, 1968-01-20).
 *
 * @example
 * ```ts
 * import { MINOR_FACTS, type MinorOrbit } from "@johnmorrisdotca/wakusei-planets/minor-facts";
 *
 * const orbit: MinorOrbit = MINOR_FACTS.eris.orbit;
 * console.log(orbit.semiMajorAxisAu.value, orbit.periodDays.value / 365.25);
 * ```
 */
export interface MinorOrbit {
  epoch: number;
  /** Half the long axis of the ellipse, in astronomical units. */
  semiMajorAxisAu: MinorFigure;
  eccentricity: MinorFigure;
  /** The nearest the body comes to the Sun, in astronomical units. */
  perihelionAu: MinorFigure;
  /** The furthest the body goes from the Sun, in astronomical units. */
  aphelionAu: MinorFigure;
  /** The sidereal period, in days. */
  periodDays: MinorFigure;
}

/**
 * Who found a body and when, as the database states it: the date (`YYYY-MM-DD`), the finders' names in the database's form ("Olbers, H. W."), and the place it names, where it names one. Where the database gives no
 * discovery the record has none.
 *
 * @example
 * ```ts
 * import { MINOR_FACTS, type MinorDiscovery } from "@johnmorrisdotca/wakusei-planets/minor-facts";
 *
 * const found: MinorDiscovery = MINOR_FACTS.ceres.discovery!;
 * console.log(found.date, found.by.join(" and "));
 * ```
 */
export interface MinorDiscovery {
  date: string;
  by: string[];
  place?: string;
}

/**
 * Where a record comes from: the source, the answer it was typed from (a URL that gives it again) and the day it was read.
 *
 * @example
 * ```ts
 * import { MINOR_FACTS, type MinorSource } from "@johnmorrisdotca/wakusei-planets/minor-facts";
 *
 * const source: MinorSource = MINOR_FACTS.pluto.source;
 * console.log(source.name, source.read);
 * ```
 */
export interface MinorSource {
  name: string;
  url: string;
  read: string;
}

/**
 * The facts of one body.
 *
 * @example
 * ```ts
 * import { MINOR_FACTS, type MinorFacts } from "@johnmorrisdotca/wakusei-planets/minor-facts";
 *
 * const halley: MinorFacts = MINOR_FACTS.halley;
 * console.log(halley.designation, halley.orbit.periodDays.value / 365.25);
 * ```
 */
export interface MinorFacts {
  id: MinorFactId;
  /** The database's full name: the number, the name and the provisional designation ("4 Vesta (A807 FA)"). */
  designation: string;
  orbit: MinorOrbit;
  discovery?: MinorDiscovery;
  source: MinorSource;
}

/**
 * The facts of every body in `MINOR_FACT_IDS`, by id, read from NASA/JPL's Small-Body Database on 2026-11-13.
 *
 * @example
 * ```ts
 * import { MINOR_FACTS } from "@johnmorrisdotca/wakusei-planets/minor-facts";
 *
 * console.log(MINOR_FACTS.sedna.orbit.aphelionAu.value);
 * ```
 */
export const MINOR_FACTS: Readonly<Record<MinorFactId, MinorFacts>> = {
  ceres: {
    id: "ceres",
    designation: "1 Ceres (A801 AA)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 2.765552595034094, sigma: 1.0134e-11 }, eccentricity: { value: 0.07969229514816586, sigma: 4.7755e-12 }, perihelionAu: { value: 2.545159361382861, sigma: 1.9113e-11 }, aphelionAu: { value: 2.985945828685327, sigma: 1.0942e-11 }, periodDays: { value: 1679.853119758983, sigma: 9.2333e-9 } },
    discovery: { date: "1801-01-01", by: ["Piazzi, G."], place: "Palermo" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=1&discovery=1&full-prec=true", read: READ },
  },
  pallas: {
    id: "pallas",
    designation: "2 Pallas (A802 FA)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 2.769559010737709, sigma: 1.7736e-9 }, eccentricity: { value: 0.2307000995648547, sigma: 5.7536e-9 }, perihelionAu: { value: 2.130621471209779, sigma: 1.5815e-8 }, aphelionAu: { value: 3.408496550265638, sigma: 2.1828e-9 }, periodDays: { value: 1683.504809564834, sigma: 1.6172e-6 } },
    discovery: { date: "1802-03-28", by: ["Olbers, H. W."], place: "Bremen" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=2&discovery=1&full-prec=true", read: READ },
  },
  vesta: {
    id: "vesta",
    designation: "4 Vesta (A807 FA)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 2.361365965127599, sigma: 1.5328e-9 }, eccentricity: { value: 0.09020374382834395, sigma: 2.2909e-10 }, perihelionAu: { value: 2.148361914524259, sigma: 1.9335e-9 }, aphelionAu: { value: 2.574370015730939, sigma: 1.6711e-9 }, periodDays: { value: 1325.389042911101, sigma: 1.2905e-6 } },
    discovery: { date: "1807-03-29", by: ["Olbers, H. W."], place: "Bremen" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=4&discovery=1&full-prec=true", read: READ },
  },
  chiron: {
    id: "chiron",
    designation: "2060 Chiron (1977 UB)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 13.68426760850124, sigma: 5.2989e-7 }, eccentricity: { value: 0.3797656311453571, sigma: 1.7864e-8 }, perihelionAu: { value: 8.487453083396799, sigma: 5.5771e-7 }, aphelionAu: { value: 18.88108213360567, sigma: 7.3112e-7 }, periodDays: { value: 18489.73832227898, sigma: 0.0010739 } },
    discovery: { date: "1977-10-18", by: ["Kowal, C."], place: "Palomar" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=2060&discovery=1&full-prec=true", read: READ },
  },
  pholus: {
    id: "pholus",
    designation: "5145 Pholus (1992 AD)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 20.28965436859272, sigma: 4.6692e-5 }, eccentricity: { value: 0.574687297345862, sigma: 6.2553e-7 }, perihelionAu: { value: 8.629447735424508, sigma: 8.6176e-6 }, aphelionAu: { value: 31.94986100176094, sigma: 7.3526e-5 }, periodDays: { value: 33381.84992120905, sigma: 0.11523 } },
    discovery: { date: "1992-01-09", by: ["Spacewatch"], place: "Kitt Peak" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=5145&discovery=1&full-prec=true", read: READ },
  },
  halley: {
    id: "halley",
    designation: "1P/Halley",
    orbit: { epoch: 2439875.5, semiMajorAxisAu: { value: 17.92863504856923, sigma: 9.9587e-9 }, eccentricity: { value: 0.9679359956953211, sigma: 7.5527e-9 }, perihelionAu: { value: 0.5748638313743413, sigma: 1.3552e-7 }, aphelionAu: { value: 35.28240626576412, sigma: 1.9598e-8 }, periodDays: { value: 27728.04608790421, sigma: 2.3103e-5 } },
    discovery: { date: "1758-12-25", by: ["Palitzsch, Johann Georg"] },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=1P&discovery=1&full-prec=true", read: READ },
  },
  pluto: {
    id: "pluto",
    designation: "134340 Pluto (1930 BM)",
    orbit: { epoch: 2457588.5, semiMajorAxisAu: { value: 39.58862938517124, sigma: null }, eccentricity: { value: 0.2518378778576892, sigma: null }, perihelionAu: { value: 29.61871297351516, sigma: null }, aphelionAu: { value: 49.55854579682732, sigma: null }, periodDays: { value: 90981.71647718345, sigma: null } },
    discovery: { date: "1930-01-23", by: ["Tombaugh, C. W."], place: "Flagstaff" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=134340&discovery=1&full-prec=true", read: READ },
  },
  orcus: {
    id: "orcus",
    designation: "90482 Orcus (2004 DW)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 39.37686537914865, sigma: 2.1925e-5 }, eccentricity: { value: 0.2205240628250881, sigma: 4.9013e-7 }, perihelionAu: { value: 30.69331904442224, sigma: 3.6081e-5 }, aphelionAu: { value: 48.06041171387506, sigma: 2.676e-5 }, periodDays: { value: 90252.68650688507, sigma: 0.075379 } },
    discovery: { date: "2004-02-17", by: ["Brown, M.", "Trujillo, C."], place: "Palomar" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=90482&discovery=1&full-prec=true", read: READ },
  },
  haumea: {
    id: "haumea",
    designation: "136108 Haumea (2003 EL61)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 43.06029023650952, sigma: 4.0486e-5 }, eccentricity: { value: 0.1944430148898797, sigma: 1.1561e-6 }, perihelionAu: { value: 34.68751758088936, sigma: 6.4457e-5 }, aphelionAu: { value: 51.43306289212968, sigma: 4.8358e-5 }, periodDays: { value: 103208.1173403618, sigma: 0.14556 } },
    discovery: { date: "2003-03-07", by: ["Aceituno, F. J.", "Santos-Sanz, P.", "Ortiz, J. L."], place: "Sierra Nevada" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=136108&discovery=1&full-prec=true", read: READ },
  },
  quaoar: {
    id: "quaoar",
    designation: "50000 Quaoar (2002 LM60)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 43.15617622670811, sigma: 2.8726e-5 }, eccentricity: { value: 0.03520019261837198, sigma: 1.6333e-6 }, perihelionAu: { value: 41.63707051085558, sigma: 7.0451e-5 }, aphelionAu: { value: 44.67528194256064, sigma: 2.9737e-5 }, periodDays: { value: 103553.0425468722, sigma: 0.10339 } },
    discovery: { date: "2002-06-04", by: ["Trujillo, C. A.", "Brown, M. E."], place: "Palomar" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=50000&discovery=1&full-prec=true", read: READ },
  },
  makemake: {
    id: "makemake",
    designation: "136472 Makemake (2005 FY9)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 45.57093317300052, sigma: 5.3653e-5 }, eccentricity: { value: 0.1588889953992523, sigma: 1.185e-6 }, perihelionAu: { value: 38.33021338173601, sigma: 9.0359e-5 }, aphelionAu: { value: 52.81165296426503, sigma: 6.2178e-5 }, periodDays: { value: 112364.8068762869, sigma: 0.19844 } },
    discovery: { date: "2005-03-31", by: ["Brown, M. E.", "Trujillo, C. A.", "Rabinowitz, D."], place: "Palomar" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=136472&discovery=1&full-prec=true", read: READ },
  },
  gonggong: {
    id: "gonggong",
    designation: "225088 Gonggong (2007 OR10)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 66.86666567773766, sigma: 0.002095 }, eccentricity: { value: 0.5042510000302973, sigma: 1.8857e-5 }, perihelionAu: { value: 33.14908264104688, sigma: 0.0011603 }, aphelionAu: { value: 100.5842487144284, sigma: 0.0031514 }, periodDays: { value: 199716.0317096358, sigma: 9.386 } },
    discovery: { date: "2007-07-17", by: ["Schwamb, M. E.", "Brown, M. E.", "Rabinowitz, D."], place: "Palomar" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=225088&discovery=1&full-prec=true", read: READ },
  },
  eris: {
    id: "eris",
    designation: "136199 Eris (2003 UB313)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 67.93394687853566, sigma: 0.0002545 }, eccentricity: { value: 0.4382385347971672, sigma: 3.4663e-6 }, perihelionAu: { value: 38.16267353549761, sigma: 0.00015516 }, aphelionAu: { value: 97.70522022157373, sigma: 0.00036603 }, periodDays: { value: 204516.6629430732, sigma: 1.1493 } },
    discovery: { date: "2003-10-21", by: ["Brown, M. E.", "Trujillo, C. A.", "Rabinowitz, D."], place: "Palomar" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=136199&discovery=1&full-prec=true", read: READ },
  },
  sedna: {
    id: "sedna",
    designation: "90377 Sedna (2003 VB12)",
    orbit: { epoch: 2461200.5, semiMajorAxisAu: { value: 543.7195289104732, sigma: 0.1459 }, eccentricity: { value: 0.8598824585187618, sigma: 3.7251e-5 }, perihelionAu: { value: 76.18464364627253, sigma: 0.0011033 }, aphelionAu: { value: 1011.254414174674, sigma: 0.27137 }, periodDays: { value: 4630851.183590915, sigma: 1864 } },
    discovery: { date: "2003-11-14", by: ["Brown, M. E.", "Trujillo, C. A.", "Rabinowitz, D."], place: "Palomar" },
    source: { name: SBDB, url: "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=90377&discovery=1&full-prec=true", read: READ },
  },
};

/**
 * The facts of a body by id, in any case, or `undefined` for a body there are none for.
 *
 * @param id - A body's id.
 * @returns Its facts, or `undefined` for an id there are no facts for.
 *
 * @example
 * ```ts
 * import { minorFacts } from "@johnmorrisdotca/wakusei-planets/minor-facts";
 *
 * console.log(minorFacts("Quaoar")?.discovery?.date);
 * ```
 */
export function minorFacts(id: string): MinorFacts | undefined {
  const key = id.toLowerCase();
  return (MINOR_FACT_IDS as readonly string[]).includes(key) ? MINOR_FACTS[key as MinorFactId] : undefined;
}

/**
 * A body's period in Julian years of 365.25 days, from the database's period in days (a figure worked out here, not one the database states).
 *
 * @param facts - A body's facts.
 * @returns The period in years.
 *
 * @example
 * ```ts
 * import { MINOR_FACTS, periodYears } from "@johnmorrisdotca/wakusei-planets/minor-facts";
 *
 * console.log(periodYears(MINOR_FACTS.vesta).toFixed(2));
 * ```
 */
export function periodYears(facts: MinorFacts): number {
  return facts.orbit.periodDays.value / 365.25;
}

