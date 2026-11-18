// The search lists of every point of interest on every body, and the search over them. The lists are the entry points `/places/search/<body>`, fetched one at a time by `loadPlaceSearch`; see `/places` for the full records of the larger bodies.
import { PLACE_SEARCH_BODIES, readSearchTable, type PlaceSearchBody } from "../data/places-search-bodies.ts";
import { resolvePlaceId, type PlaceHit } from "../place-search.ts";

export { hitToBodyPlace, hitToPlace, PLACE_KIND_WORDS, placeHitUrl, readPlaceHits, resolvePlaceId, searchPlaces, SEARCH_SOURCE_IDS, type PlaceHit } from "../place-search.ts";
export { PLACE_SEARCH_BODIES, type PlaceSearchBody } from "../data/places-search-bodies.ts";

/**
 * The search list of a body, fetched when asked for: the table of `/places/search/<body>` arrives as a chunk of its own the first time, so a page that never searches a body does not carry it. The Moon's 7,064 lettered satellite craters are a chunk
 * of their own too, fetched only with `{ satellites: true }`.
 *
 * @param body - One of `PLACE_SEARCH_BODIES`: `moon`, `mars`, `venus`, `ceres`, `phobos`, `itokawa` and the rest.
 * @param options - `satellites: true` adds the Moon's lettered craters to the list of `moon` (nothing for any other body).
 * @returns The list: the sites first, by date, then the named features in the order of their Gazetteer ids (the larger bodies' search puts the larger ones first anyway: `searchPlaces` ranks). An unknown body is a rejected `RangeError`.
 *
 * @example
 * ```ts
 * import { loadPlaceSearch, searchPlaces } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * const mars = await loadPlaceSearch("mars");
 * console.log(mars.length, "points of interest on Mars;", searchPlaces(mars, "perseverance", { limit: 3 }).map((hit) => hit.name.en).join(", "));
 * const moon = await loadPlaceSearch("moon", { satellites: true });
 * console.log(moon.length, "on the Moon, with the lettered craters");
 * ```
 */
export async function loadPlaceSearch(body: PlaceSearchBody, options: { satellites?: boolean } = {}): Promise<readonly PlaceHit[]> {
  if (!(PLACE_SEARCH_BODIES as readonly string[]).includes(body)) throw new RangeError(`search lists are held for ${PLACE_SEARCH_BODIES.join(", ")}, not "${String(body)}"`);
  const list = await readSearchTable(body);
  return body === "moon" && options.satellites === true ? [...list, ...(await readSearchTable("moon-satellites"))] : list;
}

/**
 * The rows for a set of saved ids: each id is made current (`resolvePlaceId`), and only the lists the ids need are fetched, the Moon's lettered craters only for an id the Moon's own list does not have. For a favourites page: the ids it saved in, the rows (and so the beams,
 * `hitToBodyPlace`) out.
 *
 * @param ids - Place ids, as `PlaceHit.id` of an earlier visit or an earlier release.
 * @returns The rows found, in the order of the ids, each once. An id for no body or no place is left out.
 *
 * @example
 * ```ts
 * import { hitToBodyPlace, loadPlaceHits } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * const hits = await loadPlaceHits(["moon/tycho", "mars/olympus-mons", "mercury/kunisada-2", "moon/tycho-a", "nowhere/nothing"]);
 * console.log(hits.map((hit) => hit.id).join(", "));
 * console.log(hits.map((hit) => hitToBodyPlace(hit)).length, "beams");
 * ```
 */
export async function loadPlaceHits(ids: readonly string[]): Promise<PlaceHit[]> {
  const wanted = ids.map(resolvePlaceId);
  const bodies = new Set<string>();
  for (const id of wanted) {
    const body = id.split("/")[0] as string;
    if ((PLACE_SEARCH_BODIES as readonly string[]).includes(body)) bodies.add(body);
  }
  const found = new Map<string, PlaceHit>();
  const need = new Set(wanted);
  for (const body of bodies) {
    for (const hit of await loadPlaceSearch(body as PlaceSearchBody)) if (need.has(hit.id)) found.set(hit.id, hit);
  }
  // the Moon's lettered craters are a list of their own, fetched only for an id the Moon's other list does not hold
  if (bodies.has("moon") && wanted.some((id) => id.startsWith("moon/") && !found.has(id))) {
    for (const hit of (await loadPlaceSearch("moon", { satellites: true })).slice((await loadPlaceSearch("moon")).length)) if (need.has(hit.id)) found.set(hit.id, hit);
  }
  const out: PlaceHit[] = [];
  const seen = new Set<string>();
  for (const id of wanted) {
    const hit = found.get(id);
    if (hit !== undefined && !seen.has(id)) {
      seen.add(id);
      out.push(hit);
    }
  }
  return out;
}
