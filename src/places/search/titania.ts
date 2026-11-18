// The search list of Titania: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_TITANIA as DATA } from "../../data/places-search-titania.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Titania: 18 rows (18 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_TITANIA } from "@johnmorrisdotca/wakusei-planets/places/search/titania";
 *
 * console.log(PLACE_HITS_TITANIA.length, "rows;", PLACE_HITS_TITANIA[0]?.name.en);
 * ```
 */
export const PLACE_HITS_TITANIA: readonly PlaceHit[] = readPlaceHits("titania", DATA);
