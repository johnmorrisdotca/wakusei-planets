// The search list of comet Tempel 1: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_TEMPEL_1 as DATA } from "../../data/places-search-tempel-1.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of comet Tempel 1: 1 rows (0 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_TEMPEL_1 } from "@johnmorrisdotca/wakusei-planets/places/search/tempel-1";
 *
 * console.log(PLACE_HITS_TEMPEL_1.length, "rows;", PLACE_HITS_TEMPEL_1[0]?.name.en);
 * ```
 */
export const PLACE_HITS_TEMPEL_1: readonly PlaceHit[] = readPlaceHits("tempel-1", DATA);
