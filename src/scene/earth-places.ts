// The places laid on the Earth in `<wakusei-space>`: the reader's own place and the places they keep, each a marker standing out of the ground (a beam, a pin or a ring). The layout is chikyu-earth's, handed in by
// `@johnmorrisdotca/wakusei-planets/earth-places` (an optional peer: this file never imports it, so a page without it carries none of it). Here are the shapes and the one small layer that draws them: an SVG and a few
// names, kept from one draw to the next and only moved. Nothing here draws the 3D picture or asks for a draw.
import type { SpotView } from "../place-marks.ts";

/**
 * What a place is to the reader: `here` (where they are, drawn tall and bright) or `favourite` (a place they keep, drawn shorter and quieter).
 *
 * @example
 * ```ts
 * import type { EarthPlaceKind } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const kind: EarthPlaceKind = "here";
 * console.log(kind);
 * ```
 */
export type EarthPlaceKind = "here" | "favourite";

/**
 * One place for the `earth-places` attribute or the `earthPlaces` property of `<wakusei-space>`: the same record chikyu-earth's `places` takes.
 *
 * @example
 * ```ts
 * import type { EarthPlace } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const places: EarthPlace[] = [
 *   { id: "me", lon: -79.4, lat: 43.7, label: "You are here", kind: "here" },
 *   { id: "tokyo", lon: 139.69, lat: 35.69, label: "Tokyo" },
 * ];
 * console.log(places.length);
 * ```
 */
export interface EarthPlace {
  /** Your own unique name for it. */
  id: string;
  /** Degrees east, -180 to 180. */
  lon: number;
  /** Degrees north, -90 to 90. */
  lat: number;
  /** Shown beside the marker when there is room. */
  label?: string;
  /** `here` or `favourite` (the default). */
  kind?: EarthPlaceKind;
  /** A CSS colour for this place alone: a hex colour, `rgb()` or `hsl()` with numbers, or a colour's name. */
  color?: string;
  /** A set of places (spaceports, harbours) the page shows or hides together with `earth-place-layers`; left out, the place is always shown. */
  layer?: string;
  /** `small` draws a shorter, narrower mark; a number is the ring's radius in CSS pixels, from 1.5 to 14; left out, the kind's own size. */
  size?: EarthPlaceSize | number;
  /** How this place is drawn, over `earth-places-look`; left out, `earth-places-look`. */
  look?: EarthPlaceLook;
  /** `low` lays this place's name after the others' (and, past the 32 markers, its marker too), so its name gives way where they crowd; left out (`high`), it is laid with the rest. */
  namePriority?: EarthPlaceNamePriority;
}

/**
 * How big a place's mark is: `normal` (the default) or `small`, a shorter, narrower stick and a smaller ring, so a harbour can stand beside a city and "You are here" stays the tall beam.
 *
 * @example
 * ```ts
 * import type { EarthPlaceSize } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * const size: EarthPlaceSize = "small";
 * console.log(size);
 * ```
 */
export type EarthPlaceSize = "normal" | "small";

/**
 * Where a place's name is laid among the others: `high` (the default) in the order given, or `low`, after all the others.
 *
 * @example
 * ```ts
 * import type { EarthPlaceNamePriority } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * const priority: EarthPlaceNamePriority = "low";
 * console.log(priority);
 * ```
 */
export type EarthPlaceNamePriority = "high" | "low";

/**
 * How a place is drawn: `beam` (a light rising out of the ground with a ring at its foot, the default), `pin` (a thin stick with a round head) or `ring` (only the ring lying on the ground).
 *
 * @example
 * ```ts
 * import { EARTH_PLACE_LOOKS, type EarthPlaceLook } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * const look: EarthPlaceLook = "pin";
 * console.log(EARTH_PLACE_LOOKS.includes(look));
 * ```
 */
export type EarthPlaceLook = "beam" | "pin" | "ring";

/**
 * Every look a place can have, the default first.
 *
 * @example
 * ```ts
 * import { EARTH_PLACE_LOOKS } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * console.log(EARTH_PLACE_LOOKS.join(", "));
 * ```
 */
export const EARTH_PLACE_LOOKS: readonly EarthPlaceLook[] = ["beam", "pin", "ring"];

