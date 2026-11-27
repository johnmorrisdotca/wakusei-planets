// Which planets of the space view show every moon of the catalogue (`moons`, `moons-of`), and how a moon of the catalogue is keyed among the view's own names. Pure; the catalogue itself is imported by the element only when
// a planet is first set to `all`.
import { SPACE_DWARFS, SPACE_PLANETS, type SpaceDwarf, type SpacePlanet } from "./frame.ts";
import type { MoonColorChoice, MoonSource } from "./all-moons.ts";
import type { CatalogueMoon } from "../moon-catalogue.ts";

/** What a planet shows: its `major` moons (the ones the view draws in full: today's default) or `all` of them (every moon of the catalogue as a pressable dot with its orbit). */
export type MoonsChoice = "major" | "all";

/** The planets and dwarf planets that can show every moon: those the view places. */
export const MOON_HOSTS: readonly (SpacePlanet | SpaceDwarf)[] = [...SPACE_PLANETS, ...SPACE_DWARFS];

/** `moons="all"` is all; anything else is the major moons. */
export const readMoonsChoice = (value: string | null | undefined): MoonsChoice => (value?.trim().toLowerCase() === "all" ? "all" : "major");

/** What `moon-colors` says: `direction`, else `group`. */
export const readMoonColors = (value: string | null | undefined): MoonColorChoice => (value?.trim().toLowerCase() === "direction" ? "direction" : "group");

/** The per-planet choices of `moons-of` (`"jupiter=all saturn=major"`, spaces or commas between): a planet the view does not place, or a choice that is neither word, is left out. */
export function readMoonsOf(text: string | null | undefined): Partial<Record<string, MoonsChoice>> {
  const out: Partial<Record<string, MoonsChoice>> = {};
  for (const part of (text ?? "").split(/[\s,]+/)) {
    const [host, choice] = part.split("=");
    if (host === undefined || choice === undefined) continue;
    const id = host.trim().toLowerCase();
    const word = choice.trim().toLowerCase();
    if ((MOON_HOSTS as readonly string[]).includes(id) && (word === "all" || word === "major")) out[id] = word;
  }
  return out;
}

/** The planets showing every moon: each one's own choice, else the global one. */
export function hostsShowingAll(global: MoonsChoice, own: Readonly<Partial<Record<string, MoonsChoice>>>): ReadonlySet<string> {
  return new Set(MOON_HOSTS.filter((host) => (own[host] ?? global) === "all"));
}

/** The prefix of a moon of the catalogue's key in the view: the catalogue's `io` or `dia` would meet a body's id, so the view keeps its own names for them apart by it. A page never sees it: events say the plain id. */
export const CATALOGUE_MOON_PREFIX = "moon:";

/** The view's key of a moon of the catalogue. */
export const catalogueMoonKey = (id: string): string => CATALOGUE_MOON_PREFIX + id;

/** The catalogue's id from the view's key, or `undefined` for a key that is not a moon of the catalogue's. */
export const catalogueMoonIdOf = (key: string): string | undefined => (key.startsWith(CATALOGUE_MOON_PREFIX) ? key.slice(CATALOGUE_MOON_PREFIX.length) : undefined);

/** The catalogue module's parts the source is made from. */
type CatalogueModule = Pick<typeof import("../moon-catalogue.ts"), "MOON_CATALOGUE" | "catalogueMoonPosition" | "catalogueMoonOrbit" | "moonOrbitColor">;

/** The catalogue as the layer's source: the moons with an orbit that go round a planet the view places. */
export function moonSourceOf(catalogue: CatalogueModule, selected: readonly CatalogueMoon[] = catalogue.MOON_CATALOGUE, highlight = false): MoonSource {
  const moons = selected.filter((m) => m.orbit !== null && (MOON_HOSTS as readonly string[]).includes(m.host));
  const byId = new Map(moons.map((m) => [m.id, m]));
  const newest = highlight && Math.max(...moons.map((moon) => moon.discovery.year ?? -Infinity));
  return {
    moons: moons.map((m) => ({ id: m.id, label: m.label, ja: m.ja, host: m.host as SpacePlanet | SpaceDwarf, full: m.full, newest: m.discovery.year === newest, colors: { group: catalogue.moonOrbitColor(m, "group"), direction: catalogue.moonOrbitColor(m, "direction") } })),
    position: (moon, ms) => catalogue.catalogueMoonPosition(byId.get(moon.id)!, ms)!,
    orbit: (moon, ms, points) => catalogue.catalogueMoonOrbit(byId.get(moon.id)!, ms, points)!,
  };
}
