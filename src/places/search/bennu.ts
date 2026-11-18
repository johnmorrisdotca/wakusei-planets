// The search list of Bennu: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_BENNU as DATA } from "../../data/places-search-bennu.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Bennu: 37 rows (36 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_BENNU } from "@johnmorrisdotca/wakusei-planets/places/search/bennu";
 *
 * console.log(PLACE_HITS_BENNU.length, "rows;", PLACE_HITS_BENNU[0]?.name.en);
 * ```
 */
export const PLACE_HITS_BENNU: readonly PlaceHit[] = readPlaceHits("bennu", DATA);
