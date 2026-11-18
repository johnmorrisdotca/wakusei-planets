// The search list of Thebe: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_THEBE as DATA } from "../../data/places-search-thebe.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Thebe: 1 rows (1 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_THEBE } from "@johnmorrisdotca/wakusei-planets/places/search/thebe";
 *
 * console.log(PLACE_HITS_THEBE.length, "rows;", PLACE_HITS_THEBE[0]?.name.en);
 * ```
 */
export const PLACE_HITS_THEBE: readonly PlaceHit[] = readPlaceHits("thebe", DATA);
