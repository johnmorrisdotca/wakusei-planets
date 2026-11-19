// When, where, how and by whom each planet, dwarf planet and fully drawn moon was found, how it was first designated and numbered, and where its name comes from, as plain data: every fact says which source it was read from.
// The records are in `data/discovery.ts`, made by `scripts/make-discovery-data.py` from the Gazetteer of Planetary Nomenclature (IAU, hosted by the USGS), the JPL Small-Body Database, JPL's moon discovery page and Wikidata.
// Pure: no DOM, no clock reads, no three.js.
import { RECORDS, SOURCES } from "./data/discovery.ts";

/**
 * How a body was found, as the instrument of its day: `ancient` (seen by eye since before recorded history), `visual` (a telescope and an eye), `calculation` (worked out from its pull on another planet, then looked for),
 * `photographic` (plates), `electronic` (a digital camera on a telescope), `adaptive-optics` (a ground telescope that corrects the air), `space-telescope` or `spacecraft`. This field is worked out here from the place and
 * the date of each record (its source says `derived`), not read from a published list.
 *
 * @example
 * ```ts
 * import { DISCOVERY_METHODS } from "@johnmorrisdotca/wakusei-planets/discovery";
 *
 * console.log(DISCOVERY_METHODS.join(", "));
 * ```
 */
export const DISCOVERY_METHODS = ["ancient", "visual", "calculation", "photographic", "electronic", "adaptive-optics", "space-telescope", "spacecraft"] as const;

/**
 * One way a body was found.
 *
 * @example
 * ```ts
 * import { DISCOVERY_METHODS, type DiscoveryMethod } from "@johnmorrisdotca/wakusei-planets/discovery";
 *
 * const how: DiscoveryMethod = DISCOVERY_METHODS[1];
 * console.log(how);
 * ```
 */
export type DiscoveryMethod = (typeof DISCOVERY_METHODS)[number];

/**
 * A fact and where it was read: the key of its source in `DISCOVERY_SOURCES` (`usgs`, `jpl-sbdb`, `jpl-ssd-moons`, `wikidata`, or `derived` for what is worked out here).
 *
 * @example
 * ```ts
 * import { discoveryOf, DISCOVERY_SOURCES, type DiscoveryFact } from "@johnmorrisdotca/wakusei-planets/discovery";
 *
 * const place: DiscoveryFact<string> | null = discoveryOf("neptune")!.place;
 * if (place !== null) console.log(place.value, "from", DISCOVERY_SOURCES[place.source]![0]);
 * ```
 */
export interface DiscoveryFact<T> {
  value: T;
  source: string;
}

/**
 * What the sources say of one body's discovery. A field is `null` where the sources read give nothing (a body known since before recorded history has no date, place or discoverer; the one who found Haumea is not named
 * by the Gazetteer or JPL). `date` is an ISO day, or a month where the source gives only that (`1989-06`), or a year (`1990`); `place` and `by` are as the source writes them; `designation` is the first provisional designation (`1930 BM`,
 * `S/1978 P 1`); `number` is the minor planet number (`(134340)`) or the moon's number round its planet (`Saturn VI`); `announced` is the circular that announced a moon; `nameOrigin` is where the name comes from, told in our
 * own words. `notes` lists where another source gives a different day or credit, and what a field leaves out.
 *
 * @example
 * ```ts
 * import { discoveryOf, type Discovery } from "@johnmorrisdotca/wakusei-planets/discovery";
 *
 * const triton: Discovery = discoveryOf("triton")!;
 * console.log(triton.date?.value, triton.place?.value, triton.by?.value.join(", "), triton.nameOrigin?.value);
 * ```
 */
export interface Discovery {
  id: string;
  kind: "planet" | "dwarf-planet" | "moon";
  /** True for what has been known since before recorded history: Mercury to Saturn, the Earth and the Moon. */
  ancient: boolean;
  date: DiscoveryFact<string> | null;
  place: DiscoveryFact<string> | null;
  by: DiscoveryFact<readonly string[]> | null;
  method: DiscoveryFact<DiscoveryMethod> | null;
  designation: DiscoveryFact<string> | null;
  number: DiscoveryFact<string> | null;
  announced: DiscoveryFact<string> | null;
  namedBy: DiscoveryFact<string> | null;
  nameOrigin: DiscoveryFact<string> | null;
  notes: readonly string[];
}

/**
 * The bodies that have a discovery record: the eight planets, nine dwarf planets and the Moon and 28 other moons the package draws in full, in the order of the Sun outward.
 *
 * @example
 * ```ts
 * import { DISCOVERY_IDS } from "@johnmorrisdotca/wakusei-planets/discovery";
 *
 * console.log(DISCOVERY_IDS.length, DISCOVERY_IDS[0]);
 * ```
 */
export const DISCOVERY_IDS: readonly string[] = RECORDS.map((r) => r.id);

/**
 * Every source the records are read from: its key, then its name, its address and the day it was read. The key `derived` is what is worked out here and has no address.
 *
 * @example
 * ```ts
 * import { DISCOVERY_SOURCES } from "@johnmorrisdotca/wakusei-planets/discovery";
 *
 * for (const [key, [name, address, read]] of Object.entries(DISCOVERY_SOURCES)) console.log(key, name, address, read);
 * ```
 */
export const DISCOVERY_SOURCES: Readonly<Record<string, readonly [name: string, address: string, read: string]>> = SOURCES;

/**
 * The discovery record of a body, or `undefined` for a body that has none.
 *
 * @param id - The body's id, as `BODY_IDS` has it (`neptune`, `charon`).
 * @returns The record, or `undefined` when the body has none.
 *
 * @example
 * ```ts
 * import { discoveryOf } from "@johnmorrisdotca/wakusei-planets/discovery";
 *
 * const eris = discoveryOf("eris")!;
 * console.log(eris.designation?.value, eris.date?.value, eris.place?.value);
 * ```
 */
export function discoveryOf(id: string): Discovery | undefined {
  return RECORDS.find((r) => r.id === id);
}

/**
 * Every discovery record, in the order of `DISCOVERY_IDS`.
 *
 * @example
 * ```ts
 * import { DISCOVERIES } from "@johnmorrisdotca/wakusei-planets/discovery";
 *
 * console.log(DISCOVERIES.filter((d) => d.kind === "moon").length, "moons");
 * ```
 */
export const DISCOVERIES: readonly Discovery[] = RECORDS;
