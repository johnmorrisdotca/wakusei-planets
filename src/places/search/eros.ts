// The search list of Eros: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_EROS as DATA } from "../../data/places-search-eros.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Eros: 42 rows (41 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_EROS } from "@johnmorrisdotca/wakusei-planets/places/search/eros";
 *
 * console.log(PLACE_HITS_EROS.length, "rows;", PLACE_HITS_EROS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_EROS: readonly PlaceHit[] = readPlaceHits("eros", DATA);
