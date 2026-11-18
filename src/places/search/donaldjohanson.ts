// The search list of Donaldjohanson: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_DONALDJOHANSON as DATA } from "../../data/places-search-donaldjohanson.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Donaldjohanson: 10 rows (10 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_DONALDJOHANSON } from "@johnmorrisdotca/wakusei-planets/places/search/donaldjohanson";
 *
 * console.log(PLACE_HITS_DONALDJOHANSON.length, "rows;", PLACE_HITS_DONALDJOHANSON[0]?.name.en);
 * ```
 */
export const PLACE_HITS_DONALDJOHANSON: readonly PlaceHit[] = readPlaceHits("donaldjohanson", DATA);