/**
 * The most markers the Earth carries at once: the first this many places in sight, `here` first and then in the order given. The rest are counted in `earthPlacesShown().omitted`.
 *
 * @example
 * ```ts
 * import { EARTH_PLACE_MARKS } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * console.log(EARTH_PLACE_MARKS); // 32
 * ```
 */
export const EARTH_PLACE_MARKS = 32;

/** Nothing is laid on an Earth under this many CSS pixels of radius: a marker the size of the planet is not a marker. */
export const EARTH_PLACES_FROM_PX = 40;

/** What a `small` place's stick and ring are of the kind's own. */
const SMALL_LENGTH = 0.55;
const SMALL_RING = 0.7;
/** A numeric size is the ring's radius in CSS pixels, the same limits chikyu-earth uses. */
const MIN_PLACE_RING = 1.5;
const MAX_PLACE_RING = 14;
const ringRadius = (size: number): number => Math.round(Math.max(MIN_PLACE_RING, Math.min(MAX_PLACE_RING, size)) * 10) / 10;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Where one place's marker goes: the foot on the ground, the top of the stick, the ring's turn, how flat it is and its radius, and how strongly it shows. The shape of chikyu-earth's `PlaceShape`. */
export interface EarthPlaceShape {
  /** Index into the places given. */
  index: number;
  x: number;
  y: number;
  tipX: number;
  tipY: number;
  angle: number;
  length: number;
  ringAngle: number;
  squash: number;
  ring: number;
  opacity: number;
  /** 0 by day, 1 in full night. */
  night: number;
}

/**
 * The markers and names of a set of places in one picture. The shape of chikyu-earth's `PlaceLayout`.
 *
 * @example
 * ```ts
 * import type { EarthPlaceLayout } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * const none: EarthPlaceLayout = { shapes: [], labels: [] };
 * console.log(none.shapes.length);
 * ```
 */
export interface EarthPlaceLayout {
  shapes: EarthPlaceShape[];
  labels: { index: number; left: number; top: number }[];
}

/**
 * What a layout may be told: the size of each name as it is drawn, boxes in use by other names, the most names, and where the Sun is overhead.
 *
 * @example
 * ```ts
 * import type { EarthPlaceLayoutOptions } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * const options: EarthPlaceLayoutOptions = { size: () => ({ width: 60, height: 18 }), maxLabels: 8, sun: { lon: 0, lat: 0 } };
 * console.log(options.maxLabels);
 * ```
 */
export interface EarthPlaceLayoutOptions {
  size?: (place: EarthPlace, index: number) => { width: number; height: number } | null;
  taken?: readonly { left: number; top: number; width: number; height: number }[];
  maxLabels?: number;
  sun?: { lon: number; lat: number } | null;
}

/**
 * Which layers of places are shown (the attribute `earth-place-layers`): a JSON object of layer names to true or false, such as `{"harbours":false}`. A layer that is not named is shown, and so is a place with no layer. Anything that is not an object
 * of that kind is no switches. chikyu-earth's `readPlaceLayers`.
 *
 * @param value - The attribute's text, or null.
 * @returns The switches, a name to whether it is shown.
 *
 * @example
 * ```ts
 * import { readEarthPlaceLayers } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * console.log(readEarthPlaceLayers('{"harbours":false,"airports":true,"x":1}')); // { harbours: false, airports: true }
 * ```
 */
export function readEarthPlaceLayers(value: string | null | undefined): Record<string, boolean> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isObject(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const [name, on] of Object.entries(parsed)) if (typeof on === "boolean") out[name] = on;
    return out;
  } catch {
    return {};
  }
}

/**
 * The places whose layer is shown: a place with no layer is always in, and a layer is in unless `layers` says `false` for it. A place of a layer that is off is not drawn, not named and cannot be pressed. The list is returned as it came when nothing is left out.
 *
 * @param places - The places, as `readEarthPlaces` makes them.
 * @param layers - The switches, a layer's name to whether it is shown (`readEarthPlaceLayers`).
 * @returns The places to draw.
 *
 * @example
 * ```ts
 * import { shownEarthPlaces } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * const places = [{ id: "yvr", lon: -123.18, lat: 49.19, layer: "airports" }, { id: "cavan", lon: -123.1, lat: 49.29, layer: "harbours" }, { id: "me", lon: -79.4, lat: 43.7 }];
 * console.log(shownEarthPlaces(places, { harbours: false }).map((place) => place.id)); // ["yvr", "me"]
 * ```
 */
