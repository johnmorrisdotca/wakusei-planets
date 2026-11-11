// The places on the Mars: landing, rover, crash and impact sites, and the named features, as one list. See `/places` for the record's shape and the lookups.
import { PLACES_MARS as DATA } from "../data/places-mars.ts";
import type { Place } from "../places.ts";

/**
 * Every place on the Mars the package knows: the sites first, by date, then the named features by size. A place's `kind` says what it is (`placesOfKind` from `/places` picks by it).
 *
 * @example
 * ```ts
 * import { PLACES_MARS } from "@johnmorrisdotca/wakusei-planets/places/mars";
 *
 * console.log(PLACES_MARS.length, "places;", PLACES_MARS.filter((place) => place.kind === "landing").length, "landings");
 * ```
 */
export const PLACES_MARS: readonly Place[] = DATA as unknown as readonly Place[];
