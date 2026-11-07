// The frame a page puts in an iframe. The address says what it shows, and the frame fetches nothing but its own files (the surface pictures and three.js, when a 3D look is asked for):
//   ?body=saturn                 which body (jupiter by default)
//   &look=line|realistic|painted the drawing (line by default; the 3D looks need WebGL and fall back to the line drawing)
//   &time=now|2026-11-02T12:00Z  the body as the Earth sees it then (a portrait when left out)
//   &moons=1                     the planet with its moons on their orbits
//   &turn=12                     degrees a second it turns by itself (the default rate when this is left out; 0 stays still)
//   &tilt=  &pitch=  &phase=     a portrait's pose, degrees
//   ?scene=...                   a scene of the portrait builder instead of one body (the text its address holds)
// It draws only when something changes, and nothing while it is out of sight or the tab is hidden.
import "../src/element.ts";
import "../src/portrait/element.ts";
import "../src/bodies/all.ts";
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

function body(): void {
  const element = document.createElement("wakusei-body") as WakuseiBody;
  element.setAttribute("body", query.get("body") ?? "jupiter");
  element.setAttribute("look", query.get("look") ?? "line");
  element.setAttribute("texture-base", query.get("texture-base") ?? "textures/");
  for (const name of ["time", "tilt", "pitch", "phase", "meridian", "turn", "rate", "range", "scale-to", "lang"]) {
    const value = query.get(name);
    if (value !== null) element.setAttribute(name, value);
  }
  if (query.get("moons") === "1") element.setAttribute("moons", "");
  frame.append(element);
}

if (query.has("scene")) portrait();
else body();
