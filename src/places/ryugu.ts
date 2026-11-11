// The places on Ryugu: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_RYUGU as DATA } from "../data/places-ryugu.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Ryugu the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_RYUGU } from "@johnmorrisdotca/wakusei-planets/places/ryugu";
 *
 * console.log(PLACES_RYUGU.length, "places;", PLACES_RYUGU.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_RYUGU: readonly Place[] = DATA as unknown as readonly Place[];
