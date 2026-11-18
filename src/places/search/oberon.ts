// The search list of Oberon: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import { SEARCH_OBERON as DATA } from "../../data/places-search-oberon.ts";
import { readPlaceHits, type PlaceHit } from "../../place-search.ts";

/**
 * The search list of Oberon: 10 rows (10 named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import { PLACE_HITS_OBERON } from "@johnmorrisdotca/wakusei-planets/places/search/oberon";
 *
 * console.log(PLACE_HITS_OBERON.length, "rows;", PLACE_HITS_OBERON[0]?.name.en);
 * ```
 */
export const PLACE_HITS_OBERON: readonly PlaceHit[] = readPlaceHits("oberon", DATA);
