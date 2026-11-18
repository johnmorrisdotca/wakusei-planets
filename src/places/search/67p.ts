// The search list of comet 67P: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_67P as DATA } from "../../data/places-search-67p.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of comet 67P: 1 rows (0 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_67P } from "@johnmorrisdotca/wakusei-planets/places/search/67p";
 *
 * console.log(PLACE_HITS_67P.length, "rows;", PLACE_HITS_67P[0]?.name.en);
 * ```
 */
export const PLACE_HITS_67P: readonly PlaceHit[] = readPlaceHits("67p", DATA);
