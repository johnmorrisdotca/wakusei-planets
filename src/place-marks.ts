// Where the places of a body fall on the screen, for the marks `<wakusei-body>` and `<wakusei-space>` lay over it: a place's point on the body's surface (an ellipsoid, the body's own axes), whether it faces
// the viewer, and which marks to show so that they never crowd. Pure: the caller hands over the body's axes and a projection, and gets back points in CSS pixels.
import type { Place, PlaceKind } from "./places.ts";
import { dot, type Vec3 } from "./vec.ts";

/**
 * The layers of places a view can show, each switched on by itself: `landing` (the crewed landings, the landers and the rovers), `crash` (the crash, impact and atmospheric-entry sites), `planned` (announced landings) and `feature`
 * (the named features of the surface).
 *
 * @example
 * ```ts
 * import { PLACE_LAYERS } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(PLACE_LAYERS.join(" "));
 * ```
 */
export const PLACE_LAYERS = ["landing", "crash", "planned", "feature"] as const;

/**
 * One layer of places.
 *
 * @example
 * ```ts
 * import type { PlaceLayer } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const layer: PlaceLayer = "landing";
 * console.log(layer);
 * ```
 */
export type PlaceLayer = (typeof PLACE_LAYERS)[number];

/**
 * The layer a kind of place is shown in.
 *
 * @param kind - The place's kind.
 * @returns Its layer.
 *
 * @example
 * ```ts
 * import { layerOf } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(layerOf("rover"), layerOf("impact"), layerOf("feature"));
 * ```
 */
export function layerOf(kind: PlaceKind): PlaceLayer {
  return kind === "crewed" || kind === "landing" || kind === "rover" ? "landing" : kind === "crash" || kind === "impact" || kind === "entry" ? "crash" : kind === "planned" ? "planned" : "feature";
}

/**
 * The layers an attribute asks for: a list of layer names with spaces or commas between (`"landing crash"`), `all` (or an empty value) for every layer, and `none` or `off` for none. Unknown words are left out.
 *
 * @param value - The attribute's value, or `null` when it is absent (no layers).
 * @returns The layers, in `PLACE_LAYERS` order.
 *
 * @example
 * ```ts
 * import { readPlaceLayers } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(readPlaceLayers("crash, landing"), readPlaceLayers(""), readPlaceLayers(null));
 * ```
 */
export function readPlaceLayers(value: string | null): PlaceLayer[] {
  if (value === null) return [];
  const words = value.toLowerCase().split(/[\s,]+/).filter((word) => word !== "");
  if (words.length === 0 || words.includes("all") || words.includes("on")) return [...PLACE_LAYERS];
  return PLACE_LAYERS.filter((layer) => words.includes(layer));
}

/**
 * A body as a view draws it, for laying marks over it: its centre and radius in the scene's units, its axes there (`pole` north, `meridian` towards longitude 0 on the equator), the stretch of its globe along each
 * (east, pole, meridian: 1, 1, 1 for a sphere), where the viewer is (`eye`, a point, for a camera with perspective; `toward`, a direction, for one without), the projection of a point in the scene to CSS pixels
 * (`null` when it cannot be drawn), the view's size in CSS pixels, and the body's radius on the screen in CSS pixels.
 *
 * @example
 * ```ts
 * import type { SurfaceView } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const view: SurfaceView = { centre: [0, 0, 0], radius: 1, pole: [0, 1, 0], meridian: [0, 0, 1], scale: [1, 1, 1], toward: [0, 0, 1], project: (p) => ({ x: 160 + p[0] * 100, y: 160 - p[1] * 100 }), width: 320, height: 320, radiusPx: 100 };
 * console.log(view.radiusPx);
 * ```
 */
export interface SurfaceView {
  centre: Vec3;
  radius: number;
  pole: Vec3;
  meridian: Vec3;
  scale: Vec3;
  eye?: Vec3;
  toward?: Vec3;
  project(point: Vec3): { x: number; y: number } | null;
  width: number;
  height: number;
  radiusPx: number;
}

const RAD = Math.PI / 180;

