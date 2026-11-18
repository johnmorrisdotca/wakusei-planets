// The search list of Steins: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_STEINS as DATA } from "../../data/places-search-steins.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Steins: 24 rows (24 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_STEINS } from "@johnmorrisdotca/wakusei-planets/places/search/steins";
 *
 * console.log(PLACE_HITS_STEINS.length, "rows;", PLACE_HITS_STEINS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_STEINS: readonly PlaceHit[] = readPlaceHits("steins", DATA);
