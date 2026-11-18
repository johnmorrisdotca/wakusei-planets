// The search list of Phoebe: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_PHOEBE as DATA } from "../../data/places-search-phoebe.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Phoebe: 25 rows (25 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_PHOEBE } from "@johnmorrisdotca/wakusei-planets/places/search/phoebe";
 *
 * console.log(PLACE_HITS_PHOEBE.length, "rows;", PLACE_HITS_PHOEBE[0]?.name.en);
 * ```
 */
export const PLACE_HITS_PHOEBE: readonly PlaceHit[] = readPlaceHits("phoebe", DATA);
