// The search list of Mimas: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_MIMAS as DATA } from "../../data/places-search-mimas.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Mimas: 42 rows (42 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_MIMAS } from "@johnmorrisdotca/wakusei-planets/places/search/mimas";
 *
 * console.log(PLACE_HITS_MIMAS.length, "rows;", PLACE_HITS_MIMAS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_MIMAS: readonly PlaceHit[] = readPlaceHits("mimas", DATA);
