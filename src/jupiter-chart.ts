// Jupiter's moons as a chart: one circle each, larger for a larger moon, higher for a moon farther out, coloured by family. No DOM.
import { BODIES } from "./facts.ts";
import { catalogueMoonsOf, moonFamilies, moonOrbitColor, MOON_CATALOGUE_FETCHED, type CatalogueMoon } from "./moon-catalogue.ts";

export const CHART_W = 1000;
export const CHART_H = 720;

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

const PLANET = { x: 500, y: 640, r: 22 };

function fits(x: number, y: number, r: number, placed: readonly ChartDot[]): boolean {
  if (x - r < 8 || x + r > CHART_W - 8 || y - r < 36 || y + r > PLANET.y - PLANET.r - 10) return false;
  if (Math.hypot(x - PLANET.x, y - PLANET.y) < r + PLANET.r + 8) return false;
  return placed.every((dot) => Math.hypot(x - dot.x, y - dot.y) >= r + dot.r + 3);
}

/** Every moon of Jupiter in the catalogue, packed into one picture. A circle's area follows the moon's diameter, and its height follows its distance. */
export function jupiterMoonChart(): JupiterChart {
  const moons = catalogueMoonsOf("jupiter");
  const families = moonFamilies("jupiter");
  const familyOf = new Map<string, { en: string; ja: string }>();
  for (const family of families) for (const moon of family.moons) familyOf.set(moon.id, family.names);
  const distances = moons.flatMap((moon) => (moon.orbit === null ? [] : [moon.orbit.a]));
  const logMin = Math.log(Math.min(...distances));
  const logMax = Math.log(Math.max(...distances));
  const maxD = Math.max(...moons.map((moon) => (moon.radiusKm ?? 0.5) * 2));
  const ordered = [...moons].sort((a, b) => (a.orbit?.a ?? Infinity) - (b.orbit?.a ?? Infinity));
  const dots: ChartDot[] = [];
  for (const moon of ordered) {
    const diameter = (moon.radiusKm ?? 0.5) * 2;
    const r = Math.round((5 + 29 * Math.sqrt(diameter / maxD)) * 10) / 10;
    const distance = moon.orbit?.a ?? null;
    const t = distance === null ? 1 : (Math.log(distance) - logMin) / (logMax - logMin || 1);
    const y0 = 86 + (1 - t) * 500;
    let spot = { x: PLANET.x, y: y0 };
    let found = false;
    for (let n = 0; n < 420 && !found; n++) {
      const row = Math.floor(n / 36);
      const col = n % 36;
      const y = y0 - row * 4;
      const side = col === 0 ? 0 : (col % 2 === 0 ? 1 : -1) * Math.ceil(col / 2);
      const x = PLANET.x + side * (r * 2 + 4);
      if (fits(x, y, r, dots)) {
        spot = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
        found = true;
      }
    }
    dots.push(dotOf(moon, familyOf.get(moon.id) ?? { en: "", ja: "" }, diameter, distance, spot.x, spot.y, r));
  }
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
