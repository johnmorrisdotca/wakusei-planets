import { planAt, planSvg } from "@johnmorrisdotca/wakusei-planets/plan";

// The plan needs no browser: where Mars and Io are on the drawing for a date, and the drawing itself as SVG text.
const time = Date.UTC(2026, 10, 11);
const sky = planAt(time, { mark: "mars" });
const mars = sky.dots.find((dot) => dot.id === "mars");
const io = planAt(time, { system: "jupiter", mark: "io", spacing: "true" }).dots.find((dot) => dot.id === "io");

console.log(`Mars: ${mars.distance.toFixed(2)} au from the Sun, ${Math.round(Math.hypot(mars.x, mars.y) * 100)} per cent of the way to the edge (${sky.extent} au)`);
console.log(`Io: ${io.distance.toFixed(1)} Jupiter radii from Jupiter's centre`);
console.log(`The SVG is ${planSvg(sky, { size: 240 }).startsWith("<svg") ? "an <svg>" : "not an SVG"}`);
