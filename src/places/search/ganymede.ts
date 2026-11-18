// The search list of Ganymede: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_GANYMEDE as DATA } from "../../data/places-search-ganymede.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Ganymede: 196 rows (196 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_GANYMEDE } from "@johnmorrisdotca/wakusei-planets/places/search/ganymede";
 *
 * console.log(PLACE_HITS_GANYMEDE.length, "rows;", PLACE_HITS_GANYMEDE[0]?.name.en);
 * ```
 */
export const PLACE_HITS_GANYMEDE: readonly PlaceHit[] = readPlaceHits("ganymede", DATA);
