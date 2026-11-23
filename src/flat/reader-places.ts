// The reader's own places on the flat map: the same lists `<wakusei-space>` reads (`earth-places` on the Earth, `body-places` on any other body), turned into marks. Pure: no DOM, and no chikyu-earth, so the flat map stays free of that peer.
import { inMarkOrder, readEarthPlaceLayers, shownEarthPlaces, type EarthPlace } from "../scene/earth-places.ts";
import { readMarks, type HeldMark } from "./marks.ts";

/** The most places kept from one list, as the globe keeps. */
const KEPT = 5000;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const NAME = /^[a-zA-Z]{1,20}$/;

/**
 * Read one JSON list as the places the flat map can draw: a longitude from -180 to 180, a latitude from -90 to 90, an `id` (or the place's index), a label of 80 letters, `here` or `favourite`, a layer of 40 letters and a colour that is a hex colour or a colour's name.
 * A place that fails is left out. A text that is not a list is no list. At most 5,000 are kept.
 *
 * @param value - The attribute's text, or null.
 * @returns The places, in the order given.
 *
 * @example
 * ```ts
 * import { readFlatPlaces } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(readFlatPlaces('[{"id":"me","lon":-79.4,"lat":43.7,"kind":"here"},{"lon":500,"lat":0}]').map((place) => place.id));
 * ```
 */
export function readFlatPlaces(value: string | null | undefined): EarthPlace[] {
  if (typeof value !== "string" || value === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: EarthPlace[] = [];
  for (const [index, item] of parsed.entries()) {
    const place = onePlace(item, index);
    if (place !== undefined) out.push(place);
    if (out.length === KEPT) break;
  }
  return out;
}

/**
 * The marks for the body on the map: the Earth's list when the body is the Earth, and the entries of `body-places` whose body is the one shown (an entry named `earth` is left to the Earth's list). A layer switched off in `layers` is left out.
 * Where the reader is, is a star; a place they keep is a ring; an airport is a small blue dot and a harbour a small green square, named when pointed at.
 *
 * @param body - The body the map is showing.
 * @param earth - The `earth-places` text.
 * @param bodies - The `body-places` text.
 * @param layers - The `earth-place-layers` text.
 * @returns The marks, here first.
 *
 * @example
 * ```ts
 * import { readerMarks } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const marks = readerMarks("earth", '[{"id":"yvr","lon":-123.18,"lat":49.19,"label":"Vancouver","layer":"airports"}]', null, '{"airports":false}');
 * console.log(marks.length);
 * ```
 */
export function readerMarks(body: string, earth: string | null | undefined, bodies: string | null | undefined, layers: string | null | undefined): HeldMark[] {
  const switches = readEarthPlaceLayers(layers);
  const places = body === "earth" ? readFlatPlaces(earth) : placesOn(body, bodies);
  const shown = inMarkOrder(shownEarthPlaces(places, switches));
  return readMarks("reader", shown.map(asMark));
}

function placesOn(body: string, value: string | null | undefined): EarthPlace[] {
  if (typeof value !== "string" || value === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const group: unknown[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const named = (entry as { body?: unknown }).body;
    if (named !== body || body === "earth") continue;
    const rest: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
    delete rest["body"];
    group.push(rest);
  }
  return readFlatPlaces(JSON.stringify(group));
}

function onePlace(item: unknown, index: number): EarthPlace | undefined {
  if (typeof item !== "object" || item === null) return undefined;
  const rec = item as Record<string, unknown>;
  if (typeof rec["lon"] !== "number" || typeof rec["lat"] !== "number") return undefined;
  if (rec["lon"] < -180 || rec["lon"] > 180 || rec["lat"] < -90 || rec["lat"] > 90) return undefined;
  const id = typeof rec["id"] === "string" && rec["id"] !== "" ? rec["id"].slice(0, 80) : String(index);
  const label = typeof rec["label"] === "string" && rec["label"].trim() !== "" ? rec["label"].trim().slice(0, 80) : id;
  const place: EarthPlace = { id, lon: rec["lon"], lat: rec["lat"], label, kind: rec["kind"] === "here" ? "here" : "favourite" };
  if (typeof rec["layer"] === "string" && rec["layer"].trim() !== "") place.layer = rec["layer"].trim().slice(0, 40);
  if (typeof rec["color"] === "string" && (HEX.test(rec["color"]) || NAME.test(rec["color"]))) place.color = rec["color"];
  if (rec["namePriority"] === "low") place.namePriority = "low";
  return place;
}

function asMark(place: EarthPlace): Parameters<typeof readMarks>[1][number] {
  const airport = place.layer === "airports";
  const harbour = place.layer === "harbours";
  const here = place.kind === "here";
  return {
    id: `place:${place.id}`,
    lat: place.lat,
    lon: place.lon,
    name: place.label ?? place.id,
    group: "reader",
    shape: here ? "star" : harbour ? "square" : airport ? "dot" : "ring",
    colour: place.color ?? (here ? "#ffd23f" : harbour ? "#9fd6c2" : airport ? "#7eb6ff" : "#ffffff"),
    size: here ? 6 : place.layer ? 3 : 4,
    labelled: here || place.layer === undefined,
    data: place,
  };
}
