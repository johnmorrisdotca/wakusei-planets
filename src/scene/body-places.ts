// The places laid on any body in `<wakusei-space>`: a reader's own place and the places they keep on the Moon, Mars or any other body the view draws, each a marker standing out of the ground, the same one `earth-places` draws on the Earth.
// The layout is chikyu-earth's (handed in by `@johnmorrisdotca/wakusei-planets/earth-places`, an optional peer this file never imports): its `layoutPlaces` works on any body's picture, so here is only what is about bodies: the list
// keyed by body, reading it, and laying the lists of several bodies in one draw. Pure: no DOM, no clock reads.
import { BODIES, type BodyId } from "../facts.ts";
import { pointUnder, spotView, type SurfaceView } from "../place-marks.ts";
import type { Vec3 } from "../vec.ts";
import { EARTH_PLACE_MARKS, EARTH_PLACES_FROM_PX, inMarkOrder, placeRank, type EarthPlace, type EarthPlaceLayout, type EarthPlaceMark, type EarthPlaceLayoutOptions, type EarthPlaceLook, type EarthPlacesLayout } from "./earth-places.ts";

/**
 * One place for the `body-places` attribute or the `bodyPlaces` property of `<wakusei-space>`: an `EarthPlace` and the body it is on. `/places/search` makes them from the rows of a search list (`hitToBodyPlace`).
 *
 * @example
 * ```ts
 * import type { PlaceOnBody } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const places: PlaceOnBody[] = [
 *   { body: "moon", id: "moon/apollo-11-lunar-module", lon: 23.4731, lat: 0.6742, label: "Apollo 11 lunar module", kind: "favourite" },
 *   { body: "mars", id: "mars/olympus-mons", lon: -133.803, lat: 18.653, label: "Olympus Mons" },
 * ];
 * console.log(places.length);
 * ```
 */
export interface PlaceOnBody extends EarthPlace {
  /** The body it is on: `moon`, `mars`, `ceres`, `io`. The Earth's places are `earth-places`; one named `earth` here is not drawn. */
  body: string;
}

/**
 * What the layer drew for one place on a body: its body, id and kind, where its foot is (CSS pixels from the view's top left) and whether its name is drawn.
 *
 * @example
 * ```ts
 * import type { PlaceOnBodyMark } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const mark: PlaceOnBodyMark = { body: "moon", id: "moon/tycho", kind: "favourite", x: 210, y: 300, named: true };
 * console.log(mark.body, mark.named);
 * ```
 */
export type PlaceOnBodyMark = EarthPlaceMark & { body: string };

/** The most places kept from a list, as `earth-places` keeps. */
export const BODY_PLACES_KEPT = 5000;

/**
 * Read the text of the `body-places` attribute (a JSON array) as the list the view draws. Each entry needs a `body` (lower case letters, digits and hyphens, not `earth`) and what an `earth-places` entry needs: they are grouped by body and each group
 * is read by chikyu-earth's own reader, so a longitude from -180 to 180, a latitude from -90 to 90, a label of 80 letters at most, `here` or `favourite` and a safe colour mean the same here. An entry that fails is left out; a text that is not a list is no list.
 *
 * @param value - The attribute's text, or null.
 * @param read - chikyu-earth's `readPlaces`: the text of one body's list to the places to draw.
 * @returns The places, bodies in the order they first appear, at most 5,000.
 */
export function readBodyPlacesWith(value: string | null | undefined, read: (text: string) => EarthPlace[]): PlaceOnBody[] {
  if (typeof value !== "string" || value === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const groups = new Map<string, unknown[]>();
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const body = (entry as { body?: unknown }).body;
    if (typeof body !== "string" || !/^[a-z0-9-]{1,40}$/.test(body) || body === "earth") continue;
    const rest: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
    delete rest["body"];
    const group = groups.get(body);
    if (group === undefined) groups.set(body, [rest]);
    else group.push(rest);
  }
  const out: PlaceOnBody[] = [];
  for (const [body, group] of groups) for (const place of read(JSON.stringify(group))) out.push({ ...place, body });
  return out.slice(0, BODY_PLACES_KEPT);
}

/** The bodies a list has places on, in the order they first appear. */
export const bodiesOf = (places: readonly PlaceOnBody[]): string[] => [...new Set(places.map((place) => place.body))];

