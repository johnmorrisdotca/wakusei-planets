// The places on Jupiter: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_JUPITER as DATA } from "../data/places-jupiter.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Jupiter the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_JUPITER } from "@johnmorrisdotca/wakusei-planets/places/jupiter";
 *
 * console.log(PLACES_JUPITER.length, "places;", PLACES_JUPITER.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_JUPITER: readonly Place[] = DATA as unknown as readonly Place[];
