// The places on Umbriel: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_UMBRIEL as DATA } from "../data/places-umbriel.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Umbriel the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_UMBRIEL } from "@johnmorrisdotca/wakusei-planets/places/umbriel";
 *
 * console.log(PLACES_UMBRIEL.length, "places;", PLACES_UMBRIEL.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_UMBRIEL: readonly Place[] = DATA as unknown as readonly Place[];
