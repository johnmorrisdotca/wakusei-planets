// The places on Ceres: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_CERES as DATA } from "../data/places-ceres.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Ceres the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_CERES } from "@johnmorrisdotca/wakusei-planets/places/ceres";
 *
 * console.log(PLACES_CERES.length, "places;", PLACES_CERES.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_CERES: readonly Place[] = DATA as unknown as readonly Place[];