/**
 * A place's point on the body's surface in the scene, and the outward normal there: the planetocentric latitude and east longitude laid along the body's own axes onto its ellipsoid.
 *
 * @param view - The body as drawn.
 * @param lat - Planetocentric latitude, degrees.
 * @param lon - East longitude, degrees.
 * @returns The point and the unit normal.
 *
 * @example
 * ```ts
 * import { surfacePoint } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const view = { centre: [0, 0, 0] as [number, number, number], radius: 2, pole: [0, 1, 0] as [number, number, number], meridian: [0, 0, 1] as [number, number, number], scale: [1, 1, 1] as [number, number, number], project: () => null, width: 1, height: 1, radiusPx: 1 };
 * console.log(surfacePoint(view, 0, 90).point.map((n) => n.toFixed(1)).join(", "));
 * ```
 */
export function surfacePoint(view: SurfaceView, lat: number, lon: number): { point: Vec3; normal: Vec3 } {
  const { pole: p, meridian: m, scale: s } = view;
  const e: Vec3 = [p[1] * m[2] - p[2] * m[1], p[2] * m[0] - p[0] * m[2], p[0] * m[1] - p[1] * m[0]];
  // the direction in the body's own frame (east, pole, meridian), stretched onto the ellipsoid along that direction: planetocentric, so the point is where that line from the centre meets the surface
  const ux = Math.cos(lat * RAD) * Math.sin(lon * RAD);
  const uy = Math.sin(lat * RAD);
  const uz = Math.cos(lat * RAD) * Math.cos(lon * RAD);
  const k = 1 / Math.hypot(ux / s[0], uy / s[1], uz / s[2]);
  const [lx, ly, lz] = [ux * k, uy * k, uz * k];
  const r = view.radius;
  const point: Vec3 = [view.centre[0] + r * (e[0] * lx + p[0] * ly + m[0] * lz), view.centre[1] + r * (e[1] * lx + p[1] * ly + m[1] * lz), view.centre[2] + r * (e[2] * lx + p[2] * ly + m[2] * lz)];
  const [nx, ny, nz] = [lx / (s[0] * s[0]), ly / (s[1] * s[1]), lz / (s[2] * s[2])];
  const n: Vec3 = [e[0] * nx + p[0] * ny + m[0] * nz, e[1] * nx + p[1] * ny + m[1] * nz, e[2] * nx + p[2] * ny + m[2] * nz];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return { point, normal: [n[0] / len, n[1] / len, n[2] / len] };
}

/**
 * One mark to lay over the view: the place, its layer, and where it is in CSS pixels from the view's top left.
 *
 * @example
 * ```ts
 * import type { PlaceMark } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const mark: Pick<PlaceMark, "layer" | "x" | "y"> = { layer: "landing", x: 120, y: 80 };
 * console.log(mark.layer);
 * ```
 */
export interface PlaceMark {
  place: Place;
  layer: PlaceLayer;
  x: number;
  y: number;
  /** 1 facing the camera, falling to 0 at the limb. Set on a name. */
  fade?: number;
  /** The name is written, not only a dot. */
  label?: boolean;
  /** A name only: no layer the page asked for calls for this place, so it is not one of the places shown (`placesShown`). */
  nameOnly?: boolean;
}

/**
 * The rules that keep the marks quiet, in CSS pixels: nothing is marked on a body under `fromPx` of radius on the screen; a named feature is marked once it is `featureFromPx` across (a famous one at any size);
 * no two marks are closer than `gapPx` (the one chosen first keeps its place); and a body gets one mark for every `sharePx` of its radius, 8 at least and `most` at most.
 *
 * Written names (not dots) keep to a smaller rule: none below `nameFromPx` of radius, fading in over the next `nameFadePx`, at most one for every `namePerPx` of radius, and never one wider than the disc.
 *
 * @example
 * ```ts
 * import { MARK_RULES } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(MARK_RULES.gapPx, MARK_RULES.most);
 * ```
 */
export const MARK_RULES = { fromPx: 40, featureFromPx: 14, gapPx: 12, sharePx: 4, most: 60, nameFromPx: 70, nameFadePx: 20, namePerPx: 20 } as const;

