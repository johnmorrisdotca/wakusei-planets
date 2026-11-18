// The search list of Umbriel: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_UMBRIEL as DATA } from "../../data/places-search-umbriel.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Umbriel: 13 rows (13 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_UMBRIEL } from "@johnmorrisdotca/wakusei-planets/places/search/umbriel";
 *
 * console.log(PLACE_HITS_UMBRIEL.length, "rows;", PLACE_HITS_UMBRIEL[0]?.name.en);
 * ```
 */
export const PLACE_HITS_UMBRIEL: readonly PlaceHit[] = readPlaceHits("umbriel", DATA);
