// The marks of places laid over a view (`<wakusei-body>`, `<wakusei-space>`): one small quiet button for each place `placeMarks` chose, its name in a tip on hover, focus or touch, and a pick on a click or
// Enter. The buttons are kept by the place's id from one draw to the next and only moved, so a turning body moves its marks without making them again. Nothing here draws the 3D picture or asks for a draw.
import type { Place, PlaceBody } from "../places.ts";
import type { PlaceLayer, PlaceMark } from "../place-marks.ts";
import { findLandingSite, flagCodeOf, type LandingSite } from "../landing-sites.ts";

const STYLE = `.wk-places{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.wk-place{position:absolute;left:0;top:0;width:20px;height:20px;margin:-10px 0 0 -10px;padding:0;border:0;background:none;cursor:pointer;pointer-events:auto;will-change:transform;-webkit-tap-highlight-color:transparent}
.wk-place::before{content:"";position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;box-sizing:border-box;background:var(--wakusei-place-landing,#fff);box-shadow:0 0 0 1px rgba(0,0,0,.55);opacity:.85}
.wk-place[data-layer=crash]::before{background:var(--wakusei-place-crash,#ffa070)}
.wk-place[data-layer=planned]::before{background:none;border:1.5px solid var(--wakusei-place-planned,#8fd3ff);width:8px;height:8px;margin:-4px 0 0 -4px;box-shadow:0 0 2px rgba(0,0,0,.8)}
.wk-place[data-layer=feature]::before{width:4px;height:4px;margin:-2px 0 0 -2px;background:var(--wakusei-place-feature,rgba(255,255,255,.6));box-shadow:0 0 0 1px rgba(0,0,0,.35);opacity:.75}
.wk-place:hover::before,.wk-place:focus-visible::before{opacity:1;transform:scale(1.4)}
.wk-place:focus-visible{outline:2px solid #6cd0ff;outline-offset:-3px;border-radius:50%}
.wk-place-tip{position:absolute;left:0;top:0;max-width:min(260px,80%);padding:3px 7px;border-radius:5px;background:rgba(10,14,22,.86);color:#fff;font:12px/1.35 var(--wakusei-place-font,system-ui,-apple-system,sans-serif);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;visibility:hidden}
.wk-place-tip small{display:block;font-size:11px;opacity:.8}
.wk-place[data-name]{width:auto;height:auto;margin:0;padding:0 3px;color:#fff;font:600 12px/1.2 var(--wakusei-place-font,system-ui,-apple-system,sans-serif);white-space:nowrap;text-shadow:0 1px 2px #000,0 0 3px #000;pointer-events:auto}
.wk-place[data-pure]{pointer-events:none}
.wk-place[data-name]::before{display:none}
.wk-place-tip[data-on]{visibility:visible}
.wk-place-tip .wk-place-head{display:flex;align-items:center;gap:5px}
.wk-place-flag{flex:none;height:11px;pointer-events:none}
.wk-place-flag:not(:defined){display:none}
.wk-place-site{position:absolute;top:50%;left:13px;display:flex;align-items:center;gap:4px;margin-top:-8px;color:#fff;font:600 11px/16px var(--wakusei-place-font,system-ui,-apple-system,sans-serif);white-space:nowrap;text-shadow:0 1px 2px #000,0 0 3px #000;pointer-events:none}
.wk-place-site[data-side=left]{left:auto;right:13px;flex-direction:row-reverse}`;

/** A body's radius on the screen, in CSS pixels, from which the landing sites' names are written beside their dots (when the `site-flags` attribute is on). */
export const SITE_LABEL_FROM_PX = 110;

const KIND_WORD: Record<Place["kind"], { en: string; ja: string }> = {
  crewed: { en: "crewed landing", ja: "有人着陸" },
  landing: { en: "lander", ja: "着陸機" },
  rover: { en: "rover", ja: "探査車" },
  crash: { en: "crash site", ja: "墜落地点" },
  impact: { en: "impact site", ja: "衝突地点" },
  entry: { en: "lost in the atmosphere", ja: "大気圏で消失" },
  planned: { en: "planned landing", ja: "着陸予定" },
  feature: { en: "feature", ja: "地形" },
};