export function shownEarthPlaces<T extends EarthPlace>(places: readonly T[], layers: Readonly<Record<string, boolean>>): readonly T[] {
  const shown = places.filter((place) => !place.layer || layers[place.layer] !== false);
  return shown.length === places.length ? places : shown;
}

/** The order the markers are given out in: where the reader is, then the rest in the order given, then the places whose name is `low`. */
export const placeRank = (place: EarthPlace): number => (place.kind === "here" ? 0 : place.namePriority === "low" ? 2 : 1);

/** The places in that order (the order given within each rank). */
export const inMarkOrder = <T extends EarthPlace>(places: readonly T[]): T[] => [0, 1, 2].flatMap((rank) => places.filter((place) => placeRank(place) === rank));

/**
 * The fields beyond chikyu-earth's own that a place may carry (`layer`, `size`, `look`, `namePriority`), put back on the places its reader (older than them) made from the same text, so the views need no newer chikyu-earth. A place is found by its `id`
 * (or, with none, its place in the list, as chikyu-earth gives it); a field that is not valid is left out.
 */
export function keepPlaceFields(value: string | null | undefined, places: EarthPlace[]): EarthPlace[] {
  let raw: unknown;
  try {
    raw = typeof value === "string" ? JSON.parse(value) : null;
  } catch {
    return places;
  }
  if (!Array.isArray(raw)) return places;
  const own = new Map<string, Partial<EarthPlace>>();
  for (const [i, item] of raw.entries()) {
    if (!isObject(item)) continue;
    const fields: Partial<EarthPlace> = {};
    if (typeof item["layer"] === "string" && item["layer"].trim()) fields.layer = item["layer"].trim().slice(0, 40);
    if (item["size"] === "small") fields.size = "small";
    else if (typeof item["size"] === "number" && Number.isFinite(item["size"])) fields.size = ringRadius(item["size"]);
    if ((EARTH_PLACE_LOOKS as readonly unknown[]).includes(item["look"])) fields.look = item["look"] as EarthPlaceLook;
    if (item["namePriority"] === "low") fields.namePriority = "low";
    if (Object.keys(fields).length > 0) own.set(typeof item["id"] === "string" && item["id"] ? item["id"] : String(i), fields);
  }
  return own.size === 0 ? places : places.map((place) => (own.has(place.id) ? { ...place, ...own.get(place.id) } : place));
}

/**
 * A layout that gives each place its own `size` and `look`: the places' markers are laid as beams (chikyu-earth knows one look for a whole list), then a `small` place's stick is cut to about half and its ring to 70 per cent, and a place whose look is `ring`
 * (its own or the list's) has no stick, its name moving with the top of what is left. A list with no `size` or `look` of its own is laid as `layout` lays it, untouched.
 */
export function layWithOwn(layout: EarthPlacesLayout["layout"], places: readonly EarthPlace[], view: SpotView, look: EarthPlaceLook, options?: EarthPlaceLayoutOptions): EarthPlaceLayout {
  if (!places.some((place) => place.size === "small" || typeof place.size === "number" || place.look !== undefined)) return layout(places, view, look, options);
  const plain = places.map((place) => {
    const one = { ...place };
    delete one.size;
    delete one.look;
    return one;
  });
  const laid = layout(plain, view, "beam", options);
  const moved = new Map<number, { dx: number; dy: number }>();
  for (const shape of laid.shapes) {
    const place = places[shape.index]!;
    const flat = (place.look ?? look) === "ring";
    const small = place.size === "small";
    const keep = flat ? 0 : small ? SMALL_LENGTH : 1;
    if (typeof place.size === "number") shape.ring = ringRadius(place.size);
    if (keep === 1) continue;
    const dx = (shape.tipX - shape.x) * (keep - 1);
    const dy = (shape.tipY - shape.y) * (keep - 1);
    shape.tipX += dx;
    shape.tipY += dy;
    shape.length *= keep;
    if (small) shape.ring *= SMALL_RING;
    moved.set(shape.index, { dx, dy });
  }
  for (const spot of laid.labels) {
    const by = moved.get(spot.index);
    if (by !== undefined) {
      spot.left += by.dx;
      spot.top += by.dy;
    }
  }
  return laid;
}

