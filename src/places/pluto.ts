// The places on Pluto: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_PLUTO as DATA } from "../data/places-pluto.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Pluto the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_PLUTO } from "@johnmorrisdotca/wakusei-planets/places/pluto";
 *
 * console.log(PLACES_PLUTO.length, "places;", PLACES_PLUTO.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_PLUTO: readonly Place[] = DATA as unknown as readonly Place[];
