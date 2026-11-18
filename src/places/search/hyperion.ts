// The search list of Hyperion: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_HYPERION as DATA } from "../../data/places-search-hyperion.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Hyperion: 5 rows (5 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_HYPERION } from "@johnmorrisdotca/wakusei-planets/places/search/hyperion";
 *
 * console.log(PLACE_HITS_HYPERION.length, "rows;", PLACE_HITS_HYPERION[0]?.name.en);
 * ```
 */
export const PLACE_HITS_HYPERION: readonly PlaceHit[] = readPlaceHits("hyperion", DATA);