/** The two things `@johnmorrisdotca/wakusei-planets/earth-places` hands the views: reading the attribute, and laying places on a picture. Both are chikyu-earth's. */
export interface EarthPlacesLayout {
  read(value: string | null | undefined): EarthPlace[];
  layout(places: readonly EarthPlace[], view: SpotView, look: EarthPlaceLook, options?: EarthPlaceLayoutOptions): EarthPlaceLayout;
}

// on globalThis, so the separate copies a CDN can load share the one layout
const SLOT = Symbol.for("@johnmorrisdotca/wakusei-planets/earth-places");
interface Slot {
  using?: EarthPlacesLayout;
  heard: Set<() => void>;
}
const slot = ((globalThis as Record<symbol, Slot | undefined>)[SLOT] ??= { heard: new Set() });

/** Give the views the layout of places (what importing `@johnmorrisdotca/wakusei-planets/earth-places` does). Views already on the page lay their places at once. */
export function setEarthPlacesLayout(using: EarthPlacesLayout): void {
  slot.using = using;
  for (const heard of slot.heard) heard();
}

/** The layout `setEarthPlacesLayout` was given, if any. */
export const earthPlacesLayout = (): EarthPlacesLayout | undefined => slot.using;

/** Hear `setEarthPlacesLayout`; returns the call that stops it. */
export function onEarthPlacesLayout(heard: () => void): () => void {
  slot.heard.add(heard);
  return () => slot.heard.delete(heard);
}

/** The look an attribute asks for: `beam`, `pin` or `ring`; anything else is `beam`. */
export const readEarthPlaceLook = (value: string | null): EarthPlaceLook => (EARTH_PLACE_LOOKS as readonly string[]).includes(value ?? "") ? (value as EarthPlaceLook) : "beam";

const SVG = "http://www.w3.org/2000/svg";
const STYLE = `.wk-eplaces{position:absolute;inset:0;pointer-events:none;overflow:hidden;--wk-here:var(--wakusei-place-here,#ffd34d);--wk-fav:var(--wakusei-place-favourite,#7fd6ff)}
.wk-eplaces svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.wk-eplace{color:var(--wk-fav)}
.wk-eplace[data-kind=here]{color:var(--wk-here)}
.wk-eplace line,.wk-eplace ellipse,.wk-eplace circle{vector-effect:non-scaling-stroke}
.wk-eplace-name{position:absolute;left:0;top:0;padding:0 5px;box-sizing:border-box;border-radius:4px;background:rgba(10,14,22,.78);color:#fff;font:12px/18px var(--wakusei-place-font,system-ui,-apple-system,sans-serif);white-space:nowrap;height:18px}
.wk-eplace-name[data-kind=here]{font-weight:600}`;

/**
 * What the layer drew at the last layout, for one place: its id, its kind, where its foot is (CSS pixels from the view's top left) and whether its name was drawn.
 *
 * @example
 * ```ts
 * import type { EarthPlaceMark } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const mark: EarthPlaceMark = { id: "me", kind: "here", x: 210, y: 210, named: true };
 * console.log(mark.named);
 * ```
 */
export interface EarthPlaceMark {
  id: string;
  kind: EarthPlaceKind;
  x: number;
  y: number;
  named: boolean;
  /** For a place on a body other than the Earth (`body-places`): the body. */
  body?: string;
}

/**
 * What `wakusei-place-click` carries in `event.detail`: the place that was pressed (chikyu-earth's `chikyu-place-click` detail, with the `body` it is on, `earth` for the Earth's), and where the press was, in CSS pixels inside the element's box.
 *
 * @example
 * ```ts
 * import type { EarthPlaceClickDetail } from "@johnmorrisdotca/wakusei-planets/earth-places";
 *
 * const on = (event: Event): void => {
 *   const { body, id, kind, layer } = (event as CustomEvent<EarthPlaceClickDetail>).detail;
 *   console.log(body, id, kind, layer ?? "no layer");
 * };
 * console.log(typeof on);
 * ```
 */
export interface EarthPlaceClickDetail {
  /** The body the place is on: `earth`, `moon`, `mars` and so on. */
  body: string;
  id: string;
  /** `here` or `favourite`. */
  kind: EarthPlaceKind;
  /** The place's `layer`, when it has one. */
  layer?: string;
  label?: string;
  lon: number;
  lat: number;
  /** Where the press was, in CSS pixels inside the element's box. */
  x: number;
  y: number;
}

