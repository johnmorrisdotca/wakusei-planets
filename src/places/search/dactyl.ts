// The search list of Dactyl: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_DACTYL as DATA } from "../../data/places-search-dactyl.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Dactyl: 2 rows (2 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_DACTYL } from "@johnmorrisdotca/wakusei-planets/places/search/dactyl";
 *
 * console.log(PLACE_HITS_DACTYL.length, "rows;", PLACE_HITS_DACTYL[0]?.name.en);
 * ```
 */
export const PLACE_HITS_DACTYL: readonly PlaceHit[] = readPlaceHits("dactyl", DATA);
