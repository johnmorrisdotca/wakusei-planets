// The search list of Pluto: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_PLUTO as DATA } from "../../data/places-search-pluto.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Pluto: 73 rows (73 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_PLUTO } from "@johnmorrisdotca/wakusei-planets/places/search/pluto";
 *
 * console.log(PLACE_HITS_PLUTO.length, "rows;", PLACE_HITS_PLUTO[0]?.name.en);
 * ```
 */
export const PLACE_HITS_PLUTO: readonly PlaceHit[] = readPlaceHits("pluto", DATA);
