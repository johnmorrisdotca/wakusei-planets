// The search list of Didymos: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_DIDYMOS as DATA } from "../../data/places-search-didymos.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Didymos: 2 rows (2 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_DIDYMOS } from "@johnmorrisdotca/wakusei-planets/places/search/didymos";
 *
 * console.log(PLACE_HITS_DIDYMOS.length, "rows;", PLACE_HITS_DIDYMOS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_DIDYMOS: readonly PlaceHit[] = readPlaceHits("didymos", DATA);
