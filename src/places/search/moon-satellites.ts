// The search list of the Moon's lettered satellite craters: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_MOON_SATELLITES as DATA } from "../../data/places-search-moon-satellites.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of the Moon's lettered satellite craters: 7064 rows (7064 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_MOON_SATELLITES } from "@johnmorrisdotca/wakusei-planets/places/search/moon-satellites";
 *
 * console.log(PLACE_HITS_MOON_SATELLITES.length, "rows;", PLACE_HITS_MOON_SATELLITES[0]?.name.en);
 * ```
 */
export const PLACE_HITS_MOON_SATELLITES: readonly PlaceHit[] = readPlaceHits("moon", DATA);
