// The numbers of a giant planet's moon page, worked out when the site is built (site.ts) from the package's own data, so nothing on the page is typed by hand: every orbit of /moon-catalogue
// as points seen from the planet's pole, where each moon is on the page's day, the key to the orbit colours, every catalogue moon for the table and the moons drawn in full for the cards.
import { discoveryOf } from "../src/discovery.ts";
import { BODIES, MOONS_OF, type BodyId } from "../src/facts.ts";
import { catalogueMoonOrbit, catalogueMoonPosition, catalogueMoonsOf, findCatalogueMoon, moonFamilies, moonOrbitColor, moonOrbitKey, MOON_CATALOGUE_FETCHED, MOON_OSCULATING_EPOCH_JD, type MoonKeyEntry, type MoonNames } from "../src/moon-catalogue.ts";
import { shapeBasis, shapeNote } from "../src/shape-basis.ts";
import { cross, dot, fromRaDec, toEcliptic, type Vec3 } from "../src/vec.ts";

/** The planets that have a page. */
export const MOON_PAGE_HOSTS = ["jupiter", "saturn", "uranus", "neptune"] as const;
export type MoonPageHost = (typeof MOON_PAGE_HOSTS)[number];

/** The page's day: the day the irregular moons' osculating orbits were taken, where the catalogue places them best. */
export const MOON_PAGE_TIME = (MOON_OSCULATING_EPOCH_JD - 2440587.5) * 86_400_000;
const POINTS = 48;

/** One moon of the catalogue as the page uses it. Distances are in the page's `unit` of kilometres, rounded. */
export interface PageMoon {
  id: string;
  en: string;
  ja: string | null;
  family: string;
  /** Radius in km, or null when no source gives one; `est` when it is worked out from the brightness. */
  r: number | null;
  est: boolean;
  /** Semi-major axis (km) and period (days), or null with no orbit. */
  a: number | null;
  p: number | null;
  /** 1 retrograde, 0 prograde, null with no orbit. */
  retro: 0 | 1 | null;
  year: number | null;
  by: string | null;
  where: string | null;
  full: boolean;
  colour: { direction: string; group: string };
  /** The orbit seen from above the planet's north pole: x, y, z for each point, in `unit` km. */
  orbit: number[] | null;
  /** Where it is on the page's day, the same way. */
  at: [number, number, number] | null;
}

/** A moon drawn in full, for a card. */
export interface PageCard {
  id: string;
  name: MoonNames;
  radiusKm: number;
  axesKm: readonly number[] | null;
  a: number | null;
  p: number | null;
  retro: boolean;
  date: string | null;
  where: string | null;
  by: string | null;
  shape: { en: string; ja: string } | null;
}

export interface MoonPage {
  host: MoonPageHost;
  name: MoonNames;
  radiusKm: number;
  colour: string;
  time: number;
  fetched: string;
  unit: number;
  /** The reach of the regular moons (the inner view), in `unit` km. */
  inner: number;
  families: { id: string; names: MoonNames; count: number }[];
  key: { direction: readonly MoonKeyEntry[]; group: readonly MoonKeyEntry[] };
  moons: PageMoon[];
  cards: PageCard[];
  counts: { total: number; named: number; retrograde: number; prograde: number; estimated: number; featured: number; shaped: number };
}

/** The axes of the planet's north pole in the J2000 ecliptic (the plan's own): x along its equator, y a quarter turn on, z up the pole. */
function poleBasis(host: MoonPageHost): [Vec3, Vec3, Vec3] {
  const { ra, dec } = BODIES[host].pole;
  const z = toEcliptic(fromRaDec(ra, dec));
  const x = toEcliptic(fromRaDec(ra + 90, 0));
  return [x, cross(z, x), z];
}

