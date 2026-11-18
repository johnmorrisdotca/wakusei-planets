// The search list of Ryugu: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_RYUGU as DATA } from "../../data/places-search-ryugu.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Ryugu: 19 rows (13 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_RYUGU } from "@johnmorrisdotca/wakusei-planets/places/search/ryugu";
 *
 * console.log(PLACE_HITS_RYUGU.length, "rows;", PLACE_HITS_RYUGU[0]?.name.en);
 * ```
 */
export const PLACE_HITS_RYUGU: readonly PlaceHit[] = readPlaceHits("ryugu", DATA);
