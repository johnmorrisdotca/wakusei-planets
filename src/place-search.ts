// The search lists of every point of interest on every body: the record a search returns (`PlaceHit`), how a list is read from its table, the matching, the ids and the page a hit comes from. Pure: no DOM, no clock reads.
// The lists themselves are the entry points `/places/search/<body>`, loaded one at a time by `loadPlaceSearch` from `/places/search`, so a page pays only for the body it searches.
import { PLACE_ID_ALIASES } from "./data/places-aliases.ts";
import { SEARCH_TYPES } from "./data/places-search-types.ts";
import type { PlaceOnBody } from "./scene/body-places.ts";
import type { Place, PlaceKind } from "./places.ts";

/**
 * One row of a body's search list: the compact record of a point of interest, enough to find it, show it, favourite it and go to it. A favourite stores `id`.
 *
 * @example
 * ```ts
 * import { loadPlaceSearch } from "@johnmorrisdotca/wakusei-planets/places/search";
 * import type { PlaceHit } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * const hits = await loadPlaceSearch("mars");
 * const olympus: PlaceHit = hits.find((hit) => hit.id === "mars/olympus-mons")!;
 * console.log(olympus.name.ja, olympus.typeWord.en, olympus.diameterKm, olympus.source.ref);
 * ```
 */
export interface PlaceHit {
  /** `<body>/<slug>`, the id the full lists (`/places/<body>`) use for the same place, and the id a favourite keeps. It is stable: an id of 0.66.0 is still in the lists, or is an alias (`resolvePlaceId`). */
  id: string;
  /** The body: `moon`, `mars`, `ceres`, `phobos`. The Moon's lettered craters are in the body `moon` too. */
  body: string;
  kind: PlaceKind;
  /** The name in English and Japanese (a feature's Japanese name is the package's name for it where it has one, else its IAU name, which is Latin or the name's own spelling). */
  name: { en: string; ja: string };
  /** A plain word for what it is: the feature's type (`crater`, `plain`, `satellite crater`) or the kind of site (`rover`, `crash site`). */
  typeWord: { en: string; ja: string };
  /** The Gazetteer's name for a feature's type (`Crater, craters`), for a feature. */
  type?: string;
  /** Planetocentric latitude and east longitude from -180 to 180, in degrees. */
  lat: number;
  lon: number;
  /** A feature's size in kilometres (the diameter, or the length of a line); 0 where the Gazetteer gives none. Always 0 for a site. */
  diameterKm: number;
  /** For a site: when it got there (ISO, UTC), to the minute where the source gives one. */
  date?: string;
  /** True where the source gives a site's position to a degree or less, or says it is an estimate. */
  approximate?: true;
  /** Where the row comes from: the source's id (as in `PLACES_CREDITS`), the date its file was read, and for a feature the Gazetteer's feature id (`placeHitUrl` makes its page). */
  source: { id: Place["source"]["id"]; read: string; ref?: number };
}

/**
 * The ids of the sources in the order the tables number them: the same ones as `PLACES_CREDITS`, in another order.
 *
 * @example
 * ```ts
 * import { SEARCH_SOURCE_IDS } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * console.log(SEARCH_SOURCE_IDS.length, "sources, the first is", SEARCH_SOURCE_IDS[0]);
 * ```
 */
export const SEARCH_SOURCE_IDS: readonly Place["source"]["id"][] = ["iau-gazetteer", "gcat-landercat", "nssdca", "pds-ode", "nasa-mars24", "agency", "nasa-ntrs", "pds-atmospheres", "paper", "announcement"];

/**
 * A plain word for each kind of place, in English and Japanese, as a search result shows it for a site.
 *
 * @example
 * ```ts
 * import { PLACE_KIND_WORDS } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * console.log(PLACE_KIND_WORDS.hardware.en, PLACE_KIND_WORDS.hardware.ja);
 * ```
 */
export const PLACE_KIND_WORDS: Readonly<Record<PlaceKind, { en: string; ja: string }>> = {
  crewed: { en: "crewed landing", ja: "有人着陸" },
  landing: { en: "lander", ja: "着陸機" },
  rover: { en: "rover", ja: "探査車" },
  crash: { en: "crash site", ja: "墜落地点" },
  impact: { en: "impact site", ja: "衝突地点" },
  entry: { en: "lost in the atmosphere", ja: "大気圏で消失" },
  planned: { en: "planned landing", ja: "着陸予定" },
  feature: { en: "feature", ja: "地形" },
  hardware: { en: "hardware", ja: "機器・部品" },
};

const KINDS: Readonly<Record<string, PlaceKind>> = { c: "crewed", l: "landing", r: "rover", x: "crash", i: "impact", e: "entry", p: "planned", f: "feature", h: "hardware" };

