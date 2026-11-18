// The search list of Mars: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_MARS as DATA } from "../../data/places-search-mars.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Mars: 2146 rows (2054 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_MARS } from "@johnmorrisdotca/wakusei-planets/places/search/mars";
 *
 * console.log(PLACE_HITS_MARS.length, "rows;", PLACE_HITS_MARS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_MARS: readonly PlaceHit[] = readPlaceHits("mars", DATA);
