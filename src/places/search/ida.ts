// The search list of Ida: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_IDA as DATA } from "../../data/places-search-ida.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Ida: 25 rows (25 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_IDA } from "@johnmorrisdotca/wakusei-planets/places/search/ida";
 *
 * console.log(PLACE_HITS_IDA.length, "rows;", PLACE_HITS_IDA[0]?.name.en);
 * ```
 */
export const PLACE_HITS_IDA: readonly PlaceHit[] = readPlaceHits("ida", DATA);
