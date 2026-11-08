import "./earth-look.ts";
import { delegates, waiting } from "../scene/store.ts";

// The Earth's line look is chikyu-earth's own globe with the countries when the page has it (`import "@johnmorrisdotca/chikyu-earth/element"`), and this package's own outline when it does not.
// This entry never imports chikyu-earth itself, so a project without that optional peer still builds. The realistic and painted looks are drawn here like every other body's (earth-look.ts).
const CENTRE = "10,20";
const TAG = "chikyu-earth";

delegates.set("earth", {
  async line({ center, size }) {
    if (customElements.get(TAG) === undefined) return null;
    const globe = document.createElement(TAG);
    globe.setAttribute("center", center || CENTRE);
    globe.setAttribute("look", "line");
    globe.setAttribute("size", String(size));
    return globe;
  },
});

if (typeof customElements !== "undefined" && customElements.get(TAG) === undefined) {
  void customElements.whenDefined(TAG).then(() => {
    for (const wake of waiting) wake();
  });
}