/**
 * Reads a body's table into its list. The table is one string: the date its Gazetteer file was read, then one line for each place, with the columns id, kind, name, Japanese name, type, latitude, longitude, size, source and date, flags.
 * A feature's Gazetteer id is written as the step from the feature before it. Used by the entry points of `/places/search/<body>`.
 *
 * @param body - The body the table is of.
 * @param text - The table.
 * @returns The list: the sites by date, then the features in the order of their Gazetteer ids.
 *
 * @example
 * ```ts
 * import { readPlaceHits } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * const hits = readPlaceHits("moon", "2026-11-18\n\tf\tTycho\tティコ\t6\t-43.31\t-11.36\t85\t6163");
 * console.log(hits[0]?.id, hits[0]?.name.ja, hits[0]?.source.ref);
 * ```
 */
export function readPlaceHits(body: string, text: string): PlaceHit[] {
  const lines = text.split("\n");
  const read = lines[0] ?? "";
  const hits: PlaceHit[] = [];
  let feature = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = (lines[i] as string).split("\t");
    const kind = KINDS[c[1] as string] as PlaceKind;
    const en = c[2] as string;
    const type = c[4] === "" || c[4] === undefined ? undefined : SEARCH_TYPES[Number(c[4])];
    const ref = c[8] as string;
    const at = ref.indexOf("@");
    const hit: PlaceHit = {
      id: c[0] === "" ? `${body}/${slugOf(en)}` : (c[0] as string),
      body: (c[0] === "" ? body : (c[0] as string).split("/")[0]) as string,
      kind,
      name: { en, ja: c[3] === "" ? en : (c[3] as string) },
      typeWord: type === undefined ? PLACE_KIND_WORDS[kind] : { en: type[1], ja: type[2] },
      lat: Number(c[5]),
      lon: Number(c[6]),
      diameterKm: c[7] === "" || c[7] === undefined ? 0 : Number(c[7]),
      source: at < 0 ? { id: "iau-gazetteer", read, ref: (feature += Number(ref)) } : { id: SEARCH_SOURCE_IDS[Number(ref.slice(0, at))] as PlaceHit["source"]["id"], read: ref.slice(at + 1) },
    };
    if (type !== undefined) hit.type = type[0];
    if (c[9] !== "" && c[9] !== undefined) hit.date = c[9];
    if (c[10] === "a") hit.approximate = true;
    hits.push(hit);
  }
  return hits;
}

