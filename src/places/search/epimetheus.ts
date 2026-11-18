// The search list of Epimetheus: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_EPIMETHEUS as DATA } from "../../data/places-search-epimetheus.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Epimetheus: 2 rows (2 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_EPIMETHEUS } from "@johnmorrisdotca/wakusei-planets/places/search/epimetheus";
 *
 * console.log(PLACE_HITS_EPIMETHEUS.length, "rows;", PLACE_HITS_EPIMETHEUS[0]?.name.en);
 * ```
 */
export const PLACE_HITS_EPIMETHEUS: readonly PlaceHit[] = readPlaceHits("epimetheus", DATA);
