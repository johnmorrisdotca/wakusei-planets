// "You are here", and the places a reader keeps, on `<wakusei-space>`'s Earth. This entry point is what brings chikyu-earth's layout of places (its `/markers`, an optional peer) to the views: import it for its effect,
// `import "@johnmorrisdotca/wakusei-planets/earth-places"`, and `<wakusei-space earth-places='[...]'>` draws them. A page that never imports it carries none of chikyu-earth, and the attribute draws nothing.
import { layoutPlaces, readPlaces } from "@johnmorrisdotca/chikyu-earth/markers";
import { spotView, type SurfaceView } from "./place-marks.ts";
import { readBodyPlacesWith, type PlaceOnBody } from "./scene/body-places.ts";
import { keepPlaceFields, layWithOwn, setEarthPlacesLayout, type EarthPlace, type EarthPlaceClickDetail, type EarthPlaceLayout, type EarthPlaceLayoutOptions, type EarthPlaceLook, type EarthPlaceNamePriority, type EarthPlaceSize, type EarthPlacesLayout } from "./scene/earth-places.ts";

const read = (value: string | null | undefined): EarthPlace[] => keepPlaceFields(value, readPlaces(value));
const layout: EarthPlacesLayout["layout"] = (places, view, look, options) => layWithOwn(layoutPlaces, places, view, look, options);

setEarthPlacesLayout({ read, layout });

export type { PlaceOnBody, EarthPlace, EarthPlaceClickDetail, EarthPlaceLayout, EarthPlaceLayoutOptions, EarthPlaceLook, EarthPlaceNamePriority, EarthPlaceSize };
export { EARTH_PLACE_LOOKS, EARTH_PLACE_MARKS, readEarthPlaceLayers, shownEarthPlaces } from "./scene/earth-places.ts";

/**
 * Read the text of the `earth-places` attribute (a JSON array) as the list the views draw: each place needs a longitude from -180 to 180 and a latitude from -90 to 90, one without an `id` is given its place in the list, a label is
 * cut to 80 letters, a kind that is not `here` is `favourite`, and a colour is kept only when it is a hex colour, `rgb()` or `hsl()` with numbers, or a colour's name. A `layer` is cut to 40 letters, a `size` is kept only when it is `small`, a `look` only
 * when it is `beam`, `pin` or `ring` and a `namePriority` only when it is `low`. At most 5,000 are kept. chikyu-earth's `readPlaces`, with those four fields kept.
 *
 * @param value - The attribute's text, or null.
 * @returns The places to draw.
 *
 * @example
 * ```ts
 * import { readEarthPlaces } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * console.log(readEarthPlaces('[{"id":"me","lon":-79.4,"lat":43.7,"kind":"here"},{"id":"cavan","lon":-123.1,"lat":49.29,"layer":"harbours","size":"small"},{"lon":500,"lat":0}]'));
 * ```
 */
export function readEarthPlaces(value: string | null | undefined): EarthPlace[] {
  return read(value);
}

/**
 * Where each place's marker and name go on a picture of a body, for a page or a server that draws places itself: chikyu-earth's `layoutPlaces` on the body as a view of it draws it (its axes, the camera and the projection to the screen).
 * A place on the far side is left out and one near the edge fades; with `sun`, each marker says how far into the night it is.
 *
 * @param places - The places, as `readEarthPlaces` makes them.
 * @param view - The body as drawn (`SurfaceView` from `/places`): the Earth's centre, radius, pole and prime meridian in the scene, the camera, and the projection to CSS pixels.
 * @param look - `beam`, `pin` or `ring`, for each place that has no `look` of its own; a `small` place has a shorter stick and a smaller ring.
 * @param options - The size of each name, the boxes already used, the most names and where the Sun is overhead.
 * @returns The markers and where the names go.
 *
 * @example
 * ```ts
 * import { layEarthPlaces } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * const view = { centre: [0, 0, 0] as [number, number, number], radius: 1, pole: [0, 1, 0] as [number, number, number], meridian: [0, 0, 1] as [number, number, number], scale: [1, 1, 1] as [number, number, number], toward: [0, 0, 1] as [number, number, number],
 *   project: (p: [number, number, number]) => ({ x: 160 + p[0] * 100, y: 160 - p[1] * 100 }), width: 320, height: 320, radiusPx: 100 };
 * const laid = layEarthPlaces([{ id: "gulf", lon: 0, lat: 0, label: "Null Island", kind: "here" }], view, "beam", { size: () => ({ width: 70, height: 18 }) });
 * console.log(laid.shapes.length, laid.labels.length);
 * ```
 */
export function layEarthPlaces(places: readonly EarthPlace[], view: SurfaceView, look: EarthPlaceLook, options: EarthPlaceLayoutOptions = {}): EarthPlaceLayout {
  return layout(places, spotView(view), look, options);
}

/**
 * Read the text of the `body-places` attribute (a JSON array) as the list `<wakusei-space>` draws on bodies other than the Earth: each entry is an `earth-places` entry with the `body` it is on (lower case, not `earth`). They are grouped by body and each group is read by
 * `readEarthPlaces`, so the same limits hold (a longitude from -180 to 180, a latitude from -90 to 90, a label of 80 letters, `here` or `favourite`, a safe colour, 5,000 at most). An entry without a valid `body` is left out.
 *
 * @param value - The attribute's text, or null.
 * @returns The places to draw, the bodies in the order they first appear.
 *
 * @example
 * ```ts
 * import { readBodyPlaces } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * console.log(readBodyPlaces('[{"body":"moon","id":"a","lon":10,"lat":5},{"body":"earth","id":"b","lon":0,"lat":0},{"lon":1,"lat":1}]').map((place) => `${place.body}:${place.id}`));
 * ```
 */
export function readBodyPlaces(value: string | null | undefined): PlaceOnBody[] {
  return readBodyPlacesWith(value, readPlaces);
}
