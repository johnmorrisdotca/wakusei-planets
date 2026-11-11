// The places on Venus: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_VENUS as DATA } from "../data/places-venus.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Venus the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_VENUS } from "@johnmorrisdotca/wakusei-planets/places/venus";
 *
 * console.log(PLACES_VENUS.length, "places;", PLACES_VENUS.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_VENUS: readonly Place[] = DATA as unknown as readonly Place[];
