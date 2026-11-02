import { apparent, lineSvg } from "@johnmorrisdotca/wakusei-planets";

// A server draws the same SVG a browser does: pure, no DOM, no browser globals.
const svg = lineSvg("saturn", { size: 240, time: Date.UTC(2026, 10, 2, 12) });
const page = `<!doctype html><title>Saturn</title>${svg}`;
console.log(page.length > 1000, apparent("saturn", Date.UTC(2026, 10, 2, 12)).subObserverLat.toFixed(0));
