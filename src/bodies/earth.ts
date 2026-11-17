import "./earth-look.ts";
import { delegates, waiting } from "../scene/store.ts";

// The Earth's line look is chikyu-earth's own globe with the countries when the page has it (`import "@johnmorrisdotca/chikyu-earth/element"`), and this package's own outline when it does not.
// This entry never imports chikyu-earth itself, so a project without that optional peer still builds. The realistic and painted looks are drawn here like every other body's (earth-look.ts).
const CENTRE = "10,20";
const TAG = "chikyu-earth";
/** What a page's console is told, once, when the line Earth is the plain outline because chikyu-earth's element is not on the page. */
const MESSAGE = `wakusei-planets: the Earth's line look is drawn as a plain outline because chikyu-earth's element is not on the page. Import "@johnmorrisdotca/chikyu-earth/element" for the globe with the countries.`;
/** How long the element has to arrive before the page is told (an import that comes a moment after this one is not a missing package). */
const GRACE_MS = 2000;

const present = (): boolean => typeof customElements !== "undefined" && customElements.get(TAG) !== undefined;
let told = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** The line Earth fell back to the outline: after a grace, if the element still has not come, say so once in the console (`console.info`: a missing optional peer is not an error). */
function missing(): void {
  if (told || timer !== undefined) return;
  timer = setTimeout(() => {
    timer = undefined;
    if (present() || told) return;
    told = true;
    console.info(MESSAGE);
  }, GRACE_MS);
}

delegates.set("earth", {
  async line({ center, size }) {
    if (!present()) {
      missing();
      return null;
    }
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
