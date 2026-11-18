// The search list of Dimorphos: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_DIMORPHOS as DATA } from "../../data/places-search-dimorphos.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Dimorphos: 12 rows (11 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_DIMORPHOS } from "@johnmorrisdotca/wakusei-planets/places/search/dimorphos";
 *
 * console.log(PLACE_HITS_DIMORPHOS.length, "rows;", PLACE_HITS_DIMORPHOS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_DIMORPHOS: readonly PlaceHit[] = readPlaceHits("dimorphos", DATA);
