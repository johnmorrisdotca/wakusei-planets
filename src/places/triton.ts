// The places on Triton: a single list. See `/places` for the record's shape and the lookups.
import { PLACES_TRITON as DATA } from "../data/places-triton.ts";
import type { Place } from "../places.ts";

/**
 * Every place on Triton the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is
 * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.
 *
 * @example
 * ```ts
 * import { PLACES_TRITON } from "@johnmorrisdotca/wakusei-planets/places/triton";
 *
 * console.log(PLACES_TRITON.length, "places;", PLACES_TRITON.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(", "));
 * ```
 */
export const PLACES_TRITON: readonly Place[] = DATA as unknown as readonly Place[];
