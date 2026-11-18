// The search list of Tethys: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_TETHYS as DATA } from "../../data/places-search-tethys.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Tethys: 53 rows (53 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_TETHYS } from "@johnmorrisdotca/wakusei-planets/places/search/tethys";
 *
 * console.log(PLACE_HITS_TETHYS.length, "rows;", PLACE_HITS_TETHYS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_TETHYS: readonly PlaceHit[] = readPlaceHits("tethys", DATA);
