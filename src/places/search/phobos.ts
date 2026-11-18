// The search list of Phobos: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_PHOBOS as DATA } from "../../data/places-search-phobos.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Phobos: 20 rows (20 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_PHOBOS } from "@johnmorrisdotca/wakusei-planets/places/search/phobos";
 *
 * console.log(PLACE_HITS_PHOBOS.length, "rows;", PLACE_HITS_PHOBOS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_PHOBOS: readonly PlaceHit[] = readPlaceHits("phobos", DATA);
