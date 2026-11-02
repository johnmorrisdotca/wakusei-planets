// The frame a page puts in an iframe. The address says what it shows, and the frame fetches nothing but its own files (the surface pictures and three.js, when a 3D look is asked for):
//   ?body=saturn                 which body (jupiter by default)
//   &look=line|realistic|painted the drawing (line by default; the 3D looks need WebGL and fall back to the line drawing)
//   &time=now|2026-11-02T12:00Z  the body as the Earth sees it then (a portrait when left out)
//   &moons=1                     the planet with its moons on their orbits
//   &turn=12                     degrees a second it turns by itself (still by default)
//   &tilt=  &pitch=  &phase=     a portrait's pose, degrees
// It draws only when something changes, and nothing while it is out of sight or the tab is hidden.
import "../src/element.ts";
import "../src/bodies/all.ts";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";

setThreeLoader(() => import("./three-subset.ts"));
const query = new URLSearchParams(location.search);
const frame = document.getElementById("frame")!;
const element = document.createElement("wakusei-body") as WakuseiBody;
const body = query.get("body") ?? "jupiter";
element.setAttribute("body", body);
element.setAttribute("look", query.get("look") ?? "line");
for (const name of ["time", "tilt", "pitch", "phase", "meridian", "turn", "rate", "range", "scale-to", "lang", "texture-base"]) {
  const value = query.get(name);
  if (value !== null) element.setAttribute(name, value);
}
if (query.get("moons") === "1") element.setAttribute("moons", "");
frame.append(element);
