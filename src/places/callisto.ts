// The places on Callisto: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_CALLISTO as DATA } from "../data/places-callisto.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Callisto the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_CALLISTO } from "@johnmorrisdotca/wakusei-planets/places/callisto";
 *
 * console.log(PLACES_CALLISTO.length, "places;", PLACES_CALLISTO.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_CALLISTO: readonly Place[] = DATA as unknown as readonly Place[];