/**
 * The short line under a place's name: what it is and when (a site's year, a planned landing's announced year, a feature's kind and size), in English or Japanese.
 *
 * @param place - The place.
 * @param lang - `en` or `ja`.
 * @returns The line.
 *
 * @example
 * ```ts no-run
 * import { placeLine } from "@johnmorrisdotca/wakusei-planets/element";
 *
 * console.log(placeLine({ id: "moon/x", kind: "crewed", name: { en: "X", ja: "X" }, lat: 0, lon: 0, date: "1969-07-20T20:17Z", source: { id: "nssdca", read: "2026-11-11" } }, "en"));
 * ```
 */
export function placeLine(place: Place, lang: "en" | "ja"): string {
  const ja = lang === "ja";
  if (place.kind === "feature") {
    const word = place.feature?.typeWord[lang] ?? KIND_WORD.feature[lang];
    const km = place.feature?.diameterKm ?? 0;
    return km > 0 ? `${word}${ja ? "、" : ", "}${Math.round(km).toLocaleString(ja ? "ja-JP" : "en")} km` : word;
  }
  const word = KIND_WORD[place.kind][lang];
  if (place.kind === "planned" && place.planned !== undefined) {
    const { date, dateOf } = place.planned;
    const year = date.slice(0, 4);
    return ja ? `${word} (${dateOf === "launch" ? `${year}年打ち上げ` : `${year}年`})` : `${word}, ${dateOf === "launch" ? `launch ${year}` : year}`;
  }
  const year = place.date?.slice(0, 4);
  return year === undefined ? word : ja ? `${word}、${year}年` : `${word}, ${year}`;
}

/** A flag for a country, as `<hata-flag>` (from `@johnmorrisdotca/hata`, which the page imports; where it is not defined the element draws nothing and the name stands alone). */
function flagFor(place: Place): HTMLElement | undefined {
  const code = flagCodeOf(place.country);
  if (code === undefined) return undefined;
  const flag = document.createElement("hata-flag");
  flag.className = "wk-place-flag";
  flag.setAttribute("code", code);
  flag.setAttribute("border", "");
  flag.setAttribute("aria-hidden", "true");
  return flag;
}

type PlacesLoader = (body: PlaceBody) => Promise<readonly Place[]>;
// on globalThis, so the separate copies a CDN can load share the one loader
const SLOT = Symbol.for("@johnmorrisdotca/wakusei-planets/places-loader");
interface Slot {
  load?: PlacesLoader;
  heard: Set<() => void>;
}
const slot = ((globalThis as Record<symbol, Slot | undefined>)[SLOT] ??= { heard: new Set() });

/**
 * Give the views the lists of places, for the marks of the `places` attribute: `loadPlaces` from `/places`, which fetches each body's table as a chunk of its own the first time it is asked for, or a function of your own
 * that returns a body's list. The views hold no table themselves, so a page that never marks a place never carries one; until this is called a view marks nothing. Views already on the page lay their marks at once.
 *
 * @param load - A body's list of places, for a body of `PLACE_BODIES`.
 *
 * @example
 * ```ts no-run
 * import { setPlacesLoader } from "@johnmorrisdotca/wakusei-planets/element";
 * import { loadPlaces } from "@johnmorrisdotca/wakusei-planets/places";
 *
 * setPlacesLoader(loadPlaces);
 * document.querySelector("wakusei-body")!.setAttribute("places", "landing crash");
 * ```
 */
export function setPlacesLoader(load: PlacesLoader): void {
  slot.load = load;
  for (const heard of slot.heard) heard();
}

/** The loader `setPlacesLoader` was given, if any. */
export const placesLoader = (): PlacesLoader | undefined => slot.load;

/** Hear `setPlacesLoader`; returns the call that stops it. */
export function onPlacesLoader(heard: () => void): () => void {
  slot.heard.add(heard);
  return () => slot.heard.delete(heard);
}

