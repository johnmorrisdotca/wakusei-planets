// The places on Eros: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_EROS as DATA } from "../data/places-eros.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Eros the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_EROS } from "@johnmorrisdotca/wakusei-planets/places/eros";
 *
 * console.log(PLACES_EROS.length, "places;", PLACES_EROS.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_EROS: readonly Place[] = DATA as unknown as readonly Place[];
