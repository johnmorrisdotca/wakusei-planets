import "./earth-look.ts";
import { delegates, waiting } from "../scene/store.ts";

// The Earth's line look is chikyu-earth's own globe with the countries when the page has it (`import "@johnmorrisdotca/chikyu-earth/element"`), and this package's own outline when it does not.
// This entry never imports chikyu-earth itself, so a project without that optional peer still builds. The realistic and painted looks are drawn here like every other body's (earth-look.ts).
// A page that asks for it (`earth-from="chikyu"`) has chikyu-earth's realistic Earth in the shaded looks too, the same way: this entry never imports it, and without its element the body is drawn here as usual.
const CENTRE = "10,20";
const TAG = "chikyu-earth";
const REALISTIC = "chikyu-earth-realistic";
/** What a page's console is told, once, when the line Earth is the plain outline because chikyu-earth's element is not on the page. */
const MESSAGE = `wakusei-planets: the Earth's line look is drawn as a plain outline because chikyu-earth's element is not on the page. Import "@johnmorrisdotca/chikyu-earth/element" for the globe with the countries.`;
/** The same, for a page that asked for chikyu-earth's realistic Earth in a shaded look (`earth-from="chikyu"`) and has not imported its element. */
const SHADED_MESSAGE = `wakusei-planets: earth-from="chikyu" asks for chikyu-earth's realistic Earth, but its element is not on the page, so the Earth is drawn by this package. Import "@johnmorrisdotca/chikyu-earth/realistic/element" for its day and night, clouds and city lights.`;
/** How long the element has to arrive before the page is told (an import that comes a moment after this one is not a missing package). */
const GRACE_MS = 2000;

const present = (tag: string = TAG): boolean => typeof customElements !== "undefined" && customElements.get(tag) !== undefined;
const told = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** The Earth fell back to this package's own drawing: after a grace, if the element still has not come, say so once in the console (`console.info`: a missing optional peer is not an error). */
function missing(tag: string, message: string): void {
  if (told.has(tag) || timers.has(tag)) return;
  timers.set(
    tag,
    setTimeout(() => {
      timers.delete(tag);
      if (present(tag) || told.has(tag)) return;
      told.add(tag);
      console.info(message);
    }, GRACE_MS),
  );
}

delegates.set("earth", {
  async line({ center, size }) {
    if (!present()) {
      missing(TAG, MESSAGE);
      return null;
    }
    const globe = document.createElement(TAG);
    globe.setAttribute("center", center || CENTRE);
    globe.setAttribute("look", "line");
    globe.setAttribute("size", String(size));
    return globe;
  },
  async shaded({ center, time, textureBase }) {
    if (!present(REALISTIC)) {
      missing(REALISTIC, SHADED_MESSAGE);
      return null;
    }
    const globe = document.createElement(REALISTIC);
    globe.setAttribute("center", center || CENTRE);
    if (textureBase !== null) globe.setAttribute("texture-base", textureBase);
    // a date the page chose holds the Earth at it; with none the Earth keeps the real Sun's time and moves with it
    if (time !== null) {
      globe.setAttribute("time", time);
      globe.setAttribute("speed", "0");
    }
    return globe;
  },
});

for (const tag of [TAG, REALISTIC]) {
  if (typeof customElements !== "undefined" && customElements.get(tag) === undefined) {
    void customElements.whenDefined(tag).then(() => {
      for (const wake of waiting) wake();
    });
  }
}
