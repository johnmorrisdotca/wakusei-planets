// The places on Saturn: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_SATURN as DATA } from "../data/places-saturn.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Saturn the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_SATURN } from "@johnmorrisdotca/wakusei-planets/places/saturn";
 *
 * console.log(PLACES_SATURN.length, "places;", PLACES_SATURN.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_SATURN: readonly Place[] = DATA as unknown as readonly Place[];
