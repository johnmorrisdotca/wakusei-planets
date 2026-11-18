// The search list of Deimos: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_DEIMOS as DATA } from "../../data/places-search-deimos.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Deimos: 2 rows (2 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_DEIMOS } from "@johnmorrisdotca/wakusei-planets/places/search/deimos";
 *
 * console.log(PLACE_HITS_DEIMOS.length, "rows;", PLACE_HITS_DEIMOS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_DEIMOS: readonly PlaceHit[] = readPlaceHits("deimos", DATA);
