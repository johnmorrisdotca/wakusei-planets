// The search list of Europa: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_EUROPA as DATA } from "../../data/places-search-europa.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Europa: 129 rows (129 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_EUROPA } from "@johnmorrisdotca/wakusei-planets/places/search/europa";
 *
 * console.log(PLACE_HITS_EUROPA.length, "rows;", PLACE_HITS_EUROPA[0]?.name.en);
 * ```
 */
export const PLACE_HITS_EUROPA: readonly PlaceHit[] = readPlaceHits("europa", DATA);
