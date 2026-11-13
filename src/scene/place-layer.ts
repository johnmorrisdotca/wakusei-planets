// The marks of places laid over a view (`<wakusei-body>`, `<wakusei-space>`): one small quiet button for each place `placeMarks` chose, its name in a tip on hover, focus or touch, and a pick on a click or
// Enter. The buttons are kept by the place's id from one draw to the next and only moved, so a turning body moves its marks without making them again. Nothing here draws the 3D picture or asks for a draw.
import type { Place, PlaceBody } from "../places.ts";
import type { PlaceLayer, PlaceMark } from "../place-marks.ts";

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
.wk-place[data-name]::before{display:none}`;

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
  /** Lay these marks, moving the ones already there, adding the new and taking away the rest. */
  set(marks: readonly PlaceMark[]): void;
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
export function createPlaceLayer(root: ShadowRoot, options: { lang(): "en" | "ja"; pick(place: Place, at: { x: number; y: number }): void }): PlaceLayerView {
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
  const held = new Map<string, { button: HTMLButtonElement; mark: PlaceMark; x: number; y: number; lang: string }>();
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
    tip.replaceChildren(name, line);
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
    // a press on a mark is the mark's, not the start of a drag or a pick of the body under it; a touch shows the name as well
    button.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (event.pointerType !== "mouse") showTip(id);
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const entry = held.get(id);
      if (entry !== undefined) options.pick(entry.mark.place, { x: entry.x, y: entry.y });
    });
    return button;
  };

  return {
    set(marks) {
      const lang = options.lang();
      const next = new Set<string>();
      for (const mark of marks) {
        const id = mark.place.id;
        next.add(id);
        let entry = held.get(id);
        if (entry === undefined) {
          const button = make(mark);
          entry = { button, mark, x: Number.NaN, y: Number.NaN, lang: "" };
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
      for (const [id, entry] of held) {
        if (next.has(id)) continue;
        entry.button.remove();
        held.delete(id);
        hideTip(id);
      }
      shown = marks.map((mark) => ({ id: mark.place.id, layer: mark.layer, x: mark.x, y: mark.y }));
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
      this.clear();
      box.remove();
      style.remove();
    },
  };
}
