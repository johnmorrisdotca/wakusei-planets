// The search list of Gaspra: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_GASPRA as DATA } from "../../data/places-search-gaspra.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Gaspra: 34 rows (34 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_GASPRA } from "@johnmorrisdotca/wakusei-planets/places/search/gaspra";
 *
 * console.log(PLACE_HITS_GASPRA.length, "rows;", PLACE_HITS_GASPRA[0]?.name.en);
 * ```
 */
export const PLACE_HITS_GASPRA: readonly PlaceHit[] = readPlaceHits("gaspra", DATA);