/** The marks over one view. */
export interface PlaceLayerView {
  /** Lay these marks, moving the ones already there, adding the new and taking away the rest. `radiusPx` is the body's radius on the screen: with flags on, the landing sites are named beside their dots from `SITE_LABEL_FROM_PX`. */
  set(marks: readonly PlaceMark[], radiusPx?: number): void;
  /** Take every mark away. */
  clear(): void;
  /** The marks laid now: the place's id, its layer and where it is, in CSS pixels. */
  readonly shown: readonly { id: string; layer: PlaceLayer; x: number; y: number }[];
  dispose(): void;
}

/**
 * Make the layer of marks inside a view's shadow root, above its picture. `pick` is called for a click or Enter on a mark, with the place and where its mark is.
 *
 * @param root - The view's shadow root.
 * @param options - `lang` reads the view's language at the time a tip is shown; `pick` hears a chosen place.
 * @returns The layer.
 */
export function createPlaceLayer(root: ShadowRoot, options: { lang(): "en" | "ja"; flags?(): boolean; pick(place: Place, site: LandingSite | undefined, at: { x: number; y: number }): void }): PlaceLayerView {
  const style = document.createElement("style");
  style.textContent = STYLE;
  const box = document.createElement("div");
  box.className = "wk-places";
  box.setAttribute("part", "places");
  const tip = document.createElement("div");
  tip.className = "wk-place-tip";
  tip.setAttribute("part", "place-tip");
  tip.setAttribute("aria-hidden", "true");
  box.append(tip);
  root.append(style, box);
  const held = new Map<string, { button: HTMLButtonElement; mark: PlaceMark; x: number; y: number; lang: string; site: LandingSite | undefined; label?: HTMLElement; labelKey?: string }>();
  let shown: { id: string; layer: PlaceLayer; x: number; y: number }[] = [];
  let tipFor: string | null = null;

  const showTip = (id: string): void => {
    const entry = held.get(id);
    if (entry === undefined) return;
    const lang = options.lang();
    const name = document.createElement("span");
    name.textContent = entry.mark.place.name[lang];
    const line = document.createElement("small");
    line.textContent = placeLine(entry.mark.place, lang);
    const flag = options.flags?.() === true ? flagFor(entry.mark.place) : undefined;
    if (flag === undefined) tip.replaceChildren(name, line);
    else {
      const head = document.createElement("div");
      head.className = "wk-place-head";
      head.append(flag, name);
      tip.replaceChildren(head, line);
    }
    tip.setAttribute("data-on", "");
    tipFor = id;
    placeTip();
  };
  // above the mark, inside the view: measured in the page's own font once its text is in
  const placeTip = (): void => {
    const entry = tipFor === null ? undefined : held.get(tipFor);
    if (entry === undefined) return;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const width = box.clientWidth;
    const x = Math.max(2, Math.min(width - w - 2, entry.x - w / 2));
    const y = entry.y - h - 10 >= 2 ? entry.y - h - 10 : entry.y + 12;
    tip.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  };
  const hideTip = (id?: string): void => {
    if (id !== undefined && tipFor !== id) return;
    tip.removeAttribute("data-on");
    tipFor = null;
  };

  const make = (mark: PlaceMark): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wk-place";
    button.setAttribute("part", "place");
    const id = mark.place.id;
    button.dataset.place = id;
    button.addEventListener("pointerenter", () => showTip(id));
    button.addEventListener("pointerleave", () => hideTip(id));
    button.addEventListener("focus", () => showTip(id));
    button.addEventListener("blur", () => hideTip(id));
    // a press on a dot is the dot's, not the start of a drag or a pick of the body under it; a touch shows the name as well. (A written name takes no press at all: see `name press` below.)
    button.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (event.pointerType !== "mouse") showTip(id);
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const entry = held.get(id);
      if (entry !== undefined) options.pick(entry.mark.place, entry.site, { x: entry.x, y: entry.y });
    });
    return button;
  };

  // name press: a written name lies over the middle of the body, where a drag starts, and the view's controls leave a press that begins on a button to the button. So a name takes no pointer (CSS) and a press goes
  // on to the controls, which turn the body; a tap that did not move, up over a name, picks its place.
  const host = root.host;
  let pressed: { x: number; y: number; id: number } | null = null;
  const nameDown = (event: PointerEvent): void => {
    pressed = event.button === 0 && event.composedPath().includes(host) ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
  };
  const nameUp = (event: PointerEvent): void => {
    const down = pressed;
    pressed = null;
    if (down === null || down.id !== event.pointerId || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
    const first = event.composedPath()[0];
    // a press on a dot was the dot's
    if (first instanceof Element && first.classList.contains("wk-place")) return;
    let best: { entry: (typeof held) extends Map<string, infer E> ? E : never; away: number } | undefined;
    for (const entry of held.values()) {
      if (entry.button.dataset.pure === undefined || Number(entry.button.style.opacity || "1") < 0.2) continue;
      const r = entry.button.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) continue;
      const away = Math.hypot(event.clientX - (r.left + r.right) / 2, event.clientY - (r.top + r.bottom) / 2);
      if (best === undefined || away < best.away) best = { entry, away };
    }
    if (best !== undefined) options.pick(best.entry.mark.place, best.entry.site, { x: best.entry.x, y: best.entry.y });
  };
  const nameCancel = (): void => {
    pressed = null;
  };
  window.addEventListener("pointerdown", nameDown, true);
  window.addEventListener("pointerup", nameUp, true);
  window.addEventListener("pointercancel", nameCancel, true);

  // The landing sites' names beside their dots, with the country's flag: only with flags on, only on a body close enough to leave the room, and each in the first of the right or the left side that clears the dots and the names
  // already written (marks come in the order they matter). A label belongs to its dot's button, so a press on it is the dot's.
  const labelSites = (marks: readonly PlaceMark[], radiusPx: number): void => {
    const lang = options.lang();
    const width = box.clientWidth;
    const on = options.flags?.() === true && radiusPx >= SITE_LABEL_FROM_PX;
    // the names of the surface (Mare Imbrium, Plato) are written first and keep their place: a site's label goes round them
    const taken: { x0: number; x1: number; y0: number; y1: number }[] = marks
      .filter((mark) => mark.label === true && (mark.fade ?? 1) > 0.2)
      .map((mark) => {
        const halfWidth = Math.ceil(mark.place.name[lang].length * 3.7) + 5;
        return { x0: mark.x - halfWidth, x1: mark.x + halfWidth, y0: mark.y - 9, y1: mark.y + 9 };
      });
    const dots = marks.filter((mark) => mark.label !== true).map((mark) => ({ mark, x0: mark.x - 8, x1: mark.x + 8, y0: mark.y - 8, y1: mark.y + 8 }));
    const clear = (r: { x0: number; x1: number; y0: number; y1: number }, self: PlaceMark): boolean =>
      (width <= 0 || (r.x0 >= 0 && r.x1 <= width)) && !taken.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0) &&
      !dots.some((d) => d.mark !== self && r.x0 < d.x1 && r.x1 > d.x0 && r.y0 < d.y1 && r.y1 > d.y0);
    for (const mark of marks) {
      const entry = held.get(mark.place.id);
      if (entry === undefined) continue;
      let side: "right" | "left" | undefined;
      if (on && mark.label !== true && entry.site !== undefined) {
        const text = entry.site.name[lang];
        const w = 13 + text.length * 6.4 + (flagCodeOf(entry.site.country) === undefined ? 0 : 19);
        const right = { x0: mark.x + 10, x1: mark.x + 10 + w, y0: mark.y - 8, y1: mark.y + 8 };
        const left = { x0: mark.x - 10 - w, x1: mark.x - 10, y0: mark.y - 8, y1: mark.y + 8 };
        const spot = clear(right, mark) ? right : clear(left, mark) ? left : undefined;
        if (spot !== undefined) {
          taken.push(spot);
          side = spot === right ? "right" : "left";
        }
      }
      if (side === undefined) {
        entry.label?.remove();
        entry.label = undefined;
        entry.labelKey = undefined;
        continue;
      }
      const key = `${lang}|${side}`;
      if (entry.label === undefined || !entry.label.isConnected || entry.labelKey !== key) {
        entry.label?.remove();
        const label = document.createElement("span");
        label.className = "wk-place-site";
        label.setAttribute("part", "place-site");
        label.setAttribute("aria-hidden", "true");
        label.dataset.side = side;
        const flag = flagFor(mark.place);
        const name = document.createElement("span");
        name.textContent = entry.site!.name[lang];
        if (flag !== undefined) label.append(flag);
        label.append(name);
        entry.button.append(label);
        entry.label = label;
        entry.labelKey = key;
      }
    }
  };
  return {
    set(marks, radiusPx = 0) {
      const lang = options.lang();
      const next = new Set<string>();
      for (const mark of marks) {
        const id = mark.place.id;
        next.add(id);
        let entry = held.get(id);
        if (entry === undefined) {
          const button = make(mark);
          entry = { button, mark, x: Number.NaN, y: Number.NaN, lang: "", site: findLandingSite(id) };
          held.set(id, entry);
          box.insertBefore(button, tip);
        }
        entry.mark = mark;
        if (entry.lang !== lang || entry.button.dataset.name !== (mark.label === true ? "1" : undefined)) {
          entry.lang = lang;
          entry.button.dataset.layer = mark.layer;
          if (mark.label === true) {
            entry.button.dataset.name = "1";
            entry.button.textContent = mark.place.name[lang];
          } else {
            delete entry.button.dataset.name;
            entry.button.textContent = "";
          }
          entry.button.setAttribute("aria-label", `${mark.place.name[lang]}, ${placeLine(mark.place, lang)}`);
        }
        // a name for a place the page asked for stands in for its dot and takes the press as the dot does; a name only is the picture's, and takes no press
        const pure = mark.label === true && mark.nameOnly === true ? "1" : undefined;
        if (entry.button.dataset.pure !== pure) {
          if (pure === undefined) {
            delete entry.button.dataset.pure;
            entry.button.removeAttribute("tabindex");
          } else {
            entry.button.dataset.pure = pure;
            // a written name is part of the picture, and a dozen of them would be a dozen stops between the view and its controls
            entry.button.tabIndex = -1;
          }
        }
        const opacity = mark.label === true ? (mark.fade ?? 1).toFixed(2) : "";
        if (entry.button.style.opacity !== opacity) entry.button.style.opacity = opacity;
        const shift = mark.label === true ? " translate(-50%, -50%)" : "";
        if (!(Math.abs(entry.x - mark.x) < 0.25 && Math.abs(entry.y - mark.y) < 0.25) || entry.button.dataset.shift !== shift) {
          entry.x = mark.x;
          entry.y = mark.y;
          entry.button.dataset.shift = shift;
          entry.button.style.transform = `translate(${mark.x.toFixed(1)}px,${mark.y.toFixed(1)}px)${shift}`;
        }
      }
      labelSites(marks, radiusPx);
      for (const [id, entry] of held) {
        if (next.has(id)) continue;
        entry.button.remove();
        held.delete(id);
        hideTip(id);
      }
      shown = marks.filter((mark) => mark.nameOnly !== true).map((mark) => ({ id: mark.place.id, layer: mark.layer, x: mark.x, y: mark.y }));
      placeTip();
    },
    clear() {
      for (const entry of held.values()) entry.button.remove();
      held.clear();
      shown = [];
      hideTip();
    },
    get shown() {
      return shown;
    },
    dispose() {
      window.removeEventListener("pointerdown", nameDown, true);
      window.removeEventListener("pointerup", nameUp, true);
      window.removeEventListener("pointercancel", nameCancel, true);
      this.clear();
      box.remove();
      style.remove();
    },
  };
}