/** The detail of `wakusei-place-click` for a pressed place. */
export function earthPlaceClick(body: string, place: EarthPlace, x: number, y: number): EarthPlaceClickDetail {
  const detail: EarthPlaceClickDetail = { body, id: place.id, kind: place.kind === "here" ? "here" : "favourite", lon: place.lon, lat: place.lat, x, y };
  if (place.layer) detail.layer = place.layer;
  if (place.label) detail.label = place.label;
  return detail;
}

/** The markers over one view. */
export interface EarthPlaceLayerView {
  /** Draw the markers of a layout, moving the ones already there and hiding the rest. */
  set(places: readonly EarthPlace[], layout: EarthPlaceLayout, look: EarthPlaceLook): void;
  /** Hide every marker. */
  clear(): void;
  /** How wide a name is when drawn, in CSS pixels, in the font the layer's CSS gives it (padding included). */
  width(text: string): number;
  readonly shown: readonly EarthPlaceMark[];
  dispose(): void;
}

interface Item {
  g: SVGGElement;
  stick: SVGLineElement;
  ring: SVGEllipseElement;
  head: SVGCircleElement;
  name: HTMLSpanElement;
}

/**
 * Make the layer of markers inside a view's shadow root, above its picture. It holds a handful of elements made once and kept; a draw only writes the numbers that changed.
 *
 * @param root - The view's shadow root.
 * @param options - `press`, called with the mark, the pointer event and the place when a press that did not move ends over a drawn name or a foot ring (the layer itself takes no pointer: a press on it goes on to the view's controls, as a name on a body's surface does).
 * @returns The layer.
 */
