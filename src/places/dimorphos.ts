// The places on Dimorphos: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_DIMORPHOS as DATA } from "../data/places-dimorphos.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Dimorphos the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_DIMORPHOS } from "@johnmorrisdotca/wakusei-planets/places/dimorphos";
 *
 * console.log(PLACES_DIMORPHOS.length, "places;", PLACES_DIMORPHOS.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_DIMORPHOS: readonly Place[] = DATA as unknown as readonly Place[];
