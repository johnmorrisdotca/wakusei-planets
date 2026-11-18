// The search list of Venus: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_VENUS as DATA } from "../../data/places-search-venus.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Venus: 2003 rows (1985 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_VENUS } from "@johnmorrisdotca/wakusei-planets/places/search/venus";
 *
 * console.log(PLACE_HITS_VENUS.length, "rows;", PLACE_HITS_VENUS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_VENUS: readonly PlaceHit[] = readPlaceHits("venus", DATA);