/**
 * The marks to lay over a body: the places of the layers asked for that face the viewer (not too near the edge of the disc, where they would crowd), are inside the view, and are not crowded out by a mark
 * that comes first. The visited sites come first, the famous before the rest, then the named features by size, and a feature is marked only once it is big enough on the screen to show (`MARK_RULES`;
 * any famous one). Nothing is marked on a body too small on the screen, and a small body gets fewer marks than a big one.
 *
 * @param places - The body's list.
 * @param layers - The layers to show.
 * @param view - The body as drawn.
 * @param radiusKm - The body's radius in kilometres, to tell a feature's size on the screen.
 * @param options - `limit` caps how many marks, `gapPx` is how far apart they stay, and `label` writes the name, `avoid` lists boxes a name keeps clear of (dots, other names) `lang` is the language the name is written in, and `nudge` lets a name move a little off its place (by up to 24 pixels) to find room. All may be left out.
 * @returns The marks, in the order they were chosen.
 *
 * @example
 * ```ts
 * import { placeMarks } from "@johnmorrisdotca/wakusei-planets/places";
 * import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
 *
 * const view = { centre: [0, 0, 0] as [number, number, number], radius: 1, pole: [0, 1, 0] as [number, number, number], meridian: [0, 0, 1] as [number, number, number], scale: [1, 1, 1] as [number, number, number], toward: [0, 0, 1] as [number, number, number],
 *   project: (p: [number, number, number]) => ({ x: 200 + p[0] * 180, y: 200 - p[1] * 180 }), width: 400, height: 400, radiusPx: 180 };
 * console.log(placeMarks(PLACES_MOON, ["landing"], view, 1737.4).slice(0, 3).map((mark) => mark.place.name.en));
 * ```
 */
export function placeMarks(places: readonly Place[], layers: readonly PlaceLayer[], view: SurfaceView, radiusKm: number, options?: { limit?: number; gapPx?: number; label?: boolean; avoid?: readonly Obstacle[]; lang?: "en" | "ja"; nudge?: boolean }): PlaceMark[] {
  if (layers.length === 0 || !(view.radiusPx >= MARK_RULES.fromPx)) return [];
  // a written name takes room: none on a small disc, a few on a middling one, and they come in gently
  if (options?.label === true && !(view.radiusPx >= MARK_RULES.nameFromPx)) return [];
  const come = options?.label === true ? Math.min(1, (view.radiusPx - MARK_RULES.nameFromPx) / MARK_RULES.nameFadePx) : 1;
  const wanted: Place[] = [];
  for (const place of places) {
    const layer = layerOf(place.kind);
    if (!layers.includes(layer)) continue;
    if (layer === "feature" && place.famous !== true && ((place.feature?.diameterKm ?? 0) / radiusKm) * view.radiusPx < MARK_RULES.featureFromPx) continue;
    wanted.push(place);
  }
  if (options?.label === true) wanted.sort((a, b) => placeRank(a) - placeRank(b));
  else {
    const rank = (place: Place): number => (place.kind === "feature" ? 2 : 0) + (place.famous === true ? 0 : 1);
    wanted.sort((a, b) => rank(a) - rank(b) || (b.feature?.diameterKm ?? 0) - (a.feature?.diameterKm ?? 0));
  }
  const most = Math.max(8, Math.min(MARK_RULES.most, Math.round(view.radiusPx / MARK_RULES.sharePx)));
  const cap = Math.min(options?.limit === undefined ? most : Math.max(0, Math.min(MARK_RULES.most, options.limit)), options?.label === true ? Math.floor(view.radiusPx / MARK_RULES.namePerPx) : Infinity);
  const gap = options?.gapPx ?? MARK_RULES.gapPx;
  const out: PlaceMark[] = [];
  for (const place of wanted) {
    if (out.length >= cap) break;
    const { point, normal } = surfacePoint(view, place.lat, place.lon);
    const sight: Vec3 = view.eye !== undefined ? [view.eye[0] - point[0], view.eye[1] - point[1], view.eye[2] - point[2]] : (view.toward ?? [0, 0, 1]);
    const len = Math.hypot(sight[0], sight[1], sight[2]) || 1;
    const face = dot(normal, sight) / len;
    // a little short of the limb: a mark seen edge-on is a crowd of dots on the rim, and the surface there is a sliver
    if (face < 0.12) continue;
    const at = view.project(point);
    if (at === null || at.x < 0 || at.y < 0 || at.x > view.width || at.y > view.height) continue;
    let x = at.x;
    let y = at.y;
    if (options?.label === true) {
      const lang = options.lang ?? "en";
      const mine = { ...nameBox(place.name[lang]), id: place.id };
      // never wider than the disc it is written on
      if (mine.halfWidth > view.radiusPx) continue;
      const clash = (px: number, py: number): boolean => {
        const box: Obstacle = { x: px, y: py, ...mine };
        if (px - mine.halfWidth < 0 || px + mine.halfWidth > view.width || py - mine.halfHeight < 0 || py + mine.halfHeight > view.height) return true;
        if ((options.avoid ?? []).some((one) => one.id !== place.id && touches(box, one))) return true;
        return out.some((mark) => mark.label === true && touches(box, { x: mark.x, y: mark.y, ...nameBox(mark.place.name[lang]) }));
      };
      // a name stays on its feature unless it may nudge: it moves a little up, down or aside to find room, and gives way if there is none. A name that stands in for a dot the page asked for does not nudge: its mark is where the place is.
      let spot: { x: number; y: number } | undefined;
      for (const [dx, dy] of options.nudge === true ? ([[0, 0], [0, -10], [0, 10], [0, -18], [0, 18], [-24, 0], [24, 0]] as const) : ([[0, 0]] as const)) {
        if (!clash(x + dx, y + dy)) {
          spot = { x: x + dx, y: y + dy };
          break;
        }
      }
      if (spot === undefined) continue;
      x = spot.x;
      y = spot.y;
    }
    if (x < 0 || y < 0 || x > view.width || y > view.height) continue;
    if (options?.label !== true && out.some((mark) => Math.hypot(mark.x - x, mark.y - y) < gap)) continue;
    out.push({ place, layer: layerOf(place.kind), x, y, ...(options?.label === true ? { label: true, fade: Math.min(1, (face - 0.12) / 0.4) * come } : {}) });
  }
  return out;
}

