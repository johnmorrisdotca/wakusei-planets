// The search list of Rhea: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_RHEA as DATA } from "../../data/places-search-rhea.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Rhea: 144 rows (144 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_RHEA } from "@johnmorrisdotca/wakusei-planets/places/search/rhea";
 *
 * console.log(PLACE_HITS_RHEA.length, "rows;", PLACE_HITS_RHEA[0]?.name.en);
 * ```
 */
export const PLACE_HITS_RHEA: readonly PlaceHit[] = readPlaceHits("rhea", DATA);
