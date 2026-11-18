// The search list of Iapetus: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_IAPETUS as DATA } from "../../data/places-search-iapetus.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Iapetus: 70 rows (70 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_IAPETUS } from "@johnmorrisdotca/wakusei-planets/places/search/iapetus";
 *
 * console.log(PLACE_HITS_IAPETUS.length, "rows;", PLACE_HITS_IAPETUS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_IAPETUS: readonly PlaceHit[] = readPlaceHits("iapetus", DATA);