/**
 * A box on the screen, by its centre and half sizes in pixels, that a written name keeps clear of: another dot, a craft's dot, another name. `id` is the place it belongs to, which a name of that place may cover.
 *
 * @example
 * ```ts
 * import type { Obstacle } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const craftDot: Obstacle = { x: 400, y: 300, halfWidth: 8, halfHeight: 8 };
 * console.log(craftDot.halfWidth * 2);
 * ```
 */
export interface Obstacle {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
  id?: string;
}

/** The half sizes of a written name's box, from its length (the names are 12 pixels, semibold). */
const nameBox = (text: string): { halfWidth: number; halfHeight: number } => ({ halfWidth: Math.ceil(text.length * 3.7) + 5, halfHeight: 9 });
const touches = (a: Obstacle, b: Obstacle): boolean => Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth && Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight;

/**
 * How important a place is for a name on the surface. Lower is more important. A body's hand-ranked head comes first (on the Moon the four great seas, Tycho and Copernicus; on Mars Olympus Mons, Valles Marineris, Hellas, the Tharsis volcanoes and Gale). Then fame: a famous place ranks ahead of every place that is not. Within each group a larger feature ranks ahead of a smaller one (its diameter in kilometres is taken off the rank). A place with no size ranks last in its group.
 *
 * @param place - One place.
 * @returns The rank.
 *
 * @example
 * ```ts
 * import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
 * import { placeRank } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const tycho = PLACES_MOON.find((place) => place.id === "moon/tycho")!;
 * const small = PLACES_MOON.find((place) => place.kind === "feature" && place.famous !== true)!;
 * console.log(placeRank(tycho) < placeRank(small));
 * ```
 */
export function placeRank(place: Place): number {
  // a hand-ranked head for a body: the places every reader knows come first, in this order (the largest seas with the two best-known craters on the Moon; the great volcanoes and canyon on Mars)
  const head = NAME_HEAD[place.id.slice(0, place.id.indexOf("/"))];
  const at = head === undefined ? -1 : head.indexOf(place.id);
  if (at >= 0) return -2_000_000 + at;
  const size = Math.min(1_000_000, place.feature?.diameterKm ?? 0);
  return (place.famous === true ? 0 : 1_000_000) - size;
}