/** The slug of a name: accents taken off, lower case, anything else but letters and digits a hyphen. */
function slugOf(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * An id as the lists now have it: an id of an earlier release whose place was renamed (or held twice) turned into its current id, any other id as it is. A page that saved favourites with 0.66.0's ids calls this before it looks one up.
 *
 * @param id - A place id.
 * @returns The current id.
 *
 * @example
 * ```ts
 * import { resolvePlaceId } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * console.log(resolvePlaceId("mercury/kunisada-2"), resolvePlaceId("moon/tycho"));
 * ```
 */
export function resolvePlaceId(id: string): string {
  return Object.hasOwn(PLACE_ID_ALIASES, id) ? (PLACE_ID_ALIASES[id] as string) : id;
}

/**
 * The page a hit comes from: a Gazetteer feature's page on the USGS site, or `undefined` for a site (its source is named in `PLACES_CREDITS`).
 *
 * @param hit - A row of a search list.
 * @returns The address, or `undefined` for a site.
 *
 * @example
 * ```ts
 * import { loadPlaceSearch, placeHitUrl } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * const tycho = (await loadPlaceSearch("moon")).find((hit) => hit.id === "moon/tycho")!;
 * console.log(placeHitUrl(tycho));
 * ```
 */
export function placeHitUrl(hit: PlaceHit): string | undefined {
  return hit.source.id === "iau-gazetteer" && hit.source.ref !== undefined ? `https://planetarynames.wr.usgs.gov/Feature/${hit.source.ref}` : undefined;
}

/**
 * A hit as a `Place`, for the parts of the package that take one (`goToPlace` with a list of your own, `placeMarks`, `findPlace`). A feature's `approved` date and the origin of its name are not in a search list, so `approved` is empty and there is no `origin`:
 * the Gazetteer's page (`placeHitUrl`) has them.
 *
 * @param hit - A row of a search list.
 * @returns The place.
 *
 * @example
 * ```ts
 * import { hitToPlace, loadPlaceSearch } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * const place = hitToPlace((await loadPlaceSearch("mars")).find((hit) => hit.id === "mars/olympus-mons")!);
 * console.log(place.kind, place.feature?.diameterKm, place.lat);
 * ```
 */
export function hitToPlace(hit: PlaceHit): Place {
  const place: Place = { id: hit.id, kind: hit.kind, name: hit.name, lat: hit.lat, lon: hit.lon, source: { id: hit.source.id, read: hit.source.read } };
  if (hit.kind === "feature" && hit.type !== undefined) place.feature = { type: hit.type, typeWord: hit.typeWord, diameterKm: hit.diameterKm, approved: "" };
  if (hit.date !== undefined) place.date = hit.date;
  if (hit.approximate === true) place.approximate = true;
  if (hit.source.ref !== undefined) place.source.url = placeHitUrl(hit) as string;
  return place;
}

const FOLDED = new WeakMap<PlaceHit, readonly [string, string]>();

/** Lower case with the accents off, so "Bartók" is found by "bartok" and "ÅNGSTRÖM" by "angstrom". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const KIND_ORDER: Readonly<Record<PlaceKind, number>> = { crewed: 0, landing: 1, rover: 2, crash: 3, impact: 4, entry: 5, planned: 6, hardware: 7, feature: 8 };

/**
 * The places of a list that match what a reader typed, best first. A match is on the English name, the Japanese name or the id's name, ignoring case and accents: the whole name first, then a name that starts with the text, then a word that does, then any
 * name that holds it. Within a kind of match the visited sites come before the features, and a larger feature before a smaller one.
 *
 * @param hits - One or more lists (`loadPlaceSearch`); the lists of several bodies make a search of all of them.
 * @param query - What the reader typed. Empty text matches nothing.
 * @param options - `limit` (default 20), and `kinds` to keep only some kinds of place.
 * @returns The matching places.
 *
 * @example
 * ```ts
 * import { loadPlaceSearch, searchPlaces } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * const moon = await loadPlaceSearch("moon");
 * console.log(searchPlaces(moon, "apollo 11", { limit: 3 }).map((hit) => hit.name.en).join("; "));
 * console.log(searchPlaces(moon, "静かの海")[0]?.name.en);
 * ```
 */
export function searchPlaces(hits: readonly PlaceHit[], query: string, options: { limit?: number; kinds?: readonly PlaceKind[] } = {}): PlaceHit[] {
  const wanted = fold(query.trim());
  if (wanted === "") return [];
  const out: { hit: PlaceHit; score: number }[] = [];
  for (const hit of hits) {
    if (options.kinds !== undefined && !options.kinds.includes(hit.kind)) continue;
    let names = FOLDED.get(hit);
    if (names === undefined) FOLDED.set(hit, (names = [fold(hit.name.en), fold(hit.name.ja)]));
    let score = 9;
    for (const name of names) {
      const at = name.indexOf(wanted);
      if (at < 0) continue;
      score = Math.min(score, name === wanted ? 0 : at === 0 ? 1 : /[\s\-'(]/.test(name[at - 1] as string) ? 2 : 3);
    }
    if (score < 9) out.push({ hit, score });
  }
  out.sort((a, b) => a.score - b.score || KIND_ORDER[a.hit.kind] - KIND_ORDER[b.hit.kind] || b.hit.diameterKm - a.hit.diameterKm || (a.hit.name.en < b.hit.name.en ? -1 : a.hit.name.en > b.hit.name.en ? 1 : 0));
  return out.slice(0, options.limit ?? 20).map((entry) => entry.hit);
}

/**
 * A hit as a place for `<wakusei-space>`'s `bodyPlaces`: a beam on the ground of the hit's body at its latitude and longitude, named in English or Japanese, the id the hit has (a favourite's id, so a press says which one it was).
 *
 * @param hit - A row of a search list.
 * @param options - `lang` for the label (`en` by default), `kind` (`favourite` by default, or `here`), `color` (a CSS colour for this place alone) and `label` (your own text, or `false` for none).
 * @returns The place to draw.
 *
 * @example
 * ```ts
 * import { hitToBodyPlace, loadPlaceSearch } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * const olympus = (await loadPlaceSearch("mars")).find((hit) => hit.id === "mars/olympus-mons")!;
 * console.log(hitToBodyPlace(olympus, { lang: "ja", color: "#ff8844" }));
 * ```
 */
export function hitToBodyPlace(hit: PlaceHit, options: { lang?: "en" | "ja"; kind?: "here" | "favourite"; color?: string; label?: string | false } = {}): PlaceOnBody {
  const place: PlaceOnBody = { body: hit.body, id: hit.id, lon: hit.lon, lat: hit.lat };
  if (options.label !== false) place.label = options.label ?? hit.name[options.lang ?? "en"];
  if (options.kind !== undefined) place.kind = options.kind;
  if (options.color !== undefined) place.color = options.color;
  return place;
}
