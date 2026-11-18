// The search list of Triton: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_TRITON as DATA } from "../../data/places-search-triton.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Triton: 63 rows (63 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_TRITON } from "@johnmorrisdotca/wakusei-planets/places/search/triton";
 *
 * console.log(PLACE_HITS_TRITON.length, "rows;", PLACE_HITS_TRITON[0]?.name.en);
 * ```
 */
export const PLACE_HITS_TRITON: readonly PlaceHit[] = readPlaceHits("triton", DATA);
