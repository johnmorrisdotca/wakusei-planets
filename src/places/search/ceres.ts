// The search list of Ceres: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_CERES as DATA } from "../../data/places-search-ceres.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Ceres: 149 rows (149 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_CERES } from "@johnmorrisdotca/wakusei-planets/places/search/ceres";
 *
 * console.log(PLACE_HITS_CERES.length, "rows;", PLACE_HITS_CERES[0]?.name.en);
 * ```
 */
export const PLACE_HITS_CERES: readonly PlaceHit[] = readPlaceHits("ceres", DATA);
