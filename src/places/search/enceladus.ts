// The search list of Enceladus: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_ENCELADUS as DATA } from "../../data/places-search-enceladus.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Enceladus: 87 rows (87 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_ENCELADUS } from "@johnmorrisdotca/wakusei-planets/places/search/enceladus";
 *
 * console.log(PLACE_HITS_ENCELADUS.length, "rows;", PLACE_HITS_ENCELADUS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_ENCELADUS: readonly PlaceHit[] = readPlaceHits("enceladus", DATA);
