// The frame a page puts in an iframe. The address says what it shows, and the frame fetches nothing but its own files (the surface pictures and three.js, when a 3D look is asked for):
//   ?body=saturn                 which body (jupiter by default)
//   &look=line|realistic|painted the drawing (line by default; the 3D looks need WebGL and fall back to the line drawing)
//   &time=now|2026-11-02T12:00Z  the body as the Earth sees it then (a portrait when left out)
//   &moons=1                     the planet with its moons on their orbits
//   &turn=12                     degrees a second it turns by itself (the default rate when this is left out; 0 stays still)
//   &tilt=  &pitch=  &phase=     a portrait's pose, degrees
//   ?star=Betelgeuse             a star drawn from numbers instead of a body: its name, then &temperature-k=3600 &radius-sun=760 &luminosity-class=Ia &rotation-days= &oblateness= &activity= &corona= &estimated=radiusSun
//   ?scene=...                   a scene of the portrait builder instead of one body (the text its address holds)
//   ?lineup=1                    the size line-up instead: &stars=all|bright|largest (or ids)  &planets=1  &layout=row|stack  &zoom=0..1  &at=<id>  &turn=off  &look=painted  &labels=off
//   &zoom=2                      how far in the picture starts; a drag, a pinch, Ctrl and the wheel, the keys and the + and - buttons zoom it, and the address keeps up (the view's tilt is `vtilt`, for `tilt` is the pose's)
// It draws only when something changes, and nothing while it is out of sight or the tab is hidden.
import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import type { ViewChangeDetail, ViewControlsElement } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import "../src/element.ts";
import "../src/portrait/element.ts";
import "../src/lineup/element.ts";
import "../src/bodies/all.ts";
import "@johnmorrisdotca/chikyu-earth/element";
import "../src/bodies/earth.ts";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";

setThreeLoader(() => import("./three-subset.ts"));
const query = new URLSearchParams(location.search);
const frame = document.getElementById("frame")!;

function portrait(): void {
  const view = document.createElement("wakusei-portrait");
  view.setAttribute("scene", query.get("scene") ?? "");
  view.setAttribute("texture-base", query.get("texture-base") ?? "textures/");
  const lang = query.get("lang");
  if (lang !== null) view.setAttribute("lang", lang);
  frame.classList.add("portrait");
  frame.append(view);
}

/** The names a star's numbers go by in the address: the element's own attributes. */
const STAR_KEYS = ["temperature-k", "radius-sun", "luminosity-class", "rotation-days", "oblateness", "activity", "corona", "estimated", "quality"];

function body(): void {
  const element = document.createElement("wakusei-body") as WakuseiBody;
  if (query.has("star")) {
    element.setAttribute("star", query.get("star") ?? "");
    for (const name of STAR_KEYS) if (query.has(name)) element.setAttribute(name, query.get(name) ?? "");
  } else element.setAttribute("body", query.get("body") ?? "jupiter");
  element.setAttribute("look", query.get("look") ?? "line");
  element.setAttribute("texture-base", query.get("texture-base") ?? "textures/");
  element.setAttribute("tiles", query.get("tiles") ?? "tiles/");
  for (const name of ["time", "tilt", "pitch", "phase", "meridian", "turn", "rate", "range", "scale-to", "lang"]) {
    const value = query.get(name);
    if (value !== null) element.setAttribute(name, value);
  }
  if (query.get("moons") === "1") element.setAttribute("moons", "");
  frame.append(element);
}

/** The size line-up: the element takes its own attributes from the address, and carries its own zoom slider. */
function lineup(): void {
  const element = document.createElement("wakusei-lineup");
  for (const name of ["stars", "layout", "zoom", "at", "turn", "look", "lang", "labels", "controls"]) {
    const value = query.get(name);
    if (value !== null) element.setAttribute(name, value);
  }
  if (query.get("planets") === "1") element.setAttribute("planets", "");
  element.setAttribute("texture-base", query.get("texture-base") ?? "textures/");
  frame.classList.add("lineup");
  frame.append(element);
}

if (query.has("lineup")) lineup();
else if (query.has("scene")) portrait();
else body();

// the element carries the drag, pinch, wheel and keys; the bar adds the + and - buttons and keeps the view in the address, and takes the hands over while it is there. A frame under 240 pixels has no room for the bar: the hands alone.
// The bar is added once the element has drawn (its first draw is the next microtask), so the picture is what it was and the bar's own work does not delay it.
const view = query.has("lineup") ? null : (frame.firstElementChild as (HTMLElement & { setView(view: Partial<ViewChangeDetail>): void }) | null);
if (view !== null) {
  view.id = "view";
  view.tabIndex = 0;
}
if (view !== null && Math.min(window.innerWidth, window.innerHeight) >= 240) {
  queueMicrotask(() => {
    const bar = document.createElement("kazoku-view-controls") as ViewControlsElement;
    for (const [name, value] of Object.entries({ for: "view", address: "", overlay: "", layout: "compact", speed: "0", "address-keys": "tilt:vtilt", ...(query.has("scene") ? { flat: "" } : {}), ...(query.has("lang") ? { lang: query.get("lang")! } : {}) })) bar.setAttribute(name, value);
    bar.addEventListener("kazoku-viewchange", (event) => {
      const detail = (event as CustomEvent<ViewChangeDetail>).detail;
      view.setView(detail);
      if (window.parent !== window) window.parent.postMessage({ wakusei: "view", zoom: detail.zoom }, location.origin);
    });
    frame.append(bar);
  });
}
