// The places on Tempel 1: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_TEMPEL_1 as DATA } from "../data/places-tempel-1.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Tempel 1 the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_TEMPEL_1 } from "@johnmorrisdotca/wakusei-planets/places/tempel-1";
 *
 * console.log(PLACES_TEMPEL_1.length, "places;", PLACES_TEMPEL_1.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_TEMPEL_1: readonly Place[] = DATA as unknown as readonly Place[];
