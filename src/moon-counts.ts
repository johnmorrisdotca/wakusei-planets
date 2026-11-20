// Who has the most moons: the planets the package already paints, Mercury through Pluto, with each one's count taken from the moon catalogue. A host the catalogue does not list has none. No DOM.
import { BODIES } from "./facts.ts";
import { moonCounts, type HostId } from "./moon-catalogue.ts";

/** The nine the count grid draws, in solar-system order. Pluto is last, as on the poster. */
export const MOON_COUNT_IDS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
export type MoonCountId = (typeof MOON_COUNT_IDS)[number];

export interface MoonCountRow {
  id: MoonCountId;
  name: { en: string; ja: string };
  /** Moons in the catalogue. Zero when the host has no entry. */
  total: number;
  /** True for every row that shares the highest count, and only when that count is at least one. */
  most: boolean;
}

/** One row per painted planet, solar-system order, counts from `moonCounts()`. */
export function moonCountGrid(): MoonCountRow[] {
  const counts = moonCounts();
  const rows = MOON_COUNT_IDS.map((id) => ({
    id,
    name: { en: BODIES[id].name.en, ja: BODIES[id].name.ja },
    total: counts[id as HostId]?.total ?? 0,
    most: false,
  }));
  const max = Math.max(...rows.map((row) => row.total));
  return rows.map((row) => ({ ...row, most: max > 0 && row.total === max }));
}