export function createEarthPlaceLayer(root: ShadowRoot, options: { press?: (mark: EarthPlaceMark, event: PointerEvent, place: EarthPlace) => void } = {}): EarthPlaceLayerView {
  const style = document.createElement("style");
  style.textContent = STYLE;
  const box = document.createElement("div");
  box.className = "wk-eplaces";
  box.setAttribute("part", "earth-places");
  box.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(SVG, "svg");
  box.append(svg);
  root.append(style, box);
  // a name that is never shown, only to read the font the CSS gives a name; names are measured with it once and kept
  const probe = document.createElement("span");
  probe.className = "wk-eplace-name";
  probe.hidden = true;
  box.append(probe);
  const widths = new Map<string, number>();
  let context: CanvasRenderingContext2D | null | undefined;
  const pool: Item[] = [];
  let shown: EarthPlaceMark[] = [];
  // what is on the screen to press: each drawn mark with its parts and how strongly it shows
  let live: { mark: EarthPlaceMark; place: EarthPlace; it: Item; opacity: number }[] = [];

  const item = (i: number): Item => {
    let it = pool[i];
    if (it === undefined) {
      const g = document.createElementNS(SVG, "g");
      g.setAttribute("class", "wk-eplace");
      const stick = document.createElementNS(SVG, "line");
      stick.setAttribute("stroke", "currentColor");
      stick.setAttribute("stroke-linecap", "round");
      const ring = document.createElementNS(SVG, "ellipse");
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", "currentColor");
      const head = document.createElementNS(SVG, "circle");
      head.setAttribute("fill", "currentColor");
      g.append(stick, ring, head);
      svg.append(g);
      const name = document.createElement("span");
      name.className = "wk-eplace-name";
      box.append(name);
      it = { g, stick, ring, head, name };
      pool[i] = it;
    }
    return it;
  };
  const set = (el: Element, name: string, value: string): void => {
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  };
  const n = (value: number): string => String(Math.round(value * 10) / 10);

  // press: the layer takes no pointer (a press on it goes on to the view's controls, which turn the view), so a press that did not move and ends over a drawn name or a foot ring is the mark's, found here as the marks of
  // a body's surface find a written name. The nearest of the marks whose name's box or ring's box holds the point wins; a mark that is fading out (under a fifth of its strength) cannot be pressed.
  const host = root.host;
  let pressed: { x: number; y: number; id: number } | null = null;
  const down = (event: PointerEvent): void => {
    pressed = event.button === 0 && event.composedPath().includes(host) ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
  };
  const up = (event: PointerEvent): void => {
    const start = pressed;
    pressed = null;
    if (start === null || start.id !== event.pointerId || live.length === 0 || options.press === undefined || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    let best: { mark: EarthPlaceMark; place: EarthPlace; away: number } | undefined;
    for (const entry of live) {
      if (entry.opacity < 0.2) continue;
      for (const part of [entry.it.name.hidden ? null : entry.it.name, entry.it.ring.style.display === "none" ? null : entry.it.ring]) {
        if (part === null) continue;
        const r = part.getBoundingClientRect();
        const pad = part === entry.it.name ? 0 : 6;
        if (event.clientX < r.left - pad || event.clientX > r.right + pad || event.clientY < r.top - pad || event.clientY > r.bottom + pad) continue;
        const away = Math.hypot(event.clientX - (r.left + r.right) / 2, event.clientY - (r.top + r.bottom) / 2);
        if (best === undefined || away < best.away) best = { mark: entry.mark, place: entry.place, away };
      }
    }
    if (best !== undefined) options.press(best.mark, event, best.place);
  };
  const cancel = (): void => {
    pressed = null;
  };
  if (options.press !== undefined) {
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
  }

  return {
    set(places, layout, look) {
      const named = new Map(layout.labels.map((spot) => [spot.index, spot]));
      shown = [];
      live = [];
      for (const [i, shape] of layout.shapes.entries()) {
        const place = places[shape.index]!;
        const it = item(i);
        const here = place.kind === "here";
        const dim = 1 - 0.5 * shape.night;
        set(it.g, "data-kind", here ? "here" : "favourite");
        if (place.color !== undefined) it.g.style.color = place.color;
        else if (it.g.style.color !== "") it.g.style.color = "";
        it.g.style.display = "";
        it.g.setAttribute("opacity", n(shape.opacity * dim));
        it.g.setAttribute("transform", `translate(${n(shape.x)} ${n(shape.y)})`);
        set(it.ring, "rx", n(shape.ring));
        set(it.ring, "ry", n(shape.ring * shape.squash));
        set(it.ring, "transform", `rotate(${n(shape.ringAngle)})`);
        set(it.ring, "stroke-width", here ? "2" : "1.5");
        const own = place.look ?? look;
        const stick = own !== "ring";
        it.stick.style.display = stick ? "" : "none";
        it.head.style.display = own === "pin" ? "" : "none";
        if (stick) {
          set(it.stick, "x2", n(shape.tipX - shape.x));
          set(it.stick, "y2", n(shape.tipY - shape.y));
          set(it.stick, "stroke-width", own === "beam" ? (here ? "3" : "2") : here ? "2" : "1.5");
          set(it.stick, "stroke-opacity", own === "beam" ? "0.85" : "1");
        }
        if (own === "pin") {
          set(it.head, "cx", n(shape.tipX - shape.x));
          set(it.head, "cy", n(shape.tipY - shape.y));
          set(it.head, "r", here ? "5" : "3.5");
        }
        const spot = named.get(shape.index);
        if (spot !== undefined) {
          it.name.hidden = false;
          if (it.name.textContent !== place.label) it.name.textContent = place.label ?? "";
          set(it.name, "data-kind", here ? "here" : "favourite");
          it.name.style.opacity = n(shape.opacity * (1 - 0.3 * shape.night));
          it.name.style.transform = `translate(${n(spot.left)}px,${n(spot.top)}px)`;
        } else it.name.hidden = true;
        const mark: EarthPlaceMark = { id: place.id, kind: here ? "here" : "favourite", x: shape.x, y: shape.y, named: spot !== undefined };
        const body = (place as { body?: string }).body;
        if (body !== undefined) mark.body = body;
        shown.push(mark);
        live.push({ mark, place, it, opacity: shape.opacity * dim });
      }
      for (let i = layout.shapes.length; i < pool.length; i += 1) {
        const it = pool[i]!;
        it.g.style.display = "none";
        it.name.hidden = true;
      }
    },
    clear() {
      for (const it of pool) {
        it.g.style.display = "none";
        it.name.hidden = true;
      }
      shown = [];
      live = [];
    },
    width(text) {
      const known = widths.get(text);
      if (known !== undefined) return known;
      if (context === undefined) {
        context = document.createElement("canvas").getContext("2d");
        if (context !== null) context.font = getComputedStyle(probe).font;
      }
      if (widths.size > 2000) widths.clear();
      const width = Math.ceil((context?.measureText(text).width ?? text.length * 7) + 10);
      widths.set(text, width);
      return width;
    },
    get shown() {
      return shown;
    },
    dispose() {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
      box.remove();
      style.remove();
      pool.length = 0;
      shown = [];
      live = [];
    },
  };
}
