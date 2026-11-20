// Jupiter's moons as a chart: one circle each, larger for a larger moon, higher for a moon farther out, coloured by family. No DOM.
import { BODIES } from "./facts.ts";
import { catalogueMoonsOf, moonFamilies, moonOrbitColor, MOON_CATALOGUE_FETCHED, type CatalogueMoon } from "./moon-catalogue.ts";

export const CHART_W = 1000;
export const CHART_H = 1300;

export interface ChartDot {
  id: string;
  label: string;
  ja: string | null;
  family: { en: string; ja: string };
  color: string;
  year: number | null;
  estimated: boolean;
  diameterKm: number;
  distanceKm: number | null;
  x: number;
  y: number;
  r: number;
}

export interface ChartLegend {
  id: string;
  names: { en: string; ja: string };
  color: string;
  count: number;
}

export interface JupiterChart {
  width: number;
  height: number;
  read: string;
  count: number;
  planet: { en: string; ja: string; x: number; y: number; r: number; color: string };
  legend: ChartLegend[];
  dots: ChartDot[];
}

const PLANET = { x: 500, y: 1220, r: 34 };
const INNER_KM = 3_000_000;

type Pending = { moon: CatalogueMoon; family: { en: string; ja: string }; familyId: string; diameter: number; distance: number | null; r: number };

/** Rows that stay inside the width. A row is one distance band, so a group is not piled onto the next. */
function rowsOf(items: Pending[]): Pending[][] {
  const rows: Pending[][] = [];
  let row: Pending[] = [];
  let width = 0;
  for (const item of items) {
    const need = item.r * 2 + 8;
    if (row.length > 0 && width + need > CHART_W - 24) {
      rows.push(row);
      row = [];
      width = 0;
    }
    row.push(item);
    width += need;
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

function layRow(items: Pending[], y: number): ChartDot[] {
  const gap = 8;
  const width = items.reduce((sum, item) => sum + item.r * 2 + gap, -gap);
  let x = (CHART_W - width) / 2;
  return items.map((item) => {
    x += item.r;
    const dot = dotOf(item.moon, item.family, item.diameter, item.distance, Math.round(x * 10) / 10, Math.round(y * 10) / 10, item.r);
    x += item.r + gap;
    return dot;
  });
}

/** Every moon of Jupiter in the catalogue, packed into one picture. A circle's area follows the moon's diameter. Each outer group has its own rows, farthest at the top, and the empty gap between the inner moons and those rows is shortened. */
export function jupiterMoonChart(): JupiterChart {
  const moons = catalogueMoonsOf("jupiter");
  const families = moonFamilies("jupiter");
  const familyOf = new Map<string, { id: string; en: string; ja: string }>();
  for (const family of families) for (const moon of family.moons) familyOf.set(moon.id, { id: family.id, ...family.names });
  const maxD = Math.max(...moons.map((moon) => (moon.radiusKm ?? 0.5) * 2));
  const pending: Pending[] = moons.map((moon) => {
    const known = familyOf.get(moon.id);
    const diameter = (moon.radiusKm ?? 0.5) * 2;
    return {
      moon,
      family: { en: known?.en ?? "", ja: known?.ja ?? "" },
      familyId: known?.id ?? "",
      diameter,
      distance: moon.orbit?.a ?? null,
      r: Math.round((11 + 23 * Math.sqrt(diameter / maxD)) * 10) / 10,
    };
  });
  const byDistance = (a: Pending, b: Pending) => (a.distance ?? Infinity) - (b.distance ?? Infinity);
  const inner = pending.filter((item) => (item.distance ?? Infinity) < INNER_KM).sort(byDistance);
  const outer = pending.filter((item) => (item.distance ?? Infinity) >= INNER_KM);
  const groups = new Map<string, Pending[]>();
  for (const item of outer) {
    const list = groups.get(item.familyId) ?? [];
    list.push(item);
    groups.set(item.familyId, list);
  }
  const outerGroups = [...groups.values()].map((items) => items.sort(byDistance)).sort((a, b) => {
    const mid = (items: Pending[]) => items.reduce((sum, item) => sum + (item.distance ?? 0), 0) / items.length;
    return mid(b) - mid(a);
  });

  const small = inner.filter((item) => item.r < 14);
  const big = inner.filter((item) => item.r >= 14);
  let y = PLANET.y - PLANET.r - 36;
  const dots: ChartDot[] = [];
  if (small.length > 0) {
    y -= Math.max(...small.map((item) => item.r));
    dots.push(...layRow(small, y));
    y -= Math.max(...small.map((item) => item.r)) + 28;
  }
  for (const item of big) {
    y -= item.r;
    dots.push(...layRow([item], y));
    y -= item.r + 64;
  }
  const outerBottom = y - 70;
  const outerRows = outerGroups.flatMap((items) => rowsOf(items));
  const span = Math.max(outerBottom - 56, outerRows.length * 36);
  const step = span / Math.max(outerRows.length, 1);
  outerRows.forEach((row, index) => {
    const band = 48 + index * step;
    const lift = Math.max(...row.map((item) => item.r));
    dots.push(...layRow(row, Math.round((band + lift) * 10) / 10));
  });
  return {
    width: CHART_W,
    height: CHART_H,
    read: MOON_CATALOGUE_FETCHED,
    count: dots.length,
    planet: { en: BODIES.jupiter.name.en, ja: BODIES.jupiter.name.ja, ...PLANET, color: BODIES.jupiter.colour },
    legend: families.filter((family) => family.count > 0).map((family) => ({ id: family.id, names: family.names, color: family.color, count: family.count })),
    dots,
  };
}

function dotOf(moon: CatalogueMoon, family: { en: string; ja: string }, diameterKm: number, distanceKm: number | null, x: number, y: number, r: number): ChartDot {
  return {
    id: moon.id,
    label: moon.label,
    ja: moon.ja,
    family,
    color: moonOrbitColor(moon, "group"),
    year: moon.discovery.year,
    estimated: moon.radiusFrom === "derived",
    diameterKm,
    distanceKm,
    x,
    y,
    r,
  };
}
