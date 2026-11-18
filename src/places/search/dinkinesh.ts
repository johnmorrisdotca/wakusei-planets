// The search list of Dinkinesh: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_DINKINESH as DATA } from "../../data/places-search-dinkinesh.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Dinkinesh: 4 rows (4 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_DINKINESH } from "@johnmorrisdotca/wakusei-planets/places/search/dinkinesh";
 *
 * console.log(PLACE_HITS_DINKINESH.length, "rows;", PLACE_HITS_DINKINESH[0]?.name.en);
 * ```
 */
export const PLACE_HITS_DINKINESH: readonly PlaceHit[] = readPlaceHits("dinkinesh", DATA);