/** The first names of a body, in order, ahead of the rule of fame and size: what a reader would name first. */
const NAME_HEAD: Readonly<Record<string, readonly string[]>> = {
  moon: ["moon/mare-imbrium", "moon/mare-tranquillitatis", "moon/oceanus-procellarum", "moon/mare-serenitatis", "moon/tycho", "moon/copernicus"],
  mars: ["mars/olympus-mons", "mars/valles-marineris", "mars/hellas-planitia", "mars/arsia-mons", "mars/ascraeus-mons", "mars/pavonis-mons", "mars/gale"],
};

/**
 * Read the `surface-names` attribute. Omitted, empty or `on` is on, with the view's own cap. `off` or `0` is off. A positive whole number is on and is the most names to show.
 *
 * @param value - The attribute's value, or null when it is omitted.
 * @returns Whether names are on, and `limit`: the most names, or null when the attribute sets no number.
 *
 * @example
 * ```ts
 * import { readSurfaceNames } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(readSurfaceNames(null).on, readSurfaceNames("8").limit, readSurfaceNames("off").on);
 * ```
 */
export function readSurfaceNames(value: string | null): { on: boolean; limit: number | null } {
  if (value === null || value === "" || value === "on") return { on: true, limit: null };
  if (value === "off" || value === "0") return { on: false, limit: null };
  const n = Number(value);
  if (Number.isInteger(n) && n > 0 && n <= 60) return { on: true, limit: n };
  return { on: true, limit: null };
}

/**
 * The marks to lay for the places a page asked for and, when names are on, the most important features written as names. A name keeps its place ahead of a dot on the same feature. Names use a wider gap so the words do not crowd, and they fade toward the limb.
 *
 * @param places - The body's list.
 * @param layers - The layers asked for, possibly none.
 * @param view - The body as drawn.
 * @param radiusKm - The body's radius in kilometres.
 * @param names - From `readSurfaceNames`.
 * @param keepClear - Boxes on the screen the names stay off: other bodies' dots, craft, other names. May be left out.
 * @param lang - The language the names are written in, to tell how wide each is. English when left out.
 * @returns The marks.
 *
 * @example
 * ```ts
 * import { marksToShow, readSurfaceNames } from "@johnmorrisdotca/wakusei-planets/places";
 * import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
 *
 * const view = { centre: [0, 0, 0] as [number, number, number], radius: 1, pole: [0, 1, 0] as [number, number, number], meridian: [0, 0, 1] as [number, number, number], scale: [1, 1, 1] as [number, number, number], toward: [0, 0, 1] as [number, number, number],
 *   project: (p: [number, number, number]) => ({ x: 200 + p[0] * 180, y: 200 - p[1] * 180 }), width: 400, height: 400, radiusPx: 180 };
 * console.log(marksToShow(PLACES_MOON, [], view, 1737.4, readSurfaceNames(null)).some((mark) => mark.place.id === "moon/tycho"));
 * ```
 */
export function marksToShow(places: readonly Place[], layers: readonly PlaceLayer[], view: SurfaceView, radiusKm: number, names: { on: boolean; limit: number | null }, keepClear: readonly Obstacle[] = [], lang: "en" | "ja" = "en"): PlaceMark[] {
  const asked = layers.length === 0 ? [] : placeMarks(places, layers, view, radiusKm);
  // a mark the page drew always wins over a name: a name keeps off every dot that stays, and off what the page itself draws over the body
  const avoid: Obstacle[] = [...keepClear, ...asked.map((mark) => ({ x: mark.x, y: mark.y, halfWidth: 12, halfHeight: 12, id: mark.place.id }))];
  const named = names.on ? placeMarks(places, ["feature"], view, radiusKm, { ...(names.limit === null ? {} : { limit: names.limit }), gapPx: 48, label: true, avoid, lang, nudge: !layers.includes("feature") }) : [];
  const ids = new Set(named.map((mark) => mark.place.id));
  const wanted = new Set(asked.map((mark) => mark.place.id));
  return [...named.map((mark) => (wanted.has(mark.place.id) || layers.includes("feature") ? mark : { ...mark, nameOnly: true })), ...asked.filter((mark) => !ids.has(mark.place.id))];
}

