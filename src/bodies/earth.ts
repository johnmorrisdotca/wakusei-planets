import "./earth-look.ts";
import { delegates } from "../scene/store.ts";

// The Earth's line look is chikyu-earth's own globe with the countries, not a second copy (chikyu-earth is an optional peer, loaded only when that line globe is drawn). The realistic and
// painted looks are drawn here like every other body's (earth-look.ts, which `/all` also loads).
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
});
