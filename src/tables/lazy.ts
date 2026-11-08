// Loads a planet's moon theory when a picture asks for its moons, so a page that shows one planet does not carry Jupiter's and Saturn's theories. A bundler with code splitting makes each a chunk of its own.
import { moonTheoryOf } from "../data/theories.ts";

const LOADERS: Record<string, { moon: string; load: () => Promise<unknown> }> = {
  jupiter: { moon: "io", load: () => import("./galilean.ts") },
  saturn: { moon: "mimas", load: () => import("./saturn-moons.ts") },
};

const asked = new Set<string>();

/** Fetch the theory for a planet's moons: resolves true for the one call that fetched it, false when it was already asked for or loaded, there is none for that planet, or it could not be fetched. */
export function loadMoonTheory(planet: string): Promise<boolean> {
  const loader = LOADERS[planet];
  if (loader === undefined || asked.has(planet) || moonTheoryOf(loader.moon) !== undefined) return Promise.resolve(false);
  asked.add(planet);
  return loader.load().then(() => true, () => false);
}
