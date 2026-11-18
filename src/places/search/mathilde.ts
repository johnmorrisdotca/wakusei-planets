// The search list of Mathilde: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_MATHILDE as DATA } from "../../data/places-search-mathilde.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Mathilde: 23 rows (23 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_MATHILDE } from "@johnmorrisdotca/wakusei-planets/places/search/mathilde";
 *
 * console.log(PLACE_HITS_MATHILDE.length, "rows;", PLACE_HITS_MATHILDE[0]?.name.en);
 * ```
 */
export const PLACE_HITS_MATHILDE: readonly PlaceHit[] = readPlaceHits("mathilde", DATA);
