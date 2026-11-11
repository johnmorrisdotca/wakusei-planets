// The places on the Moon: landing, rover, crash and impact sites, and the named features, as one list. See `/places` for the record's shape and the lookups.
import { PLACES_MOON as DATA } from "../data/places-moon.ts";
import type { Place } from "../places.ts";

/**
 * Every place on the Moon the package knows: the sites first, by date, then the named features by size. A place's `kind` says what it is (`placesOfKind` from `/places` picks by it).
 *
 * @example
 * ```ts
 * import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
 *
 * console.log(PLACES_MOON.length, "places;", PLACES_MOON.filter((place) => place.kind === "landing").length, "landings");
 * ```
 */
export const PLACES_MOON: readonly Place[] = DATA as unknown as readonly Place[];
