// The search list of Callisto: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_CALLISTO as DATA } from "../../data/places-search-callisto.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Callisto: 154 rows (154 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_CALLISTO } from "@johnmorrisdotca/wakusei-planets/places/search/callisto";
 *
 * console.log(PLACE_HITS_CALLISTO.length, "rows;", PLACE_HITS_CALLISTO[0]?.name.en);
 * ```
 */
export const PLACE_HITS_CALLISTO: readonly PlaceHit[] = readPlaceHits("callisto", DATA);
