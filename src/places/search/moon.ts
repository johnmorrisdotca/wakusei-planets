// The search list of Moon: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_MOON as DATA } from "../../data/places-search-moon.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Moon: 2133 rows (2023 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_MOON } from "@johnmorrisdotca/wakusei-planets/places/search/moon";
 *
 * console.log(PLACE_HITS_MOON.length, "rows;", PLACE_HITS_MOON[0]?.name.en);
 * ```
 */
export const PLACE_HITS_MOON: readonly PlaceHit[] = readPlaceHits("moon", DATA);
