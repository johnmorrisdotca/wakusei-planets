// Loads a planet's moon theory when a picture asks for its moons, so a page that shows one planet does not carry Jupiter's and Saturn's theories. A bundler with code splitting makes each a chunk of its own.
import { moonTheoryOf } from "../data/theories.ts";
import { tableOf } from "../data/tables.ts";

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

let askedMinor = false;

/**
 * Fetch the fitted tables of the minor bodies (Vesta, Pallas, Chiron, Pholus, Halley: about 48 kB gzipped) when a picture of one of them is dated: resolves true for the one call that fetched them, false when they were already asked for
 * or loaded, or could not be fetched. Until they arrive a minor body is placed from its osculating elements.
 */
export function loadMinorTables(): Promise<boolean> {
  if (askedMinor || tableOf("vesta") !== undefined) return Promise.resolve(false);
  askedMinor = true;
  return import("./minor.ts").then(() => true, () => false);
}
