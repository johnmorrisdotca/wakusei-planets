// The places on 67P/Churyumov-Gerasimenko: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_67P as DATA } from "../data/places-67p.ts";
import type { Place } from "../places.ts";

/**
 * Every place on 67P/Churyumov-Gerasimenko the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_67P } from "@johnmorrisdotca/wakusei-planets/places/67p";
 *
 * console.log(PLACES_67P.length, "places;", PLACES_67P.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_67P: readonly Place[] = DATA as unknown as readonly Place[];
