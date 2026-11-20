// A planet's edge and a column of dots: the moons numbered I to XVI, nearest first, each dot sized by its diameter. No pictures of the moons, and no DOM.
import { catalogueMoonsOf } from "./moon-catalogue.ts";
import { MOON_PAGE_HOSTS, type MoonPageHost } from "./moon-pages/data.ts";

/** How high an IAU number the column keeps. XVI is the last moon on the Jupiter reference. */
export const MOON_DOT_LIMIT = 16;

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

/** The value of a Roman numeral, or null when the text is not one. */
export function romanValue(text: string): number | null {
  if (!/^[IVXLCDM]+$/.test(text)) return null;
  let total = 0;
  let prev = 0;
  for (const ch of [...text].reverse()) {
    const value = ROMAN[ch] ?? 0;
    total += value < prev ? -value : value;
    prev = Math.max(prev, value);
  }
  return total;
}

export interface MoonDot {
  id: string;
  label: string;
  ja: string | null;
  radiusKm: number | null;
  /** True when the radius is derived from a magnitude, not measured. */
  estimate: boolean;
  distanceKm: number;
  /** The drawn diameter in pixels. A moon with no size gets the smallest dot. */
  px: number;
}

/** The moons numbered I to XVI, nearest the planet first. A dot's pixels follow the radius, with a floor so a small moon stays visible. */
export function moonDotColumn(host: MoonPageHost): MoonDot[] {
  const chosen = catalogueMoonsOf(host).flatMap((moon) => {
    if (moon.number === null) return [];
    const n = romanValue(moon.number);
    if (n === null || n < 1 || n > MOON_DOT_LIMIT) return [];
    return [moon];
  });
  const max = Math.max(1, ...chosen.map((moon) => moon.radiusKm ?? 0));
  return chosen.map((moon) => ({
    id: moon.id,
    label: moon.label,
    ja: moon.ja,
    radiusKm: moon.radiusKm,
    estimate: moon.radiusFrom === "derived",
    distanceKm: moon.orbit?.a ?? 0,
    px: moon.radiusKm === null ? 8 : Math.max(8, Math.round(72 * (moon.radiusKm / max))),
  }));
}

export { MOON_PAGE_HOSTS };