/** A body as one draw left it: what `onSurface` gives, and `sun`, the direction of the Sun from the body in the scene (null with the light `lit`, or for a body the Sun's direction is not worked out for). */
export interface BodySurface {
  id: string;
  centre: Vec3;
  radius: number;
  pole: Vec3;
  meridian: Vec3;
  eye: Vec3;
  project(point: Vec3): { x: number; y: number } | null;
  width: number;
  height: number;
  radiusPx: number;
  sun: Vec3 | null;
}

/** The body's shape as the places lie on it: its three axes where it has them, else its flattening, as the marks of `places` do. */
export function bodyScale(id: string): Vec3 | undefined {
  const facts = (BODIES as Readonly<Record<string, (typeof BODIES)[BodyId] | undefined>>)[id];
  if (facts === undefined) return undefined;
  const ax = facts.axesKm;
  return ax ? [ax[1] / facts.radiusKm, ax[2] / facts.radiusKm, ax[0] / facts.radiusKm] : [1, 1 - facts.flattening, 1];
}

/** What the view tells the layout about names. */
export interface BodyLayoutOptions {
  /** How wide a name is, in CSS pixels. */
  width(text: string): number;
  /** Boxes already used by other names. */
  taken: readonly { left: number; top: number; width: number; height: number }[];
  /** Whether a body is under another's disc (its places are not drawn). */
  covered?: (id: string) => boolean;
  /** The most markers in all (`EARTH_PLACE_MARKS` by default). */
  marks?: number;
}

/**
 * Lay the places of every body in sight in one go: for each body of `surfaces` with places in the list, big enough on the screen (`EARTH_PLACES_FROM_PX` CSS pixels of radius) and not covered, chikyu-earth's layout on that body's picture, names keeping
 * clear of each other across bodies. The markers of `here` places come first, then the rest in the order given, and only the first `marks` stand up; the rest are counted in `omitted`.
 *
 * @param places - The places, as `readBodyPlaces` makes them.
 * @param surfaces - The bodies as the last draw left them.
 * @param using - chikyu-earth's reading and layout.
 * @param look - `beam`, `pin` or `ring`.
 * @param options - The width of a name, the boxes in use and which bodies are covered.
 * @returns The places the shapes index, the layout of all of them, and how many were left out for the limit.
 */
export function layBodyPlaces(places: readonly PlaceOnBody[], surfaces: readonly BodySurface[], using: EarthPlacesLayout, look: EarthPlaceLook, options: BodyLayoutOptions): { places: PlaceOnBody[]; layout: EarthPlaceLayout; omitted: number } {
  const merged: PlaceOnBody[] = [];
  const shapes: EarthPlaceLayout["shapes"] = [];
  const labels: EarthPlaceLayout["labels"] = [];
  const taken = [...options.taken];
  for (const surface of surfaces) {
    if (!(surface.radiusPx >= EARTH_PLACES_FROM_PX) || options.covered?.(surface.id) === true) continue;
    const scale = bodyScale(surface.id);
    if (scale === undefined) continue;
    // the places that matter most first: where the reader is, then the rest in the order given, then those whose name is low
    const mine = inMarkOrder(places.filter((place) => place.body === surface.id));
    if (mine.length === 0) continue;
    const view = spotView({ ...surface, scale } as SurfaceView);
    const sun = surface.sun === null ? null : pointUnder(surface.sun, surface.pole, surface.meridian);
    const layoutOptions: EarthPlaceLayoutOptions = {
      size: (place) => (place.label === undefined ? null : { width: options.width(place.label), height: 18 }),
      taken,
      sun,
    };
    const laid = using.layout(mine, view, look, layoutOptions);
    const offset = merged.length;
    merged.push(...mine);
    for (const shape of laid.shapes) shapes.push({ ...shape, index: shape.index + offset });
    for (const spot of laid.labels) {
      labels.push({ ...spot, index: spot.index + offset });
      const label = mine[spot.index]?.label;
      if (label !== undefined) taken.push({ left: spot.left, top: spot.top, width: options.width(label), height: 18 });
    }
  }
  // the places of the reader come first on every body, then the others; the first few in sight stand up and the rest are counted, never silently left out
  const rank = (shape: (typeof shapes)[number]): number => placeRank(merged[shape.index]!);
  const ordered = shapes.map((shape, i) => ({ shape, i })).sort((a, b) => rank(a.shape) - rank(b.shape) || a.i - b.i).map((entry) => entry.shape);
  const limit = options.marks ?? EARTH_PLACE_MARKS;
  const kept = ordered.slice(0, limit);
  const keptLabels = labels.filter((spot) => kept.some((shape) => shape.index === spot.index));
  return { places: merged, layout: { shapes: kept, labels: keptLabels }, omitted: ordered.length - kept.length };
}
