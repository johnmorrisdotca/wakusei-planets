import { delegates } from "../scene/store.ts";

// The Earth is drawn by chikyu-earth's own elements, not a second copy of them: the line globe with the countries, and the Earth from space with the real Sun, clouds and night lights.
// chikyu-earth is an optional peer, loaded only when an Earth is drawn.
const CENTRE = "10,20";

delegates.set("earth", {
  async line({ center, size }) {
    await import("@johnmorrisdotca/chikyu-earth/element");
    const globe = document.createElement("chikyu-earth");
    globe.setAttribute("center", center || CENTRE);
    globe.setAttribute("look", "line");
    globe.setAttribute("size", String(size));
    return globe;
  },
  async live({ center, time, textureBase }) {
    await import("@johnmorrisdotca/chikyu-earth/realistic/element");
    const earth = document.createElement("chikyu-earth-realistic");
    earth.setAttribute("center", center || CENTRE);
    earth.setAttribute("time", time);
    if (textureBase !== null) earth.setAttribute("texture-base", textureBase);
    return earth;
  },
});