/**
 * The turn of a body that brings a place to the middle of the disc, for a view that is turned by a yaw about the body's pole and then a tilt about the screen's x axis, looking along -z (the `<wakusei-body>` view):
 * the yaw and the tilt in degrees. Where the pole is tipped so far that no yaw puts the place in the plane the tilt turns, it comes as near as it can.
 *
 * @param pole - The body's north pole in the view before the turn.
 * @param meridian - Its longitude 0 on the equator.
 * @param lat - The place's latitude, degrees.
 * @param lon - Its east longitude, degrees.
 * @returns `{ yaw, tilt }`: the yaw about the pole, and the turn about the x axis (positive brings the place's y down to the middle).
 *
 * @example
 * ```ts
 * import { turnToPlace } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const turn = turnToPlace([0, 1, 0], [0, 0, 1], 0, 90);
 * console.log(turn.yaw.toFixed(0), turn.tilt.toFixed(0));
 * ```
 */
export function turnToPlace(pole: Vec3, meridian: Vec3, lat: number, lon: number): { yaw: number; tilt: number } {
  const e: Vec3 = [pole[1] * meridian[2] - pole[2] * meridian[1], pole[2] * meridian[0] - pole[0] * meridian[2], pole[0] * meridian[1] - pole[1] * meridian[0]];
  const c = Math.cos(lat * RAD);
  const d: Vec3 = [0, 1, 2].map((i) => c * Math.cos(lon * RAD) * meridian[i]! + c * Math.sin(lon * RAD) * e[i]! + Math.sin(lat * RAD) * pole[i]!) as unknown as Vec3;
  // turning d about the pole by `yaw` (Rodrigues): x = A cos + B sin + C. Choose the yaw that makes x zero and leaves the place on the near side.
  const pd = dot(pole, d);
  const A = d[0] - pole[0] * pd;
  const B = pole[1] * d[2] - pole[2] * d[1];
  const C = pole[0] * pd;
  const R = Math.hypot(A, B) || 1e-12;
  const phi = Math.atan2(B, A);
  const spread = Math.acos(Math.max(-1, Math.min(1, -C / R)));
  const turned = (yaw: number): Vec3 => {
    const cs = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const k = pole;
    const kv: Vec3 = [k[1] * d[2] - k[2] * d[1], k[2] * d[0] - k[0] * d[2], k[0] * d[1] - k[1] * d[0]];
    return [d[0] * cs + kv[0] * sn + k[0] * pd * (1 - cs), d[1] * cs + kv[1] * sn + k[1] * pd * (1 - cs), d[2] * cs + kv[2] * sn + k[2] * pd * (1 - cs)];
  };
  const a = turned(phi + spread);
  const b = turned(phi - spread);
  const [yaw, d1] = a[2] >= b[2] ? [phi + spread, a] : [phi - spread, b];
  const tilt = Math.atan2(d1[1], d1[2]);
  const wrap = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;
  return { yaw: wrap(yaw / RAD), tilt: tilt / RAD };
}

/**
 * A point of a body's surface as one picture shows it: where it falls (CSS pixels in the view), which way straight up from the ground there points on the screen (`upX`, `upY`: a direction whose length is how much of an upright
 * stick the reader sees, 0 looking straight down on it and 1 seeing it side on) and `facing`, the cosine between the ground's upright and the way to the camera (above 0 it faces the reader, at or below it is on the far side).
 * The shape is chikyu-earth's `SurfacePoint`, so its `layoutPlaces` reads it as it is.
 *
 * @example
 * ```ts
 * import type { SurfaceSpot } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const middle: SurfaceSpot = { x: 160, y: 160, upX: 0, upY: 0, facing: 1 };
 * console.log(middle.facing);
 * ```
 */
export interface SurfaceSpot {
  x: number;
  y: number;
  upX: number;
  upY: number;
  facing: number;
}

/**
 * A picture of a body for places to be laid on by someone else's layout: its size and a way to find a point of its surface in it. The shape is chikyu-earth's `PlaceView`.
 *
 * @example
 * ```ts
 * import type { SpotView } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const view: SpotView = { width: 320, height: 320, radius: 100, at: (lon, lat, out) => ((out.x = 160 + lon), (out.y = 160 - lat), (out.upX = 0), (out.upY = 0), (out.facing = 1), true) };
 * console.log(view.width);
 * ```
 */
