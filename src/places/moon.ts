// The places on the Moon: landing, rover, crash and impact sites, and the named features, as one list. See `/places` for the record's shape and the lookups.
import { PLACES_MOON as DATA } from "../data/places-moon.ts";
import { ADDED_MOON } from "../data/places-added.ts";
import { PLANNED_MOON } from "../data/places-planned.ts";
import type { Place } from "../places.ts";

const ALL = DATA as unknown as readonly Place[];
// The sites by date; the rovers added in 0.67 take their place among them (a stable sort leaves the others as they were)
const SITES = [...ALL.filter((place) => place.kind !== "feature"), ...ADDED_MOON].sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? -1 : (a.date ?? "") > (b.date ?? "") ? 1 : 0));

/**
 * Every place on the Moon the package knows: the sites first, by date, then the planned landings, then the named features by size. A place's `kind` says what it is (`placesOfKind` from `/places` picks by it).
 *
 * @example
 * ```ts
 * import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
 *
 * console.log(PLACES_MOON.length, "places;", PLACES_MOON.filter((place) => place.kind === "landing").length, "landings");
 * ```
 */
export const PLACES_MOON: readonly Place[] = [...SITES, ...PLANNED_MOON, ...ALL.filter((place) => place.kind === "feature")];
