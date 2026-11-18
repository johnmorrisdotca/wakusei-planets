// The search list of Dione: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_DIONE as DATA } from "../../data/places-search-dione.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Dione: 95 rows (95 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_DIONE } from "@johnmorrisdotca/wakusei-planets/places/search/dione";
 *
 * console.log(PLACE_HITS_DIONE.length, "rows;", PLACE_HITS_DIONE[0]?.name.en);
 * ```
 */
export const PLACE_HITS_DIONE: readonly PlaceHit[] = readPlaceHits("dione", DATA);