export interface SpotView {
  width: number;
  height: number;
  /** The body's radius in the picture, in CSS pixels. */
  radius: number;
  /** Find a longitude and latitude in the picture, writing it to `out`; false when it cannot be drawn. */
  at(lon: number, lat: number, out: SurfaceSpot): boolean;
}

/**
 * A body as a view draws it, made into a picture places can be laid on: for each longitude and latitude, where it falls, which way is up from the ground there and whether it faces the reader. Works with the
 * perspective of the camera (`eye`) or without it (`toward`), on the body's own ellipsoid, so a tipped, turned or flattened body is right. A point the projection cannot place gives `false`.
 *
 * @param view - The body as drawn.
 * @returns The picture, for a layout such as chikyu-earth's `layoutPlaces`.
 *
 * @example
 * ```ts
 * import { spotView } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * const view = spotView({ centre: [0, 0, 0], radius: 1, pole: [0, 1, 0], meridian: [0, 0, 1], scale: [1, 1, 1], toward: [0, 0, 1], project: (p) => ({ x: 160 + p[0] * 100, y: 160 - p[1] * 100 }), width: 320, height: 320, radiusPx: 100 });
 * const spot = { x: 0, y: 0, upX: 0, upY: 0, facing: 0 };
 * view.at(0, 0, spot);
 * console.log(Math.round(spot.x), Math.round(spot.y), spot.facing);
 * ```
 */
export function spotView(view: SurfaceView): SpotView {
  return {
    width: view.width,
    height: view.height,
    radius: view.radiusPx,
    at(lon, lat, out) {
      const { point, normal } = surfacePoint(view, lat, lon);
      const sight: Vec3 = view.eye !== undefined ? [view.eye[0] - point[0], view.eye[1] - point[1], view.eye[2] - point[2]] : (view.toward ?? [0, 0, 1]);
      const facing = dot(normal, sight) / (Math.hypot(sight[0], sight[1], sight[2]) || 1);
      const foot = view.project(point);
      if (foot === null) return false;
      // the upright is found by projecting a point a little way out along the normal: its direction on the screen, its length how much of the stick is seen side on
      const reach = view.radius * 0.05;
      const top = view.project([point[0] + normal[0] * reach, point[1] + normal[1] * reach, point[2] + normal[2] * reach]);
      const dx = top === null ? 0 : top.x - foot.x;
      const dy = top === null ? 0 : top.y - foot.y;
      const length = Math.hypot(dx, dy);
      const side = Math.sqrt(Math.max(0, 1 - facing * facing));
      out.x = foot.x;
      out.y = foot.y;
      out.upX = length > 1e-6 ? (dx / length) * side : 0;
      out.upY = length > 1e-6 ? (dy / length) * side : 0;
      out.facing = facing;
      return true;
    },
  };
}

/**
 * The longitude and latitude, in degrees, of the point of a body's surface that lies in a direction from its centre in the scene (the Sun's, for the `sun` of a layout that dims the night), from the body's axes.
 *
 * @param direction - The direction from the body's centre, in the scene.
 * @param pole - The body's north pole.
 * @param meridian - Its longitude 0 on the equator.
 * @returns The point, `{ lon, lat }`.
 *
 * @example
 * ```ts
 * import { pointUnder } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * console.log(pointUnder([1, 0, 0], [0, 1, 0], [0, 0, 1])); // longitude 90 east on the equator
 * ```
 */
export function pointUnder(direction: Vec3, pole: Vec3, meridian: Vec3): { lon: number; lat: number } {
  const east: Vec3 = [pole[1] * meridian[2] - pole[2] * meridian[1], pole[2] * meridian[0] - pole[0] * meridian[2], pole[0] * meridian[1] - pole[1] * meridian[0]];
  const len = Math.hypot(direction[0], direction[1], direction[2]) || 1;
  const s: Vec3 = [direction[0] / len, direction[1] / len, direction[2] / len];
  return { lon: Math.atan2(dot(s, east), dot(s, meridian)) / RAD, lat: Math.asin(Math.max(-1, Math.min(1, dot(s, pole)))) / RAD };
}
