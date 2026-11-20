// Mercury through Pluto, each with the catalogue's moon count and a few moons the package can draw. The rest of a world's moons are a count, not a made-up picture. No DOM.
import { BODIES } from "./facts.ts";
import { MOON_CATALOGUE_FETCHED, catalogueMoonsOf, moonCounts, type HostId } from "./moon-catalogue.ts";
import { estimatedRock } from "./scene/estimated-rock.ts";

export const ALL_MOON_HOSTS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
export type AllMoonHost = (typeof ALL_MOON_HOSTS)[number];

/** The moons the poster draws, in the order a reader meets them. Each one is in the catalogue. */
export const ALL_MOON_SHOW: Record<AllMoonHost, readonly string[]> = {
  mercury: [],
  venus: [],
  earth: ["moon"],
  mars: ["phobos", "deimos"],
  jupiter: ["io", "europa", "ganymede", "callisto"],
  saturn: ["titan", "enceladus", "rhea", "iapetus"],
  uranus: ["titania", "oberon", "umbriel", "ariel"],
  neptune: ["triton", "nereid", "proteus", "larissa"],
  pluto: ["charon", "nix", "hydra", "kerberos", "styx"],
};

export interface AllMoonShown {
  id: string;
  line: { en: string; ja: string };
  estimated: boolean;
}

export interface AllMoonRow {
  id: AllMoonHost;
  name: { en: string; ja: string };
  total: number;
  most: boolean;
  shown: AllMoonShown[];
  /** Catalogue moons of this world that the row does not draw. */
  more: number;
}

export const ALL_MOON_READ = MOON_CATALOGUE_FETCHED;

/** One row per world, Mercury through Pluto. A moon the package does not draw is left out of `shown`. */
export function allMoonPoster(): AllMoonRow[] {
  const counts = moonCounts();
  const rows = ALL_MOON_HOSTS.map((id) => {
    const own = catalogueMoonsOf(id as HostId);
    const byId = new Map(own.map((moon) => [moon.id, moon]));
    const shown = ALL_MOON_SHOW[id].flatMap((moonId) => {
      const moon = byId.get(moonId);
      if (moon === undefined) return [];
      const rock = estimatedRock(moon.id);
      const line = rock === null ? { en: moon.label, ja: moon.ja ?? moon.label } : { en: rock.line.en, ja: rock.line.ja };
      return [{ id: moon.id, line, estimated: rock !== null }];
    });
    const total = counts[id as HostId]?.total ?? 0;
    return { id, name: { en: BODIES[id].name.en, ja: BODIES[id].name.ja }, total, most: false, shown, more: Math.max(0, total - shown.length) };
  });
  const max = Math.max(...rows.map((row) => row.total));
  return rows.map((row) => ({ ...row, most: max > 0 && row.total === max }));
}
