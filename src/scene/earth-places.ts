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
}

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
 * @returns The layer.
 */
export function createEarthPlaceLayer(root: ShadowRoot): EarthPlaceLayerView {
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

  return {
    set(places, layout, look) {
      const named = new Map(layout.labels.map((spot) => [spot.index, spot]));
      shown = [];
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
        const stick = look !== "ring";
        it.stick.style.display = stick ? "" : "none";
        it.head.style.display = look === "pin" ? "" : "none";
        if (stick) {
          set(it.stick, "x2", n(shape.tipX - shape.x));
          set(it.stick, "y2", n(shape.tipY - shape.y));
          set(it.stick, "stroke-width", look === "beam" ? (here ? "3" : "2") : here ? "2" : "1.5");
          set(it.stick, "stroke-opacity", look === "beam" ? "0.85" : "1");
        }
        if (look === "pin") {
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
        shown.push({ id: place.id, kind: here ? "here" : "favourite", x: shape.x, y: shape.y, named: spot !== undefined });
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
      box.remove();
      style.remove();
      pool.length = 0;
      shown = [];
    },
  };
}
