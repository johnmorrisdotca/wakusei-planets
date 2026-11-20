// A planet, then every one of its moons in the catalogue's families. A moon the package draws in full keeps its own picture. The rest are the estimated rocks. No DOM.
import { moonFamilies } from "./moon-catalogue.ts";
import { MOON_PAGE_HOSTS, type MoonPageHost } from "./moon-pages/data.ts";
import { estimatedRock } from "./scene/estimated-rock.ts";

export { MOON_PAGE_HOSTS };

export interface GroupMoon {
  id: string;
  /** Where it sits in the list, from 1, in family order. */
  number: number;
  /** The name to print. An estimated rock already carries the star. */
  line: { en: string; ja: string };
  estimated: boolean;
}

export interface MoonGroup {
  id: string;
  name: { en: string; ja: string };
  count: number;
  moons: GroupMoon[];
}

/** The families of one giant planet, in list order, every catalogue moon once. Numbers run through that order. */
export function moonGroupPoster(host: MoonPageHost): MoonGroup[] {
  let number = 0;
  return moonFamilies(host).map((family) => ({
    id: family.id,
    name: { en: family.names.en, ja: family.names.ja },
    count: family.count,
    moons: family.moons.map((moon) => {
      number += 1;
      const rock = estimatedRock(moon.id);
      const line = rock === null ? { en: moon.label, ja: moon.ja ?? moon.label } : { en: rock.line.en, ja: rock.line.ja };
      return { id: moon.id, number, line, estimated: rock !== null };
    }),
  }));
}
