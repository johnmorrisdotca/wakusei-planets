// The search list of Jupiter: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_JUPITER as DATA } from "../../data/places-search-jupiter.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Jupiter: 2 rows (0 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_JUPITER } from "@johnmorrisdotca/wakusei-planets/places/search/jupiter";
 *
 * console.log(PLACE_HITS_JUPITER.length, "rows;", PLACE_HITS_JUPITER[0]?.name.en);
 * ```
 */
export const PLACE_HITS_JUPITER: readonly PlaceHit[] = readPlaceHits("jupiter", DATA);
