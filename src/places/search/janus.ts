// The search list of Janus: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_JANUS as DATA } from "../../data/places-search-janus.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Janus: 4 rows (4 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_JANUS } from "@johnmorrisdotca/wakusei-planets/places/search/janus";
 *
 * console.log(PLACE_HITS_JANUS.length, "rows;", PLACE_HITS_JANUS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_JANUS: readonly PlaceHit[] = readPlaceHits("janus", DATA);