/** The page of one planet. */
export function moonPage(host: MoonPageHost): MoonPage {
  const catalogue = catalogueMoonsOf(host);
  const basis = poleBasis(host);
  const smallest = Math.min(...catalogue.flatMap((m) => (m.orbit === null ? [] : [m.orbit.a])));
  const unit = 10 ** Math.floor(Math.log10(smallest / 100));
  const turn = (v: Vec3): [number, number, number] => [Math.round(dot(v, basis[0]) / unit), Math.round(dot(v, basis[1]) / unit), Math.round(dot(v, basis[2]) / unit)];
  const families = moonFamilies(host);
  const familyOf = new Map<string, string>();
  for (const family of families) for (const moon of family.moons) familyOf.set(moon.id, family.id);
  const moons: PageMoon[] = catalogue.map((m) => {
    const record = discoveryOf(m.id);
    const orbit = catalogueMoonOrbit(m, MOON_PAGE_TIME, POINTS);
    const at = catalogueMoonPosition(m, MOON_PAGE_TIME);
    return {
      id: m.id,
      en: m.label,
      ja: m.ja,
      family: familyOf.get(m.id) ?? "",
      r: m.radiusKm,
      est: m.radiusFrom === "derived",
      a: m.orbit?.a ?? null,
      p: m.orbit?.periodDays ?? null,
      retro: m.orbit === null ? null : m.retrograde ? 1 : 0,
      year: m.discovery.year,
      by: m.discovery.by,
      where: record?.place?.value ?? null,
      full: m.full,
      colour: { direction: moonOrbitColor(m, "direction"), group: moonOrbitColor(m, "group") },
      orbit: orbit === undefined ? null : orbit.slice(0, POINTS).flatMap(turn),
      at: at === undefined ? null : turn(at),
    };
  });
  const regular = catalogue.filter((m) => m.orbit !== null && ["major", "inner", "regular"].includes(m.group) && m.id !== "phoebe");
  const cards: PageCard[] = [...MOONS_OF[host]]
    .map((id) => ({ id, row: findCatalogueMoon(id) }))
    .sort((p, q) => (p.row?.orbit?.a ?? Infinity) - (q.row?.orbit?.a ?? Infinity))
    .map(({ id, row }) => {
      const facts = BODIES[id as BodyId];
      const record = discoveryOf(id);
      const basisOf = shapeBasis(id as BodyId);
      return {
        id,
        name: facts.name,
        radiusKm: facts.radiusKm,
        axesKm: "axesKm" in facts ? (facts.axesKm as readonly number[]) : null,
        a: row?.orbit?.a ?? null,
        p: row?.orbit?.periodDays ?? null,
        retro: row?.retrograde ?? false,
        date: record?.date?.value ?? (row?.discovery.year === null || row === undefined ? null : String(row.discovery.year)),
        where: record?.place?.value ?? null,
        by: record?.by?.value.join(", ") ?? row?.discovery.by ?? null,
        shape: basisOf === undefined ? null : { en: shapeNote(id as BodyId, "en"), ja: shapeNote(id as BodyId, "ja") },
      };
    });
  const direction = moonOrbitKey("direction", [host]);
  return {
    host,
    name: BODIES[host].name,
    radiusKm: BODIES[host].radiusKm,
    colour: BODIES[host].colour,
    time: MOON_PAGE_TIME,
    fetched: MOON_CATALOGUE_FETCHED,
    unit,
    inner: Math.round(Math.max(...regular.map((m) => m.orbit!.a * (1 + m.orbit!.e))) / unit),
    families: families.map((f) => ({ id: f.id, names: f.names, count: f.count })),
    key: { direction, group: moonOrbitKey("group", [host]) },
    moons,
    cards,
    counts: {
      total: catalogue.length,
      named: catalogue.filter((m) => m.named).length,
      retrograde: direction.find((d) => d.id === "retrograde")?.count ?? 0,
      prograde: direction.find((d) => d.id === "prograde")?.count ?? 0,
      estimated: catalogue.filter((m) => m.radiusFrom === "derived").length,
      featured: cards.length,
      shaped: cards.filter((c) => c.shape !== null).length,
    },
  };
}
